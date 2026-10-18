import { expect, type Page } from "@playwright/test";
import { named, openBossRaid, test, watchFor } from "./helpers.ts";

/**
 * Home's RANKED row and the Boss raid's own card and screen (Eric, Oct 16;
 * docs/decisions/2026-10-16-home-ranked-row-and-boss-raid.md): the row's three ranked modes, 1 v 1's queue, the card
 * opening the Boss raid screen and each of its choices reaching the flow it always had, and the hidden /bosses.
 */

const desktop = () => test.info().project.name === "desktop";
const run = Date.now().toString(36).slice(-5);
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const box = async (p: Page, sel: string) => (await p.locator(sel).first().boundingBox())!;

test("the RANKED row: a label over 50 v 50, 1 v 1 and Squads, three equal buttons whole at every width; PLAY under it, then the Boss raid card, full width (a phone and a computer alike)", async ({ page }) => {
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
    const card = page.getByRole("main").getByRole("button", { name: /^Boss raid/ });
    await expect(card).toHaveText(/^Boss raidTeam up vs a boss · up to 50›$/);
    // The label sits right above the row; the three buttons are the same size, side by side, their words whole.
    const label = await box(page, ".fd-ranked .fd-label");
    const r = (await row.boundingBox())!;
    expect(label.y + label.height, `${w}`).toBeLessThanOrEqual(r.y + 1);
    expect(r.y - (label.y + label.height), `${w}`).toBeLessThan(12);
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
    // The card's words whole too, and it's prominent: the column's full width, as tall as a big button.
    const c = (await card.boundingBox())!;
    expect(c.height).toBeGreaterThanOrEqual(desktop() ? 60 : 64);
    expect(Math.abs(c.width - r.width), `${w}: full width`).toBeLessThan(2);
    expect(await card.evaluate((e) => [...e.querySelectorAll(".rd-card-text > *")].every((x) => x.scrollWidth <= x.clientWidth + 0.5)), `${w}`).toBe(true);
    const play = (await page.getByRole("button", { name: "PLAY", exact: true }).boundingBox())!;
    // The row, PLAY, then the card, then Play with friends on its own row (Eric, Oct 16: "under the RANKED row"; on a
    // computer too, Oct 18: "like the phone").
    expect(play.y, `${w}`).toBeGreaterThan(r.y + r.height);
    expect(c.y, `${w}`).toBeGreaterThanOrEqual(play.y + play.height);
    const friends = (await page.getByRole("main").getByRole("button", { name: "Play with friends" }).boundingBox())!;
    expect(friends.y, `${w}`).toBeGreaterThanOrEqual(c.y + c.height);
    expect(await sideways(page), `${w}`).toBe(0);
  }
});

test("1 v 1: picked, your rank and what it is in the panel under the row, remembered; PLAY queues at once (/1v1)", async ({ page }) => {
  await named(page, "Duel");
  await page.goto(`/?pool=home1v1-${test.info().project.name}-${run}`);
  await page.getByRole("radio", { name: /^1 v 1/ }).click();
  await expect(page.getByRole("radio", { name: /^1 v 1/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Matchmaking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Party/ })).toHaveCount(0);
  // Your rank (the server's: a new account is in its placements) and what 1 v 1 is, in the panel under the row.
  await expect(page.locator(".fd-mode-panel")).toHaveText(/^Your rank: Placement 0\/5Ranked chess vs one player near your level$/);
  await expect(page.locator(".fd-hint")).toHaveText("");
  const row = (await page.getByRole("radiogroup", { name: "RANKED" }).boundingBox())!;
  const rank = (await page.locator(".fd-rank1v1").boundingBox())!;
  const play = (await page.getByRole("button", { name: "PLAY", exact: true }).boundingBox())!;
  expect(rank.y).toBeGreaterThanOrEqual(row.y + row.height);
  expect(rank.y + rank.height).toBeLessThanOrEqual(play.y);
  await page.reload();
  await expect(page.getByRole("radio", { name: /^1 v 1/ })).toHaveAttribute("aria-checked", "true");
  expect(await sideways(page)).toBe(0);
  // PLAY: the 1 v 1 queue at once (startRanked1v1), its address /1v1; Cancel is home.
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(page.locator(".dv-st-finding")).toContainText("Finding opponent");
  expect(new URL(page.url()).pathname).toBe("/1v1");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("radio", { name: /^1 v 1/ })).toHaveAttribute("aria-checked", "true");
});

test("1 v 1's rank line at its widest (an apex rank with four-digit points) stays one whole line from 320 px", async ({ page }) => {
  test.skip(desktop(), "the phone's widths");
  await named(page, "Apex");
  await page.addInitScript(() => localStorage.setItem("brc.mode", "1v1"));
  await page.route("**/api/me*", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const rank = { placement: null, tier: "Grandmaster", division: null, points: 1234, ladder: 9999, color: "#e05d5d", label: "Grandmaster · 1234 RP" };
    if (body?.user) body.ranked1v1 = { ...(body.ranked1v1 ?? {}), rank };
    await route.fulfill({ response: res, json: body });
  });
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    const line = page.locator(".fd-rank1v1");
    await expect(line).toHaveText("Your rank: Grandmaster · 1234 RP");
    expect(await line.evaluate((e) => e.scrollWidth - e.clientWidth), `${width}`).toBeLessThanOrEqual(0);
    expect((await line.boundingBox())!.height, `${width}: one line`).toBeLessThan(26);
    expect(await sideways(page), `${width}`).toBe(0);
  }
});

test("the Boss raid card opens its screen; each choice reaches its flow (a raid's queue, people only, a Solo raid, Boss alone's menu, a raid with friends); Back is home", async ({ page }) => {
  // (Its character select, the tiles and the stage: boss-select.spec.ts.)
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
  await expect(main.locator(".bs-tile canvas.boss-portrait").first()).toBeVisible();
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
  await expect(menu.locator(".boss-row")).toHaveCount(10);
  await menu.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await page.goto("/?mode=raid");
  await expect(page.getByRole("heading", { name: "Boss raid", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "RANKED" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("home keeps still: no click on a mode, an option or the ⓘ moves or resizes the board preview, PLAY or the Boss raid card (phone and computer)", async ({ page }) => {
  // (Eric, Oct 18: "nothing should actually be forced moving around the size of the board or where the play button
  // is"; docs/decisions/2026-10-18-home-steady-layout.md.)
  await named(page, "Still");
  const sizes = desktop() ? [[1280, 800], [1440, 900], [1920, 1080]] : [[390, 844], [320, 640]];
  const radio = (name: RegExp) => page.getByRole("radio", { name });
  const steps: [string, () => Promise<unknown>][] = [
    ["Default", () => radio(/^Default/).click()],
    ["Bots off", () => radio(/^Bots off/).click()],
    ["Solo", () => radio(/^Solo you/).click()],
    ["ⓘ open", () => page.getByRole("button", { name: "About matchmaking" }).click()],
    ["ⓘ closed", () => page.getByRole("button", { name: "About matchmaking" }).click()],
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
  const parts = { board: ".fd-livewin", play: ".fd-play", boss: ".rd-card", panel: ".fd-mode-panel" };
  const measure = async () => {
    const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const [k, s] of Object.entries(parts)) if ((k !== "board" || desktop()) && (await page.locator(s).count())) out[k] = await box(page, s);
    return out;
  };
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.addInitScript(() => localStorage.setItem("brc.mode", "crowd"));
    await page.goto("/");
    await expect(radio(/^50 v 50/)).toHaveAttribute("aria-checked", "true");
    // (The live window's board: on screen at these computer sizes, a real square.)
    if (desktop()) expect((await box(page, ".fd-livewin-sq")).width, `${w}`).toBeGreaterThan(150);
    const first = await measure();
    for (const [step, act] of steps) {
      await act();
      const now: Awaited<ReturnType<typeof measure>> = {};
      for (const [k, sel] of Object.entries(parts)) {
        if (!(k in first)) continue;
        now[k] = await box(page, sel);
        for (const d of ["x", "y", "width", "height"] as const) expect(Math.abs(now[k]![d] - first[k]![d]), `${w}×${h}, after ${step}: ${k}'s ${d}`).toBeLessThanOrEqual(1);
      }
      // What the panel holds, every box in it, fits inside it (the ⓘ's words float above it). (Squads' choices once hung
      // out of its foot while their own box fitted: Eric's phone, Oct 18.)
      const spill = await page.evaluate(() => {
        const e = document.querySelector(".fd-mode-panel");
        if (!e) return 0;
        const p = e.getBoundingClientRect();
        const boxes = [...e.querySelectorAll("*")].filter((c) => !c.closest(".fd-types-info")).map((c) => c.getBoundingClientRect());
        return Math.max(0, ...boxes.map((c) => Math.max(c.bottom - p.bottom, p.top - c.top, c.right - p.right, p.left - c.left)));
      });
      expect(spill, `${w}×${h}, after ${step}: inside the panel`).toBeLessThanOrEqual(0.5);
      // The line under PLAY fits its fixed room (one line on a computer, two on a phone), whatever it says.
      expect(await page.locator(".fd-hint").evaluate((e) => e.scrollHeight - e.clientHeight), `${w}×${h}, after ${step}: the line under PLAY`).toBeLessThanOrEqual(1);
    }
    // (The panel: there all along.)
    expect(Object.keys(first), `${w}`).toContain("panel");
    expect(await sideways(page), `${w}`).toBe(0);
  }
});
