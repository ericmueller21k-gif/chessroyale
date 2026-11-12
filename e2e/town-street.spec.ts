import { mkdirSync, readFileSync, statSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { asAdmin, test } from "./helpers.ts";

/**
 * The street town, round 2: the layout (Nov 5; docs/decisions/2026-11-05-street-town-layout.md), in an admin's town only
 * (admin-town.ts STREET_TOWN) until round 3. On a phone and a computer: it opens zoomed in, at the start (22, 11), the camera facing
 * north; a tap on Ginger Igloo walks you down Fountain Street to its door square and its card opens; the up arrow into Smudgy's Art
 * Gallery from its door opens his card; a park table works. A player's town is today's (e2e/town.spec.ts and the rest, unchanged).
 * `STILLS=docs/street-town` also writes the stills: each street, the park and a home's card.
 * Round 3 (Nov 5): the buildings are boxes and the camera turns: the turn walked on both renderers (a tap and an arrow mid-turn and
 * after, every figure on screen at rest). Round 4 (the rows, the chase camera, the plan wrapping east-west only, its rows 6 up): the
 * squares moved with the plan; the turn is the chase camera's (behind you, the way you walk); round 2's and 3's stills tests went with
 * their plans (round 4's are in e2e/town-rows.spec.ts). Round 5 (one fixed view): the chase camera's turn test went with it
 * (e2e/town-fixed.spec.ts has the fixed view, the strips and the look round). Nov 6: on WebGL only; a context lost for good opens the
 * page again in today's town.
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
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
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
  await page.evaluate((h) => (window as unknown as Hooks).__townGlide?.(h), id);
  // (Round 4: let the glide settle before the first tap, so it lands on the home, not on someone passing. On WebGL, software in the
  // tests, frames are slower: wait for the camera to stop rather than a set time.)
  await settled(page);
  await expect(async () => {
    if (await card.isVisible()) return;
    const xy = await page.evaluate((h) => (window as unknown as Hooks).__townAt?.("home", h) ?? null, id);
    // (Not drawn from where the camera is now (a tap that missed walked you off): look at it again, and try once more.)
    if (!xy) {
      await page.evaluate((h) => (window as unknown as Hooks).__townGlide?.(h), id);
      await settled(page);
    }
    expect(xy, "drawn").not.toBeNull();
    const cv = (await canvas(page).boundingBox())!;
    await page.mouse.click(cv.x + xy!.x, cv.y + xy!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
  return card;
}

test("an admin's street town opens at its default zoom step, at the start (22, 25; the north edge round: 8 rows on), the camera facing north; a player's opens as today (zoomed out, at (22, 17))", async ({ page }) => {
  const errors = watchErrors(page);
  // A player's town: today's.
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
  expect(await you(page)).toEqual([22, 17]);
  await expect(page.getByRole("button", { name: "Zoom out" })).toHaveAttribute("aria-pressed", "true");
  // An admin's: the street town.
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

test("a park table: a tap on the one ahead on your left walks you to a free stool and you sit; its card shows 'Casual' and 'Ranked' greyed; a tap elsewhere closes it and you stand", async ({ page }) => {
  const errors = watchErrors(page);
  await openStreet(page);
  await expect(canvas(page)).toHaveAttribute("data-sit", "0");
  // The park's fourth table, (19, 31), ahead on your left past the fountain: its stools (18, 31) and (20, 31). (The one on your row,
  // (19, 26), has a home's edge chip over it on a phone.)
  const at = await page.evaluate(() => (window as unknown as Hooks).__townAt?.("table", 3) ?? null);
  expect(at, "the table is drawn at the start").not.toBeNull();
  const cv = (await canvas(page).boundingBox())!;
  await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
  const card = page.getByRole("dialog", { name: "Chess table", exact: true });
  await expect(card).toBeVisible();
  for (const name of ["Casual", "Ranked"]) await expect(card.getByRole("button", { name, exact: true })).toBeDisabled();
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

test("the street town's WebGL context lost: nothing drawn until it's back, then it draws again; lost twice within a minute, the page opens again in today's town (Canvas 2D)", async ({ page }) => {
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
  await lose(true);
  // Back: drawing again with WebGL (its textures made again), the world not blank, still the street town.
  await expect.poll(async () => (await paint())?.lost, { message: "back" }).toBe(false);
  expect((await paint())!.backend).toBe("webgl");
  expect(await colors(), "the world drawn again with WebGL").toBeGreaterThan(40);
  expect(await you(page)).toEqual([22, 25]);
  // Lost again within the minute: the page opens again (`?street=off`) in today's town, drawn with Canvas 2D, where a player's opens.
  await lose(false);
  await page.waitForURL(/[?&]street=off/, { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-backend", "2d");
  expect(await you(page), "today's town").toEqual([22, 17]);
  expect(await colors(), "the world drawn with Canvas 2D").toBeGreaterThan(40);
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
  await expect(panel.locator(".tfr-parts tbody tr")).toHaveCount(20);
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

test("the town's loading screen (Eric, Nov 11: \"loads it all in at once and then it stays there\"): its bar fills and goes, then walking and a full turn paint nothing new and start no atlas page again", { tag: "@phone-only" }, async ({ page }) => {
  type R = { __townReport: () => { state: string; summary: { frames: number; bakes: number; resets: number } | null } | null; __townHeading: (d: number | null) => void; __townWalk: (s: readonly [number, number]) => boolean; __townPaint: () => { loading: boolean; resets: number; atlas: { kept: number; keptPages: number; unkept: number } } };
  const errors = watchErrors(page);
  const bar = page.locator(".town-loading").getByRole("progressbar", { name: "Building the town" });
  // The bar's share as it shows (sampled every frame until it goes): it only goes up.
  await page.addInitScript(() => {
    const seen: number[] = ((window as unknown as { __bar: number[] }).__bar = []);
    const f = () => {
      const v = document.querySelector(".town-loading [role=progressbar]")?.getAttribute("aria-valuenow");
      if (v !== null && v !== undefined) seen.push(Number(v));
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await asAdmin(page);
  await page.goto("/town?sky=day&report");
  await expect(bar).toBeVisible({ timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect(page.locator(".town-loading")).toHaveCount(0);
  const shares = await page.evaluate(() => (window as unknown as { __bar: number[] }).__bar);
  expect(shares.length, "the bar showed").toBeGreaterThan(0);
  expect(shares.every((v, i) => i === 0 || v >= shares[i - 1]!), `the bar only goes up: ${shares.join(",")}`).toBe(true);
  const paint = await page.evaluate(() => (window as unknown as R).__townPaint());
  expect(paint.loading).toBe(false);
  expect(paint.atlas.kept, "the town's pictures kept").toBeGreaterThan(1000);
  expect(paint.atlas.unkept, "all of them").toBe(0);
  // Walking, then a full turn on the spot (360° in about 2 s): nothing painted, no page started again.
  await page.evaluate(() => (window as unknown as R).__townWalk([4, 25]));
  await page.waitForTimeout(1500);
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
  await page.locator(".tfr-pill").getByRole("button", { name: "Done" }).click();
  await page.evaluate(() => ((window as unknown as { __spin: boolean }).__spin = false));
  const s = (await page.evaluate(() => (window as unknown as R).__townReport()))!.summary!;
  expect(s.frames, "frames recorded").toBeGreaterThan(10);
  expect(s.bakes, "pictures painted after the loading screen").toBe(0);
  expect(s.resets, "atlas pages started again").toBe(0);
  expect((await page.evaluate(() => (window as unknown as R).__townPaint())).resets).toBe(0);
  expect(errors).toEqual([]);
});

test("the town's loading fetches every boss theme once and decodes none (Eric, Nov 12: \"loading music in the loading bar\"); Music off fetches none", { tag: "@phone-only" }, async ({ page }) => {
  const dir = "packages/app/public/music";
  const themes = JSON.parse(readFileSync(`${dir}/themes.json`, "utf8")) as { themes: Record<string, { intro: string | null; loop: string }> };
  const names = Object.values(themes.themes).flatMap((t) => (t.intro ? [t.intro, t.loop] : [t.loop]));
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
  await asAdmin(page);
  await page.goto("/town?sky=day");
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await expect.poll(() => gets.length, { timeout: 15_000 }).toBe(names.length);
  await page.waitForTimeout(1000);
  expect(gets.sort(), "each theme's pieces, once").toEqual(names.map((n) => `/music/${n}.mp3`).sort());
  const decoded = await page.evaluate(() => (window as unknown as { __decoded: number[] }).__decoded);
  expect(decoded.filter((b) => sizes.includes(b)), "no theme decoded").toEqual([]);
  const log = await page.evaluate(() => (window as unknown as { __soundLog: string[] }).__soundLog);
  expect(log.filter((l) => l.startsWith("music:load")), "no theme loaded to play").toEqual([]);
  // Music off (Settings → Sound): the town's loading fetches none.
  await page.evaluate(() => localStorage.setItem("brc.music", "0"));
  gets.length = 0;
  await page.reload();
  await expect(canvas(page)).toHaveAttribute("data-ready", "1", { timeout: 40_000 });
  await page.waitForTimeout(1500);
  expect(gets, "Music off: nothing fetched").toEqual([]);
});
