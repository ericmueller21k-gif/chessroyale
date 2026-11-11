// The room's back, WebGL's against the 2D way's (Nov 11, docs/decisions/2026-11-11-room-smooth.md): for each room, at rest and with the
// view part way through a walk, `__shopBackDiff()` (the back drawn both ways at that view, compared pixel for pixel) and a still of
// the whole screen each way (`back=2d` draws as before Nov 11).
//
//   node scripts/stills-room.mjs [base=http://localhost:8790] [rooms=smudgy,zebra,clown] [out=dir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const BASE = arg("base", "http://localhost:8790");
const ROOMS = arg("rooms", "smudgy,zebra,clown").split(",");
const OUT = arg("out", "stills");
const NAMES = { smudgy: "Smudgy's Art Gallery", zebra: "Rolling Dough", clown: "Boingo's Funhouse", gardener: "Puddles' Botanical Garden", hollow: "Hollow Peak" };
const SIZES = {
  phone: { viewport: { width: 428, height: 746 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  computer: { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 2 },
};
mkdirSync(OUT, { recursive: true });

async function enter(page, id) {
  const name = NAMES[id] ?? id;
  await page.waitForFunction(() => document.querySelector("canvas.town-canvas")?.dataset.ready === "1", null, { timeout: 60_000 });
  await page.evaluate((h) => window.__townGlide?.(h), id);
  const card = page.getByRole("dialog", { name, exact: true });
  // (A tap walks you to the door first: its card opens as you get there. A tap every 3 s.)
  for (let i = 0; i < 12 && !(await card.isVisible()); i++) {
    await page.waitForTimeout(i ? 3000 : 1500);
    const at = await page.evaluate((h) => window.__townAt?.("home", h) ?? null, id);
    if (!at) continue;
    const box = await page.locator("canvas.town-canvas").boundingBox();
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    await page.mouse.click(box.x + at.x, box.y + at.y);
  }
  await card.getByRole("button", { name: "Go in" }).click();
  await page.waitForFunction(() => document.querySelector("canvas.town-shop-canvas")?.dataset.ready === "1", null, { timeout: 30_000 });
  await page.waitForTimeout(2000);
}

// (The repo pins its own Playwright: a pre-installed Chromium is taken from PW_CHROMIUM when it is set.)
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
for (const [size, opts] of Object.entries(SIZES))
  for (const id of ROOMS)
    for (const mode of ["gl", "2d"]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      if (mode === "2d") await page.addInitScript(() => (window.__shopNoGl = true));
      if (id === "zebra")
        await page.route("**/api/me*", async (route) => {
          if (route.request().method() !== "GET") return route.continue();
          const res = await route.fetch();
          const body = await res.json().catch(() => null);
          await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
        });
      await page.goto(`${BASE}/town?sky=day`);
      await enter(page, id);
      const still = await page.evaluate(() => window.__shopStill?.());
      const rest = mode === "gl" ? await page.evaluate(() => window.__shopBackDiff?.()) : null;
      await page.screenshot({ path: `${OUT}/${size}-${id}-rest-${mode}.png` });
      // Part way through a walk: the view dragged (a drag looks around, as a walk moves it), let go mid-glide.
      const box = await page.locator("canvas.town-shop-canvas").boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height * 0.6;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 37, cy - 61, { steps: 4 });
      const mid = mode === "gl" ? await page.evaluate(() => window.__shopBackDiff?.()) : null;
      await page.screenshot({ path: `${OUT}/${size}-${id}-mid-${mode}.png` });
      await page.mouse.up();
      console.log(JSON.stringify({ size, id, mode, still, rest, mid }));
      await ctx.close();
    }
await browser.close();
