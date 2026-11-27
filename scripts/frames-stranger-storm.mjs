// The Stranger's Storm of Two Worlds frame by frame, on a phone (390 x 844 at 2x) or a computer: a solo battle with his ultimate brought
// early (?power=storm: the warning as turn 2 begins, the storm as turn 3 does), played with real taps. Records every frame the browser
// paints (Chrome's screencast) from the warning to the storm's last turn, saves stills at the opening scene's beats and each turn, a GIF of
// the whole storm at real speed and one of its opening alone (the swords' slams, the rift tearing open), and prints a timeline.
//   node scripts/frames-stranger-storm.mjs <out-dir> [phone|desktop] [light|dark]
// On a fire turn it leaves a marked piece where it stands when there is one (to watch it burn), else steps onto a mark.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "storm-frames", which = "phone", scheme = "light"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5231, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
// (STORM_SCENE's beats, packages/chess/src/bosses/stranger.ts, and its banner's hold before them: the whole banner, BOSS_BANNER.ms.)
const SCENE = { fireAt: 1650, iceAt: 2450, gripAt: 4750, fullAt: 7350, pullAt: 7850, leapAt: 8690, homeAt: 9170, ms: 10000 };
const LEAD = 2250;

const context = which === "desktop" ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const tag = `storm-${which}`;
const p = await browser.newPage({ ...context, colorScheme: scheme });
await p.addInitScript(() => localStorage.setItem("hunchess.tutorial.dismissed", "1"));
// (Every frame's moments as the app has them, recorded in the page: the storm's own clock, for the stills.)
await p.addInitScript(() => {
  window.__storm = [];
  const look = () => {
    const b = window.match?.boss;
    const ev = b?.powers?.events ?? [];
    const st = b?.powers?.stranger;
    const now = performance.now();
    window.__gap = window.__gap ?? [];
    if (window.__last !== undefined) window.__gap.push([Date.now(), now - window.__last, !!document.querySelector(".pm-storm"), !!document.querySelector(".sg-storm")]);
    window.__last = now;
    // (Every frame, numbers for the frame-by-frame read: the ring's strength, the dim, his figure's box in his corner and on the board.)
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
    };
    const fig = document.querySelector(".sg-fig canvas");
    const corner = document.querySelector(".boss-char .boss-char-sprite");
    const dim = document.querySelector(".sg-shade");
    window.__storm.push({ t: Date.now(), phase: window.match?.phase?.kind ?? "", kinds: ev.map((e) => e.kind).join("+"), turn: b?.powers?.turn ?? 0, storm: st?.storm ?? null, pick: st?.pick ?? null, stage: document.querySelector(".pm-storm")?.getAttribute("data-stage") ?? "", ring: window.__stormArt ? { ...window.__stormArt } : null, ringEl: !!document.querySelector(".sg-storm"), banner: !!document.querySelector(".fight-banner.storm"), dim: dim ? Number(getComputedStyle(dim).opacity) : -1, fig: box(fig), figAnim: fig?.getAttribute("data-frame") ?? "", corner: corner && getComputedStyle(corner).visibility !== "hidden" ? box(corner) : null, cornerAnim: corner?.getAttribute("data-frame") ?? "" });
    if (window.__storm.length > 20000) window.__storm.splice(0, 5000);
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
});
p.on("pageerror", (e) => console.log(tag, "pageerror", e.message));
const cdp = await p.context().newCDPSession(p);
// (PERF=1: a slowed phone, the page's CPU at a quarter speed (.claude/LESSONS.md: try a moment's path with the CPU slowed 4x); its frame
// times printed for the scene and for the storm's turns. No screencast then: it costs frames of its own.)
const PERF = !!process.env.PERF;
if (PERF) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
await p.goto(`${url}?debug&clock=60&nolanding&laststand=0&brain=stockfish&boss=stranger&wip=1&power=storm`);
await p.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
// (START only once the engine has loaded: a tap before does nothing.)
for (let i = 0; i < 600 && (await p.getByText("Loading the engine").count()); i++) await p.waitForTimeout(200);
await p.getByRole("main").getByRole("button", { name: "START" }).click();
const t0 = Date.now();
const phase = () => p.evaluate(() => window.match?.phase.kind ?? null);
const waitFor = async (want, ms = 90_000) => {
  const s = Date.now();
  while (Date.now() - s < ms) {
    if (want.includes(await phase())) return true;
    await p.waitForTimeout(100);
  }
  return false;
};
/** One move with two taps: on a fire turn, a marked piece of yours left where it stands (or a step onto a mark); else a quiet move. */
async function move() {
  if (!(await waitFor(["play"], 90_000))) return null;
  await p.waitForTimeout(700);
  const s = await p.evaluate(() => {
    const m = window.match;
    const st = m.boss?.powers?.stranger;
    return { fen: m.phase.board.fen, allowed: m.boss?.powers?.allowed ?? null, pick: st?.pick && st.pick.turn === m.boss.powers.turn ? st.pick : null, orientation: document.querySelector(".hb")?.classList.contains("orientation-black") ? "black" : "white" };
  });
  // (A storm turn: its marks or ice up a while first, and a still of them.)
  if (s.pick) {
    await p.waitForTimeout(1800);
    if (!process.env.NOSTILLS) await p.screenshot({ path: join(outDir, `${tag}-8-turn${s.pick.turn}-${s.pick.kind}.png`) });
  }
  const chess = new Chess(s.fen);
  const legal = chess.moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), from: m.from, to: m.to, piece: m.piece, captured: m.captured }));
  const ok = legal.filter((m) => !s.allowed || s.allowed.includes(m.uci));
  let pick = null;
  if (s.pick?.kind === "fire") {
    const marks = s.pick.squares;
    const mine = marks.filter((sq) => chess.get(sq)?.color === chess.turn());
    pick = mine.length ? ok.find((m) => !marks.includes(m.from) && !marks.includes(m.to)) : ok.find((m) => marks.includes(m.to) && m.piece !== "k");
  }
  pick = pick ?? ok.find((m) => m.piece === "n" && !m.captured) ?? ok.find((m) => !m.captured) ?? ok[0];
  if (!pick) return null;
  const board = await p.locator(".hb-board").first().boundingBox();
  const flip = s.orientation === "black";
  const at = (sq) => ({ x: board.x + ((flip ? 7 - (sq.charCodeAt(0) - 97) : sq.charCodeAt(0) - 97) + 0.5) * (board.width / 8), y: board.y + ((flip ? Number(sq[1]) - 1 : 8 - Number(sq[1])) + 0.5) * (board.height / 8) });
  for (let tries = 0; tries < 8 && (await phase()) === "play"; tries++) {
    if (context.hasTouch) {
      await p.touchscreen.tap(at(pick.from).x, at(pick.from).y);
      await p.touchscreen.tap(at(pick.to).x, at(pick.to).y);
    } else {
      await p.mouse.click(at(pick.from).x, at(pick.from).y);
      await p.mouse.click(at(pick.to).x, at(pick.to).y);
    }
    await p.waitForTimeout(400);
  }
  console.log(`${tag} +${Date.now() - t0}ms played ${pick.uci}${s.pick ? ` on a ${s.pick.kind} turn (${s.pick.squares.join(" ")})` : ""}`);
  return pick.uci;
}
// The scene's beats, 2x stills, taken as it reaches each (its stage shows from its banner's hold; its own clock LEAD later).
const BEATS = [["1-leap", 300], ["2-fire-sword", SCENE.fireAt + 250], ["3-ice-sword", SCENE.iceAt + 300], ["4-gather", SCENE.gripAt - 300], ["5-charge", SCENE.gripAt + 1500], ["6-full", SCENE.fullAt + 300], ["7-back", SCENE.homeAt + 60]];
// (NOSTILLS=1: no stills. A still taken mid-scene holds the screencast for about a quarter second, a hole in the GIF at that beat:
// his leap, Nov 27. Make the GIFs with it, the stills in a run of their own.)
const NOSTILLS = !!process.env.NOSTILLS;
const sceneShots = NOSTILLS ? Promise.resolve() : (async () => {
  const s = Date.now();
  while (Date.now() - s < 120_000 && !(await p.locator(".pm-storm").count())) await p.waitForTimeout(30);
  const start = Date.now() + LEAD;
  for (const [name, beat] of BEATS) {
    const wait = start + beat - Date.now();
    if (wait > 0) await p.waitForTimeout(wait);
    await p.screenshot({ path: join(outDir, `${tag}-${name}.png`) });
  }
})();
// (A fire turn's burn as the move lands: a still of it.)
const burnShot = NOSTILLS ? Promise.resolve() : (async () => {
  const s = Date.now();
  while (Date.now() - s < 150_000 && !(await p.evaluate(() => (window.match?.boss?.powers?.events ?? []).some((e) => e.kind === "stormBurn")))) await p.waitForTimeout(50);
  await p.waitForTimeout(450);
  await p.screenshot({ path: join(outDir, `${tag}-9-burn.png`) });
})();
await waitFor(["play"], 60_000);
// The recording: true screenshots one after another (about 15 to 20 a second), each named by the page's clock. Not Chrome's screencast:
// headless, it delivers no frames for a quarter second now and then (as a text box's line ends, Nov 27: the page draws every frame, a
// trace's draws and commits have no gap), a hole in the GIF at whatever plays then, his leap for one. (CAST=1: the screencast all the same.)
let recording = !PERF;
const recorder = (async () => {
  if (PERF) return;
  if (process.env.CAST) return void (await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1, maxWidth: which === "desktop" ? 1440 : 585, maxHeight: 1300 }));
  while (recording) {
    const a = Date.now();
    const shot = await p.screenshot({ type: "jpeg", quality: 90, scale: "css" }).catch(() => null);
    if (shot) frames.push({ t: (a + Date.now()) / 2, data: shot.toString("base64") });
  }
})();
for (let i = 0; i < 6; i++) {
  if ((await move()) === null) break;
  const turn = await p.evaluate(() => window.match?.boss?.powers?.turn ?? 0);
  if (turn >= 6) break;
}
await waitFor(["play"], 60_000);
await p.waitForTimeout(1500);
await Promise.race([Promise.all([sceneShots, burnShot]), p.waitForTimeout(5000)]);
recording = false;
await recorder;
if (process.env.CAST) await cdp.send("Page.stopScreencast");
const log = await p.evaluate(() => window.__storm);
writeFileSync(join(outDir, `${tag}-log.json`), JSON.stringify({ t0, log }));
if (PERF) {
  const gaps = await p.evaluate(() => window.__gap);
  const stat = (name, xs) => {
    const v = xs.map((g) => g[1]).sort((a, b) => a - b);
    if (!v.length) return console.log(`${tag} ${name}: no frames`);
    const q = (f) => v[Math.min(v.length - 1, Math.floor(f * v.length))].toFixed(1);
    console.log(`${tag} ${name}: ${v.length} frames, p50 ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${v.at(-1).toFixed(1)} ms, over 50 ms: ${v.filter((x) => x > 50).length}`);
  };
  stat("scene (4x slower CPU)", gaps.filter((g) => g[2]));
  stat("storm turns (4x slower CPU)", gaps.filter((g) => !g[2] && g[3]));
  stat("the rest (4x slower CPU)", gaps.filter((g) => !g[2] && !g[3]));
}
console.log(`${tag} boss ${await p.evaluate(() => window.match?.boss?.id)}; kinds seen: ${[...new Set(log.map((x) => x.kinds))].join(" | ")}; picks ${JSON.stringify([...new Set(log.map((x) => JSON.stringify(x.pick)))].slice(0, 6))}`);
// The storm's moment: from the first frame its stage shows to the last (its own clock: the frame log).
const sceneFrames = log.filter((x) => x.stage);
const sceneFrom = sceneFrames[0]?.t ?? 0;
const sceneTo = sceneFrames.at(-1)?.t ?? 0;
console.log(`${tag} scene on screen ${sceneFrom - t0}..${sceneTo - t0} (${sceneTo - sceneFrom} ms); stages ${[...new Set(sceneFrames.map((x) => x.stage))].join(" ")}`);
const turns = [...new Map(log.filter((x) => x.pick && x.storm).map((x) => [x.pick.turn, x])).values()].map((x) => `${x.pick.turn}:${x.pick.kind}(${x.pick.squares.length})`);
console.log(`${tag} storm turns: ${turns.join(" ")}`);
const firsts = new Map();
for (const x of log) if (x.pick && x.phase === "play" && !firsts.has(x.pick.turn)) firsts.set(x.pick.turn, x);
// The GIF: the whole storm, real speed, from the scene's banner to the last storm turn's start (plus a second).
const lastTurn = [...firsts.values()].at(-1);
const from = sceneFrom - 300;
const to = (lastTurn?.t ?? sceneTo) + 2500;
const dir = join(outDir, `${tag}-frames`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
// (Real speed: each frame held until the next one painted, resampled to 15 a second.)
const list = frames.filter((f) => f.t >= from && f.t <= to);
const fps = 15;
let k = 0;
for (let t = from; t <= to; t += 1000 / fps) {
  const f = list.filter((x) => x.t <= t).at(-1) ?? list[0];
  if (f) writeFileSync(join(dir, `${String(k++).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64"));
}
// (RAW=1: every painted frame round the scene, named by its ms from the scene's first frame, for contact sheets and slowed GIFs.)
if (process.env.RAW && !PERF) {
  const raw = join(outDir, `${tag}-raw`);
  rmSync(raw, { recursive: true, force: true });
  mkdirSync(raw, { recursive: true });
  for (const f of frames) if (f.t >= sceneFrom - 1500 && f.t <= sceneTo + 3000) writeFileSync(join(raw, `${String(Math.round(f.t - sceneFrom) + 100000)}.jpg`), Buffer.from(f.data, "base64"));
}
// (PERF=1 records no frames: no GIFs.)
if (!PERF) try {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%05d.jpg"), "-vf", `scale=${which === "desktop" ? 720 : 390}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, join(outDir, `${tag}.gif`)]);
  console.log(`${tag}.gif: ${k} frames, ${((to - from) / 1000).toFixed(1)} s`);
} catch (e) {
  console.log("gif failed", e.message);
}
// The opening alone, larger: from just before the fire sword's slam to the rift whole and the storm gathered (the scene's own clock).
if (!PERF) try {
  const start = sceneFrom + LEAD;
  const a = start + SCENE.fireAt - 700;
  const b = start + SCENE.gripAt + 600;
  const odir = join(outDir, `${tag}-opening-frames`);
  rmSync(odir, { recursive: true, force: true });
  mkdirSync(odir, { recursive: true });
  const part = frames.filter((f) => f.t >= a - 200 && f.t <= b);
  let n = 0;
  for (let t = a; t <= b; t += 1000 / 20) {
    const f = part.filter((x) => x.t <= t).at(-1) ?? part[0];
    if (f) writeFileSync(join(odir, `${String(n++).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64"));
  }
  const crop = which === "desktop" ? "crop=iw*0.75:ih:iw*0.125:0,scale=810:-1" : "crop=iw:ih*0.64:0:ih*0.04,scale=585:-1";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "20", "-i", join(odir, "%05d.jpg"), "-vf", `${crop}:flags=neighbor,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`, join(outDir, `${tag}-opening.gif`)]);
  console.log(`${tag}-opening.gif: ${n} frames, ${((b - a) / 1000).toFixed(1)} s`);
} catch (e) {
  console.log("opening gif failed", e.message);
}
await p.close();
await browser.close();
await server.close();
