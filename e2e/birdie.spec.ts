import { expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { asAdmin, openBossRaid, pickMove, submitMove, test } from "./helpers.ts";

/**
 * Birdie (id birdie), played alone as an admin (he's in the game for admins first), the state read from the game and what's on screen
 * read from the page every frame (docs/decisions/2026-11-23-birdie-rules.md, 2026-11-23-birdie-fall.md):
 * - The Train (?power=train: warned every turn from your second): the crossing lights on his line, the dock names your piece ("Move
 *   your knight!"); moving that piece saves it (no ride); leaving it, his train rides the line at the start of his turn and smashes
 *   it: the train on the board, the piece gone.
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
  await page.evaluate(() => {
    const w = window as any;
    w.__bd = [] as any[];
    const look = () => {
      const m = w.match;
      const p = m?.boss?.powers;
      const bd = p?.birdie ?? null;
      const train = document.querySelector<HTMLElement>(".bd-train");
      w.__bd.push({
        t: Date.now(),
        phase: m?.phase?.kind ?? null,
        turn: p?.turn ?? null,
        crowdMoves: m?.boss?.crowdMoves ?? null,
        fen: m?.boss?.board?.fen ?? null,
        warn: bd?.warn ?? null,
        ride: bd?.ride ?? null,
        fell: bd?.fell ?? null,
        events: (p?.events ?? []).map((e: { kind: string }) => e.kind),
        crossing: !!document.querySelector(".fx-board.bd-crossing"),
        train: train ? (() => {
          const r = train.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
        })() : null,
        through: document.querySelector(".boss-dock .through-note")?.textContent?.trim() ?? null,
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
  warn: { turn: number; line: string; square: string; piece: string } | null;
  ride: { at: number; line: string; square: string; piece: string; spared?: true; king?: true } | null;
  fell: number | null;
  events: string[];
  crossing: boolean;
  train: { x: number; y: number; w: number } | null;
  through: string | null;
  cine: string | null;
  bar: string | null;
  moments: string[];
};
const recorded = (page: Page) => page.evaluate(() => (window as any).__bd as Frame[]);

async function battle(page: Page, power: string) {
  await asAdmin(page);
  await page.goto(`/?debug&pace=quick&clock=60&laststand=0&brain=stockfish&boss=birdie&power=${power}&mode=raid`);
  await openBossRaid(page);
  await page.getByRole("main").getByRole("button", { name: /^Boss alone/ }).click();
  await yourMove(page);
  await record(page);
  expect(await page.evaluate(() => (window as any).match.boss.id)).toBe("birdie");
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

test("Birdie's train: the crossing on his line, the dock names your piece; moved, it's saved; left, his train rides the line and smashes it", { tag: "@phone-only" }, async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await battle(page, "train");
  // Your first warned piece moved (saved); the next warned one that isn't your king left on its square (smashed, or spared when the
  // rules can't take it: then the next). Your king, when warned, always moves.
  let saved: { at: number; square: string; piece: string } | null = null;
  let left: { at: number; square: string; piece: string } | null = null;
  const played = new Set<string>();
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
  // Never a crossing when no warning is for your turn.
  expect(rec.filter((r) => r.phase === "play" && !r.warn && !r.moments.length).every((r) => !r.crossing), "no crossing without a warning").toBe(true);

  // Saved: no ride after that move.
  expect(rec.some((r) => r.ride?.at === saved!.at), "no ride for the piece you moved").toBe(false);

  // The smash: his train on the board through its ride, then your piece gone from its square.
  const ride = rec.filter((r) => r.ride?.at === left!.at);
  expect(ride[0]!.ride).toMatchObject({ square: left!.square, piece: left!.piece });
  expect(ride.some((r) => r.events.includes("trainSmash"))).toBe(true);
  const onBoard = rec.filter((r) => r.train && r.t >= ride[0]!.t);
  expect(onBoard.length, "the train on the board").toBeGreaterThan(5);
  // (It moves: its place on screen changes through the ride.)
  expect(new Set(onBoard.map((r) => `${r.train!.x},${r.train!.y}`)).size).toBeGreaterThan(3);
  const crowd = (await page.evaluate(() => (window as any).match.boss.crowdSide)) as "w" | "b";
  const after = new Chess(ride[0]!.fen!).get(left!.square as any);
  expect(!!after && after.color === crowd && after.type === left!.piece, `your ${NAMES[left!.piece]} gone from ${left!.square}`).toBe(false);
  // And the train gone again once your turn is back.
  expect(rec.at(-1)!.phase).toBe("play");
  expect(rec.at(-1)!.train).toBeNull();
  expect(errors).toEqual([]);
});

test("Birdie's fall: his cutscene plays as he thinks (the fall, the approach, the reveal, the hold), then Armored Birdie in the bar, and no train warns again", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await battle(page, "fall");
  const played = new Set<string>();
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const rec = await recorded(page);
    // (Two of your turns after the cutscene, Armored Birdie at rest in them.)
    const end = rec.findLastIndex((r) => r.cine);
    if (end >= 0 && rec.some((r) => r.fell !== null) && new Set(rec.slice(end).filter((r) => r.phase === "play").map((r) => r.fen)).size >= 2) break;
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
  // Before his fall, young Birdie in the bar; from the cutscene's end, Armored Birdie (his powered twin's loops) on your turns.
  expect(rec.slice(0, fellAt).every((r) => !r.bar?.startsWith("p_")), "young Birdie before").toBe(true);
  const end = rec.findLastIndex((r) => r.cine);
  const yours = rec.slice(end).filter((r) => r.phase === "play" && r.bar);
  expect(yours.length).toBeGreaterThan(30);
  expect(yours.every((r) => r.bar!.startsWith("p_")), `Armored Birdie after: ${[...new Set(yours.map((r) => r.bar))]}`).toBe(true);
  expect(new Set(yours.map((r) => r.bar)).has("p_idle"), "at rest in p_idle").toBe(true);
  // No train once he's fallen: no warning, no crossing, no ride after the fall.
  const fallen = rec.slice(fellAt);
  expect(fallen.every((r) => !r.warn && !r.crossing), "no train warns again").toBe(true);
  const rideBefore = rec[fellAt - 1]!.ride?.at ?? null;
  expect(fallen.every((r) => (r.ride?.at ?? null) === rideBefore || (r.ride?.at ?? 0) <= rec[fellAt]!.fell!), "no ride after").toBe(true);
  expect(errors).toEqual([]);
});
