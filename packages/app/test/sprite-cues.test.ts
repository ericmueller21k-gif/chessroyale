import { describe, expect, it } from "vitest";
import { framesSince, spriteFrameAt } from "../src/components/BossEffect.tsx";
import { PIG } from "../src/characters/pig.ts";

/**
 * A sprite's sounds come from its frames' cues as each frame is drawn. A slow frame on a busy phone can jump past a short
 * frame (Wrangler's lasso: the 70 ms "throw", the 60 ms "tug"), and its sound must still play, a moment late, never
 * dropped (pig.spec.ts heard no tug now and then).
 */
describe("a sprite's cue sounds survive a skipped frame", () => {
  const lasso = PIG.anims.lasso!;
  const start = (name: string) => {
    let t = 0;
    for (const f of lasso.frames) {
      if (f.cue === name) return t;
      t += f.ms;
    }
    throw new Error(name);
  };
  const at = (ms: number) => spriteFrameAt(PIG, "lasso", "idle", 1_000 + ms, 1_000);

  it("passes over the throw and the tug in one long frame each: both are still due", () => {
    const throwAt = start("throw");
    const tugAt = start("tug");
    // From just before the throw to well past it (a 200 ms frame), then the same around the tug.
    const a = at(throwAt - 10);
    const b = at(throwAt + 200);
    expect(b.frame - a.frame).toBeGreaterThan(1);
    const due = framesSince(PIG, "lasso", a, b).map((f) => lasso.frames[f.frame]!.cue).filter(Boolean);
    expect(due).toContain("throw");
    const c = at(tugAt - 10);
    const d = at(tugAt + 200);
    expect(framesSince(PIG, "lasso", c, d).map((f) => lasso.frames[f.frame]!.cue)).toContain("tug");
  });

  it("the frame shown is always due, once: none twice when no frame was skipped", () => {
    const a = at(0);
    expect(framesSince(PIG, "lasso", null, a)).toEqual([a]);
    const b = at(lasso.frames[0]!.ms);
    expect(framesSince(PIG, "lasso", a, b)).toEqual([b]);
  });

  it("the one-shot's last frames are due when its loop takes over at once", () => {
    const total = lasso.frames.reduce((s, f) => s + f.ms, 0);
    const a = at(start("tug") - 10);
    const b = at(total + 50);
    expect(b.anim).toBe("idle");
    const due = framesSince(PIG, "lasso", a, b);
    expect(due.filter((f) => f.anim === "lasso").map((f) => lasso.frames[f.frame]!.cue)).toContain("tug");
    expect(due.at(-1)).toEqual(b);
  });
});
