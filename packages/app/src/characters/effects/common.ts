/** What every boss's effect sprites share: the frame sizes and a sparkle. See ../effects.ts for how effects work. */
import type { Speck } from "../sprite.ts";

/** Frame pixels per board square, for the one-square effects. */
export const SQUARE = 32;
/** Frame pixels per board square for the blizzard, which covers the whole board (8 x 8 squares). */
export const BOARD_CELL = 24;

export type Pt = readonly [number, number];

export const sparkle = (x: number, y: number, core = "F", ray = "f", big = false): Speck[] => [
  [x, y, core],
  [x - 1, y, ray],
  [x + 1, y, ray],
  [x, y - 1, ray],
  [x, y + 1, ray],
  ...(big ? ([[x - 2, y, ray], [x + 2, y, ray], [x, y - 2, ray], [x, y + 2, ray]] as Speck[]) : []),
];

export const BOARD = 8 * BOARD_CELL;
