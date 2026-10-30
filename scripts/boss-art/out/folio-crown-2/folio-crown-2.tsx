import { Region, LINE, lw, darken, lighten, isLight, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

// wing lift per frame: 0 folded down along the back, 1 lifted into a V
const LIFT = [0, 0.22, 0.55, 0.85, 1, 0.82, 0.55, 0.28, 0.08];
const MS = [1200, 170, 170, 170, 750, 190, 190, 190, 220];

const CREAM = "#f8eed6";
const CREAM2 = "#dcc694";
const GOLD = "#f2c14e";
const INK = "#8797c4";

const n = (v: number) => v.toFixed(2);
const P = (x: number, y: number) => `${n(x)} ${n(y)}`;

// the folded points' tips [x, y] and the valley to their right (x; the last is the crown's edge)
const TIPS: [number, number, number][] = [
  [33.3, 9.5, 38.5],
  [42, 11, 46],
  [50, 12, 54],
  [58, 11, 61.5],
  [66.7, 9.5, 66.2],
];
const VALLEY = 16;
const POINTS = "M34.2 20.5 L33.3 9.5 L38.5 16 L42 11 L46 16 L50 12 L54 16 L58 11 L61.5 16 L66.7 9.5 L65.8 20.5 Z";

function Crane({ t }: { t: number }) {
  const e = t * t * (3 - 2 * t);
  const L = (a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
  // wing tips: folded back along the body -> lifted into a V
  const ft = L([67.5, 12], [57.5, -4]);
  const bt = L([65, 7.5], [43.5, -3.5]);
  const O = { ...LINE, ...lw(1.4) };
  const fa: [number, number] = [44.5, 12.8];
  const fb: [number, number] = [56, 11.8];
  const backWing = `M${P(45.5, 11)} L${P(bt[0], bt[1])} L${P(55.5, 10.2)} Z`;
  const frontWing = `M${P(fa[0], fa[1])} L${P(ft[0], ft[1])} L${P(fb[0], fb[1])} Z`;
  const mid: [number, number] = [(fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2 + 0.3];
  const at = (k: number, off = 0): [number, number] => [fa[0] + (ft[0] - fa[0]) * k + off, fa[1] + (ft[1] - fa[1]) * k];
  return (
    <g>
      {/* back wing */}
      <path d={backWing} fill={CREAM2} {...O} />
      {/* tail point, up to the right */}
      <path d="M55 15 L67.6 1.4 L70.6 2.6 L62.5 11.6 Z" fill={CREAM2} {...O} />
      {/* body: a folded boat, shade on its lower face */}
      <path d="M38.5 12 L50 9.2 L62.5 11.2 L51 18 Z" fill={CREAM} />
      <path d="M38.5 12 L51 18 L62.5 11.2 L50.5 13.2 Z" fill={CREAM2} />
      <path d="M38.5 12 L50 9.2 L62.5 11.2 L51 18 Z" fill="none" {...O} />
      {/* neck up to the left, head with its beak */}
      <path d="M39 12.5 L34.8 1.6 L38.2 0.8 L47.2 15 Z" fill={CREAM} />
      <path d="M39 12.5 L34.8 1.6 L36.6 1.2 L42.4 11.4 Z" fill={CREAM2} />
      <path d="M39 12.5 L34.8 1.6 L38.2 0.8 L47.2 15 Z" fill="none" {...O} />
      <path d="M38 -1.2 L39.6 2.4 L29.2 4.6 Z" fill={CREAM} {...O} />
      <circle cx="37.3" cy="1.6" r="0.55" fill="#1d1d1f" />
      {/* front wing: light face, shade face along its crease, gold on the leading edge */}
      <path d={frontWing} fill={CREAM} />
      <path d={`M${P(mid[0], mid[1])} L${P(ft[0], ft[1])} L${P(fb[0], fb[1])} Z`} fill={CREAM2} />
      <path d={`M${P(...at(0.12))} L${P(...at(0.88))}`} stroke={GOLD} stroke-linecap="round" {...lw(1.4)} />
      <path d={`M${P(...at(0.42, 2))} l1.3 -0.5 l1.3 0.5`} fill="none" stroke={INK} stroke-linecap="round" {...lw(0.9)} />
      <path d={`M${P(...at(0.62, 1.6))} l1.1 -0.45 l1.1 0.45`} fill="none" stroke={INK} stroke-linecap="round" {...lw(0.9)} />
      <path d={`M${P(mid[0], mid[1])} L${P(ft[0], ft[1])}`} stroke="#1d1d1f" opacity="0.3" {...lw(0.8)} />
      <path d={frontWing} fill="none" {...O} />
    </g>
  );
}

function Art({ p, f }: ArtProps) {
  const light = isLight(p.hex);
  const ink = light ? darken(p.hex, 0.38) : lighten(p.hex, 0.4);
  const sq = { fill: "none", stroke: ink, opacity: 0.7, "stroke-linecap": "round" as const, ...lw(0.85) };
  const shade = TIPS.map(([x, y, v]) => `M${x} ${y} L${v} ${v > x + 1 ? VALLEY : 20} L${v} 21 L${x} 21 Z`);
  const band = "M34.3 18.5 L65.7 18.5 L65 25 Q50 27.2 35 25 Z";
  return (
    <g>
      <Region
        p={p}
        name="points"
        d={[POINTS]}
        line={2.2}
        over={
          <g>
            <rect x="30" y="5" width="40" height="16" fill="#fff" opacity="0.16" />
            {shade.map((d) => (
              <path key={d} d={d} fill="#000" opacity="0.22" />
            ))}
            {TIPS.map(([x, y]) => (
              <path key={x} d={`M${x} ${y} V18.5`} stroke="#1d1d1f" opacity="0.3" {...lw(0.8)} />
            ))}
          </g>
        }
      />
      <Region
        p={p}
        name="band"
        d={[band]}
        line={2.4}
        over={
          <g>
            <rect x="33" y="18" width="34" height="2.6" fill="#fff" opacity="0.25" />
            <path d="M34 20.8 H66" stroke="#1d1d1f" opacity="0.3" {...lw(0.8)} />
            <path d="M50 20.8 V27" stroke="#1d1d1f" opacity="0.18" {...lw(0.8)} />
            <rect x="50" y="20.8" width="17" height="7" fill="#000" opacity="0.13" />
            <path d="M37 23.2 q0.9 -0.8 1.8 0 t1.8 0 t1.8 0 t1.8 0" {...sq} />
            <path d="M54.5 23.2 q0.9 -0.8 1.8 0 t1.8 0 t1.8 0" {...sq} />
          </g>
        }
      />
      <path d="M50 21.4 L52 23.1 L50 24.8 L48 23.1 Z" fill={GOLD} stroke="#1d1d1f" {...lw(1)} />
      <g transform="translate(0 -2.4)">
        <Crane t={LIFT[f % LIFT.length]} />
      </g>
    </g>
  );
}

export const folioCrown2: ItemDraft = {
  id: "folio-crown-2",
  name: "Folio's Paper Crown",
  tier: "legendary",
  slot: "head",
  description: "Folded from a page of royal decrees. The crane on top has read them all and remains unimpressed.",
  frame: [30, -8, 42, 36],
  attach: 25,
  motion: { ms: MS },
  Art,
};
