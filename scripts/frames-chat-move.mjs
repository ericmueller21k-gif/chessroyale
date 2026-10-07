// Frame-by-frame check of moves made with quick chat on (see .claude/LESSONS.md): an online 50 v 50 on a phone-sized
// screen, chat in the space under the board, while another player's lines keep arriving (feed, bubble, emoji floats).
//   npm run frames:chat -- <out-dir> [moves=2] [scheme=dark|light] [layout=split|chat|board] [base url]
// Needs the Worker running (npx wrangler dev --port 8788 --enable-containers=false --var MATCH_FILL_SECONDS:8 ...).
// layout: what the phone shows under the board (split: scoreboard and chat side by side; chat: chat full width;
// board: the scoreboard full width, so new lines come as the bubble).
// Writes f<ms>.jpg for every painted frame and timeline.txt, and prints: phase changes, every change of the pieces
// on the board, the board's box (it must never change), the bubble's box (it must never touch the board), and
// frames whose brightness jumps (a flash). Read the frames around each move: a piece that jumps back, flickers or
// moves twice shows up as an extra change.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { Chess } from "chess.js";
import sharp from "sharp";

const [out = "chat-frames", movesArg = "2", scheme = "dark", layout = "split", base = "http://localhost:8788"] = process.argv.slice(2);
const moves = Number(movesArg);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: scheme });
const p = await ctx.newPage();
const other = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
for (const [pg, name] of [[p, "Framey"], [other, "Chatty"]]) {
  pg.on("pageerror", (e) => console.log("pageerror", name, e.message));
  await pg.addInitScript(([n, l]) => {
    if (!localStorage.getItem("brc.name")) localStorage.setItem("brc.name", n);
    localStorage.setItem("brc.underBoard", l);
  }, [name, layout]);
}
const pool = `frames${Date.now()}`;
for (const pg of [p, other]) {
  await pg.goto(`${base}/?debug&pool=${pool}`);
  await pg.getByRole("button", { name: "PLAY", exact: true }).click();
}
const phase = (pg = p) => pg.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");

// The other player: picks any legal move when it must, and says something to everyone every few seconds.
let helping = true;
const lines = ["good-luck", "nice-move", "wow", "e-fire", "go-mate", "e-clap", "thanks", "so-close"];
const helper = (async () => {
  let i = 0;
  let saidAt = 0;
  while (helping) {
    if ((await phase(other)) === "play") {
      const fen = await other.evaluate(() => window.match.phase.board.fen).catch(() => null);
      if (fen) {
        const mv = new Chess(fen).moves({ verbose: true })[0];
        await other.evaluate((m) => window.match.phase.kind === "play" && Date.now() > window.match.phase.startsAt && window.match.submit(m), mv.from + mv.to + (mv.promotion ?? "")).catch(() => undefined);
      }
    }
    if (Date.now() - saidAt > 3300) {
      saidAt = Date.now();
      const say = lines[i++ % lines.length];
      await other.evaluate((s) => window.match?.chat?.enabled && (window.match.chat.setTo("all"), window.match.chat.say(s)), say).catch(() => undefined);
    }
    await other.waitForTimeout(250);
  }
})();

const myTurn = async () => {
  for (let i = 0; i < 1200; i++) {
    const ok = await p.evaluate(() => window.match?.phase.kind === "play" && Date.now() > window.match.phase.startsAt + 300).catch(() => false);
    if (ok) return true;
    await p.waitForTimeout(100);
  }
  return false;
};
if (!(await myTurn())) throw new Error("never this team's turn");

// Every painted frame.
const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
const events = [];
const boards = new Map();
let bubbleOverBoard = 0;
let bubbles = 0;
let sampling = true;
const sampler = (async () => {
  let last = "";
  let lastBubble = "";
  while (sampling) {
    const s = await p
      .evaluate(() => {
        const r = (el) => (el ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null);
        const pieces = [...document.querySelectorAll(".board-area cg-board piece")].map((e) => `${e.className}@${e.style.transform}`).sort().join("|");
        return { k: window.match?.phase.kind, pieces, board: r(document.querySelector(".board-area cg-board")), bubble: r(document.querySelector(".qbubble")), text: document.querySelector(".qbubble")?.textContent ?? "" };
      })
      .catch(() => null);
    if (s) {
      const t = Date.now();
      const key = `${s.k} ${s.pieces}`;
      if (key !== last) {
        events.push({ t, what: `phase=${s.k} pieces=${s.pieces ? s.pieces.split("|").length : 0} sig=${hash(s.pieces)}` });
        last = key;
      }
      if (s.board && ["play", "scoring", "watching", "reveal"].includes(s.k)) {
        const bk = `${s.board.x},${s.board.y} ${s.board.w}x${s.board.h}`;
        if (!boards.has(bk)) events.push({ t, what: `board box ${bk} (${s.k})` });
        boards.set(bk, (boards.get(bk) ?? 0) + 1);
      }
      if (s.bubble && s.text !== lastBubble) {
        bubbles++;
        events.push({ t, what: `bubble "${s.text}" at y ${s.bubble.y}-${s.bubble.y + s.bubble.h}, board top ${s.board?.y ?? "-"}` });
      }
      lastBubble = s.bubble ? s.text : "";
      if (s.bubble && s.board && s.bubble.y + s.bubble.h > s.board.y && s.bubble.y < s.board.y + s.board.h) bubbleOverBoard++;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
})();
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).slice(0, 6);
}
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });

for (let m = 0; m < moves; m++) {
  if (m > 0 && !(await myTurn())) break;
  const fen = await p.evaluate(() => window.match.phase.board.fen);
  const side = fen.split(" ")[1];
  const all = new Chess(fen).moves({ verbose: true }).filter((x) => !x.promotion);
  const mv = all.find((x) => x.piece === "n" || x.piece === "b") ?? all[0];
  const box = await p.locator(".board-area cg-board").first().boundingBox();
  const sq = (s) => {
    const f = s.charCodeAt(0) - 97;
    const r = Number(s[1]) - 1;
    const x = side === "w" ? f : 7 - f;
    const y = side === "w" ? 7 - r : r;
    return { x: box.x + (x + 0.5) * (box.width / 8), y: box.y + (y + 0.5) * (box.height / 8) };
  };
  events.push({ t: Date.now(), what: `tap ${mv.from}${mv.to}` });
  await p.touchscreen.tap(sq(mv.from).x, sq(mv.from).y);
  await p.waitForTimeout(150);
  await p.touchscreen.tap(sq(mv.to).x, sq(mv.to).y);
  await p.waitForTimeout(200);
  const picked = await p.evaluate(() => (window.match.phase.kind === "scoring" ? window.match.phase.move : null));
  events.push({ t: Date.now(), what: picked === mv.from + mv.to ? `picked ${picked}` : `NOT PICKED (phase ${await phase()})` });
  await p.waitForTimeout(1500);
}
// Watch the reveal of the last move play out.
await p.waitForTimeout(4000);
await cdp.send("Page.stopScreencast");
sampling = false;
helping = false;
await sampler;
await helper;

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
  `${rows.length} frames (${scheme}, ${layout}), median luminance ${median.toFixed(1)}`,
  ...timeline.map((l) => `${String(l.ms).padStart(6)}ms ${l.line}`),
  `board boxes seen: ${[...boards.keys()].join(" ; ")}`,
  `bubbles: ${bubbles}, samples with a bubble over the board: ${bubbleOverBoard}`,
].join("\n");
console.log(text);
writeFileSync(`${out}/timeline.txt`, text);
await b.close();
if (boards.size > 1 || bubbleOverBoard > 0) process.exitCode = 1;
