import { expect, type Page } from "@playwright/test";
import { CROWD_START, PREGAME_VOTES } from "@chessroyale/core";
import { START_FEN, applyMove, baseAt, isChess960Fen, legalMoves, pieceAt } from "@chessroyale/chess";
import { BOARD_SEL, createLobbyFromHome, soloFromHome, submitMove, test } from "./helpers.ts";

/**
 * The 50 v 50's start vote, "How does it start?" (Eric, Oct 24; docs/decisions/2026-10-24-opening-vote.md): held
 * second of three, Normal | Random opening | Freestyle, and each start played from its first move.
 */

const START = PREGAME_VOTES.find((v) => v.id === "start")!;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** The pieces drawn on the game's board, square by square ("wk" a white king), read from where each stands, either way up. */
const drawn = (page: Page) =>
  page.evaluate((sel) => {
    const wrap = document.querySelector(`.board-area ${sel.wrap}`);
    const squares = document.querySelector(`.board-area ${sel.squares}`);
    if (!wrap || !squares) return {};
    const black = wrap.classList.contains("orientation-black");
    const box = squares.getBoundingClientRect();
    const kinds: Record<string, string> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
    const out: Record<string, string> = {};
    for (const p of document.querySelectorAll<HTMLElement>(`.board-area ${sel.piece}`)) {
      if (p.classList.contains("fading")) continue;
      const r = p.getBoundingClientRect();
      let col = Math.floor((r.x + r.width / 2 - box.x) / (box.width / 8));
      let row = Math.floor((r.y + r.height / 2 - box.y) / (box.height / 8));
      if (black) [col, row] = [7 - col, 7 - row];
      const kind = Object.keys(kinds).find((k) => p.classList.contains(k));
      out[`${"abcdefgh"[col]}${8 - row}`] = `${p.classList.contains("white") ? "w" : "b"}${kind ? kinds[kind] : "?"}`;
    }
    return out;
  }, BOARD_SEL);

/** A position as `drawn` reads a board. */
function placement(fen: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const p = pieceAt(fen, `${f}${r}`);
    if (p) out[`${f}${r}`] = p.color + p.type;
  }
  return out;
}

/** The board the game is on (the play screen's): its position, its moves and where it started. */
const board = (page: Page) =>
  page.evaluate(() => {
    const b = (window as any).match.phase.board;
    return { fen: b.fen as string, history: b.history as string[], bases: (b.bases ?? null) as { ply: number; fen: string }[] | null };
  });

/** Waits for your own move with its clock running (the other team's turn comes first when you play Black). */
const waitForYourMove = (page: Page, timeout = 60_000) =>
  expect
    .poll(() => page.evaluate(() => (window as any).match?.phase.kind === "play" && Date.now() > (window as any).match.phase.startsAt + 200).catch(() => false), { timeout })
    .toBe(true);

/** Plays your first move from the game's start, then checks the board went on from it with the crowd's move. */
async function firstMove(page: Page) {
  await waitForYourMove(page, 90_000);
  const before = await board(page);
  await expect.poll(async () => drawn(page)).toEqual(placement(before.fen));
  await submitMove(page, legalMoves(before.fen)[0], before.fen);
  // The reveal: your move, and the crowd's, from that position.
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("reveal");
  const mine = await page.evaluate(() => {
    const m = (window as any).match.phase.mine;
    return { fen: m.fenBefore as string, played: m.result.playedMove as string, you: m.result.players.find((p: any) => p.playerId === (window as any).match.myId)?.move as string };
  });
  expect(mine.fen).toBe(before.fen);
  expect(mine.you).toBe(legalMoves(before.fen)[0]);
  expect(legalMoves(before.fen)).toContain(mine.played);
  // Then the board goes on from it.
  await expect.poll(async () => (await board(page).catch(() => null))?.history[before.history.length] === mine.played, { timeout: 60_000 }).toBe(true);
  return { before, played: mine.played };
}

test("the three votes in order: how it ends, how it starts, how fast; the start's cards and zones left to right; the game begins from the start that won", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug&mode=crowd&augments=1");
  await soloFromHome(page);
  await expect(page.locator(".vote-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".vote-step")).toHaveText("Vote 1 of 3");
  await expect(page.getByRole("heading", { name: "How does it end?" })).toBeVisible();

  // Vote 2: how it starts, in a player's words (never Chess960 or Fischer Random), left to right on the cards and the board.
  await expect(page.getByRole("heading", { name: "How does it start?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".vote-step")).toHaveText("Vote 2 of 3");
  await expect(page.locator(".vote-card strong")).toHaveText(["Normal", "Random opening", "Freestyle"]);
  await expect(page.locator(".vote-card-blurb")).toHaveText(["The usual starting position", `A real opening, ${CROWD_START.randomOpeningMoves} moves in`, "The back-row pieces start shuffled"]);
  await expect(page.locator(".vote-card-icon")).toHaveText(["♟️", "🎲", "🔀"]);
  for (const sel of [".vote-card", ".vote-zone"]) {
    const xs = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
    expect(xs, sel).toHaveLength(3);
    expect(xs, sel).toEqual([...xs].sort((a, b) => a - b));
  }
  expect(await page.locator(".vote-screen").innerText()).not.toMatch(/960|Fischer/i);
  // Vote Freestyle (the right-hand card); the crowd decides, and the banner names the start that won.
  await page.getByRole("radio", { name: /Freestyle/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(2);
  await expect(page.locator(".vote-banner")).toBeVisible({ timeout: 15_000 });
  const result: number = await page.evaluate(() => (window as any).match.phase.vote.result);
  const won = START.options[result]!;
  await expect(page.locator(".vote-banner")).toContainText(won.label);

  // Vote 3: the clock, as before.
  await expect(page.getByRole("heading", { name: "How fast?" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".vote-step")).toHaveText("Vote 3 of 3");
  // (Freestyle: the pieces that drop in after it are the game's own start.)
  const dropping: string | null = await page.evaluate(() => (window as any).match.phase.vote.start ?? null);

  // The game begins from the start that won: its pieces where the position has them.
  await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/play|watching/);
  await expect(page.locator(`.board-area ${BOARD_SEL.piece}`)).toHaveCount(32, { timeout: 10_000 });
  const b = await board(page);
  const start = baseAt(0, b.bases).fen;
  if (won.id === "freestyle") {
    expect(isChess960Fen(start)).toBe(true);
    expect(dropping).toBe(start);
  } else {
    expect(start).toBe(START_FEN);
    expect(dropping).toBeNull();
  }
  // (The game's first move hasn't been played yet: Random opening's moves are its opening.)
  expect(b.history).toHaveLength(won.id === "random" ? 2 * CROWD_START.randomOpeningMoves : 0);
  await expect.poll(async () => drawn(page), { timeout: 10_000 }).toEqual(placement(b.fen));
});

test("?start=freestyle (solo): a shuffled back row, drawn as it stands, mirrored for Black; your move from it is played on", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&format=team&start=freestyle");
  await soloFromHome(page);
  const { before } = await firstMove(page);
  const start = baseAt(0, before.bases).fen;
  expect(isChess960Fen(start)).toBe(true);
  expect(start).not.toBe(START_FEN);
  const rows = start.split(" ")[0]!.split("/");
  expect(rows[0]).toBe(rows[7]!.toLowerCase());
  expect([rows[1], rows[6]]).toEqual(["pppppppp", "PPPPPPPP"]);
});

test("?start=freestyle online: the server's start for everyone in the lobby, your move from it played on", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&format=team&start=freestyle");
  await createLobbyFromHome(page);
  await expect.poll(() => page.evaluate(() => !!(window as any).match?.code), { timeout: 30_000 }).toBe(true);
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  const { before } = await firstMove(page);
  expect(isChess960Fen(baseAt(0, before.bases).fen)).toBe(true);
});

test("?start=random (solo): a real opening a few moves in, its moves the board's first, White to move; your move is played on", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&mode=crowd&format=team&start=random");
  await soloFromHome(page);
  const { before } = await firstMove(page);
  // Its opening's moves from the usual start (no base), then move N + 1 for White... or Black's first, if you're Black.
  expect(before.bases).toBeNull();
  const n = 2 * CROWD_START.randomOpeningMoves;
  expect(before.history.length).toBeGreaterThanOrEqual(n);
  let fen = START_FEN;
  for (const m of before.history) fen = applyMove(fen, m);
  expect(fen).toBe(before.fen);
  expect(Number(before.fen.split(" ")[5])).toBeGreaterThanOrEqual(CROWD_START.randomOpeningMoves + 1);
});

test("no vote held (?format=) or an unknown ?start=: the usual starting position, the default", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  for (const url of ["/?debug&pace=quick&mode=crowd&format=team", "/?debug&pace=quick&mode=crowd&format=team&start=chess960"]) {
    await page.goto(url);
    await soloFromHome(page);
    await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
    const b = await board(page);
    expect([baseAt(0, b.bases).fen, b.history.length <= 1]).toEqual([START_FEN, true]);
  }
});
