// The Hidden Boss's cutscene (a MOCKUP, Nov 12) over his real fight mid-game, on a phone (390 x 844) and a computer
// (1440 x 900): a video of the whole scene per platform (MP4) and stills of the spotlight, the landing and one text box.
//   node scripts/preview-recluse-cutscene.mjs <outDir> [phone|computer|both] [line=15]
// The dev server serves the app (no API: the script answers /api itself, as an admin, the way e2e's asAdmin does, so the
// boss menu lists him); it plays a few real moves, then loads src/dev/recluse-cutscene-lab.tsx, which nothing in the app
// imports, and plays the scene. Needs ffmpeg for the MP4s.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
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

async function run(name, use) {
  const vidDir = join(outDir, `.video-${name}`);
  rmSync(vidDir, { recursive: true, force: true });
  const context = await browser.newContext({ ...use, recordVideo: { dir: vidDir, size: use.viewport } });
  const p = await context.newPage();
  const pageStart = Date.now();
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
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
  const { at, timeline: tl } = await p.evaluate(async () => (await import("/src/dev/recluse-cutscene-lab.tsx")).playCutscene());
  const sceneStart = Date.now();
  console.log(name, "scene", (tl.endAt / 1000).toFixed(1), "s; lines from", (tl.boxes[0].at / 1000).toFixed(1), "s");
  const waitUntil = async (ms) => {
    const left = at + ms - (await p.evaluate(() => Date.now()));
    if (left > 0) await p.waitForTimeout(left);
  };
  const box = tl.boxes[lineShot - 1];
  const shots = [
    [tl.litAt + 300, "spotlight"],
    [tl.poofAt + 400, "poof"],
    [tl.landAt + 140, "landing"],
    [box.typed + 600, `line${lineShot}`],
  ];
  for (const [ms, tag] of shots) {
    await waitUntil(ms);
    await p.screenshot({ path: join(outDir, `${name}-${tag}.png`) });
  }
  await waitUntil(tl.endAt + 300);
  await context.close();
  const [file] = readdirSync(vidDir);
  const ss = (sceneStart - pageStart) / 1000 - 0.3;
  const mp4 = join(outDir, `${name}-cutscene.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", ss.toFixed(2), "-i", join(vidDir, file), "-t", ((tl.endAt + 600) / 1000).toFixed(2), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", mp4]);
  rmSync(vidDir, { recursive: true, force: true });
  console.log(name, "wrote", mp4);
}

try {
  if (which !== "computer") await run("phone", { ...devices["iPhone 13"] });
  if (which !== "phone") await run("computer", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
} finally {
  await browser.close();
  await server.close();
}
