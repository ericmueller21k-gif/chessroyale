import { expect, test } from "@playwright/test";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("Crowd 50 v 50: plays your team's turns, watches the other team's, votes at cuts, through the final to results", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=10");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo vs 99 bots/ }).click();
  const seen = new Set<string>();
  let voted = false;
  const stopAt = Date.now() + 9 * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    seen.add(p);
    if (p === "results") break;
    if (p === "play") {
      // The game starts from the initial position, with no other boards beside it.
      await expect(page.locator(".boards-strip")).toHaveCount(0);
      await page.evaluate(async () => {
        const m = (window as any).match;
        if (m.phase.kind !== "play") return;
        const top = await m.runner.topMovesFor(m.phase.board.fen);
        m.submit(top[0].move);
      });
    } else if (p === "reveal") {
      // The live poll shows (unless the short quick-pace reveal has already moved on).
      await expect.poll(async () => (await phase(page)) !== "reveal" || (await page.locator(".poll-row").first().isVisible())).toBe(true);
      if (await page.locator(".poll-row").count()) seen.add("poll");
    } else if (p === "stageBreak" && !voted && (await page.locator(".augment").count())) {
      await page.locator(".augment-more").click();
      await expect(page.locator(".augment-more.on")).toBeVisible();
      voted = true;
    }
    await page.waitForTimeout(250);
  }
  expect(await phase(page)).toBe("results");
  for (const k of ["play", "watching", "reveal", "poll", "stageBreak"]) expect(seen.has(k)).toBe(true);
  expect(voted).toBe(true);
  await expect(page.locator(".team-result")).toBeVisible();
  // Everyone placed 1-100.
  const places = await page.evaluate(() => (window as any).match.runner.state.players.map((p: any) => p.placement).sort((a: number, b: number) => a - b));
  expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
});
