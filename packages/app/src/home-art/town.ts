import type { Character } from "../characters/sprite.ts";
import { ARENA_TOWN_SKYLINE } from "./arena-town-skyline.ts";
import { ARENA_TOWN_SQUARE } from "./arena-town-square.ts";
import { townLook, type Sky } from "./looks.ts";

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

/**
 * When each sky shows, by the device's own clock (Eric, Nov 1; the director's call): the hours the day look starts, the dusk look
 * (the picture as it was drawn) starts, and the night look starts. Day is 06:00 to 17:00, dusk 17:00 to 19:00, night 19:00 to 06:00.
 * (Here and not in core's settings: it is only this picture's, and a change in core runs every e2e spec on a pull request.)
 */
export const TOWN_SKY_HOURS = { dayFrom: 6, duskFrom: 17, nightFrom: 19 } as const;

/** The sky at `now` on the device's clock: 05:59 is night, 06:00 day, 16:59 day, 17:00 dusk, 18:59 dusk, 19:00 night. */
export function skyAt(now: Date): Sky {
  const h = now.getHours();
  if (h >= TOWN_SKY_HOURS.nightFrom || h < TOWN_SKY_HOURS.dayFrom) return "night";
  return h >= TOWN_SKY_HOURS.duskFrom ? "dusk" : "day";
}

/**
 * Which sky this load shows: the clock's, read once as the page opens (so it never changes while you look, and a load at 18:59 keeps
 * its dusk past 19:00). `?sky=day`, `?sky=dusk` or `?sky=night` in the address picks one, for stills and tests (anyone's address: it only
 * chooses between three looks of one picture, so it isn't a gated test switch); `?night=1` is night and `?night=0` the picture as drawn (dusk).
 */
export function pickSky(search: string, now: Date = new Date()): Sky {
  const q = new URLSearchParams(search);
  const asked = q.get("sky")?.toLowerCase();
  if (asked === "day" || asked === "dusk" || asked === "night") return asked;
  const night = q.get("night");
  if (night === "1") return "night";
  if (night === "0") return "dusk";
  return skyAt(now);
}

export const TOWN_SKY: Sky = pickSky(typeof location === "undefined" ? "" : location.search);

/** The picture this load draws: the one picked, under the sky picked. */
export const TOWN_SCENE: Character = townLook(TOWN_PICTURE.ch, TOWN_SKY);
