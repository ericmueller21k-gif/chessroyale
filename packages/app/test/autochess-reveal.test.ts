import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { botAt, botPlan, type BotEvent } from "../src/autochess/bot.ts";
import { botSeen, revealedAt, revealTimes } from "../src/autochess/reveal.ts";

/** A plan for a bot with a few pieces, for a seed. */
const plan = (seed: number, round = 3) => botPlan("b", "e8", 200, round, mulberry32(seed));
const ev = (at: number, kind: "p" | "n" | "q", square: string): BotEvent => ({ at, type: "buy", kind, square, price: 10 });

describe("auto chess: what you see of their board while you buy (v6)", () => {
  it("reveals one piece every 5 s of the 30: 5, 10, 15, 20 and 25 (five in all), a setting", () => {
    expect(AUTOCHESS.revealSeconds).toBe(5);
    expect(revealTimes()).toEqual([5, 10, 15, 20, 25]);
    expect(revealTimes({ ...AUTOCHESS, revealSeconds: 10 })).toEqual([10, 20]);
    expect(revealTimes({ ...AUTOCHESS, revealSeconds: 7 })).toEqual([7, 14, 21, 28]);
  });

  it("shows nothing revealed before the first time, then one more at each time, never two at once", () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = plan(seed, 6);
      // (A plan that has a piece down 2 s before 5 s, as the circles are 2 s behind: most have.)
      const counts = [0, 4.9, 5, 9.9, 10, 14.9, 15, 20, 25, 29.9].map((t) => revealedAt(p.events, seed, t).length);
      expect(counts[0]).toBe(0);
      expect(counts[1]).toBe(0);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
        expect(counts[i]! - counts[i - 1]!).toBeLessThanOrEqual(i === 2 || i === 4 || i === 6 || i === 7 || i === 8 ? 1 : 0);
      }
      expect(revealedAt(p.events, seed, 99).length).toBeLessThanOrEqual(5);
    }
  });

  it("reveals a piece on their board by then (even one whose circle isn't shown yet, 2 s behind), as the piece it is, and it stays shown", () => {
    const events = [ev(1, "p", "a6"), ev(2, "n", "c6"), ev(3.5, "q", "d7"), ev(8, "p", "b6"), ev(30, "n", "h6")];
    for (let seed = 0; seed < 200; seed++) {
      const at5 = revealedAt(events, seed, 5);
      // At 5 s the pieces on their board are a6, c6 and the queen (3.5 s): one of them.
      expect(at5).toHaveLength(1);
      expect(["a6", "c6", "d7"]).toContain(at5[0]!.square);
      expect(at5[0]!.kind).toBe({ a6: "p", c6: "n", d7: "q" }[at5[0]!.square]);
      expect(at5[0]!.at).toBe(5);
      // Later: it stays, and the next is another piece.
      const at10 = revealedAt(events, seed, 10);
      expect(at10[0]).toEqual(at5[0]);
      expect(at10).toHaveLength(2);
      expect(at10[1]!.square).not.toBe(at10[0]!.square);
      expect(botAt(events, 10).squares[at10[1]!.square]).toBe(at10[1]!.kind);
      // Over the whole step every piece the bot put down by then is a candidate: five reveal times, four pieces down by 25 s (the fifth is at 30 s).
      expect(revealedAt(events, seed, 29).length).toBe(4);
    }
  });

  it("picks at random (seeded): every piece gets picked over many seeds, and a seed gives the same reveals every time", () => {
    const events = [ev(0.5, "p", "a6"), ev(0.6, "p", "b6"), ev(0.7, "p", "c6"), ev(0.8, "n", "d6")];
    const first = new Map<string, number>();
    for (let seed = 0; seed < 400; seed++) {
      const r = revealedAt(events, seed, 5);
      first.set(r[0]!.square, (first.get(r[0]!.square) ?? 0) + 1);
      expect(revealedAt(events, seed, 5)).toEqual(r);
    }
    expect([...first.keys()].sort()).toEqual(["a6", "b6", "c6", "d6"]);
    for (const n of first.values()) expect(n).toBeGreaterThan(50);
    // A pawn is as likely as a piece: pawns are circles too, and decoys.
    expect((first.get("a6")! + first.get("b6")! + first.get("c6")!) / 400).toBeGreaterThan(0.6);
  });

  it("with nothing to pick nothing is revealed (a bot with no piece down yet), and the next time tries again", () => {
    expect(revealedAt([], 3, 29)).toEqual([]);
    const late = [ev(12, "q", "d7")];
    // The queen is down at 12 s: the reveals at 5 and 10 find nothing, 15 finds it, 20 and 25 have nothing left.
    expect(revealedAt(late, 1, 10)).toEqual([]);
    expect(revealedAt(late, 1, 15)).toEqual([{ square: "d7", kind: "q", at: 15 }]);
    expect(revealedAt(late, 1, 29)).toHaveLength(1);
  });

  it("what shows: circles for everything not revealed (pawns too), the revealed ones as pieces, spent and XP bought 2 s behind", () => {
    const events: BotEvent[] = [ev(1, "p", "a6"), ev(2, "n", "c6"), { at: 3, type: "xp", kind: "xp", square: null, price: 20 }, ev(4, "p", "b6")];
    expect(botSeen(events, 7, 0)).toEqual({ circles: [], revealed: [], spent: 0, xpBuys: 0 });
    // 3.5 s: what was done by 1.5 s: the pawn on a6, a circle (a pawn is a circle too).
    expect(botSeen(events, 7, 3.5)).toEqual({ circles: ["a6"], revealed: [], spent: 10, xpBuys: 0 });
    // 5 s: by 3 s the pawn, the knight and the XP: spent 10 + 10 + 20 (the events' prices), one XP; one of the pieces on their board
    // (a6, c6 and b6 is down at 4 s: three) is revealed, and the others show as circles (b6 not yet: it is 2 s behind).
    const at5 = botSeen(events, 7, 5);
    expect(at5.spent).toBe(40);
    expect(at5.xpBuys).toBe(1);
    expect(at5.revealed).toHaveLength(1);
    expect(["a6", "c6", "b6"]).toContain(at5.revealed[0]!.square);
    expect(at5.circles.every((sq) => ["a6", "c6"].includes(sq))).toBe(true);
    expect(at5.circles).toHaveLength(at5.revealed[0]!.square === "b6" ? 2 : 1);
    // Later every piece is on the board, as a circle or revealed, never both.
    const at9 = botSeen(events, 7, 9);
    expect([...at9.circles, ...at9.revealed.map((r) => r.square)].sort()).toEqual(["a6", "b6", "c6"]);
  });
});
