import { expect } from "@playwright/test";
import { BOSS_ROSTER,  } from "@chessroyale/core";
import { BOSS_KITS } from "../packages/app/src/characters/kits.ts";
import { asAdmin, bossAloneFromHome, test } from "./helpers.ts";

/**
 * Every boss's words in the phone's boss bar are the God King's bubble (Eric, Nov 6: "All should have the same design"): the
 * same font size (the speech font, 9 px), padding, outline and tail, and the box stays inside its bar. Eric's Nov 6 still showed
 * Dash's longest line in a giant font that ran out of the bar; this renders each boss's longest line on a 390 px phone and checks
 * that its font is the shared size, that it's inside the bar, and that at most three rows are shown (the rest clamps).
 */
const SHARED_FONT = "9px";
const BOSSES = ["Dash", "Ginger", "Boingo the Clown", "Big Boy", "Timber"];

/** The longest line a boss says (its kit's lines, and its fall). */
const longestOf = (kit: string): string => {
  const k = BOSS_KITS[kit]!;
  const all = [...Object.values(k.lines).flatMap((v) => [...(v ?? [])]), ...(k.fall ?? [])];
  return all.reduce((a, b) => (b.length > a.length ? b : a));
};

test.describe.configure({ mode: "parallel" });
test.skip(({ isMobile }) => !isMobile, "the phone project only: the bar's bubble is the phone's");

for (const name of BOSSES) {
  const def = BOSS_ROSTER.find((d) => d.name === name)!;
  test(`${name}'s longest line in the phone bar: the shared font, inside the bar, at most three rows`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    // (Dash and Timber are admin-first, BOSS_ADMIN_FIRST: an admin sees them on the boss select.)
    if (name === "Dash" || name === "Timber") await asAdmin(page);
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${def.id}`);
    await bossAloneFromHome(page, name);
    await expect(page.locator(".boss-bar")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".boss-bar .boss-name strong")).toHaveText(name);
    const text = longestOf(def.kit!);
    const r = await page.evaluate(async (text) => {
      const say = (globalThis as { sayBoss?: (t: string) => boolean }).sayBoss;
      if (!say) return { missing: true };
      say(text);
      // (Waits until the line is up, typed out and laid out.)
      const until = performance.now() + 4000;
      let el: HTMLElement | null = null;
      while (performance.now() < until) {
        el = document.querySelector<HTMLElement>(".bc-bar-bubble");
        if (el && el.getAttribute("aria-label") === text) break;
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 100));
      for (const a of el?.getAnimations({ subtree: true }) ?? []) {
        try {
          a.finish();
        } catch {
          // (A finished animation can't be finished again.)
        }
      }
      if (!el) return { missing: true };
      const bar = document.querySelector(".boss-bar")!.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const clip = el.querySelector<HTMLElement>(".speech-clip")!;
      const lh = parseFloat(cs.lineHeight);
      const tail = getComputedStyle(el, "::after");
      return {
        font: cs.fontSize,
        tsa: cs.webkitTextSizeAdjust || cs.getPropertyValue("text-size-adjust"),
        tailBorder: tail.borderLeftWidth,
        inside: b.left >= bar.left && b.right <= bar.right && b.top >= bar.top && b.bottom <= bar.bottom,
        rows: Math.round(clip.clientHeight / lh),
        clamped: clip.scrollHeight > clip.clientHeight,
        len: text.length,
      };
    }, text);
    expect(r, `${name}'s bubble is up`).not.toHaveProperty("missing", true);
    if ("font" in r) {
      expect(r.font, `${name}: shared font size`).toBe(SHARED_FONT);
      expect(r.tsa, `${name}: the browser keeps the speech font's size`).toMatch(/^100%$/);
      expect(r.tailBorder, `${name}: the tail`).not.toBe("0px");
      expect(r.inside, `${name}: the bubble inside the bar`).toBe(true);
      expect(r.rows, `${name}: at most three rows`).toBeLessThanOrEqual(3);
    }
  });
}
