import { Region, LINE, lw, type RiderDraft, type RiderProps, type RiderViewDraft } from "../../item-kit.tsx";

const INK = "#1d1d1f";
const TRACK = "#3c3b41";
const STEEL = "#8e949c";
const STEEL_D = "#5d6169";
const EDGE = "#c9ced6";
const HAZ = "#f5c518";
const PUFF = "#ecebef";
const DIRT = "#7a5634";
const FUR = "#837871";
const FUR_D = "#3e3735";

const IDLE_MS = [150, 150, 150, 150, 150, 150];
const MOVE_MS = [100, 100, 100, 100, 100, 100, 100, 100];

const TRACK_D = "M17 78 H75 A10 10 0 0 1 75 98 H17 A10 10 0 0 1 17 78 Z";

/** The whip antenna and its raccoon-tail flag (behind the pawn). */
function Antenna({ f, anim }: RiderProps) {
  const n = anim === "idle" ? IDLE_MS.length : MOVE_MS.length;
  const ph = (f / n) * Math.PI * 2;
  const sway = anim === "move" ? 1.6 : 1;
  const tx = 9 - Math.sin(ph) * 0.8 * sway;
  const ty = -3;
  const cx = -1;
  const cy = ty + Math.sin(ph) * 5 * sway;
  const ex = -8;
  const ey = ty + 7 + Math.sin(ph + 1.6) * 4 * sway;
  const tail = `M${tx} ${ty} Q${cx} ${cy.toFixed(2)} ${ex} ${ey.toFixed(2)}`;
  return (
    <g>
      <path d={`M17 56 Q14 26 ${tx} ${ty}`} fill="none" {...LINE} {...lw(3.2)} />
      <path d={`M17 56 Q14 26 ${tx} ${ty}`} fill="none" stroke="#9aa0a8" stroke-linecap="round" {...lw(1.2)} />
      <path d={tail} fill="none" stroke={INK} stroke-linecap="round" {...lw(12)} />
      <path d={tail} fill="none" stroke={FUR} stroke-linecap="round" {...lw(9)} />
      <path d={tail} fill="none" stroke={FUR_D} stroke-dasharray="4 4" stroke-dashoffset="-4" {...lw(9)} />
      <circle cx={ex} cy={ey} r="3.6" fill={FUR_D} />
      <path d={`M${tx - 3} ${ty - 2.2} Q${cx} ${(cy - 3).toFixed(2)} ${ex + 3} ${(ey - 2.5).toFixed(2)}`} fill="none" stroke="#fff" stroke-opacity="0.35" stroke-linecap="round" {...lw(1.6)} />
      <circle cx={tx} cy={ty} r="2" fill={EDGE} {...LINE} {...lw(1.4)} />
    </g>
  );
}

function Back(props: RiderProps) {
  return (
    <g>
      <Antenna {...props} />
      {/* seat back */}
      <rect x="12" y="34" width="12" height="24" rx="4" fill="#2e2d33" {...LINE} />
      <path d="M15.5 38 V52" stroke="#55545c" stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

function Wheel({ cx, cy, r, rot }: { cx: number; cy: number; r: number; rot: number }) {
  const bolts = [0, 120, 240].map((a) => {
    const t = ((a + rot) * Math.PI) / 180;
    return [cx + Math.cos(t) * r * 0.55, cy + Math.sin(t) * r * 0.55];
  });
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={STEEL} {...LINE} {...lw(2)} />
      <circle cx={cx} cy={cy} r={r * 0.32} fill={STEEL_D} />
      {bolts.map(([x, y]) => (
        <circle cx={x} cy={y} r={r * 0.15} fill={STEEL_D} />
      ))}
    </g>
  );
}

function Puff({ f, anim }: RiderProps) {
  // puffs: [x, y, r]
  const idle: [number, number, number][][] = [
    [],
    [[75, 22, 3.6]],
    [[76, 16, 5.2]],
    [[78, 9, 6.2], [75, 22, 3]],
    [[80, 3, 6.4], [76, 16, 4]],
    [[82, -2, 5], [77, 10, 3.4]],
  ];
  const move: [number, number, number][][] = [
    [[75, 22, 3.8]],
    [[72, 16, 5.4]],
    [[67, 11, 6.4], [75, 22, 3.2]],
    [[61, 7, 6.4], [72, 16, 4.8]],
    [[56, 3, 5.2], [67, 10, 6]],
    [[61, 5, 5.6], [75, 22, 3.4]],
    [[56, 1, 4.4], [72, 16, 5]],
    [[67, 11, 5.6], [75, 22, 3]],
  ];
  const list = (anim === "idle" ? idle : move)[f] ?? [];
  return (
    <g>
      {list.map(([x, y, r]) => {
        const lobes: [number, number, number][] = [
          [x, y, r],
          [x - r * 0.75, y + r * 0.35, r * 0.62],
          [x + r * 0.7, y + r * 0.4, r * 0.55],
        ];
        return (
          <g>
            {lobes.map(([a, b, c]) => (
              <circle cx={a} cy={b} r={c} fill={PUFF} {...LINE} {...lw(3.2)} />
            ))}
            {lobes.map(([a, b, c]) => (
              <circle cx={a} cy={b} r={c} fill={PUFF} />
            ))}
            <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.3} fill="#fff" />
          </g>
        );
      })}
    </g>
  );
}

function Crumbs({ f, anim }: RiderProps) {
  if (anim !== "move") return null;
  const sets: [number, number, number][][] = [
    [[105, 92, 2.4], [3, 94, 2]],
    [[107, 86, 2.6], [104, 96, 1.8], [-1, 89, 2.2]],
    [[109, 82, 2.2], [-4, 85, 1.8]],
    [[105, 93, 2.4], [110, 88, 1.8]],
    [[107, 87, 2.4], [3, 94, 2.1]],
    [[109, 83, 2], [104, 96, 2], [-1, 89, 2.1]],
    [[110, 89, 1.8], [-4, 86, 1.7]],
    [[104, 95, 2.2]],
  ];
  return (
    <g>
      {(sets[f] ?? []).filter(([x]) => x > 50).map(([x, y, r]) => (
        <circle cx={x} cy={y} r={r} fill={DIRT} {...LINE} {...lw(1.2)} />
      ))}
    </g>
  );
}

function Front(props: RiderProps) {
  const { p, f, anim } = props;
  const moving = anim === "move";
  const lug = moving ? -3 * f : 0;
  const rot = moving ? 30 * f : 0;
  const bladeA = moving ? [0, 1.5, 2.5, 1.5, 0, -3, -4.5, -3][f] : 0;
  return (
    <g>
      {/* exhaust stack, behind the hood */}
      <rect x="71.5" y="28" width="7" height="16" rx="1.5" fill="#46464d" {...LINE} />
      <rect x="70" y="26" width="10" height="4" rx="1.5" fill={STEEL} {...LINE} {...lw(2)} />
      <path d="M73.5 32 V41" stroke="#6c6c75" stroke-linecap="round" {...lw(1.6)} />

      {/* track: grousers then the belt */}
      <path d={TRACK_D} fill="none" stroke={INK} stroke-dasharray="3.5 4.5" stroke-dashoffset={lug} {...lw(6.5)} />
      <path d={TRACK_D} fill={TRACK} {...LINE} />
      <rect x="11" y="83" width="70" height="10" rx="5" fill="#2a292e" />
      <Wheel cx={17} cy={88} r={7.5} rot={rot} />
      <Wheel cx={75} cy={88} r={7.5} rot={rot} />
      <Wheel cx={35} cy={90} r={4.6} rot={rot} />
      <Wheel cx={46} cy={90} r={4.6} rot={rot} />
      <Wheel cx={57} cy={90} r={4.6} rot={rot} />

      {/* body and hood: the painted parts */}
      <Region p={p} name="body" d={["M9 80 L9 61 Q9 53 17 53 L62 53 L62 80 Z"]} />
      <Region p={p} name="hood" d={["M57 80 L57 46 Q57 40 63 40 L81 40 Q87 40 87.5 46 L89 80 Z"]} />
      {/* highlights */}
      <path d="M14 57.5 H54" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      <path d="M62 44.5 H80" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      {/* hazard stripe */}
      <rect x="13" y="65" width="42" height="8" fill={HAZ} {...LINE} {...lw(2)} />
      {[13, 21, 29, 37, 45].map((x) => (
        <path d={`M${x + 1} 73 L${x + 5} 65 L${x + 9} 65 L${x + 5} 73 Z`} fill={INK} />
      ))}
      <rect x="13" y="65" width="42" height="8" fill="none" {...LINE} {...lw(2)} />
      {/* hood vents */}
      {[54, 59, 64].map((y) => (
        <path d={`M64 ${y} H79`} stroke={INK} stroke-linecap="round" {...lw(2)} />
      ))}
      {/* bandit-mask headlight */}
      <path d="M76 45 H88 Q91 45 91 48.5 Q91 52 88 52 H76 Q74 48.5 76 45 Z" fill={INK} />
      <circle cx="86" cy="48.5" r="2.6" fill="#fff6c8" stroke="#2d2d30" {...lw(1)} />
      <circle cx="85.3" cy="47.7" r="0.9" fill="#fff" />
      {/* rear tail-light */}
      <rect x="6.5" y="58" width="4" height="6" rx="1.5" fill="#e0393b" {...LINE} {...lw(1.6)} />

      {/* push arm and blade */}
      <g transform={`rotate(${bladeA} 52 75)`}>
        <path d="M50 72 L93 77 L93 83 L50 78 Z" fill={STEEL_D} {...LINE} {...lw(2.4)} />
        <circle cx="52" cy="75" r="2.6" fill={STEEL} {...LINE} {...lw(1.6)} />
        <Region p={p} name="blade" d={["M89 57 Q86 77 91 95 L101 95 Q95 77 99.5 56 Z"]} />
        <path d="M92.5 61 Q90.5 76 93.5 90" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.8)} />
        <path d="M91 93 L101.5 93 L102.5 98 L92 98 Z" fill={EDGE} {...LINE} {...lw(2)} />
      </g>

      <Puff {...props} />
      <Crumbs {...props} />
    </g>
  );
}

/* ---------- front and back views (end-on) ---------- */

const SEAT = "#2e2d33";
const SEAT_L = "#55545c";
const UNDER = "#2a292e";
const IDLE_PUFFS: [number, number, number][][] = [
  [],
  [[75, 22, 3.6]],
  [[76, 16, 5.2]],
  [[78, 9, 6.2], [75, 22, 3]],
  [[80, 3, 6.4], [76, 16, 4]],
  [[82, -2, 5], [77, 10, 3.4]],
];
const MOVE_PUFFS: [number, number, number][][] = [
  [[75, 22, 3.8]],
  [[72, 16, 5.4]],
  [[67, 11, 6.4], [75, 22, 3.2]],
  [[61, 7, 6.4], [72, 16, 4.8]],
  [[56, 3, 5.2], [67, 10, 6]],
  [[61, 5, 5.6], [75, 22, 3.4]],
  [[56, 1, 4.4], [72, 16, 5]],
  [[67, 11, 5.6], [75, 22, 3]],
];
const END_BLADE_DY = [0, 0.8, 1.3, 0.8, 0, -1.5, -2.3, -1.5];
const CRUMB_ARC: [number, number, number][] = [
  [7, 95, 2.2],
  [2, 89, 2.4],
  [-2, 86, 2],
  [-4, 91, 1.7],
];

/** The antenna seen end-on: the flag swings out to one side (dir -1 left, +1 right). */
function EndAntenna({ f, anim, bx, dir }: RiderProps & { bx: number; dir: number }) {
  const n = anim === "idle" ? IDLE_MS.length : MOVE_MS.length;
  const ph = (f / n) * Math.PI * 2;
  const sway = anim === "move" ? 1.6 : 1;
  const tx = bx + dir * 2 + Math.sin(ph) * 0.8 * sway;
  const ty = -3;
  const cx = tx + dir * 8;
  const cy = ty + Math.sin(ph) * 4 * sway;
  const ex = tx + dir * (14 + Math.sin(ph + 1.6) * 2 * sway);
  const ey = ty + 7 + Math.sin(ph + 1.6) * 4 * sway;
  const tail = `M${tx.toFixed(2)} ${ty} Q${cx.toFixed(2)} ${cy.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  const rod = `M${bx} 54 Q${bx - dir * 1.5} 26 ${tx.toFixed(2)} ${ty}`;
  return (
    <g>
      <path d={rod} fill="none" {...LINE} {...lw(3.2)} />
      <path d={rod} fill="none" stroke="#9aa0a8" stroke-linecap="round" {...lw(1.2)} />
      <path d={tail} fill="none" stroke={INK} stroke-linecap="round" {...lw(12)} />
      <path d={tail} fill="none" stroke={FUR} stroke-linecap="round" {...lw(9)} />
      <path d={tail} fill="none" stroke={FUR_D} stroke-dasharray="4 4" stroke-dashoffset="-4" {...lw(9)} />
      <circle cx={ex} cy={ey} r="3.6" fill={FUR_D} />
      <path d={`M${(tx + dir * 3).toFixed(2)} ${ty - 2.2} Q${cx.toFixed(2)} ${(cy - 3).toFixed(2)} ${(ex - dir * 3).toFixed(2)} ${(ey - 2.5).toFixed(2)}`} fill="none" stroke="#fff" stroke-opacity="0.35" stroke-linecap="round" {...lw(1.6)} />
      <circle cx={tx} cy={ty} r="2" fill={EDGE} {...LINE} {...lw(1.4)} />
    </g>
  );
}

/** The exhaust stack seen end-on. */
function EndStack({ x, y1 }: { x: number; y1: number }) {
  return (
    <g>
      <rect x={x - 3.5} y="28" width="7" height={y1 - 28} rx="1.5" fill="#46464d" {...LINE} />
      <rect x={x - 5} y="26" width="10" height="4" rx="1.5" fill={STEEL} {...LINE} {...lw(2)} />
      <path d={`M${x - 1.5} 32 V${y1 - 4}`} stroke="#6c6c75" stroke-linecap="round" {...lw(1.6)} />
    </g>
  );
}

/** Puffs from an end-on stack at x sx, drifting outward (dir), scaled k (bigger coming toward us). */
function EndPuff({ f, anim, sx, dir, k }: RiderProps & { sx: number; dir: number; k: number }) {
  const src = (anim === "idle" ? IDLE_PUFFS : MOVE_PUFFS)[f] ?? [];
  const list = src.map(([x, y, r]): [number, number, number] =>
    anim === "idle" ? [sx + dir * (x - 75) * 0.8, y, r * k] : [sx + dir * Math.abs(75 - x) * 0.35, y, r * k],
  );
  return (
    <g>
      {list.map(([x, y, r]) => {
        const lobes: [number, number, number][] = [
          [x, y, r],
          [x - r * 0.75, y + r * 0.35, r * 0.62],
          [x + r * 0.7, y + r * 0.4, r * 0.55],
        ];
        return (
          <g>
            {lobes.map(([a, b, c]) => (
              <circle cx={a} cy={b} r={c} fill={PUFF} {...LINE} {...lw(3.2)} />
            ))}
            {lobes.map(([a, b, c]) => (
              <circle cx={a} cy={b} r={c} fill={PUFF} />
            ))}
            <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.3} fill="#fff" />
          </g>
        );
      })}
    </g>
  );
}

/** Dirt crumbs kicked out to both sides, one arc each side, staggered. */
function EndCrumbs({ f, anim, onTrack }: RiderProps & { onTrack?: boolean }) {
  if (anim !== "move") return null;
  const a = CRUMB_ARC[f % 4];
  const b = CRUMB_ARC[(f + 2) % 4];
  const all: [number, number, number][] = [a, [100 - b[0], b[1], b[2]]];
  const list = onTrack ? all.filter(([x]) => x >= 5 && x <= 95) : all;
  return (
    <g>
      {list.map(([x, y, r]) => (
        <circle cx={x} cy={y} r={r} fill={DIRT} {...LINE} {...lw(1.2)} />
      ))}
    </g>
  );
}

/** A track seen end-on: the tread face with its grousers rolling (shift: + down, - up). */
function EndTrack({ x, y0, y1, w, shift, cid }: { x: number; y0: number; y1: number; w: number; shift: number; cid: string }) {
  const s = ((shift % 4) + 4) % 4;
  const bars: number[] = [];
  for (let y = y0 + 6 + s - 4; y < y1; y += 4) if (y > y0 + 5.5) bars.push(y);
  return (
    <g>
      <clipPath id={cid}>
        <rect x={x} y={y0} width={w} height={y1 - y0} rx="4" />
      </clipPath>
      <rect x={x} y={y0} width={w} height={y1 - y0} rx="4" fill={TRACK} />
      <g clip-path={`url(#${cid})`}>
        <rect x={x} y={y0} width={w} height="5" fill="#4d4c54" />
        {bars.map((y) => (
          <path d={`M${x} ${y} H${x + w}`} stroke={INK} {...lw(2)} />
        ))}
        <path d={`M${x + w / 2} ${y0 + 5} V${y1}`} stroke={UNDER} {...lw(2.4)} />
      </g>
      <path d={`M${x + 1.5} ${y0 + 5} H${x + w - 1.5}`} stroke={INK} stroke-opacity="0.6" {...lw(1.2)} />
      <rect x={x} y={y0} width={w} height={y1 - y0} rx="4" fill="none" {...LINE} />
    </g>
  );
}

/* --- front: coming down the screen --- */

function FrontViewBack(props: RiderProps) {
  return (
    <g>
      <EndAntenna {...props} bx={79} dir={1} />
      {/* seat back, behind the pawn */}
      <rect x="35" y="36" width="30" height="22" rx="5" fill={SEAT} {...LINE} />
      <path d="M39 40 H61" stroke={SEAT_L} stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

function FrontViewFront(props: RiderProps) {
  const { p, f, anim } = props;
  const moving = anim === "move";
  const shift = moving ? 1.5 * f : 0;
  const bdy = moving ? END_BLADE_DY[f] ?? 0 : 0;
  return (
    <g>
      {/* body behind the hood */}
      <Region p={p} name="body" d={["M10 80 L10 58 Q10 52 16 52 L84 52 Q90 52 90 58 L90 80 Z"]} />
      <path d="M15 55.5 H29" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      <path d="M71 55.5 H85" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      <EndStack x={21} y1={54} />
      {/* hood with its bandit-mask headlights */}
      <Region p={p} name="hood" d={["M33 80 L33 49 Q33 44 38 44 L62 44 Q67 44 67 49 L67 80 Z"]} />
      <path d="M37.5 47.5 H62.5" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      <path d="M33 50 Q50 48 67 50 L67 56.5 Q60 59.5 53.5 56.2 Q50 54.6 46.5 56.2 Q40 59.5 33 56.5 Z" fill={INK} />
      {[41, 59].map((x) => (
        <g>
          <circle cx={x} cy="53.4" r="3" fill="#fff6c8" stroke="#2d2d30" {...lw(1)} />
          <circle cx={x - 0.8} cy="52.5" r="1" fill="#fff" />
        </g>
      ))}
      {[61.5, 65].map((y) => (
        <path d={`M42 ${y} H58`} stroke={INK} stroke-linecap="round" {...lw(1.8)} />
      ))}
      {/* tracks */}
      <EndTrack x={5} y0={66} y1={97} w={18} shift={shift} cid={`${p.id}-ftl`} />
      <EndTrack x={77} y0={66} y1={97} w={18} shift={shift} cid={`${p.id}-ftr`} />
      {/* blade on its lift arms */}
      <g transform={`translate(0 ${bdy})`}>
        {[
          ["M33 62 L24 73", 33, 62],
          ["M67 62 L76 73", 67, 62],
        ].map(([d, x, y]) => (
          <g>
            <path d={d as string} fill="none" {...LINE} {...lw(5.4)} />
            <path d={d as string} fill="none" stroke={STEEL_D} stroke-linecap="round" {...lw(3)} />
            <circle cx={x as number} cy={y as number} r="2.2" fill={STEEL} {...LINE} {...lw(1.6)} />
          </g>
        ))}
        <Region p={p} name="blade" d={["M17 70 Q50 67 83 70 L83 93 L17 93 Z"]} />
        <path d="M17.5 70.3 Q50 67.3 82.5 70.3 L82.7 74 Q50 71 17.3 74 Z" fill="#000" fill-opacity="0.22" />
        <path d="M17.2 74 Q50 71 82.8 74" fill="none" stroke={INK} {...lw(1.6)} />
        <path d="M23 79 Q50 76.5 77 79" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(1.8)} />
        <path d="M16.5 92 L83.5 92 L85 97.5 L15 97.5 Z" fill={EDGE} {...LINE} {...lw(2)} />
        {[26, 38, 50, 62, 74].map((x) => (
          <circle cx={x} cy="94.8" r="0.9" fill={STEEL_D} />
        ))}
      </g>
      <EndPuff {...props} sx={21} dir={-1} k={0.9} />
      <EndCrumbs {...props} />
    </g>
  );
}

/* --- back: going up the screen --- */

function BackViewBack(props: RiderProps) {
  const { p } = props;
  return (
    <g>
      <Region p={p} name="hood" d={["M32 54 L32 43 Q32 38 37 38 L63 38 Q68 38 68 43 L68 54 Z"]} />
      <EndStack x={79} y1={52} />
      <EndPuff {...props} sx={79} dir={1} k={1.08} />
    </g>
  );
}

function BackViewFront(props: RiderProps) {
  const { p, f, anim } = props;
  const moving = anim === "move";
  const shift = moving ? -1.5 * f : 0;
  const hz = `${p.id}-bhaz`;
  return (
    <g>
      {/* undercarriage between the tracks */}
      <rect x="22" y="78" width="56" height="12" fill={UNDER} {...LINE} {...lw(2)} />
      {/* body: deck seen from above, then the rear panel */}
      <Region p={p} name="body" d={["M10 82 L10 56 Q10 50 16 50 L84 50 Q90 50 90 56 L90 82 Z"]} />
      <path d="M11 56.5 H89" stroke={INK} stroke-opacity="0.45" {...lw(1.4)} />
      <path d="M16 53.2 H33" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      <path d="M67 53.2 H84" stroke="#fff" stroke-opacity="0.45" stroke-linecap="round" {...lw(2.2)} />
      {/* seat back, in front of the pawn */}
      <rect x="36" y="39" width="28" height="16" rx="5" fill={SEAT} {...LINE} />
      <path d="M40.5 43 H59.5" stroke={SEAT_L} stroke-linecap="round" {...lw(2)} />
      <EndAntenna {...props} bx={21} dir={-1} />
      {/* tail-lights */}
      <rect x="13" y="58.5" width="6" height="5.5" rx="1.5" fill="#e0393b" {...LINE} {...lw(1.6)} />
      <rect x="81" y="58.5" width="6" height="5.5" rx="1.5" fill="#e0393b" {...LINE} {...lw(1.6)} />
      <circle cx="14.8" cy="60.2" r="0.9" fill="#fff" fill-opacity="0.7" />
      <circle cx="82.8" cy="60.2" r="0.9" fill="#fff" fill-opacity="0.7" />
      {/* hazard stripe */}
      <clipPath id={hz}>
        <rect x="27" y="65" width="46" height="8" />
      </clipPath>
      <rect x="27" y="65" width="46" height="8" fill={HAZ} />
      <g clip-path={`url(#${hz})`}>
        {[23, 31, 39, 47, 55, 63, 71].map((x) => (
          <path d={`M${x + 1} 73 L${x + 5} 65 L${x + 9} 65 L${x + 5} 73 Z`} fill={INK} />
        ))}
      </g>
      <rect x="27" y="65" width="46" height="8" fill="none" {...LINE} {...lw(2)} />
      {/* tow hitch */}
      <rect x="45" y="80" width="10" height="6" rx="1.5" fill={STEEL_D} {...LINE} {...lw(1.6)} />
      <circle cx="50" cy="86" r="2.4" fill={STEEL} {...LINE} {...lw(1.4)} />
      {/* tracks */}
      <EndTrack x={5} y0={66} y1={97} w={18} shift={shift} cid={`${p.id}-btl`} />
      <EndTrack x={77} y0={66} y1={97} w={18} shift={shift} cid={`${p.id}-btr`} />
      <EndCrumbs {...props} onTrack />
    </g>
  );
}

const END_POSE = (anim: "idle" | "move", f: number) => {
  if (anim === "idle") {
    const dy = [0, -0.6, 0, -0.5, 0, -0.6][f] ?? 0;
    const py = [0, -0.4, 0.2, -0.3, 0.2, -0.4][f] ?? 0;
    return { dx: 0, dy, pawnX: 0, pawnY: -14 + py, cut: 68 };
  }
  const dy = [0, -0.8, -0.3, 0, -0.8, -0.3, 0, -0.5][f] ?? 0;
  const tilt = [0, -1.2, -1.6, -0.8, 0, 0.8, 1.2, 0.4][f] ?? 0;
  return { dx: 0, dy, pawnX: 0, pawnY: -14 - (f % 2) * 0.6, pawnTilt: tilt, cut: 68 };
};

const FRONT_VIEW: RiderViewDraft = {
  frame: [-8, -8, 116, 108],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: END_POSE,
  Back: FrontViewBack,
  Front: FrontViewFront,
};

const BACK_VIEW: RiderViewDraft = {
  frame: [-8, -8, 116, 108],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: END_POSE,
  Back: BackViewBack,
  Front: BackViewFront,
};

export const sawyerDozer: RiderDraft = {
  id: "sawyer-dozer",
  name: "Sawyer's Dozer",
  tier: "mythic",
  description: "Pushes dirt, pushes luck, never pushes the brake. Hard hat not included.",
  frame: [-12, -8, 124, 108],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: (anim, f) => {
    if (anim === "idle") {
      const dy = [0, -0.6, 0, -0.5, 0, -0.6][f] ?? 0;
      const py = [0, -0.4, 0.2, -0.3, 0.2, -0.4][f] ?? 0;
      return { dx: 0, dy, pawnX: -12, pawnY: -14 + py, cut: 68 };
    }
    const dy = [0, -0.8, -0.3, 0, -0.8, -0.3, 0, -0.5][f] ?? 0;
    const tilt = [0, -1.5, -2, -1, 0, 1, 1.5, 0.5][f] ?? 0;
    return { dx: 12.5 * f, dy, pawnX: -12, pawnY: -14 - (f % 2) * 0.6, pawnTilt: tilt, cut: 68 };
  },
  Back,
  Front,
  views: { front: FRONT_VIEW, back: BACK_VIEW },
  trail: { ms: [240, 240, 240], w: 34, h: 16, Mark: TreadMark },
};

const TREAD = "#4a2f1a";
const TREAD_L = "#a07a52";

/** Two bands of cleat prints, pressed into the floor, fading and breaking up. */
function TreadMark({ f, view }: { f: number; view: string }) {
  const op = [0.95, 0.6, 0.35][f] ?? 0;
  const side = view === "side";
  const cleats: string[] = [];
  const bands: string[] = [];
  if (side) {
    for (const by of [-4.5, 4.5]) {
      bands.push(`M-16 ${by - 2.6} H16 V${by + 2.6} H-16 Z`);
      for (let i = 0; i < 9; i++) {
        if (f === 2 && (i + (by > 0 ? 1 : 0)) % 3 === 0) continue;
        const x = -14 + i * 3.5;
        cleats.push(`M${x} ${by - 2} V${by + 2}`);
      }
    }
  } else {
    for (const bx of [-6, 6]) {
      bands.push(`M${bx - 3.4} -7 H${bx + 3.4} V7 H${bx - 3.4} Z`);
      for (let i = 0; i < 5; i++) {
        if (f === 2 && (i + (bx > 0 ? 1 : 0)) % 3 === 0) continue;
        const y = -6 + i * 3;
        cleats.push(`M${bx - 2.6} ${y} H${bx + 2.6}`);
      }
    }
  }
  return (
    <g opacity={op}>
      {bands.map((d) => (
        <path d={d} fill={TREAD} fill-opacity={f === 2 ? 0.12 : 0.22} stroke={TREAD_L} stroke-opacity="0.5" {...lw(0.8)} />
      ))}
      {cleats.map((d) => (
        <path d={d} stroke={TREAD} stroke-linecap="round" {...lw(1.9)} />
      ))}
    </g>
  );
}
