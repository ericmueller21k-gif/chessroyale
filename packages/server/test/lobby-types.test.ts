import { describe, expect, it } from "vitest";
import { MATCHMAKING, RAID_SETTINGS, RANKING, isRankedMatch, modeSettings, type Settings } from "@chessroyale/core";
import { setup } from "./lobby-fixture.ts";

/** Matchmaking types in a lobby (Default, Bots off), and which matches count for ranking. Solo is the browser's. */

const crowd = (): Partial<Settings> => ({ ...modeSettings("crowd", { crowdTeams: true, augments: false }), finalFormat: "team" });
const join = (L: ReturnType<typeof setup>, n: number, from = 0) => {
  for (let i = 0; i < n; i++) expect(L.core.connect(undefined, `P${from + i}`, "phone", false, 1500).ok).toBe(true);
};

describe("lobby: matchmaking types", () => {
  it("Default: bots fill the empty seats at the fill time; a raid's bots join its crowd, and the boss is matched to the people", () => {
    const L = setup({ ...RAID_SETTINGS });
    L.core.setAuto(L.now + 60_000);
    L.core.connect(undefined, "Ann", "phone", false, 1500);
    L.advance(60_000);
    // A raid of 50: Ann and 49 bots in the crowd.
    expect(L.core.record.bots).toHaveLength(49);
    expect(L.last("p1", "lobby")!.players.filter((p) => p.isBot)).toHaveLength(49);
    // The boss: a step above the people's average rating (bots don't count): Ann's 1500 → 1600.
    expect(L.core.record.overrides?.bossFixedElo).toBe(1600);
  });

  it("a private raid stays people only", () => {
    const L = setup({ ...RAID_SETTINGS });
    L.core.connect(undefined, "Ann", "phone");
    L.core.message("p1", { t: "start" });
    expect(L.core.record.bots).toHaveLength(0);
  });

  it("Bots off, 50 v 50: no bots ever; it keeps taking people and waits until it's full", () => {
    const L = setup({ ...crowd(), lobbySize: 6 });
    L.core.setAuto(null, true);
    join(L, 5);
    expect(L.last("p1", "lobby")).toMatchObject({ auto: true, botsOff: true, fillAt: null });
    L.advance(30 * 60_000);
    expect(L.core.record.phase).toBe("lobby");
    expect(L.core.record.auto?.filledAt).toBeUndefined();
    expect(L.core.joinable()).toBe(true);
    // The sixth: full, it starts, with nobody but people.
    join(L, 1, 5);
    expect(L.core.record.auto?.filledAt).toBe(L.now);
    expect(L.core.record.bots).toHaveLength(0);
    expect(L.core.joinable()).toBe(false);
  });

  it(`Bots off, a raid: full, or once its minute is up with ${MATCHMAKING.raidBotsOffMinPlayers} people`, () => {
    const L = setup({ ...RAID_SETTINGS });
    L.core.setAuto(L.now + 60_000, true);
    join(L, MATCHMAKING.raidBotsOffMinPlayers - 1);
    L.advance(60_000);
    // A minute, but too few: it waits (and still takes people).
    expect(L.core.record.auto?.filledAt).toBeUndefined();
    expect(L.core.joinable()).toBe(true);
    L.advance(5 * 60_000);
    join(L, 1, 50);
    // Enough: the raid begins, people only.
    expect(L.core.record.auto?.filledAt).toBe(L.now);
    expect(L.core.record.bots).toHaveLength(0);

    // Enough people before the minute is up: it begins when the minute is.
    const R = setup({ ...RAID_SETTINGS });
    R.core.setAuto(R.now + 60_000, true);
    join(R, MATCHMAKING.raidBotsOffMinPlayers);
    expect(R.core.record.auto?.filledAt).toBeUndefined();
    R.advance(60_000);
    expect(R.core.record.auto?.filledAt).toBe(R.now);
    expect(R.core.record.bots).toHaveLength(0);
  });

  it("Bots off → Default: the seat is let go with when its person joined; a Default lobby then fills a minute after that (not sooner than 5 s)", () => {
    const off = setup({ ...crowd() });
    off.core.setAuto(null, true);
    off.core.connect(undefined, "Ann", "phone");
    const token = off.core.record.humans[0]!.token;
    const joined = off.now;
    off.advance(45_000);
    expect(off.core.release("not-a-seat")).toBeNull();
    expect(off.core.release(token)).toEqual({ joinedAt: joined });
    expect(off.core.record.humans).toHaveLength(0);
    // A Default lobby (opened just now, bots at +60 s) hears she's been waiting 45 s: bots in 15 s.
    const def = setup({ ...crowd() });
    def.core.setAuto(def.now + 60_000);
    def.core.connect(undefined, "Bo", "phone");
    def.take("p1");
    def.core.hurry(def.now - 45_000 + 60_000);
    expect(def.core.record.auto?.fillAt).toBe(def.now + 15_000);
    expect(def.last("p1", "lobby")!.fillAt).toBe(def.now + 15_000);
    // Waited longer than a minute: soon, but not at once (the screen shows it first).
    def.core.hurry(def.now - 10 * 60_000);
    expect(def.core.record.auto?.fillAt).toBe(def.now + MATCHMAKING.switchMinWaitMs);
    def.advance(MATCHMAKING.switchMinWaitMs);
    expect(def.core.record.auto?.filledAt).toBe(def.now);
    // Once a Bots off lobby has started, its seats stay.
    const started = setup({ ...crowd(), lobbySize: 2 });
    started.core.setAuto(null, true);
    join(started, 2);
    expect(started.core.release(started.core.record.humans[0]!.token)).toBeNull();
  });
});

describe("ranking: more than 25% bots doesn't count", () => {
  it(`the rule: at most ${RANKING.rankedMaxBotShare * 100}% bots`, () => {
    expect(isRankedMatch(0, 100)).toBe(true);
    expect(isRankedMatch(25, 100)).toBe(true);
    expect(isRankedMatch(26, 100)).toBe(false);
    expect(isRankedMatch(99, 100)).toBe(false);
    expect(isRankedMatch(0, 0)).toBe(false);
  });

  it("a lobby's results say whether it counted, and each person's too (practice never does)", () => {
    const playOut = (L: ReturnType<typeof setup>) => {
      for (let i = 0; i < 20_000 && L.core.record.phase !== "results"; i++) {
        L.inbox.clear();
        L.advance(Math.max(1, (L.core.nextAlarm ?? L.now + 1000) - L.now));
      }
      expect(L.core.record.phase).toBe("results");
    };
    // 48 people and 16 bots (Classic's 64 seats): exactly 25% bots, ranked. One of them practising (unlimited hints).
    const L = setup();
    join(L, 47);
    L.core.connect(undefined, "Practice", "phone", true);
    L.core.message("p1", { t: "start" });
    expect(L.core.record.bots).toHaveLength(16);
    // (Nobody here scores: with everyone gone, rounds time out and the match plays itself out.)
    for (const h of L.core.record.humans) L.core.disconnect(h.id);
    playOut(L);
    expect(L.core.ranked()).toBe(true);
    const mine = L.core.humanResults();
    expect(mine.filter((r) => r.ranked)).toHaveLength(47);
    expect(mine.find((r) => r.playerId === "p48")!.ranked).toBe(false);
    L.core.connect(L.core.record.humans[0]!.token, "P0", "phone");
    expect(L.last("p1", "results")!.ranked).toBe(true);

    // One person and 63 bots: unranked.
    const B = setup();
    B.core.connect(undefined, "Ann", "computer");
    B.core.message("p1", { t: "start" });
    B.core.disconnect("p1");
    playOut(B);
    B.core.connect(B.core.record.humans[0]!.token, "Ann", "computer");
    expect(B.last("p1", "results")!.ranked).toBe(false);
    expect(B.core.humanResults()[0]!.ranked).toBe(false);
  });
});
