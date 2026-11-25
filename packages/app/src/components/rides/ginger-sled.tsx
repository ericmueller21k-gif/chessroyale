// Copied as drawn from `claude/boss-art` (scripts/boss-art/out/ginger-sled/ginger-sled.tsx, Nov 1: the side view, its front and back views, its
// trail mark): only the import lines changed and the `!`s the app's stricter typecheck asks for (noUncheckedIndexedAccess).
// The art's kit there (scripts/boss-art/item-kit.tsx) is a copy of ../item-paint.tsx and ./kit.ts. Notes: docs/areas/shop.md, "Rides".
import type { RiderDraft, RiderProps, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw } from "../item-paint.tsx";

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
  if (false as boolean && anim === "move") {
    for (let k = 1; k <= 8; k++) {
      const age = f - k;
      if (age < 0 || age > 2) continue;
      const x = 6 - (MOVE_DX[f]! - MOVE_DX[k]!) - age * 2;
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
        <path d={LEGS[0]!} fill="#7a4a24" {...LINE} {...lw(2)} />
        <path d={LEGS[1]!} fill="#7a4a24" {...LINE} {...lw(2)} />
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

/* ---------- front and back views (end-on) ---------- */
// the runners seen end-on: a striped post with its hook curling outward at the top
const END_RUNNERS = ["M25 93 L25 74 C25 64 15 63 14 70", "M75 93 L75 74 C75 64 85 63 86 70"];
const END_LEGS = ["M30 80 L37 80 L37 90 L30 90 Z", "M63 80 L70 80 L70 90 L63 90 Z"];
const END_ROLL = [0, 0, 0.8, 0, -0.8, 0, 0.8, 0, -0.5, 0, 0, 0];
const END_DY = [0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.5, 0.2];

// front view: the nose face, and the tub running away behind the pawn up to the backrest
const FN_PANEL = "M18 62 Q18 57 24 57 L76 57 Q82 57 82 62 L82 74 Q82 82 74 82 L26 82 Q18 82 18 74 Z";
const FN_TUB = "M20 62 L23 46 Q24 37 34 37 L66 37 Q76 37 77 46 L80 62 Z";
const FN_TUB_IN = "M25.5 62 L27.5 49 Q28.5 43 36 43 L64 43 Q71.5 43 72.5 49 L74.5 62 Z";
const FN_RIM = "M23.5 54 L25 46.5 Q26 40 34 40 L66 40 Q74 40 75 46.5 L76.5 54";
// back view: the backrest wall (near), and the tub running away to the nose (far)
const BK_PANEL = "M20 57 Q20 50 27 50 L73 50 Q80 50 80 57 L80 74 Q80 82 72 82 L28 82 Q20 82 20 74 Z";
const BK_TUB = "M20 60 L23 44 Q24 36 32 36 L68 36 Q76 36 77 44 L80 60 Z";
const BK_TUB_IN = "M25.5 60 L27.5 46 Q28.5 41 34 41 L66 41 Q71.5 41 72.5 46 L74.5 60 Z";
const BK_RIM = "M23 54 L24.5 45 Q26 39 33 39 L67 39 Q74 39 75.5 45 L77 54";
const BK_TOP_ICING = "M24 64 L24 58 Q24 54 29 54" + scallops(29, 71, 54, 6).replace(/^M\S+ \S+/, "") + " Q76 54 76 58 L76 64";

function endSparkle(anim: string, f: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  if (anim !== "idle") return null;
  if (f === 3) return { ...a, s: 6 };
  if (f === 4) return { ...a, s: 2.8 };
  if (f === 7) return { ...b, s: 5.4 };
  if (f === 8) return { ...b, s: 2.4 };
  return null;
}

function endFlake(anim: string, f: number, step: number) {
  return anim === "idle"
    ? { x: 78 + Math.sin(f * 0.8) * 4 - f * 0.3, y: -4 + f * step, r: f >= 11 ? 2.2 : 3.2, rot: f * 15 }
    : null;
}

// snow kicked out left and right from the runners while sliding; dir -1 drifts up (away), +1 down (toward us)
function EndPuffs({ f, dir }: { f: number; dir: number }) {
  const out = [];
  for (let k = 1; k <= 8; k++) {
    const age = f - k;
    if (age < 0 || age > 2) continue;
    for (const s of [-1, 1]) {
      const x = 50 + s * (27 + age * 6.5);
      const y = 91 + dir * age * 1.8;
      const r = 2.6 + age * 1.7;
      out.push(
        <g key={`${k}${s}`} opacity={age === 2 ? 0.75 : 1}>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke={INK} {...lw(1.6)} />
          <circle cx={x + s * r * 0.95} cy={y + 1.5} r={r * 0.62} fill="#fff" stroke={INK} {...lw(1.6)} />
        </g>,
      );
    }
  }
  return <g>{out}</g>;
}

// at the stop, a little spray flies off the two hooks
function CurlSpray({ f }: { f: number }) {
  if (f !== 9 && f !== 10) return null;
  const a = f === 9;
  return (
    <g opacity={a ? 1 : 0.7}>
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={50 + s * (a ? 39 : 42)} cy={a ? 64 : 61} r={a ? 2.6 : 3.4} fill="#fff" stroke={INK} {...lw(1.4)} />
          <circle cx={50 + s * (a ? 35 : 37)} cy={a ? 60 : 56.5} r={a ? 1.8 : 2.4} fill="#fff" stroke={INK} {...lw(1.4)} />
        </g>
      ))}
    </g>
  );
}

function FrontViewBack({ p, anim, f }: RiderProps) {
  return (
    <g>
      <Region
        p={p}
        name="backrest"
        d={[FN_TUB]}
        over={<path d={FN_TUB_IN} fill="#000" opacity="0.24" />}
      />
      <path d={FN_TUB_IN} fill="none" stroke={INK} stroke-linejoin="round" {...lw(1.6)} />
      <Icing d={FN_RIM} />
    </g>
  );
}

function FrontViewFront({ p, anim, f }: RiderProps) {
  const sparkle = endSparkle(anim, f, { x: 40, y: 61 }, { x: 26, y: 42 });
  const flake = endFlake(anim, f, 5.5);
  return (
    <g>
      <Region p={p} name="legs" d={END_LEGS} line={2} />
      <Region
        p={p}
        name="panel"
        d={[FN_PANEL]}
        over={
          <g>
            <path d="M10 58 L92 58 L92 65 L10 65 Z" fill="#fff" opacity="0.14" />
            <path d="M10 76 L92 76 L92 84 L10 84 Z" fill="#000" opacity="0.12" />
          </g>
        }
      />
      <Icing d={scallops(22.5, 77.5, 61)} />
      <Icing d={scallops(22.5, 77.5, 78)} />
      {[35, 50, 65].map((x) => (
        <circle key={x} cx={x} cy={70} r="1.7" fill={ICING} stroke={INK} {...lw(1.2)} />
      ))}
      <Gumdrop x={30} y={57.5} c="#e0303a" hi="#ff8a8f" />
      <Gumdrop x={50} y={57.5} c="#35a24a" hi="#8fe39b" />
      <Gumdrop x={70} y={57.5} c="#e0303a" hi="#ff8a8f" />
      {END_RUNNERS.map((d) => (
        <Cane key={d} d={d} />
      ))}
      {sparkle && <Sparkle {...sparkle} />}
      {flake && <Snowflake {...flake} />}
      {anim === "move" && <CurlSpray f={f} />}
    </g>
  );
}

function BackViewBack({ p }: RiderProps) {
  return (
    <g>
      <Region p={p} name="nose" d={[BK_TUB]} over={<path d={BK_TUB_IN} fill="#000" opacity="0.24" />} />
      <path d={BK_TUB_IN} fill="none" stroke={INK} stroke-linejoin="round" {...lw(1.6)} />
      <Icing d={BK_RIM} />
      <Gumdrop x={24.5} y={49.5} c="#e0303a" hi="#ff8a8f" />
      <Gumdrop x={75.5} y={49.5} c="#35a24a" hi="#8fe39b" />
    </g>
  );
}

function BackViewFront({ p, anim, f }: RiderProps) {
  const sparkle = endSparkle(anim, f, { x: 62, y: 55 }, { x: 24.5, y: 58 });
  const flake = endFlake(anim, f, 4.8);
  return (
    <g>
      <Region p={p} name="legs" d={END_LEGS} line={2} />
      {END_RUNNERS.map((d) => (
        <Cane key={d} d={d} />
      ))}
      <Region
        p={p}
        name="panel"
        d={[BK_PANEL]}
        over={
          <g>
            <path d="M10 50 L92 50 L92 57 L10 57 Z" fill="#fff" opacity="0.14" />
            <path d="M10 76 L92 76 L92 84 L10 84 Z" fill="#000" opacity="0.12" />
          </g>
        }
      />
      <Icing d={BK_TOP_ICING} />
      <Icing d={scallops(23, 77, 78, 6)} />
      {[36, 50, 64].map((x) => (
        <circle key={x} cx={x} cy={68.5} r="1.7" fill={ICING} stroke={INK} {...lw(1.2)} />
      ))}
      {sparkle && <Sparkle {...sparkle} />}
      {flake && <Snowflake {...flake} />}
      {anim === "move" && <CurlSpray f={f} />}
    </g>
  );
}

const endPose = (lean: (tilt: number) => number) => (anim: "idle" | "move", f: number) =>
  anim === "idle"
    ? { dx: 0, dy: IDLE_DY[f]! ?? 0, pawnX: 0, pawnY: -4 + (IDLE_PY[f]! ?? 0), cut: 66 }
    : {
        dx: 0,
        dy: END_DY[f]! ?? 0,
        pawnX: 0,
        pawnY: -4 + (MOVE_PY[f]! ?? 0) + lean(MOVE_TILT[f]! ?? 0),
        pawnTilt: END_ROLL[f]! ?? 0,
        cut: 66,
      };

const frontView: RiderViewDraft = {
  frame: [4, 10, 92, 90],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  // leaning back tips the head away (a little lower); the lurch at the stop tips it toward us (lower still)
  pose: endPose((t) => (t < 0 ? -t * 0.1 : t * 0.22)),
  Back: FrontViewBack,
  Front: FrontViewFront,
};

const backView: RiderViewDraft = {
  frame: [4, 10, 92, 90],
  idle: { ms: IDLE_MS },
  move: { ms: MOVE_MS },
  // from behind, leaning back tips the head toward us (lower); the lurch tips it away
  pose: endPose((t) => (t < 0 ? -t * 0.2 : t * 0.05)),
  Back: BackViewBack,
  Front: BackViewFront,
};

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
      ? { dx: 0, dy: IDLE_DY[f]! ?? 0, pawnX: 3, pawnY: -4 + (IDLE_PY[f]! ?? 0), cut: 66 }
      : { dx: MOVE_DX[f]! ?? 0, dy: 0, pawnX: 3, pawnY: -4 + (MOVE_PY[f]! ?? 0), pawnTilt: MOVE_TILT[f]! ?? 0, cut: 66 },
  Back,
  Front,
  views: { front: frontView, back: backView },
  trail: { ms: [160, 160, 160, 170], w: 34, h: 28, Mark: SledTrack },
};

/* ---------- trail: two runner tracks with candy specks ---------- */
const TRACK_EDGE = "#8f9aa6";
const TRACK_SNOW = "#eef2f6";
const SPECKS = [CANE_RED, "#ffffff", "#5fd3a0", CANE_RED];
function SledTrack({ f, view, n }: TrailProps) {
  const side = view === "side";
  const trackO = [1, 0.72, 0.45, 0.2][f]! ?? 0;
  const speckO = [1, 0.9, 0.4, 0][f]! ?? 0;
  // tracks: along x for side (running right), along y for up/down
  const lines = side
    ? ["M-16 -4.5 L16 -4.5", "M-16 4.5 L16 4.5"]
    : ["M-7 -12 L-7 12", "M7 -12 L7 12"];
  const flip = n % 2 ? -1 : 1;
  const pts: [number, number][] = side
    ? [[-11, 0], [-2, flip * 9], [6, -flip * 0.5], [13, -flip * 9]]
    : [[0, -9], [flip * 12, -1], [-flip * 0.5, 4], [-flip * 12, 10]];
  return (
    <g>
      <g opacity={trackO}>
        {lines.map((d) => (
          <path key={d} d={d} fill="none" stroke={TRACK_EDGE} stroke-linecap="round" {...lw(4.4)} />
        ))}
        {lines.map((d) => (
          <path key={d + "i"} d={d} fill="none" stroke={TRACK_SNOW} stroke-linecap="round" {...lw(2.2)} />
        ))}
      </g>
      {speckO > 0 && (
        <g opacity={speckO}>
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={f === 2 ? 1.2 : 1.6} fill={SPECKS[i]!} stroke={INK} {...lw(0.9)} />
          ))}
        </g>
      )}
    </g>
  );
}
