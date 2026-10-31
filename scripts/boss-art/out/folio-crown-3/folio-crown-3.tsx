import { Region, LINE, lw, darken, lighten, isLight, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

// wing lift per frame: 0 folded down along the body, 1 lifted into a V
const LIFT = [0, 0, 0.15, 0.45, 0.8, 1, 1, 0.72, 0.38, 0.12];
const MS = [800, 500, 170, 170, 170, 400, 700, 190, 190, 190];

const CREAM = "#fbf3df";
const TAN = "#dcc28c";
const TAN2 = "#cdb27a";
const GOLD = "#f2c14e";

const n = (v: number) => v.toFixed(2);
const P = (x: number, y: number) => `${n(x)} ${n(y)}`;

// the folded points' tips [x, y] and the valley to their right (lowered to make room for the crane)
const TIPS: [number, number, number][] = [
  [33.3, 12.5, 38.5],
  [42, 14, 46],
  [50, 14.5, 54],
  [58, 14, 61.5],
  [66.7, 12.5, 66.2],
];
const VALLEY = 17.5;
const POINTS = "M34.2 20.5 L33.3 12.5 L38.5 17.5 L42 14 L46 17.5 L50 14.5 L54 17.5 L58 14 L61.5 17.5 L66.7 12.5 L65.8 20.5 Z";

function Crane({ t }: { t: number }) {
  const e = t * t * (3 - 2 * t);
  const L = (a: [number, number], b: [number, number]): [number, number] => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
  const O = { ...LINE, ...lw(2.2) };
  // wing tips: folded down along the body -> lifted into a V
  const ft = L([77, 17.5], [69, 0.8]);
  const bt = L([73, 11], [41, 0.8]);
  const fa: [number, number] = [38.5, 14.5];
  const fb: [number, number] = [61, 14.5];
  const ba: [number, number] = [44.5, 13];
  const bb: [number, number] = [56, 13];
  const fm: [number, number] = [(fa[0] + fb[0]) / 2 + 0.5, (fa[1] + fb[1]) / 2 + 0.6];
  const bm: [number, number] = [(ba[0] + bb[0]) / 2, (ba[1] + bb[1]) / 2];
  const front = `M${P(...fa)} L${P(...ft)} L${P(...fb)} Z`;
  const back = `M${P(...ba)} L${P(...bt)} L${P(...bb)} Z`;
  return (
    <g>
      {/* back wing: tan, a light face toward us */}
      <path d={back} fill={TAN} />
      <path d={`M${P(...ba)} L${P(...bt)} L${P(...bm)} Z`} fill={CREAM} opacity="0.55" />
      <path d={back} fill="none" {...O} />
      {/* tail point, up to the right */}
      <path d="M62 14.5 L80.5 6 L81.5 9 L68 16 Z" fill={CREAM} />
      <path d="M68 16 L81.5 9 L81 7.6 L65 15.3 Z" fill={TAN} />
      <path d="M62 14.5 L80.5 6 L81.5 9 L68 16 Z" fill="none" {...O} />
      {/* body: a pointed folded boat, shade on its lower face */}
      <path d="M29 15 L50 10.8 L71 15 L50.5 21.5 Z" fill={CREAM} />
      <path d="M29 15 L71 15 L50.5 21.5 Z" fill={TAN} />
      <path d="M29 15 L50 10.8 L71 15 L50.5 21.5 Z" fill="none" {...O} />
      {/* neck rising up to the left */}
      <path d="M32 16 L24.5 5 L28.5 3.8 L38 14.8 Z" fill={CREAM} />
      <path d="M32 16 L24.5 5 L26.3 4.5 L34.5 15.5 Z" fill={TAN} />
      <path d="M32 16 L24.5 5 L28.5 3.8 L38 14.8 Z" fill="none" {...O} />
      {/* head with its beak, bent forward to the left */}
      <path d="M23 7 L30.5 4.2 L28.6 1.2 L23.4 1.6 L12.5 6.4 Z" fill={CREAM} stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.8)} />
      <path d="M23 7 L23.4 1.6 L12.5 6.4 Z" fill={TAN} opacity="0.8" />
      <path d="M23 7 L30.5 4.2 L28.6 1.2 L23.4 1.6 L12.5 6.4 Z" fill="none" stroke="#1d1d1f" stroke-linejoin="round" {...lw(1.8)} />
      <circle cx="26.4" cy="3.4" r="0.95" fill="#1d1d1f" />
      {/* front wing: light face, tan face behind its crease, gold leading edge */}
      <path d={front} fill={CREAM} />
      <path d={`M${P(...fm)} L${P(...ft)} L${P(...fb)} Z`} fill={TAN2} />
      <path
        d={`M${P(fa[0] + (ft[0] - fa[0]) * 0.15, fa[1] + (ft[1] - fa[1]) * 0.15)} L${P(fa[0] + (ft[0] - fa[0]) * 0.8, fa[1] + (ft[1] - fa[1]) * 0.8)}`}
        stroke={GOLD}
        stroke-linecap="round"
        {...lw(1.3)}
      />
      <path d={front} fill="none" {...O} />
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
      <Crane t={LIFT[f % LIFT.length]} />
    </g>
  );
}

export const folioCrown3: ItemDraft = {
  id: "folio-crown-3",
  name: "Folio's Paper Crown",
  tier: "legendary",
  slot: "head",
  description: "Folded from a page of royal decrees. The crane on top has read them all and remains unimpressed.",
  frame: [11, 0, 72, 29],
  attach: 25,
  motion: { ms: MS },
  Art,
};
