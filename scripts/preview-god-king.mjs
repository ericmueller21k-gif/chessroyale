// The God King's art sheet as a PNG: white and black, light and dark grounds (standing, cracked, fallen, portraits),
// optionally the Last Stand's banner held mid-way and the result screen's epilogue.
//   node scripts/preview-god-king.mjs out.png [banner=1] [epilogue=rise|down]
// Starts the app's dev server, screenshots /god-king-preview.html, stops. Look at the PNG before shipping new art.
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const [out = "god-king-preview.png", ...rest] = process.argv.slice(2);
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 400 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error("page:", e.message));
await page.goto(`${url}god-king-preview.html?${rest.join("&")}`);
// Hold the banner mid-way (just after its text lands), and let the epilogue play out.
await page.addStyleTag({ content: ".fight-banner, .fight-banner * { animation-delay: -0.9s !important; animation-play-state: paused !important; }" });
await page.waitForTimeout(rest.some((r) => r.startsWith("epilogue")) ? 3600 : 1500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
await server.close();
console.log(`saved ${out}`);
