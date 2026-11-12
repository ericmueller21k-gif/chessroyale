// Prints each boss's phone bar numbers (kits.ts barScale, barShift, barName) measured from its art: npx tsx scripts/bar-fit.ts
// (Eric, Nov 12: every boss as tall as the bar, less BAR_TOP_GAP; packages/app/test/bar-fit.ts.)
import { barFit, barRows, momentOk } from "../packages/app/test/bar-fit.ts";

for (const r of barRows()) {
  const f = barFit(r.rest);
  const was = { s: r.kit.barScale ?? 1, sh: r.kit.barShift ?? 0, n: r.kit.barName ?? 0 };
  console.log(
    `${r.name.padEnd(18)} barScale: ${f.barScale}, barShift: ${f.barShift}, barName: ${f.barName}   (was ${was.s.toFixed(3)}, ${was.sh}, ${was.n}; idle ${(((r.idle.up + r.idle.down) * f.barScale) | 0)} px tall, was ${(((r.idle.up + r.idle.down) * was.s) | 0)}; moment on screen: ${momentOk(r.all, f.barScale, f.barShift)})`,
  );
}
