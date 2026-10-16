import { describe, expect, it } from "vitest";
import { BOSS_ROSTER, BOSS_TIERS, CRATES_FREE, CROWD_SETTINGS, QUICK_PACE, WEAK_BOT_SKILL, isPlayable } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity } from "../src/accounts.ts";
import { testSwitchesOn } from "../src/admin.ts";
import { handleAccountApi } from "../src/api.ts";
import { LOBBY_TEST_SWITCHES, asksTestSwitches, lobbyOptions } from "../src/lobby-options.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * The test switches (docs/areas/ops.md, "Test switches"): playtest shortcuts that would make easy wins work only for an
 * admin or where TEST_SWITCHES is "1"; for anyone else they're ignored, silently, and the creator's own choices stay.
 */

const q = (s: string) => new URLSearchParams(s);
const playable = BOSS_ROSTER.find((b) => isPlayable(b))!.id;

describe("who may use them", () => {
  const env = { ADMIN_EMAILS: "eric@example.com, other@example.com" };
  it("an admin, or anyone where TEST_SWITCHES is exactly 1", () => {
    expect(testSwitchesOn(env, { email: "Eric@Example.com" })).toBe(true);
    expect(testSwitchesOn(env, { email: "player@example.com" })).toBe(false);
    expect(testSwitchesOn(env, { email: null })).toBe(false);
    expect(testSwitchesOn(env, null)).toBe(false);
    expect(testSwitchesOn({ ...env, TEST_SWITCHES: "1" }, null)).toBe(true);
    for (const v of ["0", "", "true", "yes"]) expect(testSwitchesOn({ ...env, TEST_SWITCHES: v }, null)).toBe(false);
  });
});

describe("a new lobby's options", () => {
  const all = `rounds=1&clock=5&finalTurns=2&bossMoves=3&draw=weighted&power=candle&format=boss&speed=bullet&weakbots=1&keep=5&pace=quick&augments=0`;

  it("for a player, every test switch is dropped: the lobby is exactly the one made without them", () => {
    for (const base of ["mode=crowd", "mode=classic", `mode=raid&boss=${playable}`]) {
      expect(lobbyOptions(q(`${base}&${all}`), false)).toEqual(lobbyOptions(q(base), false));
      expect(lobbyOptions(q(`${base}&${all}`), false).keepMs).toBeUndefined();
    }
    // Each one alone, too.
    for (const k of LOBBY_TEST_SWITCHES) expect(lobbyOptions(q(`mode=crowd&${k}=${k === "draw" ? "weighted" : k === "format" ? "boss" : k === "pace" ? "quick" : k === "augments" ? 0 : 1}`), false)).toEqual(lobbyOptions(q("mode=crowd"), false));
    // A boss's fixed strength, and a boss in a mode that isn't a raid.
    const raid = lobbyOptions(q(`mode=raid&boss=${BOSS_TIERS[0]}`), false).overrides;
    expect(raid.bossFixedElo).toBeUndefined();
    expect(raid.bossFixed).toBeUndefined();
    expect(lobbyOptions(q(`mode=crowd&boss=${playable}`), false)).toEqual(lobbyOptions(q("mode=crowd"), false));
  });

  it("for a player, the creator's own choices stay: the mode, the raid's boss", () => {
    const crowd = lobbyOptions(q(`mode=crowd&${all}`), false).overrides;
    expect(crowd.mode).toBe("crowd");
    // The pre-game votes always (augments=0 is a test switch since Oct 15), at the mode's own pace (pace=quick too).
    expect(crowd.augments).toBe(true);
    expect(crowd.revealSeconds).toBe(CROWD_SETTINGS.revealSeconds);
    // Classic's opening moves are its own (an older app's moves= is ignored, for everyone, since Oct 15).
    expect(lobbyOptions(q("mode=classic&moves=4"), false)).toEqual(lobbyOptions(q("mode=classic"), false));
    expect(lobbyOptions(q("mode=classic&moves=4"), true).overrides.openingMoves).toBeUndefined();
    const raid = lobbyOptions(q(`mode=raid&boss=${playable}&${all}`), false).overrides;
    expect(raid.raid).toBe(true);
    expect(raid.bossId).toBe(playable);
    expect(raid.bossPicked).toBe(playable);
  });

  it("an older app's Crowd choices are ignored: everyone moves (turns=all) is team turns, Relaxed pace off is the mode's pace", () => {
    const old = lobbyOptions(q("mode=crowd&turns=all&augments=1&pace=quick"), false);
    expect(old).toEqual(lobbyOptions(q("mode=crowd&augments=1"), false));
    expect(old.overrides.crowdTeams).toBe(true);
    expect(old.overrides.knockoutsPerStage).toEqual(CROWD_SETTINGS.knockoutsPerStage);
    // Even where the test switches work, turns=all is gone.
    expect(lobbyOptions(q("mode=crowd&turns=all"), true).overrides.crowdTeams).toBe(true);
  });

  it("for those allowed, the switches work", () => {
    const o = lobbyOptions(q(`mode=crowd&${all}`), true);
    expect(o.overrides).toMatchObject({ roundsPerStage: 1, firstStageRounds: 1, finalMaxTurns: 2, bossMaxMoves: 3, drawRuleByStage: ["weighted"], bossPowerTest: "candle", finalFormat: "boss", botSkillRange: WEAK_BOT_SKILL, peopleFirst: true });
    expect(o.keepMs).toBe(5000);
    expect(lobbyOptions(q(`mode=raid&boss=${BOSS_TIERS[0]}`), true).overrides).toMatchObject({ bossFixedElo: BOSS_TIERS[0], bossFixed: BOSS_TIERS[0] });
    expect(lobbyOptions(q(`mode=crowd&boss=${playable}`), true).overrides.bossId).toBe(playable);
    expect(lobbyOptions(q("mode=crowd&pace=quick"), true).overrides).toMatchObject(QUICK_PACE.crowd);
    expect(lobbyOptions(q("mode=classic&pace=quick"), true).overrides).toMatchObject(QUICK_PACE.classic);
    expect(lobbyOptions(q("mode=crowd&augments=0"), true).overrides.augments).toBe(false);
  });

  it("asks who's asking only when a query has a test switch", () => {
    expect(asksTestSwitches(q("mode=crowd"))).toBe(false);
    expect(asksTestSwitches(q("mode=crowd&augments=0"))).toBe(true);
    expect(asksTestSwitches(q("mode=crowd&pace=quick"))).toBe(true);
    expect(asksTestSwitches(q("mode=classic&moves=3"))).toBe(false);
    expect(asksTestSwitches(q(`mode=raid&boss=${playable}`))).toBe(false);
    expect(asksTestSwitches(q(`mode=raid&boss=${BOSS_TIERS[0]}`))).toBe(true);
    expect(asksTestSwitches(q(`mode=crowd&boss=${playable}`))).toBe(true);
    expect(asksTestSwitches(q("mode=crowd&weakbots=1"))).toBe(true);
  });
});

describe("the account API", () => {
  const call = async (env: object, path: string, init: RequestInit & { cookie?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    const res = (await handleAccountApi(new Request(`https://hunchess.com${path}`, { ...init, headers }), env as never))!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await res.json()) as any;
  };

  it("/api/auth/config says when TEST_SWITCHES is on (the app then honors its switches for everyone)", async () => {
    expect((await call({ DB: memoryDb().d1 }, "/api/auth/config")).testSwitches).toBeUndefined();
    expect((await call({ DB: memoryDb().d1, TEST_SWITCHES: "0" }, "/api/auth/config")).testSwitches).toBeUndefined();
    expect((await call({ DB: memoryDb().d1, TEST_SWITCHES: "1" }, "/api/auth/config")).testSwitches).toBe(true);
  });

  it.runIf(CRATES_FREE)("a crate's forced roll (Fischer Random, Shiny) only for an admin or where TEST_SWITCHES is on", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const guest = await createGuest(sql, Date.now(), "Player");
    const open = async (env: object, cookie: string) =>
      (await call(env, "/api/locker/open", { method: "POST", body: JSON.stringify({ crate: "winter-1", fischer: true, shiny: true }), cookie })).roll as { fischer: boolean };
    // A player: ignored (natural odds: not 8 Fischer Randoms in a row).
    const player = `hc_session=${guest.token}`;
    const rolls = [];
    for (let i = 0; i < 8; i++) rolls.push(await open({ DB: d1, ADMIN_EMAILS: "eric@example.com" }, player));
    expect(rolls.filter((r) => r.fischer).length).toBeLessThan(8);
    // TEST_SWITCHES on, or an admin: forced.
    expect((await open({ DB: d1, TEST_SWITCHES: "1" }, player)).fischer).toBe(true);
    const g2 = await createGuest(sql, Date.now(), "Eric");
    const eric = await signInWithIdentity(sql, g2.user, "email", "eric@example.com", {}, Date.now());
    const admin = `hc_session=${await createSession(sql, eric.id, Date.now())}`;
    for (let i = 0; i < 3; i++) expect((await open({ DB: d1, ADMIN_EMAILS: "eric@example.com" }, admin)).fischer).toBe(true);
  });
});
