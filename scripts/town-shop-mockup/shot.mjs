// node shot.mjs <url> <out.png> [phone|computer] [waitMs] [evalJs]
import { chromium } from "playwright";
const [url, out, size = "phone", wait = "3000", js = ""] = process.argv.slice(2);
const SIZES = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, computer: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } };
const dark = process.env.DARK === "1";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ ...SIZES[size], colorScheme: dark ? "dark" : "light" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console", m.text().slice(0, 300)));
await page.goto(url);
await page.waitForTimeout(Number(wait));
if (js) console.log(JSON.stringify(await page.evaluate(js)));
await page.waitForTimeout(Number(process.env.POST ?? 600));
await page.screenshot({ path: out });
await browser.close();
