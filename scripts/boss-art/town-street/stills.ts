/**
 * The street town's final stills (Nov 5, round 1: the final art): every street by day on phone (390 x 844) and computer
 * (1440 x 900), the corner turn's three frames and a dusk frame, a night street, and the three art sheets. Written to
 * scripts/boss-art/out/town-art/ (the stills) and scripts/boss-art/out/town-buildings/ (the sheets).
 *
 *   npx tsx scripts/boss-art/town-street/stills.ts [only]
 *   CHECK=1 ... prints every figure's box on screen (any cut off by the frame is flagged either way)
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shoot, shootSheet } from "./view.ts";
import type { HomeId } from "./plan.ts";

const OUT = resolve("scripts/boss-art/out/town-art");
const SHEETS = resolve("scripts/boss-art/out/town-buildings");
const DAY = { dawn: 0, day: 1, dusk: 0, night: 0 };
const DUSK = { dawn: 0, day: 0, dusk: 1, night: 0 };
const NIGHT = { dawn: 0, day: 0, dusk: 0, night: 1 };
const PHONE = { W: 390, H: 844 };
const PC = { W: 1440, H: 900 };
type S = Record<string, unknown>;
type Boss = { id: HomeId; x: number; y: number; flip?: boolean };
type Bot = { x: number; y: number; dark?: boolean };

/**
 * Each street, standing on it 4 squares in front of its fronts (on the street's far half), the bosses out on their
 * sidewalks (in their wander boxes), a bot or two. The phone shows about 9 squares across at the fronts, the computer about
 * 17, so who's in view differs.
 */
const streets: { tag: string; phone: S & { bosses?: Boss[]; bots?: Bot[] }; computer: S & { bosses?: Boss[]; bots?: Bot[] } }[] = [
  {
    tag: "1-seam-street",
    phone: { x: 11.8, y: -1, heading: 0, bosses: [{ id: "gardener", x: 9.4, y: 2.1 }], bots: [{ x: 14.2, y: 1, dark: true }] },
    computer: { x: 13, y: -1, heading: 0, bosses: [{ id: "gardener", x: 9.6, y: 2.1 }, { id: "smudgy", x: 19.2, y: 2.1, flip: true }], bots: [{ x: 15.5, y: 1 }, { x: 7, y: 44.5, dark: true }] },
  },
  {
    tag: "2-fountain-street",
    phone: { x: 8, y: 14, heading: 0, bosses: [{ id: "timber", x: 5.6, y: 17.1 }], bots: [{ x: 9.6, y: 16, dark: true }] },
    computer: { x: 8.5, y: 14, heading: 0, bosses: [{ id: "timber", x: 5.6, y: 17.1 }, { id: "sawyer", x: 11.4, y: 17.1, flip: true }], bots: [{ x: 3.2, y: 15 }, { x: 13.5, y: 16, dark: true }] },
  },
  {
    tag: "3-colosseum-row",
    phone: { x: 37.6, y: 22, heading: 0, bosses: [{ id: "bigboy", x: 35.4, y: 25.1 }], bots: [{ x: 39.5, y: 24 }] },
    computer: { x: 36.5, y: 22, heading: 0, bosses: [{ id: "bigboy", x: 34.6, y: 25.1 }, { id: "blitz", x: 40.6, y: 25.1, flip: true }], bots: [{ x: 31, y: 23, dark: true }, { x: 42.5, y: 24 }] },
  },
  {
    tag: "4-upper-street",
    phone: { x: 38.6, y: 31, heading: 0, bosses: [{ id: "hollow", x: 38.4, y: 34.1 }], bots: [{ x: 36, y: 33, dark: true }] },
    computer: { x: 38, y: 31, heading: 0, bosses: [{ id: "moo", x: 34.3, y: 34.1 }, { id: "hollow", x: 39.2, y: 34.1, flip: true }], bots: [{ x: 43.5, y: 32 }, { x: 31.5, y: 33, dark: true }] },
  },
  {
    tag: "5-seam-avenue",
    phone: { x: -1, y: 9, heading: 90, bots: [{ x: 1, y: 7.5, dark: true }] },
    computer: { x: -1, y: 9.5, heading: 90, bots: [{ x: 1, y: 6.5, dark: true }, { x: 0, y: 13 }] },
  },
];
// The corner turn: walking west on Seam Street, turning north onto Seam Avenue at the crossing.
const turn = [
  { x: 3.2, y: -0.5, heading: 0, tag: "before" },
  { x: 0.2, y: 0.9, heading: 45, tag: "mid" },
  { x: -0.5, y: 4.6, heading: 90, tag: "after" },
];

const jobs: { file: string; scene: S }[] = [];
for (const [dev, box] of [["phone", PHONE], ["computer", PC]] as const) {
  for (const st of streets) jobs.push({ file: `${st.tag}-day-${dev}.png`, scene: { ...box, ...st[dev], near: "open", sky: DAY } });
  for (const t of turn) jobs.push({ file: `6-turn-${t.tag}-${dev}.png`, scene: { ...box, ...t, near: "open", sky: DAY } });
  jobs.push({ file: `6-turn-mid-dusk-${dev}.png`, scene: { ...box, ...turn[1]!, near: "open", sky: DUSK } });
  jobs.push({ file: `7-night-seam-street-${dev}.png`, scene: { ...box, ...streets[0]![dev], near: "open", sky: NIGHT } });
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
if (only !== "art") await shoot(only ? jobs.filter((j) => j.file.includes(only)) : jobs, OUT);
if (!only || only === "sheets") {
  await sheet("6-turn-phone.png", "The corner turn: Seam Street onto Seam Avenue (phone)", [
    { img: "6-turn-before-phone.png", cap: "Before: on Seam Street, walking west, the camera facing north." },
    { img: "6-turn-mid-phone.png", cap: "Mid-turn (45 degrees): the corner buildings' sides and roofs; the bigger ones behind show theirs." },
    { img: "6-turn-after-phone.png", cap: "After: on Seam Avenue, walking north, the camera facing east at the avenue's fronts." },
    { img: "6-turn-mid-dusk-phone.png", cap: "Mid-turn at dusk: the sides take the dusk tint; their windows light as the fronts' do." },
  ], 390);
  await sheet("6-turn-computer.png", "The corner turn: Seam Street onto Seam Avenue (computer)", [
    { img: "6-turn-before-computer.png", cap: "Before: Seam Street, facing north." },
    { img: "6-turn-mid-computer.png", cap: "Mid-turn: facing north-east." },
    { img: "6-turn-after-computer.png", cap: "After: Seam Avenue, facing east." },
  ], 720);
}
if (!only || only === "sheets" || only === "art") {
  await shootSheet(resolve(SHEETS, "buildings-sheet.png"), "sheetBuildings");
  await shootSheet(resolve(SHEETS, "homes-sheet.png"), "sheetHomes");
  await shootSheet(resolve(SHEETS, "dressing-sheet.png"), "sheetDressing");
}
