import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, named, test } from "./helpers.ts";

/**
 * Squads' test tools for Eric (docs/areas/squads.md, "Test controls"): the start link (/squads/test: seated at once with
 * bots in every other seat, straight into the first vote) and "Cheat lines" (the engine's top 3 as arrows, worked out
 * on the device). Through the real server (wrangler dev, SQUADS_TEST on, so every page is a test player there; the
 * player's run below has its `welcome` rewritten to say what the server tells a non-admin).
 */

/** Your duty in your squad's live match, and its board's position (the page's Squads client, ?debug). */
const duty = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).squads;
    const m = s ? [...s.matches.values()].find((x: any) => x.state === "half" && x.sides.some((sd: any) => sd.seats.includes(s.myId))) : null;
    const d = m?.current?.duties.find((x: any) => x.players.includes(s.myId));
    return d ? { at: `${m.key}/${m.current.seq}`, role: d.role as string, fen: m.boards[d.board].fen as string, moved: !!m.visible[s.myId] } : null;
  });

async function nextDuty(page: Page, after: string | null) {
  await expect.poll(async () => {
    const d = await duty(page);
    return !!d && !d.moved && d.at !== after;
  }, { timeout: 90_000, intervals: [250] }).toBe(true);
  return (await duty(page))!;
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

const arrows = (page: Page) => page.locator(`.board-area ${BOARD_SEL.arrowLine}`);
const labels = (page: Page) => page.locator(".board-area svg.hb-labels text");

test("the start link seats you with bots at once at the first vote; Skip votes; Cheat lines draws the top 3 on your Relay move and stays on", async ({ page }) => {
  test.setTimeout(240_000);
  await named(page, "Eric");
  await page.goto("/squads/test?nolanding&debug&clock=90,0,3,0");
  // No waiting for the fill: the first vote is up at once, every other seat a bot.
  await expect(page.locator(".vote-title h1")).toHaveText("How do the boards start?", { timeout: 15_000 });
  const lobby = await page.evaluate(() => {
    const s = (window as any).squads;
    return { people: s.lobby.players.filter((p: any) => !p.isBot).length, bots: s.lobby.players.filter((p: any) => p.isBot).length, vote: s.vote?.index };
  });
  expect(lobby).toEqual({ people: 1, bots: 31, vote: 0 });
  await page.getByRole("button", { name: "Skip votes" }).click();
  // Relay: your move. The switch shows; nothing drawn until it's on.
  const first = await nextDuty(page, null);
  expect(first.role).toBe("move");
  const cheat = page.getByRole("button", { name: "Cheat lines" });
  await expect(cheat).toBeVisible();
  await expect(arrows(page)).toHaveCount(0);
  await cheat.click();
  await expect(cheat).toHaveAttribute("aria-pressed", "true");
  await expect(arrows(page)).toHaveCount(3, { timeout: 30_000 });
  await expect(labels(page)).toHaveCount(3);
  for (const t of await labels(page).allTextContents()) expect(t).toMatch(/^([+−]\d\.\d|0\.0|#-?\d+)$/);
  await expect(page.locator(".sq-cheat-lines li")).toHaveCount(3);
  await expect(page.locator(".sq-cheat-lines li").first()).toContainText(/^1 · /);
  // Your move made: nothing left to choose here, so the switch and its arrows go until your next choice.
  const move = new Chess(first.fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? "")).find((m) => m.length === 4)!;
  await tapSquare(page, move.slice(0, 2));
  await tapSquare(page, move.slice(2, 4));
  await expect(cheat).toHaveCount(0);
  // Your next move: still on, worked out again for the new position.
  const second = await nextDuty(page, first.at);
  expect(second.fen).not.toBe(first.fen);
  await expect(page.getByRole("button", { name: "Cheat lines" })).toHaveAttribute("aria-pressed", "true");
  await expect(arrows(page)).toHaveCount(3, { timeout: 30_000 });
  // Off again: the arrows go.
  await page.getByRole("button", { name: "Cheat lines" }).click();
  await expect(arrows(page)).toHaveCount(0);
});

test("a player (not a test player) never gets Cheat lines: no button, and switching it on from the page does nothing", async ({ page }) => {
  test.setTimeout(240_000);
  await named(page, "Pat");
  // What the server tells a non-admin: `welcome` with test false.
  await page.routeWebSocket(/\/api\/squads\/lobby\/[A-Za-z2-9]{5}\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      if (typeof m === "string" && m.includes('"welcome"')) {
        const msg = JSON.parse(m);
        if (msg.t === "welcome") return ws.send(JSON.stringify({ ...msg, test: false }));
      }
      ws.send(m);
    });
  });
  await page.goto("/squads/test?nolanding&debug&clock=90,0,3,0");
  await expect(page.locator(".vote-title h1")).toHaveText("How do the boards start?", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Skip votes" })).toHaveCount(0);
  // (The server here lets anyone skip; the page has no button for it, so the test asks directly.)
  await page.evaluate(() => (window as any).squads.nextRound());
  const d = await nextDuty(page, null);
  expect(d.role).toBe("move");
  await expect(page.locator(".sq-duty.move")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cheat lines" })).toHaveCount(0);
  await page.evaluate(() => (window as any).squads.toggleCheatLines());
  expect(await page.evaluate(() => (window as any).squads.cheatLines)).toBe(false);
  await page.waitForTimeout(3_000);
  await expect(page.locator(".sq-cheat")).toHaveCount(0);
  await expect(arrows(page)).toHaveCount(0);
});

// (Cheat lines while choosing a block: e2e/squads-v2.spec.ts.)
