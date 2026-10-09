// A raid boss as a character, frame by frame, on a phone and a computer: Boss alone against the boss you name, its
// entrance, the crowd's move, the boss thinking and moving. Saves full screenshots at each moment and a strip of
// frames (every 120 ms) around the character, and prints a timeline of which animation showed.
//   npm run frames:character -- <out-dir> [boss name, default "Boingo"] [phone|desktop|both] [kit=<name>] [fx]
// `kit=<name>` plays the named character kit in that boss's place (a kit drawn before its boss is playable, such
// as kit="Ginger"). `fx` then plays the bosses' power art over the board where it will show (the ice, the
// pies, the blizzard, the funhouse, and the power moments in his spot), with frames every ~70 ms.
// Read the frames before calling an animation done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const argv = process.argv.slice(2);
const kitName = argv.find((a) => a.startsWith("kit="))?.slice(4);
const withFx = argv.includes("fx");
const [out = "character-frames", bossName = "Boingo", which = "both"] = argv.filter((a) => !a.startsWith("kit=") && a !== "fx");
import { resolve } from "node:path";
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
// From the app's folder, so its build steps (the engine copied into public/) land where the dev server serves them.
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5196, strictPort: false, fs: { allow: [resolve("../..")] } }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

async function run(name, context) {
  const p = await browser.newPage(context);
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  await p.goto(url + "?debug&clock=30&nolanding");
  // The named kit in every boss's place: the same module the app uses, from the dev server.
  if (kitName)
    await p.evaluate(async (name) => {
      const m = await import("/src/characters/kits.ts");
      if (!m.BOSS_KITS[name]) throw new Error(`no kit "${name}"`);
      for (const k of Object.keys(m.BOSS_KITS)) {
        m.BOSS_KITS[`original:${k}`] = m.BOSS_KITS[k];
        m.BOSS_KITS[k] = m.BOSS_KITS[name];
      }
    }, kitName);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: new RegExp(bossName) }).click();
  // The placement showing (the boss bar on a phone, by the board on a computer).
  const char = () => p.locator(".boss-char:visible").first();
  const anim = async () => (await char().count()) ? await char().getAttribute("data-anim") : "-";
  const strip = async (tag, ms) => {
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < ms) {
      const box = (await char().count()) ? await char().boundingBox() : null;
      if (box) await p.screenshot({ path: `${outDir}/${name}-${tag}-${String(i).padStart(2, "0")}.png`, clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 70), width: box.width + 300, height: box.height + 110 } });
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
  if (withFx) await powers(p, name, sq, board);
  await p.close();
}

/** The power art over this screen, frame by frame: each sequence mounted where it plays, a shot every ~70 ms. */
async function powers(p, name, sq, board) {
  const lab = `/@fs${resolve("../../scripts/fx-lab.ts")}`;
  const cell = board.width / 8;
  const at = (s, w = 1, h = 1) => ({ x: sq(s).x - (cell * w) / 2, y: sq(s).y - (cell * h) / 2, w: cell * w, h: cell * h });
  const char = p.locator(".boss-char:visible").first();
  const cbox = await char.boundingBox();
  // His usual spot, at his frame's size there (his own canvas, hidden while the moment plays over it).
  const spot = await p.evaluate(() => {
    const c = [...document.querySelectorAll(".boss-char canvas")].find((e) => e.offsetParent);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const full = kitName ? kitName : (await p.evaluate(() => window.match.boss?.name));
  const crowd = (await p.evaluate(() => window.match.boss?.crowdSide)) ?? "w";
  const pieceSq = crowd === "w" ? "a1" : "a8";
  const sequences = [
    ["ice", [{ kind: "effect", name: "iceOverlay", anim: "freeze", then: "frozen", box: at(pieceSq) }, { kind: "effect", name: "iceBolt", box: at("e3") }], 1300],
    ["thaw", [{ kind: "effect", name: "iceOverlay", anim: "thaw", box: at(pieceSq) }], 900],
    ["pie", [{ kind: "effect", name: "pieSplat", anim: "splat", then: "pied", box: at("d5") }, { kind: "effect", name: "pieFly", box: at("c6") }], 900],
    ["piefade", [{ kind: "effect", name: "pieSplat", anim: "fade", box: at("d5") }], 500],
    ["blizzard", [{ kind: "effect", name: "blizzardSweep", box: { x: board.x, y: board.y, w: board.width, h: board.height } }], 1500],
    ["funhouse", [{ kind: "moment", name: kitName ? "original:Boingo the Clown" : "Boingo the Clown", anim: "funhouse", box: { x: board.x + board.width / 2 - cell * 0.9, y: board.y + board.height / 2 - cell * 2.1, w: cell * 1.8, h: cell * 2.35 } }], 2400],
  ];
  if (spot) {
    const moments = full === "Ginger" || kitName === "Ginger" ? ["freezeCast", "blizzard", "check"] : ["pieThrow", "check"];
    for (const m of moments) sequences.push([`moment-${m}`, [{ kind: "moment", name: kitName ? `original:${kitName}` : full, anim: m, box: spot }], 2600]);
  }
  for (const [tag, items, ms] of sequences) {
    const hideOwn = tag.startsWith("moment-");
    await p.evaluate((h) => document.querySelectorAll(".boss-char canvas").forEach((c) => (c.style.visibility = h ? "hidden" : "")), hideOwn);
    await p.evaluate(async ({ lab, items }) => (await import(lab)).mount(items), { lab, items });
    const t0 = Date.now();
    let i = 0;
    const clip = hideOwn && cbox ? { x: Math.max(0, cbox.x - 80), y: Math.max(0, cbox.y - 90), width: cbox.width + 360, height: cbox.height + 140 } : { x: board.x - 8, y: board.y - 8, width: board.width + 16, height: board.height + 16 };
    while (Date.now() - t0 < ms) {
      await p.screenshot({ path: `${outDir}/${name}-fx-${tag}-${String(i).padStart(2, "0")}.png`, clip });
      const frames = await p.evaluate(() => [...document.querySelectorAll("#fx-lab canvas")].map((c) => `${c.dataset.fx}:${c.dataset.frame}`).join(" "));
      console.log(`${name} fx ${tag} +${Date.now() - t0}ms ${frames}`);
      i++;
      await p.waitForTimeout(40);
    }
    await p.evaluate(async (lab) => (await import(lab)).clear(), lab);
  }
  await p.evaluate(() => document.querySelectorAll(".boss-char canvas").forEach((c) => (c.style.visibility = "")));
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
