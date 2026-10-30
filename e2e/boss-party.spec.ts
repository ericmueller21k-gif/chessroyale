import { expect, type Browser, type Page } from "@playwright/test";
import { named, openSoloBoss, test } from "./helpers.ts";

/**
 * Boss Battle's live party (Eric, Oct 29 and 30; docs/decisions/2026-10-30-boss-party.md), through the real server: the
 * stage with a party (an invite circle's link, the members on the platforms behind you, READY and its check, the leader's
 * crown, START once everyone is ready, the member menu), nothing on the stage moving, and START taking everyone into the
 * battle together.
 */

/** Boxes on the page that must never move as the party changes. */
const frame = (page: Page) =>
  page.evaluate(() => [".bs-stage", ".bs-start", ".bs-diff", ".bs-back.bs-l", ".bs-back.bs-r", ".bs-line"].map((q) => { const r = document.querySelector(q)!.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; }));

async function person(browser: Browser, name: string, phone: boolean) {
  const { devices } = await import("@playwright/test");
  const ctx = await browser.newContext(phone ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await named(page, name);
  return { ctx, page };
}

test("the stage with a party: invite by link, READY and its check, the leader's crown and START once everyone is ready, the member menu; nothing moves; START takes everyone in", async ({ browser }, info) => {
  test.setTimeout(4 * 60_000);
  const phone = info.project.name === "phone";
  const eric = await person(browser, "Eric", phone);
  const maya = await person(browser, "Maya", !phone);
  const e = eric.page;
  const m = maya.page;
  await e.goto("/?debug");
  await openSoloBoss(e);
  await e.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: "Ginger", exact: false }).first().click();
  const still = await frame(e);
  // An invite circle: the party, its link to share.
  await e.getByRole("button", { name: "Invite a friend", exact: true }).first().click();
  const sheet = e.getByRole("dialog", { name: "Invite friends" });
  await expect(sheet).toBeVisible();
  const code = (await sheet.getByLabel("Party code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await sheet.getByRole("button", { name: "Close" }).click();
  // Maya opens the link: the Boss Battle screen, in the party.
  await m.goto(`/boss/party/${code}?debug`);
  await expect(m.getByRole("heading", { name: "Boss Battle", exact: true })).toBeVisible();
  const ericOnMaya = m.getByRole("button", { name: "Eric, party leader" });
  await expect(ericOnMaya).toBeVisible({ timeout: 15_000 });
  await expect(m.locator(".bs-start")).toHaveText(/READY$/);
  await expect(m.locator(".bs-line")).toHaveText("Eric picks the boss and the difficulty.");
  // The leader's boss on Maya's stage; her tiles and arrows are the leader's.
  await expect(m.locator(".bs-name")).toHaveText("Ginger");
  await expect(m.getByRole("button", { name: "Harder" })).toHaveAttribute("aria-disabled", "true");
  // Eric: Maya behind him, his START greyed until she's ready, and nothing moved.
  await expect(e.getByRole("button", { name: "Maya", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(e.locator(".bs-start")).toBeDisabled();
  await expect(e.locator(".bs-line")).toHaveText("Waiting for Maya to ready up");
  await expect(e.locator(".bs-me .bs-crown")).toBeVisible();
  expect(await frame(e), "nothing moves as a member joins").toEqual(still);
  // Maya's READY: her check on both stages; Eric's START now. His harder difficulty un-readies her.
  await m.locator(".bs-start").click();
  await expect(m.locator(".bs-start")).toHaveText(/READY ✓$/);
  await expect(e.getByRole("button", { name: "Maya, ready" })).toBeVisible();
  await expect(e.locator(".bs-start")).toBeEnabled();
  await expect(e.locator(".bs-line")).toHaveText("Everyone's ready.");
  await e.getByRole("button", { name: "Harder" }).click();
  await expect(m.locator(".bs-level")).toHaveText("Hard");
  await expect(m.locator(".bs-start")).toHaveText(/READY$/);
  await expect(e.locator(".bs-start")).toBeDisabled();
  expect(await frame(e), "nothing moves as she readies and unreadies").toEqual(still);
  // The member menu above her head: View profile, Promote, Kick (the leader's); a member's has only View profile.
  await e.getByRole("button", { name: "Maya", exact: true }).click();
  const menu = e.getByRole("menu", { name: "Maya" });
  await expect(menu.getByRole("menuitem")).toHaveText(["View profile", "Promote to party leader", "Kick from party"]);
  await e.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await ericOnMaya.click();
  await expect(m.getByRole("menu", { name: "Eric" }).getByRole("menuitem")).toHaveText(["View profile"]);
  await m.keyboard.press("Escape");
  // Ready again, then START: both into the battle, in the party's seats, against the leader's boss.
  await m.locator(".bs-start").click();
  await expect(e.locator(".bs-start")).toBeEnabled();
  await e.locator(".bs-start").click();
  for (const p of [e, m]) {
    await expect.poll(() => p.evaluate(() => (window as any).match?.party?.seats ?? null), { timeout: 60_000 }).not.toBeNull();
    expect(await p.evaluate(() => Object.values((window as any).match.party.seats as Record<string, number>).sort())).toEqual([0, 1]);
    expect(await p.evaluate(() => (window as any).match.settings.drawRuleByStage)).toEqual(["party"]);
  }
  await eric.ctx.close();
  await maya.ctx.close();
});
