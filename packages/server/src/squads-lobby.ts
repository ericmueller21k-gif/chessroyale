import { DEFAULT_SETTINGS, FRONT_DOOR, LOBBY_LIFE, SQUADS, SQUADS_LOBBY, botVotes, castPregameVote, cleanLook, closePregameVote, shuffle, type ItemLook, type MercItem, type SquadsClock, type SquadsSettings } from "@chessroyale/core";
import { botRoster, type LobbyCloseReason, type MoveScore, type Opening } from "@chessroyale/chess";
import { Chess } from "chess.js";
import {
  NO_INPUTS,
  NO_ITEMS,
  ROUND_FORMAT,
  SQUADS_PROTOCOL,
  applyKits,
  armageddonChooser,
  armageddonStart,
  blockBankNow,
  blocksOn,
  botArmageddonColour,
  botBlock,
  botModeVotes,
  botPairPick,
  botRelayMove,
  botShop,
  botSkillOf,
  botUsesStockfish,
  botVotePick,
  buyItem,
  candidatesFrom,
  catchUpCoins,
  choose,
  createSquadsMatch,
  coin,
  drawBracket,
  dutyOf,
  earn,
  endByMaterial,
  formSquads,
  halfDuties,
  halfReady,
  heldVotes,
  isBrilliant,
  brilliantPay,
  isMercItem,
  isOnlyMove,
  judgeTokenUse,
  lockIn,
  modeOf,
  movesAllowed,
  newWallet,
  noteActions,
  otherSide,
  placeBlock,
  placedAssists,
  placedBlocks,
  placements,
  planLobby,
  planMatch,
  playsAsBot,
  reportWinner,
  resolveHalf,
  rulesFromVotes,
  settleTokenUse,
  squadBotSkill,
  squadBotThinkMs,
  squadsLegalMoves,
  squadsRng,
  startArmageddon,
  stockfishNow,
  chipsNow,
  chipsOn,
  dutyDeadline,
  liveCutoff,
  useChip,
  botChipTap,
  returnChips,
  takeCart,
  matchClocks,
  settleTeamClocks,
  startTeamClocks,
  teamClocks,
  tokensLeft,
  topAllowed,
  unbuyItem,
  upgradeMatch,
  upgradeWallet,
  upgradeClock,
  upgradeRules,
  clockById,
  useStockfish,
  visibleChoices,
  votable,
  winnerSquad,
  type Bracket,
  type BrilliantCandidate,
  type CoinWhy,
  type Colour,
  type Duty,
  type HalfInputs,
  type PlacedChip,
  type ItemCounts,
  type NetBracketMatch,
  type NetDuty,
  type NetSquadsHalf,
  type NetSquadsLobby,
  type NetSquadsMatch,
  type NetSquadsVote,
  type NetTeamClock,
  type NetWallet,
  type Party,
  type Side,
  type Squad,
  type SquadPlayer,
  type SquadsClientMessage,
  type SquadsEntrant,
  type SquadsEvent,
  type SquadsMatch,
  type SquadsMode,
  type SquadsPlacement,
  type SquadsPlan,
  type SquadsRound,
  type SquadsRules,
  type SquadsServerMessage,
  type SquadsVoteId,
  type Wallet,
} from "@chessroyale/chess/squads";
import { cleanTop, distanceFromVerdict, fallbackTop, topsAgree, verdictMovesOf } from "./squads-bots.ts";

/**
 * One Squads lobby's logic, independent of Cloudflare (docs/areas/squads.md, "The server"): seats and parties, the
 * fill (bots in every empty seat, teammates included), the pre-game votes, the bracket, every match's halves in real
 * time (clocks, deadlines, bots, the reveal), Armageddon for a drawn final, spectating, leaving, placements and
 * rewards, and the test controls. The rules are phase 1's (`@chessroyale/chess/squads`): this file only runs them.
 * The Durable Object (squads-do.ts) stores `record` and the matches between events and calls `alarm()` at `nextAlarm`.
 *
 * Bots' engine work goes to players' devices (Eric's computing priorities), two per job, compared; the engine server
 * settles two that disagree; with no device, a bot plays from the server's own quick look (squads-bots.ts). The same
 * jobs judge Pairs' same-move tokens (the judge's top moves for the position; no device, no refund) and, in Mercenary,
 * brilliant moves.
 *
 * Mercenary (the Mode vote; DECISIONS.md, "Squads modes: Mercenary"): every squad has a wallet (`wallets`), earned by
 * the rules' "coins" events, brilliant moves and catch-up; its shop is open from the end of its match until its next
 * match's first half (the wait that's there anyway), and what it bought comes into that match as its kit.
 */

export type SquadsOutgoing = SquadsServerMessage extends infer M ? (M extends { now: number } ? Omit<M, "now"> : never) : never;

/** A deep search the lobby asks of the engine server: two devices disagreed about a bot's top moves. */
export interface SquadsServerRequest {
  id: string;
  fen: string;
  moves: string[];
  nodes: number;
}

export interface SquadsIO {
  now(): number;
  send(playerId: string, msg: SquadsOutgoing): void;
  /** The engine server can be asked (a verdict when two devices disagree); its answer comes back through serverAnswered. */
  serverEngine?: boolean;
  serverTop?(req: SquadsServerRequest): void;
  /** A player left: close their sockets. */
  close?(playerId: string): void;
}

export interface SquadsHuman {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  device: "phone" | "computer";
  /** Their party in this lobby (people who came alone have one of their own: "s:<id>"). */
  partyId: string;
  joinedAt: number;
  goneAt?: number;
  /** They left (see "leave"). */
  left?: true;
  look?: ItemLook;
  /** May use the test controls (an admin, or SQUADS_TEST where it's on). */
  test?: true;
}

/** A party's seats here: its pass (from the party's own object), how many seats it holds, who has taken them. */
export interface SquadsPartySeats {
  pass: string;
  size: number;
  members: string[];
}

export interface SquadsVoteRecord {
  index: number;
  key: string;
  startsAt: number;
  until: number;
  votes: Record<string, { option: number; at: number; joined?: true }>;
  bots: { id: string; option: number; at: number }[];
  result: number | null;
  nextAt?: number;
}

/** One bot-work job: a board's position, the devices asked and their answers, and the top moves once settled. */
export interface WorkJob {
  id: string;
  fen: string;
  devices: string[];
  sentAt: number;
  answers: Record<string, MoveScore[] | null>;
  firstAt?: number;
  /** Two answers disagreed: the engine server asked (or unable), or a third device asked to referee. */
  server?: "asked" | "failed";
  referee?: string;
  refereeAt?: number;
  top?: MoveScore[];
  how?: "agreed" | "one" | "server" | "referee" | "cached" | "fallback";
  /** Waiting for a device with room (every one holds its most unanswered jobs): given out as one answers. */
  queued?: true;
  /** Another job is already working on this position (e.g. every board from the same start): this one takes its answer. */
  follows?: string;
}

/**
 * The judge's work on a same-move token (`index` in the match's tokenLog): a bot-work job for the position it was
 * played in, and when its verdict may be shown (after the pair's reveal).
 */
export interface JudgeJob extends WorkJob {
  index: number;
  notBefore: number;
  /** Mercenary: a move that may be brilliant (not a token): judged the same way, coins if it was. */
  brilliant?: BrilliantCandidate;
}

/** The half being played in a match. */
export interface HalfRecord {
  seq: number;
  startedAt: number;
  inputs: HalfInputs;
  /** Each player's thinking time up to their last choice (ms). */
  at: Record<string, number>;
  /** Bots still to act, and when (ms after the half began). */
  bots: Record<string, number>;
  /** Mercenary: a squad of bots' Time chip taps still to come, by bot, and when (ms after the half began). */
  botChips?: Record<string, number>;
  /** Bot work, by board. */
  work: Record<number, WorkJob>;
}

export interface LiveMatch {
  key: string;
  round: SquadsRound;
  index: number;
  m: SquadsMatch;
  state: "break" | "half" | "show" | "armageddon" | "over";
  /** break: the first half begins then; show: the next half. */
  startsAt: number | null;
  /** Halves begun so far (the half being played is number seq - 1... named by `half.seq`). */
  seq: number;
  half: HalfRecord | null;
  /** A drawn final, kept while its Armageddon is played. */
  drawn?: SquadsMatch;
  arm?: { chooser: Side; until: number; colour: Colour | null };
  /** Same-move tokens waiting for the judge, by their index in the match's tokenLog (a finished match's too). */
  judge?: Record<number, JudgeJob>;
  /** Mercenary: moves waiting for the judge to say if they were brilliant, by number (`brilliantSeq` counts them). */
  brilliant?: Record<number, JudgeJob>;
  brilliantSeq?: number;
  /** Mercenary: brilliant moves paid to each side in this match (Armageddon's with its final), up to the cap. */
  brilliantPaid?: [number, number];
}

/** A reward to write: a results row (when `recorded`) and coins and crates, for one person. */
export interface SquadsReward {
  playerId: string;
  userId: string | null;
  squadId: number;
  placement: SquadsPlacement;
  coins: number;
  crates: number;
  recorded: boolean;
}

export type SquadsTimer = "fill" | "begin" | "voteEnd" | "voteNext" | "bracket";

export interface SquadsRecord {
  v: 1;
  code: string;
  createdAt: number;
  /** Every random draw in the lobby comes from this (squadsRng), so any decision can be replayed. */
  seed: number;
  phase: NetSquadsLobby["phase"];
  humans: SquadsHuman[];
  /** Parties with seats here, by id (solo players are parties of one with no pass). */
  parties: Record<string, SquadsPartySeats>;
  /** Solo seats promised to players on their way (when each promise runs out). */
  solos: number[];
  counter: number;
  fillAt: number | null;
  filledAt: number | null;
  /** Matchmade (the queue), not a test lobby. */
  auto: boolean;
  bots: SquadsEntrant[];
  squads: Squad[];
  vote: SquadsVoteRecord | null;
  voteResults: Partial<Record<SquadsVoteId, number>>;
  rules: SquadsRules | null;
  plan: SquadsPlan | null;
  bracket: Bracket | null;
  /** Matches created so far (stored apart, one key each). */
  matchKeys: string[];
  timer: { kind: SquadsTimer; at: number } | null;
  /** Signed-in people's accounts, by player id (results and rewards go there). */
  accounts: Record<string, string>;
  /** Devices that can take bot work: speed (nodes/s), strikes for wrong answers, jobs given. */
  devices: Record<string, { nps: number; strikes: number; jobs: number }>;
  /** Squads whose placement is decided (and rewarded). */
  placed: Record<number, SquadsPlacement>;
  /** Rewards for the Durable Object to write (it empties this). */
  rewardQueue: SquadsReward[];
  /**
   * A test lobby: where it starts, its own clock, the position its first round's boards start from (`fen`), its bots
   * all at the strongest skill (`strong`), and its opener playing White on their first board (`white`): so a test can
   * count on what happens.
   */
  test?: { start: SquadsRound; clock?: SquadsClock; fen?: string; strong?: boolean; white?: boolean; mode?: SquadsMode; blocks?: boolean };
  /** Mercenary: every squad's wallet, by squad id (empty in Classic). */
  wallets?: Wallet[];
  /** Mercenary: when each bot-run squad does its shopping (squad id → server time), while its shop is open. */
  botShop?: Record<number, number>;
  /** A test control was used here: nothing more is recorded or rewarded. */
  testUsed?: boolean;
  /** The last time a person did anything here (when an idle or abandoned lobby closes). */
  activeAt: number;
  endedAt?: number;
  /** How long its results stay up, if not LOBBY_LIFE's (tests). */
  keepMs?: number;
}

export function newSquadsRecord(code: string, now: number, seed: number, opts: { auto?: boolean; fillAt?: number | null; test?: SquadsRecord["test"]; keepMs?: number } = {}): SquadsRecord {
  return {
    v: 1,
    code,
    createdAt: now,
    seed: seed >>> 0,
    phase: "waiting",
    humans: [],
    parties: {},
    solos: [],
    counter: 0,
    fillAt: opts.fillAt ?? null,
    filledAt: null,
    auto: !!opts.auto,
    bots: [],
    squads: [],
    vote: null,
    voteResults: {},
    rules: null,
    plan: null,
    bracket: null,
    matchKeys: [],
    timer: opts.fillAt != null ? { kind: "fill", at: opts.fillAt } : null,
    accounts: {},
    devices: {},
    placed: {},
    rewardQueue: [],
    ...(opts.test ? { test: opts.test } : {}),
    activeAt: now,
    ...(opts.keepMs ? { keepMs: opts.keepMs } : {}),
  };
}

/**
 * When a Squads lobby closes and why (null: not while its bracket is being played with someone connected), as Crowd's
 * lobbies do (LOBBY_LIFE): its results kept up, a lobby that never filled left idle, or a bracket nobody has been
 * connected to for hours (a safety cap: left to itself, a bracket reaches its results in under an hour).
 */
export function squadsClosing(r: SquadsRecord, connected: boolean, life = LOBBY_LIFE): { at: number; reason: LobbyCloseReason } | null {
  const min = 60_000;
  if (r.phase === "results") return { at: (r.endedAt ?? 0) + (r.keepMs ?? life.lobbyResultsKeepMinutes * min), reason: "ended" };
  if (r.phase === "waiting") return { at: r.activeAt + life.lobbyIdleMinutes * min, reason: "idle" };
  if (connected) return null;
  return { at: r.activeAt + life.lobbyAbandonedMinutes * min, reason: "abandoned" };
}

/** Whether these parties (their sizes) can all be placed in one lobby's squads (formSquads keeps parties whole). */
export function partiesFit(sizes: readonly number[], s: SquadsSettings = SQUADS): boolean {
  if (sizes.some((n) => n < 1 || n > s.partyMax)) return false;
  if (sizes.reduce((a, b) => a + b, 0) > s.squadCount * s.squadSize) return false;
  const parties: Party[] = sizes.map((n, i) => ({ id: `x${i}`, members: Array.from({ length: n }, (_, j) => ({ id: `x${i}-${j}`, name: "", isBot: false, skill: null })) }));
  const bots = Array.from({ length: s.squadCount * s.squadSize }, (_, i) => ({ id: `b${i}`, name: "", isBot: true, skill: 1 }));
  return formSquads(parties, bots, () => 0.5, s).waiting.length === 0;
}

/**
 * A test lobby's team clock (?clock=). A Clock option by its id: bullet, blitz or rapid (the old fast, normal and long
 * map to them; an id we don't know gets the default, Blitz). Or its own numbers in seconds, "bank,top-up,free,increment"
 * and optionally the cap on a move, e.g. "120,30,3,1,10"; without a cap, the one ceiling every clock had before the
 * time controls (`legacyCapSeconds`), so an older test link keeps its meaning. Null if it's neither.
 */
export function parseTestClock(text: string | null, s: SquadsSettings = SQUADS): SquadsClock | null {
  const t = text?.trim() ?? "";
  if (/^[a-z]{1,16}$/i.test(t)) return clockById(t, s);
  const m = t.match(/^(\d{1,4}),(\d{1,4}),(\d{1,3}),(\d{1,3})(?:,(\d{1,3}))?$/);
  if (!m) return null;
  const [bank, topUp, delay, inc] = m.slice(1, 5).map(Number) as [number, number, number, number];
  const cap = m[5] === undefined ? s.legacyCapSeconds : Number(m[5]);
  if (bank < 1 || delay < 1 || cap < 1) return null;
  return { id: "test", label: "Test", bankSeconds: bank, topUpSeconds: topUp, delaySeconds: delay, incrementSeconds: inc, capSeconds: cap };
}

/** May this person open a test lobby: the test controls' switch is on, and an admin (or SQUADS_TEST is "1" here). */
export function squadsTestAllowed(squadsTest: string | undefined, admin: boolean): boolean {
  return SQUADS_LOBBY.testControls && (squadsTest === "1" || admin);
}

/** A test lobby's starting position (?fen=): a legal position, White to move, with moves to play; else null. */
export function parseTestFen(text: string | null): string | null {
  const fen = text?.trim();
  if (!fen || fen.length > 100) return null;
  try {
    const c = new Chess(fen);
    return c.turn() === "w" && !c.isGameOver() ? c.fen() : null;
  } catch {
    return null;
  }
}

/**
 * A test lobby's options from its request (POST /api/squads/lobby?start=…&clock=…&keep=…&fen=…&bots=strong).
 * `start=votes` (Eric, Oct 12): the whole tournament from the first vote, bots in every other seat the moment its
 * opener connects (no fill wait). `relay|pairs|final`: that round, filled after SQUADS_LOBBY.testFillSeconds (time for
 * others to join), the rounds before skipped (relay skips none: it has the votes too, after the wait). `fen`: the first
 * round's boards start from that position (tests); `bots=strong`: every bot at the strongest skill; `seat=white`: the
 * opener plays White on their board in the first round's first half (their match's squads swapped if need be).
 * `mode=classic|mercenary`: that mode, with no Mode vote (without it the Mode vote is held, and the bots don't vote in
 * it: the opener's vote decides, nobody's gives Classic). `bots=blocks` (with or without strong: `bots=strong,blocks`):
 * the bots block whenever they can (so a test can count on a block, and on a shield canceling one).
 */
export function testLobbyOptions(q: URLSearchParams, now: number): { fillAt: number; test: NonNullable<SquadsRecord["test"]>; keepMs?: number } {
  const which = q.get("start");
  const start = ({ votes: 0, relay: 0, pairs: 1, final: 2 } as const)[which as "votes" | "relay" | "pairs" | "final"] ?? 0;
  const clock = parseTestClock(q.get("clock"));
  const fen = parseTestFen(q.get("fen"));
  const keepMs = q.has("keep") ? Math.max(5, Math.min(LOBBY_LIFE.lobbyResultsKeepMinutes * 60, Number(q.get("keep")) || 0)) * 1000 : undefined;
  return {
    fillAt: which === "votes" ? now : now + SQUADS_LOBBY.testFillSeconds * 1000,
    test: {
      start,
      ...(clock ? { clock } : {}),
      ...(fen ? { fen } : {}),
      ...((q.get("bots") ?? "").split(",").includes("strong") ? { strong: true } : {}),
      ...((q.get("bots") ?? "").split(",").includes("blocks") ? { blocks: true } : {}),
      ...(q.get("seat") === "white" ? { white: true } : {}),
      ...(q.get("mode") === "mercenary" || q.get("mode") === "classic" ? { mode: q.get("mode") as SquadsMode } : {}),
    },
    ...(keepMs !== undefined ? { keepMs } : {}),
  };
}

/** The engine's top moves for positions the devices (or the server) have settled, shared by the lobbies here. */
const TOP_CACHE = new Map<string, MoveScore[]>();
const cacheTop = (fen: string, top: MoveScore[]) => {
  TOP_CACHE.set(fen, top);
  if (TOP_CACHE.size > 2000) TOP_CACHE.delete(TOP_CACHE.keys().next().value!);
};
/** For tests: forget the shared cache. */
export const clearTopCache = () => TOP_CACHE.clear();

const mineIn = (m: SquadsMatch, id: string) => m.sides.some((x) => x.seats.includes(id));

export const SQUADS_FULL = "This lobby is full.";
export const SQUADS_STARTED = "This match has already started.";
export const SQUADS_ENDED = "That match has ended.";
export const SQUADS_UPDATE = "Update the app to play Squads (reload the page).";

const showMs = (lm: LiveMatch, s: SquadsSettings) =>
  1000 * (lm.m.format === "relay" ? s.moveShowSeconds : lm.m.format === "pairs" ? s.pairRevealSeconds : s.finalRevealSeconds);

export class SquadsCore {
  private matches = new Map<string, LiveMatch>();
  private dirty = new Set<string>();

  constructor(
    public record: SquadsRecord,
    matches: Record<string, LiveMatch>,
    private readonly io: SquadsIO,
    private readonly library: readonly Opening[],
    private readonly s: SquadsSettings = SQUADS,
  ) {
    // (Matches stored by an earlier version in today's shape: before the modes, Classic with Mercenary's fields filled
    // in; before the Breather was taken out, without it; before the time controls, with the one ceiling every clock had
    // then. Wallets likewise: a breather in an open shop's cart refunded. A clock voted before the time controls keeps
    // its numbers and that ceiling: the lobby finishes on the clock it voted.)
    for (const [k, v] of Object.entries(matches)) this.matches.set(k, { ...v, m: upgradeMatch(v.m, s), ...(v.drawn ? { drawn: upgradeMatch(v.drawn, s) } : {}) });
    if (record.wallets) record.wallets = record.wallets.map((w) => upgradeWallet(w, s));
    if (record.rules) record.rules = upgradeRules(record.rules, s);
    if (record.plan) record.plan = { ...record.plan, rules: upgradeRules(record.plan.rules, s) };
    if (record.test?.clock) record.test = { ...record.test, clock: upgradeClock(record.test.clock, s) };
  }

  private get r() {
    return this.record;
  }

  /** The record and the matches that changed since the last save (store each under its own key). */
  save(): { record: SquadsRecord; matches: Record<string, LiveMatch> } {
    const out: Record<string, LiveMatch> = {};
    for (const k of this.dirty) out[k] = this.matches.get(k)!;
    this.dirty.clear();
    return { record: this.r, matches: out };
  }

  /** Every match, for tests and the Durable Object's first store. */
  allMatches(): LiveMatch[] {
    return this.r.matchKeys.map((k) => this.matches.get(k)!).filter(Boolean);
  }

  match(key: string): LiveMatch | undefined {
    return this.matches.get(key);
  }

  private touch(lm: LiveMatch) {
    this.dirty.add(lm.key);
  }

  // ---------------- People ----------------

  private human(id: string) {
    return this.r.humans.find((h) => h.id === id);
  }

  private player(id: string): SquadPlayer | undefined {
    for (const sq of this.r.squads) for (const p of sq.players) if (p.id === id) return p;
    return undefined;
  }

  private squadOf(id: string): Squad | undefined {
    return this.r.squads.find((sq) => sq.players.some((p) => p.id === id));
  }

  private botPlays(id: string): boolean {
    const p = this.player(id);
    return !p || playsAsBot(p);
  }

  private send(id: string, msg: SquadsOutgoing) {
    const h = this.human(id);
    if (h && !h.left) this.io.send(id, msg);
  }

  private sendAll(msg: SquadsOutgoing | ((id: string) => SquadsOutgoing | null)) {
    for (const h of this.r.humans) {
      if (h.left) continue;
      const m = typeof msg === "function" ? msg(h.id) : msg;
      if (m) this.io.send(h.id, m);
    }
  }

  /** Seats taken or promised: each party at the larger of its seats and its members, each promised solo seat one. */
  private groupSizes(now: number): number[] {
    this.r.solos = this.r.solos.filter((t) => t > now);
    return [...Object.values(this.r.parties).map((p) => Math.max(p.size, p.members.length)), ...this.r.solos.map(() => 1)];
  }

  /** Still taking players: waiting, and (matchmade) not about to fill. */
  joinable(): boolean {
    if (this.r.phase !== "waiting") return false;
    const now = this.io.now();
    return this.r.fillAt === null || now < this.r.fillAt - 2000;
  }

  /**
   * The matchmaker's seats for groups on their way (a party: its size and pass; a solo player: size 1, no pass), each
   * kept if every party still fits the squads; which groups (indices) it took.
   */
  reserve(groups: readonly { size: number; pass: string }[], ms: number): number[] {
    if (!this.joinable()) return [];
    const now = this.io.now();
    const took: number[] = [];
    groups.forEach((g, i) => {
      const size = Math.round(g.size);
      if (!(size >= 1 && size <= this.s.partyMax)) return;
      if (!partiesFit([...this.groupSizes(now), size], this.s)) return;
      if (g.pass && size > 1) {
        if (Object.values(this.r.parties).some((p) => p.pass === g.pass)) return;
        this.r.parties[`P${++this.r.counter}`] = { pass: g.pass, size, members: [] };
      } else if (g.pass) {
        // A party of one (its pass names it, so the member comes in through the pass).
        this.r.parties[`P${++this.r.counter}`] = { pass: g.pass, size: 1, members: [] };
      } else this.r.solos.push(now + ms);
      took.push(i);
    });
    return took;
  }

  connect(
    token: string | undefined,
    opts: { name?: string; device?: "phone" | "computer"; party?: string; look?: unknown; userId?: string; test?: boolean; v?: number },
  ): { ok: true; playerId: string } | { ok: false; message: string; ended?: true } {
    const now = this.io.now();
    this.r.activeAt = now;
    if (opts.v !== SQUADS_PROTOCOL) return { ok: false, message: SQUADS_UPDATE };
    const existing = token ? this.r.humans.find((h) => h.token === token) : undefined;
    if (existing) {
      if (existing.left) return { ok: false, message: SQUADS_ENDED, ended: true };
      existing.connected = true;
      delete existing.goneAt;
      if (opts.look !== undefined) existing.look = cleanLook(opts.look);
      if (opts.userId) this.r.accounts[existing.id] = opts.userId;
      if (opts.test) existing.test = true;
      this.resendTo(existing.id);
      this.sendAll((id) => (id === existing.id ? null : { t: "lobby", lobby: this.lobbyView(null) }));
      // A matchmade lobby whose fill time came while nobody was here: it fills now.
      if (this.r.phase === "waiting" && this.r.fillAt !== null && now >= this.r.fillAt) this.fill();
      this.pump();
      return { ok: true, playerId: existing.id };
    }
    if (token) return { ok: false, message: SQUADS_ENDED, ended: true };
    if (this.r.phase === "results") return { ok: false, message: SQUADS_ENDED, ended: true };
    if (this.r.phase !== "waiting") return { ok: false, message: SQUADS_STARTED };
    // A party member takes one of their party's seats (by its pass); anyone else a solo seat.
    let partyId: string;
    const party = opts.party ? Object.entries(this.r.parties).find(([, p]) => p.pass === opts.party) : undefined;
    if (party) {
      if (party[1].members.length >= party[1].size) return { ok: false, message: "Your party's seats here are taken." };
      partyId = party[0];
    } else {
      const promised = this.r.solos.findIndex((t) => t > now);
      if (promised >= 0) this.r.solos.splice(promised, 1);
      else if (!partiesFit([...this.groupSizes(now), 1], this.s)) return { ok: false, message: SQUADS_FULL };
      partyId = "";
    }
    const id = `p${++this.r.counter}`;
    if (!partyId) {
      partyId = `s:${id}`;
      this.r.parties[partyId] = { pass: "", size: 1, members: [] };
    }
    this.r.parties[partyId]!.members.push(id);
    const name = (opts.name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || `Player ${this.r.humans.length + 1}`;
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    this.r.humans.push({
      id,
      name,
      token: newToken,
      connected: true,
      device: opts.device === "phone" ? "phone" : "computer",
      partyId,
      joinedAt: now,
      ...(opts.look !== undefined ? { look: cleanLook(opts.look) } : {}),
      ...(opts.test ? { test: true as const } : {}),
    });
    if (opts.userId) this.r.accounts[id] = opts.userId;
    this.resendTo(id);
    this.sendAll((to) => (to === id ? null : { t: "lobby", lobby: this.lobbyView(id) }));
    // Full, or (someone the matchmaker promised a seat, arriving late) the fill time has passed: it fills now.
    if (this.r.humans.length >= this.s.squadCount * this.s.squadSize || (this.r.fillAt !== null && now >= this.r.fillAt)) this.fill();
    this.pump();
    return { ok: true, playerId: id };
  }

  /** Everything a (re)connecting player needs: welcome, the lobby, the vote, every match, their squad's placement. */
  resendTo(id: string) {
    const h = this.human(id);
    if (!h || h.left) return;
    this.io.send(id, { t: "welcome", v: SQUADS_PROTOCOL, playerId: id, token: h.token, code: this.r.code, test: this.testAllowed(id) });
    this.io.send(id, { t: "lobby", lobby: this.lobbyView("all") });
    if (this.r.phase === "vote" && this.r.vote) this.io.send(id, { t: "vote", vote: this.voteView() });
    for (const lm of this.allMatches()) this.io.send(id, this.matchMessage(lm, id, true));
    const sq = this.squadOf(id);
    const placement = sq ? this.r.placed[sq.id] : undefined;
    if (sq && placement) this.io.send(id, { t: "placed", squadId: sq.id, placement, ...this.rewardFor(id, placement) });
    if (this.r.phase === "results") this.io.send(id, { t: "results", placements: { ...this.r.placed } });
  }

  disconnect(id: string) {
    const h = this.human(id);
    if (!h || !h.connected) return;
    h.connected = false;
    h.goneAt = this.io.now();
    this.r.activeAt = this.io.now();
    this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
    // Bot work it owed goes elsewhere (or another answer stands).
    for (const { lm, job } of this.liveJobs()) this.settle(lm, job);
    this.pump();
  }

  /** Anyone may use the test controls here: the switch is on and this person is an admin (or SQUADS_TEST is on). */
  testAllowed(id: string): boolean {
    return SQUADS_LOBBY.testControls && !!this.human(id)?.test;
  }

  // ---------------- Messages ----------------

  message(id: string, msg: SquadsClientMessage) {
    const h = this.human(id);
    if (!h || h.left) return;
    if (msg.t !== "botTop" && msg.t !== "speed") this.r.activeAt = this.io.now();
    switch (msg.t) {
      case "vote":
        this.castVote(id, msg.key, msg.option);
        break;
      case "choose":
        this.humanChoose(id, msg.key, msg.seq, msg.move);
        break;
      case "lock":
        this.humanLock(id, msg.key, msg.seq);
        break;
      case "block":
        this.humanBlock(id, msg.key, msg.seq, msg.board, msg.move);
        break;
      case "assist":
        this.humanAssist(id, msg.key, msg.seq);
        break;
      case "chip":
        this.humanChip(id, msg.key, msg.seq, msg.seen);
        break;
      case "buy":
        this.shopAction(id, msg.item, false);
        break;
      case "unbuy":
        this.shopAction(id, msg.item, true);
        break;
      case "armageddon":
        this.armageddonColour(id, msg.key, msg.colour);
        break;
      case "speed":
        this.speed(id, msg.nps);
        break;
      case "botTop":
        this.botTop(id, msg.id, msg.top);
        break;
      case "reclaim":
        this.reclaim(id);
        break;
      case "leave":
        this.leave(id);
        break;
      case "sync":
        this.resendTo(id);
        break;
      case "nextRound":
        this.nextRound(id);
        break;
      case "hello":
        break;
    }
    this.pump();
  }

  alarm() {
    // (Promised solo seats that ran out are let go here too.)
    this.groupSizes(this.io.now());
    this.pump();
  }

  /** The next time something is due (a timer, a half's deadline, a bot's move, a device's answer). */
  get nextAlarm(): number | null {
    const times: number[] = [];
    if (this.r.timer) times.push(this.r.timer.at);
    for (const lm of this.liveMatches()) {
      if ((lm.state === "break" || lm.state === "show") && lm.startsAt !== null) times.push(lm.startsAt);
      if (lm.state === "armageddon" && lm.arm) times.push(lm.arm.until);
      if (lm.state === "half" && lm.half) times.push(...this.halfWakes(lm));
    }
    for (const lm of this.allMatches()) times.push(...this.judgeWakes(lm));
    times.push(...Object.values(this.r.botShop ?? {}));
    // (Everything due has just been done: a time already past would only wake the object to do nothing, over and over.)
    return times.length ? Math.max(Math.min(...times), this.io.now() + 20) : null;
  }

  // ---------------- The lobby's own timeline ----------------

  /** Advances everything that's due, until nothing more is. */
  private pump() {
    for (let guard = 0; guard < 200; guard++) {
      const now = this.io.now();
      let changed = false;
      const t = this.r.timer;
      if (t && t.at <= now) {
        this.r.timer = null;
        this.lobbyTimer(t.kind);
        changed = true;
      }
      if (this.assignQueued()) changed = true;
      for (const lm of this.liveMatches()) if (this.advance(lm, now)) changed = true;
      for (const lm of this.allMatches()) if ((lm.judge || lm.brilliant) && this.judgeDue(lm, now)) changed = true;
      if (this.botShopDue(now)) changed = true;
      if (!changed) return;
    }
  }

  private lobbyTimer(kind: SquadsTimer) {
    switch (kind) {
      case "fill":
        // (Nobody here: it waits; the next person to connect fills it.)
        if (this.r.phase === "waiting" && this.r.humans.some((h) => h.connected)) this.fill();
        return;
      case "begin":
        if (this.r.phase === "filled") this.startVote(0);
        return;
      case "voteEnd":
        return this.endVote();
      case "voteNext":
        if (this.r.vote && this.r.vote.index + 1 < this.votes().length) return this.startVote(this.r.vote.index + 1);
        return this.drawTheBracket();
      case "bracket":
        return;
    }
  }

  /** Fills the empty seats with bots and forms the squads (parties kept whole); the votes follow the full grid's moment. */
  private fill() {
    if (this.r.phase !== "waiting") return;
    const now = this.io.now();
    const seats = this.s.squadCount * this.s.squadSize;
    const parties: Party[] = Object.entries(this.r.parties)
      .filter(([, p]) => p.members.length)
      .map(([pid, p]) => ({ id: pid, members: p.members.map((id) => ({ id, name: this.human(id)!.name, isBot: false, skill: null })) }));
    // Bots for every seat (their skills shuffled, so the empty seats get a spread), taken in order for the empty ones.
    const rng = squadsRng(this.r.seed, "bots");
    const strong = this.r.test?.strong ? DEFAULT_SETTINGS.botSkillRange[0] : null;
    const roster: SquadsEntrant[] = shuffle(rng, botRoster(rng, seats, DEFAULT_SETTINGS)).map((b) => ({ id: b.id, name: b.name, isBot: true, skill: strong ?? b.skill ?? DEFAULT_SETTINGS.botSkillRange[1] }));
    const { squads, waiting } = formSquads(parties, roster, squadsRng(this.r.seed, "form"), this.s);
    // (Never with the seats the lobby gives out; but anyone who couldn't be placed is told, not stranded.)
    for (const p of waiting) {
      for (const m of p.members) {
        const h = this.human(m.id);
        if (!h) continue;
        h.left = true;
        this.io.send(h.id, { t: "error", message: SQUADS_FULL });
        this.io.close?.(h.id);
      }
    }
    const used = new Set(squads.flatMap((sq) => sq.players.filter((p) => p.isBot).map((p) => p.id)));
    this.r.bots = roster.filter((b) => used.has(b.id));
    this.r.squads = squads;
    this.r.phase = "filled";
    this.r.filledAt = now;
    this.r.solos = [];
    this.r.timer = { kind: "begin", at: now + FRONT_DOOR.fillShowMs };
    this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
  }

  // ---------------- The votes ----------------

  /** The votes this lobby holds: Mode, Start and Clock (a test lobby whose mode is set: Start and Clock). */
  private votes() {
    return heldVotes(this.r.test?.mode, this.s);
  }

  /**
   * A vote's name for its random draws: "mode", or Start's and Clock's numbers from before the Mode vote came (0, 1),
   * so their bots' votes and ties are drawn as they were.
   */
  private voteStream(index: number): string | number {
    const id = this.votes()[index]!.id;
    return id === "mode" ? "mode" : this.votes().filter((v) => v.id !== "mode").findIndex((v) => v.id === id);
  }

  private everyone(): string[] {
    return this.r.squads.flatMap((sq) => sq.players.map((p) => p.id));
  }

  private voteView(): NetSquadsVote {
    const v = this.r.vote!;
    const def = this.votes()[v.index]!;
    const squadOf = (id: string) => this.squadOf(id)?.id ?? 0;
    return {
      key: v.key,
      id: def.id,
      index: v.index,
      count: this.votes().length,
      startsAt: v.startsAt,
      until: v.until,
      votes: [
        ...v.bots.map((b) => ({ playerId: b.id, option: b.option, at: b.at, squad: squadOf(b.id) })),
        ...Object.entries(v.votes).map(([playerId, x]) => ({ playerId, option: x.option, at: x.at, squad: squadOf(playerId), ...(x.joined ? { joined: true as const } : {}) })),
      ],
      result: v.result,
      ...(v.nextAt ? { nextAt: v.nextAt } : {}),
    };
  }

  private startVote(index: number) {
    const def = this.votes()[index]!;
    const now = this.io.now();
    const ms = this.s.voteSeconds * 1000;
    const bots = this.r.squads.flatMap((sq) => sq.players.filter((p) => p.isBot).map((p) => p.id));
    // The Mode vote: the lobby's bots lean Classic or Mercenary (botModeVotes). In a test lobby they sit it out, so its
    // opener's vote decides it (Eric tests a mode by voting for it, or sets it with the link's mode=).
    const rng = squadsRng(this.r.seed, "vote", this.voteStream(index), "bots");
    const cast = def.id === "mode" ? (this.r.test ? [] : botModeVotes(rng, bots, ms, this.s.voteBotSkip, this.s)) : botVotes(rng, bots, def.options.length, ms, this.s.voteBotSkip);
    this.r.vote = {
      index,
      key: `v${index}-${++this.r.counter}`,
      startsAt: now,
      until: now + ms,
      votes: {},
      bots: cast.filter((b) => votable(def, b.option)).map((b) => ({ id: b.id, option: b.option, at: now + b.atMs })),
      result: null,
    };
    this.r.phase = "vote";
    this.r.timer = { kind: "voteEnd", at: now + ms };
    this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
    this.sendAll({ t: "vote", vote: this.voteView() });
  }

  private castVote(id: string, key: string, option: number) {
    const v = this.r.vote;
    const now = this.io.now();
    if (this.r.phase !== "vote" || !v || v.key !== key || v.result !== null) return;
    const def = this.votes()[v.index]!;
    // ("Coming soon" can't be voted for.)
    if (now > v.until + DEFAULT_SETTINGS.lateGraceMs || !votable(def, option) || !this.player(id)) return;
    const had = v.votes[id];
    if (!castPregameVote(had ? [{ playerId: id, option: had.option }] : [], { playerId: id, option }, DEFAULT_SETTINGS.voteChangeAllowed)) return;
    v.votes[id] = { option, at: now };
    const squad = this.squadOf(id)?.id ?? 0;
    this.sendAll({ t: "voteCast", key, playerId: id, option, at: now, squad });
  }

  private endVote() {
    const v = this.r.vote;
    if (this.r.phase !== "vote" || !v || v.result !== null) return;
    const def = this.votes()[v.index]!;
    const cast = [...v.bots.map((b) => ({ playerId: b.id, option: b.option })), ...Object.entries(v.votes).map(([playerId, x]) => ({ playerId, option: x.option }))];
    const { result, joined } = closePregameVote(cast, this.everyone(), def, squadsRng(this.r.seed, "vote", this.voteStream(v.index), "tally"), (playerId, option) => ({ playerId, option }));
    const now = this.io.now();
    v.result = result;
    for (const id of joined) v.votes[id] = { option: result, at: now, joined: true };
    this.r.voteResults[def.id] = result;
    v.nextAt = now + this.s.voteResultSeconds * 1000;
    this.r.timer = { kind: "voteNext", at: v.nextAt };
    this.sendAll({ t: "vote", vote: this.voteView() });
  }

  // ---------------- The bracket ----------------

  /** After the votes: the rules, the plan (the lobby's one opening, if voted), the bracket, round 1's matches. */
  private drawTheBracket() {
    if (this.r.phase !== "vote" && this.r.phase !== "filled") return;
    const now = this.io.now();
    const rules = rulesFromVotes(this.r.voteResults, this.s, this.r.test?.mode);
    if (this.r.test?.clock) rules.clock = this.r.test.clock;
    this.r.rules = rules;
    this.r.plan = planLobby(this.r.seed, rules, this.library, this.s);
    // Every squad's team clock for the whole tournament (the rules' numbers).
    this.r.squads = startTeamClocks(this.r.squads, rules.clock);
    let bracket = drawBracket(
      this.r.squads.map((sq) => sq.id),
      squadsRng(this.r.seed, "bracket"),
    );
    this.r.phase = "bracket";
    this.r.vote = null;
    this.r.timer = null;
    // A test lobby that starts later: the rounds before are skipped, squads with people in them going through.
    const start = this.r.test?.start ?? 0;
    for (let round = 0; round < start; round++) {
      for (const bm of bracket[round]!) {
        const [a, b] = bm.squads as [number, number];
        const people = (sq: number) => this.r.squads[sq]!.players.filter((p) => !p.isBot).length;
        const winner = people(a) !== people(b) ? (people(a) > people(b) ? a : b) : coin(squadsRng(this.r.seed, `r${round}m${bm.index}`, "test-skip")) === 0 ? a : b;
        bracket = reportWinner(bracket, round as SquadsRound, bm.index, winner);
      }
    }
    this.r.bracket = bracket;
    this.placeNew();
    // Mercenary: every squad's wallet. A test lobby that starts after round 1 gives the squads still in a wallet to shop
    // with, and its intro is long enough to shop in (their shops are open until their first match starts).
    const merc = modeOf(rules) === "mercenary";
    if (merc) this.r.wallets = this.r.squads.map((sq) => newWallet(sq.id));
    const testShop = merc && start > 0;
    if (testShop) {
      for (const bm of bracket[start]!) for (const sq of bm.squads) if (sq !== null) this.earnCoins(sq, this.s.mercenary.testWallet, "test", start as SquadsRound);
    }
    const intro = testShop ? Math.max(SQUADS_LOBBY.bracketIntroSeconds, SQUADS_LOBBY.testShopSeconds) : SQUADS_LOBBY.bracketIntroSeconds;
    for (const bm of bracket[start]!) this.createMatch(start as SquadsRound, bm.index, now + intro * 1000);
    if (testShop) for (const bm of bracket[start]!) for (const sq of bm.squads) if (sq !== null) this.scheduleBotShop(sq, now);
    this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
    this.sendClocks();
  }

  private createMatch(round: SquadsRound, index: number, startsAt: number) {
    const bm = this.r.bracket![round]![index]!;
    const [a, b] = bm.squads;
    if (a === null || b === null) return;
    const key = `r${round}m${index}`;
    if (this.matches.has(key)) return;
    let planned = planMatch(this.r.plan!, round, index, [this.r.squads[a]!, this.r.squads[b]!], this.library, this.s);
    // A test lobby's opener White on their first board (tests): the squads swapped if they'd have Black.
    const opener = this.r.humans[0]?.id;
    if (this.r.test?.white && round === this.r.test.start && opener && mineIn(planned, opener) && !halfDuties(planned, this.s).duties.some((d) => d.players.includes(opener))) {
      planned = planMatch(this.r.plan!, round, index, [this.r.squads[b]!, this.r.squads[a]!], this.library, this.s);
    }
    // A test lobby's own position for its first round (tests).
    const fen = this.r.test?.fen && round === this.r.test.start ? this.r.test.fen : null;
    const m = fen
      ? createSquadsMatch(
          { ...planned, starts: planned.boards.map(() => ({ fen, openingId: null })), whites: planned.boards.map((x) => x.white), banksMs: planned.banks, blockBanks: planned.blockBanks },
          this.s,
        )
      : planned;
    const lm: LiveMatch = { key, round, index, m, state: "break", startsAt, seq: 0, half: null };
    this.matches.set(key, lm);
    this.r.matchKeys.push(key);
    this.touch(lm);
    this.sendAll((id) => this.matchMessage(lm, id, true));
    if (round > 0) this.catchUp(lm);
  }

  private liveMatches(): LiveMatch[] {
    return this.allMatches().filter((lm) => lm.state !== "over");
  }

  /**
   * One match's due work. Should the rules ever throw (a bug), the match is ended by material rather than leaving
   * the lobby stuck on an alarm that fails forever ("degrade, don't die").
   */
  private advance(lm: LiveMatch, now: number): boolean {
    try {
      return this.advanceMatch(lm, now);
    } catch (e) {
      console.log(`squads ${this.r.code}: ${lm.key} failed (${String(e)}): ended by material`);
      const { match, events } = endByMaterial({ ...lm.m, result: null }, this.s);
      lm.m = match;
      lm.half = null;
      delete lm.arm;
      this.touch(lm);
      this.earnFrom(lm, events);
      this.sendAll({ t: "half", key: lm.key, seq: lm.seq, events, acted: [], missed: [], replaced: [], match: this.netMatch(lm, false) });
      this.matchOver(lm);
      return true;
    }
  }

  /** One match's due work: begin a half, play bots, settle bot work, resolve the half, start Armageddon. */
  private advanceMatch(lm: LiveMatch, now: number): boolean {
    if ((lm.state === "break" || lm.state === "show") && lm.startsAt !== null && lm.startsAt <= now) {
      this.startHalf(lm);
      return true;
    }
    if (lm.state === "armageddon" && lm.arm && lm.arm.until <= now) {
      this.startTheArmageddon(lm);
      return true;
    }
    if (lm.state !== "half" || !lm.half) return false;
    const half = lm.half;
    let changed = false;
    for (const job of Object.values(half.work)) if (!job.how && this.settle(lm, job)) changed = true;
    for (const [bot, at] of Object.entries(half.botChips ?? {})) {
      if (half.startedAt + at <= now) {
        this.botChip(lm, bot);
        changed = true;
      }
    }
    for (const bot of Object.keys(half.bots)) {
      if (this.botActAt(lm, bot) <= now) {
        this.botAct(lm, bot);
        changed = true;
      }
    }
    if (this.halfDue(lm) <= now) {
      this.resolve(lm);
      return true;
    }
    if (changed) this.touch(lm);
    return changed;
  }

  // ---------------- A half ----------------

  private startHalf(lm: LiveMatch) {
    // Mercenary: the shop closes as the match starts; what each squad bought comes in as its kit.
    if (lm.seq === 0 && this.mercenary()) this.bringKits(lm);
    const m = lm.m;
    const now = this.io.now();
    const duties = halfDuties(m, this.s);
    const half: HalfRecord = { seq: lm.seq++, startedAt: now, inputs: NO_INPUTS, at: {}, bots: {}, work: {} };
    lm.state = "half";
    lm.startsAt = null;
    lm.half = half;
    const boards = new Set<number>();
    const planned: [number, number] = [0, 0];
    for (const d of duties.duties) {
      // Mercenary: a squad of bots now and then taps a Time chip on a move that needs time (in sudden death, or low on
      // bank): one bot a move, and it thinks with the chip's time. Never a squad with people playing: their chips.
      const chipBot = d.players.find((p) => this.botPlays(p));
      const tap =
        chipBot && this.mercenary() && m.chips[d.side] > planned[d.side] && this.botRun(m.sides[d.side].squadId)
          ? botChipTap(squadsRng(m.seed, m.key, m.turn, m.half, d.board, "bot-chip"), m.banks[d.side], this.s)
          : null;
      if (chipBot && tap !== null) {
        (half.botChips ??= {})[chipBot] = tap;
        planned[d.side]++;
      }
      const chipMs = tap !== null ? this.s.mercenary.chipSeconds * 1000 : 0;
      // (When its squad's bank would run out with all its moves still going, the chip counted: a bot moves before it.)
      const chipIn: HalfInputs = tap !== null && chipBot ? { ...NO_INPUTS, chips: [{ board: d.board, by: chipBot, at: tap }] } : NO_INPUTS;
      const cutoffMs = liveCutoff(m, chipIn, d, {}, this.s);
      for (const p of d.players) {
        if (!this.botPlays(p)) continue;
        const bankMs = m.banks[d.side] + 3 * chipMs;
        const think = squadBotThinkMs(squadsRng(m.seed, m.key, m.turn, m.half, d.board, "think", p), { bankMs, incrementMs: m.incrementMs, delayMs: m.delayMs, deadlineMs: d.deadlineMs + chipMs, cutoffMs }, this.s);
        // (With a chip coming, never before it's tapped.)
        half.bots[p] = tap !== null ? Math.max(think, tap + 200) : think;
        boards.add(d.board);
      }
    }
    const jobs = new Map<string, { id: string; fen: string; n: number; nodes: number }[]>();
    for (const b of boards) this.requestWork(lm, half, b, jobs);
    for (const [device, list] of jobs) this.send(device, { t: "botWork", jobs: list });
    this.touch(lm);
    this.sendAll({ t: "turn", key: lm.key, current: this.netHalf(lm)!, banks: [m.banks[0], m.banks[1]] });
    this.sendClocks();
    // (The bracket shows the match as playing from its first half; Mercenary: its squads' shops are closed now.)
    if (half.seq === 0) this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
    if (half.seq === 0) this.sendWallets();
  }

  /** Every squad's team clock, as the rules have it (a squad in a match: that match's bank; else its own). */
  clocksView(): NetTeamClock[] {
    if (!this.r.bracket) return [];
    const live = new Map<number, NetTeamClock>();
    for (const lm of this.liveMatches()) {
      matchClocks(lm.m).forEach((c) => live.set(c.squadId, { ...c, key: lm.key, since: lm.state === "half" && lm.half ? lm.half.startedAt : null }));
    }
    return teamClocks(this.r.squads).map((c) => live.get(c.squadId) ?? { ...c, key: null, since: null });
  }

  private sendClocks() {
    this.sendAll({ t: "clocks", clocks: this.clocksView() });
  }

  /** When the half ends: everyone with a duty locked in (now), else the last deadline of anyone still choosing (plus the network's grace). */
  private halfDue(lm: LiveMatch): number {
    const half = lm.half!;
    if (halfReady(lm.m, half.inputs, this.s)) return half.startedAt;
    let last = 0;
    for (const d of halfDuties(lm.m, this.s).duties) if (d.players.some((p) => !half.inputs.locked[p])) last = Math.max(last, dutyDeadline(half.inputs, d, this.s));
    return half.startedAt + last + DEFAULT_SETTINGS.lateGraceMs;
  }

  private halfWakes(lm: LiveMatch): number[] {
    const half = lm.half!;
    const out = [this.halfDue(lm)];
    for (const bot of Object.keys(half.bots)) out.push(this.botActAt(lm, bot));
    for (const at of Object.values(half.botChips ?? {})) out.push(half.startedAt + at);
    for (const job of Object.values(half.work)) {
      // (A queued job waits for a device to answer something; one following a twin, for the twin.)
      if (job.how || job.queued || job.follows) continue;
      if (job.firstAt !== undefined) out.push(job.firstAt + SQUADS_LOBBY.botWork.graceMs);
      out.push(job.sentAt + SQUADS_LOBBY.botWork.answerMs);
      if (job.refereeAt !== undefined) out.push(job.refereeAt + SQUADS_LOBBY.botWork.answerMs);
    }
    return out;
  }

  private humanChoose(id: string, key: string, seq: number, move: string) {
    const lm = this.matches.get(key);
    const no = (reason: Extract<SquadsOutgoing, { t: "choiceNo" }>["reason"]) => this.send(id, { t: "choiceNo", key, seq, move: String(move), reason });
    if (!lm || lm.state !== "half" || !lm.half || lm.half.seq !== seq) return no("stale");
    if (typeof move !== "string") return no("illegal");
    const d = dutyOf(lm.m, id, this.s);
    if (!d || this.botPlays(id)) return no("no_duty");
    const elapsed = this.io.now() - lm.half.startedAt;
    const deadline = dutyDeadline(lm.half.inputs, d.duty, this.s);
    if (elapsed > deadline + DEFAULT_SETTINGS.lateGraceMs) return no("late");
    const r = choose(lm.m, lm.half.inputs, id, move, this.s);
    if ("error" in r) return no(r.error);
    lm.half.inputs = r.inputs;
    lm.half.at[id] = Math.min(elapsed, deadline);
    this.touch(lm);
    this.sendChoices(lm, d.duty);
  }

  private humanLock(id: string, key: string, seq: number) {
    const lm = this.matches.get(key);
    if (!lm || lm.state !== "half" || !lm.half || lm.half.seq !== seq) return;
    const d = dutyOf(lm.m, id, this.s);
    if (!d || this.botPlays(id)) return;
    if (this.io.now() - lm.half.startedAt > dutyDeadline(lm.half.inputs, d.duty, this.s) + DEFAULT_SETTINGS.lateGraceMs) return;
    const next = lockIn(lm.half.inputs, id);
    if (next === lm.half.inputs) return;
    lm.half.inputs = next;
    this.touch(lm);
    this.sendChoices(lm, d.duty);
  }

  /**
   * A person blocks one of the other squad's moves on their board this half (the rules' `placeBlock`: their duty's
   * board, before their squad's move there is settled, paid at once). Everyone hears of it at once.
   */
  private humanBlock(id: string, key: string, seq: number, board: number, move: string) {
    const lm = this.matches.get(key);
    const no = (reason: Extract<SquadsOutgoing, { t: "blockNo" }>["reason"]) => this.send(id, { t: "blockNo", key, seq, move: String(move), reason });
    if (!lm || lm.state !== "half" || !lm.half || lm.half.seq !== seq) return no("stale");
    if (typeof move !== "string" || !Number.isInteger(board)) return no("not_a_move");
    const d = dutyOf(lm.m, id, this.s);
    if (!d || this.botPlays(id)) return no("no_duty");
    const elapsed = this.io.now() - lm.half.startedAt;
    const deadline = dutyDeadline(lm.half.inputs, d.duty, this.s);
    if (elapsed > deadline + DEFAULT_SETTINGS.lateGraceMs) return no("late");
    const r = placeBlock(lm.m, lm.half.inputs, id, board, move, Math.min(elapsed, deadline), this.s);
    if ("error" in r) return no(r.error);
    lm.half.inputs = r.inputs;
    this.touch(lm);
    this.sendAll({ t: "block", key, seq, block: r.block, bank: blockBankNow(lm.m, lm.half.inputs, r.block.side, this.s) });
  }

  /**
   * Mercenary: a person uses one of their squad's Stockfish tokens on their own decision this half (the rules'
   * `useStockfish`). Everyone hears of it at once (the count is public); the lines show only on `shownTo`'s screens,
   * worked out there.
   */
  private humanAssist(id: string, key: string, seq: number) {
    const lm = this.matches.get(key);
    const no = (reason: Extract<SquadsOutgoing, { t: "assistNo" }>["reason"]) => this.send(id, { t: "assistNo", key, seq, reason });
    if (!lm || lm.state !== "half" || !lm.half || lm.half.seq !== seq) return no("stale");
    const d = dutyOf(lm.m, id, this.s);
    if (!d || this.botPlays(id)) return no("no_duty");
    const elapsed = this.io.now() - lm.half.startedAt;
    const deadline = dutyDeadline(lm.half.inputs, d.duty, this.s);
    if (elapsed > deadline + DEFAULT_SETTINGS.lateGraceMs) return no("late");
    const r = useStockfish(lm.m, lm.half.inputs, id, Math.min(elapsed, deadline), this.s);
    if ("error" in r) return no(r.error);
    lm.half.inputs = r.inputs;
    this.touch(lm);
    this.sendAll({ t: "assist", key, seq, use: r.use, stockfish: [stockfishNow(lm.m, lm.half.inputs, 0), stockfishNow(lm.m, lm.half.inputs, 1)] });
  }

  /**
   * Mercenary: a person taps one of their squad's Time chips on their board's move (the rules' `useChip`: more time
   * for that move, the bank held still meanwhile). `seen`: the chips they saw on it, so a teammate's tap at the same
   * moment doesn't spend a second. Everyone hears at once (both squads see the counts), with the move's new deadline.
   */
  private humanChip(id: string, key: string, seq: number, seen: number) {
    const lm = this.matches.get(key);
    const no = (reason: Extract<SquadsOutgoing, { t: "chipNo" }>["reason"]) => this.send(id, { t: "chipNo", key, seq, reason });
    if (!lm || lm.state !== "half" || !lm.half || lm.half.seq !== seq) return no("stale");
    const d = dutyOf(lm.m, id, this.s);
    if (!d || this.botPlays(id)) return no("no_duty");
    // (The network's grace: a tap sent in time counts at the last moment it could have been made.)
    const elapsed = this.io.now() - lm.half.startedAt;
    const live = liveCutoff(lm.m, lm.half.inputs, d.duty, lm.half.at, this.s);
    if (elapsed > live + DEFAULT_SETTINGS.lateGraceMs) return no("late");
    const r = useChip(lm.m, lm.half.inputs, id, Math.min(elapsed, live), Number.isInteger(seen) ? seen : -1, lm.half.at, this.s);
    if ("error" in r) return no(r.error);
    this.chipPlaced(lm, r);
  }

  /** A Time chip tapped (a person's, or a squad of bots'): into the half, and to everyone with the move's new deadline. */
  private chipPlaced(lm: LiveMatch, r: { inputs: HalfInputs; chip: PlacedChip & { side: Side } }) {
    const half = lm.half!;
    half.inputs = r.inputs;
    this.touch(lm);
    const d = halfDuties(lm.m, this.s).duties.find((x) => x.board === r.chip.board)!;
    this.sendAll({
      t: "chip",
      key: lm.key,
      seq: half.seq,
      chip: { board: r.chip.board, side: r.chip.side, by: r.chip.by, at: r.chip.at },
      chips: [chipsNow(lm.m, half.inputs, 0), chipsNow(lm.m, half.inputs, 1)],
      deadline: half.startedAt + dutyDeadline(half.inputs, d, this.s),
    });
  }

  /** A squad of bots taps the Time chip it planned for this move (if the move is still being thought about). */
  private botChip(lm: LiveMatch, bot: string) {
    const half = lm.half!;
    const at = half.botChips?.[bot] ?? 0;
    if (half.botChips) delete half.botChips[bot];
    const d = dutyOf(lm.m, bot, this.s);
    if (!d) return;
    const r = useChip(lm.m, half.inputs, bot, at, chipsOn(half.inputs, d.duty.board), half.at, this.s);
    if ("inputs" in r) this.chipPlaced(lm, r);
  }

  // ---------------- Mercenary: wallets and the shop ----------------

  /** The lobby plays Mercenary (its Mode vote, or a test lobby's link). */
  mercenary(): boolean {
    return modeOf(this.r.rules) === "mercenary";
  }

  private wallet(squadId: number): Wallet | undefined {
    return this.r.wallets?.[squadId];
  }

  private earnCoins(squadId: number, coins: number, why: CoinWhy, round: SquadsRound) {
    const w = this.wallet(squadId);
    if (!w || coins <= 0) return;
    this.r.wallets![squadId] = earn(w, coins, why, round);
  }

  /** A half's (or a match's end's) "coins" events into the squads' wallets; whether there were any. */
  private earnFrom(lm: LiveMatch, events: readonly SquadsEvent[]): boolean {
    let any = false;
    for (const e of events) {
      if (e.kind !== "coins") continue;
      this.earnCoins(lm.m.sides[e.side].squadId, e.coins, e.why, lm.round);
      any = true;
    }
    return any;
  }

  /**
   * A squad's shop: open from the end of its match until its next match's first half (the wait for the other match and
   * the round break, which are there anyway), for a squad still in, never before round 1 (no coins yet). `until`: when
   * its next match starts (null while the match that decides its opponent is still going).
   */
  shopOf(squadId: number): { round: SquadsRound; until: number | null } | null {
    if (!this.mercenary() || this.r.phase !== "bracket" || !this.r.bracket || this.r.placed[squadId]) return null;
    const bm = this.r.bracket.flat().find((x) => x.winner === null && x.squads.includes(squadId));
    if (!bm || bm.round === 0) return null;
    const lm = this.matches.get(`r${bm.round}m${bm.index}`);
    if (lm && !(lm.state === "break" && lm.seq === 0)) return null;
    return { round: bm.round, until: lm?.startsAt ?? null };
  }

  walletsView(): NetWallet[] {
    return (this.r.wallets ?? []).map((w) => ({
      squadId: w.squadId,
      coins: w.coins,
      earned: w.earned,
      byRound: [w.byRound[0], w.byRound[1], w.byRound[2]],
      catchUp: w.catchUp,
      bought: { ...w.bought },
      cart: { ...w.cart },
      chips: w.chips ?? 0,
      shop: this.shopOf(w.squadId),
    }));
  }

  private sendWallets() {
    if (this.mercenary()) this.sendAll({ t: "wallets", wallets: this.walletsView() });
  }

  /** Nobody on this squad is playing their seat here and now: its bots shop and use its items. */
  private botRun(squadId: number): boolean {
    const sq = this.r.squads[squadId];
    return !!sq && !sq.players.some((p) => !playsAsBot(p) && !!this.human(p.id)?.connected && !this.human(p.id)?.left);
  }

  /** A person buys one of an item for their squad's next match (or puts one back), from its wallet, while its shop is open. */
  private shopAction(id: string, item: unknown, undo: boolean) {
    const sq = this.squadOf(id);
    const w = sq ? this.wallet(sq.id) : undefined;
    const no = (reason: Extract<SquadsOutgoing, { t: "shopNo" }>["reason"]) => this.send(id, { t: "shopNo", item: String(item), reason });
    if (!sq || !w || !this.shopOf(sq.id)) return no("closed");
    if (!isMercItem(item)) return no("unknown_item");
    const r = undo ? unbuyItem(w, item, this.s) : buyItem(w, item, this.s);
    if ("error" in r) return no(r.error);
    this.r.wallets![sq.id] = r.wallet;
    this.tellSquad(sq.id, { t: "bought", squadId: sq.id, by: id, item, price: "price" in r ? r.price : r.refund, undo });
    this.sendWallets();
  }

  /** A message to a squad's people only. */
  private tellSquad(squadId: number, msg: SquadsOutgoing) {
    for (const p of this.r.squads[squadId]?.players ?? []) if (!p.isBot) this.send(p.id, msg);
  }

  /** A squad's shop has just opened: its bots shop a few seconds in (if nobody is playing on it then). */
  private scheduleBotShop(squadId: number, from: number) {
    const shop = this.shopOf(squadId);
    if (!shop) return;
    const [lo, hi] = this.s.mercenary.bots.shopSeconds;
    const rng = squadsRng(this.r.seed, "shop-at", squadId, shop.round);
    (this.r.botShop ??= {})[squadId] = from + Math.round((lo + rng() * (hi - lo)) * 1000);
  }

  /** Bot squads whose shopping time has come: they shop (mercenary.ts, `botShop`) while their shop is still open. */
  private botShopDue(now: number): boolean {
    const due = Object.entries(this.r.botShop ?? {}).filter(([, t]) => t <= now);
    if (!due.length) return false;
    let bought = false;
    for (const [k] of due) {
      delete this.r.botShop![Number(k)];
      const squadId = Number(k);
      const shop = this.shopOf(squadId);
      let w = this.wallet(squadId);
      if (!shop || !w || !this.botRun(squadId)) continue;
      for (const item of botShop(squadsRng(this.r.seed, "shop", squadId, shop.round), w, shop.round === 2, this.s)) {
        const r = buyItem(w, item, this.s);
        if ("error" in r) break;
        w = r.wallet;
        bought = true;
      }
      this.r.wallets![squadId] = w;
    }
    if (bought) this.sendWallets();
    return true;
  }

  /**
   * Catch-up, as a match of round 2 or the final is set: the squad that has earned fewer coins by play gets a share of
   * the difference (mercenary.ts, `catchUpCoins`). Everyone hears.
   */
  private catchUp(lm: LiveMatch) {
    if (!this.mercenary()) return;
    const ids = [lm.m.sides[0].squadId, lm.m.sides[1].squadId] as const;
    const ws = ids.map((id) => this.wallet(id));
    if (!ws[0] || !ws[1]) return;
    const coins = catchUpCoins([ws[0].earned, ws[1].earned], this.s);
    ([0, 1] as const).forEach((side) => {
      if (!coins[side]) return;
      this.earnCoins(ids[side], coins[side], "catch_up", lm.round);
      this.sendAll({ t: "coins", squadId: ids[side], coins: coins[side], why: "catch_up", against: ids[side === 0 ? 1 : 0] });
    });
    this.sendWallets();
  }

  /** The shop closes as a match starts: each squad's cart comes in as its kit (time, block points, tokens, shields). */
  private bringKits(lm: LiveMatch) {
    if (lm.m.kit !== null || lm.m.mode !== "mercenary") return;
    const kits = lm.m.sides.map((side) => {
      const w = this.wallet(side.squadId);
      if (!w) return NO_ITEMS;
      const t = takeCart(w);
      this.r.wallets![side.squadId] = t.wallet;
      delete this.r.botShop?.[side.squadId];
      return t.kit;
    }) as [ItemCounts, ItemCounts];
    lm.m = applyKits(lm.m, kits, this.s);
    this.touch(lm);
    this.sendAll((id) => this.matchMessage(lm, id, false));
  }

  /** Live choices, each player the ones they may see (their own squad's), and who has locked in. */
  private sendChoices(lm: LiveMatch, duty: Duty) {
    const half = lm.half!;
    void duty;
    // (To everyone: who has chosen shows who is still thinking, which every squad's clock on screen needs.)
    const locked = Object.keys(half.inputs.locked).filter((p) => half.inputs.locked[p]);
    this.sendAll((id) => ({ t: "choices", key: lm.key, seq: half.seq, visible: visibleChoices(lm.m, half.inputs, this.sideIn(lm, id), this.s), locked }));
  }

  /** The side of this match a player is on (null: not in it, a spectator). */
  private sideIn(lm: LiveMatch, id: string): Side | null {
    const i = lm.m.sides.findIndex((x) => x.seats.includes(id));
    return i < 0 ? null : (i as Side);
  }

  /** When a bot acts: its thinking time, once its top moves are in (else when they come, or at its fallback moment). */
  private botActAt(lm: LiveMatch, bot: string): number {
    const half = lm.half!;
    const planned = half.startedAt + (half.bots[bot] ?? 0);
    const d = dutyOf(lm.m, bot, this.s);
    if (!d) return planned;
    const job = half.work[d.duty.board];
    if (!job || job.how || (!job.devices.length && !job.queued && !job.follows)) return planned;
    // Waiting for its devices, a bot plays from the quick look by its fallback moment: before its deadline, and before
    // its squad's bank would run out (Bullet near zero: a random move for want of time is worse than the quick look).
    const fallback = Math.min(dutyDeadline(half.inputs, d.duty, this.s) - SQUADS_LOBBY.botWork.fallbackMarginMs, liveCutoff(lm.m, half.inputs, d.duty, half.at, this.s) * this.s.bots.inTime);
    return Math.max(planned, half.startedAt + Math.max(0, fallback));
  }

  /** A bot plays its seat's duty: the rules' squad bots (bots.ts) over the top moves (the devices', or the quick look). */
  private botAct(lm: LiveMatch, bot: string) {
    const half = lm.half!;
    const m = lm.m;
    delete half.bots[bot];
    const d = dutyOf(m, bot, this.s);
    if (!d) return;
    const board = d.duty.board;
    const fen = m.boards[board]!.fen;
    const job = half.work[board];
    // The moves blocks take away this half are out of its choice (the quick look's lines, if the devices' leave none).
    const blocked = blocksOn(m, board);
    const allowed = movesAllowed(m, board);
    let top = topAllowed(job?.top ?? fallbackTop(fen, this.s.bots.candidates, this.s), blocked);
    if (!top.length) top = topAllowed(fallbackTop(fen, squadsLegalMoves(fen).length, this.s), blocked).slice(0, this.s.bots.candidates);
    const p = this.player(bot);
    const elapsedNow = Math.min(this.io.now() - half.startedAt, dutyDeadline(half.inputs, d.duty, this.s));
    // Mercenary: a squad of bots now and then uses one of its Stockfish tokens (the engine's best, whatever its skill).
    // Never a squad with people playing: their tokens are theirs to use.
    let strong = false;
    if (this.mercenary() && stockfishNow(m, half.inputs, d.duty.side) > 0 && this.botRun(m.sides[d.duty.side].squadId)) {
      if (botUsesStockfish(squadsRng(m.seed, m.key, m.turn, m.half, board, "bot-stockfish", bot), top, this.s)) {
        const used = useStockfish(m, half.inputs, bot, elapsedNow, this.s);
        if ("inputs" in used) {
          half.inputs = used.inputs;
          strong = true;
          this.sendAll({ t: "assist", key: lm.key, seq: half.seq, use: used.use, stockfish: [stockfishNow(m, half.inputs, 0), stockfishNow(m, half.inputs, 1)] });
        }
      }
    }
    const skill = strong ? DEFAULT_SETTINGS.botSkillRange[0] : squadBotSkill(top, p ? botSkillOf(p, this.s) : this.s.replacementBotSkill, this.s);
    const cands = candidatesFrom(top, this.s);
    const rng = squadsRng(m.seed, m.key, m.turn, m.half, board, "bot", bot);
    const partner = d.partner ? (half.inputs.choices[d.partner] ?? null) : null;
    let move: string;
    if (d.duty.role === "move") move = botRelayMove(rng, cands, skill, allowed);
    else if (m.format === "pairs") move = botPairPick(rng, cands, skill, allowed, partner, !!partner && tokensLeft(m, d.duty.side) > 0 && isOnlyMove(top, partner, this.s));
    else {
      // The final's vote: sometimes a pick a person on the squad has made (so the bots feel like teammates).
      const humans = d.team.filter((id) => !this.botPlays(id)).flatMap((id) => (half.inputs.choices[id] ? [half.inputs.choices[id]!] : []));
      move = botVotePick(rng, cands, skill, allowed, humans, this.s);
    }
    const elapsed = elapsedNow;
    // Now and then a block of the other squad's likely best reply (before its own move: Relay's is made at once).
    const reply = top.find((t) => t.move === move)?.reply;
    const bank = blockBankNow(m, half.inputs, d.duty.side, this.s);
    const share = 1 / d.duty.players.length;
    // (A test lobby's `bots=blocks`: they block whenever they can.)
    const bs = this.r.test?.blocks ? { ...this.s, bots: { ...this.s.bots, blockChance: 100, sharpChance: 100, blockReserve: 0 } } : this.s;
    const blockMove = bank > 0 ? botBlock(squadsRng(m.seed, m.key, m.turn, m.half, board, "bot-block", bot), { fen, ownMove: move, reply, bank, share }, bs) : null;
    if (blockMove) {
      const b = placeBlock(m, half.inputs, bot, board, blockMove, elapsed, this.s);
      if ("inputs" in b) {
        half.inputs = b.inputs;
        this.sendAll({ t: "block", key: lm.key, seq: half.seq, block: b.block, bank: blockBankNow(m, half.inputs, b.block.side, this.s) });
      }
    }
    const r = choose(m, half.inputs, bot, move, this.s);
    if ("error" in r) return;
    half.inputs = lockIn(r.inputs, bot);
    half.at[bot] = elapsed;
    this.touch(lm);
    this.sendChoices(lm, d.duty);
  }

  /** The half is over (everyone locked in, or time's up): the rules play it; misses go on the records. */
  private resolve(lm: LiveMatch) {
    const half = lm.half!;
    const now = this.io.now();
    const out = resolveHalf(lm.m, half.inputs, half.at, this.s);
    const was = new Set(this.r.squads.flatMap((sq) => sq.players.filter((p) => p.replacedByBot).map((p) => p.id)));
    // Out of time (sudden death, or the bank ran out mid-half) is a miss on the record but not a no-show (the rules'
    // `timeouts`): a slow move never hands a seat to a bot. Unless the person isn't there at all (disconnected, no move):
    // then it's a no-show as any other, or an absent player in sudden death would play random moves for good.
    const present = new Set(out.timeouts.filter((id) => !!half.inputs.choices[id] || !!this.human(id)?.connected));
    this.r.squads = noteActions(this.r.squads, [...out.acted, ...present], out.missed.filter((id) => !present.has(id)), this.s);
    if (present.size) this.r.squads = this.r.squads.map((sq) => ({ ...sq, players: sq.players.map((p) => (present.has(p.id) ? { ...p, misses: p.misses + 1 } : p)) }));
    const replaced = this.r.squads.flatMap((sq) => sq.players.filter((p) => p.replacedByBot && !was.has(p.id)).map((p) => p.id));
    lm.m = out.match;
    lm.half = null;
    lm.state = "show";
    lm.startsAt = now + showMs(lm, this.s);
    // Same-move tokens burned this half go to the judge (its verdict after the reveal).
    const jobs = new Map<string, { id: string; fen: string; n: number; nodes: number }[]>();
    for (const index of out.tokensUsed) this.requestJudge(lm, index, half, jobs);
    // Mercenary: the half's coins into the wallets, and its possibly brilliant moves to the judge.
    const earned = this.earnFrom(lm, out.events);
    for (const cand of out.brilliant) this.requestBrilliant(lm, cand, half, jobs);
    for (const [device, list] of jobs) this.send(device, { t: "botWork", jobs: list });
    this.touch(lm);
    this.sendAll({ t: "half", key: lm.key, seq: half.seq, events: out.events, acted: out.acted, missed: out.missed, replaced, match: this.netMatch(lm, false) });
    if (earned) this.sendWallets();
    if (replaced.length) this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
    if (lm.m.result) this.matchOver(lm);
    else this.sendClocks();
  }

  // ---------------- Same-move tokens: the judge ----------------

  /**
   * Asks the judge about a same-move token: the bot engine's top moves for the position it was played in, from the
   * half's own bot work on that board if it had any (the judge's existing work), else remembered, else devices (two,
   * outside the match first, the token's own squad last). Its verdict shows once the reveal is over (`notBefore`).
   */
  private requestJudge(lm: LiveMatch, index: number, half: HalfRecord | null, out: Map<string, { id: string; fen: string; n: number; nodes: number }[]>) {
    const use = lm.m.tokenLog[index];
    if (!use) return;
    const now = this.io.now();
    const id = `${lm.key}/t/${index}`;
    const base = { id, fen: use.fen, sentAt: now, answers: {}, index, notBefore: now + showMs(lm, this.s) };
    const own = half?.work[use.board];
    const judge = (lm.judge ??= {});
    if (own?.top && own.how && own.how !== "fallback" && own.fen === use.fen) {
      judge[index] = { ...base, devices: [], top: own.top, how: own.how };
      return;
    }
    const cached = TOP_CACHE.get(use.fen);
    if (cached) {
      judge[index] = { ...base, devices: [], top: cached, how: "cached" };
      return;
    }
    const devices = this.pickDevices(lm, SQUADS_LOBBY.botWork.perJob, [], new Set(lm.m.sides[use.side].seats));
    const queued = !devices.length && Object.keys(this.r.devices).some((d) => this.deviceUp(d));
    judge[index] = { ...base, devices, ...(queued ? { queued: true as const } : {}) };
    for (const d of devices) {
      this.r.devices[d]!.jobs++;
      out.set(d, [...(out.get(d) ?? []), { id, fen: use.fen, n: this.s.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes }]);
    }
  }

  /**
   * Mercenary: asks the judge whether a move was brilliant, the same way as for a token: the half's own bot work on
   * that board, or a remembered answer, else devices (outside the match first, the mover's squad last). Bots' moves are
   * judged only from work already done. Its verdict shows once the half's show is over.
   */
  private requestBrilliant(lm: LiveMatch, cand: BrilliantCandidate, half: HalfRecord | null, out: Map<string, { id: string; fen: string; n: number; nodes: number }[]>) {
    const now = this.io.now();
    const n = (lm.brilliantSeq = (lm.brilliantSeq ?? 0) + 1);
    const id = `${lm.key}/b/${n}`;
    const base = { id, fen: cand.fen, sentAt: now, answers: {}, index: n, notBefore: now + showMs(lm, this.s), brilliant: cand };
    const own = half?.work[cand.board];
    const jobs = (lm.brilliant ??= {});
    if (own?.top && own.how && own.how !== "fallback" && own.fen === cand.fen) {
      jobs[n] = { ...base, devices: [], top: own.top, how: own.how };
      return;
    }
    const cached = TOP_CACHE.get(cand.fen);
    if (cached) {
      jobs[n] = { ...base, devices: [], top: cached, how: "cached" };
      return;
    }
    if (!cand.finders.some((p) => !this.botPlays(p))) return;
    const devices = this.pickDevices(lm, SQUADS_LOBBY.botWork.perJob, [], new Set(lm.m.sides[cand.side].seats));
    const queued = !devices.length && Object.keys(this.r.devices).some((d) => this.deviceUp(d));
    if (!devices.length && !queued) return;
    jobs[n] = { ...base, devices, ...(queued ? { queued: true as const } : {}) };
    for (const d of devices) {
      this.r.devices[d]!.jobs++;
      out.set(d, [...(out.get(d) ?? []), { id, fen: cand.fen, n: this.s.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes }]);
    }
  }

  /** When a match's judge work is next due: its devices' answers (the grace, the time limit), then its verdicts. */
  private judgeWakes(lm: LiveMatch): number[] {
    const out: number[] = [];
    for (const job of [...Object.values(lm.judge ?? {}), ...Object.values(lm.brilliant ?? {})]) {
      if (job.how) {
        out.push(job.notBefore);
        continue;
      }
      if (job.queued) continue;
      if (job.firstAt !== undefined) out.push(job.firstAt + SQUADS_LOBBY.botWork.graceMs);
      out.push(job.sentAt + SQUADS_LOBBY.botWork.answerMs);
      if (job.refereeAt !== undefined) out.push(job.refereeAt + SQUADS_LOBBY.botWork.answerMs);
    }
    return out;
  }

  /**
   * A match's judge work: settles what can be, and once the reveal is over gives each verdict (the rules'
   * `judgeTokenUse`: no answer from any device, no refund), refunding the token if it was the only move. Everyone hears.
   */
  private judgeDue(lm: LiveMatch, now: number): boolean {
    let changed = false;
    for (const job of Object.values(lm.judge ?? {})) {
      if (!job.how && this.settle(lm, job)) changed = true;
      if (!job.how || now < job.notBefore) continue;
      const use = lm.m.tokenLog[job.index];
      delete lm.judge![job.index];
      changed = true;
      if (!use || use.verdict) continue;
      lm.m = settleTokenUse(lm.m, job.index, judgeTokenUse(use, job.how === "fallback" ? null : (job.top ?? null), this.s));
      const m = lm.m;
      this.sendAll({ t: "token", key: lm.key, index: job.index, use: m.tokenLog[job.index]!, tokens: m.tokens ? [m.tokens[0], m.tokens[1]] : null });
    }
    if (lm.judge && !Object.keys(lm.judge).length) delete lm.judge;
    // Mercenary: brilliant moves, once the show is over: coins for the squad, and everyone hears who found it.
    for (const job of Object.values(lm.brilliant ?? {})) {
      if (!job.how && this.settle(lm, job)) changed = true;
      if (!job.how || now < job.notBefore) continue;
      delete lm.brilliant![job.index];
      changed = true;
      const cand = job.brilliant;
      if (!cand || !isBrilliant(cand, job.how === "fallback" ? null : (job.top ?? null), this.s)) continue;
      const squadId = lm.m.sides[cand.side].squadId;
      // At most `capPerMatch` paid a squad a match: past it, still announced, with no coins.
      const paid = (lm.brilliantPaid ??= [0, 0]);
      const pay = brilliantPay(paid[cand.side], this.s);
      if (!pay.capped) {
        paid[cand.side]++;
        this.earnCoins(squadId, pay.coins, "brilliant", lm.round);
      }
      this.sendAll({ t: "coins", squadId, coins: pay.coins, why: "brilliant", key: lm.key, board: cand.board, move: cand.move, by: [...cand.finders], ...(pay.capped ? { capped: true } : {}) });
      if (!pay.capped) this.sendWallets();
    }
    if (lm.brilliant && !Object.keys(lm.brilliant).length) delete lm.brilliant;
    if (changed) this.touch(lm);
    return changed;
  }

  // ---------------- A match's end ----------------

  private matchOver(lm: LiveMatch) {
    const m = lm.m;
    const now = this.io.now();
    // What's left of each squad's team bank carries into its next match (Armageddon's own clocks aside).
    this.r.squads = settleTeamClocks(this.r.squads, m);
    if (m.result!.winner === null) {
      // A drawn final: Armageddon. The squad with more team bank left picks its color (bots take Black).
      lm.drawn = m;
      lm.state = "armageddon";
      lm.startsAt = null;
      lm.arm = { chooser: armageddonChooser(m), until: now + this.s.armageddonIntroSeconds * 1000, colour: null };
      this.touch(lm);
      this.sendAll((id) => this.matchMessage(lm, id, true));
      this.sendClocks();
      return;
    }
    lm.state = "over";
    lm.startsAt = null;
    this.touch(lm);
    // Mercenary: the Time chips each squad didn't use go back to its wallet, kept for its next round.
    if (this.mercenary()) {
      for (const side of [0, 1] as const) {
        const w = this.wallet(m.sides[side].squadId);
        if (w) this.r.wallets![w.squadId] = returnChips(w, m.chips[side]);
      }
    }
    this.r.bracket = reportWinner(this.r.bracket!, lm.round, lm.index, winnerSquad(m)!);
    this.placeNew();
    if (lm.round < 2) {
      const next = (lm.round + 1) as SquadsRound;
      this.createMatch(next, lm.index >> 1, now + this.s.roundBreakSeconds * 1000);
      // Mercenary: the winner's shop is open now (until its next match starts); a squad of bots shops in a moment.
      if (this.mercenary()) {
        this.scheduleBotShop(winnerSquad(m)!, now);
        this.sendWallets();
      }
    } else {
      this.r.phase = "results";
      this.r.endedAt = now;
      this.sendAll({ t: "results", placements: { ...this.r.placed } });
    }
    this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
    this.sendClocks();
  }

  private armageddonColour(id: string, key: string, colour: Colour) {
    const lm = this.matches.get(key);
    if (!lm || lm.state !== "armageddon" || !lm.arm || (colour !== "w" && colour !== "b")) return;
    if (this.sideIn(lm, id) !== lm.arm.chooser || this.botPlays(id)) return;
    lm.arm.colour = colour;
    this.touch(lm);
    this.sendAll((to) => this.matchMessage(lm, to, false));
  }

  private startTheArmageddon(lm: LiveMatch) {
    const arm = lm.arm!;
    const drawn = lm.drawn!;
    const colour = arm.colour ?? botArmageddonColour(this.s);
    const white = colour === "w" ? arm.chooser : otherSide(arm.chooser);
    lm.m = startArmageddon(drawn, white, armageddonStart(this.r.plan!, drawn, this.library, this.s), this.s);
    lm.state = "break";
    lm.startsAt = this.io.now();
    delete lm.arm;
    this.touch(lm);
    this.sendAll((id) => this.matchMessage(lm, id, true));
  }

  /** Squads whose placement the bracket has just decided: rewards for their people (once each). */
  private placeNew() {
    for (const [sq, placement] of placements(this.r.bracket!)) {
      if (this.r.placed[sq]) continue;
      this.r.placed[sq] = placement;
      for (const p of this.r.squads[sq]!.players) {
        if (p.isBot) continue;
        const reward = this.rewardFor(p.id, placement);
        this.r.rewardQueue.push({ playerId: p.id, userId: this.r.accounts[p.id] ?? null, squadId: sq, placement, ...reward });
        this.send(p.id, { t: "placed", squadId: sq, placement, ...reward });
      }
    }
  }

  /**
   * A person's reward for their squad's placement: coins and crates if they're still playing their seat (not left,
   * not handed to a bot), and recorded on their profile if signed in; nothing in a lobby a test control touched.
   */
  private rewardFor(id: string, placement: SquadsPlacement): { coins: number; crates: number; recorded: boolean } {
    const testing = !!this.r.test || !!this.r.testUsed;
    const h = this.human(id);
    const p = this.player(id);
    const playing = !!h && !h.left && !!p && !p.replacedByBot;
    const r = SQUADS_LOBBY.rewards[placement];
    return { coins: playing && !testing ? r.coins : 0, crates: playing && !testing ? r.crates : 0, recorded: !testing && !!this.r.accounts[id] };
  }

  /** The Durable Object writes these (results and rewards) and they're gone from the record. */
  takeRewards(): SquadsReward[] {
    return this.r.rewardQueue.splice(0);
  }

  // ---------------- People's choices outside a half ----------------

  private reclaim(id: string) {
    const h = this.human(id);
    if (!h || h.left || this.r.placed[this.squadOf(id)?.id ?? -1]) return;
    let changed = false;
    this.r.squads = this.r.squads.map((sq) => ({
      ...sq,
      players: sq.players.map((p) => {
        if (p.id !== id || !p.replacedByBot) return p;
        changed = true;
        return { ...p, replacedByBot: false, missStreak: 0 };
      }),
    }));
    if (changed) this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
  }

  /**
   * Leaving: before the lobby fills, the seat is free again. After, the person goes (their sockets close): a squad
   * that's out, to queue again; a squad still playing gets a bot in their seat at once (they won't be back).
   */
  private leave(id: string) {
    const h = this.human(id)!;
    if (this.r.phase === "waiting") {
      this.r.humans = this.r.humans.filter((x) => x.id !== id);
      const party = this.r.parties[h.partyId];
      if (party) {
        party.members = party.members.filter((x) => x !== id);
        if (!party.pass && !party.members.length) delete this.r.parties[h.partyId];
      }
      delete this.r.accounts[id];
      delete this.r.devices[id];
      this.io.send(id, { t: "left" });
      this.io.close?.(id);
      this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
      return;
    }
    h.left = true;
    h.connected = false;
    this.r.squads = this.r.squads.map((sq) => ({ ...sq, players: sq.players.map((p) => (p.id === id && !this.r.placed[sq.id] ? { ...p, replacedByBot: true } : p)) }));
    this.io.send(id, { t: "left" });
    this.io.close?.(id);
    this.sendAll({ t: "lobby", lobby: this.lobbyView(null) });
  }

  // ---------------- Test controls ----------------

  /**
   * "Next round" (admins, or SQUADS_TEST): every match still going in the earliest unfinished round ends now (boards
   * still going decided by material, a level match by time left, then a coin) and the bracket moves on. In the votes:
   * they close now. Nothing more is recorded or rewarded in this lobby.
   */
  private nextRound(id: string) {
    if (!this.testAllowed(id)) return;
    if (this.r.phase === "vote" || this.r.phase === "filled") {
      this.r.testUsed = true;
      if (this.r.phase === "filled") this.startVote(0);
      for (let i = 0; i < this.votes().length && this.r.phase === "vote"; i++) {
        this.endVote();
        if (this.r.vote && this.r.vote.index + 1 < this.votes().length) this.startVote(this.r.vote.index + 1);
        else this.drawTheBracket();
      }
      return;
    }
    if (this.r.phase !== "bracket") return;
    const live = this.liveMatches();
    if (!live.length) return;
    this.r.testUsed = true;
    const round = Math.min(...live.map((lm) => lm.round));
    const now = this.io.now();
    for (const lm of live.filter((x) => x.round === round)) {
      const seq = lm.half?.seq ?? lm.seq;
      // A drawn final waiting for its Armageddon: settled as a level match (time left, then a coin).
      const base = lm.state === "armageddon" && lm.drawn ? { ...lm.drawn, result: null } : lm.m;
      const { match, events } = endByMaterial(base, this.s);
      lm.m = match;
      lm.half = null;
      delete lm.arm;
      lm.state = "show";
      lm.startsAt = now;
      this.touch(lm);
      this.earnFrom(lm, events);
      this.sendAll({ t: "half", key: lm.key, seq, events, acted: [], missed: [], replaced: [], match: this.netMatch(lm, false) });
      this.matchOver(lm);
      // ("Next round" moves straight on: the next round's match begins after a short look at the bracket.)
      for (const next of this.liveMatches()) if (next.state === "break" && next.seq === 0 && next.round === round + 1) next.startsAt = Math.min(next.startsAt ?? now, now + 3000);
    }
  }

  // ---------------- Bot work on devices ----------------

  private speed(id: string, nps: unknown) {
    if (typeof nps !== "number" || !Number.isFinite(nps) || nps <= 0) return;
    const d = (this.r.devices[id] ??= { nps: 0, strikes: 0, jobs: 0 });
    d.nps = Math.round(Math.max(10_000, Math.min(50_000_000, nps)));
  }

  private deviceUp(id: string): boolean {
    const d = this.r.devices[id];
    const h = this.human(id);
    return !!d && !!h && h.connected && !h.left && d.strikes < SQUADS_LOBBY.botWork.strikes;
  }

  /** Jobs a device holds unanswered right now (every live match's half). */
  private inFlight(): Map<string, number> {
    const out = new Map<string, number>();
    for (const { job } of this.liveJobs()) {
      if (job.how) continue;
      for (const d of [...job.devices, ...(job.referee ? [job.referee] : [])]) if (!(d in job.answers)) out.set(d, (out.get(d) ?? 0) + 1);
    }
    return out;
  }

  /**
   * Devices for a job, best first: outside this match before those in it (nobody's engine decides the bots they play
   * against or beside, while anyone else's can), and `last` (a token's own squad, judging its refund) after those;
   * computers before phones, the least loaded, the fastest. None holding its most unanswered jobs already.
   */
  private pickDevices(lm: LiveMatch, n: number, exclude: readonly string[] = [], last: ReadonlySet<string> = new Set()): string[] {
    const inMatch = new Set(lm.m.sides.flatMap((x) => x.seats));
    const busy = this.inFlight();
    const cap = SQUADS_LOBBY.botWork.maxInFlight;
    return Object.keys(this.r.devices)
      .filter((id) => this.deviceUp(id) && !exclude.includes(id) && (busy.get(id) ?? 0) < cap[this.human(id)!.device])
      .sort((a, b) => {
        const da = this.r.devices[a]!;
        const db = this.r.devices[b]!;
        const key = (id: string, d: { nps: number; jobs: number }) => [last.has(id) ? 2 : inMatch.has(id) ? 1 : 0, this.human(id)!.device === "phone" ? 1 : 0, d.jobs, -d.nps];
        const ka = key(a, da);
        const kb = key(b, db);
        for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!;
        return a < b ? -1 : 1;
      })
      .slice(0, n);
  }

  private requestWork(lm: LiveMatch, half: HalfRecord, board: number, out: Map<string, { id: string; fen: string; n: number; nodes: number }[]>) {
    const fen = lm.m.boards[board]!.fen;
    const id = `${lm.key}/${half.seq}/${board}`;
    const now = this.io.now();
    const cached = TOP_CACHE.get(fen);
    if (cached) {
      half.work[board] = { id, fen, devices: [], sentAt: now, answers: {}, top: cached, how: "cached" };
      return;
    }
    const twin = this.liveJobs().find(({ job, judge }) => !judge && job.fen === fen && !job.how && !job.follows && job.id !== id);
    if (twin) {
      half.work[board] = { id, fen, devices: [], sentAt: now, answers: {}, follows: twin.job.id };
      return;
    }
    const devices = this.pickDevices(lm, SQUADS_LOBBY.botWork.perJob);
    const queued = !devices.length && Object.keys(this.r.devices).some((d) => this.deviceUp(d));
    half.work[board] = { id, fen, devices, sentAt: now, answers: {}, ...(queued ? { queued: true as const } : {}) };
    for (const d of devices) {
      this.r.devices[d]!.jobs++;
      out.set(d, [...(out.get(d) ?? []), { id, fen, n: this.s.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes }]);
    }
  }

  /** Every bot-work job of the halves being played, and every token waiting for the judge (finished matches too). */
  private liveJobs(): { lm: LiveMatch; job: WorkJob; judge?: JudgeJob }[] {
    return [
      ...this.liveMatches().flatMap((lm) => Object.values(lm.half?.work ?? {}).map((job) => ({ lm, job }))),
      ...this.allMatches().flatMap((lm) => [...Object.values(lm.judge ?? {}), ...Object.values(lm.brilliant ?? {})].map((job) => ({ lm, job, judge: job }))),
    ];
  }

  /**
   * Jobs waiting for a device with room go out as devices free up, the soonest-needed first (a bot that hasn't its
   * answer by its fallback moment plays from the quick look meanwhile).
   */
  private assignQueued(): boolean {
    const waiting = this.liveJobs().filter(({ job }) => job.queued && !job.how);
    if (!waiting.length) return false;
    const need = ({ lm, job, judge }: { lm: LiveMatch; job: WorkJob; judge?: JudgeJob }) => {
      if (judge) return judge.notBefore;
      const half = lm.half;
      if (!half) return Infinity;
      const board = Number(job.id.split("/")[2]);
      const times = Object.entries(half.bots).filter(([b]) => dutyOf(lm.m, b, this.s)?.duty.board === board).map(([, t]) => t);
      return half.startedAt + (times.length ? Math.min(...times) : 0);
    };
    waiting.sort((a, b) => need(a) - need(b));
    const out = new Map<string, { id: string; fen: string; n: number; nodes: number }[]>();
    let changed = false;
    for (const { lm, job, judge } of waiting) {
      // (A token's judge or a brilliant move's: the squad it concerns last.)
      const concerns = judge?.brilliant?.side ?? (judge ? lm.m.tokenLog[judge.index]?.side : undefined);
      const devices = this.pickDevices(lm, SQUADS_LOBBY.botWork.perJob, [], new Set(concerns !== undefined ? lm.m.sides[concerns].seats : []));
      if (!devices.length) break;
      delete job.queued;
      job.devices = devices;
      job.sentAt = this.io.now();
      for (const d of devices) {
        this.r.devices[d]!.jobs++;
        out.set(d, [...(out.get(d) ?? []), { id: job.id, fen: job.fen, n: this.s.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes }]);
      }
      this.touch(lm);
      changed = true;
    }
    for (const [device, list] of out) this.send(device, { t: "botWork", jobs: list });
    return changed;
  }

  private jobById(id: string): { lm: LiveMatch; job: WorkJob } | null {
    const [key, seq, board] = String(id).split("/");
    const lm = key ? this.matches.get(key) : undefined;
    const job =
      seq === "t" ? lm?.judge?.[Number(board)] : seq === "b" ? lm?.brilliant?.[Number(board)] : lm?.half && String(lm.half.seq) === seq ? lm.half.work[Number(board)] : undefined;
    return lm && job && job.id === id ? { lm, job } : null;
  }

  private botTop(id: string, jobId: string, top: unknown) {
    const found = this.jobById(jobId);
    if (!found) return;
    const { lm, job } = found;
    if (job.how || (!job.devices.includes(id) && job.referee !== id) || id in job.answers) return;
    const clean = cleanTop(job.fen, top, this.s.bots.candidates);
    job.answers[id] = clean;
    if (!clean) this.strike(id, `${job.id}: an answer that doesn't hold together`);
    else job.firstAt ??= this.io.now();
    this.settle(lm, job);
    this.touch(lm);
  }

  private strike(id: string, why: string) {
    const d = this.r.devices[id];
    if (!d) return;
    d.strikes++;
    console.log(`squads ${this.r.code}: strike for ${id} (${why})`);
  }

  /** Settles a job if it can be: two answers that agree, one alone after the grace, a verdict, a referee, or none. */
  private settle(lm: LiveMatch, job: WorkJob): boolean {
    if (job.how) return false;
    const now = this.io.now();
    const cfg = SQUADS_LOBBY.botWork;
    if (job.follows) {
      // The twin's answer (remembered once settled, so a twin from a half that has ended still counts).
      const cached = TOP_CACHE.get(job.fen);
      const twin = this.jobById(job.follows)?.job;
      if (!cached && twin && !twin.how) return false;
      job.how = cached ? "cached" : twin?.top ? twin.how! : "fallback";
      if (cached ?? twin?.top) job.top = cached ?? twin!.top;
      this.touch(lm);
      return true;
    }
    if (job.queued) return false;
    const valid = job.devices.filter((d) => job.answers[d]).map((d) => ({ d, top: job.answers[d]! }));
    const pending = job.devices.filter((d) => !(d in job.answers) && this.deviceUp(d));
    const done = (top: MoveScore[] | undefined, how: NonNullable<WorkJob["how"]>) => {
      job.how = how;
      if (top) {
        job.top = top;
        if (how !== "one") cacheTop(job.fen, top);
      }
      this.touch(lm);
      return true;
    };
    if (valid.length >= 2) {
      const [a, b] = valid as [{ d: string; top: MoveScore[] }, { d: string; top: MoveScore[] }];
      if (topsAgree(a.top, b.top)) return done(a.top, "agreed");
      // A referee's answer: the one it agrees with stands; the other device gets a strike.
      if (job.referee) {
        const ref = job.answers[job.referee];
        if (ref) {
          const right = topsAgree(ref, a.top) ? a : topsAgree(ref, b.top) ? b : null;
          if (right) {
            this.strike(right === a ? b.d : a.d, `${job.id}: outvoted`);
            return done(right.top, "referee");
          }
          return done(undefined, "fallback");
        }
        if (job.referee in job.answers || !this.deviceUp(job.referee) || now >= (job.refereeAt ?? now) + cfg.answerMs) return done(undefined, "fallback");
        return false;
      }
      if (!job.server && this.io.serverEngine && this.io.serverTop) {
        job.server = "asked";
        this.io.serverTop({ id: job.id, fen: job.fen, moves: verdictMovesOf([a.top, b.top]), nodes: cfg.serverNodes });
        return false;
      }
      if (job.server === "asked") return false;
      const referee = this.pickDevices(lm, 1, job.devices)[0];
      if (!referee) return done(undefined, "fallback");
      job.referee = referee;
      job.refereeAt = now;
      this.r.devices[referee]!.jobs++;
      this.send(referee, { t: "botWork", jobs: [{ id: job.id, fen: job.fen, n: this.s.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes }] });
      return false;
    }
    if (valid.length === 1) {
      if (!pending.length || now >= job.firstAt! + cfg.graceMs) return done(valid[0]!.top, "one");
      return false;
    }
    if (!pending.length || now >= job.sentAt + cfg.answerMs) return done(undefined, "fallback");
    return false;
  }

  /** The engine server's verdict on a job two devices disagreed about (null: it couldn't answer). */
  serverAnswered(id: string, moves: MoveScore[] | null) {
    const found = this.jobById(id);
    if (!found || found.job.how) return this.pump();
    const { lm, job } = found;
    const verdict = moves ? cleanTop(job.fen, [...moves].sort((a, b) => b.expected - a.expected), 8) ?? null : null;
    if (!verdict) {
      job.server = "failed";
      this.settle(lm, job);
    } else {
      const answers = job.devices.filter((d) => job.answers[d]).map((d) => ({ d, dist: distanceFromVerdict(job.answers[d]!, verdict) }));
      if (answers.length === 2 && Math.abs(answers[0]!.dist - answers[1]!.dist) > 0.01) {
        const far = answers[0]!.dist > answers[1]!.dist ? answers[0]! : answers[1]!;
        this.strike(far.d, `${job.id}: further from the engine server`);
      }
      job.how = "server";
      job.top = verdict;
      cacheTop(job.fen, verdict);
    }
    this.touch(lm);
    this.pump();
  }

  // ---------------- Views ----------------

  lobbyView(looks: "all" | string | null): NetSquadsLobby {
    const uid = (id: string) => this.r.accounts[id];
    const people = this.r.humans.map((h) => {
      const p = this.player(h.id);
      const withLook = (looks === "all" || looks === h.id) && h.look && Object.keys(h.look).length;
      return {
        id: h.id,
        name: h.name,
        isBot: false,
        connected: h.connected,
        partyId: h.partyId,
        botPlays: !!p && playsAsBot(p),
        ...(p?.replacedByBot ? { replaced: true as const } : {}),
        ...(h.left ? { left: true as const } : {}),
        misses: p?.misses ?? 0,
        ...(uid(h.id) ? { uid: uid(h.id) } : {}),
        ...(withLook ? { look: h.look } : {}),
      };
    });
    const bots = this.r.bots.map((b) => ({ id: b.id, name: b.name, isBot: true, connected: true, partyId: null, botPlays: true, misses: this.player(b.id)?.misses ?? 0 }));
    return {
      code: this.r.code,
      phase: this.r.phase,
      players: [...people, ...bots],
      seats: this.s.squadCount * this.s.squadSize,
      fillAt: this.r.fillAt,
      filledAt: this.r.filledAt,
      squads: this.r.squads.map((sq) => ({ id: sq.id, seats: sq.players.map((p) => p.id), placement: this.r.placed[sq.id] ?? null })),
      bracket: this.netBracket(),
      rules: this.r.rules,
      clocks: this.clocksView(),
      wallets: this.walletsView(),
      ...(this.r.test ? { test: { start: this.r.test.start, used: true } } : this.r.testUsed ? { test: { start: 0 as SquadsRound, used: true } } : {}),
    };
  }

  private netBracket(): NetBracketMatch[] {
    if (!this.r.bracket) return [];
    return this.r.bracket.flatMap((matches) =>
      matches.map((bm) => {
        const key = `r${bm.round}m${bm.index}`;
        const lm = this.matches.get(key);
        const state: NetBracketMatch["state"] = bm.winner !== null ? "over" : !lm ? "waiting" : lm.state === "break" && lm.seq === 0 ? "break" : "playing";
        const result = lm?.m.result;
        return {
          key,
          round: bm.round,
          index: bm.index,
          format: ROUND_FORMAT[bm.round],
          squads: [bm.squads[0], bm.squads[1]] as [number | null, number | null],
          winner: bm.winner,
          state,
          ...(state === "break" && lm?.startsAt ? { startsAt: lm.startsAt } : {}),
          ...(state === "over" && result ? { points: [result.points[0], result.points[1]] as [number, number], how: result.how } : {}),
        };
      }),
    );
  }

  private netDuty(lm: LiveMatch, d: Duty): NetDuty {
    return { board: d.board, side: d.side, role: d.role, players: [...d.players], deadline: lm.half!.startedAt + dutyDeadline(lm.half!.inputs, d, this.s) };
  }

  private netHalf(lm: LiveMatch): NetSquadsHalf | null {
    const half = lm.half;
    if (!half) return null;
    const duties = halfDuties(lm.m, this.s);
    return {
      seq: half.seq,
      turn: lm.m.turn,
      half: lm.m.half,
      startedAt: half.startedAt,
      duties: duties.duties.map((d) => this.netDuty(lm, d)),
      scouts: duties.scouts.map((d) => this.netDuty(lm, d)),
      forced: duties.forced,
      chips: (half.inputs.chips ?? []).map((c) => ({ ...c })),
    };
  }

  netMatch(lm: LiveMatch, withMoves: boolean): NetSquadsMatch {
    const m = lm.m;
    return {
      key: lm.key,
      round: lm.round,
      index: lm.index,
      format: m.format,
      armageddon: m.armageddon,
      sides: [
        { squadId: m.sides[0].squadId, seats: [...m.sides[0].seats] },
        { squadId: m.sides[1].squadId, seats: [...m.sides[1].seats] },
      ],
      boards: m.boards.map((b) => ({
        id: b.id,
        startFen: b.start.fen,
        openingId: b.start.openingId,
        fen: b.fen,
        ...(withMoves ? { moves: [...b.moves] } : {}),
        ply: b.moves.length,
        lastMove: b.moves[b.moves.length - 1] ?? null,
        white: b.white,
        result: b.result,
      })),
      turn: m.turn,
      half: m.half,
      incrementMs: m.incrementMs,
      capMs: m.capMs,
      state: lm.state,
      startsAt: lm.startsAt,
      current: lm.state === "half" ? this.netHalf(lm) : null,
      result: m.result,
      banks: [m.banks[0], m.banks[1]],
      delayMs: m.delayMs,
      tokens: m.tokens ? [m.tokens[0], m.tokens[1]] : null,
      blockBanks: [m.blockBanks[0], m.blockBanks[1]],
      blocks: m.blocks.map((b) => ({ ...b })),
      tokenLog: m.tokenLog.map((u) => ({ ...u, players: [...u.players], blocked: [...u.blocked] })),
      mode: m.mode,
      kit: m.kit ? [{ ...m.kit[0] }, { ...m.kit[1] }] : null,
      stockfish: [m.stockfish[0], m.stockfish[1]],
      shields: [m.shields[0], m.shields[1]],
      chips: [m.chips[0], m.chips[1]],
      assists: m.assists.map((a) => ({ ...a, shownTo: [...a.shownTo] })),
      coins: [m.coins[0], m.coins[1]],
      ...(lm.drawn ? { drawnFinal: { points: [lm.drawn.result!.points[0], lm.drawn.result!.points[1]] as [number, number], timeLeft: [lm.drawn.banks[0], lm.drawn.banks[1]] as [number, number] } } : {}),
      ...(lm.arm ? { armageddonChoice: { ...lm.arm } } : {}),
    };
  }

  /** A match as `id` may see it (their own squad's choices; the blocks placed this half, for everyone). */
  private matchMessage(lm: LiveMatch, id: string, withMoves: boolean): SquadsOutgoing {
    const half = lm.half;
    return {
      t: "match",
      match: this.netMatch(lm, withMoves),
      visible: half ? visibleChoices(lm.m, half.inputs, this.sideIn(lm, id), this.s) : {},
      locked: half ? Object.keys(half.inputs.locked).filter((p) => half.inputs.locked[p]) : [],
      placed: half ? placedBlocks(lm.m, half.inputs, this.s) : [],
      assisting: half ? placedAssists(lm.m, half.inputs, this.s) : [],
    };
  }
}
