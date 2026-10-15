import { describe, expect, it, vi } from "vitest";
import { BOSS_ROSTER, allPausable, bossFinalOption, chooseBoss, crowdFinalBoss, isPlayable, pausedLine, pauseVariable, playableBosses, rosterWithout } from "@chessroyale/core";
import { createGuest, ensureSchema } from "../src/accounts.ts";
import { handleAccountApi } from "../src/api.ts";
import { friendsOn } from "../src/friends-api.ts";
import { CACHE_MS, isPaused, pausedBosses, pausedResponse, switchStatus } from "../src/kill-switches.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server's container needs the Workers runtime; nothing here reaches it.)
vi.mock("@cloudflare/containers", () => ({ Container: class {}, getContainer: () => ({ fetch: async () => new Response("{}") }) }));
const { default: worker } = await import("../src/index.ts");

/**
 * The kill switches (docs/areas/ops.md, "Kill switches"): Worker variables PAUSE_<NAME> rest one part of the game; the
 * server refuses anything new for it with its line; MAINTENANCE_BANNER is the message on every screen.
 */

const playable = playableBosses()[0]!.id;

describe("reading the switches", () => {
  it("one variable each: PAUSE_ and the part's name, a boss's by its id", () => {
    expect(pauseVariable("squads")).toBe("PAUSE_SQUADS");
    expect(pauseVariable("shop")).toBe("PAUSE_SHOP");
    expect(pauseVariable("boss:pig")).toBe("PAUSE_BOSS_PIG");
    expect(allPausable()).toEqual(expect.arrayContaining(["classic", "crowd", "raid", "squads", "solo", "shop", "friends", ...BOSS_ROSTER.map((b) => `boss:${b.id}`)]));
  });

  it("on with 1, true, yes or on (or a JSON true or 1); anything else, or unset, leaves it running", () => {
    for (const v of ["1", "true", "TRUE", " yes ", "on", true, 1]) expect(switchStatus({ PAUSE_SQUADS: v }).paused).toEqual(["squads"]);
    for (const v of ["0", "", "false", "off", "no", "2", false, 0]) expect(switchStatus({ PAUSE_SQUADS: v }).paused).toEqual([]);
    expect(switchStatus({}).paused).toEqual([]);
    expect(switchStatus({ PAUSE_CROWD: "1", PAUSE_BOSS_PIG: "1", PAUSE_NOTHING: "1" }).paused).toEqual(["crowd", "boss:pig"]);
    expect(pausedBosses({ PAUSE_BOSS_PIG: "1", PAUSE_SHOP: "1" })).toEqual(["pig"]);
  });

  it("the banner: its message, trimmed, at most 200 characters; empty is none", () => {
    expect(switchStatus({ MAINTENANCE_BANNER: "  Back at 6 pm.  " }).banner).toBe("Back at 6 pm.");
    expect(switchStatus({ MAINTENANCE_BANNER: "x".repeat(300) }).banner).toHaveLength(200);
    expect(switchStatus({ MAINTENANCE_BANNER: "   " }).banner).toBeNull();
    expect(switchStatus({}).banner).toBeNull();
  });

  it("read once a minute: a change shows after CACHE_MS (a new deploy's instances start fresh)", () => {
    const env: Record<string, string> = {};
    expect(isPaused(env, "squads", 1000)).toBe(false);
    env.PAUSE_SQUADS = "1";
    expect(isPaused(env, "squads", 1000 + CACHE_MS - 1)).toBe(false);
    expect(isPaused(env, "squads", 1000 + CACHE_MS)).toBe(true);
    expect(CACHE_MS).toBe(60_000);
  });

  it("the friendly lines, and the server's refusal: 503 with the line and which part", async () => {
    expect(pausedLine("squads")).toBe("Squads is resting for a bit. Back soon.");
    expect(pausedLine("raid")).toBe("Boss raids are resting for a bit. Back soon.");
    expect(pausedLine("solo")).toBe("Solo and Boss alone are resting for a bit. Back soon.");
    expect(pausedLine("shop")).toBe("The shop is resting for a bit. Back soon.");
    expect(pausedLine(`boss:${playable}`)).toBe(`${BOSS_ROSTER.find((b) => b.id === playable)!.name} is resting for a bit. Back soon.`);
    const res = pausedResponse("squads");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: pausedLine("squads"), paused: "squads" });
  });

  it("friends: off with PAUSE_FRIENDS", () => {
    expect(friendsOn({})).toBe(true);
    expect(friendsOn({ PAUSE_FRIENDS: "1" })).toBe(false);
  });
});

describe("the server refuses new matches for a part that's resting", () => {
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  let ip = 0;
  const call = async (env: object, method: string, path: string) => {
    const res = await worker.fetch(new Request(`https://hunchess.test${path}`, { method, headers: { "cf-connecting-ip": `10.1.0.${++ip}` } }), env as never, ctx);
    return { status: res.status, body: (await res.json()) as { message?: string; paused?: string; banner?: string | null } };
  };

  it("GET /api/status: what's resting and the banner", async () => {
    expect((await call({}, "GET", "/api/status")).body).toEqual({ paused: [], banner: null });
    expect((await call({ PAUSE_SQUADS: "1", MAINTENANCE_BANNER: "Maintenance at 6 pm." }, "GET", "/api/status")).body).toEqual({ paused: ["squads"], banner: "Maintenance at 6 pm." });
  });

  it("PLAY, a new lobby, Squads' queue and a new party", async () => {
    const cases: [object, string, string][] = [
      [{ PAUSE_CROWD: "1" }, "/api/play", "crowd"],
      [{ PAUSE_RAID: "1" }, "/api/play?mode=raid", "raid"],
      [{ PAUSE_CROWD: "1" }, "/api/lobby?mode=crowd", "crowd"],
      [{ PAUSE_CLASSIC: "1" }, "/api/lobby?mode=classic", "classic"],
      [{ PAUSE_RAID: "1" }, "/api/lobby?mode=raid", "raid"],
      [{ [pauseVariable(`boss:${playable}`)]: "1" }, `/api/lobby?mode=raid&boss=${playable}`, `boss:${playable}`],
      [{ PAUSE_SQUADS: "1" }, "/api/squads/play", "squads"],
      [{ PAUSE_SQUADS: "1" }, "/api/squads/party", "squads"],
    ];
    for (const [env, path, part] of cases) {
      const r = await call(env, "POST", path);
      expect(r.status, path).toBe(503);
      expect(r.body, path).toEqual({ message: pausedLine(part as never), paused: part });
    }
    // Another part resting doesn't stop this one.
    const PARTIES = { idFromName: (c: string) => c, get: () => ({ create: async () => true }) };
    const party = await call({ PAUSE_RAID: "1", PARTIES }, "POST", "/api/squads/party");
    expect(party.status).toBe(200);
    expect(party.body).toEqual({ code: expect.stringMatching(/^[A-Z2-9]{5}$/) });
  });

  it("the shop: nothing new from it while it rests; equipping what you have still works", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql);
    const guest = await createGuest(sql, Date.now(), "Player");
    const env = { DB: d1, PAUSE_SHOP: "1" };
    const post = async (path: string, body: unknown) => {
      const res = (await handleAccountApi(new Request(`https://hunchess.test${path}`, { method: "POST", body: JSON.stringify(body), headers: { cookie: `hc_session=${guest.token}` } }), env as never))!;
      return { status: res.status, body: (await res.json()) as { message?: string } };
    };
    expect(await post("/api/shop/buy", { item: "anything" })).toEqual({ status: 503, body: { message: pausedLine("shop"), paused: "shop" } });
    expect(await post("/api/locker/open", { crate: "winter-1" })).toEqual({ status: 503, body: { message: pausedLine("shop"), paused: "shop" } });
    expect((await post("/api/locker/equip", { slot: "head", item: null })).status).toBe(200);
  });
});

describe("a boss that's resting is never met", () => {
  it("the roster without him: never picked, never at random; if that left none, the whole roster", () => {
    const off = [playable];
    const roster = rosterWithout(off);
    expect(roster.some((b) => b.id === playable)).toBe(false);
    for (let i = 0; i < 20; i++) expect(chooseBoss(i / 20, playable, null, roster).id).not.toBe(playable);
    expect(rosterWithout(BOSS_ROSTER.filter(isPlayable).map((b) => b.id))).toBe(BOSS_ROSTER);
    expect(rosterWithout([])).toBe(BOSS_ROSTER);
  });

  it("the Crowd's boss final: while his boss rests, another stands in and the vote's card names none", () => {
    const final = crowdFinalBoss();
    if (!final) return;
    const roster = rosterWithout([final.id]);
    expect(crowdFinalBoss(roster)).toBeNull();
    expect(bossFinalOption().label).toBe(final.name);
    expect(bossFinalOption(roster).label).toBe("Boss battle");
  });
});
