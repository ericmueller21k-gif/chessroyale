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
