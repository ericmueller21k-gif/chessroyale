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
