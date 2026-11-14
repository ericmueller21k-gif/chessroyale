import { describe, expect, it } from "vitest";
import { RECLUSE_CUTSCENE as C } from "@chessroyale/core";
import { RECLUSE_CUTSCENE_LINES } from "../src/characters/recluse-lines.ts";
import { CUTSCENE_SPOTS, RECLUSE_CUTSCENE } from "../src/characters/recluse-ages.ts";
import { renderFrame } from "../src/characters/sprite.ts";
import { boxAt, cutBox, cutReadMs, cutTyped, cutsceneTimeline, fitCutscene, sceneStandAt } from "../src/recluse-cutscene.ts";

// The Hidden Boss's cutscene (Nov 12; in his fight since Nov 13): Eric's 17 lines, typed a sentence at a time, each box up long
// enough to read.
describe("the Hidden Boss's cutscene", () => {
  const ms = (a: string) => RECLUSE_CUTSCENE.anims[a]!.frames.reduce((s, f) => s + f.ms, 0);
  const arrival = { poofMs: ms("poof"), dropMs: ms("drop"), landMs: ms("land") };
  const tl = cutsceneTimeline(RECLUSE_CUTSCENE_LINES, arrival);

  it("lasts exactly its hold (RECLUSE_CUTSCENE.holdMs: the server's online, solo's after his fall): change the two together", () => {
    expect(tl.endAt).toBe(C.holdMs);
    // (Its parts, from the settings: the light, the arrival from his frames, the lines, then the moment before his transformation
    // carries on from it, Nov 14.)
    const lines = tl.boxes.reduce((n, b, i) => n + (b.until - b.at) + (i ? C.gapMs : 0), 0);
    expect(tl.endAt).toBe(C.dimMs + C.poofAfterMs + arrival.poofMs + arrival.dropMs + arrival.landMs + C.firstLineAfterMs + lines + C.endAfterMs);
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
      expect(f.timeline.boxes).toHaveLength(18);
      expect(f.timeline.standAt - f.timeline.poofAt).toBe(arrival.poofMs + arrival.dropMs + arrival.landMs);
      expect(f.c.typeMs).toBeLessThan(C.typeMs);
    }
  });

  it("his transformation carries the loop of the two on from the scene as fitted to its hold, a test's short one too (#707's review, m5)", () => {
    const L = RECLUSE_CUTSCENE_LINES;
    // (Its own hold: the full scene's stand, its length before the phase change.)
    expect(sceneStandAt(L, arrival, { at: 1000, until: 1000 + C.holdMs }, 1000 + C.holdMs)).toBe(tl.standAt - tl.endAt);
    // (A test's 6 s hold: the fitted scene's stand, not the full one's (which would start the loop 100 s back, a jump in it).)
    const fit = fitCutscene(L, arrival, 6000).timeline;
    expect(sceneStandAt(L, arrival, { at: 1000, until: 7000 }, 7000)).toBe(fit.standAt - 6000);
    expect(sceneStandAt(L, arrival, { at: 1000, until: 7000 }, 7000)).toBeGreaterThan(-6000);
    // (Solo's timer a little late: still the scene's own times.)
    expect(sceneStandAt(L, arrival, { at: 1000, until: 7000 }, 7040)).toBe(fit.standAt - 6040);
    // (No scene led into it (a device joined at the phase change, a link straight to it), or an old one: the full scene ending now.)
    expect(sceneStandAt(L, arrival, null, 7000)).toBe(tl.standAt - tl.endAt);
    expect(sceneStandAt(L, arrival, { at: 1000, until: 7000 }, 60_000)).toBe(tl.standAt - tl.endAt);
  });

  it("has Eric's 18 lines (Nov 14: the kid's two points, then \"Why don't you show us?\"), line 15 two sentences, and never names him", () => {
    expect(RECLUSE_CUTSCENE_LINES).toHaveLength(18);
    expect(RECLUSE_CUTSCENE_LINES[14]).toEqual({ who: "kid", say: ["Everyone has the same computers.", "So the only thing that separates anyone is creativity."] });
    expect(RECLUSE_CUTSCENE_LINES[15]).toEqual({ who: "kid", say: ["They just made the game deeper.", "The computers never changed who the best player was."] });
    expect(RECLUSE_CUTSCENE_LINES.map((l) => l.who).join(" ")).toBe("kid man kid man kid man kid man kid man kid man kid man kid kid man kid");
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
    expect(b.text).toBe("Everyone has the same computers. So the only thing that separates anyone is creativity.");
  });

  it("shows one box at a time, in order, each fully readable for its time once typed", () => {
    expect(tl.boxes).toHaveLength(18);
    tl.boxes.forEach((b, i) => {
      expect(b.until - C.boxFadeMs - b.typed).toBe(cutReadMs(b.text));
      expect(cutReadMs(b.text)).toBeGreaterThanOrEqual(C.readMs);
      if (i) expect(b.at).toBe(tl.boxes[i - 1]!.until + C.gapMs);
      expect(boxAt(tl, b.at)?.i).toBe(i);
      expect(boxAt(tl, b.until - 1)?.i).toBe(i);
    });
  });

  it("dims, then the child poofs, drops, lands and straightens before the first line; his transformation carries on 0.4 s after the last (Nov 14: the child stays)", () => {
    expect(tl.litAt).toBe(C.dimMs);
    expect(tl.poofAt).toBeGreaterThan(tl.litAt);
    expect(tl.dropAt - tl.poofAt).toBe(ms("poof"));
    expect(tl.landAt - tl.dropAt).toBe(ms("drop"));
    expect(tl.standAt - tl.landAt).toBe(ms("land"));
    expect(tl.boxes[0]!.at).toBe(tl.standAt + C.firstLineAfterMs);
    expect(tl.endAt).toBe(tl.boxes.at(-1)!.until + C.endAfterMs);
    expect(C.endAfterMs).toBe(400);
  });

  it("has the cues its one-shots play on", () => {
    const cue = (a: string) => RECLUSE_CUTSCENE.anims[a]!.frames[0]!.cue;
    expect([cue("poof"), cue("drop"), cue("land"), cue("fade")]).toEqual(["poof", "drop", "land", "fade"]);
  });

  // Eric, Nov 14: the man's words sat over his face, his spot 38 rows low (the scene's headroom). Each box stands just above the top
  // of its speaker's drawing in the conversation (his own half of the scene, its motes left out), at its tallest frame.
  it("puts each speaker's box at the top of his drawing in the conversation (CUTSCENE_SPOTS)", () => {
    const ch = RECLUSE_CUTSCENE;
    const mid = Math.round((CUTSCENE_SPOTS.man.x + CUTSCENE_SPOTS.kid.x) / 2);
    const topIn = (x0: number, x1: number) =>
      Math.min(
        ...["together", "kidTalk", "manTalk"].flatMap((a) =>
          ch.anims[a]!.frames.map((f) => {
            const r = renderFrame(ch, { ...f, specks: [] });
            for (let y = 0; y < r.h; y++) for (let x = x0; x < x1; x++) if (r.data[(y * r.w + x) * 4 + 3]! > 0) return y;
            return r.h;
          }),
        ),
      );
    expect({ man: CUTSCENE_SPOTS.man.head, kid: CUTSCENE_SPOTS.kid.head }).toEqual({ man: topIn(0, mid), kid: topIn(mid, ch.w) });
  });
});

