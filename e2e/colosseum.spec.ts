import { expect, type Page } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * Inside the Colosseum, the first look (Oct 30; docs/areas/colosseum.md): the town's Colosseum card links in, the arena draws
 * (WebGL 2), opening on the high view behind White in Pixel (Nov 1), Change seat changes the view, a bot game plays on the
 * floor and the next one starts, the overlay's pieces are there, the gear's Pieces row, and Exit goes back to the town. Phone
 * and computer. Headless WebGL is software (a few frames a second): the checks wait on the game's state, never on a frame rate.
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

type Hooks = {
  __colosseum: {
    state: () => { view: number; backend: string; drawCalls: number; crowd: number; game: number; plies: number; status: string };
    seat: (i: number) => void;
    flag: () => void;
    jump: () => void;
    sample: () => { sky: number; hash: number } | null;
  };
};
// (Before the page's chunk has loaded there's no hook yet: an empty state, and the polls wait.)
const state = (p: Page) => p.evaluate(() => (window as unknown as Partial<Hooks>).__colosseum?.state() ?? ({} as ReturnType<Hooks["__colosseum"]["state"]>));
const sample = (p: Page) => p.evaluate(() => (window as unknown as Partial<Hooks>).__colosseum?.sample() ?? null);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("the Colosseum's first look: the card's link in, the arena drawn, Change seat, a bot game and the next, the overlay, Exit back to the town", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);

  // The way in: the town's Colosseum card keeps what it had, plus the link.
  await page.goto("/town");
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1");
  const gate = (await page.evaluate(() => (window as unknown as { __townAt: (k: string) => { x: number; y: number } | null }).__townAt("coliseum")))!;
  expect(gate, "the Colosseum is drawn at the start").not.toBeNull();
  const cv = (await page.locator("canvas.town-canvas").boundingBox())!;
  await page.mouse.click(cv.x + gate.x, cv.y + gate.y);
  const card = page.getByRole("dialog", { name: "The Colosseum", exact: true });
  await expect(card.getByRole("button", { name: "Raids with people" })).toBeDisabled();
  const look = card.getByRole("link", { name: "Look inside (preview)" });
  await expect(look).toHaveAttribute("href", "/colosseum");
  await look.click();
  await expect(page).toHaveURL(/\/colosseum$/);
  await expect(page.getByRole("heading", { name: "The Colosseum" })).toBeVisible();

  // Again with `?fast` (the bots move at once, the next game comes quickly): the arena draws, with its crowd, opening on the high
  // view behind White (Nov 1) in Pixel: ten draw calls (the arena, the crowd, one a piece kind, the outline, the scaling up), no railing.
  await page.goto("/colosseum?fast");
  await expect.poll(async () => (await state(page)).crowd, { message: "the crowd is in", timeout: 60_000 }).toBeGreaterThan(1500);
  const s0 = await state(page);
  expect(s0.backend).toBe("webgl");
  expect(s0.view, "the high view behind White").toBe(10);
  expect((s0 as { pieces?: string }).pieces).toBe("pixel");
  await expect.poll(async () => (await state(page)).drawCalls, { message: "ten draw calls a frame in Pixel" }).toBe(10);
  await expect(page.locator(".col-rail")).toBeHidden();
  const a = (await sample(page))!;
  expect(a.sky, "the arena, not an empty sky").toBeLessThan(0.5);

  // Change seat: another seat or high view (never a player view), another picture.
  await page.getByRole("button", { name: "Change seat" }).click();
  await expect.poll(async () => (await state(page)).view).not.toBe(s0.view);
  expect([0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13]).toContain((await state(page)).view);
  const b = (await sample(page))!;
  expect(b.hash).not.toBe(a.hash);

  // A bot game plays (moves on the floor and in the overlay); ended at once, the next starts.
  await expect.poll(async () => (await state(page)).plies, { message: "the bots play", timeout: 90_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".col-moves li").first()).toContainText("1.");
  const game = (await state(page)).game;
  await page.evaluate(() => (window as unknown as Hooks).__colosseum.flag());
  await expect(page.locator(".col-status")).toContainText(/wins on time\. Next game soon\./);
  await expect.poll(async () => (await state(page)).game, { message: "the next game starts", timeout: 30_000 }).toBe(game + 1);
  await expect.poll(async () => (await state(page)).plies, { message: "and plays", timeout: 90_000 }).toBeGreaterThanOrEqual(1);

  // The overlay: each player's card (portrait, name, ELO, the pieces taken, the clock), the middle, the board with its eval bar, the chat's box.
  for (const side of ["w", "b"]) {
    const c = page.locator(`.col-card[data-side="${side}"]`);
    await expect(c.locator(".col-pic")).toBeVisible();
    await expect(c.locator(".col-name")).toContainText("(bot)");
    await expect(c.locator(".col-elo")).toHaveText(/^ELO \d{3,4}$/);
    await expect(c.getByLabel("Pieces taken")).toBeAttached();
    await expect(c.locator(".col-clock")).toHaveText(/^\d:\d\d(\.\d)?$/);
  }
  await expect(page.locator(".col-turn")).toHaveText(/^Turn \d+$/);
  await expect(page.locator(".col-viewers")).toHaveText(/^\d\.\dK$/);
  await expect(page.getByLabel("Last moves").locator("li")).toHaveCount(4);
  await expect(page.locator(".col-board")).toBeVisible();
  await expect(page.locator(".col-eval")).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
  // Nothing hidden, nothing shifts: the cards and the board keep their place from move to move.
  const box1 = await page.locator(".col-board").boundingBox();
  const plies = (await state(page)).plies;
  await expect.poll(async () => (await state(page)).plies, { timeout: 60_000 }).toBeGreaterThan(plies);
  expect(await page.locator(".col-board").boundingBox()).toEqual(box1);

  // The railing in front of your seat (the API art, Oct 31): along the arena's foot, the same size at every seat, never over the
  // overlay's flat board, eval bar, chat or Exit, and taking no taps (a drag over it still turns the view). (In a seat: the
  // high views float over the arena, as the player views do.)
  await page.evaluate(() => (window as unknown as Hooks).__colosseum.seat(1));
  await expect.poll(async () => (await state(page)).view).toBe(1);
  const rail = page.locator(".col-rail");
  await expect(rail).toBeVisible();
  const arenaBox = (await page.locator(".col-arena").boundingBox())!;
  const railBox = (await rail.boundingBox())!;
  expect(railBox.y + railBox.height).toBeCloseTo(arenaBox.y + arenaBox.height, 0);
  expect(railBox.height).toBe(32);
  expect(await rail.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
  for (const sel of [".col-board", ".col-eval", ".col-chat", ".col-exit"]) {
    const b = (await page.locator(sel).boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest(".col-rail") !== null, [b.x + b.width / 2, b.y + b.height / 2]);
    expect(hit, `the railing over ${sel}`).toBe(false);
  }

  // The gear: Sound, Pieces (the test below), Ambient crowd noise (its sound: the test below), Report a bug.
  await page.getByRole("button", { name: "Match options" }).click();
  const panel = page.getByRole("dialog", { name: "Match options" });
  await expect(panel.getByRole("switch", { name: /Sound/ })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Pieces/ })).toContainText("Pixel");
  await expect(panel.getByRole("switch", { name: /3D pieces/ })).toHaveCount(0);
  const amb = panel.getByRole("button", { name: /Ambient crowd noise/ });
  await expect(amb).toContainText("Normal");
  await amb.click();
  await expect(amb).toContainText("Low");
  await expect(panel.getByRole("button", { name: /Report a bug/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // The player views (`?view=white` / `black`): Black's turns the flat board round.
  await page.goto("/colosseum?view=black");
  await expect.poll(async () => (await state(page)).view).toBe(9);
  await expect(page.locator(".col-board .hb, .col-board [class*='board']").first()).toBeVisible();
  // (No railing in a player view: no seat, floating over the floor.)
  await expect(page.locator(".col-rail")).toBeHidden();

  // Exit: back to the town.
  await page.getByRole("button", { name: "Exit" }).click();
  await expect(page).toHaveURL(/\/town$/);
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute("data-ready", "1");
  expect(errors.filter((e) => !/WebGL|GPU stall|willReadFrequently/i.test(e))).toEqual([]);
});

test("the gear's Pieces (Pixel by default): a tap steps Pixel, 3D, 2D and back, each at once (draw calls 10, 8, 3), the choice survives a reload, and an old '3D pieces' on comes back as 3D", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  const pieces = async () => ((await state(page)) as { pieces?: string }).pieces;
  const row = () => page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /Pieces/ });
  await page.goto("/colosseum?fast");
  await expect.poll(async () => (await state(page)).crowd, { message: "the crowd is in", timeout: 60_000 }).toBeGreaterThan(1500);
  // Pixel by default: the whole arena on the pixel grid; the arena's, the crowd's, one a kind (all six on the board at the start), the outline and the scaling up.
  expect(await pieces()).toBe("pixel");
  await expect.poll(async () => (await state(page)).drawCalls).toBe(10);
  expect(((await state(page)) as { pixelScale?: number }).pixelScale).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Match options" }).click();
  await expect(row()).toContainText("Pixel");
  // 3D: at once, no reload; the arena's and the crowd's, and one a kind (the props then have nothing to draw).
  await row().click();
  await expect(row()).toContainText("3D");
  await expect.poll(async () => (await state(page)).drawCalls, { message: "the arena's and the crowd's draw calls and one a piece kind" }).toBe(8);
  expect(await pieces()).toBe("3d");
  const a = (await sample(page))!;
  expect(a.sky, "the arena, not an empty sky").toBeLessThan(0.5);
  // 2D: the flat pieces, three draw calls.
  await row().click();
  await expect(row()).toContainText("2D");
  await expect.poll(async () => (await state(page)).drawCalls).toBe(3);
  expect(await pieces()).toBe("flat");
  // And round to Pixel.
  await row().click();
  await expect(row()).toContainText("Pixel");
  await expect.poll(async () => (await state(page)).drawCalls).toBe(10);
  // 3D again, and the game plays on in it.
  await row().click();
  await expect(row()).toContainText("3D");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await state(page)).plies, { message: "the bots play", timeout: 90_000 }).toBeGreaterThanOrEqual(4);
  expect((await state(page)).drawCalls).toBeGreaterThanOrEqual(5);

  // Remembered on this device: a reload comes back in 3D.
  await page.reload();
  await expect.poll(async () => (await state(page)).crowd, { timeout: 60_000 }).toBeGreaterThan(1500);
  expect(await pieces()).toBe("3d");
  await expect.poll(async () => (await state(page)).drawCalls).toBeGreaterThanOrEqual(5);
  await page.getByRole("button", { name: "Match options" }).click();
  await expect(row()).toContainText("3D");
  // 2D, kept through a reload too.
  await row().click();
  await expect(row()).toContainText("2D");
  await page.reload();
  await expect.poll(async () => (await state(page)).crowd, { timeout: 60_000 }).toBeGreaterThan(1500);
  expect(await pieces()).toBe("flat");
  await expect.poll(async () => (await state(page)).drawCalls).toBe(3);

  // Someone who had the old "3D pieces" on (Oct 30's switch) and has chosen nothing since: 3D.
  await page.evaluate(() => {
    localStorage.removeItem("colosseum-pieces");
    localStorage.setItem("colosseum-3d-pieces", "on");
  });
  await page.reload();
  await expect.poll(async () => (await state(page)).crowd, { timeout: 60_000 }).toBeGreaterThan(1500);
  expect(await pieces()).toBe("3d");
  expect(errors.filter((e) => !/WebGL|GPU stall|willReadFrequently/i.test(e))).toEqual([]);
});

test("sound: the gear's Ambient crowd noise (Normal by default; Normal, Low, Off: a lower gain each, paused at Off, kept through a reload) streams the arena's hour from a random point; each floor move plays its piece sound; a queen taken plays the crowd's cheer", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  const ranges: string[] = [];
  page.on("request", (r) => r.url().includes("/sounds/colosseum/ambient.mp3") && ranges.push(r.headers()["range"] ?? "none"));
  await page.addInitScript(() => ((window as unknown as { __soundLog: string[] }).__soundLog = []));
  type Amb = { playing: boolean; time: number; start: number; level: string; gain: number } | null | undefined;
  const amb = async () => ((await state(page)) as { ambient?: Amb }).ambient;
  const log = () => page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog);
  await page.goto("/colosseum?fast");
  await expect.poll(async () => (await state(page)).crowd, { timeout: 60_000 }).toBeGreaterThan(1500);
  // A tap (browsers start sound only after one): the gear.
  await page.getByRole("button", { name: "Match options" }).click();
  const panel = page.getByRole("dialog", { name: "Match options" });
  const row = panel.getByRole("button", { name: /Ambient crowd noise/ });
  await expect(row).toContainText("Normal");
  await expect.poll(async () => (await amb())?.playing, { message: "the ambience plays", timeout: 30_000 }).toBe(true);
  const a = (await amb())!;
  expect(a.start, "a random point in the hour").toBeGreaterThan(1);
  await expect.poll(async () => (await amb())!.time, { message: "from that point, and on", timeout: 15_000 }).toBeGreaterThan(Math.max(1, a.start - 1));
  const t = (await amb())!.time;
  await expect.poll(async () => (await amb())!.time, { timeout: 15_000 }).toBeGreaterThan(t);
  expect(ranges.length, "streamed").toBeGreaterThan(0);
  expect(ranges.every((r) => r.startsWith("bytes=")), `Range requests: ${ranges.join(", ")}`).toBe(true);
  // Normal, Low, Off: each a lower gain (Normal 4 dB down, Low 12 dB down), Off paused after its fade.
  const normal = (await amb())!.gain;
  expect(normal).toBeCloseTo(10 ** (-4 / 20), 3);
  await row.click();
  await expect(row).toContainText("Low");
  const low = (await amb())!;
  expect(low).toMatchObject({ level: "low", playing: true });
  expect(low.gain).toBeCloseTo(10 ** (-12 / 20), 3);
  expect(low.gain).toBeLessThan(normal);
  await row.click();
  await expect(row).toContainText("Off");
  expect((await amb())!.gain).toBe(0);
  await expect.poll(async () => (await amb())?.playing, { timeout: 10_000 }).toBe(false);
  // Remembered on this device: a reload comes back Off, silent.
  await page.reload();
  await expect.poll(async () => (await state(page)).crowd, { timeout: 60_000 }).toBeGreaterThan(1500);
  await page.getByRole("button", { name: "Match options" }).click();
  await expect(row).toContainText("Off");
  expect(await amb()).toMatchObject({ level: "off", playing: false });
  // Round to Normal again: it plays.
  await row.click();
  await expect(row).toContainText("Normal");
  await expect.poll(async () => (await amb())?.playing, { timeout: 10_000 }).toBe(true);
  await page.keyboard.press("Escape");
  // Each move on the floor: its piece sound, as a played game's (the move, capture or castle sound), under the game's sound.
  await page.evaluate(() => ((window as unknown as { __soundLog: string[] }).__soundLog.length = 0));
  const plies = (await state(page)).plies;
  await expect.poll(async () => (await state(page)).plies, { timeout: 60_000 }).toBeGreaterThan(plies + 1);
  await expect.poll(async () => (await log()).filter((l) => /^(move|capture|castle):running$/.test(l)).length, { message: "the floor's moves knock" }).toBeGreaterThan(0);
  // A queen taken (the crowd's jump, as a capture sets it off): the cheer, under the game's sound.
  await page.evaluate(() => (window as unknown as Hooks).__colosseum.jump());
  expect(await log()).toContain("colosseumCheer:running");
  expect(errors.filter((e) => !/WebGL|GPU stall|willReadFrequently/i.test(e))).toEqual([]);
});
