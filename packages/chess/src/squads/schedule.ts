/**
 * Who plays where and when, by seat (0-3; seat 0 is the rules' "player 1"). Pure arithmetic, the same for both squads.
 */

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A side of a match (0 or 1), as the schedule needs it (board.ts' `Side`). */
type SideNo = 0 | 1;

/**
 * Relay on fewer boards than a squad has players (Eric, Nov 5: 3 boards, 4 a squad), the ring: a squad's moves in a
 * turn, in the order they're played: its White boards (the first half), then its Black ones (the second), each group
 * ordered so the whole runs one board along (board 3, 1, 2 for side 0, White on 1 and 3; board 2, 3, 1 for side 1).
 * Side 0 is White on boards 1 and 3, side 1 on board 2 (`matchStarts`).
 */
export function relayRing(boards: number, side: SideNo): number[] {
  const white = (b: number) => b % 2 === side;
  // (Start on a White board whose board before it is Black: from there one board along runs Whites, then Blacks.)
  const start = Array.from({ length: boards }, (_, b) => b).find((b) => white(b) && !white(mod(b - 1, boards))) ?? 0;
  const along = Array.from({ length: boards }, (_, j) => mod(start + j, boards));
  return [...along.filter(white), ...along.filter((b) => !white(b))];
}

/**
 * The ring's rule (Eric, Nov 5; docs/decisions/2026-11-05-squads-three-boards.md): a squad's moves are numbered in the
 * order they're played (`relayRing` within a turn, turn after turn), and move k is seat k mod 4's. So at the start
 * seats 1-3 sit at the three boards and seat 4 waits; each squad move goes to the next player in the ring; after your
 * move you go one board along, to the next board needing your squad's move; the waiting player takes the first board
 * that becomes free (a tie in a half: the ring's order), and every place stays fixed for the match.
 */
const ringed = (boards: number, squadSize: number) => boards > 1 && boards < squadSize;

/**
 * Relay: the seat that makes this turn's move on `board` for `side`. On as many boards as a squad has players (4, a
 * match stored before Nov 5) everyone moves one board along each turn (board 1, 2, 3, 4, 1...), the same for both
 * sides. On fewer (3), the ring (`relayRing`). With one board (Armageddon) the seats take turns in order.
 */
export function relaySeat(boards: number, board: number, turn: number, squadSize = 4, side: SideNo = 0): number {
  if (boards === 1) return mod(turn, squadSize);
  if (!ringed(boards, squadSize)) return mod(board - turn, boards);
  const j = relayRing(boards, side).indexOf(board);
  return mod(boards * turn + j, squadSize);
}

/**
 * Relay: the board a seat plays on at `turn` (the inverse of relaySeat), or null on the ring when it's the seat's turn
 * to wait (each turn one seat of each squad sits out: seat 4 at the start, then 3, 2, 1, 4...).
 */
export function relayBoardOf(seat: number, turn: number, boards = 4, side: SideNo = 0, squadSize = 4): number | null {
  if (!ringed(boards, squadSize)) return mod(seat + turn, boards);
  const ring = relayRing(boards, side);
  for (let j = 0; j < boards; j++) if (mod(boards * turn + j, squadSize) === seat) return ring[j]!;
  return null;
}

/**
 * Relay: a seat's next `count` moves from `turn` on (this turn's first, if it has one), each its turn and board, in the
 * order it plays them.
 */
export function relayMovesOf(seat: number, turn: number, count: number, boards = 4, side: SideNo = 0, squadSize = 4): { turn: number; board: number }[] {
  const out: { turn: number; board: number }[] = [];
  for (let t = Math.max(0, turn); out.length < count && t < turn + count * squadSize + squadSize; t++) {
    const b = relayBoardOf(seat, t, boards, side, squadSize);
    if (b !== null) out.push({ turn: t, board: b });
  }
  return out;
}

/**
 * Pairs and the final: the two pairs of seats for a turn, [slot 0, slot 1]. Partners cycle 1+2 (and 3+4), 1+3 (2+4),
 * 1+4 (2+3), and player 1's pair alternates slots every turn. In Pairs, slot 0 plays board 1 and slot 1 board 2; in
 * the final, slot 0 picks (on its squad's move) and slot 1 blocks (on the other squad's).
 *
 * Everyone alternating every turn is impossible while partners change (consecutive turns' slot-0 pairs always share
 * exactly one player, so two players stay and two switch). This schedule keeps it fair: over every six turns each
 * player is in each slot three times, never more than three turns running, and every one of the six possible pairs
 * plays slot 0 once and slot 1 once (DECISIONS.md, "Squads").
 */
export function pairSchedule(turn: number): readonly [readonly [number, number], readonly [number, number]] {
  const partner = 1 + mod(turn, 3);
  const withOne: [number, number] = [0, partner];
  const rest = [1, 2, 3].filter((x) => x !== partner) as [number, number];
  return mod(turn, 2) === 0 ? [withOne, rest] : [rest, withOne];
}

/**
 * The board a seat is on at `turn` (Relay: its board this turn; Pairs: its slot's board), or null where nobody changes
 * boards (the final, Armageddon, any one-board match).
 */
export function seatBoard(format: "relay" | "pairs" | "final", boards: number, seat: number, turn: number, side: SideNo = 0, squadSize = 4): number | null {
  if (boards <= 1 || format === "final") return null;
  if (format === "relay") return relayBoardOf(seat, turn, boards, side, squadSize);
  return pairSchedule(turn)[0].includes(seat) ? 0 : 1;
}

/**
 * Move replay (Eric, Nov 5): how many moves were played on `board` since `seat` last played it, when the rotation
 * brings the seat back to it this turn (it was on another board last turn); 0 when it stays on its board (it watched
 * every move there) or never changes boards. `ply`: the moves played on that board in this match so far. Every board
 * gets one move a half until it's over, and a seat always has the same color on a board, so its last move there was
 * ply `2 × lastTurn + (Black ? 1 : 0)`; a board it never played: every move since the match began.
 */
export function movesSinceLastPlayed(format: "relay" | "pairs" | "final", boards: number, seat: number, board: number, turn: number, black: boolean, ply: number, side: SideNo = 0, squadSize = 4): number {
  const at = (t: number) => seatBoard(format, boards, seat, t, side, squadSize);
  if (turn <= 0 || at(turn) !== board || at(turn - 1) === board) return 0;
  let last: number | null = null;
  for (let t = turn - 1; t >= 0 && last === null; t--) if (at(t) === board) last = t;
  const since = last === null ? ply : ply - (2 * last + (black ? 1 : 0) + 1);
  return Math.max(0, Math.min(ply, since));
}
