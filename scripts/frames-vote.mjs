// Frame-by-frame check of the pre-game votes (Crowd 50 v 50), the way a player votes on a phone: a real touch drag
// of your pawn into a zone in the first vote, a tap on your pawn then a tap on a zone in the second, then the hand-off
// to the game's real pieces. `plan` picks how you vote in each (drag, tap, or none: you don't, and when time's up
// your pawn walks to the winner with everyone else who didn't).
//   npm run frames:vote -- <out-dir> [scheme=light|dark] [width=360] [side=any|w|b] [plan=drag,tap]
// Records every painted frame (Chrome's screencast) on a narrow phone and writes f<ms>.jpg for each, then prints a
// timeline: phases, your pawn's spot, the zone counts, frames that flash (a jump in brightness), and the board's box
// on the vote and on the game's first screen (it must not move). See .claude/LESSONS.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import sharp from "sharp";

const [out = ".", scheme = "light", widthArg = "360", want = "any", planArg = "drag,tap"] = process.argv.slice(2);
const plan = planArg.split(",");
const width = Number(widthArg);
mkdirSync(out, { recursive: true });
// (Not one of the ports the other scripts share: vite takes the next free one if it's busy.)
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198 }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const phone = devices["iPhone 13"];
const height = Math.round((width * phone.viewport.height) / phone.viewport.width);
const ctx = await b.newContext({ ...phone, viewport: { width, height }, colorScheme: scheme });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
const phase = () => p.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");

// Solo 50 v 50 with the votes on; until you're on the side asked for (a fresh match each try).
let side = null;
for (let attempt = 0; attempt < 12; attempt++) {
  await p.goto(url + "?debug&nolanding&mode=crowd&turns=teams&augments=1&pace=quick");
  // Matchmaking: Solo, then PLAY (the seats fill with bots, then the match).
  await p.getByRole("radio", { name: /^Solo/ }).click();
  await p.getByRole("button", { name: "PLAY", exact: true }).click();
  for (let i = 0; i < 400 && (await phase()) !== "vote"; i++) await p.waitForTimeout(50);
  side = await p.evaluate(() => window.match.standings().find((s) => s.isYou).team);
  if (want === "any" || side === want) break;
}
console.log(`you play ${side === "w" ? "White" : "Black"} (${scheme}, ${width}x${height})`);

const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
const events = [];
const note = (what) => events.push({ t: Date.now(), what });
let polling = true;
let lastKey = null;
const boxes = [];
const poll = (async () => {
  while (polling) {
    const s = await p
      .evaluate(() => {
        const m = window.match;
        const me = document.querySelector(".vote-me");
        const wrap = document.querySelector(".board-wrap")?.getBoundingClientRect();
        const r = me?.getBoundingClientRect();
        return {
          kind: m?.phase.kind,
          vote: m?.phase.kind === "vote" ? `${m.phase.vote.index}${m.phase.vote.result === null ? "" : "=" + m.phase.vote.result}` : "",
          joined: m?.phase.kind === "vote" ? m.phase.vote.votes.filter((v) => v.joined).length : 0,
          hint: document.querySelector(".vote-hint")?.textContent ?? "",
          banner: !!document.querySelector(".vote-banner"),
          me: r ? `${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)} ${Math.round(r.width)}px` : "-",
          counts: [...document.querySelectorAll(".vote-zone-count")].map((e) => e.textContent).join("/"),
          pieces: document.querySelectorAll("cg-board piece").length,
          box: wrap ? `${wrap.x.toFixed(1)},${wrap.y.toFixed(1)} ${wrap.width.toFixed(1)}` : "-",
        };
      })
      .catch(() => null);
    if (s) {
      const key = `${s.kind}|${s.vote}|${s.me}|${s.pieces}|${s.hint}|${s.banner}|${s.counts}`;
      if (key !== lastKey) {
        note(`phase=${s.kind} vote=${s.vote} you@${s.me} counts=${s.counts} joined=${s.joined} pieces=${s.pieces}${s.banner ? " BANNER" : ""} "${s.hint}" board=${s.box}`);
        lastKey = key;
      }
      boxes.push({ kind: s.kind, box: s.box });
    }
    await new Promise((r) => setTimeout(r, 30));
  }
})();
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 75, everyNthFrame: 1 });

/** A real finger: touch down, move in steps, lift (CDP touch events, as a phone sends them). */
async function drag(from, to, steps = 14) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }] });
    await p.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const centre = async (sel, nth = 0) => {
  const r = await p.locator(sel).nth(nth).boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

/** Votes the way `how` says: a drag into the middle zone, a tap on your pawn then the left zone, or nothing. */
async function vote(how) {
  await p.waitForTimeout(1200);
  if (how === "drag") {
    const me = await centre(".vote-me");
    const zone = await centre(".vote-zone", 1);
    note(`drag from ${Math.round(me.x)},${Math.round(me.y)} to ${Math.round(zone.x)},${Math.round(zone.y)}`);
    await drag(me, zone);
  } else if (how === "tap") {
    const me = await centre(".vote-me");
    note("tap your pawn");
    await p.touchscreen.tap(me.x, me.y);
    await p.waitForTimeout(400);
    const left = await centre(".vote-zone", 0);
    note("tap a zone");
    await p.touchscreen.tap(left.x, left.y);
    await p.waitForTimeout(200);
  } else note("no vote: your pawn stays home");
  note(`myVote=${await p.evaluate(() => window.match.myVote)}`);
}
// Vote 1.
await vote(plan[0]);
// Vote 2.
for (let i = 0; i < 400; i++) {
  const v = await p.evaluate(() => (window.match.phase.kind === "vote" ? window.match.phase.vote : null));
  if (v && v.index === 1 && v.result === null) break;
  await p.waitForTimeout(50);
}
await vote(plan[1] ?? "tap");
// Until the game has begun, and a moment more.
for (let i = 0; i < 600 && !/play|watching/.test(await phase()); i++) await p.waitForTimeout(50);
await p.waitForTimeout(1200);
await cdp.send("Page.stopScreencast");
polling = false;
await poll;

// Every frame, its brightness, and anything that flashes against its neighbours.
const t0 = frames[0]?.t ?? Date.now();
const rows = [];
for (const f of frames) {
  const buf = Buffer.from(f.data, "base64");
  const { data } = await sharp(buf).resize(72, 148, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const v of data) sum += v;
  const ms = Math.round(f.t - t0);
  rows.push({ ms, lum: sum / data.length, file: `f${String(ms).padStart(6, "0")}.jpg`, buf });
}
for (const r of rows) writeFileSync(`${out}/${r.file}`, r.buf);
const flagged = rows.filter((r, i) => i > 0 && Math.abs(r.lum - rows[i - 1].lum) > 18);
const timeline = [
  ...events.map((e) => ({ ms: Math.round(e.t - t0), line: e.what })),
  ...flagged.map((r) => ({ ms: r.ms, line: `FLASH? lum ${r.lum.toFixed(0)} ${r.file}` })),
].sort((a, z) => a.ms - z.ms);
console.log(`${rows.length} frames`);
for (const l of timeline) console.log(`${String(l.ms).padStart(6)}ms ${l.line}`);
// The board's box: on the vote, and on the game's first screen.
const voteBox = boxes.filter((x) => x.kind === "vote").at(-1)?.box;
const gameBox = boxes.find((x) => x.kind === "play" || x.kind === "watching")?.box;
console.log(`board on the vote ${voteBox} · in the game ${gameBox} · ${voteBox === gameBox ? "same box" : "MOVED"}`);
await b.close();
await server.close();
