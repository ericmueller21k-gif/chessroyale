import { describe, expect, it } from "vitest";
import { AUTOCHESS } from "@chessroyale/core";
import { beginRound, goldBreakdown, newMatch, refundFor, settleRound } from "../src/autochess/economy.ts";
import { piecesOn } from "../src/autochess/position.ts";
import { clockWords, damageWords, endWords, goldWords, headline, matchWords } from "../src/autochess/words.ts";

describe("auto chess: what the result says", () => {
  it("names how the fight ended, and the cap by what it decided", () => {
    expect(endWords("checkmate", false)).toBe("Checkmate.");
    expect(endWords("stalemate", true)).toBe("Stalemate.");
    expect(endWords("repetition", true)).toBe("Draw by repetition.");
    expect(endWords("fifty_moves", true)).toBe("Draw by the fifty-move rule.");
    expect(endWords("insufficient_material", true)).toBe("Draw: not enough pieces left to mate.");
    expect(endWords("cap", false)).toBe("60 moves played: more material wins.");
    expect(endWords("cap", true)).toBe("60 moves played with equal material.");
    expect(endWords("quiet", false)).toBe("10 moves each with no capture or check: more material wins.");
    expect(endWords("quiet", true)).toBe("10 moves each with no capture or check, and equal material.");
    expect(endWords("checks", false)).toBe("5 checks in a row count as mate.");
    expect(endWords("king_alone", false)).toBe("A side left with only its king loses at once.");
    expect(endWords("king_alone", true)).toBe("Both sides are down to a king: a draw.");
    expect(endWords("both_checked", true)).toBe("Both kings were in check at the start, so there was no fight.");
  });

  it("says who lost what", () => {
    const base = { piecesLeft: 4, refund: { you: { survivors: 0, bench: 0 }, bot: { survivors: 0, bench: 0 } } };
    expect([headline({ outcome: "you", damage: 6, ...base }), damageWords({ outcome: "you", damage: 6, ...base })]).toEqual(["You win the round.", "Your opponent loses 6 HP."]);
    expect([headline({ outcome: "bot", damage: 6, ...base }), damageWords({ outcome: "bot", damage: 6, ...base })]).toEqual(["You lose the round.", "You lose 6 HP."]);
    expect([headline({ outcome: "draw", damage: 0, ...base }), damageWords({ outcome: "draw", damage: 0, ...base })]).toEqual(["The round is a draw.", "Nobody loses HP."]);
    expect(matchWords(true)).toEqual({ head: "You win the match!", sub: "Your opponent is out of HP." });
    expect(matchWords(false)).toEqual({ head: "You lose the match.", sub: "You are out of HP." });
  });

  it("the gold line adds up: savings, income, interest, streak, survivors (the empty ones left out)", () => {
    const g = goldBreakdown(3, { gold: 120, hp: 20, wins: 2, losses: 0, refund: { survivors: 11 } });
    expect(g.total).toBe(120 + 11 + 140 + 10 + 10);
    expect(goldWords(g)).toBe("Next round: 120 saved + 140 income + 10 interest + 10 streak + 11 survivors = 291 gold");
    const plain = goldBreakdown(2, { gold: 0, hp: 20, wins: 0, losses: 1, refund: { survivors: 0 } });
    expect(goldWords(plain)).toBe("Next round: 0 saved + 120 income = 120 gold");
  });

  it("a clock counts down in whole seconds, rounded up", () => {
    expect([30000, 29001, 1, 0, -5, 61000].map(clockWords)).toEqual(["0:30", "0:30", "0:01", "0:00", "0:00", "1:01"]);
  });
});

describe("auto chess: survivors and promotions", () => {
  it("counts what is on the board when the fight ends, a promoted pawn as the piece it became", () => {
    // White's pawn became a queen on a8; Black has a rook and a pawn.
    const fen = "Q3k3/8/8/8/8/8/p7/r3K3 w - - 0 1";
    expect(piecesOn(fen)).toEqual({ w: ["q"], b: ["p", "r"] });
    expect(refundFor(piecesOn(fen).w)).toEqual({ survivors: Math.floor(90 * AUTOCHESS.survivorRefund) });
    const { match, result } = settleRound(beginRound(newMatch(1)).match, "you", { you: piecesOn(fen).w, bot: piecesOn(fen).b });
    // You won with one piece left: the bot loses 2 + 1.
    expect(result.damage).toBe(3);
    expect(match.bot.hp).toBe(17);
  });

  it("the settings hold the design's numbers (v4, v5, v6): tune them here, nowhere else", () => {
    expect(AUTOCHESS).toMatchObject({
      shop: { slots: 5, odds: { p: 75, n: 10, b: 8, r: 5, q: 2 }, rerollCost: 2 },
      sellBack: 0.75,
      benchSlots: 4,
      lockInBonus: 25,
      buySeconds: 30,
      lockSeconds: 3,
      circlesDelaySeconds: 2,
      adjustSeconds: 15,
      adjustMoves: 1,
      boardLimit: 10,
      kingRanks: 2,
      fightMoveMs: 350,
      fightFastAfter: 30,
      fightFastMoveMs: 175,
      moveCap: 60,
      hp: 20,
      damageBase: 2,
      damagePerPiece: 1,
      startGold: 0,
      income: { first: 100, step: 20, max: 200 },
      interest: { per: 100, gold: 10, max: 30 },
      survivorRefund: 0.25,
      queenLimit: 1,
      bot: expect.objectContaining({ lockFrom: 0.3, lockTo: 0.95, neverLockChance: 0.15, maxRerolls: 4, rerollGold: 40, rerollChance: 0.15, rerollChanceBare: 0.4, maxHolds: 2, holdChance: 0.5 }),
      maxPawns: 8,
      pawnsPerFile: 3,
    });
    expect(AUTOCHESS.winStreakGold).toEqual([{ n: 2, gold: 10 }, { n: 4, gold: 20 }, { n: 5, gold: 30 }]);
    expect(AUTOCHESS.lossStreakGold.every((r) => r.gold === 0)).toBe(true);
  });
});
