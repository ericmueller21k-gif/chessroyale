import { describe, expect, it } from "vitest";
import { CRATE_OPEN, TIERS } from "@chessroyale/core";
import { STRIPS, clickTimes, cues, flapLevel, timeline } from "../src/crate-open/timeline.ts";
import { CRATE_SOUNDS, TIER_SOUNDS, crateSound } from "../src/crate-open/sounds.ts";

/** The crate opening (Nov 24; docs/decisions/2026-11-24-crate-open-build.md): its timeline, its clicks and its sounds. */
describe("the crate opening", () => {
  const T = timeline();
  const clicks = clickTimes(T.spinMs, 360, STRIPS.crate.land);

  it("spins for CRATE_OPEN.spinMs, its beats in order, the box's only with a box", () => {
    expect(T.spinMs).toBe(CRATE_OPEN.spinMs);
    expect([T.stop, T.dropAt, T.landAt, T.burstAt, T.riseAt, T.cardAt]).toEqual([T.stop, T.dropAt, T.landAt, T.burstAt, T.riseAt, T.cardAt].sort((a, b) => a - b));
    const beam = timeline(undefined, false);
    expect(beam.burstAt).toBeLessThan(T.burstAt);
  });

  it("clicks at every tile edge, slower and slower, the last late in the spin (the near-edge creep), none after the overshoot", () => {
    expect(clicks.length).toBeGreaterThan(30);
    for (let i = 1; i < clicks.length; i++) expect(clicks[i]! - clicks[i - 1]!).toBeGreaterThan(0);
    const gaps = clicks.slice(1).map((c, i) => c - clicks[i]!);
    expect(gaps.at(-1)!).toBeGreaterThan(gaps[0]! * 5);
    expect(clicks.at(-1)! / T.spinMs).toBeGreaterThan(0.7);
    expect(clicks.at(-1)!).toBeLessThanOrEqual(T.spinMs);
  });

  it("cues every click, the rest at the stop, and (with an item) the box and the tier's sting; Fischer Random's first strip none of those", () => {
    const all = cues(T, clicks, "rare");
    expect(all.filter((c) => c.sound.startsWith("flap"))).toHaveLength(clicks.length);
    expect(all.map((c) => c.sound)).toEqual(expect.arrayContaining(["whirr", "rest", "land", "shake-rare", "sting-rare"]));
    expect(all.find((c) => c.sound === "sting-rare")!.at).toBe(T.burstAt);
    const first = cues(T, clicks, null).map((c) => c.sound);
    expect(first.some((s) => /land|shake|sting/.test(s))).toBe(false);
    const beam = cues(timeline(undefined, false), clicks, "mythic").map((c) => c.sound);
    expect(beam).toContain("sting-mythic");
    expect(beam.some((s) => /land|shake/.test(s))).toBe(false);
    expect([flapLevel(10), flapLevel(300)]).toEqual([0, 5]);
  });

  it("makes every piece, finite and under its ceiling; the sting is the loudest, Legendary's bigger than Common's", () => {
    const rate = 24000;
    const peak = (n: string) => crateSound(n, rate).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const rms = (n: string) => {
      const x = crateSound(n, rate);
      return Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    };
    for (const n of [...CRATE_SOUNDS, ...TIER_SOUNDS]) {
      const x = crateSound(n, rate);
      expect(x.length, n).toBeGreaterThan(0);
      expect(x.every(Number.isFinite), n).toBe(true);
      expect(peak(n), n).toBeLessThan(0.6);
    }
    expect(TIER_SOUNDS).toHaveLength(TIERS.length * 2);
    expect(peak("sting-common")).toBeGreaterThan(peak("flap0a"));
    expect(rms("sting-legendary")).toBeGreaterThan(rms("sting-common"));
  });
});
