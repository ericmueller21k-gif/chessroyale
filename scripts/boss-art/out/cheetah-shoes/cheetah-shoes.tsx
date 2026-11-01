import type { RiderDraft, RiderProps, Paint } from "../../item-kit.tsx";
import { Region, LINE, lw } from "../../item-kit.tsx";

const TAN = "#efb24e";
const TAN_D = "#c9822a";
const SPOT = "#2a1c12";
const WHITE = "#fbfaf6";
const WHITE_D = "#d9d6cc";

/** Shift a path drawn round the shoe's own heel (0, 0 = heel on the ground) to (bx, gy). */
const K = 1.16;
const at = (d: string, bx: number, gy: number) =>
  d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${(Number(x) * K + bx).toFixed(2)} ${(Number(y) * K + gy).toFixed(2)}`);

// The shoe, toe to our right, heel at x 0, ground at y 0, about 46 long and 30 tall.
const SOLE = "M -1 -6 L 41 -7 Q 48 -7 47 -3 Q 45 0 39 0 L 3 0 Q -1 0 -1 -3 Z";
const MID = "M -1 -11.5 L 42 -11.5 Q 46.5 -11 46.5 -7.5 L 41 -6.5 L -1 -6 Z";
const UPPER = "M 0 -11 L 0 -22 Q 0 -27 5 -27 L 13 -25 L 18 -29 Q 22 -31 25 -27.5 L 37 -19.5 Q 46 -16.5 46 -11 Z";
const TAB = "M -2.5 -19 L -2.5 -28 Q -2 -31 2 -30 L 5 -27.5 L 4 -19 Z";
const BOW = [
  "M 19.5 -29.5 Q 13 -36 11.5 -31.5 Q 12 -28 19.5 -29.5 Z",
  "M 19.5 -29.5 Q 23 -37.5 27 -34 Q 27 -30 19.5 -29.5 Z",
];
const SPOTS: [number, number, number, number][] = [
  [5, -20, 2.4, 1.8],
  [11, -15, 2.2, 1.6],
  [16, -21, 1.8, 1.5],
  [21, -15.5, 2.6, 1.8],
  [28, -20.5, 1.6, 1.3],
  [31, -14.5, 2.2, 1.6],
  [38.5, -14.5, 1.6, 1.3],
  [4, -14, 1.4, 1.2],
];

/** Lace bars across the shoe's top edge, from the tongue down to the toe. */
const LACES = (() => {
  const out: string[] = [];
  const ux = 0.83, uy = 0.56; // along the slope
  const vx = 0.56, vy = -0.83; // across it (pointing up)
  const centers: [number, number][] = [
    [23.5, -26.8],
    [28.5, -23.5],
    [33.5, -20.2],
  ];
  for (const [cx, cy] of centers) {
    const a = 3.4, b = 1.3;
    const pts = [
      [cx - vx * a - ux * b, cy - vy * a - uy * b],
      [cx + vx * a - ux * b, cy + vy * a - uy * b],
      [cx + vx * a + ux * b, cy + vy * a + uy * b],
      [cx - vx * a + ux * b, cy - vy * a + uy * b],
    ];
    out.push(`M ${pts.map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join(" L ")} Z`);
  }
  return out;
})();

interface ShoeAt {
  ox: number;
  oy: number;
  rot: number;
  /** Rotate round the heel (h), the toe (t) or the middle (m). */
  pivot?: "h" | "t" | "m";
}

function Shoe({ p, bx, gy, name, s, far }: { p: Paint; bx: number; gy: number; name: string; s: ShoeAt; far?: boolean }) {
  const px = s.pivot === "h" ? bx : s.pivot === "t" ? bx + 44 * K : bx + 22 * K;
  const py = s.pivot === "m" || !s.pivot ? gy - 13 * K : gy;
  const clip = `${p.id}-${name}-up`;
  const up = at(UPPER, bx, gy);
  return (
    <g transform={`translate(${s.ox} ${s.oy}) rotate(${s.rot} ${px} ${py})`}>
      <Region p={p} name={`${name}-tab`} d={[at(TAB, bx, gy)]} line={2.4} />
      <clipPath id={clip}>
        <path d={up} />
      </clipPath>
      <path d={up} fill={far ? TAN_D : TAN} />
      <g clip-path={`url(#${clip})`}>
        {SPOTS.map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={bx + x * K} cy={gy + y * K} rx={rx * K} ry={ry * K} fill={SPOT} transform={`rotate(${(i * 37) % 60 - 30} ${bx + x * K} ${gy + y * K})`} />
        ))}
        {/* a soft highlight along the top */}
        <path d={at("M 3 -24 Q 8 -24.5 12 -23", bx, gy)} fill="none" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.8)} />
      </g>
      <path d={up} fill="none" {...LINE} />
      {/* the collar opening */}
      <path d={at("M 3.5 -26 Q 9 -23 15 -25.6", bx, gy)} fill="none" {...LINE} {...lw(2)} />
      <path d={at(MID, bx, gy)} fill={far ? WHITE_D : WHITE} {...LINE} {...lw(2.4)} />
      <Region p={p} name={`${name}-sole`} d={[at(SOLE, bx, gy)]} line={2.6} />
      <path d={at("M 8 -3 L 12 -3 M 18 -3 L 22 -3 M 28 -3 L 32 -3", bx, gy)} fill="none" stroke="#1d1d1f" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.6)} />
      <Region p={p} name={`${name}-laces`} d={LACES.map((d) => at(d, bx, gy))} line={1.6} />
      <Region p={p} name={`${name}-bow`} d={BOW.map((d) => at(d, bx, gy))} line={1.6} />
    </g>
  );
}

// Home spots: the near shoe a little ahead, the far one a little behind and higher.
const NEAR = { bx: 34, gy: 95 };
const FAR = { bx: 10, gy: 91 };

// The run: one shoe's six beats; the other shoe is three beats behind.
const RUN: ShoeAt[] = [
  { ox: 12, oy: 0, rot: -10, pivot: "h" }, // heel strikes, reaching
  { ox: 2, oy: 0, rot: 0 }, // flat, under the pawn
  { ox: -10, oy: 0, rot: 15, pivot: "t" }, // heel up, pushing off
  { ox: -30, oy: -14, rot: 55 }, // kicked back, sole up behind
  { ox: -8, oy: -12, rot: 8 }, // swinging through
  { ox: 10, oy: -7, rot: -14 }, // reaching forward
];
const IDLE_NEAR: ShoeAt[] = [
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: -15, pivot: "h" },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: -15, pivot: "h" },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 9, pivot: "t" },
  { ox: 0, oy: 0, rot: 0 },
];
const IDLE_FAR: ShoeAt[] = [
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 0 },
  { ox: 0, oy: 0, rot: 9, pivot: "t" },
  { ox: 0, oy: 0, rot: 0 },
];

const nearAt = (anim: "idle" | "move", f: number) => (anim === "move" ? RUN[f % 6] : IDLE_NEAR[f % 8]);
const farAt = (anim: "idle" | "move", f: number): ShoeAt => {
  if (anim !== "move") return IDLE_FAR[f % 8];
  const s = RUN[(f + 3) % 6];
  // on the run the far foot strides out ahead of the pawn's base, so its toe shows
  return { ...s, ox: s.ox + 18, oy: s.oy - 1 };
};

/** Speed lines streaming off the pawn's back. */
function SpeedLines({ f }: { f: number }) {
  const lines: [number, number, number][] = [
    [40, 4, 18],
    [54, 0, 22],
    [68, 6, 16],
  ];
  return (
    <g>
      {lines.map(([y, x, len], i) => {
        const sh = ((f + i * 2) % 3) * 3;
        const x1 = x + sh;
        const x2 = x1 + len - sh;
        const d = `M ${x1} ${y} L ${x2} ${y}`;
        return (
          <g key={i}>
            <path d={d} stroke="#1d1d1f" stroke-linecap="round" {...lw(5.4)} />
            <path d={d} stroke="#fff" stroke-linecap="round" {...lw(2.4)} />
          </g>
        );
      })}
    </g>
  );
}

/** A kick of dust at the pushing foot (goes along with the ride). */
function Dust({ f }: { f: number }) {
  // beats 2, 3, 4 after each push-off (near pushes on beat 2, far on beat 5)
  const k = (f + 4) % 3; // 0 just kicked, 1 bigger, 2 fading
  const x = f % 6 >= 2 && f % 6 <= 4 ? 26 : 14;
  const s = [0.8, 1.05, 1.15][k];
  const o = [1, 0.9, 0.55][k];
  const puffs: [number, number, number][] = [
    [0, 0, 5],
    [-7, -3, 4],
    [-13, 1, 3],
  ];
  return (
    <g opacity={o} transform={`translate(${x} 92) scale(${s})`}>
      {puffs.map(([px, py, r], i) => (
        <circle key={i} cx={px - k * 3} cy={py - k * 1.5} r={r} fill="#e9d3a4" {...LINE} {...lw(2)} />
      ))}
    </g>
  );
}

export const cheetahShoes: RiderDraft = {
  id: "cheetah-shoes",
  name: "Cheetah Shoes",
  tier: "mythic",
  description: "Spotted, laced and twice as fast. Blitz says the spots are just for show; the speed is not.",
  frame: [12, 4, 82, 94],
  idle: { ms: [320, 90, 90, 90, 90, 220, 110, 140] },
  move: { ms: [70, 70, 70, 70, 70, 70] },
  pose(anim, f) {
    if (anim === "move") {
      const bob = [2, -1, -4, 2, -1, -4][f % 6];
      return { dx: (f % 6) * (100 / 6), dy: bob, pawnX: 3, pawnY: -15, pawnTilt: 12, cut: 86 };
    }
    const up = [0, 0, 0, 0, 0, 0, -3, 0.5][f % 8];
    return { dx: 0, dy: 0, pawnX: 0, pawnY: -15 + up, cut: 86 };
  },
  Back({ p, f, anim }: RiderProps) {
    return (
      <g>
        {anim === "move" && <SpeedLines f={f} />}
        {anim === "move" && <Dust f={f} />}
        <Shoe p={p} bx={FAR.bx} gy={FAR.gy} name="far" s={farAt(anim, f)} far />
      </g>
    );
  },
  Front({ p, f, anim }: RiderProps) {
    return <Shoe p={p} bx={NEAR.bx} gy={NEAR.gy} name="near" s={nearAt(anim, f)} />;
  },
};
