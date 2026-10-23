import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_ROSTER, isPlayable } from "@chessroyale/core";
import { bossAloneFromHome, submitMove, test } from "./helpers.ts";

/**
 * The boss bar above the board, for every playable boss (docs/decisions/2026-10-23-boss-bar.md; Eric, Oct 23):
 * - No skulls in it (the select screen and the menus keep theirs; the threat is in the bar's label).
 * - A column under the name, left aligned with it: his level ("LVL 54"), his ultimate's rage meter, then his passive's bar when
 *   he has one; nothing else in the way.
 * - The status ("Strikes in 3 moves", "58 moves left") at the top right, whole and inside the bar.
 * - The free room under it at the right (`.boss-prop`, shown outlined by the test link's `?barslot=1`), clear of the column,
 *   inside the bar, at a size a boss's prop can use.
 * - His words (a phone's bubble) as small as the line: no taller than its lines need, never over the status.
 * - His level follows his strength: lifted in Moo's Full Moon, slashed for the move the King's strike weakens.
 * At 320, 390 and 428 px on a phone, 1280 on a computer.
 */
const desktop = () => test.info().project.name === "desktop";
const PLAYABLE = BOSS_ROSTER.filter(isPlayable);
const SIZES = (): [number, number][] => (desktop() ? [[1280, 800]] : [[320, 568], [390, 844], [428, 777]]);
const BASE = "/?debug&pace=quick&clock=60&laststand=0&brain=stockfish";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

type R = { x: number; y: number; w: number; h: number; r: number; b: number };
/** Every box the bar is made of, as the page draws it (null: not drawn). */
const measure = (page: Page) =>
  page.evaluate(() => {
    const box = (sel: string, within: ParentNode = document): R | null => {
      const e = within.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? null : { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
    };
    const bar = document.querySelector(".boss-bar")!;
    return {
      text: bar.textContent ?? "",
      label: bar.getAttribute("aria-label"),
      skulls: document.querySelectorAll(".boss-bar .boss-threat, .boss-bar i.on").length,
      bar: box(".boss-bar")!,
      name: box(".boss-name strong")!,
      nameWhole: (() => {
        const e = document.querySelector(".boss-name strong") as HTMLElement;
        return e.scrollWidth <= e.clientWidth;
      })(),
      column: box(".boss-name")!,
      level: box(".boss-level .lv-text"),
      levelText: document.querySelector(".boss-level .lv-text")?.textContent ?? null,
      levelSr: document.querySelector(".boss-level .lv-sr")?.textContent ?? null,
      rage: box(".boss-ult .rage-meter"),
      ult: box(".boss-ult"),
      passive: box(".boss-passive"),
      passiveFirst: box(".boss-passive > *"),
      status: box(".boss-next")!,
      statusText: document.querySelector(".boss-next")?.textContent ?? "",
      prop: box(".boss-prop"),
      propOutline: getComputedStyle(document.querySelector(".boss-prop")!).outlineStyle,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

PLAYABLE.forEach((def) => {
  test(`${def.name}'s bar: no skulls, his level and bars in a column under his name, the status at the top right, room for a prop`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}&boss=${def.id}&barslot=1`);
    await bossAloneFromHome(page);
    await expect(page.locator(".boss-bar")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".boss-name strong")).toHaveText(def.name);
    for (const [w, h] of SIZES()) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      const m = await measure(page);
      const at = `${def.id} at ${w}`;
      // No skulls in the battle bar: none drawn, none in its text; the threat is in its label (1 to 5).
      expect(m.skulls, `${at}: no skulls`).toBe(0);
      expect(m.text, `${at}: no skull in the bar's text`).not.toContain("💀");
      expect(m.label, `${at}: the threat in the bar's label`).toMatch(new RegExp(`^${def.name.replace(/[&]/g, "\\$&")}, threat [1-5] of 5$`));
      // His level, right under his name: "LVL 54" (1 to 99), heard as "Level 54".
      expect(m.levelText, `${at}: his level`).toMatch(/^LVL \d{1,2}$/);
      const level = Number(m.levelText!.slice(4));
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(99);
      expect(m.levelSr, `${at}: a screen reader hears it`).toBe(`Level ${level}`);
      const [name, lvl] = [m.name, m.level!];
      expect(m.nameWhole, `${at}: his name whole`).toBe(true);
      // The column, top to bottom: name, level, the ultimate's bar, the passive's bar, each left aligned with the name.
      expect(lvl.y, `${at}: the level under the name`).toBeGreaterThanOrEqual(name.b - 1);
      expect(lvl.y - name.b, `${at}: right under it`).toBeLessThanOrEqual(6);
      expect(Math.abs(lvl.x - name.x), `${at}: the level left aligned with the name`).toBeLessThanOrEqual(1);
      let above = lvl.b;
      if (m.rage) {
        expect(m.rage.y, `${at}: the rage meter under the level`).toBeGreaterThanOrEqual(above - 1);
        expect(m.rage.y - above, `${at}: right under it`).toBeLessThanOrEqual(6);
        expect(Math.abs(m.rage.x - name.x), `${at}: the rage meter left aligned with the name`).toBeLessThanOrEqual(1);
        above = m.ult!.b;
      }
      if (m.passiveFirst) {
        expect(m.passiveFirst.y, `${at}: his passive's bar under the rage meter`).toBeGreaterThanOrEqual(above - 1);
        expect(m.passiveFirst.y - above, `${at}: right under it`).toBeLessThanOrEqual(6);
        expect(Math.abs(m.passiveFirst.x - name.x), `${at}: his passive's bar left aligned with the name`).toBeLessThanOrEqual(1);
        above = m.passiveFirst.b;
      }
      // Compact: the bars stay inside the bar, with a margin under the last.
      expect(above, `${at}: the column inside the bar`).toBeLessThanOrEqual(m.bar.b - 3);
      // The status at the top right, whole, clear of the column.
      expect(m.statusText, `${at}: the status`).toMatch(/^(Strikes (in \d+ moves|after this move)|\d+ moves? left)$/);
      expect(m.status.y - m.bar.y, `${at}: the status at the top`).toBeLessThanOrEqual(10);
      expect(m.bar.r - m.status.r, `${at}: the status at the right`).toBeLessThanOrEqual(12);
      expect(m.status.r, `${at}: inside the bar`).toBeLessThanOrEqual(m.bar.r);
      expect(m.status.x, `${at}: clear of the column`).toBeGreaterThanOrEqual(m.column.r - 1);
      // The free room: under the status, at the right of the bars, inside the bar, outlined by ?barslot=1, big enough to draw in.
      const prop = m.prop!;
      expect(prop, `${at}: the prop's slot`).toBeTruthy();
      expect(m.propOutline, `${at}: ?barslot=1 outlines it`).toBe("dashed");
      expect(prop.y, `${at}: under the status`).toBeGreaterThanOrEqual(m.status.b - 1);
      expect(prop.x, `${at}: clear of the column`).toBeGreaterThanOrEqual(m.column.r - 1);
      expect(m.bar.r - prop.r, `${at}: at the bar's right`).toBeLessThanOrEqual(12);
      expect(prop.b, `${at}: inside the bar`).toBeLessThanOrEqual(m.bar.b);
      expect(prop.w, `${at}: room to draw in (wide)`).toBeGreaterThanOrEqual(w < 360 ? 80 : 120);
      // (A computer's bar has no figure to be as tall as: its column's height less the status's row, 22 px for a boss with no passive bar; a phone's is 33 or more.)
      expect(prop.h, `${at}: room to draw in (tall)`).toBeGreaterThanOrEqual(desktop() ? 20 : 30);
      expect(m.sideways, `${at}: nothing sideways`).toBeLessThanOrEqual(0);
      if (process.env.BAR_DEBUG) console.log(at, JSON.stringify({ bar: [m.bar.w, m.bar.h], column: [m.column.w, m.column.h], prop: [prop.w, prop.h], status: [m.status.w, m.status.h], level: m.levelText }));
    }
    expect(errors).toEqual([]);
  });
});

/** The phone's bubble over the bar: the opening line, fully typed, measured against the bar's parts. */
const bubbleOf = (page: Page) =>
  page.evaluate(() => {
    const b = document.querySelector(".bc-bar-bubble");
    if (!b || (b.querySelector(".speech-rest")?.textContent ?? "x") !== "") return null;
    const r = b.getBoundingClientRect();
    const s = document.querySelector(".boss-next")!.getBoundingClientRect();
    const n = document.querySelector(".boss-name strong")!.getBoundingClientRect();
    const cs = getComputedStyle(b);
    const frame = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const lineH = parseFloat(cs.lineHeight);
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, lines: (r.height - frame) / lineH, text: b.getAttribute("aria-label") ?? "", status: { x: s.x, y: s.y, r: s.right, b: s.bottom }, nameX: n.x, bar: document.querySelector(".boss-bar")!.getBoundingClientRect().bottom, fit: b.getAttribute("data-fit") };
  });

PLAYABLE.forEach((def) => {
  test(`${def.name}'s words in the bar: as small as the line, never taller than its lines need, never over the status`, async ({ page }) => {
    test.skip(desktop(), "the computer's bubble is by his figure beside the board (boss-speech.spec.ts)");
    test.setTimeout(120_000);
    await page.goto(`${BASE}&boss=${def.id}`);
    await bossAloneFromHome(page);
    // His opening line, once it has typed out whole (it holds for 2 s and more): measured at 428, then at 320 as the same line stays up.
    await page.setViewportSize({ width: 428, height: 777 });
    await expect.poll(() => bubbleOf(page), { timeout: 60_000, message: `${def.id}: a line in the bar` }).not.toBeNull();
    for (const [w, h] of [[428, 777], [320, 568]] as const) {
      await page.setViewportSize({ width: w, height: h });
      const looks: NonNullable<Awaited<ReturnType<typeof bubbleOf>>>[] = [];
      for (let i = 0; i < 3; i++) {
        const b = await bubbleOf(page);
        if (b) looks.push(b);
        await page.waitForTimeout(100);
      }
      expect(looks.length, `${def.id} at ${w}: the line stayed up`).toBeGreaterThan(0);
      for (const b of looks) {
        const at = `${def.id} at ${w} ("${b.text}")`;
        // Fits its text: whole lines, no room left over (its height is its lines' and its frame's, nothing more).
        expect(Math.abs(b.lines - Math.round(b.lines)), `${at}: no room over (an icon in the line makes it a hair taller)`).toBeLessThan(0.2);
        expect(Math.round(b.lines), `${at}: its lines`).toBeGreaterThanOrEqual(1);
        // Never over the status (6 px clear or not at the same height), whole inside the screen.
        const over = b.r > b.status.x - 5 && b.x < b.status.r && b.b > b.status.y && b.y < b.status.b + 5;
        expect(over, `${at}: never over the status`).toBe(false);
        expect(b.x, `${at}: from his name's left`).toBeGreaterThanOrEqual(b.nameX - 1);
        expect(b.r, `${at}: inside the screen`).toBeLessThanOrEqual(w);
        expect(b.y, `${at}: inside the screen`).toBeGreaterThanOrEqual(0);
        expect(b.b, `${at}: over the bar's bottom, not under it`).toBeLessThanOrEqual(b.bar);
        // Small: one or two lines at 428 (a long line may take a third), and no taller than the line needs.
        if (w === 428) expect(Math.round(b.lines), `${at}: 428 px`).toBeLessThanOrEqual(3);
      }
      if (process.env.BAR_DEBUG) console.log(def.id, w, JSON.stringify({ lines: looks[0]!.lines, w: looks[0]!.w, h: looks[0]!.h, text: looks[0]!.text }));
    }
  });
});

/** The level on the bar now: its number, its direction (up, down or none) and the battle's base. */
const levelNow = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".boss-level");
    const text = el?.querySelector(".lv-text")?.textContent ?? "";
    return { n: text.startsWith("LVL ") ? Number(text.slice(4)) : null, up: !!el?.classList.contains("lv-up"), down: !!el?.classList.contains("lv-down"), sr: el?.querySelector(".lv-sr")?.textContent ?? "", base: (window as any).match?.boss?.levelBase as number | undefined, mark: !!el?.querySelector(".lv-mark") };
  });

/** Your move, played: a quiet one (a knight first). */
async function quietMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
  const s = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, allowed: ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null }));
  const legal = new Chess(s.fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => ({ uci: m.from + m.to, knight: m.piece === "n" }));
  const ok = legal.filter((m) => !s.allowed || s.allowed.includes(m.uci));
  await submitMove(page, (ok.find((m) => m.knight) ?? ok[0] ?? legal[0])!.uci, s.fen);
}

test("his level follows his strength: lifted in Moo's Full Moon (gold, an arrow), back to his own after it", async ({ page }) => {
  test.skip(desktop(), "the level's states are the same on the computer; the phone runs it");
  test.setTimeout(240_000);
  await page.goto(`${BASE}&boss=moo&power=fullmoon`);
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-level")).toBeVisible({ timeout: 60_000 });
  const first = await levelNow(page);
  expect(first).toMatchObject({ up: false, down: false, mark: false });
  expect(first.n).toBe(first.base);
  // Play on until the Full Moon has begun (the test link warns on the second turn, the Moon rises on the third).
  let lifted = await levelNow(page);
  for (let i = 0; i < 8 && !lifted.up; i++) {
    await quietMove(page);
    await page.waitForTimeout(1500);
    lifted = await levelNow(page);
  }
  expect(lifted.up, "his level lifted by the Full Moon").toBe(true);
  expect(lifted.n!, "a higher number").toBeGreaterThan(first.n!);
  expect(lifted.mark, "with a small arrow").toBe(true);
  expect(lifted.sr, "heard as the new level").toBe(`Level ${lifted.n}`);
  // The color: gold (and no animation under reduced motion: just the color).
  await expect.poll(() => page.locator(".boss-level.lv-up").evaluate((e) => getComputedStyle(e).color), { timeout: 5000 }).toBe("rgb(255, 212, 102)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".boss-level.lv-up").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // It lasts through his powered moves, and goes when they're over.
  for (let i = 0; i < 12 && lifted.up; i++) {
    await quietMove(page);
    await page.waitForTimeout(1500);
    lifted = await levelNow(page);
  }
  expect(lifted.up, "back to his own level after the Full Moon").toBe(false);
  expect(lifted.n).toBe(first.base);
});

test("his level is slashed for the move the King's strike weakens, then back (red, a slash; just the color under reduced motion)", async ({ page }) => {
  test.skip(desktop(), "the level's states are the same on the computer; the phone runs it");
  test.setTimeout(180_000);
  await page.goto(`${BASE}&boss=clown`);
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-level")).toBeVisible({ timeout: 60_000 });
  const first = await levelNow(page);
  expect(first).toMatchObject({ up: false, down: false });
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  // The strike, on your move (the crowd of one calls it at once).
  const struck = await page.evaluate(() => {
    const m = (window as any).match;
    m.callKing(true);
    return m.boss.staggerNext as boolean;
  });
  await expect.poll(() => page.evaluate(() => (window as any).match.boss.staggerNext as boolean), { timeout: 10_000, message: `struck: ${struck}` }).toBe(true);
  await expect(page.locator(".boss-level.lv-down")).toBeVisible();
  const slashed = await levelNow(page);
  expect(slashed.n!, "a lower number").toBeLessThan(first.n!);
  expect(slashed.mark, "marked").toBe(true);
  expect(slashed.sr, "heard as the new level").toBe(`Level ${slashed.n}`);
  // (Red as the flash ends and for as long as it lasts.)
  await expect.poll(() => page.locator(".boss-level.lv-down").evaluate((e) => getComputedStyle(e).color), { timeout: 5000 }).toBe("rgb(255, 107, 107)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".boss-level.lv-down").evaluate((e) => [getComputedStyle(e).animationName, getComputedStyle(e.querySelector(".lv-text")!, "::after").display])).toEqual(["none", "none"]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // His weakened move lands: his own level again (once the King's strike is over, your move goes in).
  await expect.poll(() => page.evaluate(() => { const st = (window as any).match.phase.strike; return !st?.until || Date.now() > st.until + 300; }), { timeout: 30_000 }).toBe(true);
  await quietMove(page);
  await expect.poll(() => page.evaluate(() => (window as any).match.boss.staggerNext as boolean), { timeout: 60_000 }).toBe(false);
  await expect(page.locator(".boss-level.lv-down")).toHaveCount(0);
  expect((await levelNow(page)).n).toBe(first.base);
});
