// MOCKUP ONLY. The room's stills: the mock room (town-shop-mockup.html) set inside the real town screen, in the town's own box, under its
// chat box and walking keys (the map and the bosses' chips put away, as inside any building).
//   node scripts/town-shop-mockup/room.mjs <outDir> [base=http://localhost:5199]
import { chromium } from "playwright";
const OUT = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:5199";
const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  computer: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
};
const VIEWS = {
  "2-room": { q: "at=4,6", modal: false },
  "3-talk": { q: "at=4,4", modal: false, only: "phone" },
  "3-list": { q: "card=list", modal: false, noChat: true },
  "4-preview": { q: "card=preview&skin=paragon&ply=5", modal: true },
  "4-preview-loading": { q: "card=loading&skin=paragon", modal: true, only: "phone" },
  "4-preview-locked": { q: "card=preview&skin=transcendent&ply=8", modal: true, only: "phone" },
};
const want = (process.env.VIEWS ?? Object.keys(VIEWS).join(",")).split(",");
const sizes = (process.env.ONLY ?? "phone,computer").split(",");
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const jobs = [];
for (const size of sizes)
  for (const name of want) {
    const v = VIEWS[name];
    if (v.only && v.only !== size) continue;
    jobs.push(async () => {
      const page = await (await browser.newContext(SIZES[size])).newPage();
      page.on("pageerror", (e) => console.log(size, name, "pageerror", e.message));
      await page.goto(`${BASE}/town?sky=day`);
      await page.waitForFunction(() => document.querySelector("canvas.town-canvas")?.dataset.ready === "1", null, { timeout: 90_000 });
      await page.evaluate(({ src, modal, noChat }) => {
        const box = document.querySelector(".town-box");
        const f = document.createElement("iframe");
        f.src = src;
        f.id = "mock-room";
        f.style.cssText = `position:absolute;inset:0;width:100%;height:100%;border:0;z-index:${modal ? 8 : 4};background:#000`;
        box.querySelector("canvas.town-canvas").after(f);
        const st = document.createElement("style");
        st.textContent = noChat ? ".tm-root, .town-overlay { display: none !important; }" : ".tm-root, .town-overlay > :not([class*='chat']) { display: none !important; }";
        document.head.append(st);
      }, { src: `/town-shop-mockup.html?view=room&${v.q}`, modal: v.modal, noChat: !!v.noChat });
      const frame = page.frameLocator("#mock-room");
      await frame.locator("html[data-room]").waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${name}-${size}.png` });
      console.log("done", name, size);
      await page.context().close();
    });
  }
// (Two at a time: the town's loading is heavy without a GPU.)
for (let i = 0; i < jobs.length; i += 2) await Promise.all(jobs.slice(i, i + 2).map((j) => j()));
await browser.close();
