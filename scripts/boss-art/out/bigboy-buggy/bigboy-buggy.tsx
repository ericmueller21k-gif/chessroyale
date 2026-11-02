import { Region, LINE, lw, darken, type RiderDraft, type RiderProps, type RiderViewDraft, type TrailProps } from "../../item-kit.tsx";

const n = (v: number) => v.toFixed(2);
const TEAL = "#22a7a0";
const BABY = "#a8cdea";
const CREAM = "#fdf3e3";
const TIRE = "#2e2e36";
const CHROME = "#d7dee3";
const RAINBOW = ["#ff5a5a", "#ff9f3a", "#ffe14a", "#5fd36b", "#4aa8ff", "#a46bff"];

// pawn sits at x 46, base y 78 (pawnX -4, pawnY -10)
const PX = -4;
const PY = -10;
const PIVOT: [number, number] = [50 + PX, 88 + PY];

const IDLE_N = 8;
const MOVE_DX = [0, 10, 24, 40, 56, 72, 86, 96];
const MOVE_DY = [0, 0, 0, -2.5, 0, 0, 0, 0];
const MOVE_BY = [0, 0.4, 0.2, -1, 1.6, 0.3, 0.8, 0.2];
const MOVE_TILT = [0, -1.5, -1, 1.5, -1, 0, 2, 0.8];
const MOVE_TOY = [0, 12, 16, 4, -16, -6, -18, -8];
const MOVE_HOP = [0, 0, 0, 0.5, -1.5, 0, 0, 0];

function body(anim: "idle" | "move", f: number) {
  if (anim === "idle") {
    const t = (2 * Math.PI * f) / IDLE_N;
    return {
      by: 0.7 * (1 - Math.cos(t)),
      tilt: 1.1 * Math.sin(t),
      toy: 10 * Math.sin(t - 1.2),
      rot: 0,
      flutter: f % 2,
      rattle: false,
    };
  }
  return {
    by: MOVE_BY[f],
    tilt: MOVE_TILT[f],
    toy: MOVE_TOY[f],
    rot: MOVE_DX[f] * 1.2,
    flutter: f % 2,
    rattle: f === 3 || f === 4,
  };
}

const bodyT = (b: { by: number; tilt: number }) => `translate(0 ${n(b.by)}) rotate(${n(b.tilt)} ${PIVOT[0]} ${PIVOT[1]})`;

function Wheel({ cx, cy, rot, far }: { cx: number; cy: number; rot: number; far?: boolean }) {
  const spokes = [];
  for (let i = 0; i < 6; i++) {
    const a = ((rot + i * 60) * Math.PI) / 180;
    spokes.push(
      <line key={i} x1={n(cx)} y1={n(cy)} x2={n(cx + Math.cos(a) * 7)} y2={n(cy + Math.sin(a) * 7)} stroke={far ? "#5b636b" : "#4a535c"} {...lw(2)} stroke-linecap="round" />,
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={far ? "#1f1f25" : TIRE} {...LINE} />
      <circle cx={cx} cy={cy} r={7.2} fill={far ? "#98a3ac" : "#eef3f6"} stroke="#1d1d1f" {...lw(1.6)} />
      {spokes}
      <circle cx={cx} cy={cy} r={2.6} fill={far ? "#1b7a75" : TEAL} stroke="#1d1d1f" {...lw(1.6)} />
      {!far && <path d={`M ${n(cx - 6.6)} ${n(cy - 5.2)} A 8.6 8.6 0 0 1 ${n(cx + 2)} ${n(cy - 8.4)}`} fill="none" stroke="#fff" stroke-opacity="0.45" {...lw(1.4)} stroke-linecap="round" />}
    </g>
  );
}

function Swirl({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const wedges = RAINBOW.map((c, i) => {
    const a0 = (i * 60 * Math.PI) / 180;
    const a1 = ((i + 1) * 60 * Math.PI) / 180;
    return (
      <path
        key={c}
        d={`M ${cx} ${cy} L ${n(cx + Math.cos(a0) * r)} ${n(cy + Math.sin(a0) * r)} A ${r} ${r} 0 0 1 ${n(cx + Math.cos(a1) * r)} ${n(cy + Math.sin(a1) * r)} Z`}
        fill={c}
      />
    );
  });
  let s = "";
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 4;
    const rr = t * r * 0.85;
    s += `${i ? "L" : "M"} ${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)} `;
  }
  return (
    <g>
      {wedges}
      <path d={s} fill="none" stroke="#fff" {...lw(1.3)} stroke-linecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1d1d1f" {...lw(1.8)} />
    </g>
  );
}

// the hood: back edge up from the rim, over the top, to its tip; front edge back down to its pivot
const HOOD = "M 8 56 C 4 30 14 2 36 -4 C 50 -7 60 -3 64 4 C 56 12 40 30 34 56 Z";
const LINING = "M 64 4 C 67 20 60 40 53 56 L 34 56 C 40 30 56 12 64 4 Z";
const EDGE: [number, number][] = [[64, 4], [56, 12], [40, 30], [34, 56]];
const bez = (t: number) => {
  const u = 1 - t;
  const [a, b, c, d] = EDGE;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};

function Back({ p, anim, f }: RiderProps) {
  const b = body(anim, f);
  const frill = [];
  for (let i = 0; i < 7; i++) {
    const t = 0.06 + i * 0.12;
    const [x, y] = bez(t);
    const r = (i + b.flutter) % 2 ? 3.6 : 2.7;
    frill.push(<circle key={i} cx={n(x + 1.4)} cy={n(y)} r={r} fill={BABY} stroke="#1d1d1f" {...lw(1.6)} />);
  }
  return (
    <g>
      <Wheel cx={33} cy={86} rot={b.rot + 20} far />
      <Wheel cx={83} cy={86} rot={b.rot + 20} far />
      <g transform={bodyT(b)}>
        {/* push handle */}
        <path d="M 12 62 L -3 30" fill="none" stroke="#1d1d1f" {...lw(5)} stroke-linecap="round" />
        <path d="M 12 62 L -3 30" fill="none" stroke={CHROME} {...lw(2.4)} stroke-linecap="round" />
        <path d="M -7 31.5 L 1 27.5" fill="none" stroke="#1d1d1f" {...lw(7)} stroke-linecap="round" />
        <path d="M -7 31.5 L 1 27.5" fill="none" stroke={TEAL} {...lw(4)} stroke-linecap="round" />
        {/* hood lining, frill, hood */}
        <path d={LINING} fill={CREAM} {...LINE} />
        {frill}
        <Region p={p} name="hood" d={[HOOD]} />
        <path d="M 24 56 C 14 44 10 32 10 22" fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" />
        <path d="M 25 56 C 20 38 20 18 24 2" fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" />
        <path d="M 27 56 C 28 36 34 14 46 -4" fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" />
        <path d="M 14 18 C 18 8 26 2 34 0" fill="none" stroke="#fff" stroke-opacity="0.5" {...lw(2)} stroke-linecap="round" />
        <circle cx={24} cy={56} r={2.6} fill={CHROME} stroke="#1d1d1f" {...lw(1.6)} />
      </g>
    </g>
  );
}

const BASKET = "M 9 55 C 8 70 16 78 32 78 L 68 78 C 84 78 93 70 93 55 Z";
const RIM = "M 6 51 L 96 51 C 98.5 51 98.5 58 96 58 L 6 58 C 3.5 58 3.5 51 6 51 Z";
const PANEL = "M 20 62 L 82 62 C 84 62 84.5 64 83.5 66 C 81 71 76 73 68 73 L 34 73 C 26 73 21 71 18.5 66 C 17.5 64 18 62 20 62 Z";

function Front({ p, anim, f }: RiderProps) {
  const b = body(anim, f);
  const y = b.by;
  // springs: from the axle (fixed) up to under the basket (moves with the body)
  const springs = [
    `M 26 88 C 20 80 ${n(28)} ${n(74 + y)} ${n(38)} ${n(76 + y)}`,
    `M 76 88 C 82 80 ${n(74)} ${n(74 + y)} ${n(64)} ${n(76 + y)}`,
    "M 26 88 L 76 88",
  ];
  return (
    <g>
      {springs.map((d) => (
        <path key={d + "o"} d={d} fill="none" stroke="#1d1d1f" {...lw(5)} stroke-linecap="round" />
      ))}
      {springs.map((d) => (
        <path key={d} d={d} fill="none" stroke={CHROME} {...lw(2.4)} stroke-linecap="round" />
      ))}
      <g transform={bodyT(b)}>
        <Region p={p} name="basket" d={[BASKET]} />
        <path d={PANEL} fill="#fff" fill-opacity="0.18" stroke="#1d1d1f" {...lw(1.6)} />
        <Swirl cx={51} cy={67.5} r={5} />
        <path d="M 14 62 C 14 68 18 73 25 75" fill="none" stroke="#fff" stroke-opacity="0.5" {...lw(2)} stroke-linecap="round" />
        <Region p={p} name="rim" d={[RIM]} />
        <path d="M 8 53.6 L 60 53.6" fill="none" stroke="#fff" stroke-opacity="0.55" {...lw(1.6)} stroke-linecap="round" />
        {/* the dangling toy, hung from the hood's tip */}
        <g transform={`rotate(${n(b.toy)} 64 4)`}>
          <path d="M 64 4 L 64 12" fill="none" stroke="#1d1d1f" {...lw(1.8)} />
          <circle cx={64} cy={13.4} r={2.8} fill={TEAL} stroke="#1d1d1f" {...lw(1.6)} />
          <rect x={61.8} y={15.8} width={4.4} height={6.6} rx={1.6} fill={BABY} stroke="#1d1d1f" {...lw(1.6)} />
          <Swirl cx={64} cy={29} r={7.6} />
          {b.rattle && (
            <g fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round">
              <path d="M 74 24 L 78 22" />
              <path d="M 75 30 L 79.5 30" />
              <path d="M 74 36 L 78 38" />
            </g>
          )}
        </g>
      </g>
      <Wheel cx={26} cy={88} rot={b.rot} />
      <Wheel cx={76} cy={88} rot={b.rot} />
    </g>
  );
}

// ---------------- front and back views (seen end-on) ----------------
const endT = (b: { by: number; tilt: number }) => `translate(0 ${n(b.by)}) rotate(${n(b.tilt)} 50 78)`;
const cub = (P: number[][], t: number) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]);
};
const archPts = (L: number[][], ts: number[]) => {
  const R = L.map(([x, y]) => [100 - x, y]).reverse();
  const out: number[][] = [];
  ts.forEach((t) => out.push(cub(L, t)));
  [...ts].reverse().forEach((t) => out.push(cub(R, 1 - t)));
  return out;
};
const HOOD_E = "M 12 54 C 8 24 26 -4 50 -4 C 74 -4 92 24 88 54 Z";
const LINING_E = "M 21 54 C 19 30 32 6 50 6 C 68 6 81 30 79 54 Z";
const LINING_L = [[21, 54], [19, 30], [32, 6], [50, 6]];
const LIN_SHADE = "M 29 54 C 28 34 38 15 50 15 C 62 15 72 34 71 54 Z";
const HOOD_RIB = "M 16.5 54 C 13 26 29 1 50 1 C 71 1 87 26 83.5 54";
const OUTER_L = [[10, 54], [5.5, 23], [25, -5.5], [50, -5.5]];
const RIM_TOP = "M 14 52 C 14 43.33 86 43.33 86 52 C 86 60.67 14 60.67 14 52 Z";
const RIM_IN = "M 19 52.5 C 19 46.5 81 46.5 81 52.5 C 81 58.5 19 58.5 19 52.5 Z";
const BASKET_E = "M 18 55 C 18 71 26 78 38 78 L 62 78 C 74 78 82 71 82 55 Z";
const RIM_E = "M 16 51 L 84 51 C 87.5 51 87.5 58 84 58 L 16 58 C 12.5 58 12.5 51 16 51 Z";
const PANEL_E = "M 27 61.5 L 73 61.5 C 75 61.5 75.5 63.5 74.5 65.5 C 72 70 67.5 72.5 61 72.5 L 39 72.5 C 32.5 72.5 28 70 25.5 65.5 C 24.5 63.5 25 61.5 27 61.5 Z";

function EndWheel({ cx, rot }: { cx: number; rot: number }) {
  const cy = 88;
  const spokes = [];
  for (let i = 0; i < 6; i++) {
    const a = ((rot + i * 60) * Math.PI) / 180;
    spokes.push(
      <line key={i} x1={cx} y1={cy} x2={n(cx + Math.cos(a) * 3.4)} y2={n(cy + Math.sin(a) * 6.8)} stroke="#4a535c" {...lw(1.6)} stroke-linecap="round" />,
    );
  }
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={6.4} ry={10} fill={TIRE} {...LINE} />
      <ellipse cx={cx} cy={cy} rx={4} ry={7.2} fill="#eef3f6" stroke="#1d1d1f" {...lw(1.4)} />
      {spokes}
      <ellipse cx={cx} cy={cy} rx={1.7} ry={2.6} fill={TEAL} stroke="#1d1d1f" {...lw(1.2)} />
      <path d={`M ${n(cx - 4.2)} ${n(cy - 5)} C ${n(cx - 3.6)} ${n(cy - 8)} ${n(cx - 1.5)} ${n(cy - 9)} ${n(cx)} ${n(cy - 9)}`} fill="none" stroke="#fff" stroke-opacity="0.45" {...lw(1.2)} stroke-linecap="round" />
    </g>
  );
}

function EndChassis({ y }: { y: number }) {
  const d = [
    `M 25 88 C 22 82 26 ${n(77 + y)} 33 ${n(76 + y)}`,
    `M 75 88 C 78 82 74 ${n(77 + y)} 67 ${n(76 + y)}`,
    "M 19 88 L 81 88",
  ];
  return (
    <g>
      {d.map((s) => (
        <path key={s + "o"} d={s} fill="none" stroke="#1d1d1f" {...lw(5)} stroke-linecap="round" />
      ))}
      {d.map((s) => (
        <path key={s} d={s} fill="none" stroke={CHROME} {...lw(2.4)} stroke-linecap="round" />
      ))}
    </g>
  );
}

function Toy({ x, y, a, rattle, dir }: { x: number; y: number; a: number; rattle: boolean; dir: number }) {
  return (
    <g transform={`rotate(${n(a)} ${x} ${y})`}>
      <path d={`M ${x} ${y} L ${x} ${y + 8}`} fill="none" stroke="#1d1d1f" {...lw(1.8)} />
      <circle cx={x} cy={y + 9.4} r={2.8} fill={TEAL} stroke="#1d1d1f" {...lw(1.6)} />
      <rect x={x - 2.2} y={y + 11.8} width={4.4} height={6.6} rx={1.6} fill={BABY} stroke="#1d1d1f" {...lw(1.6)} />
      <Swirl cx={x} cy={y + 25} r={7.6} />
      {rattle && (
        <g fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round">
          <path d={`M ${x + dir * 10} ${y + 20} L ${x + dir * 14} ${y + 18}`} />
          <path d={`M ${x + dir * 11} ${y + 26} L ${x + dir * 15.5} ${y + 26}`} />
          <path d={`M ${x + dir * 10} ${y + 32} L ${x + dir * 14} ${y + 34}`} />
        </g>
      )}
    </g>
  );
}

function RimTop({ p }: { p: RiderProps["p"] }) {
  return (
    <g>
      <Region p={p} name="rim-back" d={[RIM_TOP]} />
      <path d={RIM_IN} fill={darken(p.hex, 0.45)} stroke="#1d1d1f" {...lw(1.6)} />
      <circle cx={15.5} cy={52.5} r={2.6} fill={CHROME} stroke="#1d1d1f" {...lw(1.6)} />
      <circle cx={84.5} cy={52.5} r={2.6} fill={CHROME} stroke="#1d1d1f" {...lw(1.6)} />
    </g>
  );
}

function FrontViewBack({ p, anim, f }: RiderProps) {
  const b = body(anim, f);
  const pts = archPts(LINING_L, [0.12, 0.3, 0.48, 0.66, 0.84]);
  pts.splice(5, 0, [50, 6]);
  return (
    <g transform={endT(b)}>
      <Region p={p} name="hood" d={[HOOD_E]} />
      <path d={HOOD_RIB} fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" />
      <path d="M 14.5 36 C 16 18 28 2 42 -1" fill="none" stroke="#fff" stroke-opacity="0.5" {...lw(2)} stroke-linecap="round" />
      <path d={LINING_E} fill={CREAM} {...LINE} />
      <path d={LIN_SHADE} fill="#efdfc6" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={n(x)} cy={n(y)} r={(i + b.flutter) % 2 ? 3.6 : 2.7} fill={BABY} stroke="#1d1d1f" {...lw(1.6)} />
      ))}
      <RimTop p={p} />
    </g>
  );
}

function FrontViewFront({ p, anim, f }: RiderProps) {
  const b = body(anim, f);
  return (
    <g>
      <EndChassis y={b.by} />
      <g transform={endT(b)}>
        <Region p={p} name="basket" d={[BASKET_E]} />
        <path d={PANEL_E} fill="#fff" fill-opacity="0.18" stroke="#1d1d1f" {...lw(1.6)} />
        <Swirl cx={50} cy={67} r={5} />
        <path d="M 21.5 62 C 21.5 68 25 73 31 75" fill="none" stroke="#fff" stroke-opacity="0.5" {...lw(2)} stroke-linecap="round" />
        <Region p={p} name="rim" d={[RIM_E]} />
        <path d="M 17 53.6 L 60 53.6" fill="none" stroke="#fff" stroke-opacity="0.55" {...lw(1.6)} stroke-linecap="round" />
        <Toy x={71.5} y={20} a={-b.toy * 0.6} rattle={b.rattle} dir={1} />
      </g>
      <EndWheel cx={19} rot={b.rot} />
      <EndWheel cx={81} rot={b.rot} />
    </g>
  );
}

function BackViewBack({ p, anim, f }: RiderProps) {
  const b = body(anim, f);
  const pts = archPts(OUTER_L, [0.1, 0.26, 0.42, 0.58, 0.74]);
  return (
    <g transform={endT(b)}>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={n(x)} cy={n(y)} r={(i + b.flutter) % 2 ? 3.6 : 2.7} fill={BABY} stroke="#1d1d1f" {...lw(1.6)} />
      ))}
      <Region p={p} name="hood" d={[HOOD_E]} />
      <path d="M 19 54 C 16 30 31 5 50 5 C 69 5 84 30 81 54" fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" />
      <path d="M 26.5 54 C 24.5 36 36 15 50 15 C 64 15 75.5 36 73.5 54" fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" />
      <path d="M 14.5 36 C 16 18 28 2 42 -1" fill="none" stroke="#fff" stroke-opacity="0.5" {...lw(2)} stroke-linecap="round" />
      <RimTop p={p} />
      <Toy x={26} y={6} a={-b.toy * 0.5} rattle={b.rattle} dir={-1} />
    </g>
  );
}

function BackViewFront({ p, anim, f }: RiderProps) {
  const b = body(anim, f);
  const handle = ["M 25 63 L 21.5 40", "M 75 63 L 78.5 40"];
  return (
    <g>
      <EndChassis y={b.by} />
      <g transform={endT(b)}>
        <Region p={p} name="basket" d={[BASKET_E]} />
        <path d="M 21.5 61 C 21.5 68 25 73 31 75" fill="none" stroke="#fff" stroke-opacity="0.5" {...lw(2)} stroke-linecap="round" />
        <Region p={p} name="rim" d={[RIM_E]} />
        <path d="M 17 53.6 L 60 53.6" fill="none" stroke="#fff" stroke-opacity="0.55" {...lw(1.6)} stroke-linecap="round" />
        {handle.map((s) => (
          <path key={s + "o"} d={s} fill="none" stroke="#1d1d1f" {...lw(5)} stroke-linecap="round" />
        ))}
        {handle.map((s) => (
          <path key={s} d={s} fill="none" stroke={CHROME} {...lw(2.4)} stroke-linecap="round" />
        ))}
        <circle cx={25} cy={63} r={2.4} fill={CHROME} stroke="#1d1d1f" {...lw(1.4)} />
        <circle cx={75} cy={63} r={2.4} fill={CHROME} stroke="#1d1d1f" {...lw(1.4)} />
        <path d="M 18 40 L 82 40" fill="none" stroke="#1d1d1f" {...lw(7)} stroke-linecap="round" />
        <path d="M 18 40 L 82 40" fill="none" stroke={TEAL} {...lw(4)} stroke-linecap="round" />
        <path d="M 22 39 L 46 39" fill="none" stroke="#fff" stroke-opacity="0.45" {...lw(1.2)} stroke-linecap="round" />
      </g>
      <EndWheel cx={19} rot={-b.rot} />
      <EndWheel cx={81} rot={-b.rot} />
    </g>
  );
}

const endPose = (anim: "idle" | "move", f: number) => {
  const b = body(anim, f);
  if (anim === "idle") return { dx: 0, dy: 0, pawnX: 0, pawnY: PY + b.by, pawnTilt: b.tilt, cut: 70 };
  return { dx: 0, dy: MOVE_DY[f], pawnX: 0, pawnY: PY + b.by + MOVE_HOP[f], pawnTilt: b.tilt, cut: 70 };
};

const FRONT_VIEW: RiderViewDraft = {
  frame: [2, -9, 96, 108],
  idle: { ms: Array(IDLE_N).fill(170) },
  move: { ms: Array(8).fill(90) },
  pose: endPose,
  Back: FrontViewBack,
  Front: FrontViewFront,
};

const BACK_VIEW: RiderViewDraft = {
  frame: [2, -9, 96, 108],
  idle: { ms: Array(IDLE_N).fill(170) },
  move: { ms: Array(8).fill(90) },
  pose: endPose,
  Back: BackViewBack,
  Front: BackViewFront,
};

export const BigBoyBuggy: RiderDraft = {
  id: "bigboy-buggy",
  name: "Big Boy's Buggy",
  tier: "mythic",
  description: "Naptime on wheels. Big Boy swears he's too old for it, but it's his.",
  frame: [-8, -8, 107, 107],
  idle: { ms: Array(IDLE_N).fill(170) },
  move: { ms: Array(8).fill(90) },
  pose: (anim, f) => {
    const b = body(anim, f);
    if (anim === "idle") return { dx: 0, dy: 0, pawnX: PX, pawnY: PY + b.by, pawnTilt: b.tilt, cut: 70 };
    return { dx: MOVE_DX[f], dy: MOVE_DY[f], pawnX: PX, pawnY: PY + b.by + MOVE_HOP[f], pawnTilt: b.tilt, cut: 70 };
  },
  Back,
  Front,
  views: { front: FRONT_VIEW, back: BACK_VIEW },
  trail: {
    ms: [200, 200, 200],
    w: 36,
    h: 30,
    Mark: TrailMark,
  },
};

// ---------------- trail: two thin wheel tracks, dotted with the spokes' pattern ----------------
const TRACK = "#4a3c32";
function TrailMark({ f, view }: TrailProps) {
  const op = [0.9, 0.55, 0.3][f] ?? 0.3;
  const dash = ["6 1.6", "6 1.6", "3 4.6"][f] ?? "3 4.6";
  const w = f === 0 ? 3 : 2.6;
  const lines =
    view === "side"
      ? ["M -16 -4.5 L 16 -4.5", "M -14 4.5 L 16 4.5"]
      : ["M -6.5 -13 L -6.5 13", "M 6.5 -13 L 6.5 13"];
  return (
    <g opacity={op}>
      {lines.map((d, i) => (
        <path key={d} d={d} fill="none" stroke={TRACK} {...lw(w)} stroke-linecap="round" stroke-dasharray={dash} stroke-dashoffset={i * 2} />
      ))}
    </g>
  );
}
