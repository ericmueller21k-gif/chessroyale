import { expect, test } from "@playwright/test";

test("installable: manifest, icons and a service worker that precaches the engine", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain("/engine/stockfish-19-lite-single.wasm");
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), { timeout: 10_000 }).toBe(true);
});
