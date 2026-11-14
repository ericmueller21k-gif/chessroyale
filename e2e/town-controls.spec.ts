import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { devices, expect, type Page } from "@playwright/test";
import { asAdmin, test, lookDrag, townTap } from "./helpers.ts";

/**
 * The street town's controls and minimap (Nov 5; brief-street-controls-map.md, docs/decisions/2026-11-05-street-controls-map.md):
 * - hold to run: a press held still runs you the way your finger is from your pawn (up, down, left or right of the view), at once;
 *   moving the finger changes the way and never turns the camera; letting go stops you; a run into a home's door opens its card;
 * - locking a new view: a look round let go snaps to the nearest quarter (split at 45°, Nov 6: "about like 45 degrees"); a tap, a run or
 *   an arrow next makes it the base heading, which the arrows follow; a building's in and out resets it to north;
 * - the minimap: on by default, top right, your dot moving with you; its button hides it (remembered); a tap opens it large with the
 *   boss portraits, the Colosseum and the park; a tap closes it, and on a portrait walks you to that home (Nov 11); it never covers
 *   the arrows, the zoom pair or the chat.
 * Phone (touch, through the browser's touch events) and computer (the mouse's left button), on WebGL (the street town's only drawing).
 * `STILLS=docs/street-controls-map` writes the stills and GIFs.
 */
test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

const STILLS = process.env.STILLS;
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];
type DBox = { x0: number; y0: number; x1: number; y1: number; fx: number; fy: number };
type Cam = { zoom: number; heading: number; headingBase: number; look: number; base: number; snapped: number | null; gesture: string; run: string | null; strip: string | null; you: DBox | null };
type Me = { c: number; r: number; moving: boolean };
type W = {
  __townWalk: (s: readonly [number, number]) => boolean;
  __townCam: () => Cam;
  __townYou: () => Me;
  __townAt: (k: string, id?: unknown) => { x: number; y: number } | null;
  __townBossBack: (id: string) => boolean;
};
const cam = (page: Page) => page.evaluate(() => (window as unknown as W).__townCam());
const me = (page: Page) => page.evaluate(() => (window as unknown as W).__townYou());
const settle = (page: Page) => expect.poll(async () => (await me(page)).moving, { timeout: 15_000 }).toBe(false);
const walkTo = async (page: Page, sq: readonly [number, number]) => {
  await page.evaluate((s) => (window as unknown as W).__townWalk(s), sq);
  await expect.poll(async () => (await you(page)).join(","), { message: `walked to ${sq}`, timeout: 60_000 }).toBe(sq.join(","));
  await settle(page);
};
async function open(page: Page) {
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
}
/**
 * Waits (each frame, not expect.poll's growing gaps: a run covers a square in about a tenth of a second) until your column (`axis` 0) or
 * row (1) is at least `n` squares from `from`'s.
 */
const ranOn = (page: Page, from: readonly number[], axis: 0 | 1, n: number, timeout = 10_000) =>
  page.waitForFunction(
    ([f, a, k]) => {
      const v = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!.dataset.you!.split(",").map(Number);
      return Math.abs(v[a]! - f[a]!) >= k;
    },
    [from, axis, n] as const,
    { polling: "raf", timeout },
  ).catch(async (e) => {
    throw new Error(`no run ${n} from ${from} (at ${(await you(page)).join(",")}): ${String(e).split("\n")[0]}`);
  });
/** The way from a to b on the world's squares (east, north), the short way round east-west. */
const way = (a: readonly number[], b: readonly number[]) => [Math.sign(((b[0]! - a[0]! + 81) % 54) - 27), Math.sign(b[1]! - a[1]!)];
/**
 * Counts your travel square by square (every frame, from data-you): the squares east and north you've gone, signed, the world wrapping
 * east-west (54 wide). Not the difference of two ends: a run held on for a long wall time (the test's round trips under load let a few
 * seconds pass before the release) goes past half the world, and the short way round from start to end then reads the other way.
 */
const travelStart = (page: Page) =>
  page.evaluate(() => {
    const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!;
    const t = { on: true, x: 0, y: 0, c: -1, r: -1 };
    (window as unknown as { __travel: typeof t }).__travel = t;
    const f = () => {
      const [c, r] = cv.dataset.you!.split(",").map(Number) as [number, number];
      if (t.c >= 0) {
        t.x += ((c - t.c + 81) % 54) - 27;
        t.y += r - t.r;
      }
      t.c = c;
      t.r = r;
      if (t.on) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
const travelEnd = (page: Page) =>
  page.evaluate(() => {
    const t = (window as unknown as { __travel: { on: boolean; x: number; y: number } }).__travel;
    t.on = false;
    return [t.x, t.y];
  });

/** A finger: the phone's a touch (the browser's own touch events, as a phone sends them), the computer's the mouse's left button. */
async function finger(page: Page) {
  if (test.info().project.name === "phone") {
    const cdp = await page.context().newCDPSession(page);
    const pt = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), radiusX: 4, radiusY: 4, force: 1, id: 1 }];
    return {
      down: (x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x, y) }),
      move: (x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) }),
      up: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
    };
  }
  return {
    down: async (x: number, y: number) => {
      await page.mouse.move(x, y);
      await page.mouse.down({ button: "left" });
    },
    move: (x: number, y: number) => page.mouse.move(x, y),
    up: () => page.mouse.up({ button: "left" }),
  };
}
/** Your pawn's middle on the page (its body's, as the last frame drew it). */
async function pawn(page: Page) {
  const cv = (await canvas(page).boundingBox())!;
  const b = (await cam(page)).you!;
  return { x: cv.x + (b.x0 + b.x1) / 2, y: cv.y + (b.y0 + b.fy) / 2 };
}
const OFF: Record<string, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/**
 * Where to hold for a run `dir`: `px` that way from your pawn's middle where it stands still (`origin`, else where it's drawn now). The
 * run is steered from there (your pawn's rest spot on screen; running, the camera's follow lets it lead by up to about a square).
 */
async function holdPoint(page: Page, dir: string, px = 110, origin?: { x: number; y: number }) {
  const c = origin ?? (await pawn(page));
  return { x: c.x + OFF[dir]![0] * px, y: c.y + OFF[dir]![1] * px };
}
/** Records the camera's heading and look every frame from now (read with `headings`). */
const watchHeadings = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __hs: number[][]; __townCam: () => Cam; __stop?: boolean };
    w.__hs = [];
    w.__stop = false;
    const f = () => {
      const c = w.__townCam();
      w.__hs.push([c.heading, c.look]);
      if (!w.__stop) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
const headings = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __hs: number[][]; __stop?: boolean };
    w.__stop = true;
    return w.__hs;
  });
/** A drag across the box from its middle, `share` of its width (negative: leftward), by the mouse, in steps. */
async function drag(page: Page, share: number) {
  // (The press and its first move together, so a slow frame can't make it a hold to run: helpers.ts lookDrag.)
  await lookDrag(page, (await canvas(page).boundingBox())!, share);
}
/** Taps square `sq` where it's drawn (a quick tap: a walk). */
async function tapSquare(page: Page, sq: readonly [number, number]) {
  // (The tap on the frame its point came from: `townTap`, Nov 14.)
  expect(await townTap(page, "tap-square", sq), `${sq} drawn`).toBe(true);
}
async function arrowStep(page: Page, key: string) {
  const from = await you(page);
  await page.keyboard.down(key);
  // (Let go the frame you've left your square, not at expect.poll's growing gaps: on a slow runner those let a held key run on for
  // squares, off the street and onto a sidewalk's lamp.)
  await page.waitForFunction((f) => document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!.dataset.you !== f, from.join(","), { polling: "raf", timeout: 5000 });
  await page.keyboard.up(key);
  await settle(page);
  return way(from, await you(page));
}
type R = { x: number; y: number; width: number; height: number };
// (Null at once for something not on the page: a computer has no town bar since Nov 7.)
const rect = async (p: Page, sel: string) => ((await p.locator(sel).count()) ? (p.locator(sel).first().boundingBox() as Promise<R | null>) : null);
const meets = (a: R, b: R) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
/** The dot's middle on the page (the element's own box is its middle: 0 × 0). */
async function dot(page: Page, sel = ".tm-small .tm-you") {
  return page.locator(sel).evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const p = (el.parentElement as HTMLElement).getBoundingClientRect();
    const par = el.parentElement as HTMLElement;
    return { x: p.left + par.clientLeft + m.m41, y: p.top + par.clientTop + m.m42, deg: Math.round((Math.atan2(m.m12, m.m11) * 180) / Math.PI) };
  });
}

test(`hold to run: a press held still runs you each way the finger is from your pawn, at once; letting go stops you; the camera never turns`, async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  const f = await finger(page);
  // Each from a square with a long street that way (a run under a slow machine goes on a few squares before the test lets go):
  // Fountain Street east and west of the park (row 28; the park, columns 13 to 32, would step the zoom out mid-run), and Seam Avenue
  // (column 0, rows 4 to 38) north and south.
  const runs = [["right", [1, 0], [36, 28]], ["left", [-1, 0], [10, 28]], ["up", [0, 1], [0, 12]], ["down", [0, -1], [0, 34]]] as const;
  for (const [dir, w, start] of runs) {
    await walkTo(page, start);
    await page.waitForTimeout(300);
    await watchHeadings(page);
    const from = await you(page);
    const at = await holdPoint(page, dir);
    const t0 = Date.now();
    await travelStart(page);
    await f.down(at.x, at.y);
    await expect.poll(async () => (await cam(page)).run, { message: `${dir}: a run`, timeout: 3000 }).toBe(dir);
    // Running that way (setting off no later than a step after the hold time), two squares on.
    await ranOn(page, from, w[0] ? 0 : 1, 1);
    // (Wall time through the test's round trips: software WebGL's frames are several times slower here, not the hold time.)
    expect(Date.now() - t0, `${dir}: set off at once`).toBeLessThan(8000);
    await ranOn(page, from, w[0] ? 0 : 1, 2);
    await f.up();
    const at0 = await you(page);
    await settle(page);
    const end = await you(page);
    const travel = await travelEnd(page);
    expect([Math.sign(travel[0]!), Math.sign(travel[1]!)], `${dir} runs you ${w} (travel ${travel}, from ${from}, to ${end})`).toEqual(w);
    expect(Math.abs(end[0] - at0[0]) + Math.abs(end[1] - at0[1]), `${dir}: stops at the next square`).toBeLessThanOrEqual(1);
    expect((await cam(page)).run, "nothing held after").toBeNull();
    const seen = await headings(page);
    expect(seen.length).toBeGreaterThan(5);
    expect([...new Set(seen.map(([h, l]) => `${h}/${l}`))], `${dir}: the camera never turned`).toEqual(["0/0"]);
  }
});

test(`a run steers: sliding the finger mid-run changes the way, and the camera doesn't turn`, async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  // (Fountain Street east of the park, from where it runs on round the world's east-west wrap to the park's west side: room to run
  // right while the test reads and slides, however slow the machine.)
  await walkTo(page, [36, 28]);
  const f = await finger(page);
  await watchHeadings(page);
  const start = await you(page);
  const rest = await pawn(page);
  const at = await holdPoint(page, "right", 110, rest);
  await f.down(at.x, at.y);
  await ranOn(page, start, 0, 1);
  // The finger slides round to above your pawn, in steps (a swipe that would turn the camera, were it not a run).
  const to = await holdPoint(page, "up", 110, rest);
  for (let i = 1; i <= 4; i++) await f.move(at.x + ((to.x - at.x) * i) / 4, at.y + ((to.y - at.y) * i) / 4);
  await expect.poll(async () => (await cam(page)).run, { timeout: 3000 }).toBe("up");
  await ranOn(page, start, 1, 1);
  await f.up();
  await settle(page);
  const c = await cam(page);
  expect([c.heading, c.look, c.base], "still north, no look round").toEqual([0, 0, 0]);
  expect([...new Set((await headings(page)).map(([h, l]) => `${h}/${l}`))], "the camera never turned").toEqual(["0/0"]);
});

test(`locking a new view: a drag let go near east snaps there; a tap locks it in and the up arrow goes east; about 54° left of east snaps to north, a tap locks it in; a building's in and out resets north`, async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  // (Fountain Street east of the park: room to walk and run east, round the world's wrap, before the park.)
  await walkTo(page, [38, 28]);
  // A bit past a quarter to the right (about 95°): let go, it eases to east exactly; snapped, not yet the base.
  await drag(page, 0.53);
  await expect.poll(async () => (await cam(page)).heading, { timeout: 3000 }).toBe(90);
  let c = await cam(page);
  expect([c.snapped, c.base], "snapped to east, the base still north").toEqual([90, 0]);
  // A tap (a walk): east becomes the base heading; the camera stays there through the walk.
  await watchHeadings(page);
  const here = await you(page);
  // (Two ahead and one to the right, the street's south lane: clear of the homes north of it, whose fronts stand over the street's
  // squares on screen as you face east.)
  await tapSquare(page, [here[0] + 2, here[1] - 1]);
  await expect.poll(async () => (await cam(page)).base, { timeout: 3000 }).toBe(90);
  await settle(page);
  expect(await you(page), "walked to the square tapped").toEqual([here[0] + 2, here[1] - 1]);
  expect([...new Set((await headings(page)).map(([h]) => Math.round(h)))], "the camera stayed east").toEqual([90]);
  c = await cam(page);
  expect([c.heading, c.headingBase, c.look, c.snapped]).toEqual([90, 90, 0, null]);
  // The arrows follow it: up is east now, left north; and they never change it.
  expect(await arrowStep(page, "ArrowUp"), "up goes east").toEqual([1, 0]);
  expect(await arrowStep(page, "ArrowLeft"), "left goes north").toEqual([0, 1]);
  expect(await arrowStep(page, "ArrowRight"), "right goes south").toEqual([0, -1]);
  expect((await cam(page)).base, "the arrows never change it").toBe(90);
  // A hold to run goes through it too: the finger above your pawn runs you east. (From the street's middle: a held arrow on a slow
  // runner can take extra steps, onto a sidewalk with a lamp ahead.)
  await walkTo(page, [40, 28]);
  const f = await finger(page);
  const from = await you(page);
  const up = await holdPoint(page, "up");
  await f.down(up.x, up.y);
  await ranOn(page, from, 0, 1);
  await f.up();
  await settle(page);
  expect(way(from, await you(page)), "a run up goes east").toEqual([1, 0]);
  // About 54° left of east: let go, it snaps to north (the nearest quarter), eased there exactly; snapped, the base still east. (From
  // (6, 28), west of the park, the zoom at rest: a run on a slow WebGL runner can carry you into the park, whose step out glides the zoom,
  // and a tap point read during a glide is a square off by the time it lands.)
  await walkTo(page, [6, 28]);
  await expect.poll(async () => (await cam(page)).zoom, { timeout: 5000 }).toBe(2);
  await drag(page, -0.3);
  await expect.poll(async () => (await cam(page)).heading, { timeout: 3000 }).toBe(0);
  c = await cam(page);
  expect([c.snapped, c.base], "snapped to north, the base still east").toEqual([0, 90]);
  // (Two squares east on Fountain Street's middle row: all street, no lamps. Aiming two east of wherever you stood once landed on the
  // south sidewalk's lamp at (4, 26), after a held arrow's extra step put you on that sidewalk; a tap on a lamp's square walks you
  // beside it, to (3, 26).)
  // A tap (a walk) locks north in: the new base heading; the camera stays north through the walk.
  const sq2 = [8, 28] as const;
  await tapSquare(page, sq2);
  await expect.poll(async () => (await cam(page)).base, { timeout: 3000 }).toBe(0);
  await settle(page);
  expect(await you(page), "walked to the square tapped").toEqual([...sq2]);
  c = await cam(page);
  expect([c.heading, c.headingBase, c.snapped], "still north, nothing snapped").toEqual([0, 0, null]);
  // Puddles' Botanical Garden: its door's square is on its strip (the camera faces its front, north; the base stays north). A run
  // toward it opens its card, as the arrows do; in and out, the view is north again.
  await walkTo(page, [9, 16]);
  await expect.poll(async () => (await cam(page)).strip, { timeout: 5000 }).toBe("gardener");
  await expect.poll(async () => (await cam(page)).heading, { timeout: 3000 }).toBe(0);
  expect((await cam(page)).base, "a strip leaves the base alone").toBe(0);
  const card = page.getByRole("dialog", { name: "Puddles' Botanical Garden", exact: true });
  const toward = await holdPoint(page, "up");
  await f.down(toward.x, toward.y);
  await expect(card, "a run into its door opens its card").toBeVisible({ timeout: 5000 });
  await f.up();
  expect(await you(page), "you didn't walk into it").toEqual([9, 16]);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  // (Back once the room has finished coming in: a press during the zoom in isn't taken. A computer has no Back since Nov 7, its tools in
  // the right column: out by the room's door, its card's Go out.)
  await expect(async () => {
    if (test.info().project.name === "phone") await page.getByRole("button", { name: "Back", exact: true }).click();
    else {
      const door = await page.evaluate(() => (window as unknown as { __shopAt?: (k: string) => { x: number; y: number } | null }).__shopAt?.("door") ?? null);
      const cv = (await room(page).boundingBox())!;
      if (door) await page.mouse.click(cv.x + door.x, cv.y + door.y);
      await page.getByRole("dialog", { name: "Door" }).getByRole("button", { name: "Go out" }).click({ timeout: 3000 });
    }
    await expect(room(page)).toHaveCount(0, { timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect.poll(async () => (await cam(page)).base, { timeout: 5000 }).toBe(0);
  // Off the strip: north (not east).
  expect(await arrowStep(page, "ArrowDown"), "down goes south").toEqual([0, -1]);
  await expect.poll(async () => (await cam(page)).heading, { timeout: 3000 }).toBe(0);
  expect((await cam(page)).base).toBe(0);
});

test("the minimap: on by default at the top right, your dot moving with you and its arrow the camera's way; the button hides it (remembered); a tap opens it large with the boss portraits, a tap closes it", async ({ page }) => {
  test.setTimeout(270_000);
  await open(page);
  const small = page.locator(".tm-small");
  await expect(small).toBeVisible();
  const box = (await rect(page, ".town-box"))!;
  const m = (await small.boundingBox())!;
  expect(m.x + m.width, "at the right").toBeGreaterThan(box.x + box.width - 20);
  expect(m.y, "at the top").toBeLessThan(box.y + 20);
  const share = m.width / box.width;
  if (test.info().project.name === "phone") expect(Math.abs(share - 0.26), `about 26% of the width (${share.toFixed(3)})`).toBeLessThan(0.02);
  else expect(share, "smaller on a computer").toBeLessThan(0.16);
  expect(Number(await small.evaluate((el) => getComputedStyle(el).opacity)), "partly see-through").toBeCloseTo(0.7, 2);
  // The dot: where the plan's square is (54 columns across the map's width), moving as you walk.
  await walkTo(page, [8, 28]);
  await page.waitForTimeout(200);
  const s = (await small.locator("canvas").boundingBox())!.width / 54;
  const d0 = await dot(page);
  const cv0 = (await small.locator("canvas").boundingBox())!;
  expect(Math.abs(d0.x - (cv0.x + 8.5 * s)), "your column").toBeLessThan(1.5);
  expect(d0.deg, "the arrow north").toBe(0);
  await walkTo(page, [14, 28]);
  await page.waitForTimeout(200);
  const d1 = await dot(page);
  expect(Math.abs(d1.x - d0.x - 6 * s), "six squares east").toBeLessThan(1.5);
  expect(Math.abs(d1.y - d0.y), "the same row").toBeLessThan(0.6);
  await walkTo(page, [14, 23]);
  await page.waitForTimeout(200);
  expect(Math.abs((await dot(page)).y - d1.y - 5 * s), "five squares south: down the map").toBeLessThan(1.5);
  // The arrow turns with the camera: a look round a quarter to the right points it east.
  await drag(page, 0.5);
  await expect.poll(async () => (await dot(page)).deg, { timeout: 3000 }).toBe(90);
  // (Snapped to east: an arrow's step locks it in, the base east, and that step goes east: up is east now.)
  expect(await arrowStep(page, "ArrowUp"), "up goes east").toEqual([1, 0]);
  await expect.poll(async () => (await dot(page)).deg, { timeout: 3000 }).toBe(90);
  expect((await cam(page)).base, "the arrow locked east in").toBe(90);

  // The button: off hides it (and its box goes, so the chips may use the corner), remembered on this device; on brings it back.
  const btn = page.getByRole("button", { name: "Map", exact: true });
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await btn.click();
  await expect(small).toHaveCount(0);
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(small, "still off after a reload").toHaveCount(0);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(small).toBeVisible();

  // A tap opens it large in the middle: the whole town, every boss home with its portrait, the Colosseum and the park; no names.
  const at = await you(page);
  await small.click();
  const big = page.getByRole("dialog", { name: "Map of the town" });
  await expect(big).toBeVisible();
  const bb = (await page.locator(".tm-big").boundingBox())!;
  const tb = (await rect(page, ".town-box"))!;
  expect(Math.abs(bb.x + bb.width / 2 - (tb.x + tb.width / 2)), "in the middle across").toBeLessThan(2);
  expect(Math.abs(bb.y + bb.height / 2 - (tb.y + tb.height / 2)), "in the middle down").toBeLessThan(2);
  const faces = page.locator(".tm-face");
  await expect(faces).toHaveCount(18);
  const ids = await faces.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.home));
  expect(new Set(ids).size).toBe(18);
  // (Each portrait drawn: some of its pixels not blank.)
  const drawn = await faces.evaluateAll((els) =>
    els.filter((e) => {
      const c = e.querySelector("canvas")!;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) return true;
      return false;
    }).length,
  );
  expect(drawn, "every portrait drawn").toBe(18);
  await expect(page.locator(".tm-big [data-icon=park]")).toHaveCount(1);
  await expect(page.locator(".tm-big [data-icon=colosseum]")).toHaveCount(1);
  await expect(page.locator(".tm-big .tm-you")).toHaveCount(1);
  expect((await big.innerText()).trim(), "no names").toBe("");
  // A tap on it closes it, and walks you nowhere.
  await page.locator(".tm-big").click();
  await expect(big).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(await you(page)).toEqual(at);
  await expect(small, "back to its small size").toBeVisible();
  // A tap outside it closes it too (over the arrows' corner as well: nothing pressed there).
  await small.click();
  await expect(big).toBeVisible();
  await page.mouse.click(tb.x + 6, tb.y + tb.height - 6);
  await expect(big).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(await you(page)).toEqual(at);

  // (Eric, Nov 11.) A tap on a boss's portrait closes it and walks you to that home: you end by it, where a tap on it takes you.
  await small.click();
  await expect(big).toBeVisible();
  const sq = (await page.locator(".tm-big > canvas").boundingBox())!.width / 54;
  const me0 = await dot(page, ".tm-big .tm-you");
  // (The nearest portrait at least 5 squares away, and where its home is, in squares, from your dot.)
  const pick = await faces.evaluateAll(
    (els, [x, y, s]) =>
      els
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { id: (e as HTMLElement).dataset.home!, x: r.left + r.width / 2, y: r.top + r.height / 2, dc: (r.left + r.width / 2 - x!) / s!, dr: -(r.top + r.height / 2 - y!) / s! };
        })
        .filter((f) => Math.hypot(f.dc, f.dr) >= 5)
        .sort((a, b) => Math.hypot(a.dc, a.dr) - Math.hypot(b.dc, b.dr))[0]!,
    [me0.x, me0.y, sq],
  );
  const from = await you(page);
  const home = [Math.round(from[0] + pick.dc), Math.round(from[1] + pick.dr)];
  if (STILLS) await page.screenshot({ path: `${STILLS}/map-walk-1-tap-${test.info().project.name}.png` });
  await page.mouse.click(pick.x, pick.y);
  await expect(big, "the map closes").toHaveCount(0);
  await expect.poll(async () => (await me(page)).moving, { message: "you set off", timeout: 3000 }).toBe(true);
  await settle(page);
  const end = await you(page);
  const off = (a: number, b: number) => Math.abs((((a - b) % 54) + 81) % 54 - 27);
  expect(off(end[0], home[0]!), `by ${pick.id} across (${end} vs ${home})`).toBeLessThanOrEqual(3);
  expect(off(end[1], home[1]!), `by ${pick.id} along (${end} vs ${home})`).toBeLessThanOrEqual(3);
  if (STILLS) await page.screenshot({ path: `${STILLS}/map-walk-2-arrived-${test.info().project.name}.png` });
});

test("the minimap never covers the arrows, the zoom pair, the focus button or the chat, at every phone size and on computers", async ({ browser }) => {
  test.setTimeout(400_000);
  const phone = test.info().project.name === "phone";
  const sizes: [number, number][] = phone ? [[320, 568], [360, 740], [390, 844], [430, 932], [844, 390], [768, 1024], [1024, 768]] : [[1280, 800], [1440, 900], [1920, 1080], [1024, 700]];
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext(phone ? { ...devices["iPhone 13"], viewport: { width: w, height: h } } : { viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await open(page);
    await page.waitForTimeout(500);
    const m = (await rect(page, ".tm-small"))!;
    const box = (await rect(page, ".town-box"))!;
    expect(m, `${w}×${h}: shows`).not.toBeNull();
    expect(m.x >= box.x && m.y >= box.y && m.x + m.width <= box.x + box.width && m.y + m.height <= box.y + box.height, `${w}×${h}: inside the world's box`).toBe(true);
    for (const sel of [".town-keys", ".town-zoom", ".town-recenter", ".town-chat", ".town-bar"]) {
      const o = await rect(page, sel);
      if (o) expect(meets(m, o), `${w}×${h}: clear of ${sel}`).toBe(false);
    }
    await ctx.close();
  }
});

/** The stills and GIFs (brief: the minimap small and large, phone and computer; hold to run with a mid-run turn; the look round, snap and lock). */
test("stills and GIFs: the controls and the minimap", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-controls-map)");
  test.setTimeout(600_000);
  mkdirSync(STILLS!, { recursive: true });
  const project = test.info().project.name;
  await open(page);
  await walkTo(page, [10, 28]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${STILLS}/1-minimap-small-${project}.png` });
  await page.locator(".tm-small").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${STILLS}/2-minimap-large-${project}.png` });
  await page.locator(".tm-big").click();
  // The park from the opening step (the third, Nov 5): its step out is the overview; you and every figure on screen.
  await walkTo(page, [16, 28]);
  await expect.poll(async () => (await cam(page)).zoom, { timeout: 5000 }).toBe(3);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${STILLS}/5-park-step-out-${project}.png` });
  if (project !== "phone") return;
  /** Frames every ~100 ms while `act` runs, made into a GIF. */
  const gif = async (name: string, act: () => Promise<void>) => {
    const dir = `${STILLS}/.frames-${name}`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let n = 0;
    let on = true;
    const grab = (async () => {
      while (on) {
        await page.screenshot({ path: `${dir}/${String(n++).padStart(4, "0")}.png`, scale: "css" });
        await page.waitForTimeout(60);
      }
    })();
    await act();
    on = false;
    await grab;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "8", "-i", `${dir}/%04d.png`, "-vf", "scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer", `${STILLS}/${name}.gif`]);
    rmSync(dir, { recursive: true, force: true });
  };
  const f = await finger(page);
  await walkTo(page, [36, 28]);
  await page.waitForTimeout(800);
  await gif("3-hold-to-run-turn-phone", async () => {
    await page.waitForTimeout(400);
    const rest = await pawn(page);
    const at = await holdPoint(page, "right", 110, rest);
    await f.down(at.x, at.y);
    await page.waitForTimeout(1600);
    const to = await holdPoint(page, "up", 110, rest);
    for (let i = 1; i <= 6; i++) await f.move(at.x + ((to.x - at.x) * i) / 6, at.y + ((to.y - at.y) * i) / 6);
    await page.waitForTimeout(900);
    await f.up();
    await page.waitForTimeout(800);
  });
  await walkTo(page, [38, 28]);
  await page.waitForTimeout(800);
  await gif("4-look-snap-lock-phone", async () => {
    await page.waitForTimeout(400);
    await lookDrag(page, (await canvas(page).boundingBox())!, 0.54, 14, 0.35, 40);
    await page.waitForTimeout(700);
    const here = await you(page);
    await tapSquare(page, [here[0] + 2, here[1]]);
    await page.waitForTimeout(1200);
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(800);
  });
});
