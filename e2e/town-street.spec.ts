import { mkdirSync, readFileSync, statSync } from "node:fs";
import { expect, type Page, type Route } from "@playwright/test";
import { RECLUSE_MUSIC, TOWN_BAKED_FALLBACK, TOWN_PICTURES } from "@chessroyale/core";
import { asAdmin, leaveQueue, pickMode, tapInTown, test, townHeld, townTap } from "./helpers.ts";
import type { TownManifest } from "../packages/app/src/town/manifest.ts";
import { ALL_HOMES } from "../packages/app/src/town/world.ts";
import { unpng } from "../scripts/png.ts";

/**
 * The street town, round 2: the layout (Nov 5; docs/decisions/2026-11-05-street-town-layout.md), in an admin's town only
 * (everyone's since Nov 13; was admin-only via admin-town.ts STREET_TOWN until then). On a phone and a computer: it opens zoomed in, at the start (22, 25), the camera facing
 * north; a tap on Ginger Igloo walks you down Fountain Street to its door square and its card opens; the up arrow into Smudgy's Art
 * Gallery from its door opens his card; a park table works. Since Nov 13 it is everyone's town (players and guests): the old one is gone.
 * `STILLS=docs/street-town` also writes the stills: each street, the park and a home's card.
 * Round 3 (Nov 5): the buildings are boxes and the camera turns: the turn walked on both renderers (a tap and an arrow mid-turn and
 * after, every figure on screen at rest). Round 4 (the rows, the chase camera, the plan wrapping east-west only, its rows 6 up): the
 * squares moved with the plan; the turn is the chase camera's (behind you, the way you walk); round 2's and 3's stills tests went with
 * their plans (round 4's are in e2e/town-rows.spec.ts). Round 5 (one fixed view): the chase camera's turn test went with it
 * (e2e/town-fixed.spec.ts has the fixed view, the strips and the look round). Nov 6: on WebGL only. Nov 13: never the old town (a context
 * lost for good reloads the street town once, then says so).
 */
test.use({ actionTimeout: 15_000 });

// The chat log's box lies over a corner of the map and takes taps there (as in e2e/town.spec.ts): these tests aim at the map.
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

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (A failed load names its address: Nov 13's "status of 500" on Meadow Street said nothing of which.)
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().startsWith("Failed to load resource") ? `${m.text()} (${m.location().url})` : m.text()));
  return errors;
}
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!.split(",").map(Number) as [number, number];
type Hooks = {
  __townAt?: (k: string, id?: unknown) => { x: number; y: number } | null;
  __townGlide?: (to: string | readonly [number, number]) => void;
  __townCam?: () => { zoom: number; zoomTarget: number; focus: number[] };
  __townBossBack?: (id: string) => boolean;
};

/**
 * What the GPU should hold for each picture a town's loading screen puts in place, in its order, worked out from the build's own
 * files (dist/town-pictures: order.json's list for this town, the manifest's places, the pages' pixels): each picture's size and
 * texels (its colors multiplied into its alpha, as the browser uploads them), hashed as the painter hashes what it holds
 * (paint-gl.ts `texels`, behind `__townPictureSum(true)`).
 */
function bakedTexels(kind: "player" | "admin"): number[] {
  const dir = "packages/app/dist/town-pictures";
  const order = JSON.parse(readFileSync(`${dir}/order.json`, "utf8")) as Record<"player" | "admin", number[]> & { manifest: string };
  const m = JSON.parse(readFileSync(`${dir}/${order.manifest}`, "utf8")) as TownManifest;
  const names = Object.keys(m.pictures);
  const pages = new Map<number, ReturnType<typeof unpng>>();
  return order[kind].map((i) => {
    const [f, x, y, w, h] = m.pictures[names[i]!]!;
    let pg = pages.get(f);
    if (!pg) pages.set(f, (pg = unpng(readFileSync(`${dir}/${m.files[f]!.name}`))));
    const d = pg.data;
    let k = Math.imul(Math.imul(0x811c9dc5 ^ w, 16777619) ^ h, 16777619);
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0, o = ((y + yy) * pg.w + x) * 4; xx < w; xx++, o += 4) {
        const a = d[o + 3]!;
        const pre = (c: number) => Math.round((c * a) / 255);
        k = Math.imul(k ^ (pre(d[o]!) | (pre(d[o + 1]!) << 8) | (pre(d[o + 2]!) << 16) | (a << 24)), 16777619);
      }
    return k >>> 0;
  });
}

/** The street town, an admin's, open by day (drawn with WebGL: its only drawing, Nov 6). */
async function openStreet(page: Page, query = "") {
  await asAdmin(page);
  await page.goto(`/town?sky=day${query}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
}

/** Waits until the camera's focus holds still for half a second. */
async function settled(page: Page) {
  const focus = () => page.evaluate(() => (window as unknown as Hooks).__townCam?.().focus.map((x) => x.toFixed(3)).join(","));
  let last = await focus();
  await expect(async () => {
    await page.waitForTimeout(500);
    const now = await focus();
    const same = now === last;
    last = now;
    expect(same, "the camera at rest").toBe(true);
  }).toPass({ timeout: 20_000 });
}

/** Taps a home (the camera glides to it first) until its card opens. */
async function tapHome(page: Page, id: string, name: string) {
  const card = page.getByRole("dialog", { name, exact: true });
  // (Its boss to its rest square first, so a tap on the home can't land on the boss passing in front of it: its card is the boss's.)
  await expect.poll(() => page.evaluate((h) => (window as unknown as Hooks).__townBossBack?.(h) ?? false, id), { timeout: 30_000 }).toBe(true);
  // (Then the shared tap: the glide, the view held still, and the tap on the frame its point was read from, `tapInTown`.)
  return tapInTown(page, "home", id, card, { timeout: 30_000 });
}

test("the street town opens at its default zoom step, at the start (22, 25; the north edge round: 8 rows on), the camera facing north; a player's town (a guest's) is the street town too, on WebGL, from the same start (Nov 13: the old town is gone)", async ({ page }) => {
  const errors = watchErrors(page);
  // A player's town (a guest here): the street town, as an admin's (Nov 13; before, the old Canvas 2D town at (22, 17), zoomed out).
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
  expect(await you(page)).toEqual([22, 25]);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
  // An admin's: the same.
  await openStreet(page);
  expect(await you(page)).toEqual([22, 25]);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "false");
  const cam = (await page.evaluate(() => (window as unknown as Hooks).__townCam?.()))!;
  // (Round 4: the zoom is a step, 0 in .. 3 the overview; the default from the first frame, 2 since Nov 5 (Eric: "we're going with number
  // three for the default"). You open in the park: no step out.)
  expect(cam.zoom, "the default step from the first frame").toBe(2);
  expect(cam.zoomTarget).toBe(2);
  // Facing north: the camera looks up the board from behind you, its focus on your column, ahead of you (rows rising).
  expect(Math.abs(cam.focus[0]! - 22)).toBeLessThan(0.01);
  expect(cam.focus[1]!).toBeGreaterThanOrEqual(25);
  // The sky over the rooftops: the top of the world's box is sky (its blue), not a building.
  const top = await canvas(page).evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, 4).data;
    let blue = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2]! > d[i]! + 20 && d[i + 2]! > 150) blue++;
    return blue / (d.length / 4);
  });
  expect(top, "sky along the top").toBeGreaterThan(0.95);
  if (STILLS) {
    mkdirSync(STILLS, { recursive: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${STILLS}/1-park-${test.info().project.name}.png` });
  }
  expect(errors, "no page or console errors").toEqual([]);
});

test("walking down Fountain Street to Ginger Igloo's door: a tap on it walks you there, along the street, to its door square (34, 31), and its card opens", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await page.waitForTimeout(600);
  // Where you walk: every square the canvas says you're on, noted in the page as it changes (a slow frame can't skip one between reads).
  await canvas(page).evaluate((cv) => {
    const w = window as unknown as { __seen: string[] };
    w.__seen = [cv.dataset.you!];
    new MutationObserver(() => w.__seen.push(cv.dataset.you!)).observe(cv, { attributes: true, attributeFilter: ["data-you"] });
  });
  const card = await tapHome(page, "gingerbread", "Ginger Igloo");
  await expect.poll(async () => (await you(page)).join(","), { message: "at its door square", timeout: 20_000 }).toBe("34,31");
  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  // (Out of the park east, along Fountain Street: columns 33 to 36, rows 27 to 30.)
  expect(seen.some((s) => /^3[3-6],(2[7-9]|30)$/.test(s)), `along Fountain Street: ${[...new Set(seen)].join(" ")}`).toBe(true);
  await expect(card).toBeVisible();
  if (STILLS) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${STILLS}/2-fountain-street-ginger-card-${test.info().project.name}.png` });
  }
  expect(errors, "no page or console errors").toEqual([]);
});

test("Meadow Street (the north edge round: Upper Street's homes moved south): each moved home's card opens on a tap", async ({ page }) => {
  test.setTimeout(200_000);
  const errors = watchErrors(page);
  await openStreet(page);
  await page.waitForTimeout(600);
  for (const [id, name] of [["hopper", "Chub & Chirp's Grassland"], ["pig", "Wrangler's Stall"], ["moo", "Moo & Moon Meadow"], ["hollow", "Hollow Peak"]] as const) {
    const card = await tapHome(page, id, name);
    await expect(card, name).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
  }
  expect(errors, "no page or console errors").toEqual([]);
});

test("Smudgy's Art Gallery: a tap walks you to its door square (19, 16); from there the arrow toward it opens its card and you stay put", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await page.waitForTimeout(600);
  const card = await tapHome(page, "smudgy", "Smudgy's Art Gallery");
  await expect.poll(async () => (await you(page)).join(","), { message: "at its door square", timeout: 20_000 }).toBe("19,16");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  const at = await you(page);
  // (Round 4's chase camera: the key toward the gallery, north of you, is whichever the way you face makes it: up ahead, left and right
  // a quarter round.)
  const key = await towardKey(page, "N");
  await page.keyboard.down(key);
  await expect(card, `the arrow (${key}) against the gallery opens its card`).toBeVisible({ timeout: 5000 });
  await page.keyboard.up(key);
  expect(await you(page), "you didn't walk into it").toEqual(at);
  expect(errors, "no page or console errors").toEqual([]);
});

test("a boss's line starts with its bubble there (Nov 28, the town's structure, phase 2): the bubble's picture is made ahead of the line, between frames, so every frame that draws a speaking boss draws its bubble, from the line's first, and no frame uploads anything", async ({ page }) => {
  type W = { __townCam: () => { speechLine: string; speechWanted: boolean; speechBubble: boolean }; __townPaint: () => { uploads: number }; __townHush: (on: boolean) => void; __townWalk: (s: readonly [number, number]) => boolean; __townYou: () => { moving: boolean } | null; __said?: [string, boolean, boolean, number][] };
  const errors = watchErrors(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  // To Smudgy's front: he stands there, on screen, near enough to talk.
  await page.evaluate(() => (window as unknown as W).__townWalk([19, 15]));
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !(window as unknown as W).__townYou()?.moving, null, { timeout: 30_000 });
  // Every frame from here, after the town's own draw: the line being said, whether the frame drew its speaker (so had a bubble to
  // draw), whether it drew the bubble, and the frame's uploads. (The bosses' turn to talk is brought forward until one does: a boss
  // talks only once its line's bubble is made.)
  await page.evaluate(() => {
    const w = window as unknown as W;
    const said: [string, boolean, boolean, number][] = (w.__said = []);
    const f = () => {
      const c = w.__townCam();
      said.push([c.speechLine, c.speechWanted, c.speechBubble, w.__townPaint().uploads]);
      if (!said.some((l) => l[0])) w.__townHush(false);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__said!.filter((l) => l[0] && l[1]).length), { message: "frames drawing a boss as it speaks", timeout: 45_000 }).toBeGreaterThan(5);
  const said = await page.evaluate(() => (window as unknown as W).__said!);
  const lines = said.filter((l) => l[0] && l[1]);
  expect(lines.filter((l) => !l[2]).length, `frames that drew the speaker of "${lines[0]![0]}" and not its bubble (of ${lines.length})`).toBe(0);
  expect(said.reduce((n, l) => n + l[3], 0), "pictures uploaded inside a frame, the line's first frame among them").toBe(0);
  expect(errors).toEqual([]);
});

test("the screen's pixel ratio changes and comes back (a window dragged to another screen and back): the labels are made again between frames, the places the old ones left on the atlas are taken again, and your tag is drawn pixel for pixel as it was (Nov 28, the town's structure, phase 2)", { tag: "@phone-only" }, async ({ page }) => {
  type P = { resets: number; atlas: { pages: number; unkept: number; reused: number; groups: { pages: number; pictures: number; px: number }[] }; service: { waiting: number; stuck: number; evicted: number; made: number } };
  type W = { __townPaint: () => P; __townTags: () => { kind: string; x: number; y: number; w: number; h: number; made: number }[]; __townHold: (on: boolean) => void; __townHush: (on: boolean) => void; __townStill: () => void; __townBots: () => { moving: boolean }[] };
  const errors = watchErrors(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  // Nothing moving, nobody talking, the picture service at rest; then the frames held, so the same frame is read before and after.
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__townHush(true);
    w.__townStill();
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__townBots().some((b) => b.moving)), { message: "the bots at rest", timeout: 30_000 }).toBe(false);
  const paint = () => page.evaluate(() => (window as unknown as W).__townPaint());
  const atRest = (what: string) => expect.poll(async () => (await paint()).service.waiting, { message: `${what}: the picture service at rest`, timeout: 30_000 }).toBe(0);
  const ratio = () => page.evaluate(() => { const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!; return Math.round((cv.width / cv.clientWidth) * 100) / 100; });
  await atRest("as the town opens");
  await page.evaluate(() => (window as unknown as W).__townHold(true));
  /** Your tag as the canvas has it: its pixels (two device pixels round it too), hashed, and the size its picture was made at. */
  const yourTag = () =>
    page.evaluate(() => {
      const t = (window as unknown as W).__townTags().find((x) => x.kind === "you")!;
      const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!;
      const k = cv.width / cv.clientWidth;
      const d = cv.getContext("2d")!.getImageData(Math.round(t.x * k) - 2, Math.round(t.y * k) - 2, Math.round(t.w * k) + 4, Math.round(t.h * k) + 4).data;
      let h = 0x811c9dc5;
      for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i]!, 16777619);
      return { hash: h >>> 0, bytes: d.length, made: t.made };
    });
  const before = await yourTag();
  const p0 = await paint();
  expect(before.made, "your tag's picture: one, made at 12 px").toBe(12);
  expect(await ratio(), "a phone's canvas, two device pixels a CSS pixel").toBe(2);
  // To a 1x screen (a little narrower: the town reads the ratio as its box changes): each label is made again at the new ratio as it's
  // drawn there (the ones in this frame: your tag, the tags and the sky in view), the one it had drawn meanwhile.
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.width - 24, height: vp.height, deviceScaleFactor: 1, mobile: true });
  await expect.poll(ratio, { message: "the canvas at 1x" }).toBe(1);
  await atRest("at 1x");
  const p1 = await paint();
  expect(p1.service.made - p0.service.made, "pictures made again at 1x, your tag's among them").toBeGreaterThan(2);
  // And back: made again at 2x, into the places the first ones left.
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 3, mobile: true });
  await expect.poll(ratio, { message: "the canvas at 2x again" }).toBe(2);
  await atRest("back at 2x");
  const p2 = await paint();
  expect(await yourTag(), "your tag, pixel for pixel as before").toEqual(before);
  expect(p2.service.made - p1.service.made, "pictures made again at 2x").toBeGreaterThan(2);
  expect(p2.atlas.reused - p0.atlas.reused, "pictures placed where one let go had been (the 2x labels, where the first 2x ones were)").toBeGreaterThan(0);
  expect({ pages: p2.atlas.pages, text: p2.atlas.groups[1]!.pages }, "the atlas as deep as it was, the text on its own pages, none more").toEqual({ pages: p0.atlas.pages, text: p0.atlas.groups[1]!.pages });
  expect({ stuck: p2.service.stuck, evicted: p2.service.evicted, unkept: p2.atlas.unkept, resets: p2.resets }, "none waited for room, none was let go for it, no page started again").toEqual({ stuck: 0, evicted: 0, unkept: 0, resets: 0 });
  expect(errors).toEqual([]);
});

test("a park table: a tap on the one ahead on your left walks you to a free stool and you sit; its card shows 'Ranked' (Nov 27: live) and 'Casual' greyed; a tap elsewhere closes it and you stand", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  // The park's fourth table, (19, 31), ahead on your left past the fountain: its stools (18, 31) and (20, 31). (The one on your row,
  // (19, 26), has a home's edge chip over it on a phone.)
  // (The tap on the frame its point came from: `townTap`, Nov 14.)
  expect(await townTap(page, "table", 3), "the table is drawn at the start").toBe(true);
  const cv = (await canvas(page).boundingBox())!;
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Ranked", exact: true })).toBeEnabled();
  await expect(card.getByRole("button", { name: "Casual", exact: true })).toBeDisabled();
  await expect.poll(async () => (await you(page)).join(","), { message: "you walk to a stool", timeout: 5000 }).toMatch(/^(18|20),31$/);
  await expect(canvas(page)).toHaveAttribute("data-sit", "1");
  const stool = (await you(page)).join(",");
  await page.mouse.click(cv.x + cv.width * 0.3, cv.y + cv.height * 0.85);
  await expect(card).toBeHidden();
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  expect((await you(page)).join(","), "you stand on the stool's square").toBe(stool);
  expect(errors, "no page or console errors").toEqual([]);
});

// ---- Round 3 (Nov 5): the buildings as boxes and the turning camera (docs/decisions/2026-11-05-street-town-boxes.md).

type Cam = { heading: number; headingTo: number };
const cam = async (page: Page) => (await page.evaluate(() => (window as unknown as { __townCam: () => Cam }).__townCam()))!;
/** The arrow key that walks you toward `dir` (N, E, S or W) as the camera faces now (round 5: north but on a home's strip). */
async function towardKey(page: Page, dir: "N" | "E" | "S" | "W") {
  const h = (await cam(page)).headingTo;
  const q = ((Math.round(h / 90) % 4) + 4) % 4;
  const d = { N: 0, E: 1, S: 2, W: 3 }[dir];
  return ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"][(d - q + 4) % 4]!;
}

// (Round 5: "the boxes and the chase camera's turn" went with the chase camera: e2e/town-fixed.spec.ts walks the one fixed view, a
// home's strip and the look round, on both renderers.)

test("Alfil's Pyramid (Eric, Nov 12: \"more grace\"): a tap on the half-hidden tile in front of his door, the sidewalk before it, the building's bottom edge or your own pawn at his door walks you to his door and the Go in card shows", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openStreet(page);
  // (His boss to his rest square at the far end of his box, so the taps land on the building, not on him.)
  await expect.poll(() => page.evaluate(() => (window as unknown as Hooks).__townBossBack?.("alfil") ?? false), { timeout: 30_000 }).toBe(true);
  const card = page.getByRole("dialog", { name: "Alfil's Pyramid", exact: true });
  /** Two rows out in South Street, before his door (open ground: a tap there is a square), the camera at rest. */
  const stepBack = async () => {
    await page.evaluate(() => (window as unknown as { __townWalk?: (sq: readonly [number, number]) => boolean }).__townWalk?.([37, 14]));
    await expect.poll(async () => (await you(page)).join(","), { timeout: 30_000 }).toBe("37,14");
    await settled(page);
  };
  const pickAt = (x: number, y: number) => page.evaluate(([x, y]) => (window as unknown as { __townPick?: (x: number, y: number) => { key: string } | null }).__townPick?.(x, y)?.key ?? null, [x, y] as const);
  const tapAt = async (x: number, y: number) => {
    const cv = (await canvas(page).boundingBox())!;
    if (isMobile) await page.touchscreen.tap(cv.x + x, cv.y + y);
    else await page.mouse.click(cv.x + x, cv.y + y);
  };
  const arrives = async (what: string) => {
    await expect(card, `${what}: the card`).toBeVisible({ timeout: 5000 });
    await expect(card.getByRole("button", { name: "Go in" })).toBeVisible();
    // (His door square (37, 16), or the one beside it if someone stands there.)
    await expect.poll(async () => { const [c, r] = await you(page); return r === 16 && Math.abs(c - 37) <= 1; }, { message: `${what}: at his door`, timeout: 20_000 }).toBe(true);
    await expect(card, `${what}: the card stays`).toBeVisible();
  };
  await stepBack();
  // Before: a square two rows out is only a square.
  const open = (await page.evaluate(() => (window as unknown as Hooks).__townAt?.("tap-square", [37, 14]) ?? null))!;
  expect(await pickAt(open.x, open.y), "two rows out: a square").toBe("sq:37,14");
  // 1. The tile in front of his door his picture half hides (the front of his lot's first row, 37, 17).
  // (Each point read and tapped with the town's frames held, `townHeld`: the frame on screen when the tap comes is the one the point was
  // read from, so nobody walks onto it in between. Nov 14, round 5: the tap's mechanics only.)
  await townHeld(page, async () => {
    const tile = (await page.evaluate(() => (window as unknown as Hooks).__townAt?.("tap-square", [37, 17]) ?? null))!;
    expect(tile, "the half-hidden tile drawn").not.toBeNull();
    expect(await pickAt(tile.x, tile.y), "the half-hidden tile").toBe("home:alfil");
    await tapAt(tile.x, tile.y);
  });
  await arrives("the half-hidden tile");
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // 2. The ground right in front of it: the sidewalk square beside his door square (a plain square until Nov 12).
  await stepBack();
  await townHeld(page, async () => {
    const foot = (await page.evaluate(() => (window as unknown as Hooks).__townAt?.("tap-square", [38, 16]) ?? null))!;
    expect(foot, "the sidewalk before his door drawn").not.toBeNull();
    expect(await pickAt(foot.x, foot.y), "the sidewalk before his door").toBe("home:alfil");
    await tapAt(foot.x, foot.y);
  });
  await arrives("the sidewalk before his door");
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  // 3. The building's bottom edge: 3 px above its front's foot, at his door (the steps' foot).
  await stepBack();
  await townHeld(page, async () => {
    // (His box: the home whose front's foot spans his door's column.)
    const box = (await page.evaluate(() =>
      (window as unknown as { __townCam?: () => { boxes: { kind: string; foot: number[] | null }[] } }).__townCam?.().boxes.find((b) => b.kind === "home" && !!b.foot && Math.min(b.foot[6]!, b.foot[8]!) < 37.5 && Math.max(b.foot[6]!, b.foot[8]!) > 37.5) ?? null,
    ))!;
    expect(box?.foot, "his front drawn").toBeTruthy();
    const [x0, y0, x1, y1, , , wx0, , wx1] = box.foot!;
    const s = (37.5 - wx0!) / (wx1! - wx0!);
    const edge = { x: x0! + s * (x1! - x0!), y: y0! + s * (y1! - y0!) - 3 };
    expect(await pickAt(edge.x, edge.y), "the bottom edge").toBe("home:alfil");
    await tapAt(edge.x, edge.y);
  });
  await arrives("the bottom edge");
  // 4. Standing at his door, your own pawn over the tile in front of it: a tap there is still his (Eric's screenshot).
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await townHeld(page, async () => {
    const under = (await page.evaluate(() => (window as unknown as { __townCam?: () => { you: { x0: number; y0: number; x1: number; y1: number } | null } }).__townCam?.().you ?? null))!;
    expect(under, "your pawn drawn").not.toBeNull();
    const mid = { x: (under.x0 + under.x1) / 2, y: under.y0 + 0.4 * (under.y1 - under.y0) };
    expect(await pickAt(mid.x, mid.y), "a tap on you at his door").toBe("home:alfil");
    await tapAt(mid.x, mid.y);
  });
  await expect(card, "a tap on you at his door: the card").toBeVisible({ timeout: 5000 });
  if (STILLS) await page.screenshot({ path: `${STILLS}/alfil-door-tap-${test.info().project.name}.png` });
  expect(errors, "no page or console errors").toEqual([]);
});

test("the street town's WebGL context lost: nothing drawn until it's back, then it draws again, twice in a minute too; not back, the street town reloads once (never today's town); not back again, \"The town didn't load. Please retry.\" with Retry (Nov 13, Eric's rule)", async ({ page }) => {
  test.setTimeout(200_000);
  await openStreet(page);
  const lose = (restore: boolean) =>
    page.evaluate(async (restore) => {
      const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!;
      const ext = (cv.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!;
      const lost = new Promise((ok) => cv.addEventListener("webglcontextlost", ok, { once: true }));
      ext.loseContext();
      await lost;
      if (restore) {
        // (Restoring is allowed once the lost event's dispatch is over.)
        await new Promise((ok) => setTimeout(ok, 50));
        const back = new Promise((ok) => cv.addEventListener("webglcontextrestored", ok, { once: true }));
        ext.restoreContext();
        await back;
      }
    }, restore);
  type P = { __townPaint: () => { backend: string; lost: boolean } };
  const paint = () => page.evaluate(() => (window as unknown as P).__townPaint());
  const colors = () =>
    canvas(page).evaluate((cv: HTMLCanvasElement) => {
      const d = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return seen.size;
    });
  // (A mark on this page: gone once the page has loaded again.)
  const mark = () => page.evaluate(() => void ((window as unknown as { __mark?: number }).__mark = 1));
  // (Read while the page may be loading again: a read the reload cuts off is the old page gone, so its mark too. Main's run, Nov 15:
  // the poll's read landed mid-reload, threw "Execution context was destroyed", and expect.poll doesn't retry a throw.)
  const marked = () =>
    page.evaluate(() => (window as unknown as { __mark?: number }).__mark === 1).catch((e: Error) => {
      if (/Execution context was destroyed|navigation/.test(e.message)) return false;
      throw e;
    });
  await mark();
  for (let i = 0; i < 2; i++) {
    await lose(true);
    // Back: drawing again with WebGL (its textures made again), the world not blank, still the street town, the same page.
    await expect.poll(async () => (await paint())?.lost, { message: "back" }).toBe(false);
    expect((await paint())!.backend).toBe("webgl");
    expect(await colors(), "the world drawn again with WebGL").toBeGreaterThan(40);
    expect(await you(page)).toEqual([22, 25]);
  }
  expect(await marked(), "lost twice within a minute and back each time: no reload").toBe(true);
  // Lost and not back within 5 s: the street town loads again (the same address, never `?street=off`), drawn with WebGL.
  await lose(false);
  await expect.poll(marked, { timeout: 30_000, message: "reloaded" }).toBe(false);
  expect(page.url()).not.toMatch(/street=off/);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
  expect(await you(page), "the street town").toEqual([22, 25]);
  await expect(page.locator(".town-broken")).toHaveCount(0);
  // Not back again soon after: no second reload; the town's box says so, with a Retry button, and nothing else.
  await mark();
  await lose(false);
  const box = page.locator(".town-broken");
  await expect(box).toBeVisible({ timeout: 15_000 });
  await expect(box).toHaveText(/^The town didn't load\. Please retry\.\s*Retry$/);
  expect(await marked(), "no second reload").toBe(true);
  if (STILLS) await page.screenshot({ path: `${STILLS}/town-didnt-load-${test.info().project.name}.png` });
  // Retry loads the street town again.
  await box.getByRole("button", { name: "Retry" }).click();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "webgl");
  await expect(box).toHaveCount(0);
});

/**
 * The context lost while the town is still loading (Nov 28, phase 1c): the load waits for it and goes on, and the town shows with
 * everything the loading screen keeps on the GPU, as an undisturbed load has it: nothing left to upload in a frame as it first shows.
 * (The files' decoded copies are let go once uploaded, so nothing could be uploaded later from them; and until phase 1c a picture
 * handed to the painter during the loss, the labels', was dropped and uploaded as it first showed.)
 */
test("the WebGL context lost while the town loads, at either step of its loading screen: the load goes on once it's back, and everything it keeps is on the GPU as on an undisturbed load (Nov 28)", { tag: "@phone-only" }, async ({ page }) => {
  type W = { __townPaint: () => { lost: boolean; pictures: { baked: boolean; open: boolean }; atlas: { pages: number; unkept: number; groups: { pictures: number }[] }; service: { stuck: number } }; __townPictureSum: (each: boolean) => { each: number[] }; __lostAt?: string };
  const errors = watchErrors(page);
  // (Loses the context the first frame the loading card names step `__loseAt`, its bar past 15% for the first; back 400 ms later.)
  await page.addInitScript(() => {
    const w = window as unknown as W;
    const f = () => {
      const note = document.querySelector(".town-loading .boss-loading-note")?.textContent ?? "";
      const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas");
      const share = Number(document.querySelector(".town-loading [role=progressbar]")?.getAttribute("aria-valuenow") ?? 0);
      const want = sessionStorage.getItem("loseAt");
      if (want && cv && note.startsWith(want) && (want === "Building" || share > 15)) {
        const ext = (cv.getContext("webgl2") as WebGL2RenderingContext | null)?.getExtension("WEBGL_lose_context");
        w.__lostAt = note;
        ext?.loseContext();
        setTimeout(() => ext?.restoreContext(), 400);
        return;
      }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  const load = async (loseAt: string | null) => {
    await page.goto("/version.json");
    await page.evaluate((at) => (at ? sessionStorage.setItem("loseAt", at) : sessionStorage.removeItem("loseAt")), loseAt);
    await page.goto("/town?sky=day");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
    await expect(page.locator(".town-loading")).toHaveCount(0);
    const got = await page.evaluate(() => {
      const w = window as unknown as W;
      const p = w.__townPaint();
      // (`off`: pictures of the loading screen's list not on the GPU. `atlas`: its pages, and the pictures kept on them for good.)
      // (Nov 28, phase 2: `kept` counts the town's own, the build's baked pictures. What the device makes itself is on pages of its own,
      // and how many are there by now varies a little: a boss on screen as the town opens has its next line's bubble made. Its labels
      // and its pawns and sky are all there: `made`.)
      return { lostAt: w.__lostAt ?? null, lost: p.lost, pictures: { baked: p.pictures.baked, open: p.pictures.open }, atlas: { pages: p.atlas.pages, kept: p.atlas.groups[0]!.pictures, unkept: p.atlas.unkept }, made: { labels: p.atlas.groups[1]!.pictures >= 55, looks: p.atlas.groups[2]!.pictures >= 30, stuck: p.service.stuck }, off: w.__townPictureSum(true).each.filter((k) => !k).length };
    });
    return got;
  };
  const plain = await load(null);
  expect(plain).toMatchObject({ lostAt: null, lost: false, off: 0, pictures: { baked: true, open: false }, made: { labels: true, looks: true, stuck: 0 } });
  expect(plain.atlas.kept, "pictures kept on an undisturbed load").toBeGreaterThan(2500);
  for (const step of ["Loading the town's pictures", "Building"]) {
    const got = await load(step);
    expect(got.lostAt, `the context was lost during "${step}…"`).toContain(step);
    expect({ ...got, lostAt: null }, `lost during "${step}…": the town as an undisturbed load has it`).toEqual(plain);
  }
  expect(errors).toEqual([]);
});

test("/town?report (Eric, Nov 11): it waits for your first move, records 3 s of walking and turning, and Done shows one panel with the numbers, inside the box; without ?report there's no pill and no panel", { tag: "@phone-only" }, async ({ page }) => {
  type R = { __townReport: () => { state: string; frames: number; summary: { frames: number; p50: number; segs: { name: string; frames: number }[]; worst: unknown[] } | null } | null; __townHeading: (d: number | null) => void; __townWalk: (s: readonly [number, number]) => boolean };
  const errors = watchErrors(page);
  const pill = page.locator(".tfr-pill");
  const panel = page.getByRole("dialog", { name: "Town frame report" });
  await openStreet(page);
  await page.waitForTimeout(1000);
  await expect(pill).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as R).__townReport())).toBeNull();
  await openStreet(page, "&report");
  await expect(pill).toContainText("Report: walk or turn to start");
  await expect(pill.getByRole("button", { name: "Done" })).toBeDisabled();
  await page.waitForTimeout(500);
  expect((await page.evaluate(() => (window as unknown as R).__townReport()))!.state).toBe("wait");
  // Walking (1.5 s), then turning on the spot (1.5 s, 120° a second).
  await page.evaluate(() => (window as unknown as R).__townWalk([4, 25]));
  await expect(pill).toContainText(/● Recording \d+ s/);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const w = window as unknown as R & { __spin?: boolean };
    let h = 0;
    let last = performance.now();
    w.__spin = true;
    const f = (now: number) => {
      if (!w.__spin) return;
      h += (120 * (now - last)) / 1000;
      last = now;
      w.__townHeading(h);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await page.waitForTimeout(1500);
  await pill.getByRole("button", { name: "Done" }).click();
  await page.evaluate(() => ((window as unknown as { __spin: boolean }).__spin = false));
  await expect(panel).toBeVisible();
  const rep = (await page.evaluate(() => (window as unknown as R).__townReport()))!;
  expect(rep.state).toBe("done");
  const s = rep.summary!;
  expect(s.frames, "frames recorded").toBeGreaterThan(10);
  expect(s.p50).toBeGreaterThan(0);
  const seg = (n: string) => s.segs.find((g) => g.name === n)!.frames;
  expect(seg("Walk"), "walking frames").toBeGreaterThan(0);
  expect(seg("Turn"), "turning frames").toBeGreaterThan(0);
  expect(s.worst.length).toBe(Math.min(10, s.frames));
  // The panel: the device line, the frame rates, a row a part with numbers, the worst frames; all inside the world's box, nothing cut.
  await expect(panel.locator(".tfr-dev")).toContainText(/ratio \d(\.\d+)? \(drawn \d(\.\d+)?\) · \d+×\d+ px · WebGL · /);
  await expect(panel.locator(".tfr-fps b").first()).toHaveText(/^\d+$/);
  // (21 since Nov 27: "Outside our code" split into "Waiting for the screen" and "Stalls outside our code", town-hitches-2.)
  await expect(panel.locator(".tfr-parts tbody tr")).toHaveCount(21);
  await expect(panel.locator(".tfr-parts tbody tr").filter({ hasText: "New pictures" }).locator("td").nth(1)).toHaveText(/^\d+(\.\d)?$/);
  await expect(panel.locator(".tfr-worst li")).toHaveCount(s.worst.length);
  if (STILLS) {
    mkdirSync(STILLS, { recursive: true });
    await page.screenshot({ path: `${STILLS}/report-${test.info().project.name}.png` });
  }
  const fit = await panel.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, r: el.getBoundingClientRect(), box: el.parentElement!.getBoundingClientRect() }));
  expect(fit.sh, "the panel's content fits it").toBeLessThanOrEqual(fit.ch + 1);
  expect(fit.r.bottom).toBeLessThanOrEqual(fit.box.bottom + 0.5);
  expect(fit.r.right).toBeLessThanOrEqual(fit.box.right + 0.5);
  // Close: the panel goes; the town goes on.
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the town's loading screen (Eric, Nov 11: \"loads it all in at once and then it stays there\"): its bar fills and goes, then walking across the town at night among the bots and a crowd's tags (Nov 26), a full turn and zooming in and out paint nothing new, upload nothing (Nov 25) and start no atlas page again, on a first visit and a second (both load the build's baked pictures, Nov 28); a lost context brings the card back until every picture is on the GPU again", { tag: "@phone-only" }, async ({ page }) => {
  type R = { __townReport: () => { state: string; summary: { frames: number; bakes: number; resets: number; uploads: number; uploadsBy: [string, number][]; between: { made: number; ups: number } } | null } | null; __townTags: () => { text: string; size: number; made: number }[]; __townYou: () => { moving: boolean } | null; __townHeading: (d: number | null) => void; __townWalk: (s: readonly [number, number]) => boolean; __townHush: (on: boolean) => void; __townChips: () => { faces: number }; __townPaint: () => { loading: boolean; lost: boolean; resets: number; atlas: { kept: number; keptPages: number; unkept: number; groups: { pages: number; pictures: number; px: number }[] }; service: { ready: number[]; waiting: number; stuck: number; evicted: number }; pictures: { baked: boolean; open: boolean; count: number } } };
  const errors = watchErrors(page);
  const bar = page.locator(".town-loading").getByRole("progressbar", { name: "Loading Chess Town" });
  // The bar's share as it shows (sampled every frame until it goes): it only goes up. And the step named under it (Nov 14), each new one.
  await page.addInitScript(() => {
    const seen: number[] = ((window as unknown as { __bar: number[] }).__bar = []);
    const steps: string[] = ((window as unknown as { __steps: string[] }).__steps = []);
    const f = () => {
      const v = document.querySelector(".town-loading [role=progressbar]")?.getAttribute("aria-valuenow");
      if (v !== null && v !== undefined) seen.push(Number(v));
      const step = document.querySelector(".town-loading .boss-loading-note")?.textContent;
      if (step && steps.at(-1) !== step) steps.push(step);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await asAdmin(page);
  // (At night, Nov 26: Eric's laptop's 1,211 uploads in 16.7 s of walking were the windows' lights, each baked and uploaded as it first
  // shone; by day none shine. A crowd: more tags than the bots'. A run of 120 s, not the report's 30 (Nov 26): the town's steps are
  // capped at 0.1 s, so on a CI runner drawing two software-WebGL towns at once, at 4 fps, the roam took 40 s, the run ended itself
  // and Done was greyed; every frame of the roam is recorded now, checked below as Done is pressed.)
  const at = "/town?sky=night&crowd=12&report=120";
  await page.goto(at);
  await expect(bar).toBeVisible({ timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(page.locator(".town-loading")).toHaveCount(0);
  const shares = await page.evaluate(() => (window as unknown as { __bar: number[] }).__bar);
  expect(shares.length, "the bar showed").toBeGreaterThan(0);
  expect(shares.every((v, i) => i === 0 || v >= shares[i - 1]!), `the bar only goes up: ${shares.join(",")}`).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __steps: string[] }).__steps), "its steps, named in order").toEqual(["Loading the town's pictures…", "Building the town…"]);
  const paint = await page.evaluate(() => (window as unknown as R).__townPaint());
  expect(paint.loading).toBe(false);
  expect(paint.atlas.kept, "the town's pictures kept").toBeGreaterThan(1000);
  expect(paint.atlas.unkept, "all of them").toBe(0);
  // (Nov 28, phase 2) What the device makes itself comes through the picture service, onto atlas pages of its own: the labels (group
  // 1) and the pawns, outfits and sky (group 2), all there before the first frame. The text is one picture a name, scaled by the GPU:
  // on a phone 8.7 million pixels until then (a picture for each of a tag's five sizes and a name's nine), about 1.5 million now with
  // this crowd's tags.
  expect(paint.atlas.groups[1]!.pictures, "the labels' pictures, on their own pages").toBeGreaterThan(40);
  expect(paint.atlas.groups[2]!.pictures, "the pawns', outfits' and sky's pictures, on theirs").toBeGreaterThan(10);
  // (A 1x screen keeps a picture for every size a label shows at, `picOneSizeFrom`: scaled down there, small text goes dim.)
  const oneSize = test.info().project.name === "phone";
  expect(paint.atlas.groups[1]!.px, "the text's pixels").toBeLessThan(oneSize ? 2_500_000 : 4_500_000);
  expect({ stuck: paint.service.stuck, evicted: paint.service.evicted }, "none waited for room, none was let go to make any").toEqual({ stuck: 0, evicted: 0 });
  const tags = (await page.evaluate(() => (window as unknown as R).__townTags())).filter((t) => t.made);
  expect(tags.length, "tags drawn in the first frame").toBeGreaterThan(0);
  if (oneSize) expect([...new Set(tags.map((t) => t.made))], `every tag from its one picture, made at 12 px, drawn at ${[...new Set(tags.map((t) => t.size))].sort().join(", ")}`).toEqual([12]);
  else expect(tags.filter((t) => t.made !== t.size), "on a 1x screen every tag from a picture made at the size it's drawn at").toEqual([]);
  // (Nov 28, phase 1) None of them painted here: the build's baked files, fetched and uploaded whole (town/baked.ts), then their decoded
  // copies let go: the GPU holds them (phase 1c).
  expect({ baked: paint.pictures.baked, open: paint.pictures.open }, "the first visit loads the build's baked pictures, and lets their decoded files go once uploaded").toEqual({ baked: true, open: false });
  expect(paint.pictures.count, "pictures the loading screen put in place").toBeGreaterThan(2000);
  // Walking, then a full turn on the spot (360° in about 2 s), then zooming in and out: nothing painted, nothing uploaded (Eric's laptop,
  // Nov 25: "1063 uploads" in 15 s of walking, every worst frame one with uploads), no page started again. (The bosses hushed: a line
  // said is a new picture, its bubble, the one thing made as it comes.)
  const roam = async (visit: string) => {
    await page.evaluate(() => (window as unknown as R).__townHush(true));
    // Across the town (Nov 26): the square, the park, the east homes, north, round to the west (a new area's lights and tags on the way).
    for (const sq of [[24, 30], [36, 30], [39, 12], [17, 9], [5, 27]] as const) {
      await page.evaluate((s) => (window as unknown as R).__townWalk(s), sq);
      await page.waitForTimeout(300);
      await page.waitForFunction(() => !(window as unknown as R).__townYou()?.moving, null, { timeout: 8000 }).catch(() => undefined);
    }
    await page.evaluate(() => {
      const w = window as unknown as R & { __spin?: boolean };
      let h = 0;
      let last = performance.now();
      w.__spin = true;
      const f = (now: number) => {
        if (!w.__spin) return;
        h += (180 * (now - last)) / 1000;
        last = now;
        w.__townHeading(h);
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await page.waitForTimeout(2200);
    await page.evaluate(() => ((window as unknown as { __spin: boolean }).__spin = false));
    await page.evaluate(() => (window as unknown as R).__townHeading(null));
    for (const z of ["Zoom in", "Zoom out", "Zoom in"]) {
      await page.getByRole("button", { name: z, exact: true }).click();
      await page.waitForTimeout(900);
    }
    expect((await page.evaluate(() => (window as unknown as R).__townReport()))!.state, `${visit}: still recording as the roam ends (all of it in the run)`).toBe("rec");
    await page.locator(".tfr-pill").getByRole("button", { name: "Done" }).click();
    const s = (await page.evaluate(() => (window as unknown as R).__townReport()))!.summary!;
    expect(s.frames, `${visit}: frames recorded`).toBeGreaterThan(10);
    expect(s.bakes, `${visit}: pictures painted after the loading screen`).toBe(0);
    expect(s.uploads, `${visit}: pictures uploaded after the loading screen (${(s.uploadsBy ?? []).map(([k, n]) => `${k} ${n}`).join(", ")})`).toBe(0);
    expect(s.resets, `${visit}: atlas pages started again`).toBe(0);
    const after = await page.evaluate(() => (window as unknown as R).__townPaint());
    expect(after.resets).toBe(0);
    // (Nov 28, phase 2) What the roam did need made, a boss's next line's bubble as it came on screen, was made and uploaded between
    // frames by the picture service (never in one: `uploads` above), with room for all of it.
    expect({ stuck: after.service.stuck, evicted: after.service.evicted, unkept: after.atlas.unkept }, `${visit}: pictures that waited for room or were let go to make some (${s.between.made} made, ${s.between.ups} uploaded between frames)`).toEqual({ stuck: 0, evicted: 0, unkept: 0 });
    // (Nov 28) The chips' faces: each place's drawn once, on a canvas of its own, however often the chips changed places on the way
    // (until then a chip's one canvas was cleared and drawn again at every change: 151 times on a walk like this one, where 15 places
    // had a chip). Every home and the Colosseum, at most.
    const faces = (await page.evaluate(() => (window as unknown as R).__townChips())).faces;
    expect(faces, `${visit}: chips' faces drawn`).toBeGreaterThan(4);
    expect(faces, `${visit}: chips' faces drawn, one a place at most`).toBeLessThanOrEqual(ALL_HOMES.length + 1);
  };
  // (Nov 25; Nov 28, phase 1c) The context lost and back: nothing is drawn until the town's pictures are on the GPU again. Its loading
  // card comes back up while its files are fetched again (their decoded copies were let go once uploaded: the service worker has them)
  // and everything is uploaded as on the loading screen. Then what the GPU holds for every picture is what it held before.
  const lossCheck = async (visit: string) => {
    type S = { __townPictureSum: (each: boolean) => { each: number[] | null } };
    const sums = () => page.evaluate(() => (window as unknown as S).__townPictureSum(true).each!);
    await page.evaluate(() => (window as unknown as { __townHold: (on: boolean) => void }).__townHold(true));
    // (Nov 28, phase 2) And what the device made itself (the labels, the pawns, the sky): the picture service's, on its own pages.
    const made = () => page.evaluate(() => (window as unknown as R).__townPaint().atlas.groups.slice(1).map((g) => g.pictures));
    await expect.poll(() => page.evaluate(() => (window as unknown as R).__townPaint().service.waiting), { message: `${visit}: the picture service at rest`, timeout: 15_000 }).toBe(0);
    const madeBefore = await made();
    const before = await sums();
    expect(before.every((k) => k !== 0), `${visit}: every kept picture on the GPU`).toBe(true);
    const card = await page.evaluate(async () => {
      const cv = document.querySelector<HTMLCanvasElement>("canvas.town-canvas")!;
      const ext = (cv.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!;
      const lost = new Promise((ok) => cv.addEventListener("webglcontextlost", ok, { once: true }));
      ext.loseContext();
      await lost;
      await new Promise((ok) => setTimeout(ok, 50));
      const back = new Promise((ok) => cv.addEventListener("webglcontextrestored", ok, { once: true }));
      ext.restoreContext();
      await back;
      // (The card is up from the moment the context is back, and until then every picture is off the GPU.)
      await new Promise((ok) => requestAnimationFrame(ok));
      return { card: !!document.querySelector(".town-loading [role=progressbar]"), lost: (window as unknown as R).__townPaint().lost };
    });
    expect(card, `${visit}: the context back, the loading card up again and nothing drawn yet`).toEqual({ card: true, lost: true });
    await expect.poll(() => page.evaluate(() => (window as unknown as R).__townPaint().lost), { message: `${visit}: the pictures on the GPU again`, timeout: 30_000 }).toBe(false);
    await expect(page.locator(".town-loading")).toHaveCount(0);
    expect(await sums(), `${visit}: every picture on the GPU again, as before the context was lost`).toEqual(before);
    expect(await made(), `${visit}: and every picture the device made, uploaded again under the card`).toEqual(madeBefore);
    expect((await page.evaluate(() => (window as unknown as R).__townPaint())).pictures.open, `${visit}: the files' decoded copies let go again`).toBe(false);
    await page.evaluate(() => (window as unknown as { __townHold: (on: boolean) => void }).__townHold(false));
  };
  await roam("the first visit");
  await lossCheck("the first visit");
  // The second visit: the same files (the service worker's kept copies now), uploaded whole again (paint-gl.ts `adopt`), and the labels
  // made again; the same.
  await page.goto(at);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  expect((await page.evaluate(() => (window as unknown as R).__townPaint())).pictures.baked, "the second visit loads the baked pictures too").toBe(true);
  await roam("the second visit");
  await lossCheck("the second visit");
  expect(errors).toEqual([]);
});

/**
 * The build's baked town, kept by the service worker (Nov 28, phase 1b: sw-template.js TOWN_FILE, town/baked-files.ts). Home fetches
 * this town's files when idle, before any visit to the town; they're in the worker's cache then, each under its contents' name, and the
 * town loads them.
 */
test("home fetches Chess Town's baked pictures when idle and the service worker keeps them (Nov 28): none while its queue shows; then every file of a player's town in the worker's cache before the town opens; then the town loads them", { tag: "@phone-only" }, async ({ page }) => {
  const errors = watchErrors(page);
  const pngs: string[] = [];
  page.on("request", (r) => void (/\/town-pictures\/[^/]+\.png$/.test(r.url()) && pngs.push(r.url())));
  // Home with its queue showing (50 v 50's lobby, people only so it waits; a boss battle's lobby, a match loading and a 1 v 1's search
  // are the same: home's frame with the queue in it): the network is the match's, and none is fetched ahead however long it shows (the
  // review of phase 1b, S1). The worker is answering the page by then (a first visit: after its own files are in), which is what the
  // fetch waits for, never a time (S4).
  await page.addInitScript(() => localStorage.setItem("brc.matchmaking", "botsoff"));
  await page.goto(`/?nolanding&pool=bk${Math.random().toString(36).slice(2, 9)}`);
  await pickMode(page, "50 v 50");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await page.getByRole("checkbox", { name: "Keep me in the queue" }).waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 60_000 });
  // (The moment home's own effects take to stop, then everything from here on.)
  await page.waitForTimeout(500);
  pngs.length = 0;
  await page.waitForTimeout(TOWN_PICTURES.homeFetchAfterMs + 3000);
  expect(pngs, "fetched ahead while the queue showed").toEqual([]);
  await leaveQueue(page);
  await page.getByRole("main").getByRole("button", { name: "Chess Town", exact: true }).first().waitFor({ timeout: 60_000 });
  // The files this town draws from (the manifest, by the name order.json gives; its sidekicks' frames among them since phase 1c).
  const kept = () =>
    page.evaluate(async () => {
      const order = (await (await fetch("/town-pictures/order.json")).json()) as { manifest: string };
      const m = (await (await fetch(`/town-pictures/${order.manifest}`)).json()) as { files: { name: string; towns: string[] }[] };
      const want = [order.manifest, ...m.files.filter((f) => f.towns.includes("player")).map((f) => f.name)];
      let n = 0;
      for (const name of want) if (await caches.match(`/town-pictures/${name}`)) n++;
      return { want: want.length, kept: n, admins: (await Promise.all(m.files.filter((f) => !f.towns.includes("player")).map((f) => caches.match(`/town-pictures/${f.name}`)))).filter(Boolean).length };
    });
  // (Home's fetch starts TOWN_PICTURES.homeFetchAfterMs after it shows, a file at a time, each through the worker: all of them kept.)
  await expect.poll(async () => ((k) => k.want - k.kept)(await kept()), { message: "files of a player's town, and the manifest, not in the worker's cache yet", timeout: 60_000, intervals: [1000] }).toBe(0);
  const all = await kept();
  expect(all.want).toBeGreaterThan(44);
  expect(all.admins, "none of an admin's town's own files").toBe(0);
  // (Each once at most: home never asks again for a file this page has read.)
  expect(new Set(pngs).size, "each page fetched ahead once").toBe(pngs.length);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
  const pictures = await page.evaluate(() => (window as unknown as { __townPaint: () => { pictures: { baked: boolean; files: number } } }).__townPaint().pictures);
  expect(pictures, "the town loaded them").toMatchObject({ baked: true, files: all.want - 1 });
  expect(errors).toEqual([]);
});

// (Its own service worker blocked: page.route sees only what the page fetches itself, never what a worker answers.)
test.describe(() => {
  test.use({ serviceWorkers: "block" });

  /**
   * The town loads the build's baked pictures, and only those (Nov 28, the town's structure, phase 1: scripts/bake-town.ts, town/baked.ts;
   * docs/decisions/2026-11-28-town-load-baked.md, 2026-11-28-town-no-device-painting.md). What the GPU holds for every picture the
   * loading screen put in place is the build's own file's pixels (`bakedTexels`: worked out here from dist/town-pictures; that those
   * are the painting code's, packages/app/test/town-bake.test.ts). Nothing is painted on the device since phase 1c: a file that fails
   * once is asked for again and the town loads; one that keeps failing, and the card says the town didn't load, with Retry.
   */
  for (const kind of ["player", "admin"] as const)
    test(`the town loads the build's baked pictures (Nov 28): ${kind === "admin" ? "an admin" : "a player"}'s town its own files alone, its sidekicks' frames among them, and what the GPU holds for each picture is its file's pixels; a file that fails once is asked for again; one that keeps failing: "The town didn't load. Please retry." with Retry, never a half town`, { tag: "@phone-only" }, async ({ page }) => {
      type P = { __townPictureSum: (each?: boolean) => { n: number; each: number[] | null }; __townPaint: () => { pictures: { baked: boolean; files: number; bytes: number; open: boolean }; atlas: { unkept: number } } };
      const errors = watchErrors(page);
      if (kind === "admin") await asAdmin(page);
      // (The town this device saved before the build baked its pictures, and its tops: let go once a baked load is in. S5.)
      const saved = () =>
        page.evaluate(
          () =>
            new Promise<{ pictures: boolean; tops: boolean }>((ok) => {
              const q = indexedDB.open("hunchess-town", 1);
              q.onupgradeneeded = () => q.result.createObjectStore("pictures");
              q.onsuccess = () => {
                const g = q.result.transaction("pictures").objectStore("pictures").get("town");
                g.onsuccess = () => (q.result.close(), ok({ pictures: g.result !== undefined, tops: localStorage.getItem("brc.townTops") !== null }));
              };
            }),
        );
      if (kind === "player") {
        await page.goto("/version.json");
        await page.evaluate(
          () =>
            new Promise<void>((ok) => {
              localStorage.setItem("brc.townTops", JSON.stringify({ key: "old", tops: [1] }));
              const q = indexedDB.open("hunchess-town", 1);
              q.onupgradeneeded = () => q.result.createObjectStore("pictures");
              q.onsuccess = () => {
                const tx = q.result.transaction("pictures", "readwrite");
                tx.objectStore("pictures").put({ manifest: { key: "old" }, blobs: [] }, "town");
                tx.oncomplete = () => (q.result.close(), ok());
              };
            }),
        );
        expect(await saved()).toEqual({ pictures: true, tops: true });
      }
      // (Why the town didn't load: said once a page, in the request an error goes in. S3.)
      const reported: string[] = [];
      page.on("request", (r) => {
        if (!r.url().endsWith("/api/problems")) return;
        for (const e of (JSON.parse(r.postData() ?? "{}") as { errors?: { kind: string; message: string }[] }).errors ?? []) if (e.kind === TOWN_BAKED_FALLBACK.kind) reported.push(e.message);
      });
      const pngs: string[] = [];
      /** A file that fails: `times` requests of it (Infinity: every one). */
      const fail = { name: "", times: 0 };
      await page.route("**/town-pictures/*.png", (route) => {
        const name = route.request().url().split("/").pop()!;
        pngs.push(name);
        return name === fail.name && fail.times-- > 0 ? route.abort() : route.continue();
      });
      const ready = () => expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 60_000 });
      // The baked files, loaded: this town's alone, its sidekicks' frames among them (a file a sidekick), none painted on the device.
      await page.goto("/town?sky=day");
      await ready();
      const paint = await page.evaluate(() => (window as unknown as P).__townPaint());
      expect(paint.pictures, "the town loaded the build's baked pictures, and let their decoded files go once uploaded").toMatchObject({ baked: true, open: false });
      expect(paint.pictures.files, "files fetched").toBe(pngs.length);
      expect(paint.pictures.files, "files fetched").toBeGreaterThan(20);
      expect(pngs.filter((n) => n.includes(kind === "admin" ? ".player." : ".admin.")), "files only the other town draws").toEqual([]);
      // (The ladder's fourteen; an admin's town has Rivet's and Tick's too, the admins-first bosses' kids.)
      expect(pngs.filter((n) => n.startsWith("sidekick-")).length, "the sidekicks' frames: a file each").toBe(kind === "admin" ? 16 : 14);
      expect(pngs.filter((n) => n.startsWith("sidekick-timber.")).length, "Rivet's, Timber's kid").toBe(kind === "admin" ? 1 : 0);
      expect(paint.atlas.unkept, "pictures the atlas couldn't keep").toBe(0);
      if (kind === "player") await expect.poll(saved, { message: "the town this device saved before, let go" }).toEqual({ pictures: false, tops: false });
      // What the GPU holds for every picture the loading screen put in place, in its order: the build's files' pixels.
      const want = bakedTexels(kind);
      const got = (await page.evaluate(() => (window as unknown as P).__townPictureSum(true))).each!;
      expect(want.length, "pictures the loading screen put in place").toBeGreaterThan(2000);
      expect(got.length, "as many as the build's list for this town").toBe(want.length);
      expect(got.flatMap((k, i) => (k === want[i] ? [] : [i])).slice(0, 5), "pictures the GPU holds otherwise than the build's files have them").toEqual([]);
      // One file failing once (a hiccup): asked for again, and the town loads all the same. Nothing to report.
      const files = [...new Set(pngs)];
      Object.assign(fail, { name: files[3]!, times: 1 });
      pngs.length = 0;
      await page.goto("/town?sky=day");
      await ready();
      expect(pngs.filter((n) => n === fail.name).length, "the file that failed once: asked for twice").toBe(2);
      expect((await page.evaluate(() => (window as unknown as P).__townPaint())).pictures.baked).toBe(true);
      expect(reported).toEqual([]);
      // One file failing every time: asked for three times, then the town's box says it didn't load, with Retry, and nothing else:
      // never a half town (and nothing is painted here instead, as until phase 1c).
      Object.assign(fail, { name: files[5]!, times: Infinity });
      pngs.length = 0;
      await page.goto("/town?sky=day");
      const box = page.locator(".town-broken");
      await expect(box).toBeVisible({ timeout: 30_000 });
      await expect(box).toHaveText(/^The town didn't load\. Please retry\.\s*Retry$/);
      expect(pngs.filter((n) => n === fail.name).length, "the file that keeps failing: three tries").toBe(3);
      await expect(canvas(page)).not.toHaveAttribute("data-ready", "1");
      await expect(page.locator(".town-loading:not(.town-broken)")).toHaveCount(0);
      await expect.poll(() => reported, { message: "why, reported once", timeout: 15_000 }).toEqual(["file"]);
      if (STILLS) await page.screenshot({ path: `${STILLS}/town-pictures-didnt-load-${kind}-${test.info().project.name}.png` });
      // Retry, the file coming again: the town.
      fail.times = 0;
      await box.getByRole("button", { name: "Retry" }).click();
      await ready();
      await expect(box).toHaveCount(0);
      // (The requests that failed, by design.)
      expect(errors.filter((e) => !files.slice(3, 6).some((f) => e.includes(f)))).toEqual([]);
    });
  test("the town's first frame doesn't wait for the music (Eric, Nov 14: \"christ it's taking forever\"); then the town's own theme, played in the street (Nov 15), its solos, then every boss theme fetched once, one piece at a time, none decoded, but the Hidden Boss's (fetched as his fight starts); Music off fetches none", { tag: "@phone-only" }, async ({ page }) => {
    const dir = "packages/app/public/music";
    const themes = JSON.parse(readFileSync(`${dir}/themes.json`, "utf8")) as { themes: Record<string, { intro: string | null; loop: string }>; town: { loop: string; solos: { file: string }[] } };
    const town = [themes.town.loop, ...themes.town.solos.map((s) => s.file)].map((n) => `/music/${n}.mp3`);
    const hidden: string[] = Object.values(RECLUSE_MUSIC);
    // (Each file once: a loop shared by two themes, Birdie's theme and his ult's, is fetched once.)
    const names = [
      ...new Set(
        Object.entries(themes.themes)
          .filter(([k]) => !hidden.includes(k))
          .flatMap(([, t]) => (t.intro ? [t.intro, t.loop] : [t.loop])),
      ),
    ];
    const sizes = names.map((n) => statSync(`${dir}/${n}.mp3`).size);
    // (Every decode's size: a theme's would be its file's.)
    await page.addInitScript(() => {
      const w = window as unknown as { __soundLog: string[]; __decoded: number[] };
      w.__soundLog = [];
      w.__decoded = [];
      const dec = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = function (this: AudioContext, b: ArrayBuffer, ...rest: unknown[]) {
        w.__decoded.push(b.byteLength);
        return (dec as (...a: unknown[]) => Promise<AudioBuffer>).call(this, b, ...rest);
      } as typeof dec;
    });
    const gets: string[] = [];
    page.on("request", (r) => void (/^\/music\/.*\.mp3$/.test(new URL(r.url()).pathname) && gets.push(new URL(r.url()).pathname)));
    // Every piece held (never answered) until released: the town must draw its first frame all the same.
    const held: Route[] = [];
    let release = false;
    await page.route(/\/music\/.*\.mp3$/, (route) => void (release ? route.continue() : held.push(route)));
    await asAdmin(page);
    await page.goto("/town?sky=day");
    await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
    // Then, in the background, one piece at a time: the first held (the town's theme), no second asked for meanwhile.
    await expect.poll(() => held.length, { timeout: 15_000 }).toBe(1);
    await page.waitForTimeout(1000);
    expect(held.length, "one piece at a time").toBe(1);
    expect(new URL(held[0]!.request().url()).pathname, "the town's theme first").toBe(town[0]);
    release = true;
    for (const r of held.splice(0)) await r.continue();
    // The town's theme plays in the street once decoded (Nov 15).
    const townLog = () => page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog.filter((l) => l.startsWith("music:town:")));
    await expect.poll(townLog, { timeout: 30_000 }).toContain("music:town:start");
    await expect.poll(() => gets.length, { timeout: 30_000 }).toBe(town.length + names.length);
    await page.waitForTimeout(1000);
    expect(gets.slice(0, town.length), "the town's theme, then its solos, before any boss's").toEqual(town);
    expect(gets.sort(), "each piece, once").toEqual([...town, ...names.map((n) => `/music/${n}.mp3`)].sort());
    const decoded = await page.evaluate(() => (window as unknown as { __decoded: number[] }).__decoded);
    expect(decoded.filter((b) => sizes.includes(b)), "no theme decoded").toEqual([]);
    // (The town's solos: fetched, not decoded till a solo's turn nears; Nov 15, memory on phones. Since Nov 16 a third of the starts are
    // partway in, the first solo (a) under 70 s away: that one, and only it, decoded at once.)
    const soloSizes = town.slice(1).map((u) => statSync(`${dir}/${u.slice("/music/".length)}`).size);
    const early = (await townLog()).some((l) => l.startsWith("music:town:entry:"));
    const solosDecoded = async () => (await page.evaluate(() => (window as unknown as { __decoded: number[] }).__decoded)).filter((b) => soloSizes.includes(b));
    if (early) await expect.poll(solosDecoded, { timeout: 15_000, message: "only the first solo decoded" }).toEqual([soloSizes[0]]);
    else expect(decoded.filter((b) => soloSizes.includes(b)), "no solo decoded").toEqual([]);
    const log = await page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog);
    expect(log.filter((l) => l.startsWith("music:load")), "no theme loaded to play").toEqual([]);
    // Music off (Settings → Sound): none fetched.
    await page.evaluate(() => localStorage.setItem("brc.music", "0"));
    gets.length = 0;
    await page.reload();
    await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
    await page.waitForTimeout(3000);
    expect(gets, "Music off: nothing fetched").toEqual([]);
  });
});

/**
 * The Hidden Boss's building (Nov 13; docs/areas/town-square.md, "The Walk-up"), in everyone's town since Nov 13: its door, the hall (a
 * flat's door's line), up the stairs to the landing, up again to his room (the child at his game; his card's Challenge, greyed for a
 * guest: "Sign in to challenge him."; the challenge itself: hidden-boss-room.spec.ts), and back down both flights. `STILLS=<dir>` writes
 * the stills for the PR.
 */
test("the Hidden Boss's walk-up: its door, the hall, up two flights to his room, his Challenge (greyed for a guest), and back down", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  type Hooks = { __townAt?: (k: string, id: string) => { x: number; y: number } | null; __townGlide?: (to: string) => void; __shopAt?: (k: string, s?: unknown) => { x: number; y: number } | null; __shopLook?: (k: string, to?: string) => boolean };
  const room = page.locator("canvas.town-shop-canvas");
  const still = async (name: string, settle = 0) => {
    if (!STILLS) return;
    mkdirSync(STILLS, { recursive: true });
    // (Inside: after the room's name banner has gone.)
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${STILLS}/${name}-${test.info().project.name}.png` });
  };
  /** Where the room's hook says to tap (`kind`, its square or the room a door leads to), on the page; null: not on screen. */
  const shopAt = async (kind: string, s?: unknown) => {
    const xy = await page.evaluate(([k, q]) => (window as unknown as Hooks).__shopAt?.(k as string, q) ?? null, [kind, s] as const);
    const cv = xy && (await room.boundingBox());
    return xy && cv ? { x: cv.x + xy.x, y: cv.y + xy.y } : null;
  };
  /** Up or down the stairs to `to`: a tap on them walks you there, their card's button takes you through. */
  const climb = async (to: "landing" | "top" | "front", button: "Go up" | "Go down") => {
    const card = page.getByRole("dialog", { name: "Stairs", exact: true });
    await expect(async () => {
      if (await card.isVisible()) return;
      if (!(await shopAt("pass", to))) await page.evaluate((t) => (window as unknown as Hooks).__shopLook?.("pass", t), to);
      const at = await shopAt("pass", to);
      expect(at, `the stairs to ${to} on screen`).not.toBeNull();
      await page.mouse.click(at!.x, at!.y);
      await expect(card).toBeVisible({ timeout: 8000 });
    }).toPass({ timeout: 40_000 });
    await expect(card.getByRole("button")).toHaveText([button]);
    await card.getByRole("button", { name: button }).click();
    if (to === "front") await expect(room).not.toHaveAttribute("data-part", /./, { timeout: 20_000 });
    else await expect(room).toHaveAttribute("data-part", to, { timeout: 20_000 });
    await expect(room).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  };
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  // The building, on its corner of Fountain Street and Seam Avenue: its card, its name and Go in.
  await page.evaluate(() => (window as unknown as Hooks).__townGlide?.("recluse"));
  const homeAt = async () => {
    const xy = await page.evaluate(() => (window as unknown as Hooks).__townAt?.("home", "recluse") ?? null);
    const cv = xy && (await canvas(page).boundingBox());
    return xy && cv ? { x: cv.x + xy.x, y: cv.y + xy.y } : null;
  };
  await expect.poll(homeAt, { message: "the walk-up comes into view", timeout: 20_000 }).not.toBeNull();
  await page.waitForTimeout(1500);
  await still("outside");
  if (STILLS) {
    const map = page.getByRole("button", { name: "Open the map" });
    if (await map.count()) {
      await map.click();
      await page.waitForTimeout(700);
      await still("map");
      await page.keyboard.press("Escape");
    }
  }
  // (The shared tap, `tapInTown`: a tap that missed (someone walking past) walked you off and the camera followed, so every later look
  // here found the walk-up off screen; it glides back.)
  const card = await tapInTown(page, "home", "recluse", page.getByRole("dialog", { name: "The Walk-up", exact: true }));
  await expect(card.getByRole("button")).toHaveText(["Go in"]);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room).toHaveAttribute("data-room", "recluse");
  await expect(room).not.toHaveAttribute("data-part", /./);
  await expect(page.getByRole("heading", { name: "The Walk-up" })).toBeVisible();
  await still("hall", 3500);
  // A flat's door you can't open: a tap walks you to it, its card says a line, OK closes it.
  const flat = page.getByRole("dialog", { name: "Apartment door", exact: true });
  await expect(async () => {
    if (await flat.isVisible()) return;
    const at = await shopAt("square", [1, 0]);
    expect(at, "flat 1A's door on screen").not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(flat).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 30_000 });
  await expect(flat.locator(".town-card-text")).toHaveText(/\S/);
  await flat.getByRole("button", { name: "OK" }).click();
  await expect(flat).toBeHidden();
  // Up to the landing, and up again to his room.
  await climb("landing", "Go up");
  await page.waitForTimeout(800);
  await still("landing", 3500);
  await climb("top", "Go up");
  await still("room-arrive", 3500);
  // His room: a tap on his board walks you round to its front, and his card: Challenge and Cancel, greyed for a guest, who's told why.
  const his = page.getByRole("dialog", { name: "Hidden Boss", exact: true });
  await expect(async () => {
    if (await his.isVisible()) return;
    const at = await shopAt("square", [4, 4]);
    expect(at, "his board on screen").not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(his).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 30_000 });
  await expect(his.getByRole("button", { name: "Challenge" })).toBeDisabled();
  await expect(his.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await expect(his.locator(".hb-card-line")).toHaveText("Sign in to challenge him.");
  await page.waitForTimeout(800);
  await still("room", 3500);
  await page.keyboard.press("Escape");
  await expect(his).toBeHidden();
  // Back down both flights to the hall.
  await climb("landing", "Go down");
  await climb("front", "Go down");
  await expect(room).toHaveAttribute("data-room", "recluse");
  expect(errors).toEqual([]);
});

/**
 * The Battle Tower (Nov 19; docs/areas/town-square.md, "The Battle Tower"), in everyone's town: its door on Colosseum Row opens the lobby,
 * the clerk's card ("Clerk") starts your climb (Start, "Start over" greyed with no run: PR 11b, the tower's flow is battle-tower.spec.ts),
 * and Go out at the glass doors brings you back to the street. `STILLS=<dir>` writes the stills for the PR.
 */
test("the Battle Tower: its door opens the lobby, the clerk's card offers Start, and back out", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  type Hooks = { __townGlide?: (to: string) => void; __townAt?: (k: string, id: string) => { x: number; y: number } | null; __shopAt?: (k: string, s?: unknown) => { x: number; y: number } | null; __shopLook?: (k: string) => boolean };
  const room = page.locator("canvas.town-shop-canvas");
  const still = async (name: string, settle = 0) => {
    if (!STILLS) return;
    mkdirSync(STILLS, { recursive: true });
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${STILLS}/${name}-${test.info().project.name}.png` });
  };
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await page.evaluate(() => (window as unknown as Hooks).__townGlide?.("tower"));
  const homeAt = () => page.evaluate(() => (window as unknown as Hooks).__townAt?.("home", "tower") ?? null);
  await expect.poll(homeAt, { message: "the tower comes into view", timeout: 20_000 }).not.toBeNull();
  await page.waitForTimeout(1500);
  await still("tower-street");
  // Its card: its name and Go in, nothing else.
  const card = await tapInTown(page, "home", "tower", page.getByRole("dialog", { name: "Battle Tower", exact: true }));
  await expect(card.getByRole("heading")).toHaveText("Battle Tower");
  await expect(card.getByRole("button")).toHaveText(["Go in"]);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room).toHaveAttribute("data-room", "tower");
  await expect(page.getByRole("heading", { name: "Battle Tower" })).toBeVisible();
  await still("tower-lobby", 3500);
  // The clerk: a tap walks you up to the counter, and his card says "Clerk" with Start (no run yet) and "Start over" greyed.
  const clerk = page.getByRole("dialog", { name: "Clerk", exact: true });
  await expect(async () => {
    if (await clerk.isVisible()) return;
    const xy = await page.evaluate(() => (window as unknown as Hooks).__shopAt?.("keeper") ?? null);
    const cv = xy && (await room.boundingBox());
    expect(xy && cv, "the clerk on screen").toBeTruthy();
    await page.mouse.click(cv!.x + xy!.x, cv!.y + xy!.y);
    await expect(clerk).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 40_000 });
  await expect(clerk.getByRole("heading")).toHaveText("Clerk");
  await expect(clerk.getByRole("button", { name: "Start", exact: true })).toBeEnabled({ timeout: 20_000 });
  await expect(clerk.getByRole("button", { name: "Start over" })).toBeDisabled();
  await page.waitForTimeout(800);
  await still("tower-clerk");
  await page.keyboard.press("Escape");
  await expect(clerk).toBeHidden();
  // Out through the glass doors (a tap walks you there; its card's Go out): the street again.
  const door = page.getByRole("dialog", { name: "Door", exact: true });
  await expect(async () => {
    if (await door.isVisible()) return;
    // (On a computer the doors are below the room's fixed view: the view brought to them, as a drag there would.)
    if (!(await page.evaluate(() => (window as unknown as Hooks).__shopAt?.("door") ?? null))) {
      await page.evaluate(() => (window as unknown as Hooks).__shopLook?.("door"));
      await page.waitForTimeout(300);
    }
    const xy = await page.evaluate(() => (window as unknown as Hooks).__shopAt?.("door") ?? null);
    const cv = xy && (await room.boundingBox());
    expect(xy && cv, "the glass doors on screen").toBeTruthy();
    await page.mouse.click(cv!.x + xy!.x, cv!.y + xy!.y);
    await expect(door).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 40_000 });
  await door.getByRole("button", { name: "Go out" }).click();
  await expect(room).toHaveCount(0, { timeout: 20_000 });
  expect(errors).toEqual([]);
});
