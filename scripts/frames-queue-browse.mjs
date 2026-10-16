// Browsing while queued for 1 v 1 (docs/areas/ranked.md, "Browsing while queued"), recorded the way Eric reviews it:
// a dressed player queues (the stage), taps Home (home with the search's bar at the top), opens the shop (the bar
// still there), and is found while in the shop: the sound and buzz, straight to the stage, the opponent arriving, the
// versus moment, then the board. Also stills of "Few players online" in the bar and the "Leave the 1 v 1 queue?"
// confirm.
//   node scripts/frames-queue-browse.mjs <out-dir> [base url, default http://localhost:8788]
// Needs the Worker running with the test switches (npx wrangler dev --port 8788 --enable-containers=false
// --var TEST_SWITCHES:1 --var ENGINE_OFF:1), and ffmpeg for the GIFs. Writes, at 390 x 664, light and dark:
//   browse-<scheme>.gif (and .webm); <scheme>-1-stage.png, -2-home.png, -3-shop.png, -4-found.png, -5-board.png;
//   <scheme>-few.png (the bar at "Few players online"), <scheme>-confirm.png; and 320-<scheme>-home.png;
//   timeline.txt: when each step happened, the bar's box and the page's sideways scroll on each screen.
import { chromium, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out = "browse-frames", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phone = (w, h, scheme) => ({ ...devices["iPhone 13"], viewport: { width: w, height: h }, colorScheme: scheme, baseURL: base });

/** A fresh account with a name and a few crate items worn. */
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

/** The bar's box and the page's sideways scroll. */
const where = (page) =>
  page.evaluate(() => {
    const b = document.querySelector(".dq-bar")?.getBoundingClientRect();
    return { bar: b ? `${Math.round(b.y)}+${Math.round(b.height)} ${Math.round(b.width)}w` : null, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

async function run(scheme) {
  const device = phone(390, 664, scheme);
  const pool = `fb${Date.now().toString(36)}${scheme[0]}`;
  const [sa, sb] = [await account(device, "Ann", 6), await account(device, "Bo Duel", 9)];
  const vdir = join(out, `video-${scheme}`);
  const ctx = await browser.newContext({ ...device, storageState: sa, recordVideo: { dir: vdir, size: { width: 390, height: 664 } } });
  const a = await ctx.newPage();
  const t0 = Date.now();
  const t = () => Date.now() - t0;
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await a.locator(".dv-search").waitFor();
  const tStage = t();
  await sleep(1600);
  await a.screenshot({ path: join(out, `${scheme}-1-stage.png`) });
  await a.getByRole("button", { name: /^Home/ }).click();
  await a.locator(".dq-bar").waitFor();
  log(`${scheme}: stage at ${tStage} ms, home at ${t()} ms ${JSON.stringify(await where(a))}`);
  await sleep(1800);
  await a.screenshot({ path: join(out, `${scheme}-2-home.png`) });
  await a.getByRole("button", { name: "Shop & crates" }).click();
  await a.getByRole("heading", { name: "Shop" }).waitFor();
  // (The tap scrolled home down to its button; a player in the shop starts at its top.)
  await a.evaluate(() => window.scrollTo(0, 0));
  log(`  shop at ${t()} ms ${JSON.stringify(await where(a))}`);
  await sleep(1800);
  await a.screenshot({ path: join(out, `${scheme}-3-shop.png`) });
  // The opponent queues: found while Ann is in the shop.
  await a.evaluate(() => {
    window.__buzz = [];
    navigator.vibrate = (p) => (window.__buzz.push(p), true);
  });
  const ctxB = await browser.newContext({ ...device, storageState: sb });
  const b = await ctxB.newPage();
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  await a.locator(".dv-versus").waitFor({ timeout: 30_000 });
  log(`  found at ${t()} ms (buzz ${JSON.stringify(await a.evaluate(() => window.__buzz))}) ${JSON.stringify(await where(a))}`);
  await sleep(1000);
  await a.screenshot({ path: join(out, `${scheme}-4-found.png`) });
  await a.locator(".dv-vote").waitFor({ timeout: 10_000 });
  log(`  board at ${t()} ms`);
  await sleep(1300);
  await a.screenshot({ path: join(out, `${scheme}-5-board.png`) });
  await ctxB.close();
  await ctx.close();
  const file = readdirSync(vdir).find((f) => f.endsWith(".webm"));
  const webm = join(out, `browse-${scheme}.webm`);
  renameSync(join(vdir, file), webm);
  rmSync(vdir, { recursive: true });
  const from = Math.max(0, tStage / 1000 + 0.2).toFixed(2);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", from, "-i", webm, "-vf", "fps=15,scale=390:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", join(out, `browse-${scheme}.gif`)]);
  log(`  GIF: browse-${scheme}.gif`);
}

/** "Few players online" in the bar (after 1 s here), and the confirm before another mode; home at 320 px too. */
async function extras(scheme) {
  for (const [w, h] of [[390, 664], [320, 568]]) {
    const device = phone(w, h, scheme);
    const sa = await account(device, "Ann", 6);
    const ctx = await browser.newContext({ ...device, storageState: sa });
    const a = await ctx.newPage();
    await a.goto(`/1v1?nolanding&pool=fbx${Date.now().toString(36)}&fewAfter=1`);
    await a.locator(".dv-search").waitFor();
    await a.getByRole("button", { name: /^Home/ }).click();
    await a.locator(".dq-bar.few").waitFor({ timeout: 10_000 });
    await sleep(500);
    await a.screenshot({ path: join(out, `${w === 390 ? "" : `${w}-`}${scheme}-${w === 390 ? "few" : "home"}.png`) });
    log(`${w}-${scheme} few: ${JSON.stringify(await where(a))}`);
    if (w === 390) {
      await a.getByRole("radio", { name: /50 v 50/ }).click();
      await a.getByRole("button", { name: "PLAY", exact: true }).click();
      await a.getByRole("alertdialog").waitFor();
      await sleep(300);
      await a.screenshot({ path: join(out, `${scheme}-confirm.png`) });
      await a.getByRole("button", { name: "Stay" }).click();
    }
    await a.locator(".dq-cancel").click();
    await ctx.close();
  }
}

for (const scheme of ["light", "dark"]) {
  await run(scheme);
  await extras(scheme);
}
writeFileSync(join(out, "timeline.txt"), lines.join("\n") + "\n");
await browser.close();
