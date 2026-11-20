import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { test, asAdmin, submitMove, tapInTown, localSql } from "./helpers.ts";

/**
 * The Battle Tower (PR 10's battle; PR 11b's flow, Eric, Nov 19: "you walk into the battle tower, you talk to the clerk, you start a
 * match. After the round ends, it's like a victory or defeat screen ... And then it takes you back. And then you stand there and wait in
 * the room. And then the next, you go up whatever the elevator, you go to the next floor and then you continue on."): Chess Town's
 * skyscraper, its clerk (Start), the elevator, the floor room (its number, its bosses walking out), the match (?win=1: Qxf7 mates), the
 * usual result, back in the room with the elevator open, up to floor 2 and its two bosses, a reload mid-floor rejoining; a loss costing a
 * life and the climb going on (Nov 20: a heart greyed in the room and the strip, the clerk's card listing the floors lost), the third loss
 * ending the run with its floors lost listed;
 * a free leave before your 2nd move, and Continue after a reload; no Last Stand on a floor. `STILLS=<dir>` writes the stills.
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

/** Your 2nd move on the floor, then Resign (a loss as the tower counts it, the confirm saying `note`). */
async function loseFloor(page: Page, note: string) {
  for (const n of [1, 2]) {
    await playAMove(page);
    await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === n, { timeout: 90_000 }).toBe(true);
  }
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(note);
  await page.getByRole("alertdialog").getByRole("button", { name: "Resign" }).click();
}

/** The run's lives as the floor room's corner and the clerk's card show them (Nov 20): `left` hearts, the rest greyed. */
async function heartsAre(at: ReturnType<Page["locator"]>, left: number) {
  await expect(at).toHaveAttribute("data-lives", String(left), { timeout: 20_000 });
  await expect(at.locator(".tw-heart")).toHaveCount(2);
  await expect(at.locator(".tw-heart.spent")).toHaveCount(2 - left);
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
  await expect(page.locator(".tw-strip").first()).toContainText(`Floor ${n}`);
}

test("the clerk's Start, the elevator, floor 1 won, back in the room, up to floor 2, a reload rejoins; a loss costs a life and the climb goes on, the third ends the run", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  await intoTower(page, "&win=1");
  // The clerk: Start (no run), "Start over" greyed under it.
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await expect(clerk.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
  await expect(clerk.getByRole("button", { name: "Start over" })).toBeDisabled();
  // (The climb's lives on the card, Nov 20: both, and the clerk's line.)
  await heartsAre(clerk.locator(".tw-desk-lives .tw-hearts"), 2);
  await expect(clerk).toContainText("Two lives: the third loss ends it.");
  // (Eric, Nov 20: "the whole box itself should be centered", and every label and line in it: the card in the middle of the room within
  // 2 px, its labels' text centered, and what each line shows (the lives row's hearts and words, the open parties' one line) in its
  // middle within 2 px. docs/decisions/2026-11-20-ui-centered.md.)
  await expect(clerk.locator(".tw-open-none")).not.toHaveText(/Reading/, { timeout: 20_000 });
  const mid = await page.evaluate(() => {
    const card = document.querySelector('[role="dialog"][aria-label="Clerk"]') as HTMLElement;
    const box = (e: Element | Range) => e.getBoundingClientRect();
    const cx = (r: DOMRect) => r.left + r.width / 2;
    const cy = (r: DOMRect) => r.top + r.height / 2;
    const words = (e: Element) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      return box(r);
    };
    const room = box(document.querySelector(".town-shop")!);
    const c = box(card);
    const lives = card.querySelector(".tw-desk-lives")!;
    const kids = [...lives.children].map(box);
    const none = card.querySelector(".tw-open-none")!;
    // (Where it reaches over the walking keys' column (a phone), in the middle of the room above them (8 px from its top at the least),
    // the keys staying in view: ShopRoom.tsx `cardFloor`.)
    const keys = box(document.querySelector(".town-box > .town-controls")!);
    const floor = keys.left < c.right + 8 ? keys.top - 8 : room.bottom;
    return {
      card: [cx(c) - cx(room), c.top - Math.max(room.top + 8, (room.top + floor - c.height) / 2)],
      clear: keys.left < c.right ? keys.top - c.bottom : 99,
      align: [".tw-open-head", "h2", ".tw-plan", ".tw-open-none"].map((s) => [s, getComputedStyle(card.querySelector(s)!).textAlign]),
      lives: (kids[0]!.left + kids.at(-1)!.right) / 2 - cx(c),
      none: [cx(words(none)) - cx(box(none)), cy(words(none)) - cy(box(none))],
      plan: cy(words(card.querySelector(".tw-plan")!)) - cy(box(card.querySelector(".tw-plan")!)),
    };
  });
  for (const d of mid.card) expect(Math.abs(d), "the card in the middle of the room").toBeLessThanOrEqual(2);
  expect(mid.clear, "the walking keys clear of the card").toBeGreaterThanOrEqual(0);
  for (const [s, a] of mid.align) expect(a, s!).toBe("center");
  expect(Math.abs(mid.lives), "the lives row centered").toBeLessThanOrEqual(2);
  for (const d of mid.none) expect(Math.abs(d), "the open parties' line in its box's middle").toBeLessThanOrEqual(2);
  expect(Math.abs(mid.plan), "the plan line's words in its three lines' middle").toBeLessThanOrEqual(2);
  await still(page, "clerk-start");
  await clerk.getByRole("button", { name: "Start", exact: true }).click();
  // Into the elevator, the floor room: floor 1, one boss; the match.
  await floorThenMatch(page, 1, 1);
  await heartsAre(page.locator(".tw-strip .tw-hearts").first(), 2);
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
  // A second move: leaving now counts as a loss and costs a life (the confirm says so). The floor counts, the climb goes on (Nov 20).
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 2, { timeout: 90_000 }).toBe(true);
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("counts as a loss: it costs a life (1 life left after).");
  await page.getByRole("alertdialog").getByRole("button", { name: "Resign" }).click();
  const lost = page.locator('[data-tower-result="lost"]');
  await expect(lost).toContainText("You lost floor 2. It still counts: 1 life left.", { timeout: 30_000 });
  await expect(lost).toContainText("Next: floor 3", { timeout: 20_000 });
  await expect(lost.getByRole("button", { name: "Back to the tower" })).toBeEnabled({ timeout: 20_000 });
  await lost.scrollIntoViewIfNeeded();
  await still(page, "result-lost");
  await lost.getByRole("button", { name: "Back to the tower" }).click();
  // Back in the floor room on your mark, a heart greyed, the elevator open: up to floor 3, its strip's heart greyed too.
  await expect.poll(async () => (await floorNow(page))?.mode ?? null, { timeout: 60_000 }).toBe("won");
  await heartsAre(page.locator(".tw-room-lives .tw-hearts"), 1);
  await page.waitForTimeout(800);
  await still(page, "room-life-spent");
  const on = await tapRoom(page, "pass", "Elevator", "top");
  await on.getByRole("button", { name: "Up to floor 3" }).click();
  await floorThenMatch(page, 3, 2);
  await heartsAre(page.locator(".tw-strip .tw-hearts").first(), 1);
  await still(page, "strip-life-spent");
  // Floor 3 lost too: no life left, still climbing; floor 4's loss (the third) ends the run, its floors lost listed.
  await loseFloor(page, "counts as a loss: it costs a life (no lives left after).");
  await expect(page.locator('[data-tower-result="lost"]')).toContainText("You lost floor 3. It still counts: no lives left.", { timeout: 30_000 });
  await page.locator('[data-tower-result="lost"]').getByRole("button", { name: "Back to the tower" }).click();
  await expect.poll(async () => (await floorNow(page))?.mode ?? null, { timeout: 60_000 }).toBe("won");
  await heartsAre(page.locator(".tw-room-lives .tw-hearts"), 0);
  // Down to the lobby: the clerk's card shows the climb's lives and its floors lost (the recap); Continue goes on to floor 4.
  const way = await tapRoom(page, "pass", "Way down", "front");
  await way.getByRole("button", { name: "Down to the lobby" }).click();
  await expect(room(page)).not.toHaveAttribute("data-part", "top", { timeout: 20_000 });
  const desk = await tapRoom(page, "keeper", "Clerk");
  await heartsAre(desk.locator(".tw-desk-lives .tw-hearts"), 0);
  await expect(desk.locator(".tw-desk-lives")).toContainText("Lost floors 2 and 3");
  await still(page, "clerk-recap");
  await desk.getByRole("button", { name: "Continue: floor 4" }).click();
  await floorThenMatch(page, 4, 3);
  await loseFloor(page, "Your run ends here: leaving now counts as a loss.");
  const out = page.locator('[data-tower-result="out"]');
  await expect(out).toContainText("Your run ended on floor 4.", { timeout: 30_000 });
  await expect(out).toContainText("Lost floors 2, 3 and 4. Best solo: floor 1", { timeout: 20_000 });
  await expect(out.getByRole("button", { name: "Back to the tower" })).toBeEnabled({ timeout: 20_000 });
  await out.scrollIntoViewIfNeeded();
  await still(page, "result-out-recap");
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

test("an admin's 🏆 \"Win this match\" (Eric, Nov 20): greyed once pressed, the next move wins floor 1, then up to floor 2", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await asAdmin(page);
  await intoTower(page);
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await clerk.getByRole("button", { name: /^(Start|Continue)/ }).first().click();
  await floorThenMatch(page, 1, 1);
  const win = page.getByRole("button", { name: "Win this match (testing)" });
  await expect(win).toBeEnabled();
  // (Beside the ⚡: a phone's by the God King, a computer's in the title line.)
  await expect(page.locator(".ult-test")).toBeVisible();
  // (The still once the God King's opening line has gone: on a phone it stands over the icons for a moment.)
  if (STILLS) await expect(page.locator(".gk-bubble:visible")).toHaveCount(0, { timeout: 30_000 });
  await still(page, "win-match");
  await win.click();
  await expect(page.getByRole("button", { name: "Your next move wins this match (testing)" })).toBeDisabled();
  await playAMove(page);
  const won = page.locator('[data-tower-result="won"]');
  await expect(won).toContainText("Floor 1 cleared!", { timeout: 120_000 });
  expect(await moves(page)).toBe(1);
  await won.getByRole("button", { name: "Back to the tower" }).click();
  await expect.poll(async () => (await floorNow(page))?.mode ?? null, { timeout: 60_000 }).toBe("won");
  const lift = await tapRoom(page, "pass", "Elevator", "top");
  await lift.getByRole("button", { name: "Up to floor 2" }).click();
  await floorThenMatch(page, 2, 2);
  // (A new floor: the 🏆 ready again.)
  await expect(page.getByRole("button", { name: "Win this match (testing)" })).toBeEnabled();
});

test("the elevator tapped from across the lobby (Eric, Nov 20): its card at once, where you stand; Go up runs you to it and up", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await intoTower(page);
  // (A run to play: the clerk's Start makes one, as the server does; here asked straight, so the elevator's own Go up takes you.)
  const made = await page.evaluate(async () => (await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } })).status);
  expect(made).toBe(200);
  // You stand just inside the way in, at the far end of the room from the elevator in the back wall.
  await expect(room(page)).toHaveAttribute("data-you", /,/);
  const from = (await room(page).getAttribute("data-you"))!;
  expect(Number(from.split(",")[1])).toBeGreaterThanOrEqual(6);
  const lift = page.getByRole("dialog", { name: "Elevator", exact: true });
  await expect(async () => {
    const xy = await page.evaluate(() => (window as any).__shopAt?.("pic", "top") ?? null);
    const cv = await room(page).boundingBox();
    expect(xy && cv, "the elevator's picture on screen").toBeTruthy();
    await page.mouse.click(cv!.x + xy!.x, cv!.y + xy!.y);
    await expect(lift).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  // The card opened from there: you haven't moved.
  await page.waitForTimeout(400);
  await expect(lift).toBeVisible();
  await expect(room(page)).toHaveAttribute("data-you", from);
  if (STILLS) await page.waitForTimeout(3500); // (the area banner gone)
  await still(page, "elevator-card-from-afar");
  // (Every square you stand on from here, as the room sets it: the last one is up only a moment before the fade.)
  await page.evaluate(() => {
    const cv = document.querySelector("canvas.town-shop-canvas")!;
    const w = window as any;
    w.__walked = [cv.getAttribute("data-you")];
    new MutationObserver(() => w.__walked.push(cv.getAttribute("data-you"))).observe(cv, { attributes: true, attributeFilter: ["data-you"] });
  });
  await lift.getByRole("button", { name: "Go up" }).click();
  // The card closes, you run to the elevator (just inside it, row 1), and up: the floor room, floor 1.
  await expect(lift).toBeHidden();
  await expect.poll(async () => (await floorNow(page))?.floor ?? null, { timeout: 30_000 }).toBe(1);
  await expect(room(page)).toHaveAttribute("data-part", "top");
  const walked: string[] = await page.evaluate(() => (window as any).__walked);
  expect(walked.length, `walked ${walked.join(" ")}`).toBeGreaterThan(3);
  expect(walked[walked.length - 1], `walked ${walked.join(" ")}`).toMatch(/^[45],1$/);
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

test("a shared floor (audit 2, finding 1): every boss drawn from his own part: Sawyer's cut on Ginger's turn, its banner and words Sawyer's, the move list naming each boss", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  // (Every power banner as it's put on the page: who it names; and every boss's words: by whose part or figure they show.)
  await page.addInitScript(() => {
    const w = window as any;
    w.__banners = [];
    w.__words = [];
    new MutationObserver(() => {
      for (const b of document.querySelectorAll(".power-cut[aria-label]")) {
        const l = b.getAttribute("aria-label")!;
        if (!w.__banners.includes(l)) w.__banners.push(l);
      }
      for (const b of document.querySelectorAll(".tw-bar .bc-bubble[aria-label], .tw-side .bc-bubble[aria-label]")) {
        const l = `${b.closest("[data-boss]")?.getAttribute("data-boss")}|${b.getAttribute("aria-label")}`;
        if (!w.__words.includes(l)) w.__words.push(l);
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await intoTower(page, "&power=cuts");
  // A run on floor 2, Ginger then Sawyer (the deal set in the local database: a floor of two from the server's own deal is random).
  // (From the page, as the app asks: its own session.)
  const made = await page.evaluate(async () => {
    const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
    const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
    return { ok: run.ok, user: me.user.id as string };
  });
  expect(made.ok).toBe(true);
  await localSql(page, "UPDATE tower_runs SET floor = 2, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors: [["moo"], ["gingerbread", "sawyer"]], deck: [], decks: 1 }), made.user);
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await clerk.getByRole("button", { name: "Continue: floor 2" }).click();
  await floorThenMatch(page, 2, 2);
  // Your moves until Sawyer's cut stands on Ginger's turn (she's to move: the view's top level is hers, his cut only in his part).
  const turn = () =>
    page.evaluate(() => {
      const b = (window as any).match?.boss;
      const side = b?.side;
      return { play: (window as any).match?.phase?.kind === "play", toMove: side?.bosses[side.toMove]?.id ?? null, cut: side?.bosses.find((x: any) => x.id === "sawyer")?.powers?.cut ?? null, topCut: b?.powers?.cut ?? null };
    });
  let at = await turn();
  for (let i = 0; i < 10 && !(at.play && at.toMove === "gingerbread" && at.cut); i++) {
    await playAMove(page);
    await expect.poll(async () => (at = await turn()).play, { timeout: 90_000 }).toBe(true);
  }
  expect(at.toMove).toBe("gingerbread");
  expect(at.topCut).toBeNull();
  // His cut drawn on her turn, once.
  const cut = `${at.cut.a}-${at.cut.b}`;
  await expect(page.locator(".sw-cut")).toHaveCount(1);
  await expect(page.locator(".sw-cut")).toHaveAttribute("data-cut", cut);
  // The banner of his cut named him, never her.
  const banners: string[] = await page.evaluate(() => (window as any).__banners);
  expect(banners.some((l) => l.startsWith("Sawyer: SAW CUT!"))).toBe(true);
  expect(banners.filter((l) => l.includes("SAW CUT") && !l.startsWith("Sawyer"))).toEqual([]);
  // His power's words by his own part of the bar (a computer's: over his own figure), never hers (characters/sawyer.ts, `power`).
  const his = ["Mind the gap.", "Keep off the cut!", "Snip snip.", "Clean cut."];
  const words: string[] = await page.evaluate(() => (window as any).__words);
  expect(words.filter((l) => his.includes(l.split("|")[1]!)).length).toBeGreaterThan(0);
  expect(words.filter((l) => his.includes(l.split("|")[1]!) && l.split("|")[0] !== "sawyer")).toEqual([]);
  // The move list: each of the side's moves by the boss who made it, in turn (Ginger, Sawyer, Ginger…).
  const said = await page.locator(".mv-row.mv-boss").evaluateAll((rows) => rows.map((r) => r.getAttribute("aria-label")!.replace(/^\S+ /, "").split(":")[0]));
  expect(said.length).toBeGreaterThan(1);
  said.forEach((name, i) => expect(name, `the side's move ${i + 1}`).toBe(i % 2 ? "Sawyer" : "Ginger"));
  // (The still for Eric: his cut on her turn.)
  await still(page, "shared-floor");
});

test("a shared floor of Babur and Wrangler (Eric, Nov 20): Babur's pump in his part of the split bar, his balloon on it; Wrangler's meter empty and dimmed, no showdown in the tower", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  // (The showdown's test switch fills Wrangler's meter from turn 2 anywhere else: on a tower floor it stays empty.)
  await intoTower(page, "&power=showdown");
  const made = await page.evaluate(async () => {
    const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
    const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
    return { ok: run.ok, user: me.user.id as string };
  });
  expect(made.ok).toBe(true);
  await localSql(page, "UPDATE tower_runs SET floor = 2, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors: [["moo"], ["tiger", "pig"]], deck: [], decks: 1 }), made.user);
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await clerk.getByRole("button", { name: "Continue: floor 2" }).click();
  await floorThenMatch(page, 2, 2);
  // Babur's pump: a phone's in his own part of the split bar, inside it; a computer's beside his figure by the board, clear of it. One.
  const desk = test.info().project.name === "desktop";
  const holder = page.locator(desk ? '.tw-side-fig[data-boss="tiger"]' : '.tw-part[data-boss="tiger"]');
  const pump = holder.locator(".tg-pump-slot");
  await expect(pump).toHaveAttribute("data-place", "tower");
  await expect(page.locator(".tg-pump")).toHaveCount(1);
  const inside = async () => {
    const b = (await pump.boundingBox())!;
    const a = desk ? { x: 0, y: 0, ...page.viewportSize()! } : (await holder.boundingBox())!;
    const ok = b.width > 30 && b.x >= a.x - 0.5 && b.y >= a.y - 0.5 && b.x + b.width <= a.x + a.width + 0.5 && b.y + b.height <= a.y + a.height + 0.5;
    const board = (await page.locator(".board-wrap").first().boundingBox())!;
    return ok && (!desk || b.x + b.width <= board.x);
  };
  expect(await inside()).toBe(true);
  // Wrangler's meter: on the bar, empty and dimmed, saying why.
  const meter = page.locator('.tw-part[data-boss="pig"] .rage-meter');
  const off = async () => {
    await expect(meter).toHaveAttribute("data-ult-off", "");
    await expect(meter).toHaveClass(/paused/);
    await expect(meter).toHaveAttribute("aria-valuenow", "0");
    await expect(meter).toHaveAttribute("aria-label", "Rage: no ultimate in the Battle Tower");
  };
  await off();
  // A few moves: a balloon goes on his pump as his turn begins; Wrangler's meter never fills and no showdown comes.
  const pig = () => page.evaluate(() => (window as any).match.boss.side.bosses.find((b: any) => b.id === "pig").powers);
  let balloon = "";
  for (let n = 1; n <= 4 && !balloon; n++) {
    await playAMove(page);
    await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === n, { timeout: 90_000 }).toBe(true);
    balloon = (await pump.getAttribute("data-balloon")) ?? "";
    const p = await pig();
    expect(p.ultAt).toBeNull();
    expect(p.noUlt).toBe(true);
    await off();
  }
  expect(balloon, "a balloon on Babur's pump").not.toBe("");
  expect(await inside()).toBe(true);
  await still(page, "shared-floor-babur-wrangler");
});

test("a shared floor of Puddles and Babur (Eric, Nov 20: one boss adds pieces, the first in turn order): Babur's pump stays in his part, greyed and tagged OFF, never a balloon; Puddles, first, keeps his; every part's words inside its outline", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await intoTower(page);
  const made = await page.evaluate(async () => {
    const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
    const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
    return { ok: run.ok, user: me.user.id as string };
  });
  expect(made.ok).toBe(true);
  // (Puddles moves first, so his Watering grows pieces as ever; Babur's balloons are off. BATTLE_TOWER.addsPieces.)
  await localSql(page, "UPDATE tower_runs SET floor = 2, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors: [["moo"], ["gardener", "tiger"]], deck: [], decks: 1 }), made.user);
  const clerk = await tapRoom(page, "keeper", "Clerk");
  await clerk.getByRole("button", { name: "Continue: floor 2" }).click();
  await floorThenMatch(page, 2, 2);
  // (Eric, Nov 20: every part's name, level and seed meter inside its own part's outline, within 1 px; Puddles' row wraps.)
  await expect(page.locator('.tw-part[data-boss="gardener"] .seed-meter')).toBeVisible();
  const spill = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".tw-bar .tw-part")].flatMap((part) => {
        const a = part.getBoundingClientRect();
        // (The box inside the 3 px outline: its border is part's own, clientLeft/clientWidth.)
        const left = a.left + part.clientLeft;
        const right = left + part.clientWidth;
        return [...part.querySelectorAll<HTMLElement>(".tw-part-text, .tw-part-text *")]
          .filter((c) => {
            const b = c.getBoundingClientRect();
            return b.width > 0 && (b.left < left - 1 || b.right > right + 1);
          })
          .map((c) => `${part.dataset.boss}: ${c.className || c.tagName}`);
      }),
    );
  expect(await spill()).toEqual([]);
  const desk = test.info().project.name === "desktop";
  const pump = page.locator(desk ? '.tw-side-fig[data-boss="tiger"] .tg-pump-slot' : '.tw-part[data-boss="tiger"] .tg-pump-slot');
  const off = async () => {
    await expect(pump).toHaveAttribute("data-off", "");
    await expect(pump).toHaveAttribute("aria-label", "Balloons: off on this floor");
    await expect(pump).toHaveAttribute("data-balloon", "");
    await expect(pump.locator(".tg-off-tag")).toHaveText("OFF");
    expect(await pump.locator(".tg-pump").evaluate((el) => getComputedStyle(el).filter)).toContain("grayscale");
  };
  await expect(page.locator(".tg-pump")).toHaveCount(1);
  await off();
  // (Puddles is the primary: his seed meter as ever, no "no pieces" in its label.)
  await expect(page.locator('.tw-part[data-boss="gardener"] .seed-meter')).toHaveAttribute("aria-label", /^Seeds \d+ of \d+$/);
  const powers = () => page.evaluate(() => Object.fromEntries((window as any).match.boss.side.bosses.map((b: any) => [b.id, { noAdd: !!b.powers.noAdd, placed: b.powers.balloons?.placed ?? 0 }])));
  // (Two of your moves: Babur's turn comes and goes with nothing on his pump.)
  for (let n = 1; n <= 2; n++) {
    await playAMove(page);
    await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === n, { timeout: 90_000 }).toBe(true);
    await off();
  }
  expect(await powers()).toEqual({ gardener: { noAdd: false, placed: 0 }, tiger: { noAdd: true, placed: 0 } });
  await still(page, "shared-floor-primary-off");
});
