// Ranked 1 v 1's tiers and emblems (Oct 28), recorded the way Eric reviews them: on a phone (390 x 844), light and dark,
// the versus screen (Gold 3 against a Transcendent), the result of a division up (Gold 3 → Gold 2, the new emblem), home's
// ranked row (1 v 1 picked: your rank's emblem and words) and your profile's 1 V 1 section; a sheet of every emblem as the
// game shows it (its own CSS and picture, 1× and 2×, both themes); and home's line under your name (your 1 v 1 rank).
//   npx tsx scripts/frames-ranked-tiers.ts <out-dir> [base url, default http://localhost:8788]
// Needs the Worker running with the test switches (npx wrangler dev --port 8788 --enable-containers=false
// --var TEST_SWITCHES:1 --var ENGINE_OFF:1). Ranks are put in the server's answers (as the e2e does): reaching them for
// real takes hundreds of games.
import { chromium, devices, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { RANKED_1V1, rankView, type RankView } from "../packages/core/src/index.ts";

const [out = "ranked-tiers-frames", base = "http://localhost:8788"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser: Browser = await chromium.launch();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const phone = (scheme: "light" | "dark"): BrowserContextOptions => ({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, colorScheme: scheme, baseURL: base });

const R = RANKED_1V1;
/** A rank at a tier's division and RP (or a top tier: its RP over the floor, at a place). */
const at = (tier: number, division: number, rp: number): RankView => rankView({ games: 40, ladder: (tier * R.divisions + (R.divisions - division)) * R.pointsPerDivision + rp });
const top = (name: string, rp: number): RankView => rankView({ games: 40, ladder: R.topFloor + rp, place: R.topTiers.find((t) => t.name === name)!.top });
const GOLD3 = at(2, 3, 70);
const GOLD2 = at(2, 2, 10);
const TRANS = top("Transcendent", 214);

async function player(scheme: "light" | "dark", name: string, rank: RankView | null, extra: Record<string, unknown> = {}): Promise<Page> {
  const ctx = await browser.newContext(phone(scheme));
  const page = await ctx.newPage();
  await page.addInitScript((n) => localStorage.setItem("brc.name", n), name);
  // The server's answers, as a ranked player's: the rank (and the record) in /api/me and their profile.
  await page.route(/\/api\/(me|profile\/[\w-]+)(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, ...(rank ? { ranked1v1: { rank, games: 46, wins: 25, losses: 19, draws: 2 } } : {}), ...extra } });
  });
  // (TEST_SWITCHES is on here, which gives everyone an admin's placeholders: the app is told otherwise, as a player's is.)
  await page.route("**/api/auth/config", async (route) => {
    const res = await route.fetch();
    const { testSwitches: _, ...body } = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/?nolanding");
  await page.getByRole("button", { name: "PLAY", exact: true }).waitFor();
  return page;
}

/** Home, 1 v 1 picked: the RANKED row and its panel (your rank's emblem and words). */
async function home(scheme: "light" | "dark") {
  const page = await player(scheme, "Ann", GOLD3);
  await page.getByRole("radio", { name: /1 v 1/ }).click();
  await page.locator(".fd-rank-words [data-emblem]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await sleep(300);
  await page.screenshot({ path: join(out, `home-${scheme}.png`) });
  const box = (await page.locator(".fd-ranked").boundingBox())!;
  const panel = (await page.locator(".fd-mode-panel").boundingBox())!;
  await page.screenshot({ path: join(out, `home-row-${scheme}.png`), clip: { x: 0, y: box.y - 8, width: 390, height: panel.y + panel.height - box.y + 16 } });
  await page.context().close();
}

/** Your profile's 1 V 1 section: the emblem at 2×, the pill and the record. */
async function profile(scheme: "light" | "dark") {
  const page = await player(scheme, "Ann", TRANS);
  await page.getByRole("button", { name: "Your profile" }).click();
  const sec = page.locator(".dv-profile");
  await sec.locator("[data-emblem]").waitFor();
  await sec.scrollIntoViewIfNeeded();
  await sleep(300);
  await page.screenshot({ path: join(out, `profile-${scheme}.png`) });
  await sec.screenshot({ path: join(out, `profile-1v1-${scheme}.png`) });
  await page.context().close();
}

/**
 * The versus screen and a division up: Ann (Gold 3 · 70 RP) meets Bo (Transcendent); the versus moment held for its
 * still; then, the game resigned, Ann's result says Gold 2 · 10 RP (+20) with Gold 2's emblem.
 */
async function versusAndResult(scheme: "light" | "dark") {
  const pool = `rt${Date.now().toString(36)}${scheme[0]}`;
  const a = await player(scheme, "Ann", GOLD3);
  const b = await player(scheme, "Bo Duel", TRANS);
  const ranks: Record<string, RankView> = { Ann: GOLD3, "Bo Duel": TRANS };
  await a.routeWebSocket(/\/api\/1v1\/game\/[A-Z2-9]{5}\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      const msg = JSON.parse(String(m));
      const g = msg.game;
      if (g?.players) for (const c of ["w", "b"]) g.players[c] = { ...g.players[c], rank: ranks[g.players[c].name] ?? g.players[c].rank };
      if (msg.t === "outcome" && msg.outcome?.change) msg.outcome.change = { before: GOLD3, after: GOLD2, points: 20, placed: false };
      ws.send(JSON.stringify(msg));
    });
  });
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await a.locator(".dv-search").waitFor();
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  await a.locator(".dv-versus .dv-st-them .dv-st-pawn").waitFor({ timeout: 30_000 });
  await sleep(900);
  await a.screenshot({ path: join(out, `versus-${scheme}.png`) });
  // The board: Ann's side (she resigns once both first moves are in: a loss would be a drop, so Bo resigns).
  await a.locator(".dv-vote").waitFor({ timeout: 15_000 });
  for (const p of [a, b]) await p.locator(".dv-status").filter({ hasText: /first move/ }).waitFor({ timeout: 20_000 });
  const sideOf = async (p: Page) => (await p.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";
  const [white, black] = (await sideOf(a)) === "w" ? [a, b] : [b, a];
  const tap = async (p: Page, uci: string) => {
    const box = (await p.locator(".board-area .board-wrap").first().boundingBox())!;
    const w = (await sideOf(p)) === "w";
    for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const f = sq.charCodeAt(0) - 97;
      const r = Number(sq[1]) - 1;
      await p.mouse.click(box.x + (((w ? f : 7 - f) + 0.5) * box.width) / 8, box.y + (((w ? 7 - r : r) + 0.5) * box.height) / 8);
    }
  };
  await tap(white, "e2e4");
  await black.locator(".dv-status").filter({ hasText: /Your first move/ }).waitFor({ timeout: 10_000 });
  await tap(black, "e7e5");
  await white.locator(".dv-status").filter({ hasText: /Your move/ }).waitFor({ timeout: 10_000 });
  await b.getByRole("button", { name: "Match options" }).click();
  await b.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Resign/ }).click();
  await b.getByRole("button", { name: /^Resign/ }).last().click();
  await a.locator(".dv-result-rank").filter({ hasText: "Gold 2" }).waitFor({ timeout: 20_000 });
  await sleep(400);
  await a.screenshot({ path: join(out, `result-${scheme}.png`) });
  await a.locator(".dv-result").screenshot({ path: join(out, `result-card-${scheme}.png`) });
  await a.context().close();
  await b.context().close();
}

/** Every emblem as the game shows it: the app's own CSS and picture (a RankEmblem's markup), 1× and 2×, both themes. */
async function sheet() {
  for (const scheme of ["dark", "light"] as const) {
    const page = await player(scheme, "Ann", null);
    const rows = await emblemRows(page);
    await page.evaluate(
      ({ rows, label }) => {
        document.body.innerHTML = "";
        document.body.style.cssText = "margin:0;padding:16px;background:var(--fd-bg);color:var(--fd-text);font:600 12px system-ui;overflow:auto;height:auto";
        const h = document.createElement("h3");
        h.textContent = label;
        h.style.margin = "0 0 8px";
        document.body.append(h);
        for (const scale of [1, 2]) {
          const grid = document.createElement("div");
          grid.style.cssText = "display:grid;grid-template-columns:repeat(5,max-content);gap:10px 12px;margin-bottom:18px;align-items:end";
          for (const r of rows) {
            const fig = document.createElement("figure");
            fig.style.cssText = "margin:0;display:flex;flex-direction:column;align-items:center;gap:3px";
            const boxEl = document.createElement("span");
            boxEl.className = "re-box";
            boxEl.style.width = boxEl.style.height = `${48 * scale}px`;
            const art = document.createElement("span");
            art.className = `re-art${r.frames > 1 ? " re-loop" : ""}`;
            art.style.cssText = `width:${48 * scale * r.frames}px;height:${48 * scale}px;background-image:url(${r.url});background-size:${384 * scale}px ${432 * scale}px;background-position:${-r.x * scale}px ${-r.y * scale}px`;
            if (r.frames > 1) {
              art.style.setProperty("--re-steps", String(r.frames));
              art.style.setProperty("--re-ms", `${r.frames * r.ms}ms`);
            }
            boxEl.append(art);
            const cap = document.createElement("figcaption");
            cap.textContent = r.caption;
            fig.append(boxEl, cap);
            grid.append(fig);
          }
          document.body.append(grid);
        }
      },
      { rows, label: `Ranked emblems as the game shows them (1× and 2×, ${scheme}; loops on their first frame)` },
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 760, height: 1400 });
    await sleep(500);
    await page.screenshot({ path: join(out, `emblems-${scheme}.png`), fullPage: true });
    await page.context().close();
  }
}

/** The sheet's cells (the app's own table) and the picture's address in this build (from the FAQ's emblems). */
async function emblemRows(page: Page) {
  await page.goto("/faq");
  const art = page.locator(".faq-emblems .re-art").first();
  await art.waitFor();
  const src = (await art.evaluate((e) => (e as HTMLElement).style.backgroundImage)).replace(/^url\("?|"?\)$/g, "");
  const { EMBLEMS } = await import("../packages/app/src/emblems/rank-emblems.ts");
  return Object.entries(EMBLEMS).map(([id, c]) => {
    const [tier = "", d] = id.split("-d");
    return { ...c, url: src, caption: `${tier.charAt(0).toUpperCase()}${tier.slice(1)}${d ? ` ${d}` : ""}` };
  });
}

const only = process.env.ONLY?.split(",");
const want = (k: string) => !only || only.includes(k);
for (const scheme of ["light", "dark"] as const) {
  if (want("home")) await home(scheme);
  if (want("profile")) await profile(scheme);
  if (want("versus")) await versusAndResult(scheme);
}
if (want("sheet")) await sheet();
await browser.close();
