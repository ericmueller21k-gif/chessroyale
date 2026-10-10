import { describe, expect, it } from "vitest";
import { SPEECH } from "@chessroyale/core";
import { CRITICAL, LOW, NORMAL, Voice, holdMs, readMs, typeMs } from "../src/speech.tsx";

describe("speech: every line's time, and lines taking turns (Eric, Oct 10: Ginger's line came and went at once)", () => {
  it("types out, then stays readable for 2.2 s plus 35 ms a character, at most 4.5 s, then fades", () => {
    expect(SPEECH).toMatchObject({ readMs: 2200, perCharMs: 35, maxReadMs: 4500 });
    expect(readMs("Freeze!")).toBe(2200 + 7 * 35);
    expect(readMs("x".repeat(500))).toBe(4500);
    expect(holdMs("Chill out!")).toBe(typeMs("Chill out!") + readMs("Chill out!") + SPEECH.fadeMs);
    // Eric (Oct 10, after the first rule): "a few seconds… two, three, four, not that long". A short line rests
    // about 2.5 s once typed, a long one (50 characters) about 4 s, and none longer than 4.5 s.
    expect(Math.abs(readMs("Freeze!") - 2500)).toBeLessThanOrEqual(100);
    expect(Math.abs(readMs("x".repeat(50)) - 4000)).toBeLessThanOrEqual(100);
    // Ginger's shortest freeze line still stays up longer than her whole freeze moment did (2.3 s).
    expect(holdMs("Freeze!")).toBeGreaterThan(2300);
  });

  it("keeps a line up for its time, and starts the next in line as it ends", () => {
    const v = new Voice();
    const t = 1_000_000;
    v.say("Chill out!", "a", NORMAL, t);
    // A line said meanwhile (the next moment, a reaction) waits; it doesn't replace the first.
    v.say("Snapped it up!", "b", LOW, t + 500);
    v.say("A storm is brewing…", "c", NORMAL, t + 600);
    expect(v.line(t + holdMs("Chill out!") - 1)?.text).toBe("Chill out!");
    // Highest priority first, then in the order said, each from when the last has gone.
    const second = t + holdMs("Chill out!");
    expect(v.line(second)).toMatchObject({ text: "A storm is brewing…", at: second });
    // The low one has waited too long by then and is dropped (stale).
    const third = second + holdMs("A storm is brewing…");
    expect(third - (t + 500)).toBeGreaterThan(SPEECH.waitMs);
    expect(v.line(third)).toBeNull();
  });

  it("lets only a critical line cut in, and never on another critical line", () => {
    const v = new Voice();
    const t = 1_000_000;
    v.say("On ice you go!", "freeze", NORMAL, t);
    v.say("BLIZZARD!", "blizzard", CRITICAL, t + 300);
    expect(v.line(t + 400)?.text).toBe("BLIZZARD!");
    v.say("Let it snow!", "more", CRITICAL, t + 500);
    expect(v.line(t + 600)?.text).toBe("BLIZZARD!");
    expect(v.line(t + 300 + holdMs("BLIZZARD!"))?.text).toBe("Let it snow!");
  });

  it("says a moment once, however many screens say it, and starts afresh for a new battle", () => {
    const v = new Voice();
    const t = 1_000_000;
    expect(v.say("Hmph!", "move:3", LOW, t)).toBe(true);
    expect(v.say("Hmph!", "move:3", LOW, t + 10)).toBe(false);
    expect(v.say("", "empty", LOW, t)).toBe(false);
    v.reset();
    expect(v.line(t + 20)).toBeNull();
    expect(v.say("Hmph!", "move:3", LOW, t + 30)).toBe(true);
  });

  it("picks up a line where it was (a new screen mid-line), and gives the next in line its whole time from when it shows", () => {
    const v = new Voice();
    const t = 1_000_000;
    v.say("You'll crumble!", "intro", NORMAL, t);
    v.say("Cold feet?", "freeze", NORMAL, t + 100);
    // Looked for mid-line: the same line, from when it started.
    expect(v.line(t + 1500)).toMatchObject({ text: "You'll crumble!", at: t });
    // The browser was busy as the first ended (nothing looked for 300 ms): the second starts when it can show.
    const end = t + holdMs("You'll crumble!");
    expect(v.line(end + 300)).toMatchObject({ text: "Cold feet?", at: end + 300, until: end + 300 + holdMs("Cold feet?") });
  });
});
