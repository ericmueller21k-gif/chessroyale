// Sawyer, the raccoon with a saw, frame by frame in a real solo match (Boss alone), on a phone and a computer, with
// real taps: his first move (a pawn's) and the split as the 2nd turn begins (with the warning: ?power=boardsaw), the
// board saw as the 3rd begins (he leaps on, revs, saws up between the d and e files, the board splits), his first saw
// cut as the 4th begins, the cut taped over on the 5th and 6th and healing away on the 7th, and the halves rejoining
// on the 8th. Records every painted frame (Chrome's screencast) and saves stills and a GIF of each moment (and one of
// the cut healing, turn by turn), plus a timeline.
//   npm run frames:sawyer -- <out-dir> [phone|desktop|both] [light|dark] [side=b]
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const args = process.argv.slice(2).filter((a) => !a.includes("="));
const sideB = process.argv.includes("side=b");
const [out = "sawyer-frames", which = "both", scheme = "light"] = args;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
process.chdir("packages/app");
const server = await createServer({ root: ".", configFile: "vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

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
    console.log(name, "pageerror", e.message);
  });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1, ...(name === "phone" ? { maxWidth: 780, maxHeight: 1688 } : {}) });
  await p.goto(`${url}?debug&clock=60&nolanding&boss=sawyer&power=boardsaw&laststand=0${sideB ? "&side=b" : ""}`);
  // (Clicked again if the first tap came before the page was ready.)
  for (let i = 0; i < 5 && !(await p.evaluate(() => !!window.match)); i++) {
    await p.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
    await p.waitForTimeout(1500);
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
  /** A move the crowd may play now (the cuts allowing), preferring `want`; no promotions or captures of note. */
  const pick = async (...want) => {
    const s = await st();
    const allowed = (s.boss?.powers?.allowed ?? new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to)).filter((m) => m.length === 4);
    return want.find((m) => allowed.includes(m)) ?? allowed.sort()[0];
  };
  /** The boss's turn that brings `kind`'s moment: from his move landing until the crowd's turn, with stills through it. */
  const moment = async (label, kind, stillsAt = []) => {
    const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && (x.boss?.powers?.events ?? []).some((e) => e.kind === kind));
    log(`${label}: events ${s.boss.powers.events.map((e) => e.kind).join(", ")}; until +${s.until - t0}ms`);
    for (const ms of stillsAt) stills.push({ label: `${label}-${String(ms).padStart(4, "0")}`, t: s.now + ms });
    const end = await waitUntil((x) => x.kind === "play", 60_000);
    mark(label, s.now - 300, end.now + 500);
    return s;
  };
  /** The boss's reply as a turn begins (whatever comes): stills a beat after it lands and on the crowd's turn. */
  const reply = async (label) => {
    const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && !x.intro, 60_000);
    const end = await waitUntil((x) => x.kind === "play", 60_000);
    mark(label, s.now - 300, end.now + 1500);
    await p.waitForTimeout(1500);
    return s;
  };

  await waitUntil((s) => s.kind === "boss" && s.intro);
  await waitUntil((s) => s.kind === "play", 60_000);
  await p.screenshot({ path: join(outDir, `${name}-1-start.png`) });

  /** A move that takes one of his pawns (so his split gets room: the engine plays no ninth pawn), if one may. */
  const takeHisPawn = async () => {
    const s = await st();
    const his = s.boss.crowdSide === "w" ? "b" : "w";
    const allowed = s.boss?.powers?.allowed;
    const take = new Chess(s.fen).moves({ verbose: true }).filter((m) => m.captured === "p" && m.color !== his && !m.promotion && (!allowed || allowed.includes(m.from + m.to)));
    return take.sort((a, b) => "pnbrqk".indexOf(a.piece) - "pnbrqk".indexOf(b.piece))[0];
  };
  // Turn by turn: each moment as it comes (the split once there's room; the board saw on the 3rd turn; the first cut;
  // the cut taped over, healing; the halves rejoining), with stills through the split and the board saw.
  const want = { split: [0, 1300, 1700, 2000, 2200, 2400, 2550, 2700, 2900, 3200, 3600, 4000], boardsaw: [0, 1500, 2000, 2500, 3200, 3600, 4000, 4400, 4800, 4900, 5100, 5400, 5800, 6400], cut: [0, 1500, 1800, 1950, 2100, 2400] };
  const done = new Set();
  let lastCut = null;
  let sawOn = false;
  for (let turn = 1; turn <= 18 && done.size < 7; turn++) {
    const t = await takeHisPawn();
    await play(done.has("split") || !t ? await pick("h2h3", "a2a3", "h3h4", "a3a4", "h7h6", "a7a6", "h6h5", "a6a5") : t.from + t.to);
    const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && !x.intro, 60_000);
    const ev = (s.boss?.powers?.events ?? []).map((e) => e.kind);
    const pw = s.boss?.powers ?? {};
    const stage = pw.cut ? Math.min(2, pw.turn - pw.cut.at) : null;
    const labels = [];
    for (const k of ["split", "boardsaw", "cut"]) if (ev.includes(k) && !done.has(k)) labels.push(k);
    if (lastCut && pw.cut && stage === 1 && !done.has("tape1")) labels.push("tape1");
    if (lastCut && pw.cut && stage === 2 && !done.has("tape2")) labels.push("tape2");
    if (lastCut && !pw.cut && !done.has("heal")) labels.push("heal");
    if (sawOn && !pw.boardSaw && !done.has("rejoin")) labels.push("rejoin");
    lastCut = pw.cut ?? (labels.includes("heal") ? null : lastCut);
    sawOn = !!pw.boardSaw;
    for (const l of labels) for (const ms of want[l] ?? []) stills.push({ label: `${l}-${String(ms).padStart(4, "0")}`, t: s.now + ms });
    const end = await waitUntil((x) => x.kind === "play", 60_000);
    for (const l of labels) {
      done.add(l);
      mark(l, s.now - 300, end.now + (want[l] ? 500 : 1500));
      log(`${l}: events ${ev.join(", ")}; split ${JSON.stringify(pw.split)} cut ${JSON.stringify(pw.cut)} saw ${JSON.stringify(pw.boardSaw)}`);
    }
    if (labels.length) {
      await new Promise((r) => setTimeout(r, 1500));
      await p.screenshot({ path: join(outDir, `${name}-${labels.join("+")}.png`) });
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
  /** Frames from `from` to `to` at 12 a second (the last painted frame at each tick). */
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
  // The cut healing, turn by turn: its moment, then each turn's change (the tape, more tape, healing away).
  const healDir = join(outDir, `${name}-cut-heals-tick`);
  rmSync(healDir, { recursive: true, force: true });
  mkdirSync(healDir, { recursive: true });
  const heal = ["cut", "tape1", "tape2", "heal"].flatMap((l) => {
    const m = marks.find((x) => x.label === l);
    return m ? sample(m.from, m.to) : [];
  });
  heal.forEach((f, i) => writeFileSync(join(healDir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
  gif(healDir, join(outDir, `${name}-cut-heals.gif`), width);
  if (errors.length) console.log(`${name}: ${errors.length} page errors`);
  await p.close();
}

if (which !== "desktop") await run("phone", { ...devices["iPhone 13"] });
if (which !== "phone") await run("desktop", { viewport: { width: 1440, height: 900 } });
await browser.close();
await server.close();
