import { useEffect, useRef, useState } from "preact/hooks";
import { cutLabel, roundLive, towerView, type GameView } from "../game.ts";
import { LeaderboardSheet } from "./LeaderboardSheet.tsx";
import { RaceTower } from "./RaceTower.tsx";
import { pickRows } from "../pick-rows.ts";

const KEY = "brc.miniTower";
const ROW = 22;
const HEAD = 18;

/** Height the tower takes for a set of rows (rows, "⋯" gaps and the cut line), matching RaceTower's layout. */
function towerHeight(keep: Set<number>, cutoff: number, n: number): number {
  const idx = [...keep].sort((a, b) => a - b);
  let h = HEAD + idx.length * ROW;
  idx.forEach((i, k) => {
    if (k > 0 && i - idx[k - 1]! > 1) h += ROW * 0.6;
    if (cutoff < n && i === cutoff) h += 10;
  });
  return h;
}

/**
 * The phone's scoreboard under the board. It never scrolls: it shows as many
 * players as fit (you, the leaders, your neighbours and the cut line first),
 * with position, name, points, average, rating and power-ups. Tap it for the
 * full leaderboard; the header's arrow minimises it (remembered on the device).
 */
export function MiniTower({ match }: { match: GameView }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [sheet, setSheet] = useState(false);
  const [space, setSpace] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSpace(el.clientHeight));
    ro.observe(el);
    setSpace(el.clientHeight);
    return () => ro.disconnect();
  }, [open]);

  const view = towerView(match);
  const standings = view.standings;
  const cutoff = view.cutoff;
  const alive = standings.filter((s) => !s.out);
  const rank = alive.findIndex((s) => s.isYou);
  // On a computer-sized panel the box has a fixed height; fill it too.
  const keep = pickRows(alive.length, rank, cutoff, (k) => towerHeight(k, cutoff, alive.length) <= Math.max(space, HEAD + ROW * 3));

  const toggle = (e: Event) => {
    e.stopPropagation();
    setOpen(!open);
    try {
      localStorage.setItem(KEY, open ? "0" : "1");
    } catch {
      // Not important.
    }
  };

  return (
    <section class={`mini-tower${open ? "" : " closed"}`} aria-label="Leaderboard">
      <div class="mini-tower-head">
        <button type="button" class="mini-tower-title" onClick={() => setSheet(true)}>
          {view.teamLabel ?? "Leaderboard"} <span class="muted">· tap for all {alive.length}</span>
        </button>
        <button type="button" class="mini-tower-toggle" onClick={toggle} aria-expanded={open} aria-label={open ? "Minimise the leaderboard" : "Show the leaderboard"}>
          {open ? "▾" : "▴"}
        </button>
      </div>
      {open && (
        <div class="mini-tower-body" ref={body} onClick={() => setSheet(true)}>
          <RaceTower standings={standings} cutoff={cutoff} mini keep={keep} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} />
        </div>
      )}
      {sheet && <LeaderboardSheet match={match} onClose={() => setSheet(false)} />}
    </section>
  );
}
