// Chub & Chirp frame by frame in a real solo match (Boss alone), on a phone (390 px wide) or a computer, with real taps:
// their Leapfrog hop (?power=leapfrog: a hop due on his first turn), or their Carrot Patch (?power=carrotpatch: the cast
// at the start of his first turn) through the race to his spin. Records every painted frame (Chrome's screencast) and
// saves a GIF of each moment (the hop; the cast with its ladder; your pull and his; the spin, named by his tier), stills
// through them, and his tile on the Boss raid screen.
//   npm run frames:hopper -- <out-dir> [hop|carrots|tile|all] [phone|desktop] [light|dark] [chase|ignore] [carrots=N]
// `chase`: your moves go for the carrots (a pull when one is a move away, else the judge's best, which weighs the race),
// so his tier is low; `ignore`: moves that never pull one, so his tier is high. `carrots=N` (the test switch, 0 to 5):
// N carrots a step from his pieces and out of your reach, the rest a step from yours (with `chase`, his spin on N).
// Read the frames before calling a moment done (.claude/LESSONS.md: watch it frame by frame).
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const argv = process.argv.slice(2);
const carrots = argv.find((a) => a.startsWith("carrots="))?.slice(8) ?? "";
const [out = "hopper-frames", which = "all", device = "phone", scheme = "light", strategy = "chase"] = argv.filter((a) => !a.startsWith("carrots="));
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const context = device === "desktop" ? { viewport: { width: 1280, height: 800 } } : { ...devices["iPhone 13"] };
const width = device === "desktop" ? 720 : 390;

function gif(dir, file) {
  try {
    execFileSync("python3", ["-c", "import sys,glob\nfrom collections import Counter\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.jpg'))\nsz=Counter(Image.open(f).size for f in fs).most_common(1)[0][0]\nfor f in fs:\n  i=Image.open(f)\n  if i.size!=sz: i.convert('RGB').resize(sz).save(f)", dir]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "12", "-i", join(dir, "%04d.jpg"), "-vf", `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse`, file]);
  } catch (e) {
    console.log("gif failed", e.message);
  }
}

async function run(power) {
  const name = `${device}-${scheme}-${power}${power === "carrotpatch" ? `-${strategy}${carrots ? `-c${carrots}` : ""}` : ""}`;
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
  await p.goto(`${url}?debug&clock=60&nolanding&boss=hopper&power=${power}&laststand=0${carrots ? `&carrots=${carrots}` : ""}`);
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
  const waitUntil = async (fn, ms = 120_000) => {
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
  /** Your move now: by the strategy (see the header), never one that ends the battle; no capture or check if it can. */
  const pick = async () => {
    const s = await st();
    const c = s.boss?.powers?.carrots;
    const open = c ? c.squares.filter((_, i) => !c.by[i]) : [];
    const raceOn = !!c && !c.over;
    const top = await p.evaluate(async (fen) => {
      const m = window.match;
      return await Promise.race([m.runner.topMovesFor(fen).then((t) => t.map((x) => x.move)), new Promise((r) => setTimeout(() => r([]), 8000))]);
    }, s.fen);
    const legal = new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to);
    const ok = (mv, quiet) => {
      const ch = new Chess(s.fen);
      const r = ch.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: "q" });
      return r && !ch.isGameOver() && mv.length === 4 && (!quiet || (!r.captured && !ch.inCheck()));
    };
    if (raceOn && strategy === "chase") {
      const pull = legal.find((mv) => open.includes(mv.slice(2, 4)) && ok(mv, false));
      if (pull) return pull;
      return [...top, ...legal].find((mv) => ok(mv, false)) ?? legal[0];
    }
    const away = (mv) => !open.includes(mv.slice(2, 4));
    return [...top, ...legal].find((mv) => ok(mv, false) && away(mv)) ?? legal[0];
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

  await waitUntil((s) => s.kind === "play", 90_000);
  if (power === "leapfrog") {
    for (let turn = 0; turn < 6; turn++) {
      await play();
      const s = await waitUntil((x) => (x.kind === "boss" && !x.thinking && !x.intro) || x.kind === "play", 150_000);
      if (s.kind === "boss" && (s.boss.powers.events ?? []).at(-1)?.kind === "hop") {
        log(`hop ${JSON.stringify(s.boss.powers.hop)}`);
        stills.push(...[0, 500, 700, 800, 880, 960, 1050, 1300].map((ms) => ({ label: `hop-${String(ms).padStart(4, "0")}`, t: s.now + ms })));
        const e = await waitUntil((x) => x.kind === "play", 60_000);
        clip("hop", s.now - 400, e.now + 800);
        break;
      }
      await waitUntil((x) => x.kind === "play", 60_000);
    }
  } else {
    // The cast comes at the start of his first turn.
    await play();
    const cast = await waitUntil((x) => x.kind === "boss" && !x.thinking && (x.boss?.powers?.events ?? []).some((e) => e.kind === "carrots"), 150_000);
    log(`cast ${JSON.stringify(cast.boss.powers.carrots.squares)}`);
    stills.push(...[300, 1000, 1200, 1500, 1800, 2200, 2500, 3500].map((ms) => ({ label: `cast-${String(ms).padStart(4, "0")}`, t: cast.now + ms })));
    const castEnd = await waitUntil((x) => x.kind === "play", 60_000);
    clip("cast", cast.now - 300, castEnd.now + 1500);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(outDir, `${name}-race.png`) });
    let yours = false;
    let his = false;
    for (let turn = 0; turn < 20; turn++) {
      const s0 = await st();
      const c0 = s0.boss.powers.carrots;
      if (c0.spin || c0.over === "won" || s0.kind === "results") break;
      const plies = s0.boss.board.history.length;
      const played = await play();
      // Your pull: as your move lands, while he thinks.
      const after = await waitUntil((x) => x.kind === "results" || (x.boss?.board.history.length ?? 0) > plies, 20_000);
      const c1 = after.boss?.powers?.carrots;
      if (c1 && c1.crowd > c0.crowd && !yours) {
        yours = true;
        log(`your pull ${JSON.stringify(c1.squares.filter((_, i) => c1.by[i] === "crowd"))}`);
        clip("pull-yours", played.at - 200, after.now + 2200);
        stills.push(...[0, 150, 300, 500, 800].map((ms) => ({ label: `yours-${String(ms).padStart(4, "0")}`, t: after.now + ms })));
      }
      const next = await waitUntil((x) => x.kind === "play" || x.kind === "results" || (x.kind === "boss" && !x.thinking), 150_000);
      if (next.kind === "boss") {
        const ev = next.boss.powers.events ?? [];
        if (!his && ev.some((e) => e.kind === "carrot" && e.by === "boss")) {
          his = true;
          const e = await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
          clip("pull-his", next.now - 300, e.now + 1200);
        }
        const spin = ev.find((e) => e.kind === "carrotSpin");
        if (spin) {
          log(`spin tier ${spin.tier} prize ${JSON.stringify(spin.prize)} rolled ${JSON.stringify(next.boss.powers.carrots.spin?.rolled)}`);
          stills.push(...[500, 1200, 2000, 3000, 3600, 4000, 4100, 4500, 4800].map((ms) => ({ label: `spin-t${spin.tier}-${String(ms).padStart(4, "0")}`, t: next.now + ms })));
          const e = await waitUntil((x) => x.kind === "play" || x.kind === "results", 60_000);
          clip(`spin-tier${spin.tier}`, next.now - 300, e.now + 1500);
          break;
        }
        if (ev.some((e) => e.kind === "carrotWin")) {
          const e = await waitUntil((x) => x.kind === "results", 60_000);
          clip("carrot-win", next.now - 300, e.now + 2500);
          break;
        }
      }
      if (next.kind === "results") break;
    }
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
  await p.getByRole("radio", { name: "Chub & Chirp" }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(outDir, `${device}-${scheme}-select.png`) });
  await p.close();
}

if (which === "tile" || which === "all") await tile();
if (which === "hop" || which === "all") await run("leapfrog");
if (which === "carrots" || which === "all") await run("carrotpatch");
await browser.close();
await server.close();
