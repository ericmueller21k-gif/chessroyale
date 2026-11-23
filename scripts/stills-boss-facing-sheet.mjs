// A before/after sheet per platform from two runs of scripts/stills-boss-facing.mjs (the boss-facing check, Nov 17):
//   node scripts/stills-boss-facing-sheet.mjs <before dir> <after dir> <out dir>
// Writes <out>/phone.png and <out>/desktop.png: for each place, the bosses before (top row) and after (bottom row), the way each faces.
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const [before, after, outArg] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(outArg, { recursive: true });
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await b.newPage({ viewport: { width: 2000, height: 1000 } });
const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
for (const plat of ["phone", "desktop"]) {
  const places = readdirSync(after).filter((d) => d.startsWith(`${plat}-`) && !d.endsWith(".png"));
  const rows = places
    .map((place) => {
      const ids = readdirSync(`${after}/${place}`).map((f) => f.replace(/\.png$/, ""));
      const one = (dir, id) => (existsSync(`${dir}/${place}/${id}.png`) ? `<img src="${img(`${dir}/${place}/${id}.png`)}">` : "<i>none</i>");
      // (Each boss a pair: before over after.)
      return `<h2>${place.replace(`${plat}-`, "")} <small>(each boss: before above, after below)</small></h2><div class="pairs">${ids.map((id) => `<figure>${one(before, id)}${one(after, id)}<figcaption>${id}</figcaption></figure>`).join("")}</div>`;
    })
    .join("");
  await page.setContent(`<style>body{margin:0;padding:8px;width:1984px;background:#2a2c33;color:#eee;font:13px sans-serif}h2{margin:12px 0 4px;color:#f2c14e}small{color:#aaa;font-weight:normal}.pairs{display:flex;flex-wrap:wrap;gap:6px}figure{margin:0;text-align:center;background:#111;padding:3px;display:flex;flex-direction:column;gap:3px;align-items:center}img{height:130px;display:block}</style><h1 style="margin:0">${plat}: every boss, before and after</h1>${rows}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outArg}/${plat}.png`, fullPage: true });
  console.log("wrote", `${outArg}/${plat}.png`);
}
await b.close();
