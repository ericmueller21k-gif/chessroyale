import { describe, expect, it } from "vitest";
import { CRATE_OPEN, TIERS } from "@chessroyale/core";
import { STRIPS, clickTimes, cues, tickLevel, timeline } from "../src/crate-open/timeline.ts";
import { CRATE_SOUNDS, TIER_SOUNDS, crateSound, renderCues } from "../src/crate-open/sounds.ts";

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

  it("cues every click and the lock (no swell: Eric, Nov 24), and (with an item) the box and the tier's sting; Transcendent's first strip none of those, its own sound as its banner comes up", () => {
    const all = cues(T, clicks, "rare");
    expect(all.filter((c) => c.sound.startsWith("tick"))).toHaveLength(clicks.length);
    expect(all.map((c) => c.sound)).toEqual(expect.arrayContaining(["whirr", "lock", "land", "shake-rare", "sting-rare"]));
    expect(all.find((c) => c.sound === "sting-rare")!.at).toBe(T.burstAt);
    const first = cues(T, clicks, null).map((c) => c.sound);
    expect(first.some((s) => /land|shake|sting|transcendent/.test(s))).toBe(false);
    const landed = cues(T, clicks, "transcendent");
    expect(landed.find((c) => c.sound === "transcendent")!.at).toBe(T.bannerAt);
    expect(landed.some((c) => /land|shake|sting/.test(c.sound))).toBe(false);
    expect(all.some((c) => c.sound === "swell")).toBe(false);
    const beam = cues(timeline(undefined, false), clicks, "mythic").map((c) => c.sound);
    expect(beam).toContain("sting-mythic");
    expect(beam.some((s) => /land|shake/.test(s))).toBe(false);
    expect([tickLevel(10), tickLevel(300)]).toEqual([0, 5]);
  });

  it("makes every piece, finite and under its ceiling; every ending quieter than the spin's ticks (Eric, Nov 24), the stings still climbing", () => {
    const rate = 48000;
    const peakOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const peak = (n: string) => peakOf(crateSound(n, rate));
    // The loudest 400 ms in LUFS (EBU R128's momentary loudness: ITU BS.1770's K-weighting at 48 kHz), as measured for the decision note.
    const kWeight = (x: Float32Array) => {
      const stage = (v: Float32Array, b: number[], a: number[]) => {
        const y = new Float32Array(v.length);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < v.length; i++) {
          const o = b[0]! * v[i]! + b[1]! * x1 + b[2]! * x2 - a[0]! * y1 - a[1]! * y2;
          [x2, x1, y2, y1] = [x1, v[i]!, y1, o];
          y[i] = o;
        }
        return y;
      };
      const shelf = stage(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]);
      return stage(shelf, [1, -2, 1], [-1.99004745483398, 0.99007225036621]);
    };
    const loud = (x: Float32Array) => {
      const k = kWeight(x);
      const w = Math.round(rate * 0.4);
      let best = 0;
      for (let i = 0; i < Math.max(1, k.length - w + 1); i += Math.round(rate * 0.1)) {
        let s = 0;
        for (let j = i; j < Math.min(k.length, i + w); j++) s += k[j]! * k[j]!;
        best = Math.max(best, s / w);
      }
      return -0.691 + 10 * Math.log10(best);
    };
    for (const n of [...CRATE_SOUNDS, ...TIER_SOUNDS]) {
      const x = crateSound(n, rate);
      expect(x.length, n).toBeGreaterThan(0);
      expect(x.every(Number.isFinite), n).toBe(true);
      expect(peak(n), n).toBeLessThan(0.6);
    }
    expect(TIER_SOUNDS).toHaveLength(TIERS.length * 2);
    const ticks = renderCues(rate, cues(T, clicks, null).filter((c) => c.sound.startsWith("tick")), T.stop);
    const endings = ["land", "transcendent", ...TIER_SOUNDS];
    for (const n of endings) {
      expect(peak(n), n).toBeLessThan(peakOf(ticks) * 0.8);
      expect(loud(crateSound(n, rate)), n).toBeLessThan(loud(ticks) - 2.5);
    }
    const sting = (t: string) => loud(crateSound(`sting-${t}`, rate));
    expect(sting("common")).toBeLessThan(sting("rare"));
    expect(sting("rare")).toBeLessThan(sting("legendary"));
    expect(sting("legendary")).toBeLessThan(sting("mythic"));
  });
});
