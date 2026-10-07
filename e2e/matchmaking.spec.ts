import { devices, expect, type Page } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * Matchmaking types (DECISIONS.md, "Matchmaking types"): Default (bots after the fill time; 8 s locally), Bots off
 * (people only, until full; one tap switches to Default keeping your place) and Solo (you and bots, the seats fill
 * fast). Fewer than 30% real players (30 of 100), or Solo: unranked, said in words. Opening the app from scratch during a live match puts
 * you back in it, unless you left on purpose.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const code = (p: Page) => p.evaluate(() => (window as any).match?.code as string | undefined).catch(() => undefined);
const seats = (p: Page) => p.evaluate(() => (window as any).match?.players.length ?? 0).catch(() => 0);
const path = (p: Page) => new URL(p.url()).pathname;
const pool = (name: string) => `${name}-${test.info().project.name}`;

test("home: Default, Bots off and Solo; the ⓘ says what they do; Bots off warns; Solo fills its seats fast and starts", async ({ page }) => {
  await named(page, "Typer");
  await page.goto("/?debug");
  const types = page.getByRole("radiogroup", { name: "Matchmaking" });
  await expect(types.getByRole("radio")).toHaveCount(3);
  await expect(types.getByRole("radio", { name: /^Default/ })).toHaveAttribute("aria-checked", "true");
  // The ⓘ: Default adds bots after 60 seconds.
  await page.getByRole("button", { name: "About matchmaking" }).click();
  await expect(page.locator(".fd-types-info")).toContainText("Default adds bots after 60 seconds to keep the wait short.");
  await expect(page.locator(".fd-types-info")).toContainText("Your ranking changes only in a match with at least 30 real players (15 in a raid).");
  await page.getByRole("button", { name: "About matchmaking" }).click();
  await expect(page.locator(".fd-types-info")).toHaveCount(0);
  // Bots off: a warning that the wait may be much longer.
  await types.getByRole("radio", { name: /^Bots off/ }).click();
  await expect(page.getByRole("note")).toContainText("much longer wait");
  await expect(page.locator(".fd-hint")).toHaveText("People only: starts when 100 have joined");
  // Remembered on this device.
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots off/ })).toHaveAttribute("aria-checked", "true");
  // Play with friends: lobbies only now (Solo is here).
  await page.getByRole("main").getByRole("button", { name: "Play with friends" }).click();
  await expect(page.getByRole("dialog", { name: "Play with friends" }).getByRole("button", { name: /Solo vs/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  // Big enough to tap, and nothing wider than the screen.
  for (const r of await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio").all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole("button", { name: "About matchmaking" }).boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);

  // Solo: the queue screen, your bots fill the 100 seats in a couple of seconds, then the match begins.
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Solo/ }).click();
  await expect(page.locator(".fd-hint")).toContainText("Solo vs 99 bots · starts at once");
  const t0 = Date.now();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-seats")).toBeVisible();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Solo");
  await expect(page.locator(".fd-queue-rank")).toHaveText("Unranked: solo games don't count for ranking");
  await expect(page.locator(".fd-count-n")).toHaveText("100", { timeout: 6_000 });
  const filled = Date.now() - t0;
  expect(filled).toBeLessThan(5_000);
  await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("vote");
  // (Its bots are the match's: the same 99.)
  expect(await page.evaluate(() => (window as any).match.standings().length)).toBe(100);
});

test("Bots off: people only, it waits; one tap switches to Default, keeping your place; then bots fill: Unranked", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Patient");
  const q = pool("mm-off");
  await page.goto(`/?debug&pool=${q}`);
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots off/ }).click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Bots off");
  await expect(page.locator(".fd-queue-line")).toContainText("No bots");
  const first = (await code(page))!;
  // Someone else with Bots off: the same lobby.
  const other = await (await browser.newContext()).newPage();
  await named(other, "Also patient");
  await other.goto(`/?debug&pool=${q}`);
  await other.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots off/ }).click();
  await other.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => code(other)).toBe(first);
  await expect(page.locator(".fd-count-n")).toHaveText("2");
  // Past the fill time (8 s here): still waiting, no bots.
  await page.waitForTimeout(10_000);
  expect(await phase(page)).toBe("lobby");
  expect(await seats(page)).toBe(2);
  // Someone with Default meanwhile gets a lobby of their own (never this one).
  const def = await (await browser.newContext()).newPage();
  await def.goto(`/?debug&pool=${q}`);
  await def.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => code(def)).toBeTruthy();
  expect(await code(def)).not.toBe(first);
  await def.close();

  // One tap: Default, your place kept (you've waited more than a minute's worth here, so the bots come in moments).
  await page.getByRole("button", { name: /Switch to Default/ }).click();
  await expect.poll(() => code(page)).not.toBe(first);
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50");
  await expect(page.locator(".fd-seat.you")).toHaveCount(1);
  // The bots fill in, and it says this one won't count.
  await expect(page.locator(".fd-count-n")).toHaveText("100", { timeout: 15_000 });
  await expect(page.locator(".fd-queue-rank")).toHaveText("Unranked: fewer than 30 real players");
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("vote");
  // The other one is still waiting, people only, in their lobby.
  await expect(other.locator(".fd-count-n")).toHaveText("1");
  expect(await phase(other)).toBe("lobby");
});

test("Boss raid: the three types too; a Solo raid is you and 49 bots against a boss, and its results say Unranked", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=1");
  await page.getByRole("radio", { name: /^Boss raid/ }).click();
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots off/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText("People only: starts at 50, or 10 after a minute");
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Default/ }).click();
  await expect(page.locator(".fd-hint")).toHaveText(/^Join a raid; bots fill the crowd after \d+ s$/);
  // Boss alone is still here (you against a boss you pick).
  await expect(page.getByRole("main").getByRole("button", { name: "Boss alone" })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Solo/ }).click();
  await expect(page.locator(".fd-hint")).toContainText("You and 49 bots against a boss");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Boss raid · up to 50 · Solo");
  await expect(page.locator(".fd-count-n")).toHaveText("50", { timeout: 6_000 });
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.runner.state.players.filter((p: any) => p.isBot).length)).toBe(49);
  // Play it out (the engine's move each time).
  const stopAt = Date.now() + 5 * 60_000;
  while (Date.now() < stopAt && (await phase(page)) !== "results") {
    if ((await phase(page)) === "play") {
      await page
        .evaluate(async () => {
          const m = (window as any).match;
          if (m.phase.kind !== "play" || Date.now() < m.phase.startsAt) return;
          const fen = m.phase.board.fen;
          const [top] = await m.runner.topMovesFor(fen);
          if (m.phase.kind === "play" && m.phase.board.fen === fen) m.submit(top.move);
        })
        .catch(() => undefined);
    }
    await page.waitForTimeout(300);
  }
  expect(await phase(page)).toBe("results");
  await expect(page.locator(".results-unranked")).toHaveText("Unranked: solo games don't change your ranking.");
});

test("opening the app from scratch during a live match puts you back in it; leaving on purpose doesn't", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  // (One device, its storage shared by every page: the app closed and opened again.)
  const ctx = await browser.newContext(test.info().project.name === "phone" ? ({ ...devices["iPhone 13"], browserName: undefined } as any) : {});
  const q = pool("mm-rejoin");
  const first = await ctx.newPage();
  await named(first, "Comeback");
  await first.goto(`/?debug&pool=${q}`);
  await first.getByRole("button", { name: "PLAY", exact: true }).click();
  // Bots fill at 8 s here, then the votes begin: a live match.
  await expect.poll(() => phase(first), { timeout: 30_000 }).toBe("vote");
  const live = (await code(first))!;
  // The app is closed, then opened again from its icon (at /).
  await first.close();
  const again = await ctx.newPage();
  await again.goto("/?debug");
  await expect.poll(() => code(again), { timeout: 20_000 }).toBe(live);
  await expect.poll(() => phase(again), { timeout: 20_000 }).toMatch(/^(vote|play|watching|scoring|reveal|opening)$/);
  expect(path(again)).toBe(`/lobby/${live}`);

  // Leaving on purpose: Cancel in a queue, then the app opened again: home. (Another device, seated nowhere else.)
  const ctx2 = await browser.newContext(test.info().project.name === "phone" ? ({ ...devices["iPhone 13"], browserName: undefined } as any) : {});
  const third = await ctx2.newPage();
  await third.goto(`/?debug&pool=${q}-2`);
  await third.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(third.locator(".fd-seats")).toBeVisible();
  await third.getByRole("button", { name: "Cancel" }).click();
  await expect(third.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await third.close();
  const fourth = await ctx2.newPage();
  await fourth.goto("/?debug");
  await expect(fourth.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await fourth.waitForTimeout(1500);
  expect(path(fourth)).toBe("/");
  expect(await phase(fourth)).toBe("none");
});
