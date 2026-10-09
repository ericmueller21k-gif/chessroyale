import { describe, expect, it } from "vitest";
import {
  CHAT_PACKS,
  GLOBAL_CHAT,
  GLOBAL_CHAT_BOTS,
  HOME_BOT_LINES,
  HOME_CHAT_PACK,
  SHOP_ITEMS,
  canSay,
  canSayHome,
  chatPackItem,
  chatSay,
  defaultChatPicks,
  homeBotLine,
  homeChatButtons,
  mulberry32,
} from "../src/index.ts";

describe("the global chat's lines (presets only)", () => {
  it("takes the lobby pack, the free Hello, Reactions and Sporting lines and the free emoji from anyone", () => {
    for (const l of HOME_CHAT_PACK.lines) expect(canSayHome(l.id, [])).toBe(true);
    for (const id of ["good-luck", "hi-all", "nice-move", "oops", "gg", "well-played", "thanks", "e-fire", "e-party"]) expect(canSayHome(id, [])).toBe(true);
  });

  it("never takes free text, unknown ids or anything but a string id", () => {
    for (const x of ["hello there", "GG", "Anyone up for a raid?", "", "l-nope", 42, null, undefined, { say: "gg" }, ["gg"]]) expect(canSayHome(x, [])).toBe(false);
  });

  it("leaves out plans: they're for a team in a match", () => {
    for (const id of ["trust-crowd", "defend-king", "push-pawns", "go-mate"]) expect(canSayHome(id, [])).toBe(false);
  });

  it("owned packs work as in matches: their lines and emoji only once owned", () => {
    const owned = [chatPackItem("godking"), chatPackItem("emoji-royal")];
    expect(canSayHome("gk-crown", [])).toBe(false);
    expect(canSayHome("gk-crown", owned)).toBe(true);
    expect(canSayHome("e-dragon", [])).toBe(false);
    expect(canSayHome("e-dragon", owned)).toBe(true);
    // (A pack's plan stays a plan.)
    expect(canSayHome("gk-call", owned)).toBe(false);
    expect(canSayHome("s-spicy", owned)).toBe(false);
    expect(canSayHome("s-spicy", [chatPackItem("spicy")])).toBe(true);
  });

  it("the lobby pack stays out of matches, the shop and the profile's lists", () => {
    for (const l of HOME_CHAT_PACK.lines) {
      expect(chatSay(l.id)?.pack).toBe("lobby");
      expect(canSay(l.id, [chatPackItem("lobby")])).toBe(false);
    }
    expect(CHAT_PACKS.some((p) => p.id === HOME_CHAT_PACK.id)).toBe(false);
    expect(SHOP_ITEMS.some((i) => i.id === chatPackItem(HOME_CHAT_PACK.id))).toBe(false);
    // Every id is new (never reuse an id for a different line).
    const ids = [...CHAT_PACKS, HOME_CHAT_PACK].flatMap((p) => p.lines.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the buttons: the lobby lines, then your picks that suit the home page, then your emoji", () => {
    const b = homeChatButtons(defaultChatPicks());
    expect(b.lobby.map((s) => s.id)).toEqual(HOME_CHAT_PACK.lines.map((l) => l.id));
    expect(b.lines.map((s) => s.id)).toEqual(["good-luck", "have-fun", "nice-move", "wow", "oops", "gg", "thanks"]);
    expect(b.emoji).toHaveLength(8);
    for (const s of [...b.lobby, ...b.lines, ...b.emoji]) expect(canSayHome(s.id, [])).toBe(true);
    expect(homeChatButtons({ lines: ["gk-crown", "gk-call", "defend-king"], emoji: ["e-crown"] })).toMatchObject({ lines: [{ id: "gk-crown" }], emoji: [{ id: "e-crown" }] });
  });
});

describe("the global chat's bots", () => {
  it("say only free lines that anyone could say there", () => {
    for (const id of HOME_BOT_LINES) expect(canSayHome(id, [])).toBe(true);
  });

  it("take turns: no bot or line from the last few comes again", () => {
    const rng = mulberry32(7);
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const recent: { name: string; say: string; bot: boolean }[] = [];
    for (let i = 0; i < 200; i++) {
      const l = homeBotLine(rng, names, recent);
      const last = recent.slice(-6);
      expect(last.some((r) => r.name === l.name)).toBe(false);
      expect(last.some((r) => r.say === l.say)).toBe(false);
      recent.push({ ...l, bot: true });
    }
  });

  it("are on for the beta, behind one setting, at about 30-90 s", () => {
    expect(typeof GLOBAL_CHAT_BOTS).toBe("boolean");
    expect(GLOBAL_CHAT.botGapMs).toEqual([30_000, 90_000]);
    expect(GLOBAL_CHAT.gapMs).toBe(30_000);
    expect(GLOBAL_CHAT.keep).toBe(50);
  });
});
