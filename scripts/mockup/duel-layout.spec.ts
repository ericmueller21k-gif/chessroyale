import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1, rankView } from "@chessroyale/core";
import { BOARD_SEL, named, test } from "../../e2e/helpers.ts";

/**
 * Ranked 1 v 1 on a computer, MOCKUP round 2 (Nov 25; Eric's asks, scripts/mockup/duel.css): stills before (the screen as built) and after
 * (the mock over it), in play and on the end page, at Eric's desktop 1858×1040 (100%), his laptop 1536×730 (125%) and 1920×960; the board's
 * px in boards.txt. Out: $SHOTS (default /tmp/mockup-duel). A local server (E2E_REUSE=1).
 */
const OUT = process.env.SHOTS || "/tmp/mockup-duel";
mkdirSync(OUT, { recursive: true });
const CSS = readFileSync(new URL("./duel.css", import.meta.url), "utf8");
const SIZES = [
  { label: "desktop-1858x1040", width: 1858, height: 1040, scale: 1 },
  { label: "laptop-1536x730", width: 1536, height: 730, scale: 1.25 },
  { label: "desktop-1920x960", width: 1920, height: 960, scale: 1 },
] as const;
const boardPx = (page: Page) => page.evaluate((sel) => Math.round(document.querySelector(`.board-area .board-row > .board-wrap ${sel}`)?.getBoundingClientRect().width ?? 0), BOARD_SEL.container);
const note = (line: string) => appendFileSync(`${OUT}/boards.txt`, line + "\n");

/** The mock over the screen as it is now (in play or the end page). */
async function mock(page: Page) {
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => {
    const scr = document.querySelector(".screen.game.duel-screen")!;
    scr.classList.add("mk-duel");
    const top = scr.querySelector(".dv-strip.dv-them")!;
    const you = scr.querySelector(".dv-strip.dv-you")!;
    const title = document.createElement("span");
    title.className = "mk-title";
    title.innerHTML = `<b>1 v 1</b><span>· ${scr.querySelector(".dv-control")?.textContent ?? ""}</span>`;
    top.insertBefore(title, top.querySelector(".dv-clock"));
    const side = document.createElement("div");
    side.className = "mk-side";
    const gear = document.createElement("div");
    gear.className = "mk-gearrow";
    const mm = scr.querySelector(".hud-row .mm");
    if (mm) gear.appendChild(mm);
    const panel = document.createElement("div");
    panel.className = "mk-panel";
    side.append(gear, panel, document.createElement("div"));
    const end = scr.querySelector(".dv-end-col");
    if (end) panel.appendChild(end);
    else {
      const chat = scr.querySelector(":scope > .dv-chat");
      if (chat) panel.appendChild(chat);
      const actions = document.createElement("div");
      actions.className = "mk-actions";
      const offer = scr.querySelector(".dv-offer");
      if (offer) actions.appendChild(offer);
      const resign = document.createElement("button");
      resign.type = "button";
      resign.className = "btn btn-secondary dv-small";
      resign.textContent = "Resign";
      actions.appendChild(resign);
      panel.appendChild(actions);
      // "Your move" beside your own clock.
      const status = scr.querySelector(".dv-status");
      if (status) {
        const chip = document.createElement("span");
        chip.className = `mk-status${status.classList.contains("mine") ? " mine" : ""}`;
        chip.textContent = status.textContent;
        you.insertBefore(chip, you.querySelector(".dv-clock"));
      }
    }
    scr.appendChild(side);
  });
  await page.waitForTimeout(500);
}

async function players(browser: Browser, s: (typeof SIZES)[number]): Promise<[Page, Page]> {
  const pool = `mkd${Math.random().toString(36).slice(2, 8)}`;
  const pages: Page[] = [];
  for (const n of ["Wren", "Kasparova"]) {
    const page = await (await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale })).newPage();
    await named(page, n);
    const ranks = { Kasparova: rankView({ games: RANKED_1V1.placements.games, ladder: 1747 }), Wren: rankView({ games: RANKED_1V1.placements.games, ladder: 845 }) };
    await page.addInitScript((r) => ((window as any).__mockRank = r), ranks);
    await page.goto("/?nolanding");
    await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
    pages.push(page);
  }
  for (const p of pages) await p.goto(`/1v1?nolanding&debug&pool=${pool}`);
  for (const p of pages) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 40_000 });
  const white = (await pages[0]!.locator(".dv-strip.dv-you").getAttribute("data-side")) === "w" ? pages[0]! : pages[1]!;
  return [white, white === pages[0] ? pages[1]! : pages[0]!];
}
async function tapMove(page: Page, uci: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const white = (await page.locator(".dv-strip.dv-you").getAttribute("data-side")) === "w";
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    await page.mouse.click(box.x + (((white ? f : 7 - f) + 0.5) * box.width) / 8, box.y + (((white ? 7 - r : r) + 0.5) * box.height) / 8);
  }
}

for (const s of SIZES)
  test(`mockup round 2: 1 v 1 on ${s.label}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const [white, black] = await players(browser, s);
    const moves = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"];
    for (const [i, m] of moves.entries()) {
      const [me, them] = i % 2 === 0 ? [white, black] : [black, white];
      await tapMove(me, m);
      await expect(them.locator(".dv-status")).toContainText(/Your (first )?move/, { timeout: 15_000 });
    }
    const page = white;
    const before = await boardPx(page);
    await page.screenshot({ path: `${OUT}/play-${s.label}-before.png` });
    await mock(page);
    const after = await boardPx(page);
    note(`1 v 1 in play, ${s.label}: board ${before} -> ${after} px`);
    await page.screenshot({ path: `${OUT}/play-${s.label}-after.png` });
    // The end page: Kasparova (Black) resigns; White's page.
    await black.getByRole("button", { name: "Match options" }).click();
    await black.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
    await black.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
    await expect(page.getByTestId("es-title")).toHaveText("Victory!", { timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.mouse.click(4, 4);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/end-${s.label}-before.png` });
    await mock(page);
    note(`1 v 1 end page, ${s.label}: board ${await boardPx(page)} px`);
    await page.screenshot({ path: `${OUT}/end-${s.label}-after.png` });
  });
