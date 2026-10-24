import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { BOSS_POWERS } from "@chessroyale/core";
import { hoopStops, hoopsValid } from "@chessroyale/chess";
import { test, bossAloneFromHome, createLobbyFromHome, submitMove } from "./helpers.ts";

/**
 * Babur, the circus tiger (id tiger; docs/decisions/2026-10-23-tiger-rules.md and 2026-10-24-tiger-wired.md), played alone, the state
 * read from the game and what the page draws watched every frame:
 * - Balloons: a balloon put on the pump at the start of his turn (on a phone his hop along the bar to it and back, on a computer a limp
 *   balloon tossed from his paw), its stages on the page's clock (`?seedspeed=30`: a stage a second, never a real wait), a landing
 *   (`?balloon=pawn&stage=4`: every balloon a ready pawn, from 1.e4 d5 2.exd5 Qxd5) with its flight and his piece appearing at the
 *   landing's puff, a pop (`?balloon=fakequeen&stage=4`) and his wince.
 * - Hoops (`&power=hoops`): blocks within ranks 2 to 7, your allowed moves never crossing their walls, for exactly your next 2 moves;
 *   the cast with a hoop flying to each, three rings burning, a move through one refused with its words, dying, then out.
 * - Online: a reload mid-hoops draws the rings as they are, without the cast again. The pump's place in the bar at 320 and 1280.
 */
const desktop = () => test.info().project.name === "desktop";
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase.kind ?? "none").catch(() => "none");
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

/** Every power event the boss view shows, watched every frame (a moment can come and go between two looks). */
async function watchKinds(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__kinds = [] as string[];
    const look = () => {
      for (const e of w.match?.boss?.powers?.events ?? []) if (!w.__kinds.includes(e.kind)) w.__kinds.push(e.kind);
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
const kinds = (page: Page) => page.evaluate(() => (window as any).__kinds as string[]);

type Rec = {
  now: number;
  pump: string | null;
  pumpBox: { x: number; y: number; w: number; h: number } | null;
  bar: { anim: string; translate: string; flip: boolean; left: number; right: number } | null;
  side: string | null;
  fly: string | null;
  land: string | null;
  /** Whether a piece is drawn on the square being watched (window.__tgSquare). */
  piece: boolean | null;
  rings: string[];
  hoops: number;
  cast: boolean;
  limp: boolean;
};
/** What the page draws of him, every frame: the pump, his figure, a flight and landing, the rings, the cast. */
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__tg = [] as unknown[];
    const look = () => {
      const bar = document.querySelector<HTMLElement>(".boss-bar .boss-char.place-bar");
      const barBox = bar?.getBoundingClientRect();
      const side = document.querySelector<HTMLElement>(".boss-char.place-side");
      const slot = document.querySelector(".tg-pump-slot");
      const pump = document.querySelector(".tg-pump")?.getBoundingClientRect();
      const sq = w.__tgSquare as string | undefined;
      w.__tg.push({
        now: Date.now(),
        pump: slot?.getAttribute("data-anim") ?? null,
        pumpBox: pump && pump.width ? { x: pump.x, y: pump.y, w: pump.width, h: pump.height } : null,
        bar: bar && barBox && barBox.width ? { anim: bar.dataset.anim, translate: bar.style.translate, flip: bar.classList.contains("bc-flip"), left: barBox.left, right: barBox.right } : null,
        side: side && side.getBoundingClientRect().width ? side.dataset.anim : null,
        fly: document.querySelector(".tg-fly")?.getAttribute("data-square") ?? null,
        land: document.querySelector(".tg-land")?.getAttribute("data-square") ?? null,
        piece: sq ? !!document.querySelector(`.hb-board piece[data-square="${sq}"]:not(.fading)`) : null,
        rings: [...document.querySelectorAll(".tg-ring")].map((r) => `${r.getAttribute("data-corner")}:${r.getAttribute("data-state")}`).sort(),
        hoops: document.querySelectorAll(".tg-hoop").length,
        cast: !!document.querySelector(".pm-hoops"),
        limp: !!document.querySelector(".tg-limp"),
      });
      if (w.__tg.length > 6000) w.__tg.splice(0, 1000);
      requestAnimationFrame(look);
    };
    // (The first look now, not at the next frame: a reading straight after this has it.)
    look();
  });
}
const recorded = (page: Page) => page.evaluate(() => (window as any).__tg as Rec[]);

test("Babur: a hoops cast walls off its blocks for exactly two of your moves: the hoops thrown, three rings burning, a move through one refused, dying, then out", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&power=hoops");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  await record(page);
  const first = await state(page);
  expect(first.boss.id).toBe("tiger");
  // Your moves until he has cast (the warning as the second turn begins, the cast at the start of his turn after it).
  let before = first;
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.hoops) break;
    before = s;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  }
  await yourMove(page);
  const cast = await state(page);
  const hoops = cast.boss.powers.hoops;
  expect(hoops).toMatchObject({ left: BOSS_POWERS.hoopsCrowdMoves });
  expect(hoopsValid(hoops.blocks)).toBe(true);
  // His whole turn: no move of his after your last.
  expect(cast.history.length).toBe(before.history.length + 1);
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("hoops");
  // On screen: his cast at the board's corner, a hoop flying to each block, the rings landing one by one, then all three burning.
  await page.waitForTimeout(400);
  let rec = await recorded(page);
  expect(rec.some((r) => r.cast), "his cast").toBe(true);
  expect(Math.max(...rec.map((r) => r.hoops)), "a hoop in flight").toBeGreaterThanOrEqual(1);
  expect(rec.find((r) => r.rings.length)!.rings, "the first ring lands alone").toHaveLength(1);
  expect(rec.at(-1)!.rings).toEqual(hoops.blocks.map((c: string) => `${c}:burn`).sort());
  // A move through a ring: refused, the dock says why, nothing moves.
  const blocked = new Chess(cast.fen).moves({ verbose: true }).find((m) => !(cast.allowed ?? []).includes(m.from + m.to) && !m.promotion && hoopStops(m.from + m.to, cast.fen, hoops.blocks));
  if (blocked) {
    const board = (await page.locator(".hb-board").first().boundingBox())!;
    const white = cast.boss.crowdSide === "w";
    const at = (sq: string) => ({ x: board.x + ((white ? sq.charCodeAt(0) - 97 : 104 - sq.charCodeAt(0)) + 0.5) * (board.width / 8), y: board.y + ((white ? 8 - Number(sq[1]) : Number(sq[1]) - 1) + 0.5) * (board.height / 8) });
    await page.mouse.click(at(blocked.from).x, at(blocked.from).y);
    await page.mouse.click(at(blocked.to).x, at(blocked.to).y);
    await expect(page.locator(".refused-note")).toHaveText("A burning hoop is in the way.");
    expect((await state(page)).fen, "nothing moved").toBe(cast.fen);
  }
  // Your first move: none you may play crosses a wall.
  const allowed1 = cast.allowed ?? new Chess(cast.fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
  for (const m of allowed1) expect(hoopStops(m, cast.fen, hoops.blocks), m).toBe(false);
  const mine = quiet(cast.fen, cast.allowed);
  const c = new Chess(cast.fen);
  c.move({ from: mine.slice(0, 2), to: mine.slice(2, 4) });
  const beforeHis = c.fen();
  await submitMove(page, mine, cast.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  // Your second: still walled (his move between them too), one move left: the rings dying.
  await yourMove(page);
  const second = await state(page);
  expect(second.boss.powers.hoops).toEqual({ blocks: hoops.blocks, left: 1 });
  const his = second.history[second.history.length - 1]!;
  expect(hoopStops(his, beforeHis, hoops.blocks), his).toBe(false);
  for (const m of second.allowed ?? []) expect(hoopStops(m, second.fen, hoops.blocks), m).toBe(false);
  await expect.poll(async () => (await recorded(page)).at(-1)!.rings, { timeout: 5_000 }).toEqual(hoops.blocks.map((b: string) => `${b}:dying`).sort());
  await submitMove(page, quiet(second.fen, second.allowed), second.fen);
  await expect.poll(() => phase(page), { timeout: 10_000 }).not.toBe("play");
  // Gone as your second lands: each ring goes out, then none.
  await yourMove(page);
  const after = await state(page);
  expect(after.boss.powers.hoops).toBeNull();
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("hoopsOut");
  rec = await recorded(page);
  expect(rec.some((r) => r.rings.length > 0 && r.rings.every((x) => x.endsWith(":out"))), "the rings going out").toBe(true);
  expect(rec.at(-1)!.rings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Babur: a forced balloon lands at the end of his turn as his pawn: released from the pump, flown to its square, his piece there only from the landing's puff, then his cheer", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&balloon=pawn&stage=4");
  await bossAloneFromHome(page);
  await yourMove(page);
  await watchKinds(page);
  const first = await state(page);
  expect(first.boss.id).toBe("tiger");
  // (From 1.e4 d5 2.exd5 Qxd5: a pawn gone from each side, so a pawn of his can land.)
  expect(first.history).toEqual(["e2e4", "d7d5", "e4d5", "d8d5"]);
  expect(first.boss.powers.balloon ?? null).toBeNull();
  // (The square it lands on, watched from the frame its end is in the view.)
  await page.evaluate(() => {
    const w = window as any;
    w.__tgSquare = null;
    const look = () => {
      const l = w.match?.boss?.powers?.balloonLast;
      if (l?.square && !w.__tgSquare) w.__tgSquare = l.square;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await record(page);
  await submitMove(page, quiet(first.fen, first.allowed), first.fen);
  await yourMove(page);
  const s = await state(page);
  const last = s.boss.powers.balloonLast;
  expect(last).toMatchObject({ outcome: "land", shape: "p" });
  const his = s.boss.crowdSide === "w" ? "b" : "w";
  expect(new Chess(s.fen).get(last.square)).toMatchObject({ type: "p", color: his });
  // (Its gain by this device's engines: measured, the guards on the board as it is.)
  expect(typeof last.gain).toBe("number");
  const before = new Chess(s.fen);
  before.remove(last.square);
  expect(before.isAttacked(last.square, s.boss.crowdSide)).toBe(false);
  expect(new Chess(s.fen).inCheck()).toBe(false);
  expect(s.boss.powers.balloons).toMatchObject({ landed: 1, popped: 0 });
  await expect.poll(() => kinds(page), { timeout: 10_000 }).toContain("balloonLand");
  // On screen: the pump's release, the flight to the square, the landing there, his piece drawn only from the landing's puff.
  await page.waitForTimeout(2600);
  const rec = await recorded(page);
  expect(rec.some((r) => r.pump === "releasePawn"), "the release").toBe(true);
  const fly = rec.filter((r) => r.fly === last.square);
  const land = rec.filter((r) => r.land === last.square);
  expect(fly.length, "the flight").toBeGreaterThan(3);
  expect(land.length, "the landing").toBeGreaterThan(3);
  expect(fly.every((r) => r.piece === false), "no piece on the square while the balloon flies").toBe(true);
  const landAt = land[0]!.now;
  expect(rec.filter((r) => r.land && r.now < landAt + 400).every((r) => r.piece === false), "none as it drifts down").toBe(true);
  expect(land.some((r) => r.piece), "his piece under the puff").toBe(true);
  expect(rec.at(-1)!.piece, "his piece there").toBe(true);
  // (Before his move shows, nothing of it: the square stays empty from the moment the end is in the view.)
  expect(rec.filter((r) => r.piece !== null && r.now < landAt).every((r) => r.piece === false)).toBe(true);
  // His cheer where he stands (the bar on a phone, by the board on a computer).
  expect(rec.some((r) => (desktop() ? r.side : r.bar?.anim) === "cheer"), "his cheer").toBe(true);
  expect(rec.at(-1)!.pump, "the nozzle bare after").toBe("bare");
  expect(errors).toEqual([]);
});

test("Babur: a fake queen pops on the pump at the end of his turn, and he winces", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&balloon=fakequeen&stage=4");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  const first = await state(page);
  await submitMove(page, quiet(first.fen, first.allowed), first.fen);
  await yourMove(page);
  const s = await state(page);
  expect(s.boss.powers.balloonLast).toMatchObject({ outcome: "pop", shape: "q" });
  expect(s.boss.powers.balloons).toMatchObject({ landed: 0, popped: 1 });
  await page.waitForTimeout(1600);
  const rec = await recorded(page);
  expect(rec.some((r) => r.pump === "pop4Queen"), "the pop").toBe(true);
  expect(rec.some((r) => r.fly || r.land), "nothing flies").toBe(false);
  expect(rec.some((r) => (desktop() ? r.side : r.bar?.anim) === "wince"), "his wince").toBe(true);
  expect(rec.at(-1)!.pump).toBe("bare");
  expect(errors).toEqual([]);
});

test("Babur: a balloon put on the pump at the start of his turn (a phone: his hop along the bar and back; a computer: a limp balloon tossed from his paw), then its stages from the page's clock", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // (The page's clock 30 times faster: a stage a second.)
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&seedspeed=30");
  await bossAloneFromHome(page);
  await yourMove(page);
  await record(page);
  await watchKinds(page);
  expect((await recorded(page)).at(-1)!.pump, "the nozzle bare before his first turn").toBe("bare");
  const first = await state(page);
  await submitMove(page, quiet(first.fen, first.allowed), first.fen);
  await expect.poll(() => kinds(page), { timeout: 30_000 }).toContain("place");
  await page.waitForTimeout(7000);
  const rec = await recorded(page);
  const b = (await state(page)).boss.powers.balloon;
  expect(b, "a balloon on the nozzle").toBeTruthy();
  const piece = ({ p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen" } as Record<string, string>)[b.shape]!;
  if (desktop()) {
    expect(rec.some((r) => r.side === "place"), "his place where he stands").toBe(true);
    expect(rec.some((r) => r.limp), "the limp balloon tossed to the pump").toBe(true);
    expect(rec.every((r) => !r.bar)).toBe(true);
  } else {
    const trip = rec.filter((r) => r.bar && r.bar.translate);
    expect(rec.some((r) => r.bar?.anim === "hopTrip"), "his hop").toBe(true);
    expect(trip.length, "carried along the bar").toBeGreaterThan(5);
    expect(trip.some((r) => r.bar!.flip), "facing the pump").toBe(true);
    // At the pump: beside it, inside the screen; home again after.
    const at = trip.filter((r) => r.bar!.anim === "place");
    expect(at.length, "his place beside the pump").toBeGreaterThan(3);
    const pumpX = rec.find((r) => r.pumpBox)!.pumpBox!.x;
    for (const r of at) {
      expect(r.bar!.right, "beside the pump").toBeGreaterThan(pumpX - 30);
      expect(r.bar!.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
    expect(rec.at(-1)!.bar!.translate, "home again").toBe("");
  }
  // The pump: bare until the put, then the limp balloon, then each stage stepping up on the clock, then ready, bobbing.
  const anims = [...new Set(rec.map((r) => r.pump))];
  const i = (a: string) => anims.indexOf(a);
  expect(i(`put${piece}`), JSON.stringify(anims)).toBeGreaterThan(i("bare"));
  expect(i(`grow2${piece}`), JSON.stringify(anims)).toBeGreaterThan(i(`put${piece}`));
  expect(i(`grow3${piece}`), JSON.stringify(anims)).toBeGreaterThan(i(`grow2${piece}`));
  expect(i(`grow4${piece}`), JSON.stringify(anims)).toBeGreaterThan(i(`grow3${piece}`));
  expect(i(`ready${piece}`), JSON.stringify(anims)).toBeGreaterThan(i(`grow4${piece}`));
  expect(errors).toEqual([]);
});

test("Babur's pump in the bar at 320 and 1280: inside the bar's free room, clear of the status (a phone's at its right end, a computer's at its left), nothing sideways", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const [w, h] = desktop() ? [1280, 800] : [320, 640];
  await page.setViewportSize({ width: w, height: h });
  // (A queen put on at stage 3, the page's clock 30 times faster: not due as his turn's work is asked for, so it stays, and is ready
  // a couple of seconds into your turn: the tallest balloon.)
  await page.goto("/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=tiger&balloon=queen&stage=3&seedspeed=30");
  await bossAloneFromHome(page);
  await yourMove(page);
  const first = await state(page);
  await submitMove(page, quiet(first.fen, first.allowed), first.fen);
  await yourMove(page);
  await expect(page.locator(".tg-pump-slot")).toHaveAttribute("data-anim", "readyQueen", { timeout: 10_000 });
  const pump = (await page.locator(".tg-pump").boundingBox())!;
  const bar = (await page.locator(".boss-bar").boundingBox())!;
  const room = (await page.locator(".boss-prop").boundingBox())!;
  const status = (await page.locator(".boss-next").boundingBox())!;
  expect(pump.x).toBeGreaterThanOrEqual(room.x - 1);
  expect(pump.x + pump.width).toBeLessThanOrEqual(room.x + room.width + 1);
  expect(pump.y + pump.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
  expect(pump.y, "inside the bar").toBeGreaterThanOrEqual(bar.y);
  // Clear of the status: under it on a phone, left of it on a computer.
  expect(pump.y >= status.y + status.height || pump.x + pump.width <= status.x).toBe(true);
  if (desktop()) expect(pump.x - room.x, "a computer's at the room's left end").toBeLessThan(6);
  else expect(room.x + room.width - (pump.x + pump.width), "a phone's at the room's right end").toBeLessThan(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(errors).toEqual([]);
});

test("Babur online: a reload mid-hoops draws the rings as they are, without the cast again", async ({ page }) => {
  test.skip(!desktop(), "one run is enough: a computer");
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?debug&pace=quick&mode=raid&boss=tiger&power=hoops&clock=60&laststand=0");
  await createLobbyFromHome(page);
  await page.getByRole("button", { name: /^Start with 1 player$/ }).click();
  for (let i = 0; i < 6; i++) {
    await yourMove(page);
    const s = await state(page);
    if (s.boss.powers.hoops) break;
    await submitMove(page, quiet(s.fen, s.allowed), s.fen);
    await expect.poll(() => page.evaluate(() => (window as any).match.phase.kind !== "play" || !!(window as any).match.boss?.powers?.hoops), { timeout: 60_000 }).toBe(true);
  }
  await yourMove(page);
  const hoops = (await state(page)).boss.powers.hoops;
  expect(hoops).toMatchObject({ left: 2 });
  await page.reload();
  await expect.poll(() => phase(page), { timeout: 60_000 }).toBe("play");
  await record(page);
  await page.waitForTimeout(2000);
  const rec = await recorded(page);
  expect(rec.every((r) => !r.cast && r.hoops === 0), "no cast again").toBe(true);
  expect(rec.at(-1)!.rings).toEqual(hoops.blocks.map((b: string) => `${b}:burn`).sort());
  expect(errors).toEqual([]);
});
