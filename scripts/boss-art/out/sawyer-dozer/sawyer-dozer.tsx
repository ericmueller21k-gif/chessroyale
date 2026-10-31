import { Region, LINE, lw, type RiderDraft, type RiderProps } from "../../item-kit.tsx";

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
      {(sets[f] ?? []).map(([x, y, r]) => (
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
};
