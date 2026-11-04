import { expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { CHALLENGE_FEEL, introOf } from "../packages/app/src/town/shops/challenge.ts";
import { BOARD_SEL, asAdmin, asSignedIn, named, test } from "./helpers.ts";

/**
 * A boss challenged from the town, Pokémon-gym style (Eric, Nov 2; docs/areas/town-square.md, "Challenging a boss"), Alfil first, on a
 * phone and a computer: his card's "Challenge alone", its confirm ("Challenge Alfil?", Fight); you and Alfil walk to his Pyramid's
 * door and in; you each walk to your start mark on the battle circle (across, Nov 2 round 2: him west of the table, you east, facing
 * each other); he says his line in a speech bubble by his head (not the chat log); the sand pyramid rises between you, cracks and
 * crumbles, and his table with the board is there, a stool at each of your sides; his God King attack plays beside it a couple of
 * seconds before the sandstorm covers the screen; the sandstorm sweeps in, the battle loads under it (Boss alone, Alfil), and it slides off the board; the boss mates you
 * (?mate=1), the result screen, "Back to town", and you're in the town square where you stood, facing the same way. The town's chat
 * (signed in): the server's lines (Eric, Nov 2), "<you> challenged Alfil!" as the battle starts and "Alfil beat <you> in N moves." as it
 * finishes; a first challenge quit (the gear's Leave or Resign before 10 moves) posts no outcome, and the second posts no start line.
 * Babur (the default intro, round 2): in with him to his ring, across the table from him, his line, the table popping in, his attack
 * swung in place, the flash and the wipe (`canvas.boss-wipe`), the battle under it, and the gear's Leave back to where you stood.
 * Big Boy (his own intro, Nov 2): in with him to his crib's circle, onto its rug's marks across the table's place from him, his line, his
 * toy blocks building the table, the board dropping and plopping on, the stools (his B, your W) dropping in, his attack beside it before his lollipop swirl
 * (`canvas.boss-storm`) covers the screen, the battle under it, and the gear's Leave back to where you stood.
 * Timber (his own intro, Nov 3; an admin's town: he's in the game for admins first): in with him to his lodge's circle, onto its branded
 * marks; his line; he walks west to the giant log, heaves it up, carries it to the middle, sets it down and gnaws it; the shavings' fog
 * boils up, holds (his table swaps in under it) and settles; the stumps pop up; he dusts off his paws and walks to his place; his
 * attack; his sawdust sweep (`canvas.boss-storm`) covers the screen, the battle under it, and the gear's Leave back to where you stood.
 * Dash (the default intro, Nov 3, until his own in round 3; an admin's town: he's in the game for admins first): in with him to his
 * store's circle, onto its try-on mats; his line; the table pops in; no God King attack was drawn for him, so he stands through the
 * swing's beat; the flash and the wipe, the battle under it, and the gear's Leave back to where you stood.
 * Hollow (his own intro, Nov 3; everyone's): in with him up his cave to the frozen pond, straight to your seats (no hop back); his line;
 * the table pops in while it's still lit; his channel line (one of four) as the ball charges; the lanterns go out one by one, the
 * string drains, his own strand, your pawn; black; the dim light; it closes in on the board; the dark (`canvas.boss-dark`) holds while
 * the battle loads and lifts off it; nobody moves and the table stays from the drain on; the gear's Leave back to where you stood.
 * CHALLENGE_SHOTS=<dir>: the stills (both projects) and, on the phone, the intro's frames for its GIF (docs/boss-challenge/).
 * Test hooks: the room's canvas `data-intro` (its step); `window.__shopIntro()` (the step, the layout, where you and the boss stand
 * and face, the line, the board and its stools); the storm's canvas `canvas.boss-storm` and the wipe's `canvas.boss-wipe`
 * (`data-phase`); `__townYou()` (your square, the way you face).
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
type Wood = { move: string | null; log: string | null; fog: string | null; ring: boolean; stumps: string | null };
type Dark = { move: string | null; bulbs: number; lanterns: number; run: number; tree: number; tag: number; level: number; black: number; pool: number; iris: number };
type Intro = { step: string; layout: string; attack: boolean; you: [number, number]; boss: [number, number]; facing: { you: number; boss: number }; line: boolean; table: boolean; stools: [number, number][]; pyramid: { anim: string; frame: number } | null; blocks: { anim: string; frame: number } | null; drop: number; wood: Wood | null; chant: string | null; dark: Dark | null };
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

/**
 * Once the stools are in, you and the boss have hopped back to stand clear of them (CHALLENGE_FEEL.clear, from the table's middle at
 * column 9.5, on row `r`): neither on nor in front of a stool (Eric, Nov 2). The drawings' own clearance is the unit test's.
 */
async function clearOfStools(p: Page, r: number) {
  const at = async () => {
    const i = (await intro(p))!;
    return [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  };
  await expect.poll(at, { message: "hopped back clear of the stools", intervals: [50] }).toEqual([9.5 + CHALLENGE_FEEL.clear.you, r, 9.5 - CHALLENGE_FEEL.clear.boss, r]);
}

/** Where to tap Alfil (or another boss, `id`) now (in the page); null while he isn't drawn. */
async function alfilAt(p: Page, id = "alfil") {
  const xy = await p.evaluate((i) => (window as unknown as Hooks).__townAt?.("boss", i) ?? null, id);
  if (!xy) return null;
  const cv = (await town(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}

/** Opens Alfil's card (his Pyramid is across the map: the camera glides there, as its chip would) and his challenge's confirm (or another boss's). */
async function toConfirm(page: Page, id = "alfil", name = "Alfil") {
  if (!(await alfilAt(page, id))) await page.evaluate((i) => (window as unknown as { __townGlide?: (id: string) => void }).__townGlide?.(i), id);
  await expect.poll(() => alfilAt(page, id), { message: `${name} comes into view` }).not.toBeNull();
  // His card (he may stroll a step between the look and the tap: tap again; another's card that opened is closed first).
  const card = page.getByRole("dialog", { name, exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    const at = await alfilAt(page, id);
    expect(at, "drawn").not.toBeNull();
    await page.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  // The entry is today's: "Challenge alone", then its confirm, his own (a boss with an intro): you fight him and come back here.
  await card.getByRole("button", { name: "Challenge alone" }).click();
  const confirm = page.getByRole("dialog", { name: `Challenge ${name}?` });
  await expect(confirm.getByRole("heading", { name: `Challenge ${name}?` })).toBeVisible();
  await expect(confirm.getByText(`You'll fight ${name} in Boss Battle, then come back here.`)).toBeVisible();
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
  // Across (Eric's normal look): him on the table's west, you on its east, on the circle's middle row, facing each other.
  expect(atLine.layout).toBe("across");
  expect(atLine.you).toEqual([11, 10.5]);
  expect(atLine.boss).toEqual([8, 10.5]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  await shot("02-line");
  // His line is in the bubble by his head only, never in the town's chat log (Eric, Nov 2).
  await expect(page.locator(".tc-line").filter({ hasText: "I'll show you the power of the old piece." })).toHaveCount(0);
  await expect.poll(step, { message: "the pyramid rises", intervals: [50] }).toMatch(/rise|idle/);
  await expect.poll(step, { message: "it cracks", intervals: [50] }).toBe("crack");
  await shot("03-crack");
  await expect.poll(step, { message: "it crumbles: the table and the board", intervals: [50] }).toMatch(/crumble|table/);
  await expect.poll(async () => (await intro(page))?.table, { intervals: [50] }).toBe(true);
  // A stool at each of your sides, between you and the table (none on its empty sides).
  expect((await intro(page))!.stools).toEqual([[8.5, 10.5], [10.5, 10.5]]);
  // You both hop back clear of the stools as they come in (Nov 2: "make sure they're not standing where the chair blocks are").
  await clearOfStools(page, 10.5);
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

test("challenging Babur in the town: the default intro (his line, the table pops in, his attack swung in place, the flash and the wipe), the battle; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  const { confirm, stood } = await toConfirm(page, "tiger", "Babur");
  await confirm.getByRole("button", { name: "Fight" }).click();
  // In his Circus: you both walk in, to either side of his ring's middle (his pedestal: the table stands in front of it).
  await expect(room(page)).toHaveAttribute("data-room", "tiger", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Babur's Circus" })).toBeVisible();
  const frames: Buffer[] = [];
  let grabbing = !!SHOTS && project === "phone";
  const grabbed = (async () => {
    while (grabbing) frames.push(await page.screenshot({ scale: "css" }));
  })();
  const step = async () => (await intro(page))?.step ?? "";
  await expect.poll(step, { message: "on their marks: his line", timeout: 15_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.layout).toBe("across");
  expect(atLine.you).toEqual([11, 12]);
  expect(atLine.boss).toEqual([8, 12]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  expect(atLine.pyramid).toBeNull();
  // After his line (and a pause) the table pops in, its stools at your sides; you both hop back clear of them.
  await expect.poll(async () => (await intro(page))?.table, { message: "the table pops in", intervals: [50] }).toBe(true);
  expect((await intro(page))!.stools).toEqual([[8.5, 12], [10.5, 12]]);
  await clearOfStools(page, 12);
  await shot("r2-babur-table");
  await expect(page.locator(".tc-line").filter({ hasText: "Fine. One more show. Then I'm on break." })).toHaveCount(0);
  // His attack, swung in place (where he stands), for a few seconds; the line gone.
  await expect.poll(step, { message: "he swings", intervals: [50] }).toBe("swing");
  const swing = (await intro(page))!;
  expect(swing).toMatchObject({ attack: true, line: false, table: true });
  expect(swing.boss[0]).toBeCloseTo(9.5 - CHALLENGE_FEEL.clear.boss);
  await shot("r2-babur-swing");
  // The flash and the wipe to black, the battle loading under it.
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator("canvas.boss-wipe")).toHaveAttribute("data-boss", "tiger");
  await expect(page.locator("canvas.boss-wipe")).toHaveAttribute("data-covered", "1");
  grabbing = false;
  await grabbed;
  for (const [i, f] of frames.entries()) writeFileSync(`${SHOTS}/babur-gif-${String(i).padStart(3, "0")}.png`, f);
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator("canvas.boss-storm")).toHaveCount(0);
  // The gear's Leave (or Resign, as the battle offers): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});

test("challenging Hollow in the town: his own intro (in to your seats, his line, the table pops in still lit, his channel line as the ball charges, the lanterns out one by one, the string, the tree, his strand, your pawn, the blackout, the dim light, the iris to the board), the battle out of the dark; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  // (Hollow is live for everyone: a player's town. Nov 3: his own intro, Eric's design with his changes.)
  await page.goto("/town?sky=night");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  const { confirm, stood } = await toConfirm(page, "hollow", "Hollow");
  // (The phone's GIF at real timing: every frame from the Fight tap to the board, each with its ms since the tap; JPEGs, the quickest
  // to take, so the most frames.)
  const frames: { at: number; png: Buffer }[] = [];
  let grabbing = !!SHOTS && project === "phone";
  const fightAt = Date.now();
  await confirm.getByRole("button", { name: "Fight" }).click();
  const grabbed = (async () => {
    while (grabbing) {
      const png = await page.screenshot({ scale: "css", type: "jpeg", quality: 85 });
      frames.push({ at: Date.now() - fightAt, png });
    }
  })();
  // In at the cave's mouth, up the passage to the frozen pond: straight to your seats (BOSS_INTROS' `seated`: his clear place, yours
  // the usual), and you stay there.
  await expect(room(page)).toHaveAttribute("data-room", "hollow", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Hollow Peak" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  const seats = [12.5 + CHALLENGE_FEEL.clear.you, 11.5, 12.5 - 2.92, 11.5];
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  await expect.poll(step, { message: "his line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual(seats);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  // The table pops in on the ice while it's still lit, its stools at your sides; nobody hops back (you're already in your seats).
  await expect.poll(async () => (await intro(page))?.table, { message: "the table pops in", intervals: [50] }).toBe(true);
  const atTable = (await intro(page))!;
  expect(atTable.stools).toEqual([[11.5, 11.5], [13.5, 11.5]]);
  expect(where(atTable)).toEqual(seats);
  expect(atTable.dark).toMatchObject({ level: 0, lanterns: 0, run: 0 });
  await shot("hollow-table");
  // He starts to channel: one of his four lines over his head, the ball charging.
  await expect.poll(step, { message: "he charges", intervals: [50] }).toBe("charge");
  const atCharge = (await intro(page))!;
  expect(introOf("hollow")!.chant).toContain(atCharge.chant);
  expect(atCharge).toMatchObject({ line: false, table: true, attack: false, dark: { move: "charge", level: 0 } });
  // The drain: the lanterns out one by one, then the string, the tree, his strand and your pawn; then black. From here on nobody
  // moves from their place and the table stays: only the light changes.
  const looks: Intro[] = [];
  const look = async () => {
    const i = (await intro(page))!;
    looks.push(i);
    return i;
  };
  await expect.poll(async () => (await look()).dark?.lanterns ?? 0, { message: "the first lantern goes out", intervals: [30] }).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await look()).dark?.lanterns ?? 0, { message: "the third", intervals: [30] }).toBeGreaterThanOrEqual(3);
  await shot("hollow-drain");
  await expect.poll(async () => (await look()).dark?.lanterns ?? 0, { message: "all five, one by one", intervals: [30] }).toBe(5);
  await expect.poll(async () => (await look()).dark?.run ?? 0, { message: "the string drains", intervals: [30] }).toBeGreaterThan(0);
  await expect.poll(async () => (await look()).dark?.bulbs ?? 3, { message: "his own strand", intervals: [30] }).toBe(0);
  await expect.poll(async () => (await look()).step, { message: "black", intervals: [30] }).toBe("black");
  expect((await look()).dark).toMatchObject({ level: 1, black: 1 });
  await expect.poll(async () => (await look()).dark?.pool ?? 0, { message: "the dim light comes up", intervals: [30] }).toBe(1);
  await shot("hollow-dim");
  // (The still as it starts to close: a screenshot takes a good part of the iris's 0.6 s.)
  await expect.poll(async () => (await look()).dark?.iris ?? 0, { message: "the iris closes in on the board", intervals: [20] }).toBeGreaterThan(0.02);
  await shot("hollow-iris");
  for (const i of looks) {
    expect(where(i), `at ${i.step}: in their seats`).toEqual(seats);
    expect(i.table, `at ${i.step}: the table`).toBe(true);
    expect(i.stools.length, `at ${i.step}: the stools`).toBe(2);
    expect(i.attack, `at ${i.step}: no attack`).toBe(false);
  }
  // Into the match: no second blackout, no storm: the dark holds while the battle loads, and the board comes up out of it.
  await expect(page.locator("canvas.boss-dark")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator("canvas.boss-dark")).toHaveAttribute("data-boss", "hollow");
  await expect(page.locator("canvas.boss-dark")).toHaveAttribute("data-covered", "1");
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(0);
  await expect(page.locator("canvas.boss-storm")).toHaveCount(0);
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("canvas.boss-dark")).toHaveCount(0, { timeout: 10_000 });
  grabbing = false;
  await grabbed;
  for (const [i, f] of frames.entries()) writeFileSync(`${SHOTS}/hollow-gif-${String(i).padStart(3, "0")}-${String(f.at).padStart(6, "0")}.jpg`, f.png);
  // The gear's Leave (or Resign, as the battle offers): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});

test("challenging Wrangler in the town: his own intro (in to where you stand, his line, the lasso thrown to the board on its hay bale, the bale dragged to the middle, the two ropes thrown out, the buckets yanked in as the stools, his brag, his attack, his wipe), the battle; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  type Rope = { move: string | null; lasso: string | null; bale: number | null; baleAt: [number, number] | null; standHidden: boolean; out: number; buckets: string | null };
  const ropeOf = (i: Intro | null) => (i as unknown as { rope: Rope | null } | null)?.rope ?? null;
  // (Wrangler is live for everyone: a player's town. Nov 4: his own intro, Eric's design.)
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  const { confirm, stood } = await toConfirm(page, "pig", "Wrangler");
  await confirm.getByRole("button", { name: "Fight" }).click();
  // In at the barn's doorway, straight to where you stand through it all (BOSS_INTROS' `seated`: the usual clear places, so nobody
  // moves when the bale and the buckets come in), on his mats' line.
  await expect(room(page)).toHaveAttribute("data-room", "pig", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Wrangler's Stall" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  const seats = [9.5 + CHALLENGE_FEEL.clear.you, 10.5, 9.5 - CHALLENGE_FEEL.clear.boss, 10.5];
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  const looks: Intro[] = [];
  const look = async () => {
    const i = (await intro(page))!;
    looks.push(i);
    return i;
  };
  await expect.poll(step, { message: "his line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = (await look())!;
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual(seats);
  expect(atLine.line).toBe(true);
  expect(atLine.table).toBe(false);
  // (The board still on its stand in the corner, the room's own.)
  expect(ropeOf(atLine)).toMatchObject({ standHidden: false, bale: null, buckets: null });
  await shot("wrangler-start");
  // The spin, the throw: the loop flies to the bale on the stand and cinches round it.
  await expect.poll(async () => ropeOf(await look())?.move, { message: "he spins the lasso", intervals: [30] }).toBe("spin");
  await expect.poll(async () => ropeOf(await look())?.lasso, { message: "the loop flies", intervals: [30] }).toBe("fly");
  await expect.poll(async () => ropeOf(await look())?.lasso, { message: "it cinches round the bale", intervals: [30] }).toBe("cinched");
  // The yank: from then the corner's board is his bale, dragged in; it lands where the table stands.
  await expect.poll(async () => ropeOf(await look())?.standHidden, { message: "the yank takes the board from its corner", intervals: [30] }).toBe(true);
  await expect.poll(async () => ropeOf(await look())?.bale ?? 0, { message: "the bale slides", intervals: [30] }).toBeGreaterThan(0.2);
  await shot("wrangler-drag");
  await expect.poll(async () => (await look()).table, { message: "the bale lands in the middle", intervals: [30] }).toBe(true);
  expect(ropeOf(await look())?.baleAt).toEqual([9.5, 10.5]);
  // The cross throw, the ropes out each way; the buckets tumble in and land upside down as the stools.
  await expect.poll(async () => ropeOf(await look())?.move, { message: "the cross throw", intervals: [30] }).toBe("crossThrow");
  await expect.poll(async () => ropeOf(await look())?.buckets, { message: "the buckets tumble in", intervals: [30] }).toBe("tumble");
  await expect.poll(async () => (await look()).stools.length, { message: "the stools land", intervals: [30] }).toBe(2);
  expect((await look()).stools).toEqual([[8.5, 10.5], [10.5, 10.5]]);
  await expect.poll(async () => ropeOf(await look())?.buckets, { message: "standing as the stools", intervals: [30] }).toBe("stool");
  await shot("wrangler-stools");
  // His brag, then his attack swung in place before the wipe.
  await expect.poll(async () => ropeOf(await look())?.move, { message: "his brag", intervals: [30] }).toBe("brag");
  await expect.poll(step, { message: "he swings", intervals: [30] }).toBe("swing");
  expect((await look())!).toMatchObject({ attack: true, line: false, table: true });
  // Nobody moved, from the line to the swing; nothing came or went after the stools (the table and the stools stay).
  for (const i of looks) expect(where(i), `at ${i.step}: where you stand`).toEqual(seats);
  const landed = looks.findIndex((i) => i.stools.length === 2);
  for (const i of looks.slice(landed)) expect([i.table, i.stools.length], `at ${i.step}`).toEqual([true, 2]);
  // His wipe (spurs, tumbleweeds and cap guns) sweeps in over the barn, the battle loads under it, and it slides off the board.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "pig");
  await page.waitForTimeout(250);
  await shot("wrangler-wipe");
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
  // The gear's Leave (or Resign, as the battle offers): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});

test("challenging Big Boy in the town: his own intro (his line, his toy blocks build the table, the board plops on, the stools drop in, his attack, the lollipop swirl), the battle; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  const { confirm, stood } = await toConfirm(page, "bigboy", "Big Boy");
  // (The phone's GIF at real timing: every frame from the Fight tap to the swirl covering, each with its ms since the tap.)
  const frames: { at: number; png: Buffer }[] = [];
  let grabbing = !!SHOTS && project === "phone";
  const fightAt = Date.now();
  await confirm.getByRole("button", { name: "Fight" }).click();
  const grabbed = (async () => {
    while (grabbing) {
      const png = await page.screenshot({ scale: "css" });
      frames.push({ at: Date.now() - fightAt, png });
    }
  })();
  // In his Crib: you both walk in up the walkway onto his circle's zoo rug, to its start marks (SHOP_BIGBOY_MARKS: his west, yours east).
  await expect(room(page)).toHaveAttribute("data-room", "bigboy", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Big Boy's Crib" })).toBeVisible();
  const seen = new Set<string>();
  // (His attack, seen at any look before the swirl covers: a slow phone's screenshots for the GIF can make the looks far apart.)
  let attacked = false;
  const step = async () => {
    const i = await intro(page);
    const s = i?.step ?? "";
    seen.add(s);
    if (i?.attack && (await storm(page).getAttribute("data-covered", { timeout: 50 }).catch(() => null)) !== "1") attacked = true;
    return s;
  };
  await expect.poll(step, { message: "on their marks: his line", timeout: 15_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.layout).toBe("across");
  expect(atLine.you).toEqual([11, 10.5]);
  expect(atLine.boss).toEqual([8, 10.5]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  expect(atLine.pyramid).toBeNull();
  await expect(page.locator(".tc-line").filter({ hasText: "My blocks! My board! Big boy go first!" })).toHaveCount(0);
  // His blocks build the table under his line; the board drops onto it and plops on; the stools drop in at your sides (his dark B, your
  // bone W: the table's picture, a square either side of its middle).
  await expect.poll(step, { message: "the blocks build", intervals: [50] }).toBe("build");
  expect((await intro(page))!.blocks?.anim).toBe("build");
  await shot("bb-build");
  await expect.poll(step, { message: "the board plops on", intervals: [50] }).toMatch(/plop|chairs/);
  await expect.poll(async () => (await intro(page))?.stools.length, { message: "the stools drop in", intervals: [50] }).toBe(2);
  expect((await intro(page))!.stools).toEqual([[8.5, 10.5], [10.5, 10.5]]);
  await expect.poll(step, { message: "the table stands", intervals: [50] }).toMatch(/table|swing|done/);
  const atTable = (await intro(page))!;
  expect(atTable).toMatchObject({ table: true, drop: 0, blocks: { anim: "idle" } });
  // His B and your W in full view: you both hopped back clear of them as they dropped (Eric, Nov 2).
  await clearOfStools(page, 10.5);
  await shot("bb-table");
  // His God King attack beside the table before the swirl covers the screen.
  await expect.poll(async () => (await step(), attacked), { message: "his attack, before the swirl covers", intervals: [50] }).toBe(true);
  await shot("bb-attack");
  // His lollipop swirl sweeps in over everything (played as Alfil's sandstorm), the battle loading under it.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "bigboy");
  await expect(storm(page)).toHaveAttribute("data-covered", "1");
  const coveredMs = Date.now() - fightAt;
  await shot("bb-swirl");
  grabbing = false;
  await grabbed;
  if (SHOTS) writeFileSync(`${SHOTS}/bigboy-timing-${project}.txt`, `Fight to covered: ${coveredMs} ms\n`);
  for (const [i, f] of frames.entries()) writeFileSync(`${SHOTS}/bigboy-gif-${String(i).padStart(3, "0")}-${String(f.at).padStart(6, "0")}.png`, f.png);
  expect([...seen].filter((s) => ["line", "build", "drop", "plop", "chairs", "table"].includes(s)).length).toBeGreaterThanOrEqual(4);
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Big Boy's Crib" })).toHaveCount(0);
  // The gear's Leave (or Resign, as the battle offers): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});

test("challenging Dash in an admin's town: the default intro in his store (his line, the table pops in, no attack of his drawn: he stands, the flash and the wipe), the battle; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (Dash is in the game for admins first: his store is in an admin's town only. Round 3 brings his own intro. `debug`: window.match.)
  await asAdmin(page);
  await page.goto("/town?sky=day&debug");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  const { confirm, stood } = await toConfirm(page, "dash", "Dash");
  await confirm.getByRole("button", { name: "Fight" }).click();
  // In his store: you both walk in onto his try-on mats (SHOP_BLITZ_MARKS: his west, yours east), facing each other.
  await expect(room(page)).toHaveAttribute("data-room", "dash", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Dash's Kicks" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  await expect.poll(step, { message: "on their marks: his line", timeout: 15_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.layout).toBe("across");
  expect(atLine.you).toEqual([11, 10.5]);
  expect(atLine.boss).toEqual([8, 10.5]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  // The table pops in, its stools at your sides; you both hop back clear of them.
  await expect.poll(async () => (await intro(page))?.table, { message: "the table pops in", intervals: [50] }).toBe(true);
  await clearOfStools(page, 10.5);
  // The swing's beat: no God King attack was drawn for him (round 1), so he stands in his idle.
  await expect.poll(step, { message: "the swing's beat", intervals: [50] }).toBe("swing");
  expect((await intro(page))!).toMatchObject({ attack: false, line: false, table: true });
  // The flash and the wipe to black, the battle (Boss alone, Dash) loading under it.
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator("canvas.boss-wipe")).toHaveAttribute("data-boss", "dash");
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(0, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as { match?: { boss?: { id: string } } }).match?.boss?.id)).toBe("dash");
  // The gear's Leave (or Resign, as the battle offers): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});

test("challenging Timber in an admin's town: his own intro (his line, the log carried to the middle and gnawed, the shavings' fog, his table and stumps, his attack, the sawdust sweep), the battle; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  // (Timber is in the game for admins first: his lodge is in an admin's town only.)
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1");
  const { confirm, stood } = await toConfirm(page, "timber", "Timber");
  // (The phone's GIF at real timing: every frame from the Fight tap to the sweep covering, each with its ms since the tap.)
  const frames: { at: number; png: Buffer }[] = [];
  let grabbing = !!SHOTS && project === "phone";
  const fightAt = Date.now();
  await confirm.getByRole("button", { name: "Fight" }).click();
  const grabbed = (async () => {
    while (grabbing) {
      const png = await page.screenshot({ scale: "css" });
      frames.push({ at: Date.now() - fightAt, png });
    }
  })();
  // In his Lumber Lodge: you both walk in onto his circle's branded marks (SHOP_TIMBER_MARKS: his west, yours east).
  await expect(room(page)).toHaveAttribute("data-room", "timber", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Timber's Lumber Lodge" })).toBeVisible();
  const seen = new Set<string>();
  const woods: Wood[] = [];
  let attacked = false;
  const step = async () => {
    const i = await intro(page);
    const s = i?.step ?? "";
    seen.add(s);
    if (i?.wood) woods.push(i.wood);
    if (i?.attack && (await storm(page).getAttribute("data-covered", { timeout: 50 }).catch(() => null)) !== "1") attacked = true;
    return s;
  };
  // Walking in: the giant log already lies there, on the left.
  await expect.poll(async () => (await intro(page))?.wood?.log ?? null, { message: "the log lies there as you walk in", timeout: 15_000, intervals: [50] }).toBe("lying");
  await expect.poll(step, { message: "on their marks: his line", timeout: 15_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.layout).toBe("across");
  expect(atLine.you).toEqual([11, 10.5]);
  expect(atLine.boss).toEqual([8, 10.5]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  expect(atLine.wood).toMatchObject({ move: null, log: "lying", fog: null, stumps: null });
  await shot("tm-line");
  await expect(page.locator(".tc-line").filter({ hasText: "Hard hats on. We're building today." })).toHaveCount(0);
  // He walks west to the log (facing it), his line still over his head; heaves it up (the lying log gone: it's in his paws).
  await expect.poll(step, { message: "he walks to the log", intervals: [50] }).toBe("toLog");
  const toLog = (await intro(page))!;
  expect(toLog.facing.boss).toBe(-1);
  expect(toLog.boss[0]).toBeLessThanOrEqual(8);
  await expect.poll(step, { message: "he heaves it up", intervals: [50] }).toMatch(/lift|carry/);
  expect((await intro(page))!.wood!.log).toBeNull();
  await expect.poll(step, { message: "he carries it to the middle", intervals: [50] }).toMatch(/carry|setDown/);
  await shot("tm-carry");
  await expect.poll(step, { message: "he gnaws it", intervals: [50] }).toBe("gnaw");
  expect((await intro(page))!.wood).toMatchObject({ move: "gnaw", log: "gnawed" });
  await shot("tm-gnaw");
  // The fog boils up and hides it; the table swaps in under it; it settles.
  await expect.poll(step, { message: "the shavings' fog", intervals: [50] }).toMatch(/rise|hold/);
  await expect.poll(step, { message: "it holds", intervals: [50] }).toMatch(/hold|settle/);
  await shot("tm-fog");
  // The stumps pop up at your sides; you hop back clear of yours; he dusts off his paws and walks to his place.
  await expect.poll(async () => (await intro(page))?.stools.length, { message: "the stumps pop up", intervals: [50] }).toBe(2);
  expect((await intro(page))!.stools).toEqual([[8.5, 10.5], [10.5, 10.5]]);
  expect((await intro(page))!.table).toBe(true);
  await expect.poll(step, { message: "he dusts off his paws", intervals: [50] }).toMatch(/dust|toMark|swing/);
  await shot("tm-table");
  await expect.poll(step, { message: "he walks to his place and swings", intervals: [50] }).toBe("swing");
  const swing = (await intro(page))!;
  expect(swing).toMatchObject({ table: true, line: false, wood: { move: null, log: null, fog: null, ring: true, stumps: "idle" } });
  expect(swing.boss[0]).toBeCloseTo(9.5 - CHALLENGE_FEEL.log.clear);
  expect(swing.you[0]).toBeCloseTo(9.5 + CHALLENGE_FEEL.clear.you);
  await expect.poll(async () => (await step(), attacked), { message: "his attack, before the sweep covers", intervals: [50] }).toBe(true);
  await shot("tm-attack");
  // The table and stumps never showed before the fog's hold.
  const order = [...seen];
  expect(order.indexOf("hold") >= 0 || order.indexOf("settle") >= 0).toBe(true);
  // His sawdust sweep (played as Alfil's sandstorm), the battle loading under it.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "timber");
  await expect(storm(page)).toHaveAttribute("data-covered", "1");
  const coveredMs = Date.now() - fightAt;
  await shot("tm-sweep");
  grabbing = false;
  await grabbed;
  if (SHOTS) writeFileSync(`${SHOTS}/timber-timing-${project}.txt`, `Fight to covered: ${coveredMs} ms\n`);
  for (const [i, f] of frames.entries()) writeFileSync(`${SHOTS}/timber-gif-${String(i).padStart(3, "0")}-${String(f.at).padStart(6, "0")}.png`, f.png);
  expect([...seen].filter((s) => ["line", "toLog", "lift", "carry", "setDown", "gnaw", "rise", "hold", "settle", "pop", "dust", "toMark", "swing"].includes(s)).length).toBeGreaterThanOrEqual(8);
  // (Never the lying log after he lifted it, never the stumps before the fog.)
  const lifted = woods.findIndex((w) => w.move === "lift");
  expect(lifted).toBeGreaterThanOrEqual(0);
  expect(woods.slice(lifted).some((w) => w.log === "lying")).toBe(false);
  const fogged = woods.findIndex((w) => w.fog !== null);
  expect(woods.slice(0, fogged).some((w) => w.stumps !== null)).toBe(false);
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Timber's Lumber Lodge" })).toHaveCount(0);
  await shot("tm-battle");
  // The gear's Leave (or Resign, as the battle offers): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});
