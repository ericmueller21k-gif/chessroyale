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
  await expect(page.locator(".boss-dock-status .bullet-note")).toContainText(/Bullet · \d:\d\d left/);
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

test("beaten in phase 1 (?win=1): he collapses and mumbles, then the phase change (the book's slam, the split, his revive, the shuffle) and four boards; all four won: Victory!", async ({ page }) => {
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
    book: { selector: ".rc-book canvas" },
    crack: { selector: ".rc-crack canvas" },
    split: { selector: ".rc-split.rc-q3" },
    revive: { selector: `${figure()}[data-anim="revive"]` },
    banner: { selector: ".fight-banner", text: /PHASE 2/ },
    idle2: { selector: `${figure()}[data-anim="idle2"]` },
    reviveLine: { selector: ".bc-bubble", text: /Not yet\. Now we play real chess\.|On your feet, all of you\. Again!/ },
  });
  await play(page, "h5f7");
  // The board holds while he falls, then (no result screen) the phase change, then phase 2's four boards.
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.fall), { timeout: 60_000 }).toBe(true);
  expect((await bossNow(page)).result).toBe("crowd");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("phaseChange");
  expect(await fall.seen()).toMatchObject({ collapse: true, dock: true });
  const at = Date.now();
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 }).toBe(true);
  // (About 7 s: PHASE_CHANGE.total.)
  expect(Date.now() - at).toBeLessThan(10_000);
  expect(await phase(page)).toBe("simul");
  expect(await change.seen()).toMatchObject({ book: true, crack: true, split: true, revive: true, banner: true });
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
  await expect(page.locator(".team-result")).toContainText("You beat Hidden Boss on all 4 boards!");
  // His defeat in phase 2 (a placeholder for his transformation: the spellbook's glow, his hair in the wind).
  await expect(page.locator(".boss-char.place-results")).toHaveAttribute("data-anim", /spellbook2|spellLoop2/, { timeout: 10_000 });
  expect(await change.seen()).toMatchObject({ idle2: true, reviveLine: true });
  expect(errors).toEqual([]);
});

test("phase 2 (?phase=2): four boards, each its own Chess960 start; Stockfish 2750 answers your move; Engine move on your board; the God King's help mocked", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("phaseChange");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 30_000 }).toBe(true);
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
  // The God King's help tried: blocked, he slams the book (phase 2's slam), and the God King says it won't take hold.
  const mock = await watchFor(page, {
    slam: { selector: `${figure()}[data-anim="slam2"]` },
    king: { selector: ".gk-bubble", text: /won't take hold|shrugs off my strength|can't reach him/ },
  });
  await page.getByRole("button", { name: /God King: tap to summon/ }).click();
  await page.getByRole("menuitem", { name: /Strike/ }).click();
  await expect.poll(() => mock.seen(), { timeout: 10_000 }).toEqual({ slam: true, king: true });
  // The bots play their boards meanwhile.
  await expect.poll(async () => (await simulNow(page)).boards.slice(1).every((b: { history: string[] }) => b.history.length >= 2), { timeout: 30_000 }).toBe(true);
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
  await expect(page.locator(".team-result")).toContainText("Hidden Boss won. You won 3 of 4 boards: all 4 must be won.");
  await expect(page.locator(".boss-char.place-results")).toHaveAttribute("data-anim", /laugh2|idle2/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("phase 2's ultimate (the admins' trigger): \"5 SECONDS!\", his line and spellbook; then 5 s a move, and out of time a random move is played for you, never a loss", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await meetHim(page, "phase=2");
  await expect.poll(async () => (await simulNow(page))?.playing ?? false, { timeout: 60_000 }).toBe(true);
  // Before it: your bank, and the slow moves counted in the dock.
  await expect(page.locator(".boss-dock-status")).toContainText(/Your clock \d:\d\d · slow moves \d of 5/);
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
