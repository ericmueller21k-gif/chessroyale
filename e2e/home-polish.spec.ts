import { expect, type Page } from "@playwright/test";
import { named, pickMode, test } from "./helpers.ts";

/**
 * Home on a phone (Eric's screenshot): one shadow under your pawn (the snowman's own ground shadow is hidden there), your
 * pawn hops every 30 s (its first hop 4 s after home shows; FRONT_DOOR.heroHopFirstSec and heroHopEverySec; never under
 * reduced motion), and the Boss raid card sits 14 px under the one-line default hint ("Starts within", or "Usually about").
 */
const desktop = () => test.info().project.name === "desktop";

test("phone home: one shadow under your pawn; a hop 4 s after home shows and then every 30 s, never under reduced motion; the Boss raid card 14 px under the Starts-within line", async ({ page }) => {
  test.skip(desktop(), "a phone's home");
  test.setTimeout(180_000);
  await named(page, "Test2");
  // Dress your pawn as a snowman (its art draws its own ground shadow).
  await page.route(/\/api\/me(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.locker = { ...(body.locker ?? {}), look: { skin: { def: "snowman", color: "#f8fafc", blemish: 0, seed: 1 } } };
    await route.fulfill({ response: res, json: body });
  });

  for (const [w, h] of [
    [390, 844],
    [428, 777],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await pickMode(page);
    // (The default line: "Starts within", or "Usually about" once the server knows a wait. Both one line, both spaced the same.)
    await expect(page.locator(".fd-hint")).toHaveText(/^(Starts within \d+ s; bots fill any empty seats|Usually about \d+ s to find a match)$/);
    await expect(page.locator(".fd-hint.fd-hint-line")).toHaveCount(1);
    // (One shadow: the snowman's own is hidden, and the pawn's ::after shadow shows.)
    const pawn = page.locator(".fd-hero .fd-pawn.shadow");
    await expect(pawn.locator(".skin-shadow")).toHaveCount(1);
    expect(await pawn.locator(".skin-shadow").evaluate((el) => getComputedStyle(el).display), `${w}×${h}`).toBe("none");
    expect(await pawn.evaluate((el) => getComputedStyle(el, "::after").content), `${w}×${h}`).not.toBe("none");
    expect(Number(await pawn.evaluate((el) => getComputedStyle(el, "::after").opacity)), `${w}×${h}`).toBeGreaterThan(0);
    // (The gap: from the hint's line of text to the card's top.)
    const gap = await page.evaluate(() => {
      const r = document.createRange();
      r.selectNodeContents(document.querySelector(".fd-hint")!);
      return document.querySelector(".rd-card")!.getBoundingClientRect().top - r.getBoundingClientRect().bottom;
    });
    expect(Math.abs(gap - 14), `${w}×${h}: the card ${gap} px under the line`).toBeLessThanOrEqual(1);
  }

  // (The hop, on a fake clock: the hero's first show is the zero, and the pawn's hop classes are logged with the clock's time.)
  await page.clock.install();
  await page.addInitScript(() => {
    const w = window as unknown as { __heroAt?: number; __hopLog: [number, number][] };
    w.__hopLog = [];
    let on = false;
    new MutationObserver(() => {
      const pawn = document.querySelector(".fd-hero .fd-pawn");
      if (pawn && w.__heroAt === undefined) w.__heroAt = Date.now();
      const now = !!pawn && pawn.classList.contains("hop");
      if (now !== on) {
        on = now;
        w.__hopLog.push([Date.now(), now ? 1 : 0]);
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  });
  const hopping = async (reduced: boolean) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.clock.resume();
    await page.goto("/");
    await expect(page.locator(".fd-hero")).toBeVisible();
    const heroAt = await page.evaluate(() => (window as unknown as { __heroAt: number }).__heroAt);
    // (Freeze the clock a second after the hero shows, then run 70 s of it: the first hop at 4 s, the next at 34 s and at 64 s.)
    await page.clock.pauseAt(heroAt + 1000);
    await page.clock.runFor(70_000);
    return {
      heroAt,
      log: await page.evaluate(() => (window as unknown as { __hopLog: [number, number][] }).__hopLog),
      classNow: await page.locator(".fd-hero .fd-pawn.hop").count(),
    };
  };

  const normal = await hopping(false);
  // Three hops of 1.8 s each: on, off, on, off, on, off, the next one 30 s after the one before.
  expect(normal.log.map((e) => e[1])).toEqual([1, 0, 1, 0, 1, 0]);
  const [firstOn, firstOff, secondOn, , thirdOn] = normal.log.map((e) => e[0]);
  // (The first hop 4 s after the pawn first shows. The pawn is seen by a DOM observer, and under the fake clock that reading can
  // land a fraction of a second off from when the hop's timer starts: a quarter second either side. The gaps between hops are exact.)
  expect(firstOn - normal.heroAt, "the first hop, 4 s after home shows").toBeGreaterThanOrEqual(3750);
  expect(firstOn - normal.heroAt).toBeLessThanOrEqual(4250);
  expect(firstOff - firstOn).toBe(1800);
  expect(secondOn - firstOn, "then every 30 s").toBe(30_000);
  expect(thirdOn - secondOn).toBe(30_000);
  expect(normal.classNow).toBe(0);

  // Under reduced motion: no hop at all, not even the class.
  const reduced = await hopping(true);
  expect(reduced.log).toEqual([]);
  expect(reduced.classNow).toBe(0);
});
