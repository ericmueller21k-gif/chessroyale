import { Region, LINE, lw, darken, lighten, isLight, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

// wing lift per frame: 0 a shallow V at rest (never flat), 1 a tall V
const LIFT = [0, 0, 0, 0.2, 0.55, 0.85, 1, 1, 0.75, 0.4, 0.12];
const MS = [700, 600, 500, 180, 180, 180, 400, 500, 190, 190, 190];

const CREAM = "#fbf3df";
const TAN = "#dcc28c";
const TAN2 = "#cdb27a";
const GOLD = "#f2c14e";

const n = (v: number) => v.toFixed(2);
const P = (x: number, y: number) => `${n(x)} ${n(y)}`;
type Pt = [number, number];

// the folded points' tips [x, y] and the valley to their right
const TIPS: [number, number, number][] = [
  [33.3, 12.5, 38.5],
  [42, 14, 46],
  [50, 14.5, 54],
  [58, 14, 61.5],
  [66.7, 12.5, 66.2],
];
const VALLEY = 17.5;
const POINTS = "M34.2 20.5 L33.3 12.5 L38.5 17.5 L42 14 L46 17.5 L50 14.5 L54 17.5 L58 14 L61.5 17.5 L66.7 12.5 L65.8 20.5 Z";

function Wing({ a, b, tip, front }: { a: Pt; b: Pt; tip: Pt; front: boolean }) {
  const O = { ...LINE, ...lw(2.4) };
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.4];
  const all = `M${P(...a)} L${P(...tip)} L${P(...b)} Z`;
  const lead = front ? a : b;
  const g0: Pt = [lead[0] + (tip[0] - lead[0]) * 0.18, lead[1] + (tip[1] - lead[1]) * 0.18];
  const g1: Pt = [lead[0] + (tip[0] - lead[0]) * 0.78, lead[1] + (tip[1] - lead[1]) * 0.78];
  return (
    <g>
      <path d={all} fill={CREAM} />
      <path d={front ? `M${P(...m)} L${P(...tip)} L${P(...b)} Z` : `M${P(...a)} L${P(...tip)} L${P(...m)} Z`} fill={front ? TAN2 : TAN} />
      {front && <path d={`M${P(...g0)} L${P(...g1)}`} stroke={GOLD} stroke-linecap="round" {...lw(1.4)} />}
      <path d={all} fill="none" {...O} />
    </g>
  );
}

function Crane({ t }: { t: number }) {
  const e = t * t * (3 - 2 * t);
  const L = (a: Pt, b: Pt): Pt => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
  const O = { ...LINE, ...lw(2.4) };
  const body = "M33 14.5 L50 8.5 L67 14.5 L50 22.5 Z";
  return (
    <g>
      {/* back wing: up to the left */}
      <Wing a={[43, 11]} b={[57, 11]} tip={L([33, 1.5], [43, -6.8])} front={false} />
      {/* tail point: short and thick, up to the right */}
      <path d="M60 13.5 L66 16.5 L78 4 Z" fill={CREAM} />
      <path d="M63 15 L66 16.5 L78 4 Z" fill={TAN} />
      <path d="M60 13.5 L66 16.5 L78 4 Z" fill="none" {...O} />
      {/* neck: short and thick, up to the left */}
      <path d="M34 16.5 L40 13.5 L30.5 4.5 L26.5 6.5 Z" fill={CREAM} />
      <path d="M34 16.5 L37 15 L28.5 5.5 L26.5 6.5 Z" fill={TAN} />
      <path d="M34 16.5 L40 13.5 L30.5 4.5 L26.5 6.5 Z" fill="none" {...O} />
      {/* head and beak, pointing left */}
      <path d="M26.5 6.5 L30.5 4.5 L29.5 1.8 L25.5 2.4 L18.5 6 Z" fill={CREAM} />
      <path d="M26.5 6.5 L25.5 2.4 L18.5 6 Z" fill={TAN} />
      <path d="M26.5 6.5 L30.5 4.5 L29.5 1.8 L25.5 2.4 L18.5 6 Z" fill="none" {...LINE} {...lw(2)} />
      <circle cx="27.6" cy="3.7" r="0.9" fill="#1d1d1f" />
      {/* body: a deep folded diamond, shade on its lower face */}
      <path d={body} fill={CREAM} />
      <path d="M33 14.5 L67 14.5 L50 22.5 Z" fill={TAN} />
      <path d="M33 14.5 L67 14.5" stroke="#1d1d1f" opacity="0.35" {...lw(1)} />
      <path d={body} fill="none" {...O} />
      {/* front wing: up to the right */}
      <Wing a={[41, 13]} b={[58, 13]} tip={L([67, 1], [58, -6.8])} front={true} />
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
            <rect x="30" y="8" width="40" height="13" fill="#fff" opacity="0.16" />
            {shade.map((d) => (
              <path key={d} d={d} fill="#000" opacity="0.22" />
            ))}
          </g>
        }
      />
      <Crane t={LIFT[f % LIFT.length]} />
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
    </g>
  );
}

export const folioCrown4: ItemDraft = {
  id: "folio-crown-4",
  name: "Folio's Paper Crown",
  tier: "legendary",
  slot: "head",
  description: "Folded from a page of royal decrees. The crane on top has read them all and remains unimpressed.",
  frame: [11, -9, 72, 37],
  attach: 25,
  motion: { ms: MS },
  Art,
};
