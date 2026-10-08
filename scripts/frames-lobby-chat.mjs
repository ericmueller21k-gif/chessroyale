// Frame-by-frame check of the queue's lobby chat (see .claude/LESSONS.md): a phone in a Default queue while it fills,
// other players' lines arriving, a real tap on a line, people popping in, then the bots' fill and their hellos.
//   npm run frames:lobbychat -- <out-dir> [scheme=dark|light] [base url]
// Needs the Worker running (npx wrangler dev --port 8788 --enable-containers=false --var MATCH_FILL_SECONDS:20 ...).
// Writes f<ms>.jpg for every painted frame and timeline.txt, and prints: every change of the boxes of the count, the
// grid, the chat and Cancel (with what was going on), every line arriving, frames whose brightness jumps (a flash),
// and any moment the chat covers the count, the grid or Cancel. Exits 1 if the chat ever covers one of them, or if
// the chat or what's above it moves or resizes while lines arrive (before the fill, where the queue's own
// "Unranked" line appears).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import sharp from "sharp";

const [out = "lobby-chat-frames", scheme = "dark", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: scheme });
const p = await ctx.newPage();
const pool = `lcframes${Date.now().toString(36).slice(-6)}`;
const others = [];
const join = async (name) => {
  const o = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  o.on("pageerror", (e) => console.log("pageerror", name, e.message));
  await o.addInitScript((n) => localStorage.setItem("brc.name", n), name);
  await o.goto(`${base}/?debug&pool=${pool}`);
  await o.getByRole("button", { name: "PLAY", exact: true }).click();
  others.push(o);
  return o;
};
p.on("pageerror", (e) => console.log("pageerror", "Framey", e.message));
await p.addInitScript(() => localStorage.setItem("brc.name", "Framey"));
await p.goto(`${base}/?debug&pool=${pool}`);
const phase = () => p.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");

// Every painted frame, from the tap on PLAY.
const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
await p.getByRole("button", { name: "PLAY", exact: true }).click();
await p.locator(".fd-seats").waitFor();

const events = [];
const note = (what) => events.push({ t: Date.now(), what });
let covered = 0;
let movedWhileChatting = 0;
let sampling = true;
const sampler = (async () => {
  const lastBox = {};
  let lastLines = -1;
  let filled = false;
  while (sampling) {
    const s = await p
      .evaluate(() => {
        // (In the page, not the window: a scroll moves nothing.)
        const r = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x: Math.round(x), y: Math.round(y + scrollY), w: Math.round(width), h: Math.round(height) };
        };
        return {
          k: window.match?.phase.kind,
          filled: !!window.match?.filledAt,
          count: r(".fd-queue-count"),
          seats: r(".fd-seats"),
          chat: r(".lchat"),
          feed: r(".qchat-lobby .qfeed-wrap"),
          cancel: r(".fd-cancel"),
          lines: [...document.querySelectorAll(".qchat-lobby .qline")].map((e) => e.textContent),
          n: document.querySelector(".fd-count-n")?.textContent,
        };
      })
      .catch(() => null);
    if (!s || !s.seats) {
      if (s && s.k && s.k !== "lobby" && s.k !== "loading") break;
      await new Promise((r) => setTimeout(r, 25));
      continue;
    }
    const t = Date.now();
    if (s.filled && !filled) {
      filled = true;
      note(`the bots fill in (${s.n} / 100)`);
    }
    if (s.lines.length !== lastLines) {
      // (Newest first: the phone's feed lays its lines out bottom-up.)
      if (lastLines >= 0) note(`line ${s.lines.length}: "${s.lines[0]}"`);
      lastLines = s.lines.length;
    }
    for (const k of ["count", "seats", "chat", "feed", "cancel"]) {
      const v = s[k] && `${s[k].x},${s[k].y} ${s[k].w}x${s[k].h}`;
      if (v !== lastBox[k]) {
        if (lastBox[k] !== undefined) {
          note(`${k} box ${lastBox[k]} -> ${v} (${s.filled ? "after the fill" : "while waiting"})`);
          if (!s.filled) movedWhileChatting++;
        } else note(`${k} box ${v}`);
        lastBox[k] = v;
      }
    }
    const hit = (a, z) => a && z && a.x < z.x + z.w && z.x < a.x + a.w && a.y < z.y + z.h && z.y < a.y + a.h;
    for (const k of ["count", "seats", "cancel"])
      if (hit(s.chat, s[k])) {
        covered++;
        note(`CHAT COVERS ${k}`);
      }
    await new Promise((r) => setTimeout(r, 25));
  }
})();

// Chatty joins and talks every 3.3 s; Framey taps a line (a real tap) a moment later; two more pop in meanwhile.
const chatty = await join("Chatty");
let talking = true;
const talker = (async () => {
  const says = ["hi-all", "good-luck", "e-fire", "lets-go", "e-party", "have-fun"];
  for (let i = 0; talking; i++) {
    await chatty.evaluate((x) => window.match?.chat?.enabled && window.match.chat.say(x), says[i % says.length]).catch(() => undefined);
    await chatty.waitForTimeout(3300);
  }
})();
await p.waitForTimeout(2500);
const chip = p.locator(".qchat-lobby .qrow:not(.emoji) .qchip").first();
const cb = await chip.boundingBox();
note(`tap "${await chip.textContent()}"`);
await p.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
await p.waitForTimeout(2000);
await Promise.all([join("Popper"), join("Popper Two")]);
await p.waitForTimeout(2500);
const emoji = p.locator(".qchat-lobby .qrow.emoji .qchip").nth(5);
// (On a short phone the emoji row can sit below the fold: a finger scrolls it up first.)
const vh = await p.evaluate(() => innerHeight);
const below = (await emoji.boundingBox()).y + 50 - vh;
if (below > 0) {
  note(`scroll ${Math.round(below)} px`);
  await p.evaluate((d) => scrollBy(0, d), below);
  await p.waitForTimeout(400);
}
const eb = await emoji.boundingBox();
note(`tap "${await emoji.textContent()}"`);
await p.touchscreen.tap(eb.x + eb.width / 2, eb.y + eb.height / 2);
// Until the votes begin.
for (let i = 0; i < 600 && (await phase()) === "lobby"; i++) await p.waitForTimeout(100);
note(`phase ${await phase()}`);
await p.waitForTimeout(800);
await cdp.send("Page.stopScreencast");
sampling = false;
talking = false;
await sampler;
await talker;

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
for (const r of rows) writeFileSync(`${out}/${r.file}`, r.buf);
const lums = rows.map((r) => r.lum).sort((a, z) => a - z);
const median = lums[Math.floor(lums.length / 2)] ?? 0;
const flagged = rows.filter((r, i) => Math.abs(r.lum - (rows[i - 1]?.lum ?? r.lum)) > 20 || Math.abs(r.lum - median) > 25);
const timeline = [
  ...events.map((e) => ({ ms: Math.round(e.t - t0), line: e.what })),
  ...flagged.map((r) => ({ ms: r.ms, line: `FLASH? lum=${r.lum.toFixed(0)} (median ${median.toFixed(0)}) ${r.file}` })),
].sort((a, z) => a.ms - z.ms);
const text = [
  `${rows.length} frames (${scheme}), median luminance ${median.toFixed(1)}`,
  ...timeline.map((l) => `${String(l.ms).padStart(6)}ms ${l.line}`),
  `samples with the chat over the count, grid or Cancel: ${covered}; boxes changed while waiting: ${movedWhileChatting}`,
].join("\n");
console.log(text);
writeFileSync(`${out}/timeline.txt`, text);
await b.close();
if (covered > 0 || movedWhileChatting > 0) process.exitCode = 1;
