import { describe, expect, it } from "vitest";
import type { NetDuty, NetSquadsLobby, NetSquadsHalf, NetTeamClock, SquadsBlock, TokenUse } from "@chessroyale/chess/squads";
import { START_FEN, applyMove, inCheck } from "@chessroyale/chess";
import {
  SQUAD_NAMES,
  bankText,
  cheatArrows,
  cheatEval,
  cheatLinesAt,
  blockBankNow,
  blockCheatFen,
  blockName,
  blocksShown,
  drainRate,
  dutyOf,
  liveBank,
  tokenWords,
  movesOfHalf,
  myBoards,
  points,
  shownMatches,
  squadClocks,
  standingLine,
  standingsOrder,
  canUseStockfish,
  coinText,
  freeMs,
  itemText,
  myAssist,
  shopRows,
  stockfishLeft,
  canTapChip,
  chipLeftMs,
  chipsLeft,
  type LocalMatch,
} from "../src/squads-view.ts";
import { SQUADS } from "@chessroyale/core";
import { SquadsClient } from "../src/squads.ts";

/** A match as the client keeps it: two squads of four, `boards` boards, a half begun at t=0. */
function match(over: Partial<LocalMatch> = {}, boards = 4): LocalMatch {
  return {
    key: "r0m0",
    round: 0,
    index: 0,
    format: boards === 4 ? "relay" : boards === 2 ? "pairs" : "final",
    armageddon: false,
    sides: [
      { squadId: 0, seats: ["a0", "a1", "a2", "a3"] },
      { squadId: 1, seats: ["b0", "b1", "b2", "b3"] },
    ],
    boards: Array.from({ length: boards }, (_, i) => ({ id: i, startFen: START_FEN, openingId: null, fen: START_FEN, moves: [], ply: 0, lastMove: null, white: (i % 2) as 0 | 1, result: null })),
    turn: 0,
    half: "w",
    banks: [60_000, 60_000],
    delayMs: 3000,
    incrementMs: 0,
    tokens: boards === 2 ? [5, 5] : null,
    blockBanks: [5, 5],
    blocks: [],
    tokenLog: [],
    mode: "classic",
    kit: null,
    stockfish: [0, 0],
    shields: [0, 0],
    chips: [0, 0],
    assists: [],
    coins: [0, 0],
    assisting: [],
    state: "half",
    startsAt: null,
    current: null,
    result: null,
    visible: {},
    locked: [],
    lockedAt: {},
    choiceAt: {},
    placed: [],
    blockAt: {},
    last: null,
    ...over,
  };
}

const duty = (board: number, side: 0 | 1, players: string[], role: NetDuty["role"] = "move", deadline = 20_000): NetDuty => ({ board, side, role, players, deadline });
const half = (duties: NetDuty[], chips: NetSquadsHalf["chips"] = []): NetSquadsHalf => ({ seq: 0, turn: 0, half: "w", startedAt: 0, duties, scouts: [], forced: [], chips });

describe("Squads screens: the team clock as the screen runs it", () => {
  it("drains past the free seconds, once for each move being thought about (twice as fast with two)", () => {
    const m = match({ current: half([duty(0, 0, ["a0"]), duty(2, 0, ["a2"]), duty(1, 1, ["b1"])]) });
    // Within the free seconds: nothing drains.
    expect(liveBank(m, 0, 2000)).toBe(60_000);
    expect(drainRate(m, 0, 2000)).toBe(0);
    // At 5 s: side 0's two movers have each drained 2 s; side 1's one mover 2 s.
    expect(liveBank(m, 0, 5000)).toBe(56_000);
    expect(liveBank(m, 1, 5000)).toBe(58_000);
    expect(drainRate(m, 0, 5000)).toBe(2);
    expect(drainRate(m, 1, 5000)).toBe(1);
  });

  it("a move locked in stops draining when it was locked (the final's vote: when its last picker locked); the other squad's stands still", () => {
    const m = match({ current: half([duty(0, 0, ["a0", "a1", "a2", "a3"], "pick")]), locked: ["a0", "a1", "a2", "a3"], lockedAt: { a0: 4000, a1: 6000, a2: 2000, a3: 5000 } }, 1);
    // The squad's slowest picker locked at 6 s: 3 s drained, then still.
    expect(liveBank(m, 0, 10_000)).toBe(57_000);
    expect(drainRate(m, 0, 10_000)).toBe(0);
    expect(liveBank(m, 1, 10_000)).toBe(60_000);
    // Still voting: it drains.
    const voting = { ...m, locked: ["a0"] };
    expect(drainRate(voting, 0, 10_000)).toBe(1);
    expect(dutyOf(voting, "a2")).toMatchObject({ partner: null, team: ["a0", "a1", "a3"] });
  });

  it("stops at zero (sudden death), and in sudden death shows zero", () => {
    const m = match({ banks: [4000, 0], current: half([duty(0, 0, ["a0"]), duty(1, 1, ["b1"], "move", 3000)]) });
    expect(liveBank(m, 0, 10_000)).toBe(0);
    expect(liveBank(m, 1, 1000)).toBe(0);
    expect(drainRate(m, 1, 5000)).toBe(0);
    const clocks: NetTeamClock[] = [0, 1, 2].map((squadId) => ({ squadId, bankMs: 50_000, suddenDeath: false, key: null, since: null }));
    const shown = squadClocks(clocks, [m], 10_000);
    expect(shown.map((c) => [c.squadId, c.bankMs, c.suddenDeath])).toEqual([
      [0, 0, true],
      [1, 0, true],
      [2, 50_000, false],
    ]);
  });

  it("between halves the bank stands still", () => {
    const m = match({ state: "show", banks: [41_000, 39_500] });
    expect(liveBank(m, 0, 99_999)).toBe(41_000);
    expect(drainRate(m, 1, 99_999)).toBe(0);
  });
});

describe("Squads screens: YOU and NEXT", () => {
  it("Relay: one board along each turn", () => {
    const m = match();
    expect(myBoards(m, "a0")).toEqual({ you: 0, next: 1 });
    expect(myBoards({ ...m, turn: 3 }, "b2")).toEqual({ you: 1, next: 2 });
    expect(myBoards(m, "spectator")).toBeNull();
  });

  it("Pairs: your pair's slot this turn and next (player 1's pair alternates)", () => {
    const m = match({}, 2);
    // Turn 0: 1+2 play board 1, 3+4 board 2; turn 1: 2+4 on board 1, 1+3 on board 2.
    expect(myBoards(m, "a0")).toEqual({ you: 0, next: 1 });
    expect(myBoards(m, "a3")).toEqual({ you: 1, next: 0 });
  });

  it("the final: its one board, no next", () => {
    expect(myBoards(match({}, 1), "b1")).toEqual({ you: 0, next: null });
  });
});

describe("Squads screens: words and numbers", () => {
  it("bank and points", () => {
    expect(bankText(185_400)).toBe("3:05");
    expect(bankText(9_440)).toBe("9.4");
    expect(bankText(-5)).toBe("0.0");
    expect(points(2.5)).toBe("2½");
    expect(points(0.5)).toBe("½");
    expect(points(0)).toBe("0");
  });

  it("every squad has a short name", () => {
    expect(SQUAD_NAMES).toHaveLength(8);
    expect(new Set(SQUAD_NAMES).size).toBe(8);
    for (const n of SQUAD_NAMES) expect(n.length).toBeLessThanOrEqual(7);
  });

  it("where each squad stands, best placed first", () => {
    const lobby = {
      phase: "bracket",
      squads: [
        { id: 0, seats: [], placement: 5 },
        { id: 1, seats: [], placement: null },
        { id: 2, seats: [], placement: null },
        { id: 3, seats: [], placement: 1 },
      ],
      bracket: [
        { key: "r0m0", round: 0, index: 0, format: "relay", squads: [0, 1], winner: 1, state: "over" },
        { key: "r1m0", round: 1, index: 0, format: "pairs", squads: [1, 2], winner: null, state: "playing" },
      ],
    } as unknown as NetSquadsLobby;
    expect(standingLine(lobby, 0)).toBe("Out · 5th–8th");
    expect(standingLine(lobby, 1)).toBe("Round 2 · v Bishops");
    expect(standingLine(lobby, 3)).toBe("Champions");
    expect(standingsOrder(lobby)).toEqual([3, 1, 2, 0]);
  });

  it("the tiny boards: live matches and the latest round's finished ones", () => {
    const a = match({ key: "r0m0", state: "over" });
    const b = match({ key: "r0m1", index: 1 });
    const c = match({ key: "r1m0", round: 1, state: "break" }, 2);
    expect(shownMatches([a, b]).map((m) => m.key)).toEqual(["r0m0", "r0m1"]);
    expect(shownMatches([a, b, c]).map((m) => m.key)).toEqual(["r0m1", "r1m0"]);
  });

  it("a half's moves, board by board", () => {
    const events = [
      { kind: "relay", turn: 0, half: "w", board: 0, side: 0, player: "a0", move: "e2e4", missed: false },
      { kind: "forced", turn: 0, half: "w", board: 1, side: 1, move: "e1f1" },
      { kind: "bank", turn: 0, half: "w", side: 0, drainedMs: 1, leftMs: 2, suddenDeath: false },
    ] as const;
    expect(movesOfHalf(events as never, 0)).toEqual(["e2e4"]);
    expect(movesOfHalf(events as never, 1)).toEqual(["e1f1"]);
    expect(movesOfHalf(events as never, 2)).toEqual([]);
  });
});

describe("Squads v2 on screen: blocks and tokens", () => {
  const blk = (o: Partial<SquadsBlock> = {}): SquadsBlock => ({ board: 0, side: 0, by: "a0", move: "g8f6", piece: "n", cost: 2, ...o });

  it("each squad's block bank now: the match's, less this half's blocks (paid at once); both squads see both", () => {
    const m = match({ placed: [blk(), blk({ move: "e7e5", piece: "p", cost: 1 }), blk({ board: 1, side: 1, move: "e2e4", piece: "p", cost: 1 })] });
    expect(blockBankNow(m, 0)).toBe(2);
    expect(blockBankNow(m, 1)).toBe(4);
  });

  it("the blocks on a board: in effect this half and placed this half, until the other squad has moved", () => {
    const inEffect = blk({ board: 2, side: 1, move: "d2d4", piece: "p", cost: 1 });
    const m = match({ blocks: [inEffect], placed: [blk({ board: 2, move: "b8c6" }), blk({ board: 3 })] });
    expect(blocksShown(m, 2).map((b) => b.move)).toEqual(["d2d4", "b8c6"]);
    expect(blocksShown(m, 0)).toEqual([]);
  });

  it("a blocked move in a few characters", () => {
    expect(blockName(blk())).toBe("Ng8–f6");
    expect(blockName(blk({ move: "e7e5", piece: "p" }))).toBe("e7–e5");
    expect(blockName(blk({ move: "e8g8", piece: "k" }))).toBe("O-O");
    expect(blockName(blk({ move: "e1c1", piece: "k" }))).toBe("O-O-O");
  });

  it("cheat lines while blocking: the other squad's moves after yours, or with none yet, the move handed over", () => {
    expect(blockCheatFen(START_FEN, "e2e4", applyMove, inCheck)).toBe(applyMove(START_FEN, "e2e4"));
    expect(blockCheatFen(START_FEN, null, applyMove, inCheck)!.split(" ").slice(0, 4)).toEqual([START_FEN.split(" ")[0], "b", "KQkq", "-"]);
    // In check, the move can't be handed over: no lines until you've picked.
    expect(blockCheatFen("4k3/8/8/8/8/8/4q3/4K3 w - - 0 1", null, applyMove, inCheck)).toBeNull();
  });

  it("the post-match token breakdown: every use, refunded or not, why, with numbers", () => {
    const use = (verdict: TokenUse["verdict"], move = "e2e4"): TokenUse => ({ turn: 0, half: "w", board: 0, side: 0, players: ["a0", "a1"], move, fen: START_FEN, blocked: [], verdict });
    expect(tokenWords(use({ refunded: true, why: "only_move", rival: "d2d4", pawns: 2.1 }))).toBe("e4: refunded, every other move lost at least 2.1 pawns");
    expect(tokenWords(use({ refunded: false, why: "close", rival: "g1f3", pawns: 0.3 }))).toBe("e4: not refunded, Nf3 was within 0.3");
    expect(tokenWords(use({ refunded: false, why: "close", rival: "g1f3", pawns: 0 }))).toBe("e4: not refunded, Nf3 was just as good");
    expect(tokenWords(use({ refunded: false, why: "close", rival: "g1f3", pawns: 0, mate: true }))).toBe("e4: not refunded, Nf3 mates too");
    expect(tokenWords(use({ refunded: false, why: "better", rival: "g1f3", pawns: 0.6 }))).toBe("e4: not refunded, Nf3 was better by 0.6 pawns");
    expect(tokenWords(use({ refunded: false, why: "better", rival: "g1f3", pawns: 1, atLeast: true }))).toBe("e4: not refunded, Nf3 was better by at least 1.0 pawn");
    expect(tokenWords(use({ refunded: false, why: "no_judge" }))).toBe("e4: not refunded, no device could judge it");
    expect(tokenWords(use({ refunded: false, why: "unranked" }))).toBe("e4: not refunded, the judge couldn't rank the other moves");
    expect(tokenWords(use(null))).toBe("e4: waiting for the judge");
  });
});

describe("cheat lines (test controls only)", () => {
  const fen = START_FEN;
  it("only a test player gets them, and only while choosing (a move, a pick, a block, Armageddon's colors)", () => {
    for (const choosing of [true, false]) for (const colourChoice of [true, false]) expect(cheatLinesAt(false, { choosing, colourChoice, fen })).toBeNull();
    expect(cheatLinesAt(true, { choosing: true, colourChoice: false, fen })).toBe(fen);
    expect(cheatLinesAt(true, { choosing: false, colourChoice: true, fen })).toBe(fen);
    expect(cheatLinesAt(true, { choosing: false, colourChoice: false, fen })).toBeNull();
  });

  it("a player's switch never turns on; a test player's toggles until switched off", () => {
    const player = new SquadsClient("ABCDE");
    player.toggleCheatLines();
    expect(player.cheatLines).toBe(false);
    const eric = new SquadsClient("ABCDE");
    eric.test = true;
    eric.toggleCheatLines();
    expect(eric.cheatLines).toBe(true);
    eric.toggleCheatLines();
    expect(eric.cheatLines).toBe(false);
  });

  it("draws the top 3 as arrows colored by rank, each labeled with its evaluation for the side to move", () => {
    expect(cheatEval({ expected: 0.5 })).toBe("0.0");
    expect(cheatEval({ expected: 0.75 })).toBe("+1.0");
    expect(cheatEval({ expected: 0.25 })).toBe("−1.0");
    expect(cheatEval({ expected: 1, mate: 3 })).toBe("#3");
    expect(cheatEval({ expected: 0, mate: -2 })).toBe("#-2");
    const arrows = cheatArrows([
      { move: "e2e4", expected: 0.6 },
      { move: "d2d4", expected: 0.58 },
      { move: "g1f3", expected: 0.55 },
      { move: "a2a3", expected: 0.4 },
    ]);
    expect(arrows.map((a) => [a.move, a.brush])).toEqual([
      ["e2e4", "green"],
      ["d2d4", "blue"],
      ["g1f3", "yellow"],
    ]);
    expect(arrows.every((a) => /^[+−]\d\.\d$/.test(a.label!))).toBe(true);
  });
});

describe("Mercenary on screen", () => {
  const M = SQUADS.mercenary;
  const none = { stockfish: 0, blocks: 0, shield: 0, chip: 0 };

  it("the shop's rows: strongest first, the price now (risen for each bought), the cart against the round's cap, why not", () => {
    const rows = shopRows({ coins: 260, bought: { ...none, shield: 1 }, cart: { ...none, shield: 1, chip: 1 }, chips: M.items.chip.cap - 1 });
    expect(rows.map((r) => r.item)).toEqual(["stockfish", "blocks", "shield", "chip"]);
    const by = Object.fromEntries(rows.map((r) => [r.item, r]));
    expect(by.shield).toMatchObject({ price: M.items.shield.price + M.priceStep, count: 1, cap: M.items.shield.cap, bought: 1 });
    // Time chips: those held and in the cart against what a squad may hold; "−" only for the cart's.
    expect(by.chip).toMatchObject({ count: M.items.chip.cap, inCart: 1, can: false, why: "cap" });
    expect(by.stockfish).toMatchObject({ can: M.items.stockfish.price <= 260, why: M.items.stockfish.price <= 260 ? null : "coins" });
    expect(by.blocks!.can).toBe(true);
  });

  it("every item's words carry its numbers from settings", () => {
    expect(itemText("chip").name).toBe("Time chip");
    expect(itemText("chip").line).toContain(`+${M.chipSeconds}\u00a0s for that move`);
    expect(itemText("chip").line).toContain(`hold ${M.items.chip.cap}`);
    expect(itemText("blocks").line).toContain(`+${M.blockPoints} block points`);
    expect(itemText("stockfish").line).toContain(`top ${M.stockfish.lines} moves`);
    expect(itemText("stockfish").line).toContain("Never theirs");
    expect(coinText(12345)).toBe("12,345");
  });

  it("the Stockfish token: usable on your own decision with one left; the lines show to whoever they're shown to", () => {
    const m = match({ mode: "mercenary", stockfish: [1, 0], current: half([duty(0, 0, ["a0"]), duty(1, 1, ["b1"])]) });
    expect(canUseStockfish(m, "a0")).toBe(true);
    expect(canUseStockfish(m, "b1")).toBe(false);
    expect(canUseStockfish(m, "a3")).toBe(false);
    expect(canUseStockfish({ ...m, mode: "classic" }, "a0")).toBe(false);
    expect(canUseStockfish({ ...m, visible: { a0: "e2e4" } }, "a0")).toBe(false);
    const use = { turn: 0, half: "w" as const, board: 0, side: 0 as const, by: "a0", fen: START_FEN, shownTo: ["a0"] };
    const used = { ...m, assisting: [use] };
    expect(stockfishLeft(used, 0)).toBe(0);
    expect(myAssist(used, 0, "a0")).toEqual(use);
    expect(myAssist(used, 0, "a1")).toBeNull();
    expect(canUseStockfish(used, "a0")).toBe(false);
  });

  it("the free seconds are the match's, the same for both squads (no Breather since Oct 13)", () => {
    const m = match({ mode: "mercenary" });
    expect(freeMs(m)).toBe(3000);
    // The bank drains past the free seconds: 5 s thinking drains 2 s on each side.
    const live = { ...m, current: half([duty(0, 0, ["a0"]), duty(1, 1, ["b1"])]) };
    expect(liveBank(live, 0, 5000)).toBe(58_000);
    expect(liveBank(live, 1, 5000)).toBe(58_000);
    expect(itemText("stockfish").name).toBe("Stockfish token");
    expect(shopRows({ coins: 0, bought: none, cart: none }).map((r) => itemText(r.item).name)).toEqual(["Stockfish token", "Block points", "Shield", "Time chip"]);
  });

  it("a Time chip on screen: its squad's clock jumps (20 s becomes 50) and stands still while the chip's time runs; both squads' counts", () => {
    const chip = M.chipSeconds * 1000;
    const m = match({ mode: "mercenary", banks: [20_000, 60_000], chips: [2, 1], current: half([duty(0, 0, ["a0"], "move", 20_000 + chip), duty(1, 1, ["b1"], "move", 20_000)], [{ board: 0, by: "a0", at: 5_000 }]) });
    // (The chip's move: its deadline 30 s later, as the server's "chip" says.)
    // At 5 s (just tapped): 20 s less the 2 s drained, and the chip's 30 s on top.
    expect(liveBank(m, 0, 5_000)).toBe(18_000);
    expect(chipLeftMs(m, 0, 5_000)).toBe(chip);
    // At 20 s: the bank hasn't moved since the tap, the chip has 15 s left; the other squad's bank ran on.
    expect(liveBank(m, 0, 20_000)).toBe(18_000);
    expect(chipLeftMs(m, 0, 20_000)).toBe(15_000);
    expect(drainRate(m, 0, 20_000)).toBe(0);
    expect(liveBank(m, 1, 20_000)).toBe(60_000 - 17_000);
    // After the chip (35 s): the bank drains again.
    expect(liveBank(m, 0, 40_000)).toBe(13_000);
    expect(chipLeftMs(m, 0, 40_000)).toBe(0);
    // Both squads' counts: what each has left this half.
    expect([chipsLeft(m, 0), chipsLeft(m, 1)]).toEqual([1, 1]);
    // The move made: the chip's time left is lost (the clock shows the bank).
    expect(chipLeftMs({ ...m, locked: ["a0"] }, 0, 20_000)).toBe(0);
  });

  it("who may tap a Time chip: the player on the move being thought about, with one left, before its time is up", () => {
    const m = match({ mode: "mercenary", chips: [1, 0], current: half([duty(0, 0, ["a0"]), duty(1, 1, ["b1"])]) });
    expect(canTapChip(m, "a0", 1_000)).toBe(true);
    expect(canTapChip(m, "b1", 1_000)).toBe(false);
    expect(canTapChip(m, "a1", 1_000)).toBe(false);
    expect(canTapChip(m, "a0", 20_000)).toBe(false);
    expect(canTapChip({ ...m, visible: { a0: "e2e4" } }, "a0", 1_000)).toBe(false);
    expect(canTapChip({ ...m, mode: "classic" }, "a0", 1_000)).toBe(false);
    expect(canTapChip({ ...m, current: half(m.current!.duties, [{ board: 0, by: "a0", at: 500 }]) }, "a0", 1_000)).toBe(false);
  });
});
