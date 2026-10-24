// Babur, the circus tiger, frame by frame in a real solo match (Boss alone), on a phone (390 px wide unless given) or a computer, with
// real taps: a balloon put on the pump (his hop along a phone's bar, or the limp balloon tossed from his paw on a computer); a balloon
// growing stage by stage (?seedspeed=N runs the page's battle clock N times faster, a test switch, so no 30 s stages); a landing
// (?balloon=pawn&stage=4: the release, the flight, the landing and his piece appearing); a pop (?balloon=fakequeen&stage=4) and his wince;
// a hoops cast (?power=hoops), a move refused through a ring ("A burning hoop is in the way.") and the rings going out; his attack on a
// king in the God King's Last Stand (?laststand=1); his select tile; the bar. Records every painted frame (Chrome's screencast), saves a
// GIF of each moment and stills through them.
//   node scripts/frames-tiger.mjs <out-dir> [tile|place|grow|land|pop|hoops|attack|bar|all] [phone|desktop] [light|dark] [width]
// The page draws what a player sees; the script reads the game (window.match) only to pick moves and to say, in the log, what the rules did.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";

const argv = process.argv.slice(2);
const [out = "tiger-frames", which = "all", device = "phone", scheme = "light", widthArg = ""] = argv;
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const wide = Number(widthArg) || (device === "desktop" ? 1280 : 390);
const context = device === "desktop" ? { viewport: { width: wide, height: 800 } } : { ...devices["iPhone 13"], viewport: { width: wide, height: 844 } };
const gifWidth = device === "desktop" ? 720 : Math.min(390, wide);

function gif(dir, file, fps = 12) {
  try {
    execFileSync("python3", ["-c", "import sys,glob\nfrom collections import Counter\nfrom PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+'/*.jpg'))\nsz=Counter(Image.open(f).size for f in fs).most_common(1)[0][0]\nfor f in fs:\n  i=Image.open(f)\n  if i.size!=sz: i.convert('RGB').resize(sz).save(f)", dir]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%04d.jpg"), "-vf", `scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse`, file]);
  } catch (e) {
    console.log("gif failed", e.message);
  }
}

const QUERY = {
  place: "&balloon=pawn&stage=1&laststand=0",
  grow: "&seedspeed=30&laststand=0",
  land: "&balloon=pawn&stage=4&laststand=0",
  pop: "&balloon=fakequeen&stage=4&laststand=0",
  hoops: "&power=hoops&laststand=0",
  attack: "&laststand=1",
  bar: "&balloon=knight&stage=4&laststand=0",
};

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
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1, ...(device === "phone" ? { maxWidth: 2 * wide, maxHeight: 1688 } : {}) });
  await p.goto(`${url}?debug&clock=60&nolanding&brain=stockfish&boss=tiger${QUERY[stage]}`);
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
  /** Your move now: a quiet, allowed one (a knight first). */
  const pick = async () => {
    const s = await st();
    const allowed = s.boss?.powers?.allowed ?? null;
    const legal = new Chess(s.fen).moves({ verbose: true }).filter((m) => !m.promotion);
    const ok = legal.filter((m) => !allowed || allowed.includes(m.from + m.to));
    const quiet = ok.filter((m) => !m.captured && !/[+#]/.test(m.san));
    const m = quiet.find((x) => x.piece === "n") ?? quiet[0] ?? ok[0] ?? legal[0];
    return m.from + m.to;
  };
  const play = async (move) => {
    await waitUntil((s) => s.kind === "play");
    await p.waitForTimeout(450);
    move = move ?? (await pick());
    for (let i = 0; i < 6 && (await st()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await p.waitForTimeout(350);
    }
    log(`played ${move}`);
  };
  const clip = (label, from, to, fps = 15) => gifs.push({ label, from, to, fps });
  const has = (s, kind) => (s.boss?.powers?.events ?? []).some((e) => e.kind === kind);
  const shots = (label, from, list) => stills.push(...list.map((ms) => ({ label: `${label}-${String(ms).padStart(4, "0")}`, t: from + ms })));

  if (stage === "place") {
    // His first turn: the balloon put on the pump (the crowd White: a balloon goes on as your first move lands).
    await play();
    const s = await waitUntil((x) => has(x, "place"), 60_000);
    log(`place: ${JSON.stringify(s.boss.powers.events.find((e) => e.kind === "place"))}`);
    shots("place", s.now, [0, 100, 300, 500, 700, 900, 1100, 1300, 1500, 1700, 1900, 2100, 2300, 2600]);
    await p.waitForTimeout(3200);
    clip("place", s.now - 300, s.now + 3000);
  } else if (stage === "grow") {
    // The page's clock 30 times faster: a stage a second. His first balloon goes on as your first move lands; watch it blow up.
    await play();
    const s = await waitUntil((x) => !!x.boss?.powers?.balloon, 60_000);
    shots("grow", s.now, [500, 2600, 3000, 3600, 4000, 4600, 5000, 5600]);
    await p.waitForTimeout(6500);
    clip("grow", s.now, s.now + 6200);
  } else if (stage === "land" || stage === "pop") {
    // From 1.e4 d5 2.exd5 Qxd5, every balloon that shape and ready as it goes on: at the end of his first turn it lands, or pops.
    await play();
    const s = await waitUntil((x) => x.kind === "boss" && !x.thinking && has(x, stage === "land" ? "balloonLand" : "pop"), 60_000);
    const e = s.boss.powers.events.find((x) => x.kind === (stage === "land" ? "balloonLand" : "pop"));
    log(`${stage}: ${JSON.stringify(e)}; the crowd's turn from ${s.until - s.now} ms`);
    const from = s.until;
    shots(stage, from, stage === "land" ? [-200, 100, 250, 400, 550, 700, 800, 900, 1050, 1250, 1300, 1450, 1700, 2000, 2300] : [-200, 60, 150, 250, 350, 500, 700, 900, 1100]);
    await waitUntil((x) => x.kind === "play", 60_000);
    await p.waitForTimeout(2800);
    clip(stage, s.now - 300, from + 2600);
  } else if (stage === "hoops") {
    let castAt = 0;
    for (let turn = 0; turn < 6 && !castAt; turn++) {
      await play();
      const s = await waitUntil((x) => x.kind === "play" || (x.kind === "boss" && !x.thinking && has(x, "hoops")), 90_000);
      if (s.kind === "boss") {
        castAt = s.until - 1490;
        log(`hoops: ${JSON.stringify(s.boss.powers.hoops)}`);
        shots("hoops", castAt, [-300, 100, 300, 450, 580, 700, 860, 1000, 1160, 1300, 1490, 1800]);
      }
    }
    // A move through a ring: refused, the dock says why; then another.
    const s = await waitUntil((x) => x.kind === "play", 60_000);
    await p.waitForTimeout(700);
    const allowed = s.boss.powers.allowed ?? [];
    const stopped = new Chess(s.fen).moves({ verbose: true }).find((m) => !allowed.includes(m.from + m.to) && !m.promotion);
    clip("hoops", castAt - 600, Date.now());
    if (stopped) {
      const refusedAt = Date.now();
      await tap(stopped.from);
      await p.waitForTimeout(300);
      await tap(stopped.to);
      await p.waitForTimeout(700);
      log(`tried ${stopped.from}${stopped.to}: the dock says "${await p.locator(".refused-note").first().textContent({ timeout: 400 }).catch(() => "(nothing)")}"`);
      stills.push({ label: "refused", t: Date.now() });
      await p.waitForTimeout(1200);
      clip("refused", refusedAt - 500, Date.now());
    }
    // Two of your moves: the rings die down after the first, go out as the second lands.
    await play();
    await waitUntil((x) => x.kind === "play", 60_000);
    await p.waitForTimeout(600);
    stills.push({ label: "dying", t: Date.now() });
    const outFrom = Date.now();
    await play();
    const o = await waitUntil((x) => has(x, "hoopsOut"), 60_000);
    shots("out", o.now, [0, 100, 200, 300, 450]);
    await p.waitForTimeout(1500);
    clip("rings-out", outFrom, o.now + 1000);
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
    shots("attack", attackAt, [300, 560, 650, 740, 980, 1460, 1620, 2300]);
    await waitUntil((x) => x.kind === "play", 60_000);
    clip("attack", attackAt - 600, attackAt + 3400);
  } else if (stage === "bar") {
    // His bar with a ready balloon on the pump (from his first turn), after his first lines are gone.
    await play();
    await waitUntil((x) => !!x.boss?.powers?.balloon && x.kind === "play", 60_000);
    await p.waitForTimeout(5000);
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
  await p.getByRole("radio", { name: "Babur" }).click();
  await p.waitForTimeout(2200);
  await p.screenshot({ path: join(outDir, `${device}${widthArg ? widthArg : ""}-${scheme}-select.png`) });
  await p.close();
}

for (const s of ["tile", "place", "grow", "land", "pop", "hoops", "bar", "attack"]) if (which === s || which === "all") await (s === "tile" ? tile() : run(s));
await browser.close();
await server.close();
