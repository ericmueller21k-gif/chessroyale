import { beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import { START_FEN } from "@chessroyale/chess";
import { halfDuties, squadsLegalMoves, type SquadsEvent } from "@chessroyale/chess/squads";
import { clearTopCache, parseTestFen, testLobbyOptions, type LiveMatch } from "../src/squads-lobby.ts";
import { squadsLobby } from "./squads-fixture.ts";

/**
 * Squads v2 on the server (Eric, Oct 12): Pairs' same-move tokens and the judge's refund on players' devices, move
 * blocks in every round (placed, seen by everyone, paid, in effect, refused), the final's majority vote, and what each
 * side sees.
 */

/** The votes before the bracket: a test lobby whose mode is set holds Start and Clock only (no Mode vote). */
const VOTES_MS = FRONT_DOOR.fillShowMs + 2 * (SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000;
/** The bracket's intro: a Mercenary test lobby that skips rounds has a longer one, to shop in. */
const introMs = (start: number, mode: "classic" | "mercenary") => (start > 0 && mode === "mercenary" ? Math.max(SQUADS_LOBBY.bracketIntroSeconds, SQUADS_LOBBY.testShopSeconds) : SQUADS_LOBBY.bracketIntroSeconds) * 1000;
const mineIn = (lm: LiveMatch, id: string) => lm.m.sides.some((x) => x.seats.includes(id));
const ofKind = <K extends SquadsEvent["kind"]>(events: readonly SquadsEvent[], kind: K) => events.filter((e): e is Extract<SquadsEvent, { kind: K }> => e.kind === kind);

beforeEach(() => clearTopCache());

/**
 * A test lobby at `start` with a party of 4 people in one squad, a solo person, and devices if asked; at its first half.
 * Classic (same-move tokens, no blocks) unless `mode` says Mercenary (blocks).
 */
function partyLobby(start: 0 | 1, opts: { devices?: boolean; seed?: number; fen?: string; mode?: "classic" | "mercenary" } = {}) {
  const mode = opts.mode ?? "classic";
  const L = squadsLobby({ seed: opts.seed ?? 7, test: { start, mode, ...(opts.fen ? { fen: opts.fen } : {}) }, fillInMs: 5_000 });
  L.core.reserve([{ size: 4, pass: "four" }], 60_000);
  const party = ["A", "B", "C", "D"].map((n) => L.join(n, { party: "four" }));
  const solo = L.join("Sol");
  if (opts.devices) party.forEach((id, i) => L.core.message(id, { t: "speed", nps: 1_000_000 + i }));
  L.advance(5_000 + VOTES_MS + introMs(start, mode));
  const lm = L.core.allMatches().find((m) => mineIn(m, party[0]!))!;
  return { L, party, solo, lm };
}

describe("squads v2 server: same-move tokens and the judge", () => {
  /** The party's pair this half picks the same move (the first legal one), both locked; then the half is played. */
  function sameMove(devices: boolean) {
    const { L, party, solo, lm } = partyLobby(1, { devices });
    expect(lm.m.format).toBe("pairs");
    const duty = halfDuties(lm.m).duties.find((d) => party.includes(d.players[0]!))!;
    const move = squadsLegalMoves(lm.m.boards[duty.board]!.fen)[0]!;
    for (const p of duty.players) {
      L.core.message(p, { t: "choose", key: lm.key, seq: lm.half!.seq, move });
      L.core.message(p, { t: "lock", key: lm.key, seq: lm.half!.seq });
    }
    // Both on the same move: allowed while the squad has a token.
    expect(duty.players.map((p) => L.last(p, "choiceNo"))).toEqual([undefined, undefined]);
    L.runUntil(() => lm.state === "show", 60_000, "the half played");
    const half = L.all(solo, "half").find((h) => h.key === lm.key)!;
    return { L, party, solo, lm, duty, move, half };
  }

  it("the same move plays without a coin and burns a token; everyone sees it, and each squad's tokens", () => {
    const { lm, duty, move, half, party } = sameMove(false);
    const e = ofKind(half.events, "pair").find((x) => x.board === duty.board)!;
    expect(e).toMatchObject({ same: true, coin: null, token: 0, move, players: duty.players });
    const side = duty.side;
    const tokens = [SQUADS.tokens.perMatch, SQUADS.tokens.perMatch];
    tokens[side] = SQUADS.tokens.perMatch - 1;
    expect(half.match.tokens).toEqual(tokens);
    expect(half.match.tokenLog).toMatchObject([{ side, move, board: duty.board, verdict: null }]);
    expect(lm.judge?.[0]).toBeDefined();
    void party;
  });

  it("the judge (players' devices) finds an only move: the token comes back a few seconds later, with the numbers", () => {
    const { L, party, solo, lm, move, duty } = sameMove(true);
    const id = `${lm.key}/t/0`;
    // Devices are asked the position it was played in (the party's own here: the only devices; the squad's own last).
    const asked = party.filter((p) => L.all(p, "botWork").some((w) => w.jobs.some((j) => j.id === id)));
    expect(asked.length).toBe(SQUADS_LOBBY.botWork.perJob);
    const job = L.all(asked[0]!, "botWork").flatMap((w) => w.jobs).find((j) => j.id === id)!;
    expect(job).toMatchObject({ fen: START_FEN, n: SQUADS.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes });
    const other = squadsLegalMoves(START_FEN).find((m) => m !== move)!;
    const top = [
      { move, expected: 0.8 },
      { move: other, expected: 0.3 },
    ];
    for (const d of asked) L.core.message(d, { t: "botTop", id, top });
    // Settled, but shown only after the reveal.
    expect(L.last(solo, "token")).toBeUndefined();
    L.advance(SQUADS.pairRevealSeconds * 1000 + 50);
    const t = L.last(solo, "token")!;
    expect(t).toMatchObject({ key: lm.key, index: 0, use: { move, verdict: { refunded: true, why: "only_move", rival: other, pawns: 2.7 } } });
    expect(t.tokens![duty.side]).toBe(SQUADS.tokens.perMatch);
    expect(lm.m.tokens![duty.side]).toBe(SQUADS.tokens.perMatch);
    expect(lm.judge).toBeUndefined();
    // Everyone hears: both squads and spectators.
    for (const p of party) expect(L.last(p, "token")).toBeDefined();
  });

  it("another move as good: no refund, and the breakdown says how close", () => {
    const { L, party, lm, move, duty } = sameMove(true);
    const id = `${lm.key}/t/0`;
    const other = squadsLegalMoves(START_FEN).find((m) => m !== move)!;
    for (const d of party) L.core.message(d, { t: "botTop", id, top: [{ move, expected: 0.55 }, { move: other, expected: 0.5 }] });
    L.advance(SQUADS.pairRevealSeconds * 1000 + 50);
    expect(L.last(party[0]!, "token")!.use.verdict).toEqual({ refunded: false, why: "close", rival: other, pawns: 0.3 });
    expect(lm.m.tokens![duty.side]).toBe(SQUADS.tokens.perMatch - 1);
  });

  it("no device to judge it: no refund, and the breakdown says the judge wasn't there", () => {
    const { L, solo, lm, duty } = sameMove(false);
    L.advance(SQUADS.pairRevealSeconds * 1000 + 50);
    expect(L.last(solo, "token")!.use.verdict).toEqual({ refunded: false, why: "no_judge" });
    expect(lm.m.tokens![duty.side]).toBe(SQUADS.tokens.perMatch - 1);
  });

  it("at 0 tokens the partner's move is refused (no_tokens)", () => {
    const { L, party, lm } = partyLobby(1);
    const duty = halfDuties(lm.m).duties.find((d) => party.includes(d.players[0]!))!;
    lm.m = { ...lm.m, tokens: duty.side === 0 ? [0, 5] : [5, 0] };
    const move = squadsLegalMoves(lm.m.boards[duty.board]!.fen)[0]!;
    L.core.message(duty.players[0]!, { t: "choose", key: lm.key, seq: lm.half!.seq, move });
    L.core.message(duty.players[1]!, { t: "choose", key: lm.key, seq: lm.half!.seq, move });
    expect(L.last(duty.players[1]!, "choiceNo")).toMatchObject({ reason: "no_tokens" });
  });
});

describe("squads v2 server: move blocks", () => {
  it("a mover blocks moves before moving: everyone sees each at once with the squad's bank; refused when it can't be", () => {
    const { L, party, solo, lm } = partyLobby(0, { mode: "mercenary" });
    expect(lm.m.format).toBe("relay");
    const side = lm.m.sides.findIndex((x) => x.seats.includes(party[0]!));
    const duty = halfDuties(lm.m).duties.find((d) => d.side === side)!;
    const mover = duty.players[0]!;
    const seq = lm.half!.seq;
    expect(lm.m.boards[duty.board]!.fen).toBe(START_FEN);
    L.clear();
    L.core.message(mover, { t: "block", key: lm.key, seq, board: duty.board, move: "g8f6" });
    const seen = L.last(solo, "block")!;
    expect(seen).toMatchObject({ key: lm.key, seq, bank: SQUADS.blocks.bankPerMatch - 2, block: { board: duty.board, side, by: mover, move: "g8f6", piece: "n", cost: 2 } });
    for (const p of party) expect(L.last(p, "block")).toEqual(seen);
    // The same move again: refused. Others, as many as the bank allows.
    L.core.message(mover, { t: "block", key: lm.key, seq, board: duty.board, move: "g8f6" });
    expect(L.last(mover, "blockNo")).toMatchObject({ reason: "block_taken" });
    L.core.message(mover, { t: "block", key: lm.key, seq, board: duty.board, move: "b8c6" });
    L.core.message(mover, { t: "block", key: lm.key, seq, board: duty.board, move: "e7e5" });
    expect(L.last(solo, "block")!.bank).toBe(0);
    L.core.message(mover, { t: "block", key: lm.key, seq, board: duty.board, move: "d7d5" });
    expect(L.last(mover, "blockNo")).toMatchObject({ reason: "bank" });
    // Not the king; not someone without a duty there; nothing after the move.
    const idle = party.find((p) => !halfDuties(lm.m).duties.some((d) => d.players.includes(p)))!;
    L.core.message(idle, { t: "block", key: lm.key, seq, board: duty.board, move: "d7d5" });
    expect(L.last(idle, "blockNo")).toMatchObject({ reason: "no_duty" });
    // A spectator's resend has the blocks placed this half.
    L.core.message(solo, { t: "sync" });
    expect(L.all(solo, "match").find((m) => m.match.key === lm.key)!.placed.map((b) => b.move)).toEqual(["g8f6", "b8c6", "e7e5"]);
    L.core.message(mover, { t: "choose", key: lm.key, seq, move: "e2e4" });
    L.core.message(mover, { t: "block", key: lm.key, seq, board: duty.board, move: "d7d5" });
    expect(L.last(mover, "blockNo")).toMatchObject({ reason: "already_moved" });
    // The half: the blocks take effect; on their next turn there, none of those moves is played.
    L.runUntil(() => lm.state === "show", 60_000, "the half played");
    const half = L.all(solo, "half").find((h) => h.key === lm.key && h.seq === seq)!;
    expect(ofKind(half.events, "block").map((e) => [e.move, e.outcome])).toEqual([
      ["g8f6", "on"],
      ["b8c6", "on"],
      ["e7e5", "on"],
    ]);
    expect(half.match.blocks.map((b) => b.move)).toEqual(["g8f6", "b8c6", "e7e5"]);
    expect(half.match.blockBanks[side]).toBe(0);
    L.runUntil(() => lm.m.half === "w" && lm.state === "show", 120_000, "their half played");
    const next = L.all(solo, "half").find((h) => h.key === lm.key && h.seq === seq + 1)!;
    const reply = ofKind(next.events, "relay").find((e) => e.board === duty.board)!;
    expect(["g8f6", "b8c6", "e7e5"]).not.toContain(reply.move);
    // Gone after their turn.
    expect(next.match.blocks).toEqual([]);
  }, 60_000);

  it("a block the mover's own move makes impossible is lifted and refunded; a king's move or a non-move is refused", () => {
    // After 1.d4 Nf6 2.Bg5: White's bishop can take the knight.
    const { L, party, solo, lm } = partyLobby(0, { mode: "mercenary", fen: "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3" });
    const side = lm.m.sides.findIndex((x) => x.seats.includes(party[0]!));
    const duty = halfDuties(lm.m).duties.find((d) => d.side === side)!;
    const mover = duty.players[0]!;
    L.core.message(mover, { t: "block", key: lm.key, seq: 0, board: duty.board, move: "f6f4" });
    expect(L.last(mover, "blockNo")).toMatchObject({ reason: "not_a_move" });
    L.core.message(mover, { t: "block", key: lm.key, seq: 0, board: duty.board, move: "g8g5" });
    expect(L.last(mover, "blockNo")).toMatchObject({ reason: "no_piece" });
    L.core.message(mover, { t: "block", key: lm.key, seq: 0, board: duty.board, move: "e8f8" });
    expect(L.last(mover, "blockNo")).toMatchObject({ reason: "king" });
    L.core.message(mover, { t: "block", key: lm.key, seq: 0, board: duty.board, move: "f6e4" });
    expect(L.last(solo, "block")!.bank).toBe(SQUADS.blocks.bankPerMatch - 2);
    L.core.message(mover, { t: "choose", key: lm.key, seq: 0, move: "g5f6" });
    L.runUntil(() => lm.state === "show", 60_000, "the half played");
    const half = L.all(solo, "half").find((h) => h.key === lm.key && h.seq === 0)!;
    expect(ofKind(half.events, "block")).toMatchObject([{ move: "f6e4", outcome: "impossible", cost: 2 }]);
    expect(half.match.blockBanks[side]).toBe(SQUADS.blocks.bankPerMatch);
    expect(half.match.blocks).toEqual([]);
  });

  it("in the final, the squad to move blocks; the other squad can't then choose that move (refused: blocked)", () => {
    for (let seed = 1; seed < 60; seed++) {
      const L = squadsLobby({ seed, test: { start: 2, mode: "mercenary" }, fillInMs: 5_000 });
      L.core.reserve([{ size: 4, pass: "red" }, { size: 4, pass: "blue" }], 60_000);
      const red = ["R1", "R2", "R3", "R4"].map((n) => L.join(n, { party: "red" }));
      const blue = ["B1", "B2", "B3", "B4"].map((n) => L.join(n, { party: "blue" }));
      L.advance(5_000 + VOTES_MS + introMs(2, "mercenary"));
      const fin = L.core.match("r2m0");
      if (!fin || !mineIn(fin, red[0]!) || !mineIn(fin, blue[0]!)) continue;
      const duty = halfDuties(fin.m).duties[0]!;
      const movers = red.includes(duty.players[0]!) ? red : blue;
      const others = movers === red ? blue : red;
      const fen = fin.m.boards[0]!.fen;
      const them = fen.split(" ")[1] === "w" ? "b" : "w";
      expect(them).toBe("b");
      // Three vote for one move, one for another; one of them blocks Black's knight to f6.
      L.core.message(movers[2]!, { t: "block", key: "r2m0", seq: 0, board: 0, move: "g8f6" });
      for (const [i, p] of movers.entries()) {
        L.core.message(p, { t: "choose", key: "r2m0", seq: 0, move: i < 3 ? "d2d4" : "e2e4" });
        L.core.message(p, { t: "lock", key: "r2m0", seq: 0 });
      }
      L.runUntil(() => fin.state === "show", 60_000, "the vote");
      const half = L.all(others[0]!, "half").find((h) => h.key === "r2m0")!;
      const vote = ofKind(half.events, "vote")[0]!;
      expect(vote).toMatchObject({ move: "d2d4", tied: ["d2d4"], tally: [{ move: "d2d4", votes: 3 }, { move: "e2e4", votes: 1 }] });
      expect(ofKind(half.events, "block")).toMatchObject([{ move: "g8f6", outcome: "on" }]);
      L.runUntil(() => fin.state === "half", 60_000, "their half");
      L.core.message(others[0]!, { t: "choose", key: "r2m0", seq: 1, move: "g8f6" });
      expect(L.last(others[0]!, "choiceNo")).toMatchObject({ reason: "blocked" });
      L.core.message(others[0]!, { t: "choose", key: "r2m0", seq: 1, move: "g8h6" });
      expect(L.last(others[0]!, "choiceNo")?.move).not.toBe("g8h6");
      // Their picks show to them, not to the squad that blocked.
      expect(L.last(others[1]!, "choices")!.visible[others[0]!]).toBe("g8h6");
      expect(L.last(movers[0]!, "choices")!.visible[others[0]!]).toBeUndefined();
      // Blocks in effect are on everyone's match.
      L.core.message(movers[0]!, { t: "sync" });
      expect(L.all(movers[0]!, "match").at(-1)!.match.blocks).toMatchObject([{ move: "g8f6", by: movers[2] }]);
      return;
    }
    throw new Error("No seed puts the two parties in the final");
  }, 120_000);
});

describe("squads v2 server: test lobbies and views", () => {
  it("a test lobby can start from a position (White to move, legal) and with strong bots", () => {
    const fen = "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3";
    expect(parseTestFen(fen)).toBe(fen);
    expect(parseTestFen("rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq - 2 3")).toBeNull();
    expect(parseTestFen("nonsense")).toBeNull();
    const o = testLobbyOptions(new URLSearchParams({ start: "pairs", fen, bots: "strong", seat: "white" }), 0);
    expect(o.test).toEqual({ start: 1, fen, strong: true, white: true });
    expect(testLobbyOptions(new URLSearchParams({ start: "votes", mode: "mercenary" }), 0).test).toEqual({ start: 0, mode: "mercenary" });
    expect(testLobbyOptions(new URLSearchParams({ mode: "pillage" }), 0).test.mode).toBeUndefined();
    // The opener plays White on their first board, whatever the seed.
    for (let seed = 1; seed < 9; seed++) {
      const L = squadsLobby({ seed, test: o.test, fillInMs: 5_000 });
      const tess = L.join("Tess");
      // (No mode set: the Mode vote too.)
      L.advance(5_000 + VOTES_MS + (SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000);
      expect(L.core.record.bots.every((b) => b.skill === Math.min(...L.core.record.bots.map((x) => x.skill!)))).toBe(true);
      const pairs = L.core.allMatches().filter((m) => m.round === 1);
      expect(pairs.every((m) => m.m.boards.every((b) => b.fen === fen))).toBe(true);
      const mine = pairs.find((m) => mineIn(m, tess))!;
      expect(halfDuties(mine.m).duties.some((d) => d.players.includes(tess))).toBe(true);
    }
  });

  it("every player's match view carries each squad's tokens, block bank, the blocks in effect and the token log (Classic: no blocks)", () => {
    const { L, solo, lm } = partyLobby(1);
    L.core.message(solo, { t: "sync" });
    const m = L.all(solo, "match").find((x) => x.match.key === lm.key)!;
    expect(m.match).toMatchObject({ mode: "classic", tokens: [SQUADS.tokens.perMatch, SQUADS.tokens.perMatch], blockBanks: [0, 0], blocks: [], tokenLog: [], kit: null });
    expect(m.placed).toEqual([]);
    expect(halfDuties(lm.m).duties.every((d) => d.role === "pick")).toBe(true);
  });
});
