// Frame-by-frame check of one move in a solo boss raid, the way a player makes it (two taps on the board).
//   npm run frames:boss -- <out-dir> [boss name, default "Iron Bishop"]
// Starts the app's dev server, picks a boss, taps a knight or bishop move, then saves a PNG every time the board's
// pieces or the phase change for 12 s, and prints a timeline (ms, phase, piece count, frame). Read the frames: a piece
// that jumps back, flickers or moves twice shows up as an extra frame. See .claude/LESSONS.md.
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = ".", bossName = "Iron Bishop"] = process.argv.slice(2);
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5197 }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const p = await b.newPage({ ...devices["iPhone 13"] });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(url + "?debug&clock=30&nolanding");
await p.getByRole("radio", { name: /Boss raid/ }).click();
await p.getByLabel("Your name").fill("T");
await p.getByRole("button", { name: "Take on the boss alone" }).click();
await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: new RegExp(bossName) }).click();
for (let i = 0; i < 200; i++) {
  if ((await p.evaluate(() => window.match?.phase.kind)) === "play") break;
  await p.waitForTimeout(250);
}
await p.waitForTimeout(1500);
const fen = await p.evaluate(() => window.match.phase.board.fen);
const c = new Chess(fen);
const all = c.moves({ verbose: true });
const mv = all.find((m) => m.piece === "n" || m.piece === "b") ?? all[0];
console.log("fen", fen, "move", mv.from + mv.to);
const box = await p.locator("cg-board").first().boundingBox();
const sq = (s) => ({ x: box.x + (s.charCodeAt(0) - 97 + 0.5) * (box.width / 8), y: box.y + (8 - Number(s[1]) + 0.5) * (box.height / 8) });
const snap = () =>
  p.evaluate(() => {
    const ps = [...document.querySelectorAll("cg-board piece")].map((e) => `${e.className}@${e.style.transform}`).sort().join("|");
    return { k: window.match?.phase.kind, ps };
  });
await p.mouse.click(sq(mv.from).x, sq(mv.from).y);
await p.mouse.click(sq(mv.to).x, sq(mv.to).y);
const t0 = Date.now();
let last = null;
let n = 0;
while (Date.now() - t0 < 12000) {
  const s = await snap();
  const key = s.k + s.ps;
  if (key !== last) {
    await p.screenshot({ path: `${out}/f${String(n).padStart(2, "0")}.png`, clip: { x: box.x - 30, y: box.y - 30, width: box.width + 60, height: box.height + 130 } });
    console.log(`${Date.now() - t0}ms phase=${s.k} pieces=${s.ps.split("|").length} f${n}`);
    n++;
    last = key;
  }
  await p.waitForTimeout(40);
}
await b.close();
await server.close();
