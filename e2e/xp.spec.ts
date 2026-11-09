import { expect, type Page } from "@playwright/test";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * XP and levels (Eric, Nov 9: "after a game, it shows your meter bar and then it shows it like moving. I don't want it to skip…
 * on every page"; docs/decisions/2026-11-09-xp-box.md). The result screen's XP box, phone and computer: a counted game fills the
 * bar from the old XP to the new without a jump (sampled every frame), a level-up reaches the end, pops "Level 2!" and goes on
 * from empty, the parts show; the box keeps its size and place throughout, and so does everything round it; each "No XP" reason
 * says why in the same box. Home shows the real level. The test switches: ?xp=<n> (your XP), ?xpgame=MINUTES (the game counts as
 * that long). Against one boss (?boss=gingerbread): ?win and ?mate need a boss whose powers don't get in their way. XP_SHOTS=<dir> saves the stills (a level-up mid-fill, a counted game done, a "No XP" line).
 */
const SHOTS = process.env.XP_SHOTS;

/** Every frame from the page's start: the box's fill (its scaleX), texts, its box and its neighbors' boxes. */
async function sampleXp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __xp: unknown[] };
    w.__xp = [];
    const rect = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10) : null;
    };
    const frame = () => {
      const fill = document.querySelector(".xp-fill") as HTMLElement | null;
      if (fill) {
        const m = new DOMMatrixReadOnly(getComputedStyle(fill).transform === "none" ? undefined : getComputedStyle(fill).transform);
        w.__xp.push({
          t: performance.now(),
          share: Math.round(m.a * 10_000) / 10_000,
          gain: document.querySelector(".xp-gain")?.textContent,
          level: document.querySelector(".xp-level")?.textContent,
          pop: document.querySelector(".xp-pop.on")?.textContent ?? null,
          box: rect(".xp-box"),
          title: rect(".results h1"),
          actions: rect(".results .actions"),
          wait: !!document.querySelector(".xp-wait"),
          done: !!document.querySelector(".xp-done"),
        });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
type Sample = { t: number; share: number; gain: string; level: string; pop: string | null; box: number[]; title: number[] | null; actions: number[] | null; wait: boolean; done: boolean };
const samples = (page: Page) => page.evaluate(() => (window as unknown as { __xp: Sample[] }).__xp);

/** Your account's XP, once it's loaded and the ?xp= switch has set it. */
async function xpIs(page: Page, xp: number) {
  // (The page's own account first: a request before its session cookie would make a second guest. helpers.ts, pageAccountId.)
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { xp?: number }).xp, { timeout: 20_000 }).toBe(xp);
}

test("a counted game with a level-up: the bar fills from the old XP to the new, never a jump, to the end and on from empty; nothing moves; home's level", async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  await sampleXp(page);
  // 990 XP (Level 1, 99% of the way), then a won Boss alone game counted as 12 minutes: 120 + 50 = 170, to 1,160 (Level 2, 16%).
  await page.goto("/?debug&pace=quick&win=1&boss=gingerbread&xp=990&xpgame=12");
  await xpIs(page, 990);
  await bossAloneFromHome(page);
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  const box = page.getByTestId("xp-box");
  if (SHOTS) {
    // (Mid-fill, just after the level-up: "Level 2!" popping.)
    await expect.poll(async () => (await samples(page)).some((s) => s.level === "Level 2"), { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(120);
    await box.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/xp-levelup-${testInfo.project.name}.png` });
  }
  await expect(box).toHaveClass(/xp-done/, { timeout: 20_000 });
  await expect(box.locator(".xp-gain")).toHaveText("+170 XP");
  await expect(box.locator(".xp-level")).toHaveText("Level 2");
  await expect(box.locator(".xp-parts")).toHaveText("12 min +120 · Win +50");
  const all = await samples(page);
  // The fill, from the grant's first frame (before it, "Counting your XP…" at your XP as it was).
  const fill = all.filter((s) => !s.wait);
  expect(all.some((x) => x.wait && x.done), "never done while its XP is still coming").toBe(false);
  expect(fill[0]!.done, "not done as it starts to fill").toBe(false);
  expect(fill[0]!.share, "starts at the old XP: 990 of Level 1's 1,000").toBeCloseTo(0.99, 2);
  expect(fill.at(-1)!.share, "ends at the new: 160 of Level 2's 1,000").toBeCloseTo(0.16, 2);
  let wraps = 0;
  for (let i = 1; i < fill.length; i++) {
    const [a, b] = [fill[i - 1]!, fill[i]!];
    if (b.share < a.share) {
      // (The one way it goes back: a level-up, from the end to empty.)
      wraps++;
      expect(a.share, "a level-up fills to the end first").toBeGreaterThan(0.95);
      expect(b.share, "and goes on from empty").toBeLessThan(0.05);
      expect(b.level).toBe("Level 2");
    } else expect(b.share - a.share, `no jump between frames (${a.share} → ${b.share})`).toBeLessThan(0.05);
  }
  expect(wraps, "one level-up").toBe(1);
  expect(fill.some((s) => s.pop === "Level 2!"), '"Level 2!" pops').toBe(true);
  // It took 1.5 to 2.5 s, over many frames (never one step).
  const ms = fill.at(-1)!.t - fill[0]!.t;
  expect(fill.length).toBeGreaterThan(20);
  expect(ms).toBeGreaterThan(1200);
  // The count rose with it: "+0 XP" to "+170 XP", never down.
  const gains = fill.map((s) => Number(s.gain.replace(/[^\d]/g, "")));
  for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeGreaterThanOrEqual(gains[i - 1]!);
  // Nothing shifts: the box, the title and the buttons keep their places (to one another: a still may scroll the page) and sizes
  // from the box's first frame to its last.
  const shape = (x: Sample) => [x.box[0], x.box[1]! - x.title![1]!, x.box[2], x.box[3], x.actions![1]! - x.title![1]!, x.title![2], x.title![3], x.actions![3]];
  for (const x of all) expect(shape(x), "every part in its place and size").toEqual(shape(all[0]!));
  expect(all[0]!.box[3], "the box's fixed height").toBe(78);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/xp-counted-${testInfo.project.name}.png` });
  // Home: the real level and its ring (Level 2, 16% of the way round).
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.locator(".fd-level")).toHaveText("LVL 2");
  const filled = await page.evaluate(() => {
    const fill = document.querySelector(".fd-level-ring .fill") as SVGPathElement;
    return parseFloat(getComputedStyle(fill).strokeDasharray.split(/[ ,]+/)[0]!) / fill.getTotalLength();
  });
  expect(filled).toBeCloseTo(0.16, 2);
});

test('"No XP: test game." in the same box, the same size: a test switch on (?mate)', async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug&pace=quick&mate=1&boss=gingerbread&xp=250");
  await xpIs(page, 250);
  await bossAloneFromHome(page);
  await expect(page.locator(".results h1")).toHaveText("Defeated", { timeout: 120_000 });
  const box = page.getByTestId("xp-box");
  await expect(box.locator(".xp-why")).toHaveText("No XP: test game.", { timeout: 20_000 });
  await expect(box.locator(".xp-gain")).toHaveText("+0 XP");
  await expect(box.locator(".xp-level")).toHaveText("Level 1");
  expect((await box.boundingBox())!.height).toBe(78);
  // (The bar stands at your XP: 250 of 1,000.)
  const share = await box.locator(".xp-fill").evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).a);
  expect(share).toBeCloseTo(0.25, 2);
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
  await expect(page.getByTestId("xp-box").locator(".xp-why")).toHaveText("No XP: you resigned before move 10.", { timeout: 20_000 });
});

test("each other \"No XP\" line, in the same box and size (the server's answer faked): ended early, left, a guest, banned", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  for (const [none, line] of [
    ["short", "No XP: the game ended before move 10."],
    ["left", "No XP: you left the match."],
    ["guest", "Sign in to earn XP."],
    ["banned", "No XP: this account is banned."],
  ] as const) {
    await page.unrouteAll();
    await page.route(/\/api\/results$/, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ok: true, xp: { before: 4_500, after: 4_500, levelBefore: 5, levelAfter: 5, parts: [], none } } });
    });
    await page.goto("/?debug&pace=quick&mate=1&boss=gingerbread");
    await bossAloneFromHome(page);
    await expect(page.locator(".results h1")).toHaveText("Defeated", { timeout: 120_000 });
    const box = page.getByTestId("xp-box");
    await expect(box.locator(".xp-why")).toHaveText(line, { timeout: 20_000 });
    await expect(box.locator(".xp-level")).toHaveText("Level 5");
    const b = (await box.boundingBox())!;
    expect(b.height, none).toBe(78);
    // (Whole on its line: not cut.)
    expect(await box.locator(".xp-parts").evaluate((e) => e.scrollWidth <= e.clientWidth), `${none}: the line fits`).toBe(true);
  }
});

test("at 320 px, the widest line and a long count fit their box", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route(/\/api\/results$/, async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ok: true, xp: { before: 99_950, after: 100_250, levelBefore: 100, levelAfter: 101, parts: [{ label: "30 min", xp: 300 }, { label: "Win (paid once today)", xp: 0 }] } },
    });
  });
  await page.goto("/?debug&pace=quick&mate=1&boss=gingerbread");
  await bossAloneFromHome(page);
  const box = page.getByTestId("xp-box");
  await expect(box).toHaveClass(/xp-done/, { timeout: 120_000 });
  await expect(box.locator(".xp-gain")).toHaveText("+300 XP");
  await expect(box.locator(".xp-parts")).toHaveText("30 min +300 · Win (paid once today) +0");
  await expect(box.locator(".xp-level")).toHaveText("Level 101");
  for (const sel of [".xp-top", ".xp-parts"]) expect(await box.locator(sel).evaluate((e) => e.scrollWidth <= e.clientWidth), `${sel} fits at 320 px`).toBe(true);
  const b = (await box.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(320);
});
