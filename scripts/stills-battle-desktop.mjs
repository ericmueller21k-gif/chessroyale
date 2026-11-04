// A boss battle on a computer, in stills (docs/decisions/2026-11-04-battle-desktop-fixes.md). Against a running server (`npm run
// build`, then `npx wrangler dev --port 8971 --inspector-port 9471 --var TEST_SWITCHES:1 …`, the e2e's flags: playwright.config.ts), so
// the Hidden Boss, an admin's, is there too.
//   node scripts/stills-battle-desktop.mjs sides <out-dir> [sizes, e.g. 1440x900,2000x1250,phone] [boss ids, comma-separated] [base url]
//     The figures beside the board, every boss with a character and the God King (and your pawn): one still per boss and size, a
//     contact sheet per size (<out-dir>/sizes-<w>x<h>.png), and every figure's drawn box checked against the window (Eric, Nov 4: a
//     figure is always whole on screen at rest; over the board or a menu is fine): geometry.json, and a line for any that leaves it.
//   node scripts/stills-battle-desktop.mjs cast <out-dir> [sizes] [base url]
//     Hollow's darkness after your first move: the still as he casts (<out-dir>/cast-<w>x<h>.png), and where his figure and his words were.
//   node scripts/stills-battle-desktop.mjs cave <out-dir> [sizes] [base url]
//     Hollow's cave intro, his line in its bubble over his head (<out-dir>/cave-<w>x<h>.png, or cave-phone.png).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";

const ALL = ["gingerbread", "clown", "grex", "hollow", "bigboy", "sawyer", "pig", "alfil", "hopper", "smudgy", "moo", "gardener", "tiger", "folio", "timber", "dash", "recluse"];
const mode = process.argv[2];
const rest = process.argv.slice(3);
if (mode !== "sides") rest.splice(2, 0, "");
const [out = "battle-stills", sizesArg = "1280x800,1440x900,1920x1080,2000x1250", bossArg = "", base = "http://localhost:8971"] = rest;
const outDir = resolve(out);
const sizes = sizesArg.split(",").map((s) => (s === "phone" ? "phone" : s.split("x").map(Number)));
const bosses = bossArg ? bossArg.split(",") : ALL;
const browser = await chromium.launch();
const geometry = {};
let bad = 0;

/** Every figure's drawn box (its canvas's opaque pixels, not its frame), the board's and the window's. */
const measure = () => {
  const drawn = (c) => {
    if (!c || !c.width) return null;
    const r = c.getBoundingClientRect();
    if (!r.width) return null;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return null;
    const sx = r.width / c.width, sy = r.height / c.height;
    return [r.left + x0 * sx, r.top + y0 * sy, r.left + (x1 + 1) * sx, r.top + (y1 + 1) * sy].map(Math.round);
  };
  const rect = (q) => {
    const el = document.querySelector(q);
    const r = el?.getBoundingClientRect();
    return r && r.width ? [r.left, r.top, r.right, r.bottom].map(Math.round) : null;
  };
  const visible = (q) => [...document.querySelectorAll(q)].find((e) => e.getBoundingClientRect().width > 0) ?? null;
  return {
    win: [innerWidth, innerHeight],
    board: rect(".board-row .board-wrap") ?? rect(".hb-board"),
    boss: drawn(visible(".boss-char-sprite")),
    godKing: drawn(visible(".boss-dock .gk-unit .gk-canvas")),
    you: rect(".boss-dock .you-pawn-bob"),
  };
};

const contextOf = (size) => (size === "phone" ? { ...devices["iPhone 13"] } : { ...devices["Desktop Chrome"], viewport: { width: size[0], height: size[1] } });
const tagOf = (size) => (size === "phone" ? "phone" : `${size[0]}x${size[1]}`);
/** An admin, for the Hidden Boss's tile: as e2e/helpers.ts' asAdmin. */
const asAdmin = (page) =>
  page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {}
  });
const phaseOf = (page) => page.evaluate(() => window.match?.phase.kind ?? "none");
async function battle(page, boss) {
  await page.goto(`${base}/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${boss}`);
  await page.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
  await page.getByRole("main").getByRole("button", { name: "START" }).click();
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000 && (await phaseOf(page)) !== "play") await page.waitForTimeout(250);
}

if (mode === "cast") {
  const { Chess } = await import("chess.js");
  mkdirSync(outDir, { recursive: true });
  for (const size of sizes) {
    const tag = tagOf(size);
    const context = await browser.newContext(contextOf(size));
    const page = await context.newPage();
    await battle(page, "hollow");
    await page.waitForTimeout(1500);
    const fen = await page.evaluate(() => window.match.phase.board.fen);
    const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "n") ?? new Chess(fen).moves({ verbose: true })[0];
    await page.evaluate((u) => window.match.submit(u), mv.from + mv.to);
    // His move, then the darkness: looked at every 100 ms; the still as his cast is up (as the darkness pours).
    let shot = false;
    const seen = [];
    for (let i = 0; i < 200 && !shot; i++) {
      const g = await page.evaluate(() => {
        const m = document.querySelector(".power-moment.pm-dark");
        if (!m) return null;
        const r = (q) => {
          const e = document.querySelector(q);
          const b = e?.getBoundingClientRect();
          return b && b.width ? [b.left, b.top, b.right, b.bottom].map(Math.round) : null;
        };
        const side = document.querySelector(".boss-char.place-side .boss-char-sprite");
        return { caster: r(".pm-caster"), side: side && getComputedStyle(side).visibility === "visible" ? r(".boss-char.place-side .boss-char-sprite") : null, sideAnim: document.querySelector(".boss-char.place-side")?.getAttribute("data-anim"), bubble: r(".boss-char.place-side .bc-bubble"), flight: r(".pw-flight") };
      });
      if (g) seen.push(g);
      if (g && (g.caster || g.sideAnim === "darkCast") && g.flight) {
        await page.screenshot({ path: join(outDir, `cast-${tag}.png`) });
        shot = true;
      }
      await page.waitForTimeout(100);
    }
    geometry[tag] = seen;
    console.log(tag, shot ? "cast still" : "no cast seen", JSON.stringify(seen.at(-1)));
    await context.close();
  }
  writeFileSync(join(outDir, "cast-geometry.json"), JSON.stringify(geometry, null, 1));
  await browser.close();
  process.exit(0);
}

if (mode === "cave") {
  mkdirSync(outDir, { recursive: true });
  for (const size of sizes) {
    const tag = tagOf(size);
    const context = await browser.newContext(contextOf(size));
    const page = await context.newPage();
    // (The chat log's box lies over a corner of the map and takes taps there: as e2e/boss-challenge.spec.ts.)
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: ".town-chat,.town-chat *{pointer-events:none!important}" }))));
    await page.goto(`${base}/town?sky=night`);
    await page.locator('canvas.town-canvas[data-ready="1"]').waitFor({ timeout: 60_000 });
    const at = () => page.evaluate(() => window.__townAt?.("boss", "hollow") ?? null);
    if (!(await at())) await page.evaluate(() => window.__townGlide?.("hollow"));
    const card = page.getByRole("dialog", { name: "Hollow", exact: true });
    for (let i = 0; i < 40 && !(await card.isVisible()); i++) {
      const xy = await at();
      if (xy) {
        const cv = await page.locator("canvas.town-canvas").boundingBox();
        await page.mouse.click(cv.x + xy.x, cv.y + xy.y);
      }
      await page.waitForTimeout(500);
    }
    await card.getByRole("button", { name: "Challenge alone" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("dialog", { name: "Challenge Hollow?" }).getByRole("button", { name: "Fight" }).click();
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000 && (await page.evaluate(() => window.__shopIntro?.()?.step ?? ""))!== "line") await page.waitForTimeout(50);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, `cave-${tag}.png`) });
    console.log(tag, "cave still");
    await context.close();
  }
  await browser.close();
  process.exit(0);
}

for (const size of sizes) {
  const phone = size === "phone";
  const tag = tagOf(size);
  mkdirSync(join(outDir, tag), { recursive: true });
  geometry[tag] = {};
  const context = await browser.newContext(contextOf(size));
  for (const boss of bosses) {
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log(tag, boss, "pageerror", e.message));
    await asAdmin(page);
    await battle(page, boss);
    // (Past the entrance's line, at rest.)
    await page.waitForTimeout(2500);
    const g = await page.evaluate(measure);
    geometry[tag][boss] = g;
    const [W, H] = g.win;
    for (const k of ["boss", "godKing"]) {
      const b = g[k];
      if (!b) continue;
      if (b[0] < 0 || b[1] < 0 || b[2] > W || b[3] > H) {
        bad++;
        console.log(`${tag} ${boss}: ${k} ${b} leaves the window ${W}x${H}`);
      }
    }
    await page.screenshot({ path: join(outDir, tag, `${boss}.png`) });
    await page.close();
  }
  await context.close();
  // The sheet: every boss's still, a quarter size (a phone's half), named.
  const k = phone ? 0.5 : 0.25;
  const [w, h] = phone ? [390, 844] : size;
  const cols = phone ? 9 : 4;
  const sheet = await browser.newPage({ viewport: { width: Math.round(cols * (w * k + 8)), height: 600 } });
  const tiles = bosses.map((b) => `<figure><img src="data:image/png;base64,${readFileSync(join(outDir, tag, `${b}.png`)).toString("base64")}" width="${Math.round(w * k)}" height="${Math.round(h * k)}"><figcaption>${b}</figcaption></figure>`).join("");
  await sheet.setContent(`<style>body{margin:0;background:#222;font:12px sans-serif;color:#eee;display:flex;flex-wrap:wrap}figure{margin:4px}figcaption{text-align:center}</style>${tiles}`);
  await sheet.waitForLoadState("load");
  await sheet.screenshot({ path: join(outDir, `sizes-${tag}.png`), fullPage: true });
  await sheet.close();
}
writeFileSync(join(outDir, "geometry.json"), JSON.stringify(geometry, null, 1));
console.log(bad ? `${bad} figure(s) off the window` : "every figure inside the window");
await browser.close();
