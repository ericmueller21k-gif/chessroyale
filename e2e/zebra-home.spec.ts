import { expect, type Page } from "@playwright/test";
import { asAdmin, tapInTown, test, townReady } from "./helpers.ts";
import { ZEBRA_BACK_LINES, ZEBRA_OUTSIDE_LINES } from "../packages/app/src/town/shops/zebra-lines.ts";

/**
 * Rolling Dough, Don Dough's bakery (Nov 11; docs/areas/town-square.md, "Inside a shop"), on a phone and a computer, as an admin (Don
 * Dough is in the game for admins first): the guard out front and his Talk ("the boss is inside"); walk in from the town; the two
 * guards' `watch` follows you; a tapped guard and the counter zebra's Talk say he's in the back; through the door at the back left into
 * the back room (its own room) and out again; the chatter at the back table; Don's card, his Challenge alone. Then his challenge: the
 * beat (the crew stand, draw and aim at you with Fedora's line, following you as you move; Don waves them down, they lower, his
 * challenge line), the walk-out (four goons pick up the set kept in the back room and carry it out of the back door, Don and you following),
 * the front room's set-up (they come through the door) and the battle. ZEBRA_SHOTS=<dir>: the stills for the PR (and a frame every
 * 250 ms of the walk-out, `out-NN`).
 * Test hooks: the room's canvas (`data-room`, `data-part`, `data-you`, `data-ready`), `__shopAt("keeper" | "pass" | "square")`,
 * `__shopZebra()` (who's drawn, their animation, frame and how solid, who's talking, the beat's step, the chatter's place, you, the
 * walk-out's kept and carried things).
 */
test.use({ actionTimeout: 15_000 });
const SHOTS = process.env.ZEBRA_SHOTS;
const ZEBRA_LINES = { draw: "Hey! Who let HIM back here?!", relax: "Relax, relax. Put the bread down.", challenge: "So. You came to play, or to watch the stream?" };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
});

const room = (p: Page) => p.locator("canvas.town-shop-canvas");
type Fig = { name: string; anim: string; frame: number; at: [number, number]; flip: boolean };
type Out = { kept: string[]; carried: { item: string; at: [number, number]; a: number }[] };
type Zebra = { part: string; figs: Fig[]; say: { who: string; text: string } | null; beat: string | null; chatter: { exchange: number; line: number } | null; you: [number, number]; out: Out | null; alpha: Record<string, number> };
type Hooks = {
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townGlide?: (to: string) => void;
  __shopAt?: (k: string, sq?: readonly [number, number]) => { x: number; y: number } | null;
  __shopLook?: (k: string) => boolean;
  __shopZebra?: () => Zebra | null;
};
const zebra = (p: Page) => p.evaluate(() => (window as unknown as Hooks).__shopZebra?.() ?? null);
async function shopAt(p: Page, kind: "keeper" | "pass" | "square" | "guard-a" | "guard-b", sq?: readonly [number, number]) {
  const xy = await p.evaluate(([k, s]) => (window as unknown as Hooks).__shopAt?.(k as string, s as [number, number] | undefined) ?? null, [kind, sq] as const);
  if (!xy) return null;
  const cv = (await room(p).boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
async function homeAt(p: Page, kind: "home" | "boss" = "home") {
  const xy = await p.evaluate((k) => (window as unknown as Hooks).__townAt?.(k, "zebra") ?? null, kind);
  if (!xy) return null;
  const cv = (await p.locator("canvas.town-canvas").boundingBox())!;
  return { x: cv.x + xy.x, y: cv.y + xy.y };
}
/** The guard's `watch` frame for you at (x, y) (the art's rule, shop-zebra-nov10.md). */
const watchOf = (g: { at: [number, number]; face: number }, x: number, y: number) => {
  let dx = (x - g.at[0]) * g.face;
  if (y < g.at[1] - 1.5) dx -= 2;
  return Math.max(0, Math.min(4, 2 + Math.round(dx / 1.5)));
};
/** Taps a square until you stand on it (each tap once it's on screen). */
async function walkTo(p: Page, sq: readonly [number, number]) {
  await expect(async () => {
    const at = await shopAt(p, "square", sq);
    expect(at, `${sq} on screen`).not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(room(p)).toHaveAttribute("data-you", sq.join(","), { timeout: 6000 });
  }).toPass({ timeout: 30_000 });
}
/** Through the door between the rooms: a tap on it walks you there, its card's button takes you through. */
async function goThrough(p: Page, button: "Go in" | "Go out front", part: "back" | null) {
  const card = p.getByRole("dialog", { name: "Door", exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (!(await shopAt(p, "pass"))) {
      await p.evaluate(() => (window as unknown as Hooks).__shopLook?.("pass"));
      await p.waitForTimeout(300);
    }
    const at = await shopAt(p, "pass");
    expect(at, "the door on screen").not.toBeNull();
    await p.mouse.click(at!.x, at!.y);
    await expect(card).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
  await expect(card.getByRole("button")).toHaveText([button]);
  await card.getByRole("button", { name: button }).click();
  if (part) await expect(room(p)).toHaveAttribute("data-part", part, { timeout: 20_000 });
  else await expect(room(p)).not.toHaveAttribute("data-part", /./, { timeout: 20_000 });
  await expect(room(p)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}
const shot = async (p: Page, name: string) => SHOTS && (await p.screenshot({ path: `${SHOTS}/${name}-${test.info().project.name}.png` }));

test("Rolling Dough: in, the guards watch you, the counter zebra's line, through to the back room, the chatter, Don's Challenge, and back", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await townReady(page);
  // The bakery stands in an admin's town; its card is its name and Go in.
  await page.evaluate(() => (window as unknown as Hooks).__townGlide?.("zebra"));
  await expect.poll(() => homeAt(page), { message: "the bakery comes into view" }).not.toBeNull();
  await page.waitForTimeout(1500);
  await shot(page, "outside");
  if (SHOTS) {
    // (From above: the town's map, the bakery on South Street, clear of its neighbors.)
    const small = page.getByRole("button", { name: "Open the map" });
    if (await small.count()) {
      await small.click();
      await expect(page.getByRole("dialog", { name: "Map of the town" })).toBeVisible();
      await page.waitForTimeout(600);
      await shot(page, "map");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Map of the town" })).toHaveCount(0);
    }
  }
  // The guard out front (Eric, Nov 11), where the other homes' bosses stand: his card, Talk, "the boss is inside" (a line at random).
  const guard = page.getByRole("dialog", { name: "Bakery guard", exact: true });
  // (The tap on the frame its point came from: `tapInTown`, Nov 14.)
  await tapInTown(page, "boss", "zebra", guard);
  await expect(guard.getByRole("button")).toHaveText(["Talk"]);
  const box0 = (await guard.boundingBox())!;
  await guard.getByRole("button", { name: "Talk" }).click();
  await expect.poll(async () => ZEBRA_OUTSIDE_LINES.includes((await guard.locator(".town-card-line").textContent()) ?? ""), { message: "he says the boss is inside" }).toBe(true);
  // (His line's row was there before he spoke: the card keeps its size.)
  const box1 = (await guard.boundingBox())!;
  expect([box1.width, box1.height].map(Math.round)).toEqual([box0.width, box0.height].map(Math.round));
  await page.waitForTimeout(400);
  await shot(page, "guard-out-front");
  await page.keyboard.press("Escape");
  await expect(guard).toBeHidden();
  const card = page.getByRole("dialog", { name: "Rolling Dough", exact: true });
  await tapInTown(page, "home", "zebra", card);
  await expect(card.getByRole("button")).toHaveText(["Go in"]);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await expect(room(page)).toHaveAttribute("data-room", "zebra");
  await expect(page.getByRole("heading", { name: "Rolling Dough" })).toBeVisible();
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "day");
  // The area banner (Eric's mockup, Nov 11): walked in through the door, "DON DOUGH'S" over "ROLLING DOUGH" a third down the room,
  // taps passing through it to the room (the topmost thing under its middle is the room's canvas), gone after AREA_BANNER's 2.8 s.
  const banner = page.locator(".area-banner");
  await expect(banner.locator(".area-banner-sub")).toHaveText("DON DOUGH'S");
  await expect(banner.locator(".area-banner-title")).toHaveText("ROLLING DOUGH");
  const band = (await banner.locator(".area-banner-band").boundingBox())!;
  const view = (await room(page).boundingBox())!;
  expect(band.x).toBeGreaterThanOrEqual(view.x - 1);
  expect(band.x + band.width).toBeLessThanOrEqual(view.x + view.width + 1);
  expect(band.y + band.height / 2).toBeGreaterThan(view.y + view.height * 0.2);
  expect(band.y + band.height / 2).toBeLessThan(view.y + view.height * 0.45);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.className, [band.x + band.width / 2, band.y + band.height / 2])).toContain("town-shop-canvas");
  await expect(banner).toHaveCount(0, { timeout: 4000 });

  // The guards by the door: each on his `watch` frame for where you stand, following you as you walk in past them.
  const G = [
    { name: "guard-a", at: [8, 17.2] as [number, number], face: 1 },
    { name: "guard-b", at: [11, 17.2] as [number, number], face: -1 },
  ];
  const guardsWatch = async () => {
    const z = (await zebra(page))!;
    return G.map((g) => {
      const f = z.figs.find((x) => x.name === g.name)!;
      return f.anim === "watch" && f.frame === watchOf(g, z.you[0], z.you[1]) ? f.frame : `${f.anim} ${f.frame} (want ${watchOf(g, z.you[0], z.you[1])})`;
    });
  };
  await page.waitForTimeout(600);
  await shot(page, "front-door");
  const seen = new Set<string>();
  const first = await guardsWatch();
  first.forEach((f) => expect(typeof f, String(f)).toBe("number"));
  seen.add(first.join(","));
  await walkTo(page, [10, 13]);
  await expect.poll(async () => (await guardsWatch()).every((f) => typeof f === "number"), { message: "they watch you there" }).toBe(true);
  seen.add((await guardsWatch()).join(","));
  expect(seen.size, "their look changed as you walked past them").toBeGreaterThan(1);
  await shot(page, "front");

  // A guard you tap tells you he's in the back (Eric, Nov 11), in a bubble; you stay where you are.
  // (Where he's drawn is read and tapped in one go, again until he speaks. Tapped once the camera rests on you, where a computer shows
  // only his top half: before, his tap point was his middle, off screen there, and the check passed only while the camera still moved.)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shopCam?: () => { focus: number[] } | null }).__shopCam?.()?.focus.join(",")), { message: "the camera rests on you" }).toBe("10,13");
  await expect(async () => {
    const gb = await shopAt(page, "guard-b");
    expect(gb, "the guard is drawn").not.toBeNull();
    await page.mouse.click(gb!.x, gb!.y);
    await expect.poll(async () => (await zebra(page))?.say?.who, { message: "the guard says he's in the back", timeout: 3000 }).toBe("guard-b");
  }).toPass({ timeout: 20_000 });
  expect(ZEBRA_BACK_LINES).toContain((await zebra(page))!.say!.text);
  await expect(room(page)).toHaveAttribute("data-you", "10,13");
  await shot(page, "guard-line");

  // The counter zebra: Talk has him say he's in the back too (no crate yet).
  await expect.poll(() => shopAt(page, "keeper"), { message: "the counter zebra is drawn" }).not.toBeNull();
  const k = (await shopAt(page, "keeper"))!;
  await page.mouse.click(k.x, k.y);
  const keeper = page.getByRole("dialog", { name: "Shopkeeper", exact: true });
  await expect(keeper).toBeVisible({ timeout: 15_000 });
  await keeper.getByRole("button", { name: "Talk" }).click();
  await expect.poll(async () => (await zebra(page))?.say, { message: "he says a line" }).toMatchObject({ who: "keeper" });
  expect(ZEBRA_BACK_LINES).toContain((await zebra(page))!.say!.text);
  await page.keyboard.press("Escape");

  // Through the door at the back left: the back room, its own room (dim: the night tone).
  await goThrough(page, "Go in", "back");
  await expect(page.locator(".town-chat")).toHaveAttribute("data-tone", "night");
  // (Through the door between rooms: the banner again, the back room's.)
  await expect(page.locator(".area-banner .area-banner-sub")).toHaveText("BACK ROOM");
  await expect(room(page)).toHaveAttribute("data-you", "4,9");
  const back = (await zebra(page))!;
  expect(back.figs.map((f) => f.name).sort()).toEqual(["crew-c", "crew-d", "crew-e", "don"]);
  // The chatter: a line in a bubble within a few seconds, the speaker on his talking (or arguing, scoffing) loop, the rest listening.
  await expect.poll(async () => (await zebra(page))?.say?.who ?? null, { message: "someone at the table talks", timeout: 8000 }).not.toBeNull();
  const z1 = (await zebra(page))!;
  const speaker = z1.figs.find((f) => f.name === z1.say!.who)!;
  expect(["sitTalk", "sitArgue", "sitScoff"]).toContain(speaker.anim);
  for (const f of z1.figs.filter((x) => x.name !== z1.say!.who)) expect(["sitListen", "sitPuff"]).toContain(f.anim);
  await shot(page, "back");

  // Walking round to the table's end (Eric, Nov 11, his iPhone: the table and its board ghosted there, dark patches on the floor):
  // every frame, walking and at rest, the floor's tiles lie in the floor (the pieces standing: the walls, the furniture), and nothing but
  // the door and the near wall goes see-through over you. (Before: 196 tiles stood up too, the table and rug tiles see-through.)
  type Still = { ups: number; ghosts: string[] };
  await page.evaluate(() => {
    const w = window as unknown as { __ups: Still[]; __upsOn: boolean; __shopStill?: () => Still | null };
    w.__ups = [];
    w.__upsOn = true;
    const tick = () => {
      const s = w.__shopStill?.();
      if (s) w.__ups.push({ ups: s.ups, ghosts: s.ghosts });
      if (w.__upsOn) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await walkTo(page, [8, 6]);
  await page.waitForTimeout(600);
  const ups = await page.evaluate(() => {
    const w = window as unknown as { __ups: Still[]; __upsOn: boolean };
    w.__upsOn = false;
    return w.__ups;
  });
  expect(ups.length, "frames sampled").toBeGreaterThan(30);
  expect(Math.max(...ups.map((u) => u.ups)), "pieces standing in a frame").toBeLessThan(60);
  expect([...new Set(ups.flatMap((u) => u.ghosts))].filter((n) => !["bdoor", "bhem", "bhem-post"].includes(n)), "see-through over you").toEqual([]);
  await shot(page, "back-table-end");

  // His card at the table's foot: his Challenge alone (Eric, Nov 11: "we don't need the talk button").
  await walkTo(page, [8, 7]);
  const don = page.getByRole("dialog", { name: "Don Dough", exact: true });
  await expect(don).toBeVisible({ timeout: 15_000 });
  await expect(don.getByRole("button")).toHaveText(["Challenge"]);
  await expect(don.getByRole("button", { name: "Challenge" })).toBeEnabled();
  await expect(don).not.toContainText("Talk");
  await shot(page, "don-card");
  await page.keyboard.press("Escape");

  // Back out front: you arrive just inside the back door.
  await goThrough(page, "Go out front", null);
  await expect(room(page)).toHaveAttribute("data-you", "4,7");
  expect(errors).toEqual([]);
});

/** The crew's aim at you at (x, y): the scene's rule (zebra-scene.ts aimAt; SHOP_FEEL.zebra.beat), its angle's index and side. */
const AIM_ANGLES = [0, 10, 20, 30, 40];
const aimOf = (at: [number, number], x: number, y: number) => {
  const dx = x - at[0];
  const deg = (Math.atan2((y - at[1]) * 0.8 + 0.7, Math.max(0.25, Math.abs(dx))) * 180) / Math.PI;
  let i = 0;
  for (let k = 1; k < AIM_ANGLES.length; k++) if (Math.abs(AIM_ANGLES[k]! - deg) < Math.abs(AIM_ANGLES[i]! - deg)) i = k;
  return { i, flip: dx < 0 };
};
const CREW: Record<string, [number, number]> = { "crew-c": [5.15, 5.06], "crew-d": [6.15, 5.06], "crew-e": [7.15, 5.06] };

test("Rolling Dough: Challenge plays the beat (the crew aim at you, following you), the walk-out from the back room, the set-up in the front room, and the battle against Don Dough", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // (The music's log, and its files' fetches: Don's theme plays from walking in, carried through his splash into the battle.)
  await page.addInitScript(() => void ((window as unknown as { __soundLog: string[] }).__soundLog = []));
  const themeGets: string[] = [];
  page.on("request", (r) => void (new URL(r.url()).pathname.startsWith("/music/zebra") && themeGets.push(new URL(r.url()).pathname)));
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await townReady(page);
  await page.evaluate(() => (window as unknown as Hooks).__townGlide?.("zebra"));
  await expect.poll(() => homeAt(page), { message: "the bakery comes into view" }).not.toBeNull();
  const card = page.getByRole("dialog", { name: "Rolling Dough", exact: true });
  await tapInTown(page, "home", "zebra", card);
  await card.getByRole("button", { name: "Go in" }).click();
  await expect(room(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  await goThrough(page, "Go in", "back");
  await walkTo(page, [8, 7]);
  const don = page.getByRole("dialog", { name: "Don Dough", exact: true });
  await expect(don).toBeVisible({ timeout: 15_000 });
  // (Every frame from here, in the page: the back room's walk-out (the set kept, what's carried, who fades through the door), the
  // front room's goons (where each carrier is first drawn), Beanie's line, and which wipe covers the screen.)
  await page.evaluate(() => {
    type Z = { part: string; beat: string | null; say: { text: string } | null; figs: { name: string; anim: string; at: [number, number] }[]; out: { kept: string[]; carried: { item: string; a: number }[] } | null; alpha: Record<string, number> };
    const w = window as unknown as {
      __zb: { crew: boolean; storm: boolean; wipe: boolean; outOn: boolean; kept: number[]; carried: string[]; faded: string[]; frontFirst: Record<string, number>; steps: string[]; lines: string[] };
      __shopIntro?: () => { crewLine?: boolean } | null;
      __shopZebra?: () => Z | null;
    };
    w.__zb = { crew: false, storm: false, wipe: false, outOn: false, kept: [], carried: [], faded: [], frontFirst: {}, steps: [], lines: [] };
    const look = () => {
      const z = w.__shopZebra?.();
      const b = w.__zb;
      // (The beat's steps and lines, from its start: until its first frame the hook can still report the chatter line that was up.)
      if (z?.part === "back" && z.beat && b.steps[b.steps.length - 1] !== z.beat) b.steps.push(z.beat);
      if (z?.part === "back" && z.beat && z.say && b.lines[b.lines.length - 1] !== z.say.text) b.lines.push(z.say.text);
      if (z?.part === "back" && z.out) {
        b.outOn = true;
        if (b.kept[b.kept.length - 1] !== z.out.kept.length) b.kept.push(z.out.kept.length);
        for (const q of z.out.carried) if (!b.carried.includes(q.item)) b.carried.push(q.item);
        for (const [n, a] of Object.entries(z.alpha)) if (a < 1 && !b.faded.includes(n)) b.faded.push(n);
      }
      if (z?.part === "front") {
        for (const f of z.figs) if (f.anim === "carry" && !(f.name in b.frontFirst)) b.frontFirst[f.name] = f.at[1];
      }
      if (w.__shopIntro?.()?.crewLine) b.crew = true;
      if (document.querySelector(".boss-storm")) b.storm = true;
      if (document.querySelector(".boss-wipe")) b.wipe = true;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  // His Challenge: his card steps aside and the beat plays (no other button).
  await expect(don.getByRole("button")).toHaveText(["Challenge"]);
  await don.getByRole("button", { name: "Challenge" }).click();
  await expect(don).toBeHidden();
  // The aim follows you: at the table's foot (east of them) each faces east, his roll at your angle; walk west of them, and each turns
  // west, his roll at your new angle.
  const aiming = async (want: "east" | "west") => {
    const z = (await zebra(page))!;
    const out: string[] = [];
    for (const [n, at] of Object.entries(CREW)) {
      const f = z.figs.find((x) => x.name === n)!;
      const a = aimOf(at, z.you[0], z.you[1]);
      const ok = f.anim === "aimAt" && Math.floor(f.frame / 8) === a.i && f.flip === a.flip && f.flip === (want === "west");
      out.push(ok ? "ok" : `${n} ${f.anim} ${f.frame} ${f.flip} (want ${a.i * 8}+ ${a.flip})`);
    }
    return out.join(", ");
  };
  await expect.poll(() => aiming("east"), { message: "they aim at you at the table's foot", timeout: 8000, intervals: [100] }).toBe("ok, ok, ok");
  await shot(page, "aim-east");
  await walkTo(page, [4, 8]);
  await expect.poll(() => aiming("west"), { message: "they turn and aim at you by the door", timeout: 3000, intervals: [100] }).toBe("ok, ok, ok");
  await shot(page, "aim-west");
  // The rest of the beat: Don's "Relax", they lower, his challenge line; then the walk-out (you're walked out of the door last).
  await expect.poll(async () => (await zebra(page))?.beat, { message: "the beat plays through", timeout: 20_000 }).toBe("done");
  await expect.poll(async () => (await zebra(page))?.out?.kept.length ?? -1, { message: "the walk-out starts" }).toBeGreaterThanOrEqual(0);
  // (The stills, and for the GIF a frame every 250 ms, until the room changes.)
  for (let k = 0; SHOTS && k < 40; k++) {
    if ((await room(page).getAttribute("data-part")) !== "back") break;
    await page.screenshot({ path: `${SHOTS}/out-${String(k).padStart(2, "0")}-${test.info().project.name}.png` });
    await page.waitForTimeout(150);
  }
  // Through the door: the front room, the challenge (its set-up, his intro), then the battle.
  await expect(room(page)).not.toHaveAttribute("data-part", /./, { timeout: 20_000 });
  await page.waitForTimeout(1200);
  await shot(page, "front-setup");
  // (Arriving by his challenge: no area banner.)
  await expect(page.locator(".area-banner"), "no banner arriving by the challenge").toHaveCount(0);
  await expect(page.getByRole("status", { name: /^Don Dough, threat/ }), "the battle against Don Dough").toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("group", { name: "Don Dough's oven timers" })).toBeAttached();
  await shot(page, "challenge-battle");
  // His theme (Eric, Nov 11): started as you walked in, carried through his splash into the battle: no restart, fetched once.
  const musicLog = await page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog.filter((l) => l.startsWith("music:")));
  expect(musicLog.filter((l) => !l.startsWith("music:level") && !l.startsWith("music:load"))).toEqual(["music:room:zebra", "music:splash:zebra:room", "music:carry:zebra"]);
  // (Each piece twice: the town's loading fetched it (Nov 12), then its room's decode read it back from the cache.)
  expect(themeGets.sort()).toEqual(["/music/zebra-intro.mp3", "/music/zebra-intro.mp3", "/music/zebra-loop.mp3", "/music/zebra-loop.mp3"]);
  const zb = await page.evaluate(() => (window as unknown as { __zb: { crew: boolean; storm: boolean; wipe: boolean; outOn: boolean; kept: number[]; carried: string[]; faded: string[]; frontFirst: Record<string, number>; steps: string[]; lines: string[] } }).__zb);
  // The beat, in order: they stand, draw and aim with Fedora's line, Don's "Relax", they lower, his challenge line.
  expect(zb.steps).toEqual(["stand", "draw", "aim", "relax", "lower", "challenge", "done"]);
  expect(zb.lines).toEqual([ZEBRA_LINES.draw, ZEBRA_LINES.relax, ZEBRA_LINES.challenge]);
  // The walk-out: all four kept in the back room, picked up one by one, each carried, every goon and Don fading out through the door.
  expect(zb.outOn).toBe(true);
  expect(zb.kept[0]).toBe(4);
  expect(zb.kept[zb.kept.length - 1]).toBe(0);
  expect([...zb.kept].sort((a, b) => b - a)).toEqual(zb.kept);
  expect([...zb.carried].sort()).toEqual(["board", "bossChair", "table", "youChair"]);
  expect([...zb.faded].sort()).toEqual(["crew-c", "crew-d", "crew-e", "don", "guard-a"]);
  // The front room: each carrier first drawn behind the back door (row 6), coming through it: nobody pops in.
  expect(Object.keys(zb.frontFirst).sort()).toEqual(["crew-c", "crew-d", "crew-e", "guard-a"]);
  for (const [n, r] of Object.entries(zb.frontFirst)) expect(r, n).toBeLessThan(6);
  expect({ crew: zb.crew, storm: zb.storm, wipe: zb.wipe }, "Beanie's line, then his bread splash as the wipe").toEqual({ crew: true, storm: true, wipe: false });
  expect(errors).toEqual([]);
});
