import { expect, type Page } from "@playwright/test";
import { soloFromHome, test } from "./helpers.ts";

/**
 * The match's options, the same on a phone and a computer (Eric, Oct 24 and Oct 25; docs/decisions/2026-10-24-match-menu.md
 * and 2026-10-25-gear-everywhere.md). A gear in the top line opens a list in the middle of the screen over the match,
 * which is faded and blurred: Sound, Animations (every mode), Motion trail (a crowd match only), Resign or Leave, and
 * Report a bug, which asks first. Auto chess has the same gear, with Leave asked first.
 */

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const phone = () => test.info().project.name === "phone";
const CROWD = "/?debug&pace=quick&mode=crowd&rounds=2&clock=30&augments=0";
const CLASSIC = "/?debug&pace=quick&mode=classic";
const AUTO = "/autochess?quick=1&seed=9&intro=0";

/** Solo in the mode the URL names, until the match is in play. */
async function matchAt(page: Page, url = CROWD) {
  await page.goto(url);
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/^(play|watching)$/);
}

test("the gear: a gear at the same 36 px box as before; it opens a list in the middle over the blurred match; its X, a tap outside and Escape close it; Sound mutes and unmutes", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await matchAt(page);
  const gear = page.getByRole("button", { name: "Match options" });
  // (a) A gear: an svg, no "⋯" text, the 36 px box the game's top line gives it (a phone's height too).
  await expect(gear.locator("svg")).toHaveCount(1);
  await expect(gear).not.toContainText("⋯");
  const g = (await gear.boundingBox())!;
  expect(Math.round(g.width)).toBe(36);
  if (phone()) expect(Math.round(g.height)).toBe(36);

  // (b) The list: a dialog in the middle of the screen, over a faded layer whose backdrop is blurred.
  await gear.click();
  const list = page.getByRole("dialog", { name: "Match options" });
  await expect(list).toBeVisible();
  for (const [w, h] of [[390, 844], [428, 777]] as const) {
    await page.setViewportSize({ width: w, height: h });
    const b = (await list.boundingBox())!;
    expect(Math.abs(b.x + b.width / 2 - w / 2), `centered across at ${w}x${h}`).toBeLessThanOrEqual(8);
    expect(Math.abs(b.y + b.height / 2 - h / 2), `centered down at ${w}x${h}`).toBeLessThanOrEqual(8);
    expect(await page.locator(".mm-scrim").evaluate((el) => getComputedStyle(el).backdropFilter), `blur at ${w}x${h}`).toContain("blur");
  }

  // (c) The X closes it; a tap on the layer outside the list closes it; Escape closes it.
  await list.getByRole("button", { name: "Close" }).click();
  await expect(list).toHaveCount(0);
  await gear.click();
  await expect(list).toBeVisible();
  await page.mouse.click(12, 12);
  await expect(list).toHaveCount(0);
  await gear.click();
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);

  // (d) Sound: the switch mutes and unmutes.
  await gear.click();
  const sound = list.getByRole("switch", { name: /Sound/ });
  const was = (await sound.getAttribute("aria-checked"))!;
  const flipped = was === "true" ? "false" : "true";
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", flipped);
  await sound.click();
  await expect(sound).toHaveAttribute("aria-checked", was);
  await page.keyboard.press("Escape");
});

test("a computer's title line: the gear sits where the sound button and the flag were; no flag, sound button or separate bug button; its list has every row", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  test.skip(phone(), "a computer's title line");
  await matchAt(page);
  // (a) The gear is the title line's control: no flag, no sound button, no bug button beside it.
  await expect(page.locator(".hud-row .mm-flag, .hud-row .mute-btn, .hud-row .mm-report")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Report a bug" })).toHaveCount(0);
  const gear = page.locator(".hud-row").getByRole("button", { name: "Match options" });
  await expect(gear).toHaveCount(1);
  // (b) At the right end of the title line, over the board's column.
  const [gb, title, board] = await Promise.all([gear.boundingBox(), page.locator(".hud-row > .hud").boundingBox(), page.locator(".board-area").first().boundingBox()]);
  expect(gb!.x, "after the title").toBeGreaterThanOrEqual(title!.x + title!.width - 1);
  expect(Math.abs(gb!.y + gb!.height / 2 - (title!.y + title!.height / 2)), "on the title's line").toBeLessThanOrEqual(2);
  expect(gb!.x + gb!.width, "over the board's column").toBeLessThanOrEqual(board!.x + board!.width + 1);
  // (c) Its list: the centered card, with Sound, Animations, Motion trail (a crowd match), Resign or Leave, Report a bug.
  await gear.click();
  const list = page.getByRole("dialog", { name: "Match options" });
  await expect(list.getByRole("switch", { name: /Sound/ })).toBeVisible();
  await expect(list.getByRole("switch", { name: /^Animations/ })).toBeVisible();
  await expect(list.getByRole("switch", { name: /^Motion trail/ })).toBeVisible();
  await expect(list.getByRole("button", { name: /^(Resign|Leave the match)$/ })).toBeVisible();
  await expect(list.getByRole("button", { name: "Report a bug" })).toBeVisible();
  const c = (await list.boundingBox())!;
  const view = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  expect(Math.abs(c.x + c.width / 2 - view.w / 2), "centered across").toBeLessThanOrEqual(8);
  expect(Math.abs(c.y + c.height / 2 - view.h / 2), "centered down").toBeLessThanOrEqual(8);
  await page.keyboard.press("Escape");
});

test("a crowd match's list: Animations and Motion trail, locked as in Settings → Board (the trail off and disabled while the animations are off), and the same in Settings and back", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await matchAt(page);
  await page.getByRole("button", { name: "Match options" }).click();
  const list = page.getByRole("dialog", { name: "Match options" });
  const anim = list.getByRole("switch", { name: /^Animations/ });
  const trail = list.getByRole("switch", { name: /^Motion trail/ });
  // (e) Both rows show in a crowd match; the trail follows the animations.
  await expect(anim).toHaveAttribute("aria-checked", "true");
  await expect(trail).toHaveAttribute("aria-checked", "true");
  await anim.click();
  await expect(anim).toHaveAttribute("aria-checked", "false");
  await expect(trail).toHaveAttribute("aria-checked", "false");
  await expect(trail).toBeDisabled();
  await anim.click();
  await expect(anim).toHaveAttribute("aria-checked", "true");
  await expect(trail).toBeEnabled();
  await expect(trail).toHaveAttribute("aria-checked", "true");
  await trail.click();
  await expect(trail).toHaveAttribute("aria-checked", "false");
  // Animations off locks the trail off; on again, the trail's own setting (off) comes back.
  await anim.click();
  await expect(trail).toBeDisabled();
  await anim.click();
  await expect(anim).toHaveAttribute("aria-checked", "true");
  await expect(trail).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");

  // Settings → Board shows the same (the prefs are kept on the device).
  await page.goto("/settings");
  const sAnim = page.getByRole("switch", { name: /^Animations/ });
  const sTrail = page.getByRole("switch", { name: /^Motion trail/ });
  await expect(sAnim).toBeChecked();
  await expect(sTrail).not.toBeChecked();
  // ...and a change there is what the list shows: animations off locks the trail; then both on.
  await sAnim.click();
  await expect(sTrail).toBeDisabled();
  await sAnim.click();
  await sTrail.click();
  await expect(sTrail).toBeChecked();

  // Back to a crowd match: the list has what Settings set.
  await matchAt(page);
  await page.getByRole("button", { name: "Match options" }).click();
  const again = page.getByRole("dialog", { name: "Match options" });
  await expect(again.getByRole("switch", { name: /^Animations/ })).toHaveAttribute("aria-checked", "true");
  await expect(again.getByRole("switch", { name: /^Motion trail/ })).toHaveAttribute("aria-checked", "true");
});

test("a match that isn't a crowd (Classic): the list has Sound and Animations, and no motion trail", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await matchAt(page, CLASSIC);
  await page.getByRole("button", { name: "Match options" }).click();
  const list = page.getByRole("dialog", { name: "Match options" });
  await expect(list.getByRole("switch", { name: /Sound/ })).toBeVisible();
  // (Eric, Oct 25: Animations in every mode; the trail only where picks fly, in a crowd match.)
  await expect(list.getByRole("switch", { name: /^Animations/ })).toBeVisible();
  await expect(list.getByRole("switch", { name: /^Motion trail/ })).toHaveCount(0);
});

test("Report a bug asks first (Cancel goes back to the list; Report opens the feedback sheet), and Resign asks in the middle and still works", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await matchAt(page);
  await page.getByRole("button", { name: "Match options" }).click();
  const list = page.getByRole("dialog", { name: "Match options" });
  // (f) Report a bug: a confirm first, Cancel back to the list.
  await list.getByRole("button", { name: "Report a bug" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.locator(".mm-confirm-title")).toHaveText("Report a bug?");
  await expect(confirm.locator(".mm-confirm-note")).toHaveText("The report form covers the game. Your match keeps going.");
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(list).toBeVisible();
  // Report: the list closes and the feedback sheet opens on the bug.
  await list.getByRole("button", { name: "Report a bug" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Report", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "We'd love your feedback" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Report a bug" })).toHaveAttribute("aria-checked", "true");
  await expect(list).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);

  // (g) Resign: the confirm in the middle, and it still resigns.
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^Resign$/ }).click();
  const resign = page.getByRole("alertdialog");
  await expect(resign.locator(".mm-confirm-title")).toHaveText("Resign?");
  const c = (await resign.boundingBox())!;
  const view = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  expect(Math.abs(c.x + c.width / 2 - view.w / 2)).toBeLessThanOrEqual(8);
  expect(Math.abs(c.y + c.height / 2 - view.h / 2)).toBeLessThanOrEqual(8);
  await resign.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.locator(".results h1")).toHaveText("You resigned", { timeout: 10_000 });
});

test("Auto chess: the same gear at the top right, with Sound, Animations, Leave (asked first: \"Leave this game?\") and Report a bug; the back button stays", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.goto(AUTO);
  const gear = page.getByRole("button", { name: "Match options" });
  await expect(gear).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible();
  // (a) On the top line, right of the title.
  const [g, t] = await Promise.all([gear.boundingBox(), page.locator(".ac-title").boundingBox()]);
  expect(g!.x, "right of the title").toBeGreaterThanOrEqual(t!.x + t!.width - 1);
  expect(g!.y, "on the top line").toBeLessThan(t!.y + t!.height);
  // (b) Its rows: Sound, Animations, Leave, Report a bug (no motion trail: no picks fly here).
  await gear.click();
  const list = page.getByRole("dialog", { name: "Match options" });
  await expect(list.getByRole("switch", { name: /Sound/ })).toBeVisible();
  await expect(list.getByRole("switch", { name: /^Animations/ })).toBeVisible();
  await expect(list.getByRole("switch", { name: /^Motion trail/ })).toHaveCount(0);
  await expect(list.getByRole("button", { name: "Leave", exact: true })).toBeVisible();
  await expect(list.getByRole("button", { name: "Report a bug" })).toBeVisible();
  // (c) Leave asks first; Cancel keeps the game.
  await list.getByRole("button", { name: "Leave", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.locator(".mm-confirm-title")).toHaveText("Leave this game?");
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator(".ac-root")).toBeVisible();
  // (d) Animations is a switch in the list, as in Settings (on, then off, then on again).
  await gear.click();
  const anim = page.getByRole("dialog", { name: "Match options" }).getByRole("switch", { name: /^Animations/ });
  await expect(anim).toHaveAttribute("aria-checked", "true");
  await anim.click();
  await expect(anim).toHaveAttribute("aria-checked", "false");
  await anim.click();
  await expect(anim).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  // (e) Leave, confirmed, goes home (where the back button goes).
  await gear.click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: "Leave", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.locator(".ac-root")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/");
});
