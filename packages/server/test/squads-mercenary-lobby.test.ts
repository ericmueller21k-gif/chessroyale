import { beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY, type MercItem } from "@chessroyale/core";
import { MERC_ITEMS, NO_ITEMS, blockTargets, catchUpCoins, checkBlock, dutyDeadline, halfDuties, itemPrice, piecesOf, squadsLegalMoves, squadsVotes, type BrilliantCandidate, type NetWallet, type SquadsEvent } from "@chessroyale/chess/squads";
import { SquadsCore, clearTopCache, testLobbyOptions, type LiveMatch } from "../src/squads-lobby.ts";
import { library } from "./squads-fixture.ts";
import { squadsLobby } from "./squads-fixture.ts";

/**
 * Squads' modes on the server (Eric, Oct 12): the Mode vote, and Mercenary's wallets (everyone sees every squad's),
 * coins from each half, the team shop open while a squad waits for its next match (one shared wallet, purchases live
 * to the squad, caps, closed once the match starts), the kit coming in as it starts, catch-up, the Stockfish token and
 * the shield through the server, and the bots' shopping, over a whole bot lobby.
 */

const M = SQUADS.mercenary;
const VOTE_MS = (SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000;
const mineIn = (lm: LiveMatch, id: string) => lm.m.sides.some((x) => x.seats.includes(id));
const ofKind = <K extends SquadsEvent["kind"]>(events: readonly SquadsEvent[], kind: K) => events.filter((e): e is Extract<SquadsEvent, { kind: K }> => e.kind === kind);
/** What a squad has spent: every item it has bought this tournament at the price it was then. */
const spentOf = (w: Pick<NetWallet, "bought">) => MERC_ITEMS.reduce((t, it) => t + Array.from({ length: w.bought[it] }, (_, i) => itemPrice(it, i)).reduce((a, b) => a + b, 0), 0);

beforeEach(() => clearTopCache());

describe("squads modes on the server: the Mode vote", () => {
  it("a test lobby holds the Mode vote first, its bots sitting it out: its opener's vote decides (Coming soon refused)", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 0 });
    const eric = L.join("Eric", { test: true });
    L.advance(FRONT_DOOR.fillShowMs);
    const vote = L.last(eric, "vote")!.vote;
    expect(vote).toMatchObject({ id: "mode", index: 0, count: squadsVotes().length });
    expect(vote.votes).toEqual([]);
    L.core.message(eric, { t: "vote", key: vote.key, option: 2 });
    expect(L.last(eric, "voteCast")).toBeUndefined();
    L.core.message(eric, { t: "vote", key: vote.key, option: 1 });
    expect(L.last(eric, "voteCast")).toMatchObject({ option: 1 });
    L.advance(VOTE_MS);
    expect(L.last(eric, "vote")!.vote.id).toBe("start");
    L.advance(2 * VOTE_MS);
    expect(L.core.record.rules?.mode).toBe("mercenary");
    expect(L.last(eric, "lobby")!.lobby.wallets).toHaveLength(SQUADS.squadCount);
  });

  it("nobody voting is Classic: no wallets, no blocks", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 0 });
    const eric = L.join("Eric", { test: true });
    L.advance(FRONT_DOOR.fillShowMs + 3 * VOTE_MS + 1);
    expect(L.core.record.rules?.mode).toBe("classic");
    const lobby = L.last(eric, "lobby")!.lobby;
    expect(lobby.wallets).toEqual([]);
    expect(L.all(eric, "match").every((m) => m.match.mode === "classic" && m.match.blockBanks.every((b) => b === 0))).toBe(true);
  });

  it("a test lobby's link sets the mode (mode=mercenary|classic) and bots that block whenever they can (bots=blocks)", () => {
    expect(testLobbyOptions(new URLSearchParams("start=pairs&mode=mercenary&bots=strong,blocks"), 0).test).toEqual({ start: 1, mode: "mercenary", strong: true, blocks: true });
    expect(testLobbyOptions(new URLSearchParams("mode=classic&bots=blocks"), 0).test).toEqual({ start: 0, mode: "classic", blocks: true });
  });

  it("a test lobby's mode=mercenary holds no Mode vote: Start first", () => {
    const L = squadsLobby({ test: { start: 0, mode: "mercenary" }, fillInMs: 0 });
    const eric = L.join("Eric", { test: true });
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.last(eric, "vote")!.vote).toMatchObject({ id: "start", index: 0, count: 2 });
  });
});

/** A Mercenary test lobby at Pairs: a party of 4 in one squad, a solo person; every squad still in has a test wallet. */
function pairsLobby(seed = 7) {
  const L = squadsLobby({ seed, test: { start: 1, mode: "mercenary" }, fillInMs: 5_000 });
  L.core.reserve([{ size: 4, pass: "four" }], 60_000);
  const party = ["A", "B", "C", "D"].map((n) => L.join(n, { party: "four" }));
  const solo = L.join("Sol");
  L.advance(5_000 + FRONT_DOOR.fillShowMs + 2 * VOTE_MS + 1);
  const lm = L.core.allMatches().find((m) => mineIn(m, party[0]!))!;
  const squad = L.core.record.squads.find((sq) => sq.players.some((p) => p.id === party[0]))!.id;
  return { L, party, solo, lm, squad };
}

describe("Mercenary on the server: the shop", () => {
  it("opens for the squads still in until their match starts; everyone sees every wallet", () => {
    const { L, party, solo, lm, squad } = pairsLobby();
    expect(lm.state).toBe("break");
    const wallets = L.last(solo, "lobby")!.lobby.wallets;
    const mine = wallets.find((w) => w.squadId === squad)!;
    expect(mine).toMatchObject({ coins: M.testWallet, earned: 0, shop: { round: 1, until: lm.startsAt } });
    // The squads knocked out by the skip: no shop.
    const out = L.core.record.squads.filter((sq) => !L.core.allMatches().some((m) => m.m.sides.some((x) => x.squadId === sq.id)));
    for (const sq of out) expect(wallets.find((w) => w.squadId === sq.id)!.shop).toBeNull();
    // (The solo person sees the party's wallet too.)
    expect(L.last(party[0]!, "lobby")!.lobby.wallets).toEqual(wallets);
  });

  it("one shared wallet: two teammates buy, everyone sees it, only the squad hears who; caps, coins, putting one back", () => {
    const { L, party, solo, squad } = pairsLobby();
    L.clear();
    L.core.message(party[0]!, { t: "buy", item: "shield" });
    L.core.message(party[1]!, { t: "buy", item: "chip" });
    const w = L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!;
    expect(w.coins).toBe(M.testWallet - M.items.shield.price - M.items.chip.price);
    expect(w.cart).toMatchObject({ shield: 1, chip: 1 });
    // Who bought what, live to the squad (all four), not to the other squads.
    for (const p of party) expect(L.all(p, "bought").map((b) => [b.by, b.item, b.price])).toEqual([
      [party[0], "shield", M.items.shield.price],
      [party[1], "chip", M.items.chip.price],
    ]);
    expect(L.all(solo, "bought")).toEqual([]);
    // The second shield costs more; the third is over the round's cap.
    L.core.message(party[2]!, { t: "buy", item: "shield" });
    expect(L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!.coins).toBe(w.coins - itemPrice("shield", 1));
    L.core.message(party[2]!, { t: "buy", item: "shield" });
    expect(L.last(party[2]!, "shopNo")).toMatchObject({ item: "shield", reason: "cap" });
    // Not enough coins: refused, nothing spent.
    L.core.message(party[3]!, { t: "buy", item: "stockfish" });
    L.core.message(party[3]!, { t: "buy", item: "stockfish" });
    expect(L.last(party[3]!, "shopNo")).toMatchObject({ reason: "coins" });
    // Putting one back: refunded at what it cost.
    const before = L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!;
    L.core.message(party[0]!, { t: "unbuy", item: "shield" });
    const after = L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!;
    expect(after.coins - before.coins).toBe(itemPrice("shield", 1));
    expect(after.cart.shield).toBe(1);
    expect(L.last(party[1]!, "bought")).toMatchObject({ by: party[0], item: "shield", undo: true });
    // Nonsense: refused.
    L.core.message(party[0]!, { t: "buy", item: "nuke" as MercItem });
    expect(L.last(party[0]!, "shopNo")).toMatchObject({ reason: "unknown_item" });
  });

  it("closes as the match starts: the cart comes in as the squad's kit (its chips, its tokens), the wallet's cart empties", () => {
    const { L, party, solo, lm, squad } = pairsLobby();
    for (const it of ["chip", "stockfish", "shield", "blocks"] as const) L.core.message(party[0]!, { t: "buy", item: it });
    const side = lm.m.sides.findIndex((x) => x.squadId === squad);
    const bankBefore = lm.m.banks[side]!;
    L.advanceTo(lm.startsAt! + 1);
    expect(lm.state).toBe("half");
    expect(lm.m.kit![side]).toMatchObject({ chip: 1, stockfish: 1, shield: 1, blocks: 1 });
    expect(lm.m.banks[side]).toBe(bankBefore);
    expect(lm.m.chips[side]).toBe(1);
    expect(lm.m.stockfish[side]).toBe(1);
    expect(lm.m.shields[side]).toBe(1);
    expect(lm.m.blockBanks[side]).toBe(SQUADS.blocks.bankPerMatch + M.blockPoints);
    const w = L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!;
    expect(w.cart).toEqual({ stockfish: 0, blocks: 0, shield: 0, chip: 0 });
    expect(w.chips).toBe(0);
    expect(w.shop).toBeNull();
    // Everyone's match view carries both kits (counterplay).
    const view = L.all(solo, "match").filter((x) => x.match.key === lm.key).at(-1)!.match;
    expect(view.kit![side]).toMatchObject({ chip: 1, stockfish: 1, shield: 1, blocks: 1 });
    expect(view.chips[side]).toBe(1);
    // Closed now.
    L.core.message(party[1]!, { t: "buy", item: "chip" });
    expect(L.last(party[1]!, "shopNo")).toMatchObject({ reason: "closed" });
  });

  it("a squad of bots shops in its window, within its wallet and the caps; it never spends a squad with people's coins", () => {
    const { L, lm, squad } = pairsLobby();
    L.advanceTo(lm.startsAt! - 1000);
    const wallets = L.core.walletsView().filter((w) => w.shop);
    expect(wallets.length).toBe(4);
    const people = wallets.find((w) => w.squadId === squad)!;
    expect(people.coins).toBe(M.testWallet);
    const bots = wallets.filter((w) => w.squadId !== squad);
    for (const w of bots) {
      for (const it of MERC_ITEMS) expect(w.cart[it]).toBeLessThanOrEqual(M.items[it].cap);
      expect(w.coins).toBe(M.testWallet - spentOf(w));
    }
    // (Across the three bot squads, some bought: a quarter of the time a squad saves.)
    expect(bots.some((w) => MERC_ITEMS.some((it) => w.cart[it] > 0))).toBe(true);
  });
});

describe("Mercenary on the server: items in a match", () => {
  it("the Stockfish token: paid at once, everyone hears who used one, the lines only on the user's screen", () => {
    const { L, party, solo, lm, squad } = pairsLobby();
    L.core.message(party[0]!, { t: "buy", item: "stockfish" });
    L.advanceTo(lm.startsAt! + 1);
    const side = lm.m.sides.findIndex((x) => x.squadId === squad);
    const duty = halfDuties(lm.m).duties.find((d) => d.side === side)!;
    const [p, partner] = duty.players as [string, string];
    const seq = lm.half!.seq;
    L.clear();
    L.core.message(p, { t: "assist", key: lm.key, seq });
    const a = L.last(solo, "assist")!;
    expect(a).toMatchObject({ key: lm.key, use: { by: p, board: duty.board, side, shownTo: [p] } });
    expect(a.stockfish[side]).toBe(0);
    expect(a.use.fen).toBe(lm.m.boards[duty.board]!.fen);
    expect(L.last(partner, "assist")!.use.shownTo).toEqual([p]);
    // None left for the partner; the user can't use a second.
    L.core.message(partner, { t: "assist", key: lm.key, seq });
    expect(L.last(partner, "assistNo")).toMatchObject({ reason: "no_tokens" });
    L.core.message(p, { t: "assist", key: lm.key, seq });
    expect(L.last(p, "assistNo")).toMatchObject({ reason: "shown" });
    // Someone with nothing to choose this half: refused.
    const idle = party.find((x) => !duty.players.includes(x))!;
    L.core.message(idle, { t: "assist", key: lm.key, seq });
    expect(L.last(idle, "assistNo")).toMatchObject({ reason: "no_duty" });
    // A reconnecting user's match view still has it (their lines come back).
    L.core.message(p, { t: "sync" });
    expect(L.all(p, "match").find((x) => x.match.key === lm.key)!.assisting).toMatchObject([{ by: p }]);
    // The half played: logged, and their pick marked assisted.
    L.core.message(p, { t: "choose", key: lm.key, seq, move: "e2e4" });
    L.core.message(partner, { t: "choose", key: lm.key, seq, move: "d2d4" });
    for (const x of [p, partner]) L.core.message(x, { t: "lock", key: lm.key, seq });
    L.runUntil(() => lm.state === "show", 60_000, "the half");
    const half = L.all(solo, "half").find((h) => h.key === lm.key)!;
    expect(half.match.assists).toMatchObject([{ by: p, shownTo: [p] }]);
    expect(ofKind(half.events, "pair").find((e) => e.board === duty.board)!.assisted).toEqual([p]);
  });

  it("a shield bought against another squad of people: their block is canceled, its points spent, both told", () => {
    for (let seed = 1; seed < 40; seed++) {
      const L = squadsLobby({ seed, test: { start: 1, mode: "mercenary" }, fillInMs: 5_000 });
      L.core.reserve([{ size: 4, pass: "red" }, { size: 4, pass: "blue" }], 60_000);
      const red = ["R1", "R2", "R3", "R4"].map((n) => L.join(n, { party: "red" }));
      const blue = ["B1", "B2", "B3", "B4"].map((n) => L.join(n, { party: "blue" }));
      L.advance(5_000 + FRONT_DOOR.fillShowMs + 2 * VOTE_MS + 1);
      const lm = L.core.allMatches().find((m) => mineIn(m, red[0]!));
      if (!lm || !mineIn(lm, blue[0]!)) continue;
      L.core.message(red[0]!, { t: "buy", item: "shield" });
      L.advanceTo(lm.startsAt! + 1);
      const redSide = lm.m.sides.findIndex((x) => x.seats.includes(red[0]!));
      expect(lm.m.shields[redSide]).toBe(1);
      // Blue's pair picks on its White board and blocks one of red's replies there.
      const duties = halfDuties(lm.m).duties;
      const blueDuty = duties.find((d) => d.side !== redSide)!;
      const seq = lm.half!.seq;
      // (A move of red's next turn there that a block can name, a minor piece's: the boards start from the voted opening.)
      const fen = lm.m.boards[blueDuty.board]!.fen;
      const them = fen.split(" ")[1] === "w" ? "b" : "w";
      const target = [...piecesOf(fen)].filter(([, p]) => (them === "w" ? "NB" : "nb").includes(p)).flatMap(([sq]) => blockTargets(fen, sq, them).map((to) => sq + to)).find((mv) => "cost" in checkBlock(fen, them, mv))!;
      L.core.message(blueDuty.players[0]!, { t: "block", key: lm.key, seq, board: blueDuty.board, move: target });
      expect(L.last(red[1]!, "block")).toMatchObject({ block: { move: target, side: blueDuty.side } });
      for (const d of duties) {
        const legal = squadsLegalMoves(lm.m.boards[d.board]!.fen);
        d.players.forEach((p, i) => {
          L.core.message(p, { t: "choose", key: lm.key, seq, move: legal[i]! });
          L.core.message(p, { t: "lock", key: lm.key, seq });
        });
      }
      L.runUntil(() => lm.state === "show", 60_000, "the half");
      const half = L.all(red[0]!, "half").find((h) => h.key === lm.key)!;
      const outcome = ofKind(half.events, "block")[0]!;
      // (Red's own move may have made it impossible anyway: then it's lifted, and the shield is kept.)
      if (outcome.outcome === "impossible") continue;
      expect(outcome).toMatchObject({ move: target, outcome: "shielded" });
      expect(half.match.shields[redSide]).toBe(0);
      expect(half.match.blocks).toEqual([]);
      expect(half.match.blockBanks[blueDuty.side]).toBe(SQUADS.blocks.bankPerMatch - outcome.cost);
      expect(L.all(blue[0]!, "half").find((h) => h.key === lm.key)!.events).toEqual(half.events);
      return;
    }
    throw new Error("No seed puts the two parties in one Pairs match");
  }, 120_000);
});

describe("Mercenary on the server: the Time chip", () => {
  const CHIP = M.chipSeconds * 1000;

  it("a tap on your move: everyone hears at once, with both squads' counts and the move's deadline 30 s later; the first tap wins", () => {
    const { L, party, solo, lm, squad } = pairsLobby();
    for (let i = 0; i < 2; i++) L.core.message(party[0]!, { t: "buy", item: "chip" });
    L.advanceTo(lm.startsAt! + 1);
    const side = lm.m.sides.findIndex((x) => x.squadId === squad) as 0 | 1;
    expect(lm.m.chips[side]).toBe(2);
    expect(L.core.walletsView().find((w) => w.squadId === squad)!.chips).toBe(0);
    const half = lm.half!;
    const d = halfDuties(lm.m).duties.find((x) => x.side === side)!;
    const [p, q] = d.players as [string, string];
    expect(party).toEqual(expect.arrayContaining([p, q]));
    L.clear();
    L.advance(5_000);
    const at = L.now - half.startedAt;
    L.core.message(p, { t: "chip", key: lm.key, seq: half.seq, seen: 0 });
    for (const who of [solo, q]) {
      expect(L.last(who, "chip")).toMatchObject({ key: lm.key, seq: half.seq, chip: { board: d.board, side, by: p }, deadline: half.startedAt + d.deadlineMs + CHIP });
      expect(L.last(who, "chip")!.chips[side]).toBe(1);
    }
    // The partner tapping at the same moment (they saw none): refused, nothing spent.
    L.core.message(q, { t: "chip", key: lm.key, seq: half.seq, seen: 0 });
    expect(L.last(q, "chipNo")).toMatchObject({ reason: "stale" });
    expect(L.all(solo, "chip")).toHaveLength(1);
    // Someone not on that move: refused.
    L.core.message(solo, { t: "chip", key: lm.key, seq: half.seq, seen: 1 });
    expect(L.last(solo, "chipNo")!.reason).toMatch(/no_duty|no_chips/);
    // The half's view carries it, and the duty's new deadline, for anyone (re)joining.
    L.core.message(solo, { t: "sync" });
    const view = L.all(solo, "match").filter((x) => x.match.key === lm.key).at(-1)!.match;
    expect(view.current!.chips).toEqual([{ board: d.board, by: p, at }]);
    expect(view.current!.duties.find((x) => x.board === d.board)!.deadline).toBe(half.startedAt + d.deadlineMs + CHIP);
  });

  it("the clock math: picks at 40 s count, the bank drained only outside the chip's 30 s; unused chips go back to the wallet", () => {
    const { L, party, lm, squad } = pairsLobby();
    for (let i = 0; i < 2; i++) L.core.message(party[0]!, { t: "buy", item: "chip" });
    L.advanceTo(lm.startsAt! + 1);
    const side = lm.m.sides.findIndex((x) => x.squadId === squad) as 0 | 1;
    const half = lm.half!;
    const d = halfDuties(lm.m).duties.find((x) => x.side === side)!;
    const [p, q] = d.players as [string, string];
    const bank = lm.m.banks[side];
    L.advance(5_000);
    L.core.message(p, { t: "chip", key: lm.key, seq: half.seq, seen: 0 });
    // 40 s into the half (past the time control's cap, at most 20 s): the half is still on, and both picks count.
    expect(lm.m.capMs).toBeLessThanOrEqual(20_000);
    expect(dutyDeadline(lm.half!.inputs, d)).toBeGreaterThanOrEqual(40_000);
    L.advanceTo(half.startedAt + 40_000);
    expect(lm.half?.seq).toBe(half.seq);
    const moves = squadsLegalMoves(lm.m.boards[d.board]!.fen);
    L.core.message(p, { t: "choose", key: lm.key, seq: half.seq, move: moves[0]! });
    L.core.message(q, { t: "choose", key: lm.key, seq: half.seq, move: moves[1]! });
    for (const x of [p, q]) L.core.message(x, { t: "lock", key: lm.key, seq: half.seq });
    L.advance(1);
    const played = L.all(p, "half").find((h) => h.key === lm.key && h.seq === half.seq)!;
    expect(played.missed).not.toContain(p);
    expect(played.missed).not.toContain(q);
    // From the free seconds to the tap (5 s), and 35-40 s: off the bank; both picks in time, the increment back.
    const drained = 5_000 - lm.m.delayMs + 5_000;
    expect(ofKind(played.events, "bank").find((e) => e.side === side)!.drainedMs).toBe(drained);
    expect(lm.m.banks[side]).toBe(bank - drained + lm.m.incrementMs);
    expect(played.match.chips[side]).toBe(1);
    // The match over: the chip left goes back to the squad's wallet, kept for the final.
    L.core.message(party[0]!, { t: "nextRound" });
    const w = L.core.walletsView().find((x) => x.squadId === squad)!;
    if (L.core.allMatches().some((x) => x.round === 2 && x.m.sides.some((sd) => sd.squadId === squad))) expect(w.chips).toBe(1);
  });

  it("too late: a tap after the move's time is up is refused", () => {
    const { L, party, lm, squad } = pairsLobby();
    L.core.message(party[0]!, { t: "buy", item: "chip" });
    L.advanceTo(lm.startsAt! + 1);
    const side = lm.m.sides.findIndex((x) => x.squadId === squad) as 0 | 1;
    const half = lm.half!;
    const d = halfDuties(lm.m).duties.find((x) => x.side === side)!;
    const now0 = half.startedAt;
    // (Straight past the deadline and the network's grace, the half still open for the message: it's refused.)
    L.now = now0 + d.deadlineMs + 5_000;
    L.core.message(d.players[0]!, { t: "chip", key: lm.key, seq: half.seq, seen: 0 });
    expect(L.last(d.players[0]!, "chipNo")!.reason).toMatch(/late|stale/);
  });
});

describe("Mercenary on the server: earning and catch-up", () => {
  it("every coin a half pays goes into its squad's wallet (catch-up as the next match is set: a share of the gap)", () => {
    const L = squadsLobby({ seed: 5, test: { start: 0, mode: "mercenary" }, fillInMs: 0 });
    const eric = L.join("Eric", { test: true });
    L.advance(FRONT_DOOR.fillShowMs + 2 * VOTE_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000 + 1);
    // A few minutes of Relay, then "Next round" (material decides what's left).
    L.advance(4 * 60_000);
    const halves = L.all(eric, "half").filter((h) => h.match.round === 0);
    const paid = new Map<number, number>();
    for (const h of halves) for (const e of ofKind(h.events, "coins")) paid.set(h.match.sides[e.side].squadId, (paid.get(h.match.sides[e.side].squadId) ?? 0) + e.coins);
    const now = L.core.walletsView();
    expect([...paid.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    for (const w of now) expect(w.earned).toBe(paid.get(w.squadId) ?? 0);
    // A big gap, so catch-up is sure: one Relay squad has earned 400 more (its wallet as the rules would have it).
    const rich = L.core.record.wallets![0]!;
    L.core.record.wallets![0] = { ...rich, coins: rich.coins + 400, earned: rich.earned + 400, byRound: [rich.byRound[0] + 400, 0, 0] };
    L.clear();
    L.core.message(eric, { t: "nextRound" });
    const pairs = L.core.allMatches().filter((m) => m.round === 1);
    expect(pairs).toHaveLength(2);
    const news = L.all(eric, "coins").filter((c) => c.why === "catch_up");
    const wallets = L.core.walletsView();
    for (const lm of pairs) {
      const [a, b] = lm.m.sides.map((x) => wallets.find((w) => w.squadId === x.squadId)!);
      const cu = catchUpCoins([a!.earned, b!.earned]);
      expect([a!.catchUp, b!.catchUp]).toEqual(cu);
      for (const [i, w] of [a!, b!].entries()) if (cu[i]) expect(news).toContainEqual(expect.objectContaining({ squadId: w.squadId, coins: cu[i], why: "catch_up", against: [b!, a!][i]!.squadId }));
    }
  });

  it("a whole bot lobby in Mercenary: every wallet adds up, kits come in, only bot squads use tokens, to its results", () => {
    const L = squadsLobby({ seed: 13, test: { start: 0, mode: "mercenary" }, fillInMs: 0 });
    const ann = L.join("Ann", { test: true });
    L.runUntil(() => L.core.record.phase === "results", 3 * 3_600_000, "the results");
    const wallets = L.core.walletsView();
    expect(wallets).toHaveLength(SQUADS.squadCount);
    for (const w of wallets) {
      // Coins: earned by play, plus catch-up, less what was bought.
      expect(w.coins).toBe(w.earned + w.catchUp - spentOf(w));
      expect(w.coins).toBeGreaterThanOrEqual(0);
      expect(w.earned).toBe(w.byRound[0] + w.byRound[1] + w.byRound[2]);
      expect(w.shop).toBeNull();
      // Time chips: bought, less those tapped, are what it holds now (kept from round to round), never over the cap.
      const tapped = L.all(ann, "chip").filter((c) => L.core.allMatches().find((x) => x.key === c.key)!.m.sides[c.chip.side].squadId === w.squadId).length;
      expect(w.chips).toBe(w.bought.chip - tapped);
      expect(w.chips).toBeLessThanOrEqual(M.items.chip.cap);
    }
    // The bots tapped some of their chips (in sudden death, or low on time).
    expect(L.all(ann, "chip").length).toBeGreaterThan(0);
    // Every match from round 2 on brought a kit; tokens used only by bot squads, never more than bought.
    const later = L.core.allMatches().filter((m) => m.round > 0);
    for (const lm of later) {
      expect(lm.m.kit).not.toBeNull();
      for (const side of [0, 1] as const) {
        const used = lm.m.assists.filter((a) => a.side === side).length;
        expect(used).toBeLessThanOrEqual(lm.m.kit![side].stockfish);
      }
    }
    for (const a of L.all(ann, "assist")) expect(L.core.record.squads.flatMap((sq) => sq.players).find((p) => p.id === a.use.by)!.isBot || a.use.by === ann).toBe(true);
    // The finalists shopped for the final (or saved nothing: in the final the bots spend all they can).
    const finalists = L.core.allMatches().find((m) => m.round === 2)!.m.sides.map((x) => x.squadId);
    expect(finalists.some((id) => MERC_ITEMS.some((it) => wallets.find((w) => w.squadId === id)!.bought[it] > 0))).toBe(true);
  }, 120_000);
});

describe("Mercenary on the server: brilliant moves", () => {
  /** A quiet move in a middlegame the judge (here: an answer already in) rates the only good one: brilliant. */
  const MIDDLE = "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 12";
  function judged(lm: LiveMatch, side: 0 | 1, finder: string, now: number) {
    const n = (lm.brilliantSeq = (lm.brilliantSeq ?? 0) + 1);
    const cand: BrilliantCandidate = { board: 0, side, fen: MIDDLE, move: "a2a3", ply: 22, finders: [finder], blocked: [] };
    const top = [
      { move: "a2a3", expected: 0.7 },
      { move: "h2h3", expected: 0.7 - M.brilliant.gap },
    ];
    (lm.brilliant ??= {})[n] = { id: `${lm.key}:b:${n}`, fen: MIDDLE, devices: [], sentAt: now, answers: {}, index: n, notBefore: now, brilliant: cand, top, how: "agreed" };
  }

  it("pays its squad 25, at most twice a match: the third still announced, with no coins; a fresh cap the next match", () => {
    const L = squadsLobby({ seed: 5, test: { start: 0, mode: "mercenary" }, fillInMs: 0 });
    const eric = L.join("Eric", { test: true });
    L.advance(FRONT_DOOR.fillShowMs + 2 * VOTE_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000 + 1);
    const lm = L.core.allMatches().find((x) => x.round === 0)!;
    const [a, b] = lm.m.sides.map((x) => x.squadId) as [number, number];
    const earned = (id: number) => L.core.walletsView().find((w) => w.squadId === id)!.earned;
    const [a0, b0] = [earned(a), earned(b)];
    L.clear();
    // Squad a finds three brilliant moves in this match, squad b one.
    for (const side of [0, 0, 0, 1] as const) judged(lm, side, lm.m.sides[side].seats[0]!, L.now);
    L.core.alarm();
    const news = L.all(eric, "coins").filter((c) => c.why === "brilliant" && c.key === lm.key);
    expect(news.map((c) => [c.squadId, c.coins, !!c.capped])).toEqual([
      [a, 25, false],
      [a, 25, false],
      [a, 0, true],
      [b, 25, false],
    ]);
    expect(earned(a) - a0).toBe(2 * M.brilliant.coins);
    expect(earned(b) - b0).toBe(M.brilliant.coins);
    expect(lm.brilliantPaid).toEqual([2, 1]);
    // Its next match: the cap starts again.
    L.core.message(eric, { t: "nextRound" });
    const next = L.core.allMatches().find((x) => x.round === 1 && x.m.sides.some((sd) => sd.squadId === a || sd.squadId === b))!;
    const side = next.m.sides.findIndex((sd) => sd.squadId === a || sd.squadId === b) as 0 | 1;
    const id = next.m.sides[side].squadId;
    const before = earned(id);
    L.clear();
    for (let i = 0; i < 3; i++) judged(next, side, next.m.sides[side].seats[0]!, L.now);
    L.core.alarm();
    expect(L.all(eric, "coins").filter((c) => c.why === "brilliant" && c.key === next.key).map((c) => c.coins)).toEqual([25, 25, 0]);
    expect(earned(id) - before).toBe(2 * M.brilliant.coins);
  });
});

describe("squads modes on the server: a lobby in play across the deploy", () => {
  it("a match stored before the modes (no mode, free seconds, kits, coins) is read as Classic and plays on", () => {
    const L = squadsLobby({ seed: 3, test: { start: 1 }, fillInMs: 5_000 });
    const tess = L.join("Tess");
    L.advance(5_000 + FRONT_DOOR.fillShowMs + 3 * VOTE_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000 + 1);
    const live = L.core.allMatches();
    expect(live.length).toBeGreaterThan(0);
    // What the Durable Object would have stored before: no Mercenary fields at all.
    const stored = Object.fromEntries(
      live.map((lm) => {
        const { mode, kit, stockfish, shields, assists, coins, ...m } = lm.m;
        void [mode, kit, stockfish, shields, assists, coins];
        return [lm.key, { ...lm, m: m as LiveMatch["m"] }];
      }),
    );
    const { rules, ...record } = L.core.record;
    const restarted = new SquadsCore({ ...record, rules: rules ? { start: rules.start, clock: rules.clock } : null }, stored, L.io, library);
    for (const lm of restarted.allMatches()) expect(lm.m).toMatchObject({ mode: "classic", kit: null, stockfish: [0, 0], shields: [0, 0], assists: [], coins: [0, 0] });
    expect(restarted.mercenary()).toBe(false);
    // It plays on: halves resolve and the views build.
    const before = restarted.allMatches().map((lm) => lm.seq);
    for (let i = 0; i < 400 && restarted.allMatches().every((lm, k) => lm.seq <= before[k]! + 1); i++) {
      L.now = (restarted.nextAlarm ?? L.now + 1000) + 1;
      restarted.alarm();
    }
    expect(restarted.allMatches().some((lm, k) => lm.seq > before[k]! + 1)).toBe(true);
    restarted.message(tess, { t: "sync" });
    expect(restarted.lobbyView("all").wallets).toEqual([]);
  });

  it("a lobby stored with the Breather (before Oct 13): a breather in an open shop's cart refunded, nothing crashes", () => {
    const L = squadsLobby({ seed: 3, test: { start: 1, mode: "mercenary" }, fillInMs: 0 });
    const tess = L.join("Tess", { test: true });
    L.advance(FRONT_DOOR.fillShowMs + 2 * VOTE_MS + 1);
    expect(L.core.walletsView().some((w) => w.shop)).toBe(true);
    // What the Durable Object would have stored: Tess's squad with a breather in its cart (150, before the step), a
    // match carrying the old per-side free seconds.
    const sq = L.core.record.squads.find((x) => x.players.some((p) => p.id === tess))!.id;
    const record = structuredClone(L.core.record);
    const w = record.wallets![sq]!;
    record.wallets![sq] = { ...w, coins: w.coins - 150, bought: { ...w.bought, breather: 1 }, cart: { ...w.cart, breather: 1 } } as typeof w;
    const stored = Object.fromEntries(L.core.allMatches().map((lm) => [lm.key, { ...structuredClone(lm), m: { ...structuredClone(lm.m), delays: [lm.m.delayMs, lm.m.delayMs] } as LiveMatch["m"] }]));
    const restarted = new SquadsCore(record, stored, L.io, library);
    const mine = restarted.walletsView().find((x) => x.squadId === sq)!;
    expect(mine.coins).toBe(w.coins);
    expect(mine.cart).toEqual(NO_ITEMS);
    expect(Object.keys(mine.bought).sort()).toEqual([...MERC_ITEMS].sort());
    for (const lm of restarted.allMatches()) expect("delays" in lm.m).toBe(false);
    // It plays on to the next match's kit: halves resolve, the views build.
    for (let i = 0; i < 200 && !restarted.allMatches().some((lm) => lm.m.kit); i++) {
      L.now = (restarted.nextAlarm ?? L.now + 1000) + 1;
      restarted.alarm();
    }
    expect(restarted.allMatches().some((lm) => lm.m.kit)).toBe(true);
    restarted.message(tess, { t: "sync" });
    expect(restarted.lobbyView("all").wallets.length).toBeGreaterThan(0);
  });
});
