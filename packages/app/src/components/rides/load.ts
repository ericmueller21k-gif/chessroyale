import { useEffect, useState } from "preact/hooks";
import type { RiderDraft } from "./kit.ts";
import { RIDE_CELLS, type RideCells } from "../../town/ride-cells.ts";

/**
 * Each ride's drawing in its own chunk, loaded only when a ride is drawn (Nov 1, docs/decisions/2026-11-01-rides-lazy.md): worn by
 * you or someone in view in the town, or shown in the locker, the profiles or on home. Until #442 drew rides from their drawings
 * they were in the main bundle, 55 KB gzip on every player's first load though only admins can wear one. What every box needs
 * before a drawing arrives (each view's cell, its frames' seats and times, the tile's box) is in the main bundle, measured ahead
 * (town/ride-cells.ts), so nothing moves when it comes: the pawn sits where it will ride and the ride appears under it.
 * Your own worn ride's drawing is asked for as the app starts, after its first paint (main.tsx), so your pawn rarely waits.
 */

/** Every ride's drawing, by its item id (crates.ts), each a chunk of its own. A new ride: its drawing in this folder, and a line here. */
const DRAWINGS: Readonly<Record<string, () => Promise<RiderDraft>>> = {
  "riding-chirp": () => import("./riding-chirp.tsx").then((m) => m.RidingChirp),
  "moon-ride": () => import("./moon-ride.tsx").then((m) => m.moonRide),
  "hollow-bulb": () => import("./hollow-bulb.tsx").then((m) => m.hollowBulb),
  "smudgy-brush": () => import("./smudgy-brush.tsx").then((m) => m.smudgyBrush),
  "alfil-howdah": () => import("./alfil-howdah.tsx").then((m) => m.AlfilHowdah),
  "balloon-pup": () => import("./balloon-pup.tsx").then((m) => m.balloonPup),
  "bigboy-buggy": () => import("./bigboy-buggy.tsx").then((m) => m.BigBoyBuggy),
  "boingo-pogo": () => import("./boingo-pogo.tsx").then((m) => m.boingoPogo),
  "folio-crane": () => import("./folio-crane.tsx").then((m) => m.folioCrane),
  "ginger-sled": () => import("./ginger-sled.tsx").then((m) => m.gingerSled),
  "jefferson-giraffe": () => import("./jefferson-giraffe.tsx").then((m) => m.rider),
  "puddles-mower": () => import("./puddles-mower.tsx").then((m) => m.puddlesMower),
  "sawyer-dozer": () => import("./sawyer-dozer.tsx").then((m) => m.sawyerDozer),
  "rodeo-bull": () => import("./rodeo-bull.tsx").then((m) => m.rodeoBull),
  "cheetah-shoes": () => import("./cheetah-shoes.tsx").then((m) => m.cheetahShoes),
  "log-roller": () => import("./log-roller.tsx").then((m) => m.logRoller),
};

/** Every ride's item id. */
export const RIDE_IDS: readonly string[] = Object.keys(DRAWINGS);

/** A ride's measured numbers (ride-cells.ts), or undefined for any other item. */
export const rideCells = (def: string | undefined): RideCells | undefined => (def && Object.hasOwn(RIDE_CELLS, def) ? RIDE_CELLS[def] : undefined);

const drawn = new Map<string, RiderDraft>();
const coming = new Map<string, Promise<RiderDraft | undefined>>();

/** A ride's drawing if it has loaded (undefined: not yet, or not a ride). */
export const rideDrawing = (def: string | undefined): RiderDraft | undefined => (def ? drawn.get(def) : undefined);

/**
 * A ride's drawing, loading it if it hasn't (once: everyone asking shares the one load). Undefined for any other item, or if
 * its chunk didn't come (then the next ask tries again).
 */
export function loadRide(def: string | undefined): Promise<RiderDraft | undefined> {
  if (!def || !Object.hasOwn(DRAWINGS, def)) return Promise.resolve(undefined);
  const d = drawn.get(def);
  if (d) return Promise.resolve(d);
  let p = coming.get(def);
  if (!p) {
    p = DRAWINGS[def]!().then(
      (x) => {
        drawn.set(def, x);
        coming.delete(def);
        return x;
      },
      () => {
        coming.delete(def);
        return undefined;
      },
    );
    coming.set(def, p);
  }
  return p;
}

/** A ride's drawing for a component: undefined until it has loaded (asked for as the component shows), then drawn again with it. */
export function useRide(def: string | undefined): RiderDraft | undefined {
  const d = rideDrawing(def);
  const [, redraw] = useState(0);
  useEffect(() => {
    if (d || !def) return;
    let live = true;
    void loadRide(def).then((x) => live && x && redraw((n) => n + 1));
    return () => {
      live = false;
    };
  }, [def, d]);
  return d;
}
