import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { BOARD_SEL, asAdmin, bossAloneFromHome, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * Timber, the beaver builder (docs/decisions/2026-11-01-timber.md), in the game for admins first (BOSS_ADMIN_FIRST): his tile
 * only on an admin's Boss raid screen; Boss alone with the test switches: the workshop strip in the boss bar (five pieces, their
 * counts, filling on the battle's clock: `?seedspeed=` runs the page's clock faster) that never moves anything; a drop
 * (`&power=scraps`: his pawn finished, dropped at the end of his first turn onto his half); and the Gnaw (the admins' trigger):
 * its banner, his teeth on the board, one of your pawns gone.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** Your move: a knight to an empty square when it may, else the first allowed. */
async function playOne(page: Page) {
  await yourMove(page);
  const s = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
  const legal = new Chess(s.fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), knight: m.piece === "n" && !m.captured }));
  const ok = legal.filter((m) => !s.allowed || s.allowed.includes(m.uci)).sort((a, b) => (a.uci < b.uci ? -1 : 1));
  await submitMove(page, (ok.find((m) => m.knight) ?? ok[0])!.uci, s.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/** Every frame: the power events shown, the banners' words, the strip's and the board's boxes, his teeth seen on the board. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__tb = { kinds: [] as string[], banners: [] as string[], strip: [] as string[], board: [] as string[], teeth: [] as string[], plank: [] as string[] };
    const box = (el: Element | null) => {
      if (!el) return "";
      const r = el.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    };
    const look = () => {
      const r = w.__tb;
      for (const e of w.match?.boss?.powers?.events ?? []) if (!r.kinds.includes(e.kind)) r.kinds.push(e.kind);
      for (const b of document.querySelectorAll(".fight-banner")) {
        const t = (b.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t && !r.banners.includes(t)) r.banners.push(t);
      }
      const s = box(document.querySelector(".ws-strip"));
      if (s && !r.strip.includes(s)) r.strip.push(s);
      const bd = box(document.querySelector(".board-wrap"));
      if (bd && !r.board.includes(bd)) r.board.push(bd);
      for (const el of document.querySelectorAll(".tb-teeth")) if (!r.teeth.includes((el as HTMLElement).dataset.square)) r.teeth.push((el as HTMLElement).dataset.square);
      for (const el of document.querySelectorAll(".tb-plank")) if (!r.plank.includes((el as HTMLElement).dataset.square)) r.plank.push((el as HTMLElement).dataset.square);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const seen = (page: Page) => page.evaluate(() => (window as any).__tb as { kinds: string[]; banners: string[]; strip: string[]; board: string[]; teeth: string[]; plank: string[] });
const strip = (page: Page) => page.locator(".ws-strip").getAttribute("data-prog");
const pawns = (fen: string, color: "w" | "b") => fen.split(" ")[0]!.split("").filter((c) => c === (color === "w" ? "P" : "p")).length;

test.describe("Timber", () => {
  test("admins first: no tile for a player; an admin's Boss raid screen has his tile", async ({ page }) => {
    await page.goto("/?debug&mode=raid");
    await openBossRaid(page);
    const tiles = page.getByRole("radiogroup", { name: "Bosses" });
    await expect(tiles.getByRole("radio", { name: "Folio", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Timber", exact: true })).toHaveCount(0);
    await asAdmin(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Timber", exact: true })).toBeVisible();
  });

  test("the workshop strip fills on the clock without moving anything; his finished pawn drops on his half; the Gnaw eats a pawn", async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    // (The page's clock 15 times faster: a scrap a second.)
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=timber&power=scraps&seedspeed=15&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    await watch(page);
    expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("timber");
    // Five slots, their costs, the foreman; his pawn finished (the test switch).
    const slots = page.locator(".ws-strip .ws-slot");
    await expect(slots).toHaveCount(5);
    await expect(slots.locator(".ws-count")).toHaveText([/\/2$/, /\/4$/, /\/4$/, /\/6$/, /\/12$/]);
    await expect(page.locator(".ws-strip .ws-foreman canvas")).toBeVisible();
    await expect(slots.first()).toHaveClass(/done/);
    // Scraps land while you think (a scrap every scrapEverySec on the battle's clock).
    const before = await strip(page);
    await expect.poll(() => strip(page), { timeout: 10_000 }).not.toBe(before);
    // Your move; his move, then his pawn drops on his half: the build moment, the plank on its square, the slot back to 0.
    await playOne(page);
    await yourMove(page);
    const w = await page.evaluate(() => (window as any).match.boss.powers.workshop);
    expect(w.drops).toBe(1);
    expect(w.last.piece).toBe("p");
    expect(["5", "6", "7"]).toContain(w.last.square[1]);
    let s = await seen(page);
    expect(s.kinds).toContain("build");
    expect(s.plank).toContain(w.last.square);
    // The Gnaw by the admins' trigger: after his next move one of your pawns is eaten.
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    await page.locator(".ult-test").click();
    await playOne(page);
    await yourMove(page);
    const after = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, gnaw: (window as any).match.boss.powers.workshop.gnaw }));
    expect(after.gnaw?.square).toBeTruthy();
    expect(pawns(after.fen, "w")).toBe(pawns(fen, "w") - 1);
    s = await seen(page);
    expect(s.kinds).toContain("gnaw");
    expect(s.banners.some((b) => /GNAW!/.test(b) && /ate a pawn/i.test(b))).toBe(true);
    expect(s.teeth).toContain(after.gnaw.square);
    // Nothing shifts: the strip and the board kept their places and sizes all along (the strip's width is its five slots').
    expect(s.strip).toHaveLength(1);
    expect(s.board).toHaveLength(1);
    expect(BOSS_POWERS.gnawScraps).toBe(8);
    expect(errors).toEqual([]);
  });
  test("on a computer his figure stands beside the board, at rest and in his Gnaw: never over the board, the bar or the side menu", async ({ page }) => {
    test.setTimeout(400_000);
    test.skip(test.info().project.name !== "desktop", "his figure stands beside the board on a computer only");
    await asAdmin(page);
    await page.addInitScript(() => localStorage.setItem("brc.evalBar", "0"));
    const start = (boss: string) => page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=${boss}&power=scraps`).then(() => bossAloneFromHome(page));
    const box = (sel: string) =>
      page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
      }, sel);
    for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      // Folio's board at this size: the reference, every boss's board is the same box here.
      await start("folio");
      await yourMove(page);
      const folioBoard = await box(BOARD_SEL.wrap);
      // Timber, from the first move: his figure, the board, the bar and the side menu, every frame (kept only when they change).
      await start("timber");
      await yourMove(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__geo = { rest: [] as number[][], cast: [] as number[][] };
        const box = (q: string) => {
          const el = document.querySelector(q);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
        };
        const same = (a: number[][], b: number[] | null) => !!b && JSON.stringify(a[a.length - 1]) !== JSON.stringify(b);
        const look = () => {
          const g = w.__geo;
          const rest = box(".boss-char.place-side .boss-char-sprite");
          if (rest && same(g.rest, rest)) g.rest.push(rest);
          const cast = box(".pm-caster");
          if (cast && same(g.cast, cast)) g.cast.push(cast);
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      });
      const board = await box(BOARD_SEL.wrap);
      expect(board).toEqual(folioBoard);
      const bar = await box(".boss-bar");
      const nav = await box("nav");
      // The Gnaw by the admins' trigger; his teeth and cast come on his turn after the warning.
      await page.locator(".ult-test").click();
      await playOne(page);
      await yourMove(page);
      const geo = await page.evaluate(() => (window as any).__geo as { rest: number[][]; cast: number[][] });
      const hit = (a: number[], b: number[] | null) => !!b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      expect(geo.rest.length).toBeGreaterThan(0);
      expect(geo.cast.length).toBeGreaterThan(0);
      for (const r of geo.rest) for (const other of [board, bar, nav]) expect(hit(r, other), `rest ${r} over ${other}`).toBe(false);
      for (const c of geo.cast) for (const other of [board, bar, nav]) expect(hit(c, other), `cast ${c} over ${other}`).toBe(false);
    }
  });
});
