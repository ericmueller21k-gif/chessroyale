import type { RiderDraft, RiderProps, Paint, RiderViewDraft } from "../../item-kit.tsx";
import { Region, LINE, lw, darken } from "../../item-kit.tsx";

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

// ---- Front and back views: the two shoes end-on, side by side under the pawn. ----

type EndView = "front" | "back";
/** One shoe's state seen end-on: lifted, its sole's underside showing (tread 0-1.3), its size (nearer is bigger), a roll. */
interface EndAt {
  lift: number;
  tread: number;
  s?: number;
  roll?: number;
  behind?: boolean;
}

const r2 = (n: number) => n.toFixed(2);
/** The sole's end edge, and its underside below it when the shoe tips (b: how much of the underside shows). */
const SOLE_E = (b: number) =>
  `M -11 -6 L 11 -6 Q 12.5 -6 12.5 -3.5 L 12.5 ${r2(b - 3)} Q 12 ${r2(b)} 8 ${r2(b)} L -8 ${r2(b)} Q -12 ${r2(b)} -12.5 ${r2(b - 3)} L -12.5 -3.5 Q -12.5 -6 -11 -6 Z`;
const MID_E = "M -11 -11.5 L 11 -11.5 Q 12.5 -11 12.5 -8.5 L 12.5 -6 L -12.5 -6 L -12.5 -8.5 Q -12.5 -11 -11 -11.5 Z";
const UPPER_F = "M -11.5 -11 Q -12.5 -19 -10.5 -24 Q -8.5 -28.5 -4.5 -28.5 L 4.5 -28.5 Q 8.5 -28.5 10.5 -24 Q 12.5 -19 11.5 -11 Z";
const UPPER_B = "M -11.5 -11 Q -12.5 -20 -10.5 -25 Q -9 -28.5 -5 -28.5 L 5 -28.5 Q 9 -28.5 10.5 -25 Q 12.5 -20 11.5 -11 Z";
const TONGUE_F = "M -4.2 -26 L -4 -33 Q 0 -35.5 4 -33 L 4.2 -26 Z";
const THROAT_F = "M -4 -15.5 L 4 -15.5 L 3.4 -28 L -3.4 -28 Z";
const LACES_F = ([
  [-17.6, 4.8],
  [-21.4, 4.4],
  [-25.2, 4],
] as [number, number][]).map(([y, h]) => `M ${-h} ${y - 1.25} L ${h} ${y - 1.25} Q ${h + 1} ${y} ${h} ${y + 1.25} L ${-h} ${y + 1.25} Q ${-h - 1} ${y} ${-h} ${y - 1.25} Z`);
const BOW_F = [
  "M 0 -29 Q -8 -35 -8.5 -30.5 Q -7 -27 0 -29 Z",
  "M 0 -29 Q 8 -35 8.5 -30.5 Q 7 -27 0 -29 Z",
];
const TAB_B = "M -3.2 -17 L -3.2 -30.5 Q 0 -33 3.2 -30.5 L 3.2 -17 Z";
const SPOTS_F: [number, number, number, number][] = [
  [-8, -15, 2.2, 1.6],
  [7.5, -14.5, 2, 1.5],
  [-8.5, -21.5, 1.8, 1.4],
  [8, -21, 2.2, 1.6],
  [-6.5, -26, 1.4, 1.1],
  [6.5, -26.5, 1.4, 1.1],
  [-2, -12.8, 1.5, 1.1],
];
const SPOTS_B: [number, number, number, number][] = [
  [-7.5, -15, 2.3, 1.7],
  [6.5, -14, 2, 1.5],
  [-8, -22, 1.8, 1.4],
  [7.5, -21.5, 2.2, 1.6],
  [-6, -26.3, 1.3, 1],
  [6.5, -26.5, 1.3, 1],
  [0, -13.5, 1.6, 1.1],
];

function EndShoe({ p, cx, view, name, st, flip }: { p: Paint; cx: number; view: EndView; name: string; st: EndAt; flip?: boolean }) {
  const gy = 95;
  const s = st.s ?? 1;
  const b = st.tread * 7;
  const sx = flip ? -1 : 1;
  const clip = `${p.id}-${name}-up-${view}`;
  const up = at(view === "front" ? UPPER_F : UPPER_B, cx, gy);
  const spots = view === "front" ? SPOTS_F : SPOTS_B;
  const shade = !!st.behind;
  return (
    <g transform={`translate(0 ${-st.lift}) rotate(${(st.roll ?? 0) * sx} ${cx} ${gy}) translate(${cx} ${gy}) scale(${s}) translate(${-cx} ${-gy})`}>
      {view === "front" && <path d={at(TONGUE_F, cx, gy)} fill={shade ? TAN_D : TAN} {...LINE} {...lw(2)} />}
      <clipPath id={clip}>
        <path d={up} />
      </clipPath>
      <path d={up} fill={shade ? TAN_D : TAN} />
      <g clip-path={`url(#${clip})`}>
        {spots.map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={cx + x * sx * K} cy={gy + y * K} rx={rx * K} ry={ry * K} fill={SPOT} transform={`rotate(${((i * 37) % 60 - 30) * sx} ${cx + x * sx * K} ${gy + y * K})`} />
        ))}
        <path d={at(view === "front" ? "M -9 -17 Q -9.5 -21 -7.5 -24" : "M -9.5 -16 Q -10 -21 -8 -25", cx, gy)} fill="none" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.8)} />
      </g>
      <path d={up} fill="none" {...LINE} />
      {view === "front" ? (
        <g>
          <path d={at("M -11 -14 Q 0 -18.5 11 -14", cx, gy)} fill="none" {...LINE} {...lw(1.6)} />
          <path d={at(THROAT_F, cx, gy)} fill={shade ? darken(TAN_D, 0.1) : TAN_D} {...LINE} {...lw(1.6)} />
          <Region p={p} name={`${name}-laces`} d={LACES_F.map((d) => at(d, cx, gy))} line={1.6} />
          <Region p={p} name={`${name}-bow`} d={BOW_F.map((d) => at(d, cx, gy))} line={1.6} />
        </g>
      ) : (
        <g>
          <path d={at("M -9 -26 Q 0 -23.5 9 -26", cx, gy)} fill="none" {...LINE} {...lw(2)} />
          <Region p={p} name={`${name}-tab`} d={[at(TAB_B, cx, gy)]} line={2.4} />
        </g>
      )}
      <path d={at(MID_E, cx, gy)} fill={shade ? WHITE_D : WHITE} {...LINE} {...lw(2.4)} />
      <Region p={p} name={`${name}-sole`} d={[at(SOLE_E(b), cx, gy)]} line={2.6} />
      <path d={at("M -7 -3 L -3 -3 M 3 -3 L 7 -3", cx, gy)} fill="none" stroke="#1d1d1f" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.6)} />
      {b > 2 && (
        <path
          d={at(`M -11 0 L 11 0 M -7 ${r2(b / 2)} L -3 ${r2(b / 2)} M 3 ${r2(b / 2)} L 7 ${r2(b / 2)}`, cx, gy)}
          fill="none"
          stroke="#1d1d1f"
          stroke-opacity="0.45"
          stroke-linecap="round"
          {...lw(1.6)}
        />
      )}
    </g>
  );
}

// One shoe's six run beats seen end-on (as RUN): heel strike, flat, push-off, kicked back, swing through, reach.
const END_RUN: Record<EndView, EndAt[]> = {
  back: [
    { lift: 1, tread: 0, s: 0.96 },
    { lift: 0, tread: 0 },
    { lift: 4, tread: 0.5, roll: 3 },
    { lift: 15, tread: 1.3, s: 1.05, roll: 8 },
    { lift: 10, tread: 0.5, roll: 4 },
    { lift: 5, tread: 0, s: 0.96 },
  ],
  front: [
    { lift: 4, tread: 0.45, s: 1.03 },
    { lift: 0, tread: 0 },
    { lift: 0, tread: 0, s: 0.98, roll: 2 },
    { lift: 8, tread: 0, s: 0.92, roll: 10, behind: true },
    { lift: 9, tread: 0, s: 0.96, roll: 3 },
    { lift: 7, tread: 0.6, s: 1.04 },
  ],
};
const REST: EndAt = { lift: 0, tread: 0 };
// The idle: the near (right) shoe taps its toe twice, then both rise onto their toes.
const END_TOE_UP: Record<EndView, EndAt> = { front: { lift: 3, tread: 0.45, s: 1.02 }, back: { lift: 0.8, tread: 0, s: 0.99 } };
const END_HEEL_UP: Record<EndView, EndAt> = { front: { lift: 1, tread: 0, s: 0.98 }, back: { lift: 3, tread: 0.45, s: 1.02 } };
const endIdle = (view: EndView, f: number, near: boolean): EndAt => {
  const k = f % 8;
  if (k === 6) return END_HEEL_UP[view];
  if (near && (k === 1 || k === 3)) return END_TOE_UP[view];
  return REST;
};
const endAt = (view: EndView, anim: "idle" | "move", f: number, near: boolean): EndAt =>
  anim === "move" ? END_RUN[view][(f + (near ? 0 : 3)) % 6] : endIdle(view, f, near);
/** The near shoe is the pawn's right foot: on our left from the front, our right from behind. */
const endX = (view: EndView, near: boolean) => (near === (view === "front") ? 35.5 : 64.5);

/** A kick of dust beside the foot pushing off (goes along with the ride). */
function EndDust({ view, f }: { view: EndView; f: number }) {
  const nb = f % 6;
  const near = nb >= 2 && nb <= 4;
  const k = (near ? nb : (f + 3) % 6) - 2; // 0 just kicked, 1 bigger, 2 fading
  const cx = endX(view, near);
  const out = cx < 50 ? -1 : 1;
  const s = [0.8, 1.05, 1.15][k];
  const o = [1, 0.9, 0.55][k];
  const puffs: [number, number, number][] = [
    [0, 0, 4.5],
    [6, -3, 3.5],
    [10, 1, 2.6],
  ];
  return (
    <g opacity={o} transform={`translate(${cx + out * 14} 93) scale(${s * out} ${s})`}>
      {puffs.map(([px, py, r], i) => (
        <circle key={i} cx={px + k * 2.5} cy={py - k * 1.5} r={r} fill="#e9d3a4" {...LINE} {...lw(2 / s)} />
      ))}
    </g>
  );
}

function endShoes(view: EndView, p: Paint, anim: "idle" | "move", f: number, layer: "back" | "front") {
  const shoes = [true, false]
    .map((near) => ({ near, st: endAt(view, anim, f, near) }))
    .filter(({ st }) => (layer === "back") === !!st.behind)
    .sort((a, b) => a.st.lift - b.st.lift);
  return shoes.map(({ near, st }) => {
    const cx = endX(view, near);
    return <EndShoe key={near ? "n" : "f"} p={p} cx={cx} view={view} name={near ? "near" : "far"} st={st} flip={cx > 50} />;
  });
}

function endView(view: EndView): RiderViewDraft {
  // lean toward the planted foot: the near one plants on frames 0-2
  const lean = view === "back" ? 1 : -1;
  return {
    frame: [14, 4, 72, 94],
    idle: { ms: [320, 90, 90, 90, 90, 220, 110, 140] },
    move: { ms: [70, 70, 70, 70, 70, 70] },
    pose(anim, f) {
      if (anim === "move") {
        const bob = [2, -1, -4, 2, -1, -4][f % 6];
        const tilt = [2, 3, 1, -2, -3, -1][f % 6] * lean;
        return { dx: 0, dy: bob, pawnX: 0, pawnY: -15, pawnTilt: tilt, cut: 86 };
      }
      const up = [0, 0, 0, 0, 0, 0, -3, 0.5][f % 8];
      return { dx: 0, dy: 0, pawnX: 0, pawnY: -15 + up, cut: 86 };
    },
    Back({ p, f, anim }: RiderProps) {
      return (
        <g>
          {anim === "move" && <EndDust view={view} f={f} />}
          {endShoes(view, p, anim, f, "back")}
        </g>
      );
    },
    Front({ p, f, anim }: RiderProps) {
      return <g>{endShoes(view, p, anim, f, "front")}</g>;
    },
  };
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
  views: { front: endView("front"), back: endView("back") },
  trail: {
    ms: [110, 110, 120, 110],
    w: 36,
    h: 24,
    Mark: SkidMark,
  },
};

const DUST = "#e6c48c";
const DUST_D = "#6b4e2c";

/** Skid streaks of dust, drawn going right (the town mirrors it for left), a puff at their back end. */
function SkidMark({ f, view, n }: { f: number; view: "side" | "front" | "back"; n: number }) {
  const k = Math.min(f, 3);
  const op = [1, 0.85, 0.6, 0.3][k];
  const w = [2.8, 3.2, 3, 2.6][k];
  const ys = [-3.2, 0, 3.2];
  const lens = [16, 20, 14];
  const off = n % 2 ? 1.5 : 0;
  const streaks: string[] = [];
  ys.forEach((y, i) => {
    const x1 = -8 + i * 1.5 - off;
    const x2 = x1 + lens[i];
    if (k < 2) streaks.push(`M ${x1} ${y} L ${x2} ${y}`);
    else if (k === 2) streaks.push(`M ${x1} ${y} L ${x1 + 5} ${y} M ${x1 + 8} ${y} L ${x2 - 2} ${y}`);
    else streaks.push(`M ${x1 + 2} ${y} L ${x1 + 4} ${y} M ${x1 + 10} ${y} L ${x1 + 11} ${y}`);
  });
  const ps = [0.8, 1, 1.15, 1.25][k];
  const spread = [0, 1, 2.5, 4][k];
  const puffs: [number, number, number][] = [
    [-10 - spread, -1.5 - spread * 0.5, 3.2],
    [-11.5 - spread * 1.4, 2 + spread * 0.5, 2.6],
    [-7.5 - spread * 0.6, 1.5 + spread * 0.7, 2],
  ];
  const tf = view === "side" ? "scale(1 0.8)" : view === "back" ? "scale(0.8 0.72) rotate(-90)" : "scale(0.8 0.72) rotate(90)";
  const tf2 = `${tf} translate(3 0)`;
  return (
    <g opacity={op} transform={tf2}>
      {streaks.map((d, i) => (
        <path key={`o${i}`} d={d} fill="none" stroke={DUST_D} stroke-linecap="round" stroke-width={w + 1.6} />
      ))}
      {streaks.map((d, i) => (
        <path key={`i${i}`} d={d} fill="none" stroke={DUST} stroke-linecap="round" stroke-width={w} />
      ))}
      {puffs.map(([x, y, r], i) => (
        <circle key={`p${i}`} cx={x} cy={y} r={r * ps * (k === 3 ? 0.7 : 1)} fill={DUST} stroke={DUST_D} stroke-width={1.2} />
      ))}
    </g>
  );
}
