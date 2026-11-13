import { expect, type Page } from "@playwright/test";
import { SHOP, bossCrateOf, discountLabel, shopPrice } from "@chessroyale/core";
import { asAdmin, asServerAdmin, asSignedIn, backdateSoloBattle, bossAloneFromHome, giveItems, tapInTown, test, townTapPoint, wearItem, townReady } from "./helpers.ts";

/**
 * Inside a shop (Nov 2, round 1; docs/areas/town-square.md, "Inside a shop"), on a phone and a computer: walk up to Babur's
 * Circus, its card's "Go in" (you walk to the door, the town zooms in on it and fades), you start inside zoomed out (the town's
 * zoomed-in camera, Eric, Nov 3; + and − switch to Close, the third-person camera, and back), a tap on the Shopkeeper walks you up to the counter and its card
 * says "Shopkeeper" with Talk, Talk opens "Babur's Boss Crate" (the price line, Balloon Pup among the prizes, what you have, and both
 * buys greyed with nothing to pay), then the door's "Go out" brings you back outside at the tent's door. Inside, the header says the
 * shop's name. And Puddles' greenhouse: Drizzle's crate, his ride, and the back button takes you out.
 * And on a ride (Nov 2): it comes in with you, and you come out still on it.
 * Round 2 (boss tokens, Nov 2): an admin gives himself Babur tokens and a crate key in the Crates tab and buys Babur's crate both
 * ways, the counts following (since Eric's Nov 2 fixes the crates go into the inventory, and he opens both there with the usual
 * strip); a drag inside follows the finger as the town's does; the chat's words take each room's tone; and a counted solo boss battle (its start pushed back in the local database: the server times it) drops
 * a token, its box on the result screen. SHOP_SHOTS=<dir>: the stills for the PR (docs/shop-r2/).
 * Test hooks: the room's canvas (`canvas.town-shop-canvas`) carries `data-room`, `data-you="c,r"` and `data-ready="1"`;
 * `window.__shopAt("keeper" | "door" | "square", [c, r]?)` says where to tap; `__shopCam()` the room's camera; `__shopRide()` your
 * ride inside (its id, the animation and frame drawn last, its side and view, the step's time).
 */
test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.SHOP_SHOTS;

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

const town = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
type Hooks = {
  __townAt?: (k: string, id: string | readonly [number, number]) => { x: number; y: number } | null;
  __shopAt?: (k: string, sq?: readonly [number, number]) => { x: number; y: number } | null;
  __shopCam?: () => { zoom: number; zoomTarget: number; room: string; focus: [number, number] } | null;
  __shopRide?: () => { ride: string | null; anim: "" | "idle" | "move"; frame: number; facing: number; view: number; stepMs: number; foot: [number, number] | null } | null;
  __townRide?: () => { you: { ride: string | null; ready: boolean; anim: string; stepMs: number } };
};

/** Where to tap a home now (in the page); null while it isn't drawn. */
async function homeAt(p: Page, id: string) {
  const xy = await p.evaluate((h) => (window as unknown as Hooks).__townAt?.("home", h) ?? null, id);
  if (!xy) return null;
  const cv = (await town(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
/** Where to tap something in the room now (in the page); null while it isn't on screen. */
async function shopAt(p: Page, kind: "keeper" | "door" | "square", sq?: readonly [number, number]) {
  const xy = await p.evaluate(([k, s]) => (window as unknown as Hooks).__shopAt?.(k as string, s as [number, number] | undefined) ?? null, [kind, sq] as const);
  if (!xy) return null;
  const cv = (await room(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
const shopCam = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopCam?.() ?? null);
/**
 * Waits until you've stopped and the room's camera rests on your square. The camera trails your walk by about a square and a half
 * and glides on after you stop: a square's point read while it glides has moved by the time the click lands, at a walk's pace by
 * more than half a square (main's e2e, Nov 5: a tap read for (5, 7) in Ginger's igloo landed on the wall square west of it, and the
 * room walked you to the free square nearest that, (5, 6), one short). So a tap is aimed once the view rests on you:
 * docs/decisions/2026-11-05-ginger-steps.md.
 */
const viewOnYou = (p: Page) =>
  expect
    .poll(
      () =>
        p.evaluate(() => {
          const cam = (window as unknown as Hooks).__shopCam?.();
          const you = document.querySelector<HTMLCanvasElement>("canvas.town-shop-canvas")?.dataset.you;
          if (!cam || !you) return false;
          const [c, r] = you.split(",").map(Number);
          return Math.hypot(cam.focus[0] - c!, cam.focus[1] - r!) < 0.01;
        }),
      { message: "you've stopped and the view rests on you", timeout: 10_000, intervals: [50] },
    )
    .toBe(true);

/**
 * Walks up to a home (its chip glides the camera there if it's off screen) and opens its card: its "Go in". (An admin's town is the
 * street town since Nov 5, where a home far off may have no chip, only the nearest few do: then the camera glides there, as a chip's
 * tap would.)
 */
async function goIn(p: Page, id: string, name: string) {
  // (Its card by a real tap once the view holds still, the camera glided there if it's off the screen, as its chip would: helpers.ts
  // tapInTown. A boss strolling in front of its home may take the tap: its card is closed and the home tapped again.)
  const card = await tapInTown(p, "home", id, p.getByRole("dialog", { name, exact: true }));
  // A home you can go into: its name and "Go in", nothing else (Eric, Nov 2: "chop the Shop and Coming soon"; the other homes keep
  // them: e2e/town.spec.ts).
  await expect(card.getByRole("button")).toHaveText(["Go in"]);
  await expect(card.getByText("Coming soon", { exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}

/**
 * Out of the room to the town square. A phone: its bar's back button. A computer has no bar since Nov 7 (the town's tools are in the
 * right column's slot), so out by the door: the view brought to it if it's off screen, a tap on it (you walk there), its card's "Go out".
 */
async function leaveRoom(p: Page) {
  if (test.info().project.name === "phone") return p.getByRole("button", { name: "Back", exact: true }).click();
  const card = p.getByRole("dialog", { name: "Door", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    // (Another card open, the crate's or the Shopkeeper's: closed first, as Escape does.)
    if (await p.locator(".town-card").filter({ visible: true }).count()) {
      await p.keyboard.press("Escape");
      await expect(p.locator(".town-card").filter({ visible: true })).toHaveCount(0, { timeout: 2000 });
    }
    // (The door is usually behind you: the view brought to it, as a drag there would, __shopLook.)
    if (!(await shopAt(p, "door"))) {
      await p.evaluate(() => (window as unknown as { __shopLook?: (k: "door") => boolean }).__shopLook?.("door"));
      await p.waitForTimeout(300);
    }
    const at = await shopAt(p, "door");
    expect(at, "the door on screen").not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  await card.getByRole("button", { name: "Go out" }).click();
}

/** Taps the Shopkeeper (it's in view from the door) and waits for its card, once you've walked up to the counter. */
async function talk(p: Page) {
  await expect.poll(() => shopAt(p, "keeper"), { message: "the Shopkeeper is drawn" }).not.toBeNull();
  const at = (await shopAt(p, "keeper"))!;
  await p.mouse.click(at.x, at.y);
  const card = p.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Talk" }).click();
}

test("Babur's tent: Go in, start zoomed out, talk to the Shopkeeper, the crate's price and Balloon Pup, then Go out at the tent's door", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "tiger", "Babur's Circus");
  // Outside, you stood at the tent's door (the square in front of it) as you went in.
  const door = await town(page).getAttribute("data-you");
  const [dc, dr] = door!.split(",").map(Number) as [number, number];
  // (The street town's door square, everyone's town since Nov 13; the old town's was (28, 2).)
  expect(Math.abs(dc - 9) + Math.abs(dr - 39), `at the door (9, 39): ${door}`).toBeLessThanOrEqual(2);
  // Inside: a step in from the door, zoomed out (the − is the pressed one: Eric, Nov 3), the town's chips put away; the header says the shop's name.
  await expect(room(page)).toHaveAttribute("data-room", "tiger");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Babur's Circus");
  // The chat log over the dark tent: white words (Eric, Nov 2), by day outside too (?sky=day).
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  await expect(room(page)).toHaveAttribute("data-you", "10,17");
  expect((await shopCam(page))!.zoom).toBe(1);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".town-chip").first()).toBeHidden();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/first-view-${test.info().project.name}.png` });
  // + zooms into Close, − back out to the town's zoomed-in camera.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await shopCam(page))!.zoom).toBe(0);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(async () => (await shopCam(page))!.zoom).toBe(1);

  // The Shopkeeper (Stripes, beside the counter): a tap walks you up in front of it; its card; Talk opens the crate's.
  await talk(page);
  await expect(room(page)).toHaveAttribute("data-you", "12,5");
  const crate = page.getByRole("dialog", { name: "Babur's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate.getByRole("heading", { name: "Babur's Boss Crate" })).toBeVisible();
  await expect(crate).toContainText("3 Babur tokens, or 1 Babur token + 1 crate key");
  await expect(crate).toContainText("Balloon Pup");
  await expect(crate).toContainText("You have 0 Babur tokens and 0 crate keys.");
  // Nothing to pay with: both ways shown, greyed (round 2; round 1's buys answered "Coming soon").
  await expect(crate.getByRole("button", { name: "Buy with 3 Babur tokens" })).toBeDisabled();
  await expect(crate.getByRole("button", { name: "Buy with 1 Babur token + 1 crate key" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();

  // Back to the door: it's behind you (the camera looks north), so drag the view back toward it (a drag looks around) until it's
  // on screen, then tap it: you walk there and its card says "Go out".
  const box = (await room(page).boundingBox())!;
  await expect(async () => {
    if (await shopAt(page, "door")) return;
    // Back first (the floor pulled up the screen, as in the town), then sideways toward the door's columns (a drag to the right
    // moves the view left).
    const [cx, cy] = (await shopCam(page))!.focus;
    const side = cy < 18 ? 0 : Math.sign(cx - 9.5) * 0.15;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * (0.5 + side), box.y + box.height * (cy < 18 ? 0.3 : 0.7), { steps: 8 });
    await page.mouse.up();
    expect(await shopAt(page, "door")).not.toBeNull();
  }).toPass({ timeout: 30_000 });
  const at = (await shopAt(page, "door"))!;
  await page.mouse.click(at.x, at.y);
  const out = page.getByRole("dialog", { name: "Door", exact: true });
  await expect(out).toBeVisible({ timeout: 15_000 });
  await expect(room(page)).toHaveAttribute("data-you", /^(9|10),18$/);
  await out.getByRole("button", { name: "Go out" }).click();
  // Outside again, at the tent's door, the town going on.
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Town square");
  await expect(town(page)).toHaveAttribute("data-you", door!);
  await expect(page.locator(".town-fade")).toHaveCSS("opacity", "0", { timeout: 5000 });
  expect(errors).toEqual([]);
});

test("Puddles' greenhouse: Go in, Drizzle's crate with Puddles's Mower; the back button takes you out", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (By night outside: the chat's words are white in the town, dark in the greenhouse.)
  await page.goto("/town?sky=night");
  await townReady(page);
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  await goIn(page, "gardener", "Puddles' Botanical Garden");
  await expect(room(page)).toHaveAttribute("data-room", "gardener");
  // The chat log over the light greenhouse: dark words (Eric, Nov 2), by night outside.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  // (For the review: his HunChess buckets, Nov 4, from the door: the stack by the potting bench, one by the fountain.)
  if (SHOTS && process.env.PUDDLES_BUCKETS) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/puddles-buckets-${test.info().project.name}.png` });
  }
  await talk(page);
  const crate = page.getByRole("dialog", { name: "Puddles' Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Puddles tokens, or 1 Puddles token + 1 crate key");
  await expect(crate).toContainText("Puddles's Mower");
  // Inside, back is "out to the town square", not home (a computer: its door, no bar since Nov 7; you can get out).
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  await townReady(page);
  expect(errors).toEqual([]);
});

test("?fps in a room (Nov 11, Eric's iPhone: frozen at 42-44 inside, 2-4 going out): the pill reads the room's frames, never spans the visit going out; standing still, the room's back is drawn from its kept copy", { tag: "@phone-only" }, async ({ page }) => {
  await page.goto("/town?sky=day&fps");
  await townReady(page);
  await goIn(page, "gardener", "Puddles' Botanical Garden");
  type Seen = { __pill: string[]; __shopStill?: () => { drawn: number; made: number } | null };
  // Every reading the pill is given from here (before: none inside a room, its town reading stood still).
  await page.evaluate(() => {
    const el = document.querySelector(".town-fps")!;
    const w = window as unknown as Seen;
    w.__pill = [];
    new MutationObserver(() => w.__pill.push(el.textContent ?? "")).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await page.waitForTimeout(2500);
  const inside = await page.evaluate(() => [...(window as unknown as Seen).__pill]);
  expect(inside.length, `the pill reads the room twice a second: ${inside.join(" | ")}`).toBeGreaterThanOrEqual(3);
  // Standing still: the ceiling and floor come from the copy kept as the view came to rest (one copy, drawn every frame since).
  const still = await page.evaluate(() => (window as unknown as Seen).__shopStill?.() ?? null);
  expect(still!.made, "kept once the view rests").toBeGreaterThanOrEqual(1);
  expect(still!.drawn, "drawn from the copy while you stand").toBeGreaterThan(30);
  // Out: every reading is the frames of its last second (before: the frames before you went in over the whole visit, "1 fps").
  const room = Number.parseInt(inside[inside.length - 1]!);
  await page.evaluate(() => ((window as unknown as Seen).__pill.length = 0));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("canvas.town-shop-canvas")).toHaveCount(0);
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => [...(window as unknown as Seen).__pill]);
  expect(out.length).toBeGreaterThanOrEqual(2);
  // (Nov 13: 5 or more, was room / 5 against the old town. Back in the street town, on the tests' software WebGL, the first second out reads about
  // 7 to 12 against 60 inside; a reading spanning the whole visit read 1 to 4, so 5 tells them apart.)
  expect(Math.min(...out.map((x) => Number.parseInt(x))), `going out, against ${room} fps inside: ${out.join(" | ")}`).toBeGreaterThan(4);
});

test("a room's report records while walking, and walking lays no floor triangles (Nov 11, Eric: inside it's \"just like capped\"; ?report \"is pausing when I run into the building\"): the pill counts on inside; WebGL draws the back, the same picture as the 2D way's", { tag: "@phone-only" }, async ({ page }) => {
  await page.goto("/town?sky=day&report");
  await townReady(page);
  await goIn(page, "gardener", "Puddles' Botanical Garden");
  type Back = { drawn: number; made: number; gl: boolean; backTris: number; glTris: number };
  type Seen = { __pill: string[]; __backs: Back[]; __stop: boolean; __shopStill?: () => Back | null; __shopCam?: () => { focus: [number, number] } | null };
  // Every text the pill shows from here, and the back's numbers each frame the view moved.
  await page.evaluate(() => {
    const w = window as unknown as Seen;
    const el = document.querySelector(".tfr-pill span")!;
    w.__pill = [];
    new MutationObserver(() => w.__pill.push(el.textContent ?? "")).observe(el, { childList: true, characterData: true, subtree: true });
    w.__backs = [];
    w.__stop = false;
    let last = "";
    const tick = () => {
      const at = String(w.__shopCam?.()?.focus);
      const b = w.__shopStill?.();
      if (b && at !== last && last) w.__backs.push(b);
      last = at;
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Walk until the recorder has more than 30 walking frames in the room (3 strolls is about 3 s; CI's software WebGL draws
  // 8 to 9 frames a second there, so it may take a few more: PR #661's run, 26 and 28 after 3), at most 8 strolls.
  const walkFrames = () =>
    page.evaluate(() => ((window as unknown as { __townReport?: (raw: boolean) => { raw: { flags: number[] } } | null }).__townReport?.(true)?.raw.flags ?? []).filter((f) => f & 256 && f & 1 && !(f & 1536)).length);
  for (let i = 0; i < 8 && (i < 3 || (await walkFrames()) <= 30); i++) {
    const k = i % 2 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(k);
    await page.waitForTimeout(1100);
    await page.keyboard.up(k);
  }
  const seen = await page.evaluate(() => {
    const w = window as unknown as Seen;
    w.__stop = true;
    return { pill: [...w.__pill], backs: [...w.__backs] };
  });
  // The pill counts the seconds inside (before: it stood still on "walk or turn to start" or the town's last second). (Nov 13: the street
  // town, everyone's, starts recording as you walk there, so the count goes on from the town's: at least two counts inside, rising.)
  await expect(page.locator(".tfr-pill")).toBeVisible();
  const counts = seen.pill.map((x) => /Recording (\d+) s/.exec(x)?.[1]).filter((x) => x !== undefined).map(Number);
  expect(new Set(counts).size, `the pill inside: ${seen.pill.join(" | ")}`).toBeGreaterThanOrEqual(2);
  expect(counts.every((n, i) => i === 0 || n >= counts[i - 1]!), `the pill inside counts up: ${seen.pill.join(" | ")}`).toBe(true);
  const rep = await page.evaluate(() => (window as unknown as { __townReport?: (raw: boolean) => { raw: { flags: number[] } } | null }).__townReport?.(true) ?? null);
  // (Frames in a room (256) while walking (1), not going in or out.)
  expect(rep!.raw.flags.filter((f) => f & 256 && f & 1 && !(f & 1536)).length, "the room's walking frames recorded").toBeGreaterThan(30);
  // Walking: the back is WebGL's, no floor triangle laid on the 2D canvas in any frame the view moved (before: some hundreds a frame).
  expect(seen.backs.length, "frames the view moved").toBeGreaterThan(20);
  expect(seen.backs.every((b) => b.gl && b.backTris === 0 && b.glTris > 0), JSON.stringify(seen.backs.slice(0, 3))).toBe(true);
  // The same picture: drawn both ways at this view, all but tile edges a pixel off (measured Nov 11: 1 to 6% of pixels past 48).
  const diff = await page.evaluate(() => (window as unknown as { __shopBackDiff?: () => { over48: number; mean: number } | null }).__shopBackDiff?.() ?? null);
  expect(diff!.over48, JSON.stringify(diff)).toBeLessThan(0.1);
});

test("Alfil's Pyramid (Nov 2): Go in, Woolly's crate with Alfil's Howdah; the chat's words dark over the sandstone", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/town?sky=night");
  await townReady(page);
  await goIn(page, "alfil", "Alfil's Pyramid");
  await expect(room(page)).toHaveAttribute("data-room", "alfil");
  await expect(page.getByRole("heading", { name: "Alfil's Pyramid" })).toBeVisible();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  await talk(page);
  const crate = page.getByRole("dialog", { name: "Alfil's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Alfil tokens, or 1 Alfil token + 1 crate key");
  await expect(crate).toContainText("Alfil's Howdah");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/alfil-crate-${test.info().project.name}.png` });
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Timber's Lumber Lodge (Nov 3): in an admin's town only; its card is its name and Go in; Rivet keeps the shop, Timber's Boss Crate with The Log Roller", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  type Hook = { __townBots?: () => { name: string }[] | null; __townGlide?: (to: string | readonly [number, number]) => void };
  const bots = async () => (await page.evaluate(() => (window as unknown as Hook).__townBots?.() ?? []))!.map((b) => b.name);
  // A player's town: no lodge on its lot on Fountain Street (the row's look-alike fronts there since Nov 13), no Rivet (Timber is in the game
  // for admins first).
  await page.goto("/town?sky=day");
  await townReady(page);
  await page.evaluate(() => (window as unknown as Hook).__townGlide?.([5, 31]));
  await page.waitForTimeout(1500);
  expect(await homeAt(page, "timber")).toBeNull();
  expect(await bots()).toContain("Glim (bot)");
  expect(await bots()).not.toContain("Rivet (bot)");
  // An admin's: the lodge there, Rivet among the bots.
  await asAdmin(page);
  await page.reload();
  await townReady(page);
  expect(await bots()).toContain("Rivet (bot)");
  await page.evaluate(() => (window as unknown as Hook).__townGlide?.("timber"));
  expect(await townTapPoint(page, "home", "timber", 20_000), "the lodge in view (the glide landed)").not.toBeNull();
  if (SHOTS) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/town-lodge-${test.info().project.name}.png` });
  }
  await goIn(page, "timber", "Timber's Lumber Lodge");
  await expect(room(page)).toHaveAttribute("data-room", "timber");
  await expect(page.getByRole("heading", { name: "Timber's Lumber Lodge" })).toBeVisible();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  await expect.poll(() => shopAt(page, "keeper"), { message: "Rivet is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/counter-${test.info().project.name}.png` });
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Timber's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Timber tokens, or 1 Timber token + 1 crate key");
  await expect(crate).toContainText("The Log Roller");
  if (SHOTS) {
    // The showpiece: from in front of its dais (columns 15-18, rows 3-4), the carved king standing up whole.
    await page.keyboard.press("Escape");
    await expect(crate).toBeHidden();
    // (A step at a time toward it, each square tapped once it's on screen.)
    for (const step of [[12, 6], [14, 6], [16, 6]] as const) {
      await expect(async () => {
        const sq = await shopAt(page, "square", step);
        expect(sq, `${step} on screen`).not.toBeNull();
        await page.mouse.click(sq!.x, sq!.y);
        await expect(room(page)).toHaveAttribute("data-you", step.join(","), { timeout: 4000 });
      }).toPass({ timeout: 20_000 });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/showpiece-${test.info().project.name}.png` });
  }
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Dash's Kicks (Nov 3): in an admin's town only; its card is its name and Go in; Tick keeps the shop, Dash's Boss Crate with Cheetah Shoes; the halfpipe", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  type Hook = { __townBots?: () => { name: string }[] | null; __townGlide?: (to: string | readonly [number, number]) => void; __townBossBack?: (id: string) => void };
  const bots = async () => (await page.evaluate(() => (window as unknown as Hook).__townBots?.() ?? []))!.map((b) => b.name);
  // A player's town: no store on its lot (the row's look-alike fronts there since Nov 13), no Tick (Dash is in the game for admins first).
  await page.goto("/town?sky=day");
  await townReady(page);
  await page.evaluate(() => (window as unknown as Hook).__townGlide?.([41, 39]));
  await page.waitForTimeout(1500);
  expect(await homeAt(page, "dash")).toBeNull();
  expect(await bots()).toContain("Glim (bot)");
  expect(await bots()).not.toContain("Tick (bot)");
  // An admin's: the store there, Tick among the bots.
  await asAdmin(page);
  for (const sky of SHOTS ? ["night", "day"] : ["day"]) {
    await page.goto(`/town?sky=${sky}`);
    await townReady(page);
    expect(await bots()).toContain("Tick (bot)");
    await page.evaluate(() => (window as unknown as Hook).__townGlide?.("dash"));
    expect(await townTapPoint(page, "home", "dash", 20_000), "the store in view (the glide landed)").not.toBeNull();
    if (SHOTS) {
      // (Day, and night so the neon shows; Dash sent round behind his store, so its front shows whole.)
      await page.evaluate(() => (window as unknown as Hook).__townBossBack?.("dash"));
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${SHOTS}/town-kicks-${sky}-${test.info().project.name}.png` });
    }
  }
  await goIn(page, "dash", "Dash's Kicks");
  await expect(room(page)).toHaveAttribute("data-room", "dash");
  await expect(page.getByRole("heading", { name: "Dash's Kicks" })).toBeVisible();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  // You start inside zoomed out (the further-out camera), as in every home.
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  await expect.poll(() => shopAt(page, "keeper"), { message: "Tick is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/counter-${test.info().project.name}.png` });
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Dash's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Dash tokens, or 1 Dash token + 1 crate key");
  await expect(crate).toContainText("Cheetah Shoes");
  if (SHOTS) {
    // The showpiece: from in front of the halfpipe (columns 15-18, rows 3-4), its skateboard rolling by itself.
    await page.keyboard.press("Escape");
    await expect(crate).toBeHidden();
    // (A step at a time toward it, each square tapped once it's on screen.)
    for (const step of [[12, 6], [14, 6], [16, 6]] as const) {
      await expect(async () => {
        const sq = await shopAt(page, "square", step);
        expect(sq, `${step} on screen`).not.toBeNull();
        await page.mouse.click(sq!.x, sq!.y);
        await expect(room(page)).toHaveAttribute("data-you", step.join(","), { timeout: 4000 });
      }).toPass({ timeout: 20_000 });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/halfpipe-${test.info().project.name}.png` });
  }
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Hollow Peak (Nov 3): Go in (his line on the card), the cave: in at the mouth, up the passage past the pond, round the bend to the counter; his dog keeps the shop, Hollow's Boss Crate with Hollow's Bulb", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/town?sky=night");
  await townReady(page);
  // (Hollow live for everyone, so his cave is too: a player's town. His card keeps his line over "Go in": the next each time.)
  await goIn(page, "hollow", "Hollow Peak");
  await expect(room(page)).toHaveAttribute("data-room", "hollow");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hollow Peak");
  // A dark cave: the chat's words white.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  // In at the mouth, a step in from the way out, zoomed out (the further-out camera, as every home).
  await expect(room(page)).toHaveAttribute("data-you", "14,17");
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  const name = test.info().project.name;
  const still = async (what: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  // (The counter is round the bend, out of sight: his tag goes behind the rock with him.)
  await still("mouth");
  /** Walks to `sq`, tapping it once it's on screen; the room's floor only (the rock beside it is never walked on). */
  const walkTo = async (sq: readonly [number, number]) => {
    await expect(async () => {
      const at = await shopAt(page, "square", sq);
      expect(at, `${sq} on screen`).not.toBeNull();
      await page.mouse.click(at!.x, at!.y);
      await expect(room(page)).toHaveAttribute("data-you", sq.join(","), { timeout: 6000 });
    }).toPass({ timeout: 30_000 });
  };
  // Up the passage to the pond (the battle spot), then before the tree.
  await walkTo([13, 14]);
  await still("pond");
  await walkTo([15, 10]);
  await still("tree");
  // A tap on the rock walks you beside it, never into it: the passage's west wall.
  const rock = await shopAt(page, "square", [8, 11]);
  if (rock) {
    await page.mouse.click(rock.x, rock.y);
    await expect.poll(async () => (await room(page).getAttribute("data-you"))!, { message: "beside the rock", timeout: 10_000 }).toMatch(/^9,(10|11|12)$/);
  }
  // Round the bend at the back, the hollow opening to the west.
  await walkTo([11, 9]);
  await walkTo([10, 8]);
  await still("bend");
  await walkTo([7, 6]);
  // The dog behind the counter: a tap on him walks you in front of it, the counter between you; his card says "Shopkeeper".
  // (Aimed once you've stopped on (7, 6) and the view rests on you. There you're within talking range and his card opens by itself:
  // closed first, or the tap would only close it. Nov 5: docs/decisions/2026-11-05-ginger-steps.md.)
  await viewOnYou(page);
  if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(() => shopAt(page, "keeper"), { message: "the dog is drawn round the bend" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole("heading", { name: "Shopkeeper", exact: true })).toBeVisible();
  await expect(room(page)).toHaveAttribute("data-you", /^[56],5$/);
  await still("counter");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Hollow's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Hollow tokens, or 1 Hollow token + 1 crate key");
  await expect(crate).toContainText("Hollow's Bulb");
  await expect(crate).toContainText("You have 0 Hollow tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Hollow tokens" })).toBeDisabled();
  await still("crate");
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  if (SHOTS && process.env.CAVE_VIEWS) {
    // (For the review: in again, the close camera all along the way from the mouth, up the passage, round the bend, to the hollow's back.)
    await goIn(page, "hollow", "Hollow Peak");
    await expect(room(page)).toHaveAttribute("data-you", "14,17");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await still("close-14-17");
    for (const sq of [[13, 15], [12, 13], [12, 11], [11, 9], [10, 8], [9, 8], [8, 7], [7, 7], [6, 6], [5, 6], [4, 5], [3, 4]] as const) {
      await walkTo(sq);
      await still(`close-${sq.join("-")}`);
    }
    await leaveRoom(page);
    await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  }
  expect(errors).toEqual([]);
});

test("Wrangler's Stall (Nov 4): Go in (its card its name and Go in), his barn: the pens, the board on its hay bale, the lanterns; his rooster keeps the shop on the counter, Wrangler's Boss Crate with Pen Pony", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Wrangler is live for everyone, so his barn is too: a player's town.)
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "pig", "Wrangler's Stall");
  await expect(room(page)).toHaveAttribute("data-room", "pig");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wrangler's Stall");
  // A plank barn in the evening light: the chat's words dark.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  const name = test.info().project.name;
  const still = async (what: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  // (Just in the doorway: the barn, the battle spot, the pens' knights hopping, the counter and the rooster on it.)
  await still("room");
  // The rooster on the counter: a tap on him walks you in front of it; his card says "Shopkeeper".
  await expect.poll(() => shopAt(page, "keeper"), { message: "the rooster is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole("heading", { name: "Shopkeeper", exact: true })).toBeVisible();
  await expect(room(page)).toHaveAttribute("data-you", /^(9|10),(4|5)$/);
  await still("counter");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Wrangler's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Wrangler tokens, or 1 Wrangler token + 1 crate key");
  await expect(crate).toContainText("Pen Pony");
  await expect(crate).toContainText("You have 0 Wrangler tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Wrangler tokens" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Folio's Folded House (Nov 5): Go in (its card its name and Go in), its sanctuary: the clean page, the fountain, the windows' pools drifting, the \"being written\" edge; its paper turtle keeps the shop behind the low counter, Folio's Boss Crate with the Paper Crane", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Folio is live for everyone, so its sanctuary is too: a player's town.)
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "folio", "Folio's Folded House");
  await expect(room(page)).toHaveAttribute("data-room", "folio");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Folio's Folded House");
  // A room of pale paper: the chat's words dark. It starts at the further-out camera, as every home.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  const name = test.info().project.name;
  const still = async (what: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  /** Taps a square and waits until you stand on it. */
  const walkTo = async (sq: readonly [number, number]) => {
    // (Aim once the view rests on you: a square read while the camera glides moves before the tap lands. viewOnYou, above.)
    await viewOnYou(page);
    await expect.poll(() => shopAt(page, "square", sq), { message: `square ${sq} drawn` }).not.toBeNull();
    const at = (await shopAt(page, "square", sq))!;
    await page.mouse.click(at.x, at.y);
    await expect(room(page)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 20_000 });
  };
  // (Just inside the door: the clean page and its marks ahead, the shop at the back.)
  await still("door");
  await walkTo([10, 12]);
  await still("page");
  await walkTo([7, 9]);
  await still("fountain");
  // The turtle behind the counter: a tap on it walks you up to the counter; its card says "Shopkeeper", no name.
  await expect.poll(() => shopAt(page, "keeper"), { message: "the turtle is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("heading")).toHaveText(["Shopkeeper"]);
  await expect(room(page)).toHaveAttribute("data-you", /^(9|10),(4|5)$/);
  await still("counter");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Folio's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Folio tokens, or 1 Folio token + 1 crate key");
  // (Its ride first among the prizes.)
  await expect(crate.locator(".shop-prize-name").first()).toHaveText("Paper Crane");
  await expect(crate).toContainText("You have 0 Folio tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Folio tokens" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();
  // The "being written" edge: the west-back corner, the margin line, the sketched lantern and lattice. (Two hops: from the counter the
  // corner is off a phone's screen.)
  await walkTo([6, 8]);
  await walkTo([3, 6]);
  await still("edge");
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Smudgy's Art Gallery (Nov 6): Go in, his paint studio: the life class (the knight turning, eight painters at their easels), the cloth-covered table on the drop cloth, the sculptures; the gallery owner keeps the shop behind the counter, Smudgy's Boss Crate with the Brush Ride", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Smudgy is live for everyone, so his studio is too: a player's town.)
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "smudgy", "Smudgy's Art Gallery");
  await expect(room(page)).toHaveAttribute("data-room", "smudgy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Smudgy's Art Gallery");
  // A dark room of deep paint: the chat's words light.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  const name = test.info().project.name;
  const still = async (what: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  const walkTo = async (sq: readonly [number, number]) => {
    // (Aim once the view rests on you: a square read while the camera glides moves before the tap lands. viewOnYou, above.)
    await viewOnYou(page);
    await expect.poll(() => shopAt(page, "square", sq), { message: `square ${sq} drawn` }).not.toBeNull();
    const at = (await shopAt(page, "square", sq))!;
    await page.mouse.click(at.x, at.y);
    await expect(room(page)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 20_000 });
  };
  // (Just inside the door: the drop cloth and its covered table ahead, the life class behind it, the shop at the back.)
  await still("door");
  await walkTo([11, 16]);
  await still("table");
  await walkTo([9, 11]);
  await still("life-class");
  // The gallery owner behind the counter: a tap on it walks you up to the counter; its card says "Shopkeeper", no name.
  await expect.poll(() => shopAt(page, "keeper"), { message: "the gallery owner is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("heading")).toHaveText(["Shopkeeper"]);
  await still("counter");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Smudgy's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Smudgy tokens, or 1 Smudgy token + 1 crate key");
  await expect(crate.locator(".shop-prize-name").first()).toHaveText("Brush Ride");
  await expect(crate).toContainText("You have 0 Smudgy tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Smudgy tokens" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();
  // The sculptures: the rook on its plinth in the west-back corner, a canvas stack and the easel by it.
  await walkTo([6, 6]);
  await walkTo([3, 5]);
  await still("sculptures");
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

type CrewHook = {
  __shopCrew?: () => {
    lift: { at: [number, number]; anim: string; waiting: boolean; leg: number };
    forklift: { at: [number, number]; anim: string; waiting: boolean; leg: number };
    pallet: string;
    figs: { name: string; anim: string; at: [number, number]; flip: boolean; up: number }[];
    you: [number, number];
  } | null;
};
const crew = (p: Page) => p.evaluate(() => (window as unknown as CrewHook).__shopCrew?.() ?? null);

test("Jefferson's Fireworks (Nov 4): Go in (its card its name and Go in), his warehouse: the racking, the board on its crates, the crew at work; the dealer keeps the shop in his corner, Jefferson's Boss Crate with Giraffe Gallop; the scissor lift waits while you stand in its way and goes on once you step aside", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Jefferson is live for everyone, so his warehouse is too: a player's town.)
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "grex", "Jefferson's Fireworks");
  await expect(room(page)).toHaveAttribute("data-room", "grex");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jefferson's Fireworks");
  // Bright concrete under the lamps: the chat's words dark.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  const name = test.info().project.name;
  const still = async (what: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  // The crew: the two leaners, the clipboard guy and the dozer at their places, the lift and the forklift on their loops, the pallet.
  const c0 = (await crew(page))!;
  expect(c0.figs.map((f) => f.name).sort()).toEqual(["crew-c", "crew-d", "forklift", "leaner-a", "leaner-b", "lift", "pallet"]);
  expect(c0.lift.at[1]).toBe(5);
  await still("room");
  // The dealer in his corner: a tap on him walks you in front of him; his card says "Shopkeeper".
  await expect.poll(() => shopAt(page, "keeper"), { message: "the dealer is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("heading", { name: "Shopkeeper", exact: true })).toBeVisible();
  await expect(room(page)).toHaveAttribute("data-you", /^(16|17),6$/);
  await still("dealer");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Jefferson's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Jefferson tokens, or 1 Jefferson token + 1 crate key");
  await expect(crate).toContainText("Giraffe Gallop");
  await expect(crate).toContainText("You have 0 Jefferson tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Jefferson tokens" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();
  // In the lift's way: stand on its row, a square past its next stop, and it waits for you (Eric, Nov 4: "If you block it, it stops");
  // step aside and it goes on ("If you move out of the way, it starts moving again").
  const walkTo = async (sq: readonly [number, number]) => {
    await viewOnYou(page);
    await expect.poll(() => shopAt(page, "square", sq), { message: `(${sq}) is on screen` }).not.toBeNull();
    const xy = (await shopAt(page, "square", sq))!;
    await page.mouse.click(xy.x, xy.y);
    await expect(room(page)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 30_000 });
  };
  for (const sq of [[12, 6], [9, 6], [7, 6]] as const) await walkTo(sq);
  // (Once it's back at the west end of its row: from there its next stop is (6, 5), and you'll stand on the square after it.)
  await expect.poll(async () => (await crew(page))!.lift.at[0], { message: "the lift at its row's west end", timeout: 40_000 }).toBeLessThanOrEqual(5.5);
  await walkTo([7, 5]);
  await expect.poll(async () => (await crew(page))!.lift.waiting, { message: "the lift waits for you", timeout: 40_000 }).toBe(true);
  const held = (await crew(page))!.lift;
  expect([5, 6]).toContain(held.at[0]);
  await page.waitForTimeout(1500);
  expect((await crew(page))!.lift, "still waiting, where it was").toMatchObject({ waiting: true, at: held.at });
  await still("blocked");
  await walkTo([7, 7]);
  await expect.poll(async () => (await crew(page))!.lift.waiting, { message: "it goes on", timeout: 10_000 }).toBe(false);
  await expect.poll(async () => (await crew(page))!.lift.at[0], { message: "it moves", timeout: 10_000 }).not.toBe(held.at[0]);
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

type ElvesHook = {
  elves: { name: string; at: [number, number]; up: number; anim: string; waiting: boolean }[];
  taken: [number, number][];
  you: [number, number];
  waiting: [number, number] | null;
  pairT: number;
  trail: { x: number; y: number; up: number; sy: number; z: number; t: number }[];
};
/** Ginger's igloo's elves and your figure as drawn frame by frame (`clear`: start the trail afresh). */
const elvesOf = (p: Page, clear = false) => p.evaluate((c) => (window as unknown as { __shopElves?: (c: boolean) => ElvesHook | null }).__shopElves?.(c) ?? null, clear);

test("Ginger Igloo (Nov 5): Go in (its card its name and Go in), the round igloo: the candy wall, the catwalk and its two staircases, the elves at work; the shopkeeper elf keeps the shop, Ginger's Boss Crate with the Candy Cane Sled; you run up one staircase, along the catwalk and down the other, by taps and by the arrow keys, your feet on the steps all the way; an elf waits while you stand in its way and goes on once you step aside", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Ginger is live for everyone, so his igloo is too: a player's town.)
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "gingerbread", "Ginger Igloo");
  await expect(room(page)).toHaveAttribute("data-room", "gingerbread");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ginger Igloo");
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  const name = test.info().project.name;
  const still = async (what: string, wait = 600) => {
    if (!SHOTS) return;
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  // The elves: the three walkers and the dispensing pair, all on the floor or the levels' curve.
  const e0 = (await elvesOf(page))!;
  expect(e0.elves.map((e) => e.name)).toEqual(["red", "green", "blue", "box", "pad"]);
  await still("room", 1200);
  // The shopkeeper elf behind his stand: a tap on him walks you in front of it; his card says "Shopkeeper".
  await expect.poll(() => shopAt(page, "keeper"), { message: "the shopkeeper is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("heading", { name: "Shopkeeper", exact: true })).toBeVisible();
  await still("shopkeeper");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Ginger's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Ginger tokens, or 1 Ginger token + 1 crate key");
  await expect(crate).toContainText("Candy Cane Sled");
  await expect(crate).toContainText("You have 0 Ginger tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Ginger tokens" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();

  const tapTo = async (sq: readonly [number, number]) => {
    await viewOnYou(page);
    // (Within talking range of the shopkeeper his card is open: closed first, or the tap would close it.)
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    await expect.poll(() => shopAt(page, "square", sq), { message: `(${sq}) is on screen` }).not.toBeNull();
    const xy = (await shopAt(page, "square", sq))!;
    await page.mouse.click(xy.x, xy.y);
    await expect(room(page)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 30_000 });
  };
  // (The pair work the lower row's middle and east bins from about 8 to 22 s into their loop, clear of the west stairs, the catwalk
  // and, until 22 s, the east stairs: you go up and over then.)
  const clear = async () => expect.poll(async () => (await elvesOf(page))!.pairT, { message: "the pair at the lower row's east bins", timeout: 60_000, intervals: [200] }).toBeGreaterThan(7500);
  await tapTo([7, 9]);
  await expect.poll(async () => (await elvesOf(page))!.pairT, { message: "the pair's loop back at its start", timeout: 60_000, intervals: [200] }).toBeLessThan(3000);
  await clear();
  // (`data-you` names your square as soon as you're on it, before your figure has finished its step there: a lift is read from the
  // last frame drawn once your feet are on the square's middle.)
  const settled = async (sq: readonly [number, number]) => {
    const at = async () => (await elvesOf(page))!.trail.at(-1)!;
    await expect.poll(async () => { const f = await at(); return Math.hypot(f.x - sq[0], f.y - sq[1]) < 0.01; }, { message: `your feet on (${sq})`, timeout: 10_000, intervals: [100] }).toBe(true);
    return at();
  };
  // Up the west stairs by taps: onto the low step from its foot, then the high step. Your feet on the step's height (the curve's).
  await elvesOf(page, true);
  await tapTo([5, 6]);
  await tapTo([6, 5]);
  await still("on-stair", 300);
  const onStair = await settled([6, 5]);
  expect(onStair.up, "on the high step: its middle between the steps 30 and 35 px up").toBeGreaterThan(30);
  expect(onStair.up).toBeLessThan(35);
  // A tap on a deck square as it's drawn (up on the catwalk) walks you along it.
  await tapTo([9, 4]);
  await still("on-catwalk", 300);
  expect((await settled([9, 4])).up, "on the deck").toBe(40);
  // Down the east stairs to their foot: along the catwalk round its curve onto the high step, then a tap on the floor at the foot
  // walks you down (never off the deck's front). (The camera follows you: each square tapped once it's on screen.)
  await tapTo([11, 4]);
  await tapTo([13, 5]);
  await tapTo([14, 6]);
  await still("stair-foot", 300);
  expect((await settled([14, 6])).up, "back on the floor").toBe(0);
  const t1 = (await elvesOf(page))!.trail;
  // Every frame of the way: never off the chain (no square in front of the deck), and the lift never jumps for how far you went.
  /** The floor square a point is well inside (not on its edge, where the catwalk's diagonal steps cross a corner), or "". */
  const sqOf = (x: number, y: number) => (Math.abs(x - Math.round(x)) < 0.45 && Math.abs(y - Math.round(y)) < 0.45 ? `${Math.round(x)},${Math.round(y)}` : "");
  let most = 0;
  for (let i = 1; i < t1.length; i++) {
    const a = t1[i - 1]!;
    const b = t1[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    most = Math.max(most, Math.abs(b.up - a.up) - 40 * d);
    expect(["8,5", "9,5", "10,5", "11,5", "6,6", "13,6"], `frame ${i}: never in front of the deck or under the high steps`).not.toContain(b.up > 0 ? sqOf(b.x, b.y) : "");
  }
  expect(most, "no pops: the lift changes no faster than the steps rise").toBeLessThanOrEqual(0.05);
  expect(Math.max(...t1.map((p) => p.up)), "up on the deck on the way").toBe(40);

  // By the arrow keys: up from the east foot climbs on, left runs along the flight and the catwalk; up does nothing on the deck.
  await clear();
  await elvesOf(page, true);
  await page.keyboard.down("ArrowUp");
  await expect(room(page)).toHaveAttribute("data-you", "14,5", { timeout: 10_000 });
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("ArrowLeft");
  // (A step is 90 ms: watched every frame, in the page.)
  await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>("canvas.town-shop-canvas")?.dataset.you === "10,4", null, { timeout: 10_000 });
  await page.keyboard.up("ArrowLeft");
  await page.waitForTimeout(400);
  const keyed = (await room(page).getAttribute("data-you"))!;
  expect(["10,4", "9,4", "8,4", "7,5"], "it stops on the catwalk once the key's let go (any of its squares west of where it was let go: a loaded machine may take a step or two more)").toContain(keyed);
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowUp");
  await expect(room(page)).toHaveAttribute("data-you", keyed);
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowDown");
  await expect(room(page), "down on the deck: not off its front edge").toHaveAttribute("data-you", keyed);
  const t2 = (await elvesOf(page))!.trail;
  for (let i = 1; i < t2.length; i++) expect(Math.abs(t2[i]!.up - t2[i - 1]!.up) - 40 * Math.hypot(t2[i]!.x - t2[i - 1]!.x, t2[i]!.y - t2[i - 1]!.y), `frame ${i}`).toBeLessThanOrEqual(0.05);
  // Back down the west stairs by taps.
  await tapTo([7, 5]);
  await tapTo([5, 7]);

  // In an elf's way: the red walker goes up and down column 6 by the sack, between (6, 11.3) and (6, 8.6). Stand on (6, 9) and he
  // waits for you (Eric, Nov 4, of Jefferson's crew: "If you block it, it stops"); step aside and he goes on.
  await tapTo([6, 9]);
  const red = async () => (await elvesOf(page))!.elves.find((e) => e.name === "red")!;
  await expect.poll(async () => (await red()).waiting, { message: "the red walker waits for you", timeout: 30_000 }).toBe(true);
  const held = await red();
  await page.waitForTimeout(1200);
  expect(await red(), "still waiting, where he was").toMatchObject({ waiting: true, at: held.at });
  await still("elf-blocked", 0);
  await tapTo([5, 8]);
  await expect.poll(async () => (await red()).waiting, { message: "he goes on", timeout: 10_000 }).toBe(false);
  await expect.poll(async () => (await red()).at, { message: "he moves", timeout: 10_000 }).not.toEqual(held.at);
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("Big Boy's Crib (Nov 2): Go in, Blocky's crate with Big Boy's Buggy; the chat's words dark over the nursery", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/town?sky=night");
  await townReady(page);
  await goIn(page, "bigboy", "Big Boy's Crib");
  await expect(room(page)).toHaveAttribute("data-room", "bigboy");
  await expect(page.getByRole("heading", { name: "Big Boy's Crib" })).toBeVisible();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  // Up the walkway to the counter (the ball pit round it is solid): the Shopkeeper's card.
  await expect.poll(() => shopAt(page, "keeper"), { message: "the Shopkeeper is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 15_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/bigboy-counter-${test.info().project.name}.png` });
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Big Boy's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Big Boy tokens, or 1 Big Boy token + 1 crate key");
  await expect(crate).toContainText("Big Boy's Buggy");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/bigboy-crate-${test.info().project.name}.png` });
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

/** A drag from `from` to `to`: a finger (real touch events) on the phone, the mouse on the computer. */
async function dragBy(p: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (test.info().project.name === "phone") {
    const cdp = await p.context().newCDPSession(p);
    const point = (x: number, y: number) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from.x, from.y) });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    return;
  }
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move(to.x, to.y, { steps: 8 });
  await p.mouse.up();
}

/**
 * How far what's drawn at `at()` moves for a drag that starts on it and goes `dx`, `dy` pixels: down, back up, then right. What's
 * under the finger follows it (the same sign, about as far), as the town's map does.
 */
async function followsFinger(p: Page, at: () => Promise<{ x: number; y: number } | null>, d: number) {
  const moved: { dx: number; dy: number; x: number; y: number }[] = [];
  for (const [dx, dy] of [
    [0, d],
    [0, -d],
    [d, 0],
  ] as const) {
    const a = (await at())!;
    await dragBy(p, a, { x: a.x + dx, y: a.y + dy });
    const b = (await at())!;
    moved.push({ dx, dy, x: b.x - a.x, y: b.y - a.y });
  }
  for (const m of moved) {
    const finger = m.dx || m.dy;
    const got = m.dx ? m.x : m.y;
    // (Perspective stretches it a little, so not exactly the finger's: the same way, and about as far.)
    expect(got / finger, `the drawn point follows the finger (${JSON.stringify(moved)})`).toBeGreaterThan(0.4);
    expect(got / finger).toBeLessThan(2.5);
  }
  return moved;
}

test("inside, a drag looks around (Eric, Nov 2: \"when I drag from down to up, it should be the same as the town movement\"): what's under the finger follows it, both ways", async ({ page }) => {
  // (The old town's half went with it, Nov 13: there a drag moved the map under the finger; the street town's drag turns the camera round
  // you (e2e/town-fixed.spec.ts, the look round).)
  await page.goto("/town?sky=day");
  await townReady(page);
  const d = Math.round(((await town(page).boundingBox())!.height * 0.1) / 2) * 2;
  // Inside Babur's tent: a square in front of you, dragged down, up and sideways, follows the finger.
  await goIn(page, "tiger", "Babur's Circus");
  await expect.poll(async () => (await shopCam(page))?.zoom).toBe(1);
  await page.waitForTimeout(800); // (the camera's spring settles on you)
  const square = async () => (await shopAt(page, "square", [10, 15])) ?? (await shopAt(page, "square", [10, 13]));
  await followsFinger(page, square, d);
});

/**
 * Eric's rule (Nov 5: "if you hold up in one of the rooms, it actually gave you the kind of sensation you're running down. So it's
 * flipped"): in every room, Up (the key, W, or the on-screen arrow) moves you up the screen and looks it; Down the reverse; Left and
 * Right go left and right on screen. The rooms: Babur's Circus (an ordinary shop), Alfil's Pyramid (its marks laid out across) and
 * Hollow Peak (the cave), on foot and on a ride; by the keyboard and by the on-screen arrows. For each: the square you end on is drawn
 * up / down / left / right of where you were (both read in the same frame), your figure's feet move that way on screen as you go, and
 * on a ride the view drawn while moving is its back going up, its front going down, its side (facing that way) across.
 */
const KEY_ROOMS = [
  ["tiger", "Babur's Circus"],
  ["alfil", "Alfil's Pyramid"],
  ["hollow", "Hollow Peak"],
] as const;
type Way = "up" | "down" | "left" | "right";
const KEY_OF: Record<Way, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

/** Holds `way` (a key, or the on-screen arrow) until you're a square on, then lets go; checks you went that way on the screen. */
async function screenWay(p: Page, way: Way, by: "key" | "pad", ride: boolean) {
  const label = `${way} by ${by === "key" ? "the key" : "the on-screen arrow"}${ride ? " on a ride" : ""}`;
  const from = (await room(p).getAttribute("data-you"))!;
  // (Every frame from the press: your feet on screen, and on a ride the view drawn while moving and which way its side faces.)
  await p.evaluate(() => {
    const w = window as unknown as { __shopRide?: () => { anim: string; view: number; facing: number; foot: [number, number] | null } | null; __way: { foot: number[][]; moves: string[]; on: boolean } };
    w.__way = { foot: [], moves: [], on: true };
    const tick = () => {
      if (!w.__way.on || !w.__shopRide) return;
      const r = w.__shopRide();
      if (r?.foot) w.__way.foot.push(r.foot);
      if (r?.anim === "move") w.__way.moves.push(`${r.view}:${r.facing}`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const pad = by === "pad" ? (await p.locator(`.town-key-${way}`).boundingBox())! : null;
  // (A step is about 90 ms: let go in the page, the frame you're a square on, so you stop a square or two on with both in view.)
  await p.evaluate(([f, code, way]) => {
    const w = window as unknown as { __wayOff: boolean };
    w.__wayOff = false;
    const tick = () => {
      if (document.querySelector<HTMLCanvasElement>("canvas.town-shop-canvas")?.dataset.you === f) return void requestAnimationFrame(tick);
      if (code) window.dispatchEvent(new KeyboardEvent("keyup", { code }));
      else document.querySelector(`.town-key-${way}`)!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      w.__wayOff = true;
    };
    requestAnimationFrame(tick);
  }, [from, pad ? "" : KEY_OF[way], way] as const);
  if (pad) {
    await p.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
    await p.mouse.down();
  } else await p.keyboard.down(KEY_OF[way]);
  await p.waitForFunction(() => (window as unknown as { __wayOff: boolean }).__wayOff, null, { timeout: 10_000 });
  if (pad) await p.mouse.up();
  else await p.keyboard.up(KEY_OF[way]);
  // (Stopped: the step in progress ends, then the camera's spring settles on you.)
  await expect.poll(async () => (await p.evaluate(() => (window as unknown as Hooks).__shopRide?.()?.anim)) !== "move" || !ride, { timeout: 10_000 }).toBe(true);
  await p.waitForTimeout(250);
  const to = (await room(p).getAttribute("data-you"))!;
  const [a, b] = [from, to].map((s) => s.split(",").map(Number) as [number, number]);
  // The square you end on, drawn where the screen puts it: that way of where you were, both read in the same frame.
  const xy = await p.evaluate(([a, b]) => { const h = (window as unknown as Hooks).__shopAt!; return [h("square", a), h("square", b)]; }, [a, b] as const);
  expect(xy[0], `${label}: where you were (${from}) still on screen`).not.toBeNull();
  expect(xy[1], `${label}: where you are (${to}) on screen`).not.toBeNull();
  const dx = xy[1]!.x - xy[0]!.x;
  const dy = xy[1]!.y - xy[0]!.y;
  const msg = `${label}: ${from} -> ${to}, on screen dx ${dx.toFixed(1)} dy ${dy.toFixed(1)}`;
  if (way === "up") expect(dy, msg).toBeLessThan(-5);
  if (way === "down") expect(dy, msg).toBeGreaterThan(5);
  if (way === "left") expect(dx, msg).toBeLessThan(-5);
  if (way === "right") expect(dx, msg).toBeGreaterThan(5);
  // (Straight that way: the other axis barely moves; the ground's curve drops a far square a little: camera.ts `proj`.)
  if (way === "up" || way === "down") expect(Math.abs(dx), msg).toBeLessThan(2 + 0.1 * Math.abs(dy));
  else expect(Math.abs(dy), msg).toBeLessThan(2 + 0.1 * Math.abs(dx));
  const seen = await p.evaluate(() => { const w = (window as unknown as { __way: { foot: number[][]; moves: string[]; on: boolean } }).__way; w.on = false; return w; });
  // Your figure's feet on screen as you went: up the screen for up (the camera follows, so they lead it a little, then it catches up).
  const ys = seen.foot.map((f) => f[1]!);
  const xs = seen.foot.map((f) => f[0]!);
  if (way === "up") expect(Math.min(...ys) - ys[0]!, `${label}: your feet go up the screen`).toBeLessThan(-2);
  if (way === "down") expect(Math.max(...ys) - ys[0]!, `${label}: your feet go down the screen`).toBeGreaterThan(2);
  if (way === "up") expect(Math.max(...ys) - ys[0]!, `${label}: never down the screen`).toBeLessThan(1);
  if (way === "down") expect(Math.min(...ys) - ys[0]!, `${label}: never up the screen`).toBeGreaterThan(-1);
  if (way === "left") expect(Math.max(...xs) - xs[0]!, `${label}: never right`).toBeLessThan(1);
  if (way === "right") expect(Math.min(...xs) - xs[0]!, `${label}: never left`).toBeGreaterThan(-1);
  // On a ride, the view drawn while moving: its back going up, its front going down, its side across (facing that way).
  if (ride) {
    const want = way === "up" ? ["1:1", "1:-1"] : way === "down" ? ["2:1", "2:-1"] : way === "left" ? ["0:-1"] : ["0:1"];
    expect(seen.moves.length, `${label}: its move drawn`).toBeGreaterThan(0);
    for (const m of new Set(seen.moves)) expect(want, `${label}: the view drawn while moving (view:facing) ${[...new Set(seen.moves)].join(" ")}`).toContain(m);
  }
}

for (const ride of [false, true])
  test(`Eric's rule (Nov 5): up is up the screen in every room: Up, Down, Left and Right go that way on screen, by the keys and the on-screen arrows, in Babur's Circus, Alfil's Pyramid and Hollow Peak, ${ride ? "on a ride (its back going up, its front going down)" : "on foot"}`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    if (ride) {
      await page.goto("/");
      // (Your profile: "View profile" on your card on a phone, the side menu's Profile on a computer.)
      await expect(page.getByRole("button", { name: "View profile", exact: true }).or(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first()).toBeVisible();
      // (No crate holds a ride yet: given straight, as only admins have them.)
      const [chirp] = await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 0 }]);
      await wearItem(page, "ride", chirp!);
    }
    await page.goto("/town?sky=day");
    await townReady(page);
    if (ride) await expect.poll(async () => (await page.evaluate(() => (window as unknown as Hooks).__townRide!().you)).ready, { message: "your ride's frames are ready", timeout: 30_000 }).toBe(true);
    for (const [id, name] of KEY_ROOMS) {
      await goIn(page, id, name);
      if (ride) await expect.poll(async () => (await page.evaluate(() => (window as unknown as Hooks).__shopRide?.()?.ride ?? null))).toBe("riding-chirp");
      await page.waitForTimeout(800); // (the camera's spring settles on you)
      // (Up first: you start a step in from the door. Then back down, and across both ways.)
      for (const by of ["key", "pad"] as const) for (const way of ["up", "down", "left", "right"] as const) await screenWay(page, way, by, ride);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/room-keys-${id}-${ride ? "ride" : "foot"}-${test.info().project.name}.png` });
      await leaveRoom(page);
      await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
      await townReady(page);
    }
    expect(errors).toEqual([]);
  });

test("on a ride (Eric, Nov 2: \"your rider goes in with you\"): inside you're on it, its idle standing and its move walking, its back going up to the counter; you come out still on it", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "View profile", exact: true }).or(page.getByRole("navigation", { name: "Menu" }).getByRole("button", { name: "Profile" })).filter({ visible: true }).first()).toBeVisible();
  // (No crate holds a ride yet: given straight, as only admins have them.)
  const [chirp] = await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 0 }]);
  await wearItem(page, "ride", chirp!);
  await page.goto("/town?sky=day");
  await townReady(page);
  const townRide = () => page.evaluate(() => (window as unknown as Hooks).__townRide!().you);
  await expect.poll(async () => (await townRide()).ready, { message: "your ride's frames are ready", timeout: 30_000 }).toBe(true);
  const outside = await townRide();
  await goIn(page, "tiger", "Babur's Circus");
  const ride = () => page.evaluate(() => (window as unknown as Hooks).__shopRide?.() ?? null);
  // Inside, standing a step in from the door: on it, its idle, facing the counter (its back), at its own pace as outside.
  await expect.poll(async () => (await ride())?.anim).toBe("idle");
  expect(await ride()).toMatchObject({ ride: "riding-chirp", view: 1, stepMs: outside.stepMs });
  // Walking up to the Shopkeeper: its move, frame after frame; standing there, its idle again.
  await page.evaluate(() => {
    const w = window as unknown as { __shopRide?: () => { anim: string; frame: number; view: number } | null; __seen: Set<string> };
    w.__seen = new Set();
    const tick = () => {
      // (Until you go out: the hook goes with the room.)
      if (!w.__shopRide) return;
      const r = w.__shopRide();
      if (r?.anim) w.__seen.add(`${r.anim}:${r.frame}:${r.view}`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await talk(page);
  await expect(room(page)).toHaveAttribute("data-you", "12,5");
  await expect.poll(async () => (await ride())?.anim).toBe("idle");
  const seen = await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen]);
  const moves = seen.filter((k) => k.startsWith("move:"));
  expect(new Set(moves.map((k) => k.split(":")[1])).size, `its move's frames: ${seen.join(" ")}`).toBeGreaterThan(1);
  // (Up the room toward the counter: its back, as walking up the screen in the town.)
  expect(moves.some((k) => k.endsWith(":1")), `its back going up: ${seen.join(" ")}`).toBe(true);
  // Out by the back button (a computer: the door, no bar since Nov 7): in the town again, still on it.
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await townReady(page);
  expect(await townRide()).toMatchObject({ ride: "riding-chirp", ready: true });
  expect(errors).toEqual([]);
});

test("boss tokens: an admin gives himself Babur tokens and a crate key in the Crates tab, buys Babur's crate both ways (into the inventory, Nov 2), then opens both there with the usual strip; the counts follow", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await asServerAdmin(page);
  // The Crates tab: your keys (counted now), your crates, and every boss's token with how many you have (none: greyed).
  await page.goto("/shop?crates");
  const crates = page.locator(".crates");
  await expect(crates.getByText("Keys × 0")).toBeVisible();
  const babur = crates.locator('.token-cell[data-boss="tiger"]');
  await expect(babur).toContainText("× 0");
  await expect(babur).toHaveClass(/none/);
  // The admin's test grants: a key, then Babur's tokens.
  const grants = page.getByRole("region", { name: "Admin test grants" });
  await grants.getByRole("button", { name: "+1 crate key" }).click();
  await expect(crates.getByText("Keys × 1")).toBeVisible();
  await grants.getByRole("combobox", { name: "Boss" }).selectOption("tiger");
  await grants.getByRole("button", { name: "+3 tokens" }).click();
  await expect(babur).toContainText("× 3");
  await grants.getByRole("button", { name: "+1 token" }).click();
  await expect(babur).toContainText("× 4");
  await expect(babur).not.toHaveClass(/none/);
  await expect(babur.locator(".token-art")).toHaveAttribute("data-drawn", "1");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/inventory-tokens-${test.info().project.name}.png` });

  // Babur's tent: the card has the real counts, both ways open.
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "tiger", "Babur's Circus");
  await talk(page);
  const crate = page.getByRole("dialog", { name: "Babur's Boss Crate", exact: true });
  await expect(crate).toContainText("You have 4 Babur tokens and 1 crate key.");
  await expect(crate).toContainText("+ 24 Beta Crate items, Common to Epic");
  const byTokens = crate.getByRole("button", { name: "Buy with 3 Babur tokens" });
  const byKey = crate.getByRole("button", { name: "Buy with 1 Babur token + 1 crate key" });
  await expect(byTokens).toBeEnabled();
  await expect(byKey).toBeEnabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/shop-card-counts-${test.info().project.name}.png` });
  const before = (await crate.boundingBox())!;
  const answer = crate.locator(".shop-msg");
  // With 3 tokens: the crate goes into your inventory, unopened (Eric, Nov 2: "it says when you buy it it's in your inventory"); 1
  // token and the key left, so only the key's way stays open.
  await byTokens.click();
  await expect(answer).toHaveText("Babur's Boss Crate is in your inventory.");
  // (Its pop-up, Nov 12: Later keeps it in the inventory; Boingo's test below checks the pop-up itself.)
  const got = page.getByRole("dialog", { name: "You got Babur's Boss Crate!", exact: true });
  await got.getByRole("button", { name: "Later" }).click();
  await expect(got).toBeHidden();
  await expect(crate).toContainText("You have 1 Babur token and 1 crate key.");
  await expect(byTokens).toBeDisabled();
  await expect(byKey).toBeEnabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/shop-card-after-buy-${test.info().project.name}.png` });
  // With the token and the key: nothing left, both ways greyed.
  await byKey.click();
  await expect(crate).toContainText("You have 0 Babur tokens and 0 crate keys.");
  await expect(answer).toHaveText("Babur's Boss Crate is in your inventory.");
  await got.getByRole("button", { name: "Later" }).click();
  await expect(got).toBeHidden();
  await expect(byKey).toBeDisabled();
  await expect(byTokens).toBeDisabled();
  // (The answer's row was there all along: the card didn't grow.)
  expect((await crate.boundingBox())!.height).toBeCloseTo(before.height, 0);
  // Two of Babur's crates held, unopened: no item from them yet; nothing left to spend.
  type LockerNow = { items: { id: string; def: string }[]; tokens: Record<string, number>; keys: number; bossCrates: Record<string, number> };
  const lockerNow = async () => (await (await page.request.get("/api/locker")).json()) as LockerNow;
  const mine = (l: LockerNow) => l.items.filter((i) => !i.id.startsWith("admin:"));
  let locker = await lockerNow();
  expect(mine(locker)).toHaveLength(0);
  expect([locker.tokens, locker.keys, locker.bossCrates]).toEqual([{}, 0, { "boss-tiger": 2 }]);

  // The inventory (the Crates tab): Babur's crate with the other crates, "You have 2"; Puddles' greyed, "You have none".
  await page.goto("/shop?crates");
  const row = page.locator('.boss-crate-row[data-crate="boss-tiger"]');
  await expect(row).toContainText("Babur's Boss Crate");
  await expect(row).toContainText("You have 2");
  await expect(row).not.toHaveClass(/none/);
  await expect(page.locator('.boss-crate-row[data-crate="boss-gardener"]')).toContainText("You have none");
  await expect(page.locator('.boss-crate-row[data-crate="boss-gardener"]')).toHaveClass(/none/);
  if (SHOTS) {
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/inventory-boss-crates-${test.info().project.name}.png` });
  }
  // Open it as any crate opens: the strip spins, then the reveal (an item from Babur's crate).
  await row.click();
  await expect(page.locator(".crate-held")).toHaveText("You have 2.");
  const open = page.getByRole("button", { name: /^▶ Open$/ });
  await open.click();
  await expect(page.locator(".crate-opening .spin")).toBeVisible({ timeout: 15_000 });
  const reveal = page.locator(".reveal-card");
  await expect(reveal).toBeVisible({ timeout: 30_000 });
  const again = reveal.getByRole("button", { name: "▶ Open another" });
  await expect(again).toBeEnabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/boss-crate-reveal-${test.info().project.name}.png` });
  // The second, the last: then "Open another" is greyed (none left), and the page says so, its Open greyed.
  await again.click();
  await expect(page.locator(".crate-opening .spin")).toBeVisible({ timeout: 15_000 });
  await expect(reveal).toBeVisible({ timeout: 30_000 });
  await expect(reveal.getByRole("button", { name: "▶ Open another" })).toBeDisabled();
  await reveal.getByRole("button", { name: "▶ Done" }).click();
  await expect(page.locator(".crate-held")).toHaveText("You have none. Babur's shop in the town sells it.");
  await expect(open).toBeDisabled();
  // Two items from Babur's crate in the locker now, the crates gone.
  locker = await lockerNow();
  expect(mine(locker)).toHaveLength(2);
  for (const it of mine(locker)) expect(bossCrateOf("tiger")!.items).toContain(it.def);
  expect(locker.bossCrates).toEqual({});
  expect(errors).toEqual([]);
});

test("boss tokens: a counted boss battle (Boss alone, 5 minutes by the server's clock) drops one: the result screen's square box, OK, and it's in the inventory", { tag: "@phone-only" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Hollow mates you at once (?mate=1). The server times a solo battle itself: its finish waits while the battle's start is pushed
  // back 6 minutes in the local database, so it counts; a new account's window is empty, so it always drops a token.
  await page.goto("/?debug&clock=60&boss=hollow&mate=1");
  await page.route("**/api/boss/solo/finish", async (route) => {
    await backdateSoloBattle(page, 6 * 60_000);
    await route.continue();
  });
  await bossAloneFromHome(page);
  const box = page.getByRole("dialog", { name: /^You got an? .+ token!$/ });
  await expect(box).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Hollow won/)).toBeVisible();
  await expect(box.locator(".token-art")).toHaveAttribute("data-drawn", "1");
  const b = (await box.boundingBox())!;
  expect(Math.abs(b.width - b.height), "a square box").toBeLessThan(2);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/result-token-box-${test.info().project.name}.png` });
  const boss = await box.locator(".token-art").getAttribute("data-token");
  await box.getByRole("button", { name: "OK" }).click();
  await expect(box).toBeHidden();
  // The token is yours: one, of the boss the box showed.
  const locker = (await (await page.request.get("/api/locker")).json()) as { tokens: Record<string, number> };
  expect(locker.tokens).toEqual({ [boss!]: 1 });
  expect(errors).toEqual([]);
});

test("Boingo's Funhouse (Nov 6): Go in, the arcade (the play structure and slide, the squirt race, the spinning light game, the roll-ball lanes); the clown attendant keeps the prize counter, Boingo's Boss Crate with Boingo's Pogo", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Boingo is live for everyone, so his Funhouse is too: a player's town.)
  await page.goto("/town?sky=day");
  await townReady(page);
  await goIn(page, "clown", "Boingo's Funhouse");
  await expect(room(page)).toHaveAttribute("data-room", "clown");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Boingo's Funhouse");
  // A dark arcade full of lights: the chat's words light. It starts at the further-out camera, as every home.
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  await expect.poll(async () => (await shopCam(page))?.zoom, { message: "zoomed out" }).toBe(1);
  const name = test.info().project.name;
  const still = async (what: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${what}-${name}.png` });
  };
  const walkTo = async (sq: readonly [number, number]) => {
    await viewOnYou(page);
    await expect.poll(() => shopAt(page, "square", sq), { message: `square ${sq} drawn` }).not.toBeNull();
    const at = (await shopAt(page, "square", sq))!;
    await page.mouse.click(at.x, at.y);
    await expect(room(page)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 20_000 });
  };
  await still("door");
  // (Short hops, mostly north, away from the camera: a square more than about four away, or behind you, can be off a phone's screen.
  // Clear of the Shopkeeper's talking range, whose card would take the next tap.)
  await walkTo([9, 19]);
  await walkTo([6, 18]);
  await walkTo([4, 17]);
  await still("roll-ball");
  await walkTo([7, 15]);
  await walkTo([10, 14]);
  await walkTo([14, 14]);
  await walkTo([17, 13]);
  await still("spin-game");
  await walkTo([13, 10]);
  await walkTo([9, 10]);
  await walkTo([6, 10]);
  await still("play-structure");
  await walkTo([9, 8]);
  await walkTo([12, 7]);
  await walkTo([15, 6]);
  await walkTo([16, 4]);
  await still("squirt-race");
  await walkTo([13, 6]);
  // The clown attendant behind the counter: a tap on him walks you up to the counter; his card says "Shopkeeper", no name.
  await viewOnYou(page);
  await expect.poll(() => shopAt(page, "keeper"), { message: "the Shopkeeper is drawn" }).not.toBeNull();
  const at = (await shopAt(page, "keeper"))!;
  await page.mouse.click(at.x, at.y);
  const card = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("heading")).toHaveText(["Shopkeeper"]);
  await still("counter");
  await card.getByRole("button", { name: "Talk" }).click();
  const crate = page.getByRole("dialog", { name: "Boingo's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Boingo tokens, or 1 Boingo token + 1 crate key");
  // (His ride first among the prizes.)
  await expect(crate.locator(".shop-prize-name").first()).toHaveText("Boingo's Pogo");
  await expect(crate).toContainText("You have 0 Boingo tokens and 0 crate keys.");
  await expect(crate.getByRole("button", { name: "Buy with 3 Boingo tokens" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();
  await leaveRoom(page);
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * Boingo's Boss Crate bought in his Funhouse (Eric, Nov 12: "I just bought his box, and it just deducted my tokens ... but nothing
 * popped up"): the price line is plain words in the card's own color (not the Shop screen's cream button); a buy says so in the card's
 * row and pops up "You got Boingo's Boss Crate!" with its picture, Open now and Later. Later closes it (the crate is in your inventory);
 * a second buy's Open now opens it with the Crates tab's own opening (the strip, then the reveal), and the crate's count goes down.
 * docs/decisions/2026-11-12-boss-crate-bought.md.
 */
test("Boingo's Boss Crate bought in his Funhouse: the price line is plain words, a buy pops up \"You got Boingo's Boss Crate!\" with Open now and Later; Later keeps it, Open now opens it with the usual strip and reveal (Eric, Nov 12)", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (The stills at Eric's phone size, 428 x 746.)
  if (SHOTS && test.info().project.name === "phone") await page.setViewportSize({ width: 428, height: 746 });
  await asServerAdmin(page);
  await page.goto("/town?sky=day");
  await townReady(page);
  // Nine of Boingo's tokens and a key: three buys, the second with the key.
  for (const body of [{ boss: "clown", tokens: 3 }, { boss: "clown", tokens: 3 }, { boss: "clown", tokens: 3 }, { keys: 1 }]) {
    const r = await page.request.post("/api/locker/grant", { data: { ...body, request: `grant-${Math.random()}` } });
    expect(r.ok()).toBe(true);
  }
  type LockerNow = { tokens: Record<string, number>; keys: number; bossCrates: Record<string, number> };
  const held = async () => ((await (await page.request.get("/api/locker")).json()) as LockerNow).bossCrates["boss-clown"] ?? 0;
  await page.reload();
  await townReady(page);
  await page.evaluate(() => (window as unknown as { __townGlide?: (id: string) => void }).__townGlide?.("clown"));
  await goIn(page, "clown", "Boingo's Funhouse");
  const walkTo = async (sq: readonly [number, number]) => {
    await viewOnYou(page);
    await expect.poll(() => shopAt(page, "square", sq), { message: `square ${sq} drawn` }).not.toBeNull();
    const at = (await shopAt(page, "square", sq))!;
    await page.mouse.click(at.x, at.y);
    await expect(room(page)).toHaveAttribute("data-you", `${sq[0]},${sq[1]}`, { timeout: 20_000 });
  };
  await walkTo([14, 16]);
  await walkTo([15, 10]);
  await walkTo([13, 6]);
  await viewOnYou(page);
  await talk(page);
  const crate = page.getByRole("dialog", { name: "Boingo's Boss Crate", exact: true });
  await expect(crate).toContainText("You have 9 Boingo tokens and 1 crate key.");
  // The price line: plain words in the card's own color, not the Shop screen's cream price button.
  const price = crate.locator(".shop-room-price");
  await expect(price).toHaveText("3 Boingo tokens, or 1 Boingo token + 1 crate key");
  await expect(crate.locator(".shop-price")).toHaveCount(0);
  const look = await price.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, card: getComputedStyle(el.closest(".town-card")!).color, bg: s.backgroundColor, image: s.backgroundImage, radius: s.borderRadius, cursor: s.cursor };
  });
  expect(look).toEqual({ color: look.card, card: "rgb(255, 255, 255)", bg: "rgba(0, 0, 0, 0)", image: "none", radius: "0px", cursor: "default" });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/boingo-card-${test.info().project.name}.png` });
  const before = (await crate.boundingBox())!;
  const answer = crate.locator(".shop-msg");
  const got = page.getByRole("dialog", { name: "You got Boingo's Boss Crate!", exact: true });
  const byTokens = crate.getByRole("button", { name: "Buy with 3 Boingo tokens" });
  const byKey = crate.getByRole("button", { name: "Buy with 1 Boingo token + 1 crate key" });

  // 1. With tokens: the card's row says so, in the card's white, and the pop-up: the heading, the crate's picture, Open now and Later.
  await byTokens.click();
  await expect(answer).toHaveText("Boingo's Boss Crate is in your inventory.");
  expect(await answer.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).fontSize])).toEqual(["rgb(255, 255, 255)", "13px"]);
  await expect(got).toBeVisible();
  await expect(got.getByRole("heading")).toHaveText("You got Boingo's Boss Crate!");
  await expect(got.locator("canvas.shop-crate-pic")).toBeVisible();
  await expect(got.getByRole("button")).toHaveText(["Open now", "Later"]);
  for (const b of await got.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // (Over the card, which keeps its size and place under it.)
  expect((await crate.boundingBox())!).toEqual(before);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/boingo-got-${test.info().project.name}.png` });
  // Later: the pop-up closes, the card stays open; the crate is in the inventory, unopened.
  await got.getByRole("button", { name: "Later" }).click();
  await expect(got).toBeHidden();
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("You have 6 Boingo tokens and 1 crate key.");
  expect(await held()).toBe(1);

  // 2. With the key: the pop-up again; Open now opens it with the Crates tab's own opening (the strip, then the reveal), one crate fewer.
  await byKey.click();
  await expect(got).toBeVisible();
  expect(await held()).toBe(2);
  await got.getByRole("button", { name: "Open now" }).click();
  await expect(got).toBeHidden();
  const opening = page.locator(".shop-opening .crate-opening");
  await expect(opening).toBeVisible();
  await expect(opening.getByRole("heading", { level: 2 })).toHaveText("Boingo's Boss Crate");
  await expect.poll(held, { message: "opened: one fewer held" }).toBe(1);
  const reveal = opening.locator(".reveal-card");
  await expect(reveal).toBeVisible({ timeout: 30_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/boingo-reveal-${test.info().project.name}.png` });
  // Done: back in the room, the card as it was.
  await reveal.getByRole("button", { name: "▶ Done" }).click();
  await expect(opening).toBeHidden();
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("You have 5 Boingo tokens and 0 crate keys.");
  expect((await crate.boundingBox())!).toEqual(before);

  // 3. Buying again still works after Open now; Escape is Later (the card stays).
  await byTokens.click();
  await expect(got).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(got).toBeHidden();
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("You have 2 Boingo tokens and 0 crate keys.");
  expect(await held()).toBe(2);
  expect(errors).toEqual([]);
});

/**
 * The shop's screens (Eric, Nov 7), on a phone and a computer: no "Shop" title on any tab (the tab row says where you are); the
 * locker's tabs are All, Head, Face, Skin, Weapon and Ride (the God King tab is gone; its effects stay under All); the preview is
 * one pawn in a box twice its old height (126 px with its frame before, 252 now), with W and B bottom right. B makes the pawn black
 * and saves it on the account (signed in: it survives a reload; the town shows it, town-afk.spec.ts); W switches back. Number
 * checks: the box's height, the pawn's piece class (white or black), aria-pressed, the picker inside the box.
 */
test("the shop has no \"Shop\" title on any tab; the locker has one pawn in a box twice its old height, a W and B picker bottom right: B is black and saved (it survives a reload), W is white again (Eric, Nov 7)", async ({ page }) => {
  await asSignedIn(page, "pawn");
  await page.goto("/shop");
  for (const tab of ["Shop", "Crates", "Locker"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.locator(".shop-head h1")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Shop", exact: true })).toHaveCount(0);
  }
  await page.getByRole("tab", { name: "Locker", exact: true }).click();
  await expect(page.locator(".locker-tabs [role=tab]")).toHaveText(["All", "Head", "Face", "Skin", "Weapon", "Ride"]);
  await expect(page.getByRole("tab", { name: "God King", exact: true })).toHaveCount(0);
  // One pawn, white by default, in a box 252 px tall.
  await expect(page.locator(".locker-preview .avatar")).toHaveCount(1);
  await expect(page.locator(".locker-preview piece.pawn.white")).toHaveCount(1);
  expect(Math.round((await page.locator(".locker-preview").boundingBox())!.height)).toBe(252);
  const W = page.getByRole("button", { name: "White", exact: true });
  const B = page.getByRole("button", { name: "Black", exact: true });
  await expect(W).toHaveAttribute("aria-pressed", "true");
  await expect(B).toHaveAttribute("aria-pressed", "false");
  // The picker sits inside the box's bottom-right corner.
  const box = (await page.locator(".locker-preview").boundingBox())!;
  const pick = (await page.locator(".locker-pawn-pick").boundingBox())!;
  expect(pick.x + pick.width).toBeLessThanOrEqual(box.x + box.width);
  expect(pick.y + pick.height).toBeLessThanOrEqual(box.y + box.height);
  // Two small squares, one button each (30 px; a hit area of 40 px at most): each inside the box, not overlapping, its right and
  // bottom insets 12 px at most; no "default" word in the box; no God King button or tab.
  const btns = page.locator(".locker-pawn-letter");
  await expect(btns).toHaveCount(2);
  const sq = [(await btns.nth(0).boundingBox())!, (await btns.nth(1).boundingBox())!];
  for (const q of sq) {
    expect(q.width).toBeLessThanOrEqual(28);
    expect(q.height).toBeLessThanOrEqual(28);
    expect(q.x).toBeGreaterThanOrEqual(box.x);
    expect(q.y).toBeGreaterThanOrEqual(box.y);
    expect(q.x + q.width).toBeLessThanOrEqual(box.x + box.width);
    expect(q.y + q.height).toBeLessThanOrEqual(box.y + box.height);
  }
  expect(sq[0]!.x + sq[0]!.width, "W and B don't overlap").toBeLessThanOrEqual(sq[1]!.x);
  // The selected one is about 15% bigger than the other: W now (white selected), B after its tap below.
  expect(sq[0]!.width, "W selected: bigger than B").toBeGreaterThanOrEqual(sq[1]!.width * 1.1);
  // Each one's tap area is 32 px at least (an invisible ::before around the square).
  for (const i of [0, 1]) expect(parseFloat(await btns.nth(i).evaluate((el) => getComputedStyle(el, "::before").width))).toBeGreaterThanOrEqual(32);
  expect(box.x + box.width - (sq[1]!.x + sq[1]!.width), "right inset").toBeLessThanOrEqual(12);
  expect(box.y + box.height - Math.max(sq[0]!.y + sq[0]!.height, sq[1]!.y + sq[1]!.height), "bottom inset").toBeLessThanOrEqual(12);
  await expect(page.locator(".locker-preview")).not.toContainText(/default/i);
  await expect(page.getByRole("tab", { name: "God King", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "God King", exact: true })).toHaveCount(0);
  // The God King's effects are hidden from the locker and the shop (GOD_KING_SHOP, Nov 8): no "From the shop", no effects tab.
  await expect(page.getByText("From the shop")).toHaveCount(0);
  await expect(page.getByText("More God King effects")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Holy Light|God King effect|From the shop/);
  // B: black, saved on the account (the server says so), and it's still black after a reload.
  await B.click();
  await expect(B).toHaveAttribute("aria-pressed", "true");
  const [bw, ww] = [(await B.boundingBox())!.width, (await W.boundingBox())!.width];
  expect(bw, "B selected: bigger than W").toBeGreaterThanOrEqual(ww * 1.1);
  await expect(page.locator(".locker-preview svg.default-black")).toHaveCount(1);
  // Its outline reads on the box: the light stroke against the window's blue (styles.css, .ff-window: #2a3cbd, #13207a, #0a1150),
  // at least 3:1 against each (WCAG contrast ratio).
  const stroke = await page.locator(".locker-preview svg.default-black path").getAttribute("stroke");
  expect(stroke).toBe("#f5efe0");
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const blue of ["#2a3cbd", "#13207a", "#0a1150"]) expect(ratio(stroke!, blue), `outline on ${blue}`).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { user: { pawn: string } }).user.pawn).toBe("black");
  await page.reload();
  await page.goto("/shop");
  await page.getByRole("tab", { name: "Locker", exact: true }).click();
  await expect(page.locator(".locker-preview svg.default-black")).toHaveCount(1);
  await expect(B).toHaveAttribute("aria-pressed", "true");
  // W: white again, saved.
  await W.click();
  await expect(W).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".locker-preview piece.pawn.white")).toHaveCount(1);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { user: { pawn: string } }).user.pawn).toBe("white");
  // The Shop tab: no God King effects tab, and no "Coming later: King kill moves" line.
  await page.getByRole("tab", { name: "Shop", exact: true }).click();
  await expect(page.getByRole("tab", { name: "God King effects", exact: true })).toHaveCount(0);
  await expect(page.getByText("Coming later: King kill moves")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Holy Light|God King effect|From the shop/);
  // The Chat packs tab is off (CHAT_PACKS_SHOP, Nov 8): no tab and no pack for sale (the Winter pack too). Before: the tab
  // showed the Winter pack and no God King pack.
  await expect(page.getByRole("tab", { name: "Chat packs", exact: true })).toHaveCount(0);
  await expect(page.locator(".shop-item", { hasText: "Winter pack" })).toHaveCount(0);
  await expect(page.getByText("Everything in the shop is 50% off during beta.")).toBeVisible();
});

/**
 * The Shop tab's page (Eric's mockup, Nov 9; docs/decisions/2026-11-09-shop-page.md), look only: the line under the tabs, the special
 * offer (its tab, the bundle's words, the Mythic Crate's icon), the five cards in order, each (and the bundle) with the discount's ribbon
 * and its full price struck through beside the discounted one (from SHOP), the gold clock on the limited ones only, whose tap opens its
 * pop-up, and a price's tap "Buying opens soon"; neither moves anything. Phone: 2 cards a row; computer: 4.
 * SHOP_PAGE_SHOTS=<dir>: the PR's stills (phone 390 light and dark, top and scrolled; 320; the computer).
 */
test("the Shop tab's page (Eric's mockup, Nov 9): the special offer, five cards with the discount's ribbon and struck prices, the limited clock's pop-up, \"Buying opens soon\"; 2 a row on a phone, 4 on a computer", async ({ page, browser }, testInfo) => {
  const computer = testInfo.project.name === "desktop";
  await asSignedIn(page, "shopper");
  await page.goto("/shop");
  const pct = Math.round(SHOP.discount * 100);
  await expect(page.getByText(`Everything in the shop is ${pct}% off during beta.`)).toBeVisible();
  const offer = page.locator(".shop-offer");
  for (const words of ["SPECIAL OFFER", "Crate + Key Bundle", "3 Keys + 3 Random Crates", "Includes a chance at a", "Mythic Crate."]) await expect(offer).toContainText(words);
  await expect(offer.locator(".bundle-art svg")).toHaveCount(1);
  await expect(offer.locator(".shop-mythic-icon .mythic-crate-art")).toHaveCount(1);
  const cards = page.locator(".shop-card");
  await expect(cards.locator("strong")).toHaveText(["Boss Crate", "HunChess Crate", "Gift Crate", "Beta Crate", "Crate Key"]);
  await expect(page.locator('.shop-card[data-offer="boss"] .boss-crate-art')).toHaveCount(1);
  // The ribbon and the struck price on every card and the bundle, from the setting.
  for (const id of ["bundle", "boss", "hunchess", "gift", "beta", "key"] as const) {
    const box = page.locator(`[data-offer="${id}"]`);
    await expect(box.locator(".shop-ribbon")).toHaveText(discountLabel()!);
    await expect(box.locator(".shop-price s")).toHaveText(String(SHOP.prices[id]));
    await expect(box.locator(".shop-price b")).toHaveText(String(shopPrice(SHOP.prices[id])));
  }
  expect(discountLabel()).toBe(`${pct}% OFF`);
  // The clock on the limited items only.
  await expect(page.locator(".shop-card:has(.shop-clock)")).toHaveCount(SHOP.limited.length);
  for (const id of ["boss", "hunchess", "key"]) await expect(page.locator(`.shop-card[data-offer="${id}"] .shop-clock`)).toHaveCount(0);
  // 2 a row on a phone, 4 on a computer.
  const tops = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  const perRow = tops.filter((t) => t === tops[0]).length;
  expect(perRow, "cards a row").toBe(computer ? 4 : 2);
  // The pop-ups: the clock's words, then a price's; nothing moves while either shows.
  const boxes = () => page.locator(".shop-offer, .shop-card, .area-tabs, .shop-line").evaluateAll((els) =>
      els.map((e) => {
        // (In the page, not the window: a tap may scroll its button into view.)
        const b = e.getBoundingClientRect();
        return [b.left + scrollX, b.top + scrollY, b.width, b.height].map(Math.round).join(",");
      }),
    );
  const before = await boxes();
  await page.locator('.shop-card[data-offer="gift"] .shop-clock').click();
  const pop = page.getByRole("dialog");
  await expect(pop).toHaveText(/Limited: a rotating shop item\. It leaves the shop when its time is up\./);
  expect(await boxes()).toEqual(before);
  await pop.getByRole("button", { name: "OK" }).click();
  await expect(pop).toHaveCount(0);
  await page.locator('.shop-card[data-offer="key"] .shop-price').click();
  await expect(pop).toHaveText(/Buying opens soon\./);
  expect(await boxes()).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
  // Escape the moment the pop-up is in the page (before it's painted): it closes too. (Its listener waited for a paint, so an Escape
  // pressed as it opened was lost: this test on CI, Nov 11. docs/decisions/2026-11-11-flaky-batch.md)
  await page.evaluate(() => {
    const w = window as unknown as { __popEsc?: boolean };
    w.__popEsc = false;
    const obs = new MutationObserver(() => {
      if (!document.querySelector(".shop-pop")) return;
      obs.disconnect();
      w.__popEsc = true;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  await page.locator('.shop-card[data-offer="key"] .shop-price').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __popEsc?: boolean }).__popEsc)).toBe(true);
  await expect(pop).toHaveCount(0);
  await page.locator('.shop-offer .shop-price').click();
  await expect(pop).toHaveText(/Buying opens soon\./);
  await page.mouse.click(5, 5);
  await expect(pop).toHaveCount(0);
  // The stills, at deviceScaleFactor 2, in a context of their own (the same account), from the computer's run.
  const shots = process.env.SHOP_PAGE_SHOTS;
  if (shots && computer) {
    const state = await page.context().storageState();
    const sizes = [
      ["phone-390", 390, 844, ["light", "dark"]],
      ["phone-320", 320, 640, ["light"]],
      ["computer-1440", 1440, 900, ["light", "dark"]],
    ] as const;
    for (const [name, width, height, schemes] of sizes) {
      for (const colorScheme of schemes) {
        const ctx = await browser.newContext({ storageState: state, deviceScaleFactor: 2, viewport: { width, height }, colorScheme, baseURL: testInfo.project.use.baseURL });
        const p = await ctx.newPage();
        await p.goto("/shop");
        await expect(p.locator(".shop-card")).toHaveCount(5);
        await p.waitForTimeout(400);
        await p.screenshot({ path: `${shots}/${name}-${colorScheme}-top.png` });
        if (!name.startsWith("computer")) {
          await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          await p.waitForTimeout(300);
          await p.screenshot({ path: `${shots}/${name}-${colorScheme}-scrolled.png` });
        }
        await ctx.close();
      }
    }
  }
});

/**
 * The shop page's width (Eric, Nov 8): on a computer (the desktop project, 1440 by 900) all three tabs sit 120 to 160 px in from the
 * main column on each side (about one filter chip, 140 px), and the tabs row, the blue box, the chips row and the first item card
 * share its left and right edges within 2 px (the card's right edge is its grid's). On a phone the old 14 px gutter is unchanged.
 * PADDED_SHOTS=<dir>: the three tabs' stills at 1440 by 900.
 */
test("the shop page's width (Eric, Nov 8): on a computer all three tabs sit 120 to 160 px in from the main column, edges aligned; on a phone the 14 px gutter stays", async ({ page }, testInfo) => {
  const computer = testInfo.project.name === "desktop";
  if (computer) await page.setViewportSize({ width: 1440, height: 900 });
  await asSignedIn(page, "pawn");
  await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 40 }]);
  await page.goto("/shop");
  const cases = [
    // The Shop tab's page (Nov 9): the special offer's banner and its cards (paused Nov 8 while nothing was for sale).
    { tab: "Shop", shot: "shop", chips: null, box: ".shop-offer", card: ".shop-card", grid: ".shop-cards" },
    { tab: "Crates", shot: "crates", chips: null, box: null, card: ".crates .crate-row", grid: ".crates" },
    { tab: "Locker", shot: "locker-W", chips: ".locker-tabs", box: ".locker-preview", card: ".locker-item", grid: ".locker-grid" },
  ] as const;
  const rect = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, r: b.right };
    });
  for (const c of cases) {
    await page.getByRole("tab", { name: c.tab, exact: true }).click();
    await expect(page.locator(c.card).first()).toBeVisible();
    const col = await rect(".screen.shop");
    // The tabs row, the blue box, the chips row, and the first card (its left edge, and its grid's right edge).
    const els: [string, { l: number; r: number }][] = [["tabs", await rect(".area-tabs")]];
    if (c.box) els.push(["blue box", await rect(c.box)]);
    if (c.chips) els.push(["chips", await rect(c.chips)]);
    els.push(["first card", { l: (await rect(c.card)).l, r: (await rect(c.grid)).r }]);
    const tabs = els[0]![1];
    for (const [name, e] of els) {
      const inL = e.l - col.l;
      const inR = col.r - e.r;
      if (computer) {
        expect(inL, `${c.tab}: ${name} left inset`).toBeGreaterThanOrEqual(120);
        expect(inL, `${c.tab}: ${name} left inset`).toBeLessThanOrEqual(160);
        expect(inR, `${c.tab}: ${name} right inset`).toBeGreaterThanOrEqual(120);
        expect(inR, `${c.tab}: ${name} right inset`).toBeLessThanOrEqual(160);
      } else {
        // The old gutter: 14 px each side.
        expect(Math.abs(inL - 14), `${c.tab}: ${name} left inset`).toBeLessThanOrEqual(1);
        expect(Math.abs(inR - 14), `${c.tab}: ${name} right inset`).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(e.l - tabs.l), `${c.tab}: ${name} left edge`).toBeLessThanOrEqual(2);
      expect(Math.abs(e.r - tabs.r), `${c.tab}: ${name} right edge`).toBeLessThanOrEqual(2);
    }
    const shots = process.env.PADDED_SHOTS;
    if (computer && shots) await page.screenshot({ path: `${shots}/${c.shot}-computer-padded.png` });
  }
});
