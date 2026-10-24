import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { DEFAULT_SETTINGS } from "@chessroyale/core";
import { BOARD_SEL, createLobbyFromHome, engineTop, test, watchFor, bossAloneFromHome } from "./helpers.ts";

/**
 * Wrangler, the cowboy pig, played alone on a phone and a computer with real taps: his long pull as his first move
 * (a center pawn three squares, LONG PULL!), a lasso drag (?power=drag: from turn 2; LASSO!, one of your pieces one
 * square, never the king), and SHOWDOWN! (?power=showdown: searched by this device's engine at his next turn; perhaps
 * "Not yet..." first), the line-up yanked into the middle, "DRAW!", and the forced duel: only the duels can be played.
 * Then his reply: the engine's best at full strength, the reply the search scored, never his brain's (Eric, Oct 13: on
 * Maia at 600 he took another piece and the crowd won his queen for free); taking back when that's the best. On the
 * phone you're an admin, so his brain is Maia, as Eric's was.
 * Then online (one run): the host's engine lines the showdown up, the server checks it and sends it to everyone, and
 * the host plays his reply.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const bossNow = (p: Page) => p.evaluate(() => (window as any).match?.boss ?? null);
const soundsHeard = (p: Page) => p.evaluate(() => ((window as any).__soundLog ?? []) as string[]);

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
async function yourMove(page: Page, timeout = 90_000) {
  await expect.poll(() => phase(page), { timeout }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
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
/** An allowed move once it's your move, preferring `want`: a quiet one, so the battle goes on. */
async function allowedMove(page: Page, want: string[] = []): Promise<string> {
  await yourMove(page);
  const { fen, allowed } = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: (window as any).match.boss?.powers?.allowed as string[] | null }));
  const legal = allowed ?? new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  return want.find((m) => legal.includes(m)) ?? legal.filter((m) => m.length === 4).sort()[0]!;
}
/**
 * A good move once it's your move (the engine's best that's allowed), so the game stays a game: a careless crowd is
 * soon lost, and in a decided game his engine work can't read the small swings it aims for (no drag, no showdown).
 */
async function goodMove(page: Page): Promise<string> {
  await yourMove(page);
  const allowed = (await powers(page))?.allowed as string[] | null;
  const { top } = await engineTop(page);
  return top.map((m) => m.move).find((m) => !allowed || allowed.includes(m)) ?? (await allowedMove(page));
}
/** Where a line-up stands (Eric, Oct 13): anywhere off both back ranks. */
const inZone = (sq: string) => Number(sq[1]) >= 2 && Number(sq[1]) <= 7;

/**
 * Engine work on the page's own engine (the one his moves are played on): started in the page, its answer kept on
 * `window` and polled, never awaited inside page.evaluate (LESSONS.md, "A navigation that never happened"). "top": the
 * position's top line at `nodes`, as his reply to a duel is searched (bestReplyFrom); "score": the given moves scored.
 */
type EngineJob = { kind: "top"; fen: string; nodes: number } | { kind: "score"; fen: string; moves: readonly string[] };
async function onPageEngine(page: Page, job: EngineJob): Promise<{ move: string; expected: number }[]> {
  const key = await page.evaluate((job) => {
    const w = window as any;
    const store = (w.__pigEngine ??= {});
    const k = `${job.kind}-${Math.random().toString(36).slice(2)}`;
    store[k] = null;
    const m = w.match;
    const engine: Promise<any> = m.runner ? Promise.resolve(m.runner.opts.engines[0]) : m.engines().then((es: any[]) => es[0]);
    void engine
      .then((e) => (job.kind === "top" ? e.topMovesAt(job.fen, 1, job.nodes) : e.scoreMoves(job.fen, job.moves)))
      .then(
        (r: unknown) => (store[k] = { r }),
        (err: unknown) => (store[k] = { r: [], error: String(err) }),
      );
    return k;
  }, job);
  let out: { r: { move: string; expected: number }[]; error?: string } | null = null;
  await expect.poll(async () => (out = await page.evaluate((k) => (window as any).__pigEngine?.[k] ?? null, key)), { timeout: 60_000 }).not.toBeNull();
  await page.evaluate((k) => delete (window as any).__pigEngine[k], key);
  expect(out!.error).toBeUndefined();
  return out!.r;
}

/**
 * The duel this device's engine rates best. Online there's no ?laststand=0, and a duel that throws the game away is
 * taken back by the God King's Last Stand: the crowd picks again, and the duel never reaches the board.
 */
async function bestDuel(page: Page, fen: string, duels: readonly string[]): Promise<string> {
  const scored = await onPageEngine(page, { kind: "score", fen, moves: duels });
  expect(scored.map((m) => m.move).sort()).toEqual([...duels].sort());
  return [...scored].sort((a, b) => b.expected - a.expected)[0]!.move;
}

/** The position after a duel (him to move), as the board plays it. */
const afterDuel = (fen: string, duel: string) => {
  const c = new Chess(fen);
  c.move({ from: duel.slice(0, 2), to: duel.slice(2, 4) });
  return c.fen();
};
/**
 * His reply to a duel as the search scored it: the engine's best at full strength (one line at the boss's own budget, on
 * the same engine he plays on: the same search, so the same move), worked out before the duel is played.
 */
async function bestReply(page: Page, fen: string, duel: string): Promise<string> {
  const [line] = await onPageEngine(page, { kind: "top", fen: afterDuel(fen, duel), nodes: DEFAULT_SETTINGS.bossNodes });
  expect(line, `a reply to ${duel}`).toBeTruthy();
  return line!.move;
}
/** Takes back on the duel's square (the crowd's piece that just took his). */
const takesBack = (duel: string, reply: string) => reply.slice(2, 4) === duel.slice(2, 4);
/**
 * A duel to play and his best reply to it. The engine's best reply isn't always taking back: in a line-up the other
 * pairs face each other too, so it can be another capture first (his knight taking the crowd's, the queen taken back
 * later). So a duel whose best reply takes back, when there is one; else the first.
 */
async function duelAndReply(page: Page, fen: string, duels: readonly string[]): Promise<{ duel: string; reply: string }> {
  const each: { duel: string; reply: string }[] = [];
  for (const duel of duels) each.push({ duel, reply: await bestReply(page, fen, duel) });
  console.log(`Wrangler's best replies: ${each.map((x) => `${x.duel} ${x.reply}${takesBack(x.duel, x.reply) ? " (takes back)" : ""}`).join(", ")}`);
  return each.find((x) => takesBack(x.duel, x.reply)) ?? each[0]!;
}
/**
 * After the duel: your move again, and his reply on the board after it: exactly the engine's best at full strength
 * (`reply`, the move the search scored), whatever his brain; taking back when that's the best.
 */
async function checkReply(page: Page, ply: number, duel: string, reply: string) {
  await yourMove(page);
  const after = await bossNow(page);
  expect(after.board.history[ply]).toBe(duel);
  expect(after.board.history[ply + 1]).toBe(reply);
  if (takesBack(duel, reply)) expect(new Chess(after.board.fen).get(duel.slice(2, 4) as never)).toMatchObject({ color: after.crowdSide === "w" ? "b" : "w" });
}

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS): every boss on Maia for you. */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

/**
 * Plays good moves until his showdown's duel turn, and returns it. While one may follow your move (the rules' `scout`),
 * you think a while, as a crowd does: his scout searches line-ups meanwhile (showdownSearchMs). No warning, no
 * "Not yet..." on the way (Eric, Oct 13).
 */
async function untilShowdown(page: Page, turns = 8) {
  for (let i = 0; i < turns; i++) {
    await yourMove(page);
    const b = await bossNow(page);
    expect(b.powers.events.map((e: { kind: string }) => e.kind)).not.toContain("warn");
    if (b.powers.showdown && b.powers.showdown.turn === b.powers.turn) return b;
    const move = await goodMove(page);
    if (b.powers.scout) await page.waitForTimeout(6000);
    await play(page, move);
  }
  throw new Error("no showdown");
}

/** The line-up as the rules say: rook, bishop and knight pairs (or two) facing off the back ranks, his pieces protected, the squares on the board, the duels the only moves. */
async function checkLineup(page: Page, b: any) {
  const sd = b.powers.showdown;
  const c = new Chess(b.board.fen);
  const crowd = b.crowdSide as "w" | "b";
  const his = crowd === "w" ? "b" : "w";
  expect([2, 3]).toContain(sd.pairs.length);
  const duels: string[] = [];
  for (const p of sd.pairs) {
    expect(inZone(p.crowd) && inZone(p.boss), `${p.crowd} ${p.boss}`).toBe(true);
    expect("rbn", "never queens").toContain(p.piece);
    expect(c.get(p.crowd as never)).toMatchObject({ color: crowd, type: p.piece });
    expect(c.get(p.boss as never)).toMatchObject({ color: his, type: p.piece });
    // His piece is protected: after the duel's capture, he can take back.
    expect(c.isAttacked(p.boss as never, his), `${p.boss} protected`).toBe(true);
    duels.push(p.crowd + p.boss);
  }
  // Only the duels (the legal ones) can be played; nobody is in check.
  expect(c.inCheck()).toBe(false);
  const legal = new Set(c.moves({ verbose: true }).map((m) => m.from + m.to));
  expect([...b.powers.allowed].sort()).toEqual(duels.filter((d) => legal.has(d)).sort());
  return duels;
}

test("Wrangler's long pull as his first move, then a lasso drag (?power=drag)", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (His brain on Stockfish, an admin's test brain, at his strength: on Maia at 600 he fell apart against the engine's
  // best moves, and a game more than DRAG_DECIDED pawns one way has no drag, so none came within the turns now and then.)
  await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=pig&power=drag&laststand=0&brain=stockfish");
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  const boss = await bossNow(page);
  expect(boss.name).toBe("Wrangler");
  expect(boss.crowdSide).toBe("w");
  expect(boss.board.history).toEqual([]);

  // Move 1: e4. His reply is the long pull (e7-e4 is blocked: d7, two squares, and lassoed on to d4).
  const pullSeen = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /LONG PULL!/ },
    lasso: { selector: '.pg-layer[data-lasso="d5d4"] .pg-pig' },
    tug: { selector: '.pg-layer[data-stage="tug"]' },
  });
  await page.evaluate(() => ((window as any).__soundLog = []));
  await play(page, "e2e4");
  await yourMove(page);
  expect(await page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Stockfish/);
  const b1 = await bossNow(page);
  expect(b1.powers.pull).toEqual({ turn: 2, from: "d7", via: "d5", to: "d4" });
  // His move is the double step (in the record), and the pawn stands on d4 with d7 and d5 empty.
  expect(b1.board.history).toEqual(["e2e4", "d7d5"]);
  const c1 = new Chess(b1.board.fen);
  expect(c1.get("d4" as never)).toMatchObject({ color: "b", type: "p" });
  expect(c1.get("d5" as never)).toBeFalsy();
  expect(c1.get("d7" as never)).toBeFalsy();
  // No en passant: it's no longer a double step.
  expect(b1.board.fen.split(" ")[3]).toBe("-");
  expect(await pullSeen.seen()).toEqual({ banner: true, lasso: true, tug: true });
  const heard = (await soundsHeard(page)).map((s) => s.split(":")[0]);
  expect(heard).toEqual(expect.arrayContaining(["pigThrow", "pigCatch", "pigTug"]));
  // The board shows the pawn on d4.
  await expect(page.locator(`${BOARD_SEL.piece}.black.pawn`)).toHaveCount(8);

  // A lasso drag after one of his next moves (the test switch: from turn 2, every 2 turns; none in the band: the next).
  const dragSeen = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /LASSO!/ }, layer: { selector: ".pg-layer[data-lasso] .pg-piece" } });
  let drag: any = null;
  let before = 0;
  // (Each turn's eval bar and brain, for the message if no drag came: a game past DRAG_DECIDED has none.)
  const turns: string[] = [];
  for (let i = 0; i < 6 && !drag; i++) {
    before = (await bossNow(page)).board.history.length;
    await play(page, await goodMove(page));
    await yourMove(page);
    const b = await bossNow(page);
    turns.push(`t${b.powers.turn} ${(await page.locator(".eval-label").first().textContent()) ?? "?"} ${await page.evaluate(() => (window as any).match.brainLine ?? "")}`);
    if (b.powers.drag && b.powers.drag.turn === b.powers.turn) drag = b;
  }
  expect(drag, `a drag within 6 turns (${turns.join("; ")})`).not.toBeNull();
  const d = drag.powers.drag;
  // One square, up, down or sideways; never the king (nor a bishop); onto an empty square.
  const df = Math.abs(d.from.charCodeAt(0) - d.to.charCodeAt(0));
  const dr = Math.abs(Number(d.from[1]) - Number(d.to[1]));
  expect(df + dr).toBe(1);
  expect(["k", "b"]).not.toContain(d.piece);
  const c = new Chess(drag.board.fen);
  expect(c.get(d.to as never)).toMatchObject({ color: "w", type: d.piece });
  expect(c.get(d.from as never)).toBeFalsy();
  // Not left in check, and with a move.
  expect(c.inCheck()).toBe(false);
  expect(c.moves().length).toBeGreaterThan(0);
  // The record: the crowd's move and his; the drag isn't a move (it's put on the board after his: a base there).
  expect(drag.board.history.length).toBe(before + 2);
  expect(drag.board.bases.some((x: { ply: number; fen: string }) => x.ply === before + 2 && x.fen === drag.board.fen)).toBe(true);
  expect(await dragSeen.seen()).toEqual({ banner: true, layer: true });
  // The board shows it.
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(c.board().flat().filter((x) => x?.color === "w").length);
  expect(errors).toEqual([]);
});

test("Wrangler's SHOWDOWN! (?power=showdown): the line-up yanked into the middle, DRAW!, only the duels can be played, and his reply is the engine's best", async ({ page }) => {
  test.setTimeout(7 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (On the phone you're an admin: his brain is Maia, no guard, as in Eric's game.)
  const admin = test.info().project.name === "phone";
  if (admin) await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=pig&power=showdown&laststand=0");
  await bossAloneFromHome(page);
  await yourMove(page);
  // His meter (the test switch: full from turn 2): his line in his text box, and his ready loop until he fires.
  const ready = await watchFor(page, {
    line: { selector: ".bc-bubble", text: /I've got you in my sights\./ },
    loop: { selector: '.boss-char[data-anim="ready"]' },
  });
  const seen = await watchFor(page, {
    banner: { selector: ".fight-banner.power-cut", text: /SHOWDOWN!/ },
    windup: { selector: '.pg-layer[data-showdown="windup"] .pg-pig' },
    yank: { selector: '.pg-layer[data-showdown="yank"] .pg-ropes .pg-rope' },
    draw: { selector: ".fight-banner.power-cut", text: /DRAW!/ },
    duels: { selector: ".pg-duels[data-duels] .pg-duel" },
    dock: { selector: ".duel-note", text: /^Take one of his (three|two) duels\.$/ },
  });
  await page.evaluate(() => ((window as any).__soundLog = []));
  await play(page, "e2e4");
  const b = await untilShowdown(page);
  const duels = await checkLineup(page, b);
  expect(await seen.seen()).toEqual({ banner: true, windup: true, yank: true, draw: true, duels: true, dock: true });
  expect(await ready.seen()).toEqual({ line: true, loop: true });
  await expect(page.locator(".pg-duels")).toHaveAttribute("data-duels", duels.join(" "));
  const heard = (await soundsHeard(page)).map((s) => s.split(":")[0]);
  expect(heard).toEqual(expect.arrayContaining(["pigWindup", "pigYank", "pigDraw"]));
  // His meter spent on it (shown full on the showdown's turn, then empty, filling again over his next moves).
  expect(b.powers.ultAt).toBe(b.powers.turn);
  expect(b.powers.ults).toBe(1);
  expect(b.powers.ready).toBeNull();
  expect(b.powers.showdown.outside).toBeUndefined();

  // Anything else can't be played: a legal pawn move is refused (still your move).
  const c = new Chess(b.board.fen);
  const other = c.moves({ verbose: true }).find((m) => m.piece === "p" && !duels.includes(m.from + m.to))!;
  expect(other).toBeTruthy();
  await tap(page, other.from);
  await tap(page, other.to);
  await page.waitForTimeout(800);
  expect(await phase(page)).toBe("play");
  expect((await bossNow(page)).board.history.length).toBe(b.board.history.length);
  // A duel: played as a normal move (the crowd's piece takes his). Then his reply: the engine's best at full strength
  // (what the search scored), whatever his brain: taking back, when that's the best.
  if (admin) expect(await page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Maia \d+ · no guard/);
  const { duel, reply } = await duelAndReply(page, b.board.fen, b.powers.allowed as string[]);
  await play(page, duel);
  await checkReply(page, b.board.history.length, duel, reply);
  if (admin) expect(await page.evaluate(() => (window as any).match.brainLine as string)).toMatch(/^Maia \d+ · no guard · Stockfish's best \(power reply\)$/);
  const after = await bossNow(page);
  expect(after.powers.allowed).toBeNull();
  await expect(page.locator(".pg-duels")).toHaveCount(0);
  await expect(page.locator(".duel-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Wrangler online: the host's engine lines up the showdown, the server checks it, the duel is forced, and his reply is the engine's best", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&mode=raid&boss=pig&power=showdown&bossMoves=12&clock=40");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  await yourMove(page);
  const first = await bossNow(page);
  expect(first.name).toBe("Wrangler");
  expect(first.crowdSide).toBe("w");
  await play(page, "e2e4");
  await yourMove(page);
  // His long pull, from the host (this page) through the server.
  expect((await powers(page)).pull).toEqual({ turn: 2, from: "d7", via: "d5", to: "d4" });
  const b = await untilShowdown(page);
  const duels = await checkLineup(page, b);
  await expect(page.locator(".pg-duels")).toHaveAttribute("data-duels", duels.join(" "));
  // The server refuses anything else; a duel goes through.
  const c = new Chess(b.board.fen);
  const other = c.moves({ verbose: true }).find((m) => m.piece === "p" && !duels.includes(m.from + m.to))!;
  await tap(page, other.from);
  await tap(page, other.to);
  await page.waitForTimeout(800);
  expect(await phase(page)).toBe("play");
  // (The best of them: one that loses outright would be taken back by the God King's Last Stand.) His reply, from
  // the host (this page) through the server: the engine's best at full strength.
  const duel = await bestDuel(page, b.board.fen, b.powers.allowed as string[]);
  const reply = await bestReply(page, b.board.fen, duel);
  await play(page, duel);
  await checkReply(page, b.board.history.length, duel, reply);
  expect(errors).toEqual([]);
});

test("Wrangler's showdown on demand (the admins' trigger): his meter full at once, the showdown after his next move, no warning; outside the band only marked so", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=pig&laststand=0");
  await bossAloneFromHome(page);
  await play(page, "e2e4");
  await yourMove(page);
  // His meter: one move of his in, nowhere near full.
  expect((await powers(page)).rage).toBeLessThan(1);
  const btn = page.locator(".ult-test");
  await expect(btn).toHaveAccessibleName("Trigger ultimate (testing)");
  await btn.click();
  await expect(btn).toHaveAccessibleName("Ultimate next turn (testing)");
  await expect.poll(async () => (await powers(page)).rage).toBe(1);
  const seen = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /SHOWDOWN!/ }, draw: { selector: ".fight-banner.power-cut", text: /DRAW!/ } });
  await play(page, await goodMove(page));
  await yourMove(page);
  const b = await bossNow(page);
  expect(b.powers.showdown?.turn).toBe(b.powers.turn);
  expect(b.powers.events.map((e: { kind: string }) => e.kind)).not.toContain("warn");
  expect(await seen.seen()).toEqual({ banner: true, draw: true });
  await checkLineup(page, b);
  // Outside the band (none inside it found in the trigger's search): said so on the admins' debug line, and only then.
  const debug = page.locator(".brain-debug");
  if (b.powers.showdown.outside) await expect(debug).toContainText("Showdown (test: outside the band)");
  else await expect(debug).not.toContainText("outside the band");
  expect(errors).toEqual([]);
});
