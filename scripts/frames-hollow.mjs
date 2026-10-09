// Hollow, the Darkness boss, frame by frame in a real solo match (Boss alone), on a phone and a computer, with real
// taps: his claim of the dark side (?side=b: the crowd would have been Black), his first cover of the dark after his
// first move, a wrong move attempt into the dark (the -5), a legal move, and Lights out (?power=lightsout: at the start
// of his second turn) with a piece found, a wrong square and a round left to run out. Records every painted frame
// (Chrome's screencast) and saves stills and a GIF of each moment, plus a timeline.
//   npm run frames:hollow -- <out-dir> [phone|desktop|both] [light|dark]
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "hollow-frames", which = "both", scheme = "light"] = process.argv.slice(2);
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
  await p.goto(`${url}?debug&clock=60&nolanding&boss=hollow&power=lightsout&side=b&laststand=0`);
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
      return { kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, lights: ph?.lights ?? null, until: ph?.until ?? 0, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, note: m?.darkNote ?? null, now: Date.now() };
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
    throw new Error(`${name}: timed out at ${JSON.stringify({ kind: s?.kind, intro: s?.intro, thinking: s?.thinking, note: s?.note })}`);
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

  // The intro: his card, then he claims the dark side, then START!.
  const intro = await waitUntil((s) => s.kind === "boss" && s.intro);
  log(`intro, claimed: ${!!intro.boss?.powers?.claimed}`);
  await waitUntil((s) => s.kind === "play");
  mark("claim", t0, Date.now());
  await p.screenshot({ path: join(outDir, `${name}-1-start.png`) });

  // Move 1; he replies and covers the square of the piece he moved.
  await play("e2e4");
  const cover = await waitUntil((s) => s.kind === "boss" && !s.thinking && (s.boss?.powers?.events ?? []).some((e) => e.kind === "dark"));
  const ev = cover.boss.powers.events.find((e) => e.kind === "dark");
  log(`he covers ${ev.square} (first: ${!!ev.first}), the boss screen until +${cover.until - t0}ms`);
  mark("first-cover", cover.now - 800, cover.until + 400);
  await waitUntil((s) => s.kind === "play");
  await p.waitForTimeout(900);
  await p.screenshot({ path: join(outDir, `${name}-2-dark.png`) });

  // A wrong attempt: tap the dark square (it selects, no dots), then a square his piece can't reach.
  const fen = (await st()).fen;
  const dark = ev.square;
  const wrongTo = ["a3", "h3", "a4", "h4"].find((sq) => !new Chess(fen).get(sq)) ?? "a3";
  const w0 = Date.now();
  await tap(dark);
  await p.waitForTimeout(500);
  stills.push({ label: "3-selected", t: Date.now() });
  await tap(wrongTo);
  await waitUntil((s) => !!s.note && !s.note.pending, 5000);
  log(`wrong attempt ${dark}${wrongTo}: ${JSON.stringify((await st()).note)}`);
  await p.waitForTimeout(500);
  stills.push({ label: "4-cost", t: Date.now() });
  await p.waitForTimeout(1300);
  mark("wrong-attempt", w0 - 300, Date.now());

  // A legal move; then Lights out at the start of his turn.
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to).find((m) => m === "d2d4") ?? "g1f3";
  await play(legal);
  const lo = await waitUntil((s) => s.kind === "boss" && !!s.lights);
  const lights = lo.lights;
  log(`lights out: ${JSON.stringify(lights.rounds.map((r) => r.pieces))}`);
  const lfen = lo.boss.board.fen;
  const his = (t) => {
    const c = new Chess(lfen);
    const out = [];
    for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) { const pc = c.get(`${f}${r}`); if (pc && pc.color === "b" && pc.type === t) out.push(`${f}${r}`); }
    return out;
  };
  const open = (i) => p.evaluate((i) => document.querySelector(`.lo-marks[data-round="${i}"][data-open="1"]`) !== null, i);
  // Round 1: found. Round 2: one found, one wrong. Round 3: left to run out.
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < 400 && !(await open(i)); k++) await p.waitForTimeout(40);
    await p.waitForTimeout(900);
    const want = lights.rounds[i].pieces;
    await tap(his(want[0])[0]);
    log(`round ${i + 1}: tapped ${his(want[0])[0]} for ${want[0]}`);
    if (i === 1) {
      await p.waitForTimeout(700);
      const empty = ["e5", "d5", "c6", "f6"].find((sq) => !new Chess(lfen).get(sq));
      await tap(empty);
      log(`round 2: tapped ${empty} (wrong)`);
    }
    await p.waitForTimeout(600);
    stills.push({ label: `5-round${i + 1}`, t: Date.now() });
  }
  const end = await waitUntil((s) => s.kind === "boss" && !s.lights, 60_000);
  log(`lights back; standings ${JSON.stringify(await p.evaluate(() => window.match.standings().map((x) => [x.name, x.points])))}`);
  mark("lights-out", lo.now - 600, end.now + 600);
  await waitUntil((s) => s.kind === "play", 60_000);
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(outDir, `${name}-6-after.png`) });
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
