import type { Character, Frame, Speck } from "../../../../packages/app/src/characters/sprite.ts";

const C = 20; // the coin's middle (pixel corner)
const rad = (x: number, y: number) => Math.hypot(x + 0.5 - C, y + 0.5 - C);
const inside = (x: number, y: number) => rad(x, y) < 13.6;

type Fn = (x: number, y: number) => string | null;
function paint(x0: number, y0: number, w: number, h: number, fn: Fn) {
  const grid: string[] = [];
  for (let y = y0; y < y0 + h; y++) {
    let row = "";
    for (let x = x0; x < x0 + w; x++) row += fn(x, y) ?? ".";
    grid.push(row);
  }
  return { part: { grid }, at: [x0, y0] as const };
}

/** A face part over the whole frame, clipped to the navy middle, with its own k outline. */
function outlined(fn: Fn) {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= 40 || y >= 40 || !inside(x, y) ? null : fn(x, y));
  return paint(0, 0, 40, 40, (x, y) => {
    if (!inside(x, y)) return null;
    const v = at(x, y);
    if (v) return v;
    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) return "k";
    return null;
  });
}

// The coin: gold rim with rivets, a dark inner ring, the navy middle (the crest's own build).
const disc = paint(0, 0, 40, 40, (x, y) => {
  const dx = x + 0.5 - C;
  const dy = y + 0.5 - C;
  const r = Math.hypot(dx, dy);
  if (r > 18.4) return null;
  if (r > 15) {
    const lit = (-dx - dy) / (r * Math.SQRT2);
    const a = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const near = Math.abs(a / step - Math.round(a / step)) * step * r < 0.6;
    if (near && r > 16.2 && r < 17.3) return "O";
    if (r > 17.6) return lit < -0.4 ? "O" : "Y";
    return lit > 0.35 ? "y" : lit < -0.45 ? "O" : "Y";
  }
  if (r > 14.2) return "k";
  if (y >= 27) return "n";
  return "N";
});

/** Banded light from the top left over an ellipse: lit, mid, shade. */
const band = (nx: number, ny: number, lit: string, mid: string, shade: string) => {
  const l = -0.6 * nx - 0.8 * ny;
  return l > 0.45 ? lit : l < -0.3 ? shade : mid;
};
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  return { nx, ny, in: nx * nx + ny * ny < 1 };
};

// ---- Chirp, the grasshopper: behind, to the right ----
const chirpBody = outlined((x, y) => {
  const e = ell(x, y, 29.5, 32, 5.5, 4.5);
  if (!e.in) return null;
  if (e.ny > 0.2 && e.nx > -0.2) return "b"; // folded wing edge, in shade
  return band(e.nx, e.ny, "e", "d", "b");
});

function curve(p0: [number, number], p1: [number, number], p2: [number, number]) {
  const s = new Set<string>();
  for (let t = 0; t <= 1; t += 0.01) {
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    s.add(`${Math.floor(x)},${Math.floor(y)}`);
  }
  return s;
}
const ANT = new Set([
  ...curve([26.5, 18.5], [25, 7], [33, 5.5]),
  ...curve([29.5, 18.5], [30, 10.5], [36, 10]),
]);
const antennae = outlined((x, y) => (ANT.has(`${x},${y}`) ? "o" : null));

const chirpHead = outlined((x, y) => {
  const e = ell(x, y, 28, 23.5, 3.9, 5.4);
  if (!e.in) return null;
  // the big black eye, a white glint top left
  const eye = ell(x, y, 27, 21.6, 2.3, 2.7);
  if (eye.in) return (x === 25 && (y === 20 || y === 21)) || (x === 26 && y === 20) ? "w" : "x";
  if (y >= 26 && x <= 28) return y >= 27 ? "m" : "o"; // the mouth parts, yellow-green
  return band(e.nx, e.ny, "e", "d", "b");
});

// ---- Chub, the rabbit: in front, the bigger (drawn about x 16, set one pixel left) ----
const RX = 1;
const shift = (fn: Fn): Fn => (x, y) => fn(x + RX, y);
const earAt = (x: number, y: number, base: number) => {
  if (y < 4 || y > 15) return null;
  const cx = base + 0.22 * (15 - y);
  const t = (y + 0.5 - 10) / 5.6;
  const hw = 2.2 * Math.sqrt(Math.max(0, 1 - t * t));
  const d = x + 0.5 - cx;
  if (Math.abs(d) > hw) return null;
  if (y >= 6 && y <= 14 && Math.abs(d) < hw - 1.2) return d > 0.3 ? "q" : "p";
  return d < 0 ? "I" : "G";
};
const ears = outlined(shift((x, y) => earAt(x, y, 13.5) ?? earAt(x, y, 19)));

const rBody = outlined(shift((x, y) => {
  if (y < 26) return null;
  const d = x + 0.5 - 16;
  const hw = 4.5 + (y - 26) * 1.3;
  if (Math.abs(d) > hw) return null;
  const chest = ell(x, y, 16, 32.5, 2.8, 3.6);
  if (chest.in) return chest.nx < -0.3 && chest.ny < 0 ? "E" : chest.nx > 0.4 ? "C" : "D";
  return d < -hw + 1.6 ? "I" : d > hw - 2 ? "G" : "H";
}));

const scarf = outlined(shift((x, y) => {
  const d = x + 0.5 - 16;
  // the band round his neck
  if (y >= 25 && y <= 27 && Math.abs(d) < 6 - (y === 25 ? 1 : 0)) {
    if (x === 12 && y === 26) return "Y"; // the gold clasp
    return y === 25 ? "V" : y === 27 ? "T" : d > 3 ? "T" : "U";
  }
  // its tail, falling over his left shoulder
  if (y >= 28 && y <= 31 && x >= 11 - (y - 28 > 1 ? 1 : 0) && x <= 12 - (y - 28 > 1 ? 1 : 0)) return x === 11 || x === 10 ? "U" : "T";
  return null;
}));

const rHead = outlined(shift((x, y) => {
  const e = ell(x, y, 16, 20, 6.9, 5.6);
  if (!e.in) return null;
  // eyes: black, a white glint
  if ((y === 18 || y === 19) && ((x >= 12 && x <= 13) || (x >= 18 && x <= 19))) return y === 18 && (x === 12 || x === 18) ? "w" : "x";
  // nose and the little mouth
  if (y === 21 && (x === 15 || x === 16)) return x === 15 ? "p" : "q";
  if (y === 22 && (x === 14 || x === 17)) return "k";
  if (y === 23 && (x === 15 || x === 16)) return "k";
  // cheeks
  if (y === 21 && (x === 11 || x === 20)) return "p";
  // cream muzzle
  const m = ell(x, y, 16, 22.6, 3.8, 2.6);
  if (m.in) return m.nx > 0.45 || m.ny > 0.6 ? "C" : "D";
  return band(e.nx, e.ny, "I", "H", "G");
}));

const W = (part: string) => ({ part, x: 0, y: 0 });
const layers = [W("disc"), W("chirpBody"), W("antennae"), W("chirpHead"), W("ears"), W("rBody"), W("scarf"), W("rHead")];

// A glint riding round the rim: four steps from the top left, then rest.
function glint(deg: number): Speck[] {
  const a = deg * (Math.PI / 180);
  const r = 16.7;
  const at = (da: number): [number, number] => [Math.floor(C + r * Math.cos(a + da)), Math.floor(C + r * Math.sin(a + da))];
  const [x, y] = at(0);
  const [x1, y1] = at(0.09);
  const [x2, y2] = at(-0.09);
  return [[x1, y1, "y"], [x2, y2, "y"], [x, y - 2, "y"], [x, y + 2, "y"], [x - 2, y, "y"], [x + 2, y, "y"], [x, y - 1, "M"], [x, y + 1, "M"], [x - 1, y, "M"], [x + 1, y, "M"], [x, y, "M"]];
}

// Chub blinks (a grasshopper has no lids).
const BLINK: Speck[] = [12, 13, 18, 19].flatMap((x) => [[x - RX, 18, "H"], [x - RX, 19, "k"]] as Speck[]);
const frame = (ms: number, specks: Speck[] = []): Frame => ({ layers, ms, specks });

export const TOKEN_HOPPER: Character = {
  id: "token-hopper",
  name: "Chub & Chirp token",
  w: 40,
  h: 40,
  foot: [20, 39],
  palette: {
    k: "#2a1c14",
    Y: "#f4b740",
    y: "#ffe08a",
    O: "#b97c10",
    N: "#1f2a44",
    n: "#34466e",
    M: "#fffbea",
    // Chub's fur, cream, pink
    G: "#7b5739",
    H: "#a07a51",
    I: "#c39e70",
    C: "#cbb592",
    D: "#e7d8b8",
    E: "#f8f0de",
    p: "#e6939b",
    q: "#b65f6e",
    // his scarf
    T: "#22694a",
    U: "#2f8c5f",
    V: "#57b47f",
    // Chirp's greens, his mouth parts and antennae, his eye
    b: "#447a1f",
    d: "#62a02a",
    e: "#86c13a",
    m: "#959431",
    o: "#e3da7a",
    x: "#0b0a08",
    w: "#ffffff",
  },
  halo: "#ffe08a33",
  parts: {
    disc: disc.part,
    chirpBody: chirpBody.part,
    antennae: antennae.part,
    chirpHead: chirpHead.part,
    ears: ears.part,
    rBody: rBody.part,
    scarf: scarf.part,
    rHead: rHead.part,
  },
  anims: {
    idle: {
      loop: true,
      frames: [
        frame(180, glint(-135)),
        frame(180, glint(-75)),
        frame(180, glint(-15)),
        frame(180, glint(45)),
        frame(1400),
        frame(150, BLINK),
      ],
    },
  },
};
