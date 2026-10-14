import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { BOARD_SEL, test, watchFor } from "./helpers.ts";

/**
 * The Hidden Boss, phase 1 (admins only, in Boss alone), on a phone and a computer with real taps:
 * - he's in the boss menu for an admin (after the rest), never for a player;
 * - his intro (the stare), his brain (Maia at its top rating, raw);
 * - the God King's help tried: blocked, nothing spent, the boss mocks it (the book slammed shut) and the God King says
 *   his help won't take hold;
 * - his ultimate on the admins' trigger: the book consulted, opened like a spell book, slammed shut, "BULLET!", then the
 *   bullet clock (the whole bullet bank on the move, the dock's time left, no increment);
 * - beaten (?win=1: you mate in one): he collapses and mumbles on the board, then the result screen, still mumbling.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const bossNow = (p: Page) => p.evaluate(() => (window as any).match?.boss ?? null);
/** His figure on this screen: the bust in a phone's boss bar, the whole figure by the board on a computer. */
const figure = () => (test.info().project.name === "phone" ? ".boss-char.place-bar" : ".boss-char.place-side");

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    // (A battle's result refetches your profile as it ends: the test may close the page while that's in flight.)
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
    } catch {
      // The page is gone: nothing to answer.
    }
  });
}

async function squareAt(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};
async function yourMove(page: Page, timeout = 120_000) {
  await expect.poll(() => phase(page), { timeout }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 15_000 }).toBe(true);
}
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}
/** A quiet legal move once it's your move (the battle goes on). */
async function quietMove(page: Page): Promise<string> {
  await yourMove(page);
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const moves = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion);
  return (moves.find((m) => m.piece === "p" && !"de".includes(m.from[0]!)) ?? moves[0]!).lan;
}

/** Into Boss alone against him through the boss menu, as an admin. */
async function meetHim(page: Page, query = "laststand=0&clock=60") {
  await asAdmin(page);
  // (The menu lists him once your profile says you're an admin: wait for it.)
  const me = page.waitForResponse((r) => r.url().includes("/api/me") && r.request().method() === "GET");
  await page.goto(`/?debug&${query}`);
  await me;
  await page.waitForTimeout(500);
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu).toBeVisible();
  // (After the rest, for an admin.)
  const rows = menu.locator(".boss-row .br-main strong");
  await expect(rows.last()).toHaveText("Hidden Boss");
  await menu.getByRole("button", { name: /^Hidden Boss, 2650/ }).click();
}

test("a player never sees him: not in the boss menu, and ?boss=recluse meets another boss", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu).toBeVisible();
  await expect(menu.locator(".boss-row .br-main strong").first()).toBeVisible();
  await expect(menu.getByText("Hidden Boss")).toHaveCount(0);
  await page.goto("/?debug&boss=recluse");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(async () => (await bossNow(page))?.id ?? null, { timeout: 30_000 }).not.toBeNull();
  expect((await bossNow(page)).id).not.toBe("recluse");
});

test("an admin fights him in Boss alone: the stare, Maia at its top, the God King's help mocked, the bullet clock on the trigger", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page);
  // His intro: the stare (his figure where it stands on this screen). The God King's opening line in this fight is his
  // own, as "START!" comes (checked at the end: it may wait for his line to type out), never one of his usual ones.
  const intro = await watchFor(page, { stare: { selector: `${figure()}[data-anim="stare"]` } });
  const kingIntro = await watchFor(page, {
    foe: { selector: ".gk-bubble", text: /tremendous power|faint against this one|no ordinary boss/ },
    usual: { selector: ".gk-bubble", text: /Tap me when it counts|Call me if it gets ugly|Say the word|My blade is yours/ },
  });
  await yourMove(page);
  expect(await intro.seen()).toEqual({ stare: true });
  let b = await bossNow(page);
  expect(b).toMatchObject({ id: "recluse", name: "Hidden Boss" });
  // His brain: Maia at its top rating (2500 here), no guard, whatever your rating.
  await expect.poll(() => page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Maia 2500 · no guard/);

  // The God King's help tried: his strike, then his move. Blocked, nothing spent; the boss mocks it, slamming the book.
  const charges = b.kingCharges;
  expect(charges).toBe(3);
  const mocked = await watchFor(page, {
    slam: { selector: `${figure()}[data-anim="slam"]` },
    mock: { selector: ".bc-bubble", text: /psychology|beginner's move|crutch|None of it is chess/ },
    king: { selector: ".gk-bubble", text: /won't take hold|shrugs off my strength|can't reach him/ },
  });
  const king = page.getByRole("button", { name: /God King: tap to summon/ });
  // (Once he has finished what he was saying: a line said while another is up waits its turn, and lapses after 5 s.)
  await expect(page.locator(".gk-bubble")).toHaveCount(0, { timeout: 20_000 });
  await king.click();
  await page.getByRole("menuitem", { name: /Strike/ }).click();
  await expect.poll(() => mocked.seen(), { timeout: 10_000 }).toEqual({ slam: true, mock: true, king: true });
  expect(await phase(page)).toBe("play");
  await expect(page.locator(".king-command, .king-summon")).toHaveCount(0);
  await king.click();
  await page.getByRole("menuitem", { name: /move/i }).first().click();
  await page.waitForTimeout(600);
  expect(await phase(page)).toBe("play");
  b = await bossNow(page);
  expect(b.kingCharges).toBe(charges);
  expect(b.kingStrikes ?? []).toEqual([]);
  expect(b.kingMoves ?? []).toEqual([]);
  expect(b.staggerNext).toBe(false);

  // His ultimate on the admins' trigger: as the next turn begins, no warning.
  const btn = page.locator(".ult-test");
  await expect(btn).toHaveText("Trigger ultimate (testing)");
  await btn.click();
  await expect(btn).toHaveText("Ultimate next turn (testing)");
  const ult = await watchFor(page, {
    consult: { selector: `${figure()}[data-anim="consult"]` },
    spell: { selector: `${figure()}[data-anim="spellLoop"]` },
    close: { selector: `${figure()}[data-anim="spellClose"]` },
    banner: { selector: ".fight-banner.power-cut", text: /BULLET!/ },
    sub: { selector: ".fight-banner.power-cut", text: /No added time\./ },
    line: { selector: ".bc-bubble", text: /thinking too much|staring at the board|All that thinking/ },
    warn: { selector: ".fight-banner.power-cut", text: /RAGE!/ },
  });
  await play(page, await quietMove(page));
  await yourMove(page);
  expect(await ult.seen()).toEqual({ consult: true, spell: true, close: true, banner: true, sub: true, line: true, warn: false });
  b = await bossNow(page);
  expect(b.powers.events.map((e: { kind: string }) => e.kind)).toEqual(["bullet"]);
  await expect(btn).toHaveText("Ultimate under way (testing)");
  // The bullet clock: this move may take the whole bullet bank (no 20 s cap), the dock says what's left.
  const BANK = BOSS_POWERS.bulletBankSeconds * 1000;
  const allowed = await page.evaluate(() => (window as any).match.phase.allowedMs as number);
  expect(allowed).toBe(BANK);
  await expect(page.locator(".boss-dock-status .bullet-note")).toContainText(/Bullet · [23]:\d\d left/);
  // No increment: a move's time comes out of the bank, nothing goes back.
  await page.waitForTimeout(1500);
  await play(page, await quietMove(page));
  // (Your move is scored, then the boss replies: by your next move the bank has the time you took out of it.)
  await yourMove(page);
  const bank = await page.evaluate(() => (window as any).match.runner.player("you").bankMs as number);
  expect(bank).toBeLessThan(BANK - 1500);
  expect(bank).toBeGreaterThan(BANK - 20_000);
  expect(await page.evaluate(() => (window as any).match.phase.allowedMs as number)).toBe(bank);
  await expect(page.locator(".boss-dock-status .bullet-note")).toBeVisible();
  expect(await kingIntro.seen()).toEqual({ foe: true, usual: false });
  expect(errors).toEqual([]);
});

test("beaten (?win=1): he collapses and mumbles on the board, then the result screen, a win, still mumbling", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "win=1");
  await yourMove(page);
  const fall = await watchFor(page, {
    collapse: { selector: `${figure()}[data-anim="collapse"]` },
    slumped: { selector: ".boss-char[data-anim=\"collapseLoop\"]" },
    dock: { selector: ".boss-dock-status", text: /You beat him!/ },
    mumble: { selector: ".bc-bubble", text: /the book said|Morphy, I think everyone agrees|Sixty-four squares/ },
  });
  await play(page, "h5f7");
  // The board holds while he falls (no result yet), then the result.
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.fall), { timeout: 60_000 }).toBe(true);
  expect((await bossNow(page)).result).toBe("crowd");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
  expect(await fall.seen()).toMatchObject({ collapse: true, dock: true });
  await expect(page.locator(".results h1")).toHaveText("Victory!");
  await expect(page.locator(".team-result")).toContainText("The crowd beat Hidden Boss!");
  // On the result screen he stays slumped, mumbling (never back on his feet).
  const results = page.locator(".boss-char.place-results");
  await expect(results).toHaveAttribute("data-anim", "collapseLoop", { timeout: 10_000 });
  await expect.poll(() => fall.seen(), { timeout: 20_000 }).toEqual({ collapse: true, slumped: true, dock: true, mumble: true });
  // His words beside him there, never over him.
  await expect(results.locator(".bc-bubble")).toBeVisible({ timeout: 15_000 });
  const fig = (await results.locator("canvas").boundingBox())!;
  const bubble = (await results.locator(".bc-bubble").boundingBox())!;
  expect(bubble.x, "the bubble starts right of his middle").toBeGreaterThan(fig.x + fig.width / 2);
  expect(bubble.x + bubble.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(errors).toEqual([]);
});
