import { describe, expect, it } from "vitest";
import { AUTOCHESS } from "@chessroyale/core";
import { beginRound, goldBreakdown, newMatch, refundFor, settleRound } from "../src/autochess/economy.ts";
import { piecesOn } from "../src/autochess/position.ts";
import { clockWords, damageWords, endWords, fightRulesWords, goldWords, headline, matchWords, moveCount, moveWords } from "../src/autochess/words.ts";

describe("auto chess: what the result says", () => {
  it("the fight's rules, in the box while it plays, from the settings (short enough for a 320 px phone)", () => {
    expect(fightRulesWords()).toBe(
      "One engine plays both armies. A side left with only its king loses. Gains count, not army size: 3 pawns gained for 6 moves wins, " +
        "and a stall (repeats, 10 moves each with no capture, or 60) goes to the side that gained more. A pawn at the far end cashes in for +2 gold.",
    );
    expect(fightRulesWords().length).toBeLessThanOrEqual(280);
    expect(fightRulesWords({ ...AUTOCHESS, decisiveMargin: 500, quietCap: 8 })).toContain("5 pawns gained for 6 moves wins, and a stall (repeats, 8 moves each");
  });

  it("names how the fight ended; a stall says why and who gained since the start, in whole pawns", () => {
    expect(endWords("checkmate", false)).toBe("Checkmate.");
    expect(endWords("stalemate", true)).toBe("Stalemate.");
    expect(endWords("fifty_moves", true)).toBe("Draw by the fifty-move rule.");
    expect(endWords("insufficient_material", true)).toBe("Draw: not enough pieces left to mate.");
    // The sides are "you" and "your opponent", as the rest of the screen names them (your color changes every round); the gain is White's.
    expect(endWords("repetition", false, AUTOCHESS, { winner: "w", gain: 213, you: "w" })).toBe("Fight stalled (moves repeated): you gained 2 pawns.");
    expect(endWords("repetition", true, AUTOCHESS, { winner: null, gain: 40, you: "w" })).toBe("Fight stalled (moves repeated): neither side gained the edge, a draw.");
    expect(endWords("quiet", false, AUTOCHESS, { winner: "b", gain: -104, you: "w" })).toBe("Fight stalled (10 moves each, no capture): your opponent gained 1 pawn.");
    expect(endWords("quiet", false, AUTOCHESS, { winner: "b", gain: -104, you: "b" })).toBe("Fight stalled (10 moves each, no capture): you gained 1 pawn.");
    expect(endWords("quiet", true, AUTOCHESS, { winner: null, gain: -99, you: "b" })).toBe("Fight stalled (10 moves each, no capture): neither side gained the edge, a draw.");
    expect(endWords("cap", false, AUTOCHESS, { winner: "w", gain: 649, you: "b" })).toBe("Fight stalled (60 moves each): your opponent gained 6 pawns.");
    expect(endWords("cap", false, AUTOCHESS, { winner: "w", gain: 150, you: "w" })).toBe("Fight stalled (60 moves each): you gained 2 pawns.");
    expect(endWords("cap", true, AUTOCHESS, { winner: null, gain: 0, you: "w" })).toBe("Fight stalled (60 moves each): neither side gained the edge, a draw.");
    expect(endWords("cap", false, AUTOCHESS, { winner: "b", gain: -29900, you: "w" })).toBe("Fight stalled (60 moves each): your opponent gained a winning edge.");
    expect(endWords("decided", false, AUTOCHESS, { winner: "b", gain: -720, you: "b" })).toBe("You gained 3+ pawns and held it for 6 moves.");
    expect(endWords("decided", false, AUTOCHESS, { winner: "b", gain: -720, you: "w" })).toBe("Your opponent gained 3+ pawns and held it for 6 moves.");
    // Without your color (no player): White and Black.
    expect(endWords("cap", false, AUTOCHESS, { winner: "w", gain: 649 })).toBe("Fight stalled (60 moves each): White gained 6 pawns.");
    expect(endWords("decided", false, AUTOCHESS, { winner: "b" })).toBe("Black gained 3+ pawns and held it for 6 moves.");
    // The words follow the settings.
    expect(endWords("quiet", false, { ...AUTOCHESS, quietCap: 8 }, { winner: "w", gain: 300, you: "w" })).toBe("Fight stalled (8 moves each, no capture): you gained 3 pawns.");
    // Under a pawn (half a pawn wins a stall): "the edge", never "0 pawns".
    expect(endWords("quiet", false, AUTOCHESS, { winner: "w", gain: 60, you: "w" })).toBe("Fight stalled (10 moves each, no capture): you gained the edge.");
    expect(endWords("repetition", false, AUTOCHESS, { winner: "b", gain: -99, you: "w" })).toBe("Fight stalled (moves repeated): your opponent gained the edge.");
    expect(endWords("cap", false, AUTOCHESS, { winner: "b", gain: -100, you: "b" })).toBe("Fight stalled (60 moves each): you gained 1 pawn.");
    expect(endWords("decided", false, { ...AUTOCHESS, decisiveMargin: 800, decisiveMoves: 2 }, { winner: "w", you: "w" })).toBe("You gained 8+ pawns and held it for 2 moves.");
    // No word of checks in a row any more.
    for (const end of ["checkmate", "decided", "stalemate", "repetition", "fifty_moves", "insufficient_material", "cap", "quiet", "king_alone", "both_checked"] as const) {
      expect(endWords(end, false, AUTOCHESS, { winner: "w", gain: 300 })).not.toMatch(/check(s| in a row)/i);
    }
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
    const g = goldBreakdown(3, { gold: 12, hp: 20, wins: 2, losses: 0, refund: { survivors: 3 } });
    expect(g.total).toBe(12 + 3 + 14 + 1 + 1);
    expect(goldWords(g)).toBe("Next round: 12 saved + 14 income + 1 interest + 1 streak + 3 survivors = 31 gold");
    const plain = goldBreakdown(2, { gold: 0, hp: 20, wins: 0, losses: 1, refund: { survivors: 0 } });
    expect(goldWords(plain)).toBe("Next round: 0 saved + 12 income = 12 gold");
    // A fight's cash-ins (2 gold a pawn: one pawn here) get their own part.
    const cashed = goldBreakdown(2, { gold: 2, hp: 20, wins: 0, losses: 0, refund: { survivors: 2, cashIns: 2 } } as never);
    expect(goldWords(cashed)).toBe("Next round: 2 saved + 12 income + 2 survivors + 2 from cash-ins = 18 gold");
  });

  it("a clock counts down in whole seconds, rounded up", () => {
    expect([30000, 29001, 1, 0, -5, 61000].map(clockWords)).toEqual(["0:30", "0:30", "0:01", "0:00", "0:00", "1:01"]);
    // The fight's counter in the gold row's clock: short ("12/60"); the full words say the speed-up too.
    expect([0, 1, 2, 23, 59, 118].map((plies) => moveCount(plies))).toEqual(["1/60", "1/60", "2/60", "12/60", "30/60", "60/60"]);
    expect(moveWords(23)).toBe("Move 12 of 60");
  });
});

describe("auto chess: survivors", () => {
  it("counts what is on the board when the fight ends", () => {
    // White has a queen on a8; Black has a rook and a pawn.
    const fen = "Q3k3/8/8/8/8/8/p7/r3K3 w - - 0 1";
    expect(piecesOn(fen)).toEqual({ w: ["q"], b: ["p", "r"] });
    expect(refundFor(piecesOn(fen).w)).toEqual({ survivors: Math.round(9 * AUTOCHESS.survivorRefund) });
    expect(refundFor(piecesOn(fen).w).survivors).toBe(2);
    const { match, result } = settleRound(beginRound(newMatch(1)).match, "you", { you: piecesOn(fen).w, bot: piecesOn(fen).b });
    // You won in round 1 with one piece left: the bot loses 1 (the round's number) and nothing for the piece (1 for every 3).
    expect(result.damage).toBe(1);
    expect(match.bot.hp).toBe(23);
  });

  it("the settings hold the design's numbers (v4, v5, v6, v7, the TFT-style economy): tune them here, nowhere else", () => {
    expect(AUTOCHESS).toMatchObject({
      shop: { slots: 4, reroll: { first: 2, step: 1, max: 5 } },
      sellBack: 0.75,
      benchSlots: 4,
      lockIn: false,
      lockInBonus: 3,
      buySeconds: 30,
      lockSeconds: 3,
      circlesDelaySeconds: 2,
      adjustStep: true,
      adjustMode: "stars",
      adjustSeconds: 7,
      adjustMoves: 1,
      starUpCost: 1,
      maxStars: 3,
      moveBase: 5,
      movePerStar: 3,
      levels: { start: 4, max: 10, freeXp: 2, buyXp: 4, buyXpCost: 4, xpToNext: [4, 8, 12, 16, 20, 24] },
      kingRanks: 2,
      hopEvery: [7, 10],
      fightMoveMs: 600,
      cashInGold: 2,
      fightFastAfter: 30,
      fightFastMoveMs: 300,
      moveCap: 60,
      quietCap: 10,
      stallWinMargin: 50,
      decisiveMargin: 300,
      decisiveMoves: 6,
      mateShowMoves: 5,
      hp: 24,
      damagePerRound: 1,
      piecesPerDamage: 3,
      startGold: 0,
      income: { first: 10, step: 2, max: 20 },
      interest: { per: 10, gold: 1, max: 5 },
      survivorRefund: 0.25,
      queenLimit: 1,
      bot: expect.objectContaining({ lockFrom: 0.3, lockTo: 0.95, neverLockChance: 0.15, maxRerolls: 3, rerollGold: 7, rerollChance: 0.06, rerollChanceBare: 0.2, maxHolds: 2, holdChance: 0.5, placeBy: 0.7, maxXpBuys: 3, xpGold: 6, xpRichGold: 14, xpChance: 0.3, xpChanceFull: 0.8, saveChance: 0.3, saveKeep: 8, queenChange: 4 }),
      maxPawns: 8,
      pawnsPerFile: 3,
    });
    expect(AUTOCHESS.prices).toEqual({ p: 1, n: 3, b: 3, r: 5, q: 9 });
    expect(AUTOCHESS.winStreakGold).toEqual([{ n: 2, gold: 1 }, { n: 4, gold: 2 }, { n: 5, gold: 3 }]);
    expect(AUTOCHESS.lossStreakGold.every((r) => r.gold === 0)).toBe(true);
  });
});
