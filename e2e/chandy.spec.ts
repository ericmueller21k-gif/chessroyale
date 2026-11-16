import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * Chandy (his rules, Nov 16; docs/decisions/2026-11-16-chandy-rules.md), in the game for admins first (BOSS_ADMIN_FIRST): his tile only
 * on an admin's Boss raid screen; Boss alone with the test switches: each of his meter's five moves shows (its event, its banner, his
 * layer over the board), the queen lock's aim and then its shot; a lock's crosshair and, when he takes the locked piece, the upgrade
 * window; and Dodge (`&power=dodge`): the scope-in, a round's vote (your tap counted on the square, ringed), DODGED, then a hit that
 * ends the battle.
 */
const S = BOSS_POWERS.chandy;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** Your move: `pick` from the allowed moves (default: a quiet knight move, else the first quiet one, else the first). */
async function playOne(page: Page, pick?: (legal: { uci: string; piece: string; to: string; captured?: string }[], fen: string) => string | undefined) {
  await yourMove(page);
  const s = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });
  const legal = new Chess(s.fen)
    .moves({ verbose: true })
    .map((m) => ({ uci: m.from + m.to + (m.promotion ?? ""), piece: m.piece as string, to: m.to as string, captured: m.captured as string | undefined }))
    .filter((m) => !s.allowed || s.allowed.includes(m.uci))
    .sort((a, b) => (a.uci < b.uci ? -1 : 1));
  const move = pick?.(legal, s.fen) ?? legal.find((m) => m.piece === "n" && !m.captured)?.uci ?? legal.find((m) => !m.captured)?.uci ?? legal[0]!.uci;
  await submitMove(page, move, s.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/** Every frame: the power events shown, the banners' words, his layer over the board, the upgrade window, Dodge's phases and words. */
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__ch = { kinds: [] as string[], banners: [] as string[], layer: 0, upgrade: [] as string[], dodge: [] as string[], words: [] as string[] };
    const look = () => {
      const r = w.__ch;
      for (const e of w.match?.boss?.powers?.events ?? []) if (!r.kinds.includes(e.kind)) r.kinds.push(e.kind);
      for (const b of document.querySelectorAll(".fight-banner")) {
        const t = (b.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t && !r.banners.includes(t)) r.banners.push(t);
      }
      if (document.querySelector(".power-board .ch-over")) r.layer++;
      const up = document.querySelector(".ch-upgrade")?.getAttribute("aria-label");
      if (up && !r.upgrade.includes(up)) r.upgrade.push(up);
      const root = document.querySelector(".cd-root");
      const p = root ? [...root.classList].find((c) => c.startsWith("cd-p-")) : null;
      if (p && r.dodge.at(-1) !== p) r.dodge.push(p);
      for (const el of document.querySelectorAll(".cd-result, .cd-tele")) {
        const t = (el.textContent ?? "").trim();
        if (t && !r.words.includes(t)) r.words.push(t);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const seen = (page: Page) => page.evaluate(() => (window as any).__ch as { kinds: string[]; banners: string[]; layer: number; upgrade: string[]; dodge: string[]; words: string[] });

async function battle(page: Page, power: string) {
  await asAdmin(page);
  await page.goto(`/?debug&pace=quick&laststand=0&brain=stockfish&boss=chandy&power=${power}&mode=raid`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await yourMove(page);
  await watch(page);
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("chandy");
}

test.describe("Chandy", () => {
  test("admins first: no tile for a player; an admin's Boss raid screen has his tile", { tag: "@phone-only" }, async ({ page }) => {
    await page.goto("/?debug&mode=raid");
    await openBossRaid(page);
    const tiles = page.getByRole("radiogroup", { name: "Bosses" });
    await expect(tiles.getByRole("radio", { name: "Folio", exact: true })).toBeVisible();
    await expect(tiles.getByRole("radio", { name: "Chandy", exact: true })).toHaveCount(0);
    await asAdmin(page);
    await page.reload();
    await expect(tiles.getByRole("radio", { name: "Chandy", exact: true })).toBeVisible();
  });

  const MOVES: [power: string, kind: string, banner: RegExp][] = [
    ["scatter", "scatterShot", /SCATTER SHOT!/],
    ["beam", "beam", /BEAM!/],
    ["shields", "shields", /SHIELDS!/],
    ["rapidfire", "rapidFire", /RAPID FIRE!/],
  ];
  for (const [power, kind, banner] of MOVES)
    test(`his meter's ${power}: its banner, his layer over the board, its limit on your turn`, { tag: "@phone-only" }, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await battle(page, power);
      // (The switch: the move unlocked, the meter full after your first move: it lands as your second turn begins.)
      await playOne(page);
      await yourMove(page);
      const s = await seen(page);
      expect(s.kinds).toContain(kind);
      expect(s.banners.some((b) => banner.test(b))).toBe(true);
      expect(s.layer).toBeGreaterThan(0);
      const c = await page.evaluate(() => (window as any).match.boss.powers.chandy);
      if (power === "scatter") expect(c.scatter.squares.length).toBe(S.scatterSquares);
      if (power === "beam") expect(c.beam.squares.length).toBe(15);
      if (power === "shields") expect(c.shields.squares.length).toBe(S.shieldCount);
      if (power === "rapidfire") expect(c.dizzy.length).toBe(S.rapidCount);
      // (A move of yours it stops isn't in the allowed moves: the board refuses it, the dock says why.)
      const allowed = await page.evaluate(() => (window as any).match.boss.powers.allowed as string[] | null);
      if (power !== "shields") expect(allowed).not.toBeNull();
      expect(errors).toEqual([]);
    });

  test("his queen lock: his whole turn aiming down her file, your free move, then the shot shatters the pawn in front of her", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await battle(page, "queenlock");
    // (Your queen on d1 behind your d2 pawn: a save is there already. Keep the d-file as it is.)
    await playOne(page, (legal) => legal.find((m) => m.uci === "g1f3" || m.uci === "b1c3")?.uci);
    await yourMove(page);
    let s = await seen(page);
    expect(s.kinds).toContain("queenAim");
    expect(s.banners.some((b) => /QUEEN LOCK!/.test(b))).toBe(true);
    expect(await page.evaluate(() => (window as any).match.boss.powers.chandy.aim)).toBe("d1");
    // (His turn was spent: no move of his on the board since yours.)
    await playOne(page, (legal) => legal.find((m) => m.piece === "n" && !m.captured && m.uci !== "d2d3" && m.uci !== "d2d4")?.uci);
    await yourMove(page);
    s = await seen(page);
    expect(s.kinds).toContain("queenShot");
    const after = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, shot: (window as any).match.boss.powers.chandy.shot }));
    expect(after.shot).toMatchObject({ square: "d2", piece: "p" });
    expect(new Chess(after.fen).get("d2" as never)).toBeFalsy();
    expect(errors).toEqual([]);
  });

  test("a lock on a piece he can take: the crosshair, then he takes it and the upgrade window shows (1 of 5) with its new move", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await battle(page, "lockon");
    // (Each of your moves leaves a piece he can take for free, so his first lock sits on it and his engine is steered to take it.)
    const hang = (legal: { uci: string; piece: string; to: string; captured?: string }[], fen: string) => {
      const c = new Chess(fen);
      return legal.find((m) => m.piece !== "k" && m.piece !== "q" && !m.captured && c.isAttacked(m.to as never, "b") && !(() => {
        const after = new Chess(fen);
        after.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: "q" });
        return after.isAttacked(m.to as never, "w");
      })())?.uci;
    };
    for (let i = 0; i < 8 && !(await seen(page)).upgrade.length; i++) await playOne(page, hang);
    const s = await seen(page);
    expect(s.kinds).toContain("lockOn");
    expect(s.kinds).toContain("upgrade");
    expect(s.upgrade[0]).toMatch(/1 of 5/);
    const c = await page.evaluate(() => (window as any).match.boss.powers.chandy);
    expect(c.upgrades).toBeGreaterThanOrEqual(1);
    await expect(page.locator(".ch-pips > i.on")).toHaveCount(c.upgrades);
    expect(errors).toEqual([]);
  });

  test("Dodge: the scope-in, a round's vote (your tap counted, ringed), DODGED; then a hit, and the battle is his", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await battle(page, "dodge");
    // (The switch: the rifle whole from the start, the warning as your second turn begins, Dodge as your third does.)
    await playOne(page);
    await playOne(page);
    await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.dodge), { timeout: 30_000 }).toBe(true);
    const d = await page.evaluate(() => (window as any).match.boss.powers.chandy.dodge);
    // Round 1: wait for the vote, tap the square safe once its teleport is done (the state knows it solo), see it counted.
    await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(S.dodgeTeleports[0]!.at(-1)! + 150);
    const safe1 = d.rounds[0].safe as string;
    await page.getByRole("button", { name: new RegExp(`^Vote ${safe1}`) }).click();
    await expect(page.locator(".cd-pick.cd-mine .cd-count")).toHaveText("1");
    await expect(page.locator(".cd-result")).toHaveText("DODGED 1/3", { timeout: 10_000 });
    // Round 2: a square that isn't safe: HIT! YOU LOSE, and the battle ends (the result screen).
    await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 10_000 });
    const safe2 = d.rounds[1].safe as string;
    const wrong = ["d3", "e3", "f3", "d4", "e4", "f4", "d5", "e5", "f5"].find((sq) => sq !== safe2)!;
    await page.waitForTimeout(S.dodgeTeleports[1]!.at(-1)! + 150);
    await page.getByRole("button", { name: new RegExp(`^Vote ${wrong}`) }).click();
    await expect(page.locator(".cd-result")).toHaveText("HIT! YOU LOSE", { timeout: 10_000 });
    await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
    const s = await seen(page);
    expect(s.dodge.slice(0, 4)).toEqual(["cd-p-scope", "cd-p-slide", "cd-p-open", "cd-p-vote"]);
    expect(s.kinds).toContain("dodgeWin");
    expect(s.words).toContain("TELEPORT!");
    expect(errors).toEqual([]);
  });
});
