import { expect, test, type Page } from "@playwright/test";

/** page.evaluate that shrugs off a dropped execution context (seen under heavy load while the page carries on). */
async function safely<T>(f: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (/Execution context was destroyed/.test(String(e))) return fallback;
    throw e;
  }
}
const phase = (p: Page) => safely(() => p.evaluate(() => (window as any).match?.phase.kind ?? "none"), "none");

/** Plays as a strong human (the engine's move, or a planned bot pick if the engine is slow) until the results. */
async function playToResults(page: Page, seen: Set<string>, minutes: number) {
  const stopAt = Date.now() + minutes * 60_000;
  while (Date.now() < stopAt) {
    const p = await phase(page);
    seen.add(p);
    if (p === "results") return;
    if (p === "play") {
      await safely(() => page.evaluate(async () => {
        const m = (window as any).match;
        if (m.phase.kind !== "play") return;
        // Boss battle: call the King every move (he plays when more than half the crowd calls).
        if (m.boss) m.callKing();
        const fen = m.phase.board.fen;
        const engines = m.runner ? null : await m.engines?.();
        const top = await Promise.race([
          m.runner ? m.runner.topMovesFor(fen) : engines[0].topMoves(fen, 1),
          new Promise((r) => setTimeout(() => r(null), 12000)),
        ]);
        const fallback = m.runner ? [...(m.runner.planned?.values() ?? [])][0] : null;
        const move = top ? (top as any)[0].move : fallback;
        if (m.phase.kind === "play" && move) m.submit(move);
      }), undefined);
    }
    if (p === "boss") {
      const k = await safely(() => page.evaluate(() => ((window as any).match.phase.boss?.justKilled ? "bossKill" : (window as any).match.phase.thinking ? "bossThinking" : "bossMove")), "none");
      seen.add(k);
    }
    await page.waitForTimeout(250);
  }
}

/** Pixel centre of a square on the big board. */
async function squareAt(page: Page, square: string, orientation: "white" | "black") {
  const box = (await page.locator(".board-wrap .board").first().boundingBox())!;
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  const col = orientation === "white" ? f : 7 - f;
  const row = orientation === "white" ? 7 - r : r;
  return { x: box.x + ((col + 0.5) * box.width) / 8, y: box.y + ((row + 0.5) * box.height) / 8 };
}

test("pre-game votes: a pawn push and a card both vote; the winners set the ending and the clock", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&mode=crowd&turns=teams&augments=1");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo vs 99 bots/ }).click();
  await expect(page.locator(".vote-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "How does it end?" })).toBeVisible();
  await expect(page.locator(".vote-zone")).toHaveCount(3);
  // Vote 1: push the d- or e-pawn two squares (the middle zone: Boss battle).
  const team = await page.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou).team);
  const orientation = team === "w" ? "white" : "black";
  const [from, to] = team === "w" ? ["d2", "d4"] : ["d7", "d5"];
  const a = await squareAt(page, from, orientation);
  const b = await squareAt(page, to, orientation);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(1);
  await expect(page.locator(".vote-card.on")).toContainText("Boss battle");
  // Votes come in live; then the result.
  await expect.poll(async () => Number(await page.locator(".vote-zone-count").nth(1).textContent())).toBeGreaterThan(1);
  await expect(page.locator(".vote-banner")).toBeVisible({ timeout: 15_000 });
  const format = await page.evaluate(() => (window as any).match.settings.finalFormat);
  expect(["team", "boss", "duel"]).toContain(format);
  // Vote 2: tap the Bullet card.
  await expect(page.getByRole("heading", { name: "How fast?" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("radio", { name: /Bullet/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(2);
  await expect.poll(() => phase(page), { timeout: 20_000 }).toMatch(/play|watching/);
  const clock = await page.evaluate(() => (window as any).match.settings.moveClockSeconds);
  expect([10, 20, 30]).toContain(clock);
});

test("team final: the top 8 play 4v4, the weakest on each side go out, everyone is placed", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=team&rounds=1&clock=20&finalTurns=30");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo vs 99 bots/ }).click();
  const seen = new Set<string>();
  await playToResults(page, seen, 9);
  expect(await phase(page)).toBe("results");
  const f = await page.evaluate(() => (window as any).match.runner.state.final);
  expect(f.format).toBe("team");
  // 30 turns: 24 for the 4v4 step, then the first cut (one from each side).
  expect(f.out.length).toBe(2);
  const places = await page.evaluate(() => (window as any).match.runner.state.players.map((p: any) => p.placement).sort((a: number, b: number) => a - b));
  expect(places).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  if (seen.has("final")) await expect(page.locator(".team-result")).toBeVisible();
});

test("boss battle (solo): the boss replies, strikes every 3 moves, and the result shows", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=boss&rounds=1&clock=20&bossMoves=7");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo vs 99 bots/ }).click();
  const seen = new Set<string>();
  await playToResults(page, seen, 9);
  expect(await phase(page)).toBe("results");
  const boss = await page.evaluate(() => (window as any).match.runner.state.boss);
  expect(["crowd", "boss", "draw"]).toContain(boss.result);
  expect(boss.kills.length).toBe(2);
  expect(boss.kingCharges).toBeGreaterThanOrEqual(0);
  const reached = await page.evaluate(() => {
    const m = (window as any).match;
    const me = m.runner.player("you");
    return me.outInStage === null || me.outInStage >= m.settings.knockoutsPerStage.length;
  });
  if (reached) {
    for (const k of ["boss", "bossThinking", "bossMove", "bossKill"]) expect(seen.has(k)).toBe(true);
    // You called the King every move; the bots back you most of the time, so he played at least once.
    expect(boss.kingMoves.length).toBeGreaterThan(0);
  }
  await expect(page.locator(".team-result")).toBeVisible();
});

test("boss raid (solo): you against a boss from a named opening; the King can strike it", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=6");
  await page.getByRole("radio", { name: /Boss raid/ }).click();
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: "Take on the boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".opening-roulette.landed")).toBeVisible({ timeout: 5_000 });
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.raid).toBe(true);
  expect(boss.board.ply).toBe(10);
  // On your first move, strike the boss (alone, you're the whole crowd): its next move is staggered.
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  await page.getByRole("button", { name: "Strike the boss" }).click();
  // A quick confirm. A strike isn't your turn: the clock stops while he strikes, then you pick.
  await expect(page.getByText("Summon the God King to strike the boss?")).toBeVisible();
  await page.getByRole("button", { name: "Yes" }).click();
  // Alone you're the whole crowd, so he comes at once, during your move: on your king's square, striking the boss.
  await expect(page.getByLabel("The God King strikes the boss")).toBeVisible({ timeout: 5_000 });
  expect(await phase(page)).toBe("play");
  await expect(page.getByRole("button", { name: "Boss struck" })).toBeDisabled();
  // Then he's gone and the move goes on: still yours to pick.
  await expect(page.locator(".king-summon")).toHaveCount(0, { timeout: 8_000 });
  expect(await phase(page)).toBe("play");
  const seen = new Set<string>();
  await playToResults(page, seen, 7);
  expect(await phase(page)).toBe("results");
  const end = await page.evaluate(() => (window as any).match.runner.state.boss);
  expect(end.kingStrikes).toEqual([1]);
  expect(["crowd", "boss", "draw"]).toContain(end.result);
  await expect(page.locator(".team-result")).toBeVisible();
});

test("boss battle (online): the host's browser plays the boss", async ({ page }) => {
  test.setTimeout(12 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=boss&rounds=1&clock=15&bossMoves=6");
  await page.getByLabel("Your name").fill("Host");
  await page.getByRole("button", { name: "Create a lobby" }).click();
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  const seen = new Set<string>();
  await playToResults(page, seen, 11);
  expect(await phase(page)).toBe("results");
  expect(seen.has("bossThinking") || seen.has("bossMove") || seen.has("spectating")).toBe(true);
  expect(["crowd", "boss", "draw"]).toContain(await page.evaluate(() => (window as any).match.phase.bossResult));
});

test("Play now: players land in the same lobby, the count climbs, bots fill it and the votes begin", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  const pages = await Promise.all([0, 1].map(async () => (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage()));
  for (const [i, p] of pages.entries()) {
    await p.goto("/?debug");
    await p.getByLabel("Your name").fill(`P${i}`);
    await p.getByRole("button", { name: /Play now/ }).click();
    await expect(p.getByRole("heading", { name: "Finding players…" })).toBeVisible();
  }
  const codes = await Promise.all(pages.map((p) => p.evaluate(() => (window as any).match.code)));
  expect(codes[0]).toBe(codes[1]);
  await expect(pages[0]!.locator(".finding-count strong")).toHaveText("2");
  // MATCH_FILL_SECONDS is 8 locally: then bots fill the seats and the pre-game votes start.
  for (const p of pages) await expect(p.locator(".vote-screen")).toBeVisible({ timeout: 20_000 });
  expect(await pages[0]!.evaluate(() => (window as any).match.players.length)).toBe(100);
  // A new player now gets a new lobby.
  const late = await (await browser.newContext()).newPage();
  await late.goto("/?debug");
  await late.getByRole("button", { name: /Play now/ }).click();
  await expect(late.getByRole("heading", { name: "Finding players…" })).toBeVisible();
  expect(await late.evaluate(() => (window as any).match.code)).not.toBe(codes[0]);
});
