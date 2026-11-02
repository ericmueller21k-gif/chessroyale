import type { Character } from "../../../../packages/app/src/characters/sprite.ts";
import { TOWN_FEEL } from "../../../../packages/app/src/town/feel.ts";
const n = Math.round(TOWN_FEEL.sitSeat * 37);
const rows = Array.from({ length: n }, () => "a");
export const HOUSE_INTRO_BIGBOY: Character = {
  id: "house-intro-bigboy", name: "t", w: 20, h: 40, foot: [10, 39],
  palette: { k: "#000000", a: "#ff0000", b: "#ffffff" },
  parts: { bar: { grid: rows, outline: false }, tick: { grid: Array.from({ length: 40 }, (_, i) => (i === 10 ? "bbbbbbbb" : i === 11 ? "b......." : i === 12 ? "bbbb...." : "")), outline: false } },
  anims: { idle: { loop: true, frames: [{ ms: 100, layers: [{ part: "bar", x: 2, y: 0 }, { part: "tick", x: 4, y: 0 }] }] } },
};
