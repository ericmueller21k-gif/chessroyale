import type { JSX } from "preact";
import { useLayoutEffect, useState } from "preact/hooks";
import { XP, crateDef, hasRewards, rewardLines, type CrateLook, type XpGrant, type XpRewards } from "@chessroyale/core";
import { refreshProfile } from "../account.ts";
import { play } from "../sound.ts";
import { BetaCrateArt, HunchessCrateArt, KeyArt, WinterCrateArt } from "./Items.tsx";

/**
 * What a game paid beside its XP (Nov 9, XP phase 2; core's XpRewards): a level-up's crates and key ("Level 8!"), every 10th level's
 * boss crate to choose, and the daily reward's crate. A toast at the top of the result screen once the XP box's bar has filled (the
 * friends' invite toast's look): the crate and the key with how many, and the lines ("+1 Winter Crate · +1 crate key", "Daily
 * reward: +1 Winter Crate", "Choose your boss crate in Crates."). It takes no taps (whatever is under it stays tappable) and goes
 * after XP.rewardToastMs; phase 3 adds a quest the game completed ("Quest done: Boss Hunter +300 XP"). It doesn't come back for that game, and the crates and keys are in your inventory already. Fixed over the
 * page, so nothing on the result screen moves.
 */

/** The grants whose toast has shown: the same game's next screen (Squads' card, then its results) doesn't show it again. */
const seen = new WeakSet<XpGrant>();

const CRATE_ART: Record<CrateLook, () => JSX.Element> = { winter: WinterCrateArt, beta: BetaCrateArt, hunchess: HunchessCrateArt };

/**
 * The end screen's (Nov 20): its rows show each quest done and its XP, and its bar the level, so the toast shows only the things they
 * don't: the crates and keys (a level's, the daily reward's, a quest's) and a boss crate to choose. Nothing of those: no toast.
 */
function forEndScreen(r: XpRewards): XpRewards | null {
  const quests = (r.quests ?? []).filter((q) => q.crates > 0 || q.keys > 0);
  const out: XpRewards = { ...r, quests: quests.length ? quests : undefined };
  if (!out.quests) delete out.quests;
  return out.daily > 0 || out.crates > 0 || out.keys > 0 || out.bossPicks > 0 || !!out.quests ? out : null;
}

export function RewardBox({ xp, endScreen = false }: { xp: XpGrant; endScreen?: boolean }) {
  const shown = xp.rewards ? (endScreen ? forEndScreen(xp.rewards) : xp.rewards) : null;
  const [open, setOpen] = useState(() => hasRewards(shown) && !seen.has(xp));
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
  const r = shown;
  if (!open || !r) return null;
  const crate = crateDef(r.crate);
  const lines = rewardLines(r, crate?.name ?? "Crate");
  // (The end screen: a quest's line names it and its crates and keys; its XP is in the quest's row.)
  if (endScreen) lines.quests = lines.quests.map((q) => q.replace(/ \+[\d,]+\u00a0XP/, ""));
  const Crate = CRATE_ART[crate?.look ?? "winter"];
  // (Phase 3: a quest's crates and keys join the counts, its line says which quest: "Quest done: Boss Hunter +300 XP".)
  const done = r.quests ?? [];
  const crates = r.daily + r.crates + done.reduce((n, q) => n + q.crates, 0);
  const keys = r.keys + done.reduce((n, q) => n + q.keys, 0);
  const level = r.levels.at(-1);
  const title = level ? `Level ${level}!` : done.length && !r.daily ? (done.length === 1 ? "Quest done!" : "Quests done!") : "Daily reward";
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
        {keys > 0 && (
          <span class="reward-thing" data-thing="keys">
            <span class="reward-thing-art">
              <KeyArt />
            </span>
            ×{keys}
          </span>
        )}
      </span>
      <span class="reward-text">
        <strong class="reward-title">{title}</strong>
        {lines.level && <span class="reward-line">{lines.level}</span>}
        {lines.daily && <span class="reward-line">Daily reward: {lines.daily}</span>}
        {lines.quests.map((q) => (
          <span key={q} class="reward-line reward-quest">
            {q}
          </span>
        ))}
        {lines.pick && <span class="reward-line reward-pick">{lines.pick} in Crates.</span>}
      </span>
    </div>
  );
}
