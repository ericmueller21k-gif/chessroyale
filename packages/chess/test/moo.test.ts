import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOSS_POWERS, BOSS_ROSTER, isPlayable, mulberry32, type BossPowerState, type BossState, type PowerEvent } from "@chessroyale/core";
import {
  BOSS_OPENING,
  MOO_BEATS,
  MOO_FX,
  MatchRunner,
  POWER_FX,
  applyMove,
  beamAfter,
  beamLines,
  beamOrder,
  bossRules,
  bossThinkMs,
  chooseBeams,
  crowdAllowed,
  fullMoonMs,
  initPowers,
  legalMoves,
  mooBattle,
  newBoard,
  pieceAt,
  powerTurn,
  prepareTurn,
  rageOf,
  ragePaused,
  sideToMove,
  stunnedIn,
  triggerUltimate,
  type Battle,
  type EngineLike,
} from "../src/index.ts";
import { KIT_OPENING, crowdPick, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Moo & Moon's rules (docs/decisions/2026-10-20-moo-rules.md; bosses/moo.ts): Moonbeam (every 3 of his moves, at the end
 * of his turn: its target, its fallbacks, never the king, always a move left, one crowd turn, the judge and the bots) and
 * the Full Moon (at the start of his turn, his brain at full strength for 5 moves and back, the flurry, dazed, the meter
 * held), his moments, and a small fuzz of whole battles.
 */

const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const mooOf = (r: MatchRunner) => r.boss!.powers!.moo ?? { moves: 0, stun: null, full: null };
const from = (m: string) => m.slice(0, 2);

/** A battle through the match runner on the stand-in engine (the kit's), Moo met as the test link does. */
function battle(seed: number, side: "w" | "b" = "w", test = "", engines: EngineLike[] = [fakeEngine()], bots = 0) {
  const settings = kitSettings({ boss: "moo", test, maxMoves: 40 });
  const entrants = [{ id: "h0", name: "H", isBot: false }, ...Array.from({ length: bots }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true }))];
  return new MatchRunner({ settings, rng: mulberry32(seed), engines, library: [KIT_OPENING], entrants, raidSide: side });
}

/** The crowd's move: the first allowed one in sorted order, unless `pick` says otherwise. */
const firstAllowed = (_fen: string, allowed: string[]) => [...allowed].sort()[0]!;

/** One crowd move (the human's pick; bots pick their own). Returns the round's report. */
async function crowdMove(r: MatchRunner, pick: (fen: string, allowed: string[]) => string = firstAllowed) {
  r.deal();
  const fen = fenOf(r);
  const move = pick(fen, r.crowdAllowed() ?? legalMoves(fen));
  return r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

/** The crowd's moves and his until his `n`-th move is played. */
async function untilHisMove(r: MatchRunner, n: number, pick?: (fen: string, allowed: string[]) => string) {
  while (mooOf(r).moves < n && !r.isOver() && !r.stageComplete()) {
    if (r.bossToMove()) await r.playBoss();
    else await crowdMove(r, pick);
  }
}

/** Within a describe: the beams' target set to `target` (BOSS_POWERS.moonbeamTarget), put back after. */
function onTarget(target: "best" | "valuable" | "random") {
  const powers = BOSS_POWERS as { moonbeamTarget: string };
  let was = "";
  beforeAll(() => {
    was = powers.moonbeamTarget;
    powers.moonbeamTarget = target;
  });
  afterAll(() => {
    powers.moonbeamTarget = was;
  });
}

const events = (r: MatchRunner): PowerEvent[] => r.bossView()?.powers?.events ?? [];

/** A Battle on one position (him to move unless `crowdMoves` says the crowd has moved), for his after-move rules on their own. */
function stub(fen: string, moo: BossPowerState["moo"], crowdMoves: number, test = ""): Battle {
  const board = { ...newBoard(0, BOSS_OPENING, 0), fen, history: [] as string[] };
  const powers: BossPowerState = { ...initPowers(1, fen, "w"), turn: crowdMoves, moo };
  const b: Battle = {
    state: { boards: [0], boss: { id: "moo", crowdSide: "w", crowdMoves, powers } } as unknown as Battle["state"],
    boards: new Map([[0, board]]),
    settings: kitSettings({ boss: "moo", test, maxMoves: 40 }),
    bossLast: null,
    engines: [],
    alive: () => [],
    finalGameOver: () => false,
    bossToMove: () => sideToMove(b.boards.get(0)!.fen) === "b",
    crowdAllowed: () => null,
    boardOf: () => null,
    afterCrowdMove: () => undefined,
    bossPassed: () => undefined,
    memo: new Map(),
    now: () => 0,
  };
  return b;
}

describe("Moo & Moon on the roster", () => {
  it("is on the roster with his powers, live with his kit (playable), and his numbers are in BOSS_POWERS", () => {
    const def = BOSS_ROSTER.find((d) => d.id === "moo")!;
    expect(def).toMatchObject({ name: "Moo & Moon", icon: "🐄", kit: "Moo", powers: { passive: "moonbeam", ultimate: "fullmoon" } });
    expect(isPlayable(def)).toBe(true);
    expect(bossRules(def)?.opening).toBeUndefined();
    expect(BOSS_POWERS).toMatchObject({ moonbeamEvery: 3, fullMoonMoves: 5, flurryBeams: 5 });
    expect(BOSS_POWERS.rageSpeed.moo).toBeGreaterThan(0);
  });

  it("has every moment's length in POWER_FX: each the longest of his animation and its last beam's fall and hit", () => {
    for (const k of ["moonbeam", "flurry", "fullMoon", "dazed"] as const) expect(POWER_FX[k]).toBe(MOO_FX[k]);
    const b = MOO_BEATS.moonbeam;
    expect(b.total).toBeGreaterThanOrEqual(b.beamAt + b.fallMs + b.hitMs);
    const f = MOO_BEATS.flurry;
    // (The board art's FLURRY_STAGGER_MS, the moon's beam1 to beam5 cues 120 ms apart.)
    expect(f.stagger).toBe(120);
    expect(f.total).toBeGreaterThanOrEqual(f.beamAt + (BOSS_POWERS.flurryBeams - 1) * f.stagger + f.fallMs + f.hitMs);
    expect(MOO_FX).toEqual({ moonbeam: 1040, flurry: 1430, fullMoon: 1340, dazed: 1250 });
  });
});

describe("Moonbeam: its target, \"best\" (the engine-best move's piece)", () => {
  onTarget("best");
  // White (the crowd) to move: queen d1, rooks a1 h1, knights, pawns; his pieces anywhere.
  const fen = "r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";

  it("is the piece that moves in the crowd's engine-best move (the first line)", () => {
    expect(chooseBeams(fen, "w", ["f1c4", "d2d4", "b1c3"], 1, 1, 3)).toEqual(["f1"]);
    expect(chooseBeams(fen, "w", ["d2d4", "f1c4"], 1, 1, 3)).toEqual(["d2"]);
  });

  it("orders the lines' pieces first (each once), then the crowd's other pieces with a move by value", () => {
    const order = beamOrder(fen, "w", ["d2d4", "d2d3", "f3e5"], 1, 3);
    expect(order.slice(0, 2)).toEqual(["d2", "f3"]);
    const rest = order.slice(2).map((sq) => pieceAt(fen, sq)!.type);
    const value: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
    for (let i = 1; i < rest.length; i++) expect(value[rest[i - 1]!]!).toBeGreaterThanOrEqual(value[rest[i]!]!);
  });

  it("falls back to value without lines (no engine answer, an older app): the queen first when she can move", () => {
    const open = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(chooseBeams(open, "w", null, 1, 1, 3)).toEqual(["d1"]);
    // (The same seed and move: the same order on every device.)
    expect(beamOrder(open, "w", null, 7, 6)).toEqual(beamOrder(open, "w", null, 7, 6));
  });

  it("ignores lines that aren't legal here or aren't the crowd's, and never takes the king or a piece without a move", () => {
    const order = beamOrder(fen, "w", ["e1e2", "e8e7", "a1a2", "zz99", "c8d7"], 1, 3);
    expect(order).not.toContain("e1");
    expect(order).not.toContain("a1");
    expect(order).not.toContain("e8");
    for (const sq of order) {
      expect(pieceAt(fen, sq)!.color).toBe("w");
      expect(pieceAt(fen, sq)!.type).not.toBe("k");
      expect(legalMoves(fen).some((m) => from(m) === sq)).toBe(true);
    }
    // (The king's line names no piece: the next line's does.)
    expect(chooseBeams(fen, "w", ["e1e2", "b1c3"], 1, 1, 3)).toEqual(["b1"]);
  });

  it("always leaves the crowd a legal move: the only piece that answers a check is passed over, and here no beam lands", () => {
    // White in check from the rook on a1: only Rd8-d1 blocks (the king is boxed in by his own pawns and the rook's rank).
    const check = "3R4/7k/8/8/8/8/6PP/r6K w - - 0 1";
    expect(legalMoves(check)).toEqual(["d8d1"]);
    expect(chooseBeams(check, "w", ["d8d1"], 1, 1, 3)).toEqual([]);
  });

  it("a stunned rook can't castle either: the king's castling move with it is left out, and counted out of the moves left", () => {
    const fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    expect(legalMoves(fen)).toContain("e1g1");
    expect(stunnedIn(fen, "e1g1", ["h1"])).toBe(true);
    expect(stunnedIn(fen, "e1f1", ["h1"])).toBe(false);
    expect(stunnedIn(fen, "e1g1", ["a1"])).toBe(false);
    expect(stunnedIn(fen, "h1g1", new Set(["h1"]))).toBe(true);
    // (Black's too: a8 for the c-file, h8 for the g-file.)
    const black = "r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1";
    expect(stunnedIn(black, "e8c8", ["a8"])).toBe(true);
    expect(stunnedIn(black, "e8g8", ["a8"])).toBe(false);
    const boss = { id: "moo", crowdSide: "w", crowdMoves: 3, powers: { ...initPowers(1, fen, "w"), turn: 4, moo: { moves: 3, stun: { turn: 4, squares: ["h1"] }, full: null } } } as unknown as BossState;
    const allowed = crowdAllowed(boss, fen)!;
    expect(allowed).not.toContain("e1g1");
    expect(allowed).not.toContain("h1g1");
    expect(allowed).toContain("e1f1");
  });

  it("takes the next most useful piece when the first would leave no move", () => {
    // In check from the rook on a1; Rd8-d1 or Bh6-c1 block. Stunning one leaves the other.
    const check = "3R4/7k/7B/8/8/8/6PP/r6K w - - 0 1";
    expect(chooseBeams(check, "w", ["d8d1", "h6c1"], 1, 1, 3)).toEqual(["d8"]);
    expect(chooseBeams(check, "w", ["d8d1", "h6c1"], 5, 1, 3)).toEqual(["d8"]);
  });

  it("the flurry: up to five different pieces, the most useful first, fewer when any more would leave no move", () => {
    // The crowd's king boxed in (g1 his own bishop, g2 and h2 his pawns): its bishop, knight and pawns can move.
    const boxed = "4k3/8/8/8/8/8/6PP/1N4BK w - - 0 1";
    const squares = chooseBeams(boxed, "w", null, 5, 1, 3);
    expect(new Set(squares).size).toBe(squares.length);
    expect(squares.length).toBe(3);
    // (Whichever three: what's left still has a move.)
    expect(legalMoves(boxed).some((m) => !squares.includes(from(m)))).toBe(true);
    expect(squares).not.toContain("h1");
  });

  it("beamLines: the crowd's top moves after his move, best first, from the position after it; null without an answer", async () => {
    const before = "r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 2";
    const lines = (await beamLines(fakeEngine(), before, "g8f6", 8))!;
    const after = applyMove(before, "g8f6");
    expect(lines.length).toBe(8);
    for (const m of lines) expect(legalMoves(after)).toContain(m);
    const top = await fakeEngine().topMoves(after, 8);
    expect(lines).toEqual([...top].sort((a, b) => b.expected - a.expected || (a.move < b.move ? -1 : 1)).map((m) => m.move));
    const broken: EngineLike = { ...fakeEngine(), topMovesAt: async () => Promise.reject(new Error("no engine")) };
    expect(await beamLines(broken, before, "g8f6", 8)).toBeNull();
    expect(await beamLines(fakeEngine(), before, "a1a8", 8)).toBeNull();
  });
});

describe("Moonbeam in the match (the \"best\" target)", () => {
  onTarget("best");
  it("comes after every 3rd move of his (the count from his first), at the end of his turn, on the engine-best move's piece", async () => {
    const r = battle(11);
    for (let n = 1; n <= 7; n++) {
      // (His move's lines, as the runner asks them: the crowd's top moves after it on the same engine.)
      await untilHisMove(r, n - 1);
      if (!r.bossToMove()) await crowdMove(r);
      expect(r.bossBeam()).toBe(n % 3 === 0 ? BOSS_POWERS.moonbeamLines : null);
      const before = fenOf(r);
      await r.playBoss();
      const after = fenOf(r);
      const move = r.boards.get(r.state.boards[0]!)!.history.at(-1)!;
      const m = mooOf(r);
      expect(m.moves).toBe(n);
      const beams = events(r).filter((e) => e.kind === "moonbeam");
      if (n % 3) {
        expect(m.stun).toBeNull();
        expect(beams).toEqual([]);
        continue;
      }
      // The beam: the crowd's piece in its best line after his move (the stand-in engine's), set for the crowd's next turn.
      const lines = (await beamLines(fakeEngine(), before, move, BOSS_POWERS.moonbeamLines))!;
      expect(m.stun).toEqual({ turn: r.boss!.crowdMoves + 1, squares: chooseBeams(after, "w", lines, 1, r.boss!.powers!.seed, n) });
      const best = lines.find((l) => pieceAt(after, from(l))?.type !== "k")!;
      expect(m.stun!.squares).toEqual([from(best)]);
      expect(beams).toEqual([{ kind: "moonbeam", turn: r.boss!.crowdMoves + 1, square: from(best) }]);
    }
  });

  it("stuns its piece for exactly the crowd's next turn: left out of its allowed moves, shown in the view, then free", async () => {
    const r = battle(5);
    await untilHisMove(r, 3);
    const sq = mooOf(r).stun!.squares[0]!;
    const fen = fenOf(r);
    const allowed = r.crowdAllowed()!;
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.some((m) => from(m) === sq)).toBe(false);
    expect(legalMoves(fen).some((m) => from(m) === sq)).toBe(true);
    expect(r.bossView()!.powers!.stunned).toEqual([sq]);
    expect(powerTurn(r.boss)).toBe(true);
    // (The stunned piece still attacks and defends: only its own moves are out.)
    expect(allowed).toEqual(legalMoves(fen).filter((m) => from(m) !== sq));
    await crowdMove(r);
    // The crowd's turn has ended: the glow is gone while he thinks, and on the crowd's next turn the piece is free.
    expect(r.bossView()!.powers!.stunned).toEqual([]);
    expect(mooOf(r).stun).toBeNull();
    await r.playBoss();
    expect(mooOf(r).moves).toBe(4);
    expect(r.crowdAllowed()).toBeNull();
    expect(r.bossView()!.powers!.stunned).toEqual([]);
    expect(powerTurn(r.boss)).toBe(false);
  });

  it("the judge, the bots and the God King play by it: nothing scored or played moves a stunned piece", async () => {
    const r = battle(8, "w", "moonbeam", [fakeEngine()], 6);
    let checked = 0;
    for (let i = 0; i < 12 && !r.isOver() && !r.stageComplete(); i++) {
      if (r.bossToMove()) {
        await r.playBoss();
        continue;
      }
      const stun = mooOf(r).stun;
      const report = await crowdMove(r);
      if (!stun) continue;
      checked++;
      for (const br of report.boards) {
        for (const s of br.scored) expect(stun.squares).not.toContain(from(s.move));
        expect(stun.squares).not.toContain(from(br.result.playedMove!));
      }
    }
    // (The test switch: a beam after every one of his moves.)
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("the test switch ?power=moonbeam brings a beam after every one of his moves", () => {
    expect([1, 2, 3, 4].map((n) => beamAfter(n, "moonbeam"))).toEqual([true, true, true, true]);
    expect([1, 2, 3, 4, 5, 6].map((n) => beamAfter(n, ""))).toEqual([false, false, true, false, false, true]);
  });

  it("no piece fits: no beam that turn, and the count carries on (the next after his next 3rd move)", () => {
    // After his 3rd move the crowd is in check with only Rd8-d1 to answer it: nothing to beam.
    const b = stub("3R4/7k/8/8/8/8/6PP/r6K w - - 0 1", { moves: 2, stun: null, full: null }, 2);
    mooBattle.afterHisMove(b, ["d8d1"]);
    expect(b.state.boss!.powers!.moo!).toMatchObject({ moves: 3, stun: null });
    expect(beamAfter(4, "")).toBe(false);
    expect(beamAfter(6, "")).toBe(true);
  });

  it("an older app's answer (no lines): the beam still lands, on the crowd's most valuable piece with a move", () => {
    const after = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const b = stub(after, { moves: 2, stun: null, full: null }, 1);
    mooBattle.afterHisMove(b, null);
    expect(b.state.boss!.powers!.moo!.stun).toEqual({ turn: 2, squares: ["d1"] });
  });
});

describe("Moonbeam: its target, the other settings", () => {
  const fen = "r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const movers = [...new Set(legalMoves(fen).map(from))].filter((sq) => pieceAt(fen, sq)!.type !== "k").sort();

  it("\"random\": every mobile piece but the king, each once, in an order from the seed (the engine's lines ignored)", () => {
    const order = beamOrder(fen, "w", ["f1c4"], 1, 3, "random");
    expect([...order].sort()).toEqual(movers);
    expect(beamOrder(fen, "w", null, 1, 3, "random")).toEqual(order);
    // (Another move of his, another order.)
    const orders = new Set([3, 6, 9, 12, 15].map((at) => beamOrder(fen, "w", null, 1, at, "random")[0]));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("\"valuable\" (Ginger's way): one of the three most valuable mobile pieces, at random from the seed; then the rest by that ranking", () => {
    // Pieces before pawns, then value (times 3) and moves: the queen (1 move), the h1 rook (1) and the f1 bishop (5; the
    // f3 knight's 5 too, after it by square).
    const top = ["d1", "f1", "h1"];
    const picks = new Set<string>();
    for (const at of [3, 6, 9, 12, 15, 18, 21]) {
      const order = beamOrder(fen, "w", ["d2d4"], 1, at, "valuable");
      expect([...order.slice(0, 3)].sort()).toEqual(top);
      expect([...order].sort()).toEqual(movers);
      picks.add(chooseBeams(fen, "w", null, 1, 1, at, "valuable")[0]!);
    }
    expect(picks.size).toBeGreaterThan(1);
    for (const sq of picks) expect(top).toContain(sq);
  });

  it("the flurry follows the setting: five different pieces, never the king, always a move left", () => {
    for (const target of ["best", "valuable", "random"] as const) {
      const squares = chooseBeams(fen, "w", ["d2d4"], 5, 1, 3, target);
      expect(squares).toHaveLength(5);
      expect(new Set(squares).size).toBe(5);
      expect(squares).not.toContain("e1");
      expect(legalMoves(fen).some((m) => !squares.includes(from(m)))).toBe(true);
      // (A check only one piece can answer: no beam, whatever the setting.)
      expect(chooseBeams("3R4/7k/8/8/8/8/6PP/r6K w - - 0 1", "w", null, 5, 1, 3, target)).toEqual([]);
    }
  });

  it("only \"best\" asks for the engine's lines: with the others the host isn't asked", () => {
    const b = stub("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", { moves: 2, stun: null, full: null }, 1);
    expect(mooBattle.beamAsk(b, { ...BOSS_POWERS, moonbeamTarget: "best" })).toBe(BOSS_POWERS.moonbeamLines);
    expect(mooBattle.beamAsk(b, { ...BOSS_POWERS, moonbeamTarget: "random" })).toBeNull();
    expect(mooBattle.beamAsk(b, { ...BOSS_POWERS, moonbeamTarget: "valuable" })).toBeNull();
  });
});

describe("Full Moon", () => {
  it("warned as a turn begins, it comes at the start of his turn (as the crowd's move lands), then he plays his move", async () => {
    const r = battle(3, "w", "fullmoon");
    await crowdMove(r);
    await r.playBoss();
    // The test switch: warned as the second turn begins.
    expect(events(r)).toContainEqual({ kind: "warn", turn: 2 });
    expect(r.bossMoveKind()).not.toBe("best");
    await crowdMove(r);
    // The crowd's move has landed: his transformation, while he thinks; his move still to come.
    const p = r.boss!.powers!;
    expect(r.bossToMove()).toBe(true);
    expect(events(r)).toContainEqual({ kind: "fullMoon", turn: 2 });
    expect(p.ultAt).toBe(2);
    expect(p.ults).toBe(1);
    expect(p.moo!.full).toEqual({ at: 2, left: BOSS_POWERS.fullMoonMoves });
    expect(r.bossView()!.powers!.fullMoon).toEqual({ left: BOSS_POWERS.fullMoonMoves });
    // His thinking lasts at least as long as the transformation.
    const view = r.bossView()!;
    expect(fullMoonMs(view)).toBe(MOO_FX.fullMoon);
    expect(bossThinkMs(view, false, fullMoonMs(view))).toBeGreaterThanOrEqual(MOO_FX.fullMoon);
    expect(r.bossMoveKind()).toBe("best");
  });

  it("his brain is the engine at full strength for exactly 5 of his moves, then his own again; the meter held empty meanwhile", async () => {
    const calls: string[] = [];
    const base = fakeEngine();
    const spy: EngineLike = {
      ...base,
      playAtElo: async (fen, elo, nodes) => (calls.push(`elo:${nodes}`), base.playAtElo!(fen, elo, nodes)),
      topMovesAt: async (fen, n, nodes) => (calls.push(`top${n}:${nodes}`), base.topMovesAt!(fen, n, nodes)),
    };
    const r = battle(4, "w", "fullmoon", [spy]);
    await untilHisMove(r, 1);
    await crowdMove(r);
    const kinds: string[] = [];
    for (let k = 0; k < BOSS_POWERS.fullMoonMoves + 2; k++) {
      if (!r.bossToMove()) await crowdMove(r);
      if (r.isOver() || r.stageComplete()) break;
      const kind = r.bossMoveKind();
      kinds.push(kind);
      calls.length = 0;
      await r.playBoss(spy);
      // At full strength: one line at his move's own budget, never his limited strength.
      if (kind === "best") {
        expect(calls).toContain(`top1:${r.settings.bossNodes}`);
        expect(calls.some((c) => c.startsWith("elo:"))).toBe(false);
      } else expect(calls).not.toContain(`top1:${r.settings.bossNodes}`);
      if (k < BOSS_POWERS.fullMoonMoves - 1) {
        expect(rageOf(r.boss)).toBe(0);
        expect(r.bossView()!.powers!.fullMoon).toEqual({ left: BOSS_POWERS.fullMoonMoves - 1 - k });
      }
    }
    expect(kinds.slice(0, BOSS_POWERS.fullMoonMoves)).toEqual(Array(BOSS_POWERS.fullMoonMoves).fill("best"));
    expect(kinds.slice(BOSS_POWERS.fullMoonMoves).every((k) => k !== "best")).toBe(true);
  });

  it("the flurry ends its first turn: up to 5 different pieces, never the king, in the order they land, each stunned one crowd turn", async () => {
    const r = battle(6, "w", "fullmoon");
    await untilHisMove(r, 1);
    await crowdMove(r);
    expect(mooOf(r).full?.left).toBe(BOSS_POWERS.fullMoonMoves);
    await r.playBoss();
    const fen = fenOf(r);
    const m = mooOf(r);
    expect(m.stun?.flurry).toBe(true);
    const squares = m.stun!.squares;
    expect(squares.length).toBeGreaterThan(1);
    expect(squares.length).toBeLessThanOrEqual(BOSS_POWERS.flurryBeams);
    expect(new Set(squares).size).toBe(squares.length);
    for (const sq of squares) expect(pieceAt(fen, sq)).toMatchObject({ color: "w" });
    for (const sq of squares) expect(pieceAt(fen, sq)!.type).not.toBe("k");
    expect(events(r).filter((e) => e.kind === "flurry")).toEqual([{ kind: "flurry", turn: r.boss!.crowdMoves + 1, squares }]);
    expect(events(r).some((e) => e.kind === "moonbeam")).toBe(false);
    expect(r.bossView()!.powers!.stunned).toEqual(squares);
    const allowed = r.crowdAllowed()!;
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.some((mv) => squares.includes(from(mv)))).toBe(false);
    await crowdMove(r);
    expect(mooOf(r).stun).toBeNull();
    await r.playBoss();
    // (His second move at full strength: no beam (his 3rd move brings the Moonbeam, not a second flurry).)
    expect(mooOf(r).moves).toBe(3);
    expect(mooOf(r).stun?.flurry).toBeUndefined();
  });

  it("replaces the Moonbeam when both fall due on its first turn, and the Moonbeam's count goes on", async () => {
    const r = battle(9, "w");
    await untilHisMove(r, 2);
    // The admins' trigger during the crowd's 3rd turn: the Full Moon at the start of his 3rd turn, his Moonbeam's turn.
    expect(r.triggerUltimate()).toBe(true);
    await crowdMove(r);
    expect(events(r).some((e) => e.kind === "fullMoon")).toBe(true);
    expect(r.boss!.powers!.ultNext).toBeUndefined();
    expect(r.bossBeam()).toBe(BOSS_POWERS.moonbeamTarget === "best" ? BOSS_POWERS.moonbeamLines : null);
    await r.playBoss();
    expect(mooOf(r).moves).toBe(3);
    const kinds = events(r).map((e) => e.kind);
    expect(kinds).toContain("flurry");
    expect(kinds).not.toContain("moonbeam");
    // His 6th move still brings the Moonbeam (the count carried on through the Full Moon).
    await untilHisMove(r, 5);
    if (!r.bossToMove()) await crowdMove(r);
    expect(r.bossBeam()).toBe(BOSS_POWERS.moonbeamTarget === "best" ? BOSS_POWERS.moonbeamLines : null);
    await r.playBoss();
    expect(events(r).map((e) => e.kind)).toContain("moonbeam");
  });

  it("after his last move at full strength he's dazed as the crowd's turn begins, and his meter fills again", async () => {
    const r = battle(12, "w", "fullmoon");
    await untilHisMove(r, 1);
    await crowdMove(r);
    const firstMove = mooOf(r).moves + 1;
    for (let k = 0; k < BOSS_POWERS.fullMoonMoves; k++) {
      expect(ragePaused(r.boss) || r.bossToMove()).toBe(true);
      await untilHisMove(r, firstMove + k);
      expect(events(r).some((e) => e.kind === "dazed")).toBe(k === BOSS_POWERS.fullMoonMoves - 1);
    }
    expect(mooOf(r).full).toBeNull();
    expect(r.bossView()!.powers!.fullMoon).toBeNull();
    const p = r.boss!.powers!;
    expect(p.ultAt).toBeUndefined();
    expect(p.warnAt).toBeUndefined();
    expect(ragePaused(r.boss)).toBe(false);
    expect(rageOf(r.boss)).toBe(0);
    // A few crowd moves later the meter has filled some.
    await untilHisMove(r, firstMove + BOSS_POWERS.fullMoonMoves + 2);
    expect(rageOf(r.boss)!).toBeGreaterThan(0);
  });

  it("rage doesn't gather while it lasts: the God King's strike adds nothing, and the admins' trigger refuses", async () => {
    const r = battle(13, "w", "fullmoon");
    await untilHisMove(r, 1);
    await crowdMove(r);
    expect(triggerUltimate(r.boss).ok).toBe(false);
    await r.playBoss();
    const before = r.boss!.powers!.charge ?? 0;
    r.deal();
    for (const pl of r.alive()) r.callStrike(pl.id);
    expect(r.boss!.powers!.charge ?? 0).toBe(before);
    expect(ragePaused(r.boss)).toBe(true);
  });

  it("the trigger is kept to the start of his turn, without the warning", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const boss = { id: "moo", crowdSide: "w", crowdMoves: 3, powers: { ...initPowers(1, fen, "w"), turn: 3 } } as unknown as BossState;
    const pulled = triggerUltimate(boss).boss!;
    const next = prepareTurn(pulled, fen);
    expect(next.powers!.ultNext).toBe(true);
    expect(next.powers!.events.some((e) => e.kind === "warn")).toBe(false);
    expect(next.powers!.ultAt).toBeUndefined();
  });

  it("not once the battle has reached its move cap", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2";
    const b = stub(fen, { moves: 39, stun: null, full: null }, 40);
    expect(b.settings.bossMaxMoves).toBe(40);
    b.state.boss!.powers = { ...b.state.boss!.powers!, warnAt: 40 };
    expect(b.bossToMove()).toBe(true);
    mooBattle.afterCrowdMove(b);
    expect(b.state.boss!.powers!.ultAt).toBeUndefined();
    expect(b.state.boss!.powers!.events.some((e) => e.kind === "fullMoon")).toBe(false);
    // (One move earlier it comes.)
    const c = stub(fen, { moves: 38, stun: null, full: null }, 39);
    c.state.boss!.powers = { ...c.state.boss!.powers!, warnAt: 39 };
    mooBattle.afterCrowdMove(c);
    expect(c.state.boss!.powers!.ultAt).toBe(39);
  });

  it("not when the crowd's move ended the battle", () => {
    // The crowd has just moved and he has no move (mated): no Full Moon.
    const mated = "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1";
    const b = stub(mated, { moves: 4, stun: null, full: null }, 5);
    b.state.boss!.powers = { ...b.state.boss!.powers!, warnAt: 5 };
    b.bossToMove = () => false;
    mooBattle.afterCrowdMove(b);
    expect(b.state.boss!.powers!.ultAt).toBeUndefined();
    expect(b.state.boss!.powers!.moo!.full).toBeNull();
  });
});

describe("Moo & Moon: a small fuzz of whole battles", () => {
  it("every beam on a crowd piece with a move, never the king; a move always left; the Full Moon 5 moves at full strength, dazed after", async () => {
    let beams = 0;
    let flurries = 0;
    let moons = 0;
    for (let seed = 1; seed <= 3; seed++) {
      for (const [side, test] of [["w", "fullmoon"], ["b", "moonbeam"], ["w", ""]] as const) {
        const r = battle(seed * 31, side, test);
        const rng = mulberry32(seed);
        let full = 0;
        for (let i = 0; i < 80 && !r.isOver() && !r.stageComplete(); i++) {
          if (r.bossToMove()) {
            if (r.bossMoveKind() === "best") full++;
            await r.playBoss();
            const m = mooOf(r);
            const fen = fenOf(r);
            if (m.stun) {
              m.stun.flurry ? flurries++ : beams++;
              expect(m.stun.turn).toBe(r.boss!.crowdMoves + 1);
              expect(m.stun.squares.length).toBeLessThanOrEqual(m.stun.flurry ? BOSS_POWERS.flurryBeams : 1);
              for (const sq of m.stun.squares) {
                expect(pieceAt(fen, sq)?.color).toBe(r.boss!.crowdSide);
                expect(pieceAt(fen, sq)?.type).not.toBe("k");
                expect(legalMoves(fen).some((mv) => from(mv) === sq)).toBe(true);
              }
              const allowed = crowdAllowed(r.boss, fen);
              expect(allowed === null || allowed.length > 0).toBe(true);
              expect((allowed ?? legalMoves(fen)).some((mv) => m.stun!.squares.includes(from(mv)))).toBe(false);
            }
            if (events(r).some((e) => e.kind === "dazed")) {
              expect(full).toBe(BOSS_POWERS.fullMoonMoves);
              full = 0;
            }
            continue;
          }
          if (r.isOver() || r.stageComplete()) break;
          if (i > 6 && test === "" && !r.boss!.powers!.ultNext && r.boss!.powers!.ultAt === undefined && rng() < 0.1) r.triggerUltimate();
          await crowdMove(r, (fen, allowed) => crowdPick(fen, allowed, rng));
          if (events(r).some((e) => e.kind === "fullMoon")) moons++;
        }
      }
    }
    expect(beams).toBeGreaterThan(5);
    expect(flurries).toBeGreaterThan(2);
    expect(moons).toBeGreaterThan(2);
  }, 60_000);
});
