import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, test, bossAloneFromHome, submitMove } from "./helpers.ts";
import { REFUSED } from "../packages/app/src/refused.ts";

/**
 * Smudgy (id smudgy), played alone on a phone and a computer, the state read from the game and the board read from the
 * page (docs/decisions/2026-10-19-smudgy-wired.md; his rules: docs/decisions/2026-10-19-smudgy-rules.md):
 * - His tile picks him; his two forced moves, then Camouflage: "CAMOUFLAGE!", a splash over every square with one of his
 *   pawns, the swap under it, the paint fading off a board where his rook is drawn as a pawn. Every frame is recorded.
 * - The masked board: wherever the rook hides it is drawn as one of his pawns, in every position (the board, the history
 *   browsed back), its steps are named as a pawn's, the moves a tap offers are the ones that board has, and a move the real
 *   board refuses ("A painted piece stops that move.") stays put and is picked again, never a silent snap-back. The test
 *   switch ?paint=1 is the position and the script: his rook hidden on d7 with the d-file open, his first move the rook's
 *   step to d6, his second its strike on d2 (shown for what it is). ?paint=2 steps it twice and your rook takes it hidden
 *   ("That was his rook!").
 * - Repaint (?power=repaint): "REPAINT!", a cream stroke on his pawn's square, a charcoal one on your piece's, each piece
 *   changing color under its stroke.
 * - The layout at 320, 360, 390 and 1280: his figure whole in the bar, his longest lines whole and in view in his text box.
 * His king attack in the Last Stand is in king-attack.spec.ts, his tile and stage in boss-select.spec.ts, the line for
 * his Camouflage in boss-speech.spec.ts, the rest of his kit in boss-smoke.spec.ts.
 */
const desktop = () => test.info().project.name === "desktop";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board?.fen as string, history: (m.phase.board?.history ?? []) as string[], boss: m.boss, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
const heard = (p: Page) => p.evaluate(() => ((window as any).__soundLog as string[]).map((n) => n.split(":")[0]!));
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** A quiet move of yours that keeps both his sides open (a knight first, never a d- or e-pawn), allowed now. */
function quiet(fen: string, allowed: string[] | null): string {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => ({ uci: m.from + m.to, piece: m.piece, from: m.from }));
  const ok = legal.filter((m) => !allowed || allowed.includes(m.uci)).filter((m) => m.from[0] !== "d" && m.from[0] !== "e");
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? legal[0])!.uci;
}

// ---------------- Reading the page ----------------

/** The center of a square on the big board (you White, as a battle alone starts). */
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
/** Taps a move until the turn is played (a first tap on a selected piece only puts it down). */
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/** The board as the page draws it, from its elements: square to color and piece ("bp", "wk"). */
const drawn = (page: Page) =>
  page.evaluate(() => {
    const roles: Record<string, string> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
    const out: Record<string, string> = {};
    for (const e of document.querySelectorAll<HTMLElement>(".hb-board piece[data-square]")) {
      const role = Object.keys(roles).find((r) => e.classList.contains(r));
      if (role) out[e.dataset.square!] = (e.classList.contains("white") ? "w" : "b") + roles[role];
    }
    return out;
  });
/** The same from a position, with the hidden rook as the pawn it is drawn as. */
function placed(fen: string, hidden: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of new Chess(fen).board()) for (const p of row) if (p) out[p.square] = p.color + (p.square === hidden && p.type === "r" ? "p" : p.type);
  return out;
}
const sorted = (o: Record<string, string>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
/** The board drawn is the real position with the hidden rook a pawn (nothing hidden: the real position), once it has settled. */
async function expectMasked(page: Page, where: string) {
  await expect
    .poll(
      async () => {
        const s = await state(page);
        const hidden = (s.boss.powers?.camo?.square ?? null) as string | null;
        return sorted(await drawn(page)) === sorted(placed(s.fen, hidden));
      },
      { message: where, timeout: 10_000 },
    )
    .toBe(true);
}
/** The squares a tap on a piece shows moves to (the dots), you White. */
const dots = (page: Page) =>
  page.evaluate(() => {
    const b = document.querySelector(".hb-board")!.getBoundingClientRect();
    const flip = document.querySelector(".hb")!.classList.contains("orientation-black");
    return [...document.querySelectorAll(".hb-board square.move-dest")]
      .map((e) => {
        const r = e.getBoundingClientRect();
        const f = Math.floor((r.left + r.width / 2 - b.left) / (b.width / 8));
        const rk = Math.floor((r.top + r.height / 2 - b.top) / (b.height / 8));
        return "abcdefgh"[flip ? 7 - f : f]! + (flip ? rk + 1 : 8 - rk);
      })
      .sort();
  });

/** One frame of the page, kept when it differs from the one before. */
interface Rec {
  t: number;
  kind: string | null;
  hidden: string | null;
  camo: string | null;
  covered: number;
  unmask: string | null;
  taken: string | null;
  repaint: string | null;
  banner: string;
  bannerIn: boolean;
  dock: string;
  pieces: Record<string, string>;
}
/** Watches every frame from now on: his layers' phases, the banner, the dock's words, the board drawn. */
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__rec = [] as unknown[];
    let last = "";
    const roles: Record<string, string> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
    const frame = () => {
      const q = (s: string) => document.querySelector<HTMLElement>(s);
      const pieces: Record<string, string> = {};
      for (const e of document.querySelectorAll<HTMLElement>(".hb-board piece[data-square]")) {
        const role = Object.keys(roles).find((r) => e.classList.contains(r));
        if (role) pieces[e.dataset.square!] = (e.classList.contains("white") ? "w" : "b") + roles[role];
      }
      const banner = q(".fight-banner");
      const b = banner?.getBoundingClientRect();
      const rec = {
        t: Math.round(performance.now()),
        kind: w.match?.phase?.kind ?? null,
        hidden: w.match?.boss?.powers?.camo?.square ?? null,
        camo: q(".sm-layer[data-camo]")?.dataset.camo ?? null,
        covered: Number(q(".sm-layer[data-camo]")?.dataset.covered ?? -1),
        unmask: q(".sm-layer[data-unmask]")?.dataset.unmask ?? null,
        taken: q(".sm-layer[data-taken]")?.dataset.taken ?? null,
        repaint: q(".sm-layer[data-repaint]")?.dataset.repaint ?? null,
        banner: banner?.textContent ?? "",
        bannerIn: !b || (b.left >= -1 && b.right <= innerWidth + 1),
        dock: q(".boss-dock .dk-text")?.textContent ?? q(".boss-dock")?.textContent ?? "",
        pieces,
      };
      const key = JSON.stringify({ ...rec, t: 0 });
      if (key !== last) {
        last = key;
        if (w.__rec.length < 8000) w.__rec.push(rec);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
const frames = (page: Page) => page.evaluate(() => (window as any).__rec as Rec[]);
/** A list with the empty ones taken out and the repeats in a row. */
const inOrder = <T>(list: (T | null)[]): T[] => list.filter((x): x is T => x !== null && x !== "").filter((x, i, a) => i === 0 || x !== a[i - 1]);
const count = (pieces: Record<string, string>, what: string) => Object.values(pieces).filter((v) => v === what).length;
/** The frames (kept when something on screen changed) a layer was in a phase. */
const during = (list: Rec[], key: "repaint" | "unmask" | "camo", value: string) => list.filter((r) => r[key] === value);

/** The name the board you see gives his move of the hidden rook: a pawn's (`fen`: before it, the rook on `hidden`). */
function pawnName(fen: string, hidden: string, move: string): string {
  const c = new Chess(fen);
  const rook = c.get(hidden as never) as { color: "w" | "b" };
  c.remove(hidden as never);
  c.put({ type: "p", color: rook.color } as never, hidden as never);
  return c.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: "q" }).san;
}

// ---------------- The tests ----------------

test("Smudgy: his tile picks him, his two forced moves, then the splash covers his pawn row, the swap happens under it and the rook hides as a pawn", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (320 px wide on a phone: the banner and the board at their tightest.)
  if (!desktop()) await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish");
  await bossAloneFromHome(page, "Smudgy");
  await yourMove(page);
  await record(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__kinds = [] as string[];
    const look = () => {
      for (const e of w.match?.boss?.powers?.events ?? []) if (!w.__kinds.includes(e.kind)) w.__kinds.push(e.kind);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const first = await state(page);
  expect(first.boss.id).toBe("smudgy");
  // From the starting position (his opening), you White.
  expect(first.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  const start = first.history.length;

  // Your moves, until his two forced moves are played and the swap has come.
  for (let i = 0; i < 4; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers?.camo?.swap) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  const camo = s.boss.powers.camo;
  expect(camo).toMatchObject({ step: 2, off: false });
  const side = camo.side as "a" | "h";
  // His two moves of the battle: the end pawn two squares, then the rook out through the gap.
  const his = s.history.slice(start).filter((_, i) => i % 2 === 1);
  expect(his.slice(0, 2)).toEqual([`${side}7${side}5`, `${side}8${side}6`]);
  // The swap: a real pawn on the rook's square, the rook hidden on one of his pawns' squares.
  expect(camo.swap.rook).toBe(`${side}6`);
  expect(camo.square).toBe(camo.swap.pawn);
  const board = new Chess(s.fen);
  expect(board.get(camo.swap.rook as never)).toMatchObject({ type: "p", color: "b" });
  expect(board.get(camo.square as never)).toMatchObject({ type: "r", color: "b" });
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("camouflage");

  // The moment, every frame: "CAMOUFLAGE!", the blob flies, the splash covers, holds, fades; the swap under the paint.
  const rec = await frames(page);
  expect(inOrder(rec.map((r) => r.camo))).toEqual(["banner", "fly", "cover", "hold", "fade"]);
  expect(rec.some((r) => /CAMOUFLAGE!/.test(r.banner) && /A rook hides among his pawns/.test(r.banner))).toBe(true);
  expect(rec.every((r) => r.bannerIn), "the banner inside the screen").toBe(true);
  // Every square with one of his pawns as the board is drawn now (the rook one of them), whichever pawn hides it.
  const now = await drawn(page);
  expect(now[camo.square]).toBe("bp");
  const pawns = count(now, "bp");
  expect(pawns).toBe(9);
  expect(Math.max(...rec.map((r) => r.covered))).toBe(pawns);
  expect(rec.filter((r) => r.camo === "hold").every((r) => r.covered === pawns)).toBe(true);
  // Before the paint covers it his rook stands where he lifted it; after, the swap is done and nothing shows which pawn it is.
  const before = rec.filter((r) => r.camo === "banner" || r.camo === "fly" || r.camo === "cover");
  expect(before.length).toBeGreaterThan(5);
  expect(before.every((r) => r.pieces[camo.swap.rook] === "br" && r.pieces[camo.square] === "bp")).toBe(true);
  const after = rec.filter((r) => r.camo === "hold" || r.camo === "fade");
  expect(after.length).toBeGreaterThan(1);
  expect(after.every((r) => r.pieces[camo.swap.rook] === "bp" && r.pieces[camo.square] === "bp")).toBe(true);
  // His sounds: the brush's swish and the splash's landing.
  expect(await heard(page)).toEqual(expect.arrayContaining(["smudgySplash", "smudgySwish"]));

  // The masked board: in every frame, the rook's true square shows a pawn of his, and so does the board after.
  expect(rec.filter((r) => r.hidden && r.pieces[r.hidden] === "br").length, "a rook drawn on the hidden square").toBe(0);
  await expectMasked(page, "after the swap");
  // Three more turns: the board drawn is the real position with the rook a pawn, and if the rook stepped (and stayed
  // hidden), the dock named its step as a pawn's, never "R…".
  let prev = camo.square as string | null;
  const named: string[] = [];
  for (let turn = 0; turn < 3 && prev; turn++) {
    await yourMove(page);
    const t = await state(page);
    const mine = quiet(t.fen, t.allowed);
    const after = new Chess(t.fen);
    after.move({ from: mine.slice(0, 2), to: mine.slice(2, 4), promotion: "q" });
    await submitMove(page, mine, t.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
    await yourMove(page);
    const n = await state(page);
    await expectMasked(page, `turn ${turn}`);
    const reply = n.boss.lastMove?.move as string | undefined;
    if (reply && reply.slice(0, 2) === prev && n.boss.powers.camo.square) named.push(pawnName(after.fen(), prev, reply));
    prev = n.boss.powers.camo.square ?? null;
  }
  const log = await frames(page);
  expect(log.filter((r) => r.hidden && r.pieces[r.hidden] === "br").length, "a rook drawn on the hidden square").toBe(0);
  for (const name of named) expect(log.some((r) => r.dock.includes(`Boss plays ${name}`)), `"Boss plays ${name}" shown`).toBe(true);
  expect(errors).toEqual([]);
});

test("Smudgy's hidden rook is drawn as a pawn in every position; a move the board offers and the real board refuses is stopped with his words and picked again; its step is named as a pawn's; its strike shows him for what he is", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug&clock=60&laststand=0&boss=smudgy&paint=1");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);

  // The position: his rook hidden on d7, the d-file open, your king on e1. The board shows a pawn on d7 and one rook (f8).
  const s0 = await state(page);
  const START = "5rk1/pppr1ppp/7p/7p/8/8/PPP2PPP/4K2R w K - 0 1";
  expect(s0.fen).toBe(START);
  expect(s0.boss.powers.camo.square).toBe("d7");
  expect(new Chess(s0.fen).get("d7" as never)).toMatchObject({ type: "r", color: "b" });
  await expectMasked(page, "the start");
  const d0 = await drawn(page);
  expect(d0["d7"]).toBe("bp");
  expect(count(d0, "br")).toBe(1);

  // A tap on your king shows the moves the board you see has: Kd1 and Kd2 too (a pawn on d7 attacks neither).
  await tap(page, "e1");
  expect(await dots(page)).toEqual(["d1", "d2", "e2", "f1", "g1"]);
  // Kd1 is refused (the real board: the rook's file): it stays put, the dock says why, and nothing snapped back.
  await tap(page, "d1");
  await expect(page.locator(".boss-dock .refused-note")).toHaveText(REFUSED.paint);
  expect(REFUSED.paint).toBe("A painted piece stops that move.");
  expect(await phase(page)).toBe("play");
  expect((await state(page)).fen).toBe(START);
  const stayed = await drawn(page);
  expect(stayed["e1"]).toBe("wk");
  expect(stayed["d1"]).toBeUndefined();
  // …and you pick again: Ke2 is played.
  await play(page, "e1e2");
  await expect.poll(() => page.evaluate(() => (window as any).match.boss?.lastMove?.move ?? null), { timeout: 30_000 }).toBe("d7d6");

  // His rook stepped to d6 like a pawn: named "d6", still hidden, drawn a pawn.
  await yourMove(page);
  const s1 = await state(page);
  expect(s1.boss.powers.camo.square).toBe("d6");
  expect(s1.boss.lastMove.san).toBe("d6");
  await expectMasked(page, "after his step");
  let log = await frames(page);
  expect(log.some((r) => /Boss plays d6/.test(r.dock))).toBe(true);
  expect(log.some((r) => /Boss plays R/.test(r.dock))).toBe(false);
  // (Every frame while it hides: his one other rook is the only rook drawn, and none on the hidden square. A frame may still
  // draw the position before his move, the pawn a square behind: no state ahead of the page shows a rook.)
  const leaks = (list: Rec[]) => list.filter((r) => r.hidden && (r.pieces[r.hidden] === "br" || count(r.pieces, "br") !== 1)).map((r) => `${r.kind} hidden ${r.hidden} drawn ${JSON.stringify(r.pieces)} dock "${r.dock}"`);
  expect(leaks(log)).toEqual([]);

  // Browsing the game back, every position: the rook a pawn wherever it stood, and before the swap the board as it was.
  const game = s1.history;
  expect(game).toEqual(["e2e4", "h7h5", "d2d3", "h8h6", "e1e2", "d7d6"]);
  const at = (ply: number) => {
    const c = ply >= 4 ? new Chess(START) : new Chess();
    for (const m of game.slice(ply >= 4 ? 4 : 0, ply)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
    return c.fen();
  };
  const hiddenAt = (ply: number) => (ply < 4 ? null : ply < 6 ? "d7" : "d6");
  const back = page.getByRole("button", { name: "Previous move" }).first();
  for (let ply = game.length - 1; ply >= 0; ply--) {
    await back.click();
    await expect.poll(async () => sorted(await drawn(page)) === sorted(placed(at(ply), hiddenAt(ply))), { message: `ply ${ply}`, timeout: 10_000 }).toBe(true);
  }
  const forward = page.getByRole("button", { name: "Next move" }).first();
  for (let ply = 1; ply <= game.length; ply++) await forward.click();
  await expectMasked(page, "back to the live position");

  // Your second move; his rook strikes down the file (a move no pawn makes): shown as a pawn until his paint drips, then as the rook.
  await play(page, "a2a3");
  await expect.poll(() => page.evaluate(() => (window as any).match.boss?.powers?.camo?.reveal?.how ?? null), { timeout: 30_000 }).toBe("move");
  await yourMove(page);
  const s2 = await state(page);
  expect(s2.boss.lastMove.move).toBe("d6d2");
  expect(s2.boss.powers.camo.square).toBeNull();
  expect(s2.boss.powers.camo.reveal).toMatchObject({ how: "move", square: "d2" });
  await expectMasked(page, "after the strike");
  expect((await drawn(page))["d2"]).toBe("br");
  log = await frames(page);
  const unmask = log.filter((r) => r.unmask);
  expect(inOrder(unmask.map((r) => r.unmask))).toEqual(["pawn", "rook"]);
  expect(during(log, "unmask", "pawn").every((r) => r.pieces["d2"] === "bp")).toBe(true);
  expect(during(log, "unmask", "rook").length).toBeGreaterThan(0);
  expect(during(log, "unmask", "rook").every((r) => r.pieces["d2"] === "br")).toBe(true);
  // (Not named before the drip: the dock says "…", then his words for it.)
  expect(log.filter((r) => r.unmask === "pawn").some((r) => /Rd2|Boss plays R/.test(r.dock))).toBe(false);
  expect(log.some((r) => /His pawn was a rook!/.test(r.dock))).toBe(true);
  expect(await heard(page)).toContain("smudgyDrip");

  expect(errors).toEqual([]);
});

test("Smudgy's hidden rook taken: stepped like a pawn, named as one, then your rook takes it: \"That was his rook!\", a drip, and the real board", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug&clock=60&laststand=0&boss=smudgy&paint=2");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  // Ke2 (his rook steps to d6), Rd1 (it steps to d5, in your rook's file): named as pawns' steps, the rook a pawn throughout.
  await play(page, "e1e2");
  await expect.poll(() => page.evaluate(() => (window as any).match.boss?.lastMove?.move ?? null), { timeout: 30_000 }).toBe("d7d6");
  await play(page, "h1d1");
  await expect.poll(() => page.evaluate(() => (window as any).match.boss?.lastMove?.move ?? null), { timeout: 30_000 }).toBe("d6d5");
  await yourMove(page);
  const s = await state(page);
  expect(s.boss.powers.camo.square).toBe("d5");
  await expectMasked(page, "before the capture");
  let log = await frames(page);
  expect(log.some((r) => /Boss plays d6/.test(r.dock)) && log.some((r) => /Boss plays d5/.test(r.dock))).toBe(true);
  expect(log.some((r) => /Boss plays R/.test(r.dock))).toBe(false);
  // Your rook takes the pawn on d5 (the board you see: a pawn; the game: his rook).
  await tap(page, "d1");
  expect(await dots(page)).toContain("d5");
  await tap(page, "d1");
  await play(page, "d1d5");
  await expect.poll(async () => (await frames(page)).some((r) => r.taken === "d5"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await frames(page)).some((r) => /That was his rook!/.test(r.dock)), { timeout: 20_000 }).toBe(true);
  // The drip comes 150 ms into the moment (SMUDGY_BEATS.rookTaken.dripAt), the dock's words from its start: watched for
  // until the moment is over (POWER_FX.rookTaken, 1200 ms), not read the instant the words show (PR #300's CI read it
  // in the moment's first frame: the frames recorded stop there).
  await expect.poll(() => heard(page), { timeout: 2_000 }).toContain("smudgyDrip");
  await yourMove(page);
  const t = await state(page);
  expect(t.boss.powers.camo.square).toBeNull();
  expect(t.boss.powers.camo.reveal).toMatchObject({ how: "taken", square: "d5" });
  // Nothing hidden now: the board is the real one, with one black rook (f8, or wherever it is) and his rook gone.
  await expectMasked(page, "after the rook is taken");
  log = await frames(page);
  expect(log.filter((r) => r.hidden && r.pieces[r.hidden] === "br").length, "a rook drawn on the hidden square").toBe(0);
  expect(errors).toEqual([]);
});

test("Smudgy's Repaint: REPAINT!, a cream stroke on his pawn's square then a charcoal one on your piece's, each piece changing color under its stroke", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug&clock=60&laststand=0&brain=stockfish&boss=smudgy&power=repaint");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  // Quiet moves (never onto his pawns' files' first squares) until the Repaint has been played.
  for (let turn = 0; turn < 14; turn++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.repaints > 0) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  expect(s.boss.powers.repaints).toBeGreaterThan(0);
  const rp = s.boss.powers.repaint as { pawn: string; piece: string; type: string };
  const rec = await frames(page);
  expect(inOrder(rec.map((r) => r.repaint))).toEqual(["banner", "first", "second"]);
  expect(rec.some((r) => /REPAINT!/.test(r.banner) && r.banner.includes(`${rp.pawn} and ${rp.piece} change sides`))).toBe(true);
  expect(rec.every((r) => r.bannerIn), "the banner inside the screen").toBe(true);
  // Cream stroke first: his pawn becomes yours; then the charcoal one: your piece becomes his.
  const mine = "w" + rp.type;
  const his = "b" + rp.type;
  expect(during(rec, "repaint", "banner").every((r) => r.pieces[rp.pawn] === "bp" && r.pieces[rp.piece] === mine)).toBe(true);
  expect(during(rec, "repaint", "first").length).toBeGreaterThan(0);
  expect(during(rec, "repaint", "first").every((r) => r.pieces[rp.pawn] === "wp" && r.pieces[rp.piece] === mine)).toBe(true);
  expect(during(rec, "repaint", "second").every((r) => r.pieces[rp.pawn] === "wp" && r.pieces[rp.piece] === his)).toBe(true);
  // His turn was the Repaint: the dock says so (no move to name), his brush swished at each stroke.
  expect(rec.some((r) => r.dock.includes("Smudgy spent his turn repainting."))).toBe(true);
  expect((await heard(page)).filter((n) => n === "smudgySwish").length).toBeGreaterThanOrEqual(2);
  await expectMasked(page, "after the Repaint");
  expect(errors).toEqual([]);
});

test("Smudgy at 320, 360, 390 and 1280 px: his figure whole in the bar, his longest lines whole and in view in his text box, no sideways scroll", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (His three lines over 42 characters: the entrance lines "Every chameleon blends in. I'd rather stand out." and
  // "Hold still. I'm painting you into a corner.", and his king attack's "Hold still, your majesty. You need a touch-up.")
  const LONG = ["Every chameleon blends in. I'd rather stand out.", "Hold still. I'm painting you into a corner.", "Hold still, your majesty. You need a touch-up."];
  const sizes = desktop() ? [[1280, 800]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/?debug&clock=60&laststand=0&boss=smudgy&paint=1");
    await bossAloneFromHome(page);
    // His entrance line is up for a few seconds: copies of its box with each long line in it, placed as it is.
    const fits = await page.locator(".bc-bubble:visible").first().evaluate((el, lines) => {
      const keepOff = [".board-row .hb-container", ".boss-next", ".boss-dock-status"];
      return lines.map((line) => {
        const c = el.cloneNode(true) as HTMLElement;
        c.textContent = line;
        c.classList.remove("leaving");
        el.parentElement!.appendChild(c);
        const r = c.getBoundingClientRect();
        const over = keepOff.filter((s) =>
          [...document.querySelectorAll<HTMLElement>(s)].some((o) => {
            const b = o.getBoundingClientRect();
            return b.width > 0 && Math.min(r.right, b.right) - Math.max(r.left, b.left) > 1 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1;
          }),
        );
        c.remove();
        return { line, left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), over, tall: Math.round(r.height) };
      });
    }, LONG);
    for (const f of fits) {
      expect(f.left, `${w}: "${f.line}"`).toBeGreaterThanOrEqual(0);
      expect(f.top, `${w}: "${f.line}"`).toBeGreaterThanOrEqual(0);
      expect(f.right, `${w}: "${f.line}"`).toBeLessThanOrEqual(w!);
      expect(f.bottom, `${w}: "${f.line}"`).toBeLessThanOrEqual(h!);
      expect(f.over, `${w}: "${f.line}" over ${f.over}`).toEqual([]);
    }
    await yourMove(page);
    // His figure, whole inside the screen (the bar's on a phone, beside the board on a computer): the drawn pixels of his
    // canvas, not its transparent frame (which every boss's hangs a few pixels out past the edge).
    const fig = await page.locator(".boss-char canvas:visible").first().evaluate((c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect();
      const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, maxX = -1, minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3]! > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const k = r.width / c.width;
      return { left: r.left + minX * k, right: r.left + (maxX + 1) * k, top: r.top + minY * k, bottom: r.top + (maxY + 1) * k, seen: maxX >= 0 };
    });
    expect(fig.seen, `${w}: his figure is drawn`).toBe(true);
    expect(fig.left, `${w}`).toBeGreaterThanOrEqual(0);
    expect(fig.right, `${w}`).toBeLessThanOrEqual(w!);
    expect(fig.top, `${w}`).toBeGreaterThanOrEqual(0);
    expect(fig.right - fig.left, `${w}: a figure big enough to see`).toBeGreaterThan(30);
    expect(await sideways(page), `${w}`).toBe(0);
    await expectMasked(page, `${w}`);
  }
  expect(errors).toEqual([]);
});
