import type { RankView } from "@chessroyale/core";
import { useState } from "preact/hooks";
import { RankEmblem } from "./RankEmblem.tsx";
import { RanksPopup } from "./RanksPopup.tsx";

/**
 * A 1 v 1 rank as a small pill in its tier's color: "Gold 2 · 45 RP", "Transcendent · 120 RP", "Placement 2/5".
 * MOCKUP (Nov 25): its emblem beside it, and a tap opens "Ranks" (RanksPopup) with this player's spot lit.
 */
export function DuelRankPill({ rank, class: cls = "", who = "" }: { rank: RankView; class?: string; who?: string }) {
  const [open, setOpen] = useState(false);
  // (The mockup's stills: a rank to show for a name, `window.__mockRank`, so a fresh test account reads "Illustrious 4 · 67 RP".)
  rank = (globalThis as { __mockRank?: Record<string, RankView> }).__mockRank?.[who] ?? rank;
  return (
    <>
      <button type="button" class="dv-rank-btn" aria-label={`${rank.label}: what ranks mean`} onClick={() => setOpen(true)}>
        <RankEmblem rank={rank} />
        <span class={`dv-rank ${cls}`} style={{ "--rank": rank.color }}>
          {rank.label}
        </span>
      </button>
      {open && <RanksPopup rank={rank} who={who} onClose={() => setOpen(false)} />}
    </>
  );
}
