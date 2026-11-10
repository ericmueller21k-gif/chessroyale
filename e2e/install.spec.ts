import { expect } from "@playwright/test";
import { test } from "./helpers.ts";

test("installable: manifest, icons and a service worker that precaches the engine", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain("/engine/stockfish-19-lite-single.wasm");
  // Pictures and the demo video aren't precached (Nov 10, phone load): pictures are kept when first shown, the video streams.
  const files = JSON.parse(/const FILES = (\[.*?\]);/s.exec(sw)![1]!) as string[];
  expect(files.filter((f) => /\.(png|jpe?g|webp|gif|mp4|webm)$/.test(f))).toEqual([]);
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), { timeout: 10_000 }).toBe(true);
});
