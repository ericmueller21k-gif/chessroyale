import { expect, type Page } from "@playwright/test";
import { CROWD_START } from "@chessroyale/core";
import { baseAt, pieceAt } from "@chessroyale/chess";
import { soloFromHome, test } from "./helpers.ts";

/**
 * The opening replays with Animations on and off, the same (Eric, Oct 25: "You should always be showing the players the
 * opening sequence of moves"; docs/decisions/2026-10-25-opening-with-animations-off.md). A 50 v 50 starts with a Random
 * opening (the test switch: format=team skips the votes, start=random is the vote's Random). The board shows the start,
 * then each dealt ply in turn, gliding as it does on every move, before the game's first move. Which screen you start
 * on is the colour deal's (you may watch White's first pick, or play it); the replay runs on either.
 */

type Frame = { t: number; kind: string | null; hist: number | null; moving: number; last: string | null; placement: string };

/**
 * Samples the board each frame, from the page's load, and keeps a frame whenever what the board shows changes: its
 * pieces (their squares, colours and kinds, as drawn, `moving` the ones still gliding) and the last move's two squares
 * (`last`, sorted, e.g. "e2e4"). Only the drawn board is read, so it's the player's eye.
 */
const SAMPLER = `(() => {
  window.__log = [];
  let prev = "";
  const kinds = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
  const squareOf = (r, box, black) => {
    let col = Math.floor((r.x + r.width / 2 - box.x) / (box.width / 8));
    let row = Math.floor((r.y + r.height / 2 - box.y) / (box.height / 8));
    if (black) { col = 7 - col; row = 7 - row; }
    return "abcdefgh"[col] + (8 - row);
  };
  const tick = () => {
    try {
      const wrap = document.querySelector(".board-area .hb");
      const squares = document.querySelector(".board-area .hb-board");
      let placement = "none";
      let moving = 0;
      let last = null;
      if (wrap && squares) {
        const black = wrap.classList.contains("orientation-black");
        const box = squares.getBoundingClientRect();
        const out = [];
        for (const p of squares.querySelectorAll("piece")) {
          if (p.classList.contains("fading")) continue;
          if (p.getAnimations && p.getAnimations().length) moving++;
          const kind = Object.keys(kinds).find((k) => p.classList.contains(k));
          out.push(squareOf(p.getBoundingClientRect(), box, black) + (p.classList.contains("white") ? "w" : "b") + (kind ? kinds[kind] : "?"));
        }
        placement = out.sort().join(",");
        const hl = [...squares.querySelectorAll("square.last-move")].map((s) => squareOf(s.getBoundingClientRect(), box, black));
        if (hl.length) last = hl.sort().join("");
      }
      const key = placement + "|" + moving + "|" + last;
      if (key !== prev && window.__log.length < 5000) {
        prev = key;
        const ph = window.match?.phase;
        window.__log.push({ t: Math.round(performance.now()), kind: ph?.kind ?? null, hist: ph?.board?.history?.length ?? null, moving, last, placement });
      }
    } catch (e) {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** The board the game is on: its position, its moves and where it started. */
const board = (page: Page) =>
  page.evaluate(() => {
    const b = (window as any).match.phase.board;
    return { fen: b.fen as string, history: b.history as string[], bases: (b.bases ?? null) as { ply: number; fen: string }[] | null };
  });

/** A move as the sampler names its squares: the two squares, sorted ("e2e4" for e2 to e4 or e4 to e2). */
const lastKey = (move: string) => [move.slice(0, 2), move.slice(2, 4)].sort().join("");

/** A position as the sampler reads a drawn board: each piece's square, colour and kind, sorted. */
function placementKey(fen: string): string {
  const out: string[] = [];
  for (const f of "abcdefgh") for (let r = 1; r <= 8; r++) {
    const p = pieceAt(fen, `${f}${r}`);
    if (p) out.push(`${f}${r}${p.color}${p.type}`);
  }
  return out.sort().join(",");
}

async function openingPlays(page: Page, animations: boolean) {
  await page.addInitScript(SAMPLER);
  await page.goto(`/?debug&mode=crowd&format=team&start=random${animations ? "" : "&anim=0"}`);
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|watching)$/);
  const b = await board(page);
  const plies = 2 * CROWD_START.randomOpeningMoves;
  expect(b.history).toHaveLength(plies);
  // The opening has played out when its last ply is the one on screen (the first move of the game is not played yet).
  const finalKey = lastKey(b.history[plies - 1]!);
  await expect.poll(() => page.evaluate(() => (window as any).__log.at(-1)?.last ?? null), { timeout: 30_000 }).toBe(finalKey);
  await page.waitForTimeout(600);
  const log: Frame[] = await page.evaluate(() => (window as any).__log);

  // What the board showed while the opening was the board's (before any move of the game), from its first frame.
  const opening = log.filter((f) => (f.kind === "play" || f.kind === "watching") && f.hist === plies && f.placement !== "none");
  expect(opening.length).toBeGreaterThan(0);
  const start = placementKey(baseAt(0, b.bases).fen);
  expect(opening[0]!.placement, "the board shows the start first").toBe(start);
  expect(opening[0]!.last).toBeNull();

  // Each dealt ply in turn, once each, in order.
  const plays: string[] = [];
  for (const f of opening) if (f.last && f.last !== plays.at(-1)) plays.push(f.last);
  expect(plays).toEqual(b.history.map(lastKey));

  // Gliding, as on every move: some pieces are still sliding during the replay, with Animations on and off alike.
  expect(opening.some((f) => f.moving > 0), "the pieces glide").toBe(true);

  // The board settles on the position after the opening, and the replay is quick (a few seconds at most).
  const settled = opening.filter((f) => f.moving === 0).at(-1)!;
  expect(settled.placement).toBe(placementKey(b.fen));
  const doneAt = opening.find((f) => f.last === finalKey)!.t;
  expect(doneAt - opening[0]!.t, "the opening plays out quickly").toBeLessThan(4000);
  test.info().annotations.push({ type: "first screen", description: opening[0]!.kind ?? "none" }, { type: "replay ms", description: String(doneAt - opening[0]!.t) });
}

test("a Random opening, Animations on: the board shows the start, then each of the four moves a side in, gliding, before the game's first move", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openingPlays(page, true);
});

test("a Random opening, Animations off: the same as with Animations on (the start, each dealt ply in turn, gliding), before the game's first move", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openingPlays(page, false);
});

test("the vote screen's gear list has Animations and Motion trail, as a crowd match's does", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/?debug&mode=crowd&augments=1");
  await soloFromHome(page);
  await expect(page.locator(".vote-screen")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Match options" }).click();
  const list = page.getByRole("dialog", { name: "Match options" });
  await expect(list.getByRole("switch", { name: /^Animations/ })).toBeVisible();
  await expect(list.getByRole("switch", { name: /^Motion trail/ })).toBeVisible();
  await page.keyboard.press("Escape");
});
