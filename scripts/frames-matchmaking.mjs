// Frame-by-frame check of matchmaking (see .claude/LESSONS.md and DECISIONS.md, "Matchmaking types"), with real taps
// on a phone-sized screen:
//   1. home: tapping Default / Bots off / Solo and the ⓘ;
//   2. Solo: PLAY, the seats fill with bots, then the pre-game vote;
//   3. Bots off: PLAY, wait, then "Switch to Default" (the queue changes lobby, bots fill, the vote);
//   4. the app closed during a live match and opened again at /: back in the match.
//   npm run frames:matchmaking -- <out-dir> [scheme=dark|light] [base url, default http://localhost:8788]
// Needs the Worker running with a short fill (npx wrangler dev --port 8788 --enable-containers=false
// --var MATCH_FILL_SECONDS:8 --var ENGINE_OFF:1). Saves every painted frame (frames/<step>/f<ms>.jpg), a timeline per
// step (timeline.txt), and screenshots of each screen. Flags: a frame much brighter or darker than both neighbours
// (a blink), the seat grid vanishing or its count going down while on the queue screen, and any frame with neither
// the queue nor a match on screen once PLAY was tapped.
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [out = "mm-frames", scheme = "dark", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: scheme });
await ctx.addInitScript(() => {
  if (!localStorage.getItem("brc.name")) localStorage.setItem("brc.name", "Framer");
});
const pool = `frames-${Date.now().toString(36)}`;
const lines = [];
let problems = 0;
const log = (s) => {
  lines.push(s);
  console.log(s);
};

/** What's on screen, from the DOM: which screen, the seat count, how many pawns are drawn. */
const state = (p) =>
  p
    .evaluate(() => {
      const seats = document.querySelector(".fd-seats");
      const screen = seats
        ? "queue"
        : document.querySelector(".vote-screen")
          ? "vote"
          : document.querySelector(".fd-home")
            ? "home"
            : document.querySelector(".fd-splash")
              ? "splash"
              : document.querySelector(".screen")
                ? "match"
                : "blank";
      return {
        screen,
        count: Number(document.querySelector(".fd-count-n")?.textContent ?? 0),
        pawns: seats ? seats.querySelectorAll(".fd-seat.pop").length : 0,
        code: window.match?.code ?? null,
        path: location.pathname,
      };
    })
    .catch(() => ({ screen: "?", count: 0, pawns: 0, code: null, path: "?" }));

/**
 * Records a step: every painted frame and the DOM state every ~20 ms while `run` does its taps. `forbid`: screens that
 * mustn't appear in this step at all.
 */
async function record(p, name, run, forbid = []) {
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
  let played = false;
  const poll = (async () => {
    while (polling) {
      const s = await state(p);
      const key = `${s.screen} ${s.path}${s.code ? ` ${s.code}` : ""}`;
      if (key !== last) {
        events.push({ t: Date.now(), what: `screen: ${key}` });
        if (forbid.includes(s.screen)) {
          problems++;
          events.push({ t: Date.now(), what: `PROBLEM: the ${s.screen} screen showed here` });
        }
      }
      last = key;
      if (s.screen === "queue") {
        if (lastQueue && lastQueue.code === s.code && s.count < lastQueue.count) {
          problems++;
          events.push({ t: Date.now(), what: `PROBLEM: the count went down ${lastQueue.count} -> ${s.count}` });
        }
        lastQueue = s;
        played = true;
      } else if (lastQueue && s.screen === "blank") {
        problems++;
        events.push({ t: Date.now(), what: "PROBLEM: nothing on screen after the queue" });
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  })();
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
  await run((what) => events.push({ t: Date.now(), what }));
  await p.waitForTimeout(500);
  await cdp.send("Page.stopScreencast");
  polling = false;
  await poll;
  void played;
  const t0 = frames[0]?.t ?? Date.now();
  const rows = [];
  for (const f of frames) {
    const buf = Buffer.from(f.data, "base64");
    const { data } = await sharp(buf).resize(78, 169, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (const v of data) sum += v;
    const ms = Math.round(f.t - t0);
    rows.push({ ms, lum: sum / data.length, file: `f${String(ms).padStart(6, "0")}.jpg`, buf });
  }
  for (const r of rows) writeFileSync(`${dir}/${r.file}`, r.buf);
  const blinks = rows.filter((r, i) => {
    const prev = rows[i - 1]?.lum ?? r.lum;
    const next = rows[i + 1]?.lum ?? r.lum;
    return Math.abs(r.lum - prev) > 20 && Math.abs(r.lum - next) > 20 && Math.sign(r.lum - prev) === Math.sign(r.lum - next);
  });
  problems += blinks.length;
  const timeline = [
    ...events.map((e) => ({ ms: Math.round(e.t - t0), line: e.what })),
    ...blinks.map((r) => ({ ms: r.ms, line: `PROBLEM: blink? lum=${r.lum.toFixed(0)} ${r.file}` })),
  ].sort((x, y) => x.ms - y.ms);
  log(`== ${name}: ${rows.length} frames (${scheme})`);
  for (const l of timeline) log(`${String(l.ms).padStart(7)}ms ${l.line}`);
}

const tap = async (p, locator) => {
  const box = await locator.boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};
const types = (p) => p.getByRole("radiogroup", { name: "Matchmaking" });

// 1. Home: the three types and the ⓘ.
const home = await ctx.newPage();
home.on("pageerror", (e) => log(`pageerror ${e.message}`));
await home.goto(`${base}/?debug&pool=${pool}`);
await home.getByRole("button", { name: "PLAY", exact: true }).waitFor();
await home.waitForTimeout(800);
await record(home, "1-home-types", async (mark) => {
  for (const [what, loc] of [
    ["tap Bots off", types(home).getByRole("radio", { name: /^Bots off/ })],
    ["tap Solo", types(home).getByRole("radio", { name: /^Solo/ })],
    ["tap ⓘ", home.getByRole("button", { name: "About matchmaking" })],
    ["tap ⓘ", home.getByRole("button", { name: "About matchmaking" })],
    ["tap Default", types(home).getByRole("radio", { name: /^Default/ })],
  ]) {
    mark(what);
    await tap(home, loc);
    await home.waitForTimeout(500);
  }
});
await tap(home, home.getByRole("button", { name: "About matchmaking" }));
await home.waitForTimeout(400);
await home.screenshot({ path: `${out}/home-info.png` });
await tap(home, home.getByRole("button", { name: "About matchmaking" }));
await tap(home, types(home).getByRole("radio", { name: /^Bots off/ }));
await home.waitForTimeout(400);
await home.screenshot({ path: `${out}/home-botsoff-warning.png` });
// Where Boss alone lives: the home's buttons, under PLAY.
await home.getByRole("main").getByRole("button", { name: "Boss alone" }).scrollIntoViewIfNeeded();
await home.waitForTimeout(300);
await home.screenshot({ path: `${out}/home-boss-alone.png` });
// A raid with the types.
await home.evaluate(() => scrollTo(0, 0));
await tap(home, home.getByRole("radio", { name: /^Boss raid/ }));
await tap(home, types(home).getByRole("radio", { name: /^Default/ }));
await home.waitForTimeout(400);
await home.screenshot({ path: `${out}/home-raid-types.png` });
await tap(home, home.getByRole("radio", { name: /^Crowd/ }));

// 2. Solo: PLAY, the seats fill, the vote.
await tap(home, types(home).getByRole("radio", { name: /^Solo/ }));
await home.waitForTimeout(300);
let soloShot = false;
await record(home, "2-solo-fill", async (mark) => {
  mark("tap PLAY");
  await tap(home, home.getByRole("button", { name: "PLAY", exact: true }));
  for (let i = 0; i < 400; i++) {
    const s = await state(home);
    if (!soloShot && s.screen === "queue" && s.count >= 45) {
      soloShot = true;
      await home.screenshot({ path: `${out}/solo-filling.png` });
    }
    if (s.screen === "vote") break;
    await home.waitForTimeout(25);
  }
  await home.waitForTimeout(800);
});
await home.close();

// 3. Bots off, then one tap to Default: bots fill, Unranked.
const off = await ctx.newPage();
off.on("pageerror", (e) => log(`pageerror ${e.message}`));
await off.goto(`${base}/?debug&pool=${pool}`);
await off.getByRole("button", { name: "PLAY", exact: true }).waitFor();
await tap(off, types(off).getByRole("radio", { name: /^Bots off/ }));
await tap(off, off.getByRole("button", { name: "PLAY", exact: true }));
await off.locator(".fd-seats").waitFor();
await off.waitForTimeout(10_000);
await off.screenshot({ path: `${out}/queue-botsoff.png` });
let unrankedShot = false;
await record(off, "3-botsoff-to-default", async (mark) => {
  mark("tap Switch to Default");
  await tap(off, off.getByRole("button", { name: /Switch to Default/ }));
  for (let i = 0; i < 600; i++) {
    const s = await state(off);
    if (!unrankedShot && s.screen === "queue" && s.count >= 100) {
      await off.waitForTimeout(700);
      unrankedShot = true;
      await off.screenshot({ path: `${out}/queue-default-bots-unranked.png` });
    }
    if (s.screen === "vote") break;
    await off.waitForTimeout(25);
  }
  await off.waitForTimeout(800);
});
const live = await off.evaluate(() => window.match.code);

// 4. The app closed during that live match, and opened again at /.
await off.close();
const again = await ctx.newPage();
again.on("pageerror", (e) => log(`pageerror ${e.message}`));
await record(again, "4-reopen-rejoin", async (mark) => {
  mark("open the app at /");
  await again.goto(`${base}/?debug`);
  for (let i = 0; i < 400; i++) {
    const s = await state(again);
    if (s.code === live && s.screen !== "splash" && s.screen !== "queue" && s.screen !== "home") break;
    await again.waitForTimeout(25);
  }
  await again.waitForTimeout(1000);
}, ["home", "queue"]);
const back = await state(again);
log(`reopened: ${back.screen} at ${back.path} (live match ${live}) -> ${back.code === live ? "back in it" : "NOT back in it"}`);
if (back.code !== live) problems++;
// (Home must never show on the way: the timeline above lists every screen.)

writeFileSync(`${out}/timeline.txt`, lines.join("\n"));
console.log(problems ? `${problems} problem(s) to look at` : "no problems");
await b.close();
