import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { KING_ATTACK, LAST_STAND } from "@chessroyale/chess";
import { BOARD_SEL, test, bossAloneFromHome } from "./helpers.ts";

/**
 * A boss's attack on a king (Hollow's; Eric, Oct 10), played alone on a phone and a computer with real taps, watched
 * every frame from before it can start:
 * - at his mate (?mate=1: 1.f3 e5 2.g4, he mates at once): he drops in beside your king and lashes it, a "−N" off it each
 *   lash, the real king hidden while his copy flickers, topples and fades; his figure in the corner hidden meanwhile, his
 *   line said; the result only after the whole attack;
 * - in the God King's Last Stand (?laststand=1): the blow meant for the piece is Hollow's attack on the God King (his
 *   gold hits, none of the red slashes), and the Last Stand carries on as before (he falls; you pick again).
 * - in the Last Stand against Sawyer, Wrangler, Boingo, Big Boy, Ginger and Jefferson (Oct 18): each one's assault, a
 *   hit on every beat.
 * The beats are KING_ATTACK's and LAST_STAND's (packages/chess/src/boss-timing.ts).
 */
const ATTACK_MS = KING_ATTACK.ms;
const LASHES = KING_ATTACK.lashes;
// (6.55 s into the Last Stand: 5.55 s before its cut-in got a second longer, Oct 15.)
const ATTACK_AT = LAST_STAND.attackAt;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Samples the page every animation frame from now on: what the attack shows, against its own start. */
async function sample(page: Page) {
  await page.evaluate((pieces) => {
    const w = window as any;
    w.__ka = [];
    const tick = () => {
      const a = document.querySelector(".king-attack");
      const real = [...document.querySelectorAll(`${pieces}.king`)].map((k) => ({ white: k.classList.contains("white"), opacity: getComputedStyle(k).opacity }));
      const corner = document.querySelector(".boss-char-sprite");
      const copy = document.querySelector(".ka-king");
      w.__ka.push({
        now: Date.now(),
        phase: w.match?.phase.kind,
        start: a ? Number(a.getAttribute("data-start")) : null,
        on: !!a?.classList.contains("on"),
        hit: a ? Number(a.getAttribute("data-hit")) : null,
        boss: !!document.querySelector(".ka-boss canvas"),
        flip: !!document.querySelector(".ka-boss.flip"),
        hp: [...document.querySelectorAll(".ka-hp")].map((e) => e.textContent),
        lashes: [...document.querySelectorAll(".ka-hp")].map((e) => Number(e.getAttribute("data-lash"))),
        red: document.querySelectorAll(".ls-dmg").length,
        real,
        copy: copy ? getComputedStyle(copy).opacity : null,
        corner: corner ? getComputedStyle(corner).visibility : null,
        god: document.querySelector(".ls-god .god-king")?.getAttribute("data-anim") ?? null,
        said: document.querySelector(".bc-bubble")?.textContent ?? "",
        box: (() => {
          const b = document.querySelector(".ka-boss")?.getBoundingClientRect();
          return b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom } : null;
        })(),
        vw: document.documentElement.clientWidth,
      });
      if (w.__ka.length < 20000) requestAnimationFrame(tick);
    };
    tick();
  }, BOARD_SEL.piece);
  return () => page.evaluate(() => (window as any).__ka as any[]);
}

/**
 * Every lash lands (0 to 9), each with its "−N" off the king, and the attack's beat goes forward a lash at a time, to the
 * last. Each "−N" is on screen for a second and says which lash it is (`data-lash`), so every one shows in some frame
 * however busy the machine. The beat's own marker (`data-hit`) holds each lash for only 170 ms: one frame that long on
 * a busy runner skipped a lash (docs/decisions/2026-10-16-flaky-e2e-batch-2.md).
 */
function expectEveryLash(during: { hit: number; lashes: number[] }[]) {
  expect(new Set(during.flatMap((x) => x.lashes))).toEqual(new Set(Array.from({ length: LASHES }, (_, i) => i)));
  const hits = during.map((x) => x.hit);
  expect(hits.every((h, i) => h >= -1 && h < LASHES && (i === 0 || h >= hits[i - 1]!))).toBe(true);
  expect(hits.at(-1)).toBe(LASHES - 1);
}

test("Hollow's mate: he lashes your king, it topples into the dark, then the result", async ({ page }) => {
  await page.goto("/?debug&clock=60&boss=hollow&mate=1");
  await page.evaluate(() => ((window as any).__soundLog = []));
  await bossAloneFromHome(page);
  const samples = await sample(page);
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("results");
  const s = await samples();
  const during = s.filter((x) => x.start && x.now >= x.start && x.now < x.start + ATTACK_MS && x.phase === "boss");
  expect(during.length).toBeGreaterThan(20);
  const start = during[0].start;
  // The whole attack plays before the result: the result comes after it, and after the king has gone.
  const result = s.find((x) => x.phase === "results")!;
  expect(result.now).toBeGreaterThanOrEqual(start + ATTACK_MS);
  // Every lash lands (0 to 9), each with its "−N" off the king.
  expectEveryLash(during);
  expect(Math.max(...during.map((x) => x.hp.length))).toBeGreaterThanOrEqual(3);
  for (const x of during) for (const t of x.hp) expect(t).toMatch(/^−\d+$/);
  // Your (white) king: hidden on the board the whole time, its copy there instead, gone by the end.
  for (const x of during) {
    expect(x.real.find((k: { white: boolean }) => k.white)?.opacity).toBe("0");
    expect(x.copy).not.toBeNull();
  }
  expect(Number(s.filter((x) => x.start && x.now >= x.start + ATTACK_MS && x.phase === "boss").at(-1)?.copy ?? "0")).toBeLessThan(0.05);
  // Hollow on the board (to the left of the king on e1: not mirrored), and not in his corner meanwhile.
  expect(during.every((x) => x.boss && !x.flip)).toBe(true);
  expect(during.filter((x) => x.on).every((x) => x.corner === "hidden")).toBe(true);
  // His line, in his text box (the speech rule), and his lash sounds.
  expect(s.some((x) => /little king|Into the dark|Sleep now/.test(x.said))).toBe(true);
  const heard = await page.evaluate(() => ((window as any).__soundLog as string[]).map((n) => n.split(":")[0]));
  expect(heard.filter((n) => n === "hollowLash").length).toBeGreaterThanOrEqual(LASHES - 1);
  // The result: Hollow won.
  await expect(page.getByText(/Hollow won/)).toBeVisible();
});

test("the God King's Last Stand against Hollow: Hollow lashes him, then he falls and you pick again", async ({ page }) => {
  await page.goto("/?debug&clock=60&boss=hollow&laststand=1");
  await bossAloneFromHome(page);
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
  const samples = await sample(page);
  // A knight out: the Last Stand (the test switch) on whatever you play.
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "n")!;
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const at = (sq: string) => ({ x: board.x + (sq.charCodeAt(0) - 97 + 0.5) * (board.width / 8), y: board.y + (8 - Number(sq[1]) + 0.5) * (board.height / 8) });
  await page.mouse.click(at(mv.from).x, at(mv.from).y);
  await page.mouse.click(at(mv.to).x, at(mv.to).y);
  await expect(page.locator(".last-stand")).toBeVisible({ timeout: 30_000 });
  const standAt = Number(await page.locator(".last-stand").getAttribute("data-start"));
  // The Last Stand carries on to its end as before: you pick again (the same move barred), the God King fallen.
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  const s = await samples();
  const during = s.filter((x) => x.start && x.now >= x.start && x.now < x.start + ATTACK_MS);
  expect(during.length).toBeGreaterThan(20);
  // It starts at its beat in the Last Stand (as the piece slides back).
  expect(Math.abs(during[0].start - (standAt + ATTACK_AT))).toBeLessThanOrEqual(1);
  expectEveryLash(during);
  // Gold "−N" hits off him, never the anonymous red slashes' numbers; his blows are its lashes.
  expect(Math.max(...during.map((x) => x.hp.length))).toBeGreaterThanOrEqual(3);
  expect(s.every((x) => x.red === 0)).toBe(true);
  expect(during.filter((x) => x.god).every((x) => x.god === "lastStandAttacked")).toBe(true);
  // Hollow beside him on the board (the God King stands where your knight went: a3, c3, f3 or h3), his corner empty.
  const kingCol = mv.to.charCodeAt(0) - 97;
  expect(during.every((x) => x.boss && x.flip === kingCol < 4)).toBe(true);
  expect(during.filter((x) => x.on).every((x) => x.corner === "hidden")).toBe(true);
  // Gone before the God King collapses; the Last Stand then ends as it always has.
  expect(s.filter((x) => x.now > standAt + ATTACK_AT + ATTACK_MS + 100).every((x) => !x.on)).toBe(true);
  await expect(page.getByRole("img", { name: "The God King has fallen" })).toBeVisible();
});

/**
 * Sawyer's saw, Wrangler's lasso, Boingo's pies, Big Boy's lollipop, Ginger's cane and Jefferson's Roman candle on the
 * God King in his Last Stand (Eric, Oct 18: "a relentless assault"), with real taps on a phone and a computer, watched every frame: the boss drops in beside him as the piece
 * slides back, on the side toward the board's middle (his drawing mirrored to face him), a hit on every beat with its
 * gold "−N", his own sounds, his figure wholly on screen; then the Last Stand ends as always. No page errors.
 */
for (const b of [
  { id: "sawyer", name: "Sawyer", facesLeft: true, sounds: ["sawyerCut", "sawyerSwing"] },
  { id: "pig", name: "Wrangler", facesLeft: true, sounds: ["pigYank", "pigCatch"] },
  { id: "clown", name: "Boingo", facesLeft: false, sounds: ["clownSplat", "clownSqueak"] },
  { id: "bigboy", name: "Big Boy", facesLeft: true, sounds: ["bigboyBonk", "bigboySwish"] },
  { id: "gingerbread", name: "Ginger", facesLeft: false, sounds: ["gingerCrackle", "gingerCrunch"] },
  { id: "grex", name: "Jefferson", facesLeft: false, sounds: ["grexPop", "grexSparkle"] },
])
  test(`the God King's Last Stand against ${b.name}: ${b.name} assaults him, then he falls and you pick again`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/?debug&clock=60&boss=${b.id}&laststand=1`);
    await page.evaluate(() => ((window as any).__soundLog = []));
    await bossAloneFromHome(page);
    await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
    await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
    const samples = await sample(page);
    // Your move, whatever it is, calls the Last Stand. (These bosses' battles start on a named opening: you may be
    // Black, the board turned your way; and in 7 of the library's 970 openings the side to move has no knight move,
    // mostly in check after a knight's check: then any move.)
    const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
    const moves = new Chess(fen).moves({ verbose: true });
    const mv = moves.find((m) => m.piece === "n") ?? moves[0]!;
    const white = fen.split(" ")[1] === "w";
    const col = (sq: string) => (white ? sq.charCodeAt(0) - 97 : 104 - sq.charCodeAt(0));
    const row = (sq: string) => (white ? 8 - Number(sq[1]) : Number(sq[1]) - 1);
    const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
    const at = (sq: string) => ({ x: board.x + (col(sq) + 0.5) * (board.width / 8), y: board.y + (row(sq) + 0.5) * (board.height / 8) });
    await page.mouse.click(at(mv.from).x, at(mv.from).y);
    await page.mouse.click(at(mv.to).x, at(mv.to).y);
    await expect(page.locator(".last-stand")).toBeVisible({ timeout: 30_000 });
    const standAt = Number(await page.locator(".last-stand").getAttribute("data-start"));
    await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
    const s = await samples();
    const during = s.filter((x) => x.start && x.now >= x.start && x.now < x.start + ATTACK_MS);
    expect(during.length).toBeGreaterThan(20);
    expect(Math.abs(during[0].start - (standAt + ATTACK_AT))).toBeLessThanOrEqual(1);
    expectEveryLash(during);
    expect(Math.max(...during.map((x) => x.hp.length))).toBeGreaterThanOrEqual(3);
    expect(s.every((x) => x.red === 0)).toBe(true);
    expect(during.filter((x) => x.god).every((x) => x.god === "lastStandAttacked")).toBe(true);
    // Drawn beside him toward the board's middle (the God King where your move went), facing him; his corner empty.
    const kingLeftOfMiddle = col(mv.to) < 4;
    expect(during.every((x) => x.boss && x.flip === (b.facesLeft ? !kingLeftOfMiddle : kingLeftOfMiddle))).toBe(true);
    expect(during.filter((x) => x.on).every((x) => x.corner === "hidden")).toBe(true);
    // His whole frame on screen, every frame.
    for (const x of during.filter((d) => d.box)) {
      expect(x.box.left).toBeGreaterThanOrEqual(0);
      expect(x.box.right).toBeLessThanOrEqual(x.vw);
      expect(x.box.top).toBeGreaterThanOrEqual(0);
    }
    // His sounds on the hits, in turn.
    const heard = await page.evaluate(() => ((window as any).__soundLog as string[]).map((n) => n.split(":")[0]));
    for (const name of b.sounds) expect(heard.filter((n) => n === name).length, name).toBeGreaterThanOrEqual(LASHES / 2 - 1);
    expect(s.filter((x) => x.now > standAt + ATTACK_AT + ATTACK_MS + 100).every((x) => !x.on)).toBe(true);
    await expect(page.getByRole("img", { name: "The God King has fallen" })).toBeVisible();
    expect(errors).toEqual([]);
  });
