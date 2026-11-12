// Going into a room (Nov 11, docs/decisions/2026-11-11-room-smooth.md; Eric: "when you go into a building, just make it take an extra
// second"): from the "Go in" tap, when the black is full, when it starts to lift, the longest frame during the door's zoom, and the
// pictures painted or uploaded in the room's frames after (`?report`). Phone 428x746 (drawn 2), the CPU at 1x and slowed 4x, a first
// visit each time (a new page).
//
//   npx wrangler dev --port 8790 --var TEST_SWITCHES:1 --enable-containers=false   (after npm run build)
//   PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/door-room.mjs [rooms=smudgy,zebra,clown] [runs=2]
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const BASE = arg("base", "http://localhost:8790");
const ROOMS = arg("rooms", "smudgy,zebra,clown").split(",");
const RUNS = Number(arg("runs", "2"));
const NAMES = { smudgy: "Smudgy's Art Gallery", zebra: "Rolling Dough", clown: "Boingo's Funhouse", gardener: "Puddles' Botanical Garden", hollow: "Hollow Peak" };
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
for (const id of ROOMS)
  for (const slow of [1, 4]) {
    const runs = [];
    for (let run = 0; run < RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: 428, height: 746 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      if (id === "zebra")
        await page.route("**/api/me*", async (route) => {
          if (route.request().method() !== "GET") return route.continue();
          const res = await route.fetch();
          const body = await res.json().catch(() => null);
          await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
        });
      await page.goto(`${BASE}/town?sky=day&report`);
      await page.waitForFunction(() => document.querySelector("canvas.town-canvas")?.dataset.ready === "1", null, { timeout: 60_000 });
      await page.evaluate((h) => window.__townGlide?.(h), id);
      const card = page.getByRole("dialog", { name: NAMES[id] ?? id, exact: true });
      for (let i = 0; i < 12 && !(await card.isVisible()); i++) {
        await page.waitForTimeout(i ? 3000 : 1500);
        const at = await page.evaluate((h) => window.__townAt?.("home", h) ?? null, id);
        if (!at) continue;
        const box = await page.locator("canvas.town-canvas").boundingBox();
        if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
        await page.mouse.click(box.x + at.x, box.y + at.y);
      }
      // (The report starts on a move: a step first, so the room's frames are recorded from the door.)
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
      await page.evaluate(() => {
        const w = window;
        w.__door = [];
        const el = document.querySelector(".town-fade");
        const tick = (t) => {
          w.__door.push([t, Number(getComputedStyle(el).opacity)]);
          if (w.__door.length < 4000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        w.__tap = performance.now();
      });
      await card.getByRole("button", { name: "Go in" }).click();
      await page.waitForFunction(() => document.querySelector("canvas.town-shop-canvas")?.dataset.ready === "1", null, { timeout: 60_000 });
      await page.waitForTimeout(1500 * slow);
      // Walk a little: the room's frames after, painting anything?
      for (const k of ["ArrowLeft", "ArrowRight"]) {
        await page.keyboard.down(k);
        await page.waitForTimeout(800 * slow);
        await page.keyboard.up(k);
      }
      if (arg("dbg", "")) page.on("console", (m) => console.log(m.text()));
      if (arg("dbg", "")) await page.evaluate(() => (window.__dbg = true));
      const r = await page.evaluate(() => {
        const w = window;
        const s = w.__door;
        const tap = w.__tap;
        // (The fade to black starts doorZoomMs - fadeMs (340 ms) into the zoom; it lifts once the room is ready.)
        const up = s.findIndex(([, o]) => o > 0.02);
        let peak = up;
        while (peak >= 0 && peak + 1 < s.length && s[peak + 1][1] >= s[peak][1]) peak++;
        const zoomAt = up >= 0 ? s[up][0] - 340 : NaN;
        const liftAt = peak >= 0 && peak + 1 < s.length ? s[peak + 1][0] : NaN;
        let zoomMax = 0;
        for (let i = 1; i < s.length && s[i][0] <= zoomAt + 600; i++) if (s[i][0] > zoomAt) zoomMax = Math.max(zoomMax, s[i][0] - s[i - 1][0]);
        const rep = w.__townReport?.(true);
        let roomPaints = 0;
        let roomUploads = 0;
        let roomFrames = 0;
        let afterFirst = false;
        if (rep?.raw)
          rep.raw.flags.forEach((f, i) => {
            if (!(f & 256) || f & 1536) return;
            if (!afterFirst) return void (afterFirst = true);
            roomFrames++;
            roomPaints += rep.raw.bakes[i];
            roomUploads += rep.raw.ups[i];
          });
        if (w.__dbg) console.log(JSON.stringify(s.map(([t, o], i) => [Math.round(t - tap), Math.round(o * 100), i ? Math.round(t - s[i - 1][0]) : 0]).filter((x, i, a) => x[2] > 40 || (i && a[i - 1][1] !== x[1])).slice(0, 80)));
        return { door: liftAt - zoomAt, peak: peak >= 0 ? s[peak][1] : NaN, zoomMax, roomFrames, roomPaints, roomUploads };
      });
      runs.push(r);
      await ctx.close();
    }
    // (doorToLiftMs: from the zoom's start to the black lifting, 600 at the least; extraMs what the room's load added to that.)
    const door = med(runs.map((r) => r.door));
    const out = { room: id, slow, doorToLiftMs: Math.round(door), extraMs: Math.max(0, Math.round(door - 600)), darkest: runs.map((r) => Math.round(r.peak * 100) / 100), zoomWorstFrameMs: Math.round(med(runs.map((r) => r.zoomMax))), roomFrames: runs.map((r) => r.roomFrames), paintsInRoom: runs.map((r) => r.roomPaints), uploadsInRoom: runs.map((r) => r.roomUploads) };
    console.log(JSON.stringify(out));
  }
await browser.close();
