import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { crowdFinalBoss } from "@chessroyale/core";
import { BOARD_SEL, createLobbyFromHome, soloFromHome, test } from "./helpers.ts";

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
/** The cards, and the zones on the board, run left to right in the options' order (whichever side you're on). */
async function expectLeftToRight(p: Page) {
  for (const sel of [".vote-card", ".vote-zone"]) {
    const xs = await p.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
    expect(xs.length).toBe(3);
    expect(xs, sel).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(3);
  }
}
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
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(0);
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
  await expect(page.locator(".vote-card.on")).toContainText(crowdFinalBoss()!.name);
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

  // The second vote: everyone back on their spot (yours too), and the time controls left to right.
  await expect(page.getByRole("heading", { name: "How fast?" })).toBeVisible({ timeout: 10_000 });
  // Slowest on the left, fastest on the right, from either side (Eric, Oct 13: never change position).
  await expect(page.locator(".vote-card strong")).toHaveText(["Rapid 10+5", "Blitz 5+3", "Bullet 3+2"]);
  await expect(page.locator(".vote-card-blurb")).toHaveText(["10 min + 5 s a move · max 20 s", "5 min + 3 s a move · max 15 s", "3 min + 2 s a move · max 10 s"]);
  await expectLeftToRight(page);
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
  await expect(page.locator(BOARD_SEL.piece)).toHaveCount(32);
  await expect(page.locator(".vote-pawn")).toHaveCount(0);
  expect(await boardBox(page)).toEqual(voteBoard);
  // The clock is the voted time control's cap: Bullet 10 s, Blitz 15 s, Rapid 20 s.
  const clock = await page.evaluate(() => (window as any).match.runner.moveClock());
  expect([10, 15, 20]).toContain(clock);
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

/** The bank as the board's clock writes it (clock-text.ts's clockShown: whole seconds rounded up). */
const clockText = (ms: number) => {
  const sec = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

/** Your move's clock is running: what the screen and the rules say, read at one moment. */
const yourMove = (page: Page) =>
  page.evaluate(() => {
    const m = (window as any).match;
    const me = m.standings().find((x: any) => x.isYou);
    return {
      fen: m.phase.board.fen as string,
      allowed: m.phase.allowedMs as number,
      increment: m.settings.timeIncrementSeconds as number,
      bank: me.bankMs as number,
      inMove: Date.now() - m.phase.startsAt,
      shown: document.querySelector(".board-area .bc-bank")?.textContent ?? "",
    };
  });

/** A legal move in this position (worked out by the test, not on your clock). */
const anyMove = (fen: string) => {
  const m = new Chess(fen).moves({ verbose: true })[0]!;
  return m.from + m.to + (m.promotion ?? "");
};

/** Waits for your own move with its clock running (the other team's turn comes first when you play Black). */
const waitForYourMove = (page: Page, timeout = 60_000) =>
  expect
    .poll(() => page.evaluate(() => (window as any).match?.phase.kind === "play" && Date.now() > (window as any).match.phase.startsAt + 200).catch(() => false), { timeout })
    .toBe(true);

test("a time control (Bullet 3+2): a 3:00 bank, +2 s each move kept when the move is quicker, at most 10 s a move", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // (No votes: the ending and the time control from the address.)
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=team&speed=bullet");
  await soloFromHome(page);
  await waitForYourMove(page);
  const first = await yourMove(page);
  const note = await page.locator(".clock-note").textContent();
  await page.evaluate((uci) => (window as any).match.submit(uci), anyMove(first.fen));
  // A fresh 3:00 bank leaves the whole 10 s cap, and the board's clock runs the bank down from 3:02 (the bank and this
  // move's 2 s) as you think.
  expect([first.bank, first.allowed, first.increment, note]).toEqual([180_000, 10_000, 2, "⏱ 10 s"]);
  expect([clockText(182_000 - first.inMove), clockText(182_000 - first.inMove + 200)]).toContain(first.shown);
  // The move took well under 2 s: what it didn't use of the 2 s is in the bank now.
  await expect.poll(() => page.evaluate(() => (window as any).match.runner.player("you").movesTimed), { timeout: 30_000 }).toBe(1);
  const after = await page.evaluate(() => {
    const p = (window as any).match.runner.player("you");
    return { bank: p.bankMs as number, think: p.thinkMsTotal as number };
  });
  expect(after.think).toBeLessThan(2_000);
  expect(after.bank).toBe(182_000 - after.think);
  // The next move starts from that bank (the scoreboard's), with 2 s more, still at most 10 s.
  await expect.poll(() => page.evaluate(() => (window as any).match.phase.kind).catch(() => ""), { timeout: 30_000 }).not.toBe("play");
  await waitForYourMove(page);
  const second = await yourMove(page);
  expect([second.bank, second.allowed]).toEqual([after.bank, 10_000]);
  expect([clockText(after.bank + 2_000 - second.inMove), clockText(after.bank + 2_000 - second.inMove + 200)]).toContain(second.shown);
});

test("online, the time control's increment comes with each move (an app that started with another's has it too)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  // A lobby of one and 99 bots, on Bullet 3+2 (no votes: from the address).
  await page.goto("/?debug&pace=quick&mode=crowd&turns=teams&format=team&speed=bullet");
  await createLobbyFromHome(page);
  await expect.poll(() => page.evaluate(() => !!(window as any).match?.code), { timeout: 30_000 }).toBe(true);
  // Joined from PLAY, the app only knows the Crowd's usual clock (Rapid's +5 s) until the server says otherwise.
  await page.evaluate(() => {
    const m = (window as any).match;
    m.settings = { ...m.settings, timeIncrementSeconds: 5, timeBankSeconds: 600, moveClockSeconds: 20 };
  });
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  await waitForYourMove(page, 90_000);
  const now = await yourMove(page);
  expect([now.bank, now.allowed, now.increment]).toEqual([180_000, 10_000, 2]);
  expect([clockText(182_000 - now.inMove), clockText(182_000 - now.inMove + 200)]).toContain(now.shown);
});
