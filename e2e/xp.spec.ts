import { expect, type Locator, type Page } from "@playwright/test";
import { SOLO_ABANDON } from "@chessroyale/core";
import { test, bossAloneFromHome, pickMove, submitMove } from "./helpers.ts";

/**
 * XP and levels on the end screen (Eric, Nov 9: "after a game, it shows your meter bar and then it shows it like moving. I don't want it
 * to skip… on every page"; the end screen, Nov 20: docs/decisions/2026-11-20-end-screen.md). Phone and computer: "XP EARNED" counts up
 * from 0, lobs into the bar's slot, and the bar fills from the old XP to the new without a jump (sampled every frame); a level-up
 * reaches the end, pops "Level 2!" and goes on from empty; the quests the game moved slide to their counts; the boxes keep their size
 * and place throughout, and so does everything round them; each "No XP" reason says why in the number's place. A tap anywhere but a
 * button skips to the end. Home shows the real level. The test switches: ?xp=<n> (your XP), ?xpgame=MINUTES (the game counts as
 * that long). Against one boss (?boss=gingerbread): ?win and ?mate need a boss whose powers don't get in their way. XP_SHOTS=<dir>
 * saves the stills (a level-up mid-fill, a counted game done, a "No XP" line).
 */
const SHOTS = process.env.XP_SHOTS;

/** Every frame from the page's start: the XP bar's fill (its scaleX), the texts, its box and its neighbors' boxes. */
async function sampleXp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __xp: unknown[] };
    w.__xp = [];
    const rect = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10) : null;
    };
    const frame = () => {
      const fill = document.querySelector(".es-track-xp .es-fill") as HTMLElement | null;
      if (fill) {
        const m = new DOMMatrixReadOnly(getComputedStyle(fill).transform === "none" ? undefined : getComputedStyle(fill).transform);
        const es = document.querySelector("[data-es]")?.getAttribute("data-es");
        w.__xp.push({
          t: performance.now(),
          share: Math.round(m.a * 10_000) / 10_000,
          num: document.querySelector(".es-earned-xp .es-earned-num")?.textContent ?? null,
          gain: document.querySelector(".es-track-xp .es-gain")?.textContent,
          level: document.querySelector(".es-track-xp .es-level")?.textContent,
          pop: document.querySelector(".es-track-xp.es-lvl .es-pop")?.textContent ?? null,
          box: rect(".es-track-xp"),
          earned: rect(".es-earned-xp"),
          quests: rect(".es-quests"),
          title: rect(".results h1"),
          actions: rect(".results .actions"),
          wait: es === "wait",
          done: es === "done",
        });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
type Sample = { t: number; share: number; num: string | null; gain: string; level: string; pop: string | null; box: number[]; earned: number[]; quests: number[]; title: number[] | null; actions: number[] | null; wait: boolean; done: boolean };
const samples = (page: Page) => page.evaluate(() => (window as unknown as { __xp: Sample[] }).__xp);

/** The bar's top row: the gain, your name and the level never overlap; `centered`: the name's middle is the box's (within 3 px). */
async function topRowFits(box: Locator, centered: boolean) {
  const [g, n, l, b] = await Promise.all([".es-gain", ".es-who", ".es-level", ""].map((s) => (s ? box.locator(s) : box).boundingBox()));
  expect(g!.x + g!.width, "the gain ends before the name").toBeLessThanOrEqual(n!.x + 0.5);
  expect(n!.x + n!.width, "the name ends before the level").toBeLessThanOrEqual(l!.x + 0.5);
  if (centered) expect(Math.abs(n!.x + n!.width / 2 - (b!.x + b!.width / 2)), "the name centered").toBeLessThan(3);
}

/** The XP bar's box: 80 px tall, always (END_SCREEN; end-screen.css). */
const BOX_H = 80;
/** The end screen's rewards (data-es: wait, run, done). */
const rewards = (page: Page) => page.getByTestId("es-rewards");

/** Your account's XP, once it's loaded and the ?xp= switch has set it. */
async function xpIs(page: Page, xp: number) {
  // (The page's own account first: a request before its session cookie would make a second guest. helpers.ts, pageAccountId.)
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { xp?: number }).xp, { timeout: 20_000 }).toBe(xp);
}

test("a counted game with a level-up: the bar fills from the old XP to the new, never a jump, to the end and on from empty; nothing moves; home's level", async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  await sampleXp(page);
  await page.addInitScript(() => ((window as any).__soundLog = []));
  // 490 XP (Level 1, 98% of the way: levels of 500 since Nov 20), then a won Boss alone game counted as 12 minutes: 120 + 50 = 170,
  // to 660 (Level 2, 32%).
  await page.goto("/?debug&pace=quick&win=1&boss=gingerbread&xp=490&xpgame=12&quests=squad-up,fifty-fifty,regular"); // (quests no solo boss game can finish: a dealt "Win a Boss Battle" adds its own XP since Nov 10)
  await xpIs(page, 490);
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  const box = page.getByTestId("es-track-xp");
  if (SHOTS) {
    // (Mid-fill, just after the level-up: "Level 2!" popping.)
    await expect.poll(async () => (await samples(page)).some((s) => s.level === "Level 2"), { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(120);
    await box.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/xp-levelup-${testInfo.project.name}.png` });
  }
  await expect(rewards(page)).toHaveAttribute("data-es", "done", { timeout: 30_000 });
  await expect(page.locator(".es-earned-xp .es-earned-num")).toHaveText("+170");
  await expect(box.locator(".es-gain")).toHaveText("+170 XP");
  await expect(box.locator(".es-level")).toHaveText("Level 2");
  await expect(box.getByTestId("es-now-xp")).toHaveText("160 XP");
  // (Never the minutes, Eric, Nov 9: "we dont want players to know they could just stall to get more XP"; the total counts them.)
  await expect(page.locator(".es-earned-xp .es-parts")).toHaveText("Win +50");
  await expect(page.locator(".es-earned-xp .es-parts")).not.toContainText("min");
  // The quest the game moved (Regular, "Complete 10 games"): 0/10 to 1/10, the only row.
  await expect(page.getByTestId("es-q")).toHaveCount(1);
  await expect(page.getByTestId("es-q").locator(".es-q-count")).toHaveText("1/10");
  // Whose XP (Eric, Nov 9): your name in the top row, centered in the box, between the gain and the level.
  const name = ((await (await page.request.get("/api/me")).json()) as { user: { name: string } }).user.name;
  await expect(box.getByTestId("es-who-xp")).toHaveText(name);
  await topRowFits(box, true);
  const all = await samples(page);
  expect(all.some((x) => x.wait && x.done), "never done while its XP is still coming").toBe(false);
  // While its XP is coming, and through the count and the lob: the bar at the old XP, 490 of Level 1's 500, standing still.
  const first = all.findIndex((s) => s.share !== all[0]!.share);
  expect(first, "the bar moves").toBeGreaterThan(0);
  for (const s of all.slice(0, first)) expect(s.share, "the old XP, standing still").toBeCloseTo(0.98, 2);
  expect(all.at(-1)!.share, "ends at the new: 160 of Level 2's 500").toBeCloseTo(0.32, 2);
  // The count first: "+0" up to "+170", never down, over many frames, before the bar moves.
  const nums = all.slice(0, first).map((s) => Number((s.num ?? "0").replace(/[^\d]/g, "")));
  for (let i = 1; i < nums.length; i++) expect(nums[i]!).toBeGreaterThanOrEqual(nums[i - 1]!);
  expect(nums.at(-1), "counted to the total before the fill").toBe(170);
  expect(new Set(nums).size, "a count, not a jump").toBeGreaterThan(10);
  let wraps = 0;
  for (let i = 1; i < all.length; i++) {
    const [a, b] = [all[i - 1]!, all[i]!];
    if (b.share < a.share) {
      // (The one way it goes back: a level-up, from the end to empty.)
      wraps++;
      expect(a.share, "a level-up fills to the end first").toBeGreaterThan(0.95);
      expect(b.share, "and goes on from empty").toBeLessThan(0.05);
      expect(b.level).toBe("Level 2");
    } else expect(b.share - a.share, `no jump between frames (${a.share} → ${b.share})`).toBeLessThan(0.05);
  }
  expect(wraps, "one level-up").toBe(1);
  expect(all.some((s) => s.pop === "Level 2!"), '"Level 2!" pops').toBe(true);
  // Its sounds (Eric, Nov 20: the steel pan level-up; a soft pan note at the fill's end): pings through the count and the fill, one
  // level-up, one last note; the level-up quieter than a move, the last note quieter than the level-up.
  const heard = ((await page.evaluate(() => (window as any).__soundLog)) as string[]).map((l) => l.split(":")[0]!);
  expect(heard.filter((n) => n === "xpPing").length, "pings").toBeGreaterThan(10);
  expect(heard.filter((n) => n === "acLevel").length, "one level-up").toBe(1);
  expect(heard.filter((n) => n === "xpDing").length, "one last note").toBe(1);
  expect(heard.indexOf("acLevel"), "the level-up before the last note").toBeLessThan(heard.indexOf("xpDing"));
  const loud = (n: string) => page.evaluate((n) => (window as any).__measureSound(n, 1.5), n) as Promise<{ peak: number; rms: number }>;
  const [move, levelUp, ding] = [await loud("move"), await loud("acLevel"), await loud("xpDing")];
  expect(move.peak).toBeGreaterThan(0.05);
  expect(levelUp.peak, "the level-up's peak under half a move's (as every synthesized sound)").toBeLessThan(move.peak / 2);
  expect(levelUp.rms, "the level-up's loudness under a move's").toBeLessThan(move.rms);
  expect(ding.peak, "the last note under the level-up").toBeLessThan(levelUp.peak);
  expect(ding.peak).toBeGreaterThan(0.01);
  // The fill took over a second, over many frames (never one step).
  const fill = all.slice(first);
  const end = fill.findIndex((s) => Math.abs(s.share - 0.32) < 0.001);
  expect(end).toBeGreaterThan(20);
  expect(fill[end]!.t - fill[0]!.t).toBeGreaterThan(1000);
  // Nothing shifts: the number's box, the bar, the quests, the title and the buttons keep their places (to one another: a still may
  // scroll the page) and sizes from the first frame to the last.
  const shape = (x: Sample) => [x.box[0], x.box[1]! - x.title![1]!, x.box[2], x.box[3], x.earned[1]! - x.title![1]!, x.earned[3], x.quests[1]! - x.title![1]!, x.quests[3], x.actions![1]! - x.title![1]!, x.title![2], x.title![3], x.actions![3]];
  for (const x of all) expect(shape(x), "every part in its place and size").toEqual(shape(all[0]!));
  expect(all[0]!.box[3], "the bar's fixed height").toBe(BOX_H);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/xp-counted-${testInfo.project.name}.png` });
  // Home: the real level and its ring (Level 2, 32% of the way round). (Level 2's reward card first: it waits for OK since Nov 22.)
  await closeRewardCard(page);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.locator(".fd-level")).toHaveText("LVL 2");
  const filled = await page.evaluate(() => {
    const fill = document.querySelector(".fd-level-ring .fill") as SVGPathElement;
    return parseFloat(getComputedStyle(fill).strokeDasharray.split(/[ ,]+/)[0]!) / fill.getTotalLength();
  });
  expect(filled).toBeCloseTo(0.32, 2);
});

test('"No XP: test game." in the same box, the same size: a test switch on (?mate)', async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug&pace=quick&mate=1&boss=gingerbread&xp=250");
  await xpIs(page, 250);
  await bossAloneFromHome(page);
  await expect(page.locator(".results h1")).toHaveText("Defeat", { timeout: 120_000 });
  const box = page.getByTestId("es-track-xp");
  await expect(page.locator(".es-earned-xp .es-earned-why")).toHaveText("No XP: test game.", { timeout: 20_000 });
  await expect(box.locator(".es-gain")).toHaveText("");
  await expect(box.locator(".es-level")).toHaveText("Level 1");
  await expect(page.locator(".es-quests-none")).toHaveText("No quests moved this game.");
  await expect(rewards(page)).toHaveAttribute("data-es", "done");
  expect((await box.boundingBox())!.height).toBe(BOX_H);
  // (The bar stands at your XP: 250 of 500.)
  const share = await box.locator(".es-fill").evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).a);
  expect(share).toBeCloseTo(0.5, 2);
  if (SHOTS) {
    await box.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/xp-none-${testInfo.project.name}.png` });
  }
});

test('"No XP: you resigned before move 10.": resigning at once, no test switch on', { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug&boss=gingerbread");
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Resign/ }).click();
  await expect(page.locator(".results h1")).toHaveText("You resigned", { timeout: 30_000 });
  await expect(page.locator(".es-earned-xp .es-earned-why")).toHaveText("No XP: you resigned before move 10.", { timeout: 20_000 });
});

test("a turn you called the God King to play is one of your moves in the result the server counts (Eric, Nov 21)", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  // (Eric's floor, won by mate on move 12 with 3 calls, said "No XP: the game ended before move 10": the calls weren't counted.)
  const sent: { moves?: unknown }[] = [];
  page.on("request", (r) => void (r.method() === "POST" && new URL(r.url()).pathname === "/api/results" && sent.push(r.postDataJSON())));
  // (?win=1: from a mate in one, Qxf7; the God King plays the judge's best, the mate. A test switch: the game itself is a test game.)
  await page.goto("/?debug&pace=quick&win=1&boss=gingerbread");
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.kingCharges)).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).match.callKing());
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  expect(await page.evaluate(() => (window as any).match.moves.map((m: { move: unknown; abstained?: boolean }) => [m.move, !!m.abstained]))).toEqual([[null, true]]);
  // Your one move was the God King's, and it's yours: 1 (it was 0).
  await expect.poll(() => sent.length, { timeout: 20_000 }).toBe(1);
  expect(sent[0]!.moves).toBe(1);
});

test("each other \"No XP\" line, in the same box and size (the server's answer faked): ended early, left, a guest, banned, the daily solo limit", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  for (const [none, line] of [
    ["short", "No XP: the game ended before move 10."],
    ["left", "No XP: you left the match."],
    ["guest", "Sign in to earn XP."],
    ["banned", "No XP: this account is banned."],
    ["limit", "No XP: daily solo limit reached."],
  ] as const) {
    await page.unrouteAll();
    await page.route(/\/api\/results$/, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ok: true, xp: { before: 4_500, after: 4_500, levelBefore: 10, levelAfter: 10, parts: [], none } } });
    });
    await page.goto("/?debug&pace=quick&mate=1&boss=gingerbread");
    await bossAloneFromHome(page);
    await expect(page.locator(".results h1")).toHaveText("Defeat", { timeout: 120_000 });
    const box = page.getByTestId("es-track-xp");
    const why = page.locator(".es-earned-xp .es-earned-why");
    await expect(why).toHaveText(line, { timeout: 20_000 });
    await expect(box.locator(".es-level")).toHaveText("Level 10");
    const b = (await box.boundingBox())!;
    expect(b.height, none).toBe(BOX_H);
    // (Whole on its line: not cut, inside the window.)
    const w = (await why.boundingBox())!;
    expect(w.x, `${none}: the line fits`).toBeGreaterThanOrEqual(0);
    expect(w.x + w.width, `${none}: the line fits`).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(w.height, `${none}: one line`).toBeLessThanOrEqual(38);
  }
});

test("at 320 px, the widest line and a long count fit their box", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route(/\/api\/results$/, async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ok: true, xp: { before: 99_950, after: 100_250, levelBefore: 200, levelAfter: 201, parts: [{ label: "30 min", xp: 300 }, { label: "Win (paid once today)", xp: 0 }] } },
    });
  });
  await page.goto("/?debug&pace=quick&mate=1&boss=gingerbread");
  // (The longest name there is, 16 wide letters: it shrinks, ellipsized, and never covers the gain or the level.)
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  expect((await page.request.patch("/api/me", { data: { name: "WWWWWWWWWWWWWWWW" } })).ok()).toBe(true);
  await page.reload();
  await bossAloneFromHome(page);
  const box = page.getByTestId("es-track-xp");
  await expect(rewards(page)).toHaveAttribute("data-es", "done", { timeout: 120_000 });
  await expect(box.getByTestId("es-who-xp")).toHaveText("WWWWWWWWWWWWWWWW");
  expect(await box.getByTestId("es-who-xp").evaluate((e) => e.scrollWidth > e.clientWidth), "the long name is cut short").toBe(true);
  await topRowFits(box, false);
  await expect(box.locator(".es-gain")).toHaveText("+300 XP");
  await expect(page.locator(".es-earned-xp .es-parts")).toHaveText("Win (paid once today) +0");
  await expect(box.locator(".es-level")).toHaveText("Level 201");
  for (const sel of [".es-track-top", ".es-earned-xp .es-parts"]) expect(await page.locator(sel).evaluate((e) => e.scrollWidth <= e.clientWidth), `${sel} fits at 320 px`).toBe(true);
  const b = (await box.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(320);
});

test("a tap anywhere but a button skips the whole sequence to its end (Eric, Nov 20): the final numbers at once, and it stays there", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await sampleXp(page);
  // (Quests no solo boss game can finish, as the level-up test's.)
  await page.goto("/?debug&pace=quick&win=1&boss=gingerbread&xp=490&xpgame=12&quests=squad-up,fifty-fifty,regular");
  await xpIs(page, 490);
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(rewards(page)).toHaveAttribute("data-es", "run", { timeout: 120_000 });
  // Mid-count: a tap on the headline (not a button).
  await expect.poll(async () => Number(((await page.locator(".es-earned-xp .es-earned-num").textContent()) ?? "").replace(/[^\d]/g, "")), { timeout: 10_000 }).toBeGreaterThan(0);
  const at = await page.evaluate(() => performance.now());
  await page.getByTestId("es-title").click();
  await expect(rewards(page)).toHaveAttribute("data-es", "done", { timeout: 5_000 });
  const box = page.getByTestId("es-track-xp");
  await expect(page.locator(".es-earned-xp .es-earned-num")).toHaveText("+170");
  await expect(box.locator(".es-gain")).toHaveText("+170 XP");
  await expect(box.locator(".es-level")).toHaveText("Level 2");
  await expect(box.getByTestId("es-now-xp")).toHaveText("160 XP");
  // (From the tap on, the bar stands at the end: no fill plays after it.)
  await page.waitForTimeout(2_500);
  const after = (await samples(page)).filter((s) => s.t > at + 300);
  for (const s of after) expect(s.share, "at its end, still").toBeCloseTo(0.32, 3);
  expect(after.length).toBeGreaterThan(10);
  // The buttons still work: Play again's neighbor, Home (Level 2's reward card closed first: it waits for OK since Nov 22).
  await closeRewardCard(page);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.locator(".fd-level")).toHaveText("LVL 2");
});

/** The level-up's reward card (Nov 22): it waits over the end screen until OK. */
async function closeRewardCard(page: Page) {
  const card = page.getByTestId("reward-box");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "▶ OK" }).click();
  await expect(card).toHaveCount(0);
}

/** Your turns played in this solo game so far (a missed one isn't; none before the game is made, just after START). */
const ownSoFar = (page: Page) =>
  page.evaluate(() => (((window as any).match?.moves ?? []) as { move: unknown; abstained?: boolean }[]).filter((m) => m.move !== null || m.abstained).length);

/** Plays your turns in a boss battle alone until `n` are yours: each a quiet move the boss's powers allow (pickMove), once it's your turn. */
async function playOwnMoves(page: Page, n: number) {
  for (let i = 0; i < 3 * n && (await ownSoFar(page)) < n; i++) {
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
    const s = await page.evaluate(() => {
      const m = (window as any).match;
      return { fen: m.phase.board.fen as string, allowed: (m.runner.crowdAllowed() ?? null) as string[] | null, n: m.moves.length as number };
    });
    await submitMove(page, pickMove(s.fen, { allowed: s.allowed, prefer: (m) => m.piece === "n" || (m.piece === "p" && "abcde".includes(m.from[0]!)) }), s.fen);
    await expect.poll(() => page.evaluate(() => (window as any).match.moves.length), { timeout: 30_000 }).toBeGreaterThan(s.n);
  }
  expect(await ownSoFar(page)).toBe(n);
}

test(`a solo battle left mid-game: the reload's card, "You have a game in progress", Resume (the same board) or Forfeit (past ${SOLO_ABANDON.minMoves} of your moves a loss on your profile; under it, nothing) (Eric, Nov 22)`, { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(6 * 60_000);
  // (No test switch that makes a test game: those are never marked, nor kept.)
  await page.goto("/?debug&boss=gingerbread");
  const marks: { game: string }[] = [];
  const forfeits: unknown[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (r.method() === "POST" && path === "/api/xp/solo/real") marks.push(r.postDataJSON());
    if (r.method() === "POST" && path === "/api/xp/solo/forfeit") forfeits.push(r.postDataJSON());
  });
  const recent = async () => {
    const id = ((await (await page.request.get("/api/me")).json()) as { user: { id: string } }).user.id;
    return ((await (await page.request.get(`/api/profile/${id}`)).json()) as { recent: { mode: string; online: boolean; won: boolean | null }[] }).recent;
  };
  const card = page.getByTestId("game-in-progress");
  const yourTurn = () => expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  const position = () => page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, moves: (window as any).match.moves.length as number }));
  // Under the mark: a reload shows the card; Forfeit records nothing, and the server was never told.
  await bossAloneFromHome(page);
  await playOwnMoves(page, SOLO_ABANDON.minMoves - 1);
  await page.reload();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("You have a game in progress");
  await expect(card).toContainText(`Ginger · Move ${SOLO_ABANDON.minMoves - 1}`);
  await expect(card).toContainText(`Under ${SOLO_ABANDON.minMoves} moves, forfeiting doesn't count.`);
  await card.getByRole("button", { name: "Forfeit" }).click();
  await expect(card).toHaveCount(0);
  expect(marks).toEqual([]);
  expect(forfeits).toEqual([]);
  expect(await recent()).toEqual([]);
  // Past the mark (12 moves): told once; a reload records nothing (the load names the game it keeps) and shows the card.
  await bossAloneFromHome(page);
  await playOwnMoves(page, 12);
  await expect.poll(() => marks.length, { timeout: 10_000 }).toBe(1);
  expect(marks[0]).toMatchObject({ mode: "boss", players: 1, bossId: "gingerbread" });
  await yourTurn();
  const before = await position();
  await page.reload();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Ginger · Move 12");
  await expect(card).toContainText("Forfeiting counts as a loss.");
  expect(await recent()).toEqual([]);
  // Resume: the same battle, the same board, your turn.
  await card.getByRole("button", { name: "Resume" }).click();
  await expect(card).toHaveCount(0);
  await yourTurn();
  expect(await position()).toEqual(before);
  // A reload again, and Forfeit: one loss on your profile, a boss battle lost, solo.
  await page.reload();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: "Forfeit" }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(async () => (await recent()).length, { timeout: 20_000 }).toBe(1);
  expect((await recent())[0]).toMatchObject({ mode: "boss", online: false, won: false });
  expect(forfeits).toHaveLength(1);
  // Another game starts with no question (none kept): still one loss, never recorded again; every mark was that one game's.
  await bossAloneFromHome(page);
  await yourTurn();
  expect(await recent()).toHaveLength(1);
  expect(new Set(marks.map((m) => m.game)).size).toBe(1);
});
