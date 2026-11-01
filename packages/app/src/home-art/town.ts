import type { Character } from "../characters/sprite.ts";
import { ARENA_TOWN_SKYLINE } from "./arena-town-skyline.ts";
import { ARENA_TOWN_SQUARE } from "./arena-town-square.ts";

/**
 * Chess Town's button has two pictures (Eric, Nov 1: "go with both, just have a 50% chance of each one every time u load"):
 * A, the skyline, and B, the square (with its pawns at their table). `dropBottom` is how many of the picture's last (plain) rows
 * may be cut when the button is a little short; `groundRow` is the row the ground starts at, which fills a narrow gap beside it.
 */
export interface TownPicture {
  id: "A" | "B";
  ch: Character;
  dropBottom: number;
  groundRow: number;
}

export const TOWN_PICTURES: Record<"A" | "B", TownPicture> = {
  A: { id: "A", ch: ARENA_TOWN_SKYLINE, dropBottom: 0, groundRow: 29 },
  B: { id: "B", ch: ARENA_TOWN_SQUARE, dropBottom: 3, groundRow: 26 },
};

/**
 * Which picture this load shows: a fair coin, flipped once as the page opens (so the home keeps its picture while you play and
 * come back, and a load shows the other half the time). `?town=A` or `?town=B` in the address picks one, for stills and tests
 * (anyone's address: it only chooses between two pictures, so it isn't a gated test switch).
 */
export function pickTownPicture(search: string, random: () => number = Math.random): TownPicture {
  const asked = new URLSearchParams(search).get("town")?.toUpperCase();
  if (asked === "A" || asked === "B") return TOWN_PICTURES[asked];
  return random() < 0.5 ? TOWN_PICTURES.A : TOWN_PICTURES.B;
}

export const TOWN_PICTURE: TownPicture = pickTownPicture(typeof location === "undefined" ? "" : location.search);
