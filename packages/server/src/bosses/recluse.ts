/**
 * The Hidden Boss's phase 2 on the lobby server (Eric, Nov 13: "it plays through till the end";
 * docs/decisions/2026-11-13-recluse-online-phase2.md). His adult form beaten online (his room's fight from the town, or the Crowd's
 * boss final), his fall holds the board, then the cutscene's hold (RECLUSE_CUTSCENE.holdMs, `recluseCutscene`), then his phase change
 * for everyone from one start (`phase2`'s `at`), the boards counting down, and the four boards played at once until each is decided
 * (the rules: packages/chess/src/bosses/recluse-phase2.ts, the same as solo's). The server runs every board and clock:
 * - each person plays their own board (`phase2Move`, checked here: theirs, their move, legal);
 * - his moves come from the engine server alone (every legal move scored, `search`: he plays the best; a mate in one always), never a
 *   player's device and never a quick move (Eric, Nov 13: "we can't have him breaking"; docs/decisions/2026-11-13-recluse-server-
 *   only.md). A search that comes back empty is tried again (`retry`: RECLUSE_ONLINE.retryMs, doubling). His move not in after
 *   RECLUSE_ONLINE.pauseMs: every board's clock pauses ("He's thinking…": `paused`), nothing is played, and the clocks run on from where
 *   they stood once it's in (`hold`). Not in after RECLUSE_ONLINE.serverWaitMs: the fight ends with no result (`noResult`: nothing
 *   counts for or against anyone; phase 2's fair-play moves dropped). With no engine server set up at all (local runs, the e2e suite,
 *   staging: no `search`), his move is the server's quick move and phase 2's result unvouched (`unvouched`: it pays as a solo game);
 * - the bots' moves come from the engine server too (one near his best), the host's device where it can't answer (`phase2Ask`, at a
 *   bot's strength), the server's own quick move where that doesn't answer in RECLUSE_ONLINE.askMs (never a stall); a bot's never
 *   unvouches anything (a bot only plays for its own team). The host gone, or back: its open asks go to the host now (`resend`);
 * - fair play: each person's move is scored on the engine server too (when it answers) and kept as a FairMove (no crowd: each
 *   board is its player's alone);
 * - someone who leaves (resigns, or gone longer than LEAVING.awayMs) hands their board to a bot, which plays it on;
 * - the admins' "Win this form" (his room's fight): the team's next move (a person's or a bot's, any board) wins every board still on.
 * Every board decided: his reaction holds the boards (RECLUSE_PHASE2.endMs), then the results (all four won beats him).
 */
import { FAIRPLAY, RECLUSE_CUTSCENE, RECLUSE_ONLINE, RECLUSE_PHASE2, type FairMove } from "@chessroyale/core";
import {
  gameEnd,
  legalMoves,
  phase2Flags,
  phase2Move,
  phase2Numbers,
  phase2Outcome,
  phase2Timeouts,
  phase2ToMove,
  phase2Ult,
  phase2WinAll,
  startPhase2,
  type MoveScore,
  type NetPhase2,
  type Phase2Board,
  type Phase2State,
} from "@chessroyale/chess";
import type { LobbyRecord, Outgoing, Timer } from "../lobby.ts";

/** A move being worked out for a board: his (the engine server's alone), or a bot's (on the engine server or the host's device); its answer once in. */
interface Work {
  id: string;
  fen: string;
  who: "boss" | "bot";
  via: "server" | "device";
  /** When it was asked where it is now (the engine server, or the device; asked again of a new host or a reloaded one: `resend`). */
  at: number;
  device?: string;
  move?: string;
  /** His: when his move was first asked (the pause and the no-result count from it), his tries so far, the latest try's search id. */
  since?: number;
  tries?: number;
  ask?: string;
  /** His: a try came back empty: the next is due then (RECLUSE_ONLINE.retryMs, doubling). */
  retryAt?: number;
}

/** A person's move waiting for the engine server's numbers (fair play). */
interface FairAsk {
  player: string;
  ply: number;
  fen: string;
  move: string;
  thinkMs: number;
  away: number;
  last: string | null;
}

/** Phase 2 as the lobby keeps it (LobbyRecord.recluse2): plain data, stored with the lobby. */
export interface Recluse2Record {
  key: string;
  /** His fall ends and the cutscene's hold begins (`cutAt`); his phase change for everyone (`at`); the clocks (`clocksAt`). */
  cutAt: number;
  at: number;
  clocksAt: number;
  /** Phase 1's last position. */
  from: string;
  state: Phase2State;
  /** Every player's name (people and bots), by id. */
  names: Record<string, string>;
  /** The cutscene and the phase change have been told (at `cutAt`). */
  told?: true;
  /** The clocks have started (at `clocksAt`). */
  playing?: true;
  lastSlow: { board: number; at: number } | null;
  /** Work per board (by board id). */
  work: Record<string, Work>;
  /** A bot's move is played no sooner than this (its thinking), by board id. */
  botAt: Record<string, number>;
  /** People's moves waiting for their fair-play numbers, by search id. */
  fair: Record<string, FairAsk>;
  winNext?: true;
  done?: NonNullable<NetPhase2["done"]>;
  /**
   * Every board's clock paused since then: his move is late (RECLUSE_ONLINE.pauseMs). Nothing is played meanwhile; once it's in, every
   * running clock goes on from where it stood (`hold`).
   */
  paused?: number;
  /** Each player's fair-play moves before phase 2 (how many): a fight with no result keeps those only. */
  fairFrom?: Record<string, number>;
  /**
   * A move of his was the server's quick move: there's no engine server set up here (local runs, the e2e suite, staging). Phase 2's
   * result isn't vouched for (the first reason): its players' results (everyone who played a board: `names`) pay as a solo game's
   * and aren't ranked (phase2Unvouched); the rest of the match (phase 1, its fair play, a Crowd final's watchers) stands.
   */
  unvouched?: string;
  seq: number;
}

/** What phase 2 uses of its lobby (LobbyCore hands it over: its `phase2Lobby`). */
export interface Phase2Lobby {
  readonly r: LobbyRecord;
  now(): number;
  rng(): number;
  /** To everyone, remembered (a reconnect is sent it again). */
  broadcast(msg: Outgoing): void;
  send(id: string, msg: Outgoing, remember?: boolean): void;
  setTimer(kind: Timer, at: number): void;
  /** The device asked when the engine server can't answer (the host), or null. */
  host(): string | null;
  /** A person in the match, not practicing: their moves count for fair play. */
  fairPlayer(id: string): boolean;
  /** A person in the match (else a bot plays the board). */
  person(id: string): boolean;
  /** Someone in the match but `except` is here (connected, or gone less than LEAVING.awayMs): if not, the match ends this event. */
  anyoneHere(except: string): boolean;
  /**
   * The engine server: every legal move of `fen` scored, answered through `searched` (null: it couldn't); `boss`: his move (his own
   * share of the server's day). Missing: no engine server set up here (local runs, the e2e suite, staging).
   */
  search?(req: { id: string; fen: string; boss?: true }): void;
  /** Wakes the engine server (phase 2 is coming: his fall and phase change are its time to boot). Missing: none here. */
  warm?(): void;
  /** Every board decided and shown: the results. */
  finish(): void;
}

const boardOf = (p: Recluse2Record, id: number | string): Phase2Board | undefined => p.state.boards.find((b) => b.id === Number(id));

/**
 * His phase 2 follows his fall: everything timed from now, once (the fall `fallMs`, the cutscene's hold, his phase change, the
 * countdown), the boards set from the battle's seed (`players` in board order: one each). Told to everyone as the fall ends (`step`).
 */
export function begin(lobby: Phase2Lobby, o: { players: readonly { id: string; name: string }[]; from: string; seed: number; win?: boolean; fallMs?: number }): Recluse2Record {
  const now = lobby.now();
  const cutAt = now + (o.fallMs ?? RECLUSE_PHASE2.change.fallMs);
  const at = cutAt + RECLUSE_CUTSCENE.holdMs;
  const clocksAt = at + RECLUSE_ONLINE.changeMs + RECLUSE_PHASE2.change.countdownSeconds * 1000;
  const players = o.players.slice(0, RECLUSE_PHASE2.boards);
  const p: Recluse2Record = {
    key: `p2-${++lobby.r.counter}`,
    cutAt,
    at,
    clocksAt,
    from: o.from,
    // (Every board's clock as of the clocks' start: nobody's runs before it.)
    state: startPhase2({ players: players.map((x) => x.id), numbers: phase2Numbers(o.seed), now: clocksAt, win: o.win }),
    names: Object.fromEntries(players.map((x) => [x.id, x.name])),
    fairFrom: Object.fromEntries(players.map((x) => [x.id, lobby.r.fair?.[x.id]?.length ?? 0])),
    lastSlow: null,
    work: {},
    botAt: {},
    fair: {},
    seq: 0,
  };
  lobby.r.recluse2 = p;
  // (The engine server, asleep after 3 idle minutes, boots during his fall and phase change, before his first search: M2.)
  lobby.warm?.();
  arm(lobby);
  return p;
}

/** Phase 2 as everyone sees it (the `phase2` message). */
export function view(p: Recluse2Record): NetPhase2 {
  return {
    key: p.key,
    cutAt: p.cutAt,
    at: p.at,
    clocksAt: p.clocksAt,
    from: p.from,
    boards: p.state.boards.map((b) => ({
      id: b.id,
      player: b.player,
      name: p.names[b.player] ?? "Bot",
      number: b.number,
      fen: b.board.fen,
      lastMove: b.board.lastMove,
      history: b.board.history,
      bases: b.board.bases ?? [],
      bankMs: b.bankMs,
      turnAt: p.playing ? b.turnAt : null,
      result: b.result,
    })),
    slow: p.state.slow,
    lastSlow: p.lastSlow,
    ultAt: p.state.ultAt,
    ...(p.paused !== undefined ? { paused: p.paused } : {}),
    ...(p.done ? { done: p.done } : {}),
    ...(p.winNext ? { winNext: true as const } : {}),
  };
}

const tell = (lobby: Phase2Lobby, p: Recluse2Record) => lobby.broadcast({ t: "phase2", p2: view(p) });

/**
 * Phase 2's timer: the cutscene and the phase change told as the fall ends; the clocks started; flags and his ultimate's random
 * moves (not while paused); his search tried again, or late (every clock paused), or never in (no result); a bot's device that never
 * answered (the quick move); moves due; the results once every board is decided and shown.
 */
export function step(lobby: Phase2Lobby) {
  const p = lobby.r.recluse2;
  if (!p) return;
  const now = lobby.now();
  if (!p.told && now >= p.cutAt - 50) {
    p.told = true;
    lobby.r.phase = "phase2";
    lobby.broadcast({ t: "recluseCutscene", at: p.cutAt, until: p.at });
    tell(lobby, p);
  }
  if (p.done) {
    if (now >= p.done.until - 50) return lobby.finish();
    return arm(lobby);
  }
  startClocks(lobby, p);
  if (p.playing) {
    if (p.paused === undefined) apply(lobby, p, phase2Timeouts(phase2Flags(p.state, now), now, () => lobby.rng()), "clock");
    for (const w of Object.values(p.work)) {
      if (w.move) continue;
      if (w.who === "boss") {
        // (His move never in: the fight ends with no result. A try come back empty, its wait over, or lost on the way: again.)
        if (w.since !== undefined && now >= w.since + RECLUSE_ONLINE.serverWaitMs) return noResult(lobby, p);
        if (w.retryAt !== undefined ? now >= w.retryAt : now >= w.at + SERVER_LOST_MS) searchHis(lobby, w);
        continue;
      }
      // (A bot's: a device that never answered, or an engine server search lost: the server's own quick move, or the device.)
      if (w.via === "device" && now >= w.at + RECLUSE_ONLINE.askMs) quick(lobby, p, w);
      if (w.via === "server" && now >= w.at + SERVER_LOST_MS) toDevice(lobby, p, w);
    }
    hold(lobby, p);
    playReady(lobby, p);
  }
  arm(lobby);
}

/** The clocks start once it's time (the timer's, or a person's first move a moment ahead of it): the bots' first moves asked. */
function startClocks(lobby: Phase2Lobby, p: Recluse2Record) {
  if (!p.told || p.playing || p.done || lobby.now() < p.clocksAt - 50) return;
  p.playing = true;
  for (const b of p.state.boards) queue(lobby, p, b);
  tell(lobby, p);
}

/**
 * A search on the engine server that never came back (the object restarted under it): a bot's goes to the host's device; his is
 * tried again.
 */
const SERVER_LOST_MS = 20_000;

/** The next time phase 2 needs the timer. */
function arm(lobby: Phase2Lobby) {
  const p = lobby.r.recluse2;
  if (!p) return;
  const times: number[] = [];
  if (!p.told) times.push(p.cutAt);
  else if (p.done) times.push(p.done.until);
  else if (!p.playing) times.push(p.clocksAt);
  else {
    const ult = p.state.ultAt !== null;
    // (Paused: no clock runs out meanwhile; their times are moved on by the pause as it ends.)
    for (const b of p.paused === undefined ? p.state.boards : []) {
      if (b.result || b.turnAt === null || phase2ToMove(b) !== "crowd") continue;
      times.push(b.turnAt + (ult ? RECLUSE_PHASE2.ultMoveSeconds * 1000 : b.bankMs));
    }
    for (const [id, w] of Object.entries(p.work)) {
      // (A move in: played when due, but never while paused: nothing is played then, and it's played as the pause ends.)
      if (w.move) {
        if (p.paused === undefined) times.push(w.who === "bot" ? (p.botAt[id] ?? 0) : lobby.now());
      } else if (w.who === "boss" && w.since !== undefined) {
        times.push(w.retryAt ?? w.at + SERVER_LOST_MS, w.since + RECLUSE_ONLINE.serverWaitMs);
        if (p.paused === undefined) times.push(w.since + RECLUSE_ONLINE.pauseMs);
      } else times.push(w.at + (w.via === "device" ? RECLUSE_ONLINE.askMs : SERVER_LOST_MS));
    }
  }
  if (times.length) lobby.setTimer("phase2", Math.max(lobby.now(), Math.min(...times)));
}

/**
 * The state moves on (a move, a flag, a timeout, the admins' win): the last slow move noted, work for positions gone dropped, his
 * next moves and the bots' asked, every board decided noted (`done`), and everyone told. Nothing changed: nothing happens.
 */
function apply(lobby: Phase2Lobby, p: Recluse2Record, next: Phase2State, _why: string): boolean {
  const before = p.state;
  if (next === before) return false;
  const now = lobby.now();
  if (next.slow > before.slow) {
    const on = next.boards.find((b, i) => b.board.history.length > before.boards[i]!.board.history.length);
    if (on) p.lastSlow = { board: on.id, at: now };
  }
  p.state = next;
  for (const [id, w] of Object.entries(p.work)) {
    const b = boardOf(p, id);
    if (!b || b.result || b.board.fen !== w.fen) delete p.work[id];
  }
  const o = phase2Outcome(next);
  if (o.decided && !p.done) {
    p.done = { at: now, until: now + RECLUSE_PHASE2.endMs, beaten: o.beaten, won: o.won, of: o.of };
    p.work = {};
    p.winNext = undefined;
  } else if (p.playing) for (const b of next.boards) queue(lobby, p, b);
  tell(lobby, p);
  return true;
}

/**
 * A board where it's his move, or a bot's: its move asked (unless it already is). His: of the engine server alone (with none set up
 * here, the quick move). A bot's: of the engine server, else the host's device.
 */
function queue(lobby: Phase2Lobby, p: Recluse2Record, b: Phase2Board) {
  const who = phase2ToMove(b);
  if (!who || p.work[b.id]) return;
  if (who === "crowd") {
    if (lobby.person(b.player)) return;
    // (A bot thinks a bullet player's while, now and then longer before his ultimate, so his slow-move count comes from them too.)
    const slow = p.state.ultAt === null && lobby.rng() < RECLUSE_PHASE2.botSlowChance;
    const [lo, hi] = slow ? RECLUSE_PHASE2.botSlowMs : RECLUSE_PHASE2.botMoveMs;
    p.botAt[b.id] = lobby.now() + lo + lobby.rng() * (hi - lo);
  }
  const w: Work = { id: `w${++p.seq}`, fen: b.board.fen, who: who === "boss" ? "boss" : "bot", via: "server", at: lobby.now() };
  p.work[b.id] = w;
  if (w.who === "boss") {
    if (!lobby.search) return quick(lobby, p, w);
    w.since = w.at;
    return searchHis(lobby, w);
  }
  if (lobby.search) lobby.search({ id: w.id, fen: w.fen });
  else toDevice(lobby, p, w);
}

/** His move asked of the engine server (again): a try of its own (`ask`, its search id), from his own share of the server's day. */
function searchHis(lobby: Phase2Lobby, w: Work) {
  w.tries = (w.tries ?? 0) + 1;
  w.at = lobby.now();
  w.retryAt = undefined;
  w.ask = `${w.id}.${w.tries}`;
  lobby.search!({ id: w.ask, fen: w.fen, boss: true });
}

/** A bot's move the engine server can't: the host's device plays it (its engine at a bot's strength), or with no host, the quick move. */
function toDevice(lobby: Phase2Lobby, p: Recluse2Record, w: Work) {
  const host = lobby.host();
  w.via = "device";
  w.at = lobby.now();
  if (!host) return quick(lobby, p, w);
  ask(lobby, host, w);
}

/** A bot's move asked of a device (the host), at a bot's strength. (Never his: no device plays his moves.) */
function ask(lobby: Phase2Lobby, host: string, w: Work) {
  w.device = host;
  lobby.send(host, { t: "phase2Ask", id: w.id, fen: w.fen, elo: RECLUSE_PHASE2.botElo, nodes: RECLUSE_PHASE2.botNodes, moveMs: RECLUSE_PHASE2.botMoveMs[1] }, false);
}

/**
 * The server's own quick move: a bot's when neither the engine server nor a device answered; his only where there's no engine server
 * set up at all (then phase 2's result is unvouched).
 */
function quick(lobby: Phase2Lobby, p: Recluse2Record, w: Work) {
  w.move = quickMove(w.fen);
  if (w.who === "boss") unvouch(lobby, p, "his move was the server's quick move (no engine server here)");
}

/**
 * Every board's clock pauses while a move of his is late (asked RECLUSE_ONLINE.pauseMs ago, not in): told to everyone ("He's
 * thinking…"). Once none is, every running clock goes on from where it stood (its turn's start, and a bot's thinking, moved on by the
 * pause), and the moves held are played (playReady). Nothing is played, flagged or timed out meanwhile.
 */
function hold(lobby: Phase2Lobby, p: Recluse2Record) {
  if (!p.playing || p.done) return;
  const now = lobby.now();
  const late = Object.values(p.work).some((w) => w.who === "boss" && !w.move && w.since !== undefined && now >= w.since + RECLUSE_ONLINE.pauseMs);
  if (late && p.paused === undefined) {
    p.paused = now;
    console.log(`lobby ${lobby.r.code}: the Hidden Boss's move is late: every clock paused`);
    tell(lobby, p);
  } else if (!late && p.paused !== undefined) {
    const by = now - p.paused;
    p.paused = undefined;
    p.state = { ...p.state, boards: p.state.boards.map((b) => (b.turnAt === null ? b : { ...b, turnAt: b.turnAt + by })) };
    for (const id of Object.keys(p.botAt)) p.botAt[id] = p.botAt[id]! + by;
    console.log(`lobby ${lobby.r.code}: the Hidden Boss's move is in after a ${by} ms pause: the clocks run on`);
    tell(lobby, p);
  }
}

/**
 * His move never came (RECLUSE_ONLINE.serverWaitMs): the fight ends with no result, "the Hidden Boss couldn't connect". Every board as
 * it stands, the clocks stopped; then the results, where nothing counts for or against anyone (no XP, rank or result rows: lobby.ts
 * humanResults). Phase 2's fair-play moves are dropped (each player's from before it, `fairFrom`, stay).
 */
function noResult(lobby: Phase2Lobby, p: Recluse2Record) {
  const now = lobby.now();
  const o = phase2Outcome(p.state);
  p.done = { at: now, until: now + RECLUSE_PHASE2.endMs, beaten: false, won: o.won, of: o.of, noResult: true };
  p.paused ??= now;
  p.work = {};
  p.winNext = undefined;
  const fair = lobby.r.fair;
  if (fair) {
    for (const [id, n] of Object.entries(p.fairFrom ?? {})) if (fair[id] && fair[id]!.length > n) fair[id] = fair[id]!.slice(0, n);
    lobby.r.fairV = (lobby.r.fairV ?? 0) + 1;
  }
  console.log(`lobby ${lobby.r.code}: the Hidden Boss's move never came from the engine server: no result`);
  tell(lobby, p);
  arm(lobby);
}

/** A move of his was the quick move (no engine server here): phase 2's result isn't vouched for (noted once, the first why). */
function unvouch(lobby: Phase2Lobby, p: Recluse2Record, why: string) {
  if (p.unvouched) return;
  p.unvouched = why;
  console.log(`lobby ${lobby.r.code}: the Hidden Boss's phase 2 unvouched (${why}): its players' results pay as a solo game's`);
}

/**
 * The host changed (a disconnect, a leave), or a device is back (`back`: a reload, resendTo): every bot's move still asked of a device
 * goes to the host now, asked again with a fresh RECLUSE_ONLINE.askMs (as resendHostWork re-asks the boss's move), so an honest host's
 * reload, or a new host, plays it rather than the quick move (the review of #677, M1). A move asked of the host now, who isn't the one
 * back: nothing (it's on its way). No host here: it waits, and the quick move comes when its time is up.
 */
export function resend(lobby: Phase2Lobby, back?: string) {
  const p = lobby.r.recluse2;
  if (!p || !p.playing || p.done || lobby.r.phase !== "phase2") return;
  const host = lobby.host();
  if (!host) return;
  for (const w of Object.values(p.work)) {
    if (w.move || w.via !== "device" || (w.device === host && host !== back)) continue;
    w.at = lobby.now();
    ask(lobby, host, w);
  }
  arm(lobby);
}

/**
 * Moves worked out and due: his at once, a bot's once it has thought its while; none while paused. The team's under the admins' win
 * wins it all.
 */
function playReady(lobby: Phase2Lobby, p: Recluse2Record) {
  for (let guard = 0; guard < 16 && p.paused === undefined; guard++) {
    const now = lobby.now();
    const due = Object.entries(p.work).find(([id, w]) => w.move && (w.who === "boss" || now >= (p.botAt[id] ?? 0)));
    if (!due) return;
    const [id, w] = due;
    delete p.work[id];
    const b = boardOf(p, id);
    if (!b || b.result || b.board.fen !== w.fen) continue;
    const moved = apply(lobby, p, phase2Move(p.state, b.id, w.move!, now), w.who);
    if (moved && w.who === "bot") winIfArmed(lobby, p);
  }
}

/** The admins' "Win this form" armed: this team move wins every board still on. */
function winIfArmed(lobby: Phase2Lobby, p: Recluse2Record) {
  if (!p.winNext || p.done) return;
  p.winNext = undefined;
  apply(lobby, p, phase2WinAll(p.state, lobby.now()), "win");
}

/**
 * A person's move on their board: theirs, their move, legal, the clocks running and not paused (out of time, phase2Move loses the
 * board instead). Its fair-play numbers are asked of the engine server.
 */
export function move(lobby: Phase2Lobby, playerId: string, key: unknown, boardId: unknown, mv: unknown, away: unknown, ply: unknown) {
  const p = lobby.r.recluse2;
  if (!p || key !== p.key) return;
  startClocks(lobby, p);
  const b = boardOf(p, typeof boardId === "number" ? boardId : -1);
  // (Refused: they're told phase 2 as it stands (`refused`: their app drops the move it showed ahead). Not remembered: what a reconnect
  // gets is the last told to everyone, as it stands, with the battle and the standings.)
  const refuse = () => lobby.send(playerId, { t: "phase2", p2: view(p), refused: true }, false);
  // (`ply`: the board's move count it was made on, so a move made on a position gone (a second drag in a moment the screen showed an
  // old state) is refused, never played as the next one: the review of #677, m2.)
  if (!p.playing || p.done || p.paused !== undefined || typeof mv !== "string" || mv.length > 8 || !b || b.player !== playerId || ply !== b.board.history.length || phase2ToMove(b) !== "crowd" || !legalMoves(b.board.fen).includes(mv)) return refuse();
  const now = lobby.now();
  const before = b;
  if (!apply(lobby, p, phase2Move(p.state, b.id, mv, now), "person")) return refuse();
  const after = boardOf(p, b.id)!;
  // (Not in a test fight (the admins' 🏆 or ultimate trigger): no fair-play rows, no engine budget spent on them. The review's m4.)
  if (lobby.search && lobby.fairPlayer(playerId) && !lobby.r.overrides?.tested && after.board.history.length > before.board.history.length) {
    const id = `f${++p.seq}`;
    const looks = typeof away === "number" && Number.isInteger(away) && away >= 0 ? Math.min(away, 1000) : 0;
    p.fair[id] = { player: playerId, ply: before.board.history.length, fen: before.board.fen, move: mv, thinkMs: Math.max(0, now - (before.turnAt ?? now)), away: looks, last: before.board.lastMove };
    lobby.search({ id, fen: before.board.fen });
  }
  winIfArmed(lobby, p);
  arm(lobby);
}

/**
 * The engine server's answer for a search (every legal move scored, or null: it couldn't): his move (the best; a mate in one always)
 * or a bot's (one near it), played when due; for a person's move, its fair-play numbers. Null for a bot's move: the host's device is
 * asked instead. Null for his: tried again after a wait (RECLUSE_ONLINE.retryMs, doubling to retryMaxMs); an earlier try's null, with
 * a later one on its way: nothing. Any try's answer plays (the same position).
 */
export function searched(lobby: Phase2Lobby, id: string, scores: readonly MoveScore[] | null) {
  const p = lobby.r.recluse2;
  if (!p) return;
  const f = p.fair[id];
  if (f) {
    delete p.fair[id];
    if (scores?.length) noteFair(lobby, f, scores);
    return;
  }
  const w = Object.values(p.work).find((x) => x.via === "server" && !x.move && (x.id === id || id.startsWith(`${x.id}.`)));
  if (!w) return;
  const legal = new Set(legalMoves(w.fen));
  const ok = (scores ?? []).filter((s) => legal.has(s.move) && Number.isFinite(s.expected));
  if (ok.length) w.move = pick(withMates(w.fen, ok), w.who, () => lobby.rng());
  else if (w.who === "bot") toDevice(lobby, p, w);
  else if (id === w.ask) w.retryAt = lobby.now() + Math.min(RECLUSE_ONLINE.retryMaxMs, RECLUSE_ONLINE.retryMs * 2 ** ((w.tries ?? 1) - 1));
  hold(lobby, p);
  playReady(lobby, p);
  arm(lobby);
}

/**
 * The engine server's numbers with every mate in one marked (`mate: 1`, by the rules: the engine server never says `mate`), so pick()
 * plays it, his or a bot's (the delta review of #677).
 */
export function withMates(fen: string, scores: readonly MoveScore[]): MoveScore[] {
  return scores.map((s) => (gameEnd(fen, [s.move]) === "checkmate" ? { ...s, mate: 1 } : s));
}

/**
 * The host's answer to a phase2Ask (a bot's move: his are never asked of a device): its move, if legal there and still wanted. A bot's
 * move from a device unvouches nothing (a bot only plays for its own team; the review of #677, M2).
 */
export function answer(lobby: Phase2Lobby, playerId: string, id: unknown, mv: unknown) {
  const p = lobby.r.recluse2;
  if (!p || typeof id !== "string" || typeof mv !== "string") return;
  const w = Object.values(p.work).find((x) => x.id === id && x.who === "bot" && x.via === "device" && x.device === playerId && !x.move);
  if (!w || !legalMoves(w.fen).includes(mv)) return;
  w.move = mv;
  playReady(lobby, p);
  arm(lobby);
}

/** Testing (the admins' "Win this form", his room's fight): the team's next move wins every board still on. */
export function winForm(lobby: Phase2Lobby): boolean {
  const p = lobby.r.recluse2;
  if (!p || p.done) return false;
  if (!p.winNext) {
    p.winNext = true;
    tell(lobby, p);
  }
  return true;
}

/** Testing (the admins' ultimate trigger, as solo's): his phase 2 ultimate now, once the clocks run (not while they're paused). */
export function ult(lobby: Phase2Lobby): boolean {
  const p = lobby.r.recluse2;
  if (!p || !p.playing || p.done || p.paused !== undefined || p.state.ultAt !== null) return false;
  apply(lobby, p, phase2Ult(p.state, lobby.now()), "ult");
  arm(lobby);
  return true;
}

/** Someone left: their board is a bot's from now on (it plays on), under `bot`'s id and name. */
export function handOver(lobby: Phase2Lobby, from: string, bot: { id: string; name: string }): boolean {
  const p = lobby.r.recluse2;
  if (!p || !p.state.boards.some((b) => b.player === from)) return false;
  p.names[bot.id] = bot.name;
  p.state = { ...p.state, boards: p.state.boards.map((b) => (b.player === from ? { ...b, player: bot.id } : b)) };
  // (Not when nobody else is here: the match ends in this same event (wrapUpIfEmpty), and its search would be thrown away. m5.)
  if (!p.done && p.playing && lobby.anyoneHere(from)) for (const b of p.state.boards) if (b.player === bot.id) queue(lobby, p, b);
  tell(lobby, p);
  arm(lobby);
  return true;
}

/**
 * Whether `id`'s result rests on a phase 2 that isn't vouched for (Recluse2Record.unvouched: his quick move, with no engine server set
 * up): they played one of its boards (a person who left it too). Their result pays as a solo game's (lobby-do.ts lobbyXpGame) and isn't
 * ranked; nobody else's changes.
 */
export function phase2Unvouched(r: Pick<LobbyRecord, "recluse2">, id: string): boolean {
  const p = r.recluse2;
  return !!p?.unvouched && Object.hasOwn(p.names, id);
}

/** Whether phase 2 ended with no result (his move never came from the engine server): nothing counts for or against anyone. */
export function phase2NoResult(r: Pick<LobbyRecord, "recluse2">): boolean {
  return !!r.recluse2?.done?.noResult;
}

/** Whether `id` plays a board of phase 2 (still on). */
export function onBoard(r: LobbyRecord, id: string): boolean {
  const p = r.recluse2;
  return !!p && !p.done && p.state.boards.some((b) => b.player === id);
}

/**
 * His move: the best scored (the first of equals). A bot's: one of those within RECLUSE_ONLINE.botLoss of it, at random. A mate scored
 * (`mate` > 0): the quickest, his or a bot's (in a won position every move scores near 1, and a draw doesn't win a board).
 */
export function pick(scores: readonly MoveScore[], who: "boss" | "bot", rng: () => number): string {
  const mates = scores.filter((s) => (s.mate ?? 0) > 0);
  if (mates.length) return mates.reduce((a, b) => (b.mate! < a.mate! ? b : a)).move;
  const best = scores.reduce((a, b) => (b.expected > a.expected ? b : a));
  if (who === "boss") return best.move;
  const near = scores.filter((s) => s.expected >= best.expected - RECLUSE_ONLINE.botLoss);
  return near[Math.min(near.length - 1, Math.floor(rng() * near.length))]!.move;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * The server's own quick move, with no engine at all (neither the engine server nor a device answered): the capture of the most
 * valuable piece, else the first legal move. Weak, but never a stall.
 */
export function quickMove(fen: string): string {
  const legal = legalMoves(fen);
  const at = new Map<string, string>();
  fen
    .split(" ")[0]!
    .split("/")
    .forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch);
        else at.set(`${"abcdefgh"[f++]}${8 - r}`, ch);
      }
    });
  const mover = fen.split(" ")[1] === "b" ? "b" : "w";
  const gain = (m: string) => {
    const t = at.get(m.slice(2, 4));
    // (Chess960 castling is written as the king taking its own rook: no gain.)
    return t && (t === t.toUpperCase() ? "w" : "b") !== mover ? (VALUE[t.toLowerCase()] ?? 0) : 0;
  };
  return legal.reduce((a, b) => (gain(b) > gain(a) ? b : a), legal[0]!);
}

/** A person's move with the engine server's numbers for its position: a FairMove (no crowd: the board is theirs alone). */
function noteFair(lobby: Phase2Lobby, f: FairAsk, scores: readonly MoveScore[]) {
  const legal = new Set(legalMoves(f.fen));
  const sorted = scores.filter((s) => legal.has(s.move) && Number.isFinite(s.expected)).sort((a, b) => b.expected - a.expected);
  const best = sorted[0];
  const mine = sorted.find((s) => s.move === f.move);
  if (!best || !mine) return;
  const loss = (s: MoveScore) => Math.max(0, (best.expected - s.expected) * 100);
  const sig = FAIRPLAY.signals;
  const fair: FairMove = {
    ply: f.ply,
    fen: f.fen,
    move: f.move,
    best: best.move,
    loss: Math.round(loss(mine) * 100) / 100,
    bestExp: Math.round(best.expected * 1000) / 1000,
    near: sorted.filter((s) => loss(s) <= sig.nearPoints).length,
    gap: sorted.length > 1 ? Math.round(loss(sorted[1]!) * 100) / 100 : null,
    crowd: 0,
    crowdFound: 0,
    thinkMs: f.thinkMs,
    away: f.away,
    legal: legal.size,
    top: sorted.slice(0, FAIRPLAY.deep.candidates).map((s) => s.move),
    ...(f.last && best.move.slice(2, 4) === f.last.slice(2, 4) ? { recapture: true } : {}),
  };
  const r = lobby.r;
  ((r.fair ??= {})[f.player] ??= []).push(fair);
  r.fairV = (r.fairV ?? 0) + 1;
}

export const recluseLobby = { begin, step, move, searched, answer, resend, winForm, ult, handOver, onBoard, view };
