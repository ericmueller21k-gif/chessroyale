import type { RankView } from "@chessroyale/core";

/** A 1 v 1 rank as a small pill in its tier's color: "Gold II – 45", "Transcendent – 120", "Placement 2/5". */
export function DuelRankPill({ rank, class: cls = "" }: { rank: RankView; class?: string }) {
  return (
    <span class={`dv-rank ${cls}`} style={{ "--rank": rank.color }}>
      {rank.label}
    </span>
  );
}
