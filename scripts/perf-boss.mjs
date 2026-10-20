// Performance over a whole match: plays a solo boss battle (or a Crowd match) to move N with real drags, on a computer
// and on a phone with its CPU slowed 4x, and records after every move: frame times (idle, while dragging a piece,
// and through the boss's turn), DOM nodes, running animations, rAF callbacks per frame, pending timers, event
// listeners, JS heap and audio nodes. Prints a table per run and writes everything to <out>.json.
//   npm run perf:boss -- [out-dir] [gingerbread|clown|grex|crowd|online] [phone|desktop|both] [moves=25] [power]
// (grex: try power=candle for his barrage.) Any boss id works (bigboy, sawyer, hollow, pig), with its ultimate's id.
// Each row also has `fx`: the frames while a boss's effect was on screen (a power's moment, Lights out, the funhouse's
// spin), and the long tasks (over 50 ms) in them; `fxBy` the same for each effect ("pm-candle", "lightsout", "spin"). PERF_DIST=<dir>: serve that build instead (build it first with
// \`npx vite build packages/app --outDir $PWD/<dir>\` from the repo root), to compare two versions with PERF_NO_BUILD=1.
// The production build (vite build + preview), like the live site. Nothing here should grow with the match
// (.claude/LESSONS.md: "Lag that grows with the match").
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, join, dirname } from "node:path";
import { chromium, devices } from "@playwright/test";
import { preview } from "vite";
import { Chess } from "chess.js";
import { counts, frameStats, instrument, longStats } from "../e2e/perf-probe.js";

const [out = "perf-out", mode = "gingerbread", which = "both", movesArg = "25", power = ""] = process.argv.slice(2);
const MOVES = Number(movesArg) || 25;
// online: a Ginger raid on a running local server (npx wrangler dev --port 8788 --var TEST_SWITCHES:1 ..., after
// npm run build).
const ONLINE = process.env.PERF_URL ?? "http://localhost:8788/";
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
// PERF_PROFILE=<move>: a CPU profile of that move's idle and drag (an unminified build, so the names read).
// PERF_PROFILE_BOSS=1: the boss's turn after that move instead.
const PROFILE = Number(process.env.PERF_PROFILE ?? 0);
const PROFILE_BOSS = !!process.env.PERF_PROFILE_BOSS;
if (!process.env.PERF_NO_BUILD) execFileSync("npx", ["vite", "build", "packages/app", "--logLevel", "error", ...(PROFILE ? ["--minify", "false"] : [])], { stdio: "inherit" });
const server = await preview({ root: "packages/app", configFile: "packages/app/vite.config.ts", preview: { port: 5199, strictPort: false }, logLevel: "error", ...(process.env.PERF_DIST ? { build: { outDir: resolve(process.env.PERF_DIST) } } : {}) });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

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

const stats = frameStats;

async function run(kind, name, context, throttle) {
  const tag = `${kind}-${name}`;
  const p = await browser.newPage({ ...context });
  p.on("pageerror", (e) => console.log(tag, "pageerror", e.message));
  await p.addInitScript(instrument);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Performance.enable");
  const q =
    kind === "crowd"
      ? "mode=crowd&clock=60&augments=0"
      : kind === "online"
        ? `mode=raid&boss=gingerbread${power ? `&power=${power}` : ""}&clock=60`
        : `boss=${kind}${power ? `&power=${power}` : ""}&clock=60`;
  // (The production build allows the address's test switches only where the server says so: no server here, so
  // its answer is given. Online, the local server's TEST_SWITCHES does it: see its command above.)
  if (kind !== "online") await p.route("**/api/auth/config", (r) => r.fulfill({ json: { accounts: false, google: false, email: false, testSwitches: true } }));
  await p.goto(`${kind === "online" ? ONLINE : url}?debug&nolanding&${q}`);
  if (kind === "crowd") {
    await p.getByRole("radio", { name: /^Solo/ }).click();
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
  } else if (kind === "online") {
    // A raid lobby on the local server, started alone: the server runs the match, this device the boss's engine.
    await p.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
    await p.getByRole("button", { name: /^Create a (lobby|raid)$/ }).click();
    await p.getByRole("button", { name: /^Start with 1 player$/ }).click();
  } else {
    // (Home's Boss raid card first, since Oct 19: Boss alone is a choice on its screen.)
    await p.getByRole("main").getByRole("button", { name: /^Boss raid/ }).click();
    await p.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  }
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
    const frames = await p.evaluate(() => window.__perf.frames.splice(0));
    const page = { frames, longs: await p.evaluate(() => window.__perf.longs ?? []), ...(await p.evaluate(counts)) };
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
    const before = await sample();
    const boss = before.frames; // everything since the last move: the reveal and the boss's turn
    const bossOnly = boss.filter((f) => f[2] !== "play");
    const fxFrames = boss.filter((f) => f[4]);
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
        orientation: document.querySelector(".hb")?.classList.contains("orientation-black") ? "black" : "white",
        events: (p?.events ?? []).filter((e) => e.turn === p.turn).map((e) => e.kind),
      };
    });
    seen.add(fen.split(" ").slice(0, 4).join(" "));
    const options = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
    const pick = (await player.best(fen, options)) ?? pickMove(fen, options, seen);
    const board = await p.locator(".hb-board").first().boundingBox();
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
      boss: stats(bossOnly.map((f) => f[0])),
      bossLong: longStats(before.longs, bossOnly),
      fx: stats(fxFrames.map((f) => f[0])),
      fxLong: longStats(before.longs, fxFrames),
      // (Each effect on its own: "pm-candle", "lightsout", "spin"...)
      fxBy: Object.fromEntries(
        [...new Set(fxFrames.map((f) => f[4]))].map((k) => {
          const fr = fxFrames.filter((f) => f[4] === k);
          // (Its frames and long tasks too, to pool an effect's showings across moves and runs.)
          return [k, { ...stats(fr.map((f) => f[0])), long: longStats(before.longs, fr), frames: fr.map((f) => +f[0].toFixed(1)), longs: before.longs.filter(([st]) => fr.some((f) => st >= f[3] - f[0] && st < f[3])).map((l) => Math.round(l[1])) }];
        }),
      ),
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
      scriptPerMove: +(s.script - prev.script).toFixed(2),
      stylesPerMove: s.styles - prev.styles,
    };
    prev = s;
    rows.push(row);
    console.log(
      `${tag} #${String(move).padStart(2)} ${pick.padEnd(5)} idle p50 ${row.idle.p50} p95 ${row.idle.p95} slow ${(row.idle.slow * 100).toFixed(0)}% | drag p50 ${row.drag.p50} p95 ${row.drag.p95} slow ${(row.drag.slow * 100).toFixed(0)}% | boss${events.length ? `(${events.join("+")})` : ""} p95 ${row.boss.p95} slow ${(row.boss.slow * 100).toFixed(0)}% long ${row.bossLong.n}(${row.bossLong.max}) | fx ${Object.entries(row.fxBy).map(([k, v]) => `${k} n ${v.n} p95 ${v.p95} long ${v.long.n}(${v.long.max})`).join(", ") || "-"} | dom ${row.dom} nodes ${row.nodes} anims ${row.anims} raf/f ${row.rafPerFrame}(${row.rafMax}) timers ${row.timeouts}+${row.intervals}i listeners ${row.listeners} heap ${row.heapMB}MB audio ${row.audio}/${row.audioOff}`,
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
