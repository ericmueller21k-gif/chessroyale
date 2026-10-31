import type { RiderDraft, RiderProps, Paint, RiderViewDraft } from "../../item-kit.tsx";
import { Region, LINE, lw } from "../../item-kit.tsx";

/* ---------- geometry helpers ---------- */
const n1 = (v: number) => v.toFixed(1);

/** A balloon sausage from A to B (radius r): round caps, sides bulging a hair. */
function seg(ax: number, ay: number, bx: number, by: number, r: number, bulge = 1.18): string {
  const dx = bx - ax, dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const nx = -uy, ny = ux;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const P = (x: number, y: number) => `${n1(x)} ${n1(y)}`;
  return (
    `M ${P(ax + nx * r, ay + ny * r)} Q ${P(mx + nx * r * bulge, my + ny * r * bulge)} ${P(bx + nx * r, by + ny * r)} ` +
    `A ${n1(r)} ${n1(r)} 0 0 0 ${P(bx - nx * r, by - ny * r)} ` +
    `Q ${P(mx - nx * r * bulge, my - ny * r * bulge)} ${P(ax - nx * r, ay - ny * r)} ` +
    `A ${n1(r)} ${n1(r)} 0 0 0 ${P(ax + nx * r, ay + ny * r)} Z`
  );
}

/** The bright curved highlight along a sausage's upper (light) side. */
function shine(ax: number, ay: number, bx: number, by: number, r: number): string {
  const dx = bx - ax, dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  let sx = -uy, sy = ux;
  if (sy > 0.05 || (Math.abs(sy) <= 0.05 && sx > 0)) { sx = -sx; sy = -sy; }
  const k = r * 0.52;
  const x1 = ax + ux * L * 0.02 + sx * k, y1 = ay + uy * L * 0.02 + sy * k;
  const x2 = bx - ux * L * 0.3 + sx * k, y2 = by - uy * L * 0.3 + sy * k;
  const cx = (x1 + x2) / 2 + sx * r * 0.22, cy = (y1 + y2) / 2 + sy * r * 0.22;
  return `M ${n1(x1)} ${n1(y1)} Q ${n1(cx)} ${n1(cy)} ${n1(x2)} ${n1(y2)}`;
}

const circ = (cx: number, cy: number, r: number) =>
  `M ${n1(cx - r)} ${n1(cy)} A ${n1(r)} ${n1(r)} 0 1 0 ${n1(cx + r)} ${n1(cy)} A ${n1(r)} ${n1(r)} 0 1 0 ${n1(cx - r)} ${n1(cy)} Z`;
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${n1(cx - rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${n1(cx + rx)} ${n1(cy)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${n1(cx - rx)} ${n1(cy)} Z`;

/* ---------- the balloon's parts (at rest) ---------- */
type S = [number, number, number, number, number];
const BODY: S = [24, 63, 72, 63, 13];
const NECK: S = [80, 56, 88, 36, 7.5];
const HEAD: S = [86, 27, 97, 29, 8.5];
const EAR_N: S = [81, 26, 76, 16, 5.6];
const EAR_F: S = [86, 24, 85, 14, 5];
const LEG_NB: S = [20, 70, 16, 89, 6.3];
const LEG_NF: S = [79, 70, 83, 89, 6.3];
const LEG_FB: S = [27, 70, 29, 89, 5.8];
const LEG_FF: S = [72, 70, 70, 89, 5.8];
const TAIL: S = [16, 57, 9, 43, 4.5];
const POM = [6.5, 36, 6.5] as const;

const GROUND = 96;
const TOP0 = BODY[1] - BODY[4]; // 52: the seat line

/* ---------- motion ---------- */
interface Beat { dx: number; dy: number; sy: number; tail: number; head: number; tilt: number; lag: number; glint: number }
const IDLE_SY = [1, 0.985, 0.975, 0.985, 1, 1.012, 1.018, 1.012];
const IDLE_TAIL = [0, 8, 13, 8, 0, -8, -13, -8];
const IDLE_HEAD = [0, -1, -2, -1, 0, 1, 2, 1];
const IDLE_GLINT = [0, 0, 0, 0, 1, 2, 3, 0];

const MV_DX = [0, 6, 24, 46, 66, 86, 100, 100, 100];
const MV_DY = [0, -6, -18, -23, -18, -6, 0, 0, 0];
const MV_SY = [0.86, 1.12, 1.08, 1.02, 1.05, 1.1, 0.82, 1.07, 0.97];
const MV_TAIL = [-14, 18, 10, 0, -10, -18, 22, -12, 5];
const MV_HEAD = [4, -7, -4, 0, 3, 5, 7, -3, 1];
const MV_TILT = [2, -6, -4, -1, 2, 3, 5, -2, 1];
const MV_LAG = [1, 2, 0, -1, -2, -1, 2, -1, 0];

function beat(anim: "idle" | "move", f: number): Beat {
  if (anim === "idle") {
    const i = ((f % 8) + 8) % 8;
    return { dx: 0, dy: 0, sy: IDLE_SY[i], tail: IDLE_TAIL[i], head: IDLE_HEAD[i], tilt: 0, lag: 0, glint: IDLE_GLINT[i] };
  }
  const i = ((f % 9) + 9) % 9;
  return { dx: MV_DX[i], dy: MV_DY[i], sy: MV_SY[i], tail: MV_TAIL[i], head: MV_HEAD[i], tilt: MV_TILT[i], lag: MV_LAG[i], glint: 0 };
}
const sxOf = (sy: number) => 1 + (1 - sy) * 0.85;
const squash = (b: Beat) => `translate(50 ${GROUND}) scale(${sxOf(b.sy).toFixed(3)} ${b.sy.toFixed(3)}) translate(-50 ${-GROUND})`;

/* ---------- drawing pieces ---------- */
const HL = { fill: "none", stroke: "#fff", "stroke-linecap": "round" as const, opacity: 0.85 };

function Seg({ p, s, name, dim }: { p: Paint; s: S; name: string; dim?: boolean }) {
  const [ax, ay, bx, by, r] = s;
  return (
    <g>
      <Region
        p={p}
        name={name}
        d={[seg(ax, ay, bx, by, r)]}
        over={dim ? <rect x="-20" y="-20" width="140" height="140" fill="#000" opacity="0.22" /> : undefined}
      />
      <path d={shine(ax, ay, bx, by, r)} {...HL} {...lw(r > 7 ? 2.8 : 2)} opacity={dim ? 0.5 : 0.85} />
    </g>
  );
}

function Knots({ p, pts, name }: { p: Paint; pts: [number, number][]; name: string }) {
  return <Region p={p} name={name} line={1.8} d={pts.map(([x, y]) => ell(x, y, 3.2, 2.6))} />;
}

/** The tiger-striped ribbon bow on the neck (fixed colors). */
function Bow() {
  const OR = "#ee7a16";
  return (
    <g>
      <path d="M 82 52 L 78 61 L 80.5 60 L 82 62.5 L 83 53 Z" fill={OR} {...LINE} {...lw(1.8)} />
      <path d="M 83 52 L 87 60 L 88.5 58 L 90.5 59.5 L 84.5 51 Z" fill={OR} {...LINE} {...lw(1.8)} />
      <path d="M 83 50 C 77 42 70 45 72.5 51.5 C 74 56 79 55 83 50 Z" fill={OR} {...LINE} {...lw(2.2)} />
      <path d="M 83 50 C 89 43 96 47 93.5 53 C 92 57 87 55 83 50 Z" fill={OR} {...LINE} {...lw(2.2)} />
      <path d="M 75.5 46.5 L 77.5 50 M 74 51.5 L 77 52.5 M 90.5 46.5 L 89 50 M 92.5 52 L 89.5 52.5" stroke="#1d1d1f" fill="none" stroke-linecap="round" {...lw(1.6)} />
      <path d="M 74.5 48.5 Q 75.5 46 78 46.5" stroke="#ffd9a0" fill="none" stroke-linecap="round" {...lw(1.3)} />
      <path d={ell(83, 50.5, 3, 3.2)} fill={OR} {...LINE} {...lw(1.8)} />
      <path d="M 82 48.5 L 84 52.5" stroke="#1d1d1f" fill="none" stroke-linecap="round" {...lw(1.3)} />
    </g>
  );
}

/** A four-point sparkle. */
function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const d = `M ${x} ${y - s} Q ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`;
  return <path d={d} fill="#fff" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.2)} />;
}

function Back({ p, anim, f }: RiderProps) {
  const b = beat(anim, f);
  const air = -b.dy; // height above ground
  const sh = Math.max(0.55, 1 - air / 45);
  return (
    <g>
      {/* ground shadow stays on the ground */}
      <ellipse cx="50" cy={GROUND + 1 + air} rx={44 * sh * sxOf(b.sy)} ry={4 * sh} fill="#000" opacity={0.18 * sh} />
      <g transform={squash(b)}>
        {/* tail with its pom, wiggling round its knot */}
        <g transform={`rotate(${b.tail} ${TAIL[0]} ${TAIL[1]})`}>
          <Seg p={p} s={TAIL} name="tail" />
          <Region p={p} name="pom" d={[circ(POM[0], POM[1], POM[2])]} />
          <path d={`M ${POM[0] - 3.5} ${POM[1] - 2} Q ${POM[0] - 2.5} ${POM[1] - 4.5} ${POM[0]} ${POM[1] - 4.5}`} {...HL} {...lw(2)} />
          <Knots p={p} name="tailknot" pts={[[POM[0] - 2, POM[1] - 7.5]]} />
        </g>
        <Seg p={p} s={LEG_FB} name="legfb" dim />
        <Seg p={p} s={LEG_FF} name="legff" dim />
        <g transform={`rotate(${b.head} 85 33)`}>
          <Seg p={p} s={EAR_F} name="earf" dim />
        </g>
      </g>
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const b = beat(anim, f);
  const glintAt: Record<number, [number, number, number]> = { 1: [22, 58, 2.6], 2: [32, 57.5, 4.4], 3: [42, 58, 2.4] };
  const g = glintAt[b.glint];
  return (
    <g transform={squash(b)}>
      <Seg p={p} s={LEG_NB} name="legnb" />
      <Seg p={p} s={LEG_NF} name="legnf" />
      <Seg p={p} s={BODY} name="body" />
      <path d="M 16 61 Q 15 56 19 54" {...HL} {...lw(2)} />
      <Seg p={p} s={NECK} name="neck" />
      <g transform={`rotate(${b.head} 85 33)`}>
        <Seg p={p} s={HEAD} name="head" />
        {/* eye and nose nub */}
        <Seg p={p} s={EAR_N} name="earn" />
        <ellipse cx="93.5" cy="25.5" rx="1.9" ry="2.3" fill="#1d1d1f" />
        <circle cx="94.1" cy="24.7" r="0.7" fill="#fff" />
        <path d="M 92 32 Q 95.5 34 99 32" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(1.4)} />
        <Knots p={p} name="nose" pts={[[106, 29.5]]} />
        <Knots p={p} name="headknot" pts={[[83.5, 32.5]]} />
      </g>
      <Knots p={p} name="knots" pts={[[18, 73], [79, 73]]} />
      <g transform="translate(83 48) scale(0.8) translate(-83 -50.5)">
        <Bow />
      </g>
      {g && <Sparkle x={g[0]} y={g[1]} s={g[2]} />}
    </g>
  );
}

/* ================= end-on views (front and back) ================= */
const MV_SPLAY = [2.5, -1, -1.5, -2, -1.5, -0.5, 3, -0.5, 0.5];
const MV_ROLL = [0, 0, 0, 0, 0, 0, 0, 1.5, -0.8];
const splayOf = (anim: "idle" | "move", f: number) => (anim === "move" ? MV_SPLAY[((f % 9) + 9) % 9] : 0);

/** A bubble's curved highlight, upper left. */
const bubbleShine = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${n1(cx - rx * 0.7)} ${n1(cy + ry * 0.02)} Q ${n1(cx - rx * 0.68)} ${n1(cy - ry * 0.62)} ${n1(cx - rx * 0.1)} ${n1(cy - ry * 0.72)}`;

function endPose(anim: "idle" | "move", f: number) {
  const b = beat(anim, f);
  const top = GROUND - (GROUND - TOP0) * b.sy;
  return {
    dx: 0,
    dy: b.dy,
    pawnX: 0,
    pawnY: -9 + (top - TOP0) + b.lag,
    pawnTilt: anim === "move" ? MV_ROLL[((f % 9) + 9) % 9] : 0,
    cut: 68,
  };
}

function EndShadow({ b }: { b: Beat }) {
  const air = -b.dy;
  const sh = Math.max(0.55, 1 - air / 45);
  return <ellipse cx="50" cy={GROUND + 1 + air} rx={25 * sh * sxOf(b.sy)} ry={4 * sh} fill="#000" opacity={0.18 * sh} />;
}

const GLINT_BACK: Record<number, [number, number, number]> = { 1: [38.5, 63, 2.6], 2: [41.5, 58.5, 4.4], 3: [45.5, 55.5, 2.4] };
const GLINT_FRONT: Record<number, [number, number, number]> = { 1: [37.5, 70, 2.6], 2: [38.5, 64.5, 4.4], 3: [41.5, 60.5, 2.4] };

/* ---- back view: seen from behind ---- */
function BackBack({ p, anim, f }: RiderProps) {
  const b = beat(anim, f);
  const s = splayOf(anim, f);
  const e = b.head * 1.3;
  return (
    <g>
      <EndShadow b={b} />
      <g transform={squash(b)}>
        {/* the front legs, far away, peeking outside the hind legs */}
        <Seg p={p} s={[31, 71, 28.5 - s * 0.6, 86, 5.8]} name="legnf" dim />
        <Seg p={p} s={[69, 71, 71.5 + s * 0.6, 86, 5.8]} name="legff" dim />
        {/* the head behind the pawn: ears peek out round the pawn's head */}
        <g transform={`translate(0 ${b.head * 0.3})`}>
          <g transform={`rotate(${-e} 45 19)`}>
            <Seg p={p} s={[45, 19, 38, 10, 5.3]} name="earn" />
          </g>
          <g transform={`rotate(${e} 55 19)`}>
            <Seg p={p} s={[55, 19, 62, 10, 5.3]} name="earf" />
          </g>
          <Region p={p} name="head" d={[circ(50, 23, 8.5)]} />
        </g>
      </g>
    </g>
  );
}

function BackFront({ p, anim, f }: RiderProps) {
  const b = beat(anim, f);
  const s = splayOf(anim, f);
  const g = GLINT_BACK[b.glint];
  const POMY = 44.5;
  return (
    <g transform={squash(b)}>
      {/* hind legs */}
      <Seg p={p} s={[40, 76, 37.5 - s, 89.5, 6.5]} name="legnb" />
      <Seg p={p} s={[60, 76, 62.5 + s, 89.5, 6.5]} name="legfb" />
      {/* the round rear bubble */}
      <Region p={p} name="body" d={[ell(50, 66.5, 19.5, 15.5)]} />
      <path d={bubbleShine(50, 66.5, 19.5, 15.5)} {...HL} {...lw(2.8)} />
      <Knots p={p} name="knots" pts={[[39.5, 80], [60.5, 80]]} />
      {/* the tail sticking up in the middle, with its pom */}
      <g transform={`rotate(${b.tail * 0.8} 50 61)`}>
        <Seg p={p} s={[50, 61, 50, 51, 4.3]} name="tail" />
        <Region p={p} name="pom" d={[circ(50, POMY, 6.3)]} />
        <path d={`M 46.3 ${POMY - 1.2} Q 47 ${POMY - 4.2} 49.6 ${POMY - 4.4}`} {...HL} {...lw(2)} />
        <Knots p={p} name="tailknot" pts={[[50, 51]]} />
      </g>
      {g && <Sparkle x={g[0]} y={g[1]} s={g[2]} />}
    </g>
  );
}

/* ---- front view: seen from the front ---- */
function FrontBack({ p, anim, f }: RiderProps) {
  const b = beat(anim, f);
  const s = splayOf(anim, f);
  return (
    <g>
      <EndShadow b={b} />
      <g transform={squash(b)}>
        {/* the hind legs, far away, peeking outside the front legs */}
        <Seg p={p} s={[31, 71, 28.5 - s * 0.6, 86, 5.8]} name="legnb" dim />
        <Seg p={p} s={[69, 71, 71.5 + s * 0.6, 86, 5.8]} name="legfb" dim />
      </g>
    </g>
  );
}

function FrontFront({ p, anim, f }: RiderProps) {
  const b = beat(anim, f);
  const s = splayOf(anim, f);
  const e = b.head * 1.3;
  const g = GLINT_FRONT[b.glint];
  return (
    <g transform={squash(b)}>
      {/* front legs */}
      <Seg p={p} s={[40, 76, 37.5 - s, 89.5, 6.5]} name="legnf" />
      <Seg p={p} s={[60, 76, 62.5 + s, 89.5, 6.5]} name="legff" />
      {/* the chest: the body's front end */}
      <Region p={p} name="body" d={[ell(50, 67, 19.5, 15.5)]} />
      <path d={bubbleShine(50, 67, 19.5, 15.5)} {...HL} {...lw(2.8)} />
      <Knots p={p} name="knots" pts={[[39.5, 80.5], [60.5, 80.5]]} />
      <Seg p={p} s={[50, 67, 50, 57, 7.5]} name="neck" />
      <g transform="translate(50 66) scale(0.9) translate(-83 -50.5)">
        <Bow />
      </g>
      {/* the head facing us */}
      <g transform={`translate(0 ${b.head * 0.3}) rotate(${b.head} 50 60)`}>
        <g transform={`rotate(${-e} 43.5 45)`}>
          <Seg p={p} s={[43.5, 45, 34, 37, 5]} name="earn" />
        </g>
        <g transform={`rotate(${e} 56.5 45)`}>
          <Seg p={p} s={[56.5, 45, 66, 37, 5]} name="earf" />
        </g>
        <Region p={p} name="head" d={[circ(50, 50.5, 10)]} />
        <path d={bubbleShine(50, 50.5, 10, 10)} {...HL} {...lw(2.2)} />
        <ellipse cx="45" cy="48" rx="2" ry="2.4" fill="#1d1d1f" />
        <ellipse cx="55" cy="48" rx="2" ry="2.4" fill="#1d1d1f" />
        <circle cx="45.6" cy="47.2" r="0.75" fill="#fff" />
        <circle cx="55.6" cy="47.2" r="0.75" fill="#fff" />
        <path d="M 46.2 56.2 Q 50 58.9 53.8 56.2" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(1.4)} />
        <Knots p={p} name="nose" pts={[[50, 52.8]]} />
      </g>
      {g && <Sparkle x={g[0]} y={g[1]} s={g[2]} />}
    </g>
  );
}

const frontView: RiderViewDraft = {
  frame: [20, 2, 60, 96],
  idle: { ms: [170, 150, 170, 150, 170, 110, 110, 150] },
  move: { ms: [90, 60, 70, 80, 70, 60, 90, 80, 90] },
  pose: endPose,
  Back: FrontBack,
  Front: FrontFront,
};

const backView: RiderViewDraft = {
  frame: [20, 0, 60, 98],
  idle: { ms: [170, 150, 170, 150, 170, 110, 110, 150] },
  move: { ms: [90, 60, 70, 80, 70, 60, 90, 80, 90] },
  pose: endPose,
  Back: BackBack,
  Front: BackFront,
};

export const balloonPup: RiderDraft = {
  id: "balloon-pup",
  name: "Balloon Pup",
  tier: "mythic",
  description: "A very good boy, twisted from one very long balloon. Do not bring a pin to the park.",
  frame: [-6, 4, 120, 96],
  idle: { ms: [170, 150, 170, 150, 170, 110, 110, 150] },
  move: { ms: [90, 60, 70, 80, 70, 60, 90, 80, 90] },
  pose(anim, f) {
    const b = beat(anim, f);
    const top = GROUND - (GROUND - TOP0) * b.sy;
    return {
      dx: b.dx,
      dy: b.dy,
      pawnX: -2,
      pawnY: -9 + (top - TOP0) + b.lag,
      pawnTilt: b.tilt,
      cut: 68,
    };
  },
  Back,
  Front,
  views: { front: frontView, back: backView },
};
