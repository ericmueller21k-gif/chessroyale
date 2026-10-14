// The Hidden Boss, frame by frame in a real Boss alone battle, as an admin, on a phone (390 px) and a computer (1280 px),
// with real taps: his intro (the stare), his ultimate on the admins' trigger (the book consulted, opened like a spell
// book, slammed shut; "BULLET!"; then the dock's bullet clock), the God King's help tried and mocked (the book slammed
// shut), and, in a second battle (?win=1: you mate in one), his collapse and mumbling, then the result. Records every
// painted frame (Chrome's screencast) and saves stills, a GIF of each moment, and screenshots.
//   npm run frames:recluse -- <out-dir> [phone|desktop|both] [light|dark] [base=http://localhost:8788]
// Needs the app and its API running (npx wrangler dev): his menu entry is for admins, and the admin flag comes from
// /api/me (faked here as an admin's, as e2e/recluse.spec.ts does). Read the frames before calling a moment done
// (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2).filter((a) => !a.includes("="));
const base = process.argv.find((a) => a.startsWith("base="))?.slice(5) ?? "http://localhost:8788";
const [out = "recluse-frames", which = "both", scheme = "light"] = args;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

function gif(dir, file, width) {
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", join(dir, "%04d.jpg"), "-vf", `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, file]);
  } catch (e) {
    console.log("gif failed", e.message);
  }
}

/** One battle on one device: `script` drives it and marks the moments; then the frames are written out. */
async function battle(name, context, query, script) {
  const ctx = await browser.newContext({ ...context, colorScheme: scheme });
  // (An admin's profile, as /api/me gives one for an email in ADMIN_EMAILS.)
  await ctx.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log(name, "pageerror", e.message);
  });
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1, ...(name.startsWith("phone") ? { maxWidth: 780, maxHeight: 1688 } : {}) });
  await p.goto(`${base}/?debug&nolanding&boss=recluse&${query}`);
  await p.waitForFunction(() => !!document.querySelector("main"), null, { timeout: 30_000 });
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!window.match)); i++) {
    const btn = p.getByRole("main").getByRole("button", { name: "Boss alone" });
    if (await btn.isEnabled().catch(() => false)) await btn.click().catch(() => undefined);
    await p.waitForTimeout(750);
  }
  const t0 = Date.now();
  const log = (s) => console.log(`${name} +${Date.now() - t0}ms ${s}`);
  const marks = [];
  const st = () =>
    p.evaluate(() => {
      const m = window.match;
      const ph = m?.phase;
      return { kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, fall: !!ph?.fall, until: ph?.until ?? 0, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, now: Date.now() };
    });
  const waitUntil = async (fn, ms = 90_000) => {
    const start = Date.now();
    let s = null;
    while (Date.now() - start < ms) {
      s = await st();
      if (fn(s)) return s;
      await p.waitForTimeout(40);
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
    await p.waitForTimeout(500);
    for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await p.waitForTimeout(400);
    }
    log(`played ${move}`);
  };
  /** A legal move once it's your move: the first of `want` that's legal, else any. */
  const pick = async (...want) => {
    const s = await waitUntil((x) => x.kind === "play");
    const legal = await p.evaluate((fen) => {
      const m = window.match;
      return m.runner ? [...(m.runner.crowdAllowed() ?? [])] : [];
    }, s.fen);
    const { Chess } = await import("chess.js");
    const all = legal.length ? legal : new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to);
    return want.find((m) => all.includes(m)) ?? all.filter((m) => m.length === 4).sort()[0];
  };
  await script({ p, st, waitUntil, play, pick, log, mark: (label, from, to) => marks.push({ label, from, to }), shot: (label) => p.screenshot({ path: join(outDir, `${name}-${label}.png`) }) });
  await cdp.send("Page.stopScreencast");
  const width = name.startsWith("desktop") ? 720 : 390;
  const sample = (from, to) => {
    const outs = [];
    for (let t = from; t <= to; t += 1000 / 12) {
      const f = frames.filter((x) => x.t <= t).at(-1);
      if (f) outs.push(f);
    }
    return outs;
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
    const gaps = list.slice(1).map((f, i) => f.t - list[i].t).filter((g) => g > 250);
    log(`${m.label}: ${list.length} frames, ${tick.length} ticks; gaps over 250 ms: ${gaps.map(Math.round).join(", ") || "none"}`);
  }
  if (errors.length) console.log(`${name}: ${errors.length} page errors`);
  await ctx.close();
}

/** The intro, his ultimate on the admins' trigger, the God King's help mocked, a few bullet moves. */
const fight = async ({ p, st, waitUntil, play, pick, log, mark, shot }) => {
  const intro = await waitUntil((s) => s.kind === "boss" && s.intro);
  const first = await waitUntil((s) => s.kind === "play", 60_000);
  mark("intro", intro.now - 200, first.now + 1500);
  await p.waitForTimeout(1500);
  await shot("1-intro-end");
  // The admins' trigger: his ultimate as the next turn begins.
  await p.locator(".ult-test").first().click();
  log("trigger pulled");
  await play(await pick("g1f3", "b1c3", "d2d3", "h2h3"));
  const boss = await waitUntil((s) => s.kind === "boss" && !s.thinking && !s.intro, 150_000);
  log(`his move: events ${(boss.boss?.powers?.events ?? []).map((e) => e.kind).join(",")}`);
  const after = await waitUntil((s) => s.kind === "play", 60_000);
  mark("ultimate", boss.now - 300, after.now + 2500);
  await p.waitForTimeout(2600);
  await shot("2-bullet-clock");
  // The God King's help tried: his strike. Blocked, nothing spent; the boss mocks it (the book slammed shut).
  const t = Date.now();
  await p.getByRole("button", { name: /God King: tap to summon/ }).click();
  await p.getByRole("menuitem", { name: /Strike/ }).click();
  log("strike tried");
  await p.waitForTimeout(400);
  await shot("3-help-mocked");
  await p.waitForTimeout(2600);
  mark("mock", t - 200, Date.now());
  await play(await pick("d2d3", "h2h3", "a2a3"));
  await waitUntil((s) => s.kind === "play", 120_000);
  await p.waitForTimeout(1500);
  await shot("4-bullet-turn");
};

/** ?win=1: you mate him at once (Qxf7#); his collapse and mumbling, then the result screen. */
const beaten = async ({ p, waitUntil, play, log, mark, shot }) => {
  await waitUntil((s) => s.kind === "play", 60_000);
  await p.waitForTimeout(800);
  const t = Date.now();
  await play("h5f7");
  await waitUntil((s) => s.kind === "boss" && s.fall, 30_000);
  await p.waitForTimeout(1800);
  await shot("5-collapse");
  const res = await waitUntil((s) => s.kind === "results", 30_000);
  log("results");
  await p.waitForTimeout(6000);
  await shot("6-results");
  mark("collapse", t - 200, res.now + 6000);
};

const runs = [];
if (which !== "desktop") runs.push(["phone", { ...devices["iPhone 13"] }]);
if (which !== "phone") runs.push(["desktop", { viewport: { width: 1280, height: 800 } }]);
for (const [name, context] of runs) {
  await battle(name, context, "laststand=0", fight);
  await battle(`${name}-win`, context, "win=1", beaten);
}
await browser.close();
