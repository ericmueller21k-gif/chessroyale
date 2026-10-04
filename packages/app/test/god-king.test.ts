import { beforeEach, describe, expect, it } from "vitest";
import { KING_LINES, SPEECH_MS, kingLine, kingSay, resetKingSpeech } from "../src/godKing.ts";

describe("the God King's lines", () => {
  beforeEach(() => resetKingSpeech());

  it("has dozens of lines across every moment", () => {
    const all = Object.values(KING_LINES).flat();
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(new Set(all).size).toBe(all.length);
    for (const lines of Object.values(KING_LINES)) expect(lines.length).toBeGreaterThan(0);
  });

  it("speaks once per moment, shows the line for a while, and lets urgent cues cut in over small talk", () => {
    const always = () => 0;
    const t = 1_000_000;
    const intro = kingSay("intro", "intro", t, always)!;
    expect(KING_LINES.intro).toContain(intro);
    expect(kingLine(t + 100)).toBe(intro);
    expect(kingLine(t + SPEECH_MS + 1)).toBeNull();
    // The same moment again (a screen drawn twice): silent.
    expect(kingSay("intro", "intro", t + 10, always)).toBeNull();
    // Small talk waits a while after the last line…
    expect(kingSay("idle", "idle-1", t + 1000, always)).toBeNull();
    // …but danger doesn't.
    expect(KING_LINES.queenDanger).toContain(kingSay("queenDanger", "q-1", t + 1500, always));
    // Later, small talk is fine (when the dice allow).
    expect(kingSay("idle", "idle-2", t + 20_000, () => 0.9)).toBeNull();
    expect(KING_LINES.idle).toContain(kingSay("idle", "idle-3", t + 30_000, always));
  });

  it("never says the same line twice running for a cue", () => {
    let last: string | null = null;
    for (let i = 0; i < 20; i++) {
      const line = kingSay("queenDanger", `q-${i}`, 1_000_000 + i * 10_000, () => 0.01);
      expect(line).not.toBe(last);
      last = line;
    }
  });
});
