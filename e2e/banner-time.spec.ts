import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_BANNER, BANNER_PLUS_MS } from "@chessroyale/core";
import { BOARD_SEL, asAdmin, test, bossAloneFromHome } from "./helpers.ts";

/**
 * Every banner over the board a boss banner's whole length, and nothing of what follows under it (Eric, Oct 24: "we need
 * the banners to appear… at least… 3/4 of a second longer… when the boss ults, when your queen is down, for any mode";
 * docs/decisions/2026-10-24-banner-and-speech-time.md). Measured as on Oct 16: Boss alone, real taps, every painted
 * frame. For each, how long its banner was on the page and when the first thing after it moved: the toy block's
 * flight, the Big Bounce's leap, Hollow's drop for Lights out, Leapfrog's hop, and, after Babur's warning and QUEEN
 * DOWN!, your turn. Each asserts the banner was up its length (BOSS_BANNER.ms and the extra) and that nothing moved
 * before it had gone.
 *
 * `BANNERPLUS=0 npx playwright test e2e/banner-time.spec.ts` plays them with `?bannerplus=0` (the switch: seconds), to
 * compare; each test logs its numbers ("banner-time: …").
 */
const asked = process.env.BANNERPLUS;
const plusMs = asked === undefined ? BANNER_PLUS_MS : Math.round(Number(asked) * 1000);
const plusParam = asked === undefined ? "" : `&bannerplus=${asked}`;
const shownMs = BOSS_BANNER.ms + plusMs;

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}
async function squareAt(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};
/** Your move, by tapping its squares (after a real think). */
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}
const state = (page: Page) => page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
/** A quiet move of yours, allowed now (one of `want` first). */
async function quietMove(page: Page, want: string[] = []): Promise<string> {
  await yourMove(page);
  const { fen, allowed } = await state(page);
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => m.from + m.to).filter((m) => !allowed || allowed.includes(m));
  return want.find((m) => legal.includes(m)) ?? legal.sort()[0]!;
}

type Seen = { banner: { first: number; last: number } | null; motion: number | null; gaps: number };
/**
 * Watches every painted frame from now: the banner with `text` (from its first frame on the page to the last its band
 * is over the board: it slides off by its length, and QUEEN DOWN!'s stays on the page, off the board, through the
 * boss's move) and the first frame, from the banner's first, where what comes after it shows (`motion`: a selector, or
 * `play`: your turn).
 */
async function watch(page: Page, text: RegExp, motion: string) {
  await page.evaluate(
    ({ src, flags, motion }) => {
      const w = window as any;
      const re = new RegExp(src, flags);
      const out: Seen = (w.__bannerTime = { banner: null, motion: null, gaps: 0 });
      let prev = 0;
      const frame = () => {
        const now = performance.now();
        if (prev && now - prev > 50) out.gaps++;
        prev = now;
        const el = [...document.querySelectorAll(".fight-banner")].find((e) => re.test(e.textContent ?? ""));
        const box = el?.getBoundingClientRect();
        const band = el?.querySelector(".fb-band")?.getBoundingClientRect();
        const over = !!box && !!band && Math.min(box.right, band.right) - Math.max(box.left, band.left) > 1;
        if (el && !out.banner) out.banner = { first: now, last: now };
        if (over && out.banner) out.banner.last = now;
        if (out.banner && out.motion === null && (motion === "play" ? w.match?.phase?.kind === "play" : !!document.querySelector(motion))) out.motion = now;
        if (out.motion === null || now - out.motion < 3000) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    { src: text.source, flags: text.flags, motion },
  );
}
const seen = (page: Page) => page.evaluate(() => (window as any).__bannerTime as Seen);

/** Its numbers, logged and checked: the banner up its length (within two frames), and nothing after it before it's gone. */
async function check(page: Page, what: string) {
  await expect.poll(async () => (await seen(page)).motion !== null, { timeout: 60_000 }).toBe(true);
  const s = await seen(page);
  const up = Math.round(s.banner!.last - s.banner!.first);
  const after = Math.round(s.motion! - s.banner!.last);
  console.log(`banner-time: ${what} bannerplus=${plusMs} up=${up}ms next=${after}ms after its last frame (frames over 50 ms: ${s.gaps})`);
  test.info().annotations.push({ type: "banner-time", description: `${what}: up ${up} ms, next ${after} ms after it` });
  // (Its band slides in from off the board and off it again by its length: a frame or so of each is off the board.)
  expect(up, `${what}: over the board`).toBeGreaterThanOrEqual(shownMs - 150);
  expect(up, `${what}: over the board`).toBeLessThanOrEqual(shownMs + 70);
  expect(s.motion!, `${what}: nothing after it while it's up`).toBeGreaterThan(s.banner!.last);
}

test("the toy block: TOY BLOCK! up its length, the block thrown after it", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await page.goto(`/?debug&clock=60&boss=bigboy&laststand=0${plusParam}`);
  await bossAloneFromHome(page);
  await yourMove(page);
  await watch(page, /TOY BLOCK!/, ".pw-flight.blockFly");
  await play(page, await quietMove(page, ["g1f3", "b1c3"]));
  await check(page, "TOY BLOCK! (Big Boy) → the throw");
});

test("the Big Bounce: BIG BOUNCE! up its length, his leap after it", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
  await page.goto(`/?debug&clock=60&boss=bigboy&laststand=0${plusParam}`);
  await bossAloneFromHome(page);
  await yourMove(page);
  await page.locator(".ult-test").click();
  await expect(page.locator(".ult-test")).toHaveAccessibleName("Ultimate next turn (testing)");
  await watch(page, /BIG BOUNCE!/, ".bb-layer .bb-boy");
  await play(page, await quietMove(page, ["g1f3", "b1c3"]));
  await check(page, "BIG BOUNCE! (Big Boy) → his leap");
});

test("Lights out: LIGHTS OUT! up its length, Hollow's drop after it", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
  await page.goto(`/?debug&clock=60&boss=hollow&laststand=0${plusParam}`);
  await bossAloneFromHome(page);
  await yourMove(page);
  await page.locator(".ult-test").click();
  await expect(page.locator(".ult-test")).toHaveAccessibleName("Ultimate next turn (testing)");
  await watch(page, /LIGHTS OUT!/, ".pm-lights .pm-hollow-spot");
  await play(page, "e2e4");
  await check(page, "LIGHTS OUT! (Hollow) → his drop");
});

test("Leapfrog: LEAPFROG! up its length (was 0.72 s), the hop after it", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await page.goto(`/?debug&clock=60&boss=hopper&power=leapfrog&laststand=0${plusParam}`);
  await bossAloneFromHome(page);
  await yourMove(page);
  const crowd = await page.evaluate(() => (window as any).match.boss.crowdSide as "w" | "b");
  await watch(page, /LEAPFROG!/, '.pm-hop .hp-layer[data-hop="air"]');
  await play(page, crowd === "w" ? "g1f3" : "b8c6");
  await check(page, "LEAPFROG! (Chub & Chirp) → the hop");
});

test("Babur's hoops: his warning, RAGE!, up its length, your turn after it (the hoops' cast has no banner of its own)", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&power=hoops${plusParam}`);
  await bossAloneFromHome(page);
  await yourMove(page);
  await watch(page, /RAGE!/, "play");
  for (let i = 0; i < 4 && !(await seen(page)).banner; i++) await play(page, await quietMove(page, ["g1f3", "b1c3", "g2g3", "b2b3"]));
  await check(page, "RAGE! (Babur's hoops warning) → your turn");
});

test("QUEEN DOWN!: up its length as the boss takes your queen, your turn after it", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto(`/?debug&clock=60&boss=bigboy&laststand=0&brain=stockfish${plusParam}`);
  await bossAloneFromHome(page);
  await watch(page, /QUEEN DOWN!/, "play");
  // Your queen out, then onto a square a lesser piece of his attacks (he takes it), as soon as there is one.
  for (let i = 0; i < 8 && !(await seen(page)).banner; i++) {
    await yourMove(page);
    const { fen, allowed } = await state(page);
    const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.promotion && (!allowed || allowed.includes(m.from + m.to)));
    const his = (m: (typeof legal)[number]) => {
      const c = new Chess(fen);
      c.move({ from: m.from, to: m.to });
      return c.attackers(m.to, m.color === "w" ? "b" : "w").map((sq) => c.get(sq)?.type);
    };
    const hang = legal.find((m) => m.piece === "q" && !m.captured && his(m).some((t) => t && t !== "q" && t !== "k"));
    const out = legal.find((m) => m.piece === "q" && !m.captured) ?? legal.find((m) => ["e2e4", "e7e5"].includes(m.from + m.to)) ?? legal.find((m) => !m.captured)!;
    const m = hang ?? out;
    await play(page, m.from + m.to);
  }
  await check(page, "QUEEN DOWN! (Big Boy takes it) → your turn");
});
