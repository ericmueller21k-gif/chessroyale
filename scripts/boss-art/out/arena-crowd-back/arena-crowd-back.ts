import type { Character, Part, Anim } from "../../../../packages/app/src/characters/sprite.ts";
import { paint } from "../../../../packages/app/src/town/houses/kit.ts";

/** Body colors: [shade, mid, lit] keys and values. */
const COLORS: Record<string, [string, string, string, string, string, string]> = {
  red: ["A", "B", "C", "#8e2a2a", "#c94040", "#ef7a6a"],
  blue: ["D", "E", "F", "#22407a", "#3a6cc0", "#74a6ea"],
  green: ["G", "H", "I", "#2a6a32", "#45a04c", "#86d07a"],
  gold: ["J", "K", "L", "#a8721a", "#e0a530", "#ffd877"],
  purple: ["P", "Q", "S", "#4e2a78", "#7c4cb4", "#b285e0"],
};

const palette: Record<string, string> = {
  k: "#2a1c14",
  T: "#bdb29c",
  U: "#9a907e",
  V: "#6e665a",
};
for (const c of Object.values(COLORS)) {
  palette[c[0]] = c[3];
  palette[c[1]] = c[4];
  palette[c[2]] = c[5];
}

const parts: Record<string, Part> = {};
const anims: Record<string, Anim> = {};
const CX = 9; // the middle of the frame

for (const [name, c] of Object.entries(COLORS)) {
  const [sh, md, lt] = c;
  // the ball: centre (9, 6.5), radius 4.6
  const head = paint(4, 2, 10, 10, (x, y) => {
    const dx = x + 0.5 - CX;
    const dy = y + 0.5 - 6.8;
    const d = Math.hypot(dx, dy);
    if (d > 4.7) return null;
    if (dx + dy < -2.6 && d > 1.4) return lt;
    if (dx + dy > 2.4 || (d > 3.6 && dx + dy > 0.5)) return sh;
    return md;
  });
  // the collar ring: a flat disc
  const collar = paint(4, 12, 10, 2, (x, y) => {
    const i = x - 4;
    if (y === 12) return i < 3 ? lt : i > 7 ? sh : md;
    return i < 2 ? md : sh;
  });
  // the bell body: narrow under the collar, flaring to a wide base
  const body = paint(2, 14, 14, 7, (x, y) => {
    const j = y - 14; // 0..6
    const half = [2.5, 2.5, 3, 3.5, 4.5, 6, 7][j]!;
    const dx = x + 0.5 - CX;
    if (Math.abs(dx) > half) return null;
    const u = (dx + half) / (2 * half); // 0 left .. 1 right
    if (j === 6) return u < 0.3 ? md : sh; // the foot's rim in shadow
    if (u < 0.3) return lt;
    if (u > 0.72) return sh;
    return md;
  });
  parts[`${name}Head`] = head.part;
  parts[`${name}Collar`] = collar.part;
  parts[`${name}Body`] = body.part;
  anims[name] = {
    loop: false,
    frames: [
      {
        ms: 1000,
        layers: [
          { part: `${name}Body`, x: body.at[0], y: body.at[1] },
          { part: `${name}Collar`, x: collar.at[0], y: collar.at[1] },
          { part: `${name}Head`, x: head.at[0], y: head.at[1] },
        ],
      },
    ],
  };
}

// the far crowd: a head dot on a shoulders blob, 7 x 8 with its outline, in a neutral tone to tint
parts.far = {
  outline: false,
  grid: [
    "..kkk..",
    ".kTUUk.",
    ".kUUVk.",
    "..kkk..",
    ".kTUUk.",
    "kTUUUVk",
    "kUUUVVk",
    "kkkkkkk",
  ],
};
anims.far = { loop: false, frames: [{ ms: 1000, layers: [{ part: "far", x: 6, y: 14 }] }] };

export const ARENA_CROWD_BACK: Character = {
  id: "arena-crowd-back",
  name: "Crowd from behind",
  w: 18,
  h: 22,
  foot: [9, 21],
  palette,
  halo: "#fbf0d830",
  parts,
  anims,
};
