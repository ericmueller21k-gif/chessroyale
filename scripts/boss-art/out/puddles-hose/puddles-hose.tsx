import { Region, LINE, lw, type ItemDraft, type ArtProps } from "../../item-kit.tsx";

const ring = (cx: number, cy: number, R: number, Ry: number, r: number, ry: number) =>
  `M${cx - R} ${cy} a${R} ${Ry} 0 1 0 ${2 * R} 0 a${R} ${Ry} 0 1 0 ${-2 * R} 0 Z ` +
  `M${cx - r} ${cy} a${r} ${ry} 0 1 1 ${2 * r} 0 a${r} ${ry} 0 1 1 ${-2 * r} 0 Z`;

const BRASS = "#e0b040";
const BRASS_D = "#9a6e18";
const WATER = "#6cc4f2";

// nozzle: base at the hose end, pointing up and to the right
const NX = 87;
const NY = 47;
const NA = -76; // degrees
const TIP = 15; // nozzle length along its axis

function Art({ p, f }: ArtProps) {
  const a = (NA * Math.PI) / 180;
  const tx = NX + Math.cos(a) * TIP;
  const ty = NY + Math.sin(a) * TIP;
  const drops: { x: number; y: number; r: number; o: number }[] = [];
  if (f > 0) {
    for (let i = 0; i < 4; i++) {
      const s = (f - 1 - i * 0.8) / 3.8;
      if (s < 0 || s > 1) continue;
      const vx = 9;
      const vy = -22;
      const g = 40;
      drops.push({
        x: tx + vx * s,
        y: ty + vy * s + 0.5 * g * s * s,
        r: [3.6, 3, 2.6, 2.1][i] * (1 - 0.2 * s),
        o: s < 0.6 ? 1 : 1 - (s - 0.6) / 0.45,
      });
    }
  }
  const burst = f === 1 || f === 2;
  return (
    <g transform="translate(-6 1)">
      {/* back loop */}
      <Region
        p={p}
        name="loopback"
        d={[ring(84, 71, 13.4, 12.4, 8, 7.2)]}
        over={<rect x="60" y="50" width="45" height="40" fill="#000" opacity="0.18" />}
      />
      {/* front loop */}
      <Region
        p={p}
        name="loopfront"
        d={[ring(76, 67, 14, 13, 8.6, 7.8)]}
        over={
          <path d="M65.6 62 Q68 56.4 74 55.4" fill="none" stroke="#fff" opacity="0.5" stroke-linecap="round" {...lw(1.6)} />
        }
      />
      {/* the hanging end with its coupling */}
      <path d="M67 77 Q63 82 64 87" fill="none" {...LINE} {...lw(8)} />
      <path d="M67 77 Q63 82 64 87" fill="none" stroke={p.fill} stroke-linecap="round" {...lw(5)} />
      <rect x="60.6" y="86" width="7" height="4.6" rx="1" fill={BRASS} {...LINE} {...lw(1.6)} />
      {/* the end rising to the nozzle */}
      <path d="M79 54.4 Q85 53 87 47" fill="none" {...LINE} {...lw(8)} />
      <path d="M79 54.4 Q85 53 87 47" fill="none" stroke={p.fill} stroke-linecap="round" {...lw(5)} />
      {/* nozzle */}
      <g transform={`translate(${NX} ${NY}) rotate(${NA})`}>
        <rect x="-1" y="-3.8" width="5.4" height="7.6" rx="1" fill={BRASS} {...LINE} {...lw(1.6)} />
        <path d="M4 -3 L12.6 -2 L12.6 2 L4 3 Z" fill={BRASS} {...LINE} {...lw(1.6)} />
        <rect x="12" y="-2.8" width="3.2" height="5.6" rx="0.8" fill={BRASS} {...LINE} {...lw(1.6)} />
        <path d="M5 -1.4 L11.6 -0.9" stroke="#fff6c8" opacity="0.8" stroke-linecap="round" {...lw(1)} />
        <path d="M1.6 -3.8 V3.8" stroke={BRASS_D} {...lw(0.9)} />
      </g>
      {/* water */}
      {burst && (
        <g transform={`translate(${tx} ${ty}) rotate(${NA + 8})`}>
          <path
            d={f === 1 ? "M0 -2.4 Q7 -2.6 10 0 Q7 2.6 0 2.4 Z" : "M3 -1.8 Q8 -2 10 0 Q8 2 3 1.8 Z"}
            fill={WATER}
            stroke="#1d1d1f"
            stroke-linejoin="round"
            {...lw(1.2)}
          />
          <path d="M2 -0.8 L6.5 -1" stroke="#fff" opacity="0.85" stroke-linecap="round" {...lw(0.9)} />
        </g>
      )}
      {drops.map((d, i) => (
        <g key={i} opacity={d.o}>
          <path
            d={`M${d.x} ${d.y - d.r * 1.5} Q${d.x + d.r} ${d.y - 0.2} ${d.x} ${d.y + d.r} Q${d.x - d.r} ${d.y - 0.2} ${d.x} ${d.y - d.r * 1.5} Z`}
            fill={WATER}
            stroke="#1d1d1f"
            stroke-linejoin="round"
            {...lw(1.2)}
          />
          <circle cx={d.x - d.r * 0.3} cy={d.y - d.r * 0.1} r={d.r * 0.3} fill="#fff" opacity="0.85" />
        </g>
      ))}
    </g>
  );
}

export const puddlesHose: ItemDraft = {
  id: "puddles-hose",
  name: "Puddles' Hose",
  tier: "rare",
  slot: "weapon",
  description: "A garden hose, neatly coiled. Every squirt is a warning shot for the weeds.",
  frame: [51, 19, 50, 74],
  motion: { ms: [2600, 110, 110, 110, 110, 110, 110, 120] },
  Art,
};
