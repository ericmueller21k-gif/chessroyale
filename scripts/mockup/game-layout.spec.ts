import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1, rankView } from "@chessroyale/core";
import { BOARD_SEL, named, test } from "../../e2e/helpers.ts";
import { into, type Screen } from "./into.ts";

/**
 * The shared game layout, MOCKUP (Nov 25; claude/game-layout-mockup): stills of every main game screen before (main) and after (the
 * mock's stylesheet and a few moves of what's already there, over the real screen), at laptop 1536×730, desktop 1920×960 and phone 390;
 * the board's size in each; the Ranks pop-up. Out: $SHOTS (default /tmp/mockup). Run against a local server (E2E_REUSE=1).
 */
const OUT = process.env.SHOTS || "/tmp/mockup";
mkdirSync(OUT, { recursive: true });
const CSS = readFileSync(new URL("./mock.css", import.meta.url), "utf8");
const SIZES = [
  { label: "laptop-1536x730", width: 1536, height: 730, scale: 1.25 },
  { label: "desktop-1920x960", width: 1920, height: 960, scale: 1 },
  { label: "phone-390x844", width: 390, height: 844, scale: 3 },
] as const;
type Size = (typeof SIZES)[number];
const phone = (s: Size) => s.width < 500;
const ctxFor = (browser: Browser, s: Size) =>
  browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, isMobile: phone(s), hasTouch: phone(s) });
const boardPx = (page: Page) => page.evaluate((sel) => Math.round(document.querySelector(`.board-area .board-row > .board-wrap ${sel}`)?.getBoundingClientRect().width ?? 0), BOARD_SEL.container);
const note = (line: string) => appendFileSync(`${OUT}/boards.txt`, line + "\n");

/** The mock over a real game screen: its stylesheet, and the panel's column (what's beside the board, in one 340 px column). */
async function mock(page: Page) {
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => {
    const scr = document.querySelector(".screen.game")!;
    const col = document.createElement("div");
    col.className = "mk-col";
    // (1 v 1: "1 v 1 · Blitz 3+2" and the gear into the top strip, by the clock.)
    const top = scr.querySelector(".dv-strip.dv-them");
    if (top) {
      const t = scr.querySelector(".dv-title");
      const title = document.createElement("span");
      title.className = "mk-title";
      title.innerHTML = `<b>1 v 1</b><span>${t?.querySelector(".dv-control")?.textContent ?? ""}</span>`;
      top.insertBefore(title, top.querySelector(".dv-clock"));
      const mm = scr.querySelector(".hud-row .mm");
      if (mm) top.appendChild(mm);
    }
    // (The 50 v 50's pick line, Squads' tiny boards: into the panel.)
    const pick = scr.querySelector(".crowd-50 .board-area > .opening-name");
    const tiny = scr.querySelector(":scope > .sq-boards");
    if (tiny) col.appendChild(tiny);
    if (scr.querySelector(":scope > .boss-dock")) return;
    for (const sel of [":scope > .play-footer", ":scope > .sq-panel", ":scope > .under-board", ":scope > .dv-chat"]) {
      const e = scr.querySelector(sel);
      if (e) col.appendChild(e);
      if (sel === ":scope > .play-footer" && pick) {
        const p = pick.cloneNode(true) as HTMLElement;
        p.style.display = "flex";
        p.style.justifyContent = "center";
        p.style.gap = "8px";
        col.insertBefore(p, col.firstChild);
      }
    }
    scr.appendChild(col);
  });
  await page.waitForTimeout(600);
}

/** Two players meet in ranked 1 v 1 and play a move each; returns White's page (Black's opponent shown at the top). */
async function duel(browser: Browser, s: Size): Promise<Page> {
  const pool = `mk${Math.random().toString(36).slice(2, 8)}`;
  const pages: Page[] = [];
  for (const n of ["Wren", "Kasparova"]) {
    const page = await (await ctxFor(browser, s)).newPage();
    await named(page, n);
    // (Ranks for the stills: "Illustrious 4 · 67 RP" (ladder 1747) and you "Gold 2 · 45 RP".)
    const ranks = { Kasparova: rankView({ games: RANKED_1V1.placements.games, ladder: 1747 }), Wren: rankView({ games: RANKED_1V1.placements.games, ladder: 845 }) };
    await page.addInitScript((r) => ((window as any).__mockRank = r), ranks);
    await page.goto("/?nolanding");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    pages.push(page);
  }
  for (const p of pages) await p.goto(`/1v1?nolanding&debug&pool=${pool}`);
  for (const p of pages) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 40_000 });
  return pages[0]!;
}

for (const s of SIZES)
  for (const screen of ["duel", "crowd", "alone", "squads"] as Screen[])
    test(`mockup: ${screen} on ${s.label}`, async ({ browser }) => {
      test.setTimeout(180_000);
      let page: Page;
      if (screen === "duel") page = await duel(browser, s);
      else {
        page = await (await ctxFor(browser, s)).newPage();
        await into(page, screen);
      }
      await page.waitForTimeout(1200);
      const before = await boardPx(page);
      await page.screenshot({ path: `${OUT}/${screen}-${s.label}-before.png` });
      if (phone(s)) {
        note(`${screen} ${s.label}: ${before} px (unchanged)`);
        if (screen === "duel") {
          await page.locator(".dv-strip.dv-them .dv-rank-btn").click();
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${OUT}/ranks-popup-${s.label}.png` });
        }
        return;
      }
      await mock(page);
      const after = await boardPx(page);
      note(`${screen} ${s.label}: ${before} -> ${after} px (target ${s.height - 108})`);
      await page.screenshot({ path: `${OUT}/${screen}-${s.label}-after.png` });
      if (screen === "duel") {
        await page.locator(".dv-strip.dv-them .dv-rank-btn").click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/ranks-popup-${s.label}.png` });
      }
    });
