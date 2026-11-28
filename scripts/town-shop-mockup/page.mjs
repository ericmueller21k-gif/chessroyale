// MOCKUP ONLY. One still of a page: node page.mjs <url> <out.png> <w> <h> [fullPage=0] [waitMs=2500]
import { chromium } from "playwright";
const [url, out, w = "1280", h = "800", full = "0", wait = "2500"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, colorScheme: process.env.DARK === "1" ? "dark" : "light" })).newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console", m.text().slice(0, 300)));
await page.goto(url);
await page.waitForSelector("html[data-fonts]", { timeout: 30000 }).catch(() => console.log("no fonts flag"));
await page.waitForTimeout(+wait);
if (full === "1") {
  const el = page.locator(".sheet");
  await el.screenshot({ path: out });
} else await page.screenshot({ path: out });
await browser.close();
