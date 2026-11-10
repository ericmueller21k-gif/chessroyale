// Home's cold load, phone (CPU slowed 4x) and computer: first content, home ready (PLAY on screen), the JS heap and the
// Stockfish workers started on home, and the main chunk's size. Serves a built app (vite preview, no API), no service worker.
//   node scripts/measure-load.mjs [dist=packages/app/dist] [runs=3]
// Build first: npx vite build packages/app (or --outDir <dir> to compare two builds).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { preview } from "vite";

const [distArg = "packages/app/dist", runsArg = "3"] = process.argv.slice(2);
const dist = resolve(distArg);
const RUNS = Number(runsArg) || 3;

// The main chunk: the script index.html loads.
const html = readFileSync(join(dist, "index.html"), "utf8");
const mainFile = /<script type="module"[^>]*src="\/(assets\/[^"]+\.js)"/.exec(html)?.[1];
const main = readFileSync(join(dist, mainFile));
const kb = (n) => Math.round(n / 1024);
console.log(`main chunk ${mainFile}: ${kb(main.length)} kB (${kb(gzipSync(main).length)} kB gzip)`);
const assets = readdirSync(join(dist, "assets")).filter((f) => f.endsWith(".js"));
console.log(`js chunks: ${assets.length}, total ${kb(assets.reduce((s, f) => s + statSync(join(dist, "assets", f)).size, 0))} kB`);

const server = await preview({ root: "packages/app", configFile: "packages/app/vite.config.ts", preview: { port: 5231, strictPort: false }, logLevel: "error", build: { outDir: dist } });
const url = server.resolvedUrls.local[0];
const DEVTOOLS = 9341;
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: [`--remote-debugging-port=${DEVTOOLS}`] });

/**
 * Memory in use by the page and its workers: each one's JS heap plus its array buffers' backing stores (where Stockfish's
 * WebAssembly memory lives), asked over the browser's own DevTools socket (Playwright can't reach a worker's session).
 */
async function memory() {
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${DEVTOOLS}/json/version`)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const waiting = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) waiting.get(m.id)(m.result ?? {}), waiting.delete(m.id);
  });
  const send = (method, params = {}, sessionId) => new Promise((r) => (waiting.set(++id, r), ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))));
  const { targetInfos } = await send("Target.getTargets");
  let page = 0, workers = 0;
  for (const t of targetInfos.filter((t) => t.type === "page" || t.type === "worker")) {
    const { sessionId } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    const h = await send("Runtime.getHeapUsage", {}, sessionId);
    const mb = ((h.usedSize ?? 0) + (h.backingStorageSize ?? 0)) / 2 ** 20;
    if (t.type === "page") page += mb;
    else workers += mb;
    await send("Target.detachFromTarget", { sessionId });
  }
  ws.close();
  return { page, workers };
}

async function once(device, throttle) {
  const ctx = await browser.newContext({ ...device, serviceWorkers: "block" });
  const page = await ctx.newPage();
  let workers = 0;
  page.on("worker", (w) => w.url().includes("stockfish") && workers++);
  const cdp = await ctx.newCDPSession(page);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => [...document.querySelectorAll("#app button")].some((b) => b.textContent.trim() === "PLAY" && b.offsetParent), null, { timeout: 60000, polling: 50 });
  const ready = await page.evaluate(() => performance.now());
  const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? NaN);
  // Settled on home: the engines asked for on home have started.
  await page.waitForTimeout(6000);
  const mem = await memory();
  await ctx.close();
  return { fcp, ready, heap: mem.page, workerMb: mem.workers, workers };
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const [name, device, throttle] of [["phone", devices["iPhone 13"], 4], ["desktop", { viewport: { width: 1440, height: 900 } }, 1]]) {
  const rows = [];
  for (let i = 0; i < RUNS; i++) rows.push(await once(device, throttle));
  const f = (k, d = 0) => med(rows.map((r) => r[k])).toFixed(d);
  console.log(`${name}: first content ${f("fcp")} ms, home ready ${f("ready")} ms, memory: page ${f("heap")} MB + workers ${f("workerMb")} MB, engine workers ${f("workers")}  (runs: ${rows.map((r) => `${r.fcp.toFixed(0)}/${r.ready.toFixed(0)}`).join(", ")})`);
}
await browser.close();
await server.close();
