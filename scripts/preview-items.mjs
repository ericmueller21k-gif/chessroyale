// The item fitting sheet as a PNG: every crate item (or some) on white and black pawns, on each skin, and as cards.
//   npm run preview:items -- out.png [items=present,chimney] [color=red] [color2=emerald] [purities=95,50,0] [with=beanie]
//   npm run preview:items -- out.png sheet=1 items=a,b [colors=yellow,red] [purity=72] [outfits=a+b;c]   (a short sheet to show a batch)
//   [scale=1|2]: the display scale (default 1.25), to look for stray pixels at 1× and 2×.
// Starts the app's dev server, screenshots /items-preview.html, stops. Look at the PNG before shipping an item.
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const [out = "items-preview.png", ...args] = process.argv.slice(2);
const scale = Number(args.find((a) => a.startsWith("scale="))?.slice(6) ?? 1.25);
const rest = args.filter((a) => !a.startsWith("scale="));
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5198, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: rest.includes("sheet=1") ? 984 : 1500, height: 400 }, deviceScaleFactor: scale });
page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
page.on("pageerror", (e) => console.error("page:", e.message));
await page.goto(`${url}items-preview.html?${rest.join("&")}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
await server.close();
console.log(`saved ${out}`);
