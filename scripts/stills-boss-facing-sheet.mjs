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
      const strip = (dir, label) =>
        `<div class="row"><b>${label}</b>${ids.map((id) => (existsSync(`${dir}/${place}/${id}.png`) ? `<figure><img src="${img(`${dir}/${place}/${id}.png`)}"><figcaption>${id}</figcaption></figure>` : `<figure class="none">${id}</figure>`)).join("")}</div>`;
      return `<h2>${place.replace(`${plat}-`, "")}</h2>${strip(before, "Before")}${strip(after, "After")}`;
    })
    .join("");
  await page.setContent(`<style>body{margin:0;padding:8px;background:#2a2c33;color:#eee;font:13px sans-serif}h2{margin:10px 0 4px;color:#f2c14e}.row{display:flex;gap:4px;align-items:flex-end;margin-bottom:4px}.row b{width:52px}figure{margin:0;text-align:center;background:#111}img{height:120px;display:block}.none{width:60px;height:120px}</style><h1 style="margin:0">${plat}: every boss, before and after</h1>${rows}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outArg}/${plat}.png`, fullPage: true });
  console.log("wrote", `${outArg}/${plat}.png`);
}
await b.close();
