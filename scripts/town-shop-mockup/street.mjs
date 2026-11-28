// MOCKUP ONLY. The street still: you at the shop's door on South Street, its "Go in" card.
//   node scripts/town-shop-mockup/street.mjs <outDir> [base=http://localhost:5199]
import { chromium } from "playwright";
const OUT = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:5199";
const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  computer: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const only = (process.env.ONLY ?? "phone,computer").split(",");
await Promise.all(Object.entries(SIZES).filter(([k]) => only.includes(k)).map(async ([size, opts]) => {
  const page = await (await browser.newContext(opts)).newPage();
  page.on("pageerror", (e) => console.log(size, "pageerror", e.message));
  await page.goto(`${BASE}/town?sky=day`);
  await page.waitForFunction(() => document.querySelector("canvas.town-canvas")?.dataset.ready === "1", null, { timeout: 90_000 });
  await page.waitForTimeout(1500);
  const box = await page.locator("canvas.town-canvas").boundingBox();
  // Walk to the square before the door: glide the camera there, tap it, wait until you stand on it.
  const GOAL = [30, 15];
  for (let i = 0; i < 30; i++) {
    const you = await page.evaluate(() => window.__townYou());
    if (you.c === GOAL[0] && you.r === GOAL[1] && !you.moving) break;
    if (!you.moving) {
      await page.evaluate((g) => window.__townGlide(g), GOAL);
      await page.waitForTimeout(1800);
      const at = await page.evaluate((g) => window.__townAt("tap-square", g), GOAL);
      if (at) await page.mouse.click(box.x + at.x, box.y + at.y);
    }
    await page.waitForTimeout(2500);
  }
  console.log(size, JSON.stringify(await page.evaluate(() => window.__townYou())));
  await page.waitForTimeout(2500);
  if (process.env.CARD !== "0")
    await page.evaluate(() => {
      const card = document.querySelector(".town-card");
      card.className = "town-card town-door";
      card.innerHTML = '<h2>The Pawn Shop</h2><button type="button" class="town-btn primary">Go in</button>';
      card.style.display = "";
      const you = window.__townCam().you;
      const host = card.offsetParent.getBoundingClientRect();
      const w = card.offsetWidth;
      card.style.left = `${Math.round(host.width / 2 - w / 2)}px`;
      card.style.top = `${Math.max(10, Math.round((you ? you.y : host.height / 2) - card.offsetHeight - 235))}px`;
    });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/1-street-${size}.png` });
}));
await browser.close();
