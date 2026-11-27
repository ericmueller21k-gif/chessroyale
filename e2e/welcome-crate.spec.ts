import { expect, type Page } from "@playwright/test";
import { WELCOME_CRATE, WELCOME_CRATE_ID, WELCOME_OPEN_XP, WELCOME_TEXT, XP } from "@chessroyale/core";
import { asSignedIn, named, test } from "./helpers.ts";

/**
 * The HunChess Welcome Crate (Eric, Nov 6; docs/decisions/2026-11-06-welcome-crate.md), on a phone: a signed-in account's first
 * visit gives the first (Nov 27: "given when you open the game for the first time on the main page, and it says go to your inventory
 * to view it ... it's only openable after level 5 is reached. But you can still view contents"): the one-time notice "A Welcome Crate
 * is waiting in your inventory" and its Go to inventory; the crate held under Ready to open, greyed with a padlock, "Reach level 5 to
 * open", its page listing every ride, its Open greyed and the server refusing; at level 5 it opens (the usual strip, Fischer Random,
 * the reveal) to a HunChess ride, ridden in the town, "Not tradeable" with no trade or listing anywhere; more games grant nothing until
 * 25 finished games (games counted through the app's own result path, POST /api/results) earn the second, a different ride.
 * WELCOME_SHOTS=<dir>: the stills for the PR.
 */

test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.WELCOME_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${test.info().project.name}.png` });
};

type LockerNow = { items: { id: string; def: string; blemish: number }[]; welcome: { games: number; next: number | null; unopened: number; status: string; notice: boolean; item?: string } };
const lockerNow = (page: Page) => page.evaluate(async () => (await (await fetch("/api/locker")).json()) as LockerNow);
/**
 * One finished game, saved as a solo game saves it (the app's own path): the server times it from its start (the test switch
 * ?xpgame counts it as a minute long: WELCOME_GIFT.soloMinSeconds), then its result with XP.minMoves moves. Since Nov 10 a result
 * the server never timed, or timed shorter, or with fewer moves, doesn't count toward a Welcome Crate.
 */
const finishGame = (page: Page) =>
  page.evaluate(async (moves) => {
    const json = { "content-type": "application/json" };
    const { game } = (await (await fetch("/api/xp/solo/start", { method: "POST", headers: json, body: JSON.stringify({ xpgame: 1 }) })).json()) as { game: string };
    return (await fetch("/api/results", { method: "POST", headers: json, body: JSON.stringify({ mode: "classic", placement: 2, players: 8, evalBar: true, moves, game }) })).ok;
  }, XP.minMoves);

test("the Welcome Crates: the first given on the first visit (its notice, Go to inventory), held and shown but locked below level 5 (the server refuses), opening at level 5 to a HunChess ride, riding it in the town, never tradeable; 25 games earn the second, a different ride", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await named(page, "Tess");
  await page.goto("/");
  await asSignedIn(page, "welcome", { welcomeNotice: true });
  // (With the walkthrough open over home, review of #1012 S4: the notice waits under it, and the walkthrough's Escape leaves it unseen.)
  const seenPosts: string[] = [];
  page.on("request", (r) => r.url().includes("/api/locker/welcome/seen") && seenPosts.push(r.url()));
  const me = page.waitForResponse((r) => r.url().includes("/api/me"));
  await page.goto("/?tour=1");
  const tour = page.getByRole("dialog", { name: "Welcome walkthrough" });
  await expect(tour).toBeVisible();
  await me;
  await page.waitForTimeout(500);
  const notice = page.locator(".welcome-notice");
  await expect(notice, "held while the walkthrough is open").toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);

  // The first visit signed in: the first Welcome Crate is given, and home says so once, with a way to the inventory.
  await expect(notice).toBeVisible({ timeout: 20_000 });
  expect(seenPosts, "not marked seen by the walkthrough's Escape").toEqual([]);
  await expect(notice).toContainText(WELCOME_TEXT.waiting);
  await expect(notice).toContainText("Thank you for being an early tester!");
  await expect(notice).toContainText("open it at level 5");
  await shot(page, "notice");
  await notice.getByRole("button", { name: "▶ Go to inventory" }).click();
  await expect(notice).toHaveCount(0);
  const layer = page.getByTestId("inventory-layer");
  await expect(layer).toBeVisible();

  // In the Crates tab: held under Ready to open, greyed with a padlock and "Reach level 5 to open", its meter your level; crate 2's your
  // games toward 25.
  const rowOf = (n: number) => page.locator(`.welcome-crate-row[data-welcome-n="${n}"]`);
  const row1 = rowOf(1);
  const row2 = rowOf(2);
  await expect(page.locator(".crates-ready .welcome-crate-row")).toHaveCount(1);
  await expect(row1).toContainText("Welcome Crate 1");
  await expect(row1).toHaveAttribute("data-welcome", "ready");
  await expect(row1).toHaveClass(/level-locked/);
  await expect(row1.locator(".welcome-lock")).toHaveCount(1);
  await expect(row1).toContainText(WELCOME_TEXT.locked);
  await expect(row1).toContainText("Level 1/5");
  await expect(row2).toContainText("0/25");
  await expect(row2).toContainText("Finish 25 games to unlock");
  for (const row of [row1, row2]) {
    await expect(row).toContainText("Thank you for being an early tester!");
    await expect(row.locator(".not-tradeable")).toHaveText("Not tradeable");
  }
  // Its page: what's inside, every ride (nothing hidden), no purity; its Open greyed with the padlock's words.
  await row1.click();
  const hero = page.locator(".welcome-crate-hero");
  await expect(hero).toContainText("Welcome Crate 1");
  await expect(hero.locator(".welcome-lock")).toHaveCount(1);
  await expect(hero.locator(".welcome-progress")).toHaveText(WELCOME_TEXT.locked);
  await expect(hero.locator(".not-tradeable")).toHaveText("Not tradeable");
  await expect(page.getByRole("button", { name: /^▶ Open$/ })).toBeDisabled();
  await expect(page.locator(".welcome-page")).not.toContainText(/purity/i);
  await expect(page.locator(".welcome-page .odds-row")).toHaveCount(WELCOME_CRATE.items.length);
  await shot(page, "locked-page");
  // The server refuses it too, below level 5.
  const openNow = () =>
    page.evaluate(async (crate) => {
      const r = await fetch("/api/locker/open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ crate }) });
      return { status: r.status, body: (await r.json()) as { message?: string; again?: boolean; item?: { id: string } } };
    }, WELCOME_CRATE_ID);
  expect(await openNow()).toEqual({ status: 400, body: { message: WELCOME_TEXT.tooLow } });
  // Once: the notice doesn't come back.
  await page.goto("/");
  await page.waitForTimeout(1500);
  await expect(page.locator(".welcome-notice")).toHaveCount(0);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "ready", unopened: 1, notice: false, next: 25, games: 0 });

  // A result the server never timed (an empty post, the outside review's Nov 10 finding): saved, but not counted toward crate 2.
  expect(await page.evaluate(async () => (await fetch("/api/results", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "classic", placement: 1, players: 8 }) })).ok)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ games: 0 });
  // Three games: crate 2's meter counts them; crate 1 still waits for level 5.
  for (let i = 0; i < 3; i++) expect(await finishGame(page)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "ready", games: 3, notice: false });
  await page.goto("/shop?crates");
  await expect(row2).toContainText("3/25");
  await expect(row1).toHaveClass(/level-locked/);

  // Level 5 (the XP test switch): crate 1 opens.
  expect(await page.evaluate(async (xp) => (await fetch("/api/xp/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ xp }) })).ok, WELCOME_OPEN_XP)).toBe(true);
  await page.goto("/shop?crates");
  await expect(row1).toContainText("Ready");
  await expect(row1).toContainText("Level 5/5");
  await expect(row1).not.toHaveClass(/locked/);
  await expect(row1.locator(".welcome-lock")).toHaveCount(0);
  await shot(page, "one-ready");
  await row1.click();
  await expect(page.locator(".welcome-crate-hero .welcome-progress")).toHaveText("Ready");

  // Open it: the strip, Fischer Random, then the reveal: a HunChess ride, "Not tradeable", no purity, no "Open another".
  await page.getByRole("button", { name: /^▶ Open$/ }).click();
  await expect(page.locator(".crate-opening .cox-reel")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  await shot(page, "opening");
  const reveal = page.locator(".reveal-card");
  await expect(reveal).toBeVisible({ timeout: 40_000 });
  await expect(reveal.locator(".reveal-name")).toHaveText(/^HunChess /);
  await expect(reveal.locator(".not-tradeable")).toHaveText("Not tradeable");
  await expect(reveal).not.toContainText(/purity/i);
  await expect(reveal.getByRole("button", { name: "▶ Open another" })).toBeDisabled();
  await shot(page, "reveal");
  let locker = await lockerNow(page);
  const won = locker.items.filter((i) => i.def.endsWith("-hunchess"));
  expect(won).toHaveLength(1);
  expect(WELCOME_CRATE.items).toContain(won[0]!.def);
  expect(locker.welcome).toMatchObject({ status: "opened", item: won[0]!.id });
  // Wear it from the reveal.
  await reveal.getByRole("button", { name: "▶ Wear" }).click();
  await expect(reveal.getByRole("button", { name: "Wearing it" })).toBeVisible();
  await reveal.getByRole("button", { name: "▶ Done" }).click();
  // Crate 1 now reads Opened, with its ride; crate 2 is still locked at 3/25.
  await expect(page.locator(".welcome-crate-hero .welcome-progress")).toHaveText("Opened");
  await expect(page.getByRole("button", { name: /^▶ Open$/ })).toBeDisabled();
  // Back on the Crates tab, a fully opened Welcome Crate shows no row at all (Eric, Nov 25: "they just shouldn't even appear"); crate 2
  // is still there, locked at 3/25, under More crates.
  await page.goto("/shop?crates");
  await expect(row2).toContainText("3/25");
  await expect(row1).toHaveCount(0);
  await expect(page.locator(".welcome-crate-row")).toHaveCount(1);
  await expect(page.locator(".crates-more .welcome-crate-row")).toHaveAttribute("data-welcome-n", "2");
  await expect(row2).toHaveClass(/locked/);

  // Opening again (a second tap, another device): nothing new, the same ride.
  expect(await openNow()).toMatchObject({ status: 200, body: { again: true, item: { id: won[0]!.id } } });
  expect((await lockerNow(page)).items.filter((i) => i.def.endsWith("-hunchess"))).toHaveLength(1);

  // The locker: its tile says "Not tradeable", no purity; there's no trade, sell or list button for it (none exist).
  await page.goto("/shop");
  await page.getByRole("tab", { name: "Locker" }).click();
  await page.getByRole("tab", { name: "Ride", exact: true }).click();
  const tile = page.locator(".locker-item.hunchess-item");
  await expect(tile).toHaveCount(1);
  await expect(tile.locator(".not-tradeable")).toHaveText("Not tradeable");
  await expect(tile).not.toContainText("%");
  await expect(tile.locator(".locker-worn")).toHaveText("Worn");
  // (Its own label says "not tradeable": a button named for trading, selling or listing would be a word of its own.)
  await expect(page.getByRole("button", { name: /\b(trade|sell|list)\b/i })).toHaveCount(0);
  // (One pawn in the preview since Nov 7: your default color, W or B.)
  await expect(page.locator(".locker-preview .avatar.riding")).toHaveCount(1);
  await shot(page, "not-tradeable");

  // Your profile: your pawn rides it, and Wearing lists it with no purity and no shine ("Ride · HunChess gold & black · Not tradeable").
  await page.goto("/");
  await page.getByRole("button", { name: "View profile", exact: true }).click();
  await expect(page.locator(`.fd-card .avatar.riding[data-ride="${won[0]!.def}"]`)).toHaveCount(1);
  const wearing = page.locator(".fd-item").filter({ hasText: "HunChess " });
  await expect(wearing).toContainText("Ride · HunChess gold & black · Not tradeable");
  await expect(wearing).not.toContainText(/pure|purity|shiny|%/i);
  await expect(wearing.locator(".item-art.shiny")).toHaveCount(0);

  // Riding it in the town: your pawn on the HunChess ride, its frames ready.
  await page.goto("/town?sky=day");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __townRide?: () => { you: { ride: string | null; ready: boolean } } | null }).__townRide?.()?.you ?? null), { timeout: 30_000 })
    .toEqual(expect.objectContaining({ ride: won[0]!.def, ready: true }));
  await page.waitForTimeout(800);
  await shot(page, "town");

  // Another game grants nothing: still one crate, opened, one ride, no notice; the next is at 25.
  expect(await finishGame(page)).toBe(true);
  locker = await lockerNow(page);
  expect(locker.welcome).toMatchObject({ status: "opened", notice: false, next: 25, games: 4 });
  expect(locker.items.filter((i) => i.def.endsWith("-hunchess"))).toHaveLength(1);

  // The second at 25: its notice, then it opens to a different HunChess ride.
  for (let i = 4; i < 24; i++) expect(await finishGame(page)).toBe(true);
  expect((await lockerNow(page)).welcome).toMatchObject({ status: "opened", next: 25, games: 24, notice: false });
  expect(await finishGame(page)).toBe(true);
  await page.goto("/");
  await expect(page.locator(".welcome-notice")).toContainText("You earned a Welcome Crate!", { timeout: 20_000 });
  await page.locator(".welcome-notice").getByRole("button", { name: "▶ OK" }).click();
  await page.goto("/shop?crates");
  await expect(row2).toContainText("Ready");
  await expect(row2).toContainText("25/25");
  await expect(page.locator(".crates-ready .welcome-crate-row")).toHaveCount(1);
  await row2.click();
  await page.getByRole("button", { name: /^▶ Open$/ }).click();
  await expect(reveal).toBeVisible({ timeout: 40_000 });
  await expect(reveal.locator(".reveal-name")).toHaveText(/^HunChess /);
  await reveal.getByRole("button", { name: "▶ Done" }).click();
  await expect(page.locator(".welcome-crate-hero .welcome-progress")).toHaveText("Opened");
  // Both used: no Welcome Crate rows at all (Nov 25).
  await page.goto("/shop?crates");
  await expect(page.locator(".series-crate-row").first()).toBeVisible();
  await expect(page.locator(".welcome-crate-row")).toHaveCount(0);
  await shot(page, "both-opened");
  locker = await lockerNow(page);
  const both = locker.items.filter((i) => i.def.endsWith("-hunchess"));
  expect(both).toHaveLength(2);
  expect(new Set(both.map((i) => i.def)).size).toBe(2);
  expect(locker.welcome).toMatchObject({ status: "opened", next: null, unopened: 0, notice: false });
  expect(errors).toEqual([]);
});
