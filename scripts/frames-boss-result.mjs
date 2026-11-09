// Frame-by-frame check of a boss battle's result screen (Eric, Nov 9: the boss and your pawn, his attack on a loss), the way a
// player gets there (Home → Boss Battle → START, then the battle's real end).
//   node scripts/frames-boss-result.mjs <out-dir> <boss id> <win|loss|draw|resign> [width: a phone under 800 px, else a computer; default an iPhone 13]
// (FULL=1: the stills are the whole screen; DSF=2: a computer's at deviceScaleFactor 2 too; PW_CHROMIUM: the browser's path.)
// Needs the app and API on http://localhost:8788 (E2E_PORT), test switches on (`npx wrangler dev ... --var TEST_SWITCHES:1`, as
// playwright.config.ts starts it). Saves a PNG each time the boss's frame, the attack's frame or the pawn's place changes for
// 4 s after the result shows, and prints a timeline (ms, the attack's stage and frame, the pawn's shift, the painted gap between
// the boss and your pawn: at least 16 px, Eric's rule). `strip.png`: the frames side by side.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";

const [outArg = ".", boss = "gingerbread", kind = "loss", widthArg] = process.argv.slice(2);
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const base = `http://localhost:${process.env.E2E_PORT || 8788}`;
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const w = Number(widthArg);
const p = await b.newPage(w ? { viewport: { width: w, height: w < 800 ? 760 : 800 }, deviceScaleFactor: w < 800 || process.env.DSF === "2" ? 2 : 1, isMobile: w < 800, hasTouch: w < 800 } : { ...devices["iPhone 13"] });
p.on("pageerror", (e) => console.log("pageerror", e.message));
// (The first-time walkthrough seen, as e2e/helpers.ts sets it: it would cover the screen.)
await p.addInitScript(() => localStorage.setItem("hunchess.tutorial.dismissed", "1"));
// (`resign`: a loss for a boss whose first move isn't ?mate=1's mate (Sawyer, Wrangler): you resign at once.)
const sw = kind === "loss" ? "mate=1" : kind === "win" ? "win=1" : kind === "resign" ? "" : "bossMoves=1";
await p.goto(`${base}/?debug&pace=quick&${sw}&boss=${boss}&xp=990&xpgame=12`);
await p.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
await p.getByRole("main").getByRole("button", { name: "START" }).click();
const deadline = Date.now() + 150_000;
while (Date.now() < deadline) {
  const k = await p.evaluate(() => window.match?.phase?.kind);
  if (k === "results") break;
  if (k === "play" && kind === "resign") await p.evaluate(() => window.match.phase.kind === "play" && window.match.resign());
  if (k === "play" && kind === "win") await p.evaluate(() => window.match.phase.kind === "play" && window.match.submit("h5f7"));
  // (A draw: any legal move, until the move limit ends it.)
  if (k === "play" && kind === "draw") await p.evaluate(() => window.match.phase.kind === "play" && window.match.submit(window.match.phase.legal?.[0] ?? null));
  await p.waitForTimeout(150);
}
// Every frame for 4 s, in the page: the boss's painted span (his figure or his attack), the pawn's art box, the attack's state.
const sampling = p.evaluate(
  () =>
    new Promise((resolve) => {
      const out = [];
      const t0 = performance.now();
      const opaque = (cv) => {
        const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        let a = cv.width,
          z = -1;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) ((a = Math.min(a, x)), (z = Math.max(z, x)));
        return z < 0 ? null : [a, z + 1];
      };
      // (A canvas's painted columns on screen, mirrored or not: its box's left and right for its first and last opaque column.)
      const painted = (cv) => {
        const o = opaque(cv);
        if (!o) return null;
        const r = cv.getBoundingClientRect();
        const k = r.width / cv.width;
        const flip = getComputedStyle(cv).transform !== "none" || getComputedStyle(cv.parentElement).transform !== "none";
        return flip ? [r.right - o[1] * k, r.right - o[0] * k] : [r.left + o[0] * k, r.left + o[1] * k];
      };
      const tick = () => {
        const duo = document.querySelector(".results-duo");
        const attack = document.querySelector(".rd-attack canvas");
        const fig = document.querySelector(".results-duo .boss-char-sprite");
        const cv = attack ?? fig;
        const bs = cv ? painted(cv) : null;
        const pawn = document.querySelector(".results-duo .you-pawn-hop")?.getBoundingClientRect();
        const pawnBox = document.querySelector(".results-duo .rd-pawn");
        out.push({
          t: Math.round(performance.now() - t0),
          stage: duo?.getAttribute("data-attack") ?? "-",
          frame: attack?.getAttribute("data-frame") ?? document.querySelector(".results-duo .boss-char")?.getAttribute("data-anim") + ":" + document.querySelector(".results-duo .boss-char")?.getAttribute("data-frame"),
          shift: pawnBox ? getComputedStyle(pawnBox).translate : "",
          gap: bs && pawn ? Math.round((pawn.left - bs[1]) * 10) / 10 : null,
          left: bs ? Math.round(bs[0]) : null,
          right: pawn ? Math.round(pawn.right) : null,
          past: bs && pawn ? Math.round(bs[1] - pawn.right) : null,
        });
        if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
        else resolve(out);
      };
      tick();
    }),
);
// Stills while it samples: through the attack (its landing, lashes, laugh) and after, for the strip.
const shots = [];
const t0 = Date.now();
for (const at of [200, 500, 800, 1100, 1400, 1800, 2300, 3200]) {
  await p.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
  const row = await p.locator(".results-duo").boundingBox();
  const path = `${out}/${boss}-${kind}-${p.viewportSize().width}-t${at}.png`;
  // (FULL=1: the whole screen, for a still a person sees.)
  if (process.env.FULL === "1") await p.screenshot({ path });
  else if (row) await p.screenshot({ path, clip: { x: Math.max(0, row.x - 24), y: Math.max(0, row.y - 8), width: Math.min(p.viewportSize().width, row.width + 48), height: row.height + 16 } });
  shots.push(path);
}
const samples = await sampling;
console.log("stills", shots.join(" "));
let last = "";
for (const s of samples) {
  const key = `${s.stage}|${s.frame}|${s.shift}`;
  if (key !== last) console.log(`${s.t}ms ${s.stage} ${s.frame} pawn=${s.shift} gap=${s.gap} left=${s.left} right=${s.right}`);
  last = key;
}
for (const st of ["-", "wait", "on", "done"]) {
  const ss = samples.filter((s) => s.stage === st);
  if (!ss.length) continue;
  const gaps = ss.map((s) => s.gap).filter((g) => g !== null);
  console.log(`${st}: max past the pawn ${Math.max(...ss.map((s) => s.past ?? -1e9))}; min gap ${Math.min(...gaps)} px; leftmost ${Math.min(...ss.map((s) => s.left ?? 1e9))}; rightmost ${Math.max(...ss.map((s) => s.right ?? 0))}; vw ${p.viewportSize().width}`);
}
// Stills: the row now (after 4 s: at rest), and, for a loss, a fresh run's mid-attack frames are in the timeline above.
const row = await p.locator(".results-duo").boundingBox();
await p.screenshot({ path: `${out}/${boss}-${kind}-${p.viewportSize().width}-end.png` });
console.log("row", JSON.stringify(row));
await b.close();
