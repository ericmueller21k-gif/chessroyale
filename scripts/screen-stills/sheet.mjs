// The end screens' sheet (Nov 25; scripts/screen-stills/end-screens.spec.ts): every picture in the folder, one row a case, each size side by
// side and labeled, into <out>/end-screens.png (and .html). `node scripts/screen-stills/sheet.mjs [out]`.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const OUT = resolve(process.argv[2] || process.env.STILLS_OUT || "stills-out/end-screens");
const SIZES = [
  ["phone-390x844", "phone 390×844", true],
  ["phone-375x667", "phone 375×667", true],
  ["laptop-1536x730", "laptop 1536×730 (125%)", false],
  ["desktop-1735x1035", "Eric's desktop window 1735×1035", false],
  ["desktop-1920x960", "desktop 1920×960", false],
];
const files = readdirSync(OUT).filter((f) => f.endsWith(".png") && f.includes("--"));
const names = [...new Set(files.map((f) => f.split("--")[0]))].sort();
const img = (f, label, h) =>
  `<figure><figcaption>${label}</figcaption><img style="height:${h}px" src="data:image/png;base64,${readFileSync(`${OUT}/${f}`).toString("base64")}"></figure>`;
const rows = names.map((name) => {
  const cells = [];
  for (const [id, label, phone] of SIZES) {
    if (files.includes(`${name}--${id}.png`)) cells.push(img(`${name}--${id}.png`, label, phone ? 560 : 420));
    if (files.includes(`${name}--${id}-page.png`)) cells.push(img(`${name}--${id}-page.png`, `${label}: the whole page`, 900));
  }
  return `<section><h2>${name}</h2><div class="row">${cells.join("")}</div></section>`;
});
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#fff;font:14px system-ui,sans-serif;width:max-content}
h1{margin:0 0 8px}h2{margin:18px 0 6px;font-size:18px}.row{display:flex;gap:14px;align-items:flex-start}figure{margin:0}
figcaption{font-weight:700;margin-bottom:4px}img{display:block;border:1px solid #999}</style>
<h1>End screens (${new Date().toISOString().slice(0, 16)} UTC): every case at every size</h1>${rows.join("")}`;
writeFileSync(`${OUT}/end-screens.html`, html);
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.setContent(html);
await page.screenshot({ path: `${OUT}/end-screens.png`, fullPage: true });
await browser.close();
console.log(`${OUT}/end-screens.png: ${names.length} rows`);
