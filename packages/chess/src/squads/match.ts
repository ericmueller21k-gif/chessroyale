import { SQUADS, type SquadsClock, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, fenAfter } from "../rules.ts";
import { pickOpenings, type Opening } from "../openings.ts";
import {
  boardPoints,
  colourToMove,
  decideByMaterial,
  newSquadsBoard,
  otherSide,
  playOnBoard,
  sideOf,
  type BoardResult,
  type BoardStart,
  type Colour,
  type Side,
  type SquadsBoard,
} from "./board.ts";
import { allowedMoves, checkBlock, isBlocked, liftBlocks, type BlockError, type BlockLift, type BlockPiece, type SquadsBlock } from "./blocks.ts";
import { ROUND_FORMAT, coin, squadsRng, type Squad, type SquadsFormat, type SquadsRound } from "./lobby.ts";
import { pairSchedule, relaySeat } from "./schedule.ts";
import type { TokenUse, TokenVerdict } from "./tokens.ts";
import type { SquadsRules } from "./votes.ts";

/**
 * One Squads match between two squads, in its round's format: Relay (round 1), Pairs (round 2) or the majority vote
 * (the final), or the Armageddon board after a drawn final. Pure and replayable: every random draw comes from the
 * match's seed and the decision's name (`squadsRng`). No engine: legal moves and mate in one come from chess.js; only
 * the silent safety cap and the test-only "Next round" fall back on material; a same-move token's refund weighs the
 * judge's top moves, given as data (`settleTokenUse`).
 *
 * Squads v2 (Eric, Oct 12): Pairs partners may pick the same move while their squad has a token (it plays, a token
 * burns, the judge may refund it); in every round a squad may block one move of the other squad's on a board before
 * its own move there (`placeBlock`; blocks.ts), paid from its block bank for the match; the final is a majority vote of
 * the whole squad.
 *
 * The clocks are the squads' team clocks: one bank per squad for the whole tournament (`Squad.bankMs`), brought into
 * the match (`banks`) and carried out of it (`settleTeamClocks`). A match is played in turns of two halves: every
 * board's White move, then every board's Black move (in the final, the White squad's move, then the Black squad's).
 * In each half the server collects choices (`choose`, `lockIn`) until everyone has locked in or the deadlines pass,
 * then `resolveHalf` plays the half with each player's thinking time:
 * - Each move being thought about drains its squad's bank past the free seconds (`delayMs`): a Relay mover, a pair
 *   (the slower picker), the final's squad (its slowest picker). Placing a block is thinking time too: the move's
 *   time runs to the block if that came later. Two of a squad's moves being thought about at once drain it twice as
 *   fast.
 * - While the bank is above zero, the per-move ceiling bounds a move; if the bank runs out during the half, every
 *   move of that squad still being thought about is cut off. At zero it's sudden death: each move within the free
 *   seconds. A move not made in time is a missed action: a random legal move. No flag falls.
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
  /** Each side's same-move tokens left (Pairs only; null in other formats). */
  tokens: readonly [number, number] | null;
  /** Each side's block bank left (blocks being placed this half are paid from it when the half is played). */
  blockBanks: readonly [number, number];
  /** Blocks in effect this half: these moves of the side to move can't be played on those boards. */
  blocks: readonly SquadsBlock[];
  /** Every same-move token burned this match, and the judge's verdict once it's in (the post-match breakdown). */
  tokenLog: readonly TokenUse[];
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
  /** Each side's block bank coming in (Armageddon: what the final left); default the bank for a match. */
  blockBanks?: readonly [number, number];
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
    tokens: o.format === "pairs" && !o.armageddon ? [s.tokens.perMatch, s.tokens.perMatch] : null,
    blockBanks: o.blockBanks ? [o.blockBanks[0], o.blockBanks[1]] : [s.blocks.bankPerMatch, s.blocks.bankPerMatch],
    blocks: [],
    tokenLog: [],
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

export type Role = "move" | "pick";

export interface Duty {
  board: number;
  side: Side;
  role: Role;
  /** One player (a Relay move), two (a pair's picks) or the whole squad (the final's vote). */
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
  /** Boards whose side to move has only one move it may play (a block counted): it plays itself (Pairs and the final). */
  forced: number[];
}

/** The blocks in effect on a board this half: the moves the side to move can't play there. */
export const blocksOn = (m: Pick<SquadsMatch, "blocks">, board: number): string[] => m.blocks.filter((b) => b.board === board).map((b) => b.move);

/** The moves the side to move may play on a board this half: every legal move but the blocked ones. */
export const movesAllowed = (m: Pick<SquadsMatch, "blocks" | "boards">, board: number): readonly string[] => allowedMoves(m.boards[board]!.fen, blocksOn(m, board));

const seatsOf = (m: SquadsMatch, side: Side, seats: readonly number[]) => seats.map((i) => m.sides[side].seats[i]!);

/** Who acts in the half being played, board by board, and their deadlines. */
export function halfDuties(m: SquadsMatch, s: SquadsSettings = SQUADS): HalfDuties {
  const out: HalfDuties = { duties: [], scouts: [], forced: [] };
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
    if (m.format === "pairs") {
      const [slot0, slot1] = pairSchedule(m.turn);
      const duty: Duty = { board: b.id, side, role: "pick", players: seatsOf(m, side, n === 1 ? slot0 : b.id === 0 ? slot0 : slot1), deadlineMs };
      if (b.result) out.scouts.push(duty);
      else if (movesAllowed(m, b.id).length === 1) out.forced.push(b.id);
      else out.duties.push(duty);
      continue;
    }
    // The final: the whole squad to move votes.
    if (b.result) continue;
    if (movesAllowed(m, b.id).length === 1) {
      out.forced.push(b.id);
      continue;
    }
    out.duties.push({ board: b.id, side, role: "pick", players: [...m.sides[side].seats], deadlineMs });
  }
  return out;
}

/** A player's duty this half, and their partner (Pairs), if any; in the final, `team` is the rest of the squad. */
export function dutyOf(m: SquadsMatch, playerId: string, s: SquadsSettings = SQUADS): { duty: Duty; partner: string | null; team: string[] } | null {
  for (const duty of halfDuties(m, s).duties) {
    const i = duty.players.indexOf(playerId);
    if (i < 0) continue;
    const team = duty.players.filter((p) => p !== playerId);
    return { duty, partner: duty.players.length === 2 ? team[0]! : null, team };
  }
  return null;
}

// ---- Choices during a half ----

/** A block placed this half: by whom, on which board, the move, and when (ms after the half began: thinking time). */
export interface PlacedBlock {
  board: number;
  by: string;
  move: string;
  at: number;
}

/** What players have chosen so far this half (a move or a pick), who has locked in, and the blocks placed. */
export interface HalfInputs {
  choices: Readonly<Record<string, string>>;
  locked: Readonly<Record<string, boolean>>;
  blocks: readonly PlacedBlock[];
}

export const NO_INPUTS: HalfInputs = { choices: {}, locked: {}, blocks: [] };

/** blocked: a block in effect takes that move away this half; no_tokens: your partner's move, and no same-move token left. */
export type ChoiceError = "match_over" | "no_duty" | "illegal" | "blocked" | "no_tokens" | "already_moved";

/**
 * A player chooses during the half. Relay: their move (made once, locked at once). Pairs and the final: a pick, which
 * can change until the half ends (a change unlocks it). Pairs: your partner's move only while your squad has a
 * same-move token. Never a move a block takes away.
 */
export function choose(m: SquadsMatch, inputs: HalfInputs, playerId: string, move: string, s: SquadsSettings = SQUADS): { inputs: HalfInputs } | { error: ChoiceError } {
  if (m.result) return { error: "match_over" };
  const d = dutyOf(m, playerId, s);
  if (!d) return { error: "no_duty" };
  const legal = allowedMoves(m.boards[d.duty.board]!.fen, null);
  if (!legal.includes(move)) return { error: "illegal" };
  if (isBlocked(move, blocksOn(m, d.duty.board))) return { error: "blocked" };
  if (d.duty.role === "move") {
    if (inputs.choices[playerId]) return { error: "already_moved" };
    return { inputs: { ...inputs, choices: { ...inputs.choices, [playerId]: move }, locked: { ...inputs.locked, [playerId]: true } } };
  }
  if (m.format === "pairs" && d.partner && inputs.choices[d.partner] === move && tokensLeft(m, d.duty.side) <= 0) return { error: "no_tokens" };
  return { inputs: { ...inputs, choices: { ...inputs.choices, [playerId]: move }, locked: { ...inputs.locked, [playerId]: false } } };
}

/** A side's same-move tokens left (0 outside Pairs). */
export const tokensLeft = (m: Pick<SquadsMatch, "tokens">, side: Side): number => m.tokens?.[side] ?? 0;

/** A side's block bank now: the match's, less the blocks it has placed this half (paid at once). */
export function blockBankNow(m: Pick<SquadsMatch, "blockBanks" | "boards" | "half">, inputs: Pick<HalfInputs, "blocks">, side: Side, s: SquadsSettings = SQUADS): number {
  let bank = m.blockBanks[side];
  for (const b of inputs.blocks) {
    const board = m.boards[b.board];
    if (!board || sideOf(board, m.half) !== side) continue;
    const c = checkBlock(board.fen, m.half === "w" ? "b" : "w", b.move, s);
    if ("cost" in c) bank -= c.cost;
  }
  return bank;
}

/**
 * A player blocks one move of the other squad on their board this half (blocks.ts), paid at once from the squad's
 * block bank: as many a turn as the bank allows (or `blocks.maxPerTurn`), each a different move, none taken back. Any
 * of the squad's players with a duty on that board may place one, before the squad's move there is settled: in Relay
 * before the move is made, in Pairs and the final while any of them hasn't locked in. `at` is when (ms after the half
 * began): it counts as thinking time.
 */
export function placeBlock(m: SquadsMatch, inputs: HalfInputs, playerId: string, board: number, move: string, at: number, s: SquadsSettings = SQUADS): { inputs: HalfInputs; block: SquadsBlock } | { error: BlockError } {
  if (m.result) return { error: "match_over" };
  const d = dutyOf(m, playerId, s);
  if (!d || d.duty.board !== board) return { error: "no_duty" };
  if (d.duty.role === "move" && inputs.choices[playerId]) return { error: "already_moved" };
  if (d.duty.players.every((p) => inputs.locked[p])) return { error: "locked" };
  const here = inputs.blocks.filter((b) => b.board === board);
  if (here.some((b) => b.move === move) || (s.blocks.maxPerTurn !== null && here.length >= s.blocks.maxPerTurn)) return { error: "block_taken" };
  const fen = m.boards[board]!.fen;
  const c = checkBlock(fen, m.half === "w" ? "b" : "w", move, s);
  if ("error" in c) return c;
  if (blockBankNow(m, inputs, d.duty.side, s) < c.cost) return { error: "bank" };
  const placed: PlacedBlock = { board, by: playerId, move, at: Math.max(0, at) };
  return { inputs: { ...inputs, blocks: [...inputs.blocks, placed] }, block: { board, side: d.duty.side, by: playerId, move, piece: c.piece, cost: c.cost } };
}

/** The blocks placed this half, as everyone sees them (blocks are public: both squads and spectators). */
export function placedBlocks(m: SquadsMatch, inputs: Pick<HalfInputs, "blocks">, s: SquadsSettings = SQUADS): SquadsBlock[] {
  return inputs.blocks.flatMap((b) => {
    const board = m.boards[b.board];
    if (!board) return [];
    const c = checkBlock(board.fen, m.half === "w" ? "b" : "w", b.move, s);
    return "cost" in c ? [{ board: b.board, side: sideOf(board, m.half), by: b.by, move: b.move, piece: c.piece, cost: c.cost }] : [];
  });
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
 * The choices a viewer sees live (a squad's member: their side; a spectator: null): only their own squad's, in every
 * round (the final: teammates' picks as they're made). Blocks are public (`placedBlocks`).
 */
export function visibleChoices(m: SquadsMatch, inputs: HalfInputs, viewer: Side | null, s: SquadsSettings = SQUADS): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of halfDuties(m, s).duties) {
    if (viewer !== d.side) continue;
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
      /** The two picks as played (a missed slot holds its random move); the same move twice when `same`. */
      picks: readonly [string, string];
      missed: readonly [boolean, boolean];
      /** Both picked the same move: it played without a coin, and a token burned (`token`: its place in the log). */
      same: boolean;
      token: number | null;
      /** Which pick the coin played (null: the same move, no coin). */
      coin: 0 | 1 | null;
      move: string;
    }
  | {
      kind: "vote";
      turn: number;
      half: Colour;
      board: number;
      side: Side;
      players: readonly string[];
      /** Each player's pick as it counted (null: none in time, so it didn't count). */
      picks: readonly (string | null)[];
      /** Every move picked and its votes, most first. */
      tally: readonly { move: string; votes: number }[];
      /** The moves tied for the most votes (one: a clear winner). */
      tied: readonly string[];
      /** A tie: which of `tied` the coin played. */
      coin: number | null;
      /** Nobody picked: a random move played. */
      random: boolean;
      move: string;
    }
  /**
   * A block placed this half, after the blocking side's move: in effect on the other side's next turn there ("on"),
   * or lifted and refunded (why).
   */
  | { kind: "block"; turn: number; half: Colour; board: number; side: Side; by: string; move: string; piece: BlockPiece; cost: number; outcome: "on" | BlockLift }
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
  /** Tokens burned this half (indices into the match's `tokenLog`): each waits for the judge (`settleTokenUse`). */
  tokensUsed: number[];
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
  const placed = placedBlocks(m, inputs, s);
  const ctx: Ctx = {
    m,
    s,
    inputs,
    thinkMs,
    boards: [...m.boards],
    banks: [...m.banks],
    events: [],
    acted: [],
    missed: [],
    timeouts: [],
    cutoff: [Infinity, Infinity],
    earned: [0, 0],
    tokens: m.tokens ? [m.tokens[0], m.tokens[1]] : null,
    tokenLog: [...m.tokenLog],
    tokensUsed: [],
    blockBanks: [m.blockBanks[0], m.blockBanks[1]],
  };
  for (const side of [0, 1] as const) drainBank(ctx, side, duties.duties.filter((d) => d.side === side));
  for (const d of duties.scouts) ctx.events.push({ kind: "scout", turn: m.turn, half: m.half, board: d.board, side: d.side, players: d.players });
  for (const id of duties.forced) {
    const b = m.boards[id]!;
    const move = movesAllowed(m, id)[0]!;
    ctx.events.push({ kind: "forced", turn: m.turn, half: m.half, board: id, side: sideOf(b, m.half), move });
    play(ctx, id, move);
  }
  for (const d of duties.duties) {
    if (d.role === "move") relayMove(ctx, d);
    else if (m.format === "pairs") pairMove(ctx, d);
    else voteMove(ctx, d);
  }
  // The blocks placed this half: paid, then in effect on the other side's next turn, or lifted and refunded (each
  // board's together, by the mercy rules: the most recent first).
  const next: SquadsBlock[] = [];
  for (const board of new Set(placed.map((b) => b.board))) {
    const here = placed.filter((b) => b.board === board);
    const after = ctx.boards[board]!;
    const lifts = after.result ? here.map((): BlockLift => "impossible") : liftBlocks(after.fen, here.map((b) => b.move), s);
    here.forEach((b, i) => {
      const lift = lifts[i] ?? null;
      if (!lift) {
        ctx.blockBanks[b.side] -= b.cost;
        next.push(b);
      }
      ctx.events.push({ kind: "block", turn: m.turn, half: m.half, board: b.board, side: b.side, by: b.by, move: b.move, piece: b.piece, cost: b.cost, outcome: lift ?? "on" });
    });
  }
  ctx.nextBlocks = next;
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
  tokens: [number, number] | null;
  tokenLog: TokenUse[];
  tokensUsed: number[];
  blockBanks: [number, number];
  /** The blocks in effect on the next half. */
  nextBlocks?: SquadsBlock[];
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
 * A squad's bank this half. Each of its moves (a Relay mover, a pair, the final's squad) drains it from the free
 * seconds until the move is made (its slowest player, or a block placed later, which is thinking time too), or to the
 * ceiling if one of them never chose; several at once drain it together. If it runs out, moves not yet made are cut
 * off; at zero (sudden death) each move has only the free seconds.
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
    const allowed = movesAllowed(m, d.board);
    const all = d.players.every((p) => {
      const mv = c.inputs.choices[p];
      return !!mv && allowed.includes(mv) && (c.thinkMs[p] ?? 0) <= ceiling;
    });
    const blockAt = Math.max(0, ...c.inputs.blocks.filter((b) => b.board === d.board && d.players.includes(b.by)).map((b) => b.at));
    return all ? Math.min(ceiling, Math.max(blockAt, ...d.players.map((p) => c.thinkMs[p] ?? 0))) : ceiling;
  });
  const out = bankRunsOut(ends, m.delayMs, bank);
  const drained = ends.reduce((t, e) => t + Math.max(0, Math.min(e, out) - m.delayMs), 0);
  c.banks[side] = out === Infinity ? bank - drained : 0;
  c.cutoff[side] = Math.min(ceiling, out);
  c.events.push({ kind: "bank", turn: m.turn, half: m.half, side, drainedMs: Math.min(bank, drained), leftMs: c.banks[side], suddenDeath: c.banks[side] <= 0 });
  if (c.banks[side] <= 0) c.events.push({ kind: "sudden_death", turn: m.turn, half: m.half, side });
}

/**
 * A player's choice if it may be played here (legal, not blocked) and was made in time, else null (a miss); logs them
 * as acting, missing, or out of time.
 */
function take(c: Ctx, player: string, board: number, side: Side): string | null {
  const move = c.inputs.choices[player];
  const chose = !!move && movesAllowed(c.m, board).includes(move);
  const limit = c.cutoff[side];
  const inTime = chose && (c.thinkMs[player] ?? 0) <= limit;
  if (inTime) c.acted.push(player);
  else {
    c.missed.push(player);
    if (chose) c.timeouts.push(player);
    else if (c.m.banks[side] <= 0 || c.cutoff[side] < c.s.moveCeilingSeconds * 1000) c.timeouts.push(player);
  }
  return inTime ? move! : null;
}

/** A random move that may be played on a board this half (a missed move or pick), never one of `exclude` unless nothing else may. */
function randomAllowed(c: Ctx, board: number, what: string, exclude: readonly string[] = []): string {
  const allowed = movesAllowed(c.m, board);
  if (!allowed.length) throw new Error(`No moves on board ${board}`);
  const open = allowed.filter((mv) => !exclude.includes(mv));
  const from = open.length ? open : allowed;
  return from[Math.floor(rngFor(c, board, what)() * from.length)]!;
}

function play(c: Ctx, board: number, move: string) {
  const b = c.boards[board]!;
  if (colourToMove(b) !== c.m.half) throw new Error(`Board ${board} is out of step with the half`);
  const next = playOnBoard(b, move);
  c.boards[board] = next;
  if (next.result) c.events.push({ kind: "board_end", board, result: next.result });
}

function relayMove(c: Ctx, d: Duty) {
  const player = d.players[0]!;
  const chosen = take(c, player, d.board, d.side);
  const move = chosen ?? randomAllowed(c, d.board, "miss");
  c.events.push({ kind: "relay", turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, player, move, missed: !chosen });
  if (chosen || c.s.incrementOnMiss) c.earned[d.side]++;
  play(c, d.board, move);
}

/** Two picks, different: a missed slot becomes a random move other than the partner's. */
function twoPicks(c: Ctx, d: Duty, p0: string | null, p1In: string | null): { picks: [string, string]; missed: [boolean, boolean] } {
  // (Two equal picks stand only on a token, handled before this: here the second slot is then a miss.)
  const p1 = p1In !== null && p1In === p0 ? null : p1In;
  const m0 = p0 ?? randomAllowed(c, d.board, "miss-0", p1 ? [p1] : []);
  const m1 = p1 ?? randomAllowed(c, d.board, "miss-1", [m0]);
  return { picks: [m0, m1], missed: [!p0, !p1] };
}

/**
 * A pair's move. Both picked the same move with a token left: it plays (no coin) and a token burns, logged for the
 * judge. Otherwise two different picks (a missed slot a random move other than the partner's) and a coin plays one.
 */
function pairMove(c: Ctx, d: Duty) {
  const chosen = [take(c, d.players[0]!, d.board, d.side), take(c, d.players[1]!, d.board, d.side)] as const;
  const base = { turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, players: d.players };
  if (chosen[0] && chosen[0] === chosen[1] && c.tokens && c.tokens[d.side] > 0) {
    const move = chosen[0];
    c.tokens[d.side]--;
    const token = c.tokenLog.length;
    c.tokenLog.push({ ...base, move, fen: c.boards[d.board]!.fen, blocked: blocksOn(c.m, d.board), verdict: null });
    c.tokensUsed.push(token);
    c.events.push({ kind: "pair", ...base, picks: [move, move], missed: [false, false], same: true, token, coin: null, move });
    c.earned[d.side]++;
    play(c, d.board, move);
    return;
  }
  const { picks, missed } = twoPicks(c, d, chosen[0], chosen[1]);
  const flip = coin(rngFor(c, d.board, "coin"));
  const move = picks[flip];
  c.events.push({ kind: "pair", ...base, picks, missed, same: false, token: null, coin: flip, move });
  if (!missed.some(Boolean) || c.s.incrementOnMiss) c.earned[d.side]++;
  play(c, d.board, move);
}

/**
 * The final's move, a majority vote: every pick made in time counts once; the most picked move plays; a tie for the
 * most, a seeded coin between the tied moves (`final.tie`); nobody picked, a random move. Copying a teammate is the
 * point: no tokens here.
 */
function voteMove(c: Ctx, d: Duty) {
  const picks = d.players.map((p) => take(c, p, d.board, d.side));
  const counts = new Map<string, number>();
  for (const p of picks) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  // Most votes first; level ones in the order they were first picked (seat order).
  const tally = [...counts].map(([move, votes]) => ({ move, votes })).sort((a, b) => b.votes - a.votes);
  const random = !tally.length;
  const most = tally[0]?.votes ?? 0;
  const tied = tally.filter((t) => t.votes === most).map((t) => t.move);
  let coinAt: number | null = null;
  let move: string;
  if (random) move = randomAllowed(c, d.board, "vote-random");
  else if (tied.length > 1) {
    coinAt = Math.floor(rngFor(c, d.board, "vote-tie")() * tied.length);
    move = tied[coinAt]!;
  } else move = tied[0]!;
  c.events.push({ kind: "vote", turn: c.m.turn, half: c.m.half, board: d.board, side: d.side, players: d.players, picks, tally, tied: random ? [] : tied, coin: coinAt, random, move });
  if (!random || c.s.incrementOnMiss) c.earned[d.side]++;
  play(c, d.board, move);
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
  const match: SquadsMatch = {
    ...m,
    boards: c.boards,
    banks,
    turn: m.half === "b" ? m.turn + 1 : m.turn,
    half: m.half === "w" ? "b" : "w",
    tokens: c.tokens,
    tokenLog: c.tokenLog,
    blockBanks: [c.blockBanks[0], c.blockBanks[1]],
    blocks: result ? [] : (c.nextBlocks ?? []),
    result,
  };
  return { match, events: c.events, tokensUsed: c.tokensUsed, acted: c.acted, missed: c.missed, timeouts: c.timeouts };
}

// ---- Same-move tokens: the judge's verdict ----

/**
 * The judge's verdict on a token use (tokens.ts: `judgeTokenUse`) lands on the match: logged for the breakdown, and a
 * refund gives the squad its token back (a finished match keeps the log). A use already judged is left as it is.
 */
export function settleTokenUse(m: SquadsMatch, index: number, verdict: TokenVerdict): SquadsMatch {
  const use = m.tokenLog[index];
  if (!use || use.verdict) return m;
  const tokenLog = m.tokenLog.map((u, i) => (i === index ? { ...u, verdict } : u));
  if (!verdict.refunded || !m.tokens) return { ...m, tokenLog };
  const tokens: [number, number] = [m.tokens[0], m.tokens[1]];
  tokens[use.side]++;
  return { ...m, tokenLog, tokens };
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
 * the chooser gave White. Each squad carries on with the block bank the final left it (the same match).
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
      blockBanks: final.blockBanks,
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
  return { match: { ...m, boards, blocks: [], result }, events };
}

/** The winning squad's id. */
export const winnerSquad = (m: SquadsMatch): number | null => (m.result?.winner == null ? null : m.sides[m.result.winner].squadId);
