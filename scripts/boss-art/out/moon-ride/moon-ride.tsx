import { Region, LINE, lw, darken, lighten, type RiderDraft, type RiderProps } from "../../item-kit.tsx";

/** Moon's Ride: Moo's friend the Moon, lying level like a flying board, napping as it floats. */

// The near (front-facing) side of the crescent: its top edge, and its round belly underneath.
// The crescent lies flat like a board, horns pointing away from us: from a little above we see its top (the deck, a
// squashed crescent, the pawn sitting on it) and, under its near round edge, its thick middle side (the face's side).
const DECK = "M -10.5 61 C 14 63 86 63 110.5 59 C 84 81 16 81 -10.5 61 Z";
const BODY = "M -10.5 61 C 16 81 84 81 110.5 59 C 86 104 14 104 -10.5 61 Z";
// The darker rim along the underside.
const RIM = "M 110.5 59 C 86 104 14 104 -10.5 61 C 12 97 88 97 110.5 59 Z";

const INK = "#1d1d1f";
const STAR = "#fff3b4";

/** A plump four-point star. */
const star = (cx: number, cy: number, r: number) => {
  const k = r * 0.22;
  return `M ${cx} ${cy - r} Q ${cx + k} ${cy - k} ${cx + r} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + r} Q ${cx - k} ${cy + k} ${cx - r} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
};

// Idle: an 8-frame slow float.
const IDLE_DY = [0, -1, -2.2, -3, -3.2, -2.4, -1.2, -0.3];
// Move: 6 frames across one square, nose dipping a touch then leveling.
const MOVE_DX = [0, 17, 34, 50, 67, 84];
const MOVE_DY = [-1, -2, -2.6, -2.4, -1.8, -1.2];
const MOVE_TILT = [1, 3, 4, 3.4, 2.2, 1.4];
const PAWN_Y = -13.5;
const PIVOT_Y = 88 + PAWN_Y;

const tiltOf = (anim: "idle" | "move", f: number) => (anim === "move" ? MOVE_TILT[f % 6] : 0);
const dyOf = (anim: "idle" | "move", f: number) => (anim === "move" ? MOVE_DY[f % 6] : IDLE_DY[f % 8]);

// A twinkle curve over 8 frames: grows, shines, fades.
const TWINKLE = [0, 0.55, 1, 0.75, 0.4, 0.12, 0, 0];
const IDLE_STARS: [number, number, number, number][] = [
  // x, y, radius, phase
  [-3, 42, 7, 0],
  [105, 38, 6.5, 3],
  [16, 24, 5.4, 5],
  [86, 18, 5.8, 2],
  [106, 80, 4.6, 6],
  [-6, 82, 4.4, 4],
];

function Stars({ anim, f }: { anim: "idle" | "move"; f: number }) {
  if (anim !== "idle") return null;
  return (
    <g>
      {IDLE_STARS.map(([x, y, r, ph], i) => {
        const s = TWINKLE[(f - ph + 16) % 8];
        if (s <= 0.05) return null;
        return (
          <path key={i} d={star(x, y, r * (0.45 + 0.55 * s))} fill={STAR} opacity={0.35 + 0.65 * s} stroke={INK} stroke-linejoin="round" {...lw(1.4)} />
        );
      })}
    </g>
  );
}

// The trail: sparkles left behind, drifting back and fading (positions on the ride's own square).
function Trail({ f, hex }: { f: number; hex: string }) {
  const g = f % 6;
  const bits: [number, number, number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const age = (g + k * 2) % 6; // 0..5
    const x = -12 - age * 3.6;
    const y = [62, 72, 67][k] + (age % 2) * 1.5;
    const r = 5.4 - age * 0.6;
    const o = 1 - age / 7;
    bits.push([x, y, r, o]);
  }
  const wave = (g % 2) * 1.2;
  return (
    <g>
      <path d={`M -8 ${64 + wave} Q -19 ${62 - wave} -30 ${64 + wave}`} fill="none" stroke={STAR} opacity="0.55" stroke-linecap="round" {...lw(3)} />
      <path d={`M -2 ${75 - wave} Q -12 ${77 + wave} -23 ${75 - wave}`} fill="none" stroke={lighten(hex, 0.6)} opacity="0.45" stroke-linecap="round" {...lw(2.4)} />
      {bits.map(([x, y, r, o], i) => (
        <path key={i} d={star(x, y, r)} fill={STAR} opacity={o} stroke={INK} stroke-linejoin="round" {...lw(1.2)} />
      ))}
    </g>
  );
}

function Back({ p, anim, f }: RiderProps) {
  const dy = dyOf(anim, f);
  const lift = -dy; // how far above rest it floats
  return (
    <g>
      <ellipse cx={50} cy={95 - dy} rx={44 - lift * 1.2} ry={3.6} fill="#000" opacity={0.2 - lift * 0.015} />
      {anim === "move" && <Trail f={f} hex={p.hex} />}
      <g transform={`rotate(${tiltOf(anim, f)} 50 ${PIVOT_Y})`}>

        <Region p={p} name="deck" d={[DECK]} fill={lighten(p.hex, 0.3)} />
        <circle cx={9} cy={67.5} r={2.4} fill={darken(p.hex, 0.06)} />
        <circle cx={94} cy={66} r={2} fill={darken(p.hex, 0.06)} />
        {/* the lighter rim along the deck's far edge */}
        <path d="M -5 63 C 6 65.2 16 65.8 24 66" fill="none" stroke={lighten(p.hex, 0.75)} stroke-linecap="round" {...lw(2.2)} />
        <path d="M 78 65.8 C 88 65.6 96 64 105 61.5" fill="none" stroke={lighten(p.hex, 0.75)} stroke-linecap="round" {...lw(2.2)} />
      </g>
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const crater = darken(p.hex, 0.16);
  const n = parseInt(p.hex.slice(1), 16);
  const dark = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.28;
  return (
    <g>
      <g transform={`rotate(${tiltOf(anim, f)} 50 ${PIVOT_Y})`}>
        <Region p={p} name="moon" d={[BODY]} outline={false} />
        <Region p={p} name="belly-rim" d={[RIM]} fill={darken(p.hex, 0.28)} outline={false} />
        <circle cx={12} cy={77} r={2.2} fill={crater} />
        <circle cx={24} cy={83} r={1.6} fill={crater} />
        <circle cx={35} cy={85} r={1.9} fill={crater} />
        <path d={BODY} fill="none" {...LINE} />
        {/* the sleepy face, toward the front tip */}
        <ellipse cx={63} cy={88.4} rx={5} ry={2.8} fill="#f08a9a" opacity="0.9" />
        {dark && (
          <path d="M 62 81.6 Q 69 88.4 76 81.6 M 75.5 82 l 2.8 -2 M 77.5 87 Q 81.5 90.2 85.5 85.8" fill="none" stroke={lighten(p.hex, 0.55)} stroke-linecap="round" stroke-linejoin="round" {...lw(5.4)} />
        )}
        <path d="M 62 81.6 Q 69 88.4 76 81.6" fill="none" stroke={INK} stroke-linecap="round" {...lw(3.2)} />
        <path d="M 75.5 82 l 2.8 -2" fill="none" stroke={INK} stroke-linecap="round" {...lw(2)} />
        <path d="M 77.5 87 Q 81.5 90.2 85.5 85.8" fill="none" stroke={INK} stroke-linecap="round" {...lw(2.8)} />
      </g>
      <Stars anim={anim} f={f} />
    </g>
  );
}

export const moonRide: RiderDraft = {
  id: "moon-ride",
  name: "Moon's Ride",
  tier: "mythic",
  description: "Moo's best friend floats you anywhere, fast asleep. Please don't wake it mid-flight.",
  frame: [-12, 4, 125, 94],
  idle: { ms: [260, 260, 260, 260, 260, 260, 260, 260] },
  move: { ms: [90, 90, 90, 90, 90, 90] },
  pose: (anim, f) =>
    anim === "move"
      ? { dx: MOVE_DX[f % 6], dy: MOVE_DY[f % 6], pawnX: 0, pawnY: PAWN_Y, pawnTilt: MOVE_TILT[f % 6], cut: 88 }
      : { dx: 0, dy: IDLE_DY[f % 8], pawnX: 0, pawnY: PAWN_Y, cut: 88 },
  Back,
  Front,
};
