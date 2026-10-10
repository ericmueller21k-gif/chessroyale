import { SQUADS, type SquadsSettings } from "@chessroyale/core";
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
 * (the final), or an Armageddon board when one of those ties. Pure and replayable: every random draw comes from the
 * match's seed and the decision's name (`squadsRng`). No engine anywhere: legal moves and mate in one come from
 * chess.js, and a capped board is decided by material.
 *
 * A match is played in turns of two halves: every board's White move, then every board's Black move (in the final,
 * the White squad's move, then the Black squad's). In each half the server collects choices (`choose`, `lock`) until
 * everyone has locked in or the clock runs out, then `resolveHalf` plays the half: a missed move or pick becomes a
 * random legal move, a missed block is forfeited, and everything is logged as events.
 */

/** A squad in a match: its id and its players' ids in seat order. */
export interface Lineup {
  squadId: number;
  seats: readonly string[];
}

export interface MatchResult {
  /** The winning side; null for a tie (Armageddon decides). */
  winner: Side | null;
  points: readonly [number, number];
  /**
   * clinch: passed half the points with boards still going; boards: every board finished; armageddon: the Armageddon
   * board; admin: the test-only "Next round".
   */
  how: "clinch" | "boards" | "armageddon" | "admin";
}

export interface SquadsMatch {
  /** Names the match for its random draws: "r0m2" (round 1, match 3), "r0m2-armageddon". */
  key: string;
  seed: number;
  round: SquadsRound;
  format: SquadsFormat;
  sides: readonly [Lineup, Lineup];
  boards: readonly SquadsBoard[];
  /** The turn being played (from 0) and its half: "w" (White moves) or "b". */
  turn: number;
  half: Colour;
  /** One board where White must win: a draw counts for Black. */
  armageddon: boolean;
  /** The move cap (moves per side in this match; null: to the end) and the silent safety cap. */
  capMoves: number | null;
  safetyMoves: number;
  /** The clock for each half, about this many seconds. */
  paceSeconds: number;
  /** Each side's total thinking time (ms): a missed action counts the whole clock. Picks Armageddon's colours. */
  thinkMs: readonly [number, number];
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
  capMoves: number | null;
  paceSeconds: number;
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
    capMoves: o.capMoves,
    safetyMoves: s.safetyCap,
    paceSeconds: o.paceSeconds,
    thinkMs: [0, 0],
    result: null,
  };
}

/** A squad's lineup: its id and players in seat order. */
export const lineupOf = (sq: Squad): Lineup => ({ squadId: sq.id, seats: sq.players.map((p) => p.id) });

/**
 * A bracket match ready to play: round 1 Relay on 4 boards, round 2 Pairs on 2, the final on 1. The Length vote's
 * cap applies to rounds 1 and 2; the final is always played to the end (the safety cap still guards it).
 */
export function planMatch(plan: SquadsPlan, round: SquadsRound, index: number, squads: readonly [Squad, Squad], library: readonly Opening[], s: SquadsSettings = SQUADS): SquadsMatch {
  const format = ROUND_FORMAT[round];
  const key = `r${round}m${index}`;
  const { starts, whites } = matchStarts(plan, key, s.boards[format], library, s);
  return createSquadsMatch(
    {
      key,
      seed: plan.seed,
      round,
      format,
      sides: [lineupOf(squads[0]), lineupOf(squads[1])],
      starts,
      whites,
      capMoves: round < 2 && plan.rules.length === "cap" ? s.moveCap : null,
      paceSeconds: plan.rules.paceSeconds,
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

/** Who acts in the half being played, board by board. */
export function halfDuties(m: SquadsMatch, s: SquadsSettings = SQUADS): HalfDuties {
  const out: HalfDuties = { duties: [], scouts: [], mercy: null, forced: [] };
  if (m.result) return out;
  const n = m.boards.length;
  for (const b of m.boards) {
    const side = sideOf(b, m.half);
    if (m.format === "relay") {
      const duty: Duty = { board: b.id, side, role: "move", players: seatsOf(m, side, [relaySeat(n, b.id, m.turn)]) };
      (b.result ? out.scouts : out.duties).push(duty);
      continue;
    }
    const [slot0, slot1] = pairSchedule(m.turn);
    if (m.format === "pairs") {
      const duty: Duty = { board: b.id, side, role: "pick", players: seatsOf(m, side, n === 1 ? slot0 : b.id === 0 ? slot0 : slot1) };
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
    out.duties.push({ board: b.id, side, role: "pick", players: seatsOf(m, side, slot0) });
    if (legal <= s.final.noBlocksAtMoves) out.mercy = "few_moves";
    else out.duties.push({ board: b.id, side: otherSide(side), role: "block", players: seatsOf(m, otherSide(side), slot1) });
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

/** Whether the half can be resolved before its clock runs out: everyone with a duty has locked in. */
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
      /** The two picks as played (a missed slot holds its random move); null when the move was forced. */
      picks: readonly [string, string] | null;
      missed: readonly [boolean, boolean];
      /** Which pick the coin played; null when forced. */
      coin: 0 | 1 | null;
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
      picks: readonly [string, string] | null;
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
      /** Which pick the coin played, when the block hit neither; null otherwise (or forced). */
      coin: 0 | 1 | null;
      move: string;
    }
  | { kind: "forced"; turn: number; half: Colour; board: number; side: Side; move: string }
  | { kind: "scout"; turn: number; half: Colour; board: number; side: Side; players: readonly string[] }
  | { kind: "board_end"; board: number; result: BoardResult }
  | { kind: "match_end"; result: MatchResult };

export interface HalfOutcome {
  match: SquadsMatch;
  events: SquadsEvent[];
  /** Players who acted, and who missed (for each player's record: `noteActions`). */
  acted: string[];
  missed: string[];
}

/**
 * Plays the half being played, from the choices as they stand (the clock ran out, or everyone locked in). `thinkMs`
 * is each player's thinking time (a missed action counts the whole clock).
 */
export function resolveHalf(m: SquadsMatch, inputs: HalfInputs, thinkMs: Readonly<Record<string, number>> = {}, s: SquadsSettings = SQUADS): HalfOutcome {
  if (m.result) throw new Error(`Match ${m.key} is over`);
  const ctx: Ctx = { m, s, inputs, thinkMs, boards: [...m.boards], think: [...m.thinkMs], events: [], acted: [], missed: [] };
  const duties = halfDuties(m, s);
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
  return afterHalf(ctx);
}

interface Ctx {
  m: SquadsMatch;
  s: SquadsSettings;
  inputs: HalfInputs;
  thinkMs: Readonly<Record<string, number>>;
  boards: SquadsBoard[];
  think: [number, number];
  events: SquadsEvent[];
  acted: string[];
  missed: string[];
}

const rngFor = (c: Ctx, board: number, what: string) => squadsRng(c.m.seed, c.m.key, c.m.turn, c.m.half, board, what);

/** A player's choice if it's legal here, else null (a miss). Counts their thinking time and logs them. */
function take(c: Ctx, player: string, side: Side, fen: string): string | null {
  const move = c.inputs.choices[player];
  const ok = !!move && isLegal(fen, move);
  c.think[side] += ok ? (c.thinkMs[player] ?? 0) : c.m.paceSeconds * 1000;
  (ok ? c.acted : c.missed).push(player);
  return ok ? move! : null;
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
  const chosen = take(c, player, d.side, b.fen);
  const move = chosen ?? randomLegalMove(b.fen, rngFor(c, d.board, "miss"));
  c.events.push({ kind: "relay", turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, player, move, missed: !chosen });
  play(c, d.board, move);
}

/** Two picks, always different: a missed slot becomes a random legal move other than the partner's. */
function twoPicks(c: Ctx, d: Duty, fen: string): { picks: [string, string]; missed: [boolean, boolean] } {
  const p0 = take(c, d.players[0]!, d.side, fen);
  let p1 = take(c, d.players[1]!, d.side, fen);
  // (The inputs never allow it, but two equal picks can't both stand: the second slot is then a miss.)
  if (p1 !== null && p1 === p0) p1 = null;
  const m0 = p0 ?? randomLegalMove(fen, rngFor(c, d.board, "miss-0"), p1 ? [p1] : []);
  const m1 = p1 ?? randomLegalMove(fen, rngFor(c, d.board, "miss-1"), [m0]);
  return { picks: [m0, m1], missed: [!p0, !p1] };
}

function pairMove(c: Ctx, d: Duty) {
  const fen = c.boards[d.board]!.fen;
  const { picks, missed } = twoPicks(c, d, fen);
  const flip = coin(rngFor(c, d.board, "coin"));
  const move = picks[flip];
  c.events.push({ kind: "pair", turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, players: d.players, picks, missed, coin: flip, move });
  play(c, d.board, move);
}

/**
 * The final's move: two different picks; two different blocks (or none: the mercy rule); a coin makes one block
 * active (an empty slot blocks nothing); a block is cancelled if every other legal move allows mate in one. If the
 * active block hits a pick the other pick plays, otherwise a coin chooses between the picks.
 */
function pickAndBlock(c: Ctx, pick: Duty, block: Duty | null, mercy: "few_moves" | null) {
  const fen = c.boards[pick.board]!.fen;
  const { picks, missed: pickMissed } = twoPicks(c, pick, fen);
  let blocks: [string | null, string | null] = [null, null];
  let blockMissed: [boolean, boolean] = [false, false];
  if (block) {
    const b0 = take(c, block.players[0]!, block.side, fen);
    let b1 = take(c, block.players[1]!, block.side, fen);
    if (b1 !== null && b1 === b0) b1 = null;
    blocks = [b0, b1];
    blockMissed = [!b0, !b1];
  }
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
  play(c, pick.board, move);
}

/** After a half: the caps (decided by material), the result (clinch, every board, Armageddon), the next half. */
function afterHalf(c: Ctx): HalfOutcome {
  const { m, s } = c;
  c.boards = c.boards.map((b) => {
    if (b.result) return b;
    const capped =
      m.capMoves !== null && b.moves.length >= 2 * m.capMoves ? "move_cap" : b.moves.length >= 2 * m.safetyMoves ? "safety_cap" : null;
    if (!capped) return b;
    const done = decideByMaterial(b, capped, s);
    c.events.push({ kind: "board_end", board: b.id, result: done.result! });
    return done;
  });
  const result = matchResultOf(c.boards, m.armageddon, s);
  if (result) c.events.push({ kind: "match_end", result });
  const match: SquadsMatch = {
    ...m,
    boards: c.boards,
    turn: m.half === "b" ? m.turn + 1 : m.turn,
    half: m.half === "w" ? "b" : "w",
    thinkMs: c.think,
    result,
  };
  return { match, events: c.events, acted: c.acted, missed: c.missed };
}

/** Each side's points from the finished boards (a win 1, a draw ½). */
export function matchPoints(boards: readonly SquadsBoard[], s: SquadsSettings = SQUADS): [number, number] {
  const pts: [number, number] = [0, 0];
  for (const b of boards) for (const side of [0, 1] as const) pts[side] += boardPoints(b, side, s) ?? 0;
  return pts;
}

/**
 * The match's result, if it's decided. A squad with more than half the points has won (clinched, if boards are
 * still going: the match ends at once). Every board finished and level: a tie. Armageddon: White must win; a draw
 * counts for Black.
 */
export function matchResultOf(boards: readonly SquadsBoard[], armageddon: boolean, s: SquadsSettings = SQUADS): MatchResult | null {
  const points = matchPoints(boards, s);
  if (armageddon) {
    const b = boards[0]!;
    if (!b.result) return null;
    return { winner: b.result.winner === "w" ? b.white : otherSide(b.white), points, how: "armageddon" };
  }
  const all = boards.every((b) => b.result);
  for (const side of [0, 1] as const) {
    if (points[side] > (boards.length * s.winPoints) / 2) return { winner: side, points, how: all ? "boards" : "clinch" };
  }
  return all ? { winner: null, points, how: "boards" } : null;
}

// ---- Ties: Armageddon ----

/** The side that picks Armageddon's colours: the one with less total thinking time (a coin if it's level). */
export function armageddonChooser(m: SquadsMatch): Side {
  if (m.thinkMs[0] !== m.thinkMs[1]) return m.thinkMs[0] < m.thinkMs[1] ? 0 : 1;
  return coin(squadsRng(m.seed, m.key, "armageddon-chooser"));
}

/** Armageddon's board starts as the lobby's Start vote says (random openings: a fresh one). */
export function armageddonStart(plan: SquadsPlan, tied: Pick<SquadsMatch, "key">, library: readonly Opening[], s: SquadsSettings = SQUADS): BoardStart {
  if (plan.rules.start === "standard") return STANDARD_START;
  if (plan.rules.start === "same") return plan.start ?? STANDARD_START;
  return drawOpenings(library, 1, squadsRng(plan.seed, tied.key, "armageddon-opening"), s)[0]!;
}

/**
 * One Armageddon board for a tied match (round 1 at 2-2, round 2 at 1-1, a drawn final): the same squads, in that
 * round's format and length, at the fastest pace. `white` is the side the chooser gave White.
 */
export function startArmageddon(tied: SquadsMatch, white: Side, start: BoardStart, s: SquadsSettings = SQUADS): SquadsMatch {
  if (!tied.result || tied.result.winner !== null) throw new Error(`Match ${tied.key} isn't tied`);
  return createSquadsMatch(
    {
      key: `${tied.key}-armageddon`,
      seed: tied.seed,
      round: tied.round,
      format: tied.format,
      sides: tied.sides,
      starts: [start],
      whites: [white],
      capMoves: tied.capMoves,
      paceSeconds: s.armageddonPaceSeconds,
      armageddon: true,
    },
    s,
  );
}

// ---- Test-only: "Next round" ----

/**
 * The admin/test "Next round" button: every board still going is decided by material and the match ends. A tie
 * (outside Armageddon) is settled by a coin, so the bracket can move on.
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
  const decided = matchResultOf(boards, m.armageddon, s)!;
  const result: MatchResult = { winner: decided.winner ?? coin(squadsRng(m.seed, m.key, "admin")), points: decided.points, how: "admin" };
  events.push({ kind: "match_end", result });
  return { match: { ...m, boards, result }, events };
}

/** The winning squad's id. */
export const winnerSquad = (m: SquadsMatch): number | null => (m.result?.winner == null ? null : m.sides[m.result.winner].squadId);
