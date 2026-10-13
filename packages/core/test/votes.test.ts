import { describe, expect, it } from "vitest";
import {
  CROWD_SETTINGS,
  DEFAULT_SETTINGS,
  PREGAME_VOTES,
  VOTE_SPOT_MARGIN,
  allowedMs,
  applyRound,
  botThinkMs,
  botVotes,
  castPregameVote,
  clampToZone,
  closePregameVote,
  createMatch,
  modeSettings,
  moveClockAt,
  mulberry32,
  speedOption,
  startBanks,
  tallyVotes,
  voteHomeSpots,
  voteZoneAt,
  voteZoneBox,
  voteZoneCentre,
  voteZoneSpot,
  type MatchState,
  type Settings,
} from "../src/index.ts";

const crowd: Settings = { ...DEFAULT_SETTINGS, ...modeSettings("crowd", { crowdTeams: true }) };
const speed = PREGAME_VOTES.find((v) => v.id === "speed")!;
/** Crowd 50 v 50's settings once each time control has won the vote. */
const won = (option: number): Settings => ({ ...crowd, ...speed.options[option]!.patch });
const bullet = won(0);
const blitz = won(1);
const rapid = won(2);

describe("the clock vote: three chess time controls", () => {
  it("Bullet 3+2, Blitz 5+3, Rapid 10+5 from left to right; each patch sets the bank, the increment and the cap", () => {
    expect(speed.title).toBe("How fast?");
    expect(speed.options.map((o) => o.id)).toEqual(["bullet", "blitz", "rapid"]);
    expect(speed.options.map((o) => o.label)).toEqual(["Bullet 3+2", "Blitz 5+3", "Rapid 10+5"]);
    expect(speed.options.map((o) => o.blurb)).toEqual([
      "3 min + 2 s a move · max 10 s",
      "5 min + 3 s a move · max 15 s",
      "10 min + 5 s a move · max 20 s",
    ]);
    expect(speed.options.map((o) => o.patch)).toEqual([
      { timeBankSeconds: 180, timeIncrementSeconds: 2, moveClockSeconds: 10, moveClockSteps: [] },
      { timeBankSeconds: 300, timeIncrementSeconds: 3, moveClockSeconds: 15, moveClockSteps: [] },
      { timeBankSeconds: 600, timeIncrementSeconds: 5, moveClockSeconds: 20, moveClockSteps: [] },
    ]);
    // Nothing old is left in the vote.
    expect(speed.options.some((o) => /normal|variable|slow|rising/i.test(o.id + o.label + o.blurb))).toBe(false);
  });

  it("nobody votes: the middle option, Blitz", () => {
    expect(speed.defaultOption).toBe(1);
    expect(speed.options[speed.defaultOption]!.id).toBe("blitz");
    expect(tallyVotes([], 3, speed.defaultOption, mulberry32(1))).toBe(1);
  });

  it("Rapid is today's clock: the same as Crowd without the vote (votes off, everyone moves, raids)", () => {
    for (const k of ["timeBankSeconds", "timeIncrementSeconds", "moveClockSeconds"] as const) expect(rapid[k]).toBe(crowd[k]);
    expect(CROWD_SETTINGS.moveClockSeconds).toBe(20);
  });

  it("each cap is the same on every move; a rising schedule (none today) still works through moveClockAt", () => {
    for (const move of [1, 6, 21, 60]) {
      expect([bullet, blitz, rapid].map((s) => moveClockAt(s, move))).toEqual([10, 15, 20]);
      expect(moveClockAt(DEFAULT_SETTINGS, move)).toBe(DEFAULT_SETTINGS.moveClockSeconds);
    }
    // A schedule, in any order: the step a move falls in (the first step before it starts).
    const rising = { ...crowd, moveClockSteps: [{ fromMove: 6, seconds: 15 }, { fromMove: 1, seconds: 10 }] };
    expect([0, 1, 5, 6, 40].map((m) => moveClockAt(rising, m))).toEqual([10, 10, 10, 15, 15]);
    // A time control's patch clears a schedule.
    expect(moveClockAt({ ...rising, ...speed.options[0]!.patch }, 6)).toBe(10);
  });

  it("old ?speed= ids map to the new ones; an unknown id gets the default; no id is nothing", () => {
    const id = (x: string | null | undefined) => speedOption(x)?.id ?? null;
    expect(["normal", "variable", "bullet"].map(id)).toEqual(["rapid", "blitz", "bullet"]);
    // Older still: Slow and Standard were Normal.
    expect(["slow", "standard"].map(id)).toEqual(["rapid", "rapid"]);
    expect(["bullet", "blitz", "rapid", "BLITZ", "Rapid"].map(id)).toEqual(["bullet", "blitz", "rapid", "blitz", "rapid"]);
    expect(["ludicrous", "constructor", "__proto__", "toString", " "].map(id)).toEqual(["blitz", "blitz", "blitz", "blitz", "blitz"]);
    expect([null, undefined, ""].map(id)).toEqual([null, null, null]);
  });
});

describe("the bank and the increment, as on a chess clock", () => {
  const entrants = [
    { id: "me", name: "Me", isBot: false },
    { id: "bot", name: "Bot", isBot: true },
  ];
  /** A match on these settings, and one move of `thinkMs` for "me" at a time. */
  const match = (s: Settings) => {
    let state: MatchState = createMatch(entrants, [0], s);
    const groups = new Map([[0, ["me"]]]);
    return {
      me: () => state.players[0]!,
      play: (thinkMs: number) => (state = applyRound(state, groups, [{ playerId: "me", roundScore: 0, loss: 0, thinkMs }], s)),
      set: (bankMs: number) => (state = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, bankMs } : p)) }),
    };
  };

  it("a fresh bank: each move may take its cap", () => {
    for (const s of [bullet, blitz, rapid]) expect(allowedMs({ bankMs: s.timeBankSeconds * 1000 }, s)).toBe(s.moveClockSeconds * 1000);
  });

  it("a quick move banks what the increment didn't use; a slow one pays the rest from the bank", () => {
    const m = match(bullet);
    expect(m.me().bankMs).toBe(180_000);
    m.play(500); // 180 + 2 - 0.5
    expect(m.me().bankMs).toBe(181_500);
    m.play(2_000); // the increment exactly: no change
    expect(m.me().bankMs).toBe(181_500);
    m.play(7_000); // 5 s from the bank
    expect(m.me().bankMs).toBe(176_500);
    // The bank isn't capped at its start: quick moves can take it past 3:00, as in chess.
    const r = match(rapid);
    for (let i = 0; i < 10; i++) r.play(1_000);
    expect(r.me().bankMs).toBe(640_000);
  });

  it("no move takes longer than its cap: a longer think is charged at the cap", () => {
    for (const s of [bullet, blitz, rapid]) {
      const m = match(s);
      m.play(60_000);
      expect(m.me().bankMs).toBe((s.timeBankSeconds + s.timeIncrementSeconds - s.moveClockSeconds) * 1000);
    }
  });

  it("an empty bank still leaves the increment to move; it never goes below zero", () => {
    const m = match(bullet);
    m.set(3_000);
    expect(allowedMs(m.me(), bullet)).toBe(5_000); // 3 s + 2 s, under the 10 s cap
    m.play(9_000); // charged at the 5 s it had
    expect(m.me().bankMs).toBe(0);
    expect(allowedMs(m.me(), bullet)).toBe(2_000);
    m.play(2_000);
    expect(m.me().bankMs).toBe(0);
    m.play(500); // a quick move on an empty bank still banks the rest
    expect(m.me().bankMs).toBe(1_500);
  });

  it("the calibration: at a normal pace (7-8 s a move) every option lasts the 20 moves before the final; at the cap, Bullet runs dry first", () => {
    const BEFORE_FINAL = 20;
    const left = (s: Settings, thinkMs: number) => {
      const m = match(s);
      for (let i = 0; i < BEFORE_FINAL; i++) m.play(thinkMs);
      return m.me().bankMs;
    };
    for (const s of [bullet, blitz, rapid]) expect(left(s, 8_000)).toBeGreaterThan(0);
    expect([bullet, blitz, rapid].map((s) => left(s, 7_000) / 1000)).toEqual([80, 220, 560]);
    // At the cap every move: Rapid keeps half, Blitz a minute, Bullet is out just before move 23 (180 / 8 = 22.5).
    expect([bullet, blitz, rapid].map((s) => left(s, 60_000) / 1000)).toEqual([20, 60, 300]);
    // Bullet 2+1 would run a 7-8 s player dry before the final: why Bullet is 3+2 (DECISIONS.md).
    expect(left({ ...bullet, timeBankSeconds: 120, timeIncrementSeconds: 1 }, 8_000)).toBe(0);
  });

  it("a time control chosen before move 1 sets every bank; once a move is played, banks are never reset", () => {
    const state = createMatch(entrants, [0], crowd);
    expect(state.players.map((p) => p.bankMs)).toEqual([600_000, 600_000]);
    const voted = startBanks(state, blitz);
    expect(voted.players.map((p) => p.bankMs)).toEqual([300_000, 300_000]);
    const later = { ...voted, round: 1 };
    expect(startBanks(later, bullet)).toBe(later);
    // (A new stage starts its round count at 0 again: still not before move 1.)
    const nextStage = { ...voted, stage: 1, round: 0 };
    expect(startBanks(nextStage, bullet)).toBe(nextStage);
  });

  it("the bots think within 85% of the cap", () => {
    const rng = mulberry32(4);
    for (const s of [bullet, blitz, rapid]) {
      const think = Array.from({ length: 300 }, () => botThinkMs(rng, s, 1));
      expect(Math.max(...think)).toBeLessThanOrEqual(Math.min(s.botThinkSeconds[1], 0.85 * s.moveClockSeconds) * 1000);
      expect(Math.min(...think)).toBeGreaterThanOrEqual(s.botThinkSeconds[0] * 1000);
    }
  });
});

describe("pre-game votes: one vote each", () => {
  it("one vote each: the first counts; with voteChangeAllowed a later one replaces it", () => {
    expect(DEFAULT_SETTINGS.voteChangeAllowed).toBe(false);
    const first = castPregameVote([], { playerId: "me", option: 0 }, false)!;
    expect(first).toEqual([{ playerId: "me", option: 0 }]);
    expect(castPregameVote(first, { playerId: "me", option: 2 }, false)).toBeNull();
    expect(castPregameVote(first, { playerId: "me", option: 2 }, true)).toEqual([{ playerId: "me", option: 2 }]);
    expect(castPregameVote(first, { playerId: "me", option: 0 }, true)).toBeNull();
    expect(castPregameVote(first, { playerId: "you", option: 1 }, false)).toHaveLength(2);
  });
});

describe("time's up: everyone who didn't vote joins the winner", () => {
  const format = PREGAME_VOTES.find((v) => v.id === "format")!;
  const join = (playerId: string, option: number) => ({ playerId, option, joined: true as const });
  const everyone = ["ann", "bo", "cy", "di", "ed"];

  it("a tie is broken first (the same draw as the count alone), then the non-voters join the winner", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const cast = [
        { playerId: "ann", option: 0 },
        { playerId: "bo", option: 2 },
      ];
      const { result, votes, joined } = closePregameVote(cast, everyone, format, mulberry32(seed), join);
      // The non-voters never change the outcome: it's the tie's own draw.
      expect(result).toBe(tallyVotes([0, 2], 3, format.defaultOption, mulberry32(seed)));
      expect([0, 2]).toContain(result);
      seen.add(result);
      expect(joined).toEqual(["cy", "di", "ed"]);
      // The voters keep their votes; each non-voter is counted once, with the winner.
      expect(votes.slice(0, 2)).toEqual(cast);
      expect(votes.slice(2)).toEqual(joined.map((id) => ({ playerId: id, option: result, joined: true })));
      expect(votes.filter((v) => v.option === result)).toHaveLength(4);
      expect(votes.filter((v) => v.option !== result)).toHaveLength(1);
    }
    // Either side of the tie can win.
    expect([...seen].sort()).toEqual([0, 2]);
  });

  it("a clear winner stays the winner, however many didn't vote", () => {
    const cast = [
      { playerId: "ann", option: 1 },
      { playerId: "bo", option: 1 },
      { playerId: "cy", option: 2 },
    ];
    const many = [...everyone, ...Array.from({ length: 95 }, (_, i) => `bot${i}`)];
    const { result, votes } = closePregameVote(cast, many, format, mulberry32(5), join);
    expect(result).toBe(1);
    expect(votes).toHaveLength(100);
    expect(votes.filter((v) => v.option === 1)).toHaveLength(99);
  });

  it("nobody votes: the option's default wins (Team final, Blitz) and everyone goes there", () => {
    const labels = PREGAME_VOTES.map((vote) => {
      const { result, votes, joined } = closePregameVote([], everyone, vote, mulberry32(3), join);
      expect(result).toBe(vote.defaultOption);
      expect(joined).toEqual(everyone);
      expect(votes.map((v) => v.option)).toEqual(everyone.map(() => vote.defaultOption));
      return vote.options[result]!.label;
    });
    expect(labels).toEqual(["Team final", "Blitz 5+3"]);
  });

  it("everyone voted: nobody joins", () => {
    const cast = everyone.map((playerId, i) => ({ playerId, option: i % 3 }));
    const { votes, joined } = closePregameVote(cast, everyone, format, mulberry32(8), join);
    expect(joined).toEqual([]);
    expect(votes).toEqual(cast);
  });

  it("a few bots don't vote (voteBotSkip); none skip with it at 0", () => {
    const ids = Array.from({ length: 99 }, (_, i) => `bot${i}`);
    expect(DEFAULT_SETTINGS.voteBotSkip).toBeGreaterThan(0);
    let skipped = 0;
    for (let seed = 1; seed <= 20; seed++) skipped += 99 - botVotes(mulberry32(seed), ids, 3, 8000, DEFAULT_SETTINGS.voteBotSkip).length;
    expect(skipped / (20 * 99)).toBeCloseTo(DEFAULT_SETTINGS.voteBotSkip, 1);
    expect(botVotes(mulberry32(1), ids, 3, 8000, 0)).toHaveLength(99);
    expect(botVotes(mulberry32(1), ids, 3, 8000)).toHaveLength(99);
  });
});

describe("the vote board", () => {
  const players = Array.from({ length: 100 }, (_, i) => ({ id: `p${i * 7919}`, side: (i % 2 ? "b" : "w") as "w" | "b" }));
  const spots = voteHomeSpots(players);
  const m = VOTE_SPOT_MARGIN;

  it("White's pawns start on ranks 1-2 and Black's on ranks 7-8, inside the board's edges", () => {
    expect(spots.size).toBe(100);
    for (const p of players) {
      const s = spots.get(p.id)!;
      expect(s.x).toBeGreaterThanOrEqual(m);
      expect(s.x).toBeLessThanOrEqual(8 - m);
      if (p.side === "w") {
        expect(s.y).toBeGreaterThanOrEqual(m);
        expect(s.y).toBeLessThanOrEqual(2 - m);
      } else {
        expect(s.y).toBeGreaterThanOrEqual(6 + m);
        expect(s.y).toBeLessThanOrEqual(8 - m);
      }
    }
  });

  it("each pawn keeps its spot: the same every time, whatever order the players come in", () => {
    const again = voteHomeSpots([...players].reverse());
    for (const p of players) expect(again.get(p.id)).toEqual(spots.get(p.id));
  });

  it("50 a side spread over the whole band (no clumps): every square of ranks 1-2 has a pawn near it", () => {
    const white = players.filter((p) => p.side === "w").map((p) => spots.get(p.id)!);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) expect(white.some((s) => Math.floor(s.x) === x && Math.floor(s.y) === y)).toBe(true);
    // And not on a grid: no two pawns share a spot.
    expect(new Set(white.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)}`)).size).toBe(white.length);
  });

  it("zones: b-c, d-e, f-g on ranks 4-5; voters land inside, White on the rank-4 half and Black on the rank-5 half", () => {
    expect([0, 1, 2].map(voteZoneBox)).toEqual([
      { x0: 1, x1: 3, y0: 3, y1: 5 },
      { x0: 3, x1: 5, y0: 3, y1: 5 },
      { x0: 5, x1: 7, y0: 3, y1: 5 },
    ]);
    for (const option of [0, 1, 2]) {
      for (let k = 0; k < 50; k++) {
        const w = voteZoneSpot(option, "w", k);
        const b = voteZoneSpot(option, "b", k);
        expect(voteZoneAt(w)).toBe(option);
        expect(voteZoneAt(b)).toBe(option);
        expect(w.y).toBeLessThan(4);
        expect(b.y).toBeGreaterThan(4);
      }
      expect(voteZoneAt(voteZoneCentre(option, "w"))).toBe(option);
      // Your pawn dropped on the zone's edge: nudged inside, on your side's half (wherever you let go up and down).
      const z = voteZoneBox(option);
      const w = clampToZone(option, { x: z.x0, y: z.y1 }, "w");
      expect(w.x).toBeCloseTo(z.x0 + 0.46);
      expect(w.y).toBe(3.5);
      const b = clampToZone(option, { x: z.x1 - 0.7, y: z.y0 }, "b");
      expect(b.x).toBeCloseTo(z.x1 - 0.7);
      expect(b.y).toBe(4.5);
    }
  });
});
