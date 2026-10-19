import { describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, isPlayable, mulberry32, type BossPowerState, type BossState, type Camouflage } from "@chessroyale/core";
import {
  BOSS_OPENING,
  MatchRunner,
  POWER_FX,
  REPAINT_TEST_MOVES,
  SMUDGY_FX,
  bossAllowed,
  bossRules,
  camoDue,
  camoSides,
  crowdAllowed,
  fenAtPly,
  forcedMoves,
  hiddenJudged,
  hiddenRanked,
  inCheck,
  initPowers,
  keepsDisguise,
  legalMoves,
  mateInOne,
  maskedFen,
  newBoard,
  paintRefuses,
  passTurn,
  pieceAt,
  powerTurn,
  rageOf,
  repaintFrom,
  repaintOptions,
  rookChecks,
  seenMoveLeft,
  sideToMove,
  smudgyBattle,
  stockfishRefuses,
  stopReason,
  toSan,
  swapOptions,
  triggerUltimate,
  type Battle,
  type EngineLike,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Smudgy's rules (docs/decisions/2026-10-19-smudgy-rules.md; bosses/smudgy.ts): Camouflage (two forced moves, the swap,
 * the rook hiding as a pawn, its strike and every reveal, the board the crowd sees) and Repaint (the pair's hard rules,
 * the band, the cap), his moments, and a small fuzz of whole battles.
 */

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_D4 = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1";
const AFTER_NF3 = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1";

/** A battle through the match runner on the stand-in engine (the kit's), Smudgy met as the test link does. */
function battle(seed: number, side: "w" | "b", test = "", engines: EngineLike[] = [fakeEngine()]) {
  const settings = kitSettings({ boss: "smudgy", test, maxMoves: 40 });
  return new MatchRunner({ settings, rng: mulberry32(seed), engines, library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
}

/** One step of a battle: his move (a Repaint first when it's due), or the crowd's (from `pick`). */
async function step(r: MatchRunner, pick: (fen: string, allowed: string[]) => string, engines: EngineLike[] = [fakeEngine()]) {
  if (r.bossToMove()) {
    if (r.repaintDue()) await r.playRepaint(engines);
    if (r.bossToMove()) await r.playBoss(engines[0]);
    return;
  }
  r.deal();
  const fen = fenOf(r);
  const move = pick(fen, r.crowdAllowed() ?? legalMoves(fen));
  await r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const camoOf = (r: MatchRunner) => r.boss!.powers!.camo!;

/** A Battle on one position, for his after-move rules on their own. */
function stub(fen: string, camo: Camouflage, crowdMoves: number, captured?: string): Battle {
  const board = { ...newBoard(0, BOSS_OPENING, 0), fen, history: [] as string[] };
  const powers: BossPowerState = { ...initPowers(1, fen, "w"), turn: crowdMoves + 1, camo };
  const b: Battle = {
    state: { boards: [0], boss: { id: "smudgy", crowdSide: "w", crowdMoves, powers } } as unknown as Battle["state"],
    boards: new Map([[0, board]]),
    settings: kitSettings({ boss: "smudgy", test: "", maxMoves: 40 }),
    bossLast: captured ? { move: "", san: "", captured } : null,
    engines: [],
    alive: () => [],
    finalGameOver: () => false,
    bossToMove: () => sideToMove(b.boards.get(0)!.fen) === "b",
    crowdAllowed: () => null,
    boardOf: () => null,
    afterCrowdMove: () => undefined,
    bossPassed: () => undefined,
    memo: new Map(),
  };
  return b;
}

/** A boss state on one position, for the dispatcher's limits. */
function bossOn(fen: string, camo: Camouflage | null, crowdMoves: number): BossState {
  return { id: "smudgy", crowdSide: "w", crowdMoves, powers: { ...initPowers(1, fen, "w"), turn: crowdMoves + 1, camo } } as unknown as BossState;
}

const hidden = (square: string, swapAt = 2): Camouflage => ({ side: "h", step: 2, missed: 0, due: null, square, swap: { at: swapAt, rook: "h6", pawn: square } });

describe("Smudgy on the roster", () => {
  it("is on the roster with his powers, hidden from players until his art is wired, and his numbers are in BOSS_POWERS", () => {
    const def = BOSS_ROSTER.find((d) => d.id === "smudgy")!;
    expect(def).toMatchObject({ name: "Smudgy", icon: "🦎", kit: null, powers: { passive: "camouflage", ultimate: "repaint" } });
    expect(isPlayable(def)).toBe(false);
    expect(bossRules(def)?.opening?.fromStart).toBe(true);
    expect(BOSS_POWERS).toMatchObject({ camoTries: 3, camoStrikeTurn: 3, repaintBand: [1.5, 2.5], repaintTarget: 2, repaintMax: 2 });
    expect(BOSS_POWERS.rageSpeed.smudgy).toBe(1);
  });

  it("has every moment's length in POWER_FX", () => {
    for (const [k, v] of Object.entries(SMUDGY_FX)) expect(POWER_FX[k as keyof typeof POWER_FX]).toBe(v);
  });
});

describe("Camouflage: the forced moves", () => {
  it("are an end pawn two squares, then that side's rook out to its third rank, for either color", () => {
    expect(forcedMoves("a", "b")).toEqual({ push: "a7a5", lift: "a8a6", rookTo: "a6" });
    expect(forcedMoves("h", "b")).toEqual({ push: "h7h5", lift: "h8h6", rookTo: "h6" });
    expect(forcedMoves("h", "w")).toEqual({ push: "h2h4", lift: "h1h3", rookTo: "h3" });
    expect(forcedMoves("a", "w")).toEqual({ push: "a2a4", lift: "a1a3", rookTo: "a3" });
  });

  it("take only a side where the rook's new square isn't simply lost", () => {
    // 1.e4 opens Bf1 onto a6 (a bishop for the rook), 1.d4 opens Bc1 onto h6.
    expect(camoSides(AFTER_E4, "b")).toEqual(["h"]);
    expect(camoSides(AFTER_D4, "b")).toEqual(["a"]);
    expect(camoSides(AFTER_NF3, "b")).toEqual(["a", "h"]);
    expect(camoSides(START, "w")).toEqual(["a", "h"]);
    // (a6 taken by his own knight: only the h-side.)
    expect(camoSides("r1bqkbnr/pppppppp/n7/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 2 2", "b")).toEqual(["h"]);
  });

  it("pick the side from the seed among those that work: both come up", () => {
    const picks = new Set<string | null>();
    for (let seed = 1; seed <= 40; seed++) picks.add(camoDue(AFTER_NF3, { side: null, step: 0 }, seed, "b", 1));
    expect([...picks].sort()).toEqual(["a7a5", "h7h5"]);
  });

  it("wait when neither can be played (in check), and the second waits when its square would be lost", () => {
    // 1.e4 f6 2.Qh5+: in check, no forced move answers it.
    expect(camoDue("rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2", { side: null, step: 0 }, 1, "b", 2)).toBeNull();
    expect(camoDue("rnbqkbnr/ppppppp1/8/7p/8/2N2N2/PPPPPPPP/R1BQKB1R b KQkq - 1 2", { side: "h", step: 1 }, 1, "b", 2)).toBe("h8h6");
    // (1.d4 h5 2.Bf4: h6 under the bishop, but the swap comes at once and a real pawn stands there: the lift comes.)
    expect(camoDue("rnbqkbnr/ppppppp1/8/7p/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", { side: "h", step: 1 }, 1, "b", 2)).toBe("h8h6");
    // (Its square taken: it waits.)
    expect(camoDue("rnbqkb1r/ppppppp1/7n/7p/8/2N2N2/PPPPPPPP/R1BQKB1R b KQkq - 1 2", { side: "h", step: 1 }, 1, "b", 2)).toBeNull();
    expect(camoDue(AFTER_NF3, { side: null, step: 2 }, 1, "b", 1)).toBeNull();
    expect(camoDue(AFTER_NF3, { side: null, step: 0, off: true }, 1, "b", 1)).toBeNull();
  });

  it("are his only moves while due, then the swap: a real pawn on the rook's square, the rook on the pawn's (the crowd White)", async () => {
    const r = battle(5, "w");
    const crowd = (fen: string, allowed: string[]) => allowed.find((m) => m === "g1f3" || m === "b1c3") ?? allowed[0]!;
    await step(r, crowd);
    expect(r.bossToMove()).toBe(true);
    const due = camoOf(r).due!;
    expect(r.bossAllowed()).toEqual([due]);
    await step(r, crowd);
    expect(r.boards.get(0)!.history.at(-1)).toBe(due);
    expect(camoOf(r)).toMatchObject({ step: 1, side: due[0] });
    await step(r, crowd);
    const lift = camoOf(r).due!;
    expect(lift).toBe(forcedMoves(camoOf(r).side!, "b").lift);
    expect(r.bossAllowed()).toEqual([lift]);
    await step(r, crowd);
    const c = camoOf(r);
    const fen = fenOf(r);
    expect(c.step).toBe(2);
    expect(c.swap).toMatchObject({ at: 2, rook: forcedMoves(c.side!, "b").rookTo });
    expect(c.square).toBe(c.swap!.pawn);
    expect(pieceAt(fen, c.swap!.rook)).toEqual({ color: "b", type: "p" });
    expect(pieceAt(fen, c.square!)).toEqual({ color: "b", type: "r" });
    // (A base at the swap's ply: the replay reproduces it; the position is one the engine plays.)
    const board = r.boards.get(0)!;
    expect(board.bases?.some((x) => x.ply === board.history.length)).toBe(true);
    expect(fenAtPly(board.history, board.history.length, board.bases)).toBe(fen);
    expect(stockfishRefuses(fen)).toBeNull();
    // The crowd sees a pawn there: nine pawns of his on the board it sees.
    const masked = maskedFen(fen, c.square);
    expect(pieceAt(masked, c.square!)).toEqual({ color: "b", type: "p" });
    expect([...masked.split(" ")[0]!].filter((x) => x === "p").length).toBe(9);
    // The moment, as the crowd's turn after it begins.
    // (Its fields name only the rook's old square: where it hides is the view's alone.)
    const moment = r.boss!.powers!.events.find((e) => e.kind === "camouflage")!;
    expect(moment).toEqual({ kind: "camouflage", turn: 3, square: c.swap!.rook });
    expect(JSON.stringify(moment)).not.toContain(c.square!);
  });

  it("start with his move as White (the crowd Black): the first forced move is due as the battle begins", async () => {
    const r = battle(6, "b");
    expect(r.boss!.crowdSide).toBe("b");
    expect(r.bossToMove()).toBe(true);
    expect(fenOf(r).split(" ")[0]).toBe(START.split(" ")[0]);
    const due = camoOf(r).due!;
    expect(["a2a4", "h2h4"]).toContain(due);
    expect(r.bossAllowed()).toEqual([due]);
  });

  it("a turn that can't play the forced move counts against camoTries, then no Camouflage this battle", () => {
    const check = "rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const b = stub(check, { side: null, step: 0, missed: 0, due: null, square: null }, 2);
    for (let i = 1; i <= BOSS_POWERS.camoTries; i++) {
      smudgyBattle.afterCrowdMove(b, "d1h5");
      const c = b.state.boss!.powers!.camo!;
      expect(c.missed).toBe(i);
      expect(c.due).toBeNull();
      expect(!!c.off).toBe(i >= BOSS_POWERS.camoTries);
    }
    // (Off: nothing limits his moves.)
    expect(bossAllowed(b.state.boss, AFTER_NF3)).toBeNull();
  });

  it("no pawn can take the rook's place: no Camouflage (and every swap there is keeps the crowd out of check)", () => {
    // Every swap: the occupied squares unchanged, the crowd not in check on either board, a position the engine plays.
    const fen = "rnbqkbn1/ppppppp1/7r/7p/8/2N2N2/PPPPPPPP/R1BQKB1R w KQq - 2 3";
    const options = swapOptions(fen, "h6", "b");
    expect(options.map((o) => o.pawn)).toEqual(["a7", "b7", "c7", "d7", "e7", "f7", "g7", "h5"]);
    for (const o of options) {
      expect(stockfishRefuses(o.fen)).toBeNull();
      expect(pieceAt(o.fen, "h6")?.type).toBe("p");
      expect(pieceAt(o.fen, o.pawn)?.type).toBe("r");
    }
    // (His king's pawn shield: the white king on f6 would be "checked" by a pawn on e7 or g7 as the crowd sees it.)
    const near = "rnbqkbn1/ppppppp1/5K1r/7p/8/8/8/8 w q - 0 3";
    expect(swapOptions(near, "h6", "b").map((o) => o.pawn)).not.toContain("e7");
    expect(swapOptions(near, "h6", "b").map((o) => o.pawn)).not.toContain("g7");
    expect(swapOptions(fen, "h5", "b")).toEqual([]);
  });
});

describe("Camouflage: the hidden rook", () => {
  it("moves like a pawn: one forward, two from his pawns' rank, never a capture, sideways, back, onto the back rank, beside an en passant taker, or onto a pawn's check", () => {
    expect(keepsDisguise("4k3/8/4r3/8/8/8/8/K7 w - - 0 1", "e7", "e6", false, "b")).toBe(true);
    expect(keepsDisguise("4k3/8/8/4r3/8/8/8/K7 w - - 0 1", "e7", "e5", false, "b")).toBe(true);
    expect(keepsDisguise("4k3/8/8/3Pr3/8/8/8/K7 w - - 0 1", "e7", "e5", false, "b")).toBe(false);
    expect(keepsDisguise("4k3/8/8/4r3/8/8/8/K7 w - - 0 1", "e6", "e4", false, "b")).toBe(false);
    expect(keepsDisguise("4k3/8/4r3/8/8/8/8/K7 w - - 0 1", "e7", "e6", true, "b")).toBe(false);
    expect(keepsDisguise("4k3/3r4/8/8/8/8/8/K7 w - - 0 1", "e7", "d7", false, "b")).toBe(false);
    expect(keepsDisguise("4k3/4r3/8/8/8/8/8/K7 w - - 0 1", "e6", "e7", false, "b")).toBe(false);
    expect(keepsDisguise("4k3/8/8/8/8/8/8/K3r3 w - - 0 1", "e2", "e1", false, "b")).toBe(false);
    expect(keepsDisguise("4k3/8/4r3/3K4/8/8/8/8 w - - 0 1", "e7", "e6", false, "b")).toBe(false);
    // (As White: up the board.)
    expect(keepsDisguise("k7/8/8/8/8/4R3/8/4K3 b - - 0 1", "e2", "e3", false, "w")).toBe(true);
  });

  it("its pawn-shaped step is named as a pawn's (the screens' line for his move gives nothing away); a move that unmasks it is named as it is", () => {
    const fen = "4k3/4r3/8/8/8/8/8/R5K1 b - - 0 1";
    const rules = bossRules({ id: "smudgy" })!;
    expect(rules.specialMove!(bossOn(fen, hidden("e7"), 4), fen, "e7e6")).toEqual({ play: "e7e6", san: "e6" });
    expect(rules.specialMove!(bossOn(fen, hidden("e7"), 5), fen, "e7a7")).toBeNull();
    // (His other moves too, on the board the crowd sees.)
    expect(rules.specialMove!(bossOn(fen, hidden("e7"), 4), fen, "e8d8")).toEqual({ play: "e8d8", san: "Kd8" });
    // (A step that checks reveals it: named as the rook's.)
    const open = "4k3/4r3/8/8/8/8/8/R3K3 b - - 0 1";
    expect(rules.specialMove!(bossOn(open, hidden("e7"), 4), open, "e7e6")).toBeNull();
  });

  it("names every move of his on the board the crowd sees while it hides: his other rook's without a letter the hidden one would add (the review's B1)", () => {
    const fen = "k6r/3r4/8/8/8/8/8/4K3 b - - 0 1";
    expect(toSan(fen, "h8d8")).toBe("Rhd8");
    const rules = bossRules({ id: "smudgy" })!;
    expect(rules.specialMove!(bossOn(fen, hidden("d7"), 4), fen, "h8d8")).toEqual({ play: "h8d8", san: "Rd8" });
    // (Through the runner: the dock's line for his move.)
    const r = battle(5, "w");
    const board = r.boards.get(0)!;
    r.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
    r.state = { ...r.state, boss: { ...r.state.boss!, crowdMoves: 4, powers: { ...r.state.boss!.powers!, camo: hidden("d7") } } };
    r.applyBossMove("h8d8");
    expect(r.bossView()?.lastMove?.san).toBe("Rd8");
    // Nothing hidden: named as it is.
    expect(rules.specialMove!(bossOn(fen, null, 4), fen, "h8d8")).toBeNull();
  });

  it("an illegal move from a host out of date never breaks its naming (the review's S2)", () => {
    const fen = "4k3/4r3/8/8/8/8/3K4/8 b - - 0 30";
    const rules = bossRules({ id: "smudgy" })!;
    expect(() => rules.specialMove!(bossOn(fen, hidden("e7"), 4), fen, "e7d2")).not.toThrow();
    expect(rules.specialMove!(bossOn(fen, hidden("e7"), 4), fen, "e7d2")).toBeNull();
    expect(rules.specialMove!(bossOn(fen, hidden("e7"), 4), fen, "e7f5")).toBeNull();
  });

  it("is unmasked when his move would leave the crowd no move legal on both boards (the review's S1)", () => {
    // Bc5 covers g1, Nf1 covers h2: after ...Rf3 (a pawn's step as you see it) your king's only moves run into the rook.
    const before = "2k5/8/8/p1b5/P4r2/8/8/5n1K b - - 0 1";
    const after = "2k5/8/8/p1b5/P7/5r2/8/5n1K w - - 1 2";
    expect(keepsDisguise(after, "f4", "f3", false, "b")).toBe(true);
    expect(seenMoveLeft(after, "f3")).toBe(false);
    expect(legalMoves(before)).toContain("f4f3");
    const b = stub(after, hidden("f4"), 4);
    smudgyBattle.afterHisMove(b, "f4f3");
    expect(b.state.boss!.powers!.camo).toMatchObject({ square: null, reveal: { at: 4, square: "f3", how: "stuck", from: "f4" } });
  });

  it("makes only those moves until its strike: then any rook move", () => {
    const fen = "4k3/4r3/8/8/8/8/8/R3K3 b - - 0 1";
    const rookMoves = (allowed: string[] | null) => (allowed ?? legalMoves(fen)).filter((m) => m.startsWith("e7")).sort();
    // Swap after the crowd's 2nd move: hidden through his turns after its 3rd and 4th, striking from his turn after its 5th.
    expect(rookMoves(bossAllowed(bossOn(fen, hidden("e7"), 4), fen))).toEqual(["e7e5", "e7e6"]);
    expect(rookMoves(bossAllowed(bossOn(fen, hidden("e7"), 5), fen))).toEqual(legalMoves(fen).filter((m) => m.startsWith("e7")).sort());
    // (His other pieces move freely.)
    expect(bossAllowed(bossOn(fen, hidden("e7"), 4), fen)).toContain("e8d8");
  });

  it("is revealed by a move no pawn could make (strike), by its own check, by a check it discovers, and when the crowd takes it", () => {
    // A strike: sideways.
    let b = stub("4k3/r7/8/8/8/8/8/4K3 w - - 0 1", hidden("e7"), 5);
    smudgyBattle.afterHisMove(b, "e7a7");
    expect(b.state.boss!.powers!.camo).toMatchObject({ square: null, reveal: { at: 5, square: "a7", how: "move", from: "e7" } });
    // A pawn's step that checks along the rank.
    b = stub("4k3/8/4r2K/8/8/8/8/8 w - - 0 1", hidden("e7"), 3);
    smudgyBattle.afterHisMove(b, "e7e6");
    expect(b.state.boss!.powers!.camo).toMatchObject({ square: null, reveal: { at: 3, square: "e6", how: "check" } });
    // A check discovered by his bishop.
    b = stub("4k3/1b2r3/8/8/8/8/8/4K3 w - - 0 1", hidden("e7"), 3);
    smudgyBattle.afterHisMove(b, "e4b7");
    expect(b.state.boss!.powers!.camo).toMatchObject({ square: null, reveal: { at: 3, square: "e7", how: "check" } });
    // A quiet pawn's step: still hidden, on its new square.
    b = stub("4k3/8/4r3/8/8/8/8/K7 w - - 0 1", hidden("e7"), 3);
    smudgyBattle.afterHisMove(b, "e7e6");
    expect(b.state.boss!.powers!.camo).toMatchObject({ square: "e6" });
    expect(b.state.boss!.powers!.camo!.reveal).toBeUndefined();
    // Taken: "That was his rook!", as the crowd's move lands.
    b = stub("4k3/8/3N4/8/8/8/8/K7 b - - 0 1", hidden("d6"), 6);
    smudgyBattle.afterCrowdMove(b, "c4d6");
    expect(b.state.boss!.powers!.camo).toMatchObject({ square: null, reveal: { at: 6, square: "d6", how: "taken" } });
    expect(b.state.boss!.powers!.events).toContainEqual({ kind: "rookTaken", turn: 7, square: "d6" });
  });

  it("strikes as his brain wants once it may, and its moment (unmask) plays as the crowd's turn after it begins", async () => {
    // Battles on the stand-in engine until one strikes: the strike's turn is never before camoStrikeTurn after the swap.
    let struck = 0;
    for (let seed = 1; seed <= 12 && struck < 2; seed++) {
      const r = battle(seed, seed % 2 ? "w" : "b");
      const rng = mulberry32(seed);
      for (let i = 0; i < 70 && !r.isOver() && !r.stageComplete(); i++) {
        await step(r, (fen, allowed) => crowdPick(fen, allowed, rng));
        const c = r.boss!.powers!.camo;
        if (c?.reveal?.how === "move" && r.boss!.powers!.turn === c.reveal.at + 1) {
          expect(c.reveal.at).toBeGreaterThanOrEqual(c.swap!.at + BOSS_POWERS.camoStrikeTurn);
          expect(r.boss!.powers!.events.find((e) => e.kind === "unmask")).toMatchObject({ reveal: "move", square: c.reveal.square, squares: [c.reveal.from, c.reveal.square] });
          struck++;
          break;
        }
      }
    }
    expect(struck).toBeGreaterThan(0);
  });
});

describe("Camouflage: what the crowd sees", () => {
  const view = (square: string) => ({ id: "smudgy", powers: { camo: { square } } });

  it("a move legal as the crowd sees it but not in truth is refused ('paint') and picked again: the king into the rook's line, a pinned piece", () => {
    const kingFen = "4k3/4r3/8/8/8/8/3K4/8 w - - 0 1";
    expect(paintRefuses(kingFen, "e7", "d2e3")).toBe(true);
    expect(stopReason(view("e7"), kingFen, "d2e3")).toBe("paint");
    expect(paintRefuses(kingFen, "e7", "d2d3")).toBe(false);
    expect(stopReason(view("e7"), kingFen, "d2d3")).toBeNull();
    const pinFen = "4k3/4r3/8/8/4N3/8/8/4K3 w - - 0 1";
    expect(paintRefuses(pinFen, "e7", "e4c3")).toBe(true);
    expect((crowdAllowed(bossOn(pinFen, hidden("e7"), 4), pinFen) ?? legalMoves(pinFen)).some((m) => m.startsWith("e4"))).toBe(false);
    // (Refused moves cost nothing: the crowd's allowed moves are its legal ones on both boards, and nothing scores tries.)
    expect(bossRules({ id: "smudgy" })?.scoreRound).toBeUndefined();
    // (Never his own moves.)
    expect(stopReason(view("e7"), "4k3/4r3/8/8/8/8/3K4/8 b - - 0 1", "e7d7")).toBeNull();
  });

  it("the crowd may play only moves legal on both boards: none the pawn it sees would stop either", () => {
    const fen = "4k3/4r3/8/3K4/8/8/8/8 w - - 0 1";
    const allowed = crowdAllowed(bossOn(fen, hidden("e7"), 4), fen)!;
    // d6: legal in truth (the rook doesn't see it) but a pawn on e7 would guard it; e5, e6: the rook's file.
    expect(legalMoves(fen)).toContain("d5d6");
    for (const m of ["d5d6", "d5e5", "d5e6"]) expect(allowed).not.toContain(m);
    expect(allowed).toContain("d5c4");
  });

  it("the judge never names or rewards a capture of the hidden rook as the best move (the review's B2)", () => {
    const evaluation = { bestMove: "c5d7", bestExpected: 0.9, expectedAfter: { c5d7: 0.9, b5d7: 0.85, g1f3: 0.55, e2e4: 0.5 } };
    const judged = hiddenJudged(evaluation, "d7");
    expect(judged.bestMove).toBe("g1f3");
    expect(judged.bestExpected).toBe(0.55);
    expect(judged.expectedAfter).toEqual({ c5d7: 0.55, b5d7: 0.55, g1f3: 0.55, e2e4: 0.5 });
    // Nothing hidden: unchanged; a best move elsewhere stays, the capture held to it.
    expect(hiddenJudged(evaluation, null)).toBe(evaluation);
    expect(hiddenJudged({ ...evaluation, bestMove: "g1f3", bestExpected: 0.95, expectedAfter: { ...evaluation.expectedAfter, g1f3: 0.95 } }, "d7")).toMatchObject({ bestMove: "g1f3", bestExpected: 0.95 });
    // The hints and the bots: the capture after the best other move.
    expect(hiddenRanked([{ move: "c5d7", expected: 0.9 }, { move: "g1f3", expected: 0.55 }], "d7").map((m) => [m.move, m.expected])).toEqual([["g1f3", 0.55], ["c5d7", 0.55]]);
    // Through the runner: a round where a capture of the hidden rook is the engine's best.
    const r = battle(7, "w");
    const fen = "4k3/3r4/8/2N5/8/8/8/4K3 w - - 0 30";
    const board = r.boards.get(0)!;
    r.boards.set(0, { ...board, fen, bases: [...(board.bases ?? []), { ply: board.history.length, fen }] });
    r.state = { ...r.state, boss: { ...r.state.boss!, crowdMoves: 4, powers: { ...r.state.boss!.powers!, camo: hidden("d7") } } };
    r.deal();
    const round = r.resolveBoard(0, ["h0"], { h0: "e1d2" }, { bestMove: "c5d7", bestExpected: 0.95, expectedAfter: { c5d7: 0.95, e1d2: 0.5, e1f2: 0.52 } });
    expect(round.bestMove).toBe("e1f2");
    expect(round.result.players.find((p) => p.playerId === "h0")).toBeTruthy();
  });

  it("the judge and the bots score only the crowd's allowed moves, and the turns he hides it don't count for fair play", async () => {
    const r = battle(5, "w");
    const crowd = (fen: string, allowed: string[]) => allowed[0]!;
    while (!camoOf(r).square && !r.isOver()) await step(r, crowd);
    expect(powerTurn(r.boss)).toBe(true);
    for (let i = 0; i < 6 && camoOf(r).square && !r.isOver(); i++) {
      if (r.bossToMove()) {
        await step(r, crowd);
        continue;
      }
      r.deal();
      const fen = fenOf(r);
      const allowed = r.crowdAllowed() ?? legalMoves(fen);
      const seen = legalMoves(maskedFen(fen, camoOf(r).square));
      for (const m of allowed) expect(seen).toContain(m);
      const report = await r.score(new Map([["h0", { move: allowed[0]!, thinkMs: 1000 }]]));
      for (const br of report.boards) for (const s of br.scored) expect(allowed).toContain(s.move);
    }
  });
});

describe("Repaint", () => {
  // The crowd White with seven pawns (its h-pawn gone); his e-pawn on e5.
  const FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PP1/R1BQKB1R b KQkq - 0 4";

  it("paints one of his pawns and one of the crowd's knights or bishops, never a pawn one step from promoting, never leaving anyone in check or a mate in one", () => {
    const options = repaintOptions(FEN, "b");
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(["n", "b"]).toContain(o.type);
      expect(Number(o.pawn[1])).not.toBe(7);
      expect(pieceAt(o.fen, o.pawn)).toEqual({ color: "w", type: "p" });
      expect(pieceAt(o.fen, o.piece)).toEqual({ color: "b", type: o.type });
      expect(stockfishRefuses(o.fen)).toBeNull();
      expect(sideToMove(o.fen)).toBe("w");
      expect(o.fen.split(" ")[3]).toBe("-");
      expect(mateInOne(o.fen)).toBeNull();
      expect(legalMoves(o.fen).length).toBeGreaterThan(0);
      const his = passTurn(o.fen);
      if (his) expect(mateInOne(his)).toBeNull();
    }
    // (The f3 knight painted his would check your king on e1.)
    expect(options.some((o) => o.piece === "f3")).toBe(false);
    // Never the crowd's queen, rooks or king; never his king.
    expect(options.every((o) => !["d1", "a1", "h1", "e1", "e8"].includes(o.piece))).toBe(true);
  });

  it("is never a ninth pawn for the crowd (a position the engine refuses), nor his hidden rook", () => {
    // The crowd with all eight pawns: no pair fits.
    expect(repaintOptions("rnbqkbnr/ppppppp1/8/8/7p/2N2N2/PPPPPPPP/R1BQKB1R b KQkq - 0 3", "b")).toEqual([]);
    // (His hidden rook on e5, drawn as a pawn: never painted.)
    const withRook = FEN.replace("4p3/4P3", "4r3/4P3");
    expect(repaintOptions(withRook, "b", "e5").some((o) => o.pawn === "e5")).toBe(false);
    // (In check: none, his move answers it.)
    expect(repaintOptions("rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2", "b")).toEqual([]);
  });

  it("the engine's pick: within the band, the nearest its target; none in the band, none (the test switch: the nearest)", async () => {
    // A stand-in engine: him to move before, 50%; each candidate's gain set by its crowd's expected score.
    const k = BOSS_POWERS.bouncePawnLogit;
    const sig = (x: number) => 1 / (1 + Math.exp(-x));
    const engineFor = (gains: Record<string, number>): EngineLike => {
      const top = async (fen: string) => [{ move: "a1a2", expected: fen in gains ? 1 - sig(gains[fen]! * k) : 0.5 }];
      return { topMoves: top, topMovesAt: top, scoreMoves: async () => [], playAtElo: async () => "a1a2" };
    };
    const at = { a: 0.5, b: 1.6, c: 2.2, d: 3.5 };
    expect((await repaintFrom([engineFor(at)], "x", ["a", "b", "c", "d"]))?.fen).toBe("c");
    expect(await repaintFrom([engineFor({ a: 0.4, d: 3 })], "x", ["a", "d"])).toBeNull();
    expect(await repaintFrom([engineFor({ a: 0.4, d: 3 })], "x", ["a", "d"], true)).toMatchObject({ fen: "d", outside: true });
  });

  it("is his whole turn: the crowd moves next, a base at its ply, the en passant square cleared, the fifty-move count kept, the meter spent, its moment as the crowd's turn begins", async () => {
    const r = battle(3, "w", "repaint");
    expect(r.boards.get(0)!.history.slice(0, 4)).toEqual([...REPAINT_TEST_MOVES]);
    const crowd = (fen: string, allowed: string[]) => allowed.find((m) => m === "b1c3" || m === "g1f3" || m === "f1e2") ?? allowed[0]!;
    let before = "";
    for (let i = 0; i < 20 && !r.boss!.powers!.repaints; i++) {
      if (r.bossToMove() && r.repaintDue()) {
        before = fenOf(r);
        expect(r.repaintAny()).toBe(true);
        await r.playRepaint();
        break;
      }
      await step(r, crowd);
    }
    const p = r.boss!.powers!;
    expect(p.repaints).toBe(1);
    expect(p.camo!.step).toBe(2);
    const fen = fenOf(r);
    expect(sideToMove(fen)).toBe(r.boss!.crowdSide);
    expect(fen.split(" ")[3]).toBe("-");
    expect(fen.split(" ")[4]).toBe(before.split(" ")[4]);
    const board = r.boards.get(0)!;
    expect(board.bases?.some((x) => x.ply === board.history.length && x.fen === fen)).toBe(true);
    expect(pieceAt(fen, p.repaint!.pawn)?.color).toBe("w");
    expect(pieceAt(fen, p.repaint!.piece)).toEqual({ color: "b", type: p.repaint!.type });
    expect(p.events).toContainEqual({ kind: "repaint", turn: p.turn, squares: [p.repaint!.pawn, p.repaint!.piece] });
    expect(powerTurn(r.boss)).toBe(true);
    expect(p.ultAt).toBeUndefined();
    expect(rageOf(r.boss)).toBeLessThan(0.2);
  });

  it("waits for his forced moves, and comes at most repaintMax a battle: then the meter is off and the trigger refuses", () => {
    const fen = FEN;
    const pending = stub(fen, { side: "h", step: 1, missed: 0, due: null, square: null }, 6);
    Object.assign(pending.state.boss!.powers!, { warnAt: 3 });
    expect(smudgyBattle.repaintDue(pending)).toBe(false);
    const ready = stub(fen, hidden("g7"), 6);
    Object.assign(ready.state.boss!.powers!, { warnAt: 3 });
    expect(smudgyBattle.repaintDue(ready)).toBe(true);
    // (Tried after this crowd move and none fitted: his move; again next turn.)
    smudgyBattle.apply(ready, null);
    expect(ready.state.boss!.powers!.repaintWait).toBe(6);
    expect(smudgyBattle.repaintDue(ready)).toBe(false);
    // Spent: two made, the last's turn kept as its ultAt.
    const spent = bossOn(fen, null, 20);
    Object.assign(spent.powers!, { repaints: 2, ults: 2, ultAt: 18, turn: 21 });
    expect(rageOf(spent)).toBeNull();
    expect(triggerUltimate(spent).ok).toBe(false);
    const done = stub(fen, hidden("g7"), 20);
    Object.assign(done.state.boss!.powers!, { repaints: 2, ults: 2, ultNext: true });
    expect(smudgyBattle.repaintDue(done)).toBe(false);
  });
});

describe("Smudgy: a small fuzz of whole battles", () => {
  it("never an illegal position, the hidden piece always his rook, the crowd never in a check it can't see, at most repaintMax Repaints", async () => {
    let swaps = 0;
    let repaints = 0;
    let reveals = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const side = seed % 2 ? "w" : "b";
      const r = battle(seed, side, seed % 4 < 2 ? "repaint" : "");
      const rng = mulberry32(seed * 31);
      const his = side === "w" ? "b" : "w";
      for (let i = 0; i < 70 && !r.isOver() && !r.stageComplete(); i++) {
        if (i % 7 === 6 && !r.bossToMove()) r.triggerUltimate();
        // (His move while the rook hides and stays hidden: named on the board the crowd saw; the review's SAN probe.)
        const hid = r.bossToMove() ? r.boss!.powers!.camo?.square : null;
        const seenBefore = hid ? maskedFen(fenOf(r), hid) : null;
        const plies = r.boards.get(0)!.history.length;
        await step(r, (fen, allowed) => crowdPick(fen, allowed, rng));
        const played = r.boards.get(0)!.history[plies];
        if (hid && seenBefore && played && r.boss!.powers!.camo?.square && r.bossView()?.lastMove) expect(r.bossView()!.lastMove!.san, `seed ${seed}`).toBe(toSan(seenBefore, played));
        const fen = fenOf(r);
        const board = r.boards.get(0)!;
        const where = `seed ${seed}, ${board.history.join(" ")}`;
        expect(stockfishRefuses(fen), where).toBeNull();
        expect(fenAtPly(board.history, board.history.length, board.bases), where).toBe(fen);
        const c = r.boss!.powers!.camo;
        if (c?.square) {
          expect(pieceAt(fen, c.square), where).toEqual({ color: his, type: "r" });
          if (sideToMove(fen) === side) {
            // The crowd to move: no check from the hidden rook (it would be revealed), none from the pawn it seems.
            const masked = maskedFen(fen, c.square);
            const allowed = r.crowdAllowed() ?? legalMoves(fen);
            expect(allowed.length, where).toBeGreaterThan(0);
            for (const m of allowed) expect(legalMoves(masked), where).toContain(m);
            // Never in a check it can't see, nor in one that isn't there; never stuck on the board it sees.
            expect(rookChecks(fen, c.square, his), where).toBe(false);
            expect(inCheck(masked), where).toBe(inCheck(fen));
            expect(seenMoveLeft(fen, c.square), where).toBe(true);
          }
        }
        expect(r.boss!.powers!.repaints ?? 0).toBeLessThanOrEqual(BOSS_POWERS.repaintMax);
      }
      const p = r.boss!.powers!;
      if (p.camo?.swap) swaps++;
      if (p.camo?.reveal) reveals++;
      repaints += p.repaints ?? 0;
    }
    expect(swaps).toBeGreaterThan(5);
    expect(reveals).toBeGreaterThan(0);
    expect(repaints).toBeGreaterThan(0);
  }, 120_000);
});
