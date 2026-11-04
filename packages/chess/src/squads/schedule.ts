/**
 * Who plays where and when, by seat (0-3; seat 0 is the rules' "player 1"). Pure arithmetic, the same for both squads.
 */

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Relay: the seat that makes this turn's move on `board`. Everyone moves one board along each turn (board 1, 2, 3,
 * 4, 1...), so each board gets exactly one of a squad's players per turn. With one board (Armageddon) the seats take
 * turns in order.
 */
export function relaySeat(boards: number, board: number, turn: number, squadSize = 4): number {
  return boards === 1 ? mod(turn, squadSize) : mod(board - turn, boards);
}

/** Relay: the board a seat plays on at `turn` (the inverse of relaySeat, for four boards). */
export function relayBoardOf(seat: number, turn: number, boards = 4): number {
  return mod(seat + turn, boards);
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
export function seatBoard(format: "relay" | "pairs" | "final", boards: number, seat: number, turn: number): number | null {
  if (boards <= 1 || format === "final") return null;
  if (format === "relay") return relayBoardOf(seat, turn, boards);
  return pairSchedule(turn)[0].includes(seat) ? 0 : 1;
}

/**
 * Move replay (Eric, Nov 5): how many moves were played on `board` since `seat` last played it, when the rotation
 * brings the seat back to it this turn (it was on another board last turn); 0 when it stays on its board (it watched
 * every move there) or never changes boards. `ply`: the moves played on that board in this match so far. Every board
 * gets one move a half until it's over, and a seat always has the same color on a board, so its last move there was
 * ply `2 × lastTurn + (Black ? 1 : 0)`; a board it never played: every move since the match began.
 */
export function movesSinceLastPlayed(format: "relay" | "pairs" | "final", boards: number, seat: number, board: number, turn: number, black: boolean, ply: number): number {
  if (turn <= 0 || seatBoard(format, boards, seat, turn) !== board || seatBoard(format, boards, seat, turn - 1) === board) return 0;
  let last: number | null = null;
  for (let t = turn - 1; t >= 0 && last === null; t--) if (seatBoard(format, boards, seat, t) === board) last = t;
  const since = last === null ? ply : ply - (2 * last + (black ? 1 : 0) + 1);
  return Math.max(0, Math.min(ply, since));
}
