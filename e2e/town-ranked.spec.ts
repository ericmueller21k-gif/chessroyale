import { devices, expect, type Browser, type Page } from "@playwright/test";
import { asSignedIn, localSql, tapInTown, test, townReady, townTap } from "./helpers.ts";

/**
 * Ranked at the town's tables (Eric, Nov 27: "let's wire up the actual chessboards in town for ranked ... it just does an overlay ...
 * you can cancel it to back out and stay in the town ... if people were in the town, they would also see 1v1s going on, and then they
 * could actually click and spectate those games"; docs/areas/town-square.md, "Ranked at the tables"). A table's Ranked opens the 1 v 1
 * search over the town, you seated; Cancel closes it, still seated. Two players found from two tables are seated at the first's for
 * everyone in the town (server town-tables.ts), the other's seat cleared; a third visitor's tap on that table offers Spectate, its
 * spectator view shows the game (a guest's Spectate greyed: watching needs an account), and the game's end frees the table. Each test in a
 * town and a queue of its own (`?townroom=`, `?pool=`). Number checks through `__townHere()` (who's where, seated at which table, in
 * which game) and the canvas's `data-you`.
 */
test.use({ actionTimeout: 15_000 });
// (Three towns open at once in the second test: the two never run side by side.)
test.describe.configure({ mode: "serial" });

type Here = { uid: string | null; you: boolean; name: string; at: [number, number]; here: boolean; table: number | null; match: string | null };
const hereOf = (p: Page) => p.evaluate(() => (window as unknown as { __townHere: () => Here[] }).__townHere());
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const youAt = async (p: Page) => (await canvas(p).getAttribute("data-you"))!;
const card = (p: Page) => p.getByRole("dialog", { name: "Chess table", exact: true });
const search = (p: Page) => p.getByRole("dialog", { name: "Finding an opponent" });
const tag = () => `${test.info().project.name.slice(0, 1)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A still for Eric (`TOWN_STILLS`: a folder outside the repo; never in CI). */
const still = async (p: Page, name: string) => void (process.env.TOWN_STILLS && (await p.screenshot({ path: `${process.env.TOWN_STILLS}/${name}-${test.info().project.name}.png` })));

/** A signed-in player named `name`, in this test's town and queue (a phone or a computer, as this project). */
async function into(page: Page, name: string, room: string, pool: string) {
  const id = await asSignedIn(page, "tr");
  await localSql(page, "UPDATE users SET name = ? WHERE id = ?", name, id);
  await page.goto(`/town?sky=day&debug&townroom=${room}&pool=${pool}`);
  // (Up to three towns load one after another here, beside the other project's: longer than townReady's 40 s on a busy runner.)
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 90_000 });
  await page.waitForFunction(() => typeof (window as unknown as { __townHere?: unknown }).__townHere === "function");
  // (CPU_THROTTLE=4: a CI runner's pace, to try a timing locally.)
  if (process.env.CPU_THROTTLE) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE) });
  return id;
}

/** Another player on a device like this project's. */
async function another(browser: Browser) {
  const ctx = await browser.newContext(test.info().project.name === "phone" ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  return ctx.newPage();
}

/** The park's tables used here: 3 at (19, 31), 4 at (26, 31). You walk to the square two before one (a bot or a chip can stand in front of it far off). */
const TABLE_COL: Record<number, number> = { 3: 19, 4: 26 };
async function walkUpTo(page: Page, i: number) {
  const c = TABLE_COL[i]!;
  // (There, or beside it if someone stands on it: within a square or two, standing.)
  const near = async () => {
    const [x, y] = (await youAt(page)).split(",").map(Number);
    const still = await page.evaluate(() => !(window as unknown as { __townYou: () => { moving: boolean } | null }).__townYou()?.moving);
    return still && Math.abs(x! - c) <= 2 && Math.abs(y! - 29) <= 2;
  };
  // (A tap that didn't take, on a CI runner's slow frames, is tapped again: waiting for the state, not a short window. #1027's first CI
  // run: the one tap's 10 s ran out.)
  await expect(async () => {
    if (await near()) return;
    expect(await townTap(page, "square", [c, 29]), `the square before table ${i}`).toBe(true);
    await expect.poll(near, { timeout: 15_000 }).toBe(true);
  }, `you walk up to table ${i}`).toPass({ timeout: 45_000 });
}

/**
 * A tap on table `i` (walking you to its free stool), then its card's Ranked, once you sit there: the search over the town (`waits`: it
 * shows; the second of a pair can be paired with the first at once).
 */
async function rankedAt(page: Page, i: number, waits = true) {
  await walkUpTo(page, i);
  await tapInTown(page, "table", i, card(page), { glide: [TABLE_COL[i]!, 29] });
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
  await still(page, "search-over-town");
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

test("two players found from two tables sit at the first's for a third visitor, who opens the game's spectator view (a guest's Spectate greyed); its end frees the table and its player's Back to town seats her there", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const room = `tr${tag()}`;
  const pool = `p${tag()}`;
  const bo = await another(browser);
  const cy = await another(browser);
  // (Gus, a guest: on the phone only. It's the same card on a computer, and a fourth town on both projects at once was more than a
  // machine drew in time: 8 towns, a tap that never landed.)
  const gus = test.info().project.name === "phone" ? await another(browser) : null;
  const annId = await into(page, "Ann", room, pool);
  const boId = await into(bo, "Bo", room, pool);
  await into(cy, "Cy", room, pool);
  // Gus (no sign-in, his town time off), in the same town: he waits by table 3.
  if (gus) {
    await gus.goto(`/town?sky=day&debug&townroom=${room}&pool=${pool}&townguest=off`);
    await expect(canvas(gus)).toHaveAttribute("data-ready", "1", { timeout: 90_000 });
    await gus.waitForFunction(() => typeof (window as unknown as { __townHere?: unknown }).__townHere === "function");
    await walkUpTo(gus, 3);
  }
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
  await still(cy, "seated-pair-far");
  // Gus's tap on Ann: Spectate greyed, with why (watching needs an account: the director's call on #1027's review, S6). Then he goes.
  if (gus) {
    await tapInTown(gus, "player", annId, card(gus), { glide: [19, 29] });
    await expect(card(gus).getByRole("button", { name: "Spectate", exact: true })).toBeDisabled();
    await expect(card(gus)).toContainText("Make a free account to watch.");
    await still(gus, "guest-spectate");
    await gus.context().close();
  }
  // Cy walks up (two squares before it) and taps Ann, seated there: her table's card offers Spectate (who's playing), not a seat.
  await walkUpTo(cy, 3);
  await still(cy, "seated-pair");
  await tapInTown(cy, "player", annId, card(cy), { glide: [19, 29] });
  await expect(card(cy)).toContainText(/Ann vs Bo|Bo vs Ann/);
  await expect(card(cy).getByRole("button", { name: "Ranked" })).toHaveCount(0);
  await still(cy, "seated-pair-card");
  await card(cy).getByRole("button", { name: "Spectate", exact: true }).click();
  const watch = cy.locator(".dv-watch");
  await expect(watch).toBeVisible();
  await expect(watch.locator(".dv-strip")).toHaveCount(2);
  // (Black's strip at the top, White's at the foot: either way round.)
  await expect.poll(async () => (await watch.locator(".dv-strip .dv-name").allInnerTexts()).map((n) => n.trim()).sort()).toEqual(["Ann", "Bo"]);
  await still(cy, "spectating");
  // Ann leaves before the first moves (an abort): Cy's view says so, and the town's table is free again.
  await expect.poll(() => page.evaluate(() => (window as unknown as { duel?: { snapshot(): { phase: string } } }).duel?.snapshot().phase ?? null), { timeout: 30_000 }).toMatch(/^(vote|overlay|play)$/);
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Leave/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
  await expect(watch.locator(".dv-result-title")).toHaveText("Game called off", { timeout: 15_000 });
  // (Back from watching is the same visit (#1027's review, N9): the town's beats say so until one is answered, so no second "entered".)
  const beatBack = cy.waitForRequest((r) => r.url().endsWith("/api/town/here") && r.method() === "POST" && typeof r.postDataJSON()?.c === "number");
  await cy.getByRole("button", { name: "Back to town", exact: true }).click();
  expect((await beatBack).postDataJSON()).toMatchObject({ floor: true });
  await townReady(cy);
  await expect.poll(async () => (await hereOf(cy)).some((h) => h.match === code), { timeout: 20_000, message: "the table is free" }).toBe(false);
  // Ann's end: Back to town puts her back on her stool at table 3, nobody across.
  await page.getByRole("button", { name: "Back to town", exact: true }).click();
  await townReady(page);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  expect(await youAt(page)).toBe(annStool);
});
