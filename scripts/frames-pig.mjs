// Wrangler, the cowboy pig, frame by frame in a real solo match (Boss alone), on a phone and a computer, with real taps:
// his long pull after your first move (and his meter full: ?power=showdown fills it from turn 2: "I've got you in my
// sights." and his ready loop), SHOWDOWN! once a line-up qualifies (no warning), your duel, and his first lasso drag
// after it. Records every painted frame (Chrome's screencast) and saves stills and a GIF of each moment, plus a timeline.
//   npm run frames:pig -- <out-dir> [phone|desktop|both] [light|dark] [side=b] [power=drag]
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const args = process.argv.slice(2).filter((a) => !a.includes("="));
const sideB = process.argv.includes("side=b");
// (power=drag: his drags from turn 2, every 2 turns, instead of the showdown's test switch.)
const power = process.argv.find((a) => a.startsWith("power="))?.slice(6) ?? "showdown";
const [out = "pig-frames", which = "both", scheme = "light"] = args;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
// (A first visit lets Vite find and bundle the app's dependencies: it reloads the page when it does, which would
// throw a match back to the home screen.)
{
  const w = await browser.newPage();
  await w.goto(`${url}?nolanding`);
  await w.waitForTimeout(6000);
  await w.close();
}

function gif(dir, file, width) {
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", join(dir, "%04d.jpg"), "-vf", `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, file]);
  } catch (e) {
    console.log("gif failed", e.message);
  }
}

async function run(name, context) {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  const errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log(name, "pageerror", e.message, (e.stack ?? "").split("\n").slice(1, 3).join(" | "));
  });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1, ...(name === "phone" ? { maxWidth: 780, maxHeight: 1688 } : {}) });
  await p.goto(`${url}?debug&clock=60&nolanding&boss=pig&power=${power}&laststand=0${sideB ? "&side=b" : ""}`);
  // (Clicked again only if the first tap came before the page was ready: the button is disabled while it loads.)
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.match)); i++) {
    const btn = p.getByRole("main").getByRole("button", { name: "Boss alone" });
    if (await btn.isEnabled().catch(() => false)) await btn.click().catch(() => undefined);
    await p.waitForTimeout(750);
  }
  const t0 = Date.now();
  const log = (s) => console.log(`${name} +${Date.now() - t0}ms ${s}`);
  const marks = [];
  const stills = [];
  const mark = (label, from, to) => marks.push({ label, from, to });
  const st = () =>
    p.evaluate(() => {
      const m = window.match;
      const ph = m?.phase;
      return { kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, until: ph?.until ?? 0, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, now: Date.now() };
    });
  const waitUntil = async (fn, ms = 90_000) => {
    const start = Date.now();
    let s = null;
    while (Date.now() - start < ms) {
      s = await st();
      if (fn(s)) return s;
      await p.waitForTimeout(50);
    }
    await p.screenshot({ path: join(outDir, `${name}-timeout.png`) });
    throw new Error(`${name}: timed out at ${JSON.stringify({ kind: s?.kind, intro: s?.intro, thinking: s?.thinking })}`);
  };
  const at = async (sq) => {
    const board = await p.locator(".hb-board").first().boundingBox();
    const flip = await p.evaluate(() => document.querySelector(".hb")?.classList.contains("orientation-black"));
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
  };
  const tap = async (sq) => {
    const q = await at(sq);
    await p.mouse.click(q.x, q.y);
  };
  const play = async (move) => {
    await waitUntil((s) => s.kind === "play");
    await p.waitForTimeout(700);
    for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await p.waitForTimeout(400);
    }
    log(`played ${move}`);
  };
  const pick = async (...want) => {
    const s = await st();
    const allowed = (s.boss?.powers?.allowed ?? new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to)).filter((m) => m.length === 4);
    return want.find((m) => allowed.includes(m)) ?? allowed.sort()[0];
  };

  await waitUntil((s) => s.kind === "boss" && s.intro);
  await waitUntil((s) => s.kind === "play", 60_000);
  await p.screenshot({ path: join(outDir, `${name}-1-start.png`) });

  const want = {
    pull: [0, 600, 1200, 1800, 2300, 2500, 2700, 2900, 3300, 3600, 4200, 5000],
    drag: [0, 600, 1200, 1800, 2300, 2500, 2700, 2900, 3300, 3600, 4200, 5000],
    showdown: [0, 800, 1200, 1600, 2000, 2400, 2700, 3000, 3150, 3300, 3500, 3650, 3800, 4000, 4150, 4300, 4500, 4700, 5000, 5500, 6000, 6500, 7000],
  };
  const done = new Set();
  const plan = ["e2e4", "g1f3", "f1c4", "b1c3", "d2d3", "c1e3", "h2h3", "a2a3", "e1g1", "f1e1"];
  for (let turn = 1; turn <= 14 && !(done.has(power) && (power === "drag" || done.has("drag"))); turn++) {
    await play(await pick(...plan, "h3h4", "a3a4"));
    const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && !x.intro, 150_000);
    const ev = (s.boss?.powers?.events ?? []).map((e) => e.kind);
    // (The moments play back to back after his move shows, ending at `until`, in their order: a pull or drag, then the
    // showdown.)
    const MS = { pull: 3500, drag: 3500, showdown: 6000 };
    const ORDER = { pull: 0, drag: 0, showdown: 2 };
    const seq = [...ev].sort((a, b) => (ORDER[a] ?? 0) - (ORDER[b] ?? 0));
    const startOf = (k) => s.until - seq.slice(seq.indexOf(k)).reduce((t, x) => t + (MS[x] ?? 0), 0);
    const labels = ev.filter((k) => want[k] && !done.has(k));
    for (const l of labels) for (const ms of want[l]) stills.push({ label: `${l}-${String(ms).padStart(4, "0")}`, t: startOf(l) + ms });
    const end = await waitUntil((x) => x.kind === "play", 60_000);
    // His meter full (the first turn it is): his line typing out and holding, his ready loop; a few seconds of it.
    if (end.boss?.powers?.ready !== null && end.boss?.powers?.ready !== undefined && !done.has("ready")) {
      done.add("ready");
      mark("ready", end.now - 300, end.now + 4500);
      for (const ms of [0, 400, 800, 1200, 1600, 2400, 3200, 4000]) stills.push({ label: `ready-${String(ms).padStart(4, "0")}`, t: end.now + ms });
      log(`ready: his meter full (fill ${end.boss.powers.ready}), rage ${end.boss.powers.rage}`);
      await p.waitForTimeout(4600);
    }
    for (const l of labels) {
      done.add(l);
      mark(l, s.now - 300, end.now + 800);
      log(`${l}: events ${ev.join(", ")}; pull ${JSON.stringify(s.boss.powers.pull)} drag ${JSON.stringify(s.boss.powers.drag)} showdown ${JSON.stringify(s.boss.powers.showdown?.pairs)}`);
    }
    if (labels.length) {
      await new Promise((r) => setTimeout(r, 1200));
      await p.screenshot({ path: join(outDir, `${name}-${labels.join("+")}-after.png`) });
    }
    // On the duel's turn: a still of the glowing duels, then the crowd plays one.
    const now = await st();
    if (now.boss?.powers?.showdown && now.boss.powers.showdown.turn === now.boss.powers.turn) {
      await p.screenshot({ path: join(outDir, `${name}-duels.png`) });
      log(`duel turn: allowed ${JSON.stringify(now.boss.powers.allowed)}`);
    }
  }
  await cdp.send("Page.stopScreencast");
  for (const s of stills) {
    const f = frames.filter((x) => x.t <= s.t).at(-1);
    if (f) writeFileSync(join(outDir, `${name}-${s.label}.jpg`), Buffer.from(f.data, "base64"));
  }
  const gaps = frames.slice(1).map((f, i) => [f.t - frames[i].t, frames[i].t]).filter(([g]) => g > 400);
  log(`screencast: ${frames.length} frames, gaps over 400 ms: ${gaps.map(([g, t]) => `${Math.round(g)} ms at +${Math.round(t - t0)}`).join(", ") || "none"}`);
  const width = name === "desktop" ? 720 : 390;
  const sample = (from, to) => {
    const out = [];
    for (let t = from; t <= to; t += 1000 / 12) {
      const f = frames.filter((x) => x.t <= t).at(-1);
      if (f) out.push(f);
    }
    return out;
  };
  for (const m of marks) {
    const tag = `${name}-${m.label}`;
    const dir = join(outDir, `${tag}-frames`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const list = frames.filter((f) => f.t >= m.from && f.t <= m.to);
    list.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
    const tick = sample(m.from, m.to);
    const tdir = join(outDir, `${tag}-tick`);
    rmSync(tdir, { recursive: true, force: true });
    mkdirSync(tdir, { recursive: true });
    tick.forEach((f, i) => writeFileSync(join(tdir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
    if (tick.length > 2) gif(tdir, join(outDir, `${tag}.gif`), width);
    log(`${m.label}: ${list.length} frames`);
  }
  if (errors.length) console.log(`${name}: ${errors.length} page errors`);
  await p.close();
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1280, height: 800 } });
await browser.close();
await server.close();
