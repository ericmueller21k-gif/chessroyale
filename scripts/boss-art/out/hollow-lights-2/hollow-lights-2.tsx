import type { ItemDraft, ArtProps } from "../../item-kit.tsx";
import { Region, LINE, lw, lighten } from "../../item-kit.tsx";

const N = 10;

type Bulb = { x: number; y: number; a: number };

// the grip (Hollow's fist round the string), held up at the pawn's side; the string hangs down from it in one strand
const HAND = [81, 33];
const C1 = [87.5, 49], C2 = [86.5, 66], END = [91.5, 82];
const STRAND = `M ${HAND[0]} ${HAND[1]} C ${C1[0]} ${C1[1]} ${C2[0]} ${C2[1]} ${END[0]} ${END[1]}`;
const cub = (t: number) => {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  const P = [HAND, C1, C2, END];
  return [0, 1].map((k) => P.reduce((s, q, j) => s + w[j] * q[k], 0));
};

// chase order: down the string, the bulbs sticking out left and right in turn
const BULBS: Bulb[] = [
  [0.24, 40],
  [0.44, -50],
  [0.63, 30],
  [0.82, -42],
  [1, -12],
].map(([t, a]) => {
  const [x, y] = cub(t);
  return { x, y, a };
});

function tf(b: Bulb, x: number, y: number) {
  const r = (b.a * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return `${(b.x + x * c - y * s).toFixed(2)} ${(b.y + x * s + y * c).toFixed(2)}`;
}
const pt = (b: Bulb, x: number, y: number) => tf(b, x, y).split(" ").map(Number);
const path = (b: Bulb, cmds: (string | [number, number])[]) =>
  cmds.map((c) => (typeof c === "string" ? c : tf(b, c[0], c[1]))).join(" ");

// a big old C9 bulb: socket from 0 to 4.6, glass from 4.6 to 15.6
const bulbD = (b: Bulb) =>
  path(b, ["M", [-2.7, 4.6], "C", [-7, 7.4], [-6.4, 12.6], [0, 15.6], "C", [6.4, 12.6], [7, 7.4], [2.7, 4.6], "Z"]);
const socketD = (b: Bulb) => path(b, ["M", [-2.5, -0.6], "L", [2.5, -0.6], "L", [3, 5], "L", [-3, 5], "Z"]);
const glintD = (b: Bulb) => path(b, ["M", [-3, 7.8], "C", [-4, 9.2], [-3.7, 11.2], [-2.4, 12.4]]);
const GC = 10; // the glass's center, along the bulb

/** How lit each bulb is on frame f: one bulb full on the even frames, handing over on the odd ones. */
function lit(i: number, f: number) {
  const cur = Math.floor(f / 2);
  if (f % 2 === 0) return i === cur ? 1 : 0;
  if (i === cur) return 0.6;
  if (i === (cur + 1) % 5) return 0.4;
  return 0;
}

const WIRES = [
  STRAND,
  // a little loop of slack above the grip
  `M ${HAND[0]} ${HAND[1]} C 76 25 84 20 86.5 25 C 88 29 85 33 ${HAND[0]} ${HAND[1]}`,
];

function Art({ p, f }: ArtProps) {
  const halo = lighten(p.hex, 0.55);
  const hot = lighten(p.hex, 0.5);
  const ray = lighten(p.hex, 0.8);
  const hid = `${p.id}-halo`;
  const cid = `${p.id}-core`;
  return (
    <g>
      <defs>
        <radialGradient id={hid}>
          <stop offset="0" stop-color="#fff" stop-opacity="0.95" />
          <stop offset="0.35" stop-color={halo} stop-opacity="0.8" />
          <stop offset="1" stop-color={halo} stop-opacity="0" />
        </radialGradient>
        <radialGradient id={cid} cx="0.5" cy="0.58" r="0.55">
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.45" stop-color={hot} />
          <stop offset="1" stop-color={hot} stop-opacity="0" />
        </radialGradient>
      </defs>
      {/* glow halos behind everything */}
      {BULBS.map((b, i) => {
        const k = lit(i, f);
        if (k <= 0) return null;
        const [cx, cy] = pt(b, 0, GC);
        return <circle key={`h${i}`} cx={cx} cy={cy} r={7 + 7 * k} fill={`url(#${hid})`} opacity={k} />;
      })}
      {WIRES.map((d) => (
        <path key={`wo${d}`} d={d} fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(4.4)} />
      ))}
      {WIRES.map((d) => (
        <path key={`wi${d}`} d={d} fill="none" stroke="#2f5b36" stroke-linecap="round" {...lw(2)} />
      ))}
      {/* the grip: a twist of wire */}
      <ellipse cx={HAND[0]} cy={HAND[1] + 0.5} rx={3.4} ry={2.8} fill="#2f5b36" {...LINE} {...lw(2)} />
      {BULBS.map((b, i) => {
        const k = lit(i, f);
        const d = bulbD(b);
        return (
          <g key={`b${i}`}>
            <Region p={p} name={`bulb${i}`} d={[d]} line={2.4} over={
              <>
                <path d={d} fill="#1d1d1f" opacity={0.32 * (1 - k)} />
                {k > 0 && <path d={d} fill={`url(#${cid})`} opacity={k} />}
              </>
            } />
            <path d={glintD(b)} fill="none" stroke="#fff" stroke-linecap="round" opacity={0.55 + 0.45 * k} {...lw(1.6)} />
            <path d={socketD(b)} fill="#9a9ca3" {...LINE} {...lw(2)} />
            <path d={path(b, ["M", [-2.8, 2.2], "L", [2.8, 2.2]])} stroke="#5d5f66" {...lw(1)} />
          </g>
        );
      })}
      {/* the twinkle: little rays round the bulb at full light */}
      {BULBS.map((b, i) => {
        if (lit(i, f) < 1) return null;
        const [cx, cy] = pt(b, 0, GC);
        const rays = [0, 1, 2, 3, 4, 5].map((j) => {
          const t = ((j * 60 + 30 + b.a) * Math.PI) / 180;
          const r0 = 9.2, r1 = 11.8;
          return `M ${(cx + r0 * Math.cos(t)).toFixed(2)} ${(cy + r0 * Math.sin(t)).toFixed(2)} L ${(cx + r1 * Math.cos(t)).toFixed(2)} ${(cy + r1 * Math.sin(t)).toFixed(2)}`;
        });
        return (
          <g key={`r${i}`}>
            {rays.map((d) => <path key={`ro${d}`} d={d} stroke="#1d1d1f" stroke-linecap="round" {...lw(3)} />)}
            {rays.map((d) => <path key={`ri${d}`} d={d} stroke={ray} stroke-linecap="round" {...lw(1.3)} />)}
          </g>
        );
      })}
    </g>
  );
}

export const hollowLights2: ItemDraft = {
  id: "hollow-lights",
  name: "Hollow's String of Lights",
  tier: "epic",
  slot: "weapon",
  description: "Warm light for dark places. Hollow isn't afraid of the dark; he just likes it festive.",
  frame: [62, 16, 44, 86],
  motion: { ms: Array(N).fill(210) },
  Art,
};
