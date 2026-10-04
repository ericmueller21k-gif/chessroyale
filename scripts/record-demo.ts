/**
 * Records the landing page's demo loop: a solo 50 v 50 Crowd match on a phone
 * screen, played by a bot-like "you" that picks the engine's move after a few
 * seconds. Needs the app served at BASE (default: `npx wrangler dev --port 8788`
 * after `npm run build`). Captures sharp frames (2x) as back-to-back
 * screenshots into reports/demo/frames/, plus reports/demo/frames.txt for
 * ffmpeg; then cut and encode with scripts/encode-demo.sh.
 *
 *   npx tsx scripts/record-demo.ts
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8788";
const SECONDS = Number(process.env.DEMO_SECONDS ?? 45);
const W = 390;
const H = 844;
const SCALE = 2;

mkdirSync("reports/demo/frames", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const frames: { file: string; t: number }[] = [];
let capturing = true;
/** Sharp (2x) screenshots, as fast as they come, each stamped with its time. */
async function capture() {
  while (capturing) {
    const t = Date.now() / 1000;
    const buf = await page.screenshot({ type: "jpeg", quality: 88 }).catch(() => null);
    if (!buf) continue;
    const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(`reports/demo/frames/${file}`, buf);
    frames.push({ file, t });
  }
}
await page.goto(`${BASE}/?debug&mode=crowd&turns=teams&augments=0&clock=10&nolanding`);
await page.getByLabel("Your name").fill("Hunter");
const capturing$ = capture();
await page.getByRole("button", { name: /Play solo vs 99 bots/ }).click();
const stopAt = Date.now() + SECONDS * 1000;
let lastBoard = "";
while (Date.now() < stopAt) {
  const state = await page.evaluate(() => {
    const m = (window as any).match;
    return m ? { kind: m.phase.kind, key: m.phase.board ? `${m.phase.board.ply}` : "" } : { kind: "none", key: "" };
  });
  if (state.kind === "results") break;
  if (state.kind === "play" && state.key !== lastBoard) {
    lastBoard = state.key;
    // Think for a moment, like a person, then play the engine's pick (or a teammate's).
    await page.waitForTimeout(2200 + Math.random() * 1500);
    await page.evaluate(async () => {
      const m = (window as any).match;
      if (m.phase.kind !== "play") return;
      const top = await Promise.race([m.runner.topMovesFor(m.phase.board.fen), new Promise((r) => setTimeout(() => r(null), 4000))]);
      const fallback = [...(m.runner.planned?.values() ?? [])][0];
      if (m.phase.kind === "play") m.submit(top ? (top as any)[Math.random() < 0.6 ? 0 : 1]?.move ?? (top as any)[0].move : fallback);
    });
  }
  await page.waitForTimeout(200);
}
capturing = false;
await capturing$;
await browser.close();
// An ffconcat list: each frame shown until the next one was taken.
const lines = ["ffconcat version 1.0"];
frames.forEach((f, i) => lines.push(`file frames/${f.file}`, `duration ${((frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`));
writeFileSync("reports/demo/frames.txt", lines.join("\n") + "\n");
console.log(`wrote ${frames.length} frames over ${(frames.at(-1)!.t - frames[0]!.t).toFixed(1)} s`);
