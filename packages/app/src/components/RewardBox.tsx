import type { JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { crateDef, hasRewards, rewardLines, type CrateLook, type XpGrant, type XpRewards } from "@chessroyale/core";
import { refreshProfile } from "../account.ts";
import { play } from "../sound.ts";
import { BetaCrateArt, HunchessCrateArt, KeyArt, WinterCrateArt } from "./Items.tsx";
import { InventoryLayer } from "./PageLayer.tsx";

/**
 * What a game paid beside its XP (Nov 9, XP phase 2; core's XpRewards): a paying level's crates and key ("Level 8!": every 2nd level
 * since Nov 20), every 20th level's boss crate to choose, the daily reward's crate and a quest's. **The reward card** (Nov 22; Eric:
 * "more in the ... UI scheme of ... when you open a crate ... more in the center of the screen, and it should pop more ... an OK, or ...
 * go to inventory"): once the XP box's bar has filled, a card in the crate screens' blue window (`ff-window`, the locker's dialog and
 * its dimmed back, as the token box), popping in as a crate's reveal does (`reveal-in`), centered, the crate and the key big with their
 * counts, the lines, then **OK** (Escape or a tap outside too) and **Go to inventory**: your inventory's Crates tab as a layer over this
 * screen (`InventoryLayer`), so a Battle Tower run or a party stays as it was; its Back returns here. Never greyed. It doesn't come back
 * for that game; the prizes are in your inventory already. docs/decisions/2026-11-22-inventory-layer.md.
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
  /** "Go to inventory" tapped: the card gives way to the inventory layer, which closes back to this screen. */
  const [inventory, setInventory] = useState(false);
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
  if (inventory) return <InventoryLayer onClose={() => setInventory(false)} />;
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
  // (Over this screen, not to the shop's page: nothing under it unmounts.)
  const toInventory = () => {
    play("menuSelect");
    setOpen(false);
    setInventory(true);
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
          <button type="button" class="ff-button small reward-inventory" onClick={toInventory}>
            ▶ Go to inventory
          </button>
        </div>
      </div>
    </div>
  );
}
