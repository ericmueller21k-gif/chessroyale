import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, named, test, watchFor } from "./helpers.ts";

/**
 * Squads v2 (Eric, Oct 12) played through its screens on the real server (wrangler dev, SQUADS_TEST on): a same-move
 * token burned and refunded by the judge (this page's own engine), a move blocked (the arrow that keeps drawing itself
 * and its lock, until the other squad has moved, and the move not played), and Cheat lines while blocking. The test
 * lobbies start from a known position (`fen`), with strong bots (`bots=strong`) and you as White (`seat=white`).
 */

/** 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nxd4: White's only good move is to take back, Qxd4 (every other loses a knight). */
const SCOTCH = "r1bqkbnr/pppp1ppp/8/8/3nP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5";

interface Seen {
  key: string | null;
  state: string | null;
  seq: number | null;
  duty: { board: number; role: "move" | "pick"; players: string[] } | null;
  fen: string | null;
  mine: string | null;
  visible: Record<string, string>;
  tokens: [number, number] | null;
  side: number | null;
  note: string | null;
}

/** What the page's Squads client says about you now (your squad's live match, your duty in its half). */
const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const s = (window as any).squads;
    const m = s ? [...s.matches.values()].find((x: any) => x.state !== "over" && x.sides.some((sd: any) => sd.seats.includes(s.myId))) : null;
    const d = m?.state === "half" ? m.current?.duties.find((x: any) => x.players.includes(s.myId)) : null;
    return {
      key: m?.key ?? null,
      state: m?.state ?? null,
      seq: m?.current?.seq ?? null,
      duty: d ? { board: d.board, role: d.role, players: d.players } : null,
      fen: d ? m.boards[d.board].fen : null,
      mine: m ? (m.visible[s.myId] ?? null) : null,
      visible: m ? { ...m.visible } : {},
      tokens: m?.tokens ?? null,
      side: m ? m.sides.findIndex((sd: any) => sd.seats.includes(s.myId)) : null,
      note: s?.note?.text ?? null,
    };
  });

async function tapSquare(page: Page, sq: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const black = await page.locator(`.board-area ${BOARD_SEL.wrap}`).evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await page.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

async function nextDuty(page: Page, after: string | null, timeout = 90_000): Promise<Seen> {
  let s: Seen | null = null;
  await expect
    .poll(
      async () => {
        s = await seen(page);
        return !!s.duty && `${s.key}/${s.seq}` !== after;
      },
      { timeout, intervals: [250] },
    )
    .toBe(true);
  return s!;
}

/**
 * Into a test lobby from SCOTCH, as White, with strong bots, past the votes. Blocks are Mercenary's (Classic has none):
 * `mode` sets it (no Mode vote then).
 */
async function testLobby(page: Page, start: "relay" | "pairs" | "final", mode: "classic" | "mercenary" = "classic") {
  await named(page, "Tess");
  const q = new URLSearchParams({ nolanding: "", debug: "", clock: "120,0,3,0", fen: SCOTCH, bots: "strong", seat: "white", mode });
  await page.goto(`/squads/test/${start}?${q}`);
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
}

test("a same-move token: you and your partner take back with the queen, it plays without a coin, and the judge gives the token back", async ({ page }) => {
  test.setTimeout(240_000);
  await testLobby(page, "pairs");
  const s = await nextDuty(page, null);
  expect(s.duty!.role).toBe("pick");
  expect(s.fen).toBe(SCOTCH);
  const mySide = s.side!;
  await expect(page.locator(".sq-clockline-side.you .sq-res-tokens")).toHaveText("×5");
  const reveal = await watchFor(page, {
    same: { selector: ".sq-status", text: /^Same move/ },
    refund: { selector: ".sq-note.news", text: /Token refunded: only move/ },
  });
  // The only move: your partner (a strong bot) sees it too, and picks the same move (or you pick theirs).
  await tapSquare(page, "d1");
  await tapSquare(page, "d4");
  await expect.poll(async () => (await seen(page)).mine).toBe("d1d4");
  await expect(page.locator(".sq-same")).toHaveText(/Same move: it plays for sure/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Lock in my pick" }).click();
  // It plays without a coin and burns a token; a few seconds later the judge (this device's engine) refunds it.
  await expect.poll(() => reveal.seen(), { timeout: 60_000 }).toEqual({ same: true, refund: true });
  await expect.poll(async () => (await seen(page)).tokens?.[mySide], { timeout: 30_000 }).toBe(5);
  await expect(page.locator(".sq-clockline-side.you .sq-res-tokens")).toHaveText("×5");
  const log = await page.evaluate((key) => (window as any).squads.matches.get(key).tokenLog, s.key);
  expect(log.find((u: any) => u.side === mySide)).toMatchObject({ move: "d1d4", verdict: { refunded: true, why: "only_move" } });
  // The post-match breakdown: Next round ends the match; the use, refunded, and why, with numbers.
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.locator(".sq-tokens li.ours").first()).toContainText(/Qxd4: refunded, every other move lost at least \d+\.\d pawns/, { timeout: 30_000 });
});

test("a block: tap Block, their queen, where it would go; the arrow keeps drawing itself with its lock until they've moved, and they don't play it", async ({ page }) => {
  test.setTimeout(240_000);
  // (You stay on your board after your move, to watch the block through their half: Jump to my next board off.)
  await page.addInitScript(() => localStorage.setItem("brc.squads.jumpNext", "0"));
  await testLobby(page, "relay", "mercenary");
  const s = await nextDuty(page, null);
  expect(s.duty!.role).toBe("move");
  expect(s.fen).toBe(SCOTCH);
  const board = s.duty!.board;
  await expect(page.locator(".sq-clockline-side.you .sq-res-bank")).toHaveText("5");
  // Block: their pieces are ringed with their cost; the queen, then f6 (their best answer to Qxd4).
  await page.getByRole("button", { name: /^Block · 5 points/ }).click();
  await expect(page.locator(".sq-status")).toContainText("Block: tap one of their pieces");
  await expect(page.locator('.sq-bp-piece[data-square="d8"] .sq-bp-cost')).toHaveText("3");
  await expect(page.locator('.sq-bp-piece[data-square="e8"]')).toHaveCount(1); // castling's
  await tapSquare(page, "d8");
  await expect(page.locator('.sq-bp-target[data-square="f6"]')).toBeVisible();
  await tapSquare(page, "f6");
  // Placed at once, for everyone: the arrow, the banner, the bank.
  const arrow = page.locator('.board-area .sq-block-arrow[data-move="d8f6"]');
  await expect(arrow).toHaveCount(1);
  await expect(page.locator(".sq-status .sq-status-block")).toContainText("You blocked Qd8–f6 (−3)");
  await expect(page.locator(".sq-clockline-side.you .sq-res-bank")).toHaveText("2");
  // It draws itself again and again, slowly (its shaft's dash moves), its lock fading in and out.
  const look = () => arrow.evaluate((g) => ({ dash: getComputedStyle(g.querySelector(".sq-block-shaft")!).strokeDashoffset, lock: getComputedStyle(g.querySelector(".sq-block-lock")!).opacity }));
  const samples: { dash: string; lock: string }[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push(await look());
    await page.waitForTimeout(250);
  }
  expect(new Set(samples.map((x) => x.dash)).size).toBeGreaterThan(3);
  expect(new Set(samples.map((x) => x.lock)).size).toBeGreaterThan(3);
  // Done blocking; your move.
  await page.getByRole("button", { name: "Done blocking" }).click();
  await tapSquare(page, "d1");
  await tapSquare(page, "d4");
  await expect.poll(async () => (await seen(page)).mine).toBe("d1d4");
  // Their half: the arrow stays up while they choose; then they've moved, not Qf6, and it's gone. (Your board's blocks:
  // the match's list has every board's, and a bot on another board may block a move too, even Qf6.)
  await expect.poll(async () => page.evaluate(([k, b]) => (window as any).squads.matches.get(k).blocks.filter((x: any) => x.board === b).map((x: any) => x.move), [s.key, board] as const), { timeout: 60_000 }).toEqual(["d8f6"]);
  await expect(arrow).toHaveCount(1);
  await expect.poll(async () => page.evaluate(([k, b]) => (window as any).squads.matches.get(k).boards[b].moves.length, [s.key, board] as const), { timeout: 90_000 }).toBeGreaterThanOrEqual(2);
  const moves = await page.evaluate(([k, b]) => (window as any).squads.matches.get(k).boards[b].moves, [s.key, board] as const);
  expect(moves[0]).toBe("d1d4");
  expect(moves[1]).not.toBe("d8f6");
  await expect(arrow).toHaveCount(0);
});

test("Cheat lines while blocking: the other squad's best moves (after yours, or as things stand)", async ({ page }) => {
  test.setTimeout(240_000);
  await testLobby(page, "relay", "mercenary");
  const s = await nextDuty(page, null);
  await page.getByRole("button", { name: /^Block · / }).click();
  const cheat = page.getByRole("button", { name: "Cheat lines" });
  await cheat.click();
  await expect(page.locator(".sq-cheat-lines li")).toHaveCount(3, { timeout: 30_000 });
  // No move of yours yet: the move handed over, so the lines are Black's moves here.
  const black = new Chess(s.fen!.replace(" w ", " b ").replace(/ [a-h]\d /, " - "));
  const legal = black.moves({ verbose: true }).map((m) => m.san);
  const sans = (await page.locator(".sq-cheat-lines li strong").allTextContents()).map((t) => t.replace(/^\d · /, ""));
  expect(sans).toHaveLength(3);
  for (const san of sans) expect(legal).toContain(san);
});
