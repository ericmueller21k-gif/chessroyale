import { describe, expect, it } from "vitest";
import openings from "../data/openings.json";
import { SQUADS, matchSignals, mulberry32, skipReason, type FairMove, type SquadsSettings } from "@chessroyale/core";
import { START_FEN, type MoveScore, type Opening } from "../src/index.ts";
import {
  MERC_ITEMS,
  MODE_OPTIONS,
  NO_INPUTS,
  NO_ITEMS,
  applyKits,
  assistShownTo,
  botModeVotes,
  botChipTap,
  botShop,
  botUsesStockfish,
  boardCoins,
  brilliantCandidate,
  brilliantPay,
  buyItem,
  captureCoins,
  capturedPiece,
  catchUpCoins,
  chipWindowsOn,
  chipsNow,
  chipsOn,
  choose,
  createSquadsMatch,
  dutyDeadline,
  dutyOf,
  earn,
  formSquads,
  halfDuties,
  heldVotes,
  isAssisted,
  isBrilliant,
  itemCounts,
  itemPrice,
  lockIn,
  moveCutoffs,
  movesAllowed,
  newWallet,
  nextPrice,
  placeBlock,
  planLobby,
  planMatch,
  resolveHalf,
  returnChips,
  rulesFromVotes,
  squadsVotes,
  startArmageddon,
  startTeamClocks,
  stockfishNow,
  takeCart,
  tokenLines,
  unbuyItem,
  upgradeMatch,
  upgradeWallet,
  useChip,
  useStockfish,
  votable,
  type HalfInputs,
  type ItemCounts,
  type Lineup,
  type MatchSetup,
  type Side,
  type SquadsEvent,
  type SquadsMatch,
} from "../src/squads/index.ts";

/**
 * Squads' modes (Eric, Oct 12): the Mode vote (Classic, Mercenary, a third "Coming soon"), Classic with no blocks, and
 * Mercenary's economy: coins earned by play, catch-up, the wallet carried from round to round, the team shop (caps,
 * escalating prices, putting one back), the kit for the next match only, every item's effect, the Stockfish token never
 * showing the other squad's moves, fair play leaving token-assisted moves out, and the bots' shopping.
 */

const library = openings as unknown as Opening[];
const M = SQUADS.mercenary;
const sides: [Lineup, Lineup] = [
  { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
  { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
];
const BANK = 240_000;
const DELAY = 3_000;
/** The tests' own cap on a move (each Clock option has its own). */
const CAP = 20_000;
/** 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6: White mates with Qxf7. */
const SCHOLAR = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
/** After 1.d4 Nf6 2.Bg5: White's bishop can take the knight. */
const BG5 = "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3";
/** White's pawn on e5 can take en passant on f6. */
const EN_PASSANT = "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3";
/** A quiet middlegame, move 12 (ply 22). */
const MIDDLE = "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 12";

function match(format: "relay" | "pairs" | "final", starts: string[], o: Partial<MatchSetup> = {}, s?: SquadsSettings): SquadsMatch {
  return createSquadsMatch(
    {
      key: format === "relay" ? "r0m0" : format === "pairs" ? "r1m0" : "r2m0",
      seed: 7,
      round: format === "relay" ? 0 : format === "pairs" ? 1 : 2,
      format,
      sides,
      starts: starts.map((fen) => ({ fen, openingId: null })),
      whites: starts.map((_, k) => (k % 2) as Side),
      banksMs: [BANK, BANK],
      delayMs: DELAY,
      incrementMs: 0,
      capMs: CAP,
      mode: "mercenary",
      ...o,
    },
    s,
  );
}
const relay = (starts = Array(4).fill(START_FEN), o: Partial<MatchSetup> = {}) => match("relay", starts, o);
const pairs = (starts = Array(2).fill(START_FEN), o: Partial<MatchSetup> = {}) => match("pairs", starts, o);
const final = (fen = START_FEN, o: Partial<MatchSetup> = {}) => match("final", [fen], o);
const kit = (k: Partial<ItemCounts>): ItemCounts => ({ ...NO_ITEMS, ...k });

function inputs(m: SquadsMatch, moves: Record<string, string>, base: HalfInputs = NO_INPUTS): HalfInputs {
  let inp = base;
  for (const [id, mv] of Object.entries(moves)) {
    const r = choose(m, inp, id, mv);
    if ("error" in r) throw new Error(`${id} ${mv}: ${r.error}`);
    inp = lockIn(r.inputs, id);
  }
  return inp;
}
function block(m: SquadsMatch, inp: HalfInputs, id: string, board: number, move: string, at = 0): HalfInputs {
  const r = placeBlock(m, inp, id, board, move, at);
  if ("error" in r) throw new Error(`${id} block ${move}: ${r.error}`);
  return r.inputs;
}
/** Every other duty this half played with its first allowed move. */
function rest(m: SquadsMatch, moves: Record<string, string>): Record<string, string> {
  const all: Record<string, string> = { ...moves };
  for (const d of halfDuties(m).duties) {
    const allowed = movesAllowed(m, d.board);
    d.players.forEach((p, i) => (all[p] ??= allowed[i % allowed.length]!));
  }
  return all;
}
const ofKind = <K extends SquadsEvent["kind"]>(events: SquadsEvent[], kind: K) => events.filter((e): e is Extract<SquadsEvent, { kind: K }> => e.kind === kind);
/** The Relay mover on a board this half. */
const moverOn = (m: SquadsMatch, board: number) => halfDuties(m).duties.find((d) => d.board === board)!.players[0]!;

describe("Squads modes: the Mode vote", () => {
  it("is the first vote: Classic, Mercenary, and a third mode shown as Coming soon that can't be voted for", () => {
    const votes = squadsVotes();
    expect(votes[0]!.id).toBe("mode");
    expect(votes[0]!.options.map((o) => [o.id, o.label, !!o.disabled])).toEqual([
      ["classic", "Classic", false],
      ["mercenary", "Mercenary", false],
      ["soon", "Coming soon", true],
    ]);
    expect(votable(votes[0]!, 0)).toBe(true);
    expect(votable(votes[0]!, 1)).toBe(true);
    expect(votable(votes[0]!, 2)).toBe(false);
    expect(votable(votes[0]!, 3)).toBe(false);
  });

  it("nobody voting is Classic; a forced mode (a test lobby's link) holds no Mode vote and sets it", () => {
    expect(rulesFromVotes({}).mode).toBe("classic");
    expect(rulesFromVotes({ mode: 1 }).mode).toBe("mercenary");
    // (A Coming-soon result, which the machinery never gives, still falls back to the default.)
    expect(rulesFromVotes({ mode: 2 }).mode).toBe("classic");
    expect(heldVotes("mercenary").map((v) => v.id)).toEqual(["start", "clock"]);
    expect(heldVotes(null).map((v) => v.id)).toEqual(["mode", "start", "clock"]);
    expect(rulesFromVotes({ mode: 0 }, SQUADS, "mercenary").mode).toBe("mercenary");
  });

  it("bots vote too, Classic or Mercenary by the lobby's lean, never Coming soon", () => {
    const ids = Array.from({ length: 31 }, (_, i) => `bot${i}`);
    const classic = MODE_OPTIONS.findIndex((o) => o.id === "classic");
    const merc = MODE_OPTIONS.findIndex((o) => o.id === "mercenary");
    let classicWins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const votes = botModeVotes(mulberry32(seed), ids, 8000, SQUADS.voteBotSkip);
      expect(votes.every((v) => v.option === classic || v.option === merc)).toBe(true);
      expect(votes.every((v) => v.atMs > 0 && v.atMs < 8000)).toBe(true);
      const c = votes.filter((v) => v.option === classic).length;
      if (c > votes.length - c) classicWins++;
    }
    // Most lobbies' bots lean Classic, some Mercenary (the lean is drawn in SQUADS.modeVote.classicLean).
    expect(classicWins / 200).toBeGreaterThan(0.5);
    expect(classicWins / 200).toBeLessThan(0.85);
    const all = (lean: [number, number]) => botModeVotes(mulberry32(3), ids, 8000, 0, { ...SQUADS, modeVote: { classicLean: lean } });
    expect(all([1, 1]).every((v) => v.option === classic)).toBe(true);
    expect(all([0, 0]).every((v) => v.option === merc)).toBe(true);
  });
});

describe("Squads modes: Classic has no blocks; Mercenary has the bank for a match", () => {
  const squads = startTeamClocks(formSquads([], Array.from({ length: 32 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, isBot: true, skill: 1 })), mulberry32(1)).squads, SQUADS.clocks[1]!);
  const plan = (mode: "classic" | "mercenary") => planLobby(5, { mode, start: "standard", clock: SQUADS.clocks[1]! }, library);

  it("Classic: a block bank of 0, so no block can be placed; no coins", () => {
    const m = planMatch(plan("classic"), 0, 0, [squads[0]!, squads[1]!], library);
    expect(m.mode).toBe("classic");
    expect(m.blockBanks).toEqual([0, 0]);
    const d = halfDuties(m).duties[0]!;
    expect(placeBlock(m, NO_INPUTS, d.players[0]!, d.board, "e7e5", 0)).toEqual({ error: "bank" });
    // A whole half of Classic: same-move tokens and all, but no coins.
    const out = resolveHalf(m, inputs(m, rest(m, {})));
    expect(ofKind(out.events, "coins")).toEqual([]);
    expect(out.brilliant).toEqual([]);
  });

  it("Mercenary: the bank for a match (Squads v2's), the same-move tokens as Classic's", () => {
    const m = planMatch(plan("mercenary"), 1, 0, [squads[0]!, squads[1]!], library);
    expect(m.mode).toBe("mercenary");
    expect(m.blockBanks).toEqual([SQUADS.blocks.bankPerMatch, SQUADS.blocks.bankPerMatch]);
    expect(m.tokens).toEqual([SQUADS.tokens.perMatch, SQUADS.tokens.perMatch]);
    const c = planMatch(plan("classic"), 1, 0, [squads[0]!, squads[1]!], library);
    expect(c.tokens).toEqual(m.tokens);
  });
});

describe("Mercenary: earning coins", () => {
  it("a capture pays by the piece taken (en passant a pawn); not taking pays nothing", () => {
    expect(capturedPiece(BG5, "g5f6")).toBe("n");
    expect(capturedPiece(EN_PASSANT, "e5f6")).toBe("p");
    expect(capturedPiece(START_FEN, "e2e4")).toBeNull();
    const m = relay([BG5, START_FEN, START_FEN, START_FEN]);
    const out = resolveHalf(m, inputs(m, rest(m, { [moverOn(m, 0)]: "g5f6" })));
    expect(ofKind(out.events, "coins")).toEqual([{ kind: "coins", turn: 0, half: "w", side: 0, coins: M.capture.n * M.roundScale[0], why: "capture", board: 0, move: "g5f6", piece: "n" }]);
    expect(out.match.coins).toEqual([M.capture.n * M.roundScale[0], 0]);
  });

  it("fewer boards, more a board: Pairs and the final multiply a board's coins, so every round pays about the same", () => {
    // Relay plays 4 boards, Pairs 2, the final 1: the scale makes up for it (Eric, Oct 13: 500-800 a squad a round).
    expect(M.roundScale[0]).toBe(1);
    expect(M.roundScale[1]).toBeGreaterThan(M.roundScale[0]);
    expect(M.roundScale[2]).toBeGreaterThan(M.roundScale[1]);
    for (const r of [0, 1, 2] as const) {
      expect(captureCoins("q", r)).toBe(Math.round(M.capture.q * M.roundScale[r]));
      expect(boardCoins({ winner: "w", reason: "checkmate" }, r).map((x) => x.coins)).toEqual([Math.round(M.boardWin * M.roundScale[r]), Math.round(M.mate * M.roundScale[r])]);
    }
    // In a Pairs match, the knight taken pays the Pairs rate.
    const m = pairs([BG5, START_FEN]);
    const all: Record<string, string> = {};
    for (const d of halfDuties(m).duties) for (const p of d.players) all[p] = d.board === 0 ? "g5f6" : movesAllowed(m, d.board)[0]!;
    const out = resolveHalf(m, inputs(m, all));
    expect(ofKind(out.events, "coins").filter((e) => e.why === "capture").map((e) => e.coins)).toEqual([M.capture.n * M.roundScale[1]]);
  });

  it("a board won pays its winner (more for a checkmate); a drawn board pays both", () => {
    expect(boardCoins({ winner: "w", reason: "checkmate" }, 0)).toEqual([
      { colour: "w", coins: M.boardWin, why: "board_win" },
      { colour: "w", coins: M.mate, why: "mate" },
    ]);
    expect(boardCoins({ winner: "b", reason: "safety_cap" }, 0)).toEqual([{ colour: "b", coins: M.boardWin, why: "board_win" }]);
    expect(boardCoins({ winner: null, reason: "stalemate" }, 0).map((x) => [x.colour, x.coins])).toEqual([
      ["w", M.boardDraw],
      ["b", M.boardDraw],
    ]);
    const m = relay([SCHOLAR, START_FEN, START_FEN, START_FEN]);
    const out = resolveHalf(m, inputs(m, rest(m, { [moverOn(m, 0)]: "h5f7" })));
    const coins = ofKind(out.events, "coins").filter((e) => e.board === 0);
    expect(coins.map((e) => [e.side, e.why, e.coins])).toEqual([
      [0, "capture", M.capture.p],
      [0, "board_win", M.boardWin],
      [0, "mate", M.mate],
    ]);
  });

  it("a finished match pays both squads the base for playing it, and its winner more (the final's mate: all of it)", () => {
    const m = final(SCHOLAR);
    const out = resolveHalf(m, inputs(m, { a0: "h5f7", a1: "h5f7", a2: "h5f7", a3: "h5f7" }));
    expect(out.match.result?.winner).toBe(0);
    const coins = ofKind(out.events, "coins");
    expect(coins.map((e) => [e.side, e.why])).toEqual([
      [0, "capture"],
      [0, "board_win"],
      [0, "mate"],
      [0, "played"],
      [1, "played"],
      [0, "match_win"],
    ]);
    expect(out.match.coins).toEqual([(M.capture.p + M.boardWin + M.mate) * M.roundScale[2] + M.played + M.matchWin, M.played]);
    expect(out.events.at(-1)!.kind).toBe("match_end");
  });

  it("the base is most of a squad's coins (Eric, Oct 13: like CS or Valorant); play adds a smaller layer", () => {
    // A squad that wins its match has the base, the win and some play: the base and the win outweigh a typical
    // match's play (a few captures, its boards), and a brilliant move never pays more than a board won.
    expect(M.played + M.matchWin).toBeGreaterThan(2 * (M.boardWin + M.mate) * M.roundScale[0]);
    expect(M.played).toBeGreaterThan(M.matchWin);
    expect(M.brilliant.coins).toBeLessThanOrEqual(M.boardWin);
  });

  it("a drawn final's Armageddon doesn't pay the base again: only its winner's match win", () => {
    const drawn = final("8/8/8/4k3/8/8/4K3/8 w - - 0 1");
    const arm = startArmageddon({ ...drawn, result: { winner: null, points: [0.5, 0.5], how: "boards" }, boards: drawn.boards.map((b) => ({ ...b, result: { winner: null, reason: "insufficient_material" } })) }, 0, { fen: SCHOLAR, openingId: null });
    const out = resolveHalf(arm, inputs(arm, Object.fromEntries(halfDuties(arm).duties.flatMap((d) => d.players.map((p) => [p, "h5f7"])))));
    expect(out.match.result).not.toBeNull();
    expect(ofKind(out.events, "coins").filter((e) => e.board === null).map((e) => e.why)).toEqual(["match_win"]);
  });

  it("Classic pays nothing for the same mate", () => {
    const m = final(SCHOLAR, { mode: "classic" });
    const out = resolveHalf(m, inputs(m, { a0: "h5f7", a1: "h5f7", a2: "h5f7", a3: "h5f7" }));
    expect(ofKind(out.events, "coins")).toEqual([]);
    expect(out.match.coins).toEqual([0, 0]);
  });

  it("the wallet carries coins from round to round; catch-up and a test wallet aren't counted as earned", () => {
    let w = newWallet(3);
    w = earn(w, 120, "capture", 0);
    w = earn(w, 75, "match_win", 0);
    w = earn(w, 40, "catch_up", 1);
    w = earn(w, 600, "test", 1);
    expect(w).toMatchObject({ coins: 835, earned: 195, byRound: [195, 0, 0], catchUp: 40 });
    // Spending and the shop closing never take what's left: it carries on into the next round.
    const bought = buyItem(w, "shield");
    if ("error" in bought) throw new Error(bought.error);
    const closed = takeCart(bought.wallet);
    expect(closed.wallet.coins).toBe(835 - M.items.shield.price);
    expect(closed.wallet.cart).toEqual(NO_ITEMS);
    expect(earn(closed.wallet, 30, "capture", 1)).toMatchObject({ coins: 835 - M.items.shield.price + 30, byRound: [195, 30, 0] });
  });

  it("catch-up: the squad that has earned less gets a share of the gap (to the nearest 10, at most the max), the other none", () => {
    expect(catchUpCoins([100, 400])).toEqual([Math.round((300 * M.catchUp.share) / 10) * 10, 0]);
    expect(catchUpCoins([900, 200])).toEqual([0, Math.min(M.catchUp.max, Math.round((700 * M.catchUp.share) / 10) * 10)]);
    expect(catchUpCoins([0, 5000])).toEqual([M.catchUp.max, 0]);
    expect(catchUpCoins([250, 250])).toEqual([0, 0]);
    expect(catchUpCoins([250, 254])).toEqual([0, 0]);
  });
});

describe("Mercenary: brilliant moves", () => {
  it("pays 25 (about a queen taken in Relay, well under a board won), at most twice per squad per match", () => {
    // Eric, Oct 13: "How could one move be more than winning an entire game?"
    expect(M.brilliant.coins).toBe(25);
    expect(M.brilliant.coins).toBeLessThan(M.boardWin);
    expect(M.brilliant.capPerMatch).toBe(2);
    expect(brilliantPay(0)).toEqual({ coins: 25, capped: false });
    expect(brilliantPay(1)).toEqual({ coins: 25, capped: false });
    expect(brilliantPay(2)).toEqual({ coins: 0, capped: true });
    expect(brilliantPay(5)).toEqual({ coins: 0, capped: true });
    // The cap is a setting.
    const s3 = { ...SQUADS, mercenary: { ...M, brilliant: { ...M.brilliant, capPerMatch: 3 } } };
    expect(brilliantPay(2, s3)).toEqual({ coins: 25, capped: false });
  });

  const top = (lines: [string, number][]): MoveScore[] => lines.map(([move, expected]) => ({ move, expected }));

  it("a quiet move the judge rates best by the gap, in a position still in the balance, is brilliant", () => {
    const c = { fen: MIDDLE, move: "a2a3", blocked: [] };
    expect(isBrilliant(c, top([["a2a3", 0.7], ["h2h3", 0.7 - M.brilliant.gap]]))).toBe(true);
    expect(isBrilliant(c, top([["a2a3", 0.7], ["h2h3", 0.7 - M.brilliant.gap + 0.05]]))).toBe(false);
    expect(isBrilliant(c, top([["h2h3", 0.75], ["a2a3", 0.7]]))).toBe(false);
    // Already won: every move scores about 1, nothing is brilliant.
    expect(isBrilliant(c, top([["a2a3", 0.99], ["h2h3", 0.2]]))).toBe(false);
    // No judge, or one line only: not brilliant.
    expect(isBrilliant(c, null)).toBe(false);
    expect(isBrilliant(c, top([["a2a3", 0.7]]))).toBe(false);
    // A blocked rival doesn't count against it.
    expect(isBrilliant({ ...c, blocked: ["h2h3"] }, top([["a2a3", 0.7], ["h2h3", 0.69], ["b2b3", 0.1]]))).toBe(true);
  });

  it("is only asked about quiet moves from the middlegame on, found without a Stockfish token", () => {
    const base = { board: 0, side: 0 as Side, fen: MIDDLE, move: "a2a3", ply: 22, finders: ["a0"], blocked: [] };
    expect(brilliantCandidate(base)).toBe(true);
    expect(brilliantCandidate({ ...base, ply: M.brilliant.fromPly - 1 })).toBe(false);
    expect(brilliantCandidate({ ...base, finders: [] })).toBe(false);
    expect(brilliantCandidate({ ...base, fen: BG5, move: "g5f6", ply: 4 + M.brilliant.fromPly })).toBe(false);
    // Out of check (here, after 1.e4 f5 2.Qh5+): not asked.
    expect(brilliantCandidate({ ...base, fen: "rnbqkbnr/ppppp1pp/8/5p1Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2", move: "g7g6", ply: 30 })).toBe(false);
  });

  it("the rules hand the judge each played move worth asking about, with who found it", () => {
    const m = relay([MIDDLE, MIDDLE, MIDDLE, MIDDLE]);
    const mover = moverOn(m, 0);
    const out = resolveHalf(m, inputs(m, rest(m, { [mover]: "a2a3" })));
    const c = out.brilliant.find((x) => x.board === 0)!;
    expect(c).toMatchObject({ side: halfDuties(m).duties.find((d) => d.board === 0)!.side, move: "a2a3", fen: MIDDLE, finders: [mover] });
  });
});

describe("Mercenary: the shop", () => {
  const rich = (coins = 5000) => earn(newWallet(0), coins, "capture", 0);

  it("each item's price rises by the step for every one the squad has bought this tournament (the Time chip: its own list)", () => {
    for (const it of MERC_ITEMS.filter((x) => !M.items[x].prices)) {
      expect(itemPrice(it, 0)).toBe(M.items[it].price);
      expect(itemPrice(it, 2)).toBe(M.items[it].price + 2 * M.priceStep);
    }
    // Eric's anchors: the third Stockfish token about 400, the second shield 200-300.
    expect(itemPrice("stockfish", 2)).toBeGreaterThanOrEqual(350);
    expect(itemPrice("stockfish", 2)).toBeLessThanOrEqual(450);
    expect(itemPrice("shield", 1)).toBeGreaterThanOrEqual(200);
    expect(itemPrice("shield", 1)).toBeLessThanOrEqual(300);
    let w = rich();
    const paid: number[] = [];
    for (let i = 0; i < M.items.stockfish.cap; i++) {
      const r = buyItem(w, "stockfish");
      if ("error" in r) throw new Error(r.error);
      paid.push(r.price);
      w = r.wallet;
    }
    expect(paid).toEqual(Array.from({ length: M.items.stockfish.cap }, (_, i) => M.items.stockfish.price + i * M.priceStep));
    // The next round's shop starts from what was bought before: the price keeps rising.
    w = takeCart(w).wallet;
    expect(nextPrice(w, "stockfish")).toBe(M.items.stockfish.price + M.items.stockfish.cap * M.priceStep);
  });

  it("a round's cap: no more of an item than it allows for one match", () => {
    let w = rich();
    for (let i = 0; i < M.items.shield.cap; i++) {
      const r = buyItem(w, "shield");
      if ("error" in r) throw new Error(r.error);
      w = r.wallet;
    }
    expect(buyItem(w, "shield")).toEqual({ error: "cap" });
    expect(w.cart.shield).toBe(M.items.shield.cap);
    // After the match, the cap is the next round's again.
    expect("wallet" in buyItem(takeCart(w).wallet, "shield")).toBe(true);
  });

  it("not enough coins: refused; putting one back refunds what it cost and lowers the price again", () => {
    expect(buyItem(newWallet(0), "chip")).toEqual({ error: "coins" });
    expect(unbuyItem(newWallet(0), "chip")).toEqual({ error: "none" });
    const w0 = rich(1000);
    const a = buyItem(w0, "blocks");
    if ("error" in a) throw new Error(a.error);
    const b = buyItem(a.wallet, "blocks");
    if ("error" in b) throw new Error(b.error);
    expect(b.price).toBe(a.price + M.priceStep);
    const back = unbuyItem(b.wallet, "blocks");
    if ("error" in back) throw new Error(back.error);
    expect(back.refund).toBe(b.price);
    expect(back.wallet).toEqual(a.wallet);
  });

  it("one shared wallet: whoever on the squad buys, it all comes from (and goes into) the same cart", () => {
    // (The lobby keeps one wallet per squad: two teammates' purchases one after the other.)
    let w = rich(500);
    for (const it of ["chip", "shield"] as const) {
      const r = buyItem(w, it);
      if ("error" in r) throw new Error(r.error);
      w = r.wallet;
    }
    expect(w.coins).toBe(500 - M.items.chip.price - M.items.shield.price);
    expect(w.cart).toEqual(kit({ chip: 1, shield: 1 }));
  });
});

describe("Mercenary: the kit is for the next match only", () => {
  it("comes in once as the match starts; a later match (or Armageddon's) without one has none", () => {
    const m = applyKits(pairs(), [kit({ chip: 2, blocks: 1, stockfish: 2, shield: 1 }), NO_ITEMS]);
    expect(m.banks).toEqual([BANK, BANK]);
    expect(m.chips).toEqual([2, 0]);
    expect(m.blockBanks).toEqual([SQUADS.blocks.bankPerMatch + M.blockPoints, SQUADS.blocks.bankPerMatch]);
    expect(m.stockfish).toEqual([2, 0]);
    expect(m.shields).toEqual([1, 0]);
    // Once only, and never into Classic.
    expect(applyKits(m, [kit({ chip: 2 }), kit({ chip: 2 })])).toBe(m);
    const classic = pairs(undefined, { mode: "classic" });
    expect(applyKits(classic, [kit({ chip: 2 }), NO_ITEMS])).toBe(classic);
    // The next match: nothing carried (its own kit, from the next shop).
    const next = final();
    expect([next.stockfish, next.shields, next.kit]).toEqual([[0, 0], [0, 0], null]);
  });

  it("a drawn final's Armageddon is the same round: the final's tokens and shields carry on", () => {
    let m = applyKits(final("8/8/8/4k3/8/8/4K3/8 w - - 0 1"), [kit({ stockfish: 1, shield: 2 }), NO_ITEMS]);
    m = { ...m, result: { winner: null, points: [0.5, 0.5], how: "boards" }, boards: m.boards.map((b) => ({ ...b, result: { winner: null, reason: "insufficient_material" } })) };
    const arm = startArmageddon(m, 0, { fen: START_FEN, openingId: null });
    expect(arm).toMatchObject({ mode: "mercenary", stockfish: [1, 0], shields: [2, 0], delayMs: DELAY });
  });
});

describe("Mercenary: the items", () => {

  it("block points: more block bank for the match", () => {
    const m = applyKits(relay(), [NO_ITEMS, kit({ blocks: 2 })]);
    expect(m.blockBanks[1] - m.blockBanks[0]).toBe(2 * M.blockPoints);
  });

  it("four items: the Breather is gone (Eric, Oct 13), and a kit stored with one is read without it", () => {
    expect([...MERC_ITEMS]).toEqual(["stockfish", "blocks", "shield", "chip"]);
    expect(Object.keys(M.items).sort()).toEqual(["blocks", "chip", "shield", "stockfish"]);
    expect(itemCounts({ stockfish: 1, breather: 1, time: 2, chip: 1 })).toEqual(kit({ stockfish: 1, chip: 1 }));
    expect(itemCounts(null)).toEqual(NO_ITEMS);
    // A kit stored with a breather (a match in play across the deploy): the kit comes in without it, the free seconds
    // are the match's for both squads.
    const m = applyKits(relay(), [{ ...kit({ shield: 1 }), breather: 1 } as ItemCounts, NO_ITEMS]);
    expect(m.kit![0]).toEqual(kit({ shield: 1 }));
    const all = rest(m, {});
    const think = Object.fromEntries(Object.keys(all).map((p) => [p, 5_000]));
    const bank = ofKind(resolveHalf(m, inputs(m, all), think).events, "bank");
    expect(bank.map((e) => e.drainedMs)).toEqual([2 * (5_000 - DELAY), 2 * (5_000 - DELAY)]);
  });

  it("a match stored with a breather's free seconds plays on with the match's own; nothing else changes", () => {
    const fresh = applyKits(relay(), [kit({ stockfish: 1 }), NO_ITEMS]);
    const old = { ...fresh, delays: [DELAY * 2, DELAY], kit: [{ ...kit({ stockfish: 1 }), breather: 1 }, NO_ITEMS] } as unknown as SquadsMatch;
    const up = upgradeMatch(old);
    expect("delays" in up).toBe(false);
    expect(up.kit).toEqual([kit({ stockfish: 1 }), NO_ITEMS]);
    expect({ ...up, kit: null }).toEqual({ ...fresh, kit: null });
    expect(halfDuties({ ...up, banks: [0, 0] }).duties.every((d) => d.deadlineMs === DELAY)).toBe(true);
    // Today's match comes back as it was.
    expect(upgradeMatch(fresh)).toBe(fresh);
  });

  it("a wallet stored with a breather: one still in an open shop's cart refunded at what it cost; the counts without it", () => {
    const w = { ...newWallet(3), coins: 40, bought: { ...NO_ITEMS, shield: 1, breather: 2 }, cart: { ...NO_ITEMS, shield: 1, breather: 1 } } as unknown as ReturnType<typeof newWallet>;
    const up = upgradeWallet(w);
    // Its second breather (one bought in an earlier round, this one in the cart): 150 + one step.
    expect(up.coins).toBe(40 + 150 + M.priceStep);
    expect(up.bought).toEqual(kit({ shield: 1 }));
    expect(up.cart).toEqual(kit({ shield: 1 }));
    // A breather bought for an earlier round and used: nothing back.
    const used = { ...newWallet(3), coins: 40, bought: { ...NO_ITEMS, breather: 1 }, cart: { ...NO_ITEMS, breather: 0 } } as unknown as ReturnType<typeof newWallet>;
    expect(upgradeWallet(used)).toMatchObject({ coins: 40, bought: NO_ITEMS, cart: NO_ITEMS });
    const today = newWallet(1);
    expect(upgradeWallet(today)).toBe(today);
  });

  it("a shield cancels the next block against its squad that would take effect: the blocker's points stay spent", () => {
    // Side 0 (White on board 0) blocks two of Black's replies; side 1 has one shield: the first block placed is cancelled.
    const m = applyKits(relay(), [NO_ITEMS, kit({ shield: 1 })]);
    const mover = moverOn(m, 0);
    let inp = block(m, NO_INPUTS, mover, 0, "g8f6", 100);
    inp = block(m, inp, mover, 0, "b8c6", 200);
    const out = resolveHalf(m, inputs(m, rest(m, { [mover]: "e2e4" }), inp));
    expect(ofKind(out.events, "block").map((e) => [e.move, e.outcome])).toEqual([
      ["g8f6", "shielded"],
      ["b8c6", "on"],
    ]);
    expect(out.match.shields).toEqual([0, 0]);
    expect(out.match.blockBanks[0]).toBe(SQUADS.blocks.bankPerMatch - 2 * SQUADS.blocks.cost.n);
    expect(out.match.blocks.map((b) => b.move)).toEqual(["b8c6"]);
  });

  it("a block lifted anyway (impossible, in check) never uses a shield, and stays refunded", () => {
    // Bxf6 takes the knight whose move was blocked: lifted as impossible; the shield is still there.
    const m = applyKits(relay([BG5, START_FEN, START_FEN, START_FEN]), [NO_ITEMS, kit({ shield: 1 })]);
    const mover = moverOn(m, 0);
    const out = resolveHalf(m, inputs(m, rest(m, { [mover]: "g5f6" }), block(m, NO_INPUTS, mover, 0, "f6e4")));
    expect(ofKind(out.events, "block").map((e) => e.outcome)).toEqual(["impossible"]);
    expect(out.match.shields[1]).toBe(1);
    expect(out.match.blockBanks[0]).toBe(SQUADS.blocks.bankPerMatch);
    // A check lifts every block (liftInCheck): the shield is kept.
    const c = applyKits(relay(["rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", START_FEN, START_FEN, START_FEN]), [NO_ITEMS, kit({ shield: 1 })]);
    const cm = moverOn(c, 0);
    // (g7-g6 still answers the check, so only the check lifts it.)
    const outC = resolveHalf(c, inputs(c, rest(c, { [cm]: "d1h5" }), block(c, NO_INPUTS, cm, 0, "g7g6")));
    expect(ofKind(outC.events, "block").map((e) => e.outcome)).toEqual(["check"]);
    expect(outC.match.shields[1]).toBe(1);
  });

  it("a block a mercy rule lifts never uses a shield; of two that together would leave no move, the one standing does", () => {
    // Black's only move is h7-h6 (Rg1 holds the king; White's pawn stops h7-h5): blocking it would leave no move.
    const only = applyKits(final("7k/7p/8/7P/8/8/8/K5R1 w - - 0 1"), [NO_ITEMS, kit({ shield: 1 })]);
    const a = resolveHalf(only, inputs(only, { a0: "a1b1", a1: "a1b1", a2: "a1b1", a3: "a1b1" }, block(only, NO_INPUTS, "a0", 0, "h7h6")));
    expect(ofKind(a.events, "block").map((e) => e.outcome)).toEqual(["no_move"]);
    expect(a.match.shields[1]).toBe(1);
    expect(a.match.blockBanks[0]).toBe(SQUADS.blocks.bankPerMatch);
    // Black has h7-h6 and h7-h5: blocking both would leave none. The mercy lifts the later (refunded); the earlier would
    // take effect, so the shield cancels it (its point spent).
    const two = applyKits(final("7k/7p/8/8/8/8/8/K5R1 w - - 0 1"), [NO_ITEMS, kit({ shield: 1 })]);
    let inp = block(two, NO_INPUTS, "a0", 0, "h7h6", 100);
    inp = block(two, inp, "a1", 0, "h7h5", 200);
    const b = resolveHalf(two, inputs(two, { a0: "a1b1", a1: "a1b1", a2: "a1b1", a3: "a1b1" }, inp));
    expect(ofKind(b.events, "block").map((e) => e.outcome)).toEqual(["shielded", "no_move"]);
    expect(b.match.shields[1]).toBe(0);
    expect(b.match.blockBanks[0]).toBe(SQUADS.blocks.bankPerMatch - SQUADS.blocks.cost.p);
    expect(b.match.blocks).toEqual([]);
  });
});

describe("Mercenary: the Time chip (Eric, Oct 13)", () => {
  const CHIP = M.chipSeconds * 1000;
  const CEILING = CAP;
  const bankEvent = (events: SquadsEvent[], side: Side) => ofKind(events, "bank").find((e) => e.side === side)!;
  const ok = <T extends object>(r: T): Exclude<T, { error: unknown }> => {
    if ("error" in r) throw new Error(String((r as { error: unknown }).error));
    return r as Exclude<T, { error: unknown }>;
  };

  it("is bought at Eric's prices (25, 25, 50, 50, then 50), counted by chips bought; a squad holds at most 3", () => {
    expect([0, 1, 2, 3, 4, 9].map((n) => itemPrice("chip", n))).toEqual([25, 25, 50, 50, 50, 50]);
    expect(M.items.chip.cap).toBe(3);
    let w = earn(newWallet(0), 1000, "capture", 0);
    const paid: number[] = [];
    for (let i = 0; i < M.items.chip.cap; i++) {
      const r = ok(buyItem(w, "chip"));
      paid.push(r.price);
      w = r.wallet;
    }
    expect(paid).toEqual([25, 25, 50]);
    expect(buyItem(w, "chip")).toEqual({ error: "cap" });
    // Into the match: all of them; the wallet holds none meanwhile.
    const t = takeCart(w);
    expect(t.kit.chip).toBe(3);
    expect(t.wallet.chips).toBe(0);
    // One left after the match: kept for the next round, where the shop sells up to the cap again, the price list going
    // on from the chips bought (three so far: 50).
    let back = returnChips(t.wallet, 1);
    expect(back.chips).toBe(1);
    expect(nextPrice(back, "chip")).toBe(50);
    for (let i = 0; i < 2; i++) back = ok(buyItem(back, "chip")).wallet;
    expect(buyItem(back, "chip")).toEqual({ error: "cap" });
    // "−" puts back one from the cart, never a chip held.
    const u = ok(unbuyItem(back, "chip"));
    expect([u.wallet.chips, u.wallet.cart.chip, u.refund]).toEqual([1, 1, 50]);
    // The held chip goes into the next match with the ones bought.
    expect(takeCart(back).kit.chip).toBe(3);
  });

  it("comes into the match as the squad's (both squads' counts on the match); what's left goes back after; never in Classic", () => {
    const m = applyKits(relay(), [kit({ chip: 2 }), kit({ chip: 1 })]);
    expect(m.chips).toEqual([2, 1]);
    const classic = relay(undefined, { mode: "classic" });
    expect(applyKits(classic, [kit({ chip: 2 }), NO_ITEMS]).chips).toEqual([0, 0]);
    const mover = moverOn(m, 0);
    expect(useChip({ ...classic, chips: [1, 0] }, NO_INPUTS, mover, 1000, 0)).toEqual({ error: "no_chips" });
    // A chip tapped this half is spent with the half: the rest stay the squad's.
    const t = ok(useChip(m, NO_INPUTS, mover, 1000, 0));
    expect(chipsNow(m, t.inputs, 0)).toBe(1);
    const out = resolveHalf(m, inputs(m, rest(m, {}), t.inputs));
    expect(out.match.chips).toEqual([1, 1]);
  });

  it("is tapped only by a player on the move being thought about, during their squad's move", () => {
    const m = applyKits(relay(), [kit({ chip: 1 }), NO_ITEMS]);
    const duties = halfDuties(m).duties;
    const mover = moverOn(m, 0);
    const theirs = duties.find((d) => d.side === 1)!.players[0]!;
    const idle = m.sides[0].seats.find((p) => !duties.some((d) => d.players.includes(p)))!;
    expect(useChip(m, NO_INPUTS, idle, 1000, 0)).toEqual({ error: "no_duty" });
    expect(useChip(m, NO_INPUTS, theirs, 1000, 0)).toEqual({ error: "no_chips" });
    // Moved already: too late for that move.
    const moved = inputs(m, { [mover]: movesAllowed(m, 0)[0]! });
    expect(useChip(m, moved, mover, 1000, 0)).toEqual({ error: "done" });
    const t = ok(useChip(m, NO_INPUTS, mover, 1000, 0));
    expect(t.chip).toEqual({ board: 0, side: 0, by: mover, at: 1000 });
    // None left now.
    expect(useChip(m, t.inputs, moverOn(m, 2), 1000, 0)).toEqual({ error: "no_chips" });
  });

  it("in Pairs counts for both partners; two at once spend one (the first tap wins); several stack on one move", () => {
    const m = applyKits(pairs(), [kit({ chip: 3 }), NO_ITEMS]);
    const d = halfDuties(m).duties.find((x) => x.side === 0)!;
    const [p, q] = d.players as [string, string];
    const a = ok(useChip(m, NO_INPUTS, p, 1000, 0));
    // Q saw no chip on it: P's went first, so Q's tap spends nothing.
    expect(useChip(m, a.inputs, q, 1100, 0)).toEqual({ error: "stale" });
    // Seeing one, a second stacks.
    const b = ok(useChip(m, a.inputs, q, 1200, 1));
    expect(chipsOn(b.inputs, d.board)).toBe(2);
    expect(dutyDeadline(b.inputs, d)).toBe(CEILING + 2 * CHIP);
    expect(chipWindowsOn(m, b.inputs, d.board)).toEqual([[DELAY, DELAY + 2 * CHIP]]);
    // Both partners' picks at 45 s count (the ceiling is 20 s), and the bank never moved.
    const all = rest(m, {});
    const think = Object.fromEntries(Object.keys(all).map((x) => [x, 4_000]));
    think[p] = 45_000;
    think[q] = 45_000;
    const out = resolveHalf(m, inputs(m, all, b.inputs), think);
    expect(out.acted).toEqual(expect.arrayContaining([p, q]));
    expect(bankEvent(out.events, 0).drainedMs).toBe(0);
    expect(out.match.chips).toEqual([1, 0]);
  });

  it("pushes the move's deadline 30 s later and holds the bank still for those 30 s; time it doesn't use is lost", () => {
    const m = applyKits(relay(), [kit({ chip: 2 }), NO_ITEMS]);
    const mover = moverOn(m, 0);
    const d = dutyOf(m, mover)!.duty;
    const t = ok(useChip(m, NO_INPUTS, mover, 5_000, 0));
    expect(dutyDeadline(t.inputs, d)).toBe(CEILING + CHIP);
    const all = rest(m, { [mover]: movesAllowed(m, 0)[0]! });
    const think = Object.fromEntries(Object.keys(all).map((x) => [x, 4_000]));
    // 40 s on it (past the ceiling, in time with the chip): it drains 3-5 s and 35-40 s; the other mover 1 s.
    think[mover] = 40_000;
    const out = resolveHalf(m, inputs(m, all, t.inputs), think);
    expect(out.acted).toContain(mover);
    expect(bankEvent(out.events, 0).drainedMs).toBe(2_000 + 5_000 + 1_000);
    // Without the chip, the same 40 s is out of time.
    expect(resolveHalf(m, inputs(m, all), think).missed).toContain(mover);
    // The move made at 10 s: the bank drained 2 s on it, and the chip's other 25 s are gone (never banked).
    think[mover] = 10_000;
    const quick = resolveHalf(m, inputs(m, all, t.inputs), think);
    expect(bankEvent(quick.events, 0).drainedMs).toBe(2_000 + 1_000);
    expect(quick.match.banks[0]).toBe(BANK - 3_000);
  });

  it("works in sudden death: the free seconds and 30 s more for that move, tapped while there's time", () => {
    const m = applyKits(relay(undefined, { banksMs: [0, BANK] }), [kit({ chip: 1 }), NO_ITEMS]);
    const mover = moverOn(m, 0);
    const d = dutyOf(m, mover)!.duty;
    expect(useChip(m, NO_INPUTS, mover, DELAY + 1, 0)).toEqual({ error: "late" });
    const t = ok(useChip(m, NO_INPUTS, mover, 1_500, 0));
    expect(dutyDeadline(t.inputs, d)).toBe(DELAY + CHIP);
    const all = rest(m, { [mover]: movesAllowed(m, 0)[0]! });
    const think = Object.fromEntries(Object.keys(all).map((x) => [x, 2_000]));
    think[mover] = 20_000;
    const out = resolveHalf(m, inputs(m, all, t.inputs), think);
    expect(out.acted).toContain(mover);
    expect(resolveHalf(m, inputs(m, all), think).missed).toContain(mover);
  });

  it("works with every time control (Oct 13): 30 s past the option's cap, the bank held still from the free seconds, the increment still earned; in sudden death the free seconds and 30 s", () => {
    for (const c of SQUADS.clocks) {
      const o = { delayMs: c.delaySeconds * 1000, incrementMs: c.incrementSeconds * 1000, capMs: c.capSeconds * 1000 };
      const m = applyKits(relay(undefined, o), [kit({ chip: 2 }), NO_ITEMS]);
      const mover = moverOn(m, 0);
      const d = dutyOf(m, mover)!.duty;
      expect(d.deadlineMs).toBe(o.capMs);
      const t = ok(useChip(m, NO_INPUTS, mover, 1_000, 0));
      expect(dutyDeadline(t.inputs, d)).toBe(o.capMs + CHIP);
      // Its 30 s run from after the free seconds (tapped within them).
      expect(chipWindowsOn(m, t.inputs, 0)).toEqual([[o.delayMs, o.delayMs + CHIP]]);
      const all = rest(m, { [mover]: movesAllowed(m, 0)[0]! });
      // Everyone else moves within the free seconds; the mover 2 s past the chip's 30 s (and past the option's cap).
      const think = Object.fromEntries(Object.keys(all).map((x) => [x, 1_000]));
      think[mover] = o.delayMs + CHIP + 2_000;
      expect(think[mover]).toBeGreaterThan(o.capMs);
      const out = resolveHalf(m, inputs(m, all, t.inputs), think);
      expect(out.acted).toContain(mover);
      expect(bankEvent(out.events, 0).drainedMs).toBe(2_000);
      // Both of the squad's moves were made in time: both earn the increment.
      expect(out.match.banks[0]).toBe(BANK - 2_000 + 2 * o.incrementMs);
      // Without the chip, the same move is past the cap: missed, no increment for it.
      const without = resolveHalf(m, inputs(m, all), think);
      expect(without.missed).toContain(mover);
      expect(without.match.banks[0]).toBe(BANK - (o.capMs - o.delayMs) + o.incrementMs);
      // Sudden death: the free seconds and 30 s; made in time, the increment lifts the squad out.
      const sd = applyKits(relay(undefined, { ...o, banksMs: [0, BANK] }), [kit({ chip: 1 }), NO_ITEMS]);
      const sdDuty = dutyOf(sd, mover)!.duty;
      expect(sdDuty.deadlineMs).toBe(o.delayMs);
      const tapped = ok(useChip(sd, NO_INPUTS, mover, 500, 0));
      expect(dutyDeadline(tapped.inputs, sdDuty)).toBe(o.delayMs + CHIP);
      think[mover] = o.delayMs + 20_000;
      const sdOut = resolveHalf(sd, inputs(sd, rest(sd, { [mover]: movesAllowed(sd, 0)[0]! }), tapped.inputs), think);
      expect(sdOut.acted).toContain(mover);
      expect(sdOut.match.banks[0]).toBe(2 * o.incrementMs);
    }
  });

  it("the bank running out while a chip holds it: that move runs to the chip's end; after it, the bank runs on", () => {
    const m = applyKits(relay(undefined, { banksMs: [5_000, BANK] }), [kit({ chip: 1 }), NO_ITEMS]);
    const mover = moverOn(m, 0);
    const other = moverOn(m, 2);
    const duties = halfDuties(m).duties.filter((d) => d.side === 0);
    const t = ok(useChip(m, NO_INPUTS, mover, 4_000, 0));
    const at = (ends: Record<string, number>) => duties.map((d) => ends[d.players[0]!]!);
    // The other mover thinks 20 s: two moves drain 3-4 s (2 s), then it alone until 7 s: out. The chip holds the mover
    // to 34 s.
    let r = moveCutoffs(m, t.inputs, 0, duties, at({ [mover]: CEILING + CHIP, [other]: 20_000 }));
    expect(r.out).toBe(7_000);
    expect(r.cutoffs.get(0)).toBe(34_000);
    expect(r.cutoffs.get(2)).toBe(7_000);
    // The other mover quick (3 s): 1 s drained before the chip, and after it (34 s) the last 4 s: out at 38 s.
    r = moveCutoffs(m, t.inputs, 0, duties, at({ [mover]: CEILING + CHIP, [other]: 3_000 }));
    expect(r.out).toBe(38_000);
    expect(r.cutoffs.get(0)).toBe(38_000);
    const all = rest(m, { [mover]: movesAllowed(m, 0)[0]! });
    const think = Object.fromEntries(Object.keys(all).map((x) => [x, 3_000]));
    think[mover] = 37_000;
    const made = resolveHalf(m, inputs(m, all, t.inputs), think);
    expect(made.acted).toContain(mover);
    expect(made.match.banks[0]).toBe(1_000);
    think[mover] = 39_000;
    const late = resolveHalf(m, inputs(m, all, t.inputs), think);
    expect(late.missed).toContain(mover);
    expect(late.match.banks[0]).toBe(0);
  });

  it("a drawn final's Armageddon keeps the final's chips", () => {
    let m = applyKits(final("8/8/8/4k3/8/8/4K3/8 w - - 0 1"), [kit({ chip: 2 }), kit({ chip: 1 })]);
    m = { ...m, result: { winner: null, points: [0.5, 0.5], how: "boards" }, boards: m.boards.map((b) => ({ ...b, result: { winner: null, reason: "insufficient_material" } })) };
    expect(startArmageddon(m, 0, { fen: START_FEN, openingId: null }).chips).toEqual([2, 1]);
  });

  it("a wallet from before the Time chip: a time coin in an open shop's cart refunded at what it cost; no chips held", () => {
    const w = { squadId: 2, coins: 10, earned: 0, byRound: [0, 0, 0], catchUp: 0, bought: { stockfish: 0, blocks: 0, shield: 0, time: 2 }, cart: { stockfish: 0, blocks: 0, shield: 0, time: 1 } } as unknown as ReturnType<typeof newWallet>;
    const up = upgradeWallet(w);
    expect(up.coins).toBe(10 + 75 + M.priceStep);
    expect(up.bought).toEqual(NO_ITEMS);
    expect(up.cart).toEqual(NO_ITEMS);
    expect(up.chips).toBe(0);
  });

  it("bots: tap one when a move needs time (sudden death more than a low bank), never with plenty; shop chips up to the cap", () => {
    const rate = (bankMs: number) => Array.from({ length: 2000 }, (_, i) => botChipTap(mulberry32(i + 1), bankMs)).filter((x) => x !== null).length / 2000;
    expect(rate(0)).toBeGreaterThan(M.bots.chip.suddenDeath - 0.05);
    expect(rate(0)).toBeLessThan(M.bots.chip.suddenDeath + 0.05);
    expect(rate(M.bots.chip.lowBankSeconds * 1000 - 1)).toBeGreaterThan(M.bots.chip.lowBank - 0.05);
    expect(rate(M.bots.chip.lowBankSeconds * 1000 - 1)).toBeLessThan(M.bots.chip.lowBank + 0.05);
    expect(rate(BANK)).toBe(0);
    for (let i = 1; i < 200; i++) {
      const at = botChipTap(mulberry32(i), 0);
      if (at !== null) expect(at).toBeGreaterThanOrEqual(M.bots.chip.tapMs[0]);
      if (at !== null) expect(at).toBeLessThanOrEqual(M.bots.chip.tapMs[1]);
    }
    // Shopping in the final with a chip held: never past the cap.
    for (let seed = 1; seed <= 100; seed++) {
      const w = { ...earn(newWallet(0), 900, "capture", 0), chips: 1 };
      const items = botShop(mulberry32(seed), w, true);
      expect(items.filter((it) => it === "chip").length).toBeLessThanOrEqual(M.items.chip.cap - 1);
    }
  });
});

describe("Mercenary: the Stockfish token", () => {
  it("is used on your own decision this half, paid at once; one each a half (not after moving, not with none left)", () => {
    const m = applyKits(relay(), [kit({ stockfish: 1 }), NO_ITEMS]);
    const mover = moverOn(m, 0);
    const other = moverOn(m, 1);
    const r = useStockfish(m, NO_INPUTS, mover, 500);
    if ("error" in r) throw new Error(r.error);
    expect(stockfishNow(m, r.inputs, 0)).toBe(0);
    expect(useStockfish(m, r.inputs, mover, 600)).toEqual({ error: "shown" });
    // Side 1 has none.
    expect(useStockfish(m, NO_INPUTS, other, 500)).toEqual({ error: "no_tokens" });
    // Not after your move, nor without a duty.
    const moved = inputs(m, { [mover]: "e2e4" });
    expect(useStockfish(m, moved, mover, 500)).toEqual({ error: "already_moved" });
    expect(useStockfish(m, NO_INPUTS, "nobody", 500)).toEqual({ error: "no_duty" });
  });

  it("shows only your own position and moves: your side to move, never theirs", () => {
    for (const m of [applyKits(relay(), [kit({ stockfish: 2 }), kit({ stockfish: 2 })]), applyKits(pairs(), [kit({ stockfish: 2 }), kit({ stockfish: 2 })]), applyKits(final(), [kit({ stockfish: 2 }), kit({ stockfish: 2 })])]) {
      for (const d of halfDuties(m).duties) {
        const r = useStockfish(m, NO_INPUTS, d.players[0]!, 0);
        if ("error" in r) throw new Error(r.error);
        const colour = r.use.fen.split(" ")[1];
        const board = m.boards[d.board]!;
        // The position the lines are for has the user's own colour to move.
        expect(colour).toBe(board.white === d.side ? "w" : "b");
        expect(r.use.fen).toBe(board.fen);
      }
      // The other squad (not to move here) can't use one at all this half.
      const waiting = m.sides.flatMap((x) => x.seats).filter((p) => !halfDuties(m).duties.some((d) => d.players.includes(p)));
      for (const p of waiting) expect(useStockfish(m, NO_INPUTS, p, 0)).toEqual({ error: "no_duty" });
    }
  });

  it("its lines are your top moves with their evaluations, blocked moves out, and nothing of their reply", () => {
    const top: MoveScore[] = [
      { move: "e2e4", expected: 0.55, reply: "e7e5" },
      { move: "d2d4", expected: 0.56, reply: "d7d5" },
      { move: "g1f3", expected: 0.54, reply: "g8f6" },
      { move: "c2c4", expected: 0.53, reply: "e7e5" },
      { move: "a2a3", expected: 0.4, mate: undefined },
    ];
    const lines = tokenLines(top, ["d2d4"]);
    expect(lines).toEqual([
      { move: "e2e4", expected: 0.55 },
      { move: "g1f3", expected: 0.54 },
      { move: "c2c4", expected: 0.53 },
    ]);
    expect(lines.every((l) => !("reply" in l))).toBe(true);
    expect(lines).toHaveLength(M.stockfish.lines);
  });

  it("Pairs: shown to the partner who used it only; the final: to the whole squad (one is enough)", () => {
    const p = applyKits(pairs(), [kit({ stockfish: 2 }), NO_ITEMS]);
    const duty = halfDuties(p).duties.find((d) => d.side === 0)!;
    const r = useStockfish(p, NO_INPUTS, duty.players[0]!, 0);
    if ("error" in r) throw new Error(r.error);
    expect(r.use.shownTo).toEqual([duty.players[0]]);
    // The partner may use the squad's other token (shown to them).
    const r2 = useStockfish(p, r.inputs, duty.players[1]!, 0);
    if ("error" in r2) throw new Error(r2.error);
    expect(r2.use.shownTo).toEqual([duty.players[1]]);
    const f = applyKits(final(), [kit({ stockfish: 2 }), NO_ITEMS]);
    const v = useStockfish(f, NO_INPUTS, "a2", 0);
    if ("error" in v) throw new Error(v.error);
    expect(v.use.shownTo).toEqual(["a0", "a1", "a2", "a3"]);
    expect(useStockfish(f, v.inputs, "a0", 0)).toEqual({ error: "shown" });
    expect(assistShownTo("relay", { players: ["x"] }, "x")).toEqual(["x"]);
  });

  it("the half logs it: who used it and whose choices were made with its lines (sanctioned help)", () => {
    const m = applyKits(final(MIDDLE), [kit({ stockfish: 1 }), NO_ITEMS]);
    const r = useStockfish(m, NO_INPUTS, "a1", 300);
    if ("error" in r) throw new Error(r.error);
    const out = resolveHalf(m, inputs(m, { a0: "a2a3", a1: "a2a3", a2: "h2h3", a3: "a2a3" }, r.inputs));
    expect(out.match.stockfish).toEqual([0, 0]);
    expect(out.match.assists).toMatchObject([{ turn: 0, half: "w", board: 0, side: 0, by: "a1", shownTo: ["a0", "a1", "a2", "a3"] }]);
    expect(ofKind(out.events, "vote")[0]!.assisted).toEqual(["a0", "a1", "a2", "a3"]);
    for (const p of ["a0", "a1", "a2", "a3"]) expect(isAssisted(out.match, p, 0, "w", 0)).toBe(true);
    expect(isAssisted(out.match, "b0", 0, "w", 0)).toBe(false);
    // Never brilliant: every finder saw the lines.
    expect(out.brilliant).toEqual([]);
  });
});

describe("Mercenary: fair play leaves token-assisted moves out", () => {
  const move = (o: Partial<FairMove> = {}): FairMove => ({
    ply: 30,
    fen: MIDDLE,
    move: "a2a3",
    best: "a2a3",
    loss: 0,
    bestExp: 0.6,
    near: 1,
    gap: 4,
    crowd: 10,
    crowdFound: 1,
    thinkMs: 4000,
    away: 0,
    legal: 30,
    ...o,
  });

  it("a move played with a Stockfish token is never counted: no strength, no hard finds, no points", () => {
    expect(skipReason(move())).toBeNull();
    expect(skipReason(move({ engineToken: true }))).toBe("engineToken");
    const honest = Array.from({ length: 12 }, (_, i) => move({ ply: 20 + i, engineToken: true }));
    const s = matchSignals(honest, 1500);
    expect(s.counted).toBe(0);
    expect(s.score).toBe(0);
  });

  it("only the moves on whose screen the lines were count as assisted: the other squad's and other halves' don't", () => {
    const m = applyKits(pairs([MIDDLE, MIDDLE]), [kit({ stockfish: 1 }), NO_ITEMS]);
    const duty = halfDuties(m).duties.find((d) => d.side === 0)!;
    const r = useStockfish(m, NO_INPUTS, duty.players[0]!, 0);
    if ("error" in r) throw new Error(r.error);
    const picks = Object.fromEntries(halfDuties(m).duties.flatMap((d) => d.players.map((p, i) => [p, i === 0 ? "a2a3" : "h2h3"])));
    const out = resolveHalf(m, inputs(m, picks, r.inputs));
    expect(isAssisted(out.match, duty.players[0]!, 0, "w", duty.board)).toBe(true);
    expect(isAssisted(out.match, duty.players[1]!, 0, "w", duty.board)).toBe(false);
    expect(isAssisted(out.match, duty.players[0]!, 1, "w", duty.board)).toBe(false);
    const e = ofKind(out.events, "pair").find((x) => x.board === duty.board)!;
    expect(e.assisted).toEqual([duty.players[0]]);
    // The brilliant check never credits the assisted pick.
    for (const c of out.brilliant) expect(c.finders).not.toContain(duty.players[0]);
  });
});

describe("Mercenary: bots", () => {
  const wallet = (coins: number) => earn(newWallet(0), coins, "capture", 0);

  it("shop sensibly, not perfectly: within the wallet and the caps, sometimes saving before the final, spending in it", () => {
    let saved = 0;
    const counts = Object.fromEntries(MERC_ITEMS.map((it) => [it, 0])) as Record<string, number>;
    for (let seed = 1; seed <= 300; seed++) {
      const w = wallet(650);
      const items = botShop(mulberry32(seed), w, false);
      if (!items.length) saved++;
      let x = w;
      for (const it of items) {
        const r = buyItem(x, it);
        if ("error" in r) throw new Error(`seed ${seed}: ${it} ${r.error}`);
        x = r.wallet;
        counts[it]!++;
      }
      expect(x.coins).toBeGreaterThanOrEqual(Math.floor(650 * (1 - M.bots.spend[1])) - 1);
      for (const it of MERC_ITEMS) expect(x.cart[it]).toBeLessThanOrEqual(M.items[it].cap);
    }
    expect(saved / 300).toBeGreaterThan(M.bots.saveChance - 0.08);
    expect(saved / 300).toBeLessThan(M.bots.saveChance + 0.08);
    // Blocks and chips most; a Stockfish token now and then.
    expect(counts.blocks!).toBeGreaterThan(counts.stockfish!);
    expect(counts.chip!).toBeGreaterThan(counts.stockfish!);
    expect(counts.stockfish!).toBeGreaterThan(0);
    // The final: never saving; spending until nothing more fits.
    for (let seed = 1; seed <= 50; seed++) {
      const items = botShop(mulberry32(seed), wallet(400), true);
      expect(items.length).toBeGreaterThan(0);
    }
    expect(botShop(mulberry32(1), wallet(10), true)).toEqual([]);
  });

  it("use a Stockfish token rarely: more often when the engine's best stands out", () => {
    const flat: MoveScore[] = [
      { move: "e2e4", expected: 0.55 },
      { move: "d2d4", expected: 0.54 },
    ];
    const sharp: MoveScore[] = [
      { move: "e2e4", expected: 0.8 },
      { move: "d2d4", expected: 0.8 - M.bots.sharpGap },
    ];
    const rate = (top: MoveScore[]) => Array.from({ length: 2000 }, (_, i) => botUsesStockfish(mulberry32(i + 1), top)).filter(Boolean).length / 2000;
    expect(rate(flat)).toBeLessThan(M.bots.stockfishChance + 0.03);
    expect(rate(sharp)).toBeGreaterThan(M.bots.stockfishSharp - 0.05);
    expect(rate(sharp)).toBeLessThan(M.bots.stockfishSharp + 0.05);
  });

  it("the shop's ranking: the Stockfish token dearest (Eric: 200), then block points and shields, the Time chip cheapest", () => {
    const p = M.items;
    expect(p.stockfish.price).toBe(200);
    expect(p.stockfish.price).toBeGreaterThan(p.blocks.price);
    expect(p.blocks.price).toBe(p.shield.price);
    expect(p.shield.price).toBeGreaterThan(p.chip.price);
    expect(p.stockfish.cap).toBeLessThanOrEqual(2);
  });

  it("the duty a token is used on is the user's own (dutyOf)", () => {
    const m = applyKits(relay(), [kit({ stockfish: 1 }), NO_ITEMS]);
    const mover = moverOn(m, 0);
    const r = useStockfish(m, NO_INPUTS, mover, 0);
    if ("error" in r) throw new Error(r.error);
    expect(r.use.board).toBe(dutyOf(m, mover)!.duty.board);
  });
});
