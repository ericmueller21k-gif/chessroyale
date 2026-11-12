import { describe, expect, it } from "vitest";
import { RECLUSE_CUTSCENE as C } from "@chessroyale/core";
import { RECLUSE_CUTSCENE_LINES } from "../src/characters/recluse-lines.ts";
import { RECLUSE_CUTSCENE } from "../src/characters/recluse-ages.ts";
import { boxAt, cutBox, cutReadMs, cutTyped, cutsceneTimeline } from "../src/recluse-cutscene.ts";

// The Hidden Boss's cutscene (a mockup, Nov 12): Eric's 17 lines, typed a sentence at a time, each box up long enough to read.
describe("the Hidden Boss's cutscene (mockup)", () => {
  const ms = (a: string) => RECLUSE_CUTSCENE.anims[a]!.frames.reduce((s, f) => s + f.ms, 0);
  const tl = cutsceneTimeline(RECLUSE_CUTSCENE_LINES, { poofMs: ms("poof"), dropMs: ms("drop"), landMs: ms("land"), fadeMs: ms("fade") });

  it("has Eric's 17 lines, line 15 two sentences, and never names him", () => {
    expect(RECLUSE_CUTSCENE_LINES).toHaveLength(17);
    expect(RECLUSE_CUTSCENE_LINES[14]).toEqual({ who: "kid", say: ["Computers or no computers.", "The best player in the world is still the best."] });
    expect(RECLUSE_CUTSCENE_LINES.map((l) => l.who).join(" ")).toBe("kid man kid man kid man kid man kid man kid man kid man kid man kid");
    // (A line of two sentences is two entries; one sentence, however long, is one: it types all at once.)
    for (const l of RECLUSE_CUTSCENE_LINES) for (const s of l.say) expect(s.slice(0, -1)).not.toMatch(/[.?!] /);
  });

  it("types the first sentence, pauses, then types the second", () => {
    const line = RECLUSE_CUTSCENE_LINES[14]!;
    const b = cutBox(line, 1000);
    const first = line.say[0]!.length;
    expect(cutTyped(line, b, 999)).toBe(0);
    expect(cutTyped(line, b, 1000)).toBe(1);
    const firstDone = 1000 + first * C.typeMs;
    expect(cutTyped(line, b, firstDone)).toBe(first);
    // (The pause: nothing more typed until the second sentence starts.)
    expect(cutTyped(line, b, firstDone + C.sentencePauseMs - 1)).toBe(first);
    expect(b.starts[1]).toBe(firstDone + C.sentencePauseMs);
    expect(cutTyped(line, b, b.starts[1]!)).toBe(first + 2);
    expect(cutTyped(line, b, b.typed)).toBe(b.text.length);
    expect(b.text).toBe("Computers or no computers. The best player in the world is still the best.");
  });

  it("shows one box at a time, in order, each fully readable for its time once typed", () => {
    expect(tl.boxes).toHaveLength(17);
    tl.boxes.forEach((b, i) => {
      expect(b.until - C.boxFadeMs - b.typed).toBe(cutReadMs(b.text));
      expect(cutReadMs(b.text)).toBeGreaterThanOrEqual(C.readMs);
      if (i) expect(b.at).toBe(tl.boxes[i - 1]!.until + C.gapMs);
      expect(boxAt(tl, b.at)?.i).toBe(i);
      expect(boxAt(tl, b.until - 1)?.i).toBe(i);
    });
  });

  it("dims, then the child poofs, drops, lands and straightens before the first line, and fades after the last", () => {
    expect(tl.litAt).toBe(C.dimMs);
    expect(tl.poofAt).toBeGreaterThan(tl.litAt);
    expect(tl.dropAt - tl.poofAt).toBe(ms("poof"));
    expect(tl.landAt - tl.dropAt).toBe(ms("drop"));
    expect(tl.standAt - tl.landAt).toBe(ms("land"));
    expect(tl.boxes[0]!.at).toBe(tl.standAt + C.firstLineAfterMs);
    expect(tl.fadeAt).toBe(tl.boxes.at(-1)!.until + C.kidFadeAfterMs);
    expect(tl.endAt).toBeGreaterThan(tl.fadeAt + ms("fade"));
  });

  it("has the cues its one-shots play on", () => {
    const cue = (a: string) => RECLUSE_CUTSCENE.anims[a]!.frames[0]!.cue;
    expect([cue("poof"), cue("drop"), cue("land"), cue("fade")]).toEqual(["poof", "drop", "land", "fade"]);
  });
});
