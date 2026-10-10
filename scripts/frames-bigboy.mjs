// Big Boy, the baby boss, frame by frame in a real solo match (Boss alone), on a phone and a computer, with real taps:
// his snack in the intro (the crowd's d- or e-pawn eaten), his first toy block and the rage warning as the 2nd turn
// begins (?power=bounce), a move, and the Big Bounce at the start of his turn (the pieces thrown, the crash, the new
// position) before his move. Records every painted frame (Chrome's screencast) and saves stills and a GIF of each
// moment, plus a timeline. `side=b`: the crowd plays Black (he opens as White).
//   npm run frames:bigboy -- <out-dir> [phone|desktop|both] [light|dark] [side=b]
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const args = process.argv.slice(2).filter((a) => !a.includes("="));
const sideB = process.argv.includes("side=b");
const [out = "bigboy-frames", which = "both", scheme = "light"] = args;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

async function run(name, context) {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  const errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log(name, "pageerror", e.message);
  });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
  await p.goto(`${url}?debug&clock=60&nolanding&boss=bigboy&power=bounce&laststand=0${sideB ? "&side=b" : ""}`);
  await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const t0 = Date.now();
  const log = (s) => console.log(`${name} +${Date.now() - t0}ms ${s}`);
  const marks = [];
  /** Stills taken from the recorded frames (a screenshot mid-moment stalls the screencast). */
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
      await p.waitForTimeout(60);
    }
    await p.screenshot({ path: join(outDir, `${name}-timeout.png`) });
    throw new Error(`${name}: timed out at ${JSON.stringify({ kind: s?.kind, intro: s?.intro, thinking: s?.thinking })}`);
  };
  const at = async (sq) => {
    const board = await p.locator("cg-board").first().boundingBox();
    const flip = await p.evaluate(() => document.querySelector(".cg-wrap")?.classList.contains("orientation-black"));
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
  };
  const tap = async (sq) => {
    const q = await at(sq);
    await p.mouse.click(q.x, q.y);
  };
  /** Waits for your move (its round-start countdown over), then plays `move` with two taps. */
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

  /** A move the crowd may play now (the toy block allowing), preferring `want`. */
  const pick = async (...want) => {
    const s = await st();
    const allowed = s.boss?.powers?.allowed ?? new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to);
    return want.find((m) => allowed.includes(m)) ?? allowed.sort()[0];
  };

  // The intro: his card, then his snack (he waddles over, grabs the crowd's pawn, eats it), then START!.
  const intro = await waitUntil((s) => s.kind === "boss" && s.intro);
  log(`intro, snack: ${intro.boss?.powers?.snack}`);
  for (let k = 0; k < 6; k++) {
    await p.waitForTimeout(500);
    stills.push({ label: `1-snack-${k}`, t: Date.now() });
  }
  await waitUntil((s) => s.kind === "play" || (s.kind === "boss" && !s.intro));
  mark("snack", t0 + 2000, Date.now());
  await p.screenshot({ path: join(outDir, `${name}-1-start.png`) });

  // Move 1 (after his opening move when the crowd is Black); his reply; the 2nd turn begins with his toy block and the
  // warning.
  await waitUntil((s) => s.kind === "play", 60_000);
  await play(await pick("g1f3", "b1c3", "g8f6", "b8c6"));
  const block = await waitUntil((s) => s.kind === "boss" && !s.thinking && (s.boss?.powers?.events ?? []).some((e) => e.kind === "block"));
  const ev = block.boss.powers.events.find((e) => e.kind === "block");
  log(`toy block on ${ev.square}; events ${block.boss.powers.events.map((e) => e.kind).join(", ")}; until +${block.until - t0}ms`);
  mark("block", block.now - 600, block.until + 300);
  await waitUntil((s) => s.kind === "play");
  await p.waitForTimeout(900);
  await p.screenshot({ path: join(outDir, `${name}-2-block.png`) });

  // Move 2: then the Big Bounce at the start of his turn, before his move.
  await play(await pick("b1c3", "g1f3", "b8c6", "g8f6", "h2h3", "a7a6"));
  const thinking = await waitUntil((s) => s.kind === "boss" && s.thinking, 30_000);
  const bounce = await waitUntil((s) => s.kind === "boss" && !s.thinking && !!s.boss?.powers?.bounce, 60_000);
  const b = bounce.boss.powers.bounce;
  log(`bounce after ${bounce.now - thinking.now}ms thinking: moved ${JSON.stringify(b.moves)} spots ${b.spots} loss ${b.loss}`);
  for (const ms of [800, 1500, 1900, 2500, 3100, 3700, 4150, 4300, 4700, 5300, 5800, 6200]) stills.push({ label: `3-bounce-${String(ms).padStart(4, "0")}`, t: bounce.now + ms });
  await waitUntil((s) => s.kind === "boss" && s.thinking, 30_000);
  const reply = await waitUntil((s) => s.kind === "play", 60_000);
  mark("bounce", bounce.now - 400, reply.now + 500);
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(outDir, `${name}-4-after.png`) });
  await cdp.send("Page.stopScreencast");
  for (const s of stills) {
    const f = frames.filter((x) => x.t <= s.t).at(-1);
    if (f) writeFileSync(join(outDir, `${name}-${s.label}.jpg`), Buffer.from(f.data, "base64"));
  }
  const gaps = frames.slice(1).map((f, i) => [f.t - frames[i].t, frames[i].t]).filter(([g]) => g > 400);
  log(`screencast: ${frames.length} frames, gaps over 400 ms: ${gaps.map(([g, t]) => `${Math.round(g)} ms at +${Math.round(t - t0)}`).join(", ") || "none"}`);

  for (const m of marks) {
    const tag = `${name}-${m.label}`;
    const dir = join(outDir, `${tag}-frames`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const list = frames.filter((f) => f.t >= m.from && f.t <= m.to);
    list.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
    if (list.length > 2) {
      const dur = (list[list.length - 1].t - list[0].t) / 1000;
      const fps = Math.max(5, Math.min(30, Math.round(list.length / Math.max(0.1, dur))));
      try {
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%04d.jpg"), "-vf", `fps=12,scale=${name === "desktop" ? 720 : 390}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, join(outDir, `${tag}.gif`)]);
      } catch (e) {
        console.log("gif failed", e.message);
      }
    }
    log(`${m.label}: ${list.length} frames`);
  }
  if (errors.length) console.log(`${name}: ${errors.length} page errors`);
  await p.close();
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
