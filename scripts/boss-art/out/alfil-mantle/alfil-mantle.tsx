import { Region, LINE, lw, Pawn, darken, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

const N = 10;
const GOLD = "#f2c14e";
const GOLD_D = "#b9831f";
const GOLD_L = "#fde59a";
const BLUE = "#2747a8";
const INK = "#1d1d1f";
const f1 = (n: number) => n.toFixed(2);

/** One half of the mantle (sgn -1 left, 1 right), its hem swung by dx and rippled by r. */
function geom(sgn: number, dx: number, r: number) {
  const X = (x: number) => (sgn < 0 ? x : 100 - x);
  const P = (x: number, y: number, d = 0) => `${f1(X(x) + d)} ${f1(y)}`;
  const d =
    `M${P(47, 37.6)} Q${P(40, 36.6)} ${P(35, 40.4)} Q${P(30.2, 44.2)} ${P(29.4, 51)} ` +
    `Q${P(25.4, 66, dx * 0.5)} ${P(19.6, 79.8, dx)} Q${P(32, 85 + r, dx)} ${P(46.6, 81.6, dx)} ` +
    `C${P(45.6, 68, dx * 0.5)} ${P(47.8, 50)} ${P(47, 37.6)} Z`;
  // hem quadratic, for the tassels
  const A = [X(19.6) + dx, 79.8], C = [X(32) + dx, 85 + r], B = [X(46.6) + dx, 81.6];
  const at = (t: number) => [
    (1 - t) ** 2 * A[0] + 2 * t * (1 - t) * C[0] + t * t * B[0],
    (1 - t) ** 2 * A[1] + 2 * t * (1 - t) * C[1] + t * t * B[1],
  ];
  const orn = [X(35) + dx * 0.5, 64];
  return { d, hem: [at(0.12), at(0.5), at(0.88)], orn };
}

function Tassel({ x, y, a }: { x: number; y: number; a: number }) {
  return (
    <g transform={`rotate(${f1(a)} ${f1(x)} ${f1(y)})`}>
      <path d={`M${f1(x)} ${f1(y - 0.5)} L${f1(x)} ${f1(y + 2.2)}`} stroke={INK} {...lw(1.6)} />
      <path
        d={`M${f1(x - 1.1)} ${f1(y + 3)} L${f1(x - 2.4)} ${f1(y + 7.6)} Q${f1(x)} ${f1(y + 8.6)} ${f1(x + 2.4)} ${f1(y + 7.6)} L${f1(x + 1.1)} ${f1(y + 3)} Z`}
        fill={GOLD}
        {...LINE}
        {...lw(1.3)}
      />
      <path d={`M${f1(x)} ${f1(y + 4)} L${f1(x)} ${f1(y + 7.4)}`} stroke={GOLD_D} {...lw(0.8)} />
      <circle cx={f1(x)} cy={f1(y + 2.6)} r="1.5" fill={BLUE} stroke={INK} {...lw(1.1)} />
    </g>
  );
}

function Diamond({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${f1(x)} ${f1(y - 6.4)} L${f1(x + 4.6)} ${f1(y)} L${f1(x)} ${f1(y + 6.4)} L${f1(x - 4.6)} ${f1(y)} Z`} fill={GOLD} stroke={INK} stroke-linejoin="round" {...lw(1.5)} />
      <path d={`M${f1(x)} ${f1(y - 3.6)} L${f1(x + 2.6)} ${f1(y)} L${f1(x)} ${f1(y + 3.6)} L${f1(x - 2.6)} ${f1(y)} Z`} fill={BLUE} />
      <circle cx={f1(x)} cy={f1(y)} r="1.1" fill={GOLD_L} />
      <circle cx={f1(x)} cy={f1(y - 9.4)} r="1.2" fill={GOLD} stroke={INK} {...lw(0.9)} />
      <circle cx={f1(x)} cy={f1(y + 9.4)} r="1.2" fill={GOLD} stroke={INK} {...lw(0.9)} />
    </g>
  );
}

function Mantle({ p, side, f }: ArtProps) {
  const ph = (2 * Math.PI * f) / N;
  const s = Math.sin(ph);
  const dx = 2 * s;
  const rL = 1.1 * Math.sin(ph + 1.2);
  const rR = 1.1 * Math.sin(ph + 2.6);
  const halves = [geom(-1, dx, rL), geom(1, dx, rR)];
  // the border is Alfil's deep blue, except where blue fights the field
  const col = p.finish.color;
  const border = col === "cobalt" ? darken(p.hex, 0.5) : col === "midnight" ? "#9e2433" : BLUE;
  return (
    <g>
      <Pawn side={side} />
      {halves.map((h, i) => {
        const clip = `${p.id}-trim${i}`;
        return (
          <g key={i}>
            <Region p={p} name={i ? "mantleR" : "mantleL"} d={[h.d]} outline={false} />
            <clipPath id={clip}>
              <path d={h.d} />
            </clipPath>
            <g clip-path={`url(#${clip})`} fill="none" stroke-linejoin="round">
              <path d={h.d} stroke={GOLD} {...lw(8.4)} />
              <path d={h.d} stroke={border} {...lw(7)} />
              <path d={h.d} stroke={GOLD} {...lw(3.2)} />
              <path d={h.d} stroke={GOLD_L} {...lw(1.4)} opacity="0.7" />
            </g>
            <path d={h.d} fill="none" {...LINE} />
            <Diamond x={h.orn[0]} y={h.orn[1]} />
            {h.hem.map(([x, y], k) => (
              <Tassel key={k} x={x} y={y - 0.6} a={-9 * Math.sin(ph - 0.7 - k * 0.35)} />
            ))}
          </g>
        );
      })}
      {/* the clasp: a gold cord and a jewelled brooch at the throat */}
      <path d="M44 39.4 Q50 42.6 56 39.4" fill="none" stroke={INK} {...lw(3.4)} stroke-linecap="round" />
      <path d="M44 39.4 Q50 42.6 56 39.4" fill="none" stroke={GOLD} {...lw(1.8)} stroke-linecap="round" />
      <circle cx="50" cy="41.4" r="3.6" fill={GOLD} {...LINE} {...lw(1.6)} />
      <circle cx="50" cy="41.4" r="1.7" fill={BLUE} />
      <circle cx="49.4" cy="40.8" r="0.6" fill="#fff" />
    </g>
  );
}

export const alfilMantle: ItemDraft = {
  id: "alfil-mantle",
  name: "Alfil's Mantle",
  tier: "epic",
  slot: "skin",
  description: "Woven for a mammoth, taken in for a pawn. Still has some room in the shoulders.",
  frame: [14, 14, 72, 80],
  motion: { ms: Array(N).fill(280) },
  Art: (props: ArtProps) => <Mantle {...props} />,
};
