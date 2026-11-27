// A crate rider (Nov 27, Eric, Nov 9-10: "a few riders that have nothing to do with the bosses ... in the regular crates"; he
// liked the shopping cart): drawn here in code, the boss rides' kit (./kit.ts). Notes: docs/decisions/2026-11-27-crate-riders.md.
import type { RiderDraft, RiderProps, RiderPose, RiderViewDraft, TrailProps } from "./kit.ts";
import { Region, LINE, lw, darken } from "../item-paint.tsx";

/* The Shopping Cart: a wire cart, basket in the item's color, the pawn sitting in the basket, one wheel that never points straight. */

const IDLE_N = 4;
const MOVE_N = 8;
const PAWN_Y = -16;
const CUT = 74;

const STEEL = "#b9bec6";
const STEEL_D = "#7d838c";
const TIRE = "#2b2b30";

/** The rattle over the parking lot: a little jolt every other frame. */
const rattle = (anim: "idle" | "move", f: number) => (anim === "move" ? (f % 2 ? -0.8 : 0) : 0);

function pose(anim: "idle" | "move", f: number): RiderPose {
  if (anim === "idle") return { dx: 0, dy: 0, pawnX: 2, pawnY: PAWN_Y + (f === 2 ? -0.6 : 0), cut: CUT };
  return { dx: (100 * f) / MOVE_N, dy: rattle(anim, f), pawnX: 2, pawnY: PAWN_Y, pawnTilt: f % 2 ? 1.5 : -1, cut: CUT };
}

const BASKET = "M 14 50 L 90 50 L 82 80 L 24 80 Z";
const RIM = "M 17 46 L 87 46 L 90 50 L 14 50 Z";

function Wheel({ x, a }: { x: number; a: number }) {
  const r = (a * Math.PI) / 180;
  return (
    <g>
      <circle cx={x} cy={93} r={4.2} fill={TIRE} {...LINE} {...lw(2)} />
      <path d={`M ${x - 2.6 * Math.cos(r)} ${93 - 2.6 * Math.sin(r)} L ${x + 2.6 * Math.cos(r)} ${93 + 2.6 * Math.sin(r)}`} stroke={STEEL} {...lw(1.6)} />
      <circle cx={x} cy={93} r={1.2} fill={STEEL} />
    </g>
  );
}

function Back({ p }: RiderProps) {
  return (
    <g>
      {/* the basket's far rim, behind the pawn */}
      <path d={RIM} fill={darken(p.hex, 0.35)} {...LINE} {...lw(2)} />
    </g>
  );
}

function Front({ p, anim, f }: RiderProps) {
  const a = anim === "move" ? f * 45 : 0;
  const wire = darken(p.hex, 0.4);
  return (
    <g>
      {/* frame: legs and the bottom rack */}
      <path d="M 28 80 L 28 89 M 77 80 L 77 89 M 26 86 L 80 86" fill="none" stroke={STEEL_D} stroke-linecap="round" {...lw(2.4)} />
      {/* handle, at the back (left: the cart faces right) */}
      <path d="M 16 50 L 7 37" fill="none" stroke={STEEL_D} stroke-linecap="round" {...lw(2.6)} />
      <rect x={1} y={33} width={10} height={5} rx={2.5} fill="#d6342f" {...LINE} {...lw(2)} transform="rotate(-55 6 35.5)" />
      <Region p={p} name="basket" d={[BASKET]} />
      {/* the wire grid */}
      <path
        d="M 25 50 L 32 80 M 37 50 L 42 80 M 49 50 L 52 80 M 61 50 L 62 80 M 73 50 L 72 80 M 84 50 L 80 75 M 17 60 L 87 60 M 20 70 L 85 70"
        fill="none" stroke={wire} stroke-opacity={0.7} {...lw(1.4)} />
      <path d={BASKET} fill="none" {...LINE} />
      <path d="M 14 50 L 90 50" fill="none" stroke={STEEL} stroke-linecap="round" {...lw(2.6)} />
      <Wheel x={28} a={a} />
      <Wheel x={77} a={a + 20} />
    </g>
  );
}

/* ---- front and back views: the cart end-on ---- */

const END_BASKET = "M 22 50 L 78 50 L 73 80 L 27 80 Z";

function endPose(anim: "idle" | "move", f: number): RiderPose {
  return { dx: 0, dy: rattle(anim, f), pawnX: 0, pawnY: PAWN_Y, pawnTilt: anim === "move" ? (f % 2 ? 1 : -1) : 0, cut: CUT };
}

function EndBack({ p }: RiderProps) {
  return <path d="M 24 46 L 76 46 L 78 50 L 22 50 Z" fill={darken(p.hex, 0.35)} {...LINE} {...lw(2)} />;
}

function endFront(handle: boolean) {
  return function EndFront({ p }: RiderProps) {
    const wire = darken(p.hex, 0.4);
    return (
      <g>
        <path d="M 31 80 L 31 89 M 69 80 L 69 89 M 30 86 L 70 86" fill="none" stroke={STEEL_D} stroke-linecap="round" {...lw(2.4)} />
        <Region p={p} name="basket" d={[END_BASKET]} />
        <path d="M 32 50 L 35 80 M 41 50 L 43 80 M 50 50 L 50 80 M 59 50 L 57 80 M 68 50 L 65 80 M 24 60 L 76 60 M 25 70 L 75 70"
          fill="none" stroke={wire} stroke-opacity={0.7} {...lw(1.4)} />
        <path d={END_BASKET} fill="none" {...LINE} />
        <path d="M 22 50 L 78 50" fill="none" stroke={STEEL} stroke-linecap="round" {...lw(2.6)} />
        <rect x={28} y={88} width={6} height={9} rx={2.5} fill={TIRE} {...LINE} {...lw(2)} />
        <rect x={66} y={88} width={6} height={9} rx={2.5} fill={TIRE} {...LINE} {...lw(2)} />
        {/* seen from behind, the handle is nearest: its red grip across the back */}
        {handle && <rect x={20} y={40} width={60} height={5} rx={2.5} fill="#d6342f" {...LINE} {...lw(2)} />}
      </g>
    );
  };
}

const endView = (handle: boolean): RiderViewDraft => ({
  frame: [16, 4, 68, 95],
  idle: { ms: [500, 500, 160, 500] },
  move: { ms: Array(MOVE_N).fill(90) },
  pose: endPose,
  Back: EndBack,
  Front: endFront(handle),
});

/* ---- trail: two thin wheel tracks ---- */

function Tracks({ f }: TrailProps) {
  const a = [0.5, 0.35, 0.2, 0.08][f] ?? 0;
  return <path d="M -11 -3 L 11 -3 M -11 3 L 11 3" fill="none" stroke="#3a3a40" stroke-opacity={a} stroke-linecap="round" {...lw(1.6)} />;
}

export const shoppingCart: RiderDraft = {
  id: "shopping-cart",
  name: "Shopping Cart",
  tier: "mythic",
  description: "One wheel has a mind of its own. The other three have given up arguing.",
  frame: [-2, 2, 96, 97],
  idle: { ms: [500, 500, 160, 500] },
  move: { ms: Array(MOVE_N).fill(90) },
  pose,
  Back,
  Front,
  views: { front: endView(false), back: endView(true) },
  trail: { ms: [160, 150, 150, 140], w: 26, h: 10, Mark: Tracks },
};
