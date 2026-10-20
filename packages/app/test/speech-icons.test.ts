import { describe, expect, it } from "vitest";
import { SPEECH } from "@chessroyale/core";
import { hasIcons, lineLength, parseLine, plainLine, sliceLine } from "../src/speech-icons.ts";
import { holdMs, readMs, typeMs, typedCount } from "../src/speech.tsx";

/**
 * Pixel icons in a line of speech (Moo's `{heart}`: speech-icons.ts): parsed into words and icons, an icon one character for how long
 * a line types and stays up, dropped for a screen reader or any plain text.
 */
describe("icon tokens in a line", () => {
  it("splits a line into its words and icons, in order; a line without a token is one piece", () => {
    expect(parseLine("Hi! (Moo! {heart})")).toEqual([{ text: "Hi! (Moo! " }, { icon: "heart" }, { text: ")" }]);
    expect(parseLine("{sparkle}{moon}")).toEqual([{ icon: "sparkle" }, { icon: "moon" }]);
    expect(parseLine("(Moo.)")).toEqual([{ text: "(Moo.)" }]);
    expect(parseLine("")).toEqual([]);
    expect(hasIcons("(Moo. {pawn})")).toBe(true);
    expect(hasIcons("(Moo.)")).toBe(false);
  });

  it("leaves a {word} that isn't one of his ten icons as plain text, braces and all", () => {
    expect(parseLine("a {nope} b")).toEqual([{ text: "a {nope} b" }]);
    expect(parseLine("a {nope} {zzz}")).toEqual([{ text: "a {nope} " }, { icon: "zzz" }]);
    expect(plainLine("a {nope} b")).toBe("a {nope} b");
    expect(parseLine("{constructor}")).toEqual([{ text: "{constructor}" }]);
  });

  it("counts an icon as one character", () => {
    expect(lineLength("(Moo! {heart})")).toBe("(Moo! x)".length);
    expect(lineLength("{sparkle}")).toBe(1);
    expect(lineLength("plain")).toBe(5);
  });

  it("drops the icons, and the space before each, for a screen reader or plain text", () => {
    expect(plainLine("Hi! This is Moo. He's my best friend. (Moo! {heart})")).toBe("Hi! This is Moo. He's my best friend. (Moo!)");
    expect(plainLine("(Moo. {zzz})")).toBe("(Moo.)");
    expect(plainLine("(Moo… {question})")).toBe("(Moo…)");
    expect(plainLine("I'm hungry {milk} Moo")).toBe("I'm hungry Moo");
    expect(plainLine("{heart}")).toBe("");
    expect(plainLine("No icons here.")).toBe("No icons here.");
  });

  it("types out and stays up by its length with each icon one character, the same everywhere a line is measured", () => {
    const line = "(Moo! {heart})";
    expect(typeMs(line)).toBe(lineLength(line) * SPEECH.typeMs);
    expect(readMs(line)).toBe(Math.min(SPEECH.maxReadMs, SPEECH.readMs + SPEECH.perCharMs * lineLength(line)));
    expect(holdMs(line)).toBe(typeMs(line) + readMs(line) + SPEECH.fadeMs);
    // A line that is the same but for the icon being the text "{heart}" would have held longer: it isn't counted so.
    expect(typeMs(line)).toBeLessThan(typeMs("(Moo! {nope})"));
    expect(typedCount(line, 1000, 1000)).toBe(1);
    expect(typedCount(line, 1000, 1000 + 1000 * SPEECH.typeMs)).toBe(lineLength(line));
  });

  it("slices a line a character at a time, an icon appearing whole as the one character it is, the rest held in place", () => {
    const line = "Hi {heart}!";
    expect(sliceLine(line, 0)).toEqual({ shown: [], rest: [{ text: "Hi " }, { icon: "heart" }, { text: "!" }] });
    expect(sliceLine(line, 2)).toEqual({ shown: [{ text: "Hi" }], rest: [{ text: " " }, { icon: "heart" }, { text: "!" }] });
    expect(sliceLine(line, 3)).toEqual({ shown: [{ text: "Hi " }], rest: [{ icon: "heart" }, { text: "!" }] });
    expect(sliceLine(line, 4)).toEqual({ shown: [{ text: "Hi " }, { icon: "heart" }], rest: [{ text: "!" }] });
    expect(sliceLine(line, 99)).toEqual({ shown: [{ text: "Hi " }, { icon: "heart" }, { text: "!" }], rest: [] });
    // Nothing is lost or doubled at any cut.
    for (let n = 0; n <= lineLength(line); n++) {
      const { shown, rest } = sliceLine(line, n);
      expect(shown.concat(rest).map((s) => s.icon ?? s.text).join("")).toBe("Hi heart!");
    }
  });
});
