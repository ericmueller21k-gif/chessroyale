import { mkdirSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { BANNED_LINE, pausedLine } from "@chessroyale/core";
import { test, named, submitMove, tapInTown, localSql } from "./helpers.ts";
import { planWaiting, planWords } from "../packages/app/src/tower-plan.ts";
import { TOWER_PARTY_LINES } from "../packages/server/src/squads-party.ts";

/**
 * The Battle Tower's party (Nov 20; docs/decisions/2026-11-20-tower-party.md; Eric: "there should be a solo mode, and then there have an
 * invite friends, or another option, which is like basically like open party ... the invite friends one should just give a pop-up for
 * your friends list"): the clerk's three ways (Solo, Invite friends, Open your own party), the friends pop-up's Invite, the friend's Accept into
 * the tower, READY and START, both pawns walking in, floor 1 won together (?win=1: Qxf7 mates), every copy on floor 2, and one of them
 * going on alone ("you can continue on your own, but it's just solo from that point forward"). `STILLS=<dir>` writes the stills.
 */

const STILLS = process.env.STILLS;
const NEWS = { timeout: 25_000 };
const phase = (page: Page) => page.evaluate(() => (window as any).match?.phase?.kind ?? null);
type Floor = { floor: number; mode: string; bosses: string[]; t: number | null; go: number | null; mates: number } | null;
const floorNow = (page: Page): Promise<Floor> => page.evaluate(() => (window as any).__towerFloor?.() ?? null);
const room = (page: Page) => page.locator("canvas.town-shop-canvas");

async function still(page: Page, name: string) {
  if (!STILLS) return;
  mkdirSync(STILLS, { recursive: true });
  await page.screenshot({ path: `${STILLS}/${name}-${test.info().project.name}.png` });
}

/** A player on their own page (their own account), on home. */
async function player(browser: Browser, name: string): Promise<{ page: Page; id: string }> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding&debug");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const id = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.id as string));
  return { page, id };
}

/** Two players made friends through the API (a request and its answer). */
async function befriend(a: { page: Page; id: string }, b: { page: Page; id: string }) {
  const post = (p: Page, action: string, body: object) =>
    p.evaluate(([action, body]) => fetch(`/api/friends/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status), [action, body] as const);
  expect(await post(a.page, "request", { id: b.id })).toBe(200);
  expect(await post(b.page, "answer", { id: a.id, accept: true })).toBe(200);
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

/** Each account's open party copy, as stored. */
const copies = (page: Page, ids: string[]) =>
  localSql<{ user_id: string; floor: number; seed: number; members: string; fight: string | null }>(page, `SELECT user_id, floor, seed, members, fight FROM tower_runs WHERE kind = 'party' AND status = 'open' AND user_id IN (${ids.map((i) => `'${i}'`).join(", ")})`);

test("a party of two @phone-only: the clerk's three ways, Invite friends, the friend's Accept, READY and START, floor 1 won together, both copies on floor 2, one going on alone", async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  const ann = await player(browser, "Ann Tower");
  const bo = await player(browser, "Bo Tower");
  await befriend(ann, bo);

  // Ann at the clerk: Solo (hers now), Invite friends, Open your own party, always there; her solo climb's Start under them.
  await intoTower(ann.page, "&win=1");
  const clerk = await tapRoom(ann.page, "keeper", "Clerk");
  const ways = clerk.getByRole("group", { name: "How to climb" });
  await expect(ways.getByRole("button", { name: "Solo" })).toHaveAttribute("aria-pressed", "true");
  await expect(ways.getByRole("button", { name: "Invite friends" })).toBeEnabled({ timeout: 20_000 });
  await expect(ways.getByRole("button", { name: "Open your own party" })).toBeEnabled();
  await expect(clerk.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await expect(clerk.getByRole("button", { name: "Alone" })).toBeDisabled();

  // Invite friends: the party made, the friends pop-up; Bo's Invite.
  await ways.getByRole("button", { name: "Invite friends" }).click();
  const sheet = ann.page.getByRole("dialog", { name: "Invite friends" });
  await expect(sheet).toContainText("Up to 3 friends climb with you");
  await sheet.locator(".fr-row", { hasText: "Bo Tower" }).getByRole("button", { name: "Invite" }).click();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  // (In a party: Solo greyed, the panel her party's seats; the plan waits for a second climber.)
  await expect(ways.getByRole("button", { name: "Solo" })).toBeDisabled();
  await expect(clerk.locator(".tw-seat")).toHaveCount(4);
  await expect(clerk.locator(".tw-plan")).toContainText("two or more");

  // Bo's invite: Accept takes him into the party and the tower's lobby, its clerk his party's card.
  const toast = bo.page.locator(".fr-toast");
  await expect(toast).toContainText("Ann Tower invited you", NEWS);
  await expect(toast).toContainText("to climb the Battle Tower");
  await toast.getByRole("button", { name: "Accept" }).click();
  await expect(room(bo.page)).toHaveAttribute("data-room", "tower", { timeout: 60_000 });
  await expect(room(bo.page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  const boClerk = await tapRoom(bo.page, "keeper", "Clerk");
  await expect(boClerk.locator(".tw-seat:not(.free)")).toHaveCount(2, { timeout: 20_000 });
  await expect(boClerk.locator(".tw-plan")).toContainText("A new climb from floor 1", { timeout: 20_000 });
  await boClerk.getByRole("button", { name: "READY", exact: true }).click();
  await expect(boClerk.getByRole("button", { name: "READY ✓" })).toBeVisible();

  // Ann's START: both into the elevator, the floor room (each the other's pawn walking in), then the match. (Her solo climb's Start shows
  // greyed under the party's half: the review of #835, finding 11.)
  await expect(clerk.getByRole("button", { name: "Start", exact: true })).toBeDisabled();
  const start = clerk.getByRole("button", { name: "START", exact: true });
  await expect(start).toBeEnabled({ timeout: 20_000 });
  await start.click();
  for (const p of [ann.page, bo.page]) await expect.poll(async () => (await floorNow(p))?.floor ?? null, { timeout: 60_000 }).toBe(1);
  // (Each sees the other's pawn walk in: one mate in the floor room.)
  for (const p of [ann.page, bo.page]) expect((await floorNow(p))!.mates).toBe(1);
  // (Everyone on their marks, the pieces coming up: Bo's pawn in his seat's color beside Ann's.)
  await expect.poll(async () => { const f = await floorNow(ann.page); return !!f && f.t !== null && f.go !== null && f.t > f.go - 900; }, { timeout: 15_000 }).toBe(true);
  await still(ann.page, "party-walk-in");
  for (const p of [ann.page, bo.page]) await expect.poll(() => phase(p), { timeout: 120_000 }).toBe("play");
  await expect(ann.page.locator(".tw-strip").first()).toContainText("Floor 1 of 99");

  // Both pick Qxf7 (the party rule: every connected member picks): the boss is mated, floor 1 won.
  for (const p of [ann.page, bo.page]) await submitMove(p, "h5f7");
  for (const p of [ann.page, bo.page]) await expect(p.locator('[data-tower-result="won"][data-tower-party]')).toContainText("Floor 1 cleared!", { timeout: 120_000 });

  // The room wrote every copy: the same run, both on floor 2, nothing under way.
  await expect
    .poll(async () => (await copies(ann.page, [ann.id, bo.id])).map((c) => `${c.floor}:${c.fight === null}`).sort(), { timeout: 30_000 })
    .toEqual(["2:true", "2:true"]);
  const [a, b] = await copies(ann.page, [ann.id, bo.id]);
  expect(a!.seed).toBe(b!.seed);
  expect(JSON.parse(a!.members).run).toBe(JSON.parse(b!.members).run);

  // Back to the tower: each in the floor room, floor 1 won, the party's way up.
  for (const p of [ann.page, bo.page]) {
    await p.getByRole("button", { name: "Back to the tower" }).click();
    await expect.poll(async () => (await floorNow(p))?.mode ?? null, { timeout: 60_000 }).toBe("won");
  }

  // Bo goes on alone: down to the clerk, Leave party, "Alone: floor 2": his copy, played on by himself.
  const down = await tapRoom(bo.page, "pass", "Way down", "front");
  await down.getByRole("button", { name: "Down to the lobby" }).click();
  await expect(room(bo.page)).not.toHaveAttribute("data-part", "top", { timeout: 20_000 });
  const boDesk = await tapRoom(bo.page, "keeper", "Clerk");
  await boDesk.getByRole("button", { name: "Leave party" }).click();
  const alone = boDesk.getByRole("button", { name: "Alone: floor 2" });
  await expect(alone).toBeEnabled({ timeout: 20_000 });
  await alone.click();
  await expect.poll(async () => (await floorNow(bo.page))?.floor ?? null, { timeout: 60_000 }).toBe(2);
  await expect.poll(() => phase(bo.page), { timeout: 120_000 }).toBe("play");
  await expect(bo.page.locator(".tw-strip").first()).toContainText("Floor 2 of 99");
  const mine = (await copies(bo.page, [bo.id]))[0]!;
  expect(JSON.parse(mine.members).alone).toBe(true);
  expect(JSON.parse(mine.fight!).lobby).toBeUndefined();
  // (Ann's copy didn't move: still floor 2, nothing under way.)
  expect((await copies(ann.page, [ann.id]))[0]).toMatchObject({ floor: 2, fight: null });
});

test("the clerk's card: its three ways and the open parties always there; Open your own party's line in the town's chat, whose Go to the tower brings a player to the clerk, who joins from the list; the friends pop-up", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const ann = await player(browser, "Ann Open");
  const bo = await player(browser, "Bo Open");
  await befriend(ann, bo);
  const chat = `tp-${test.info().project.name}-${Date.now().toString(36)}`;
  await intoTower(ann.page, `&townroom=${chat}`);
  const clerk = await tapRoom(ann.page, "keeper", "Clerk");
  const ways = clerk.getByRole("group", { name: "How to climb" });
  for (const name of ["Solo", "Invite friends", "Open your own party"]) await expect(ways.getByRole("button", { name })).toBeVisible();
  await expect(ways.getByRole("button", { name: "Open your own party" })).toBeEnabled({ timeout: 20_000 });
  // (The open parties: none yet, said so in its box (Eric, Nov 20).)
  const opens = (card: typeof clerk) => card.getByRole("group", { name: "Open parties" });
  await expect(opens(clerk)).toContainText("No open parties right now.", { timeout: 20_000 });
  await still(ann.page, "clerk-three-ways");
  // Open your own party: a party, and its line in the town's chat with "Go to the tower"; on the list, hers, "Joined" (greyed).
  await ways.getByRole("button", { name: "Open your own party" }).click();
  await expect(ways.getByRole("button", { name: "Open your own party" })).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
  const line = (p: Page) => p.locator(".tc-line", { hasText: "Ann Open is looking for 3 more to climb the Battle Tower" });
  await expect(line(ann.page)).toBeVisible({ timeout: 30_000 });
  await expect(opens(clerk).getByRole("button", { name: "Joined Ann Open's party" })).toBeDisabled({ timeout: 20_000 });
  // Bo on the street (the same chat): the line's "Go to the tower" (its press never opens typing: Eric's exception, Nov 20) walks him
  // into the tower, by the clerk, his card open on the open parties; he joins Ann's from the list.
  await bo.page.goto(`/town?debug&pace=quick&sky=day&townroom=${chat}`);
  await expect(bo.page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await line(bo.page).getByRole("button", { name: "Go to the tower" }).click();
  await expect(bo.page.locator(".tc-form")).toHaveAttribute("data-open", "0");
  await expect(room(bo.page)).toHaveAttribute("data-room", "tower", { timeout: 60_000 });
  const boClerk = bo.page.getByRole("dialog", { name: "Clerk", exact: true });
  await expect(boClerk).toBeVisible({ timeout: 30_000 });
  const row = opens(boClerk).locator(".tw-open-row", { hasText: "Ann Open" });
  await expect(row).toContainText("1/4", { timeout: 20_000 });
  await row.getByRole("button", { name: "Join Ann Open's party" }).click();
  await expect(boClerk.locator(".tw-seat:not(.free)")).toHaveCount(2, { timeout: 20_000 });
  await expect(row.getByRole("button", { name: "Joined Ann Open's party" })).toBeDisabled({ timeout: 20_000 });
  await still(bo.page, "clerk-open-parties");
  await expect(clerk.locator(".tw-seat:not(.free)")).toHaveCount(2, { timeout: 20_000 });
  await expect(clerk.locator(".tw-plan")).toContainText("A new climb from floor 1", { timeout: 20_000 });
  // (The plan line's three lines hold its longest words, the leader's in a party of four (with its lives, #839) and the longest refusals,
  // with room for a wider font, so nothing under it moves (the delta review of #835, finding 3); the open parties' box holds three rows with no scroll (finding
  // 5). Measured on copies beside the real ones, in their font and width: the card's own stay as they are.)
  await expect(opens(clerk).locator(".tw-open-row").first()).toBeVisible({ timeout: 20_000 });
  const four = ["a", "b", "c", "d"].map((id) => ({ id, floor: 99 }));
  const longest = [
    planWaiting(planWords({ kind: "continue", floor: 98, back: four }, "a").line, 3),
    planWaiting(planWords({ kind: "new", ends: four }, "a").line, 3),
    planWaiting(planWords({ kind: "continue", floor: 98, back: four }, "e").line, 3),
    // (With the climb's lives once one is spent (Nov 20): none left is the longest.)
    planWaiting(planWords({ kind: "continue", floor: 98, back: four, lives: 0 }, "a").line, 3),
    planWaiting(planWords({ kind: "continue", floor: 98, back: four, lives: 0 }, "e").line, 3),
    TOWER_PARTY_LINES.needTwo,
    TOWER_PARTY_LINES.openWait(60_000),
    `${"W".repeat(16)}'s account has been deleted. Kick them to climb on.`,
    BANNED_LINE,
    pausedLine("raid"),
  ];
  const fit = await ann.page.evaluate((texts) => {
    const copyOf = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement;
      const c = el.cloneNode(true) as HTMLElement;
      // (92% of its width: an iPhone's font runs wider than headless Chrome's.)
      c.style.cssText = `position:absolute;visibility:hidden;left:0;top:0;width:${(parseFloat(getComputedStyle(el).width) * 0.92).toFixed(1)}px`;
      el.parentElement!.appendChild(c);
      return { el, c };
    };
    const plan = copyOf(".tw-plan");
    const lines = texts.map((t) => {
      plan.c.textContent = t;
      return { t, over: plan.c.scrollHeight - plan.c.clientHeight };
    });
    const tall = { real: plan.el.getBoundingClientRect().height, copy: plan.c.getBoundingClientRect().height, line: parseFloat(getComputedStyle(plan.el).lineHeight) };
    plan.c.remove();
    const list = copyOf(".tw-open-list");
    const row = list.c.querySelector(".tw-open-row")!;
    list.c.replaceChildren(row, row.cloneNode(true), row.cloneNode(true));
    const three = list.c.scrollHeight - list.c.clientHeight;
    list.c.remove();
    return { lines, tall, three };
  }, longest);
  for (const l of fit.lines) expect(l.over, l.t).toBeLessThanOrEqual(0);
  expect(fit.tall.real).toBeCloseTo(3 * fit.tall.line, 0);
  expect(fit.tall.copy).toBeCloseTo(fit.tall.real, 0);
  expect(fit.three).toBeLessThanOrEqual(0);
  // The friends pop-up (its slide-in done).
  await ways.getByRole("button", { name: "Invite friends" }).click();
  const sheet = ann.page.getByRole("dialog", { name: "Invite friends" });
  await expect(sheet.locator(".fr-row", { hasText: "Bo Open" }).getByRole("button", { name: "In party" })).toBeDisabled({ timeout: 20_000 });
  await ann.page.waitForTimeout(400);
  await still(ann.page, "friends-popup");
});
