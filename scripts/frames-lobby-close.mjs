// Frame-by-frame check of a finished match's lobby closing (see .claude/LESSONS.md and DECISIONS.md, "Closing
// finished lobbies"): a short online match (a boss raid of one), a reload on its results, then every painted frame
// while the keep time runs out and the app goes home with the note, and a real tap on "See your result".
//   npm run frames:close -- <out-dir> [scheme=dark|light] [base url, default http://localhost:8788]
// Needs the Worker running (npx wrangler dev --port 8788 --enable-containers=false --var ENGINE_OFF:1). Saves:
//   results-reopened.png   the results after a reload, while the lobby is still open
//   home-note-result.png   home with the note and "See your result" (you played it)
//   home-note.png          home with the note only (someone who wasn't in it opens the link)
//   profile-match.png      your profile at that match
//   frames/f<ms>.jpg       every painted frame from the results to home and on to the profile, and a timeline
//                          (phase and screen changes, taps, and any frame much brighter than the ones around it).
import { chromium, devices } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const [out = "close-frames", scheme = "dark", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(`${out}/frames`, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: scheme });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.addInitScript(() => {
  if (!localStorage.getItem("brc.name")) localStorage.setItem("brc.name", "Closer");
});
const phase = () => p.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");
const screen = () =>
  p.evaluate(() => (document.querySelector(".fd-notice") ? "home+note" : document.querySelector(".results") ? "results" : document.querySelector(".fd-profile") ? "profile" : document.querySelector(".fd-home") ? "home" : "other")).catch(() => "?");

// A boss raid of one, two crowd moves; its results stay up 25 s.
await p.goto(base + "/?debug&pace=quick&mode=raid&boss=1600&bossMoves=2&clock=20&keep=25");
await p.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
await p.getByRole("button", { name: "Create a raid" }).click();
await p.getByRole("button", { name: /^Start with 1 player$/ }).click();
const code = await p.evaluate(() => window.match.code);
for (let i = 0; i < 1200 && (await phase()) !== "results"; i++) {
  if ((await phase()) === "play") {
    await p
      .evaluate(async () => {
        const m = window.match;
        if (m.phase.kind !== "play" || Date.now() < m.phase.startsAt) return;
        const fen = m.phase.board.fen;
        const [engine] = await m.engines();
        const [top] = await engine.topMoves(fen, 1);
        if (m.phase.kind === "play" && m.phase.board.fen === fen) m.submit(top.move);
      })
      .catch(() => undefined);
  }
  await p.waitForTimeout(250);
}
await p.reload();
await p.locator(".results h1").waitFor();
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/results-reopened.png` });
console.log(`lobby ${code}: results after a reload: "${(await p.locator(".results h1").textContent()).trim()}"`);

// Every painted frame from here: the keep time runs out, home with the note, then a tap on "See your result".
const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
const events = [];
let last = null;
let layout = null;
let jumps = 0;
let polling = true;
const poll = (async () => {
  while (polling) {
    const s = `${await screen()} (${await phase()}) ${new URL(p.url()).pathname}`;
    if (s !== last) {
      events.push({ t: Date.now(), what: s });
      layout = null;
    }
    last = s;
    // On the home screen: the note's height and where PLAY sits. Any change once it's up is a jump.
    const l = await p
      .evaluate(() => {
        const n = document.querySelector(".fd-notice")?.getBoundingClientRect();
        const play = document.querySelector(".fd-play")?.getBoundingClientRect();
        return n && play ? `note ${Math.round(n.height)} px, PLAY at ${Math.round(play.top)}` : null;
      })
      .catch(() => null);
    if (l && layout && l !== layout) {
      jumps++;
      events.push({ t: Date.now(), what: `LAYOUT JUMP: ${layout} -> ${l}` });
    } else if (l && !layout) events.push({ t: Date.now(), what: l });
    if (l) layout = l;
    await new Promise((r) => setTimeout(r, 20));
  }
})();
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
await p.locator(".fd-notice").waitFor({ timeout: 90_000 });
await p.getByRole("button", { name: "See your result" }).waitFor();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/home-note-result.png` });
const go = await p.getByRole("button", { name: "See your result" }).boundingBox();
events.push({ t: Date.now(), what: "tap See your result" });
await p.touchscreen.tap(go.x + go.width / 2, go.y + go.height / 2);
await p.locator('.fd-match[aria-current="true"]').waitFor();
await p.waitForTimeout(900);
await cdp.send("Page.stopScreencast");
polling = false;
await poll;
await p.screenshot({ path: `${out}/profile-match.png` });

// Someone who wasn't in it: the note alone.
const other = await (await b.newContext({ ...devices["iPhone 13"], colorScheme: scheme })).newPage();
await other.goto(`${base}/lobby/${code}`);
await other.locator(".fd-notice").waitFor();
await other.waitForTimeout(600);
await other.screenshot({ path: `${out}/home-note.png` });

// The note at 320 px and 430 px: nothing wider than the screen, tap targets at least 44 px.
for (const width of [320, 430]) {
  await other.setViewportSize({ width, height: 700 });
  const m = await other.evaluate(() => {
    const n = document.querySelector(".fd-notice").getBoundingClientRect();
    const x = document.querySelector(".fd-notice-x").getBoundingClientRect();
    return { pageScroll: document.documentElement.scrollWidth - innerWidth, noteRight: n.right, width: innerWidth, x: [x.width, x.height] };
  });
  console.log(`${width} px: page overflow ${m.pageScroll} px, note right edge ${m.noteRight.toFixed(0)} of ${m.width}, dismiss ${m.x.join("×")}`);
}

// Brightness of each frame (a blink is a frame much brighter or darker than the ones around it).
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
for (const r of rows) writeFileSync(`${out}/frames/${r.file}`, r.buf);
const flagged = rows.filter((r, i) => {
  const prev = rows[i - 1]?.lum ?? r.lum;
  const next = rows[i + 1]?.lum ?? r.lum;
  // A one-frame spike or dip against both neighbours (a screen change is a step, not a spike).
  return Math.abs(r.lum - prev) > 20 && Math.abs(r.lum - next) > 20 && Math.sign(r.lum - prev) === Math.sign(r.lum - next);
});
const timeline = [
  ...events.map((e) => ({ ms: Math.round(e.t - t0), line: e.what })),
  ...rows.map((r, i) => (i && Math.abs(r.lum - rows[i - 1].lum) > 3 ? { ms: r.ms, line: `frame lum ${rows[i - 1].lum.toFixed(0)} -> ${r.lum.toFixed(0)} ${r.file}` } : null)).filter(Boolean),
  ...flagged.map((r) => ({ ms: r.ms, line: `BLINK? lum=${r.lum.toFixed(0)} ${r.file}` })),
].sort((a, z) => a.ms - z.ms);
const lines = [`${rows.length} frames (${scheme})`, ...timeline.map((l) => `${String(l.ms).padStart(6)}ms ${l.line}`)];
writeFileSync(`${out}/timeline.txt`, lines.join("\n"));
console.log(lines.join("\n"));
console.log(flagged.length ? `${flagged.length} frame(s) to look at` : "no blinks");
console.log(jumps ? `${jumps} layout jump(s) on the home screen` : "no layout jumps");
await b.close();
