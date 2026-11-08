import { describe, expect, it } from "vitest";
import { BOSS_POWERS, type BossPowerState } from "@chessroyale/core";
import { DASH, DASH_FX, clockHitOn, clockHitTurns, popOffMs, popOffTurns } from "../src/bosses/dash.ts";
import { POWER_FX } from "../src/index.ts";

/** Dash's clock (Eric, Nov 7; docs/decisions/2026-11-07-dash-clock.md): the multi-hit every 4 or 5 of his moves, and the pop-off once. */
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Plays Dash's turns 1..turns through his everyTurn hook (no battle: the schedule alone), returning what each turn set. */
function simulate(seed: number, test = "", turns = 60) {
  const next = { dash: { slaps: 0, stolen: 0, flags: 0 }, charge: 0, lost: 0, rageUsed: 0, events: [] } as unknown as BossPowerState;
  const hits: number[] = [];
  const popAt: number[] = [];
  for (let turn = 1; turn <= turns; turn++) {
    const events: { kind: string; count?: number; turn: number }[] = [];
    const t = { turn, fen: START, crowd: "w", seed, passive: "clockslap", ultimate: "scramble", test, ultNext: false, lastMove: null, rageSpeed: 1, s: BOSS_POWERS, events } as never;
    DASH.everyTurn!(next, t);
    if (next.dash?.popOff?.at === turn) popAt.push(turn);
    for (const e of events) if (e.kind === "clockFit") {
      hits.push(turn);
      expect(e.count).toBe(BOSS_POWERS.dashClockFit.smacks);
    }
  }
  return { hits, popAt, popOff: next.dash?.popOff ?? null };
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

describe("Dash's pop-off (Eric, Nov 7: once a battle; Eric, Nov 8: twice, before his move lands)", () => {
  it("two pop-offs a battle, on two of his turns from 8 to 20, at least 6 apart, distinct, in order (from the seed)", () => {
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
      expect(sim.popAt).toEqual([a, b]);
      expect(sim.popOff).toEqual({ at: b });
    }
  });

  it("the two turns differ across seeds (not always the same pair)", () => {
    const pairs = new Set<string>();
    for (let seed = 0; seed < 50; seed++) pairs.add(popOffTurns(seed).join(","));
    expect(pairs.size).toBeGreaterThan(10);
  });

  it("the test switch (?power=popoff): on his second and eighth turns", () => {
    expect(simulate(5, "popoff", 9).popAt).toEqual([2, 8]);
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

  it("holds his thinking only while he thinks for the turn it comes, both beats (popOffMs), and never for another boss", () => {
    const at = 9;
    const on = { id: "dash", powers: { turn: at, dash: { popOff: { at } } } };
    expect(popOffMs(on)).toBe(DASH_FX.popOff + DASH_FX.popOffFast);
    expect(popOffMs({ ...on, powers: { ...on.powers, turn: at + 1 } })).toBe(0);
    expect(popOffMs({ ...on, id: "moo" })).toBe(0);
    expect(popOffMs({ id: "dash", powers: { turn: at, dash: { popOff: null } } })).toBe(0);
  });
});
