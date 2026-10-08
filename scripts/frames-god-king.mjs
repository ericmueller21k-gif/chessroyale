// The God King frame by frame in a solo raid, on a phone and a computer: standing in the dock, summoned to strike
// the boss and to play a move (his cut-in, his bolt, his slashes, leaving), and his Last Stand (?laststand=1: the
// leap, the crash, the banner, the blows, the fall, lying in the dock). Saves a full screenshot at each stage and a
// strip of frames (as fast as the browser gives them) over the board and the dock, and prints a timeline of his
// animations.
//   npm run frames:god-king -- <out-dir> [w|b] [phone|desktop|both] [summon|laststand|all]
// Read the frames before calling an animation done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "god-king-frames", side = "w", which = "both", what = "all"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

async function open(context, extra = "") {
  const p = await browser.newPage(context);
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto(`${url}?debug&clock=60&nolanding&boss=1600${side === "b" ? "&side=b" : ""}${extra}`);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  for (let i = 0; i < 240; i++) {
    if ((await p.evaluate(() => window.match?.phase.kind)) === "play") break;
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(800);
  return p;
}

/**
 * Frames over the board and the dock for `ms`, named by their time; logs his animations as they change. `stills`:
 * times (ms) for a full screenshot at the device's own scale, to see his pixels.
 */
async function strip(p, tag, ms, stills = []) {
  const board = await p.locator("cg-board").first().boundingBox();
  const dock = await p.locator(".boss-dock").first().boundingBox();
  const vw = p.viewportSize();
  const x = Math.max(0, Math.min(board.x, dock?.x ?? board.x) - 30);
  const y = Math.max(0, board.y - 90);
  const clip = { x, y, width: Math.min(vw.width - x, Math.max(board.x + board.width, (dock?.x ?? 0) + (dock?.width ?? 0)) - x + 30), height: Math.min(vw.height - y, (dock ? dock.y + dock.height : board.y + board.height) - y + 10) };
  const t0 = Date.now();
  let last = "";
  let i = 0;
  const todo = [...stills];
  while (Date.now() - t0 < ms) {
    const t = Date.now() - t0;
    if (todo.length && t >= todo[0]) await p.screenshot({ path: `${outDir}/${tag}-still-${todo.shift()}ms.png` });
    await p.screenshot({ path: `${outDir}/${tag}-${String(i++).padStart(3, "0")}-${String(t).padStart(5, "0")}ms.png`, clip, scale: "css" });
    const anims = await p.evaluate(() => [...document.querySelectorAll(".god-king")].map((e) => `${e.parentElement?.className.split(" ")[0]}:${e.getAttribute("data-anim")}`).join(" "));
    if (anims !== last) console.log(`${tag} +${t}ms ${anims || "-"}`);
    last = anims;
  }
}

async function tapMove(p) {
  const fen = await p.evaluate(() => window.match.phase.board.fen);
  const moves = new Chess(fen).moves({ verbose: true });
  const mv = moves.find((m) => m.piece === "n") ?? moves[0];
  const board = await p.locator("cg-board").first().boundingBox();
  const flip = side === "b";
  const sq = (s) => {
    const f = s.charCodeAt(0) - 97;
    const r = Number(s[1]) - 1;
    return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
  };
  await p.mouse.click(sq(mv.from).x, sq(mv.from).y);
  await p.mouse.click(sq(mv.to).x, sq(mv.to).y);
}

async function run(name, context) {
  const tag = `${name}-${side}`;
  if (what !== "laststand") {
    const p = await open(context);
    await p.screenshot({ path: `${outDir}/${tag}-dock.png` });
    await strip(p, `${tag}-idle`, 1200);
    const king = p.getByRole("button", { name: /God King: tap to summon/ });
    await king.click();
    await p.screenshot({ path: `${outDir}/${tag}-menu.png` });
    await p.getByRole("menuitem", { name: /Strike/ }).click();
    await strip(p, `${tag}-strike`, 6800, [2000, 3300]);
    for (let i = 0; i < 80 && (await p.locator(".king-summon").count()); i++) await p.waitForTimeout(100);
    await king.click();
    await p.getByRole("menuitem", { name: /Play move/ }).click();
    await strip(p, `${tag}-move`, 7600, [3600]);
    await p.close();
  }
  if (what !== "summon") {
    const p = await open(context, "&laststand=1");
    await tapMove(p);
    // From the moment the blunder lands (the Last Stand's clock): stills at the warning, the freeze, the crash, the
    // banner, his guard, the blows, the stagger, the collapse and the fade (boss-timing.ts, LAST_STAND).
    await p.locator(".last-stand").waitFor({ timeout: 30_000 });
    await strip(p, `${tag}-laststand`, 10200, [700, 1700, 2750, 3900, 5700, 6500, 7400, 8250, 8750, 9300]);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${outDir}/${tag}-fallen.png` });
    await p.close();
  }
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
console.log(`wrote ${outDir}/`);
