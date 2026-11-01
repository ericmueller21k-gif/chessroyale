import { RIDES } from "@chessroyale/core";
import { rideScaleAsked } from "../../test-switches.ts";

/**
 * A ride's size under its pawn (Nov 1; docs/decisions/2026-11-01-ride-scale.md): the ride is drawn at `k` about its saddle,
 * the pawn at its own size, still sitting in the saddle; the ride still stands on the square. Shared by the town's riders
 * (town/rides.ts, composed once) and the locker's, the profiles' and home's (Items.tsx's RideLayers).
 */

/** A ride's size now: this page's `?rideScale=` (an admin's), else its own (RIDES.scale), else every ride's (RIDES.defaultScale). */
export const rideScale = (id: string): number => rideScaleAsked() ?? RIDES.scale[id] ?? RIDES.defaultScale;

/** How much faster than on foot a pawn walks the town on this ride (RIDES.speed; 1: no faster). */
export const rideSpeed = (id: string | undefined): number => (id ? (RIDES.speed[id] ?? 1) : 1);

/** Where the pawn sits on a frame, in the pawn's square's units: x, y (its square moved), tilt (degrees round its base, 50 88), cut (hidden below, in its own square). */
export type Seat = readonly number[];

/** The point a ride is scaled about: the middle of its saddle line on its first idle frame. */
export const seatAnchor = (s: Seat): [number, number] => [50 + s[0]!, s[1]! + s[3]!];

/** A point of the ride (one coordinate) drawn at `k` about the anchor's same coordinate `a`. */
export const scaledAt = (v: number, a: number, k: number): number => a + k * (v - a);

/**
 * Where the pawn sits on a frame with its ride drawn at `k` about `a` (seatAnchor), the pawn at its own size: moved so the
 * middle of its cut line (50, cut on its square, tilted with it) lands where that point of the saddle went. Its tilt and its
 * cut stay, so the same share of the pawn is hidden in the saddle at any size.
 */
export function scaledSeat(s: Seat, a: readonly [number, number], k: number): [number, number, number, number] {
  const [x, y, tilt, cut] = s as [number, number, number, number];
  if (k === 1) return [x, y, tilt, cut];
  // The cut line's middle on the pawn's square, tilted round its base (50, 88) as it's drawn (y down: clockwise).
  const r = (tilt * Math.PI) / 180;
  const d = cut - 88;
  const qx = 50 - d * Math.sin(r);
  const qy = 88 + d * Math.cos(r);
  return [scaledAt(x + qx, a[0], k) - qx, scaledAt(y + qy, a[1], k) - qy, tilt, cut];
}
