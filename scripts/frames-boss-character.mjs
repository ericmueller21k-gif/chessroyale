// A raid boss as a character, frame by frame, on a phone and a computer: Boss alone against the boss you name, its
// entrance, the crowd's move, the boss thinking and moving. Saves full screenshots at each moment and a strip of
// frames (every 120 ms) around the character, and prints a timeline of which animation showed.
//   npm run frames:character -- <out-dir> [boss name, default "Boingo"] [phone|desktop|both]
// Read the frames before calling an animation done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "character-frames", bossName = "Boingo", which = "both"] = process.argv.slice(2);
import { resolve } from "node:path";
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
// From the app's folder, so its build steps (the engine copied into public/) land where the dev server serves them.
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5196, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

async function run(name, context) {
  const p = await browser.newPage(context);
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  p.on("response", (r) => (r.headers()["content-type"] ?? "").includes("html") && !r.url().endsWith("/") && !r.url().includes("?debug") && console.log(name, "html for", r.url()));
  await p.goto(url + "?debug&clock=30&nolanding");
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: new RegExp(bossName) }).click();
  const anim = () => p.evaluate(() => document.querySelector(".boss-char")?.getAttribute("data-anim") ?? "-");
  const strip = async (tag, ms) => {
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < ms) {
      const el = await p.$(".boss-char");
      const box = el && (await el.boundingBox());
      if (box) await p.screenshot({ path: `${outDir}/${name}-${tag}-${String(i).padStart(2, "0")}.png`, clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: box.width + 80, height: box.height + 80 } });
      console.log(`${name} ${tag} +${Date.now() - t0}ms ${await anim()}`);
      i++;
      await p.waitForTimeout(120);
    }
  };
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${outDir}/${name}-intro.png` });
  await strip("intro", 2400);
  for (let i = 0; i < 200; i++) {
    if ((await p.evaluate(() => window.match?.phase.kind)) === "play") break;
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${outDir}/${name}-play.png` });
  const fen = await p.evaluate(() => window.match.phase.board.fen);
  const c = new Chess(fen);
  const moves = c.moves({ verbose: true });
  const mv = moves.find((m) => m.captured) ?? moves.find((m) => m.piece === "n" || m.piece === "b") ?? moves[0];
  const board = await p.locator("cg-board").first().boundingBox();
  const flip = (await p.evaluate(() => window.match.boss?.crowdSide)) === "b";
  const sq = (s) => {
    const f = s.charCodeAt(0) - 97;
    const r = Number(s[1]) - 1;
    return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
  };
  await p.mouse.click(sq(mv.from).x, sq(mv.from).y);
  await p.mouse.click(sq(mv.to).x, sq(mv.to).y);
  await strip("reply", 4000);
  await p.screenshot({ path: `${outDir}/${name}-boss-move.png` });
  await p.close();
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
