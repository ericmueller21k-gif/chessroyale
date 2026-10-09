import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { engineTop, test, watchFor } from "./helpers.ts";

/**
 * G-REX, the Fire boss, played through alone on a phone and a computer: his sparkler's tile burning in stages with its
 * countdown, a piece left on a tile ablaze burning, the God King's warning, and the Roman candle (?power=candle: warned
 * as the second turn begins, fired on the third): its 24 shots falling 1, 2, 3, 4, 4, 4, 3, 2, 1 from 3 crowd moves
 * on, each wave's squares shadowed 3 turns ahead. And the admins' test trigger.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const banner = (p: Page, text: string) => p.locator(".fight-banner.power-cut", { hasText: text });

/**
 * Waits for your move, then plays one: G-REX's fire first (`leave`: keep a pawn on a tile ablaze, to watch it burn;
 * `step`: onto a burning tile when one's in reach), else the engine's best allowed move. Returns the move and the
 * squares where a pawn was left to burn.
 */
async function play(page: Page, opts: { leave?: boolean; step?: boolean } = {}) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(300);
  // (The engine's answer is polled for, never awaited inside the page: see engineTop.)
  const { fen, top } = await engineTop(page);
  const { fire, allowed } = await page.evaluate(() => {
    const m = (window as any).match;
    return { fire: (m.boss?.powers?.fire ?? []) as { square: string; stage: number }[], allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
  const best = top[0]?.move ?? null;
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
  const left = opts.leave && move ? ablaze.filter((sq) => !move!.startsWith(sq)) : [];
  // (A burn shows for a moment as the boss's turn begins: watched for from before the move, so it's never missed.)
  const burn = left.length ? await watchFor(page, { piece: { selector: left.map((sq) => `.pw-burns .pw-burn[data-square="${sq}"]:not(.out):not(.fizzled)`).join(",") }, dock: { selector: ".boss-dock-status", text: /burnt/i } }) : null;
  await page.evaluate((mv) => {
    const m = (window as any).match;
    if (m.phase.kind === "play" && mv) m.submit(mv);
  }, move ?? null);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  return { move, left, burn };
}

/** The candle's shadows as markers on the board: square to size (1 small ... 3 biggest). */
const shadowsShown = (page: Page) =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>(".power-board .pw-shadow")].map((e) => [e.dataset.square!, Number(e.dataset.size)])));

test("G-REX: his tiles burn in stages counting down, a piece left on one burns, and the Roman candle's 24 shots fall where their shadows said", async ({ page }) => {
  test.setTimeout(9 * 60_000);
  // (?laststand=0: leaving a piece to burn on purpose isn't taken back by the God King.)
  await page.goto("/?debug&clock=40&bossMoves=16&boss=grex&power=candle&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("G-REX");
  await expect(page.locator(".rage-meter")).toBeVisible();

  await play(page);
  // As the second turn begins: SPARKLER! (a tile on your half, at its first stage, counting 3), then RAGE!.
  await expect(banner(page, "SPARKLER!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "RAGE!")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p2 = await powers(page);
  expect(p2.fire).toHaveLength(1);
  expect(p2.fire[0].stage).toBe(1);
  expect(Number(p2.fire[0].square[1])).toBeLessThanOrEqual(4);
  await expect(page.locator(".power-board .pw-fire.stage-1")).toHaveCount(1);
  await expect(page.locator(`.power-board .pw-fire[data-square="${p2.fire[0].square}"] .pw-count`)).toHaveText("3");

  // Step onto it if a piece can (the God King's warning, once a match).
  await play(page, { step: true });
  // The Roman candle: its banner, G-REX on the middle of the board, the column of pips filling as he fires.
  await expect(banner(page, "ROMAN CANDLE!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pm-rex")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".pw-pips")).toBeVisible({ timeout: 8_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  const p3 = await powers(page);
  expect(p3.candle).toEqual({ at: 3, left: 24 });
  expect(p3.fire[0].stage).toBe(2);
  await expect(page.locator(".power-board .pw-pips")).toHaveAttribute("data-left", "24");
  await expect(page.locator(".power-board .pw-fire.stage-2 .pw-count")).toHaveText("2");
  // The pips stand in the gutter right of the board: never over it, its timer bar or the eval bar.
  const [pips, board, evalBar, timer] = await Promise.all([".power-board .pw-pips", "cg-board", ".eval-bar", ".timer-bar"].map((s) => page.locator(s).first().boundingBox()));
  expect(pips!.x).toBeGreaterThanOrEqual(board!.x + board!.width - 0.5);
  expect(pips!.x + pips!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(pips!.height).toBeGreaterThan(pips!.width * 10);
  expect(pips!.x).toBeGreaterThan(evalBar!.x + evalBar!.width);
  if (timer) expect(pips!.x).toBeGreaterThanOrEqual(timer.x + timer.width - 0.5);
  // The first wave's square is shadowed, small: it falls 3 turns after the launch.
  expect(p3.shadows).toEqual([{ square: expect.any(String), lands: 6, stage: 1 }]);
  await expect.poll(() => shadowsShown(page)).toEqual({ [p3.shadows[0].square]: 1 });

  // Then the barrage: a wave a turn from 3 crowd moves after he fired, each on the squares shadowed 3 turns before.
  // Leave one pawn on a tile ablaze to watch it burn.
  const left = new Map<number, number>();
  const shadowed = new Map<number, string[]>([[6, [p3.shadows[0].square]]]);
  let burnt = false;
  let leftOne = false;
  for (let turn = 4; turn <= 11; turn++) {
    // (The match can end early: a mate.)
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
    if ((await phase(page)) !== "play") break;
    const r = await play(page, { leave: !leftOne });
    if (r.left.length) {
      // It burns as the boss's turn begins (unless it shields the king: then its tile fizzles): flames over its square,
      // the countdown at 0, the dock says so.
      let what: { square: string; piece?: string } | null = null;
      await expect.poll(async () => (what = ((await powers(page))?.burnt ?? []).find((b: { square: string }) => r.left.includes(b.square)) ?? null), { timeout: 15_000 }).not.toBeNull();
      if (what!.piece) {
        leftOne = true;
        await expect.poll(async () => (await r.burn!.seen()).piece, { timeout: 15_000 }).toBe(true);
        await expect.poll(async () => (await r.burn!.seen()).dock, { timeout: 15_000 }).toBe(true);
        burnt = true;
      }
    }
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
    if ((await phase(page)) !== "play") break;
    const p = await powers(page);
    left.set(p.turn, p.candle.left);
    if (p.candle.left > 0) await expect(page.locator(".power-board .pw-pips")).toHaveAttribute("data-left", String(p.candle.left));
    // What landed this turn is what was shadowed for it (but a square the crowd's king stands on: it fizzles).
    const wave = p.events.find((e: { kind: string }) => e.kind === "fireball");
    if (shadowed.has(p.turn)) expect(wave?.squares, `turn ${p.turn}`).toEqual(shadowed.get(p.turn));
    for (const sq of wave?.squares ?? []) if (!wave.fizzled?.includes(sq)) expect(p.fire.find((t: { square: string }) => t.square === sq)?.stage).toBe(1);
    // Every shadow on the board, at its size: the turn it lands is 3 turns out for the smallest.
    for (const sh of p.shadows) {
      expect(sh.lands - p.turn).toBe(4 - sh.stage);
      if (!shadowed.has(sh.lands)) shadowed.set(sh.lands, []);
      if (!shadowed.get(sh.lands)!.includes(sh.square)) shadowed.get(sh.lands)!.push(sh.square);
    }
    await expect.poll(() => shadowsShown(page)).toEqual(Object.fromEntries(p.shadows.map((sh: { square: string; stage: number }) => [sh.square, sh.stage])));
    // Each tile counts down: 3, 2, 1.
    for (const t of p.fire) await expect(page.locator(`.power-board .pw-fire[data-square="${t.square}"] .pw-count`)).toHaveText(String(4 - Math.min(3, t.stage)));
    // Never on the king's square; never two on one square.
    const squares = p.fire.map((t: { square: string }) => t.square);
    expect(new Set(squares).size).toBe(squares.length);
  }
  // (Fired on turn 3: none as the 4th and 5th begin; then 1, 2, 3, 4, 4, 4, 3, 2 and the last 1, a turn each from the 6th.)
  const want: Record<number, number> = { 4: 24, 5: 24, 6: 23, 7: 21, 8: 18, 9: 14, 10: 10, 11: 6, 12: 3 };
  for (const [turn, n] of left) expect(n, `shots up as turn ${turn} begins`).toBe(want[turn]);
  expect(left.size).toBeGreaterThanOrEqual(5);
  if (leftOne) expect(burnt).toBe(true);
});

test("on a computer the dock is under the board at every width, the board and dock on screen", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "a computer's widths");
  await page.goto("/?debug&clock=60&boss=grex");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  for (const [w, h] of [[1024, 800], [1280, 800], [1440, 900], [1600, 900], [1920, 1080], [1590, 923]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const [board, dock] = await Promise.all([page.locator(".board-wrap").first().boundingBox(), page.locator(".boss-dock").boundingBox()]);
    expect(dock!.y, `${w}: the dock under the board`).toBeGreaterThanOrEqual(board!.y + board!.height);
    expect(dock!.y + dock!.height, `${w}: the dock on screen`).toBeLessThanOrEqual(h);
    // (Under it: overlapping it across, not off in another column.)
    expect(dock!.x, `${w}`).toBeLessThan(board!.x + board!.width);
    expect(dock!.x + dock!.width, `${w}`).toBeGreaterThan(board!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${w}: no sideways scroll`).toBeLessThanOrEqual(w);
  }
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

test("the test trigger is hidden from players", async ({ page }) => {
  await page.goto("/?debug&clock=40&bossMoves=6&boss=gingerbread");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect(page.locator(".boss-dock")).toBeVisible();
  await expect(page.locator(".ult-test")).toHaveCount(0);
});

test("an admin's test trigger against Ginger, pressed during your turn: the blizzard next turn, no warning; twice is once", async ({ page }) => {
  test.setTimeout(4 * 60_000);
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
});

test("an admin's test trigger against Boingo, pressed while the boss thinks: the funhouse", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
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
