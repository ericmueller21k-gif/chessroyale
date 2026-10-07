import type { Standing } from "../game.ts";
import type { ChatFloat } from "../chat.ts";
import { PlayerName } from "./PlayerName.tsx";
import { LiveNumber } from "./LiveNumber.tsx";

const pts = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);
export const clockText = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The live leaderboard, styled like a racing timing tower. Rows slide to their
 * new places after every round; a red line marks the knockout cut, and the
 * players either side of it (the bubble) pulse. `compact` shows the top 5,
 * the bubble, you, and the bottom 5.
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
}) {
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
  const shown = new Set(rows.map((r) => r.id));
  const away = floats ? [...floats].filter(([id]) => !shown.has(id)).map(([, f]) => f).slice(-3) : [];

  return (
    <div class={`tower${compact ? " tower-compact" : ""}${mini ? " tower-mini" : ""}`} style={{ "--row": `${ROW}px` }}>
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
              key={r.id}
              class={`tower-row${r.isYou ? " you" : ""}${done?.has(r.id) ? " done" : ""}${done && !r.out && !done.has(r.id) ? " thinking" : ""}${zone ? " zone" : ""}${bubble ? " bubble" : ""}${r.out ? " out" : ""}${podium}`}
              style={{ transform: `translateY(${ys.get(r.id)}px)` }}
            >
              <span class="t-pos">{r.out ? `${r.placement ?? "✕"}` : r.rank}</span>
              <span class="t-name">
                {done?.has(r.id) && <span class="t-check">✓ </span>}
                {mini ? r.name : <PlayerName name={r.name} uid={r.uid} you={r.isYou} bot={r.isBot} />}
                {r.practice && <span title="Practice mode (unlimited power-ups)"> 💡</span>}
              </span>
              <span class="t-pts">{r.out ? "out" : <LiveNumber value={r.points} format={pts} />}</span>
              <span class="t-avg">{r.out ? "" : pts(r.avg)}</span>
              <span class={`t-elo${r.rating !== null && r.rating === topRating ? " top" : ""}`}>{r.rating ?? "—"}</span>
              <span class="t-bank">{r.out ? "" : clockText(r.bankMs)}</span>
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
