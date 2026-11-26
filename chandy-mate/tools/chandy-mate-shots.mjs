// Screens of a Chandy battle (phone and computer) and where things are on them, for the checkmate storyboard:
// node scripts/chandy-mate-shots.mjs <outDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const outDir = resolve(process.argv[2] ?? "mate-shots");
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5197, strictPort: false, fs: { allow: [resolve(".")] } }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const geo = {};
for (const [name, viewport, extra] of [
  ["phone", { width: 390, height: 844 }, { hasTouch: true, isMobile: true }],
  ["desktop", { width: 1536, height: 730 }, {}],
]) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 2, ...extra });
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  await p.addInitScript(() => {
    try {
      localStorage.setItem("hunchess.tutorial.dismissed", "1");
    } catch {}
  });
  await p.goto(url + "bosses?debug&clock=30&nolanding");
  // (Chandy is admins-first: his kit in every boss's place, as frames-boss-character.mjs's kit=, on Boingo's battle: the same screen.)
  await p.evaluate(async () => {
    const m = await import("/src/characters/kits.ts");
    const kit = m.BOSS_KITS.Chandy ?? m.ART_KITS?.Chandy;
    for (const k of Object.keys(m.BOSS_KITS)) m.BOSS_KITS[k] = kit;
  });
  await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /Boingo/ }).click();
  for (let i = 0; i < 200; i++) {
    if ((await p.evaluate(() => window.match?.phase.kind)) === "play") break;
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${outDir}/${name}.png` });
  const board = await p.locator(".hb-board").first().boundingBox();
  const char = await p.locator(".boss-char:visible").first().boundingBox();
  const flip = (await p.evaluate(() => window.match.boss?.crowdSide)) === "b";
  geo[name] = { viewport, board, char, flip };
  await p.close();
}
writeFileSync(`${outDir}/geo.json`, JSON.stringify(geo, null, 1));
await browser.close();
await server.close();
