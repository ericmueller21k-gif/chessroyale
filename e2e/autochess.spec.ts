import { expect, type Locator, type Page } from "@playwright/test";
import { BOARD_SEL, asAdmin, named, test } from "./helpers.ts";
import {
  phone, PLAIN, NEVER, LATE, EARLY, FIGHT, TWOQ, MOVE, HELD, RESULT_WHY, PRICES, NAMES, isDark, watchErrors, root, goldOf, hp, soundCount,
  clockOf, stepLabel, say, botLevel, expectLevel, center, tapAt, tap, tapGreyed, tapSquare, dragMouse, dragTouch, middle, offers, card,
  silhouette, tapSilhouette, reroll, piece, lockButton, xpButton, youBench, theirBench, held, benchMiddle, shopMiddle, buyAll, watchFight,
  fightSeen, watchBanners, bannersSeen,
} from "./autochess-helpers.ts";

/**
 * Auto chess, the demo (/autochess; docs/areas/autochess.md; shelved: Settings' Testing section, for admins, opens it): a
 * round is played from buying to the fight's end, on a phone and a computer. `?quick=1` (a test switch) shortens the steps (buy 7 s with the last
 * 2 locked, a reveal every 1.5 s, the move step still 7 s, a fight move every 60 ms); `?adjust=0` turns the move step
 * off; `?seed=` fixes the kings, the shop and the bot; `?gold=N` adds gold; `?level=N` starts both sides at level N (rooks and queens in the shop at
 * once); `?lockin=1` turns lock-in on (it is off since v7), `?adjustmode=legal` brings back v7's move step (one piece lit at random, 7 s) and `=teleport` the v6 adjust step; v8's
 * stars: `?stars=n@c2:1,b@d2:2` puts pieces on your board (kind, square, stars 1 to 3), `?benchstars=b@f3:2` holds them for you and `?botbench=n@c7:2` for the bot; `?fightglow=1` keeps the stars' outlines on through the fight.
 * v9's meeting before round 1 (both pawns in the middle, the quick chat, a 10 s countdown; `?quick=1` makes it 2 s) is on in every game; `?intro=0` skips it (the tests
 * that aren't about it use that).
 *
 * (Split Nov 10: the layouts, drags, stars and the meeting are in autochess-board.spec.ts; the helpers in autochess-helpers.ts.)
 *
 * The screen is v7's (docs/decisions/2026-10-21-autochess-v7.md): their bench top left, their pawn top right, the board in its frame with the move clock's
 * bars, your pawn bottom left, the clock's small numbers and your bench bottom right, then the dock (gold and the odds pill, Buy XP, Reroll, four cards).
 */
// (A tap or click that finds nothing fails in seconds, not at the test's end.)
test.use({ actionTimeout: 15_000 });

test.beforeEach(async ({ page }) => {
  await named(page, "Pawnder");
  await page.addInitScript(() => ((window as any).__soundLog = []));
});

test("shelved (Eric, Oct 19; home's card came on Oct 24, home-ranked.spec.ts): no row in a player's Settings; an admin opens it from Settings' Testing; the gear's Leave goes home", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Auto chess/ })).toHaveCount(0);
  await asAdmin(page);
  await page.goto("/settings");
  const row = page.getByRole("button", { name: "Auto chess (shelved demo) ›" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(root(page)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/autochess");
  await expect(page.locator(".ac-title strong")).toHaveText("Auto chess");
  await expect(page.locator(".ac-title span")).toHaveText("Round 1");
  // (No back button since Nov 8: the gear has Leave, asked first.)
  await expect(page.getByRole("button", { name: "Back to home" })).toHaveCount(0);
  await page.getByRole("button", { name: "Match options" }).click();
  await page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: "Leave", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  // The address works by itself too (nothing is signed in or sent).
  await page.goto("/autochess?intro=0");
  await expect(root(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the shop: four offers, each a piece and a square of your own, on a square tile of that square's color, drawn as glowing silhouettes on the board, one to a square, each filling it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const king = (await root(page).getAttribute("data-king"))!;
  expect(king).toBe("d2");
  const shown = await offers(page);
  expect(shown).toEqual([
    { kind: "b", square: "b4" },
    { kind: "p", square: "d4" },
    { kind: "p", square: "g3" },
    { kind: "p", square: "h3" },
  ]);
  // Four cards (v7: was five), each: the piece on a square tile, its name and square ("Bishop b4"), its price. All on your half, none on your king; pawns on your 2nd to 4th rank.
  await expect(page.locator(".ac-buy")).toHaveCount(4);
  await expect(page.locator(".ac-buy .ac-cost b")).toHaveText(shown.map((o) => String(PRICES[o.kind])));
  await expect(page.locator(".ac-buy .ac-nm")).toHaveText(shown.map((o) => `${NAMES[o.kind]} ${o.square}`));
  for (const [slot, o] of shown.entries()) {
    expect(Number(o.square[1])).toBeLessThanOrEqual(4);
    expect(o.square).not.toBe(king);
    if (o.kind === "p") expect(Number(o.square[1])).toBeGreaterThanOrEqual(2);
    // The tile is square (never a tall one; since Nov 8 the card's own cream, no square color); the piece sits on it.
    const tile = card(page, slot).locator(".ac-tile");
    const tb = (await tile.boundingBox())!;
    expect(Math.abs(tb.width - tb.height), `${o.square}: a square tile`).toBeLessThan(1.5);
    const pb = (await tile.locator("piece").boundingBox())!;
    expect(pb.x).toBeGreaterThanOrEqual(tb.x - 1);
    expect(pb.x + pb.width).toBeLessThanOrEqual(tb.x + tb.width + 1);
  }
  // On the board: four silhouettes, each on its own square (never two on one: Eric, Oct 21), and each fills its square.
  expect(new Set(shown.map((o) => o.square)).size).toBe(4);
  await expect(page.locator(".ac-sil")).toHaveCount(4);
  // (Measured once they're in: each pops in (`ac-appear`, 160 ms from scale 0.4, its translateY(-50%) blended in), and the first one
  // read mid-pop sat 2 to 6 px off its square's middle: the flaky "b4: vertically on its square", Nov 2. The check is as tight as before.)
  await page.locator(".ac-sil").evaluateAll((els) => Promise.all(els.flatMap((el) => el.getAnimations()).map((a) => a.finished)));
  const boardBox = (await page.locator(".ac-layer").boundingBox())!;
  const sq = boardBox.width / 8;
  const boxes = await Promise.all(shown.map(async (_, slot) => (await silhouette(page, slot).boundingBox())!));
  for (const [slot, o] of shown.entries()) {
    const c = await center(page, o.square);
    const b = boxes[slot]!;
    expect(Math.abs(b.y + b.height / 2 - c.y), `${o.square}: vertically on its square`).toBeLessThan(1.5);
    expect(Math.abs(b.x + b.width / 2 - c.x), `${o.square}: horizontally on its square`).toBeLessThan(1.5);
    expect(b.width, `${o.square}: a whole square wide`).toBeGreaterThan(sq - 2);
    expect(b.width, `${o.square}: and no wider`).toBeLessThan(sq + 1);
  }
  // Soft green: the silhouette's fill is green-led (red and blue lower), on the classic board's squares.
  const [r, g, b] = (await page.locator(".ac-sil-shape").first().evaluate((el) => getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number))) as number[];
  expect(g!).toBeGreaterThan(r!);
  expect(g!).toBeGreaterThan(b!);
  // The board holds only your king: nothing is placed for free. Both benches are always there, four slots each (a phone's: plain tiles; a computer's: faint rings).
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  await expect(youBench(page).locator(".ac-slot")).toHaveCount(4);
  await expect(theirBench(page).locator(".ac-slot")).toHaveCount(4);
  await expect(held(page)).toHaveCount(0);
  await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(0);
  const emptyLook = await youBench(page).locator(".ac-slot.empty").first().evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, ring: getComputedStyle(el, "::before").content === "none" ? "none" : getComputedStyle(el, "::before").borderTopStyle }));
  // (v5, phone and computer: an empty slot is a tile in the bench's colors, no ring.)
  expect(emptyLook).toEqual({ bg: expect.not.stringMatching(/^rgba\(0, 0, 0, 0\)$/), ring: "none" });
  expect(errors).toEqual([]);
});

test("the shop: a reroll costs 2 (1 more each time, up to 5) and rolls all four offers (the same for the same seed), and is refused without the gold", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const first = await offers(page);
  expect(await goldOf(page)).toBe(10);
  await expect(reroll(page)).toContainText("Reroll");
  await expect(reroll(page)).toContainText("2");
  await tap(page, reroll(page));
  expect(await goldOf(page)).toBe(8);
  // (A shuffle and a coin's clink.)
  expect(await soundCount(page, "acReroll")).toBe(1);
  const rolled = await offers(page);
  expect(rolled).toHaveLength(4);
  expect(rolled).not.toEqual(first);
  await expect(page.locator(".ac-sil")).toHaveCount(4);
  await expect(page.locator(".ac-buy .ac-cost b")).toHaveText(rolled.map((o) => String(PRICES[o.kind])));
  // Seeded by the round and the reroll count: a fresh start rerolled once shows the same four.
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await offers(page)).toEqual(first);
  await tap(page, reroll(page));
  expect(await offers(page)).toEqual(rolled);
  // Without the gold it is refused, with the reason (the other rerolls in one go: the same button, the same code). From 8 gold: 3, then 4, and 1 is
  // left, which is under the next price (5).
  await page.evaluate(() => {
    const b = document.querySelector<HTMLButtonElement>(".ac-reroll")!;
    for (let i = 0; i < 49; i++) b.click();
  });
  expect(await goldOf(page)).toBe(1);
  await expect(reroll(page)).toHaveAttribute("aria-disabled", "true");
  await expect(reroll(page)).toContainText("5");
  const before = await offers(page);
  await reroll(page).click({ force: true });
  await expect(say(page)).toHaveText("Need 4 more");
  expect(await goldOf(page)).toBe(1);
  expect(await offers(page)).toEqual(before);
  // Buy XP says so too (4 XP cost 4).
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(say(page)).toHaveText("Need 3 more");
  expect(await goldOf(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("the reroll's price climbs 2, 3, 4, 5 and stays at 5 as the Reroll button shows it, each one charged at that price, and is back to 2 in the next round", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  // (Gold enough for the whole climb: 2 + 3 + 4 + 5 + 5 + 5 + 5 = 29.)
  await page.goto("/autochess?quick=1&seed=9&adjust=0&gold=30&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const price = async () => Number(await reroll(page).locator(".ac-cost b").innerText());
  let gold = await goldOf(page);
  // (The start gold of 30, its interest (3) and the round's income (10): the whole climb, 29, is there.)
  expect(gold).toBe(43);
  const climb = [2, 3, 4, 5, 5, 5, 5];
  for (const [i, expected] of climb.entries()) {
    expect(await price(), `the button shows the price of reroll ${i + 1}`).toBe(expected);
    await expect(reroll(page)).toHaveAttribute("aria-label", `Reroll the shop, ${expected} gold`);
    await tap(page, reroll(page));
    gold -= expected;
    expect(await goldOf(page), `reroll ${i + 1} cost ${expected}`).toBe(gold);
  }
  expect(await price(), "it stays at 5").toBe(5);
  // The next round's shop starts at 5 again (play the round out; the fight has no move step here).
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 200_000 });
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(root(page)).toHaveAttribute("data-round", "2");
  expect(await price(), "back to 2 at the next round's start").toBe(2);
  await tap(page, reroll(page));
  await expect(reroll(page).locator(".ac-cost b")).toHaveText("3");
  expect(errors).toEqual([]);
});

test("one offer to a square (Eric, Oct 21): over several seeds, rerolls and buys, no two offers share a square, none is on your king or a piece of yours (but a star-up, v8, which is on the piece it merges into), and each other square shows one silhouette", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const check = async (where: string) => {
    const shown = await offers(page);
    expect(shown, `${where}: four offers`).toHaveLength(4);
    const squares = shown.map((o) => o.square);
    expect(new Set(squares).size, `${where}: ${squares}`).toBe(4);
    const mine = await page.locator(`${BOARD_SEL.piece}.white`).evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.square!}${(e as HTMLElement).className.split(" ").find((c) => /^(pawn|knight|bishop|rook|queen|king)$/.test(c)) ?? ""}`));
    // A star-up (its card has `data-up`) is on a piece of yours of its own kind and has no silhouette; every other offer is on a free square.
    const ups = await page.locator(".ac-buy").evaluateAll((els) => els.map((e) => e.hasAttribute("data-up")));
    shown.forEach((o, i) => {
      if (ups[i]) expect(mine, `${where}: the star-up ${o.kind} ${o.square} is on its piece`).toContain(`${o.square}${NAMES[o.kind]!.toLowerCase()}`);
      else expect(mine.map((m) => m.slice(0, 2)), `${where}: ${o.square} is free`).not.toContain(o.square);
    });
    await expect(page.locator(".ac-sil")).toHaveCount(4 - ups.filter(Boolean).length);
    const centers = await page.locator(".ac-sil").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return `${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`;
      }),
    );
    expect(new Set(centers).size, `${where}: each silhouette on its own square`).toBe(centers.length);
  };
  // (`gold=90` pays for the rerolls and the buys.)
  for (const seed of [9, 5, 60, 3, 11, 3328, 21, 33]) {
    await page.goto(`/autochess?seed=${seed}&gold=90&intro=0`);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await check(`seed ${seed}`);
    for (let i = 0; i < 4; i++) {
      await tap(page, reroll(page));
      await check(`seed ${seed}, reroll ${i + 1}`);
    }
    for (let i = 0; i < 3; i++) {
      await tap(page, page.locator(".ac-buy:not(.off)").first());
      await check(`seed ${seed}, buy ${i + 1}`);
    }
  }
  expect(errors).toEqual([]);
});

test("buying: tap an offer's silhouette or its shop card, and it lands on its square; a new offer rolls into the slot, on a square no piece or other offer is on", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Round 1: no start gold, an income of 10; the kings are placed by the game, mirrored; you are White, at the bottom.
  expect(await goldOf(page)).toBe(10);
  await expect(page.locator(".ac-income b")).toHaveText("+10");
  expect(await hp(page, "you")).toBe(24);
  expect(await hp(page, "bot")).toBe(24);
  const botKing = (await root(page).getAttribute("data-bot-king"))!;
  expect(botKing).toBe("d7");
  await expect(piece(page, "white", "king", "d2")).toBeVisible();
  await expect(piece(page, "black", "king", botKing)).toBeVisible();
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-white/);
  // No hint text under the board any more (the small spot is for the clock, the step's name and a short message).
  await expect(page.locator(".ac-msg, .ac-card-say")).toHaveCount(0);
  await expect(say(page)).toHaveCount(0);

  // The bishop on b4 (slot 0) by its silhouette: it lands on b4, 3 gold. No other offer was on b4, so none rolls again and nothing says so.
  const before = await offers(page);
  await tapSilhouette(page, 0);
  await expect(piece(page, "white", "bishop", "b4")).toBeVisible();
  expect(await goldOf(page)).toBe(7);
  await expect(say(page)).toHaveCount(0);
  // (A solid thunk as it lands: one place sound for each piece bought onto its square.)
  expect(await soundCount(page, "acPlace")).toBe(1);
  const after = await offers(page);
  expect(after).toHaveLength(4);
  // The new offer in slot 0 is on a free square: not b4 (the bishop), and none of the other offers' squares.
  expect(after[0]!.square).not.toBe("b4");
  expect(new Set(after.map((o) => o.square)).size).toBe(4);
  expect(after.slice(1)).toEqual(before.slice(1));
  // The pawn on g3 (slot 2) by its shop card: it lands on g3, 1 gold.
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "pawn", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(6);
  expect(await soundCount(page, "acPlace")).toBe(2);
  await expect(piece(page, "white", "bishop", "b4")).toBeVisible();
  // The pawn on d4 (slot 1) by its silhouette: a pawn stands on d4, 5 gold left.
  await tapSilhouette(page, 1);
  await expect(piece(page, "white", "pawn", "d4")).toBeVisible();
  expect(await goldOf(page)).toBe(5);
  // After every buy the four offers are on four squares, none of them the king's or a piece's.
  const squares = (await offers(page)).map((o) => o.square);
  expect(new Set(squares).size).toBe(4);
  for (const sqr of ["d2", "b4", "g3", "d4"]) expect(squares).not.toContain(sqr);
  // Nothing was placed for free, and nothing of yours on the board but what was bought: the king, a bishop and two pawns.
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("buying: a greyed offer says why (gold, the one-queen limit), in a few words when it is tapped; selling by tap and by drag; the lock", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(TWOQ);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // (Level 10 for the queens: 7% a slot.)
  expect(await offers(page)).toEqual([
    { kind: "q", square: "g3" },
    { kind: "q", square: "e3" },
    { kind: "p", square: "h4" },
    { kind: "b", square: "d3" },
  ]);
  // The queen on g3: 9 gold. Then 1 is left: the bishop can't be had (greyed, "No gold", "Need 2 more" when tapped), and the second queen is over the limit.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "queen", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(1);
  await expect(card(page, 3)).toHaveAttribute("aria-disabled", "true");
  await expect(card(page, 3)).toHaveAttribute("aria-label", /No gold/);
  await card(page, 3).click({ force: true });
  await expect(say(page)).toHaveText("Need 2 more");
  await expect(card(page, 1)).toHaveAttribute("aria-label", /Max 1/);
  await card(page, 1).click({ force: true });
  await expect(say(page)).toHaveText("One queen max");
  await expect(piece(page, "white", "bishop", "d3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(1);
  // Buy XP at the top level says so (the next round of its words, "Need N more", is in the reroll test).
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(say(page)).toHaveText("Top level (10)");
  expect(await goldOf(page)).toBe(1);
  // The king is the game's: tapping it says so.
  await tapSquare(page, "h1");
  await expect(say(page)).toHaveText("King: set by game");
  // Sell by tapping your queen: the Sell button (over the shop's cards, where a dragged piece is dropped to sell: Nov 8) says what it gives, "Sell 7" (75% of 9, 6.75, to the nearest whole gold), and the sell sound plays.
  await tapSquare(page, "g3");
  const sellButton = page.getByRole("button", { name: "Sell 7", exact: true });
  await expect(sellButton).toBeVisible();
  const sb = (await sellButton.boundingBox())!;
  const cards = (await page.locator(".ac-cards").boundingBox())!;
  expect(sb.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(sb.x - cards.x) + Math.abs(sb.width - cards.width), "over the cards, as wide").toBeLessThanOrEqual(2);
  expect(sb.y, "in the shop row").toBeGreaterThanOrEqual(cards.y - 1);
  await tap(page, sellButton);
  await expect(piece(page, "white", "queen", "g3")).toHaveCount(0);
  expect(await goldOf(page)).toBe(8);
  expect(await soundCount(page, "sell")).toBe(1);
  await expect(say(page)).toHaveText("Sold for 7");
  // Buy a pawn (1) and sell it by dragging it onto the shop: 75% of 1, to the nearest whole gold, is 1.
  const now = await offers(page);
  const pawnSlot = now.findIndex((o) => o.kind === "p");
  const pawnSquare = now[pawnSlot]!.square;
  await tap(page, card(page, pawnSlot));
  await expect(piece(page, "white", "pawn", pawnSquare)).toBeVisible();
  expect(await goldOf(page)).toBe(7);
  await dragMouse(page, await center(page, pawnSquare), await shopMiddle(page));
  await expect(piece(page, "white", "pawn", pawnSquare)).toHaveCount(0);
  expect(await goldOf(page)).toBe(8);
  expect(await soundCount(page, "sell")).toBe(2);
  // The last 2 seconds are locked: "Locked" under the clock, and nothing is bought, sold or moved; the shop and the silhouettes dim.
  await expect(stepLabel(page)).toHaveText("Locked", { timeout: 15_000 });
  const gold = await goldOf(page);
  await card(page, 0).click({ force: true });
  await expect(say(page)).toHaveText("Shop locked");
  expect(await goldOf(page)).toBe(gold);
  await expect(page.locator(".ac-shop")).toHaveClass(/shut/);
  await expect(page.locator(".ac-sil.off")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("the bench: drag an offer onto it to hold it (it keeps its square), tap it to place it when its square is free, sell it by dragging it onto the shop", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  // (The full 30 s step: a drag takes a while, and the quick step's 5 open seconds are a tap-test's. Seed 19512: see the list at the top.)
  await page.goto("/autochess?seed=19512&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const before = await offers(page);
  expect(before.map((o) => `${o.kind}${o.square}`)).toEqual(["bb4", "ph4", "pg2", "pe2"]);
  // The bishop for b4 (slot 0) is dragged from its shop card onto the bench: 3 gold, it waits there with its square, nothing lands on the board.
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "b");
  await expect(held(page).first()).toHaveAttribute("data-square", "b4");
  await expect(held(page).first().locator("em")).toHaveText("b4");
  // (The tile is the color of the square the piece keeps.)
  await expect(held(page).first()).toHaveClass(isDark("b4") ? /\bd\b/ : /\bl\b/);
  expect(await goldOf(page)).toBe(7);
  await expect(say(page)).toHaveText("Held b4");
  // (A soft pop for a hold, not the thunk of a piece landing.)
  expect(await soundCount(page, "acHold")).toBe(1);
  expect(await soundCount(page, "acPlace")).toBe(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(1);
  // A new offer rolled into slot 0 (a pawn, and on b4 itself: the bishop only waits there, so b4 is empty); the others stay.
  const after = await offers(page);
  expect(after).toHaveLength(4);
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(after[0]).toEqual({ kind: "p", square: "b4" });
  // The pawn for e2 (slot 3) is dragged from its card the same way (a silhouette on the board is only tapped, never dragged); its slot rolls a pawn onto e2 too.
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(2);
  expect(await goldOf(page)).toBe(6);
  expect(await soundCount(page, "acHold")).toBe(2);
  expect((await offers(page))[3]).toEqual({ kind: "p", square: "e2" });
  // Tapping the held pawn (v5) lights its tile and e2, the square it goes to; nothing is placed yet. A second tap places it on e2 (free): the bench slot
  // empties, and the offer on e2 (slot 3) rolls again, onto a square that is free.
  await tap(page, held(page).nth(1));
  await expect(held(page).nth(1)).toHaveClass(/\baimed\b/);
  await expect(page.locator(".ac-aim")).toHaveAttribute("data-square", "e2");
  await expect(page.locator(".ac-slot.aimed")).toHaveCount(1);
  const aimLook = await page.locator(".ac-aim").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(aimLook, "the target square is ringed").toContain("inset");
  expect(await soundCount(page, "acPlace")).toBe(0);
  await tap(page, held(page).nth(1));
  await expect(page.locator(".ac-aim")).toHaveCount(0);
  await expect(piece(page, "white", "pawn", "e2")).toBeVisible();
  expect(await soundCount(page, "acPlace")).toBe(1);
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(6);
  await expect(say(page)).toHaveText("e2 rolled again");
  const rolled = (await offers(page)).map((o) => o.square);
  expect(rolled).not.toContain("e2");
  expect(new Set(rolled).size).toBe(4);
  // The pawn offered for b4 (slot 0) is bought onto b4: the held bishop's square is taken, so tapping the bishop says so and nothing happens.
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "pawn", "b4")).toBeVisible();
  expect(await goldOf(page)).toBe(5);
  await expect(held(page).first()).toHaveClass(/off/);
  await tapGreyed(page, held(page).first());
  await expect(say(page)).toHaveText("b4 is taken");
  await expect(held(page)).toHaveCount(1);
  // Sell the held bishop by dragging it onto the shop: 75% of 3, to the nearest whole gold, is 2.
  const slotBox = (await held(page).first().boundingBox())!;
  await dragMouse(page, middle(slotBox), await shopMiddle(page));
  await expect(held(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(7);
  // The 2 floats up right over the slot the bishop was sold from (it is in the bench row, over the first slot), and is gone a moment later.
  const bench0 = (await youBench(page).boundingBox())!;
  const flo = page.locator(".ac-float");
  await expect(flo).toHaveCount(1);
  await expect(flo).toHaveText("+2");
  const fb = (await flo.boundingBox())!;
  expect(fb.x + fb.width / 2).toBeGreaterThan(slotBox.x - 2);
  expect(fb.x + fb.width / 2).toBeLessThan(slotBox.x + slotBox.width + 2);
  expect(fb.y).toBeLessThan(bench0.y + bench0.height);
  expect(fb.y + fb.height).toBeGreaterThan(bench0.y - 45);
  await expect(flo).toHaveCount(0, { timeout: 3000 });
  await expect(say(page)).toHaveText("Sold for 2");
  expect(await soundCount(page, "sell")).toBe(1);
  expect(errors).toEqual([]);
});

test("while you drag an offer, your whole bench row lights up (gold ring), and only yours: theirs never takes a drag", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(youBench(page)).not.toHaveClass(/lit/);
  const card0 = middle((await card(page, 1).boundingBox())!);
  await page.mouse.move(card0.x, card0.y);
  await page.mouse.down();
  await page.mouse.move(card0.x + 6, card0.y - 6, { steps: 2 });
  const b = await benchMiddle(page);
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await expect(youBench(page)).toHaveClass(/lit/);
  await expect(theirBench(page)).not.toHaveClass(/lit/);
  // The ring is the app's gold, around the whole row (the empty tiles included).
  expect(await youBench(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.mouse.up();
  await expect(youBench(page)).not.toHaveClass(/lit/);
  await expect(held(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the bench holds 4: a fifth is refused with the reason; the shop's offers stay holdable when the board has no room", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&gold=30&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  expect(await goldOf(page)).toBe(43);
  // Four pawns onto the bench (a pawn offer each time).
  for (let i = 0; i < 4; i++) {
    await dragMouse(page, middle((await page.locator('.ac-buy[data-kind="p"]').first().boundingBox())!), await benchMiddle(page));
    await expect(held(page)).toHaveCount(i + 1);
  }
  // (`gold=30` adds 30 to round 1: the income 10 and the interest on 30, 3, make 43; four pawns are 4.)
  expect(await goldOf(page)).toBe(43 - 4);
  // The fifth: refused, with the reason; gold and the bench unchanged.
  const gold = await goldOf(page);
  await dragMouse(page, middle((await page.locator('.ac-buy[data-kind="p"]').first().boundingBox())!), await benchMiddle(page));
  await expect(say(page)).toHaveText("Bench full");
  await expect(held(page)).toHaveCount(4);
  expect(await goldOf(page)).toBe(gold);
  // Pawns held for squares: each is placed on its own square when tapped, never anywhere else.
  const squares = await held(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-square")!));
  await tap(page, held(page).first());
  await expect(page.locator(".ac-aim")).toHaveAttribute("data-square", squares[0]!);
  // (A tap on the lit square places it too.)
  const aimAt = middle((await page.locator(".ac-aim").boundingBox())!);
  await tapAt(page, aimAt.x, aimAt.y);
  await expect(piece(page, "white", "pawn", squares[0]!)).toBeVisible();
  await expect(held(page)).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("levels: you start at level 4 (4 pieces on the board), the 5th is refused with the reason, Buy XP (4 XP for 4 gold) makes room, and the number pops", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&gold=100&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // 100 more, the income 10 and the interest, 5 at the most: 115. Round 1's free 2 XP: level 4, 2 of 4.
  expect(await goldOf(page)).toBe(115);
  await expectLevel(page, 4, "2/4");
  await expect(botLevel(page)).toContainText("Lv 4");
  await expect(xpButton(page)).toContainText("Buy XP");
  await expect(xpButton(page)).toContainText("4");
  // Four pieces on the board: the level's number.
  await buyAll(page, 4);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  // The fifth is refused: the offers aren't greyed (they can still be held; their squares show in gold), and a tap says why.
  const gold = await goldOf(page);
  const slot = page.locator(".ac-buy.hold-only").first();
  await expect(slot).toHaveAttribute("aria-label", /Level full/);
  await expect(page.locator(".ac-sil.off")).toHaveCount(4);
  await tapGreyed(page, slot);
  await expect(say(page)).toHaveText("Board full. Drag to bench");
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(5);
  expect(await goldOf(page)).toBe(gold);
  // Held on the bench instead, and placed once there is room.
  await dragMouse(page, middle((await slot.boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  await tapGreyed(page, held(page).first());
  await expect(say(page)).toHaveText("Board full: buy XP");
  await expect(held(page)).toHaveCount(1);
  // Buy XP: 4 gold, 4 XP: 2 + 4 reaches the 4 for level 5, with 2 over: level 5, 2/8; the number pops, and the board may hold 5.
  const before = await goldOf(page);
  await tap(page, xpButton(page));
  await expectLevel(page, 5, "2/8");
  await expect(page.locator(".ac-badge.pop")).toBeVisible();
  // (A small rising chime for the XP, a bigger one as the level comes.)
  expect(await soundCount(page, "acXp")).toBe(1);
  expect(await soundCount(page, "acLevel")).toBe(1);
  expect(await goldOf(page)).toBe(before - 4);
  await expect(say(page)).toHaveText("Level 5: 5 pieces");
  // (Picked by the tap above, so this tap places it.)
  await tap(page, held(page).first());
  await expect(held(page)).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(6);
  // Another 4 XP is no level yet: it says so in the numbers (6 of 8), no pop of its own.
  await tap(page, xpButton(page));
  await expectLevel(page, 5, "6/8");
  await expect(say(page)).toHaveText("+4 XP");
  expect(await soundCount(page, "acXp")).toBe(2);
  expect(await soundCount(page, "acLevel")).toBe(1);
  // All the way up: 82 XP in all from level 4's 2 is 21 buys (the first two are done): level 10, "max", and no more to buy.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll<HTMLButtonElement>(".ac-xp")][0]!;
    for (let i = 0; i < 19; i++) b.click();
  });
  await expectLevel(page, 10, "max");
  await expect(xpButton(page)).toHaveAttribute("aria-disabled", "true");
  await xpButton(page).click({ force: true });
  await expect(say(page)).toHaveText("Top level (10)");
  expect(await goldOf(page)).toBe(before - 21 * 4);
  expect(errors).toEqual([]);
});

test("the odds pill in the gold row: each piece's icon with its percent under it at your level (no 'Odds' word, no strip of its own), on the gold number's baseline, and it follows a level-up", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&gold=20&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const pill = page.locator(".ac-odds");
  const shownOdds = () => page.locator(".ac-od").evaluateAll((els) => els.map((e) => ({ kind: (e as HTMLElement).dataset.kind!, pct: e.querySelector("b")!.textContent!, faded: e.classList.contains("none") })));
  // Level 4 (L4 74/14/12/0/0): rooks and queens are not on offer yet, and say so, faded.
  expect(await shownOdds()).toEqual([
    { kind: "p", pct: "74%", faded: false },
    { kind: "n", pct: "14%", faded: false },
    { kind: "b", pct: "12%", faded: false },
    { kind: "r", pct: "0%", faded: true },
    { kind: "q", pct: "0%", faded: true },
  ]);
  await expect(pill).toHaveAttribute("aria-label", "Chance of each piece in the shop at level 4: pawn 74%, knight 14%, bishop 12%, rook 0%, queen 0%");
  // The pill lives in the gold row (gold, income, the clock, the pill, the streak), with no word "Odds" and no row of its own above Buy XP.
  expect(await pill.evaluate((el) => !!el.closest(".ac-goldrow"))).toBe(true);
  await expect(page.locator(".ac-dock")).not.toContainText(/odds/i);
  await expect(page.locator(".ac-dock .ac-pc")).toHaveCount(5 + 4);
  // Each icon is a piece's picture with its percent under it.
  const parts = await page.locator(".ac-od").evaluateAll((els) => els.map((e) => ({ icon: e.querySelector(".ac-pc")!.getBoundingClientRect().bottom, pct: e.querySelector("b")!.getBoundingClientRect().top })));
  for (const p of parts) expect(p.icon, "the percent is under its icon").toBeLessThanOrEqual(p.pct + 1);
  // (Nov 8: the odds sit in the band's middle, as the gold and the hexagon do; was: on the gold number's baseline.)
  const band = (await page.locator(".ac-goldrow").boundingBox())!;
  const ob = (await pill.boundingBox())!;
  expect(Math.abs(ob.y + ob.height / 2 - (band.y + band.height / 2)), "the odds in the band's middle").toBeLessThanOrEqual(3);
  // The icons sit higher than the gold number's top (a little), as Eric allowed; the pill is small (its height under a button's).
  const gold = (await page.locator(".ac-gold-you b").boundingBox())!;
  const pb = (await pill.boundingBox())!;
  expect(pb.y).toBeLessThan(gold.y + 6);
  expect(pb.height).toBeLessThan(44);
  // A level-up: Buy XP (2 + 4 reaches level 5): 66/14/13/7/0, the rook no longer faded.
  await tap(page, xpButton(page));
  await expectLevel(page, 5, "2/8");
  expect(await shownOdds()).toEqual([
    { kind: "p", pct: "66%", faded: false },
    { kind: "n", pct: "14%", faded: false },
    { kind: "b", pct: "13%", faded: false },
    { kind: "r", pct: "7%", faded: false },
    { kind: "q", pct: "0%", faded: true },
  ]);
  await expect(pill).toHaveAttribute("aria-label", /level 5: pawn 66%, knight 14%, bishop 13%, rook 7%, queen 0%/);
  // Up to level 7 (5 more XP buys: 8 and 12 XP to the next two levels): queens appear, 54/18/16/11/1.
  for (let i = 0; i < 5; i++) await tap(page, xpButton(page));
  await expectLevel(page, 7, "2/16");
  expect(await shownOdds()).toEqual([
    { kind: "p", pct: "54%", faded: false },
    { kind: "n", pct: "18%", faded: false },
    { kind: "b", pct: "16%", faded: false },
    { kind: "r", pct: "11%", faded: false },
    { kind: "q", pct: "1%", faded: false },
  ]);
  // The rows come from the same table the shop rolls by: a game started at level 10 shows 36/21/20/16/7.
  await page.goto("/autochess?seed=9&level=10&intro=0");
  await expect(page.locator(".ac-od b")).toHaveText(["36%", "21%", "20%", "16%", "7%"]);
  expect(errors).toEqual([]);
});

test("the screen (Nov 8, v5, phone and computer): the benches rows of board squares on their files, yours under E-H and theirs over A-D, alternating, yours lighter, the players kitty-corner; name and level, thin HP and XP bars", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
  const frame = await box(".ac-frame");
  const dock = await box(".ac-dock");
  const theirs = await box(".ac-bench.them");
  const yours = await box(".ac-bench.you");
  const opp = await box(".ac-opp");
  const me = await box(".ac-me");
  const col = await box(".ac-col");
  // v5 (Eric, Nov 8), phone and computer: each bench a row of 4 board squares lined up with its files, 2 to 8 px from the board's border: yours
  // under E to H, theirs over A to D. The tiles by owner: an alternating pair, unlike the board's squares; yours lighter than theirs.
  const look = await page.evaluate(() => {
    const r = (e: Element) => e.getBoundingClientRect();
    const board = r(document.querySelector(".hb-board")!);
    const tiles = (sel: string) => [...document.querySelectorAll(`${sel} .ac-slot`)].map((e) => ({ x: r(e).left, w: r(e).width, t: r(e).top, b: r(e).bottom, bg: getComputedStyle(e).backgroundColor }));
    const probe = document.createElement("div");
    document.body.append(probe);
    const sqColor = (v: string) => ((probe.style.background = `var(${v})`), getComputedStyle(probe).backgroundColor);
    const out = { board: { l: board.left, t: board.top, w: board.width }, you: tiles(".ac-bench.you"), them: tiles(".ac-bench.them"), light: sqColor("--sq-light"), dark: sqColor("--sq-dark") };
    probe.remove();
    return out;
  });
  const sq = look.board.w / 8;
  for (const [who, list, first] of [["yours", look.you, 4], ["theirs", look.them, 0]] as const) {
    list.forEach((t, i) => {
      expect(Math.abs(t.x - (look.board.l + (first + i) * sq)), `${who}: tile ${i} on its file`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(t.w - sq), `${who}: a square wide`).toBeLessThanOrEqual(0.5);
    });
    const bgs = list.map((t) => t.bg);
    expect(bgs[0], `${who}: alternating`).not.toBe(bgs[1]);
    expect(bgs[0]).toBe(bgs[2]);
    expect(bgs[1]).toBe(bgs[3]);
    for (const bg of bgs.slice(0, 2)) expect([look.light, look.dark], `${who}: not the board's squares`).not.toContain(bg);
  }
  const light = (c: string) => c.match(/\d+/g)!.slice(0, 3).reduce((a, v) => a + Number(v), 0);
for (const i of [0, 1]) expect(light(look.you[i]!.bg), "yours lighter than theirs").toBeGreaterThan(light(look.them[i]!.bg));
  const below = look.you[0]!.t - (frame.y + frame.height);
  const above = frame.y - look.them[0]!.b;
  for (const gap of [below, above]) {
    expect(gap, "a few px from the board's border").toBeGreaterThanOrEqual(2);
    expect(gap).toBeLessThanOrEqual(8);
  }
  // The players kitty-corner: you under the board's left half, beside your bench; the opponent over its right half, beside theirs.
  const mid = frame.x + frame.width / 2;
  expect(me.x + me.width, "you: under the left half").toBeLessThanOrEqual(mid + 0.5);
  expect(me.y, "you: under the board").toBeGreaterThanOrEqual(frame.y + frame.height);
  expect(opp.x, "the opponent: over the right half").toBeGreaterThanOrEqual(mid - 0.5);
  expect(opp.y + opp.height, "the opponent: over the board").toBeLessThanOrEqual(frame.y);
  expect(opp.y, "the opponent under the title row").toBeGreaterThanOrEqual(col.y);
  expect(dock.y, "the action box under your row").toBeGreaterThanOrEqual(Math.max(yours.y + yours.height, me.y + me.height));
  expect(theirs.y + theirs.height).toBeLessThanOrEqual(frame.y);
  // The name and the level by each pawn; the numbers in thin bars (phone: beside the pawn; computer: under it).
  await expect(page.locator(".ac-who .ac-name")).toHaveText("Bot");
  await expect(botLevel(page)).toHaveText("Lv 4");
  await expect(page.locator(".ac-hp-you b")).toHaveText("24");
  await expect(page.locator(".ac-hp-bot b")).toHaveText("24");
  await expect(page.locator(".ac-xp-you b")).toHaveText("2/4");
  await expect(page.locator(".ac-xp-bot b")).toHaveText("2/4");
  await expectLevel(page, 4, "2/4");
  for (const sel of [".ac-me", ".ac-opp"]) {
    const bars = await page.locator(`${sel} .ac-bar i`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(bars, `${sel}: HP and XP`).toHaveLength(2);
    for (const h of bars) expect(h, `${sel}: a thin bar`).toBeLessThanOrEqual(8);
    const pawn = (await page.locator(`${sel} .ac-pawn`).boundingBox())!;
    const first = (await page.locator(`${sel} .ac-bar`).first().boundingBox())!;
    expect(first.x, `${sel}: the bars are right of the pawn`).toBeGreaterThanOrEqual(pawn.x + pawn.width - 2);
    expect(pawn.height, `${sel}: a big pawn`).toBeGreaterThanOrEqual(40);
  }
  // HP is green at full (the move clock's own colors: hue 135) and the bar's length is the share left.
  expect(await page.locator(".ac-hp-you").evaluate((el) => getComputedStyle(el).getPropertyValue("--f"))).toBe("1");
  expect(await page.locator(".ac-xp-you").evaluate((el) => getComputedStyle(el).getPropertyValue("--f"))).toBe("0.5");
  // Each has a dressed pawn drawn (your color to match your pieces: White in round 1; theirs Black).
  for (const [sel, color] of [[".ac-me", "white"], [".ac-opp", "black"]] as const) {
    await expect(page.locator(`${sel} .avatar`)).toHaveCount(1);
    await expect(page.locator(`${sel} .avatar piece.${color}.pawn, ${sel} .avatar .avatar-skin`).first()).toBeAttached();
    const drawn = await page.locator(`${sel} .avatar`).evaluate((el) => ({ w: el.getBoundingClientRect().width, kids: el.children.length }));
    expect(drawn.w).toBeGreaterThan(30);
    expect(drawn.kids).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

/** The hop animations on the page now (the pawn's and its shadow's), by the pawn they belong to. */
const hopAnims = (p: Page) =>
  p.evaluate(() =>
    document.getAnimations().flatMap((a) => {
      const el = (a.effect as KeyframeEffect | null)?.target as HTMLElement | null;
      if (!el || !/^ac-(hop|shade)$/.test((a as CSSAnimation).animationName ?? "")) return [];
      const keys = (a.effect as KeyframeEffect).getKeyframes();
      const props = new Set<string>();
      for (const k of keys) for (const q of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(q)) props.add(q);
      const timing = (a.effect as KeyframeEffect).getTiming();
      return [{ name: (a as CSSAnimation).animationName, who: el.closest(".ac-me") ? "me" : "opp", duration: timing.duration, iterations: timing.iterations, props: [...props].sort() }];
    }),
  );

/** Records when each pawn's `hopping` class goes on and off (the fake clock's performance.now), from before the screen exists. */
const recordHops = (p: Page) =>
  p.addInitScript(() => {
    const hops: Record<string, { on: number[]; off: number[] }> = { me: { on: [], off: [] }, opp: { on: [], off: [] } };
    (window as any).__hops = hops;
    const was = new WeakMap<Element, boolean>();
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element;
        if (!el.classList?.contains("ac-pawn")) continue;
        const who = el.closest(".ac-me") ? "me" : "opp";
        const now = el.classList.contains("hopping");
        if (now === (was.get(el) ?? false)) continue;
        was.set(el, now);
        (now ? hops[who]!.on : hops[who]!.off).push(performance.now());
      }
    }).observe(document, { attributes: true, attributeFilter: ["class"], subtree: true });
  });
const hopsSeen = (p: Page) => p.evaluate(() => (window as any).__hops as Record<"me" | "opp", { on: number[]; off: number[] }>);

test("each custom pawn hops once, then waits a random 7 to 10 s (its own draws, so the two never fall into step) before its next single hop: a crouch, a rise, a squash and a settle, the shadow shrinking and fading as it rises; transforms and opacity only; nothing moves in between", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  // (A fake clock: seven to ten seconds take no time. The screen's own steps run on it too: the buy step is 30 s, so what follows stays inside it.)
  await recordHops(page);
  // Paused before the page loads, then stepped: every timer, the pawns' first hops included, fires at its own time. (Pausing
  // after the screen was up jumped the clock a second, and Playwright fires every timer due in a jump at its end: two first
  // hops drawn inside that second both landed on its last tick, measured as one moment. docs/decisions/2026-10-28-two-flaky-tests.md.)
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await page.goto("/autochess?seed=9&intro=0");
  for (let i = 0; i < 200 && (await root(page).getAttribute("data-phase", { timeout: 100 }).catch(() => null)) !== "buy"; i++) await page.clock.runFor(50);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // (Once the screen's effects have run, so the pawns' first waits have started by then.)
  await page.clock.runFor(200);
  const mountedAt = await page.evaluate(() => performance.now());
  let posed = false;
  let idle = 0;
  const pose = async (who: string, ms: number) =>
    page.evaluate(
      ([w, t]) => {
        const all = document.getAnimations() as CSSAnimation[];
        const mineHop = (n: string) => all.find((a) => a.animationName === n && !!((a.effect as KeyframeEffect).target as HTMLElement).closest(w === "me" ? ".ac-me" : ".ac-opp"))!;
        const hop = mineHop("ac-hop");
        const shade = mineHop("ac-shade");
        // (The animations are set to the time asked and read at once, never paused: a script-paused animation would outlive its class.)
        for (const a of [hop, shade]) a.currentTime = Number(t);
        const h = new DOMMatrix(getComputedStyle((hop.effect as KeyframeEffect).target as HTMLElement).transform);
        const sh = getComputedStyle((shade.effect as KeyframeEffect).target as HTMLElement);
        return { y: h.m42, shadowScale: new DOMMatrix(sh.transform).a, shadowOpacity: Number(sh.opacity) };
      },
      [who, ms] as const,
    );
  // 28 seconds of the buy step, in steps of a quarter second.
  for (let t = 0; t < 28_000; t += 250) {
    await page.clock.runFor(250);
    const hopping = await page.evaluate(() => [...document.querySelectorAll(".ac-pawn.hopping")].map((e) => (e.closest(".ac-me") ? "me" : "opp")));
    const anims = await hopAnims(page);
    // While a pawn hops it has its two animations (the pawn and its shadow), once each, a hop long; when it doesn't, nothing of it moves.
    for (const who of ["me", "opp"] as const) {
      const mine = anims.filter((a) => a.who === who);
      if (hopping.includes(who)) {
        expect(mine, `${who} hopping`).toHaveLength(2);
        for (const a of mine) {
          expect(a.iterations, `${a.name}: one hop, not a loop`).toBe(1);
          expect(a.duration, `${a.name}: a hop is 1.8 s`).toBe(1800);
          // Transforms and opacity only (nothing that lays out or paints a lot): the pawn moves by transform, its shadow by transform and opacity.
          expect(a.props.every((q) => q === "transform" || q === "opacity"), `${a.name}: ${a.props}`).toBe(true);
        }
        expect(mine.find((a) => a.name === "ac-shade")!.props).toContain("opacity");
        if (!posed && who === "me") {
          posed = true;
          // The pawn rises (and the shadow shrinks and fades as it does): at the hop's top the pawn is higher than at rest and the shadow smaller and fainter.
          const rest = await pose("me", 0);
          const top = await pose("me", 0.37 * 1800);
          expect(top.y, "the pawn rises").toBeLessThan(rest.y - 5);
          expect(top.shadowScale, "the shadow shrinks as it rises").toBeLessThan(rest.shadowScale - 0.2);
          expect(top.shadowOpacity, "and fades").toBeLessThan(rest.shadowOpacity - 0.05);
        }
      } else {
        expect(mine, `${who} resting: nothing animates`).toHaveLength(0);
        idle++;
      }
    }
  }
  expect(posed, "your pawn hopped").toBe(true);
  expect(idle, "the pawns spend most of their time still").toBeGreaterThan(80);
  const hops = await hopsSeen(page);
  for (const who of ["me", "opp"] as const) {
    const { on, off } = hops[who];
    // In 28 s: a first hop within the first 7 s, then one every 7 to 10 s: three or four hops.
    expect(on.length, `${who}'s hops`).toBeGreaterThanOrEqual(3);
    expect(on.length).toBeLessThanOrEqual(5);
    expect(on[0]! - mountedAt, `${who}: the first hop comes within the first 7 s`).toBeLessThanOrEqual(7000);
    for (let i = 1; i < on.length; i++) {
      const wait = on[i]! - on[i - 1]!;
      expect(wait, `${who}: the wait before hop ${i + 1} is ${wait} ms`).toBeGreaterThanOrEqual(6990);
      expect(wait, `${who}: the wait before hop ${i + 1} is ${wait} ms`).toBeLessThanOrEqual(10_010);
    }
    // Each hop's class stays on for one hop (1.8 s), then comes off.
    for (let i = 0; i < off.length; i++) expect(Math.abs(off[i]! - on[i]! - 1800), `${who}: hop ${i + 1} lasts 1.8 s`).toBeLessThanOrEqual(10);
  }
  // Their own draws: the two pawns never hop at the same moment, and the gap between them changes from hop to hop.
  const gaps = hops.me.on.slice(0, 3).map((t, i) => hops.opp.on[i]! - t);
  expect(gaps.every((g) => g !== 0)).toBe(true);
  expect(new Set(gaps).size, "the pawns drift apart").toBe(gaps.length);
  expect(errors).toEqual([]);
});

test("the pawns stay still under reduced motion: no hop at all", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await recordHops(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/autochess?seed=9&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  for (let t = 0; t < 20_000; t += 1000) {
    await page.clock.runFor(1000);
    expect(await hopAnims(page)).toEqual([]);
  }
  const hops = await hopsSeen(page);
  expect(hops.me.on).toEqual([]);
  expect(hops.opp.on).toEqual([]);
  await expect(page.locator(".ac-pawn.hopping")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("each pawn has one shadow: the hopping pawn's own, that shrinks and fades as it rises; the dressed pawn's own ground shadow is hidden here and still shown elsewhere", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  // Dress your pawn as a snowman (its art draws its own ground shadow, which stayed under the pawn as it hopped): the profile's look comes from the server.
  await page.route(/\/api\/me(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.locker = { ...(body.locker ?? {}), look: { skin: { def: "snowman", color: "#f8fafc", blemish: 0, seed: 1 } } };
    await route.fulfill({ response: res, json: body });
  });
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The snowman is drawn (with its own ground shadow in its art), and that shadow is not shown.
  const own = page.locator(".ac-me .avatar-skin .skin-shadow");
  await expect(own).toHaveCount(1);
  expect(await own.evaluate((el) => getComputedStyle(el).display)).toBe("none");
  // Exactly one shadow under each pawn: `.ac-shadow`, a flat dark ellipse on the ground; no other shadow box, ::after or filter on the pawn.
  for (const who of ["me", "opp"]) {
    await expect(page.locator(`.ac-${who} .ac-shadow`)).toHaveCount(1);
    const shadows = await page.locator(`.ac-${who} .ac-pawn`).evaluate((pawn) => {
      const visible = (el: Element) => getComputedStyle(el).display !== "none";
      return {
        ellipses: [...pawn.querySelectorAll("ellipse")].filter(visible).length,
        afters: [pawn, ...pawn.querySelectorAll("*")].filter((el) => getComputedStyle(el, "::after").content !== "none" && getComputedStyle(el, "::after").content !== "normal").length,
        filters: [pawn, ...pawn.querySelectorAll(":scope > *, .fd-pawn-box, .avatar")].filter((el) => /drop-shadow/.test(getComputedStyle(el).filter)).length,
        // (The level badge's ring is a box-shadow of 0 blur, not a shadow under the pawn.)
        boxShadows: [pawn, ...pawn.querySelectorAll(":scope > *, .fd-pawn-box, .avatar")].filter((el) => !el.classList.contains("ac-badge") && getComputedStyle(el).boxShadow !== "none").length,
        own: pawn.classList.contains("shadow"),
      };
    });
    expect(shadows, `${who}'s pawn`).toEqual({ ellipses: 0, afters: 0, filters: 0, boxShadows: 0, own: false });
  }
  // Only here: the same art on any other screen keeps its shadow (the rule is scoped to the pawn on this screen).
  const elsewhere = await page.evaluate(() => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    e.setAttribute("class", "skin-shadow");
    svg.appendChild(e);
    document.body.appendChild(svg);
    const d = getComputedStyle(e).display;
    svg.remove();
    return d;
  });
  expect(elsewhere).not.toBe("none");
  expect(errors).toEqual([]);
});

test("feel: every button presses down while it is held (Reroll sinks onto its shadow) and comes back up", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PLAIN);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const sunk = (loc: Locator) => loc.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).m42);
  const buttons: [string, Locator, number][] = [
    ["Reroll", reroll(page), 3],
    ["Buy XP", xpButton(page), 3],
    ["a shop card", card(page, 2), 2],
  ];
  for (const [name, loc, least] of buttons) {
    const c = middle((await loc.boundingBox())!);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect.poll(() => sunk(loc), { message: `${name} sinks while it is held`, timeout: 2000 }).toBeGreaterThanOrEqual(least - 0.6);
    // Let go away from it (so nothing is bought or rerolled), and it comes back up.
    await page.mouse.move(c.x, c.y - 200);
    await page.mouse.up();
    await expect.poll(() => sunk(loc), { message: `${name} comes back up`, timeout: 2000 }).toBeLessThan(0.5);
  }
  expect(await goldOf(page)).toBe(10);
  expect(errors).toEqual([]);
});

test("a sale floats its gold up from the square the piece stood on (+7 for a queen), light CSS that is gone a moment later; nothing floats for a purchase", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(TWOQ);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 0));
  await expect(piece(page, "white", "queen", "g3")).toBeVisible();
  // Buying needs no animation.
  await expect(page.locator(".ac-float")).toHaveCount(0);
  const g3 = await center(page, "g3");
  const sq = (await page.locator(".ac-layer").boundingBox())!.width / 8;
  await tapSquare(page, "g3");
  await tap(page, page.getByRole("button", { name: "Sell 7", exact: true }));
  const flo = page.locator(".ac-float");
  await expect(flo).toHaveCount(1);
  await expect(flo).toHaveText("+7");
  // Its box is the square's; the number starts on it and rises (a CSS animation: the number's own box moves, the script does nothing per frame).
  const box = (await flo.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - g3.x)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - g3.y)).toBeLessThan(2);
  expect(Math.abs(box.width - sq)).toBeLessThan(2);
  const num = flo.locator("b");
  const early = (await num.boundingBox())!;
  expect(early.y + early.height / 2).toBeGreaterThan(g3.y - sq / 2 - 6);
  await page.waitForTimeout(450);
  const later = (await num.boundingBox())!;
  expect(later.y, "the number rises").toBeLessThan(early.y - 4);
  expect(Math.abs(later.x + later.width / 2 - g3.x), "straight up").toBeLessThan(3);
  expect(await num.evaluate((el) => getComputedStyle(el).animationName)).toBe("ac-float");
  await expect(flo).toHaveCount(0, { timeout: 3000 });
  expect(errors).toEqual([]);
});

test("mute is respected: with sound off every one of these sounds is asked for muted", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem("brc.muted", "1"));
  // (Lock-in is off since v7; `?lockin=1` turns it back on, for its sound.)
  await page.goto("/autochess?seed=9&lockin=1&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await tap(page, card(page, 2));
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await tap(page, xpButton(page));
  await tapSquare(page, "g3");
  await tap(page, page.getByRole("button", { name: /^Sell \d+$/ }));
  await tap(page, reroll(page));
  await tap(page, lockButton(page));
  const log = await page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => /^(ac|sell)/.test(l)));
  // A sound of each kind was asked for, and none of them is un-muted.
  for (const name of ["acReroll", "acPlace", "acHold", "acXp", "sell", "acLock"]) expect(log.some((l) => l.startsWith(`${name}:`)), name).toBe(true);
  expect(log.every((l) => l.endsWith(":muted"))).toBe(true);
  expect(errors).toEqual([]);
});

test("lock-in is off (v7): no button, no bonus for anyone (the bot never locks), and the buy step runs its whole 30 s, only the last 3 locked", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  // (Seed 5: with lock-in on, the bot would lock in at about 21 s of the 30's open 26. The real step, not the quick one.)
  await page.goto("/autochess?seed=5&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await expect(lockButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Lock in/ })).toHaveCount(0);
  await expect(root(page)).not.toHaveAttribute("data-bonus", /.+/);
  await expect(root(page)).not.toHaveAttribute("data-lockin", /.+/);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  await expect(clockOf(page)).toHaveText(/^0:(30|29)$/);
  await expect(stepLabel(page)).toHaveText("Planning");
  expect(await goldOf(page)).toBe(10);
  // Open at 15 s and still at 25 s: nobody ended it early, the opponent's lock-in time (with lock-in on) came and went.
  await page.waitForTimeout(Math.max(0, 15_000 - (Date.now() - t0)));
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(stepLabel(page)).toHaveText("Planning");
  await page.waitForTimeout(Math.max(0, 25_000 - (Date.now() - t0)));
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  // The last 3 seconds still lock: "Locked" at 27 s, in red, and the step ends at 30.
  await expect(stepLabel(page)).toHaveText("Locked", { timeout: 4000 });
  const lockedAt = (Date.now() - t0) / 1000;
  expect(lockedAt).toBeGreaterThan(26.6);
  expect(lockedAt).toBeLessThan(28);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 5000 });
  const endedAt = (Date.now() - t0) / 1000;
  expect(endedAt).toBeGreaterThan(29.6);
  expect(endedAt).toBeLessThan(31.5);
  // No bonus came to anyone: your gold is what it was (nothing bought), and the bot's lock-in gold is not in its numbers.
  expect(await goldOf(page)).toBe(10);
  expect(errors).toEqual([]);
});

test("lock in (behind `?lockin=1`): the first side to lock gets 3 gold at once, and your board, bench and shop freeze", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${NEVER}&lockin=1`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The button says what it is worth while the bonus is open.
  await expect(lockButton(page)).toContainText("Lock in");
  await expect(lockButton(page)).toContainText("+3 gold");
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "pawn", "g3")).toBeVisible();
  expect(await goldOf(page)).toBe(9);
  // Lock in: +3 at once (the bot never locks with this seed, so you are first), the button and the timer say so.
  await tap(page, lockButton(page));
  expect(await goldOf(page)).toBe(12);
  expect(await soundCount(page, "acLock")).toBe(1);
  await expect(root(page)).toHaveAttribute("data-bonus", "you");
  await expect(root(page)).toHaveAttribute("data-you-locked", "1");
  await expect(lockButton(page)).toHaveText("Locked in");
  await expect(lockButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(say(page)).toHaveText("First: +3 gold");
  // Frozen: no buying, rerolling or selling; each says why, and nothing changes.
  await card(page, 0).click({ force: true });
  await expect(say(page)).toHaveText("You're locked in");
  const kinds = await offers(page);
  await reroll(page).click({ force: true });
  expect(await offers(page)).toEqual(kinds);
  await xpButton(page).click({ force: true });
  await expectLevel(page, 4, "2/4");
  await dragMouse(page, middle((await card(page, 0).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(0);
  await tapSquare(page, "g3");
  await expect(say(page)).toHaveText("You're locked in");
  await expect(page.getByRole("button", { name: /^Sell/ })).toHaveCount(0);
  await expect(page.locator(`${BOARD_SEL.piece}.white`)).toHaveCount(2);
  await lockButton(page).click({ force: true });
  expect(await goldOf(page)).toBe(12);
  await expect(stepLabel(page)).toHaveText("Locked in", { timeout: 6000 });
  // The bot never locks here, so the step runs its time out; the gold is kept.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  expect(await goldOf(page)).toBe(12);
  expect(errors).toEqual([]);
});

test("lock in (behind `?lockin=1`): when the opponent locks first you see it, get no bonus, and both locked ends the step at once", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${EARLY}&lockin=1`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  await expect(lockButton(page)).toContainText("+3 gold");
  // At 1.33 s the opponent locks in: "Locked in" by their name, the bonus gone from the button.
  await expect(page.locator(".ac-bot-locked")).toHaveText("Locked in", { timeout: 6000 });
  await expect(page.getByLabel("Opponent locked in")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-bonus", "bot");
  await expect(lockButton(page)).not.toContainText("+3");
  // Their name and level still fit at the narrowest screen, with the tag in it.
  expect(await page.locator(".ac-who .ac-name").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await goldOf(page)).toBe(10);
  // You lock in second: no bonus, and the step ends at once (it would run to 7 s).
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 1500 });
  expect(Date.now() - t0).toBeLessThan(6500);
  expect(await goldOf(page)).toBe(10);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("lock in (behind `?lockin=1`): you lock before the opponent, and when it locks too the step ends at once", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${LATE}&lockin=1`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const t0 = Date.now();
  await tap(page, lockButton(page));
  await expect(root(page)).toHaveAttribute("data-bonus", "you");
  expect(await goldOf(page)).toBe(13);
  await expect(page.locator(".ac-bot-locked")).toHaveCount(0);
  // The opponent locks at 3.79 s: both locked, so the move step begins then, not at the 7 s end.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(6000);
  expect(await goldOf(page)).toBe(13);
  expect(errors).toEqual([]);
});

/** Samples the board every 80 ms while you buy: their real pieces (revealed), their circles, your grayed pieces (unseen by them) and the yellow-bordered one (your next). */
type RevealSample = { t: number; black: string[]; circles: string[]; unseen: string[]; next: string | null; pinged: boolean; clash: boolean; nextOk: boolean };
/**
 * The board while the first buy step runs, sampled in the page from the moment the step begins (`data-phase` turns "buy", seen by an
 * observer set up before the page loads, `recordReveals`): at every change on the screen and every 80 ms, `t` in seconds from the
 * step's start, up to `ms` or the step's end. (Nov 6: timed from when the test first saw the step, a busy runner's late look moved
 * every reveal that much early: 4 of 15 runs under load saw "theirs at 6 s" at 4.7 to 5.5 s.)
 */
const watchReveals = async (page: Page, ms: number): Promise<RevealSample[]> => {
  await page.waitForFunction(
    (ms) => {
      const w = window as unknown as { __acBuyAt?: number; __acBuyEnded?: boolean };
      return w.__acBuyEnded || (w.__acBuyAt !== undefined && performance.now() - w.__acBuyAt > ms);
    },
    ms,
    { timeout: ms + 30_000 },
  );
  return page.evaluate((ms) => ((window as unknown as { __acReveals: RevealSample[] }).__acReveals ?? []).filter((x) => x.t <= ms / 1000), ms);
};
/** Sets up `watchReveals`' record: call before the page loads. */
const recordReveals = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __acBuyAt?: number; __acBuyEnded?: boolean; __acReveals: unknown[] };
    w.__acReveals = [];
    const sqs = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].map((e) => e.getAttribute("data-square")!).sort();
    let timer = 0;
    const look = () => {
      const phase = document.querySelector(".ac-root")?.getAttribute("data-phase");
      if (w.__acBuyAt === undefined) {
        if (phase !== "buy") return;
        w.__acBuyAt = performance.now();
        timer = window.setInterval(look, 80);
      }
      if (w.__acBuyEnded) return;
      if (phase !== "buy") {
        w.__acBuyEnded = true;
        clearInterval(timer);
        return;
      }
      const black = sqs(".hb-board piece.black:not(.king)");
      const circles = sqs(".ac-circle");
      const unseen = sqs(".hb-board piece.white.ac-unseen");
      const next = document.querySelector(".ac-next")?.getAttribute("data-square") ?? null;
      w.__acReveals.push({
        t: (performance.now() - w.__acBuyAt) / 1000,
        black,
        circles,
        unseen,
        next,
        // (A revealed piece has its gold ring and no circle; the yellow border is only ever on a grayed piece of yours.)
        pinged: black.every((sq) => !!document.querySelector(`.ac-ping[data-square="${sq}"]`)),
        clash: black.some((sq) => circles.includes(sq)),
        nextOk: next === null || unseen.includes(next),
      });
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true });
  });
/** The first sample (seconds from the step's start) where `test` holds. */
const firstWhen = <T,>(samples: T[], test: (s: T) => boolean) => (samples.find(test) as { t: number } | undefined)?.t ?? null;

test("while you buy their pieces are live circles (pawns too); every 1.5 s (quick) a piece is revealed piece for piece by kind: the later placed of a pair first; yours grayed until seen, the next one with a yellow border", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  // Seed 1: you (king b2) start with a knight on c2 and a bishop on d2 (put down as the step begins: placed first). The bot puts a pawn on a6 at 1.21 s, bishops on d8
  // at 1.65 s and a5 at 2.16 s, and a knight on h8 at 2.53 s. The reveals (every 1.5 s): 1.5 nothing (no pawn of yours to match a6); 3 their d8 (placed after your
  // c2: theirs first); 4.5 your c2; 6 their a5 (paired with your d2, which would answer at 7.5: past the step). a6 and h8 have no match: circles to the end.
  await recordReveals(page);
  await page.goto("/autochess?quick=1&seed=1&stars=n@c2:1,b@d2:1&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const s = await watchReveals(page, 6800);
  const at = (t: number) => s.filter((x) => x.t <= t).at(-1)!;
  // Circles are live: a6 shows by 1.21 s (sampled within a tick), each placed piece at once.
  expect(at(0.1).circles).toEqual([]);
  expect(at(0.1).unseen).toEqual(["c2", "d2"]);
  const d8 = firstWhen(s, (x) => x.black.includes("d8"))!;
  const c2 = firstWhen(s, (x) => !x.unseen.includes("c2"))!;
  const a5 = firstWhen(s, (x) => x.black.includes("a5"))!;
  expect(firstWhen(s, (x) => x.circles.includes("a6"))!).toBeLessThan(d8 - 1.2);
  // Their bishop first, your knight 1.5 s later, their other bishop 1.5 s after that; one at a time.
  expect(c2 - d8).toBeGreaterThan(1.2);
  expect(c2 - d8).toBeLessThan(1.8);
  expect(a5 - c2).toBeGreaterThan(1.2);
  expect(a5 - c2).toBeLessThan(1.8);
  expect(at(d8 - 0.05).black).toEqual([]);
  expect(at(a5 - 0.05).black).toEqual(["d8"]);
  // Your bishop on d2 stays grayed (its answer would come after the step), their pawn and knight stay circles.
  const last = s.at(-1)!;
  expect(last.black).toEqual(["a5", "d8"]);
  expect(last.circles).toEqual(["a6", "h8"]);
  expect(last.unseen).toEqual(["d2"]);
  // The yellow border: on your knight once their bishop is down (it is next), never before there's a match, off once it is seen; never on d2 (no tick left for it).
  expect(at(0.5).next).toBeNull();
  expect(at(d8 - 0.2).next).toBe("c2");
  expect(at(c2 - 0.1).next).toBe("c2");
  expect(s.filter((x) => x.t > c2 + 0.1).every((x) => x.next === null)).toBe(true);
  expect(s.every((x) => x.nextOk && !x.clash && x.pinged)).toBe(true);
  // A thin yellow border (2 px, inside the square), no green; and a grayed piece is grayed.
  await page.goto("/autochess?quick=1&seed=1&stars=n@c2:1,b@d2:1&intro=0");
  await expect(page.locator('.ac-next[data-square="c2"]')).toHaveCount(1, { timeout: 4000 });
  expect(await page.locator(".ac-next").evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/^rgb\(255, 214, 10\) 0px 0px 0px 2px inset$/);
  expect(await page.locator(`${BOARD_SEL.piece}.white.ac-unseen`).first().evaluate((el) => getComputedStyle(el).filter)).toContain("grayscale");
  // A ping as each of theirs turns into its piece: one for each reveal of theirs. (Read from this load's record, at the step's end: the
  // two show for the last second and a half of the quick step only, which a poll on a busy runner can miss, Nov 6.)
  expect((await watchReveals(page, 8000)).at(-1)!.black).toHaveLength(2);
  expect(await soundCount(page, "acReveal")).toBe(2);
  // The move step shows everything for real: no circle, nothing grayed or bordered.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  await expect(page.locator(".ac-unseen, .ac-next")).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBe(4);
  expect(errors).toEqual([]);
});

test("the reveals come every 3 seconds of the 30: theirs at 6 s, your matching piece at 9 s; nothing of theirs shows while you have no match", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  // Seed 11 (the full 30 s): the bot (king h8) puts a bishop on c8 at 3.40 s, then pawns at 6.96, 12.17 and 15.98 s. You start with a knight on c2 (king h1).
  await recordReveals(page);
  await page.goto("/autochess?seed=11&stars=n@c2:1&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  const s = await watchReveals(page, 13_000);
  const c8 = firstWhen(s, (x) => x.black.includes("c8"))!;
  const c2 = firstWhen(s, (x) => !x.unseen.includes("c2"))!;
  // The first tick after their bishop is down is 6 s; yours answers at 9 s.
  expect(c8).toBeGreaterThan(5.5);
  expect(c8).toBeLessThan(7.4);
  expect(c2 - c8).toBeGreaterThan(2.7);
  expect(c2 - c8).toBeLessThan(3.3);
  // Their pawns have no match: circles all along; only the bishop shows.
  expect(s.at(-1)!.black).toEqual(["c8"]);
  expect(s.at(-1)!.circles.length).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("tap one of their bench pieces: a red ring on it and its landing square lights red on their half; a second tap or another piece clears it; their bench never drags", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(HELD);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Their bench shows real pieces (a bishop for a8 and a rook for f8 here), each with its square, on the color of that square, and the pieces are drawn black.
  const tiles = theirBench(page).locator(".ac-slot.has");
  await expect(tiles).toHaveCount(2, { timeout: 8000 });
  await expect(tiles.nth(0)).toHaveAttribute("data-kind", "b");
  await expect(tiles.nth(0)).toHaveAttribute("data-square", "a8");
  await expect(tiles.nth(0).locator("em")).toHaveText("a8");
  await expect(tiles.nth(0)).toHaveClass(isDark("a8") ? /\bd\b/ : /\bl\b/);
  await expect(tiles.nth(0).locator("piece")).toHaveClass(/black/);
  await expect(tiles.nth(1)).toHaveAttribute("data-kind", "r");
  await expect(tiles.nth(1)).toHaveAttribute("data-square", "f8");
  // A tile is a board square (v5: 45 px at 390 x 844, 41 on the test phone, 52 at 1280 x 800).
  expect((await tiles.nth(0).boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await expect(page.locator(".ac-red")).toHaveCount(0);
  await expect(tiles.nth(0)).not.toHaveClass(/tapped/);
  // Tapped: a red ring on the tile, and the landing square lights red, exactly on that square of their half.
  await tap(page, tiles.nth(0));
  await expect(tiles.nth(0)).toHaveClass(/tapped/);
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(page.locator(".ac-red")).toHaveAttribute("data-square", "a8");
  const red = (await page.locator(".ac-red").boundingBox())!;
  const bishopSq = await center(page, "a8");
  expect(Math.abs(red.x + red.width / 2 - bishopSq.x)).toBeLessThan(1.5);
  expect(Math.abs(red.y + red.height / 2 - bishopSq.y)).toBeLessThan(1.5);
  expect(await page.locator(".ac-red").evaluate((el) => getComputedStyle(el).backgroundColor)).toMatch(/^rgba\(220, 38, 38/);
  expect(await tiles.nth(0).evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/220, 38, 38/);
  // It is on their half (the top, as White is at the bottom), and over the whole square.
  const boardBox = (await page.locator(".ac-layer").boundingBox())!;
  expect(red.y + red.height).toBeLessThanOrEqual(boardBox.y + boardBox.height / 2 + 1);
  expect(red.width).toBeGreaterThan(boardBox.width / 8 - 2);
  // Another of their pieces: the ring and the red square move to it.
  await tap(page, tiles.nth(1));
  await expect(tiles.nth(0)).not.toHaveClass(/tapped/);
  await expect(tiles.nth(1)).toHaveClass(/tapped/);
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(page.locator(".ac-red")).toHaveAttribute("data-square", "f8");
  // A second tap on the same one clears it.
  await tap(page, tiles.nth(1));
  await expect(page.locator(".ac-red")).toHaveCount(0);
  await expect(tiles.nth(1)).not.toHaveClass(/tapped/);
  // Their bench never drags: a press and a drag on a tile picks nothing up, and nothing lights up for a drop.
  const at = middle((await tiles.nth(0).boundingBox())!);
  const goldBefore = await goldOf(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 8, at.y + 8, { steps: 2 });
  const to = await shopMiddle(page);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(page.locator(".ac-ghost")).toHaveCount(0);
  await expect(page.locator(".ac-sell-drop")).toHaveCount(0);
  await page.mouse.up();
  expect(await goldOf(page)).toBe(goldBefore);
  await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(2);
  // The tap holds through the move step (their pieces are shown for real then) and is gone when the fight begins.
  await tap(page, tiles.nth(0));
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-red")).toHaveCount(1);
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 15_000 });
  await expect(page.locator(".ac-red")).toHaveCount(0);
  await expect(theirBench(page).locator(".ac-slot.has")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("a drag with a finger: a placed piece onto the shop sells it", async ({ page }) => {
  test.skip(!phone(), "real touch events, as a phone makes them");
  const errors = watchErrors(page);
  await page.goto("/autochess?seed=9&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await card(page, 3).tap();
  await expect(piece(page, "white", "pawn", "h3")).toBeVisible();
  await dragTouch(page, await center(page, "h3"), await shopMiddle(page));
  await expect(piece(page, "white", "pawn", "h3")).toHaveCount(0);
  // (10 gold, a pawn bought for 1, sold for 1: 75% of 1, to the nearest gold.)
  expect(await goldOf(page)).toBe(10);
  expect(errors).toEqual([]);
});

test("the phase banners on the board: ACTION PHASE as buying begins, the big 3-2-1 for its last seconds, MOVE PHASE, BATTLE PHASE: the words about half the 3-2-1's size in a frosted box; no timer bars (Nov 8); no hint text", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(MOVE);
  await watchBanners(page);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // (The knight and the two pawns, so there is a move to make and a fight to play.)
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await tap(page, card(page, 2));
  // ACTION PHASE as buying begins: words in the board's middle, in a rounded frosted box, upper case, and it fits inside the board.
  const action = page.locator(".ac-banner .cc-num.ac-phase");
  await expect(action).toHaveText("ACTION PHASE");
  const board = (await page.locator(".hb-board").boundingBox())!;
  const box = (await action.boundingBox())!;
  expect(box.x).toBeGreaterThan(board.x);
  expect(box.x + box.width).toBeLessThan(board.x + board.width);
  // (The banner is centered on the board's wrap, which is up to 8 device pixels wider than its squares: half of that at most.)
  expect(Math.abs(box.x + box.width / 2 - (board.x + board.width / 2)), "centered").toBeLessThan(4.5);
  expect(Math.abs(box.y + box.height / 2 - (board.y + board.height / 2)), "in the middle").toBeLessThan(board.height * 0.14);
  const style = await action.evaluate((el) => {
    const s = getComputedStyle(el);
    return { blur: s.backdropFilter || s.webkitBackdropFilter, radius: parseFloat(s.borderTopLeftRadius), bg: s.backgroundColor, fontSize: parseFloat(s.fontSize), board: el.closest(".board-wrap")!.getBoundingClientRect().width };
  });
  expect(style.blur).toContain("blur");
  expect(style.radius).toBeGreaterThan(8);
  expect(style.bg).toMatch(/^rgba\(/);
  // No hint text under the board any more: nothing but a short message for a moment, and the benches.
  await expect(page.locator(".ac-msg, .ac-card-say, .ac-hint")).toHaveCount(0);
  // No timer bars anywhere in this mode (Nov 8: was the app's own bars along the board's top and bottom): the hexagon's time is the clock.
  await expect(page.locator(".ac-root .timer-bar")).toHaveCount(0);
  // The step's name over the time in the hexagon (Nov 8).
  await expect(clockOf(page)).toHaveText(/^0:0[4-7]$/);
  await expect(stepLabel(page)).toHaveText("Planning");
  // The 3-2-1 for the last seconds, the app's own big numbers, and the shop shut with them.
  const count = page.locator(".ac-banner[data-banner=count] .cc-num");
  await expect(count).toHaveText(/^[321]$/, { timeout: 8000 });
  const countSize = await count.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  // The words are about half the 3-2-1's size (9 against 44 hundredths of the board: well under half; "about half" is the designer's reading of the app's countdown).
  expect(style.fontSize).toBeLessThan(countSize * 0.5);
  expect(style.fontSize).toBeGreaterThan(countSize * 0.1);
  // The move step, and the fight.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 10_000 });
  await expect(page.locator(".ac-banner .cc-num.ac-phase")).toHaveText("MOVE PHASE");
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 20_000 });
  await expect(page.locator(".ac-banner .cc-num.ac-phase")).toHaveText("BATTLE PHASE");
  // Each banner goes after its pop (about 1.6 s), none stays over the fight.
  await expect(page.locator(".ac-banner")).toHaveCount(0, { timeout: 4000 });
  const seen = (await bannersSeen(page)).map((b) => b.text);
  expect(seen).toEqual(["ACTION PHASE", "3", "2", "1", "MOVE PHASE", "BATTLE PHASE"]);
  const times = await bannersSeen(page);
  // (One every second for the 3-2-1.)
  expect(times[2]!.at - times[1]!.at).toBeGreaterThan(800);
  expect(times[2]!.at - times[1]!.at).toBeLessThan(1300);
  // No bars for the fight either.
  await expect(page.locator(".ac-root .timer-bar")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the v7 move step (behind `?adjustmode=legal` since v8): one piece of yours is lit at random and you get 7 seconds for one legal chess move with it that stays on your half; the refusals say why; it can be taken back", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto(`${MOVE}&adjustmode=legal`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // The knight for e2, the pawns for a3 and h3.
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await tap(page, card(page, 2));
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(piece(page, "white", "pawn", "a3")).toBeVisible();
  await expect(piece(page, "white", "pawn", "h3")).toBeVisible();
  const circles = await page.locator(".ac-circle").count();
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const marks: { phase: string; at: number }[] = [{ phase: root.dataset.phase!, at: performance.now() }];
    (window as any).__phases = marks;
    new MutationObserver(() => {
      if (marks[marks.length - 1]!.phase !== root.dataset.phase) marks.push({ phase: root.dataset.phase!, at: performance.now() });
    }).observe(root, { attributes: true, attributeFilter: ["data-phase"] });
  });
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  // Their full board shows (the circles are the pieces now) and stays; nothing says "your opponent is moving"; the shop is shut.
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  const theirs = await page.locator(`${BOARD_SEL.piece}.black`).count();
  expect(theirs).toBeGreaterThanOrEqual(circles + 1);
  await expect(page.locator(".ac-theirs-line")).toHaveCount(0);
  await expect(page.locator(".ac-shop")).toHaveClass(/shut/);
  await expect(page.locator(".ac-sil")).toHaveCount(0);
  await expect(stepLabel(page)).toHaveText("Move");
  await expect(clockOf(page)).toHaveText(/^0:0[67]$/);
  // The lit piece: the knight on e2 (seed 24), its box glowing, with its six legal squares as dots; the king and the pawns aren't lit.
  await expect(page.locator(".ac-pick")).toHaveCount(1);
  await expect(page.locator(".ac-pick")).toHaveAttribute("data-square", "e2");
  const lit = (await page.locator(".ac-pick").boundingBox())!;
  const e2 = await center(page, "e2");
  expect(Math.abs(lit.x + lit.width / 2 - e2.x)).toBeLessThan(1.5);
  expect(Math.abs(lit.y + lit.height / 2 - e2.y)).toBeLessThan(1.5);
  const dots = () => page.locator(".ac-dot").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.square!).sort());
  expect(await dots()).toEqual(["c1", "c3", "d4", "f4", "g1", "g3"]);
  expect(await page.locator(".ac-pick").evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  // Refused, each with its reason in a few words, and nothing is used up: another piece of yours, your king, their half, a square the knight can't reach.
  await tapSquare(page, "a3");
  await expect(say(page)).toHaveText("Only the lit piece");
  await tapSquare(page, "d1");
  await expect(say(page)).toHaveText("King stays put");
  await tapSquare(page, "e5");
  await expect(say(page)).toHaveText("Your half only");
  await tapSquare(page, "e3");
  await expect(say(page)).toHaveText("Not a legal move");
  await dragMouse(page, await center(page, "e2"), await center(page, "a3"));
  await expect(say(page)).toHaveText("Square taken");
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  expect(await dots()).toEqual(["c1", "c3", "d4", "f4", "g1", "g3"]);
  // One legal move: the knight to g3, by a tap on its dot. It lands, is marked (tap ↩ to take it back), the dots and the glow go, the move sound plays.
  await tapSquare(page, "g3");
  await expect(piece(page, "white", "knight", "g3")).toBeVisible();
  await expect(piece(page, "white", "knight", "e2")).toHaveCount(0);
  await expect(page.locator('.ac-moved[data-square="g3"]')).toBeVisible();
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  expect(await soundCount(page, "move")).toBeGreaterThanOrEqual(1);
  // The opponent's pieces haven't changed meanwhile, and are still shown.
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(theirs);
  // No second move: not another square for the knight, not another piece.
  await tapSquare(page, "c3");
  await expect(say(page)).toHaveText("Moved. Tap ↩ to undo.");
  await expect(piece(page, "white", "knight", "g3")).toBeVisible();
  await dragMouse(page, await center(page, "a3"), await center(page, "a4"));
  await expect(piece(page, "white", "pawn", "a3")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(1);
  // A tap on the moved piece takes its move back: the knight is lit again with its squares, and may go elsewhere, here by a drag.
  await tapSquare(page, "g3");
  await expect(piece(page, "white", "knight", "e2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  await expect(page.locator(".ac-pick")).toHaveAttribute("data-square", "e2");
  expect(await dots()).toEqual(["c1", "c3", "d4", "f4", "g1", "g3"]);
  await dragMouse(page, await center(page, "e2"), await center(page, "f4"));
  await expect(piece(page, "white", "knight", "f4")).toBeVisible();
  await expect(page.locator('.ac-moved[data-square="f4"]')).toBeVisible();
  // The step is 7 seconds, then the fight (with the knight on f4: skipping would leave it on e2).
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 12_000 });
  const marks = await page.evaluate(() => (window as any).__phases as { phase: string; at: number }[]);
  const adjust = marks.find((m) => m.phase === "adjust")!;
  const next = marks.find((m) => m.at > adjust.at && m.phase !== "adjust")!;
  expect((next.at - adjust.at) / 1000).toBeGreaterThan(6.9);
  expect((next.at - adjust.at) / 1000).toBeLessThan(7.7);
  expect(errors).toEqual([]);
});

test("the v7 move step (`?adjustmode=legal`) with no piece of yours able to move: a short line says so, nothing is lit, and the step still runs (the bot may move) before the fight", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto(`${NEVER}&adjustmode=legal`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Buy nothing: only your king. The step still runs for the bot's move.
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(say(page)).toHaveText("No piece can move");
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(page.locator(".ac-dot")).toHaveCount(0);
  await tapSquare(page, "d2");
  await expect(say(page)).toHaveText("King stays put");
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result|over)$/, { timeout: 12_000 });
  expect(errors).toEqual([]);
});

test("the move step off (?adjust=0): the buy step goes straight to the fight, with both boards in full from the first move", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=11&adjust=0&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".ac-root")!;
    const seen: string[] = [root.dataset.phase!];
    (window as any).__seen = seen;
    new MutationObserver(() => {
      if (seen[seen.length - 1] !== root.dataset.phase) seen.push(root.dataset.phase!);
    }).observe(root, { attributes: true, attributeFilter: ["data-phase"] });
  });
  await tap(page, card(page, 3));
  await expect(root(page)).toHaveAttribute("data-phase", /^(fight|result)$/, { timeout: 15_000 });
  const seen = await page.evaluate(() => (window as any).__seen as string[]);
  expect(seen).not.toContain("adjust");
  expect(seen[0]).toBe("buy");
  expect(seen[1]).toBe("fight");
  // Their pieces are all real for the fight (no circle is left).
  await expect(page.locator(".ac-circle")).toHaveCount(0);
  expect(await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("the old adjust step stays in code behind `adjustMode: teleport` (`?adjustmode=teleport`): any piece to any empty square of your half, the refusals say why, it can be taken back, the king stays", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto(`${LATE}&adjustmode=teleport`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Two pawns on their start rank: f2 and g2.
  await tap(page, card(page, 0));
  await tap(page, card(page, 1));
  await expect(piece(page, "white", "pawn", "f2")).toBeVisible();
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-phase", "adjust", { timeout: 15_000 });
  await expect(page.locator(".ac-pick")).toHaveCount(0);
  await expect(say(page)).toHaveText("Tap a piece, then a square");
  // Refused, each with its reason, and nothing is used up: their half, a taken square, the king's square, your back rank (for a pawn).
  const refused = async (to: string, words: string) => {
    await dragMouse(page, await center(page, "g2"), await center(page, to));
    await expect(say(page)).toHaveText(words);
    await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
    await expect(page.locator(".ac-moved")).toHaveCount(0);
  };
  await refused("e6", "Your half only");
  await refused("f2", "Square taken");
  await refused("c1", "King's square");
  await refused("a1", "Not on back rank");
  // Your one change: not a chess move. The pawn on g2 (picked up by the last drag) may go to any empty square of ranks 2 to 4: 24 less the two pawns' squares, 22 dots; here to h4 by a tap.
  await expect(page.locator(".ac-dot")).toHaveCount(22);
  await tapSquare(page, "h4");
  await expect(piece(page, "white", "pawn", "h4")).toBeVisible();
  await expect(page.locator('.ac-moved[data-square="h4"]')).toBeVisible();
  await tapSquare(page, "f2");
  await tapSquare(page, "f3");
  await expect(say(page)).toHaveText("Moved. Tap ↩ to undo.");
  // A tap on the moved piece takes its move back.
  await tapSquare(page, "h4");
  await expect(piece(page, "white", "pawn", "g2")).toBeVisible();
  await expect(page.locator(".ac-moved")).toHaveCount(0);
  // The king stays where the game put it.
  await tapSquare(page, "c1");
  await expect(say(page)).toHaveText("King stays put");
  expect(errors).toEqual([]);
});

test("a fight plays to a result, HP changes by the rule, and the next round starts empty but for the new kings, with the colors turned", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const errors = watchErrors(page);
  await page.goto(FIGHT);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Hold the bishop offered for e4 (slot 3): 3 now, and it stays on the bench through the fight and into the next round.
  const heldOffer = (await offers(page))[3]!;
  expect(heldOffer).toEqual({ kind: "b", square: "e4" });
  await dragMouse(page, middle((await card(page, 3).boundingBox())!), await benchMiddle(page));
  await expect(held(page)).toHaveCount(1);
  expect(await goldOf(page)).toBe(7);
  // Buy what the shop shows with the rest (pawns), up to four times (level 4: four pieces on the board).
  await expectLevel(page, 4, "2/4");
  const bought = await buyAll(page, 4);
  expect(bought).toBeGreaterThanOrEqual(2);
  const left = await goldOf(page);
  await watchFight(page);
  // To a result (through the move step and the fight).
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 150_000 });
  // The fight: "Battle" over the move count ("12/60") in the hexagon timer (its spoken label "Move 12 of 60"), with its rules in the box, the moves highlighted on the board.
  const fight = await fightSeen(page);
  expect(fight.fight).toBe(true);
  expect(fight.say).toMatch(/^Move \d+ of 60/);
  expect(fight.count).toMatch(/^\d+\/60$/);
  expect(fight.label).toBe("Battle");
  expect(fight.text).toContain("A side left with only its king loses. Gains count, not army size: 3 pawns gained for 6 moves wins,");
  expect(fight.text).toContain("and a stall (repeats, 10 moves each with no capture, or 60) goes to the side that gained more.");
  expect(fight.text).not.toMatch(/checks? in a row/);
  expect(fight.text).toContain("A pawn at the far end cashes in for +2 gold.");
  expect(fight.lastMove).toBe(true);
  // The board's usual knocks play for the engine's moves (a capture sounds as it does everywhere).
  expect(await page.evaluate(() => (window as any).__soundLog.filter((l: string) => /^(move|capture):/.test(l)).length)).toBeGreaterThan(0);
  const head = (await page.locator(".ac-card-head").innerText()).trim();
  expect(head).toMatch(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
  // The result says why the fight ended (a stall: why, and who the engine's score favors by how much).
  expect(words).toMatch(RESULT_WHY);
  const lost = words.match(/(?:You|Your opponent) loses? (\d+) HP\./);
  const gold = (await page.locator(".ac-card-gold").innerText()).trim();
  expect(gold).toMatch(/^Next round: \d+ saved \+ \d+ income( \+ \d+ interest)?( \+ \d+ streak)?( \+ \d+ survivors)?( \+ \d+ from cash-ins)? = \d+ gold$/);
  expect(gold).toMatch(new RegExp(`^Next round: ${left} saved \\+ 12 income`));
  const [youHp, botHp] = [await hp(page, "you"), await hp(page, "bot")];
  if (head.startsWith("You win")) {
    expect(youHp).toBe(24);
    expect(botHp).toBe(24 - Number(lost![1]));
    expect(botHp).toBeLessThan(24);
  } else if (head.startsWith("You lose")) {
    expect(botHp).toBe(24);
    expect(youHp).toBe(24 - Number(lost![1]));
    expect(youHp).toBeLessThan(24);
  } else {
    expect([youHp, botHp]).toEqual([24, 24]);
    expect(words).toContain("Nobody loses HP.");
  }
  // The loss is the round's number (1) plus 1 for every 3 enemy pieces (not the king) left: round 1 costs 1 to 3, never under 1 for a lost round.
  if (lost) {
    expect(Number(lost[1])).toBeGreaterThanOrEqual(1);
    expect(Number(lost[1])).toBeLessThanOrEqual(3);
  }
  // The final position stays on the board for a look; the result is in the box under it.
  expect(await page.locator(BOARD_SEL.piece).count()).toBeGreaterThanOrEqual(2);
  // (A match can't end in one round: a lost round 1 costs 3 at most, of 24.)
  await expect(root(page)).toHaveAttribute("data-phase", "result");
  // Both benches are still there for the result: yours holds the bishop.
  await expect(held(page)).toHaveCount(1);
  await expect(youBench(page).locator(".ac-slot")).toHaveCount(4);
  await expect(theirBench(page).locator(".ac-slot")).toHaveCount(4);

  // The next round: the kings alone (new squares, mirrored), you are Black and your half is at the bottom; the gold is what the line said.
  const total = Number(gold.match(/= (\d+) gold$/)![1]);
  await page.getByRole("button", { name: "Next round" }).click();
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await expect(root(page)).toHaveAttribute("data-round", "2");
  await expect(page.locator(".ac-title span")).toHaveText("Round 2");
  await expect(page.locator(BOARD_SEL.wrap)).toHaveClass(/orientation-black/);
  await expect(page.locator(`${BOARD_SEL.piece}.black`)).toHaveCount(1);
  // Round 2's free 2 XP made level 5 (2 + 2 of 4): the number pops at the round's start. The opponent got its 2 XP too.
  await expectLevel(page, 5, "0/8");
  await expect(page.locator(".ac-badge.pop")).toBeVisible();
  await expect(botLevel(page)).toHaveText(/^Lv [5-9]$/);
  // What was held stays: the bishop is on the bench still, for the square turned with the colors (e4 for White, e5 for Black), and tapping it places it there.
  await expect(held(page)).toHaveCount(1);
  await expect(held(page).first()).toHaveAttribute("data-kind", "b");
  await expect(held(page).first()).toHaveAttribute("data-square", "e5");
  await expect(held(page).first().locator("em")).toHaveText("e5");
  // The shop refilled free: four offers, on Black's half (ranks 5 to 8), and the gold is only the round's pay. Its odds are level 5's now.
  const shown = await offers(page);
  expect(shown).toHaveLength(4);
  for (const o of shown) expect(Number(o.square[1])).toBeGreaterThanOrEqual(5);
  expect(await goldOf(page)).toBe(total);
  // (Nov 8: "Income +N" is everything earned this round, the next round's gold less what was saved.)
  await expect(page.locator(".ac-income b")).toHaveText(`+${total - Number(gold.match(/^Next round: (\d+) saved/)![1])}`);
  await expect(page.locator(".ac-od b")).toHaveText(["66%", "14%", "13%", "7%", "0%"]);
  const k2 = (await root(page).getAttribute("data-king"))!;
  const b2 = (await root(page).getAttribute("data-bot-king"))!;
  expect(Number(k2[1])).toBeGreaterThanOrEqual(7);
  expect(b2[0]).toBe(k2[0]);
  expect(Number(k2[1]) + Number(b2[1])).toBe(9);
  // Black's pieces land on the half at the bottom of the screen, on the offered square; the held bishop lands on its own.
  const slot = shown.findIndex((o) => o.kind === "p" && o.square !== "e5");
  await tap(page, card(page, slot));
  await expect(piece(page, "black", "pawn", shown[slot]!.square)).toBeVisible();
  await tap(page, held(page).first());
  await tap(page, held(page).first());
  await expect(piece(page, "black", "bishop", "e5")).toBeVisible();
  await expect(held(page)).toHaveCount(0);
  expect(await goldOf(page)).toBe(total - 1);
  expect(errors).toEqual([]);
});

test("a pawn reaching the far end cashes in: it lands, a coin sounds, \"+2\" floats up from its square, it leaves, and the 2 gold is in the next round's line", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  // (A test switch, `?fightfen=`: the fight starts from this position. White's king on h1 is shut in and its h-pawn blocked, so its one
  // move is the b-pawn's step onto b8: a cash-in. You are White in round 1.)
  const fen = "6r1/1P6/8/4k3/8/7p/7P/7K w - - 0 1";
  // (The screen never loads Stockfish: the HunChess engine plays the fight.)
  const stockfish: string[] = [];
  page.on("request", (r) => /stockfish/i.test(r.url()) && stockfish.push(r.url()));
  await page.goto(`/autochess?quick=1&seed=3&adjust=0&fightfen=${encodeURIComponent(fen)}&intro=0`);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Every frame from here: a pawn drawn on b8, and the floating gold (its amount and the square it sits on).
  await page.evaluate(() => {
    const seen = { pawnOnB8: false, floats: [] as { amount: string; x: string; y: string }[], pawnAfter: true };
    (window as any).__cash = seen;
    const look = () => {
      if (document.querySelector('.hb-board piece.white.pawn[data-square="b8"]')) seen.pawnOnB8 = true;
      for (const f of document.querySelectorAll<HTMLElement>(".ac-float.on-board")) {
        const at = { amount: f.dataset.amount!, x: f.style.getPropertyValue("--sq-x"), y: f.style.getPropertyValue("--sq-y") };
        if (!seen.floats.some((s) => s.amount === at.amount && s.x === at.x && s.y === at.y)) seen.floats.push(at);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 60_000 });
  const cash = await page.evaluate(() => (window as any).__cash as { pawnOnB8: boolean; floats: { amount: string; x: string; y: string }[] });
  // The pawn stood on b8 for a moment, then left: "+2" floated from b8 (column 1, row 0 with White at the bottom).
  expect(cash.pawnOnB8).toBe(true);
  expect(cash.floats).toContainEqual({ amount: "2", x: "1", y: "0" });
  await expect(page.locator(`${BOARD_SEL.piece}.white.pawn[data-square="b8"]`)).toHaveCount(0);
  expect(await soundCount(page, "acCash")).toBe(1);
  // The 2 gold waits for the next round, in its own part of the line.
  await expect(page.locator(".ac-card-gold")).toContainText("+ 2 from cash-ins");
  expect(stockfish).toEqual([]);
  expect(errors).toEqual([]);
});

test("a fight always ends even if the engine never answers (?stall=1): its looks time out to stand-in moves", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto("/autochess?quick=1&seed=3&adjust=0&stall=1&intro=0");
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  await buyAll(page, 4);
  await expect(root(page)).toHaveAttribute("data-phase", "fight", { timeout: 15_000 });
  await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 90_000 });
  await expect(page.locator(".ac-card-head")).toHaveText(/^(You win the round\.|You lose the round\.|The round is a draw\.)$/);
  expect(errors).toEqual([]);
});

test("the result says why, by the gains: a side that gained 3 pawns wins early, a stall goes to the side that gained (at 320 px, the box holds it and the page doesn't scroll)", async ({ page }) => {
  // (At 320 px whatever the project, with no tap: one project runs it, Nov 2.)
  test.skip(!phone(), "at 320 px, no input: the phone project runs it");
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  // (`?fightfen=`: fights from the sim's 80 (reports/autochess-gain.md), each played the same every time. You are White.)
  const cases = [
    // Black starts with the bigger army; White gains 3 pawns on its start and holds it for 6 of its moves: it wins at once (Eric, Oct 21).
    { fen: "8/p5k1/4pp1p/1rb1p3/4PP2/3B4/2PPN1KP/8 w - - 0 1", head: "You win the round.", why: "You gained 3+ pawns and held it for 6 moves. Your opponent loses " },
    // A stall Black wins by less than a pawn's gain (half a pawn is enough): "the edge", never "0 pawns".
    { fen: "6k1/5p2/2n2p1p/4p2r/P1P5/1P6/3P4/6K1 w - - 0 1", head: "You lose the round.", why: "Fight stalled (10 moves each, no capture): your opponent gained the edge. You lose " },
    // Even armies, a stall with nothing gained: a draw.
    { fen: "2k3r1/8/pp6/5p2/1P6/8/6PP/R1K5 w - - 0 1", head: "The round is a draw.", why: "Fight stalled (10 moves each, no capture): neither side gained the edge, a draw. Nobody loses HP." },
  ];
  for (const c of cases) {
    await page.goto(`/autochess?quick=1&seed=3&adjust=0&fightfen=${encodeURIComponent(c.fen)}&intro=0`);
    await expect(root(page)).toHaveAttribute("data-phase", "buy");
    await expect(root(page)).toHaveAttribute("data-phase", /^(result|over)$/, { timeout: 60_000 });
    await expect(page.locator(".ac-card-head")).toHaveText(c.head);
    const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
    expect(words.startsWith(c.why), words).toBe(true);
    const box = await page.locator(".ac-card").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, buttons: (el.querySelector(".ac-go") as HTMLElement).getBoundingClientRect().bottom - el.getBoundingClientRect().bottom }));
    expect(box.scroll, "the result's box holds its words").toBeLessThanOrEqual(box.client);
    expect(box.buttons, "the button is inside the box").toBeLessThanOrEqual(0);
    const page2 = await page.evaluate(() => ({ down: document.documentElement.scrollHeight - innerHeight, side: document.documentElement.scrollWidth - document.documentElement.clientWidth, goBox: (document.querySelector(".ac-go") as HTMLElement).getBoundingClientRect() }));
    expect(page2.down, "no scrolling down at 320 x 568").toBeLessThanOrEqual(0);
    expect(page2.side).toBe(0);
    expect(page2.goBox.height, "the button is a real target").toBeGreaterThanOrEqual(44);
    expect(page2.goBox.bottom).toBeLessThanOrEqual(568);
  }
  expect(errors).toEqual([]);
});

test("a side that starts the fight with only its king loses at once: the round is over with no move played", async ({ page }) => {
  // (At 320 px whatever the project, with no tap: one project runs it, Nov 2.)
  test.skip(!phone(), "at 320 px, no input: the phone project runs it");
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  // (At the narrowest screen: the result's box must hold its words and buttons.)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(NEVER);
  await expect(root(page)).toHaveAttribute("data-phase", "buy");
  // Buy nothing: your king stands alone against the bot's army.
  await expect(root(page)).toHaveAttribute("data-phase", "result", { timeout: 40_000 });
  await expect(page.locator(".ac-card-head")).toHaveText("You lose the round.");
  const words = (await page.locator(".ac-card .ac-card-text").innerText()).trim();
  expect(words).toMatch(/^A side left with only its king loses at once\. You lose (\d+) HP\.$/);
  const lost = Number(words.match(/You lose (\d+) HP/)![1]);
  // No move was played: the board is the position the fight started from (every piece of theirs still there).
  await expect(page.locator(`${BOARD_SEL.square}.last-move`)).toHaveCount(0);
  const theirs = await page.locator(`${BOARD_SEL.piece}.black:not(.king)`).count();
  expect(theirs, "they bought something").toBeGreaterThanOrEqual(1);
  // A lost round 1 (v7.1, Eric Oct 22): 1 (the round's number) plus 1 for every 3 of their pieces left (all of them: nothing was played), rounded down: 1 to 3 in all, of 24 HP.
  expect(lost).toBe(1 + Math.floor(theirs / 3));
  expect(lost).toBeGreaterThanOrEqual(1);
  expect(lost).toBeLessThanOrEqual(3);
  expect(await hp(page, "you")).toBe(24 - lost);
  expect(await hp(page, "bot")).toBe(24);
  await expect(root(page)).toHaveAttribute("data-round", "1");
  // Nothing spent, nothing lost: the gold is saved, with the interest and the income.
  await expect(page.locator(".ac-card-gold")).toHaveText("Next round: 10 saved + 12 income + 1 interest = 23 gold");
  const box = await page.locator(".ac-card").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, buttons: (el.querySelector(".ac-go") as HTMLElement).getBoundingClientRect().bottom - el.getBoundingClientRect().bottom }));
  expect(box.scroll, "the result's box holds its words").toBeLessThanOrEqual(box.client);
  expect(box.buttons, "the button is inside the box").toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
