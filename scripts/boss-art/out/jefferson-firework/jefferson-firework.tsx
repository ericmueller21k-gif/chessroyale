import { Region, LINE, lw, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

/**
 * Jefferson's Firework: a big Roman candle held upright at the pawn's right side, a cream cardboard tube wound with
 * diagonal bands in its color, cardboard rims, a gold cap and a dark fuse whose tip fizzes like a sparkler.
 * Drawn on its own axis (base at 0 0, up is -y), then tilted.
 */
const CREAM = "#f6ead2";
const RIM = "#c98f4e";
const N = 8;

const stripes = [-6, -16.5, -27, -37.5, -48].map(
  (y) => `M-8 ${y} L8 ${y - 8} L8 ${y - 13} L-8 ${y - 5} Z`,
);

// sparks: [angle deg (0 = up), speed, start frame]
const SPARKS: [number, number, number][] = [
  [-60, 3.2, 0],
  [35, 3.6, 1],
  [-15, 4, 3],
  [75, 3, 4],
  [10, 3.4, 6],
  [-95, 2.8, 5],
  [55, 3.8, 2],
  [-40, 3.4, 7],
];

function star(x: number, y: number, r: number) {
  const s = r * 0.32;
  return `M${x} ${y - r} L${x + s} ${y - s} L${x + r} ${y} L${x + s} ${y + s} L${x} ${y + r} L${x - s} ${y + s} L${x - r} ${y} L${x - s} ${y - s} Z`;
}

function Art({ p, f }: ArtProps) {
  const tx = -4.5;
  const ty = -77;
  const glow = 2.2 + 0.7 * Math.abs(Math.sin((f * Math.PI * 3) / N));
  const sparks = SPARKS.map(([a, v, s], i) => {
    const ph = (f - s + N) % N;
    if (ph > 2) return null;
    const rad = (a * Math.PI) / 180;
    const d = 2.5 + v * (ph + 0.6);
    const x = tx + Math.sin(rad) * d;
    const y = ty - Math.cos(rad) * d + ph * ph * 0.6;
    const r = ph === 0 ? 2.6 : ph === 1 ? 2 : 1.3;
    return (
      <path
        key={i}
        d={star(x, y, r)}
        fill={ph === 0 ? "#fffbe0" : ph === 1 ? "#ffd23a" : "#ff8a1e"}
        stroke="#7a2a00"
        stroke-linejoin="round"
        {...lw(0.6)}
      />
    );
  });
  return (
    <g transform="translate(79 91) rotate(8)">
      {/* tube */}
      <rect x="-8" y="-66" width="16" height="66" fill={CREAM} />
      <Region p={p} name="bands" d={stripes} outline={false} />
      <path d="M-8 -66 H8 V0 H-8 Z" fill="none" {...LINE} />
      {/* rims */}
      <rect x="-9" y="-5.5" width="18" height="6" rx="1.2" fill={RIM} {...LINE} {...lw(2)} />
      <rect x="-9" y="-66.5" width="18" height="5.5" rx="1.2" fill={RIM} {...LINE} {...lw(2)} />
      {/* highlight */}
      <path d="M-5 -58 V-9" stroke="#fff" opacity="0.55" stroke-linecap="round" {...lw(1.6)} />
      {/* cap */}
      <path d="M-7.5 -66.5 L0 -73.5 L7.5 -66.5 Z" fill="#f2b632" {...LINE} {...lw(2)} />
      <path d="M-3.5 -67.5 L0 -71" stroke="#fff6c8" stroke-linecap="round" {...lw(1)} />
      {/* fuse */}
      <path d="M0 -73 Q1 -76 -2 -76.5 Q-4 -77 -4.5 -77" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(2.4)} />
      {/* fizz */}
      <circle cx={tx} cy={ty} r={glow + 1.2} fill="#ff8a1e" opacity="0.45" />
      <circle cx={tx} cy={ty} r={glow} fill="#ffd23a" />
      <circle cx={tx} cy={ty} r={glow * 0.5} fill="#fffbe0" />
      {sparks}
    </g>
  );
}

export const item: ItemDraft = {
  id: "jefferson-firework",
  name: "Jefferson's Firework",
  tier: "epic",
  slot: "weapon",
  description: "A Roman candle the size of a pawn. The fuse is already lit, so maybe make your move quickly.",
  frame: [60, 0, 46, 94],
  motion: { ms: Array(N).fill(140) },
  Art,
};
