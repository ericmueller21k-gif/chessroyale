import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { relaySeat } from "@chessroyale/chess/squads";
import { BOARD_SEL, named, test } from "./helpers.ts";

/**
 * Squads Relay on 3 boards and the cleaner match screen (Eric, Nov 5; docs/decisions/2026-11-05-squads-three-boards.md),
 * on the real server (wrangler dev, SQUADS_TEST on): a Relay match on 3 boards plays to a result (finished boards checked
 * in the winner's color); the turn order is one queue for the board on screen, of one size, the mover lit, your row
 * saying where you stand, a row's tap showing that position; the coach marks run once, and "Don't show these again"
 * sticks; and nothing is below the screen's bottom edge at the phone sizes with their browser bars.
 */

interface Seen {
  key: string | null;
  seq: number | null;
  duty: { board: number } | null;
  fen: string | null;
  mine: string | null;
  result: unknown;
}

const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const s = (window as any).squads;
    const m = s ? [...s.matches.values()].find((x: any) => x.sides.some((sd: any) => sd.seats.includes(s.myId))) : null;
    const d = m?.state === "half" ? m.current?.duties.find((x: any) => x.players.includes(s.myId)) : null;
    return { key: m?.key ?? null, seq: m?.current?.seq ?? null, duty: d ? { board: d.board } : null, fen: d ? m.boards[d.board].fen : null, mine: m ? (m.visible[s.myId] ?? null) : null, result: m?.result ?? null };
  });

async function nextDuty(page: Page, after: number | null = null, timeout = 120_000): Promise<Seen> {
  let s: Seen | null = null;
  await expect
    .poll(
      async () => {
        s = await seen(page);
        return !!s.duty && !s.mine && (after === null || (s.seq ?? -1) > after);
      },
      { timeout, intervals: [100] },
    )
    .toBe(true);
  return s!;
}

async function tapSquare(page: Page, sq: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).first().boundingBox())!;
  const black = await page.locator(`.board-area ${BOARD_SEL.wrap}`).first().evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await page.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

async function play(page: Page, uci: string) {
  await tapSquare(page, uci.slice(0, 2));
  await tapSquare(page, uci.slice(2, 4));
  await expect.poll(async () => (await seen(page)).mine, { timeout: 5_000 }).toBe(uci);
}

const quiet = (fen: string) => {
  const m = new Chess(fen).moves({ verbose: true }).find((x) => !x.captured && !x.promotion)!;
  return m.from + m.to;
};

/** A Relay test lobby (Classic, White on your first board), past the votes. */
async function relayLobby(page: Page, extra = "") {
  await named(page, "Tess");
  await page.goto(`/squads/test/relay?nolanding&debug&clock=120,0,3,0,60&seat=white&mode=classic${extra}`);
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
}

/** Real-length usernames (Eric, Nov 5: 6-20 characters, a mix) for every player but you, in the lobby's order. */
const NAMES = ["QueenSacrificeQueen", "knightrider_2009", "Zugzwang Zoe", "TheBishopOfBanter", "pawnstorm77", "en_passant_enjoyer", "Fischer4ever", "CastleQueenside", "gambit_goblin", "BlunderMaster3000", "Ruy_Lopez_Fan", "rookie_rook"];
async function realNames(page: Page) {
  await expect.poll(() => page.evaluate(() => !!(window as any).squads?.lobby?.players?.length), { timeout: 30_000 }).toBe(true);
  await page.evaluate((names) => {
    const s = (window as any).squads;
    // (Your match's players first, so the 7 in your match have 7 different names.)
    const m = [...s.matches.values()].find((x: any) => x.sides.some((sd: any) => sd.seats.includes(s.myId)));
    const mine: string[] = m ? m.sides.flatMap((sd: any) => sd.seats) : [];
    const ids = [...mine, ...s.lobby.players.map((x: any) => x.id).filter((id: string) => !mine.includes(id))].filter((id: string) => id !== s.myId);
    const was = s.nameOf.bind(s);
    s.nameOf = (id: string) => (id === s.myId ? was(id) : (names[ids.indexOf(id) % names.length] ?? was(id)));
    s.emit?.();
  }, NAMES);
}

/** The turn order's rows: one height, the move column in one place, no name wrapped (a long one cut with an ellipsis). */
const rowsLaidOut = (page: Page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll(".sq-to-row")];
    const names = rows.map((r) => r.querySelector(".sq-to-name") as HTMLElement);
    return {
      heights: new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height))).size,
      moveRights: new Set(rows.map((r) => Math.round(r.querySelector(".sq-to-move")!.getBoundingClientRect().right))).size,
      moveWidths: new Set(rows.map((r) => Math.round(r.querySelector(".sq-to-move")!.getBoundingClientRect().width))).size,
      wrapped: names.filter((n) => n.getClientRects().length > 1).length,
      ellipsis: names.every((n) => getComputedStyle(n).textOverflow === "ellipsis" && getComputedStyle(n).whiteSpace === "nowrap"),
    };
  });

/** Every row of the turn order on screen: its name, whether lit, its "where you stand" words. */
const queue = (page: Page) =>
  page.locator(".sq-to-row").evaluateAll((rows) => rows.map((r) => ({ name: r.querySelector(".sq-to-name")?.textContent ?? "", lit: r.classList.contains("lit"), where: r.querySelector(".sq-to-where")?.textContent ?? null })));

/**
 * The words each row's middle should say on the board on screen, worked out here from the rules' schedule (relaySeat):
 * the next 8 moves there, by ply, each to its player; the first move a player has there: "now" (or "Your turn · play
 * now") while it's asked, "next", then "in N".
 */
async function scheduleWhen(page: Page): Promise<Record<string, string>> {
  const m = await page.evaluate(() => {
    const s = (window as any).squads;
    const m = [...s.matches.values()].find((x: any) => x.sides.some((sd: any) => sd.seats.includes(s.myId)));
    const board = Number(document.querySelector(".sq-to-list")!.getAttribute("aria-label")!.match(/(\d+)$/)![1]) - 1;
    const lit = [...document.querySelectorAll<HTMLElement>(".sq-to-row.lit")].map((r) => r.dataset.id);
    return { me: s.myId, n: m.boards.length, board, white: m.boards[board].white, moves: m.boards[board].moves.length, seats: m.sides.map((sd: any) => sd.seats), lit };
  });
  const out: Record<string, string> = {};
  for (let k = 0; Object.keys(out).length < 8 && k < 32; k++) {
    const ply = m.moves + k;
    const side = (ply % 2 === 0 ? m.white : 1 - m.white) as 0 | 1;
    const seats: string[] = m.seats[side];
    const id = seats[relaySeat(m.n, m.board, ply >> 1, seats.length, side)]!;
    if (id in out) continue;
    out[id] = k === 0 && m.lit.includes(id) ? (id === m.me ? "Your turn · play now" : "now") : k === 0 ? "next" : `in ${k + 1}`;
  }
  return out;
}

/** What the rows' middles say, by player. */
const shownWhen = (page: Page) =>
  page.locator(".sq-to-row").evaluateAll((rows) => Object.fromEntries(rows.map((r) => [(r as HTMLElement).dataset.id, r.querySelector(".sq-to-where")?.textContent ?? ""])));

/** The move column's width, and the widest of the longest SANs set in its own font. */
const moveRoom = (page: Page) =>
  page.evaluate(() => {
    const cell = document.querySelector<HTMLElement>(".sq-to-row .sq-to-move")!;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    // (Each part of the font: with tabular numbers the "font" shorthand reads empty.)
    const cs = getComputedStyle(cell);
    for (const k of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariantNumeric", "letterSpacing"] as const) probe.style[k] = cs[k];
    document.body.appendChild(probe);
    const widths = ["exd8=Q+", "Nbxd7#", "O-O-O+"].map((t) => ((probe.textContent = t), probe.getBoundingClientRect().width));
    probe.remove();
    return { column: cell.getBoundingClientRect().width, longest: Math.max(...widths) };
  });

test("a Relay match on 3 boards plays to a result: 12 tiny boards, the finished ones checked in the winner's color", async ({ page }) => {
  test.setTimeout(240_000);
  // Every board from a mate in one for White (Qxf7#): the first half decides every board.
  const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
  await relayLobby(page, `&fen=${encodeURIComponent(fen)}&bots=strong`);
  const s = await nextDuty(page);
  await expect(page.locator(".sq-tiny")).toHaveCount(12);
  await expect(page.locator(".sq-match.ours .sq-tiny")).toHaveCount(3);
  await play(page, "h5f7");
  await expect.poll(async () => (await seen(page)).result, { timeout: 90_000 }).not.toBeNull();
  const r = (await seen(page)).result as { winner: number; points: number[]; how: string };
  // Best 2 of 3: White wins all three (side 0 White on boards 1 and 3): 2–1.
  expect(r.points).toEqual([2, 1]);
  expect(r.winner).toBe(0);
  // The finished boards: not grayed, a border and a check mark in the winning squad's color.
  const ours = page.locator(".sq-match.ours .sq-tiny.is-won");
  await expect(ours).toHaveCount(3, { timeout: 10_000 });
  await expect(page.locator(".sq-match.ours .sq-done")).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(ours.nth(i).locator(".tiny-board")).toHaveCSS("filter", "none");
    await expect(ours.nth(i).locator(".tiny-board")).toHaveCSS("opacity", "1");
  }
  void s;
});

test("the turn order: one queue for the board on screen, one size on every board, the mover lit on top, \"Your turn · play now\" only on top; long names cut, the move column in place; a row's tap shows that position", async ({ page }) => {
  test.setTimeout(240_000);
  await relayLobby(page);
  let s = await nextDuty(page);
  await realNames(page);
  // Your move: you on top, lit, "Your turn · play now".
  const q0 = await queue(page);
  expect(q0[0]).toMatchObject({ name: "You", lit: true, where: "Your turn · play now" });
  expect(q0.filter((r) => r.lit)).toHaveLength(1);
  // Real-length names (up to 20 letters): one row height, the move column in one place, nothing wrapped.
  await page.waitForTimeout(300);
  expect(await rowsLaidOut(page)).toEqual({ heights: 1, moveRights: 1, moveWidths: 1, wrapped: 0, ellipsis: true });
  // All 8, phone and computer (Eric, Nov 7: no fold, no button for the rest).
  expect(q0).toHaveLength(8);
  expect(new Set(q0.map((r) => r.name)).size).toBe(8);
  await expect(page.locator(".sq-to-more")).toHaveCount(0);
  // Each middle says when that player moves on this board, as the rules' schedule has it ("next", "in 2" … "in 8").
  expect(await shownWhen(page)).toEqual(await scheduleWhen(page));
  // The move column fits the longest SANs ("exd8=Q+", "Nbxd7#", "O-O-O+"); before a player's first move: "—".
  const room = await moveRoom(page);
  expect(room.column).toBeGreaterThanOrEqual(room.longest);
  expect(await page.locator(".sq-to-move", { hasText: "—" }).count()).toBeGreaterThan(0);
  // Every bot's row has its 🤖 badge after the name (you're the one person here).
  await expect(page.locator(".sq-to-row .sq-to-badge.bot")).toHaveCount(7);
  const box = page.locator(".sq-to");
  const size = (await box.boundingBox())!;
  await play(page, quiet(s.fen!));
  // Moved: you're no longer lit; each board of your match in turn, the box the same size, you on it somewhere.
  await expect(page.locator(".sq-to-row.you.lit")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.locator(".sq-match.ours button.sq-tiny").nth(i).click();
    await expect(page.locator(".sq-to-list")).toHaveAttribute("aria-label", `Turn order on board ${i + 1}`);
    const b = (await box.boundingBox())!;
    expect(b.height).toBeCloseTo(size.height, 0);
    expect(b.width).toBeCloseTo(size.width, 0);
    // Your row: you've moved, so no "Your turn · play now" anywhere (Eric); when you move here next, as every row's.
    expect(Number(await page.locator(".sq-to-row.you").getAttribute("data-place"))).toBeGreaterThanOrEqual(0);
    expect(await page.locator(".sq-to-row.you .sq-to-where").textContent()).toMatch(/^(next|in [2-8])$/);
    expect(await rowsLaidOut(page)).toEqual({ heights: 1, moveRights: 1, moveWidths: 1, wrapped: 0, ellipsis: true });
  }
  // A few halves on, a row with a last move: its tap shows that board at the position after it.
  s = await nextDuty(page, s.seq);
  await play(page, quiet(s.fen!));
  const row = page.locator(".sq-to-row:not(:disabled)").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(page.locator(".history-nav.browsing")).toBeVisible();
  await expect(page.locator(".sq-to-row.shown")).toHaveCount(1);
});

test("the turn order is never rebuilt (Eric): tapping each tiny board in turn keeps the same box, at the same size, with the same row for each player; only the order changes", async ({ page }) => {
  test.setTimeout(240_000);
  await relayLobby(page);
  const s = await nextDuty(page);
  await realNames(page);
  await play(page, quiet(s.fen!));
  // (All 8 on a phone too: every player's row is there on every board.)
  await expect(page.locator(".sq-to-row")).toHaveCount(8);
  const box = page.locator(".sq-to");
  const before = (await box.boundingBox())!;
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".sq-to")!;
    el.dataset.mark = "kept";
    (window as any).__rows = Object.fromEntries([...el.querySelectorAll<HTMLElement>(".sq-to-row")].map((r) => [r.dataset.id, r]));
    (window as any).__orders = [];
  });
  for (let i = 0; i < 3; i++) {
    await page.locator(".sq-match.ours button.sq-tiny").nth(i).click();
    await expect(page.locator(".sq-tiny.on")).toHaveCount(1);
    await page.waitForTimeout(400);
    const same = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".sq-to")!;
      const rows = [...el.querySelectorAll<HTMLElement>(".sq-to-row")];
      (window as any).__orders.push(rows.map((r) => r.dataset.id).join());
      return { mark: el.dataset.mark ?? null, boxes: document.querySelectorAll(".sq-to").length, rows: rows.length, sameRows: rows.every((r) => (window as any).__rows[r.dataset.id!] === r) };
    });
    expect(same).toEqual({ mark: "kept", boxes: 1, rows: 8, sameRows: true });
    const b = (await box.boundingBox())!;
    expect([b.x, b.y, b.width, b.height].map(Math.round)).toEqual([before.x, before.y, before.width, before.height].map(Math.round));
  }
  // The order did change between boards (the queue is each board's).
  expect(new Set(await page.evaluate(() => (window as any).__orders)).size).toBeGreaterThan(1);
});

test("the coach marks: three, one at a time, a tap goes on; unticked they come back next lobby; \"Don't show these again\" and never again", async ({ page }) => {
  test.setTimeout(300_000);
  const marks = page.locator(".cm");
  const run = async (never: boolean) => {
    for (const [i, id] of ["settings", "replay", "boards"].entries()) {
      await expect(marks).toHaveAttribute("data-mark", id, { timeout: i ? 5_000 : 60_000 });
      // The thing it points at is whole on screen, and so is its box.
      const box = (await page.locator(".cm-box").boundingBox())!;
      const vp = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
      if (id === "boards") {
        if (never) await page.getByLabel("Don't show these again").check();
        await page.locator(".cm-ok").click();
      } else if (i === 0) await page.locator(".cm-ok").click();
      // (A tap anywhere goes on too.)
      else await page.mouse.click(5, 5);
    }
    await expect(marks).toHaveCount(0);
  };
  await relayLobby(page, "&coach");
  await expect(page.locator(".cm-text")).toHaveText("Tap here for settings, like Quick board jump.", { timeout: 60_000 });
  await run(false);
  // Not ticked: they come back at the next lobby's Relay.
  await relayLobby(page, "&coach");
  await run(true);
  // Ticked: never again on this device.
  await relayLobby(page, "&coach");
  await nextDuty(page);
  await page.waitForTimeout(1_000);
  await expect(marks).toHaveCount(0);
});

test("nothing below the screen's bottom edge at the phone sizes with their browser bars; the turn order's 8 rows fill the rest and scroll inside their box, never the page", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "a phone's sizes");
  test.setTimeout(240_000);
  await relayLobby(page);
  await nextDuty(page);
  await realNames(page);
  // iPhone 13 and 15 with Safari's bars, a big iPhone, a short Android with Chrome's.
  for (const [w, h] of [
    [390, 664],
    [393, 659],
    [428, 746],
    [360, 560],
  ]) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.waitForTimeout(300);
    const out = await page.evaluate(() => {
      const h = innerHeight;
      const past: string[] = [];
      if (document.scrollingElement!.scrollHeight !== h) past.push(`page ${document.scrollingElement!.scrollHeight} tall`);
      for (const sel of [".board-area", ".history-nav", ".sq-to"]) {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        if (r.bottom > h + 0.5) past.push(`${sel} ${Math.round(r.bottom - h)} px`);
      }
      return past;
    });
    expect(out, `${w}×${h}`).toEqual([]);
    // All 8 rows; the box from under the arrows to the screen's foot; the rows it shows whole (6 at the iPhones with
    // their bars; Eric: "most phones we can squeeze in 6 or 7"); past that it scrolls inside, the page staying put.
    const list = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".sq-to-list")!;
      const r = el.getBoundingClientRect();
      const nav = document.querySelector(".history-nav")!.getBoundingClientRect();
      const whole = [...el.querySelectorAll(".sq-to-row")].filter((x) => x.getBoundingClientRect().bottom <= r.bottom + 0.5).length;
      const over = el.scrollHeight > el.clientHeight + 1;
      el.scrollTop = 1000;
      const scrolled = el.scrollTop;
      el.scrollTop = 0;
      return { rows: el.querySelectorAll(".sq-to-row").length, top: r.top - nav.bottom, bottom: innerHeight - r.bottom, whole, over, scrolled, pageY: scrollY, overflow: getComputedStyle(el).overflowY };
    });
    expect(list.rows, `${w}×${h}`).toBe(8);
    expect(list.top, `${w}×${h}`).toBeGreaterThanOrEqual(0);
    expect(list.top, `${w}×${h}`).toBeLessThan(12);
    expect(list.bottom, `${w}×${h}`).toBeGreaterThanOrEqual(0);
    expect(list.bottom, `${w}×${h}`).toBeLessThan(24);
    expect(list.whole, `${w}×${h}`).toBeGreaterThanOrEqual(h >= 600 ? 6 : 4);
    expect(list.overflow).toBe("auto");
    expect(list.pageY).toBe(0);
    if (list.whole < 8) expect([list.over, list.scrolled > 0], `${w}×${h}: scrolls inside`).toEqual([true, true]);
    test.info().annotations.push({ type: "rows", description: `${w}×${h}: ${list.whole} of 8 whole` });
    expect((await moveRoom(page)).column, `${w}×${h}`).toBeGreaterThanOrEqual((await moveRoom(page)).longest);
    // The turn order's long names at every width: cut, never wrapped, the move column in place.
    expect(await rowsLaidOut(page), `${w}×${h}`).toEqual({ heights: 1, moveRights: 1, moveWidths: 1, wrapped: 0, ellipsis: true });
  }
});
