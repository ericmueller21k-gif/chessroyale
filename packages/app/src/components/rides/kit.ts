import type { ComponentChildren } from "preact";
import type { Paint } from "../item-paint.tsx";
import { AlfilHowdah } from "./alfil-howdah.tsx";
import { balloonPup } from "./balloon-pup.tsx";
import { BigBoyBuggy } from "./bigboy-buggy.tsx";
import { boingoPogo } from "./boingo-pogo.tsx";
import { cheetahShoes } from "./cheetah-shoes.tsx";
import { folioCrane } from "./folio-crane.tsx";
import { gingerSled } from "./ginger-sled.tsx";
import { hollowBulb } from "./hollow-bulb.tsx";
import { rider as jeffersonGiraffe } from "./jefferson-giraffe.tsx";
import { logRoller } from "./log-roller.tsx";
import { moonRide } from "./moon-ride.tsx";
import { puddlesMower } from "./puddles-mower.tsx";
import { RidingChirp } from "./riding-chirp.tsx";
import { rodeoBull } from "./rodeo-bull.tsx";
import { sawyerDozer } from "./sawyer-dozer.tsx";
import { smudgyBrush } from "./smudgy-brush.tsx";

/**
 * Rides (Oct 31; Nov 1, every boss's: docs/decisions/2026-11-01-rides-v2.md): crate items in the `ride` slot (crates.ts) that
 * your pawn sits on. Each is drawn like any item, as SVG on the pawn's 100 × 100 square (`item-paint.tsx`), in two parts: `Back`
 * (behind the pawn) and `Front` (in front of it), with the pawn between them, raised, maybe tilted, and hidden below its seat
 * (`pose`). Two animations: `idle` (standing) and `move` (one square of the town's walk). That's its side view (walking left or
 * right); most rides also have a view from behind (walking up the screen) and from the front (walking down: `views`), and a
 * mark they leave on the ground as they run (`trail`). The types are the art pipeline's (scripts/boss-art/item-kit.tsx on
 * `claude/boss-art`), so a ride's drawing comes over as drawn.
 */

/** Which way a ride is seen: side (walking left or right; drawn facing right), back (walking up the screen), front (walking down). */
export type RiderFacing = "side" | "front" | "back";

/** What a ride's art is given: its paint (and a second paint), the pawn's side, the frame to draw and which animation. */
export interface RiderProps {
  p: Paint;
  p2: Paint;
  side: "w" | "b";
  /** The frame number of the animation (0 to its `ms.length - 1`). */
  f: number;
  anim: "idle" | "move";
  /** The view being drawn (side for the RiderDraft's own Back and Front), for code shared between views. */
  view?: RiderFacing;
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

/** One view of a ride: its own idle and move, a pose a frame, and its two drawings (the side view is the RiderDraft's own fields). */
export interface RiderViewDraft {
  /** Its box on the pawn's square with its pawn on it, at rest: x, y, w, h (front and back: default the side's). */
  frame?: [number, number, number, number];
  idle: RiderAnim;
  /** One square of the town's movement (from one square to the next); the front and back views play it in place. */
  move: RiderAnim;
  pose: (anim: "idle" | "move", f: number) => RiderPose;
  Back: (props: RiderProps) => ComponentChildren;
  Front: (props: RiderProps) => ComponentChildren;
}

/** What a ride's trail mark is given to draw one frame of one mark. */
export interface TrailProps {
  p: Paint;
  p2: Paint;
  /** The frame: 0 when it lands (fresh) to `ms.length - 1` (nearly gone). */
  f: number;
  /** Which way the ride was running when it left it: side (going right; the town mirrors it for left), back (up), front (down). */
  view: RiderFacing;
  /** Which mark of the run this is (0, 1, 2, …), for marks that take turns (a left and a right footprint). */
  n: number;
}

/**
 * A ride's trail (Eric, Oct 31: "the trails aren't to be drawn in unless you're actually running around the town"): in place
 * of the town's droplets, a running ride leaves this small mark on each square it leaves, where it goes from fresh to faded
 * over its frames, then is gone.
 */
export interface RiderTrail {
  /** Each frame's length in ms, fresh to faded: its life is their sum. */
  ms: number[];
  /** One mark every this many squares run (default 1). */
  every?: number;
  /** Its box in units, centered on (0, 0), the middle of the square left (a square is about 69 units): at most 40 × 30. */
  w: number;
  h: number;
  /** One frame of the mark, drawn round (0, 0) on the ground as the town's camera sees it (a little flattened). */
  Mark: (props: TrailProps) => ComponentChildren;
}

/** A ride's drawing: its side view, and maybe its front and back views and its trail mark. */
export interface RiderDraft extends RiderViewDraft {
  id: string;
  name: string;
  tier: string;
  description: string;
  colors?: 2;
  /** Its box on the pawn's square with its pawn on it, at rest: x, y, w, h (its tile). */
  frame: [number, number, number, number];
  /** The views from behind (walking up the screen) and from the front (walking down). */
  views?: { front?: RiderViewDraft; back?: RiderViewDraft };
  /** What it leaves on the ground as it runs, in place of the town's droplets (none: the droplets). */
  trail?: RiderTrail;
}

/** The three views, in the order the town keeps them (a walker's `view`: 0 side, 1 back, 2 front). */
export const FACINGS: readonly RiderFacing[] = ["side", "back", "front"];

/** A ride's view: the side's own fields, or its front's or back's (the side's when it has none). */
export const viewOf = (d: RiderDraft, view: RiderFacing): RiderViewDraft => (view === "side" ? d : (d.views?.[view] ?? d));

/** Every ride's drawing, by its item id (crates.ts). A new ride: its drawing in this folder, and a line here. */
export const RIDES: Readonly<Record<string, RiderDraft>> = {
  "riding-chirp": RidingChirp,
  "moon-ride": moonRide,
  "hollow-bulb": hollowBulb,
  "smudgy-brush": smudgyBrush,
  "alfil-howdah": AlfilHowdah,
  "balloon-pup": balloonPup,
  "bigboy-buggy": BigBoyBuggy,
  "boingo-pogo": boingoPogo,
  "folio-crane": folioCrane,
  "ginger-sled": gingerSled,
  "jefferson-giraffe": jeffersonGiraffe,
  "puddles-mower": puddlesMower,
  "sawyer-dozer": sawyerDozer,
  "rodeo-bull": rodeoBull,
  "cheetah-shoes": cheetahShoes,
  "log-roller": logRoller,
};

/** A ride's drawing, or undefined for any other item. */
export const rideOf = (def: string | undefined): RiderDraft | undefined => (def ? RIDES[def] : undefined);
