// Alfil, the woolly mammoth, frame by frame in a real solo match (Boss alone), on a phone (390 px wide) or a computer,
// with real taps: his Tusks cast and the fusion on his next turn (?power=tusks: his cast from his first turn), or his
// Mammoth Slam through to the landing three turns later (?power=slam). Records every painted frame (Chrome's
// screencast) and saves a GIF of each (the Slam's: its moment, each turn's shadows, the landing), stills through them,
// his tile on the Boss raid screen and the elephant on the board.
//   npm run frames:alfil -- <out-dir> [tusks|slam|both] [phone|desktop] [light|dark]
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const [out = "alfil-frames", which = "both", device = "phone", scheme = "light"] = process.argv.slice(2);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const context = device === "desktop" ? { viewport: { width: 1280, height: 800 } } : { ...devices["iPhone 13"] };
const width = device === "desktop" ? 720 : 390;

function gif(dir, file) {
  try {
    // (The screencast sends a frame at twice the size now and then: every frame to the most common size first, or the
    // palette filters stop at the first change.)
    execFileSync("python3", ["-c", "import sys,glob\nfrom collections import Counter\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.jpg'))\nsz=Counter(Image.open(f).size for f in fs).most_common(1)[0][0]\nfor f in fs:\n  i=Image.open(f)\n  if i.size!=sz: i.convert('RGB').resize(sz).save(f)", dir]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", join(dir, "%04d.jpg"), "-vf", `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, file]);
  } catch (e) {
    console.log("gif failed", e.message);
  }
}

async function run(power) {
  const name = `${device}-${scheme}-${power}`;
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
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1, ...(device === "phone" ? { maxWidth: 780, maxHeight: 1688 } : {}) });
  await p.goto(`${url}?debug&clock=60&nolanding&boss=alfil&power=${power}&laststand=0`);
  // Home → Boss raid → Boss alone (with ?boss= in the address, the battle at once).
  await p.getByRole("main").getByRole("button", { name: /^Boss raid/ }).click();
  for (let i = 0; i < 5 && !(await p.evaluate(() => !!window.match)); i++) {
    await p.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await p.waitForTimeout(1500);
  }
  const t0 = Date.now();
  const log = (s) => console.log(`${name} +${Date.now() - t0}ms ${s}`);
  const marks = [];
  const stills = [];
  const st = () =>
    p.evaluate(() => {
      const m = window.match;
      const ph = m?.phase;
      return { kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, until: ph?.until ?? 0, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, now: Date.now() };
    });
  const waitUntil = async (fn, ms = 120_000) => {
    const start = Date.now();
    let s = null;
    while (Date.now() - start < ms) {
      s = await st();
      if (fn(s)) return s;
      await p.waitForTimeout(50);
    }
    await p.screenshot({ path: join(outDir, `${name}-timeout.png`) });
    throw new Error(`${name}: timed out at ${JSON.stringify({ kind: s?.kind, thinking: s?.thinking })}`);
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
  /** A good quiet move now (no capture, no check: so a cast is never countered), the engine's if it can. */
  const quiet = async () => {
    const s = await st();
    const top = await p.evaluate(async (fen) => {
      const m = window.match;
      return await Promise.race([m.runner.topMovesFor(fen).then((t) => t.map((x) => x.move)), new Promise((r) => setTimeout(() => r([]), 8000))]);
    }, s.fen);
    const ok = (mv) => {
      const c = new Chess(s.fen);
      const r = c.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: "q" });
      return r && !r.captured && !c.inCheck() && !c.isGameOver() && mv.length === 4;
    };
    const legal = new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to);
    return [...top, ...legal].find(ok) ?? legal[0];
  };
  const play = async () => {
    await waitUntil((s) => s.kind === "play");
    await p.waitForTimeout(600);
    const move = await quiet();
    for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await p.waitForTimeout(400);
    }
    log(`played ${move}`);
  };
  /** The screen that brings `kind`'s moment, until the crowd's turn after it. */
  const moment = async (label, kind, stillsAt, tail = 600) => {
    const s = await waitUntil((x) => x.kind === "boss" && (x.boss?.powers?.events ?? []).some((e) => e.kind === kind) && (!x.thinking || kind === "land"));
    log(`${label}: events ${s.boss.powers.events.map((e) => e.kind).join(", ")}`);
    for (const ms of stillsAt) stills.push({ label: `${label}-${String(ms).padStart(4, "0")}`, t: s.now + ms });
    const end = await waitUntil((x) => x.kind === "play", 60_000);
    marks.push({ label, from: s.now - 300, to: end.now + tail });
    return s;
  };

  await waitUntil((s) => s.kind === "play", 90_000);
  if (power === "tusks") {
    // His cast comes at the start of his first turn: then a quiet move, and the fusion as his next turn.
    for (let turn = 0; turn < 8; turn++) {
      await play();
      const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && !x.intro, 150_000);
      if ((s.boss.powers.events ?? []).some((e) => e.kind === "tusks")) {
        stills.push(...[0, 1500, 1700, 2000].map((ms) => ({ label: `cast-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const castEnd = await waitUntil((x) => x.kind === "play", 60_000);
        marks.push({ label: "cast", from: s.now - 300, to: castEnd.now + 1500 });
        await p.waitForTimeout(1200);
        await p.screenshot({ path: join(outDir, `${name}-glow.png`) });
        await play();
        const f = await moment("fuse", "fuse", [0, 300, 500, 700, 900, 1000, 1150, 1300, 1450, 1800, 2100], 1500);
        log(`fusion ${JSON.stringify(f.boss.powers.fusion)} elephants ${JSON.stringify(f.boss.powers.elephants)}`);
        await p.waitForTimeout(1000);
        await p.screenshot({ path: join(outDir, `${name}-elephant.png`) });
        const box = await p.locator(".board-wrap").first().boundingBox();
        await p.screenshot({ path: join(outDir, `${name}-elephant-board.png`), clip: box });
        break;
      }
      await waitUntil((x) => x.kind === "play", 60_000);
    }
  } else {
    // The warning as turn 2 begins; the Slam at the start of his turn after your move; three turns up; the landing.
    let slam = null;
    for (let turn = 0; turn < 8 && !slam; turn++) {
      await play();
      const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && !x.intro, 150_000);
      if ((s.boss.powers.events ?? []).some((e) => e.kind === "slam")) {
        slam = s;
        stills.push(...[0, 1500, 1870, 2000, 2200, 2300, 2500, 2700, 3000].map((ms) => ({ label: `slam-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const e = await waitUntil((x) => x.kind === "boss" && x.thinking === false && !(x.boss.powers.events ?? []).some((ev) => ev.kind === "slam") || x.kind === "play", 60_000);
        marks.push({ label: "slam", from: s.now - 300, to: e.now + 1200 });
        log(`slam ${JSON.stringify(s.boss.powers.slam)}`);
      } else await waitUntil((x) => x.kind === "play", 60_000);
    }
    if (slam && slam.boss.powers.slam.pieces.length) {
      for (let k = 0; k < 4; k++) {
        await waitUntil((x) => x.kind === "play", 60_000);
        const s = await st();
        marks.push({ label: `up${k}`, from: s.now, to: s.now + 1500 });
        await p.waitForTimeout(1500);
        await p.screenshot({ path: join(outDir, `${name}-up${k}.png`) });
        if (!s.boss.powers.airborne?.length) break;
        await play();
        // The next screen with the landing in it, or the next turn of yours without one.
        const next = await waitUntil((x) => x.kind === "play" || (x.kind === "boss" && (x.boss?.powers?.events ?? []).some((e) => e.kind === "land") && (!x.thinking || !!x.boss.powers.landed?.early)), 150_000);
        if (next.kind === "boss") {
          await moment("land", "land", [0, 200, 400, 600, 800, 1000, 1300], 1200);
          break;
        }
      }
    } else log("nothing lifted");
  }
  await cdp.send("Page.stopScreencast");
  for (const s of stills) {
    const f = frames.filter((x) => x.t <= s.t).at(-1);
    if (f) writeFileSync(join(outDir, `${name}-${s.label}.jpg`), Buffer.from(f.data, "base64"));
  }
  const sample = (from, to) => {
    const o = [];
    for (let t = from; t <= to; t += 1000 / 12) {
      const f = frames.filter((x) => x.t <= t).at(-1);
      if (f) o.push(f);
    }
    return o;
  };
  const dir = join(outDir, `${name}-tick`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ticks = marks.sort((a, b) => a.from - b.from).flatMap((m) => sample(m.from, m.to));
  ticks.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
  log(`screencast ${frames.length} frames (${Math.round(frames[0]?.t - t0)} .. ${Math.round(frames.at(-1)?.t - t0)} ms), ${ticks.length} in the GIF; marks ${marks.map((m) => `${m.label} ${m.from - t0}..${m.to - t0}`).join(", ")}`);
  gif(dir, join(outDir, `${name}.gif`));
  rmSync(dir, { recursive: true, force: true });
  log(`${marks.map((m) => m.label).join(", ")}; ${errors.length} page errors`);
  await p.close();
}

/** His tile on the Boss raid screen, picked: the stage draws him full size. */
async function tile() {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  await p.goto(`${url}?mode=raid&nolanding`);
  await p.getByRole("heading", { name: "Boss raid", exact: true }).waitFor();
  await p.getByRole("radio", { name: "Alfil" }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(outDir, `${device}-${scheme}-select.png`) });
  await p.close();
}

if (which === "tile" || which === "both") await tile();
if (which === "tusks" || which === "both") await run("tusks");
if (which === "slam" || which === "both") await run("slam");
await browser.close();
await server.close();
