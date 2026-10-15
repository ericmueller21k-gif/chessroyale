// The opening allowance and the cut, frame by frame (DECISIONS.md, "Opening grace and ties survive the cut"): a solo
// Crowd 50 v 50 with a cut after every move. Move 1: a sound move off the engine's line ("−2.4 → 0 · opening" on the
// reveal), then the first cut (ties go through). Move 2: a move that leaves a piece to be taken ("· gave up material"),
// then the cut, and "Why was I cut?" if it takes you.
//   npm run frames:allowance -- <out-dir> [device=phone|desktop|narrow] [port=5231]
// Writes f<ms>.jpg for every painted frame, shots of the moments (reveal-1.png, cut-1.png, reveal-2.png, cut-2.png,
// why.png), and prints the phases and the reveal line's size on screen.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = ".", device = "phone", portArg = "5231"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: Number(portArg), strictPort: true }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const use =
  device === "desktop"
    ? { viewport: { width: 1280, height: 800 } }
    : device === "narrow"
      ? { ...devices["iPhone SE"], browserName: undefined }
      : { ...devices["iPhone 13"], browserName: undefined };
const ctx = await b.newContext({ ...use, colorScheme: "dark" });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(url + "?debug&clock=40&nolanding&mode=crowd&format=team&rounds=2&augments=0");
await p.getByRole("radio", { name: /^Solo/ }).click();
await p.getByRole("button", { name: "PLAY", exact: true }).click();

const phase = () => p.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");
const waitFor = async (kinds, ms = 120_000) => {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    const k = await phase();
    if (kinds.includes(k)) return k;
    await p.waitForTimeout(50);
  }
  return null;
};

// Every painted frame, with the time it was painted, and the phases as they change.
const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
const events = [];
let lastKind = null;
let polling = true;
const poll = (async () => {
  while (polling) {
    const k = await phase();
    if (k !== lastKind) {
      events.push({ t: Date.now(), what: `phase=${k}` });
      lastKind = k;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
})();

/** The engine's top moves here, from the page's own engine (started in the page, polled: never awaited in an evaluate). */
async function top() {
  await p.evaluate(() => {
    const m = window.match;
    window.__top = null;
    void m.runner.topMovesFor(m.phase.board.fen).then((t) => (window.__top = t));
  });
  for (let i = 0; i < 600; i++) {
    const t = await p.evaluate(() => window.__top);
    if (t) return t;
    await p.waitForTimeout(100);
  }
  return [];
}

/** Taps a move on the board, as a player does. */
async function tap(move) {
  const box = await p.locator(".hb-board").first().boundingBox();
  const black = await p.evaluate(() => !!document.querySelector(".hb.orientation-black"));
  const sq = (s) => {
    const f = s.charCodeAt(0) - 97;
    const r = Number(s[1]) - 1;
    const x = black ? 7 - f : f;
    const y = black ? r : 7 - r;
    return { x: box.x + (x + 0.5) * (box.width / 8), y: box.y + (y + 0.5) * (box.height / 8) };
  };
  events.push({ t: Date.now(), what: `tap ${move}` });
  await p.mouse.click(sq(move.slice(0, 2)).x, sq(move.slice(0, 2)).y);
  await p.mouse.click(sq(move.slice(2, 4)).x, sq(move.slice(2, 4)).y);
}

/** The reveal's allowance line, measured: its text, whether it spills, its height against its line height. */
const measure = () =>
  p.evaluate(() => {
    const el = document.querySelector(".allowance-line") ?? [...document.querySelectorAll(".dock-line")].find((e) => /opening|material|capture/.test(e.textContent ?? ""));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { text: el.innerText, spill: el.scrollWidth - el.clientWidth, height: Math.round(r.height), lineHeight: parseFloat(getComputedStyle(el).lineHeight), left: Math.round(r.left), right: Math.round(r.right), width: innerWidth };
  });

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
const shots = [];
for (let move = 1; move <= 2; move++) {
  if ((await waitFor(["play"])) !== "play") break;
  await p.waitForTimeout(600);
  const fen = await p.evaluate(() => window.match.phase.board.fen);
  const t = await top();
  const best = t[0]?.expected ?? 0;
  let pick;
  if (move === 1) {
    // A sound move off the engine's line: 0.5 to 6 points.
    pick = t.find((m) => (best - m.expected) * 100 >= 0.5 && (best - m.expected) * 100 <= 6)?.move ?? t[1]?.move;
  } else {
    // A knight or bishop to a square an enemy pawn attacks: a piece left to be taken.
    const c = new Chess(fen);
    const them = c.turn() === "w" ? "b" : "w";
    const hang = c.moves({ verbose: true }).find((m) => (m.piece === "n" || m.piece === "b") && !m.captured && c.attackers(m.to, them).some((s) => c.get(s)?.type === "p"));
    pick = hang ? hang.from + hang.to : t.at(-1)?.move;
  }
  await tap(pick);
  if ((await waitFor(["reveal"], 60_000)) === "reveal") {
    await p.locator(".allowance-line, .dock-line").first().waitFor({ timeout: 5000 }).catch(() => undefined);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/reveal-${move}.png` });
    shots.push(`reveal-${move}.png`);
    console.log(`move ${move} (${pick}): line`, JSON.stringify(await measure()));
  }
  // The other team's move, then the cut (a cut after every move).
  if ((await waitFor(["stageBreak"], 90_000)) === "stageBreak") {
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `${out}/cut-${move}.png` });
    shots.push(`cut-${move}.png`);
    const head = await p.locator(".cut-head").innerText().catch(() => "");
    const out_ = await p.evaluate(() => ({ out: window.match.phase.knockedOut.length, youOut: window.match.phase.youOut }));
    console.log(`cut ${move}: "${head.replace(/\s+/g, " ")}"`, JSON.stringify(out_));
    if (out_.youOut) {
      await p.getByRole("button", { name: "Why was I cut?" }).click();
      await p.waitForTimeout(600);
      await p.screenshot({ path: `${out}/why.png` });
      shots.push("why.png");
      break;
    }
  }
}
await p.waitForTimeout(500);
await cdp.send("Page.stopScreencast");
polling = false;
await poll;
const t0 = frames[0]?.t ?? Date.now();
for (const f of frames) writeFileSync(`${out}/f${String(Math.round(f.t - t0)).padStart(6, "0")}.jpg`, Buffer.from(f.data, "base64"));
console.log(`${frames.length} frames; shots: ${shots.join(", ")}`);
for (const e of events) console.log(`${String(Math.round(e.t - t0)).padStart(6)}ms ${e.what}`);
await b.close();
await server.close();
