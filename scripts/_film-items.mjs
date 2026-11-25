// Throwaway for the item-polish build (remove before the PR): stills and GIFs of the items on the fitting sheet, phone width, dark, live.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createServer } from "vite";
const [out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5197, strictPort: false }, logLevel: "error" });
await server.listen();
const base = `${server.resolvedUrls.local[0]}items-preview.html?sheet=1&live=1&width=366&purity=94`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
page.on("pageerror", (e) => console.error("page:", e.message));
const seek = (ms) => page.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, ms);
const open = async (q) => {
  await page.goto(`${base}&${q}`);
  await page.addStyleTag({ content: "html,body{background:#121418 !important;min-height:0 !important;height:auto !important} #app{display:block !important;height:auto !important;min-height:0 !important} #app > div{align-items:flex-start !important;align-content:flex-start !important}" });
  await page.waitForTimeout(1200);
};
// [name, query, still at (s), cycle (s)]
const ITEMS = [
  ["fire-ice-crown", "items=fire-ice-crown,fire-ice-crown,fire-ice-crown&colors=red,cobalt,emerald", 0.55, 6],
  ["candy-cane", "items=candy-cane,candy-cane&colors=red,emerald", 1.5, 6.5],
  ["gift-tube", "items=gift-tube,gift-tube&colors=red,cobalt", 1.0, 5.5],
  ["parrot", "items=parrot,parrot&colors=red,cobalt", 4.9, 6],
  ["tommy-gun", "items=tommy-gun,tommy-gun&colors=red,midnight", 5.15, 7],
  ["smiley-face", "items=smiley-face,smiley-face,smiley-face,smiley-face,smiley-face,smiley-face&colors=yellow,red,cobalt,emerald,midnight,pearl&seeds=1,8,3,10,2,5", 0, 0],
];
for (const [name, q, at, cycle] of ITEMS) {
  await open(q);
  await seek(at * 1000);
  await page.locator("#app > div").screenshot({ path: `${out}/${name}.png` });
  console.log(`saved ${name}.png`);
  if (!cycle) continue;
  const el = page.locator("#app > div > div").first();
  const dir = `${out}/frames-${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const fps = 15, n = Math.round(cycle * fps);
  for (let i = 0; i < n; i++) {
    await seek((i * 1000) / fps);
    await el.screenshot({ path: `${dir}/${String(i).padStart(4, "0")}.png` });
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/%04d.png`, "-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none", "-loop", "0", `${out}/${name}.gif`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`saved ${name}.gif`);
}
// Reduced motion: every item at rest, mid-cycle.
await page.emulateMedia({ reducedMotion: "reduce" });
await open("items=fire-ice-crown,candy-cane,gift-tube,parrot,tommy-gun&colors=red,red,red,red,red");
await page.locator("#app > div").screenshot({ path: `${out}/reduced-motion.png` });
console.log("saved reduced-motion.png");
await browser.close();
await server.close();
