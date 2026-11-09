import type { QuestView } from "./components/QuestsOverlay.tsx";
import { testParams } from "./test-switches.ts";

/**
 * The quests overlay's fake data (a mockup, Nov 9: notes/briefs/design-xp-quests.md, section 5), until the server's quests exist.
 * Test switches (test-switches.ts: an admin, a test server, the dev server):
 * - `?quests=mock`: home shows the Quests entry and opens the overlay as it loads, as the first visit of a day will;
 * - `?quests=done`: the same, with Boss Hunter done (its bar full, a check, "Done!");
 * - `?quests=entry`: the entry only (the overlay opens from it).
 */
export type QuestsMock = "mock" | "done" | "entry";

export function questsMock(): QuestsMock | null {
  const v = testParams().get("quests");
  return v === "mock" || v === "done" || v === "entry" ? v : null;
}

export function mockQuests(variant: QuestsMock): QuestView[] {
  return [
    {
      id: "boss-hunter",
      period: "daily",
      name: "Boss Hunter",
      goal: "Beat any boss",
      progress: variant === "done" ? 1 : 0,
      target: 1,
      icon: { kind: "boss", boss: "Wrangler" },
      reward: { xp: 300 },
    },
    {
      id: "squad-up",
      period: "daily",
      name: "Squad Up",
      goal: "Play 2 Squads games",
      progress: 1,
      target: 2,
      icon: { kind: "squad" },
      reward: { xp: 300, crates: 1 },
    },
    {
      id: "regular",
      period: "weekly",
      name: "Regular",
      goal: "Complete 10 games",
      progress: 3,
      target: 10,
      icon: { kind: "board", piece: "knight" },
      reward: { xp: 1500, crates: 1, keys: 1 },
    },
  ];
}

export const MOCK_COUNTDOWNS = { daily: "12h", weekly: "4d" };
