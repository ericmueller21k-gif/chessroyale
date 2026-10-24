import { expect, type Page } from "@playwright/test";
import { CROWD_SCORING } from "@chessroyale/core";
import { legalMoves } from "@chessroyale/chess";
import { BOARD_SEL, named, soloFromHome, submitMove, test, watchFor } from "./helpers.ts";

/**
 * 50 v 50's scoring on screen (docs/decisions/2026-10-24-crowd-scoring.md): the scoreboard's fire from 3 strong moves
 * in a row (every tier, no row taller, nothing cut short), still under reduced motion; the rare brilliant find's
 * shoutout naming you, with its bonus in your score; neither moves the board. A phone at 320 px and a computer at 1280.
 * Test switches: ?streaks=1 (everyone on a streak, 3 to 9 in a row by seat; yours 3) and ?shoutout=1 (your first move
 * gets a shoutout). SHOTS_DIR, when set, keeps a still of each for review.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const shots = process.env.SHOTS_DIR;

/** A phone at its narrowest (320 px), or the computer project's own 1280 × 800. */
async function sized(page: Page) {
  if (test.info().project.name === "phone") await page.setViewportSize({ width: 320, height: 640 });
}

/** The board's box on screen. */
const boardBox = (page: Page) => page.locator(`.board-area ${BOARD_SEL.wrap}`).first().boundingBox();

/** Every shown tower row: its height, the fire's box and tier in it, and whether its name or points spill. */
const rows = (page: Page, scope: string) =>
  page.evaluate((scope) => {
    return [...document.querySelectorAll<HTMLElement>(`${scope} .tower-row:not(.out)`)].map((row) => {
      const r = row.getBoundingClientRect();
      const fire = row.querySelector<HTMLElement>(".streak-fire");
      const f = fire?.getBoundingClientRect();
      const name = row.querySelector<HTMLElement>(".t-name")!;
      const n = name.getBoundingClientRect();
      const pts = row.querySelector<HTMLElement>(".t-pts")!;
      return {
        you: row.classList.contains("you"),
        height: Math.round(r.height),
        fire: fire && f ? { count: fire.querySelector(".sf-count")!.textContent, tier: [...fire.classList].find((c) => /^t\d$/.test(c)) ?? null, inRow: f.top >= r.top - 0.5 && f.bottom <= r.bottom + 0.5, inName: f.right <= n.right + 0.5, anim: getComputedStyle(fire.querySelector("svg")!).animationName } : null,
        ptsSpill: pts.scrollWidth - pts.clientWidth,
      };
    });
  }, scope);

test("the scoreboard's fire from 3 in a row: every tier, steady rows, nothing cut short; still under reduced motion", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  await sized(page);
  await named(page, "Maximilian Wolfe");
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0&streaks=1");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  // The widest scores the scoreboard shows (2 decimals), on every row.
  await page.evaluate(() => {
    const m = (window as any).match;
    m.runner.state.players.forEach((p: any, i: number) => (p.stageScore = -45.67 + (i % 50) * 1.73));
    m.emit();
  });
  const phone = test.info().project.name === "phone";
  // A phone: the scoreboard under the board, then all of it in the leaderboard sheet. A computer: the tower beside it.
  const scope = phone ? ".mini-tower" : ".tower-side";
  await expect(page.locator(`${scope} .tower-row.you .streak-fire`)).toBeVisible();
  const mine = (await rows(page, scope)).find((r) => r.you)!;
  expect(mine.fire).toMatchObject({ count: String(CROWD_SCORING.streakFrom), tier: "t1", inRow: true, inName: true, anim: "sf-flicker" });
  if (shots) await page.locator(scope).first().screenshot({ path: `${shots}/tower-${test.info().project.name}.png` });
  if (phone) {
    await page.locator(".mini-tower-title").click();
    await expect(page.locator(".tower-sheet")).toBeVisible();
  }
  const all = await rows(page, phone ? ".tower-sheet" : scope);
  expect(new Set(all.map((r) => r.fire?.tier))).toEqual(new Set(["t1", "t2", "t3"]));
  // Every row the same height, with a fire or without; the fire inside its row and name cell; no points cut short.
  expect(new Set(all.map((r) => r.height)).size).toBe(1);
  for (const r of all) {
    expect(r.ptsSpill).toBeLessThanOrEqual(0);
    if (r.fire) expect(r.fire).toMatchObject({ inRow: true, inName: true });
  }
  if (shots) await page.locator(phone ? ".tower-sheet" : scope).first().screenshot({ path: `${shots}/tiers-${test.info().project.name}.png` });

  // Reduced motion (and the dark theme): the same fire, standing still.
  const still = await (await browser.newContext({ ...test.info().project.use, reducedMotion: "reduce", colorScheme: "dark" } as any)).newPage();
  await sized(still);
  await named(still, "Maximilian Wolfe");
  await still.goto("/?debug&pace=quick&mode=crowd&augments=0&streaks=1");
  await soloFromHome(still);
  await expect(still.locator(`${scope} .tower-row.you .streak-fire`)).toBeVisible({ timeout: 60_000 });
  expect((await rows(still, scope)).find((r) => r.you)!.fire?.anim).toBe("none");
  if (shots) await still.locator(scope).first().screenshot({ path: `${shots}/tower-dark-${test.info().project.name}.png` });
});

test("a rare brilliant find: the shoutout names you, its bonus is in your score, and the board doesn't move", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await sized(page);
  await named(page, "Maximilian Wolfe");
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0&shoutout=1");
  await soloFromHome(page);
  // Your first move (the other team's comes first when you play Black).
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind === "play" && Date.now() > (window as any).match.phase.startsAt + 200).catch(() => false), { timeout: 90_000 }).toBe(true);
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const before = await boardBox(page);
  const seen = await watchFor(page, { shout: { selector: ".brilliant-line.shoutout.you", text: /Brilliant find! You found .+ · \+1/ } });
  await submitMove(page, legalMoves(fen)[0], fen);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("reveal");
  await expect.poll(async () => (await seen.seen()).shout, { timeout: 20_000 }).toBe(true);
  const you = await page.evaluate(() => {
    const m = (window as any).match;
    const r = m.phase.mine.result;
    return { bonus: r.players.find((p: any) => m.isYou(p.playerId))?.brilliantBonus, named: r.brilliant?.players.some((id: string) => m.isYou(id)) };
  });
  expect(you).toEqual({ bonus: CROWD_SCORING.brilliantBonus, named: true });
  // (The banner's whole line shows: the mark, the names, the bonus, inside the panel.)
  const banner = await page.evaluate(() => {
    const line = document.querySelector(".brilliant-line.shoutout");
    if (!line) return null;
    const mark = line.querySelector(".brilliant-mark")!.getBoundingClientRect();
    return { mark: Math.round(mark.width), spill: line.scrollWidth - line.clientWidth, right: line.getBoundingClientRect().right <= window.innerWidth + 0.5 };
  });
  if (banner) expect(banner).toMatchObject({ spill: 0, right: true });
  if (banner) expect(banner.mark).toBeGreaterThan(0);
  if (shots && (await page.locator(".brilliant-line.shoutout").isVisible())) await page.locator(".poll").first().screenshot({ path: `${shots}/shoutout-${test.info().project.name}.png` }).catch(() => undefined);
  const after = await boardBox(page);
  expect(after).toEqual(before);
});
