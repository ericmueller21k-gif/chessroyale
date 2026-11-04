// The figures beside a boss battle's board, every boss with a character and the God King, at a computer's sizes (and a
// phone's): one still per boss and size, a contact sheet per size, and every figure's drawn box checked against the window
// (Eric, Nov 4: a figure is always whole on screen at rest; over the board or a menu is fine). Against a running server
// (`npx wrangler dev --port 8971 …`, the e2e's flags: playwright.config.ts) so the Hidden Boss, an admin's, is there too.
//   node scripts/stills-battle-sides.mjs <out-dir> [sizes, e.g. 1440x900,2000x1250 | phone] [boss ids, comma-separated] [base url]
// Writes <out-dir>/<w>x<h>/<boss>.png, <out-dir>/sizes-<w>x<h>.png (the sheet) and <out-dir>/geometry.json; prints any figure
// that leaves the window. docs/decisions/2026-11-04-battle-desktop-fixes.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";

const ALL = ["gingerbread", "clown", "grex", "hollow", "bigboy", "sawyer", "pig", "alfil", "hopper", "smudgy", "moo", "gardener", "tiger", "folio", "timber", "dash", "recluse"];
const [out = "battle-sides", sizesArg = "1280x800,1440x900,1920x1080,2000x1250", bossArg = "", base = "http://localhost:8971"] = process.argv.slice(2);
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

for (const size of sizes) {
  const phone = size === "phone";
  const tag = phone ? "phone" : `${size[0]}x${size[1]}`;
  mkdirSync(join(outDir, tag), { recursive: true });
  geometry[tag] = {};
  const context = await browser.newContext(phone ? { ...devices["iPhone 13"] } : { ...devices["Desktop Chrome"], viewport: { width: size[0], height: size[1] } });
  for (const boss of bosses) {
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log(tag, boss, "pageerror", e.message));
    // (An admin, for the Hidden Boss's tile: as e2e/helpers.ts' asAdmin.)
    await page.route("**/api/me*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      try {
        const res = await route.fetch();
        const body = await res.json().catch(() => null);
        await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
      } catch {}
    });
    await page.goto(`${base}/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${boss}`);
    await page.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
    await page.getByRole("main").getByRole("button", { name: "START" }).click();
    const t0 = Date.now();
    while (Date.now() - t0 < 60_000 && (await page.evaluate(() => window.match?.phase.kind ?? "none")) !== "play") await page.waitForTimeout(250);
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
