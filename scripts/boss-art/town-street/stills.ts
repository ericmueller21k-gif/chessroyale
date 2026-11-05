/**
 * Every still of the street town mockup (Nov 5): the game-camera views on phone (390 x 844) and computer (1440 x 900), the
 * corner turn's three frames, the near-side options side by side, the seam; written to scripts/boss-art/out/town-street/.
 *
 *   npx tsx scripts/boss-art/town-street/stills.ts [only]
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shoot, shootSheet } from "./view.ts";
import type { Lot } from "./plan.ts";

const OUT = resolve("scripts/boss-art/out/town-street");
const DAY = { dawn: 0, day: 1, dusk: 0, night: 0 };
const DUSK = { dawn: 0, day: 0, dusk: 1, night: 0 };
const PHONE = { W: 390, H: 844 };
const PC = { W: 1440, H: 900 };
type S = Record<string, unknown>;

// The near row for the `cut` comparison: Seam Street's south side lined too (rows 40..42, fronts facing north, away from us).
const nearRow: (Lot & { back: true })[] = [];
{
  const items: [Lot["id"], number][] = [["townhouse", 2], ["flats", 3], ["cottage", 3], ["skinny", 3], ["shop", 2], ["bakery", 3], ["townhouse", 2], ["flats", 3]];
  let c = 3, n = 0;
  while (c < 21) {
    const [id, w] = items[n % items.length]!;
    if (c + w > 21) break;
    nearRow.push({ kind: "house", id, v: n % 4, c0: c, r0: 40, w, d: 3, facing: "S", street: "seam-st", back: true });
    c += w;
    n++;
  }
}

// Per device: the phone shows about 9 squares across at the fronts, the computer about 17, so who's in view differs.
const street = {
  phone: { x: 11.8, y: -1, heading: 0, near: "open", bosses: [{ id: "gardener", x: 9.4, y: 2.1 }], bots: [{ x: 14.2, y: 1, dark: true }] },
  computer: { x: 13, y: -1, heading: 0, near: "open", bosses: [{ id: "gardener", x: 9.6, y: 2.1 }, { id: "smudgy", x: 19.2, y: 2.1, flip: true }], bots: [{ x: 15.5, y: 1 }, { x: 7, y: 44.5, dark: true }] },
};
const park = {
  phone: { x: 22.5, y: 11.5, heading: 0, near: "open", bots: [{ x: 20, y: 12, dark: true }, { x: 25, y: 17 }] },
  computer: { x: 22.5, y: 11.5, heading: 0, near: "open", bots: [{ x: 18, y: 12 }, { x: 20, y: 12, dark: true }, { x: 27, y: 17 }, { x: 25, y: 17, dark: true }] },
};
const turn = [
  { x: 3.2, y: -0.5, heading: 0, tag: "before" },
  { x: 0.2, y: 0.9, heading: 45, tag: "mid" },
  { x: -0.5, y: 4.6, heading: 90, tag: "after" },
];
const seam = { x: -0.5, y: -0.5, heading: 0, near: "open", seam: true, bots: [{ x: 3, y: 2, dark: true }] };

const jobs: { file: string; scene: S }[] = [];
for (const [dev, box] of [["phone", PHONE], ["computer", PC]] as const) {
  jobs.push({ file: `1-park-${dev}.png`, scene: { ...box, ...park[dev], sky: DAY } });
  jobs.push({ file: `2-street-day-${dev}.png`, scene: { ...box, ...street[dev], sky: DAY } });
  jobs.push({ file: `3-street-sunset-${dev}.png`, scene: { ...box, ...street[dev], sky: DUSK } });
  for (const t of turn) jobs.push({ file: `4-turn-${t.tag}-${dev}.png`, scene: { ...box, ...t, near: "open", sky: DAY } });
  jobs.push({ file: `5-near-open-${dev}.png`, scene: { ...box, ...street[dev], sky: DAY } });
  jobs.push({ file: `5-near-cut-${dev}.png`, scene: { ...box, ...street[dev], near: "cut", nearRow, sky: DAY } });
  jobs.push({ file: `6-seam-${dev}.png`, scene: { ...box, ...seam, sky: DAY } });
}

/** Pictures side by side on one sheet, each with a caption, a title over them. */
async function sheet(file: string, title: string, cells: { img: string; cap: string }[], cellW: number) {
  const imgs = cells.map((c) => `<figure><img src="data:image/png;base64,${readFileSync(resolve(OUT, c.img)).toString("base64")}" style="width:${cellW}px"><figcaption>${c.cap}</figcaption></figure>`).join("");
  const html = `<html><body style="margin:0;background:#f4efe4;font-family:Archivo,Arial,sans-serif;color:#2a2a2a"><div id=s style="display:inline-block;padding:20px 24px"><h1 style="font-size:22px;margin:0 0 4px">${title}</h1><div style="display:flex;gap:18px;align-items:flex-start">${imgs}</div></div><style>figure{margin:0}figcaption{font-size:14px;line-height:1.35;margin-top:8px;max-width:${cellW}px}img{display:block;border-radius:6px;box-shadow:0 1px 4px #0003}</style></body></html>`;
  const browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.locator("#s").screenshot({ path: resolve(OUT, file) });
  await browser.close();
  console.log(`wrote ${file}`);
}

const only = process.argv[2];
await shoot(only ? jobs.filter((j) => j.file.includes(only)) : jobs, OUT);
if (!only || only === "sheets") {
  await sheet("4-turn-phone.png", "Turning the corner from Seam Street onto Seam Avenue (phone)", [
    { img: "4-turn-before-phone.png", cap: "Before: on Seam Street, walking west, the camera facing north." },
    { img: "4-turn-mid-phone.png", cap: "Mid-turn: you've turned north at the crossing; the camera swings round, halfway (facing north-east)." },
    { img: "4-turn-after-phone.png", cap: "After: on Seam Avenue, walking north; the camera faces east, at the avenue's fronts." },
  ], 390);
  await sheet("4-turn-computer.png", "Turning the corner from Seam Street onto Seam Avenue (computer)", [
    { img: "4-turn-before-computer.png", cap: "Before: Seam Street, facing north." },
    { img: "4-turn-mid-computer.png", cap: "Mid-turn: facing north-east." },
    { img: "4-turn-after-computer.png", cap: "After: Seam Avenue, facing east." },
  ], 720);
  await sheet("5-near-phone.png", "The near side of a street: two options (phone, Seam Street)", [
    { img: "5-near-open-phone.png", cap: "A. No near row (recommended): the near side is the back gardens of the next street's row: a hedge, flower beds, bushes, a shed. Nothing tall, nothing to draw from behind." },
    { img: "5-near-cut-phone.png", cap: "B. A near row, cut away: buildings on both sides, the near ones drawn as their backs cut off at knee height (a dollhouse cut)." },
  ], 390);
  await sheet("5-near-computer.png", "The near side of a street: two options (computer)", [
    { img: "5-near-open-computer.png", cap: "A. No near row (recommended)." },
    { img: "5-near-cut-computer.png", cap: "B. A near row, cut away." },
  ], 720);
}
if (!only || only === "facades") await shootSheet(resolve(OUT, "7-everyday-buildings.png"));
