import { expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { BOSS_KITS } from "../packages/app/src/characters/kits.ts";
import { asAdmin, bossAloneFromHome, test } from "./helpers.ts";

/**
 * One size for every boss-battle figure on a computer (Eric, Nov 7: "how are the king and the pawn so different sized … shrink the ones
 * that are currently larger … about a 15% shrink"; docs/decisions/2026-11-07-one-side-size.md). At each window size every boss is drawn
 * at the same screen px a sprite px (Babur too, his pump in front of him), and your pawn and the God King are as tall in every fight.
 * Bosses: Babur (his pump), Big Boy, the Hidden Boss (the tallest), Jefferson (tall) and Dash. A number check: the figures' boxes.
 */
const BOSSES = ["tiger", "bigboy", "recluse", "grex", "dash"];
const SIZES = [[1100, 800], [1280, 800], [1440, 900], [1920, 1080]] as const;
const kitOf = (id: string) => Object.values(BOSS_KITS).find((k) => k.ch.id === id)!;

test("one size beside the board on a computer: every boss the same screen px a sprite px at a window size, your pawn and the God King as tall in every fight", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "the side figures grow on a computer only");
  test.setTimeout(240_000);
  await asAdmin(page);
  await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
  const seen: Record<string, Record<string, { s: number; pawn: number; king: number; pump: string | null; board: number }>> = {};
  for (const id of BOSSES) {
    await page.setViewportSize({ width: 1280, height: 800 });
    // (The Hidden Boss opens as the child since Nov 13: `form=adult` meets the man these kits measure.)
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${id}${id === "recluse" ? "&form=adult" : ""}`);
    await bossAloneFromHome(page);
    await expect.poll(() => page.evaluate(() => (window as any).match?.phase.kind ?? "none"), { timeout: 60_000 }).toBe("play");
    await expect(page.locator(".boss-char.place-side .boss-char-sprite")).toBeVisible();
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const box = (q: string) => document.querySelector(q)?.getBoundingClientRect() ?? null;
        return {
          cv: box(".boss-char.place-side .boss-char-sprite")?.width ?? 0,
          pawn: box(".boss-dock .you-pawn-bob")?.height ?? 0,
          king: box(".boss-dock .gk-unit .gk-canvas")?.height ?? 0,
          pump: document.querySelector(".tg-pump-slot")?.getAttribute("data-place") ?? null,
          board: box(".board-row .board-wrap")?.width ?? 0,
        };
      });
      (seen[`${w}x${h}`] ??= {})[id] = { s: Math.round((r.cv / kitOf(id).ch.w) * 1000) / 1000, pawn: Math.round(r.pawn * 10) / 10, king: Math.round(r.king * 10) / 10, pump: r.pump, board: r.board };
      if (process.env.STILLS && w === 1440) {
        mkdirSync(process.env.STILLS, { recursive: true });
        await page.screenshot({ path: `${process.env.STILLS}/${id}-${w}.png` });
      }
    }
  }
  for (const [k, v] of Object.entries(seen)) for (const [id, b] of Object.entries(v)) console.log(k, id, JSON.stringify(b));
  for (const [size, byBoss] of Object.entries(seen)) {
    const first = byBoss[BOSSES[0]!]!;
    for (const id of BOSSES) {
      const b = byBoss[id]!;
      expect(b.s, `${size}: ${id}'s screen px a sprite px, as ${BOSSES[0]}'s`).toBeCloseTo(first.s, 2);
      expect(Math.abs(b.pawn - first.pawn), `${size}: your pawn in ${id}'s fight ${b.pawn} as tall as in ${BOSSES[0]}'s ${first.pawn}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(b.king - first.king), `${size}: the God King in ${id}'s fight ${b.king} as tall as in ${BOSSES[0]}'s ${first.king}`).toBeLessThanOrEqual(0.5);
      expect(b.board, `${size}: ${id}'s board as big as ${BOSSES[0]}'s`).toBe(first.board);
    }
    // (Babur's pump in front of him, not in a taller bar, from 1100 px wide.)
    expect(byBoss.tiger!.pump, `${size}: Babur's pump beside him`).toBe("side");
  }
});
