import { describe, expect, it } from "vitest";
import { CROWD_KNOCKOUTS, FRONT_DOOR, LOBBY_LIFE, RAID_SETTINGS, modeSettings, type Settings } from "@chessroyale/core";
import { MATCH_ENDED, lobbyClosing } from "../src/lobby.ts";
import { setup } from "./lobby-fixture.ts";

/**
 * When a lobby closes (LOBBY_LIFE; the Durable Object then deletes it and frees its code). In a file of its own: a
 * few of these play whole matches out on the lobby's own clock, which takes a while, and files run side by side.
 */

describe("lobby: closing (LOBBY_LIFE)", () => {
  const MIN = 60_000;
  const crowd = (format: "team" | "boss" | "duel") => ({
    ...modeSettings("crowd", { crowdTeams: true, augments: false }),
    finalFormat: format,
    knockoutsPerStage: CROWD_KNOCKOUTS[format],
    // A real match's length (the test lobby's default is one round a stage).
    firstStageRounds: 20,
    roundsPerStage: 2,
  });
  /** Runs the match on its own clock: every timer as it falls due, with nobody picking or scoring. */
  const playOut = (L: ReturnType<typeof setup>, check?: () => void) => {
    for (let i = 0; i < 50_000 && L.core.record.phase !== "results"; i++) {
      // (Nobody reads the messages on the way: dropped, so the outboxes stay small.)
      L.inbox.clear();
      L.advance(Math.max(1, (L.core.nextAlarm ?? L.now + 1000) - L.now));
      check?.();
    }
    expect(L.core.record.phase).toBe("results");
  };

  it("results stay up for lobbyResultsKeepMinutes after the match ends, then it closes (one from before this rule: at once)", () => {
    expect(LOBBY_LIFE.lobbyResultsKeepMinutes).toBe(15);
    const L = setup();
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    playOut(L);
    const ended = L.now;
    expect(L.core.record.endedAt).toBe(ended);
    // People still connected (GG in the chat, sharing) don't keep it open: it closes on time.
    expect(lobbyClosing(L.core.record, true)).toEqual({ at: ended + 15 * MIN, reason: "ended" });
    expect(lobbyClosing(L.core.record, false)).toEqual({ at: ended + 15 * MIN, reason: "ended" });
    // ?keep=SECONDS (playtests).
    expect(lobbyClosing({ ...L.core.record, keepMs: 8000 }, true)!.at).toBe(ended + 8000);
    // A lobby that ended before lobbies closed: due now.
    expect(lobbyClosing({ ...L.core.record, endedAt: undefined }, true)!.at).toBeLessThanOrEqual(L.now);
  });

  it("a lobby nobody starts closes after lobbyIdleMinutes with nothing happening in it; anything anyone does pushes that back", () => {
    expect(LOBBY_LIFE.lobbyIdleMinutes).toBe(60);
    const L = setup();
    const made = L.now;
    expect(lobbyClosing(L.core.record, false)).toEqual({ at: made + 60 * MIN, reason: "idle" });
    L.advance(30 * MIN);
    L.core.connect(undefined, "Ann", "computer");
    // Even with someone sitting in it: a lobby that never starts closes once nothing has happened for an hour.
    expect(lobbyClosing(L.core.record, true)).toEqual({ at: made + 90 * MIN, reason: "idle" });
    L.advance(20 * MIN);
    L.core.message("p1", { t: "speed", nps: 500_000 });
    expect(lobbyClosing(L.core.record, true)!.at).toBe(made + 110 * MIN);
    // Except quick chat (the lobby's chat before the match): chatting never keeps a lobby open.
    L.advance(10 * MIN);
    L.core.message("p1", { t: "chat", say: "hi-all" });
    L.core.message("p1", { t: "chatPrefs", off: false });
    expect(lobbyClosing(L.core.record, true)!.at).toBe(made + 110 * MIN);
    L.advance(10 * MIN);
    L.core.disconnect("p1");
    expect(lobbyClosing(L.core.record, false)!.at).toBe(made + 130 * MIN);
    // Once it starts it's a match in progress: not while anyone's connected.
    L.core.connect(L.core.record.humans[0]!.token, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    expect(lobbyClosing(L.core.record, true)).toBeNull();
  });

  it("a match in progress never closes while anyone is connected; left to itself it reaches its results well inside the safety cap", () => {
    expect(LOBBY_LIFE.lobbyAbandonedMinutes).toBe(180);
    const cap = LOBBY_LIFE.lobbyAbandonedMinutes * MIN;
    const took: Record<string, number> = {};
    for (const [name, settings] of [
      ["team final", crowd("team")],
      ["boss battle", crowd("boss")],
      ["duel", crowd("duel")],
      ["boss raid", { ...RAID_SETTINGS }],
    ] as const) {
      const L = setup(settings as Partial<Settings>);
      L.core.connect(undefined, "Ann", "phone");
      L.core.message("p1", { t: "start" });
      L.advance(1000);
      expect(lobbyClosing(L.core.record, true)).toBeNull();
      // Everyone leaves (closes the app): the safety cap counts from then.
      const left = L.now;
      L.core.disconnect("p1");
      expect(lobbyClosing(L.core.record, false)).toEqual({ at: left + cap, reason: "abandoned" });
      // The match plays itself out (nobody scores, nobody picks), and is never due to close on the way.
      playOut(L, () => {
        const c = lobbyClosing(L.core.record, false)!;
        expect(c.at).toBeGreaterThan(L.now);
      });
      took[name] = L.now - left;
      expect(L.now - left).toBeLessThan(cap * 0.75);
      expect(lobbyClosing(L.core.record, false)!.reason).toBe("ended");
    }
    // (How long each took, to keep the cap's reasoning honest: see LOBBY_LIFE.)
    console.log("abandoned matches played out in", Object.fromEntries(Object.entries(took).map(([k, v]) => [k, `${Math.round(v / MIN)} min`])));
  }, 120_000);

  it("a returning player sees their true place: one who closed the app as the match began and missed every move came 100th of 100", () => {
    // (A short final: a place at the first cut doesn't depend on it.)
    const L = setup({ ...crowd("team"), finalMaxTurns: 6 });
    L.core.connect(undefined, "Ann", "phone", false, null, undefined, "user-ann");
    const token = L.core.record.humans[0]!.token;
    L.core.message("p1", { t: "start" });
    L.advance(1000);
    L.core.disconnect("p1");
    playOut(L);
    L.take("p1");
    // Back hours later (within the keep time): her seat, and the results as they were.
    const back = L.core.connect(token, "Ann", "phone");
    expect(back).toMatchObject({ ok: true, playerId: "p1" });
    const res = L.last("p1", "results")!;
    expect(res.placements.p1).toBe(100);
    expect(res.placements.p1).toBe(L.core.record.placements.p1);
    // The same place goes on her profile.
    expect(L.core.humanResults()).toMatchObject([{ playerId: "p1", placement: 100, players: 100 }]);
  });

  it("someone who wasn't in the match is told it has ended; so is a seat from an older lobby that had this code", () => {
    const L = setup();
    // (An older lobby's seat, before anything has started here.)
    expect(L.core.connect("0123456789abcdef01234567", "Old", "phone")).toEqual({ ok: false, message: MATCH_ENDED, ended: true });
    expect(L.core.record.humans).toHaveLength(0);
    L.core.connect(undefined, "Ann", "computer");
    L.core.message("p1", { t: "start" });
    // During the match: it has started.
    expect(L.core.connect(undefined, "Bo", "phone")).toMatchObject({ ok: false, message: "This match has already started." });
    playOut(L);
    expect(L.core.connect(undefined, "Bo", "phone")).toEqual({ ok: false, message: MATCH_ENDED, ended: true });
    expect(L.core.record.humans.map((h) => h.name)).toEqual(["Ann"]);
  });

  it("a queue whose fill time passed while nobody was there starts as soon as someone comes back", () => {
    const L = setup({ ...modeSettings("crowd", { crowdTeams: true, augments: true }) });
    L.core.setAuto(L.now + 60_000);
    L.core.connect(undefined, "Ann", "phone");
    const token = L.core.record.humans[0]!.token;
    L.core.disconnect("p1");
    L.advance(60_000);
    // Nobody here at the fill time: nothing started, and nothing will on its own.
    expect(L.core.record.phase).toBe("lobby");
    expect(L.core.record.auto?.filledAt).toBeUndefined();
    expect(L.core.nextAlarm).toBeNull();
    L.advance(5 * MIN);
    L.core.connect(token, "Ann", "phone");
    expect(L.core.record.auto?.filledAt).toBe(L.now);
    expect(L.core.record.bots).toHaveLength(99);
    L.advance(FRONT_DOOR.fillShowMs);
    expect(L.core.record.phase).toBe("vote");
  });
});
