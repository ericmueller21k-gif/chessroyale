import { beforeEach, describe, expect, it } from "vitest";
import { KING_LINES, SPEECH_MS, kingLine, kingSay, kingTurn, resetKingSpeech } from "../src/godKing.ts";

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
    expect(kingLine(t + 100)).toEqual({ text: intro, at: t, until: t + SPEECH_MS });
    expect(kingLine(t + SPEECH_MS + 1)).toBeNull();
    // The same moment again (a screen drawn twice): silent.
    expect(kingSay("intro", "intro", t + 10, always)).toBeNull();
    // Small talk waits a while after the last line…
    expect(kingSay("idle", "idle-1", t + 1000, always)).toBeNull();
    // …but danger doesn't.
    expect(KING_LINES.queenDanger).toContain(kingSay("queenDanger", "q-1", t + 1500, always));
    // Later, small talk is fine (when the dice allow).
    expect(kingSay("idle", "idle-2", t + 20_000, () => 0.9)).toBeNull();
    for (const m of [1, 2, 3, 4, 5, 6]) kingTurn(`quiet-${m}`);
    expect(KING_LINES.idle).toContain(kingSay("idle", "idle-3", t + 30_000, always));
  });

  it("paces small talk by moves: each quiet move makes him likelier to speak, so he talks every few moves", () => {
    const roll = () => 0.7;
    let t = 1_000_000;
    // Right after a line, or at the start, he rests: a 0.7 roll beats idle's chance for a few moves.
    for (const m of [1, 2, 3, 4]) {
      kingTurn(`m${m}`);
      kingTurn(`m${m}`); // the same move drawn twice counts once
      expect(kingSay("idle", `i${m}`, (t += 60_000), roll)).toBeNull();
    }
    // Then it gets likelier each quiet move: by the sixth he speaks.
    kingTurn("m5");
    expect(kingSay("idle", "i5", (t += 60_000), roll)).toBeNull();
    kingTurn("m6");
    expect(kingSay("idle", "i6", (t += 60_000), roll)).not.toBeNull();
    // Speaking resets the count.
    kingTurn("m7");
    expect(kingSay("idle", "i7", (t += 60_000), roll)).toBeNull();
  });

  it("speaks 5 to 10 times in a typical 35-move boss battle of small talk alone", () => {
    let rng = 7;
    const random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
    const counts = [];
    for (let game = 0; game < 50; game++) {
      resetKingSpeech();
      let n = 0;
      for (let move = 0; move < 35; move++) {
        kingTurn(`g${game}-m${move}`);
        if (kingSay("idle", `g${game}-i${move}`, 1_000_000 + move * 40_000, random)) n++;
      }
      counts.push(n);
    }
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(avg).toBeGreaterThanOrEqual(5);
    expect(avg).toBeLessThanOrEqual(10);
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
