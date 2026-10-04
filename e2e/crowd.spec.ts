import { expect, test } from "@playwright/test";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("Crowd 50 v 50: plays your team's turns, watches the other team's, survives cuts, through the team final to results", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&rounds=1&clock=20&augments=0&finalTurns=12");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo vs 99 bots/ }).click();
  const seen = new Set<string>();
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
        // The best move if the engine answers quickly; any legal move otherwise (a busy test machine mustn't miss the clock).
        const fen = m.phase.board.fen;
        const top = await Promise.race([m.runner.topMovesFor(fen), new Promise((r) => setTimeout(() => r(null), 12000))]);
        // (A teammate bot's planned pick is a legal move in the same position.)
        const fallback = [...(m.runner.planned?.values() ?? [])][0];
        if (m.phase.kind === "play") m.submit(top ? (top as any)[0].move : fallback);
      });
    } else if (p === "reveal") {
      // The live poll shows (unless the short quick-pace reveal has already moved on).
      await expect.poll(async () => (await phase(page)) !== "reveal" || (await page.locator(".poll-row").first().isVisible())).toBe(true);
      if (await page.locator(".poll-row").count()) seen.add("poll");
    }
    await page.waitForTimeout(250);
  }
  expect(await phase(page)).toBe("results");
  for (const k of ["play", "watching", "reveal", "poll", "stageBreak"]) expect(seen.has(k)).toBe(true);
  await expect(page.locator(".team-result")).toBeVisible();
  // Everyone placed 1-100.
  const places = await page.evaluate(() => (window as any).match.runner.state.players.map((p: any) => p.placement).sort((a: number, b: number) => a - b));
  expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
});

test("the board never moves or resizes during a turn (Crowd and Classic)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  for (const mode of ["crowd", "classic"]) {
    await page.goto(`/?debug&pace=quick&mode=${mode}&augments=0`);
    await page.getByLabel("Your name").fill("T");
    await page.getByRole("button", { name: /Play solo/ }).click();
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
    const rects = new Map<string, Set<string>>();
    const stopAt = Date.now() + 25_000;
    while (Date.now() < stopAt) {
      const [kind, rect] = await page.evaluate(async () => {
        const m = (window as any).match;
        const k = m.phase.kind;
        if (k === "play" && !(window as any).__sub && Date.now() > m.phase.startsAt + 1000) {
          (window as any).__sub = 1;
          const top = await m.runner.topMovesFor(m.phase.board.fen);
          if (m.phase.kind === "play") m.submit(top[0].move);
          setTimeout(() => ((window as any).__sub = 0), 500);
        }
        const r = document.querySelector(".board-wrap .board")?.getBoundingClientRect();
        return [k, r ? `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` : "none"];
      });
      if (["play", "scoring", "watching", "reveal"].includes(kind)) {
        if (!rects.has(rect)) rects.set(rect, new Set());
        rects.get(rect)!.add(kind);
      }
      if (kind === "stageBreak" && mode === "classic") await page.evaluate(() => (window as any).match.continueFromBreak());
      await page.waitForTimeout(100);
    }
    const summary = [...rects].map(([r, k]) => `${r} (${[...k].join("/")})`);
    expect(summary, `${mode}: board positions seen`).toHaveLength(1);
    expect([...rects.values()][0]!.size).toBeGreaterThanOrEqual(3);
  }
});
