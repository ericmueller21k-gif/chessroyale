import { expect, type Page } from "@playwright/test";
import { RECLUSE_PHASE2, bossInText, crowdFinalBoss, crowdFinalists } from "@chessroyale/core";
import { createLobbyFromHome, engineTop, soloFromHome, submitMove, test, watchFor } from "./helpers.ts";
import { RECLUSE_LINES } from "../packages/app/src/characters/recluse-lines.ts";

/**
 * The Crowd's boss final is always the Hidden Boss (Eric, Oct 14): the top 4 against him, for everyone, solo and online.
 * - The vote's card is his (his roster name and icon, the top 4), in its place between Team final and Duel.
 * - Solo (you and bots): the top 4 meet him; the God King's help tried spends a charge and the move goes on; beaten
 *   (?win=1), he collapses, then his phase 2 with the other finalists on the other three boards.
 * - Online: everyone sees his intro by name, four in the battle, his bullet clock; a try at the God King spends a charge
 *   and your move goes on; his chatter (Oct 15), driven on this device from its own view, comes within half a minute. (Phase 2 isn't online: phase 1 won is the victory, unit-tested in crowd-hidden-boss.test.ts.)
 */
const him = crowdFinalBoss()!;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const bossNow = (p: Page) => p.evaluate(() => (window as any).match?.boss ?? null);
const alive = (p: Page) => p.evaluate(() => (window as any).match.standings().filter((s: any) => !s.out).length as number);
const mine = (p: Page) => p.evaluate(() => !!(window as any).match.standings().find((s: any) => s.isYou && !s.out));

/** Plays the knockouts as a strong player (the engine's best move, at once), until the boss final begins (or `until`). */
async function knockouts(page: Page, minutes: number, until: (p: Page) => Promise<boolean> = async (p) => !!(await bossNow(p))) {
  const stopAt = Date.now() + minutes * 60_000;
  while (Date.now() < stopAt && !(await until(page))) {
    if ((await phase(page)) === "play" && !(await bossNow(page))) {
      const { fen, top } = await engineTop(page);
      await submitMove(page, top[0]?.move, fen);
    }
    await page.waitForTimeout(200);
  }
}

test("the vote: the boss final's card is his (his name and icon, the top 4), between Team final and Duel, and fits its card", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await page.goto("/?debug&mode=crowd&augments=1");
  await soloFromHome(page);
  await expect(page.getByRole("heading", { name: "How does it end?" })).toBeVisible({ timeout: 30_000 });
  const cards = page.locator(".vote-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.locator("strong")).toHaveText(["Team final", him.name, "Duel"]);
  await expect(cards.nth(1).locator(".vote-card-icon")).toHaveText(him.icon);
  await expect(cards.nth(1).locator(".vote-card-blurb")).toHaveText(`Boss final: top ${crowdFinalists("boss")} team up against him`);
  // His zone on the board shows his icon too.
  await expect(page.locator(".vote-zone-icon").nth(1)).toHaveText(him.icon);
  // Nothing cut off: the label and blurb wrap inside the card.
  const fit = await cards.nth(1).evaluate((c) => [...c.querySelectorAll("strong, .vote-card-blurb")].every((e) => e.scrollWidth <= e.clientWidth + 1) && c.scrollWidth <= c.clientWidth + 1);
  expect(fit).toBe(true);
  // Tap it: that's your vote.
  await page.getByRole("radio", { name: new RegExp(him.name) }).click();
  await expect.poll(() => page.evaluate(() => (window as any).match.myVote)).toBe(1);
  await expect(page.locator(".vote-card.on")).toContainText(him.name);
});

test("solo Crowd: the top 4 meet him; the God King's help tried spends a charge; beaten (?win=1), he collapses, then phase 2 with the other finalists on the boards", async ({ page }) => {
  test.setTimeout(12 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough: a phone");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (Two rounds a stage: with one, the team that hasn't moved yet is a coin flip at the first cut. ?weakbots=1: people rank
  // above bots, so the cuts take bots first and you surely reach the final. Playing well isn't enough: the opening
  // allowance leaves bots level with you, and only two of each team reach it. docs/decisions/2026-10-16-flaky-e2e-batch-2.md)
  await page.goto("/?debug&pace=quick&mode=crowd&format=boss&rounds=2&clock=30&win=1&weakbots=1");
  await soloFromHome(page);
  await knockouts(page, 8);
  // (The battle is set up at the last cut; its intro comes after the cut's screen. Its line counts the finalists.)
  expect(crowdFinalists("boss")).toBe(4);
  const intro = await watchFor(page, { line: { selector: ".boss-dock-status", text: /Four of you vs the boss\./ }, name: { selector: ".boss-intro-name", text: new RegExp(him.name) } });
  const boss = await bossNow(page);
  expect(boss.id).toBe(him.id);
  expect(boss.name).toBe(him.name);
  expect(boss.raid).toBe(false);
  expect(await alive(page)).toBe(crowdFinalists("boss"));
  expect(await mine(page), "you reached the final (?weakbots=1: the cuts take bots first)").toBe(true);
  await expect(page.locator(".boss-name").filter({ hasText: him.name }).first()).toBeVisible();
  // The other finalists: phase 2's other players later.
  const mates: string[] = await page.evaluate(() => (window as any).match.standings().filter((s: any) => !s.out && !s.isYou).map((s: any) => s.name));
  expect(mates).toHaveLength(crowdFinalists("boss") - 1);
  // Your move (?win=1: Qxf7 mates him). First the God King, tried: he doesn't come, a charge is spent, your move goes on.
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  expect(await intro.seen()).toEqual({ line: true, name: true });
  const charges: number = (await bossNow(page)).kingCharges;
  expect(charges).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: /God King: tap to summon/ }).click();
  await page.getByRole("menuitem", { name: /move/i }).first().click();
  await expect.poll(async () => (await bossNow(page)).kingCharges).toBe(charges - 1);
  expect(await phase(page)).toBe("play");
  const fall = await watchFor(page, { dock: { selector: ".boss-dock-status", text: /You beat him!/ } });
  await submitMove(page, "h5f7", await page.evaluate(() => (window as any).match.phase.board.fen));
  // Beaten: he collapses on the board, then his phase change, then four boards: you, and the three who reached him with you.
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("phaseChange");
  expect(await fall.seen()).toEqual({ dock: true });
  expect((await bossNow(page)).result).toBe("crowd");
  // (The phase change is about 25 s since Oct 17: its added beats are settings.)
  const added = RECLUSE_PHASE2.change.talkMs + RECLUSE_PHASE2.change.absorbHoldMs + RECLUSE_PHASE2.change.castHoldMs;
  await expect.poll(() => phase(page), { timeout: 30_000 + added }).toBe("simul");
  const v = await page.evaluate(() => (window as any).match.simul);
  expect(v.boards).toHaveLength(4);
  expect(v.boards[0].you).toBe(true);
  expect(v.boards.slice(1).map((b: any) => b.name).sort()).toEqual([...mates].sort());
  // (?win=1: every board a mate in one; the bots take theirs, you play Qxf7 on yours.)
  await expect.poll(async () => (await page.evaluate(() => (window as any).match.simul))?.boards[0].toMove, { timeout: 60_000 }).toBe("crowd");
  await page.evaluate(() => (window as any).match.simulMove(0, "h5f7"));
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("results");
  await expect(page.locator(".team-result")).toHaveText(`You beat ${bossInText(him.name)} on all 4 boards!`);
  // Your place is your place in the crowd (not "Victory!", which is Boss alone's headline).
  await expect(page.locator(".results h1")).toHaveText(/^\d+(st|nd|rd|th) of 100$/);
  expect(errors).toEqual([]);
});

test("online: a Crowd boss final meets him: his intro by name for everyone, four in the battle; a try at the God King spends a charge and your move goes on; his bullet clock", async ({ page }) => {
  test.setTimeout(12 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough: a computer");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&mode=crowd&format=boss&rounds=2&clock=30&bossMoves=8&power=bullet&weakbots=1");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /Start with 1 player/ }).click();
  await knockouts(page, 9);
  const boss = await bossNow(page);
  expect(boss.id).toBe(him.id);
  expect(boss.name).toBe(him.name);
  expect(boss.board.ply).toBe(0);
  await expect(page.locator(".boss-name").filter({ hasText: him.name }).first()).toBeVisible();
  // Four in the battle (the rest out at the cuts); you among them (?weakbots=1: the cuts take bots first).
  expect(await alive(page)).toBe(crowdFinalists("boss"));
  expect(await mine(page), "you reached the final (?weakbots=1: the cuts take bots first)").toBe(true);
  const banner = await watchFor(page, { bullet: { selector: ".fight-banner.power-cut", text: /BULLET!/ } });
  // His chatter (recluse-talk.ts): this device drives it from its own view of the battle. When its first line shows.
  await page.evaluate((lines) => {
    const w = window as any;
    w.__chatter = null;
    const t = setInterval(() => {
      const text = document.querySelector(".bc-bubble")?.getAttribute("aria-label");
      if (text && lines.includes(text)) (w.__chatter = { at: Date.now(), text }), clearInterval(t);
    }, 100);
  }, Object.values(RECLUSE_LINES.talk[1]).flat() as string[]);
  // Your first move against him: the God King tried (a strike): he doesn't come, a charge is spent, still your move.
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  const playAt: number = await page.evaluate(() => (window as any).match.phase.startsAt);
  const charges: number = (await bossNow(page)).kingCharges;
  expect(charges).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: /God King: tap to summon/ }).click();
  await page.getByRole("menuitem", { name: /Strike/ }).click();
  await expect.poll(async () => (await bossNow(page)).kingCharges).toBe(charges - 1);
  // (The dock's crowns too, at once.)
  await expect(page.locator(".gk-unit-charges")).toHaveAttribute("aria-label", new RegExp(`^${charges - 1} charge`));
  expect(await phase(page)).toBe("play");
  expect(await page.evaluate(() => (window as any).match.kingCalled)).toBe(false);
  await expect(page.getByLabel("The God King strikes the boss")).toHaveCount(0);
  const { fen, top } = await engineTop(page);
  await submitMove(page, top[0]!.move, fen);
  // The server spent it too: the next turn's battle says so. Then his bullet clock (?power=bullet: turn 2), no warning.
  await expect.poll(async () => (await bossNow(page)).crowdMoves, { timeout: 90_000 }).toBeGreaterThanOrEqual(1);
  expect((await bossNow(page)).kingCharges).toBe(charges - 1);
  await expect.poll(() => banner.seen(), { timeout: 90_000 }).toEqual({ bullet: true });
  expect((await bossNow(page)).powers.ultAt).toBe(2);
  // His chatter came, from his first turn's clock about 15 s on (later if his mock or bullet line was up then).
  await expect.poll(() => page.evaluate(() => (window as any).__chatter), { timeout: 45_000 }).not.toBeNull();
  const chatter = (await page.evaluate(() => (window as any).__chatter)) as { at: number; text: string };
  console.log(`Online, his first chatter ${((chatter.at - playAt) / 1000).toFixed(1)} s after your first move began: ${chatter.text}`);
  expect(chatter.at - playAt).toBeLessThanOrEqual(30_000);
  expect(errors).toEqual([]);
});
