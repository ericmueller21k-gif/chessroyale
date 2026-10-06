// Records every frame the browser paints while you play moves in a solo game on a phone-sized screen, and flags
// frames that flash or blink (a big jump in brightness against the frames around them).
//   npm run frames:flash -- <out-dir> [moves=3] [scheme=dark|light] [mode=boss|crowd|classic] [extra=url&params]
// Writes f<ms>.jpg for every painted frame, and prints a timeline of phase changes and flagged frames.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";
import sharp from "sharp";

const [out = ".", movesArg = "3", scheme = "dark", mode = "boss", extra = ""] = process.argv.slice(2);
const moves = Number(movesArg);
mkdirSync(out, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5196 }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: scheme });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
const modeQuery = mode === "boss" ? "" : mode === "crowd" ? "&mode=crowd&turns=teams&augments=0" : "&mode=classic";
await p.goto(url + `?debug&clock=30&nolanding${modeQuery}${extra ? "&" + extra : ""}`);
if (mode === "boss") {
  await p.getByRole("button", { name: "Boss alone" }).click();
  await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /Iron Bishop/ }).click();
} else {
  await p.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await p.getByRole("button", { name: /^Solo vs \d+ bots$/ }).click();
}
const phase = () => p.evaluate(() => window.match?.phase.kind ?? "none").catch(() => "?");
const waitPlay = async () => {
  for (let i = 0; i < 400; i++) {
    if ((await phase()) === "play") return true;
    await p.waitForTimeout(100);
  }
  return false;
};
await waitPlay();
await p.waitForTimeout(1500);

// Every painted frame, with the wall-clock time it was painted.
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
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });

for (let m = 0; m < moves; m++) {
  if (!(await waitPlay())) break;
  await p.waitForTimeout(800);
  const fen = await p.evaluate(() => window.match.phase.board.fen);
  const c = new Chess(fen);
  const all = c.moves({ verbose: true });
  const mv = all.find((x) => x.piece === "n" || x.piece === "b") ?? all[0];
  const box = await p.locator("cg-board").first().boundingBox();
  const black = await p.evaluate(() => !!document.querySelector(".cg-wrap.orientation-black"));
  const sq = (s) => {
    const f = s.charCodeAt(0) - 97;
    const r = Number(s[1]) - 1;
    const x = black ? 7 - f : f;
    const y = black ? r : 7 - r;
    return { x: box.x + (x + 0.5) * (box.width / 8), y: box.y + (y + 0.5) * (box.height / 8) };
  };
  events.push({ t: Date.now(), what: `tap ${mv.from}${mv.to}` });
  await p.mouse.click(sq(mv.from).x, sq(mv.from).y);
  await p.mouse.click(sq(mv.to).x, sq(mv.to).y);
  // Until it's our turn again (the reveal, the boss thinking and moving).
  await p.waitForTimeout(1000);
  await waitPlay();
}
await p.waitForTimeout(500);
await cdp.send("Page.stopScreencast");
polling = false;
await poll;

// Brightness of each frame: mean luminance and the share of near-white pixels.
const t0 = frames[0]?.t ?? Date.now();
const rows = [];
for (const f of frames) {
  const buf = Buffer.from(f.data, "base64");
  const { data, info } = await sharp(buf).resize(78, 169, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let white = 0;
  for (const v of data) {
    sum += v;
    if (v > 225) white++;
  }
  const ms = Math.round(f.t - t0);
  rows.push({ ms, lum: sum / data.length, white: white / data.length, file: `f${String(ms).padStart(6, "0")}.jpg`, buf });
  void info;
}
for (const r of rows) writeFileSync(`${out}/${r.file}`, r.buf);
const lums = rows.map((r) => r.lum).sort((a, z) => a - z);
const median = lums[Math.floor(lums.length / 2)] ?? 0;
const flagged = rows.filter((r, i) => {
  const prev = rows[i - 1]?.lum ?? r.lum;
  return r.lum - median > 25 || r.lum - prev > 20;
});
const timeline = [
  ...events.map((e) => ({ ms: Math.round(e.t - t0), line: e.what })),
  ...flagged.map((r) => ({ ms: r.ms, line: `FLASH? lum=${r.lum.toFixed(0)} (median ${median.toFixed(0)}) white=${(r.white * 100).toFixed(0)}% ${r.file}` })),
].sort((a, z) => a.ms - z.ms);
console.log(`${rows.length} frames, median luminance ${median.toFixed(1)}`);
for (const l of timeline) console.log(`${String(l.ms).padStart(6)}ms ${l.line}`);
writeFileSync(`${out}/lum.tsv`, rows.map((r) => `${r.ms}\t${r.lum.toFixed(1)}\t${(r.white * 100).toFixed(1)}`).join("\n"));
await b.close();
await server.close();
