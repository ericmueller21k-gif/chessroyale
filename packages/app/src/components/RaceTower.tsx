import { useRef } from "preact/hooks";
import type { Standing } from "../game.ts";
import type { ChatFloat } from "../chat.ts";
import { PlayerName } from "./PlayerName.tsx";
import { LiveNumber } from "./LiveNumber.tsx";
import { clockShown } from "../clock-text.ts";
import { StreakFire } from "./StreakFire.tsx";

/** Points with their sign, to `dp` decimals (Crowd 50 v 50's are kept to 2: scoreDp). */
const signed = (x: number, dp: number) => (x >= 0 ? "+" : "") + x.toFixed(dp);
/** A row moving more places than this fades in at its new place rather than sliding there. */
const JUMP_ROWS = 4;

/**
 * The live leaderboard, styled like a racing timing tower. Rows slide to their
 * new places after every round; a red line marks the knockout cut, and the
 * players either side of it (the bubble) pulse. `compact` shows the top 5,
 * the bubble, you, and the bottom 5. A row that moves more than JUMP_ROWS places
 * fades in at its new place instead of sliding through the rows in between (a
 * reveal can reorder fifty at once).
 */
export function RaceTower({
  standings,
  cutoff,
  compact = false,
  mini = false,
  keep: keepOnly,
  done,
  cutLabel = "Cut line",
  floats,
  bank = true,
  dp = 1,
  teams = false,
}: {
  standings: readonly Standing[];
  cutoff: number;
  compact?: boolean;
  /** Small rows with just position, name and points (the phone's scoreboard under the board). */
  mini?: boolean;
  /** Show only these players (positions among those still in, 0-based), with "⋯" between gaps. */
  keep?: ReadonlySet<number>;
  /** Players who have moved this round (shown in green while a round is being played). */
  done?: ReadonlySet<string>;
  /** Text on the cut line, e.g. "Cut after round 8". */
  cutLabel?: string;
  /**
   * Quick chat: an emoji someone just sent, floating up from their row for a moment. One whose sender has no row
   * here (the other team's, sent to everyone, or a teammate not shown) floats from the header, with a team chip
   * when it went to everyone.
   */
  floats?: ReadonlyMap<string, ChatFloat>;
  /**
   * The time bank column (off in the Hidden Boss's phase 2, from his phase change: each player's time is their board's
   * own clock then, on its tag, and the bank would show a clock nobody plays on).
   */
  bank?: boolean;
  /** Decimals on the points (scoreDp: 2 in Crowd 50 v 50). */
  dp?: number;
  /** Everyone's rows ("All"): a small mark in each row's name cell for its team (white or black). */
  teams?: boolean;
}) {
  const pts = (x: number) => signed(x, dp);
  const ROW = mini ? 22 : 30;
  const alive = standings.filter((s) => !s.out);
  const knockouts = cutoff < alive.length;
  // The highest-rated player still in, if there's a clear one: the one to fear.
  const best = Math.max(-1, ...alive.map((s) => s.rating ?? -1));
  const topRating = alive.filter((s) => s.rating === best).length === 1 ? best : null;
  let rows: (Standing & { rank: number })[] = standings.map((s, i) => ({ ...s, rank: i + 1 }));
  if (keepOnly) {
    rows = rows.filter((r) => !r.out && keepOnly.has(r.rank - 1));
  } else if (compact) {
    const keep = new Set<number>();
    const n = alive.length;
    for (let i = 0; i < Math.min(5, n); i++) keep.add(i);
    for (let i = Math.max(0, n - 5); i < n; i++) keep.add(i);
    for (let i = cutoff - 2; i <= cutoff + 1; i++) if (i >= 0 && i < n) keep.add(i);
    const me = alive.findIndex((s) => s.isYou);
    if (me >= 0) keep.add(me);
    rows = rows.filter((r) => !r.out && keep.has(r.rank - 1));
  }
  // Positions, leaving room for the knockout line and for "…" between skipped rows.
  const ys = new Map<string, number>();
  const gaps: number[] = [];
  let y = 0;
  let line: number | null = null;
  rows.forEach((r, k) => {
    const prev = rows[k - 1];
    if (prev && r.rank - prev.rank > 1) {
      gaps.push(y);
      y += ROW * 0.6;
    }
    if (knockouts && !r.out && r.rank - 1 === cutoff) {
      line = y;
      y += 10;
    }
    if (r.out && (!prev || !prev.out)) y += 6;
    ys.set(r.id, y);
    y += ROW;
  });
  if (knockouts && line === null && rows.length && !compact && !keepOnly) line = y;
  // Rows that moved far since the last draw: drawn anew (a new key) where they land, fading in.
  const last = useRef(new Map<string, { y: number; n: number }>());
  const keys = new Map<string, string>();
  for (const r of rows) {
    const y1 = ys.get(r.id)!;
    const was = last.current.get(r.id);
    const n = was && Math.abs(y1 - was.y) > JUMP_ROWS * ROW ? was.n + 1 : (was?.n ?? 0);
    last.current.set(r.id, { y: y1, n });
    keys.set(r.id, n ? `${r.id}:${n}` : r.id);
  }
  const shown = new Set(rows.map((r) => r.id));
  const away = floats ? [...floats].filter(([id]) => !shown.has(id)).map(([, f]) => f).slice(-3) : [];

  return (
    <div class={`tower${compact ? " tower-compact" : ""}${mini ? " tower-mini" : ""}${bank ? "" : " tower-nobank"}`} style={{ "--row": `${ROW}px` }}>
      <div class="tower-head">
        <span>Pos</span>
        <span>Player</span>
        <span title="Stage points (move quality only)">Pts</span>
        <span title="Average score per move this stage">Avg</span>
        <span title="Engine rating estimate from every move so far">Elo</span>
        <span title="Time bank">Bank</span>
        <span title="Unused power-ups">⚡</span>
      </div>
      <div class="tower-rows" style={{ height: `${y}px` }}>
        {gaps.map((g) => (
          <div key={`gap${g}`} class="tower-gap" style={{ transform: `translateY(${g}px)` }}>
            ⋯
          </div>
        ))}
        {line !== null && (
          <div class="tower-cut" style={{ transform: `translateY(${line}px)` }}>
            <span>{cutLabel}</span>
          </div>
        )}
        {rows.map((r) => {
          const i = r.rank - 1;
          const zone = !r.out && knockouts && i >= cutoff;
          const bubble = !r.out && knockouts && i >= cutoff - 2 && i <= cutoff + 1;
          const podium = !r.out && i < 3 ? ` p${i + 1}` : "";
          return (
            <div
              key={keys.get(r.id)}
              class={`tower-row${keys.get(r.id) !== r.id ? " jump" : ""}${r.isYou ? " you" : ""}${done?.has(r.id) ? " done" : ""}${done && !r.out && !done.has(r.id) ? " thinking" : ""}${zone ? " zone" : ""}${bubble ? " bubble" : ""}${r.out ? " out" : ""}${podium}`}
              style={{ transform: `translateY(${ys.get(r.id)}px)` }}
            >
              <span class={`t-pos${!r.out && r.streak !== undefined ? " streak" : ""}`}>
                <span class="t-rank">{r.out ? `${r.placement ?? "✕"}` : r.rank}</span>
                {/* (A streak's fire: a badge on the rank square's corner, so the name keeps its room.) */}
                {!r.out && r.streak !== undefined && <StreakFire count={r.streak} />}
              </span>
              <span class="t-name">
                {done?.has(r.id) && <span class="t-check">✓</span>}
                {teams && r.team && <span class={`team-chip ${r.team}`} title={r.team === "w" ? "White team" : "Black team"} />}
                {mini ? <span class="t-name-text">{r.name}</span> : <PlayerName class="t-name-text" name={r.name} uid={r.uid} you={r.isYou} bot={r.isBot} />}
                {r.practice && (
                  <span class="t-practice" title="Practice mode (unlimited power-ups)">
                    💡
                  </span>
                )}
              </span>
              <span class="t-pts">{r.out ? "out" : <LiveNumber value={r.points} format={pts} />}</span>
              <span class="t-avg">{r.out ? "" : pts(r.avg)}</span>
              <span class={`t-elo${r.rating !== null && r.rating === topRating ? " top" : ""}`}>{r.rating ?? "—"}</span>
              <span class="t-bank">{r.out ? "" : clockShown(r.bankMs)}</span>
              <span class="t-pu">{r.out ? "" : r.practice ? "∞" : r.powerUps}</span>
              {floats?.get(r.id) && (
                <span key={floats.get(r.id)!.key} class="t-float" aria-hidden="true">
                  {floats.get(r.id)!.text}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {away.length > 0 && (
        <div class="tower-floats" aria-hidden="true">
          {away.map((f) => (
            <span key={f.key} class="t-float away">
              {f.team && <span class={`team-chip ${f.team}`} />}
              {f.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
