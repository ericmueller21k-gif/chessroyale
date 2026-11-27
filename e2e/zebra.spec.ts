import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * Don Dough, the zebra kingpin (docs/decisions/2026-11-11-don-dough.md), in the game for admins first (BOSS_ADMIN_FIRST): his tile
 * only on an admin's Boss raid screen; Boss alone with the test switches: Rising Dough (`&power=dough`: a pawn's lump dropped at the
 * end of his first turn, its oven timer in the boss bar rolling a minute down each move, the dough rising into his pawn at 00:00)
 * and Gold Plate (the admins' trigger: at the start of his turn after your move, his queen drawn gold on the board from then on).
 * Nothing in the bar or the board moves for any of it.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/**
 * Your move: never onto his dough (a quiet one, so it rises), a knight to an empty square when it may, else the first allowed; and
 * never one that leaves him a mate in one, when another doesn't (Nov 27: main's run on ac75eaa lost to a mate before the dough rose,
 * the knights' shuffle leaving it open).
 */
async function playOne(page: Page, onto?: string) {
  await yourMove(page);
  const s = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null, lumps: ((m.boss?.powers?.zebra?.lumps ?? []) as { square: string }[]).map((l) => l.square) };
  });
  const legal = new Chess(s.fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), knight: m.piece === "n" && !m.captured, to: m.to as string, quiet: !m.captured }));
  const ok = legal.filter((m) => (!s.allowed || s.allowed.includes(m.uci)) && (onto ? m.to === onto : !s.lumps.includes(m.to))).sort((a, b) => (a.uci < b.uci ? -1 : 1));
  const mates = (uci: string) => {
    const g = new Chess(s.fen);
    g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return g.moves({ verbose: true }).some((r) => {
      const h = new Chess(g.fen());
      h.move(r.san);
      return h.isCheckmate();
    });
  };
  const safe = ok.filter((m) => !mates(m.uci));
  const from = safe.length ? safe : ok;
  const pick = from.find((m) => m.knight) ?? from.find((m) => m.quiet) ?? from[0];
  await submitMove(page, pick!.uci, s.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/**
 * Every frame: the power events shown, the banners' words, the timers' slots and the board's box, the timers' frames, and the
 * first lump's minutes left in the state (each change, in order), and the minutes its timer shows, with the phase each first showed in.
 */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__dd = { kinds: [] as string[], banners: [] as string[], timers: [] as string[], board: [] as string[], frames: [] as string[], gold: [] as string[], left0: [] as number[], shown0: [] as [number, string, number][] };
    const box = (el: Element | null) => {
      if (!el) return "";
      const r = el.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    };
    const look = () => {
      const r = w.__dd;
      for (const e of w.match?.boss?.powers?.events ?? []) if (!r.kinds.includes(e.kind)) r.kinds.push(e.kind);
      for (const b of document.querySelectorAll(".fight-banner")) {
        const t = (b.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t && !r.banners.includes(t)) r.banners.push(t);
      }
      const s = [...document.querySelectorAll(".dd-slot")].map(box).join(" ");
      if (s && !r.timers.includes(s)) r.timers.push(s);
      const bd = box(document.querySelector(".board-wrap"));
      if (bd && !r.board.includes(bd)) r.board.push(bd);
      for (const c of document.querySelectorAll(".dd-timer")) {
        const f = (c as HTMLElement).dataset.frame ?? "";
        if (f && !r.frames.includes(f)) r.frames.push(f);
      }
      const l0 = (w.match?.boss?.powers?.zebra?.lumps ?? []).find((l: { n: number }) => l.n === 0);
      if (l0 && r.left0[r.left0.length - 1] !== l0.left) r.left0.push(l0.left);
      const t0 = document.querySelector<HTMLElement>('.dd-slot[data-slot="0"] .dd-timer')?.dataset.left;
      if (t0 !== undefined && r.shown0[r.shown0.length - 1]?.[0] !== Number(t0)) r.shown0.push([Number(t0), w.match?.phase?.kind ?? "", l0?.left ?? -1]);
      for (const p of document.querySelectorAll(".board-wrap piece.gold")) {
        const k = p.className;
        if (!r.gold.includes(k)) r.gold.push(k);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const seen = (page: Page) => page.evaluate(() => (window as any).__dd as { kinds: string[]; banners: string[]; timers: string[]; board: string[]; frames: string[]; gold: string[]; left0: number[]; shown0: [number, string, number][] });
const zebraOf = (page: Page) => page.evaluate(() => (window as any).match.boss.powers.zebra as { lumps: { n: number; piece: string; square: string; left: number; slot: number }[]; drops: number; rise: { n: number; square: string; piece: string } | null; gold: string[] });

test.describe("Don Dough", () => {
  test("admins first: no tile for a player; an admin's Boss raid screen has his tile", { tag: "@phone-only" }, async ({ page }) => {
    await page.goto("/?debug&mode=raid");
    await openBossRaid(page);
    const tiles = page.getByRole("radiogroup", { name: "Bosses" });
    await expect(tiles.getByRole("radio", { name: "Folio", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Don Dough", exact: true })).toHaveCount(0);
    await asAdmin(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Don Dough", exact: true })).toBeVisible();
  });

  test("Rising Dough: a pawn's lump on his half, its oven timer rolling a minute down each move, his pawn rising at 00:00; Gold Plate: his queen gold; nothing moves", async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    await page.goto("/?debug&pace=quick&laststand=0&brain=stockfish&boss=zebra&power=dough&mode=raid");
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    await watch(page);
    expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("zebra");
    // Two empty slots before any dough (the rules' doughLive), taking their room from the start.
    await expect(page.locator(".dd-slot")).toHaveCount(BOSS_POWERS.doughLive);
    await expect(page.locator(".dd-slot.empty")).toHaveCount(BOSS_POWERS.doughLive);
    // Your move; his move, then his lump of dough: a pawn's (the test switch), on his half, its timer at doughTimers.p (8:00).
    await playOne(page);
    await yourMove(page);
    let z = await zebraOf(page);
    expect(z.drops).toBe(1);
    const lump = z.lumps[0]!;
    expect(lump).toMatchObject({ piece: "p", left: BOSS_POWERS.doughTimers.p, slot: 0 });
    expect(["5", "6", "7"]).toContain(lump.square[1]);
    await expect(page.locator('.dd-slot[data-slot="0"] .dd-timer')).toHaveAttribute("data-left", String(BOSS_POWERS.doughTimers.p));
    await expect(page.locator('.dd-slot[data-slot="0"] .dd-timer')).toHaveAttribute("data-kind", "p");
    expect((await seen(page)).kinds).toContain("doughDrop");
    // Where the timers are: a phone's in the boss bar; a computer's at his feet by the board's bottom-left corner, a bit bigger (95 px a
    // timer, 2.5x; the bar's 76), none in the bar (Eric, Nov 27), on screen.
    const at = await page.evaluate(() => {
      const r = (e: Element | null) => e?.getBoundingClientRect() ?? null;
      return { bar: document.querySelectorAll(".boss-bar .dd-timers").length, side: r(document.querySelector(".boss-side > .dd-timers")), board: r(document.querySelector(".board-wrap")), slot: r(document.querySelector(".dd-slot")) };
    });
    if (test.info().project.name === "desktop") {
      expect(at.bar).toBe(0);
      expect(at.slot!.width).toBeCloseTo(95, 0);
      expect(at.side!.right).toBeLessThanOrEqual(at.board!.left);
      expect(at.side!.right).toBeGreaterThan(at.board!.left - 20);
      expect(Math.abs(at.side!.bottom - at.board!.bottom)).toBeLessThanOrEqual(4);
      expect(at.side!.left).toBeGreaterThanOrEqual(0);
    } else expect([at.bar, at.side]).toEqual([1, null]);
    // A minute off each move, yours and his: 3 after yours, 2 after his.
    // (Read from the watcher, every frame: your move's minute comes off once the judge has scored it, which took over 5 s on CI's
    // desktop (main's run 43016010621), and a look after his move has already seen 2.)
    await playOne(page);
    await yourMove(page);
    let s = await seen(page);
    const P = BOSS_POWERS.doughTimers.p;
    const mm = (n: number) => String(n).padStart(2, "0");
    expect(s.left0).toEqual([P, P - 1, P - 2]);
    // Shown a minute off on every turn (Eric, Nov 27: "8 and then to 7 to 6"): yours as your move goes in (while it's judged, before
    // the rules count it as his turn begins), his as he moves.
    expect(s.shown0.map(([n]) => n)).toEqual([P, P - 1, P - 2]);
    // (When yours shows, while your move is judged, is the unit test's (zebra.test.ts, shownLeft): with ?pace=quick the judging can be
    // over before a frame is drawn on CI, so a frame inside it isn't always there to see (#1026's run, phone, twice).)
    expect((await zebraOf(page)).lumps.find((l) => l.n === 0)?.left).toBe(P - 2);
    await expect(page.locator('.dd-slot[data-slot="0"] .dd-timer')).toHaveAttribute("data-left", String(P - 2));
    // (The roll from its start and from a minute under played: their frames drawn.)
    expect(s.frames.some((f) => f.startsWith(`pRoll${mm(P)}:`))).toBe(true);
    expect(s.frames.some((f) => f.startsWith(`pRoll${mm(P - 1)}:`))).toBe(true);
    // (The roll after his move plays to its last frame, though the bar redraws every frame while his move shows: the review's 2.)
    expect(s.frames).toContain(`pRoll${mm(P - 1)}:6`);
    // (Down to 2: a minute off each move, yours and his.)
    for (let left = P - 2; left > 2; left -= 2) {
      await playOne(page);
      await yourMove(page);
      expect((await zebraOf(page)).lumps.find((l) => l.n === 0)?.left).toBe(left - 2);
    }
    // 1 after yours, 0 after his: it rises into his pawn (the guards allowing), the timer's ding, the dough's rise.
    await playOne(page);
    await yourMove(page);
    z = await zebraOf(page);
    const rose = z.rise?.n === 0 ? z.rise : null;
    if (rose) {
      const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
      expect(new Chess(fen).get(rose.square as never)).toMatchObject({ type: "p", color: "b" });
      s = await seen(page);
      expect(s.kinds).toContain("doughRise");
      expect(s.frames.some((f) => f.startsWith("pDing:"))).toBe(true);
    } else expect(z.lumps.find((l) => l.n === 0)?.left).toBe(0);
    // Gold Plate by the admins' trigger: at the start of his turn after your move, his queen turns gold, and stays gold on the board.
    await page.locator(".ult-test").click();
    await playOne(page);
    await yourMove(page);
    z = await zebraOf(page);
    expect(z.gold.length).toBe(1);
    await expect(page.locator(`.board-wrap piece.gold`)).toHaveCount(1);
    s = await seen(page);
    expect(s.kinds).toContain("goldPlate");
    expect(s.banners.some((b) => /GOLD PLATE!/.test(b) && /pawns can't take/i.test(b))).toBe(true);
    // Nothing shifts: the timers and the board kept their places and sizes all along.
    expect(s.timers).toHaveLength(1);
    expect(s.board).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
