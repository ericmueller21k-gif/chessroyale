/**
 * Every clock on screen, one way: m:ss in whole seconds rounded up, as the big 3-2-1 counts (its "1" is the dock's
 * 0:01), so two clocks showing the same time never differ by a second. `tenths` (Squads' team banks) is a chess
 * clock's style instead: rounded down throughout, the last ten seconds as "9.4", so it goes 0:10 → 9.9 with no jump.
 */
export const clockShown = (ms: number, opts?: { tenths?: boolean }): string => {
  const v = Math.max(0, ms);
  if (opts?.tenths && v < 10_000) return (Math.floor(v / 100) / 10).toFixed(1);
  const s = opts?.tenths ? Math.floor(v / 1000) : Math.ceil(v / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
