/**
 * Rolling Dough, Don Dough's bakery, as the town sees it (Nov 11): the art branch's HOUSE_ZEBRA (claude/boss-art,
 * scripts/boss-art/out/house-shop-zebra/house-shop-zebra.ts, Nov 10; Eric approved it Nov 11: "Looks great"), copied as drawn.
 * Changed: only split out of the rooms' file (shops/zebra-art.ts, which loads only when you go in) and the import paths. 144 x 146,
 * foot [72, 140]: a cream plaster bakery under a zebra-striped awning, the sign board (the game writes "Rolling Dough"), the display
 * window, a burgundy door with blinds and the A-board on the pavement (JUST BREAD / MOVE ALONG). Idle: 8 frames (2.6 s): the chimney
 * puffs; at f4-f6 two eyes peek through the door's blinds (cue `peek` f4).
 */
import type { Character, Frame, Layer, Part } from "../../characters/sprite.ts";
import type { LightSpot } from "./kit.ts";
import { BAKERY_PALETTE, baguette, bits, blob, boule, croissant, cropBit, cv, line, put, rect, roll, textC, hash, type Bit } from "../shops/bakery-kit.ts";

const PALETTE: Record<string, string> = { ...BAKERY_PALETTE };


const HW = 144;
const HH = 134;
const HCX = 72;
const HFOOT = 128;
/** The picture's extra sky over the drawing (the chimney's smoke rises into it). */
const HOY = 12;
const SIGN = { x: 24, y: 30, w: 96, h: 17 };
/** Where the game writes the bakery's name: the sign board's face (as kit.ts signFace). */
export const HOUSE_ZEBRA_SIGN = { x: SIGN.x + 2, y: HOY + SIGN.y + 3, w: SIGN.w - 5, h: SIGN.h - 6 } as const;
function makeHouse(): Character {
  const frames: Bit[][] = [];
  for (let f = 0; f < 8; f++) {
    const c = cv(HW, HH);
    const L = 12;
    const R = HW - 12;
    // The facade: cream plaster, a cornice, a parapet with a wheat sheaf in its little pediment; brick quoins at the corners.
    for (let y = 8; y < HFOOT; y++)
      for (let x = L; x < R; x++) {
        const quoin = (x < L + 6 || x >= R - 6) && Math.floor((y - 8) / 6) % 2 === 0;
        put(c, x, y, quoin ? (x === L || x === R - 1 ? "B" : "b") : hash(x >> 1, y >> 1, 3) < 0.05 ? "1" : x < L + 10 ? "3" : "2");
      }
    rect(c, L - 3, 22, R - L + 6, 5, (i, j) => (j === 0 ? "3" : j === 4 ? "1" : "2"));
    rect(c, L - 2, 8, R - L + 4, 3, (i, j) => (j === 0 ? "3" : "1"));
    for (let y = 0; y < 9; y++)
      for (let x = HCX - 18 + y * 2; x <= HCX + 18 - y * 2; x++) if (y > 0) put(c, x, 8 - y, y === 1 ? "1" : "2");
    for (let k = -2; k <= 2; k++) line(c, HCX, 7, HCX + k * 2, 1, "y");
    rect(c, HCX - 3, 5, 7, 1, "R");
    // The chimney (east), its smoke (the oven's): a puff rising and drifting each frame.
    rect(c, R - 22, 0, 9, 10, (i, j) => (j === 0 ? "1" : i === 0 ? "c" : (i + j) % 4 ? "b" : "B"));
    // (The smoke is drawn on the taller picture below.)
    // The sign board (blank: the game writes the name), dark wood frame, cream face.
    {
      const { x: x0, y: y0, w, h } = SIGN;
      rect(c, x0, y0, w, h, (i, j) => {
        const edge = Math.min(i, j, w - 1 - i, h - 1 - j);
        if (edge < 2) {
          if ((i === 1 || i === w - 2) && (j === 1 || j === h - 2)) return "Y";
          return j === 0 || i === 0 ? "9" : j === h - 1 || i === w - 1 ? "6" : "7";
        }
        return j === 2 ? "3" : j === h - 3 || i === w - 3 ? "1" : "2";
      });
    }
    // Two gooseneck lamps over the sign.
    for (const lx of [SIGN.x + 14, SIGN.x + SIGN.w - 15]) {
      line(c, lx, SIGN.y - 1, lx, SIGN.y - 6, "S");
      line(c, lx, SIGN.y - 6, lx + 3, SIGN.y - 8, "S");
      rect(c, lx + 1, SIGN.y - 9, 6, 2, (i, j) => (j === 0 ? "s" : "S"));
      rect(c, lx + 2, SIGN.y - 7, 4, 1, "L");
    }
    // The awning: zebra stripes, sloping out over the windows, a scalloped valance.
    const AW = { y0: 50, y1: 64 };
    for (let y = AW.y0; y <= AW.y1 + 4; y++)
      for (let x = L - 4; x < R + 4; x++) {
        const slope = y - AW.y0;
        const reach = (x - (L - 4)) % 12;
        if (y > AW.y1 && Math.hypot(reach - 6, (y - AW.y1) * 1.4) > 6) continue;
        const stripe = Math.floor((x - (L - 4) + slope * 0.25) / 6) % 2 === 0;
        put(c, x, y, y === AW.y0 ? "x" : stripe ? (y > AW.y1 - 2 ? "z" : "Z") : y > AW.y1 - 2 ? "x" : "X");
      }
    // The ground floor: the big display window (west), the door, a small window (east).
    const GF = { y: AW.y1 + 5, foot: HFOOT };
    // The display window: a dark wood frame, glass with daylight glint, a tiered stand of bread, gold lettering (FRESH BREAD).
    const WIN = { x: L + 6, w: 56, y: GF.y + 2, h: 44 };
    rect(c, WIN.x - 3, WIN.y - 3, WIN.w + 6, WIN.h + 10, (i, j) => (i < 3 || i >= WIN.w + 3 || j < 3 ? (i === 0 || j === 0 ? "9" : "7") : j >= WIN.h + 3 ? (j === WIN.h + 3 ? "0" : "8") : null));
    rect(c, WIN.x, WIN.y, WIN.w, WIN.h, (i, j) => (j > WIN.h - 10 ? "7" : "6"));
    // Inside: warm light, three tiers of bread.
    rect(c, WIN.x + 1, WIN.y + 1, WIN.w - 2, WIN.h - 11, (i, j) => (j < 6 ? "9" : "8"));
    for (const [ty, kind] of [[WIN.y + 17, "boule"], [WIN.y + 27, "baguette"], [WIN.y + 37, "roll"]] as const) {
      rect(c, WIN.x + 2, ty, WIN.w - 4, 2, (i, j) => (j === 0 ? "I" : "s"));
      if (kind === "boule") for (let i = 0; i < 4; i++) boule(c, WIN.x + 9 + i * 13, ty - 5, 5.5, true);
      else if (kind === "baguette") for (let i = 0; i < 3; i++) baguette(c, WIN.x + 5 + i * 17, ty - 2, WIN.x + 20 + i * 17, ty - 7, 2.6, 3);
      else for (let i = 0; i < 6; i++) croissant(c, WIN.x + 6 + i * 9, ty - 3, 4);
    }
    textC(c, WIN.x + WIN.w / 2, WIN.y + 4, "FRESH BREAD", "Y");
    for (let i = 0; i < 3; i++) line(c, WIN.x + 4 + i * 18, WIN.y + 30, WIN.x + 10 + i * 18, WIN.y + 10, "G");
    // The door: burgundy, a glass panel with blinds (a slat lifts and two eyes peek out in frames 4-6), a brass handle, the step.
    const DR = { x: WIN.x + WIN.w + 5, w: 24, y: GF.y, h: HFOOT - GF.y - 2 };
    rect(c, DR.x - 2, DR.y - 2, DR.w + 4, DR.h + 2, (i, j) => (i < 2 || i >= DR.w + 2 || j < 2 ? "6" : null));
    rect(c, DR.x, DR.y, DR.w, DR.h, (i, j) => (i === 0 ? "r" : j > 34 && (j - 34) % 12 === 0 ? "r" : "R"));
    rect(c, DR.x + 4, DR.y + 4, DR.w - 8, 24, (i, j) => (j % 3 === 2 ? "x" : "X"));
    if (f >= 4 && f <= 6) {
      // The slat lifted: a dark gap, and two eyes in it (a zebra's, white with dark pupils), looking left then right.
      rect(c, DR.x + 4, DR.y + 13, DR.w - 8, 3, "6");
      const look = f === 4 ? -1 : f === 5 ? 0 : 1;
      for (const ex of [DR.x + 8, DR.x + 13]) {
        rect(c, ex, DR.y + 13, 3, 2, "X");
        put(c, ex + 1 + look, DR.y + 14, "Z");
      }
    }
    rect(c, DR.x + DR.w - 5, DR.y + 36, 2, 6, "Y");
    rect(c, DR.x - 3, HFOOT - 2, DR.w + 6, 2, (i, j) => (j === 0 ? "5" : "1"));
    // A brass letter slot.
    rect(c, DR.x + 6, DR.y + 31, 12, 3, (i, j) => (j === 0 ? "Y" : "y"));
    // The small east window: a pyramid of rolls, a basil pot.
    const EW = { x: DR.x + DR.w + 6, y: GF.y + 2 };
    const ew = R - 6 - EW.x;
    rect(c, EW.x - 3, EW.y - 3, ew + 6, 40, (i, j) => (i < 3 || i >= ew + 3 || j < 3 ? (i === 0 || j === 0 ? "9" : "7") : j >= 33 ? "8" : null));
    rect(c, EW.x, EW.y, ew, 30, (i, j) => (j < 4 ? "9" : "8"));
    for (let r = 0; r < 3; r++) for (let i = 0; i <= r; i++) roll(c, EW.x + ew / 2 - r * 4 + i * 8, EW.y + 18 + r * 5, 4, 3);
    line(c, EW.x + 2, EW.y + 22, EW.x + 8, EW.y + 4, "G");
    // The step and pavement line.
    rect(c, L - 4, HFOOT - 1, R - L + 8, 1, "1");
    // The A-board on the pavement (east of the door): chalk on black. JUST BREAD. MOVE ALONG.
    const AB = { x: R - 2, y: HFOOT - 32 };
    for (let j = 0; j < 32; j++) {
      const sp2 = Math.round(j * 0.15);
      put(c, AB.x - 13 - sp2, AB.y + j, "7");
      put(c, AB.x + 12 + sp2, AB.y + j, "7");
    }
    rect(c, AB.x - 12, AB.y, 24, 27, (i, j) => (i === 0 || j === 0 || i === 23 || j === 26 ? "8" : "K"));
    textC(c, AB.x, AB.y + 2, "JUST", "J");
    textC(c, AB.x, AB.y + 8, "BREAD", "J");
    textC(c, AB.x, AB.y + 15, "MOVE", "J");
    textC(c, AB.x, AB.y + 21, "ALONG", "J");
    // The ground shadow.
    const sh = cv(HW, HH + HOY);
    blob(sh, HCX, HOY + HFOOT, 66, 5, (dx, dy) => (dy > -0.1 ? "`" : null));
    // The chimney's smoke (the oven's), three puffs rising and drifting east, a third of the loop apart.
    const smoke = cv(HW, HH + HOY);
    for (let k = 0; k < 3; k++) {
      const t = (f + k * 3) % 8;
      if (t > 6) continue;
      blob(smoke, R - 18 + t * 1.6, HOY - 1 - t * 2.2, 2 + t * 0.45, 1.6 + t * 0.35, (dx, dy) => (dy < -0.1 ? "X" : "x"));
    }
    frames.push(bits(cropBit(sh, false), cropBit(c, true, 0, HOY), cropBit(smoke, false)));
  }
  const parts: Record<string, Part> = {};
  const fr: Frame[] = frames.map((bs, f) => ({
    ms: f >= 4 && f <= 6 ? 420 : 260,
    ...(f === 4 ? { cue: "peek" } : {}),
    layers: bs.map((b, i) => {
      const n = `f${f}p${i}`;
      parts[n] = b.part;
      return { part: n, x: b.at[0], y: b.at[1] } as Layer;
    }),
  }));
  return { id: "house-zebra", name: "The zebras' bakery", w: HW, h: HH + HOY, foot: [HCX, HOY + HFOOT], palette: PALETTE, parts, anims: { idle: { loop: true, frames: fr } } };
}
/** The bakery in the town: 144 x 146, its foot [72, 140] (the top 12 px are sky for the chimney's smoke). Idle: 8 frames (2.6 s): the chimney puffs; at f4-f6 a slat of the door's blind
 * lifts and two eyes look left, ahead, right (cue `peek` f4), then it drops. */
export const HOUSE_ZEBRA: Character = makeHouse();
/** Its windows' warm light at dusk and night (the display window, the door's glass, the east window). */
export const HOUSE_ZEBRA_LIGHTS: readonly LightSpot[] = [
  { x: 19, y: HOY + 72, w: 54, h: 33, keys: "89", color: "#ffb85c", strength: 0.8 },
  { x: 106, y: HOY + 72, w: 20, h: 30, keys: "89", color: "#ffb85c", strength: 0.7 },
  ...[SIGN.x + 16, SIGN.x + SIGN.w - 13].map((x) => ({ x, y: HOY + SIGN.y - 7, w: 4, h: 1, keys: "L", color: "#ffd08a", strength: 0.9, halo: 8 })),
];
