/**
 * The crate opening's one timeline (Nov 24; the mockup's, approved: docs/decisions/2026-11-24-crate-open-build.md), read by the
 * picture (CrateOpenStage.tsx: Web Animations) and the sound (sounds.ts: buffers scheduled on the audio clock), so they stay in step.
 *
 * Presentation only: the roll, the odds and the server call are the game's (Crates.tsx `CrateOpening`), untouched. The strip's tiles
 * and where it lands are the game's (46 tiles landing on the 39th; Fischer Random's second strip 30 landing on the 25th).
 */
import { CRATE_OPEN, type ItemTier } from "@chessroyale/core";

/** The strip's geometry, as the game draws it (styles.css `.spin-tile`: 96 px wide, 6 px apart). */
export const TILE_STEP = 96 + 6;
/** A crate's strip, and Fischer Random's second one: how many tiles, and which one it lands on. */
export const STRIPS = { crate: { tiles: 46, land: 38 }, fischer: { tiles: 30, land: 24 } } as const;

/**
 * Every beat, in ms from the first frame of the spin. `spinMs` (CRATE_OPEN.spinMs) is the only one a player would feel as "length".
 * `box`: a crate's present drops in, shakes and opens; without it (Fischer Random's second strip) the beam comes straight up out of
 * the winning tile.
 */
export function timeline(spinMs: number = CRATE_OPEN.spinMs, box = true) {
  const settleMs = 220; // the strip's overshoot settling back onto the winner (the last click)
  const stop = spinMs + settleMs;
  const dropAt = stop + 60; // the box drops into the middle as the strip dims away
  const dropMs = 260;
  const landAt = dropAt + dropMs; // it lands (a thud, a squash)
  const shakeMs = 440; // it shakes harder and harder, light leaking from its seams
  const burstAt = box ? landAt + shakeMs : stop + 260; // the lid bursts off (or the tile flares), the beam shoots up (the sting)
  const riseAt = burstAt + 180; // the item rises into the beam
  const riseMs = 650;
  const cardAt = riseAt + riseMs - 120; // the reveal card forms round it
  const cardMs = 340;
  const bannerAt = stop + 450; // Transcendent's banner comes up (a strip that lands on it: no box, no item), with its sound
  return { spinMs, settleMs, stop, dropAt, dropMs, landAt, shakeMs, burstAt, riseAt, riseMs, cardAt, cardMs, bannerAt, box };
}
export type Timeline = ReturnType<typeof timeline>;

/**
 * The bonus crate's card (Nov 24; docs/decisions/2026-11-24-bonus-crate.md): a beat after the item's card has formed (`afterCardMs`), the
 * item's stage dims and a short gold beam shoots up (`beamMs`), the bonus card forming over it (`cardAt`, `cardMs`), the beam then
 * fading back. In ms from the bonus's own start. `calmMs` (the review, Nov 25): after its OK, how long the item's card's buttons stay
 * inert (a double tap on OK, which sits over "Open another", opens nothing).
 */
export const BONUS = { afterCardMs: 700, beamMs: 320, cardAt: 160, cardMs: 340, calmMs: 300 } as const;

/**
 * How far the strip has moved at `u` (0 to 1 of the spin), as a share of the distance: a cubic ease-out (the old strip's quartic left
 * its last third a silent crawl inside the winning tile: its last click came at 66% of the spin). It lands just past the winning
 * tile's near edge (`LAND_AT`), so the last click comes late (about 80%): the strip creeps over the last edge and stops, the near miss.
 */
export const EASE_POWER = 3;
export const stripEase = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), EASE_POWER);
/** Where the line stops in the winning tile, in tiles from its middle (-0.5 its near edge): just past the near edge (Eric, Nov 24: kept). */
export const LAND_AT = -0.3;
/** How far (px) the strip runs past its stop before settling back onto it. */
export const OVERSHOOT = 12;

/** Where the strip stops (px of travel) for a window `width` px wide landing on tile `land`. */
export const stripTarget = (width: number, land: number) => land * TILE_STEP + TILE_STEP / 2 - width / 2 + LAND_AT * TILE_STEP;

/**
 * The strip's clicks: the moments (ms) a tile edge crosses the center line, for a window `width` px wide landing on tile `land`.
 * Worked out ahead, so the sound is laid on the audio clock instead of a frame loop.
 */
export function clickTimes(spinMs: number, width: number, land: number): number[] {
  const peak = stripTarget(width, land) + OVERSHOOT;
  const out: number[] = [];
  // Tile edge k (the left edge of tile k) crosses the center line when x + width/2 = k * step.
  const first = Math.floor(width / 2 / TILE_STEP) + 1;
  for (let k = first; ; k++) {
    const x = k * TILE_STEP - width / 2;
    if (x > peak) break;
    // x = peak * ease(u)  =>  u = 1 - (1 - x/peak)^(1/power)
    const u = 1 - Math.pow(1 - x / peak, 1 / EASE_POWER);
    out.push(u * spinMs);
  }
  return out;
}

/** Legendary and Mythic get the big ending (more light, a flash, the stage jolting, the bigger sting). */
export const isBig = (t: ItemTier) => t === "legendary" || t === "mythic";
/** How much light each tier gets (0 to 1): a Common's beam is short and soft, a Mythic's fills the screen. */
export const TIER_POWER: Record<ItemTier, number> = { common: 0.35, uncommon: 0.5, rare: 0.65, epic: 0.8, legendary: 1, mythic: 1 };

/** One of the opening's sounds (sounds.ts) and when it starts (ms from the spin's first frame). */
export type CrateCue = { at: number; sound: string };

/** How heavy a tick is, by the gap (ms) to the next: 0 (light, at full speed) to 5 (the reel's full weight, slow). */
export function tickLevel(gap: number): number {
  return gap < 25 ? 0 : gap < 45 ? 1 : gap < 70 ? 2 : gap < 120 ? 3 : gap < 200 ? 4 : 5;
}

/**
 * Every sound of one strip and what follows it, as cues: the reel's hum, a tick per click (alternating two takes so a run doesn't
 * sound looped) and the lock at the stop (no swell: Eric, Nov 24, no charge-up) (the spin is sound C's, the slot reel: Eric, Nov 24); then, if
 * `tier` (the strip that ends in the item; "transcendent" for one landing on Transcendent: its sound as its banner comes up): the box landing and shaking (with a box) and the sting (sound A's ending). The live opening
 * and the clip script play the same list.
 */
export function cues(T: Timeline, clicks: readonly number[], tier: ItemTier | "transcendent" | null): CrateCue[] {
  const out: CrateCue[] = [
    { at: 0, sound: "whirr" },
  ];
  clicks.forEach((ms, i) => {
    const gap = Math.min((clicks[i + 1] ?? ms + 400) - ms, 400);
    out.push({ at: ms, sound: `tick${tickLevel(gap)}${i % 2 ? "b" : "a"}` });
  });
  out.push({ at: T.stop - 40, sound: "lock" });
  // (A strip landing on Transcendent: its own sound as its banner comes up, in place of the banner's usual whoosh; Nov 24.)
  if (tier === "transcendent") out.push({ at: T.bannerAt, sound: "transcendent" });
  if (!tier || tier === "transcendent") return out;
  if (T.box) {
    out.push({ at: T.dropAt, sound: "land" });
    out.push({ at: T.landAt + 60, sound: `shake-${tier}` });
  }
  out.push({ at: T.burstAt, sound: `sting-${tier}` });
  return out;
}
