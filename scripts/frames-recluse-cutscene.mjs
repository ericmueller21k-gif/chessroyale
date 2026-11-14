// The Hidden Boss's cutscene in his real fight, frame by frame (Nov 13): Boss alone as an admin, ?win=1 (your Qxf7, tapped on the
// board, mates his adult form), then the page's clock paused and moved on 40 ms a frame through his fall and the scene's start (the
// light, the poof, the drop, the landing), skipped through the lines, and again from the scene's last seconds through his phase
// change, his transformation (Nov 14), to "PHASE 2", a still at each of its beats. `cutscene=SECONDS` (default 20) shortens the
// lines' part only: the child's frames are his own. `only=change`: the second stretch alone.
//   node scripts/frames-recluse-cutscene.mjs <outDir> [phone|computer] [cutscene=20] [only=change]
// Writes every frame (JPEG) of both stretches and a GIF of each, and prints when each beat was on screen.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv } from "node:process";
import { chromium, devices } from "playwright";
import { createServer } from "vite";

const args = argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const [out = "cutscene-frames", which = "phone"] = args.filter((a) => !a.includes("="));
const hold = Number(opt("cutscene") ?? 20);
const outDir = resolve(out);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const FRAME_MS = 40;

async function fakeApi(page) {
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/auth/config") return route.fulfill({ json: { accounts: true, google: false, email: false, testSwitches: true } });
    if (u.pathname === "/api/me" && route.request().method() === "GET")
      return route.fulfill({ json: { admin: true, user: { id: "dev", name: "You", signedIn: false }, name: "You", stats: {}, locker: { items: [], equipped: {} } } });
    return route.fulfill({ status: 404, json: { error: "none here" } });
  });
}

async function stretch(p, dir, ms, label, stills = new Map()) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const n = Math.ceil(ms / FRAME_MS);
  const beats = [];
  for (let i = 0; i <= n; i++) {
    if (i) await p.clock.runFor(FRAME_MS);
    await p.evaluate(() => new Promise((r) => queueMicrotask(r)));
    const s = await p.evaluate(() => ({
      phase: window.match?.phase.kind,
      fig: document.querySelector(".cs-fig canvas") ? "scene" : "",
      step: document.querySelector(".rc-stage")?.getAttribute("data-step") ?? "",
      tf: document.querySelector(".rc-tf-fig")?.getAttribute("data-anim") ?? "",
      csOn: document.body.classList.contains("cs-on"),
      place: document.querySelector(".boss-char")?.getAttribute("data-anim") ?? "",
      line: document.querySelector(".cs-say")?.getAttribute("data-line") ?? "",
      dim: document.querySelector(".cs-dim")?.style.opacity ?? "",
    }));
    const key = `${s.phase} scene=${s.fig ? 1 : 0} cs-on=${s.csOn} place=${s.place} line=${s.line} step=${s.step} fig=${s.tf}`;
    if (beats.at(-1)?.key !== key) beats.push({ t: i * FRAME_MS, key, dim: s.dim });
    await p.screenshot({ path: join(dir, `${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 90 });
    const still = stills.get(i);
    if (still) await p.screenshot({ path: join(outDir, `${label}-${still}.png`) });
  }
  console.log(label);
  for (const b of beats) console.log(`  ${String(b.t).padStart(6)} ms  ${b.key}  dim=${b.dim}`);
  const gif = join(outDir, `${label}.gif`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "25", "-i", join(dir, "%04d.jpg"), "-vf", "scale=390:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse", gif]);
}

try {
  const use = which === "computer" ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 };
  const context = await browser.newContext(use);
  const p = await context.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.clock.install();
  await fakeApi(p);
  await p.addInitScript(() => localStorage.setItem("hunchess.tutorial.dismissed", "1"));
  await p.goto(url + `bosses?debug&laststand=0&nolanding&form=adult&win=1&cutscene=${hold}`);
  const menu = p.getByRole("dialog", { name: "Choose your boss" });
  await menu.waitFor({ timeout: 60_000 });
  await menu.getByRole("button", { name: /^Hidden Boss/ }).click();
  for (let i = 0; i < 400; i++) {
    if ((await p.evaluate(() => window.match?.phase.kind === "play" && Date.now() >= window.match.phase.startsAt + 300)) === true) break;
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(1500);
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 100));
  // (Your mate, tapped: the queen on h5, then f7.)
  await p.clock.resume();
  const box = await p.locator(".hb-board").first().boundingBox();
  const sq = (q) => ({ x: box.x + (q.charCodeAt(0) - 97 + 0.5) * (box.width / 8), y: box.y + (8 - Number(q[1]) + 0.5) * (box.height / 8) });
  for (const q of ["h5", "f7"]) {
    const { x, y } = sq(q);
    if (which === "computer") await p.mouse.click(x, y);
    else await p.touchscreen.tap(x, y);
    await p.waitForTimeout(150);
  }
  await p.clock.pauseAt(await p.evaluate(() => Date.now() + 100));
  // (Until his fall is up.)
  for (let i = 0; i < 200 && !(await p.evaluate(() => !!window.match.phase.fall)); i++) await p.clock.runFor(50);
  const c = await p.evaluate(() => window.match.cutscene);
  const now = await p.evaluate(() => Date.now());
  console.log("scene from", c.at - now, "ms after the fall's first frame; its hold", c.until - c.at, "ms");
  // The fall and the scene's first seconds: the light, the poof, the drop, the landing, the first line.
  if (!argv.includes("only=change")) await stretch(p, join(outDir, ".a"), c.at - now + 6500, `${which}-arrival`);
  // On to the scene's last seconds, then through his phase change to "PHASE 2" (its beats: PHASE_CHANGE; T0 is the scene's end).
  const t = await p.evaluate(() => Date.now());
  const PRE = 4500;
  await p.clock.runFor(Math.max(0, c.until - PRE - t));
  const BEATS = [[-1500, "01-last-line"], [1500, "02-book-opens"], [2950, "03-light-takes-him"], [5300, "04-arms-relaxed-white-eyes"], [6450, "05-light-shoots-up"], [7250, "06-light-at-full"], [8300, "07-white-out"], [9300, "08-dies-back"], [10150, "09-reveal-visor-down"], [13000, "10-visor-up-his-line"], [16935, "11-jump"], [17475, "12-crack-no-big-board"], [18500, "13-boards-part"], [19200, "14-four-boards"], [22000, "15-phase-2"]];
  const stills = new Map(BEATS.map(([ms, n]) => [Math.round((PRE + ms) / FRAME_MS), n]));
  await stretch(p, join(outDir, ".b"), PRE + 23_600, `${which}-change`, stills);
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
