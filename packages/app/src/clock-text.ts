/**
 * Every clock on screen, one way: m:ss in whole seconds rounded up, as the big 3-2-1 counts (its "1" is the dock's
 * 0:01), so two clocks showing the same time never differ by a second. `tenths` writes the last ten seconds as "9.4"
 * (Squads' team banks).
 */
export const clockShown = (ms: number, opts?: { tenths?: boolean }): string => {
  const v = Math.max(0, ms);
  if (opts?.tenths && v < 10_000) return (Math.floor(v / 100) / 10).toFixed(1);
  const s = Math.ceil(v / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
