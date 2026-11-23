const { chromium, devices } = require("playwright");
const H = { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID2, "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET2 };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices["iPhone 13"] });
  await ctx.route("**/*", (r) => { const u = new URL(r.request().url()); return u.hostname === "hunchess.com" ? r.continue({ headers: { ...r.request().headers(), ...H } }) : r.continue(); });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem("hunchess.tutorial.dismissed", "1"); localStorage.setItem("hunchess.quests.seenDay", "9999999999999"); localStorage.setItem("hunchess.quests.noPop", "1"); } catch {} });
  await p.goto("https://hunchess.com/?sky=day&nolanding", { waitUntil: "load" });
  await p.getByRole("button", { name: /Play vs 99 bots as a guest/ }).click({ timeout: 5000 }).catch(() => {});
  const town = p.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).first();
  await town.waitFor({ timeout: 60000 }); await p.waitForTimeout(3000);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
  const t0 = Date.now(); await town.click(); await p.locator("canvas.town-canvas[data-ready='1']").waitFor({ timeout: 120000 }); const ms = Date.now() - t0;
  const { profile } = await cdp.send("Profiler.stop");
  require("fs").writeFileSync("town.cpuprofile", JSON.stringify(profile));
  // self time by function, and total (inclusive) by function
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map();
  const dt = profile.timeDeltas; const cnt = new Map();
  profile.samples.forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
  const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const key = (n) => `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`;
  const incl = new Map();
  for (const [id, us] of cnt) { const n = byId.get(id); self.set(key(n), (self.get(key(n)) || 0) + us); const seen = new Set(); let c = id; while (c) { const k = key(byId.get(c)); if (!seen.has(k)) { incl.set(k, (incl.get(k) || 0) + us); seen.add(k); } c = parent.get(c); } }
  const top = (m, n) => [...m].sort((a, c) => c[1] - a[1]).slice(0, n).map(([k, v]) => `${Math.round(v / 1000)}ms ${k}`).join("\n  ");
  console.log(`tap->ready ${ms} ms\nSELF:\n  ${top(self, 18)}\nINCLUSIVE:\n  ${top(incl, 30)}`);
  await b.close();
})().catch((e) => { console.error("ERR", e.message.slice(0, 300)); process.exit(1); });
