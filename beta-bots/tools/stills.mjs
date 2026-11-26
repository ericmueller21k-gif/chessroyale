// Mockup only (Nov 26, the beta-bots design): CSS and DOM injected over the live screens for the stills; not product code.
// Run against a local Worker on 8788 (npx wrangler dev --port 8788 --enable-containers=false --var TEST_SWITCHES:1 --var ENGINE_OFF:1):
//   node stills.mjs <out-dir> [all|home,search,versus,marks,crowd] [scale]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { phoneHome, computerColumn, stageSearch, hunbotOpponent } from "./mock-lib.mjs";
const { chromium, devices } = createRequire(import.meta.url)("playwright");
const [out = "stills", which = "all", scaleArg] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const base = "http://localhost:8788";
const browser = await chromium.launch();
const run = (name) => which === "all" || which.split(",").includes(name);
const init = () => { localStorage.setItem("brc.name", "Eric"); localStorage.setItem("hunchess.tutorial.dismissed", "1"); localStorage.setItem("hunchess.quests.seenDay", "9999999999999"); localStorage.setItem("hunchess.quests.noPop", "1"); };
const phone = (scheme, w = 390, h = 844) => ({ ...devices["iPhone 13"], viewport: { width: w, height: h }, ...(scaleArg ? { deviceScaleFactor: Number(scaleArg) } : {}), colorScheme: scheme, baseURL: base });
const computer = (scheme) => ({ viewport: { width: 1536, height: 730 }, deviceScaleFactor: scaleArg ? Number(scaleArg) : 2, colorScheme: scheme, baseURL: base });
async function open(dev, path) {
  const ctx = await browser.newContext(dev);
  await ctx.addInitScript(init);
  const page = await ctx.newPage();
  await page.goto(path);
  return { ctx, page };
}
const scroll = async (page) => page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));

for (const [tag, dev] of [["phone-dark", phone("dark")], ["phone-light", phone("light")], ["phone320-dark", phone("dark", 320, 568)], ["phone360-dark", phone("dark", 360, 640)]]) {
  if (!run("home") && !run(`home-${tag}`)) continue;
  const { ctx, page } = await open(dev, "/?nolanding");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await page.waitForTimeout(2500);
  await phoneHome(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/home-${tag}.png` });
  console.log(`home-${tag}`, JSON.stringify(await scroll(page)), JSON.stringify(await page.evaluate(() => { const r = document.querySelector(".mk-band").getBoundingClientRect(); return { h: r.height, w: r.width }; })));
  await ctx.close();
}
if (run("home") || run("home-computer")) {
  const { ctx, page } = await open(computer("dark"), "/?nolanding");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await page.waitForTimeout(3000);
  await computerColumn(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/home-computer-dark.png` });
  await ctx.close();
}
for (const [tag, dev, isPhone] of [["phone-dark", phone("dark"), true], ["phone320-dark", phone("dark", 320, 568), true], ["computer-dark", computer("dark"), false]]) {
  if (!run("search") && !run(`search-${tag}`)) continue;
  const { ctx, page } = await open(dev, `/1v1?nolanding&pool=mk${Date.now().toString(36)}${tag.length}&fewAfter=600`);
  await page.locator(".dv-st-foot").waitFor();
  await page.waitForTimeout(11500);
  if (!isPhone) await computerColumn(page);
  await stageSearch(page, isPhone);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/search-${tag}.png` });
  console.log(`search-${tag}`, JSON.stringify(await scroll(page)));
  await ctx.close();
}
for (const [tag, dev] of [["phone-dark", phone("dark")], ["computer-dark", computer("dark")]]) {
  if (!run("versus") && !run(`versus-${tag}`)) continue;
  const { ctx, page } = await open(dev, `/1v1?nolanding&pool=mv${Date.now().toString(36)}${tag.length}&fewAfter=2`);
  const bot = page.getByRole("button", { name: "Play a bot (unranked)" });
  await bot.waitFor({ timeout: 20000 });
  await bot.click();
  await page.locator(".dv-st-them .dv-st-name").waitFor();
  await page.waitForTimeout(700);
  if (tag.startsWith("computer")) await computerColumn(page);
  await hunbotOpponent(page);
  await page.screenshot({ path: `${out}/versus-${tag}.png` });
  await page.locator(".dv-strip.dv-them").waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  await hunbotOpponent(page);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/strip-${tag}.png` });
  await ctx.close();
}
for (const scheme of ["dark", "light"]) {
  if (!run("marks") && !run(`marks-${scheme}`)) continue;
  const { ctx, page } = await open(computer(scheme), "/?nolanding");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await page.waitForTimeout(2000);
  const { marksSheet } = await import("./mock-lib.mjs");
  await computerColumn(page);
  await marksSheet(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/marks-computer-${scheme}.png` });
  await ctx.close();
}
if (run("crowd")) {
  const { ctx, page } = await open(phone("dark"), "/?nolanding");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  await page.getByRole("radio", { name: /50 v 50/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.locator(".fd-queue-line").waitFor();
  await page.waitForTimeout(3500);
  const { base, bandHtml, BAND_TEXT } = await import("./mock-lib.mjs");
  await base(page);
  await page.evaluate((html) => { const h = document.querySelector(".fd-page-head"); const b = document.createElement("button"); b.className = "mk-band"; b.style.margin = "8px 0 0"; b.innerHTML = html; h.after(b); }, bandHtml(BAND_TEXT));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/queue-crowd-phone-dark.png` });
  await ctx.close();
}
await browser.close();
