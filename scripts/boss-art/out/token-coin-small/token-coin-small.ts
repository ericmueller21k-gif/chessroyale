import type { Character } from "../../../../packages/app/src/characters/sprite.ts";

// The coin at 20 x 20, placed by hand: k outline, 2-px rim lit top-left, 1-px dark inner ring,
// gold middle (darker bottom right), the king's head as a pale-gold emblem. No rivets, no halo.
const COIN = [
  "......kkkkkkkk......",
  "....kkHHHHHHYYkk....",
  "...kHHHHHkHHHYYYk...",
  "..kHHHrrkWkrrrYYYk..",
  ".kHHrrGkWPPkGGrrYYk.",
  ".kHHrGGGkPkGGGGrYYk.",
  "kHHrGkkkWPPkkkGGrYYk",
  "kHHrkWPkPPpkPpkGrYYk",
  "kHHkWPPPPkPPPppkrYDk",
  "kHYkPPPPPkPPPppkrYDk",
  "kYYkPPPPPPPPPppkrDDk",
  "kYYrkkkkkkkkkkkgrDDk",
  "kYYrkWPPPPPPPpkgrDDk",
  "kYYrkdddddddddkgrDDk",
  ".kYYkPPPPPPPPpkrDDk.",
  ".kYYkkkkkkkkkkkrDDk.",
  "..kYYYrrrrrrrrDDDk..",
  "...kYYDDDDDDDDDDk...",
  "....kkDDDDDDDDkk....",
  "......kkkkkkkk......",
];

export const TOKEN_COIN_SMALL: Character = {
  id: "token-coin-small",
  name: "Coin (small)",
  w: 20,
  h: 20,
  foot: [10, 19],
  palette: {
    k: "#24160a",
    H: "#ffe27a",
    Y: "#f2b632",
    D: "#c47a18",
    r: "#6a3a10",
    G: "#e8a828",
    g: "#c4841c",
    W: "#fffbe8",
    P: "#ffe9a8",
    p: "#e2bc66",
    d: "#9a6418",
  },
  parts: {
    coin: { grid: COIN, outline: false },
  },
  anims: {
    idle: { loop: true, frames: [{ layers: [{ part: "coin", x: 0, y: 0 }], ms: 1000 }] },
  },
};
