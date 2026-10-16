import type { ComponentChildren } from "preact";
import type { ItemLook, RankView } from "@chessroyale/core";
import { DressedPawn } from "./FrontDoor.tsx";
import { DuelRankPill } from "./DuelRankPill.tsx";

/**
 * Ranked 1 v 1's stage (Eric, Oct 16: "your character's sitting there, and then there's like kind of this empty
 * platform thing like waiting, and then when your opponent joins, like their pawn loads up next to you"). Your big
 * dressed pawn on a platform on the left; on the right an empty platform with a quiet waiting pulse until the
 * opponent's pawn drops onto it, with their name and rank. The search and the versus moment are this one stage, so
 * nothing on it moves when the opponent arrives: their pawn, name and rank are all that appear.
 *
 * Only transforms and opacity animate (styles `dv-st-`); `prefers-reduced-motion` turns every animation off.
 */

export interface StageSide {
  name: string;
  look: ItemLook | null | undefined;
  rank: RankView | null;
}

/** One side: the pawn standing on its platform, and under it the name and rank (or what the empty side says). */
function Spot({ who, side, waiting }: { who: StageSide | null; side: "you" | "them"; waiting?: ComponentChildren }) {
  return (
    <div class={`dv-st-side dv-st-${side}${who ? " on" : ""}`}>
      <div class="dv-st-spot">
        <span class="dv-st-plat" aria-hidden="true" />
        {who ? (
          // (Its own key: the opponent's pawn mounts when they arrive, so its drop plays then, once.)
          <span class="dv-st-pawn" key="pawn">
            <span class="dv-st-idle">
              <DressedPawn look={who.look ?? undefined} size="stage" />
            </span>
          </span>
        ) : (
          <span class="dv-st-empty" key="empty" aria-hidden="true">
            <span class="dv-st-ring" />
            <span class="dv-st-ring two" />
            <span class="dv-st-ghost">
              <DressedPawn size="stage" />
            </span>
          </span>
        )}
      </div>
      <div class="dv-st-id" aria-live={side === "them" ? "polite" : undefined}>
        {who ? (
          <>
            <strong class="dv-st-name">{who.name}</strong>
            {who.rank && <DuelRankPill rank={who.rank} class="dv-st-rank" />}
          </>
        ) : (
          waiting
        )}
      </div>
    </div>
  );
}

/**
 * The stage: `you` on the left, `them` (null while searching) on the right, "VS" between once they're there.
 * `waiting`: what the empty side says. `head` above, `children` under it (the line, the choices, Cancel).
 */
export function DuelStage({ you, them, waiting, head, children, label }: { you: StageSide; them: StageSide | null; waiting: ComponentChildren; head?: ComponentChildren; children?: ComponentChildren; label: string }) {
  return (
    <section class={`dv-stage${them ? " dv-versus" : " dv-search"}`} aria-label={label}>
      {head && <header class="dv-st-head">{head}</header>}
      <div class="dv-st-row">
        <div class="dv-st-pair">
          <Spot who={you} side="you" />
          {them && (
            <span class="dv-st-vs" aria-hidden="true">
              VS
            </span>
          )}
          <Spot who={them} side="them" waiting={waiting} />
        </div>
      </div>
      <div class="dv-st-foot">{children}</div>
    </section>
  );
}
