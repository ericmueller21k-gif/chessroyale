import { describe, expect, it } from "vitest";
import { AUTOCHESS, mulberry32 } from "@chessroyale/core";
import { botPlan, type BotEvent } from "../src/autochess/bot.ts";
import { boardChanges, botChanges, botSeen, revealGroup, revealsAt, revealTimes, type BoardChange, type Side } from "../src/autochess/reveal.ts";
import type { Kind } from "../src/autochess/types.ts";

const put = (side: Side, at: number, kind: Kind, square: string): BoardChange => ({ side, at, type: "add", square, kind });
const you = (at: number, kind: Kind, square: string) => put("you", at, kind, square);
const them = (at: number, kind: Kind, square: string) => put("them", at, kind, square);
const sold = (side: Side, at: number, square: string): BoardChange => ({ side, at, type: "remove", square });
/** What is revealed by `t`, in the order it was: "side square @time". */
const shown = (log: BoardChange[], t: number) =>
  revealsAt(log, t)
    .pieces.filter((p) => p.shown !== null)
    .sort((a, b) => a.shown! - b.shown!)
    .map((p) => `${p.side} ${p.square} @${p.shown}`);
const next = (log: BoardChange[], t: number) => revealsAt(log, t).next;
const ev = (at: number, kind: Kind, square: string): BotEvent => ({ at, type: "buy", kind, square, price: 1 });

describe("auto chess: the reveals while you buy (Nov 2: piece for piece by kind, every 3 s)", () => {
  it("ticks every 3 s of the 30 (3 to 27: nine), and the kinds' groups are settings: pawn, knight or bishop, rook, queen", () => {
    expect(AUTOCHESS.revealSeconds).toBe(3);
    expect(revealTimes()).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27]);
    expect(revealTimes({ ...AUTOCHESS, revealSeconds: 5 })).toEqual([5, 10, 15, 20, 25]);
    expect(AUTOCHESS.revealGroups).toEqual([["p"], ["n", "b"], ["r"], ["q"]]);
    expect((["p", "n", "b", "r", "q"] as Kind[]).map((k) => revealGroup(k))).toEqual([0, 1, 1, 2, 3]);
    // The circles are live (no delay since Nov 2).
    expect(AUTOCHESS.circlesDelaySeconds).toBe(0);
  });

  it("a piece with no unrevealed match on the other side stays hidden all step (the more expensive, unmatched ones)", () => {
    const log = [you(1, "q", "d1"), you(2, "p", "e2"), them(1, "r", "a8"), them(2, "n", "b8")];
    expect(shown(log, 29.9)).toEqual([]);
    expect(next(log, 0)).toEqual({ you: null, them: null });
    // A pawn never answers a knight, nor a rook a queen.
    expect(shown([you(1, "n", "b1"), them(1.5, "p", "a7")], 29)).toEqual([]);
    expect(shown([you(1, "q", "d1"), them(1.5, "r", "a8")], 29)).toEqual([]);
  });

  it("placing first pays: within a pair the later-placed piece shows first, the first placer's on the next tick", () => {
    expect(shown([you(1, "p", "e2"), them(2, "p", "e7")], 3)).toEqual(["them e7 @3"]);
    expect(shown([you(1, "p", "e2"), them(2, "p", "e7")], 6)).toEqual(["them e7 @3", "you e2 @6"]);
    // The other way round.
    expect(shown([you(2, "p", "e2"), them(1, "p", "e7")], 6)).toEqual(["you e2 @3", "them e7 @6"]);
    // Before the tick nothing shows.
    expect(shown([you(1, "p", "e2"), them(2, "p", "e7")], 2.99)).toEqual([]);
  });

  it("pawn with pawn, knight or bishop with knight or bishop (either), rook with rook, queen with queen", () => {
    expect(shown([you(1, "n", "b1"), them(2, "b", "c8")], 6)).toEqual(["them c8 @3", "you b1 @6"]);
    expect(shown([you(2, "b", "c1"), them(1, "n", "g8")], 6)).toEqual(["you c1 @3", "them g8 @6"]);
    expect(shown([you(1, "r", "a1"), them(2, "r", "h8"), you(1.5, "q", "d1"), them(2.5, "q", "d8")], 12)).toEqual(["them h8 @3", "you a1 @6", "them d8 @9", "you d1 @12"]);
  });

  it("pairs form in the order pieces were placed: the pair whose later piece came first opens first, then the next", () => {
    // Yours: a pawn at 1 s, a knight at 2 s. Theirs: a knight at 3 s, a pawn at 10 s. The knights' pair formed at 3 s, the pawns' at 10 s.
    const log = [you(1, "p", "a2"), you(2, "n", "b1"), them(3, "n", "g8"), them(10, "p", "h7")];
    expect(shown(log, 29)).toEqual(["them g8 @3", "you b1 @6", "them h7 @12", "you a2 @15"]);
    // Several of a kind pair up first with first, second with second.
    const pawns = [you(1, "p", "a2"), you(2, "p", "b2"), them(1.5, "p", "a7"), them(4, "p", "b7")];
    expect(shown(pawns, 29)).toEqual(["them a7 @3", "you a2 @6", "them b7 @9", "you b2 @12"]);
    // Formed at the same moment: pawns before knights and bishops.
    expect(shown([you(1, "n", "b1"), you(1, "p", "a2"), them(2, "p", "a7"), them(2, "b", "c8")], 12)).toEqual(["them a7 @3", "you a2 @6", "them c8 @9", "you b1 @12"]);
  });

  it("one reveal a tick: the two of a pair on two ticks in a row, one of each side; a tick with nothing to open reveals nothing", () => {
    const log = [you(1, "p", "a2"), them(2, "p", "a7"), them(13, "p", "b7"), you(14, "p", "b2")];
    // 9 and 12: nothing to pair (b7 comes at 13); 15: b2 (placed later), 18: b7.
    expect(shown(log, 29)).toEqual(["them a7 @3", "you a2 @6", "you b2 @15", "them b7 @18"]);
    for (const t of revealTimes()) expect(shown(log, t).length - shown(log, t - 0.01).length).toBeLessThanOrEqual(1);
  });

  it("your next: the piece of yours the coming ticks reveal first (the answer you owe, else yours in the next pair to open); none when no tick is left", () => {
    const log = [you(1, "p", "a2"), you(2, "n", "b1"), them(3, "n", "g8"), them(10, "p", "h7")];
    // Before their knight: nothing of yours has a match.
    expect(next(log, 2.5).you).toBeNull();
    // Their knight is down and shown at 3: your knight answers at 6.
    expect(next(log, 3.2)).toEqual({ you: "b1", them: null });
    expect(next(log, 6.5).you).toBeNull();
    // Their pawn at 10: your pawn is next (theirs shows at 12, yours at 15).
    expect(next(log, 10.5)).toEqual({ you: "a2", them: "h7" });
    expect(next(log, 12.5)).toEqual({ you: "a2", them: null });
    // The earliest-placed one of a kind goes first.
    expect(next([you(1, "p", "a2"), you(2, "p", "b2"), them(2.5, "p", "a7")], 2.6).you).toBe("a2");
    // A pair opened on the last tick (27 s) has no tick left for its answer: the move step shows it.
    const late = [you(20, "r", "a1"), them(26, "r", "h8")];
    expect(shown(late, 29.9)).toEqual(["them h8 @27"]);
    expect(next(late, 26.5).you).toBeNull();
    expect(next(late, 27.5)).toEqual({ you: null, them: null });
  });

  it("a sold piece leaves its pair: the answer goes to the next of that kind, or with none the pair is broken and the tick opens the next one", () => {
    // You owe a pawn (theirs showed at 3), sell it at 4: your other pawn answers at 6.
    expect(shown([you(1, "p", "a2"), you(2, "p", "b2"), them(2.5, "p", "a7"), sold("you", 4, "a2")], 6)).toEqual(["them a7 @3", "you b2 @6"]);
    // No other pawn: no answer; the tick at 6 opens the knights' pair instead (their knight placed later: it shows first).
    expect(shown([you(1, "p", "a2"), you(1, "n", "b1"), them(2, "p", "a7"), them(2.2, "n", "g8"), sold("you", 4, "a2")], 9)).toEqual(["them a7 @3", "them g8 @6", "you b1 @9"]);
    // Sold before its pair opened: the pair forms again from what is left (their a7 now pairs with your b2).
    expect(shown([you(1, "p", "a2"), you(2, "p", "b2"), them(2.5, "p", "a7"), sold("you", 2.8, "a2")], 6)).toEqual(["them a7 @3", "you b2 @6"]);
    // A revealed piece sold is simply gone.
    expect(shown([you(1, "p", "a2"), them(2, "p", "a7"), sold("them", 7, "a7")], 8)).toEqual(["you a2 @6"]);
  });

  it("a moved piece keeps its place in the order, and a revealed one stays revealed where it goes", () => {
    const log: BoardChange[] = [you(1, "p", "a2"), them(2, "p", "a7"), { side: "you", at: 7, type: "move", square: "a2", to: "a3" }];
    expect(shown(log, 8)).toEqual(["them a7 @3", "you a3 @6"]);
    const early: BoardChange[] = [you(1, "p", "a2"), { side: "you", at: 2.5, type: "move", square: "a2", to: "a3" }, them(2, "p", "a7")];
    expect(shown(early, 6)).toEqual(["them a7 @3", "you a3 @6"]);
  });

  it("a kind in no group is never revealed while buying (kings are never hidden: they aren't in the logs)", () => {
    const cfg = { ...AUTOCHESS, revealGroups: [["p"], ["n", "b"], ["r"]] as const };
    expect(revealGroup("q", cfg)).toBe(-1);
    expect(revealsAt([you(1, "q", "d1"), them(2, "q", "d8")], 29, cfg).pieces.every((p) => p.shown === null)).toBe(true);
  });

  it("the same for both sides: swapping the sides swaps what shows", () => {
    const log = [you(1, "p", "a2"), you(2, "n", "b1"), you(5, "r", "a1"), them(3, "n", "g8"), them(4, "r", "h8"), them(10, "p", "h7"), sold("you", 11, "a1")];
    const flip = log.map((c) => ({ ...c, side: c.side === "you" ? "them" : "you" }) as BoardChange);
    const swap = (s: string) => s.replace(/^(you|them)/, (w) => (w === "you" ? "them" : "you"));
    for (const t of [3, 6, 9, 12, 15, 29]) expect(shown(flip, t)).toEqual(shown(log, t).map(swap));
  });

  it("with the bot's real plans, every reveal of theirs is matched by one of yours of the same group (only a last-tick pair waits for the move step)", () => {
    for (let seed = 0; seed < 60; seed++) {
      const p = botPlan("b", "e8", 30, 4, mulberry32(seed));
      // You mirror its pieces a little earlier or later (seeded).
      const rng = mulberry32(seed + 1000);
      const mine = botChanges(p.events).map((c) => ({ ...c, side: "you" as const, at: Math.max(0.1, c.at + (rng() - 0.5) * 4), square: `${c.square[0]}${9 - Number(c.square[1])}` }));
      const pieces = revealsAt([...mine, ...botChanges(p.events)], 29.9).pieces.filter((x) => x.shown !== null);
      expect(pieces.length).toBeGreaterThan(0);
      for (let g = 0; g < AUTOCHESS.revealGroups.length; g++) {
        const n = (side: Side) => pieces.filter((x) => x.side === side && revealGroup(x.kind) === g).length;
        expect(Math.abs(n("you") - n("them"))).toBeLessThanOrEqual(1);
      }
      expect(pieces.length).toBeLessThanOrEqual(revealTimes().length);
    }
  });

  it("logs a board's changes (what left, then what came) and the bot's from its plan (pieces bought onto the board or placed)", () => {
    expect(boardChanges("you", { a2: "p", b1: "n" }, { b1: "n", c2: "p" }, 4)).toEqual([
      { side: "you", at: 4, type: "remove", square: "a2" },
      { side: "you", at: 4, type: "add", square: "c2", kind: "p" },
    ]);
    const events: BotEvent[] = [ev(1, "p", "a6"), { at: 2, type: "hold", kind: "n", square: "c6", price: 3 }, { at: 3, type: "xp", kind: "xp", square: null, price: 4 }, { at: 4, type: "place", kind: "n", square: "c6", price: 0 }];
    expect(botChanges(events)).toEqual([them(1, "p", "a6"), them(4, "n", "c6")]);
  });

  it("what shows: their circles live (pawns too), the revealed ones as pieces with their stars, spent and XP live; your unseen pieces and your next", () => {
    const events: BotEvent[] = [ev(1, "p", "a6"), { ...ev(2, "n", "c6"), stars: 2 }, { at: 2.5, type: "xp", kind: "xp", square: null, price: 4 }, ev(4, "p", "b6")];
    const mine = [you(0.5, "p", "a2"), you(1.5, "b", "c1"), you(2, "q", "d1")];
    expect(botSeen(events, [], 0)).toEqual({ circles: [], revealed: [], spent: 0, xpBuys: 0, unseen: [], next: null });
    // 1.2 s: their pawn is a circle at once; your pawn is unseen and next (their pawn came later: it shows first, at 3 s; yours at 6 s).
    expect(botSeen(events, mine, 1.2)).toEqual({ circles: ["a6"], revealed: [], spent: 1, xpBuys: 0, unseen: ["a2"], next: "a2" });
    const at3 = botSeen(events, mine, 3);
    expect(at3.revealed).toEqual([{ square: "a6", kind: "p", at: 3 }]);
    expect(at3.circles).toEqual(["c6"]);
    expect(at3).toMatchObject({ spent: 1 + 1 + 4, xpBuys: 1, unseen: ["a2", "c1", "d1"], next: "a2" });
    // 6 s: your pawn answers; 9 s: their 2-star knight (placed after your bishop) shows with its stars; 12 s: your bishop. The queen has no match.
    expect(botSeen(events, mine, 6)).toMatchObject({ unseen: ["c1", "d1"], next: "c1" });
    const at12 = botSeen(events, mine, 12);
    expect(at12.revealed).toEqual([
      { square: "a6", kind: "p", at: 3 },
      { square: "c6", kind: "n", at: 9, stars: 2 },
    ]);
    expect(at12).toMatchObject({ circles: ["b6"], unseen: ["d1"], next: null });
  });
});
