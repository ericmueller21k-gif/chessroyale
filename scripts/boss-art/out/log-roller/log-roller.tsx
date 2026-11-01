import type { RiderDraft, RiderProps } from "../../item-kit.tsx";
import { Region, LINE, lw } from "../../item-kit.tsx";

/** The log's round end, its middle and radius, and how far the far end shows above it (the camera looks down). */
const CX = 50;
const CY = 69;
const R = 27;
const D = 7;
/** The pawn's base: on the top of the bark, halfway back, sunk a hair. */
const BASE_Y = CY - R - D / 2 + 1;
const PY = BASE_Y - 88;

const BARK = "#74451f";
const BARK_DARK = "#4f2c12";
const BARK_LIGHT = "#9a6534";
const WOOD = "#efc283";
const RING = "#c08a4e";

/** Each frame's roll of the log, in degrees (clockwise: rolling right). */
const IDLE_ROCK = [0, 0, 3, 6, 7, 5, 1, -3, -4, -2];
const IDLE_TILT = [0, 0, -2, -5, -8, -6, -1, 3, 4, 1];
const MOVE_N = 8;
const angle = (anim: "idle" | "move", f: number) => (anim === "idle" ? IDLE_ROCK[f % IDLE_ROCK.length] : (360 / MOVE_N) * (f % MOVE_N));

const f1 = (n: number) => Number(n.toFixed(2));
/** A point on the log's end, at local (x, y), turned by a degrees. */
function pt(a: number, x: number, y: number): string {
  const r = (a * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return `${f1(CX + x * c - y * s)} ${f1(CY + x * s + y * c)}`;
}

function stripePath(a: number): string {
  const w = 6.5;
  const sx = Math.sqrt(R * R - w * w);
  return `M ${pt(a, -sx, -w)} L ${pt(a, sx, -w)} A ${R} ${R} 0 0 1 ${pt(a, sx, w)} L ${pt(a, -sx, w)} A ${R} ${R} 0 0 1 ${pt(a, -sx, -w)} Z`;
}

function LogBack({ anim, f }: RiderProps) {
  const a = angle(anim, f);
  // grain on the top of the bark, running back: it slides as the log turns
  const grain: number[] = [];
  for (let k = 0; k < 8; k++) {
    const phi = ((k * 45 + a + 20) * Math.PI) / 180;
    if (Math.cos(phi) > 0.35) grain.push(CX + R * Math.sin(phi));
  }
  const puff = anim === "move";
  const pf = f % 4;
  return (
    <g>
      <ellipse cx={CX} cy={96} rx={24} ry={3.5} fill="#000" opacity="0.22" />
      {puff && (
        <g fill="#c9a06a" stroke="#1d1d1f" {...lw(1.4)}>
          <circle cx={CX - R - 2 - pf * 2} cy={93 - pf * 1.5} r={2.6 + pf * 0.6} opacity={1 - pf * 0.2} />
          <circle cx={CX - R + 3 - pf * 1.5} cy={95 - pf} r={1.8 + (pf % 2) * 0.6} opacity={1 - pf * 0.15} />
        </g>
      )}
      <path d={`M ${CX - R} ${CY} L ${CX - R} ${CY - D} A ${R} ${R} 0 0 1 ${CX + R} ${CY - D} L ${CX + R} ${CY} Z`} fill={BARK} {...LINE} />
      {grain.map((x) => (
        <path key={x} d={`M ${f1(x)} ${f1(CY - D - Math.sqrt(Math.max(0, R * R - (x - CX) ** 2)) + 1.5)} l 0 ${D - 2}`} stroke={BARK_DARK} {...lw(1.4)} stroke-linecap="round" />
      ))}
    </g>
  );
}

function LogFront({ p, anim, f }: RiderProps) {
  const a = angle(anim, f);
  // the branch stub, out from the bark
  const b = a + 215;
  const stub = `M ${pt(b, R - 3, -5.5)} L ${pt(b, R + 6, -4.5)} L ${pt(b, R + 6, 4.5)} L ${pt(b, R - 3, 5.5)} Z`;
  const ticks = [20, 75, 130, 170, 260, 310];
  const ox = 2.2;
  const oy = -1.4;
  return (
    <g>
      <path d={stub} fill={BARK} {...LINE} {...lw(2.4)} />
      <ellipse cx={0} cy={0} rx={2.6} ry={4.5} fill={WOOD} stroke="#1d1d1f" {...lw(1.6)} transform={`translate(${pt(b, R + 6, 0).replace(" ", ",")}) rotate(${b})`} />
      <circle cx={CX} cy={CY} r={R} fill={BARK} {...LINE} />
      {ticks.map((t) => (
        <path key={t} d={`M ${pt(a + t, R - 0.5, 0)} L ${pt(a + t, R - 4, 0)}`} stroke={BARK_DARK} {...lw(1.6)} stroke-linecap="round" />
      ))}
      <path d={`M ${CX - R + 3} ${CY - 6} A ${R - 3} ${R - 3} 0 0 1 ${CX - 6} ${CY - R + 3}`} fill="none" stroke={BARK_LIGHT} {...lw(2)} stroke-linecap="round" />
      <circle cx={CX} cy={CY} r={R - 5} fill={WOOD} stroke="#1d1d1f" {...lw(1.6)} />
      <g fill="none" stroke={RING} {...lw(1.6)}>
        <circle cx={f1(Number(pt(a, ox * 0.3, oy * 0.3).split(" ")[0]))} cy={f1(Number(pt(a, ox * 0.3, oy * 0.3).split(" ")[1]))} r={16.5} />
        <circle cx={f1(Number(pt(a, ox * 0.6, oy * 0.6).split(" ")[0]))} cy={f1(Number(pt(a, ox * 0.6, oy * 0.6).split(" ")[1]))} r={11} />
        <circle cx={f1(Number(pt(a, ox, oy).split(" ")[0]))} cy={f1(Number(pt(a, ox, oy).split(" ")[1]))} r={6} />
      </g>
      <path d={`M ${CX - R + 9} ${CY - 4} A ${R - 9} ${R - 9} 0 0 1 ${CX - 4} ${CY - R + 9}`} fill="none" stroke="#fbe2b6" {...lw(2)} stroke-linecap="round" />
      <Region p={p} name="log-band" d={[stripePath(a)]} line={2.4} />
      {/* the crack from the heart out to the bark */}
      <path d={`M ${pt(a, ox + 1, oy + 2)} L ${pt(a, ox + 5, oy + 7)} L ${pt(a, ox + 9, oy + 9)} L ${pt(a, ox + 13, oy + 16)}`} fill="none" stroke="#1d1d1f" {...lw(1.6)} stroke-linecap="round" stroke-linejoin="round" />
      <circle cx={f1(Number(pt(a, ox, oy).split(" ")[0]))} cy={f1(Number(pt(a, ox, oy).split(" ")[1]))} r={1.6} fill="#8a5a2b" />
    </g>
  );
}

/** The log hops a hair over its own branch stub. */
const MOVE_BUMP = [0, 0, 0, 0, -1, -4, -1, 0];
const MOVE_LIFT = [0, -2.5, -1, 0, 0, -2.5, -1, 0];
const MOVE_TILT = [-3, 2, 5, 2, 3, -2, -5, -2];
const MOVE_X = [0, 1, 1.5, 0.5, 0, -1, -1.5, -0.5];

export const logRoller: RiderDraft = {
  id: "log-roller",
  name: "The Log Roller",
  tier: "mythic",
  description: "Timber's favorite commute. Keep your feet moving and never, ever look down.",
  frame: [24, PY + 20 - 2, 52, 100 - (PY + 20 - 2)],
  idle: { ms: [420, 110, 110, 110, 150, 120, 120, 120, 150, 180] },
  move: { ms: Array(MOVE_N).fill(85) },
  pose(anim, f) {
    if (anim === "idle") {
      const a = IDLE_ROCK[f % IDLE_ROCK.length];
      return { dx: f1((R * a * Math.PI) / 180), dy: 0, pawnX: 0, pawnY: PY, pawnTilt: IDLE_TILT[f % IDLE_TILT.length], cut: 87 };
    }
    const k = f % MOVE_N;
    return { dx: (100 / MOVE_N) * k, dy: MOVE_BUMP[k], pawnX: MOVE_X[k], pawnY: PY + MOVE_LIFT[k], pawnTilt: MOVE_TILT[k], cut: 87 };
  },
  Back: LogBack,
  Front: LogFront,
};
