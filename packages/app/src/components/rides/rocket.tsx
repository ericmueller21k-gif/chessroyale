// A crate rider (Nov 27; Eric, Nov 9-10: riders that have nothing to do with the bosses, in the regular crates): drawn here in
// code, the boss rides' kit (./kit.ts). Notes: docs/decisions/2026-11-27-crate-riders.md.
import type { RiderDraft, RiderProps, RiderPose, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw, lighten } from "../item-paint.tsx";

/* The Rocket: a toy rocket lying on its side, hovering, its body the item's color, nose and fins the second color, the pawn
   sitting in its open cockpit. A flame out the back: small while it waits, long while it flies. */

const TAU = Math.PI * 2;
const IDLE_N = 6;
const MOVE_N = 8;
const PAWN_Y = -20;
const CUT = 84;

const FLAME = "#ff8a1f";
const FLAME_CORE = "#ffe27a";

function bob(anim: "idle" | "move", f: number): number {
  const n = anim === "idle" ? IDLE_N : MOVE_N;
  return -1.2 - 1.2 * Math.cos((TAU * f) / n);
}

function pose(anim: "idle" | "move", f: number): RiderPose {
  return { dx: anim === "move" ? (100 * f) / MOVE_N : 0, dy: bob(anim, f), pawnX: -2, pawnY: PAWN_Y, pawnTilt: anim === "move" ? 3 : 0, cut: CUT };
}

const BODY = "M 12 62 L 68 62 Q 72 72 68 84 L 12 84 Q 9 73 12 62 Z";
const NOSE = "M 68 62 Q 90 63 98 73 Q 90 83 68 84 Q 72 72 68 62 Z";
const FINS = ["M 14 62 L 6 50 L 15 50 L 28 62 Z", "M 14 84 L 6 96 L 15 96 L 28 84 Z"];

function Shadow({ anim, f, rx, cx }: { anim: "idle" | "move"; f: number; rx: number; cx: number }) {
  const lift = -bob(anim, f);
  const s = 1 - lift * 0.04;
  return <ellipse cx={cx} cy={98 + lift} rx={rx * s} ry={2.4 * s} fill="#1d1d1f" opacity={0.22} />;
}

/** The flame's length: a flicker standing, a long burn flying. */
const burn = (anim: "idle" | "move", f: number) => (anim === "move" ? 15 + 3 * (f % 2) : 6 + 2 * (f % 2));

function Back({ anim, f }: RiderProps) {
  return <Shadow anim={anim} f={f} rx={36} cx={52} />;
}

function Front({ p, p2, anim, f }: RiderProps) {
  const L = burn(anim, f);
  return (
    <g>
      <path d={`M 11 66 Q ${11 - L} 73 11 80 Z`} fill={FLAME} {...LINE} {...lw(1.6)} />
      <path d={`M 11 69 Q ${11 - L * 0.55} 73 11 77 Z`} fill={FLAME_CORE} />
      <Region p={p2} name="fins" d={FINS} />
      <Region p={p} name="body" d={[BODY]} />
      {/* a stripe round the body and a porthole */}
      <path d="M 24 62.5 Q 21 73 24 83.5" fill="none" stroke={p2.hex} stroke-linecap="round" {...lw(2.6)} />
      <circle cx={56} cy={73} r={4.4} fill="#bfe8ff" {...LINE} {...lw(2)} />
      <path d="M 54 71.4 Q 55.4 70 57 70.4" fill="none" stroke="#fff" stroke-linecap="round" {...lw(1.2)} />
      <Region p={p2} name="nose" d={[NOSE]} />
      <path d="M 30 66 L 64 66" fill="none" stroke={lighten(p.hex, 0.5)} stroke-opacity={0.6} stroke-linecap="round" {...lw(1.6)} />
    </g>
  );
}

/* ---- front and back views: the rocket end-on, nose toward you or flame toward you ---- */

function endPose(anim: "idle" | "move", f: number): RiderPose {
  return { dx: 0, dy: bob(anim, f), pawnX: 0, pawnY: PAWN_Y, cut: CUT };
}

const END_FINS = ["M 30 76 L 17 76 L 17 70 Z", "M 70 76 L 83 76 L 83 70 Z", "M 46 87 L 50 97 L 54 87 Z"];

function EndBack({ anim, f }: RiderProps) {
  return <Shadow anim={anim} f={f} rx={22} cx={50} />;
}

function endFront(nose: boolean) {
  return function EndFront({ p, p2, anim, f }: RiderProps) {
    const k = anim === "move" ? 1 : 0.5 + 0.2 * (f % 2);
    return (
      <g>
        <Region p={p2} name="fins" d={END_FINS} />
        <Region p={p} name="body" d={["M 50 62 A 12.5 12.5 0 1 1 49.99 62 Z"]} />
        {nose ? (
          <g>
            <Region p={p2} name="nose" d={["M 50 66 A 8.5 8.5 0 1 1 49.99 66 Z"]} />
            <circle cx={48} cy={72.5} r={2.2} fill="#fff" opacity={0.6} />
          </g>
        ) : (
          <g>
            <circle cx={50} cy={74.5} r={7.5} fill="#3a3a40" {...LINE} {...lw(2)} />
            <circle cx={50} cy={74.5} r={5.5 * k} fill={FLAME} />
            <circle cx={50} cy={74.5} r={3 * k} fill={FLAME_CORE} />
          </g>
        )}
      </g>
    );
  };
}

const endView = (nose: boolean): RiderViewDraft => ({
  frame: [14, 0, 72, 100],
  idle: { ms: Array(IDLE_N).fill(140) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back: EndBack,
  Front: endFront(nose),
});

/* ---- trail: a puff of smoke, growing as it fades ---- */

function Puff({ f, n }: TrailProps) {
  const a = [0.55, 0.4, 0.25, 0.1][f] ?? 0;
  const r = [4, 5.5, 7, 8][f] ?? 8;
  const o = n % 2 ? 3 : -3;
  return (
    <g fill="#c9ccd2" opacity={a}>
      <circle cx={-4} cy={o * 0.5} r={r} />
      <circle cx={5} cy={-o * 0.4} r={r * 0.75} />
    </g>
  );
}

export const rocket: RiderDraft = {
  id: "rocket",
  name: "Rocket",
  tier: "mythic",
  colors: 2,
  description: "Body in one color, fins and nose in another. Goes to the moon, one square at a time.",
  frame: [-8, -2, 108, 102],
  idle: { ms: Array(IDLE_N).fill(140) },
  move: { ms: Array(MOVE_N).fill(90) },
  pose,
  Back,
  Front,
  views: { front: endView(true), back: endView(false) },
  trail: { ms: [160, 160, 150, 150], w: 26, h: 20, Mark: Puff },
};
