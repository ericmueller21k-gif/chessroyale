import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRONT_DOOR, LOBBY_LIFE, SQUADS, SQUADS_LOBBY } from "@chessroyale/core";
import { SQUADS_PROTOCOL, dutyOf, halfDuties, squadsLegalMoves, squadsVotes, type NetSquadsMatch } from "@chessroyale/chess/squads";
import { clearTopCache, parseTestClock, partiesFit, squadsClosing, squadsTestAllowed, testLobbyOptions, type LiveMatch } from "../src/squads-lobby.ts";
import { fallbackTop } from "../src/squads-bots.ts";
import { squadsLobby } from "./squads-fixture.ts";

/**
 * Squads' lobby on the server (docs/areas/squads.md, "The server"): seats and parties, the fill, the votes, the
 * bracket in real time, bots, missed actions and bot takeover, visibility, the test controls, rewards, and its end.
 */

/** The votes before the bracket: Mode, Start and Clock. */
const VOTES_MS = FRONT_DOOR.fillShowMs + squadsVotes().length * (SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000;
const mineIn = (lm: LiveMatch, id: string) => lm.m.sides.some((x) => x.seats.includes(id));

beforeEach(() => clearTopCache());

describe("squads lobby: seats, parties, the fill", () => {
  it("parties that wouldn't fit the squads are refused; solo seats are promised, then taken", () => {
    expect(partiesFit([4, 4, 4, 4, 4, 4, 4, 4])).toBe(true);
    expect(partiesFit([3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2])).toBe(false);
    expect(partiesFit([3, 3, 3, 3, 3, 3, 2, 2, 2, 2])).toBe(true);
    expect(partiesFit([5])).toBe(false);
    const L = squadsLobby();
    // Six parties of 3 and four of 2 fill all 8 squads' first seats: a fifth party of 2 has nowhere to go whole.
    const groups = [...Array(6).fill(3), ...Array(4).fill(2), 2, 1].map((size, i) => ({ size, pass: size > 1 ? `pass${i}` : "" }));
    expect(L.core.reserve(groups, 20_000)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);
    // The same pass twice is one party.
    expect(L.core.reserve([{ size: 2, pass: "pass6" }], 20_000)).toEqual([]);
  });

  it("a party joins by its pass into one squad; its seats hold for it; bots fill every other seat", () => {
    const L = squadsLobby();
    expect(L.core.reserve([{ size: 3, pass: "friends" }, { size: 1, pass: "" }], 20_000)).toEqual([0, 1]);
    const a = L.join("Ann", { party: "friends" });
    const b = L.join("Bo", { party: "friends" });
    const solo = L.join("Cy");
    const c = L.join("Di", { party: "friends" });
    // A fourth friend with the pass: the party's seats here are taken.
    expect(L.core.connect(undefined, { name: "Ed", party: "friends", v: SQUADS_PROTOCOL })).toEqual({ ok: false, message: "Your party's seats here are taken." });
    // An app on another version is told to update.
    expect(L.core.connect(undefined, { name: "Old", v: 0 })).toMatchObject({ ok: false });
    expect(L.last(a, "welcome")).toMatchObject({ v: SQUADS_PROTOCOL, playerId: a, code: "SQUAD", test: false });
    L.advance(60_000);
    const lobby = L.last(a, "lobby")!.lobby;
    expect(lobby.phase).toBe("filled");
    expect(lobby.squads).toHaveLength(8);
    expect(lobby.squads.every((sq) => sq.seats.length === 4)).toBe(true);
    const squadOf = (id: string) => lobby.squads.find((sq) => sq.seats.includes(id))!.id;
    expect(new Set([a, b, c].map(squadOf)).size).toBe(1);
    // The solo player joins the party's squad (its fourth seat): people end up with people.
    expect(squadOf(solo)).toBe(squadOf(a));
    expect(lobby.players.filter((p) => p.isBot)).toHaveLength(28);
    expect(lobby.players.find((p) => p.id === a)).toMatchObject({ isBot: false, botPlays: false, partyId: lobby.players.find((p) => p.id === b)!.partyId });
    // Too late to join now.
    expect(L.core.connect(undefined, { name: "Late", v: SQUADS_PROTOCOL })).toMatchObject({ ok: false, message: "This match has already started." });
  });

  it("the matchmaker stops seating a lobby just before it fills; a lobby nobody is in waits, then fills when someone comes back", () => {
    const L = squadsLobby();
    L.advance(57_000);
    expect(L.core.joinable()).toBe(true);
    L.advance(1_500);
    expect(L.core.joinable()).toBe(false);
    expect(L.core.reserve([{ size: 1, pass: "" }], 20_000)).toEqual([]);
    const M = squadsLobby();
    const a = M.join("Ann");
    M.core.disconnect(a);
    M.advance(61_000);
    expect(M.core.record.phase).toBe("waiting");
    const token = M.last(a, "welcome")!.token;
    expect(M.core.connect(token, { v: SQUADS_PROTOCOL })).toEqual({ ok: true, playerId: a });
    expect(M.core.record.phase).toBe("filled");
  });

  it("leaving before the fill frees the seat; an old token is told the match has ended", () => {
    const L = squadsLobby();
    const a = L.join("Ann");
    L.core.message(a, { t: "leave" });
    expect(L.closed).toContain(a);
    expect(L.core.record.humans).toHaveLength(0);
    expect(L.core.connect("not-a-token", { v: SQUADS_PROTOCOL })).toMatchObject({ ok: false, ended: true });
  });
});

describe("squads lobby: votes and the bracket", () => {
  it("everyone votes (bots too), the rules follow, the bracket is drawn and round 1's four matches begin", () => {
    const L = squadsLobby();
    const a = L.join("Ann");
    L.advance(60_000 + FRONT_DOOR.fillShowMs);
    // The Mode vote first: "Coming soon" can't be voted for (the bots don't either); Ann votes Mercenary.
    const mode = L.last(a, "vote")!.vote;
    expect(mode).toMatchObject({ id: "mode", index: 0, count: 3, result: null });
    expect(mode.votes.every((v) => v.option === 0 || v.option === 1)).toBe(true);
    L.core.message(a, { t: "vote", key: mode.key, option: 2 });
    expect(L.last(a, "voteCast")).toBeUndefined();
    L.core.message(a, { t: "vote", key: mode.key, option: 1 });
    expect(L.last(a, "voteCast")).toMatchObject({ playerId: a, option: 1 });
    L.advance((SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000);
    const modeResult = L.all(a, "vote").map((x) => x.vote).filter((x) => x.id === "mode").at(-1)!.result!;
    expect([0, 1]).toContain(modeResult);
    const vote = L.last(a, "vote")!.vote;
    expect(vote).toMatchObject({ id: "start", index: 1, count: 3, result: null });
    L.core.message(a, { t: "vote", key: vote.key, option: 2 });
    expect(L.last(a, "voteCast")).toMatchObject({ playerId: a, option: 2 });
    L.advance(SQUADS.voteSeconds * 1000);
    const counted = L.last(a, "vote")!.vote;
    expect(counted.result).not.toBeNull();
    // Everyone who didn't vote joins the winner: all 32 are counted.
    expect(counted.votes).toHaveLength(32);
    L.advance(SQUADS.voteResultSeconds * 1000);
    expect(L.last(a, "vote")!.vote.id).toBe("clock");
    L.advance((SQUADS.voteSeconds + SQUADS.voteResultSeconds) * 1000);
    const lobby = L.last(a, "lobby")!.lobby;
    expect(lobby.phase).toBe("bracket");
    expect(lobby.rules).not.toBeNull();
    expect(lobby.rules!.mode).toBe(modeResult === 1 ? "mercenary" : "classic");
    expect(lobby.bracket.map((b) => [b.key, b.state])).toEqual([
      ["r0m0", "break"],
      ["r0m1", "break"],
      ["r0m2", "break"],
      ["r0m3", "break"],
      ["r1m0", "waiting"],
      ["r1m1", "waiting"],
      ["r2m0", "waiting"],
    ]);
    const matches = L.all(a, "match").map((m) => m.match);
    expect(matches.map((m) => m.format)).toEqual(["relay", "relay", "relay", "relay"]);
    expect(matches.every((m) => m.boards.length === 4 && m.boards.every((b) => b.moves?.length === 0))).toBe(true);
    L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000);
    expect(L.all(a, "turn").map((t) => t.key).sort()).toEqual(["r0m0", "r0m1", "r0m2", "r0m3"]);
  });

  it("a full lobby of bots plays the whole bracket to its results: every placement, the final, and the lobby's end", () => {
    const L = squadsLobby({ seed: 11 });
    const a = L.join("Ann");
    // Wes stays to watch (connected, never playing his seat: after noShowsBeforeBot misses a bot plays it), so the
    // lobby has someone in it and plays on. (With nobody left at all it would end at once: "leaving" below.)
    const w = L.join("Wes");
    L.advance(60_000);
    // Ann goes at once: her seat is a bot's, so every seat is played by a bot (Wes's after his misses).
    L.core.message(a, { t: "leave" });
    expect(L.core.record.squads.flatMap((sq) => sq.players).filter((p) => !p.isBot && !p.replacedByBot).map((p) => p.id)).toEqual([w]);
    const start = L.now;
    L.runUntil(() => L.core.record.phase === "results", 3 * 3_600_000, "the results");
    const minutes = (L.now - start) / 60_000;
    // (These bots play from the server's quick look, far weaker than the devices' engine, so their games run long and
    // vary: over 8 seeds 43-103 minutes before Squads v2, 41-96 after. What must hold: a bracket left to its bots
    // reaches its results before the lobby's safety close for a lobby nobody is in. With devices: about 30 minutes.)
    expect(minutes).toBeGreaterThan(15);
    expect(minutes).toBeLessThan(LOBBY_LIFE.lobbyAbandonedMinutes);
    // Squads v2: the bots match a partner on an only move; with no device, no refunds.
    const pairs = L.core.allMatches().filter((m) => m.round === 1);
    expect(pairs.flatMap((m) => m.m.tokenLog).length).toBeGreaterThan(0);
    expect(pairs.flatMap((m) => m.m.tokenLog).every((u) => u.verdict?.why === "no_judge")).toBe(true);
    // No block points to start (Eric, Oct 19): round 1, before any shop, has no blocks; a later match's come from its kit.
    expect(L.core.allMatches().filter((m) => m.round === 0).every((m) => m.m.blockBanks.every((b) => b === 0) && m.m.blocks.length === 0)).toBe(true);
    for (const m of L.core.allMatches()) for (const side of [0, 1] as const) expect(m.m.blockBanks[side]).toBeLessThanOrEqual((m.m.kit?.[side]?.blocks ?? 0) * SQUADS.mercenary.blockPoints);
    const places = Object.values(L.core.record.placed).sort();
    expect(places).toEqual([1, 2, 3, 3, 5, 5, 5, 5]);
    const matches = L.core.allMatches();
    expect(matches.map((m) => m.key).sort()).toEqual(["r0m0", "r0m1", "r0m2", "r0m3", "r1m0", "r1m1", "r2m0"]);
    expect(matches.every((m) => m.state === "over" && m.m.result && m.m.result.winner !== null)).toBe(true);
    // Each round's match began only after its two feeders were over.
    // (Ann left before the bracket: nothing recorded for her. Wes's seat was a bot's: his squad's place, no reward.)
    expect(L.core.takeRewards().map((r) => [r.playerId, r.coins, r.crates])).toEqual([[w, 0, 0]]);
    // Its end: results kept LOBBY_LIFE's 15 minutes, then it closes.
    const close = squadsClosing(L.core.record, false)!;
    expect(close.reason).toBe("ended");
    expect(close.at - L.core.record.endedAt!).toBe(15 * 60_000);
  }, 120_000);
});

describe("squads lobby: playing a half", () => {
  /** A test lobby at round 1, a party of 4 people in one squad (and `extra` solo people), at its first half. */
  function relayStart(extra = 1, seed = 7) {
    const L = squadsLobby({ seed, test: { start: 0 }, fillInMs: 5_000 });
    L.core.reserve([{ size: 4, pass: "four" }], 60_000);
    const party = ["A", "B", "C", "D"].map((n) => L.join(n, { party: "four" }));
    const solos = Array.from({ length: extra }, (_, i) => L.join(`S${i}`));
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const lm = L.core.allMatches().find((m) => mineIn(m, party[0]!))!;
    return { L, party, solos, lm };
  }

  it("Relay: your move shows to your squad at once, never to the other squad or a spectator; it's made once", () => {
    const { L, party, solos, lm } = relayStart(1);
    expect(lm.state).toBe("half");
    const side = lm.m.sides.findIndex((x) => x.seats.includes(party[0]!));
    const turn = L.last(party[0]!, "turn")!.current;
    const duty = turn.duties.find((d) => d.side === side && d.players.every((p) => party.includes(p)))!;
    const mover = duty.players[0]!;
    const move = squadsLegalMoves(lm.m.boards[duty.board]!.fen)[0]!;
    L.clear();
    L.core.message(mover, { t: "choose", key: lm.key, seq: 0, move });
    for (const id of party) expect(L.last(id, "choices")!.visible[mover]).toBe(move);
    // A spectator (in another match) sees who has moved, not the move.
    const spectator = solos[0]!;
    if (!mineIn(lm, spectator)) {
      expect(L.last(spectator, "choices")!.visible[mover]).toBeUndefined();
      expect(L.last(spectator, "choices")!.locked).toContain(mover);
      L.core.message(spectator, { t: "sync" });
      const seen = L.all(spectator, "match").find((m) => m.match.key === lm.key)!;
      expect(seen.visible[mover]).toBeUndefined();
    }
    // Made once; a stale half or someone without a duty is refused.
    L.core.message(mover, { t: "choose", key: lm.key, seq: 0, move: squadsLegalMoves(lm.m.boards[duty.board]!.fen)[1]! });
    expect(L.last(mover, "choiceNo")).toMatchObject({ reason: "already_moved" });
    L.core.message(mover, { t: "choose", key: lm.key, seq: 5, move });
    expect(L.last(mover, "choiceNo")).toMatchObject({ reason: "stale" });
    const idle = party.find((p) => !turn.duties.some((d) => d.players.includes(p)))!;
    L.core.message(idle, { t: "choose", key: lm.key, seq: 0, move });
    expect(L.last(idle, "choiceNo")).toMatchObject({ reason: "no_duty" });
  });

  it("a half ends when its time is up: a move after the deadline is refused; the half's events go to everyone", () => {
    const { L, party, lm } = relayStart(0);
    const duty = L.last(party[0]!, "turn")!.current.duties.find((d) => party.includes(d.players[0]!))!;
    const mover = duty.players[0]!;
    L.advance(duty.deadline - L.now + 400);
    L.core.message(mover, { t: "choose", key: lm.key, seq: 0, move: squadsLegalMoves(lm.m.boards[duty.board]!.fen)[0]! });
    expect(L.last(mover, "choiceNo")?.reason).toMatch(/late|stale/);
    const half = L.all(party[1]!, "half").find((h) => h.key === lm.key && h.seq === 0)!;
    expect(half.missed).toContain(mover);
    expect(half.events.some((e) => e.kind === "relay" && e.player === mover && e.missed)).toBe(true);
    expect(half.match.boards.every((b) => b.moves === undefined)).toBe(true);
  });

  it("a person who misses three in a row (a disconnect) has their seat played by a bot; they can take it back", () => {
    const { L, party, lm } = relayStart(0);
    const gone = party[0]!;
    // (The rest of the squad plays on, so the match does.)
    for (const p of party.slice(1)) L.players.add(p);
    L.core.disconnect(gone);
    L.runUntil(() => L.core.record.squads.some((sq) => sq.players.some((p) => p.id === gone && p.replacedByBot)), 30 * 60_000, "the bot takeover");
    const p = L.core.record.squads.flatMap((sq) => sq.players).find((x) => x.id === gone)!;
    expect(p.misses).toBeGreaterThanOrEqual(SQUADS.noShowsBeforeBot);
    const shown = L.last(party[1]!, "lobby")!.lobby.players.find((x) => x.id === gone)!;
    expect(shown).toMatchObject({ botPlays: true, replaced: true, connected: false });
    expect(L.all(party[1]!, "half").some((h) => h.replaced.includes(gone))).toBe(true);
    // From then on the bot moves for that seat: no more misses while it plays.
    const misses = p.misses;
    L.advance(30_000);
    expect(L.core.record.squads.flatMap((sq) => sq.players).find((x) => x.id === gone)!.misses).toBe(misses);
    // Back: the seat is theirs again from the next half.
    L.core.connect(L.last(gone, "welcome")!.token, { v: SQUADS_PROTOCOL });
    L.core.message(gone, { t: "reclaim" });
    expect(L.core.record.squads.flatMap((sq) => sq.players).find((x) => x.id === gone)).toMatchObject({ replacedByBot: false, missStreak: 0 });
    void lm;
  }, 60_000);

  it("leaving during the bracket: a bot takes the seat at once; the person is gone", () => {
    const { L, party } = relayStart(0);
    L.core.message(party[2]!, { t: "leave" });
    expect(L.closed).toContain(party[2]);
    expect(L.last(party[2]!, "left")).toBeDefined();
    expect(L.core.record.squads.flatMap((sq) => sq.players).find((x) => x.id === party[2])!.replacedByBot).toBe(true);
    expect(L.last(party[0]!, "lobby")!.lobby.players.find((x) => x.id === party[2])).toMatchObject({ left: true, botPlays: true });
  });

  it("team clocks: a squad's bank drains while its moves are thought about; at zero, sudden death (no flag falls)", () => {
    // Each squad's bank 4 s, 2 s free a move: two of the party's moves at once empty it 4 s into the half.
    const L = squadsLobby({ test: { start: 0, clock: parseTestClock("4,0,2,0")! }, fillInMs: 5_000 });
    L.core.reserve([{ size: 4, pass: "four" }], 60_000);
    const party = ["A", "B", "C", "D"].map((n) => L.join(n, { party: "four" }));
    L.advance(5_000 + VOTES_MS);
    // Everyone sees every squad's clock as the bracket starts.
    const start = L.last(party[0]!, "clocks")!.clocks;
    expect(start).toHaveLength(8);
    expect(start.every((c) => c.bankMs === 4_000 && !c.suddenDeath)).toBe(true);
    L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const lm = L.core.allMatches().find((m) => mineIn(m, party[0]!))!;
    const side = lm.m.sides.findIndex((x) => x.seats.includes(party[0]!));
    const squadId = lm.m.sides[side]!.squadId;
    const turn = L.last(party[0]!, "turn")!;
    expect(turn.banks[side]).toBe(4_000);
    const mine = turn.current.duties.filter((d) => d.side === side);
    expect(mine).toHaveLength(2);
    // The cap bounds a move while the bank lasts (a test clock of four numbers: the ceiling every clock had before the
    // time controls, so older test links keep their meaning).
    expect(mine.every((d) => d.deadline - turn.current.startedAt === SQUADS.legacyCapSeconds * 1000)).toBe(true);
    // One mover chooses at 5 s, after the bank ran out (at 4 s): too late, a miss, but not a no-show. The other is gone
    // (disconnected) and never moves: a no-show.
    const [late, absent] = [mine[0]!.players[0]!, mine[1]!.players[0]!];
    L.core.disconnect(absent);
    L.advance(5_000);
    L.core.message(late, { t: "choose", key: lm.key, seq: turn.current.seq, move: squadsLegalMoves(lm.m.boards[mine[0]!.board]!.fen)[0]! });
    L.runUntil(() => L.all(party[0]!, "half").some((h) => h.key === lm.key && h.seq === 0), 60_000, "the first half");
    const half = L.all(party[0]!, "half").find((h) => h.key === lm.key && h.seq === 0)!;
    expect(half.events).toContainEqual(expect.objectContaining({ kind: "sudden_death", side }));
    expect(half.events.some((e) => e.kind === "board_end" && (e.result.reason as string) === "flag")).toBe(false);
    expect(half.missed).toEqual(expect.arrayContaining([late, absent]));
    expect(half.match.banks[side]).toBe(0);
    const seat = (id: string) => L.core.record.squads.flatMap((sq) => sq.players).find((p) => p.id === id)!;
    expect(seat(late)).toMatchObject({ misses: 1, missStreak: 0 });
    expect(seat(absent)).toMatchObject({ misses: 1, missStreak: 1 });
    // Everyone sees that squad in sudden death; its next moves have only the free seconds.
    expect(L.last(party[3]!, "clocks")!.clocks.find((c) => c.squadId === squadId)).toMatchObject({ bankMs: 0, suddenDeath: true, key: lm.key });
    L.runUntil(() => L.all(party[0]!, "turn").some((t) => t.key === lm.key && t.current.seq >= 1 && t.current.duties.some((d) => d.side === side)), 120_000, "its next move");
    const next = L.all(party[0]!, "turn").find((t) => t.key === lm.key && t.current.seq >= 1 && t.current.duties.some((d) => d.side === side))!;
    for (const d of next.current.duties.filter((x) => x.side === side)) expect(d.deadline - next.current.startedAt).toBe(2_000);
  });

  it("ties: a level match goes to the squad with more team bank left (then a coin); banks carry into the next round, topped up", () => {
    // ("Next round" settles the matches level on material: the banks decide, as for a tie in rounds 1 and 2.)
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 5_000 });
    const a = L.join("Ann", { test: true });
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    L.advance(20_000);
    L.core.message(a, { t: "nextRound" });
    for (const lm of L.core.allMatches().filter((m) => m.round === 0)) {
      const r = lm.m.result!;
      expect(r.how).toBe("admin");
      if (r.points[0] === r.points[1]) {
        expect(r.timeLeft).toEqual([lm.m.banks[0], lm.m.banks[1]]);
        if (r.timeLeft![0] !== r.timeLeft![1]) expect(r.winner).toBe(r.timeLeft![0] > r.timeLeft![1] ? 0 : 1);
      }
    }
    // Each winner's bank goes into round 2, topped up (the rules' planMatch).
    const rules = L.core.record.rules!;
    for (const lm of L.core.allMatches().filter((m) => m.round === 1)) {
      for (const side of [0, 1] as const) {
        const feeder = L.core.allMatches().find((m) => m.round === 0 && m.m.sides.some((x) => x.squadId === lm.m.sides[side].squadId))!;
        const was = feeder.m.banks[feeder.m.sides.findIndex((x) => x.squadId === lm.m.sides[side].squadId)]!;
        expect(lm.m.banks[side]).toBe(was + rules.clock.topUpSeconds * 1000);
      }
    }
  });
});

describe("squads lobby: the final, Armageddon and visibility", () => {
  /** A test lobby straight at the final: two parties of 4 people (each its own squad), and a solo person. */
  function finalStart(seed: number) {
    const L = squadsLobby({ seed, test: { start: 2 }, fillInMs: 5_000 });
    L.core.reserve([{ size: 4, pass: "red" }, { size: 4, pass: "blue" }], 60_000);
    const red = ["R1", "R2", "R3", "R4"].map((n) => L.join(n, { party: "red" }));
    const blue = ["B1", "B2", "B3", "B4"].map((n) => L.join(n, { party: "blue" }));
    const solo = L.join("Sol");
    L.advance(5_000 + VOTES_MS);
    return { L, red, blue, solo };
  }

  it("starting at the final: the rounds before are skipped (squads with people go through), nothing is rewarded", () => {
    // (A seed whose bracket puts the two parties in opposite halves, so they meet in the final.)
    let found: ReturnType<typeof finalStart> | null = null;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const f = finalStart(seed);
      const fin = f.L.core.match("r2m0");
      if (fin && mineIn(fin, f.red[0]!) && mineIn(fin, f.blue[0]!)) found = f;
    }
    expect(found).not.toBeNull();
    const { L, red, blue, solo } = found!;
    const lobby = L.last(solo, "lobby")!.lobby;
    expect(lobby.test).toEqual({ start: 2, used: true });
    expect(lobby.bracket.filter((b) => b.round < 2).every((b) => b.state === "over")).toBe(true);
    expect(L.core.allMatches().map((m) => m.key)).toEqual(["r2m0"]);
    // The solo's squad is out (5th-8th or 3rd-4th), with no reward in a test lobby.
    expect(L.last(solo, "placed")).toMatchObject({ coins: 0, crates: 0, recorded: false });
    L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const fin = L.core.match("r2m0")!;
    expect(fin.state).toBe("half");
    const turn = L.last(solo, "turn")!.current;
    // The majority vote: one duty, the whole squad to move.
    expect(turn.duties).toHaveLength(1);
    const pick = turn.duties[0]!;
    expect(pick.players).toHaveLength(4);
    const fen = fin.m.boards[0]!.fen;
    const legal = squadsLegalMoves(fen);
    const pickers = pick.players;
    const pickSide = red.includes(pickers[0]!) ? red : blue;
    const otherSide = pickSide === red ? blue : red;
    L.clear();
    L.core.message(pickers[0]!, { t: "choose", key: "r2m0", seq: turn.seq, move: legal[0]! });
    // Picks: only the picking squad.
    for (const id of pickSide) expect(L.last(id, "choices")!.visible[pickers[0]!]).toBe(legal[0]);
    for (const id of [...otherSide, solo]) expect(L.last(id, "choices")!.visible[pickers[0]!]).toBeUndefined();
    // A teammate can copy it (no tokens in the final).
    L.core.message(pickers[1]!, { t: "choose", key: "r2m0", seq: turn.seq, move: legal[0]! });
    expect(L.last(pickers[1]!, "choiceNo")).toBeUndefined();
    for (const id of pickSide) expect(L.last(id, "choices")!.visible[pickers[1]!]).toBe(legal[0]);
    // The other squad has nothing to choose.
    L.core.message(otherSide[0]!, { t: "choose", key: "r2m0", seq: turn.seq, move: legal[1]! });
    expect(L.last(otherSide[0]!, "choiceNo")).toMatchObject({ reason: "no_duty" });
  });

  it("a drawn final goes to Armageddon: the squad with more time left picks its color, then one board decides", () => {
    let found: ReturnType<typeof finalStart> | null = null;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const f = finalStart(seed);
      const fin = f.L.core.match("r2m0");
      if (fin && mineIn(fin, f.red[0]!) && mineIn(fin, f.blue[0]!)) found = f;
    }
    const { L, red, blue, solo } = found!;
    const fin = L.core.match("r2m0")!;
    // Force a drawn final through the rules: the board ends drawn (stalemate-free: a dead draw by material).
    fin.m = { ...fin.m, boards: fin.m.boards.map((b) => ({ ...b, fen: "8/8/8/8/8/8/4k3/K7 w - - 0 60" })) };
    fin.state = "show";
    fin.startsAt = L.now;
    L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000 + 1);
    // (Any half on a dead-drawn position ends the board as a draw: the final is drawn.)
    L.runUntil(() => fin.state === "armageddon" || fin.m.armageddon, 120_000, "Armageddon");
    const arm = L.last(solo, "match")!.match as NetSquadsMatch;
    expect(arm.state).toBe("armageddon");
    expect(arm.drawnFinal).toBeDefined();
    const chooser = arm.armageddonChoice!.chooser;
    const chooserSquad = fin.m.sides[chooser].seats.includes(red[0]!) ? red : blue;
    const otherSquad = chooserSquad === red ? blue : red;
    // Only the choosing squad's people may pick.
    L.core.message(otherSquad[0]!, { t: "armageddon", key: "r2m0", colour: "w" });
    expect(L.core.match("r2m0")!.arm!.colour).toBeNull();
    L.core.message(chooserSquad[0]!, { t: "armageddon", key: "r2m0", colour: "w" });
    expect(L.core.match("r2m0")!.arm!.colour).toBe("w");
    L.advance(SQUADS.armageddonIntroSeconds * 1000 + 10);
    const a = L.core.match("r2m0")!;
    expect(a.m.armageddon).toBe(true);
    expect(a.m.boards[0]!.white).toBe(chooser);
    expect(a.m.banks[chooser]).toBe(SQUADS.armageddon.whiteSeconds * 1000);
    expect(a.m.banks[chooser === 0 ? 1 : 0]).toBe(SQUADS.armageddon.blackSeconds * 1000);
    L.runUntil(() => L.core.record.phase === "results", 60 * 60_000, "the results");
    expect(Object.values(L.core.record.placed).sort()).toEqual([1, 2, 3, 3, 5, 5, 5, 5]);
    expect(L.last(solo, "results")).toBeDefined();
  }, 120_000);
});

describe("squads lobby: the test controls", () => {
  it('"Next round" (a test player only) ends round 1 by material and moves on; nothing is rewarded after it', () => {
    const L = squadsLobby();
    const tester = L.join("Tess", { test: true, userId: "u1" });
    const player = L.join("Pat", { userId: "u2" });
    L.advance(60_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000 + 30_000);
    // Not a test player: nothing happens.
    L.core.message(player, { t: "nextRound" });
    expect(L.core.allMatches().every((m) => !m.m.result)).toBe(true);
    expect(L.last(tester, "welcome")!.test).toBe(true);
    expect(L.last(player, "welcome")!.test).toBe(false);
    L.core.message(tester, { t: "nextRound" });
    const r0 = L.core.allMatches().filter((m) => m.round === 0);
    expect(r0.every((m) => m.state === "over" && m.m.result!.how === "admin")).toBe(true);
    expect(r0.flatMap((m) => m.m.boards).every((b) => b.result)).toBe(true);
    const r1 = L.core.allMatches().filter((m) => m.round === 1);
    expect(r1).toHaveLength(2);
    expect(r1.every((m) => m.startsAt! - L.now <= 3_000)).toBe(true);
    expect(L.core.record.testUsed).toBe(true);
    expect(L.core.takeRewards().every((r) => r.coins === 0 && r.crates === 0 && !r.recorded)).toBe(true);
    // Again: round 2, then the final.
    L.core.message(tester, { t: "nextRound" });
    L.core.message(tester, { t: "nextRound" });
    expect(L.core.record.phase).toBe("results");
  });

  it('"Next round" in the votes closes them; the switch off removes the controls', () => {
    const L = squadsLobby();
    const tester = L.join("Tess", { test: true });
    L.advance(60_000 + FRONT_DOOR.fillShowMs + 1_000);
    L.core.message(tester, { t: "nextRound" });
    expect(L.core.record.phase).toBe("bracket");
    const was = SQUADS_LOBBY.testControls;
    SQUADS_LOBBY.testControls = false;
    try {
      const M = squadsLobby();
      const t = M.join("Tess", { test: true });
      expect(M.last(t, "welcome")!.test).toBe(false);
      M.advance(60_000 + FRONT_DOOR.fillShowMs + 1_000);
      M.core.message(t, { t: "nextRound" });
      expect(M.core.record.phase).toBe("vote");
    } finally {
      SQUADS_LOBBY.testControls = was;
    }
  });
});

describe("squads lobby: the test lobby from the first vote (/squads/test)", () => {
  it("only test players may open one: an admin, or anyone where SQUADS_TEST is on; never with the switch off", () => {
    expect(squadsTestAllowed(undefined, true)).toBe(true);
    expect(squadsTestAllowed("1", false)).toBe(true);
    expect(squadsTestAllowed(undefined, false)).toBe(false);
    expect(squadsTestAllowed("0", false)).toBe(false);
    const was = SQUADS_LOBBY.testControls;
    SQUADS_LOBBY.testControls = false;
    try {
      expect(squadsTestAllowed(undefined, true)).toBe(false);
      expect(squadsTestAllowed("1", true)).toBe(false);
    } finally {
      SQUADS_LOBBY.testControls = was;
    }
  });

  it("start=votes fills at once from round 1; the round links still wait for others to join", () => {
    const now = 5_000_000;
    expect(testLobbyOptions(new URLSearchParams("start=votes"), now)).toEqual({ fillAt: now, test: { start: 0 } });
    expect(testLobbyOptions(new URLSearchParams("start=relay"), now)).toEqual({ fillAt: now + SQUADS_LOBBY.testFillSeconds * 1000, test: { start: 0 } });
    expect(testLobbyOptions(new URLSearchParams("start=final&clock=60,10,2,0&keep=30"), now)).toMatchObject({ test: { start: 2, clock: { bankSeconds: 60 } }, keepMs: 30_000 });
  });

  it("its opener is seated with bots in every other seat at once, then lands on the first vote; Skip votes and Next round still work", () => {
    const L = squadsLobby({ test: { start: 0 }, fillInMs: 0 });
    const eric = L.join("Eric", { test: true, userId: "u1" });
    expect(L.core.record.phase).toBe("filled");
    const seats = L.core.record.squads.flatMap((sq) => sq.players);
    expect(seats).toHaveLength(SQUADS.squadCount * SQUADS.squadSize);
    expect(seats.filter((p) => p.isBot)).toHaveLength(seats.length - 1);
    expect(seats.find((p) => !p.isBot)!.id).toBe(eric);
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.core.record.phase).toBe("vote");
    expect(L.last(eric, "vote")!.vote).toMatchObject({ index: 0, id: "mode" });
    expect(L.last(eric, "welcome")!.test).toBe(true);
    // Skip votes, then Next round: the bracket from round 1, then on to round 2.
    L.core.message(eric, { t: "nextRound" });
    expect(L.core.record.phase).toBe("bracket");
    expect(L.core.allMatches().filter((m) => m.round === 0)).toHaveLength(4);
    L.advance(SQUADS_LOBBY.bracketIntroSeconds * 1000 + 5_000);
    L.core.message(eric, { t: "nextRound" });
    expect(L.core.allMatches().filter((m) => m.round === 1)).toHaveLength(2);
  });
});

describe("squads lobby: rewards", () => {
  it("placements write a result for signed-in people and pay those still playing their seat", () => {
    const L = squadsLobby({ seed: 3 });
    const a = L.join("Ann", { userId: "ua" });
    const b = L.join("Bo", { userId: "ub" });
    const c = L.join("Cy");
    // Ann plays every duty; Bo leaves once the bracket is drawn (resigns: a loss at his squad's worst place, then);
    // Cy (no account) plays too.
    L.players.add(a);
    L.players.add(c);
    L.runUntil(() => L.core.record.phase === "bracket", 10 * 60_000, "the bracket");
    L.core.message(b, { t: "leave" });
    expect(L.last(b, "left")).toMatchObject({ how: "resigned", result: { placement: 5, players: 8 } });
    const bo = L.core.takeRewards();
    expect(bo).toEqual([{ playerId: b, userId: "ub", squadId: expect.any(Number), placement: 5, coins: 0, crates: 0, recorded: true }]);
    L.runUntil(() => L.core.record.phase === "results", 3 * 3_600_000, "the results");
    const rewards = L.core.takeRewards();
    const ann = rewards.find((r) => r.playerId === a)!;
    expect(ann).toMatchObject({ userId: "ua", recorded: true, coins: SQUADS_LOBBY.rewards[ann.placement].coins, crates: SQUADS_LOBBY.rewards[ann.placement].crates });
    expect(ann.coins).toBeGreaterThan(0);
    // (Bo's row was written as he left: never his squad's later place, whatever it is.)
    expect(rewards.find((r) => r.playerId === b)).toBeUndefined();
    const cy = rewards.find((r) => r.playerId === c)!;
    expect(cy).toMatchObject({ userId: null, recorded: false });
    expect(L.last(a, "placed")).toMatchObject({ placement: ann.placement, coins: ann.coins, recorded: true });
    // Taken once: the Durable Object writes them and they're gone.
    expect(L.core.takeRewards()).toEqual([]);
  }, 120_000);
});

describe("squads lobby: bots' engine work on players' devices", () => {
  /**
   * A test lobby at round 1 with people whose devices take bot work (`phone`: which of them are phones), run past the
   * first turn (on the first, boards from the same start share one job) to the next half that gives `ids[0]` at least
   * `want` jobs.
   */
  function withDevices(n: number, opts: { server?: boolean; phones?: number[]; clock?: string; want?: number; first?: boolean } = {}) {
    const L = squadsLobby({ test: { start: 0, ...(opts.clock ? { clock: parseTestClock(opts.clock)! } : {}) }, fillInMs: 5_000, serverEngine: !!opts.server });
    const ids = Array.from({ length: n }, (_, i) => L.join(`D${i}`, { device: opts.phones?.includes(i) ? "phone" : "computer" }));
    ids.forEach((id, i) => L.core.message(id, { t: "speed", nps: 1_000_000 + i * 1000 }));
    L.advance(5_000 + VOTES_MS + SQUADS_LOBBY.bracketIntroSeconds * 1000);
    const jobs = (id: string) => L.all(id, "botWork").flatMap((w) => w.jobs);
    if (!opts.first) {
      L.runUntil(() => L.core.allMatches().every((m) => m.m.turn >= 1), 30 * 60_000, "the second turn");
      L.clear();
      L.runUntil(() => jobs(ids[0]!).length >= (opts.want ?? 2), 30 * 60_000, "jobs for the first device");
    }
    return { L, ids, jobs };
  }
  const jobOf = (L: ReturnType<typeof squadsLobby>, id: string) => {
    const [key, seq, board] = id.split("/");
    const lm = L.core.match(key!)!;
    return lm.half && String(lm.half.seq) === seq ? lm.half.work[Number(board)] : undefined;
  };

  it("two devices outside the match, computers first, each get a job; answers that agree are used (and remembered)", () => {
    const { L, ids, jobs } = withDevices(3, { phones: [2], want: 1 });
    // (The three people sit in one squad: in the other matches, their devices are outside the match.)
    const outside = L.core.allMatches().filter((m) => !ids.some((id) => mineIn(m, id)));
    L.runUntil(() => jobs(ids[0]!).some((j) => outside.some((m) => j.id.startsWith(`${m.key}/`))), 10 * 60_000, "a job outside");
    const job = jobs(ids[0]!).find((j) => outside.some((m) => j.id.startsWith(`${m.key}/`)))!;
    expect(jobs(ids[1]!).some((x) => x.id === job.id)).toBe(true);
    // Every device searches the same: the job says how deep.
    expect(job).toMatchObject({ n: SQUADS.bots.candidates, nodes: SQUADS_LOBBY.botWork.nodes });
    // The phone isn't asked while two computers can do it.
    expect(jobs(ids[2]!).some((x) => x.id === job.id)).toBe(false);
    const top = fallbackTop(job.fen, job.n);
    L.core.message(ids[0]!, { t: "botTop", id: job.id, top });
    expect(jobOf(L, job.id)!.how).toBeUndefined();
    L.core.message(ids[1]!, { t: "botTop", id: job.id, top });
    expect(jobOf(L, job.id)).toMatchObject({ how: "agreed", top });
  });

  it("boards in the same position share one job: its answer serves them all", () => {
    // (On the first turn, boards start alike: the same start, or each opening on two boards.)
    const { L, ids, jobs } = withDevices(2, { first: true });
    const followers = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {})).filter((j) => j.follows);
    expect(followers.length).toBeGreaterThan(0);
    const lead = followers[0]!.follows!;
    const job = jobs(ids[0]!).find((j) => j.id === lead)!;
    const top = fallbackTop(job.fen, job.n);
    for (const id of ids) L.core.message(id, { t: "botTop", id: job.id, top });
    for (const f of followers.filter((x) => x.follows === lead)) expect(f).toMatchObject({ how: expect.stringMatching(/agreed|cached/), top });
  });

  it("a device holds only so many unanswered jobs at once (a phone fewer); the rest wait for it, then go out", () => {
    const { L, ids } = withDevices(1, { phones: [0], want: 1 });
    let most = 0;
    let queued = 0;
    let sentLater = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const live = L.core.allMatches().flatMap((m) => Object.values(m.half?.work ?? {}));
      most = Math.max(most, live.filter((j) => !j.how && j.devices.includes(ids[0]!) && !(ids[0]! in j.answers)).length);
      for (const j of live) if (j.queued) seen.add(j.id);
      queued = seen.size;
      L.advance(250);
    }
    sentLater = L.all(ids[0]!, "botWork").flatMap((w) => w.jobs).filter((j) => seen.has(j.id)).length;
    expect(most).toBe(SQUADS_LOBBY.botWork.maxInFlight.phone);
    expect(queued).toBeGreaterThan(0);
    expect(sentLater).toBeGreaterThan(0);
  });

  it("one answer alone stands after the grace; none at all: the server's own quick look", () => {
    const { L, ids, jobs } = withDevices(2);
    const [j1, j2] = jobs(ids[0]!);
    L.core.message(ids[0]!, { t: "botTop", id: j1!.id, top: fallbackTop(j1!.fen, j1!.n) });
    L.advance(SQUADS_LOBBY.botWork.graceMs + 1);
    expect(jobOf(L, j1!.id)?.how).toBe("one");
    L.advance(SQUADS_LOBBY.botWork.answerMs);
    if (jobOf(L, j2!.id)) expect(jobOf(L, j2!.id)!.how).toBe("fallback");
  });

  it("two that disagree go to the engine server; the device further from its verdict gets a strike", () => {
    const { L, ids, jobs } = withDevices(2, { server: true });
    const job = jobs(ids[0]!)[0]!;
    const good = fallbackTop(job.fen, job.n);
    const bad = [...good].reverse().map((m, i) => ({ ...m, expected: i === 0 ? 0.99 : m.expected }));
    L.core.message(ids[0]!, { t: "botTop", id: job.id, top: good });
    L.core.message(ids[1]!, { t: "botTop", id: job.id, top: bad });
    const req = L.server.find((r) => r.id === job.id)!;
    expect(req.moves.length).toBeLessThanOrEqual(8);
    expect(req.moves).toContain(good[0]!.move);
    expect(req.moves).toContain(bad[0]!.move);
    L.core.serverAnswered(job.id, good.filter((m) => req.moves.includes(m.move)));
    expect(jobOf(L, job.id)?.how).toBe("server");
    expect(L.core.record.devices[ids[1]!]!.strikes).toBe(1);
    expect(L.core.record.devices[ids[0]!]!.strikes).toBe(0);
  });

  it("with no engine server, a third device referees; an answer that doesn't hold together is a strike, two and no more work", () => {
    const { L, ids, jobs } = withDevices(3);
    const job = jobs(ids[0]!).find((j) => jobs(ids[1]!).some((x) => x.id === j.id))!;
    const good = fallbackTop(job.fen, job.n);
    // (The devices answer everything else they hold first: a device holds only so many unanswered jobs.)
    answerAllBut(L, ids, job.id);
    L.core.message(ids[0]!, { t: "botTop", id: job.id, top: good });
    L.core.message(ids[1]!, { t: "botTop", id: job.id, top: good.slice().reverse() });
    const ref = L.core.match(job.id.split("/")[0]!)!.half!.work[Number(job.id.split("/")[2])]!.referee!;
    expect(ref).toBe(ids[2]);
    expect(L.last(ref, "botWork")!.jobs.map((j) => j.id)).toContain(job.id);
    L.core.message(ref, { t: "botTop", id: job.id, top: good });
    expect(jobOf(L, job.id)).toMatchObject({ how: "referee", top: good });
    expect(L.core.record.devices[ids[1]!]!.strikes).toBe(1);
    // Nonsense (an illegal move): a second strike, and that device gets no more work.
    const other = jobs(ids[1]!).find((j) => j.id !== job.id && !jobOf(L, j.id)?.how);
    if (other) {
      L.core.message(ids[1]!, { t: "botTop", id: other.id, top: [{ move: "a1a1", expected: 0.5 }] });
      expect(L.core.record.devices[ids[1]!]!.strikes).toBe(2);
      L.clear(ids[1]!);
      L.runUntil(() => L.all(ids[0]!, "turn").length > 4, 120_000, "more halves");
      expect(L.all(ids[1]!, "botWork")).toEqual([]);
    }
  });

  it("a bot waits for its devices' answer, then plays from it at once; with no answer, the quick look by its fallback moment", () => {
    // (A small bank, so bots think for a second or two: less than the devices may take to answer. A bigger one than that
    // would have bots outthink the devices; a smaller one puts squads in sudden death, where bots fall back at once.)
    const { L, ids, jobs } = withDevices(2, { clock: "60,0,2,0" });
    const found = jobs(ids[0]!)
      .map((job) => {
        const lm = L.core.match(job.id.split("/")[0]!)!;
        const board = Number(job.id.split("/")[2]);
        const work = lm.half?.work[board];
        if (!work || work.id !== job.id || work.how) return null;
        const bot = Object.keys(lm.half!.bots).find((b) => dutyBoard(lm, b) === board && lm.half!.startedAt + lm.half!.bots[b]! < work.sentAt + SQUADS_LOBBY.botWork.answerMs - 500);
        return bot ? { job, lm, board, bot } : null;
      })
      .filter((x) => !!x);
    expect(found.length).toBeGreaterThan(1);
    type Found = NonNullable<(typeof found)[0]>;
    const planned = (f: Found) => f.lm.half!.startedAt + f.lm.half!.bots[f.bot]!;
    // (Two bots in different matches, both still waiting once both thinking times have passed: before either's fallback
    // moment, which comes sooner in sudden death. Answering the first can end its half, if it was the last to act.)
    const fallbackAt = (f: Found) => f.lm.half!.startedAt + dutyOf(f.lm.m, f.bot)!.duty.deadlineMs - SQUADS_LOBBY.botWork.fallbackMarginMs;
    const pairs = (found as Found[]).flatMap((a) => (found as Found[]).filter((b) => b.lm !== a.lm && Math.max(planned(a), planned(b)) + 1 < Math.min(fallbackAt(a), fallbackAt(b))).map((b) => [a, b] as const));
    expect(pairs.length).toBeGreaterThan(0);
    const [first, second] = pairs[0]!;
    // Its thinking time has passed, but its candidates haven't come: it waits.
    L.advanceTo(Math.max(planned(first), planned(second)) + 1);
    expect(first.lm.half!.inputs.choices[first.bot]).toBeUndefined();
    // They come (two that agree): it plays at once, from them (its half may be played at once too, if it was the last).
    // (A bot sometimes plays a random legal move, as in every mode: so what's checked is that it chose now, from them.)
    const top = fallbackTop(first.job.fen, first.job.n);
    const seq = first.lm.half!.seq;
    const work = first.lm.half!.work[first.board]!;
    for (const id of ids) L.core.message(id, { t: "botTop", id: first.job.id, top });
    expect(work.how).toBe("agreed");
    expect(work.top!.map((m) => m.move)).toEqual(top.map((m) => m.move));
    const chosen = first.lm.half?.seq === seq ? first.lm.half.inputs.choices[first.bot] : L.all(ids[0]!, "half").find((h) => h.key === first.lm.key && h.seq === seq)?.events.find((e) => e.kind === "relay" && e.player === first.bot && !e.missed);
    expect(chosen).toBeDefined();
    // The other job is never answered: past the answer time, its bot plays from the server's quick look.
    const half = second.lm.half!;
    const other = half.work[second.board]!;
    L.advanceTo(Math.max(other.sentAt, half.startedAt) + SQUADS_LOBBY.botWork.answerMs + 1);
    expect(other.how).toBe("fallback");
    expect(half.inputs.choices[second.bot]).toBeDefined();
  });
});

/** Every device answers every job it holds (the quick look's moves, so they agree), but `keep`, until none is left. */
function answerAllBut(L: ReturnType<typeof squadsLobby>, ids: readonly string[], keep: string) {
  for (let round = 0; round < 100; round++) {
    let sent = 0;
    for (const lm of L.core.allMatches()) {
      for (const j of Object.values(lm.half?.work ?? {})) {
        if (j.how || j.id === keep) continue;
        for (const d of [...j.devices, ...(j.referee ? [j.referee] : [])]) {
          if (!ids.includes(d) || d in j.answers) continue;
          L.core.message(d, { t: "botTop", id: j.id, top: fallbackTop(j.fen, SQUADS.bots.candidates) });
          sent++;
        }
      }
    }
    if (!sent) return;
  }
}

/** The board a player acts on in the half being played. */
function dutyBoard(lm: LiveMatch, id: string): number | null {
  for (const d of lm.half ? halfDuties(lm.m).duties : []) if (d.players.includes(id)) return d.board;
  return null;
}
