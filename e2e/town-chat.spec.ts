import { expect, type Page } from "@playwright/test";
import { CHAT } from "../packages/app/src/town/chat.ts";
import { test } from "./helpers.ts";

/**
 * The town square's chat log (Oct 28; docs/areas/town-square.md, "The chat log"), on a phone and a computer: the log in the map's
 * top left corner, a line a message ("[9:41] Name: message"), at most 5 lines on a phone and 12 on a computer, fading after
 * `fadeAfterMs` and coming back with the next message; the box takes no taps (a tap through it reaches the map) except a
 * player's line; the text field (only where the test switches are allowed: here they are); press and hold to move the box,
 * remembered; the edge chips keep off its box, shown or not, wherever it is; the keyboard doesn't resize or move the town.
 * Test hooks (the test switches on): `__townSay()` (someone from the table talks now) or `__townSay(name, text, kind)`,
 * `__townChatter(false)` (no chatter of its own while a test looks), `__townTapped` (taps on player lines).
 */
test.use({ actionTimeout: 15_000 });

type Box = { x: number; y: number; w: number; h: number };
const canvas = (p: Page) => p.locator("canvas.town-canvas");
const log = (p: Page) => p.locator(".tc-log");
const rectOf = (p: Page, sel: string): Promise<Box> =>
  p.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
const meets = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const you = async (p: Page) => (await canvas(p).getAttribute("data-you"))!;
/** Waits until your pawn has stopped (its square the same for a while). */
async function settle(p: Page) {
  let last = "";
  for (let n = 0; n < 40; n++) {
    const now = await you(p);
    if (now === last) return;
    last = now;
    await p.waitForTimeout(800);
  }
}
/** The same box, within a pixel (a place is remembered to whole pixels). */
const near = (a: Box, b: Box) => expect([a.x, a.y, a.w, a.h].map((v, i) => Math.abs(v - [b.x, b.y, b.w, b.h][i]!) <= 1)).toEqual([true, true, true, true]);
const say = (p: Page, name: string, text: string, kind = "boss") => p.evaluate(([n, t, k]) => (window as any).__townSay(n, t, k), [name, text, kind]);

/** The town, open, with the bosses' and kids' own chatter stopped (it speaks every 20 to 45 s: a test looks at its own lines). */
async function open(page: Page, query = "") {
  await page.goto(`/town?sky=day${query}`);
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await page.waitForFunction(() => typeof (window as any).__townSay === "function");
  await page.evaluate(() => (window as any).__townChatter(false));
}

/** Every chip showing: its face's box, and what it points to. */
const chips = (p: Page) =>
  p.locator(".town-chip").evaluateAll((els) =>
    els
      .filter((e) => getComputedStyle(e).display !== "none")
      .map((e) => {
        const r = e.querySelector(".town-chip-face")!.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, name: e.querySelector("button")!.getAttribute("aria-label")! };
      }),
  );

/** Press and hold on the map where the box lies, then drag: the box is picked up and put down at the end. */
async function carry(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(CHAT.holdMs + 200);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
/** Where to press on the box: over its lines, away from the text field's strip and a player's line. */
const grip = (b: Box) => ({ x: b.x + 24, y: b.y + 16 });

test("the chat log: a line shows in the top left with its time and name; at most 5 lines on a phone and 12 on a computer; it fades after the wait and comes back with the next", async ({ page }, info) => {
  const phone = info.project.name === "phone";
  await open(page);
  const map = await rectOf(page, ".town-box");
  const b0 = await rectOf(page, ".town-chat");
  // The top left corner of the map: a phone's from its left edge to about two thirds across and down about a fifth (to a
  // quarter), a computer's wider and taller, both clear of the buttons (−, +, "Back to me": bottom right).
  expect(b0.x - map.x, "at the map's left edge").toBeLessThan(20);
  expect(b0.y - map.y, "at the map's top").toBeLessThan(20);
  if (phone) {
    expect(b0.w / map.w).toBeGreaterThan(0.55);
    expect(b0.w / map.w).toBeLessThan(0.75);
    expect(b0.h / map.h).toBeGreaterThan(0.15);
    expect(b0.h / map.h).toBeLessThan(0.3);
  } else {
    expect(b0.w).toBeGreaterThanOrEqual(400);
    expect(b0.h).toBeGreaterThanOrEqual(300);
  }
  const controls = await rectOf(page, ".town-controls");
  expect(meets(b0, controls), "the box never covers the buttons").toBe(false);
  const bar = await rectOf(page, ".town-bar");
  expect(b0.y, "under the bar: on the map").toBeGreaterThanOrEqual(bar.y + bar.h);

  // Nothing said yet: nothing shows (and the box's size is the same all the same).
  await expect(page.locator(".tc-line")).toHaveCount(0);
  await expect(log(page)).toHaveCSS("opacity", "0");

  await say(page, "Hollow", "The park gets quiet after dark.");
  const first = page.locator(".tc-line").first();
  await expect(first).toHaveText(/^\[(1[0-2]|[1-9]):[0-5]\d\] Hollow: The park gets quiet after dark\.$/);
  await expect(log(page)).toHaveCSS("opacity", "1");
  const name = first.locator("b.tc-name");
  await expect(name).toHaveText("Hollow");
  expect(Number(await name.evaluate((el) => getComputedStyle(el).fontWeight)), "the name is bold").toBeGreaterThanOrEqual(700);
  // The time is this device's clock, hours and minutes, 12-hour, no am/pm.
  const shown = (await first.locator(".tc-time").textContent())!;
  const clocks = await page.evaluate(() => [0, -1].map((m) => { const d = new Date(Date.now() + m * 60000); return `[${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}]`; }));
  expect(clocks, "this device's time").toContain(shown);
  const lb = await rectOf(page, ".tc-line");
  expect(lb.x).toBeGreaterThanOrEqual(b0.x - 1);
  expect(lb.x + lb.w).toBeLessThanOrEqual(b0.x + b0.w + 1);
  expect(lb.y + lb.h, "newest at the bottom, above the text field's strip").toBeLessThanOrEqual(b0.y + b0.h - 30);

  // At most the cap, the newest last; the box keeps its place and size whatever it holds.
  const cap = phone ? 5 : 12;
  for (let i = 1; i <= cap + 4; i++) await say(page, i % 2 ? "Sparky" : "Tex", `line ${i}`, "kid");
  await expect(page.locator(".tc-line")).toHaveCount(cap);
  await expect(page.locator(".tc-line").last()).toHaveText(new RegExp(`line ${cap + 4}$`));
  await expect(page.locator(".tc-line").first()).toHaveText(new RegExp(`line ${5}$`));
  // A long message wraps to two lines at most, then "…".
  const long = "word ".repeat(40).trim();
  await say(page, "Eric", long, "player");
  const mine = page.locator(".tc-line").last();
  const m = await mine.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight, lh: parseFloat(getComputedStyle(el).lineHeight), clamp: getComputedStyle(el).webkitLineClamp }));
  expect(m.clamp).toBe("2");
  expect(m.h, "at most two lines").toBeLessThanOrEqual(2 * m.lh + 6);
  expect(m.sh, "cut off, with dots").toBeGreaterThan(m.h);
  expect(await rectOf(page, ".town-chat")).toEqual(b0);

  // A player's line takes taps while it shows; a boss's or kid's lets them through.
  await expect(mine).toHaveCSS("pointer-events", "auto");
  await expect(page.locator(".tc-kid").first()).toHaveCSS("pointer-events", "none");

  // It fades `fadeAfterMs` after the last message, not before (and its lines are still kept).
  const said = Date.now();
  await page.waitForTimeout(CHAT.fadeAfterMs - 2000);
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(log(page)).toHaveCSS("opacity", "0", { timeout: 15_000 });
  expect(Date.now() - said, "not before the wait").toBeGreaterThanOrEqual(CHAT.fadeAfterMs);
  await expect(page.locator(".tc-line")).toHaveCount(cap);
  expect(await rectOf(page, ".town-chat"), "the same place and size, faded").toEqual(b0);
  await expect(mine, "a faded line takes no taps").toHaveCSS("pointer-events", "none");

  // The next message brings it back, with the recent lines.
  await say(page, "Sparky", "back again", "kid");
  await expect(log(page)).toHaveCSS("opacity", "1");
  await expect(page.locator(".tc-line")).toHaveCount(cap);
  await expect(page.locator(".tc-line").last()).toHaveText(/Sparky: back again$/);
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
});

test("a tap through the box reaches the map (a boss's or kid's line takes none); a player's line takes its own tap and the map stays put", async ({ page }) => {
  await open(page);
  await say(page, "Hollow", "The park gets quiet after dark.");
  await say(page, "Sparky", "Ooh, sparkly!", "kid");
  const lines = page.locator(".tc-line");
  await expect(lines).toHaveCount(2);
  const at = async (sel: string) => {
    const r = await rectOf(page, sel);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };
  const pointOf = (p: { x: number; y: number }) => page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y)!; return e.tagName === "CANVAS" ? "canvas" : e.closest(".tc-player") ? "player's line" : e.className; }, p);
  const kid = await at(".tc-kid");
  expect(await pointOf(kid), "the pointer goes through a kid's line to the map").toBe("canvas");
  expect(await pointOf(await at(".tc-boss"))).toBe("canvas");

  // A tap there is the map's: you set off walking (or the Colosseum's card opens, where its picture lies under the box).
  const start = await you(page);
  await page.mouse.click(kid.x, kid.y);
  await expect.poll(async () => (await you(page)) !== start || (await page.getByRole("dialog").count()) > 0, { message: "the tap reached the map", timeout: 6000 }).toBe(true);

  // A player's line: the pointer stops on it, and a tap on it is its own (listed by the test hook), not the map's.
  await page.keyboard.press("Escape");
  await say(page, "Eric", "please check this line", "player");
  const mine = page.locator(".tc-player").last();
  await expect(mine).toHaveCSS("pointer-events", "auto");
  const p = await at(".tc-player");
  expect(await pointOf(p)).toBe("player's line");
  await page.waitForTimeout(1500); // (your walk, if it was one, comes to an end)
  const before = await you(page);
  const dialogs = await page.getByRole("dialog").count();
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => (window as any).__townTapped ?? [])).toEqual(["please check this line"]);
  await page.waitForTimeout(700);
  expect(await you(page), "the map didn't see the tap").toBe(before);
  expect(await page.getByRole("dialog").count()).toBe(dialogs);
});

test("the text field (where the test switches are on): 80 characters, a count near the end, one message per 15 seconds with the wait in the field, your line in the log as a player", async ({ page }) => {
  await open(page);
  const field = page.locator(".tc-form input");
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute("placeholder", "Say something…");
  await expect(field).toHaveAttribute("enterkeyhint", "send");
  await expect(field).toHaveAttribute("maxlength", "80");
  expect(await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), "16 px or more: iPhone Safari doesn't zoom in").toBeGreaterThanOrEqual(16);
  await expect(page.locator(".tc-form button"), "no send button in the box").toHaveCount(0);
  // Inside the box, at its foot, the same size with or without it.
  const b = await rectOf(page, ".town-chat");
  const f = await rectOf(page, ".tc-form");
  expect(f.y + f.h).toBeLessThanOrEqual(b.y + b.h + 1);
  expect(f.y).toBeGreaterThan(b.y + b.h / 2);

  await field.click();
  await page.keyboard.type("a".repeat(69));
  await expect(page.locator(".tc-left"), "no count until near the end").toHaveCount(0);
  await page.keyboard.type("bcdef");
  await expect(page.locator(".tc-left")).toHaveText("6 left");
  await page.keyboard.type("x".repeat(30)); // (the field stops at 80)
  await expect(field).toHaveValue(/^a{69}bcdefxxxxxx$/);
  await expect(page.locator(".tc-left")).toHaveText("0 left");
  await field.fill("hello town");
  await page.keyboard.press("Enter");

  // Your line: your name, kind "player"; the field empties, lets go, and shows the wait.
  const mine = page.locator(".tc-player");
  await expect(mine).toHaveCount(1);
  await expect(mine).toHaveText(/^\[\d{1,2}:\d{2}\] .+: hello town$/);
  await expect(mine.locator("b.tc-name")).not.toHaveText("");
  await expect(field).toHaveValue("");
  await expect(field).toBeDisabled();
  await expect(field).toHaveAttribute("placeholder", /^Wait (1[0-5]|[1-9]) s$/);
  await expect(field).not.toBeFocused();
  expect(await rectOf(page, ".town-chat"), "the box didn't change").toEqual(b);
  // It counts down and gives the field back after 15 seconds.
  await expect(field).toBeEnabled({ timeout: 17_000 });
  await expect(field).toHaveAttribute("placeholder", "Say something…");
  await field.click();
  await page.keyboard.type("second one");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tc-player")).toHaveCount(2);
  await expect(page.locator(".tc-player").last()).toHaveText(/second one$/);
});

test("without the test switches there is no text field: players see the log only", async ({ page }) => {
  await page.route("**/api/auth/config", (route) => route.fulfill({ json: { accounts: false, google: false, email: false } }));
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  await expect(page.locator(".town-chat")).toHaveCount(1);
  await expect(page.locator(".tc-form")).toHaveCount(0);
  await page.evaluate(() => (window as any).__townSay?.("Hollow", "hello", "boss"));
  await page.waitForTimeout(400);
  await expect(page.locator(".tc-line"), "the hooks are off too").toHaveCount(0);
  // The box is the same size with or without the field's strip.
  expect((await rectOf(page, ".town-chat")).h).toBeGreaterThan(100);
});

test("press and hold on the box and drag it anywhere on the map; it stays, is remembered, never leaves the map or covers the buttons; a tap or a drag without the hold is the map's", async ({ page }) => {
  await open(page);
  await say(page, "Hollow", "The park gets quiet after dark.");
  await expect(log(page)).toHaveCSS("opacity", "1");
  const map = await rectOf(page, ".town-box");
  const b0 = await rectOf(page, ".town-chat");
  const g = grip(b0);
  const start = await you(page);
  const cam0 = await page.evaluate(() => (window as any).__townCam().focus as number[]);

  // A plain tap on the box is the map's: you walk (or a card opens); the box stays. (Low in the box, over the lines, where the
  // map under it is ground or the Colosseum: its top corner is sky.)
  const tap = { x: b0.x + b0.w / 2, y: b0.y + b0.h - 60 };
  await page.mouse.click(tap.x, tap.y);
  await expect.poll(async () => (await you(page)) !== start || (await page.getByRole("dialog").count()) > 0, { timeout: 6000 }).toBe(true);
  await page.keyboard.press("Escape");
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
  await settle(page);

  // A drag that starts on the box without the hold is the map's: the camera looks around; the box stays.
  const here = await you(page);
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 40, g.y + 120, { steps: 6 });
  await page.mouse.up();
  expect(await rectOf(page, ".town-chat")).toEqual(b0);
  const cam1 = await page.evaluate(() => (window as any).__townCam().focus as number[]);
  expect(Math.hypot(cam1[0]! - cam0[0]!, cam1[1]! - cam0[1]!), "the camera moved").toBeGreaterThan(0.3);
  expect(await you(page)).toBe(here);
  await page.getByRole("button", { name: "Back to me" }).click();

  // Press and hold, then drag: it goes with the finger (a little right and down), the map doesn't see it.
  await settle(page);
  const walk = await you(page);
  await carry(page, grip(b0), { x: grip(b0).x + 60, y: grip(b0).y + 90 });
  const b1 = await rectOf(page, ".town-chat");
  expect(b1.x - b0.x).toBeCloseTo(60, 0);
  expect(b1.y - b0.y).toBeCloseTo(90, 0);
  expect(b1.w).toBe(b0.w);
  expect(b1.h).toBe(b0.h);
  await page.waitForTimeout(600);
  expect(await you(page), "a held box isn't a tap on the map").toBe(walk);
  expect(await page.getByRole("dialog").count()).toBe(0);
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CHAT.storageKey))!)).toEqual({ x: Math.round(b1.x - map.x), y: Math.round(b1.y - map.y) });

  // Dropped over the buttons or off the map: it ends inside the map and clear of them.
  const controls = await rectOf(page, ".town-controls");
  await carry(page, grip(b1), { x: controls.x + controls.w / 2, y: controls.y + controls.h / 2 });
  const b2 = await rectOf(page, ".town-chat");
  expect(meets(b2, controls), "never over the buttons").toBe(false);
  expect(b2.x).toBeGreaterThanOrEqual(map.x);
  expect(b2.y).toBeGreaterThanOrEqual(map.y);
  expect(b2.x + b2.w).toBeLessThanOrEqual(map.x + map.w);
  expect(b2.y + b2.h).toBeLessThanOrEqual(map.y + map.h);
  await carry(page, grip(b2), { x: map.x + 2, y: map.y + 2 });
  const b3 = await rectOf(page, ".town-chat");
  expect(b3.x).toBeGreaterThanOrEqual(map.x);
  expect(b3.y).toBeGreaterThanOrEqual(map.y);

  // It stays where it was dropped, also after a reload (remembered on this device).
  await carry(page, grip(b3), { x: grip(b3).x + 30, y: grip(b3).y + 40 });
  const b4 = await rectOf(page, ".town-chat");
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1");
  near(await rectOf(page, ".town-chat"), b4);
});

test("the edge chips keep off the chat box, shown or not and wherever it's put", async ({ page }) => {
  await open(page);
  const quiet = await chips(page);
  expect(quiet.length, "some chips show").toBeGreaterThan(0);
  const box = await rectOf(page, ".town-chat");
  for (const c of quiet) expect(meets(c, box), `${c.name} not under the box`).toBe(false);

  // Put the box over a chip's place: the chip gives way (the box's place is reserved wherever it is), and none is under it.
  // (Some chips lie where the buttons keep the box off: try them in turn.)
  const map = await rectOf(page, ".town-box");
  let proved = false;
  for (let k = 0; k < quiet.length && !proved; k++) {
    const now = await chips(page);
    const target = now[k % now.length]!;
    const was = await rectOf(page, ".town-chat");
    const g = grip(was);
    const want = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    await carry(page, g, { x: g.x + (want.x - (was.x + was.w / 2)), y: g.y + (want.y - (was.y + was.h / 2)) });
    const moved = await rectOf(page, ".town-chat");
    expect(moved.x).toBeGreaterThanOrEqual(map.x);
    await expect.poll(async () => (await chips(page)).filter((c) => meets(c, moved)).map((c) => c.name), { message: "no chip under the moved box", timeout: 4000 }).toEqual([]);
    if (want.x > moved.x && want.x < moved.x + moved.w && want.y > moved.y && want.y < moved.y + moved.h) {
      const same = (await chips(page)).find((c) => c.name === target.name);
      if (same) expect(Math.hypot(same.x - target.x, same.y - target.y), "that chip slid to a clear spot").toBeGreaterThan(10);
      proved = true;
    }
  }
  expect(proved, "the box lay over a chip's old place, and the chip gave way").toBe(true);

  // A chip by the box never jumps when the log appears or fades: its place is reserved always. (Only the chips round the box
  // are compared: a boss's or bot's name tag passing an edge nudges the others now and then.)
  const moved = await rectOf(page, ".town-chat");
  const round = { x: moved.x - 90, y: moved.y - 90, w: moved.w + 180, h: moved.h + 180 };
  const byTheBox = async () => (await chips(page)).filter((c) => meets(c, round));
  const stay = (a: Awaited<ReturnType<typeof chips>>, b: Awaited<ReturnType<typeof chips>>, when: string) => {
    for (const c of a) {
      const d = b.find((o) => o.name === c.name);
      if (d) expect(Math.hypot(c.x - d.x, c.y - d.y), `${c.name} stays put ${when}`).toBeLessThan(3);
    }
  };
  await page.waitForTimeout(300);
  const before = await byTheBox();
  expect(before.length, "a chip lies by the box").toBeGreaterThan(0);
  await say(page, "Hollow", "The park gets quiet after dark.");
  await expect(log(page)).toHaveCSS("opacity", "1");
  await page.waitForTimeout(300);
  stay(before, await byTheBox(), "as the log appears");
  await expect(log(page)).not.toHaveCSS("opacity", "1", { timeout: 15_000 }); // (the fade begins)
  const fading = await byTheBox();
  await expect(log(page)).toHaveCSS("opacity", "0", { timeout: 3000 });
  stay(fading, await byTheBox(), "as the log fades");
});

test("the keyboard opening doesn't resize or move the town: while the field has focus the screen keeps its height and follows the visual viewport", async ({ page }) => {
  await open(page);
  const screen = page.locator(".town-screen");
  const field = page.locator(".tc-form input");
  const cv0 = await rectOf(page, "canvas.town-canvas");
  await field.click();
  await expect(field).toBeFocused();
  await expect(screen).toHaveAttribute("style", /height: \d+(\.\d+)?px/);
  // (A browser that pans the page to show the field: the visual viewport's offset, stood in for here.)
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, "offsetTop", { get: () => 120, configurable: true });
    vv.dispatchEvent(new Event("scroll"));
  });
  await expect(screen).toHaveAttribute("style", /translate3d\(0px, 120px, 0(px)?\)/);
  expect(await rectOf(page, "canvas.town-canvas"), "the map's box is the same size").toMatchObject({ w: cv0.w, h: cv0.h });
  await page.evaluate(() => delete (window.visualViewport as any).offsetTop);
  await page.locator("canvas.town-canvas").click({ position: { x: 5, y: 300 } }); // (a tap on the map: the keyboard closes)
  await expect(field).not.toBeFocused();
  await expect(screen).not.toHaveAttribute("style", /height|transform/);
  expect(await rectOf(page, "canvas.town-canvas")).toEqual(cv0);
});
