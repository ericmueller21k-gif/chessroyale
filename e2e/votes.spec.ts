import { expect, type Page } from "@playwright/test";
import { soloFromHome, test } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const centre = async (p: Page, sel: string, nth = 0) => {
  const r = (await p.locator(sel).nth(nth).boundingBox())!;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
/** Every other player's pawn: where it stands, and whether it's in a zone (voted). */
const pawns = (p: Page) =>
  p.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>(".vote-pawn:not(.vote-me)")].map((e) => {
        const r = e.getBoundingClientRect();
        return [e.dataset.id!, { in: e.classList.contains("in"), x: r.x + r.width / 2, y: r.y + r.height / 2 }];
      }),
    ),
  );
const boardBox = async (p: Page) => {
  const r = (await p.locator(".board-wrap").first().boundingBox())!;
  return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10);
};

/** A real finger on a phone (CDP touch events, as the phone sends them), or a mouse on a computer. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, touch: boolean) {
  const steps = 12;
  if (!touch) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("the vote board: your pawn is solid, drag it into a zone, the count goes up; the second vote starts from home; the game begins with the pieces", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const touch = test.info().project.name === "phone";
  await page.goto("/?debug&mode=crowd&turns=teams&augments=1");
  await soloFromHome(page);
  await expect(page.locator(".vote-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "How does it end?" })).toBeVisible();
  // An empty board: no pieces, only the players' pawns, both teams on their own two ranks.
  await expect(page.locator("cg-board piece")).toHaveCount(0);
  await expect(page.locator(".vote-pawn")).toHaveCount(100);
  // Yours: the same pawn, fully solid and a little bigger (voteYouScale), on top of everyone else's (which are faint).
  // No tag, no ring, no glow, no bob (Eric: tapping a card works too, so nobody loses their pawn).
  const me = page.locator(".vote-me");
  await expect(me).toBeVisible();
  await expect(me).toHaveText("");
  await expect(page.locator(".vote-me-tag, .vote-me-ring")).toHaveCount(0);
  const looks = await page.evaluate(() => {
    const mine = document.querySelector<HTMLElement>(".vote-me")!;
    const others = [...document.querySelectorAll<HTMLElement>(".vote-pawn:not(.vote-me)")];
    const r = mine.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const avatar = getComputedStyle(mine.querySelector(".avatar")!);
    return {
      mine: Number(getComputedStyle(mine).opacity),
      others: Math.max(...others.map((e) => Number(getComputedStyle(e).opacity))),
      scale: r.width / others[0]!.getBoundingClientRect().width,
      onTop: !!top?.closest(".vote-me"),
      filter: avatar.filter,
      animation: avatar.animationName,
      want: (window as any).match.settings.voteYouScale,
    };
  });
  expect(looks.mine).toBe(1);
  expect(looks.others).toBeLessThan(0.6);
  expect(looks.want).toBeGreaterThan(1);
  expect(looks.scale).toBeCloseTo(looks.want, 1);
  expect(looks.onTop).toBe(true);
  expect(looks.filter).toBe("none");
  expect(looks.animation).toBe("none");
  const start = await centre(page, ".vote-me");
  const homes = await pawns(page);
  // Your pawn starts on your own side, at the bottom of the board (from Black's side the board is flipped).
  const board = await boardBox(page);
  expect(start.y).toBeGreaterThan(board[1]! + board[3]! * 0.7);

  // Drag it into the middle zone with a real finger: that's your vote, and the zone's count goes up.
  await page.waitForTimeout(600);
  const before = Number(await page.locator(".vote-zone-count").nth(1).textContent());
  await drag(page, start, await centre(page, ".vote-zone", 1), touch);
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(1);
  await expect(page.locator(".vote-card.on")).toContainText("Boss battle");
  await expect(page.locator(".vote-zone.mine")).toHaveCount(1);
  await expect.poll(async () => Number(await page.locator(".vote-zone-count").nth(1).textContent())).toBeGreaterThan(before);
  // The tally bubbles up: a count that goes up pops.
  // (Read in one go: each new count is a new element, so a located one can be gone a moment later.)
  const pop = await page.evaluate(() => {
    const e = document.querySelectorAll(".vote-zone-count")[1]!;
    return e.classList.contains("pop") ? getComputedStyle(e).animationName : "none";
  });
  expect(pop).toBe("count-pop");
  // It stays in the zone, settling on your side's half (the near one, at the bottom), still solid.
  expect(await me.evaluate((e) => Number(getComputedStyle(e).opacity))).toBe(1);
  const zone = (await page.locator(".vote-zone").nth(1).boundingBox())!;
  await expect
    .poll(async () => {
      const c = await centre(page, ".vote-me");
      return c.x > zone.x && c.x < zone.x + zone.width && c.y > zone.y + zone.height / 2 && c.y < zone.y + zone.height;
    })
    .toBe(true);
  // One vote each: the cards are closed now.
  await expect(page.getByRole("radio", { name: /Duel/ })).toBeDisabled();
  await expect(page.locator(".vote-banner")).toBeVisible({ timeout: 15_000 });

  // The second vote: everyone back on their spot (yours too), and the speeds left to right.
  await expect(page.getByRole("heading", { name: "How fast?" })).toBeVisible({ timeout: 10_000 });
  // (In the page's order; from Black's side they show mirrored, like the zones.)
  await expect(page.locator(".vote-card strong")).toHaveText(["Normal", "Variable", "Bullet"]);
  await expect(page.locator(".vote-card-blurb").nth(1)).toHaveText("10 s, rising to 30 s");
  await expect.poll(async () => {
    const c = await centre(page, ".vote-me");
    return Math.hypot(c.x - start.x, c.y - start.y);
  }).toBeLessThan(2);
  // Everyone else too: each pawn not yet voting again stands where it stood at the start of the first vote.
  await expect
    .poll(async () => {
      const now = await pawns(page);
      let back = 0;
      for (const [id, p] of Object.entries(now)) {
        const was = homes[id]!;
        if (p.in || was.in) continue;
        if (Math.hypot(p.x - was.x, p.y - was.y) > 2) return `${id} is ${Math.round(Math.hypot(p.x - was.x, p.y - was.y))} px from its spot`;
        back++;
      }
      return back > 30 ? "home" : `only ${back} to compare`;
    })
    .toBe("home");
  // Vote by a tap on your pawn, then a tap on a zone. (A tap beside it picks it up too: the pawn is small, the
  // area that takes the touch isn't.)
  await page.waitForTimeout(400);
  const home = await centre(page, ".vote-me");
  const size = (await me.boundingBox())!.width;
  const beside = { x: home.x + size * 0.85, y: home.y };
  if (touch) await page.touchscreen.tap(beside.x, beside.y);
  else await page.mouse.click(beside.x, beside.y);
  await expect(page.locator(".vote-me.selected")).toBeVisible();
  const right = await centre(page, ".vote-zone", 2);
  if (touch) await page.touchscreen.tap(right.x, right.y);
  else await page.mouse.click(right.x, right.y);
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(2);
  const voteBoard = await boardBox(page);

  // The game begins: the pawns are gone, the real pieces are on their squares, and the board hasn't moved.
  await expect.poll(() => phase(page), { timeout: 20_000 }).toMatch(/play|watching/);
  await expect(page.locator("cg-board piece")).toHaveCount(32);
  await expect(page.locator(".vote-pawn")).toHaveCount(0);
  expect(await boardBox(page)).toEqual(voteBoard);
  // The clock is the voted speed's: Normal 20 s, Variable 10 s on move 1, Bullet 10 s.
  const clock = await page.evaluate(() => (window as any).match.runner.moveClock());
  expect([10, 20]).toContain(clock);
});

test("time's up: whoever didn't vote (you, and a few bots) walks to the winner, then the banner names it", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&mode=crowd&turns=teams&augments=1");
  await soloFromHome(page);
  await expect(page.locator(".vote-screen")).toBeVisible({ timeout: 30_000 });
  // 8 seconds to vote (settings.voteSeconds), on screen as the timer bar's whole length.
  const voting = await page.evaluate(() => {
    const v = (window as any).match.phase.vote;
    return { ms: v.until - v.startsAt, want: (window as any).match.settings.voteSeconds * 1000 };
  });
  expect(voting.ms).toBe(8000);
  expect(voting.want).toBe(8000);
  const home = await centre(page, ".vote-me");
  // Don't vote. The moment time's up: the winner is counted, and the banner waits for the walk (it covers the zones).
  await page.waitForFunction(() => (window as any).match.phase.kind === "vote" && (window as any).match.phase.vote.result !== null, null, { polling: "raf", timeout: 15_000 });
  const atEnd = await page.evaluate(() => {
    const v = (window as any).match.phase.vote;
    return {
      result: v.result as number,
      banner: !!document.querySelector(".vote-banner"),
      joined: v.votes.filter((x: any) => x.joined).map((x: any) => ({ id: x.playerId, option: x.option })) as { id: string; option: number }[],
      total: new Set(v.votes.map((x: any) => x.playerId)).size,
    };
  });
  expect(atEnd.banner).toBe(false);
  expect(atEnd.total).toBe(100);
  // You, and the bots that didn't vote, all join the winner.
  expect(atEnd.joined.map((j) => j.id)).toContain("you");
  expect(atEnd.joined.length).toBeGreaterThan(1);
  expect(atEnd.joined.every((j) => j.option === atEnd.result)).toBe(true);
  await expect(page.locator(".vote-hint")).toHaveText("You didn't vote, so you're with the crowd.");
  // Everyone walks there: your pawn lands in the winning zone (on your half), and so does each bot that didn't vote.
  const win = (await page.locator(".vote-zone.win").boundingBox())!;
  const inside = (c: { x: number; y: number }) => c.x > win.x && c.x < win.x + win.width && c.y > win.y && c.y < win.y + win.height;
  await expect.poll(async () => inside(await centre(page, ".vote-me"))).toBe(true);
  const mine = await centre(page, ".vote-me");
  expect(mine.y).toBeGreaterThan(win.y + win.height / 2);
  expect(Math.hypot(mine.x - home.x, mine.y - home.y)).toBeGreaterThan(40);
  await expect
    .poll(async () => {
      const now = await pawns(page);
      return atEnd.joined.filter((j) => j.id !== "you").every((j) => now[j.id]!.in && inside(now[j.id]!));
    })
    .toBe(true);
  // The counts show them: every one of the 100 is in a zone, the winner's count is everyone who voted for it or joined.
  await expect
    .poll(async () => (await page.locator(".vote-zone-count").allTextContents()).map(Number).reduce((a, b) => a + b, 0))
    .toBe(100);
  // Then the banner, and the line goes back to what's next.
  await expect(page.locator(".vote-banner")).toBeVisible();
  await expect(page.locator(".vote-hint")).toHaveText(/How fast\? in \d…|How fast\?…/, { timeout: 5_000 });
  expect(await page.evaluate(() => (window as any).match.myVote)).toBe(atEnd.result);
});

test("the Variable speed: 10 s a move for moves 1-5, then 15 s from move 6, shown above the board", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // (No votes: the ending and the speed from the address.)
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=team&speed=variable");
  await soloFromHome(page);
  const seen = new Map<number, { note: string; up: boolean; allowed: number }>();
  const stopAt = Date.now() + 3.5 * 60_000;
  while (Date.now() < stopAt && !seen.has(6)) {
    if ((await phase(page)) === "play") {
      const now = await page
        .evaluate(() => {
          const m = (window as any).match;
          if (m.phase.kind !== "play") return null;
          const note = document.querySelector(".clock-note");
          return { move: Number(m.phase.board.fen.split(" ")[5]), note: note?.textContent ?? "", up: !!note?.classList.contains("up"), allowed: m.phase.allowedMs, fen: m.phase.board.fen };
        })
        .catch(() => null);
      if (now && now.note && !seen.has(now.move)) {
        seen.set(now.move, { note: now.note, up: now.up, allowed: now.allowed });
        // (Move 6 stays on screen, to look at.)
        if (now.move === 6) break;
        // Any legal move: the clock is what's tested.
        await page.evaluate((fen) => {
          const m = (window as any).match;
          const move = [...(m.runner.planned?.values() ?? [])][0];
          if (m.phase.kind === "play" && m.phase.board.fen === fen) m.submit(move ?? null);
        }, now.fen);
      }
    }
    await page.waitForTimeout(150);
  }
  expect(seen.get(1)).toEqual({ note: "⏱ 10 s", up: false, allowed: 10_000 });
  expect(seen.get(5)?.allowed).toBe(10_000);
  // Move 6: more time, and it says so (lit, with a ▲) for that move.
  expect(seen.get(6)).toEqual({ note: "⏱ 15 s ▲", up: true, allowed: 15_000 });
  await expect(page.locator(".clock-note.up")).toBeVisible();
});
