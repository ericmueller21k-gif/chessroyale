import type { JSX } from "preact";
import { useLayoutEffect, useState } from "preact/hooks";
import { XP, crateDef, hasRewards, rewardLines, type CrateLook, type XpGrant } from "@chessroyale/core";
import { refreshProfile } from "../account.ts";
import { play } from "../sound.ts";
import { BetaCrateArt, HunchessCrateArt, KeyArt, WinterCrateArt } from "./Items.tsx";

/**
 * What a game paid beside its XP (Nov 9, XP phase 2; core's XpRewards): a level-up's crates and key ("Level 8!"), every 10th level's
 * boss crate to choose, and the daily reward's crate. A toast at the top of the result screen once the XP box's bar has filled (the
 * friends' invite toast's look): the crate and the key with how many, and the lines ("+2 Winter Crates · +1 crate key", "Daily
 * reward: +1 Winter Crate", "Choose your boss crate in Crates."). It takes no taps (whatever is under it stays tappable) and goes
 * after XP.rewardToastMs; it doesn't come back for that game, and the crates and keys are in your inventory already. Fixed over the
 * page, so nothing on the result screen moves.
 */

/** The grants whose toast has shown: the same game's next screen (Squads' card, then its results) doesn't show it again. */
const seen = new WeakSet<XpGrant>();

const CRATE_ART: Record<CrateLook, () => JSX.Element> = { winter: WinterCrateArt, beta: BetaCrateArt, hunchess: HunchessCrateArt };

export function RewardBox({ xp }: { xp: XpGrant }) {
  const [open, setOpen] = useState(() => hasRewards(xp.rewards) && !seen.has(xp));
  // (A layout effect: its sound plays as it shows, whatever screen replaces this one next. LESSONS.md.)
  useLayoutEffect(() => {
    if (!open) return;
    seen.add(xp);
    play("menuSelect");
    // (The inventory's counts, fetched again: the Crates tab shows them.)
    void refreshProfile().catch(() => undefined);
    const t = setTimeout(() => setOpen(false), XP.rewardToastMs);
    return () => clearTimeout(t);
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
    <div class="reward-toast" role="status" aria-label={title} data-testid="reward-box">
      <span class="reward-art">
        {crates > 0 && (
          <span class="reward-thing" data-thing="crates">
            <span class="reward-thing-art">
              <Crate />
            </span>
            ×{crates}
          </span>
        )}
        {r.keys > 0 && (
          <span class="reward-thing" data-thing="keys">
            <span class="reward-thing-art">
              <KeyArt />
            </span>
            ×{r.keys}
          </span>
        )}
      </span>
      <span class="reward-text">
        <strong class="reward-title">{title}</strong>
        {lines.level && <span class="reward-line">{lines.level}</span>}
        {lines.daily && <span class="reward-line">Daily reward: {lines.daily}</span>}
        {lines.pick && <span class="reward-line reward-pick">{lines.pick} in Crates.</span>}
      </span>
    </div>
  );
}
