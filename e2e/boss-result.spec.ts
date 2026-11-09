import { expect, type Page } from "@playwright/test";
import { test, bossAloneFromHome, submitMove } from "./helpers.ts";

/**
 * Eric, Nov 7: a boss battle's result screen has no trophy or skull above its title, its title in the God King's pixel type,
 * no record text ("A win on your record", "It counts as a loss"), and the boss's line in its bubble (a victory when it wins,
 * a defeat when you do). Phone and computer. Since Nov 9 (docs/decisions/2026-11-09-boss-result-v2.md): no God King, the boss and
 * your pawn facing each other with your XP under it; a loss plays the boss's attack on your pawn, never touching it (16 px). RESULT_SHOTS=<dir> saves the two result screens (phone and computer) there.
 */
const SHOTS = process.env.RESULT_SHOTS;

/**
 * Every frame of the result's row from the page's start (`__duo`): the attack's stage and frame, whether his usual figure is hidden,
 * your pawn's jolt (its translate, px) and the painted gap: from the right of his painted figure (or his attack's) to the left of your
 * pawn's art box (bigger than the pawn: the true gap is wider), each canvas's opaque columns mapped to the screen, mirrored or not.
 */
async function watchDuo(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __duo: unknown[] };
    w.__duo = [];
    const painted = (cv: HTMLCanvasElement) => {
      const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let a = cv.width,
        z = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) ((a = Math.min(a, x)), (z = Math.max(z, x)));
      if (z < 0) return null;
      const r = cv.getBoundingClientRect();
      const k = r.width / cv.width;
      const flip = getComputedStyle(cv).transform !== "none" || getComputedStyle(cv.parentElement!).transform !== "none";
      return flip ? r.right - a * k : r.left + (z + 1) * k;
    };
    const frame = () => {
      const duo = document.querySelector(".results-duo");
      if (duo) {
        const attack = document.querySelector<HTMLCanvasElement>(".rd-attack canvas");
        const fig = document.querySelector<HTMLCanvasElement>(".results-duo .boss-char-sprite");
        const right = attack ? painted(attack) : fig ? painted(fig) : null;
        const pawn = document.querySelector(".results-duo .you-pawn-hop")?.getBoundingClientRect();
        const jolt = document.querySelector(".results-duo .rd-pawn");
        w.__duo.push({
          stage: duo.getAttribute("data-attack") ?? "none",
          frame: attack?.getAttribute("data-frame") ?? null,
          figureHidden: !!fig && getComputedStyle(fig).visibility === "hidden",
          shift: jolt ? parseFloat(getComputedStyle(jolt).translate) || 0 : 0,
          gap: right !== null && pawn ? pawn.left - right : null,
          past: right !== null && pawn ? right - pawn.right : null,
        });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
type DuoSample = { stage: string; frame: string | null; figureHidden: boolean; shift: number; gap: number | null; past: number | null };
const duoSamples = (page: Page) => page.evaluate(() => (window as unknown as { __duo: DuoSample[] }).__duo);

async function resultOf(page: Page, project: string, name: string) {
  const results = page.locator(".results");
  await expect(results.locator("h1")).toHaveClass(/boss-title/);
  // No trophy and no skull above the title: nothing before the title in the top part.
  await expect(results.locator(".trophy")).toHaveCount(0);
  await expect(results).not.toContainText("💀");
  await expect(results).not.toContainText("🏆");
  // No record line, win or loss counted, in any words.
  await expect(results).not.toContainText(/on your record|counts as a (win|loss)|a win on|a loss on/i);
  // The boss's line in its bubble, typed out in full (its rest, not yet typed, is empty), inside the screen with a 16 px gutter
  // on each side, centered over him.
  const bubble = results.locator(".bc-bubble");
  await expect(bubble).not.toBeEmpty({ timeout: 15_000 });
  await expect(bubble.locator(".speech-rest")).toHaveText("", { timeout: 15_000 });
  // Fully opaque (its entrance has faded in): the still and the checks read it as it reads.
  await expect.poll(() => bubble.evaluate((e) => getComputedStyle(e).opacity), { timeout: 15_000 }).toBe("1");
  const line = (await bubble.locator(".speech-line").innerText()).trim();
  // (Not a length floor: a short line such as "Ouch!" is a real line; the empty-rest check above is what says it's complete.)
  expect(line.length, "a line").toBeGreaterThan(0);
  // (The full line: what's typed (the shown part) is all of it now.)
  expect(await bubble.locator(".speech-line").textContent()).toContain(line);
  const vw = page.viewportSize()!.width;
  const box = (await bubble.boundingBox())!;
  expect(box.x, "left gutter").toBeGreaterThanOrEqual(16);
  expect(box.x + box.width, "right gutter").toBeLessThanOrEqual(vw - 16);
  const boss = (await page.locator(".boss-char.place-results").boundingBox())!;
  // (Nov 9: the boss is on the row's left, so his words start over him, his tail over his middle, rather than centered on him.)
  expect(box.x, "starting over him").toBeLessThanOrEqual(boss.x + boss.width / 2);
  expect(box.x + box.width, "reaching past his middle").toBeGreaterThan(boss.x + boss.width / 2);
  expect(box.y + box.height, "above him").toBeLessThanOrEqual(boss.y);
  // Eric, Nov 9: no God King on a boss result; one row, the boss on the left and your pawn on the right, your name and XP (the
  // compact box) under your pawn, and only one XP box on the screen.
  await expect(results.locator(".god-king, .gk-epilogue")).toHaveCount(0);
  const duo = results.locator(".results-duo");
  const pawn = (await duo.locator(".rd-you .you-pawn").boundingBox())!;
  expect(boss.x + boss.width / 2 < pawn.x + pawn.width / 2, "the boss on the left of your pawn").toBe(true);
  await expect(results.getByTestId("xp-box")).toHaveCount(1);
  const xp = duo.locator(".rd-you").getByTestId("xp-box");
  await expect(xp).toHaveClass(/xp-compact/);
  expect((await xp.boundingBox())!.y, "your XP under your pawn").toBeGreaterThanOrEqual(pawn.y + pawn.height - 1);
  for (const r of [pawn, (await xp.boundingBox())!]) {
    expect(r.x, "left gutter").toBeGreaterThanOrEqual(16);
    expect(r.x + r.width, "right gutter").toBeLessThanOrEqual(vw - 16);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` });
  // No solo "Unranked" note on a boss battle (Eric, Nov 8: it says nothing of ranking).
  await expect(results).not.toContainText("Unranked: solo");
}

test("a boss battle's victory and defeat screens: the title in the pixel type, no trophy or skull, no record text, the boss's line", async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  // A boss beats you at once (?mate=1): Defeated, and the boss's victory line. Hollow, named: START's random pick can be
  // Wrangler or Sawyer, whose first move is a power's (the long pull; a pawn move for the split), not the mate, so the
  // battle went on and the result never came (main's red, Nov 9: 2026-11-09-boss-result-red.md).
  await watchDuo(page);
  await page.goto("/?debug&pace=quick&mate=1&boss=hollow");
  await bossAloneFromHome(page);
  await expect(page.locator(".results h1")).toHaveText("Defeated", { timeout: 120_000 });
  // His attack on your pawn (Eric, Nov 9): it plays (its frames advance, his usual figure hidden), your pawn jolts back, then his
  // usual figure again. At rest (before and after) his painted figure is at least 16 px from your pawn (Eric's rule: nothing touches);
  // his attack's blow lands on your pawn (pies, ink, the lasso fly to it, as to a king) but never passes it (2026-11-09-boss-result-v2.md).
  await expect(page.locator(".results-duo")).toHaveAttribute("data-attack", "done", { timeout: 10_000 });
  const s = await duoSamples(page);
  const on = s.filter((x) => x.stage === "on");
  expect(new Set(on.map((x) => x.frame)).size, "the attack's frames advance").toBeGreaterThan(8);
  expect(on.every((x) => x.figureHidden), "his usual figure hidden while he attacks").toBe(true);
  expect(on.some((x) => x.shift > 3), "your pawn jolts back").toBe(true);
  expect(s.at(-1)!.stage).toBe("done");
  for (const x of s) {
    if (x.stage !== "on" && x.gap !== null) expect(x.gap, `16 px between the boss and your pawn (${x.stage})`).toBeGreaterThanOrEqual(16);
    if (x.stage === "on" && x.past !== null) expect(x.past, `his attack never passes your pawn (${x.frame})`).toBeLessThanOrEqual(0);
  }
  await resultOf(page, testInfo.project.name, "defeat");
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
});

test("a boss battle won: Victory!, no trophy or skull, no record text, the boss's defeat line", async ({ page }, testInfo) => {
  test.setTimeout(3 * 60_000);
  // You mate the boss at once (?win=1): Victory!, and the boss's defeat line.
  await watchDuo(page);
  await page.goto("/?debug&pace=quick&win=1");
  await bossAloneFromHome(page);
  // Your move (?win=1: Qxf7 mates him, from h5).
  await expect.poll(() => page.evaluate(() => (window as any).match?.phase?.kind), { timeout: 60_000 }).toBe("play");
  await submitMove(page, "h5f7");
  await expect(page.locator(".results h1")).toHaveText("Victory!", { timeout: 120_000 });
  await resultOf(page, testInfo.project.name, "victory");
  // A win: no attack (his defeat as before), and the two 16 px apart throughout.
  const s = await duoSamples(page);
  expect(s.some((x) => x.stage === "on"), "no attack on a win").toBe(false);
  for (const x of s) if (x.gap !== null) expect(x.gap, "16 px between the boss and your pawn").toBeGreaterThanOrEqual(16);
});
