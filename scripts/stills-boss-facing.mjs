// Stills of every boss in every place it's drawn, one grid per place and platform (the boss-facing check, Nov 17):
//   node scripts/stills-boss-facing.mjs <out-dir> [phone|desktop|both] [boss ids, comma-separated]
// Needs the app and API on http://localhost:8788 (E2E_PORT), test switches on (as playwright.config.ts starts it). Per boss: the battle
// (a phone's bar, a computer's side figure), then a resign (the results); then the boss select's stage, each boss picked in turn.
// Each crop gets an arrow under it: which way the figure faces on screen (`data-faces`), and the place's want.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, devices } from "@playwright/test";

const [outArg = ".", which = "both", only] = process.argv.slice(2);
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const base = `http://localhost:${process.env.E2E_PORT || 8788}`;
const IDS = (only ?? "clown,gingerbread,grex,hollow,bigboy,sawyer,pig,alfil,hopper,smudgy,moo,gardener,tiger,folio,timber,dash,zebra,recluse,chandy").split(",");
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const shots = {};
// (Each crop is also saved on its own, <out>/<place>/<boss>.png, for a before/after sheet: scripts/stills-boss-facing-sheet.mjs.)
const keep = (place, id, buf, faces) => {
  (shots[place] ??= []).push({ id, src: `data:image/png;base64,${buf.toString("base64")}`, faces });
  mkdirSync(`${out}/${place}`, { recursive: true });
  writeFileSync(`${out}/${place}/${id.replace(/[^\w&]+/g, "_")}.png`, buf);
};

async function crop(p, sel, pad = 24) {
  const el = p.locator(sel).first();
  await el.waitFor({ state: "visible", timeout: 30_000 });
  await p.waitForTimeout(600);
  const r = await el.boundingBox();
  const v = p.viewportSize();
  const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad);
  const clip = { x, y, width: Math.min(v.width - x, r.width + 2 * pad), height: Math.min(v.height - y, r.height + 2 * pad) };
  const faces = await el.evaluate((e) => e.closest("[data-faces]")?.getAttribute("data-faces") ?? "?");
  return { buf: await p.screenshot({ clip }), faces };
}

for (const plat of which === "both" ? ["phone", "desktop"] : [which]) {
  const ctx = await b.newContext(plat === "phone" ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  // (As an admin, as e2e/helpers.ts asAdmin: the bosses in the game for admins first (Timber, Dash, Don Dough, Chandy) can be met.)
  await ctx.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
  await ctx.addInitScript(() => (localStorage.setItem("hunchess.tutorial.dismissed", "1"), localStorage.setItem("brc.evalBar", "0")));
  for (const id of IDS) {
    const p = await ctx.newPage();
    try {
      await p.goto(`${base}/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${id}${id === "recluse" ? "&form=adult" : ""}`);
      await p.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
      await p.getByRole("main").getByRole("button", { name: "START" }).click();
      await p.waitForFunction(() => window.match?.phase?.kind === "play", null, { timeout: 60_000 });
      const place = plat === "phone" ? "bar" : "side";
      const s = await crop(p, `.boss-char.place-${place} .boss-char-sprite`);
      keep(`${plat}-${place}`, id, s.buf, s.faces);
      await p.evaluate(() => window.match.resign());
      const r = await crop(p, `.boss-char.place-results .boss-char-sprite`);
      keep(`${plat}-results`, id, r.buf, r.faces);
    } catch (e) {
      console.log(plat, id, "failed:", e.message.split("\n")[0]);
    }
    await p.close();
  }
  // The boss select's stage: each boss picked in turn.
  const p = await ctx.newPage();
  await p.goto(`${base}/?debug&pace=quick`);
  await p.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
  const radios = p.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio");
  const n = await radios.count();
  for (let i = 0; i < n; i++) {
    const radio = radios.nth(i);
    const name = (await radio.getAttribute("aria-label")) ?? String(i);
    if ((await radio.getAttribute("aria-disabled")) === "true") continue;
    await radio.click();
    try {
      const s = await crop(p, ".bs-stage .bs-row-stage", 4);
      keep(`${plat}-select`, name, s.buf, s.faces);
    } catch (e) {
      console.log(plat, "select", name, "failed:", e.message.split("\n")[0]);
    }
  }
  await ctx.close();
}

// One grid per place: the crops in a row-wrapped sheet, each labeled with its boss and the facing it's drawn with.
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
for (const [place, list] of Object.entries(shots)) {
  const html = `<body style="margin:0;background:#888;font:14px sans-serif"><h2 style="margin:6px">${place}</h2><div style="display:flex;flex-wrap:wrap;gap:6px;padding:6px">${list
    .map((s) => `<figure style="margin:0;background:#222;color:#fff;text-align:center;padding:4px"><img src="${s.src}" style="max-height:${place.includes("select") ? 220 : 260}px;display:block"><figcaption>${s.id} · ${s.faces}</figcaption></figure>`)
    .join("")}</div></body>`;
  await page.setContent(html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${place}.png`, fullPage: true });
  console.log("wrote", `${out}/${place}.png`);
}
await b.close();
