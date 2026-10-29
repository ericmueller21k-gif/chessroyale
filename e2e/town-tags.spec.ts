import { expect, test, type Page } from "@playwright/test";
import { BOTS } from "../packages/app/src/town/world.ts";
import { wrapF } from "../packages/app/src/town/camera.ts";
import { TOWN_FEEL } from "../packages/app/src/town/feel.ts";
import { NAMES_KEY } from "../packages/app/src/town/tags.ts";

/**
 * The town's name tags (Eric, Oct 28, after trying 50 bots; docs/areas/town-square.md, "Name tags"), on a phone and a computer: by default
 * a figure's tag shows only while it is within 5 squares of you (|dc| and |dr|, from fractional positions) and fades in and out over the
 * last square as you or it walk; your own tag, an open card's figure and a table partner always show; "Names" in Town settings has "Near
 * you" (the default) and "Everyone" (every tag, as before), remembered on this device; a boss's sidekick's tag is blue with white text.
 * Test hook (the test switches on): `window.__townTags()` lists the tags drawn in the last frame (name, kind, alpha, pill, ink, box).
 * `?crowd=50` puts fifty more guests in the square (the far ones there are what "Near you" hides).
 */
test.use({ actionTimeout: 15_000 });

// The chat box (Oct 28, v4) takes every touch on its own area while it shows, which on a phone is the corner that holds the Colosseum's
// gate; these tests aim at the map, so the box lets taps through (e2e/town-chat.spec.ts tests the box itself).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

type Tag = { text: string; kind: "you" | "bot" | "sidekick"; alpha: number; pill: string; ink: string; x: number; y: number; w: number; h: number };
type BotRow = { name: string; at: string; home: boolean; moving: boolean };
type Hooks = { __townTags: () => Tag[] | null; __townBots: () => BotRow[]; __townCall: (i: number) => void; __townAt: (k: string, id: number) => { x: number; y: number } | null };
const canvas = (p: Page) => p.locator("canvas.town-canvas");
/** The town, open, by day, with fifty more guests in it, and its first frames drawn. */
async function open(page: Page, query = "&crowd=50") {
  await page.goto(`/town?sky=day${query}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as unknown as Hooks).__townTags === "function");
  await page.evaluate(() => (window as any).__townChatter?.(false));
  await page.waitForTimeout(800);
}
/** Everything a test compares, read in one go (one frame's tags, the bots' squares and yours). */
const read = (p: Page) =>
  p.evaluate(() => {
    const h = window as unknown as Hooks;
    return { tags: h.__townTags() ?? [], bots: h.__townBots(), you: document.querySelector("canvas.town-canvas")!.getAttribute("data-you")! };
  });
const sq = (s: string) => s.split(",").map(Number) as [number, number];
/** The squares between two squares, the larger of the two directions, round the world's wrap (the near rule's own measure). */
const dist = (a: string, b: string) => {
  const [p, q] = [sq(a), sq(b)];
  return Math.max(Math.abs(wrapF(p[0]! - q[0]!)), Math.abs(wrapF(p[1]! - q[1]!)));
};
const botIndex = (name: string) => BOTS.findIndex((b) => b.name === name);
const called = (p: Page, name: string) => p.evaluate((i) => (window as unknown as Hooks).__townCall(i), botIndex(name));
/** Town settings' Names choices. */
const sheet = (p: Page) => p.getByRole("dialog", { name: "Town settings" });
async function setNames(p: Page, choice: "Near you" | "Everyone") {
  await p.getByRole("button", { name: "Town settings" }).click();
  await sheet(p).getByRole("radiogroup", { name: "Names" }).getByRole("radio", { name: choice }).click();
  await p.keyboard.press("Escape");
  await expect(sheet(p)).toHaveCount(0);
  await p.waitForTimeout(500);
}

test("name tags show only near you by default: a far figure has none, a near one has one, yours is always there; Everyone shows them all as before; the setting is in Town settings under Chat and survives a reload", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  // The sheet: "Names" under Chat, two choices, "Near you" picked, and its line.
  await page.getByRole("button", { name: "Town settings" }).click();
  const names = sheet(page).getByRole("radiogroup", { name: "Names" });
  await expect(names).toBeVisible();
  await expect(names.getByRole("radio")).toHaveText(["Near you", "Everyone"]);
  await expect(names.getByRole("radio", { name: "Near you" })).toHaveAttribute("aria-checked", "true");
  await expect(names.getByRole("radio", { name: "Everyone" })).toHaveAttribute("aria-checked", "false");
  await expect(sheet(page).getByText("Near you: names show within 5 squares of you.")).toBeVisible();
  const heads = await sheet(page).locator(".town-set-head").allTextContents();
  expect(heads.map((h) => h.trim()), "Names comes under Chat").toEqual(["Chat", "Names"]);
  // (The chat's own three choices are unchanged.)
  await expect(sheet(page).getByRole("radiogroup", { name: "Chat" }).getByRole("radio")).toHaveText(["Always on", "New messages", "Off"]);
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), NAMES_KEY), "nothing stored: the default").toBeNull();

  // A sidekick comes to stand beside you (and every bot holds still): its tag is there, blue with white text.
  const side = "Squirt";
  expect(BOTS[botIndex(side)]!.boss, `${side} is a boss's sidekick`).toBeTruthy();
  await called(page, side);
  await expect.poll(async () => (await read(page)).bots[botIndex(side)]!.moving, { timeout: 15_000 }).toBe(false);
  await page.waitForTimeout(600);
  const near = await read(page);
  const youTag = near.tags.find((t) => t.kind === "you");
  expect(youTag, "your own tag").toBeTruthy();
  expect(youTag!.alpha).toBe(1);
  const mine = near.tags.find((t) => t.text === `${side} (bot)`);
  expect(mine, "the sidekick beside you has a tag").toBeTruthy();
  expect(mine!.kind).toBe("sidekick");
  expect(mine!.alpha).toBe(1);
  // Every other tag (a pawn's, white) belongs to a figure within the radius: for the bots we can place, within 5.5 squares (past it the alpha is 0).
  for (const t of near.tags) {
    const row = near.bots.find((b) => `${b.name}` === t.text);
    if (row && !row.home) expect(dist(row.at, near.you), `${t.text}'s tag only within ${R()} squares`).toBeLessThanOrEqual(R() + 0.01);
    if (t.kind === "bot") expect(t.pill).toBe("rgba(255,255,255,.92)");
  }
  // The sidekick's tag is blue with white text, on the screen too: its pill's pixels are blue and some of its text's are white.
  expect(mine!.pill).toMatch(/^rgba\(29,\s*78,\s*216/);
  expect(mine!.ink.toLowerCase()).toBe("#ffffff");
  const px = await page.evaluate((t) => {
    const cv = document.querySelector("canvas.town-canvas") as HTMLCanvasElement;
    const k = cv.width / cv.clientWidth;
    const g = cv.getContext("2d")!;
    const d = g.getImageData(Math.round((t.x + 1) * k), Math.round(t.y * k), Math.max(1, Math.round((t.w - 2) * k)), Math.max(1, Math.round(t.h * k))).data;
    let blue = 0;
    let white = 0;
    let all = 0;
    for (let i = 0; i < d.length; i += 4) {
      all++;
      if (d[i]! < 90 && d[i + 1]! < 120 && d[i + 2]! > 170) blue++;
      if (d[i]! > 235 && d[i + 1]! > 235 && d[i + 2]! > 235) white++;
    }
    return { blue: blue / all, white: white / all };
  }, mine!);
  expect(px.blue, "most of the pill is blue").toBeGreaterThan(0.45);
  expect(px.white, "the name is white on it").toBeGreaterThan(0.03);

  // Everyone: every tag, as before: the figures far from you have one now (and the near ones keep theirs).
  const nearNames = new Set(near.tags.map((t) => t.text));
  await setNames(page, "Everyone");
  expect(await page.evaluate((k) => localStorage.getItem(k), NAMES_KEY)).toBe("everyone");
  const all = await read(page);
  const allNames = new Set(all.tags.map((t) => t.text));
  for (const n of nearNames) expect(allNames.has(n), `${n} keeps its tag in Everyone`).toBe(true);
  expect(all.tags.length, "far figures have tags in Everyone").toBeGreaterThan(near.tags.length + 5);
  const farOnes = all.tags.filter((t) => !nearNames.has(t.text));
  expect(farOnes.length).toBeGreaterThan(5);
  // (A far figure we can place: its distance is past the radius, and its tag is only there in Everyone.)
  const farBot = all.tags.map((t) => ({ t, row: all.bots.find((b) => b.name === t.text) })).find((x) => x.row && !x.row.home && dist(x.row.at, all.you) > R() + 0.5);
  if (farBot) expect(nearNames.has(farBot.t.text), `${farBot.t.text}: far, no tag in Near you`).toBe(false);
  for (const t of all.tags) expect(t.alpha, "no tag is faded by the near rule in Everyone").toBeGreaterThan(0);

  // It survives a reload (remembered on this device), shown picked in the sheet, with the far tags still drawn.
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as unknown as Hooks).__townTags === "function");
  await page.waitForTimeout(1200);
  const again = await read(page);
  expect(again.tags.length, "still every tag after a reload").toBeGreaterThan(near.tags.length + 5);
  await page.getByRole("button", { name: "Town settings" }).click();
  await expect(sheet(page).getByRole("radiogroup", { name: "Names" }).getByRole("radio", { name: "Everyone" })).toHaveAttribute("aria-checked", "true");
  await sheet(page).getByRole("radiogroup", { name: "Names" }).getByRole("radio", { name: "Near you" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  expect(await page.evaluate((k) => localStorage.getItem(k), NAMES_KEY)).toBe("near");
  const back = await read(page);
  expect(back.tags.length, "back to near you: far tags gone").toBeLessThan(again.tags.length - 5);
});

test("tags fade as you walk away from a figure (not a pop), are gone past the radius, and a figure whose card is open keeps its tag wherever it is", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, "");
  const side = "Squirt";
  const i = botIndex(side);
  const name = `${side} (bot)`;
  await called(page, side);
  await expect.poll(async () => (await read(page)).bots[i]!.moving, { timeout: 15_000 }).toBe(false);
  await page.waitForTimeout(500);
  expect((await read(page)).tags.find((t) => t.text === name)?.alpha, "beside you: shown").toBe(1);

  // Walk away (taps toward the far side of the map) while a recorder in the page notes the tag's alpha every frame. The bot holds still.
  await page.evaluate((n) => {
    const w = window as unknown as { __rec: number[]; __recGo: boolean } & Hooks;
    w.__rec = [];
    w.__recGo = true;
    const tick = () => {
      w.__rec.push(w.__townTags()?.find((t) => t.text === n)?.alpha ?? 0);
      if (w.__recGo) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, name);
  const cv = (await canvas(page).boundingBox())!;
  let far = 0;
  for (const [fx, fy] of [[0.5, 0.12], [0.85, 0.3], [0.15, 0.3], [0.5, 0.9], [0.9, 0.9]] as const) {
    await page.mouse.click(cv.x + cv.width * fx, cv.y + cv.height * fy);
    let last = "";
    for (let n = 0; n < 40; n++) {
      const you = await canvas(page).getAttribute("data-you");
      if (you === last) break;
      last = you!;
      await page.waitForTimeout(500);
    }
    const now = await read(page);
    far = dist(now.bots[i]!.at, now.you);
    if (far > R() + 1) break;
  }
  expect(far, "you ended up past the radius from it").toBeGreaterThan(R() + 0.5);
  const series = await page.evaluate(() => {
    const w = window as unknown as { __rec: number[]; __recGo: boolean };
    w.__recGo = false;
    return w.__rec;
  });
  expect(series[0], "it started shown").toBe(1);
  expect(series.at(-1), "and ended gone: past the radius").toBe(0);
  const mid = series.filter((a) => a > 0.02 && a < 0.98);
  expect(mid.length, "it faded: some frames in between (a pop would have none)").toBeGreaterThanOrEqual(1);
  // Falling as you went (the walk round the homes may bend back a step or two, so not frame by frame): the first frame it was below 1 is
  // before the first frame at 0, and what lies between them is a fade.
  const firstBelow = series.findIndex((a) => a < 1);
  const firstGone = series.indexOf(0);
  expect(firstBelow).toBeGreaterThanOrEqual(0);
  expect(firstGone, "gone only after it began to fade").toBeGreaterThan(firstBelow);

  // Far now: no tag. Tap it (its card opens at once, before you've walked far): its tag is there, fully, wherever it is.
  await page.waitForTimeout(400);
  const gone = await read(page);
  expect(gone.tags.find((t) => t.text === name), "past the radius: no tag").toBeUndefined();
  const at = await page.evaluate((id) => (window as unknown as Hooks).__townAt("bot", id), i);
  if (!at) {
    // (The sidekick is off the screen from here, so there is nothing to tap: the card's case is covered by the unit tests of the rule.)
    test.info().annotations.push({ type: "note", description: "the sidekick was off the screen: the open-card case wasn't tapped" });
    return;
  }
  await page.mouse.click(cv.x + at.x, cv.y + at.y);
  await expect(page.getByRole("dialog", { name: `${name}`, exact: true })).toBeVisible();
  const shown = await read(page);
  const opened = shown.tags.find((t) => t.text === name);
  expect(opened, "its card is open: its tag is there").toBeTruthy();
  expect(opened!.alpha).toBe(1);
  expect(dist(shown.bots[i]!.at, shown.you), "and it's still past the radius from you").toBeGreaterThan(R());
});

/** The radius plus half the fade: past this, a tag is gone. */
function R() {
  return TOWN_FEEL.nameRadius + TOWN_FEEL.nameFadeSquares / 2;
}
