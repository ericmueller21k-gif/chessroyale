import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { asAdmin, openBossRaid, submitMove, test } from "./helpers.ts";

/**
 * Chandy (his rules, Nov 16; docs/decisions/2026-11-16-chandy-rules.md), in the game for admins first (BOSS_ADMIN_FIRST): his tile only
 * on an admin's Boss raid screen; Boss alone with the test switches: each of his meter's five moves shows (its event, its banner, his
 * layer over the board), the Lock-on Shot's aim (its name since Nov 24), the God King's warning and the crosshair on the piece its round
 * will hit, then its shot and the upgrade that shatter earns; a lock's crosshair and, when he takes the locked piece, the upgrade
 * window; and Dodge (`&power=dodge`): the scope-in, the warning volley, a round's vote (your tap counted on the square, ringed),
 * DODGED, a hit that cracks your king, then the second that ends the battle. Dodge from your mate (Eric, Nov 26; `&win=1`: your mate in
 * one from the start, Qxf7#, his rifle bare): the battle doesn't end, his opening plays over your mate (its five steps; his line in his
 * speech box), then the Dodge; three dodged rounds, then the win beat (your mate back, "CHECKMATE!") and the result: yours.
 */
const S = BOSS_POWERS.chandy;
/** His line at his opening's `line` step (characters/chandy-lines.ts' CHANDY_MATE_LINES, the first). */
const CHANDY_MATE_LINE = "Mate? Negative. One shot left in the chamber.";
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
    w.__ch = { kinds: [] as string[], banners: [] as string[], layer: 0, upgrade: [] as string[], dodge: [] as string[], steps: [] as string[], his: [] as string[], words: [] as string[], first: [] as { square: string; fen: string; thinking: boolean }[], king: [] as string[] };
    const look = () => {
      const r = w.__ch;
      for (const e of w.match?.boss?.powers?.events ?? []) if (!r.kinds.includes(e.kind)) r.kinds.push(e.kind);
      // (His first lock: the position on screen the frame it's first seen, his move not shown yet.)
      const ph = w.match?.phase;
      for (const e of ph?.boss?.powers?.events ?? [])
        if (e.kind === "lockOn" && e.first && !r.first.some((f: { square: string }) => f.square === e.square)) r.first.push({ square: e.square, fen: ph.boss.board.fen, thinking: !!ph.thinking });
      for (const b of document.querySelectorAll(".fight-banner")) {
        const t = (b.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t && !r.banners.includes(t)) r.banners.push(t);
      }
      if (document.querySelector(".power-board .ch-over")) r.layer++;
      // (The God King's lines, as his bubble says them.)
      for (const b of document.querySelectorAll(".gk-bubble[aria-label]")) {
        const t = b.getAttribute("aria-label") ?? "";
        if (t && !r.king.includes(t)) r.king.push(t);
      }
      const up = document.querySelector(".ch-upgrade")?.getAttribute("aria-label");
      if (up && !r.upgrade.includes(up)) r.upgrade.push(up);
      const root = document.querySelector(".cd-root");
      const p = root ? [...root.classList].find((c) => c.startsWith("cd-p-")) : null;
      if (p && r.dodge.at(-1) !== p) r.dodge.push(p);
      // (A mate's opening steps, and his lines as his speech box shows them.)
      const st = root ? [...root.classList].find((c) => c.startsWith("cd-s-")) : null;
      if (st && r.steps.at(-1) !== st) r.steps.push(st);
      for (const b of document.querySelectorAll(".bc-bubble[aria-label]")) {
        const t = b.getAttribute("aria-label") ?? "";
        if (t && !r.his.includes(t)) r.his.push(t);
      }
      for (const el of document.querySelectorAll(".cd-result, .cd-tele")) {
        const t = (el.textContent ?? "").trim();
        if (t && !r.words.includes(t)) r.words.push(t);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const seen = (page: Page) => page.evaluate(() => (window as any).__ch as { kinds: string[]; banners: string[]; layer: number; upgrade: string[]; dodge: string[]; steps: string[]; his: string[]; words: string[]; first: { square: string; fen: string; thinking: boolean }[]; king: string[] });

/**
 * Dodge's opening as a frame sampler can promise it (Nov 19: a long CI frame skipped the 600 ms slide): the phases sampled
 * up to the first vote are in the timeline's order, and the long ones (the scope-in, the volley, the vote) are each seen.
 * Every phase and its exact order are the unit test's (chandy-wired.test.ts, "Dodge on screen": the timeline).
 */
function dodgeOpening(dodge: string[]) {
  const order = ["cd-p-mate", "cd-p-scope", "cd-p-slide", "cd-p-volley", "cd-p-open", "cd-p-vote"];
  const head = dodge.slice(0, dodge.indexOf("cd-p-vote") + 1);
  const at = head.map((p) => order.indexOf(p));
  expect(at.every((k, i) => k > (at[i - 1] ?? -1)), `Dodge's phases in the timeline's order: ${head.join(", ")}`).toBe(true);
  expect(head.filter((p) => ["cd-p-scope", "cd-p-volley", "cd-p-vote"].includes(p))).toEqual(["cd-p-scope", "cd-p-volley", "cd-p-vote"]);
}

/**
 * Waits, in round `k`'s vote, until its clones' last teleport is 150 ms past, by the vote's own countdown (the HUD's "VOTE: TAP A
 * SQUARE 1.2 s"). (Nov 19: a fixed wait from when the test saw the vote, which expect's polling can notice up to a second late, left
 * round 3's tap racing the vote's close.)
 */
async function afterTeleports(page: Page, k: number) {
  const left = (S.dodgeVoteMs - S.dodgeTeleports[k]!.at(-1)! - 150) / 1000;
  await page.waitForFunction((max) => {
    const m = /VOTE: TAP A SQUARE ([\d.]+) s/.exec(document.querySelector(".cd-say")?.textContent ?? "");
    return !!m && Number(m[1]) <= max;
  }, left, { timeout: 10_000 });
}

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

  // (Eric, Nov 18: "when you tap chandy a weapon screen comes up that shows his gun and which upgrade he has"; ChandyWeapon.tsx.) Phone
  // (his bar) and computer (beside the board): a look, not a pause.
  test("a tap on him opens his weapon screen: his rifle at its stage, the move he has lit, the rest greyed; it closes (X, Escape, outside) and the clock runs", async ({ page }) => {
    test.setTimeout(120_000);
    await battle(page, "beam");
    const tap = page.locator(".ch-look-tap:visible");
    const screen = page.locator(".ch-weapon");
    // (Never over the board: his tap target takes no square's tap.)
    const over = await tap.evaluate((el) => {
      const t = el.getBoundingClientRect();
      const b = document.querySelector(".board")!.getBoundingClientRect();
      return Math.max(0, Math.min(t.right, b.right) - Math.max(t.left, b.left)) * Math.max(0, Math.min(t.bottom, b.bottom) - Math.max(t.top, b.top));
    });
    expect(over).toBe(0);
    await tap.click();
    await expect(screen).toBeVisible();
    await expect(screen.locator(".ch-up-label")).toHaveText(/1\/5$/);
    await expect(screen.locator("li")).toHaveCount(5);
    await expect(screen.locator("li.on")).toHaveCount(1);
    await expect(screen.locator("li.on")).toHaveAttribute("data-move", "beam");
    expect(await screen.getAttribute("data-stage")).toBe("1");
    // (The clock runs under it: still your move, and its time goes down.)
    const time = page.locator(".dk-clock .dk-time");
    const before = await time.textContent();
    await expect.poll(() => time.textContent(), { timeout: 5_000 }).not.toBe(before);
    expect(await phase(page)).toBe("play");
    await expect(screen).toBeVisible();
    await screen.getByRole("button", { name: "Close" }).click();
    await expect(screen).toHaveCount(0);
    await tap.click();
    await expect(screen).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(screen).toHaveCount(0);
    await tap.click();
    await expect(screen).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(screen).toHaveCount(0);
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

  test("his Lock-on Shot (the queen lock until Nov 24): his whole turn aiming down her file, the God King's warning, the pawn in front of her locked too; your free move, then the shot shatters it: an upgrade", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await battle(page, "queenlock");
    // (Your queen on d1 behind your d2 pawn: a save is there already. Keep the d-file as it is.)
    await playOne(page, (legal) => legal.find((m) => m.uci === "g1f3" || m.uci === "b1c3")?.uci);
    await yourMove(page);
    let s = await seen(page);
    expect(s.kinds).toContain("queenAim");
    expect(s.banners.some((b) => /LOCK-ON SHOT!/.test(b))).toBe(true);
    expect(s.banners.some((b) => /QUEEN LOCK/i.test(b))).toBe(false);
    expect(await page.evaluate(() => (window as any).match.boss.powers.chandy.aim)).toBe("d1");
    // (The piece its round will hit, the d2 pawn in front of her, locked too: its crosshair, one pip (it fires next).)
    expect(await page.evaluate(() => (window as any).match.boss.powers.chandy.locks)).toContainEqual({ square: "d2", left: 1 });
    // (The God King's warning: put a piece in front of her. Your d2 pawn already is, so a move can keep one there.)
    await expect.poll(async () => (await seen(page)).king.some((t) => /queen/i.test(t) && /front|behind|block/i.test(t)), { timeout: 10_000 }).toBe(true);
    const upgrades = await page.evaluate(() => (window as any).match.boss.powers.chandy.upgrades as number);
    // (His turn was spent: no move of his on the board since yours.)
    await playOne(page, (legal) => legal.find((m) => m.piece === "n" && !m.captured && m.uci !== "d2d3" && m.uci !== "d2d4")?.uci);
    await yourMove(page);
    s = await seen(page);
    expect(s.kinds).toContain("queenShot");
    const after = await page.evaluate(() => ({ fen: (window as any).match.phase.board.fen as string, shot: (window as any).match.boss.powers.chandy.shot }));
    expect(after.shot).toMatchObject({ square: "d2", piece: "p" });
    expect(new Chess(after.fen).get("d2" as never)).toBeFalsy();
    // (Its shatter of the locked pawn is an upgrade, as a capture: the window as your turn begins.)
    expect(await page.evaluate(() => (window as any).match.boss.powers.chandy.upgrades)).toBe(upgrades + 1);
    await expect.poll(async () => (await seen(page)).upgrade.some((u) => u.includes(`${upgrades + 1} of 5`)), { timeout: 10_000 }).toBe(true);
    expect(errors).toEqual([]);
  });

  test("his first capture: the crosshair locks onto your piece before he takes it, then the upgrade window shows (1 of 5) with its new move", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await battle(page, "lockon");
    // (His phone bar, every frame (Eric, Nov 18, his name "moved too far to the right"): his name column never moves, and his drawing (the
    // rifle out, tipped at the board: kits.ts barUnder) never touches its name, level or meters; `out`, frames it reached past the column.)
    await page.evaluate(() => {
      const w = window as any;
      w.__bar = { lefts: [] as number[], over: 0, out: 0 };
      const look = () => {
        const bar = document.querySelector(".boss-bar");
        const cv = document.querySelector(".boss-char.place-bar canvas") as HTMLCanvasElement | null;
        const name = bar?.querySelector(".boss-name");
        if (bar && cv && name && cv.width) {
          const b = bar.getBoundingClientRect();
          const n = name.getBoundingClientRect();
          if (!w.__bar.lefts.includes(Math.round(n.left - b.left))) w.__bar.lefts.push(Math.round(n.left - b.left));
          const c = cv.getBoundingClientRect();
          const k = c.width / cv.width;
          const g = cv.getContext("2d")!;
          const drawn = (l: number, t: number, r: number, btm: number) => {
            const x0 = Math.max(0, Math.floor((l - c.left) / k)), x1 = Math.min(cv.width, Math.ceil((r - c.left) / k));
            const y0 = Math.max(0, Math.floor((t - c.top) / k)), y1 = Math.min(cv.height, Math.ceil((btm - c.top) / k));
            if (x1 <= x0 || y1 <= y0) return false;
            const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
            for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) return true;
            return false;
          };
          for (const el of name.children) {
            const r = el.getBoundingClientRect();
            if (r.width && drawn(r.left, r.top, r.right, r.bottom)) w.__bar.over++;
          }
          if (drawn(n.left, b.top, c.right, b.bottom)) w.__bar.out++;
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    // (Each of your moves leaves a piece he can take for free; the switch has him take one as soon as he can: his first capture.)
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
    // (The lock came while he still thought, your piece still on its square: then he took it.)
    expect(s.first.length).toBe(1);
    expect(s.first[0]!.thinking).toBe(true);
    expect(new Chess(s.first[0]!.fen).get(s.first[0]!.square as never)).toMatchObject({ color: "w" });
    const c = await page.evaluate(() => (window as any).match.boss.powers.chandy);
    expect(c.upgrades).toBeGreaterThanOrEqual(1);
    await expect(page.locator(".ch-pips > i.on")).toHaveCount(c.upgrades);
    const bar = await page.evaluate(() => (window as any).__bar as { lefts: number[]; over: number; out: number });
    expect(bar.out, "his rifle came out past the name column in the bar").toBeGreaterThan(0);
    expect(bar.over, "frames his drawing touched his name, level or meters").toBe(0);
    expect(bar.lefts, "his name column never moved").toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test("Dodge: the scope-in, the warning volley, a round's vote (your tap counted, ringed), DODGED; a hit cracks your king and play goes on; the second hit, and the battle is his", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await battle(page, "dodge");
    // (The switch: the rifle whole from the start, the warning as your second turn begins, Dodge as your third does.)
    await playOne(page);
    await playOne(page);
    await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.dodge), { timeout: 30_000 }).toBe(true);
    const d = await page.evaluate(() => (window as any).match.boss.powers.chandy.dodge);
    // The warning volley first (no vote): "DODGE THE NEXT ONE!".
    await expect(page.locator(".cd-result.cd-warned")).toHaveText("DODGE THE NEXT ONE!", { timeout: 10_000 });
    // Round 1: wait for the vote, tap the square safe once its teleport is done (the state knows it solo), see it counted.
    await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 10_000 });
    await afterTeleports(page, 0);
    const safe1 = d.rounds[0].safe as string;
    await page.getByRole("button", { name: new RegExp(`^Vote ${safe1}`) }).click();
    await expect(page.locator(".cd-pick.cd-mine .cd-count")).toHaveText("1");
    await expect(page.locator(".cd-result")).toHaveText("DODGED 1/3", { timeout: 10_000 });
    // Round 2: a square that isn't safe: a hit, your king cracked, and play goes on.
    const wrong = (safe: string) => ["d3", "e3", "f3", "d4", "e4", "f4", "d5", "e5", "f5"].find((sq) => sq !== safe)!;
    await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 10_000 });
    await afterTeleports(page, 1);
    await page.getByRole("button", { name: new RegExp(`^Vote ${wrong(d.rounds[1].safe)}`) }).click();
    await expect(page.locator(".cd-result")).toHaveText("HIT! KING CRACKED", { timeout: 10_000 });
    await expect(page.locator(".cd-king.cd-cracked")).toHaveCount(1);
    // Round 3: still cracked; a second hit: HIT! YOU LOSE, and the battle ends (the result screen).
    await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".cd-king.cd-cracked")).toHaveCount(1);
    expect(await phase(page)).toBe("boss");
    await afterTeleports(page, 2);
    await page.getByRole("button", { name: new RegExp(`^Vote ${wrong(d.rounds[2].safe)}`) }).click();
    await expect(page.locator(".cd-result")).toHaveText("HIT! YOU LOSE", { timeout: 10_000 });
    await expect(page.locator(".cd-root.cd-p-kill")).toBeVisible();
    await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
    const s = await seen(page);
    dodgeOpening(s.dodge);
    expect(s.dodge).toContain("cd-p-kill");
    expect(s.kinds).toContain("dodgeWin");
    expect(s.words).toEqual(expect.arrayContaining(["TELEPORT!", "DODGE THE NEXT ONE!", "HIT! KING CRACKED", "HIT! YOU LOSE"]));
    expect(errors).toEqual([]);
  });

  test("Dodge from your mate (Eric, Nov 26): your Qxf7# pauses the battle, his opening (the pause, his jump, reach and zap, his line), the Dodge; three dodged rounds, then CHECKMATE! over your mate, and the battle is yours", { tag: "@phone-only" }, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await asAdmin(page);
    // (?win=1: the battle starts with your mate in one, Qxf7, his rifle bare.)
    await page.goto(`/?debug&pace=quick&laststand=0&brain=stockfish&boss=chandy&win=1&mode=raid`);
    await openBossRaid(page);
    await watch(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    // (Before your mate: no Dodge, no warning: the last chance is gone.)
    expect(await page.evaluate(() => (window as any).match.boss.powers.chandy?.dodge ?? null)).toBeNull();
    await submitMove(page, "h5f7", fen);
    await expect.poll(() => page.evaluate(() => !!(window as any).match?.phase?.dodge), { timeout: 60_000 }).toBe(true);
    const c = await page.evaluate(() => (window as any).match.boss.powers.chandy);
    expect(c.upgrades).toBe(0);
    expect(c.dodge.mate).toBe(true);
    // (The mate on the board under his opening: your king on it, his king mated.)
    const mated = await page.evaluate(() => (window as any).match.phase.boss.board.fen as string);
    expect(new Chess(mated).isCheckmate()).toBe(true);
    expect(await phase(page)).toBe("boss");
    // Each round: the round's safe square (the state knows it solo) tapped as its vote opens (a tap stays where it's made).
    for (let k = 0; k < S.dodgeRounds; k++) {
      await expect(page.locator(".cd-root.cd-p-vote")).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: new RegExp(`^Vote ${c.dodge.rounds[k].safe}`) }).click();
      await expect(page.locator(".cd-result")).toHaveText(`DODGED ${k + 1}/${S.dodgeRounds}`, { timeout: 10_000 });
    }
    // The win beat: your mate back on the board, CHECKMATE! (the God King's hero banner); then the result, yours.
    await expect(page.locator(".cd-root.cd-p-win")).toBeAttached({ timeout: 10_000 });
    expect(await page.evaluate(() => (window as any).match.phase.boss?.board?.fen as string)).toBe(mated);
    await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("results");
    const s = await seen(page);
    expect(s.banners.some((b) => /CHECKMATE!/.test(b))).toBe(true);
    expect(s.dodge[0]).toBe("cd-p-mate");
    expect(s.dodge).toContain("cd-p-win");
    expect(s.steps).toEqual(["cd-s-pause", "cd-s-jump", "cd-s-reach", "cd-s-zap", "cd-s-line"]);
    expect(s.his.some((t) => t.includes(CHANDY_MATE_LINE))).toBe(true);
    expect(s.kinds).not.toContain("warn");
    dodgeOpening(s.dodge);
    expect(await page.evaluate(() => (window as any).match.boss.result)).toBe("crowd");
    expect(errors).toEqual([]);
  });
});
