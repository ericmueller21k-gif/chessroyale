import { expect, type Page } from "@playwright/test";
import { asAdmin, tapInTown, test, townReady } from "./helpers.ts";

/**
 * Chandy's Swamp (Nov 16; docs/areas/town-square.md, "Chandy's Swamp"), on a phone and a computer, as an admin (Chandy is in the game for
 * admins first): his card out front, its Challenge alone open since his rules landed (docs/decisions/2026-11-16-chandy-rules.md); in
 * through the boardwalk to the swamp under the town's sky. Then his rise, played to its wipe by the test switch `introPreview`:
 * the board's post rises first, the platform lifts you both, the crates land, his entrance, his water rising over the screen. Every step
 * and height is recorded in the page, a frame at a time, from before it starts (`__shopIntro`'s `swamp`).
 * Test hooks: the room's canvas (`data-room`, `data-ready`), `__shopIntro()`.
 */
test.use({ actionTimeout: 15_000 });

type Swamp = Record<string, { on: boolean; lift: number; anim: string | null } | null>;
type Hooks = { __shopIntro?: () => { step: string; swamp?: Swamp } | null; __chandyLog?: { step: string; swamp: Swamp | null }[] };
const room = (p: Page) => p.locator("canvas.town-shop-canvas");

async function chandyCard(page: Page) {
  const card = page.getByRole("dialog", { name: "Chandy", exact: true });
  await tapInTown(page, "boss", "chandy", card);
  return card;
}

test("Chandy's Swamp: his Challenge open (his rules are in); in by the boardwalk to the swamp under the sky", async ({ page }) => {
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await townReady(page);
  const card = await chandyCard(page);
  await expect(card.getByRole("button", { name: "Challenge alone" })).toBeEnabled();
  await expect(card.getByText("Coming soon")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const home = page.getByRole("dialog", { name: "Chandy's Swamp", exact: true });
  await tapInTown(page, "home", "chandy", home);
  await home.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(room(page)).toHaveAttribute("data-room", "chandy");
  // (Its arrival title: its name once, not "CHANDY'S" over it.)
  await expect(page.locator(".area-banner .area-banner-title")).toHaveText("CHANDY'S SWAMP");
  await expect(page.locator(".area-banner .area-banner-sub")).toHaveCount(0);
});

test("his rise: the post first, the platform lifting you both, the crates on it, his water rising over the screen @phone-only", async ({ page }) => {
  test.setTimeout(180_000);
  await asAdmin(page);
  // (Every frame from the room's first: the intro's step and the swamp's heights, as the room drew them.)
  await page.addInitScript(() => {
    const w = window as unknown as Hooks;
    w.__chandyLog = [];
    const tick = () => {
      const s = w.__shopIntro?.();
      if (s) w.__chandyLog!.push({ step: s.step, swamp: s.swamp ?? null });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/town?sky=day&introPreview=1");
  await townReady(page);
  const card = await chandyCard(page);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  await page.getByRole("dialog", { name: "Challenge Chandy?" }).getByRole("button", { name: "Fight" }).click();
  // (His wipe: the storm's canvas, his, covering the screen.)
  await expect(page.locator('canvas.boss-storm[data-boss="chandy"][data-covered="1"]')).toBeAttached({ timeout: 90_000 });
  const log = await page.evaluate(() => (window as unknown as Hooks).__chandyLog ?? []);
  const steps = log.map((l) => l.step).filter((s, i, a) => s !== a[i - 1]);
  expect(steps).toEqual(expect.arrayContaining(["post", "platform", "settle", "crates", "table", "entrance"]));
  expect(steps.indexOf("post")).toBeLessThan(steps.indexOf("platform"));
  const at = (step: string) => log.filter((l) => l.step === step && l.swamp);
  // (The board rises first: up through the post's beat, the platform not shown, you both still in the water.)
  for (const l of at("post")) {
    expect(l.swamp!.platform?.on ?? false).toBe(false);
    expect(l.swamp!.you?.lift ?? 0).toBe(0);
  }
  // (The platform's deck carries you both: never under you, never over you; you're on it from when it reaches your feet.)
  for (const l of at("platform")) {
    const deck = l.swamp!.platform!.lift;
    expect(l.swamp!.you!.lift).toBeCloseTo(Math.max(0, deck), 1);
    expect(l.swamp!.boss!.lift).toBeCloseTo(Math.max(0, deck), 1);
  }
  // (From then on, up on it: the crates landed on its deck beside you.)
  const last = at("entrance").at(-1)!.swamp!;
  expect(last.you!.lift).toBeCloseTo(0.6, 2);
  expect(last.crateB!.lift).toBeCloseTo(0.6, 2);
  expect(last.crateY!.lift).toBeCloseTo(0.6, 2);
});
