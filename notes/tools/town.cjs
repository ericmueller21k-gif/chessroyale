// Times tap -> Chess Town's first frame on the live site, phone emulation, CPU x1 and x4. Access headers only to hunchess.com.
const { chromium, devices } = require("playwright");
const H = { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID2 /* set in the director's env only */, "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET2 };
(async () => {
  const b = await chromium.launch();
  for (const rate of [1, 4]) for (const run of [1, 2]) {
    const ctx = await b.newContext({ ...devices["iPhone 13"] });
    await ctx.route("**/*", (r) => { const u = new URL(r.request().url()); return u.hostname === "hunchess.com" ? r.continue({ headers: { ...r.request().headers(), ...H } }) : r.continue(); });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.setItem("hunchess.tutorial.dismissed", "1"); localStorage.setItem("hunchess.quests.seenDay", "9999999999999"); localStorage.setItem("hunchess.quests.noPop", "1"); } catch {} });
    const reqs = [];
    p.on("requestfinished", async (rq) => { try { const s = await rq.sizes(); reqs.push({ u: rq.url().replace("https://hunchess.com", ""), b: s.responseBodySize, t: rq.timing().responseEnd }); } catch {} });
    await p.goto("https://hunchess.com/?sky=day&nolanding", { waitUntil: "load", timeout: 90000 });
    await p.getByRole("button", { name: /Play vs 99 bots as a guest/ }).click({ timeout: 5000 }).catch(() => {});
    const town = p.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).first();
    await town.waitFor({ timeout: 60000 });
    await p.waitForTimeout(3000);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await p.evaluate(() => addEventListener("pointerup", () => (window.__tap = performance.now()), { capture: true, once: true }));
    const n0 = reqs.length;
    try { await town.click({ timeout: 8000 }); } catch (e) { await p.screenshot({ path: `blocked-${rate}-${run}.png` }); console.log("blocked:", (e.message.match(/intercepts pointer events[^\n]*/) || [""])[0].slice(0, 200)); await ctx.close(); continue; }
    const since = () => p.evaluate(() => performance.now() - window.__tap);
    let shown = -1; try { await p.locator(".town-loading").waitFor({ timeout: 60000 }); shown = await since(); } catch {}
    await p.locator("canvas.town-canvas[data-ready='1']").waitFor({ timeout: 120000 });
    const loaded = await since();
    const after = reqs.slice(n0); const kb = Math.round(after.reduce((a, r) => a + (r.b || 0), 0) / 1024);
    console.log(`cpu x${rate} run ${run}: loading screen ${Math.round(shown)} ms, town first frame ${Math.round(loaded)} ms, ${after.length} requests after the tap, ${kb} KB`);
    if (rate === 4 && run === 1) console.log("  biggest after tap:", after.sort((a, c) => (c.b || 0) - (a.b || 0)).slice(0, 8).map((r) => `${r.u.slice(0, 60)} ${Math.round((r.b || 0) / 1024)}KB`).join(" | "));
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error("ERR", e.message.slice(0, 300)); process.exit(1); });
