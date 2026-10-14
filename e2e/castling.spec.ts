import { expect, test } from "@playwright/test";
import { BOARD_SEL, soloFromHome } from "./helpers.ts";
const FEN = "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 6 8";
test("castling registers by tap-tap and by drag", async ({ page }, info) => {
  await page.goto("/?debug&mode=classic");
  await soloFromHome(page);
  await page.waitForFunction(() => (window as any).match?.phase.kind === "play", null, { timeout: 20000 });
  await page.evaluate((fen) => {
    const m = (window as any).match;
    clearTimeout(m.timer);
    (window as any).picked = [];
    m.submit = (mv: string) => (window as any).picked.push(mv);
    m.hint = [{ move: "e1g1", san: "O-O", expected: 0.55 }, { move: "a2a3", san: "a3", expected: 0.52 }, { move: "h2h3", san: "h3", expected: 0.51 }];
    const board = { id: 99, generation: 0, ply: 30, fen, lastMove: null, openingName: "Castle test", recent: [], recentFrom: fen, history: [] };
    m.set({ kind: "play", board, startsAt: Date.now() - 1, deadline: Date.now() + 60000, allowedMs: 60000 });
  }, FEN);
  await page.waitForTimeout(500);
  const wrap = page.locator(`.board-area ${BOARD_SEL.wrap}`).first();
  const box = (await wrap.boundingBox())!;
  const at = (sq: string) => ({ x: box.x + (sq.charCodeAt(0) - 97 + 0.5) * box.width / 8, y: box.y + (8 - Number(sq[1]) + 0.5) * box.height / 8 });
  // Tap-tap castling.
  await page.mouse.click(at("e1").x, at("e1").y);
  await page.mouse.click(at("g1").x, at("g1").y);
  await page.waitForTimeout(300);
  const tap = await page.evaluate(() => (window as any).picked);
  console.log(info.project.name, "tap:", JSON.stringify(tap));
  expect(tap).toEqual(["e1g1"]);
  // Drag castling, on a fresh board.
  await page.evaluate((fen) => {
    const m = (window as any).match;
    (window as any).picked = [];
    const board = { id: 98, generation: 0, ply: 30, fen, lastMove: null, openingName: "Castle test", recent: [], recentFrom: fen, history: [] };
    m.set({ kind: "play", board, startsAt: Date.now() - 1, deadline: Date.now() + 60000, allowedMs: 60000 });
  }, FEN);
  await page.waitForTimeout(500);
  await page.mouse.move(at("e1").x, at("e1").y);
  await page.mouse.down();
  await page.mouse.move(at("f1").x, at("f1").y, { steps: 5 });
  await page.mouse.move(at("g1").x, at("g1").y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const drag = await page.evaluate(() => (window as any).picked);
  console.log(info.project.name, "drag:", JSON.stringify(drag));
  expect(drag).toEqual(["e1g1"]);
});

// Chess960 (DECISIONS.md, "Chess960's rules"): castling is written as the king taking its own rook (b1h1), and the
// board takes it either way: the king onto its rook, or onto the square it castles to where nothing else goes there.
test("Chess960 castling registers onto the rook and onto its square, by tap-tap and by drag", async ({ page }, info) => {
  await page.goto("/?debug&mode=classic");
  await soloFromHome(page);
  await page.waitForFunction(() => (window as any).match?.phase.kind === "play", null, { timeout: 20000 });
  const show = (fen: string) =>
    page.evaluate((f) => {
      const m = (window as any).match;
      clearTimeout(m.timer);
      (window as any).picked = [];
      m.submit = (mv: string) => (window as any).picked.push(mv);
      m.hint = [];
      const board = { id: 97 + Math.random(), generation: 0, ply: 30, fen: f, lastMove: null, openingName: "Chess960 test", recent: [], recentFrom: f, history: [] };
      m.set({ kind: "play", board, startsAt: Date.now() - 1, deadline: Date.now() + 60000, allowedMs: 60000 });
    }, fen);
  const picked = async () => {
    await page.waitForTimeout(300);
    return page.evaluate(() => (window as any).picked);
  };
  const wrap = page.locator(`.board-area ${BOARD_SEL.wrap}`).first();
  const at = async (sq: string) => {
    const box = (await wrap.boundingBox())!;
    return { x: box.x + ((sq.charCodeAt(0) - 97 + 0.5) * box.width) / 8, y: box.y + ((8 - Number(sq[1]) + 0.5) * box.height) / 8 };
  };
  const tap = async (sq: string) => {
    const p = await at(sq);
    await page.mouse.click(p.x, p.y);
  };
  const drag = async (from: string, to: string) => {
    const a = await at(from);
    const b = await at(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
  };
  // King b1 between rooks a1 and h1.
  const open = "r5kr/pppppppp/8/8/8/8/PPPPPPPP/RK5R w HAha - 0 1";
  const cases: [string, () => Promise<void>, string][] = [
    [open, () => tap("b1").then(() => tap("h1")), "b1h1"],
    [open, () => drag("b1", "h1"), "b1h1"],
    [open, () => drag("b1", "g1"), "b1h1"],
    [open, () => drag("b1", "a1"), "b1a1"],
    // c1 is the king's ordinary step here, so dragging there steps.
    [open, () => drag("b1", "c1"), "b1c1"],
    // King e1, its short rook on g1 (where the king lands) and its long rook on d1 (where that rook lands).
    ["bbnrk1rq/pp2p1pp/2ppn3/5p2/8/3NNP1P/PPPPP1P1/BB1RK1RQ w GDgd - 0 1", () => drag("e1", "c1"), "e1d1"],
    ["bbnrk1rq/pp2p1pp/2ppn3/5p2/8/3NNP1P/PPPPP1P1/BB1RK1RQ w GDgd - 0 1", () => tap("e1").then(() => tap("g1")), "e1g1"],
  ];
  for (const [fen, gesture, want] of cases) {
    await show(fen);
    await page.waitForTimeout(400);
    await gesture();
    const got = await picked();
    console.log(info.project.name, want, JSON.stringify(got));
    expect(got).toEqual([want]);
  }
  // The move stays on the board as played: the king on g1, the rook beside it on f1.
  await expect(page.locator(`.board-area ${BOARD_SEL.wrap} piece.white.king`).first()).toHaveAttribute("data-square", "g1");
  await expect(page.locator(`.board-area ${BOARD_SEL.wrap} piece.white.rook[data-square="f1"]`)).toHaveCount(1);
});
