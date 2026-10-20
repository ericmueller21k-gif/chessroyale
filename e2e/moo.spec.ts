import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOARD_SEL, test, bossAloneFromHome, engineTop, submitMove } from "./helpers.ts";
import { REFUSED } from "../packages/app/src/refused.ts";
import { MOO_LINES } from "../packages/app/src/characters/moo.ts";
import { plainLine } from "../packages/app/src/speech-icons.ts";

/**
 * Moo & Moon (id moo), played alone on a phone and a computer, the state read from the game and what's on screen read from the
 * page, every frame (docs/decisions/2026-10-20-moo-wired.md; his rules: docs/decisions/2026-10-20-moo-rules.md):
 * - Moonbeam: after his 3rd move a beam stuns one of your pieces: it falls on the square, hits, and holds with a crescent moon
 *   burned into the square under the piece; a tap of its moves is refused with the dock's words ("Moonlight holds that
 *   piece.") and nothing moves; another move works; once your move lands the beam fades and the piece is free.
 * - The Full Moon (?power=fullmoon): the warning, the transformation while he thinks, the flurry's five beams 120 ms apart all
 *   holding together, every animation of his drawn powered up (the gold of his fur on his canvas) through his five moves,
 *   then dazed, and his colors back. The Moon says his lines.
 * - His icons in a line: drawn as pixel images in the bubble, the plain words for a screen reader, the long lines whole and in
 *   view at 320, 360, 390 and 1280 px.
 * - He hugs the moon, now and then sits on it and hugs it again, at rest and never during a moment.
 * - The layout at 320, 360, 390 and 1280: his figure whole in the bar, his name and the Moon on his meter clear of it.
 * His king attack in the Last Stand is in king-attack.spec.ts, his tile and stage in boss-select.spec.ts, the rest of his kit in
 * boss-smoke.spec.ts.
 */
const desktop = () => test.info().project.name === "desktop";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board?.fen as string, boss: m.boss, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null, stunned: (m.boss?.powers?.stunned ?? []) as string[] };
  });
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

async function squareAt(page: Page, square: string) {
  const board = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const flip = (await page.evaluate(() => (window as any).match.boss?.crowdSide)) === "b";
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return { x: board.x + ((flip ? 7 - f : f) + 0.5) * (board.width / 8), y: board.y + ((flip ? r : 7 - r) + 0.5) * (board.height / 8) };
}
const tap = async (page: Page, square: string) => {
  const q = await squareAt(page, square);
  await page.mouse.click(q.x, q.y);
};

/** A quiet move of yours, allowed now (no capture, no promotion; a knight's first): the fallback if the engine names none. */
function quiet(fen: string, allowed: string[] | null): string {
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to, piece: m.piece, quiet: !m.captured && !m.promotion }));
  const ok = legal.filter((m) => !allowed || allowed.includes(m.uci));
  return (ok.find((m) => m.quiet && m.piece === "n") ?? ok.find((m) => m.quiet) ?? ok[0])!.uci;
}

/**
 * The engine's best move that the powers allow now. A careless player is mated within a few moves of some of his openings (a
 * knight wandering from b1 to b6 in a King's Gambit that has his king on f1), which ends the test before the beam.
 */
async function soundMove(page: Page, s: { fen: string; allowed: string[] | null }): Promise<string> {
  const { top } = await engineTop(page);
  return (s.allowed ? top.find((t) => s.allowed!.includes(t.move))?.move : top[0]?.move) ?? quiet(s.fen, s.allowed);
}

/**
 * Records every frame from now on: his bar figure's animation and how much of his powered-up gold is on its canvas (the lemon
 * gold of his fur, #fbe53c, which his normal colors never have) and on the caster's at the board's corner, the power moments on
 * screen, each beam on the board (its square, phase and box), the game's phase, the held squares, his line and the boss bar's moon.
 */
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__rec = [] as any[];
    const gold = (c: HTMLCanvasElement | null) => {
      if (!c) return null;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] === 251 && d[i + 1] === 229 && d[i + 2] === 60 && d[i + 3] > 0) n++;
      return n;
    };
    const look = () => {
      const bar = document.querySelector<HTMLElement>(".boss-char.place-bar");
      const p = w.match?.boss?.powers;
      w.__rec.push({
        t: Date.now(),
        anim: bar?.getAttribute("data-anim") ?? null,
        barGold: gold(bar?.querySelector("canvas") ?? null),
        casterGold: gold(document.querySelector<HTMLCanvasElement>(".pm-caster canvas")),
        moments: [...document.querySelectorAll(".power-moment")].map((e) => e.className.replace("power-moment", "").trim()),
        beams: [...document.querySelectorAll<HTMLElement>(".mo-beam")].map((e) => {
          const r = e.getBoundingClientRect();
          return { square: e.dataset.square, phase: e.dataset.phase, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
        phase: w.match?.phase?.kind ?? null,
        stunned: p?.stunned ?? [],
        fullMoon: p?.fullMoon ?? null,
        events: (p?.events ?? []).map((e: { kind: string }) => e.kind),
        say: document.querySelector(".bc-bubble")?.getAttribute("aria-label") ?? null,
        moon: document.querySelector<HTMLElement>(".mo-moon")?.dataset.step ?? null,
      });
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
type Rec = {
  t: number;
  anim: string | null;
  barGold: number | null;
  casterGold: number | null;
  moments: string[];
  beams: { square: string; phase: string; left: number; right: number; top: number; bottom: number }[];
  phase: string | null;
  stunned: string[];
  fullMoon: { left: number } | null;
  events: string[];
  say: string | null;
  moon: string | null;
};
const recorded = (page: Page) => page.evaluate(() => (window as any).__rec as Rec[]);

test("Moo & Moon: a moonbeam falls on one of your pieces and burns a crescent into its square; it can't move for your turn, then it's free", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=moo");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  expect((await state(page)).boss.id).toBe("moo");
  expect(await page.locator(".mo-beam").count()).toBe(0);

  // Your moves until his 3rd move has brought the beam (none before it).
  for (let i = 0; i < 3; i++) {
    await yourMove(page);
    const s = await state(page);
    expect(s.stunned).toEqual([]);
    expect(await page.locator(".mo-beam").count()).toBe(0);
    await submitMove(page, await soundMove(page, s), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  expect(s.stunned).toHaveLength(1);
  const sq = s.stunned[0]!;
  const board = new Chess(s.fen);
  const piece = board.get(sq as never) as { color: string; type: string } | undefined;
  expect(piece?.color).toBe(s.boss.crowdSide);
  expect(piece?.type).not.toBe("k");

  // What the page drew, frame by frame: the beam on that square fell, hit and held, in that order, no beam anywhere else, and the Moon said a
  // line of its Moonbeam's as it fell.
  const rec1 = await recorded(page);
  const seen = rec1.flatMap((r) => r.beams.filter((b) => b.square === sq).map((b) => b.phase));
  const order = seen.filter((p, i) => p !== seen[i - 1]);
  expect(order.slice(0, 3), `phases ${order}`).toEqual(["fall", "hit", "hold"]);
  expect(rec1.some((r) => r.moments.includes("pm-moonbeam"))).toBe(true);
  expect(rec1.flatMap((r) => r.beams).every((b) => b.square === sq)).toBe(true);
  const powerLines = MOO_LINES.power!.map(plainLine);
  // (A passive's line waits its turn behind a reaction line still up, and lapses after 5 s: so the Moon said it, or his bubble was busy
  // with another while the beam fell. The line itself is checked in moo-wired.test.ts.)
  const said = rec1.some((r) => r.say && powerLines.includes(r.say));
  const busy = rec1.some((r) => r.moments.includes("pm-moonbeam") && r.say && !powerLines.includes(r.say));
  expect(said || busy, "the Moon's Moonbeam line, or his bubble busy with another").toBe(true);
  // Its column exactly on the board's squares (the bottom square is the target), within a pixel.
  await expect(page.locator(".mo-beam")).toHaveCount(1);
  const b = (await page.locator(BOARD_SEL.squares).first().boundingBox())!;
  const cell = b.width / 8;
  const beam = (await page.locator(".mo-beam").boundingBox())!;
  const flip = s.boss.crowdSide === "b";
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  const left = b.x + (flip ? 7 - f : f) * cell;
  const bottom = b.y + ((flip ? r : 7 - r) + 1) * cell;
  expect(Math.abs(beam.x - left), "its column on the square's file").toBeLessThanOrEqual(1);
  expect(Math.abs(beam.width - cell), "one square wide").toBeLessThanOrEqual(1);
  expect(Math.abs(beam.y + beam.height - bottom), "its foot on the square's bottom edge").toBeLessThanOrEqual(1);
  expect(Math.abs(beam.height - 8 * cell), "eight squares tall").toBeLessThanOrEqual(1);
  // The crescent burned into the square: a canvas under the pieces with the char on that square's pixels, none elsewhere.
  const scorch = await page.evaluate(
    ({ sq, flip }) => {
      const cv = document.querySelector<HTMLCanvasElement>("canvas.mo-scorch");
      if (!cv) return null;
      const z = getComputedStyle(cv).zIndex;
      const px = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
      const cell = cv.width / 8;
      const f = sq.charCodeAt(0) - 97;
      const r = Number(sq[1]) - 1;
      const col = flip ? 7 - f : f;
      const row = flip ? r : 7 - r;
      let on = 0;
      let off = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3]! > 0) (Math.floor(x / cell) === col && Math.floor(y / cell) === row ? on++ : off++);
      return { on, off, z };
    },
    { sq, flip },
  );
  expect(scorch, "the scorch canvas").not.toBeNull();
  expect(scorch!.on, "a crescent burned into its square").toBeGreaterThan(150);
  expect(scorch!.off, "nowhere else").toBe(0);
  expect(Number(scorch!.z), "under the pieces").toBeLessThan(2);

  // Its moves are legal in chess but not allowed this turn.
  const its = board.moves({ verbose: true }).filter((m) => m.from === sq).map((m) => m.from + m.to);
  expect(its.length).toBeGreaterThan(0);
  expect(s.allowed).not.toBeNull();
  expect(s.allowed!.some((m) => m.startsWith(sq))).toBe(false);
  // A tap that tries one: it stays where it was, the dock says why, and the beam is still on it.
  await tap(page, its[0]!.slice(0, 2));
  await tap(page, its[0]!.slice(2, 4));
  await expect(page.locator(".boss-dock .refused-note")).toHaveText(REFUSED.stunned);
  expect(await phase(page)).toBe("play");
  expect(await page.evaluate(() => (window as any).match.phase.board.fen)).toBe(s.fen);
  await expect(page.locator(".mo-beam")).toHaveCount(1);

  // Another move; the crowd's move landing lets the piece go: the beam and the crescent fade away, and on your next turn it's free
  // (his 4th move brings no beam).
  await submitMove(page, await soundMove(page, s), s.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  await yourMove(page);
  const t = await state(page);
  expect(t.stunned).toEqual([]);
  expect(t.allowed).toBeNull();
  await expect(page.locator(".mo-beam")).toHaveCount(0);
  await expect(page.locator("canvas.mo-scorch")).toHaveCount(0);
  const rec2 = await recorded(page);
  const after = rec2.flatMap((x) => x.beams.filter((q) => q.square === sq).map((q) => q.phase));
  expect(after.at(-1), `phases ${after.filter((p, i) => p !== after[i - 1])}`).toBe("fade");
  expect(errors).toEqual([]);
});

test("Moo & Moon: the Full Moon warns, he turns powered up, the flurry drops five beams 120 ms apart, his moves are powered through five, then he's dazed and himself again", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone (the bar's figure is the one measured)");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=moo&power=fullmoon");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  const banners: string[] = [];
  const watchBanner = setInterval(() => void page.locator(".fight-banner .fb-sub").allTextContents().then((t) => banners.push(...t)).catch(() => undefined), 150);
  // Play on until he's dazed (the warning as the second turn begins, the Full Moon at the start of his turn after it, five moves). You play
  // the engine's best allowed move, so the battle lasts against him at full strength.
  const played = new Set<string>();
  const deadline = Date.now() + 200_000;
  const seenKinds = () => page.evaluate(() => [...new Set(((window as any).__rec as { events: string[] }[]).flatMap((r) => r.events))]);
  let kinds: string[] = [];
  while (Date.now() < deadline) {
    kinds = await seenKinds();
    if (kinds.includes("dazed") && (await phase(page)) === "play") break;
    if ((await phase(page)) === "results") break;
    if ((await phase(page)) === "play") {
      const s = await state(page);
      if (!played.has(s.fen)) {
        played.add(s.fen);
        await submitMove(page, await soundMove(page, s), s.fen);
      }
    }
    await page.waitForTimeout(200);
  }
  clearInterval(watchBanner);
  await page.waitForTimeout(1500);
  const rec = await recorded(page);
  expect(kinds, "the power events shown").toEqual(expect.arrayContaining(["warn", "fullMoon", "flurry", "dazed"]));
  expect(banners.some((t) => /After your move: Full Moon/.test(t)), "the warning names it").toBe(true);

  // On his bar: before the Full Moon none of the gold; powered all through the crowd's turns between his five moves (his idle
  // `powerIdle`, never the hug or the sit); after the daze's calm, none.
  const firstFull = rec.findIndex((r) => r.fullMoon);
  expect(firstFull).toBeGreaterThan(0);
  expect(rec.slice(0, firstFull).every((r) => !r.barGold), "no gold before the Full Moon").toBe(true);
  const powered = rec.filter((r) => r.fullMoon && r.phase === "play" && r.anim);
  expect(powered.length).toBeGreaterThan(20);
  // (A hit's flash is the one frame that is pale; none comes in quiet play, but one frame in thirty is allowed.)
  expect(powered.filter((r) => r.barGold! > 100).length / powered.length, "powered on the crowd's turns in it").toBeGreaterThan(0.97);
  expect(new Set(powered.map((r) => r.anim)).has("powerIdle"), `rests in powerIdle: ${[...new Set(powered.map((r) => r.anim))]}`).toBe(true);
  expect(powered.every((r) => !["idle", "sit", "toSit", "toHug"].includes(r.anim!)), "never his hug or sit while powered").toBe(true);
  const last = rec.at(-1)!;
  expect(last.fullMoon).toBeNull();
  expect(last.barGold, "himself again: no gold").toBe(0);

  // The caster at the board's corner: the transformation starts as himself and goes gold as it swaps; the flurry's is powered; the
  // daze starts powered and his colors go back.
  const casts = rec.filter((r) => r.casterGold !== null);
  expect(casts.some((r) => r.moments.includes("pm-fullmoon") && r.casterGold! > 100), "the Full Moon's caster goes gold").toBe(true);
  expect(casts.some((r) => r.moments.includes("pm-fullmoon") && r.casterGold === 0), "and starts as himself").toBe(true);
  expect(casts.some((r) => r.moments.includes("pm-flurry") && r.casterGold! > 100)).toBe(true);
  const dazedCasts = casts.filter((r) => r.moments.includes("pm-dazed"));
  expect(dazedCasts.some((r) => r.casterGold! > 100), "dazed starts powered").toBe(true);
  expect(dazedCasts.at(-1)!.casterGold, "and his colors go back").toBe(0);

  // The flurry: five beams (fewer only when fewer pieces can be held), each on its own square, falling about 120 ms apart in the order of
  // the held squares, all holding at once.
  const flurryAt = rec.findIndex((r) => r.moments.includes("pm-flurry"));
  expect(flurryAt).toBeGreaterThan(0);
  const held = rec.slice(flurryAt).find((r) => r.stunned.length >= 2)!.stunned;
  expect(held.length).toBeGreaterThanOrEqual(3);
  const fallStart = (sq: string) => rec.find((r) => r.beams.some((b) => b.square === sq && b.phase === "fall"))!.t;
  const starts = held.map(fallStart);
  for (let i = 1; i < starts.length; i++) {
    expect(starts[i]! - starts[i - 1]!, `beam ${i + 1} after beam ${i}`).toBeGreaterThanOrEqual(60);
    expect(starts[i]! - starts[i - 1]!, `beam ${i + 1} after beam ${i}`).toBeLessThanOrEqual(200);
  }
  expect(rec.some((r) => r.beams.filter((b) => b.phase === "hold").length === held.length), "all held together").toBe(true);
  // Never a beam on a square the rules didn't stun.
  const everStunned = new Set(rec.flatMap((r) => r.stunned));
  expect(rec.flatMap((r) => r.beams).every((b) => everStunned.has(b.square))).toBe(true);
  // The Moon says its lines: the transformation's, the flurry's and the daze's.
  const said = new Set(rec.map((r) => r.say));
  expect(MOO_LINES.ultimate!.map(plainLine).some((l) => said.has(l)), "the Full Moon's line").toBe(true);
  expect(MOO_LINES.flurry!.map(plainLine).some((l) => said.has(l)), "the flurry's line").toBe(true);
  expect(MOO_LINES.dazed!.map(plainLine).some((l) => said.has(l)), "the daze's line").toBe(true);
  // The moon on his meter went from new to full as it filled.
  expect(Math.max(...rec.map((r) => Number(r.moon ?? 0)))).toBe(8);
  expect(errors).toEqual([]);
});

test("Moo & Moon's icons in a line: pixel images in the bubble, the plain words for a screen reader, the long lines whole and in view at 320, 360, 390 and 1280 px", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (His five lines over 42 characters, with an icon where they have one.)
  const LONG = [MOO_LINES.entrance![0]!, MOO_LINES.entrance![1]!, MOO_LINES.defeat![0]!, MOO_LINES.wax![0]!, MOO_LINES.kingAttack![1]!];
  const sizes = desktop() ? [[1280, 800]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/?debug&clock=60&laststand=0&boss=moo");
    await bossAloneFromHome(page);
    // His entrance line: up for a few seconds, typing out, its icon an image of pixels (not a character) once it has typed.
    const bubble = page.locator(".bc-bubble:visible").first();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    const label = (await bubble.getAttribute("aria-label"))!;
    expect(MOO_LINES.entrance!.map(plainLine), `${w}`).toContain(label);
    expect(label, "a screen reader hears no icon token").not.toMatch(/[{}]/);
    // (Each of his three entrance lines ends in one icon: a heart, a question mark, a sparkle.)
    // (Before it types, the icon waits, unseen, in the line's `.speech-rest`, and is made again as it types: measure the typed one.)
    const typed = bubble.locator("span:not(.speech-rest) > img.line-icon");
    await expect(typed).toHaveCount(1, { timeout: 10_000 });
    const icon = await typed.first().evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight, shownH: img.getBoundingClientRect().height, rendering: getComputedStyle(img).imageRendering, hidden: img.getAttribute("aria-hidden") }));
    expect(icon.w, `${w}: the icon's pixels`).toBeGreaterThanOrEqual(8);
    expect(icon.h).toBeGreaterThanOrEqual(9);
    expect(icon.h).toBeLessThanOrEqual(14);
    expect(icon.shownH, "one image pixel to a screen pixel").toBe(icon.h);
    expect(icon.rendering).toBe("pixelated");
    expect(icon.hidden).toBe("true");
    expect(await bubble.evaluate((el) => el.textContent), "no token shows as text").not.toMatch(/[{}]/);
    // The long lines in a copy of the real box, each with an image where it has an icon: whole, in view, over neither the board nor the bar's status.
    const fits = await bubble.evaluate(
      (el, lines) => {
        const keepOff = [".board-row .hb-container", ".boss-next", ".board-area > .opening-name"];
        const pic = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
        return lines.map((line) => {
          const c = el.cloneNode(true) as HTMLElement;
          c.classList.remove("leaving");
          const parts = line.split(/\{\w+\}/);
          c.innerHTML = parts.map((part, i) => (i < parts.length - 1 ? `${part}<img class="line-icon" src="${pic}" width="11" height="11">` : part)).join("");
          el.parentElement!.appendChild(c);
          const r = c.getBoundingClientRect();
          const over = keepOff.filter((s) =>
            [...document.querySelectorAll<HTMLElement>(s)].some((o) => {
              const b = o.getBoundingClientRect();
              return b.width > 0 && Math.min(r.right, b.right) - Math.max(r.left, b.left) > 1 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1;
            }),
          );
          c.remove();
          return { line, left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), over };
        });
      },
      LONG,
    );
    for (const f of fits) {
      expect(f.left, `${w}: "${f.line}"`).toBeGreaterThanOrEqual(0);
      expect(f.top, `${w}: "${f.line}"`).toBeGreaterThanOrEqual(0);
      expect(f.right, `${w}: "${f.line}"`).toBeLessThanOrEqual(w!);
      expect(f.bottom, `${w}: "${f.line}"`).toBeLessThanOrEqual(h!);
      expect(f.over, `${w}: "${f.line}" over ${f.over}`).toEqual([]);
    }
    expect(await sideways(page), `${w}`).toBe(0);
  }
  expect(errors).toEqual([]);
});

test("Moo & Moon at rest hug the moon, now and then sit on it, and hug it again; never during a moment", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone (the bar's figure)");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&laststand=0&boss=moo");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  // You wait: his idle goes on, then (after 7 s of rest) the switch to the sit, the sit, the switch back (about 5 s later) and the hug.
  await expect
    .poll(async () => (await recorded(page)).map((r) => r.anim).filter((a, i, all) => a !== all[i - 1]).join(">"), { timeout: 45_000, intervals: [500] })
    .toMatch(/idle>toSit>sit>toHug>idle/);
  const rec = await recorded(page);
  const resting = rec.filter((r) => ["toSit", "sit", "toHug"].includes(r.anim ?? ""));
  expect(resting.length).toBeGreaterThan(20);
  expect(resting.every((r) => r.moments.length === 0 && r.phase === "play"), "only at rest: no moment, your turn").toBe(true);
  // The sit lasts about 5 s (a frame's margin).
  const t = rec.filter((r) => r.anim === "sit").map((r) => r.t);
  expect(t.at(-1)! - t[0]!).toBeGreaterThan(4500);
  expect(t.at(-1)! - t[0]!).toBeLessThan(5600);
  expect(errors).toEqual([]);
});

test("Moo & Moon at 320, 360, 390 and 1280 px: his figure whole, his name and the Moon on his meter clear of it, nothing sideways", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sizes = desktop() ? [[1280, 800]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto("/?debug&clock=60&laststand=0&boss=moo");
    await bossAloneFromHome(page);
    await yourMove(page);
    const fig = await page.locator(".boss-char canvas:visible").first().evaluate((c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect();
      const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, maxX = -1, minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3]! > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const k = r.width / c.width;
      return { left: r.left + minX * k, right: r.left + (maxX + 1) * k, top: r.top + minY * k, bottom: r.top + (maxY + 1) * k, seen: maxX >= 0 };
    });
    expect(fig.seen, `${w}: his figure is drawn`).toBe(true);
    expect(fig.left, `${w}`).toBeGreaterThanOrEqual(0);
    expect(fig.right, `${w}`).toBeLessThanOrEqual(w!);
    expect(fig.top, `${w}`).toBeGreaterThanOrEqual(0);
    expect(fig.bottom, `${w}`).toBeLessThanOrEqual(h!);
    if (!desktop()) {
      // A phone's bar: his figure clear of his name, the name whole, and the skulls, the rage meter and the moon in one row under it, inside the bar.
      const name = (await page.locator(".boss-name strong").boundingBox())!;
      expect(fig.right, `${w}: his figure clear of his name`).toBeLessThanOrEqual(name.x + 1);
      const bar = (await page.locator(".boss-bar").boundingBox())!;
      const meter = (await page.locator(".boss-threat .rage-meter").boundingBox())!;
      const moon = (await page.locator(".boss-threat .mo-moon").boundingBox())!;
      expect(await page.locator(".boss-name strong").evaluate((e) => e.scrollWidth <= e.clientWidth), `${w}: "Moo & Moon" whole`).toBe(true);
      expect(moon.x, `${w}: the moon after the meter`).toBeGreaterThanOrEqual(meter.x + meter.width - 1);
      expect(moon.x + moon.width, `${w}: the moon inside the bar`).toBeLessThanOrEqual(bar.x + bar.width);
      expect(Math.abs(moon.y + moon.height / 2 - (meter.y + meter.height / 2)), `${w}: the moon level with the meter`).toBeLessThanOrEqual(8);
      expect(moon.width).toBe(12);
    }
    expect(await sideways(page), `${w}`).toBe(0);
  }
  expect(errors).toEqual([]);
});

test("Moo & Moon: the Moon on his meter fills with it, new to full, and says a line at a quarter, a half and three quarters", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&laststand=0&brain=stockfish&boss=moo");
  await bossAloneFromHome(page);
  await yourMove(page);
  // The meter is the rage meter: here it is set by hand (the battle fills it slowly), the page's own number read through the boss view.
  await page.evaluate(() => {
    const m = (window as any).match;
    const real = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(m), "boss")!.get!;
    (window as any).__rage = 0.05;
    Object.defineProperty(m, "boss", { configurable: true, get() { const b = real.call(m); return b && { ...b, powers: { ...b.powers, rage: (window as any).__rage, warned: false, paused: false, ultAt: null } }; } });
  });
  const moon = page.locator(".mo-moon");
  const bubble = page.locator(".bc-bubble:visible").first();
  // (His entrance line is up first: the Moon's lines wait their turn and come after it.)
  await expect(page.locator(".bc-bubble:visible")).toHaveCount(0, { timeout: 20_000 });
  const steps: [number, string, string][] = [
    [0.05, "0", ""],
    [0.3, "2", MOO_LINES.wax![0]!],
    [0.55, "4", MOO_LINES.wax![1]!],
    [0.8, "6", MOO_LINES.wax![2]!],
    [1, "8", ""],
  ];
  for (const [rage, step, line] of steps) {
    await page.evaluate((r) => ((window as any).__rage = r), rage);
    await expect(moon, `${rage}`).toHaveAttribute("data-step", step, { timeout: 10_000 });
    expect(await moon.locator("rect.lit").count() > 0, `${rage}: some of it lit`).toBe(step !== "0");
    if (line) {
      await expect.poll(async () => (await bubble.getAttribute("aria-label").catch(() => null)) === plainLine(line), { timeout: 20_000, message: `the Moon says "${line}"` }).toBe(true);
      // (A line waits its turn behind the last and is dropped if it waits too long: the next quarter comes once this one is gone, as it does in a battle.)
      await expect(page.locator(".bc-bubble:visible")).toHaveCount(0, { timeout: 15_000 });
    }
  }
  // Full: all of its disc is lit.
  expect(await moon.locator("rect.dark").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("Moo & Moon: his tile picks him, and Boss alone meets him: his figure in the bar, his entrance line with its icon, no page errors", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&laststand=0&brain=stockfish");
  await bossAloneFromHome(page, "Moo & Moon");
  // (The picked boss's own menu: his row, at your strength plus his offset.)
  const menu = page.getByRole("dialog", { name: "Boss alone" });
  await expect(menu.locator(".boss-row")).toHaveCount(1);
  await menu.getByRole("button", { name: /Moo & Moon/ }).click();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  expect(await page.evaluate(() => (window as any).match.boss.name)).toBe("Moo & Moon");
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("moo");
  await expect(page.locator(".boss-name strong")).toHaveText("Moo & Moon");
  await expect(page.locator(".mo-moon")).toBeVisible();
  expect(errors).toEqual([]);
});
