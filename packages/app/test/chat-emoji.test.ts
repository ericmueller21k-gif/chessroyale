import { describe, expect, it } from "vitest";
import { CHAT_EMOJI, chatEmoji, emojiParts } from "../src/chat-emoji.tsx";

describe("the chat's own pixel emoji (Nov 7)", () => {
  it("about eight, each a 12 × 12 drawing with a unique :name: code", () => {
    expect(CHAT_EMOJI.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CHAT_EMOJI.map((e) => e.name)).size).toBe(CHAT_EMOJI.length);
    for (const e of CHAT_EMOJI) {
      expect(e.name).toMatch(/^[a-z]{2,16}$/);
      expect(e.rows).toHaveLength(12);
      for (const r of e.rows) expect(r).toMatch(/^[.kwsgGrRtTbep]{12}$/);
    }
  });

  it("a known code becomes its emoji; anything else stays as typed", () => {
    const parts = emojiParts("gg :crown: :nope: x:knight:y");
    expect(parts.map((p) => (typeof p === "string" ? p : `<${p.name}>`))).toEqual(["gg ", "<crown>", " :nope: x", "<knight>", "y"]);
    expect(emojiParts("plain")).toEqual(["plain"]);
    expect(chatEmoji("crown")?.label).toBe("Crown");
  });
});
