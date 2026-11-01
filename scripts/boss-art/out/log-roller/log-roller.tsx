import type { RiderDraft, RiderProps, RiderViewDraft } from "../../item-kit.tsx";
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

/* ---------- Front and back: the log seen lengthwise ---------- */
/** The end faces' middles (left, right), their half-width, and the log's height on the picture: top 35 (as the side's strip), bottom 96. */
const VL = 20;
const VR = 80;
const VRX = 7;
const VCY = 65.5;
const VRY = 30.5;
/** Where a point of the bark at ψ shows (ψ 0: the top edge seen against the sky, 90: facing the camera, 180: the bottom). */
const yv = (psi: number) => f1(VCY - VRY * Math.cos((psi * Math.PI) / 180));
const sn = (psi: number) => Math.sin((psi * Math.PI) / 180);
const norm = (d: number) => ((d % 360) + 360) % 360;
/** The roll seen from the front (rolling toward us) or the back (rolling away). */
const rollOf = (view: "front" | "back", anim: "idle" | "move", f: number) => (view === "back" ? -1 : 1) * angle(anim, f);
const BAND_HW = (Math.asin(6.5 / R) * 180) / Math.PI;
const GRAIN: [number, number, number][] = [
  [10, 28, 10], [55, 50, 13], [100, 31, 9], [145, 60, 12], [190, 40, 11], [235, 63, 10],
  [280, 29, 11], [325, 54, 13], [170, 26, 8], [35, 68, 7], [260, 47, 9], [80, 62, 9],
  [120, 46, 8], [300, 66, 7], [215, 27, 7], [20, 44, 8],
];

/** The band along the bark, between the end faces' inner edges, from ψ1 to ψ2 (both on the seen side). */
function bodyBand(p1: number, p2: number): string {
  const s1 = sn(p1);
  const s2 = sn(p2);
  const y1 = yv(p1);
  const y2 = yv(p2);
  return `M ${f1(VL + VRX * s1)} ${y1} L ${f1(VR - VRX * s1)} ${y1} A ${VRX} ${VRY} 0 0 0 ${f1(VR - VRX * s2)} ${y2} L ${f1(VL + VRX * s2)} ${y2} A ${VRX} ${VRY} 0 0 0 ${f1(VL + VRX * s1)} ${y1} Z`;
}

/** The band across an end face (as the side's stripe), squeezed into the narrow ellipse; s +1 the right end, −1 the left. */
function faceBand(ex: number, s: number, psi: number): string {
  const w = 6.5;
  const sx = Math.sqrt(R * R - w * w);
  const r = (psi * Math.PI) / 180;
  const u = [Math.sin(r), -Math.cos(r)];
  const n = [Math.cos(r), Math.sin(r)];
  const P = (a: number, b: number) => `${f1(ex + (s * VRX * (a * u[0] + b * n[0])) / R)} ${f1(VCY + (VRY * (a * u[1] + b * n[1])) / R)}`;
  const sw = s > 0 ? 1 : 0;
  return `M ${P(-sx, -w)} L ${P(sx, -w)} A ${VRX} ${VRY} 0 0 ${sw} ${P(sx, w)} L ${P(-sx, w)} A ${VRX} ${VRY} 0 0 ${sw} ${P(-sx, -w)} Z`;
}

function EndFace({ ex }: { ex: number }) {
  const k = (r: number) => ({ rx: f1((VRX * r) / R), ry: f1((VRY * r) / R) });
  return (
    <g>
      <ellipse cx={ex} cy={VCY} rx={VRX} ry={VRY} fill={BARK} {...LINE} />
      <ellipse cx={ex} cy={VCY} {...k(R - 5)} fill={WOOD} stroke="#1d1d1f" {...lw(1.6)} />
      <ellipse cx={ex} cy={VCY - 0.5} {...k(15)} fill="none" stroke={RING} {...lw(1.6)} />
      <ellipse cx={ex} cy={VCY - 1} {...k(8)} fill="none" stroke={RING} {...lw(1.4)} />
      <circle cx={ex} cy={VCY - 1} r={1.3} fill="#8a5a2b" />
    </g>
  );
}

/** The branch stub on the bark at ψ, x along the log. Drawn behind the log when it's round the back. */
function Stub({ psi, x }: { psi: number; x: number }) {
  const yb = yv(psi);
  const c = Math.cos((psi * Math.PI) / 180);
  const s = sn(psi);
  const len = c < -0.05 ? Math.min(9, Math.max(0, (97 - yb) / -c)) : 9;
  const yt = f1(yb - len * c);
  return (
    <g>
      <path d={`M ${x - 5.5} ${yb} L ${x - 4.5} ${yt} L ${x + 4.5} ${yt} L ${x + 5.5} ${yb} Z`} fill={BARK} {...LINE} {...lw(2.4)} />
      <ellipse cx={x} cy={yt} rx={4.5} ry={f1(Math.max(1, 4.5 * Math.abs(s)))} fill={s > 0 ? WOOD : BARK} stroke="#1d1d1f" {...lw(1.6)} />
      {s > 0.3 && <circle cx={x} cy={yt} r={1} fill={RING} />}
    </g>
  );
}

function Puffs({ f, y, spread }: { f: number; y: number; spread: number }) {
  const pf = f % 4;
  return (
    <g fill="#c9a06a" stroke="#1d1d1f" {...lw(1.4)}>
      {[-1, 1].map((d) => (
        <g key={d}>
          <circle cx={f1(50 + d * (spread + pf * 1.8))} cy={f1(y - pf * 1.3)} r={f1(2.4 + pf * 0.5)} opacity={f1(1 - pf * 0.2)} />
          <circle cx={f1(50 + d * (spread - 4 + pf * 1.2))} cy={f1(y + 2 - pf * 0.8)} r={f1(1.6 + (pf % 2) * 0.5)} opacity={f1(1 - pf * 0.15)} />
        </g>
      ))}
    </g>
  );
}

function ViewLog({ p, anim, f, view }: RiderProps) {
  const v = view === "back" ? "back" : "front";
  const a = rollOf(v, anim, f);
  const band = norm(120 + a);
  const stubPsi = norm(v === "back" ? 85 - angle(anim, f) : angle(anim, f) - 25);
  const stubX = v === "back" ? 33 : 67;
  const stubSeen = stubPsi > 3 && stubPsi < 177;
  const stubPeek = stubPsi > 300;
  const bands: string[] = [];
  for (const c of [band, band + 180]) {
    for (const off of [-360, 0, 360]) {
      const lo = Math.max(1, c + off - BAND_HW);
      const hi = Math.min(179, c + off + BAND_HW);
      if (hi > lo) bands.push(bodyBand(lo, hi));
    }
  }
  bands.push(faceBand(VL, -1, band), faceBand(VR, 1, band));
  return (
    <g>
      <ellipse cx={50} cy={96} rx={38} ry={3.5} fill="#000" opacity="0.22" />
      {stubPeek && <Stub psi={stubPsi - 360} x={stubX} />}
      <rect x={VL} y={VCY - VRY} width={VR - VL} height={VRY * 2} fill={BARK} {...LINE} />
      <path d={`M ${VL} ${yv(140)} L ${VR} ${yv(140)} L ${VR} ${VCY + VRY} L ${VL} ${VCY + VRY} Z`} fill={BARK_DARK} opacity="0.35" />
      <path d={`M ${VL + 9} ${yv(48)} L ${VR - 9} ${yv(48)}`} stroke={BARK_LIGHT} {...lw(2)} stroke-linecap="round" />
      {GRAIN.map(([g, x, len]) => {
        const psi = norm(g + a);
        if (sn(psi) < 0.25) return null;
        return <path key={g} d={`M ${x} ${yv(psi)} l ${len} 0`} stroke={BARK_DARK} {...lw(1.6)} stroke-linecap="round" />;
      })}
      <EndFace ex={VL} />
      <EndFace ex={VR} />
      <Region p={p} name="log-band" d={bands} line={2.4} />
      {stubSeen && <Stub psi={stubPsi} x={stubX} />}
    </g>
  );
}

function ViewLogFront({ f, anim, view }: RiderProps) {
  return <g>{anim === "move" && view === "back" && <Puffs f={f} y={95} spread={36} />}</g>;
}

function viewDraft(view: "front" | "back"): RiderViewDraft {
  const toward = view === "front" ? 1 : -1;
  return {
    frame: [10, PY + 20 - 2, 80, 100 - (PY + 20 - 2)],
    idle: { ms: [420, 110, 110, 110, 150, 120, 120, 120, 150, 180] },
    move: { ms: Array(MOVE_N).fill(85) },
    pose(anim, f) {
      if (anim === "idle") {
        const a = IDLE_ROCK[f % IDLE_ROCK.length];
        return { dx: 0, dy: f1(((R * a * Math.PI) / 180) * 0.5 * toward), pawnX: 0, pawnY: PY, pawnTilt: f1(IDLE_TILT[f % IDLE_TILT.length] * 0.5), cut: 87 };
      }
      const k = f % MOVE_N;
      return { dx: 0, dy: MOVE_BUMP[k], pawnX: MOVE_X[k], pawnY: PY + MOVE_LIFT[k], pawnTilt: MOVE_TILT[k], cut: 87 };
    },
    Back: ViewLog,
    Front: ViewLogFront,
  };
}

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
  views: { front: viewDraft("front"), back: viewDraft("back") },
};
