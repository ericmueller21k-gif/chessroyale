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

/** Into a party's battle: Eric leads, Maya and an admin's bot member; both people on their first turn. */
async function intoBattle(browser: Browser, phone: boolean) {
  const eric = await person(browser, "Eric", phone);
  const maya = await person(browser, "Maya", !phone);
  const e = eric.page;
  const m = maya.page;
  await e.goto("/?debug");
  await openSoloBoss(e);
  await e.getByRole("radiogroup", { name: "Bosses" }).getByRole("radio", { name: "Boingo", exact: false }).first().click();
  await e.getByRole("button", { name: "Invite a friend", exact: true }).first().click();
  const sheet = e.getByRole("dialog", { name: "Invite friends" });
  const code = (await sheet.getByLabel("Party code").textContent())!.trim();
  // (The test server's bot member: admins and tests only.)
  await sheet.getByRole("button", { name: "Add a bot" }).click();
  await expect(sheet.getByRole("listitem")).toHaveCount(2);
  await sheet.getByRole("button", { name: "Close" }).click();
  await m.goto(`/boss/party/${code}?debug`);
  await expect(m.locator(".bs-start")).toHaveText(/READY$/, { timeout: 15_000 });
  await m.locator(".bs-start").click();
  await expect(e.locator(".bs-start")).toBeEnabled({ timeout: 15_000 });
  await e.locator(".bs-start").click();
  for (const p of [e, m]) await expect.poll(() => p.evaluate(() => (window as any).match?.phase?.kind ?? "none"), { timeout: 120_000 }).toBe("play");
  return { eric, maya, e, m };
}

test("in the battle: picks live in each one's color and changeable, \"Your pick is in.\", the team's pawns with a check or \"…\", the leader's Kick grey for a minute then live; the one kicked goes home told so", async ({ browser }, info) => {
  test.setTimeout(5 * 60_000);
  const phone = info.project.name === "phone";
  const { eric, maya, e, m } = await intoBattle(browser, phone);
  // Both have the gear, and Eric's team clock reads 10:10 or a little less.
  for (const p of [e, m]) await expect(p.getByRole("button", { name: "Match options" })).toBeVisible();
  const { Chess } = await import("chess.js");
  const fen = await e.evaluate(() => (window as any).match.phase.board.fen as string);
  const allowed = (await e.evaluate(() => ((window as any).match.boss?.powers?.allowed ?? null) as string[] | null)) ?? new Chess(fen).moves({ verbose: true }).map((x) => x.lan);
  const [a, b] = allowed.filter((x) => !new Chess(fen).moves({ verbose: true }).find((y) => y.lan === x)?.captured);
  await e.evaluate((mv) => (window as any).match.submit(mv), a!);
  await expect(e.locator(".boss-dock .dk-text")).toContainText("Your pick is in.");
  // Maya sees Eric's pick at once, an arrow in his seat's color (orange), before she picks.
  const orange = m.locator('.hb-shapes line[stroke="#e8820c"]');
  await expect(orange).toHaveCount(1, { timeout: 10_000 });
  // He changes it: still one arrow of his, the turn still open.
  await e.evaluate((mv) => (window as any).match.submit(mv), b!);
  await expect.poll(() => m.evaluate(() => ((window as any).match.livePicks() ?? []).map((p: { move: string }) => p.move))).toContain(b);
  await expect(orange).toHaveCount(1);
  expect(await e.evaluate(() => (window as any).match.phase.kind)).toBe("play");
  // The team's pawns: Maya thinking on Eric's screen, with his Kick grey for the first minute; Maya, who may not kick, has none.
  // (The bot member picks after a think of its own: only Maya is checked here.)
  await expect(e.locator('.dk-mate[aria-label="Maya: thinking"] .dk-mate-state.think')).toHaveCount(1);
  const kick = e.getByRole("button", { name: "Kick Maya" });
  await expect(kick).toHaveClass(/\boff\b/);
  await expect(m.locator(".dk-kick")).toHaveCount(0);
  await expect(m.locator(".dk-mate-state.done").first()).toBeVisible();
  // A minute on: live. A first tap asks, a second kicks; Maya goes home, told so.
  await expect(kick).not.toHaveClass(/\boff\b/, { timeout: 75_000 });
  await kick.click();
  await expect(kick).toHaveText("Kick?");
  await kick.click();
  await expect(m.getByText("You were removed from the party.")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => e.evaluate(() => (window as any).match.phase.kind), { timeout: 20_000 }).not.toBe("play");
  await eric.ctx.close();
  await maya.ctx.close();
});
