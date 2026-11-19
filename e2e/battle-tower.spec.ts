import { expect, type Page } from "@playwright/test";
import { legalMoves } from "@chessroyale/chess";
import { test, submitMove, localSql } from "./helpers.ts";

/**
 * The Battle Tower's solo screens (PR 10; docs/areas/battle-tower.md): the tower's screen at /tower (only the town's clerk opens it),
 * a run started, floor 1 won with the test switch (?win=1: Qxf7 mates), floor 2's two bosses on the split bar, a reload mid-floor
 * rejoining the same position, a counted leave ending the run; a free leave before your 2nd move; no Last Stand on a floor.
 */

const phase = (page: Page) => page.evaluate(() => (window as any).match?.phase?.kind ?? null);
const fen = (page: Page) => page.evaluate(() => (window as any).match?.phase?.board?.fen ?? null);
const moves = (page: Page) => page.evaluate(() => (window as any).match?.boss?.crowdMoves ?? null);

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

async function towerScreen(page: Page) {
  await expect(page.getByRole("heading", { name: "Battle Tower", exact: true })).toBeVisible({ timeout: 30_000 });
}

test("a run: floor 1 won, floor 2's two bosses on the bar, a reload rejoins the same position, a counted leave ends the run", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/tower?debug&pace=quick&win=1");
  await towerScreen(page);
  // No run yet: START A RUN, "Start a new run" greyed (nothing hidden), Party greyed.
  await expect(page.getByRole("region", { name: "Your run" })).toContainText("No run yet");
  await expect(page.getByRole("button", { name: "Start a new run" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /Party/ })).toBeDisabled();
  await page.getByRole("button", { name: "START A RUN" }).click();
  // Floor 1: one boss, the strip over the battle. Qxf7 mates (?win=1).
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect(page.locator(".tw-strip").first()).toContainText("Floor 1 of 99");
  await submitMove(page, "h5f7");
  const won = page.locator('[data-tower-result="won"]');
  await expect(won).toContainText("Floor 1 cleared!", { timeout: 120_000 });
  const cont = won.getByRole("button", { name: "Continue" });
  // (Greyed while the result's pictures play and the server answers; then on.)
  await expect(cont).toBeEnabled({ timeout: 20_000 });
  await expect(won.getByRole("button", { name: "Stop here (saved)" })).toBeEnabled();
  await cont.click();
  // Floor 2: two bosses, the bar split in two, one lit to move.
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect(page.locator(".tw-strip").first()).toContainText("Floor 2 of 99");
  await expect(page.locator(".tw-bar .tw-part")).toHaveCount(2);
  await expect(page.locator(".tw-bar .tw-part.tw-to-move")).toHaveCount(1);
  // A move, the bosses' reply, then a reload: the same position, rejoined at once from the tower's screen.
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 1, { timeout: 90_000 }).toBe(true);
  const before = await fen(page);
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  expect(await fen(page)).toBe(before);
  expect(await moves(page)).toBe(1);
  await expect(page.locator(".tw-bar .tw-part")).toHaveCount(2);
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
  await towerScreen(page);
  await expect(page.getByRole("region", { name: "Your run" })).toContainText("No run yet");
  await expect(page.locator(".tw-bests")).toContainText("Floor 1");
});

test("no Last Stand on a floor (?laststand=1 forces one elsewhere); leaving before your 2nd move is free and keeps the floor", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.addInitScript(() => {
    const w = window as any;
    w.__kinds = [];
    setInterval(() => {
      const k = w.match?.phase?.kind;
      if (k && w.__kinds[w.__kinds.length - 1] !== k) w.__kinds.push(k);
    }, 50);
  });
  await page.goto("/tower?debug&pace=quick&laststand=1");
  await towerScreen(page);
  await page.getByRole("button", { name: "START A RUN" }).click();
  await playAMove(page);
  await expect.poll(async () => (await phase(page)) === "play" && (await moves(page)) === 1, { timeout: 90_000 }).toBe(true);
  // (Alone, a Last Stand is the one reveal: none came.)
  const kinds: string[] = await page.evaluate(() => (window as any).__kinds);
  expect(kinds).not.toContain("reveal");
  expect(await page.evaluate(() => (window as any).match.boss.lastStand)).toBeNull();
  // One move made: Leave is free (the confirm says so), back to the tower, the same floor waiting.
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("button", { name: "Leave the match" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("free before your 2nd move");
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click();
  await towerScreen(page);
  await expect(page.getByRole("button", { name: "CONTINUE FLOOR 1" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Your run" })).toContainText("saved");
});

test("a shared floor (audit 2, finding 1): every boss drawn from his own part: Sawyer's cut on Ginger's turn, its banner and words Sawyer's, the move list naming each boss", async ({ page }, info) => {
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
  await page.goto("/tower?debug&pace=quick&power=cuts");
  await towerScreen(page);
  // A run on floor 2, Ginger then Sawyer (the deal set in the local database: a floor of two from the server's own deal is random).
  // (From the page, as the app asks: its own session.)
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "hc_session"), { timeout: 20_000 }).toBe(true);
  const made = await page.evaluate(async () => {
    const run = await fetch("/api/tower/run", { method: "POST", body: "{}", credentials: "same-origin", headers: { "content-type": "application/json" } });
    const me = await (await fetch("/api/me", { credentials: "same-origin" })).json();
    return { ok: run.ok, user: me.user.id as string };
  });
  expect(made.ok).toBe(true);
  const user = made.user;
  await localSql(page, "UPDATE tower_runs SET floor = 2, met = ? WHERE user_id = ? AND status = 'open'", JSON.stringify({ floors: [["moo"], ["gingerbread", "sawyer"]], deck: [], decks: 1 }), user);
  await page.reload();
  await towerScreen(page);
  await page.getByRole("button", { name: "CONTINUE FLOOR 2" }).click();
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
  await page.screenshot({ path: info.outputPath(`shared-floor-${info.project.name}.png`) });
});
