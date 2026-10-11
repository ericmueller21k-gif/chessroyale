// A boss's attack on a king, frame by frame in Boss alone, on a phone and a computer: in the God King's Last Stand
// (?laststand=1: the blow meant for the piece is the boss's attack on him) and at the boss's mate (?mate=1: 1.f3 e5
// 2.g4, the boss mates; its attack on your king, then the result). The page's clock is paused as the attack is about to
// start and stepped 40 ms at a time, a frame of the board at each step (exact times, every frame), with full stills at
// its beats; prints what's on screen as it changes. `gif` makes a GIF of each strip at its real speed (ffmpeg).
//   npm run frames:king-attack -- <out-dir> [hollow] [phone|desktop|both] [laststand|mate|both] [light|dark] [gif]
// Read the frames before calling it done (.claude/LESSONS.md: watch it frame by frame).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "king-attack-frames", boss = "hollow", which = "both", what = "both", scheme = "dark", gif = ""] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
// The attack's beats (boss-timing.ts: LAST_STAND.attackAt, KING_ATTACK.mateHoldMs and mateAt).
const ATTACK_AT = 5550;
const MATE_HOLD = 3880;
const MATE_AT = 600;
const STEP = 40;
const STILLS = [520, 1000, 1500, 2300];

async function open(context, extra) {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.clock.install();
  await p.goto(`${url}?debug&clock=60&nolanding&boss=${boss}${extra}`);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  return p;
}

/** From `from` to `to` ms after `startAt` (the page's clock), a frame of the board every STEP ms, the clock paused between. */
async function strip(p, tag, startAt, from, to) {
  await p.clock.pauseAt(startAt + from);
  const board = await p.locator("cg-board").first().boundingBox();
  const vw = p.viewportSize();
  const x = Math.max(0, board.x - 40);
  const y = Math.max(0, board.y - 120);
  const clip = { x, y, width: Math.min(vw.width - x, board.width + 80), height: Math.min(vw.height - y, board.height + 140) };
  const frames = [];
  let last = "";
  const stills = new Set(STILLS);
  for (let t = from; t <= to; t += STEP) {
    await p.clock.runFor(STEP);
    const file = `${outDir}/${tag}-${String(frames.length).padStart(3, "0")}-${String(t + STEP).padStart(5, "0")}ms.png`;
    await p.screenshot({ path: file, clip, scale: "css" });
    if (stills.has(t + STEP)) await p.screenshot({ path: `${outDir}/${tag}-still-${t + STEP}ms.png` });
    frames.push(file);
    const state = await p.evaluate(() => {
      const a = document.querySelector(".king-attack");
      const k = document.querySelector(".ka-king");
      return `${window.match?.phase.kind} attack:${a ? `hit ${a.getAttribute("data-hit")} from ${a.getAttribute("data-from")}${a.classList.contains("on") ? " on" : ""}` : "-"} king:${k ? (k.getAttribute("style") ?? "").replace(/.*rotate: ([^;]+);.*/, "$1") : "-"} god:${document.querySelector(".ls-god .god-king")?.getAttribute("data-anim") ?? "-"} hp:${document.querySelectorAll(".ka-hp").length} said:${document.querySelector(".bc-bubble")?.textContent ?? "-"}`;
    });
    if (state !== last) console.log(`${tag} +${t + STEP}ms ${state}`);
    last = state;
  }
  if (gif) {
    writeFileSync(`${outDir}/${tag}.txt`, frames.map((f) => `file '${f}'\nduration ${STEP / 1000}`).join("\n") + `\nfile '${frames.at(-1)}'\n`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${outDir}/${tag}.txt`, "-vf", "fps=25,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer", `${outDir}/${tag}.gif`]);
    console.log(`wrote ${outDir}/${tag}.gif`);
  }
  await p.clock.resume();
}

async function tapMove(p) {
  const fen = await p.evaluate(() => window.match.phase.board.fen);
  const moves = new Chess(fen).moves({ verbose: true });
  const mv = moves.find((m) => m.piece === "n") ?? moves[0];
  const board = await p.locator("cg-board").first().boundingBox();
  const sq = (s) => ({ x: board.x + (s.charCodeAt(0) - 97 + 0.5) * (board.width / 8), y: board.y + (7 - (Number(s[1]) - 1) + 0.5) * (board.height / 8) });
  await p.mouse.click(sq(mv.from).x, sq(mv.from).y);
  await p.mouse.click(sq(mv.to).x, sq(mv.to).y);
}

async function run(name, context) {
  if (what !== "mate") {
    const p = await open(context, "&laststand=1");
    for (let i = 0; i < 240 && (await p.evaluate(() => window.match?.phase.kind)) !== "play"; i++) await p.waitForTimeout(250);
    await p.waitForTimeout(800);
    await tapMove(p);
    await p.locator(".last-stand").waitFor({ timeout: 30_000 });
    const start = Number(await p.locator(".last-stand").getAttribute("data-start"));
    await strip(p, `${name}-laststand`, start + ATTACK_AT, -300, 3000);
    await p.close();
  }
  if (what !== "laststand") {
    const p = await open(context, "&mate=1");
    // The boss's mating move shows: the attack starts MATE_AT after (its hold ends MATE_HOLD after the move shows).
    let until = 0;
    for (let i = 0; i < 400 && !until; i++) {
      until = await p.evaluate(() => {
        const ph = window.match?.phase;
        return ph?.kind === "boss" && !ph.thinking && !ph.intro && ph.until && /Pq\//.test(ph.boss.board.fen) ? ph.until : 0;
      });
      if (!until) await p.waitForTimeout(100);
    }
    await strip(p, `${name}-mate`, until - MATE_HOLD + MATE_AT, -400, 3400);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${outDir}/${name}-mate-result.png` });
    console.log(`${name}-mate after: ${await p.evaluate(() => window.match?.phase.kind)}`);
    await p.close();
  }
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
console.log(`wrote ${outDir}/`);
