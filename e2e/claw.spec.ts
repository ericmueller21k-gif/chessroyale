import { expect, type Page } from "@playwright/test";
import { bossCrateOf, clawWins, mulberry32 } from "@chessroyale/core";
import { asServerAdmin, tapInTown, test } from "./helpers.ts";

/**
 * Boingo's claw machine (Nov 6; docs/decisions/2026-11-06-claw-machine.md and -boingo-home.md), on a phone and a computer: the machine
 * is a cabinet in his Funhouse (Eric, Nov 6: "the real claw machine in the room … not a separate 2D overlay screen"). An admin walks in
 * and up to it (the camera glides in on it), taps its coin slot (the controls open, small, at the bottom), gives himself test tokens
 * (the machine's own "Admin: +3 of each token", the admins' grant), and plays Folio's token to a forced win and a forced loss with the
 * e2e's seed hook (`?clawSeed=`, honored only where TEST_SWITCHES is on). The cabinet's own claw shows the server's answer: a win drops
 * the crate out into the prize door's tray, Open now opens it with the Crates tab's own opening; a loss never does. One token a play.
 * CLAW_SHOTS=<dir>: the stills (and the frames of a play, for its GIF).
 */
test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.CLAW_SHOTS;

// (The chat log's box lies over a corner of the map and takes taps there: these tests aim at the room, as e2e/shop.spec.ts does.)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

/** A seed whose roll wins (or loses): the server's roll with the seed hook is mulberry32(seed)'s first number. */
const seedFor = (win: boolean) => {
  for (let s = 1; ; s++) if (clawWins(mulberry32(s)()) === win) return s;
};
const folio = bossCrateOf("folio")!;

type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townGlide?: (id: string) => void;
  __shopAt?: (k: string, sq?: readonly [number, number]) => { x: number; y: number } | null;
  __shopCam?: () => { focus: [number, number]; claw: number; clawPlay: { stage: string; held: boolean; fall: string | null; inTray: boolean; down: number } | null } | null;
};
const town = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const locker = (page: Page) =>
  page.evaluate(async () => (await (await fetch("/api/locker")).json()) as { tokens: Record<string, number>; bossCrates: Record<string, number> });
const cam = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopCam?.() ?? null);

/** Where to tap in the room (page coordinates), or null while it isn't drawn. */
async function shopAt(p: Page, kind: "square" | "slot", sq?: readonly [number, number]) {
  const xy = await p.evaluate(([k, s]) => (window as unknown as Hooks).__shopAt?.(k as string, s as [number, number] | undefined) ?? null, [kind, sq] as const);
  if (!xy) return null;
  const cv = (await room(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
/** Waits until you've stopped and the view rests on you (a tap is aimed then: docs/decisions/2026-11-05-ginger-steps.md). */
const viewOnYou = (p: Page) =>
  expect
    .poll(
      () =>
        p.evaluate(() => {
          const c = (window as unknown as Hooks).__shopCam?.();
          const you = document.querySelector<HTMLCanvasElement>("canvas.town-shop-canvas")?.dataset.you;
          if (!c || !you) return false;
          const [x, y] = you.split(",").map(Number);
          return Math.hypot(c.focus[0] - x!, c.focus[1] - y!) < 0.01;
        }),
      { message: "you've stopped and the view rests on you", timeout: 10_000, intervals: [50] },
    )
    .toBe(true);
async function walkTo(p: Page, sq: readonly [number, number]) {
  await viewOnYou(p);
  await expect.poll(() => shopAt(p, "square", sq), { message: `square ${sq} drawn` }).not.toBeNull();
  const at = (await shopAt(p, "square", sq))!;
  await p.mouse.click(at.x, at.y);
  await expect(room(p)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 20_000 });
}

/** Into Boingo's Funhouse from the town: his home's card, Go in. */
async function intoFunhouse(p: Page) {
  await expect(town(p)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await p.evaluate(() => (window as unknown as Hooks).__townGlide?.("clown"));
  const homeAt = async () => {
    const xy = await p.evaluate(() => (window as unknown as Hooks).__townAt?.("home", "clown") ?? null);
    if (!xy) return null;
    const cv = (await town(p).boundingBox())!;
    return { x: cv.x + xy.x, y: cv.y + xy.y };
  };
  await expect.poll(homeAt, { message: "Boingo's Funhouse comes into view" }).not.toBeNull();
  const card = p.getByRole("dialog", { name: "Boingo's Funhouse", exact: true });
  // (The tap on the frame its point came from: `tapInTown`, Nov 14.)
  await tapInTown(p, "home", "clown", card);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room(p)).toHaveAttribute("data-room", "clown");
}

test("the claw machine in Boingo's Funhouse: walk up (the camera closes in), the coin slot, an admin's test tokens, a forced win (the crate out into the tray, Open now) and a forced loss, one token each", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const name = test.info().project.name;
  const shot = async (what: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` }));
  await asServerAdmin(page);
  await page.goto(`/town?sky=day&clawSeed=${seedFor(true)}`);
  await intoFunhouse(page);
  // Walk up to the cabinet: standing at its spot, in front of its coin slot, the camera glides in on it.
  await walkTo(page, [14, 16]);
  await walkTo(page, [18, 10]);
  expect((await cam(page))!.claw).toBe(0);
  await walkTo(page, [19, 7]);
  await expect.poll(async () => (await cam(page))?.claw, { message: "the camera closes in on the cabinet" }).toBe(1);
  await page.waitForTimeout(300);
  await shot("claw-zoomed");
  // The coin slot: the controls open, small, at the bottom, the cabinet still in view above them.
  const slot = (await shopAt(page, "slot"))!;
  expect(slot).not.toBeNull();
  await page.mouse.click(slot.x, slot.y);
  const machine = page.locator(".claw-machine");
  await expect(machine).toBeVisible({ timeout: 15_000 });
  await expect(machine.locator(".claw-screen")).toHaveText("Insert one boss coin");
  const box = (await machine.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
  expect(box.height).toBeLessThan(vh * 0.4);
  expect(slot.y).toBeLessThan(box.y);
  // No tokens yet: the friendly line, every token greyed (shown, not hidden).
  await expect(machine.getByText("You have no boss tokens yet.")).toBeVisible();
  const token = machine.locator('.claw-token[data-boss="folio"]');
  await expect(token).toBeDisabled();
  // Eric's testing: the admins' grant, from the machine.
  await machine.getByRole("button", { name: "Admin: +3 of each token" }).click();
  await expect(token).toHaveAttribute("data-count", "3", { timeout: 20_000 });
  await shot("claw-picker");

  // A forced win: the coin, the cabinet's own claw roams (STOP), drops, grabs, lifts and carries the crate to the chute, out into the tray.
  await token.click();
  await expect(machine).toHaveAttribute("data-stage", "roam", { timeout: 10_000 });
  expect((await locker(page)).tokens.folio).toBe(2);
  expect((await locker(page)).bossCrates[folio.id]).toBe(1);
  await expect.poll(async () => (await cam(page))?.clawPlay?.stage).toBe("roam");
  // (The frames of a play for its GIF, as fast as screenshots come, for `ms`.)
  const frames = async (tag: string, ms: number) => {
    if (!SHOTS) return;
    for (let i = 0, t0 = Date.now(); Date.now() - t0 < ms; i++) await page.screenshot({ path: `${SHOTS}/frames/${tag}-${name}-${String(i).padStart(3, "0")}.png` });
  };
  await page.waitForTimeout(1200);
  await machine.getByRole("button", { name: "STOP" }).click();
  let held = false;
  const watchWin = page.evaluate(
    () =>
      new Promise<boolean>((done) => {
        let h = false;
        const t0 = performance.now();
        const look = () => {
          const c = (window as unknown as Hooks).__shopCam?.()?.clawPlay;
          h ||= !!c?.held;
          if (c?.inTray || performance.now() - t0 > 12_000) return done(h);
          requestAnimationFrame(look);
        };
        look();
      }),
  );
  await frames("win", 4200);
  held = await watchWin;
  expect(held, "the claw held the crate").toBe(true);
  await expect.poll(async () => (await cam(page))?.clawPlay?.inTray, { timeout: 10_000 }).toBe(true);
  await expect(machine).toHaveAttribute("data-stage", "won");
  await expect(machine.locator(".claw-screen")).toHaveText("You won Folio's Boss Crate!");
  await shot("claw-won");
  // Open now: the Crates tab's own opening, to its reveal; the crate is gone from the inventory.
  await machine.getByRole("button", { name: "Open now" }).click();
  await expect(page.locator(".claw-machine .reveal-card")).toBeVisible({ timeout: 30_000 });
  expect((await locker(page)).bossCrates[folio.id] ?? 0).toBe(0);
  await page.getByRole("button", { name: /Done/ }).click();
  await expect(machine.locator(".claw-screen")).toHaveText("Insert one boss coin");

  // A forced loss: the same, and the crate never reaches the chute (watched every frame). One more token gone, no crate.
  await page.evaluate((s) => history.replaceState(history.state, "", location.pathname + `?sky=day&clawSeed=${s}`), seedFor(false));
  await expect(token).toHaveAttribute("data-count", "2");
  await token.click();
  await expect(machine).toHaveAttribute("data-stage", "roam", { timeout: 10_000 });
  await page.waitForTimeout(800);
  await machine.getByRole("button", { name: "STOP" }).click();
  const watchLoss = page.evaluate(
    () =>
      new Promise<boolean>((done) => {
        let tray = false;
        const t0 = performance.now();
        const look = () => {
          const c = (window as unknown as Hooks).__shopCam?.()?.clawPlay;
          tray ||= !!c?.inTray || c?.fall === "chute";
          if (c?.stage === "lost" || performance.now() - t0 > 12_000) return done(tray);
          requestAnimationFrame(look);
        };
        look();
      }),
  );
  await frames("loss", 3600);
  expect(await watchLoss, "a loss never reaches the chute").toBe(false);
  await expect(machine).toHaveAttribute("data-stage", "lost", { timeout: 10_000 });
  await expect(machine.locator(".claw-screen")).toHaveText("So close! Try again?");
  const after = await locker(page);
  expect([after.tokens.folio, after.bossCrates[folio.id] ?? 0]).toEqual([1, 0]);
  // Try again: back to the picker, the count down by one.
  await machine.getByRole("button", { name: "Try again" }).click();
  await expect(token).toHaveAttribute("data-count", "1");
  // Closing is safe: the controls go; nothing more is spent. Walking off, the camera glides back out.
  await machine.getByRole("button", { name: "Close" }).click();
  await expect(machine).toHaveCount(0);
  expect((await locker(page)).tokens.folio).toBe(1);
  // (Zoomed in, the view rests on the cabinet; the down arrow walks you a square back from it.)
  await page.keyboard.down("ArrowDown");
  await expect(room(page)).not.toHaveAttribute("data-you", "19,7", { timeout: 20_000 });
  await page.keyboard.up("ArrowDown");
  await expect.poll(async () => (await cam(page))?.claw).toBe(0);
  expect(errors).toEqual([]);
});
