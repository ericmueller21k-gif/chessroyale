import { Region, LINE, lw, lighten } from "../../item-kit.tsx";
import type { RiderDraft, RiderProps, RiderPose, RiderViewDraft } from "../../item-kit.tsx";

/* Hollow's Bulb: a fat vintage Christmas bulb lying on its side, floating, its cord curled behind like a tail. */

const TAU = Math.PI * 2;
const IDLE_N = 8;
const MOVE_N = 8;

const PAWN_X = 10;
const PAWN_Y = -24;
const CUT = 74;

function bob(anim: "idle" | "move", f: number): number {
  const n = anim === "idle" ? IDLE_N : MOVE_N;
  const amp = anim === "idle" ? 1.5 : 2.25;
  return -amp + amp * Math.cos((TAU * f) / n);
}

function pose(anim: "idle" | "move", f: number): RiderPose {
  const dy = bob(anim, f);
  if (anim === "idle") return { dx: 0, dy, pawnX: PAWN_X, pawnY: PAWN_Y, cut: CUT };
  return {
    dx: (100 * f) / MOVE_N,
    dy,
    pawnX: PAWN_X,
    pawnY: PAWN_Y,
    pawnTilt: 1.5 * Math.sin((TAU * f) / MOVE_N),
    cut: CUT,
  };
}

/** Glow strength 0..1 (idle: slow pulse dim to bright and back; move: a steady warm glow). */
function glow(anim: "idle" | "move", f: number): number {
  if (anim === "idle") return 0.5 - 0.5 * Math.cos((TAU * f) / IDLE_N);
  return 0.7 + 0.1 * Math.sin((TAU * f) / MOVE_N);
}

/** Cord swing (degrees round the cap's tip). */
function swing(anim: "idle" | "move", f: number): number {
  if (anim === "idle") return 4 * Math.sin((TAU * f) / IDLE_N - 1);
  // the bulb rises (f 0-4) and the cord lags low, then it sinks and the cord flicks up, catching up by the loop's end
  return -20 * Math.sin((TAU * f) / MOVE_N - 0.6) - 4;
}

const GLASS =
  "M 28 57 C 34 48 46 44 64 44 C 91 44 107 54 107 67 C 107 81 91 90 64 90 C 46 90 34 86 28 77 Z";
const COLLAR = "M 31 54.5 L 23 55.5 Q 21.5 67 23 78.5 L 31 79.5 Q 33 67 31 54.5 Z";
const SCREW =
  "M 23 57 Q 21 55 19 57.6 Q 17 55.6 15 58.2 Q 13 56.4 11 59 L 11 75 Q 13 77.6 15 75.8 Q 17 78.4 19 76.4 Q 21 79 23 77 Z";
const TIP = "M 11 61.5 L 7 62.5 Q 5 67 7 71.5 L 11 72.5 Z";
const CORD = "M 6 67 C 0 67 -3 74 -7.5 72 C -12 70 -11.5 59 -5 58.5 C 0 58 0.5 66 -3 70 C -6 74 -9 79 -6 84";

const SILVER = "#c4c9d1";
const SILVER_D = "#868d98";
const SILVER_L = "#eef1f5";
const WIRE = "#2f6a38";
const WIRE_L = "#5d9a5f";

function Back({ anim, f }: RiderProps) {
  const dy = bob(anim, f);
  const k = glow(anim, f);
  const lift = -dy; // how far above rest: the shadow stays on the ground
  const s = 1 - lift * 0.03;
  return (
    <g>
      {/* ground: a violet shadow and a warm glow */}
      <g transform={`translate(0 ${lift})`}>
        <ellipse cx={64} cy={96} rx={42 * s} ry={4.5 * s} fill="#ffe9a8" opacity={0.12 + 0.25 * k} />
        <ellipse cx={64} cy={96} rx={28 * s} ry={3 * s} fill="#2a1f3d" opacity={0.5} />
      </g>
      {/* cord: a dark green wire, one curl */}
      <g transform={`rotate(${swing(anim, f)} 6 67)`}>
        <path d={CORD} fill="none" stroke="#1d1d1f" stroke-linecap="round" stroke-linejoin="round" {...lw(7)} />
        <path d={CORD} fill="none" stroke={WIRE} stroke-linecap="round" stroke-linejoin="round" {...lw(3.6)} />
        <path d="M 2 66 C -1 67 -3 70 -6 70.5" fill="none" stroke={WIRE_L} stroke-linecap="round" {...lw(1.2)} />
      </g>
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const k = glow(anim, f);
  const gid = `${p.id}-bulbglow`;
  const core = "#fff6d2";
  const halo = lighten(p.hex, 0.6);
  const r = 17 + 8 * k;
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color={core} stop-opacity={0.55 + 0.45 * k} />
          <stop offset="0.3" stop-color={core} stop-opacity={0.25 + 0.6 * k} />
          <stop offset="0.65" stop-color={halo} stop-opacity={0.1 + 0.45 * k} />
          <stop offset="1" stop-color={halo} stop-opacity="0" />
        </radialGradient>
      </defs>
      {/* cap: ridged silver screw */}
      <path d={TIP} fill="#3a3a40" {...LINE} {...lw(2)} />
      <path d={SCREW} fill={SILVER} {...LINE} />
      <path d="M 15 59 Q 16.5 67 15 75" fill="none" stroke={SILVER_D} {...lw(1.6)} />
      <path d="M 19 58.5 Q 20.5 67 19 75.5" fill="none" stroke={SILVER_D} {...lw(1.6)} />
      <path d="M 12.5 61 L 21.5 61" fill="none" stroke={SILVER_L} stroke-linecap="round" {...lw(2)} />
      <Region p={p} name="glass" d={[GLASS]} />
      {/* the glow inside, over the glass (its clip) */}
      <g clip-path={`url(#${p.id}-glass)`}>
        <ellipse cx={68} cy={67} rx={r * 1.4} ry={r} fill={`url(#${gid})`} />
        <path d="M 30 63 L 54 64 M 30 71 L 54 70" fill="none" stroke="#3a3a40" stroke-opacity="0.5" {...lw(1.2)} />
        <path d="M 54 64 Q 57 61 59 64 Q 61 67 63 64 Q 65 61 67 64 Q 69 67 71 64 L 54 70"
          fill="none" stroke={k > 0.5 ? "#fff3b0" : "#ffcf5a"} stroke-linejoin="round" stroke-linecap="round" {...lw(1.5 + k * 0.8)} />
      </g>
      <path d={GLASS} fill="none" {...LINE} />
      {/* collar over the glass's neck */}
      <path d={COLLAR} fill={SILVER} {...LINE} />
      <path d="M 26 57.5 Q 25 67 26 76.5" fill="none" stroke={SILVER_L} stroke-linecap="round" {...lw(2)} />
      {/* glass highlights */}
      <path d="M 87 50 Q 98 54.5 100.5 64" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-linecap="round" {...lw(4)} />
      <circle cx={101.2} cy={70.5} r={1.7} fill="#fff" opacity="0.85" />
      <path d="M 40 83 Q 50 88 62 88.3" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

/* ---- front and back views: the bulb seen end-on ---- */

/** The glass seen end-on: the near dome below, the belly's broad top running back above it (the pawn's seat). */
const END_GLASS =
  "M 22.5 55 C 22.5 45 35 40 50 40 C 65 40 77.5 45 77.5 55 C 77.5 59.5 76 63 76 67 C 76 81 64 91 50 91 C 36 91 24 81 24 67 C 24 63 22.5 59.5 22.5 55 Z";

function endPose(anim: "idle" | "move", f: number): RiderPose {
  return {
    dx: 0,
    dy: bob(anim, f),
    pawnX: 0,
    pawnY: PAWN_Y,
    pawnTilt: anim === "move" ? 1 * Math.sin((TAU * f) / MOVE_N) : 0,
    cut: CUT,
  };
}

function EndGround({ anim, f }: RiderProps) {
  const dy = bob(anim, f);
  const k = glow(anim, f);
  const lift = -dy;
  const s = 1 - lift * 0.03;
  return (
    <g transform={`translate(0 ${lift})`}>
      <ellipse cx={50} cy={96} rx={32 * s} ry={4.5 * s} fill="#ffe9a8" opacity={0.12 + 0.25 * k} />
      <ellipse cx={50} cy={96} rx={21 * s} ry={3 * s} fill="#2a1f3d" opacity={0.5} />
    </g>
  );
}

function GlowDefs({ p, k, gid }: { p: RiderProps["p"]; k: number; gid: string }) {
  const core = "#fff6d2";
  const halo = lighten(p.hex, 0.6);
  return (
    <defs>
      <radialGradient id={gid} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color={core} stop-opacity={0.55 + 0.45 * k} />
        <stop offset="0.3" stop-color={core} stop-opacity={0.25 + 0.6 * k} />
        <stop offset="0.65" stop-color={halo} stop-opacity={0.1 + 0.45 * k} />
        <stop offset="1" stop-color={halo} stop-opacity="0" />
      </radialGradient>
    </defs>
  );
}

function FrontViewFront({ p, anim, f }: RiderProps) {
  const k = glow(anim, f);
  const gid = `${p.id}-bulbglow-f`;
  const r = 17 + 8 * k;
  return (
    <g>
      <GlowDefs p={p} k={k} gid={gid} />
      <Region p={p} name="glass" d={[END_GLASS]} />
      <g clip-path={`url(#${p.id}-glass)`}>
        <ellipse cx={50} cy={68} rx={r * 1.15} ry={r} fill={`url(#${gid})`} />
        <path d="M 30 58 Q 50 46 70 58" fill="none" stroke="#1d1d1f" stroke-opacity="0.16" stroke-linecap="round" {...lw(1.6)} />
        <path d="M 45.5 67 L 48 55 M 54.5 67 L 52 55" fill="none" stroke="#3a3a40" stroke-opacity="0.5" {...lw(1.2)} />
        <path d="M 44 67 Q 45.5 64 47 67 Q 48.5 70 50 67 Q 51.5 64 53 67 Q 54.5 70 56 67"
          fill="none" stroke={k > 0.5 ? "#fff3b0" : "#ffcf5a"} stroke-linejoin="round" stroke-linecap="round" {...lw(1.5 + k * 0.8)} />
      </g>
      <path d={END_GLASS} fill="none" {...LINE} />
      <path d="M 61 47 Q 71 50 73.5 58.5" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-linecap="round" {...lw(4)} />
      <circle cx={74} cy={64.5} r={1.7} fill="#fff" opacity="0.85" />
      <path d="M 35 83 Q 43 88.5 53 88.6" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-linecap="round" {...lw(2)} />
    </g>
  );
}

/** The cord from behind: it sways side to side round the cap's tip. */
function endSwing(anim: "idle" | "move", f: number): number {
  if (anim === "idle") return 4 * Math.sin((TAU * f) / IDLE_N - 1);
  return 12 * Math.sin((TAU * f) / MOVE_N - 0.6);
}

const END_CORD = "M 50 68 L 50 79 C 50 84 45 85 45 81.5 C 45 78 55 78 55 83 C 55 87.5 50.5 88 51 92";

function BackViewFront({ p, anim, f }: RiderProps) {
  const k = glow(anim, f);
  const gid = `${p.id}-bulbglow-b`;
  const r = 24 + 6 * k;
  return (
    <g>
      <GlowDefs p={p} k={k} gid={gid} />
      <Region p={p} name="glass" d={[END_GLASS]} />
      <g clip-path={`url(#${p.id}-glass)`}>
        <ellipse cx={50} cy={66} rx={r * 1.15} ry={r} fill={`url(#${gid})`} />
        <circle cx={50} cy={68} r={15} fill="none" stroke="#fff6d2" stroke-opacity={0.25 + 0.5 * k} {...lw(3)} />
      </g>
      <path d={END_GLASS} fill="none" {...LINE} />
      {/* cap: collar, ridged screw, dark tip */}
      <circle cx={50} cy={68} r={13} fill={SILVER} {...LINE} />
      <circle cx={50} cy={68} r={10} fill={SILVER} {...LINE} {...lw(2)} />
      <circle cx={50} cy={68} r={7.9} fill="none" stroke={SILVER_D} {...lw(1.6)} />
      <circle cx={50} cy={68} r={5.8} fill="none" stroke={SILVER_D} {...lw(1.6)} />
      <path d="M 39.2 65.5 Q 40.2 58.8 46.5 57.2" fill="none" stroke={SILVER_L} stroke-linecap="round" {...lw(2)} />
      <path d="M 43.6 65 Q 44.4 62 47.5 61" fill="none" stroke={SILVER_L} stroke-linecap="round" {...lw(1.4)} />
      <circle cx={50} cy={68} r={3.6} fill="#3a3a40" {...LINE} {...lw(2)} />
      {/* glass highlights */}
      <path d="M 62 46.5 Q 71 49 74 56.5" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-linecap="round" {...lw(3.5)} />
      <path d="M 35 83 Q 43 88.5 53 88.6" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-linecap="round" {...lw(2)} />
      {/* cord: hanging from the tip like a tail */}
      <g transform={`rotate(${endSwing(anim, f)} 50 68)`}>
        <path d={END_CORD} fill="none" stroke="#1d1d1f" stroke-linecap="round" stroke-linejoin="round" {...lw(7)} />
        <path d={END_CORD} fill="none" stroke={WIRE} stroke-linecap="round" stroke-linejoin="round" {...lw(3.6)} />
        <path d="M 49 70 L 49 76" fill="none" stroke={WIRE_L} stroke-linecap="round" {...lw(1.2)} />
      </g>
    </g>
  );
}

const frontView: RiderViewDraft = {
  frame: [12, -9, 76, 108],
  idle: { ms: Array(IDLE_N).fill(300) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back: EndGround,
  Front: FrontViewFront,
};

const backView: RiderViewDraft = {
  frame: [12, -9, 76, 108],
  idle: { ms: Array(IDLE_N).fill(300) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back: EndGround,
  Front: BackViewFront,
};

export const hollowBulb: RiderDraft = {
  id: "hollow-bulb",
  name: "Hollow's Bulb",
  tier: "mythic",
  description: "One bulb from Hollow's strand, gone rogue. Runs on darkness; somehow still lights up.",
  frame: [-12, -9, 125, 108],
  idle: { ms: Array(IDLE_N).fill(300) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose,
  Back,
  Front,
  views: { front: frontView, back: backView },
};
