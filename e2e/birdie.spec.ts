import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import sharp from "sharp";
import { BIRDIE_BEATS } from "@chessroyale/chess";
import { BIRDIE_SIGN } from "@chessroyale/core";
import { asAdmin, openBossRaid, pickMove, submitMove, test } from "./helpers.ts";

/**
 * Birdie (id birdie), played alone as an admin (he's in the game for admins first), the state read from the game and what's on screen
 * read from the page every frame (docs/decisions/2026-11-23-birdie-rules.md, 2026-11-23-birdie-fall.md):
 * - The Train (?power=train: warned every turn from your second): the crossing lights on his line, the dock names your piece ("Move
 *   your knight!"), a see-through warning sign over it (Nov 23); moving that piece saves it (the sign gone with it), and his train still
 *   rides the line and misses (Eric, Nov 24): the train crosses the board, nothing hit, the board the same after; leaving it, his train
 *   rides the line at the start of his turn and smashes it: the train on the board, the piece gone.
 * - The Fall (?power=fall: after your second move): his fall's cutscene (the fall, the approach to its hit, the reveal, the hold) over
 *   the board as he "thinks", then Armored Birdie in the boss bar (his powered twin's loops, `p_`) for the rest of the battle, and no
 *   train warns again.
 * His tile and the rest of his kit: boss-smoke.spec.ts.
 */
const phase = (p: Page) => p.evaluate(() => (window as any).match?.phase?.kind ?? "none").catch(() => "none");
const NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

async function yourMove(page: Page) {
  await expect.poll(() => phase(page), { timeout: 90_000 }).toBe("play");
  await expect.poll(() => page.evaluate(() => Date.now() >= (window as any).match.phase.startsAt + 300), { timeout: 10_000 }).toBe(true);
}

/** Every frame from now on: his state, the crossing, the train, the dock's words, the cutscene's picture and his bar's animation. */
async function record(page: Page) {
  fetched.delete(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__bd = [] as any[];
    const look = () => {
      const m = w.match;
      const p = m?.boss?.powers;
      const bd = p?.birdie ?? null;
      const train = document.querySelector<HTMLElement>(".bd-train");
      const sign = document.querySelector<HTMLElement>(".bd-sign");
      w.__bd.push({
        t: Date.now(),
        phase: m?.phase?.kind ?? null,
        turn: p?.turn ?? null,
        crowdMoves: m?.boss?.crowdMoves ?? null,
        fen: m?.boss?.board?.fen ?? null,
        // (The position the screen shows: the phase's, the runner's live one already has his reply while his thinking still plays.)
        shown: (m?.phase?.boss ?? m?.boss)?.board?.fen ?? null,
        warn: bd?.warn ?? null,
        ride: bd?.ride ?? null,
        fell: bd?.fell ?? null,
        // (His fall's impact, his music's drop, on this device's clock (BirdieView.turnAt), and the moves played so far.)
        drop: (m?.phase?.boss ?? m?.boss)?.powers?.birdie?.turnAt?.dropAt ?? null,
        plies: (m?.phase?.boss ?? m?.boss)?.board?.history?.length ?? null,
        events: (p?.events ?? []).map((e: { kind: string }) => e.kind),
        crossing: !!document.querySelector(".fx-board.bd-crossing"),
        // (The warning sign: its square, its opacity, the piece drawn on its square in this same frame (the board's, or his layer's during
        // the ride) and its middle against that piece's, px.)
        sign: sign ? (() => {
          const sq = sign.dataset.square!;
          const r = sign.getBoundingClientRect();
          const el = document.querySelector(`.hb-board piece[data-square="${sq}"]`) ?? document.querySelector(`.bd-pieces piece[data-square="${sq}"]`);
          const pc = el?.getBoundingClientRect();
          // (Its drawing in its square, Nov 24: its width, and its gaps to the square's right and top, in squares.)
          const g = sign.querySelector("svg")!.getBoundingClientRect();
          const mark = { w: g.width / r.width, right: (r.right - g.right) / r.width, top: (g.top - r.top) / r.height };
          const cs = getComputedStyle(sign);
          return { sq, opacity: Number(cs.opacity), vis: cs.visibility, held: sign.hasAttribute("data-held"), mark, on: el?.className ?? null, off: pc ? Math.max(Math.abs(r.x + r.width / 2 - pc.x - pc.width / 2), Math.abs(r.y + r.height / 2 - pc.y - pc.height / 2), Math.abs(r.width - pc.width)) : null };
        })() : null,
        train: train ? (() => {
          const r = train.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
        })() : null,
        // (The line's pieces his layer draws while the train rides, and how many it should: every piece on the line in the rules'
        // position but a king, and the smashed one.)
        aside: document.querySelectorAll(".bd-pieces piece").length,
        lineCount: (() => {
          const r = bd?.ride;
          const fen = m?.boss?.board?.fen as string | undefined;
          if (!r || !fen) return null;
          const rows = fen.split(" ")[0]!.split("/").map((row) => row.replace(/\d/g, (d) => ".".repeat(Number(d))));
          const at = (sq: string) => rows[8 - Number(sq[1])]![sq.charCodeAt(0) - 97]!;
          return (r.squares as string[]).filter((sq) => at(sq) !== "." && at(sq).toLowerCase() !== "k").length + (r.spared || r.king || r.missed ? 0 : 1);
        })(),
        through: document.querySelector(".boss-dock .through-note")?.textContent?.trim() ?? null,
        // (The dock's first line, and whether it's cut short; the smash's effect on the board; the drawn board's pieces, square:color kind.)
        dock: (() => {
          const el = document.querySelector<HTMLElement>(".boss-dock .dock-line");
          return el ? { text: el.textContent?.trim() ?? "", cut: el.scrollWidth > el.clientWidth + 1, sw: el.scrollWidth, cw: el.clientWidth } : null;
        })(),
        smash: !!document.querySelector(".fx-board.bd-fx"),
        drawn: [...document.querySelectorAll<HTMLElement>(".hb-board piece[data-square]")]
          .map((e) => {
            const c = e.className.split(/\s+/);
            return `${e.dataset.square}:${c.find((x) => x === "white" || x === "black")} ${c.find((x) => /^(pawn|knight|bishop|rook|queen|king)$/.test(x))}`;
          })
          .sort()
          .join(","),
        cine: document.querySelector<HTMLElement>(".bd-cine")?.dataset.pic ?? null,
        bar: document.querySelector(".boss-char.place-bar")?.getAttribute("data-anim") ?? null,
        moments: [...document.querySelectorAll(".power-moment")].map((e) => e.className.replace("power-moment", "").trim()),
      });
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}
type Frame = {
  t: number;
  phase: string | null;
  turn: number | null;
  crowdMoves: number | null;
  fen: string | null;
  shown: string | null;
  warn: { turn: number; line: string; square: string; piece: string } | null;
  ride: { at: number; line: string; square: string; piece: string; spared?: true; king?: true; missed?: true } | null;
  fell: number | null;
  drop: number | null;
  plies: number | null;
  events: string[];
  crossing: boolean;
  sign: { sq: string; opacity: number; vis: string; held: boolean; mark: { w: number; right: number; top: number }; on: string | null; off: number | null } | null;
  train: { x: number; y: number; w: number } | null;
  aside: number;
  lineCount: number | null;
  through: string | null;
  dock: { text: string; cut: boolean; sw: number; cw: number } | null;
  smash: boolean;
  drawn: string;
  cine: string | null;
  bar: string | null;
  moments: string[];
};
/**
 * The frames so far: only the ones since the last call are copied out of the page, the rest kept here (the recording only grows). Copying
 * all of it each time stalled the page's main thread longer as it grew (about 150 ms each poll a minute in, on this computer; over 400 on
 * a busy CI runner, Nov 27), and a stall on his fall's hit put its reveal's first frame that much late.
 */
const fetched = new WeakMap<Page, Frame[]>();
async function recorded(page: Page): Promise<Frame[]> {
  const have = fetched.get(page) ?? [];
  const more = await page.evaluate((from) => ((window as any).__bd as Frame[]).slice(from), have.length);
  const all = [...have, ...more];
  fetched.set(page, all);
  return all;
}

async function battle(page: Page, power: string) {
  await asAdmin(page);
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=birdie&power=${power}&mode=raid`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await yourMove(page);
  await record(page);
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("birdie");
}

/**
 * The warned piece drawn whole over the crossing (the review of #896: the crossing is the board's layer, under the pieces): its square
 * as shown, the crossing hidden, then the piece hidden too. Where the piece is drawn (the second and third differ), the first must show
 * it as the second (anti-aliased edges aside; measured Nov 23: 0.97 of it the same, 0.55 with the crossing over it).
 */
async function pieceOverCrossing(page: Page, square: string): Promise<number> {
  const piece = page.locator(`.hb-board piece[data-square="${square}"]`);
  const box = (await piece.boundingBox())!;
  const shot = async () => sharp(await page.screenshot({ clip: box, animations: "disabled" })).raw().toBuffer();
  const hide = (sel: string, v: string) => page.evaluate(([q, vis]) => document.querySelectorAll<HTMLElement>(q!).forEach((e) => (e.style.visibility = vis!)), [sel, v]);
  const both = await shot();
  await hide(".fx-board.bd-crossing", "hidden");
  const alone = await shot();
  await hide(`.hb-board piece[data-square="${square}"]`, "hidden");
  const bare = await shot();
  await hide(".fx-board.bd-crossing", "");
  await hide(`.hb-board piece[data-square="${square}"]`, "");
  let drawn = 0;
  let same = 0;
  const near = (a: Buffer, b: Buffer, i: number, d: number) => Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) <= d;
  for (let i = 0; i < alone.length; i += 3) {
    if (near(alone, bare, i, 90)) continue;
    drawn++;
    if (near(both, alone, i, 24)) same++;
  }
  expect(drawn, "the piece drawn on its square").toBeGreaterThan(50);
  return same / drawn;
}

/** Your turn now: the position, the moves allowed, his warning if it's for this turn, and the crowd moves made so far. */
const yourTurn = (page: Page) =>
  page.evaluate(() => {
    const m = (window as any).match;
    if (m.phase.kind !== "play" || Date.now() < m.phase.startsAt + 300) return null;
    const p = m.boss?.powers;
    const warn = p?.birdie?.warn && p.birdie.warn.turn === p.turn ? (p.birdie.warn as { square: string; piece: string }) : null;
    return { fen: m.phase.board.fen as string, allowed: (p?.allowed ?? null) as string[] | null, warn, crowdMoves: m.boss.crowdMoves as number };
  });

/** A move that lets him mate at once is never played (pickMove); `from`: only this piece's moves; `not`: never this piece's. */
const moveOf = (fen: string, allowed: string[] | null, only?: { from?: string; not?: string }) => {
  const legal = new Chess(fen).moves({ verbose: true }).map((m) => m.lan).filter((m) => !allowed || allowed.includes(m));
  const ok = legal.filter((m) => (!only?.from || m.startsWith(only.from)) && (!only?.not || !m.startsWith(only.not)));
  return pickMove(fen, { allowed: ok.length ? ok : legal, prefer: (m) => m.piece === "n" });
};

test("Birdie's train: the crossing on his line, the dock names your piece, a sign over it; moved, it's saved; left, his train rides the line and smashes it", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await battle(page, "train");
  // Your first warned piece moved (saved); the next warned one that isn't your king left on its square (smashed, or spared when the
  // rules can't take it: then the next). Your king, when warned, always moves.
  let saved: { at: number; square: string; piece: string } | null = null;
  let left: { at: number; square: string; piece: string } | null = null;
  const played = new Set<string>();
  let whole: number | null = null;
  const smashed = (f: Frame[]) => !!left && f.some((r) => r.ride?.at === left!.at && !r.ride.spared);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const rec = await recorded(page);
    if (smashed(rec) && (await phase(page)) === "play") break;
    if ((await phase(page)) === "results") break;
    const s = await yourTurn(page);
    if (s && !played.has(s.fen)) {
      played.add(s.fen);
      let move: string;
      // (The first warning: once its crossing shows, your piece drawn whole over it.)
      if (s.warn && whole === null) {
        await expect(page.locator(".fx-board.bd-crossing")).toBeVisible({ timeout: 5_000 });
        await page.waitForTimeout(800);
        whole = await pieceOverCrossing(page, s.warn.square);
      }
      if (s.warn && (!saved || s.warn.piece === "k")) {
        move = moveOf(s.fen, s.allowed, { from: s.warn.square });
        if (!saved && move.startsWith(s.warn.square)) saved = { at: s.crowdMoves + 1, square: s.warn.square, piece: s.warn.piece };
      } else if (s.warn) {
        move = moveOf(s.fen, s.allowed, { not: s.warn.square });
        if (!move.startsWith(s.warn.square)) left = { at: s.crowdMoves + 1, square: s.warn.square, piece: s.warn.piece };
      } else move = moveOf(s.fen, s.allowed);
      await submitMove(page, move, s.fen);
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(500);
  const rec = await recorded(page);
  expect(saved, "a warned piece moved").toBeTruthy();
  expect(smashed(rec), `a warned piece left and smashed: ${JSON.stringify(left)}`).toBe(true);

  // The warning: on your warned turn, his crossing over the board and the dock naming your piece.
  const warned = rec.filter((r) => r.phase === "play" && r.warn && r.warn.turn === r.turn);
  expect(warned.length).toBeGreaterThan(10);
  expect(warned.filter((r) => r.crossing).length / warned.length, "the crossing on his line through your turn").toBeGreaterThan(0.9);
  expect(warned.some((r) => r.through === `Move your ${NAMES[r.warn!.piece]}!`), `the dock names your piece: ${[...new Set(warned.map((r) => r.through))]}`).toBe(true);
  // (Your warned piece over the crossing, never under it: the crossing is the board's layer, as Grex's shadows.)
  expect(whole, "the warned piece drawn whole over the crossing").toBeGreaterThan(0.9);
  // Never a crossing when no warning is for your turn.
  expect(rec.filter((r) => r.phase === "play" && !r.warn && !r.moments.length).every((r) => !r.crossing), "no crossing without a warning").toBe(true);
  // The warning sign (Eric, Nov 23; redone Nov 24): on your marked piece's square whenever the crossing shows on your warned turn, on it
  // to the pixel; never on a square without one of your pieces drawn on it this same frame (the board's, or his layer's during the ride),
  // so gone the moment that piece moves; and gone after the move that saved it.
  const lit = warned.filter((r) => r.crossing);
  expect(lit.filter((r) => r.sign?.sq === r.warn!.square).length / lit.length, "the sign on the marked piece while its line is lit").toBeGreaterThan(0.95);
  const signs = rec.filter((r) => r.sign);
  // (Old, Nov 23: see-through, 60 to 80% opaque in a slow pulse. Nov 24: opaque, a hard blink with no fade, every frame fully on or fully
  // off; small in its square's top-right corner, about a third of it.)
  expect([...new Set(signs.map((r) => r.sign!.opacity))].sort(), "opaque, blinking on and off, never between").toEqual([0, 1]);
  const mark = signs[0]!.sign!.mark;
  expect(mark.w, "its width, in squares").toBeGreaterThan(0.3);
  expect(mark.w).toBeLessThan(0.42);
  expect(Math.max(mark.right, mark.top), "in the square's top-right corner").toBeLessThan(0.06);
  expect(Math.max(...lit.map((r) => r.sign?.off ?? 0)), "the sign on its square (px)").toBeLessThanOrEqual(1.5);
  const yours = (await page.evaluate(() => (window as any).match.boss.crowdSide)) === "w" ? "white" : "black";
  const stray = signs.filter((r) => !r.sign!.on?.split(" ").includes(yours));
  expect(stray.map((r) => `${r.sign!.sq} (${r.sign!.on}) at ${r.crowdMoves}`), "the sign only ever over a piece of yours").toEqual([]);
  // (After the saving move, past its render's frame: no sign left on the square it left.)
  const movedOn = rec.filter((r) => r.crowdMoves === saved!.at).slice(2);
  expect(movedOn.length, "frames after the saved piece moved").toBeGreaterThan(5);
  expect(movedOn.filter((r) => r.sign?.sq === saved!.square).length, "the sign gone once its piece moved").toBe(0);

  // Saved: his train still rides after that move, and misses (Nov 24; its whole check: "Birdie's train when you saved the piece").
  expect(rec.find((r) => r.ride?.at === saved!.at)?.ride, "a miss ride for the piece you moved").toMatchObject({ square: saved!.square, missed: true });

  // The smash: his train on the board through its ride, then your piece gone from its square.
  const ride = rec.filter((r) => r.ride?.at === left!.at);
  expect(ride[0]!.ride).toMatchObject({ square: left!.square, piece: left!.piece });
  expect(ride.some((r) => r.events.includes("trainSmash"))).toBe(true);
  // (The dock's line through the smash, whole on the phone after "Birdie: ", Nov 24: "His train hit your knight." was cut short.)
  const smashSaid = ride.filter((r) => r.dock?.text === `Birdie: ${NAMES[left!.piece]![0]!.toUpperCase()}${NAMES[left!.piece]!.slice(1)} smashed!`);
  expect(smashSaid.length, `the dock's line: ${[...new Set(ride.map((r) => r.dock?.text))]}`).toBeGreaterThan(5);
  expect(smashSaid.filter((r) => r.dock!.cut).map((r) => r.dock).slice(0, 1), "the dock's line cut short").toEqual([]);
  const onBoard = rec.filter((r) => r.train && r.t >= ride[0]!.t);
  expect(onBoard.length, "the train on the board").toBeGreaterThan(5);
  // (It moves: its place on screen changes through the ride.)
  expect(new Set(onBoard.map((r) => `${r.train!.x},${r.train!.y}`)).size).toBeGreaterThan(3);
  // (Smooth, Nov 23: it moves on every frame of its whole ride (BIRDIE_BEATS.ride.rideMs, 1.95 s since Eric's "slow the train a bit
  // down", was 1.3 s), never crossing in half that and standing still past the board's edge, as when his layer set its animation's delay
  // again every frame: 38 frames still, measured.)
  const rideRec = onBoard.filter((r) => r.ride?.at === left!.at);
  const still = rideRec.slice(1).filter((r, i) => r.train!.x === rideRec[i]!.train!.x && r.train!.y === rideRec[i]!.train!.y).length;
  expect(still, "frames the train stood still in its ride").toBeLessThanOrEqual(2);
  // (Old: over 1 s of a 1.3 s ride; now over 1.6 s of 1.95 s.)
  expect(rideRec.at(-1)!.t - rideRec[0]!.t, "the train's ride on screen").toBeGreaterThan(1_600);
  // Every piece on the line drawn by his layer as the ride starts (the board has them off), none lost (Nov 23: his own were, read
  // from the drawn board).
  expect(onBoard[0]!.aside, `the line's pieces as the ride starts: ${onBoard[0]!.aside} of ${onBoard[0]!.lineCount}`).toBe(onBoard[0]!.lineCount);
  const crowd = (await page.evaluate(() => (window as any).match.boss.crowdSide)) as "w" | "b";
  const after = new Chess(ride[0]!.fen!).get(left!.square as any);
  expect(!!after && after.color === crowd && after.type === left!.piece, `your ${NAMES[left!.piece]} gone from ${left!.square}`).toBe(false);
  // And the train gone again once your turn is back.
  expect(rec.at(-1)!.phase).toBe("play");
  expect(rec.at(-1)!.train).toBeNull();
  expect(errors).toEqual([]);
});

/**
 * The warning sign held (Eric, Nov 24): a tap on its spot (its drawing, in the square's top-right corner) picks the piece under it up (the
 * sign takes no tap) and the sign is hidden while it's held; a tap on the piece again sets it down, and the sign blinks again. Then it
 * blinks on for three of its beats before the test moves on (the recorder reads its blink).
 */
async function signHeld(page: Page, square: string) {
  const sign = page.locator(`.bd-sign[data-square="${square}"]`);
  await expect(sign).toHaveCount(1, { timeout: 10_000 });
  const tap = async (x: number, y: number) => (test.info().project.name === "phone" ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const selected = () =>
    page.evaluate((sq) => {
      const piece = document.querySelector<HTMLElement>(`.hb-board piece[data-square="${sq}"]`);
      const sel = document.querySelector<HTMLElement>(".hb-board square.selected");
      return !!piece && !!sel && sel.style.transform === piece.style.transform;
    }, square);
  const spot = (await sign.locator("svg").boundingBox())!;
  await tap(spot.x + spot.width / 2, spot.y + spot.height / 2);
  await expect.poll(selected, { timeout: 5_000 }).toBe(true);
  await expect(sign).toHaveAttribute("data-held", "");
  await expect(sign).toHaveCSS("visibility", "hidden");
  await page.waitForTimeout(800);
  const piece = (await page.locator(`.hb-board piece[data-square="${square}"]`).boundingBox())!;
  await tap(piece.x + piece.width / 2, piece.y + piece.height / 2);
  await expect.poll(selected, { timeout: 5_000 }).toBe(false);
  await expect(sign).not.toHaveAttribute("data-held");
  await expect(sign).toHaveCSS("visibility", "visible");
  await page.waitForTimeout(3 * BIRDIE_SIGN.blinkMs);
}

/** The drawn board's pieces for a position (`fen`), as the recorder writes them (`drawn`). */
const drawnOf = (fen: string) =>
  new Chess(fen)
    .board()
    .flat()
    .flatMap((p) => (p ? [`${p.square}:${p.color === "w" ? "white" : "black"} ${NAMES[p.type]}`] : []))
    .sort()
    .join(",");

test("Birdie's train when you saved the piece (Eric, Nov 24): it still rides the line and misses, nothing hit, the board the same after", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await battle(page, "train");
  // Your first warned piece moved (saved); then play on until your turn after his reply.
  let saved: { at: number; square: string; piece: string; fen: string } | null = null;
  const played = new Set<string>();
  const deadline = Date.now() + 110_000;
  while (Date.now() < deadline) {
    if ((await phase(page)) === "results") break;
    const s = await yourTurn(page);
    if (s && saved && s.crowdMoves >= saved.at) break;
    if (s && !played.has(s.fen)) {
      played.add(s.fen);
      const move = moveOf(s.fen, s.allowed, s.warn ? { from: s.warn.square } : undefined);
      if (s.warn && !saved && move.startsWith(s.warn.square)) {
        await signHeld(page, s.warn.square);
        const after = new Chess(s.fen);
        after.move({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) });
        saved = { at: s.crowdMoves + 1, square: s.warn.square, piece: s.warn.piece, fen: after.fen() };
      }
      await submitMove(page, move, s.fen);
    }
    await page.waitForTimeout(200);
  }
  expect(saved, "a warned piece moved").toBeTruthy();
  const rec = await recorded(page);
  // His train rides the warned line after your saving move: a miss.
  const ride = rec.filter((r) => r.ride?.at === saved!.at);
  expect(ride[0]!.ride).toMatchObject({ square: saved!.square, piece: saved!.piece, missed: true });
  expect(ride.some((r) => r.events.includes("trainSmash"))).toBe(true);
  // (Until his reply lands: the frames of his turn.)
  const plies = ride[0]!.plies!;
  const turn = ride.filter((r) => r.plies === plies);
  // The train crosses the board: on it, moving on every frame of its ride, from one edge to past the other along the line.
  const onBoard = turn.filter((r) => r.train);
  expect(onBoard.length, "the train on the board").toBeGreaterThan(20);
  const file = /^[a-h]$/.test(ride[0]!.ride!.line);
  const along = onBoard.map((r) => (file ? r.train!.y : r.train!.x));
  const size = (await page.locator(".hb-board").boundingBox())!.width;
  expect(Math.max(...along) - Math.min(...along), "the train's travel along its line (px)").toBeGreaterThan(size * 0.8);
  const still = onBoard.slice(1).filter((r, i) => r.train!.x === onBoard[i]!.train!.x && r.train!.y === onBoard[i]!.train!.y).length;
  expect(still, "frames the train stood still in its ride").toBeLessThanOrEqual(2);
  expect(onBoard.at(-1)!.t - onBoard[0]!.t, "the train's ride on screen").toBeGreaterThan(1_600);
  // Everything misses: every piece on the line drawn stepping aside as it starts, none smashed; no sign, no smash, through his turn.
  expect(onBoard[0]!.aside, `the line's pieces as the ride starts: ${onBoard[0]!.aside} of ${onBoard[0]!.lineCount}`).toBe(onBoard[0]!.lineCount);
  expect(turn.filter((r) => r.sign).length, "no warning sign on a miss").toBe(0);
  expect(turn.filter((r) => r.smash).length, "no smash on a miss").toBe(0);
  // The dock says nothing was hit, whole on the screen.
  const said = turn.filter((r) => r.dock?.text === "Birdie: Nothing hit!");
  expect(said.length, `the dock's line: ${[...new Set(turn.map((r) => r.dock?.text))]}`).toBeGreaterThan(5);
  expect(said.filter((r) => r.dock!.cut).length, `the dock's line cut short: ${JSON.stringify(said.find((r) => r.dock!.cut)?.dock)}`).toBe(0);
  // The board the same after: the game's position through his turn is the one your move left, and once the train has gone the board
  // draws exactly it, before his reply.
  const placement = (fen: string) => fen.split(" ")[0];
  const odd = turn.filter((r) => placement(r.shown!) !== placement(saved!.fen));
  expect(odd.map((r) => `${r.t - ride[0]!.t} ms ${r.shown}`).slice(0, 3), `the position your move left (${saved!.fen}), through the ride`).toEqual([]);
  const gone = turn.slice(turn.findLastIndex((r) => r.train) + 1).slice(3);
  expect(gone.length, "frames after the train has gone, before his reply").toBeGreaterThan(5);
  expect(gone.filter((r) => r.drawn !== drawnOf(saved!.fen)).map((r) => r.drawn).slice(0, 1), "the board after the ride").toEqual([]);
  // The sign on the warned turn (Eric, Nov 24): a hard blink, about 0.6 s on and 0.6 s off (BIRDIE_SIGN.blinkMs), never between; hidden
  // in every frame its piece was held (signHeld picked it up and set it down), shown in every other.
  const warnedTurn = rec.filter((r) => r.phase === "play" && r.sign && r.crowdMoves === saved!.at - 1);
  expect(warnedTurn.every((r) => (r.sign!.held ? r.sign!.vis === "hidden" : r.sign!.vis === "visible")), "hidden only while held").toBe(true);
  expect(warnedTurn.some((r) => r.sign!.held), "held for a while").toBe(true);
  const free = warnedTurn.filter((r) => !r.sign!.held);
  // (Its on and off runs in each unbroken stretch of frames, each from its first frame to the next run's; the first and last of a stretch
  // are cut off by it, so only the whole ones between count.)
  const whole: number[] = [];
  let stretch: Frame[] = [];
  for (const r of [...free, null]) {
    if (r && (!stretch.length || r.t - stretch.at(-1)!.t < 100)) {
      stretch.push(r);
      continue;
    }
    const starts = stretch.filter((x, i) => i === 0 || x.sign!.opacity !== stretch[i - 1]!.sign!.opacity).map((x) => x.t);
    for (let i = 1; i + 1 < starts.length; i++) whole.push(starts[i + 1]! - starts[i]!);
    stretch = r ? [r] : [];
  }
  expect(whole.length, "whole blinks seen").toBeGreaterThan(2);
  expect(whole.every((ms) => ms > BIRDIE_SIGN.blinkMs / 2 - 150 && ms < BIRDIE_SIGN.blinkMs / 2 + 150), `on and off runs: ${whole}`).toBe(true);
  // His reply only after the ride's whole length, as on a smash.
  const reply = rec.find((r) => r.t > ride[0]!.t && r.plies !== null && r.plies > plies);
  expect(reply, "his reply").toBeTruthy();
  expect(reply!.t - ride[0]!.t, "his reply after the ride").toBeGreaterThanOrEqual(BIRDIE_BEATS.ride.total - 300);
  expect(errors).toEqual([]);
});

test("Birdie's fall: his cutscene plays as he thinks (the fall, the approach, the reveal, the hold), then Armored Birdie in the bar, and his train warns again", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await battle(page, "fall");
  const played = new Set<string>();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const rec = await recorded(page);
    // (Two of your turns after the cutscene, Armored Birdie at rest in them, and his train's next warning, on a turn after his fall.)
    const end = rec.findLastIndex((r) => r.cine);
    const fell = rec.find((r) => r.fell !== null)?.fell ?? null;
    const again = fell !== null && rec.some((r) => r.phase === "play" && r.warn && r.warn.turn > fell && r.crossing);
    if (end >= 0 && again && new Set(rec.slice(end).filter((r) => r.phase === "play").map((r) => r.fen)).size >= 2) break;
    if ((await phase(page)) === "results") break;
    const s = await yourTurn(page);
    if (s && !played.has(s.fen)) {
      played.add(s.fen);
      await submitMove(page, moveOf(s.fen, s.allowed, s.warn ? { from: s.warn.square } : undefined), s.fen);
    }
    await page.waitForTimeout(250);
  }
  const rec = await recorded(page);
  const fellAt = rec.findIndex((r) => r.fell !== null);
  expect(fellAt, "he fell").toBeGreaterThan(0);
  expect(rec.some((r) => r.events.includes("birdieFall"))).toBe(true);
  // The cutscene's pictures in order, none skipped, while he "thinks" (never on your turn).
  const pics = rec.flatMap((r) => (r.cine ? [r.cine] : []));
  const order = pics.filter((p, i) => p !== pics[i - 1]);
  expect(order, "the fall, the approach, the reveal, the hold").toEqual(["fall", "approach", "reveal", "hold"]);
  expect(rec.filter((r) => r.cine).every((r) => r.phase !== "play"), "the game paused under it").toBe(true);
  // Timed to his ult's piece (Nov 23): the train's impact on its drop, about 15 s after your move landed; the cutscene's reveal a beat
  // after it; his reply at the drop, never before it (it waits for the cutscene's end).
  const drop = rec.find((r) => r.drop !== null)?.drop ?? null;
  expect(drop, "the drop sent with his fall").not.toBeNull();
  const landed = rec[fellAt]!.t;
  // (His train's ride first when it rode that turn: since Nov 24 also when you saved the warned piece, as this test does.)
  const rode = rec[fellAt]!.ride?.at === rec[fellAt]!.fell ? BIRDIE_BEATS.ride.total : 0;
  expect(drop! - landed).toBeGreaterThan(14_000 + rode);
  expect(drop! - landed).toBeLessThan(16_500 + rode);
  // (He waits about 10 s first, his line said; the scene comes up its own time to the impact before the drop: BIRDIE_BEATS.fall.)
  const scene = rec.find((r) => r.cine)!;
  expect(scene.t - landed, "his wait before the cutscene").toBeGreaterThan(9_500 + rode);
  // (And when it rode, the train crossed the board before his cutscene came up.)
  if (rode) expect(rec.some((r) => r.train && r.t >= landed && r.t < scene.t), "the train before his fall").toBe(true);
  expect(drop! - scene.t, "the scene's own time to the impact").toBeGreaterThan(4_000);
  expect(drop! - scene.t).toBeLessThan(4_800);
  const reveal = rec.find((r) => r.cine === "reveal")!;
  expect(reveal.t).toBeGreaterThanOrEqual(drop!);
  expect(reveal.t - drop!).toBeLessThan(600);
  const reply = rec.findIndex((r, i) => i > fellAt && r.plies !== null && r.plies > rec[fellAt]!.plies!);
  expect(reply, "his reply").toBeGreaterThan(fellAt);
  expect(rec[reply]!.t, "his reply comes at the drop, not before").toBeGreaterThanOrEqual(drop!);
  // Before his fall, young Birdie in the bar; from the cutscene's end, Armored Birdie (his powered twin's loops) on your turns.
  expect(rec.slice(0, fellAt).every((r) => !r.bar?.startsWith("p_")), "young Birdie before").toBe(true);
  const end = rec.findLastIndex((r) => r.cine);
  const yours = rec.slice(end).filter((r) => r.phase === "play" && r.bar);
  expect(yours.length).toBeGreaterThan(30);
  expect(yours.every((r) => r.bar!.startsWith("p_")), `Armored Birdie after: ${[...new Set(yours.map((r) => r.bar))]}`).toBe(true);
  expect(new Set(yours.map((r) => r.bar)).has("p_idle"), "at rest in p_idle").toBe(true);
  // Armored Birdie keeps the train (Eric, Nov 23): a warning on a turn after his fall, its crossing on the board, the dock naming it.
  const warnedAfter = rec.slice(fellAt).filter((r) => r.phase === "play" && r.warn && r.warn.turn > rec[fellAt]!.fell!);
  expect(warnedAfter.length, "his train warns again after his fall").toBeGreaterThan(0);
  expect(warnedAfter.some((r) => r.crossing), "its crossing on the board").toBe(true);
  expect(warnedAfter.some((r) => r.through === `Move your ${NAMES[r.warn!.piece]}!`), "the dock names your piece").toBe(true);
  expect(errors).toEqual([]);
});

/**
 * His power tip (docs/decisions/2026-11-24-power-tips.md): with `?tip=all`, as his first warning comes, his tip line in his bubble, then
 * the God King's answer in his; a second battle without the switch (this account's count 2 on this device: not due) says neither.
 */
test("Birdie's power tip: his line then the God King's as the first warning comes; a second battle (count 2) without the switch, none", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const BOSS = "All aboard! Clear the tracks!";
  const KING = "See the yellow sign? Move that piece. His train only hits the one under the sign.";
  await asAdmin(page);
  for (const [n, sw] of [[1, "&tip=all"], [2, ""]] as const) {
    await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=birdie&power=train&mode=raid${sw}`);
    await openBossRaid(page);
    await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
    await yourMove(page);
    // (When each line was first in its bubble, every frame.)
    await page.evaluate(() => {
      const w = window as any;
      w.__tips = {} as Record<string, number>;
      const look = () => {
        for (const e of document.querySelectorAll(".bc-bubble, .gk-bubble")) {
          const k = `${e.classList.contains("gk-bubble") ? "king" : "boss"}:${e.getAttribute("aria-label")}`;
          w.__tips[k] ??= Date.now();
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    // Your moves until his first warning is yours to answer, then his exchange's time.
    const deadline = Date.now() + 90_000;
    let warned = false;
    while (!warned && Date.now() < deadline) {
      const s = await yourTurn(page);
      if (s?.warn) warned = true;
      else if (s) await submitMove(page, moveOf(s.fen, s.allowed), s.fen);
      await page.waitForTimeout(200);
    }
    expect(warned, "his first warning").toBe(true);
    await page.waitForTimeout(4_000);
    const seen = await page.evaluate(() => (window as any).__tips as Record<string, number>);
    const count = await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith("brc.tips.") && k.endsWith(".birdie.train"))?.[1] ?? null);
    expect(count, "battles in which his train was seen").toBe(String(n));
    if (n === 1) {
      expect(seen[`boss:${BOSS}`], "his tip line").toBeDefined();
      expect(seen[`king:${KING}`], "the God King's answer").toBeDefined();
      expect(seen[`king:${KING}`]!).toBeGreaterThan(seen[`boss:${BOSS}`]!);
    } else {
      expect(seen[`boss:${BOSS}`], "no tip line").toBeUndefined();
      expect(seen[`king:${KING}`], "no answer").toBeUndefined();
    }
  }
});
