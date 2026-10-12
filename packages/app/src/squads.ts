import type { ItemLook } from "@chessroyale/core";
import type { MoveScore } from "@chessroyale/chess";
import {
  SQUADS_PROTOCOL,
  type Colour,
  type NetParty,
  type NetSquadsHalf,
  type NetSquadsLobby,
  type NetSquadsMatch,
  type NetSquadsVote,
  type NetTeamClock,
  type PartyClientMessage,
  type PartyServerMessage,
  type SquadsClientMessage,
  type SquadsPlacement,
  type SquadsBlock,
  type SquadsServerMessage,
} from "@chessroyale/chess/squads";
import { account, playerName } from "./account.ts";
import { enginePool, engineSpeed } from "./engine.ts";
import { showBanNotice } from "./components/FairPlay.tsx";
import { play } from "./sound.ts";
import { blockName, dutyOf, liveBank, movesOfHalf, sideIn, squadName, squadOf, type LocalBoard, type LocalMatch } from "./squads-view.ts";

/**
 * Squads on this device (docs/areas/squads.md, "The screens"): the lobby's socket and everything the screens draw from
 * it, a party's socket, the solo queue and the test lobby. The server runs every rule (squads-lobby.ts); this keeps
 * what it said, in local time, answers its bot work with this device's engines, and makes the mode's few sounds.
 */

const device = (): "phone" | "computer" => (matchMedia("(pointer: coarse)").matches ? "phone" : "computer");
const wsBase = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // No storage: no rejoining.
  }
}
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** This device's seat in a Squads lobby (its token): kept to rejoin, forgotten once done. */
const seatKey = (code: string) => `brc.squads.${code.toUpperCase()}`;
/** The Squads lobby this device is in (opening the app from scratch goes back to it). */
const CURRENT_KEY = "brc.squads.current";
export const squadsSeat = (code: string) => stored(seatKey(code));
export const currentSquads = () => {
  const c = stored(CURRENT_KEY);
  return c && /^[A-Z2-9]{5}$/.test(c) && squadsSeat(c) ? c : null;
};
export function forgetSquads(code: string) {
  store(seatKey(code), null);
  if (stored(CURRENT_KEY) === code) store(CURRENT_KEY, null);
}

/** GET /api/squads/lobby/CODE: open and its phase; null when it can't tell (offline). */
export async function squadsStatus(code: string): Promise<{ open: boolean; phase?: NetSquadsLobby["phase"] } | null> {
  try {
    const res = await fetch(`/api/squads/lobby/${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(5000) });
    if (res.status !== 200 && res.status !== 404) return null;
    const body = (await res.json()) as { open?: boolean; phase?: NetSquadsLobby["phase"] };
    return typeof body.open === "boolean" ? { open: body.open, phase: body.phase } : null;
  } catch {
    return null;
  }
}

/** The answer to PLAY (the Squads queue) and a test lobby: a lobby's code, or why not. */
export type SquadsSeatAnswer = { code: string } | { error: string } | { banned: true } | { busy: true; waitSeconds: number };

/**
 * PLAY in Squads: the solo queue (the matchmaker seats you in a lobby filling up; bots fill the rest after the fill
 * time). Servers busy: in line, asking again as told (`onBusy` says how long), until `cancelled()`.
 */
export async function squadsQueue(onBusy: (waitSeconds: number) => void, cancelled: () => boolean): Promise<SquadsSeatAnswer | null> {
  const q = new URLSearchParams();
  const pool = new URLSearchParams(location.search).get("pool");
  if (pool) q.set("pool", pool);
  for (;;) {
    const res = await fetch(`/api/squads/play${q.size ? `?${q}` : ""}`, { method: "POST" }).catch(() => null);
    if (cancelled()) return null;
    if (!res) return { error: "You're offline." };
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; busy?: boolean; ticket?: string; waitSeconds?: number; retryMs?: number; banned?: boolean };
    if (body.banned) return { banned: true };
    if (body.code) return { code: body.code };
    if ((body.busy && body.ticket) || res.status === 429) {
      if (body.ticket) q.set("ticket", body.ticket);
      onBusy(body.waitSeconds ?? 30);
      await new Promise((r) => setTimeout(r, Math.max(1000, body.retryMs ?? 3000)));
      if (cancelled()) return null;
      continue;
    }
    return { error: body.message ?? "Couldn't find a match." };
  }
}

/**
 * Test controls: a test lobby from the first vote (`votes`: bots in every other seat at once), or straight at Relay,
 * Pairs or the final (admins; anyone where SQUADS_TEST is on). `extra`: the link's own test options, passed on (`fen`:
 * the first round's position; `bots=strong`; `seat=white`: you play White on your first board), for tests.
 */
export async function squadsTestLobby(start: "votes" | "relay" | "pairs" | "final", clock?: string | null, extra?: URLSearchParams): Promise<SquadsSeatAnswer> {
  const q = new URLSearchParams({ start });
  if (clock) q.set("clock", clock);
  for (const k of ["fen", "bots", "seat"]) {
    const v = extra?.get(k);
    if (v) q.set(k, v);
  }
  try {
    const res = await fetch(`/api/squads/lobby?${q}`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    if (body.code) return { code: body.code };
    return { error: res.status === 404 ? "Test lobbies are for admins." : (body.message ?? "Couldn't make a test lobby.") };
  } catch {
    return { error: "You're offline." };
  }
}

/**
 * A note for the screen, shown for a moment: a choice or block refused (the rules' reason, in words: `kind` "no"), or
 * news (a block placed or lifted, a token refunded: "news").
 */
export interface SquadsNote {
  text: string;
  at: number;
  kind?: "no" | "news";
}

const REFUSED: Record<string, string> = {
  no_tokens: "No same-move tokens left: pick a different move.",
  blocked: "That move is blocked this turn.",
  illegal: "That move isn't legal here.",
  late: "Too late: your time was up.",
  no_duty: "It's not your turn to choose.",
  already_moved: "You've already moved.",
  match_over: "The match is over.",
  stale: "That half is over.",
};

const BLOCK_REFUSED: Record<string, string> = {
  block_taken: "That move is already blocked.",
  bank: "Not enough block points left.",
  king: "The king's moves can't be blocked (castling can).",
  not_a_move: "That piece can't move there.",
  no_piece: "Tap one of their pieces.",
  locked: "Your squad's move is locked in.",
  already_moved: "You've already moved.",
  no_duty: "You can block only on your own board, on your turn.",
  late: "Too late: your time was up.",
  stale: "That half is over.",
  match_over: "The match is over.",
};

/**
 * One Squads lobby on this device: its socket (reconnecting with this device's seat), and the lobby, the vote, every
 * match, every squad's clock, your placement and the results, all in local time. The screens read it and call its
 * actions; `subscribe` tells them when it changed.
 */
export class SquadsClient {
  myId: string | null = null;
  /** You may use the test controls (an admin, or SQUADS_TEST on). */
  test = false;
  /** "Cheat lines" switched on (test controls only): the engine's top moves wherever you choose, until switched off. */
  cheatLines = false;
  lobby: NetSquadsLobby | null = null;
  vote: NetSquadsVote | null = null;
  readonly matches = new Map<string, LocalMatch>();
  clocks: NetTeamClock[] = [];
  placed: { squadId: number; placement: SquadsPlacement; coins: number; crates: number; recorded: boolean } | null = null;
  results: Record<number, SquadsPlacement> | null = null;
  /** What each person wears (sent once per player: the last one seen is kept). */
  readonly looks = new Map<string, ItemLook>();
  /** Can't join (full, started, an old app): the message. */
  error: string | null = null;
  /** The lobby has ended or closed (or is gone): the app goes home. */
  gone: string | null = null;
  /** You left (Leave, queue again): the socket is closed. */
  left = false;
  /**
   * Your choice and lock as sent, shown at once until the server's "choices" carry them (or "choiceNo" takes them back):
   * a Relay move stays on your board, a pick never blinks out when someone else's choice arrives first.
   */
  private mine: { key: string; seq: number; move: string; lock: boolean } | null = null;
  /** Each match's choices and locks as the server last said (the screen shows them with `mine` on top). */
  private server = new Map<string, { visible: Record<string, string>; locked: string[] }>();
  note: SquadsNote | null = null;
  /** A short banner over a board: a block placed or lifted (both squads see it). */
  banner: { key: string; board: number; text: string; at: number } | null = null;
  /** Your party's pass in this lobby (you sit with your party). */
  readonly party: string | null;
  /** The match the screen shows on its big board (whose squads' sudden death is heard). */
  focus: string | null = null;
  private ws: WebSocket | null = null;
  private offset = 0;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private listeners = new Set<() => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly code: string,
    opts: { party?: string | null } = {},
  ) {
    this.party = opts.party ?? null;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Server time → this device's. */
  local(t: number): number {
    return t - this.offset;
  }

  get me() {
    return this.lobby?.players.find((p) => p.id === this.myId) ?? null;
  }
  get mySquad() {
    return squadOf(this.lobby, this.myId);
  }
  nameOf(id: string): string {
    return this.lobby?.players.find((p) => p.id === id)?.name ?? "?";
  }
  isBot(id: string): boolean {
    return !!this.lobby?.players.find((p) => p.id === id)?.isBot;
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(`${wsBase()}/api/squads/lobby/${this.code}/ws`);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.retry = 0;
      const token = squadsSeat(this.code) ?? undefined;
      this.send({ t: "hello", v: SQUADS_PROTOCOL, token, name: playerName(), device: device(), ...(this.party && !token ? { party: this.party } : {}), look: account().profile?.locker?.look ?? {} });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as SquadsServerMessage);
    ws.onclose = () => {
      if (this.closed) return;
      const again = () => {
        if (this.closed) return;
        this.retryTimer = setTimeout(() => this.connect(), Math.min(8000, 500 * 2 ** this.retry++));
      };
      if (opened) return again();
      // Refused before it opened: a lobby that's gone refuses every connection, so ask.
      void squadsStatus(this.code).then((s) => (s && !s.open ? this.goneNow("That match has ended.") : again()));
    };
    if (!this.ticker) this.ticker = setInterval(() => this.tick(), 100);
    document.addEventListener("visibilitychange", this.onVisible);
  }

  private onVisible = () => {
    if (document.visibilityState !== "visible" || this.closed || !this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.connect();
  };

  private goneNow(why: string) {
    this.gone = why;
    forgetSquads(this.code);
    this.dispose();
    this.emit();
  }

  dispose() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    document.removeEventListener("visibilitychange", this.onVisible);
    try {
      this.ws?.close();
    } catch {
      // Already closed.
    }
  }

  private send(msg: SquadsClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // ---------------- Actions ----------------

  castVote(option: number) {
    if (!this.vote || !this.myId) return;
    // (Yours shows at once; the server's voteCast confirms it.)
    const at = Date.now();
    const mine = { playerId: this.myId, option, at, squad: this.mySquad?.id ?? 0 };
    this.vote = { ...this.vote, votes: [...this.vote.votes.filter((v) => v.playerId !== this.myId), mine] };
    this.send({ t: "vote", key: this.vote.key, option });
    this.emit();
  }

  /** Your move (Relay), pick or block (Pairs, the final). A Relay move shows on your board at once. */
  choose(key: string, move: string) {
    const m = this.matches.get(key);
    if (!m?.current || !this.myId) return;
    const d = dutyOf(m, this.myId);
    if (!d) return;
    const seq = m.current.seq;
    // (A Relay move is made once.)
    if (d.duty.role === "move" && m.visible[this.myId]) return;
    this.mine = { key, seq, move, lock: d.duty.role === "move" };
    m.choiceAt = { ...m.choiceAt, [this.myId]: Date.now() };
    this.send({ t: "choose", key, seq, move });
    this.showChoices(m);
    this.emit();
  }

  /**
   * Block one of the other squad's moves on your board this half (from and to: "g8f6"). It shows at once, paid from
   * your squad's bank; the server confirms it to everyone (or refuses it: "blockNo").
   */
  block(key: string, board: number, move: string) {
    const m = this.matches.get(key);
    if (!m?.current || !this.myId) return;
    const d = dutyOf(m, this.myId);
    if (!d || d.duty.board !== board || m.placed.some((b) => b.board === board && b.move === move)) return;
    const seq = m.current.seq;
    this.send({ t: "block", key, seq, board, move });
    this.pendingBlocks.push({ key, seq, board, move });
    this.emit();
  }

  /** Blocks you've sent that the server hasn't confirmed yet (shown at once, as yours). */
  pendingBlocks: { key: string; seq: number; board: number; move: string }[] = [];

  /** Lock in your pick (the half ends early once everyone with a duty has). */
  lock(key: string) {
    const m = this.matches.get(key);
    if (!m?.current || !this.myId || !m.visible[this.myId]) return;
    const seq = m.current.seq;
    if (this.mine?.key === key && this.mine.seq === seq) this.mine = { ...this.mine, lock: true };
    else this.mine = { key, seq, move: m.visible[this.myId]!, lock: true };
    this.send({ t: "lock", key, seq });
    this.showChoices(m);
    this.emit();
  }

  armageddon(key: string, colour: Colour) {
    this.send({ t: "armageddon", key, colour });
  }

  nextRound() {
    this.send({ t: "nextRound" });
  }

  /** Test controls only: "Cheat lines" on or off (on this device; nothing is sent). */
  toggleCheatLines() {
    this.cheatLines = this.test && !this.cheatLines;
    this.emit();
  }

  reclaim() {
    this.send({ t: "reclaim" });
  }

  /** Leave: before the lobby fills your seat is free again; after, you go (a bot takes your seat if your squad still plays). */
  leave() {
    this.send({ t: "leave" });
    this.left = true;
    forgetSquads(this.code);
    // (No reconnecting from here on: the server closes the socket, and a new hello without the seat's token would take a
    // new seat. A moment for the message to go before this side closes it.)
    this.closed = true;
    setTimeout(() => this.dispose(), 150);
    this.emit();
  }

  sync() {
    this.send({ t: "sync" });
  }

  // ---------------- Messages ----------------

  /**
   * What the screen shows of a match's live choices: the server's, with yours as sent on top until the server has them.
   * Who locked in when (first seen here) runs the team clocks; when each choice last changed, the live arrows.
   */
  private showChoices(m: LocalMatch) {
    const srv = this.server.get(m.key) ?? { visible: {}, locked: [] };
    const visible = { ...srv.visible };
    const locked = new Set(srv.locked);
    const mine = this.mine;
    if (mine && this.myId && mine.key === m.key && mine.seq === m.current?.seq) {
      if (srv.visible[this.myId] === mine.move && (!mine.lock || srv.locked.includes(this.myId))) this.mine = null;
      else {
        visible[this.myId] = mine.move;
        if (mine.lock) locked.add(this.myId);
        else locked.delete(this.myId);
      }
    }
    const now = Date.now();
    for (const [id, mv] of Object.entries(visible)) if (m.visible[id] !== mv && id !== this.myId) m.choiceAt = { ...m.choiceAt, [id]: now };
    for (const id of locked) if (m.lockedAt[id] === undefined) m.lockedAt = { ...m.lockedAt, [id]: now };
    m.visible = visible;
    m.locked = [...locked];
  }

  /** The server's choices and locks for a match's half (from "match" or "choices"). */
  private serverChoices(m: LocalMatch, visible: Record<string, string>, locked: readonly string[]) {
    this.server.set(m.key, { visible: { ...visible }, locked: [...locked] });
    this.showChoices(m);
  }

  /** A new half (or a half played): nothing chosen yet, no blocks placed. */
  private freshHalf(m: LocalMatch) {
    this.server.set(m.key, { visible: {}, locked: [] });
    if (this.mine?.key === m.key) this.mine = null;
    this.pendingBlocks = this.pendingBlocks.filter((b) => b.key !== m.key);
    m.visible = {};
    m.locked = [];
    m.lockedAt = {};
    m.choiceAt = {};
    m.placed = [];
  }

  private localHalf(h: NetSquadsHalf | null): NetSquadsHalf | null {
    if (!h) return null;
    return {
      ...h,
      startedAt: this.local(h.startedAt),
      duties: h.duties.map((d) => ({ ...d, deadline: this.local(d.deadline) })),
      scouts: h.scouts.map((d) => ({ ...d, deadline: this.local(d.deadline) })),
    };
  }

  private localMatch(m: NetSquadsMatch, moves: (i: number) => string[]): LocalMatch {
    return {
      ...m,
      startsAt: m.startsAt === null ? null : this.local(m.startsAt),
      current: this.localHalf(m.current),
      ...(m.armageddonChoice ? { armageddonChoice: { ...m.armageddonChoice, until: this.local(m.armageddonChoice.until) } } : {}),
      boards: m.boards.map((b, i): LocalBoard => ({ ...b, moves: moves(i) })),
      visible: {},
      locked: [],
      lockedAt: {},
      choiceAt: {},
      placed: [],
      blockAt: {},
      last: null,
    };
  }

  private localLobby(l: NetSquadsLobby): NetSquadsLobby {
    for (const p of l.players) if (p.look) this.looks.set(p.id, p.look);
    return {
      ...l,
      fillAt: l.fillAt === null ? null : this.local(l.fillAt),
      filledAt: l.filledAt === null ? null : this.local(l.filledAt),
      bracket: l.bracket.map((b) => (b.startsAt ? { ...b, startsAt: this.local(b.startsAt) } : b)),
      clocks: l.clocks.map((c) => this.localClock(c)),
    };
  }

  private localClock(c: NetTeamClock): NetTeamClock {
    return { ...c, since: c.since === null ? null : this.local(c.since) };
  }

  private onMessage(msg: SquadsServerMessage) {
    this.offset = msg.now - Date.now();
    switch (msg.t) {
      case "welcome":
        this.myId = msg.playerId;
        this.test = msg.test;
        if (!msg.test) this.cheatLines = false;
        this.error = null;
        store(seatKey(this.code), msg.token);
        store(CURRENT_KEY, this.code);
        void this.reportSpeed();
        break;
      case "lobby":
        this.lobby = this.localLobby(msg.lobby);
        if (msg.lobby.clocks.length) this.clocks = this.lobby.clocks;
        if (msg.lobby.phase !== "vote") this.vote = null;
        break;
      case "vote": {
        const v = msg.vote;
        this.vote = { ...v, startsAt: this.local(v.startsAt), until: this.local(v.until), votes: v.votes.map((x) => ({ ...x, at: this.local(x.at) })), ...(v.nextAt ? { nextAt: this.local(v.nextAt) } : {}) };
        break;
      }
      case "voteCast": {
        const v = this.vote;
        if (!v || v.key !== msg.key) break;
        const at = msg.playerId === this.myId ? (v.votes.find((x) => x.playerId === this.myId)?.at ?? this.local(msg.at)) : this.local(msg.at);
        this.vote = { ...v, votes: [...v.votes.filter((x) => x.playerId !== msg.playerId), { playerId: msg.playerId, option: msg.option, at, squad: msg.squad }] };
        break;
      }
      case "match": {
        const had = this.matches.get(msg.match.key);
        const same = !!had?.current && !!msg.match.current && had.current.seq === msg.match.current.seq;
        const m = this.localMatch(msg.match, (i) => msg.match.boards[i]!.moves ?? had?.boards[i]?.moves ?? []);
        m.last = had?.last ?? null;
        if (same) {
          m.lockedAt = had!.lockedAt;
          m.choiceAt = had!.choiceAt;
          m.visible = had!.visible;
          m.blockAt = had!.blockAt;
        } else if (this.mine?.key === m.key) this.mine = null;
        m.placed = msg.placed ?? [];
        // (Blocks in effect keep their first moment on screen: their arrows keep drawing on the same beat.)
        if (had) for (const b of m.blocks) m.blockAt[blockKey(b)] ??= had.blockAt[blockKey(b)] ?? Date.now();
        for (const b of m.placed) m.blockAt[blockKey(b)] ??= Date.now();
        this.serverChoices(m, msg.visible, msg.locked);
        this.matches.set(m.key, m);
        break;
      }
      case "block": {
        const had = this.matches.get(msg.key);
        this.pendingBlocks = this.pendingBlocks.filter((b) => !(b.key === msg.key && b.board === msg.block.board && b.move === msg.block.move));
        if (!had?.current || had.current.seq !== msg.seq || had.placed.some((b) => b.board === msg.block.board && b.move === msg.block.move)) break;
        const m: LocalMatch = { ...had, placed: [...had.placed, msg.block], blockAt: { ...had.blockAt, [blockKey(msg.block)]: Date.now() } };
        this.matches.set(m.key, m);
        // Both squads hear of it: a short banner.
        const by = msg.block.by === this.myId ? "You" : this.nameOf(msg.block.by);
        const squad = squadName(m.sides[msg.block.side].squadId);
        const mine = sideIn(m, this.myId) === msg.block.side;
        this.banner = { key: m.key, board: msg.block.board, at: Date.now(), text: mine ? `${by} blocked ${blockName(msg.block)} (−${msg.block.cost})` : `${squad} blocked your ${blockName(msg.block)}` };
        break;
      }
      case "blockNo": {
        this.pendingBlocks = this.pendingBlocks.filter((b) => !(b.key === msg.key && b.move === msg.move));
        if (msg.reason !== "stale") this.note = { text: BLOCK_REFUSED[msg.reason] ?? "That block was refused.", at: Date.now(), kind: "no" };
        break;
      }
      case "token": {
        const had = this.matches.get(msg.key);
        if (!had) break;
        const tokenLog = had.tokenLog.map((u, i) => (i === msg.index ? msg.use : u));
        if (msg.index >= tokenLog.length) tokenLog[msg.index] = msg.use;
        this.matches.set(msg.key, { ...had, tokenLog, tokens: msg.tokens });
        // The squad that used it hears of a refund (a small note); everyone sees its tokens back.
        if (msg.use.verdict?.refunded && sideIn(had, this.myId) === msg.use.side) this.note = { text: "Token refunded: only move", at: Date.now(), kind: "news" };
        break;
      }
      case "turn": {
        const had = this.matches.get(msg.key);
        if (!had) break;
        const m: LocalMatch = { ...had, state: "half", startsAt: null, current: this.localHalf(msg.current), banks: msg.banks };
        this.freshHalf(m);
        // (The blocks placed last half are in effect now: their arrows carry on from when they were placed.)
        m.blockAt = Object.fromEntries(m.blocks.map((b) => [blockKey(b), had.blockAt[blockKey(b)] ?? Date.now()]));
        this.matches.set(m.key, m);
        break;
      }
      case "clocks":
        this.clocks = msg.clocks.map((c) => this.localClock(c));
        break;
      case "choices": {
        const had = this.matches.get(msg.key);
        if (!had?.current || had.current.seq !== msg.seq) break;
        const m = { ...had };
        this.serverChoices(m, msg.visible, msg.locked);
        this.matches.set(m.key, m);
        break;
      }
      case "half":
        this.onHalf(msg);
        break;
      case "choiceNo": {
        const had = this.matches.get(msg.key);
        if (this.mine?.key === msg.key && this.mine.seq === msg.seq && this.mine.move === msg.move) {
          this.mine = null;
          if (had) {
            const m = { ...had };
            this.showChoices(m);
            this.matches.set(m.key, m);
          }
        }
        if (msg.reason !== "stale") this.note = { text: REFUSED[msg.reason] ?? "That choice was refused.", at: Date.now(), kind: "no" };
        break;
      }
      case "placed":
        this.placed = { squadId: msg.squadId, placement: msg.placement, coins: msg.coins, crates: msg.crates, recorded: msg.recorded };
        break;
      case "results":
        this.results = msg.placements;
        break;
      case "botWork":
        for (const job of msg.jobs) this.work.push(job);
        void this.runWork();
        break;
      case "left":
        this.left = true;
        break;
      case "error":
        if (msg.banned) {
          showBanNotice();
          this.goneNow("Banned");
        } else if (msg.ended) this.goneNow(msg.message);
        else if (!this.myId) {
          // Can't join (full, already started, an old app): no more reconnecting.
          this.error = msg.message;
          this.dispose();
        }
        break;
      case "closed":
        this.goneNow(msg.reason === "idle" ? "That lobby has closed." : "That match has ended.");
        break;
    }
    this.emit();
  }

  /** A half has been played: its moves join each board's list (checked against the server's count; "sync" if off). */
  private onHalf(msg: Extract<SquadsServerMessage, { t: "half" }>) {
    const had = this.matches.get(msg.key);
    const before = had?.boards.map((b) => b.fen) ?? msg.match.boards.map((b) => b.fen);
    let off = false;
    const m = this.localMatch(msg.match, (i) => {
      const moves = [...(had?.boards[i]?.moves ?? []), ...movesOfHalf(msg.events, i)];
      if (moves.length !== msg.match.boards[i]!.ply) off = true;
      return moves;
    });
    m.last = { seq: msg.seq, events: msg.events, before, at: Date.now(), until: m.startsAt ?? Date.now(), missed: msg.missed };
    this.freshHalf(m);
    // Blocks just placed carry on (in effect now) from when they were placed.
    m.blockAt = Object.fromEntries(m.blocks.map((b) => [blockKey(b), had?.blockAt[blockKey(b)] ?? Date.now()]));
    this.matches.set(m.key, m);
    // A block lifted (a mercy rule, or your move made it impossible): announced, refunded.
    const me = sideIn(m, this.myId);
    const lifted = msg.events.find((e): e is Extract<typeof e, { kind: "block" }> => e.kind === "block" && e.outcome !== "on" && me !== null && (e.outcome !== "impossible" || e.side === me));
    if (lifted && lifted.outcome !== "on") this.banner = { key: m.key, board: lifted.board, at: Date.now(), text: `Block lifted: ${LIFTED[lifted.outcome]} (refunded)` };
    if (off) this.sync();
    // Decided (a winner): over once its last half has been shown (the server says so only in the lobby's bracket). A
    // drawn final isn't: its Armageddon comes as a "match".
    if (m.result && m.result.winner !== null) {
      const key = m.key;
      const seq = msg.seq;
      setTimeout(() => {
        const now = this.matches.get(key);
        if (!now || now.last?.seq !== seq || now.state === "over" || now.state === "armageddon") return;
        this.matches.set(key, { ...now, state: "over", startsAt: null });
        this.emit();
      }, Math.max(0, m.last.until - Date.now()));
    }
    // The sudden-death sting: the squads on the big board (yours, by default), as the server says it began. (The
    // screen's clock already showed it, and the sting played then, when it ran out mid-half: once per squad.)
    for (const e of msg.events) if (e.kind === "sudden_death") this.stingFor(m.sides[e.side].squadId, m.key);
  }

  // ---------------- Sounds: the free seconds' ticks and the sudden-death sting ----------------

  /** Squads whose sudden death has been heard (and their bank was 0 when last looked at). */
  private heard = new Map<number, boolean>();
  private lastTick: string | null = null;

  private stingFor(squadId: number, key: string) {
    const watching = this.focus ?? this.myMatchKey();
    if (key !== watching) {
      this.heard.set(squadId, true);
      return;
    }
    if (this.heard.get(squadId)) return;
    this.heard.set(squadId, true);
    play("sqSting");
  }

  private myMatchKey(): string | null {
    const sq = this.mySquad;
    if (!sq) return null;
    for (const m of this.matches.values()) if (m.state !== "over" && m.sides.some((s) => s.squadId === sq.id)) return m.key;
    return null;
  }

  /**
   * Every tenth of a second while a half is live: a short tick in the last seconds of your free time (only while you
   * still have a choice to make), and the sting the moment a squad on the big board runs out of bank.
   */
  private tick() {
    const now = Date.now();
    const key = this.focus ?? this.myMatchKey();
    const m = key ? this.matches.get(key) : undefined;
    if (!m || m.state !== "half" || !m.current) return;
    for (const side of [0, 1] as const) {
      const id = m.sides[side].squadId;
      const out = liveBank(m, side, now) <= 0;
      if (out && !this.heard.get(id) && m.banks[side] > 0) this.stingFor(id, m.key);
      else if (!out && m.banks[side] > 0) this.heard.set(id, false);
    }
    const d = this.myId ? dutyOf(m, this.myId) : null;
    if (!d || m.locked.includes(this.myId!)) return;
    const left = m.current.startedAt + m.delayMs - now;
    const secs = Math.ceil(left / 1000);
    if (left <= 0 || secs > TICK_FREE_FROM || secs >= Math.ceil(m.delayMs / 1000)) return;
    const mark = `${m.key}/${m.current.seq}/${secs}`;
    if (this.lastTick === mark) return;
    this.lastTick = mark;
    play("sqTick");
  }

  // ---------------- Bot work on this device ----------------

  private work: { id: string; fen: string; n: number; nodes: number }[] = [];
  private working = false;
  /** Bot-work jobs this device has answered (tests read it). */
  botAnswers = 0;

  /** This device's engine speed, so the lobby can give it bot work (once per page; again on each reconnect). */
  private async reportSpeed() {
    try {
      const nps = await engineSpeed();
      this.send({ t: "speed", nps });
    } catch {
      // No engine here: this device takes no bot work (the lobby's other devices, or its quick look, do).
    }
  }

  /** The lobby's bot work: each job's top moves at its depth (the same on every device), on every engine at once. */
  private async runWork() {
    if (this.working) return;
    this.working = true;
    try {
      const engines = await enginePool();
      await Promise.all(
        engines.map(async (engine) => {
          for (let job = this.work.shift(); job; job = this.work.shift()) {
            if (this.closed) return;
            const top: MoveScore[] | null = await engine.topMovesAt(job.fen, job.n, job.nodes).catch(() => null);
            // (No answer: another device's stands, or the lobby's quick look.)
            if (top?.length) this.botAnswers++;
            if (top?.length) this.send({ t: "botTop", id: job.id, top: top.map((x) => ({ move: x.move, expected: x.expected, ...(x.mate !== undefined ? { mate: x.mate } : {}), ...(x.reply ? { reply: x.reply } : {}) })) });
          }
        }),
      );
    } catch {
      // No engine: the work goes elsewhere.
    } finally {
      this.working = false;
      if (this.work.length && !this.closed) void this.runWork();
    }
  }

  /** Your side in a match (null: watching). */
  sideIn(m: LocalMatch) {
    return sideIn(m, this.myId);
  }
}

/** Ticks in the last this-many seconds of your free time. */
export const TICK_FREE_FROM = 3;

/** A block's identity on screen (its arrow's beat is kept by it). */
export const blockKey = (b: Pick<SquadsBlock, "board" | "move">) => `${b.board}/${b.move}`;

/** Why a block was lifted, in words. */
const LIFTED = { impossible: "that move isn't possible now", check: "they're in check", no_move: "it would have left no move", mate: "it would have left only moves that allow mate" } as const;

// ---------------- Parties ----------------

const partyKey = (code: string) => `brc.party.${code.toUpperCase()}`;
const PARTY_CURRENT = "brc.party.current";
/** The party this device was last in (after a lobby, "Back to your party" reopens it). */
export const currentParty = () => {
  const c = stored(PARTY_CURRENT);
  return c && /^[A-Z2-9]{5}$/.test(c) && stored(partyKey(c)) ? c : null;
};

/** GET /api/squads/party/CODE: open or not; null when it can't tell. */
export async function partyStatus(code: string): Promise<boolean | null> {
  try {
    const res = await fetch(`/api/squads/party/${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(5000) });
    if (res.status === 404) return false;
    if (!res.ok) return null;
    return !!((await res.json()) as { open?: boolean }).open;
  } catch {
    return null;
  }
}

/** POST /api/squads/party: a new party's code. */
export async function createParty(): Promise<{ code: string } | { error: string } | { banned: true }> {
  // (?pool=NAME: a queue of its own, for tests.)
  const pool = new URLSearchParams(location.search).get("pool");
  try {
    const res = await fetch(`/api/squads/party${pool ? `?pool=${encodeURIComponent(pool)}` : ""}`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; banned?: boolean };
    if (body.banned) return { banned: true };
    return body.code ? { code: body.code } : { error: body.message ?? "Couldn't make a party." };
  } catch {
    return { error: "You're offline." };
  }
}

/**
 * A party on this device: up to 4 friends under a code (the invite link is /squads/party/CODE). The leader queues;
 * when the party is placed, `onPlaced` gets the lobby and its pass (once per placing, even across reloads), and the
 * socket closes: everyone plays the lobby, and comes back to the party afterwards ("Back to your party").
 */
export class PartyClient {
  party: NetParty | null = null;
  memberId: string | null = null;
  error: string | null = null;
  /** Closed: left, or the party's gone. */
  done = false;
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  constructor(
    readonly code: string,
    private readonly onPlaced: (lobby: string, pass: string) => void,
  ) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  get isLeader() {
    return !!this.memberId && this.party?.leaderId === this.memberId;
  }

  /** The invite link. */
  get link() {
    return `${location.origin}/squads/party/${this.code}`;
  }

  connect() {
    if (this.done) return;
    const ws = new WebSocket(`${wsBase()}/api/squads/party/${this.code}/ws`);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.retry = 0;
      this.send({ t: "hello", v: SQUADS_PROTOCOL, token: stored(partyKey(this.code)) ?? undefined, name: playerName(), device: device() });
    };
    ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as PartyServerMessage);
    ws.onclose = () => {
      if (this.done) return;
      const again = () => {
        if (!this.done) this.retryTimer = setTimeout(() => this.connect(), Math.min(8000, 500 * 2 ** this.retry++));
      };
      if (opened) return again();
      void partyStatus(this.code).then((open) => {
        if (open === false) {
          this.error = "That party has closed.";
          this.close();
          this.emit();
        } else again();
      });
    };
  }

  private send(msg: PartyClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private onMessage(msg: PartyServerMessage) {
    switch (msg.t) {
      case "welcome":
        this.memberId = msg.memberId;
        store(partyKey(this.code), msg.token);
        store(PARTY_CURRENT, this.code);
        break;
      case "party": {
        this.party = msg.party;
        const p = msg.party.placed;
        // Placed (a lobby with seats for everyone): join it, once per placing (a reload doesn't join an old one).
        if (msg.party.state === "placed" && p && String(p.at) !== stored(`${partyKey(this.code)}.placed`)) {
          store(`${partyKey(this.code)}.placed`, String(p.at));
          this.close();
          this.onPlaced(p.lobby, p.pass);
        }
        break;
      }
      case "error":
        if (msg.banned) showBanNotice();
        this.error = msg.message;
        if (msg.ended || msg.banned || !this.memberId) this.close();
        break;
      case "closed":
        this.error = "That party has closed.";
        this.close();
        break;
    }
    this.emit();
  }

  queue() {
    this.send({ t: "queue" });
  }
  cancel() {
    this.send({ t: "cancel" });
  }

  /** Leave the party for good (this device forgets it). */
  leave() {
    this.send({ t: "leave" });
    store(partyKey(this.code), null);
    store(`${partyKey(this.code)}.placed`, null);
    if (stored(PARTY_CURRENT) === this.code) store(PARTY_CURRENT, null);
    this.done = true;
    setTimeout(() => this.close(), 150);
  }

  /** Close the socket. (Off to a lobby, the party keeps you as a member: "Back to your party" reconnects.) */
  close() {
    this.done = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try {
      this.ws?.close();
    } catch {
      // Already closed.
    }
  }
}
