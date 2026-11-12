import { devices, expect, type Page } from "@playwright/test";
import { MATCHMAKING } from "@chessroyale/core";
import { named, test, watchFor, openBossRaid, pickMode, leaveQueue } from "./helpers.ts";

/**
 * Matchmaking types (DECISIONS.md, "Matchmaking types"): Default (bots after the fill time; 8 s locally), Bots off
 * (people only, until full; one tap switches to Default keeping your place) and Solo (you and bots, the seats fill
 * fast). Fewer than 30% real players (30 of 100), or Solo: unranked, said in words. Opening the app from scratch during a live match puts
 * you back in it, unless you left on purpose.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const code = (p: Page) => p.evaluate(() => (window as any).match?.code as string | undefined).catch(() => undefined);
const seats = (p: Page) => p.evaluate(() => (window as any).match?.players.length ?? 0).catch(() => 0);
const path = (p: Page) => new URL(p.url()).pathname;
/**
 * A queue of this test's own, for this run only (a Bots off lobby keeps waiting after a test, so a fixed name would
 * meet an earlier run's). The server takes up to 24 characters.
 */
const run = Date.now().toString(36).slice(-5);
const pool = (name: string) => `${name}-${test.info().project.name[0]}${run}`;

test("home (Nov 9): Solo queue, Party and Bots, each a title and a sub line; the line above PLAY says what each does; Party greyed (soon); Bots asks the bot level and starts", async ({ page }) => {
  await named(page, "Typer");
  await page.goto("/?debug");
  await pickMode(page, "50 v 50");
  const types = page.getByRole("radiogroup", { name: "Matchmaking" });
  await expect(types.getByRole("radio")).toHaveCount(3);
  await expect(types.getByRole("radio")).toHaveText(["Solo queuejoin a lobby", "PartySoon", "Bots99 bots, now"]);
  await expect(types.getByRole("radio", { name: /^Solo queue/ })).toHaveAttribute("aria-checked", "true");
  // Solo queue: bots after the server's fill time (8 s on the test server), said by the line above PLAY.
  await expect(page.locator(".fd-hint")).toHaveText(/^(Starts within 8 s; bots fill any empty seats|Usually about \d+ s to find a match)$/);
  await expect(page.getByRole("button", { name: "About matchmaking" })).toHaveCount(0);
  // Party (queueing together into the public matchmaking, Eric, Nov 9): greyed until it's built; a tap does nothing.
  await expect(types.getByRole("radio", { name: /^Party/ })).toBeDisabled();
  await types.getByRole("radio", { name: /^Party/ }).click({ force: true });
  await expect(types.getByRole("radio", { name: /^Solo queue/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Remembered on this device (the way of being matched; the mode is picked again after a reload, Eric, Oct 18).
  await types.getByRole("radio", { name: /^Bots/ }).click();
  await page.reload();
  await pickMode(page, "50 v 50");
  await expect(page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio", { name: /^Bots/ })).toHaveAttribute("aria-checked", "true");
  // Big enough to tap, and nothing wider than the screen.
  for (const r of await page.getByRole("radiogroup", { name: "Matchmaking" }).getByRole("radio").all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);

  // Bots: the Bot level box (Eric, Nov 9): OK greyed until a level is picked; ✕ cancels and nothing starts.
  await expect(page.locator(".fd-hint")).toHaveText("Start at once with 99 bots");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  const box = page.getByRole("dialog", { name: "Bot level" });
  await expect(box.getByRole("radio")).toHaveText([/^My level\d+$/, "Very easy700", /^Easy(900|950|1000)$/, /^Medium(1100|1150|1200)$/, /^Hard1[45]\d0$/, /^Very hard1[89]\d0$/, "RandomMixed"]);
  await expect(box.getByRole("button", { name: "OK", exact: true })).toBeDisabled();
  await box.getByRole("button", { name: "Close" }).click();
  await expect(box).toHaveCount(0);
  await expect(page.locator(".fd-seats")).toHaveCount(0);
  // Tapping the dim cancels too.
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await box.getByRole("radio", { name: /^Hard/ }).click();
  await expect(box.getByRole("button", { name: "OK", exact: true })).toBeEnabled();
  await page.mouse.click(5, 5);
  await expect(box).toHaveCount(0);
  // (Not remembered until OK: the next box opens with nothing picked.)
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(box.getByRole("button", { name: "OK", exact: true })).toBeDisabled();
  await box.getByRole("radio", { name: /^Very easy/ }).click();

  // OK: the queue screen, your bots fill the 100 seats in a couple of seconds, then the match begins, the bots at Very easy.
  // (Timed in the page, as it happens: when the queue screen is put in the page and when its count first reads 100.)
  await page.evaluate(() => {
    const w = window as any;
    const t = (w.__fill = { ok: performance.now(), seats: 0, full: 0 });
    new MutationObserver(() => {
      if (!t.seats && document.querySelector(".fd-seats")) t.seats = performance.now();
      if (!t.full && document.querySelector(".fd-count-n")?.textContent === "100") t.full = performance.now();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await box.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.locator(".fd-seats")).toBeVisible();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Solo");
  await expect(page.locator(".fd-queue-rank")).toHaveText("Unranked: solo games don't count for ranking");
  // Full at 100 over the fill's time (MATCHMAKING.soloFillMs, 2.2 s), give or take a busy frame, then the match starts. Timed from the
  // queue screen, not the OK tap: before it, the match's code, the opening library and the engines load (0.8 to 1 s locally with the
  // CPU slowed 4x, about 3 s on CI's busiest runners: matchmaking:22 took 5,289 and 5,727 ms against a 5 s budget from the tap, the
  // fill itself on time), which is the machine, not the queue: that part only has to come.
  await expect.poll(() => page.evaluate(() => (window as any).__fill.full > 0), { timeout: 15_000 }).toBe(true);
  const fill = (await page.evaluate(() => (window as any).__fill)) as { ok: number; seats: number; full: number };
  expect(fill.seats - fill.ok, "the queue screen comes within 10 s of OK").toBeLessThan(10_000);
  expect(fill.full - fill.seats, "the seats fill over the fill's time").toBeLessThan(MATCHMAKING.soloFillMs + 1_000);
  await expect.poll(() => phase(page), { timeout: 10_000 }).toBe("vote");
  // (Its bots are the match's: the same 99.)
  expect(await page.evaluate(() => (window as any).match.standings().length)).toBe(100);
  // (At the level picked, which this device keeps for the next box.)
  expect(await page.evaluate(() => (window as any).match.settings.botLevel)).toBe(700);
  expect(await page.evaluate(() => localStorage.getItem("hunchess.botLevel"))).toBe("very-easy");
});

// (Bots off has no button on home since Nov 9: this device's stored "botsoff", as a test's, still queues people only.)
test("Bots off: people only, it waits; one tap switches to Default, keeping your place; then bots fill: Unranked", { tag: "@phone-only" }, async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  await named(page, "Patient");
  const q = pool("mm-off");
  await page.addInitScript(() => localStorage.setItem("brc.matchmaking", "botsoff"));
  await page.goto(`/?debug&pool=${q}`);
  await pickMode(page);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50 · Bots off");
  await expect(page.locator(".fd-queue-line")).toContainText("No bots");
  const first = (await code(page))!;
  const openedAt = Date.now();
  // Someone else with Bots off: the same lobby.
  const other = await (await browser.newContext()).newPage();
  await named(other, "Also patient");
  await other.addInitScript(() => localStorage.setItem("brc.matchmaking", "botsoff"));
  await other.goto(`/?debug&pool=${q}`);
  await pickMode(other);
  await other.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => code(other)).toBe(first);
  await expect(page.locator(".fd-count-n")).toHaveText("2");
  // Past the fill time (8 s here, MATCH_FILL_SECONDS in playwright.config.ts) since the lobby opened: still waiting, no bots.
  // (What's left of it, 2 s over: the second player's join took some of it already.)
  await page.waitForTimeout(Math.max(0, openedAt + 10_000 - Date.now()));
  expect(await phase(page)).toBe("lobby");
  expect(await seats(page)).toBe(2);
  // Someone with Default meanwhile gets a lobby of their own (never this one).
  const def = await (await browser.newContext()).newPage();
  await def.goto(`/?debug&pool=${q}`);
  await pickMode(def);
  await def.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect.poll(() => code(def)).toBeTruthy();
  expect(await code(def)).not.toBe(first);
  await def.close();

  // One tap: Default, your place kept (you've waited more than a minute's worth here, so the bots come in moments).
  await page.getByRole("button", { name: /Switch to Default/ }).click();
  await expect.poll(() => code(page)).not.toBe(first);
  await expect(page.locator(".fd-queue-mode")).toHaveText("Crowd · 50 v 50");
  await expect(page.locator(".fd-seat.you")).toHaveCount(1);
  // The bots fill in, and it says this one won't count.
  await expect(page.locator(".fd-count-n")).toHaveText("100", { timeout: 15_000 });
  await expect(page.locator(".fd-queue-rank")).toHaveText("Unranked: fewer than 30 real players");
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("vote");
  // The other one is still waiting, people only, in their lobby.
  await expect(other.locator(".fd-count-n")).toHaveText("1");
  expect(await phase(other)).toBe("lobby");
});

test("Boss raid: its screen has the three types too (and Boss alone); a Solo raid is you and 49 bots against a boss, and its results say nothing of ranking", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "phone", "one run is enough");
  await page.goto("/?debug&pace=quick&clock=20&bossMoves=1");
  await openBossRaid(page);
  // Each way of being matched is a choice of its own, with its line.
  // (The public queues are always a random boss: the Boss raid screen's pick is for the rest. boss-select.spec.ts.)
  await expect(page.getByRole("button", { name: /^Join a Boss Battle/ })).toContainText(/Random boss · up to 50 players · bots after \d+ s/);
  await expect(page.getByRole("button", { name: /^People only/ })).toContainText("Random boss · no bots · starts at 50, or 10 after 8 s");
  await expect(page.getByRole("button", { name: /^Play with bots/ })).toContainText("You and 49 bots · starts at once");
  // Boss alone is still here (you against a boss you pick).
  await expect(page.getByRole("main").getByRole("button", { name: /^Boss alone/ })).toBeVisible();
  // The full count is on screen for only MATCHMAKING.soloHoldMs (0.9 s) before the match begins: less than the gap
  // between two of Playwright's looks (1 s), so it's watched for from before PLAY (.claude/LESSONS.md, "A melt the test
  // blinked through").
  const full = await watchFor(page, { fifty: { selector: ".fd-count-n", text: /^50$/ } });
  await page.getByRole("button", { name: /^Play with bots/ }).click();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Boss Battle · Solo");
  await expect.poll(async () => (await full.seen()).fifty, { timeout: 6_000 }).toBe(true);
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).match.runner.state.players.filter((p: any) => p.isBot).length)).toBe(49);
  // A boss with a crowd strikes (every boss but the Hidden Boss): its card counts down to it, and the intro says so.
  await expect(page.locator(".boss-next")).toHaveText(/^Strikes (in \d+ moves|after this move)$/);
  await expect(page.locator(".boss-dock-status")).toContainText("Worst mover struck every 3 moves.");
  // Play it out (the engine's move each time).
  const stopAt = Date.now() + 5 * 60_000;
  while (Date.now() < stopAt && (await phase(page)) !== "results") {
    if ((await phase(page)) === "play") {
      await page
        .evaluate(async () => {
          const m = (window as any).match;
          if (m.phase.kind !== "play" || Date.now() < m.phase.startsAt) return;
          const fen = m.phase.board.fen;
          const [top] = await m.runner.topMovesFor(fen);
          if (m.phase.kind === "play" && m.phase.board.fen === fen) m.submit(top.move);
        })
        .catch(() => undefined);
    }
    await page.waitForTimeout(300);
  }
  expect(await phase(page)).toBe("results");
  // (Nov 8, Eric: no solo "Unranked" line on a boss battle's results; it says nothing of ranking.)
  await expect(page.locator(".results-unranked")).toHaveCount(0);
});

test("opening the app from scratch during a live match puts you back in it; leaving on purpose doesn't", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  // (One device, its storage shared by every page: the app closed and opened again.)
  const ctx = await browser.newContext(test.info().project.name === "phone" ? ({ ...devices["iPhone 13"], browserName: undefined } as any) : {});
  const q = pool("mm-rejoin");
  const first = await ctx.newPage();
  await named(first, "Comeback");
  await first.goto(`/?debug&pool=${q}`);
  await pickMode(first);
  await first.getByRole("button", { name: "PLAY", exact: true }).click();
  // Bots fill at 8 s here, then the votes begin: a live match.
  await expect.poll(() => phase(first), { timeout: 30_000 }).toBe("vote");
  const live = (await code(first))!;
  // The app is closed, then opened again from its icon (at /).
  await first.close();
  const again = await ctx.newPage();
  await again.goto("/?debug");
  await expect.poll(() => code(again), { timeout: 20_000 }).toBe(live);
  await expect.poll(() => phase(again), { timeout: 20_000 }).toMatch(/^(vote|play|watching|scoring|reveal|opening)$/);
  expect(path(again)).toBe(`/lobby/${live}`);

  // Leaving on purpose: out of a queue (Exit, not kept in it: Nov 10), then the app opened again: home. (Another device, seated nowhere else.)
  const ctx2 = await browser.newContext(test.info().project.name === "phone" ? ({ ...devices["iPhone 13"], browserName: undefined } as any) : {});
  const third = await ctx2.newPage();
  await third.goto(`/?debug&pool=${q}-2`);
  await pickMode(third);
  await third.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(third.locator(".fd-seats")).toBeVisible();
  await leaveQueue(third);
  await expect(third.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await third.close();
  const fourth = await ctx2.newPage();
  await fourth.goto("/?debug");
  await expect(fourth.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await fourth.waitForTimeout(1500);
  expect(path(fourth)).toBe("/");
  expect(await phase(fourth)).toBe("none");
});
