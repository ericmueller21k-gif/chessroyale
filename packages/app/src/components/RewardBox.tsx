import type { JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { crateDef, hasRewards, rewardLines, type CrateLook, type XpGrant, type XpRewards } from "@chessroyale/core";
import { refreshProfile } from "../account.ts";
import { play } from "../sound.ts";
import { BetaCrateArt, HunchessCrateArt, KeyArt, WinterCrateArt } from "./Items.tsx";

/**
 * What a game paid beside its XP (Nov 9, XP phase 2; core's XpRewards): a paying level's crates and key ("Level 8!": every 2nd level
 * since Nov 20), every 20th level's boss crate to choose, the daily reward's crate and a quest's. **The Nov 22 mockup** (Eric: "more in
 * the ... UI scheme of ... when you open a crate ... more in the center of the screen, and it should pop more ... an OK, or ... go to
 * inventory"): once the XP box's bar has filled, a card in the crate screens' blue window (`ff-window`, the locker's dialog and its
 * dimmed back, as the token box), popping in as a crate's reveal does (`reveal-in`), centered, the crate and the key big with their
 * counts, the lines, then **OK** (Escape or a tap outside too) and **Go to inventory**: greyed with its reason while leaving would drop
 * you out (a Battle Tower run, a party; `away`). It doesn't come back for that game; the prizes are in your inventory already.
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

/** Why "Go to inventory" waits (Nov 22 mockup): leaving now would drop you out of a Battle Tower run or a party. */
export type RewardAway = "run" | "party" | null;
const AWAY_LINES: Record<"run" | "party", string> = { run: "After your run", party: "After the party" };

export function RewardBox({ xp, endScreen = false, away = null }: { xp: XpGrant; endScreen?: boolean; away?: RewardAway }) {
  const shown = xp.rewards ? (endScreen ? forEndScreen(xp.rewards) : xp.rewards) : null;
  const [open, setOpen] = useState(() => hasRewards(shown) && !seen.has(xp));
  const ok = useRef<HTMLButtonElement>(null);
  const close = () => {
    play("menuClose");
    setOpen(false);
  };
  // (A layout effect: its sound plays as it shows, whatever screen replaces this one next. LESSONS.md. And an Escape the moment it
  // shows closes it, as the token box's.)
  useLayoutEffect(() => {
    if (!open) return;
    seen.add(xp);
    play("menuSelect");
    ok.current?.focus();
    // (The inventory's counts, fetched again: the Crates tab shows them.)
    void refreshProfile().catch(() => undefined);
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
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
  // (The level reached, as the XP box pops it: since levels of 500 (Nov 20) only every other level pays, so the last paid may be one below.)
  const level = r.levels.length ? Math.max(xp.levelAfter, r.levels.at(-1)!) : undefined;
  const title = level ? `Level ${level}!` : done.length && !r.daily ? (done.length === 1 ? "Quest done!" : "Quests done!") : "Daily reward";
  // (The mockup's "Go to inventory": the Crates tab, by its own link. The build returns you to where you were with Back.)
  const toInventory = () => {
    play("menuSelect");
    location.assign("/shop?crates");
  };
  return (
    <div class="locker-dialog-back reward-veil" onClick={close}>
      <div class="ff-window locker-dialog reward-card" role="dialog" aria-modal="true" aria-label={title} data-testid="reward-box" onClick={(e) => e.stopPropagation()}>
        <h2 class="ff-title reward-title">{title}</h2>
        <span class="reward-art">
          {crates > 0 && (
            <span class="reward-thing" data-thing="crates">
              <span class="reward-thing-art">
                <Crate />
              </span>
              <span class="reward-count">×{crates}</span>
            </span>
          )}
          {keys > 0 && (
            <span class="reward-thing" data-thing="keys">
              <span class="reward-thing-art">
                <KeyArt />
              </span>
              <span class="reward-count">×{keys}</span>
            </span>
          )}
        </span>
        <span class="reward-text">
          {lines.level && <span class="reward-line">{lines.level}</span>}
          {lines.daily && <span class="reward-line">Daily reward: {lines.daily}</span>}
          {lines.quests.map((q) => (
            <span key={q} class="reward-line reward-quest">
              {q}
            </span>
          ))}
          {lines.pick && <span class="reward-line reward-pick">{lines.pick} in Crates.</span>}
          <span class="reward-line reward-kept">Already in your inventory.</span>
        </span>
        <div class="locker-dialog-actions">
          <button type="button" class="ff-button small" ref={ok} onClick={close}>
            ▶ OK
          </button>
          {/* (Shown always, greyed with its reason while leaving would drop you out: nothing hidden.) */}
          <button type="button" class="ff-button small reward-inventory" disabled={!!away} onClick={toInventory}>
            ▶ Go to inventory
          </button>
          <span class="reward-why" aria-live="polite">
            {away ? AWAY_LINES[away] : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
