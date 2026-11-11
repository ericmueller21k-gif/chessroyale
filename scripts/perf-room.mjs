// Rooms' frame rate while you walk (Nov 11, docs/decisions/2026-11-11-room-smooth.md), the eric.md way: headless, a phone and a
// computer, the CPU at 1x and slowed 4x. For each room: in through its door, then walking (the arrow keys held, back and forth) while
// every frame's time is taken (rAF), only frames where the view moved; then `__shopBench(30, true)` (ms a draw, the view moving) and
// the `?report` run's numbers for the room's walking frames.
//
//   npx wrangler dev --port 8790 --var TEST_SWITCHES:1 --enable-containers=false   (after npm run build)
//   node scripts/perf-room.mjs [base=http://localhost:8790] [rooms=smudgy,zebra,clown] [out=report.json]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const BASE = arg("base", "http://localhost:8790");
const ROOMS = arg("rooms", "smudgy,zebra,clown").split(",");
const OUT = arg("out", "");
const RUNS = Number(arg("runs", "2"));
// (`back=2d`: the room's back drawn the 2D way, as before Nov 11, to compare.)
const FLOORX = arg("back", "");
const NAMES = { smudgy: "Smudgy's Art Gallery", zebra: "Rolling Dough", clown: "Boingo's Funhouse", gardener: "Puddles' Botanical Garden", tiger: "Babur's Circus" };
const SIZES = {
  phone: { viewport: { width: 428, height: 746 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  computer: { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 2 },
};
const med = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const pct = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : NaN;
};

async function enter(page, id) {
  const name = NAMES[id] ?? id;
  await page.waitForFunction(() => document.querySelector("canvas.town-canvas")?.dataset.ready === "1", null, { timeout: 60_000 });
  await page.evaluate((h) => window.__townGlide?.(h), id);
  const card = page.getByRole("dialog", { name, exact: true });
  // (A tap walks you to the door first: its card opens as you get there. A tap every 3 s.)
  for (let i = 0; i < 12 && !(await card.isVisible()); i++) {
    await page.waitForTimeout(i ? 3000 : 1500);
    const at = await page.evaluate((h) => window.__townAt?.("home", h) ?? null, id);
    if (!at) continue;
    const box = await page.locator("canvas.town-canvas").boundingBox();
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    await page.mouse.click(box.x + at.x, box.y + at.y);
  }
  await card.getByRole("button", { name: "Go in" }).click();
  await page.waitForFunction(() => document.querySelector("canvas.town-shop-canvas")?.dataset.ready === "1", null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

/** Walks for `ms` (arrow keys held in turn) while every frame's time is kept, with whether the view moved since the last. */
async function walk(page, ms) {
  await page.evaluate(() => {
    const w = window;
    w.__fr = [];
    let last = 0;
    let lx = NaN;
    let ly = NaN;
    const tick = (t) => {
      const c = w.__shopCam?.();
      const [x, y] = c ? c.focus : [NaN, NaN];
      if (last) w.__fr.push([t - last, x !== lx || y !== ly ? 1 : 0]);
      last = t;
      lx = x;
      ly = y;
      if (!w.__frStop) requestAnimationFrame(tick);
    };
    w.__frStop = false;
    requestAnimationFrame(tick);
  });
  const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < ms; i++) {
    const k = keys[i % 4];
    await page.keyboard.down(k);
    await page.waitForTimeout(900);
    await page.keyboard.up(k);
  }
  return page.evaluate(() => {
    window.__frStop = true;
    return window.__fr;
  });
}

// (The repo pins its own Playwright: a pre-installed Chromium is taken from PW_CHROMIUM when it is set.)
// (`cpu2d=1`: the 2D canvas drawn on the CPU, as Safari's is (CoreGraphics), rather than headless Chromium's emulated GPU.)
const ARGS = arg("cpu2d", "") ? ["--disable-accelerated-2d-canvas"] : [];
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ARGS });
const results = [];
for (const [size, opts] of Object.entries(SIZES))
  for (const id of ROOMS)
    for (const slow of [1, 4]) {
      const runs = [];
      for (let run = 0; run < RUNS; run++) {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        if (id === "zebra")
          await page.route("**/api/me*", async (route) => {
            if (route.request().method() !== "GET") return route.continue();
            const res = await route.fetch();
            const body = await res.json().catch(() => null);
            await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
          });
        await page.goto(`${BASE}/town?sky=day&report${FLOORX === "2d" ? "&back=2d" : ""}`);
        await enter(page, id);
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
        const fr = await walk(page, 6000);
        const moving = fr.filter((f) => f[1]).map((f) => f[0]);
        const bench = await page.evaluate(() => window.__shopBench?.(30, true) ?? null);
        const rep = await page.evaluate(() => window.__townReport?.(true) ?? null);
        let report = null;
        if (rep?.raw) {
          // (Frames in a room (256) and walking (1), not going in or out (512, 1024).)
          const NP = rep.raw.part.length / Math.max(1, rep.frames);
          const idx = rep.raw.flags.map((f, i) => [f, i]).filter(([f]) => (f & 256) && (f & 1) && !(f & 1536)).map(([, i]) => i);
          const ground = idx.map((i) => rep.raw.part[i * NP + 3]);
          const parts = Array.from({ length: NP }, (_, k) => Math.round(idx.reduce((a, i) => a + rep.raw.part[i * NP + k], 0) / Math.max(1, idx.length) * 10) / 10);
          report = { frames: idx.length, medMs: med(idx.map((i) => rep.raw.total[i])), groundMs: med(ground), parts };
        }
        runs.push({ medMs: med(moving), p95Ms: pct(moving, 0.95), fps: 1000 / med(moving), moving: moving.length, bench, report });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        await ctx.close();
      }
      const r = {
        size,
        room: id,
        slow,
        fps: med(runs.map((x) => x.fps)),
        medMs: med(runs.map((x) => x.medMs)),
        p95Ms: med(runs.map((x) => x.p95Ms)),
        benchMs: med(runs.map((x) => x.bench ?? NaN)),
        reportMs: med(runs.map((x) => x.report?.medMs ?? NaN)),
        reportGroundMs: med(runs.map((x) => x.report?.groundMs ?? NaN)),
        reportFrames: runs.map((x) => x.report?.frames ?? 0),
        parts: runs[0]?.report?.parts ?? null,
        moving: runs.map((x) => x.moving),
      };
      results.push(r);
      console.log(JSON.stringify(r));
    }
await browser.close();
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
