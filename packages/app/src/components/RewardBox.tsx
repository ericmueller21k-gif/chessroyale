import type { JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { crateDef, hasRewards, rewardLines, type CrateLook, type XpGrant } from "@chessroyale/core";
import { refreshProfile } from "../account.ts";
import { play } from "../sound.ts";
import { BetaCrateArt, HunchessCrateArt, KeyArt, WinterCrateArt } from "./Items.tsx";

/**
 * What a game paid beside its XP (Nov 9, XP phase 2; core's XpRewards): the level-up's crates and key ("Level 8!"), every 10th
 * level's boss crate to choose, and the daily reward's crate. A box in the token box's look (TokenBox.tsx: the locker's dialog,
 * `role="dialog"`) over the result screen, once the XP box's bar has filled: the crate and the key with how many, and the lines
 * ("+2 Winter Crates · +1 crate key", "Daily reward: +1 Winter Crate", "Choose your boss crate in Crates."). OK (also Escape, or a
 * tap outside) closes it, and it doesn't come back for that game; the crates and keys are in your inventory already. A dialog, so
 * nothing on the result screen moves.
 */

/** The grants whose rewards box was closed: the same game's next screen (Squads' card, then its results) doesn't show it again. */
const seen = new WeakSet<XpGrant>();

const CRATE_ART: Record<CrateLook, () => JSX.Element> = { winter: WinterCrateArt, beta: BetaCrateArt, hunchess: HunchessCrateArt };

export function RewardBox({ xp }: { xp: XpGrant }) {
  const [open, setOpen] = useState(() => hasRewards(xp.rewards) && !seen.has(xp));
  const ok = useRef<HTMLButtonElement>(null);
  const close = () => {
    play("menuClose");
    seen.add(xp);
    setOpen(false);
  };
  // (A layout effect, as the token box's: an Escape the moment it shows closes it. The inventory's counts are fetched again.)
  useLayoutEffect(() => {
    if (!open) return;
    play("menuSelect");
    void refreshProfile().catch(() => undefined);
    ok.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const r = xp.rewards;
  if (!open || !r) return null;
  const crate = crateDef(r.crate);
  const lines = rewardLines(r, crate?.name ?? "Crate");
  const Crate = CRATE_ART[crate?.look ?? "winter"];
  const crates = r.daily + r.crates;
  const level = r.levels.at(-1);
  const title = level ? `Level ${level}!` : "Daily reward";
  return (
    <div class="locker-dialog-back" onClick={close}>
      <div class="ff-window locker-dialog gamble-dialog reward-box" role="dialog" aria-modal="true" aria-label={title} data-testid="reward-box" onClick={(e) => e.stopPropagation()}>
        <strong class="reward-title">{title}</strong>
        <div class="reward-art">
          {crates > 0 && (
            <span class="reward-thing" data-thing="crates">
              <span class="reward-thing-art">
                <Crate />
              </span>
              × {crates}
            </span>
          )}
          {r.keys > 0 && (
            <span class="reward-thing" data-thing="keys">
              <span class="reward-thing-art">
                <KeyArt />
              </span>
              × {r.keys}
            </span>
          )}
        </div>
        {lines.level && <p class="reward-line">{lines.level}</p>}
        {lines.daily && <p class="reward-line">Daily reward: {lines.daily}</p>}
        {lines.pick && <p class="reward-line reward-pick">{lines.pick} in Crates.</p>}
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" ref={ok} onClick={close}>
            ▶ OK
          </button>
        </div>
      </div>
    </div>
  );
}
