// Frame by frame: Jefferson's Roman candle charring one of your pieces (its fire's first hit) and burning a charred one (its
// second), each move made the way a player makes it (two taps on the board); then a charred piece's own move, so its look
// slides with it. Eric, Nov 20 (docs/decisions/2026-11-20-grex-char.md).
//   node scripts/frames-grex-char.mjs <out-dir> [width: a phone under 800 px, else a computer; default an iPhone 13] [light|dark]
// (PW_CHROMIUM=<path>: a Chromium of your own, where Playwright's own isn't installed.)
// Plays solo against Jefferson (?power=candle: the Roman candle on turn 3, its fire aimed at your pieces; ?laststand=0), the
// engine's judged best moves, but leaves a piece standing on a candle tile ablaze. Around each of the three moves it saves a PNG
// whenever the board's pieces, the burn's markers, the dock's line or the phase change (for 7 s) into <out>/char, <out>/burn and
// <out>/slide, with a timeline; and a still of each (<out>/char-still.png: the charred piece at rest on your next move; <out>/burn-still.png:
// the charred piece burning). Read the frames: the piece must never lose its look for a frame, flicker, jump back or move twice.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [outArg = ".", widthArg, scheme = "light"] = process.argv.slice(2);
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198 }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const w = Number(widthArg);
const ctx = await b.newContext({ ...(w ? { viewport: { width: w, height: w < 800 ? 760 : 800 }, deviceScaleFactor: 2, isMobile: w < 800, hasTouch: w < 800 } : { ...devices["iPhone 13"] }), colorScheme: scheme === "dark" ? "dark" : "light" });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.addInitScript(() => localStorage.setItem("hunchess.tutorial.dismissed", "1"));
await p.goto(url + "bosses?debug&clock=60&nolanding&power=candle&laststand=0&bossMoves=40");
await p.getByRole("dialog", { name: "Choose your boss" }).getByRole("button", { name: /Jefferson/ }).click();

const state = () =>
  p.evaluate(() => {
    const m = window.match;
    return { kind: m?.phase.kind ?? "none", fen: m?.phase.board?.fen ?? null, crowd: m?.boss?.crowdSide ?? "w", powers: m?.boss?.powers ?? null };
  });
const waitPlay = async () => {
  for (let i = 0; i < 400; i++) {
    const s = await state();
    if (s.kind === "play") return s;
    if (s.kind === "results") return null;
    await p.waitForTimeout(150);
  }
  return null;
};
/** The judged top moves (the fire counted), searched in the page and polled for (never awaited inside it). */
async function top(fen) {
  const k = await p.evaluate((fen) => {
    const k = Math.random().toString(36).slice(2);
    (window.__top ??= {})[k] = null;
    void window.match.runner.topMovesFor(fen).then((t) => (window.__top[k] = t), () => (window.__top[k] = []));
    return k;
  }, fen);
  for (let i = 0; i < 400; i++) {
    const t = await p.evaluate((k) => window.__top[k], k);
    if (t) return t.map((x) => x.move);
    await p.waitForTimeout(100);
  }
  return [];
}
const tapAt = async (sq, crowd) => {
  const box = await p.locator(".hb-board").first().boundingBox();
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]);
  const [x, y] = crowd === "w" ? [f, 8 - r] : [7 - f, r - 1];
  await p.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
};
const snap = () =>
  p.evaluate(() => {
    const ps = [...document.querySelectorAll(".hb-board piece")].map((e) => `${e.className}@${e.style.transform}`).sort().join("|");
    const burns = [...document.querySelectorAll(".pw-burns .pw-burn")].map((e) => `${e.className}:${e.dataset.square}`).join("|");
    const dock = document.querySelector(".boss-dock-status")?.textContent ?? "";
    const charred = [...document.querySelectorAll(".hb-board piece.pw-charred")].map((e) => e.dataset.square).sort().join(",");
    return { k: window.match?.phase.kind, ps, burns, dock, charred };
  });
/** Taps `move`, then a PNG at every change for 7 s into <out>/<name>/, with the timeline printed and saved. */
async function record(name, move, crowd) {
  const dir = `${out}/${name}`;
  mkdirSync(dir, { recursive: true });
  const lines = [`${name}: ${move}`];
  // (Every animation frame too: which pieces are drawn charred, in which phase, so a look lost for a frame or two shows.)
  await p.evaluate(() => {
    const t0 = performance.now();
    let last = "";
    window.__samp = [];
    window.__stop = false;
    const f = () => {
      const c = [...document.querySelectorAll(".hb-board piece.pw-charred")].map((e) => e.dataset.square).sort().join(",");
      const k = `${window.match?.phase.kind}|${c}`;
      if (k !== last) window.__samp.push(`${Math.round(performance.now() - t0)}ms ${(last = k)}`);
      if (!window.__stop) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await tapAt(move.slice(0, 2), crowd);
  await tapAt(move.slice(2, 4), crowd);
  const t0 = Date.now();
  let last = null;
  let n = 0;
  while (Date.now() - t0 < 7000) {
    const s = await snap();
    const key = JSON.stringify(s);
    if (key !== last) {
      await p.screenshot({ path: `${dir}/f${String(n).padStart(2, "0")}.png` });
      lines.push(`${Date.now() - t0}ms phase=${s.k} pieces=${s.ps.split("|").length} charred=[${s.charred}] burns=[${s.burns}] dock="${s.dock}" f${n}`);
      n++;
      last = key;
    }
    await p.waitForTimeout(30);
  }
  const frames = await p.evaluate(() => ((window.__stop = true), window.__samp));
  lines.push("every frame (phase|charred):", ...frames.map((x) => `  ${x}`));
  console.log(lines.join("\n"));
  writeFileSync(`${dir}/timeline.txt`, lines.join("\n") + "\n");
}

const done = { char: false, burn: false, slide: false };
let charredSq = null;
for (let turn = 1; turn <= 40 && !(done.char && done.burn && done.slide); turn++) {
  const s = await waitPlay();
  if (!s) break;
  await p.waitForTimeout(400);
  const chess = new Chess(s.fen);
  const pw = s.powers;
  const allowed = pw?.allowed ?? null;
  const legal = chess
    .moves({ verbose: true })
    .map((m) => m.from + m.to + (m.promotion ?? ""))
    .filter((m) => (!allowed || allowed.includes(m)) && !new Chess(s.fen).move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }).san.includes("#"));
  const mine = (sq) => {
    const pc = chess.get(sq);
    return !!pc && pc.color === s.crowd && pc.type !== "k";
  };
  // (The candle's tiles: every one lit after he fired; the sparkler waits out his barrage.)
  const candleAt = pw?.candle?.at ?? 99;
  const marks = (pw?.charred ?? []).map((m) => m.square);
  const ablaze = (pw?.fire ?? []).filter((t) => t.stage >= 3 && t.lit > candleAt && mine(t.square)).map((t) => t.square);
  const best = await top(s.fen);
  const keep = (m) => !ablaze.includes(m.slice(0, 2));
  const pick = best.find((m) => legal.includes(m) && keep(m)) ?? legal.find((m) => keep(m) && !chess.get(m.slice(2, 4))) ?? best.find((m) => legal.includes(m)) ?? legal[0];
  const charNow = ablaze.find((sq) => !marks.includes(sq));
  const burnNow = ablaze.find((sq) => marks.includes(sq));
  // (A charred piece, safe, with a move of its own: move it, to watch its look slide with it.)
  const slide = done.char && !done.slide && !ablaze.length ? legal.find((m) => marks.includes(m.slice(0, 2)) && !(pw?.fire ?? []).some((t) => t.square === m.slice(2, 4))) : null;
  if (burnNow && !done.burn) {
    console.log(`turn ${pw.turn}: leaving the charred ${chess.get(burnNow).type} on ${burnNow}: the second hit`);
    await record("burn", pick, s.crowd);
    done.burn = true;
  } else if (charNow && !done.char) {
    console.log(`turn ${pw.turn}: leaving the ${chess.get(charNow).type} on ${charNow}: the first hit`);
    charredSq = charNow;
    await record("char", pick, s.crowd);
    done.char = true;
    if (await waitPlay()) await p.screenshot({ path: `${out}/char-still.png` });
  } else if (slide) {
    console.log(`turn ${pw.turn}: the charred piece moves: ${slide}`);
    await record("slide", slide, s.crowd);
    done.slide = true;
  } else {
    await p.evaluate((mv) => window.match.phase.kind === "play" && window.match.submit(mv), pick);
    await p.waitForTimeout(300);
  }
}
// (A still of the burn: the frame just before the piece comes off, from the burn's frames.)
console.log(`done: ${JSON.stringify(done)} (first charred on ${charredSq})`);
await b.close();
await server.close();
