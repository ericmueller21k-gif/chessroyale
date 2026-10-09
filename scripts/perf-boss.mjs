// Performance over a whole match: plays a solo boss battle (or a Crowd match) to move N with real drags, on a computer
// and on a phone with its CPU slowed 4x, and records after every move: frame times (idle, while dragging a piece,
// and through the boss's turn), DOM nodes, running animations, rAF callbacks per frame, pending timers, event
// listeners, JS heap and audio nodes. Prints a table per run and writes everything to <out>.json.
//   npm run perf:boss -- [out-dir] [gingerbread|clown|crowd] [phone|desktop|both] [moves=25] [power]
// The production build (vite build + preview), like the live site. Nothing here should grow with the match
// (.claude/LESSONS.md: "Lag that grows with the match").
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, join, dirname } from "node:path";
import { chromium, devices } from "@playwright/test";
import { preview } from "vite";
import { Chess } from "chess.js";

const [out = "perf-out", mode = "gingerbread", which = "both", movesArg = "25", power = ""] = process.argv.slice(2);
const MOVES = Number(movesArg) || 25;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
// PERF_PROFILE=<move>: a CPU profile of that move's idle and drag (an unminified build, so the names read).
// PERF_PROFILE_BOSS=1: the boss's turn after that move instead.
const PROFILE = Number(process.env.PERF_PROFILE ?? 0);
const PROFILE_BOSS = !!process.env.PERF_PROFILE_BOSS;
if (!process.env.PERF_NO_BUILD) execFileSync("npx", ["vite", "build", "--logLevel", "error", ...(PROFILE ? ["--minify", "false"] : [])], { stdio: "inherit" });
const server = await preview({ root: ".", configFile: "vite.config.ts", preview: { port: 5199, strictPort: false }, logLevel: "error" });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

/** Counters the page keeps from its first script: rAF callbacks, timers, audio nodes and a frame recorder. */
function instrument() {
  const P = (window.__perf = { raf: 0, frames: [], tag: "", timeouts: new Set(), intervals: new Set(), tSet: 0, iSet: 0, audio: 0, audioOff: 0, contexts: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => (P.raf++, cb(t)));
  const st = window.setTimeout.bind(window);
  const ct = window.clearTimeout.bind(window);
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  window.setTimeout = (fn, ms, ...a) => {
    P.tSet++;
    const id = st((...x) => (P.timeouts.delete(id), typeof fn === "function" ? fn(...x) : undefined), ms, ...a);
    P.timeouts.add(id);
    return id;
  };
  window.setInterval = (fn, ms, ...a) => {
    P.iSet++;
    const id = si(fn, ms, ...a);
    P.intervals.add(id);
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => {
    P.timeouts.delete(id);
    P.intervals.delete(id);
    ct(id);
    ci(id);
  };
  const Ctx = window.BaseAudioContext ?? window.AudioContext;
  if (Ctx) {
    for (const k of Object.getOwnPropertyNames(Ctx.prototype)) {
      if (!k.startsWith("create") || typeof Ctx.prototype[k] !== "function" || k === "createPeriodicWave" || k === "createBuffer") continue;
      const f = Ctx.prototype[k];
      Ctx.prototype[k] = function (...a) {
        P.audio++;
        return f.apply(this, a);
      };
    }
    const AC = window.AudioContext;
    window.AudioContext = function (...a) {
      P.contexts++;
      return new AC(...a);
    };
    window.AudioContext.prototype = AC.prototype;
    const dis = AudioNode.prototype.disconnect;
    AudioNode.prototype.disconnect = function (...a) {
      P.audioOff++;
      return dis.apply(this, a);
    };
  }
  // Every frame: when, how long since the last, how many rAF callbacks ran, and what was going on.
  let last = 0;
  let lastRaf = 0;
  const loop = (t) => {
    if (last && !document.hidden) P.frames.push([t - last, P.raf - lastRaf, P.tag || (window.match?.phase?.kind ?? "")]);
    last = t;
    lastRaf = P.raf;
    raf(loop);
  };
  raf(loop);
}

/**
 * The player: Stockfish (the lite build, in its own process) at about club strength, choosing among the moves the
 * powers allow, so the match lasts (a careless player is mated long before move 25). Falls back to a careful
 * two-ply pick if it can't answer.
 */
const require = createRequire(import.meta.url);
function engine(elo) {
  const child = spawn(process.execPath, [join(dirname(require.resolve("stockfish/package.json")), "bin", "stockfish-19-lite-single.js")], { stdio: ["pipe", "pipe", "ignore"] });
  let buf = "";
  let waiter = null;
  child.stdout.on("data", (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (waiter && line.startsWith(waiter.prefix)) {
        const w = waiter;
        waiter = null;
        w.resolve(line);
      }
    }
  });
  const send = (c) => child.stdin.write(c + "\n");
  const ask = (cmd, prefix, ms = 5000) => Promise.race([new Promise((resolve) => ((waiter = { prefix, resolve }), send(cmd))), new Promise((r) => setTimeout(() => r(null), ms))]);
  const ready = (async () => {
    await ask("uci", "uciok");
    send("setoption name UCI_LimitStrength value true");
    send(`setoption name UCI_Elo value ${elo}`);
    await ask("isready", "readyok");
  })();
  return {
    async best(fen, moves) {
      await ready;
      send(`position fen ${fen}`);
      const line = await ask(`go movetime 120 searchmoves ${moves.join(" ")}`, "bestmove");
      const m = line?.split(" ")[1];
      return m && moves.includes(m) ? m : null;
    },
    close: () => child.kill(),
  };
}
const player = engine(Number(process.env.PERF_ELO ?? 1800));

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (ch, side) => ch.board().flat().reduce((s, q) => s + (q ? (q.color === side ? 1 : -1) * VAL[q.type] : 0), 0);
/** A careful player: the move that keeps the most material against the best reply (two plies), never into mate. */
function pickMove(fen, options, seen) {
  const me = fen.split(" ")[1];
  let best = options[0];
  let bestScore = -Infinity;
  for (const [i, uci] of options.entries()) {
    const ch = new Chess(fen);
    try {
      ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
    } catch {
      continue;
    }
    if (ch.isCheckmate()) return uci;
    let worst = ch.isDraw() ? -2 : Infinity;
    for (const r of ch.moves({ verbose: true })) {
      ch.move(r);
      const s = ch.isCheckmate() ? -1000 : material(ch, me);
      ch.undo();
      worst = Math.min(worst, s);
    }
    if (worst === Infinity) worst = material(ch, me);
    // Variety: a little for moves that don't repeat a position, and a stable shuffle between equals.
    const score = worst - (seen.has(ch.fen().split(" ").slice(0, 4).join(" ")) ? 0.6 : 0) + ((i * 7919) % 13) / 100;
    if (score > bestScore) [best, bestScore] = [uci, score];
  }
  return best;
}

const stats = (dts) => {
  if (!dts.length) return { n: 0, p50: 0, p95: 0, slow: 0, max: 0 };
  const s = [...dts].sort((a, b) => a - b);
  const q = (x) => s[Math.min(s.length - 1, Math.floor(x * s.length))];
  // A frame over 20 ms missed at least one 60 Hz refresh (16.7 ms): a dropped frame.
  return { n: s.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), slow: +(s.filter((d) => d > 20).length / s.length).toFixed(3), max: +s[s.length - 1].toFixed(0) };
};

async function run(kind, name, context, throttle) {
  const tag = `${kind}-${name}`;
  const p = await browser.newPage({ ...context });
  p.on("pageerror", (e) => console.log(tag, "pageerror", e.message));
  await p.addInitScript(instrument);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Performance.enable");
  const q = kind === "crowd" ? "mode=crowd&rounds=1&clock=60&augments=0&turns=all" : `boss=${kind}${power ? `&power=${power}` : ""}&clock=60`;
  await p.goto(`${url}?debug&nolanding&${q}`);
  if (kind === "crowd") {
    await p.getByRole("radio", { name: /^Solo/ }).click();
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
  } else await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const phase = () => p.evaluate(() => window.match?.phase.kind ?? null);
  const waitFor = async (want, ms = 120_000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const k = await phase();
      if (want.includes(k)) return k;
      await p.waitForTimeout(100);
    }
    return null;
  };
  const sample = async () => {
    const page = await p.evaluate(() => {
      const P = window.__perf;
      const frames = P.frames;
      P.frames = [];
      return {
        frames,
        dom: document.getElementsByTagName("*").length,
        anims: document.getAnimations().length,
        timeouts: P.timeouts.size,
        intervals: P.intervals.size,
        tSet: P.tSet,
        audio: P.audio,
        audioOff: P.audioOff,
        contexts: P.contexts,
        canvases: document.getElementsByTagName("canvas").length,
      };
    });
    const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    return { ...page, listeners: m.JSEventListeners, nodes: m.Nodes, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), script: m.ScriptDuration, layouts: m.LayoutCount, styles: m.RecalcStyleCount };
  };
  const startProfile = async () => {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  };
  const stopProfile = async (label) => {
    const { profile } = await cdp.send("Profiler.stop");
    writeFileSync(join(outDir, `${tag}-${label}.cpuprofile`), JSON.stringify(profile));
    const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    profile.samples.forEach((id, i) => {
      const n = byId.get(id);
      const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber + 1}`;
      self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
    });
    console.log(`${tag} ${label} profile, self time (ms):`);
    for (const [k, v] of [...self].sort((x, y) => y[1] - x[1]).slice(0, 25)) console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`);
  };
  const rows = [];
  const seen = new Set();
  let prev = await sample();
  for (let move = 1; move <= MOVES; move++) {
    const k = await waitFor(["play", "results", "final"]);
    if (k !== "play") {
      console.log(`${tag}: match over before move ${move} (${k})`);
      break;
    }
    await p.locator(".cc-banner", { hasText: "Round start" }).waitFor({ state: "detached", timeout: 20000 }).catch(() => undefined);
    const boss = (await sample()).frames; // everything since the last move: the reveal and the boss's turn
    if (move === PROFILE + 1 && PROFILE_BOSS) await stopProfile(`boss-before-move${move}`);
    if (move === PROFILE && !PROFILE_BOSS) await startProfile();
    // Idle on the board for 1.5 s.
    await p.evaluate(() => ((window.__perf.tag = "idle"), (window.__perf.frames = [])));
    await p.waitForTimeout(1500);
    const idle = await p.evaluate(() => ((window.__perf.tag = ""), window.__perf.frames.splice(0)));
    const { allowed, fen, orientation, events } = await p.evaluate(() => {
      const m = window.match;
      const p = m.boss?.powers;
      return {
        allowed: p?.allowed ?? null,
        fen: m.phase.board.fen,
        orientation: document.querySelector(".cg-wrap")?.classList.contains("orientation-black") ? "black" : "white",
        events: (p?.events ?? []).filter((e) => e.turn === p.turn).map((e) => e.kind),
      };
    });
    seen.add(fen.split(" ").slice(0, 4).join(" "));
    const options = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
    const pick = (await player.best(fen, options)) ?? pickMove(fen, options, seen);
    const board = await p.locator("cg-board").first().boundingBox();
    const flip = orientation === "black";
    const at = (s) => {
      const f = s.charCodeAt(0) - 97;
      const r = Number(s[1]) - 1;
      return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
    };
    // Drag the piece around the board for about 2 s (the frames measured), then drop it on its square.
    const a = at(pick.slice(0, 2));
    const b = at(pick.slice(2, 4));
    await p.evaluate(() => ((window.__perf.tag = "drag"), (window.__perf.frames = [])));
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < 2000; i++) {
      const r = board.width * 0.3;
      await p.mouse.move(board.x + board.width / 2 + r * Math.cos(i / 6), board.y + board.height / 2 + r * Math.sin(i / 6));
      await p.waitForTimeout(16);
    }
    await p.mouse.move(b.x, b.y, { steps: 4 });
    const drag = await p.evaluate(() => ((window.__perf.tag = ""), window.__perf.frames.splice(0)));
    await p.mouse.up();
    if (move === PROFILE && !PROFILE_BOSS) await stopProfile(`move${move}`);
    if (move === PROFILE && PROFILE_BOSS) await startProfile();
    // If the drop didn't take (the board wasn't ready), two taps.
    for (let tries = 0; tries < 6 && (await phase()) === "play"; tries++) {
      await p.waitForTimeout(300);
      if ((await phase()) !== "play") break;
      await p.mouse.click(a.x, a.y);
      await p.mouse.click(b.x, b.y);
    }
    const s = await sample();
    const rafPer = idle.map((f) => f[1]).sort((x, y) => x - y);
    const row = {
      move,
      pick,
      events,
      idle: stats(idle.map((f) => f[0])),
      drag: stats(drag.map((f) => f[0])),
      boss: stats(boss.filter((f) => f[2] !== "play").map((f) => f[0])),
      rafPerFrame: rafPer[Math.floor(rafPer.length / 2)] ?? 0,
      rafMax: rafPer[rafPer.length - 1] ?? 0,
      dom: s.dom,
      nodes: s.nodes,
      anims: s.anims,
      canvases: s.canvases,
      timeouts: s.timeouts,
      intervals: s.intervals,
      timeoutsPerMove: s.tSet - prev.tSet,
      listeners: s.listeners,
      heapMB: s.heapMB,
      audio: s.audio,
      audioOff: s.audioOff,
      contexts: s.contexts,
      scriptPerMove: +(s.script - prev.script).toFixed(2),
      stylesPerMove: s.styles - prev.styles,
    };
    prev = s;
    rows.push(row);
    console.log(
      `${tag} #${String(move).padStart(2)} ${pick.padEnd(5)} idle p50 ${row.idle.p50} p95 ${row.idle.p95} slow ${(row.idle.slow * 100).toFixed(0)}% | drag p50 ${row.drag.p50} p95 ${row.drag.p95} slow ${(row.drag.slow * 100).toFixed(0)}% | boss${events.length ? `(${events.join("+")})` : ""} p95 ${row.boss.p95} slow ${(row.boss.slow * 100).toFixed(0)}% | dom ${row.dom} nodes ${row.nodes} anims ${row.anims} raf/f ${row.rafPerFrame}(${row.rafMax}) timers ${row.timeouts}+${row.intervals}i listeners ${row.listeners} heap ${row.heapMB}MB audio ${row.audio}/${row.audioOff}`,
    );
  }
  await p.close();
  return rows;
}

const results = {};
const kinds = mode === "both" ? ["gingerbread", "clown"] : [mode];
for (const kind of kinds) {
  if (which !== "phone") results[`${kind}-desktop`] = await run(kind, "desktop", { viewport: { width: 1440, height: 900 } }, 1);
  if (which !== "desktop") results[`${kind}-phone`] = await run(kind, "phone", { ...devices["iPhone 13"] }, 4);
}
writeFileSync(join(outDir, `perf-${mode}${power ? `-${power}` : ""}.json`), JSON.stringify(results, null, 1));
player.close();
await browser.close();
await server.httpServer.close();
process.exit(0);
