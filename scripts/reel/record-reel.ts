/**
 * Records the landing page's demo reel (Eric, Nov 11; docs/decisions/2026-11-11-landing-reel.md), scene by scene, from the real
 * game on a phone screen (390 × 844 at 2.5x: the reel is 860 px wide, a phone's full width at 2x) under the e2e's local server. Each scene's frames go to
 * reports/demo/<scene>/frames/ (sharp screenshots, back to back), with an ffconcat list (frames.txt) and a timeline of its moments
 * (marks.json, seconds from its first
 * frame), which scripts/reel/encode-trailer.py cuts and joins. The Hidden Boss (scene 4) is pixel art drawn here, not a game screen; the
 * captions are drawn in the game's pixel font as see-through pictures (reports/demo/captions/).
 *   npx playwright test -c scripts/reel/reel.config.ts [-g crowd|town|ranked|ranks|hidden|captions|landing; --project reel (the phone) or wide (a computer)]
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
// (The e2e's own `test`: every context starts with the first-time walkthrough and the quests overlay marked seen.)
import { Chess } from "chess.js";
import { BOARD_SEL, giveItems, test, wearItem } from "../../e2e/helpers.ts";
import { REEL_CAPTIONS, drawHiddenBoss } from "./hidden-boss.ts";
import { drawRankShuffle, shuffleSteps } from "./rank-shuffle.ts";

const OUT = "reports/demo";
/** The computer's reel (the `wide` project: 1920 × 1080, the game's computer layouts) or the phone's. Its scenes go to `<scene>-wide`. */
const isWide = () => test.info().project.name === "wide";
const sfx = () => (isWide() ? "-wide" : "");

/** Frames of `page` from now until `stop()`, written as JPEGs with their times; `mark(name)` notes a moment. */
async function recorder(page: Page, scene: string) {
  const dir = `${OUT}/${scene}${sfx()}`;
  let dropped = false;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(`${dir}/frames`, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames: { file: string; t: number }[] = [];
  const marks: Record<string, number> = {};
  // Back-to-back sharp screenshots (at the page's pixel ratio) of the part the reel shows (the top 700 CSS px), each stamped with its time. (Chrome's
  // screencast would give every painted frame, but only at 1x in a headless browser.)
  const scale = await page.evaluate(() => devicePixelRatio);
  // The part the reel shows: a phone's top 700 CSS px, or a computer's whole window.
  const area = isWide() ? page.viewportSize()! : { width: 390, height: 700 };
  let capturing = true;
  const loop = (async () => {
    while (capturing) {
      const t = Date.now() / 1000;
      const shot = await cdp
        .send("Page.captureScreenshot", {
          format: "jpeg",
          quality: Number(process.env.REEL_JPEG ?? 90),
          optimizeForSpeed: true,
          clip: { x: 0, y: 0, ...area, scale },
        })
        .catch(() => null);
      if (!shot) continue;
      const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
      writeFileSync(`${dir}/frames/${file}`, Buffer.from(shot.data, "base64"));
      frames.push({ file, t });
    }
  })();
  const t0 = Date.now() / 1000;
  return {
    /** Stops and throws its frames away (the other player's view). */
    async drop() {
      dropped = true;
      capturing = false;
      await loop;
      rmSync(dir, { recursive: true, force: true });
    },
    mark(name: string) {
      marks[name] = Date.now() / 1000 - t0;
      console.log(`${scene}: ${name} at ${marks[name]!.toFixed(2)} s`);
    },
    async stop(rename?: string) {
      if (dropped) return;
      await page.waitForTimeout(300);
      capturing = false;
      await loop;
      // (Marks are in wall time since the start; the frames' own times start at the first frame: shift the marks onto those.)
      const first = frames[0]?.t ?? t0;
      for (const k of Object.keys(marks))
        marks[k] = Math.max(0, marks[k]! - (first - t0));
      const lines = ["ffconcat version 1.0"];
      frames.forEach((f, i) =>
        lines.push(
          `file frames/${f.file}`,
          `duration ${((frames[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`,
        ),
      );
      writeFileSync(`${dir}/frames.txt`, lines.join("\n") + "\n");
      writeFileSync(`${dir}/marks.json`, JSON.stringify(marks, null, 2));
      if (rename) {
        rmSync(`${OUT}/${rename}${sfx()}`, { recursive: true, force: true });
        renameSync(dir, `${OUT}/${rename}${sfx()}`);
      }
      console.log(
        `${scene}: ${frames.length} frames over ${((frames.at(-1)?.t ?? first) - first).toFixed(1)} s`,
      );
    },
  };
}

/** The page's name (as e2e/helpers.ts `named`), sound off. */
async function setUp(page: Page, name: string) {
  await page.addInitScript((n) => {
    try {
      localStorage.setItem("brc.name", n);
      localStorage.setItem("brc.sound", "0");
    } catch {
      // No storage.
    }
  }, name);
}

/** Your profile says you're an admin (e2e/helpers.ts `asAdmin`): for `?rank=` on the ranked stage. */
async function asAdmin(page: Page) {
  await page.route("**/api/me*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    try {
      const res = await route.fetch();
      const body = await res.json().catch(() => null);
      await route.fulfill({
        response: res,
        json: body ? { ...body, admin: true } : body,
      });
    } catch {
      // The page is gone.
    }
  });
}

test("crowd", async ({ page }) => {
  test.setTimeout(150_000);
  // Scene 1: a solo 50 v 50 (as the old demo): you pick the engine's move after a moment, like a person.
  await setUp(page, "Player");
  await page.goto(`/?debug&mode=crowd&augments=0&clock=10&nolanding`);
  // Home: 50 v 50, Bots, PLAY, the Bot level box's OK (as e2e/helpers.ts soloFromHome).
  const row = page.getByRole("radiogroup", { name: "RANKED" });
  await row.getByRole("radio", { name: /^50 v 50/ }).click();
  await page
    .getByRole("radiogroup", { name: "Matchmaking" })
    .getByRole("radio", { name: /^Bots/ })
    .click();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  const box = page.getByRole("dialog", { name: "Bot level" });
  const ok = box.getByRole("button", { name: "OK", exact: true });
  if (await ok.isDisabled())
    await box.getByRole("radio", { name: /^Medium/ }).click();
  const rec = await recorder(page, "crowd");
  await ok.click();
  rec.mark("start");
  const stopAt = Date.now() + 40_000;
  let lastBoard = "";
  while (Date.now() < stopAt) {
    const state = await page.evaluate(() => {
      const m = (window as any).match;
      return m
        ? {
            kind: m.phase.kind,
            key: m.phase.board ? `${m.phase.board.ply}` : "",
          }
        : { kind: "none", key: "" };
    });
    if (state.kind === "results") break;
    if (state.kind === "play" && state.key !== lastBoard) {
      lastBoard = state.key;
      rec.mark(`ply${state.key}`);
      await page.waitForTimeout(1800 + Math.random() * 1200);
      await page.evaluate(async () => {
        const m = (window as any).match;
        if (m.phase.kind !== "play") return;
        const top = await Promise.race([
          m.runner.topMovesFor(m.phase.board.fen),
          new Promise((r) => setTimeout(() => r(null), 4000)),
        ]);
        const fallback = [...(m.runner.planned?.values() ?? [])][0];
        if (m.phase.kind === "play")
          m.submit(
            top
              ? ((top as any)[Math.random() < 0.6 ? 0 : 1]?.move ??
                  (top as any)[0].move)
              : fallback,
          );
      });
      rec.mark(`picked${state.key}`);
    }
    await page.waitForTimeout(150);
  }
  await rec.stop();
});

type TownHooks = {
  __townWalk?: (sq: readonly [number, number]) => boolean;
  __townYou?: () => { c: number; r: number; moving: boolean } | null;
  __townAt?: (k: string, id: string) => { x: number; y: number } | null;
  __townGlide?: (id: string | readonly [number, number]) => void;
  __townCam?: () => { focus: [number, number] } | null;
  __shopIntro?: () => { step: string } | null;
};

/**
 * Today's town (the street town, an admin's: Eric, Nov 11, "re-record on today's town"), opened and ready: the loading screen
 * ("Building the town…") gone before anything is recorded. The chat box stays on screen but lets taps through; a slow clock
 * (`__reelWarp(WARP)`: the page's performance.now and its animation frames at an eighth of the speed) lets the slow sharp
 * screenshots (about 4 a second of the WebGL town) catch every frame of a run; scripts/reel/encode-trailer.py plays those parts back 8x.
 */
/**
 * The page the town's scenes are recorded on. On the phone, the project's own. For the wide cut, a touch screen of the same
 * 1920 x 1080 (a tablet on its side): there the town fills the whole screen, where a computer with a mouse puts it in the front
 * door's middle column, a third of the frame's width (docs/areas/town-square.md, "Layout").
 */
async function townPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    ...test.info().project.use,
    ...(isWide() ? { hasTouch: true, isMobile: true } : {}),
  });
  return ctx.newPage();
}
async function openTown(page: Page, sky: "day" | "night") {
  await asAdmin(page);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = ".town-chat,.town-chat *{pointer-events:none!important}";
      document.head.append(s);
    });
  });
  await page.addInitScript(() => {
    const real = performance.now.bind(performance);
    let base = real();
    let virt = base;
    let k = 1;
    const map = (t: number) => virt + (t - base) * k;
    performance.now = () => map(real());
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((ts) => cb(map(ts)));
    (window as unknown as { __reelWarp: (n: number) => void }).__reelWarp = (
      n: number,
    ) => {
      virt = map(real());
      base = real();
      k = n;
    };
  });
  await page.goto(`/town?debug&nolanding&sky=${sky}`);
  await expect(page.locator("canvas.town-canvas")).toHaveAttribute(
    "data-ready",
    "1",
    { timeout: 90_000 },
  );
  await expect(page.getByText("Building the town…")).toHaveCount(0, {
    timeout: 90_000,
  });
  await page.waitForTimeout(2500);
}
const townYou = (page: Page) =>
  page.evaluate(() => (window as unknown as TownHooks).__townYou?.() ?? null);
async function townWalk(page: Page, sq: [number, number]) {
  await page.evaluate(
    (s) => (window as unknown as TownHooks).__townWalk?.(s),
    sq,
  );
  await page.waitForTimeout(150);
  await expect
    .poll(async () => (await townYou(page))?.moving, {
      timeout: 400_000,
      intervals: [100],
    })
    .toBe(false);
}
const townWarp = (page: Page, n: number) =>
  page.evaluate(
    (x) =>
      (window as unknown as { __reelWarp: (n: number) => void }).__reelWarp(x),
    n,
  );
/** The slow clock's speed for the town's runs (the encoder plays them back at 1 / WARP). */
const WARP = Number(process.env.REEL_WARP ?? 0.125);
const routeOf = (text: string) =>
  text.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
/** Someone in the town says a line now and then (the bosses' and their kids' own lines), so the chat log keeps moving. */
const townTalk = (page: Page, everyMs: number) =>
  page.evaluate((ms) => {
    const say = () =>
      (window as unknown as { __townSay?: () => void }).__townSay?.();
    say();
    setInterval(say, ms);
  }, everyMs);

test("town", async ({ browser }) => {
  const page = await townPage(browser);
  // Scene 2: a run through the town by day, from the park up to Colosseum Row, the chat log moving in the top left.
  await setUp(page, "Player");
  await openTown(page, "day");
  console.log("you start at", await townYou(page));
  const route = routeOf(
    process.env.REEL_TOWN ?? "24,33 23,39 36,37 53,37 53,29 40,29 28,29",
  );
  await townWarp(page, WARP);
  await townTalk(page, 1300 / WARP);
  const rec = await recorder(page, "town");
  rec.mark("run");
  for (const [i, sq] of route.entries()) {
    await townWalk(page, sq);
    rec.mark(`at${i + 1}`);
  }
  rec.mark("runEnd");
  await rec.stop();
});

/** Your pawn's ride (Moon's Ride: a crescent, for the night), given and worn before the town opens. */
async function giveRide(page: Page) {
  await asAdmin(page);
  await page.goto("/?nolanding");
  await expect(
    page.getByRole("button", { name: "PLAY", exact: true }),
  ).toBeVisible();
  const [ride] = await giveItems(page, [
    {
      def: process.env.REEL_RIDE ?? "moon-ride",
      color: process.env.REEL_RIDE_COLOR ?? "cobalt",
      blemish: 0,
    },
  ]);
  await wearItem(page, "ride", ride!);
}
const rideReady = (page: Page) =>
  expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __townRide?: () => { you: { ready: boolean } } | null;
              }
            ).__townRide?.()?.you.ready ?? false,
        ),
      { timeout: 60_000 },
    )
    .toBe(true);

test("night", async ({ browser }) => {
  const page = await townPage(browser);
  // Scene 3: the same town at night, riding (Moon's Ride) past the homes' lit windows on Fountain Street.
  await setUp(page, "Player");
  await giveRide(page);
  await openTown(page, "night");
  await rideReady(page);
  const route = routeOf(process.env.REEL_NIGHT ?? "27,29 51,29 53,36 38,37");
  await townWalk(page, route[0]!);
  // (The night's frames take twice as long to grab: half the day's clock.)
  await townWarp(page, WARP / 2);
  await townTalk(page, 2600 / WARP);
  const rec = await recorder(page, "night");
  rec.mark("ride");
  for (const [i, sq] of route.slice(1).entries()) {
    await townWalk(page, sq);
    rec.mark(`at${i + 1}`);
  }
  rec.mark("rideEnd");
  await rec.stop();
});

/**
 * A boss challenged in the town at night, from your ride: the camera glides to his home, a tap on him, his card, Challenge alone,
 * Fight, in to his room, his own intro (each step marked), the battle's first screen.
 */
async function challenge(page: Page, scene: string, id: string, name: string) {
  // (At night, on the ride, as the scene before it ends at his door.)
  await setUp(page, "Player");
  await giveRide(page);
  await openTown(page, "night");
  await rideReady(page);
  // (The town's part on a slow clock, a quarter of the run's: the night's frames are slow to grab; the room's at full speed.)
  await townWarp(page, Math.min(1, WARP * 2));
  const rec = await recorder(page, scene);
  rec.mark("start");
  // The camera glides to his home (as his chip would), a tap on him, Challenge alone, Fight.
  await page.evaluate(
    (i) => (window as unknown as TownHooks).__townGlide?.(i),
    id,
  );
  await page.waitForTimeout(1800 / Math.min(1, WARP * 2));
  rec.mark("glided");
  const card = page.getByRole("dialog", { name, exact: true });
  await expect(async () => {
    if (await card.isVisible()) return;
    if (await page.getByRole("dialog").isVisible())
      await page.keyboard.press("Escape");
    const at = await page.evaluate(
      (i) => (window as unknown as TownHooks).__townAt?.("boss", i) ?? null,
      id,
    );
    if (!at)
      await page.evaluate(
        (i) => (window as unknown as TownHooks).__townGlide?.(i),
        id,
      );
    expect(at).not.toBeNull();
    const cv = (await page.locator("canvas.town-canvas").boundingBox())!;
    await page.mouse.click(cv.x + at!.x, cv.y + at!.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 60_000 });
  rec.mark("card");
  await expect
    .poll(async () => (await townYou(page))?.moving, { timeout: 60_000 })
    .toBe(false);
  rec.mark("arrived");
  await page.waitForTimeout(900);
  await card.getByRole("button", { name: "Challenge alone" }).click();
  await page.waitForTimeout(700);
  rec.mark("confirm");
  await page
    .getByRole("dialog", { name: `Challenge ${name}?` })
    .getByRole("button", { name: "Fight" })
    .click();
  rec.mark("fight");
  await expect(page.locator("canvas.town-shop-canvas")).toHaveAttribute(
    "data-room",
    id,
    { timeout: 60_000 },
  );
  rec.mark("room");
  await townWarp(page, 1);
  const steps = new Set<string>();
  const until = Date.now() + 90_000;
  while (Date.now() < until) {
    const s = await page.evaluate(
      () => (window as unknown as TownHooks).__shopIntro?.()?.step ?? null,
    );
    const m = await page.evaluate(
      () => (window as any).match?.phase?.kind ?? null,
    );
    if (s && !steps.has(s)) {
      steps.add(s);
      rec.mark(`intro:${s}`);
    }
    if (m && !steps.has(`match:${m}`)) {
      steps.add(`match:${m}`);
      rec.mark(`match:${m}`);
      if (m === "play" || m === "boss") break;
    }
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(3500);
  rec.mark("end");
  await rec.stop();
}
test("bigboy", async ({ browser }) => {
  // Scene 4: Big Boy: his card, Fight, in to his Crib, his blocks building the table, his candy swirl, the battle.
  await challenge(await townPage(browser), "bigboy", "bigboy", "Big Boy");
});
test("hollow", async ({ browser }) => {
  // The mashup's Hollow: his own intro in Hollow Peak (the lanterns out one by one, the blackout).
  await challenge(await townPage(browser), "hollow", "hollow", "Hollow");
});

/**
 * The boss mashup's clips: Boss alone against one boss with one power switched on (`?boss=&power=`), you playing quiet moves with
 * taps; every screen of his and every power event is marked as it comes (`ev:<kinds>`), so the cut can find its moment.
 */
type BossSeen = {
  kind: string | null;
  intro: boolean;
  thinking: boolean;
  fen: string | null;
  events: string[];
  dark: string | null;
  allowed: string[] | null;
};
async function bossBattle(
  page: Page,
  scene: string,
  boss: string,
  power: string,
  opts: { turns: number; stopOn?: string; tail?: number; extra?: string },
  each?: (
    turn: number,
    s: BossSeen,
    tap: (sq: string) => Promise<void>,
    mark: (name: string) => void,
  ) => Promise<void>,
) {
  await setUp(page, "Player");
  await page.goto(
    `/?debug&clock=60&nolanding&boss=${boss}&power=${power}&laststand=0${opts.extra ?? ""}`,
  );
  await page
    .getByRole("main")
    .getByRole("button", { name: /^Boss Battle/ })
    .click();
  const rec = await recorder(page, scene);
  await page.getByRole("main").getByRole("button", { name: "START" }).click();
  rec.mark("start");
  const seen = (): Promise<BossSeen> =>
    page.evaluate(() => {
      const m = (window as any).match;
      const ph = m?.phase;
      const b = ph?.boss ?? m?.boss ?? null;
      return {
        kind: ph?.kind ?? null,
        intro: !!ph?.intro,
        thinking: !!ph?.thinking,
        fen: ph?.board?.fen ?? b?.board?.fen ?? null,
        events: (b?.powers?.events ?? []).map((e: any) => e.kind),
        dark:
          (b?.powers?.events ?? []).find((e: any) => e.kind === "dark")
            ?.square ?? null,
        allowed: b?.powers?.allowed ?? null,
      };
    });
  let lastSig = "";
  let stop = false;
  const watch = async (until: (s: BossSeen) => boolean, ms = 150_000) => {
    const end = Date.now() + ms;
    for (;;) {
      const s = await seen();
      const sig = `${s.kind}/${s.intro ? "intro" : ""}/${s.thinking ? "think" : ""}/${s.events.join("+")}`;
      if (sig !== lastSig) {
        lastSig = sig;
        rec.mark(
          `${s.kind}${s.intro ? ":intro" : ""}${s.thinking ? ":think" : ""}${s.events.length ? ` ev:${s.events.join("+")}` : ""}`,
        );
        if (opts.stopOn && s.events.includes(opts.stopOn) && !s.thinking)
          stop = true;
      }
      if (until(s) || Date.now() > end) return s;
      await page.waitForTimeout(60);
    }
  };
  const tap = async (sq: string) => {
    const box = (await page.locator(".hb-board").first().boundingBox())!;
    const flip = await page.evaluate(
      () =>
        !!document
          .querySelector(".hb")
          ?.classList.contains("orientation-black"),
    );
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    await page.mouse.click(
      box.x + ((flip ? 7 - f : f) + 0.5) * (box.width / 8),
      box.y + ((flip ? r : 7 - r) + 0.5) * (box.height / 8),
    );
  };
  const WANT = [
    "e2e4",
    "e7e5",
    "g1f3",
    "g8f6",
    "b1c3",
    "b8c6",
    "d2d3",
    "d7d6",
    "f1e2",
    "f8e7",
    "h2h3",
    "h7h6",
    "a2a3",
    "a7a6",
  ];
  for (let turn = 0; turn < opts.turns && !stop; turn++) {
    const s = await watch((x) => x.kind === "play");
    if (s.kind !== "play" || !s.fen) break;
    await page.waitForTimeout(700);
    if (each) await each(turn, s, tap, rec.mark);
    const c = new Chess(s.fen);
    const legal = c.moves({ verbose: true });
    const ok = (m: string) => !s.allowed || s.allowed.includes(m);
    const quiet = legal
      .filter((m) => !m.captured && !m.san.includes("+") && !m.promotion)
      .map((m) => m.from + m.to)
      .filter(ok);
    const move =
      WANT.find((m) => quiet.includes(m)) ??
      quiet[0] ??
      legal.map((m) => m.from + m.to).filter(ok)[0]!;
    for (let i = 0; i < 6 && (await seen()).kind === "play"; i++) {
      await tap(move.slice(0, 2));
      await tap(move.slice(2, 4));
      await page.waitForTimeout(400);
    }
    rec.mark(`played ${move}`);
    await watch((x) => x.kind !== "play", 10_000);
  }
  await watch((x) => x.kind === "play", 60_000);
  await page.waitForTimeout(opts.tail ?? 2500);
  rec.mark("end");
  await rec.stop();
}

test("boss-hollow", async ({ page }) => {
  // Hollow: he covers a square in the dark; you grope in it and get it wrong, and his bulbs go out one by one.
  await bossBattle(
    page,
    "boss-hollow",
    "hollow",
    "dark",
    { turns: 3 },
    async (turn, s, tap, mark) => {
      if (turn !== 1 || !s.dark || !s.fen) return;
      const c = new Chess(s.fen);
      const empty = ["a4", "h4", "a5", "h5", "a3", "h3", "a6", "h6"].filter(
        (sq) => !c.get(sq as never),
      );
      for (let i = 0; i < 2; i++) {
        mark(`wrong${i + 1}`);
        await tap(s.dark);
        await page.waitForTimeout(500);
        await tap(empty[i]!);
        await page.waitForTimeout(2600);
      }
    },
  );
});
test("boss-alfil", async ({ page }) => {
  // Alfil: TUSKS!, two of his pawns glow, then fuse into an elephant.
  await bossBattle(page, "boss-alfil", "alfil", "tusks", {
    turns: 6,
    stopOn: "fuse",
    tail: 3000,
  });
});
test("boss-bigboy", async ({ page }) => {
  // Big Boy: his toy block, then the Big Bounce across the board.
  await bossBattle(page, "boss-bigboy", "bigboy", "bounce", {
    turns: 5,
    stopOn: "bounce",
    tail: 3000,
  });
});
test("boss-sawyer", async ({ page }) => {
  // Sawyer: his saw through the board.
  await bossBattle(page, "boss-sawyer", "sawyer", "boardsaw", {
    turns: 5,
    stopOn: "boardsaw",
    tail: 3000,
  });
});
test("boss-smudgy", async ({ page }) => {
  // Smudgy: the board repainted.
  await bossBattle(page, "boss-smudgy", "smudgy", "repaint", {
    turns: 5,
    stopOn: "repaint",
    tail: 3000,
  });
});

test("squads", async ({ page }) => {
  // Scene 6: Squads (8 squads of 4): a test lobby's Relay, its three boards over yours; you move when it's your turn.
  await setUp(page, "Player");
  // (A test lobby's own controls, Next round and Cheat lines, aren't the game's: out of the picture, their room kept.)
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent =
        ".sq-next,[class*='sq-cheat']{visibility:hidden!important}";
      document.head.append(s);
    });
  });
  await page.goto(
    `/squads/test/relay?nolanding&debug&clock=${process.env.REEL_SQUADS_CLOCK ?? "blitz"}`,
  );
  const seen = () =>
    page.evaluate(() => {
      const s = (window as any).squads;
      if (!s?.lobby) return null;
      const m = [...s.matches.values()].find(
        (x: any) =>
          x.state !== "over" &&
          x.sides.some((sd: any) => sd.seats.includes(s.myId)),
      ) as any;
      const d =
        m?.state === "half"
          ? m.current?.duties.find((x: any) => x.players.includes(s.myId))
          : null;
      return {
        phase: s.lobby.phase as string,
        seq: m?.current?.seq as number | undefined,
        role: (d?.role ?? null) as string | null,
        fen: (d ? m.boards[d.board].fen : null) as string | null,
        locked: !!m?.locked?.includes(s.myId),
      };
    });
  // (The votes, where the lobby opens on them: skipped.)
  await expect(async () => {
    const skip = page.getByRole("button", { name: "Skip votes" });
    if (await skip.isVisible()) await skip.click();
    expect((await seen())?.phase).toBe("bracket");
  }).toPass({ timeout: 90_000 });
  const rec = await recorder(page, "squads");
  rec.mark("bracket");
  const WANT = [
    "e2e4",
    "e7e5",
    "d2d4",
    "d7d5",
    "g1f3",
    "g8f6",
    "b1c3",
    "b8c6",
    "f1c4",
    "f8c5",
    "c1f4",
    "c8f5",
  ];
  const end = Date.now() + Number(process.env.REEL_SQUADS_MS ?? 45_000);
  let last = "";
  while (Date.now() < end) {
    const s = await seen().catch(() => null);
    if (s?.role === "move" && s.fen && !s.locked && `${s.seq}` !== last) {
      last = `${s.seq}`;
      rec.mark(`duty${s.seq}`);
      await page.waitForTimeout(1500);
      const legal = new Chess(s.fen).moves({ verbose: true });
      const all = legal.map((m) => m.from + m.to);
      const move =
        WANT.find((m) => all.includes(m)) ??
        legal.find((m) => m.captured)?.lan.slice(0, 4) ??
        all[0]!;
      const box = (await page
        .locator(".board-area .hb-board")
        .boundingBox())!;
      const black = await page
        .locator(".board-area .hb")
        .evaluate((el) => el.classList.contains("orientation-black"));
      for (const sq of [move.slice(0, 2), move.slice(2, 4)]) {
        const f = sq.charCodeAt(0) - 97;
        const r = Number(sq[1]) - 1;
        await page.mouse.click(
          box.x + ((black ? 7 - f : f) + 0.5) * (box.width / 8),
          box.y + ((black ? r : 7 - r) + 0.5) * (box.height / 8),
        );
        await page.waitForTimeout(250);
      }
      rec.mark(`moved${s.seq} ${move}`);
    }
    await page.waitForTimeout(150);
  }
  rec.mark("end");
  await rec.stop();
});

/** Both players queue in their own pool and meet; the vote; then a known opening, played with taps from both sides. */
async function rankedPlayer(browser: Browser, name: string, rank: string) {
  const ctx = await browser.newContext({ ...test.info().project.use });
  const page = await ctx.newPage();
  await setUp(page, name);
  await asAdmin(page);
  await page.goto(`/?nolanding&rank=${rank}`);
  await expect(
    page.getByRole("button", { name: "PLAY", exact: true }),
  ).toBeVisible();
  return page;
}

test("ranked", async ({ browser }) => {
  test.setTimeout(150_000);
  // Scene 3: a ranked 1 v 1 between two players (two pages), recorded from one: the stage, the vote, a quick opening.
  const a = await rankedPlayer(browser, "Player", "gold-2");
  const b = await rankedPlayer(browser, "Knightowl", "gold-3");
  const pool = `reel${Math.random().toString(36).slice(2, 8)}`;
  // (Both players' views are recorded until the board is up; the one playing White is kept: the board the right way up.)
  const recA = await recorder(a, "ranked-a");
  const recB = await recorder(b, "ranked-b");
  const both = (name: string) => [recA, recB].forEach((r) => r.mark(name));
  await a.goto(`/1v1?nolanding&debug&pool=${pool}&rank=gold-2`);
  both("search");
  await b.goto(`/1v1?nolanding&debug&pool=${pool}&rank=gold-3`);
  for (const p of [a, b])
    await expect(p.locator(".dv-versus .dv-st-them .dv-st-pawn")).toBeVisible({
      timeout: 30_000,
    });
  both("versus");
  for (const p of [a, b])
    await expect(p.locator(".dv-vote")).toBeVisible({ timeout: 15_000 });
  both("vote");
  await a.waitForTimeout(800);
  for (const p of [a, b]) {
    await p.locator(".vote-me").click();
    await p.getByRole("button", { name: "Pick Blitz 3+2" }).click();
  }
  for (const p of [a, b])
    await expect(p.locator(".dv-status")).toContainText(/first move/, {
      timeout: 20_000,
    });
  both("play");
  const side = async (p: Page) =>
    (await p.locator(".dv-strip.dv-you").getAttribute("data-side")) as
      | "w"
      | "b";
  const white = (await side(a)) === "w" ? a : b;
  const black = white === a ? b : a;
  const rec = white === a ? recA : recB;
  await (white === a ? recB : recA).drop();
  const squareAt = async (p: Page, sq: string) => {
    const box = (await p
      .locator(`.board-area ${BOARD_SEL.squares}`)
      .boundingBox())!;
    const w = (await side(p)) === "w";
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    const col = w ? f : 7 - f;
    const row = w ? 7 - r : r;
    return {
      x: box.x + ((col + 0.5) * box.width) / 8,
      y: box.y + ((row + 0.5) * box.height) / 8,
    };
  };
  const line = [
    "e2e4",
    "c7c5",
    "g1f3",
    "d7d6",
    "d2d4",
    "c5d4",
    "f3d4",
    "g8f6",
    "b1c3",
    "a7a6",
    "c1e3",
    "e7e5",
  ];
  for (const [i, uci] of line.entries()) {
    const p = i % 2 === 0 ? white : black;
    await p.waitForTimeout(500 + Math.random() * 700);
    const from = await squareAt(p, uci.slice(0, 2));
    const to = await squareAt(p, uci.slice(2, 4));
    await p.mouse.click(from.x, from.y);
    await p.waitForTimeout(120);
    await p.mouse.click(to.x, to.y);
    rec.mark(`move${i + 1}`);
  }
  await a.waitForTimeout(1500);
  rec.mark("end");
  await rec.stop("ranked");
});

test("hidden", async ({ page }) => {
  // Scene 4: the Hidden Boss, pixel art (hidden-boss.ts) on the app's own page (its fonts), its loop recorded as the others.
  await page.goto("/?nolanding");
  await page.waitForTimeout(1000);
  await page.evaluate(drawHiddenBoss, isWide());
  const rec = await recorder(page, "hidden");
  rec.mark("start");
  await page.waitForTimeout(11_000);
  rec.mark("end");
  await rec.stop();
});

test("ranks", async ({ page }) => {
  // Scene 3's end: the run up the ranks (rank-shuffle.ts), from the game's own emblems and colors.
  await page.goto("/?nolanding");
  await page.waitForTimeout(800);
  const rec = await recorder(page, "ranks");
  rec.mark("start");
  await page.evaluate(drawRankShuffle, { ...shuffleSteps(), wide: isWide() });
  await page.waitForTimeout(5500);
  rec.mark("end");
  await rec.stop();
});

test("captions", async ({ page }) => {
  // The captions: one see-through picture each, as wide as the reel (the phone's 860 px: 344 CSS px at 2.5x; the computer's 1920, on
  // one line, big enough to read from a few feet away), in the game's pixel font.
  const wide = isWide();
  const dir = `${OUT}/captions${sfx()}`;
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize(
    wide ? { width: 1920, height: 1080 } : { width: 344, height: 600 },
  );
  await page.goto("/?nolanding");
  await page.waitForTimeout(800);
  for (const [i, text] of REEL_CAPTIONS.entries()) {
    await page.evaluate(
      ([t, w]) => {
        document.body.innerHTML = "";
        document.documentElement.style.background = "transparent";
        document.body.style.cssText = "margin:0;background:transparent";
        const d = document.createElement("div");
        d.id = "cap";
        d.style.cssText =
          `position:absolute;left:0;right:0;top:0;padding:${w ? "22px 24px" : "10px 12px"};font:${w ? 44 : 14}px/1.7 'Press Start 2P',monospace;` +
          "text-align:center;color:#f4b740;" +
          (w
            ? "text-shadow:4px 0 0 #1a1406,-4px 0 0 #1a1406,0 4px 0 #1a1406,0 -4px 0 #1a1406,4px 4px 0 #1a1406;"
            : "text-shadow:2px 0 0 #1a1406,-2px 0 0 #1a1406,0 2px 0 #1a1406,0 -2px 0 #1a1406,2px 2px 0 #1a1406;") +
          `background:rgba(14,15,19,0.78);border-top:${w ? 4 : 2}px solid #f4b740;border-bottom:${w ? 4 : 2}px solid #f4b740;white-space:pre-line`;
        d.textContent = w ? t.replace(/\s*\n\s*/g, " ") : t;
        document.body.append(d);
      },
      [text, wide] as const,
    );
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("#cap")
      .screenshot({ path: `${dir}/c${i + 1}.png`, omitBackground: true });
  }
});

test("landing", async ({ browser }) => {
  test.skip(isWide(), "once, in the phone project");
  // The landing page with the reel at its new size: phones 320, 390 and 430 wide, computers 1280 × 800, 1440 × 900 and 1920 × 1080.
  // Stills to reports/demo/landing/, and the video's box and any sideways scroll, logged.
  mkdirSync(`${OUT}/landing`, { recursive: true });
  const sizes = [
    { w: 320, h: 640, phone: true },
    { w: 390, h: 844, phone: true },
    { w: 430, h: 932, phone: true },
    { w: 1280, h: 800, phone: false },
    { w: 1440, h: 900, phone: false },
    { w: 1920, h: 1080, phone: false },
  ];
  for (const s of sizes) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: s.phone ? 2 : 1,
      isMobile: s.phone,
      hasTouch: s.phone,
      colorScheme: "light",
    });
    const page = await ctx.newPage();
    // (The landing shows only where sign-in is set up: faked, as e2e/landing.spec.ts does.)
    await page.route("**/api/auth/config", (r) =>
      r.fulfill({
        json: {
          accounts: true,
          google: true,
          email: true,
          onlineNeedsSignIn: true,
        },
      }),
    );
    await page.goto("/");
    const video = page.locator("video.demo-video");
    await expect(video).toBeVisible();
    await page.waitForTimeout(1500);
    const box = (await video.boundingBox())!;
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const src = await video.evaluate((v: HTMLVideoElement) =>
      v.currentSrc.split("/").pop(),
    );
    const signIn = await page
      .getByRole("button", { name: /Play vs \d+ bots as a guest/ })
      .boundingBox();
    console.log(
      `${s.w}x${s.h}: ${src} ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)} × ${Math.round(box.height)} (${Math.round((box.width / s.w) * 100)}% wide, ` +
        `${Math.round((box.height / s.h) * 100)}% high); guest button's bottom ${Math.round(signIn!.y + signIn!.height)}; page ${scroll} wide`,
    );
    await page.screenshot({ path: `${OUT}/landing/landing-${s.w}x${s.h}.png` });
    await ctx.close();
  }
});
