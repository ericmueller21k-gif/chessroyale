// Moo & Moon frame by frame in a real solo match (Boss alone), on a phone (390 px wide) or a computer, with real taps: a moonbeam
// landing on one of your pieces (?power=moonbeam), the stunned piece refused ("Moonlight holds that piece."), the beam fading as
// your move lands; the Full Moon (?power=fullmoon: the transformation, the flurry of five beams, his powered-up moves, the
// daze); his entrance with its line and icons; his attack on a king in the God King's Last Stand (?laststand=1); and his tile on
// the Boss raid screen. Records every painted frame (Chrome's screencast), saves a GIF of each moment and stills through them.
//   npm run frames:moo -- <out-dir> [tile|beam|full|intro|attack|all] [phone|desktop] [light|dark] [width]
// The page draws what a player sees; the script reads the game (window.match) only to pick moves and to say, in the log, what
// the rules did. Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const argv = process.argv.slice(2);
const [out = "moo-frames", which = "all", device = "phone", scheme = "light", widthArg = ""] = argv;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const wide = Number(widthArg) || (device === "desktop" ? 1280 : 390);
const context = device === "desktop" ? { viewport: { width: wide, height: 800 } } : { ...devices["iPhone 13"], viewport: { width: wide, height: 844 } };
const gifWidth = device === "desktop" ? 720 : Math.min(390, wide);

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
  const query = stage === "beam" ? "&power=moonbeam&laststand=0" : stage === "full" ? "&power=fullmoon&laststand=0" : stage === "attack" ? "&laststand=1" : "&laststand=0";
  await p.goto(`${url}?debug&clock=60&nolanding&brain=stockfish&boss=moo${query}`);
  await p.getByRole("main").getByRole("button", { name: /^Boss raid/ }).click();
  const t0 = Date.now();
  for (let i = 0; i < 5 && !(await p.evaluate(() => !!window.match)); i++) {
    await p.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await p.waitForTimeout(1500);
  }
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
  /** Your move now: a quiet, allowed one (a knight first). */
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
  const play = async () => {
    await waitUntil((s) => s.kind === "play");
    await p.waitForTimeout(500);
    const move = await pick();
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
  const has = (s, kind) => (s.boss?.powers?.events ?? []).some((e) => e.kind === kind);

  if (stage === "intro") {
    // His entrance: his drop, his moo and the Moon's line with its icon typing out in the bar's bubble.
    await waitUntil((s) => s.kind === "boss" && s.intro, 90_000);
    const s = await st();
    clip("intro", s.now - 300, s.now + 9500);
    stills.push(...[1500, 2500, 3500, 4500, 5500, 6500].map((ms) => ({ label: `intro-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
    await p.waitForTimeout(10_000);
  } else if (stage === "beam") {
    await waitUntil((s) => s.kind === "play", 90_000);
    for (let turn = 0; turn < 8; turn++) {
      await play();
      const s = await waitUntil((x) => (x.kind === "boss" && !x.thinking && has(x, "moonbeam")) || x.kind === "results", 150_000);
      if (s.kind !== "boss") break;
      const sq = s.boss.powers.stunned[0];
      log(`moonbeam on ${sq}: ${JSON.stringify(s.boss.powers.stunned)}`);
      stills.push(...[0, 300, 500, 700, 900, 1100, 1500].map((ms) => ({ label: `beam-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
      const play1 = await waitUntil((x) => x.kind === "play", 60_000);
      await p.waitForTimeout(700);
      // The stunned piece: pick it up and try one of its moves: it stays, and the dock says why.
      const moves = new Chess(play1.fen).moves({ verbose: true }).filter((m) => m.from === sq);
      const tried = moves.find((m) => !m.captured) ?? moves[0];
      let triedAt = 0;
      if (tried) {
        await tap(tried.from);
        await p.waitForTimeout(250);
        await tap(tried.to);
        triedAt = Date.now();
        await p.waitForTimeout(500);
        await p.screenshot({ path: join(outDir, `${name}-refused.png`) });
        log(`tried ${tried.from}${tried.to}: ${await p.locator(".refused-note").first().textContent().catch(() => "(no note)")}`);
      }
      await p.waitForTimeout(1800);
      // Then a move that's allowed; the beam fades as it lands.
      const move = await pick();
      const moved = Date.now();
      for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
        await tap(move.slice(0, 2));
        await tap(move.slice(2, 4));
        await p.waitForTimeout(300);
      }
      stills.push(...[0, 150, 300, 450].map((ms) => ({ label: `fade-${String(ms).padStart(4, "0")}`, t: moved + ms })));
      const e = await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
      clip("moonbeam", s.now - 800, Math.max(triedAt, moved) + 2200);
      void e;
      await p.waitForTimeout(1500);
      break;
    }
  } else if (stage === "full") {
    await waitUntil((s) => s.kind === "play", 90_000);
    let startAt = 0;
    let flurryAt = 0;
    let dazedAt = 0;
    for (let turn = 0; turn < 30; turn++) {
      await play();
      const s = await waitUntil((x) => x.kind === "play" || x.kind === "results" || (x.kind === "boss" && (has(x, "flurry") || has(x, "dazed") || (x.thinking && has(x, "fullMoon")))), 150_000);
      if (s.kind === "boss" && s.thinking && has(s, "fullMoon") && !startAt) {
        startAt = s.now;
        log("the Full Moon comes");
        stills.push(...[0, 300, 500, 700, 900, 1200].map((ms) => ({ label: `full-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const n = await waitUntil((x) => x.kind === "boss" && !x.thinking, 30_000);
        log(`his move, the flurry: ${JSON.stringify(n.boss.powers.stunned)}`);
        flurryAt = n.now;
        stills.push(...[0, 300, 500, 700, 900, 1100, 1400, 1800].map((ms) => ({ label: `flurry-${String(ms).padStart(4, "0")}`, t: n.now + ms })));
        await waitUntil((x) => x.kind === "play", 30_000);
      } else if (s.kind === "boss" && has(s, "dazed") && !s.thinking && !dazedAt) {
        dazedAt = s.now;
        log("dazed");
        stills.push(...[0, 400, 800, 1200, 1600, 2000].map((ms) => ({ label: `dazed-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const e = await waitUntil((x) => x.kind === "play" || x.kind === "results", 30_000);
        void e;
        await p.waitForTimeout(1200);
        break;
      } else if (s.kind === "boss") await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
      if (s.kind === "results") break;
    }
    if (startAt) {
      clip("full-moon", startAt - 200, flurryAt + 4200);
      if (dazedAt) clip("dazed", dazedAt - 900, dazedAt + 3800);
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

/** His tile on the Boss raid screen, picked: the stage draws him full size, his line with its icon over him. */
async function tile() {
  const p = await browser.newPage({ ...context, colorScheme: scheme });
  await p.goto(`${url}?mode=raid&nolanding`);
  await p.getByRole("heading", { name: "Boss raid", exact: true }).waitFor();
  await p.getByRole("radio", { name: "Moo & Moon" }).click();
  await p.waitForTimeout(2200);
  await p.screenshot({ path: join(outDir, `${device}${widthArg ? widthArg : ""}-${scheme}-select.png`) });
  await p.close();
}

for (const s of ["tile", "beam", "full", "intro", "attack"]) if (which === s || which === "all") await (s === "tile" ? tile() : run(s));
await browser.close();
await server.close();
