import { describe, expect, it } from "vitest";
import { FAIRPLAY, type FairMove } from "@chessroyale/core";
import { createGuest, ensureSchema, publicProfile, recordResult, signInWithIdentity, type Sql, type User } from "../src/accounts.ts";
import { caseOf, eligibleForRanked, purgeEvidence, recordFairPlay, reportPlayer, setCase } from "../src/fairplay.ts";
import { handleAccountApi } from "../src/api.ts";
import { memoryDb } from "./memory-db.ts";

const DAY = 86_400_000;

/** A signed-in account (an email identity), as online players are. */
async function player(sql: Sql, name: string, now = 1000): Promise<User> {
  const g = await createGuest(sql, now, name);
  return signInWithIdentity(sql, g.user, "email", `${name.toLowerCase()}@example.com`, {}, now);
}

/** `n` online results for a player, a minute apart from `from`. */
async function played(sql: Sql, userId: string, n: number, from: number, rating = 1600) {
  for (let i = 0; i < n; i++) await recordResult(sql, userId, { mode: "crowd", online: true, placement: 10, players: 100, rating: rating + i, ranked: true }, from + i * 60_000);
}

describe("reports", () => {
  it("one per reporter, player and match; outside a match one a day; never yourself or nobody", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const a = await player(sql, "Ann");
    const b = await player(sql, "Bo");
    expect(await reportPlayer(sql, a, b.id, "Offensive name or icon", "ABCDE", 5000)).toEqual({ ok: true });
    // The same match again: accepted, not stored twice.
    expect(await reportPlayer(sql, a, b.id, "Cheating", "ABCDE", 6000)).toEqual({ ok: true, already: true });
    // Another match: a new report.
    expect(await reportPlayer(sql, a, b.id, "Cheating", "FGHJK", 7000)).toEqual({ ok: true });
    // From a profile (no match): one a day.
    expect(await reportPlayer(sql, a, b.id, "Something else", null, 8000)).toEqual({ ok: true });
    expect(await reportPlayer(sql, a, b.id, "Something else", undefined, 9000)).toEqual({ ok: true, already: true });
    expect(await reportPlayer(sql, a, b.id, "Something else", null, 9000 + DAY)).toEqual({ ok: true });
    expect((await reportPlayer(sql, a, a.id, "Cheating", null, 9000)).ok).toBe(false);
    expect((await reportPlayer(sql, a, "nobody", "Cheating", null, 9000)).ok).toBe(false);
    expect((await reportPlayer(sql, a, b.id, "because", null, 9000)).ok).toBe(false);
    // A match code that isn't one is treated as no match.
    expect(await sql.all("SELECT reason, match FROM reports ORDER BY at")).toEqual([
      { reason: "Offensive name or icon", match: "ABCDE" },
      { reason: "Cheating", match: "FGHJK" },
      { reason: "Something else", match: null },
      { reason: "Something else", match: null },
    ]);
  });

  it("is rate-limited per reporter per day", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const a = await player(sql, "Ann");
    const targets = [];
    for (let i = 0; i <= FAIRPLAY.reports.perDay; i++) targets.push((await createGuest(sql, 1000, `T${i}`)).user.id);
    for (let i = 0; i < FAIRPLAY.reports.perDay; i++) expect((await reportPlayer(sql, a, targets[i], "Something else", null, 5000 + i)).ok).toBe(true);
    expect(await reportPlayer(sql, a, targets[FAIRPLAY.reports.perDay], "Something else", null, 6000)).toEqual({ ok: false, message: expect.stringMatching(/a lot of reports/) });
    expect((await reportPlayer(sql, a, targets[FAIRPLAY.reports.perDay], "Something else", null, 6000 + DAY)).ok).toBe(true);
  });

  it("every report opens a watch case; it never bans", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const a = await player(sql, "Ann");
    const b = await player(sql, "Bo");
    await reportPlayer(sql, a, b.id, "Offensive name or icon", null, 5000);
    expect((await caseOf(sql, b.id))?.status).toBe("watch");
    expect(await eligibleForRanked(sql, b.id)).toBe(true);
    expect((await sql.all("SELECT action, by FROM fairplay_log WHERE user_id = ?", b.id))).toEqual([{ action: "watch", by: "reports" }]);
  });

  it("cheating reports from 3 signed-in players within 7 days put a player in review (2 for a new account); guests don't count", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const target = await player(sql, "Target");
    await played(sql, target.id, FAIRPLAY.reports.newAccountMatches, 1000);
    const [a, b, c] = [await player(sql, "Ann"), await player(sql, "Bo"), await player(sql, "Cy")];
    const guest = (await createGuest(sql, 1000, "Guest")).user;
    const t = 10 * DAY;
    await reportPlayer(sql, a, target.id, "Cheating", "AAAAA", t);
    await reportPlayer(sql, guest, target.id, "Cheating", "AAAAA", t + 1);
    await reportPlayer(sql, b, target.id, "Offensive name or icon", "AAAAA", t + 2);
    await reportPlayer(sql, b, target.id, "Cheating", "BBBBB", t + 3);
    expect((await caseOf(sql, target.id))?.status).toBe("watch");
    // The third different signed-in account, within the week: review.
    await reportPlayer(sql, c, target.id, "Cheating", "CCCCC", t + 6 * DAY);
    expect((await caseOf(sql, target.id))?.status).toBe("review");
    expect(await eligibleForRanked(sql, target.id)).toBe(false);

    // Outside the week, they don't add up.
    const late = await player(sql, "Late");
    await played(sql, late.id, FAIRPLAY.reports.newAccountMatches, 1000);
    await reportPlayer(sql, a, late.id, "Cheating", "DDDDD", t);
    await reportPlayer(sql, b, late.id, "Cheating", "EEEEE", t + 2 * DAY);
    await reportPlayer(sql, c, late.id, "Cheating", "FFFFF", t + 8 * DAY);
    expect((await caseOf(sql, late.id))?.status).toBe("watch");

    // A new account (fewer than 10 online matches): two are enough.
    const fresh = await player(sql, "Fresh");
    await played(sql, fresh.id, FAIRPLAY.reports.newAccountMatches - 1, 1000);
    await reportPlayer(sql, a, fresh.id, "Cheating", "GGGGG", t);
    expect((await caseOf(sql, fresh.id))?.status).toBe("watch");
    await reportPlayer(sql, b, fresh.id, "Cheating", "GGGGG", t + 1);
    expect((await caseOf(sql, fresh.id))?.status).toBe("review");
  });

  it("after a clearing, only new reports count", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const target = await player(sql, "Target");
    const [a, b, c] = [await player(sql, "Ann"), await player(sql, "Bo"), await player(sql, "Cy")];
    await reportPlayer(sql, a, target.id, "Cheating", "AAAAA", 5000);
    await reportPlayer(sql, b, target.id, "Cheating", "AAAAA", 5001);
    expect((await caseOf(sql, target.id))?.status).toBe("review");
    await setCase(sql, target.id, "cleared", "admin:eric", "looked at the games: honest", 6000);
    await reportPlayer(sql, c, target.id, "Cheating", "BBBBB", 7000);
    expect((await caseOf(sql, target.id))?.status).toBe("watch");
    await reportPlayer(sql, a, target.id, "Cheating", "CCCCC", 8000);
    expect((await caseOf(sql, target.id))?.status).toBe("review");
  });
});

describe("review holds results off ranking", () => {
  it("entering review holds the last week's online results; clearing counts them again", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    const t = 30 * DAY;
    // An older result (counts), then two recent ones.
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 5, players: 100, rating: 1500, ranked: true }, t - 20 * DAY);
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 2600, ranked: true }, t - DAY);
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 2700, ranked: true }, t - 1000);
    expect((await publicProfile(sql, p.id, t))!.rating).toBe(2700);
    await setCase(sql, p.id, "review", "detection", "super-GM strength", t);
    const held = await publicProfile(sql, p.id, t);
    expect(held!.rating).toBe(1500);
    expect(held!.ratingHistory).toEqual([1500]);
    // Stats still count every match (nothing on the profile says why).
    expect(held!.crowd.games).toBe(3);
    // A result recorded while in review is held too.
    await recordResult(sql, p.id, { mode: "crowd", online: true, placement: 1, players: 100, rating: 2800, ranked: true, held: true }, t + 1000);
    expect((await publicProfile(sql, p.id, t + 2000))!.rating).toBe(1500);
    await setCase(sql, p.id, "cleared", "admin:eric", "strong but honest", t + 3000);
    expect((await publicProfile(sql, p.id, t + 4000))!.rating).toBe(2800);
    expect(await eligibleForRanked(sql, p.id)).toBe(true);
    expect((await sql.all<{ action: string; by: string }>("SELECT action, by FROM fairplay_log WHERE user_id = ? ORDER BY id", p.id)).map((r) => `${r.action}/${r.by}`)).toEqual([
      "review/detection",
      "cleared/admin:eric",
    ]);
    expect(await caseOf(sql, p.id)).toMatchObject({ status: "cleared", decided_by: "admin:eric", reason: "strong but honest" });
  });
});

describe("POST /api/report", () => {
  it("answers with what to tell the reporter", async () => {
    const { sql, d1 } = memoryDb();
    await ensureSchema(sql, d1);
    const env = { DB: d1 };
    const me = await fetch1(env, "GET", "/api/me");
    const cookie = me!.headers.getSetCookie().find((c) => c.startsWith("hc_session="))!.split(";")[0]!;
    const target = (await createGuest(sql, 1000, "Bo")).user.id;
    const send = (body: unknown) => fetch1(env, "POST", "/api/report", body, cookie).then(async (r) => ({ status: r.status, body: await r.json() }));
    expect(await send({ target, reason: "Cheating", match: "ABCDE" })).toEqual({ status: 200, body: { ok: true, message: "Thanks, we'll look into it." } });
    expect(await send({ target, reason: "Cheating", match: "ABCDE" })).toEqual({ status: 200, body: { ok: true, already: true, message: "You've already reported this player in this match." } });
    expect((await send({ target, reason: "Nope" })).status).toBe(400);
  });
});

async function fetch1(env: { DB: D1Database }, method: string, path: string, body?: unknown, cookie?: string): Promise<Response> {
  const req = new Request(`https://hunchess.test${path}`, { method, headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return (await handleAccountApi(req, env))!;
}

/** A match's picks: `n` counted middlegame moves, every fourth one hard (2 of 40 found it); `engine` finds them all. */
function picks(n: number, engine: boolean): FairMove[] {
  return Array.from({ length: n }, (_, i) => {
    const hard = i % 4 === 0;
    const loss = engine ? 0 : hard ? 15 : i % 3 === 0 ? 10 : 2;
    return { ply: 14 + 2 * i, fen: `fen ${i}`, move: engine ? "e2e4" : "d2d4", best: "e2e4", loss, bestExp: 0.55, near: 2, gap: 3, crowd: 40, crowdFound: hard ? 2 : 24, thinkMs: engine ? 3500 : hard ? 15_000 : 6000, away: 0, legal: 30 };
  });
}

describe("fair-play records", () => {
  it("stores each match's signals as history, with the picks as evidence: 3 days, or 30 when flagged", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const honest = await player(sql, "Honest");
    const cheat = await player(sql, "Cheat");
    const t = 50 * DAY;
    const h = await recordFairPlay(sql, honest.id, { lobby: "AAAAA", mode: "crowd", moves: picks(20, false) }, t);
    expect(h.verdict.level).toBe("none");
    const c = await recordFairPlay(sql, cheat.id, { lobby: "AAAAA", mode: "crowd", moves: picks(20, true) }, t);
    expect(c.summary.perf!).toBeGreaterThan(3000);
    expect(["review", "ban"]).toContain(c.verdict.level);
    const rows = await sql.all<{ user_id: string; counted: number; perf: number; level: string; moves: string; keep_until: number; summary: string }>(
      "SELECT user_id, counted, perf, level, moves, keep_until, summary FROM fairplay_matches ORDER BY id",
    );
    expect(rows.map((r) => [r.user_id, r.counted, r.level])).toEqual([
      [honest.id, 20, "none"],
      [cheat.id, 20, c.verdict.level],
    ]);
    expect(JSON.parse(rows[0]!.moves)).toHaveLength(20);
    expect(JSON.parse(rows[1]!.summary).perf).toBe(c.summary.perf);
    expect(rows[0]!.keep_until).toBe(t + FAIRPLAY.evidenceDaysUnflagged * DAY);
    expect(rows[1]!.keep_until).toBe(t + FAIRPLAY.evidenceDays * DAY);
  });

  it("watch only (the setting at launch): a review or ban level opens a watch case and says what it would have done", async () => {
    expect(FAIRPLAY.enforcement).toBe("watch");
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const cheat = await player(sql, "Cheat");
    const t = 50 * DAY;
    const r1 = await recordFairPlay(sql, cheat.id, { lobby: "AAAAA", mode: "crowd", moves: picks(20, true) }, t);
    const r2 = await recordFairPlay(sql, cheat.id, { lobby: "BBBBB", mode: "crowd", moves: picks(20, true) }, t + 3_600_000);
    expect(r2.verdict.level).toBe("ban");
    expect([r1.acted, r2.acted]).toEqual(["watch", "watch"]);
    expect((await caseOf(sql, cheat.id))?.status).toBe("watch");
    expect(await eligibleForRanked(sql, cheat.id)).toBe(true);
    const log = await sql.all<{ action: string; by: string; reason: string }>("SELECT action, by, reason FROM fairplay_log WHERE user_id = ? ORDER BY id", cheat.id);
    expect(log.map((l) => `${l.action}/${l.by}`)).toEqual(["watch/detection", "note/detection"]);
    expect(log[1]!.reason).toMatch(/^level ban, not acted on \(watch only\)/);
  });

  it("a report after a match keeps that match's evidence the full 30 days; old evidence goes unless the case is open", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const a = await player(sql, "Ann");
    const b = await player(sql, "Bo");
    const c = await player(sql, "Cy");
    const t = 50 * DAY;
    await recordFairPlay(sql, b.id, { lobby: "AAAAA", mode: "crowd", moves: picks(12, false) }, t);
    await recordFairPlay(sql, c.id, { lobby: "AAAAA", mode: "crowd", moves: picks(12, false) }, t);
    // Ann reports Bo the next day: Bo's match is kept 30 days from now.
    await reportPlayer(sql, a, b.id, "Cheating", "AAAAA", t + DAY);
    const keep = async (id: string) => (await sql.first<{ keep_until: number | null; moves: string | null }>("SELECT keep_until, moves FROM fairplay_matches WHERE user_id = ?", id))!;
    expect((await keep(b.id)).keep_until).toBe(t + DAY + FAIRPLAY.evidenceDays * DAY);
    // Four days on: Cy's (unflagged) evidence is gone, the summary stays; Bo's case is open, so his stays.
    await purgeEvidence(sql, t + 4 * DAY, true);
    expect(await keep(c.id)).toEqual({ keep_until: null, moves: null });
    expect((await keep(b.id)).moves).not.toBeNull();
    expect((await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM fairplay_matches"))!.n).toBe(2);
    // Bo's watch sees nothing new for 30 days: it closes, and then his evidence goes too.
    await purgeEvidence(sql, t + DAY + (FAIRPLAY.evidenceDays + 1) * DAY, true);
    expect((await caseOf(sql, b.id))?.status).toBe("closed");
    expect((await keep(b.id)).moves).toBeNull();
  });

  it("a case in review keeps its evidence past 30 days; after a clearing, older matches don't count again", async () => {
    const { sql } = memoryDb();
    await ensureSchema(sql);
    const p = await player(sql, "Pat");
    const t = 50 * DAY;
    await recordFairPlay(sql, p.id, { lobby: "AAAAA", mode: "crowd", moves: picks(20, true) }, t);
    await setCase(sql, p.id, "review", "admin:eric", "looking", t + 1000);
    await purgeEvidence(sql, t + 40 * DAY, true);
    expect((await sql.first<{ moves: string | null }>("SELECT moves FROM fairplay_matches WHERE user_id = ?", p.id))!.moves).not.toBeNull();
    // Another flagged match, then a clearing two days later: a quiet match after it doesn't bring the old one back.
    const u = t + 50 * DAY;
    expect((await recordFairPlay(sql, p.id, { lobby: "BBBBB", mode: "crowd", moves: picks(20, true) }, u)).verdict.level).not.toBe("none");
    await setCase(sql, p.id, "cleared", "admin:eric", "a strong honest player", u + 2 * DAY);
    const next = await recordFairPlay(sql, p.id, { lobby: "CCCCC", mode: "crowd", moves: picks(20, false) }, u + 3 * DAY);
    expect(next.verdict.level).toBe("none");
    expect((await caseOf(sql, p.id))?.status).toBe("cleared");
  });
});
