import type { RiderDraft, RiderProps, Paint } from "../../item-kit.tsx";
import { Region, LINE, lw, lighten, darken } from "../../item-kit.tsx";

const n = (v: number) => v.toFixed(1);
const TAU = Math.PI * 2;

const FUR = "#2f2d39";
const FUR_FAR = "#221f2a";
const FUR_HI = "#45425a";
const AURA = "#7b5cff";
const GOLD = "#ffc531";
const BULBS = ["#ff4d5e", "#3ddc6b", "#ffcf3a", "#4aa3ff"];

/** A shaggy blob: a rounded (superellipse) outline with pointed tufts that lean by `sweep` and ripple by `phase`. */
function shag(cx: number, cy: number, rx: number, ry: number, count: number, amp: number, phase: number, pw = 0.7, sweep = 0): string {
  const pt = (a: number, push: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), pw) + c * push;
    const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), pw) + s * push;
    return [x, y];
  };
  let d = "";
  for (let i = 0; i < count; i++) {
    const a0 = (TAU * i) / count;
    const a1 = (TAU * (i + 1)) / count;
    const am = (a0 + a1) / 2;
    const k = amp * (1 + 0.35 * Math.sin(phase + i * 1.9));
    const v0 = pt(a0, 0);
    const v1 = pt(a1, 0);
    const tip = pt(am, k);
    tip[0] += sweep;
    const c0 = pt((a0 * 2 + am) / 3, k * 0.35);
    const c1 = pt((a1 * 2 + am) / 3, k * 0.2);
    if (i === 0) d += `M ${n(v0[0])} ${n(v0[1])} `;
    d += `Q ${n(c0[0])} ${n(c0[1])} ${n(tip[0])} ${n(tip[1])} Q ${n(c1[0])} ${n(c1[1])} ${n(v1[0])} ${n(v1[1])} `;
  }
  return d + "Z";
}

/** A stubby leg from under the body (top hidden) to a round paw; fx swings the paw, lift raises it. */
function leg(x: number, fx: number, lift: number): string {
  const px = x + fx;
  const by = 95 - lift;
  return `M ${n(x - 6)} 70 L ${n(x + 6)} 70 L ${n(px + 6.5)} ${n(by - 5)} Q ${n(px + 8)} ${n(by)} ${n(px + 1)} ${n(by)} L ${n(px - 3)} ${n(by)} Q ${n(px - 8)} ${n(by)} ${n(px - 6.5)} ${n(by - 5)} Z`;
}

/** Leg swing for a frame: idle stands still; move pads in two strides per square. */
function legPose(anim: "idle" | "move", f: number, ph: number): [number, number] {
  if (anim === "idle") return [0, 0];
  const a = (TAU * f) / 4 + ph;
  return [7 * Math.sin(a), Math.max(0, Math.cos(a)) * 3.5];
}

/** The body's breathing / gliding bob. */
function bob(anim: "idle" | "move", f: number): number {
  if (anim === "idle") return [0, 0.4, 0.9, 1.2, 0.9, 0.4, 0, -0.2][f % 8];
  return 1.8 + 0.8 * Math.sin((TAU * f) / 4);
}

function quad(a: number[], c: number[], b: number[], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function Bulb({ x, y, ang, c, bright }: { x: number; y: number; ang: number; c: string; bright: boolean }) {
  return (
    <g transform={`translate(${n(x)} ${n(y)}) rotate(${n(ang)})`}>
      <circle cx="0" cy="4.6" r={bright ? 6.5 : 4.4} fill={c} opacity={bright ? 0.45 : 0.22} />
      <rect x="-1.7" y="-0.6" width="3.4" height="2.6" rx="0.6" fill="#55525f" {...LINE} {...lw(1.2)} />
      <path d="M 0 1.8 C 2.8 1.8 2.9 5.2 0 8 C -2.9 5.2 -2.8 1.8 0 1.8 Z" fill={bright ? lighten(c, 0.45) : c} {...LINE} {...lw(1.4)} />
      <ellipse cx="-0.8" cy="3.8" rx="0.6" ry="1" fill="#fff" opacity="0.8" />
    </g>
  );
}

function Lights({ anim, f }: { anim: "idle" | "move"; f: number }) {
  const b = bob(anim, f);
  const reinsA = [101, 58 + b];
  const reinsC = [88, 76 + b];
  const reinsB = [71, 58 + b];
  const hemA = [26, 72 + b];
  const hemM = [50, 74 + b];
  const hemB = [74, 72 + b];
  const hem1 = [38, 82 + b];
  const hem2 = [62, 82 + b];
  const pts: [number, number][] = [
    quad(hemA, hem1, hemM, 0.3),
    quad(hemA, hem1, hemM, 0.72),
    quad(hemM, hem2, hemB, 0.28),
    quad(hemM, hem2, hemB, 0.7),
    quad(reinsB, reinsC, reinsA, 0.25),
    quad(reinsB, reinsC, reinsA, 0.52),
    quad(reinsB, reinsC, reinsA, 0.78),
  ];
  const bright = anim === "idle" ? f % 8 : (f * 3) % 7;
  const swing = (i: number) => (anim === "move" ? 22 * Math.sin((TAU * f) / 4 + i * 0.7) : 4 * Math.sin((TAU * f) / 8 + i));
  const wire = `M ${n(hemA[0])} ${n(hemA[1])} Q ${n(hem1[0])} ${n(hem1[1])} ${n(hemM[0])} ${n(hemM[1])} Q ${n(hem2[0])} ${n(hem2[1])} ${n(hemB[0])} ${n(hemB[1])}`;
  const reins = `M ${n(reinsB[0])} ${n(reinsB[1])} Q ${n(reinsC[0])} ${n(reinsC[1])} ${n(reinsA[0])} ${n(reinsA[1])}`;
  return (
    <g>
      <path d={wire} fill="none" {...LINE} {...lw(3.2)} />
      <path d={wire} fill="none" stroke="#3f8a4a" stroke-linecap="round" {...lw(1.4)} />
      <path d={reins} fill="none" {...LINE} {...lw(3.2)} />
      <path d={reins} fill="none" stroke="#3f8a4a" stroke-linecap="round" {...lw(1.4)} />
      {pts.map(([x, y], i) => (
        <Bulb key={i} x={x} y={y} ang={swing(i)} c={BULBS[i % 4]} bright={i === bright} />
      ))}
    </g>
  );
}

function Back({ anim, f }: RiderProps) {
  const b = bob(anim, f);
  const ph = (TAU * f) / 8;
  const body = shag(50, 68 + b, 40, 15, 18, 3.2, ph);
  const hb = anim === "move" ? -0.6 * Math.sin((TAU * f) / 4) : b * 0.6;
  const head = shag(89, 49 + hb, 13.5, 12.5, 11, 2.6, ph + 1, 0.85);
  const wag = anim === "idle" ? 8 * Math.sin((TAU * f) / 8) : 14 + 6 * Math.sin((TAU * f) / 4);
  const tail = shag(0, 0, 11, 6, 9, 2.6, ph, 0.8);
  const [f1x, f1l] = legPose(anim, f, Math.PI);
  const [f2x, f2l] = legPose(anim, f, 0);
  // the wisp: puffs left in the world every other frame, so they stay put while the beast slinks on, and fade
  const puffs: { x: number; y: number; r: number; o: number }[] = [];
  if (anim === "move") {
    for (let k = 0; k < 3; k++) {
      const age = (f % 2) + 2 * k;
      const emitF = f - age;
      const x = 6 - age * 12.5 + 4;
      const wob = Math.sin(emitF * 1.3) * 2;
      puffs.push({ x, y: 70 - age * 2.4 + wob, r: 6.5 + age * 1.3, o: Math.max(0, 0.95 - age * 0.16) });
    }
  }
  return (
    <g>
      {puffs.map((q, i) => (
        <g key={`p${i}`} opacity={q.o}>
          <circle cx={q.x} cy={q.y} r={q.r} fill="#3b2d6e" />
          <circle cx={q.x + q.r * 0.7} cy={q.y - q.r * 0.45} r={q.r * 0.75} fill="#4d3c94" />
          <circle cx={q.x - q.r * 0.6} cy={q.y + 1.5} r={q.r * 0.55} fill="#2e2452" />
          <path d={`M ${n(q.x - q.r * 0.5)} ${n(q.y)} q ${n(q.r * 0.4)} ${n(-q.r * 0.7)} ${n(q.r * 0.9)} ${n(-q.r * 0.2)} q ${n(q.r * 0.3)} ${n(q.r * 0.4)} ${n(-q.r * 0.1)} ${n(q.r * 0.5)}`} fill="none" stroke="#8f78ff" stroke-linecap="round" {...lw(1.4)} />
        </g>
      ))}
      {/* violet glow round the beast */}
      <g opacity="0.55">
        <path d={body} fill={AURA} stroke={AURA} {...lw(5)} stroke-linejoin="round" />
        <path d={head} fill={AURA} stroke={AURA} {...lw(5)} stroke-linejoin="round" transform={`translate(89 ${n(49 + hb)}) scale(1.15) translate(-89 ${n(-49 - hb)})`} />
        <path d={`M 80 ${n(40 + hb)} L 79 ${n(28 + hb)} L 88 ${n(37 + hb)} Z M 93 ${n(37 + hb)} L 99 ${n(26 + hb)} L 101 ${n(41 + hb)} Z`} fill={AURA} stroke={AURA} {...lw(5)} stroke-linejoin="round" transform={`translate(89 ${n(49 + hb)}) scale(1.15) translate(-89 ${n(-49 - hb)})`} />
        <path d={leg(26, f2x, f2l)} fill={AURA} stroke={AURA} {...lw(5)} />
        <path d={leg(36, f1x, f1l)} fill={AURA} stroke={AURA} {...lw(5)} />
        <path d={leg(64, f1x, f1l)} fill={AURA} stroke={AURA} {...lw(5)} />
        <path d={leg(76, f2x, f2l)} fill={AURA} stroke={AURA} {...lw(5)} />
      </g>
      {/* tail */}
      <g transform={`translate(11 ${n(64 + b)}) rotate(${n(-35 + wag)}) translate(-9 0)`}>
        <path d={tail} fill={AURA} stroke={AURA} opacity="0.55" {...lw(5)} />
        <path d={tail} fill={FUR} {...LINE} />
        <path d="M -6 -1 Q -1 -3 4 -1" fill="none" stroke={FUR_HI} stroke-linecap="round" {...lw(1.6)} />
      </g>
      {/* far legs */}
      <path d={leg(36, f1x, f1l)} fill={FUR_FAR} {...LINE} />
      <path d={leg(76, f2x, f2l)} fill={FUR_FAR} {...LINE} />
    </g>
  );
}

function Blanket({ p, b }: { p: Paint; b: number }) {
  const y = (v: number) => n(v + b);
  const d = `M 28 ${y(56)} Q 50 ${y(49)} 72 ${y(56)} L 75 ${y(74)} L 69 ${y(78)} L 62 ${y(74)} L 56 ${y(78)} L 50 ${y(74)} L 44 ${y(78)} L 38 ${y(74)} L 31 ${y(78)} L 25 ${y(74)} Z`;
  const band = `M 20 ${y(65)} L 80 ${y(65)} L 80 ${y(69)} L 20 ${y(69)} Z`;
  const edge = `M 31 ${y(57.5)} Q 50 ${y(52)} 69 ${y(57.5)}`;
  return (
    <Region
      p={p}
      name="blanket"
      d={[d]}
      over={
        <g>
          <path d={band} fill={lighten(p.hex, 0.45)} />
          <path d={band} fill="none" stroke={darken(p.hex, 0.35)} {...lw(1.2)} />
          <path d={edge} fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.8)} />
          {[30, 40, 50, 60, 70].map((x) => (
            <circle key={x} cx={x} cy={67 + b} r="1.2" fill={darken(p.hex, 0.4)} />
          ))}
        </g>
      }
    />
  );
}

function Front({ p, anim, f }: RiderProps) {
  const b = bob(anim, f);
  const hb = anim === "move" ? -0.6 * Math.sin((TAU * f) / 4) : b * 0.6;
  const ph = (TAU * f) / 8;
  const body = shag(50, 68 + b, 40, 15, 18, 3.2, ph);
  const head = shag(89, 49 + hb, 13.5, 12.5, 11, 2.6, ph + 1, 0.85);
  const [f1x, f1l] = legPose(anim, f, Math.PI);
  const [f2x, f2l] = legPose(anim, f, 0);
  // blink: slow lids on idle frames 5-6
  const lid = anim === "idle" ? [1, 1, 1, 1, 1, 0.45, 0.1, 0.6][f % 8] : 1;
  const ey = 47 + hb;
  const look = anim === "move" ? 0.8 : 0;
  return (
    <g>
      {/* near legs */}
      <path d={leg(26, f2x, f2l)} fill={FUR} {...LINE} />
      <path d={leg(64, f1x, f1l)} fill={FUR} {...LINE} />
      {/* body */}
      <path d={body} fill={FUR} {...LINE} />
      <path d={`M 16 ${n(76 + b)} Q 28 ${n(81 + b)} 40 ${n(79 + b)} M 60 ${n(80 + b)} Q 72 ${n(81 + b)} 82 ${n(75 + b)}`} fill="none" stroke={FUR_HI} stroke-linecap="round" {...lw(1.6)} />
      {/* a little violet swirl of darkness on the rump */}
      <path d={`M 17 ${n(66 + b)} q 0 -4 4 -4 q 4 0 4 4 q 0 5 -5 5 q -6 0 -6 -6`} fill="none" stroke={AURA} stroke-linecap="round" {...lw(1.8)} />
      <circle cx="13" cy={n(60 + b)} r="0.9" fill="#d9ccff" />
      {/* head and ears */}
      <g transform={`translate(89 ${n(49 + hb)}) scale(1.15) translate(-89 ${n(-49 - hb)})`}>
      <path d={`M 80 ${n(40 + hb)} L 79 ${n(28 + hb)} L 88 ${n(37 + hb)} Z`} fill={FUR} {...LINE} />
      <path d={`M 93 ${n(37 + hb)} L 99 ${n(26 + hb)} L 101 ${n(41 + hb)} Z`} fill={FUR} {...LINE} />
      <path d={head} fill={FUR} {...LINE} />
      <path d={`M 81.5 ${n(37 + hb)} L 81 ${n(32 + hb)} L 84.5 ${n(36 + hb)} Z`} fill="#6b4b8a" />
      <path d={`M 96.5 ${n(37 + hb)} L 98.5 ${n(31 + hb)} L 99 ${n(38 + hb)} Z`} fill="#6b4b8a" />
      <path d={`M 80 ${n(44 + hb)} Q 83 ${n(40 + hb)} 88 ${n(39.5 + hb)}`} fill="none" stroke={FUR_HI} stroke-linecap="round" {...lw(1.6)} />
      {/* eyes */}
      {[
        [90, 4.6],
        [99.5, 3.8],
      ].map(([x, r]) => (
        <g key={x}>
          <ellipse cx={x} cy={n(ey)} rx={r + 1.6} ry={n((r + 1.6) * Math.max(lid, 0.3))} fill={GOLD} opacity="0.3" />
          {lid < 0.3 ? (
            <path d={`M ${n(x - r)} ${n(ey)} Q ${x} ${n(ey + r * 0.7)} ${n(x + r)} ${n(ey)}`} fill="none" stroke={GOLD} stroke-linecap="round" {...lw(1.8)} />
          ) : (
            <ellipse cx={x} cy={n(ey)} rx={r} ry={n(r * lid)} fill={GOLD} {...LINE} {...lw(1.6)} />
          )}
          {lid > 0.5 && (
            <>
              <ellipse cx={n(x + 1 + look)} cy={n(ey + 0.4)} rx={r * 0.42} ry={n(r * 0.62 * lid)} fill="#1d1d1f" />
              <circle cx={n(x - r * 0.35)} cy={n(ey - r * 0.4 * lid)} r={r * 0.28} fill="#fff" />
            </>
          )}
        </g>
      ))}
      {/* blush and a small smile */}
      <ellipse cx="88" cy={n(54 + hb)} rx="2.4" ry="1.2" fill="#c06bb0" opacity="0.8" />
      <path d={`M 96 ${n(55 + hb)} q 2 2 4 0`} fill="none" stroke={GOLD} stroke-linecap="round" {...lw(1.3)} />
      </g>
      {/* saddle blanket */}
      <Blanket p={p} b={b} />
      <Lights anim={anim} f={f} />
    </g>
  );
}

export const hollowSteed: RiderDraft = {
  id: "hollow-steed",
  name: "Hollow's Shade",
  tier: "mythic",
  description: "A shaggy shadow that lets you ride it home. Strung with lights, so nobody trips over it in the dark.",
  frame: [-8, 4, 118, 96],
  idle: { ms: [220, 220, 220, 220, 220, 160, 180, 200] },
  move: { ms: [90, 90, 90, 90, 90, 90, 90, 90] },
  pose: (anim, f) => {
    const b = bob(anim, f);
    if (anim === "idle") return { dx: 0, dy: 0, pawnX: 0, pawnY: -13 + b, cut: 66 };
    return { dx: 12.5 * f, dy: 0, pawnX: 0, pawnY: -13 + b, pawnTilt: 3, cut: 66 };
  },
  Back,
  Front,
};
