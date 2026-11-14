import { describe, expect, it } from "vitest";
import { RECLUSE_CUTSCENE as C } from "@chessroyale/core";
import { RECLUSE_CUTSCENE_LINES } from "../src/characters/recluse-lines.ts";
import { RECLUSE_CUTSCENE } from "../src/characters/recluse-ages.ts";
import { boxAt, cutBox, cutReadMs, cutTyped, cutsceneTimeline, fitCutscene } from "../src/recluse-cutscene.ts";
import { RECLUSE } from "../src/characters/recluse.ts";
import { PHASE_CHANGE, absorbPaced } from "../src/recluse-phase2.ts";
import { RECLUSE_LINES } from "../src/characters/recluse-lines.ts";
import { pacedPage } from "../src/paced-line.ts";

// The Hidden Boss's cutscene (Nov 12; in his fight since Nov 13): Eric's 17 lines, typed a sentence at a time, each box up long
// enough to read.
describe("the Hidden Boss's cutscene", () => {
  const ms = (a: string) => RECLUSE_CUTSCENE.anims[a]!.frames.reduce((s, f) => s + f.ms, 0);
  const arrival = { poofMs: ms("poof"), dropMs: ms("drop"), landMs: ms("land"), fadeMs: ms("fade") };
  const tl = cutsceneTimeline(RECLUSE_CUTSCENE_LINES, arrival);

  it("lasts exactly its hold (RECLUSE_CUTSCENE.holdMs: the server's online, solo's after his fall): change the two together", () => {
    expect(tl.endAt).toBe(C.holdMs);
    // (Its parts, from the settings: the light, the arrival from his frames, the lines, the child's fade, the man alone, the light lifting.)
    const lines = tl.boxes.reduce((n, b, i) => n + (b.until - b.at) + (i ? C.gapMs : 0), 0);
    expect(tl.endAt).toBe(C.dimMs + C.poofAfterMs + arrival.poofMs + arrival.dropMs + arrival.landMs + C.firstLineAfterMs + lines + C.kidFadeAfterMs + arrival.fadeMs + C.endHoldMs + C.outMs);
    expect(tl.outAt).toBe(tl.endAt - C.outMs);
    // (Each line's box: its sentences typed at typeMs a character, the pause between, then read and faded.)
    tl.boxes.forEach((b, i) => {
      const say = RECLUSE_CUTSCENE_LINES[i]!.say;
      expect(b.typed - b.at).toBe(say.reduce((n, x) => n + x.length * C.typeMs, 0) + (say.length - 1) * C.sentencePauseMs);
    });
    // (About 104 s, as Eric's lines need at their slow pace.)
    expect(C.holdMs).toBeGreaterThan(90_000);
    expect(C.holdMs).toBeLessThan(120_000);
  });

  it("plays unchanged in its own hold (or a longer one, or a second shorter: two devices' clocks), and sped up to fit a test's shorter one", () => {
    expect(fitCutscene(RECLUSE_CUTSCENE_LINES, arrival, C.holdMs).timeline).toEqual(tl);
    expect(fitCutscene(RECLUSE_CUTSCENE_LINES, arrival, C.holdMs + 5000).timeline).toEqual(tl);
    expect(fitCutscene(RECLUSE_CUTSCENE_LINES, arrival, C.holdMs - 600).timeline).toEqual(tl);
    for (const hold of [12_000, 30_000]) {
      const f = fitCutscene(RECLUSE_CUTSCENE_LINES, arrival, hold);
      expect(f.timeline.endAt).toBeLessThanOrEqual(hold);
      expect(f.timeline.endAt).toBeGreaterThan(hold * 0.9);
      // (Every line still shown, in order, the child's frames as they are.)
      expect(f.timeline.boxes).toHaveLength(17);
      expect(f.timeline.standAt - f.timeline.poofAt).toBe(arrival.poofMs + arrival.dropMs + arrival.landMs);
      expect(f.c.typeMs).toBeLessThan(C.typeMs);
    }
  });

  it("has Eric's 17 lines, line 15 two sentences, and never names him", () => {
    expect(RECLUSE_CUTSCENE_LINES).toHaveLength(17);
    expect(RECLUSE_CUTSCENE_LINES[14]).toEqual({ who: "kid", say: ["Everyone has the same computers.", "So the best player is still the best."] });
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
    expect(b.text).toBe("Everyone has the same computers. So the best player is still the best.");
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

// His word as the power lands, paged as his chant's lines are (Nov 13: cut off on a phone's bar).
describe("his absorb line, paged", () => {
  it("types a sentence a page, the chant's pause between, and is gone by his chant's first line", () => {
    const P = PHASE_CHANGE;
    for (const text of RECLUSE_LINES.absorb) {
      const line = absorbPaced(text);
      expect(line.text).toBe(text);
      expect(line.sentences.length).toBe(2);
      expect(pacedPage(line, 0).text).toBe(line.sentences[0]);
      expect(pacedPage(line, line.starts[1]!).text).toBe(line.sentences[1]);
      expect(line.starts[1]! - line.sentences[0]!.length * line.typeMs).toBeGreaterThanOrEqual(900);
      expect(P.absorbLineAt + line.holdMs).toBeLessThanOrEqual(P.absorbGoneAt);
      // (Readable a good while once typed.)
      expect(line.holdMs - line.typedMs).toBeGreaterThanOrEqual(2500);
    }
  });
});

// His place after the scene: on his knees, quiet (no mumbling), until he seizes the God King's power.
it("his kneel: a loop on his knees, his mouth still", () => {
  const k = RECLUSE.anims.kneel!;
  expect(k.loop).toBe(true);
  expect(k.frames.length).toBeGreaterThan(8);
});
