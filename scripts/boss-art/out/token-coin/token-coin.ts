import type { Character, Part } from "../../../../packages/app/src/characters/sprite.ts";

// The game's coin: the boss tokens' gold rim, a gold field, a struck king's head in the middle.

const W = 40;
const H = 40;

/** The coin disc: rim, rivets, dark inner ring, gold field. The engine adds the outer `k` outline. */
function coinGrid(): string[] {
  const rows: string[] = [];
  const rivets = new Map<string, string>();
  // Four rivets on the rim (2 x 2 studs, lit top left).
  for (const [rx, ry] of [
    [19, 2],
    [19, 36],
    [2, 19],
    [36, 19],
  ] as const) {
    rivets.set(`${rx},${ry}`, "y");
    rivets.set(`${rx + 1},${ry}`, "O");
    rivets.set(`${rx},${ry + 1}`, "O");
    rivets.set(`${rx + 1},${ry + 1}`, "O");
  }
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const dx = x - 19.5;
      const dy = y - 19.5;
      const d = Math.hypot(dx, dy);
      if (d >= 18.3) {
        row += ".";
        continue;
      }
      // Light from the top left: +1 facing it, -1 facing away.
      const l = d > 0 ? -(dx + dy) / (d * Math.SQRT2) : 0;
      const p = (dx + dy) / Math.SQRT2; // along the bottom-right diagonal
      let c: string;
      if (d >= 14.2) {
        const rv = rivets.get(`${x},${y}`);
        if (rv) c = rv;
        else if (d >= 17.0) c = l > -0.35 ? "y" : "Y";
        else if (d < 15.2) c = l > 0.35 ? "Y" : "O";
        else c = l < -0.75 ? "O" : "Y";
      } else if (d >= 13.1) c = "k";
      else if (d >= 12.1 && l > 0.2) c = "D"; // the rim's shadow on the field, top left
      else c = p > 5.5 ? "D" : "G";
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

// The king's head: cross, knob, two lobes, the band with two rings. 20 wide, 21 tall.
const KING = [
  ".........WV.........",
  ".......WWWWWV.......",
  ".......VVVVVS.......",
  ".........WV.........",
  "........WWVV........",
  ".......WWWVVS.......",
  "..WWW..WWVVVS..WWV..",
  ".WWWWV..VVVS..WWWVS.",
  "WWWVVVV..VS..WWVVVVS",
  "WWVVVVVV....WVVVVVVS",
  "WVVVVVVVS..WVVVVVVSS",
  "WVVVVVVVS..VVVVVVVSS",
  "VVVVVVVSS..VVVVVVSSS",
  ".VVVVVSSS..VVVVVSSS.",
  ".SSSSSSSS..SSSSSSSS.",
  ".kkkkkkkkkkkkkkkkkk.",
  ".WWWWWWWWVVVVVVVVVS.",
  ".VVVVVVVVVVVVVVVSSS.",
  ".kkkkkkkkkkkkkkkkkk.",
  "..WWWWWWVVVVVVVVSS..",
  "..VVVVVVVVVVSSSSSS..",
];

const parts: Record<string, Part> = {
  coin: { grid: coinGrid() },
  king: { grid: KING },
};

export const TOKEN_COIN: Character = {
  id: "token-coin",
  name: "Coin",
  w: W,
  h: H,
  foot: [20, 39],
  palette: {
    k: "#2a1c14",
    // The rim, as on the boss tokens.
    y: "#ffe08a",
    Y: "#f4b740",
    O: "#b97c10",
    // The field: a deeper, warmer gold, banded darker toward the bottom right.
    G: "#dc9a24",
    D: "#b8760e",
    // The struck king: ivory lit, pale gold mid, gold shade.
    W: "#fff4cc",
    V: "#f5d888",
    S: "#d9a84a",
  },
  halo: "#ffe08a40",
  parts,
  anims: {
    idle: {
      loop: true,
      frames: [
        {
          ms: 1000,
          layers: [
            { part: "coin", x: 0, y: 0 },
            { part: "king", x: 10, y: 8 },
          ],
        },
      ],
    },
  },
};
