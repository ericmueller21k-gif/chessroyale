import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test } from "./helpers.ts";

/**
 * G-REX, the Fire boss, played through alone on a phone and a computer: his sparkler's tile burning in stages, a piece
 * left on a tile ablaze burning, the God King's warning, and the Roman candle (?power=candle: warned as the second
 * turn begins, fired on the third) with its 12 shots falling 1, 2, 3, 4, then 2. And the admins' test trigger.
 *
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const banner = (p: Page, text: string) => p.locator(".fight-banner.power-cut", { hasText: text });

/**
 * Waits for your move, then plays one: G-REX's fire first (`leave`: keep a piece on a tile ablaze, to watch it burn;
 * step onto a burning tile when one's in reach), else the engine's best allowed move.
 */
async function play(page: Page, opts: { leave?: boolean; step?: boolean } = {}) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(300);
  const { fen, fire, allowed, best } = await page.evaluate(async () => {
    const m = (window as any).match;
    const fen: string = m.phase.board.fen;
    const top: { move: string }[] = await m.runner.topMovesFor(fen);
    return { fen, fire: (m.boss?.powers?.fire ?? []) as { square: string; stage: number }[], allowed: (m.boss?.powers?.allowed ?? null) as string[] | null, best: top[0]?.move ?? null };
  });
  const chess = new Chess(fen);
  const legal = chess
    .moves({ verbose: true })
    .map((mv) => mv.from + mv.to + (mv.promotion ?? ""))
    .filter((mv) => !allowed || allowed.includes(mv));
  const mine = (sq: string) => {
    const pc = chess.get(sq as never);
    return !!pc && pc.color === chess.turn() && pc.type !== "k";
  };
  // (A pawn: leaving a bigger piece to burn is a blunder the God King's Last Stand would take back.)
  const ablaze = fire.filter((t) => t.stage >= 3 && mine(t.square) && chess.get(t.square as never)?.type === "p").map((t) => t.square);
  const burning = fire.filter((t) => t.stage < 3).map((t) => t.square);
  let move: string | undefined;
  // (Leave the piece: the best move that doesn't take it off, if the engine's is one; else any quiet one.)
  if (opts.leave && ablaze.length) move = best && !ablaze.includes(best.slice(0, 2)) ? best : legal.find((mv) => !ablaze.includes(mv.slice(0, 2)) && !chess.get(mv.slice(2, 4) as never));
  if (!move && opts.step) move = legal.find((mv) => burning.includes(mv.slice(2, 4)) && chess.get(mv.slice(0, 2) as never)?.type !== "k");
  move ??= best ?? legal[0];
  await page.evaluate((mv) => {
    const m = (window as any).match;
    if (m.phase.kind === "play" && mv) m.submit(mv);
  }, move ?? null);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  return { move, left: !!(opts.leave && ablaze.length && move && !ablaze.includes(move.slice(0, 2))) };
}

test("G-REX: his sparkler's tile burns in stages, a piece left on it burns, and the Roman candle's 12 shots fall 1, 2, 3, 4, 2", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  // (?laststand=0: leaving a piece to burn on purpose isn't taken back by the God King.)
  await page.goto("/?debug&clock=40&bossMoves=12&boss=grex&power=candle&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("G-REX");
  await expect(page.locator(".rage-meter")).toBeVisible();

  await play(page);
  // As the second turn begins: SPARKLER! (a tile on your half, at its first stage), then RAGE!.
  await expect(banner(page, "SPARKLER!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "RAGE!")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p2 = await powers(page);
  expect(p2.fire).toHaveLength(1);
  expect(p2.fire[0].stage).toBe(1);
  expect(Number(p2.fire[0].square[1])).toBeLessThanOrEqual(4);
  await expect(page.locator(".power-board .pw-fire.stage-1")).toHaveCount(1);

  // Step onto it if a piece can (the God King's warning, once a match).
  await play(page, { step: true });
  // The Roman candle: its banner, G-REX on the middle of the board, 12 pips by it.
  await expect(banner(page, "ROMAN CANDLE!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pm-rex")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".pw-pips")).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  const p3 = await powers(page);
  expect(p3.candle).toEqual({ at: 3, left: 12 });
  expect(p3.fire[0].stage).toBe(2);
  await expect(page.locator(".power-board .pw-pips")).toHaveAttribute("data-left", "12");
  await expect(page.locator(".power-board .pw-fire.stage-2")).toHaveCount(1);

  // Then the barrage: 3 crowd moves after he fired, a wave a turn. Leave one piece on a tile ablaze to watch it burn.
  const left = new Map<number, number>();
  let burnt = false;
  let leftOne = false;
  for (let turn = 4; turn <= 10; turn++) {
    const r = await play(page, { leave: !leftOne });
    if (r.left) {
      leftOne = true;
      // It burns as the boss's turn begins: flames over its square, the dock says so.
      await expect(page.locator(".pw-burns .pw-burn")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".boss-dock-status")).toContainText(/burnt/i);
      burnt = true;
    }
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
    if ((await phase(page)) !== "play") break;
    const p = await powers(page);
    left.set(p.turn, p.candle.left);
    if (p.candle.left > 0) await expect(page.locator(".power-board .pw-pips")).toHaveAttribute("data-left", String(p.candle.left));
    // Never on the king's square; never two on one square.
    const squares = p.fire.map((t: { square: string }) => t.square);
    expect(new Set(squares).size).toBe(squares.length);
  }
  // (Fired on turn 3: none as the 5th begins; then 1, 2, 3, 4 and the last 2, a turn each from the 6th.)
  const want: Record<number, number> = { 5: 12, 6: 11, 7: 9, 8: 6, 9: 2, 10: 0, 11: 0 };
  for (const [turn, n] of left) expect(n, `shots up as turn ${turn} begins`).toBe(want[turn]);
  expect(left.size).toBeGreaterThanOrEqual(6);
  if (leftOne) expect(burnt).toBe(true);
});

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

test("the test trigger: hidden from players; an admin's brings the ultimate next turn, pressed during either side's turn", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  // A player: no button.
  await page.goto("/?debug&clock=40&bossMoves=6&boss=gingerbread");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect(page.locator(".boss-dock")).toBeVisible();
  await expect(page.locator(".ult-test")).toHaveCount(0);

  // An admin, against Ginger: pressed during your turn. Twice is once.
  await asAdmin(page);
  await page.goto("/?debug&clock=40&bossMoves=6&boss=gingerbread");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const btn = page.locator(".ult-test");
  await expect(btn).toHaveText("Trigger ultimate (testing)");
  await btn.click();
  await expect(btn).toHaveText("Ultimate next turn (testing)");
  await expect(btn).toBeDisabled();
  // This turn goes on as it was.
  expect((await powers(page)).allowed).toBeNull();
  await play(page);
  await expect(banner(page, "BLIZZARD!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "RAGE!")).toHaveCount(0);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  await expect(btn).toHaveText("Ultimate used (testing)");
  expect((await powers(page)).allowed.length).toBeGreaterThan(0);

  // Against Boingo: pressed while the boss is thinking (its screen, its move on the way): the funhouse next.
  await page.goto("/?debug&clock=40&bossMoves=6&boss=clown");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await play(page);
  await expect(page.locator(".boss-screen .ult-test")).toBeVisible({ timeout: 10_000 });
  await page.locator(".boss-screen .ult-test").click();
  // (Pressed before its move: the funhouse as your turn begins; pressed as its move landed: the turn after.)
  const pressedBefore = await page.evaluate(() => (window as any).match.boss.powers.ultNext);
  const fun = banner(page, "FUNHOUSE!");
  for (let i = 0; i < 2 && !(await fun.isVisible()); i++) {
    if (await fun.waitFor({ timeout: 15_000 }).then(() => true, () => false)) break;
    if ((await phase(page)) === "play") await play(page);
  }
  await expect(fun).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  expect((await powers(page)).funhouse?.move).toBeTruthy();
  expect(pressedBefore).toBe(true);
});
