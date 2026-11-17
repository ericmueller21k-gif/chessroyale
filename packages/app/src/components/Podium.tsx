import { useLayoutEffect, useRef } from "preact/hooks";
import { CROWD_VOTES, type Settings } from "@chessroyale/core";
import { inCheck, legalMoves } from "@chessroyale/chess";
import { Avatar } from "./Items.tsx";
import { PlayerName } from "./PlayerName.tsx";
import { pawnLook } from "../looks.ts";
import { ordinal } from "../screens/StageBreak.tsx";
import { stagesAhead, type GameView, type Standing } from "../game.ts";

/** The podium's titles (the results message's `podium`; solo, the runner's crowdResults). */
export interface PodiumTitles {
  winner?: string;
  best: string | null;
}

/** "0.94": points given away a move, as the chart and the podium show them. */
const perMove = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(2));

/**
 * How the game ended, for the headline: "White wins by checkmate", "Black wins on the judge's verdict", "A draw", from the
 * board's last position and the game's winner (the move limit: the judge's verdict at Black's move `crowdMoveLimit`).
 */
export function endWords(winner: "w" | "b" | null | undefined, fen: string | null, s: Pick<Settings, "crowdMoveLimit">): string {
  const side = winner === "w" ? "White" : winner === "b" ? "Black" : null;
  const stuck = fen ? legalMoves(fen).length === 0 : false;
  const atLimit = !!fen && !!s.crowdMoveLimit && Number(fen.split(" ")[5]) > s.crowdMoveLimit;
  if (side) return stuck && fen && inCheck(fen) ? `${side} wins by checkmate` : atLimit ? `${side} wins on the judge's verdict` : `${side} wins`;
  return stuck ? "A draw by stalemate" : atLimit ? "A draw at the move limit" : "A draw";
}

/** "50 v 50 · Strong picks · Blitz": the mode, the pick vote's winner and the clock vote's, from the match's settings. */
export function modeLine(s: Settings): string {
  const pick = CROWD_VOTES.find((v) => v.id === "pick")?.options.find((o) => o.patch.crowdPick === s.crowdPick)?.label;
  const speed = CROWD_VOTES.find((v) => v.id === "speed")?.options.find((o) => o.patch.timeBankSeconds === s.timeBankSeconds && o.patch.timeIncrementSeconds === s.timeIncrementSeconds)?.label;
  return ["50 v 50", pick ? `${pick} picks` : null, speed?.split(" ")[0] ?? null].filter(Boolean).join(" · ");
}

/** One pedestal: the player's own dressed pawn in their side's color, name and points a move, the tags over it. */
function Step({ p, place, titles }: { p: Standing | undefined; place: 1 | 2 | 3; titles: PodiumTitles }) {
  const winner = !!p && titles.winner === p.id;
  const best = !!p && titles.best === p.id;
  return (
    <div class={`pod-step pod-${place}`}>
      <div class="pod-tags">
        {winner && <span class="pod-tag win">Winner</span>}
        {best && <span class="pod-tag best">Best player</span>}
      </div>
      <div class="pod-pawn">{p && <Avatar look={pawnLook(p).look} side={p.team === "b" ? "b" : "w"} outlined />}</div>
      <div class="pod-name">{p ? <PlayerName name={p.name} uid={p.uid} you={p.isYou} bot={p.isBot}>{p.isYou ? "You" : p.name}</PlayerName> : "—"}</div>
      <div class="pod-pts muted">{p ? `${perMove(p.perMove)} a move` : ""}</div>
      <div class="pod-block">{place}</div>
    </div>
  );
}

/**
 * The 50 v 50 rework's results (C3; mockup crowd-podium, the design's rule 6): the headline, the podium (1st tallest in the
 * middle, 2nd left, 3rd right), a fixed line naming the best player, your row (place, out at move, points a move; RP's spot greyed
 * until the ranks come, C5) and the chart of everyone in a fixed box that scrolls inside, your row pinned at its foot. Every box
 * has its size from the first frame: nothing moves as it fills (Eric's rules).
 */
export function CrowdPodium({ match, titles, gameWinner }: { match: GameView; titles: PodiumTitles; gameWinner?: "w" | "b" | null }) {
  const s = match.settings;
  const rows = [...match.standings()].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999));
  const at = (place: number) => rows.find((r) => r.placement === place);
  const me = rows.find((r) => r.isYou);
  const best = titles.best ? rows.find((r) => r.id === titles.best) : undefined;
  const fen = match.slots()[0]?.fen ?? null;
  const lastMove = fen ? Math.max(1, Number(fen.split(" ")[5]) - (fen.split(" ")[1] === "w" ? 1 : 0)) : null;
  const oneVOne = stagesAhead(s, 0, (s.openingMoves ?? 0) + 1).at(-1)?.from ?? null;
  const outAt = (r: Standing) => (r.outAtMove == null ? "End" : String(r.outAtMove));
  const place = (n: number | null | undefined) => (n ? `${n}${ordinal(n)}` : "—");
  // (The chart starts at its top; your row is pinned at its foot while it's below.)
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, []);
  return (
    <div class="podium">
      <p class="pod-mode muted">{modeLine(s)}</p>
      <h1 class="pod-head">{endWords(gameWinner, fen, s)}</h1>
      <p class="pod-sub muted">
        {lastMove ? `Move ${lastMove}` : ""}
        {lastMove && oneVOne && lastMove >= oneVOne ? ` · 1 v 1 from move ${oneVOne}` : ""}
      </p>
      <div class="pod-steps">
        <Step p={at(2)} place={2} titles={titles} />
        <Step p={at(1)} place={1} titles={titles} />
        <Step p={at(3)} place={3} titles={titles} />
      </div>
      <p class="pod-best">
        <span class="pod-star" aria-hidden="true">
          ★
        </span>{" "}
        {!best ? (
          <span class="muted">Best player: nobody played enough of the match</span>
        ) : best.id === titles.winner ? (
          <>
            <span class="muted">Best player:</span> the winner
          </>
        ) : (
          <>
            <span class="muted">Best player:</span> <strong>{best.isYou ? "You" : best.name}</strong>
            <span class="muted">
              {" "}
              · {place(best.placement)} · {perMove(best.perMove)} a move
            </span>
          </>
        )}
      </p>
      <div class="pod-you">
        <span class="pod-you-place">{place(me?.placement)}</span>
        <span class="pod-you-mid">
          <span>
            <strong>You</strong>
            <span class="muted"> · {me?.outAtMove == null ? "in at the end" : `out at move ${me.outAtMove}`}</span>
          </span>
          <span class="muted">{perMove(me?.perMove)} a move</span>
        </span>
        {/* (Rank points come with the 50 v 50's ranks, step C5: their place is kept, greyed, until then.) */}
        <span class="pod-rp" aria-disabled="true" title="Rank points come with the 50 v 50's ranks">
          <strong>— RP</strong>
          <span class="small">ranks soon</span>
        </span>
      </div>
      <div class="pod-chart" ref={box} role="table" aria-label={`All ${rows.length}`}>
        <div class="pod-row pod-title" role="row">
          <span>All {rows.length}</span>
          <span class="pod-right">Out at · a move</span>
        </div>
        <div class="pod-row pod-cols muted" role="row">
          <span>#</span>
          <span />
          <span>Player</span>
          <span class="pod-num">Out at</span>
          <span class="pod-num">Lost</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} class={`pod-row${r.isYou ? " you" : ""}`} role="row">
            <span>{r.placement ?? "—"}</span>
            <span class={`pod-dot ${r.team === "b" ? "b" : "w"}`} aria-label={r.team === "b" ? "Black" : "White"} />
            <span class="pod-player">
              {r.isYou ? "You" : r.name}
              {titles.best === r.id && <span class="pod-star"> ★</span>}
            </span>
            <span class="pod-num">{outAt(r)}</span>
            <span class="pod-num">{perMove(r.perMove)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
