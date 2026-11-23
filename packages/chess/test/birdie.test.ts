import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BIRDIE_CINEMATIC, BIRDIE_ULT, BOSS_POWERS, mulberry32 } from "@chessroyale/core";
import {
  BIRDIE_BEATS,
  BIRDIE_FX,
  MatchRunner,
  POWER_FX,
  applyMove,
  birdieImpactMs,
  birdieTurnBeats,
  birdieTurnLayout,
  birdieTurnMs,
  bossRules,
  chooseLine,
  legalMoves,
  lineSquares,
  pieceAt,
  powerTurn,
  powerWinShowMs,
  rageOf,
  ragePaused,
  smashLegalNow,
  trainEscapes,
  trainExpected,
  trainJudged,
  trainLines,
  trainLoss,
  trainOutcome,
  trainRanked,
  trainReaches,
  trainSquare,
  trainWon,
  triggerUltimate,
  withoutPiece,
  type EngineLike,
} from "../src/index.ts";
import { KIT_OPENING, fakeEngine, kitSettings } from "./boss-kit-lib.ts";

/**
 * Birdie's rules (docs/decisions/2026-11-23-birdie-rules.md; bosses/birdie.ts): the Train (its lines, its pick, its timing and cooldown,
 * a saved piece, a smash, the king, a sparing, the judge's view, fair play) and the Fall (the material that brings it, once a battle, the
 * admins' trigger, Armored Birdie without the train), and his moments' lengths.
 */

const fenOf = (r: MatchRunner) => r.boards.get(r.state.boards[0]!)!.fen;
const birdieOf = (r: MatchRunner) => r.boss!.powers!.birdie ?? null;

function battle(seed = 7, side: "w" | "b" = "w", test = "", engines: EngineLike[] = [fakeEngine()]) {
  const settings = kitSettings({ boss: "birdie", test, maxMoves: 60 });
  return new MatchRunner({ settings, rng: mulberry32(seed), engines, library: [KIT_OPENING], entrants: [{ id: "h0", name: "H", isBot: false }], raidSide: side });
}

/** The board set to `fen` (a base at the ply, as a power's change is). */
function setBoard(r: MatchRunner, fen: string) {
  const id = r.state.boards[0]!;
  const b = r.boards.get(id)!;
  r.boards.set(id, { ...b, fen, bases: [...(b.bases ?? []).filter((x) => x.ply !== b.history.length), { ply: b.history.length, fen }] });
}

/** One crowd move: `pick` from the allowed moves (the first in sorted order without one). */
async function crowdMove(r: MatchRunner, pick?: (fen: string, allowed: string[]) => string) {
  r.deal();
  const fen = fenOf(r);
  const allowed = r.crowdAllowed() ?? legalMoves(fen);
  const move = pick ? pick(fen, allowed) : [...allowed].sort()[0]!;
  return r.score(new Map([["h0", { move, thinkMs: 1000 }]]));
}

/** Plays until the crowd's turn `turn` has been dealt (its warning, if any, set), the crowd picking quietly. */
async function untilTurn(r: MatchRunner, turn: number, pick?: (fen: string, allowed: string[]) => string) {
  for (let i = 0; i < 80 && !r.stageComplete(); i++) {
    if (r.bossToMove()) {
      await r.playBoss();
      continue;
    }
    r.deal();
    if (r.boss!.crowdMoves + 1 >= turn) return;
    await crowdMove(r, pick);
  }
}

describe("the Train's lines", () => {
  it("rides a file from his side down to yours, a rank from a to h", () => {
    expect(lineSquares("e", "w")).toEqual(["e8", "e7", "e6", "e5", "e4", "e3", "e2", "e1"]);
    expect(lineSquares("e", "b")).toEqual(["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]);
    expect(lineSquares("3", "w")).toEqual(["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3"]);
  });

  it("takes only a line with exactly one of your pieces, any piece, your king too", () => {
    // White (the crowd): king e1, knight b1 alone on the b-file and with the king on rank 1; pawns a2, h2.
    const fen = "4k3/8/8/8/8/8/P6P/1N2K3 w - - 0 1";
    const lines = trainLines(fen, "w").map((l) => `${l.line}:${l.square}`);
    expect(lines).toContain("b:b1");
    expect(lines).toContain("e:e1");
    expect(lines).toContain("a:a2");
    // (Rank 1 has two of yours, rank 2 two.)
    expect(lines.some((l) => l.startsWith("1:") || l.startsWith("2:"))).toBe(false);
  });

  it("never a piece you couldn't save: one without a move, the last shield of your king, one in front of his pawn about to promote", () => {
    // The a2 pawn blocked by his a3 pawn; the e2 knight the only thing between your e1 king and his e8 rook; the b1 knight in front of his
    // b2 pawn (it would promote on b1).
    const fen = "4r1k1/8/8/8/8/p7/Pp2N3/1N2K3 w - - 0 1";
    expect(smashLegalNow(fen, "e2", "w")).toBe(false);
    expect(smashLegalNow(fen, "b1", "w")).toBe(false);
    expect(smashLegalNow(fen, "e1", "w")).toBe(true);
    const squares = trainLines(fen, "w").map((l) => l.square);
    expect(squares).not.toContain("a2");
    expect(squares).not.toContain("e2");
    expect(squares).not.toContain("b1");
  });

  it("the seed picks among them, the same every time", () => {
    const fen = "4k3/8/8/8/8/8/P6P/1N2K3 w - - 0 1";
    const a = chooseLine(fen, "w", 123, 2);
    expect(a).toEqual(chooseLine(fen, "w", 123, 2));
    const picks = new Set(Array.from({ length: 40 }, (_, s) => chooseLine(fen, "w", s, 2)!.line));
    expect(picks.size).toBeGreaterThan(2);
    // (The starting position has no such line, every file and rank holding two or eight of yours: he waits.)
    expect(chooseLine("4k3/8/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1", "w", 1, 2)).toBeNull();
  });
});

describe("what his train does after your move", () => {
  it("smashes the piece left there, takes nothing from a piece moved off it, ends the battle on your king", () => {
    // You (White) left the b1 knight; him to move.
    const fen = "4k3/8/8/8/8/8/P6P/1N2K3 b - - 0 1";
    const out = trainOutcome(fen, "b1", "w")!;
    expect(out.spared).toBeUndefined();
    expect(pieceAt(out.fen, "b1")).toBeNull();
    expect(out.piece).toBe("n");
    expect(trainOutcome(fen, "c3", "w")).toBeNull();
    expect(trainOutcome(fen, "e1", "w")).toEqual({ fen, piece: "k", king: true });
  });

  it("spares a piece whose smash would leave your king open to his piece (your own move made it its last shield)", () => {
    // Your king e1 behind the e2 bishop, his rook e8: removing the bishop would leave your king attacked with him to move.
    const fen = "4r1k1/8/8/8/8/8/4B3/4K3 b - - 0 1";
    expect(trainOutcome(fen, "e2", "w")).toMatchObject({ spared: true, fen });
  });
});

describe("the judge sees the train", () => {
  const fen = "4k3/8/8/8/8/8/P6P/1N2K3 w - - 0 1";
  it("a move that leaves the warned piece loses its value; saving it loses nothing; your king left there is the battle", () => {
    expect(trainLoss(fen, "b1c3", "b1", "w")).toBe(0);
    expect(trainLoss(fen, "a2a3", "b1", "w")).toBe(3);
    expect(trainLoss(fen, "a2a3", "e1", "w")).toBe(Infinity);
    expect(trainExpected(0.6, 0)).toBe(0.6);
    expect(trainExpected(0.6, 3)).toBeLessThan(0.6);
    expect(trainExpected(0.6, Infinity)).toBe(0);
    expect(trainEscapes(fen, "b1").sort()).toEqual(legalMoves(fen).filter((m) => m.startsWith("b1")).sort());
  });

  it("ranks and scores with it: a saving move above a quiet one the engine liked a little more", () => {
    const top = [
      { move: "a2a3", expected: 0.62 },
      { move: "b1c3", expected: 0.6 },
    ];
    expect(trainRanked(top, fen, "b1", "w")[0]!.move).toBe("b1c3");
    const judged = trainJudged({ bestMove: "a2a3", bestExpected: 0.62, expectedAfter: { a2a3: 0.62, b1c3: 0.6 } }, fen, "b1", "w");
    expect(judged.bestMove).toBe("b1c3");
    expect(judged.expectedAfter.a2a3).toBeLessThan(0.6);
  });

  it("a lost position (every move 0) with your king warned: a king move ranks first and is the judge's best, never one that leaves him", () => {
    // Every top move expected 0; a2a3 sorts before e1d1 by name, but leaves the king on the line (the battle).
    const top = [
      { move: "a2a3", expected: 0 },
      { move: "e1d1", expected: 0 },
      { move: "h2h3", expected: 0 },
    ];
    expect(trainRanked(top, fen, "e1", "w")[0]!.move).toBe("e1d1");
    const judged = trainJudged({ bestMove: "a2a3", bestExpected: 0, expectedAfter: { a2a3: 0, e1d1: 0, h2h3: 0 } }, fen, "e1", "w");
    expect(judged.bestMove).toBe("e1d1");
  });
});

describe("the Train in a battle", () => {
  it("warns as your second turn begins (after his reply to your first move), then every trainEvery turns", async () => {
    const r = battle(3);
    await untilTurn(r, 2);
    const w = birdieOf(r)!.warn;
    expect(w?.turn).toBe(2);
    expect(r.boss!.powers!.events.some((e) => e.kind === "trainSignal" && e.square === w!.square)).toBe(true);
    expect(pieceAt(fenOf(r), w!.square)?.color).toBe("w");
    // (A warned turn: the judge's best changes, so fair play skips it, and the Last Stand sits out.)
    expect(powerTurn(r.boss!, fenOf(r))).toBe(true);
    expect(trainSquare(r.boss!)).toBe(w!.square);
    expect(birdieOf(r)!.next).toBe(2 + BOSS_POWERS.birdie.trainEvery);
  });

  it("a move of the warned piece saves it: no train", async () => {
    const r = battle(3);
    await untilTurn(r, 2);
    const w = birdieOf(r)!.warn!;
    await crowdMove(r, (_f, allowed) => allowed.filter((m) => m.startsWith(w.square)).sort()[0]!);
    expect(birdieOf(r)!.warn).toBeNull();
    expect(r.boss!.powers!.events.some((e) => e.kind === "trainSmash" || e.kind === "trainWin")).toBe(false);
  });

  it("any other move: at the start of his turn his train smashes it (a base on the board), and he moves on", async () => {
    const r = battle(3);
    await untilTurn(r, 2);
    const w = birdieOf(r)!.warn!;
    const before = fenOf(r);
    await crowdMove(r, (fen, allowed) => allowed.filter((m) => !m.startsWith(w.square) && trainLoss(fen, m, w.square, "w") > 0).sort()[0]!);
    const ev = r.boss!.powers!.events.find((e) => e.kind === "trainSmash");
    expect(ev?.square).toBe(w.square);
    expect(ev?.fizzled).toBeUndefined();
    expect(pieceAt(fenOf(r), w.square)).toBeNull();
    const board = r.boards.get(r.state.boards[0]!)!;
    expect(board.bases?.some((b) => b.ply === board.history.length && b.fen === fenOf(r))).toBe(true);
    expect(birdieOf(r)!.ride).toMatchObject({ at: 2, square: w.square, piece: pieceAt(before, w.square)!.type });
    expect(r.bossToMove()).toBe(true);
    await r.playBoss();
    expect(r.boss!.crowdMoves).toBe(2);
  });

  it("your king left on the line: the battle is his, whatever the board says", async () => {
    const r = battle(5);
    await untilTurn(r, 2);
    // A position where the king is the only piece on its rank and the warning is on it.
    setBoard(r, "4k3/8/8/8/8/8/P6P/1N2K3 w - - 0 1");
    const p = r.boss!.powers!;
    r.state = { ...r.state, boss: { ...r.boss!, powers: { ...p, birdie: { ...p.birdie!, warn: { turn: p.turn, line: "e", squares: lineSquares("e", "w"), square: "e1", piece: "k" } } } } };
    await crowdMove(r, (_f, allowed) => allowed.filter((m) => m.startsWith("a2")).sort()[0]!);
    expect(r.boss!.powers!.events.some((e) => e.kind === "trainWin")).toBe(true);
    expect(trainWon(r.boss!)).toBe(true);
    expect(r.stageComplete()).toBe(true);
    expect(r.finishBossBattle()).toBe("boss");
  });

  it("the test switch warns every turn from the second", async () => {
    const r = battle(3, "w", "train");
    await untilTurn(r, 3, (fen, allowed) => {
      const w = birdieOf(r)?.warn;
      return w ? allowed.filter((m) => m.startsWith(w.square)).sort()[0] ?? allowed.sort()[0]! : [...allowed].sort()[0]!;
    });
    expect(birdieOf(r)!.warn?.turn).toBe(3);
  });
});

describe("the Fall", () => {
  it("comes at the start of his turn once he has lost fallLost points, once a battle; then no more train", async () => {
    const r = battle(9);
    await untilTurn(r, 2);
    // His queen and rook gone (14 points), the crowd to move: as its move lands, he falls.
    const fen = fenOf(r);
    const his = fen.split(" ")[0]!.includes("q") ? "q" : null;
    expect(his).toBe("q");
    let cut = fen;
    for (const sq of ["d8", "a8"]) if (pieceAt(cut, sq)?.color === "b") cut = withoutPiece(cut, sq);
    setBoard(r, cut);
    await crowdMove(r);
    expect(r.boss!.powers!.events.some((e) => e.kind === "birdieFall")).toBe(true);
    expect(birdieOf(r)!.fell?.at).toBe(2);
    expect(triggerUltimate(r.boss!).ok).toBe(false);
    // His meter: full on the turn of his fall, then empty and dimmed for the rest of the battle (nothing hidden).
    await r.playBoss();
    r.deal();
    expect(rageOf(r.boss!)).toBe(0);
    expect(ragePaused(r.boss!)).toBe(true);
    // (No warning ever again.)
    for (let i = 0; i < 6 && !r.stageComplete(); i++) {
      if (r.bossToMove()) await r.playBoss();
      else await crowdMove(r);
      expect(birdieOf(r)!.warn).toBeNull();
    }
  });

  it("the admins' trigger brings it at the start of his next turn, without the material", async () => {
    const r = battle(11);
    await untilTurn(r, 2);
    expect(r.triggerUltimate()).toBe(true);
    await crowdMove(r, (_f, allowed) => {
      const w = birdieOf(r)?.warn;
      return (w && allowed.filter((m) => m.startsWith(w.square)).sort()[0]) || [...allowed].sort()[0]!;
    });
    expect(birdieOf(r)!.fell).toBeTruthy();
    expect(r.boss!.powers!.ultNext).toBeUndefined();
  });

  it("his meter is the material he has lost against fallLost", () => {
    const rules = bossRules({ id: "birdie" })!;
    const s = BOSS_POWERS;
    const p = { seed: 1, turn: 3, material: 39, lost: 3, nextPassive: 2, events: [] };
    expect(rules.meter!(p, 3, s)).toBeCloseTo(3 / s.birdie.fallLost);
    expect(rules.meter!({ ...p, lost: 20 }, 3, s)).toBe(1);
  });
});

describe("his moments' lengths", () => {
  it("each of POWER_FX is his beats' total; the ride's nose reaches each square in order; the cutscene's beats add up", () => {
    expect(POWER_FX.trainSignal).toBe(BIRDIE_FX.trainSignal);
    expect(POWER_FX.trainSmash).toBe(BIRDIE_BEATS.ride.total);
    expect(POWER_FX.birdieFall).toBe(BIRDIE_BEATS.fall.total);
    const reach = Array.from({ length: 8 }, (_, i) => trainReaches(i));
    expect(reach.every((t, i) => i === 0 || t > reach[i - 1]!)).toBe(true);
    expect(reach[7]!).toBeLessThan(BIRDIE_BEATS.ride.rideMs);
    // (The cutscene, Moo's length (Eric: "about 6 to 7 s"), after his wait for his ult's piece: its drop on the train's impact.)
    const c = BIRDIE_CINEMATIC;
    const f = BIRDIE_BEATS.fall;
    expect(f.total - f.fallAt).toBe(c.dropMs + c.fadeInMs + c.tumbleMs + c.approachMs + c.hitHoldMs + c.revealMs + c.holdMs + c.fadeOutMs);
    expect(f.total - f.fallAt - c.dropMs).toBeGreaterThanOrEqual(6000);
    expect(f.total - f.fallAt - c.dropMs).toBeLessThanOrEqual(7000);
  });

  it("his fall waits for his ult's piece: the train's impact on its drop, about 15 s in, his line before the cutscene (Eric, Nov 23)", () => {
    const f = BIRDIE_BEATS.fall;
    const c = BIRDIE_CINEMATIC;
    // (The piece starts BIRDIE_ULT.pieceAt into the moment; its drop, introMs later, is the impact: the approach's last frame.)
    expect(f.impactAt).toBe(BIRDIE_ULT.pieceAt + BIRDIE_ULT.introMs);
    expect(f.impactAt).toBe(f.approachAt + c.approachMs);
    expect(f.impactAt).toBeGreaterThanOrEqual(14815);
    expect(f.impactAt).toBeLessThan(16000);
    expect(f.hitAt - f.impactAt).toBe(c.hitHoldMs);
    expect(f.lineAt).toBeGreaterThan(BIRDIE_ULT.pieceAt);
    expect(f.lineAt).toBeLessThan(f.fallAt - 3000);
    expect(f.fallAt).toBeGreaterThan(0);
    // (The piece's length to its drop, as themes.json has it: the same within a millisecond.)
    const themes = JSON.parse(readFileSync(new URL("../../app/public/music/themes.json", import.meta.url), "utf8"));
    const ult = themes.themes[BIRDIE_ULT.theme];
    expect(Math.abs(ult.introSeconds * 1000 - BIRDIE_ULT.introMs)).toBeLessThan(1);
    expect(ult.loop).toBe(themes.themes.birdie.loop);
    expect(themes.themes.birdie.intro).toBeNull();
  });

  it("the turn's layout: the ride first, then his fall, after QUEEN SLAIN!; the impact from the thinking's start; the beats in order", () => {
    const view = (events: { kind: string; turn: number }[]) => ({ crowdSide: "w" as const, crowdMoves: 2, powers: { turn: 2, events }, board: { history: ["e2e4", "e7e5", "g1f3", "b8c6"] } });
    expect(birdieImpactMs(view([]))).toBeNull();
    expect(birdieImpactMs(view([{ kind: "trainSmash", turn: 2 }]))).toBeNull();
    expect(birdieImpactMs(view([{ kind: "birdieFall", turn: 2 }]))).toBe(BIRDIE_BEATS.fall.impactAt);
    const both = view([{ kind: "birdieFall", turn: 2 }, { kind: "trainSmash", turn: 2 }]);
    expect(birdieTurnLayout(both).map((m) => m.kind)).toEqual(["trainSmash", "birdieFall"]);
    expect(birdieImpactMs(both)).toBe(POWER_FX.trainSmash + BIRDIE_BEATS.fall.impactAt);
    // (Another turn's events: not this turn's.)
    expect(birdieImpactMs(view([{ kind: "birdieFall", turn: 1 }]))).toBeNull();
    const beats = birdieTurnBeats(both);
    expect(beats).toEqual([...beats].sort((a, b) => a - b));
    expect(beats.at(-1)).toBe(POWER_FX.trainSmash + POWER_FX.birdieFall);
    expect(beats).toContain(POWER_FX.trainSmash + BIRDIE_BEATS.fall.impactAt);
  });

  it("his thinking waits for the ride and the fall (in that order), and a win by the train holds the board for its ride", () => {
    const view = (events: { kind: string }[]) => ({ crowdSide: "w" as const, crowdMoves: 2, powers: { events }, board: { history: ["e2e4", "e7e5", "g1f3", "b8c6"] } });
    expect(birdieTurnMs(view([]))).toBe(0);
    expect(birdieTurnMs(view([{ kind: "trainSmash" }]))).toBe(POWER_FX.trainSmash + BIRDIE_CINEMATIC.tailPadMs);
    expect(birdieTurnMs(view([{ kind: "trainSmash" }, { kind: "birdieFall" }]))).toBe(POWER_FX.trainSmash + POWER_FX.birdieFall + BIRDIE_CINEMATIC.tailPadMs);
    expect(powerWinShowMs(view([{ kind: "trainSmash" }]))).toBe(0);
    expect(powerWinShowMs(view([{ kind: "trainWin" }]))).toBeGreaterThan(POWER_FX.trainWin);
    expect(applyMove).toBeTypeOf("function");
  });
});
