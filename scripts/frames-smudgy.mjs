// Smudgy frame by frame in a real solo match (Boss alone), on a phone (390 px wide) or a computer, with real taps:
// the opening's splash (his two forced moves, then the paint over his pawn row, the swap under it), his reveal (the
// hidden rook strikes: the paint drips off it), the rook taken (your move takes it), a Repaint (?power=repaint), his
// attack on a king in the God King's Last Stand (?laststand=1), and his tile on the Boss raid screen. Records every
// painted frame (Chrome's screencast), saves a GIF of each moment and stills through them.
//   npm run frames:smudgy -- <out-dir> [camo|strike|taken|repaint|attack|tile|all] [phone|desktop] [light|dark] [width]
// The masked board is what the page draws; the script reads the true position from the game (window.match) only to pick
// moves (never the hidden rook's square, so a strike can come) and to say, in the log, where the rook was.
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const argv = process.argv.slice(2);
const [out = "smudgy-frames", which = "all", device = "phone", scheme = "light", widthArg = ""] = argv;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const wide = Number(widthArg) || (device === "desktop" ? 1280 : 390);
const context = device === "desktop" ? { viewport: { width: wide, height: 800 } } : { ...devices["iPhone 13"], viewport: { width: wide, height: 844 } };
const gifWidth = device === "desktop" ? 720 : 390;

function gif(dir, file) {
  try {
    execFileSync("python3", ["-c", "import sys,glob\nfrom collections import Counter\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.jpg'))\nsz=Counter(Image.open(f).size for f in fs).most_common(1)[0][0]\nfor f in fs:\n  i=Image.open(f)\n  if i.size!=sz: i.convert('RGB').resize(sz).save(f)", dir]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", join(dir, "%04d.jpg"), "-vf", `scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, file]);
  } catch (e) {
    console.log("gif failed", e.message);
  }
}

async function run(stage) {
  const name = `${device}${widthArg ? widthArg : ""}-${scheme}-${stage}`;
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
  const query = stage === "repaint" ? "&power=repaint" : stage === "attack" ? "&laststand=1" : "&laststand=0";
  await p.goto(`${url}?debug&clock=60&nolanding&brain=stockfish&boss=smudgy${query}`);
  await p.getByRole("main").getByRole("button", { name: /^Boss raid/ }).click();
  for (let i = 0; i < 5 && !(await p.evaluate(() => !!window.match)); i++) {
    await p.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await p.waitForTimeout(1500);
  }
  const t0 = Date.now();
  const log = (s) => console.log(`${name} +${Date.now() - t0}ms ${s}`);
  const gifs = [];
  const stills = [];
  const st = () =>
    p.evaluate(() => {
      const m = window.match;
      const ph = m?.phase;
      return { kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, now: Date.now() };
    });
  const waitUntil = async (fn, ms = 150_000) => {
    const start = Date.now();
    let s = null;
    while (Date.now() - start < ms) {
      s = await st();
      if (fn(s)) return s;
      await p.waitForTimeout(40);
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
  /** Your move now: a quiet, allowed one (a knight first), never onto the hidden rook (so it can strike), unless `take`. */
  const pick = async (take = false) => {
    const s = await st();
    const camo = s.boss?.powers?.camo;
    const allowed = s.boss?.powers?.allowed ?? null;
    const legal = new Chess(s.fen).moves({ verbose: true }).filter((m) => !m.promotion);
    const ok = legal.filter((m) => !allowed || allowed.includes(m.from + m.to));
    if (take && camo?.square) {
      const grab = ok.find((m) => m.to === camo.square);
      if (grab) return grab.from + grab.to;
    }
    const quiet = ok.filter((m) => !m.captured && (!camo?.square || m.to !== camo.square) && !/[+#]/.test(m.san));
    const safe = quiet.filter((m) => m.from[0] !== "d" && m.from[0] !== "e");
    const m = safe.find((x) => x.piece === "n") ?? safe[0] ?? quiet[0] ?? ok[0] ?? legal[0];
    return m.from + m.to;
  };
  const play = async (take = false) => {
    await waitUntil((s) => s.kind === "play");
    await p.waitForTimeout(500);
    const move = await pick(take);
    const before = await st();
    for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await p.waitForTimeout(400);
    }
    log(`played ${move}`);
    return { move, at: before.now };
  };
  const clip = (label, from, to) => gifs.push({ label, from, to });

  await waitUntil((s) => s.kind === "play", 90_000);
  if (stage === "camo") {
    for (let turn = 0; turn < 8; turn++) {
      await play();
      const s = await waitUntil((x) => (x.kind === "boss" && !x.thinking && (x.boss?.powers?.events ?? []).some((e) => e.kind === "camouflage")) || x.kind === "play", 150_000);
      if (s.kind === "boss") {
        log(`camouflage: rook was on ${s.boss.powers.camo.swap.rook}, hides on ${s.boss.powers.camo.square}`);
        stills.push(...[0, 800, 1500, 1900, 2100, 2300, 2500, 2900, 3200, 3500].map((ms) => ({ label: `camo-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const e = await waitUntil((x) => x.kind === "play", 60_000);
        clip("camo", s.now - 600, e.now + 1500);
        await p.waitForTimeout(800);
        await p.screenshot({ path: join(outDir, `${name}-after.png`) });
        break;
      }
      await waitUntil((x) => x.kind === "play", 60_000);
    }
  } else if (stage === "strike" || stage === "taken") {
    const want = (c) => (stage === "strike" ? c?.reveal && c.reveal.how !== "taken" : c?.reveal?.how === "taken");
    for (let turn = 0; turn < 40; turn++) {
      const s0 = await st();
      if (want(s0.boss?.powers?.camo)) break;
      const played = await play(stage === "taken");
      const next = await waitUntil((x) => x.kind === "play" || x.kind === "results" || (x.kind === "boss" && !x.thinking), 150_000);
      const c = next.boss?.powers?.camo;
      if (want(c)) {
        log(`${stage}: ${JSON.stringify(c.reveal)}`);
        if (stage === "taken") {
          stills.push(...[0, 150, 300, 600, 900, 1200].map((ms) => ({ label: `taken-${String(ms).padStart(4, "0")}`, t: played.at + 600 + ms })));
          clip("taken", played.at - 200, played.at + 4500);
        } else {
          stills.push(...[0, 200, 400, 600, 800, 1000, 1300, 1800, 2300].map((ms) => ({ label: `strike-${String(ms).padStart(4, "0")}`, t: next.now + ms })));
          const e = await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
          clip("strike", next.now - 600, e.now + 1500);
        }
        await p.waitForTimeout(1500);
        break;
      }
      if (next.kind === "results") break;
    }
  } else if (stage === "repaint") {
    for (let turn = 0; turn < 12; turn++) {
      await play();
      const s = await waitUntil((x) => (x.kind === "boss" && !x.thinking && (x.boss?.powers?.events ?? []).some((e) => e.kind === "repaint")) || x.kind === "play" || x.kind === "results", 150_000);
      if (s.kind === "boss") {
        log(`repaint ${JSON.stringify(s.boss.powers.repaint)}`);
        stills.push(...[0, 800, 1500, 1700, 1900, 2000, 2200, 2500, 2900].map((ms) => ({ label: `repaint-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const e = await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
        clip("repaint", s.now - 600, e.now + 1500);
        break;
      }
      await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
    }
  } else if (stage === "attack") {
    await p.waitForTimeout(600);
    const fen = (await st()).fen;
    const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "n");
    for (let i = 0; i < 4 && (await st()).kind === "play"; i++) {
      await tap(mv.from);
      await tap(mv.to);
      await p.waitForTimeout(400);
    }
    const t = Date.now();
    await p.locator(".last-stand").waitFor({ timeout: 30_000 });
    const standAt = Number(await p.locator(".last-stand").getAttribute("data-start"));
    log("last stand started");
    const attackAt = standAt + 6550;
    stills.push(...[560, 740, 980, 1460, 1500, 1620, 2300].map((ms) => ({ label: `attack-${String(ms).padStart(4, "0")}`, t: attackAt + ms })));
    await waitUntil((x) => x.kind === "play", 60_000);
    clip("attack", attackAt - 600, attackAt + 3400);
    void t;
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
  for (const g of gifs) {
    const dir = join(outDir, `${name}-${g.label}-tick`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    sample(g.from, g.to).forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
    gif(dir, join(outDir, `${name}-${g.label}.gif`));
    rmSync(dir, { recursive: true, force: true });
  }
  log(`${gifs.map((g) => g.label).join(", ")}; ${errors.length} page errors`);
  await p.close();
}

/** His tile on the Boss raid screen, picked: the stage draws him full size. */
async function tile() {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  await p.goto(`${url}?mode=raid&nolanding`);
  await p.getByRole("heading", { name: "Boss raid", exact: true }).waitFor();
  await p.getByRole("radio", { name: "Smudgy" }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(outDir, `${device}${widthArg ? widthArg : ""}-${scheme}-select.png`) });
  await p.close();
}

for (const s of ["tile", "camo", "strike", "taken", "repaint", "attack"]) if (which === s || which === "all") await (s === "tile" ? tile() : run(s));
await browser.close();
await server.close();
