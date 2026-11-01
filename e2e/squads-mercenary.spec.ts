import { expect, type Page } from "@playwright/test";
import { SQUADS } from "@chessroyale/core";
import { Chess } from "chess.js";
import { BOARD_SEL, named, test } from "./helpers.ts";

/**
 * Squads' Mercenary mode (Eric, Oct 12) played through its screens on the real server (wrangler dev, SQUADS_TEST on):
 * choosing it in the Mode vote (Coming soon can't be), earning coins with a capture, the team shop between rounds (the
 * one-time explainer, buying, putting one back, closed as the match starts), and in the match a Time chip (the clock
 * jumping 30 s, the move's deadline later), a Stockfish token (your own top moves, on your screen) and a shield (the
 * bots' block against your squad canceled). Test lobbies start from
 * a known position (`fen`) with strong bots, and `bots=blocks` has their bots block whenever they can.
 */

/** After 1.d4 Nf6 2.Bg5: White's bishop takes the knight (+ a knight's coins). */
const BG5 = "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3";

interface Seen {
  key: string | null;
  seq: number | null;
  duty: { board: number; role: "move" | "pick" } | null;
  fen: string | null;
  side: number | null;
  squad: number | null;
}

/** What the page's Squads client says about you now (your squad's live match, your duty in its half). */
const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const s = (window as any).squads;
    const m = s ? [...s.matches.values()].find((x: any) => x.state !== "over" && x.sides.some((sd: any) => sd.seats.includes(s.myId))) : null;
    const d = m?.state === "half" ? m.current?.duties.find((x: any) => x.players.includes(s.myId)) : null;
    return {
      key: m?.key ?? null,
      seq: m?.current?.seq ?? null,
      duty: d && !m.locked.includes(s.myId) && !(d.role === "move" && m.visible[s.myId]) ? { board: d.board, role: d.role } : null,
      fen: d ? m.boards[d.board].fen : null,
      side: m ? m.sides.findIndex((sd: any) => sd.seats.includes(s.myId)) : null,
      squad: s?.mySquad?.id ?? null,
    };
  });

async function nextDuty(page: Page, timeout = 120_000): Promise<Seen> {
  let s: Seen | null = null;
  await expect.poll(async () => !!(s = await seen(page)).duty, { timeout, intervals: [250] }).toBe(true);
  return s!;
}

/** Your squad's wallet as the page has it. */
const wallet = (page: Page) => page.evaluate(() => (window as any).squads.wallets.find((w: any) => w.squadId === (window as any).squads.mySquad?.id) ?? null);

async function tapSquare(page: Page, sq: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const black = await page.locator(`.board-area ${BOARD_SEL.wrap}`).evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await page.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

/** No sideways scroll on the page. */
async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

test("the Mode vote: Mercenary chosen (Coming soon can't be), and every squad's coins in the standings", async ({ page }) => {
  test.setTimeout(180_000);
  await named(page, "Eric");
  await page.goto("/squads/test?nolanding&debug&clock=90,0,3,0");
  await expect(page.locator(".vote-title h1")).toHaveText("Which mode?", { timeout: 20_000 });
  const cards = page.locator(".vote-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Classic");
  await expect(cards.nth(1)).toContainText("Mercenary");
  await expect(cards.nth(2)).toContainText("Coming soon");
  await expect(cards.nth(2)).toBeDisabled();
  await expect(page.locator(".vote-zone.disabled")).toHaveCount(1);
  await noSideScroll(page);
  // (The bots of a test lobby sit the Mode vote out: the opener's vote decides it.)
  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.evaluate(() => (window as any).squads.vote?.result ?? null), { timeout: 20_000 }).toBe(1);
  await expect(page.locator(".vote-banner")).toContainText("Mercenary");
  // Then Start and Clock (skipped): the bracket, in Mercenary.
  await expect(page.locator(".vote-title h1")).toHaveText("How do the boards start?", { timeout: 15_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).squads.lobby?.rules?.mode ?? null), { timeout: 20_000 }).toBe("mercenary");
  await expect.poll(() => page.evaluate(() => (window as any).squads.wallets.length)).toBe(8);
  // Every squad's coins for everyone: in the side panel (a computer) or the standings' sheet (a phone).
  // (Nine rows: every squad, and yours pinned at the top too, Nov 1.)
  if (test.info().project.name === "desktop") await expect(page.locator(".sq-side .sq-row .mc-coins")).toHaveCount(9);
  else {
    await page.locator(".sq-strip").click();
    await expect(page.locator(".sq-sheet .sq-row .mc-coins")).toHaveCount(9);
    await noSideScroll(page);
  }
});

test("earning coins: your capture pays your squad's wallet (a knight's worth), shown for both squads", async ({ page }) => {
  test.setTimeout(240_000);
  await named(page, "Tess");
  const q = new URLSearchParams({ nolanding: "", debug: "", clock: "120,0,3,0", fen: BG5, bots: "strong", seat: "white", mode: "mercenary" });
  await page.goto(`/squads/test/relay?${q}`);
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
  const s = await nextDuty(page);
  expect(s.duty!.role).toBe("move");
  expect(s.fen).toBe(BG5);
  // No blocks in round 1 (Eric, Oct 19: none to start, only the shop's): no Block button, no block points shown.
  await expect(page.getByRole("button", { name: /^Block/ })).toHaveCount(0);
  await expect(page.locator(".sq-res-bank")).toHaveCount(0);
  // Both squads' coins under the board from the start (Mercenary).
  await expect(page.locator(".mc-kitline-side")).toHaveCount(2);
  const ply = await page.evaluate(([key, board]) => (window as any).squads.matches.get(key).boards[board].moves.length, [s.key, s.duty!.board] as const);
  await tapSquare(page, "g5");
  await tapSquare(page, "f6");
  // Your move is in: locked in by the server, or already played on the board (the half may end with it). Once (1 of 93
  // local runs) the two taps didn't make it and the half ran to its cap without it: if that comes back, it fails here,
  // with the page as it was then (docs/decisions/2026-10-16-flaky-e2e-batch-4.md).
  const taken = () =>
    page.evaluate(
      ([key, board, ply]) => {
        const sq = (window as any).squads;
        const m = sq.matches.get(key);
        return (m.visible[sq.myId] === "g5f6" && m.locked.includes(sq.myId)) || m.boards[board].moves[ply] === "g5f6";
      },
      [s.key, s.duty!.board, ply] as const,
    );
  await expect.poll(taken, { message: "your move, taken", timeout: 5_000 }).toBe(true);
  // The half's coins: your capture, a knight's worth, to your squad.
  await expect
    .poll(
      () =>
        page.evaluate(
          ([key, side]) => {
            const m = (window as any).squads.matches.get(key);
            return (m?.last?.events ?? []).find((e: any) => e.kind === "coins" && e.why === "capture" && e.move === "g5f6" && e.side === side) ?? null;
          },
          [s.key, s.side] as const,
        ),
      { timeout: 60_000 },
    )
    .toMatchObject({ piece: "n", board: s.duty!.board, coins: SQUADS.mercenary.capture.n * SQUADS.mercenary.roundScale[0] });
  const w = await wallet(page);
  expect(w.coins).toBeGreaterThanOrEqual(SQUADS.mercenary.capture.n);
  expect(w.earned).toBe(w.coins);
  await expect(page.locator(".mc-kitline-side.you .mc-coins")).toHaveText(new RegExp(`^${w.coins.toLocaleString("en")}$`));
  await noSideScroll(page);
});

test("the shop between rounds, a Stockfish token, a Time chip and a shield: bought with the squad's wallet, used in the next match", async ({ page }) => {
  test.setTimeout(300_000);
  await named(page, "Tess");
  // Straight at Pairs: every squad still in has a test wallet, and the shop is open until the match starts.
  // (Block points for every squad, so the other squad's bots have blocks for your shield: none to start otherwise.)
  const q = new URLSearchParams({ nolanding: "", debug: "", clock: "120,0,3,0", bots: "strong,blocks", mode: "mercenary", blockPoints: "5" });
  await page.goto(`/squads/test/pairs?${q}`);
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
  const shop = page.locator(".mc-shop");
  await expect(shop).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".mc-shop-line")).toHaveText("Spend your coins on items for the next round or save them for later.");
  // The first time: the explainer, once.
  await expect(page.locator(".mc-explain")).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.locator(".mc-explain")).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("brc.mercenary.seen.") && localStorage.getItem(k) === "1"))).toBe(true);
  await noSideScroll(page);
  const start = (await wallet(page)).coins as number;
  expect(start).toBeGreaterThan(300);
  await expect(page.locator(".mc-wallet.you .mc-coins")).toHaveText(start.toLocaleString("en"));
  // A Time chip, then put it back; then a Stockfish token, a shield and a Time chip.
  await page.getByRole("button", { name: /^Buy a Time chip for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.chip).toBe(1);
  await page.getByRole("button", { name: "Put back a Time chip" }).click();
  await expect.poll(async () => (await wallet(page)).cart.chip).toBe(0);
  await page.getByRole("button", { name: /^Buy a Stockfish token for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.stockfish).toBe(1);
  await page.getByRole("button", { name: /^Buy a Shield for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.shield).toBe(1);
  await page.getByRole("button", { name: /^Buy a Time chip for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.chip).toBe(1);
  const after = await wallet(page);
  // (The chip put back was refunded: the one bought costs the first price again.)
  expect(start - after.coins).toBe(SQUADS.mercenary.items.stockfish.price + SQUADS.mercenary.items.shield.price + SQUADS.mercenary.items.chip.price);
  // Each purchase live to the squad (the last few).
  await expect(page.locator(".mc-feed")).toContainText("You bought a shield");
  await expect(page.locator(".mc-feed")).toContainText("You bought a Time chip");
  await expect(page.locator(".mc-item.in")).toHaveCount(3);
  // (From before the match starts: every half's shielded blocks and the banners shown, kept as they come: a later
  // half's replace the last.)
  await page.evaluate(() => {
    const w = window as any;
    w.__shielded = [];
    w.__banners = [];
    setInterval(() => {
      const s = w.squads;
      for (const m of s.matches.values()) {
        // (Each block once: by match, half, board, side and move. Both squads often block the same move, one on each
        // board from the same start, and both may have a shield.)
        for (const e of m.last?.events ?? []) if (e.kind === "block" && e.outcome === "shielded" && !w.__shielded.some((x: any) => x.key === m.key && x.seq === m.last.seq && x.board === e.board && x.side === e.side && x.move === e.move)) w.__shielded.push({ key: m.key, seq: m.last.seq, board: e.board, move: e.move, side: e.side });
      }
      // (Every board's banner: each board keeps its own, so another board's or match's never replaces it.)
      for (const b of Object.values(s.banners) as any[]) if (b.kind && !w.__banners.some((x: any) => x.key === b.key && x.board === b.board && x.at === b.at)) w.__banners.push({ key: b.key, board: b.board, kind: b.kind, at: b.at });
    }, 100);
  });
  // The match starts: the shop closes, the kit comes in (both squads see it under the board).
  await expect(shop).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(".mc-kitline-side.you .mc-kit-stockfish")).toBeVisible();
  await expect(page.locator(".mc-kitline-side.you .mc-kit-shield")).toBeVisible();
  await expect(page.locator(".mc-kitline-side.you .mc-kit-chip")).toBeVisible();
  const s = await nextDuty(page);
  expect(s.duty!.role).toBe("pick");
  // A Time chip on this move: the clock jumps 30 s (both squads see "+30 s"), the move's deadline 30 s later.
  const secs = (t: string) => (t.includes(":") ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : Number(t));
  const myClock = page.locator(".sq-clockline-side.you .sq-clock");
  const chipButton = page.locator(".sq-clockline-side.you .mc-chip-btn");
  await expect(chipButton).toBeVisible();
  await expect(page.locator(".sq-clockline-side.you .sq-res-chips")).toContainText("×1");
  const before = secs((await myClock.textContent())!.replace(/[▼\s]/g, ""));
  const deadline0 = await page.evaluate(([key, me]) => (window as any).squads.matches.get(key).current.duties.find((x: any) => x.players.includes(me)).deadline, [s.key, await page.evaluate(() => (window as any).squads.myId)] as const);
  await chipButton.click();
  await expect(page.locator(".sq-clockline-side.you .mc-chip-plus")).toHaveText(`+${SQUADS.mercenary.chipSeconds} s`);
  await expect(page.locator(".sq-clockline-side.you .mc-chip-clock.on")).toBeVisible();
  const jumped = secs((await myClock.textContent())!.replace(/[▼\s]/g, ""));
  expect(jumped).toBeGreaterThanOrEqual(before + SQUADS.mercenary.chipSeconds - 3);
  expect(jumped).toBeLessThanOrEqual(before + SQUADS.mercenary.chipSeconds + 1);
  await expect(page.locator(".sq-clockline-side.you .sq-res-chips")).toContainText("×0");
  await expect(chipButton).toHaveCount(0);
  const chipped = await page.evaluate(([key, me]) => {
    const m = (window as any).squads.matches.get(key);
    return { chips: m.current.chips, deadline: m.current.duties.find((x: any) => x.players.includes(me)).deadline };
  }, [s.key, await page.evaluate(() => (window as any).squads.myId)] as const);
  expect(chipped.chips).toHaveLength(1);
  expect(Math.round((chipped.deadline - deadline0) / 1000)).toBe(SQUADS.mercenary.chipSeconds);
  // The Stockfish token on your pick: your own top moves, listed and drawn, on your screen.
  const tokenButton = page.getByRole("button", { name: /^Stockfish token · 1 left/ });
  await expect(tokenButton).toBeVisible();
  await tokenButton.click();
  await expect(page.locator(".mc-stockfish-on")).toHaveText("Your Stockfish lines", { timeout: 15_000 });
  // As many lines as the position allows, at most three: the moves left once the blocks on that board are taken out.
  // (Usually three; but a strong bot's first move can be a check with two answers: the Danish's Bxf7+, among others
  // in Pairs' openings.)
  const blocked = await page.evaluate(([key, board]) => (window as any).squads.matches.get(key).blocks.filter((x: any) => x.board === board).map((x: any) => x.move.slice(0, 4)), [s.key, s.duty!.board] as const);
  const allowed = new Chess(s.fen!).moves({ verbose: true }).filter((m) => !blocked.includes(m.from + m.to)).length;
  const lineCount = Math.min(SQUADS.mercenary.stockfish.lines, allowed);
  await expect(page.locator(".mc-stockfish .sq-cheat-lines li")).toHaveCount(lineCount, { timeout: 30_000 });
  await expect(page.locator(".mc-stockfish .sq-cheat-lines li").first()).toContainText(/^1 · /);
  // (The token's lines besides your partner's pick, a blue arrow once their bot has picked: it picks in its own time.)
  const tokenArrows = () =>
    page.evaluate(
      ([key, board, sel]) => {
        const m = (window as any).squads.matches.get(key);
        const picks = new Set((m.current?.duties ?? []).filter((d: any) => d.board === board && d.role !== "move").flatMap((d: any) => d.players.map((p: string) => m.visible[p]).filter(Boolean)));
        return document.querySelectorAll(sel).length - picks.size;
      },
      [s.key, s.duty!.board, `.board-area ${BOARD_SEL.arrowLine}`] as const,
    );
  await expect.poll(tokenArrows, { timeout: 5_000 }).toBe(lineCount);
  // Your token, once (the other squad's bots buy tokens too and may use one in this match: theirs aren't yours).
  const myId = await page.evaluate(() => (window as any).squads.myId);
  const assist = await page.evaluate(([key, me]) => (window as any).squads.matches.get(key).assisting.filter((a: any) => a.by === me), [s.key, myId] as const);
  expect(assist).toHaveLength(1);
  // Your side to move in that position: your moves, never theirs.
  expect(assist[0].fen.split(" ")[1]).toBe(s.fen!.split(" ")[1]);
  // Then your pick (any move but your partner's), locked in: you play on.
  const partnerPick = await page.evaluate(([key, me]) => {
    const m = (window as any).squads.matches.get(key);
    const d = m.current.duties.find((x: any) => x.players.includes(me));
    const partner = d.players.find((x: any) => x !== me);
    return m.visible[partner] ?? null;
  }, [s.key, await page.evaluate(() => (window as any).squads.myId)] as const);
  // (Another piece's move if there is one; in a check with only king moves, the other one.)
  const moves = new Chess(s.fen!).moves({ verbose: true }).map((m) => m.from + m.to);
  const mine = moves.find((m) => m !== partnerPick && m.slice(0, 2) !== partnerPick?.slice(0, 2)) ?? moves.find((m) => m !== partnerPick?.slice(0, 4)) ?? moves[0]!;
  await tapSquare(page, mine.slice(0, 2));
  await tapSquare(page, mine.slice(2, 4));
  // (If the half's time ran out meanwhile, there's nothing to lock in.)
  await page.getByRole("button", { name: "Lock in my pick" }).click({ timeout: 5_000 }).catch(() => undefined);
  // The shield: the other squad's bots block whenever they can; the first that would take effect is canceled.
  // (In your match, a block by the other squad: other matches' squads buy shields too, and so may your opponent.)
  const ours = () => page.evaluate(([key, side]) => (window as any).__shielded.filter((x: any) => x.key === key && x.side !== side), [s.key, s.side!] as const);
  // (With your squad's shields left in the match beside it: once, locally, the shield was spent but its half never reached
  // the page, a reconnect's snapshot instead, and this says which. docs/decisions/2026-10-16-flaky-e2e-batch-4.md)
  const shieldsLeft = () => page.evaluate(([key, side]) => (window as any).squads.matches.get(key).shields[side] as number, [s.key, s.side!] as const);
  await expect.poll(async () => ({ seen: (await ours()).length, shieldsLeft: await shieldsLeft() }), { timeout: 120_000, intervals: [250] }).toEqual({ seen: 1, shieldsLeft: 0 });
  // Both squads are told (the line above that board: your shield canceled their block).
  const canceled = (await ours())[0];
  expect(await page.evaluate(() => (window as any).__banners)).toContainEqual(expect.objectContaining({ key: s.key, board: canceled.board, kind: "shield" }));
});
