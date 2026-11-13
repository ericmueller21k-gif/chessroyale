// The Hidden Boss's cutscene (a MOCKUP, Nov 12) over his real fight mid-game, on a phone (390 x 844) and a computer
// (1440 x 900): a video of the whole scene per platform (MP4, 25 frames a second, each drawn on a paused clock, so smooth
// and exactly timed) and stills of the spotlight, the poof, the landing and one text box.
//   node scripts/preview-recluse-cutscene.mjs <outDir> [phone|computer|both] [line=15]
// The dev server serves the app (no API: the script answers /api itself, as an admin, the way e2e's asAdmin does, so the
// boss menu lists him); it plays a few real moves, then loads src/dev/recluse-cutscene-lab.tsx, which nothing in the app
// imports, and plays the scene. Needs ffmpeg for the MP4s.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv } from "node:process";
import { chromium, devices } from "playwright";
import { Chess } from "chess.js";
import { createServer } from "vite";

const args = argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const [out = "cutscene-preview", which = "both"] = args.filter((a) => !a.includes("="));
const lineShot = Number(opt("line") ?? 15);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5197, strictPort: false, fs: { allow: [resolve(".")] } }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
// (CHROMIUM_PATH: a Chromium other than the one this Playwright version downloads, e.g. a cloud machine's preinstalled one.)
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/** No API on the dev server: accounts on, test switches on, you an admin guest; anything else a quiet 404. */
async function fakeApi(page) {
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/auth/config") return route.fulfill({ json: { accounts: true, google: false, email: false, testSwitches: true } });
    if (u.pathname === "/api/me" && route.request().method() === "GET")
      return route.fulfill({ json: { admin: true, user: { id: "dev", name: "You", signedIn: false }, name: "You", stats: {}, locker: { items: [], equipped: {} } } });
    return route.fulfill({ status: 404, json: { error: "none here" } });
  });
}

const phase = (p) => p.evaluate(() => window.match?.phase.kind ?? null);
async function yourMove(p, timeout = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await phase(p)) === "play" && (await p.evaluate(() => Date.now() >= window.match.phase.startsAt + 300))) return;
    await p.waitForTimeout(250);
  }
  throw new Error("never your move");
}
/** Sensible Black replies in order, each the first still legal (else any quiet move). */
const PLAN = ["e7e5", "b8c6", "g8f6", "f8c5", "d7d6", "c8g4", "e8g8", "a7a6", "h7h6"];
async function playMoves(p, n) {
  const used = new Set();
  for (let i = 0; i < n; i++) {
    await yourMove(p);
    const fen = await p.evaluate(() => window.match.phase.board.fen);
    const c = new Chess(fen);
    const legal = c.moves({ verbose: true });
    const lan = (m) => m.from + m.to + (m.promotion ?? "");
    const mv = PLAN.find((m) => !used.has(m) && legal.some((l) => lan(l) === m)) ?? lan(legal.find((m) => !m.captured) ?? legal[0]);
    used.add(mv);
    await p.evaluate(([m, f]) => {
      const x = window.match;
      if (x.phase.kind === "play" && x.phase.board.fen === f) x.submit(m);
    }, [mv, fen]);
    for (let k = 0; k < 40 && (await phase(p)) === "play"; k++) await p.waitForTimeout(150);
  }
  await yourMove(p);
}

/** The scene, frame by frame: the page's clock paused, moved on 40 ms at a time (25 frames a second), a picture each. */
const FRAME_MS = 40;
async function run(name, use) {
  const frames = join(outDir, `.frames-${name}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const context = await browser.newContext(use);
  const p = await context.newPage();
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  // (A fake clock that runs as usual until the scene, then only as the script moves it.)
  await p.clock.install();
  await fakeApi(p);
  // (The first-time walkthrough seen, as every e2e context does: tutorial.ts' TUTORIAL_SEEN_KEY.)
  await p.addInitScript(() => localStorage.setItem("hunchess.tutorial.dismissed", "1"));
  await p.goto(url + "bosses?debug&laststand=0&nolanding");
  const menu = p.getByRole("dialog", { name: "Choose your boss" });
  await menu.waitFor({ timeout: 30_000 });
  await menu.getByRole("button", { name: /^Hidden Boss/ }).click();
  // (Five moves each: an opening well under way, before his Bullet at turn 7 would run your clock down during the scene.)
  await playMoves(p, 5);
  await p.waitForTimeout(1500);
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 200));
  const { timeline: tl } = await p.evaluate(async () => (await import("/src/dev/recluse-cutscene-lab.tsx")).playCutscene());
  console.log(name, "scene", (tl.endAt / 1000).toFixed(1), "s; lines from", (tl.boxes[0].at / 1000).toFixed(1), "s");
  const box = tl.boxes[lineShot - 1];
  const stills = new Map([
    [Math.round((tl.litAt + 300) / FRAME_MS), "spotlight"],
    [Math.round((tl.poofAt + 400) / FRAME_MS), "poof"],
    [Math.round((tl.landAt + 140) / FRAME_MS), "landing"],
    [Math.round((box.typed + 600) / FRAME_MS), `line${lineShot}`],
  ]);
  const n = Math.ceil((tl.endAt + 400) / FRAME_MS);
  for (let i = 0; i <= n; i++) {
    if (i) await p.clock.runFor(FRAME_MS);
    // (The paused clock fires the page's animation frames as it's moved on; a moment for the renders they ask for.)
    await p.evaluate(() => new Promise((r) => queueMicrotask(r)));
    await p.screenshot({ path: join(frames, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    const still = stills.get(i);
    if (still) await p.screenshot({ path: join(outDir, `${name}-${still}.png`) });
    if (i % 250 === 0) console.log(name, "frame", i, "of", n);
  }
  await context.close();
  const mp4 = join(outDir, `${name}-cutscene.mp4`);
  // (Even sizes for the encoder.)
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(1000 / FRAME_MS), "-i", join(frames, "%05d.jpg"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", mp4]);
  rmSync(frames, { recursive: true, force: true });
  console.log(name, "wrote", mp4);
}

try {
  // (The phone: an iPhone 13's screen, 390 x 844, at its own pixel ratio; the computer at twice its size.)
  if (which !== "computer") await run("phone", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  if (which !== "phone") await run("computer", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
} finally {
  await browser.close();
  await server.close();
}
