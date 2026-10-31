import { Region, LINE, lw, darken, lighten, type RiderDraft, type RiderProps } from "../../item-kit.tsx";

const BROWN = "#8b5a36";
const BROWN_D = "#694128";
const BROWN_L = "#b27d50";
const CREAM = "#f3e0b9";
const IVORY = "#f6eedb";
const HOOF = "#3a2b25";
const TUFT = "#4a2c1a";
const GOLD = "#f2c14e";
const ROPE = "#c8954a";
const STEAM = "#f4f6f8";
const DUST = "#d9c3a0";

/** One frame's state: body bob, rotation (deg) round a pivot, head nod, tail swing, leg angles, puffs. */
interface St {
  bob: number;
  rot: number;
  cx: number;
  cy: number;
  head: number;
  tail: number;
  nf: number; // near front leg
  nh: number; // near hind leg
  ff: number; // far front leg
  fh: number; // far hind leg
  steam: number; // 0 none, 1-3 puffing
  dust: number; // 0 none, 1-2 paw dust
  land: number; // 0 none, 1 front landing dust, 2 full landing dust
}
const S = (o: Partial<St>): St => ({ bob: 0, rot: 0, cx: 50, cy: 70, head: 0, tail: 0, nf: 0, nh: 0, ff: 0, fh: 0, steam: 0, dust: 0, land: 0, ...o });

const IDLE: St[] = [
  S({}),
  S({ bob: 0.5, tail: 14 }),
  S({ bob: 0.9, head: -3, tail: 5, steam: 1 }),
  S({ bob: 0.6, head: 2, tail: -4, steam: 2 }),
  S({ bob: 0.2, head: 1, nf: -26, steam: 3 }),
  S({ bob: 0, nf: 16, dust: 1 }),
  S({ bob: 0.3, tail: -12, dust: 2 }),
  S({ bob: 0.2, tail: -4 }),
];
const MOVE_POS: { dx: number; dy: number }[] = [
  { dx: 0, dy: 0 },
  { dx: 6, dy: -1 },
  { dx: 22, dy: -12 },
  { dx: 42, dy: -17 },
  { dx: 61, dy: -12 },
  { dx: 78, dy: 0 },
  { dx: 92, dy: 0 },
  { dx: 100, dy: 0 },
];
const MOVE: St[] = [
  S({ bob: 1.2, nh: -12, fh: -10, nf: 6, ff: 4, tail: 6 }),
  S({ rot: -11, cx: 26, cy: 97, nf: -48, ff: -40, nh: 18, fh: 14, tail: 20, head: -4 }),
  S({ rot: -6, nf: -50, ff: -44, nh: 34, fh: 28, tail: 28, head: -3 }),
  S({ rot: 4, nf: -18, ff: -12, nh: 26, fh: 20, tail: 18 }),
  S({ rot: 12, nf: 6, ff: 2, nh: 50, fh: 44, tail: -10, head: 3 }),
  S({ rot: 18, cx: 72, cy: 97, nf: -18, ff: -20, nh: 72, fh: 62, tail: -26, head: 4, land: 1 }),
  S({ rot: 7, cx: 72, cy: 97, nf: -7, ff: -8, nh: 30, fh: 26, tail: -14, head: 2, land: 1 }),
  S({ bob: 1.6, tail: 8, land: 2 }),
];

const st = (anim: "idle" | "move", f: number) => (anim === "idle" ? IDLE : MOVE)[f] ?? S({});

function rotPt(x: number, y: number, s: St) {
  const a = (s.rot * Math.PI) / 180;
  const c = Math.cos(a);
  const n = Math.sin(a);
  return { x: s.cx + (x - s.cx) * c - (y - s.cy) * n, y: s.cy + (x - s.cx) * n + (y - s.cy) * c };
}

// The pawn rides 20 up: its base point (50, 88) sits at (50, 68), so its own y 66 (the cut) meets the seat line at y 46.

function star(cx: number, cy: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? "L" : "M"} ${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return d + "Z";
}

function Leg({ hx, ang, fill }: { hx: number; ang: number; fill: string }) {
  return (
    <g transform={`rotate(${ang} ${hx} 74)`}>
      <path d={`M ${hx - 5.5} 66 L ${hx + 5.5} 66 L ${hx + 5} 92 L ${hx - 5} 92 Z`} fill={fill} {...LINE} />
      <path d={`M ${hx - 5.6} 91 L ${hx + 5.6} 91 Q ${hx + 6.6} 97 ${hx + 5.6} 97 L ${hx - 5.6} 97 Q ${hx - 6.6} 97 ${hx - 5.6} 91 Z`} fill={HOOF} {...LINE} {...lw(2.4)} />
      <path d={`M ${hx + 1.5} 92.5 L ${hx + 1.5} 96`} stroke="#6b5a50" stroke-linecap="round" {...lw(1)} />
    </g>
  );
}

function Puff({ x, y, r, fill, o = 1 }: { x: number; y: number; r: number; fill: string; o?: number }) {
  return (
    <g opacity={o}>
      <path
        d={`M ${x - r} ${y} a ${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.6} ${-r * 0.7} a ${r * 0.8} ${r * 0.8} 0 0 1 ${r * 1.2} ${-r * 0.1} a ${r * 0.6} ${r * 0.6} 0 0 1 ${r * 0.3} ${r * 0.9} a ${r * 0.5} ${r * 0.5} 0 0 1 ${-r * 0.6} ${r * 0.5} L ${x - r * 0.5} ${y + r * 0.45} a ${r * 0.45} ${r * 0.45} 0 0 1 ${-r * 0.5} ${-r * 0.45} Z`}
        fill={fill}
        {...LINE}
        {...lw(1.4)}
      />
    </g>
  );
}

function Head({ s }: { s: St }) {
  return (
    <g transform={`rotate(${s.head} 78 56)`}>
      {/* far horn */}
      <path d="M 80 41 Q 76 33 70.5 31.5 Q 67.5 31.2 69 34 Q 74 36.5 77.5 43 Z" fill={darken(IVORY, 0.12)} {...LINE} {...lw(2.2)} />
      {/* ear */}
      <path d="M 78 47 Q 70.5 45.5 66.5 50 Q 71.5 54 78 52 Z" fill={BROWN} {...LINE} {...lw(2.4)} />
      <path d="M 76 48.6 Q 72 48.2 69.6 50.4 Q 72.6 51.8 76 51 Z" fill="#d79a86" />
      {/* head */}
      <path d="M 74.5 47 Q 76 37 86.5 37 Q 96 37 97 47 L 97.5 55 Q 96.5 61 90 62 L 80 62 Q 73 58 74.5 47 Z" fill={BROWN} {...LINE} />
      <path d="M 78.5 44 Q 80 40 84.5 39.4" fill="none" stroke={BROWN_L} stroke-linecap="round" {...lw(1.8)} />
      {/* tuft */}
      <path d="M 79.5 40.5 Q 79.5 33.5 84 35.5 Q 85.5 31 89.5 34.5 Q 92.5 32.5 92.5 38.5 Q 86 37.5 79.5 40.5 Z" fill={TUFT} {...LINE} {...lw(2)} />
      {/* near horn */}
      <path d="M 86.5 40 Q 88.5 32 96.5 28.6 Q 100 27.8 98.6 30.8 Q 93.5 34 92.5 40.5 Z" fill={IVORY} {...LINE} {...lw(2.2)} />
      <path d="M 96.2 28.8 Q 99.8 27.8 98.6 30.8 Q 97.6 31.4 96.6 31.6 Z" fill="#5c4a3c" />
      {/* muzzle */}
      <path d="M 80.5 60 Q 80.5 51 90 51 Q 101.5 51 101.5 60 Q 101.5 69.5 91 69.5 Q 80.5 69.5 80.5 60 Z" fill={CREAM} {...LINE} />
      <ellipse cx="97.6" cy="57.6" rx="1.3" ry="2" fill="#4a2f22" />
      <ellipse cx="93.8" cy="56.9" rx="1" ry="1.6" fill="#4a2f22" />
      <path d="M 87.5 65.4 Q 91.5 67.6 95.5 65.4" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(1.4)} />
      {/* nose ring */}
      <circle cx="98.4" cy="63.6" r="3" fill="none" stroke="#1d1d1f" {...lw(3.6)} />
      <circle cx="98.4" cy="63.6" r="3" fill="none" stroke={GOLD} {...lw(1.6)} />
      {/* eye and brow */}
      <ellipse cx="84.6" cy="47.4" rx="2.3" ry="2.9" fill="#1d1d1f" />
      <circle cx="85.4" cy="46.4" r="0.9" fill="#fff" />
      <path d="M 81.4 42.6 L 88 44" fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(1.7)} />
      {/* steam from the nostrils */}
      {s.steam === 1 && <Puff x={103} y={60} r={3.4} fill={STEAM} />}
      {s.steam === 2 && (
        <>
          <Puff x={105} y={59} r={4.6} fill={STEAM} />
          <Puff x={102.5} y={66} r={3.2} fill={STEAM} />
        </>
      )}
      {s.steam === 3 && (
        <>
          <Puff x={107.5} y={57} r={3.8} fill={STEAM} o={0.55} />
          <Puff x={105.5} y={65} r={2.6} fill={STEAM} o={0.45} />
        </>
      )}
    </g>
  );
}

function Tail({ s }: { s: St }) {
  const rope = "M 14 57 Q 4 61 6.5 75";
  return (
    <g transform={`rotate(${s.tail} 14 57)`}>
      <path d={rope} fill="none" stroke="#1d1d1f" stroke-linecap="round" {...lw(5.6)} />
      <path d={rope} fill="none" stroke={ROPE} stroke-linecap="round" {...lw(2.8)} />
      <path d="M 11 57.6 l 1 1.6 M 8 59.4 l 1.4 1.2 M 6.2 62.4 l 1.6 0.8 M 5.6 66 l 1.7 0.3 M 5.8 69.6 l 1.7 0" stroke="#8a6230" stroke-linecap="round" {...lw(0.9)} />
      <path d="M 6.4 73 Q 1.4 76.5 2.6 83 Q 5 80.6 6.4 84.6 Q 8.4 80.6 10.8 82.6 Q 11.2 75.8 6.4 73 Z" fill={TUFT} {...LINE} {...lw(2)} />
    </g>
  );
}

function Back({ anim, f, p }: RiderProps) {
  const s = st(anim, f);
  return (
    <g>
      <g transform={`rotate(${s.rot} ${s.cx} ${s.cy})`}>
        <Leg hx={34} ang={s.fh} fill={BROWN_D} />
        <Leg hx={63} ang={s.ff} fill={BROWN_D} />
        <g transform={`translate(0 ${s.bob})`}>
          <Tail s={s} />
        </g>
        <Leg hx={24} ang={s.nh} fill={BROWN} />
        <Leg hx={73} ang={s.nf} fill={BROWN} />
        <g transform={`translate(0 ${s.bob})`}>
          {/* body with its shoulder hump */}
          <path d="M 15 54 Q 18 46 30 46 L 50 47.5 Q 60 47 66 42 Q 74 35.5 82 41 L 86 50 L 85 70 Q 83 83 69 83 L 28 83 Q 12 83 12 69 Q 12 60 15 54 Z" fill={BROWN} {...LINE} />
          <path d="M 18 55 Q 21 49.5 29 49" fill="none" stroke={BROWN_L} stroke-linecap="round" {...lw(2)} />
          <path d="M 68 44.5 Q 73 40 78 41.5" fill="none" stroke={BROWN_L} stroke-linecap="round" {...lw(2)} />
          <path d="M 34 80 Q 50 82.5 66 80" fill="none" stroke={BROWN_D} stroke-linecap="round" {...lw(1.6)} />
          {/* cantle, behind the rider */}
          <Region p={p} name="cantle" d={["M 25.5 47 Q 23.5 37.5 30 35.5 Q 35 35 35 40.5 L 35 47 Z"]} />
          <Head s={s} />
        </g>
      </g>
      {/* paw dust (on the ground, behind the near front hoof) */}
      {s.dust === 1 && <Puff x={62} y={95.5} r={3.4} fill={DUST} />}
      {s.dust === 2 && (
        <>
          <Puff x={58} y={94.5} r={4} fill={DUST} o={0.75} />
          <Puff x={65} y={96.5} r={2.6} fill={DUST} o={0.6} />
        </>
      )}
      {/* landing dust (on the ground) */}
      {s.land >= 1 && <Puff x={82} y={95} r={3.4} fill={DUST} o={s.land === 2 ? 0.6 : 1} />}
      {s.land === 2 && (
        <>
          <Puff x={17} y={95} r={4} fill={DUST} />
          <Puff x={30} y={96.5} r={2.6} fill={DUST} />
        </>
      )}
    </g>
  );
}

function Front({ anim, f, p }: RiderProps) {
  const s = st(anim, f);
  const dark = darken(p.hex, 0.32);
  const fringe = [];
  for (let x = 26.5; x < 75; x += 3) fringe.push(`M ${x.toFixed(1)} 62.5 L ${x.toFixed(1)} 66.5`);
  return (
    <g transform={`rotate(${s.rot} ${s.cx} ${s.cy})`}>
      <g transform={`translate(0 ${s.bob})`}>
        {/* cinch under the belly */}
        <Region p={p} name="cinch" d={["M 54.5 62 L 59.5 62 L 59.5 84.5 L 54.5 84.5 Z"]} fill={dark} line={2} />
        {/* saddle blanket with its fringe */}
        <Region
          p={p}
          name="fringe"
          fill={dark}
          line={2}
          d={["M 24.5 61 L 75.5 61 L 75.5 66 L 73 68 L 70 66 L 67 68 L 64 66 L 61 68 L 58 66 L 55 68 L 52 66 L 49 68 L 46 66 L 43 68 L 40 66 L 37 68 L 34 66 L 31 68 L 28 66 L 24.5 68 Z"]}
          over={<path d={fringe.join(" ")} stroke={darken(p.hex, 0.55)} stroke-linecap="round" {...lw(0.9)} />}
        />
        <Region
          p={p}
          name="blanket"
          d={["M 24.5 47 Q 24.5 44.5 27.5 44.5 L 72.5 44.5 Q 75.5 44.5 75.5 47 L 75.5 62 L 24.5 62 Z"]}
          over={
            <>
              <rect x="20" y="56.5" width="60" height="2.6" fill={lighten(p.hex, 0.55)} />
              <path d="M 20 59.1 L 80 59.1" stroke={dark} {...lw(0.9)} />
              <path d="M 20 56.5 L 80 56.5" stroke={dark} {...lw(0.9)} />
            </>
          }
        />
        {/* saddle skirt */}
        <Region p={p} name="skirt" d={["M 32.5 46 L 67.5 46 Q 70 46 70 49 L 70 56 Q 70 60.5 65.5 60.5 L 34.5 60.5 Q 30 60.5 30 56 L 30 49 Q 30 46 32.5 46 Z"]} />
        <path d="M 33.5 51 L 66.5 51 L 66.5 57.5 L 33.5 57.5 Z" fill="none" stroke={darken(p.hex, 0.45)} stroke-dasharray="2 1.8" {...lw(0.9)} />
        {/* seat roll */}
        <Region p={p} name="seat" d={["M 27.5 45.5 Q 30 49.5 36 49.5 L 63 49.5 Q 67 49.5 68 45.5 Z"]} fill={lighten(p.hex, 0.18)} line={2} />
        {/* pommel and horn */}
        <Region p={p} name="pommel" d={["M 63 47 Q 66.5 45 67 40.5 L 72.5 40.5 Q 74 46.5 71 50 L 63 50 Z"]} line={2.4} />
        <Region p={p} name="horn" d={["M 68 41 L 68 35.5 L 71.5 35.5 L 71.5 41 Z", "M 65.5 34.6 Q 65.5 32.4 69.8 32.4 Q 74.2 32.4 74.2 34.6 Q 74.2 36.6 69.8 36.6 Q 65.5 36.6 65.5 34.6 Z"]} line={2} />
        {/* stirrup */}
        <Region p={p} name="strap" d={["M 41.5 59 L 45.5 59 L 45.5 71 L 41.5 71 Z"]} fill={dark} line={1.8} />
        <path d="M 39.5 70.5 L 47.5 70.5 L 48.5 75.5 L 38.5 75.5 Z" fill="none" stroke="#1d1d1f" stroke-linejoin="round" {...lw(4)} />
        <path d="M 39.5 70.5 L 47.5 70.5 L 48.5 75.5 L 38.5 75.5 Z" fill="none" stroke={BROWN_D} stroke-linejoin="round" {...lw(1.8)} />
        {/* gold star concho */}
        <circle cx="56" cy="53.5" r="5.4" fill={darken(GOLD, 0.25)} {...LINE} {...lw(1.6)} />
        <path d={star(56, 53.5, 4.3)} fill={GOLD} {...LINE} {...lw(1.2)} />
        <circle cx="54.8" cy="52" r="0.8" fill="#fff8d8" />
      </g>
    </g>
  );
}

export const rodeoBull: RiderDraft = {
  id: "rodeo-bull",
  name: "Rodeo Bull",
  tier: "mythic",
  description: "Eight seconds is the record. He's never once let anyone off early.",
  frame: [-2, -2, 112, 102],
  idle: { ms: [420, 180, 200, 240, 220, 200, 220, 300] },
  move: { ms: [90, 80, 80, 80, 80, 100, 80, 110] },
  pose: (anim, f) => {
    const s = st(anim, f);
    const b = rotPt(50, 68 + s.bob, s);
    const pos = anim === "move" ? (MOVE_POS[f] ?? { dx: 0, dy: 0 }) : { dx: 0, dy: 0 };
    return { dx: pos.dx, dy: pos.dy, pawnX: b.x - 50, pawnY: b.y - 88, pawnTilt: s.rot, cut: 66 };
  },
  Back,
  Front,
};
