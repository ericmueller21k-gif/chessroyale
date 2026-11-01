import { expect } from "@playwright/test";
import { crateDef, itemDef } from "@chessroyale/core";
import { named, test } from "./helpers.ts";

/**
 * Two crates (Beta Crate · Series 001 joined Winter, Oct 11, 2026): you choose one, its page shows its own boxes
 * (supply boxes or presents) and odds, and opening it spins its own boxes and lands on one of its own items. On a
 * phone and a computer, with nothing sideways-scrolling.
 */
test("crates: choose either crate; each shows its own boxes, spins them and opens to its own items", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Two Crates");
  await page.goto("/shop?crates");
  await expect(page.locator(".crate-row")).toHaveCount(2);
  for (const [id, box] of [
    ["beta-001", ".supply-art"],
    ["winter-1", ".present-art:not(.supply-art)"],
  ] as const) {
    const crate = crateDef(id)!;
    await page.locator(`.crate-row[data-crate="${id}"]`).click();
    await expect(page.locator(".crate-hero strong")).toHaveText(crate.name.replace(" · ", " ")); // (the series on its own line)
    // A box for each of the four tiers, then Fischer Random, then every item with its chance.
    await expect(page.locator(`.odds-row ${box}`)).toHaveCount(4);
    await expect(page.locator(".odds-row")).toHaveCount(5 + crate.items.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.getByRole("button", { name: /Open · uses 1 key/ }).click();
    await expect(page.locator(`.spin-tile.present ${box}`).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".reveal-card")).toBeVisible({ timeout: 25_000 });
    const name = (await page.locator(".reveal-name").textContent())?.trim();
    expect(crate.items.map((i) => itemDef(i)!.name)).toContain(name);
    await page.getByRole("button", { name: "▶ Done" }).click();
    await page.getByRole("button", { name: "‹ Crates" }).click();
  }
});

/**
 * The crate pages' gambling warning (Eric, Nov 1): a small red ring, see-through in the middle, with a solid red "!" in it, at the top
 * right of the Crates tab and of each crate's page, always there and taking no room; a tap opens a short message box with a Close
 * button, which moves nothing; Close, Escape and a tap outside it close the box.
 */
test("crates: the gambling warning's red ring is always at the top of the crate pages and moves nothing; a tap opens its message box, Close puts it away", async ({ page }) => {
  await named(page, "Warned");
  await page.goto("/shop?crates");
  await expect(page.locator(".crate-row")).toHaveCount(2);
  const ring = page.getByRole("button", { name: "Gambling warning" });
  const message = page.getByRole("dialog", { name: "Gambling warning" });
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const boxes = (sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => Object.values(e.getBoundingClientRect().toJSON()).map((v) => Math.round(Number(v) * 10) / 10)));
  const near = async (name: string, content: string) => {
    // The ring is red, hollow in the middle with a solid red "!" in it, small, and in the page's top right corner area.
    await expect(ring, `${name}: always there`).toBeVisible();
    const look = await ring.evaluate((b) => {
      const svg = b.querySelector("svg")!;
      const circle = svg.querySelector("circle")!;
      const solid = [...svg.querySelectorAll("path, circle")].filter((e) => e !== circle);
      const css = getComputedStyle(b);
      return { color: css.color, hollow: circle.getAttribute("fill") === "none", solid: solid.length > 0 && solid.every((e) => e.getAttribute("fill") === "currentColor"), w: svg.getBoundingClientRect().width };
    });
    const [r, g, bl] = look.color.match(/\d+/g)!.map(Number);
    expect(r! > 180 && g! < 120 && bl! < 120, `${name}: red (${look.color})`).toBe(true);
    expect(look.hollow, `${name}: see-through in the middle`).toBe(true);
    expect(look.solid, `${name}: a solid "!"`).toBe(true);
    expect(look.w, `${name}: small`).toBeLessThanOrEqual(36);
    const b = (await ring.boundingBox())!;
    const hero = (await page.locator(content).first().boundingBox())!;
    const column = (await page.locator(".crates, .crate-page").first().boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(b.x + b.width, `${name}: at the right of the page's column`).toBeGreaterThan(column.x + column.width - 12);
    expect(b.x + b.width, `${name}: not off the page`).toBeLessThanOrEqual(vw);
    expect(b.y, `${name}: near the top`).toBeLessThan(hero.y);
    expect(b.width, `${name}: a full tap target`).toBeGreaterThanOrEqual(40);
    // Opening and closing the message moves nothing else on the page.
    const before = await boxes(".crates > *:not(.gamble-ring):not(.locker-dialog-back), .crate-page > *:not(.gamble-ring):not(.locker-dialog-back), .shop-head, .area-tabs");
    await ring.click();
    await expect(message, `${name}: the message box`).toBeVisible();
    await expect(message).toContainText("Crates are chance, like gambling. Only spend money you're okay losing.");
    await expect(message).toHaveText("Crates are chance, like gambling. Only spend money you're okay losing.▶ Close");
    expect(await boxes(".crates > *:not(.gamble-ring):not(.locker-dialog-back), .crate-page > *:not(.gamble-ring):not(.locker-dialog-back), .shop-head, .area-tabs"), `${name}: nothing moved while it's open`).toEqual(before);
    const m = (await message.boundingBox())!;
    expect(m.x, `${name}: inside the screen`).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width, `${name}: inside the screen`).toBeLessThanOrEqual(vw);
    await message.getByRole("button", { name: "Close" }).click();
    await expect(message).toHaveCount(0);
    expect(await boxes(".crates > *:not(.gamble-ring):not(.locker-dialog-back), .crate-page > *:not(.gamble-ring):not(.locker-dialog-back), .shop-head, .area-tabs"), `${name}: nothing moved after it closes`).toEqual(before);
    // (Escape, and a tap outside the box, close it too.)
    await ring.click();
    await expect(message).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(message).toHaveCount(0);
    await ring.click();
    await page.locator(".locker-dialog-back").click({ position: { x: 4, y: 4 } });
    await expect(message).toHaveCount(0);
    expect(await sideways(), `${name}: nothing sideways`).toBe(0);
  };
  // The Crates tab, then each crate's own page.
  await near("the Crates tab", ".crate-stock");
  for (const id of ["beta-001", "winter-1"]) {
    await page.locator(`.crate-row[data-crate="${id}"]`).click();
    await expect(page.locator(".crate-hero")).toBeVisible();
    await near(`${id}'s page`, ".crate-hero");
    await page.getByRole("button", { name: "‹ Crates" }).click();
    await expect(page.locator(".crate-row")).toHaveCount(2);
  }
});

/**
 * The crate opening's "FISCHER RANDOM!" banner fits its words at every width (DECISIONS.md, "The computer's play
 * column, your icon, no sun"): on a computer it was cut off at both ends and top and bottom. Measured every animation
 * frame while it's up: the face and the words within the stage's width, the words within the band (its slanted edges
 * too), the band within the stage; and the words big enough to read.
 */
test("crates: the Fischer Random banner fits its words, phone and computer, with readable text", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Crate Opener");
  await page.addInitScript(() => {
    const log: Record<string, number>[] = ((window as any).__fb = []);
    const tick = () => {
      const stage = document.querySelector<HTMLElement>(".fischer-stage");
      const band = stage?.querySelector<HTMLElement>(".fb-band");
      const words = stage?.querySelector<HTMLElement>(".fb-words");
      const text = stage?.querySelector<HTMLElement>(".fb-text");
      const sub = stage?.querySelector<HTMLElement>(".fb-sub");
      const face = stage?.querySelector<HTMLElement>(".fb-face");
      if (stage && band && words && text && sub && face) {
        const cs = getComputedStyle(band);
        const inner = band.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        // The band slants 7° while the words stay level: how far each line's box stays inside the band's slanted
        // edges (its top-left corner under the top edge, its bottom-right above the bottom edge), once the slam has
        // settled (scale 1). Negative: cut off, as the tops of "FISCHER" were on an iPhone (Oct 15).
        const b = band.getBoundingClientRect();
        const tan = Math.tan((7 * Math.PI) / 180);
        const cx = (b.left + b.right) / 2;
        const cy = (b.top + b.bottom) / 2;
        const clear = (e: HTMLElement) => {
          const t = e.getBoundingClientRect();
          const top = cy - band.offsetHeight / 2 + parseFloat(cs.borderTopWidth) - tan * (t.left - cx);
          const bottom = cy + band.offsetHeight / 2 - parseFloat(cs.borderBottomWidth) - tan * (t.right - cx);
          return Math.min(t.top - top, bottom - t.bottom);
        };
        const settled = ["1", "none"].includes(getComputedStyle(text).scale);
        log.push({
          clear: settled ? Math.min(clear(text), clear(sub)) : Infinity,
          // (The share of the stage's width the face and the words take.)
          wide: (face.offsetWidth + parseFloat(cs.columnGap) + Math.max(text.scrollWidth, sub.scrollWidth)) / stage.clientWidth,
          tall: words.offsetHeight - inner,
          face: face.offsetHeight - band.clientHeight,
          band: band.offsetHeight - stage.clientHeight,
          text: parseFloat(getComputedStyle(text).fontSize),
          sub: parseFloat(getComputedStyle(sub).fontSize),
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const widths = test.info().project.name === "desktop" ? [1024, 1280, 1920] : [320, 390, 430];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/shop?crates&fischer=1");
    await page.locator('.crate-row[data-crate="beta-001"]').click();
    // (The test switch applies once your account says you may: this server's TEST_SWITCHES.)
    await expect(page.getByLabel("Land on Fischer Random")).toBeChecked();
    await page.getByRole("button", { name: /Open · uses 1 key/ }).click();
    await expect(page.locator(".fischer-stage")).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => ((window as any).__fb.length = 0));
    await expect(page.locator(".fischer-stage")).toHaveCount(0, { timeout: 10_000 });
    const log = await page.evaluate(() => (window as any).__fb as Record<string, number>[]);
    // (See the item, so the next opening doesn't resume at this one's reveal.)
    await page.getByRole("button", { name: "▶ Done" }).click({ timeout: 15_000 });
    expect(log.length, `${width}`).toBeGreaterThan(20);
    const worst = (k: string) => Math.max(...log.map((r) => r[k]!));
    const least = (k: string) => Math.min(...log.map((r) => r[k]!));
    // (Room to spare across the width: an iPhone's or a Mac's font can run wider than headless Chrome's.)
    expect(worst("wide"), `${width}: share of the stage's width`).toBeLessThanOrEqual(0.9);
    expect(worst("tall"), `${width}: taller than the band by`).toBeLessThanOrEqual(1);
    expect(worst("face"), `${width}: the face taller than the band by`).toBeLessThanOrEqual(0);
    expect(worst("band"), `${width}: the band taller than the stage by`).toBeLessThanOrEqual(0);
    // (Settled frames were measured, and the words stay 2 px or more inside the slanted band in all of them.)
    expect(log.filter((r) => r.clear !== Infinity).length, `${width}: settled frames`).toBeGreaterThan(10);
    expect(least("clear"), `${width}: words inside the slanted band by`).toBeGreaterThanOrEqual(2);
    expect(least("text"), `${width}: text px`).toBeGreaterThanOrEqual(18);
    expect(least("sub"), `${width}: line px`).toBeGreaterThanOrEqual(11);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
});
