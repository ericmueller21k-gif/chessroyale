// Puddles, the hippo gardener, frame by frame in a real solo match (Boss alone), on a phone (390 px wide) or a computer, with real taps:
// the opening's five seeds tossed and his seed meter (the first crowd turn); seeds landing one by one on the meter (?seedspeed=N runs the
// page's garden clock N times faster, a test switch, so no 30 s wait); a watering (?power=water&seeds=10: the sweep, the sprouts, each
// outcome); the plain plants through their turns and a move refused for one ("A plant is in the way."); his attack on a king in the God
// King's Last Stand (?laststand=1); and his select tile. Records every painted frame (Chrome's screencast), saves a GIF of each moment and
// stills through them.
//   node scripts/frames-gardener.mjs <out-dir> [tile|opening|seeds|water|plants|attack|bar|all] [phone|desktop] [light|dark] [width] [fen]
// `fen` (water, plants): his army short a pawn, a bishop, a knight and the queen when the battle starts (set from the page, for the GIF
// only: a position where a grown piece can come up at the first watering), so the outcomes can include pieces.
// The page draws what a player sees; the script reads the game (window.match) only to pick moves and to say, in the log, what the rules
// did. Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const argv = process.argv.slice(2);
const [out = "gardener-frames", which = "all", device = "phone", scheme = "light", widthArg = "", withFen = ""] = argv;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const wide = Number(widthArg) || (device === "desktop" ? 1280 : 390);
const context = device === "desktop" ? { viewport: { width: wide, height: 800 } } : { ...devices["iPhone 13"], viewport: { width: wide, height: 844 } };
const gifWidth = device === "desktop" ? 720 : Math.min(390, wide);
/** His army short a pawn, a bishop, a knight and the queen (a grown piece can come up); the crowd's whole. */
const SHORT_FEN = "rn2kb1r/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function gif(dir, file, fps = 12) {
  try {
    execFileSync("python3", ["-c", "import sys,glob\nfrom collections import Counter\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.jpg'))\nsz=Counter(Image.open(f).size for f in fs).most_common(1)[0][0]\nfor f in fs:\n  i=Image.open(f)\n  if i.size!=sz: i.convert('RGB').resize(sz).save(f)", dir]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%04d.jpg"), "-vf", `scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse`, file]);
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
  const query = stage === "water" || stage === "plants" ? "&power=water&seeds=10&laststand=0" : stage === "seeds" ? "&seedspeed=10&laststand=0" : stage === "attack" ? "&laststand=1" : "&laststand=0";
  await p.goto(`${url}?debug&clock=60&nolanding&brain=stockfish&boss=gardener${query}`);
  await p.getByRole("main").getByRole("button", { name: /^Boss raid/ }).click();
  const t0 = Date.now();
  await p.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  const log = (s) => console.log(`${name} +${Date.now() - t0}ms ${s}`);
  const gifs = [];
  const stills = [];
  const st = () =>
    p.evaluate(() => {
      const m = window.match;
      const ph = m?.phase;
      return { kind: ph?.kind ?? null, intro: !!ph?.intro, thinking: !!ph?.thinking, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, boss: m?.boss ?? null, now: Date.now(), until: ph?.until ?? 0 };
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
  /** Your move now: a quiet, allowed one (a knight first), never onto a plant or a capture that gives him pieces. */
  const pick = async () => {
    const s = await st();
    const allowed = s.boss?.powers?.allowed ?? null;
    const legal = new Chess(s.fen).moves({ verbose: true }).filter((m) => !m.promotion);
    const ok = legal.filter((m) => !allowed || allowed.includes(m.from + m.to));
    const quiet = ok.filter((m) => !m.captured && !/[+#]/.test(m.san));
    const safe = quiet.filter((m) => m.from[0] !== "d" && m.from[0] !== "e");
    const m = safe.find((x) => x.piece === "n") ?? safe[0] ?? quiet[0] ?? ok[0] ?? legal[0];
    return m.from + m.to;
  };
  const play = async (move) => {
    await waitUntil((s) => s.kind === "play");
    await p.waitForTimeout(450);
    move = move ?? (await pick());
    const before = await st();
    for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await p.waitForTimeout(350);
    }
    log(`played ${move}`);
    return { move, at: before.now };
  };
  const clip = (label, from, to, fps = 12) => gifs.push({ label, from, to, fps });
  const has = (s, kind) => (s.boss?.powers?.events ?? []).some((e) => e.kind === kind);
  /** Starts every battle with his army short (the GIF's position): the board's record, before the first move. */
  const shorten = async () => {
    await p.evaluate((fen) => {
      const b = window.match.runner.boards.get(0);
      window.match.runner.boards.set(0, { ...b, fen, history: [], bases: [{ ply: 0, fen }] });
    }, SHORT_FEN);
    await p.waitForTimeout(300);
  };

  if (stage === "opening") {
    // The first crowd turn: the opening's five seeds tossed (his plant animation, the seeds arcing from his hand into the board's middle), his word, the meter.
    const s = await waitUntil((x) => x.kind === "play", 90_000);
    log(`play begins; events ${JSON.stringify((s.boss?.powers?.events ?? []).map((e) => e.kind))}`);
    clip("opening", s.now - 400, s.now + 6500);
    stills.push(...[0, 250, 450, 650, 850, 1100, 1400, 2000, 3000].map((ms) => ({ label: `opening-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
    await p.waitForTimeout(7000);
  } else if (stage === "seeds") {
    // The page's garden clock ten times faster: a seed every 3 s. Stay on the first crowd turn and watch the meter rise and the toss.
    const s = await waitUntil((x) => x.kind === "play", 90_000);
    clip("seeds", s.now - 300, s.now + 11000);
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(2900);
      log(`meter ${await p.locator(".seed-meter").getAttribute("data-seeds")} / fill ${await p.locator(".seed-meter").getAttribute("data-fill")}`);
    }
    stills.push(...[2500, 3200, 3400, 3600, 4000, 6000, 6400].map((ms) => ({ label: `seeds-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
    await p.waitForTimeout(3500);
  } else if (stage === "water" || stage === "plants") {
    await waitUntil((s) => s.kind === "play", 90_000);
    if (withFen) await shorten();
    let waterAt = 0;
    let waterEnd = 0;
    let growth = null;
    for (let turn = 0; turn < 12; turn++) {
      await play();
      const s = await waitUntil((x) => x.kind === "play" || (x.kind === "boss" && !x.thinking && has(x, "water")) || x.kind === "results", 150_000);
      if (s.kind === "play") continue;
      if (s.kind !== "boss") break;
      waterAt = s.now;
      waterEnd = s.until;
      growth = s.boss.powers.events.find((e) => e.kind === "water").growth;
      log(`the watering: ${growth.map((g) => `${g.kind}@${g.square}${g.ate ? `(ate ${g.ate}${g.own ? ", his own" : ""})` : ""}`).join(" ")}`);
      stills.push(...[0, 300, 500, 700, 900, 1100, 1300, 1500, 1800, 2100, 2500, 3000, 3600, 4300, 5000].map((ms) => ({ label: `water-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
      break;
    }
    if (waterAt && stage === "water") {
      await waitUntil((x) => x.kind === "play", 60_000);
      await p.waitForTimeout(1200);
      clip("water", waterAt - 600, Math.max(waterEnd, waterAt + 3000) + 1600);
    } else if (waterAt) {
      // The plants through their turns: the crowd's turn after the watering (green), then the next (fall), the next (drop), then gone.
      const turnFrom = Date.now();
      let n = 0;
      for (; n < 5; n++) {
        const s = await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
        if (s.kind !== "play") break;
        await p.waitForTimeout(900);
        const left = await p.evaluate(() => (window.match.boss?.powers?.garden?.plants ?? []).map((x) => `${x.square}:${x.left}`).join(" "));
        log(`turn ${n + 1} after the watering: plants ${left || "(none)"}`);
        stills.push({ label: `plants-turn${n + 1}`, t: Date.now() });
        if (n === 0) {
          // A move onto or through a plant: refused, the dock says why, and pick again.
          const plants = await p.evaluate(() => (window.match.boss?.powers?.garden?.plants ?? []).map((x) => x.square));
          const fen = s.fen;
          const allowed = s.boss.powers.allowed ?? [];
          const stopped = new Chess(fen).moves({ verbose: true }).find((m) => !allowed.includes(m.from + m.to) && !m.promotion);
          if (stopped && plants.length) {
            const refusedAt = Date.now();
            await tap(stopped.from);
            await p.waitForTimeout(300);
            await tap(stopped.to);
            await p.waitForTimeout(700);
            log(`tried ${stopped.from}${stopped.to}: the dock says "${await p.locator(".refused-note").first().textContent({ timeout: 400 }).catch(() => "(nothing)")}"`);
            stills.push({ label: "refused", t: Date.now() });
            await p.waitForTimeout(1300);
            clip("refused", refusedAt - 800, Date.now() + 300);
          }
        }
        await play();
        if (n >= 3) break;
      }
      await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
      await p.waitForTimeout(1800);
      clip("plants", waterAt + 2500, Date.now(), 8);
      log(`${n + 1} turns`);
    }
  } else if (stage === "attack") {
    await waitUntil((s) => s.kind === "play", 90_000);
    await p.waitForTimeout(600);
    const fen = (await st()).fen;
    const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "n");
    for (let i = 0; i < 4 && (await st()).kind === "play"; i++) {
      await tap(mv.from);
      await tap(mv.to);
      await p.waitForTimeout(400);
    }
    await p.locator(".last-stand").waitFor({ timeout: 30_000 });
    const standAt = Number(await p.locator(".last-stand").getAttribute("data-start"));
    log("last stand started");
    const attackAt = standAt + 6550;
    stills.push(...[560, 740, 980, 1460, 1500, 1620, 2300].map((ms) => ({ label: `attack-${String(ms).padStart(4, "0")}`, t: attackAt + ms })));
    await waitUntil((x) => x.kind === "play", 60_000);
    clip("attack", attackAt - 600, attackAt + 3400);
  } else if (stage === "bar") {
    // His bar with the seed meter, after his opening line is gone.
    await waitUntil((s) => s.kind === "play", 90_000);
    await p.waitForTimeout(9000);
    await p.locator(".boss-bar").screenshot({ path: join(outDir, `${name}-bar.png`) });
    await p.screenshot({ path: join(outDir, `${name}-screen.png`) });
  }
  await p.waitForTimeout(300);
  await cdp.send("Page.stopScreencast");
  for (const s of stills) {
    const f = frames.filter((x) => x.t <= s.t).at(-1);
    if (f) writeFileSync(join(outDir, `${name}-${s.label}.jpg`), Buffer.from(f.data, "base64"));
  }
  const sample = (from, to, fps) => {
    const o = [];
    for (let t = from; t <= to; t += 1000 / fps) {
      const f = frames.filter((x) => x.t <= t).at(-1);
      if (f) o.push(f);
    }
    return o;
  };
  for (const g of gifs) {
    const dir = join(outDir, `${name}-${g.label}-tick`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    sample(g.from, g.to, g.fps).forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(f.data, "base64")));
    gif(dir, join(outDir, `${name}-${g.label}.gif`), g.fps);
    rmSync(dir, { recursive: true, force: true });
  }
  log(`${gifs.map((g) => g.label).join(", ")}; ${errors.length} page errors`);
  await p.close();
}

/** His tile on the Boss raid screen, picked: the stage draws him full size, his line over him. */
async function tile() {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  await p.goto(`${url}?mode=raid&nolanding`);
  await p.getByRole("heading", { name: "Boss raid", exact: true }).waitFor();
  await p.getByRole("radio", { name: "Puddles" }).click();
  await p.waitForTimeout(2200);
  await p.screenshot({ path: join(outDir, `${device}${widthArg ? widthArg : ""}-${scheme}-select.png`) });
  await p.close();
}

for (const s of ["tile", "opening", "seeds", "bar", "water", "plants", "attack"]) if (which === s || which === "all") await (s === "tile" ? tile() : run(s));
await browser.close();
await server.close();
