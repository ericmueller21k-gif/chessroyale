// The rage meter frame by frame (Eric, Oct 11: several ultimates a battle; the God King's strikes add rage): Boss alone
// against a boss, with real taps, on a phone or a computer. You call the King's strike on the first turns (the meter
// jumps as he strikes), the meter fills to the warning and the ultimate, empties as it comes, stays empty (dimmed)
// while its effect runs, then fills again. Every painted frame is recorded (Chrome's screencast); the meter's own
// numbers are sampled in the page every animation frame. Saves the meter's strip enlarged as a GIF and stills at each
// change, and prints the timeline (its fill, its state, the turn).
//   node scripts/frames-rage.mjs <out-dir> [boss=gingerbread] [phone|desktop] [moves=12] [strikes=3]
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "rage-frames", boss = "gingerbread", which = "phone", movesArg = "12", strikesArg = "3"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const tag = `${boss}-${which}`;
const p = await browser.newPage(which === "desktop" ? { viewport: { width: 1440, height: 900 } } : { ...devices["iPhone 13"] });
p.on("pageerror", (e) => !/Unexpected token '<'/.test(e.message) && console.log(tag, "pageerror", e.message));
const cdp = await p.context().newCDPSession(p);
const frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data, w: f.metadata.deviceWidth, h: f.metadata.deviceHeight });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
});
await p.goto(`${url}?debug&clock=60&nolanding&laststand=0&boss=${boss}`);
await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
// The meter, every animation frame: its fill (the bar's width over the meter's), its classes, the turn and the phase.
await p.evaluate(() => {
  window.__rage = [];
  const tick = () => {
    const m = document.querySelector(".rage-meter");
    const i = m?.querySelector("i");
    const b = window.match?.boss;
    const fill = m && i ? Math.round((1000 * i.getBoundingClientRect().width) / Math.max(1, m.getBoundingClientRect().width - 2)) / 10 : null;
    window.__rage.push({ t: Date.now(), fill, cls: m ? m.className.replace("rage-meter", "").trim() : "none", rage: b?.powers?.rage ?? null, turn: b?.powers?.turn ?? null, ults: b?.powers?.ults ?? 0, phase: window.match?.phase.kind ?? null, box: m ? m.getBoundingClientRect().toJSON() : null });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const phase = () => p.evaluate(() => window.match?.phase.kind ?? null);
const waitFor = async (want, ms = 90_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (want.includes(await phase())) return true;
    await p.waitForTimeout(100);
  }
  return false;
};
/** One move with two taps (an allowed one). */
const move = async () => {
  await p.waitForTimeout(400);
  const { allowed, fen, flip } = await p.evaluate(() => ({ allowed: window.match.boss?.powers?.allowed ?? null, fen: window.match.phase.board.fen, flip: !!document.querySelector(".hb.orientation-black") }));
  const options = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  const pick = options[Math.floor(options.length / 3)] ?? options[0];
  const board = await p.locator(".hb-board").first().boundingBox();
  const at = (s) => {
    const f = s.charCodeAt(0) - 97;
    const r = Number(s[1]) - 1;
    return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
  };
  for (let tries = 0; tries < 8 && (await phase()) === "play"; tries++) {
    await p.mouse.click(at(pick.slice(0, 2)).x, at(pick.slice(0, 2)).y);
    await p.mouse.click(at(pick.slice(2, 4)).x, at(pick.slice(2, 4)).y);
    await p.waitForTimeout(400);
  }
  return pick;
};
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });
const t0 = Date.now();
const strikes = Number(strikesArg);
for (let i = 0; i < Number(movesArg); i++) {
  if (!(await waitFor(["play"], 90_000))) break;
  await p.locator(".cc-banner", { hasText: "Round start" }).waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);
  if (i < strikes) {
    // The God King's strike (what his menu's "Strike" calls).
    await p.evaluate(() => window.match.callKing(true));
    console.log(`${tag} +${Date.now() - t0}ms strike on turn ${i + 1}`);
    await p.waitForTimeout(4500);
    if (!(await waitFor(["play"], 30_000))) break;
  }
  const pick = await move();
  console.log(`${tag} +${Date.now() - t0}ms played ${pick} on turn ${i + 1}, now ${await phase()}`);
}
await waitFor(["play"], 60_000);
await p.waitForTimeout(1500);
await cdp.send("Page.stopScreencast");
const samples = await p.evaluate(() => window.__rage);
await p.close();
await browser.close();
await server.close();

// The timeline: every change of the meter's state, turn or ultimates, and its fill at each.
const changes = [];
for (const s of samples) {
  const last = changes.at(-1);
  if (!last || last.cls !== s.cls || last.turn !== s.turn || last.ults !== s.ults || Math.abs((last.fill ?? 0) - (s.fill ?? 0)) >= 4) changes.push(s);
}
const lines = changes.map((s) => `+${s.t - t0}ms turn ${s.turn} ${s.phase} fill ${s.fill}% (rage ${s.rage === null ? "null" : Math.round(s.rage * 100) + "%"}) ${s.cls || "-"} ults ${s.ults}`);
writeFileSync(join(outDir, `${tag}-timeline.txt`), lines.join("\n") + "\n");
console.log(lines.join("\n"));
// The meter's strip from every frame (enlarged): a GIF, and a still at each change.
const box = samples.find((s) => s.box)?.box;
if (box && frames.length) {
  const scale = frames[0].w ? frames[0].w : 1;
  const dir = join(outDir, `${tag}-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  frames.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64")));
  // (Each frame's time from the start, to match against the timeline.)
  writeFileSync(join(dir, "times.txt"), frames.map((f, i) => `${String(i).padStart(5, "0")} +${Math.round(f.t - t0)}ms`).join("\n") + "\n");
  // (Screencast frames are in CSS pixels, scaled by the page's zoom; the crop is the meter with room round it.)
  const pad = 60;
  const crop = `crop=${Math.round(box.width + 2 * pad)}:${Math.round(box.height + 40)}:${Math.max(0, Math.round(box.x - pad))}:${Math.max(0, Math.round(box.y - 20))}`;
  void scale;
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "15", "-i", join(dir, "%05d.jpg"), "-vf", `${crop},scale=iw*4:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse`, join(outDir, `${tag}-meter.gif`)]);
    for (const c of changes) {
      const k = frames.findIndex((f) => f.t >= c.t + 60);
      if (k < 0) continue;
      const name = `${tag}-t${c.turn}-${(c.cls || "plain").replace(/\s+/g, "+")}-${Math.round(c.fill ?? 0)}.png`;
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(dir, `${String(k).padStart(5, "0")}.jpg`), "-vf", `${crop},scale=iw*4:-1:flags=neighbor`, join(outDir, name)]);
    }
  } catch (e) {
    console.log("ffmpeg failed", e.message);
  }
}
