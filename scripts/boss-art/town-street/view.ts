/**
 * The street town's mockup stills (Nov 5): bundles harness.ts (esbuild) and draws scenes in Chromium, one PNG each.
 *
 *   npx tsx scripts/boss-art/town-street/view.ts <scenes.json | name> <out dir>
 *
 * A scene file is a list of { file, scene } (harness.ts Scene). `CHECK=1` prints each figure's box and flags any cut off.
 */
import { build } from "esbuild";
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export async function bundle(): Promise<string> {
  const out = await build({ entryPoints: [resolve(HERE, "harness.ts")], bundle: true, write: false, format: "iife", platform: "browser", logLevel: "error" });
  return out.outputFiles[0]!.text;
}

export async function shoot(jobs: { file: string; scene: Record<string, unknown> }[], dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const js = await bundle();
  const browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });
  try {
    for (const job of jobs) {
      const s = job.scene as { W: number; H: number };
      const page = await browser.newPage({ viewport: { width: s.W, height: s.H }, deviceScaleFactor: 2 });
      await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>`);
      await page.addScriptTag({ content: js });
      const res = (await page.evaluate(async (scene) => {
        const t = (window as unknown as { townStreet: { draw: (c: HTMLCanvasElement, s: unknown) => Promise<unknown> } }).townStreet;
        return t.draw(document.getElementById("c") as HTMLCanvasElement, scene);
      }, job.scene)) as { figures: { name: string; x0: number; y0: number; x1: number; y1: number }[]; strips: number; quads: number; fill: number; planes: number };
      await page.locator("#c").screenshot({ path: resolve(dir, job.file) });
      await page.close();
      const cut = res.figures.filter((f) => f.x0 < 0 || f.y0 < 0 || f.x1 > s.W || f.y1 > s.H);
      console.log(`wrote ${job.file} (${res.strips} wall strips, ${res.quads} roof quads, buildings fill ${res.fill} screens, ${res.planes} things)${cut.length ? `  CUT OFF: ${cut.map((f) => f.name).join(", ")}` : ""}`);
      if (process.env.CHECK) for (const f of res.figures) console.log(`   ${f.name}: ${f.x0.toFixed(0)},${f.y0.toFixed(0)} - ${f.x1.toFixed(0)},${f.y1.toFixed(0)}`);
    }
  } finally {
    await browser.close();
  }
}

/** A sheet (harness.ts sheetBuildings, sheetHomes, sheetDressing). */
export async function shootSheet(file: string, fn: "sheetBuildings" | "sheetHomes" | "sheetDressing"): Promise<void> {
  const js = await bundle();
  const browser = await chromium.launch(existsSync(chromium.executablePath()) ? {} : { executablePath: "/opt/pw-browsers/chromium", args: ["--headless", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(`<html><body style="margin:0"><canvas id=c></canvas></body></html>`);
  await page.addScriptTag({ content: js });
  await page.evaluate((f) => (window as unknown as { townStreet: Record<string, (c: HTMLCanvasElement) => Promise<void>> }).townStreet[f]!(document.getElementById("c") as HTMLCanvasElement), fn);
  await page.locator("#c").screenshot({ path: file });
  await browser.close();
  console.log(`wrote ${file}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, dir = "."] = process.argv.slice(2);
  const jobs = JSON.parse(readFileSync(file!, "utf8"));
  await shoot(jobs, dir);
}
