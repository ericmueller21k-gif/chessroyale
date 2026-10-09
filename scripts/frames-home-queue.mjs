// Frame-by-frame check of the computer's home and its queue in place, and of light and dark (Settings → Theme; see
// .claude/LESSONS.md and DECISIONS.md, "A cleaner computer home"), with real clicks and taps:
//   1. computer: PLAY, the lobby fills in place (two people, then the bots), then the match's first screen;
//   2. computer: PLAY then Cancel, home again;
//   3. computer: Settings → Theme, light to dark and back;
//   4. a dark device with Light picked: reloading is light from the first frame (and the other way round);
//   5. phone: PLAY, the full-screen queue, Cancel.
//   npm run frames:home -- <out-dir> [base url, default http://localhost:8788]
// Needs the Worker running with a short fill (npx wrangler dev --port 8788 --enable-containers=false
// --var MATCH_FILL_SECONDS:8 --var ENGINE_OFF:1). Saves every painted frame (frames/<step>/f<ms>.jpg), a timeline per
// step (timeline.txt), and screenshots. Flags: the side menu or the live panel missing on a frame of home or the
// queue (computer), the seat grid moving or vanishing, the count going down, a frame much brighter or darker than both
// neighbours (a blink), more than one jump in brightness for one theme pick, and a frame of the wrong theme while
// a page loads.
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [out = "home-frames", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const pool = `frames-home-${Date.now().toString(36)}`;
const lines = [];
let problems = 0;
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const problem = (events, what) => {
  problems++;
  events.push({ t: Date.now(), what: `PROBLEM: ${what}` });
};

/** What's on screen, from the DOM. */
const state = (p) =>
  p
    .evaluate(() => {
      const shown = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
      };
      const seats = document.querySelector(".fd-seats");
      const sb = seats?.getBoundingClientRect();
      return {
        screen: seats
          ? "queue"
          : document.querySelector(".vote-screen")
            ? "vote"
            : document.querySelector(".fd-home")
              ? "home"
              : document.querySelector(".fd-splash")
                ? "splash"
                : document.querySelector(".screen")
                  ? "match"
                  : "blank",
        menu: shown(".fd-side"),
        rail: shown(".fd-right"),
        count: Number(document.querySelector(".fd-count-n")?.textContent ?? 0),
        pawns: seats ? seats.querySelectorAll(".fd-seat.pop").length : 0,
        grid: sb ? `${Math.round(sb.x)},${Math.round(sb.y)} ${Math.round(sb.width)}x${Math.round(sb.height)}` : null,
        theme: document.documentElement.getAttribute("data-theme"),
        code: window.match?.code ?? null,
      };
    })
    .catch(() => ({ screen: "?", menu: false, rail: false, count: 0, pawns: 0, grid: null, theme: null, code: null }));

/**
 * Records a step: every painted frame and the DOM state every ~20 ms while `run` does its clicks. `framed`: home and
 * the queue must keep the side menu and live panel. `expectTheme`: every frame must be of that theme (dark under 90 of
 * 255 average brightness, light over 170).
 */
async function record(ctx, p, name, run, { framed = false, expectTheme = null, themeTaps = 0 } = {}) {
  const dir = `${out}/frames/${name}`;
  mkdirSync(dir, { recursive: true });
  const frames = [];
  const cdp = await ctx.newCDPSession(p);
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  const events = [];
  let polling = true;
  let last = null;
  let lastQueue = null;
  const poll = (async () => {
    while (polling) {
      const s = await state(p);
      const key = `${s.screen}${s.code ? ` ${s.code}` : ""} ${s.theme}${s.grid ? ` grid ${s.grid}` : ""}`;
      if (key !== last) events.push({ t: Date.now(), what: `screen: ${key}${framed ? ` menu ${s.menu} panel ${s.rail}` : ""}` });
      last = key;
      if (framed && (s.screen === "home" || s.screen === "queue") && (!s.menu || !s.rail)) problem(events, `the ${!s.menu ? "side menu" : "live panel"} is missing on ${s.screen}`);
      if (s.screen === "queue") {
        if (lastQueue && lastQueue.code === s.code && s.count < lastQueue.count) problem(events, `the count went down ${lastQueue.count} -> ${s.count}`);
        if (lastQueue && lastQueue.grid !== s.grid) problem(events, `the grid moved ${lastQueue.grid} -> ${s.grid}`);
        lastQueue = s;
      } else if (lastQueue && s.screen === "blank") problem(events, "nothing on screen after the queue");
      await new Promise((r) => setTimeout(r, 20));
    }
  })();
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
  await run((what) => events.push({ t: Date.now(), what }));
  await p.waitForTimeout(500);
  await cdp.send("Page.stopScreencast");
  polling = false;
  await poll;
  const t0 = frames[0]?.t ?? Date.now();
  const rows = [];
  for (const f of frames) {
    const buf = Buffer.from(f.data, "base64");
    const { data } = await sharp(buf).resize(128, 80, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (const v of data) sum += v;
    const ms = Math.round(f.t - t0);
    rows.push({ ms, lum: sum / data.length, file: `f${String(ms).padStart(6, "0")}.jpg`, buf });
  }
  for (const r of rows) writeFileSync(`${dir}/${r.file}`, r.buf);
  const flagged = [];
  rows.forEach((r, i) => {
    const prev = rows[i - 1]?.lum ?? r.lum;
    const next = rows[i + 1]?.lum ?? r.lum;
    if (Math.abs(r.lum - prev) > 20 && Math.abs(r.lum - next) > 20 && Math.sign(r.lum - prev) === Math.sign(r.lum - next)) flagged.push({ ms: r.ms, line: `PROBLEM: blink? lum=${r.lum.toFixed(0)} ${r.file}` });
    if (expectTheme === "dark" && r.lum > 90) flagged.push({ ms: r.ms, line: `PROBLEM: a light frame while dark is picked, lum=${r.lum.toFixed(0)} ${r.file}` });
    if (expectTheme === "light" && r.lum < 170) flagged.push({ ms: r.ms, line: `PROBLEM: a dark frame while light is picked, lum=${r.lum.toFixed(0)} ${r.file}` });
  });
  if (themeTaps) {
    // Each theme picked is one jump between the themes: dark <-> light, never there and back.
    const jumps = rows.filter((r, i) => i > 0 && Math.abs(r.lum - rows[i - 1].lum) > 60).length;
    log(`${name}: ${jumps} jump(s) in brightness for ${themeTaps} tap(s)`);
    if (jumps !== themeTaps) flagged.push({ ms: 0, line: `PROBLEM: ${jumps} jumps for ${themeTaps} taps` });
  }
  problems += flagged.length;
  const timeline = [...events.map((e) => ({ ms: Math.round(e.t - t0), line: e.what })), ...flagged].sort((x, y) => x.ms - y.ms);
  log(`== ${name}: ${rows.length} frames, brightness ${Math.min(...rows.map((r) => r.lum)).toFixed(0)}-${Math.max(...rows.map((r) => r.lum)).toFixed(0)}`);
  for (const l of timeline) log(`${String(l.ms).padStart(7)}ms ${l.line}`);
}

const click = async (p, locator) => {
  const box = await locator.boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const tap = async (p, locator) => {
  const box = await locator.boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};
const named = (ctx, n) =>
  ctx.addInitScript((n) => {
    if (!localStorage.getItem("brc.name")) localStorage.setItem("brc.name", n);
  }, n);

// 1. Computer: PLAY, the lobby fills in place (someone else joins, then the bots), then the vote.
for (const scheme of ["dark", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  await named(ctx, "Framer");
  const p = await ctx.newPage();
  p.on("pageerror", (e) => log(`pageerror ${e.message}`));
  await p.goto(`${base}/?debug&pool=${pool}-${scheme}`);
  await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/desktop-home-${scheme}.png` });
  const other = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  await named(other, "Joiner");
  const o = await other.newPage();
  await o.goto(`${base}/?pool=${pool}-${scheme}`);
  await o.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  let shot = false;
  await record(
    ctx,
    p,
    `1-play-in-place-${scheme}`,
    async (mark) => {
      mark("click PLAY");
      await click(p, p.getByRole("button", { name: "PLAY", exact: true }));
      await p.waitForTimeout(1500);
      mark("someone else clicks PLAY");
      await click(o, o.getByRole("button", { name: "PLAY", exact: true }));
      for (let i = 0; i < 1500; i++) {
        const s = await state(p);
        if (!shot && s.screen === "queue" && s.count === 2) {
          await p.waitForTimeout(600);
          shot = true;
          await p.screenshot({ path: `${out}/desktop-queue-${scheme}.png` });
        }
        if (s.screen === "vote") break;
        await p.waitForTimeout(20);
      }
      await p.waitForTimeout(800);
    },
    { framed: true },
  );
  await other.close();
  await ctx.close();
  // 2. PLAY then Cancel (a device that isn't in a match: one that is would go back into it).
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  await named(ctx2, "Framer");
  const p2 = await ctx2.newPage();
  await p2.goto(`${base}/?debug&pool=${pool}-${scheme}-cancel`);
  await p2.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await p2.waitForTimeout(800);
  await record(
    ctx2,
    p2,
    `2-play-cancel-${scheme}`,
    async (mark) => {
      mark("click PLAY");
      await click(p2, p2.getByRole("button", { name: "PLAY", exact: true }));
      await p2.locator(".fd-seats").waitFor();
      await p2.waitForTimeout(1500);
      mark("click Cancel");
      await click(p2, p2.getByRole("button", { name: "Cancel" }));
      await p2.getByRole("button", { name: "PLAY", exact: true }).waitFor();
      await p2.waitForTimeout(800);
    },
    { framed: true },
  );
  await ctx2.close();
}

// 3. Settings → Theme (computer): light to dark and back. 4. Reloading with a pick: that theme from the first frame.
const themePick = (p, name) => p.getByRole("radiogroup", { name: "Theme" }).getByRole("radio", { name, exact: true });
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  await named(ctx, "Framer");
  const p = await ctx.newPage();
  await p.goto(`${base}/settings`);
  await themePick(p, "Dark").waitFor();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/settings-light.png` });
  await record(
    ctx,
    p,
    "3-theme",
    async (mark) => {
      mark("click Dark");
      await click(p, themePick(p, "Dark"));
      await p.waitForTimeout(900);
      await p.mouse.move(640, 400);
      await p.screenshot({ path: `${out}/settings-dark.png` });
      mark("click Light");
      await click(p, themePick(p, "Light"));
      await p.waitForTimeout(900);
    },
    { framed: true, themeTaps: 2 },
  );
  // Dark picked on this light device: home, reload, dark from the first frame.
  await click(p, themePick(p, "Dark"));
  await p.waitForTimeout(300);
  await p.goto(`${base}/`);
  await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await record(
    ctx,
    p,
    "4-reload-dark-picked-on-light-device",
    async (mark) => {
      mark("reload");
      await p.reload();
      await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
      await p.waitForTimeout(1200);
    },
    { expectTheme: "dark" },
  );
  await ctx.close();
}
{
  const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: "dark" });
  await named(ctx, "Framer");
  const p = await ctx.newPage();
  await p.goto(`${base}/`);
  await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/phone-home-dark.png` });
  // The phone: Settings → Light; then home, and a reload is light from the first frame.
  await p.goto(`${base}/settings`);
  await themePick(p, "Light").waitFor();
  await record(ctx, p, "4b-phone-theme", async (mark) => {
    mark("tap Light");
    await tap(p, themePick(p, "Light"));
    await p.waitForTimeout(900);
  }, { themeTaps: 1 });
  await p.goto(`${base}/`);
  await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/phone-home-light.png` });
  await record(
    ctx,
    p,
    "4c-phone-reload-light-picked-on-dark-device",
    async (mark) => {
      mark("reload");
      await p.reload();
      await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
      await p.waitForTimeout(1200);
    },
    { expectTheme: "light" },
  );
  // 5. Phone: PLAY, the full-screen queue, Cancel.
  await p.goto(`${base}/?debug&pool=${pool}-phone`);
  await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await p.waitForTimeout(800);
  await record(ctx, p, "5-phone-play-cancel", async (mark) => {
    mark("tap PLAY");
    await tap(p, p.getByRole("button", { name: "PLAY", exact: true }));
    await p.locator(".fd-seats").waitFor();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/phone-queue-light.png` });
    mark("tap Cancel");
    await tap(p, p.getByRole("button", { name: "Cancel" }));
    await p.getByRole("button", { name: "PLAY", exact: true }).waitFor();
    await p.waitForTimeout(800);
  });
  await ctx.close();
}

writeFileSync(`${out}/timeline.txt`, lines.join("\n"));
console.log(problems ? `${problems} problem(s) to look at` : "no problems");
await b.close();
