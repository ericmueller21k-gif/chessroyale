// MOCKUP ONLY. One still of the mockup page: node shot.mjs <url> <out.png> <w> <h> <dsf> [sheet=1] [evalJs]
import { chromium } from "playwright";
const [url, out, w = "1280", h = "800", dsf = "2", sheet = "1", js = ""] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const phone = +w < 500;
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: phone, hasTouch: phone, colorScheme: process.env.DARK === "1" ? "dark" : "light" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console", m.text().slice(0, 300)));
page.on("response", (r) => r.status() >= 400 && console.log("http", r.status(), r.url()));
await page.goto(url);
await page.waitForTimeout(+(process.env.WAIT ?? 2500));
if (js) console.log(JSON.stringify(await page.evaluate(js)));
if (sheet === "1") await page.locator(".sheet").screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: sheet === "full" });
await browser.close();
