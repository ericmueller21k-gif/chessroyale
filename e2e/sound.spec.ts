import { expect } from "@playwright/test";
import { test } from "./helpers.ts";
import { Chess } from "chess.js";
import { soloFromHome, soundOff, tapInTown } from "./helpers.ts";

const phase = (p: any) => p.evaluate(() => (window as any).match?.phase.kind ?? "none");

test("only piece sounds, clock ticks and the reveal reel play, and muting silences them", async ({ page }) => {
  await page.addInitScript(() => ((window as any).__soundLog = []));
  await page.goto("/?debug&mode=classic&pace=quick");
  await soloFromHome(page);
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  // The round opens with the "Round start" 3-2-1 on the board, then the clock bar runs.
  await expect(page.locator(".cc-banner")).toHaveText("Round start");
  await expect(page.locator(".center-count")).toHaveCount(0, { timeout: 10_000 });
  // (The bar above the board; its mirror under the board is .timer-bar.below.)
  await expect(page.locator(".timer-bar:not(.below)")).toBeVisible();
  // Five power-up slots, three lit at the start. A gray one just shakes; a lit one uses a power-up.
  await expect(page.locator(".pu-dot")).toHaveCount(5);
  await expect(page.locator(".pu-dot.on")).toHaveCount(3);
  await page.locator(".pu-dot:not(.on)").first().click();
  await expect(page.locator(".pu-dot.on")).toHaveCount(3);
  await page.getByRole("button", { name: /Use a power-up/ }).first().click();
  await expect(page.locator(".pu-dot.active")).toHaveCount(1);
  // The engine's top 3 moves, or every legal move when there are fewer: one opening line deals Black in check with
  // two replies (Caro-Kann 5.Nxf6+), in about 1 in 170 matches.
  const legal = new Chess(await page.evaluate(() => (window as any).match.phase.board.fen)).moves().length;
  await expect(page.locator(".hints li")).toHaveCount(Math.min(3, legal), { timeout: 15_000 });
  await page.evaluate(() => (window as any).match.submit((window as any).match.hint[0].move));
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("reveal");
  await page.waitForTimeout(4000);
  const all: string[] = await page.evaluate(() => (window as any).__soundLog);
  // First the queue screen (Solo's seats filling): its soft pops, and nothing else. Then the match, without a pop.
  const queue = all.findIndex((l) => !l.startsWith("pop"));
  expect(all.slice(0, queue).every((l) => /^pop(Soft)?:/.test(l))).toBe(true);
  const log = all.slice(queue);
  const names = log.map((l) => l.split(":")[0]);
  expect(names).toContain("tick");
  expect(names.some((n) => n === "move" || n === "capture")).toBe(true);
  // Besides the reveal reel and its winner, nothing else makes a sound: no jingles for the power-up or the round start.
  expect(names.every((n) => ["move", "capture", "castle", "tick", "reel", "select", "ripple"].includes(n))).toBe(true);
  for (const n of ["reel", "select"]) expect(names).toContain(n);
  // The audio context was running (unlocked by the tap), so they were actually heard.
  expect(log.filter((l) => l.startsWith("tick")).every((l) => l.includes(":running"))).toBe(true);
  // Muting silences them.
  await soundOff(page);
  await page.evaluate(() => ((window as any).__soundLog = []));
  await page.evaluate(() => (window as any).match.skipReveal());
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => (window as any).__soundLog.length), { timeout: 10_000 }).toBeGreaterThan(0);
  const after: string[] = await page.evaluate(() => (window as any).__soundLog);
  expect(after.every((l) => l.endsWith(":muted"))).toBe(true);
});

/**
 * Eric, Nov 3, on his iPhone, outside Big Boy's Crib: switched to another app and back, and no sound. iOS suspends the audio
 * context while the page is away and sometimes leaves it dead; here the page's visibility is switched by hand and the context is
 * suspended (it comes back: resumed on the way back) or closed (dead: the first tap after makes a new one). Each time Big Boy's
 * card, opened with a tap, is heard (`bigboyClack:running` in window.__soundLog).
 */
test("coming back from another app, sound is back on the first tap: a suspended context resumes, a dead one is replaced", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.__soundLog = [];
    // Every audio context the page makes (to suspend or close one as iOS would), and the page's visibility, switched by hand.
    const Real = window.AudioContext;
    w.__contexts = [];
    w.AudioContext = class extends Real {
      constructor(o?: AudioContextOptions) {
        super(o);
        w.__contexts.push(this);
      }
    };
    let vis: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => vis === "hidden" });
    w.__away = async (how: "suspend" | "close") => {
      vis = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      await w.__contexts.at(-1)[how]();
      vis = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    };
    // (The town's chat log lies over a corner of the map and takes taps there: this aims at the map.)
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
  const contexts = () => page.evaluate(() => ((window as any).__contexts as AudioContext[]).map((c) => c.state));
  const heard = () => page.evaluate(() => ((window as any).__soundLog as string[]).filter((l) => l.startsWith("bigboyClack:")));
  await page.goto("/town?sky=day");
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  /** A tap on Big Boy (his card opens and he makes his sound), then the card closed again. */
  const tapBigBoy = async () => {
    // (On the frame his point was read from, `tapInTown`: he wanders by his crib, and a tap aimed a few frames late landed on the crib.
    // Nov 14, logged: read at x 117 in his box 57 to 177, tapped as he stood at 127 to 247.)
    const card = await tapInTown(page, "boss", "bigboy", page.getByRole("dialog", { name: "Big Boy", exact: true }));
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
  };
  // Sound switched on by a key, then heard.
  await page.keyboard.press("Shift");
  await expect.poll(contexts).toEqual(["running"]);
  await tapBigBoy();
  expect((await heard()).at(-1)).toBe("bigboyClack:running");
  // Away and back, the context suspended: resumed on the way back, the same one; the next tap is heard.
  await page.evaluate(() => (window as any).__away("suspend"));
  await expect.poll(contexts).toEqual(["running"]);
  await tapBigBoy();
  expect((await heard()).at(-1)).toBe("bigboyClack:running");
  // Away and back, the context dead (closed): the first tap makes a new one, running, and it plays (that tap's own sound starts as
  // it wakes); the next tap's is heard on it.
  const before = (await heard()).length;
  await page.evaluate(() => (window as any).__away("close"));
  await tapBigBoy();
  await expect.poll(contexts).toEqual(["closed", "running"]);
  expect((await heard()).length).toBe(before + 1);
  await tapBigBoy();
  expect((await heard()).at(-1)).toBe("bigboyClack:running");
});
