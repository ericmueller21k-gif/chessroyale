// A boss's moments in the game before its power rules exist, frame by frame (the test link ?wip=1&kit=<kit>&power=<moment>,
// components/WipPreview.tsx): Boss alone against Boingo with the kit in his place, the moment playing over the real
// board, on a phone and a computer. Saves a frame every ~`every` ms (the board and its surroundings) and, with ffmpeg
// on the PATH, a GIF of them. With `perf` in place of `every`: no screenshots; the phone's CPU slowed 4x, it measures
// frames on the plain board, then through the moment, a second at a time (e2e/perf-probe.js).
//   npm run frames:wip -- <out-dir> <kit, e.g. Hollow> <moment, e.g. lightsout> [phone|desktop|both] [seconds=12] [every=80|perf]
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { frameStats, instrument } from "../e2e/perf-probe.js";

const [out = "wip-frames", kit = "Hollow", moment = "lightsout", which = "both", secs = "12", every = "80"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5197, strictPort: false, fs: { allow: [resolve("../..")] } }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

async function run(name, context) {
  const p = await browser.newPage(context);
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  const perf = every === "perf";
  if (perf) await p.addInitScript(instrument);
  await p.goto(`${url}?debug&clock=90&nolanding&wip=1&kit=${encodeURIComponent(kit)}`);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /Boingo/ }).click();
  for (let i = 0; i < 200; i++) {
    if ((await p.evaluate(() => window.match?.phase.kind)) === "play") break;
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(800);
  const fmt = (f) => {
    const s = frameStats(f.map((x) => x[0]));
    const rafs = f.map((x) => x[1]).sort((a, b) => a - b);
    return `p50 ${s.p50} p95 ${s.p95} dropped ${(s.slow * 100).toFixed(0)}% max ${s.max} rAF/frame ${rafs[Math.floor(rafs.length / 2)] ?? 0}`;
  };
  if (perf) {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await p.waitForTimeout(600);
    await p.evaluate(() => (window.__perf.frames = []));
    await p.waitForTimeout(3000);
    console.log(`${name} plain board     | ${fmt(await p.evaluate(() => window.__perf.frames.splice(0)))}`);
  }
  // The moment starts now: the same page, with the moment in its address (no reload: the battle carries on).
  await p.evaluate((m) => {
    const u = new URL(location.href);
    u.searchParams.set("power", m);
    history.replaceState(null, "", u);
  }, moment);
  // (A redraw picks it up: the play screen redraws several times a second.)
  const board = await p.locator("cg-board").first().boundingBox();
  const vw = p.viewportSize().width;
  const clip = name === "phone" ? { x: 0, y: Math.max(0, board.y - 170), width: vw, height: board.height + 180 } : { x: Math.max(0, board.x - 330), y: Math.max(0, board.y - 190), width: Math.min(vw, board.width + 420), height: board.height + 210 };
  if (perf) {
    await p.evaluate(() => (window.__perf.frames = []));
    const all = [];
    for (let s = 0; s < Number(secs); s++) {
      await p.waitForTimeout(1000);
      const f = await p.evaluate(() => window.__perf.frames.splice(0));
      all.push(...f);
      console.log(`${name} ${moment} ${String(s).padStart(2)}-${String(s + 1).padStart(2)} s | ${fmt(f)}`);
    }
    console.log(`${name} ${moment} whole   | ${fmt(all)}`);
    await p.close();
    return;
  }
  const dir = `${outDir}/${name}-${moment}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < Number(secs) * 1000) {
    const t = Date.now();
    await p.screenshot({ path: `${dir}/${String(i).padStart(4, "0")}.png`, clip });
    i++;
    await p.waitForTimeout(Math.max(0, Number(every) - (Date.now() - t)));
  }
  console.log(`${name}: ${i} frames in ${dir}`);
  await p.close();
  try {
    const fps = Math.max(1, Math.round((i / Number(secs)) * 10) / 10);
    const w = name === "phone" ? 360 : 640;
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", String(fps), "-i", `${dir}/%04d.png`, "-vf", `scale=${w}:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none`, `${outDir}/${name}-${moment}.gif`]);
    console.log(`${name}: ${outDir}/${name}-${moment}.gif`);
  } catch (e) {
    console.log("no gif:", e.message);
  }
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"], deviceScaleFactor: 2 });
if (which !== "phone") await run("desktop", { viewport: { width: 1366, height: 860 } });
await browser.close();
await server.close();
