import { describe, expect, it } from "vitest";
import { RANKED_1V1 } from "@chessroyale/core";
import {
  canAbort,
  canMate,
  canOfferDraw,
  clockLeft,
  declineDraw,
  firstMoveBy,
  move,
  newDuel,
  nextDeadline,
  offerDraw,
  pick,
  resign,
  scoreOf,
  tick,
  type Color,
  type DuelState,
} from "../src/duel/index.ts";

const VOTE = RANKED_1V1.voteSeconds * 1000;
const OVERLAY = RANKED_1V1.overlayMs;
const FIRST = RANKED_1V1.firstMoveSeconds * 1000;

/** A game in play at `t` (the vote closed with these picks), its clocks as voted. */
function playing(w: "bullet" | "blitz" | "rapid" | null = "blitz", b: "bullet" | "blitz" | "rapid" | null = "blitz", testSeconds?: number): { s: DuelState; t: number } {
  let s = newDuel(0, { testSeconds });
  if (w) s = pick(s, "w", w, 100).state;
  if (b) s = pick(s, "b", b, 200).state;
  const t = VOTE + OVERLAY;
  s = tick(s, t);
  expect(s.phase).toBe("play");
  return { s, t };
}

/** Plays moves in turn, `gap` ms apart (each must be legal). */
function play(s: DuelState, t: number, moves: string[], gap = 1000): { s: DuelState; t: number } {
  for (const m of moves) {
    t += gap;
    const c: Color = s.moves.length % 2 === 0 ? "w" : "b";
    const r = move(s, c, m, t);
    expect(r.ok, `${m} at ply ${s.moves.length}: ${r.ok ? "" : r.reason}`).toBe(true);
    s = r.state;
  }
  return { s, t };
}

describe("1 v 1: the vote and the start", () => {
  it("the vote: picks change until time's up, then the voted control's clocks, the overlay, then play", () => {
    let s = newDuel(1000);
    expect(s.phase).toBe("vote");
    expect(nextDeadline(s)).toBe(1000 + VOTE);
    s = pick(s, "w", "bullet", 2000).state;
    s = pick(s, "w", "rapid", 3000).state;
    s = pick(s, "b", "blitz", 4000).state;
    expect(pick(s, "b", "nonsense", 4100).ok).toBe(false);
    s = tick(s, 1000 + VOTE);
    expect(s.phase).toBe("overlay");
    expect(s.control).toBe("blitz-rapid");
    expect(s.clocks).toEqual({ w: 300_000, b: 300_000 });
    expect(pick(s, "w", "bullet", 1000 + VOTE + 10).ok).toBe(false);
    expect(nextDeadline(s)).toBe(1000 + VOTE + OVERLAY);
    s = tick(s, 1000 + VOTE + OVERLAY);
    expect(s.phase).toBe("play");
    expect(s.turnAt).toBe(1000 + VOTE + OVERLAY);
  });

  it("nobody picks: Blitz 3+2; one pick: it counts", () => {
    expect(tick(newDuel(0), VOTE).control).toBe("blitz");
    expect(tick(pick(newDuel(0), "b", "bullet", 10).state, VOTE).control).toBe("bullet");
  });

  it("no move before play", () => {
    const s = newDuel(0);
    expect(move(s, "w", "e2e4", 100)).toMatchObject({ ok: false, reason: "phase" });
    expect(move(tick(s, VOTE), "w", "e2e4", VOTE + 10)).toMatchObject({ ok: false, reason: "phase" });
  });
});

describe("1 v 1: first moves and the clocks", () => {
  it("first moves are untimed; the clocks start after Black's; the increment after each timed move", () => {
    let { s, t } = playing("blitz", "blitz");
    expect(firstMoveBy(s)).toBe(t + FIRST);
    ({ s, t } = play(s, t, ["e2e4"], 15_000));
    expect(s.clocks).toEqual({ w: 180_000, b: 180_000 });
    expect(firstMoveBy(s)).toBe(t + FIRST);
    ({ s, t } = play(s, t, ["e7e5"], 19_000));
    expect(s.clocks).toEqual({ w: 180_000, b: 180_000 });
    expect(firstMoveBy(s)).toBeNull();
    // White thinks 10 s: 10 s off, 2 s back.
    expect(clockLeft(s, "w", t + 4000)).toBe(176_000);
    expect(clockLeft(s, "b", t + 4000)).toBe(180_000);
    ({ s, t } = play(s, t, ["g1f3"], 10_000));
    expect(s.clocks).toEqual({ w: 172_000, b: 180_000 });
    expect(s.times).toEqual([15_000, 19_000, 10_000]);
  });

  it("a first move that doesn't come aborts: White's from the start, Black's from White's", () => {
    let { s, t } = playing();
    expect(nextDeadline(s)).toBe(t + FIRST);
    const late = tick(s, t + FIRST);
    expect(late.end).toEqual({ result: "aborted", reason: "no_first_move", by: "w", at: t + FIRST });
    expect(scoreOf(late, "w")).toBeNull();
    ({ s, t } = play(s, t, ["d2d4"], 5000));
    const blackLate = tick(s, t + FIRST + 1);
    expect(blackLate.end).toMatchObject({ result: "aborted", reason: "no_first_move", by: "b", at: t + FIRST });
    // A move after the deadline isn't played.
    expect(move(s, "b", "d7d5", t + FIRST + 5)).toMatchObject({ ok: false, reason: "over" });
  });

  it("flagging loses: the moment the clock reaches zero, and a move after it isn't played", () => {
    let { s, t } = playing("bullet", "bullet");
    ({ s, t } = play(s, t, ["e2e4", "e7e5"]));
    expect(nextDeadline(s)).toBe(t + 60_000);
    const flagged = move(s, "w", "g1f3", t + 60_001);
    expect(flagged).toMatchObject({ ok: false, reason: "over" });
    expect(flagged.state.end).toEqual({ result: "0-1", reason: "timeout", by: "w", at: t + 60_000 });
    expect(flagged.state.clocks.w).toBe(0);
    // Just in time is in time.
    expect(move(s, "w", "g1f3", t + 59_999).ok).toBe(true);
  });

  it("a flag is a draw when the side on time can't mate: a lone king, or a king with one knight or one bishop", () => {
    expect(canMate("8/8/8/8/8/8/8/K1k5 w - - 0 1", "b")).toBe(false);
    expect(canMate("8/8/8/8/8/8/n7/K1k5 w - - 0 1", "b")).toBe(false);
    expect(canMate("8/8/8/8/8/8/b7/K1k5 w - - 0 1", "b")).toBe(false);
    expect(canMate("8/8/8/8/8/8/bb6/K1k5 w - - 0 1", "b")).toBe(true);
    expect(canMate("8/8/8/8/8/8/p7/K1k5 w - - 0 1", "b")).toBe(true);
    expect(canMate("8/8/8/8/8/8/nn6/K1k5 w - - 0 1", "b")).toBe(true);
    expect(canMate("8/8/8/8/8/8/r7/K1k5 w - - 0 1", "b")).toBe(true);
    // A queen up, flagging against a lone king: a draw.
    let { s, t } = playing("bullet", "bullet");
    ({ s, t } = play(s, t, ["e2e4", "e7e5"]));
    s = { ...s, fen: "7k/8/8/8/8/8/8/QK6 w - - 0 1" };
    const end = tick(s, t + 60_000).end;
    expect(end).toMatchObject({ result: "1/2-1/2", reason: "timeout_vs_insufficient", by: "w" });
    // And against a king with a pawn left: a loss.
    s = { ...s, fen: "7k/7p/8/8/8/8/8/QK6 w - - 0 1" };
    expect(tick(s, t + 60_000).end).toMatchObject({ result: "0-1", reason: "timeout" });
  });

  it("a test's clock: its seconds for each side, no increment", () => {
    let { s, t } = playing("rapid", "rapid", 5);
    expect(s.clocks).toEqual({ w: 5000, b: 5000 });
    ({ s, t } = play(s, t, ["e2e4", "e7e5", "g1f3"]));
    expect(s.clocks.w).toBe(4000);
  });
});

describe("1 v 1: moves and endings", () => {
  it("only the side to move, only legal moves, promotions naming their piece", () => {
    const { s, t } = playing();
    expect(move(s, "b", "e7e5", t + 1)).toMatchObject({ ok: false, reason: "turn" });
    expect(move(s, "w", "e2e5", t + 1)).toMatchObject({ ok: false, reason: "illegal" });
    expect(move(s, "w", "e2e4q", t + 1)).toMatchObject({ ok: false, reason: "illegal" });
    expect(move(s, "w", 42, t + 1)).toMatchObject({ ok: false, reason: "illegal" });
    const promo = { ...s, fen: "8/P6k/8/8/8/8/8/K7 w - - 0 1" };
    expect(move(promo, "w", "a7a8", t + 1)).toMatchObject({ ok: false, reason: "illegal" });
    const r = move(promo, "w", "a7a8n", t + 1);
    expect(r.ok).toBe(true);
    expect(r.san).toBe("a8=N");
  });

  it("checkmate wins (the fool's mate)", () => {
    const { s } = play(...Object.values(playing()) as [DuelState, number], ["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(s.end).toMatchObject({ result: "0-1", reason: "checkmate", by: "w" });
    expect(s.sans.at(-1)).toBe("Qh4#");
    expect(scoreOf(s, "b")).toBe(1);
    expect(scoreOf(s, "w")).toBe(0);
  });

  it("threefold repetition draws by itself", () => {
    const { s } = play(...Object.values(playing()) as [DuelState, number], ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
    expect(s.end).toMatchObject({ result: "1/2-1/2", reason: "repetition" });
    expect(s.moves).toHaveLength(8);
  });

  it("stalemate, not enough material and the 50-move rule draw", () => {
    const base = playing().s;
    const s = { ...base, moves: ["e2e4", "e7e5"], turnAt: base.turnAt, clocks: { w: 60_000, b: 60_000 } };
    expect(move({ ...s, fen: "7k/5Q2/8/6K1/8/8/8/8 w - - 0 1" }, "w", "g5g6", base.turnAt + 1).state.end).toMatchObject({ reason: "stalemate" });
    // A rook against a knight goes on; the bishop taking the knight leaves too little to mate.
    expect(move({ ...s, fen: "7k/8/8/8/8/8/8/K5nR w - - 0 1" }, "w", "a1a2", base.turnAt + 1).state.end).toBeNull();
    expect(move({ ...s, fen: "7k/8/8/8/8/8/6n1/K4B2 w - - 0 1" }, "w", "f1g2", base.turnAt + 1).state.end).toMatchObject({ reason: "insufficient_material" });
    expect(move({ ...s, fen: "7k/8/8/8/8/8/8/K5R1 w - - 99 80" }, "w", "g1g2", base.turnAt + 1).state.end).toMatchObject({ reason: "fifty_moves" });
    // Mate on the hundredth half-move still wins.
    expect(move({ ...s, fen: "7k/8/6K1/8/8/8/8/R7 w - - 99 80" }, "w", "a1a8", base.turnAt + 1).state.end).toMatchObject({ reason: "checkmate", result: "1-0" });
  });
});

describe("1 v 1: resigning, aborting and draws", () => {
  it("before both first moves it's an abort (no result); after, resigning loses", () => {
    expect(canAbort(newDuel(0))).toBe(true);
    expect(resign(newDuel(0), "b", 100).state.end).toMatchObject({ result: "aborted", reason: "abort", by: "b" });
    let { s, t } = playing();
    ({ s, t } = play(s, t, ["e2e4"]));
    expect(canAbort(s)).toBe(true);
    expect(resign(s, "w", t).state.end).toMatchObject({ result: "aborted", reason: "abort", by: "w" });
    ({ s, t } = play(s, t, ["c7c5"]));
    expect(canAbort(s)).toBe(false);
    const r = resign(s, "b", t + 5);
    expect(r.state.end).toMatchObject({ result: "1-0", reason: "resign", by: "b", at: t + 5 });
    expect(resign(r.state, "w", t + 6)).toMatchObject({ ok: false, reason: "over" });
  });

  it("a draw offer: accepted is a draw; declined, its maker waits three moves; the receiver moving lets it lapse", () => {
    let { s, t } = playing();
    expect(canOfferDraw(s, "w")).toBe(false);
    ({ s, t } = play(s, t, ["e2e4", "e7e5"]));
    expect(canOfferDraw(s, "w")).toBe(true);
    s = offerDraw(s, "w", t).state;
    expect(s.drawOffer).toBe("w");
    expect(offerDraw(s, "w", t).ok).toBe(false);
    // Accepting: a draw by agreement.
    expect(offerDraw(s, "b", t + 1).state.end).toMatchObject({ result: "1/2-1/2", reason: "agreement" });
    // Declined: White offers again only after 3 more moves of its own.
    s = declineDraw(s, "b", t + 1).state;
    expect(s.drawOffer).toBeNull();
    expect(canOfferDraw(s, "w")).toBe(false);
    expect(canOfferDraw(s, "b")).toBe(true);
    ({ s, t } = play(s, t, ["g1f3", "b8c6", "f1c4", "g8f6"]));
    expect(canOfferDraw(s, "w")).toBe(false);
    ({ s, t } = play(s, t, ["d2d3", "f8c5"]));
    expect(canOfferDraw(s, "w")).toBe(true);
    // Offered, then White moves: it stands; Black moves: it lapses.
    s = offerDraw(s, "w", t).state;
    ({ s, t } = play(s, t, ["e1g1"]));
    expect(s.drawOffer).toBe("w");
    ({ s, t } = play(s, t, ["e8g8"]));
    expect(s.drawOffer).toBeNull();
    expect(canOfferDraw(s, "w")).toBe(false);
  });
});
