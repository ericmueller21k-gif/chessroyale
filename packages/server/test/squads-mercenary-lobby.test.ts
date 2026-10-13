import { beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, SQUADS, SQUADS_LOBBY, type MercItem } from "@chessroyale/core";
import { MERC_ITEMS, blockTargets, catchUpCoins, checkBlock, halfDuties, itemPrice, piecesOf, squadsLegalMoves, squadsVotes, type NetWallet, type SquadsEvent } from "@chessroyale/chess/squads";
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
    L.core.message(party[1]!, { t: "buy", item: "time" });
    const w = L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!;
    expect(w.coins).toBe(M.testWallet - M.items.shield.price - M.items.time.price);
    expect(w.cart).toMatchObject({ shield: 1, time: 1 });
    // Who bought what, live to the squad (all four), not to the other squads.
    for (const p of party) expect(L.all(p, "bought").map((b) => [b.by, b.item, b.price])).toEqual([
      [party[0], "shield", M.items.shield.price],
      [party[1], "time", M.items.time.price],
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

  it("closes as the match starts: the cart comes in as the squad's kit (its bank, its tokens), the wallet's cart empties", () => {
    const { L, party, solo, lm, squad } = pairsLobby();
    for (const it of ["time", "stockfish", "shield", "blocks"] as const) L.core.message(party[0]!, { t: "buy", item: it });
    const side = lm.m.sides.findIndex((x) => x.squadId === squad);
    const bankBefore = lm.m.banks[side]!;
    L.advanceTo(lm.startsAt! + 1);
    expect(lm.state).toBe("half");
    expect(lm.m.kit![side]).toMatchObject({ time: 1, stockfish: 1, shield: 1, blocks: 1 });
    expect(lm.m.banks[side]).toBe(bankBefore + M.timeSeconds * 1000);
    expect(lm.m.stockfish[side]).toBe(1);
    expect(lm.m.shields[side]).toBe(1);
    expect(lm.m.blockBanks[side]).toBe(SQUADS.blocks.bankPerMatch + M.blockPoints);
    const w = L.last(solo, "wallets")!.wallets.find((x) => x.squadId === squad)!;
    expect(w.cart).toEqual({ stockfish: 0, breather: 0, blocks: 0, shield: 0, time: 0 });
    expect(w.shop).toBeNull();
    // Everyone's match view carries both kits (counterplay).
    const view = L.all(solo, "match").filter((x) => x.match.key === lm.key).at(-1)!.match;
    expect(view.kit![side]).toMatchObject({ time: 1, stockfish: 1, shield: 1, blocks: 1 });
    // Closed now.
    L.core.message(party[1]!, { t: "buy", item: "time" });
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

  it("a shield bought against another squad of people: their block is cancelled, its points spent, both told", () => {
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
    }
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
        const { mode, delays, kit, stockfish, shields, assists, coins, ...m } = lm.m;
        void [mode, delays, kit, stockfish, shields, assists, coins];
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
});

