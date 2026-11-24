/**
 * MOCKUP (claude/crate-open-mockup, Nov 24; never on main as is): one timeline for the overhauled crate opening, read by both the
 * mockup page (crate-open-preview.tsx) and the sound options (crate-open-sounds.ts), so the picture and the clips stay in step.
 *
 * Presentation only: the roll, the odds and the server call are the game's (Crates.tsx `CrateOpening`), untouched. The strip's tiles
 * and where it lands are the game's too (46 tiles, landing on the 39th); only how it moves, looks and sounds changes.
 */
import type { ItemTier } from "@chessroyale/core";

/** The strip's geometry, as the game draws it (styles.css `.spin-tile`: 96 px wide, 6 px apart). */
export const STRIP = { tiles: 46, land: 38, tile: 96, gap: 6 } as const;

/** Every beat, in ms from the first frame of the spin. `spinMs` is the only one a player would feel as "length". */
export function timeline(spinMs = 2700) {
  const settleMs = 220; // the strip's overshoot settling back onto the winner (the last click)
  const stop = spinMs + settleMs;
  const lift = stop; // the winning tile lifts and flares
  const dropAt = stop + 60; // the box drops into the middle as the strip dims away
  const dropMs = 260;
  const landAt = dropAt + dropMs; // it lands (a thud, a squash)
  const shakeMs = 440; // it shakes harder and harder, light leaking from its seams
  const burstAt = landAt + shakeMs; // the lid bursts off, the beam shoots up (the sting)
  const riseAt = burstAt + 180; // the item rises out of the box into the beam
  const riseMs = 650;
  const cardAt = riseAt + riseMs - 120; // the reveal card forms round it
  const end = burstAt + 1300; // the clips' end (the sting's tail); the page holds the card after
  return { spinMs, settleMs, stop, lift, dropAt, dropMs, landAt, shakeMs, burstAt, riseAt, riseMs, cardAt, end };
}
export type Timeline = ReturnType<typeof timeline>;

/**
 * How far the strip has moved at `u` (0 to 1 of the spin), as a share of the distance. The game's is a quartic ease-out, which
 * leaves its last third a silent crawl inside the winning tile (no edge crosses the line: measured, the last click at 66% of the
 * spin). The mockup's is a cubic, and it lands just past the winning tile's near edge (`LAND_JITTER`), so the last click comes
 * late (about 80%): the strip creeps over the last edge and stops, the near miss that makes a reel exciting.
 */
export const EASE_POWER = 3;
export const stripEase = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), EASE_POWER);
/** Where the line stops in the winning tile, in tiles from its middle (-0.5 its near edge): just past the near edge. */
export const LAND_JITTER = -0.3;
/** How far (px) the strip runs past its stop before settling back onto it. */
export const OVERSHOOT = 12;

/**
 * The strip's clicks: the moments (ms) a tile edge crosses the center line, for a strip `width` px wide landing `jitter` (-0.3 to
 * 0.3 of a tile) off the winner's middle. The game clicks on the same crossings (it compares tile indices each frame); worked out
 * ahead here, so the sound can be laid on the audio clock instead of a frame loop.
 */
export function clickTimes(spinMs: number, width: number, jitter: number, overshoot: number): number[] {
  const step = STRIP.tile + STRIP.gap;
  const target = STRIP.land * step + step / 2 - width / 2 + jitter * step;
  const peak = target + overshoot;
  const out: number[] = [];
  // Tile edge k (the left edge of tile k) crosses the center line when x + width/2 = k * step.
  const first = Math.floor(width / 2 / step) + 1;
  for (let k = first; ; k++) {
    const x = k * step - width / 2;
    if (x > peak) break;
    // x = peak * ease(u)  =>  u = 1 - (1 - x/peak)^(1/power)
    const u = 1 - Math.pow(1 - x / peak, 1 / EASE_POWER);
    out.push(u * spinMs);
  }
  return out;
}

/** The tiers, lowest first, as the game names them (core's TIERS). Legendary and Mythic get the big ending. */
export const BIG_TIERS: readonly ItemTier[] = ["legendary", "mythic"];
export const isBig = (t: ItemTier) => BIG_TIERS.includes(t);
/** How much light each tier gets (0 to 1): a Common's beam is short and soft, a Mythic's fills the screen. */
export const TIER_POWER: Record<ItemTier, number> = { common: 0.35, uncommon: 0.5, rare: 0.65, epic: 0.8, legendary: 1, mythic: 1 };
