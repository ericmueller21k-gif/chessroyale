/**
 * Arena statue: a marble pawn champion (crested helmet, round shield, short sword) on a sandstone plinth with a cornice,
 * a gold band and a base. Scenery for the Colosseum's inside. 40 x 80, foot (bottom center of the plinth) at (20, 79).
 */
import type { Character, Layer, Part } from "../../characters/sprite.ts";
import { grain, paint } from "../../town/houses/kit.ts";

const PALETTE: Record<string, string> = {
  k: "#2a1c14",
  "1": "#fbf0d8",
  "2": "#ecd9b2",
  "3": "#d8bf93",
  "4": "#bb9e70",
  "5": "#93784f",
  "6": "#6a5539",
  x: "#2e2018",
  z: "#150e0a",
  N: "#1f2a44",
  n: "#34466e",
  Y: "#f4b740",
  y: "#ffe08a",
  O: "#b97c10",
  M: "#f7f4ee",
  m: "#d9d3c7",
  o: "#a39b8d",
};

const CX = 20;
const parts: Record<string, Part> = {};
const layers: Layer[] = [];
function add(name: string, p: { part: Part; at: readonly [number, number] }) {
  parts[name] = p.part;
  layers.push({ part: name, x: p.at[0], y: p.at[1] });
}
const X = (x: number) => x + 0.5 - CX;

/** Stone block shading across a width: lit left, mid, shade right. */
const stone = (x: number, half: number, ramp = "234") => {
  const t = X(x) / half;
  return t < -0.62 ? ramp[0]! : t > 0.5 ? ramp[2]! : ramp[1]!;
};

/** Marble ball shading around (cx, cy). */
const marble = (x: number, y: number, cx: number, cy: number, r: number) => {
  const s = x + 0.5 - cx + (y + 0.5 - cy);
  return s < -r * 0.45 ? "M" : s > r * 0.55 ? "o" : "m";
};

// ---- The plinth: base, body, gold band, cornice.
add("base", paint(4, 72, 32, 7, (x, y) => {
  if (y === 72) return x < 9 ? "1" : "2";
  if (y === 73) return stone(x, 16, "234");
  if (y === 78) return "5";
  return stone(x, 16, "345");
}));
add("body", paint(8, 53, 24, 19, (x, y) => {
  if (y === 53) return "5"; // the cornice's shadow
  if (y >= 58 && y <= 60) {
    if (y === 58) return X(x) < -6 ? "y" : "Y";
    if (y === 60) return "O";
    return X(x) > 7 ? "O" : "Y";
  }
  if (y === 66) return X(x) > 7 ? "5" : "4"; // a joint
  const c = stone(x, 12, "234");
  if (c === "3" && (y === 63 || y === 69) && grain(x, y, 7) > 0.8) return "4";
  return c;
}));
add("cornice", paint(5, 48, 30, 5, (x, y) => {
  if (y === 48) return "1";
  if (y === 49) return X(x) > 11 ? "3" : "2";
  if (y === 50) return stone(x, 15, "345");
  return y === 52 ? "5" : stone(x, 15, "234");
}));

// ---- The pawn: foot, body, collar, head.
add("pfoot", paint(10, 42, 20, 6, (x, y) => {
  const hw = y >= 45 ? 10 : 8;
  if (Math.abs(X(x)) > hw) return null;
  if (y === 42 || y === 45) return X(x) < 3 ? "M" : "m";
  if (y === 47 || y === 44) return "o";
  return X(x) < -hw * 0.4 ? "M" : X(x) > hw * 0.5 ? "o" : "m";
}));
add("ptorso", paint(12, 23, 16, 19, (x, y) => {
  const t = (y - 23) / 18;
  const hw = 3.5 + t * 3.8;
  if (Math.abs(X(x)) > hw) return null;
  const u = X(x) / hw;
  return u < -0.4 ? "M" : u > 0.45 ? "o" : "m";
}));
add("collar", paint(13, 20, 14, 3, (x, y) => {
  if (Math.abs(X(x)) > 6) return null;
  if (y === 22) return "o";
  return X(x) < -2 ? "M" : X(x) > 3 ? "o" : "m";
}));
add("head", paint(13, 8, 14, 13, (x, y) => {
  const dx = x + 0.5 - 20;
  const dy = y + 0.5 - 14.5;
  if (Math.hypot(dx, dy) > 6.4) return null;
  if (y <= 13) {
    // the helmet: dome, gold brim, a cheek guard down the near side
    if (y === 13) return dx < -2 ? "y" : dx > 3 ? "O" : "Y";
    return marble(x, y, 20, 14.5, 6);
  }
  if (y === 15 && dx > -4 && dx < 3) return "x"; // the visor's slit
  if (dx < -3.5) return y < 19 ? "m" : "o"; // the cheek guard
  return marble(x, y, 18.5, 15, 6);
}));
add("crest", paint(14, 2, 13, 7, (x, y) => {
  // an arc of horsehair from front to back over the helmet
  const dx = x + 0.5 - 20.5;
  const dy = y + 0.5 - 9;
  const d = Math.hypot(dx * 0.85, dy);
  // a tall narrow fin of horsehair, seen from the front, flaring at the top
  const hw = y <= 4 ? 3 : y <= 6 ? 2.5 : 1.6;
  if (y < 3 || y > 7 || Math.abs(dx) > hw) return null;
  if (y === 3) return Math.abs(dx) > 2 ? null : dx < 0 ? "M" : "m";
  return dx < -0.6 ? "M" : dx > 0.8 ? "o" : "m";
}));

// ---- The sword arm (back) and the sword raised on the right.
add("sword", paint(29, 8, 5, 22, (x, y) => {
  const i = x - 29;
  if (y === 8) return i === 2 ? "M" : null; // the point
  if (y < 23) return i === 1 ? "M" : i === 2 ? "m" : i === 3 ? "o" : null;
  if (y === 23) return i === 0 ? "y" : i === 4 ? "O" : "Y"; // the guard
  if (y < 28) return i === 2 ? "O" : null; // the grip
  return i === 2 ? "Y" : null; // the pommel
}));
add("arm", paint(24, 25, 9, 6, (x, y) => {
  const t = (x - 24) / 8;
  const cy = 29 - t * 2.5;
  if (Math.abs(y + 0.5 - cy) > 1.6) return null;
  return y + 0.5 < cy - 0.4 ? "m" : "o";
}));
add("fist", paint(29, 24, 4, 4, (x, y) => marble(x, y, 31, 26, 2)));

// ---- The round shield in front on the left: marble face, gold rim and boss.
add("shield", paint(3, 23, 17, 17, (x, y) => {
  const dx = x + 0.5 - 11.5;
  const dy = y + 0.5 - 31.5;
  const d = Math.hypot(dx, dy);
  if (d > 8.3) return null;
  if (d > 7) return dx + dy < -3 ? "y" : dx + dy > 4 ? "O" : "Y";
  if (d < 2.2) return dx + dy < -0.5 ? "y" : "Y";
  if (d < 3) return "O";
  const s = dx + dy;
  return s < -4 ? "M" : s > 4 ? "o" : "m";
}));

export const ARENA_STATUE: Character = {
  id: "arena-statue",
  name: "Arena statue",
  w: 40,
  h: 80,
  foot: [20, 79],
  palette: PALETTE,
  parts,
  anims: { idle: { loop: true, frames: [{ layers, ms: 1000 }] } },
};
