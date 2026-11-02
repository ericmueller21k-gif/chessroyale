import { expect, type Page } from "@playwright/test";
import { named, pickMode, test } from "./helpers.ts";

/**
 * Home (Eric's screenshots): one shadow under your pawn on a phone (the snowman's own ground shadow is hidden there), the
 * "Other modes" label 14 px under Chess Town's button, which is under PLAY (Oct 28: the line above PLAY, "Starts within" or
 * "Usually about", used to be under it, and the label 14 px under that; Nov 1: Chess Town's button between them), and your pawn hops on
 * a phone and a computer alike every 30 s (its first hop 4 s after home shows; FRONT_DOOR.heroHopFirstSec and
 * heroHopEverySec; never under reduced motion). Oct 24: the hop was phone-only, so a computer never hopped.
 */
const desktop = () => test.info().project.name === "desktop";

test("phone home: one shadow under your pawn; Chess Town's button right under PLAY and the Other modes label 14 px under it, the Starts-within line above PLAY", async ({ page }) => {
  test.skip(desktop(), "a phone's home");
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
    // (Above PLAY: the line's text ends within 8 px over PLAY's top edge.)
    const above = await page.evaluate(() => {
      const r = document.createRange();
      r.selectNodeContents(document.querySelector(".fd-hint")!);
      return document.querySelector(".fd-play")!.getBoundingClientRect().top - r.getBoundingClientRect().bottom;
    });
    expect(above, `${w}×${h}: the line above PLAY, ${above} px over it`).toBeGreaterThanOrEqual(0);
    expect(above, `${w}×${h}: the line just above PLAY`).toBeLessThanOrEqual(8);
    // (One shadow: the snowman's own is hidden, and the pawn's ::after shadow shows.)
    const pawn = page.locator(".fd-hero .fd-pawn.shadow");
    await expect(pawn.locator(".skin-shadow")).toHaveCount(1);
    expect(await pawn.locator(".skin-shadow").evaluate((el) => getComputedStyle(el).display), `${w}×${h}`).toBe("none");
    expect(await pawn.evaluate((el) => getComputedStyle(el, "::after").content), `${w}×${h}`).not.toBe("none");
    expect(Number(await pawn.evaluate((el) => getComputedStyle(el, "::after").opacity)), `${w}×${h}`).toBeGreaterThan(0);
    // (Nov 1: Chess Town's button is the column's gap (8 px) under PLAY; the gap from its bottom to the "Other modes" label's top is
    // the 14 px that was under PLAY, then the cards under the label.)
    const between = await page.evaluate(() => document.querySelector(".fd-town")!.getBoundingClientRect().top - document.querySelector(".fd-play")!.getBoundingClientRect().bottom);
    expect(Math.abs(between - 8), `${w}×${h}: Chess Town ${between} px under PLAY`).toBeLessThanOrEqual(1);
    const gap = await page.evaluate(() => document.querySelector(".fd-other-label")!.getBoundingClientRect().top - document.querySelector(".fd-town")!.getBoundingClientRect().bottom);
    expect(Math.abs(gap - 14), `${w}×${h}: the label ${gap} px under Chess Town`).toBeLessThanOrEqual(1);
    const under = await page.evaluate(() => document.querySelector(".rd-card")!.getBoundingClientRect().top - document.querySelector(".fd-other-label")!.getBoundingClientRect().bottom);
    expect(under, `${w}×${h}: the cards under the label`).toBeGreaterThanOrEqual(0);
  }
});

/**
 * Chess Town's button under three skies (Eric, Nov 1; docs/decisions/2026-11-01-chess-town-skies.md): the device's clock picks day
 * (06:00 to 17:00), dusk (17:00 to 19:00, the picture as drawn) or night (19:00 to 06:00, the lights on) as the page loads; ?sky= forces
 * one. Nothing hidden, nothing shifts: the button, PLAY and everything under them keep their boxes under all three, the name keeps
 * its look, and a sky picked at load doesn't swap while you look.
 */
test("Chess Town's button under day, dusk and night: the clock picks one as the page loads and keeps it, ?sky= forces one, and nothing moves or resizes", async ({ page }) => {
  await named(page, "Test2");
  const look = () =>
    page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".fd-town")!;
      const box = (sel: string) => {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10);
      };
      const label = getComputedStyle(b.querySelector(".fd-town-label")!);
      // The picture as painted (the canvas's own pixels): how bright it is on average, and how many pixels are painted.
      const cv = b.querySelector<HTMLCanvasElement>("canvas")!;
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4)
        if (px[i + 3]! > 200) {
          sum += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
          n++;
        }
      const sky = getComputedStyle(b).backgroundImage.match(/rgb\((\d+), (\d+), (\d+)\)/)!.slice(1).map(Number);
      return {
        sky: b.dataset.sky,
        town: box(".fd-town"),
        play: box(".fd-play"),
        other: box(".fd-other-label"),
        cards: box(".rd-card"),
        label: [label.color, label.webkitTextStrokeWidth, label.webkitTextStrokeColor, label.fontSize].join("|"),
        painted: n,
        picture: sum / n,
        // The sky's top color, how bright.
        skyTop: 0.299 * sky[0]! + 0.587 * sky[1]! + 0.114 * sky[2]!,
      };
    });
  const load = async (query: string) => {
    await page.goto("/" + query);
    await page.locator(".fd-town").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => (await look()).painted, `${query}: the picture is drawn`).toBeGreaterThan(500);
    return look();
  };
  // The clock picks it, at the device's own local time (every edge of the three windows).
  const byClock = async (h: number, m: number) => {
    await page.clock.setFixedTime(new Date(2026, 5, 15, h, m));
    return load("?town=A");
  };
  const edges = [
    [5, 59, "night"],
    [6, 0, "day"],
    [16, 59, "day"],
    [17, 0, "dusk"],
    [18, 59, "dusk"],
    [19, 0, "night"],
  ] as const;
  const seen: Record<string, Awaited<ReturnType<typeof look>>> = {};
  for (const [h, m, sky] of edges) {
    const l = await byClock(h, m);
    expect(l.sky, `${h}:${String(m).padStart(2, "0")}`).toBe(sky);
    seen[sky] = l;
  }
  // The three looks: lighter sky and picture by day than at dusk, and much darker at night; the same boxes and the same name.
  expect(seen.day!.skyTop).toBeGreaterThan(seen.dusk!.skyTop + 40);
  expect(seen.night!.skyTop).toBeLessThan(seen.dusk!.skyTop - 15);
  expect(seen.day!.picture).toBeGreaterThan(seen.dusk!.picture);
  expect(seen.night!.picture).toBeLessThan(seen.dusk!.picture * 0.6);
  for (const sky of ["day", "night"] as const)
    for (const k of ["town", "play", "other", "cards", "label"] as const) expect(seen[sky]![k], `${sky}: ${k} as at dusk`).toEqual(seen.dusk![k]);
  expect(seen.night!.label.startsWith("rgb(255, 255, 255)|"), "the name stays white with its outline").toBe(true);
  // ?sky= wins over the clock, in either direction; ?night=1 is night.
  expect((await load("?town=B&sky=night")).sky).toBe("night");
  await page.clock.setFixedTime(new Date(2026, 5, 15, 22, 0));
  expect((await load("?town=B&sky=day")).sky).toBe("day");
  expect((await load("?town=B&night=1")).sky).toBe("night");
  expect((await load("?town=B")).sky, "no ?sky=: the clock's 22:00").toBe("night");
  // Picked as the page loads and never swapping while you look: the clock passing 19:00 changes nothing until the next load.
  await page.clock.setFixedTime(new Date(2026, 5, 15, 18, 59));
  expect((await load("?town=B")).sky).toBe("dusk");
  await page.clock.setFixedTime(new Date(2026, 5, 15, 19, 1));
  await page.waitForTimeout(1200);
  const after = await look();
  expect(after.sky, "still the dusk it opened with").toBe("dusk");
  expect(after.town).toEqual(seen.dusk!.town);
  expect((await load("?town=B")).sky, "a new load at 19:01").toBe("night");
});

test("home: your pawn hops on a phone and a computer alike, 4 s after home shows and then every 30 s, never under reduced motion; the hop's animation runs", async ({ page }) => {
  test.setTimeout(180_000);
  await named(page, "Test2");
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
    // (The hop's timer starts in the pawn's effect, which waits for a frame: let two frames pass before the clock stops, or on a busy
    // runner the stop's jump runs that waiting frame at 1 s and the first hop comes at 5 s, so 4.5 s finds none. Oct 30, CI.)
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 0)))));
    const heroAt = await page.evaluate(() => (window as unknown as { __heroAt: number }).__heroAt);
    // (Freeze the clock a second after the hero shows, then run 70 s of it: the first hop at 4 s, the next at 34 s and at 64 s.)
    await page.clock.pauseAt(heroAt + 1000);
    // (Mid-hop, 4.5 s in: the hop's own animation is running on this layout, a phone's or a computer's.)
    await page.clock.runFor(3_500);
    const during = await page.evaluate(() => {
      const hop = document.querySelector(".fd-hero .fd-pawn.hop .fd-hop");
      return hop ? getComputedStyle(hop).animationName : null;
    });
    await page.clock.runFor(66_500);
    return {
      heroAt,
      during,
      log: await page.evaluate(() => (window as unknown as { __hopLog: [number, number][] }).__hopLog),
      classNow: await page.locator(".fd-hero .fd-pawn.hop").count(),
    };
  };

  const normal = await hopping(false);
  // Three hops of 1.8 s each: on, off, on, off, on, off, the next one 30 s after the one before.
  expect(normal.during, `${test.info().project.name}: the hop's animation runs`).toBe("fd-hop");
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
  expect(reduced.during).toBeNull();
  expect(reduced.classNow).toBe(0);
});
