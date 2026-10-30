import type { ItemDraft, ArtProps } from "../../item-kit.tsx";
import { Region, LINE, lw, lighten } from "../../item-kit.tsx";

const S = 1.3;
const N = 10;

type Bulb = { x: number; y: number; a: number };

const q = (p0: number[], c: number[], p2: number[], t: number) => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1],
];

const HAND = [75, 49];
const L = { c: [62, 58], e: [58, 77] };
const R = { c: [89, 58], e: [90, 77] };

const TS = [0.36, 0.68, 1];
const LA = [38, -12, 14];
const RA = [-38, 12, -14];

// chase order along the string: left bottom up to the hand, then down the right
const BULBS: Bulb[] = [
  ...[2, 1, 0].map((i) => {
    const [x, y] = q(HAND, L.c, L.e, TS[i]);
    return { x, y, a: LA[i] };
  }),
  ...[0, 1, 2].map((i) => {
    const [x, y] = q(HAND, R.c, R.e, TS[i]);
    return { x, y, a: RA[i] };
  }),
];

function tf(b: Bulb, x: number, y: number) {
  const r = (b.a * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  x *= S;
  y *= S;
  return `${(b.x + x * c - y * s).toFixed(2)} ${(b.y + x * s + y * c).toFixed(2)}`;
}
const path = (b: Bulb, cmds: (string | [number, number])[]) =>
  cmds.map((c) => (typeof c === "string" ? c : tf(b, c[0], c[1]))).join(" ");

const bulbD = (b: Bulb) =>
  path(b, ["M", [-2.6, 4], "C", [-6.2, 7], [-5.6, 12.5], [0, 15.5], "C", [5.6, 12.5], [6.2, 7], [2.6, 4], "Z"]);
const socketD = (b: Bulb) => path(b, ["M", [-2.4, -0.5], "L", [2.4, -0.5], "L", [2.8, 4.4], "L", [-2.8, 4.4], "Z"]);
const glintD = (b: Bulb) => path(b, ["M", [-2.6, 7], "C", [-3.6, 8.5], [-3.4, 10.5], [-2.2, 12]]);
const center = (b: Bulb) => tf(b, 0, 9.5).split(" ").map(Number);

function brightness(i: number, f: number) {
  const phase = (f * 6) / N;
  let d = Math.abs(phase - i);
  d = Math.min(d, 6 - d);
  return Math.max(0, 1 - d);
}

const wire = (e: number[], c: number[]) => `M ${HAND[0]} ${HAND[1]} Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`;
const WIRES = [
  wire(L.e, L.c),
  wire(R.e, R.c),
  // the little loop of slack above the hand
  `M ${HAND[0]} ${HAND[1]} C 70 40 80 37 79 43 C 78 47 74 47 ${HAND[0]} ${HAND[1]}`,
];

function Art({ p, f }: ArtProps) {
  const halo = lighten(p.hex, 0.55);
  const hot = lighten(p.hex, 0.7);
  return (
    <g>
      {/* glow halos behind everything */}
      {BULBS.map((b, i) => {
        const k = brightness(i, f);
        if (k <= 0.01) return null;
        const [cx, cy] = center(b);
        return (
          <g key={`h${i}`}>
            <circle cx={cx} cy={cy} r={12} fill={halo} opacity={0.3 * k} />
            <circle cx={cx} cy={cy} r={8.5} fill={halo} opacity={0.5 * k} />
          </g>
        );
      })}
      {WIRES.map((d) => (
        <path key={`wo${d}`} d={d} fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(4.2)} />
      ))}
      {WIRES.map((d) => (
        <path key={`wi${d}`} d={d} fill="none" stroke="#2f5b36" stroke-linecap="round" {...lw(1.8)} />
      ))}
      {/* the hand's grip: a twist of wire */}
      <ellipse cx={HAND[0]} cy={HAND[1] + 0.5} rx={3.2} ry={2.6} fill="#2f5b36" {...LINE} {...lw(2)} />
      {BULBS.map((b, i) => {
        const k = brightness(i, f);
        const d = bulbD(b);
        return (
          <g key={`b${i}`}>
            <Region p={p} name={`bulb${i}`} d={[d]} line={2.4} over={
              <>
                <path d={d} fill="#1d1d1f" opacity={0.28 * (1 - k)} />
                <path d={d} fill={hot} opacity={0.55 * k} />
              </>
            } />
            <path d={glintD(b)} fill="none" stroke="#fff" stroke-linecap="round" opacity={0.6 + 0.4 * k} {...lw(1.6)} />
            <path d={socketD(b)} fill="#9a9ca3" {...LINE} {...lw(2)} />
            <path d={path(b, ["M", [-2.6, 1.6], "L", [2.6, 1.6]])} stroke="#5d5f66" {...lw(1)} />
          </g>
        );
      })}
    </g>
  );
}

export const hollowLights: ItemDraft = {
  id: "hollow-lights",
  name: "Hollow's String of Lights",
  tier: "epic",
  slot: "weapon",
  description: "Warm light for dark places. Hollow swears he's not afraid of the dark; he just likes it festive.",
  frame: [38, 36, 66, 68],
  motion: { ms: Array(N).fill(200) },
  Art,
};
