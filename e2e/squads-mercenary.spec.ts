import { expect, type Page } from "@playwright/test";
import { SQUADS } from "@chessroyale/core";
import { Chess } from "chess.js";
import { BOARD_SEL, named, test } from "./helpers.ts";

/**
 * Squads' Mercenary mode (Eric, Oct 12) played through its screens on the real server (wrangler dev, SQUADS_TEST on):
 * choosing it in the Mode vote (Coming soon can't be), earning coins with a capture, the team shop between rounds (the
 * one-time explainer, buying, putting one back, closed as the match starts), and in the match a Stockfish token (your
 * own top moves, on your screen) and a shield (the bots' block against your squad cancelled). Test lobbies start from
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
  if (test.info().project.name === "desktop") await expect(page.locator(".sq-side .sq-row .mc-coins")).toHaveCount(8);
  else {
    await page.locator(".sq-strip").click();
    await expect(page.locator(".sq-sheet .sq-row .mc-coins")).toHaveCount(8);
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
  // Both squads' coins under the board from the start (Mercenary).
  await expect(page.locator(".mc-kitline-side")).toHaveCount(2);
  await tapSquare(page, "g5");
  await tapSquare(page, "f6");
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

test("the shop between rounds, a Stockfish token and a shield: bought with the squad's wallet, used in the next match", async ({ page }) => {
  test.setTimeout(300_000);
  await named(page, "Tess");
  // Straight at Pairs: every squad still in has a test wallet, and the shop is open until the match starts.
  const q = new URLSearchParams({ nolanding: "", debug: "", clock: "120,0,3,0", bots: "strong,blocks", mode: "mercenary" });
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
  // Buy a Stockfish token and a shield; a time coin, then put it back.
  await page.getByRole("button", { name: /^Buy a Stockfish token for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.stockfish).toBe(1);
  await page.getByRole("button", { name: /^Buy a Shield for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.shield).toBe(1);
  await page.getByRole("button", { name: /^Buy a Time coin for/ }).click();
  await expect.poll(async () => (await wallet(page)).cart.time).toBe(1);
  await page.getByRole("button", { name: "Put back a Time coin" }).click();
  await expect.poll(async () => (await wallet(page)).cart.time).toBe(0);
  const after = await wallet(page);
  expect(start - after.coins).toBe(SQUADS.mercenary.items.stockfish.price + SQUADS.mercenary.items.shield.price);
  // Each purchase live to the squad (the last few).
  await expect(page.locator(".mc-feed")).toContainText("You bought a shield");
  await expect(page.locator(".mc-feed")).toContainText("You put back a time coin");
  await expect(page.locator(".mc-item.in")).toHaveCount(2);
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
      if (s.banner?.kind && !w.__banners.includes(s.banner.kind)) w.__banners.push(s.banner.kind);
    }, 100);
  });
  // The match starts: the shop closes, the kit comes in (both squads see it under the board).
  await expect(shop).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator(".mc-kitline-side.you .mc-kit-stockfish")).toBeVisible();
  await expect(page.locator(".mc-kitline-side.you .mc-kit-shield")).toBeVisible();
  // The Stockfish token on your pick: your own top moves, listed and drawn, on your screen.
  const s = await nextDuty(page);
  expect(s.duty!.role).toBe("pick");
  const tokenButton = page.getByRole("button", { name: /^Stockfish token · 1 left/ });
  await expect(tokenButton).toBeVisible();
  await tokenButton.click();
  await expect(page.locator(".mc-stockfish-on")).toHaveText("Your Stockfish lines", { timeout: 15_000 });
  await expect(page.locator(".mc-stockfish .sq-cheat-lines li")).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator(".mc-stockfish .sq-cheat-lines li").first()).toContainText(/^1 · /);
  await expect(page.locator(`.board-area ${BOARD_SEL.arrowLine}`)).toHaveCount(3);
  const assist = await page.evaluate((key) => (window as any).squads.matches.get(key).assisting, s.key);
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
  const mine = new Chess(s.fen!).moves({ verbose: true }).map((m) => m.from + m.to).find((m) => m !== partnerPick && m.slice(0, 2) !== partnerPick?.slice(0, 2))!;
  await tapSquare(page, mine.slice(0, 2));
  await tapSquare(page, mine.slice(2, 4));
  // (If the half's time ran out meanwhile, there's nothing to lock in.)
  await page.getByRole("button", { name: "Lock in my pick" }).click({ timeout: 5_000 }).catch(() => undefined);
  // The shield: the other squad's bots block whenever they can; the first that would take effect is cancelled.
  // (In your match, a block by the other squad: other matches' squads buy shields too, and so may your opponent.)
  const ours = () => page.evaluate(([key, side]) => (window as any).__shielded.filter((x: any) => x.key === key && x.side !== side), [s.key, s.side!] as const);
  await expect.poll(async () => (await ours()).length, { timeout: 120_000, intervals: [250] }).toBe(1);
  expect(await page.evaluate(([key, side]) => (window as any).squads.matches.get(key).shields[side], [s.key, s.side!] as const)).toBe(0);
  // Both squads are told (the line above the board: your shield cancelled their block).
  expect(await page.evaluate(() => (window as any).__banners)).toContain("shield");
});
