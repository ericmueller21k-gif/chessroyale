import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { stockfishRefuses, legalMoves, applyMove } from "@chessroyale/chess";
import {
  beginRound,
  damageFor,
  goldBreakdown,
  incomeFor,
  interestFor,
  matchWinner,
  newMatch,
  refundFor,
  roundSeed,
  settleRound,
  streakGold,
  youColor,
  type MatchState,
} from "../src/autochess/economy.ts";
import { botAdjust, botAt, botBuys, botPlan } from "../src/autochess/bot.ts";
import { addXp } from "../src/autochess/level.ts";
import { newShop } from "../src/autochess/shop.ts";
import { buyBlock, carryBench, emptyArmy, extras, halfSquares, kingSquares, legalCounts, owned, placeBlock } from "../src/autochess/army.ts";
import { fightStart, armiesFen, material } from "../src/autochess/position.ts";
import { fightMoves, moveMs, playFight, rulesFor, standInMove, thinFight, withPiece, type FightSoFar } from "../src/autochess/fight.ts";
import { HunchessEngine, replay, WIN } from "@chessroyale/chess/hunchess";
import { endWords, moveWords } from "../src/autochess/words.ts";
import type { Army, Kind } from "../src/autochess/types.ts";

describe("auto chess: the economy", () => {
  it("income is 100 in round 1, 20 more each round, up to 200", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map((r) => incomeFor(r))).toEqual([100, 120, 140, 160, 180, 200, 200, 200, 200]);
  });

  it("interest is 10 for every full 100 banked before the income, up to 30", () => {
    expect([0, 99, 100, 199, 200, 299, 300, 450, 1000].map((g) => interestFor(g))).toEqual([0, 0, 10, 10, 20, 20, 30, 30, 30]);
  });

  it("the win streak pays +10 at 2 or 3 in a row, +20 at 4, +30 at 5 or more; the loss streak pays nothing (off)", () => {
    const win = [0, 1, 2, 3, 4, 5, 9].map((n) => streakGold(AUTOCHESS.winStreakGold, n));
    expect(win).toEqual([0, 0, 10, 10, 20, 30, 30]);
    expect([0, 1, 2, 4, 5, 9].map((n) => streakGold(AUTOCHESS.lossStreakGold, n))).toEqual([0, 0, 0, 0, 0, 0]);
    // A loss streak setting works when switched on.
    expect(streakGold([{ n: 3, gold: 15 }], 3)).toBe(15);
  });

  it("round 1: no start gold, 100 income; later rounds add what was saved, interest, the streak and the refund", () => {
    const m = newMatch(1);
    expect(m.you.gold).toBe(0);
    const first = beginRound(m);
    expect(first.match.round).toBe(1);
    expect(first.gold.you).toEqual({ saved: 0, survivors: 0, cashIns: 0, income: 100, interest: 0, streak: 0, total: 100 });
    expect(first.match.you.gold).toBe(100);
    // Round 2 with 130 saved, a 2-win streak and 7 from the survivors: interest counts all of what was banked.
    const side = { gold: 130, hp: 20, wins: 2, losses: 0, refund: { survivors: 7 } };
    const g = goldBreakdown(2, side);
    expect(g).toEqual({ saved: 130, survivors: 7, cashIns: 0, income: 120, interest: 10, streak: 10, total: 130 + 7 + 120 + 10 + 10 });
    // 163 saved and 7 back is 170 banked, still one hundred; 200 would be two.
    expect(goldBreakdown(2, { ...side, gold: 193 }).interest).toBe(20);
  });

  it("a fight gives back 25% of the pieces still on the board (rounded down)", () => {
    expect(refundFor(["p", "p", "p", "n"])).toEqual({ survivors: 15 });
    expect(refundFor(["p"])).toEqual({ survivors: 2 });
    expect(refundFor([])).toEqual({ survivors: 0 });
    expect(refundFor(["q", "r", "b"])).toEqual({ survivors: Math.floor((90 + 50 + 32) * 0.25) });
  });

  it("a pawn that cashed in during the fight pays its side 5 gold with the next round's income (counted in the interest)", () => {
    expect(AUTOCHESS.cashInGold).toBe(5);
    const m: MatchState = beginRound(newMatch(7)).match;
    const r = settleRound(m, "bot", { you: ["n"], bot: ["p"] }, AUTOCHESS, { you: 2, bot: 1 });
    expect(r.match.you.refund).toEqual({ survivors: 7, cashIns: 10 });
    expect(r.match.bot.refund).toEqual({ survivors: 2, cashIns: 5 });
    const g = goldBreakdown(2, r.match.you);
    expect(g).toMatchObject({ saved: 100, survivors: 7, cashIns: 10, income: 120, interest: 10, total: 100 + 7 + 10 + 120 + 10 });
    // Paid out: the next round starts with nothing waiting.
    expect(beginRound(r.match).match.you.refund).toEqual({ survivors: 0 });
  });

  it("you are White in round 1, then the colors alternate", () => {
    expect([1, 2, 3, 4, 5].map(youColor)).toEqual(["w", "b", "w", "b", "w"]);
  });

  it("the loser loses 2 + 1 per enemy piece left; a draw costs nothing; a win ends the other side's streak", () => {
    expect([0, 1, 5, 12].map((n) => damageFor(n))).toEqual([2, 3, 7, 14]);
    let m: MatchState = beginRound(newMatch(7)).match;
    let r = settleRound(m, "you", { you: ["p", "p", "n"], bot: [] });
    expect(r.result).toMatchObject({ outcome: "you", damage: 5, piecesLeft: 3 });
    expect(r.match.bot.hp).toBe(15);
    expect(r.match.you.hp).toBe(20);
    expect(r.match.you).toMatchObject({ wins: 1, losses: 0, refund: { survivors: 12 } });
    expect(r.match.bot).toMatchObject({ wins: 0, losses: 1, refund: { survivors: 0 } });
    m = beginRound(r.match).match;
    expect(m.round).toBe(2);
    // Gold: the saved coins (100 earlier, none spent here) plus the refund, 10 interest (112 banked) and income.
    expect(m.you.gold).toBe(100 + 12 + 120 + 10);
    expect(m.you.refund).toEqual({ survivors: 0 });
    // A draw: nobody loses HP, and both streaks end.
    r = settleRound(m, "draw", { you: ["p"], bot: ["p", "p"] });
    expect(r.result).toMatchObject({ outcome: "draw", damage: 0 });
    expect(r.match.you).toMatchObject({ hp: 20, wins: 0, losses: 0 });
    expect(r.match.bot).toMatchObject({ hp: 15, wins: 0, losses: 0 });
    // The bot wins: you lose 2 + its pieces left.
    r = settleRound(m, "bot", { you: [], bot: ["r", "r", "p", "p"] });
    expect(r.match.you.hp).toBe(20 - 6);
    expect(r.match.you.losses).toBe(1);
  });

  it("the first side at 0 HP loses the match", () => {
    let m = beginRound(newMatch(3)).match;
    expect(matchWinner(m)).toBeNull();
    m = { ...m, bot: { ...m.bot, hp: 0 } };
    expect(matchWinner(m)).toBe("you");
    m = { ...m, bot: { ...m.bot, hp: 5 }, you: { ...m.you, hp: -1 } };
    expect(matchWinner(m)).toBe("bot");
  });

  it("nothing carries over between rounds but gold, HP and the win streak: a round starts with the two kings only", () => {
    const m = beginRound(newMatch(11)).match;
    const k = kingSquares(roundSeed(m));
    const you = emptyArmy(youColor(m.round), k[youColor(m.round)]);
    expect(you.board).toEqual({});
    const next = settleRound(m, "you", { you: ["q", "r"], bot: ["p"] }).match;
    const m2 = beginRound(next).match;
    // (The state has no armies at all: the next round's are built from nothing.)
    expect(Object.keys(m2).sort()).toEqual(["bot", "round", "seed", "you"]);
    expect(roundSeed(m2)).not.toBe(roundSeed(m));
    const fresh = emptyArmy(youColor(2), kingSquares(roundSeed(m2))[youColor(2)]);
    expect(fresh.board).toEqual({});
  });

  it("the bench is the one thing held from round to round (v6): each side's bench stays in the match through the fight's settling and the next round's pay", () => {
    expect(newMatch(5).you.bench).toEqual([]);
    expect(newMatch(5).bot.bench).toEqual([]);
    const held = { you: [{ kind: "n" as Kind, square: "c3" }], bot: [{ kind: "q" as Kind, square: "d7" }] };
    let m: MatchState = beginRound(newMatch(5)).match;
    m = { ...m, you: { ...m.you, bench: held.you }, bot: { ...m.bot, bench: held.bot } };
    const settled = settleRound(m, "you", { you: ["p"], bot: [] }).match;
    expect(settled.you.bench).toEqual(held.you);
    expect(settled.bot.bench).toEqual(held.bot);
    const next = beginRound(settled).match;
    expect(next.you.bench).toEqual(held.you);
    expect(next.bot.bench).toEqual(held.bot);
    // No refund for a held piece: only the pieces on the board when the fight ended come back at 25%.
    expect(goldBreakdown(2, settled.you).survivors).toBe(2);
    expect(Object.keys(goldBreakdown(2, settled.you)).sort()).toEqual(["cashIns", "income", "interest", "saved", "streak", "survivors", "total"]);
  });
});

/** Builds a legal army the way the player does: buys with the shop's rules, then places with the board's. */
function checkArmy(a: Army) {
  expect(legalCounts(owned(a))).toBe(true);
  const sq = Object.keys(a.board);
  expect(new Set(sq).size).toBe(sq.length);
  for (const s of sq) {
    const { [s]: kind, ...rest } = a.board;
    expect(placeBlock({ ...a, board: rest }, kind!, s)).toBeNull();
  }
}

describe("auto chess: the bot", () => {
  it("buys within its gold and the shop's limits, and puts its pieces on its own half, legally, for 300 seeds and every round", () => {
    for (let seed = 0; seed < 300; seed++) {
      const round = 1 + (seed % 12);
      const gold = [100, 100, 130, 156, 200, 254, 330, 410][seed % 8]! + (seed % 5) * 7;
      const rng = mulberry32(seed);
      const color = seed % 2 ? "w" : "b";
      const king = kingSquares(seed)[color];
      const plan = botPlan(color, king, gold, round, rng);
      expect(plan.spent).toBeLessThanOrEqual(gold);
      // Every piece it bought is on the board, on the square its offer named, or on its bench, with the square it will land on; rerolls have no square.
      const onBoard = plan.events.filter((e) => e.type === "buy" || e.type === "place");
      expect(onBoard.length).toBe(Object.keys(plan.army.board).length);
      expect(plan.events.filter((e) => e.type === "hold").length).toBe(plan.army.bench.length);
      expect(plan.events.filter((e) => e.type !== "reroll" && e.type !== "xp").every((e) => e.square !== null)).toBe(true);
      expect(plan.events.filter((e) => e.type === "reroll" || e.type === "xp").every((e) => e.square === null)).toBe(true);
      expect(plan.army.bench.length).toBeLessThanOrEqual(AUTOCHESS.benchSlots);
      checkArmy(plan.army);
      for (const e of plan.events) {
        if (e.square) {
          expect(halfSquares(color)).toContain(e.square);
          expect(e.square).not.toBe(king);
        }
        expect(e.at).toBeGreaterThan(0);
        // Over the step's open part, never in the locked end.
        expect(e.at).toBeLessThanOrEqual(AUTOCHESS.buySeconds - AUTOCHESS.lockSeconds - 1);
      }
      expect(plan.army.board).not.toHaveProperty(king);
      expect(Object.keys(plan.army.board).length).toBeLessThanOrEqual(plan.level.level);
      expect(owned(plan.army).q).toBeLessThanOrEqual(AUTOCHESS.queenLimit);
      expect(extras(owned(plan.army)) + owned(plan.army).p).toBeLessThanOrEqual(8);
      // Every position the fight could start from is one the engine accepts.
      const opp = emptyArmy(color === "w" ? "b" : "w", kingSquares(seed)[color === "w" ? "b" : "w"]);
      const [w, b] = color === "w" ? [plan.army, opp] : [opp, plan.army];
      const start = fightStart(w, b);
      if (!start.draw) expect(stockfishRefuses(start.fen), `seed ${seed}`).toBeNull();
    }
  });

  it("is deterministic for a seed", () => {
    const a = botPlan("b", "e8", 200, 5, mulberry32(9));
    const b = botPlan("b", "e8", 200, 5, mulberry32(9));
    expect(a).toEqual(b);
    expect(botBuys(emptyArmy("w", "e1"), 150, 3, mulberry32(4))).toEqual(botBuys(emptyArmy("w", "e1"), 150, 3, mulberry32(4)));
  });

  it("buys from its own random shop: its first piece is one the seeded shop shows, on the offer's square (a reroll may come first)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const army = emptyArmy("w", "e1");
      // (At 100 gold it doesn't draw for saving first, so the shop's seed is the first draw.)
      const shop = newShop((mulberry32(seed)() * 2 ** 32) >>> 0, army);
      const { buys } = botBuys(army, 100, 1, mulberry32(seed));
      if (buys[0]!.kind !== "reroll" && buys[0]!.kind !== "xp") expect(shop.slots).toContainEqual({ kind: buys[0]!.kind, square: buys[0]!.square });
    }
  });

  it("buys a mix (not pawns first: Eric, Oct 19), rooks and a queen as income grows, and never sells", () => {
    // Round 1, 100 gold: some pawns, more pieces than a random shop's 25%, never a queen.
    const kinds = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    for (let seed = 0; seed < 200; seed++) for (const b of botBuys(emptyArmy("w", "e1"), 100, 1, mulberry32(seed)).buys) if (b.kind !== "reroll" && b.kind !== "xp") kinds[b.kind]++;
    const total = kinds.p + kinds.n + kinds.b + kinds.r + kinds.q;
    expect(kinds.q).toBe(0);
    expect(kinds.p).toBeGreaterThan(0);
    expect((kinds.n + kinds.b + kinds.r) / total).toBeGreaterThan(0.25);
    let queens = 0;
    let rooks = 0;
    for (let seed = 0; seed < 200; seed++) {
      const late = botBuys(emptyArmy("w", "e1"), 200, 8, mulberry32(seed), AUTOCHESS, { level: 9, xp: 0 }).buys.flatMap((b) => (b.kind === "reroll" || b.kind === "xp" ? [] : [b.kind]));
      queens += late.filter((k) => k === "q").length;
      rooks += late.filter((k) => k === "r").length;
      expect(late.filter((k) => k === "q").length).toBeLessThanOrEqual(1);
      expect(late.filter((k) => k === "p").length).toBeLessThanOrEqual(AUTOCHESS.maxPawns);
    }
    expect(queens).toBeGreaterThan(8);
    expect(rooks).toBeGreaterThan(25);
    // Sometimes it keeps a hundred banked for interest (30%, when it has 130 or more).
    let kept = 0;
    for (let seed = 0; seed < 200; seed++) {
      const spent = botBuys(emptyArmy("w", "e1"), 160, 4, mulberry32(seed)).buys.reduce((sum, b) => sum + b.price, 0);
      if (spent <= 60) kept++;
    }
    expect(kept).toBeGreaterThan(30);
    expect(kept).toBeLessThan(100);
  });

  it("rerolls its shop now and then when it has gold to spare: at most 4 a round, never when it is poor, and every reroll costs 2", () => {
    let withReroll = 0;
    let rerolls = 0;
    for (let seed = 0; seed < 300; seed++) {
      const { buys } = botBuys(emptyArmy("w", "e1"), 100 + (seed % 4) * 40, 1 + (seed % 6), mulberry32(seed));
      const n = buys.filter((b) => b.kind === "reroll").length;
      expect(n).toBeLessThanOrEqual(AUTOCHESS.bot.maxRerolls);
      for (const b of buys) expect(b.price).toBe(b.kind === "reroll" ? AUTOCHESS.shop.rerollCost : b.kind === "xp" ? AUTOCHESS.levels.buyXpCost : b.type === "place" ? 0 : AUTOCHESS.prices[b.kind]);
      if (n) withReroll++;
      rerolls += n;
      // Poor: under the gold it likes to keep, it never rerolls.
      expect(botBuys(emptyArmy("w", "e1"), 30, 1, mulberry32(seed)).buys.filter((b) => b.kind === "reroll")).toHaveLength(0);
    }
    // "Now and then": some plans, not most.
    expect(withReroll).toBeGreaterThan(40);
    expect(withReroll).toBeLessThan(240);
    expect(rerolls).toBeGreaterThan(withReroll - 1);
    // It never puts more on its board than the board holds, nor more on its bench than the bench holds.
    for (let seed = 0; seed < 300; seed++) {
      const { buys, army, level } = botBuys(emptyArmy("w", "e1"), 400, 6, mulberry32(seed));
      expect(buys.filter((b) => b.type === "buy" || b.type === "place").length).toBeLessThanOrEqual(level.level);
      expect(army.bench.length).toBeLessThanOrEqual(AUTOCHESS.benchSlots);
    }
  });

  it("places what it held first, for nothing, where the squares are free; then buys; and what it can't place stays on its bench", () => {
    const held = [{ kind: "n" as Kind, square: "c6" }, { kind: "q" as Kind, square: "d8" }, { kind: "r" as Kind, square: "e8" }];
    for (let seed = 0; seed < 100; seed++) {
      // (The king stands on e8: the rook held for e8 can't land this round.)
      const plan = botPlan("b", "e8", 100, 1 + (seed % 6), mulberry32(seed), AUTOCHESS, held);
      const placed = plan.events.filter((e) => e.type === "place");
      expect(placed.map((e) => e.kind)).toEqual(["n", "q"]);
      expect(placed.every((e) => e.price === 0)).toBe(true);
      expect(plan.army.board).toMatchObject({ c6: "n", d8: "q" });
      expect(plan.army.bench).toEqual(expect.arrayContaining([{ kind: "r", square: "e8" }]));
      // A queen held is the one queen: it never buys another.
      expect(owned(plan.army).q).toBe(1);
      // What is placed costs nothing: the gold spent is only the buys, holds and rerolls.
      expect(plan.spent).toBe(plan.events.reduce((sum, e) => sum + (e.type === "place" ? 0 : e.price), 0));
      expect(plan.spent).toBeLessThanOrEqual(100);
      expect(plan.army.board).not.toHaveProperty("e8");
    }
  });

  const noXp = { ...AUTOCHESS, bot: { ...AUTOCHESS.bot, xpChance: 0, xpChanceFull: 0 } };

  it("with its board full (its level's limit) it holds a good piece on its bench, never a pawn, up to the setting, and pays for it", () => {
    let held = 0;
    for (let seed = 0; seed < 300; seed++) {
      // (Level 4 is 4 pieces; no XP, so the limit stays: the holds come once the fourth piece is down.)
      const { buys, army } = botBuys(emptyArmy("b", "e8"), 300, 6, mulberry32(seed), noXp, { level: 4, xp: 0 });
      expect(Object.keys(army.board).length).toBeLessThanOrEqual(4);
      const holds = buys.filter((b) => b.type === "hold");
      expect(holds.length).toBeLessThanOrEqual(AUTOCHESS.bot.maxHolds);
      expect(holds.every((b) => b.kind !== "p" && b.price === AUTOCHESS.prices[b.kind as Kind] && b.square !== null)).toBe(true);
      expect(army.bench).toEqual(holds.map((b) => ({ kind: b.kind, square: b.square })));
      // A hold only comes once the board is full.
      const firstHold = buys.findIndex((b) => b.type === "hold");
      if (firstHold >= 0) expect(buys.slice(0, firstHold).filter((b) => b.type === "buy" || b.type === "place")).toHaveLength(4);
      expect(buys.reduce((sum, b) => sum + b.price, 0)).toBeLessThanOrEqual(300);
      held += holds.length;
    }
    // "Now and then": it holds, but not every time.
    expect(held).toBeGreaterThan(100);
    expect(held).toBeLessThan(500);
  });

  it("shows what it has done by a time (the circles are drawn from this, 2 s behind): pieces on squares, and what it has spent, rerolls too", () => {
    for (let seed = 0; seed < 40; seed++) {
      const plan = botPlan("b", "e8", 100 + (seed % 3) * 60, 1 + (seed % 5), mulberry32(seed));
      expect(botAt(plan.events, 0)).toEqual({ squares: {}, spent: 0, xpBuys: 0 });
      const all = botAt(plan.events, 99);
      expect(all.squares).toEqual(plan.army.board);
      expect(all.spent).toBe(plan.spent);
      const t = plan.events[Math.floor(plan.events.length / 2)]!.at;
      const done = plan.events.filter((e) => e.at <= t);
      const mid = botAt(plan.events, t);
      expect(Object.keys(mid.squares)).toHaveLength(done.filter((e) => e.type === "buy" || e.type === "place").length);
      expect(mid.spent).toBe(done.reduce((sum, e) => sum + e.price, 0));
    }
  });

  it("adjusts greedily: its one change (a piece to any legal empty square) is kept only when the position scores better than standing still, and there is only one", async () => {
    const army: Army = { color: "w", king: "e1", board: { a2: "p", b2: "p", g1: "n" }, bench: [] };
    // (Every square of the half is a destination now, so a scorer that likes one is found by looking at all of them.)
    const wide = { ...AUTOCHESS, bot: { ...AUTOCHESS.bot, adjustDestinations: 40, adjustTries: 200 } };
    const changed = (a: Army) => Object.entries(a.board).filter(([sq, k]) => army.board[sq] !== k).length + (a.king !== army.king ? 1 : 0);
    // A scorer that likes the knight on f3 and nothing else.
    const calls: Army[] = [];
    const evaluate = async (a: Army) => {
      calls.push(a);
      return a.board.f3 === "n" ? 0.9 : 0.5;
    };
    const out = await botAdjust(army, evaluate, mulberry32(1), () => false, wide);
    expect(out.board.f3).toBe("n");
    // The rest did not move.
    expect(out.board.a2).toBe("p");
    expect(out.board.b2).toBe("p");
    expect(out.king).toBe("e1");
    expect(changed(out)).toBe(1);
    // A scorer that likes two different moves (the knight to f3, the pawn to a4) still gets one move.
    const both = await botAdjust(army, async (a) => 0.5 + (a.board.f3 === "n" ? 0.2 : 0) + (a.board.a4 === "p" ? 0.2 : 0), mulberry32(1), () => false, wide);
    expect(changed(both)).toBe(1);
    // A scorer that likes nothing: it stands still.
    expect(await botAdjust(army, async () => 0.5, mulberry32(1), () => false)).toEqual(army);
    // Small by design: at most the tries beyond the first look.
    let n = 0;
    await botAdjust({ ...army, board: { a2: "p", b2: "p", c2: "p", d2: "p", e2: "p", f2: "p", g2: "p", h2: "p", b1: "n", g1: "n", c1: "b", f1: "b" } }, async () => (n++, 0.5), mulberry32(2), () => false);
    expect(n).toBeLessThanOrEqual(AUTOCHESS.bot.adjustTries + 1);
    // And it stops when told to.
    let m = 0;
    await botAdjust(army, async () => (m++, 0.5), mulberry32(3), () => m >= 2);
    expect(m).toBeLessThanOrEqual(3);
  });

  it("over a whole match of rounds the bot stays legal under all of it: its level, bench, XP, rerolls and gold, round after round, for 150 seeds", () => {
    for (let seed = 0; seed < 150; seed++) {
      let gold = 0;
      let level = { level: AUTOCHESS.levels.start, xp: 0 };
      let bench: Army["bench"] = [];
      for (let round = 1; round <= 10; round++) {
        level = addXp(level, AUTOCHESS.levels.freeXp);
        gold += incomeFor(round) + interestFor(gold);
        const color = round % 2 ? "b" : "w";
        const king = kingSquares(seed * 31 + round)[color];
        const carried = carryBench(bench);
        // What it held comes in on squares of its half (turned with the colors), at most the bench's size.
        expect(carried.length).toBeLessThanOrEqual(AUTOCHESS.benchSlots);
        for (const h of carried) expect(halfSquares(color)).toContain(h.square);
        const plan = botPlan(color, king, gold, round, mulberry32(seed * 100 + round), AUTOCHESS, carried, level);
        // Gold: never spends what it hasn't (a placed held piece is free).
        expect(plan.spent).toBeLessThanOrEqual(gold);
        for (const e of plan.events) expect(e.price).toBe(e.type === "place" ? 0 : e.type === "reroll" ? AUTOCHESS.shop.rerollCost : e.type === "xp" ? AUTOCHESS.levels.buyXpCost : AUTOCHESS.prices[e.kind as Kind]);
        // Level: only what it bought (the free XP came before), and the board never holds more than the level.
        expect(plan.level).toEqual(addXp(level, plan.events.filter((e) => e.type === "xp").length * AUTOCHESS.levels.buyXp));
        expect(Object.keys(plan.army.board).length).toBeLessThanOrEqual(plan.level.level);
        // Pieces: board and bench together are a legal army (the pawn, queen and extras limits), the bench holds at most its slots, each piece on its half, the king alone on its square.
        expect(legalCounts(owned(plan.army))).toBe(true);
        expect(plan.army.bench.length).toBeLessThanOrEqual(AUTOCHESS.benchSlots);
        for (const h of plan.army.bench) expect(halfSquares(color)).toContain(h.square);
        for (const sq of Object.keys(plan.army.board)) expect(halfSquares(color)).toContain(sq);
        expect(plan.army.board).not.toHaveProperty(king);
        // Everything it held either went down or is still held; nothing is lost or made.
        const held0 = carried.map((h) => `${h.kind}${h.square}`).sort();
        const placed = plan.events.filter((e) => e.type === "place").map((e) => `${e.kind}${e.square}`);
        for (const p of placed) expect(held0).toContain(p);
        expect(plan.army.bench.filter((h) => held0.includes(`${h.kind}${h.square}`)).length + placed.length).toBeGreaterThanOrEqual(held0.length);
        gold -= plan.spent;
        expect(gold).toBeGreaterThanOrEqual(0);
        level = plan.level;
        bench = plan.army.bench;
      }
    }
  });

  it("under the rules the bot's whole step stays legal: its buys and its one move, for 120 seeds", async () => {
    for (let seed = 0; seed < 120; seed++) {
      const color = seed % 2 ? "w" : "b";
      const king = kingSquares(seed)[color];
      const plan = botPlan(color, king, 100 + (seed % 6) * 40, 1 + (seed % 9), mulberry32(seed));
      const start = plan.army;
      expect(Object.keys(start.board).length).toBeLessThanOrEqual(plan.level.level);
      expect(legalCounts(owned(start))).toBe(true);
      // A deterministic scorer standing in for the engine: likes pieces further up the board.
      const score = async (a: Army) => 0.4 + 0.01 * Object.keys(a.board).reduce((sum, sq) => sum + Math.abs(Number(sq[1]) - (color === "w" ? 1 : 8)), 0) / 4;
      const out = await botAdjust(start, score, mulberry32(seed + 77), () => false);
      checkArmy(out);
      expect(Object.keys(out.board).length).toBe(Object.keys(start.board).length);
      expect(out.board).not.toHaveProperty(out.king);
      expect(halfSquares(color)).toEqual(expect.arrayContaining([out.king, ...Object.keys(out.board)]));
      // The position is one the engine accepts (when it isn't a drawn start).
      const opp = emptyArmy(color === "w" ? "b" : "w", kingSquares(seed)[color === "w" ? "b" : "w"]);
      const [w, b] = color === "w" ? [out, opp] : [opp, out];
      const s = fightStart(w, b);
      if (!s.draw) expect(stockfishRefuses(s.fen), `seed ${seed}`).toBeNull();
    }
  });
});

/** The position a fight has reached. */
const fenOf = (g: FightSoFar) => replay({ ...g, rules: rulesFor() }).fen();
/** A pick written over the position and the moves so far. */
const byFen = (f: (fen: string, history: readonly string[]) => Promise<string | null>) => (g: FightSoFar) => f(fenOf(g), g.moves);
/** A stand-in for the engine: takes a capture when there is one, else a random legal move. */
const quickPick = (rng: () => number) => byFen(async (fen: string) => standInMove(fen, rng));

describe("auto chess: the fight", () => {
  const noWait = async () => undefined;

  it("stops at the move cap (60 moves a side): a stall, and the side with more material doesn't win it by holding its edge", async () => {
    expect(AUTOCHESS.moveCap).toBe(60);
    // A rook against a pawn, both kings stepping about: the cap (3 moves a side here) is a stall; nothing was gained, so a draw.
    const cfg = { ...AUTOCHESS, moveCap: 3 };
    const w: Army = { color: "w", king: "e1", board: { a2: "r" }, bench: [] };
    const b: Army = { color: "b", king: "e8", board: { h7: "p" }, bench: [] };
    const start = fightStart(w, b);
    const kingOnly = async (fen: string) => legalMoves(fen).find((m) => (fen.split(" ")[1] === "w" ? m.startsWith("e1") || m.startsWith("d1") || m.startsWith("d2") : m.startsWith("e8") || m.startsWith("d8"))) ?? null;
    const res = await playFight(start.fen, { pick: byFen(kingOnly), wait: noWait, rng: mulberry32(1), cfg });
    expect(res).toMatchObject({ end: "cap", winner: null });
    expect(res!.moves).toHaveLength(6);
  });

  it("a cap with equal material is a draw", async () => {
    const cfg = { ...AUTOCHESS, moveCap: 3 };
    const w: Army = { color: "w", king: "a1", board: { c2: "n" }, bench: [] };
    const b: Army = { color: "b", king: "h8", board: { f7: "n" }, bench: [] };
    const start = fightStart(w, b);
    // Each side only steps its king (never a capture), so material stays equal.
    const kingOnly = async (fen: string) => legalMoves(fen).find((m) => (fen.split(" ")[1] === "w" ? m.startsWith("a1") || m.startsWith("b1") || m.startsWith("b2") : m.startsWith("h8") || m.startsWith("g8") || m.startsWith("g7"))) ?? null;
    const res = await playFight(start.fen, { pick: byFen(kingOnly), wait: noWait, rng: mulberry32(1), cfg });
    expect(res).toMatchObject({ end: "cap", winner: null });
    expect(res!.moves).toHaveLength(6);
  });

  it("plays random fights from the bot\'s legal armies, each ending by a rule or the cap, never past it", async () => {
    let capped = 0;
    let mates = 0;
    for (let seed = 0; seed < 25; seed++) {
      const k = kingSquares(seed);
      const w = botPlan("w", k.w, 140 + (seed % 5) * 20, 3, mulberry32(seed)).army;
      const b = botPlan("b", k.b, 140 + (seed % 3) * 30, 3, mulberry32(seed + 1000)).army;
      const start = fightStart(w, b);
      if (start.draw) continue;
      expect(stockfishRefuses(start.fen)).toBeNull();
      const res = await playFight(start.fen, { pick: quickPick(mulberry32(seed)), wait: noWait, rng: mulberry32(seed), cfg: { ...AUTOCHESS, moveCap: 25 } });
      expect(res!.moves.length).toBeLessThanOrEqual(50);
      if (res!.end === "cap") capped++;
      if (res!.end === "checkmate") {
        mates++;
        expect(res!.winner).not.toBeNull();
        expect(replay({ startFen: start.fen, moves: res!.moves, rules: rulesFor() }).result()?.end).toBe("checkmate");
      }
    }
    expect(capped + mates).toBeGreaterThan(0);
  });

  it("finds mate, and the side that was mated loses", async () => {
    // White's king on g6 and rook on a2: the rook to a8 mates the king on h8 (Black has a pawn left: a side with only a king loses at once).
    const w: Army = { color: "w", king: "g6", board: { a2: "r" }, bench: [] };
    const b: Army = { color: "b", king: "h8", board: { b5: "p" }, bench: [] };
    const start = fightStart(w, b);
    expect(start.mover).toBe("w");
    const pick = async (fen: string) => (legalMoves(fen).includes("a2a8") ? "a2a8" : null);
    const res = await playFight(start.fen, { pick: byFen(pick), wait: noWait, rng: mulberry32(1) });
    expect(res).toMatchObject({ end: "checkmate", winner: "w", moves: ["a2a8"] });
  });

  it("a side that starts mated loses at once, a side that starts stalemated draws at once (no moves played)", async () => {
    // White's king on h1 is attacked by a rook on h8 and shut in by a rook on g8: Black wins, White having moved first (White keeps a pawn, so it isn't a lone king).
    const mated = fightStart({ color: "w", king: "h1", board: { a2: "p" }, bench: [] }, { color: "b", king: "a8", board: { h8: "r", g8: "r" }, bench: [] });
    expect(mated.mover).toBe("w");
    expect(await playFight(mated.fen, { pick: async () => null, wait: noWait, rng: mulberry32(1) })).toMatchObject({ end: "checkmate", winner: "b", moves: [] });
    // White's king on a1 isn't attacked but can't move: a rook covers b1 and b2, a bishop a2.
    // (A white pawn on h7 is blocked by the black king on h8: it has no move either.)
    const stale = fightStart({ color: "w", king: "a1", board: { h7: "p" }, bench: [] }, { color: "b", king: "h8", board: { b8: "r", e6: "b" }, bench: [] });
    expect(stale.mover).toBe("w");
    expect(await playFight(stale.fen, { pick: async () => null, wait: noWait, rng: mulberry32(1) })).toMatchObject({ end: "stalemate", winner: null, moves: [] });
  });

  it("a stand-in move is played when the engine gives none or an illegal one, and a cancelled fight returns nothing", async () => {
    const w: Army = { color: "w", king: "e1", board: { a2: "p" }, bench: [] };
    const b: Army = { color: "b", king: "e8", board: { a7: "p" }, bench: [] };
    const start = fightStart(w, b);
    const seen: number[] = [];
    let cancel = false;
    const res = await playFight(start.fen, {
      pick: async () => "zz99",
      wait: noWait,
      rng: mulberry32(4),
      onStep: (s) => {
        seen.push(s.ply);
        if (s.ply === 4) cancel = true;
      },
      cancelled: () => cancel,
    });
    expect(res).toBeNull();
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(applyMove(start.fen, standInMove(start.fen, mulberry32(1))!)).toBeTruthy();
  });

  it("no promotion: a pawn moving onto its last rank cashes in (it leaves the board, the step says whose, the fight counts it)", async () => {
    // White's pawn on b7 with its path clear: the fight's move is the plain b7b8 (a cash-in), never a promotion.
    const w: Army = { color: "w", king: "e1", board: { b7: "p", a2: "r" }, bench: [] };
    const b: Army = { color: "b", king: "h8", board: { h7: "p", g7: "p" }, bench: [] };
    const start = fightStart(w, b);
    expect(legalMoves(start.fen)).toContain("b7b8q");
    expect(fightMoves(start.fen)).toContain("b7b8");
    expect(fightMoves(start.fen).some((m) => m.length === 5)).toBe(false);
    const steps: { move: string; cashIn: string | null; fen: string }[] = [];
    const res = await playFight(start.fen, { pick: async (g) => (g.moves.length ? null : "b7b8"), onStep: (s) => steps.push(s), wait: noWait, rng: mulberry32(3), cfg: { ...AUTOCHESS, moveCap: 2 } });
    expect(steps[0]).toMatchObject({ move: "b7b8", cashIn: "w" });
    expect(steps[0]!.fen.split(" ")[0]).toBe("7k/6pp/8/8/8/8/R7/4K3");
    expect(steps.slice(1).every((s) => s.cashIn === null)).toBe(true);
    expect(res!.cashIns).toEqual({ w: 1, b: 0 });
    // The engine asking for a promotion gets a stand-in instead (no such move in a fight).
    const asked = await playFight(start.fen, { pick: async () => "b7b8q", wait: noWait, rng: mulberry32(3), cfg: { ...AUTOCHESS, moveCap: 2 } });
    expect(asked!.moves.some((m) => m.length === 5)).toBe(false);
    // White's king on a8 can't step (the knight on c6 covers a7 and b8): its only move is the pawn's cash-in, which leaves it a bare king: it loses.
    const onlyCashIn = "K7/1P6/2n5/8/8/8/8/7k w - - 0 1";
    expect(fightMoves(onlyCashIn)).toEqual(["b7b8"]);
    expect(await playFight(onlyCashIn, { pick: async () => null, wait: noWait, rng: mulberry32(1) })).toMatchObject({ end: "king_alone", winner: "b", moves: ["b7b8"], cashIns: { w: 1, b: 0 } });
    // For the screen: the pawn drawn on the square it reached for a moment, before it leaves.
    expect(withPiece("7k/6pp/8/8/8/8/R7/4K3 b - - 0 1", "b8", "P")).toBe("1P5k/6pp/8/8/8/8/R7/4K3 b - - 0 1");
  });

  /** Moves played in order, by ply. */
  const script = (plies: string[]) => async (g: FightSoFar) => plies[g.moves.length] ?? null;

  it("checks count for nothing (Eric, Oct 21): five checks in a row play on", async () => {
    expect("checksToWin" in AUTOCHESS).toBe(false);
    // A queen against a king (and a far-off pawn, so it isn't a lone king): five checks, none of them mate, and the fight goes on to
    // its (shortened) move cap.
    const fen = "7k/8/8/8/p7/8/8/K2Q4 w - - 0 1";
    const fiveChecks = ["d1d4", "h8h7", "d4a7", "h7g8", "a7a8", "g8h7", "a8b7", "h7g8", "b7a8"];
    const res = await playFight(fen, { pick: script(fiveChecks), wait: noWait, rng: mulberry32(1), cfg: { ...AUTOCHESS, moveCap: 5 } });
    expect(res).toMatchObject({ end: "cap" });
    expect(res!.moves.slice(0, 9)).toEqual(fiveChecks);
  });

  it("a stall goes to the side that gained a pawn during the fight, not to the bigger army (Eric, Oct 21); a check doesn't restart the count", async () => {
    expect([AUTOCHESS.quietCap, AUTOCHESS.stallWinMargin]).toEqual([10, 100]);
    // A rook against a pawn from the start: 10 quiet moves each (White's last one a check), and nothing gained, so a draw. (Before,
    // the rook's side won: "I shouldn't get rewarded just because I play more pieces.")
    const w: Army = { color: "w", king: "a1", board: { h2: "r" }, bench: [] };
    const b: Army = { color: "b", king: "a8", board: { e7: "p" }, bench: [] };
    const white = ["a1b1", "b1c1", "c1d1", "d1e1", "e1f1", "f1g1", "h2h3", "h3h4", "h4h5", "h5g5"];
    const black = ["a8b8", "b8c8", "c8d8", "d8e8", "e8f8", "f8g8", "e7e6", "e6e5", "e5e4", "g8f8"];
    const plies = white.flatMap((m, k) => [m, black[k]!]);
    const res = await playFight(fightStart(w, b).fen, { pick: script(plies), wait: noWait, rng: mulberry32(1) });
    expect(res).toMatchObject({ end: "quiet", winner: null, moves: plies });
    expect(Math.abs(res!.gain!)).toBeLessThan(100);
    // (The rook's lead is still there at the end: the score of the position, not the gain, is the rook's.)
    expect(res!.score).toBeGreaterThan(300);
    expect(endWords("quiet", true, AUTOCHESS, { winner: null, gain: res!.gain!, you: "w" })).toBe("Fight stalled (10 moves each, no capture): neither side gained a pawn, a draw.");
    // A capture is a gain (and starts the count again): Black's knight steps onto the rook's file and the rook takes it, then 10 quiet
    // moves each. (A piece hanging at the start is no gain: the start's score already counts its capture.)
    const w2: Army = { color: "w", king: "a1", board: { h2: "r" }, bench: [] };
    const b2: Army = { color: "b", king: "a8", board: { g8: "n", e7: "p" }, bench: [] };
    const white2 = ["a1b1", "h2h6", "b1c1", "c1d1", "d1e1", "e1f1", "f1g1", "g1g2", "g2g3", "g3g4", "g4g5", "g5f5"];
    const black2 = ["g8h6", "a8b8", "b8c8", "c8d8", "d8e8", "e8f8", "f8e8", "e8d8", "d8c8", "c8b8", "b8a8"];
    const res2 = await playFight(fightStart(w2, b2).fen, { pick: script(white2.flatMap((m, k) => (black2[k] ? [m, black2[k]!] : [m]))), wait: noWait, rng: mulberry32(1) });
    expect(res2).toMatchObject({ end: "quiet", winner: "w" });
    expect(res2!.moves).toHaveLength(23);
    expect(res2!.gain).toBeGreaterThan(200);
    expect(endWords("quiet", false, AUTOCHESS, { winner: "w", gain: res2!.gain!, you: "w" })).toMatch(/^Fight stalled \(10 moves each, no capture\): you gained \d+ pawns?\.$/);
    expect(endWords("quiet", false, AUTOCHESS, { winner: "w", gain: res2!.gain!, you: "b" })).toMatch(/^Fight stalled \(10 moves each, no capture\): your opponent gained \d+ pawns?\.$/);
  });

  it("a threefold repetition is a stall too: the bigger army that only kept its edge doesn't win it", async () => {
    // A rook against a knight from the start; the kings step back and forth until the position stands a third time.
    const w: Army = { color: "w", king: "a1", board: { h2: "r" }, bench: [] };
    const b: Army = { color: "b", king: "a8", board: { g7: "n" }, bench: [] };
    const steps = ["a1a2", "a8b8", "a2a1", "b8a8", "a1a2", "a8b8", "a2a1", "b8a8"];
    const res = await playFight(fightStart(w, b).fen, { pick: script(steps), wait: noWait, rng: mulberry32(1) });
    expect(res).toMatchObject({ end: "repetition", winner: null, moves: steps });
    expect(Math.abs(res!.gain!)).toBeLessThan(100);
  });

  it("too far ahead, by the gains: a side that has gained 5 pawns after 6 of its own moves in a row wins at once, unless it has found a quick win", async () => {
    expect([AUTOCHESS.decisiveMargin, AUTOCHESS.decisiveMoves, AUTOCHESS.mateShowMoves]).toEqual([500, 6, 5]);
    // Black, to move, puts its queen where White's rook takes it; then the kings walk. White has gained a queen.
    const fen = "k7/p7/8/3q4/8/7R/4R3/K7 b - - 0 1";
    const plies = ["d5d2", "e2d2", "a8b8", "a1b1", "b8a8", "b1c1", "a8b8", "c1d1", "b8a8", "d1e1", "a8b8", "e1f1", "b8a8", "f1g1"];
    const res = await playFight(fen, { pick: script(plies), wait: noWait, rng: mulberry32(1) });
    // White's sixth move with the gain (the capture was the first): it ends there, before Black answers.
    expect(res).toMatchObject({ end: "decided", winner: "w", moves: plies.slice(0, 12) });
    expect(res!.gain).toBeGreaterThan(500);
    expect(endWords("decided", false, AUTOCHESS, { winner: "w", you: "w" })).toBe("You gained 5+ pawns and held it for 6 moves.");
    expect(endWords("decided", false, AUTOCHESS, { winner: "w", you: "b" })).toBe("Your opponent gained 5+ pawns and held it for 6 moves.");
    // A found mate within 5 moves plays out (a quick mate is fun to watch): no early end while the engine sees it.
    const mateSeen = async (g: FightSoFar) => {
      const m = plies[g.moves.length];
      return m ? { move: m, score: g.moves.length % 2 ? WIN - 9 : 0 } : null;
    };
    const mating = await playFight(fen, { pick: mateSeen, wait: noWait, rng: mulberry32(1), cfg: { ...AUTOCHESS, moveCap: 7 } });
    expect(mating!.end).not.toBe("decided");
    // A side that started 5 pawns up and only kept it doesn't end the fight (Eric, Oct 21): the same walk, the queen gone from the start.
    const start = "k7/p7/8/8/8/7R/3R4/K7 b - - 0 1";
    const kept = await playFight(start, { pick: script(plies.slice(2)), wait: noWait, rng: mulberry32(1), cfg: { ...AUTOCHESS, moveCap: 6 } });
    expect(kept!.end).not.toBe("decided");
    expect(kept!.moves.slice(0, 12)).toEqual(plies.slice(2));
    // The count is a setting.
    const three = await playFight(fen, { pick: script(plies), wait: noWait, rng: mulberry32(1), cfg: { ...AUTOCHESS, decisiveMoves: 3 } });
    expect(three).toMatchObject({ end: "decided", winner: "w" });
    expect(three!.moves).toHaveLength(6);
  });

  it("with the real engine, a bigger army still wins outright, by mate or by taking every piece (those stay absolute)", async () => {
    // A rook more than Black from the start: holding that edge wins no stall, but the engine plays on to take everything.
    const fen = "6k1/5ppp/8/3n4/8/2N5/5PPP/3R2K1 w - - 0 1";
    const engine = new HunchessEngine({ nodes: 6000, cashInValue: AUTOCHESS.cashInValue });
    const pick = async (g: FightSoFar) => {
      const r = engine.best({ ...g, rules: rulesFor() });
      return r.move ? { move: r.move, score: r.score } : null;
    };
    const res = await playFight(fen, { pick, wait: noWait, rng: mulberry32(1) });
    expect(res).toMatchObject({ end: "king_alone", winner: "w" });
  });

  it("a side left with only its king loses at once; both kings alone is a draw; a side that starts the fight so loses (v5)", async () => {
    const idle = { pick: async () => null, wait: noWait, rng: mulberry32(1) };
    // A side that starts with only its king loses: no move is played, whatever the other has (even a lone knight: it used to be "not enough pieces").
    for (const board of [{ a2: "n" }, { a2: "p" }, { d1: "q", a1: "r" }] as Record<string, Kind>[]) {
      const blackLone = fightStart({ color: "w", king: "e1", board }, { color: "b", king: "e8", board: {}, bench: [] });
      expect(await playFight(blackLone.fen, idle)).toMatchObject({ end: "king_alone", winner: "w", moves: [] });
    }
    for (const board of [{ a7: "n" }, { a7: "p" }, { d8: "q", a8: "r" }] as Record<string, Kind>[]) {
      const whiteLone = fightStart({ color: "w", king: "e1", board: {}, bench: [] }, { color: "b", king: "e8", board });
      expect(await playFight(whiteLone.fen, idle)).toMatchObject({ end: "king_alone", winner: "b", moves: [] });
    }
    // Both with only a king: a draw.
    const both = fightStart({ color: "w", king: "e1", board: {}, bench: [] }, { color: "b", king: "e8", board: {}, bench: [] });
    expect(await playFight(both.fen, idle)).toMatchObject({ end: "king_alone", winner: null, moves: [] });
    // Left alone during the fight: White's rook takes Black's last piece, and Black loses at once (one move played, no more).
    const w: Army = { color: "w", king: "e1", board: { a1: "r" }, bench: [] };
    const b: Army = { color: "b", king: "e8", board: { a7: "p" }, bench: [] };
    const res = await playFight(fightStart(w, b).fen, { ...idle, pick: byFen(async (fen) => (legalMoves(fen).includes("a1a7") ? "a1a7" : null)) });
    expect(res).toMatchObject({ end: "king_alone", winner: "w", moves: ["a1a7"] });
    // The king taking the last piece does it too (the king isn't a piece that counts).
    const w2: Army = { color: "w", king: "a6", board: { h2: "p" }, bench: [] };
    const b2: Army = { color: "b", king: "h8", board: { a7: "p" }, bench: [] };
    expect(await playFight(fightStart(w2, b2).fen, { ...idle, pick: async () => "a6a7" })).toMatchObject({ end: "king_alone", winner: "w", moves: ["a6a7"] });
    // It comes before stalemate: a lone king with no move loses all the same.
    const stale = fightStart({ color: "w", king: "c6", board: { b6: "q" }, bench: [] }, { color: "b", king: "a8", board: {}, bench: [] });
    expect(await playFight(stale.fen, idle)).toMatchObject({ end: "king_alone", winner: "w", moves: [] });
    expect(endWords("king_alone", false)).toBe("A side left with only its king loses at once.");
    expect(endWords("king_alone", true)).toBe("Both sides are down to a king: a draw.");
  });

  it("after 30 moves a side, moves play twice as fast (600 ms, then 300 ms): the speed-up is a setting", async () => {
    // (Eric, Oct 21: "for fights, they should take a little bit longer": 350 and 175 ms before.)
    expect([AUTOCHESS.fightMoveMs, AUTOCHESS.fightFastAfter, AUTOCHESS.fightFastMoveMs]).toEqual([600, 30, 300]);
    expect([0, 1, 58, 59, 60, 61, 100].map((plies) => moveMs(plies))).toEqual([600, 600, 600, 600, 300, 300, 300]);
    // A fight played with kings stepping about (it ends by repetition after 8 plies): the waits are 600 until the speed-up, then 300.
    const waits: number[] = [];
    const w: Army = { color: "w", king: "a1", board: { h2: "r" }, bench: [] };
    const b: Army = { color: "b", king: "a8", board: { h7: "n" }, bench: [] };
    const kingSteps = async (fen: string, history: readonly string[]) => {
      const white = fen.split(" ")[1] === "w";
      const k = Math.floor(history.length / 2) % 2;
      return white ? (k ? "a2a1" : "a1a2") : k ? "a7a8" : "a8a7";
    };
    // (fightFastPieces 0: a rook against a knight is thinned out, which has its own test below.)
    const res = await playFight(fightStart(w, b).fen, { pick: byFen(kingSteps), wait: async (ms) => void waits.push(ms), rng: mulberry32(1), cfg: { ...AUTOCHESS, fightFastAfter: 2, fightFastPieces: 0 } });
    expect(res!.moves).toHaveLength(8);
    expect(waits).toEqual([600, 600, 600, 600, 300, 300, 300, 300]);
    // The setting: a fast fight from the start.
    const quick: number[] = [];
    await playFight(fightStart(w, b).fen, { pick: byFen(kingSteps), wait: async (ms) => void quick.push(ms), rng: mulberry32(1), cfg: { ...AUTOCHESS, moveCap: 3, fightFastAfter: 0, fightFastMoveMs: 10 } });
    expect(quick.every((ms) => ms === 10)).toBe(true);
    expect(moveWords(0)).toBe("Move 1 of 60");
    expect(moveWords(59)).toBe("Move 30 of 60");
    expect(moveWords(60)).toBe("Move 31 of 60 · twice as fast");
    // Twice as fast from the start too once a side is down to its king and pawns (Eric, Oct 21): here Black has only a pawn.
    const thin: number[] = [];
    const bp: Army = { color: "b", king: "a8", board: { h7: "p" }, bench: [] };
    const thinRes = await playFight(fightStart(w, bp).fen, { pick: byFen(kingSteps), wait: async (ms) => void thin.push(ms), rng: mulberry32(1) });
    expect(thinRes!.moves).toHaveLength(8);
    expect(thin).toEqual(Array(8).fill(300));
    expect(moveMs(0, AUTOCHESS, true)).toBe(300);
    expect(moveWords(0, AUTOCHESS, true)).toBe("Move 1 of 60 · twice as fast");
  });

  it("twice as fast once 5 or fewer pieces are left besides the kings (Eric, Oct 21: a pawn and a rook against two knights)", async () => {
    expect(AUTOCHESS.fightFastPieces).toBe(5);
    const fen = (w: Army, b: Army) => fightStart(w, b).fen;
    const W = (board: Army["board"]): Army => ({ color: "w", king: "a1", board, bench: [] });
    const B = (board: Army["board"]): Army => ({ color: "b", king: "a8", board, bench: [] });
    // Eric's fight: a pawn and a rook against two knights, 4 pieces: fast.
    expect(thinFight(fen(W({ d4: "p", h2: "r" }), B({ c6: "n", f6: "n" })))).toBe(true);
    // 5: fast; 6: not yet (each side has a piece besides pawns).
    expect(thinFight(fen(W({ d4: "p", h2: "r", c3: "b" }), B({ c6: "n", f6: "n" })))).toBe(true);
    expect(thinFight(fen(W({ d4: "p", h2: "r", c3: "b" }), B({ c6: "n", f6: "n", d6: "p" })))).toBe(false);
    // Down to king and pawns stays fast however many pieces: 8 here.
    expect(thinFight(fen(W({ a2: "p", b2: "p", c2: "p", d2: "p" }), B({ c6: "n", f6: "n", h6: "r", d6: "q" })))).toBe(true);
    // The setting: 3 makes Eric's fight wait.
    expect(thinFight(fen(W({ d4: "p", h2: "r" }), B({ c6: "n", f6: "n" })), { ...AUTOCHESS, fightFastPieces: 3 })).toBe(false);
    // In a fight: the waits are the fast ones from the first move, and the counter says so.
    const waits: number[] = [];
    const w = W({ h2: "r", b3: "p" });
    const b = B({ g6: "n", c6: "n" });
    const steps = async (f: string, history: readonly string[]) => {
      const white = f.split(" ")[1] === "w";
      const k = Math.floor(history.length / 2) % 2;
      return white ? (k ? "a2a1" : "a1a2") : k ? "a7a8" : "a8a7";
    };
    await playFight(fen(w, b), { pick: byFen(steps), wait: async (ms) => void waits.push(ms), rng: mulberry32(1) });
    expect(waits.length).toBeGreaterThan(0);
    expect(waits.every((ms) => ms === AUTOCHESS.fightFastMoveMs)).toBe(true);
  });

  it("each move takes about the move time, with the engine's thinking inside it", async () => {
    const waits: number[] = [];
    const w: Army = { color: "w", king: "e1", board: {}, bench: [] };
    const b: Army = { color: "b", king: "e8", board: {}, bench: [] };
    // Kings only: both sides down to a king, a draw before any move.
    const res = await playFight(fightStart(w, b).fen, { pick: async () => null, wait: async (ms) => void waits.push(ms), rng: mulberry32(1) });
    expect(res).toMatchObject({ end: "king_alone", winner: null, moves: [] });
    expect(waits).toEqual([]);
    const w2: Army = { color: "w", king: "e1", board: { a2: "p", b1: "n" }, bench: [] };
    const b2: Army = { color: "b", king: "e8", board: { h7: "p", g8: "n" }, bench: [] };
    let moves = 0;
    // (fightFastPieces 0: four pieces would play fast, which has its own test.)
    await playFight(fightStart(w2, b2).fen, { pick: async () => null, wait: async (ms) => void waits.push(ms), rng: mulberry32(1), cancelled: () => ++moves > 2, cfg: { ...AUTOCHESS, fightFastPieces: 0 } });
    expect(waits.every((ms) => ms === AUTOCHESS.fightMoveMs)).toBe(true);
    expect(waits.length).toBeGreaterThan(0);
  });
});
