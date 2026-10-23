import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { rollSeed } from "@chessroyale/chess";
import { GARDENER_LINES } from "../packages/app/src/characters/gardener-lines.ts";
import { frontMs } from "../packages/app/src/garden-sweep.ts";
import { test, bossAloneFromHome, createLobbyFromHome, submitMove } from "./helpers.ts";

/**
 * Puddles, the hippo gardener (id gardener; live since Oct 23: docs/decisions/2026-10-21-gardener-rules.md and 2026-10-23-gardener-wired.md),
 * played alone (and once online), the state read from the game and what the screen draws read from the page, every frame:
 * - Rules: the opening five seeds, the meter's two numbers in the view, a watering of ten seeds (`&power=water&seeds=10`) within the band, its
 *   outcomes where their rules allow, the plain plants blocking for 3 turns.
 * - The opening toss: his plant animation, five seeds arcing from his hand into the board's middle, each plopping, nothing left.
 * - A seed landing on the page's own clock (`&seedspeed=15`, a test switch: no 30 s wait) and the meter rising; a hidden page counts no seeds
 *   and tosses no burst when it comes back.
 * - The watering on the board: the sweep, a sprout on every outcome's square as the front reaches it, then each outcome at its cue (a piece
 *   off at `snap`, a piece on at `pop`), the plain plants through green, fall and drop, gone; a move onto a plant refused with
 *   "A plant is in the way." and another move working.
 * - Online: the meter by the server's clock, and a reload mid-battle showing the plants as they are without the watering again.
 * - The seed meter in the phone's bar at 320, 360, 390 and 1280: nothing pushed, nothing sideways.
 * - His king attack in the Last Stand; his long lines whole in view; no page errors. (His tile and stage: boss-select.spec.ts; every
 *   boss's king attack: king-attack.spec.ts; his passive and ultimate in the smoke time: boss-smoke.spec.ts.)
 */
const desktop = () => test.info().project.name === "desktop";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const state = (p: Page) =>
  p.evaluate(() => {
    const m = (window as any).match;
    return { fen: m.phase.board?.fen as string, history: (m.phase.board?.history ?? []) as string[], boss: m.boss, allowed: (m.boss?.powers?.allowed ?? null) as string[] | null };
  });

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** A quiet move of yours, allowed now (a knight first). */
function quiet(fen: string, allowed: string[] | null): string {
  const legal = new Chess(fen).moves({ verbose: true }).filter((m) => !m.captured && !m.promotion).map((m) => ({ uci: m.from + m.to, piece: m.piece }));
  const ok = legal.filter((m) => !allowed || allowed.includes(m.uci));
  return (ok.find((m) => m.piece === "n") ?? ok[0] ?? legal[0])!.uci;
}

/** His army short a pawn, a bishop, a knight and the queen, the crowd's whole: a grown piece can come up (set from the page before the first move). */
const SHORT_FEN = "rn2kb1r/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const shorten = (page: Page) =>
  page.evaluate((fen) => {
    const r = (window as any).match.runner;
    r.boards.set(0, { ...r.boards.get(0), fen, history: [], bases: [{ ply: 0, fen }] });
  }, SHORT_FEN);

/** A battle seed whose first watering rolls (of ten seeds) at least these: for a test that needs a killer plant, plain plants and a grown piece. */
function seedRolling(want: { plant: number; killer: number; grown: number }): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const kinds = Array.from({ length: 10 }, (_, i) => rollSeed(seed, 0, i));
    const n = (f: (k: string) => boolean) => kinds.filter(f).length;
    if (n((k) => k === "plant") >= want.plant && n((k) => k === "killer") >= want.killer && n((k) => k === "p" || k === "n" || k === "b" || k === "r") >= want.grown) return seed;
  }
  throw new Error("no seed rolls that");
}
const setSeed = (page: Page, seed: number) =>
  page.evaluate((s) => {
    (window as any).match.runner.state.boss.powers.seed = s;
  }, seed);

type Rec = {
  t: number;
  phase: string;
  anim: string | null;
  seeds: { sq: string; x: number; y: number }[];
  plops: string[];
  plants: string[];
  sweep: string | null;
  meter: { seeds: number; fill: number; held: boolean; text: string } | null;
  pieces: Record<string, string>;
  drawn: Record<string, number>;
  moment: boolean;
};

/**
 * What the page draws, every animation frame from now, into window.__rec: the phase, his figure's animation, the seeds in the air and plopping
 * (by square, with where each is), the sweep, each plain plant's state, the seed meter, the pieces on the board by square, and how much each
 * square in `watch` has drawn on the garden's canvas (a sprout, an outcome).
 */
async function record(page: Page, watch: string[] = []) {
  await page.evaluate((watch) => {
    const w = window as any;
    w.__rec = [] as any[];
    w.__watch = watch;
    const frame = () => {
      const board = document.querySelector<HTMLElement>(".hb-board");
      const b = board?.getBoundingClientRect();
      const white = !document.querySelector(".hb.orientation-black");
      const sq = (x: number, y: number) => {
        const f = Math.floor(((x - b!.left) / b!.width) * 8);
        const r = Math.floor(((y - b!.top) / b!.height) * 8);
        return f < 0 || f > 7 || r < 0 || r > 7 ? null : `${"abcdefgh"[white ? f : 7 - f]}${white ? 8 - r : r + 1}`;
      };
      const pieces: Record<string, string> = {};
      if (b)
        for (const p of document.querySelectorAll<HTMLElement>(".hb piece:not(.fading):not(.dragging)")) {
          const r = p.getBoundingClientRect();
          const s = sq(r.left + r.width / 2, r.top + r.height / 2);
          if (s && /(white|black) (pawn|knight|bishop|rook|queen|king)/.test(p.className)) pieces[s] = p.className.replace(/\s+/g, " ").trim();
        }
      const canvas = document.querySelector<HTMLCanvasElement>("canvas.gd-plants");
      const drawn: Record<string, number> = {};
      if (canvas && (w.__watch as string[]).length) {
        // (The whole canvas once a frame, then each watched square's cell of it.)
        const all = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        for (const s of w.__watch as string[]) {
          const f = s.charCodeAt(0) - 97;
          const r = Number(s[1]) - 1;
          const x0 = (white ? f : 7 - f) * 32;
          const y0 = (white ? 7 - r : r) * 32;
          let n = 0;
          for (let y = y0; y < y0 + 32; y++) for (let x = x0; x < x0 + 32; x++) if (all[(y * canvas.width + x) * 4 + 3]! > 24) n++;
          drawn[s] = n;
        }
      }
      const char = [...document.querySelectorAll<HTMLElement>(".boss-char")].find((c) => c.getBoundingClientRect().width > 0);
      const meter = document.querySelector<HTMLElement>(".seed-meter");
      w.__rec.push({
        t: Date.now(),
        phase: w.match?.phase?.kind ?? "none",
        anim: char?.getAttribute("data-anim") ?? null,
        seeds: [...document.querySelectorAll<HTMLElement>(".gd-seed")].map((e) => {
          const r = e.getBoundingClientRect();
          return { sq: e.dataset.square!, x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }),
        plops: [...document.querySelectorAll<HTMLElement>(".gd-plop")].map((e) => e.dataset.square!),
        plants: [...document.querySelectorAll<HTMLElement>(".gd-plant")].map((e) => `${e.dataset.square}:${e.dataset.state}`).sort(),
        sweep: document.querySelector<HTMLElement>(".gd-sweep")?.dataset.phase ?? null,
        meter: meter ? { seeds: Number(meter.dataset.seeds), fill: Number(meter.dataset.fill), held: meter.dataset.held === "1", text: meter.textContent ?? "" } : null,
        pieces,
        drawn,
        moment: !!document.querySelector(".power-moment"),
      });
      if (w.__rec.length < 20000) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, watch);
}
const recorded = (page: Page) => page.evaluate(() => (window as any).__rec as Rec[]);
/** Empties the page's sound log the frame your first turn begins (his entrance's grunt is before it), so what's heard from then on is the log. */
const soundsFromPlay = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    w.__soundLog = [];
    const look = () => {
      if (w.match?.phase?.kind === "play") w.__soundLog = [];
      else requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });

const BASE = "/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=gardener";
const ALL_SQUARES = [..."abcdefgh"].flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`));

test("the hippo gardener: his seeds, then a watering of ten seeds within the band", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}&power=water&seeds=10`);
  await bossAloneFromHome(page);
  await yourMove(page);
  // Every power event the boss view shows, watched every frame.
  await page.evaluate(() => {
    const w = window as any;
    w.__kinds = [] as string[];
    const look = () => {
      for (const e of w.match?.boss?.powers?.events ?? []) if (!w.__kinds.includes(e.kind)) w.__kinds.push(e.kind);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  const first = await state(page);
  expect(first.boss.id).toBe("gardener");
  expect(first.fen.split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  expect(first.boss.powers.garden).toMatchObject({ base: BOSS_POWERS.seedsAtStart, fixed: 10, plants: [], water: null, waterings: 0 });
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("plantMany");

  // Your moves until he has watered (the warning as the second turn begins, the watering at the start of his turn after it).
  let before = first;
  for (let i = 0; i < 5; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.garden.waterings) break;
    before = s;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const s = await state(page);
  const g = s.boss.powers.garden;
  expect(g.waterings).toBe(1);
  const w = g.water;
  expect(w.seeds).toBe(10);
  expect(w.rolled).toHaveLength(10);
  expect(w.growth).toHaveLength(10);
  // His whole turn: no move of his after your last; your turn again.
  expect(s.history.length).toBe(before.history.length + 1);
  // Each outcome where its rules allow it.
  const board = new Chess(s.fen);
  const his = s.boss.crowdSide === "w" ? "b" : "w";
  for (const o of w.growth) {
    if (o.kind === "killer") expect(board.get(o.square)).toBeFalsy();
    else if (o.kind === "plant" || o.kind === "nothing") expect(board.get(o.square)).toBeFalsy();
    else expect(board.get(o.square)).toMatchObject({ type: o.kind, color: his });
  }
  // His gain by this device's engines: under the band's top, unless the queen came up (the jackpot).
  expect(w.gain).not.toBeNull();
  if (!w.jackpot) expect(w.gain).toBeLessThanOrEqual(BOSS_POWERS.waterBand[1]);
  // The plain plants in the view, each blocking for 3 turns from this one.
  expect(g.plants.map((p: { square: string }) => p.square).sort()).toEqual(w.growth.filter((o: { kind: string }) => o.kind === "plant").map((o: { square: string }) => o.square).sort());
  for (const p of g.plants) expect(p.left).toBe(BOSS_POWERS.plantTurns);
  for (const m of s.allowed ?? []) for (const p of g.plants) expect(m.slice(2, 4)).not.toBe(p.square);
  // The meter reset to none.
  expect(g.base).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__kinds as string[]), { timeout: 10_000 }).toContain("water");
  expect(errors).toEqual([]);
});

test("the opening's five seeds: his plant animation, five seeds arcing from his hand into the board's middle, each plopping in, nothing left; his word; the meter at five", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await bossAloneFromHome(page);
  await soundsFromPlay(page);
  await record(page);
  await yourMove(page);
  await page.waitForTimeout(4500);
  const rec = await recorded(page);
  // His plant animation (the five's own), where he stands.
  expect(rec.some((r) => r.anim === "plantMany"), "his plantMany animation").toBe(true);
  // Five seeds in the air, each to its own square in the board's middle four ranks; each then plops on that square.
  const flown = new Map<string, Rec>();
  for (const r of rec) for (const s of r.seeds) if (!flown.has(s.sq)) flown.set(s.sq, r);
  expect([...flown.keys()], "five different squares").toHaveLength(5);
  for (const sq of flown.keys()) expect(sq).toMatch(/^[a-h][3-6]$/);
  for (const sq of flown.keys()) expect(rec.some((r) => r.plops.includes(sq)), `a plop on ${sq}`).toBe(true);
  expect(Math.max(...rec.map((r) => r.seeds.length))).toBe(5);
  // The first seed leaves his hand: a point near where his figure's `toss` frame has it (HAND), on the screen.
  const hand = await page.evaluate(() => {
    const c = [...document.querySelectorAll<HTMLElement>(".boss-char:not(.place-results) .boss-char-sprite")].find((e) => e.getBoundingClientRect().width > 0)!;
    const r = c.getBoundingClientRect();
    const k = r.width / 90;
    return { x: r.left + 23 * k, y: r.top + 54.5 * k, unit: document.querySelector(".hb-board")!.getBoundingClientRect().width / 8 };
  });
  const firstSeen = rec.find((r) => r.seeds.length)!.seeds[0]!;
  expect(Math.hypot(firstSeen.x - hand.x, firstSeen.y - hand.y), "the first seed's first frame is at his hand").toBeLessThan(hand.unit * 1.6);
  // Nothing stays: no seed and no plop a moment later, and nothing on the board but the pieces.
  const last = rec.at(-1)!;
  expect(last.seeds).toEqual([]);
  expect(last.plops).toEqual([]);
  expect(Object.keys(last.pieces)).toHaveLength(32);
  expect(last.plants).toEqual([]);
  // The meter: five seeds; his word (a line of the opening's two) said; a soft whiff for the toss, no grunt, a plip for each seed landing.
  expect(last.meter!.seeds).toBe(BOSS_POWERS.seedsAtStart);
  expect(last.meter!.text).toBe(`Seeds ${BOSS_POWERS.seedsAtStart}`);
  const log = (await page.evaluate(() => (window as any).__soundLog as string[])).map((x) => x.split(":")[0]);
  expect(log.filter((x) => x === "gardenerToss")).toHaveLength(1);
  expect(log.filter((x) => x === "gardenerPlip").length, "a soft plip for each seed landing").toBe(5);
  expect(log, "no grunt for a toss").not.toContain("gardenerGrunt");
  expect(errors).toEqual([]);
});

test("a seed lands on the page's own clock (?seedspeed=15): the meter rises, his plant animation tosses one seed; a hidden page counts no seeds and tosses no burst", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}&seedspeed=15`);
  await bossAloneFromHome(page);
  await yourMove(page);
  await page.waitForTimeout(3600);
  await page.evaluate(() => ((window as any).__soundLog = []));
  await record(page);
  const meter = () => page.locator(".seed-meter");
  // Five at the start; a seed every 2 s of real time now: the count rises one at a time, the bar fills between, and each lands a toss.
  await expect.poll(async () => Number(await meter().getAttribute("data-seeds")), { timeout: 20_000 }).toBeGreaterThanOrEqual(6);
  await expect(meter()).toContainText(/^Seeds [6-9]$/);
  await page.waitForTimeout(2500);
  const rec = await recorded(page);
  const counts = rec.filter((r) => r.meter).map((r) => r.meter!.seeds);
  for (let i = 1; i < counts.length; i++) expect(counts[i]! - counts[i - 1]!, "the count rises one seed at a time").toBeLessThanOrEqual(1);
  const fills = rec.filter((r) => r.meter && r.meter.seeds === counts[0]).map((r) => r.meter!.fill);
  expect(Math.max(...fills), "the bar fills toward the next seed").toBeGreaterThan(Math.min(...fills) + 20);
  expect(rec.filter((r) => r.anim === "plant").length, "his plant animation").toBeGreaterThan(5);
  const tossed = new Set(rec.flatMap((r) => r.seeds.map((s) => s.sq)));
  expect(tossed.size, "a seed to a square of the middle").toBeGreaterThanOrEqual(1);
  for (const sq of tossed) expect(sq).toMatch(/^[a-h][3-6]$/);
  const log = (await page.evaluate(() => (window as any).__soundLog as string[])).map((x) => x.split(":")[0]);
  expect(log, "a soft toss, never a grunt").not.toContain("gardenerGrunt");
  // A hidden page: the garden's clock stands still, so no seeds and no tosses; shown again it goes on, one seed at a time.
  const hide = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  const at = Number(await meter().getAttribute("data-seeds"));
  await hide(true);
  await page.evaluate(() => ((window as any).__rec.length = 0));
  await page.waitForTimeout(4500);
  expect(Number(await meter().getAttribute("data-seeds")), "no seed counted while hidden").toBe(at);
  expect((await recorded(page)).every((r) => r.seeds.length === 0 && r.anim !== "plant"), "no toss while hidden").toBe(true);
  await hide(false);
  await page.waitForTimeout(2600);
  const after = await recorded(page);
  expect(Math.max(0, ...after.map((r) => r.seeds.length)), "a seed at a time, no burst for the time it didn't count").toBeLessThanOrEqual(1);
  expect(Number(await meter().getAttribute("data-seeds")) - at).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

/**
 * The watering on the board, every frame: the sweep, a sprout on each outcome's square as the front reaches it, each outcome at its cue (a piece
 * off at `snap`, a piece on at `pop`), his reaction; then the plain plants through their turns, a move onto one refused with the line and another
 * one working; the plants gone after their 3 turns.
 */
test("his watering on the board: the sweep, a sprout per seed, each outcome at its cue; the plain plants green, fall, drop, gone; a move onto a plant is refused", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone");
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // A battle whose first watering rolls a killer plant, plain plants and a grown piece (set before his first move; his army short, so a piece may grow).
  const seed = seedRolling({ plant: 2, killer: 1, grown: 1 });
  await page.goto(`${BASE}&power=water&seeds=10`);
  await bossAloneFromHome(page);
  await yourMove(page);
  await shorten(page);
  await setSeed(page, seed);
  await record(page, ALL_SQUARES);
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.garden.waterings) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => page.evaluate(() => (window as any).match.phase.kind !== "play" || (window as any).match.boss?.powers?.garden?.waterings > 0), { timeout: 30_000 }).toBe(true);
  }
  await yourMove(page);
  const after = await state(page);
  const garden = after.boss.powers.garden;
  expect(garden.waterings).toBe(1);
  const growth = garden.water.growth as { kind: string; square: string; ate?: string }[];
  const plants = growth.filter((g) => g.kind === "plant");
  expect(growth.length, "ten seeds came up").toBe(10);
  const rec = await recorded(page);
  const sweepAt = rec.find((r) => r.sweep === "sweep")!;
  expect(sweepAt, "the sweep crossed the board").toBeTruthy();
  expect(rec.some((r) => r.sweep === "sheen"), "then the wet shine").toBe(true);
  // (The sweep starts at his `spray` cue, 460 ms into the moment: the moment's own start, from it.)
  const momentAt = sweepAt.t - 460;
  const orientation = (await page.locator(".hb.orientation-black").count()) ? "black" : "white";
  // A sprout on every outcome's square as the front reaches it: nothing on a square before then, something by its outcome's start; a killer plant
  // and a grown piece each at its own cue; the order the rules give.
  growth.forEach((g, i) => {
    const front = momentAt + 460 + frontMs(g.square, orientation as "white" | "black");
    const outcomeAt = momentAt + 1340 + i * 250;
    const drawn = rec.filter((r) => r.t >= momentAt - 200 && (r.drawn[g.square] ?? 0) > 0);
    expect(drawn.length, `a sprout on ${g.square}`).toBeGreaterThan(0);
    expect(drawn[0]!.t, `${g.square}: not before the front (${g.kind})`).toBeGreaterThanOrEqual(front - 90);
    expect(drawn[0]!.t, `${g.square}: up before its outcome starts`).toBeLessThanOrEqual(outcomeAt + 60);
    if (g.kind === "killer") {
      // The eaten piece is on its square until the plant's snap, 350 ms into its outcome, then off.
      const on = rec.filter((r) => r.t >= momentAt && r.t < outcomeAt + 350 - 90 && r.moment);
      expect(on.every((r) => !!r.pieces[g.square]), `${g.square}: the piece stays until the snap`).toBe(true);
      const off = rec.find((r) => r.t >= momentAt && !r.pieces[g.square]);
      expect(off, `${g.square}: the piece comes off`).toBeTruthy();
      expect(off!.t, `${g.square}: at the snap`).toBeGreaterThanOrEqual(outcomeAt + 350 - 90);
      expect(off!.t, `${g.square}: at the snap`).toBeLessThanOrEqual(outcomeAt + 350 + 250);
    }
    if (["p", "n", "b", "r", "q"].includes(g.kind)) {
      // A grown piece: not there until the bud's pop, 270 ms into its outcome, there after.
      const on = rec.find((r) => r.t >= momentAt && r.moment && r.pieces[g.square]);
      expect(on, `${g.square}: the piece comes on`).toBeTruthy();
      expect(on!.t, `${g.square}: at the pop`).toBeGreaterThanOrEqual(outcomeAt + 270 - 90);
      expect(on!.t, `${g.square}: at the pop`).toBeLessThanOrEqual(outcomeAt + 270 + 250);
      expect(on!.pieces[g.square], `${g.square}: his piece`).toContain(after.boss.crowdSide === "w" ? "black" : "white");
    }
  });
  // His cast and reaction.
  expect(rec.some((r) => r.anim === "water"), "his cast").toBe(true);
  // The plain plants stay: drawn green on their squares, in the view, on the crowd's turn after the watering.
  expect(plants.length).toBeGreaterThan(0);
  await expect.poll(async () => (await recorded(page)).at(-1)!.plants.length, { timeout: 5_000 }).toBe(plants.length);
  expect((await recorded(page)).at(-1)!.plants).toEqual(plants.map((p) => `${p.square}:green`).sort());
  // A move onto a plant, or through one, is refused: the dock says why, nothing moves, and you pick again.
  const fenNow = after.fen;
  const board = (await page.locator(".hb-board").first().boundingBox())!;
  const white = orientation === "white";
  const at = (sq: string) => ({ x: board.x + ((white ? sq.charCodeAt(0) - 97 : 104 - sq.charCodeAt(0)) + 0.5) * (board.width / 8), y: board.y + ((white ? 8 - Number(sq[1]) : Number(sq[1]) - 1) + 0.5) * (board.height / 8) });
  const stopped = new Chess(fenNow).moves({ verbose: true }).find((m) => !(after.allowed ?? []).includes(m.from + m.to) && !m.promotion);
  expect(stopped, "a move a plant stops").toBeTruthy();
  await page.mouse.click(at(stopped!.from).x, at(stopped!.from).y);
  await page.mouse.click(at(stopped!.to).x, at(stopped!.to).y);
  await expect(page.locator(".refused-note")).toHaveText("A plant is in the way.");
  expect((await state(page)).fen, "nothing moved").toBe(fenNow);
  // Another move works, and the plants go through their turns: green, then fall colors, then dropping leaves, then gone.
  const marks = (r: Rec) => r.plants.filter((x) => !x.endsWith(":gone"));
  const states: string[][] = [marks((await recorded(page)).at(-1)!)];
  for (let turn = 0; turn < 4; turn++) {
    const s = await state(page);
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
    await yourMove(page);
    await page.waitForTimeout(700);
    states.push(marks((await recorded(page)).at(-1)!));
    if (!states.at(-1)!.length) break;
  }
  const kinds = states.map((s) => [...new Set(s.map((x) => x.split(":")[1]))].join());
  expect(kinds.slice(0, 4), "green, fall, drop, gone").toEqual(["green", "fall", "drop", ""]);
  expect((await state(page)).boss.powers.garden.plants, "the plants are gone from the view after their three turns").toEqual([]);
  // A plant leaving plays its `gone`.
  expect((await recorded(page)).some((r) => r.plants.some((x) => x.endsWith(":gone"))), "gone").toBe(true);
  expect(errors).toEqual([]);
});

test("online: the meter counts by the server's clock, and a reload mid-battle keeps it and shows the plants as they are, without the watering again", async ({ page }) => {
  test.skip(!desktop(), "one run is enough: a computer");
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&mode=raid&boss=gardener&power=water&clock=60&laststand=0");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  const garden = () => page.evaluate(() => ((window as any).match.boss?.powers?.garden ?? null) as { since: number; base: number; plants: { square: string; left: number }[]; waterings: number } | null);
  await yourMove(page);
  expect(Number(await page.locator(".seed-meter").getAttribute("data-seeds")), "five at the start, on the server's clock").toBe(BOSS_POWERS.seedsAtStart);
  // Your moves until he has watered, then the crowd's turn after it.
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if ((await garden())!.waterings) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => page.evaluate(() => (window as any).match.phase.kind !== "play" || (window as any).match.boss?.powers?.garden?.waterings > 0), { timeout: 60_000 }).toBe(true);
  }
  await yourMove(page);
  const g = (await garden())!;
  expect(g.waterings).toBe(1);
  const plantsBefore = g.plants.map((p) => `${p.square}:${p.left}`).sort();
  // A reload: back in the battle on the crowd's turn, the plants as they are, no watering played again.
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await record(page);
  await page.waitForTimeout(2500);
  const rec = await recorded(page);
  expect(rec.every((r) => r.sweep === null), "no watering played again").toBe(true);
  const after = (await garden())!;
  expect(after.waterings).toBe(1);
  expect(after.plants.map((p) => `${p.square}:${p.left}`).sort()).toEqual(plantsBefore);
  expect(rec.at(-1)!.plants).toEqual(after.plants.map((p) => `${p.square}:${p.left === 3 ? "green" : p.left === 2 ? "fall" : "drop"}`).sort());
  expect(rec.at(-1)!.meter!.held, "the meter is running again from the watering").toBe(false);
  expect(errors).toEqual([]);
});

test("the seed meter in the phone's bar at 320, 360, 390 and 1280: beside the skulls and the rage meter or under them, nothing pushed, nothing sideways", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sizes = desktop() ? [[1280, 800]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto(`${BASE}&seeds=10`);
    await bossAloneFromHome(page);
    await yourMove(page);
    // His opening line is up first (it covers his name's room for its time).
    await expect(page.locator(".bc-bubble:visible")).toHaveCount(0, { timeout: 20_000 });
    const m = (await page.locator(".seed-meter").boundingBox())!;
    const bar = (await page.locator(".boss-bar").boundingBox())!;
    const name = (await page.locator(".boss-name").boundingBox())!;
    expect(m.x, `${w}: the meter inside his name's column`).toBeGreaterThanOrEqual(name.x - 1);
    expect(m.x + m.width, `${w}: the meter inside the bar`).toBeLessThanOrEqual(bar.x + bar.width);
    expect(m.y, `${w}: inside the bar`).toBeGreaterThanOrEqual(bar.y);
    expect(m.y + m.height, `${w}: inside the bar`).toBeLessThanOrEqual(bar.y + bar.height);
    await expect(page.locator(".seed-meter")).toHaveText("Seeds 10");
    expect(await page.locator(".boss-name strong").evaluate((e) => e.scrollWidth <= e.clientWidth), `${w}: "Puddles" whole`).toBe(true);
    // Nothing pushed: the bar and the board under it are where they are without the meter.
    const withMeter = await page.evaluate(() => [document.querySelector(".boss-bar")!.getBoundingClientRect().height, document.querySelector(".hb-board")!.getBoundingClientRect().top]);
    const without = await page.evaluate(() => {
      const st = document.createElement("style");
      st.textContent = ".seed-meter{display:none!important}";
      document.head.append(st);
      const r = [document.querySelector(".boss-bar")!.getBoundingClientRect().height, document.querySelector(".hb-board")!.getBoundingClientRect().top];
      st.remove();
      return r;
    });
    expect(withMeter, `${w}: the bar and the board stay put`).toEqual(without);
    // The meter's own parts, whole: icon, label and bar in one row.
    const parts = await page.locator(".seed-meter").evaluate((e) => [...e.children].map((c) => c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2));
    expect(Math.max(...parts) - Math.min(...parts), `${w}: one row`).toBeLessThanOrEqual(3);
    // The figure whole on the screen, his name clear of it (a phone).
    const fig = await page.locator(".boss-char canvas:visible").first().evaluate((c: HTMLCanvasElement) => {
      const r = c.getBoundingClientRect();
      const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, maxX = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3]! > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
      const k = r.width / c.width;
      return { left: r.left + minX * k, right: r.left + (maxX + 1) * k, seen: maxX >= 0 };
    });
    expect(fig.seen).toBe(true);
    expect(fig.left, `${w}`).toBeGreaterThanOrEqual(0);
    if (!desktop()) expect(fig.right, `${w}: his figure clear of his name`).toBeLessThanOrEqual(name.x + 1);
    expect(await sideways(page), `${w}`).toBe(0);
  }
  expect(errors).toEqual([]);
});

test("his king attack: the hose's jets on the God King in his Last Stand, his own sounds", async ({ page }) => {
  test.skip(desktop(), "one run is enough: a phone (every boss's attack, both ways: king-attack.spec.ts)");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&clock=60&brain=stockfish&boss=gardener&laststand=1");
  await page.evaluate(() => ((window as any).__soundLog = []));
  await bossAloneFromHome(page);
  await yourMove(page);
  const s = await state(page);
  const mv = new Chess(s.fen).moves({ verbose: true }).find((m) => m.piece === "n")!;
  const board = (await page.locator(".hb-board").first().boundingBox())!;
  const white = s.fen.split(" ")[1] === "w";
  const at = (sq: string) => ({ x: board.x + ((white ? sq.charCodeAt(0) - 97 : 104 - sq.charCodeAt(0)) + 0.5) * (board.width / 8), y: board.y + ((white ? 8 - Number(sq[1]) : Number(sq[1]) - 1) + 0.5) * (board.height / 8) });
  await page.mouse.click(at(mv.from).x, at(mv.from).y);
  await page.mouse.click(at(mv.to).x, at(mv.to).y);
  await expect(page.locator(".last-stand")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("play");
  const log = (await page.evaluate(() => (window as any).__soundLog as string[])).map((x) => x.split(":")[0]);
  expect(log.filter((x) => x === "gardenerJet").length, "five jets").toBe(5);
  expect(log.filter((x) => x === "gardenerSpurt").length, "five sputters").toBe(5);
  expect(errors).toEqual([]);
});

test("his long lines whole and in view at 320, 360, 390 and 1280: the entrance, his king attack's first and the plain ones", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const LONG = [GARDENER_LINES.entrance![2]!, GARDENER_LINES.kingAttack![0]!, GARDENER_LINES.hurt![2]!, GARDENER_LINES.plant![1]!, GARDENER_LINES.bigCheer![0]!];
  const sizes = desktop() ? [[1280, 800]] : [[320, 640], [360, 740], [390, 844]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w!, height: h! });
    await page.goto(BASE);
    await bossAloneFromHome(page);
    const bubble = page.locator(".bc-bubble:visible").first();
    await expect(bubble).toBeVisible({ timeout: 30_000 });
    const label = (await bubble.getAttribute("aria-label"))!;
    expect([...GARDENER_LINES.entrance!, ...GARDENER_LINES.plantMany!], `${w}`).toContain(label);
    const fits = await bubble.evaluate(
      (el, lines) => {
        const keepOff = [".board-row .hb-container", ".boss-next", ".board-area > .opening-name"];
        return lines.map((line) => {
          const c = el.cloneNode(true) as HTMLElement;
          c.classList.remove("leaving");
          c.textContent = line;
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
