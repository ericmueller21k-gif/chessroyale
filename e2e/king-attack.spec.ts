import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { test } from "./helpers.ts";

/**
 * A boss's attack on a king (Hollow's; Eric, Oct 10), played alone on a phone and a computer with real taps, watched
 * every frame from before it can start:
 * - at his mate (?mate=1: 1.f3 e5 2.g4, he mates at once): he drops in beside your king and lashes it, a "−N" off it each
 *   lash, the real king hidden while his copy flickers, topples and fades; his figure in the corner hidden meanwhile, his
 *   line said; the result only after the whole attack;
 * - in the God King's Last Stand (?laststand=1): the blow meant for the piece is Hollow's attack on the God King (his
 *   gold hits, none of the red slashes), and the Last Stand carries on as before (he falls; you pick again).
 * The beats are KING_ATTACK's and LAST_STAND's (packages/chess/src/boss-timing.ts).
 */
const ATTACK_MS = 2780;
const LASHES = 10;
const ATTACK_AT = 5550;
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");

/** Samples the page every animation frame from now on: what the attack shows, against its own start. */
async function sample(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__ka = [];
    const tick = () => {
      const a = document.querySelector(".king-attack");
      const real = [...document.querySelectorAll("cg-board piece.king")].map((k) => ({ white: k.classList.contains("white"), opacity: getComputedStyle(k).opacity }));
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
        red: document.querySelectorAll(".ls-dmg").length,
        real,
        copy: copy ? getComputedStyle(copy).opacity : null,
        corner: corner ? getComputedStyle(corner).visibility : null,
        god: document.querySelector(".ls-god .god-king")?.getAttribute("data-anim") ?? null,
        said: document.querySelector(".bc-bubble")?.textContent ?? "",
      });
      if (w.__ka.length < 20000) requestAnimationFrame(tick);
    };
    tick();
  });
  return () => page.evaluate(() => (window as any).__ka as any[]);
}

test("Hollow's mate: he lashes your king, it topples into the dark, then the result", async ({ page }) => {
  await page.goto("/?debug&clock=60&boss=hollow&mate=1");
  await page.evaluate(() => ((window as any).__soundLog = []));
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
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
  expect(new Set(during.map((x) => x.hit).filter((h) => h >= 0))).toEqual(new Set(Array.from({ length: LASHES }, (_, i) => i)));
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
  await page.getByRole("main").getByRole("button", { name: "Boss alone" }).click();
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
  const samples = await sample(page);
  // A knight out: the Last Stand (the test switch) on whatever you play.
  const fen = await page.evaluate(() => (window as any).match.phase.board.fen as string);
  const mv = new Chess(fen).moves({ verbose: true }).find((m) => m.piece === "n")!;
  const board = (await page.locator("cg-board").first().boundingBox())!;
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
  expect(new Set(during.map((x) => x.hit).filter((h) => h >= 0))).toEqual(new Set(Array.from({ length: LASHES }, (_, i) => i)));
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
  await expect(page.locator(".gk-unit .god-king.fallen, .gk-unit .fallen").first()).toBeVisible();
});
