import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS, RECLUSE_ONLINE, RECLUSE_PHASE2 } from "@chessroyale/core";
import { BOARD_SEL, test, watchFor, watchSpans, bossAloneFromHome } from "./helpers.ts";
import { RECLUSE_LINES } from "../packages/app/src/characters/recluse-lines.ts";
import { RECLUSE_PALETTE } from "../packages/app/src/characters/recluse.ts";
import { pacedLine } from "../packages/app/src/paced-line.ts";

/**
 * The Hidden Boss, phase 1 (admins only, in Boss alone), on a phone and a computer with real taps:
 * - he's in the boss menu for an admin (after the rest), never for a player;
 * - his intro (the stare), his brain (Maia at its top rating, raw);
 * - no strikes: nothing about them, ever (the boss card counts moves);
 * - the God King's help tried: blocked, the charge spent all the same (the dock's count drops), the boss mocks it (the
 *   book slammed shut) and the God King says his help won't take hold;
 * - his ultimate on the admins' trigger: the book consulted, opened like a spell book, slammed shut, "BULLET!", then the
 *   bullet clock (the whole bullet bank on the move, the dock's time left, no increment for 3 moves); then he adds time
 *   per move (his line, "+10 s a move from now on" across the board, "Bullet 1+10" in the dock, +10 s a move made in time);
 * - beaten (?win=1: you mate in one): he collapses on the board (no mumbling: his phase change follows), then (Boss alone) his phase change (it
 *   is his transformation by the book's light, Nov 14: his eyes white, the white-out, his final form (Nov 15), his first line, the
 *   split on the music's drop; the God King greyed in his place) and phase 2's four boards, then a 5-4-3-2-1 on every board
 *   before any clock runs (each from RECLUSE_PHASE2.change).
 */
const P = RECLUSE_PHASE2.change;
/** His transformation's beats (Nov 14; PHASE_CHANGE), and his second line, after the landing. */
const T = P.transform;
const LINE2 = pacedLine(RECLUSE_LINES.chantSay[1]!, P.chantLines);
/** What his phase change and the countdown add over the phase change's 15 s before Oct 17 (the server's length is the screens'). */
const ADDED_MS = RECLUSE_ONLINE.changeMs - 15_000 + P.countdownSeconds * 1000;
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

/**
 * Into Boss alone against him through the boss menu, as an admin. At his adult form (`?form=adult`: these tests are about it) unless
 * the query names a form (his child form, Nov 13, comes first otherwise).
 */
async function meetHim(page: Page, query = "laststand=0&clock=60") {
  if (!/(^|&)form=/.test(query)) query = `${query}&form=adult`;
  await asAdmin(page);
  // (The menu lists him once your profile says you're an admin: wait for it.)
  const me = page.waitForResponse((r) => r.url().includes("/api/me") && r.request().method() === "GET");
  // (The hidden /bosses: the solo boss picker, where an admin meets him; the Boss raid screen's tile is locked.)
  await page.goto(`/bosses?debug&${query}`);
  await me;
  await page.waitForTimeout(500);
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
  await page.goto("/bosses?debug");
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu).toBeVisible();
  await expect(menu.locator(".boss-row .br-main strong").first()).toBeVisible();
  await expect(menu.getByText("Hidden Boss")).toHaveCount(0);
  await page.goto("/?debug&boss=recluse");
  await bossAloneFromHome(page);
  await expect.poll(async () => (await bossNow(page))?.id ?? null, { timeout: 30_000 }).not.toBeNull();
  expect((await bossNow(page)).id).not.toBe("recluse");
});

test("an admin fights him in Boss alone: the stare, Maia at its top, no strikes, the God King's help mocked and spent, the bullet clock on the trigger, then its increment", { tag: "@phone-only" }, async ({ page }) => {
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
  // His level in the bar: "LVL ???" (Eric, Oct 23: Fischer's is not 100), heard as "Level unknown"; no number in the view.
  expect(b.level).toBeNull();
  await expect(page.locator(".boss-level .lv-text")).toHaveText("LVL ???");
  await expect(page.locator(".boss-level .lv-sr")).toHaveText("Level unknown");
  await expect(page.locator(".boss-level.lv-up, .boss-level.lv-down")).toHaveCount(0);
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
  await expect(btn).toHaveAccessibleName("Trigger ultimate (testing)");
  await btn.click();
  await expect(btn).toHaveAccessibleName("Ultimate next turn (testing)");
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
  await expect(btn).toHaveAccessibleName("Ultimate under way (testing)");
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
  expect(INC).toBe(10_000);
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
    text: { selector: ".rc-plus", text: /^\+10 s a move from now on$/ },
    line: { selector: ".bc-bubble, .bc-bar-bubble", text: /Lottery, not chess|Too fast for chess|Bah\. Fine: ten seconds/ },
    dock: { selector: ".boss-dock-status", text: /\+10 s a move/ },
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
  // As that move begins, your clock goes up by the increment, a "+10" over it (Eric, Oct 15: "the number ticks up with a
  // brief +2"; on the page's top layer since Nov 16): from what it held through his moment to that plus 10 s.
  const tick = await watchFor(page, { plus: { selector: "body > .dk-plus", text: /^\+10$/ } });
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
  await expect(page.locator(".boss-dock-status .bullet-note")).toHaveText(/^Bullet\s1\+10$/);
  await expect(page.locator(".boss-dock-status .dk-clock.running")).toHaveText(/^[01]:\d\d$/);
  // From this move on, each made in time adds 10 s: the move may take the bank and the 10 s, and what it took comes out.
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
  await expect(page.locator(".boss-dock-status .bullet-note")).toHaveText(/^Bullet\s1\+10$/);
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

test("Engine move (admins, Boss alone): one tap plays Stockfish's best move as yours; a player never sees it", { tag: "@phone-only" }, async ({ page }) => {
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
  await bossAloneFromHome(page);
  await yourMove(page);
  await expect(page.locator(".ult-test, .engine-move")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Engine move" })).toHaveCount(0);
});

/** Your phase 2 board: the big one, under the other three (a computer too since Nov 16). */
const myBoard = (page: Page) => page.locator(".rc-simul .rc-big .hb-board");
const simulNow = (p: Page) => p.evaluate(() => (window as any).match?.simul ?? null);
/**
 * When the app first put each of these in the page (performance.now, from a MutationObserver: the moment it happens, not
 * the next frame a sampler gets to run, which under load is a long frame later), and when phase 2's clocks were due to
 * start as it did (the match's `phase.at` then, in the same time): the countdown's own schedule. Null: never.
 */
async function watchShown<K extends string>(page: Page, what: Record<K, { selector: string; text?: RegExp }>) {
  const tag = Math.random().toString(36).slice(2);
  await page.evaluate(
    ({ tag, what }) => {
      const w = window as unknown as { __shown?: Record<string, Record<string, { at: number; clocksAt: number | null } | null>>; match?: { phase: { kind: string; at?: number } } };
      const at: Record<string, { at: number; clocksAt: number | null } | null> = Object.fromEntries(Object.keys(what).map((k) => [k, null]));
      (w.__shown ??= {})[tag] = at;
      const check = () => {
        const now = performance.now();
        const ph = w.match?.phase;
        const clocksAt = ph?.kind === "simul" && typeof ph.at === "number" ? ph.at - (Date.now() - now) : null;
        for (const [k, { selector, text }] of Object.entries(what as Record<string, { selector: string; text?: { source: string; flags: string } }>)) {
          if (at[k] !== null) continue;
          if ([...document.querySelectorAll(selector)].some((e) => !text || new RegExp(text.source, text.flags).test(e.textContent ?? ""))) at[k] = { at: now, clocksAt };
        }
      };
      check();
      const obs = new MutationObserver(check);
      obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      setTimeout(() => obs.disconnect(), 180_000);
    },
    { tag, what: Object.fromEntries(Object.entries(what as Record<string, { selector: string; text?: RegExp }>).map(([k, v]) => [k, { selector: v.selector, text: v.text ? { source: v.text.source, flags: v.text.flags } : undefined }])) as never },
  );
  return {
    times: () =>
      page.evaluate((t) => (window as unknown as { __shown: Record<string, Record<string, { at: number; clocksAt: number | null } | null>> }).__shown[t]!, tag) as Promise<
        Record<K, { at: number; clocksAt: number | null } | null>
      >,
  };
}
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
/** Resign from the match's gear and its list (a phone or a computer), and confirm. */
async function resignHere(page: Page, note: RegExp) {
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
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

test("beaten in phase 1 (?win=1): he collapses (no mumbling in his bar before his cutscene: Eric, Nov 16), his cutscene, then the phase change (his transformation by the book's light: his eyes white, lifted in it, the white-out, revealed in his final form, his first line, the leap, the split on the drop, the book back, the leap home, the shuffle; the God King greyed in his place throughout), a countdown on four boards, then their clocks; all four won: Victory!", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (His music, Nov 13: the sound log, and the pieces fetched.)
  await page.addInitScript(() => ((window as any).__soundLog = []));
  const music: string[] = [];
  page.on("request", (r) => void (/^\/music\/.*\.mp3$/.test(new URL(r.url()).pathname) && music.push(new URL(r.url()).pathname)));
  // (Errors on the window that aren't thrown, as problems.ts's watchErrors reports them: Chrome's ResizeObserver loop, #712's review.)
  await page.addInitScript(() => {
    const w = window as any;
    w.__winErrors = [];
    addEventListener("error", (e) => w.__winErrors.push(e.message));
  });
  // (?cutscene=6: his cutscene after the fall sped up into 6 s; the Win this form test below watches it.)
  await meetHim(page, "win=1&cutscene=6");
  await yourMove(page);
  const fall = await watchFor(page, {
    collapse: { selector: `${figure()}[data-anim="collapse"]` },
    dock: { selector: ".boss-dock-status", text: /You beat him!/ },
    // (Eric, Nov 16: "get rid of that line": with his phase change next, his fall says nothing, in the bar or beside the board.)
    mumble: { selector: ".bc-bubble, .bc-bar-bubble", text: /book said|Morphy|Sixty-four squares/i },
  });
  const change = await watchFor(page, {
    // His transformation over the board (Eric, Nov 14), carrying on from his cutscene: the book opening at his feet in the lens, the
    // child beside him, the light taking him and lifting him, the screen whiting out, him revealed in his final form (Nov 15: the
    // coat, no helmet), his line, the leap; his place empty meanwhile; the God King greyed in his place and silent.
    open: { selector: '.rc-tf-fig[data-anim="open"] canvas' },
    lens: { selector: ".rc-transform .cs-dim" },
    kid: { selector: ".rc-tf-kid canvas" },
    taken: { selector: '.rc-tf-fig[data-anim="burst"]' },
    rise: { selector: '.rc-tf-fig[data-anim="rise"]' },
    beam: { selector: '.rc-tf-fig[data-anim="beam"]' },
    light: { selector: ".rc-transform .rc-light-cv" },
    white: { selector: '.rc-stage[data-step="white"]' },
    revealed: { selector: '.rc-tf-fig[data-anim="revealed"]' },
    jump: { selector: '.rc-tf-fig[data-anim="air"]' },
    land: { selector: '.rc-tf-fig[data-anim="land"]' },
    away: { selector: ".rc-away" },
    benched: { selector: ".rc-change .gk-unit.benched" },
    kingWord: { selector: ".rc-change .gk-bubble" },
    arcs: { selector: ".rc-arcs .rc-arc-core" },
    // (Over his head on the board, a phone too (Eric, Nov 14): the whole line, its sentences typed in turn; the typed part (the box's
    // first span) shows each sentence typed out.)
    chantLine: { selector: ".rc-say", text: /^Computation without creativity is nothing\. Now I have both\.$/ },
    chantLineB: { selector: ".rc-say .speech-line > span:first-child", text: /Now I have both\.$/ },
    chantLine2: { selector: ".rc-say", text: /^Prepare yourself\. This is the ultimate test of your skill\.$/ },
    // (Its last words typed as he's home again: in his place's bubble by then, his words where he is.)
    chantLine2B: { selector: ".bc-bubble .speech-line > span:first-child", text: /This is the ultimate test of your skill\.$/ },
    crack: { selector: ".rc-crack canvas" },
    split: { selector: ".rc-split.rc-q3" },
    pickup: { selector: '.rc-tf-fig[data-anim="pickup"] canvas' },
    leapBack: { selector: '.rc-tf-fig[data-anim="leap2"] canvas' },
    banner: { selector: ".fight-banner", text: /PHASE 2/ },
    idle2: { selector: `${figure()}[data-anim="idle2"]` },
    // (One book on screen: his own, in his frames; never a second one flying in.)
    book: { selector: ".rc-book" },
  });
  // Its pace (Eric, Oct 17): every beat's first and last frame on screen, for their order and the time added between.
  const count = (n: number) => ({ selector: ".rc-simul .cc-num", text: new RegExp(`^${n}$`) });
  const pace = await watchSpans(page, {
    open: { selector: '.rc-tf-fig[data-anim="open"]' },
    taken: { selector: '.rc-tf-fig[data-anim="burst"]' },
    white: { selector: '.rc-stage[data-step="white"]' },
    revealed: { selector: '.rc-stage[data-step="revealed"]' },
    line1: { selector: ".rc-say", text: /^Computation without creativity/ },
    jump: { selector: '.rc-tf-fig[data-anim="air"]' },
    // (His second line over his head, and its second sentence as it starts to type: its first letter typed.)
    chant2: { selector: ".bc-bubble", text: /^Prepare yourself\./ },
    chant2b: { selector: ".bc-bubble .speech-line > span:first-child", text: /^Prepare yourself\.\s*\S/ },
    crack: { selector: ".rc-crack canvas" },
    banner: { selector: ".fight-banner", text: /PHASE 2/ },
    c5: count(5),
    c4: count(4),
    c3: count(3),
    c2: count(2),
    c1: count(1),
    ready: { selector: ".rc-simul .cc-banner", text: /^Get ready$/ },
  });
  // The countdown's own times: the moment the app puts each number (and then a running clock) in the page, as it does it
  // (each number is a new element). The frame sampler above reads them a frame or more late, by however long the frame
  // took: under load that alone made a step look 50 to 225 ms short (docs/decisions/2026-10-28-two-flaky-tests.md).
  const shown = await watchShown(page, {
    c5: count(5),
    c4: count(4),
    c3: count(3),
    c2: count(2),
    c1: count(1),
  });
  // His music (Nov 13): the first frame showing the board cracked into four, on Date.now()'s clock (the frame's own time: the
  // app draws in its frame callback, so the timeline's time as the change lands is that frame's).
  await page.evaluate(() => {
    const w = window as any;
    const obs = new MutationObserver(() => {
      if (w.__crackFrame || !document.querySelector('.rc-stage[data-step="crack"]')) return;
      w.__crackFrame = (document.timeline.currentTime as number) + (Date.now() - performance.now());
    });
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-step"] });
  });
  const musicLog = () => page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => l.startsWith("music:")));
  await expect.poll(musicLog, { timeout: 30_000 }).toContain("music:start:recluse-phase2");
  // (His later themes fetched as his fight starts, not decoded until they play.)
  await expect.poll(() => music.filter((m) => /recluse-(beaten|phase3|house)/.test(m)).sort()).toEqual(["/music/recluse-beaten-intro.mp3", "/music/recluse-house-loop.mp3", "/music/recluse-phase3-intro.mp3", "/music/recluse-phase3-loop.mp3"]);
  await play(page, "h5f7");
  // The board holds while he falls, then (no result screen) the phase change, then phase 2's four boards.
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.fall), { timeout: 60_000 }).toBe(true);
  expect((await bossNow(page)).result).toBe("crowd");
  // (Beaten: his beaten theme at once.)
  await expect.poll(musicLog).toContain("music:start:recluse-beaten");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("phaseChange");
  const splitAt: number = await page.evaluate(() => (window as any).match.phase.splitAt);
  // (No clock runs from here until the countdown is over: neither the dock's nor any board's.)
  const clocks = await watchSpans(page, { running: { selector: ".dk-clock.running, .rc-tag.running" } });
  const clockShown = await watchShown(page, { running: { selector: ".dk-clock.running, .rc-tag.running" } });
  // Nothing said twice at once in the phase change (Eric, Oct 15): the dock never repeats his line or the banner, the
  // boss bar never repeats the title's "phase 2", and the dock never says he's beaten as he rises (it did during his
  // fall, on the boss screen, where it's true; there's no line above the board now, Eric, Oct 24).
  const words = await watchFor(page, {
    dockRepeat: { selector: ".boss-dock-status", text: /Mind and engine|Phase 2!|Every board must be won/ },
    barPhase: { selector: ".boss-next", text: /Phase 2/ },
    beaten: { selector: ".rc-change .boss-dock-status", text: /the boss is beaten|phase 2:/ },
    clockLine: { selector: ".boss-dock-status .dk-text", text: /^10:00 on your clockNo added time\.$/ },
  });
  expect(await fall.seen()).toMatchObject({ collapse: true, dock: true, mumble: false });
  // Every frame of the phase change into phase 2 (Nov 14's visual check): his bar box at the countdown holds its words, never a sliver
  // narrower than them (#1: measured while his place was hidden); his words over his helmet never straddle the bar's bottom edge
  // (#9); the boards at the split's last frame are where phase 2 draws them in play, within a pixel (#10: they snapped 3 to 6 px).
  await page.evaluate(() => {
    const w = window as any;
    const q = (w.__qaChange = { narrow: [] as number[][], straddle: [] as number[][], split: null as number[][] | null, played: null as number[][] | null });
    const boards = (sel: string) => [...document.querySelectorAll(`.rc-stage > ${sel} .hb-board`)].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width].map(Math.round); }).sort((a, b) => a[1]! - b[1]! || a[0]! - b[0]!);
    const tick = () => {
      const bar = document.querySelector(".bc-bar-bubble");
      const words = bar?.querySelector(".speech-line");
      if (bar && words && Number(getComputedStyle(bar).opacity) > 0.5 && (bar as HTMLElement).clientWidth > 0 && (bar as HTMLElement).clientWidth < (words as HTMLElement).offsetWidth) q.narrow.push([(bar as HTMLElement).clientWidth, (words as HTMLElement).offsetWidth]);
      const say = document.querySelector(".rc-say");
      const edge = document.querySelector(".boss-bar")?.getBoundingClientRect().bottom;
      if (say && edge && Number(getComputedStyle(say).opacity) > 0.5) { const r = say.getBoundingClientRect(); if (r.top < edge - 1 && r.bottom > edge + 1) q.straddle.push([Math.round(r.top), Math.round(r.bottom), Math.round(edge)]); }
      if (document.querySelector(".rc-stage > .rc-split") && document.querySelector('.rc-stage[data-step="shuffle"]')) q.split = boards(".rc-split");
      if (!q.played && document.querySelector(".rc-stage > .rc-played")) q.played = boards(".rc-played");
      if (!q.played || q.narrow.length < 5) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const at = Date.now();
  // The boards set, a countdown on every one (a phone's three small ones too), its banner on yours; no clock yet.
  await expect.poll(() => phase(page), { timeout: 30_000 + ADDED_MS }).toBe("simul");
  // His music through it: his adult form's theme, then his beaten one (the first faded), then the transformation's (the beaten
  // one faded), its drop on the split: scheduled within a frame of it, and the split's first frame within a frame of the drop.
  const ml = await musicLog();
  expect(ml.filter((l) => /^music:(start|out):/.test(l))).toEqual(["music:start:recluse-phase2", "music:start:recluse-beaten", "music:out:recluse-phase2", "music:start:recluse-phase3", "music:out:recluse-beaten"]);
  const drop = Number(ml.find((l) => l.startsWith("music:drop:recluse-phase3:"))!.split(":").at(-1));
  const crackFrame: number = await page.evaluate(() => (window as any).__crackFrame);
  test.info().annotations.push({ type: "drop vs split", description: `drop − split ${drop - splitAt} ms; the split's first frame − drop ${(crackFrame - drop).toFixed(1)} ms` });
  expect(Math.abs(drop - splitAt), "the drop scheduled on the split").toBeLessThanOrEqual(17);
  // (A frame or two of slack for CI's slow, busy runners: the drop is measured within one on a computer, the decision note.)
  expect(Math.abs(crackFrame - drop), "the split's first frame on the drop").toBeLessThan(50);
  await expect.poll(() => page.locator(".rc-simul .cc-num").count(), { timeout: P.countdownSeconds * 1000 }).toBe(4);
  expect((await simulNow(page)).playing).toBe(false);
  // (Reduced motion: the same countdown, its numbers still.)
  await page.emulateMedia({ reducedMotion: "reduce" });
  // (Read through a retrying locator: each second's number is a new element (`key={n}` in Countdown.tsx), so a one-shot read
  // could land on the one just removed and get "" (once in CI, Oct 24).)
  await expect(page.locator(".rc-simul .cc-num").first()).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 }).toBe(true);
  // (The phase change was about 15 s before Oct 17, under 20 s here.)
  expect(Date.now() - at).toBeLessThan(20_000 + ADDED_MS);
  expect(await phase(page)).toBe("simul");
  // The beats in order, at their times (Nov 14): the book opening as the phase change starts, the light taking him on the music's
  // slam, the white-out, the reveal, his first line as he stands, the leap on the music's breath, the crack
  // on its drop; then "PHASE 2" and 5, 4, 3, 2, 1, a second each; then the clocks.
  const s = await pace.spans();
  const c = await clocks.spans();
  const order = ["open", "taken", "white", "revealed", "line1", "jump", "crack", "banner", "c5", "c4", "c3", "c2", "c1"] as const;
  for (const k of [...order, "chant2", "chant2b", "ready"] as const) expect(s[k], k).not.toBeNull();
  const first = (k: keyof typeof s) => s[k]!.first;
  for (let i = 1; i < order.length; i++) expect(first(order[i]!), `${order[i - 1]} then ${order[i]}`).toBeGreaterThan(first(order[i - 1]!));
  // (Each beat a setting from the music's start, `musicAtMs` into the phase change.)
  const near = (k: keyof typeof s, at: number) => expect(Math.abs(first(k) - first("open") - T.musicAtMs - at), k).toBeLessThanOrEqual(400);
  near("taken", T.burstAt);
  near("white", T.whiteFull);
  near("revealed", T.revealAt);
  near("line1", T.line1At);
  near("crack", T.introMs);
  // (The theme from its intro: the phase change's start was never too late for it.)
  expect(first("crack") - first("jump")).toBeGreaterThanOrEqual(T.leapMs - 300);
  // (His first line held through the crouch (Nov 14 review, M2), gone as he leaps.)
  expect(s.line1!.last).toBeGreaterThan(first("jump") - 400);
  expect(s.line1!.last).toBeLessThanOrEqual(first("jump") + 100);
  // His second line after the landing: "Prepare yourself.", a second's pause, then its second sentence.
  expect(first("chant2") - first("crack")).toBeGreaterThanOrEqual(T.line2AfterMs - 300);
  expect(first("chant2") - first("crack")).toBeLessThanOrEqual(T.line2AfterMs + 400);
  expect(first("chant2b") - first("chant2")).toBeGreaterThanOrEqual(LINE2.starts[1]! - 150);
  // A second each, by the countdown's own schedule (`shown`: when the app put each number in the page, against when the
  // clocks were due): the 5 is up before its second begins (the count starts once the boards are on screen), each of 4,
  // 3, 2, 1 comes no sooner than its second and within a quarter second of it, and the clocks likewise at the end.
  const t = { ...(await shown.times()), ...(await clockShown.times()) };
  for (const k of ["c5", "c4", "c3", "c2", "c1", "running"] as const) expect(t[k], `${k} shown`).not.toBeNull();
  // (The clocks' time as the 4 came: the count's own, final by then.)
  const due = t.c4!.clocksAt!;
  expect(t.c5!.at, "the 5 is up before its second begins").toBeLessThanOrEqual(due - 5000);
  for (const [k, n] of [["c4", 4], ["c3", 3], ["c2", 2], ["c1", 1], ["running", 0]] as const) {
    expect(t[k]!.at - (due - n * 1000), `${k}: not before its second`).toBeGreaterThanOrEqual(-2);
    expect(t[k]!.at - (due - n * 1000), `${k}: within a quarter second of it`).toBeLessThanOrEqual(250);
  }
  expect(first("c5")).toBeGreaterThanOrEqual(s.banner!.last);
  expect(c.running, "a clock running once play starts").not.toBeNull();
  expect(await change.seen()).toMatchObject({
    open: true,
    lens: true,
    kid: true,
    taken: true,
    rise: true,
    beam: true,
    light: true,
    white: true,
    revealed: true,
    jump: true,
    land: true,
    away: true,
    benched: true,
    kingWord: false,
    arcs: true,
    chantLine: true,
    chantLineB: true,
    chantLine2: true,
    chantLine2B: true,
    crack: true,
    split: true,
    pickup: true,
    leapBack: true,
    banner: true,
    book: false,
  });
  expect(await words.seen()).toEqual({ dockRepeat: false, barPhase: false, beaten: false, clockLine: true });
  const qa = await page.evaluate(() => (window as any).__qaChange);
  expect(qa.narrow, "his bar box narrower than its words").toEqual([]);
  expect(qa.straddle, "his words over his helmet across the bar's edge").toEqual([]);
  expect(qa.split?.length, "the split's boards").toBe(4);
  qa.split.forEach((b: number[], i: number) => b.forEach((n, k) => expect(Math.abs(qa.played[i][k] - n), `board ${i} [${k}]: split ${b} -> play ${qa.played[i]}`).toBeLessThanOrEqual(1)));
  // Phase 2's bar: how many are won, nothing the title says; its subtitle: the variant alone.
  await expect(page.locator(".boss-next")).toHaveText(/^\d of 4 won$/);
  // His level is unknown in phase 2 too ("LVL ???", Eric, Oct 23: Fischer's is not 100), his bar's meters gone as before.
  await expect(page.locator(".boss-level .lv-text")).toHaveText("LVL ???");
  await expect(page.locator(".boss-level .lv-sr")).toHaveText("Level unknown");
  await expect(page.locator(".boss-bar .rage-meter")).toHaveCount(0);
  // (Freestyle is in the dock's line, where the line above the board said it: Eric, Oct 24.)
  await expect(page.locator(".boss-dock-status .dock-line").first()).toHaveText(/· Freestyle$/);
  // Phase 2: the God King in his place, greyed, nothing to tap (Eric, Nov 14: "you can't use him anymore"), the boss in his final
  // form where he stands.
  await expect(page.locator(".gk-unit.benched")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /God King/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "God King: can't be called in phase 2" })).toBeDisabled();
  await expect(page.locator(`${figure()}[data-suit]`)).toBeVisible();
  // (Back in his place, seen again.)
  await expect(page.locator(".rc-away")).toHaveCount(0);
  const v = await simulNow(page);
  expect(v.boards).toHaveLength(4);
  // (Every board from a base at ply 0 with its start: here the test switch's mate in one, written as Chess960.)
  for (const b of v.boards) expect(b.bases).toEqual([{ ply: 0, fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w HAha - 4 4" }]);
  await expect(page.locator(".rc-mini")).toHaveCount(3);
  // Your Qxf7 mates on your board; the bots mate on theirs: every board won.
  await simulPlay(page, "h5f7");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("Victory!");
  await expect(page.locator(".team-result")).toContainText("You beat the Hidden Boss on all 4 boards!");
  // (His transformation's theme started once, at the split, and never again through the four boards as each was decided
  // (Eric, Nov 14: "this music keeps restarting on the third phase"); then it ends with the result.)
  const after = (await musicLog()).filter((l) => /^music:(start|out|end):/.test(l));
  expect(after).toEqual(["music:start:recluse-phase2", "music:start:recluse-beaten", "music:out:recluse-phase2", "music:start:recluse-phase3", "music:out:recluse-beaten", "music:end:recluse"]);
  // His defeat in phase 2 (a placeholder for his transformation: the spellbook's glow, his hair in the wind).
  await expect(page.locator(".boss-char.place-results")).toHaveAttribute("data-anim", /spellbook2|spellLoop2/, { timeout: 10_000 });
  expect(await change.seen()).toMatchObject({ idle2: true });
  // (#712's review: no "ResizeObserver loop completed" from his bar box, through the phase change and its countdown.)
  expect(((await page.evaluate(() => (window as any).__winErrors)) as string[]).filter((m) => /ResizeObserver/.test(m))).toEqual([]);
  expect(errors).toEqual([]);
});

test("phase 2 (?phase=2): four boards, each its own Chess960 start; Stockfish 2750 answers your move; Engine move on your board; the God King greyed in his place, never called, the boss's half-engine look on", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("phaseChange");
  // (Sampled every 50 ms, and the boards read at once: the bots on White's boards move 0.9 s after play begins, so a read
  // made later (on a computer, after its tag checks) could see their first move. Eric, Oct 24, "never loosen": same checks.)
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 + ADDED_MS, intervals: [50] }).toBe(true);
  const v = await simulNow(page);
  expect(new Set(v.boards.map((b: { number: number }) => b.number)).size).toBe(4);
  expect(new Set(v.boards.map((b: { fen: string }) => b.fen)).size).toBe(4);
  for (const b of v.boards) {
    expect(b.fen).toMatch(/ w [A-H]{2}[a-h]{2} - 0 1$/);
    expect(b.bases).toEqual([{ ply: 0, fen: b.fen }]);
  }
  // The God King stays in his place, greyed (Eric, Nov 14: "the king will still be with you, but you can't use him anymore"):
  // his button off, and not a word from him all through phase 2.
  const king = await watchFor(page, { bubble: { selector: ".gk-bubble" }, figure: { selector: ".boss-dock .god-king" } });
  await expect(page.locator(".gk-unit.benched")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /God King/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "God King: can't be called in phase 2" })).toBeDisabled();
  await expect(page.locator(".gk-command")).toHaveCount(0);
  // His final form where he stands, from his transformation on (Eric, Nov 15; the attribute's name is round 3b's suit).
  await expect(page.locator(`${figure()}[data-suit] .boss-char-sprite`)).toBeVisible();
  // (The picture too, not only the attribute (#707's review, m4): his canvas has the black coat's pixels (recluse.ts's palette; the
  // bust shows about 440, the whole figure about 1,260), and the aura's see-through glow round him.)
  const hex = (keys: string) => [...keys].map((k) => RECLUSE_PALETTE[k]!);
  const drawn = await page.evaluate(
    ({ sel, coat }) => {
      const cv = document.querySelector<HTMLCanvasElement>(sel)!;
      const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      const rgb = (h: string) => parseInt(h.slice(1, 7), 16);
      const C = new Set(coat.map(rgb));
      let inCoat = 0;
      let glow = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! > 0 && d[i + 3]! < 255) glow++;
        if (d[i + 3]! < 255) continue;
        if (C.has((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!)) inCoat++;
      }
      return { inCoat, glow };
    },
    { sel: `${figure()}[data-suit] .boss-char-sprite`, coat: hex("<>{}") },
  );
  expect(drawn.inCoat, "the coat's pixels").toBeGreaterThan(300);
  expect(drawn.glow, "the aura's pixels").toBeGreaterThan(300);
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
  await expect.poll(() => page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Stockfish 2750/);
  // A pawn move of yours, with real taps; he answers on your board.
  const fen = v.boards[0].fen as string;
  const pawn = new Chess(fen.replace(/ [A-Ha-h]+ - /, " - - ")).moves({ verbose: true }).find((m) => m.piece === "p" && m.from[0] === "d" && m.to[1] === "4")!;
  await simulPlay(page, pawn.lan);
  await expect.poll(async () => (await simulNow(page)).boards[0].history.length, { timeout: 30_000 }).toBe(2);
  // The Moves panel, in its place, lists your board's game now, not phase 1's (Nov 14's visual check, #6): your move first.
  const moves = page.locator(test.info().project.name === "phone" ? ".bp .mv-list .mv-row" : ".mv-side .mv-list .mv-row");
  await expect(moves.first()).toHaveAttribute("aria-label", new RegExp(`^1\\. You: pawn to ${pawn.to}`));
  await expect(moves).toHaveCount(2);
  // His row's face is his face now, in his final form, as the bar's (not the plain portrait in his shirt).
  await expect(moves.nth(1).locator(".mv-who img")).toHaveAttribute("data-face", /:true$/);
  // A phone's small boards: whose each is, by name, cut short to the board's width, the clock whole (#7).
  if (test.info().project.name === "phone") {
    const tags = await page.evaluate(() => [...document.querySelectorAll(".rc-mini")].map((m) => { const t = m.querySelector(".rc-tag")!.getBoundingClientRect(); const r = m.getBoundingClientRect(); return { name: m.querySelector(".rc-tag-name")?.textContent?.trim() ?? "", clock: m.querySelector(".rc-tag-clock")!.textContent, inside: t.left >= r.left - 0.5 && t.right <= r.right + 0.5 }; }));
    expect(tags).toHaveLength(3);
    for (const t of tags) expect(t).toMatchObject({ name: expect.stringMatching(/\S/), clock: expect.stringMatching(/^\d+:\d\d$/), inside: true });
  }
  // Engine move (admins): Stockfish's best on your Chess960 board, played as yours.
  const btn = page.getByRole("button", { name: "Engine move", exact: true });
  await expect(btn).toBeEnabled({ timeout: 30_000 });
  await btn.click();
  await expect.poll(async () => (await simulNow(page)).boards[0].history.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  // The bots play their boards meanwhile.
  await expect.poll(async () => (await simulNow(page)).boards.slice(1).every((b: { history: string[] }) => b.history.length >= 2), { timeout: 30_000 }).toBe(true);
  expect(await king.seen()).toEqual({ bubble: false, figure: true });
  await expect(page.getByRole("button", { name: "God King: can't be called in phase 2" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("the board keeps its size from the mate until the split (Eric, Oct 18: it shrank on a phone as he fell), the scoreboard minimized, in a short window", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const phone = test.info().project.name === "phone";
  // (A window short enough that a phone's board is sized by its height, where the minimized scoreboard's room counts;
  // a laptop's maximized window on a computer.)
  await page.setViewportSize(phone ? { width: 390, height: 600 } : { width: 1280, height: 600 });
  // A phone: the scoreboard minimized, as a player may keep it. Since Oct 25 a boss screen on a phone upright has no
  // scoreboard to minimize (its panel beside the God King keeps one size: docs/decisions/2026-10-25-board-layout.md), so
  // the fold is one remembered from another match, which must change neither screen's board. (A computer's is beside the
  // board, its size the board's own.)
  if (phone) await page.addInitScript(() => localStorage.setItem("brc.underBoardView", JSON.stringify({ layout: "split", open: false })));
  await meetHim(page, "win=1&cutscene=6");
  await yourMove(page);
  // (The board resized for the minimized scoreboard before the watch starts: its squares are drawn by a ResizeObserver,
  // which runs after an animation frame's callbacks, so a frame read just after the fold sees the wrap's new size and
  // the squares' old one. Drawn: the squares fill the wrap, less up to 8 device pixels.)
  await expect
    .poll(() => page.evaluate(() => {
      const wrap = document.querySelector(".board-row > .board-wrap")!.getBoundingClientRect().width;
      const squares = document.querySelector(".board-row > .board-wrap .hb-board")!.getBoundingClientRect().width;
      return wrap - squares >= 0 && wrap - squares < 8 / devicePixelRatio + 0.5;
    }), { timeout: 10_000 })
    .toBe(true);
  // Every frame from your mating move until the split begins: the board's box (its wrap, and the squares drawn in it),
  // what's on screen (phase 1's move, his fall, the phase change's step).
  await page.evaluate(() => {
    const w = window as any;
    w.__boardSizes = [];
    w.__boardDone = false;
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? [r.width, r.height] : null;
    };
    const tick = () => {
      const step = document.querySelector(".rc-stage")?.getAttribute("data-step") ?? null;
      if (step === "split" || step === "shuffle") {
        w.__boardDone = true;
        return;
      }
      w.__boardSizes.push({ kind: w.match?.phase?.kind ?? null, step, wrap: box(".board-row > .board-wrap"), squares: box(".board-row > .board-wrap .hb-board") });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await play(page, "h5f7");
  await expect.poll(() => page.evaluate(() => (window as any).__boardDone), { timeout: 90_000 }).toBe(true);
  const frames: { kind: string | null; step: string | null; wrap: number[] | null; squares: number[] | null }[] = await page.evaluate(() => (window as any).__boardSizes);
  // (The whole stretch was watched: your move, his fall, every step of the phase change before the split.)
  expect(frames[0]!.kind).toBe("play");
  // (Your move may be scored for a moment before his fall: phase 1's own screen.)
  const kinds = new Set(frames.map((f) => f.kind));
  expect([...kinds].filter((k) => k !== "scoring").sort()).toEqual(["boss", "phaseChange", "play"]);
  expect(new Set(frames.map((f) => f.step).filter(Boolean))).toEqual(new Set(["book", "light", "white", "revealed", "crack"]));
  const [w0, h0] = frames[0]!.wrap!;
  const [s0] = frames[0]!.squares!;
  const off = frames.filter((f) => !f.wrap || !f.squares || Math.abs(f.wrap[0]! - w0!) > 1 || Math.abs(f.wrap[1]! - h0!) > 1 || Math.abs(f.squares[0]! - s0!) > 1);
  expect(off.slice(0, 3), `the board's size (${w0} x ${h0}, squares ${s0}) changed in ${off.length} of ${frames.length} frames`).toEqual([]);
});

test("the admins' Win this form (Nov 13, Eric's timing test): pressed, your next move beats his adult form, then his cutscene (the light, the child, the first line to the last), then his phase change; pressed in phase 2, your next move wins all four boards", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  // (?cutscene=30: his cutscene, about 104 s, sped up into 30 s: every line still shown.)
  await meetHim(page, "laststand=0&clock=60&cutscene=30");
  const win = page.getByRole("button", { name: /Win this form|Your next move wins this form/ });
  const mv = await quietMove(page);
  await win.click();
  await expect(win).toBeDisabled();
  await expect(win).toHaveAccessibleName(/Your next move wins this form/);
  expect((await bossNow(page)).result, "nothing ends before your move").toBeFalsy();
  // His cutscene (Eric, Nov 12): over his fall's screen, the light on the board, the child's arrival, Eric's 17 lines in their own
  // boxes (the first and the last watched, typed out in full), his figure in its place hidden meanwhile; then gone.
  const scene = await watchFor(page, {
    light: { selector: ".cs-layer .cs-dim" },
    kid: { selector: '.cs-fig .sprite-anim, .cs-fig canvas' },
    hidden: { selector: "body.cs-on" },
    first: { selector: '.cs-say[data-line="1"]', text: /^Why are you on the floor\?$/ },
    last: { selector: '.cs-say[data-line="18"]', text: /^Why don't you show us\?$/ },
  });
  // (Every frame: the tail over the speaker goes in and out with its box, never shown without it (Nov 14's visual check, #2).)
  await page.evaluate(() => {
    const w = window as any;
    w.__lone = [] as number[][];
    const tick = () => {
      const tail = document.querySelector(".cs-tail");
      const box = document.querySelector(".cs-say");
      if (tail && box) {
        const [a, b] = [Number(getComputedStyle(tail).opacity), Number(getComputedStyle(box).opacity)];
        if (a > b + 0.2) w.__lone.push([a, b]);
      }
      if (!w.__loneDone) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await play(page, mv);
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.fall), { timeout: 30_000 }).toBe(true);
  expect((await bossNow(page)).result).toBe("crowd");
  await expect.poll(() => page.locator(".cs-layer").count(), { timeout: 10_000 }).toBe(1);
  // (No skip: the phase holds through it, the 🏆 greyed.)
  expect(await phase(page)).toBe("boss");
  // (Nothing to tap: the ⋯ greyed in its place, not hidden; a tap on it opens nothing (review of #679, m1).)
  const more = page.getByRole("button", { name: "Match options" });
  await expect(more).toBeVisible();
  await expect(more).toHaveCSS("pointer-events", "none");
  await more.click({ force: true });
  await expect(page.locator(".mm-scrim")).toHaveCount(0);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("phaseChange");
  expect(await scene.seen()).toEqual({ light: true, kid: true, hidden: true, first: true, last: true });
  expect(await page.evaluate(() => ((window as any).__loneDone = true) && (window as any).__lone), "a tail shown without its box").toEqual([]);
  // (The scene's own layer gone; his transformation carries on from it in its own, Nov 14.)
  await expect(page.locator(".cs-layer:not(.rc-transform)")).toHaveCount(0);
  await expect(page.locator(".cs-layer.rc-transform")).toHaveCount(1);
  expect(await page.evaluate(() => document.body.classList.contains("cs-on"))).toBe(false);
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 + ADDED_MS }).toBe(true);
  const fen = (await simulNow(page)).boards[0].fen as string;
  const pawn = new Chess(fen.replace(/ [A-Ha-h]+ - /, " - - ")).moves({ verbose: true }).find((m) => m.piece === "p")!;
  await expect(win).toBeEnabled();
  await win.click();
  await simulPlay(page, pawn.lan);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
  expect(await page.evaluate(() => (window as any).match.phase.simul)).toEqual({ won: 4, of: 4 });
});

test("his child form first (Nov 13): the kid, his level a step up every 4 moves with a pop, growing a step older as it climbs, his room's theme; Win this form beats him, he grows up into the man, and a new match starts against his adult form, its theme after", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => ((window as any).__soundLog = []));
  const musicLog = () => page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => l.startsWith("music:")));
  await meetHim(page, "laststand=0&clock=60&form=child");
  await yourMove(page);
  const first = await bossNow(page);
  expect(first).toMatchObject({ id: "recluse", name: "Hidden Boss", form: "child", formStep: 0 });
  // (No powers: no meter, no bullet clock, nothing blocking the God King.)
  expect(first.powers).toBeUndefined();
  expect(typeof first.level).toBe("number");
  await expect(page.locator(".boss-bar .boss-level")).toHaveAttribute("data-level", String(first.level));
  await expect(page.locator(figure())).toHaveClass(/ch-recluse-growing/);
  // (Its loop alone: his room's theme has no intro.)
  await expect.poll(async () => (await musicLog()).some((l) => l.startsWith("music:start:recluse-house")), { timeout: 30_000 }).toBe(true);
  // His level climbs a step every 4 moves on the board, each step popping as it comes; at step 2 he grows up a step (to 13).
  const grew = await watchFor(page, { pop: { selector: ".boss-bar .boss-level.lv-up" }, grow: { selector: `${figure()}[data-anim="grow1"]` }, teen: { selector: `${figure()}[data-anim="age1"]` } });
  const levels = [first.level as number];
  for (let i = 0; i < 8 && ((await bossNow(page)).formStep ?? 0) < 2; i++) {
    await play(page, await quietMove(page));
    levels.push((await bossNow(page)).level as number);
  }
  await expect.poll(async () => (await bossNow(page)).formStep, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => grew.seen(), { timeout: 15_000 }).toEqual({ pop: true, grow: true, teen: true });
  expect((await bossNow(page)).level).toBeGreaterThan(first.level);
  for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
  // Win this form: your next move beats the child; his line, he grows up into the man (from 13), then a new match.
  const win = page.getByRole("button", { name: /Win this form|Your next move wins this form/ });
  const mv = await quietMove(page);
  await win.click();
  await expect(win).toBeDisabled();
  const up = await watchFor(page, { dock: { selector: ".boss-dock-status", text: /You beat him!/ }, up: { selector: `${figure()}[data-anim="up1"]` }, man: { selector: `${figure()}[data-anim="age3"]` } });
  await play(page, mv);
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.fall), { timeout: 30_000 }).toBe(true);
  expect(await bossNow(page)).toMatchObject({ form: "child", result: "crowd" });
  await expect.poll(() => up.seen(), { timeout: 15_000 }).toEqual({ dock: true, up: true, man: true });
  // His adult form: a new match from the starting position, "LVL ???", his powers; his theme after the room's.
  await expect.poll(async () => (await bossNow(page))?.form ?? "adult", { timeout: 15_000 }).toBe("adult");
  const adult = await bossNow(page);
  expect(adult.result).toBeUndefined();
  expect(adult.level).toBeNull();
  expect(adult.powers).toMatchObject({ passive: "nohelp", ultimate: "bullet" });
  expect(adult.board.history).toEqual([]);
  await expect(page.locator(figure())).not.toHaveClass(/ch-recluse-growing/);
  await expect.poll(async () => (await musicLog()).some((l) => l.startsWith("music:start:recluse-phase2")), { timeout: 30_000 }).toBe(true);
  await yourMove(page);
  await expect(page.locator(".boss-bar .boss-level")).toHaveAttribute("data-level", "unknown");
  await expect(win).toBeEnabled();
  expect(errors).toEqual([]);
});

test("his words stand above his head at every age beside the board (Eric, Nov 14: grown to 20, they sat over his face)", async ({ page }) => {
  test.skip(test.info().project.name === "phone", "a computer: on a phone his words are in his bar");
  test.setTimeout(3 * 60_000);
  await meetHim(page, "laststand=0&clock=60&form=child");
  await yourMove(page);
  // (The top of his drawing on the screen, from his canvas, and his words' bottom.)
  const gap = () =>
    page.evaluate(() => {
      const fig = document.querySelector<HTMLElement>(".boss-char.place-side")!;
      const cv = fig.querySelector("canvas")!;
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let top = cv.height;
      for (let y = 0; y < cv.height && top === cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3]! > 0) top = y;
      const r = cv.getBoundingClientRect();
      const bubble = fig.querySelector(".bc-bubble")!.getBoundingClientRect();
      return Math.round(r.top + (top / cv.height) * r.height - bubble.bottom);
    });
  // The child, 13, 20 and the man: his words over his head at each (the age's loop, set by the test switch's hook).
  for (const loop of ["idle", "age1", "age2", "age3"]) {
    await page.evaluate((loop) => {
      (window as any).bossFigure(loop);
      (window as any).sayBoss("That one's mine now.");
    }, loop);
    await expect(page.locator(figure())).toHaveAttribute("data-anim", loop);
    await expect(page.locator(`${figure()} .bc-bubble`)).toHaveAttribute("aria-label", "That one's mine now.");
    await expect.poll(gap, { message: loop }).toBeGreaterThan(0);
    // (A computer's bar face follows his age as a phone's bust does (Nov 14's visual check, #3): the bust's own frame, that loop.)
    await expect(page.locator(".boss-icon-face .boss-portrait")).toHaveAttribute("data-face", `${loop}:false`);
  }
});

test("beaten, his fall's words stand over him as he kneels, not where his head was (Nov 14's visual check: 82 px over it)", async ({ page }) => {
  test.skip(test.info().project.name === "phone", "a computer: on a phone his words are in his bar");
  test.setTimeout(3 * 60_000);
  await meetHim(page, "laststand=0&clock=60");
  await yourMove(page);
  const gap = () =>
    page.evaluate(() => {
      const fig = document.querySelector<HTMLElement>(".boss-char.place-side")!;
      const cv = fig.querySelector("canvas")!;
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let top = cv.height;
      for (let y = 0; y < cv.height && top === cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3]! > 0) top = y;
      const r = cv.getBoundingClientRect();
      return Math.round(r.top + (top / cv.height) * r.height - fig.querySelector(".bc-bubble")!.getBoundingClientRect().bottom);
    });
  for (const loop of ["idle", "collapseLoop"]) {
    await page.evaluate((loop) => {
      (window as any).bossFigure(loop);
      (window as any).sayBoss("The book said… no… no…");
    }, loop);
    await expect(page.locator(figure())).toHaveAttribute("data-anim", loop);
    await expect.poll(gap, { message: loop }).toBeGreaterThan(0);
    await expect.poll(gap, { message: loop }).toBeLessThan(50);
  }
});

test("a loss (?win=1&phase=2): you resign your board, the bots win theirs: defeated, 3 of 4 won", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "win=1&phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 + ADDED_MS }).toBe(true);
  await resignHere(page, /Your board is lost\. The other boards play on, but all four must be won\./);
  await expect.poll(async () => (await simulNow(page))?.boards[0].result?.how ?? null, { timeout: 10_000 }).toBe("resign");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
  await expect(page.locator(".results h1")).toHaveText("Defeat");
  await expect(page.locator(".team-result")).toContainText("The Hidden Boss won. You won 3 of 4 boards: all 4 must be won.");
  await expect(page.locator(".boss-char.place-results")).toHaveAttribute("data-anim", /laugh2|idle2/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

/** Every board's heart column against its board's squares (the page's boxes): its hearts, their boxes, and every board's squares. */
const heartBoxes = (page: Page) =>
  page.evaluate(() => {
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    // (The squares as drawn: a whole multiple of 8 device pixels, a hair inside the wrap's .board.)
    const boards = [...document.querySelectorAll(".rc-stage .rc-played .board .hb-container")].map(box);
    const cols = [...document.querySelectorAll(".rc-stage .rc-hearts")].map((c) => ({
      hearts: c.getAttribute("data-hearts"),
      col: box(c),
      board: box(c.closest(".board-wrap")!.querySelector(":scope > .board .hb-container")!),
      each: [...c.querySelectorAll(".rc-heart")].map(box),
    }));
    return { boards, cols, stage: box(document.querySelector(".rc-stage")!) };
  });

test("phase 2's hearts (?phase=2; Eric, Nov 16): a column of 8 at every board's right, each one of its squares tall; your move past 5 s has one of yours cut by his slash (a slow wind-up, then a fast stroke), his line on your screen, its sound; then as long as you need: nothing is played for you", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 + ADDED_MS }).toBe(true);
  await page.evaluate(() => ((window as any).__soundLog = []));
  // Four columns of eight, all full: each at its board's right (in the gutter, never over a board), as tall as it, a heart a square.
  await expect(page.locator(".rc-hearts")).toHaveCount(4);
  await expect(page.locator(".rc-hearts .rc-heart.full")).toHaveCount(4 * RECLUSE_PHASE2.hearts);
  const at = await heartBoxes(page);
  for (const c of at.cols) {
    expect(c.hearts).toBe(String(RECLUSE_PHASE2.hearts));
    expect(c.each).toHaveLength(RECLUSE_PHASE2.hearts);
    const square = (c.board.b - c.board.t) / 8;
    expect(c.col.l).toBeGreaterThanOrEqual(c.board.r);
    expect(Math.abs(c.col.t - c.board.t)).toBeLessThanOrEqual(1);
    expect(Math.abs(c.col.b - c.board.b)).toBeLessThanOrEqual(1);
    for (const h of c.each) expect(Math.abs(h.b - h.t - square)).toBeLessThanOrEqual(1);
    expect(c.col.r).toBeLessThanOrEqual(at.stage.r + 1);
    for (const b of at.boards) expect(c.col.r <= b.l + 0.5 || c.col.l >= b.r - 0.5 || c.col.b <= b.t + 0.5 || c.col.t >= b.b - 0.5).toBe(true);
  }
  // The slash, frame by frame (a per-frame sampler from before it can come): its glint first (the wind-up), then the stroke, then the
  // halves apart; his line and the sound as it begins.
  await page.evaluate(() => {
    const w = window as any;
    w.__cut = { glint: [] as number[], blade: [] as number[], apart: [] as number[] };
    const tick = () => {
      const c = document.querySelector(".rc-big .rc-hcut");
      const t = performance.now();
      if (c?.querySelector(".rc-hglint")) w.__cut.glint.push(t);
      if (c?.querySelector(".rc-hblade")) w.__cut.blade.push(t);
      const a = c?.querySelector<HTMLElement>(".rc-hhalf.a");
      if (a && a.style.translate && !/^-?0%/.test(a.style.translate)) w.__cut.apart.push(t);
      if (!w.__cutDone) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const said = await watchFor(page, {
    line: { selector: ".bc-bubble, .bc-bar-bubble", text: new RegExp(RECLUSE_LINES.slash.taunt[0]!.replace(".", "\\.")) },
    word: { selector: ".rc-wasted-word" },
  });
  // You don't move: one heart of yours cut as your move turns slow (judged at 6.5 s from when the board was yours: 5 s told).
  const mine = (await simulNow(page)).boards[0];
  await expect.poll(async () => (await simulNow(page)).boards[0].hearts, { timeout: 15_000 }).toBe(RECLUSE_PHASE2.hearts - 1);
  const cut = (await simulNow(page)).boards[0];
  expect(cut.slashAt - mine.turnAt).toBe(RECLUSE_PHASE2.slowMoveSeconds * 1000 + RECLUSE_PHASE2.slowAllowMs);
  await expect(page.locator(".rc-big .rc-heart.full")).toHaveCount(RECLUSE_PHASE2.hearts - 1);
  await expect.poll(() => page.evaluate(() => (window as any).__cut.apart.length), { timeout: 5_000 }).toBeGreaterThan(3);
  await page.waitForTimeout(RECLUSE_PHASE2.slash.ms);
  const frames = await page.evaluate(() => {
    const w = window as any;
    w.__cutDone = true;
    return w.__cut as { glint: number[]; blade: number[]; apart: number[] };
  });
  expect(frames.glint.length, "the wind-up's frames").toBeGreaterThan(3);
  expect(frames.blade.length).toBeGreaterThan(0);
  expect(Math.min(...frames.blade)).toBeGreaterThan(Math.max(...frames.glint) - 1);
  expect(Math.min(...frames.apart)).toBeGreaterThanOrEqual(Math.min(...frames.blade) - 1);
  // (The wind-up slow, the stroke fast: the glint up for most of windMs, the stroke across and gone within about 400 ms.)
  expect(Math.max(...frames.glint) - Math.min(...frames.glint)).toBeGreaterThan(RECLUSE_PHASE2.slash.windMs * 0.6);
  expect(Math.max(...frames.blade) - Math.min(...frames.blade)).toBeLessThan(450);
  // (Gone once its time is up: waited for, not read at one instant after a fixed sleep, which a busy runner can beat by a frame.)
  await expect(page.locator(".rc-hcut")).toHaveCount(0, { timeout: 5_000 });
  expect(await said.seen()).toEqual({ line: true, word: false });
  expect(((await page.evaluate(() => (window as any).__soundLog)) as string[]).filter((x) => x.startsWith("recluseSlash"))).toHaveLength(1);
  // As long as you need: 5 s more, no move played for you, no second heart on the same move, your clock running.
  await page.waitForTimeout(5_000);
  const later = (await simulNow(page)).boards[0];
  expect(later.history).toHaveLength(mine.history.length);
  expect(later.hearts).toBe(RECLUSE_PHASE2.hearts - 1);
  expect(later.result).toBeNull();
  await expect(page.locator(".boss-dock-status .dk-clock.running")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("out of hearts (?phase=2, the admins' \"Lose a heart (testing)\"): your board greys out slowly, \"TOO SLOW\" over it, his hardest line; the other boards play on", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 + ADDED_MS }).toBe(true);
  const btn = page.getByRole("button", { name: "Lose a heart (testing)" });
  const last = await watchFor(page, {
    line: { selector: ".bc-bubble, .bc-bar-bubble", text: /Your last heart|No hearts left/ },
    word: { selector: ".rc-big.rc-wasted .rc-wasted-word", text: /^TOO SLOW$/ },
  });
  for (let left = RECLUSE_PHASE2.hearts - 1; left >= 0; left--) {
    await btn.click();
    await expect.poll(async () => (await simulNow(page)).boards[0].hearts, { timeout: 5_000 }).toBe(left);
  }
  const v = await simulNow(page);
  expect(v.boards[0].result).toEqual({ winner: "boss", how: "slow" });
  await expect(btn).toBeDisabled();
  await expect(page.locator(".rc-big .rc-heart.full")).toHaveCount(0);
  await expect(page.locator(".boss-dock-status")).toContainText("Your board: too slow. The others play on.");
  // The fade to grey, slow (greyMs), then held: the board's squares and pieces grey, the word clean and white over them.
  await page.waitForTimeout(RECLUSE_PHASE2.slash.ms + RECLUSE_PHASE2.slash.greyMs + 300);
  const look = await page.evaluate(() => {
    const board = document.querySelector(".rc-big.rc-wasted > .board-wrap > .board");
    const word = document.querySelector<HTMLElement>(".rc-big .rc-wasted-word");
    return { filter: board ? getComputedStyle(board).filter : null, color: word ? getComputedStyle(word).color : null, opacity: word ? getComputedStyle(word).opacity : null };
  });
  expect(look.filter).toMatch(/grayscale\(1\)/);
  expect(look).toMatchObject({ color: "rgb(255, 255, 255)", opacity: "1" });
  expect(await last.seen()).toEqual({ line: true, word: true });
  // (The other boards play on.)
  expect((await simulNow(page)).boards.slice(1).some((b: { result: unknown }) => b.result === null)).toBe(true);
  expect(errors).toEqual([]);
});

test("phase 2 on a computer (Eric, Nov 16: \"replicate how it is on mobile\"): your board big where phase 1's stood, three quarters of its size, its foot and middle kept; the other three small in a row above it, inside the window, nothing overlapping; tap one to watch it, Back to my board", async ({ page }) => {
  test.skip(test.info().project.name === "phone", "a computer's layout (a phone's: the phase 2 tests above)");
  test.setTimeout(3 * 60_000);
  await meetHim(page, "phase=2");
  await expect.poll(() => phase(page), { timeout: 60_000 + ADDED_MS }).toBe("simul");
  for (const [width, height] of [[1280, 800], [1440, 900], [1611, 843], [1920, 1080], [1280, 600]] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    const at = `${width} x ${height}`;
    const lay = await page.evaluate(() => {
      const box = (e: Element | null) => {
        const r = e!.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
      };
      return {
        // (The square: phase 1's board's box, which the phase change and phase 2 keep: hidden-boss-room.spec.ts.)
        square: box(document.querySelector(".rc-simul .rc-stage")),
        bar: box(document.querySelector(".boss-bar")),
        big: box(document.querySelector(".rc-big .hb-board")),
        minis: [...document.querySelectorAll(".rc-mini")].map((m) => ({ board: box(m.querySelector(".hb-board")), tag: box(m.querySelector(".rc-tag")) })),
      };
    });
    const { square, big, minis } = lay;
    // Your board: three quarters of phase 1's (FOUR.desk, its squares a whole multiple of 8 device pixels), its foot and middle there.
    expect(Math.abs(big.w - 0.755 * square.w), `${at}: your board ${big.w} in ${square.w}`).toBeLessThanOrEqual(8);
    expect(Math.abs((big.l + big.r) / 2 - (square.l + square.r) / 2), `${at}: your board's middle`).toBeLessThanOrEqual(1);
    expect(square.b - big.b, `${at}: your board's foot`).toBeGreaterThanOrEqual(0);
    expect(square.b - big.b, `${at}: your board's foot`).toBeLessThanOrEqual(5);
    // The other three: in a row above it, each whole in the window with its tag, under the boss bar, none overlapping.
    expect(minis, at).toHaveLength(3);
    for (const [i, m] of minis.entries()) {
      for (const b of [m.board, m.tag]) expect(b.l >= 0 && b.t >= lay.bar.b && b.r <= width && b.b <= big.t, `${at}: small board ${i} ${JSON.stringify(b)}`).toBe(true);
      expect(m.tag.b, `${at}: small board ${i}'s tag over it`).toBeLessThanOrEqual(m.board.t);
      if (i) expect(m.board.l, `${at}: small boards ${i - 1} and ${i}`).toBeGreaterThanOrEqual(Math.max(minis[i - 1]!.board.r, minis[i - 1]!.tag.r));
      if (i) expect(m.tag.l, `${at}: tags ${i - 1} and ${i}`).toBeGreaterThanOrEqual(minis[i - 1]!.tag.r);
    }
  }
  // Tap a small one: it's the big one, "Back to my board" in the dock brings yours back.
  const watched = (await simulNow(page)).boards[1].name as string;
  await page.getByRole("button", { name: `Watch ${watched}'s board` }).click();
  await expect(page.locator(".rc-big .rc-tag")).toHaveText(watched);
  // (Its name in the gap over it, clear of the row above.)
  const clear = await page.evaluate(() => document.querySelector(".rc-big .rc-tag")!.getBoundingClientRect().top - Math.max(...[...document.querySelectorAll(".rc-mini .hb-board")].map((m) => m.getBoundingClientRect().bottom)));
  expect(clear, "the watched board's name under the small boards").toBeGreaterThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Back to your board" })).toBeVisible();
  await page.getByRole("button", { name: "Back to my board" }).click();
  await expect(page.locator(".rc-big .rc-tag")).toHaveCount(0);
  await expect(page.locator(".rc-mini.you")).toHaveCount(0);
});
