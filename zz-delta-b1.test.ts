import { describe, expect, it } from "vitest";
import { JUDGES } from "@chessroyale/core";
import { drawJudges, type JudgeCandidate } from "../src/judges.ts";

describe("delta review b1: class pairing on a claimed kind", () => {
  it("two accounts claiming 'computer' in a lobby of phones land both judges most of the time", () => {
    let s = 1;
    const rng = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    const phones: JudgeCandidate[] = Array.from({ length: 98 }, (_, i) => ({ id: `p${i}`, nps: 300_000, owner: `u${i}`, kind: "phone" }));
    const atk: JudgeCandidate[] = ["A1", "A2"].map((id) => ({ id, nps: 3_000_000, owner: id, kind: "computer" }));
    let both = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (drawJudges(rng, [...phones, ...atk], 2, JUDGES, new Map()).every((j) => j.startsWith("A"))) both++;
    // The PR's stated worst case is 1.9%; here it is about 67% (33% with kind ignored, 4% before the fix round).
    expect(both / N).toBeGreaterThan(0.5);
  });
});
