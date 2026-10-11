import { SQUADS, type SquadsClock, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, fenAfter } from "../rules.ts";
import { pickOpenings, type Opening } from "../openings.ts";
import {
  blockCancelledByMate,
  boardPoints,
  colourToMove,
  decideByMaterial,
  isLegal,
  newSquadsBoard,
  otherSide,
  playOnBoard,
  randomLegalMove,
  sideOf,
  squadsLegalMoves,
  type BoardResult,
  type BoardStart,
  type Colour,
  type Side,
  type SquadsBoard,
} from "./board.ts";
import { ROUND_FORMAT, coin, squadsRng, type Squad, type SquadsFormat, type SquadsRound } from "./lobby.ts";
import { pairSchedule, relaySeat } from "./schedule.ts";
import type { SquadsRules } from "./votes.ts";

/**
 * One Squads match between two squads, in its round's format: Relay (round 1), Pairs (round 2) or Pick and Block
 * (the final), or the Armageddon board after a drawn final. Pure and replayable: every random draw comes from the
 * match's seed and the decision's name (`squadsRng`). No engine anywhere: legal moves and mate in one come from
 * chess.js; only the silent safety cap and the test-only "Next round" fall back on material.
 *
 * The clocks are the squads' team clocks: one bank per squad for the whole tournament (`Squad.bankMs`), brought into
 * the match (`banks`) and carried out of it (`settleTeamClocks`). A match is played in turns of two halves: every
 * board's White move, then every board's Black move (in the final, the White squad's move, then the Black squad's).
 * In each half the server collects choices (`choose`, `lockIn`) until everyone has locked in or the deadlines pass,
 * then `resolveHalf` plays the half with each player's thinking time:
 * - Each move being thought about drains its squad's bank past the free seconds (`delayMs`): a Relay mover, or a pair
 *   (the slower picker); the final's pickers drain it once, its blockers not at all. Two of a squad's moves being
 *   thought about at once drain it twice as fast.
 * - While the bank is above zero, the per-move ceiling bounds a move; if the bank runs out during the half, every
 *   move of that squad still being thought about is cut off. At zero it's sudden death: each move within the free
 *   seconds. A move not made in time is a missed action: a random legal move (a blocker forfeits). No flag falls.
 */

/** A squad in a match: its id and its players' ids in seat order. */
export interface Lineup {
  squadId: number;
  seats: readonly string[];
}

export interface MatchResult {
  /** The winning side; null only for a drawn final (Armageddon decides). */
  winner: Side | null;
  points: readonly [number, number];
  /**
   * clinch: passed half the points with boards still going; boards: won on points with every board finished; time:
   * level on points, more team bank left (rounds 1 and 2); coin: level on points and bank; armageddon: the Armageddon
   * board; admin: the test-only "Next round".
   */
  how: "clinch" | "boards" | "time" | "coin" | "armageddon" | "admin";
  /** Each side's team bank left (ms), when it decided a tie. */
  timeLeft?: readonly [number, number];
}

export interface SquadsMatch {
  /** Names the match for its random draws: "r0m2" (round 1, match 3), "r2m0-armageddon". */
  key: string;
  seed: number;
  round: SquadsRound;
  format: SquadsFormat;
  sides: readonly [Lineup, Lineup];
  boards: readonly SquadsBoard[];
  /** The turn being played (from 0) and its half: "w" (White moves) or "b". */
  turn: number;
  half: Colour;
  /** One board where Black has draw odds and White more time (fixed clocks, not the team banks). */
  armageddon: boolean;
  /** Each side's team bank (ms); 0 is sudden death. */
  banks: readonly [number, number];
  /** Free time every move before a bank drains (ms); in sudden death, the time to make each move. */
  delayMs: number;
  /** Credited to a squad's bank after each move it made in time (ms). */
  incrementMs: number;
  /** The silent safety cap, in moves per side. */
  safetyMoves: number;
  result: MatchResult | null;
}

// ---- Starting positions ----

export const STANDARD_START: BoardStart = { fen: START_FEN, openingId: null };

/** An opening from the library as a board's start, `openingMoves` moves per side in (White to move). */
export function openingStart(o: Opening, s: SquadsSettings = SQUADS): BoardStart {
  return { fen: fenAfter(o.moves.slice(0, 2 * s.openingMoves)), openingId: o.id };
}

/** `count` different balanced openings (classic lines, distinct families where the library allows). */
export function drawOpenings(library: readonly Opening[], count: number, rng: () => number, s: SquadsSettings = SQUADS): BoardStart[] {
  const picked = pickOpenings(rng, library, { classic: count, unusual: 0 }, 2 * s.openingMoves, s.openingBalance);
  if (picked.length < count) throw new Error("Not enough openings in the library");
  return picked.slice(0, count).map((o) => openingStart(o, s));
}

/** What a lobby decided before round 1: its seed, the votes' rules, and its one opening (Start: "same opening"). */
export interface SquadsPlan {
  seed: number;
  rules: SquadsRules;
  start: BoardStart | null;
}

/** The lobby's plan: with "same opening", the one opening every board starts from is drawn now. */
export function planLobby(seed: number, rules: SquadsRules, library: readonly Opening[], s: SquadsSettings = SQUADS): SquadsPlan {
  return { seed, rules, start: rules.start === "same" ? drawOpenings(library, 1, squadsRng(seed, "lobby-opening"), s)[0]! : null };
}

/**
 * Each board's start and White side for a match of `boards` boards. Side 0 is White on boards 1 and 3, side 1 on
 * boards 2 and 4 (so every Relay player alternates colours turn by turn; in Pairs each squad is White on one board).
 * Random openings: each opening is played on two boards, colours swapped (boards 1-2, 3-4). One board (the final):
 * a coin gives White.
 */
export function matchStarts(plan: SquadsPlan, key: string, boards: number, library: readonly Opening[], s: SquadsSettings = SQUADS): { starts: BoardStart[]; whites: Side[] } {
  const whites: Side[] = boards === 1 ? [coin(squadsRng(plan.seed, key, "white"))] : Array.from({ length: boards }, (_, k) => (k % 2) as Side);
  const rule = plan.rules.start;
  if (rule === "standard") return { starts: Array(boards).fill(STANDARD_START), whites };
  if (rule === "same") return { starts: Array(boards).fill(plan.start ?? STANDARD_START), whites };
  const openings = drawOpenings(library, Math.ceil(boards / 2), squadsRng(plan.seed, key, "openings"), s);
  return { starts: Array.from({ length: boards }, (_, k) => openings[k >> 1]!), whites };
}

export interface MatchSetup {
  key: string;
  seed: number;
  round: SquadsRound;
  format: SquadsFormat;
  sides: readonly [Lineup, Lineup];
  starts: readonly BoardStart[];
  whites: readonly Side[];
  /** Each side's team bank coming in (ms), the free time a move and the increment (ms). */
  banksMs: readonly [number, number];
  delayMs: number;
  incrementMs: number;
  armageddon?: boolean;
}

export function createSquadsMatch(o: MatchSetup, s: SquadsSettings = SQUADS): SquadsMatch {
  if (o.starts.length !== o.whites.length || !o.starts.length) throw new Error("One start and one White side per board");
  for (const st of o.starts) if (colourToMove(st) !== "w") throw new Error("Every board starts with White to move");
  return {
    key: o.key,
    seed: o.seed,
    round: o.round,
    format: o.format,
    sides: o.sides,
    boards: o.starts.map((st, k) => newSquadsBoard(k, st, o.whites[k]!)),
    turn: 0,
    half: "w",
    armageddon: !!o.armageddon,
    banks: [Math.max(0, o.banksMs[0]), Math.max(0, o.banksMs[1])],
    delayMs: o.delayMs,
    incrementMs: o.incrementMs,
    safetyMoves: s.safetyCap,
    result: null,
  };
}

/** A squad's lineup: its id and players in seat order. */
export const lineupOf = (sq: Squad): Lineup => ({ squadId: sq.id, seats: sq.players.map((p) => p.id) });

// ---- Team clocks across the tournament ----

/** Every squad's team bank at the start of the tournament, from the voted Clock option. */
export function startTeamClocks(squads: readonly Squad[], clock: SquadsClock): Squad[] {
  return squads.map((sq) => ({ ...sq, bankMs: clock.bankSeconds * 1000 }));
}

/** After a match, its squads carry what's left of their banks into the next round (Armageddon's fixed clocks aside). */
export function settleTeamClocks(squads: readonly Squad[], m: SquadsMatch): Squad[] {
  if (m.armageddon) return [...squads];
  return squads.map((sq) => {
    const side = m.sides.findIndex((l) => l.squadId === sq.id);
    return side < 0 ? sq : { ...sq, bankMs: m.banks[side as Side] };
  });
}

/** What every player sees beside each squad's name: its bank, and whether it's in sudden death. */
export interface TeamClock {
  squadId: number;
  bankMs: number;
  suddenDeath: boolean;
}

/** Every squad's team clock in the lobby (between matches, or for squads not playing). */
export function teamClocks(squads: readonly Squad[]): TeamClock[] {
  return squads.map((sq) => ({ squadId: sq.id, bankMs: sq.bankMs, suddenDeath: sq.bankMs <= 0 }));
}

/** The two squads' clocks in a match, as they stand (live during the match). */
export function matchClocks(m: SquadsMatch): [TeamClock, TeamClock] {
  const one = (side: Side): TeamClock => ({ squadId: m.sides[side].squadId, bankMs: m.banks[side], suddenDeath: m.banks[side] <= 0 });
  return [one(0), one(1)];
}

/**
 * A bracket match ready to play: round 1 Relay on 4 boards, round 2 Pairs on 2, the final on 1. Each squad brings its
 * team bank, topped up if this is a later round (it advanced).
 */
export function planMatch(plan: SquadsPlan, round: SquadsRound, index: number, squads: readonly [Squad, Squad], library: readonly Opening[], s: SquadsSettings = SQUADS): SquadsMatch {
  const format = ROUND_FORMAT[round];
  const key = `r${round}m${index}`;
  const { starts, whites } = matchStarts(plan, key, s.boards[format], library, s);
  const c = plan.rules.clock;
  const topUp = round > 0 ? c.topUpSeconds * 1000 : 0;
  return createSquadsMatch(
    {
      key,
      seed: plan.seed,
      round,
      format,
      sides: [lineupOf(squads[0]), lineupOf(squads[1])],
      starts,
      whites,
      banksMs: [squads[0].bankMs + topUp, squads[1].bankMs + topUp],
      delayMs: c.delaySeconds * 1000,
      incrementMs: c.incrementSeconds * 1000,
    },
    s,
  );
}

// ---- Who acts this half ----

export type Role = "move" | "pick" | "block";

export interface Duty {
  board: number;
  side: Side;
  role: Role;
  /** One player (a Relay move) or two (a pair's picks, the final's pickers or blockers). */
  players: readonly string[];
  /**
   * How long they have (ms): the per-move ceiling; for moves and picks in sudden death (the squad's bank at zero), the
   * free seconds. (A bank running out during the half cuts its moves off sooner: see `resolveHalf`.)
   */
  deadlineMs: number;
}

export interface HalfDuties {
  duties: Duty[];
  /** Whoever's turn it would be on a finished board: they sit this half out (and scout). */
  scouts: Duty[];
  /** The final's mercy rule: no blocks this move (the side to move has few legal moves). */
  mercy: "few_moves" | null;
  /** Boards whose side to move has only one legal move: it plays itself (Pairs and the final). */
  forced: number[];
}

const seatsOf = (m: SquadsMatch, side: Side, seats: readonly number[]) => seats.map((i) => m.sides[side].seats[i]!);

/** Who acts in the half being played, board by board, and their deadlines. */
export function halfDuties(m: SquadsMatch, s: SquadsSettings = SQUADS): HalfDuties {
  const out: HalfDuties = { duties: [], scouts: [], mercy: null, forced: [] };
  if (m.result) return out;
  const n = m.boards.length;
  const ceiling = s.moveCeilingSeconds * 1000;
  const deadline = (side: Side) => (m.banks[side] > 0 ? ceiling : m.delayMs);
  for (const b of m.boards) {
    const side = sideOf(b, m.half);
    const deadlineMs = deadline(side);
    if (m.format === "relay") {
      const duty: Duty = { board: b.id, side, role: "move", players: seatsOf(m, side, [relaySeat(n, b.id, m.turn)]), deadlineMs };
      (b.result ? out.scouts : out.duties).push(duty);
      continue;
    }
    const [slot0, slot1] = pairSchedule(m.turn);
    if (m.format === "pairs") {
      const duty: Duty = { board: b.id, side, role: "pick", players: seatsOf(m, side, n === 1 ? slot0 : b.id === 0 ? slot0 : slot1), deadlineMs };
      if (b.result) out.scouts.push(duty);
      else if (squadsLegalMoves(b.fen).length === 1) out.forced.push(b.id);
      else out.duties.push(duty);
      continue;
    }
    // The final: the side to move's slot-0 pair picks; the other squad's slot-1 pair blocks.
    if (b.result) continue;
    const legal = squadsLegalMoves(b.fen).length;
    if (legal === 1) {
      out.forced.push(b.id);
      continue;
    }
    out.duties.push({ board: b.id, side, role: "pick", players: seatsOf(m, side, slot0), deadlineMs });
    if (legal <= s.final.noBlocksAtMoves) out.mercy = "few_moves";
    else out.duties.push({ board: b.id, side: otherSide(side), role: "block", players: seatsOf(m, otherSide(side), slot1), deadlineMs: ceiling });
  }
  return out;
}

/** A player's duty this half, and their partner (Pairs, the final), if any. */
export function dutyOf(m: SquadsMatch, playerId: string, s: SquadsSettings = SQUADS): { duty: Duty; partner: string | null } | null {
  for (const duty of halfDuties(m, s).duties) {
    const i = duty.players.indexOf(playerId);
    if (i >= 0) return { duty, partner: duty.players[1 - i] ?? null };
  }
  return null;
}

// ---- Choices during a half ----

/** What players have chosen so far this half (a move, a pick or a block), and who has locked in. */
export interface HalfInputs {
  choices: Readonly<Record<string, string>>;
  locked: Readonly<Record<string, boolean>>;
}

export const NO_INPUTS: HalfInputs = { choices: {}, locked: {} };

export type ChoiceError = "match_over" | "no_duty" | "illegal" | "taken_by_partner" | "already_moved";

/**
 * A player chooses during the half. Relay: their move (made once, locked at once). Pairs and the final: a pick or
 * a block, which can change until the half ends (a change unlocks it); never the move their partner has chosen.
 */
export function choose(m: SquadsMatch, inputs: HalfInputs, playerId: string, move: string, s: SquadsSettings = SQUADS): { inputs: HalfInputs } | { error: ChoiceError } {
  if (m.result) return { error: "match_over" };
  const d = dutyOf(m, playerId, s);
  if (!d) return { error: "no_duty" };
  if (!isLegal(m.boards[d.duty.board]!.fen, move)) return { error: "illegal" };
  if (d.duty.role === "move") {
    if (inputs.choices[playerId]) return { error: "already_moved" };
    return { inputs: { choices: { ...inputs.choices, [playerId]: move }, locked: { ...inputs.locked, [playerId]: true } } };
  }
  if (d.partner && inputs.choices[d.partner] === move) return { error: "taken_by_partner" };
  return { inputs: { choices: { ...inputs.choices, [playerId]: move }, locked: { ...inputs.locked, [playerId]: false } } };
}

/** A player locks in their current choice (nothing to lock without one). */
export function lockIn(inputs: HalfInputs, playerId: string): HalfInputs {
  if (!inputs.choices[playerId] || inputs.locked[playerId]) return inputs;
  return { ...inputs, locked: { ...inputs.locked, [playerId]: true } };
}

/** Whether the half can be resolved before its deadlines: everyone with a duty has locked in. */
export function halfReady(m: SquadsMatch, inputs: HalfInputs, s: SquadsSettings = SQUADS): boolean {
  return halfDuties(m, s).duties.every((d) => d.players.every((p) => inputs.locked[p]));
}

/**
 * The choices a viewer sees live (a squad's member: their side; a spectator: null). Relay and Pairs: only their own
 * squad's. The final: blocks and picks as the settings say (Eric, Oct 10: blocks to everyone as red arrows, picks to
 * the picking squad only).
 */
export function visibleChoices(m: SquadsMatch, inputs: HalfInputs, viewer: Side | null, s: SquadsSettings = SQUADS): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of halfDuties(m, s).duties) {
    const own = viewer === d.side;
    const seen = m.format !== "final" ? own : (d.role === "block" ? s.final.blocksSeenBy : s.final.picksSeenBy) === "everyone" || own;
    if (!seen) continue;
    for (const p of d.players) if (inputs.choices[p]) out[p] = inputs.choices[p]!;
  }
  return out;
}

// ---- Playing a half ----

export type SquadsEvent =
  | { kind: "relay"; turn: number; half: Colour; board: number; side: Side; player: string; move: string; missed: boolean }
  | {
      kind: "pair";
      turn: number;
      half: Colour;
      board: number;
      side: Side;
      players: readonly string[];
      /** The two picks as played (a missed slot holds its random move). */
      picks: readonly [string, string];
      missed: readonly [boolean, boolean];
      /** Which pick the coin played. */
      coin: 0 | 1;
      move: string;
    }
  | {
      kind: "pickblock";
      turn: number;
      half: Colour;
      board: number;
      /** The picking side (the side to move). */
      side: Side;
      pickers: readonly string[];
      /** Empty when the mercy rule took the blocks away. */
      blockers: readonly string[];
      picks: readonly [string, string];
      pickMissed: readonly [boolean, boolean];
      /** A forfeited block is null. */
      blocks: readonly [string | null, string | null];
      blockMissed: readonly [boolean, boolean];
      mercy: "few_moves" | null;
      /** Which block the coin made active (null: no blocks this move). */
      active: 0 | 1 | null;
      /** The active block was cancelled: every other legal move allows mate in one. */
      cancelled: boolean;
      /** Which pick the active block hit (the other one played); null if it hit neither. */
      hit: 0 | 1 | null;
      /** Which pick the coin played, when the block hit neither; null otherwise. */
      coin: 0 | 1 | null;
      move: string;
    }
  | { kind: "forced"; turn: number; half: Colour; board: number; side: Side; move: string }
  | { kind: "scout"; turn: number; half: Colour; board: number; side: Side; players: readonly string[] }
  /** A squad's team bank this half: how much its moves drained, what's left (after any increment), sudden death. */
  | { kind: "bank"; turn: number; half: Colour; side: Side; drainedMs: number; leftMs: number; suddenDeath: boolean }
  /** A squad's bank ran out: from now on each of its moves must be made within the free seconds. */
  | { kind: "sudden_death"; turn: number; half: Colour; side: Side }
  | { kind: "board_end"; board: number; result: BoardResult }
  | { kind: "match_end"; result: MatchResult };

export interface HalfOutcome {
  match: SquadsMatch;
  events: SquadsEvent[];
  /** Players who acted, and who missed (for each player's record: `noteActions`). */
  acted: string[];
  missed: string[];
  /**
   * Of `missed`, those who weren't absent but out of time: in sudden death, or cut off when their squad's bank ran
   * out. (A slow move under pressure isn't a no-show: leave these out of the no-show streak if you like.)
   */
  timeouts: string[];
}

/**
 * Plays the half being played, from the choices as they stand (everyone locked in, or the deadlines passed).
 * `thinkMs` is each player's thinking time up to their last choice; a player without one ran to their deadline.
 */
export function resolveHalf(m: SquadsMatch, inputs: HalfInputs, thinkMs: Readonly<Record<string, number>> = {}, s: SquadsSettings = SQUADS): HalfOutcome {
  if (m.result) throw new Error(`Match ${m.key} is over`);
  const duties = halfDuties(m, s);
  const ctx: Ctx = { m, s, inputs, thinkMs, boards: [...m.boards], banks: [...m.banks], events: [], acted: [], missed: [], timeouts: [], cutoff: [Infinity, Infinity], earned: [0, 0] };
  for (const side of [0, 1] as const) drainBank(ctx, side, duties.duties.filter((d) => d.side === side && d.role !== "block"));
  for (const d of duties.scouts) ctx.events.push({ kind: "scout", turn: m.turn, half: m.half, board: d.board, side: d.side, players: d.players });
  for (const id of duties.forced) {
    const b = m.boards[id]!;
    const move = squadsLegalMoves(b.fen)[0]!;
    ctx.events.push({ kind: "forced", turn: m.turn, half: m.half, board: id, side: sideOf(b, m.half), move });
    play(ctx, id, move);
  }
  for (const d of duties.duties) {
    if (d.role === "move") relayMove(ctx, d);
    else if (m.format === "pairs") pairMove(ctx, d);
    else if (d.role === "pick") pickAndBlock(ctx, d, duties.duties.find((x) => x.role === "block") ?? null, duties.mercy);
  }
  for (const side of [0, 1] as const) {
    if (!ctx.earned[side] || !m.incrementMs) continue;
    ctx.banks[side] += ctx.earned[side] * m.incrementMs;
  }
  for (const e of ctx.events) {
    if (e.kind !== "bank") continue;
    e.leftMs = ctx.banks[e.side];
    e.suddenDeath = ctx.banks[e.side] <= 0;
  }
  return afterHalf(ctx);
}

interface Ctx {
  m: SquadsMatch;
  s: SquadsSettings;
  inputs: HalfInputs;
  thinkMs: Readonly<Record<string, number>>;
  boards: SquadsBoard[];
  banks: [number, number];
  events: SquadsEvent[];
  acted: string[];
  missed: string[];
  timeouts: string[];
  /** Each side's moves this half count only if made by this time (ms): the ceiling, its bank running out, or the free seconds. */
  cutoff: [number, number];
  /** Moves each side made in time this half (each earns the increment). */
  earned: [number, number];
}

const rngFor = (c: Ctx, board: number, what: string) => squadsRng(c.m.seed, c.m.key, c.m.turn, c.m.half, board, what);

/**
 * When a bank of `bankMs` runs out, if moves ending at `ends` (ms from the half's start) each drain it past `delayMs`
 * at the same time: the moment, or Infinity if it lasts.
 */
export function bankRunsOut(ends: readonly number[], delayMs: number, bankMs: number): number {
  let t = delayMs;
  let left = bankMs;
  const sorted = ends.filter((e) => e > delayMs).sort((a, b) => a - b);
  let draining = sorted.length;
  for (const end of sorted) {
    const span = (end - t) * draining;
    if (span >= left) return t + left / draining;
    left -= span;
    t = end;
    draining--;
  }
  return Infinity;
}

/**
 * A squad's bank this half. Each of its moves (a Relay mover, a pair, the final's pickers) drains it from the free
 * seconds until the move is made (its slower player), or to the ceiling if one of them never chose; several at once
 * drain it together. If it runs out, moves not yet made are cut off; at zero (sudden death) each move has only the
 * free seconds.
 */
function drainBank(c: Ctx, side: Side, duties: readonly Duty[]) {
  const { m, s } = c;
  if (!duties.length) return;
  const bank = c.banks[side];
  const ceiling = s.moveCeilingSeconds * 1000;
  if (bank <= 0) {
    c.cutoff[side] = m.delayMs;
    c.events.push({ kind: "bank", turn: m.turn, half: m.half, side, drainedMs: 0, leftMs: 0, suddenDeath: true });
    return;
  }
  const ends = duties.map((d) => {
    const fen = c.boards[d.board]!.fen;
    const all = d.players.every((p) => {
      const mv = c.inputs.choices[p];
      return !!mv && isLegal(fen, mv) && (c.thinkMs[p] ?? 0) <= ceiling;
    });
    return all ? Math.max(0, ...d.players.map((p) => c.thinkMs[p] ?? 0)) : ceiling;
  });
  const out = bankRunsOut(ends, m.delayMs, bank);
  const drained = ends.reduce((t, e) => t + Math.max(0, Math.min(e, out) - m.delayMs), 0);
  c.banks[side] = out === Infinity ? bank - drained : 0;
  c.cutoff[side] = Math.min(ceiling, out);
  c.events.push({ kind: "bank", turn: m.turn, half: m.half, side, drainedMs: Math.min(bank, drained), leftMs: c.banks[side], suddenDeath: c.banks[side] <= 0 });
  if (c.banks[side] <= 0) c.events.push({ kind: "sudden_death", turn: m.turn, half: m.half, side });
}

/**
 * A player's choice if it's legal here and made in time, else null (a miss); logs them as acting, missing, or out of
 * time. Blockers aren't on the clock: they have the ceiling.
 */
function take(c: Ctx, player: string, fen: string, side: Side, clocked: boolean): string | null {
  const move = c.inputs.choices[player];
  const chose = !!move && isLegal(fen, move);
  const limit = clocked ? c.cutoff[side] : c.s.moveCeilingSeconds * 1000;
  const inTime = chose && (c.thinkMs[player] ?? 0) <= limit;
  if (inTime) c.acted.push(player);
  else {
    c.missed.push(player);
    if (chose && clocked) c.timeouts.push(player);
    else if (clocked && (c.m.banks[side] <= 0 || c.cutoff[side] < c.s.moveCeilingSeconds * 1000)) c.timeouts.push(player);
  }
  return inTime ? move! : null;
}

function play(c: Ctx, board: number, move: string) {
  const b = c.boards[board]!;
  if (colourToMove(b) !== c.m.half) throw new Error(`Board ${board} is out of step with the half`);
  const next = playOnBoard(b, move);
  c.boards[board] = next;
  if (next.result) c.events.push({ kind: "board_end", board, result: next.result });
}

function relayMove(c: Ctx, d: Duty) {
  const b = c.boards[d.board]!;
  const player = d.players[0]!;
  const chosen = take(c, player, b.fen, d.side, true);
  const move = chosen ?? randomLegalMove(b.fen, rngFor(c, d.board, "miss"));
  c.events.push({ kind: "relay", turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, player, move, missed: !chosen });
  if (chosen || c.s.incrementOnMiss) c.earned[d.side]++;
  play(c, d.board, move);
}

/** Two picks, always different: a missed slot becomes a random legal move other than the partner's. */
function twoPicks(c: Ctx, d: Duty, fen: string, p0: string | null, p1In: string | null): { picks: [string, string]; missed: [boolean, boolean] } {
  // (The inputs never allow it, but two equal picks can't both stand: the second slot is then a miss.)
  const p1 = p1In !== null && p1In === p0 ? null : p1In;
  const m0 = p0 ?? randomLegalMove(fen, rngFor(c, d.board, "miss-0"), p1 ? [p1] : []);
  const m1 = p1 ?? randomLegalMove(fen, rngFor(c, d.board, "miss-1"), [m0]);
  return { picks: [m0, m1], missed: [!p0, !p1] };
}

function pairMove(c: Ctx, d: Duty) {
  const fen = c.boards[d.board]!.fen;
  const chosen = [take(c, d.players[0]!, fen, d.side, true), take(c, d.players[1]!, fen, d.side, true)] as const;
  const { picks, missed } = twoPicks(c, d, fen, chosen[0], chosen[1]);
  const flip = coin(rngFor(c, d.board, "coin"));
  const move = picks[flip];
  c.events.push({ kind: "pair", turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, players: d.players, picks, missed, coin: flip, move });
  if (!missed.some(Boolean) || c.s.incrementOnMiss) c.earned[d.side]++;
  play(c, d.board, move);
}

/**
 * The final's move: two different picks; two different blocks (or none: the mercy rule); a coin makes one block
 * active (an empty slot blocks nothing); a block is cancelled if every other legal move allows mate in one. If the
 * active block hits a pick the other pick plays, otherwise a coin chooses between the picks. The pickers' squad's bank
 * drains while they choose; blockers have the per-move ceiling and drain nothing.
 */
function pickAndBlock(c: Ctx, pick: Duty, block: Duty | null, mercy: "few_moves" | null) {
  const fen = c.boards[pick.board]!.fen;
  const chosen = [take(c, pick.players[0]!, fen, pick.side, true), take(c, pick.players[1]!, fen, pick.side, true)] as const;
  let blocks: [string | null, string | null] = [null, null];
  let blockMissed: [boolean, boolean] = [false, false];
  if (block) {
    const b0 = take(c, block.players[0]!, fen, block.side, false);
    let b1 = take(c, block.players[1]!, fen, block.side, false);
    if (b1 !== null && b1 === b0) b1 = null;
    blocks = [b0, b1];
    blockMissed = [!b0, !b1];
  }
  const { picks, missed: pickMissed } = twoPicks(c, pick, fen, chosen[0], chosen[1]);
  const blockCoin = coin(rngFor(c, pick.board, "block-coin"));
  const pickCoin = coin(rngFor(c, pick.board, "pick-coin"));
  const active = block ? blockCoin : null;
  const activeMove = active === null ? null : blocks[active];
  const cancelled = !!activeMove && c.s.final.cancelBlockBeforeMate && blockCancelledByMate(fen, activeMove);
  const effective = cancelled ? null : activeMove;
  const hit: 0 | 1 | null = effective === null ? null : effective === picks[0] ? 0 : effective === picks[1] ? 1 : null;
  const move = hit === 0 ? picks[1] : hit === 1 ? picks[0] : picks[pickCoin];
  c.events.push({
    kind: "pickblock",
    turn: c.m.turn,
    half: c.m.half,
    board: pick.board,
    side: pick.side,
    pickers: pick.players,
    blockers: block?.players ?? [],
    picks,
    pickMissed,
    blocks,
    blockMissed,
    mercy,
    active,
    cancelled,
    hit,
    coin: hit === null ? pickCoin : null,
    move,
  });
  if (!pickMissed.some(Boolean) || c.s.incrementOnMiss) c.earned[pick.side]++;
  play(c, pick.board, move);
}

/** After a half: the safety cap (decided by material), the result, the next half. */
function afterHalf(c: Ctx): HalfOutcome {
  const { m, s } = c;
  c.boards = c.boards.map((b) => {
    if (b.result || b.moves.length < 2 * m.safetyMoves) return b;
    const done = decideByMaterial(b, "safety_cap", s);
    c.events.push({ kind: "board_end", board: b.id, result: done.result! });
    return done;
  });
  const banks: [number, number] = [Math.max(0, c.banks[0]), Math.max(0, c.banks[1])];
  const result = matchResultOf({ ...m, boards: c.boards, banks }, s);
  if (result) c.events.push({ kind: "match_end", result });
  const match: SquadsMatch = { ...m, boards: c.boards, banks, turn: m.half === "b" ? m.turn + 1 : m.turn, half: m.half === "w" ? "b" : "w", result };
  return { match, events: c.events, acted: c.acted, missed: c.missed, timeouts: c.timeouts };
}

/** Each side's points from the finished boards (a win 1, a draw ½). */
export function matchPoints(boards: readonly SquadsBoard[], s: SquadsSettings = SQUADS): [number, number] {
  const pts: [number, number] = [0, 0];
  for (const b of boards) for (const side of [0, 1] as const) pts[side] += boardPoints(b, side, s) ?? 0;
  return pts;
}

/** A level match (rounds 1 and 2): more team bank left wins; exactly level, a seeded coin. */
function tiebreak(m: Pick<SquadsMatch, "seed" | "key" | "banks">, points: readonly [number, number], admin: boolean): MatchResult {
  const left = m.banks;
  if (left[0] !== left[1]) return { winner: left[0] > left[1] ? 0 : 1, points, how: admin ? "admin" : "time", timeLeft: [left[0], left[1]] };
  return { winner: coin(squadsRng(m.seed, m.key, "tiebreak")), points, how: admin ? "admin" : "coin", timeLeft: [left[0], left[1]] };
}

/**
 * The match's result, if it's decided. A squad with more than half the points has won (clinched, if boards are
 * still going: the match ends at once). Every board finished and level: in rounds 1 and 2, the squad with more team
 * bank left (a coin if exactly level); a drawn final has no winner yet (Armageddon). Armageddon: a draw is Black's.
 */
export function matchResultOf(m: Pick<SquadsMatch, "seed" | "key" | "format" | "armageddon" | "boards" | "banks">, s: SquadsSettings = SQUADS): MatchResult | null {
  const { boards } = m;
  const points = matchPoints(boards, s);
  if (m.armageddon) {
    const b = boards[0]!;
    if (!b.result) return null;
    return { winner: b.result.winner === "w" ? b.white : otherSide(b.white), points, how: "armageddon" };
  }
  const all = boards.every((b) => b.result);
  for (const side of [0, 1] as const) {
    if (points[side] > (boards.length * s.winPoints) / 2) return { winner: side, points, how: all ? "boards" : "clinch" };
  }
  if (!all) return null;
  return m.format === "final" ? { winner: null, points, how: "boards" } : tiebreak(m, points, false);
}

// ---- A drawn final: Armageddon ----

/** The side that picks Armageddon's colours: the one with more team bank left after the final (a coin if level). */
export function armageddonChooser(final: SquadsMatch): Side {
  if (final.banks[0] !== final.banks[1]) return final.banks[0] > final.banks[1] ? 0 : 1;
  return coin(squadsRng(final.seed, final.key, "armageddon-chooser"));
}

/** Armageddon's board starts as the lobby's Start vote says (random openings: a fresh one). */
export function armageddonStart(plan: SquadsPlan, final: Pick<SquadsMatch, "key">, library: readonly Opening[], s: SquadsSettings = SQUADS): BoardStart {
  if (plan.rules.start === "standard") return STANDARD_START;
  if (plan.rules.start === "same") return plan.start ?? STANDARD_START;
  return drawOpenings(library, 1, squadsRng(plan.seed, final.key, "armageddon-opening"), s)[0]!;
}

/**
 * One Armageddon board for a drawn final, in the final's format, on its own fixed clocks (`SQUADS.armageddon`: White
 * more, Black less, played by team-clock rules with the lobby's free seconds): Black has draw odds. `white` is the side
 * the chooser gave White.
 */
export function startArmageddon(final: SquadsMatch, white: Side, start: BoardStart, s: SquadsSettings = SQUADS): SquadsMatch {
  if (final.format !== "final" || final.armageddon || !final.result || final.result.winner !== null) throw new Error(`Match ${final.key} isn't a drawn final`);
  const banks: [number, number] = [0, 0];
  banks[white] = s.armageddon.whiteSeconds * 1000;
  banks[otherSide(white)] = s.armageddon.blackSeconds * 1000;
  return createSquadsMatch(
    {
      key: `${final.key}-armageddon`,
      seed: final.seed,
      round: final.round,
      format: "final",
      sides: final.sides,
      starts: [start],
      whites: [white],
      banksMs: banks,
      delayMs: final.delayMs,
      incrementMs: s.armageddon.incrementSeconds * 1000,
      armageddon: true,
    },
    s,
  );
}

// ---- Test-only: "Next round" ----

/**
 * The admin/test "Next round" button: every board still going is decided by material and the match ends. A level
 * result is settled like a round 1 or 2 tie (more team bank left, then a coin), so the bracket can move on.
 */
export function endByMaterial(m: SquadsMatch, s: SquadsSettings = SQUADS): { match: SquadsMatch; events: SquadsEvent[] } {
  if (m.result) return { match: m, events: [] };
  const events: SquadsEvent[] = [];
  const boards = m.boards.map((b) => {
    if (b.result) return b;
    const done = decideByMaterial(b, "admin", s);
    events.push({ kind: "board_end", board: b.id, result: done.result! });
    return done;
  });
  const decided = matchResultOf({ ...m, boards }, s)!;
  const result: MatchResult = decided.winner !== null ? { ...decided, how: "admin" } : tiebreak(m, decided.points, true);
  events.push({ kind: "match_end", result });
  return { match: { ...m, boards, result }, events };
}

/** The winning squad's id. */
export const winnerSquad = (m: SquadsMatch): number | null => (m.result?.winner == null ? null : m.sides[m.result.winner].squadId);
