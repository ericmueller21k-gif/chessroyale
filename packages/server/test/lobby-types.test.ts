import { describe, expect, it } from "vitest";
import { MATCHMAKING, RAID_SETTINGS, RANKING, isRankedMatch, modeSettings, rankedMinHumans, type Settings } from "@chessroyale/core";
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

  it("Bots off: a seat whose person has been gone two minutes is freed (the count is real); back while it waits: a new seat", () => {
    const L = setup({ ...crowd(), lobbySize: 3 });
    L.core.setAuto(null, true);
    L.core.connect(undefined, "Ann", "phone");
    const ann = L.core.record.humans[0]!.token;
    L.core.disconnect("p1");
    // Gone a minute: still hers.
    L.advance(60_000);
    L.core.connect(undefined, "Bo", "phone");
    expect(L.core.record.humans.map((h) => h.name)).toEqual(["Ann", "Bo"]);
    // Gone past the hold: freed when the next person arrives, so two people don't fill "three" with a ghost.
    L.advance(MATCHMAKING.botsOffSeatHoldMs);
    L.core.connect(undefined, "Cy", "phone");
    expect(L.core.record.humans.map((h) => h.name)).toEqual(["Bo", "Cy"]);
    expect(L.core.record.auto?.filledAt).toBeUndefined();
    expect(L.last("p2", "lobby")!.players.map((p) => p.name)).toEqual(["Bo", "Cy"]);
    // Ann's back: a new seat with her own token, and that fills it.
    expect(L.core.connect(ann, "Ann", "phone")).toMatchObject({ ok: true });
    expect(L.core.record.humans.map((h) => h.name)).toEqual(["Bo", "Cy", "Ann"]);
    expect(L.core.record.auto?.filledAt).toBe(L.now);
    // (Someone who's only been away a moment keeps their seat.)
    const D = setup({ ...crowd() });
    D.core.setAuto(null, true);
    D.core.connect(undefined, "Dee", "phone");
    D.core.disconnect("p1");
    D.advance(30_000);
    D.core.connect(D.core.record.humans[0]!.token, "Dee", "phone");
    D.advance(MATCHMAKING.botsOffSeatHoldMs * 2);
    D.core.connect(undefined, "Ed", "phone");
    expect(D.core.record.humans.map((h) => h.name)).toEqual(["Dee", "Ed"]);
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

describe("ranking: a match needs at least 30% real players", () => {
  it(`the rule: real players fill at least ${RANKING.rankedMinHumanShare * 100}% of the mode's seats`, () => {
    expect(rankedMinHumans(100)).toBe(30);
    expect(rankedMinHumans(50)).toBe(15);
    expect(rankedMinHumans(64)).toBe(20);
    expect(isRankedMatch(30, 100)).toBe(true);
    expect(isRankedMatch(29, 100)).toBe(false);
    expect(isRankedMatch(15, 50)).toBe(true);
    expect(isRankedMatch(14, 50)).toBe(false);
    expect(isRankedMatch(20, 64)).toBe(true);
    expect(isRankedMatch(19, 64)).toBe(false);
    expect(isRankedMatch(0, 0)).toBe(false);
  });

  it("a raid counts its seats, not just who came: Bots off with 10 people is unranked, with 15 ranked", () => {
    for (const [people, ranked] of [
      [MATCHMAKING.raidBotsOffMinPlayers, false],
      [15, true],
    ] as const) {
      const L = setup({ ...RAID_SETTINGS });
      L.core.setAuto(L.now + 60_000, true);
      join(L, people);
      L.advance(60_000);
      expect(L.core.record.auto?.filledAt).toBe(L.now);
      expect(L.core.record.bots).toHaveLength(0);
      expect(L.core.ranked()).toBe(ranked);
    }
    // A Default raid of one: 49 bots, unranked.
    const D = setup({ ...RAID_SETTINGS });
    D.core.setAuto(D.now + 60_000);
    join(D, 1);
    D.advance(60_000);
    expect(D.core.ranked()).toBe(false);
  });

  it("a lobby's results say whether it counted, and each person's too (practice never does)", () => {
    const playOut = (L: ReturnType<typeof setup>) => {
      for (let i = 0; i < 20_000 && L.core.record.phase !== "results"; i++) {
        L.inbox.clear();
        L.advance(Math.max(1, (L.core.nextAlarm ?? L.now + 1000) - L.now));
      }
      expect(L.core.record.phase).toBe("results");
    };
    // 20 people and 44 bots (Classic's 64 seats): exactly 30% real players, ranked. One of them practising.
    const L = setup();
    join(L, 19);
    L.core.connect(undefined, "Practice", "phone", true);
    L.core.message("p1", { t: "start" });
    expect(L.core.record.bots).toHaveLength(44);
    // (Nobody here scores: with everyone gone, rounds time out and the match plays itself out.)
    for (const h of L.core.record.humans) L.core.disconnect(h.id);
    playOut(L);
    expect(L.core.ranked()).toBe(true);
    const mine = L.core.humanResults();
    expect(mine.filter((r) => r.ranked)).toHaveLength(19);
    expect(mine.find((r) => r.playerId === "p20")!.ranked).toBe(false);
    L.core.connect(L.core.record.humans[0]!.token, "P0", "phone");
    expect(L.last("p1", "results")!.ranked).toBe(true);

    // 19 people and 45 bots: one short, unranked.
    const S = setup();
    join(S, 19);
    S.core.message("p1", { t: "start" });
    expect(S.core.ranked()).toBe(false);

    // One person and 63 bots: unranked, and the results say so.
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
