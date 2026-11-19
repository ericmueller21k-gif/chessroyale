import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { test, submitMove, tapInTown } from "./helpers.ts";

/**
 * The Battle Tower (PR 10's battle; PR 11b's flow, Eric, Nov 19: "you walk into the battle tower, you talk to the clerk, you start a
 * match. After the round ends, it's like a victory or defeat screen ... And then it takes you back. And then you stand there and wait in
 * the room. And then the next, you go up whatever the elevator, you go to the next floor and then you continue on."): Chess Town's
 * skyscraper, its clerk (Start), the elevator, the floor room (its number, its bosses walking out), the match (?win=1: Qxf7 mates), the
 * usual result, back in the room with the elevator open, up to floor 2 and its two bosses, a reload mid-floor rejoining, a loss ending
 * the run; a free leave before your 2nd move, and Continue after a reload; no Last Stand on a floor. `STILLS=<dir>` writes the stills.
 */

const STILLS = process.env.STILLS;
const phase = (page: Page) => page.evaluate(() => (window as any).match?.phase?.kind ?? null);
const fen = (page: Page) => page.evaluate(() => (window as any).match?.phase?.board?.fen ?? null);
const moves = (page: Page) => page.evaluate(() => (window as any).match?.boss?.crowdMoves ?? null);
type Floor = { floor: number; mode: string; bosses: string[]; t: number | null; go: number | null } | null;
const floorNow = (page: Page): Promise<Floor> => page.evaluate(() => (window as any).__towerFloor?.() ?? null);
const room = (page: Page) => page.locator("canvas.town-shop-canvas");

async function still(page: Page, name: string) {
  if (!STILLS) return;
  mkdirSync(STILLS, { recursive: true });
  await page.screenshot({ path: `${STILLS}/${name}-${test.info().project.name}.png` });
}

/** Your turn (the play phase), then a move of yours played: the first the bosses' powers allow (any legal one when none limit it). */
async function playAMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  const at = await page.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board.fen as string, allowed: (m.runner.crowdAllowed() as string[] | null) ?? null };
  });
  const quiet = ["e2e4", "d2d4", "g1f3", "b1c3", "e2e3", "d2d3", "c2c3", "h2h3", "a2a3"];
  const allowed = at.allowed ?? legalMoves(at.fen);
  await submitMove(page, quiet.find((m) => allowed.includes(m)) ?? allowed[0], at.fen);
}

/** Into the tower's lobby from the street (its card's Go in). */
async function intoTower(page: Page, query = "") {
  await page.goto(`/town?debug&pace=quick&sky=day${query}`);
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const card = await tapInTown(page, "home", "tower", page.getByRole("dialog", { name: "Battle Tower", exact: true }));
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room(page)).toHaveAttribute("data-room", "tower");
}

/** A thing in the room tapped (its point as drawn, `__shopAt`) until its card shows. */
async function tapRoom(page: Page, kind: "keeper" | "pass", name: string, part?: "top" | "front") {
  const card = page.getByRole("dialog", { name, exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    // (A door below the room's fixed view (the way down, on a phone) brought into it, as a drag there would.)
    if (kind === "pass" && !(await page.evaluate(([k, p]) => (window as any).__shopAt?.(k, p) ?? null, [kind, part] as const))) {
      await page.evaluate((p) => (window as any).__shopLook?.("pass", p), part);
      await page.waitForTimeout(300);
    }
    const xy = await page.evaluate(([k, p]) => (window as any).__shopAt?.(k, p) ?? null, [kind, part] as const);
    const cv = xy && (await room(page).boundingBox());
    expect(xy && cv, `${kind} on screen`).toBeTruthy();
    await page.mouse.click(cv!.x + xy!.x, cv!.y + xy!.y);
    await expect(card).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  return card;
}

/** The floor room of floor `n`, its bosses out and walking in, then its match. */
async function floorThenMatch(page: Page, n: number, bosses: number) {
  await expect.poll(async () => (await floorNow(page))?.floor ?? null, { timeout: 30_000 }).toBe(n);
  const f = (await floorNow(page))!;
  expect(f.mode).toBe("fight");
  expect(f.bosses).toHaveLength(bosses);
  // (Its number on its walls; its bosses walking out of the elevator: a still mid-walk.)
  await expect.poll(async () => (await floorNow(page))?.t ?? 0, { timeout: 10_000 }).toBeGreaterThan(1200);
  await still(page, `floor-${n}-walk-in`);
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect(page.locator(".tw-strip").first()).toContainText(`Floor ${n} of 99`);
}

test("the clerk's Start, the elevator, floor 1 won, back in the room, up to floor 2, a reload rejoins, a loss ends the run", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await intoTower(page, "&win=1");
  // The clerk: Start (no run), "Start over" greyed under it.
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await expect(clerk.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
  await expect(clerk.getByRole("button", { name: "Start over" })).toBeDisabled();
  await still(page, "clerk-start");
  await clerk.getByRole("button", { name: "Start", exact: true }).click();
  // Into the elevator, the floor room: floor 1, one boss; the match.
  await floorThenMatch(page, 1, 1);
  await submitMove(page, "h5f7");
  // The usual result screen, the floor and the run in its line; one button back.
  const won = page.locator('[data-tower-result="won"]');
  await expect(won).toContainText("Floor 1 cleared!", { timeout: 120_000 });
  const back = won.getByRole("button", { name: "Back to the tower" });
  await expect(back).toBeEnabled({ timeout: 20_000 });
  await still(page, "result-won");
  await back.click();
  // Back in the floor room, standing there, the elevator open: up to floor 2.
  await expect.poll(async () => (await floorNow(page))?.mode ?? null, { timeout: 60_000 }).toBe("won");
  expect((await floorNow(page))!.floor).toBe(1);
  await page.waitForTimeout(800);
  await still(page, "back-elevator-open");
  const lift = await tapRoom(page, "pass", "Elevator", "top");
  await lift.getByRole("button", { name: "Up to floor 2" }).click();
  await floorThenMatch(page, 2, 2);
  await expect(page.locator(".tw-bar .tw-part")).toHaveCount(2);
  // A move, then a reload: the same position, rejoined at once (PR 10's restore; the match's address is /tower).
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 1, { timeout: 90_000 }).toBe(true);
  const before = await fen(page);
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  expect(await fen(page)).toBe(before);
  // A second move: leaving now counts as a loss (the confirm says so), and the run ends.
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 2, { timeout: 90_000 }).toBe(true);
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("counts as a loss");
  await page.getByRole("alertdialog").getByRole("button", { name: "Resign" }).click();
  const out = page.locator('[data-tower-result="out"]');
  await expect(out).toContainText("Your run ended on floor 2.", { timeout: 30_000 });
  await expect(out).toContainText("Best solo: floor 1", { timeout: 20_000 });
  await out.getByRole("button", { name: "Back to the tower" }).click();
  // The run's over: the elevator shut (its Up greyed), down to the lobby, where the clerk offers Start again.
  await expect.poll(async () => (await floorNow(page))?.mode ?? null, { timeout: 60_000 }).toBe("out");
  const shut = await tapRoom(page, "pass", "Elevator", "top");
  await expect(shut.getByRole("button", { name: "Up", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  const down = await tapRoom(page, "pass", "Way down", "front");
  await down.getByRole("button", { name: "Down to the lobby" }).click();
  await expect(room(page)).not.toHaveAttribute("data-part", "top", { timeout: 20_000 });
  const again = await tapRoom(page, "keeper", "Clerk");
  await expect(again.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
});

test("no Last Stand on a floor; a free leave before your 2nd move goes down to the lobby, and the clerk says Continue after a reload", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await page.addInitScript(() => {
    const w = window as any;
    w.__kinds = [];
    setInterval(() => {
      const k = w.match?.phase?.kind;
      if (k && w.__kinds[w.__kinds.length - 1] !== k) w.__kinds.push(k);
    }, 50);
  });
  await intoTower(page, "&laststand=1");
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await clerk.getByRole("button", { name: "Start", exact: true }).click();
  await floorThenMatch(page, 1, 1);
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 1, { timeout: 90_000 }).toBe(true);
  // (Alone, a Last Stand is the one reveal: none came.)
  const kinds: string[] = await page.evaluate(() => (window as any).__kinds);
  expect(kinds).not.toContain("reveal");
  expect(await page.evaluate(() => (window as any).match.boss.lastStand)).toBeNull();
  // One move made: Leave is free (the confirm says so), down to the lobby, the same floor waiting.
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Leave the match" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("free before your 2nd move");
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
  await expect(room(page)).toHaveAttribute("data-room", "tower", { timeout: 60_000 });
  await expect(room(page)).not.toHaveAttribute("data-part", "top");
  // A reload: the clerk says Continue: floor 1, "Start over" under it asks first.
  await page.reload();
  await intoTower(page);
  const desk = await tapRoom(page, "keeper", "Clerk");
  await expect(desk.getByRole("button", { name: "Continue: floor 1" })).toBeEnabled({ timeout: 20_000 });
  await desk.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Start over from floor 1?");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(desk.getByRole("button", { name: "Continue: floor 1" })).toBeVisible();
});
