import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test, lookDrag, townTap } from "./helpers.ts";

/**
 * The street town, round 5 (Nov 5; brief-town-fixed-cam.md): one fixed view. The camera faces north whatever you press (Eric: "There
 * should be one view point no matter what, always"), but on a boss home's front strip, where it faces the home's front; a drag looks round
 * about your pawn, and your first step eases it back; the Colosseum against the back wall, gates and a grove beside it that you can't
 * walk into. Phone and computer, on WebGL (the street town's only drawing, Nov 6). `STILLS=docs/street-town-fixed` writes the stills.
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
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];
type Fig = { name: string; x0: number; y0: number; x1: number; y1: number; fy: number; alpha: number };
type Box = { id: string; kind: string; facing: string; front: boolean; x: number; y: number; foot: number[] | null };
type Cam = { heading: number; headingTo: number; headingBase: number; look: number; strip: string | null; figures: Fig[]; boxes: Box[] };
type Me = { c: number; r: number; facing: number; view: number; moving: boolean; way: [number, number] };
type W = {
  __townWalk: (s: readonly [number, number]) => boolean;
  __townCam: () => Cam;
  __townYou: () => Me;
  __townAt: (k: string, id?: unknown) => { x: number; y: number } | null;
  __townHeading: (h: number | null) => void;
};
const cam = (page: Page) => page.evaluate(() => (window as unknown as W).__townCam());
const me = (page: Page) => page.evaluate(() => (window as unknown as W).__townYou());
const walkTo = async (page: Page, sq: readonly [number, number]) => {
  await page.evaluate((s) => (window as unknown as W).__townWalk(s), sq);
  await expect.poll(async () => (await you(page)).join(","), { message: `walked to ${sq}`, timeout: 60_000 }).toBe(sq.join(","));
  await expect.poll(async () => (await me(page)).moving, { timeout: 5000 }).toBe(false);
};
/** The street town, an admin's, open (drawn with WebGL: its only drawing). */
async function open(page: Page, sky = "day") {
  await asAdmin(page);
  await page.goto(`/town?sky=${sky}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
}
/**
 * Every figure drawn whole inside the world's box (Eric, Nov 4), its foot on screen; a faded one may be off. (A bot walking past the
 * box's edge fades as it goes: whole on screen once it has, within a moment. Main run 43284874552: Pin Pete mid-fade, 2.6 px past.)
 */
async function figuresOnScreen(page: Page, what: string) {
  const cv = (await canvas(page).boundingBox())!;
  await expect(async () => {
    const c = await cam(page);
    expect(c.figures.length, `${what}: figures drawn`).toBeGreaterThan(0);
    for (const f of c.figures) {
      if (f.alpha < 0.5) continue;
      expect(f.x0, `${what}: ${f.name} not cut off on the left`).toBeGreaterThanOrEqual(-1);
      expect(f.x1, `${what}: ${f.name} not cut off on the right`).toBeLessThanOrEqual(cv.width + 1);
      expect(f.y0, `${what}: ${f.name} not cut off at the top`).toBeGreaterThanOrEqual(-1);
      expect(f.fy, `${what}: ${f.name}'s foot on screen`).toBeLessThanOrEqual(cv.height + 1);
    }
  }).toPass({ timeout: 3000 });
}
/** The boxes drawn past the back line (y 43.5): none but the Colosseum's ring and the back wall standing on it (the north edge round). */
const beyond = (boxes: Box[]) => boxes.filter((b) => b.y > 43.5 + 1e-6 && b.kind !== "ring").map((b) => `${b.kind} ${b.id} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
/** Records the camera's heading every frame from now (read with `headings`). */
const watchHeadings = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __headings: number[]; __townCam: () => Cam; __stop?: boolean };
    w.__headings = [];
    w.__stop = false;
    const look = () => {
      w.__headings.push(w.__townCam().heading);
      if (!w.__stop) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
const headings = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __headings: number[]; __stop?: boolean };
    w.__stop = true;
    return w.__headings;
  });
/**
 * Presses an arrow key and lets go on the frame your first step begins (in the page, so a busy machine's latency adds no steps; a
 * step or two); answers where you ended up.
 */
async function arrowStep(page: Page, key: string) {
  const moved = await page.evaluate(
    (code) =>
      new Promise<boolean>((done) => {
        const w = window as unknown as W;
        const at = (y: Me) => `${y.c},${y.r}`;
        const from = at(w.__townYou());
        const t0 = performance.now();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: code, code, bubbles: true }));
        const f = () => {
          const left = at(w.__townYou()) !== from;
          if (left || performance.now() - t0 > 5000) {
            window.dispatchEvent(new KeyboardEvent("keyup", { key: code, code, bubbles: true }));
            done(left);
          } else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      }),
    key,
  );
  expect(moved, `${key} walks you`).toBe(true);
  await expect.poll(async () => (await me(page)).moving, { timeout: 5000 }).toBe(false);
  return you(page);
}
/** The way from a to b on the world's squares (east, north), the short way round east-west. */
const way = (a: readonly number[], b: readonly number[]) => [Math.sign(((b[0]! - a[0]! + 81) % 54) - 27), Math.sign(b[1]! - a[1]!)];
/** A drag across the box from its middle, `share` of its width (negative: leftward), by the mouse, in steps. */
async function drag(page: Page, share: number) {
  // (The press and its first move together, so a slow frame can't make it a hold to run: helpers.ts lookDrag.)
  await lookDrag(page, (await canvas(page).boundingBox())!, share);
}

test(`one fixed view: the arrows walk all four ways and the camera never turns; a home's strip; step off`, async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  // On Fountain Street, clear of the homes' strips.
  await walkTo(page, [8, 28]);
  expect((await cam(page)).heading).toBe(0);
  await watchHeadings(page);
  // Right, up, left, down: each its screen direction (east, north, west, south). (A held key may take a second step before it's let
  // go: in this order you stay on the street's board, rows 27 to 30, clear of the sidewalks' lamps.)
  for (const [key, w] of [["ArrowRight", [1, 0]], ["ArrowUp", [0, 1]], ["ArrowLeft", [-1, 0]], ["ArrowDown", [0, -1]]] as const) {
    const from = await you(page);
    const to = await arrowStep(page, key);
    expect(way(from, to), key).toEqual(w);
  }
  const seen = await headings(page);
  expect(seen.length).toBeGreaterThan(10);
  expect([...new Set(seen)], "the camera never turned").toEqual([0]);
  await figuresOnScreen(page, "after the arrows");
  // A tap on Timber's Lumber Lodge's front strip (a square of it beside its door): you walk there and the camera faces the home's
  // front (it faces south: north, head on); the arrow toward it (up) opens its card; down steps you off the strip.
  // (Its door square, (5, 31): Timber wanders his strip, so he's held at his rest square first, clear of it.)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townBossBack: (id: string) => boolean }).__townBossBack("timber")), { timeout: 30_000 }).toBe(true);
  await walkTo(page, [5, 29]);
  // (A tap on its door square, or the next of its squares drawn clear; up to three tries, as someone passing can take the tap.)
  for (let tries = 0; tries < 3 && (await cam(page)).strip !== "timber"; tries++) {
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    // (The tap on the frame its point came from: `townTap`, Nov 14.)
    let tapped = false;
    for (const sq of [[5, 31], [6, 31], [4, 31]] as const) if ((tapped = await townTap(page, "tap-square", sq))) break;
    expect(tapped, "a square of the strip drawn").toBe(true);
    await page.waitForTimeout(300);
    await expect.poll(async () => (await me(page)).moving, { timeout: 15_000 }).toBe(false);
  }
  expect((await you(page))[1], "on the strip's row").toBe(31);
  await expect.poll(async () => (await me(page)).moving, { timeout: 15_000 }).toBe(false);
  await expect.poll(async () => (await cam(page)).strip, { timeout: 5000 }).toBe("timber");
  expect((await cam(page)).headingBase).toBe(0);
  expect((await cam(page)).heading).toBe(0);
  const card = page.getByRole("dialog", { name: "Timber's Lumber Lodge", exact: true });
  await page.keyboard.down("ArrowUp");
  await expect(card, "the arrow toward the home opens its card").toBeVisible({ timeout: 5000 });
  await page.keyboard.up("ArrowUp");
  const target = await you(page);
  expect(target[1], "you didn't walk into it").toBe(31);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await arrowStep(page, "ArrowDown");
  await expect.poll(async () => (await cam(page)).strip, { timeout: 5000 }).toBeNull();
  expect((await cam(page)).heading).toBe(0);
  await figuresOnScreen(page, "off the strip");
});

test(`the Colosseum against the back wall: ahead up the promenade, the plaza's walls before it, nothing past the back line; you can't go north past it`, async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  // From the park, up the promenade: the Colosseum ahead in the middle of the view, the plaza's three front walls before it.
  await walkTo(page, [22, 32]);
  const cv = (await canvas(page).boundingBox())!;
  const col = await page.evaluate(() => (window as unknown as W).__townAt("coliseum"));
  expect(col, "the Colosseum drawn").not.toBeNull();
  expect(Math.abs(col!.x - cv.width / 2), "ahead, in the middle").toBeLessThan(cv.width * 0.15);
  const boxes = (await cam(page)).boxes;
  // (Eric, Nov 6: nothing between you and it; the back wall either side of it, a gate in each side.)
  expect(boxes.filter((b) => b.kind === "wall" && b.y < 43), "no wall before it").toEqual([]);
  expect(boxes.filter((b) => b.kind === "wall" && b.front && b.id.includes("crest")).length, "its two gates").toBe(2);
  // Nothing drawn past the back line but its ring (and the back wall on it): no house, no tower.
  expect(beyond(boxes), "nothing past the line").toEqual([]);
  expect(boxes.filter((b) => b.front && b.kind === "ring").length, "its ring drawn").toBeGreaterThanOrEqual(3);
  expect(boxes.filter((b) => b.front && b.kind === "tall"), "no skyline tower in view").toEqual([]);
  await figuresOnScreen(page, "from the park");
  // Up to it: at the gate's square, the up arrow opens its card; you stay put.
  await walkTo(page, [22, 41]);
  expect((await cam(page)).heading).toBe(0);
  const card = page.getByRole("dialog", { name: "The Colosseum", exact: true });
  await page.keyboard.down("ArrowUp");
  await expect(card).toBeVisible({ timeout: 5000 });
  await page.keyboard.up("ArrowUp");
  expect(await you(page)).toEqual([22, 41]);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // North past the back line: at the plaza's corners up goes nowhere, and a walk asked for past the line ends before it.
  for (const c of [14, 31]) {
    await walkTo(page, [c, 43]);
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(1200);
    await page.keyboard.up("ArrowUp");
    expect(await you(page), `up at column ${c}, before its gate: stopped by the back line`).toEqual([c, 43]);
    for (const sq of [[c, 45], [c, 52]] as const) {
      await page.evaluate((s) => (window as unknown as W).__townWalk(s), sq);
      await page.waitForTimeout(300);
      await expect.poll(async () => (await me(page)).moving, { timeout: 30_000 }).toBe(false);
      const [, y] = await you(page);
      expect(y, `asked for ${sq}: stopped before the line`).toBeLessThanOrEqual(43);
    }
  }
  await figuresOnScreen(page, "at the wall");
});

test(`the plaza: a drag all the way round shows nothing past the back line, the Colosseum as faces; out onto Colosseum Row`, async ({ page }) => {
  test.setTimeout(150_000);
  await open(page);
  await walkTo(page, [20, 41]);
  // Eight eighths of a turn, a drag each: at every one, nothing past the line drawn; facing it, its ring's faces.
  let ringSeen = 0;
  for (let k = 1; k <= 8; k++) {
    await drag(page, 0.25);
    await page.waitForTimeout(500);
    const c = await cam(page);
    expect(beyond(c.boxes), `nothing past the line at ${Math.round(c.heading)} degrees`).toEqual([]);
    const ring = c.boxes.filter((b) => b.kind === "ring" && b.front).length;
    if (ring >= 2) ringSeen++;
    await figuresOnScreen(page, `looking round, ${Math.round(c.heading)} degrees`);
  }
  expect(ringSeen, "its ring's faces drawn as you look round").toBeGreaterThanOrEqual(2);
  // Out: the plaza is open to Colosseum Row (Eric, Nov 6), straight down from it onto the street.
  await walkTo(page, [15, 40]);
  await expect.poll(async () => (await cam(page)).heading, { timeout: 3000 }).toBe(0);
  // (A held key may take a second step before it's let go: down until you're on Colosseum Row, every step in the gateway's column.)
  for (let k = 0; k < 3 && (await you(page))[1] > 38; k++) expect((await arrowStep(page, "ArrowDown"))[0], "straight down").toBe(15);
  expect((await you(page))[1], "onto Colosseum Row").toBeLessThanOrEqual(38);
  await figuresOnScreen(page, "onto Colosseum Row");
});

test(`looking round: a drag turns the camera about your pawn, which doesn't move or turn; it lets go to the nearest quarter, and the up arrow locks it in and walks you that way`, async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await walkTo(page, [8, 28]);
  const before = await me(page);
  // Half a turn: dragging left across the box's width.
  await drag(page, -1);
  await page.waitForTimeout(400);
  let c = await cam(page);
  expect(c.look, "about half a turn, to the left").toBeLessThan(-150);
  expect(c.headingBase).toBe(0);
  const after = await me(page);
  expect([after.c, after.r, after.facing, after.view], "your pawn neither moved nor turned").toEqual([before.c, before.r, before.facing, before.view]);
  // Fountain Street's south row (its fronts face north, away from the normal view) shows.
  expect(c.boxes.filter((b) => b.facing === "N" && b.front).length, "the street's south side in view").toBeGreaterThanOrEqual(2);
  await figuresOnScreen(page, "looking round");
  // It stays turned until you move.
  await page.waitForTimeout(1000);
  expect((await cam(page)).look).toBeLessThan(-150);
  // Let go half a turn: the drag snaps to the nearest quarter, south (the view stays there, exactly: the look round is -180 degrees).
  // Up: the arrow locks south in as the base (Nov 6: any way of setting off does), so up walks you south, and the view stays south.
  const mod = (h: number) => ((h % 360) + 360) % 360;
  expect(c.snapped, "snapped to south").toBe(180);
  const from = await you(page);
  const to = await arrowStep(page, "ArrowUp");
  expect(way(from, to), "up walks you the snapped way, south").toEqual([0, -1]);
  await expect.poll(async () => mod((await cam(page)).headingBase), { timeout: 3000 }).toBe(180);
  c = await cam(page);
  expect([c.look, c.snapped], "locked in: nothing snapped, no look round").toEqual([0, null]);
  expect(mod(c.heading), "still facing south").toBe(180);
  // A tap while turned walks to the square under the finger, from the turned view. (Nov 6: a drag let go snaps to the nearest quarter, so
  // this drag, about 72 degrees, snaps to west; the tap then locks it in, e2e/town-controls.spec.ts.)
  await drag(page, 0.4);
  await expect.poll(async () => (await cam(page)).snapped, { timeout: 3000 }).toBe(270);
  // (`snapped` is set the moment the drag lets go; the view then eases there over streetSnapMs, turn.ts `release`: wait for the ease to
  // end, or a busy runner reads it mid-way, 89.2 degrees on Nov 6.)
  await expect.poll(async () => (await cam(page)).look, { message: "eased to a quarter turn to the right of south (west)", timeout: 3000 }).toBeCloseTo(90, 0);
  c = await cam(page);
  const here = await you(page);
  // (The square back the way you came: walked through a moment ago, so it's street, not a lamp or a home's front.)
  const sq = [here[0], here[1] + 1] as const;
  // (The tap on the frame its point came from: `townTap`, Nov 14.)
  expect(await townTap(page, "tap-square", sq), `${sq} drawn in the turned view`).toBe(true);
  await expect.poll(async () => (await you(page)).join(","), { timeout: 15_000 }).toBe(sq.join(","));
  // (The tap locked west in: the base heading, the camera where it was.)
  await expect.poll(async () => mod((await cam(page)).headingBase), { timeout: 3000 }).toBe(270);
  await figuresOnScreen(page, "after the tap");
});

/** The stills (brief: a street looking north, a home's strip, the plaza up close and from the park, the statues, the wall's corner; a look round). */
test("stills: the fixed view (round 5)", async ({ page }) => {
  test.skip(!STILLS, "stills only (STILLS=docs/street-town-fixed)");
  test.setTimeout(600_000);
  mkdirSync(STILLS!, { recursive: true });
  const project = test.info().project.name;
  const shot = async (name: string) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  };
  await open(page);
  await walkTo(page, [7, 29]);
  await shot("1-street-looking-north");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __townBossBack: (id: string) => boolean }).__townBossBack("timber")), { timeout: 30_000 }).toBe(true);
  await walkTo(page, [5, 31]);
  await shot("2-home-strip-timber");
  await walkTo(page, [22, 33]);
  await shot("3-colosseum-from-the-park");
  await walkTo(page, [22, 40]);
  await shot("4-colosseum-plaza-close");
  await walkTo(page, [18, 41]);
  await shot("5-statues");
  await walkTo(page, [14, 41]);
  await shot("6-wall-corner-west");
  await walkTo(page, [31, 41]);
  await shot("6-wall-corner-east");
  await walkTo(page, [8, 28]);
  await drag(page, -0.9);
  await shot("7-looking-round");
});

test(`the Colosseum stays put as the view turns: its portal and ring drawn where they stand at every heading, as the ground is`, async ({ page }) => {
  // (Eric, Nov 6, on round 5's flat Colosseum: it would "glitch and follow the camera around". The solid's portal and each stretch of its
  // ring are drawn on their own feet in the world: as the view turns, each moves across the box exactly as the ground under it does.)
  test.setTimeout(120_000);
  await open(page);
  // A few squares before the portal, on Colosseum Row's edge of the plaza.
  await walkTo(page, [22, 38]);
  const project = test.info().project.name;
  const groundAt = (x: number, y: number) => page.evaluate((s) => (window as unknown as W).__townAt("square", s), [x, y] as const);
  let prev: { portal: number; ground: number } | null = null;
  const steps = [0, 15, 30, 45, 0, -15, -30, -45];
  for (const [k, deg] of steps.entries()) {
    await page.evaluate((d) => (window as unknown as W).__townHeading(d), deg);
    await expect.poll(async () => Math.round((await cam(page)).heading), { timeout: 3000 }).toBe(deg);
    await page.waitForTimeout(300);
    const c = await cam(page);
    const portal = c.boxes.find((b) => b.kind === "portal" && b.foot);
    expect(portal, `the portal drawn at ${deg}`).toBeDefined();
    // Each end of its front's foot, as drawn, is the ground's own point there, to a pixel or two; so is each drawn stretch of its ring's.
    const onGround = async (b: Box, what: string) => {
      const f = b.foot!;
      for (const e of [0, 1]) {
        const g = await groundAt(f[6 + 2 * e]!, f[7 + 2 * e]!);
        if (!g) continue;
        expect(Math.abs(f[2 * e]! - g.x), `${what}'s foot (x) on its ground at ${deg}`).toBeLessThan(2);
        expect(Math.abs(f[1 + 2 * e]! - g.y), `${what}'s foot (y) on its ground at ${deg}`).toBeLessThan(2);
      }
    };
    await onGround(portal!, "the portal");
    const ring = c.boxes.filter((b) => b.kind === "ring" && b.foot);
    expect(ring.length, `its ring drawn at ${deg}`).toBeGreaterThanOrEqual(2);
    for (const b of ring) await onGround(b, b.id);
    // From step to step, the portal's foot moves across the box exactly as the ground under it does (it never stays centered or slides
    // with the view): its left end against that world point's own projection, before and after.
    const f = portal!.foot!;
    const ground = (await groundAt(f[6]!, f[7]!))?.x ?? null;
    if (prev && ground !== null && Math.abs(deg - steps[k - 1]!) === 15) {
      const gWas = prev.ground;
      expect(Math.abs(f[0]! - prev.portal - (ground - gWas)), `moved with the ground, ${steps[k - 1]} to ${deg}`).toBeLessThan(3);
      expect(Math.abs(f[0]! - prev.portal), `it moved, ${steps[k - 1]} to ${deg}`).toBeGreaterThan(20);
    }
    prev = ground === null ? null : { portal: f[0]!, ground };
    if (STILLS) {
      mkdirSync(STILLS, { recursive: true });
      await page.screenshot({ path: `${STILLS}/rot-${project}-${k === 4 ? "0b" : `${deg > 0 ? "+" : ""}${deg}`}.png` });
    }
  }
  // (Stills: a slow turn from -45 to +45 degrees, every 3, for the GIF.)
  if (STILLS && process.env.ROT_FRAMES) {
    mkdirSync(process.env.ROT_FRAMES, { recursive: true });
    for (let deg = -45, n = 0; deg <= 45; deg += 3, n++) {
      await page.evaluate((d) => (window as unknown as W).__townHeading(d), deg);
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${process.env.ROT_FRAMES}/${project}-${String(n).padStart(3, "0")}.png` });
    }
  }
  await page.evaluate(() => (window as unknown as W).__townHeading(null));
});

/** The north edge's stills (Eric's second look: from the park; from Colosseum Row looking north; the plaza close; beside it looking west and
 * east; a gate; Meadow Street; the overview). */
test("stills: the north edge", async ({ page }) => {
  test.skip(!STILLS || !STILLS.includes("north-edge"), "stills only (STILLS=docs/street-north-edge)");
  test.setTimeout(600_000);
  mkdirSync(STILLS!, { recursive: true });
  const project = test.info().project.name;
  const shot = async (name: string) => {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${STILLS}/${name}-${project}.png` });
  };
  const turn = async (deg: number | null) => page.evaluate((d) => (window as unknown as W).__townHeading(d), deg);
  await open(page);
  await walkTo(page, [22, 32]);
  await shot("1-from-the-park");
  await walkTo(page, [22, 37]);
  await shot("2-from-colosseum-row");
  await walkTo(page, [22, 40]);
  await shot("3-plaza-close");
  // Beside it, either side of the plaza: looking along its face to the ring's curve, and away along the back wall.
  await walkTo(page, [15, 42]);
  await turn(90);
  await shot("4-beside-west-looking-east");
  await turn(-90);
  await shot("4-beside-west-looking-west");
  await turn(null);
  await walkTo(page, [30, 42]);
  await turn(-90);
  await shot("5-beside-east-looking-west");
  await turn(90);
  await shot("5-beside-east-looking-east");
  await turn(null);
  await walkTo(page, [14, 42]);
  await shot("6-west-gate");
  await walkTo(page, [36, 6]);
  await shot("7-meadow-street");
  await walkTo(page, [22, 41]);
  for (let k = 0; k < 3; k++) await page.getByRole("button", { name: "Zoom out" }).click();
  await shot("8-overview");
});
