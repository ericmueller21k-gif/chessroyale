import { expect, type Page } from "@playwright/test";
import { RANKED_1V1, rankView } from "@chessroyale/core";
import { named, openBossRaid, switchesOff, test, watchFor, pickMode } from "./helpers.ts";

/**
 * Home's RANKED row and the Boss raid's own card and screen (Eric, Oct 16;
 * docs/decisions/2026-10-16-home-ranked-row-and-boss-raid.md): the row's three ranked modes, 1 v 1's queue, the card
 * opening the Boss raid screen and each of its choices reaching the flow it always had, and the hidden /bosses.
 */

const desktop = () => test.info().project.name === "desktop";
const run = Date.now().toString(36).slice(-5);
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const box = async (p: Page, sel: string) => (await p.locator(sel).first().boundingBox())!;

test("the RANKED row: a label over 50 v 50, 1 v 1 and Squads, three equal buttons whole at every width; PLAY under it, then Chess Town's button, PLAY's size, then Other modes (a phone and a computer alike)", async ({ page }) => {
  await named(page, "Ranked");
  const widths = desktop() ? [[1280, 800], [1024, 768]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of widths) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/");
    const row = page.getByRole("radiogroup", { name: "RANKED" });
    await expect(row).toBeVisible();
    // Every text, exactly.
    await expect(page.locator(".fd-ranked .fd-label")).toHaveText("RANKED");
    await expect(row.getByRole("radio")).toHaveText(["50 v 50Crowd chess", "1 v 1Classic chess", "Squads8 squads of 4"]);
    const card = page.getByRole("main").getByRole("button", { name: "Chess Town", exact: true });
    await expect(card).toHaveText("Chess Town");
    // The label sits right above the row; the three buttons are the same size, side by side, their words whole.
    const label = await box(page, ".fd-ranked .fd-label");
    const r = (await row.boundingBox())!;
    expect(label.y + label.height, `${w}`).toBeLessThanOrEqual(r.y + 1);
    expect(r.y - (label.y + label.height), `${w}`).toBeLessThan(12);
    // (Centered over the three buttons, Oct 24: the label's own text, its middle over the row's.)
    const labelMid = await page.locator(".fd-ranked .fd-label").evaluate((e) => {
      const range = document.createRange();
      range.selectNodeContents(e);
      const b = range.getBoundingClientRect();
      return b.x + b.width / 2;
    });
    expect(Math.abs(labelMid - (r.x + r.width / 2)), `${w}: RANKED centered over the row`).toBeLessThan(2);
    const buttons = await row.getByRole("radio").evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect();
        const sub = e.querySelector("span")!;
        return { x: b.x, w: b.width, h: b.height, spill: e.scrollWidth - e.clientWidth, subSpill: sub.scrollWidth - sub.clientWidth, font: parseFloat(getComputedStyle(sub).fontSize), lines: Math.round(e.scrollHeight / parseFloat(getComputedStyle(e).lineHeight)) };
      }),
    );
    for (const b of buttons) {
      expect(Math.abs(b.w - buttons[0]!.w), `${w}: equal widths`).toBeLessThan(1);
      expect(b.h, `${w}: a full tap target`).toBeGreaterThanOrEqual(44);
      expect(b.spill, `${w}: nothing cut`).toBeLessThanOrEqual(0);
      expect(b.subSpill, `${w}: the line under it whole`).toBeLessThanOrEqual(0);
      expect(b.font).toBeGreaterThanOrEqual(11);
    }
    expect(buttons.map((b) => b.x)).toEqual([...buttons.map((b) => b.x)].sort((a, b) => a - b));
    // Chess Town's button is PLAY's size exactly (Eric, Nov 1): the column's full width, as tall as PLAY, its words whole.
    const c = (await card.boundingBox())!;
    const play = (await page.getByRole("button", { name: "PLAY", exact: true }).boundingBox())!;
    expect(Math.abs(c.height - play.height), `${w}: Chess Town as tall as PLAY`).toBeLessThan(0.5);
    expect(Math.abs(c.width - play.width), `${w}: Chess Town as wide as PLAY`).toBeLessThan(0.5);
    expect(Math.abs(c.width - r.width), `${w}: full width`).toBeLessThan(2);
    // (Whole in the page's own font: while Archivo is loading, the fallback font's wider words can run past their box.)
    await page.evaluate(() => document.fonts.ready);
    expect(await card.locator(".fd-town-label").evaluate((e) => e.scrollWidth <= e.clientWidth + 0.5 && e.getBoundingClientRect().width <= e.closest("button")!.clientWidth), `${w}`).toBe(true);
    // The row, then PLAY, then Chess Town, then "Other modes" and its cards (Eric, Oct 19: chess first; Nov 1: Chess Town's
    // button under PLAY, the old Boss Arena card gone), on a phone and a computer alike.
    expect(play.y, `${w}`).toBeGreaterThan(r.y + r.height);
    expect(c.y, `${w}: Chess Town under PLAY`).toBeGreaterThanOrEqual(play.y + play.height);
    const other = await box(page, ".fd-other-label");
    expect(other.y, `${w}: Other modes under Chess Town`).toBeGreaterThanOrEqual(c.y + c.height);
    const solo = await box(page, ".rd-card");
    expect(solo.y, `${w}: the cards under Other modes`).toBeGreaterThanOrEqual(other.y + other.height);
    expect(await sideways(page), `${w}`).toBe(0);
  }
});

test("1 v 1: picked, your rank and what it is in the panel under the row, kept until the app reloads; PLAY queues at once (/1v1)", async ({ page }) => {
  await named(page, "Duel");
  await page.goto(`/?pool=home1v1-${test.info().project.name}-${run}`);
  await page.getByRole("radio", { name: /^1 v 1/ }).click();
  await expect(page.getByRole("radio", { name: /^1 v 1/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Matchmaking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Party/ })).toHaveCount(0);
  // Your rank (the server's: a new account is in its placements) and what 1 v 1 is, in the panel under the row.
  await expect(page.locator(".fd-mode-panel")).toHaveText(/^Your rank: Placement 0\/5Chess vs one player near your level$/);
  await expect(page.locator(".fd-hint")).toHaveText("");
  const row = (await page.getByRole("radiogroup", { name: "RANKED" }).boundingBox())!;
  const rank = (await page.locator(".fd-rank1v1").boundingBox())!;
  const play = (await page.getByRole("button", { name: "PLAY", exact: true }).boundingBox())!;
  expect(rank.y).toBeGreaterThanOrEqual(row.y + row.height);
  expect(rank.y + rank.height).toBeLessThanOrEqual(play.y);
  // (A reload is the app opening again: nothing picked, Eric, Oct 18.)
  await page.reload();
  await expect(page.getByRole("radio", { name: /^1 v 1/ })).toHaveAttribute("aria-checked", "false");
  await pickMode(page, "1 v 1");
  expect(await sideways(page)).toBe(0);
  // PLAY: the 1 v 1 queue at once (startRanked1v1), its address /1v1; Cancel is home.
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".dv-st-finding")).toContainText("Finding opponent");
  expect(new URL(page.url()).pathname).toBe("/1v1");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("radio", { name: /^1 v 1/ })).toHaveAttribute("aria-checked", "true");
});

test("1 v 1's rank line at its widest (a top tier with four-digit points, its emblem beside it) stays one whole line from 320 px", async ({ page }) => {
  test.skip(desktop(), "the phone's widths");
  await named(page, "Apex");
  await page.route("**/api/me*", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const rank = rankView({ games: 40, ladder: RANKED_1V1.topFloor + 1234, place: 1 });
    if (body?.user) body.ranked1v1 = { ...(body.ranked1v1 ?? {}), rank };
    await route.fulfill({ response: res, json: body });
  });
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/?mode=1v1");
    const line = page.locator(".fd-rank1v1");
    await expect(line).toHaveText("Your rank: Transcendent · 1234 RP");
    await expect(page.locator(".fd-rank-words .re-box")).toHaveAttribute("data-emblem", "transcendent");
    expect(await line.evaluate((e) => e.scrollWidth - e.clientWidth), `${width}`).toBeLessThanOrEqual(0);
    expect((await line.boundingBox())!.height, `${width}: one line`).toBeLessThan(26);
    expect(await sideways(page), `${width}`).toBe(0);
  }
});

test("the Boss raid screen (?mode=raid, every choice): each choice reaches its flow (a raid's queue, people only, a Solo raid, Boss alone's menu, a raid with friends); Back is home", async ({ page }) => {
  // (Its character select, the tiles and the stage: boss-select.spec.ts. Home's Boss Battle card opens the solo form:
  // home-layout.spec.ts.)
  test.setTimeout(2 * 60_000);
  await named(page, "Raider");
  const home = `/?debug&pool=raidscreen-${test.info().project.name}-${run}`;
  await page.goto(home);
  await openBossRaid(page);
  const main = page.getByRole("main");
  // The choices, in order, every word.
  await expect(main.locator(".rd-option")).toHaveText([
    /^Join a raidRandom boss · up to 50 players · bots after \d+ s$/,
    /^People onlyRandom boss · no bots · starts at 50, or 10 after \d+ s$/,
    "Raid with botsYou and 49 bots · starts at once",
    "Boss aloneJust you vs a random boss",
    "Play with friendsMake a raid and share its code, or join one",
  ]);
  await expect(main.locator(".rd-about")).toHaveText("Up to 50 of you pick the crowd's moves together against a boss. The most popular pick is played.");
  await expect(main.locator(".bs-tile canvas.bs-art").first()).toBeVisible();
  for (const b of await main.locator(".rd-option").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await sideways(page)).toBe(0);

  // Join a raid: the raid's queue (Default); Cancel comes back to this screen.
  await main.getByRole("button", { name: /^Join a raid/ }).click();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Boss raid · up to 50");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  // People only: the raid's queue without bots.
  await main.getByRole("button", { name: /^People only/ }).click();
  await expect(page.locator(".fd-queue-mode")).toHaveText("Boss raid · up to 50 · Bots off");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  // Boss alone: its menu, the difficulty and the boss picked on the tiles (here "?": a random one).
  await main.getByRole("button", { name: /^Boss alone/ }).click();
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  await expect(menu.locator(".boss-row")).toHaveCount(1);
  await expect(menu.getByRole("button", { name: /Random boss/ })).toBeVisible();
  await expect(menu.getByText(/^Your rating/)).toBeVisible();
  await menu.getByRole("button", { name: "Close" }).click();
  // Play with friends: a raid's lobby (and joining one by code).
  await main.getByRole("button", { name: /^Play with friends/ }).click();
  const sheet = page.getByRole("dialog", { name: "Play with friends" });
  await expect(sheet.getByRole("button", { name: "Create a raid" })).toBeVisible();
  await expect(sheet.getByLabel("Lobby code")).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  // Back: home, the RANKED row.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "RANKED" })).toBeVisible();
  // Raid with bots: you and 49 bots, in your browser (Solo), against a boss. (Its queue shows for a moment only:
  // watched for from before the tap.)
  await openBossRaid(page);
  const solo = await watchFor(page, { queue: { selector: ".fd-queue-mode", text: /^Boss raid · up to 50 · Solo$/ } });
  await main.getByRole("button", { name: /^Raid with bots/ }).click();
  await expect.poll(async () => (await solo.seen()).queue, { timeout: 30_000 }).toBe(true);
});

test("the hidden /bosses opens the solo boss picker straight away (a player too); ?mode=raid opens the Boss raid screen", async ({ page }) => {
  await named(page, "Hidden");
  await page.goto("/bosses");
  const menu = page.getByRole("dialog", { name: "Choose your boss" });
  await expect(menu).toBeVisible();
  // The solo picker: its difficulty, not a raid's.
  await expect(menu.getByText(/^For your raid/)).toHaveCount(0);
  await expect(menu.locator(".boss-row")).toHaveCount(15);
  await menu.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await page.goto("/?mode=raid");
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "RANKED" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("Other modes under Chess Town: the label, then Boss Battle (the rotating boss faces) and Auto chess (the army picture) side by side at half width each, the card's look; Auto chess opens /autochess, and its back button is home", async ({ page }) => {
  await named(page, "Knight");
  await page.goto("/");
  const main = page.getByRole("main");
  const label = main.getByRole("heading", { name: "Other modes", exact: true });
  const town = main.getByRole("button", { name: "Chess Town", exact: true });
  const solo = main.getByRole("button", { name: /^Boss Battle/ });
  const auto = main.getByRole("button", { name: /^Auto chess/ });
  await expect(label).toBeVisible();
  await expect(auto).toHaveText(/^Auto chessBuild an army$/);
  // Auto chess's picture is the drawn army (a canvas at its own size, with pixels on it), no longer the board's knight.
  await expect(auto.locator("svg.fd-knight")).toHaveCount(0);
  const army = auto.locator(".rd-face canvas");
  await expect(army).toBeVisible();
  expect(await army.evaluate((c: HTMLCanvasElement) => c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0)), "the army is drawn").toBe(true);
  // Boss Battle's picture is the rotating boss faces (from the old Boss Arena card), no longer the crown.
  await expect(solo.locator(".rd-face .rd-face-stack")).toHaveCount(1);
  await expect(solo.locator("svg.fd-crown")).toHaveCount(0);
  const at = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!;
  const play = await at(main.getByRole("button", { name: "PLAY", exact: true }));
  const [l, t, s, a] = [await at(label), await at(town), await at(solo), await at(auto)];
  expect(t.y, "Chess Town under PLAY").toBeGreaterThanOrEqual(play.y + play.height);
  expect(l.y, "Other modes under Chess Town").toBeGreaterThanOrEqual(t.y + t.height);
  expect(s.y, "the cards under Other modes").toBeGreaterThanOrEqual(l.y + l.height);
  // (Eric, Oct 26: Boss Battle and Auto chess sit side by side, half width each, the same size; the pair is as wide as Chess Town's
  // button, PLAY's width.)
  expect(Math.abs(t.width - (a.x + a.width - s.x)), "Chess Town as wide as the pair").toBeLessThan(2);
  expect(Math.abs(s.width - a.width), "the two half cards the same width").toBeLessThan(2);
  expect(Math.abs(s.height - a.height), "the two half cards the same height").toBeLessThan(2);
  expect(Math.abs(s.y - a.y), "the two half cards side by side").toBeLessThan(2);
  expect(s.x + s.width, "Boss Battle left of Auto chess").toBeLessThanOrEqual(a.x + 1);
  await auto.click();
  await expect(page.locator(".ac-title strong")).toHaveText("Auto chess");
  expect(new URL(page.url()).pathname).toBe("/autochess");
  await page.getByRole("button", { name: "Back to home" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});

test("home keeps still: no click on a mode or an option moves or resizes the board preview, the line above PLAY, PLAY, Chess Town's button, the panel or the cards (phone and computer)", async ({ page }) => {
  // (Eric, Oct 18: "nothing should actually be forced moving around the size of the board or where the play button
  // is"; docs/decisions/2026-10-18-home-steady-layout.md.)
  await named(page, "Still");
  const sizes = desktop() ? [[1280, 800], [1440, 900], [1920, 1080]] : [[390, 844], [320, 640]];
  const radio = (name: RegExp) => page.getByRole("radio", { name });
  const steps: [string, () => Promise<unknown>][] = [
    ["Default", () => radio(/^Default/).click()],
    ["Bots off", () => radio(/^Bots off/).click()],
    ["Solo", () => radio(/^Solo$/).click()],
    ["Default again", () => radio(/^Default/).click()],
    ["1 v 1", () => radio(/^1 v 1/).click()],
    ["Squads", () => radio(/^Squads/).click()],
    ["Party", async () => {
      await radio(/^Party/).click();
      await expect(page.getByRole("dialog", { name: "Squads party" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }],
    ["Solo queue", () => radio(/^Solo queue/).click()],
    ["50 v 50", () => radio(/^50 v 50/).click()],
  ];
  // (The panel last: what moves is checked before what's new.)
  const parts = { board: ".fd-livewin", ranked: ".fd-ranked", hint: ".fd-hint", play: ".fd-play", town: ".fd-town", boss: ".rd-card", panel: ".fd-mode-panel" };
  const measure = async () => {
    const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const [k, s] of Object.entries(parts)) if ((k !== "board" || desktop()) && (await page.locator(s).count())) out[k] = await box(page, s);
    return out;
  };
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/");
    await expect(radio(/^50 v 50/)).toHaveAttribute("aria-checked", "false");
    // (The live window's board: on screen at these computer sizes, a real square. Waited for: the window can still be
    // settling as the page loads, a live match from the home's live poll replacing the recording, and a board not yet
    // laid out has no box: boundingBox's null, which read as a TypeError in a shard where another spec's match was live.)
    if (desktop()) {
      await expect(page.locator(".fd-livewin-sq").first()).toBeVisible();
      expect((await box(page, ".fd-livewin-sq")).width, `${w}`).toBeGreaterThan(150);
    }
    // The panel is there from the first view, greyed (Eric, Oct 25). The first pick wakes it and moves nothing: the RANKED
    // row, PLAY, the cards, the panel and the board stay where they were.
    const before = await measure();
    expect(before.panel, `${w}: the panel is there before a pick`).toBeDefined();
    await radio(/^50 v 50/).click();
    const first = await measure();
    for (const k of Object.keys(before)) for (const d of ["x", "y", "width", "height"] as const) expect(Math.abs(first[k]![d] - before[k]![d]), `${w}×${h}, the first pick: ${k}'s ${d}`).toBeLessThanOrEqual(1);
    for (const [step, act] of steps) {
      await act();
      const now: Awaited<ReturnType<typeof measure>> = {};
      for (const [k, sel] of Object.entries(parts)) {
        if (!(k in first)) continue;
        now[k] = await box(page, sel);
        for (const d of ["x", "y", "width", "height"] as const) expect(Math.abs(now[k]![d] - first[k]![d]), `${w}×${h}, after ${step}: ${k}'s ${d}`).toBeLessThanOrEqual(1);
      }
      // What the panel holds, every box in it, fits inside it. (Squads' choices once hung out of its foot while their own box
      // fitted: Eric's phone, Oct 18.)
      const spill = await page.evaluate(() => {
        const e = document.querySelector(".fd-mode-panel");
        if (!e) return 0;
        const p = e.getBoundingClientRect();
        const boxes = [...e.querySelectorAll("*")].map((c) => c.getBoundingClientRect());
        return Math.max(0, ...boxes.map((c) => Math.max(c.bottom - p.bottom, p.top - c.top, c.right - p.right, p.left - c.left)));
      });
      expect(spill, `${w}×${h}, after ${step}: inside the panel`).toBeLessThanOrEqual(0.5);
      // The line above PLAY fits its fixed room (one line on a computer, two on a phone), whatever it says.
      expect(await page.locator(".fd-hint").evaluate((e) => e.scrollHeight - e.clientHeight), `${w}×${h}, after ${step}: the line above PLAY`).toBeLessThanOrEqual(1);
    }
    // (The panel: there all along.)
    expect(Object.keys(first), `${w}`).toContain("panel");
    expect(await sideways(page), `${w}`).toBe(0);
  }
});

// Changing this test needs Eric's OK (docs/rules/eric.md).
test("Eric's rule (Oct 18, Oct 25): home's options panel is always there, greyed until a mode is picked, and home never moves", async ({ page }) => {
  // (Oct 25, Eric: "the menu buttons should never be like invisible… they're just not selectable until you select the
  // mode"; Oct 18: "nothing should… move around… where the play button is." docs/decisions/2026-10-25-home-panel-back.md.)
  await named(page, "Rule");
  const sizes: [number, number][] = [
    [1280, 800],
    [1440, 900],
    [390, 844],
    [360, 640],
    [320, 568],
  ];
  const ranked = page.getByRole("radiogroup", { name: "RANKED" });
  const matchmaking = page.getByRole("radiogroup", { name: "Matchmaking" });
  const play = page.getByRole("button", { name: "PLAY", exact: true });
  const options = [/^Default/, /^Bots off/, /^Solo$/];
  const parts: Record<string, string> = { board: ".fd-livewin", hint: ".fd-hint", play: ".fd-play", label: ".fd-other-label", boss: ".rd-card", auto: ".fd-auto-card", panel: ".fd-mode-panel" };
  const measure = async () => {
    const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const [k, s] of Object.entries(parts)) if (await page.locator(s).count()) out[k] = await box(page, s);
    return out;
  };
  const same = (a: Awaited<ReturnType<typeof measure>>, b: Awaited<ReturnType<typeof measure>>, where: string) => {
    expect(Object.keys(b).sort(), `${where}: the same boxes are there`).toEqual(Object.keys(a).sort());
    for (const k of Object.keys(a)) for (const d of ["x", "y", "width", "height"] as const) expect(Math.abs(b[k]![d] - a[k]![d]), `${where}: ${k}'s ${d}`).toBeLessThanOrEqual(1);
  };
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await expect(play).toBeVisible();
    // (The computer's live window: on screen at these sizes, waited for as in the keeps-still test.)
    if (desktop() && w >= 1280) await expect(page.locator(".fd-livewin-sq").first()).toBeVisible();
    // First view: the panel is there, greyed, its options shown, none selected and none tappable.
    await expect(page.locator(".fd-mode-panel.idle"), `${w}×${h}: the panel in the first view`).toBeVisible();
    for (const name of options) {
      const option = matchmaking.getByRole("radio", { name });
      await expect(option, `${w}×${h}: ${name} shown`).toBeVisible();
      await expect(option, `${w}×${h}: ${name} not tappable`).toBeDisabled();
      await expect(option, `${w}×${h}: ${name} not selected`).toHaveAttribute("aria-checked", "false");
    }
    await expect(matchmaking.getByRole("radio", { checked: true }), `${w}×${h}: nothing in the options row selected`).toHaveCount(0);
    await expect(page.locator(".fd-mode-panel .on"), `${w}×${h}: no selected look in the panel`).toHaveCount(0);
    const before = await measure();
    expect(before.panel, `${w}×${h}: the panel has its box`).toBeDefined();
    // Tapping one does nothing: a forced tap reaches the handler, which ignores it.
    for (const name of options) await matchmaking.getByRole("radio", { name }).click({ force: true });
    await expect(matchmaking.getByRole("radio", { checked: true }), `${w}×${h}: still nothing selected`).toHaveCount(0);
    await expect(page.locator(".fd-mode-panel.idle")).toBeVisible();
    await expect(play).toBeDisabled();
    same(before, await measure(), `${w}×${h}, after the taps on the greyed options`);
    // The first pick wakes the options with their usual default selected, and moves nothing: the line above PLAY, PLAY, the
    // label, both cards, the panel and (computer) the board stay put after each mode.
    const steps: [string, () => Promise<unknown>][] = [
      ["50 v 50", () => ranked.getByRole("radio", { name: /^50 v 50/ }).click()],
      ["1 v 1", () => ranked.getByRole("radio", { name: /^1 v 1/ }).click()],
      ["Squads", () => ranked.getByRole("radio", { name: /^Squads/ }).click()],
    ];
    for (const [step, act] of steps) {
      await act();
      if (step === "50 v 50") {
        await expect(matchmaking.getByRole("radio", { name: /^Default/ }), `${w}×${h}: Default selected once a mode is picked`).toHaveAttribute("aria-checked", "true");
        await expect(matchmaking.getByRole("radio", { name: /^Default/ })).toBeEnabled();
        await expect(page.locator(".fd-mode-panel.idle")).toHaveCount(0);
      }
      same(before, await measure(), `${w}×${h}, after ${step}`);
    }
    expect(await sideways(page), `${w}×${h}`).toBe(0);
  }
});

type Rect = { x: number; y: number; width: number; height: number };

test("home, said once (Eric, Oct 28): no ⓘ; the three options are titles only and fill the row; the line above PLAY keeps its box through every pick; the cards' pictures sit left of their words, the cards are shorter and PLAY is taller; home still fits", async ({ page }) => {
  // ("3 times in this screen it says the same thing": docs/decisions/2026-10-28-home-said-once.md.)
  await named(page, "Once");
  const sizes: [number, number, number][] = desktop()
    ? [[1280, 800, 68], [1440, 900, 72], [1280, 680, 56]]
    : [[390, 844, 90], [320, 640, 78]];
  for (const [w, h, playMin] of sizes) {
    const at = `${w}×${h}`;
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    const play = page.getByRole("button", { name: "PLAY", exact: true });
    await expect(play).toBeVisible();
    // (The page's fonts in: a line of text is a pixel taller in the fallback font, and the card above gives it back.)
    await page.evaluate(() => document.fonts.ready);
    // The ⓘ is gone, with its pop-up.
    await expect(page.getByRole("button", { name: "About matchmaking" }), `${at}: no ⓘ`).toHaveCount(0);
    await expect(page.locator(".fd-info-btn, .fd-types-info"), `${at}: no ⓘ`).toHaveCount(0);
    // The line above PLAY: its box is there from the first view, empty with nothing picked, and the same box through every pick.
    const rect = async (sel: string): Promise<Rect> => (await page.locator(sel).first().boundingBox())!;
    // (The computer's live window: on screen, waited for as in the keeps-still test, so the boxes below are the settled ones.)
    if (desktop()) await expect(page.locator(".fd-livewin-sq").first()).toBeVisible();
    const hint0 = await rect(".fd-hint");
    await expect(page.locator(".fd-hint"), `${at}: nothing picked, nothing said`).toHaveText("");
    await pickMode(page, "50 v 50");
    const group = page.getByRole("radiogroup", { name: "Matchmaking" });
    // Titles only, side by side, equal, whole, tappable, and filling the row: the group is as wide as the RANKED row, with the
    // buttons' margins even on both sides.
    await expect(group.getByRole("radio"), `${at}: titles only`).toHaveText(["Default", "Bots off", "Solo"]);
    const g = (await group.boundingBox())!;
    const ranked = await rect(".fd-ranked");
    expect(Math.abs(g.x - ranked.x), `${at}: the group as wide as the RANKED row`).toBeLessThanOrEqual(1);
    expect(Math.abs(g.width - ranked.width), `${at}: the group as wide as the RANKED row`).toBeLessThanOrEqual(1);
    const radios: Rect[] = [];
    for (const r of await group.getByRole("radio").all()) radios.push((await r.boundingBox())!);
    for (const r of radios) {
      expect(r.height, `${at}: a tap target`).toBeGreaterThanOrEqual(44);
      expect(Math.abs(r.width - radios[0]!.width), `${at}: equal widths`).toBeLessThanOrEqual(1);
    }
    expect(radios[0]!.x + radios[0]!.width, `${at}: side by side`).toBeLessThanOrEqual(radios[1]!.x + 0.5);
    expect(radios[1]!.x + radios[1]!.width, `${at}: side by side`).toBeLessThanOrEqual(radios[2]!.x + 0.5);
    const left = radios[0]!.x - g.x;
    const right = g.x + g.width - (radios[2]!.x + radios[2]!.width);
    expect(Math.abs(left - right), `${at}: the buttons fill the row`).toBeLessThanOrEqual(1);
    expect(left, `${at}: the buttons fill the row (their margin is the group's 5 px)`).toBeLessThanOrEqual(6);
    // Every pick says what PLAY does, in the one box above PLAY; nothing is said under PLAY.
    const says: [string, RegExp][] = [
      ["Default", /^(Starts within \d+ s; bots fill any empty seats|Usually about \d+ s to find a match)$/],
      ["Bots off", /^People only: starts when 100 have joined$/],
      ["Solo", /^Solo vs 99 bots · starts at once$/],
    ];
    for (const [pick, line] of says) {
      await group.getByRole("radio", { name: new RegExp(`^${pick}`) }).click();
      await expect(page.locator(".fd-hint"), `${at}: ${pick}`).toHaveText(line);
    }
    await page.getByRole("radio", { name: /^Squads/ }).click();
    await expect(page.locator(".fd-hint"), `${at}: Squads`).toHaveText(/^Solo queue: bots fill any empty seat after \d+ s$/);
    await page.getByRole("radio", { name: /^1 v 1/ }).click();
    await expect(page.locator(".fd-hint"), `${at}: 1 v 1`).toHaveText("");
    await page.getByRole("radio", { name: /^50 v 50/ }).click();
    const hint = await rect(".fd-hint");
    const playBox = (await play.boundingBox())!;
    for (const d of ["x", "y", "width", "height"] as const) expect(Math.abs(hint[d] - hint0[d]), `${at}: the line's ${d} after the picks`).toBeLessThanOrEqual(1);
    expect(hint.y + hint.height, `${at}: the line above PLAY`).toBeLessThanOrEqual(playBox.y);
    expect(playBox.y - (hint.y + hint.height), `${at}: the line just above PLAY`).toBeLessThan(12);
    // (Nov 1: Chess Town's button is between PLAY and Other modes: PLAY's size, right under it, and the label right under that.)
    const town = await rect(".fd-town");
    const other = await rect(".fd-other-label");
    expect(town.y, `${at}: Chess Town right under PLAY`).toBeLessThan(playBox.y + playBox.height + 20);
    expect(Math.abs(town.height - playBox.height), `${at}: Chess Town as tall as PLAY`).toBeLessThan(0.5);
    expect(other.y, `${at}: nothing between Chess Town and Other modes`).toBeLessThan(town.y + town.height + 20);
    // (One line for what PLAY does, and it's the one above.)
    await expect(page.locator(".fd-hint")).toHaveCount(1);

    // The Other modes cards: the picture left of the words, vertically level with the card's middle, the words whole and on one
    // line, and the cards shorter (the pair was 84 px on a phone and 64 px on a computer; Nov 1: the full-width Boss Arena card is
    // gone, Chess Town's button above Other modes is PLAY's size).
    const cards = page.getByRole("main").locator(".rd-card");
    await expect(cards).toHaveCount(2);
    const heights: number[] = [];
    for (let i = 0; i < 2; i++) {
      const card = cards.nth(i);
      const c = (await card.boundingBox())!;
      const face = (await card.locator(".rd-face").boundingBox())!;
      const text = (await card.locator(".rd-card-text").boundingBox())!;
      expect(face.x + face.width, `${at}: card ${i}: the picture left of the words`).toBeLessThanOrEqual(text.x + 0.5);
      expect(Math.abs(face.y + face.height / 2 - (c.y + c.height / 2)), `${at}: card ${i}: the picture level with the card's middle`).toBeLessThanOrEqual(1.5);
      expect(Math.abs(text.y + text.height / 2 - (c.y + c.height / 2)), `${at}: card ${i}: the words level with the card's middle`).toBeLessThanOrEqual(3);
      const whole = await card.evaluate((e) => [...e.querySelectorAll(".rd-card-text > *")].every((x) => x.scrollWidth <= x.clientWidth + 0.5 && x.getBoundingClientRect().height < 24));
      expect(whole, `${at}: card ${i}: the words whole, each on one line`).toBe(true);
      heights.push(c.height);
    }
    expect(heights[0]!, `${at}: the pair shorter (was 84 on a phone, 64 on a computer)`).toBeLessThanOrEqual(57);
    expect(heights[1]!, `${at}: the pair shorter`).toBeLessThanOrEqual(57);

    // PLAY: taller than it was (64 px on a phone and on a computer; 48 px in a short window), and home as before: a phone
    // still fits with no scrolling and keeps its last card's foot where it was (25 px up from the screen's edge); a
    // computer's board keeps its size.
    expect(playBox.height, `${at}: PLAY taller (was ${h < 760 && w >= 1024 ? 48 : 64})`).toBeGreaterThanOrEqual(playMin);
    expect(await sideways(page), `${at}`).toBe(0);
    if (!desktop()) {
      const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight - innerHeight, foot: innerHeight - [...document.querySelectorAll(".rd-card")].pop()!.getBoundingClientRect().bottom }));
      expect(fit.scroll, `${at}: home fits, no scrolling`).toBeLessThanOrEqual(0);
      expect(fit.foot, `${at}: the last card's foot no lower than it was`).toBeGreaterThanOrEqual(24);
    } else {
      await expect(page.locator(".fd-livewin-sq").first()).toBeVisible();
      expect((await rect(".fd-livewin-sq")).width, `${at}: the live window's board`).toBeGreaterThan(h >= 800 ? 230 : 150);
    }
  }
});

test("test rank and level (Eric, Oct 28): an admin's home reads their ?rank= (\"Gold 3 · 45 RP\") with a green ring at 3/4 round the icon and LVL 38 over it; a player sees their real rank and neither, and nothing moves", async ({ page }) => {
  await named(page, "Leveled");
  // A ranked account (Paragon 4 · 30 RP: reaching it takes many games, so the server's answer carries it), an admin once
  // `admin` is set (as /api/me says for an email in ADMIN_EMAILS). The admin's address asks for Gold 3.
  let isAdmin = false;
  const real = rankView({ games: 40, ladder: 3 * 400 + 80 + 30 });
  await page.route(/\/api\/me(\?|$)/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    await route.fulfill({ response: res, json: { ...body, rating: 1580, ranked1v1: { ...(body.ranked1v1 ?? {}), rank: real, games: 40, wins: 20, losses: 20, draws: 0 }, ...(isAdmin ? { admin: true } : {}) } });
  });
  // (This server has TEST_SWITCHES on, which lets everyone use the test switches: the app is told otherwise, as hunchess.com
  // tells a player.)
  await switchesOff(page);
  const parts = [".fd-hero", ".fd-hero-id", ".fd-hero-icon", ".fd-hero-text", ".fd-pawn-hero", ".fd-ranked", ".fd-mode-panel", ".fd-hint", ".fd-play", ".rd-card"];
  const measure = async () => {
    const out: Record<string, Rect> = {};
    for (const sel of parts) out[sel] = (await page.locator(sel).first().boundingBox())!;
    return out;
  };
  const sub = page.locator(".fd-hero-sub");
  // (The computer's live window: on screen before the boxes are read, as in the keeps-still test.)
  const settled = async () => {
    if (desktop()) await expect(page.locator(".fd-livewin-sq").first()).toBeVisible();
    // (And the page's fonts in: a line of text is a pixel taller in the fallback font, and the pawn's card gives it back.)
    await page.evaluate(() => document.fonts.ready);
  };

  // A player: their real rank (the ?rank= ignored), no ring and no level; no rating rank's name (retired Oct 28).
  await page.goto("/?rank=gold-3");
  await expect(sub).toHaveText("Paragon 4 · 30 RP");
  await settled();
  await expect(page.locator(".fd-hero-sub .fd-rank")).toHaveText("Paragon 4");
  await expect(page.locator(".fd-level, .fd-level-ring")).toHaveCount(0);
  const player = await measure();

  // An admin: the same page, the test rank in the rank's place, the ring and the level; every box where it was.
  isAdmin = true;
  await page.reload();
  await expect(sub).toHaveText("Gold 3 · 45 RP");
  await settled();
  await expect(page.locator(".fd-level")).toHaveCount(1);
  await expect(page.locator(".fd-level-ring")).toHaveCount(1);
  await expect(page.locator(".fd-hero-sub .fd-rank")).toHaveText("Gold 3");
  const admin = await measure();
  // (The tag is as wide as its words and centered, so a different rank ("Gold 3" for "Paragon 4") moves it sideways by half
  // the difference, and your pawn too when it stands beside the tag on a short card: those sideways boxes aren't compared,
  // everything else is, the tag's height and top included.)
  const byWords = new Set([".fd-hero-id", ".fd-hero-icon", ".fd-hero-text", ".fd-pawn-hero"]);
  for (const sel of parts) for (const d of ["x", "y", "width", "height"] as const) if (!(byWords.has(sel) && (d === "x" || (d === "width" && sel !== ".fd-pawn-hero")))) expect(Math.abs(admin[sel]![d] - player[sel]![d]), `${sel}'s ${d}: the same for an admin and a player`).toBeLessThanOrEqual(1);

  // The level above the icon: "LVL 38", as wide as the icon, centered, in the rating's gray, tiny.
  const icon = (await page.locator(".fd-hero-icon").boundingBox())!;
  const level = page.locator(".fd-level");
  await expect(level).toHaveText("LVL 38");
  const lv = (await level.boundingBox())!;
  expect(Math.abs(lv.width - icon.width), "as wide as the icon").toBeLessThanOrEqual(1);
  const textWidth = await level.evaluate((e) => {
    const r = document.createRange();
    r.selectNodeContents(e);
    return r.getBoundingClientRect().width;
  });
  expect(textWidth / icon.width, "the words span the icon's width").toBeGreaterThan(0.85);
  expect(textWidth / icon.width, "the words no wider than the icon").toBeLessThan(1.03);
  expect(Math.abs(lv.x + lv.width / 2 - (icon.x + icon.width / 2)), "centered over the icon").toBeLessThanOrEqual(1);
  expect(lv.y + lv.height, "above the icon").toBeLessThanOrEqual(icon.y + 1);
  expect(icon.y - (lv.y + lv.height), "just above the icon").toBeLessThan(8);
  const look = await page.evaluate(() => {
    const l = getComputedStyle(document.querySelector(".fd-level")!);
    return { size: parseFloat(l.fontSize), color: l.color, rating: getComputedStyle(document.querySelector(".fd-hero-sub")!).color };
  });
  expect(look.size, "tiny").toBeLessThanOrEqual(12);
  expect(look.color, "the rating's gray").toBe(look.rating);

  // The ring: green, thin, round the icon, from the top clockwise, filled to 3/4 over a faint track.
  const ring = page.locator(".fd-level-ring");
  const rb = (await ring.boundingBox())!;
  expect(Math.abs(rb.x + rb.width / 2 - (icon.x + icon.width / 2)), "the ring round the icon").toBeLessThanOrEqual(1);
  expect(Math.abs(rb.y + rb.height / 2 - (icon.y + icon.height / 2)), "the ring round the icon").toBeLessThanOrEqual(1);
  expect(rb.width - icon.width, "the ring just outside the icon").toBeGreaterThanOrEqual(4);
  expect(rb.width - icon.width, "the ring just outside the icon").toBeLessThanOrEqual(12);
  const geo = await page.evaluate(() => {
    const svg = document.querySelector(".fd-level-ring") as SVGSVGElement;
    const fill = svg.querySelector(".fill") as SVGPathElement;
    const track = svg.querySelector(".track") as SVGPathElement;
    const len = fill.getTotalLength();
    const vb = svg.viewBox.baseVal;
    // (The path's points as fractions of the ring's box, from its start: the top's middle, then clockwise.)
    const at = (f: number) => {
      const p = fill.getPointAtLength(len * f);
      return [(p.x - vb.x) / vb.width, (p.y - vb.y) / vb.height].map((v) => Math.round(v * 100) / 100);
    };
    const dash = getComputedStyle(fill).strokeDasharray.split(/[ ,]+/).map(parseFloat);
    const green = (c: string) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g)!.map(Number);
      return g! > r! + 40 && g! > b! + 40;
    };
    return {
      start: at(0),
      quarter: at(0.25),
      half: at(0.5),
      threeQuarters: at(0.75),
      filled: dash[0]! / len,
      sameLength: Math.abs(track.getTotalLength() - len) < 0.01,
      trackFilled: getComputedStyle(track).strokeDasharray,
      fillStroke: green(getComputedStyle(fill).stroke),
      trackStroke: green(getComputedStyle(track).stroke),
      trackOpacity: Number(getComputedStyle(track).opacity),
      width: parseFloat(getComputedStyle(svg).strokeWidth) * (svg.getBoundingClientRect().width / vb.width),
    };
  });
  expect(geo.start, "starts at the top, in the middle").toEqual([0.5, 0.02]);
  expect(geo.quarter, "a quarter of the way: the right").toEqual([0.98, 0.5]);
  expect(geo.half, "half: the bottom").toEqual([0.5, 0.98]);
  expect(geo.threeQuarters, "three quarters: the left (clockwise)").toEqual([0.02, 0.5]);
  expect(Math.abs(geo.filled - 0.75), "filled to 3/4").toBeLessThan(0.005);
  expect(geo.sameLength && geo.trackFilled === "none", "the faint track is the whole ring").toBe(true);
  expect(geo.fillStroke && geo.trackStroke, "green").toBe(true);
  expect(geo.trackOpacity, "a faint track").toBeLessThan(0.4);
  expect(geo.width, "thin").toBeLessThanOrEqual(3);

  // Room for the level under the card's top edge (Eric, Oct 28: it was cut off there on his phone), on phones tall and short.
  if (!desktop()) {
    for (const size of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 390, height: 664 }, { width: 360, height: 640 }]) {
      await page.setViewportSize(size);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const card = (await page.locator(".fd-hero").boundingBox())!;
      const top = (await level.boundingBox())!.y;
      expect(top - card.y, `LVL 38 clear of the card's top at ${size.width}×${size.height}`).toBeGreaterThanOrEqual(4);
      // (With the tag over the pawn: "squeeze it closer to the top of the pawn". It takes some of the room over the pawn's
      // head that a hat may use, and is drawn in front of the pawn.)
      if ((await page.locator(".fd-hero-in").evaluate((e) => getComputedStyle(e).flexDirection)) === "column") {
        const tag = (await page.locator(".fd-hero-id").boundingBox())!;
        const pawn = (await page.locator(".fd-pawn-hero").boundingBox())!;
        expect(tag.y + tag.height - pawn.y, `the tag over the top of the pawn's box at ${size.width}×${size.height}`).toBeGreaterThanOrEqual(4);
        expect(await page.locator(".fd-hero-id").evaluate((e) => Number(getComputedStyle(e).zIndex)), "the tag in front of the pawn").toBeGreaterThan(1);
      }
    }
  }
});
