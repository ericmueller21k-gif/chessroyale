// A raid boss as a character, frame by frame, on a phone and a computer: Boss alone against the boss you name, its
// entrance, the crowd's move, the boss thinking and moving. Saves full screenshots at each moment and a strip of
// frames (every 120 ms) around the character, and prints a timeline of which animation showed.
//   npm run frames:character -- <out-dir> [boss name, default "Boingo"] [phone|desktop|both] [kit=<name>] [fx] [fxperf]
// `kit=<name>` plays the named character kit in that boss's place (a kit drawn before its boss is playable, such
// as kit="G-REX"). `fx` then plays the bosses' power art over the board where it will show (the ice, the
// pies, the blizzard, the funhouse, and the power moments in his spot; with kit="G-REX" his fire: the tile's
// stages, a piece burning, the sparkler, the Roman candle on the board, its rockets, fireballs and shots left),
// with frames every ~70 ms.
// `fxperf` (on the phone, its CPU slowed 4x) measures frames while sitting and while dragging a piece, first on the
// plain board, then under a storm of G-REX's fire at once (14 burning tiles and a piece burning, on one canvas;
// falling fireballs, rockets, the sparkler, the shots left and G-REX on the board), and prints both
// (e2e/perf-probe.js).
// Read the frames before calling an animation done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";
import { frameStats, instrument } from "../e2e/perf-probe.js";

const argv = process.argv.slice(2);
const kitName = argv.find((a) => a.startsWith("kit="))?.slice(4);
const withFx = argv.includes("fx");
const fxPerf = argv.includes("fxperf");
const [out = "character-frames", bossName = "Boingo", which = "both"] = argv.filter((a) => !a.startsWith("kit=") && a !== "fx" && a !== "fxperf");
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
  if (fxPerf) await p.addInitScript(instrument);
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
  if (fxPerf && name === "phone") await perf(p, name, sq, board, fen);
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
  const grex = kitName === "G-REX" || full === "G-REX";
  if (grex) {
    const tile = pieceSq;
    const strip = { x: board.x, y: board.y - cell * 0.45, w: cell * 3, h: (cell * 3 * 11) / 74 };
    sequences.length = 0;
    sequences.push(
      ["spark", [{ kind: "effect", name: "sparkFly", box: at("d4") }, { kind: "effect", name: "fireTile", anim: "ignite", then: "stage1", box: at(tile) }], 1100],
      ["stage2", [{ kind: "effect", name: "fireTile", anim: "spread2", then: "stage2", box: at(tile) }], 900],
      ["stage3", [{ kind: "effect", name: "fireTile", anim: "spread3", then: "stage3", box: at(tile) }], 900],
      ["burn", [{ kind: "effect", name: "pieceBurn", anim: "r", box: at(tile) }, { kind: "effect", name: "fireTile", anim: "burnOut", box: at(tile) }], 1700],
      ["fizzle", [{ kind: "effect", name: "fireTile", anim: "fizzle", box: at(crowd === "w" ? "e1" : "e8") }], 600],
      ["rockets", [{ kind: "effect", name: "candleShot", box: at("e6") }, { kind: "effect", name: "candleShot", anim: "pop", box: at("d8") }, { kind: "effect", name: "candleShots", anim: "left7", box: strip }], 700],
      ["fireball", [{ kind: "effect", name: "fireballFall", box: at("c4") }, { kind: "effect", name: "fireballFall", anim: "land", box: at("c3") }], 700],
      ["candle", [{ kind: "moment", name: kitName ? `original:${kitName}` : full, anim: "romanCandle", box: { x: board.x + board.width / 2 - cell * 1.25, y: board.y + board.height / 2 - cell * 2.1, w: cell * 2.5, h: cell * 2.6 } }], 3600],
    );
  }
  if (spot) {
    const moments = grex ? ["ignite", "candleWarn", "check"] : full === "Ginger" || kitName === "Ginger" ? ["freezeCast", "blizzard", "check"] : ["pieThrow", "check"];
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

/**
 * G-REX's fire, all at once, on a phone with its CPU slowed 4x: frames while sitting and while dragging a piece, on the
 * plain board and then under the storm. Nothing here may add lag (.claude/LESSONS.md: "Lag that grows with the match").
 */
async function perf(p, name, sq, board, fen) {
  const lab = `/@fs${resolve("../../scripts/fx-lab.ts")}`;
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const cell = board.width / 8;
  const at = (s) => ({ x: sq(s).x - cell / 2, y: sq(s).y - cell / 2, w: cell, h: cell });
  const crowd = (await p.evaluate(() => window.match.boss?.crowdSide)) ?? "w";
  const piece = new Chess(await p.evaluate(() => window.match.phase.board.fen)).moves({ verbose: true }).find((m) => m.piece === "n") ?? { from: crowd === "w" ? "g1" : "g8" };
  const measure = async (label) => {
    await p.waitForTimeout(600);
    await p.evaluate(() => (window.__perf.frames = []));
    await p.waitForTimeout(2000);
    const idle = await p.evaluate(() => window.__perf.frames.splice(0));
    const a = sq(piece.from);
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < 2500; i++) {
      const r = board.width * 0.3;
      await p.mouse.move(board.x + board.width / 2 + r * Math.cos(i / 6), board.y + board.height / 2 + r * Math.sin(i / 6));
      await p.waitForTimeout(16);
    }
    const drag = await p.evaluate(() => window.__perf.frames.splice(0));
    await p.mouse.move(a.x, a.y, { steps: 3 });
    await p.mouse.up();
    const rafs = idle.map((f) => f[1]).sort((x, y) => x - y);
    const fmt = (s) => `p50 ${s.p50} p95 ${s.p95} dropped ${(s.slow * 100).toFixed(0)}% max ${s.max}`;
    console.log(`${name} fxperf ${label.padEnd(6)} | sitting ${fmt(frameStats(idle.map((f) => f[0])))} | dragging ${fmt(frameStats(drag.map((f) => f[0])))} | rAF callbacks/frame ${rafs[Math.floor(rafs.length / 2)] ?? 0}`);
  };
  await measure("plain");
  // The storm: 14 tiles burning at every stage on the crowd's side, fireballs falling, rockets, the sparkler, the shots left, the candle on the board.
  const ranks = crowd === "w" ? ["1", "2", "3"] : ["8", "7", "6"];
  const squares = ["a", "b", "c", "d", "e", "f", "g", "h"].flatMap((f) => ranks.map((r) => f + r)).filter((_, i) => i % 12 !== 5).slice(0, 14);
  const orientation = (await p.evaluate(() => document.querySelector(".cg-wrap")?.classList.contains("orientation-black"))) ? "black" : "white";
  const items = [
    // The tiles all on one canvas over the board (BoardEffects), a piece burning on one of them.
    {
      kind: "board",
      name: "board",
      orientation,
      box: { x: board.x, y: board.y, w: board.width, h: board.height },
      squares: [...squares.map((s, i) => ({ square: s, name: "fireTile", anim: ["stage1", "stage2", "stage3"][i % 3] })), { square: squares[2], name: "pieceBurn", anim: "q" }],
    },
    ...["b5", "d6", "f5", "h6"].map((s) => ({ kind: "effect", name: "fireballFall", box: at(s) })),
    { kind: "effect", name: "candleShot", box: at("c7") },
    { kind: "effect", name: "candleShot", box: at("g7") },
    { kind: "effect", name: "sparkFly", box: at("e5") },
    { kind: "effect", name: "candleShots", anim: "left9", box: { x: board.x, y: board.y - cell * 0.45, w: cell * 3, h: (cell * 3 * 11) / 74 } },
    { kind: "moment", name: kitName ? `original:${kitName}` : "G-REX", anim: "idle", box: { x: board.x + board.width / 2 - cell * 1.25, y: board.y + board.height / 2 - cell * 2.1, w: cell * 2.5, h: cell * 2.6 } },
  ];
  await p.evaluate(async ({ lab, items }) => (await import(lab)).mount(items), { lab, items });
  await p.screenshot({ path: `${outDir}/${name}-fxperf-storm.png` });
  await measure("storm");
  await p.evaluate(async (lab) => (await import(lab)).clear(), lab);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
