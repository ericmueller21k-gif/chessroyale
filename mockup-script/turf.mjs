// Throwaway (never merged): Chub & Chirp's Turf mockup stills over a real battle. Plays a real game per device, then shoots
// the stills from .mock/overlay.js; touch .mock/go to shoot again with an edited overlay, .mock/quit to stop.
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium, devices } from "@playwright/test";
import { createServer } from "vite";
import { Chess } from "chess.js";
const outDir = resolve(".mock/stills"); mkdirSync(outDir, { recursive: true });
rmSync(".mock/quit", { force: true });
const server = await createServer({ root: "packages/app", configFile: "packages/app/vite.config.ts", server: { port: 5235, strictPort: false }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const FILES = "abcdefgh";
const ALL = [...FILES].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => f + r));
const parse = (fen) => { const m = {}; fen.split(" ")[0].split("/").forEach((row, i) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += Number(ch); else { m[FILES[f] + (8 - i)] = ch; f++; } } }); return m; };
const colorOf = (ch) => (ch === ch.toUpperCase() ? "w" : "b");

async function game(name, ctx, moves) {
  const p = await browser.newPage({ ...ctx, colorScheme: "light" });
  await p.addInitScript(() => { try { localStorage.setItem("hunchess.tutorial.dismissed", "1"); localStorage.setItem("hunchess.quests.seenDay", "9999999999999"); localStorage.setItem("hunchess.quests.noPop", "1"); } catch {} });
  p.on("pageerror", (e) => console.log(name, "pageerror", e.message));
  await p.goto(`${url}?debug&clock=1800&nolanding&boss=hopper&laststand=0`);
  await p.getByRole("main").getByRole("button", { name: /^Boss Battle/ }).click();
  await p.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: "Chub & Chirp", exact: true }).click();
  await p.getByRole("main").getByRole("button", { name: "START" }).click();
  const st = () => p.evaluate(() => { const m = window.match; const ph = m?.phase; return { kind: ph?.kind ?? null, intro: !!ph?.intro, fen: ph?.board?.fen ?? m?.boss?.board.fen ?? null, crowdSide: m?.boss?.crowdSide }; });
  const waitUntil = async (fn, ms = 150000) => { const t = Date.now(); let s; while (Date.now() - t < ms) { s = await st(); if (fn(s)) return s; await p.waitForTimeout(60); } throw new Error(name + " timeout " + JSON.stringify(s)); };
  const at = async (sq) => { const b = await p.locator(".hb-board").first().boundingBox(); const flip = await p.evaluate(() => document.querySelector(".hb")?.classList.contains("orientation-black")); const f = sq.charCodeAt(0) - 97, r = Number(sq[1]) - 1; return { x: b.x + ((flip ? 7 - f : f) + 0.5) * (b.width / 8), y: b.y + ((flip ? r : 7 - r) + 0.5) * (b.height / 8) }; };
  const tap = async (sq) => { const q = await at(sq); await p.mouse.click(q.x, q.y); };
  const fens = [];
  let s = await waitUntil((x) => x.kind === "play" && !x.intro, 120000);
  fens.push(s.fen);
  for (let i = 0; i < moves; i++) {
    await waitUntil((x) => x.kind === "play"); await p.waitForTimeout(400); s = await st();
    if (fens.at(-1) !== s.fen) fens.push(s.fen);
    const top = await p.evaluate(async (fen) => Promise.race([window.match.runner.topMovesFor(fen).then((t) => t.map((x) => x.move)), new Promise((r) => setTimeout(() => r([]), 8000))]), s.fen);
    const legal = new Chess(s.fen).moves({ verbose: true }).map((m) => m.from + m.to);
    const ok = (mv) => { const c = new Chess(s.fen); const r = c.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: "q" }); return r && !c.isGameOver() && !c.inCheck() && mv.length === 4; };
    const mv = [...top, ...legal].find(ok) ?? legal[0];
    for (let k = 0; k < 6 && (await st()).kind === "play"; k++) { await tap(mv.slice(0, 2)); await tap(mv.slice(2, 4)); await p.waitForTimeout(400); }
    const a = await st(); if (fens.at(-1) !== a.fen) fens.push(a.fen);
    console.log(name, "played", mv);
  }
  s = await waitUntil((x) => x.kind === "play"); await p.waitForTimeout(1200); s = await st(); if (fens.at(-1) !== s.fen) fens.push(s.fen);
  // Clear any selection/highlight from taps.
  await p.mouse.click(5, 5).catch(() => {});
  return { p, fens, crowd: s.crowdSide };
}

function turf({ fens, crowd }) {
  const own = {};
  const him = crowd === "w" ? "b" : "w";
  for (const sq of ALL) { const r = Number(sq[1]); if (r <= 2) own[sq] = "w"; if (r >= 7) own[sq] = "b"; }
  const boards = fens.map(parse);
  for (let i = 1; i < boards.length; i++) for (const sq of ALL) { const a = boards[i - 1][sq], b = boards[i][sq]; if (b && a !== b) own[sq] = colorOf(b); }
  const now = boards.at(-1);
  const toward = (sq) => (him === "b" ? Number(sq[1]) : 9 - Number(sq[1])); // higher: nearer his side
  const center = (sq) => -Math.abs(FILES.indexOf(sq[0]) - 3.5);
  const openEmpty = () => ALL.filter((sq) => !own[sq] && !now[sq]).sort((a, b) => toward(b) - toward(a) || center(b) - center(a));
  // Two hop-arounds so far (his turns 4 and 8): each claims an open square with no piece on it.
  for (const sq of openEmpty().slice(0, 2)) own[sq] = him;
  return { own, him, now, openEmpty, toward, center };
}
const counts = (own, him) => { const his = ALL.filter((s) => own[s] === him).length, yours = ALL.filter((s) => own[s] && own[s] !== him).length; return { his, yours, open: 64 - his - yours }; };
const HOLDS = (n) => [
  { id: "legs", name: "Long legs", short: "Legs", at: 32, on: n >= 32, tip: "", text: `<strong>Long legs is on.</strong> Chub holds ${n} squares (32+): his pawns step 2 from any square, 3 from their start. Take squares back to switch it off.` },
  { id: "fuse", name: "Short fuse", short: "Fuse", at: 40, on: n >= 40, tip: "", text: "" },
  { id: "double", name: "Double hop", short: "Hop", at: 48, on: n >= 48, tip: "", text: "" },
];

const pages = await Promise.all([
  game("phone", { ...devices["iPhone 13"] }, 9),
  game("desktop", { viewport: { width: 1280, height: 800 } }, 9),
]);
const names = ["phone", "desktop"];
writeFileSync(join(outDir, "games.json"), JSON.stringify(pages.map((g) => ({ fens: g.fens, crowd: g.crowd })), null, 1));

async function shoot() {
  const js = readFileSync(".mock/overlay.js", "utf8");
  for (let i = 0; i < pages.length; i++) {
    const g = pages[i], p = g.p, dev = names[i];
    const T = turf(g);
    const sideOf = (o) => ({ his: ALL.filter((s) => o[s] === T.him), yours: ALL.filter((s) => o[s] && o[s] !== T.him) });
    // Still 2's hop: the open square nearest his side, and three empty squares of his nearest it (farthest first).
    const dist = (a, b) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
    const hisEmpty = new Set(ALL.filter((s) => T.own[s] === T.him && !T.now[s]));
    let target = null, path = null;
    const cands = T.openEmpty().sort((a, b) => T.center(b) - T.center(a) || T.toward(b) - T.toward(a));
    for (const t of cands) {
      const chain = [];
      let at = t;
      for (let k = 0; k < 3; k++) {
        const prevDir = chain.length ? [at.charCodeAt(0) - chain.at(-1 - 0).charCodeAt(0), 0] : null;
        const next = [...hisEmpty].filter((s) => dist(s, at) === 1 && !chain.includes(s)).sort((a, b) => (b[1] === at[1]) - (a[1] === at[1]) || T.center(b) - T.center(a))[0];
        if (!next) break;
        chain.push(next); at = next;
      }
      if (chain.length === 3) { target = t; path = chain.reverse(); break; }
    }
    // Still 3: later, his turf grown to 33 (open squares nearest his side, topped up by hand for the mockup).
    const own3 = { ...T.own };
    for (const sq of ALL.filter((s) => !own3[s]).sort((a, b) => T.toward(b) - T.toward(a) || T.center(b) - T.center(a))) { if (counts(own3, T.him).his >= 33) break; own3[sq] = T.him; }
    const base = { names: { his: "Chub" }, spriteScale: dev === "phone" ? 8 * 84 / 333 * 0.0 + 1 : 1 };
    const shots = [
      ["1-turf", { ...base, ...sideOf(T.own), counts: counts(T.own, T.him), holds: HOLDS(counts(T.own, T.him).his) }],
      ["2-hop-around", { ...base, ...sideOf(T.own), counts: counts(T.own, T.him), holds: HOLDS(counts(T.own, T.him).his), hop: { path, target }, dock: "Chirp hops his turf…" }],
      ["3-hold-long-legs", { ...base, ...sideOf(own3), counts: counts(own3, T.him), holds: HOLDS(counts(own3, T.him).his), tip: "legs" }],
    ];
    for (const [label, cfg] of shots) {
      const vw = p.viewportSize().width;
      // sprite scale: about 2 squares wide on a phone, 1.7 on a computer
      const bw = await p.evaluate(() => document.querySelector(".hb-board").getBoundingClientRect().width);
      cfg.spriteScale = ((dev === "phone" ? 2.0 : 1.8) * (bw / 8)) / 84 / (bw / 800) ;
      await p.evaluate(() => { document.querySelectorAll(".turf-mock, .tm-tip").forEach((e) => e.remove()); document.querySelectorAll("[data-mock-was]").forEach((e) => { e.textContent = e.dataset.mockWas; delete e.dataset.mockWas; }); document.querySelectorAll(".turf-mock-hid").forEach((e) => { e.style.visibility = ""; }); });
      await p.addScriptTag({ content: js });
      const r = await p.evaluate((c) => window.__mock(c), cfg);
      await p.waitForTimeout(250);
      const file = join(outDir, `${dev}-${label}.png`);
      await p.screenshot({ path: file });
      console.log(dev, label, vw, JSON.stringify(r), JSON.stringify(cfg.counts), cfg.hop ? JSON.stringify(cfg.hop) : "");
      if (dev === "phone") {
        const vp0 = p.viewportSize();
        await p.setViewportSize({ width: 320, height: 640 });
        await p.waitForTimeout(400);
        await p.evaluate(() => { document.querySelectorAll(".turf-mock, .tm-tip").forEach((e) => e.remove()); document.querySelectorAll("[data-mock-was]").forEach((e) => { e.textContent = e.dataset.mockWas; delete e.dataset.mockWas; }); });
        const bw2 = await p.evaluate(() => document.querySelector(".hb-board").getBoundingClientRect().width);
        const r2 = await p.evaluate((c) => window.__mock(c), { ...cfg, spriteScale: (2.0 * (bw2 / 8)) / 84 / (bw2 / 800) });
        await p.waitForTimeout(250);
        await p.screenshot({ path: join(outDir, `check320-${label}.png`) });
        console.log("320", label, JSON.stringify(r2));
        await p.setViewportSize(vp0);
        await p.waitForTimeout(400);
      }
    }
  }
  writeFileSync(".mock/shot.done", String(Date.now()));
}
await shoot();
let last = existsSync(".mock/go") ? statSync(".mock/go").mtimeMs : 0;
const t0 = Date.now();
while (!existsSync(".mock/quit") && Date.now() - t0 < 40 * 60000) {
  await new Promise((r) => setTimeout(r, 1000));
  const m = existsSync(".mock/go") ? statSync(".mock/go").mtimeMs : 0;
  if (m !== last) { last = m; try { await shoot(); } catch (e) { console.log("shoot failed", e.message); writeFileSync(".mock/shot.done", "fail " + Date.now()); } }
}
await browser.close(); await server.close();
