import type { Standing } from "../game.ts";

const ROW = 30;
const pts = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);
export const clockText = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Ahead of (+) or behind (−) the knockout line, in points; null when nobody goes out. */
export function gapToCut(standings: readonly Standing[], cutoff: number): number | null {
  const alive = standings.filter((s) => !s.out);
  const i = alive.findIndex((s) => s.isYou);
  if (i < 0 || cutoff >= alive.length || cutoff <= 0) return null;
  const me = alive[i]!;
  return i < cutoff ? me.points - alive[cutoff]!.points : me.points - alive[cutoff - 1]!.points;
}

/**
 * The live leaderboard, styled like a racing timing tower. Rows slide to their
 * new places after every round; a red line marks the knockout cut, and the
 * players either side of it (the bubble) pulse. `compact` shows the top 5,
 * the bubble, you, and the bottom 5.
 */
export function RaceTower({ standings, cutoff, compact = false }: { standings: readonly Standing[]; cutoff: number; compact?: boolean }) {
  const alive = standings.filter((s) => !s.out);
  const knockouts = cutoff < alive.length;
  let rows: (Standing & { rank: number })[] = standings.map((s, i) => ({ ...s, rank: i + 1 }));
  if (compact) {
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
  if (knockouts && line === null && rows.length && !compact) line = y;

  return (
    <div class={`tower ${compact ? "tower-compact" : ""}`}>
      <div class="tower-head">
        <span>Pos</span>
        <span>Player</span>
        <span title="Stage points: move scores, ± time saved or spent, − power-ups used">Pts</span>
        <span title="Average score per move this stage">Avg</span>
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
            <span>Elimination</span>
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
              class={`tower-row${r.isYou ? " you" : ""}${zone ? " zone" : ""}${bubble ? " bubble" : ""}${r.out ? " out" : ""}${podium}`}
              style={{ transform: `translateY(${ys.get(r.id)}px)` }}
            >
              <span class="t-pos">{r.out ? `${r.placement ?? "✕"}` : r.rank}</span>
              <span class="t-name">
                {r.name}
                {r.practice && <span title="Practice mode (unlimited power-ups)"> 💡</span>}
              </span>
              <span class="t-pts">{r.out ? "out" : pts(r.points)}</span>
              <span class="t-avg">{r.out ? "" : pts(r.avg)}</span>
              <span class="t-bank">{r.out ? "" : clockText(r.bankMs)}</span>
              <span class="t-pu">{r.out ? "" : r.practice ? "∞" : r.powerUps}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
