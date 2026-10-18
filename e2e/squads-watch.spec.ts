import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, named, test, watchFor } from "./helpers.ts";
import { SquadsClient } from "./squads-client.ts";

/**
 * Squads, Oct 14 (Eric): "Jump to my next board" (Relay; on by default, remembered on the device) and who's watching a
 * board (the other people showing it full size, as pawns with an eye over it), through the screens on the real server
 * (wrangler dev, SQUADS_TEST on). A second viewer is a headless player in the same lobby (e2e/squads-client.ts).
 */

interface Seen {
  key: string | null;
  seq: number | null;
  duty: { board: number; role: "move" | "pick" } | null;
  fen: string | null;
  mine: string | null;
}

const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const s = (window as any).squads;
    const m = s ? [...s.matches.values()].find((x: any) => x.state !== "over" && x.sides.some((sd: any) => sd.seats.includes(s.myId))) : null;
    const d = m?.state === "half" ? m.current?.duties.find((x: any) => x.players.includes(s.myId)) : null;
    return {
      key: m?.key ?? null,
      seq: m?.current?.seq ?? null,
      duty: d ? { board: d.board, role: d.role } : null,
      fen: d ? m.boards[d.board].fen : null,
      mine: m ? (m.visible[s.myId] ?? null) : null,
    };
  });

async function nextDuty(page: Page, timeout = 90_000): Promise<Seen> {
  let s: Seen | null = null;
  await expect
    .poll(
      async () => {
        s = await seen(page);
        return !!s.duty;
      },
      { timeout, intervals: [250] },
    )
    .toBe(true);
  return s!;
}

async function tapSquare(page: Page, sq: string) {
  const box = (await page.locator(`.board-area ${BOARD_SEL.squares}`).boundingBox())!;
  const black = await page.locator(`.board-area ${BOARD_SEL.wrap}`).evaluate((el) => el.classList.contains("orientation-black"));
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const x = black ? 7 - f : f;
  const y = black ? r : 7 - r;
  await page.mouse.click(box.x + (x + 0.5) * (box.width / 8), box.y + (y + 0.5) * (box.height / 8));
}

/** Your Relay move, the way a player makes it (tap, tap): the first quiet legal move. */
async function move(page: Page, fen: string) {
  const mv = new Chess(fen).moves({ verbose: true }).find((m) => !m.captured && !m.promotion)!;
  await tapSquare(page, mv.from);
  await tapSquare(page, mv.to);
  await expect.poll(async () => (await seen(page)).mine).toBe(mv.from + mv.to);
}

/**
 * A Relay test lobby (Classic, you White on your first board, a 60 s cap on a move so a half waits for the test), past
 * the votes. `beforeFill` runs as soon as the lobby's code is known, before its bots fill it (a second player joins).
 */
async function relayLobby(page: Page, beforeFill?: (code: string) => Promise<void>) {
  await named(page, "Tess");
  await page.goto(`/squads/test/relay?nolanding&debug&clock=120,0,3,0,60&seat=white&mode=classic`);
  if (beforeFill) {
    await expect.poll(() => page.evaluate(() => (window as any).squads?.code ?? null), { timeout: 20_000, intervals: [100] }).not.toBeNull();
    await beforeFill(await page.evaluate(() => (window as any).squads.code));
  }
  await expect(page.getByRole("button", { name: "Skip votes" })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Skip votes" }).click();
}

const jumpSwitch = (page: Page) => page.getByRole("switch", { name: "Jump to my next board" });

test("Jump to my next board, on by default: once you've moved, the big board goes to the board you play next; Back to my board stays", async ({ page }) => {
  test.setTimeout(240_000);
  await relayLobby(page);
  const s = await nextDuty(page);
  expect(s.duty!.role).toBe("move");
  await expect(page.locator(".sq-tiny.on")).toHaveClass(/is-you/);
  // The switch is on, with its (i): a sentence on what it does.
  await expect(jumpSwitch(page)).toBeChecked();
  await expect(page.locator(".sq-jump-info")).toHaveCount(0);
  await page.getByRole("button", { name: 'What "Jump to my next board" does' }).click();
  await expect(page.locator(".sq-jump-info")).toContainText("once you've moved, you go straight to the board you play next turn");
  // Your move lands on your board first (a beat), then the big board is next turn's (the NEXT tiny board).
  const order = await watchFor(page, { moved: { selector: ".sq-status", text: /^Moved · Board \d/ }, next: { selector: ".sq-status", text: /^Watching Board \d · your next board$/ } });
  const t0 = Date.now();
  await move(page, s.fen!);
  await expect(page.locator(".sq-tiny.on .sq-mark.next")).toHaveCount(1, { timeout: 5_000 });
  expect(Date.now() - t0).toBeLessThan(4_000);
  expect(await order.seen()).toEqual({ moved: true, next: true });
  // Your next board, your side's way up; Back to my board, and it stays there for the rest of the half.
  await page.getByRole("button", { name: "Back to my board" }).click();
  await expect(page.locator(".sq-tiny.on")).toHaveClass(/is-you/);
  await page.waitForTimeout(1_500);
  await expect(page.locator(".sq-tiny.on")).toHaveClass(/is-you/);
  await expect(page.locator(".sq-status")).toContainText(/^Moved · Board \d|^Their move|is over|landing/);
});

test("Jump to my next board when you're the last to move: the half ends at once, and the big board still goes to your next board", async ({ page }) => {
  test.setTimeout(240_000);
  await relayLobby(page);
  const s = await nextDuty(page);
  expect(s.duty!.role).toBe("move");
  // (Eric, Oct 18: it waited for the other half instead.) Everyone else with a move this half has made it first.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const sq = (window as any).squads;
          const m = [...sq.matches.values()].find((x: any) => x.state === "half" && x.sides.some((sd: any) => sd.seats.includes(sq.myId)));
          const others = m.current.duties.flatMap((d: any) => d.players).filter((id: string) => id !== sq.myId);
          return others.length > 0 && others.every((id: string) => m.locked.includes(id));
        }),
      { timeout: 90_000, intervals: [250] },
    )
    .toBe(true);
  // (Your move, tap, tap: the half ends with it, so it isn't waited for among the choices.)
  const mv = new Chess(s.fen!).moves({ verbose: true }).find((m) => !m.captured && !m.promotion)!;
  await tapSquare(page, mv.from);
  await tapSquare(page, mv.to);
  await expect(page.locator(".sq-status")).toHaveText(/^Watching Board \d · your next board$/, { timeout: 4_000 });
  await expect(page.locator(".sq-tiny.on .sq-mark.next")).toHaveCount(1);
});

test("Jump to my next board, switched off: you stay on your board after moving; the device remembers it", async ({ page }) => {
  test.setTimeout(240_000);
  await relayLobby(page);
  const s = await nextDuty(page);
  await jumpSwitch(page).click();
  await expect(jumpSwitch(page)).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("brc.squads.jumpNext"))).toBe("0");
  await move(page, s.fen!);
  await expect(page.locator(".sq-status")).toContainText(/^Moved · Board \d/);
  // Well past the jump's beat: still your board.
  await page.waitForTimeout(2_000);
  await expect(page.locator(".sq-tiny.on")).toHaveClass(/is-you/);
  await expect(page.getByRole("button", { name: "Back to my board" })).toHaveCount(0);
  // A reload (back into the same lobby): still off.
  await page.reload();
  await expect(jumpSwitch(page)).not.toBeChecked({ timeout: 30_000 });
});

test("who's watching: another player showing your board puts their pawn (their items on) and an eye over it, without moving the board; gone when they look away or leave", async ({ page, baseURL }) => {
  test.setTimeout(240_000);
  const look = { head: { def: "wizard-hat", color: "cobalt", blemish: 0, seed: 1 }, face: { def: "dark-shades", color: "midnight", blemish: 0, seed: 2 } };
  const wes = new SquadsClient({ base: baseURL!, name: "Wes", look });
  try {
    await relayLobby(page, (code) => wes.join(code));
    const s = await nextDuty(page);
    expect(s.duty!.role).toBe("move");
    await expect(page.locator(".sq-watchers")).toHaveCount(0);
    const board = page.locator(`.board-area ${BOARD_SEL.wrap}`);
    const before = (await board.boundingBox())!;
    // Wes (a teammate on another board) opens yours: his pawn, dressed, after an eye; your own never shows to you.
    wes.send({ t: "view", key: s.key, board: s.duty!.board });
    const pawn = page.locator(`.sq-watchers .sq-watcher[data-id="${wes.playerId}"]`);
    await expect(pawn).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".sq-watchers .sq-eye")).toBeVisible();
    await expect(page.locator(".sq-watchers .sq-watcher")).toHaveCount(1);
    await expect(page.locator(".sq-watchers")).toHaveAttribute("title", "Watching: Wes");
    expect(await pawn.locator(".avatar-items.front g g").count()).toBeGreaterThan(0);
    // The line above the board keeps its height: the board hasn't moved.
    const after = (await board.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
    expect(Math.abs(after.height - before.height)).toBeLessThan(0.5);
    // He looks at another board: gone. Back on yours, then his socket closes: gone.
    wes.send({ t: "view", key: s.key, board: (s.duty!.board + 2) % 4 });
    await expect(page.locator(".sq-watchers")).toHaveCount(0, { timeout: 5_000 });
    wes.send({ t: "view", key: s.key, board: s.duty!.board });
    await expect(pawn).toBeVisible({ timeout: 5_000 });
    wes.close();
    await expect(page.locator(".sq-watchers")).toHaveCount(0, { timeout: 5_000 });
  } finally {
    wes.close();
  }
});
