import { expect, type Page } from "@playwright/test";
import { CROWD_SCORING } from "@chessroyale/core";
import { legalMoves } from "@chessroyale/chess";
import { BOARD_SEL, named, soloFromHome, submitMove, test, watchFor } from "./helpers.ts";

/**
 * 50 v 50's scoring on screen (docs/decisions/2026-10-24-crowd-scoring.md): the scoreboard's fire from 3 strong moves
 * in a row, a badge on the rank square (every tier, names as wide as without it, no row taller, nothing cut short, at
 * 320, 360, 390, 428 and 1280), still under reduced motion; the rare brilliant find's
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

/**
 * Every shown tower row: its height, its name cell's width, the fire's box and tier on the rank square (inside the row,
 * clear of the rank and of the name's cell), and whether its points spill; and the header's gap between "Player" and "Pts".
 */
const rows = (page: Page, scope: string) =>
  page.evaluate((scope) => {
    const list = [...document.querySelectorAll<HTMLElement>(`${scope} .tower-row:not(.out)`)].map((row) => {
      const r = row.getBoundingClientRect();
      const fire = row.querySelector<HTMLElement>(".streak-fire");
      const f = fire?.getBoundingClientRect();
      const n = row.querySelector<HTMLElement>(".t-name")!.getBoundingClientRect();
      const rank = row.querySelector<HTMLElement>(".t-rank")!.getBoundingClientRect();
      const pts = row.querySelector<HTMLElement>(".t-pts")!;
      return {
        id: row.querySelector(".t-name-text")?.textContent ?? "",
        you: row.classList.contains("you"),
        height: Math.round(r.height),
        name: Math.round(n.width * 10) / 10,
        fire:
          fire && f
            ? {
                count: fire.querySelector(".sf-count")!.textContent,
                tier: [...fire.classList].find((c) => /^t\d$/.test(c)) ?? null,
                onRank: !!fire.closest(".t-pos"),
                inRow: f.top >= r.top - 0.5 && f.bottom <= r.bottom + 0.5,
                clear: f.right <= n.left + 0.5 && f.left >= rank.right - 0.5,
                anim: getComputedStyle(fire.querySelector("svg")!).animationName,
              }
            : null,
        ptsSpill: pts.scrollWidth - pts.clientWidth,
      };
    });
    const [, player, pts] = [...document.querySelectorAll<HTMLElement>(`${scope} .tower-head span`)];
    const range = document.createRange();
    range.selectNodeContents(player!);
    const right = range.getBoundingClientRect().right;
    range.selectNodeContents(pts!);
    return { list, headGap: range.getBoundingClientRect().left - right };
  }, scope);

/** The test switch's streaks (?streaks=1: 3 to 9 in a row by seat), on or off, and the scoreboard redrawn. */
const streaks = (page: Page, on: boolean) =>
  page.evaluate((on) => {
    const m = (window as any).match;
    m.runner.state.players.forEach((p: any, i: number) => (p.streak = on ? 3 + (i % 7) : undefined));
    m.emit();
  }, on);

/**
 * One scoreboard checked: rows one height, no points spilling, every fire on its rank square, inside its row and clear of
 * the rank and the name; the header's labels apart; and each name's cell as wide with the fires as without them.
 */
async function checkTower(page: Page, scope: string, label: string) {
  const { list, headGap } = await rows(page, scope);
  expect(new Set(list.map((r) => r.height)).size, label).toBe(1);
  expect(headGap, `${label}: "Player" runs into "Pts"`).toBeGreaterThanOrEqual(4);
  for (const r of list) {
    expect(r.ptsSpill, label).toBeLessThanOrEqual(0);
    if (r.fire) expect(r.fire, `${label}: ${r.id}`).toMatchObject({ onRank: true, inRow: true, clear: true });
  }
  expect(list.filter((r) => r.fire).length, label).toBeGreaterThan(0);
  await streaks(page, false);
  await expect(page.locator(`${scope} .streak-fire`)).toHaveCount(0);
  const bare = (await rows(page, scope)).list;
  expect(bare.map((r) => r.name), `${label}: a name's room with and without the fire`).toEqual(list.map((r) => r.name));
  await streaks(page, true);
  await expect(page.locator(`${scope} .streak-fire`).first()).toBeVisible();
  return list;
}

test("the scoreboard's fire from 3 in a row on the rank square: every tier, names keep their room, steady rows, nothing cut short; still under reduced motion", async ({ page, browser }) => {
  test.setTimeout(4 * 60_000);
  await sized(page);
  await named(page, "Maximilian Wolfe");
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0&streaks=1");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  // The longest real names (a 100-player lobby numbers them) and the widest scores the scoreboard shows (2 decimals).
  await page.evaluate(() => {
    const m = (window as any).match;
    m.runner.state.players.forEach((p: any, i: number) => {
      if (p.isBot) p.name = "Queen's Gambit Quinn 2";
      p.stageScore = -45.67 + (i % 50) * 1.73;
    });
    m.emit();
  });
  const phone = test.info().project.name === "phone";
  // A phone: the scoreboard under the board, then all of it in the leaderboard sheet. A computer: the tower beside it.
  const scope = phone ? ".mini-tower" : ".tower-side";
  await expect(page.locator(`${scope} .tower-row.you .streak-fire`)).toBeVisible();
  const mine = (await rows(page, scope)).list.find((r) => r.you)!;
  expect(mine.fire).toMatchObject({ count: String(CROWD_SCORING.streakFrom), tier: "t1", onRank: true, anim: "sf-flicker" });
  for (const width of phone ? [320, 360, 390, 428] : [1280]) {
    if (phone) await page.setViewportSize({ width, height: 640 });
    await checkTower(page, scope, `${width}px, scoreboard`);
    if (shots && width === (phone ? 320 : 1280)) await page.locator(scope).first().screenshot({ path: `${shots}/tower-${test.info().project.name}.png` });
    if (!phone) {
      const all = (await rows(page, scope)).list;
      expect(new Set(all.map((r) => r.fire?.tier))).toEqual(new Set(["t1", "t2", "t3"]));
      if (shots) await page.locator(scope).first().screenshot({ path: `${shots}/tiers-${test.info().project.name}.png` });
      continue;
    }
    await page.locator(".mini-tower-title").click();
    await expect(page.locator(".tower-sheet")).toBeVisible();
    const all = await checkTower(page, ".tower-sheet", `${width}px, the leaderboard sheet`);
    expect(new Set(all.map((r) => r.fire?.tier))).toEqual(new Set(["t1", "t2", "t3"]));
    if (shots && width === 320) await page.locator(".tower-sheet").first().screenshot({ path: `${shots}/tiers-${test.info().project.name}.png` });
    await page.locator(".tower-close").click();
    await expect(page.locator(".tower-sheet")).toHaveCount(0);
  }

  // Reduced motion (and the dark theme): the same fire, standing still.
  const still = await (await browser.newContext({ ...test.info().project.use, reducedMotion: "reduce", colorScheme: "dark" } as any)).newPage();
  await sized(still);
  await named(still, "Maximilian Wolfe");
  await still.goto("/?debug&pace=quick&mode=crowd&augments=0&streaks=1");
  await soloFromHome(still);
  await expect(still.locator(`${scope} .tower-row.you .streak-fire`)).toBeVisible({ timeout: 60_000 });
  expect((await rows(still, scope)).list.find((r) => r.you)!.fire?.anim).toBe("none");
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
  // (Nov 1: the brilliant find is a mark on its bar, "‼ +1": its text is that, and the .you class says it names you.)
  const seen = await watchFor(page, { shout: { selector: ".brilliant-line.shoutout.you", text: /‼\s*\+1/ } });
  await submitMove(page, legalMoves(fen)[0], fen);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("reveal");
  await expect.poll(async () => (await seen.seen()).shout, { timeout: 20_000 }).toBe(true);
  const you = await page.evaluate(() => {
    const m = (window as any).match;
    const r = m.phase.mine.result;
    return { bonus: r.players.find((p: any) => m.isYou(p.playerId))?.brilliantBonus, named: r.brilliant?.players.some((id: string) => m.isYou(id)) };
  });
  expect(you).toEqual({ bonus: CROWD_SCORING.brilliantBonus, named: true });
  // (The banner's whole line shows: the mark, the names, the bonus, inside the panel, all through its entrance.)
  const entrance = await page.evaluate(
    () =>
      new Promise<number[]>((done) => {
        const lefts: number[] = [];
        const t0 = performance.now();
        const look = () => {
          const line = document.querySelector(".brilliant-line.shoutout");
          if (line) lefts.push(line.getBoundingClientRect().left - line.closest(".poll")!.getBoundingClientRect().left);
          if (performance.now() - t0 < 400 && line) requestAnimationFrame(look);
          else done(lefts);
        };
        look();
      }),
  );
  expect(Math.min(...entrance), entrance.join(" ")).toBeGreaterThanOrEqual(-0.5);
  const banner = await page.evaluate(() => {
    const line = document.querySelector(".brilliant-line.shoutout");
    if (!line) return null;
    const mark = line.querySelector(".brilliant-mark")!.getBoundingClientRect();
    const box = line.getBoundingClientRect();
    const poll = line.closest(".poll")!.getBoundingClientRect();
    return { mark: Math.round(mark.width), spill: line.scrollWidth - line.clientWidth, inside: box.left >= poll.left - 0.5 && box.right <= poll.right + 0.5 && mark.left >= box.left, onScreen: box.left >= 0 && box.right <= window.innerWidth + 0.5, box: [box.left, box.right, poll.left, poll.right, mark.left] };
  });
  if (banner) expect(banner, JSON.stringify(banner?.box)).toMatchObject({ spill: 0, inside: true, onScreen: true });
  if (banner) expect(banner.mark).toBeGreaterThan(0);
  if (shots && (await page.locator(".brilliant-line.shoutout").isVisible())) await page.locator(".poll").first().screenshot({ path: `${shots}/shoutout-${test.info().project.name}.png` }).catch(() => undefined);
  const after = await boardBox(page);
  expect(after).toEqual(before);
});
