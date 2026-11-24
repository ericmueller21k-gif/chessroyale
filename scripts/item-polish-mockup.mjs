// The Nov 24 Legendary/Mythic polish mockup, filmed: stills, a GIF per section, and the frame rate at 4x CPU.
//   node scripts/item-polish-mockup.mjs <outDir> [still=<seconds>] [gif=crown,cane,...] [fps=1] [scale=2]
// Starts the app's dev server on /item-polish-preview.html. A GIF steps every animation to each moment itself (paused, its
// currentTime set), so frames are exact, not sampled; ffmpeg makes the GIF.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createServer } from "vite";

const [out = "item-polish", ...args] = process.argv.slice(2);
const arg = (k, d) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
mkdirSync(out, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = `${server.resolvedUrls.local[0]}item-polish-preview.html`;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const scale = Number(arg("scale", 2));
const page = await browser.newPage({ viewport: { width: 1180, height: 600 }, deviceScaleFactor: scale });
page.on("pageerror", (e) => console.error("page:", e.message));
const seek = (ms) =>
  page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, ms);

const still = arg("still");
if (still !== undefined) {
  // (`query=big=fire-ice-crown&colors=red` films the drawing page instead; `name=` names the PNG.)
  await page.goto(`${url}?${arg("query", "")}`);
  await page.waitForTimeout(1200);
  const name = `${out}/${arg("name", "all")}-${still}s.png`;
  await seek(Number(still) * 1000);
  await page.screenshot({ path: name, fullPage: true });
  console.log(`saved ${name}`);
}

/** Each section's GIF: its length (one whole cycle of what it shows, in seconds). */
const LENGTH = { crown: 6, cane: 6, tube: 6.5, parrot: 6, tommy: 7, pirate: 9 };
for (const id of (arg("gif", "") || "").split(",").filter(Boolean)) {
  await page.goto(`${url}?only=${id}`);
  await page.waitForTimeout(1200);
  const el = page.locator(`#${id}`);
  const dir = `${out}/frames-${id}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const fps = 15;
  const n = Math.round((LENGTH[id] ?? 6) * fps);
  for (let i = 0; i < n; i++) {
    await seek((i * 1000) / fps);
    await el.screenshot({ path: `${dir}/${String(i).padStart(4, "0")}.png` });
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/%04d.png`, "-vf", "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none", "-loop", "0", `${out}/${id}.gif`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`saved ${out}/${id}.gif (${n} frames)`);
}

if (arg("fps")) {
  // Every section at once, running, with the CPU slowed 4x: frames drawn in 10 s and the longest gap between two.
  const cdp = await page.context().newCDPSession(page);
  await page.goto(url);
  await page.waitForTimeout(1500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const r = await page.evaluate(
    () =>
      new Promise((done) => {
        const t = [];
        const tick = (now) => {
          t.push(now);
          if (now - t[0] < 10000) requestAnimationFrame(tick);
          else {
            const gaps = t.slice(1).map((x, i) => x - t[i]);
            gaps.sort((a, b) => a - b);
            done({ frames: t.length, seconds: (t.at(-1) - t[0]) / 1000, p95: gaps[Math.floor(gaps.length * 0.95)], worst: gaps.at(-1), animations: document.getAnimations().length });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(`4x CPU: ${(r.frames / r.seconds).toFixed(1)} fps over ${r.seconds.toFixed(1)} s, p95 gap ${r.p95.toFixed(1)} ms, worst ${r.worst.toFixed(1)} ms, ${r.animations} animations running`);
}
await browser.close();
await server.close();
