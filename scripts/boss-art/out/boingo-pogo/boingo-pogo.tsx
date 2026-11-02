import { Region, LINE, lw, darken, lighten, type RiderDraft, type RiderViewDraft, type RiderProps, type Paint, type TrailProps } from "../../item-kit.tsx";

/** One frame's state: group move, spring compression (+ squashed, - stretched), lean (deg, + forward), pawn lag (+ sinks into seat), pom jiggle. */
interface S {
  dx: number;
  dy: number;
  comp: number;
  lean: number;
  lag: number;
  pom: number;
}

const IDLE_COMP = [0, 1.5, 3, 2, 0, -1.5, -2, -1];
const IDLE: S[] = IDLE_COMP.map((c, i) => {
  const prev = IDLE_COMP[(i + IDLE_COMP.length - 1) % IDLE_COMP.length];
  const d = c - prev;
  return { dx: 0, dy: 0, comp: c, lean: 0, lag: -0.5 * d, pom: -1.3 * d };
});

const MOVE: S[] = [
  { dx: 0, dy: 0, comp: 0, lean: 0, lag: 0, pom: 0 },
  { dx: 0, dy: 0, comp: 5, lean: -3, lag: -1.2, pom: -2 },
  { dx: 0, dy: 0, comp: 7, lean: -5, lag: -1.5, pom: -2.5 },
  { dx: 6, dy: -8, comp: -4, lean: 6, lag: 2.5, pom: 3 },
  { dx: 20, dy: -24, comp: -3, lean: 8, lag: 2, pom: 2.5 },
  { dx: 38, dy: -34, comp: -1, lean: 6, lag: 0.5, pom: 1 },
  { dx: 56, dy: -36, comp: 0, lean: 2, lag: -1, pom: -1 },
  { dx: 72, dy: -28, comp: -2, lean: -2, lag: -2, pom: -2.5 },
  { dx: 88, dy: -12, comp: -4, lean: -5, lag: -1.5, pom: -3 },
  { dx: 100, dy: 0, comp: 7, lean: -2, lag: 2.5, pom: 3 },
  { dx: 100, dy: -3, comp: -3, lean: 1, lag: -1.2, pom: -2 },
  { dx: 100, dy: 0, comp: 1, lean: 0, lag: 0.5, pom: 1 },
];

const st = (anim: "idle" | "move", f: number): S => {
  const a = anim === "idle" ? IDLE : MOVE;
  return a[((f % a.length) + a.length) % a.length];
};

const PIVOT_Y = 97;
const PAWN_LIFT = -25;

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const shade = (p: Paint) => (lum(p.hex) < 0.22 ? lighten(p.hex, 0.28) : darken(p.hex, 0.3));

const dia = (cx: number, cy: number, hw: number, hh: number) => `M ${cx} ${cy - hh} L ${cx + hw} ${cy} L ${cx} ${cy + hh} L ${cx - hw} ${cy} Z`;

const SILVER = "#d9dde4";
const SILVER_D = "#9aa1ad";
const WHITE = "#fbfaf6";
const POM = "#f7c531";
const RED = "#e0413f";
const GRIP = "#6c3fa3";

/** A fluffy pom-pom: a bumpy circle. */
const pomPath = (cx: number, cy: number, r: number) => {
  const n = 9;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) d += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    else {
      const am = ((i - 0.5) / n) * Math.PI * 2;
      const qx = cx + Math.cos(am) * r * 1.32;
      const qy = cy + Math.sin(am) * r * 1.32;
      d += ` Q ${qx.toFixed(2)} ${qy.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  return d + " Z";
};

function Pom({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path d={pomPath(cx, cy, 4.8)} fill={POM} {...LINE} {...lw(2.4)} />
      <circle cx={cx - 1.6} cy={cy - 1.7} r={1.6} fill="#fff6c8" />
    </g>
  );
}

/** A tube: dark outline stroke, then the fill stroke. */
function Tube({ d, w, color }: { d: string; w: number; color: string }) {
  return (
    <g fill="none">
      <path d={d} {...LINE} {...lw(w + 3)} />
      <path d={d} stroke={color} stroke-linecap="round" stroke-linejoin="round" {...lw(w)} />
    </g>
  );
}

const SPRING_BOT = 92;
const POLE_BOT = 80;

function springPoints(top: number) {
  const turns = 4;
  const step = (SPRING_BOT - top) / turns;
  const pts: [number, number][] = [];
  for (let i = 0; i <= turns * 2; i++) {
    pts.push([i % 2 === 0 ? 41.5 : 58.5, top + (step / 2) * i]);
  }
  return pts;
}

function Back({ p, f, anim }: RiderProps) {
  const s = st(anim, f);
  const c = s.comp;
  const sh = shade(p);
  const pts = springPoints(POLE_BOT + c);
  const lift = Math.max(0, -s.dy);
  const shR = 13 * (1 - lift / 70) + (anim === "idle" ? c * 0.4 : 0);
  return (
    <g>
      <defs>{p.defs}</defs>
      <ellipse cx={50} cy={98.5 - s.dy} rx={Math.max(6, shR)} ry={2.4 * (1 - lift / 90)} fill="#000" opacity={0.18 * (1 - lift / 80)} />
      <g transform={`rotate(${s.lean} 50 ${PIVOT_Y})`}>
        {/* lower rod and the back half of the coil */}
        <rect x={48} y={POLE_BOT - 4 + c} width={4} height={SPRING_BOT + 4 - (POLE_BOT - 4 + c)} fill={SILVER_D} {...LINE} {...lw(2)} />
        {pts.slice(0, -1).map((a, i) =>
          i % 2 === 1 ? (
            <g key={i}>
              <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} {...LINE} {...lw(5.5)} />
              <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} stroke={SILVER_D} stroke-linecap="round" {...lw(2.6)} />
            </g>
          ) : null,
        )}
        <g transform={`translate(0 ${c})`}>
          {/* the far half of the ruffle and the cushion top, behind the pawn */}
          <path d="M 21 38 Q 22 31 50 31 Q 78 31 79 38 Z" fill={WHITE} {...LINE} {...lw(2.4)} />
          <Region p={p} name="cushion" d={["M 24 38.5 Q 24 33 50 33 Q 76 33 76 38.5 Q 76 43.5 50 43.5 Q 24 43.5 24 38.5 Z"]} over={<path d={`${dia(36, 38, 5, 4)} ${dia(50, 38, 5, 4)} ${dia(64, 38, 5, 4)}`} fill={sh} />} line={2.4} />
          <path d="M 30 36 Q 40 34.2 50 34.4" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.6)} />
        </g>
      </g>
    </g>
  );
}

function Front({ p, f, anim }: RiderProps) {
  const s = st(anim, f);
  const c = s.comp;
  const sh = shade(p);
  const pts = springPoints(POLE_BOT + c);
  // ruffle bottom scallops
  const n = 9;
  const xs = Array.from({ length: n + 1 }, (_, i) => 19 + (62 * i) / n);
  const yb = (x: number) => 43.5 + 3.5 * (1 - ((x - 50) / 31) ** 2);
  let ruffle = "M 21 38 Q 50 47 79 38 L 81 " + yb(81).toFixed(2);
  for (let i = n; i > 0; i--) {
    const x0 = xs[i];
    const x1 = xs[i - 1];
    const mx = (x0 + x1) / 2;
    ruffle += ` Q ${mx.toFixed(2)} ${(yb(mx) + 4.5).toFixed(2)} ${x1.toFixed(2)} ${yb(x1).toFixed(2)}`;
  }
  ruffle += " Z";
  const pleats = xs.slice(1, -1).map((x) => {
    const t = (x - 21) / 58;
    const yt = 38 + 2 * t * (1 - t) * 9;
    return `M ${x.toFixed(2)} ${(yt + 1.5).toFixed(2)} L ${x.toFixed(2)} ${(yb(x) - 0.5).toFixed(2)}`;
  });
  // pole harlequin
  const poleDia = [dia(50, 62, 5.5, 5.5), dia(44.5, 73, 5.5, 5.5), dia(55.5, 73, 5.5, 5.5), dia(50, 84, 5.5, 5.5)].join(" ");
  const cupDia = [17, 28, 39, 50, 61, 72, 83].map((x) => dia(x, 54.5, 5.5, 7)).join(" ");
  const pomDy = s.pom;
  return (
    <g transform={`rotate(${s.lean} 50 ${PIVOT_Y})`}>
      {/* front half of the coil */}
      {pts.slice(0, -1).map((a, i) =>
        i % 2 === 0 ? (
          <g key={i}>
            <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} {...LINE} {...lw(6)} />
            <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} stroke={SILVER} stroke-linecap="round" {...lw(3)} />
          </g>
        ) : null,
      )}
      {/* rubber foot */}
      <path d="M 41 98 Q 41 90.5 50 90.5 Q 59 90.5 59 98 Z" fill={RED} {...LINE} {...lw(2.6)} />
      <path d="M 44.5 94 Q 46 92.3 48.5 92.1" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-linecap="round" {...lw(1.5)} />
      <g transform={`translate(0 ${c})`}>
        {/* handlebar stem, out from behind the pole */}
        <Tube d="M 51 72 L 82.5 37.5" w={4.6} color={SILVER} />
        {/* foot pegs */}
        <rect x={35} y={73} width={30} height={5} rx={2.5} fill={SILVER} {...LINE} {...lw(2.4)} />
        {/* the pole */}
        <Region p={p} name="pole" d={["M 44.5 56 L 55.5 56 L 55.5 79 Q 55.5 83 50 83 Q 44.5 83 44.5 79 Z"]} over={<path d={poleDia} fill={sh} />} line={2.8} />
        <path d="M 47 64 L 47 70" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.8)} />
        {/* seat drum */}
        <Region p={p} name="seat" d={["M 23.5 41 L 23.5 52 Q 23.5 61 35 62 L 65 62 Q 76.5 61 76.5 52 L 76.5 41 Z"]} over={<path d={cupDia} fill={sh} />} line={2.8} />
        <path d="M 27.5 52 Q 28 58 33 59.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.8)} />
        {/* ruffle */}
        <path d={ruffle} fill={WHITE} {...LINE} {...lw(2.6)} />
        <path d={pleats.join(" ")} fill="none" stroke="#c4c6d0" stroke-linecap="round" {...lw(1.3)} />
        {/* handle grips and pom-poms */}
        <Tube d="M 72.5 39.5 L 91 35" w={5.6} color={GRIP} />
        <path d="M 76 37.6 L 87 35.2" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.4)} />
        <Pom cx={70 + s.pom * 0.2} cy={40 + pomDy * 0.6} />
        <Pom cx={93.5 + s.pom * 0.25} cy={34.5 + pomDy} />
      </g>
    </g>
  );
}

/* ---------- front and back views (end-on) ---------- */

/** Side-to-side wobble (deg) for the end-on hop, in place of the side's lean. */
const ROLL_MOVE = [0, 1, 1.5, -2, -2.5, -1.2, 1, 2.2, 1.8, -1.5, 0.8, 0];

const endSt = (anim: "idle" | "move", f: number): S => {
  const s = st(anim, f);
  const n = ROLL_MOVE.length;
  const roll = anim === "idle" ? 0 : ROLL_MOVE[((f % n) + n) % n];
  return { ...s, dx: 0, lean: roll };
};

function endPose(anim: "idle" | "move", f: number) {
  const s = endSt(anim, f);
  const y0 = 88 + PAWN_LIFT + s.comp + s.lag;
  const h = PIVOT_Y - y0;
  const a = (s.lean * Math.PI) / 180;
  return {
    dx: 0,
    dy: s.dy,
    pawnX: h * Math.sin(a),
    pawnY: PIVOT_Y - h * Math.cos(a) - 88,
    pawnTilt: s.lean,
    cut: 66 + Math.max(0, -s.lag),
  };
}

function ruffleFront() {
  const n = 9;
  const xs = Array.from({ length: n + 1 }, (_, i) => 19 + (62 * i) / n);
  const yb = (x: number) => 43.5 + 3.5 * (1 - ((x - 50) / 31) ** 2);
  let ruffle = "M 21 38 Q 50 47 79 38 L 81 " + yb(81).toFixed(2);
  for (let i = n; i > 0; i--) {
    const x0 = xs[i];
    const x1 = xs[i - 1];
    const mx = (x0 + x1) / 2;
    ruffle += ` Q ${mx.toFixed(2)} ${(yb(mx) + 4.5).toFixed(2)} ${x1.toFixed(2)} ${yb(x1).toFixed(2)}`;
  }
  ruffle += " Z";
  const pleats = xs.slice(1, -1).map((x) => {
    const t = (x - 21) / 58;
    const yt = 38 + 2 * t * (1 - t) * 9;
    return `M ${x.toFixed(2)} ${(yt + 1.5).toFixed(2)} L ${x.toFixed(2)} ${(yb(x) - 0.5).toFixed(2)}`;
  });
  return { ruffle, pleats: pleats.join(" ") };
}

/** The handlebar seen end-on: a silver crossbar with a purple grip and a pom-pom at each end. */
function CrossBar({ y, pom, roll }: { y: number; pom: number; roll: number }) {
  const lY = y + pom * 0.85 - roll * 0.15;
  const rY = y + pom * 0.85 + roll * 0.15;
  return (
    <g>
      <Tube d={`M 24 ${y} L 76 ${y}`} w={4.6} color={SILVER} />
      <Tube d={`M 12.5 ${y} L 27 ${y}`} w={5.6} color={GRIP} />
      <Tube d={`M 73 ${y} L 87.5 ${y}`} w={5.6} color={GRIP} />
      <path d={`M 15 ${y - 1.2} L 24.5 ${y - 1.2} M 75.5 ${y - 1.2} L 85 ${y - 1.2}`} stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.4)} />
      <Pom cx={8.5 - pom * 0.25} cy={lY} />
      <Pom cx={91.5 + pom * 0.25} cy={rY} />
    </g>
  );
}

function EndBack({ p, f, anim, view }: RiderProps) {
  const s = endSt(anim, f);
  const c = s.comp;
  const pts = springPoints(POLE_BOT + c);
  const lift = Math.max(0, -s.dy);
  const shR = 13 * (1 - lift / 70) + (anim === "idle" ? c * 0.4 : 0);
  return (
    <g>
      <defs>{p.defs}</defs>
      <ellipse cx={50} cy={98.5 - s.dy} rx={Math.max(6, shR)} ry={2.4 * (1 - lift / 90)} fill="#000" opacity={0.18 * (1 - lift / 80)} />
      <g transform={`rotate(${s.lean} 50 ${PIVOT_Y})`}>
        <rect x={48} y={POLE_BOT - 4 + c} width={4} height={SPRING_BOT + 4 - (POLE_BOT - 4 + c)} fill={SILVER_D} {...LINE} {...lw(2)} />
        {pts.slice(0, -1).map((a, i) =>
          i % 2 === 1 ? (
            <g key={i}>
              <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} {...LINE} {...lw(5.5)} />
              <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} stroke={SILVER_D} stroke-linecap="round" {...lw(2.6)} />
            </g>
          ) : null,
        )}
        <g transform={`translate(0 ${c})`}>
          {view === "back" && <CrossBar y={33.5} pom={s.pom} roll={s.lean} />}
          <path d="M 21 38 Q 22 31 50 31 Q 78 31 79 38 Z" fill={WHITE} {...LINE} {...lw(2.4)} />
          <Region p={p} name="cushion" d={["M 24 38.5 Q 24 33 50 33 Q 76 33 76 38.5 Q 76 43.5 50 43.5 Q 24 43.5 24 38.5 Z"]} over={<path d={`${dia(36, 38, 5, 4)} ${dia(50, 38, 5, 4)} ${dia(64, 38, 5, 4)}`} fill={shade(p)} />} line={2.4} />
          <path d="M 30 36 Q 40 34.2 50 34.4" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.6)} />
        </g>
      </g>
    </g>
  );
}

function EndFront({ p, f, anim, view }: RiderProps) {
  const s = endSt(anim, f);
  const c = s.comp;
  const sh = shade(p);
  const pts = springPoints(POLE_BOT + c);
  const { ruffle, pleats } = ruffleFront();
  const poleDia = [dia(50, 62, 5.5, 5.5), dia(44.5, 73, 5.5, 5.5), dia(55.5, 73, 5.5, 5.5), dia(50, 84, 5.5, 5.5)].join(" ");
  const cupDia = [17, 28, 39, 50, 61, 72, 83].map((x) => dia(x, 54.5, 5.5, 7)).join(" ");
  return (
    <g transform={`rotate(${s.lean} 50 ${PIVOT_Y})`}>
      {pts.slice(0, -1).map((a, i) =>
        i % 2 === 0 ? (
          <g key={i}>
            <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} {...LINE} {...lw(6)} />
            <path d={`M ${a[0]} ${a[1]} L ${pts[i + 1][0]} ${pts[i + 1][1]}`} stroke={SILVER} stroke-linecap="round" {...lw(3)} />
          </g>
        ) : null,
      )}
      <path d="M 41 98 Q 41 90.5 50 90.5 Q 59 90.5 59 98 Z" fill={RED} {...LINE} {...lw(2.6)} />
      <path d="M 44.5 94 Q 46 92.3 48.5 92.1" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-linecap="round" {...lw(1.5)} />
      <g transform={`translate(0 ${c})`}>
        <rect x={33} y={73} width={34} height={5} rx={2.5} fill={SILVER} {...LINE} {...lw(2.4)} />
        <Region p={p} name="pole" d={["M 44.5 56 L 55.5 56 L 55.5 79 Q 55.5 83 50 83 Q 44.5 83 44.5 79 Z"]} over={<path d={poleDia} fill={sh} />} line={2.8} />
        <path d="M 47 64 L 47 70" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.8)} />
        <Region p={p} name="seat" d={["M 23.5 41 L 23.5 52 Q 23.5 61 35 62 L 65 62 Q 76.5 61 76.5 52 L 76.5 41 Z"]} over={<path d={cupDia} fill={sh} />} line={2.8} />
        <path d="M 27.5 52 Q 28 58 33 59.5" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-linecap="round" {...lw(1.8)} />
        <path d={ruffle} fill={WHITE} {...LINE} {...lw(2.6)} />
        <path d={pleats} fill="none" stroke="#c4c6d0" stroke-linecap="round" {...lw(1.3)} />
        {view === "front" && (
          <g>
            <Tube d="M 50 69 L 50 39" w={3.4} color={SILVER} />
            <CrossBar y={39} pom={s.pom} roll={s.lean} />
          </g>
        )}
      </g>
    </g>
  );
}

const endView = (): RiderViewDraft => ({
  frame: [2, -7, 96, 106],
  idle: { ms: [120, 110, 140, 110, 110, 120, 140, 110] },
  move: { ms: [60, 70, 90, 60, 70, 80, 80, 70, 60, 90, 70, 80] },
  pose: endPose,
  Back: EndBack,
  Front: EndFront,
});

export const boingoPogo: RiderDraft = {
  id: "boingo-pogo",
  name: "Boingo's Pogo",
  tier: "mythic",
  description: "A clown's pogo stick with a frilly seat. Every square is a BOING; your opponent's nerves are not included.",
  frame: [15, -7, 84, 106],
  idle: { ms: [120, 110, 140, 110, 110, 120, 140, 110] },
  move: { ms: [60, 70, 90, 60, 70, 80, 80, 70, 60, 90, 70, 80] },
  pose(anim, f) {
    const s = st(anim, f);
    const y0 = 88 + PAWN_LIFT + s.comp + s.lag;
    const h = PIVOT_Y - y0;
    const a = (s.lean * Math.PI) / 180;
    const bx = h * Math.sin(a);
    const by = PIVOT_Y - h * Math.cos(a);
    return {
      dx: s.dx,
      dy: s.dy,
      pawnX: bx,
      pawnY: by - 88,
      pawnTilt: s.lean,
      cut: 66 + Math.max(0, -s.lag),
    };
  },
  Back,
  Front,
  views: { front: endView(), back: endView() },
  trail: {
    ms: [170, 170, 160],
    w: 22,
    h: 14,
    Mark: BounceMark,
  },
};

/* ---------- trail mark: where the rubber foot landed ---------- */

const RUBBER = "#3d3d42";
const RUBBER_D = "#26262a";
const DUST = "#e6d2a6";

function BounceMark({ f }: TrailProps) {
  const k = [1, 1.25, 1.45][Math.min(2, Math.max(0, f))];
  const op = [1, 0.6, 0.25][Math.min(2, Math.max(0, f))];
  const rx = 6.4 * k;
  const ry = 3.8 * k;
  const fl = 7.2 + f * 0.8;
  return (
    <g opacity={op}>
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke={RUBBER} {...lw(f === 0 ? 2.3 : 1.6)} />
      <ellipse cx={0} cy={0} rx={3 * (f === 0 ? 1 : 0.85)} ry={1.8 * (f === 0 ? 1 : 0.85)} fill={RUBBER_D} />
      <circle cx={-fl} cy={-3.2 - f * 0.3} r={1.1} fill={DUST} stroke={RUBBER} {...lw(0.6)} />
      <circle cx={fl + 0.4} cy={2.6 + f * 0.3} r={0.95} fill={DUST} stroke={RUBBER} {...lw(0.6)} />
    </g>
  );
}
