import { RANKED_1V1, rankSteps, type RankView } from "@chessroyale/core";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { RankEmblem } from "./RankEmblem.tsx";
import { Sheet } from "./Sheet.tsx";

/** A 1 v 1 rank as a small pill in its tier's color: "Gold II – 45", "Transcendent – 120", "Placement 2/5". */
export function DuelRankPill({ rank, class: cls = "" }: { rank: RankView; class?: string }) {
  return (
    <span class={`dv-rank ${cls}`} style={{ "--rank": rank.color }}>
      {rank.label}
    </span>
  );
}

/**
 * A player's rank in a 1 v 1 game's strip (Eric, Nov 25: "the emblem next to everyone... click on someone's rank and then it shows the
 * list of rankings"): their emblem (its box always there, empty in placements, as on the stage) and the pill, one button
 * that opens the Ranks pop-up with their rank marked. Ranked games only: a town or bot game keeps its pill alone (Duel.tsx DuelStrip).
 */
export function DuelRankButton({ rank, who }: { rank: RankView; who: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" class="dv-rank-btn" aria-label={`${who}: ${rank.label}. All ranks`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span class="dv-strip-emblem">
          <RankEmblem rank={rank} />
        </span>
        <DuelRankPill rank={rank} />
      </button>
      {/* (On the body: a strip's column may be contained, and a fixed sheet inside it would be cut to it.) */}
      {open && createPortal(<RanksSheet rank={rank} who={who} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** Every rank, the highest first, each with its emblem and the RP it starts at; `rank`'s own marked (placements: the last row). */
export function RanksSheet({ rank, who, onClose }: { rank: RankView; who: string; onClose: () => void }) {
  const list = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    // (The list alone scrolls, the marked row to its middle: scrollIntoView would scroll the sheet too, its title and ✕ out of view.)
    const ol = list.current;
    const row = ol?.querySelector<HTMLElement>("[aria-current]");
    if (ol && row) ol.scrollTop = row.offsetTop - (ol.clientHeight - row.offsetHeight) / 2;
  }, []);
  const placing = rank.placement !== null;
  const tag = (on: boolean) => on && <span class="rk-who">{who}</span>;
  return (
    <Sheet id="rk-title" title="Ranks" onClose={onClose} class="rk-sheet">
      <p class="rk-line">
        Each division is {RANKED_1V1.pointsPerDivision} RP. The top two are the top {RANKED_1V1.topTiers.map((t) => t.top).sort((a, b) => b - a).join(" and top ")} players from {RANKED_1V1.topFloor} RP.
        Each rank's Elo is a rough approximation.
      </p>
      <ol class="rk-list" ref={list}>
        {rankSteps()
          .reverse()
          .map((r) => {
            const on = !placing && rank.emblem === r.emblem;
            return (
              <li key={r.emblem} class={`rk-row${on ? " on" : ""}`} style={{ "--rank": r.color }} aria-current={on ? "true" : undefined}>
                <RankEmblem id={r.emblem} />
                <span class="rk-title">
                  <span class="rk-name">{r.title}</span>
                  <span class="rk-elo">≈ {r.elo.to === null ? `${r.elo.from}+` : `${r.elo.from}–${r.elo.to}`} Elo</span>
                </span>
                {tag(on)}
                <span class="rk-from">{r.top ? `Top ${r.top} · ` : ""}{r.from} RP</span>
              </li>
            );
          })}
        <li class={`rk-row rk-placing${placing ? " on" : ""}`} aria-current={placing ? "true" : undefined}>
          <RankEmblem id={null} />
          <span class="rk-title">
            <span class="rk-name">Placement</span>
          </span>
          {tag(placing)}
          <span class="rk-from">First {RANKED_1V1.placements.games} games</span>
        </li>
      </ol>
    </Sheet>
  );
}
