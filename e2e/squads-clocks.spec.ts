import { expect, type Page } from "@playwright/test";
import { SQUADS } from "@chessroyale/core";
import { clockLabel, matchClockLine, teamClockDetail, teamClockLine } from "@chessroyale/chess/squads";
import { named, test, watchFor } from "./helpers.ts";

/**
 * Squads' three chess time controls (Eric, Oct 13; DECISIONS.md, "Squads: three chess time controls") through the real
 * server (wrangler dev, SQUADS_TEST on): the Clock vote's cards (Bullet, Blitz and Rapid in chess form, their numbers
 * from settings) whole on a 320 px phone; the winner, said in full as the vote ends, is the lobby's clock: on the first
 * match's card, and each move's deadline is its cap; the clock line under the board fits a 320 px phone too.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** No sideways scroll, and every element matching `selector` whole: its text inside its box and inside the screen. */
async function whole(page: Page, selector: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  const cut = await page.locator(selector).evaluateAll((els) =>
    els.flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return [];
      const out = el.scrollWidth > el.clientWidth + 0.5 || r.left < -0.5 || r.right > document.documentElement.clientWidth + 0.5;
      return out ? [`${el.className}: ${el.textContent}`] : [];
    }),
  );
  expect(cut).toEqual([]);
}

test("the Clock vote: Bullet, Blitz and Rapid in chess form, whole on a 320 px phone; the winner is the lobby's clock, on the match's card and in its deadlines", async ({ page }) => {
  test.setTimeout(240_000);
  await named(page, "Eric");
  await page.goto("/squads/test?nolanding&debug");
  // (A test lobby's bots sit the Mode vote out: the opener's vote decides it. Classic.)
  await expect(page.locator(".vote-title h1")).toHaveText("Which mode?", { timeout: 20_000 });
  await page.locator(".vote-card").nth(0).click();
  await expect(page.locator(".vote-title h1")).toHaveText("How fast?", { timeout: 60_000 });
  const cards = page.locator(".vote-card");
  await expect(cards).toHaveCount(3);
  for (const [i, c] of SQUADS.clocks.entries()) {
    await expect(cards.nth(i).locator("strong")).toHaveText(clockLabel(c));
    await expect(cards.nth(i).locator(".vote-card-blurb")).toHaveText(teamClockLine(c));
  }
  await expect(cards.nth(0).locator("strong")).toHaveText(/^Bullet \d/);
  await expect(cards.nth(1).locator("strong")).toHaveText(/^Blitz \d/);
  await expect(cards.nth(2).locator("strong")).toHaveText(/^Rapid \d/);
  await whole(page, ".vote-card, .vote-card strong, .vote-card-blurb");
  const phone = test.info().project.name === "phone";
  if (phone) {
    await page.setViewportSize({ width: 320, height: 640 });
    await whole(page, ".vote-card, .vote-card strong, .vote-card-blurb");
  }
  // The banner as the vote ends says the winner in full (it shows for a few seconds: watched from now), and stays
  // inside the board on every frame (on a 320 px phone too), never over the cards under it.
  const banner = await watchFor(page, Object.fromEntries(SQUADS.clocks.map((c) => [c.id, { selector: ".vote-banner-detail", text: new RegExp(`^${escape(teamClockDetail(c))}$`) }])));
  await page.evaluate(() => {
    const w = window as any;
    w.__bannerFrames = 0;
    w.__bannerOut = 0;
    const tick = () => {
      const b = document.querySelector(".vote-banner") as HTMLElement | null;
      if (b && b.offsetParent && !b.classList.contains("leaving")) {
        const r = b.getBoundingClientRect();
        const board = b.offsetParent.getBoundingClientRect();
        w.__bannerFrames++;
        w.__bannerOut = Math.max(w.__bannerOut, r.bottom - board.bottom, board.top - r.top, r.right - board.right, board.left - r.left);
      }
      if (w.__bannerFrames < 100_000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cards.nth(0).click();
  await expect(cards.nth(0)).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.evaluate(() => (window as any).squads.lobby?.rules?.clock?.id ?? null), { timeout: 30_000 }).not.toBeNull();
  const id = await page.evaluate(() => (window as any).squads.lobby.rules.clock.id as string);
  const won = SQUADS.clocks.find((c) => c.id === id)!;
  expect(won).toBeDefined();
  expect((await banner.seen())[id]).toBe(true);
  const framed = await page.evaluate(() => ({ frames: (window as any).__bannerFrames as number, out: (window as any).__bannerOut as number }));
  expect(framed.frames).toBeGreaterThan(10);
  expect(framed.out).toBeLessThanOrEqual(0.5);
  // The first match's card: the time control, whole.
  await expect(page.locator(".sq-banner-clock")).toHaveText(matchClockLine(won), { timeout: 30_000 });
  await whole(page, ".sq-banner-clock");
  // The first half: every move's deadline is the option's cap; the clock line under the board whole.
  const caps = await (async () => {
    let out: number[] | null = null;
    await expect
      .poll(
        async () =>
          (out = await page.evaluate(() => {
            const s = (window as any).squads;
            const m = [...s.matches.values()].find((x: any) => x.state === "half" && x.sides.some((sd: any) => sd.seats.includes(s.myId)));
            return m ? m.current.duties.map((d: any) => d.deadline - m.current.startedAt) : null;
          })),
        { timeout: 60_000, intervals: [250] },
      )
      .not.toBeNull();
    return out!;
  })();
  expect(caps.length).toBeGreaterThan(0);
  for (const ms of caps) expect(ms).toBe(won.capSeconds * 1000);
  await expect(page.locator(".sq-clockline")).toBeVisible();
  await whole(page, ".sq-clockline, .sq-clockline-side, .sq-clockline .sq-clock");
});
