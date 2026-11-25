import { expect, type Browser, type Page } from "@playwright/test";
import { RANKED_1V1, rankView, type RankView } from "@chessroyale/core";
import { named, switchesOff, test } from "./helpers.ts";

/**
 * Ranked 1 v 1's tiers and emblems (Eric, Oct 28; docs/decisions/2026-10-28-ranked-tiers.md): Wood 5 … Radiant 1, then
 * Pearlescent and Transcendent, each rank with its emblem on the versus screen, the result (a division up shows the new
 * one), home's ranked row and the profile; an admin's `?rank=` shows any rank on their own screens, a player's does
 * nothing; the top tiers' loops hold still under reduced motion. Ranks are put in the server's answers (reaching them
 * for real takes hundreds of games; the server's side is in packages/server/test/ranked-store.test.ts).
 */

const isComputer = () => test.info().project.name === "desktop";
const R = RANKED_1V1;
/** A rank at a tier's division and RP (tier 0 is Wood). */
const at = (tier: number, division: number, rp: number): RankView => rankView({ games: 40, ladder: (tier * R.divisions + (R.divisions - division)) * R.pointsPerDivision + rp });
const TRANS = rankView({ games: 40, ladder: R.topFloor + 214, place: 3 });
const GOLD3 = at(2, 3, 70);
const GOLD2 = at(2, 2, 10);

/**
 * A player whose server answers carry `rank` (with a record) and, when `admin()`, an admin's flag. `asPlayer`: the test
 * switches as a player's app is told (this server has TEST_SWITCHES on, which lets everyone use them; a game's `pool=`,
 * which keeps tests apart, needs them).
 */
async function player(browser: Browser, name: string, rank: RankView | null, { admin = (): boolean => false, path = "/?nolanding", asPlayer = false } = {}): Promise<Page> {
  const page = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await named(page, name);
  if (asPlayer) await switchesOff(page);
  await page.route(/\/api\/(me|profile\/[\w-]+)(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, ...(rank ? { ranked1v1: { rank, games: 46, wins: 25, losses: 19, draws: 2 } } : {}), ...(admin() ? { admin: true } : {}) } });
    } catch {
      // The page is gone.
    }
  });
  await page.goto(path);
  await expect(page.getByRole("button", { name: "PLAY", exact: true })).toBeVisible();
  return page;
}

const emblemOf = (page: Page, scope: string) => page.locator(`${scope} .re-box`).first();
/** An emblem's box (its size whole steps of 48) and which emblem it shows. */
async function expectEmblem(page: Page, scope: string, id: string | null, size: number) {
  const box = emblemOf(page, scope);
  if (id) await expect(box).toHaveAttribute("data-emblem", id);
  else await expect(box).not.toHaveAttribute("data-emblem", /./);
  // (On the stage it lands with its pawn: measured once the drop is over.)
  await box.evaluate((e) => Promise.all((e.closest(".dv-st-pawn")?.getAnimations() ?? []).filter((x) => x.effect?.getTiming().iterations !== Infinity).map((x) => x.finished)));
  const b = (await box.boundingBox())!;
  expect([Math.round(b.width), Math.round(b.height)], `${scope}'s emblem box`).toEqual([size, size]);
  // Smoothing off (pixel art), the picture the baked sheet.
  if (id) {
    const art = await box.locator(".re-art").evaluate((e) => ({ r: getComputedStyle(e).imageRendering, bg: getComputedStyle(e).backgroundImage }));
    expect(art.r).toBe("pixelated");
    expect(art.bg).toMatch(/rank-emblems.*\.png/);
  }
}

const overlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("the versus screen shows both ranks' emblems; the result of a division up shows the new one, with the RP change", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const pool = `rt${test.info().project.name.slice(0, 1)}${Math.random().toString(36).slice(2, 9)}`;
  const a = await player(browser, "Ann Tier", GOLD3);
  const b = await player(browser, "Bo Tier", TRANS);
  // The game's answers to Ann, as two ranked players': Ann Gold III – 70, Bo Transcendent; her game's outcome a win
  // that takes her to Gold II – 10 (+20).
  const ranks: Record<string, RankView> = { "Ann Tier": GOLD3, "Bo Tier": TRANS };
  await a.routeWebSocket(/\/api\/1v1\/game\/[A-Z2-9]{5}\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      const msg = JSON.parse(String(m));
      const g = msg.game;
      if (g?.players) for (const c of ["w", "b"]) g.players[c] = { ...g.players[c], rank: ranks[g.players[c].name] ?? g.players[c].rank };
      if (msg.t === "outcome" && msg.outcome?.change) msg.outcome.change = { before: GOLD3, after: GOLD2, points: 20, placed: false };
      ws.send(JSON.stringify(msg));
    });
  });
  const size = isComputer() ? 96 : 48;
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  // Searching: your emblem by your pawn (from your profile), none on the empty platform.
  await expectEmblem(a, ".dv-st-you", "gold-d3", size);
  await expect(a.locator(".dv-st-them .re-box")).toHaveCount(0);
  const yours = (await emblemOf(a, ".dv-st-you").boundingBox())!;
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-versus .dv-st-them .dv-st-pawn")).toBeVisible({ timeout: 20_000 });
  await expect(a.locator(".dv-st-them .dv-st-rank")).toHaveText(TRANS.label);
  await expectEmblem(a, ".dv-st-you", "gold-d3", size);
  await expectEmblem(a, ".dv-st-them", "transcendent", size);
  // Your emblem where it was; neither under "VS", a name or a rank, nor off the screen.
  await a.waitForTimeout(500);
  expect((await emblemOf(a, ".dv-st-you").boundingBox())!).toEqual(yours);
  const vw = await a.evaluate(() => document.documentElement.clientWidth);
  for (const side of [".dv-st-you", ".dv-st-them"]) {
    const e = (await emblemOf(a, side).boundingBox())!;
    expect(e.x).toBeGreaterThanOrEqual(0);
    expect(e.x + e.width).toBeLessThanOrEqual(vw);
    for (const sel of [".dv-st-vs", ".dv-st-name", ".dv-st-rank"]) for (const o of await a.locator(sel).all()) expect(overlap(e, (await o.boundingBox())!), `${side}'s emblem over ${sel}`).toBe(false);
  }
  // Transcendent's 2 s loop runs (a transform, eight steps).
  expect(await a.locator(".dv-st-them .re-art").evaluate((e) => getComputedStyle(e).animationName)).toBe("re-loop");

  // The game: two first moves, then Bo resigns.
  for (const p of [a, b]) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 20_000 });
  const sideOf = async (p: Page) => (await p.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";
  const tap = async (p: Page, uci: string) => {
    const box = (await p.locator(".board-area .board-wrap").first().boundingBox())!;
    const w = (await sideOf(p)) === "w";
    for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const f = sq.charCodeAt(0) - 97;
      const r = Number(sq[1]) - 1;
      await p.mouse.click(box.x + (((w ? f : 7 - f) + 0.5) * box.width) / 8, box.y + (((w ? 7 - r : r) + 0.5) * box.height) / 8);
    }
  };
  const [white, black] = (await sideOf(a)) === "w" ? [a, b] : [b, a];
  await tap(white, "e2e4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tap(black, "e7e5");
  await expect(white.locator(".dv-status")).toContainText("Your move", { timeout: 10_000 });
  await b.getByRole("button", { name: "Match options" }).click();
  await b.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Resign/ }).click();
  await b.getByRole("button", { name: /^Resign/ }).last().click();
  // The result (the end page, Nov 20): RP EARNED counts to +20 and lobs into the division's bar, which fills from 70 of 80 to the end,
  // "Gold 2!", the new division's emblem, and on to 10.
  await expectRp(a, { label: "RP EARNED", num: "+20", gain: "+20 RP", who: "Gold II", now: "10 RP", emblem: "gold-d2", from: 70 / 80, to: 10 / 80, wraps: 1 });
  // Bo's own page keeps the emblem's room too (his outcome as the server has it: a placement game here).
  await expect(b.locator(".es-track-rp .re-box")).toHaveCount(1);
});

/**
 * Every frame of the RP bar from the result on (its fill's scaleX, its division), then its end: the label, the number, the landed gain,
 * the division and where in it, the emblem; the fill never jumps (only a division's wrap: full to empty going up, empty to full down).
 */
async function expectRp(page: Page, want: { label: string; num: string; gain: string; who: string; now: string; emblem: string; from: number; to: number; wraps: number }) {
  await page.evaluate(() => {
    const w = window as unknown as { __rp: { share: number; who: string }[] };
    w.__rp = [];
    const frame = () => {
      const fill = document.querySelector(".es-track-rp .es-fill") as HTMLElement | null;
      if (fill && document.querySelector("[data-es]")?.getAttribute("data-es") !== "wait") {
        const t = getComputedStyle(fill).transform;
        w.__rp.push({ share: new DOMMatrixReadOnly(t === "none" ? undefined : t).a, who: document.querySelector(".es-track-rp [data-testid=es-who-rp]")?.textContent ?? "" });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await expect(page.getByTestId("es-rewards")).toHaveAttribute("data-es", "done", { timeout: 30_000 });
  await expect(page.locator(".es-earned-rp .es-earned-label")).toHaveText(want.label);
  await expect(page.locator(".es-earned-rp .es-earned-num")).toHaveText(want.num);
  const track = page.getByTestId("es-track-rp");
  await expect(track.locator(".es-gain")).toHaveText(want.gain);
  await expect(track.getByTestId("es-who-rp")).toHaveText(want.who);
  await expect(track.getByTestId("es-now-rp")).toHaveText(want.now);
  await expect(track.locator(".re-box")).toHaveAttribute("data-emblem", want.emblem);
  const s = await page.evaluate(() => (window as unknown as { __rp: { share: number; who: string }[] }).__rp);
  expect(s[0]!.share, "from where you were").toBeCloseTo(want.from, 2);
  expect(s.at(-1)!.share, "to where you are").toBeCloseTo(want.to, 2);
  let wraps = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i]!.share - s[i - 1]!.share;
    if (Math.abs(d) > 0.5) wraps++;
    else expect(Math.abs(d), "no jump between frames").toBeLessThan(0.08);
  }
  expect(wraps, "a division crossed").toBe(want.wraps);
}

test("a ranked game lost (Eric, Nov 20): \"RP LOST 14\" counting in red, the bar draining through the division, Gold 3 to Gold 4", { tag: "@phone-only" }, async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const pool = `rd${Math.random().toString(36).slice(2, 9)}`;
  const GOLD3_9 = at(2, 3, 9);
  const GOLD4_75 = at(2, 4, 75);
  const a = await player(browser, "Ann Down", GOLD3_9);
  const b = await player(browser, "Bo Down", GOLD3_9);
  // Ann's game's outcome: a loss from Gold III – 9 to Gold IV – 75 (−14).
  await a.routeWebSocket(/\/api\/1v1\/game\/[A-Z2-9]{5}\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      const msg = JSON.parse(String(m));
      if (msg.t === "outcome" && msg.outcome) msg.outcome.change = { before: GOLD3_9, after: GOLD4_75, points: -14, placed: false };
      ws.send(JSON.stringify(msg));
    });
  });
  await a.goto(`/1v1?nolanding&pool=${pool}`);
  await expect(a.locator(".dv-search")).toContainText("Finding opponent…");
  await b.goto(`/1v1?nolanding&pool=${pool}`);
  for (const p of [a, b]) await expect(p.locator(".dv-status")).toContainText(/first move/, { timeout: 30_000 });
  const sideOf = async (p: Page) => (await p.locator(".dv-strip.dv-you").getAttribute("data-side")) as "w" | "b";
  const tap = async (p: Page, uci: string) => {
    const box = (await p.locator(".board-area .board-wrap").first().boundingBox())!;
    const w = (await sideOf(p)) === "w";
    for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const f = sq.charCodeAt(0) - 97;
      const r = Number(sq[1]) - 1;
      await p.mouse.click(box.x + (((w ? f : 7 - f) + 0.5) * box.width) / 8, box.y + (((w ? 7 - r : r) + 0.5) * box.height) / 8);
    }
  };
  const [white, black] = (await sideOf(a)) === "w" ? [a, b] : [b, a];
  await tap(white, "e2e4");
  await expect(black.locator(".dv-status")).toContainText("Your first move", { timeout: 10_000 });
  await tap(black, "e7e5");
  await expect(white.locator(".dv-status")).toContainText("Your move", { timeout: 10_000 });
  // Ann resigns: her own page, "Defeat", and its move-by-move under it (the two moves, from the last).
  await a.getByRole("button", { name: "Match options" }).click();
  await a.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Resign/ }).click();
  await a.getByRole("button", { name: /^Resign/ }).last().click();
  await expect(a.getByTestId("es-title")).toHaveText("Defeat", { timeout: 20_000 });
  await expect(a.getByTestId("es-line")).toHaveText("You resigned.");
  await expect(a.getByTestId("game-steps").locator(".bm-step-text")).toHaveText("Move 2 of 2 · 1… e5");
  await expectRp(a, { label: "RP LOST", num: "14", gain: "−14 RP", who: "Gold IV", now: "75 RP", emblem: "gold-d4", from: 9 / 80, to: 75 / 80, wraps: 1 });
  // (Red: the count and the gain.)
  const red = await a.locator(".es-earned-rp .es-earned-num").evaluate((e) => getComputedStyle(e).color);
  expect(red).toBe(await a.locator(".es-track-rp .es-gain").evaluate((e) => getComputedStyle(e).color));
  await expect(a.locator(".es-earned-rp")).toHaveClass(/es-down/);
});

test("home's ranked row and the profile show your rank's emblem; the row's panel keeps its size, its words one line each at 320 px", async ({ browser }) => {
  const rad = rankView({ games: 40, ladder: 2815, place: 900 });
  expect(rad.label).toBe("Radiant I – 95");
  const page = await player(browser, "Ann Row", rad, { asPlayer: true });
  await page.getByRole("radio", { name: /1 v 1/ }).click();
  await expect(page.locator(".fd-rank1v1")).toHaveText("Your rank: Radiant I – 95");
  await expectEmblem(page, ".fd-rank-words", "radiant-d1", 48);
  const sizes = isComputer() ? [{ width: 1280, height: 800 }] : [{ width: 320, height: 568 }, { width: 390, height: 844 }];
  for (const s of sizes) {
    await page.setViewportSize(s);
    const panel = (await page.locator(".fd-mode-panel").boundingBox())!;
    expect(Math.round(panel.height), "the panel's one height").toBe(54);
    const e = (await emblemOf(page, ".fd-rank-words").boundingBox())!;
    expect(e.y).toBeGreaterThanOrEqual(panel.y - 0.5);
    expect(e.y + e.height).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
    // Each line whole and on one line (its text no taller than one line, nothing cut).
    for (const line of await page.locator(".fd-rank-lines > *").all()) {
      const m = await line.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        return { rects: new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size, cut: el.scrollWidth > el.clientWidth + 1 };
      });
      expect(m, `at ${s.width} px: ${await line.textContent()}`).toEqual({ rects: 1, cut: false });
    }
  }
  // The profile's 1 V 1 section: the emblem at 2× beside the pill and the record.
  // (Your profile: "View profile" on your card on a phone, the side menu's Profile on a computer.)
  await page.getByRole("button", { name: "View profile", exact: true }).or(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first().click();
  await expect(page.locator(".dv-profile .dv-rank")).toHaveText("Radiant I – 95");
  await expectEmblem(page, ".dv-profile", "radiant-d1", 96);
});

test("?rank= shows that rank on an admin's own screens, and does nothing for a player; the top tiers' loops hold still under reduced motion", { tag: "@phone-only" }, async ({ browser }) => {
  // A player: the address's ?rank= is ignored (their own placements show, no emblem).
  const p = await player(browser, "Pat Player", null, { asPlayer: true, path: "/?nolanding&rank=gold-3" });
  await p.getByRole("radio", { name: /1 v 1/ }).click();
  await expect(p.locator(".fd-rank1v1")).toHaveText("Your rank: Placement 0/5");
  await expectEmblem(p, ".fd-rank-words", null, 48);
  await p.getByRole("button", { name: "View profile", exact: true }).or(p.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first().click();
  await expect(p.locator(".dv-profile")).toHaveCount(0);

  // An admin: Gold 3 on home, on the stage and on their profile; then Transcendent, the loop.
  const a = await player(browser, "Ada Admin", null, { asPlayer: true, admin: () => true, path: "/?nolanding&rank=gold-3" });
  await a.getByRole("radio", { name: /1 v 1/ }).click();
  await expect(a.locator(".fd-rank1v1")).toHaveText("Your rank: Gold III – 45");
  await expectEmblem(a, ".fd-rank-words", "gold-d3", 48);
  await a.getByRole("button", { name: "View profile", exact: true }).or(a.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first().click();
  await expect(a.locator(".dv-profile .dv-rank")).toHaveText("Gold III – 45");
  await expectEmblem(a, ".dv-profile", "gold-d3", 96);
  await a.goto("/1v1?nolanding&rank=transcendent&pool=rtadmin");
  await expect(a.locator(".dv-st-you .dv-st-rank")).toHaveText("Transcendent – 120");
  await expectEmblem(a, ".dv-st-you", "transcendent", isComputer() ? 96 : 48);
  const loop = a.locator(".dv-st-you .re-art");
  expect(await loop.evaluate((e) => getComputedStyle(e).animationName)).toBe("re-loop");
  // Reduced motion: the still first frame.
  await a.emulateMedia({ reducedMotion: "reduce" });
  expect(await loop.evaluate((e) => [getComputedStyle(e).animationName, getComputedStyle(e).transform])).toEqual(["none", "none"]);
});
