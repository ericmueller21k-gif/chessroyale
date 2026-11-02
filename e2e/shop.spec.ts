import { expect, type Page } from "@playwright/test";
import { giveItems, test, wearItem } from "./helpers.ts";

/**
 * Inside a shop (Nov 2, round 1; docs/areas/town-square.md, "Inside a shop"), on a phone and a computer: walk up to Babur's
 * Circus, its card's "Go in" (you walk to the door, the town zooms in on it and fades), you start inside in Close (the third-person
 * camera; − and + switch to the town's zoomed-in camera and back), a tap on the Shopkeeper walks you up to the counter and its card
 * says "Shopkeeper" with Talk, Talk opens "Babur's Boss Crate" (the price line, Balloon Pup among the prizes, what you have, and a buy
 * answering "Coming soon"), then the door's "Go out" brings you back outside at the tent's door. And Puddles' greenhouse: Drizzle's
 * crate, his ride, and the back button takes you out.
 * And on a ride (Nov 2): it comes in with you, and you come out still on it.
 * Test hooks: the room's canvas (`canvas.town-shop-canvas`) carries `data-room`, `data-you="c,r"` and `data-ready="1"`;
 * `window.__shopAt("keeper" | "door" | "square", [c, r]?)` says where to tap; `__shopCam()` the room's camera; `__shopRide()` your
 * ride inside (its id, the animation and frame drawn last, its side and view, the step's time).
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

const town = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __shopAt?: (k: string, sq?: readonly [number, number]) => { x: number; y: number } | null;
  __shopCam?: () => { zoom: number; zoomTarget: number; room: string; focus: [number, number] } | null;
  __shopRide?: () => { ride: string | null; anim: "" | "idle" | "move"; frame: number; facing: number; view: number; stepMs: number } | null;
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

/** Walks up to a home (its chip glides the camera there if it's off screen) and opens its card: its "Go in". */
async function goIn(p: Page, id: string, name: string) {
  if (!(await homeAt(p, id))) await p.getByRole("button", { name: `Go to ${name}` }).dispatchEvent("click");
  await expect.poll(() => homeAt(p, id), { message: `${name} comes into view` }).not.toBeNull();
  const card = p.getByRole("dialog", { name, exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    // (A boss strolling in front of its home may take the tap: close its card and tap again.)
    if (await p.getByRole("dialog").isVisible()) await p.keyboard.press("Escape");
    const at = await homeAt(p, id);
    expect(at, "drawn").not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  // The other homes' cards keep "Shop" greyed and "Coming soon"; these two add "Go in" (shown, tappable).
  await expect(card.getByRole("button", { name: "Shop" })).toBeDisabled();
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
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

test("Babur's tent: Go in, start in Close, talk to the Shopkeeper, the crate's price and Balloon Pup, then Go out at the tent's door", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  await goIn(page, "tiger", "Babur's Circus");
  // Outside, you stood at the tent's door (the square in front of it) as you went in.
  const door = await town(page).getAttribute("data-you");
  const [dc, dr] = door!.split(",").map(Number) as [number, number];
  expect(Math.abs(dc - 28) + Math.abs(dr - 2), `at the door (28, 2): ${door}`).toBeLessThanOrEqual(2);
  // Inside: a step in from the door, in Close (the + is the pressed one), the town's chips put away.
  await expect(room(page)).toHaveAttribute("data-room", "tiger");
  await expect(room(page)).toHaveAttribute("data-you", "10,17");
  expect((await shopCam(page))!.zoom).toBe(0);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".town-chip").first()).toBeHidden();
  // − zooms out to the town's zoomed-in camera, + back into Close.
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(async () => (await shopCam(page))!.zoom).toBe(1);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => (await shopCam(page))!.zoom).toBe(0);

  // The Shopkeeper (Stripes, beside the counter): a tap walks you up in front of it; its card; Talk opens the crate's.
  await talk(page);
  await expect(room(page)).toHaveAttribute("data-you", "12,5");
  const crate = page.getByRole("dialog", { name: "Babur's Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate.getByRole("heading", { name: "Babur's Boss Crate" })).toBeVisible();
  await expect(crate).toContainText("3 Babur tokens, or 1 Babur token + 1 crate key");
  await expect(crate).toContainText("Balloon Pup");
  await expect(crate).toContainText("You have 0 Babur tokens and 0 crate keys.");
  const answer = crate.locator(".shop-msg");
  const before = (await crate.boundingBox())!;
  await crate.getByRole("button", { name: "Buy with 3 Babur tokens" }).click();
  await expect(answer).toHaveText("Coming soon");
  await crate.getByRole("button", { name: "Buy with 1 Babur token + 1 crate key" }).click();
  await expect(answer).toHaveText("Coming soon");
  // (The answer's row was there all along: the card didn't grow.)
  expect((await crate.boundingBox())!.height).toBeCloseTo(before.height, 0);
  await page.keyboard.press("Escape");
  await expect(crate).toBeHidden();

  // Back to the door: it's behind you (the camera looks north), so drag the view back toward it (a drag looks around) until it's
  // on screen, then tap it: you walk there and its card says "Go out".
  const box = (await room(page).boundingBox())!;
  await expect(async () => {
    if (await shopAt(page, "door")) return;
    // Back first (down the screen), then sideways toward the door's columns (a drag to the right moves the view left).
    const [cx, cy] = (await shopCam(page))!.focus;
    const side = cy < 18 ? 0 : Math.sign(cx - 9.5) * 0.15;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * (0.5 + side), box.y + box.height * (cy < 18 ? 0.7 : 0.3), { steps: 8 });
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
  await expect(town(page)).toHaveAttribute("data-you", door!);
  await expect(page.locator(".town-fade")).toHaveCSS("opacity", "0", { timeout: 5000 });
  expect(errors).toEqual([]);
});

test("Puddles' greenhouse: Go in, Drizzle's crate with Puddles's Mower; the back button takes you out", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  await goIn(page, "gardener", "Puddles' Botanical Garden");
  await expect(room(page)).toHaveAttribute("data-room", "gardener");
  await talk(page);
  const crate = page.getByRole("dialog", { name: "Puddles' Boss Crate", exact: true });
  await expect(crate).toBeVisible();
  await expect(crate).toContainText("3 Puddles tokens, or 1 Puddles token + 1 crate key");
  await expect(crate).toContainText("Puddles's Mower");
  // Inside, back is "out to the town square", not home.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  expect(errors).toEqual([]);
});

test("on a ride (Eric, Nov 2: \"your rider goes in with you\"): inside you're on it, its idle standing and its move walking, its back going up to the counter; you come out still on it", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Your profile" })).toBeVisible();
  // (No crate holds a ride yet: given straight, as only admins have them.)
  const [chirp] = await giveItems(page, [{ def: "riding-chirp", color: "cobalt", blemish: 0 }]);
  await wearItem(page, "ride", chirp!);
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
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
    const w = window as unknown as { __shopRide: () => { anim: string; frame: number; view: number } | null; __seen: Set<string> };
    w.__seen = new Set();
    const tick = () => {
      const r = w.__shopRide();
      if (r?.anim) w.__seen.add(`${r.anim}:${r.frame}:${r.view}`);
      if (w.__shopRide) requestAnimationFrame(tick);
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
  // Out by the back button: in the town again, still on it.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(room(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  expect(await townRide()).toMatchObject({ ride: "riding-chirp", ready: true });
  expect(errors).toEqual([]);
});
