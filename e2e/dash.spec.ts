import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_CLOCK, BOSS_POWERS } from "@chessroyale/core";
import { BOARD_SEL, asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * Dash, the cheetah (docs/decisions/2026-11-03-dash.md), in the game for admins first (BOSS_ADMIN_FIRST): his tile only on an
 * admin's Boss raid screen; Boss alone (Boss Battle's clock: the bank) with the test switches: his Clock Slap (`&power=clockslap`:
 * his first move slaps as a capture would) taking slapBankSeconds off your bank, the time flying from your clock to him, Tick's
 * tally; Time Scramble (the admins' trigger): its banner, then 3 seconds a move with the big 3-2-1 over the board; a scrambled move
 * left to run out: a move played for you (never a loss), his jab; nothing on screen moving all along.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 100), { timeout: 10_000 }).toBe(true);
}

/** Your move: a knight to an empty square when it may, else the first allowed. */
async function playOne(page: Page) {
  await yourMove(page);
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), knight: m.piece === "n" && !m.captured }));
  const ok = legal.sort((a, b) => (a.uci < b.uci ? -1 : 1));
  await submitMove(page, (ok.find((m) => m.knight) ?? ok[0])!.uci, fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/** Every frame: the power events, the banners' words, the countdown's seconds, the flight's words, the boxes that must stay put. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__dash = { kinds: [] as string[], banners: [] as string[], secs: [] as string[], fly: [] as string[], tally: [] as string[], board: [] as string[], clock: [] as string[], caster: 0, hidden: 0, over: [] as string[] };
    const box = (el: Element | null) => {
      if (!el) return "";
      const r = el.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    };
    const add = (a: string[], v: string | null | undefined) => v && !a.includes(v) && a.push(v);
    const look = () => {
      const r = w.__dash;
      for (const e of w.match?.boss?.powers?.events ?? []) add(r.kinds, e.kind);
      for (const b of document.querySelectorAll(".fight-banner")) add(r.banners, (b.textContent ?? "").replace(/\s+/g, " ").trim());
      add(r.secs, (document.querySelector(".dash-count") as HTMLElement | null)?.dataset.secs);
      add(r.fly, document.querySelector(".dash-fly")?.textContent);
      add(r.tally, box(document.querySelector(".tk-tally")));
      add(r.board, box(document.querySelector(".board-wrap")));
      // (Your clock's right edge and top: its numbers are right aligned, so its width follows "10:00" or "0:03".)
      const ck = document.querySelector(".dk-clock")?.getBoundingClientRect();
      add(r.clock, ck ? `${Math.round(ck.right)},${Math.round(ck.top)}` : "");
      // (He never steps up to the board's corner, his figure is never hidden, and its drawn box never covers a square: on a phone it
      // sits in the bar over the board, on a computer beside it.)
      if (document.querySelector(".pm-caster")) r.caster++;
      const fig = document.querySelector(".boss-char .boss-char-sprite");
      if (fig && getComputedStyle(fig).visibility === "hidden") r.hidden++;
      const b = document.querySelector(".board-wrap")?.getBoundingClientRect();
      const f = fig?.getBoundingClientRect();
      if (b && f && f.width > 0) {
        const cs = getComputedStyle(fig!);
        // (The canvas's own box: his frame, his feet at its foot; drawn pixels inside it. Counted by its overlap with the board.)
        const ox = Math.min(f.right, b.right) - Math.max(f.left, b.left);
        const oy = Math.min(f.bottom, b.bottom) - Math.max(f.top, b.top);
        if (ox > 1 && oy > 1 && cs.visibility !== "hidden") add(r.over, `${w.match?.boss?.powers?.events?.map((e: { kind: string }) => e.kind).join("+")}:${Math.round(ox)}x${Math.round(oy)}`);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
type Seen = { kinds: string[]; banners: string[]; secs: string[]; fly: string[]; tally: string[]; board: string[]; clock: string[]; caster: number; hidden: number; over: string[] };
const seen = (page: Page) => page.evaluate(() => (window as any).__dash as Seen);
const dash = (page: Page) => page.evaluate(() => (window as any).match.boss.powers.dash);

test.describe("Dash", () => {
  test("admins first: no tile for a player; an admin's Boss raid screen has his tile", async ({ page }) => {
    await page.goto("/?debug&mode=raid");
    await openBossRaid(page);
    const tiles = page.getByRole("radiogroup", { name: "Bosses" });
    await expect(tiles.getByRole("radio", { name: "Folio", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Dash", exact: true })).toHaveCount(0);
    await asAdmin(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Dash", exact: true })).toBeVisible();
  });

  test("Clock Slap takes time off your bank and flies it to him; Time Scramble: 3 s a move counted down over the board; out of time, a move is played for you, never a loss; nothing moves", async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=dash&power=clockslap&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    await watch(page);
    expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("dash");
    // Boss alone plays on Boss Battle's clock (the bank): Tick and the tally ("−0:00", nothing stolen yet) in his bar.
    expect(await page.evaluate(() => (window as any).match.settings.bossClock)).toBe(true);
    await expect(page.locator(".tk-tally canvas")).toBeVisible();
    await expect(page.locator(".tk-tally .tk-text")).toHaveText("−0:00");
    // Your move; his first move slaps (the test switch): slapBankSeconds off your bank, the time flying to him at the corner.
    const bank0 = await page.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou)?.bankMs ?? null);
    await playOne(page);
    await yourMove(page);
    const d1 = await dash(page);
    expect(d1.slap).toMatchObject({ ms: BOSS_POWERS.slapBankSeconds * 1000, bank: true });
    expect(d1.slaps).toBe(1);
    let s = await seen(page);
    expect(s.kinds).toContain("slap");
    expect(s.fly).toContain(`−${BOSS_POWERS.slapBankSeconds}s`);
    await expect(page.locator(".tk-tally .tk-text")).toHaveText(`−0:${String(BOSS_POWERS.slapBankSeconds).padStart(2, "0")}`);
    const bank1 = await page.evaluate(() => (window as any).match.standings().find((s: any) => s.isYou)?.bankMs ?? null);
    if (bank0 !== null && bank1 !== null) expect(bank1).toBeLessThanOrEqual(bank0 + BOSS_CLOCK.incrementSeconds * 1000 - BOSS_POWERS.slapBankSeconds * 1000);
    // Time Scramble by the admins' trigger: after his next move, TIME SCRAMBLE!, then your move has 3 seconds.
    await page.locator(".ult-test").click();
    await playOne(page);
    await yourMove(page);
    const clock = await page.evaluate(() => ({ ms: (window as any).match.phase.deadline - (window as any).match.phase.startsAt }));
    expect(clock.ms).toBe(BOSS_POWERS.scrambleSeconds * 1000);
    s = await seen(page);
    expect(s.kinds).toContain("scramble");
    expect(s.banners.some((b) => /TIME SCRAMBLE!/.test(b) && /next 5 moves: 3 seconds each/.test(b))).toBe(true);
    // Left to run out: 3, 2, 1 over the board, then a move played for you (a move of yours on the board, no submit), and play goes on.
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    await expect(page.locator(".dash-count")).toBeVisible();
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
    await yourMove(page);
    const d2 = await dash(page);
    expect(d2.flags).toBe(1);
    expect(new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""))).toContain(d2.flag.move);
    expect(await page.evaluate(() => (window as any).match.boss.result ?? null)).toBeNull();
    s = await seen(page);
    expect(s.secs).toEqual(expect.arrayContaining(["3", "2", "1"]));
    expect(s.kinds).toContain("flag");
    // Still scrambled: this move too has 3 seconds and its countdown; a move in time is played as ever.
    expect(await page.evaluate(() => (window as any).match.phase.deadline - (window as any).match.phase.startsAt)).toBe(BOSS_POWERS.scrambleSeconds * 1000);
    await expect(page.locator(".dash-count")).toHaveAttribute("data-left", String(BOSS_POWERS.scrambleMoves - 1));
    await playOne(page);
    // Nothing shifts: the board, your clock and Tick's tally kept their places and sizes all along.
    s = await seen(page);
    expect(s.board).toHaveLength(1);
    expect(s.tally).toHaveLength(1);
    expect(s.clock).toHaveLength(1);
    // He stayed in his place through the slap, the warning, the scramble and his jab: never at the board's corner, never hidden.
    expect(s.caster).toBe(0);
    expect(s.hidden).toBe(0);
    expect(s.over, "his figure's box over the board").toEqual([]);
    expect(errors).toEqual([]);
  });

  test("his figure and the countdown on a phone at 320 px: the board whole, the count inside it", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(test.info().project.name !== "phone", "the phone's narrowest width");
    await page.setViewportSize({ width: 320, height: 640 });
    await asAdmin(page);
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=dash&power=scramble&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    // (The test switch: its warning as the second turn begins, the scramble as the third does.)
    await playOne(page);
    await playOne(page);
    await yourMove(page);
    await expect(page.locator(".dash-count")).toBeVisible();
    const [count, board] = await Promise.all([page.locator(".dash-count").boundingBox(), page.locator(BOARD_SEL.wrap).boundingBox()]);
    expect(count!.x).toBeGreaterThanOrEqual(board!.x - 1);
    expect(count!.x + count!.width).toBeLessThanOrEqual(board!.x + board!.width + 1);
    expect(board!.x).toBeGreaterThanOrEqual(0);
    expect(board!.x + board!.width).toBeLessThanOrEqual(320);
  });
});
