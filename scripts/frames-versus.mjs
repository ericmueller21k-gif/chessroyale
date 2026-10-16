// Ranked 1 v 1's stage, recorded the way Eric reviews it (docs/areas/ranked.md, "The stage"): two dressed players
// queue in a pool of their own; the first is recorded searching (its pawn on the left platform, the right one empty and
// waiting), then the second arrives (their pawn drops onto the right platform, names and ranks, VS), the versus moment
// holds, and the board loads with the vote on it.
//   node scripts/frames-versus.mjs <out-dir> [base url, default http://localhost:8788]
// Needs the Worker running with the test switches (npx wrangler dev --port 8788 --enable-containers=false
// --var TEST_SWITCHES:1 --var ENGINE_OFF:1), and ffmpeg for the GIFs. Writes, for each run:
//   versus-<w>-<scheme>.gif (and .webm): the search, the arrival, the hold, the board (390 px, light and dark);
//   <w>-<scheme>-1-search.png, -2-versus.png, -3-board.png: stills (320, 360, 390 and a 1280 x 800 computer);
//   390-dark-few.png (Few players online), 390-<scheme>-bot.png (the bot on the stage);
//   timeline.txt: what each run saw, with the stage's boxes (they must not move when the opponent arrives).
import { chromium, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out = "versus-frames", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const phone = devices["iPhone 13"];
/** A device: a phone at `w` x `h` (touch, 3x), or a computer. */
const deviceFor = (w, h, scheme) =>
  w >= 1024
    ? { viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: scheme, baseURL: base }
    : { ...phone, viewport: { width: w, height: h }, colorScheme: scheme, baseURL: base };

/** A fresh account with a name and a few crate items worn (as a player who has opened some crates). */
async function account(device, name, crates) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  await page.addInitScript((n) => localStorage.setItem("brc.name", n), name);
  await page.goto("/?nolanding");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await page.evaluate(async (n) => {
    const post = (path, body) => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    for (let i = 0; i < n; i++) await post("/api/locker/open", { crate: "winter-1" });
    const { items } = await fetch("/api/locker").then((r) => r.json());
    const worn = new Set();
    for (const it of items)
      for (const slot of ["head", "face", "weapon"]) {
        if (worn.has(slot)) continue;
        if ((await post("/api/locker/equip", { slot, item: it.id })).ok) {
          worn.add(slot);
          break;
        }
      }
  }, crates);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

/** The stage's boxes: your pawn, both platforms, the row (they must stay put when the opponent arrives). */
const boxes = (page) =>
  page.evaluate(() => {
    const r = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
    };
    return {
      you: r(".dv-st-you .dv-st-spot"),
      them: r(".dv-st-them .dv-st-spot"),
      plat: r(".dv-st-them .dv-st-plat"),
      scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    };
  });

/**
 * When the stage first shows in a recording (seconds): the first frame with the title's "v" in its place (strong
 * contrast in a small box at the top center). Falls back to the page's own time for it.
 */
function stageStart(webm, w, tSearch) {
  const out = execFileSync("ffmpeg", ["-loglevel", "error", "-t", "5", "-i", webm, "-vf", `fps=25,crop=60:22:${Math.round(w / 2 - 30)}:22,signalstats,metadata=print:file=-`, "-f", "null", "-"]).toString();
  const lo = [...out.matchAll(/YMIN=(\d+)/g)].map((m) => Number(m[1]));
  const hi = [...out.matchAll(/YMAX=(\d+)/g)].map((m) => Number(m[1]));
  const i = hi.findIndex((h, n) => n > 0 && h - lo[n] > 120);
  return i > 0 ? i / 25 : Math.max(0, tSearch / 1000 - 0.1);
}

/**
 * One run: A searches (recorded when `video`), B arrives, the versus moment, the board. Stills of each at `w`.
 */
async function run({ w, h, scheme, video }) {
  const tag = `${w}-${scheme}`;
  const device = deviceFor(w, h, scheme);
  const pool = `fv${Date.now().toString(36)}${w}${scheme[0]}`;
  const [sa, sb] = [await account(device, "Ann", 6), await account(device, "Bo Duel", 9)];
  const vdir = join(out, `video-${tag}`);
  const ctxA = await browser.newContext({ ...device, storageState: sa, ...(video ? { recordVideo: { dir: vdir, size: { width: w, height: h } } } : {}) });
  const a = await ctxA.newPage();
  const t0 = Date.now();
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await a.locator(".dv-search").waitFor();
  const tSearch = Date.now() - t0;
  await sleep(2600);
  await a.screenshot({ path: join(out, `${tag}-1-search.png`) });
  const before = await boxes(a);
  const ctxB = await browser.newContext({ ...device, storageState: sb });
  const b = await ctxB.newPage();
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  await a.locator(".dv-versus").waitFor({ timeout: 30_000 });
  const tVersus = Date.now() - t0;
  await sleep(1100);
  await a.screenshot({ path: join(out, `${tag}-2-versus.png`) });
  const after = await boxes(a);
  await a.locator(".dv-vote").waitFor({ timeout: 10_000 });
  const tBoard = Date.now() - t0;
  await sleep(1500);
  await a.screenshot({ path: join(out, `${tag}-3-board.png`) });
  log(`${tag}: search at ${tSearch} ms, versus at ${tVersus} ms (held ${tBoard - tVersus} ms), board at ${tBoard} ms`);
  log(`  searching: ${JSON.stringify(before)}`);
  log(`  versus:    ${JSON.stringify(after)}`);
  if (before.you !== after.you || before.them !== after.them) log("  PROBLEM: the stage moved when the opponent arrived");
  if (before.scrollX > 0 || after.scrollX > 0) log("  PROBLEM: sideways scroll");
  await ctxB.close();
  await ctxA.close();
  if (video) {
    const file = readdirSync(vdir).find((f) => f.endsWith(".webm"));
    const webm = join(out, `versus-${tag}.webm`);
    renameSync(join(vdir, file), webm);
    // From the stage's first frame (its title in view: the link shows the splash and home for a moment first) to the
    // end; 20 frames a second, one palette for the whole clip.
    const from = stageStart(webm, w, tSearch).toFixed(2);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", from, "-i", webm, "-vf", `fps=20,scale=${w}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, join(out, `versus-${tag}.gif`)]);
    log(`  GIF: versus-${tag}.gif (from ${from} s of the recording)`);
  }
}

/** Few players online (after 2 s here), then Play a bot: the bot's pawn arrives on the same stage. */
async function bot({ w, h, scheme }) {
  const tag = `${w}-${scheme}`;
  const device = deviceFor(w, h, scheme);
  const sa = await account(device, "Ann", 6);
  const ctx = await browser.newContext({ ...device, storageState: sa });
  const a = await ctx.newPage();
  await a.goto(`/1v1?nolanding&pool=fvbot${Date.now().toString(36)}&fewAfter=2`);
  await a.locator(".dv-few").waitFor({ timeout: 15_000 });
  await sleep(400);
  await a.screenshot({ path: join(out, `${tag}-few.png`) });
  const before = await boxes(a);
  await a.getByRole("button", { name: "Play a bot (unranked)" }).click();
  await a.locator(".dv-versus").waitFor();
  await sleep(1000);
  await a.screenshot({ path: join(out, `${tag}-bot.png`) });
  log(`${tag} bot: few ${JSON.stringify(before)}; bot ${JSON.stringify(await boxes(a))}`);
  await ctx.close();
}

const only = process.env.ONLY;
const runs = [
  { w: 390, h: 664, scheme: "light", video: true },
  { w: 390, h: 664, scheme: "dark", video: true },
  { w: 320, h: 568, scheme: "light" },
  { w: 320, h: 568, scheme: "dark" },
  { w: 360, h: 640, scheme: "light" },
  { w: 360, h: 640, scheme: "dark" },
  { w: 1280, h: 800, scheme: "light" },
  { w: 1280, h: 800, scheme: "dark" },
];
for (const r of runs) if (!only || only.split(",").includes(`${r.w}-${r.scheme}`)) await run(r);
if (!only || only.includes("bot")) {
  await bot({ w: 390, h: 664, scheme: "dark" });
  await bot({ w: 390, h: 664, scheme: "light" });
}
writeFileSync(join(out, "timeline.txt"), lines.join("\n") + "\n");
await browser.close();
