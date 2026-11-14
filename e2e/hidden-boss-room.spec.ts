import { mkdirSync } from "node:fs";
import { devices, expect, type Page } from "@playwright/test";
import { HIDDEN_ROOM } from "@chessroyale/core";
import { legalMoves } from "@chessroyale/chess";
import { asServerAdmin, asSignedIn, submitMove, test } from "./helpers.ts";

/**
 * The Hidden Boss's room challenge (Eric, Nov 12 and 13; docs/areas/town-square.md, "His room's challenge"): up his walk-up to the top
 * floor, his card's Challenge ("1 of 4" for everyone in the room), leaving asks "Cancel your game request?", an admin's "Fill with 3 bots"
 * (they join the request one by one: 2 of 4, 3 of 4, 4 of 4), the summoning in the room, and the four into his fight (a party battle
 * online), where the admin's 🏆 ("Win this form") makes the team's next move beat his form: the child (Nov 13: his first form; a new
 * match after him), his adult form, then (Nov 13) his phase change and the four boards online, to the result. And a 5th at his door: "The door is locked." Each test in its own town (`?townroom=`). `STILLS=<dir>` writes the stills for the PR.
 */

const STILLS = process.env.STILLS;
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townGlide?: (to: string) => void;
  __shopAt?: (k: string, s?: unknown) => { x: number; y: number } | null;
  __shopLook?: (k: string, to?: string) => boolean;
  __hiddenRoom?: () => { info: { in: boolean; people: number; count: number; yours: boolean; bots: boolean; admin?: boolean } | null; summonT: number | null; frozen: boolean } | null;
};
const hook = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__hiddenRoom?.() ?? null);

async function still(page: Page, name: string) {
  if (!STILLS) return;
  mkdirSync(STILLS, { recursive: true });
  await page.screenshot({ path: `${STILLS}/${name}-${test.info().project.name}.png` });
}

/**
 * What stays put through his fight (Eric, Nov 14: "the board split only replaces the single board"): the board's square, the Moves
 * panel and the chat (a computer's column, a phone's panel), your pawn and your team's, the God King. Each box, or null.
 */
const frameBoxes = (p: Page) =>
  p.evaluate(() => {
    const sels = [".board-row > .board-wrap", ".mv-side", ".under-board", ".bp", ".you-pawn", ".dk-mate-art", ".gk-unit"];
    return Object.fromEntries(
      sels.map((sel) => [sel, [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect()).map((r) => [r.x, r.y, r.width, r.height].map(Math.round))]),
    );
  });

/** Where the room's hook says to tap, on the page; null: not on screen. */
async function shopAt(page: Page, kind: string, s?: unknown) {
  const xy = await page.evaluate(([k, q]) => (window as unknown as Hooks).__shopAt?.(k as string, q) ?? null, [kind, s] as const);
  const cv = xy && (await room(page).boundingBox());
  return xy && cv ? { x: cv.x + xy.x, y: cv.y + xy.y } : null;
}

/** Taps the stairs to `to` until their card shows (it walks you there), and answers the card. */
async function stairsCard(page: Page, to: "landing" | "top" | "front") {
  const card = page.getByRole("dialog", { name: "Stairs", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (!(await shopAt(page, "pass", to))) await page.evaluate((t) => (window as unknown as Hooks).__shopLook?.("pass", t), to);
    const at = await shopAt(page, "pass", to);
    expect(at, `the stairs to ${to} on screen`).not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  return card;
}

/** Up or down the stairs to `to`. */
async function climb(page: Page, to: "landing" | "top", button: "Go up" | "Go down") {
  // (A tap on the stairs while the room still fades in from the last flight is dropped, as a door's is: tapped again until you go.)
  await expect(async () => {
    if ((await room(page).getAttribute("data-part")) === to) return;
    const card = await stairsCard(page, to);
    await card.getByRole("button", { name: button }).click();
    await expect(room(page)).toHaveAttribute("data-part", to, { timeout: 6000 });
  }).toPass({ timeout: 45_000 });
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}

/** The town (your own: `townroom`), into the walk-up's hall, and up to the landing. */
async function toLanding(page: Page, townroom: string) {
  await page.goto(`/town?sky=day&debug&townroom=${townroom}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await page.evaluate(() => (window as unknown as Hooks).__townGlide?.("recluse"));
  const homeAt = async () => {
    const xy = await page.evaluate(() => (window as unknown as Hooks).__townAt?.("home", "recluse") ?? null);
    const cv = xy && (await canvas(page).boundingBox());
    return xy && cv ? { x: cv.x + xy.x, y: cv.y + xy.y } : null;
  };
  await expect.poll(homeAt, { message: "the walk-up comes into view", timeout: 20_000 }).not.toBeNull();
  await page.waitForTimeout(1200);
  const card = page.getByRole("dialog", { name: "The Walk-up", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    const at = await homeAt();
    expect(at).not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await climb(page, "landing", "Go up");
}

/** His card (a tap on his board walks you round to it). */
async function hisCard(page: Page) {
  const his = page.getByRole("dialog", { name: "Hidden Boss", exact: true });
  await expect(async () => {
    if (await his.isVisible()) return;
    const at = await shopAt(page, "square", [4, 4]);
    expect(at, "his board on screen").not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(his).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 30_000 });
  return his;
}

test("his room (Eric, Nov 12 and 13): Challenge is 1 of 4; leaving asks; an admin's 3 bots join (2, 3, 4 of 4); the summoning; the fight, and the online 🏆 wins each form: the child, the man, the four boards", async ({ page }) => {
  test.setTimeout(400_000);
  const townroom = `hb-${test.info().project.name}-${Date.now().toString(36)}`;
  // (Stills at another window size: STILLS_SIZE=1920x1080.)
  const size = STILLS && process.env.STILLS_SIZE?.split("x").map(Number);
  if (size && test.info().project.name === "desktop") await page.setViewportSize({ width: size[0]!, height: size[1]! });
  await page.goto("/");
  await asServerAdmin(page, "ops");
  await toLanding(page, townroom);
  await climb(page, "top", "Go up");
  await expect.poll(async () => (await hook(page))?.info?.in ?? false, { message: "in his room, by the server's count", timeout: 15_000 }).toBe(true);
  // His card: Challenge, Cancel greyed (nothing hidden), and the admin's test tool.
  const his = await hisCard(page);
  await expect(his.getByRole("button")).toHaveText(["Challenge", "Cancel", "Fill with 3 bots"]);
  await expect(his.getByRole("button", { name: "Cancel" })).toBeDisabled();
  // The count is there from the start, in its place (review n2: it never appears from nothing).
  const count = page.locator(".hb-count");
  await expect(count).toHaveText(/Challengers\s*0 of 4/);
  await his.getByRole("button", { name: "Challenge" }).click();
  await expect(count).toHaveText(/1 of 4/, { timeout: 10_000 });
  await expect(his.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(his.getByRole("button", { name: "Cancel" })).toBeEnabled();
  // Leaving asks: the stairs down, "Cancel your game request?"; Stay keeps your place.
  await page.keyboard.press("Escape");
  const down = await stairsCard(page, "landing");
  await down.getByRole("button", { name: "Go down" }).click();
  const ask = page.getByRole("alertdialog", { name: "Cancel your game request?" });
  await expect(ask).toBeVisible();
  await expect(ask.getByRole("button")).toHaveText(["Stay", "Leave and cancel"]);
  await ask.getByRole("button", { name: "Stay" }).click();
  await expect(ask).toBeHidden();
  await expect(room(page)).toHaveAttribute("data-part", "top");
  await expect(count).toHaveText(/1 of 4/);
  // The admin's bots: three stand in the room, and join the request one by one, as players would.
  const card = await hisCard(page);
  const counts: string[] = [];
  await page.exposeFunction("__hbCount", (t: string) => void counts.push(t));
  await page.evaluate(() => {
    const seen = new Set<string>();
    const tick = () => {
      const t = document.querySelector(".hb-count")?.textContent ?? "";
      if (t && !seen.has(t)) {
        seen.add(t);
        (window as unknown as { __hbCount: (t: string) => void }).__hbCount(t);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  await card.getByRole("button", { name: "Fill with 3 bots" }).click();
  await expect.poll(async () => (await hook(page))?.info?.people ?? 0, { timeout: 10_000 }).toBe(4);
  await expect.poll(() => counts.join(" | "), { timeout: 15_000 }).toMatch(/2 of 4/);
  await expect(count).toHaveText(/2 of 4/);
  await still(page, "room-2-of-4");
  // At four: the summoning (frozen, the scene's clock running), then his fight.
  await expect.poll(async () => (await hook(page))?.frozen ?? false, { message: "the summoning starts", timeout: 20_000 }).toBe(true);
  expect(counts.join(" | ")).toMatch(/1 of 4.*2 of 4.*3 of 4/);
  await page.waitForTimeout(2200);
  await still(page, "summoning");
  await expect.poll(async () => (await hook(page))?.summonT ?? 0, { timeout: 5000 }).toBeGreaterThan(1500);
  await expect(page).toHaveURL(/\/lobby\/[A-Z2-9]{5}/, { timeout: 30_000 });
  // The fight: against him, a party of four (you and the three bots), the team's turn.
  const phase = () => page.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
  await expect.poll(phase, { message: "the team's first turn", timeout: 120_000 }).toBe("play");
  const fight = await page.evaluate(() => {
    const m = (window as any).match;
    return { boss: m.boss?.id, seats: Object.keys(m.party?.seats ?? {}).length, hidden: m.hiddenRoom, form: m.boss?.form ?? "adult" };
  });
  // (His first form, Nov 13: the child, his level known.)
  expect(fight).toEqual({ boss: HIDDEN_ROOM.boss, seats: 4, hidden: true, form: "child" });
  expect(typeof (await page.evaluate(() => (window as any).match.boss.level))).toBe("number");
  await expect(page.locator(".boss-char").first()).toHaveClass(/ch-recluse-growing/);
  await page.waitForTimeout(1500);
  await still(page, "fight");
  // The online 🏆 (admins only; the server checks): the team's next move beats his form, as a mate's end.
  const trophy = page.getByRole("button", { name: "Win this form (testing)" });
  const yourTurnMove = async () => {
    await expect.poll(phase, { message: "the team's turn", timeout: 120_000 }).toBe("play");
    const turn = await page.evaluate(() => {
      const m = (window as any).match;
      return { fen: m.phase.board.fen as string, allowed: (m.phase.allowed ?? null) as string[] | null };
    });
    await submitMove(page, turn.allowed?.[0] ?? legalMoves(turn.fen)[0], turn.fen);
  };
  // The God King's words in the party layout (Nov 14's visual check, #5): every frame of the child's match, never into the chat or
  // onto a teammate's pawn.
  await page.evaluate(() => {
    const w = window as any;
    w.__gkOver = [] as string[];
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const tick = () => {
      const gk = document.querySelector(".boss-dock.dk-party .gk-bubble");
      if (gk && Number(getComputedStyle(gk).opacity) > 0.5) {
        const r = gk.getBoundingClientRect();
        for (const e of document.querySelectorAll(".under-board, .dk-mate-art")) if (hit(r, e.getBoundingClientRect())) w.__gkOver.push(`${e.className}: ${gk.textContent}`);
      }
      if (!w.__gkDone) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await expect(trophy).toBeVisible();
  await trophy.click();
  await expect(page.getByRole("button", { name: "Your next move wins this form (testing)" })).toBeDisabled();
  await yourTurnMove();
  // The child beaten: his fall (he grows up into the man), then a new match against his adult form, from the start, "LVL ???".
  await expect.poll(() => page.evaluate(() => (window as any).match.boss?.result ?? null), { message: "the child beaten", timeout: 90_000 }).toBe("crowd");
  expect(await page.evaluate(() => (window as any).match.boss.form)).toBe("child");
  await expect.poll(() => page.evaluate(() => (window as any).match.boss?.form ?? "adult"), { message: "the new match: his adult form", timeout: 30_000 }).toBe("adult");
  const adult = await page.evaluate(() => {
    const b = (window as any).match.boss;
    return { result: b.result ?? null, level: b.level, ult: b.powers?.ultimate ?? null, moves: b.board.history.length };
  });
  expect(adult).toEqual({ result: null, level: null, ult: "bullet", moves: 0 });
  await expect(page.locator(".boss-char").first()).not.toHaveClass(/ch-recluse-growing/);
  // His adult form's own 🏆.
  await expect(trophy).toBeEnabled({ timeout: 60_000 });
  await expect.poll(phase, { message: "the team's turn against the man", timeout: 120_000 }).toBe("play");
  await page.waitForTimeout(1500);
  await still(page, "man");
  expect(await page.evaluate(() => ((window as any).__gkDone = true) && (window as any).__gkOver), "the God King's words over the chat or a teammate").toEqual([]);
  const manFrame = await frameBoxes(page);
  await trophy.click();
  await expect(page.getByRole("button", { name: "Your next move wins this form (testing)" })).toBeDisabled();
  await yourTurnMove();
  // His adult form beaten (Nov 13: "it plays through till the end"): his fall, then his phase change for everyone, the four boards
  // (the server runs them; with no engine server here, this device's engine plays the bots and the server's quick move him), and the 🏆 again.
  if (STILLS) {
    await expect.poll(() => page.evaluate(() => document.body.classList.contains("cs-on")), { message: "his cutscene", timeout: 60_000 }).toBe(true);
    await page.waitForTimeout(4000);
    await still(page, "cutscene");
  }
  await expect.poll(phase, { message: "his adult form beaten: his phase change", timeout: 90_000 }).toBe("phaseChange");
  expect(await page.evaluate(() => (window as any).match.boss?.result)).toBe("crowd");
  await page.waitForTimeout(20_000);
  await still(page, "phase-change");
  if (STILLS) {
    await expect.poll(() => page.evaluate(() => document.querySelector(".rc-stage")?.getAttribute("data-step")), { timeout: 30_000 }).toBe("shuffle");
    await page.waitForTimeout(1500);
    await still(page, "phase-change-split");
  }
  await expect.poll(phase, { message: "the four boards", timeout: 60_000 }).toBe("simul");
  const simulNow = () => page.evaluate(() => (window as any).match?.simul ?? null);
  await expect.poll(async () => (await simulNow())?.playing ?? false, { message: "the clocks start", timeout: 20_000 }).toBe(true);
  const four = await simulNow();
  expect({ boards: four.boards.length, mine: four.boards[0].you, others: four.boards.slice(1).every((b: { you: boolean }) => !b.you) }).toEqual({ boards: 4, mine: true, others: true });
  // (The bots' boards are played: their first moves come from this device's engine, asked by the server.)
  await expect.poll(async () => ((await simulNow())?.boards ?? []).slice(1).filter((b: { history: string[] }) => b.history.length > 0).length, { message: "the bots move", timeout: 30_000 }).toBeGreaterThan(0);
  await still(page, "four-boards");
  // Everything around the board where it was against the man, within 2 px: the square, the Moves panel and chat, the pawns, the
  // God King (Eric, Nov 14). And the four boards inside the square, square, the gaps between them and to its edges equal.
  const fourFrame = await frameBoxes(page);
  expect(manFrame[".mv-side"]!.length + manFrame[".bp"]!.length, "the Moves panel").toBe(1);
  expect(manFrame[".you-pawn"], "your pawn").toHaveLength(1);
  expect(manFrame[".dk-mate-art"], "your team's pawns").toHaveLength(3);
  for (const [sel, boxes] of Object.entries(manFrame)) {
    expect(fourFrame[sel], `${sel}: as many`).toHaveLength(boxes.length);
    boxes.forEach((b, i) => b.forEach((n, k) => expect(Math.abs(fourFrame[sel]![i]![k]! - n), `${sel} ${i} [${k}]: ${b} -> ${fourFrame[sel]![i]}`).toBeLessThanOrEqual(2)));
  }
  if (test.info().project.name === "desktop") {
    const gaps = await page.evaluate(() => {
      const sq = document.querySelector(".rc-simul .rc-stage")!.getBoundingClientRect();
      const [tl, tr, bl] = [".rc-q0", ".rc-q1", ".rc-q2"].map((q) => document.querySelector(`.rc-simul ${q} .hb-board`)!.getBoundingClientRect());
      return { square: [tl!.width - tl!.height], gaps: [tl!.left - sq.left, tr!.left - tl!.right, sq.right - tr!.right, tl!.top - sq.top, bl!.top - tl!.bottom, sq.bottom - bl!.bottom] };
    });
    expect(Math.abs(gaps.square[0]!), "each board square").toBeLessThanOrEqual(1);
    for (const g of gaps.gaps) expect(Math.abs(g - gaps.gaps[0]!), `the gaps ${gaps.gaps.map(Math.round)}`).toBeLessThanOrEqual(2);
  }
  // The scoreboard in phase 2 (Eric's playtest, Nov 14: every row read "out", a phone's Players tab empty): the four on his boards
  // are in, never "out": a computer's table beside the board; a phone's Players tab (the rows its box fits, as in phase 1), and
  // the four in full when it's tapped open. (Each board's result shows on its row as it ends: below.)
  const desk = test.info().project.name === "desktop";
  const inFour = async (table: ReturnType<Page["locator"]>, rows: number) => {
    await expect(table.locator(".tower-row")).toHaveCount(rows);
    await expect(table.locator(".tower-row.out")).toHaveCount(0);
    await expect(table.locator(".t-pts", { hasText: /^out$/ })).toHaveCount(0);
  };
  const panel = page.locator(desk ? ".tower-side" : ".bp-tower");
  if (desk) await inFour(panel, 4);
  else {
    await page.locator(".bp-tab", { hasText: "Players" }).click();
    await expect(panel.locator(".tower-row")).not.toHaveCount(0);
    await inFour(panel, await panel.locator(".tower-row").count());
    await panel.click();
    await inFour(page.getByRole("dialog", { name: "Leaderboard" }), 4);
    await page.getByRole("dialog", { name: "Leaderboard" }).getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog", { name: "Leaderboard" })).toBeHidden();
  }
  // Your move first, with real taps on your board (White moves first on every board). Then the 🏆 in the four boards: the team's next
  // move (a bot's or yours, any board) wins every board still on. (Your move before it, Nov 14: pressed first, a bot's move often won
  // all four before your tap landed, and your board had no move for the Moves panel to list: main's red after #712.)
  const mine = (await simulNow()).boards[0] as { fen: string; toMove: string | null; history: string[] };
  expect(mine.toMove).toBe("crowd");
  const move = legalMoves(mine.fen).find((m) => m.startsWith("b") || m.startsWith("g")) ?? legalMoves(mine.fen)[0]!;
  const board = page.locator(".rc-simul .rc-q2 .hb-board, .rc-simul .rc-big .hb-board").first();
  const box = (await board.boundingBox())!;
  for (const sq of [move.slice(0, 2), move.slice(2, 4)]) {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    await page.mouse.click(box.x + (f + 0.5) * (box.width / 8), box.y + (7 - r + 0.5) * (box.height / 8));
  }
  await expect.poll(async () => (await simulNow()).boards[0].history[0] ?? null, { message: "your move on your board" }).toBe(move);
  // The Moves panel lists your own board's game in phase 2 (Nov 14's visual check, #6): a computer's beside the board.
  const yourRow = page.locator(".mv-side .mv-list .mv-row").first();
  if (desk) await expect(yourRow).toHaveAttribute("aria-label", /^1\. You: /);
  await expect(trophy).toBeEnabled({ timeout: 10_000 });
  await trophy.click();
  await expect(page.getByRole("button", { name: "Your next move wins this form (testing)" })).toBeDisabled();
  await expect.poll(async () => (await simulNow())?.decided ?? false, { message: "every board won", timeout: 30_000 }).toBe(true);
  expect((await simulNow()).won).toBe(4);
  // (And still, once every board is won.)
  if (desk) await expect(yourRow).toHaveAttribute("aria-label", /^1\. You: /);
  // Each row says its board was won (a computer's table, the word; a phone's panel, its mark), until the results.
  const shownRows = await panel.locator(".tower-row").count();
  await expect(panel.locator(".t-board")).toHaveText(Array(shownRows).fill(desk ? "Won" : "✓"));
  await still(page, "boards-won");
  await expect.poll(phase, { message: "the results", timeout: 30_000 }).toBe("results");
  expect(await page.evaluate(() => (window as any).match.phase.simul)).toEqual({ won: 4, of: 4 });
  await expect(page.getByText(/on all 4 boards!/)).toBeVisible();
  // The result (QA #12, Nov 14): all four played a board, so the headline is the boards' verdict, not "4th of 4"; your place under
  // it; the review is your board from its end (not phase 1's first form, "Move 1 of 11"), stepped back with ◀.
  await expect(page.locator(".results h1")).toHaveText("Victory!");
  await expect(page.locator(".results-top > p.muted:not(.small)")).toHaveText(/^(You were the best in the crowd: 1st of 4\.|[234](nd|rd|th) of 4 in the crowd\. .+ was the best\.)$/);
  const plies: number = await page.evaluate(() => (window as any).match.phase.simulBoard.history.length);
  const review = page.locator(".board-review");
  await expect(review.locator("h2")).toHaveText("Your board, move by move");
  const stepText = review.locator(".bm-step-text");
  await expect(stepText).toHaveText(plies ? new RegExp(`^Move ${plies} of ${plies} · `) : "The start · Chess960");
  await expect(review.getByRole("button", { name: "Next move" })).toBeDisabled();
  await expect(review.locator(".bm-text")).toHaveText(plies ? /^(You|He) played \S+\. Your board is won\.$/ : "No moves were played on your board. Your board is won.");
  if (plies) {
    await review.getByRole("button", { name: "Previous move" }).click();
    await expect(stepText).toHaveText(plies > 1 ? new RegExp(`^Move ${plies - 1} of ${plies} · `) : "The start · Chess960");
  }
  await still(page, "results");
});

test("a 5th at his door: \"The door is locked.\", and you stay on the landing; a player can't fill the room with bots", async ({ page: admin, browser }) => {
  test.setTimeout(240_000);
  const townroom = `hb5-${test.info().project.name}-${Date.now().toString(36)}`;
  const phone = test.info().project.name === "phone";
  const b = await browser.newContext(phone ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  try {
    await admin.goto("/");
    await asServerAdmin(admin, "ops");
    await toLanding(admin, townroom);
    await climb(admin, "top", "Go up");
    const his = await hisCard(admin);
    await his.getByRole("button", { name: "Fill with 3 bots" }).click();
    await expect.poll(async () => (await hook(admin))?.info?.people ?? 0, { timeout: 10_000 }).toBe(4);
    // A player: up to the landing, the stairs up: locked.
    const player = await b.newPage();
    await player.goto("/");
    await asSignedIn(player, "hb5");
    await toLanding(player, townroom);
    const note = player.getByRole("alertdialog", { name: "The door is locked." });
    // (A tap while the landing still fades in is dropped, as a door's is: tapped again until the answer shows.)
    await expect(async () => {
      if (await note.isVisible()) return;
      const up = await stairsCard(player, "top");
      await up.getByRole("button", { name: "Go up" }).click();
      await expect(note).toBeVisible({ timeout: 6000 });
    }).toPass({ timeout: 45_000 });
    await expect(room(player)).toHaveAttribute("data-part", "landing");
    await expect(player.getByRole("dialog", { name: "Stairs", exact: true })).toBeHidden();
    await player.waitForTimeout(700);
    await still(player, "door-locked");
    await note.getByRole("button", { name: "OK" }).click();
    await expect(note).toBeHidden();
    await expect(room(player)).toHaveAttribute("data-part", "landing");
    // (The server refuses a player's "Fill with 3 bots", whatever the app shows.)
    const res = await player.request.post("/api/town/hidden", { data: { action: "fill", room: townroom } });
    expect(await res.json()).toMatchObject({ message: "Admins only.", bots: true, people: 4 });
    // Someone leaves (the admin, and the bots with them): the door opens.
    await admin.close();
    await expect(async () => {
      const r = await player.request.post("/api/town/hidden", { data: { action: "look", room: townroom } });
      expect(((await r.json()) as { people: number }).people).toBe(0);
    }).toPass({ timeout: (HIDDEN_ROOM.silentSec + 15) * 1000 });
    await climb(player, "top", "Go up");
  } finally {
    await b.close();
  }
});
