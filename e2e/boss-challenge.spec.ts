import { expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { CHALLENGE_FEEL, introOf } from "../packages/app/src/town/shops/challenge.ts";
import { BOARD_SEL, asAdmin, asSignedIn, named, tapInTown, test } from "./helpers.ts";

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
 * Dash (his own intro, Nov 5, round 3; an admin's town: he's in the game for admins first): in with him to his store's circle, both
 * straight to where you stand through it all; his line; he bolts off four times in a trail of dust and races back each time to toss
 * something onto the spot (the shoe-box table, the board, the pieces with a pop, both stools); his brag; no God King attack was drawn
 * for him, so he stands through its beat; his clock rush (`canvas.boss-storm`) covers the screen, the battle under it, and the gear's
 * Leave back to where you stood. Nothing pops in at the end and nobody steps once the stools land.
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
type Intro = { step: string; layout: string; attack: boolean; you: [number, number]; boss: [number, number]; facing: { you: number; boss: number }; looks: number | null; mirrored: boolean; line: boolean; table: boolean; stools: [number, number][]; pyramid: { anim: string; frame: number } | null; blocks: { anim: string; frame: number } | null; drop: number; wood: Wood | null; chant: string | null; dark: Dark | null };
type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townYou?: () => Stand | null;
  __townCam?: () => { focus: [number, number] } | null;
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

/** Opens Alfil's card (his Pyramid is across the map: the camera glides there, as its chip would) and his challenge's confirm (or another boss's). */
async function toConfirm(page: Page, id = "alfil", name = "Alfil") {
  // His card, by a real tap once the view holds still (helpers.ts tapInTown: the camera glides onto him when he's off the screen or hidden
  // behind a figure or a house; he may stroll a step between the look and the tap: tapped again; another's card that opened is closed).
  const card = await tapInTown(page, "boss", id, page.getByRole("dialog", { name, exact: true }));
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
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
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
  // (What the town's chat asked the server and heard, each /api/live: printed if the server's lines don't show. On CI the log once
  // stayed empty for 15 s after Back to town while the server held both lines, and two batches couldn't reproduce it locally:
  // docs/decisions/2026-11-11-flaky-batch.md. A request with no answer shows as "asked" alone.)
  const live: string[] = [];
  const t0 = Date.now();
  const note = (s: string) => {
    live.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`);
    if (live.length > 60) live.shift();
  };
  const liveUrl = (u: string) => (u.includes("/api/live") ? u.slice(u.indexOf("/api/live")) : null);
  page.on("request", (r) => liveUrl(r.url()) && note(`asked ${liveUrl(r.url())}`));
  page.on("requestfailed", (r) => liveUrl(r.url()) && note(`failed ${liveUrl(r.url())}: ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    const u = liveUrl(r.url());
    if (!u) return;
    void r.json().then(
      (b: { town?: { room?: string; n?: number; lines?: { text: string }[]; reset?: boolean; paused?: boolean } }) =>
        note(`${r.status()} ${u} town=${b.town ? JSON.stringify({ ...b.town, lines: b.town.lines?.map((l) => l.text) }) : "none"}`),
      () => note(`${r.status()} ${u} (no body)`),
    );
  });
  const linesAre = (want: unknown[]) =>
    expect
      .poll(() => serverLines(page, me), { timeout: 15_000 })
      .toEqual(want)
      .catch(async (e: Error) => {
        const log = await page.locator(".tc-line").allTextContents().catch(() => []);
        throw new Error(`${e.message}\n\nThe chat log's lines: ${JSON.stringify(log)}\nThe town's /api/live:\n${live.join("\n")}`);
      });
  // (The town's chat lives in the live hub's memory: a restart forgets it and opens a new room, by design, docs/areas/chat.md. The
  // local server frees a Durable Object after some seconds without a request (reproduced: 45 s on the result screen gave a new, empty
  // room; on CI a battle's 11 s did, Nov 11), while on Cloudflare every app's heartbeat keeps it in use. So, standing in for the
  // town's other visitors, a reader asks for the town's lines every 1.5 s until the page closes. Nothing else of the spec changes.)
  const awake = setInterval(() => void page.request.get("/api/live?town=0").catch(() => undefined), 1500);
  page.on("close", () => clearInterval(awake));
  await named(page, me);
  // (Once the page has its account: signing in a request's own new account would race the page's.)
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await page.waitForLoadState("networkidle");
  await asSignedIn(page, "challenger");
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });

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
    await linesAre([expect.stringMatching(new RegExp(`\\] ${me} challenged Alfil!$`))]);
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
  // Alfil's goodbye (Eric, Nov 7), in his bubble as you walk back in: the town's own speech, read from its state (the bubble is canvas).
  await expect.poll(() => page.evaluate(() => (window as any).__townCam().speechLine as string), { timeout: 3_000, intervals: [100] }).toBe("Good game! The Pyramid door stays open for you.");
  // The server's lines: still the one start line (the quit left it open: no second), and this battle's outcome (?mate=1 plays
  // your moves for you, none of them yours: no count; the counts are packages/server/test/town-chat.test.ts's).
  await linesAre([expect.stringMatching(new RegExp(`\\] ${me} challenged Alfil!$`)), expect.stringMatching(new RegExp(`\\] Alfil beat ${me}( in \\d+ moves?)?\\.$`))]);
  await shot("08-back-in-town");
  expect(errors).toEqual([]);
});

test("challenging Babur in the town: the default intro (his line, the table pops in, his attack swung in place, the flash and the wipe), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
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

test("challenging Hollow in the town: his own intro (in to your seats, his line, the table pops in still lit, his channel line as the ball charges, the lanterns out one by one, the string, the tree, his strand, your pawn, the blackout, the dim light, the iris to the board), the battle out of the dark; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  // (Hollow is live for everyone: a player's town. Nov 3: his own intro, Eric's design with his changes.)
  await page.goto("/town?sky=night");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
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

type FolioState = { move: string; stools: string[]; table: string; plane: { anim: string; at: [number, number]; lift: number } | null; packet: boolean; board: string | null; real: boolean };
type Crumple = { phase: string; phases: string; mode: string; dom: string; match: string; covered: string; why: string };
/** Folio's crumple cover's state now (null: none). */
const crumpleNow = (p: Page) =>
  p.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas.boss-crumple");
    return c ? { phase: c.dataset.phase ?? "", phases: c.dataset.phases ?? "", mode: c.dataset.mode ?? "", dom: c.dataset.dom ?? "", match: c.dataset.match ?? "", covered: c.dataset.covered ?? "", why: c.dataset.why ?? "" } : null;
  });
/**
 * Folio's challenge (Nov 5; everyone's): in with it to the clean page's marks; its line; you both step back a pace; the stools fold up
 * from their sheets (west, then east), then the table; the plane comes in, the packet falls onto the table and unfolds, and the game's own
 * board is there; it bows and says one of its five quiet lines; the crumple (`canvas.boss-crumple`) takes the screen, crumples it into a
 * ball, holds, and opens onto the match screen; gone, the battle; the gear's Leave back to where you stood. `noGl`: WebGL off (the page
 * can't get a WebGL context): the fade through black.
 */
async function folioChallenge(page: Page, opts: { noGl: boolean; gif: boolean }) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  if (opts.noGl)
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
        // (Nov 13: but the town's own canvas, as the street town is everyone's and needs WebGL 2; a device without it never gets this far:
        // e2e/problems.spec.ts. The crumple's own WebGL is what's off.)
        if (/webgl/.test(kind) && !this.classList.contains("town-canvas")) return null;
        return (get as (...a: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
      } as typeof get;
    });
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const { confirm, stood } = await toConfirm(page, "folio", "Folio");
  // (The phone's GIF: the page's own frames as Chrome draws them (its screencast), each with its time, from the Fight tap to the match:
  // screenshots taken alongside slow the page, and the cover's WebGL slows them to about one a second.)
  const gif = !!SHOTS && opts.gif && project === "phone";
  const cast: { at: number; jpg: Buffer }[] = [];
  const caster = gif ? await page.context().newCDPSession(page) : null;
  caster?.on("Page.screencastFrame", (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    cast.push({ at: (f.metadata.timestamp ?? Date.now() / 1000) * 1000, jpg: Buffer.from(f.data, "base64") });
    void caster.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  // (FOLIO_CPU=4: the phone's frame-rate check, its CPU slowed 4x through the crumple's run: the frame times are logged below.)
  const cpu = Number(process.env.FOLIO_CPU ?? 0);
  if (cpu > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await caster?.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });
  await confirm.getByRole("button", { name: "Fight" }).click();
  await expect(room(page)).toHaveAttribute("data-room", "folio", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Folio's Folded House" })).toBeVisible();
  const looks: (Intro & { folio: FolioState | null })[] = [];
  const look = async () => {
    const i = (await intro(page)) as (Intro & { folio: FolioState | null }) | null;
    if (i) looks.push(i);
    return i;
  };
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  // On the clean page's marks (its art's: Folio at 8, you at 11, on row 10.5), facing each other; its line.
  await expect.poll(async () => (await look())?.step, { message: "its line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = (await look())!;
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual([11, 10.5, 8, 10.5]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  expect(atLine.folio).toMatchObject({ stools: ["sheet", "sheet"], table: "sheet", plane: null, board: null, real: false });
  await shot("folio-line");
  // You both step back a pace (no hop): Folio to 2.3 squares west of the table's middle, you to the usual 2.2 east.
  await expect.poll(async () => where((await look())!), { message: "stepped back", intervals: [50] }).toEqual([9.5 + CHALLENGE_FEEL.clear.you, 10.5, 9.5 - 2.3, 10.5]);
  // The stools fold up, west then east, then the table.
  await expect.poll(async () => (await look())?.folio?.table, { message: "the table folds", intervals: [30] }).toBe("fold");
  await shot("folio-fold");
  // The plane brings the board; the packet falls, lies and unfolds; then the game's own board.
  await expect.poll(async () => (await look())?.folio?.plane !== null, { message: "the plane", intervals: [30] }).toBe(true);
  await expect.poll(async () => (await look())?.folio?.board, { message: "the board unfolds", intervals: [30] }).toBe("unfold");
  await shot("folio-unfold");
  await expect.poll(async () => (await look())?.folio?.real, { message: "the board on the table", intervals: [30] }).toBe(true);
  // It bows, and says one of its five quiet lines.
  await expect.poll(async () => (await look())?.chant ?? null, { message: "its quiet line", intervals: [30] }).not.toBeNull();
  const quiet = (await look())!;
  expect(introOf("folio")!.chant).toContain(quiet.chant);
  await shot("folio-quiet");
  // The order, from every look: the west stool first, the east one, the table; nobody moved after the step back; no attack.
  const firstOf = (f: (i: (typeof looks)[number]) => boolean) => looks.findIndex(f);
  const w = firstOf((i) => i.folio?.stools[0] !== "sheet" && !!i.folio);
  const e = firstOf((i) => i.folio?.stools[1] !== "sheet" && !!i.folio);
  const t = firstOf((i) => i.folio?.table !== "sheet" && !!i.folio);
  expect(w).toBeGreaterThan(0);
  expect(e).toBeGreaterThanOrEqual(w);
  expect(t).toBeGreaterThan(e);
  for (const i of looks.slice(firstOf((x) => x.folio?.stools[0] !== "sheet" && !!x.folio))) {
    expect(where(i), `at ${i.step}: in their places`).toEqual([9.5 + CHALLENGE_FEEL.clear.you, 10.5, 9.5 - 2.3, 10.5]);
    expect(i.attack, `at ${i.step}: no attack`).toBe(false);
  }
  // The crumple (or, WebGL off, the fade through black), its state watched from before it starts to after it's gone.
  const seen: Crumple[] = [];
  await expect
    .poll(
      async () => {
        const c = await crumpleNow(page);
        if (c) seen.push(c);
        return !!c;
      },
      { message: "the crumple takes the screen", timeout: 15_000, intervals: [20] },
    )
    .toBe(true);
  await expect(page.locator("canvas.boss-storm, canvas.boss-wipe, canvas.boss-dark")).toHaveCount(0);
  await expect
    .poll(
      async () => {
        const c = await crumpleNow(page);
        if (c) seen.push(c);
        return c === null;
      },
      { message: "the crumple is gone, the match there", timeout: 60_000, intervals: [20] },
    )
    .toBe(true);
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 10_000 });
  if (caster) {
    await page.waitForTimeout(1500);
    await caster.send("Page.stopScreencast");
    const t0 = cast[0]?.at ?? 0;
    for (const [i, f] of cast.entries()) writeFileSync(`${SHOTS}/folio-cast-${String(i).padStart(4, "0")}-${String(Math.round(f.at - t0)).padStart(6, "0")}.jpg`, f.jpg);
  }
  // The crumple's frames (test switches on: crumple-gl.ts logs each one's time), for its frame rate: the median and the slowest.
  const log = await page.evaluate(() => (window as unknown as { __crumpleFrames?: { t: number; phase: string; js: number }[] }).__crumpleFrames ?? []);
  const byPhase = (ph: string) => {
    const g = log.slice(1).flatMap((f, i) => (f.phase === ph && log[i]!.phase === ph ? [f.t - log[i]!.t] : [])).sort((a, b) => a - b);
    const js = log.filter((f) => f.phase === ph).map((f) => f.js).sort((a, b) => a - b);
    return g.length ? `${ph} ${(1000 / g[g.length >> 1]!).toFixed(0)} fps (${g.length}; its own work ${js[js.length >> 1]!.toFixed(1)} ms)` : `${ph} -`;
  };
  if (log.length > 2) console.log(`crumple by phase (${project}${cpu > 1 ? `, CPU ${cpu}x` : ""}): ${["crumple", "hold", "open", "linger"].map(byPhase).join(", ")}`);
  const times = log.map((f) => f.t);
  if (times.length > 2) {
    const gaps = times.slice(1).map((t, i) => t - times[i]!).sort((a, b) => a - b);
    const med = gaps[gaps.length >> 1]!;
    test.info().annotations.push({ type: "crumple frames", description: `${gaps.length} frames, median ${med.toFixed(1)} ms (${(1000 / med).toFixed(1)} fps), slowest ${gaps.at(-1)!.toFixed(1)} ms, over 33 ms: ${gaps.filter((g) => g > 33.4).length}${cpu > 1 ? `, CPU ${cpu}x` : ""}` });
    console.log(`crumple frames (${project}): ${`${gaps.length} frames, median ${med.toFixed(1)} ms (${(1000 / med).toFixed(1)} fps), slowest ${gaps.at(-1)!.toFixed(1)} ms, over 33 ms: ${gaps.filter((g) => g > 33.4).length}${cpu > 1 ? `, CPU ${cpu}x` : ""}`}`);
  }
  // (Every phase it went through, as it says; and every look's.)
  const phases = [...new Set([...seen.map((c) => c.phase), ...seen.flatMap((c) => c.phases.split(" "))])];
  if (opts.noGl) {
    expect(seen.every((c) => c.mode === "fade"), JSON.stringify(seen.slice(0, 3))).toBe(true);
    expect(phases).toContain("covered");
  } else {
    expect(seen.every((c) => c.mode === "gl"), JSON.stringify(seen.slice(0, 3))).toBe(true);
    // Crumpled, held, opened onto the match's own picture (taken with its DOM), the creases lingering over the live match.
    for (const ph of ["crumple", "hold", "open"]) expect(phases, JSON.stringify(seen.at(-1))).toContain(ph);
    expect(seen.some((c) => c.match === "1"), "the match's picture on the ball").toBe(true);
    expect(seen.at(-1)!.dom, "the room's DOM layer in its picture").toBe("1");
  }
  // The gear's Leave (or Resign): back in the town square where you stood.
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
}
/**
 * Smudgy's challenge (Nov 6; everyone's): in with him to the drop cloth's marks beside the covered table's stools; his line; he whips the
 * cloth off (the board under it, the cloth in a heap); his reveal line; the splatter (`canvas.boss-splatter`) covers the screen and a
 * brush stroke wipes it onto the match; the gear's Leave back to where you stood.
 */
async function smudgyChallenge(page: Page, opts: { gif: boolean }) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const { confirm, stood } = await toConfirm(page, "smudgy", "Smudgy");
  const gif = !!SHOTS && opts.gif && project === "phone";
  const cast: { at: number; jpg: Buffer }[] = [];
  const caster = gif ? await page.context().newCDPSession(page) : null;
  caster?.on("Page.screencastFrame", (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    cast.push({ at: (f.metadata.timestamp ?? Date.now() / 1000) * 1000, jpg: Buffer.from(f.data, "base64") });
    void caster.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await caster?.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });
  await confirm.getByRole("button", { name: "Fight" }).click();
  await expect(room(page)).toHaveAttribute("data-room", "smudgy", { timeout: 20_000 });
  type Look = Intro & { cloth: string | null };
  const looks: Look[] = [];
  const look = async () => {
    const i = (await intro(page)) as Look | null;
    if (i) looks.push(i);
    return i;
  };
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  // On the marks beside the stools (seated: you at 12, he at his clear place, on row 14), facing each other; his line; the cloth on.
  await expect.poll(async () => (await look())?.step, { message: "his line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = (await look())!;
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual([12, 14, Math.round((9.5 - CHALLENGE_FEEL.clear.boss) * 100) / 100, 14]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  // (His drawing faces east too, toward the table and you: his art faces our left, so he's drawn mirrored. Eric, Nov 6: "in the battle
  // intro he's facing the wrong way when the match starts".)
  expect(atLine.looks, "he's drawn facing the table").toBe(1);
  expect(atLine.line).toBe(true);
  expect(atLine.cloth).toBe("covered");
  await shot("smudgy-line");
  await expect.poll(async () => (await look())?.cloth, { message: "the cloth whipped off", intervals: [20] }).toBe("whip");
  await shot("smudgy-whip");
  await expect.poll(async () => (await look())?.cloth, { message: "the cloth in its heap", intervals: [30] }).toBe("heap");
  await expect.poll(async () => (await look())?.chant ?? null, { message: "his reveal line", intervals: [30] }).toBe("Careful, don't get any paint on the pieces!");
  await shot("smudgy-reveal");
  // The order, from every look: covered, then whipped, then the heap; the reveal line only once the cloth is down; nobody moved; no attack.
  const firstOf = (f: (i: Look) => boolean) => looks.findIndex(f);
  expect(firstOf((i) => i.cloth === "whip")).toBeGreaterThan(firstOf((i) => i.cloth === "covered"));
  expect(firstOf((i) => i.cloth === "heap")).toBeGreaterThan(firstOf((i) => i.cloth === "whip"));
  expect(firstOf((i) => !!i.chant)).toBeGreaterThan(firstOf((i) => i.cloth === "heap"));
  for (const i of looks.slice(looks.indexOf(atLine))) {
    expect(where(i), `at ${i.step}: in their places`).toEqual(where(atLine));
    expect(i.attack, `at ${i.step}: no attack`).toBe(false);
    expect(i.looks, `at ${i.step}: drawn facing the table`).toBe(1);
  }
  // The splatter: in, covered, out (the stroke), gone; the match there.
  const phases = new Set<string>();
  const now = () => page.evaluate(() => (document.querySelector("canvas.boss-splatter") as HTMLCanvasElement | null)?.dataset.phase ?? null);
  await expect.poll(async () => { const p = await now(); if (p) phases.add(p); return !!p; }, { message: "the splatter takes the screen", timeout: 15_000, intervals: [20] }).toBe(true);
  await expect(page.locator("canvas.boss-storm, canvas.boss-wipe, canvas.boss-dark, canvas.boss-crumple")).toHaveCount(0);
  let shotCovered = false;
  await expect
    .poll(
      async () => {
        const p = await now();
        if (p) phases.add(p);
        if (p === "covered" && !shotCovered) {
          shotCovered = true;
          await shot("smudgy-splatter");
        }
        return p === null;
      },
      { message: "the splatter is gone, the match there", timeout: 60_000, intervals: [20] },
    )
    .toBe(true);
  expect([...phases]).toEqual(expect.arrayContaining(["in", "out"]));
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 10_000 });
  // The match: his figure (the bar on a phone, by the board's corner on a computer) left of the board, drawn facing it.
  const fig = page.locator(".boss-char:visible").first();
  await expect(fig).toHaveAttribute("data-faces", "right");
  const [fb, bb] = [(await fig.boundingBox())!, (await page.locator(BOARD_SEL.squares).first().boundingBox())!];
  expect(fb.x + fb.width / 2, "he stands left of the board's middle").toBeLessThan(bb.x + bb.width / 2);
  await shot("smudgy-match");
  if (caster) {
    await page.waitForTimeout(1500);
    await caster.send("Page.stopScreencast");
    const t0 = cast[0]?.at ?? 0;
    for (const [i, f] of cast.entries()) writeFileSync(`${SHOTS}/smudgy-cast-${String(i).padStart(4, "0")}-${String(Math.round(f.at - t0)).padStart(6, "0")}.jpg`, f.jpg);
  }
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
}
test("challenging Smudgy in the town: his own intro (to the marks by the covered table, his line, the cloth whipped off, the board, his reveal line), the splatter into the match; Leave back where you stood", async ({ page }) => {
  test.setTimeout(240_000);
  await smudgyChallenge(page, { gif: true });
});
test("challenging Folio in the town: its own intro (to the clean page's marks, its line, the step back, the stools and the table folding up, the plane bringing the board, the board unfolding, its bow and quiet line), the crumple into the match; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  await folioChallenge(page, { noGl: false, gif: true });
});
test("challenging Folio with WebGL off: the crumple falls back to a fade through black, and the match starts", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  await folioChallenge(page, { noGl: true, gif: false });
});

test("challenging Wrangler in the town: his own intro (in to where you stand, his line, the lasso thrown to the board on its hay bale, the bale dragged to the middle, the two ropes thrown out, the buckets yanked in as the stools, his brag, his attack, his wipe), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
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
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
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

test("challenging Jefferson in the town: his own intro (in to your marks, one of his calls, he hollers, the crew stop and come round the table to watch, your lift raises you level with the board, his brag, his attack, his wipe of sparklers and fireworks), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  type Fig = { name: string; anim: string; at: [number, number]; flip: boolean; up: number };
  type Crew = { move: string | null; stopped: number; walk: number; lift: string; plate: number; table: string; tableAt: [number, number]; figs: Fig[] };
  const crewOf = (i: Intro | null) => (i as unknown as { crew: Crew | null } | null)?.crew ?? null;
  const lineOf = (i: Intro | null) => (i as unknown as { lineText: string | null } | null)?.lineText ?? null;
  // (Jefferson is live for everyone: a player's town. Nov 4: his own intro, Eric's design.)
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const { confirm, stood } = await toConfirm(page, "grex", "Jefferson");
  await confirm.getByRole("button", { name: "Fight" }).click();
  // In at the warehouse's door, to the marks: his red plate west of the board on its crates, your lift's plate east; you stand there
  // through it all (he stands: no stool).
  await expect(room(page)).toHaveAttribute("data-room", "grex", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Jefferson's Fireworks" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  const marks = [11, 10.5, 8, 10.5];
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  const looks: Intro[] = [];
  const look = async () => {
    const i = (await intro(page))!;
    looks.push(i);
    return i;
  };
  await expect.poll(step, { message: "his line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = await look();
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual(marks);
  expect(atLine.line).toBe(true);
  // One of his four calls (placeholders until Eric's Gemini lines), in the big bubble.
  expect(["Boys! We got a challenger!", "Take five, everybody. We're playing chess.", "Who wants a fifteen-minute break?", "Forks down, boys. Somebody wants a game."]).toContain(lineOf(atLine));
  // The board on its crates is there from the start, where the room's stood; your lift flush with the floor; the crew at work.
  expect(crewOf(atLine)).toMatchObject({ move: null, stopped: -1, lift: "flush", plate: 0, tableAt: [9.5, 10.514] });
  expect(atLine.table).toBe(true);
  expect(atLine.stools).toEqual([]);
  await shot("jefferson-start");
  // He hollers; the crew stop work (the machines park, their guys step off, the dozer wakes); he waves them over.
  await expect.poll(async () => crewOf(await look())?.move, { message: "he hollers", intervals: [30] }).toBe("call");
  await expect.poll(async () => (crewOf(await look())?.stopped ?? -1) >= 0, { message: "the crew stop", intervals: [30] }).toBe(true);
  await expect.poll(async () => crewOf(await look())?.move, { message: "he waves them over", intervals: [30] }).toBe("waveOver");
  await expect.poll(async () => (crewOf(await look())?.figs ?? []).filter((f) => f.anim === "walk").length, { message: "they walk over", intervals: [30] }).toBeGreaterThan(2);
  // By the time your lift rises they're all round the table, watching (the dealer his idle), the machines parked where they stopped.
  await expect.poll(async () => crewOf(await look())?.lift, { message: "your lift rises", timeout: 15_000, intervals: [30] }).toBe("rise");
  await expect.poll(async () => crewOf(await look())?.lift, { message: "it locks at the top", intervals: [30] }).toBe("up");
  await expect.poll(async () => crewOf(await look())?.table, { message: "the crates creak as it locks", intervals: [30] }).toBe("creak");
  const ring = crewOf(await look())!;
  expect(ring.plate, "level with the board: its slab 59 px up, 27 over your feet").toBe(32);
  const spot = (n: string) => ring.figs.filter((f) => f.name === n);
  for (const n of ["lift-guy", "fork-guy", "leaner-a", "leaner-b", "crew-c", "crew-d"]) expect(spot(n).map((f) => f.anim), n).toEqual(["watch"]);
  expect(spot("dealer").map((f) => f.anim)).toEqual(["idle"]);
  expect(spot("lift").map((f) => f.anim)).toEqual(["parked"]);
  expect(spot("forklift").map((f) => f.anim)).toEqual(["parked"]);
  // Every one of them behind the table (north of it, of him and of you).
  for (const f of ring.figs.filter((x) => !["lift", "forklift", "pallet"].includes(x.name))) expect(f.at[1], f.name).toBeLessThan(10.5);
  await shot("jefferson-ring");
  // His brag (you up on your lift), then his attack swung in place before the wipe.
  await expect.poll(async () => crewOf(await look())?.move, { message: "his brag", intervals: [30] }).toBe("brag");
  await shot("jefferson-lifted");
  await expect.poll(step, { message: "he swings", intervals: [30] }).toBe("swing");
  expect(await look()).toMatchObject({ attack: true, line: false, table: true });
  // Nobody of you two moved, from the line to the swing; you stayed up on your lift from the lock on.
  for (const i of looks) expect(where(i), `at ${i.step}: where you stand`).toEqual(marks);
  const locked = looks.findIndex((i) => crewOf(i)?.lift === "up");
  for (const i of looks.slice(locked)) expect(crewOf(i)?.plate, `at ${i.step}`).toBe(32);
  // His wipe (sparklers and fireworks) sweeps in over the warehouse, the battle loads under it, and it slides off the board.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "grex");
  await page.waitForTimeout(350);
  await shot("jefferson-wipe");
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

test("challenging Ginger in the town: his own intro (in to your marks in his igloo, his line, he charges his staff and blasts the air, the icicle falls point first and stabs the floor, its round top the table; two elves bring the board out of the stockroom and toss it up onto it; he casts and the pieces appear; his brag, his attack, his blizzard), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  type Ice = {
    move: string | null;
    blast: string | null;
    shard: { anim: string; lift: number } | null;
    table: boolean;
    crack: string | null;
    door: boolean;
    carriers: { at: [number, number]; anim: string }[] | null;
    board: { at: [number, number]; lift: number } | null;
    onTable: boolean;
    light: string | null;
    pieces: number;
    crewLine: boolean;
  };
  const iceOf = (i: Intro | null) => (i as unknown as { ice: Ice | null } | null)?.ice ?? null;
  const lineOf = (i: Intro | null) => (i as unknown as { lineText: string | null } | null)?.lineText ?? null;
  // (Ginger is live for everyone: a player's town. Nov 5: his own intro, Eric's design.)
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const { confirm, stood } = await toConfirm(page, "gingerbread", "Ginger");
  await confirm.getByRole("button", { name: "Fight" }).click();
  // In at the igloo's doorway, to the marks: his peppermint west of the battle spot's middle, your snowflake east; you both stand
  // there through it all (no stools).
  await expect(room(page)).toHaveAttribute("data-room", "gingerbread", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Ginger Igloo" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  const marks = [11, 9.5, 8, 9.5];
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  const looks: Intro[] = [];
  const look = async () => {
    const i = (await intro(page))!;
    looks.push(i);
    return i;
  };
  await expect.poll(step, { message: "his line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = await look();
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual(marks);
  expect(atLine.line).toBe(true);
  // His line (a placeholder until Eric's Gemini lines), in the big bubble; no table yet, the battle spot's ice whole.
  expect(lineOf(atLine)).toBe("Cold enough for you?");
  expect(iceOf(atLine)).toMatchObject({ move: null, table: false, crack: null, carriers: null, onTable: false, pieces: 0 });
  await shot("ginger-start");
  // He charges his staff and blasts; the blast flies and bursts over the battle spot; the icicle forms there and falls point first.
  await expect.poll(async () => iceOf(await look())?.move, { message: "he charges", intervals: [30] }).toBe("charge");
  await expect.poll(async () => iceOf(await look())?.blast, { message: "the blast flies", intervals: [30] }).toBe("fly");
  await expect.poll(async () => iceOf(await look())?.shard?.anim, { message: "the icicle falls", intervals: [20] }).toBe("fall");
  // It stabs in: the crack, and its round top is the table from then on (in place before any cover).
  await expect.poll(async () => iceOf(await look())?.table, { message: "the table", timeout: 5000, intervals: [30] }).toBe(true);
  expect(iceOf(await look())?.crack).not.toBeNull();
  await shot("ginger-icicle");
  // The stockroom door opens and the two carriers come out with the board ("Coming, boss!"), run round behind you both and toss it.
  await expect.poll(async () => iceOf(await look())?.door, { message: "the door opens", intervals: [30] }).toBe(true);
  await expect.poll(async () => iceOf(await look())?.crewLine, { message: "their line", intervals: [30] }).toBe(true);
  await expect.poll(async () => iceOf(await look())?.carriers?.[0]?.anim, { message: "they toss it", timeout: 5000, intervals: [30] }).toBe("toss");
  await expect.poll(async () => iceOf(await look())?.onTable, { message: "the board on the table", timeout: 5000, intervals: [30] }).toBe(true);
  // He casts; the light on the board; the pieces come in as it fades.
  await expect.poll(async () => iceOf(await look())?.move, { message: "he casts", intervals: [30] }).toBe("cast");
  await expect.poll(async () => iceOf(await look())?.light, { message: "the light", intervals: [30] }).toBe("shine");
  await expect.poll(async () => iceOf(await look())?.pieces, { message: "the pieces in", timeout: 5000, intervals: [30] }).toBe(1);
  await shot("ginger-board");
  // His brag, then his attack swung in place before the blizzard.
  await expect.poll(async () => iceOf(await look())?.move, { message: "his brag", intervals: [30] }).toBe("brag");
  await expect.poll(step, { message: "he swings", intervals: [30] }).toBe("swing");
  const swing = await look();
  expect(swing).toMatchObject({ attack: true, line: false });
  // The carriers watching from their spots, behind the table; the board and its pieces on it; the door shut. Nobody steps from here on.
  expect(iceOf(swing)).toMatchObject({ table: true, onTable: true, pieces: 1, door: false, board: null, light: null });
  expect(iceOf(swing)!.carriers!.map((c) => [c.at, c.anim])).toEqual([
    [[11.3, 7.9], "idle"],
    [[7, 7.9], "idle"],
  ]);
  // Neither of you two moved, from the line to the swing.
  for (const i of looks) expect(where(i), `at ${i.step}: where you stand`).toEqual(marks);
  // His blizzard (snowflakes and candy canes) sweeps in over the igloo, the battle loads under it, and it slides off the board.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "gingerbread");
  await page.waitForTimeout(350);
  await shot("ginger-wipe");
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});

test("challenging Big Boy in the town: his own intro (his line, his toy blocks build the table, the board plops on, the stools drop in, his attack, the lollipop swirl), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
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
  // (Eric, Nov 7: his shirt read "OIB YOB" in here. Drawn facing front (sprite-kit.ts), never mirrored: standing, and swinging.)
  const turned: string[] = [];
  const step = async () => {
    const i = await intro(page);
    const s = i?.step ?? "";
    seen.add(s);
    if (i && (i.mirrored || (i.looks !== 0 && i.looks !== null))) turned.push(`${s}${i.attack ? " (his attack)" : ""}: looks ${i.looks}, mirrored ${i.mirrored}`);
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
  expect(turned, "Big Boy never drawn mirrored in his Crib (his shirt reads BIG BOY)").toEqual([]);
  expect(atLine.looks, "drawn as his art faces: front").toBe(0);
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

test("challenging Dash in an admin's town: his own intro in his store (you both walk to where you stand; his line; four dashes: the shoe-box table, the board, the pieces with a pop, both stools; his brag; he stands through the attack's beat; the clock rush), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  type Blitz = { move: string | null; frame: number; gone: boolean; here: boolean; dust: boolean; table: string | null; board: number | null; pieces: boolean; pop: boolean; stools: string | null };
  type Look = Intro & { blitz: Blitz | null };
  // (CHALLENGE_SHOTS: each still is taken on the frame its moment shows: the page's frames are held while it's taken, then go on.)
  if (SHOTS)
    await page.addInitScript(() => {
      const w = window as unknown as { __hold: boolean; __go: () => void };
      const raf = window.requestAnimationFrame.bind(window);
      let held: FrameRequestCallback[] = [];
      w.__hold = false;
      window.requestAnimationFrame = (cb) => (w.__hold ? (held.push(cb), 0) : raf(cb));
      w.__go = () => {
        w.__hold = false;
        const h = held;
        held = [];
        for (const cb of h) raf(cb);
      };
    });
  // (Dash is in the game for admins first: his store is in an admin's town only. Nov 5, round 3: his own intro. `debug`: window.match.)
  await asAdmin(page);
  await page.goto("/town?sky=day&debug");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const { confirm, stood } = await toConfirm(page, "dash", "Dash");
  // (Every frame's look at the intro, from the page: his moments are a few frames each.)
  await page.evaluate(() => {
    const w = window as unknown as { __shopIntro?: () => unknown; __looks: unknown[] };
    w.__looks = [];
    const each = () => {
      const i = w.__shopIntro?.();
      if (i) w.__looks.push(i);
      if (w.__looks.length < 5000) requestAnimationFrame(each);
    };
    requestAnimationFrame(each);
  });
  await confirm.getByRole("button", { name: "Fight" }).click();
  await expect(room(page)).toHaveAttribute("data-room", "dash", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Dash's Kicks" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  /** Waits (in the page, each frame) until his intro shows this, then takes its still (the page's frames held while it's taken). */
  const when = async (name: string, pred: string) => {
    const hold = SHOTS ? "window.__hold = true;" : "";
    await page.waitForFunction(`(() => { const i = window.__shopIntro?.(); const b = i?.blitz; const ok = !!(i && b && (${pred})); if (ok) { ${hold} } return ok; })()`, null, { timeout: 20_000, polling: 16 });
    await shot(name);
    if (SHOTS) await page.evaluate(() => (window as unknown as { __go: () => void }).__go());
  };
  // You both walk on straight to where you stand through it all (`seated`): he at his toss's reach west of the table, you clear of
  // your stool; facing each other.
  const F = CHALLENGE_FEEL;
  const marks = [9.5 + F.clear.you, 10.5, 9.5 - introOf("dash")!.clear!, 10.5].map((v) => Math.round(v * 100) / 100);
  const where = (i: Intro) => [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
  await expect.poll(step, { message: "on their marks: his line", timeout: 15_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page)) as Look;
  expect(atLine.layout).toBe("across");
  expect(where(atLine)).toEqual(marks);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(atLine.line).toBe(true);
  expect(atLine.blitz).toMatchObject({ move: null, gone: false, here: true, table: null, board: null, pieces: false, stools: null });
  // The first bolt: off his spot in a trail of dust; the table lands; the board's toss; the pieces' pop; the stools; his brag.
  await when("dash-bolt", "b.move === 'bolt' && b.frame === 3 && i.step === 'dashTable'");
  await when("dash-drop", "i.step === 'dashBoard' && b.move === 'arrive' && b.board !== null");
  await when("dash-pop", "b.pop && b.pieces && i.step === 'dashPieces'");
  await when("dash-stools", "b.stools === 'idle' && !b.move");
  await when("dash-brag", "b.move === 'brag' && b.frame >= 4");
  // The attack's beat: no God King attack was drawn for him, so he stands.
  await expect.poll(step, { message: "the attack's beat", intervals: [50] }).toBe("swing");
  expect((await intro(page)) as Look).toMatchObject({ attack: false, line: false, table: true, stools: [[8.5, 10.5], [10.5, 10.5]], blitz: { move: null, here: true, table: "idle", board: 0, pieces: true, stools: "idle" } });
  // The clock rush sweeps in, the battle loading under it.
  await expect(storm(page)).toHaveCount(1, { timeout: 10_000 });
  await expect(storm(page)).toHaveAttribute("data-boss", "dash");
  await page.waitForTimeout(350);
  await shot("dash-wipe");
  const looks = (await page.evaluate(() => (window as unknown as { __looks: unknown[] }).__looks)) as Look[];
  const on = looks.filter((i) => i.step !== "walk");
  // His beats in order (each seen), and the things in his: the table, then the board, the pieces, the stools; nothing before its toss.
  const steps = on.map((i) => i.step).filter((s, n, all) => s !== all[n - 1]);
  expect(steps).toEqual(["face", "line", "dashTable", "dashBoard", "dashPieces", "dashStools", "brag", "swing", "done"].slice(0, steps.length));
  expect(steps.length).toBeGreaterThanOrEqual(8);
  const first = (pred: (i: Look) => boolean) => on.findIndex(pred);
  const order = [first((i) => !!i.blitz?.table), first((i) => i.blitz?.board != null), first((i) => !!i.blitz?.pieces), first((i) => !!i.blitz?.stools)];
  for (const n of order) expect(n).toBeGreaterThan(0);
  expect([...order].sort((x, y) => x - y)).toEqual(order);
  expect(on[order[0]!]!.step).toBe("dashTable");
  expect(on[order[1]!]!.step).toBe("dashBoard");
  expect(on[order[2]!]!.step).toBe("dashPieces");
  expect(on[order[3]!]!.step).toBe("dashStools");
  // He's off between each bolt and its arrive, four times; on his spot again after each.
  expect(on.map((i) => !!i.blitz?.gone).filter((g, n, all) => g && !all[n - 1]).length).toBe(4);
  // Nothing pops in at the end, and nobody steps: from the stools on, all of it stands; neither of you moves, from the line on.
  for (const i of on.slice(order[3]!)) expect([i.table, i.stools.length, !!i.blitz?.table, i.blitz?.board != null, i.blitz?.pieces], `at ${i.step}`).toEqual([true, 2, true, true, true]);
  for (const i of on) expect(where(i), `at ${i.step}: where you stand`).toEqual(marks);
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(storm(page)).toHaveCount(0, { timeout: 10_000 });
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

test("challenging Timber in an admin's town: his own intro (his line, the log carried to the middle and gnawed, the shavings' fog, his table and stumps, his attack, the sawdust sweep), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  // (Timber is in the game for admins first: his lodge is in an admin's town only.)
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
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

test("challenging Boingo in the town (Nov 6): into his Funhouse, the default intro on his carnival mat (his line, the table pops in, his attack, the flash and the wipe), the battle; Leave back where you stood", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const project = test.info().project.name;
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}-${project}.png` }));
  await page.goto("/town");
  await expect(town(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  const { confirm, stood } = await toConfirm(page, "clown", "Boingo");
  await confirm.getByRole("button", { name: "Fight" }).click();
  await expect(room(page)).toHaveAttribute("data-room", "clown", { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Boingo's Funhouse" })).toBeVisible();
  const step = async () => (await intro(page))?.step ?? "";
  await expect.poll(step, { message: "on their marks: his line", timeout: 20_000, intervals: [50] }).toBe("line");
  const atLine = (await intro(page))!;
  expect(atLine.layout).toBe("across");
  expect(atLine.line).toBe(true);
  // On his mat (columns 9-14, rows 9-14): Boingo west, you east, facing each other.
  for (const [c, r] of [atLine.you, atLine.boss]) expect(c >= 9 && c <= 14 && r >= 9 && r <= 14, `${c},${r} on the mat`).toBe(true);
  expect(atLine.boss[0]).toBeLessThan(atLine.you[0]);
  expect(atLine.facing).toEqual({ you: -1, boss: 1 });
  expect(introOf("clown")).toMatchObject({ custom: false, line: "Step right up! Honk honk!" });
  await shot("boingo-line");
  await expect.poll(async () => (await intro(page))?.table, { message: "the table pops in", intervals: [50] }).toBe(true);
  // (You both step back clear of the stools, about his table's middle: halfway between his mat's marks, column 11.5.)
  const r = atLine.you[1];
  await expect
    .poll(async () => {
      const i = (await intro(page))!;
      return [i.you[0], i.you[1], i.boss[0], i.boss[1]].map((v) => Math.round(v * 100) / 100);
    }, { message: "stepped back clear of the stools", intervals: [50] })
    .toEqual([11.5 + CHALLENGE_FEEL.clear.you, r, 11.5 - CHALLENGE_FEEL.clear.boss, r]);
  await shot("boingo-table");
  await expect.poll(step, { message: "he swings", intervals: [50] }).toBe("swing");
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(1, { timeout: 10_000 });
  await expect(page.locator("canvas.boss-wipe")).toHaveAttribute("data-boss", "clown");
  await expect(page.locator(BOARD_SEL.wrap).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("canvas.boss-wipe")).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole("button", { name: "Match options" }).click();
  const quit = page.getByRole("dialog", { name: "Match options" }).getByRole("button", { name: /^(Leave|Resign)$/ });
  const how = (await quit.textContent())!.trim();
  await quit.click();
  await page.getByRole("alertdialog").getByRole("button", { name: how, exact: true }).click();
  if (how === "Resign") await page.getByRole("button", { name: "Back to town" }).click();
  await backAt(page, stood);
  expect(errors).toEqual([]);
});
