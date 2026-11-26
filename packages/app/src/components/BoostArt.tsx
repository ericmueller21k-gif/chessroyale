import { COIN_BOOST } from "@chessroyale/core";
import { Coin } from "./Coin.tsx";
import { HunchessCrateArt, WinterCrateArt } from "./Items.tsx";

/**
 * Placeholder art for the coin boost and the Crate Bonus (Nov 26; docs/decisions/2026-11-26-coin-boost.md): existing drawings, no new
 * ones (the director orders the art runner's separately: the payments design's section 7, "Art for the API runner"). Each fills its box.
 *   - The Coin Boost Crate: the HunChess crate, the coin on its corner and a "x2.5" tag.
 *   - The Crate Bonus: the Winter Crate with a gold "x2" tag.
 */
export function CoinBoostCrateArt() {
  return (
    <span class="boost-art" aria-hidden="true">
      <HunchessCrateArt />
      <span class="boost-art-coin">
        <Coin size={40} />
      </span>
      <span class="boost-art-tag">x{COIN_BOOST.multiplier}</span>
    </span>
  );
}

export function CrateBonusArt() {
  return (
    <span class="boost-art" aria-hidden="true">
      <WinterCrateArt />
      <span class="boost-art-tag">x2</span>
    </span>
  );
}
