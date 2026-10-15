import { describe, expect, it } from "vitest";
import { isBlockedText, rot13, seatName } from "../src/text-filter.ts";

/**
 * The name filter (text-filter.ts). The words under test are written ROT13-encoded, as in the list, so no slur is
 * spelled out here either: `rot13` turns each back.
 */
const slur = rot13("avttre");
const short = rot13("snt");
const hate = rot13("uvgyre");

describe("the name filter", () => {
  it("refuses a listed word, however it's dressed up", () => {
    for (const name of [
      slur,
      slur.toUpperCase(),
      `xX${slur}Xx`,
      // Digits and symbols for letters, letters repeated or spaced out, invisible characters, accents.
      slur.replace("i", "1").replace("e", "3"),
      slur.replace("i", "!").replace("gg", "99"),
      slur.replace("i", "iii"),
      slur.split("").join(" "),
      slur.split("").join("."),
      `${slur.slice(0, 2)}​${slur.slice(2)}`,
      slur.replace("i", "í"),
      // Look-alike letters from Cyrillic.
      slur.replace("e", "е"),
      // Fullwidth letters.
      [...slur].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join(""),
      `Mr ${hate}`,
      // Hate codes in digits.
      "Bob1488",
      "14 88",
    ]) {
      expect(isBlockedText(name), name).toBe(true);
    }
  });

  it("refuses a short word only on its own (or plural), never inside an ordinary one", () => {
    expect(isBlockedText(short)).toBe(true);
    expect(isBlockedText(`${short}s`)).toBe(true);
    expect(isBlockedText(`the ${short.toUpperCase()}`)).toBe(true);
    // Inside other words, or across two of them, it's nothing.
    for (const name of ["Half Agent", "Raccoon", "Cocoon", "Japan Fan", "Pakistan", "Spicy Tuna", "Nazir", "Kikeriki"]) expect(isBlockedText(name), name).toBe(false);
  });

  it("lets ordinary names through, including the few words that contain a listed one", () => {
    for (const name of ["Player 7", "Niger", "Nigeria", "Scunthorpe", "Bob 1999", "Hello World", "Kasparov", "♞ Knight", "😀", "", rot13("favttre"), rot13("sverergneqnag")]) {
      expect(isBlockedText(name), name).toBe(false);
    }
  });

  it("a seat's name: tidied, at most 16 characters, and \"Player N\" when it's empty or refused", () => {
    expect(seatName("  Ann   Lee  ", "Player 1")).toBe("Ann Lee");
    expect(seatName("A very long name indeed", "Player 1")).toBe("A very long name");
    expect(seatName("", "Player 2")).toBe("Player 2");
    expect(seatName(undefined, "Player 3")).toBe("Player 3");
    expect(seatName(`${slur}99`, "Player 4")).toBe("Player 4");
  });
});
