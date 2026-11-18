import { expect, type Page } from "@playwright/test";
import { SUPER_FREEZE_BEATS as SF } from "@chessroyale/chess";
import { engineTop, test, watchFor, bossAloneFromHome } from "./helpers.ts";

/**
 * Ginger's Super Freeze (Eric, Nov 18; docs/decisions/2026-11-18-ginger-super-freeze.md), played through alone with its test switch
 * (?power=superfreeze: it comes as your first move lands, then your third): its meter beside his rage meter (greyed until full, lit
 * when full, empty and dashed once both have come); its moment while he thinks (SUPER FREEZE!, his charge-up and blast, the ice
 * block over the 3 x 3), his move waiting for it; the frozen pieces' ice through your turn, their moves not allowed and a tap of one
 * refused; their ice melting as his turn starts, and free again.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const fenNow = (p: Page) => p.evaluate(() => (window as any).match.phase.board.fen as string);

/** Waits for your move, then plays the engine's best allowed move (solo: the runner's are the allowed ones). */
async function playBest(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await page.waitForTimeout(300);
  const { top } = await engineTop(page);
  const move = top[0]?.move ?? null;
  await page.evaluate((mv) => {
    const m = (window as any).match;
    if (m.phase.kind === "play" && mv) m.submit(mv);
  }, move);
  await expect.poll(() => phase(page), { timeout: 20_000 }).not.toBe("play");
}

/** From before it can come: when the block first shows and when your turn next begins, read in the page each frame (ms, page clock). */
async function watchMoment(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __sf: { block?: number; play?: number; armed: boolean; box?: { x: number; y: number; w: number; h: number } } };
    w.__sf = { armed: false };
    const tick = () => {
      const m = (window as any).match;
      const now = performance.now();
      const el = document.querySelector(".pw-superice");
      if (w.__sf.block === undefined && el) {
        w.__sf.block = now;
        const b = el.getBoundingClientRect();
        w.__sf.box = { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
      }
      if (m?.phase.kind !== "play") w.__sf.armed = true;
      if (w.__sf.block !== undefined && w.__sf.armed && w.__sf.play === undefined && m?.phase.kind === "play") w.__sf.play = now;
      if (w.__sf.play === undefined) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () => page.evaluate(() => (window as unknown as { __sf: { block?: number; play?: number; box?: { x: number; y: number; w: number; h: number } } }).__sf);
}

test("Ginger's Super Freeze (?power=superfreeze): the meter, the moment while he thinks, frozen pieces can't move, the thaw, twice, then spent", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await page.goto("/?debug&clock=40&bossMoves=12&boss=gingerbread&power=superfreeze");
  await bossAloneFromHome(page);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Ginger");

  // Its meter: in the rage meter's row, beside it (Eric: "another ult meter bar"); full on the turn it comes (the switch: turn 1).
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const meter = page.locator(".boss-ult .gs-meter");
  await expect(meter).toBeVisible();
  await expect(meter).toHaveClass(/full/);
  const row = await page.evaluate(() => {
    const r = document.querySelector(".boss-ult .rage-meter")!.getBoundingClientRect();
    const g = document.querySelector(".boss-ult .gs-meter")!.getBoundingClientRect();
    return { rageRight: r.right, gLeft: g.left, overlap: Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top) };
  });
  expect(row.gLeft).toBeGreaterThanOrEqual(row.rageRight);
  expect(row.overlap).toBeGreaterThan(0);

  // Your move lands: SUPER FREEZE! while he thinks, his cast, the block of ice over the 3 x 3; his move waits for all of it.
  const seen = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /SUPER FREEZE!.*Your (pawn|knight|bishop|rook|queen)( and the pieces around it)? (is|are) iced/ }, block: { selector: ".pw-superice" } });
  const times = await watchMoment(page);
  await playBest(page);
  await expect.poll(async () => (await seen.seen()).banner, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await seen.seen()).block, { timeout: 15_000 }).toBe(true);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  const t = await times();
  // (From the block's first frame to your turn: at least the rest of the moment, its grow, hold and settle.)
  expect(t.play! - t.block!).toBeGreaterThanOrEqual(SF.total - SF.iceAt - 150);

  // Your turn: the pieces it holds iced, none of their moves allowed, a tap of one refused in the power's words.
  const p2 = await powers(page);
  const held: string[] = p2.superFreeze.held;
  expect(held.length).toBeGreaterThan(0);
  expect(held.every((sq) => p2.iced.includes(sq))).toBe(true);
  for (const sq of held) await expect(page.locator(`.power-board .pw-ice[data-square="${sq}"]`)).toHaveCount(1);
  // (The block was three squares a side round its middle square: measured against a frozen piece's ice there, on its square.)
  const target: string = p2.superFreeze.target;
  const near = held.find((sq) => Math.abs(sq.charCodeAt(0) - target.charCodeAt(0)) <= 1 && Math.abs(Number(sq[1]) - Number(target[1])) <= 1)!;
  const cell = await page.locator(`.power-board .pw-ice[data-square="${near}"]`).boundingBox();
  const df = near.charCodeAt(0) - target.charCodeAt(0);
  const dr = Number(near[1]) - Number(target[1]);
  const flip = (await page.evaluate(() => (window as any).match.boss.crowdSide)) === "b" ? -1 : 1;
  expect(Math.abs(t.box!.w - 3 * cell!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(t.box!.x - (cell!.x + cell!.width / 2 - flip * df * cell!.width))).toBeLessThanOrEqual(2);
  expect(Math.abs(t.box!.y - (cell!.y + cell!.height / 2 + flip * dr * cell!.height))).toBeLessThanOrEqual(2);
  const allowed2: string[] | null = p2.allowed;
  expect(allowed2, "the frozen pieces take moves away").not.toBeNull();
  expect(allowed2!.some((m) => held.includes(m.slice(0, 2)))).toBe(false);
  // (A move of a frozen piece from the engine's unfiltered search: refused, still your turn, the dock says why.)
  const raw = (await engineTop(page, "raw")).top;
  const tried = raw.find((x) => held.includes(x.move.slice(0, 2)))?.move ?? null;
  if (tried) {
    await page.evaluate((mv) => (window as any).match.submit(mv), tried);
    await page.waitForTimeout(300);
    expect(await phase(page)).toBe("play");
  }
  // The meter empty after it, filling again (greyed): half full a turn later with the switch.
  await expect(meter).toHaveClass(/dim/);
  expect(Number(await meter.getAttribute("data-pct"))).toBe(50);

  // As his turn starts the ice melts (each of them that's still yours); your next turn they move again.
  const melted = await page.evaluate(() => {
    const w = window as unknown as { __melt: string[] };
    w.__melt = [];
    const obs = new MutationObserver(() => {
      for (const el of document.querySelectorAll<HTMLElement>(".power-board .pw-ice.melting")) if (el.dataset.square && !w.__melt.includes(el.dataset.square)) w.__melt.push(el.dataset.square);
    });
    obs.observe(document.body, { subtree: true, childList: true, attributes: true });
    return true;
  });
  expect(melted).toBe(true);
  await playBest(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  const p3 = await powers(page);
  expect(p3.superFreeze.held).toEqual([]);
  const fen3 = await fenNow(page);
  const stillMine = held.filter((sq) => {
    const rows = fen3.split(" ")[0]!.split("/");
    const row = rows[8 - Number(sq[1])]!;
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else if (f++ === sq.charCodeAt(0) - 97) return c === c.toUpperCase();
    }
    return false;
  });
  const melts = await page.evaluate(() => (window as unknown as { __melt: string[] }).__melt);
  for (const sq of stillMine) expect(melts, `${sq} melts as his turn starts`).toContain(sq);
  // (Full again on this turn with the switch: it comes as this move lands, the second and last.)
  await expect(meter).toHaveClass(/full/);
  const second = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /SUPER FREEZE!/ } });
  await playBest(page);
  await expect.poll(async () => (await second.seen()).banner, { timeout: 15_000 }).toBe(true);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  expect((await powers(page)).superFreeze.used).toBe(2);
  // Both have come: the meter stays on the bar, empty, greyed and dashed (nothing hidden, nothing shifts).
  await expect(meter).toHaveClass(/spent/);
  await expect(meter).toBeVisible();
  expect(Number(await meter.getAttribute("data-pct"))).toBe(0);
});
