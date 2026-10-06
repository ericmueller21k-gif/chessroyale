import { devices, expect, test, type Page } from "@playwright/test";
import { named, soloFromHome } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("your profile: tap your pawn; the same structure as anyone's, with your own actions", async ({ page }) => {
  await named(page, "Eric");
  await page.goto("/");
  // (Once this device's account exists.)
  await expect(page.locator(".fd-hero-name")).toHaveText("Eric");
  // Something to show: a result with a rating, recorded the way a solo match records it.
  await page.evaluate(() =>
    fetch("/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "crowd", placement: 3, players: 100, team: "w", rating: 1612, brilliant: 1, bestMove: "Nxe5", cuts: 11, cutsSurvived: 11 }),
    }),
  );
  // Something to wear: a crate item, worn in its slot.
  await page.evaluate(async () => {
    const post = (path: string, body: object) =>
      fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await post("/api/locker/open", { crate: "winter-1" });
    const { items } = await fetch("/api/locker").then((r) => r.json());
    for (const slot of ["head", "face", "skin", "weapon"]) if ((await post("/api/locker/equip", { slot, item: items[0].id })).ok) break;
  });
  await page.reload();
  // Home names the rank under your name, in the rank's colour.
  await expect(page.locator(".fd-hero-sub")).toContainText("Weighty · 1612");
  await expect(page.locator(".fd-hero-sub .fd-rank")).toHaveText("Weighty");
  await page.getByRole("button", { name: "Your profile" }).click();
  await expect(page.getByRole("heading", { name: "Eric" })).toBeVisible();
  await expect(page.getByText("Online now")).toBeVisible();
  await expect(page.getByText("Weighty · 1612")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open locker" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report" })).toHaveCount(0);
  // Wearing shows the item itself (its drawing, in its colour), not a colour swatch.
  await expect(page.locator(".fd-item .fd-thumb .item-art svg")).toHaveCount(1);
  // Stats: Crowd and Boss raid tabs, real numbers.
  const tiles = page.locator(".fd-stat");
  await expect(tiles.filter({ hasText: "games" })).toContainText("1");
  await expect(tiles.filter({ hasText: "best finish" })).toContainText("3rd");
  await expect(tiles.filter({ hasText: "cuts survived" })).toContainText("100%");
  await page.getByRole("tab", { name: "Boss raid" }).click();
  await expect(tiles.filter({ hasText: "raids" })).toContainText("0");
  await expect(page.getByText("BOSSES BEATEN · 0 / 10")).toBeVisible();
  await expect(page.locator(".fd-match")).toContainText("Best move Nxe5");
  // Rename.
  await page.getByRole("button", { name: "Edit name & icon" }).click();
  await page.getByLabel("Your name").fill("Hunter");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { name: "Hunter" })).toBeVisible();
  // Settings from here, and back home.
  await page.getByRole("button", { name: "Settings" }).first().click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator(".fd-hero-name")).toHaveText("Hunter");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("home → queue → match, then tap a name for that player's profile (phone and computer)", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run plays both a phone and a computer");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  await named(desk, "Desky");
  await named(phone, "Phoney");
  // A boss raid's queue: no teams, so each sees the other on the leaderboard.
  for (const p of [desk, phone]) {
    // (A queue of its own, so other tests' players don't land in it.)
    await p.goto("/?debug&pool=profile");
    await p.getByRole("radio", { name: /Boss raid/ }).click();
    await p.getByRole("button", { name: "PLAY", exact: true }).click();
    await expect(p.locator(".fd-seats")).toBeVisible();
  }
  await expect(desk.locator(".fd-seats .fd-seat")).toHaveCount(50);
  await expect(desk.locator(".fd-seat:not(.empty)")).toHaveCount(2);
  await expect(desk.locator(".fd-queue-line")).toContainText("then the raid begins");
  // A pawn in the queue opens that player's profile too.
  await desk.getByRole("button", { name: "Phoney's profile" }).click();
  await expect(desk.locator(".fd-overlay").getByRole("heading", { name: "Phoney" })).toBeVisible();
  await desk.locator(".fd-overlay").getByRole("button", { name: "Back" }).click();
  // Into the raid (8 s locally, then the boss's intro).
  for (const p of [desk, phone]) await expect.poll(() => phase(p), { timeout: 60_000 }).toMatch(/boss|play/);
  // Computer: the leaderboard beside the board; tap the other player's name.
  await desk.locator(".tower-side").getByRole("button", { name: "Phoney's profile" }).click();
  const sheet = desk.locator(".fd-overlay");
  await expect(sheet.getByRole("heading", { name: "Phoney" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Report" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add friend (later)" })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Edit name & icon" })).toHaveCount(0);
  await expect(sheet).not.toContainText(/@|Google|email/i);
  await sheet.getByRole("button", { name: "Back" }).click();
  await expect(sheet).toHaveCount(0);
  // Phone: open the leaderboard, tap the other player's name.
  await expect.poll(() => phase(phone), { timeout: 30_000 }).toBe("play");
  await phone.locator(".mini-tower-title").click();
  await phone.getByRole("dialog", { name: "Leaderboard" }).getByRole("button", { name: "Desky's profile" }).click();
  await expect(phone.locator(".fd-overlay").getByRole("heading", { name: "Desky" })).toBeVisible();
  await expect(phone.locator(".fd-overlay")).toContainText("Online now");
  await phone.locator(".fd-overlay").getByRole("button", { name: "Report" }).click();
  await phone.getByRole("button", { name: "Name", exact: true }).click();
  await expect(phone.getByText("Thanks. We'll take a look.")).toBeVisible();
});

test("in a match: a bot's name opens a bot's card, yours opens your profile", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await named(page, "Solo");
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  const board = test.info().project.name === "desktop" ? page.locator(".tower-side") : page.getByRole("dialog", { name: "Leaderboard" });
  if (test.info().project.name !== "desktop") await page.locator(".mini-tower-title").click();
  await board.locator(".tower-row:not(.you) .player-name").first().click();
  await expect(page.locator(".fd-overlay")).toContainText("Bots fill the empty seats in a match");
  await page.locator(".fd-overlay").getByRole("button", { name: "Back" }).click();
  await board.getByRole("button", { name: "Your profile" }).click();
  await expect(page.locator(".fd-overlay").getByRole("heading", { name: "Solo" })).toBeVisible();
  await expect(page.locator(".fd-overlay").getByRole("button", { name: "Edit name & icon" })).toBeVisible();
});
