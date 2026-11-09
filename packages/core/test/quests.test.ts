import { describe, expect, it } from "vitest";
import { QUESTS, dailiesToDeal, hasRewards, pickQuests, questCountdown, questCounts, questDef, readRewards, rewardLines, type QuestGame } from "../src/index.ts";

/** Quests' rules (core's quests.ts; QUESTS in settings.ts; the server's part: packages/server/test/quests.test.ts). */
describe("quests' rules", () => {
  it("which counted games move which quests: online by mode, a win only won, a solo game only 'finish games' with enough time", () => {
    const g = (mode: QuestGame["mode"], won = false, ms = 12 * 60_000): QuestGame => ({ mode, won, ms });
    expect(["any", "win", "boss", "bossWin", "squads", "crowd"].filter((c) => questCounts(c as never, g("boss", true)))).toEqual(["any", "win", "boss", "bossWin"]);
    expect(["any", "win", "boss", "bossWin", "squads", "crowd"].filter((c) => questCounts(c as never, g("squads")))).toEqual(["any", "squads"]);
    expect(["any", "win", "boss", "bossWin", "squads", "crowd"].filter((c) => questCounts(c as never, g("crowd", true)))).toEqual(["any", "win", "crowd"]);
    expect(["any", "win", "boss", "bossWin", "squads", "crowd"].filter((c) => questCounts(c as never, g("duel", true)))).toEqual(["any", "win"]);
    expect(["any", "win", "boss", "bossWin", "squads", "crowd"].filter((c) => questCounts(c as never, g("solo", true)))).toEqual(["any"]);
    expect(questCounts("any", g("solo", false, QUESTS.soloMinMinutes * 60_000 - 1))).toBe(false);
  });

  it("the pool: only modes always playable (no auto chess, no ranked, no one boss); every quest pays XP; the weekly a crate and a key", () => {
    for (const q of [...QUESTS.daily, ...QUESTS.weekly]) {
      expect(q.xp).toBeGreaterThan(0);
      expect(q.target).toBeGreaterThan(0);
      expect(questDef(q.id)).toBe(q);
      expect(`${q.name} ${q.goal}`).not.toMatch(/auto chess|ranked/i);
    }
    expect(QUESTS.weekly.map((q) => [q.xp, q.crates, q.keys])).toEqual([[1500, 1, 1]]);
    expect(QUESTS.daily.every((q) => q.xp === 300 && !q.keys)).toBe(true);
    expect(QUESTS.daily.length).toBeGreaterThanOrEqual(QUESTS.maxDailies + 1);
  });

  it("seeded picks: the same seed the same quests, never a repeat or one held; weighted", () => {
    const a = pickQuests(QUESTS.daily, [], 2, "u:1");
    expect(pickQuests(QUESTS.daily, [], 2, "u:1")).toEqual(a);
    expect(new Set(a.map((q) => q.id)).size).toBe(2);
    expect(pickQuests(QUESTS.daily, ["squad-up", "warm-up"], 6, "u:2").map((q) => q.id)).not.toEqual(expect.arrayContaining(["squad-up"]));
    expect(pickQuests(QUESTS.daily, [], 99, "u:3").length).toBe(QUESTS.daily.length);
    // (Weights: over many seeds, a weight-2 quest comes about twice as often as a weight-1 one.)
    const n: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) for (const q of pickQuests(QUESTS.daily, [], 1, `s:${i}`)) n[q.id] = (n[q.id] ?? 0) + 1;
    expect(n["squad-up"]! / n["boss-hunter"]!).toBeGreaterThan(1.6);
    expect(n["squad-up"]! / n["boss-hunter"]!).toBeLessThan(2.5);
  });

  it("the carry-over cap: a day deals up to 2, never past 3 waiting", () => {
    expect([0, 1, 2, 3, 4].map(dailiesToDeal)).toEqual([2, 2, 1, 0, 0]);
  });

  it("countdowns in a word", () => {
    expect([30_000, 35 * 60_000, 12 * 3_600_000 + 5 * 60_000, 47 * 3_600_000, 4 * 86_400_000 + 3_600_000].map(questCountdown)).toEqual(["1m", "35m", "12h", "47h", "4d"]);
  });

  it("a game's quests in its rewards: read back from what's stored, and the toast's lines", () => {
    const r = { crate: "winter-1", daily: 0, crates: 0, keys: 0, bossPicks: 0, levels: [], quests: [{ quest: "regular", name: "Regular", xp: 1500, crates: 1, keys: 1 }] };
    expect(hasRewards(r)).toBe(true);
    expect(readRewards(JSON.stringify(r))).toEqual(r);
    expect(readRewards(JSON.stringify({ ...r, quests: [{ nope: 1 }] }))).toBeUndefined();
    expect(rewardLines(r, "Winter Crate · Series 1").quests).toEqual(["Quest done: Regular +1,500\u00a0XP · +1 Winter Crate · +1 crate key"]);
  });
});
