import { expect } from "@playwright/test";
import { named, test } from "./helpers.ts";

/**
 * The crate opening's "FISCHER RANDOM!" banner fits its words at every width (DECISIONS.md, "The computer's play
 * column, your icon, no sun"): on a computer it was cut off at both ends and top and bottom. Measured every animation
 * frame while it's up: the face and the words within the stage's width, the words within the band, the band within the
 * stage; and the words big enough to read.
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
        log.push({
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
  const widths = test.info().project.name === "desktop" ? [1024, 1280, 1920] : [320, 390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/shop?crates&fischer=1");
    await page.locator(".crate-row").first().click();
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
    expect(least("text"), `${width}: text px`).toBeGreaterThanOrEqual(18);
    expect(least("sub"), `${width}: line px`).toBeGreaterThanOrEqual(11);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
});
