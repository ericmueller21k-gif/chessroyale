import { Region, LINE, lw, darken, lighten, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

// wing lift per frame: 0 folded down, 1 lifted
const LIFT = [0, 0.3, 0.68, 0.92, 1, 1, 0.8, 0.5, 0.2, 0];
const MS = [1000, 160, 160, 160, 260, 520, 200, 200, 200, 300];

const CREAM = "#f6ecd4";
const CREAM2 = "#dcc79a";
const CREAM3 = "#cbb68a";
const GOLD = "#f2c14e";
const INK = "#8797c4";

// five folded points: [left base x, tip x, tip y, right base x]
const PTS: [number, number, number, number][] = [
  [31, 32, 5.5, 40],
  [37, 41, 10, 46],
  [43, 50, 9, 57],
  [54, 59, 10, 63],
  [60, 68, 5.5, 69],
];
const BASE = 20;

const pt = (a: number, b: number) => `${a.toFixed(2)} ${b.toFixed(2)}`;

function Crane({ t }: { t: number }) {
  // shoulder the wings fold round
  const sx = 50, sy = 4.5;
  const ease = t * t * (3 - 2 * t);
  const fa = ((-22 + (-80 + 22) * ease) * Math.PI) / 180; // front wing: right, lying -> up
  const ba = ((-150 + (-102 + 150) * ease) * Math.PI) / 180; // back wing: left, lying -> up
  const fL = 12.5, bL = 10.5;
  const ft = [sx + 1.5 + fL * Math.cos(fa), sy + fL * Math.sin(fa)];
  const bt = [sx - 1 + bL * Math.cos(ba), sy + bL * Math.sin(ba)];
  const backWing = `M${pt(sx - 3.5, sy + 1)} L${pt(bt[0], bt[1])} L${pt(sx + 2, sy)} Z`;
  const frontWing = `M${pt(sx - 2.5, sy + 1.5)} L${pt(ft[0], ft[1])} L${pt(sx + 5, sy + 1)} Z`;
  // crease down the middle of the front wing
  const fm = [(sx + 1.2), sy + 1.2];
  return (
    <g>
      {/* back wing */}
      <path d={backWing} fill={CREAM2} {...LINE} {...lw(1.6)} />
      {/* tail */}
      <path d="M53 6 L63 -3.5 L60.5 8 Z" fill={CREAM2} {...LINE} {...lw(1.6)} />
      {/* neck and head */}
      <path d="M47 6.5 L39 -2 L40.5 7.5 Z" fill={CREAM} {...LINE} {...lw(1.6)} />
      <path d="M39 -2 L35 -0.2 L40.2 0.6 Z" fill={CREAM} {...LINE} {...lw(1.4)} />
      {/* body */}
      <path d="M40 7.5 L50 3 L61 7.5 L50 11.5 Z" fill={CREAM} {...LINE} {...lw(1.6)} />
      <path d="M40 7.5 L50 11.5 L61 7.5 L50 8.3 Z" fill={CREAM3} opacity="0.55" />
      <path d="M40.5 7.5 L61 7.5" stroke="#1d1d1f" opacity="0.35" {...lw(0.8)} />
      {/* front wing: two faces, gold on the leading edge */}
      <path d={frontWing} fill={CREAM} {...LINE} {...lw(1.6)} />
      <path d={`M${pt(fm[0], fm[1])} L${pt(ft[0], ft[1])} L${pt(sx + 5, sy + 1)} Z`} fill={CREAM2} />
      <path d={`M${pt(sx - 2, sy + 1)} L${pt(ft[0] - 0.4, ft[1] + 0.3)}`} stroke={GOLD} stroke-linecap="round" {...lw(1)} />
      <path d={frontWing} fill="none" {...LINE} {...lw(1.6)} />
      <path d={`M${pt(fm[0], fm[1])} L${pt(ft[0], ft[1])}`} stroke="#1d1d1f" opacity="0.4" {...lw(0.7)} />
      {/* a whisper of ink on the body */}
      <path d="M45 8.6 q1.2 -0.9 2.4 0 t2.4 0 t2.4 0" fill="none" stroke={INK} stroke-linecap="round" {...lw(0.8)} />
      <circle cx="39.6" cy="-0.6" r="0.55" fill="#1d1d1f" />
    </g>
  );
}

function Art({ p, f }: ArtProps) {
  const light = PTS.map(([l, x, y]) => `M${l} ${BASE} L${x} ${y} L${(l + PTS[PTS.indexOf(PTS.find((q) => q[0] === l)!)][3]) / 2} ${BASE} Z`);
  const shade = PTS.map(([l, x, y, r]) => `M${(l + r) / 2} ${BASE} L${x} ${y} L${r} ${BASE} Z`);
  const points = PTS.map(([l, x, y, r]) => `M${l} ${BASE + 0.5} L${x} ${y} L${r} ${BASE + 0.5} Z`);
  const ink = darken(p.hex, 0.4);
  const band = "M31 19.5 L69 19.5 L68 26.5 L32 26.5 Z";
  return (
    <g>
      {/* back points, peeking between the front ones */}
      <Region
        p={p}
        name="backpoints"
        d={["M36 20 L37.5 12.5 L41 20 Z", "M59 20 L62.5 12.5 L64 20 Z"]}
        over={<rect x="30" y="10" width="40" height="12" fill="#000" opacity="0.28" />}
        line={1.6}
      />
      {/* the folded points: light face left, shade face right */}
      <Region
        p={p}
        name="points"
        d={points}
        over={
          <g>
            {shade.map((d) => (
              <path key={d} d={d} fill="#000" opacity="0.16" />
            ))}
            {light.map((d) => (
              <path key={d} d={d} fill="#fff" opacity="0.12" />
            ))}
            {PTS.map(([l, x, y, r]) => (
              <path key={x} d={`M${x} ${y} L${(l + r) / 2} ${BASE}`} stroke="#1d1d1f" opacity="0.35" {...lw(0.8)} />
            ))}
            <path d="M44.5 17.5 q1 -0.8 2 0 t2 0" fill="none" stroke={ink} opacity="0.55" stroke-linecap="round" {...lw(0.8)} />
            <path d="M34 17.5 q0.9 -0.7 1.8 0" fill="none" stroke={ink} opacity="0.55" stroke-linecap="round" {...lw(0.8)} />
            <path d="M61 17.5 q0.9 -0.7 1.8 0 t1.8 0" fill="none" stroke={ink} opacity="0.55" stroke-linecap="round" {...lw(0.8)} />
          </g>
        }
        line={2}
      />
      {/* the band: folded over, a crease along its top */}
      <Region
        p={p}
        name="band"
        d={[band]}
        over={
          <g>
            <rect x="30" y="23.5" width="40" height="4" fill="#000" opacity="0.14" />
            <path d="M33 21.3 H67" stroke="#fff" opacity="0.45" {...lw(1)} />
            <path d="M31.5 23.3 H68.5" stroke="#1d1d1f" opacity="0.3" {...lw(0.8)} />
            <path d="M35 25 q1.1 -0.9 2.2 0 t2.2 0 t2.2 0 t2.2 0" fill="none" stroke={ink} opacity="0.55" stroke-linecap="round" {...lw(0.8)} />
            <path d="M52 25 q1.1 -0.9 2.2 0 t2.2 0 t2.2 0" fill="none" stroke={ink} opacity="0.55" stroke-linecap="round" {...lw(0.8)} />
            <path d="M62 25 q1.1 -0.9 2.2 0 t2.2 0" fill="none" stroke={ink} opacity="0.55" stroke-linecap="round" {...lw(0.8)} />
          </g>
        }
        line={2.4}
      />
      <path d="M50 21.5 L52 23 L50 24.5 L48 23 Z" fill={lighten("#f2c14e", 0.1)} stroke="#1d1d1f" {...lw(1)} />
      <g transform="translate(50 14) scale(1.15) translate(-50 -11.5)">
        <Crane t={LIFT[f % LIFT.length]} />
      </g>
    </g>
  );
}

export const folioCrown: ItemDraft = {
  id: "folio-crown",
  name: "Folio's Paper Crown",
  tier: "legendary",
  slot: "head",
  description: "Folded from a page of royal decrees. The crane on top has read them all and remains unimpressed.",
  frame: [30, -9, 40, 36.5],
  attach: 25,
  motion: { ms: MS },
  Art,
};
