import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { BOARD_SEL, bossAloneFromHome, named, soloFromHome, submitMove, test } from "../../e2e/helpers.ts";

/**
 * Every end screen, at every screen size, in one labeled sheet (Nov 25; docs/decisions/2026-11-25-end-screens-2.md). The cause of
 * Eric finding end screens that looked wrong: each was built and checked one mode and one size at a time, so nobody saw them side by
 * side. `npm run stills:end-screens` plays each case for real (the local server; test switches for a quick win, a mate, XP and quests)
 * at phone 390×844 (the screen and the whole page), laptop 1536×730 (125%, Eric's), desktop 1920×960, and the 1 v 1 also at Eric's
 * desktop window 1735×1035 and a small phone 375×667, then `scripts/screen-stills/sheet.mjs` writes `<out>/end-screens.png` (out: $STILLS_OUT,
 * default `stills-out/end-screens`). Look at the whole sheet before shipping any change to an end screen.
 * `-g <case>` runs some cases; the sheet holds whatever pictures the folder has.
 */
const OUT = resolve(process.env.STILLS_OUT || "stills-out/end-screens");
mkdirSync(OUT, { recursive: true });

type Size = { id: string; label: string; width: number; height: number; scale: number; phone: boolean };
const PHONE: Size = { id: "phone-390x844", label: "phone 390×844", width: 390, height: 844, scale: 3, phone: true };
const SMALL_PHONE: Size = { id: "phone-375x667", label: "phone 375×667", width: 375, height: 667, scale: 2, phone: true };
const LAPTOP: Size = { id: "laptop-1536x730", label: "laptop 1536×730 (125%)", width: 1536, height: 730, scale: 1.25, phone: false };
const DESKTOP: Size = { id: "desktop-1920x960", label: "desktop 1920×960", width: 1920, height: 960, scale: 1, phone: false };
const ERIC: Size = { id: "desktop-1735x1035", label: "Eric's desktop window 1735×1035", width: 1735, height: 1035, scale: 1, phone: false };
const SIZES = [PHONE, LAPTOP, DESKTOP];

const context = (browser: Browser, s: Size): Promise<BrowserContext> =>
  browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale, isMobile: s.phone, hasTouch: s.phone });
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

/** The end screen at rest: its sequence run to the end (a tap that isn't a button skips it), then a beat. */
async function settle(page: Page) {
  await page.waitForTimeout(800);
  const rewards = page.getByTestId("es-rewards");
  if (await rewards.count()) {
    await page.mouse.click(4, 4);
    await expect(rewards.first()).toHaveAttribute("data-es", "done", { timeout: 30_000 }).catch(() => undefined);
  }
  await page.waitForTimeout(600);
}

/** The pictures of one case at one size: the screen (and on a phone, the whole page too). */
async function shoot(page: Page, name: string, s: Size) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}--${s.id}.png` });
  if (s.phone) await page.screenshot({ path: `${OUT}/${name}--${s.id}-page.png`, fullPage: true });
}

async function resign(page: Page) {
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
}

/** A board square's middle on screen, from this page's side (1 v 1). */
async function tapMove(page: Page, uci: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const white = (await page.locator(".dv-strip.dv-you").getAttribute("data-side")) === "w";
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    await page.mouse.click(box.x + (((white ? f : 7 - f) + 0.5) * box.width) / 8, box.y + (((white ? 7 - r : r) + 0.5) * box.height) / 8);
  }
}

/** Two players meet in ranked 1 v 1 (a pool of their own) at size `s`; their game's first move due. White first. */
async function duel(browser: Browser, s: Size, names: [string, string]): Promise<[Page, Page]> {
  const pool = `st${Math.random().toString(36).slice(2, 8)}`;
  const pages: Page[] = [];
  for (const n of names) {
    const page = await (await context(browser, s)).newPage();
    await named(page, n);
    await page.goto("/?nolanding");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    pages.push(page);
  }
  for (const p of pages) await p.goto(`/1v1?nolanding&debug&pool=${pool}`);
  for (const p of pages) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 40_000 });
  const white = (await pages[0]!.locator(".dv-strip.dv-you").getAttribute("data-side")) === "w" ? pages[0]! : pages[1]!;
  return [white, white === pages[0] ? pages[1]! : pages[0]!];
}
/** Moves in turn, White first (UCI), each answered before the next. */
async function play(white: Page, black: Page, moves: string[]) {
  for (const [i, m] of moves.entries()) {
    const [me, them] = i % 2 === 0 ? [white, black] : [black, white];
    await tapMove(me, m);
    await expect(them.locator(".dv-status")).toContainText(/Your (first )?move/, { timeout: 15_000 });
  }
}
/** Ten moves each, quiet (XP counts from move 10). */
const TEN = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "d2d3", "d7d6", "b1c3", "g8f6", "c1e3", "c8e6", "h2h3", "h7h6", "a2a3", "a7a6", "d1d2", "d8d7", "e1c1", "e8c8"];

type Case = { name: string; label: string; sizes: Size[]; run: (browser: Browser, s: Size) => Promise<void> };
const CASES: Case[] = [
  {
    name: "boss-win",
    label: "Boss alone won (+XP, quests moved)",
    sizes: SIZES,
    run: async (browser, s) => {
      const page = await (await context(browser, s)).newPage();
      await page.goto("/?debug&pace=quick&win=1&boss=gingerbread&xp=490&xpgame=12&quests=squad-up,fifty-fifty,regular");
      await bossAloneFromHome(page);
      await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
      await submitMove(page, "h5f7");
      await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
      await shoot(page, "boss-win", s);
    },
  },
  {
    name: "boss-loss",
    label: "Boss alone lost (mated)",
    sizes: SIZES,
    run: async (browser, s) => {
      const page = await (await context(browser, s)).newPage();
      await page.goto("/?debug&pace=quick&mate=1&boss=hollow&xp=250");
      await bossAloneFromHome(page);
      await expect(page.locator(".results h1")).toHaveText("Defeat", { timeout: 120_000 });
      await shoot(page, "boss-loss", s);
    },
  },
  {
    name: "boss-resign",
    label: "Boss alone resigned (+0)",
    sizes: SIZES,
    run: async (browser, s) => {
      const page = await (await context(browser, s)).newPage();
      await page.goto("/?debug&clock=60&boss=birdie");
      await bossAloneFromHome(page);
      await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
      await resign(page);
      await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("results");
      await shoot(page, "boss-resign", s);
    },
  },
  {
    name: "crowd-resign",
    label: "50 v 50 resigned",
    sizes: SIZES,
    run: async (browser, s) => {
      const page = await (await context(browser, s)).newPage();
      await page.goto("/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0");
      await soloFromHome(page);
      await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|watching)$/);
      await resign(page);
      await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("results");
      await shoot(page, "crowd-resign", s);
    },
  },
  {
    name: "squads-resign",
    label: "Squads resigned (test lobby)",
    sizes: SIZES,
    run: async (browser, s) => {
      const page = await (await context(browser, s)).newPage();
      await named(page, "Tess");
      await page.goto("/squads/test/relay?nolanding&debug&clock=90,0,3,0");
      await page.getByRole("button", { name: "Skip votes" }).click({ timeout: 30_000 });
      await expect(page.locator(".sq-game")).toBeVisible({ timeout: 30_000 });
      await resign(page);
      await expect(page.locator(".sq-resigned h1")).toHaveText("You resigned");
      await shoot(page, "squads-resign", s);
    },
  },
  {
    name: "duel-placement",
    label: "1 v 1 placement game, resigned at move 2 (+0): the loser, then the winner",
    sizes: [PHONE, SMALL_PHONE, LAPTOP, ERIC, DESKTOP],
    run: async (browser, s) => {
      const [white, black] = await duel(browser, s, ["Ann Stills", "Bo Stills"]);
      await play(white, black, ["e2e4", "e7e5"]);
      await resign(white);
      await expect(white.getByTestId("es-title")).toHaveText("Defeat");
      await shoot(white, "duel-placement-loss", s);
      await shoot(black, "duel-placement-win", s);
    },
  },
  {
    name: "duel-xp",
    label: "1 v 1 placement game, 10 moves then resigned (+XP): the winner",
    sizes: [PHONE, LAPTOP, DESKTOP],
    run: async (browser, s) => {
      const [white, black] = await duel(browser, s, ["Cy Stills", "Di Stills"]);
      await play(white, black, TEN);
      await resign(white);
      await expect(black.getByTestId("es-title")).toHaveText("Victory!");
      await shoot(black, "duel-xp-win", s);
    },
  },
  {
    name: "duel-draw",
    label: "1 v 1 draw by agreement",
    sizes: [PHONE, LAPTOP],
    run: async (browser, s) => {
      const [white, black] = await duel(browser, s, ["Ed Stills", "Flo Stills"]);
      await play(white, black, ["e2e4", "e7e5", "g1f3", "b8c6"]);
      await white.getByRole("button", { name: "Offer a draw" }).click();
      await black.locator(".dv-draw").getByRole("button", { name: "Accept" }).click();
      await expect(white.getByTestId("es-title")).toHaveText("A draw");
      await shoot(white, "duel-draw", s);
    },
  },
];

for (const c of CASES)
  for (const s of c.sizes)
    test(`${c.name} on ${s.label}`, async ({ browser }) => {
      await c.run(browser, s);
    });
