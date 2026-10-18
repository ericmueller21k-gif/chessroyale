// The Hidden Boss's phase 2, frame by frame in a real Boss alone battle, as an admin, on a phone (390 px) and a computer
// (1280 px), with real taps: the phase change (?win=1: you mate him in phase 1; he absorbs the God King, gets up in a
// rage, leaps onto the board, throws the book down, chants over its light, the split into four with its arcs, the book
// back in his hands, the Chess960 shuffle), the four boards in play (?phase=2: a few of your moves against him), a win
// (?win=1: your Qxf7 mates on your board, the bots mate on theirs: "Victory!") and a loss (?win=1, then you resign
// your board: "won 3 of 4"), and his phase 2 ultimate on the admins' trigger. Records every painted frame (Chrome's
// screencast) and saves stills, a GIF of each moment, and screenshots.
//   npm run frames:recluse2 -- <out-dir> [phone|desktop|both] [light|dark] [base=http://localhost:8788] [only=change]
// Needs the app and its API running (npx wrangler dev), as frames:recluse does.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2).filter((a) => !a.includes("="));
const base = process.argv.find((a) => a.startsWith("base="))?.slice(5) ?? "http://localhost:8788";
const [out = "recluse2-frames", which = "both", scheme = "light"] = args;
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
      return { simul: m?.simul ? { playing: m.simul.playing, decided: m.simul.decided, mine: m.simul.boards[0] } : null, kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, fall: !!ph?.fall, until: ph?.until ?? 0, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, now: Date.now() };
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
    // (Phase 2: your board, big on a phone, at the bottom left of the four on a computer.)
    const sel = (await p.locator(".rc-simul").count()) ? ".rc-simul .board-row > .board-wrap .hb-board, .rc-simul .rc-q2 .hb-board" : ".hb-board";
    const board = await p.locator(sel).first().boundingBox();
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
    // (Each gap with where it began, ms into the moment.)
    const gaps = list.slice(1).map((f, i) => [f.t - list[i].t, list[i].t - m.from]).filter(([g]) => g > 250);
    log(`${m.label}: ${list.length} frames, ${tick.length} ticks; gaps over 250 ms: ${gaps.map(([g, at]) => `${Math.round(g)} at +${Math.round(at)}`).join(", ") || "none"}`);
  }
  if (errors.length) console.log(`${name}: ${errors.length} page errors`);
  await ctx.close();
}


/** Tap a move on your phase 2 board until it's taken (its history grows). */
const simulPlay = async ({ p, st, log }, move) => {
  const tapSq = async (sq) => {
    const sel = (await p.locator(".rc-simul .rc-q2").count()) ? ".rc-simul .rc-q2 .hb-board" : ".rc-simul .board-row > .board-wrap .hb-board";
    const b = await p.locator(sel).first().boundingBox();
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    await p.mouse.click(b.x + (f + 0.5) * (b.width / 8), b.y + (7 - r + 0.5) * (b.height / 8));
  };
  const before = (await st()).simul.mine.history.length;
  for (let i = 0; i < 6 && (await st()).simul.mine.history.length === before; i++) {
    await tapSq(move.slice(0, 2));
    await tapSq(move.slice(2, 4));
    await p.waitForTimeout(400);
  }
  log(`played ${move}`);
};

/** ?win=1: mate him in phase 1, then the phase change; then your Qxf7 wins your board, the bots win theirs. */
const change = async (ctx) => {
  const { p, waitUntil, play, log, mark, shot } = ctx;
  await waitUntil((s) => s.kind === "play", 60_000);
  await p.waitForTimeout(800);
  await play("h5f7");
  const fall = await waitUntil((s) => s.fall, 30_000);
  const ch = await waitUntil((s) => s.kind === "phaseChange", 30_000);
  // (PHASE_CHANGE's beats: the God King triumphant, the boss's hand raised, the drain, the power landing (his look
  // ignites), the God King gone, his rage, the leap, landed, the book brandished, thrown down, the chant and its light, the
  // cracks and the arcs, the split, the boards growing, the book back in his hands, the leap back, "PHASE 2".)
  // (Oct 17, its pace: his line before the seize, the fist held as the power lands, the cast held; RECLUSE_PHASE2.change.)
  const beats = [[600, "01-king"], [5200, "01b-talk"], [6450, "02-seize"], [7700, "03-drain"], [8900, "04-ignite"], [9550, "05-gone"], [10200, "05b-hold"], [11400, "06-rage"], [12100, "07-leap"], [12600, "08-landed"], [13000, "09-brandish"], [13600, "10-thrown"], [14600, "11-chant"], [17500, "11b-cast"], [19700, "12-crack-arcs"], [20450, "13-split-arcs"], [21200, "14-grow"], [22300, "15-book-back"], [23000, "16-leap-back"], [23900, "17-banner"]];
  for (const [ms, label] of beats) {
    const wait = ch.now + ms - Date.now();
    if (wait > 0) await p.waitForTimeout(wait);
    await shot(`change-${label}`);
  }
  // (Then the countdown on the four boards, before their clocks.)
  await waitUntil((s) => s.kind === "simul", 30_000);
  await p.waitForTimeout(1500);
  await shot("change-18-countdown");
  const s2 = await waitUntil((s) => s.kind === "simul" && s.simul?.playing, 30_000);
  mark("change", fall.now - 300, s2.now + 1200);
  await p.waitForTimeout(800);
  await shot("8-four-boards");
  const t = Date.now();
  await simulPlay(ctx, "h5f7");
  const res = await waitUntil((s) => s.kind === "results", 30_000);
  await p.waitForTimeout(4000);
  await shot("9-victory");
  mark("win", t - 1500, res.now + 4000);
};

/** ?phase=2: the four boards in play, a few of your moves against him. */
const playing = async (ctx) => {
  const { p, waitUntil, st, mark, shot } = ctx;
  const s2 = await waitUntil((s) => s.kind === "simul" && s.simul?.playing, 60_000);
  const { Chess } = await import("chess.js");
  for (let i = 0; i < 4; i++) {
    const s = await waitUntil((x) => x.simul?.mine?.toMove === "crowd" || !!x.simul?.mine?.result, 60_000);
    if (s.simul.mine.result) break;
    const moves = new Chess(s.simul.mine.fen.replace(/ [A-Ha-h]+ /, " - ")).moves({ verbose: true }).filter((m) => m.piece === "p" && !m.captured);
    await simulPlay(ctx, (moves[i % moves.length] ?? moves[0]).lan);
  }
  await p.waitForTimeout(3000);
  await shot("10-in-play");
  mark("play", s2.now, Date.now());
  void st;
};

/** ?phase=2, then the admins' trigger: his ultimate ("5 SECONDS!"), then a random move played for you when yours run out. */
const ult = async (ctx) => {
  const { p, waitUntil, mark, shot, log } = ctx;
  await waitUntil((s) => s.kind === "simul" && s.simul?.playing, 60_000);
  await p.waitForTimeout(1500);
  const t = Date.now();
  await p.getByRole("button", { name: "Trigger ultimate (testing)" }).click();
  log("ultimate triggered");
  await p.waitForTimeout(900);
  await shot("12-ultimate");
  await p.waitForTimeout(7000);
  await shot("13-random-move");
  mark("ultimate", t - 300, Date.now());
};

/** ?win=1, then you resign your board: the bots win theirs, "won 3 of 4". */
const loss = async (ctx) => {
  const { p, waitUntil, play, mark, shot } = ctx;
  await waitUntil((s) => s.kind === "play", 60_000);
  await p.waitForTimeout(800);
  await play("h5f7");
  const s2 = await waitUntil((s) => s.kind === "simul" && s.simul?.playing, 60_000);
  await p.waitForTimeout(700);
  const t = Date.now();
  if (await p.getByRole("button", { name: "Match options" }).count()) {
    await p.getByRole("button", { name: "Match options" }).click();
    await p.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  } else await p.getByRole("button", { name: "Resign", exact: true }).click();
  await p.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
  const res = await waitUntil((s) => s.kind === "results", 30_000);
  await p.waitForTimeout(4000);
  await shot("11-defeat");
  mark("loss", t - 500, res.now + 4000);
  void s2;
};

const runs = [];
if (which !== "desktop") runs.push(["phone", { ...devices["iPhone 13"] }]);
if (which !== "phone") runs.push(["desktop", { viewport: { width: 1280, height: 800 } }]);
// (`only=change`: the phase change alone.)
const onlyChange = process.argv.includes("only=change");
for (const [name, context] of runs) {
  await battle(`${name}-change`, context, "win=1&laststand=0", change);
  if (onlyChange) continue;
  await battle(`${name}-play`, context, "phase=2", playing);
  await battle(`${name}-ult`, context, "phase=2", ult);
  await battle(`${name}-loss`, context, "win=1&laststand=0", loss);
}
await browser.close();
