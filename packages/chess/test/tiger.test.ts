import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, TIGER_NAME, isPlayable, mulberry32, type BossPowerState } from "@chessroyale/core";
import {
  HOOPS_BEATS,
  HOOP_CORNERS,
  MatchRunner,
  PASS_WAIT,
  POWER_FX,
  TIGER_ANIM,
  TIGER_FX,
  applyMove,
  attackAcross,
  balloonStage,
  bossAllowed,
  crossesHoop,
  crowdAllowed,
  fenAtPly,
  hoopMoves,
  hoopOrder,
  hoopSquares,
  hoopStops,
  hoopsAnswer,
  hoopsCheck,
  hoopsFrom,
  hoopsGuard,
  hoopsTouch,
  hoopsValid,
  inCheck,
  inHoop,
  landCheck,
  landFrom,
  landRefused,
  legalMoves,
  materialOf,
  pieceAt,
  powerMomentMs,
  powerRoll,
  powerTurn,
  rollBalloon,
  sideToMove,
  stockfishRefuses,
  stopReason,
  tigerEvents,
  type EngineLike,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * The circus tiger (docs/decisions/2026-10-23-tiger-rules.md): Balloons (a real-time pump: a balloon on the nozzle at the
 * start of his turn, four stages of 30 s, at the end of a turn it lands as his piece in the shape's band or pops) and
 * Hoops (his whole turn: three 2x2 blocks walled for the crowd's next 2 moves, placed by the engine in a band).
 */

const S = BOSS_POWERS;
const STAGE = S.balloonStageSec * 1000;
const BLOWN = S.balloonStages * STAGE;

type Battle = { r: MatchRunner; now: () => number; tick: (ms: number) => void };

/** A tiger battle on its own clock (`now`, moved by hand), the crowd White unless `side` says, the test switches as given. */
function battle(seed: number, opts: { test?: string; side?: "w" | "b"; balloon?: "pawn" | "knight" | "bishop" | "rook" | "queen" | "fakequeen"; stage?: number; clock?: boolean } = {}): Battle {
  let t = 100_000;
  const settings = kitSettings({ boss: "tiger", test: opts.test ?? "", maxMoves: 50 }, { ...(opts.balloon ? { bossBalloonTest: opts.balloon } : {}), ...(opts.stage ? { bossStageTest: opts.stage } : {}) });
  const r = new MatchRunner({ settings, rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: opts.side ?? "w", ...(opts.clock === false ? {} : { clock: () => t }) });
  return { r, now: () => t, tick: (ms) => void (t += ms) };
}
const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const powersOf = (r: MatchRunner) => r.boss!.powers!;

/** The crowd's move (seeded, cheap; `pick` if given). */
async function crowdMove(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : crowdPick(fen, allowed, mulberry32(fen.length * 31 + allowed.length));
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
  return move;
}

/** His turn: the hoops when due (and he moves if they wait), else his move. */
async function histurn(r: MatchRunner, engines: EngineLike[] = [fakeEngine()]) {
  if (r.hoopsDue()) await r.playHoops(engines);
  if (r.bossToMove()) await r.playBoss(engines[0]!);
}

/** One step of the battle. */
async function step(b: Battle, ms = 10_000) {
  b.tick(ms);
  if (b.r.bossToMove()) await histurn(b.r);
  else await crowdMove(b.r);
}

/** Puts a battle on a position of our own (a base at its ply), with powers patched. */
function onPosition(r: MatchRunner, fen: string, crowd: "w" | "b", patch: Partial<BossPowerState> = {}) {
  const id = r.state.boards[0]!;
  const board = r.boards.get(id)!;
  r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []).filter((x) => x.ply !== board.history.length), { ply: board.history.length, fen }] });
  const boss = r.state.boss!;
  r.state = { ...r.state, boss: { ...boss, crowdSide: crowd, powers: { ...boss.powers!, ...patch } } };
}

/**
 * A quiet middlegame, him (Black) to move: seven pawns and a knight and a bishop of his, so any balloon's shape is one he
 * can have (from the game so far he usually has his full set: then a balloon pops, `nine`, as Stockfish refuses a ninth
 * pawn or more pieces than promotions could make).
 */
const QUIET_B = "1nb3k1/pp3pp1/2p1p3/3p4/3P4/2P1P3/PP3PPP/1NB3K1 b - - 0 12";

/** After the crowd's first move: the battle on QUIET_B, him to move, the balloon just placed still on. */
async function onQuiet(b: Battle) {
  await crowdMove(b.r);
  onPosition(b.r, QUIET_B, "w");
}

/**
 * An engine that counts material, one ply deep (searchmoves kept): the mover's expected score after its best allowed move
 * is its material lead then (a pawn a unit, bouncePawnLogit per pawn). A balloon's gain is about the material it adds,
 * less what the crowd can take at once.
 */
function materialEngine(): EngineLike {
  const lead = (fen: string, me: "w" | "b") => materialOf(fen, me) - materialOf(fen, me === "w" ? "b" : "w");
  const sig = (x: number) => 1 / (1 + Math.exp(-x * S.bouncePawnLogit));
  const ranked = (fen: string, only?: readonly string[]) => {
    const me = sideToMove(fen);
    return (only ?? legalMoves(fen)).map((move) => ({ move, expected: sig(lead(applyMove(fen, move), me)) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
  };
  return {
    topMoves: async (fen, n) => ranked(fen).slice(0, n),
    topMovesAt: async (fen, n, _nodes, only) => ranked(fen, only).slice(0, n),
    scoreMoves: async (fen, moves) => ranked(fen, moves),
  };
}

/** An engine whose crowd does worse the fewer moves it has: its expected score is a share of its moves (the walls' bite). */
function mobilityEngine(): EngineLike {
  const score = (fen: string, only?: readonly string[]) => {
    const n = (only ?? legalMoves(fen)).length;
    return Math.max(0.02, Math.min(0.98, 0.5 * (n / Math.max(1, legalMoves(fen).length))));
  };
  return {
    topMoves: async (fen, n) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: 0.5 })),
    topMovesAt: async (fen, n, _nodes, only) => (only ?? legalMoves(fen)).slice(0, n).map((move) => ({ move, expected: score(fen, only) })),
    scoreMoves: async (fen, moves) => moves.map((move) => ({ move, expected: 0.5 })),
  };
}

// ---------------- His sheet ----------------

describe("the circus tiger: his sheet", () => {
  it("is on the roster as Babur, a tiger, playable (his art is wired in), with Balloons and Hoops", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "tiger")!;
    expect(def).toMatchObject({ name: TIGER_NAME, icon: "🐯", kit: "Tiger", powers: { passive: "balloons", ultimate: "hoops" } });
    expect(TIGER_NAME).toBe("Babur");
    expect(isPlayable(def)).toBe(true);
    expect(S.rageSpeed.tiger).toBeGreaterThan(0);
  });

  it("his numbers: 4 stages of 30 s (the sim's; Eric's 15 s made him far too strong); the shapes' odds add to 100, about half pop, a fake queen always, a queen never; six colors; the bands (in the engine's units)", () => {
    expect([S.balloonStages, S.balloonStageSec, S.balloonColors]).toEqual([4, 30, 6]);
    const o = S.balloonOdds;
    expect(o).toEqual({ pawn: 55, knight: 13, bishop: 13, rook: 6, fakeQueen: 10, queen: 3 });
    expect(Object.values(o).reduce((a, b) => a + b, 0)).toBe(100);
    expect(S.balloonPops).toEqual({ pawn: 40, knight: 55, bishop: 55, rook: 55, fakeQueen: 100, queen: 0 });
    const popPct = (Object.keys(o) as (keyof typeof o)[]).reduce((t, k) => t + (o[k] * S.balloonPops[k]) / 100, 0);
    expect(popPct).toBeCloseTo(49.6, 1);
    expect(S.balloonBands).toEqual({ p: [0.3, 1.5], n: [7, 8.5], b: [7, 8.5], r: [7, 8.5], q: [7, 8.5] });
    expect([S.hoopsCount, S.hoopsCrowdMoves, S.hoopsTarget]).toEqual([3, 2, 1.5]);
    expect(S.hoopsBand).toEqual([0.5, 2.5]);
  });

  it("his moments' lengths come from his animations: the server waits for the hoops' cast, never for the balloons nor the hoops going out", () => {
    expect(TIGER_ANIM).toMatchObject({ hop: 620, place: 820, cheer: 720, bigCheer: 1160, wince: 780, hoops: 1360, throwsAt: [300, 580, 860], pumpStage: 400, pumpPop: 400, pumpRelease: 330, balloonLand: 790, ringLand: 330, ringOut: 400 });
    expect(HOOPS_BEATS.total).toBe(Math.max(1360, 860 + HOOPS_BEATS.flyMs + 330));
    expect(TIGER_FX).toEqual({ place: 0, balloonLand: 0, pop: 0, balloonCheer: 0, balloonBigCheer: 0, wince: 0, hoops: HOOPS_BEATS.total, hoopsOut: 0 });
    for (const [k, v] of Object.entries(TIGER_FX)) expect(POWER_FX[k as keyof typeof POWER_FX]).toBe(v);
    expect(powerMomentMs([{ kind: "hoops" }, { kind: "balloonLand" }, { kind: "balloonCheer" }])).toBe(HOOPS_BEATS.total);
  });
});

// ---------------- Balloons ----------------

describe("Balloons: the rolls", () => {
  it("each balloon's roll is seeded (the same everywhere) and over many keeps the sheet's odds, its pops and six colors", () => {
    expect(rollBalloon(7, 99, 3)).toEqual(rollBalloon(7, 99, 3));
    const n = 40_000;
    const kinds: Record<string, number> = {};
    const pops: Record<string, number> = {};
    const colors = new Array(6).fill(0);
    let popped = 0;
    for (let i = 0; i < n; i++) {
      const b = rollBalloon(1234 + (i % 7), 777 + (i % 5), i);
      kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
      if (b.dud) pops[b.kind] = (pops[b.kind] ?? 0) + 1;
      if (b.dud) popped++;
      colors[b.color]++;
      expect(b.shape).toBe({ pawn: "p", knight: "n", bishop: "b", rook: "r", fakeQueen: "q", queen: "q" }[b.kind]);
    }
    for (const [k, pct] of Object.entries(S.balloonOdds)) expect(Math.abs((100 * (kinds[k] ?? 0)) / n - pct), k).toBeLessThan(1);
    for (const [k, pct] of Object.entries(S.balloonPops)) expect(Math.abs((100 * (pops[k] ?? 0)) / Math.max(1, kinds[k] ?? 0) - pct), k).toBeLessThan(pct === 0 || pct === 100 ? 0.001 : 4);
    expect((100 * popped) / n).toBeGreaterThan(47);
    expect((100 * popped) / n).toBeLessThan(52.5);
    for (const c of colors) expect(c / n).toBeGreaterThan(0.15);
  });

  it("a dud comes from the battle's secret alone: the same seed with another secret, other duds; the shapes and colors the seed's", () => {
    let differ = 0;
    for (let i = 0; i < 200; i++) {
      const a = rollBalloon(42, 1, i);
      const b = rollBalloon(42, 2, i);
      expect(b.shape).toBe(a.shape);
      expect(b.color).toBe(a.color);
      if (a.dud !== b.dud || a.kind !== b.kind) differ++;
    }
    expect(differ).toBeGreaterThan(40);
  });

  it("the secret is drawn from the match's random source as the battle starts, kept in the state and in nothing a device gets", async () => {
    const one = battle(51);
    const two = battle(52);
    const s1 = powersOf(one.r).balloon!.secret!;
    expect(typeof s1).toBe("number");
    expect(s1).not.toBe(powersOf(two.r).balloon!.secret);
    expect(s1).not.toBe(powersOf(one.r).seed);
    for (let i = 0; i < 6; i++) await step(one, 20_000);
    const seen = JSON.stringify([one.r.bossView(), one.r.bossToMove() ? one.r.balloonAsk() : null, one.r.hoopsAsk()]);
    expect(seen).not.toContain(String(s1));
    expect(seen).not.toMatch(/secret|dud/);
  });

  it("the test switch's shape: every balloon that shape, never a dud but the fake queen, which always pops", () => {
    for (const [forced, shape] of [["pawn", "p"], ["knight", "n"], ["bishop", "b"], ["rook", "r"], ["queen", "q"]] as const) {
      for (let i = 0; i < 50; i++) expect(rollBalloon(9, 5, i, forced)).toMatchObject({ shape, dud: false });
    }
    for (let i = 0; i < 50; i++) expect(rollBalloon(9, 5, i, "fakequeen")).toMatchObject({ shape: "q", dud: true });
  });
});

describe("Balloons: the stages over time", () => {
  it("four stages of balloonStageSec, then ready (and drawn at stage 4)", () => {
    const b = { at: 1000, readyAt: 1000 + BLOWN };
    expect(balloonStage(b, 1000)).toEqual({ stage: 1, ready: false });
    expect(balloonStage(b, 1000 + STAGE - 1)).toEqual({ stage: 1, ready: false });
    expect(balloonStage(b, 1000 + STAGE)).toEqual({ stage: 2, ready: false });
    expect(balloonStage(b, 1000 + 2 * STAGE)).toEqual({ stage: 3, ready: false });
    expect(balloonStage(b, 1000 + 3 * STAGE)).toEqual({ stage: 4, ready: false });
    expect(balloonStage(b, 1000 + BLOWN - 1)).toEqual({ stage: 4, ready: false });
    expect(balloonStage(b, 1000 + BLOWN)).toEqual({ stage: 4, ready: true });
    expect(balloonStage(b, 1000 + 10 * BLOWN)).toEqual({ stage: 4, ready: true });
  });

  it("on the runner's clock (online the server's, solo the page's): placed as his turn begins, at that time; ready after its four stages", async () => {
    const b = battle(3);
    expect(powersOf(b.r).balloon?.nozzle ?? null).toBeNull();
    await crowdMove(b.r);
    // (The crowd's move landed: his turn begins, and the nozzle being empty, a balloon goes on it now.)
    const p = powersOf(b.r);
    expect(p.balloon!.nozzle).toMatchObject({ n: 0, at: b.now(), readyAt: b.now() + BLOWN });
    expect(p.events.filter((e) => e.kind === "place")).toEqual([{ kind: "place", turn: p.turn, shape: p.balloon!.nozzle!.shape, color: p.balloon!.nozzle!.color }]);
    const view = b.r.bossView()!.powers!;
    expect(view.balloon).toEqual({ shape: p.balloon!.nozzle!.shape, color: p.balloon!.nozzle!.color, at: b.now(), readyAt: b.now() + BLOWN, ready: false });
    expect(balloonStage(view.balloon!, b.now() + STAGE + 5_000).stage).toBe(2);
  });

  it("without a clock (tests, the sims), each crowd move counts as seedEverySec (30 s): a balloon is ready four crowd moves on", async () => {
    const b = battle(5, { clock: false });
    await crowdMove(b.r);
    const at = powersOf(b.r).balloon!.nozzle!.at;
    expect(at).toBe(S.seedEverySec * 1000);
    expect(powersOf(b.r).balloon!.nozzle!.readyAt).toBe(at + BLOWN);
  });
});

describe("Balloons: placed at his turn's start, landing or popping only at his turn's end and only when ready", () => {
  it("one on the nozzle at a time: no new one while it's there; a new one at the start of his turn after it's gone", async () => {
    const b = battle(11);
    await crowdMove(b.r);
    const first = powersOf(b.r).balloon!.nozzle!;
    b.tick(5_000);
    await histurn(b.r);
    // (Not ready: still on the nozzle, nothing landed or popped.)
    expect(powersOf(b.r).balloon!.nozzle).toMatchObject({ n: first.n, asked: b.r.boss!.crowdMoves, due: false });
    expect(powersOf(b.r).balloon!.last).toBeNull();
    expect(tigerEvents(powersOf(b.r).events).map((e) => e.kind)).toEqual([]);
    b.tick(5_000);
    await crowdMove(b.r);
    // (Still the first: no second balloon while it's on.)
    expect(powersOf(b.r).balloon!.nozzle!.n).toBe(first.n);
    expect(powersOf(b.r).balloon!.placed).toBe(1);
    expect(powersOf(b.r).events.some((e) => e.kind === "place")).toBe(false);
  });

  it("readiness is decided as his turn's work is asked for: one that becomes ready while he thinks waits for his next turn's end", async () => {
    const b = battle(12);
    await crowdMove(b.r);
    const nz = powersOf(b.r).balloon!.nozzle!;
    b.tick(BLOWN - 1);
    expect(b.r.balloonAsk()).toBeNull();
    b.tick(10);
    // (Ready by now, but his turn's check was made: asked again, the same answer.)
    expect(b.r.balloonAsk()).toBeNull();
    await b.r.playBoss(fakeEngine());
    expect(powersOf(b.r).balloon!.nozzle!.n).toBe(nz.n);
    await crowdMove(b.r);
    expect(b.r.balloonAsk()).not.toBeNull();
    await b.r.playBoss(fakeEngine());
    expect(powersOf(b.r).balloon!.nozzle?.n === nz.n).toBe(false);
    expect(powersOf(b.r).balloon!.last).toMatchObject({ n: nz.n });
  });

  it("a ready balloon lands at the end of his turn as his piece (a base at its ply), its moments as the crowd's turn begins", async () => {
    const b = battle(13, { balloon: "knight", stage: 4 });
    await onQuiet(b);
    expect(b.r.balloonAsk()).toMatchObject({ shape: "n", blocks: [] });
    const before = fenOf(b.r);
    await b.r.playBoss(fakeEngine());
    const last = powersOf(b.r).balloon!.last!;
    expect(last).toMatchObject({ outcome: "land", shape: "n" });
    const fen = fenOf(b.r);
    const his = b.r.boss!.crowdSide === "w" ? "b" : "w";
    expect(pieceAt(fen, last.square!)).toEqual({ color: his, type: "n" });
    expect(materialOf(fen, his)).toBeGreaterThanOrEqual(materialOf(before, his) + 3 - 9);
    const board = b.r.boards.get(b.r.state.boards[0]!)!;
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(fen);
    expect(stockfishRefuses(fen)).toBeNull();
    expect(inCheck(fen)).toBe(false);
    expect(tigerEvents(powersOf(b.r).events)).toEqual([
      { kind: "balloonLand", turn: powersOf(b.r).turn, square: last.square, shape: "n", color: last.color },
      { kind: "balloonCheer", turn: powersOf(b.r).turn },
    ]);
    expect(powerTurn(b.r.state.boss!)).toBe(true);
    expect(powersOf(b.r).balloon).toMatchObject({ nozzle: null, landed: 1, popped: 0, placed: 1 });
    // (His next turn: a new balloon.)
    await crowdMove(b.r);
    expect(powersOf(b.r).balloon!.nozzle!.n).toBe(1);
  });

  it("a real queen lands with his big cheer; a dud (the fake queen) pops with a wince, the board untouched", async () => {
    const q = battle(14, { balloon: "queen", stage: 4 });
    await onQuiet(q);
    await q.r.playBoss(fakeEngine());
    expect(powersOf(q.r).balloon!.last).toMatchObject({ outcome: "land", shape: "q" });
    expect(tigerEvents(powersOf(q.r).events).map((e) => e.kind)).toEqual(["balloonLand", "balloonBigCheer"]);
    const f = battle(14, { balloon: "fakequeen", stage: 4 });
    await onQuiet(f);
    const ply = f.r.boards.get(f.r.state.boards[0]!)!.history.length;
    await f.r.playBoss(fakeEngine());
    const board = f.r.boards.get(f.r.state.boards[0]!)!;
    expect(powersOf(f.r).balloon!.last).toMatchObject({ outcome: "pop", shape: "q", square: null });
    expect(tigerEvents(powersOf(f.r).events)).toEqual([
      { kind: "pop", turn: powersOf(f.r).turn, shape: "q", color: powersOf(f.r).balloon!.last!.color },
      { kind: "wince", turn: powersOf(f.r).turn },
    ]);
    expect(board.bases?.some((x) => x.ply === ply + 1)).toBeFalsy();
    expect(powersOf(f.r).balloon).toMatchObject({ nozzle: null, landed: 0, popped: 1 });
  });

  it("the fake queen is never visible before its pop: every view, moment and ask the same as a real queen's", async () => {
    const real = battle(15, { balloon: "queen", stage: 3 });
    const fake = battle(15, { balloon: "fakequeen", stage: 3 });
    await onQuiet(real);
    await onQuiet(fake);
    for (let i = 0; i < 12; i++) {
      for (const b of [real, fake]) {
        b.tick(10_000);
        if (b.r.bossToMove()) {
          const ask = b.r.balloonAsk();
          expect(JSON.stringify(ask ?? {})).not.toMatch(/dud|fake/i);
        }
      }
      const vr = real.r.bossView()!.powers!;
      const vf = fake.r.bossView()!.powers!;
      expect(JSON.stringify(vf)).not.toMatch(/dud|fake/i);
      // (Until the end of the turn it's ready at: then one pops and the other lands.)
      if (powersOf(fake.r).balloon?.last) break;
      expect(vf.balloon ?? null).toEqual(vr.balloon ?? null);
      expect(tigerEvents(vf.events)).toEqual(tigerEvents(vr.events));
      if (real.r.bossToMove()) {
        await real.r.playBoss(fakeEngine());
        await fake.r.playBoss(fakeEngine());
      } else {
        const fen = fenOf(real.r);
        const pick = (f: string, allowed: string[]) => (allowed.includes(crowdPick(fen, allowed, mulberry32(i))) ? crowdPick(fen, allowed, mulberry32(i)) : allowed[0]!);
        await crowdMove(real.r, pick);
        await crowdMove(fake.r, pick);
      }
    }
    expect(powersOf(fake.r).balloon!.last).toMatchObject({ outcome: "pop", shape: "q" });
    expect(powersOf(real.r).balloon!.last).toMatchObject({ outcome: "land", shape: "q" });
  });

  it("a fake and a real queen are treated alike until the last step: no square, or one the rules refuse, and both wait; a square they allow, and one pops while the other lands", async () => {
    for (const answer of [null, "occupied", "attacked"] as const) {
      const pair = [battle(19, { balloon: "queen", stage: 4 }), battle(19, { balloon: "fakequeen", stage: 4 })];
      for (const b of pair) await onQuiet(b);
      // (The host is asked the same for both.)
      expect(pair[1]!.r.balloonAsk()).toEqual(pair[0]!.r.balloonAsk());
      for (const b of pair) {
        const move = "g8f8";
        const after = applyMove(QUIET_B, move);
        const square = answer === null ? null : answer === "occupied" ? "d5" : "e5";
        if (square) expect(landCheck(after, "q", square, [])).toBeNull();
        b.r.applyBossMove(move, false, { balloon: square });
      }
      const vr = pair[0]!.r.bossView()!.powers!;
      const vf = pair[1]!.r.bossView()!.powers!;
      expect(vf.balloon).toEqual(vr.balloon);
      expect(vf.balloonLast ?? null).toBeNull();
      expect(vr.balloonLast ?? null).toBeNull();
      expect(tigerEvents(vf.events)).toEqual(tigerEvents(vr.events));
      expect(fenOf(pair[1]!.r)).toBe(fenOf(pair[0]!.r));
    }
    // A square they allow: now (and only now) they part.
    const pair = [battle(19, { balloon: "queen", stage: 4 }), battle(19, { balloon: "fakequeen", stage: 4 })];
    for (const b of pair) {
      await onQuiet(b);
      b.r.balloonAsk();
      b.r.applyBossMove("g8f8", false, { balloon: "a6" });
    }
    expect(powersOf(pair[0]!.r).balloon!.last).toMatchObject({ outcome: "land", square: "a6" });
    expect(powersOf(pair[1]!.r).balloon!.last).toMatchObject({ outcome: "pop", square: null });
    // (With his full set and eight pawns, either pops alike: `nine`, whatever it was.)
    const full = [battle(20, { stage: 4 }), battle(21, { stage: 4 })];
    for (const b of full) {
      await crowdMove(b.r);
      await b.r.playBoss(fakeEngine());
      expect(powersOf(b.r).balloon!.last).toMatchObject({ outcome: "pop", nine: true });
    }
  });

  it("a ready balloon with no square (no answer, or one the rules refuse) stays ready on the nozzle until his next turn's end", async () => {
    const b = battle(16, { balloon: "pawn", stage: 4 });
    await onQuiet(b);
    const nz = powersOf(b.r).balloon!.nozzle!;
    b.r.balloonAsk();
    const fen = fenOf(b.r);
    const move = (b.r.bossAllowed() ?? legalMoves(fen))[0]!;
    b.r.applyBossMove(move, false, { balloon: "e4" === move.slice(2, 4) ? "e5" : move.slice(2, 4) });
    expect(powersOf(b.r).balloon!.nozzle).toMatchObject({ n: nz.n, due: true });
    expect(powersOf(b.r).balloon!.last).toBeNull();
    expect(b.r.bossView()!.powers!.balloon!.ready).toBe(true);
    await crowdMove(b.r);
    // (No second balloon: this one is still on.)
    expect(powersOf(b.r).balloon!.placed).toBe(1);
    await b.r.playBoss(fakeEngine());
    expect(powersOf(b.r).balloon!.last).toMatchObject({ n: nz.n, outcome: "land", shape: "p" });
  });
});

describe("Balloons: where they land (the bands and the guards)", () => {
  // Him Black, the crowd White to move; quiet, no queens; his pawns seven.
  const QUIET = "1nb3k1/pp3pp1/2p1p3/3p4/3P4/2P1P3/PP3PPP/1NB3K1 w - - 0 13";

  it("landCheck: an empty square, never the en passant square, never in a hoop, a pawn never on a first or last rank", () => {
    expect(landCheck(QUIET, "n", "d5", [])).toBeNull();
    expect(landCheck(QUIET, "p", "a1", [])).toBeNull();
    expect(landCheck(QUIET, "p", "h8", [])).toBeNull();
    expect(landCheck(QUIET, "n", "a6", [])).not.toBeNull();
    expect(landCheck(QUIET, "n", "a6", ["a5"])).toBeNull();
    expect(landCheck(QUIET, "n", "a4", ["a5"])).not.toBeNull();
    // (The crowd White may take e5 en passant on e6: no balloon there.)
    const ep = "4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1";
    expect(legalMoves(ep)).toContain("d5e6");
    expect(landCheck(ep, "n", "e6", [])).toBeNull();
    expect(landCheck(ep, "n", "a6", [])).not.toBeNull();
    expect(landCheck("x", "n", "z9", [])).toBeNull();
  });

  it("never a check (the crowd's king attacked), never a mate in one for either side, never the crowd without a move", () => {
    // A knight on f3 checks White's king on g1.
    expect(landCheck(QUIET, "n", "f3", [])).toBeNull();
    expect(landCheck(QUIET, "n", "h3", [])).toBeNull();
    // Back-rank: a rook of his on e2? It would mate in one next (Re1#)? It checks nothing now, but the crowd to move
    // could take it; a rook on d1 gives check at once.
    expect(landCheck(QUIET, "r", "d1", [])).toBeNull();
    // A queen on h4 (no check now) would mate him in one were the crowd to pass? Qxh2 is not mate; it's allowed if
    // nothing else fails. A queen on e1 checks.
    expect(landCheck(QUIET, "q", "e1", [])).toBeNull();
    // The crowd stalemated: White's lone king on a1, his knight on c3 covering a2 and b1; a rook on h2 takes b2, its last
    // square, with no check.
    const box = "7k/8/8/8/8/2n5/8/K7 w - - 0 1";
    expect(legalMoves(box)).toEqual(["a1b2"]);
    expect(landCheck(box, "r", "h2", [])).toBeNull();
    expect(landCheck(box, "r", "h3", [])).not.toBeNull();
    // A mate in one for the crowd: a balloon that blocks his own king's last square (White's rook mates on the eighth).
    const back = "6k1/5p1p/8/8/8/8/8/R5K1 w - - 0 1";
    expect(landCheck(back, "p", "g7", [])).toBeNull();
    expect(landCheck(back, "n", "b5", [])).not.toBeNull();
  });

  it("a shape he can't have pops (`nine`): a ninth pawn, more pieces than promotions could make", () => {
    const eight = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(landRefused(eight, "p", "b")).toBe("nine");
    expect(landRefused(eight, "n", "b")).toBe("nine");
    expect(landRefused(eight, "q", "b")).toBe("nine");
    expect(landRefused(QUIET, "p", "b")).toBeNull();
    expect(landRefused(QUIET, "q", "b")).toBeNull();
    for (const sq of ["a6", "h5", "e5"]) expect(landCheck(eight.replace("8/8/8/8", "8/8/8/8"), "p", sq, [])).toBeNull();
  });

  it("landCheck: never a square the crowd attacks (it can't take the balloon's piece at once)", () => {
    // (White's pawn on d4 attacks e5 and c5.)
    expect(landCheck(QUIET, "n", "e5", [])).toBeNull();
    expect(landCheck(QUIET, "n", "c5", [])).toBeNull();
    expect(landCheck(QUIET, "n", "a6", [])).not.toBeNull();
  });

  it("landFrom: of the squares weighed (seeded, every guard passed), the least valuable in the shape's band (nearest its low end), else the nearest", async () => {
    for (const shape of ["p", "n", "r", "q"] as const) {
      const ask = { shape, order: 77, blocks: [] as string[] };
      const pick = (await landFrom([materialEngine()], QUIET, ask))!;
      expect(pick, shape).not.toBeNull();
      // (The same squares, in the same order, scored the same way here.)
      const options = [..."abcdefgh"]
        .flatMap((f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => `${f}${r}`))
        .filter((sq) => !pieceAt(QUIET, sq))
        .sort((a, b) => powerRoll(77, "land", a) - powerRoll(77, "land", b))
        .filter((sq) => landCheck(QUIET, shape, sq, []))
        .slice(0, S.balloonLooks);
      expect(options).toContain(pick.square);
      const engine = materialEngine();
      const crowdBest = async (f: string) => (await engine.topMovesAt!(f, 1, 1))[0]!.expected;
      const logit = (x: number) => Math.log(Math.min(0.999, Math.max(0.001, x)) / (1 - Math.min(0.999, Math.max(0.001, x))));
      const before = await crowdBest(QUIET);
      const gains = await Promise.all(options.map(async (sq) => (logit(1 - (await crowdBest(landCheck(QUIET, shape, sq, [])!))) - logit(1 - before)) / S.bouncePawnLogit));
      const [lo, hi] = S.balloonBands[shape];
      const dist = (g: number) => (g >= lo && g <= hi ? g - lo : 1000 + (g < lo ? lo - g : g - hi));
      const bestDist = Math.min(...gains.map(dist));
      expect(dist(gains[options.indexOf(pick.square)]!), shape).toBeCloseTo(bestDist, 6);
      // (Never on a square the crowd attacks.)
      expect(landCheck(QUIET, shape, pick.square, []), shape).not.toBeNull();
    }
  });

  it("from the starting position (every raid's), with all eight of his pawns and his full set, a balloon pops (`nine`)", async () => {
    let nine = 0;
    for (let seed = 17; seed < 23; seed++) {
      const b = battle(seed, { stage: 4 });
      expect(fenOf(b.r).split(" ")[0]).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
      await crowdMove(b.r);
      const dud = powersOf(b.r).balloon!.nozzle!.dud;
      await b.r.playBoss(fakeEngine());
      const last = powersOf(b.r).balloon!.last!;
      expect(last).toMatchObject({ outcome: "pop", square: null });
      // (A dud too: nothing in a pop at full material tells a fake queen from a real one.)
      expect(last.nine).toBe(true);
      if (!dud) nine++;
      expect(tigerEvents(powersOf(b.r).events).map((e) => e.kind)).toEqual(["pop", "wince"]);
    }
    expect(nine).toBeGreaterThan(0);
  });

  it("the test switch ?balloon= starts his battle a pawn down each side (1.e4 d5 2.exd5 Qxd5), so its balloon can land", async () => {
    const b = battle(18, { balloon: "rook", stage: 4 });
    expect(fenOf(b.r)).toBe(applyMove(applyMove(applyMove(applyMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4"), "d7d5"), "e4d5"), "d8d5"));
    await crowdMove(b.r);
    await b.r.playBoss(fakeEngine());
    expect(powersOf(b.r).balloon!.last).toMatchObject({ outcome: "land", shape: "r" });
  });

  it("weighs at most balloonLooks squares, the same pick everywhere for the same ask", async () => {
    const a = (await landFrom([materialEngine()], QUIET, { shape: "b", order: 5, blocks: [] }))!;
    const b = (await landFrom([materialEngine()], QUIET, { shape: "b", order: 5, blocks: [] }))!;
    expect(a).toEqual(b);
    expect(a.looks).toBeLessThanOrEqual(S.balloonLooks);
  });
});

// ---------------- The walls ----------------

describe("Hoops: the walls", () => {
  it("the blocks: 2x2 within ranks 2 to 7, any files, apart (not touching, sides or corners)", () => {
    expect(HOOP_CORNERS).toHaveLength(35);
    expect(hoopSquares("c3")).toEqual(["c3", "d3", "c4", "d4"]);
    for (const c of HOOP_CORNERS) for (const sq of hoopSquares(c)) expect(["1", "8"]).not.toContain(sq[1]);
    expect(hoopsValid(["a2"])).toBe(true);
    expect(hoopsValid(["g6"])).toBe(true);
    for (const bad of ["a1", "h3", "a7", "c8", "z3", ""]) expect(hoopsValid([bad]), bad).toBe(false);
    expect(hoopsTouch("c3", "e3")).toBe(true);
    expect(hoopsTouch("c3", "e5")).toBe(true);
    expect(hoopsTouch("c3", "f3")).toBe(false);
    expect(hoopsTouch("c3", "c6")).toBe(false);
    expect(hoopsValid(["a3", "d3", "g3"])).toBe(true);
    expect(hoopsValid(["a3", "c3"])).toBe(false);
    expect(hoopsValid(["a3", "a3"])).toBe(false);
    expect(hoopsValid(["a2", "d2", "g2", "a5"])).toBe(false);
  });

  // White: Kg1, Rd1, Nb2; Black: Kg8, a knight on d4. One hoop at c4 (c4, d4, c5, d5).
  const W = "6k1/8/8/8/3n4/8/1N6/3R2K1 w - - 0 1";
  const C4 = ["c4"];

  it("no move into a block, nor out of it, nor through it, sliding or jumping; a capture across neither", () => {
    expect(hoopStops("d1d3", W, C4)).toBe(false);
    expect(hoopStops("d1d4", W, C4)).toBe(true); // a capture across the wall
    expect(hoopStops("b2c4", W, C4)).toBe(true); // a knight jumping in
    expect(hoopStops("b2d3", W, C4)).toBe(false); // a knight jumping past, outside to outside
    expect(hoopStops("b2a4", W, C4)).toBe(false);
    // Black's knight inside: every move out is stopped (none within a 2x2 for a knight).
    const B = W.replace(" w ", " b ");
    for (const m of legalMoves(B).filter((x) => x.startsWith("d4"))) expect(hoopStops(m, B, C4), m).toBe(true);
    // A slider through a block, outside to outside: stopped.
    const R = "6k1/8/8/8/R7/8/8/6K1 w - - 0 1";
    expect(hoopStops("a4h4", R, C4)).toBe(true);
    expect(hoopStops("a4b4", R, C4)).toBe(false);
    expect(hoopStops("a4a8", R, C4)).toBe(false); // (Ra8+: a check along the eighth rank, outside the block)
    expect(crossesHoop("a4a8", R, C4)).toBe(false);
  });

  it("pieces inside move within their block", () => {
    const P = "6k1/8/8/2b5/8/8/8/7K b - - 0 1";
    expect(hoopStops("c5d4", P, C4)).toBe(false);
    expect(hoopStops("c5e3", P, C4)).toBe(true);
    expect(hoopStops("c5b6", P, C4)).toBe(true);
    expect(hoopMoves(P, C4).filter((m) => m.startsWith("c5"))).toEqual(["c5d4"]);
  });

  it("a capture en passant across a wall is stopped (the pawn taken is inside)", () => {
    const EP = "4k3/8/8/8/2pP4/8/8/4K3 b - d3 0 1";
    expect(legalMoves(EP)).toContain("c4d3");
    expect(crossesHoop("c4d3", EP, ["d4"])).toBe(true);
    expect(crossesHoop("c4d3", EP, [])).toBe(false);
  });

  it("no attack across a wall, so no check across one: a move that would leave a king attacked across it isn't played", () => {
    // White's rook to a4 would attack Black's king on h4 through the hoop at d4 (d4, e4, d5, e5).
    const X = "8/8/8/8/7k/8/8/R5K1 w - - 0 1";
    expect(attackAcross(applyMove(X, "a1a4"), ["d4"])).toBe(true);
    expect(hoopStops("a1a4", X, ["d4"])).toBe(true);
    expect(hoopStops("a1a3", X, ["d4"])).toBe(false);
    // A knight checking from outside a king inside a block: across the wall, so never played.
    const N = "8/8/8/2k5/8/8/8/N5K1 w - - 0 1";
    expect(hoopStops("a1b3", N, C4)).toBe(true);
    expect(hoopStops("a1c2", N, C4)).toBe(false);
    // (And a check that doesn't cross: allowed as ever.)
    expect(hoopStops("a1b3", N, [])).toBe(false);
  });

  it("check and mate detection with walls: a check whose answers the walls stop lifts them for the turn (no false mate)", () => {
    // White in check from the rook on a1; the only answers, Kd2 and Ke2, go into the hoop at d2.
    const F = "6k1/8/8/8/7b/8/8/r3K3 w - - 0 1";
    expect(legalMoves(F).sort()).toEqual(["e1d2", "e1e2"]);
    expect(hoopMoves(F, ["d2"])).toEqual([]);
    const boss = { id: "tiger", crowdSide: "w" as const, crowdMoves: 3, powers: { seed: 1, turn: 4, material: 39, lost: 0, nextPassive: 2, events: [], hoops: { blocks: ["d2"], at: 2, left: 1, gain: null } } } as never;
    expect(crowdAllowed(boss, F)).toBeNull();
    // Not in check, every move walled: no stalemate either, the walls lift.
    const T = "6k1/8/8/8/8/3b4/8/K7 w - - 0 1";
    expect(legalMoves(T).sort()).toEqual(["a1a2", "a1b2"]);
    expect(hoopMoves(T, ["a2"])).toEqual([]);
    const boss2 = { ...(boss as object), powers: { ...(boss as { powers: object }).powers, hoops: { blocks: ["a2"], at: 2, left: 1, gain: null } } } as never;
    expect(crowdAllowed(boss2, T)).toBeNull();
    // A real mate stays a mate (no legal move at all).
    const M = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
    const mate = applyMove(M, "a1a8");
    expect(inCheck(mate) && legalMoves(mate).length === 0).toBe(true);
  });

  it("his own moves obey the walls too (bossStops), his search picks only from the moves they leave, and the screens' words say why", async () => {
    const b = battle(21);
    // Him Black to move: his knight on d4 inside the hoop at c4, his rook on h4 behind the block's rank.
    const fen = "6k1/8/8/8/3n3r/8/8/6K1 b - - 0 1";
    onPosition(b.r, fen, "w", { hoops: { blocks: ["c4"], at: 0, left: 1, gain: null } });
    const allowed = bossAllowed(b.r.state.boss, fen)!;
    expect(allowed).not.toContain("h4a4");
    expect(allowed.some((m) => m.startsWith("d4"))).toBe(false);
    expect(allowed).toContain("h4e4");
    expect(stopReason(b.r.bossView()!, fen, "h4a4")).toBe("hoop");
    // An engine that loves the move through the block: he plays one the walls leave.
    const greedy: EngineLike = {
      topMoves: async (f, n) => legalMoves(f).map((move) => ({ move, expected: move === "h4a4" ? 0.99 : 0.4 })).sort((x, y) => y.expected - x.expected).slice(0, n),
      topMovesAt: async (f, n, _nodes, only) => (only ?? legalMoves(f)).map((move) => ({ move, expected: move === "h4a4" ? 0.99 : 0.4 })).sort((x, y) => y.expected - x.expected).slice(0, n),
      scoreMoves: async (f, moves) => moves.map((move) => ({ move, expected: move === "h4a4" ? 0.99 : 0.4 })),
      playAtElo: async () => "h4a4",
    };
    const move = await b.r.playBoss(greedy);
    expect(allowed).toContain(move);
  });
});

// ---------------- The cast ----------------

describe("Hoops: the cast", () => {
  it("hoopsGuard: the crowd always has a move with the walls up, no mate in one for either side, no king in check", () => {
    const quiet = "1nb3k1/pp3pp1/2p1p3/3p4/3P4/2P1P3/PP3PPP/1NB3K1 w - - 0 13";
    expect(hoopsGuard(quiet, ["a3"])).toBe(true);
    // The crowd's lone king boxed in by a hoop around it and no other move: refused.
    const lone = "7k/8/8/8/8/8/1K6/8 w - - 0 1";
    expect(hoopsGuard(lone, ["a2"])).toBe(true); // (it moves within the block)
    const check = "6k1/8/8/8/7b/8/8/r3K3 w - - 0 1";
    expect(hoopsGuard(check, ["d2"])).toBe(false);
  });

  it("the order: the blocks that stop the most of the crowd's moves first, an inner one (within ranks 3 to 6) counting more, ties seeded", () => {
    // (A queen in the middle: a block around her stops the most.)
    const fen = "6k1/8/8/8/3Q4/8/8/6K1 w - - 0 1";
    const o = hoopOrder(fen, [], 42, 0);
    expect(o).toHaveLength(35);
    const bite = (c: string) => legalMoves(fen).filter((m) => crossesHoop(m, fen, [c])).length + (Number(c[1]) >= 3 && Number(c[1]) <= 5 ? 3 : 0);
    for (let i = 1; i < o.length; i++) expect(bite(o[i - 1]!)).toBeGreaterThanOrEqual(bite(o[i]!));
    expect(["c3", "d3", "c4", "d4"]).toContain(o[0]);
    expect(hoopOrder(fen, [], 42, 0)).toEqual(o);
    // (With nothing to bite on, the inner ranks first, in a seeded order.)
    const empty = "k7/8/8/8/8/8/8/7K w - - 0 1";
    const e = hoopOrder(empty, [], 42, 0);
    expect(e.slice(0, 21).every((c) => Number(c[1]) >= 3 && Number(c[1]) <= 5)).toBe(true);
    expect(hoopOrder(empty, [], 43, 0)).not.toEqual(e);
  });

  const START = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 5 4";

  it("hoopsFrom: three blocks apart in the inner ranks, block by block, his gain in the band nearest its target", async () => {
    const pick = (await hoopsFrom([mobilityEngine()], START, { order: 9 }))!;
    expect(pick).not.toBeNull();
    expect(pick.blocks).toHaveLength(3);
    expect(hoopsValid(pick.blocks)).toBe(true);
    for (const c of pick.blocks) expect(Number(c[1])).toBeGreaterThanOrEqual(3);
    expect(hoopsGuard(pick.fen, pick.blocks)).toBe(true);
    expect(pick.looks).toBeLessThanOrEqual(S.hoopsLooks * S.hoopsCount);
    expect(sideToMove(pick.fen)).toBe("w");
    // (The same answer everywhere for the same ask; the server's check accepts it.)
    expect(await hoopsFrom([mobilityEngine()], START, { order: 9 })).toEqual(pick);
    expect(hoopsCheck(START, pick.blocks.join(" "))).toMatchObject({ blocks: pick.blocks, land: null });
  });

  it("past hoopsTimeMs it answers in time with the blocks placed so far (at least one)", async () => {
    let t = 0;
    const slow: EngineLike = { ...mobilityEngine(), topMovesAt: async (f, n, nodes, only) => ((t += 3_000), mobilityEngine().topMovesAt!(f, n, nodes, only)) };
    const pick = (await hoopsFrom([slow], START, { order: 9 }, BOSS_POWERS, () => t))!;
    expect(pick.late).toBe(true);
    expect(pick.blocks.length).toBeGreaterThanOrEqual(1);
    expect(pick.blocks.length).toBeLessThan(3);
    expect(hoopsCheck(START, pick.blocks.join(" "))).not.toBeNull();
  });

  it("hoopsCheck refuses what isn't a cast: junk, a block on rank 1 or 8, touching blocks, more than three, a position the guards refuse", () => {
    for (const bad of ["", "junk", "a1", "h3", "c3 d4", "a2 d2 g2 a5", "c3 c3"]) expect(hoopsCheck(START, bad), bad).toBeNull();
    expect(hoopsCheck(START, "c3 f5 @e4")).toMatchObject({ blocks: ["c3", "f5"], land: "e4" });
    expect(hoopsCheck(START, "c3 @e4 @e5")).toBeNull();
    expect(hoopsCheck("6k1/8/8/8/7b/8/8/r3K3 b - - 0 1", "a3")).toBeNull();
  });

  it("the pass guard: a cast that loses him real material waits (PASS_WAIT), unless it's the test switch's or the trigger's", async () => {
    const lose: EngineLike = { ...mobilityEngine(), topMovesAt: async (f, n, _nodes, only) => (only ?? legalMoves(f)).slice(0, n).map((move) => ({ move, expected: sideToMove(f) === "b" ? 0.5 : 0.99 })) };
    expect((await hoopsAnswer([lose], START, { order: 1 })).answer).toBe(PASS_WAIT);
    const any = await hoopsAnswer([lose], START, { order: 1 }, null, true);
    expect(any.answer).not.toBe(PASS_WAIT);
    expect(hoopsCheck(START, any.answer)).not.toBeNull();
  });
});

describe("Hoops in a battle", () => {
  async function toCast(b: Battle) {
    for (let i = 0; i < 20 && !b.r.hoopsDue(); i++) await step(b);
    expect(b.r.hoopsDue()).toBe(true);
  }

  it("his whole turn at the start of his turn after the warning: the turn passes (a base at its ply), the cast's moment first, then a due balloon's", async () => {
    const b = battle(31, { test: "hoops", balloon: "pawn", stage: 4 });
    await toCast(b);
    const ply = b.r.boards.get(b.r.state.boards[0]!)!.history.length;
    const h = (await b.r.playHoops([fakeEngine()]))!;
    expect(h).not.toBeNull();
    expect(hoopsValid(h.blocks)).toBe(true);
    const board = b.r.boards.get(b.r.state.boards[0]!)!;
    expect(sideToMove(board.fen)).toBe(b.r.boss!.crowdSide);
    expect(board.history).toHaveLength(ply);
    expect(fenAtPly(board.history, ply, board.bases)).toBe(board.fen);
    const p = powersOf(b.r);
    expect(p.hoops).toMatchObject({ blocks: h.blocks, at: b.r.boss!.crowdMoves, left: 2 });
    expect(p.ults).toBe(1);
    const kinds = tigerEvents(p.events).map((e) => e.kind);
    expect(kinds[0]).toBe("hoops");
    expect(p.events.find((e) => e.kind === "hoops")).toMatchObject({ blocks: h.blocks });
    // (A due pawn balloon landed after the cast, outside the hoops.)
    const last = p.balloon!.last!;
    expect(kinds.slice(1)).toEqual(last.outcome === "land" ? ["balloonLand", "balloonCheer"] : ["pop", "wince"]);
    if (last.outcome === "land") for (const c of h.blocks) expect(inHoop(c, last.square!)).toBe(false);
    expect(powerTurn(b.r.state.boss!)).toBe(true);
    expect(b.r.bossView()!.powers!.hoops).toEqual({ blocks: h.blocks, left: 2 });
  });

  it("the walls stand for exactly the crowd's next 2 moves (his move between them too), then go out (`hoopsOut`) as the second lands", async () => {
    const b = battle(32, { test: "hoops" });
    await toCast(b);
    const h = (await b.r.playHoops([fakeEngine()]))!;
    const blocks = h.blocks;
    // Crowd move 1: only moves the walls leave.
    let fen = fenOf(b.r);
    b.r.deal();
    const allowed1 = b.r.crowdAllowed() ?? legalMoves(fen);
    for (const m of allowed1) expect(hoopStops(m, fen, blocks)).toBe(false);
    await crowdMove(b.r);
    expect(powersOf(b.r).hoops).toMatchObject({ left: 1 });
    // His move: the walls too.
    fen = fenOf(b.r);
    const his = b.r.bossAllowed() ?? legalMoves(fen);
    for (const m of his) expect(hoopStops(m, fen, blocks)).toBe(false);
    await b.r.playBoss(fakeEngine());
    expect(b.r.bossView()!.powers!.hoops).toEqual({ blocks, left: 1 });
    // Crowd move 2.
    fen = fenOf(b.r);
    b.r.deal();
    for (const m of b.r.crowdAllowed() ?? legalMoves(fen)) expect(hoopStops(m, fen, blocks)).toBe(false);
    await crowdMove(b.r);
    // Gone as it lands: his next move free; their going out a moment while he thinks.
    expect(powersOf(b.r).hoops ?? null).toBeNull();
    expect(powersOf(b.r).events.filter((e) => e.kind === "hoopsOut")).toEqual([{ kind: "hoopsOut", turn: powersOf(b.r).turn, blocks }]);
    expect(b.r.bossAllowed()).toBeNull();
    // (The meter fills again from the crowd's next turn.)
    await b.r.playBoss(fakeEngine());
    expect(powersOf(b.r).ultAt).toBeUndefined();
  });

  it("the host's answer is checked: junk, \"\" or PASS_WAIT and the cast waits for his next turn, and he moves (a due balloon still ends his turn)", async () => {
    for (const junk of ["", "zz", PASS_WAIT, "a1 b1", null]) {
      const b = battle(33, { test: "hoops", balloon: "knight", stage: 4 });
      await toCast(b);
      onPosition(b.r, QUIET_B, "w", { ...(powersOf(b.r).balloon?.nozzle ? {} : {}) });
      b.r.balloonAsk();
      expect(b.r.applyHoops(junk)).toBeNull();
      expect(b.r.hoopsDue()).toBe(false);
      expect(b.r.bossToMove()).toBe(true);
      expect(powersOf(b.r).hoopsWait).toBe(b.r.boss!.crowdMoves);
      await b.r.playBoss(fakeEngine());
      expect(powersOf(b.r).balloon!.last).toMatchObject({ outcome: "land", shape: "n" });
      // (Again at the start of his next turn, the warning staying.)
      await crowdMove(b.r);
      expect(b.r.hoopsDue()).toBe(true);
    }
  });

  it("no block fits: no cast (the meter stays full) and he moves", async () => {
    const b = battle(34, { test: "hoops" });
    await toCast(b);
    const none: EngineLike = { topMoves: async () => [], scoreMoves: async () => [], topMovesAt: async () => [] };
    expect(await b.r.playHoops([none])).toBeNull();
    expect(powersOf(b.r).ultAt).toBeUndefined();
    expect(powersOf(b.r).warnAt).toBeDefined();
    expect(b.r.bossToMove()).toBe(true);
  });

  it("the admins' trigger brings it at the start of his next turn, without the warning", async () => {
    const b = battle(35);
    for (let i = 0; i < 4; i++) await step(b);
    expect(b.r.triggerUltimate()).toBe(true);
    for (let i = 0; i < 4 && !b.r.hoopsDue(); i++) await step(b);
    expect(b.r.hoopsDue()).toBe(true);
    expect(b.r.hoopsAny()).toBe(true);
    expect(powersOf(b.r).events.some((e) => e.kind === "warn")).toBe(false);
  });
});

describe("the circus tiger: a small fuzz of whole battles", () => {
  it("every position the engine plays, no move across a standing wall, every landing where its rules allow, the replay from the base", async () => {
    let casts = 0;
    let landed = 0;
    let popped = 0;
    for (let seed = 41; seed < 45; seed++) {
      const b = battle(seed, { test: "hoops", side: seed % 2 ? "w" : "b", stage: seed % 3 === 0 ? 4 : undefined });
      for (let i = 0; i < 70 && !b.r.isOver(); i++) {
        if (b.r.stageComplete()) break;
        const fen = fenOf(b.r);
        const blocks = powersOf(b.r).hoops?.blocks ?? [];
        const lastBefore = powersOf(b.r).balloon?.last ?? null;
        const histBefore = b.r.boards.get(b.r.state.boards[0]!)!.history.length;
        const castBefore = powersOf(b.r).ults ?? 0;
        await step(b, 9_000);
        const board = b.r.boards.get(b.r.state.boards[0]!)!;
        // (A move played across a standing wall only when the walls left that side no move at all.)
        if (blocks.length && board.history.length > histBefore) {
          const played = board.history[histBefore]!;
          if (hoopStops(played, fen, blocks)) expect(hoopMoves(fen, blocks)).toEqual([]);
        }
        if ((powersOf(b.r).ults ?? 0) > castBefore) casts++;
        const last = powersOf(b.r).balloon?.last ?? null;
        if (last && last !== lastBefore && last.at !== lastBefore?.at) {
          if (last.outcome === "land") {
            landed++;
            expect(pieceAt(board.fen, last.square!)?.type).toBe(last.shape);
            for (const c of powersOf(b.r).hoops?.blocks ?? []) expect(inHoop(c, last.square!)).toBe(false);
          } else popped++;
        }
        expect(stockfishRefuses(board.fen)).toBeNull();
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
        expect(JSON.stringify(b.r.bossView())).not.toMatch(/"dud"/);
      }
    }
    expect(casts).toBeGreaterThan(3);
    expect(landed).toBeGreaterThan(3);
    expect(popped).toBeGreaterThan(0);
  }, 120_000);
});
