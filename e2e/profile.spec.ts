import { devices, expect, type Page } from "@playwright/test";
import { ITEM_DEFS, SHOP_ITEMS, rankView, wornFromLocker } from "@chessroyale/core";
import { asServerAdmin, giveItems, named, soloFromHome, switchesOff, test, openBossRaid, wearItem } from "./helpers.ts";

const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("your profile: tap your pawn; the same structure as anyone's, with your own actions", async ({ page }) => {
  await named(page, "Eric");
  // A player (this server has TEST_SWITCHES on, which gives home an admin's test level and lets `?rank=` count: the app is
  // told otherwise, as hunchess.com tells a player), so home shows the rank line a player sees.
  await switchesOff(page);
  await page.goto("/");
  // (Once this device's account exists.)
  await expect(page.locator(".fd-hero-name")).toHaveText("Eric");
  // Something to show: a result with a rating, recorded the way a solo match records it.
  await page.evaluate(() =>
    fetch("/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "crowd", placement: 3, players: 100, team: "w", rating: 1612, brilliant: 1, bestMove: "Nxe5", cuts: 11, cutsSurvived: 11 }),
    }),
  );
  // Something to wear: a crate item, worn in its slot.
  await page.evaluate(async () => {
    const post = (path: string, body: object) =>
      fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await post("/api/locker/open", { crate: "winter-1" });
    const { items } = await fetch("/api/locker").then((r) => r.json());
    for (const slot of ["head", "face", "skin", "weapon"]) if ((await post("/api/locker/equip", { slot, item: items[0].id })).ok) break;
  });
  await page.reload();
  // A solo game counts in your stats, never your ranking: that takes a match with 30% real players. Home's line is your
  // 1 v 1 rank (Oct 28): none played yet.
  await expect(page.locator(".fd-hero-sub")).toHaveText("Unranked");
  // A rating, as a ranked match would leave it, and a 1 v 1 rank (an e2e can't seat 30 people nor play hundreds of ranked
  // games, so from here the server's answers carry them; the server's side is in its unit tests, live.test.ts and
  // ranked-store.test.ts).
  const rank = rankView({ games: 40, ladder: 1245 });
  const ranked = { rating: 1612, ranked1v1: { rank, games: 40, wins: 22, losses: 17, draws: 1, peak: rank, streak: 2, recent: [] } };
  for (const url of [/\/api\/me(\?|$)/, /\/api\/profile\/[\w-]+$/]) {
    await page.route(url, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), ...ranked } });
    });
  }
  await page.reload();
  // Home names your 1 v 1 rank under your name, the tier in its color; no rating rank's name (retired Oct 28).
  await expect(page.locator(".fd-hero-sub")).toHaveText("Paragon 5 · 45 RP");
  await expect(page.locator(".fd-hero-sub .fd-rank")).toHaveText("Paragon 5");
  await page.getByRole("button", { name: "Your profile" }).click();
  await expect(page.getByRole("heading", { name: "Eric" })).toBeVisible();
  await expect(page.getByText("Online now")).toBeVisible();
  // The card: the 1 v 1 rank's pill, then the rating's number alone.
  await expect(page.locator(".fd-pills .fd-card-rank")).toHaveText("Paragon 5 · 45 RP");
  await expect(page.locator(".fd-pills")).toContainText("Rating 1612");
  await expect(page.locator(".fd-pills")).not.toContainText(/Weighty|Novice|Expert/);
  await expect(page.getByRole("button", { name: "Edit name & icon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open locker" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report", exact: true })).toHaveCount(0);
  // Wearing shows the item itself (its drawing, in its color), not a color swatch.
  await expect(page.locator(".fd-item .fd-thumb .item-art svg")).toHaveCount(1);
  // Stats: Crowd and Boss raid tabs, real numbers.
  const tiles = page.locator(".fd-stat");
  await expect(tiles.filter({ hasText: "games" })).toContainText("1");
  await expect(tiles.filter({ hasText: "best finish" })).toContainText("3rd");
  await expect(tiles.filter({ hasText: "cuts survived" })).toContainText("100%");
  await page.getByRole("tab", { name: "Boss raid" }).click();
  await expect(tiles.filter({ hasText: "raids" })).toContainText("0");
  await expect(page.getByText("BOSS TIERS BEATEN · 0 / 10")).toBeVisible();
  await expect(page.locator(".fd-match")).toContainText("Best move Nxe5");
  // Rename.
  await page.getByRole("button", { name: "Edit name & icon" }).click();
  await page.getByLabel("Your name").fill("Hunter");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("heading", { name: "Hunter" })).toBeVisible();
  // Settings from here, and back home.
  await page.getByRole("button", { name: "Settings" }).first().click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".fd-hero-name")).toHaveText("Hunter");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("an admin's locker has one of every item, each tagged Admin, worn like any item and never deleted; a player's only theirs", async ({ page }) => {
  await named(page, "Eric");
  const crate = page.locator(".locker-grid").first();
  const fromShop = page.locator(".locker-grid").nth(1);
  // A player: only what they own (nothing yet), the God King's starter effect.
  await page.goto("/shop");
  await page.getByRole("tab", { name: "Locker" }).click();
  await expect(page.getByText("No crate items here yet. Open a crate!")).toBeVisible();
  await expect(page.locator(".locker-item")).toHaveCount(1);
  await expect(page.locator(".locker-admin")).toHaveCount(0);
  // An admin (ADMIN_EMAILS, docs/decisions/2026-10-31-admin-owns-all.md): one of every crate item and God King effect.
  const id = await asServerAdmin(page);
  await page.reload();
  await page.getByRole("tab", { name: "Locker" }).click();
  await expect(crate.locator(".locker-item")).toHaveCount(ITEM_DEFS.length);
  await expect(crate.locator(".locker-admin")).toHaveCount(ITEM_DEFS.length);
  const kings = SHOP_ITEMS.filter(wornFromLocker);
  await expect(fromShop.locator(".locker-item")).toHaveCount(kings.length);
  await expect(fromShop.locator(".locker-admin")).toHaveCount(kings.filter((k) => !k.starter).length);
  // Worn like any item, and others see it.
  const crown = crate.getByRole("button", { name: /^Fire & Ice Crown, / });
  await crown.click();
  await expect(crown.locator(".locker-worn")).toHaveText("Worn");
  await expect.poll(async () => ((await (await page.request.get(`/api/profile/${id}`)).json()) as { look: { head?: { def: string } } }).look.head?.def).toBe("fire-ice-crown");
  // Never deleted: holding (or right-clicking) an admin copy opens nothing, and letting go after a hold isn't a tap.
  await crown.click({ button: "right" });
  await page.waitForTimeout(700);
  await expect(page.locator(".locker-dialog")).toHaveCount(0);
  await expect(crown.locator(".locker-worn")).toHaveText("Worn");
  await crown.hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.locator(".locker-dialog")).toHaveCount(0);
  await expect(crown.locator(".locker-worn")).toHaveText("Worn");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("home → queue → match, then tap a name for that player's profile (phone and computer)", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run plays both a phone and a computer");
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const phone = await (await browser.newContext({ ...devices["iPhone 13"], browserName: undefined } as any)).newPage();
  await named(desk, "Desky");
  await named(phone, "Phoney");
  // A boss raid's queue: no teams, so each sees the other on the leaderboard.
  for (const p of [desk, phone]) {
    // (A queue of its own, so other tests' players don't land in it.)
    await p.goto("/?debug&pool=profile");
    await openBossRaid(p);
  }
  // Both join back to back: here bots fill the raid 8 s after its first join (MATCH_FILL_SECONDS), and a page load in
  // between can outlast that.
  for (const p of [desk, phone]) {
    await p.getByRole("button", { name: /^Join a raid/ }).click();
    await expect(p.locator(".fd-seats")).toBeVisible();
  }
  await expect(desk.locator(".fd-seats .fd-seat")).toHaveCount(50);
  await expect(desk.locator(".fd-seat:not(.empty)")).toHaveCount(2);
  // (A Default raid: bots fill the crowd when its minute is up.)
  await expect(desk.locator(".fd-queue-line")).toContainText("then bots fill the rest");
  // A pawn in the queue opens that player's profile too.
  await desk.getByRole("button", { name: "Phoney's profile" }).click();
  await expect(desk.locator(".fd-overlay").getByRole("heading", { name: "Phoney" })).toBeVisible();
  await desk.locator(".fd-overlay").getByRole("button", { name: "Back", exact: true }).click();
  // Into the raid (8 s locally, then the boss's intro).
  for (const p of [desk, phone]) await expect.poll(() => phase(p), { timeout: 60_000 }).toMatch(/boss|play/);
  // Computer: the leaderboard beside the board; tap the other player's name.
  await desk.locator(".tower-side").getByRole("button", { name: "Phoney's profile" }).click();
  const sheet = desk.locator(".fd-overlay");
  await expect(sheet.getByRole("heading", { name: "Phoney" })).toBeVisible();
  // (Oct 28: another player's page is the public profile: Block and Report are in its ••• menu.)
  await expect(sheet.getByRole("button", { name: "More options" })).toBeEnabled();
  await expect(sheet.getByRole("button", { name: "Add Friend" })).toBeEnabled();
  // (Mid-match there's no game of yours to invite them to: Challenge is greyed, not gone.)
  await expect(sheet.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Edit name & icon" })).toHaveCount(0);
  await expect(sheet).not.toContainText(/@|Google|email/i);
  await sheet.getByRole("button", { name: "Back", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  // Phone: open the leaderboard, tap the other player's name.
  await expect.poll(() => phase(phone), { timeout: 30_000 }).toBe("play");
  // (A boss screen's scoreboard on a phone: the panel beside the God King, opened full size by a tap, since Oct 25.)
  await phone.locator(".dk-panel .bp-tower").click();
  await phone.getByRole("dialog", { name: "Leaderboard" }).getByRole("button", { name: "Desky's profile" }).click();
  await expect(phone.locator(".fd-overlay").getByRole("heading", { name: "Desky" })).toBeVisible();
  await expect(phone.locator(".fd-overlay")).toContainText("Online now");
  // Report them (from the ••• menu): a reason, then the thanks. The report is about this match: a second one in it isn't counted again.
  await phone.locator(".fd-overlay").getByRole("button", { name: "More options" }).click();
  await phone.getByRole("menuitem", { name: "Report", exact: true }).click();
  for (const reason of ["Cheating", "Offensive name or icon", "Something else"]) await expect(phone.getByRole("button", { name: reason, exact: true })).toBeVisible();
  await phone.getByRole("button", { name: "Cheating", exact: true }).click();
  await expect(phone.getByText("Thanks, we'll look into it.")).toBeVisible();
  await phone.getByRole("dialog", { name: "Report Desky" }).getByRole("button", { name: "Close" }).click();
  await phone.locator(".fd-overlay").getByRole("button", { name: "More options" }).click();
  await phone.getByRole("menuitem", { name: "Report", exact: true }).click();
  await phone.getByRole("button", { name: "Something else", exact: true }).click();
  await expect(phone.getByText("You've already reported this player in this match.")).toBeVisible();
});

test("in a match: a bot's name opens a bot's card, yours opens your profile", async ({ page }) => {
  test.setTimeout(2 * 60_000);
  await named(page, "Solo");
  await page.goto("/?debug&pace=quick&mode=crowd&augments=0");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toMatch(/play|watching/);
  const board = test.info().project.name === "desktop" ? page.locator(".tower-side") : page.getByRole("dialog", { name: "Leaderboard" });
  if (test.info().project.name !== "desktop") await page.locator(".mini-tower-title").click();
  await board.locator(".tower-row:not(.you) .player-name").first().click();
  await expect(page.locator(".fd-overlay")).toContainText("Bots fill the empty seats in a match");
  await page.locator(".fd-overlay").getByRole("button", { name: "Back", exact: true }).click();
  await board.getByRole("button", { name: "Your profile" }).click();
  await expect(page.locator(".fd-overlay").getByRole("heading", { name: "Solo" })).toBeVisible();
  await expect(page.locator(".fd-overlay").getByRole("button", { name: "Edit name & icon" })).toBeVisible();
});

test("rides (Oct 31): the locker's Ride tab wears one; the preview's pawns ride it, in its idle, in boxes that don't move or grow; your profile's pawn rides it and Wearing lists it; off again, the pawn alone", async ({ page }) => {
  await named(page, "Rider");
  await page.goto("/");
  await expect(page.locator(".fd-hero-name")).toHaveText("Rider");
  // (No crate holds a ride yet; only admins have them. Given straight, as admins will own them.)
  await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 40 }]);
  await page.reload();
  await page.getByRole("button", { name: "Your profile" }).click();
  await page.getByRole("button", { name: "Open locker" }).click();
  const previews = page.locator(".locker-preview .locker-avatar");
  await expect(previews).toHaveCount(2);
  const boxes = () => page.locator(".locker-preview, .locker-preview .locker-avatar, .locker-tabs").evaluateAll((els) => els.map((e) => [...Object.values(e.getBoundingClientRect().toJSON())].map((v) => Math.round(Number(v) * 10) / 10)));
  const before = await boxes();
  await expect(page.locator(".locker-preview .avatar.riding")).toHaveCount(0);
  await page.getByRole("tab", { name: "Ride", exact: true }).click();
  const tile = page.getByRole("button", { name: /^Riding Chirp, Cobalt, purity 60\.0%/ });
  // Its tile: the ride with a pawn on it, drawn (not a stand-in).
  await expect(tile.locator(".item-art svg path")).not.toHaveCount(0);
  await tile.click();
  await expect(tile).toContainText("Worn");
  const riding = page.locator('.locker-preview .avatar.riding[data-ride="riding-chirp"]');
  await expect(riding).toHaveCount(2);
  // The pawns ride it inside the same boxes: nothing moved or grew (Eric's "nothing shifts").
  expect(await boxes()).toEqual(before);
  for (const r of await riding.all()) {
    const a = (await r.boundingBox())!;
    const box = (await r.locator("xpath=..").boundingBox())!;
    expect([a.x, a.y, a.width, a.height]).toEqual([box.x, box.y, box.width, box.height]);
  }
  // Its idle plays: the drawing changes over a couple of seconds.
  const pic = () => riding.first().innerHTML();
  const first = await pic();
  await expect.poll(pic, { timeout: 5_000 }).not.toBe(first);
  // Your profile: your pawn rides it, and Wearing lists it with its slot. (The locker's Back goes home.)
  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await page.getByRole("button", { name: "Your profile" }).click();
  await expect(page.locator('.fd-card .avatar.riding[data-ride="riding-chirp"]')).toHaveCount(1);
  await expect(page.locator(".fd-item").filter({ hasText: "Riding Chirp" })).toContainText("Ride · Cobalt · 60% pure");
  // Off again: the pawn alone, in the same boxes.
  await page.getByRole("button", { name: "Open locker" }).click();
  await page.getByRole("tab", { name: "Ride", exact: true }).click();
  await page.getByRole("button", { name: /^Riding Chirp, Cobalt/ }).click();
  await expect(page.locator(".locker-preview .avatar.riding")).toHaveCount(0);
  await expect(page.locator(".locker-preview .avatar")).toHaveCount(2);
  expect(await boxes()).toEqual(before);
});

test("rides on home (Nov 1): the big pawn and your ring ride Riding Chirp, its idle playing, in the same boxes (nothing grows or moves); off again, the pawn alone", async ({ page }) => {
  await named(page, "Rider");
  await page.goto("/");
  await expect(page.locator(".fd-hero-name")).toHaveText("Rider");
  const [ride] = await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 40 }]);
  await page.reload();
  await expect(page.locator(".fd-hero-name")).toHaveText("Rider");
  // (The boxes the pawn is in: the card, the pawn, its box, and your ring; whatever it wears, they are these.)
  const boxes = () =>
    page.locator(".fd-hero, .fd-hero .fd-pawn-hero, .fd-hero .fd-pawn-box, .fd-ring, .fd-ring .fd-pawn-box, .fd-play-col").evaluateAll((els) => els.map((e) => Object.values(e.getBoundingClientRect().toJSON()).map((v) => Math.round(Number(v) * 10) / 10)));
  await expect(page.locator(".fd-hero .avatar")).toHaveCount(1);
  await expect(page.locator(".avatar.riding")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const before = await boxes();
  await wearItem(page, "ride", ride!);
  await page.reload();
  await expect(page.locator(".fd-hero .avatar.riding[data-ride=\"riding-chirp\"]")).toHaveCount(1);
  // Your ring rides too (a phone's top bar; a computer's top right and its side menu's Profile item).
  await expect(page.locator(".fd-ring:visible .avatar.riding")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  expect(await boxes(), "nothing grew or moved when the pawn mounted").toEqual(before);
  // The ride fills the pawn's own box and its idle plays.
  const riding = page.locator(".fd-hero .avatar.riding");
  const a = (await riding.boundingBox())!;
  const box = (await riding.locator("xpath=..").boundingBox())!;
  expect([a.x, a.y, a.width, a.height]).toEqual([box.x, box.y, box.width, box.height]);
  const pic = () => riding.innerHTML();
  const first = await pic();
  await expect.poll(pic, { timeout: 5_000 }).not.toBe(first);
  // At a size (Nov 1): every ride at 0.75 (RIDES.defaultScale, Eric: "0.75 is good"); an admin's `?rideScale=1` tries it as
  // drawn, the ride bigger under the same pawn, in the same boxes.
  expect(await riding.getAttribute("data-scale")).toBe("0.75");
  await page.goto("/?rideScale=1");
  await expect(page.locator('.fd-hero .avatar.riding[data-scale="1"]')).toHaveCount(1);
  await expect(page.locator('.fd-ring:visible .avatar.riding[data-scale="1"]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  expect(await boxes(), "nothing grew or moved at a bigger ride").toEqual(before);
  // Off again: the pawn alone, in the same boxes.
  await wearItem(page, "ride", null);
  await page.reload();
  await expect(page.locator(".fd-hero .avatar")).toHaveCount(1);
  await expect(page.locator(".avatar.riding")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  expect(await boxes()).toEqual(before);
});

/** Holds a ride's drawing's chunk (Nov 1, rides lazy: each its own, `/assets/<ride>-<hash>.js`) until the answer is called. */
async function holdDrawing(page: Page, ride: string): Promise<() => void> {
  let open!: () => void;
  const held = new Promise<void>((r) => (open = r));
  await page.route(new RegExp(`/assets/${ride}-[\\w-]{8}\\.js$`), async (route) => {
    await held;
    await route.continue();
  });
  return open;
}

test.describe("rides lazy", () => {
  // (No service worker: it would serve the ride's chunk from its cache, past the hold.)
  test.use({ serviceWorkers: "block" });
  test("rides lazy (Nov 1): each ride's drawing loads on its own; until it comes, home's pawn and ring, your profile's pawn and the locker's tile keep their boxes, the pawn sitting where it will ride; the ride appears under it and nothing moves", async ({ page }) => {
    // (Still: no hop on home, the idle on its first frame, so every box can be read twice.)
    await page.emulateMedia({ reducedMotion: "reduce" });
    await named(page, "Rider");
    await page.goto("/");
    await expect(page.locator(".fd-hero-name")).toHaveText("Rider");
    const [chirp] = await giveItems(page, [
      { def: "riding-chirp", color: "cobalt", blemish: 40 },
      { def: "moon-ride", color: "pearl", blemish: 40 },
    ]);
    await wearItem(page, "ride", chirp!);
    /** The boxes (each element's, rounded to a tenth of a pixel) and, in each, where the pawn sits (its top left and width). */
    const boxes = (sel: string) =>
      page.locator(sel).evaluateAll((els) =>
        els.map((e) => {
          const r = (b: DOMRect) => [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
          const pawn = e.querySelector(".ride-pawn");
          return [...r(e.getBoundingClientRect()), ...(pawn ? r(pawn.getBoundingClientRect()).slice(0, 3) : [])];
        }),
      );
    /** The same once they've stopped moving (an overlay slides in as it opens). */
    const settled = async (sel: string) => {
      let prev = await boxes(sel);
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(100);
        const now = await boxes(sel);
        if (now.length && JSON.stringify(now) === JSON.stringify(prev)) return now;
        prev = now;
      }
      throw new Error(`${sel}: never settled`);
    };
    // Home: your worn ride's drawing is asked for as the app starts; held back, the big pawn and your ring sit where they'll ride.
    let open = await holdDrawing(page, "riding-chirp");
    await page.reload();
    const home = ".fd-hero, .fd-hero .fd-pawn-box, .fd-hero .avatar.riding, .fd-ring:visible .fd-pawn-box, .fd-ring:visible .avatar.riding";
    await expect(page.locator('.fd-hero .avatar.riding[data-ride="riding-chirp"][data-drawn="0"]')).toHaveCount(1);
    await expect(page.locator('.fd-ring:visible .avatar.riding[data-drawn="0"]')).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const homeBefore = await settled(home);
    open();
    await expect(page.locator('.fd-hero .avatar.riding[data-drawn="1"]')).toHaveCount(1);
    await expect(page.locator('.fd-ring:visible .avatar.riding[data-drawn="1"]')).toHaveCount(1);
    expect(await boxes(home), "home: nothing moved when the ride came").toEqual(homeBefore);
    // Your profile's pawn, the same.
    open = await holdDrawing(page, "riding-chirp");
    await page.reload();
    await page.getByRole("button", { name: "Your profile" }).click();
    // (The profile itself first: until its data comes the page shows "Loading…" in a different layout, so a slow
    // server measured that one and then the loaded page, 255 px apart (CI, Nov 1). The ride is held either way.)
    await expect(page.locator(".fd-card .fd-seen")).toBeVisible();
    const card = ".fd-card .avatar.riding";
    await expect(page.locator(`${card}[data-drawn="0"]`)).toHaveCount(1);
    const cardBefore = await settled(`.fd-card .fd-pawn-box, ${card}`);
    open();
    await expect(page.locator(`${card}[data-drawn="1"]`)).toHaveCount(1);
    expect(await boxes(`.fd-card .fd-pawn-box, ${card}`), "your profile: nothing moved").toEqual(cardBefore);
    // The locker's Ride tab: Moon's Ride's tile (its drawing not loaded on this page yet).
    open = await holdDrawing(page, "moon-ride");
    await page.getByRole("button", { name: "Open locker" }).click();
    await page.getByRole("tab", { name: "Ride", exact: true }).click();
    const tile = page.getByRole("button", { name: /^Moon's Ride, / });
    await expect(tile.locator('.item-art[data-drawn="0"]')).toHaveCount(1);
    const tileBoxes = () => tile.locator("xpath=.").evaluateAll((els) => els.map((e) => [e, e.querySelector(".item-art")!, e.querySelector(".ride-pawn")!].map((x) => Object.values(x.getBoundingClientRect().toJSON()).map((v) => Math.round(Number(v) * 10) / 10))));
    await settled(".locker-grid");
    const tileBefore = await tileBoxes();
    open();
    await expect(tile.locator('.item-art[data-drawn="1"]')).toHaveCount(1);
    expect(await tileBoxes(), "the locker's tile: nothing moved").toEqual(tileBefore);
  });
});

test("rides for an admin (Oct 31; admins own one of every item): the Ride tab has every ride's admin copy (Nov 1: every boss's); wearing Riding Chirp's, the preview rides it, and in the town square your pawn rides it, in its color", async ({ page }) => {
  await named(page, "Eric");
  // (Once this page's account exists, as a player: no ride.)
  await page.goto("/shop");
  await page.getByRole("tab", { name: "Locker" }).click();
  await expect(page.getByText("No crate items here yet. Open a crate!")).toBeVisible();
  await asServerAdmin(page);
  await page.reload();
  await page.getByRole("tab", { name: "Locker" }).click();
  await page.getByRole("tab", { name: "Ride", exact: true }).click();
  const grid = page.locator(".locker-grid").first();
  const rides = ITEM_DEFS.filter((d) => d.slot === "ride").length;
  expect(rides).toBe(16);
  await expect(grid.locator(".locker-item")).toHaveCount(rides);
  await expect(grid.locator(".locker-admin")).toHaveCount(rides);
  const chirp = grid.getByRole("button", { name: /^Riding Chirp, / });
  await chirp.click();
  await expect(chirp.locator(".locker-worn")).toHaveText("Worn");
  await expect(page.locator('.locker-preview .avatar.riding[data-ride="riding-chirp"]')).toHaveCount(2);
  // In the town square, as the town reads anyone's look: your pawn on the admin copy's ride, in its red.
  await page.goto("/town?sky=day");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townRide?: () => { you: { ride: string | null; color: string | null; ready: boolean } } | null }).__townRide?.()?.you ?? null), { timeout: 20_000 }).toEqual(
    expect.objectContaining({ ride: "riding-chirp", color: "red", ready: true }),
  );
});
