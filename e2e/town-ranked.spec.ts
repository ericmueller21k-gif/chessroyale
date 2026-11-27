import { devices, expect, type Browser, type Page } from "@playwright/test";
import { asSignedIn, localSql, test, townReady, townTap } from "./helpers.ts";

/**
 * Ranked at the town's tables (Eric, Nov 27: "let's wire up the actual chessboards in town for ranked ... it just does an overlay ...
 * you can cancel it to back out and stay in the town ... if people were in the town, they would also see 1v1s going on, and then they
 * could actually click and spectate those games"; docs/areas/town-square.md, "Ranked at the tables"). A table's Ranked opens the 1 v 1
 * search over the town, you seated; Cancel closes it, still seated. Two players found from two tables are seated at the first's for
 * everyone in the town (server town-tables.ts), the other's seat cleared; a third visitor's tap on that table offers Spectate, its
 * spectator view shows the game, and the game's end frees the table. Each test in a town and a queue of its own (`?townroom=`,
 * `?pool=`). Number checks through `__townHere()` (who's where, seated at which table, in which game) and the canvas's `data-you`.
 */
test.use({ actionTimeout: 15_000 });

type Here = { uid: string | null; you: boolean; name: string; at: [number, number]; here: boolean; table: number | null; match: string | null };
const hereOf = (p: Page) => p.evaluate(() => (window as unknown as { __townHere: () => Here[] }).__townHere());
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const youAt = async (p: Page) => (await canvas(p).getAttribute("data-you"))!;
const card = (p: Page) => p.getByRole("dialog", { name: "Chess table", exact: true });
const search = (p: Page) => p.getByRole("dialog", { name: "Finding an opponent" });
const tag = () => `${test.info().project.name.slice(0, 1)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A signed-in player named `name`, in this test's town and queue (a phone or a computer, as this project). */
async function into(page: Page, name: string, room: string, pool: string) {
  const id = await asSignedIn(page, "tr");
  await localSql(page, "UPDATE users SET name = ? WHERE id = ?", name, id);
  await page.goto(`/town?sky=day&debug&townroom=${room}&pool=${pool}`);
  await townReady(page);
  await page.waitForFunction(() => typeof (window as unknown as { __townHere?: unknown }).__townHere === "function");
  return id;
}

/** Another player on a device like this project's. */
async function another(browser: Browser) {
  const ctx = await browser.newContext(test.info().project.name === "phone" ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  return ctx.newPage();
}

/**
 * A tap on table `i` (walking you to its free stool), then its card's Ranked, once you sit there: the search over the town (`waits`: it
 * shows; the second of a pair can be paired with the first at once).
 */
async function rankedAt(page: Page, i: number, waits = true) {
  expect(await townTap(page, "table", i), `table ${i} is drawn at the start`).toBe(true);
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByRole("button", { name: "Casual", exact: true })).toBeDisabled();
  await expect(canvas(page)).toHaveAttribute("data-sit", "1", { timeout: 8000 });
  await card(page).getByRole("button", { name: "Ranked", exact: true }).click();
  await expect(card(page)).toBeHidden();
  if (waits) await expect(search(page)).toContainText("Finding opponent…");
}

test("a table's Ranked opens the 1 v 1 search over the town, you seated; Cancel closes it and you're still on your stool", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await into(page, "Ann", `tr${tag()}`, `p${tag()}`);
  await rankedAt(page, 3);
  const stool = await youAt(page);
  expect(stool, "a stool of table 3, (19, 31)").toMatch(/^(18|20),31$/);
  // The town is still there under it, still drawn; no Home on the stage (Cancel is the way back).
  await expect(canvas(page)).toBeVisible();
  await expect(search(page).getByRole("button", { name: /Home/ })).toHaveCount(0);
  // (A key doesn't walk you off under it.)
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(600);
  expect(await youAt(page)).toBe(stool);
  await search(page).getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(search(page)).toBeHidden();
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  expect(await youAt(page), "still on your stool").toBe(stool);
  expect(new URL(page.url()).pathname).toBe("/town");
  expect(errors).toEqual([]);
});

test("two players found from two tables sit at the first's for a third visitor, who opens the game's spectator view; its end frees the table and its player's Back to town seats her there", async ({ page, browser }, info) => {
  test.setTimeout(240_000);
  const room = `tr${tag()}`;
  const pool = `p${tag()}`;
  const bo = await another(browser);
  const cy = await another(browser);
  const annId = await into(page, "Ann", room, pool);
  const boId = await into(bo, "Bo", room, pool);
  await into(cy, "Cy", room, pool);
  // Ann searches first, from table 3; Bo from table 4: they meet.
  await rankedAt(page, 3);
  const annStool = await youAt(page);
  // (Cy sees Ann seated at table 3, searching, before Bo comes.)
  await expect.poll(async () => (await hereOf(cy)).find((h) => h.uid === annId)?.table ?? null, { timeout: 15_000 }).toBe(3);
  await rankedAt(bo, 4, false);
  for (const p of [page, bo]) await expect(p.locator(".dv-stage, .board-area").first()).toBeVisible({ timeout: 30_000 });
  // Cy: both seated at table 3 (the first's), in one game, Bo's own table clear; neither walking anywhere else.
  await expect
    .poll(
      async () => {
        const h = (await hereOf(cy)).filter((x) => !x.you && x.here);
        return h.map((x) => `${x.uid === annId ? "ann" : x.uid === boId ? "bo" : "?"}@${x.table}:${x.match ? "game" : "-"}`).sort();
      },
      { timeout: 20_000, message: "Cy sees the pair seated at table 3" },
    )
    .toEqual(["ann@3:game", "bo@3:game"]);
  const code = (await hereOf(cy)).find((h) => h.match)!.match!;
  if (process.env.TOWN_STILLS) await cy.screenshot({ path: `${process.env.TOWN_STILLS}/seated-pair-${info.project.name}.png` });
  // Cy walks up (two squares before it) and taps Ann, seated there: her table's card offers Spectate (who's playing), not a seat.
  expect(await townTap(cy, "square", [19, 29])).toBe(true);
  await expect.poll(() => youAt(cy), { timeout: 10_000 }).toBe("19,29");
  expect(await townTap(cy, "player", annId)).toBe(true);
  await expect(card(cy)).toContainText(/Ann vs Bo|Bo vs Ann/);
  await expect(card(cy).getByRole("button", { name: "Ranked" })).toHaveCount(0);
  await card(cy).getByRole("button", { name: "Spectate", exact: true }).click();
  const watch = cy.locator(".dv-watch");
  await expect(watch).toBeVisible();
  await expect(watch.locator(".dv-strip")).toHaveCount(2);
  // (Black's strip at the top, White's at the foot: either way round.)
  await expect.poll(async () => (await watch.locator(".dv-strip .dv-name").allInnerTexts()).map((n) => n.trim()).sort()).toEqual(["Ann", "Bo"]);
  // Ann leaves before the first moves (an abort): Cy's view says so, and the town's table is free again.
  await expect.poll(() => page.evaluate(() => (window as unknown as { duel?: { snapshot(): { phase: string } } }).duel?.snapshot().phase ?? null), { timeout: 30_000 }).toMatch(/^(vote|overlay|play)$/);
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Leave/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
  await expect(watch.locator(".dv-result-title")).toHaveText("Game called off", { timeout: 15_000 });
  await cy.getByRole("button", { name: "Back to town", exact: true }).click();
  await townReady(cy);
  await expect.poll(async () => (await hereOf(cy)).some((h) => h.match === code), { timeout: 20_000, message: "the table is free" }).toBe(false);
  // Ann's end: Back to town puts her back on her stool at table 3, nobody across.
  await page.getByRole("button", { name: "Back to town", exact: true }).click();
  await townReady(page);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  expect(await youAt(page)).toBe(annStool);
});
