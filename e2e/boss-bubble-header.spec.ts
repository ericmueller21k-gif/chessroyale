import { expect } from "@playwright/test";
import { asAdmin, bossAloneFromHome, test } from "./helpers.ts";

/**
 * The phone boss bar's words never cover its header (Eric and the coordinator, Nov 6): the name, the level, the meter, the
 * status ("60 moves left") and the prop's clock and turtle icons. The bubble sits under them, at the bar's bottom, to the right
 * of the portrait, in a bar of one fixed height that fits its three rows (styles.css --bar-h), so the board never jumps.
 * At 320 and 390 px on a phone; on a computer the bar isn't drawn, so its words aren't in it at all (1280 px).
 */
const BOX = (r: { x: number; y: number; w: number; h: number }) => ({ l: r.x, t: r.y, r: r.x + r.w, b: r.y + r.h });

test.describe.configure({ mode: "parallel" });

for (const w of [320, 390]) {
  test(`${w} px phone: the bar's words never cover its name, level, meter, status or prop icons`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the phone project only");
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: 844 });
    await asAdmin(page);
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=dash`);
    await bossAloneFromHome(page, "Dash");
    await expect(page.locator(".boss-bar")).toBeVisible({ timeout: 60_000 });
    const text = "Check! Bussin. Is that the word?";
    const hit = await page.evaluate(async (text) => {
      (globalThis as { sayBoss?: (t: string) => boolean }).sayBoss?.(text);
      await new Promise((r) => setTimeout(r, 2500));
      const bubble = document.querySelector<HTMLElement>(".bc-bar-bubble");
      if (!bubble) return { missing: true };
      const rect = (e: Element) => {
        const b = e.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const parts: Record<string, Element> = {};
      const q = (name: string, sel: string) => document.querySelectorAll(sel).forEach((e, i) => (parts[`${name}${i}`] = e));
      q("name", ".boss-name strong");
      q("level", ".boss-level .lv-text");
      q("meter", ".boss-ult");
      q("status", ".boss-next");
      q("move", ".boss-move");
      q("prop", ".boss-prop > *");
      q("passive", ".boss-passive > *");
      const b = BOX_OF(rect(bubble));
      const overlaps: string[] = [];
      for (const [k, e] of Object.entries(parts)) {
        const r = rect(e);
        if (r.w === 0 || r.h === 0) continue;
        const o = BOX_OF(r);
        if (b.l < o.r && b.r > o.l && b.t < o.b && b.b > o.t) overlaps.push(`${k} ${JSON.stringify(r)}`);
      }
      return { overlaps, bubble: rect(bubble), bar: rect(document.querySelector(".boss-bar")!), fs: getComputedStyle(bubble).fontSize };
      function BOX_OF(r: { x: number; y: number; w: number; h: number }) {
        return { l: r.x, t: r.y, r: r.x + r.w, b: r.y + r.h };
      }
    }, text);
    expect(hit, "the bubble is up").not.toHaveProperty("missing", true);
    if ("overlaps" in hit) {
      expect(hit.fs, "the shared font").toBe("9px");
      expect(hit.overlaps, `${w} px: the words cover nothing of the header`).toEqual([]);
    }
  });
}

test("1280 px computer: the bar isn't drawn, so its words never cover anything in it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the computer project only");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await asAdmin(page);
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=dash`);
  await bossAloneFromHome(page, "Dash");
  await expect(page.locator(".boss-bar")).toBeHidden({ timeout: 60_000 }).catch(() => undefined);
  const shown = await page.evaluate(() => {
    const e = document.querySelector<HTMLElement>(".bc-bar-bubble");
    return e ? getComputedStyle(e).display : "none";
  });
  expect(shown, "no bar bubble on a computer").toBe("none");
});
