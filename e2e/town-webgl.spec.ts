import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { START } from "../packages/app/src/town/world.ts";
import { test } from "./helpers.ts";

/**
 * The town drawn with WebGL 2 (`?gl=1`, Oct 30; docs/decisions/2026-10-30-town-webgl.md): the same picture as Canvas 2D.
 * One page, one frame held (the same moment, camera and people), drawn by each backend in turn (`__townBackend`), the two
 * compared pixel by pixel. Edges differ a little (the GPU's 4x multisampling against the 2D canvas's own antialiasing, a
 * nearest texel picked on the other side of a tie), so the check is on how many pixels differ and by how much, and it
 * reports the largest difference and where it is. `TOWN_GL_STILLS=<dir>`: full-page stills of both are saved there.
 */

test.use({ actionTimeout: 15_000 });
// (The chat log's box lies over a corner of the map and takes taps there; the statue's tap aims at the map, as town.spec.ts's do.)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

type Hooks = {
  __townHold: (on: boolean) => void;
  __townBackend: (k: "2d" | "webgl") => string | null;
  __townPaint: () => { backend: string; drawCalls: number; lost: boolean } | null;
  __townGlide: (sq: readonly [number, number]) => void;
  __townAt: (k: string, id: string) => { x: number; y: number } | null;
  __townCam: () => { quote: boolean };
};
const canvas = (p: Page) => p.locator("canvas.town-canvas");

/** The canvas's pixels now, kept in the page (they're compared there: megabytes don't cross over). */
const keep = (p: Page, name: string) =>
  p.evaluate((name) => {
    const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!;
    const w = window as unknown as Record<string, ImageData>;
    w[name] = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height);
  }, name);

/** The two kept frames compared: each pixel's largest channel difference. */
const compare = (p: Page) =>
  p.evaluate(() => {
    const w = window as unknown as Record<string, ImageData>;
    const a = w.__px2d!;
    const b = w.__pxgl!;
    let max = 0;
    let at = [0, 0];
    let sum = 0;
    let over8 = 0;
    let over32 = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a.data[i + c]! - b.data[i + c]!));
      sum += d;
      if (d > 8) over8++;
      if (d > 32) over32++;
      if (d > max) ((max = d), (at = [(i / 4) % a.width, Math.floor(i / 4 / a.width)]));
    }
    const n = a.width * a.height;
    return { size: [a.width, a.height], same: a.width === b.width && a.height === b.height, max, at, mean: sum / n, over8: over8 / n, over32: over32 / n };
  });

const scenes = [
  { name: "the park by day", sky: "day", statue: false },
  { name: "the park at night (the lights)", sky: "night", statue: false },
  { name: "a statue up close at night", sky: "night", statue: true },
] as const;

for (const sc of scenes) {
  test(`WebGL draws the town as Canvas 2D does: ${sc.name}, the same frame by both, compared pixel by pixel`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`/town?sky=${sc.sky}&gl=1`);
    await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
    await expect(canvas(page), "?gl=1 draws with WebGL").toHaveAttribute("data-backend", "webgl");
    if (sc.statue) {
      // A tap on the marble statue walks you up to it and the camera comes in close (a slow machine: it may take a while).
      const box = (await canvas(page).boundingBox())!;
      const at = await page.evaluate(() => (window as unknown as Hooks).__townAt("statue", "marble"));
      expect(at, "the statue is drawn").not.toBeNull();
      await page.mouse.click(box.x + at!.x, box.y + at!.y);
      await expect.poll(() => page.evaluate(() => (window as unknown as Hooks).__townCam().quote), { timeout: 60_000 }).toBe(true);
    } else {
      // A fixed camera: over the park, a little ahead of where you start.
      await page.evaluate(([c, r]) => (window as unknown as Hooks).__townGlide([c, r]), [START.c, START.r - 2] as const);
    }
    await page.waitForTimeout(2500);
    await page.evaluate(() => (window as unknown as Hooks).__townHold(true));
    const gl = await page.evaluate(() => (window as unknown as Hooks).__townPaint());
    expect(gl?.backend).toBe("webgl");
    expect(gl!.drawCalls, "a few draw calls a frame").toBeLessThan(60);
    await keep(page, "__pxgl");
    const dir = process.env.TOWN_GL_STILLS;
    const still = async (b: string) => {
      if (!dir) return;
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${info.project.name}-${sc.sky}${sc.statue ? "-statue" : ""}-${b}.png`, fullPage: true });
    };
    await still("webgl");
    expect(await page.evaluate(() => (window as unknown as Hooks).__townBackend("2d"))).toBe("2d");
    await expect(canvas(page)).toHaveAttribute("data-backend", "2d");
    await keep(page, "__px2d");
    await still("2d");
    const r = await compare(page);
    const report = `${info.project.name} ${sc.name}: largest difference ${r.max} at (${r.at}) of ${r.size.join(" x ")} device pixels; mean ${r.mean.toFixed(2)}; ${(r.over8 * 100).toFixed(2)}% over 8, ${(r.over32 * 100).toFixed(3)}% over 32; ${gl!.drawCalls} draw calls`;
    console.log(report);
    info.annotations.push({ type: "comparison", description: report });
    expect(r.same, "the same size").toBe(true);
    // Edges only: few pixels differ, and by little. A shift (anything a pixel out of place) or a missing piece fails these.
    expect(r.mean, report).toBeLessThan(3);
    expect(r.over8, report).toBeLessThan(0.05);
    expect(r.over32, report).toBeLessThan(0.004);
    expect(errors).toEqual([]);
  });
}

test("WebGL's context lost: nothing drawn until it's back, then it draws again; lost twice within a minute, Canvas 2D for the page", async ({ page }) => {
  await page.goto("/town?sky=day&gl=1");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
  const lose = (restore: boolean) =>
    page.evaluate(async (restore) => {
      const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!;
      const ext = (cv.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!;
      const lost = new Promise((ok) => cv.addEventListener("webglcontextlost", ok, { once: true }));
      ext.loseContext();
      await lost;
      if (restore) {
        // (Restoring is allowed once the lost event's dispatch is over.)
        await new Promise((ok) => setTimeout(ok, 50));
        const back = new Promise((ok) => cv.addEventListener("webglcontextrestored", ok, { once: true }));
        ext.restoreContext();
        await back;
      }
    }, restore);
  const paint = () => page.evaluate(() => (window as unknown as Hooks).__townPaint()!);
  const colors = () =>
    canvas(page).evaluate((cv: HTMLCanvasElement) => {
      const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return seen.size;
    });
  await lose(true);
  // Back: drawing again with WebGL (its textures made again), the world not blank.
  await expect.poll(async () => (await paint()).lost, { message: "back" }).toBe(false);
  expect((await paint()).backend).toBe("webgl");
  expect(await colors(), "the world drawn again with WebGL").toBeGreaterThan(40);
  await lose(false);
  await expect(canvas(page), "lost twice: Canvas 2D").toHaveAttribute("data-backend", "2d");
  expect((await paint()).backend).toBe("2d");
  expect(await colors(), "the world drawn with Canvas 2D").toBeGreaterThan(40);
});

test("without ?gl=1 the town draws with Canvas 2D", async ({ page }) => {
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", process.env.TOWN_GL_BUILD ? "webgl" : "2d");
});
