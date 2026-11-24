// MOCKUP (claude/crate-open-mockup): the crate opening mockup's frame times, played in real time on an emulated phone with the
// CPU slowed (default 4x, CDP), per tier. Frame times from requestAnimationFrame (only the measuring runs a frame loop).
//   npx node scripts/crate-open-perf.mjs [tiers=rare,mythic] [cpu=4]
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";

const args = process.argv.slice(2);
const arg = (k) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const tiers = (arg("tiers") ?? "common,rare,legendary,mythic").split(",");
const cpu = Number(arg("cpu") ?? 4);
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5197, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
page.on("console", (m) => m.text().startsWith("build") && console.log(m.text()));
const cdp = await ctx.newCDPSession(page);
for (const tier of tiers) {
  await page.goto(`${url}crate-open-preview.html?tier=${tier}${arg("blur") === "0" ? "&blur=0" : ""}`);
  await page.waitForSelector(".cox-play");
  await page.waitForTimeout(500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const times = await page.evaluate(async () => {
    (document.querySelector(".cox-chip:nth-last-child(1)"))?.click();
    const out = [];
    let last = 0;
    let t0 = 0;
    let stop = false;
    const tick = (t) => {
      if (last) out.push([t - last, t - t0, document.getAnimations()[0]?.currentTime ?? -1]);
      last = t;
      if (!stop) requestAnimationFrame(tick);
    };
    // (Muted: no audio context in a headless run.)
    for (const b of document.querySelectorAll(".cox-chip")) if (b.textContent === "Mute") (b).click();
    await new Promise((r) => setTimeout(r, 100));
    t0 = performance.now();
    document.querySelector(".cox-play").click();
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 6200));
    stop = true;
    console.log(`build ${window.__buildMs?.toFixed(1)} ms`);
    return out;
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const s = times.map((x) => x[0]).sort((a, b) => a - b);
  const at = times.filter((x) => x[0] > 34).map((x) => `${x[0].toFixed(0)} ms at ${x[1].toFixed(0)}, strip at ${Number(x[2]).toFixed(0)}`).join(", ");
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
  const long = `${times.filter((x) => x[0] > 34).length} (${at})`;
  console.log(`${tier} @${cpu}x: ${times.length} frames, median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${s[s.length - 1].toFixed(1)} ms, over 34 ms: ${long}`);
}
await browser.close();
await server.close();
