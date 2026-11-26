import { useLayoutEffect, useState } from "preact/hooks";
import { BOOST_CRATE_NAME, COIN_BOOST, boostCrateBlurb, boostLine, crateBonusLine } from "@chessroyale/core";
import { openBoostCrate } from "../account.ts";
import { play } from "../sound.ts";
import { CoinBoostCrateArt } from "./BoostArt.tsx";

/**
 * The coin boost in the Crates tab (Nov 26; the payments design's section 7; docs/decisions/2026-11-26-coin-boost.md):
 *   - **The boost lines**, under Keys and Crates, always there and greyed while off (shown, not hidden; their row keeps its place):
 *     "Coin boost: x2.5 coins · 95 min of play left" and "Crate bonus: 4 level-ups left".
 *   - **The Coin Boost Crate's row**: under Ready to open while you hold one, else greyed under More crates (as a series crate you don't
 *     hold). A tap opens its dialog: what it does, Open (greyed with none: free, no key) and Not now; opened, "Coin boost on" and OK.
 */

export function BoostStock({ minutes, levels }: { minutes: number; levels: number }) {
  return (
    <div class="crate-stock boost-stock-row">
      <span class={`stock boost-stock${minutes > 0 ? "" : " off"}`} data-testid="boost-line">
        {boostLine(minutes)}
      </span>
      <span class={`stock boost-stock${levels > 0 ? "" : " off"}`} data-testid="crate-bonus-line">
        {crateBonusLine(levels)}
      </span>
    </div>
  );
}

export function BoostCrateRow({ held, onOpen }: { held: number; onOpen: () => void }) {
  return (
    <button type="button" class={`ff-window crate-row boost-crate-row${held ? "" : " none"}`} data-crate="coin-boost" data-held={held} onClick={onOpen}>
      <span class="crate-row-art">
        <CoinBoostCrateArt />
      </span>
      <span class="crate-row-text">
        <strong>{BOOST_CRATE_NAME}</strong>
        <span class="crate-row-blurb">{boostCrateBlurb()}</span>
        <span class="crate-row-held">{held ? `You have ${held} · No key needed` : "You have none · Daily quests sometimes give one"}</span>
      </span>
      <span class="ff-cursor" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

/** The Coin Boost Crate's dialog: Open (greyed with none) or Not now; Escape, a tap outside or Not now close it. */
export function BoostCrateDialog({ held, minutes, onClose }: { held: number; minutes: number; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // (Its Escape is its own, heard first: nothing under it (the inventory layer, a screen) acts on it too. As the shop's pop-up.)
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopImmediatePropagation(), onClose());
    addEventListener("keydown", key, true);
    return () => removeEventListener("keydown", key, true);
  }, [onClose]);
  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await openBoostCrate();
      play("menuSelect");
      setOpened(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="locker-dialog-back" onClick={onClose}>
      <div class="ff-window locker-dialog boost-dialog" role="dialog" aria-modal="true" aria-labelledby="boost-dialog-title" data-testid="boost-dialog" onClick={(e) => e.stopPropagation()}>
        <span class="locker-dialog-art">
          <CoinBoostCrateArt />
        </span>
        <strong id="boost-dialog-title">{opened ? "Coin boost on!" : BOOST_CRATE_NAME}</strong>
        <p class="small">
          {opened
            ? `${COIN_BOOST.multiplier}x coins for your next ${minutes} minutes of play.`
            : `${COIN_BOOST.multiplier}x coins for your next ${COIN_BOOST.minutes} minutes of play. It counts down only while a game earns play coins, and it never runs out on its own. Another one adds ${COIN_BOOST.minutes} minutes.`}
        </p>
        {!opened && minutes > 0 && <p class="small">Your boost has {minutes} minutes left.</p>}
        {error && <p class="shop-error">{error}</p>}
        <div class="locker-dialog-actions">
          {opened ? (
            <button type="button" class="ff-button small" autoFocus onClick={onClose}>
              ▶ OK
            </button>
          ) : (
            <>
              <button type="button" class="ff-button small" disabled={busy || held <= 0} onClick={() => void open()}>
                ▶ Open
              </button>
              <button type="button" class="ff-button small" disabled={busy} autoFocus onClick={onClose}>
                ▶ Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
