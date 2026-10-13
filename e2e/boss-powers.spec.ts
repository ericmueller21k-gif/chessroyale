import { expect, type Page } from "@playwright/test";
import { BOARD_SEL, createLobbyFromHome, engineTop, expectCoordsInSquares, test } from "./helpers.ts";

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
  // (The engine's answer is polled for, never awaited inside the page: see engineTop.)
  const { top } = await engineTop(page);
  const { allowed, solo } = await page.evaluate(() => {
    const m = (window as any).match;
    return { allowed: (m.boss?.powers?.allowed ?? null) as string[] | null, solo: !!m.runner };
  });
  // (Solo, the runner's are already the allowed moves, as the judge sees them; online, this device's engine's are filtered.)
  const move = solo ? (top[0]?.move ?? null) : ((allowed ? top.find((t) => allowed.includes(t.move))?.move : top[0]?.move) ?? allowed?.[0] ?? null);
  if (allowed && move && !allowed.includes(move)) throw new Error(`hint ${move} isn't allowed`);
  await page.evaluate((mv) => {
    const m = (window as any).match;
    if (m.phase.kind === "play" && mv) m.submit(mv);
  }, move);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
}

/**
 * How far each block of ice is from its square (the board's own square, which is a few pixels smaller than the wrap
 * at some sizes): the worst edge in px, and the block sizes (Eric, Oct 11: one block the square's shape, on every square).
 */
const iceOffSquares = (p: Page) =>
  p.evaluate((sel) => {
    const board = document.querySelector(`.board-area ${sel.squares}`)!.getBoundingClientRect();
    const black = !!document.querySelector(`.board-area ${sel.wrap}.orientation-black`);
    const sq = board.width / 8;
    const ices = [...document.querySelectorAll<HTMLElement>(".power-board .pw-ice")];
    const off = ices.map((el) => {
      const s = el.dataset.square ?? "";
      const f = s.charCodeAt(0) - 97;
      const r = Number(s[1]) - 1;
      const x = board.left + (black ? 7 - f : f) * sq;
      const y = board.top + (black ? r : 7 - r) * sq;
      const b = el.getBoundingClientRect();
      return { square: s, off: Math.max(Math.abs(b.left - x), Math.abs(b.top - y), Math.abs(b.right - x - sq), Math.abs(b.bottom - y - sq)) };
    });
    return { worst: Math.max(0, ...off.map((o) => o.off)), off, sizes: [...new Set(ices.map((el) => el.getBoundingClientRect().width.toFixed(1)))] };
  }, BOARD_SEL);

/** The power's banner (boss on the left, the moment, the God King on the right). */
const banner = (p: Page, text: string) => p.locator(".fight-banner.power-cut", { hasText: text });

/**
 * Every square where `selector` (a block on the power layer) shows from now on, sorted: watched from before it can
 * appear, as watchFor does. A thaw's melt is on screen for about two thirds of a second, 1.3 s into its moment, and a
 * look after the banner (polls 0.1, 0.25, 0.5, then 1 s apart) can jump right over it (.claude/LESSONS.md, "A
 * navigation that never happened"; docs/history/lessons.md, "A melt the test blinked through").
 */
async function watchSquares(page: Page, selector: string) {
  const tag = Math.random().toString(36).slice(2);
  await page.evaluate(
    ({ tag, selector }) => {
      const w = window as unknown as { __squares?: Record<string, string[]> };
      const seen: string[] = ((w.__squares ??= {})[tag] = []);
      const check = () => {
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
          const sq = el.dataset.square;
          if (sq && !seen.includes(sq)) seen.push(sq);
        }
      };
      check();
      const obs = new MutationObserver(check);
      obs.observe(document.body, { subtree: true, childList: true, attributes: true });
      setTimeout(() => obs.disconnect(), 180_000);
    },
    { tag, selector },
  );
  return { squares: () => page.evaluate((t) => [...(window as unknown as { __squares: Record<string, string[]> }).__squares[t]!].sort(), tag) };
}

/** The squares this turn's thaw names (its moment's: the pieces it frees). */
const thawSquares = async (p: Page): Promise<string[]> => [...(((await powers(p))?.events.find((e: { kind: string }) => e.kind === "thaw")?.squares ?? []) as string[])].sort();

test("the gingerbread man (Freeze): a frozen piece, the rage warning, then the blizzard: one random piece moves, then it thaws", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await page.goto("/?debug&clock=40&bossMoves=7&boss=gingerbread&power=blizzard");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Ginger");
  await expect(page.locator(".rage-meter")).toBeVisible();
  // Its bar in full color (the threat skulls' dimming once caught it too: it sat at 22%).
  expect(await page.locator(".rage-meter i").first().evaluate((e) => getComputedStyle(e).opacity)).toBe("1");

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
  expect((await iceOffSquares(page)).worst).toBeLessThanOrEqual(1);
  expect(p2.allowed.some((m: string) => m.startsWith(p2.frozen.square))).toBe(false);
  // (A move of the iced piece from the engine's unfiltered search, if it has one there: refused.)
  const all = (await engineTop(page, "raw")).top;
  const tried = all.find((x) => x.move.startsWith(p2.frozen.square))?.move ?? null;
  if (tried) await page.evaluate((mv) => (window as any).match.submit(mv), tried);
  if (tried) await page.waitForTimeout(300);
  expect(await phase(page)).toBe("play");

  await playBest(page);
  // The blizzard: its banner naming the one piece left free (at random from the seed), the sweep across the board,
  // and every crowd piece iced but that one; the meter full on its turn.
  await expect(banner(page, "BLIZZARD!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "BLIZZARD!")).toContainText(/Only your (pawn|knight|bishop|rook|queen|king) on [a-h][1-8] moves/);
  await expect(page.locator(".pw-sweep")).toBeVisible({ timeout: 5_000 });
  // The God King speaks of the piece the storm left free.
  await expect(page.locator(".gk-bubble")).toContainText(/queen|king|one/i, { timeout: 6_000 });
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
  const free = p3.events.find((e: { kind: string }) => e.kind === "blizzard").square as string;
  expect(pieceOn(fen3, free)).toMatch(/[PNBRQK]/);
  expect(p3.allowed.every((m: string) => m.slice(0, 2) === free)).toBe(true);
  expect(p3.iced).not.toContain(free);
  expect(p3.iced.length).toBeGreaterThan(5);
  await expect(page.locator(".power-board .pw-ice")).toHaveCount(p3.iced.length);
  expect(p3.rage).toBe(1);
  await expect(page.locator(".rage-meter.now")).toBeVisible();
  // Every block on its own square within 1 px, all one size, whatever the piece under it.
  const ice = await iceOffSquares(page);
  expect(ice.worst, JSON.stringify(ice.off)).toBeLessThanOrEqual(1);
  expect(ice.sizes).toHaveLength(1);
  // The pieces due to thaw next turn (three or four: four or five free then) show cracked, thin ice; the rest whole.
  expect(p3.thaw.length).toBeGreaterThanOrEqual(3);
  expect(p3.thaw.length).toBeLessThanOrEqual(4);
  await expect(page.locator(".power-board .pw-ice.thawing")).toHaveCount(p3.thaw.length);
  for (const sq of p3.thaw) await expect(page.locator(`.power-board .pw-ice.thawing[data-square="${sq}"]`)).toHaveCount(1);
  // (Each thaw's melt is watched for from before the boss's move: it's on screen for about two thirds of a second.)
  const melt4 = await watchSquares(page, ".power-board .pw-ice.melting");
  await playBest(page);
  // While the boss thinks, the ice stays on.
  await expect.poll(async () => (await powers(page))?.iced.length ?? 0, { timeout: 10_000 }).toBeGreaterThan(5);
  // The thaw as the next turn begins (Eric, Oct 12): its banner names the pieces freed, their ice melts away (each of
  // them, and only them), and four or five are free in all; the rest crack (all of it thaws next turn). The meter empty
  // and dashed throughout.
  await expect(banner(page, "THAWING!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "THAWING!")).toContainText(/Your .+ (is|are) free|more of your pieces are free/);
  const thawed4 = await thawSquares(page);
  expect(thawed4.length).toBeGreaterThan(0);
  for (const sq of thawed4) expect(p3.iced).toContain(sq);
  await expect.poll(() => melt4.squares(), { timeout: 10_000 }).toEqual(thawed4);
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p4 = await powers(page);
  const fen4: string = await page.evaluate(() => (window as any).match.phase.board.fen);
  const crowd4 = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((sq) => /[PNBRQK]/.test(pieceOn(fen4, sq) ?? ""));
  const free4 = crowd4.filter((sq) => !p4.iced.includes(sq));
  expect(free4.length).toBeGreaterThanOrEqual(4);
  expect(free4.length).toBeLessThanOrEqual(6);
  for (const sq of p3.thaw) if (/[PNBRQK]/.test(pieceOn(fen4, sq) ?? "")) expect(free4).toContain(sq);
  expect(p4.allowed.length).toBeGreaterThan(0);
  for (const m of p4.allowed) expect(p4.iced).not.toContain(m.slice(0, 2));
  expect(p4.thaw).toEqual(p4.iced);
  await expect(page.locator(".power-board .pw-ice")).toHaveCount(p4.iced.length);
  await expect(page.locator(".power-board .pw-ice.thawing")).toHaveCount(p4.iced.length);
  expect((await iceOffSquares(page)).worst).toBeLessThanOrEqual(1);
  expect(p4.rage).toBe(0);
  expect(p4.paused).toBe(true);
  await expect(page.locator(".rage-meter.paused")).toBeVisible();
  const melt5 = await watchSquares(page, ".power-board .pw-ice.melting");
  await playBest(page);
  // Its last turn: the rest thaw (their ice melts away), the ice is gone, every move allowed; the meter still held empty.
  await expect(banner(page, "THAWED!")).toBeVisible({ timeout: 30_000 });
  await expect(banner(page, "THAWED!")).toContainText(/ice is gone/i);
  const thawed5 = await thawSquares(page);
  expect(thawed5.length).toBeGreaterThan(0);
  for (const sq of thawed5) expect(p4.iced).toContain(sq);
  await expect.poll(() => melt5.squares(), { timeout: 10_000 }).toEqual(thawed5);
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p5 = await powers(page);
  expect(p5.iced).toEqual([]);
  expect(p5.allowed).toBeNull();
  await expect(page.locator(".power-board .pw-ice")).toHaveCount(0);
  expect(p5.paused).toBe(true);
  expect(p5.ultAt).not.toBeNull();
  await playBest(page);
  // Over as the next turn begins: the meter has emptied and fills again (it's not gone).
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|results/);
  if ((await phase(page)) === "play") {
    const p6 = await powers(page);
    expect(p6.rage).toBeLessThan(0.5);
    expect(p6.ultAt).toBeNull();
    await expect(page.locator(".rage-meter")).toBeVisible();
    await expect(page.locator(".rage-meter.now, .rage-meter.warned, .rage-meter.paused")).toHaveCount(0);
  }
});

/**
 * Where a real square is on screen (its center), on the big board as it's drawn now: either way up, and turned a
 * quarter of the way round in Boingo's funhouse (the board's data-turn: 90 or 270), as Board draws it (board-view.ts).
 */
const squareOnScreen = (p: Page, square: string) =>
  p.evaluate(([sq, sel]) => {
    const wrap = document.querySelector(`.board-area ${sel.wrap}`)!;
    const b = wrap.querySelector(sel.squares)!.getBoundingClientRect();
    const black = wrap.classList.contains("orientation-black");
    const turn = Number((wrap.closest(".board-wrap") as HTMLElement | null)?.dataset.turn ?? 0);
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    const [F, R] = turn === 90 ? [r, 7 - f] : turn === 270 ? [7 - r, f] : [f, r];
    const col = black ? 7 - F : F;
    const row = black ? R : 7 - R;
    return { x: b.left + (col + 0.5) * (b.width / 8), y: b.top + (row + 0.5) * (b.height / 8), size: b.width / 8 };
  }, [square, BOARD_SEL] as const);

/** How far each pie is from its square, wherever the board is turned (the worst edge in px), and how many there are. */
const piesOffSquares = (p: Page) =>
  p.evaluate((sel) => {
    const wrap = document.querySelector(`.board-area ${sel.wrap}`)!;
    const board = wrap.querySelector(sel.squares)!.getBoundingClientRect();
    const black = wrap.classList.contains("orientation-black");
    const turn = Number((wrap.closest(".board-wrap") as HTMLElement | null)?.dataset.turn ?? 0);
    const sq = board.width / 8;
    const pies = [...document.querySelectorAll<HTMLElement>(".power-board .pw-pie")];
    const off = pies.map((el) => {
      const s = el.dataset.square ?? "";
      const f = s.charCodeAt(0) - 97;
      const r = Number(s[1]) - 1;
      const [F, R] = turn === 90 ? [r, 7 - f] : turn === 270 ? [7 - r, f] : [f, r];
      const x = board.left + (black ? 7 - F : F) * sq;
      const y = board.top + (black ? R : 7 - R) * sq;
      const b = el.getBoundingClientRect();
      return { square: s, off: Math.max(Math.abs(b.left - x), Math.abs(b.top - y), Math.abs(b.right - x - sq), Math.abs(b.bottom - y - sq)) };
    });
    return { worst: Math.max(0, ...off.map((o) => o.off)), off, count: pies.length };
  }, BOARD_SEL);

/** A finger dragging from one point to another (touch events, as a phone sends them). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from.x, from.y) });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/**
 * Your move, played by hand on the board as it's drawn now: the engine's best allowed move, by two taps (`tap`) or a
 * drag (`drag`; on a phone a finger's, on a computer the mouse's). Returns the move, once the game has it.
 */
async function playByHand(page: Page, how: "tap" | "drag", phone: boolean): Promise<string> {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.locator(".cc-banner", { hasText: "Round start" }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const { top } = await engineTop(page);
  const move = top[0]!.move;
  const plies: number = await page.evaluate(() => (window as any).match.runner.boards.get(0).history.length);
  const a = await squareOnScreen(page, move.slice(0, 2));
  const b = await squareOnScreen(page, move.slice(2, 4));
  if (how === "tap") {
    if (phone) {
      await page.touchscreen.tap(a.x, a.y);
      await page.touchscreen.tap(b.x, b.y);
    } else {
      await page.mouse.click(a.x, a.y);
      await page.mouse.click(b.x, b.y);
    }
  } else if (phone) await touchDrag(page, a, b);
  else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
  }
  // (A promotion asks for the piece: a queen.)
  const promo = page.locator(".promo-piece.q");
  if (await promo.isVisible().catch(() => false)) await promo.click();
  // The game has the move you meant: the square you touched was the square you meant.
  await expect.poll(() => page.evaluate((n) => (window as any).match.runner.boards.get(0).history[n] ?? null, plies), { timeout: 15_000 }).toBe(move.slice(0, 4) + (move.length > 4 ? move[4] : ""));
  return move;
}

test("Boingo: pies nobody can move onto (up to two, on their squares), the warning, then the funhouse turns the board upside down and plays your move (unscored)", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/?debug&clock=40&bossMoves=8&boss=clown&power=funhouse&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Boingo the Clown");

  await playBest(page);
  await expect(banner(page, "PIE!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pw-pie")).toBeVisible({ timeout: 5_000 });
  await expect(banner(page, "RAGE!")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  const p2 = await powers(page);
  expect(p2.pies).toHaveLength(1);
  if (p2.allowed) expect(p2.allowed.some((m: string) => p2.pies.some((x: { square: string }) => x.square === m.slice(2, 4)))).toBe(false);
  const pie2 = await piesOffSquares(page);
  expect(pie2.worst, JSON.stringify(pie2.off)).toBeLessThanOrEqual(1);
  const plies: number = await page.evaluate(() => (window as any).match.runner.boards.get(0).history.length);
  const scoredBefore: number = await page.evaluate(() => (window as any).match.moves.length);

  await playBest(page);
  // The funhouse as your turn begins, on a screen of its own: the banner, then Boingo drops onto the board and it turns
  // upside down, his joke (in his text box), and he plays your move: "Not scored."
  await expect(banner(page, "FUNHOUSE!")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".pm-pogo")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".bc-bubble:visible")).toContainText(/Oops! Did I just play for you|Whoopsie, my hand slipped|Honk honk! I'll drive|You're welcome/, { timeout: 6_000 });
  await expect(page.getByText("Not scored.")).toBeVisible();
  const fun = await page.evaluate(() => (window as any).match.runner.state.boss.powers.funhouse);
  expect(fun.move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  await expect(page.locator(".dock-line", { hasText: "Plays your move" })).toContainText(`Plays your move: ${fun.san}`, { timeout: 6_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  // Your move, his, the one he played for you and his reply; only yours was scored.
  expect(await page.evaluate(() => (window as any).match.runner.boards.get(0).history.length)).toBe(plies + 4);
  expect(await page.evaluate((n) => (window as any).match.runner.boards.get(0).history[n], plies + 2)).toBe(fun.move);
  expect(await page.evaluate(() => (window as any).match.moves.length)).toBe(scoredBefore + 1);
  const p3 = await powers(page);
  expect(p3.angle).toBe(180);
  // Two pies now (a new one every other turn), on their squares, the board upside down: you play White from Black's side.
  expect(p3.pies.length).toBeGreaterThanOrEqual(1);
  expect(p3.pies.length).toBeLessThanOrEqual(2);
  expect(new Set(p3.pies.map((x: { square: string }) => x.square)).size).toBe(p3.pies.length);
  await expect(page.locator(`.board-area ${BOARD_SEL.wrap}.orientation-black`)).toBeVisible();
  await expectCoordsInSquares(page, "black", 10_000, 0);
  const pie3 = await piesOffSquares(page);
  expect(pie3.worst, JSON.stringify(pie3.off)).toBeLessThanOrEqual(1);
});

test("Boingo's funhouse at every angle: a move by tap and a move by drag, the coordinates and the pies on their squares", async ({ page }, info) => {
  test.setTimeout(12 * 60_000);
  const phone = info.project.name === "phone";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=90&bossMoves=20&boss=clown&power=funhouse&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  // Turns 1-2 the right way up, 3-6 upside down (turn 3 his move for you), 7-10 a quarter turn to his side, 11-14 to
  // the other, 15 on back.
  const angles: number[] = [];
  const turns: number[] = [];
  const played: string[] = [];
  for (let i = 1; i <= 15; i++) {
    await expect.poll(() => phase(page), { timeout: 90_000 }).toMatch(/play|results/);
    if ((await phase(page)) !== "play") break;
    const p = await powers(page);
    const turn: number = p.turn;
    turns.push(turn);
    angles.push(p.angle);
    const turned = p.angle === 90 || p.angle === 270 ? p.angle : 0;
    await expectCoordsInSquares(page, p.angle === 180 ? "black" : "white", 10_000, turned);
    const pies = await piesOffSquares(page);
    expect(pies.worst, `turn ${turn}: ${JSON.stringify(pies.off)}`).toBeLessThanOrEqual(1);
    expect(pies.count).toBeLessThanOrEqual(2);
    // At each angle: the step's first turn of yours by taps, its second by a drag; the rest by the engine's best move.
    const step = turn - [15, 11, 7, 4, 1].find((first) => turn >= first)!;
    if (step === 0) played.push(`${p.angle}:tap:${await playByHand(page, "tap", phone)}`);
    else if (step === 1) played.push(`${p.angle}:drag:${await playByHand(page, "drag", phone)}`);
    else await playBest(page);
  }
  expect(turns).toEqual([1, 2, ...Array.from({ length: 13 }, (_, i) => i + 4)]);
  const side = angles[5];
  expect([90, 270]).toContain(side);
  expect(angles).toEqual([0, 0, 180, 180, 180, side, side, side, side, 360 - side!, 360 - side!, 360 - side!, 360 - side!, 0, 0]);
  console.log(info.project.name, JSON.stringify(played));
  for (const a of [0, 180, 90, 270]) for (const how of ["tap", "drag"]) expect(played.some((x) => x.startsWith(`${a}:${how}:`)), `${a}° by ${how}`).toBe(true);
  expect(errors).toEqual([]);
});

test("Boingo online: the funhouse turns the board for everyone and the host plays your move (unscored)", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=raid&boss=clown&power=funhouse&bossMoves=4&clock=30");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  await playBest(page);
  await expect(banner(page, "PIE!")).toBeVisible({ timeout: 60_000 });
  await playBest(page);
  await expect(banner(page, "FUNHOUSE!")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".pm-pogo")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Not scored.")).toBeVisible();
  await expect(page.locator(".dock-line", { hasText: "Plays your move" })).toContainText(/Plays your move: \S+/, { timeout: 6_000 });
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const p = await powers(page);
  expect(p.funhouse?.turn).toBe(3);
  expect(p.funhouse?.move).toMatch(/^[a-h][1-8][a-h][1-8]/);
  expect(p.angle).toBe(180);
  await expect(page.locator(`.board-area ${BOARD_SEL.wrap}.orientation-black`)).toBeVisible();
});
