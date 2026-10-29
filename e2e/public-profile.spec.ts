import { expect, type Browser, type Page } from "@playwright/test";
import { createLobbyFromHome, joinFromInvite, named, switchesOff, test } from "./helpers.ts";
import { DEMO_ID, MOCKUP_LOOK, demoProfile, rankAt, routeProfile, skyIcon } from "./public-profile-data.ts";
import { rankView } from "@chessroyale/core";

/**
 * The public profile (docs/decisions/2026-10-28-public-profile.md; Eric's mockup, Oct 28): the page every player has, the same
 * for everyone. Another player's name opens it; your own pawn opens your own profile, with "View public profile" at its top,
 * which opens yours as others see it, with Challenge, Add Friend and ••• greyed. Phone (390 × 844), and a computer at 1280 × 800
 * and 1440 × 900. The cards' contents come from a made-up profile served in place of the server's (public-profile-data.ts: an
 * e2e can't play dozens of ranked games); the buttons are tried with two real players.
 *
 * Eric's rules (docs/rules/eric.md, "Nothing hidden, nothing shifts"): the page takes the same room while it loads and after, the
 * Ranked card is one height in every mode of its menu, and a note takes none (it's a toast). Every size and space on the page is
 * Eric's mockup's, measured from the image (docs/decisions/2026-10-29-public-profile-fit.md): "the blocks' sizes and spaces" below pins them.
 */

const isComputer = () => test.info().project.name === "desktop";
/** The sizes this project runs at: the phone's own 390 × 844; a computer's 1280 × 800 and 1440 × 900. */
const sizes = () => (isComputer() ? [{ width: 1280, height: 800 }, { width: 1440, height: 900 }] : [{ width: 390, height: 844 }]);

type Opts = { admin?: boolean; scheme?: "light" | "dark"; delay?: number };

/** A player's device opened on `profile`'s page (a player: the test switches off, as production tells it; `admin`: left on, as for Eric). */
async function openDemo(page: Page, profile = demoProfile(), opts: Opts = {}) {
  await named(page, "Viewer");
  if (!opts.admin) await switchesOff(page);
  if (opts.scheme) await page.emulateMedia({ colorScheme: opts.scheme });
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await routeProfile(page, profile, opts.delay);
  await page.goto(`/profile/${profile.id}?nolanding`);
}

const loaded = (page: Page, name = "HunChess") => expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
/**
 * Where each part of the page is (page coordinates), to compare one moment with another: a box's left, top, width and height; a
 * line of text that centers itself (the name, the line under it) by its top and height only, since its width is its words'.
 */
const layout = (page: Page) =>
  page.evaluate(() => {
    const at = (s: string, whole: boolean) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      const n = (v: number) => Math.round(v * 10) / 10;
      return whole ? [n(r.x), n(r.y + scrollY), n(r.width), n(r.height)] : [n(r.y + scrollY), n(r.height)];
    };
    return {
      ...Object.fromEntries([".pp-head", ".pp-avatar", ".pp-actions", ".pp-ranked", ".pp-recent", ".pp-cosmetics"].map((s) => [s, at(s, true)])),
      ...Object.fromEntries([".pp-name", ".pp-seen"].map((s) => [s, at(s, false)])),
    } as Record<string, number[]>;
  });

async function player(browser: Browser, name: string): Promise<{ page: Page; id: string }> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  const id = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.id as string));
  return { page, id };
}

test("every card's content, as in the mockup: the header, Ranked Standing, Recent Matches, Equipped Cosmetics", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  // The header: Back on the left, the title, ••• on the right.
  await expect(page.getByRole("heading", { name: "Player Profile", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "More options" })).toBeEnabled();
  // Their picture's green dot, and the line: online now, when they joined. No "Chess Royale player" line, no level ring.
  await expect(page.locator(".pp-online")).toBeVisible();
  await expect(page.locator(".pp-seen")).toHaveText("Online now · Joined Oct 2026");
  await expect(page.locator(".pp-seen .fd-dot")).toBeVisible();
  await expect(page.locator(".pp")).not.toContainText("Chess Royale player");
  await expect(page.locator(".fd-level-ring, .fd-level")).toHaveCount(0);
  // Two buttons, no more.
  await expect(page.getByRole("button", { name: "Challenge" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Add Friend" })).toBeEnabled();
  await expect(page.locator(".pp-actions .fd-btn")).toHaveCount(2);

  // Ranked Standing: no icon, the 1v1 menu and Season 1; Gold 3, 45 RP, the peak and the three stats.
  const ranked = page.locator(".pp-ranked");
  await expect(ranked.getByRole("heading", { name: "Ranked Standing" })).toBeVisible();
  await expect(ranked.locator(".pp-ico")).toHaveCount(0);
  await expect(ranked.getByRole("button", { name: /^Ranked mode/ })).toHaveText("1v1");
  await expect(ranked.locator(".pp-season")).toHaveText("Season 1");
  await expect(ranked.locator(".pp-cap")).toHaveText("CURRENT TIER");
  await expect(ranked.locator(".pp-tier")).toHaveText("Gold 3");
  await expect(ranked.locator(".pp-rp")).toHaveText("45 RP");
  await expect(ranked.locator(".pp-peak")).toHaveText("Peak rank: Paragon 4");
  await expect(ranked.locator(".pp-stat strong")).toHaveText(["58%", "34 – 25", "3"]);
  await expect(ranked.locator(".pp-stat span")).toHaveText(["Win rate", "W / L", "Win streak"]);
  // Their rating is never shown: the 1v1 rating stays hidden.
  await expect(ranked).not.toContainText(/rating/i);
  // The emblem is the ranked tiers' own (Gold 3), drawn in whole steps of its 48 px (96 on a phone, 144 on a computer) and shown at
  // the mockup's size: 109 px on a phone, 141 on a computer (was 96 and 144, as drawn).
  const emblem = ranked.locator('[data-emblem="gold-d3"]');
  await expect(emblem).toHaveCount(1);
  expect(Math.abs((await emblem.boundingBox())!.width - (isComputer() ? 141 : 109))).toBeLessThan(1);

  // Recent Matches: the last five, newest first, both lists merged (the 1 v 1 games and the raid and the 50 v 50 among them).
  const recent = page.locator(".pp-recent");
  await expect(recent.getByRole("heading", { name: "Recent Matches" })).toBeVisible();
  const rows = recent.locator(".pp-row");
  await expect(rows).toHaveCount(5);
  await expect(rows.locator(".pp-row-text strong")).toHaveText(["vs. Guest 43", "vs. Woolly", "vs. Guest 21", "vs. Ginger", "50 v 50"]);
  await expect(rows.locator(".pp-pill")).toHaveText(["WIN", "LOSS", "WIN", "WIN", "WIN"]);
  await expect(rows.locator(".pp-rpchange")).toHaveText(["+18", "−14", "+22", "—", "—"]);
  await expect(rows.nth(0).locator(".pp-row-text span")).toHaveText("Ranked · 2h ago");
  await expect(rows.nth(1).locator(".pp-row-text span")).toHaveText("Ranked · Yesterday");
  await expect(rows.nth(3).locator(".pp-row-text span")).toContainText("Casual · ");
  // (No row opens anything yet, so none has a chevron.)
  await expect(page.locator(".pp-row > svg")).toHaveCount(0);
  // A 1 v 1's face is their dressed pawn; a raid's is its boss's face; 50 v 50's a small mode icon.
  await expect(rows.nth(0).locator(".pp-face .avatar")).toHaveCount(1);
  await expect(rows.nth(3).locator(".pp-face-boss")).toHaveCount(1);
  await expect(rows.nth(4).locator(".pp-face-mode svg")).toHaveCount(1);
  expect(await rows.locator(".pp-pill").first().evaluate((e) => getComputedStyle(e).color)).not.toBe(await rows.locator(".pp-pill").nth(1).evaluate((e) => getComputedStyle(e).color));

  // Equipped Cosmetics: a tile for each worn item, its picture, name, "<Slot> · <colors>" and a rarity pill colored as the shop does.
  const cosmetics = page.locator(".pp-cosmetics");
  await expect(cosmetics.getByRole("heading", { name: "Equipped Cosmetics" })).toBeVisible();
  const tiles = cosmetics.locator(".pp-tile");
  await expect(tiles).toHaveCount(3);
  await expect(tiles.locator(".pp-tile-art .item-art svg")).toHaveCount(3);
  await expect(tiles.locator("strong")).toHaveText(["Suit and Tie", "Pirate Hat", "Gift-Wrap Tube"]);
  await expect(tiles.locator(".pp-tile-text > span:not(.pp-rarity)")).toHaveText(["Skin · Opal & Opal", "Head · Opal", "Weapon · Cobalt & Sage"]);
  await expect(tiles.locator(".pp-rarity")).toHaveText(["Epic", "Legendary", "Legendary"]);
  const color = (i: number) => tiles.nth(i).locator(".pp-rarity").evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await color(0)).toBe("rgb(192, 132, 252)");
  expect(await color(1)).toBe("rgb(251, 191, 36)");
  expect(await color(2)).toBe("rgb(251, 191, 36)");

  // Nothing private, ever.
  await expect(page.locator(".pp")).not.toContainText(/@|google|email|sign-?in|\bage\b|birth/i);
  expect(await noSideScroll(page)).toBe(0);
});

test("the layout: a phone is one column; a computer has the header card, Ranked Standing beside Recent Matches, then Cosmetics, each full width where it should be", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  for (const vp of sizes()) {
    await page.setViewportSize(vp);
    if (isComputer()) await expect(page.locator(".pp")).toHaveClass(/pp-wide/);
    else await expect(page.locator(".pp")).not.toHaveClass(/pp-wide/);
    const [card, ranked, recent, cosmetics] = [await box(page, ".pp-card"), await box(page, ".pp-ranked"), await box(page, ".pp-recent"), await box(page, ".pp-cosmetics")];
    const right = (b: { x: number; width: number }) => b.x + b.width;
    if (isComputer()) {
      // Side by side, the same top and height, the columns the mockup's 466 to 490 (was equal); the header card and Cosmetics across both.
      expect(Math.abs(ranked.y - recent.y), `${vp.width}: same top`).toBeLessThan(1);
      expect(Math.abs(ranked.height - recent.height), `${vp.width}: same height`).toBeLessThan(1);
      expect(right(ranked)).toBeLessThanOrEqual(recent.x);
      expect(Math.abs(ranked.width / recent.width - 466 / 490), `${vp.width}: the mockup's columns`).toBeLessThan(0.01);
      expect(cosmetics.y).toBeGreaterThanOrEqual(ranked.y + ranked.height);
      for (const wide of [card, cosmetics]) {
        expect(Math.abs(wide.x - ranked.x)).toBeLessThan(1);
        expect(Math.abs(right(wide) - right(recent))).toBeLessThan(1);
      }
      expect(card.y + card.height).toBeLessThanOrEqual(ranked.y);
      // The title sits left, by Back (the mockup's computer).
      const title = await box(page, ".pp-title");
      const back = await box(page, ".fd-back");
      expect(title.x).toBeLessThan(back.x + 200);
    } else {
      // One column, in order, the width of the screen less the mockup's 10.7 px each side (was 12).
      expect(card.y).toBeLessThan(ranked.y);
      expect(ranked.y + ranked.height).toBeLessThanOrEqual(recent.y);
      expect(recent.y + recent.height).toBeLessThanOrEqual(cosmetics.y);
      for (const b of [ranked, recent, cosmetics]) {
        expect(Math.abs(b.x - 10.7)).toBeLessThan(1);
        expect(Math.abs(b.width - (vp.width - 21.4))).toBeLessThan(1);
      }
    }
    expect(await noSideScroll(page), `${vp.width}: no sideways scroll`).toBe(0);
  }
});

/**
 * Eric: "no spacing of our own": every size and space on the page is his mockup's, measured from the image (1.028 image px to a css
 * px; docs/decisions/2026-10-29-public-profile-fit.md has the whole table). The numbers below are the mockup's, each with the
 * tolerance the decision gives it (±2 px for a space, ±4 for a card's height).
 */
test("the blocks' sizes and spaces are the mockup's: each card's height, the gaps between them, the padding inside", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  const near = (name: string, got: number, want: number, tol: number) => expect(Math.abs(got - want), `${name}: ${Math.round(got * 10) / 10}, the mockup's ${want}`).toBeLessThanOrEqual(tol);
  for (const vp of sizes()) {
    await page.setViewportSize(vp);
    // (Every number is one the page can't fake: a box's own edges, page coordinates.)
    const m = await page.evaluate(() => {
      const R = (s: string, i = 0) => {
        const r = document.querySelectorAll(s)[i]!.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width, h: r.height };
      };
      const wide = !!document.querySelector(".pp-wide");
      const root = R(".pp");
      const [card, ranked, recent, cos, actions, avatar] = [R(".pp-card"), R(".pp-ranked"), R(".pp-recent"), R(".pp-cosmetics"), R(".pp-actions"), R(".pp-avatar")];
      const rows = document.querySelectorAll(".pp-recent .pp-row").length;
      const lastRow = R(".pp-recent .pp-row", rows - 1);
      const tiles = [...document.querySelectorAll(".pp-tile")].map((_, i) => R(".pp-tile", i));
      const mid = (r: { t: number; b: number }) => (r.t + r.b) / 2;
      return {
        side: ranked.l - root.l,
        card, ranked, recent, cos,
        headToCard: card.t - R(".pp-head").b,
        cardToAvatar: avatar.t - card.t,
        avatarW: avatar.w,
        buttonsW: R(".pp-actions .fd-btn").w,
        buttonsH: R(".pp-actions .fd-btn").h,
        buttonGap: R(".pp-actions .fd-btn", 1).l - R(".pp-actions .fd-btn").r,
        buttonsToCardBottom: card.b - actions.b,
        buttonsToRanked: ranked.t - actions.b,
        cardToCols: ranked.t - card.b,
        rankedToRecent: wide ? recent.l - ranked.r : recent.t - ranked.b,
        colsToCos: cos.t - Math.max(ranked.b, recent.b),
        rankedTitleMid: mid(R(".pp-ranked .pp-panel-head")) - ranked.t,
        recentTitleMid: mid(R(".pp-recent .pp-panel-head")) - recent.t,
        cosTitleMid: mid(R(".pp-cosmetics .pp-panel-head")) - cos.t,
        recentFirstRow: R(".pp-recent .pp-row").t - recent.t,
        recentRowPitch: R(".pp-recent .pp-row", 1).t - R(".pp-recent .pp-row").t,
        recentLastToBottom: recent.b - lastRow.b,
        cosToTiles: tiles[0]!.t - cos.t,
        tileH: tiles[0]!.h,
        tileLeft: tiles[0]!.l - cos.l,
        tileGap: tiles[1]!.l - tiles[0]!.r,
        tilesToBottom: cos.b - tiles[0]!.b,
        pageH: document.documentElement.scrollHeight,
      };
    });
    const at = (s: string) => `${vp.width}, ${s}`;
    if (isComputer()) {
      near(at("the header card's height (no level line)"), m.card.h, 257.7, 3);
      near(at("Ranked's height"), m.ranked.h, 312.7, 4);
      near(at("Recent's height"), m.recent.h, 312.7, 4);
      near(at("Cosmetics' height"), m.cos.h, 175.1, 4);
      near(at("the page's side margin"), m.side, 15.5, 2);
      near(at("the header to its card"), m.headToCard, 12.6, 2);
      near(at("the card's top to the picture"), m.cardToAvatar, 2.9, 2);
      near(at("the picture"), m.avatarW, 113.5, 2);
      near(at("a button's width"), m.buttonsW, 205, 2);
      near(at("a button's height"), m.buttonsH, 51.5, 2);
      near(at("the gap between the buttons"), m.buttonGap, 14.6, 2);
      near(at("the buttons to the card's bottom"), m.buttonsToCardBottom, 14.6, 2);
      near(at("the header card to the two cards"), m.cardToCols, 12.6, 2);
      near(at("between Ranked and Recent"), m.rankedToRecent, 12.6, 2);
      near(at("the two cards to Cosmetics"), m.colsToCos, 12.6, 2);
      near(at("Ranked's top to its title's middle"), m.rankedTitleMid, 31.1, 2);
      near(at("Recent's top to its title's middle"), m.recentTitleMid, 27.2, 2);
      near(at("Cosmetics' top to its title's middle"), m.cosTitleMid, 23.3, 2);
      near(at("Recent's top to its first row"), m.recentFirstRow, 54, 2);
      near(at("a row's pitch"), m.recentRowPitch, 50.6, 1);
      near(at("the last row to Recent's bottom"), m.recentLastToBottom, 4.9, 2);
      near(at("Cosmetics' top to the tiles"), m.cosToTiles, 46.2, 2);
      near(at("a tile's height"), m.tileH, 113.8, 2);
      near(at("Cosmetics' left to the first tile"), m.tileLeft, 16, 2);
      near(at("the gap between tiles"), m.tileGap, 8, 2);
      near(at("the last tile to Cosmetics' bottom"), m.tilesToBottom, 15.1, 2);
    } else {
      near("Ranked's height", m.ranked.h, 218.9, 4);
      near("Recent's height", m.recent.h, 243.2, 4);
      near("Cosmetics' height", m.cos.h, 94, 4);
      near("the page's side margin", m.side, 10.7, 2);
      near("the header to the picture", m.cardToAvatar + m.headToCard, 3.9, 2);
      near("the picture", m.avatarW, 120.6, 2);
      near("a button's height", m.buttonsH, 49.6, 2);
      near("the gap between the buttons", m.buttonGap, 11.7, 2);
      near("the buttons to Ranked Standing", m.buttonsToRanked, 13.6, 2);
      near("between Ranked and Recent", m.rankedToRecent, 8.8, 2);
      near("between Recent and Cosmetics", m.colsToCos, 8.8, 2);
      near("Ranked's top to its title's middle", m.rankedTitleMid, 21.9, 2);
      near("Recent's top to its title's middle", m.recentTitleMid, 18.5, 2);
      near("Cosmetics' top to its title's middle", m.cosTitleMid, 15.6, 2);
      near("Recent's top to its first row", m.recentFirstRow, 34, 2);
      near("a row's pitch", m.recentRowPitch, 41.3, 1);
      near("the last row to Recent's bottom", m.recentLastToBottom, 2.4, 2);
      near("Cosmetics' top to the tiles", m.cosToTiles, 33.1, 2);
      near("a tile's height (the brief's 58)", m.tileH, 57, 3);
      near("Cosmetics' left to the first tile", m.tileLeft, 8.8, 2);
      near("the gap between tiles", m.tileGap, 5.8, 2);
      near("the last tile to Cosmetics' bottom", m.tilesToBottom, 4.5, 2);
      // The whole page at 390 × 844 with five matches and three items: about 950 (the director's), and no more.
      near("the page's height", m.pageH, 950, 20);
    }
  }
});

test("the mockup's three items fit whole, the color line too: a phone, and a computer from the narrowest two-column page (744) up", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  // (A computer's page is its center column: 744 at a 1256 px window, 768 at 1280, 888 at 1440. Was checked with a pixel of slack,
  // which let "Weapon · Cobalt & Sa…" through at 1280; now any overflow at all is a cut.)
  for (const vp of isComputer() ? [{ width: 1256, height: 800 }, ...sizes()] : sizes()) {
    await page.setViewportSize(vp);
    if (isComputer()) {
      await expect(page.locator(".pp")).toHaveClass(/pp-wide/);
      expect(Math.round((await box(page, ".pp")).width), `${vp.width}: the page's own width`).toBe(vp.width === 1256 ? 744 : vp.width === 1280 ? 768 : 888);
    }
    const cut = await page.locator(".pp-tile-text, .pp-tile-text > *").evaluateAll((es) => es.filter((e) => e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight).map((e) => e.textContent));
    expect(cut, `${vp.width}: nothing cut, no ellipsis`).toEqual([]);
    const tile3 = await page.locator(".pp-tile-text > span:not(.pp-rarity)").nth(2).evaluate((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      return { text: e.textContent, natural: r.getBoundingClientRect().width, room: (e.parentElement as HTMLElement).getBoundingClientRect().width };
    });
    expect(tile3.text).toBe("Weapon · Cobalt & Sage");
    expect(tile3.room, `${vp.width}: room for the longest line, whole`).toBeGreaterThanOrEqual(tile3.natural);
  }
});

test("the Ranked Standing menu: 1v1, 50 v 50, Squads; the others say Coming soon, and the card is the same height in every mode", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  for (const vp of sizes()) {
    await page.setViewportSize(vp);
    const ranked = page.locator(".pp-ranked");
    const trigger = ranked.getByRole("button", { name: /^Ranked mode/ });
    await expect(trigger).toHaveText("1v1");
    const before = await layout(page);
    // The menu: its three modes (1v1 chosen), over the page: nothing moves while it's open.
    await trigger.click();
    const menu = page.getByRole("menu", { name: /^Ranked mode/ });
    await expect(menu.getByRole("menuitemradio")).toHaveText(["1v1", "50 v 50", "Squads"]);
    await expect(menu.getByRole("menuitemradio", { name: "1v1" })).toHaveAttribute("aria-checked", "true");
    expect(await layout(page)).toEqual(before);
    for (const [mode, label] of [["50 v 50", "50 v 50"], ["Squads", "Squads"]] as const) {
      await menu.getByRole("menuitemradio", { name: mode }).click();
      await expect(menu).toHaveCount(0);
      await expect(trigger).toHaveText(label);
      await expect(ranked.getByText("Coming soon")).toBeVisible();
      // (1v1's numbers are gone from view, the card is the very same size, and nothing around it moved.)
      await expect(ranked.locator(".pp-tier")).toBeHidden();
      expect(await layout(page), `${vp.width}: ${mode}`).toEqual(before);
      // "Coming soon" sits in the middle of the card's body.
      const body = (await ranked.locator(".pp-body").boundingBox())!;
      const soon = (await ranked.getByText("Coming soon").boundingBox())!;
      expect(Math.abs(soon.x + soon.width / 2 - (body.x + body.width / 2))).toBeLessThan(2);
      expect(Math.abs(soon.y + soon.height / 2 - (body.y + body.height / 2))).toBeLessThan(2);
      await trigger.click();
    }
    // Back to 1v1; Escape closes a menu; a tap outside does too.
    await menu.getByRole("menuitemradio", { name: "1v1" }).click();
    await expect(ranked.locator(".pp-tier")).toHaveText("Gold 3");
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await page.locator(".pp-menu-scrim").click({ position: { x: 5, y: 5 } });
    await expect(menu).toHaveCount(0);
    expect(await layout(page)).toEqual(before);
  }
});

test("placements, no games and a ban: the card says so, in the same room", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  const full = await layout(page);
  const ranked = page.locator(".pp-ranked");
  const variants: [string, Record<string, unknown>, () => Promise<void>][] = [
    [
      "placements",
      { ranked1v1: { rank: rankView({ games: 2, ladder: null }), games: 2, wins: 1, losses: 1, draws: 0, peak: null, streak: 0, recent: [] } },
      async () => {
        await expect(ranked.locator(".pp-tier")).toHaveText("Placement 2/5");
        await expect(ranked.locator(".pp-badge")).toHaveText("2/5");
        await expect(ranked.locator("[data-emblem]")).toHaveCount(0);
        await expect(ranked.locator(".pp-stat strong")).toHaveText(["50%", "1 – 1", "0"]);
        await expect(ranked.locator(".pp-peak")).toHaveText("Peak rank: —");
      },
    ],
    [
      "no games",
      { ranked1v1: { rank: rankView(null), games: 0, wins: 0, losses: 0, draws: 0, peak: null, streak: 0, recent: [] } },
      async () => {
        await expect(ranked.locator(".pp-tier")).toHaveText("Unranked");
        await expect(ranked.locator(".pp-badge")).toBeVisible();
        await expect(ranked.locator("[data-emblem]")).toHaveCount(0);
        await expect(ranked.locator(".pp-stat strong")).toHaveText(["—", "0 – 0", "0"]);
        await expect(ranked.locator(".pp-peak")).toHaveText("Peak rank: —");
      },
    ],
    [
      "banned",
      { banned: true, ranked1v1: null },
      async () => {
        await expect(ranked.locator(".fp-banned")).toHaveText("Banned");
        // (Nothing else of it: no tier, no numbers, no emblem.)
        await expect(ranked.locator(".pp-tier")).toBeHidden();
        await expect(ranked.locator("[data-emblem]")).toBeHidden();
        await expect(ranked.locator(".pp-stats")).toBeHidden();
      },
    ],
  ];
  for (const [name, over, check] of variants) {
    await page.unroute(new RegExp(`/api/profile/${DEMO_ID}$`));
    await routeProfile(page, demoProfile(over));
    await page.goto(`/profile/${DEMO_ID}?nolanding`);
    await loaded(page);
    await check();
    expect(await layout(page), name).toEqual(full);
  }
  // Pearlescent and Transcendent: no division, their RP above the floor.
  await page.unroute(new RegExp(`/api/profile/${DEMO_ID}$`));
  await routeProfile(page, demoProfile({ ranked1v1: { ...demoProfile().ranked1v1, rank: rankView({ games: 5, ladder: 2800 + 120, place: 50 }) } }));
  await page.goto(`/profile/${DEMO_ID}?nolanding`);
  await expect(ranked.locator(".pp-tier")).toHaveText("Transcendent");
  await expect(ranked.locator(".pp-rp")).toHaveText("120 RP");
  await expect(ranked.locator('[data-emblem="transcendent"]')).toHaveCount(1);
});

test("1 v 1 games with no points (placements, one fair play held, one before the points were kept) show a dash; a deleted opponent's game still lists", async ({ page }) => {
  const hour = 3_600_000;
  const recent = [
    { opponent: { id: "deleted", name: "Deleted account", look: null }, result: "win", points: null, at: Date.now() - hour },
    { opponent: { id: "zed", name: "Zed", look: {} }, result: "draw", points: null, at: Date.now() - 2 * hour },
    { opponent: { id: "yan", name: "Yan", look: {} }, result: "loss", points: -9, at: Date.now() - 3 * hour },
  ];
  await openDemo(page, demoProfile({ ranked1v1: { ...demoProfile().ranked1v1, recent } }));
  await loaded(page);
  const rows = page.locator(".pp-row");
  await expect(rows.locator(".pp-row-text strong")).toHaveText(["vs. Deleted account", "vs. Zed", "vs. Yan", "vs. Ginger", "50 v 50"]);
  await expect(rows.locator(".pp-pill")).toHaveText(["WIN", "DRAW", "LOSS", "WIN", "WIN"]);
  await expect(rows.locator(".pp-rpchange")).toHaveText(["—", "—", "−9", "—", "—"]);
  // (A deleted account has no look: the default pawn.)
  await expect(rows.nth(0).locator(".pp-face .avatar")).toHaveCount(1);
});

test("every mode's row in Recent Matches: a raid, 50 v 50, Squads", async ({ page }) => {
  await openDemo(page, demoProfile({ ranked1v1: { ...demoProfile().ranked1v1, recent: [] } }));
  await loaded(page);
  const rows = page.locator(".pp-row");
  await expect(rows.locator(".pp-row-text strong")).toHaveText(["vs. Ginger", "50 v 50", "Squads"]);
  // The raid's boss fell: WIN with the boss's face; the 50 v 50 team won; Squads: their place.
  await expect(rows.locator(".pp-pill")).toHaveText(["WIN", "WIN", "3rd"]);
  await expect(rows.locator(".pp-rpchange")).toHaveText(["—", "—", "—"]);
  await expect(rows.nth(0).locator(".pp-face-boss canvas.bs-art")).toHaveCount(1);
  for (const row of [rows.nth(1), rows.nth(2)]) await expect(row.locator(".pp-face-mode svg")).toHaveCount(1);
  await expect(rows.nth(0).locator(".pp-row-text span")).toHaveText(/^Casual · /);
  // Three games: still the room of five rows (41.3 px a row on a phone, 50.6 on a computer; was 42).
  expect((await box(page, ".pp-rows")).height).toBeGreaterThanOrEqual(5 * (isComputer() ? 50.6 : 41.3) - 1);
});

test("View all: the full list of matches and each worn item's details open in sheets; with nothing, they're greyed", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  await page.locator(".pp-recent").getByRole("button", { name: /^View all/ }).click();
  const matches = page.getByRole("dialog", { name: "Recent matches" });
  // (Today's profile's list: the profile's own games, with their details.)
  await expect(matches.locator(".fd-match")).toHaveCount(3);
  await expect(matches).toContainText("Boss raid · Ginger 1500");
  await expect(matches).toContainText("Crowd · 50 v 50");
  await page.keyboard.press("Escape");
  await expect(matches).toHaveCount(0);
  await page.locator(".pp-cosmetics").getByRole("button", { name: /^View all/ }).click();
  const items = page.getByRole("dialog", { name: "Equipped cosmetics" });
  await expect(items.locator(".fd-item")).toHaveCount(3);
  // Purity, and Shiny at 90% or more (the suit's drawn 96% pure).
  await expect(items.locator(".fd-item").first()).toContainText("96% pure");
  await expect(items.locator(".fd-item").first()).toContainText("Shiny");
  await expect(items.locator(".fd-item").nth(1)).toContainText("80% pure");
  await expect(items.locator(".fd-item").nth(1)).not.toContainText("Shiny");
  await expect(items.locator(".fd-tier")).toHaveText(["Epic", "Legendary", "Legendary"]);
  await items.getByRole("button", { name: "Close" }).click();
  await expect(items).toHaveCount(0);
  // Nothing worn and no games: greyed, not gone; "Nothing equipped"; the cards the same size.
  const full = await layout(page);
  await page.unroute(new RegExp(`/api/profile/${DEMO_ID}$`));
  await routeProfile(page, demoProfile({ look: {}, recent: [], ranked1v1: { ...demoProfile().ranked1v1, recent: [] } }));
  await page.goto(`/profile/${DEMO_ID}?nolanding`);
  await loaded(page);
  await expect(page.locator(".pp-cosmetics").getByRole("button", { name: /^View all/ })).toBeDisabled();
  await expect(page.locator(".pp-recent").getByRole("button", { name: /^View all/ })).toBeDisabled();
  await expect(page.locator(".pp-cosmetics")).toContainText("Nothing equipped");
  await expect(page.locator(".pp-recent")).toContainText("No matches yet.");
  expect(await layout(page)).toEqual(full);
});

test("four worn items all fit, nothing cut", async ({ page }) => {
  const look = { ...MOCKUP_LOOK, face: { def: "smiley-face", color: "oceanic", blemish: 0, seed: 5 } };
  await openDemo(page, demoProfile({ look }));
  await loaded(page);
  for (const vp of sizes()) {
    await page.setViewportSize(vp);
    const tiles = page.locator(".pp-tile");
    await expect(tiles).toHaveCount(4);
    await expect(tiles.locator("strong")).toHaveText(["Suit and Tie", "Pirate Hat", "Smiley Face", "Gift-Wrap Tube"]);
    const card = await box(page, ".pp-cosmetics");
    // (Its words and pill, whole: inside the tile and none cut by its own box; the picture's box inside it too. The one allowance, as
    // the brief gave it: the color line, "Weapon · Cobalt & Sage", may end in an ellipsis when it's too long for the tile.)
    const fits = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".pp-tile")].map((t) => {
        const r = t.getBoundingClientRect();
        const inside = (c: Element) => {
          const b = c.getBoundingClientRect();
          return b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5;
        };
        const parts = [...t.querySelectorAll<HTMLElement>(".pp-tile-art, .pp-tile-text, .pp-tile-text > *")];
        const line = ".pp-tile-text > span:not(.pp-rarity)";
        return parts.length === 5 && parts.every((c) => inside(c) && (c.matches(".pp-tile-art") || (c.scrollHeight <= c.clientHeight + 1 && (c.matches(line) || c.scrollWidth <= c.clientWidth + 1))));
      }),
    );
    expect(fits, `${vp.width}: nothing cut`).toEqual([true, true, true, true]);
    for (let i = 0; i < 4; i++) {
      const t = (await tiles.nth(i).boundingBox())!;
      expect(t.x).toBeGreaterThanOrEqual(card.x);
      expect(t.x + t.width).toBeLessThanOrEqual(card.x + card.width);
      expect(t.y + t.height).toBeLessThanOrEqual(card.y + card.height);
    }
    // Four tiles in one row of four on a phone and on a computer (was two rows of two on a phone), each the height of the three-up tile.
    const ys = new Set(await tiles.evaluateAll((ts) => ts.map((t) => Math.round(t.getBoundingClientRect().top))));
    expect(ys.size).toBe(1);
    const th = isComputer() ? 113.8 : 56.4;
    for (let i = 0; i < 4; i++) expect(Math.abs((await tiles.nth(i).boundingBox())!.height - th), `${vp.width}: the tile's height`).toBeLessThan(1);
    expect(Math.abs(card.height - (isComputer() ? 175.1 : 95.5)), `${vp.width}: the card's height`).toBeLessThan(4);
  }
});

test("the icon behind the pawn: their drawing, blurred and faded, filling the circle; with none of their own, the theme's light yellow", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await openDemo(page, demoProfile(), { scheme });
    await loaded(page);
    const circle = page.locator(".pp-circle");
    // Default pawn icon: the theme's yellow, and no drawing.
    await expect(circle).toHaveAttribute("data-backdrop", "default");
    await expect(circle.locator(".pp-backdrop")).toHaveCount(0);
    const yellow = await page.evaluate(() => {
      const probe = document.createElement("i");
      probe.style.background = "var(--fd-gold-soft)";
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    expect(await circle.evaluate((e) => getComputedStyle(e).backgroundColor), scheme).toBe(yellow);
    expect(yellow).not.toBe("rgba(0, 0, 0, 0)");
    // The pawn is still in the circle, and the circle is round.
    await expect(circle.locator(".avatar")).toHaveCount(1);
    expect(await circle.evaluate((e) => getComputedStyle(e).borderRadius)).toBe("50%");

    // A drawn icon: scaled to fill the circle (a little over), blurred, faded.
    const icon = await skyIcon(page);
    await page.unroute(new RegExp(`/api/profile/${DEMO_ID}$`));
    await routeProfile(page, demoProfile({ icon }));
    await page.goto(`/profile/${DEMO_ID}?nolanding`);
    await loaded(page);
    await expect(circle).toHaveAttribute("data-backdrop", "icon");
    const art = circle.locator("img.pp-backdrop");
    await expect(art).toHaveAttribute("src", icon);
    const style = await art.evaluate((e) => ({ filter: getComputedStyle(e).filter, opacity: Number(getComputedStyle(e).opacity) }));
    expect(style.filter).toMatch(/blur\(/);
    expect(style.opacity).toBeGreaterThan(0.4);
    expect(style.opacity).toBeLessThan(1);
    const c = (await circle.boundingBox())!;
    const a = (await art.boundingBox())!;
    expect(a.x).toBeLessThanOrEqual(c.x);
    expect(a.y).toBeLessThanOrEqual(c.y);
    expect(a.x + a.width).toBeGreaterThanOrEqual(c.x + c.width);
    expect(a.y + a.height).toBeGreaterThanOrEqual(c.y + c.height);
    // (Behind the pawn, clipped to the circle.)
    expect(await circle.evaluate((e) => getComputedStyle(e).overflow)).toBe("hidden");
    expect(await art.evaluate((e) => getComputedStyle(e).position)).toBe("absolute");
    // No ring round it: the circle has no border.
    expect(await circle.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("0px");
  }
});

test("online: a dot at the picture's lower right and 'Online now'; last seen with no dot; hidden: just when they joined", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  const dot = page.locator(".pp-online");
  await expect(dot).toBeVisible();
  const c = (await box(page, ".pp-circle"));
  const d = (await dot.boundingBox())!;
  expect(d.x + d.width / 2).toBeGreaterThan(c.x + c.width * 0.7);
  expect(d.y + d.height / 2).toBeGreaterThan(c.y + c.height * 0.7);
  expect(await dot.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

  const twoHours = Date.now() - 2 * 3_600_000;
  const cases: [string, Record<string, unknown>, string, boolean][] = [
    ["offline", { online: false, lastSeen: twoHours }, "Last seen 2h ago · Joined Oct 2026", false],
    ["hidden", { online: false, lastSeen: null, hidden: true }, "Joined Oct 2026", false],
  ];
  const before = await layout(page);
  for (const [name, over, line, dotShown] of cases) {
    await page.unroute(new RegExp(`/api/profile/${DEMO_ID}$`));
    await routeProfile(page, demoProfile(over));
    await page.goto(`/profile/${DEMO_ID}?nolanding`);
    await loaded(page);
    await expect(page.locator(".pp-seen"), name).toHaveText(line);
    await expect(page.locator(".pp-seen .fd-dot"), name).toHaveCount(dotShown ? 1 : 0);
    await expect(page.locator(".pp-online"), name).toHaveCount(0);
    expect(await layout(page), name).toEqual(before);
  }
});

test("the level: an admin sees Level 38; a player's page has no level line, and no room kept for one", async ({ page, browser }) => {
  await openDemo(page, demoProfile(), { admin: true });
  await loaded(page);
  await expect(page.locator(".pp-level")).toHaveText("Level 38");
  const admin = await layout(page);
  const player2 = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await openDemo(player2);
  await loaded(player2);
  // (Was an empty line of 22 px, kept for every player.)
  await expect(player2.locator(".pp-level")).toHaveCount(0);
  const mine = await layout(player2);
  // The admin's buttons and everything under them sit one line lower (23.8 to 24.4 px: the line's 20 and its space); the cards are the same size.
  const shift = admin[".pp-actions"]![1]! - mine[".pp-actions"]![1]!;
  expect(shift).toBeGreaterThan(22);
  expect(shift).toBeLessThan(26);
  for (const s of [".pp-ranked", ".pp-recent", ".pp-cosmetics"]) {
    expect(Math.abs(mine[s]![3]! - admin[s]![3]!), s).toBeLessThan(0.25);
    expect(Math.abs(admin[s]![1]! - mine[s]![1]! - shift), s).toBeLessThan(0.25);
  }
  await player2.context().close();
});

test("nothing shifts while it loads: every part is where it will be, at the size it will be", async ({ page }) => {
  await openDemo(page, demoProfile(), { delay: 6000 });
  await expect(page.locator(".pp.pp-loading")).toBeVisible();
  for (const vp of sizes()) {
    await page.setViewportSize(vp);
    const wait = await layout(page);
    const waitHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    // Still waiting: Back is there, and the buttons are greyed, not gone.
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Challenge" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add Friend" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "More options" })).toBeDisabled();
    await expect(page.locator(".pp-tile")).toHaveCount(3);
    await expect(page.locator(".pp-row")).toHaveCount(5);
    if (vp === sizes().at(-1)) {
      await loaded(page);
      expect(await layout(page)).toEqual(wait);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(waitHeight);
      await expect(page.locator(".pp-tile")).toHaveCount(3);
    }
  }
});

test("nothing shifts when a note appears: it's a toast over the page's bottom, in no card's room", async ({ page }) => {
  await openDemo(page);
  await loaded(page);
  const before = await layout(page);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  // (Was a line kept under the buttons, 20 px or more, empty or not.)
  await expect(page.locator(".pp-note")).toHaveCount(0);
  // A refusal, as the server would say it.
  await page.route("**/api/friends/request", (route) => route.fulfill({ status: 400, json: { message: "This is a note." } }));
  await page.getByRole("button", { name: "Add Friend" }).click();
  await expect(page.locator(".fr-note")).toHaveText(/\S/);
  await expect(page.locator(".pp-note")).toBeVisible();
  expect(await page.locator(".pp-note").evaluate((e) => getComputedStyle(e).position)).toBe("fixed");
  expect(await layout(page)).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
});

test("your own page: from your pawn, today's profile with View public profile at its top; it opens yours with Challenge, Add Friend and ••• greyed", async ({ page }) => {
  await named(page, "Eric");
  await switchesOff(page);
  await page.goto("/");
  await expect(page.locator(".fd-hero-name")).toHaveText("Eric");
  const id = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).then((p) => p.user.id as string));
  await page.getByRole("button", { name: "Your profile" }).click();
  // Today's profile, unchanged but for one line at its top.
  await expect(page.getByRole("heading", { name: "Eric", level: 1 })).toBeVisible();
  const view = page.getByRole("button", { name: "View public profile" });
  await expect(view).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open locker" })).toBeVisible();
  // (Right at the top: the first thing under the header, above the card.)
  const head = await box(page, ".fd-profile > .fd-page-head");
  const line = await box(page, ".fd-view-public");
  const card = await box(page, ".fd-profile .fd-card");
  expect(line.y).toBeGreaterThanOrEqual(head.y + head.height);
  expect(line.y + line.height).toBeLessThanOrEqual(card.y);
  await view.click();
  // The public page, as others see you: the same page, with the two buttons and ••• greyed.
  await expect(page.getByRole("heading", { name: "Player Profile", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eric", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/profile/${id}$`));
  await expect(page.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add Friend" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "More options" })).toBeDisabled();
  await expect(page.locator(".pp-seen")).toContainText("Online now · Joined");
  await expect(page.locator(".pp-level")).toHaveCount(0);
  // Nothing from today's profile (your coins, edit, locker) leaks onto it.
  await expect(page.locator(".pp")).not.toContainText(/coins|Edit name|locker/i);
  // Back is to your profile.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  // (Your own, loaded again from the address, is the public page too: the link others use.)
  await page.goto(`/profile/${id}?nolanding`);
  await expect(page.getByRole("heading", { name: "Player Profile", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Challenge" })).toBeDisabled();
  // (A request the page made while loading may still be in the config's route when the test ends.)
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("an admin's ?rank= shows on their own public page, as on their profile", async ({ page }) => {
  await named(page, "Rank Admin");
  await page.goto("/?rank=gold-3");
  await expect(page.locator(".fd-hero-name")).toHaveText("Rank Admin");
  await page.getByRole("button", { name: "Your profile" }).click();
  await page.getByRole("button", { name: "View public profile" }).click();
  await expect(page.locator(".pp-tier")).toHaveText("Gold 3");
  await expect(page.locator('.pp-ranked [data-emblem="gold-d3"]')).toHaveCount(1);
});

test("a tap on another player's name opens the public profile; Challenge sends today's invite", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const ann = await player(browser, "Ann Pub");
  const bo = await player(browser, "Bo Pub");
  // Ann makes a lobby and Bo joins it; her lobby lists Bo, and his name opens his public profile.
  await ann.page.goto("/?debug&mode=crowd");
  await createLobbyFromHome(ann.page);
  await expect(ann.page.getByRole("heading", { name: /^Lobby / })).toBeVisible();
  const code = (await ann.page.locator(".invite-code").textContent())!.trim();
  await bo.page.goto(`/lobby/${code}?debug`);
  await joinFromInvite(bo.page);
  await expect(ann.page.locator(".lobby-players li")).toHaveCount(2);
  await ann.page.locator(".lobby-players").getByRole("button", { name: "Bo Pub's profile" }).click();
  const sheet = ann.page.locator(".fd-overlay");
  await expect(sheet.getByRole("heading", { name: "Player Profile", level: 1 })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Bo Pub", level: 2 })).toBeVisible();
  await expect(sheet.locator(".pp-seen")).toContainText("Online now");
  await expect(sheet.getByRole("button", { name: "Add Friend" })).toBeEnabled();
  // (In a lobby of yours there is a game to invite them to; it's yours, so Challenge is on.)
  await expect(sheet.getByRole("button", { name: "Challenge" })).toBeEnabled();
  await expect(sheet).not.toContainText(/@|google|email/i);
  await sheet.getByRole("button", { name: "Back", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  for (const p of [ann.page, bo.page]) await p.getByRole("button", { name: "Leave" }).click();

  // At the front door, Ann opens Bo's page by its address and challenges him: today's invite: a lobby made for him, Bo's toast.
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await expect(ann.page.getByRole("heading", { name: "Bo Pub", level: 2 })).toBeVisible();
  await ann.page.getByRole("button", { name: "Challenge" }).click();
  await expect(ann.page.getByRole("heading", { name: /^Lobby [A-Z2-9]{5}$/ })).toBeVisible();
  await expect(bo.page.locator(".fr-toast")).toContainText("Ann Pub invited you to a Crowd lobby", { timeout: 25_000 });
});

test("Add Friend, Block and Report from the page: a request, the ••• menu with today's two-tap block, today's report sheet", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const ann = await player(browser, "Ann Menu");
  const bo = await player(browser, "Bo Menu");
  await ann.page.goto(`/profile/${bo.id}?nolanding`);
  await expect(ann.page.getByRole("heading", { name: "Bo Menu", level: 2 })).toBeVisible();
  // Add Friend: today's request, its note, and where you stand now.
  await ann.page.getByRole("button", { name: "Add Friend" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("Request sent.");
  await expect(ann.page.getByRole("button", { name: "Cancel Request" })).toBeVisible();
  // The ••• menu: Block and Report. Report opens today's sheet, with its reasons.
  await ann.page.getByRole("button", { name: "More options" }).click();
  const menu = ann.page.getByRole("menu", { name: "More options" });
  await expect(menu.getByRole("menuitem")).toHaveText(["Block", "Report"]);
  await menu.getByRole("menuitem", { name: "Report" }).click();
  const report = ann.page.getByRole("dialog", { name: "Report Bo Menu" });
  for (const reason of ["Cheating", "Offensive name or icon", "Something else"]) await expect(report.getByRole("button", { name: reason, exact: true })).toBeVisible();
  await report.getByRole("button", { name: "Offensive name or icon", exact: true }).click();
  await expect(report.getByText("Thanks, we'll look into it.")).toBeVisible();
  await report.getByRole("button", { name: "Close" }).click();
  await expect(report).toHaveCount(0);
  // Block: a first tap asks, a second blocks (as on today's profile); then Unblock is in the menu and Challenge is greyed.
  await ann.page.getByRole("button", { name: "More options" }).click();
  await menu.getByRole("menuitem", { name: "Block" }).click();
  await expect(menu.getByRole("menuitem", { name: "Tap again to block" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Tap again to block" }).click();
  await expect(menu).toHaveCount(0);
  await expect(ann.page.locator(".fr-note")).toHaveText("Bo Menu is blocked: no requests, invites or chat from them.");
  await expect(ann.page.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(ann.page.getByRole("button", { name: "Add Friend" })).toBeDisabled();
  await ann.page.getByRole("button", { name: "More options" }).click();
  await expect(menu.getByRole("menuitem")).toHaveText(["Unblock", "Report"]);
  await menu.getByRole("menuitem", { name: "Unblock" }).click();
  await expect(ann.page.locator(".fr-note")).toHaveText("Bo Menu is unblocked.");
  await expect(ann.page.getByRole("button", { name: "Challenge" })).toBeEnabled();
});

test("a guest where friends are off: Challenge, Add Friend and Block greyed (not gone); Report still works", async ({ page }) => {
  await named(page, "Viewer");
  await switchesOff(page);
  await page.route("**/api/friends", (route) => route.fulfill({ json: { off: true } }));
  await page.goto("/?nolanding");
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  await routeProfile(page, demoProfile());
  await page.goto(`/profile/${DEMO_ID}?nolanding`);
  await loaded(page);
  await expect(page.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add Friend" })).toBeDisabled();
  await page.getByRole("button", { name: "More options" }).click();
  await expect(page.getByRole("menuitem", { name: "Block" })).toBeDisabled();
  await page.getByRole("menuitem", { name: "Report" }).click();
  await expect(page.getByRole("dialog", { name: "Report HunChess" })).toBeVisible();
});

test("each rarity's pill is the shop's: dark ink on the tier's color, Common gray to Mythic rose", async ({ page }) => {
  const sets: [Record<string, unknown>, string[], string[]][] = [
    [
      {
        skin: { def: "tree-tee", color: "red", blemish: 30, seed: 1 },
        head: { def: "antlers", color: "red", blemish: 30, seed: 1 },
        face: { def: "dark-shades", color: "red", blemish: 30, seed: 1 },
        weapon: { def: "gift-tube", color: "red", blemish: 30, seed: 1 },
      },
      ["Common", "Uncommon", "Rare", "Legendary"],
      ["rgb(156, 163, 175)", "rgb(74, 222, 128)", "rgb(96, 165, 250)", "rgb(251, 191, 36)"],
    ],
    [
      { skin: { def: "snowman", color: "red", blemish: 30, seed: 1 }, head: { def: "fire-ice-crown", color: "red", blemish: 30, seed: 1 } },
      ["Epic", "Mythic"],
      ["rgb(192, 132, 252)", "rgb(244, 63, 94)"],
    ],
  ];
  await openDemo(page, demoProfile({ look: sets[0]![0] }));
  for (const [look, names, colors] of sets) {
    await page.unroute(new RegExp(`/api/profile/${DEMO_ID}$`));
    await routeProfile(page, demoProfile({ look }));
    await page.goto(`/profile/${DEMO_ID}?nolanding`);
    await loaded(page);
    const pills = page.locator(".pp-rarity");
    await expect(pills).toHaveText(names);
    expect(await pills.evaluateAll((ps) => ps.map((p) => getComputedStyle(p).backgroundColor))).toEqual(colors);
    expect(await pills.evaluateAll((ps) => ps.map((p) => getComputedStyle(p).color))).toEqual(names.map(() => "rgb(20, 22, 27)"));
  }
});
