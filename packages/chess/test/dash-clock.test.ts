import { describe, expect, it } from "vitest";
import { BOSS_POWERS, DASH_HANG_ON, type BossPowerState } from "@chessroyale/core";
import { DASH, DASH_FX, clockHitOn, clockHitTurns, hangOnClock, hangOnPending, hangOnTimeline, popOffHolding, popOffMs, popOffPending, popOffTurns } from "../src/bosses/dash.ts";
import { POWER_FX } from "../src/index.ts";

/**
 * Dash's clock (Eric, Nov 7; docs/decisions/2026-11-07-dash-clock.md): the multi-hit every 4 or 5 of his moves, and the pop-off, whose
 * second turn is his "Hang on" since Nov 26 (docs/decisions/2026-11-26-dash-hang-on.md).
 */
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Plays Dash's turns 1..turns through his everyTurn hook (no battle: the schedule alone), returning what each turn set. */
function simulate(seed: number, test = "", turns = 60) {
  const next = { dash: { slaps: 0, stolen: 0, flags: 0 }, charge: 0, lost: 0, rageUsed: 0, events: [] } as unknown as BossPowerState;
  const hits: number[] = [];
  const popAt: number[] = [];
  const hangAt: number[] = [];
  for (let turn = 1; turn <= turns; turn++) {
    const events: { kind: string; count?: number; turn: number }[] = [];
    const t = { turn, fen: START, crowd: "w", seed, passive: "clockslap", ultimate: "scramble", test, ultNext: false, lastMove: null, rageSpeed: 1, s: BOSS_POWERS, events } as never;
    DASH.everyTurn!(next, t);
    if (next.dash?.popOff?.at === turn) (next.dash.popOff.hangOn ? hangAt : popAt).push(turn);
    for (const e of events) if (e.kind === "clockFit") {
      hits.push(turn);
      expect(e.count).toBe(BOSS_POWERS.dashClockFit.smacks);
    }
  }
  return { hits, popAt, hangAt, popOff: next.dash?.popOff ?? null };
}

describe("Dash's clock multi-hit (Eric, Nov 7: every four or five turns, five quick smacks, always a line)", () => {
  it("lands every 4 or 5 of his own moves, the first after 4 or 5 too, from the seed (the same on every device)", () => {
    const gaps = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const hits = clockHitTurns(seed, 200);
      expect(hits).toEqual(clockHitTurns(seed, 200));
      expect(hits.length).toBeGreaterThanOrEqual(40);
      let last = 0;
      for (const t of hits) {
        gaps.add(t - last);
        expect([4, 5]).toContain(t - last);
        last = t;
      }
    }
    // (Random in that range: both 4 and 5 come up across seeds.)
    expect([...gaps].sort()).toEqual([4, 5]);
  });

  it("the settings: every 4 to 5 of his moves, five smacks", () => {
    expect(BOSS_POWERS.dashClockFit).toMatchObject({ every: [4, 5], smacks: 5 });
  });

  it("the rule's events: a clockFit with its five smacks on exactly those turns, and no others", () => {
    for (const seed of [0, 1, 7, 42]) {
      const { hits } = simulate(seed, "", 60);
      expect(hits).toEqual(clockHitTurns(seed, 60));
    }
  });

  it("the test switch (?power=clockfit) adds one on his second turn, as well as the schedule", () => {
    expect(clockHitOn(3, 2, BOSS_POWERS.dashClockFit, "clockfit")).toBe(true);
    expect(clockHitOn(3, 2, BOSS_POWERS.dashClockFit, "")).toBe(clockHitTurns(3, 2).includes(2));
    expect(simulate(3, "clockfit", 6).hits).toContain(2);
  });
});

describe("Dash's pop-off (Eric, Nov 7: once a battle; Eric, Nov 8: twice, before his move lands; Eric, Nov 26: the second is his \"Hang on\")", () => {
  it("two turns a battle from 8 to 20, at least 6 apart, in order (from the seed): the first his pop-off, the second his \"Hang on\" (never a second pop-off)", () => {
    const { from, to, gap } = BOSS_POWERS.dashPopOff;
    expect([from, to, gap]).toEqual([8, 20, 6]);
    for (let seed = 0; seed < 300; seed++) {
      const [a, b] = popOffTurns(seed);
      for (const at of [a, b]) {
        expect(at).toBeGreaterThanOrEqual(from);
        expect(at).toBeLessThanOrEqual(to);
      }
      expect(b - a).toBeGreaterThanOrEqual(gap);
      const sim = simulate(seed, "", 60);
      expect(sim.popAt).toEqual([a]);
      expect(sim.hangAt).toEqual([b]);
      expect(sim.popOff).toEqual({ at: b, hangOn: true });
    }
  });

  it("the two turns differ across seeds (not always the same pair)", () => {
    const pairs = new Set<string>();
    for (let seed = 0; seed < 50; seed++) pairs.add(popOffTurns(seed).join(","));
    expect(pairs.size).toBeGreaterThan(10);
  });

  it("the test switches: ?power=popoff, the pop-off on his second turn and the \"Hang on\" on his fourth; ?power=hangon, the \"Hang on\" alone on his second", () => {
    expect(simulate(5, "popoff", 9)).toMatchObject({ popAt: [2], hangAt: [4] });
    expect(simulate(5, "hangon", 9)).toMatchObject({ popAt: [], hangAt: [2] });
  });

  it("two beats of 4 to 6 seconds in all (3 smacks and the pop-off line, then 10 fast smacks and the love line)", () => {
    expect(BOSS_POWERS.dashPopOff).toMatchObject({ smacks: 3, hits: 10 });
    expect(POWER_FX.popOff + POWER_FX.popOffFast).toBe(DASH_FX.popOff + DASH_FX.popOffFast);
    const total = DASH_FX.popOff + DASH_FX.popOffFast;
    expect(total).toBeGreaterThanOrEqual(4000);
    expect(total).toBeLessThanOrEqual(6000);
    // (The fast beat is faster than the slow one, a smack for smack.)
    expect(BOSS_POWERS.dashPopOff.hitMs).toBeLessThan(BOSS_POWERS.dashClockFit.smackMs);
  });

  it("cheetah speed is his fastest smack of all (Eric, Nov 26: \"a ridiculous speed\"): quicker than the pop-off's, the multi-hit's and the Rush's, and the gag's own slow ones", () => {
    expect(DASH_HANG_ON.hitMs).toBeLessThan(Math.min(BOSS_POWERS.dashPopOff.hitMs, BOSS_POWERS.dashClockFit.smackMs, DASH_HANG_ON.slowTo));
  });

  it("holds his thinking only while he thinks after your move of the turn it comes, both beats (popOffMs), and never for another boss", () => {
    const at = 9;
    // (While he thinks after your move: your move counted, crowdMoves the turn.)
    const on = { id: "dash", crowdMoves: at, powers: { turn: at, dash: { popOff: { at } } } };
    expect(popOffMs(on)).toBe(DASH_FX.popOff + DASH_FX.popOffFast);
    expect(popOffMs({ ...on, crowdMoves: at + 1, powers: { ...on.powers, turn: at + 1 } })).toBe(0);
    expect(popOffMs({ ...on, id: "moo" })).toBe(0);
    expect(popOffMs({ id: "dash", crowdMoves: at, powers: { turn: at, dash: { popOff: null } } })).toBe(0);
    // (His extra move after a failed Scramble Rush, before your move of that turn: neither plays, nor holds it.)
    expect(popOffPending({ ...on, crowdMoves: at - 1 })).toBe(false);
    expect(popOffMs({ ...on, crowdMoves: at - 1 })).toBe(0);
  });

  it("keeps his move's row out of the move list while he thinks after your move (and as his move lands), never in his extra move's thinking before yours (the review's nit 2, Nov 27)", () => {
    const at = 9;
    const on = { id: "dash", crowdMoves: at, powers: { turn: at, dash: { popOff: { at } } } };
    expect(popOffHolding(on)).toBe(true);
    // (His move played, the runner's turn on: still held while its beats end.)
    expect(popOffHolding({ ...on, powers: { ...on.powers, turn: at + 1 } })).toBe(true);
    // (His extra move's thinking after a failed Rush on the pop-off's turn, your move of it not yet made: his last move stays listed.)
    expect(popOffHolding({ ...on, crowdMoves: at - 1 })).toBe(false);
    expect(popOffHolding({ ...on, powers: { ...on.powers, turn: at + 2 } })).toBe(false);
    expect(popOffHolding({ ...on, id: "moo" })).toBe(false);
  });
});

describe("Dash's \"Hang on\" (Eric, Nov 26: in the second pop-off's place; screen only)", () => {
  const at = 14;
  const hang = { id: "dash", crowdMoves: at, powers: { turn: at, dash: { popOff: { at, hangOn: true as const } } } };

  it("holds his move for its whole timeline and a margin (the server's think and solo's alike: popOffMs), only while he thinks after your move", () => {
    const tl = hangOnTimeline();
    expect(hangOnPending(hang)).toBe(true);
    expect(popOffMs(hang)).toBe(tl.total + DASH_HANG_ON.tailMs);
    // (The first pop-off isn't it; nor his extra move's thinking before your move; nor the turn after.)
    expect(hangOnPending({ ...hang, powers: { ...hang.powers, dash: { popOff: { at } } } })).toBe(false);
    expect(popOffMs({ ...hang, crowdMoves: at - 1 })).toBe(0);
    expect(popOffMs({ ...hang, crowdMoves: at + 1, powers: { ...hang.powers, turn: at + 1 } })).toBe(0);
  });

  it("its beats in Eric's order and about his times: a few seconds more than round 1's 12.6 s, mostly cheetah speed, 6 to 8 s in; the piece back early and home last", () => {
    const tl = hangOnTimeline();
    expect(tl.beats).toEqual([0, tl.backAt, tl.landAt, tl.cheetahAt, tl.almostAt, tl.windAt, tl.sorryAt, tl.returnAt]);
    for (let i = 1; i < tl.beats.length; i++) expect(tl.beats[i]!).toBeGreaterThan(tl.beats[i - 1]!);
    expect(tl.cheetahAt).toBeGreaterThanOrEqual(6000);
    expect(tl.cheetahAt).toBeLessThanOrEqual(8000);
    // (Round 2, Eric: "the whole thing should have lasted like a few more seconds": 2 to 4 s more, most of it cheetah speed.)
    expect(tl.total).toBeGreaterThanOrEqual(12_600 + 2000);
    expect(tl.total).toBeLessThanOrEqual(12_600 + 4000);
    expect(tl.windAt - tl.cheetahAt).toBeGreaterThanOrEqual(5000);
    // (He lands on the board's middle within the first second, before his first smack.)
    expect(tl.landAt).toBeLessThan(1000);
    expect(tl.backAt).toBeLessThan(1000);
    expect(tl.upAt).toBeLessThanOrEqual(tl.returnAt);
    expect(tl.total - tl.returnAt).toBe(DASH_HANG_ON.returnMs);
    // (Its moments' lengths, from the timeline: back to back, the four filling it.)
    expect([POWER_FX.hangOn, POWER_FX.hangOnFast, POWER_FX.hangOnAlmost, POWER_FX.hangOnSorry]).toEqual([tl.cheetahAt, tl.almostAt - tl.cheetahAt, tl.windAt - tl.almostAt, tl.total - tl.windAt]);
  });

  it("your clock as it shows it: as it was until your piece goes back, then ticking down (never under 0), then given back to exactly what it was", () => {
    const tl = hangOnTimeline();
    const real = 61_000;
    expect(hangOnClock(real, 0)).toBe(real);
    expect(hangOnClock(real, tl.backAt + 5000)).toBe(real - 5000);
    expect(hangOnClock(real, tl.sorryAt - 1)).toBe(real - (tl.sorryAt - 1 - tl.backAt));
    // (Given back: rising from where it got to, all of it back by upAt, and held there.)
    const low = real - (tl.sorryAt - tl.backAt);
    const mid = hangOnClock(real, (tl.sorryAt + tl.upAt) / 2);
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeLessThan(real);
    for (const t of [tl.upAt, tl.returnAt, tl.total]) expect(hangOnClock(real, t)).toBe(real);
    // (Little left: it stops at 0, then comes back.)
    expect(hangOnClock(2000, tl.windAt)).toBe(0);
    expect(hangOnClock(2000, tl.upAt)).toBe(2000);
  });
});
