import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { BOARD_SEL, test, watchFor } from "./helpers.ts";
import { RECLUSE_LINES } from "../packages/app/src/characters/recluse-lines.ts";

/**
 * The Hidden Boss, phase 1 (admins only, in Boss alone), on a phone and a computer with real taps:
 * - he's in the boss menu for an admin (after the rest), never for a player;
 * - his intro (the stare), his brain (Maia at its top rating, raw);
 * - no strikes: nothing about them, ever (the boss card counts moves);
 * - the God King's help tried: blocked, the charge spent all the same (the dock's count drops), the boss mocks it (the
 *   book slammed shut) and the God King says his help won't take hold;
 * - his ultimate on the admins' trigger: the book consulted, opened like a spell book, slammed shut, "BULLET!", then the
 *   bullet clock (the whole bullet bank on the move, the dock's time left, no increment for 3 moves); then he adds time
 *   per move (his line, "+2 s a move from now on" across the board, "Bullet 1+2" in the dock, +2 s a move made in time);
 * - beaten (?win=1: you mate in one): he collapses and mumbles on the board, then (Boss alone) his phase change (it
 *   opens with the God King's absorption: triumphant, drained into the boss's raised hand, gone; the boss's half-engine
 *   look ignites) and phase 2's four boards, with no God King.
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

test("an admin fights him in Boss alone: the stare, Maia at its top, no strikes, the God King's help mocked and spent, the bullet clock on the trigger, then its increment", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page);
  // He never strikes: nothing about strikes from his intro on (the boss card counts moves instead).
  const strikes = await watchFor(page, {
    card: { selector: ".boss-next", text: /Strikes/ },
    dock: { selector: ".boss-dock-status", text: /struck/i },
    // (The title says which move it is: the card, the moves left; Eric, Oct 15.)
    moves: { selector: ".boss-next", text: /^\d+ moves? left$/ },
  });
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

  expect(b.strikeIn).toBeNull();
  // The God King's help tried: his strike, then his move. Blocked, but each try spends its charge as if it had worked
  // (the dock's count drops); the boss mocks it, slamming the book.
  const charges = b.kingCharges;
  expect(charges).toBe(3);
  const crowns = page.locator(".gk-unit-charges");
  await expect(crowns).toHaveAttribute("aria-label", "3 charges left");
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
  await expect(crowns).toHaveAttribute("aria-label", "2 charges left");
  expect((await bossNow(page)).kingCharges).toBe(charges - 1);
  await king.click();
  await page.getByRole("menuitem", { name: /move/i }).first().click();
  await page.waitForTimeout(600);
  expect(await phase(page)).toBe("play");
  await expect(crowns).toHaveAttribute("aria-label", "1 charges left");
  b = await bossNow(page);
  expect(b.kingCharges).toBe(charges - 2);
  expect(b.kingStrikes ?? []).toEqual([]);
  expect(b.kingMoves ?? []).toEqual([]);
  expect(b.staggerNext).toBe(false);
  // (Your move is still yours: he didn't play it.)
  expect(await page.evaluate(() => (window as any).match.kingCalled)).toBe(false);

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
  // (The time control on the left; what's left of the bank is your clock, bold at the box's right.)
  await expect(page.locator(".boss-dock-status .bullet-note")).toHaveText("Bullet");
  await expect(page.locator(".boss-dock-status .dk-clock.running")).toHaveText(/^[01]:\d\d$/);
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

  // The bullet clock's first 3 moves are 1+0 (this is the 2nd): then the 3rd, the bank alone again.
  const INC = BOSS_POWERS.bulletIncrementSeconds * 1000;
  expect(INC).toBe(2000);
  expect(BOSS_POWERS.bulletPlainMoves).toBe(3);
  await expect(page.locator(".boss-dock-status .bullet-note strong")).toHaveText("Bullet");
  await play(page, await quietMove(page));
  await yourMove(page);
  await expect(page.locator(".boss-dock-status .bullet-note strong")).toHaveText("Bullet");
  expect(await page.evaluate(() => (window as any).match.phase.allowedMs as number)).toBe(await page.evaluate(() => (window as any).match.runner.player("you").bankMs as number));
  // Then he adds time per move as the next begins: his line, the increment across the board while his moment holds the
  // screen (the clock not running), the dock's time control. The board says the increment, so the dock never does
  // (nothing said twice at once).
  const plus = await watchFor(page, {
    text: { selector: ".rc-plus", text: /^\+2 s a move from now on$/ },
    line: { selector: ".bc-bubble", text: /Too fast, even for real chess|a lottery, not chess|real chess this fast/ },
    dock: { selector: ".boss-dock-status", text: /\+2 s a move/ },
    consult: { selector: `${figure()}[data-anim="consult"]` },
  });
  // (While the increment is on the board, it's his moment: the boss screen, your clock not started.)
  const during = await page.evaluateHandle(() => {
    const out: string[] = [];
    const obs = new MutationObserver(() => {
      if (document.querySelector(".rc-plus")) out.push((window as any).match.phase.kind);
    });
    obs.observe(document.body, { subtree: true, childList: true });
    setTimeout(() => obs.disconnect(), 120_000);
    return out;
  });
  // As that move begins, your clock goes up by the increment, a "+2" over it (Eric, Oct 15: "the number ticks up with a
  // brief +2"): from what it held through his moment to that plus 2 s.
  const tick = await watchFor(page, { plus: { selector: ".dk-clock.running .dk-plus", text: /^\+2$/ } });
  await play(page, await quietMove(page));
  const heldText = await page.locator(".dk-clock.held .dk-time").textContent();
  await yourMove(page);
  expect(await plus.seen()).toEqual({ text: true, line: true, dock: false, consult: true });
  await expect.poll(() => tick.seen()).toEqual({ plus: true });
  const secs = (t: string | null) => (t ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : NaN);
  const startText = await page.evaluate(() => {
    const p = (window as any).match.phase;
    const s = Math.ceil((p.deadline - p.startsAt) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  });
  expect(secs(startText) - secs(heldText)).toBe(INC / 1000);
  const kinds = await during.evaluate((out) => [...new Set(out)]);
  expect(kinds).toEqual(["boss"]);
  b = await bossNow(page);
  expect(b.powers.events.map((e: { kind: string }) => e.kind)).toEqual(["bulletPlus"]);
  await expect(page.locator(".boss-dock-status .bullet-note")).toHaveText(/^Bullet\s1\+2$/);
  await expect(page.locator(".boss-dock-status .dk-clock.running")).toHaveText(/^[01]:\d\d$/);
  // From this move on, each made in time adds 2 s: the move may take the bank and the 2 s, and what it took comes out.
  const you = () => page.evaluate(() => {
    const m = (window as any).match;
    const p = m.runner.player("you");
    return { bank: p.bankMs as number, think: p.thinkMsTotal as number, allowed: m.phase.allowedMs as number };
  });
  const before = await you();
  expect(before.allowed).toBe(before.bank + INC);
  await play(page, await quietMove(page));
  await yourMove(page);
  const after = await you();
  const took = after.think - before.think;
  expect(took).toBeGreaterThan(0);
  expect(after.bank).toBe(before.bank + INC - took);
  expect(after.allowed).toBe(after.bank + INC);
  await expect(page.locator(".boss-dock-status .bullet-note")).toHaveText(/^Bullet\s1\+2$/);
  // The last charge, then a tap with none left (Eric, Oct 15): his soft "can't" and a tiny shake, nothing else (no
  // menu, the move still yours, no charge to spend).
  await expect(crowns).toHaveAttribute("aria-label", "1 charges left");
  await king.click();
  await page.getByRole("menuitem", { name: /Strike/ }).click();
  await expect(crowns).toHaveAttribute("aria-label", "0 charges left");
  const spent = page.getByRole("button", { name: "God King: no charges left" });
  await expect(spent).toBeEnabled();
  const nope = await watchFor(page, { shake: { selector: ".gk-unit.nope" } });
  await page.evaluate(() => ((window as any).__soundLog = []));
  await spent.click();
  await expect.poll(() => nope.seen()).toEqual({ shake: true });
  expect(await page.evaluate(() => (window as any).__soundLog as string[])).toContainEqual(expect.stringMatching(/^kingCant:/));
  await expect(page.getByRole("menu", { name: "God King commands" })).toHaveCount(0);
  await expect(page.locator(".gk-unit.nope")).toHaveCount(0, { timeout: 2000 });
  expect(await phase(page)).toBe("play");
  expect((await bossNow(page)).kingCharges).toBe(0);
  expect(await strikes.seen()).toEqual({ card: false, dock: false, moves: true });
  await expect(page.locator(".boss-next")).toHaveText(/^\d+ moves? left$/);
  expect(await kingIntro.seen()).toEqual({ foe: true, usual: false });
  expect(errors).toEqual([]);
});

test("Engine move (admins, Boss alone): one tap plays Stockfish's best move as yours; a player never sees it", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page);
  await yourMove(page);
  // His battle starts from the starting position, never a book opening (he has no memorized lines).
  expect(await page.evaluate(() => (window as any).match.phase.board.fen)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const btn = page.getByRole("button", { name: "Engine move", exact: true });
  await expect(btn).toBeVisible();
  const before = await page.evaluate(() => (window as any).match.moves.length as number);
  // (A double tap sends one move: the button waits while the engine searches.)
  await btn.click();
  await btn.click({ timeout: 1000 }).catch(() => {});
  await expect.poll(() => phase(page), { timeout: 15_000 }).not.toBe("play");
  await yourMove(page);
  expect(await page.evaluate(() => (window as any).match.moves.length as number)).toBe(before + 1);
  await expect(btn).toBeEnabled();
  expect(errors).toEqual([]);
});

test("a player in Boss alone never sees Engine move", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await page.getByRole("dialog", { name: "Choose your boss" }).locator(".boss-row").first().click();
  await yourMove(page);
  await expect(page.locator(".ult-test, .engine-move")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Engine move" })).toHaveCount(0);
});

/** Your phase 2 board: big on a phone, at the bottom left of the four on a computer. */
const myBoard = (page: Page) => page.locator(".rc-simul .rc-q2 .hb-board, .rc-simul .board-row > .board-wrap:not(.rc-stage) .hb-board").first();
const simulNow = (p: Page) => p.evaluate(() => (window as any).match?.simul ?? null);
/** A move on your phase 2 board with real taps (White's side down), until it's taken. */
async function simulPlay(page: Page, move: string) {
  await expect.poll(async () => (await simulNow(page))?.boards[0].toMove, { timeout: 60_000 }).toBe("crowd");
  const before = (await simulNow(page)).boards[0].history.length;
  for (let i = 0; i < 5 && (await simulNow(page))?.boards[0].history.length === before; i++) {
    const b = (await myBoard(page).boundingBox())!;
    for (const sq of [move.slice(0, 2), move.slice(2, 4)]) {
      const f = sq.charCodeAt(0) - 97;
      const r = Number(sq[1]) - 1;
      await page.mouse.click(b.x + (f + 0.5) * (b.width / 8), b.y + (7 - r + 0.5) * (b.height / 8));
    }
    await page.waitForTimeout(300);
  }
  expect((await simulNow(page))?.boards[0].history.length ?? before + 1).toBeGreaterThan(before);
}
/** Resign from the match's control, the way this device has it (a phone's "⋯" sheet; a computer's flag), and confirm. */
async function resignHere(page: Page, note: RegExp) {
  if (test.info().project.name === "phone") {
    await page.getByRole("button", { name: "Match options" }).click();
    await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  } else await page.getByRole("button", { name: "Resign", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.locator(".mm-confirm-note")).toHaveText(note);
  await confirm.getByRole("button", { name: /Resign/ }).click();
}

test("his chatter all through phase 1 (Eric, Oct 15: he went quiet after move 10): a line about every 15 s by the clock, the bullet stretch too, his moments' lines first", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(7 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page);
  await yourMove(page);
  // Every line of his as it first shows in his text box, with the time (the page's clock).
  const t0 = await page.evaluate(() => {
    const w = window as any;
    w.__lines = [];
    let last = "";
    setInterval(() => {
      // (Phase 1 until he's beaten: Stockfish's moves may mate him.)
      if (w.match?.boss && !w.match.boss.result) w.__end = Date.now();
      const text = document.querySelector(".bc-bubble")?.getAttribute("aria-label") ?? "";
      if (text && text !== last) w.__lines.push({ at: Date.now(), text });
      last = text;
    }, 100);
    return Date.now();
  });
  // A person's pace: a few seconds a move on the slow clock, quicker on the bullet clock; Stockfish's moves (Engine move),
  // so the battle runs on. About three minutes of play, or until he's beaten (then phase 1's lines only).
  const btn = page.getByRole("button", { name: "Engine move", exact: true });
  const until = Date.now() + 180_000;
  while (Date.now() < until) {
    const ok = await yourMove(page, 30_000).then(() => true, () => false);
    if (!ok) break;
    const b = await bossNow(page);
    if (b?.result) break;
    await page.waitForTimeout(b && b.crowdMoves < 6 ? 2000 + Math.random() * 4000 : 500 + Math.random() * 1500);
    await btn.click({ timeout: 5000 }).catch(() => {});
    await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
  }
  const end = (await page.evaluate(() => (window as any).__end)) as number;
  const lines = ((await page.evaluate(() => (window as any).__lines)) as { at: number; text: string }[]).filter((l) => l.at <= end);
  const p1 = Object.values(RECLUSE_LINES.talk[1]).flat() as string[];
  const log = lines.map((l) => `${((l.at - t0) / 1000).toFixed(1)} s${p1.includes(l.text) ? " [chatter]" : ""}: ${l.text}`);
  console.log(`His lines over ${((end - t0) / 1000).toFixed(0)} s of phase 1 (moves: ${(await bossNow(page))?.crowdMoves}):\n${log.join("\n")}`);
  test.info().annotations.push({ type: "lines", description: log.join(" | ") });
  const chatter = lines.filter((l) => p1.includes(l.text)).map((l) => l.at);
  const gaps = chatter.slice(1).map((t, i) => t - chatter[i]!);
  // Steady from the start to the end of what was played: the first within an interval or so, then no long gap.
  expect(chatter.length).toBeGreaterThanOrEqual(Math.floor((end - t0) / 20_000));
  expect(chatter[0]! - t0).toBeLessThanOrEqual(25_000);
  expect(Math.max(...gaps)).toBeLessThanOrEqual(30_000);
  expect(end - chatter.at(-1)!).toBeLessThanOrEqual(30_000);
  // His moments' lines came, and whole (none is cut short by his chatter: it never cuts in).
  if ((await bossNow(page)).crowdMoves >= 7) expect(lines.some((l) => (RECLUSE_LINES.bullet as readonly string[]).includes(l.text))).toBe(true);
  expect(errors).toEqual([]);
});

test("beaten in phase 1 (?win=1): he collapses and mumbles, then the phase change (he absorbs the God King, up in a rage, his leap onto the board, the book thrown down, the chant and its light, the split, the book back, the leap back, the shuffle) and four boards; all four won: Victory!", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "win=1");
  await yourMove(page);
  const fall = await watchFor(page, {
    collapse: { selector: `${figure()}[data-anim="collapse"]` },
    dock: { selector: ".boss-dock-status", text: /You beat him!/ },
    mumble: { selector: ".bc-bubble", text: /the book said|Morphy, I think everyone agrees|Sixty-four squares/ },
  });
  const change = await watchFor(page, {
    // The God King's absorption: triumphant in his place (his line), the boss's head up and his hand raised, the stream
    // between them, the God King drained (his cry), the power landing (the boss's look ignites, his line), the God King
    // fading and gone.
    triumph: { selector: ".gk-unit.gk-triumph .god-king" },
    triumphLine: { selector: ".gk-bubble", text: /Kneel\. The crown always wins\.|Down you stay, bookworm!|Your book is closed\. Kneel!/ },
    seize: { selector: `${figure()}[data-anim="seize"]` },
    reach: { selector: `${figure()}[data-anim="seizeLoop"]` },
    stream: { selector: ".rc-absorb .rc-mote" },
    drained: { selector: ".gk-unit.gk-drained .god-king[data-anim='lastStand']" },
    cry: { selector: ".gk-bubble", text: /what are you doing\?!|That power is mine!|My strength!/ },
    seized: { selector: `${figure()}[data-anim="seized"]` },
    ignite: { selector: `${figure()} .bc-engine.on.fresh` },
    absorbLine: { selector: ".bc-bubble", text: /All game you leaned on an engine\. Now see how you like it\.|Mind and machine\. Both mine now\./ },
    fading: { selector: ".gk-unit.gk-fading" },
    gone: { selector: ".gk-unit.gone" },
    rage: { selector: `${figure()}[data-anim="rage"]` },
    // (His look over his whole figure on the board too, and the arcs that split it.)
    figEngine: { selector: ".rc-fig .bc-engine.on" },
    arcs: { selector: ".rc-arcs .rc-arc-core" },
    // (From the leap to his return the board draws his whole figure, a phone too, and his place stands empty.)
    away: { selector: ".rc-away" },
    leap: { selector: '.rc-fig[data-anim="leap"] canvas' },
    shadow: { selector: ".rc-shadow" },
    drop: { selector: '.rc-fig[data-anim="drop"] canvas' },
    chant: { selector: '.rc-fig[data-anim="chantRaise"] canvas' },
    light: { selector: ".rc-light" },
    chantLine: { selector: ".bc-bubble", text: /Petrosian|Keres|Geller|Korchnoi|They worked as a team\./ },
    crack: { selector: ".rc-crack canvas" },
    split: { selector: ".rc-split.rc-q3" },
    pickup: { selector: '.rc-fig[data-anim="pickup"] canvas' },
    leapBack: { selector: '.rc-fig[data-anim="leap2"] canvas' },
    banner: { selector: ".fight-banner", text: /PHASE 2/ },
    idle2: { selector: `${figure()}[data-anim="idle2"]` },
    reviveLine: { selector: ".bc-bubble", text: /Not yet\. Now we play real chess\.|On your feet, all of you\. Again!/ },
    // (One book on screen: his own, in his frames; never a second one flying in.)
    book: { selector: ".rc-book" },
  });
  await play(page, "h5f7");
  // The board holds while he falls, then (no result screen) the phase change, then phase 2's four boards.
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.fall), { timeout: 60_000 }).toBe(true);
  expect((await bossNow(page)).result).toBe("crowd");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("phaseChange");
  // Nothing said twice at once in the phase change (Eric, Oct 15): the dock never repeats his line or the banner, the
  // boss bar never repeats the title's "phase 2", and the subtitle never says he's beaten as he rises (it did during
  // his fall, on the boss screen, where it's true).
  const words = await watchFor(page, {
    dockRepeat: { selector: ".boss-dock-status", text: /Mind and engine|Phase 2!|Every board must be won/ },
    barPhase: { selector: ".boss-next", text: /Phase 2/ },
    beaten: { selector: ".rc-change .opening-name", text: /the boss is beaten|phase 2:/ },
    clockLine: { selector: ".boss-dock-status .dk-text", text: /^2:00 on your clockNo added time\.$/ },
  });
  expect(await fall.seen()).toMatchObject({ collapse: true, dock: true });
  const at = Date.now();
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 }).toBe(true);
  // (About 15 s: PHASE_CHANGE.total.)
  expect(Date.now() - at).toBeLessThan(20_000);
  expect(await phase(page)).toBe("simul");
  expect(await change.seen()).toMatchObject({
    triumph: true,
    triumphLine: true,
    seize: true,
    reach: true,
    stream: true,
    drained: true,
    cry: true,
    seized: true,
    ignite: true,
    absorbLine: true,
    fading: true,
    gone: true,
    rage: true,
    figEngine: true,
    arcs: true,
    away: true,
    leap: true,
    shadow: true,
    drop: true,
    chant: true,
    light: true,
    chantLine: true,
    crack: true,
    split: true,
    pickup: true,
    leapBack: true,
    banner: true,
    book: false,
  });
  expect(await words.seen()).toEqual({ dockRepeat: false, barPhase: false, beaten: false, clockLine: true });
  // Phase 2's bar: how many are won, nothing the title says; its subtitle: the variant alone.
  await expect(page.locator(".boss-next")).toHaveText(/^\d of 4 won$/);
  await expect(page.locator(".opening-name")).toHaveText(/· Chess960$/);
  // Phase 2: the God King gone (nothing to tap), the boss's look on where he stands.
  await expect(page.locator(".gk-unit.gone")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /God King/ })).toHaveCount(0);
  await expect(page.locator(`${figure()} .bc-engine.on`)).toHaveCSS("visibility", "visible");
  // (Back in his place, seen again.)
  await expect(page.locator(".rc-away")).toHaveCount(0);
  const v = await simulNow(page);
  expect(v.boards).toHaveLength(4);
  // (Every board from a base at ply 0 with its start: here the test switch's mate in one, written as Chess960.)
  for (const b of v.boards) expect(b.bases).toEqual([{ ply: 0, fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w HAha - 4 4" }]);
  if (test.info().project.name === "phone") await expect(page.locator(".rc-mini")).toHaveCount(3);
  else await expect(page.locator(".rc-played .hb-board")).toHaveCount(4);
  // Your Qxf7 mates on your board; the bots mate on theirs: every board won.
  await simulPlay(page, "h5f7");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("Victory!");
  await expect(page.locator(".team-result")).toContainText("You beat the Hidden Boss on all 4 boards!");
  // His defeat in phase 2 (a placeholder for his transformation: the spellbook's glow, his hair in the wind).
  await expect(page.locator(".boss-char.place-results")).toHaveAttribute("data-anim", /spellbook2|spellLoop2/, { timeout: 10_000 });
  expect(await change.seen()).toMatchObject({ idle2: true, reviveLine: true });
  expect(errors).toEqual([]);
});

test("phase 2 (?phase=2): four boards, each its own Chess960 start; Stockfish 2750 answers your move; Engine move on your board; no God King (absorbed), the boss's half-engine look on", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("phaseChange");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 }).toBe(true);
  // The God King is gone (the boss absorbed him in the phase change): his place in the dock empty, nothing to tap, and
  // not a word from him all through phase 2.
  const king = await watchFor(page, { bubble: { selector: ".gk-bubble" }, figure: { selector: ".boss-dock .god-king" } });
  await expect(page.locator(".gk-unit.gone")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /God King/ })).toHaveCount(0);
  await expect(page.locator(".gk-command")).toHaveCount(0);
  // His look: one eye cold blue, the circuit lines, over his figure where it stands (on screen, on his head).
  const eng = page.locator(`${figure()} .bc-engine.on`);
  await expect(eng).toHaveCount(1);
  await expect(eng).toHaveCSS("visibility", "visible");
  const eye = (await eng.locator(".rc-eng-eye").boundingBox())!;
  const fig = (await page.locator(`${figure()} .boss-char-sprite`).boundingBox())!;
  expect(eye.x).toBeGreaterThan(fig.x);
  expect(eye.x + eye.width).toBeLessThan(fig.x + fig.width);
  expect(eye.y).toBeGreaterThan(fig.y);
  expect(eye.y + eye.height / 2).toBeLessThan(fig.y + fig.height * 0.6);
  if (test.info().project.name !== "phone") {
    // A computer: each board's tag (name and clock) in the row above it, never over its back rank (Chess960's is random),
    // inside the square of four; and the scoreboard has no Bank column (each clock is its board's, on its tag).
    const tags = await page.evaluate(() =>
      [...document.querySelectorAll(".rc-played")].map((cell) => {
        const tag = cell.querySelector(".rc-tag")!.getBoundingClientRect();
        const board = cell.querySelector(".hb-container")!.getBoundingClientRect();
        const stage = cell.parentElement!.getBoundingClientRect();
        return { tagBottom: tag.bottom, tagTop: tag.top, boardTop: board.top, stageTop: stage.top, text: cell.querySelector(".rc-tag")!.textContent };
      }),
    );
    expect(tags).toHaveLength(4);
    for (const t of tags) {
      expect(t.tagBottom, t.text ?? "").toBeLessThanOrEqual(t.boardTop + 0.5);
      expect(t.tagTop, t.text ?? "").toBeGreaterThanOrEqual(t.stageTop - 0.5);
    }
    await expect(page.locator(".tower-side .tower-head span:nth-child(6)")).toBeHidden();
    await expect(page.locator(".tower-side .t-bank").first()).toBeHidden();
  }
  const v = await simulNow(page);
  expect(new Set(v.boards.map((b: { number: number }) => b.number)).size).toBe(4);
  expect(new Set(v.boards.map((b: { fen: string }) => b.fen)).size).toBe(4);
  for (const b of v.boards) {
    expect(b.fen).toMatch(/ w [A-H]{2}[a-h]{2} - 0 1$/);
    expect(b.bases).toEqual([{ ply: 0, fen: b.fen }]);
  }
  await expect.poll(() => page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Stockfish 2750/);
  // A pawn move of yours, with real taps; he answers on your board.
  const fen = v.boards[0].fen as string;
  const pawn = new Chess(fen.replace(/ [A-Ha-h]+ - /, " - - ")).moves({ verbose: true }).find((m) => m.piece === "p" && m.from[0] === "d" && m.to[1] === "4")!;
  await simulPlay(page, pawn.lan);
  await expect.poll(async () => (await simulNow(page)).boards[0].history.length, { timeout: 30_000 }).toBe(2);
  // Engine move (admins): Stockfish's best on your Chess960 board, played as yours.
  const btn = page.getByRole("button", { name: "Engine move", exact: true });
  await expect(btn).toBeEnabled({ timeout: 30_000 });
  await btn.click();
  await expect.poll(async () => (await simulNow(page)).boards[0].history.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  // The bots play their boards meanwhile.
  await expect.poll(async () => (await simulNow(page)).boards.slice(1).every((b: { history: string[] }) => b.history.length >= 2), { timeout: 30_000 }).toBe(true);
  expect(await king.seen()).toEqual({ bubble: false, figure: false });
  await expect(page.getByRole("button", { name: /God King/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a loss (?win=1&phase=2): you resign your board, the bots win theirs: defeated, 3 of 4 won", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "win=1&phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 }).toBe(true);
  await resignHere(page, /Your board is lost\. The other boards play on, but all four must be won\./);
  await expect.poll(async () => (await simulNow(page))?.boards[0].result?.how ?? null, { timeout: 10_000 }).toBe("resign");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("Defeated");
  await expect(page.locator(".team-result")).toContainText("The Hidden Boss won. You won 3 of 4 boards: all 4 must be won.");
  await expect(page.locator(".boss-char.place-results")).toHaveAttribute("data-anim", /laugh2|idle2/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("phase 2's ultimate (the admins' trigger): \"5 SECONDS!\", his line and spellbook; then 5 s a move, and out of time a random move is played for you, never a loss", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 }).toBe(true);
  // Before it: your bank in the dock; the team's slow moves beside your board only (no longer in the dock).
  // (Your board's clock: bold at the box's right, the words beside it without the time.)
  await expect(page.locator(".boss-dock-status .dk-clock .dk-time")).toHaveText(/^\d:\d\d$/);
  await expect(page.locator(".boss-dock-status .dk-text")).not.toContainText(/\d:\d\d/);
  await expect(page.locator(".boss-dock-status")).not.toContainText(/slow moves \d of/);
  await expect(page.locator(".rc-slow")).toHaveCount(1);
  const ult = await watchFor(page, {
    banner: { selector: ".fight-banner", text: /5 SECONDS!/ },
    spell: { selector: `${figure()}[data-anim="spellbook2"]` },
    line: { selector: ".bc-bubble", text: /That's enough!|Enough thinking!/ },
  });
  await page.getByRole("button", { name: "Trigger ultimate (testing)" }).click();
  await expect.poll(async () => (await simulNow(page))?.ultAt ?? null, { timeout: 5_000 }).not.toBeNull();
  await expect(page.getByRole("button", { name: "Ultimate under way (testing)" })).toBeDisabled();
  await expect(page.locator(".boss-dock-status")).toContainText(/5 s a move/);
  await expect.poll(() => ult.seen(), { timeout: 10_000 }).toEqual({ banner: true, spell: true, line: true });
  // You don't move: within 5 s (and the clock check's beat) a random legal move is played for you, and the board goes on.
  const before = (await simulNow(page)).boards[0].history.length;
  await expect.poll(async () => (await simulNow(page)).boards[0].history.length, { timeout: 12_000 }).toBeGreaterThan(before);
  expect((await simulNow(page)).boards[0].result).toBeNull();
  expect(errors).toEqual([]);
});

test("phase 2's slow moves (?phase=2): each marks a red X for the team in one column beside your board (a phone's big board), the slow board gets a note, a soft sound; the 10th brings his ultimate on every board", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => ((window as any).__soundLog = []));
  const phone = test.info().project.name === "phone";
  // Ten slots, all empty, once: a column beside your board (Eric, Oct 14: the count is the team's, so once is enough).
  await expect(page.locator(".rc-slow")).toHaveCount(1);
  await expect(page.locator(".rc-slow.col")).toHaveCount(1);
  await expect(page.locator(".rc-slow").first().locator("svg > g")).toHaveCount(10);
  const seen = await watchFor(page, {
    flash: { selector: ".rc-slow.flash" },
    note: { selector: ".rc-slow-note", text: /slow move/ },
    banner: { selector: ".fight-banner", text: /5 SECONDS!/ },
    minis: { selector: ".rc-ult .rc-mini" },
  });
  // Slow moves of yours (each after 5 s of thought; the bots add theirs now and then) until his ultimate comes.
  let marked = 0;
  for (let i = 0; i < 14; i++) {
    const v = await simulNow(page);
    if (v.ultAt !== null || v.boards[0].result) break;
    await expect.poll(async () => (await simulNow(page)).boards[0].toMove === "crowd" || (await simulNow(page)).ultAt !== null, { timeout: 30_000 }).toBe(true);
    const w = await simulNow(page);
    if (w.ultAt !== null) break;
    const mine = w.boards[0];
    await page.waitForTimeout(Math.max(0, mine.turnAt + 5_400 - (await page.evaluate(() => Date.now()))));
    const legal = new Chess(mine.fen.replace(/ [A-Ha-h]+ /, " - ")).moves({ verbose: true });
    const quiet = legal.filter((m) => !m.captured && m.piece === "p" && !m.promotion);
    const move = (quiet[i % Math.max(1, quiet.length)] ?? legal[0]!).lan;
    const before = (await simulNow(page)).slow;
    // (The bots' slow moves can bring his ultimate while you think: then the count is done, and yours isn't one.)
    if (before >= 10 || (await simulNow(page)).ultAt !== null) break;
    await page.evaluate((m) => (window as any).match.simulMove(0, m), move);
    await expect.poll(async () => (await simulNow(page)).slow, { timeout: 5_000 }).toBeGreaterThan(before);
    // The marks say the team's count at once.
    const n = Math.min(10, (await simulNow(page)).slow);
    await expect(page.locator(`.rc-slow[data-slow="${n}"]`)).toHaveCount(1);
    marked = n;
  }
  // (Your board decided first, by any chance: the bots' slow moves bring the rest.)
  await expect.poll(async () => (await simulNow(page)).ultAt !== null, { timeout: 120_000 }).toBe(true);
  const v = await simulNow(page);
  expect(v.slow).toBe(10);
  expect(marked).toBeGreaterThan(0);
  await expect(page.locator('.rc-slow[data-slow="10"]')).toHaveCount(1);
  // Ten red X's, the slow board noted, a soft sound each time, and the banner on every board (a phone's small ones too).
  await expect(page.locator('.rc-slow[data-slow="10"]').first().locator(".rc-slow-x")).toHaveCount(10 * 9);
  await expect.poll(() => seen.seen(), { timeout: 10_000 }).toEqual({ flash: true, note: true, banner: true, minis: phone });
  expect(((await page.evaluate(() => (window as any).__soundLog)) as string[]).filter((x) => x.startsWith("recluseSlow")).length).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});
