import { expect, test } from "@playwright/test";
const FEN = "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 6 8";
test("castling registers by tap-tap and by drag", async ({ page }, info) => {
  await page.goto("/?debug");
  await page.getByLabel("Your name").fill("T");
  await page.getByRole("button", { name: /Play solo/ }).click();
  await page.waitForFunction(() => (window as any).match?.phase.kind === "play", null, { timeout: 20000 });
  await page.evaluate((fen) => {
    const m = (window as any).match;
    clearTimeout(m.timer);
    (window as any).picked = [];
    m.submit = (mv: string) => (window as any).picked.push(mv);
    m.hint = [{ move: "e1g1", san: "O-O", expected: 0.55 }, { move: "a2a3", san: "a3", expected: 0.52 }, { move: "h2h3", san: "h3", expected: 0.51 }];
    const board = { id: 99, generation: 0, ply: 30, fen, lastMove: null, openingName: "Castle test", recent: [], recentFrom: fen };
    m.set({ kind: "play", board, deadline: Date.now() + 60000, allowedMs: 60000 });
  }, FEN);
  await page.waitForTimeout(500);
  const wrap = page.locator(".board-area .cg-wrap").first();
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
    const board = { id: 98, generation: 0, ply: 30, fen, lastMove: null, openingName: "Castle test", recent: [], recentFrom: fen };
    m.set({ kind: "play", board, deadline: Date.now() + 60000, allowedMs: 60000 });
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
