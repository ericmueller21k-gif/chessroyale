import { expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { BOARD_SEL, asSignedIn, named, test } from "./helpers.ts";

/**
 * A boss challenged from the town, Pokémon-gym style (Eric, Nov 2; docs/areas/town-square.md, "Challenging a boss"), Alfil first, on a
 * phone and a computer: his card's "Challenge alone", its confirm ("Challenge Alfil?", Fight); you and Alfil walk to his Pyramid's
 * door and in; you each walk to your start mark on the battle circle (you south, him north, facing each other); he says his line in
 * a speech bubble by his head (not the chat log); the sand pyramid rises between you, cracks and crumbles, and his table with the board is
 * there; his God King attack plays beside it a couple of seconds before the sandstorm covers the screen; the sandstorm sweeps in, the battle loads under it (Boss alone, Alfil), and it slides off the board; the boss mates you
 * (?mate=1), the result screen, "Back to town", and you're in the town square where you stood, facing the same way. The town's chat
 * (signed in): the server's lines (Eric, Nov 2), "<you> challenged Alfil!" as the battle starts and "Alfil beat <you> in N moves." as it
 * finishes; a first challenge quit (the gear's Leave or Resign before 10 moves) posts no outcome, and the second posts no start line.
 * CHALLENGE_SHOTS=<dir>: the stills (both projects) and, on the phone, the intro's frames for its GIF (docs/boss-challenge/).
 * Test hooks: the room's canvas `data-intro` (its step); `window.__shopIntro()` (the step, where you and the boss stand, the line,
 * the board); the storm's canvas `canvas.boss-storm` (`data-phase`); `__townYou()` (your square, the way you face).
 */
test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.CHALLENGE_SHOTS;

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

type Stand = { c: number; r: number; facing: number; view: number; moving: boolean };
type Intro = { step: string; attack: boolean; you: [number, number]; boss: [number, number]; line: boolean; table: boolean; pyramid: { anim: string; frame: number } | null };
type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townYou?: () => Stand | null;
  __shopIntro?: () => Intro | null;
};
const town = (p: Page) => p.locator("canvas.town-canvas");
const room = (p: Page) => p.locator("canvas.town-shop-canvas");
const storm = (p: Page) => p.locator("canvas.boss-storm");
const youNow = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__townYou?.() ?? null);
const intro = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopIntro?.() ?? null);

/** Where to tap Alfil now (in the page); null while he isn't drawn. */
async function alfilAt(p: Page) {
  const xy = await p.evaluate(() => (window as unknown as Hooks).__townAt?.("boss", "alfil") ?? null);
  if (!xy) return null;
  const cv = (await town(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}

/** Opens Alfil's card (his Pyramid is across the map: the camera glides there, as its chip would) and his challenge's confirm. */
async function toConfirm(page: Page) {
  if (!(await alfilAt(page))) await page.evaluate(() => (window as unknown as { __townGlide?: (id: string) => void }).__townGlide?.("alfil"));
  await expect.poll(() => alfilAt(page), { message: "Alfil comes into view" }).not.toBeNull();
  // His card (he may stroll a step between the look and the tap: tap again; another's card that opened is closed first).
  const card = page.getByRole("dialog", { name: "Alfil", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    const at = await alfilAt(page);
    expect(at, "drawn").not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  // The entry is today's: "Challenge alone", then its confirm, his own (a boss with an intro): you fight him and come back here.
  await card.getByRole("button", { name: "Challenge alone" }).click();
  const confirm = page.getByRole("dialog", { name: "Challenge Alfil?" });
  await expect(confirm.getByRole("heading", { name: "Challenge Alfil?" })).toBeVisible();
  await expect(confirm.getByText("You'll fight Alfil in Boss Battle, then come back here.")).toBeVisible();
  await expect(confirm.getByRole("button")).toHaveText(["Fight", "Stay"]);
  // Where you stand as you challenge him (the tap on him walked you up to him: once you've stopped).
  await expect.poll(async () => (await youNow(page))?.moving, { message: "you've walked up to him" }).toBe(false);
  return { confirm, stood: (await youNow(page))! };
}
/** The server's lines in the town's chat now, about `who` (the town's chat is everyone's: the other project's lines are there too). */
const serverLines = async (page: Page, who: string) => (await page.locator(".tc-line.tc-server").allTextContents()).filter((l) => l.includes(` ${who} `) || l.includes(` ${who}.`));
/** Back in the town square, where you stood, facing the way you faced. */
async function backAt(page: Page, stood: Stand) {
  await expect(page.getByRole("heading", { name: "Town square" })).toBeVisible();
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  expect(new URL(page.url()).pathname).toBe("/town");
  const now = (await youNow(page))!;
  expect([now.c, now.r, now.facing, now.view]).toEqual([stood.c, stood.r, stood.facing, stood.view]);
}

test("challenging Alfil in the town: in with him to his marks, his line, the pyramid, the storm, the battle; Back to town where you stood; the server's lines", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  // Signed in (the town's chat is for signed-in players: the server's lines too).
  // (A name of its own: the town's chat is shared with the other project's run.)
  const me = `Ch${project[0]}${Math.random().toString(36).slice(2, 6)}`;
  await named(page, me);
  // (Once the page has its account: signing in a request's own new account would race the page's.)
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  await page.waitForLoadState("networkidle");
  await asSignedIn(page, "challenger");
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1");

  // ---- A first challenge, quit: in, the battle, and the gear's Leave (or Resign, before 10 moves): no outcome line.
  {
    const { confirm, stood } = await toConfirm(page);
    await confirm.getByRole("button", { name: "Fight" }).click();
    await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
    await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
    await page.getByRole("button", { name: "Match options" }).click();
    const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
    const how = (await quit.textContent())!.trim();
    await quit.click();
    await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
    if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
    await backAt(page, stood);
    // Its start line, and no outcome.
    await expect.poll(() => serverLines(page, me), { timeout: 15_000 }).toEqual([expect.stringMatching(new RegExp(`\\] ${me} challenged Alfil!$`))]);
  }

  // ---- A second challenge, finished (?mate=1: the boss mates you at once, so the battle ends by itself and its result shows).
  await page.evaluate(() => history.replaceState(null, "", "/town?mate=1"));
  const { confirm, stood } = await toConfirm(page);
  await shot("01-confirm");
  await confirm.getByRole("button", { name: "Fight" }).click();
  // In his Pyramid: you both walk in to your marks.
  await expect(room(page)).toHaveAttribute("data-room", "alfil", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Alfil's Pyramid" })).toBeVisible();
  const frames: Buffer[] = [];
  const grab = async () => {
    if (SHOTS && project === "phone") frames.push(await page.screenshot({ scale: "css" }));
  };
  // (The phone's GIF: the whole intro, from the walk in to the storm covering, a frame as often as the screenshots allow.)
  let grabbing = !!SHOTS && project === "phone";
  const grabbed = (async () => {
    while (grabbing) await grab();
  })();
  const seen = new Set<string>();
  const step = async () => {
    const s = (await intro(page))?.step ?? "";
    seen.add(s);
    return s;
  };
  await expect.poll(step, { message: "on their marks: his line", timeout: 15_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.you).toEqual([9.5, 13]);
  expect(atLine.boss).toEqual([9.5, 8]);
  expect(atLine.line).toBe(true);
  await shot("02-line");
  // His line is in the bubble by his head only, never in the town's chat log (Eric, Nov 2).
  await expect(page.locator(".tc-line").filter({ hasText: "I'll show you the power of the old piece." })).toHaveCount(0);
  await expect.poll(step, { message: "the pyramid rises", intervals: [50] }).toMatch(/rise|idle/);
  await expect.poll(step, { message: "it cracks", intervals: [50] }).toBe("crack");
  await shot("03-crack");
  await expect.poll(step, { message: "it crumbles: the table and the board", intervals: [50] }).toMatch(/crumble|table/);
  await expect.poll(async () => (await intro(page))?.table, { intervals: [50] }).toBe(true);
  await shot("04-table");
  // His God King attack (his kit's), beside the table, a couple of seconds before the storm covers the screen (Eric, Nov 2), and on.
  await expect.poll(async () => (await intro(page))?.attack, { message: "his attack", intervals: [50] }).toBe(true);
  expect(await storm(page).getAttribute("data-phase", { timeout: 100 }).catch(() => null), "before the storm covers").not.toBe("covered");
  await shot("045-attack");
  // The storm sweeps in over everything, and the battle loads under it.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "alfil");
  await expect(storm(page)).toHaveAttribute("data-covered", "1");
  grabbing = false;
  await grabbed;
  for (const [i, f] of frames.entries()) writeFileSync(`${SHOTS}/gif-${String(i).padStart(3, "0")}.png`, f);
  if (SHOTS) await shot("05-storm");
  expect([...seen].filter((s) => ["line", "rise", "idle", "crack", "crumble", "table"].includes(s)).length).toBeGreaterThanOrEqual(4);
  // The battle: Boss alone against Alfil, its board showing as the storm slides off; the storm gone.
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Alfil's Pyramid" })).toHaveCount(0);
  await shot("06-battle");
  // He mates you (?mate=1): the result screen, its leaving "Back to town" (not Home).
  const back = page.getByRole("button", { name: "Back to town" });
  await expect(back).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Alfil won/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Home", exact: true })).toHaveCount(0);
  // (A token's box, if one dropped: OK it.)
  const box = page.getByRole("dialog", { name: /^You got an? .+ token!$/ });
  if (await box.isVisible()) await box.getByRole("button", { name: "OK" }).click();
  await shot("07-result");
  await back.click();
  await backAt(page, stood);
  // The server's lines: still the one start line (the quit left it open: no second), and this battle's outcome (?mate=1 plays
  // your moves for you, none of them yours: no count; the counts are packages/server/test/town-chat.test.ts's).
  await expect
    .poll(() => serverLines(page, me), { timeout: 15_000 })
    .toEqual([expect.stringMatching(new RegExp(`\\] ${me} challenged Alfil!$`)), expect.stringMatching(new RegExp(`\\] Alfil beat ${me}( in \\d+ moves?)?\\.$`))]);
  await shot("08-back-in-town");
  expect(errors).toEqual([]);
});
