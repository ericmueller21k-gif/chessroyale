// The Hidden Boss's transformation redone (a MOCKUP, Nov 14: the book's light, no God King) over his real fight mid-game, on a
// phone (390 x 844) and a computer (1440 x 900): from the cutscene's last line to "PHASE 2", a GIF and an MP4 per platform (each
// frame drawn on a paused clock, 40 ms apart) and stills of each beat.
//   node scripts/preview-recluse-transform.mjs <outDir> [phone|computer|both]
// The dev server serves the app (no API: the script answers /api itself, as an admin, the way e2e's asAdmin does, so the
// boss menu lists him); it plays a few real moves, then loads src/dev/recluse-transform-lab.tsx, which nothing in the app
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
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false, fs: { allow: [resolve(".")] } }, logLevel: "error" });
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
  await p.clock.install();
  await fakeApi(p);
  await p.addInitScript(() => localStorage.setItem("hunchess.tutorial.dismissed", "1"));
  await p.goto(url + "bosses?debug&laststand=0&nolanding");
  const menu = p.getByRole("dialog", { name: "Choose your boss" });
  await menu.waitFor({ timeout: 30_000 });
  await menu.getByRole("button", { name: /^Hidden Boss/ }).click();
  await playMoves(p, 5);
  await p.waitForTimeout(1500);
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 200));
  const { t0, tb } = await p.evaluate(async () => (await import("/src/dev/recluse-transform-lab.tsx")).playTransform());
  const beats = Object.entries(tb).filter(([, v]) => typeof v === "number");
  console.log(name, "pre-roll", t0, "ms;", beats.map(([k, v]) => `${k}=${v}`).join(" "));
  const stills = new Map(
    [
      [t0 - 1500, "1-last-line"],
      [t0 + 1500, "2-book-opens"],
      [t0 + 3300, "3-light-bursts"],
      [t0 + 6200, "4-beamed-chant-line"],
      [t0 + tb.flareAt + 120, "5-flare-cyborg"],
      [t0 + 10_000, "6-cyborg-in-lens"],
      [t0 + 12_200, "7-lens-lifted-child-fading"],
      [t0 + 16_935, "8-jump"],
      [t0 + tb.crackAt + 250, "9-crack-on-the-drop"],
      [t0 + tb.growAt + 300, "10-boards-part"],
      [t0 + tb.bannerAt + 500, "11-phase-2"],
    ].map(([ms, n]) => [Math.round(ms / FRAME_MS), n]),
  );
  const n = Math.ceil((t0 + tb.endAt + 300) / FRAME_MS);
  for (let i = 0; i <= n; i++) {
    if (i) await p.clock.runFor(FRAME_MS);
    await p.evaluate(() => new Promise((r) => queueMicrotask(r)));
    await p.screenshot({ path: join(frames, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 90 });
    const still = stills.get(i);
    if (still) await p.screenshot({ path: join(outDir, `${name}-${still}.png`) });
    if (i % 200 === 0) console.log(name, "frame", i, "of", n);
  }
  await context.close();
  const mp4 = join(outDir, `${name}-transform.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(1000 / FRAME_MS), "-i", join(frames, "%05d.jpg"), "-vf", "scale=trunc(iw/4)*2:trunc(ih/4)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", mp4]);
  const gif = join(outDir, `${name}-transform.gif`);
  const w = name === "phone" ? 390 : 720;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(1000 / FRAME_MS), "-i", join(frames, "%05d.jpg"), "-vf", `fps=12.5,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, gif]);
  rmSync(frames, { recursive: true, force: true });
  console.log(name, "wrote", mp4, gif);
}

try {
  if (which !== "computer") await run("phone", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
  if (which !== "phone") await run("computer", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
} finally {
  await browser.close();
  await server.close();
}
