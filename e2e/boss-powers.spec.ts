import { expect, type Page } from "@playwright/test";
import { createLobbyFromHome, test } from "./helpers.ts";

/**
 * Boss powers, played through: the gingerbread man's freeze and blizzard, Boingo's pie and funhouse, alone (solo) on a
 * phone and a computer, and the funhouse online. ?power= brings the ultimate early: warned as the second turn begins
 * (with the passive), unleashed on the third.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);

/** Waits for your move, then plays the engine's best allowed move (a power-up's hints follow the same rules). */
async function playBest(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const m = (window as any).match;
    const fen = m.phase.board.fen;
    const allowed: string[] | null = m.boss?.powers?.allowed ?? null;
    let move: string | null = null;
    if (m.runner) move = (await m.runner.topMovesFor(fen))[0]?.move ?? null;
    else {
      const [engine] = await m.engines();
      const top = await engine.topMoves(fen, 8);
      move = (allowed ? top.find((t: { move: string }) => allowed.includes(t.move))?.move : top[0]?.move) ?? allowed?.[0] ?? null;
    }
    if (allowed && move && !allowed.includes(move)) throw new Error(`hint ${move} isn't allowed`);
    if (m.phase.kind === "play" && move) m.submit(move);
  });
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
}

/** The power's banner (boss on the left, the moment, the God King on the right). */
const banner = (p: Page, text: string) => p.locator(".fight-banner.power-cut", { hasText: text });

test("the gingerbread man (Freeze): a frozen piece, the rage warning, then the blizzard: only the queen moves", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/?debug&clock=40&bossMoves=5&boss=gingerbread&power=blizzard");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("The Gingerbread Man");
  await expect(page.locator(".rage-meter")).toBeVisible();

  await playBest(page);
  // As the second turn begins: FREEZE!, then RAGE! (its ultimate next turn); the clock waits for them.
  await expect(banner(page, "FREEZE!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "FREEZE!").locator(".gk-portrait")).toBeVisible();
  await expect(banner(page, "RAGE!")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".rage-meter.warned")).toBeVisible();
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  // One piece iced; its moves aren't allowed, and a tap of one changes nothing.
  const p2 = await powers(page);
  expect(p2.frozen).toBeTruthy();
  await expect(page.locator(".power-board .pw-ice")).toHaveCount(1);
  expect(p2.allowed.some((m: string) => m.startsWith(p2.frozen.square))).toBe(false);
  // (A move of the iced piece from the engine's unfiltered search, if it has one there: refused.)
  const tried = await page.evaluate(async (sq) => {
    const m = (window as any).match;
    const r = m.runner;
    const all: { move: string }[] = await r.top.get(r.opts.engines[0], m.phase.board.fen);
    const mv = all.find((x) => x.move.startsWith(sq))?.move ?? null;
    if (mv) m.submit(mv);
    return mv;
  }, p2.frozen.square);
  if (tried) await page.waitForTimeout(300);
  expect(await phase(page)).toBe("play");

  await playBest(page);
  // The blizzard: its banner, the sweep across the board, and every crowd piece iced but the queen.
  await expect(banner(page, "BLIZZARD!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pw-sweep")).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p3 = await powers(page);
  const fen3: string = await page.evaluate(() => (window as any).match.phase.board.fen);
  const pieceOn = (fen: string, sq: string) => {
    const rows = fen.split(" ")[0]!.split("/");
    const row = rows[8 - Number(sq[1])]!;
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else {
        if (f === sq.charCodeAt(0) - 97) return c;
        f++;
      }
    }
    return null;
  };
  expect(p3.allowed.length).toBeGreaterThan(0);
  const movers = new Set(p3.allowed.map((m: string) => pieceOn(fen3, m.slice(0, 2))));
  expect([...movers].every((c) => c === "Q" || c === "K")).toBe(true);
  expect(p3.iced.length).toBeGreaterThan(5);
  await expect(page.locator(".power-board .pw-ice")).toHaveCount(p3.iced.length);
  // The God King names the one piece the storm left free.
  await expect(page.locator(".gk-bubble")).toContainText(/queen|king/i, { timeout: 8_000 });
  await playBest(page);
  // The ice melts as the next turn begins.
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
  if ((await phase(page)) === "play") expect((await powers(page)).iced.length).toBeLessThanOrEqual(1);
});

test("Boingo: a pie nobody can move onto, the warning, then the funhouse plays your move and the board shows flipped", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/?debug&clock=40&bossMoves=6&boss=clown&power=funhouse");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Boingo the Clown");

  await playBest(page);
  await expect(banner(page, "PIE!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pw-pie")).toBeVisible({ timeout: 5_000 });
  await expect(banner(page, "RAGE!")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p2 = await powers(page);
  expect(p2.pie).toBeTruthy();
  if (p2.allowed) expect(p2.allowed.some((m: string) => m.slice(2, 4) === p2.pie.square)).toBe(false);
  const scoredBefore: number = await page.evaluate(() => (window as any).match.moves.length);

  await playBest(page);
  // The funhouse: Boingo pogos onto the board, the banner, the board spins, his line, and he plays your move.
  await expect(page.locator(".pm-pogo")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "FUNHOUSE!")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".pm-line")).toBeVisible({ timeout: 6_000 });
  const fun = await page.evaluate(() => (window as any).match.runner.state.boss.powers.funhouse);
  expect(fun.move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  // Not scored: no move of yours was added for it.
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.moves.length)).toBe(scoredBefore + 1);
  // Flipped for your next two turns: you play White, seen from Black's side.
  await expect(page.locator(".board-area .cg-wrap.orientation-black")).toBeVisible();
  expect((await powers(page)).flipped).toBe(true);
  await playBest(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
  if ((await phase(page)) === "play") {
    expect((await powers(page)).flipped).toBe(true);
    await playBest(page);
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
    if ((await phase(page)) === "play") {
      expect((await powers(page)).flipped).toBe(false);
      await expect(page.locator(".board-area .cg-wrap.orientation-white")).toBeVisible();
    }
  }
});

test("Boingo online: the host plays the crowd's move in his funhouse, and everyone sees it", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=raid&boss=clown&power=funhouse&bossMoves=4&clock=30");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  await playBest(page);
  await expect(banner(page, "PIE!")).toBeVisible({ timeout: 60_000 });
  await playBest(page);
  await expect(page.locator(".pm-pogo")).toBeVisible({ timeout: 60_000 });
  await expect(banner(page, "FUNHOUSE!")).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const p = await powers(page);
  expect(p.funhouse?.move).toBeTruthy();
  expect(p.flipped).toBe(true);
  await expect(page.locator(".board-area .cg-wrap.orientation-black")).toBeVisible();
});
