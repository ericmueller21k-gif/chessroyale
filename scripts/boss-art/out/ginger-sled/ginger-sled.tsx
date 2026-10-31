import { Region, LINE, lw, type RiderDraft, type RiderProps } from "../../item-kit.tsx";

const INK = "#1d1d1f";
const ICING = "#fbfbf8";
const CANE_RED = "#e0303a";

/* ---------- motion tables ---------- */
const IDLE_MS = [220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220];
const IDLE_DY = [0, 0, 0.3, 0.6, 0.6, 0.3, 0, 0, 0, 0, 0, 0];
const IDLE_PY = [0, 0, 0.2, 0.6, 0.9, 0.7, 0.3, 0, 0, 0, 0, 0];

const MOVE_MS = [70, 70, 70, 70, 70, 70, 70, 80, 90, 100, 110, 110];
const MOVE_DX = [0, 4, 12, 24, 38, 54, 69, 82, 92, 98, 101, 100];
const MOVE_TILT = [0, -4, -7, -6, -4, -3, -2, 0, 3, 8, 9, 3];
const MOVE_PY = [0, 0.4, 0.2, 0, 0.3, 0, 0.3, 0, 0, -0.4, -0.6, 0];

/* ---------- shapes ---------- */
// near side panel: a low backrest at the rear (left), the rail at y 58, a rounded nose at the front (right)
const PANEL =
  "M8 47 Q8 39 15 39 Q22 39 22 47 L22 58 L84 58 Q94 58 94 67 L92 75 Q90 82 82 82 L16 82 Q8 82 8 74 Z";
const LEGS = ["M24 80 L31 80 L31 90 L24 90 Z", "M66 80 L73 80 L73 90 L66 90 Z"];
// runner: a candy cane laid down, its hook curling up at the front
const RUNNER = "M7 92 L82 92 C96 92 102 82 100 74 C98 66 88 66 88 73";

const scallops = (x0: number, x1: number, y: number, step = 5, depth = 2.6) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x + step <= x1 + 0.01; x += step) d += ` q${step / 2} ${depth} ${step} 0`;
  return d;
};
const ICING_PATHS = [
  scallops(24, 84, 62),
  scallops(14, 84, 78),
  "M11 47 Q11 42.5 15 42.5 Q19 42.5 19 47 L19 60",
];

function Icing({ d }: { d: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} stroke-linecap="round" stroke-linejoin="round" {...lw(4.8)} />
      <path d={d} fill="none" stroke={ICING} stroke-linecap="round" stroke-linejoin="round" {...lw(2.2)} />
    </g>
  );
}

function Cane({ d, dim }: { d: string; dim?: boolean }) {
  return (
    <g>
      <path d={d} fill="none" stroke={INK} stroke-linecap="round" stroke-linejoin="round" style="stroke-width: calc(6px + var(--sw, 1) * 3px)" />
      <path d={d} fill="none" stroke={dim ? "#ddd6cc" : ICING} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d={d} fill="none" stroke={dim ? "#a9242d" : CANE_RED} stroke-width="6" stroke-dasharray="3.4 4.2" stroke-dashoffset="2" />
    </g>
  );
}

function Gumdrop({ x, y, c, hi }: { x: number; y: number; c: string; hi: string }) {
  const d = `M${x - 4.6} ${y} Q${x - 4.8} ${y - 7.4} ${x} ${y - 7.6} Q${x + 4.8} ${y - 7.4} ${x + 4.6} ${y} Q${x} ${y + 1.4} ${x - 4.6} ${y} Z`;
  return (
    <g>
      <path d={d} fill={c} {...LINE} {...lw(2)} />
      <path d={`M${x - 2.2} ${y - 4.6} Q${x - 1.6} ${y - 6} ${x} ${y - 6.2}`} fill="none" stroke={hi} stroke-linecap="round" {...lw(1.4)} />
      <circle cx={x + 1.8} cy={y - 2.2} r="0.55" fill="#fff" opacity="0.8" />
      <circle cx={x - 1.2} cy={y - 1.6} r="0.5" fill="#fff" opacity="0.7" />
    </g>
  );
}

const star = (x: number, y: number, s: number) => {
  const k = s * 0.28;
  return `M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`;
};

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={s * 0.9} fill="#bfe9ff" opacity="0.45" />
      <path d={star(x, y, s)} fill="#ffffff" stroke={INK} stroke-linejoin="round" {...lw(1.3)} />
    </g>
  );
}

function Snowflake({ x, y, r, rot }: { x: number; y: number; r: number; rot: number }) {
  let d = "";
  for (let i = 0; i < 3; i++) {
    const a = ((rot + i * 60) * Math.PI) / 180;
    const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
    d += `M${(x - cx).toFixed(2)} ${(y - cy).toFixed(2)} L${(x + cx).toFixed(2)} ${(y + cy).toFixed(2)} `;
  }
  return (
    <g>
      <path d={d} fill="none" stroke={INK} stroke-linecap="round" {...lw(3)} />
      <path d={d} fill="none" stroke="#f4fbff" stroke-linecap="round" {...lw(1.3)} />
    </g>
  );
}

/* ---------- the drawings ---------- */
function Back({ anim, f }: RiderProps) {
  const puffs = [];
  if (anim === "move") {
    // a puff kicked up behind each frame while sliding; it stays where it was kicked (in the world)
    for (let k = 1; k <= 8; k++) {
      const age = f - k;
      if (age < 0 || age > 2) continue;
      const x = 6 - (MOVE_DX[f] - MOVE_DX[k]) - age * 2;
      const r = 3 + age * 2.2;
      puffs.push(
        <g key={k} opacity={age === 2 ? 0.75 : 1}>
          <circle cx={x} cy={90 - age * 3} r={r} fill="#fff" stroke={INK} {...lw(1.6)} />
          <circle cx={x - r * 0.9} cy={92 - age * 2} r={r * 0.65} fill="#fff" stroke={INK} {...lw(1.6)} />
        </g>,
      );
    }
  }
  return (
    <g>
      {/* the far runner and its legs, a step up and back */}
      <g transform="translate(-3 -3)">
        <path d={LEGS[0]} fill="#7a4a24" {...LINE} {...lw(2)} />
        <path d={LEGS[1]} fill="#7a4a24" {...LINE} {...lw(2)} />
        <Cane d={RUNNER} dim />
      </g>
      {puffs}
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const sparkle =
    anim === "idle"
      ? f === 3
        ? { x: 42, y: 62, s: 6 }
        : f === 4
          ? { x: 42, y: 62, s: 2.8 }
          : f === 7
            ? { x: 15, y: 42.5, s: 5.4 }
            : f === 8
              ? { x: 15, y: 42.5, s: 2.4 }
              : null
      : null;
  const flake =
    anim === "idle"
      ? { x: 90 + Math.sin(f * 0.8) * 4 - f * 0.3, y: -4 + f * 5.5, r: f >= 11 ? 2.2 : 3.2, rot: f * 15 }
      : null;
  const spray = anim === "move" && (f === 9 || f === 10);
  return (
    <g>
      <Region p={p} name="legs" d={LEGS} line={2} />
      <Region
        p={p}
        name="panel"
        d={[PANEL]}
        over={
          <g>
            <path d="M10 60 L92 60 L92 66 L10 66 Z" fill="#fff" opacity="0.14" />
            <path d="M10 76 L92 76 L92 84 L10 84 Z" fill="#000" opacity="0.12" />
          </g>
        }
      />
      {ICING_PATHS.map((d) => (
        <Icing key={d} d={d} />
      ))}
      {/* icing dots on the panel face */}
      {[36, 54, 72].map((x) => (
        <circle key={x} cx={x} cy={70.5} r="1.7" fill={ICING} stroke={INK} {...lw(1.2)} />
      ))}
      <Gumdrop x={33} y={58.5} c="#e0303a" hi="#ff8a8f" />
      <Gumdrop x={52} y={58.5} c="#35a24a" hi="#8fe39b" />
      <Gumdrop x={71} y={58.5} c="#e0303a" hi="#ff8a8f" />
      <Cane d={RUNNER} />
      {sparkle && <Sparkle {...sparkle} />}
      {flake && <Snowflake {...flake} />}
      {spray && (
        <g opacity={f === 9 ? 1 : 0.7}>
          <circle cx={f === 9 ? 101 : 103} cy={f === 9 ? 90 : 87} r={f === 9 ? 2.6 : 3.4} fill="#fff" stroke={INK} {...lw(1.4)} />
          <circle cx={f === 9 ? 97 : 99} cy={f === 9 ? 86 : 83} r={f === 9 ? 1.8 : 2.4} fill="#fff" stroke={INK} {...lw(1.4)} />
        </g>
      )}
    </g>
  );
}

export const gingerSled: RiderDraft = {
  id: "ginger-sled",
  name: "Candy Cane Sled",
  tier: "mythic",
  description: "Gingerbread hull, candy-cane runners. Steering is optional; nibbling the gumdrops is not.",
  frame: [0, 10, 106, 90],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  pose: (anim, f) =>
    anim === "idle"
      ? { dx: 0, dy: IDLE_DY[f] ?? 0, pawnX: 3, pawnY: -4 + (IDLE_PY[f] ?? 0), cut: 66 }
      : { dx: MOVE_DX[f] ?? 0, dy: 0, pawnX: 3, pawnY: -4 + (MOVE_PY[f] ?? 0), pawnTilt: MOVE_TILT[f] ?? 0, cut: 66 },
  Back,
  Front,
};
