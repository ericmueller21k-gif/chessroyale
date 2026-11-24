// The crate opening's frame times (crate-open/, on its preview page: the game's CrateOpening with a fake roll), played in real time
// on an emulated iPhone 13 with the CPU slowed (default 4x, CDP), per tier (fischer=1: Legendary and Mythic through Fischer Random,
// as in the game; otherwise each tier's box). Frame times from requestAnimationFrame (only the measuring runs a frame loop).
//   node scripts/crate-open-perf.mjs [tiers=rare,mythic] [cpu=4] [fischer=1]
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";

const args = process.argv.slice(2);
const arg = (k) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const tiers = (arg("tiers") ?? "common,rare,legendary,mythic").split(",");
const cpu = Number(arg("cpu") ?? 4);
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5197, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
page.on("console", (m) => m.text().startsWith("build") && console.log(m.text()));
const cdp = await ctx.newCDPSession(page);
const fischer = arg("fischer") === "1";
const runMs = fischer ? 16000 : 7000;
// (A first visit lets the dev server finish optimizing its dependencies, which reloads the page once.)
await page.goto(`${url}crate-open-preview.html?capture=1`);
await page.waitForTimeout(4000);
for (const tier of tiers) {
  await page.goto(`${url}crate-open-preview.html?tier=${tier}&fischer=${fischer ? 1 : 0}&delay=300`);
  await page.waitForSelector(".cox-play");
  await page.waitForTimeout(500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const times = await page.evaluate(async (runMs) => {
    const out = [];
    let last = 0;
    let t0 = 0;
    let stop = false;
    const tick = (t) => {
      if (last) out.push([t - last, t - t0, globalThis.__crateAnims?.[0]?.currentTime ?? -1]);
      last = t;
      if (!stop) requestAnimationFrame(tick);
    };
    t0 = performance.now();
    document.querySelector(".cox-play").click();
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, runMs));
    stop = true;
    return out;
  }, runMs);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const s = times.map((x) => x[0]).sort((a, b) => a - b);
  const at = times.filter((x) => x[0] > 34).map((x) => `${x[0].toFixed(0)} ms at ${x[1].toFixed(0)}, the opening's clock at ${Number(x[2]).toFixed(0)}`).join(", ");
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
  const long = `${times.filter((x) => x[0] > 34).length} (${at})`;
  console.log(`${tier} @${cpu}x: ${times.length} frames, median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${s[s.length - 1].toFixed(1)} ms, over 34 ms: ${long}`);
}
await browser.close();
await server.close();
