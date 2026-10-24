import { afterEach, describe, expect, it, vi } from "vitest";
import { SPEECH } from "@chessroyale/core";
import { CRITICAL, LOW, NORMAL, Voice, holdMs, readMs, typeMs } from "../src/speech.tsx";

describe("speech: every line's time, and lines taking turns (Eric, Oct 10: Ginger's line came and went at once)", () => {
  it("types out, then stays readable for 2.7 s plus 35 ms a character, a second more past one row (30 characters), at most 6.5 s, then fades", () => {
    expect(SPEECH).toMatchObject({ readMs: 2700, perCharMs: 35, longChars: 30, longExtraMs: 1000, maxReadMs: 6500, minReadMs: 1500 });
    expect(readMs("Freeze!")).toBe(2700 + 7 * 35);
    // (One row of the bar's bubble at 390 px: Babur's thinking line, 29 characters, isn't long; one more is.)
    expect(readMs("Hmm… a giraffe? No. A knight.")).toBe(2700 + 29 * 35);
    expect(readMs("x".repeat(30))).toBe(2700 + 30 * 35);
    expect(readMs("x".repeat(31))).toBe(2700 + 31 * 35 + 1000);
    expect(readMs("x".repeat(500))).toBe(6500);
    expect(holdMs("Chill out!")).toBe(typeMs("Chill out!") + readMs("Chill out!") + SPEECH.fadeMs);
    // Eric (Oct 10): "a few seconds… two, three, four, not that long"; Oct 24: "they need to be like a second longer if
    // they're like two rows or more than a certain number of words, and then even… sit out a little bit longer". A short
    // line rests about 3 s once typed (2.5 before), a two-row one (50 characters) about 5.5 s (4 before), none over 6.5 s.
    expect(Math.abs(readMs("Freeze!") - 3000)).toBeLessThanOrEqual(100);
    expect(Math.abs(readMs("x".repeat(50)) - 5500)).toBeLessThanOrEqual(100);
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

  it("lets only a critical line cut in, once the one up has typed out and been readable for minReadMs, and never on another critical line", () => {
    const v = new Voice();
    const t = 1_000_000;
    v.say("On ice you go!", "freeze", NORMAL, t);
    const firm = t + typeMs("On ice you go!") + SPEECH.minReadMs;
    // (Said 300 ms in: it waits for the first to be read, then cuts in.)
    v.say("BLIZZARD!", "blizzard", CRITICAL, t + 300);
    expect(v.line(t + 400)?.text).toBe("On ice you go!");
    expect(v.line(firm - 1)?.text).toBe("On ice you go!");
    expect(v.line(firm)).toMatchObject({ text: "BLIZZARD!", at: firm });
    v.say("Let it snow!", "more", CRITICAL, firm + 200);
    expect(v.line(firm + 300)?.text).toBe("BLIZZARD!");
    expect(v.line(firm + holdMs("BLIZZARD!"))?.text).toBe("Let it snow!");
    // Said once the first has been read that long: it cuts in at once.
    const w = new Voice();
    w.say("On ice you go!", "freeze", NORMAL, t);
    w.say("BLIZZARD!", "blizzard", CRITICAL, firm + 50);
    expect(w.line(firm + 50)).toMatchObject({ text: "BLIZZARD!", at: firm + 50 });
  });

  it("Babur's thinking line (Oct 24): a critical line 200 ms into it waits for its minimum read, then cuts in", () => {
    // (Reproduced in Boss alone: his thinking line waited its turn behind his balloon's cheer, started as the cheer ended,
    // and his hoops' line, an ultimate's (critical), took it off 234 ms later.)
    const v = new Voice();
    const t = 1_000_000;
    v.say("Ta-da! Fresh from the pump.", "cheer", NORMAL, t);
    v.say("Hmm… a giraffe? No. A knight.", "thinking", LOW, t + 3000);
    const start = t + holdMs("Ta-da! Fresh from the pump.");
    expect(v.line(start)).toMatchObject({ text: "Hmm… a giraffe? No. A knight.", at: start });
    v.say("Through the hoops, everybody!", "hoops", CRITICAL, start + 200);
    const firm = start + typeMs("Hmm… a giraffe? No. A knight.") + SPEECH.minReadMs;
    for (let at = start; at < firm; at += 50) expect(v.line(at)?.text, `${at - start} ms in`).toBe("Hmm… a giraffe? No. A knight.");
    expect(v.line(firm)).toMatchObject({ text: "Through the hoops, everybody!", at: firm });
    expect(v.line(firm + holdMs("Through the hoops, everybody!") - 1)?.text).toBe("Through the hoops, everybody!");
  });

  it("drops a line that waited past waitMs, a cutter included", () => {
    const v = new Voice();
    const t = 1_000_000;
    const long = "x".repeat(200);
    v.say(long, "long", NORMAL, t);
    // (It types out for 5.6 s: a critical line said meanwhile can't cut in within waitMs, and is dropped.)
    v.say("Now!", "now", CRITICAL, t + 100);
    expect(typeMs(long) + SPEECH.minReadMs).toBeGreaterThan(SPEECH.waitMs + 100);
    expect(v.line(t + typeMs(long) + SPEECH.minReadMs)?.text).toBe(long);
    expect(v.line(t + holdMs(long))).toBeNull();
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

describe("?talkplus= (Eric, Oct 24: a URL to try the lengths)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  it("adds its seconds to every line's read time where the test switches count, and nothing elsewhere", async () => {
    vi.stubGlobal("location", { search: "?talkplus=1" });
    vi.resetModules();
    const sp = await import("../src/speech.tsx");
    vi.stubEnv("DEV", true);
    expect(sp.readMs("Freeze!")).toBe(2700 + 7 * 35 + 1000);
    expect(sp.readMs("x".repeat(500))).toBe(6500 + 1000);
    vi.stubEnv("DEV", false);
    expect(sp.readMs("Freeze!")).toBe(2700 + 7 * 35);
  });
});
