/**
 * Pen Pony (id ride-pen-pony, mythic): the ride in Wrangler's Boss Crate. One of the chess knights from the pens in his barn
 * (out/house-shop-pig), saddled: a big knight piece (its carved horse's head and neck rising at the front of its round
 * base), a leather saddle on its base behind the neck with a gold star on the skirt, a saddle blanket in the item's
 * color, rope reins from its mouth to the horn, a stirrup, and a tuft of straw tied on behind for a tail. The pawn sits
 * in the saddle. It moves in little hopping skips, as the pen knights do. White knight under a white pawn, black under a
 * black one (your own knight). Drawn by hand (Nov 4), in the format of the other rides (rides-tokens-nov1.md): a side
 * view (facing our right), front and back views, and a trail mark.
 */
import type { ComponentChildren } from "preact";
import type { Paint, RiderDraft, RiderPose, RiderProps, RiderViewDraft, TrailProps } from "../../item-kit.tsx";
import { LINE, lw, Region, darken, lighten } from "../../item-kit.tsx";

const n = (v: number) => v.toFixed(1);

/** The knight's wood: white (cream, its shade, its deep shade, a highlight) or black (charcoal, darker, darkest, a lit edge). */
const WOOD = {
  w: { body: "#f3ede0", shade: "#d6ccb6", deep: "#ab9d84", hi: "#ffffff", eye: "#1d1d1f", mane: "#c4b79c" },
  b: { body: "#3a3942", shade: "#2a2930", deep: "#1c1b21", hi: "#6b6a77", eye: "#ffd451", mane: "#25242b" },
} as const;
const LEATHER = "#6c3d1c";
const LEATHER_D = "#4a2611";
const LEATHER_L = "#8f5629";
const GOLD = "#e6ac2a";
const GOLD_L = "#ffd451";
const ROPE = "#c58f4b";
const ROPE_D = "#8c5a26";
const STRAW = "#e3c35a";
const STRAW_D = "#a8801f";
const IRON = "#62666f";

// ---- The motion: hops (the whole group's dy), the head's nod, a squash on landing.

/** The move: two hopping skips a square: crouch, spring, up, land; dy is the group's, nod the head's dip, lean the tilt. */
const HOP = [
  { dy: 1.5, nod: 2, lean: 0 },
  { dy: -6, nod: -1, lean: -5 },
  { dy: -9, nod: -2, lean: -3 },
  { dy: -3, nod: 0, lean: 3 },
];
function moveAt(f: number) {
  return HOP[f % 4]!;
}
/** The idle: it breathes, nods, flicks an ear, blinks, and once a loop does a little skip in place. */
const IDLE = [
  { dy: 0, nod: 0, ear: 0, blink: false },
  { dy: 0, nod: 0.5, ear: 0, blink: false },
  { dy: 0, nod: 1, ear: 1, blink: false },
  { dy: 0, nod: 0.5, ear: 1, blink: false },
  { dy: 1.2, nod: 1.5, ear: 0, blink: false },
  { dy: -5, nod: -1, ear: 0, blink: false },
  { dy: 0, nod: 0, ear: 0, blink: true },
  { dy: 0, nod: 0, ear: 0, blink: false },
];

// ---- Side view (facing our right).

/** The base: a round, two-tier plinth (a chess piece's), its top faces seen a little from above. */
function Base({ c }: { c: (typeof WOOD)["w"] | (typeof WOOD)["b"] }) {
  return (
    <g>
      <path d="M 8 87 A 44 6.5 0 0 0 96 87 L 96 92 A 44 6.5 0 0 1 8 92 Z" fill={c.shade} {...LINE} />
      <ellipse cx="52" cy="87" rx="44" ry="6.5" fill={c.body} {...LINE} />
      <path d="M 14 89 A 38 4 0 0 0 52 93.3" fill="none" stroke={c.hi} stroke-linecap="round" {...lw(1.6)} opacity="0.7" />
      <path d="M 19 76 A 33 5 0 0 0 85 76 L 85 84 A 33 5 0 0 1 19 84 Z" fill={c.shade} {...LINE} />
      <path d="M 66 82 A 33 5 0 0 0 85 76 L 85 84 A 33 5 0 0 1 72 88.6 Z" fill={c.deep} />
      <ellipse cx="52" cy="76" rx="33" ry="5" fill={c.body} {...LINE} />
    </g>
  );
}
/** The straw tail tied on behind with twine. */
function Tail({ sway }: { sway: number }) {
  const s = sway;
  return (
    <g>
      <path d={`M 19 74 Q ${n(10 + s)} 76 ${n(5 + s * 1.6)} 86 L ${n(9 + s * 1.4)} 87 Q ${n(13 + s)} 80 20 78 Z`} fill={STRAW} {...LINE} {...lw(2)} />
      <path d={`M 18 75.5 Q ${n(12 + s)} 78 ${n(8 + s * 1.5)} 85`} fill="none" stroke={STRAW_D} {...lw(1)} />
      <path d="M 17.5 73.5 L 19.5 78.5" stroke={ROPE_D} {...lw(2)} />
    </g>
  );
}
/** The head and neck (nose to our right), dipped `nod` (degrees about the neck's foot), an ear flicked, an eye. */
function Head({ c, nod, ear, blink }: { c: (typeof WOOD)["w"] | (typeof WOOD)["b"]; nod: number; ear: number; blink: boolean }) {
  const neck = "M 60 77 C 56 58 59 35 73 21 L 75 7 Q 77.5 3.5 80 7 L 84 15 C 94 16 106 23 112 31 Q 115.5 36.5 111 41 L 103 44 C 97 46 93 50 92 56 C 91 64 93 71 95 77 Z";
  const mane = "M 60 77 C 56 58 59 35 73 21 L 79 23 L 75 30 L 71 34 L 69 41 L 66 46 L 66 54 L 64 60 L 65 68 L 66 77 Z";
  const ear2 = `M 81 14 L ${n(85 + ear * 2)} ${n(3 - ear)} Q ${n(87 + ear * 2)} ${n(2 - ear)} ${n(88 + ear)} 6 L 87 16 Z`;
  return (
    <g transform={`rotate(${n(nod * 2)} 78 76)`}>
      <path d={ear2} fill={c.shade} {...LINE} />
      <path d={neck} fill={c.body} {...LINE} />
      {/* the carved planes: the jaw's curve, the shade down the throat, the light down the face */}
      <path d="M 92 56 C 91 50 95 46 103 44 L 104 40 C 96 40 90 44 86 50 C 84 58 86 68 89 77 L 95 77 C 93 71 91 64 92 56 Z" fill={c.shade} />
      <path d="M 86 21 C 95 22 104 27 109 33" fill="none" stroke={c.hi} stroke-linecap="round" {...lw(1.8)} opacity="0.8" />
      <path d="M 84 30 Q 92 38 99 42" fill="none" stroke={c.deep} stroke-linecap="round" {...lw(1.4)} />
      <path d={mane} fill={c.mane} {...LINE} {...lw(2)} />
      <path d="M 75 9 L 77.5 13" stroke={c.deep} {...lw(1.4)} />
      {/* the eye, the nostril, the mouth */}
      {blink ? (
        <path d="M 87 25 Q 90.5 27.5 94 25" fill="none" stroke={c.eye} stroke-linecap="round" {...lw(1.8)} />
      ) : (
        <g>
          <ellipse cx="90.5" cy="25" rx="3" ry="2.6" fill={c.eye} />
          <circle cx="89.6" cy="24" r="0.9" fill="#fff" />
        </g>
      )}
      <ellipse cx="108.5" cy="35.5" rx="1.6" ry="1.2" fill={c.deep} />
      <path d="M 104 41.5 L 110.5 40" stroke={c.deep} stroke-linecap="round" {...lw(1.3)} />
      {/* the bridle: a rope round its nose and up behind its cheek */}
      <path d="M 101 30 C 103 36 104 40 104 43 M 101 30 C 95 27 88 26 82 22" fill="none" stroke={ROPE_D} stroke-linecap="round" {...lw(3)} />
      <path d="M 101 30 C 103 36 104 40 104 43 M 101 30 C 95 27 88 26 82 22" fill="none" stroke={ROPE} stroke-linecap="round" {...lw(1.6)} />
    </g>
  );
}
/** The saddle blanket in the item's color: hung over the base, a fringe of points, a light band and a shine. */
function Blanket({ p, y0 = 0, x0 = 0, w = 1 }: { p: Paint; y0?: number; x0?: number; w?: number }) {
  const X = (v: number) => n(x0 + (v - 46) * w + 46);
  const Y = (v: number) => n(v + y0);
  const d = `M ${X(25)} ${Y(64)} L ${X(67)} ${Y(64)} L ${X(69)} ${Y(83)} L ${X(64)} ${Y(87)} L ${X(59)} ${Y(83)} L ${X(54)} ${Y(87)} L ${X(49)} ${Y(83)} L ${X(44)} ${Y(87)} L ${X(39)} ${Y(83)} L ${X(34)} ${Y(87)} L ${X(29)} ${Y(83)} L ${X(23)} ${Y(86)} Z`;
  return (
    <Region
      p={p}
      name="blanket"
      d={[d]}
      over={
        <g>
          <path d={`M ${X(20)} ${Y(76)} L ${X(72)} ${Y(76)} L ${X(72)} ${Y(79.5)} L ${X(20)} ${Y(79.5)} Z`} fill={lighten(p.hex, 0.5)} />
          <path d={`M ${X(26)} ${Y(66)} L ${X(66)} ${Y(66)}`} stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.6)} />
          {[30, 38, 46, 54, 62].map((x) => (
            <circle key={x} cx={X(x)} cy={Y(77.8)} r="1.1" fill={darken(p.hex, 0.45)} />
          ))}
        </g>
      }
    />
  );
}
/** A small gold star (radius r) at (x, y). */
function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${n(x + rr * Math.cos(a))} ${n(y + rr * Math.sin(a))}`;
  });
  return <path d={`M ${pts.join(" L ")} Z`} fill={GOLD_L} stroke={darken(GOLD, 0.35)} {...lw(1)} stroke-linejoin="round" />;
}
/** The saddle: its seat (flat under the pawn), the horn at the front, the skirt with a gold star, a stirrup. */
function Saddle({ front }: { front: boolean }) {
  if (!front)
    return (
      // The cantle, behind the pawn.
      <path d="M 24 50 Q 27 47 31 50 L 34 62 L 26 62 Z" fill={LEATHER} {...LINE} />
    );
  return (
    <g>
      <path d="M 26 58.5 L 66 58.5 L 67 66 Q 46 70 25 66 Z" fill={LEATHER} {...LINE} />
      <path d="M 28 60.5 L 64 60.5" stroke={LEATHER_L} stroke-linecap="round" {...lw(1.6)} />
      <path d="M 35 64 L 57 64 L 57 77 Q 46 80 35 77 Z" fill={LEATHER_L} {...LINE} />
      <path d="M 37 75.5 Q 46 78 55 75.5" fill="none" stroke={LEATHER_D} {...lw(1.2)} />
      <Star x={46} y={70} r={4.2} />
      <path d="M 61 60 L 61 50 Q 64.5 46.5 68 50 L 65.5 60 Z" fill={LEATHER} {...LINE} />
      <ellipse cx="64.5" cy="49.3" rx="3.4" ry="1.6" fill={LEATHER_L} {...LINE} {...lw(1.6)} />
      <path d="M 44 78 L 44 88" stroke={LEATHER_D} {...lw(2.4)} />
      <path d="M 40.5 88 L 47.5 88 L 46.5 93 L 41.5 93 Z" fill="none" stroke={IRON} stroke-linejoin="round" {...lw(2.2)} />
    </g>
  );
}
/** The rope reins from its mouth to the horn, sagging. */
function Reins({ nod }: { nod: number }) {
  const a = 78 + (104 - 78) * Math.cos((nod * 2 * Math.PI) / 180) - (43 - 76) * Math.sin((nod * 2 * Math.PI) / 180);
  const b = 76 + (104 - 78) * Math.sin((nod * 2 * Math.PI) / 180) + (43 - 76) * Math.cos((nod * 2 * Math.PI) / 180);
  const d = `M ${n(a)} ${n(b)} Q 84 62 66 51`;
  return (
    <g>
      <path d={d} fill="none" stroke={ROPE_D} stroke-linecap="round" {...lw(3.2)} />
      <path d={d} fill="none" stroke={ROPE} stroke-linecap="round" {...lw(1.6)} />
    </g>
  );
}

function sideState(anim: "idle" | "move", f: number) {
  if (anim === "move") {
    const h = moveAt(f);
    return { nod: h.nod, ear: f % 4 === 2 ? 1 : 0, blink: false, sway: h.dy < -4 ? 3 : -1, lean: h.lean };
  }
  const s = IDLE[f % 8]!;
  return { nod: s.nod, ear: s.ear, blink: s.blink, sway: s.dy < 0 ? 2 : s.nod > 1 ? -1 : 0, lean: 0 };
}

function SideBack({ side, anim, f }: RiderProps) {
  const c = WOOD[side];
  const s = sideState(anim, f);
  return (
    <g transform={`rotate(${n(s.lean)} 52 92)`}>
      <Tail sway={s.sway} />
      <Base c={c} />
      <Saddle front={false} />
    </g>
  );
}
function SideFront({ p, side, anim, f }: RiderProps) {
  const c = WOOD[side];
  const s = sideState(anim, f);
  return (
    <g transform={`rotate(${n(s.lean)} 52 92)`}>
      <Blanket p={p} />
      <Saddle front />
      <Head c={c} nod={s.nod} ear={s.ear} blink={s.blink} />
      <Reins nod={s.nod} />
      {anim === "move" && f % 4 === 0 && <Puff x={24} y={95} />}
      {anim === "move" && f % 4 === 0 && <Puff x={84} y={95} flip />}
    </g>
  );
}
/** A little kick of dust as it lands (it goes with the ride: drawn on the landing frame only). */
function Puff({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g opacity="0.85">
      <circle cx={x - 6 * s} cy={y - 1} r="3.2" fill="#e8d3a6" stroke="#a88a5a" {...lw(1)} />
      <circle cx={x - 10 * s} cy={y - 3} r="2.2" fill="#e8d3a6" stroke="#a88a5a" {...lw(1)} />
      <circle cx={x - 3 * s} cy={y - 4} r="1.6" fill="#f3e3bf" />
    </g>
  );
}

function sidePose(anim: "idle" | "move", f: number): RiderPose {
  if (anim === "move") {
    const h = moveAt(f);
    return { dx: 12.5 * f, dy: h.dy, pawnX: -6, pawnY: -6 + (h.dy > 0 ? 0.5 : 0), pawnTilt: h.lean * 0.6, cut: 66 };
  }
  const s = IDLE[f % 8]!;
  return { dx: 0, dy: s.dy, pawnX: -6, pawnY: -6 + (s.nod > 1 ? 0.5 : 0), cut: 66 };
}

// ---- Front view (coming down the screen): its face toward us, the base, the blanket either side, two stirrups.

function FrontHead({ c, nod, ear, blink }: { c: (typeof WOOD)["w"] | (typeof WOOD)["b"]; nod: number; ear: number; blink: boolean }) {
  const y = (v: number) => n(v + nod);
  return (
    <g>
      {/* the neck, under the face */}
      <path d={`M 38 77 C 37 66 40 58 42 ${y(52)} L 58 ${y(52)} C 60 58 63 66 62 77 Z`} fill={c.shade} {...LINE} />
      {/* the ears, one flicking */}
      <path d={`M 39 ${y(43)} L ${n(34 - ear)} ${y(31 - ear)} Q ${n(36 - ear)} ${y(29 - ear)} 42 ${y(38)} Z`} fill={c.body} {...LINE} />
      <path d={`M 61 ${y(43)} L 66 ${y(31)} Q 64 ${y(29)} 58 ${y(38)} Z`} fill={c.body} {...LINE} />
      {/* the long face, the forelock between the ears, the muzzle */}
      <path d={`M 39 ${y(40)} Q 50 ${y(34)} 61 ${y(40)} L 59 ${y(60)} Q 60 ${y(72)} 50 ${y(73)} Q 40 ${y(72)} 41 ${y(60)} Z`} fill={c.body} {...LINE} />
      <path d={`M 44 ${y(38)} L 50 ${y(46)} L 56 ${y(38)} Q 50 ${y(35)} 44 ${y(38)} Z`} fill={c.mane} {...LINE} {...lw(1.8)} />
      <path d={`M 41.5 ${y(48)} Q 43 ${y(60)} 44 ${y(68)}`} fill="none" stroke={c.hi} stroke-linecap="round" {...lw(1.6)} opacity="0.8" />
      <path d={`M 57 ${y(50)} Q 57 ${y(62)} 55 ${y(70)}`} fill="none" stroke={c.shade} stroke-linecap="round" {...lw(2.2)} />
      {blink ? (
        <g>
          <path d={`M 39 ${y(47)} q 3 2 5 0 M 56 ${y(47)} q 2.5 2 5 0`} fill="none" stroke={c.eye} stroke-linecap="round" {...lw(1.6)} />
        </g>
      ) : (
        <g>
          <ellipse cx="41.5" cy={y(47)} rx="2.2" ry="2.6" fill={c.eye} />
          <ellipse cx="58.5" cy={y(47)} rx="2.2" ry="2.6" fill={c.eye} />
        </g>
      )}
      <ellipse cx="46" cy={y(68)} rx="1.5" ry="1.9" fill={c.deep} />
      <ellipse cx="54" cy={y(68)} rx="1.5" ry="1.9" fill={c.deep} />
      {/* the rope noseband */}
      <path d={`M 41 ${y(60)} Q 50 ${y(63)} 59 ${y(60)}`} fill="none" stroke={ROPE_D} stroke-linecap="round" {...lw(3)} />
      <path d={`M 41 ${y(60)} Q 50 ${y(63)} 59 ${y(60)}`} fill="none" stroke={ROPE} stroke-linecap="round" {...lw(1.5)} />
    </g>
  );
}
function FrontBase({ c }: { c: (typeof WOOD)["w"] | (typeof WOOD)["b"] }) {
  return (
    <g>
      <path d="M 10 86 A 40 8 0 0 0 90 86 L 90 92 A 40 8 0 0 1 10 92 Z" fill={c.shade} {...LINE} />
      <ellipse cx="50" cy="86" rx="40" ry="8" fill={c.body} {...LINE} />
      <path d="M 19 75 A 31 6 0 0 0 81 75 L 81 83 A 31 6 0 0 1 19 83 Z" fill={c.shade} {...LINE} />
      <ellipse cx="50" cy="75" rx="31" ry="6" fill={c.body} {...LINE} />
    </g>
  );
}
/** The blanket's two sides hanging either side of the base (front and back views). */
function SideFlaps({ p }: { p: Paint }) {
  const l = "M 21 64 L 33 64 L 33 84 L 27 87 L 21 84 Z";
  const r = "M 67 64 L 79 64 L 79 84 L 73 87 L 67 84 Z";
  return (
    <Region
      p={p}
      name="flaps"
      d={[l, r]}
      over={
        <g>
          <path d="M 19 76 L 81 76 L 81 79.5 L 19 79.5 Z" fill={lighten(p.hex, 0.5)} />
          <circle cx="27" cy="77.8" r="1.1" fill={darken(p.hex, 0.45)} />
          <circle cx="73" cy="77.8" r="1.1" fill={darken(p.hex, 0.45)} />
        </g>
      }
    />
  );
}
function Stirrups() {
  return (
    <g>
      {[22, 78].map((x) => (
        <g key={x}>
          <path d={`M ${x} 72 L ${x} 86`} stroke={LEATHER_D} {...lw(2.4)} />
          <path d={`M ${x - 3.5} 86 L ${x + 3.5} 86 L ${x + 2.5} 91 L ${x - 2.5} 91 Z`} fill="none" stroke={IRON} stroke-linejoin="round" {...lw(2.2)} />
        </g>
      ))}
    </g>
  );
}
const frontView: RiderViewDraft = {
  frame: [8, 4, 84, 94],
  idle: { ms: [240, 200, 200, 200, 120, 120, 200, 240] },
  move: { ms: [85, 85, 85, 85, 85, 85, 85, 85] },
  pose: (anim, f) => {
    if (anim === "move") {
      const h = moveAt(f);
      return { dx: 0, dy: h.dy, pawnX: 0, pawnY: -6, cut: 66 };
    }
    const s = IDLE[f % 8]!;
    return { dx: 0, dy: s.dy, pawnX: 0, pawnY: -6 + (s.nod > 1 ? 0.5 : 0), cut: 66 };
  },
  Back({ side }: RiderProps) {
    const c = WOOD[side];
    return (
      <g>
        <FrontBase c={c} />
        <path d="M 22 58 Q 50 54 78 58 L 78 66 Q 50 62 22 66 Z" fill={LEATHER} {...LINE} />
      </g>
    );
  },
  Front({ p, side, anim, f }: RiderProps) {
    const c = WOOD[side];
    const s = sideState(anim, f);
    return (
      <g>
        <SideFlaps p={p} />
        <Stirrups />
        <path d="M 30 60 Q 50 64 70 60 L 70 66 Q 50 70 30 66 Z" fill={LEATHER} {...LINE} />
        <FrontHead c={c} nod={s.nod} ear={s.ear} blink={s.blink} />
        {anim === "move" && f % 4 === 0 && (
          <g>
            <Puff x={20} y={94} />
            <Puff x={80} y={94} flip />
          </g>
        )}
      </g>
    );
  },
};

// ---- Back view (going up the screen): the back of its head and mane rising past the pawn, the cantle, the straw tail.

const backView: RiderViewDraft = {
  frame: [8, 4, 84, 94],
  idle: { ms: [240, 200, 200, 200, 120, 120, 200, 240] },
  move: { ms: [85, 85, 85, 85, 85, 85, 85, 85] },
  pose: (anim, f) => {
    if (anim === "move") {
      const h = moveAt(f);
      return { dx: 0, dy: h.dy, pawnX: 0, pawnY: -6, cut: 66 };
    }
    const s = IDLE[f % 8]!;
    return { dx: 0, dy: s.dy, pawnX: 0, pawnY: -6, cut: 66 };
  },
  Back({ side, anim, f }: RiderProps) {
    const c = WOOD[side];
    const s = sideState(anim, f);
    const y = (v: number) => n(v + s.nod * 0.6);
    return (
      <g>
        {/* the back of its head and neck, the ears either side of the pawn, the mane down its middle */}
        <path d={`M 30 ${y(30)} L ${n(25 - s.ear)} ${y(17 - s.ear)} Q ${n(28 - s.ear)} ${y(15 - s.ear)} 36 ${y(25)} Z`} fill={c.body} {...LINE} />
        <path d={`M 70 ${y(30)} L 75 ${y(17)} Q 72 ${y(15)} 64 ${y(25)} Z`} fill={c.body} {...LINE} />
        <path d={`M 30 77 C 28 60 28 ${y(40)} 34 ${y(27)} Q 50 ${y(20)} 66 ${y(27)} C 72 ${y(40)} 72 60 70 77 Z`} fill={c.shade} {...LINE} />
        <path d={`M 46 77 L 45 ${y(26)} Q 50 ${y(23)} 55 ${y(26)} L 54 77 Z`} fill={c.mane} {...LINE} {...lw(2)} />
        <FrontBase c={c} />
      </g>
    );
  },
  Front({ p, anim, f }: RiderProps) {
    const s = sideState(anim, f);
    return (
      <g>
        <SideFlaps p={p} />
        <Stirrups />
        {/* the cantle, round the pawn's back */}
        <path d="M 30 56 Q 50 51 70 56 L 70 66 Q 50 70 30 66 Z" fill={LEATHER} {...LINE} />
        <path d="M 33 58 Q 50 54 67 58" fill="none" stroke={LEATHER_L} stroke-linecap="round" {...lw(1.6)} />
        <Star x={50} y={62} r={3.6} />
        {/* the straw tail, tied on at the back of the base */}
        <path d={`M 47 78 Q ${n(46 + s.sway)} 86 ${n(44 + s.sway * 1.5)} 93 L ${n(56 + s.sway * 1.5)} 93 Q ${n(54 + s.sway)} 86 53 78 Z`} fill={STRAW} {...LINE} {...lw(2)} />
        <path d={`M 50 80 L ${n(50 + s.sway * 1.2)} 91`} stroke={STRAW_D} {...lw(1)} />
        <path d="M 46.5 79.5 L 53.5 79.5" stroke={ROPE_D} {...lw(2.4)} />
        {anim === "move" && f % 4 === 0 && (
          <g>
            <Puff x={20} y={94} />
            <Puff x={80} y={94} flip />
          </g>
        )}
      </g>
    );
  },
};

// ---- The trail: where it lands from each skip, the round print of its base in the dust, a few wisps of straw.

const DUST = "#e2cc9c";
const DUST_D = "#8c704a";
function BasePrint({ f, view, n: k }: TrailProps): ComponentChildren {
  const i = Math.min(f, 3);
  const op = [0.95, 0.8, 0.55, 0.28][i]!;
  const grow = [1, 1.05, 1.1, 1.14][i]!;
  const flip = k % 2 ? -1 : 1;
  const tf = view === "side" ? "scale(1 0.62)" : "scale(0.82 0.7)";
  const wisps: [number, number, number][] = [
    [8 * flip, -2, 25],
    [-6 * flip, 5, -40],
    [2 * flip, 9, 70],
  ];
  return (
    <g opacity={op} transform={tf}>
      <ellipse cx="0" cy="0" rx={n(15 * grow)} ry={n(13 * grow)} fill="none" stroke={DUST_D} stroke-width="5" />
      <ellipse cx="0" cy="0" rx={n(15 * grow)} ry={n(13 * grow)} fill="none" stroke={DUST} stroke-width="3" />
      <ellipse cx="0" cy="0" rx={n(9 * grow)} ry={n(7.5 * grow)} fill="none" stroke={DUST} stroke-width="1.6" opacity="0.7" />
      {i < 3 &&
        wisps.map(([x, y, a], j) => (
          <path key={j} d={`M ${n(x - 3)} ${n(y)} L ${n(x + 3)} ${n(y)}`} transform={`rotate(${a} ${x} ${y})`} stroke={j % 2 ? STRAW_D : STRAW} stroke-linecap="round" stroke-width="1.8" />
        ))}
    </g>
  );
}

export const penPony: RiderDraft = {
  id: "ride-pen-pony",
  name: "Pen Pony",
  tier: "mythic",
  description: "One of Wrangler's pen knights, saddled up. It won't go straight, but it hops like nobody's business.",
  frame: [2, 2, 116, 96],
  idle: { ms: [240, 200, 200, 200, 120, 120, 200, 240] },
  move: { ms: [85, 85, 85, 85, 85, 85, 85, 85] },
  pose: sidePose,
  Back: SideBack,
  Front: SideFront,
  views: { front: frontView, back: backView },
  trail: { ms: [140, 140, 160, 160], every: 1, w: 36, h: 26, Mark: BasePrint },
};
