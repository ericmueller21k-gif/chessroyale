import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { cutLabel, myTeam, roundLive, scoreDp, towerView, type GameView, type TeamPick } from "../game.ts";
import { LeaderboardSheet } from "./LeaderboardSheet.tsx";
import { RaceTower } from "./RaceTower.tsx";
import { pickRows } from "../pick-rows.ts";
import type { ChatFloat } from "../chat.ts";
import { foldUnderBoard, onPrefsChange, underBoardView } from "../prefs.ts";

const ROW = 22;
const HEAD = 18;

/** The team each match's scoreboard shows (Black, White or All): picked on the scoreboard, your team when it starts. */
const picks = new WeakMap<object, TeamPick>();
const PICK_LABEL: Record<TeamPick, string> = { b: "Black", w: "White", all: "All" };

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
 * players as fit (you, the leaders, your neighbors and the cut line first),
 * with position, name, points, average, rating and power-ups. Its header picks
 * the team it shows: Black, White or All (your team when the match starts, in
 * white; the others grey). Tapping the picked one, or the rows, opens the full
 * list for that pick; the header's arrow folds it to that header (the space under the board's one remembered view,
 * prefs.ts: underBoardView).
 *
 * It's placed by the space under the board (components/QuickChat.tsx, UnderBoard), which passes `open` (that view's)
 * and `head` (the fold arrow; with chat, the split buttons and the unread count too), and with chat beside it
 * `narrow` (place, name and points only) and `floats` (emoji just sent, floating above their senders' rows, or from
 * the header when the row isn't shown).
 */
export function MiniTower({
  match,
  narrow = false,
  head,
  open: openProp,
  floats,
}: {
  match: GameView;
  narrow?: boolean;
  head?: ComponentChildren;
  open?: boolean;
  floats?: ReadonlyMap<string, ChatFloat>;
}) {
  // (Without `open` from its place, the space under the board's view, kept in step.)
  const [own, setOwn] = useState(() => underBoardView().open);
  useEffect(() => (openProp === undefined ? onPrefsChange(() => setOwn(underBoardView().open)) : undefined), [openProp === undefined]);
  const open = openProp ?? own;
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

  // (In a team match, the header picks the team; a boss battle and a match without teams show what they always did.)
  const you = myTeam(match);
  const teamed = !match.boss && you !== null;
  const [, redraw] = useState(0);
  const pick: TeamPick = picks.get(match) ?? you ?? "all";
  const choose = (p: TeamPick) => {
    picks.set(match, p);
    redraw((n) => n + 1);
  };
  const view = towerView(match, teamed ? pick : undefined);
  const standings = view.standings;
  const cutoff = view.cutoff;
  const alive = standings.filter((s) => !s.out);
  const rank = alive.findIndex((s) => s.isYou);
  // On a computer-sized panel the box has a fixed height; fill it too.
  const keep = pickRows(alive.length, rank, cutoff, (k) => towerHeight(k, cutoff, alive.length) <= Math.max(space, HEAD + ROW * 3));

  const toggle = (e: Event) => {
    e.stopPropagation();
    foldUnderBoard(!open);
  };

  return (
    // (Alone against a boss: your own row, no more; the panel holds just that, not a crowd's worth of empty space.)
    <section class={`mini-tower${open ? "" : " closed"}${narrow ? " narrow" : ""}${standings.length === 1 ? " one" : ""}`} aria-label="Leaderboard">
      <div class="mini-tower-head">
        {teamed ? (
          // (Black · White · All: the picked one in white, the others grey. A tap on another picks it; a tap on the picked
          // one opens the full list. The picked one carries the title's class: the list's tap target.)
          <div class="mini-picks" role="group" aria-label="Show on the scoreboard">
            {(["b", "w", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                class={`mini-pick${pick === p ? " on mini-tower-title" : ""}`}
                aria-pressed={pick === p}
                onClick={() => (pick === p ? setSheet(true) : choose(p))}
              >
                {PICK_LABEL[p]}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" class="mini-tower-title" onClick={() => setSheet(true)}>
            {view.teamLabel ?? "Leaderboard"}
          </button>
        )}
        {head}
        {openProp === undefined && (
          <button type="button" class="mini-tower-toggle" onClick={toggle} aria-expanded={open} aria-label={open ? "Minimize the leaderboard" : "Show the leaderboard"}>
            {open ? "▾" : "▴"}
          </button>
        )}
      </div>
      {open && (
        <div class="mini-tower-body" ref={body} onClick={() => setSheet(true)}>
          <RaceTower standings={standings} cutoff={cutoff} mini keep={keep} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} floats={floats} dp={scoreDp(match.settings)} teams={view.teams} />
        </div>
      )}
      {sheet && <LeaderboardSheet match={match} pick={teamed ? pick : undefined} onClose={() => setSheet(false)} />}
    </section>
  );
}

/** The panel scoreboard's last height (TowerFit). */
let lastFit = 0;

/**
 * The scoreboard's rows that fit their box, as the phone's scoreboard shows them (you, the leaders, your neighbors and the
 * cut line first), never scrolling: the boss battle's panel under the board (MovePanel.tsx, "Players"). A tap calls `onOpen`.
 */
export function TowerFit({ match, floats, onOpen }: { match: GameView; floats?: ReadonlyMap<string, ChatFloat>; onOpen?: () => void }) {
  // (Starting from the last box it had: a switch back to "Players" mounts it anew, and its first frame shows the rows that
  // fit, not a few until it has measured.)
  const [space, setSpace] = useState(lastFit);
  const body = useRef<HTMLDivElement>(null);
  // (Measured before the first paint: a switch back to "Players" shows the rows that fit at once.)
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const fit = () => setSpace((lastFit = el.clientHeight));
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);
  const view = towerView(match);
  const alive = view.standings.filter((s) => !s.out);
  const rank = alive.findIndex((s) => s.isYou);
  const keep = pickRows(alive.length, rank, view.cutoff, (k) => towerHeight(k, view.cutoff, alive.length) <= Math.max(space, HEAD + ROW));
  return (
    <div class="bp-tower" ref={body} onClick={onOpen}>
      <RaceTower standings={view.standings} cutoff={view.cutoff} mini keep={keep} done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} floats={floats} dp={scoreDp(match.settings)} />
    </div>
  );
}

