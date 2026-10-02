import { expect, test, type Page } from "@playwright/test";

/** Clicks a move on the main board (tap the piece, then the target square). */
async function clickMove(page: Page, uci: string) {
  const wrap = page.locator(".board-area .cg-wrap").first();
  const box = (await wrap.boundingBox())!;
  const black = ((await wrap.getAttribute("class")) ?? "").includes("orientation-black");
  const at = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    const x = black ? 7 - f : f;
    const y = black ? r : 7 - r;
    return { x: box.x + ((x + 0.5) * box.width) / 8, y: box.y + ((y + 0.5) * box.height) / 8 };
  };
  const from = at(uci.slice(0, 2));
  const to = at(uci.slice(2, 4));
  await page.mouse.click(from.x, from.y);
  await page.mouse.click(to.x, to.y);
  if (uci.length === 5) await page.getByRole("button", { name: "Queen" }).click();
}

/** The engine's best move for the position on screen (debug hook). */
async function bestMove(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const m = (window as any).match;
    const fen = m.phase.kind === "duel" ? m.phase.duel.fen : m.phase.board.fen;
    const [top] = await m.engines[0].topMoves(fen, 1);
    return top.move;
  });
}

async function phase(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).match?.phase.kind ?? "none");
}

async function start(page: Page, query: string) {
  await page.goto(`/?debug&${query}`);
  await page.getByLabel("Your name").fill("Tester");
  await page.getByRole("button", { name: /Play solo/ }).click();
  await expect(page.getByRole("heading", { name: "Today's openings" })).toBeVisible();
}

test("strong play survives every stage, reaches the duel, and sees results", async ({ page }) => {
  await start(page, "rounds=1&clock=20&duel=30");
  for (let i = 0; i < 400; i++) {
    const p = await phase(page);
    if (p === "results") break;
    if (p === "play") {
      await clickMove(page, await bestMove(page));
      await expect.poll(() => phase(page)).not.toBe("play");
    } else if (p === "reveal") {
      await page.waitForTimeout(1900);
      await page.locator(".screen").click();
    } else if (p === "stageBreak") {
      await expect(page.locator(".standings li").first()).toBeVisible();
      await page.getByRole("button", { name: /Next stage|See how it ends/ }).click();
    } else if (p === "duelColour") {
      await page.getByRole("button", { name: "Play White" }).click();
    } else if (p === "duel") {
      const over = await page.evaluate(() => !!(window as any).match.phase.duel.over);
      if (over) {
        await page.getByRole("button", { name: "Results" }).click();
      } else {
        await page.getByRole("button", { name: "Resign" }).waitFor();
        page.once("dialog", (d) => d.accept());
        await page.getByRole("button", { name: "Resign" }).click();
      }
    } else {
      await page.waitForTimeout(200);
    }
  }
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(page.locator(".results h1")).toContainText(/of 32/);
});

test("missing every move gets you knocked out; the match plays out and shows results", async ({ page }) => {
  await start(page, "rounds=2&clock=3");
  for (let i = 0; i < 200; i++) {
    const p = await phase(page);
    if (p === "results") break;
    if (p === "reveal") {
      await expect(page.locator(".round-score")).toContainText("-25");
      await page.waitForTimeout(1900);
      await page.locator(".screen").click();
    } else if (p === "stageBreak") {
      await expect(page.locator(".out-msg")).toBeVisible();
      await page.getByRole("button", { name: "See how it ends" }).click();
    } else {
      await page.waitForTimeout(250);
    }
  }
  await expect(page.locator(".results h1")).toContainText(/(25|26|27|28|29|30|31|32)(st|nd|rd|th) of 32/);
});
