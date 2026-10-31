import type { ComponentChildren } from "preact";
import type { Paint } from "../item-paint.tsx";
import { moonRide } from "./moon-ride.tsx";
import { RidingChirp } from "./riding-chirp.tsx";

/**
 * Rides (Oct 31): crate items in the `ride` slot (crates.ts) that your pawn sits on. Each is drawn like any item, as SVG on
 * the pawn's 100 × 100 square (`item-paint.tsx`), in two parts: `Back` (behind the pawn) and `Front` (in front of it), with
 * the pawn between them, raised, maybe tilted, and hidden below its seat (`pose`). Two animations: `idle` (standing) and
 * `move` (one square of the town's walk). The types are the art pipeline's (scripts/boss-art/item-kit.tsx on
 * `claude/boss-art`), so a new ride's drawing comes over as drawn.
 */

/** What a ride's art is given: its paint (and a second paint), the pawn's side, the frame to draw and which animation. */
export interface RiderProps {
  p: Paint;
  p2: Paint;
  side: "w" | "b";
  /** The frame number of the animation (0 to its `ms.length - 1`). */
  f: number;
  anim: "idle" | "move";
}

/** One animation of a ride: each frame's length in ms (the town plays `move` at its walking pace instead). */
export interface RiderAnim {
  ms: number[];
}

/**
 * Where everything is on a frame: the whole group (ride and pawn) moved by `dx`, `dy` (on the square's units; the town
 * moves the ride across the square itself, so it uses only `dy`, as a lift); the pawn moved by `pawnX`, `pawnY` on its ride
 * (negative y is up), tilted `pawnTilt` degrees round its base (50, 88), and hidden below `cut` (in the pawn's own square,
 * before it's moved).
 */
export interface RiderPose {
  dx: number;
  dy: number;
  pawnX: number;
  pawnY: number;
  pawnTilt?: number;
  cut: number;
}

/** A ride's drawing. */
export interface RiderDraft {
  id: string;
  name: string;
  tier: string;
  description: string;
  colors?: 2;
  /** Its box on the pawn's square with its pawn on it, at rest: x, y, w, h (its tile). */
  frame: [number, number, number, number];
  idle: RiderAnim;
  /** One square of the town's movement (from one square to the next). */
  move: RiderAnim;
  pose: (anim: "idle" | "move", f: number) => RiderPose;
  Back: (props: RiderProps) => ComponentChildren;
  Front: (props: RiderProps) => ComponentChildren;
}

/** Every ride's drawing, by its item id (crates.ts). A new ride: its drawing in this folder, and a line here. */
export const RIDES: Readonly<Record<string, RiderDraft>> = {
  "riding-chirp": RidingChirp,
  "moon-ride": moonRide,
};

/** A ride's drawing, or undefined for any other item. */
export const rideOf = (def: string | undefined): RiderDraft | undefined => (def ? RIDES[def] : undefined);
