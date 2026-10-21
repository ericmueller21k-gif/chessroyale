import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, GARDENER_NAME, bossInText, isPlayable, mulberry32, type BossPowerSettings, type WaterKind } from "@chessroyale/core";
import {
  GARDENER_ANIM,
  GARDENER_FX,
  GARDEN_ART,
  MatchRunner,
  PASS_WAIT,
  POWER_FX,
  WATER_BEATS,
  applyMove,
  bossRules,
  crowdAllowed,
  bossAllowed,
  fenAtPly,
  growthAt,
  legalMoves,
  materialOf,
  pieceAt,
  powerMomentMs,
  powerTurn,
  reactionOf,
  rollSeed,
  seedFill,
  seedsAt,
  sideToMove,
  stockfishRefuses,
  stopReason,
  triggerUltimate,
  waterAnswer,
  waterCheck,
  waterFrom,
  waterGuard,
  waterMs,
  type EngineLike,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * The hippo gardener (docs/decisions/2026-10-21-gardener-rules.md): Seeds (a public count on a real-time meter) and
 * Watering (his whole turn: every waiting seed rolls an outcome, placed by the engine within a fair band).
 */

const S = BOSS_POWERS;
const EVERY = S.seedEverySec * 1000;

/**
 * A quiet position, him (Black) to move: no capture for either side, Black a pawn short (seven: a grown pawn fits), no
 * queens. Every square below is empty unless named.
 */
const QUIET = "1nb3k1/pp3pp1/2p1p3/3p4/3P4/2P1P3/PP3PPP/1NB3K1 b - - 0 12";

/**
 * An engine that counts material, one ply deep: the mover's expected score after each move is its material lead then (a
 * pawn a unit, bouncePawnLogit per pawn), so a watering's gain is the material it changes, give or take a capture the
 * crowd can make at once.
 */
function materialEngine(): EngineLike {
  const score = (fen: string, move: string) => {
    const after = applyQuiet(fen, move);
    const me = sideToMove(fen);
    const lead = materialOf(after, me) - materialOf(after, me === "w" ? "b" : "w");
    return 1 / (1 + Math.exp(-lead * S.bouncePawnLogit));
  };
  const ranked = (fen: string) => legalMoves(fen).map((move) => ({ move, expected: score(fen, move) })).sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1));
  return {
    topMoves: async (fen, n) => ranked(fen).slice(0, n),
    topMovesAt: async (fen, n) => ranked(fen).slice(0, n),
    scoreMoves: async (fen, moves) => moves.map((move) => ({ move, expected: score(fen, move) })),
    scoreMovesAt: async (fen, moves) => moves.map((move) => ({ move, expected: score(fen, move) })),
  };
}
const applyQuiet = (fen: string, move: string) => applyMove(fen, move);

/** An engine that sees only the material on the board (no move changes it): a grown piece is worth its value anywhere. */
function staticEngine(): EngineLike {
  const score = (fen: string) => {
    const me = sideToMove(fen);
    const lead = materialOf(fen, me) - materialOf(fen, me === "w" ? "b" : "w");
    return 1 / (1 + Math.exp(-lead * S.bouncePawnLogit));
  };
  return {
    topMoves: async (fen, n) => legalMoves(fen).slice(0, n).map((move) => ({ move, expected: score(fen) })),
    scoreMoves: async (fen, moves) => moves.map((move) => ({ move, expected: score(fen) })),
  };
}

/** An engine whose best move is the king's shuffle (g8-f8, f8-g8), for a battle whose boss moves must stay out of the way. */
function shuffleEngine(): EngineLike {
  const ranked = (fen: string) => legalMoves(fen).map((move) => ({ move, expected: move === "g8f8" || move === "f8g8" ? 0.9 : 0.1 })).sort((a, b) => b.expected - a.expected);
  return { topMoves: async (fen, n) => ranked(fen).slice(0, n), topMovesAt: async (fen, n) => ranked(fen).slice(0, n), scoreMoves: async (fen, moves) => ranked(fen).filter((m) => moves.includes(m.move)), playAtElo: async (fen) => ranked(fen)[0]!.move };
}

function battle(seed: number, opts: { test?: string; seeds?: number; clock?: () => number; side?: "w" | "b" } = {}) {
  const settings = kitSettings({ boss: "gardener", test: opts.test ?? "", maxMoves: 40 }, opts.seeds !== undefined ? { bossSeedTest: opts.seeds } : {});
  return new MatchRunner({ settings, rng: mulberry32(seed), engines: [fakeEngine()], library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: opts.side ?? "w", ...(opts.clock ? { clock: opts.clock } : {}) });
}
const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const gardenOf = (r: MatchRunner) => r.boss!.powers!.garden!;

/** One step of the battle: the crowd's move (`pick`), or his turn (the watering when it's due, else his move). */
async function step(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string, engines: EngineLike[] = [fakeEngine()]) {
  if (r.bossToMove()) {
    if (r.waterDue()) await r.playWater(engines);
    if (r.bossToMove()) await r.playBoss(engines[0]!);
    return;
  }
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : crowdPick(fen, allowed, mulberry32(fen.length));
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

/** Puts a battle on a position of our own, him to move after crowd move `at`, with a roll of our own due now. */
function onPosition(r: MatchRunner, fen: string, kinds: WaterKind[], plants: string[] = []) {
  const id = r.state.boards[0]!;
  const board = r.boards.get(id)!;
  r.boards.set(id, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
  const boss = r.state.boss!;
  const at = boss.crowdMoves;
  const p = boss.powers!;
  r.state = {
    ...r.state,
    boss: {
      ...boss,
      crowdSide: sideToMove(fen) === "w" ? "b" : "w",
      powers: { ...p, warnAt: at, ultAt: undefined, garden: { ...p.garden!, plants: plants.map((square) => ({ square, at: at - 1, until: at + 2 })), roll: { at, clock: 0, seeds: kinds.length, kinds } } },
    },
  };
}

describe("the hippo gardener: his sheet", () => {
  it("is on the roster as Puddles, a hippo, not playable until wired, with Seeds and Watering", () => {
    const def = BOSS_ROSTER.find((b) => b.id === "gardener")!;
    expect(def).toMatchObject({ name: GARDENER_NAME, icon: "🦛", kit: null, powers: { passive: "seeds", ultimate: "water" } });
    expect(GARDENER_NAME).toBe("Puddles");
    // (A plain name: no "the", at a sentence's start or in its middle.)
    expect(def.the).toBeUndefined();
    expect(bossInText(def.name, true)).toBe("Puddles");
    expect(bossInText(def.name)).toBe("Puddles");
    expect(isPlayable(def)).toBe(false);
    expect(bossRules({ id: "gardener" })?.id).toBe("gardener");
  });

  it("his numbers: 5 seeds, one every 30 s, up to 10; the odds add to 100; plants for 3 turns; the band and the jackpot", () => {
    expect([S.seedsAtStart, S.seedEverySec, S.seedMax]).toEqual([5, 30, 10]);
    expect(S.waterOdds).toEqual({ nothing: 40, plant: 30, killer: 12, pawn: 12, piece: 5, queen: 1 });
    expect(Object.values(S.waterOdds).reduce((a, b) => a + b, 0)).toBe(100);
    expect(S.plantTurns).toBe(3);
    expect([S.waterBand, S.waterTarget, S.jackpotMax]).toEqual([[0.5, 2.5], 1.5, 6]);
    expect(S.rageSpeed.gardener).toBeGreaterThan(0);
  });

  it("his moments' lengths come from his animations: the server waits for the watering, never for the seeds", () => {
    expect(GARDENER_ANIM).toMatchObject({ plant: 740, plantMany: 800, water: 1340, cheer: 720, bigCheer: 1200, shrug: 800 });
    expect(GARDEN_ART).toMatchObject({ kill: 870, killSnap: 350, bud: 550, budQueen: 630, budPop: 270, grow: 290, wilt: 490 });
    expect(POWER_FX.plant).toBe(0);
    expect(POWER_FX.plantMany).toBe(0);
    expect([POWER_FX.water, POWER_FX.cheer, POWER_FX.bigCheer, POWER_FX.shrug]).toEqual([1340, 720, 1200, 800]);
    expect(GARDENER_FX.water).toBe(GARDENER_ANIM.water);
    // (The watering: its cast, then each outcome in turn, the longest last.)
    const growth = [{ kind: "killer" as const }, { kind: "q" as const }, { kind: "plant" as const }, { kind: "nothing" as const }];
    expect(waterMs([])).toBe(1340);
    expect(waterMs(growth)).toBe(growthAt(3) + GARDEN_ART.wilt);
    expect(growthAt(0)).toBe(WATER_BEATS.growAt);
    expect(powerMomentMs([{ kind: "plantMany" }, { kind: "water", growth } as never, { kind: "bigCheer" }])).toBe(waterMs(growth) + 1200);
  });
});

describe("Seeds: the count as a pure function of the clock", () => {
  it("5 as the battle begins, one more every 30 s, capped at 10, and the next one's time", () => {
    const g = { since: 1_000, base: 5 };
    expect(seedsAt(g, 1_000)).toEqual({ count: 5, next: 1_000 + EVERY });
    expect(seedsAt(g, 1_000 + EVERY - 1).count).toBe(5);
    expect(seedsAt(g, 1_000 + EVERY)).toEqual({ count: 6, next: 1_000 + 2 * EVERY });
    expect(seedsAt(g, 1_000 + 4 * EVERY + 5).count).toBe(9);
    expect(seedsAt(g, 1_000 + 5 * EVERY)).toEqual({ count: 10, next: null });
    expect(seedsAt(g, 1_000 + 500 * EVERY)).toEqual({ count: 10, next: null });
    // (A clock read before the meter started: none grown.)
    expect(seedsAt(g, 0).count).toBe(5);
    // (The meter's fill toward the next one.)
    expect(seedFill(g, 1_000)).toBe(0);
    expect(seedFill(g, 1_000 + EVERY / 2)).toBeCloseTo(0.5);
    expect(seedFill(g, 1_000 + 5 * EVERY)).toBe(1);
    // (The test switch: its set count, whatever the clock.)
    expect(seedsAt({ ...g, fixed: 10 }, 0)).toEqual({ count: 10, next: null });
    expect(seedsAt({ ...g, fixed: 0 }, 1_000 + 9 * EVERY).count).toBe(0);
  });

  it("the battle's meter runs on the runner's clock from the battle's start; the watering takes the count and resets it from that moment", async () => {
    let now = 50_000;
    const r = battle(3, { test: "water", clock: () => now });
    expect(gardenOf(r)).toMatchObject({ since: 50_000, base: 5, plants: [], waterings: 0 });
    // (The opening toss as the first crowd turn begins: five seeds.)
    expect(r.boss!.powers!.events).toContainEqual({ kind: "plantMany", turn: 1, seeds: 5 });
    // Two crowd moves and his, 75 s in all: two more seeds.
    for (let i = 0; i < 40 && !r.waterDue(); i++) {
      now += 15_000;
      if (r.bossToMove()) await r.playBoss(fakeEngine());
      else await step(r);
    }
    expect(r.waterDue()).toBe(true);
    const counted = seedsAt(gardenOf(r), now).count;
    expect(counted).toBeGreaterThan(5);
    const ask = r.waterAsk()!;
    expect(ask.kinds).toHaveLength(counted);
    // (Taken once: asked again later, the same roll.)
    now += 60_000;
    expect(r.waterAsk()!.kinds).toEqual(ask.kinds);
    const takenAt = now - 60_000;
    const w = await r.playWater([fakeEngine()]);
    expect(w).not.toBeNull();
    expect(w!.seeds).toBe(counted);
    // (Reset to none from the moment the count was taken: the minute since has grown two already.)
    expect(gardenOf(r)).toMatchObject({ since: takenAt, base: 0, waterings: 1 });
    expect(seedsAt(gardenOf(r), now).count).toBe(2);
    expect(r.bossView()!.powers!.garden).toMatchObject({ since: takenAt, base: 0, fixed: null, waterings: 1 });
  });

  it("without a clock (tests, the sims), each crowd move counts as one seed's time", async () => {
    const r = battle(5);
    expect(gardenOf(r)).toMatchObject({ since: 0, base: 5 });
    await step(r);
    await step(r);
    expect(r.clockNow()).toBe(EVERY);
  });
});

describe("Watering: the rolls", () => {
  it("each seed's outcome is seeded (the same everywhere) and over many seeds keeps the sheet's odds", () => {
    expect(rollSeed(7, 0, 3)).toBe(rollSeed(7, 0, 3));
    const n = 40_000;
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const k = rollSeed(i * 7919, Math.floor(i / 10), i % 10);
      count[k] = (count[k] ?? 0) + 1;
    }
    const pct = (k: string) => (100 * (count[k] ?? 0)) / n;
    expect(pct("nothing")).toBeCloseTo(40, -0.3);
    expect(pct("plant")).toBeCloseTo(30, -0.3);
    expect(pct("killer")).toBeCloseTo(12, -0.3);
    expect(pct("p")).toBeCloseTo(12, -0.3);
    expect(pct("n") + pct("b") + pct("r")).toBeCloseTo(5, -0.3);
    for (const k of ["n", "b", "r"]) expect(pct(k)).toBeGreaterThan(1.2);
    expect(pct("q")).toBeGreaterThan(0.6);
    expect(pct("q")).toBeLessThan(1.4);
    // (Other odds: all of one kind.)
    const all = { ...S, waterOdds: { nothing: 0, plant: 0, killer: 0, pawn: 0, piece: 0, queen: 100 } } as BossPowerSettings;
    expect(rollSeed(1, 0, 0, all)).toBe("q");
  });
});

describe("Watering: each outcome and its guards (waterCheck: the server's check of the host's answer, and solo's)", () => {
  const ask = (kinds: WaterKind[], plants: string[] = []) => ({ kinds, plants });

  it("a plain plant on an empty square; a killer plant on a non-king piece of either side; a grown piece of his on an empty square", () => {
    const plant = waterCheck(QUIET, ask(["plant"]), "te4")!;
    expect(plant.plants).toEqual(["e4"]);
    expect(sideToMove(plant.fen)).toBe("w");
    expect(plant.fen.split(" ")[0]).toBe(QUIET.split(" ")[0]);
    const kill = waterCheck(QUIET, ask(["killer"]), "xa2")!;
    expect(pieceAt(kill.fen, "a2")).toBeNull();
    const own = waterCheck(QUIET, ask(["killer"]), "xa7")!;
    expect(pieceAt(own.fen, "a7")).toBeNull();
    const grown = waterCheck(QUIET, ask(["p", "n"]), "pa5 nf5")!;
    expect(pieceAt(grown.fen, "a5")).toEqual({ color: "b", type: "p" });
    expect(pieceAt(grown.fen, "f5")).toEqual({ color: "b", type: "n" });
    // (Nothing at all: the pass alone.)
    expect(waterCheck(QUIET, ask(["nothing"]), "none")!.placed).toEqual([]);
  });

  it("refuses what wasn't rolled, a square used twice, an occupied square, a plant's square, a king, a pawn on a first or last rank", () => {
    expect(waterCheck(QUIET, ask(["plant"]), "xa2")).toBeNull();
    expect(waterCheck(QUIET, ask(["plant"]), "te4 te5")).toBeNull();
    expect(waterCheck(QUIET, ask(["plant", "p"]), "te4 pe4")).toBeNull();
    expect(waterCheck(QUIET, ask(["plant"]), "td4")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"], ["e4"]), "pe4")).toBeNull();
    expect(waterCheck(QUIET, ask(["killer"]), "xg1")).toBeNull();
    expect(waterCheck(QUIET, ask(["killer"]), "xg8")).toBeNull();
    expect(waterCheck(QUIET, ask(["killer"]), "xe4")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"]), "pa8")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"]), "pe1")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"]), "pz9")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"]), "")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"]), "move e2e4")).toBeNull();
  });

  it("never a ninth pawn of his, nor more pieces than promotions could make (positions the engine refuses)", () => {
    const one = waterCheck(QUIET, ask(["p", "p"]), "pa5")!;
    expect(one).not.toBeNull();
    expect(waterCheck(QUIET, ask(["p", "p"]), "pa5 ph5")).toBeNull();
    for (const sq of ["a5", "h5", "h6", "a4"]) expect(stockfishRefuses(waterCheck(QUIET, ask(["p"]), `p${sq}`)?.fen ?? QUIET)).toBeNull();
  });

  it("never either side in check, never a mate in one for either side, never the crowd without a move (plants counted)", () => {
    // A grown piece giving check: refused.
    expect(waterCheck(QUIET, ask(["n"]), "nf3")).toBeNull();
    expect(waterCheck(QUIET, ask(["p"]), "ph2")).toBeNull();
    // A killer plant opening a check on his king: White's Bb5 against his king on e8 behind the pawn on d7.
    const pin = "4k3/3p4/8/1B6/8/8/8/4K3 b - - 0 30";
    expect(waterCheck(pin, ask(["killer"]), "xd7")).toBeNull();
    // A mate in one for the crowd: his back rank shut by his own pawns, the crowd's rook on the open file.
    const backRank = "6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 30";
    expect(waterGuard(backRank.replace(" b ", " w "), [])).toBe(false);
    // One for him were the crowd to pass: his queen and rook lined up on the crowd's king.
    const his = "1q5k/8/8/8/8/8/6PP/1r4K1 b - - 0 30";
    expect(waterCheck("1q5k/8/8/8/8/8/6PP/6K1 b - - 0 30", ask(["r"]), "rb1")).toBeNull();
    expect(waterGuard(his.replace(" b ", " w "), [])).toBe(false);
    // The crowd without a move: plants on every square its last pieces could use.
    const box = "7k/8/8/8/8/8/8/K7 b - - 0 40";
    expect(waterCheck(box, ask(["plant", "plant", "plant"]), "ta2 tb1 tb2")).toBeNull();
    expect(waterCheck(box, ask(["plant", "plant"]), "ta2 tb1")).not.toBeNull();
  });
});

describe("Watering: the engine's placement within the band", () => {
  const engines = [materialEngine()];
  const ask = (kinds: WaterKind[], plants: string[] = [], order = 1) => ({ kinds, plants, order });

  it("a pawn and a killer plant land in the band, nearest its target; the answer passes the server's check", async () => {
    const pick = (await waterFrom(engines, QUIET, ask(["p", "nothing", "killer"])))!;
    expect(pick.gain).toBeGreaterThanOrEqual(S.waterBand[0]);
    expect(pick.gain).toBeLessThanOrEqual(S.waterBand[1]);
    expect(pick.placed.map((p) => p.kind).sort()).toEqual(["killer", "p"]);
    // (A killer plant: the crowd's pawns first.)
    const kill = pick.placed.find((p) => p.kind === "killer")!;
    expect(pieceAt(QUIET, kill.square)).toEqual({ color: "w", type: "p" });
    const { answer } = await waterAnswer(engines, QUIET, ask(["p", "nothing", "killer"]));
    expect(waterCheck(QUIET, ask(["p", "nothing", "killer"]), answer)?.placed).toEqual(pick.placed);
  });

  it("an outcome that can't come up under the band's top is dropped (a knight up is three pawns: over 2.5)", async () => {
    // (An engine that sees only what stands on the board: a knight is three pawns wherever it grows.)
    const pick = (await waterFrom([staticEngine()], QUIET, ask(["n", "plant"])))!;
    expect(pick.placed.map((p) => p.kind)).toEqual(["plant"]);
    expect(pick.gain).toBeLessThanOrEqual(S.waterBand[1]);
    // (Nothing fits at all: nothing at all, the pass's own gain, "none".)
    const none = (await waterFrom([staticEngine()], QUIET, ask(["r", "b"])))!;
    expect(none.placed).toEqual([]);
    expect((await waterAnswer([staticEngine()], QUIET, ask(["r", "b"]))).answer).toBe("none");
    // (The one-ply engine finds squares where the crowd takes it back at once: the band holds either way.)
    const lost = (await waterFrom(engines, QUIET, ask(["n"])))!;
    expect(lost.gain).toBeLessThanOrEqual(S.waterBand[1]);
  });

  it("the jackpot: a queen goes on the square nearest jackpotMax however far over it, never hanging to fit; the rest under it", async () => {
    const pick = (await waterFrom(engines, QUIET, ask(["q", "p"])))!;
    const q = pick.placed.find((p) => p.kind === "q")!;
    expect(q).toBeDefined();
    // (Nine pawns up by this engine: it stays on the board.)
    expect(pick.gain).toBeGreaterThan(S.jackpotMax);
    const after = waterCheck(QUIET, ask(["q", "p"]), pick.placed.map((p) => (p.kind === "q" ? "q" : p.kind === "p" ? "p" : "") + p.square).join(" "));
    expect(pieceAt(after!.fen, q.square)).toEqual({ color: "b", type: "q" });
  });

  it("a killer plant eats one of his own pieces only when that keeps the band: never when it would leave him under it", async () => {
    // The crowd has no pawns: its pieces are worth 3 or 5 (over the top), his pawn 1 (under the bottom): no kill.
    const noPawns = "1nb3k1/pp3pp1/2p1p3/3p4/8/8/8/1NB3KR b - - 0 30";
    const pick = (await waterFrom(engines, noPawns, ask(["killer"])))!;
    expect(pick.placed).toEqual([]);
    expect(pick.ownKills).toBe(0);
    // With a band that reaches below a pawn's loss, his own pawn.
    const wide = { ...S, waterBand: [-1.5, 2.5] as const, waterTarget: -1 };
    const own = (await waterFrom(engines, noPawns, ask(["killer"]), wide))!;
    expect(own.ownKills).toBe(1);
    expect(pieceAt(noPawns, own.placed[0]!.square)?.color).toBe("b");
  });

  it("past waterTimeMs it answers in time with the outcomes placed so far: a whole watering the server's check accepts", async () => {
    // (An engine whose every search takes 1.5 s of the search's own clock.)
    let clock = 0;
    const slow = materialEngine();
    const timed: EngineLike = {
      topMoves: (f, n) => ((clock += 1500), slow.topMoves(f, n)),
      topMovesAt: (f, n, nodes, moves) => ((clock += 1500), slow.topMovesAt!(f, n, nodes, moves)),
      scoreMoves: (f, m) => ((clock += 1500), slow.scoreMoves(f, m)),
    };
    const kinds: WaterKind[] = ["killer", "p", "plant", "plant", "plant", "plant", "plant", "plant", "plant", "plant"];
    const pick = (await waterFrom([timed], QUIET, ask(kinds), S, () => clock))!;
    expect(pick.late).toBe(true);
    // (The step under way when the time ran out finishes: at most waterLooks more searches.)
    expect(clock).toBeLessThanOrEqual(S.waterTimeMs + S.waterLooks * 1500);
    expect(pick.placed.length).toBeGreaterThan(0);
    expect(pick.placed.length).toBeLessThan(kinds.length);
    const answer = (await waterAnswer([timed], QUIET, ask(kinds), true, S, ((clock = 0), () => clock))).answer;
    expect(waterCheck(QUIET, ask(kinds), answer)?.placed.length).toBe(pick.placed.length);
    // (In time: no search runs past it, and no limit is reported.)
    const quick = (await waterFrom([materialEngine()], QUIET, ask(kinds)))!;
    expect(quick.late).toBeUndefined();
  });

  it("searches at most waterBudget positions (besides the one before), however many seeds", async () => {
    const tenPlants: WaterKind[] = Array(10).fill("plant");
    const pick = (await waterFrom(engines, QUIET, ask(tenPlants), { ...S, waterBudget: 9 }))!;
    expect(pick.looks).toBeLessThanOrEqual(9);
    expect(pick.placed.length).toBeLessThanOrEqual(3);
    const full = (await waterFrom(engines, QUIET, ask(tenPlants)))!;
    expect(full.looks).toBeLessThanOrEqual(S.waterBudget);
  });

  it("the pass guard: a watering that loses him real material waits (PASS_WAIT), unless it's the test switch's or the trigger's", async () => {
    // His knight attacked by a pawn: passing loses it.
    const hanging = "6k1/8/8/4n3/3P4/8/8/6K1 b - - 0 30";
    const { answer, pick } = await waterAnswer(engines, hanging, ask(["plant"]));
    expect(pick!.gain).toBeLessThanOrEqual(-S.passGuardPawns);
    expect(answer).toBe(PASS_WAIT);
    expect((await waterAnswer(engines, hanging, ask(["plant"]), true)).answer).not.toBe(PASS_WAIT);
    // No engine: "".
    expect((await waterAnswer([], QUIET, ask(["plant"]))).answer).toBe("");
  });
});

describe("Watering in a battle", () => {
  it("his whole turn at the start of his turn after the warning: the turn passes, a base at its ply, his moments in order", async () => {
    const r = battle(11, { test: "water", seeds: 10 });
    for (let i = 0; i < 20 && !r.waterDue(); i++) await step(r);
    expect(r.waterDue()).toBe(true);
    const ply = r.boards.get(r.state.boards[0]!)!.history.length;
    const w = (await r.playWater([fakeEngine()]))!;
    expect(w.seeds).toBe(10);
    expect(w.rolled).toHaveLength(10);
    const board = r.boards.get(r.state.boards[0]!)!;
    expect(sideToMove(board.fen)).toBe(r.boss!.crowdSide);
    expect(board.history).toHaveLength(ply);
    expect(board.bases?.some((b) => b.ply === ply && b.fen === board.fen)).toBe(true);
    expect(fenAtPly(board.history, ply, board.bases)).toBe(board.fen);
    expect(r.bossToMove()).toBe(false);
    // The crowd's turn begins with the watering's moment, then his reaction (if any).
    const events = r.boss!.powers!.events.filter((e) => ["water", "cheer", "bigCheer", "shrug"].includes(e.kind));
    expect(events[0]).toMatchObject({ kind: "water", growth: w.growth });
    expect(events.slice(1).map((e) => e.kind)).toEqual(reactionOf(w.growth) ? [reactionOf(w.growth)] : []);
    // (The outcomes in the order they play: killer plants, grown pieces, plain plants, nothing.)
    const order = ["killer", "p", "n", "b", "r", "q", "plant", "nothing"];
    const idx = w.growth.map((g) => order.indexOf(g.kind));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(w.growth).toHaveLength(10);
    // (Every outcome on a square of its own.)
    expect(new Set(w.growth.map((g) => g.square)).size).toBe(10);
    // (The meter spent: it fills again from the crowd's turn after it; the turn doesn't count for fair play.)
    expect(r.boss!.powers!.ults).toBe(1);
    expect(r.boss!.powers!.warnAt).toBeUndefined();
    expect(r.waterDue()).toBe(false);
    expect(powerTurn(r.state.boss!)).toBe(true);
  });

  it("the meter holds on the count taken while the host places it (the view's `taken`), and starts again once it's played", async () => {
    let now = 0;
    const r = battle(16, { test: "water", clock: () => now });
    for (let i = 0; i < 20 && !r.waterDue(); i++) {
      now += 20_000;
      await step(r);
    }
    expect(r.bossView()!.powers!.garden!.taken).toBeNull();
    const ask = r.waterAsk()!;
    const view = r.bossView()!.powers!.garden!;
    expect(view.taken).toEqual({ clock: now, seeds: ask.kinds.length });
    // (No kinds in the view: what the seeds rolled stays off the screens until it comes up.)
    expect(JSON.stringify(view)).not.toContain("kinds");
    // A seed's time passes while the host searches: the meter shows no new seed land.
    now += 2 * EVERY;
    expect(seedsAt(view, now)).toEqual({ count: ask.kinds.length, next: null });
    await r.playWater([fakeEngine()]);
    const after = r.bossView()!.powers!.garden!;
    expect(after.taken).toBeNull();
    // (Then the seeds that landed while it searched: counted from the moment the count was taken.)
    expect(seedsAt(after, now).count).toBe(2);
  });

  it("his reactions: a queen's big cheer, a piece's cheer, a shrug for nothing at all, none for plants and kills only", () => {
    expect(reactionOf([{ kind: "q", square: "e4" }, { kind: "p", square: "e5" }])).toBe("bigCheer");
    expect(reactionOf([{ kind: "p", square: "e5" }, { kind: "plant", square: "e4" }])).toBe("cheer");
    expect(reactionOf([{ kind: "nothing", square: "e5" }, { kind: "nothing", square: "e4", dropped: "n" }])).toBe("shrug");
    expect(reactionOf([])).toBe("shrug");
    expect(reactionOf([{ kind: "killer", square: "e5", ate: "P" }, { kind: "plant", square: "e4" }])).toBeNull();
  });

  it("a plain plant blocks its square for exactly 3 crowd turns, both sides, as a toy block: onto it or through it, a knight jumping it", async () => {
    const r = battle(12, { test: "water", seeds: 1 });
    for (let i = 0; i < 20 && !r.waterDue(); i++) await step(r);
    // (A position of our own: the crowd's rook on a1 and his on a8 face each other up the a-file, the plant between.)
    const fen = "r5k1/8/8/8/8/8/8/R2N2K1 b - - 0 20";
    onPosition(r, fen, ["plant"]);
    const at = r.boss!.crowdMoves;
    expect(r.applyWater("ta4")).not.toBeNull();
    const plant = gardenOf(r).plants.find((p) => p.square === "a4")!;
    expect(plant).toEqual({ square: "a4", at, until: at + 3 });
    const left: number[] = [];
    for (let turn = at + 1; turn <= at + 4; turn++) {
      expect(r.boss!.powers!.turn).toBe(turn);
      const blocked = turn <= at + 3;
      const allowed = r.crowdAllowed() ?? legalMoves(fenOf(r));
      // Onto it and through it: refused while it's there; a knight jumps it.
      expect(allowed.includes("a1a4")).toBe(!blocked);
      expect(allowed.includes("a1a6")).toBe(!blocked);
      expect(allowed.includes("a1a3")).toBe(true);
      expect(stopReason(r.state.boss!, fenOf(r), "a1a5")).toBe(blocked ? "plant" : null);
      // (A knight jumps it: Nd1-c3, and on.)
      const view = r.bossView()!.powers!.garden!;
      left.push(view.plants.find((p) => p.square === "a4")?.left ?? 0);
      if (turn === at + 4) break;
      await r.score(new Map([["h0", { move: turn % 2 ? "g1h1" : "h1g1", thinkMs: 1000 }]]));
      // His turn: his king shuffles (g8 to f8 and back); his rook's a-file moves through a4 would be stopped.
      const his = bossAllowed(r.state.boss!, fenOf(r)) ?? legalMoves(fenOf(r));
      expect(his.includes("a8a1")).toBe(false);
      await r.playBoss(shuffleEngine());
    }
    expect(left).toEqual([3, 2, 1, 0]);
    expect(gardenOf(r).plants.some((p) => p.square === "a4")).toBe(false);
  });

  it("his own moves stop at a plant too (bossStops)", () => {
    const r = battle(13);
    const fen = "6kr/8/8/8/8/8/8/R5K1 b - - 0 20";
    const boss = { ...r.state.boss!, crowdSide: "w" as const, powers: { ...r.state.boss!.powers!, garden: { since: 0, base: 0, plants: [{ square: "h4", at: 5, until: 8 }], waterings: 1 } } };
    const allowed = bossAllowed(boss, fen) ?? legalMoves(fen);
    expect(allowed).not.toContain("h8h4");
    expect(allowed).not.toContain("h8h1");
    expect(allowed).toContain("h8h5");
    const crowd = { ...boss, powers: { ...boss.powers, garden: { ...boss.powers.garden, plants: [{ square: "a4", at: 5, until: 8 }] } } };
    expect(crowdAllowed(crowd, fen.replace(" b ", " w "))).not.toContain("a1a5");
    expect(crowdAllowed(crowd, fen.replace(" b ", " w "))).toContain("a1a3");
  });

  it("the host's answer is checked: junk, \"\" or PASS_WAIT and the watering waits for his next turn (a new roll then), and he moves", async () => {
    const r = battle(14, { test: "water", seeds: 3 });
    for (let i = 0; i < 20 && !r.waterDue(); i++) await step(r);
    const at = r.boss!.crowdMoves;
    for (const junk of ["", PASS_WAIT, "e2e4", "qa1 qa2 qa3 qa4", null]) {
      const again = battle(14, { test: "water", seeds: 3 });
      for (let i = 0; i < 20 && !again.waterDue(); i++) await step(again);
      expect(again.applyWater(junk)).toBeNull();
      expect(again.waterDue()).toBe(false);
      expect(again.bossToMove()).toBe(true);
      expect(again.boss!.powers!.garden!.wait).toBe(at);
      expect(again.boss!.powers!.warnAt).toBeDefined();
    }
    // His move, the crowd's, and it's due again.
    const w = battle(14, { test: "water", seeds: 3 });
    for (let i = 0; i < 20 && !w.waterDue(); i++) await step(w);
    w.applyWater("");
    await w.playBoss(fakeEngine());
    await step(w);
    expect(w.waterDue()).toBe(true);
    expect(w.waterAsk()!.kinds).toHaveLength(3);
  });

  it("the admins' trigger brings it at the start of his next turn, without the warning, its pass guard off", async () => {
    const r = battle(15, { seeds: 2 });
    await step(r);
    await step(r);
    const pulled = triggerUltimate(r.state.boss!);
    expect(pulled.ok).toBe(true);
    r.state = { ...r.state, boss: pulled.boss! };
    for (let i = 0; i < 6 && !r.waterDue(); i++) await step(r);
    expect(r.waterDue()).toBe(true);
    expect(r.waterAny()).toBe(true);
  });
});

describe("the hippo gardener: a small fuzz of whole battles", () => {
  it("every position the engine plays, every outcome where its rules allow, plants gone after 3 turns, the replay from the base", async () => {
    let waterings = 0;
    for (let seed = 21; seed < 27; seed++) {
      const r = battle(seed, { test: "water", seeds: 10, side: seed % 2 ? "w" : "b" });
      for (let i = 0; i < 80 && !r.isOver(); i++) {
        if (r.stageComplete()) break;
        if (r.bossToMove() && r.waterDue()) {
          const before = fenOf(r);
          const w = await r.playWater([fakeEngine()]);
          if (w) {
            waterings++;
            const after = fenOf(r);
            for (const g of w.growth) {
              if (g.kind === "killer") {
                expect(pieceAt(after, g.square)).toBeNull();
                expect(g.ate!.toLowerCase()).not.toBe("k");
              } else if (g.kind === "plant" || g.kind === "nothing") expect(pieceAt(before, g.square)).toBeNull();
              else {
                expect(pieceAt(after, g.square)).toEqual({ color: r.boss!.crowdSide === "w" ? "b" : "w", type: g.kind });
                if (g.kind === "p") expect(["1", "8"]).not.toContain(g.square[1]);
              }
            }
          }
        }
        await step(r);
        const fen = fenOf(r);
        expect(stockfishRefuses(fen)).toBeNull();
        const board = r.boards.get(r.state.boards[0]!)!;
        expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(board.fen);
        const g = r.boss!.powers!.garden!;
        for (const p of g.plants) expect(p.until - p.at).toBe(S.plantTurns);
        for (const p of g.plants) expect(r.boss!.powers!.turn).toBeLessThanOrEqual(p.until + 1);
      }
    }
    expect(waterings).toBeGreaterThan(3);
  }, 60_000);
});
