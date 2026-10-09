import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { createLobbyFromHome, test, watchFor } from "./helpers.ts";

/**
 * Hollow, the Darkness boss, played alone on a phone and a computer with real taps: his first cover of the dark (the
 * square of the piece he moved), a dark square selected (the glow, no dots), a wrong move attempt into the dark (-5,
 * only for you), a legal move out of the dark, the 5-try cutoff (a missed move), and Lights out from the admins' test
 * trigger: the night over every square, a piece found, a wrong square, the misses costing 10 each, the lights back.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const powers = (p: Page) => p.evaluate(() => (window as any).match?.boss?.powers ?? null).catch(() => null);
const fenNow = (p: Page) => p.evaluate(() => (window as any).match.phase.board.fen as string);
const myPoints = (p: Page) => p.evaluate(() => (window as any).match.standings().find((s: { isYou: boolean }) => s.isYou).points as number);

/** A square's middle on screen. */
async function squareAt(page: Page, square: string) {
  const board = (await page.locator("cg-board").first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};

/** Your move's clock has started (the board takes taps). */
async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** Plays a move with two taps (again if the board wasn't taking moves yet). */
async function play(page: Page, move: string) {
  await yourMove(page);
  for (let i = 0; i < 5 && (await phase(page)) === "play"; i++) {
    await tap(page, move.slice(0, 2));
    await tap(page, move.slice(2, 4));
    await page.waitForTimeout(300);
  }
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
}

/** How opaque a canvas over the board is at a square's middle (255: it hides what's under it). */
const covered = (page: Page, square: string, canvas: string) =>
  squareAt(page, square).then((q) =>
    page
      .locator(canvas)
      .first()
      .evaluate((c: HTMLCanvasElement, [x, y]) => {
        const r = c.getBoundingClientRect();
        return c.getContext("2d")!.getImageData(Math.floor(((x! - r.left) / r.width) * c.width), Math.floor(((y! - r.top) / r.height) * c.height), 1, 1).data[3];
      }, [q.x, q.y]),
  );

const empties = (fen: string, squares: string[]) => squares.filter((s) => !new Chess(fen).get(s as never));

test("Hollow's dark: his first cover, a dark square selected, a wrong attempt (-5), a legal move out of the dark, the 5-try cutoff", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&boss=hollow&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect(page.locator(".boss-intro")).toBeVisible({ timeout: 30_000 });
  const boss = await page.evaluate(() => (window as any).match.boss);
  expect(boss.name).toBe("Hollow");
  // Always Black, from the starting position.
  expect(boss.crowdSide).toBe("w");
  expect(boss.board.history).toEqual([]);
  await expect(page.locator(".boss-intro")).toContainText("starting position");

  // Move 1; he replies and covers the square of the piece he moved (DARKNESS!), his bulbs relit.
  const seen = await watchFor(page, { banner: { selector: ".fight-banner.power-cut", text: /DARKNESS!/ } });
  await play(page, "e2e4");
  await expect.poll(async () => (await seen.seen()).banner, { timeout: 30_000 }).toBe(true);
  await yourMove(page);
  const p2 = await powers(page);
  expect(p2.dark).toHaveLength(1);
  const sq: string = p2.dark[0].square;
  expect(await page.evaluate(() => (window as any).match.boss.board.lastMove.slice(2, 4))).toBe(sq);
  expect(p2.bulbs).toBe(3);
  await expect(page.locator(`.power-board .pw-dark[data-square="${sq}"]`)).toHaveAttribute("data-state", "dark");
  // His piece there is hidden: the dark is opaque over the square's middle.
  await expect.poll(() => covered(page, sq, ".pw-dark-board"), { timeout: 5000 }).toBe(255);

  // Tapped, the dark square is selected: the green glow round it, no move dots, nothing picked up.
  await tap(page, sq);
  await expect(page.locator(".board-wrap").first()).toHaveAttribute("data-dark-sel", sq);
  await expect(page.locator("cg-board square.selected")).toHaveCount(1);
  await expect(page.locator("cg-board square.move-dest")).toHaveCount(0);
  // A move from it that isn't legal (it's his piece): -5, and you pick again.
  const before = await myPoints(page);
  await tap(page, empties(await fenNow(page), ["a3", "h3", "a4", "h4"])[0]!);
  await expect(page.locator(".pw-cost")).toHaveText("−5");
  await expect(page.locator(".dark-note")).toContainText("4 tries left");
  expect(await phase(page)).toBe("play");
  // A legal move out of the dark. (For the test, the dark falls on your knight: covers land on his pieces or yours at
  // random.) Tap it: no dots; then f3.
  await page.evaluate(() => {
    const m = (window as any).match;
    const p = m.runner.state.boss.powers;
    m.runner.state = { ...m.runner.state, boss: { ...m.runner.state.boss, powers: { ...p, dark: [...p.dark, { square: "g1", at: p.turn, until: p.turn + 9 }] } } };
  });
  await expect(page.locator('.power-board .pw-dark[data-square="g1"]')).toHaveCount(1);
  await tap(page, "g1");
  await expect(page.locator(".board-wrap").first()).toHaveAttribute("data-dark-sel", "g1");
  await expect(page.locator("cg-board square.move-dest")).toHaveCount(0);
  await tap(page, "f3");
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  await expect.poll(() => page.evaluate(() => (window as any).match.moves.at(-1)?.move), { timeout: 30_000 }).toBe("g1f3");
  // The turn cost you 5 (alone, a move's own score is 0).
  expect(await page.evaluate(() => (window as any).match.moves.at(-1).roundScore)).toBe(-5);
  expect(await myPoints(page)).toBe(before - 5);

  // Next turn: five wrong attempts into the dark end it as a missed move (never more than a miss costs).
  await yourMove(page);
  const fen = await fenNow(page);
  // (From a dark square that isn't yours, nothing is legal: his piece's, or an empty one.)
  const his = ((await powers(page)).dark as { square: string }[]).map((d) => d.square).find((s) => new Chess(fen).get(s as never)?.color !== "w")!;
  const empty = empties(fen, ["a3", "a4", "a5", "a6", "h3", "h4", "h5", "h6"]);
  const p0 = await myPoints(page);
  for (let i = 0; i < 5; i++) {
    await tap(page, his);
    await tap(page, empty[i]!);
    await expect.poll(() => page.evaluate(() => (window as any).match.darkNote?.tries ?? 0), { timeout: 5000 }).toBe(i + 1);
  }
  await expect.poll(() => page.evaluate(() => (window as any).match.moves.length), { timeout: 30_000 }).toBe(3);
  const miss = await page.evaluate(() => (window as any).match.moves.at(-1));
  expect(miss.move).toBeNull();
  expect(miss.roundScore).toBe(-25);
  expect(await myPoints(page)).toBe(p0 - 25);
  expect(errors).toEqual([]);
});

/** Your profile says you're an admin (as /api/me does for an email in ADMIN_EMAILS). */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    await route.fulfill({ response: res, json: body ? { ...body, admin: true } : body });
  });
}

test("Hollow's Lights out (the admins' trigger): the night over every square, a piece found, a wrong square, 10 a miss, the lights back", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await asAdmin(page);
  await page.goto("/?debug&clock=60&boss=hollow&laststand=0");
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await yourMove(page);
  // Pressed during your turn: it comes at the start of his turn, after your move.
  const btn = page.locator(".ult-test");
  await expect(btn).toHaveText("Trigger ultimate (testing)");
  await btn.click();
  await expect(btn).toHaveText("Ultimate next turn (testing)");
  const banner = await watchFor(page, { lights: { selector: ".fight-banner.power-cut", text: /LIGHTS OUT!/ } });
  await play(page, "e2e4");
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.lights), { timeout: 20_000 }).toBe(true);
  const lights = await page.evaluate(() => (window as any).match.phase.lights);
  expect(lights.rounds.map((r: { pieces: string[] }) => r.pieces.length)).toEqual([1, 2, 3]);
  // The clocks stopped: he hasn't moved yet.
  expect(await page.evaluate(() => (window as any).match.boss.board.history.length)).toBe(1);
  const before = await myPoints(page);
  const c = new Chess(await page.evaluate(() => (window as any).match.boss.board.fen as string));
  // The squares answering a target: his pieces of its type (a pawn: on its file).
  const his = (t: { type: string; file?: string }) => "abcdefgh".split("").flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).filter((s) => c.get(s as never)?.color === "b" && c.get(s as never)?.type === t.type && (!t.file || s[0] === t.file));
  // Round 1 opens: night over every square (opaque at each middle), his prompt; every square takes a tap.
  await expect(page.locator('.lo-marks[data-round="0"][data-open="1"]')).toHaveCount(1, { timeout: 15_000 });
  expect((await banner.seen()).lights).toBe(true);
  for (const s of ["a1", "h8", "e4", "d5"]) expect(await covered(page, s, ".lo-board canvas"), s).toBe(255);
  await expect(page.locator(".boss-dock")).toContainText(/Find (my|one of my|:)/);
  const target = his(lights.rounds[0].targets[0])[0]!;
  await tap(page, target);
  await expect(page.locator(`.lo-found[data-square="${target}"][data-round="0"]`)).toHaveCount(1);
  // One piece, one try: the round is over at once, its answers show.
  await expect.poll(() => page.evaluate(() => (window as any).match.phase.lights?.rounds[0].answers?.length ?? 0), { timeout: 5000 }).toBeGreaterThan(0);
  // Round 2: a wrong square (an empty one), then nothing more. The tap gives a second more: the bar bumps, "+1s".
  await expect(page.locator('.lo-marks[data-round="1"][data-open="1"]')).toHaveCount(1, { timeout: 15_000 });
  const bump = await watchFor(page, { plus: { selector: ".lo-plus", text: /\+1s/ } });
  const empty = empties(await page.evaluate(() => (window as any).match.boss.board.fen as string), ["e5", "e4", "a5", "h5"])[0]!;
  await tap(page, empty);
  await expect.poll(() => page.evaluate(() => (window as any).match.phase.lights?.mine[1].wrong), { timeout: 5000 }).toEqual([empty]);
  expect((await bump.seen()).plus).toBe(true);
  // Its answers show as it ends; the lights come back, his move follows, and the misses cost 10 each.
  await expect.poll(() => page.evaluate(() => (window as any).match.phase.lights?.rounds[1].answers?.length ?? 0), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => phase(page), { timeout: 40_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.board.history.length)).toBe(2);
  // 1 found of 6: 5 missed.
  expect(await myPoints(page)).toBe(before - 50);
  const p = await powers(page);
  expect(p.lightsAt).toBe(1);
  expect(p.rage).toBeNull();
  await expect(btn).toHaveText("Ultimate used (testing)");
  expect(errors).toEqual([]);
});

test("Hollow online: the server judges an attempt into the dark (-5, only for you) and runs Lights out", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  test.skip(test.info().project.name !== "desktop", "one run is enough");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&mode=raid&boss=hollow&power=lightsout&bossMoves=6&clock=40");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  await yourMove(page);
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Hollow");
  await play(page, "e2e4");
  // His first cover, sent to everyone with the battle.
  await yourMove(page);
  const sq: string = (await powers(page)).dark[0].square;
  await tap(page, sq);
  await expect(page.locator(".board-wrap").first()).toHaveAttribute("data-dark-sel", sq);
  await tap(page, empties(await fenNow(page), ["a3", "h3", "a4", "h4"])[0]!);
  // The server's answer: wrong, -5, pick again.
  await expect(page.locator(".pw-cost")).toHaveText("−5");
  await expect(page.locator(".dark-note")).toContainText("4 tries left");
  expect(await phase(page)).toBe("play");
  await play(page, "d2d4");
  // Lights out at the start of his turn (the meter full as this turn began): the server's rounds.
  await expect.poll(() => page.evaluate(() => !!(window as any).match.phase.lights), { timeout: 60_000 }).toBe(true);
  const lights = await page.evaluate(() => (window as any).match.phase.lights);
  const c = new Chess(await page.evaluate(() => (window as any).match.boss.board.fen as string));
  const t0 = lights.rounds[0].targets[0];
  const target = "abcdefgh".split("").flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`)).find((s) => c.get(s as never)?.color === "b" && c.get(s as never)?.type === t0.type && (!t0.file || s[0] === t0.file))!;
  await expect(page.locator('.lo-marks[data-round="0"][data-open="1"]')).toHaveCount(1, { timeout: 15_000 });
  await tap(page, target);
  await expect(page.locator(`.lo-found[data-square="${target}"][data-round="0"]`)).toHaveCount(1);
  // The round's answers come from the server as it ends; then the lights, his move, your turn.
  await expect.poll(() => page.evaluate(() => (window as any).match.phase.lights?.rounds[0].answers?.length ?? 0), { timeout: 15_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).match.phase.lights.mine[0].found)).toEqual([target]);
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  // -5 for the wrong attempt, -50 for the five pieces not found.
  expect(await myPoints(page)).toBe(-55);
  expect((await powers(page)).lightsAt).toBe(2);
  expect(errors).toEqual([]);
});
