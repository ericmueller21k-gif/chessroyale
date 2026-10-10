import { describe, expect, it } from "vitest";
import { SQUADS, botVotes, castPregameVote, closePregameVote, mulberry32 } from "@chessroyale/core";
import {
  drawBracket,
  formSquads,
  noteActions,
  pairSchedule,
  placements,
  playsAsBot,
  relayBoardOf,
  relaySeat,
  reportWinner,
  roundDecided,
  clockName,
  finalClockName,
  rulesFromVotes,
  squadsRng,
  squadsVotes,
  type Party,
  type SquadsEntrant,
} from "../src/squads/index.ts";

const person = (id: string): SquadsEntrant => ({ id, name: id, isBot: false, skill: null });
const party = (id: string, n: number): Party => ({ id, members: Array.from({ length: n }, (_, i) => person(`${id}-${i}`)) });
const bots = (n: number): SquadsEntrant[] => Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i}`, isBot: true, skill: 2 }));

describe("Squads: seeded randomness", () => {
  it("the same seed and name always give the same stream; any other name gives another", () => {
    const a = squadsRng(42, "r0m1", 3, "w", 2, "coin");
    const b = squadsRng(42, "r0m1", 3, "w", 2, "coin");
    const draws = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(draws);
    expect(squadsRng(42, "r0m1", 3, "w", 2, "miss")()).not.toBe(draws[0]);
    expect(squadsRng(43, "r0m1", 3, "w", 2, "coin")()).not.toBe(draws[0]);
  });

  it("coins from neighbouring names come out fair (no bias between similar names)", () => {
    let heads = 0;
    for (let t = 0; t < 2000; t++) heads += squadsRng(7, "r1m0", t, "w", 0, "coin")() < 0.5 ? 1 : 0;
    expect(heads / 2000).toBeGreaterThan(0.45);
    expect(heads / 2000).toBeLessThan(0.55);
  });
});

describe("Squads: forming the squads", () => {
  it("keeps parties together, puts people with people (best fit), and fills every empty seat with a bot", () => {
    const parties = [party("solo1", 1), party("p4", 4), party("solo2", 1), party("p2a", 2), party("p3", 3), party("solo3", 1), party("p2b", 2), party("solo4", 1), party("solo5", 1)];
    const { squads, waiting } = formSquads(parties, bots(32), mulberry32(1));
    expect(waiting).toEqual([]);
    expect(squads).toHaveLength(SQUADS.squadCount);
    for (const sq of squads) expect(sq.players).toHaveLength(SQUADS.squadSize);
    const where = (id: string) => squads.findIndex((sq) => sq.players.some((p) => p.id === id));
    // Each party in one squad.
    for (const p of parties) expect(new Set(p.members.map((m) => where(m.id))).size).toBe(1);
    // The party of 3 gets a solo player, not a bot; the two pairs share a squad.
    const p3 = squads[where("p3-0")]!;
    expect(p3.players.filter((p) => !p.isBot)).toHaveLength(4);
    expect(where("p2a-0")).toBe(where("p2b-0"));
    // 16 people fill exactly 4 squads; the other 4 squads are all bots.
    const people = squads.map((sq) => sq.players.filter((p) => !p.isBot).length).sort();
    expect(people).toEqual([0, 0, 0, 0, 4, 4, 4, 4]);
    expect(squads.flatMap((sq) => sq.players).filter((p) => p.isBot).every((p) => p.partyId === null && playsAsBot(p))).toBe(true);
  });

  it("parties that don't fit (too big, or no room left) wait for the next lobby", () => {
    const full = Array.from({ length: 8 }, (_, i) => party(`full${i}`, 4));
    const { squads, waiting } = formSquads([...full, party("late", 2), party("huge", 5)], bots(0), mulberry32(2));
    expect(squads.every((sq) => sq.players.every((p) => !p.isBot))).toBe(true);
    expect(waiting.map((p) => p.id).sort()).toEqual(["huge", "late"]);
  });

  it("seats are shuffled, the same way for the same seed", () => {
    const parties = [party("p4", 4)];
    const a = formSquads(parties, bots(28), mulberry32(5)).squads.map((sq) => sq.players.map((p) => p.id));
    const b = formSquads(parties, bots(28), mulberry32(5)).squads.map((sq) => sq.players.map((p) => p.id));
    expect(a).toEqual(b);
  });

  it("throws without enough bots to fill the seats", () => {
    expect(() => formSquads([party("p", 1)], bots(3), mulberry32(1))).toThrow(/bots/);
  });
});

describe("Squads: missed actions on a player's record", () => {
  it("logs every miss; three in a row hand the seat to a bot; acting resets the streak", () => {
    let squads = formSquads([party("p", 4)], bots(28), mulberry32(3)).squads;
    const me = "p-0";
    const rec = () => squads.flatMap((sq) => sq.players).find((p) => p.id === me)!;
    squads = noteActions(squads, [], [me]);
    squads = noteActions(squads, [], [me]);
    expect(rec()).toMatchObject({ misses: 2, missStreak: 2, replacedByBot: false });
    squads = noteActions(squads, [me], []);
    expect(rec()).toMatchObject({ misses: 2, missStreak: 0, replacedByBot: false });
    for (let i = 0; i < SQUADS.noShowsBeforeBot; i++) squads = noteActions(squads, [], [me]);
    expect(rec()).toMatchObject({ misses: 2 + SQUADS.noShowsBeforeBot, replacedByBot: true });
    expect(playsAsBot(rec())).toBe(true);
  });
});

describe("Squads: the bracket", () => {
  const ids = [0, 1, 2, 3, 4, 5, 6, 7];

  it("round 1 is 4 matches with every squad once; later rounds wait for winners", () => {
    const b = drawBracket(ids, mulberry32(9));
    expect(b.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(b[0]!.flatMap((m) => m.squads).sort()).toEqual(ids);
    expect(b[1]!.every((m) => m.squads.every((s) => s === null))).toBe(true);
    expect(() => drawBracket([0, 1, 2], mulberry32(1))).toThrow();
  });

  it("winners move on to the right slot; placements are 1st, 2nd, 3rd-4th and 5th-8th", () => {
    let b = drawBracket(ids, mulberry32(9));
    const r0 = b[0]!.map((m) => m.squads[0]!);
    r0.forEach((w, i) => (b = reportWinner(b, 0, i, w)));
    expect(roundDecided(b, 0)).toBe(true);
    expect(b[1]![0]!.squads).toEqual([r0[0], r0[1]]);
    expect(b[1]![1]!.squads).toEqual([r0[2], r0[3]]);
    b = reportWinner(b, 1, 0, r0[1]!);
    b = reportWinner(b, 1, 1, r0[2]!);
    expect(b[2]![0]!.squads).toEqual([r0[1], r0[2]]);
    b = reportWinner(b, 2, 0, r0[2]!);
    const place = placements(b);
    expect(place.get(r0[2]!)).toBe(1);
    expect(place.get(r0[1]!)).toBe(2);
    expect([place.get(r0[0]!), place.get(r0[3]!)]).toEqual([3, 3]);
    expect(b[0]!.map((m) => place.get(m.squads[1]!))).toEqual([5, 5, 5, 5]);
  });

  it("refuses a winner who isn't in the match, or a second result", () => {
    const b = drawBracket(ids, mulberry32(9));
    const [x, y] = b[0]![0]!.squads;
    const other = ids.find((i) => i !== x && i !== y)!;
    expect(() => reportWinner(b, 0, 0, other)).toThrow();
    expect(() => reportWinner(reportWinner(b, 0, 0, x!), 0, 0, x!)).toThrow();
  });
});

describe("Squads: pre-game votes", () => {
  const votes = squadsVotes();

  it("two votes: Start (3 options) and Clock (Fast, Normal, Long from settings)", () => {
    expect(votes.map((v) => v.id)).toEqual(["start", "clock"]);
    expect(votes[0]!.options.map((o) => o.rule.start)).toEqual(["standard", "same", "random"]);
    expect(votes[1]!.options.map((o) => o.rule.clock)).toEqual([...SQUADS.clocks]);
    expect(votes[1]!.options.map((o) => o.id)).toEqual(["fast", "normal", "long"]);
    const c = SQUADS.clocks[1]!;
    expect(votes[1]!.options[1]!.label).toBe(`Normal ${clockName(c)}`);
    expect(votes[1]!.options[1]!.blurb).toBe(`Rounds 1 and 2: ${clockName(c)}. The final: ${finalClockName(c)}`);
  });

  it("writes a clock the way chess players do", () => {
    expect(clockName({ bankSeconds: 240, incrementSeconds: 2 })).toBe("4+2");
    expect(clockName({ bankSeconds: 90, incrementSeconds: 1 })).toBe("1:30+1");
  });

  it("nobody voting gives the normal start and the Normal clock", () => {
    expect(rulesFromVotes({})).toEqual({ start: "standard", clock: SQUADS.clocks[SQUADS.clockDefault] });
    expect(SQUADS.clocks[SQUADS.clockDefault]!.id).toBe("normal");
    expect(rulesFromVotes({ start: 2, clock: 0 })).toEqual({ start: "random", clock: SQUADS.clocks[0] });
  });

  it("runs on Crowd's vote machinery: one vote each, bots vote, non-voters join the winner", () => {
    const clock = votes[1]!;
    const everyone = Array.from({ length: 32 }, (_, i) => `p${i}`);
    let cast: { playerId: string; option: number }[] = [];
    for (const v of botVotes(mulberry32(4), everyone.slice(0, 30), clock.options.length, SQUADS.voteSeconds * 1000, SQUADS.voteBotSkip)) {
      cast = castPregameVote(cast, { playerId: v.id, option: v.option }, false) ?? cast;
    }
    expect(castPregameVote(cast, { playerId: cast[0]!.playerId, option: (cast[0]!.option + 1) % 3 }, false)).toBeNull();
    const closed = closePregameVote(cast, everyone, clock, mulberry32(4), (playerId, option) => ({ playerId, option }));
    expect(closed.votes).toHaveLength(32);
    expect(closed.joined).toContain("p31");
    const counts = [0, 1, 2].map((o) => cast.filter((v) => v.option === o).length);
    expect(counts[closed.result]).toBe(Math.max(...counts));
    expect(rulesFromVotes({ clock: closed.result }).clock).toEqual(SQUADS.clocks[closed.result]);
  });
});

describe("Squads: the schedules", () => {
  it("Relay: every board gets one of a squad's players each turn, and everyone moves one board along", () => {
    for (let turn = 0; turn < 8; turn++) {
      const seats = [0, 1, 2, 3].map((board) => relaySeat(4, board, turn));
      expect([...seats].sort()).toEqual([0, 1, 2, 3]);
      for (let seat = 0; seat < 4; seat++) {
        expect(relaySeat(4, relayBoardOf(seat, turn), turn)).toBe(seat);
        expect(relayBoardOf(seat, turn + 1)).toBe((relayBoardOf(seat, turn) + 1) % 4);
      }
    }
    // One board (Armageddon): the seats take turns in order.
    expect([0, 1, 2, 3, 4, 5].map((t) => relaySeat(1, 0, t))).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it("pairs: partners cycle 1+2, 1+3, 1+4 and player 1's pair alternates slots", () => {
    const partnerOfOne = (t: number) => pairSchedule(t).find((p) => p.includes(0))!.find((x) => x !== 0);
    expect([0, 1, 2, 3, 4, 5].map(partnerOfOne)).toEqual([1, 2, 3, 1, 2, 3]);
    expect([0, 1, 2, 3].map((t) => pairSchedule(t)[t % 2]!.includes(0))).toEqual([true, true, true, true]);
    for (let t = 0; t < 12; t++) expect([...pairSchedule(t).flat()].sort()).toEqual([0, 1, 2, 3]);
  });

  it("pairs: over six turns each player has each slot three times (never more than three running), and all six pairs play each slot once", () => {
    for (let seat = 0; seat < 4; seat++) {
      const slots = Array.from({ length: 18 }, (_, t) => (pairSchedule(t)[0].includes(seat) ? 0 : 1));
      expect(slots.slice(0, 6).filter((x) => x === 0)).toHaveLength(3);
      let run = 1;
      for (let t = 1; t < slots.length; t++) {
        run = slots[t] === slots[t - 1] ? run + 1 : 1;
        expect(run).toBeLessThanOrEqual(3);
      }
    }
    for (const slot of [0, 1] as const) {
      const pairs = Array.from({ length: 6 }, (_, t) => [...pairSchedule(t)[slot]].sort().join("+"));
      expect(new Set(pairs).size).toBe(6);
    }
  });
});
