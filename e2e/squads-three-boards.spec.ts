import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
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

/** Every row of the turn order on screen: its name, whether lit, its "where you stand" words. */
const queue = (page: Page) =>
  page.locator(".sq-to-row").evaluateAll((rows) => rows.map((r) => ({ name: r.querySelector(".sq-to-name")?.textContent ?? "", lit: r.classList.contains("lit"), where: r.querySelector(".sq-to-where")?.textContent ?? null })));

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

test("the turn order: one queue for the board on screen, one size on every board, the mover lit on top, your place said; a row's tap shows that position", async ({ page }) => {
  test.setTimeout(240_000);
  await relayLobby(page);
  let s = await nextDuty(page);
  // Your move: you on top, lit, "Your turn · play now".
  const q0 = await queue(page);
  expect(q0[0]).toMatchObject({ name: "You", lit: true, where: "Your turn · play now" });
  expect(q0.filter((r) => r.lit)).toHaveLength(1);
  const phone = test.info().project.name === "phone";
  // A phone: 4 rows, a tap for all 8 (over the board: nothing below moves), and back; a computer: all 8.
  expect(q0).toHaveLength(phone ? 4 : 8);
  const box = page.locator(".sq-to");
  const size = (await box.boundingBox())!;
  if (phone) {
    const nav = (await page.locator(".history-nav").boundingBox())!;
    await page.locator(".sq-to-more").click();
    expect(await queue(page)).toHaveLength(8);
    expect(new Set((await queue(page)).map((r) => r.name)).size).toBe(8);
    const open = (await box.boundingBox())!;
    expect(open.height).toBeCloseTo(size.height, 0);
    expect((await page.locator(".history-nav").boundingBox())!.y).toBeCloseTo(nav.y, 0);
    await page.locator(".sq-to-more").click();
    expect(await queue(page)).toHaveLength(4);
  }
  await play(page, quiet(s.fen!));
  // Moved: you're no longer lit; each board of your match in turn, the box the same size, you on it somewhere.
  await expect(page.locator(".sq-to-row.you.lit")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.locator(".sq-match.ours button.sq-tiny").nth(i).click();
    const b = (await box.boundingBox())!;
    expect(b.height).toBeCloseTo(size.height, 0);
    expect(b.width).toBeCloseTo(size.width, 0);
    const where = await page.locator(".sq-to-row.you .sq-to-where").textContent();
    expect(where).toMatch(/^(Your turn · play now|Waiting for 1 player|Waiting for [2-7] players)$/);
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

test("nothing below the screen's bottom edge at the phone sizes with their browser bars", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "a phone's sizes");
  test.setTimeout(240_000);
  await relayLobby(page);
  await nextDuty(page);
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
      if (document.scrollingElement!.scrollHeight > h + 1) past.push(`scrolls ${document.scrollingElement!.scrollHeight - h}`);
      for (const sel of [".board-area", ".history-nav", ".sq-to"]) {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        if (r.bottom > h + 0.5) past.push(`${sel} ${Math.round(r.bottom - h)} px`);
      }
      return past;
    });
    expect(out, `${w}×${h}`).toEqual([]);
  }
});
