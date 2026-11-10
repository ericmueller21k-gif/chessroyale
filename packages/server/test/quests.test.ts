import { describe, expect, it, vi } from "vitest";
import { QUESTS, XP, questDef, questWeekStart, xpDayStart } from "@chessroyale/core";
import { createGuest, createSession, ensureSchema, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { ledgerMismatches } from "../src/ledger.ts";
import { lockerState } from "../src/locker.ts";
import { NO_REROLL, ensureQuests, questsAnswer, rerollQuest, setTestQuests } from "../src/quests.ts";
import { gameXpOf, grantXp, setTestXp, xpColumns, xpFromRow, xpOf, type XpGame } from "../src/xp.ts";
import { memoryDb } from "./memory-db.ts";

// (The engine server is a Container, which needs the Workers runtime: the match rooms import it.)
vi.mock("../src/engine.ts", () => ({ SERVER_RECHECK_NODES: 2_000_000, serverRecheck: async () => null, serverScoreAt: async () => null, warmEngine: async () => false }));

/**
 * Quests (XP phase 3; server/quests.ts, core's quests.ts; QUESTS in settings.ts; docs/decisions/2026-11-09-quests-*.md): dealt lazily
 * from a seed on the day's first read (two at once deal once), the XP day's and the week's resets, the carry-over cap, one reroll a
 * day per daily, progress from each mode's counted games (none from a game with no XP, a solo game only for "finish games" with enough of the
 * server's time, a win only when its XP was paid), completion paid once through the ledger in the game's XP batch (replays, two tabs,
 * two games at once), the weekly, PAUSE_REWARDS, and quests through a guest's merge, the download and deleting the account.
 */
// (Monday Nov 9, 2026, 12:00 UTC: the XP day began at 08:00, the week too.)
const T0 = Date.UTC(2026, 10, 9, 12, 0);
const MIN = 60_000;
const DAY = 86_400_000;

async function world() {
  const { sql, d1 } = memoryDb();
  await ensureSchema(sql);
  return { sql, d1 };
}
const signedIn = async (sql: Sql, email: string, now = T0) => signInWithIdentity(sql, (await createGuest(sql, now, "Player")).user, "email", email, {}, now);
/** A signed-in account with a fixed id, so the deal (seeded by the account and the day) is the same every run (review of #575, M1). */
const fixedAccount = async (sql: Sql, id: string, email: string, now = T0) => {
  await sql.run("INSERT INTO users (id, name, email, created_at, last_seen) VALUES (?, 'Player', ?, ?, ?)", id, email, now, now);
  return { id };
};
/** A counted game of 12 minutes and 12 of your own moves (short of the daily reward's 15, so only quests add to its XP). */
const game = (key: string, quest: XpGame["quest"], facts: Partial<XpGame["facts"]> = {}, over: Partial<XpGame> = {}): XpGame => ({
  key,
  facts: { ms: 12 * MIN, moves: 12, won: false, ...facts },
  signedInOnly: true,
  now: T0,
  quest,
  ...over,
});
const quests = async (sql: Sql, id: string, now = T0) => (await questsAnswer(sql, id, now)).quests;
const progress = async (sql: Sql, id: string, now = T0) => Object.fromEntries((await quests(sql, id, now)).map((q) => [q.name, `${q.progress}/${q.target}`]));
const set = (sql: Sql, id: string, list: [string, number?][], now = T0) => setTestQuests(sql, id, list.map(([kind, p]) => ({ kind, progress: p ?? 0 })), now);

describe("dealing: lazily, from a seed, on the day's first read", () => {
  it("a new account's first read deals 2 dailies and the weekly; the next read deals nothing more; the dailies differ", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    expect(await sql.all("SELECT * FROM quests")).toEqual([]);
    const a = await questsAnswer(sql, ann.id, T0);
    expect(a.quests.map((q) => q.period)).toEqual(["daily", "daily", "weekly"]);
    expect(new Set(a.quests.map((q) => q.name)).size).toBe(3);
    expect(a.quests.every((q) => q.progress === 0)).toBe(true);
    expect(a).toMatchObject({ day: xpDayStart(T0), dailyResetAt: xpDayStart(T0) + DAY, weeklyResetAt: questWeekStart(T0) + 7 * DAY });
    expect(a.quests.map((q) => q.canReroll)).toEqual([true, true, false]);
    expect((await questsAnswer(sql, ann.id, T0 + 3 * 3_600_000)).quests).toEqual(a.quests);
    expect((await sql.all("SELECT id FROM quests")).length).toBe(3);
  });

  it("seeded: two reads at once deal once (the same quests)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const all = await Promise.all([1, 2, 3, 4].map(() => questsAnswer(sql, ann.id, T0)));
    expect((await sql.all("SELECT id FROM quests")).length).toBe(3);
    for (const a of all) expect(a.quests.map((q) => q.id)).toEqual(all[0]!.quests.map((q) => q.id));
  });

  it("the week starts on Monday at 08:00 UTC, the day at 08:00 UTC", () => {
    const monday8 = Date.UTC(2026, 10, 9, 8, 0);
    expect(questWeekStart(T0)).toBe(monday8);
    expect(questWeekStart(monday8 - 1)).toBe(monday8 - 7 * DAY);
    expect(questWeekStart(monday8 + 6 * DAY + 23 * 3_600_000)).toBe(monday8);
    expect(questWeekStart(Date.UTC(2026, 10, 15, 23, 0))).toBe(monday8);
    expect(questWeekStart(Date.UTC(2026, 10, 16, 8, 0))).toBe(monday8 + 7 * DAY);
  });

  it("a game deals the day's quests too (the day's first read), so a quest dealt today counts today's first game", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await grantXp(sql, ann.id, game("squads:AAAAA:1", "squads"));
    const qs = await quests(sql, ann.id);
    expect(qs.length).toBe(3);
    // (The weekly, "Complete 10 games", counted it.)
    expect(qs.find((q) => q.period === "weekly")!.progress).toBe(1);
  });
});

describe("resets and the carry-over cap", () => {
  it("the next XP day: finished dailies go, unfinished ones wait, topped up to QUESTS.maxDailies (3), never past it", async () => {
    const { sql } = await world();
    // (A fixed id: the deal is the same every run. Review of #575, M1: a random id made the last check flaky.)
    const ann = await fixedAccount(sql, "questsdealfixed01", "ann@example.com");
    // Day 1: two unfinished.
    const d1 = (await quests(sql, ann.id)).filter((q) => q.period === "daily");
    expect(d1.length).toBe(QUESTS.dailyPerDay);
    // (07:59 the next morning: still day 1.)
    expect((await quests(sql, ann.id, xpDayStart(T0) + DAY - MIN)).filter((q) => q.period === "daily").map((q) => q.id)).toEqual(d1.map((q) => q.id));
    // Day 2 (08:00): both wait, one more dealt: 3.
    const d2 = (await quests(sql, ann.id, xpDayStart(T0) + DAY)).filter((q) => q.period === "daily");
    expect(d2.length).toBe(QUESTS.maxDailies);
    expect(d2.slice(0, 2).map((q) => q.id)).toEqual(d1.map((q) => q.id));
    // Day 3: three wait, none dealt.
    const d3 = (await quests(sql, ann.id, xpDayStart(T0) + 2 * DAY)).filter((q) => q.period === "daily");
    expect(d3.map((q) => q.id)).toEqual(d2.map((q) => q.id));
    // One finished on day 3 (the test switch: its kind at one short, then a game): day 4 drops it and deals one.
    await set(sql, ann.id, [["warm-up", 2], ["squad-up"], ["fifty-fifty"], ["regular"]], xpDayStart(T0) + 2 * DAY + MIN);
    await grantXp(sql, ann.id, game("lobby:AAAAA:1", "classic", {}, { now: xpDayStart(T0) + 2 * DAY + 2 * MIN }));
    expect(await progress(sql, ann.id, xpDayStart(T0) + 2 * DAY + 3 * MIN)).toEqual({ "Warm Up": "3/3", "Squad Up": "0/2", "Fifty-Fifty": "0/1", Regular: "1/10" });
    const warmUp = (await quests(sql, ann.id, xpDayStart(T0) + 2 * DAY + 3 * MIN)).find((q) => q.name === "Warm Up")!.id;
    const d4 = (await quests(sql, ann.id, xpDayStart(T0) + 3 * DAY)).filter((q) => q.period === "daily");
    expect(d4.length).toBe(3);
    // (The finished quest itself is gone; a new quest of the same kind may be dealt on a later day.)
    expect(d4.map((q) => q.id)).not.toContain(warmUp);
    expect(d4.slice(0, 2).map((q) => q.name)).toEqual(["Squad Up", "Fifty-Fifty"]);
  });

  it("the weekly resets on Monday at 08:00 UTC, finished or not, and doesn't carry", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["squad-up"], ["warm-up"], ["regular", 9]]);
    const week1 = (await quests(sql, ann.id)).find((q) => q.period === "weekly")!;
    expect(week1.progress).toBe(9);
    // (Sunday night: the same.)
    expect((await quests(sql, ann.id, questWeekStart(T0) + 7 * DAY - MIN)).find((q) => q.period === "weekly")!.id).toBe(week1.id);
    const week2 = (await quests(sql, ann.id, questWeekStart(T0) + 7 * DAY)).filter((q) => q.period === "weekly");
    expect(week2.length).toBe(1);
    expect(week2[0]!.id).not.toBe(week1.id);
    expect(week2[0]!.progress).toBe(0);
    expect(await sql.all("SELECT * FROM quest_progress WHERE quest_id = ?", week1.id)).toEqual([]);
  });
});

describe("the reroll: each unfinished daily its own free one a day (Eric, Nov 10)", () => {
  it("swaps only that quest (its progress gone, its place kept); the other daily keeps its own reroll; the replacement can't be rerolled today; tomorrow both can", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["squad-up", 1], ["warm-up"], ["regular"]]);
    const [squad] = await quests(sql, ann.id);
    expect(await rerollQuest(sql, ann.id, squad!.id, T0)).toEqual({ ok: true });
    const after = await questsAnswer(sql, ann.id, T0);
    const swapped = after.quests[0]!;
    expect([swapped.period, swapped.progress]).toEqual(["daily", 0]);
    expect(["Squad Up", "Warm Up"]).not.toContain(swapped.name);
    // (Only the one: its place kept, the other daily and the weekly as they were.)
    expect(after.quests.map((q) => q.name).slice(1)).toEqual(["Warm Up", "Regular"]);
    expect(after.quests.map((q) => q.canReroll)).toEqual([false, true, false]);
    // The replacement's reroll is used today.
    expect(await rerollQuest(sql, ann.id, swapped.id, T0)).toEqual({ ok: false, message: NO_REROLL });
    // The other daily's is still there; then neither has one.
    const warm = after.quests[1]!;
    expect(await rerollQuest(sql, ann.id, warm.id, T0 + MIN)).toEqual({ ok: true });
    const both = await questsAnswer(sql, ann.id, T0 + MIN);
    expect(both.quests[0]!.id).toBe(swapped.id);
    expect(both.quests[1]!.id).not.toBe(warm.id);
    expect(both.quests[1]!.name).not.toBe("Warm Up");
    expect(new Set(both.quests.map((q) => q.name)).size).toBe(3);
    expect(both.quests.map((q) => q.canReroll)).toEqual([false, false, false]);
    for (const q of both.quests) expect(await rerollQuest(sql, ann.id, q.id, T0 + 2 * MIN)).toEqual({ ok: false, message: NO_REROLL });
    // Tomorrow: the two carried over (unfinished) can each be rerolled again; the day's deal tops up to three, that one too.
    const tomorrow = await questsAnswer(sql, ann.id, T0 + DAY);
    const dailies = tomorrow.quests.filter((q) => q.period === "daily");
    expect(dailies.slice(0, 2).map((q) => q.id)).toEqual([swapped.id, both.quests[1]!.id]);
    expect(dailies.every((q) => q.canReroll)).toBe(true);
    expect((await rerollQuest(sql, ann.id, dailies[0]!.id, T0 + DAY)).ok).toBe(true);
    expect((await rerollQuest(sql, ann.id, dailies[1]!.id, T0 + DAY)).ok).toBe(true);
  });

  it("never the weekly, a finished daily, someone else's quest or a made-up id; two at once reroll once", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bob = await signedIn(sql, "bob@example.com");
    await set(sql, ann.id, [["fifty-fifty"], ["warm-up"], ["regular"]]);
    await grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd"));
    const [fifty, warm, weekly] = await quests(sql, ann.id);
    expect(fifty!.progress).toBe(1);
    for (const id of [fifty!.id, weekly!.id, "nope", 7]) expect(await rerollQuest(sql, ann.id, id, T0)).toEqual({ ok: false, message: NO_REROLL });
    expect(await rerollQuest(sql, bob.id, warm!.id, T0)).toEqual({ ok: false, message: NO_REROLL });
    const both = await Promise.all([rerollQuest(sql, ann.id, warm!.id, T0), rerollQuest(sql, ann.id, warm!.id, T0)]);
    expect(both.filter((r) => r.ok).length).toBe(1);
    expect((await quests(sql, ann.id)).length).toBe(3);
    // (Two tabs on the replacement too: refused, it's used today; the slot was swapped once.)
    const [, swapped] = await quests(sql, ann.id);
    const again = await Promise.all([rerollQuest(sql, ann.id, swapped!.id, T0), rerollQuest(sql, ann.id, swapped!.id, T0)]);
    expect(again.every((r) => !r.ok)).toBe(true);
    expect((await sql.all("SELECT id FROM quests WHERE rerolled_day IS NOT NULL")).length).toBe(1);
  });

  it("two different dailies rerolled at once never end up the same quest (one game would pay both: review of #603)", async () => {
    const { sql } = await world();
    for (let i = 0; i < 40; i++) {
      const u = await signedIn(sql, `u${i}@example.com`);
      await set(sql, u.id, [["squad-up"], ["warm-up"], ["regular"]]);
      const [a, b] = await quests(sql, u.id);
      await Promise.all([rerollQuest(sql, u.id, a!.id, T0), rerollQuest(sql, u.id, b!.id, T0)]);
      const kinds = (await sql.all<{ kind: string }>("SELECT kind FROM quests WHERE user_id = ? AND period = 'daily'", u.id)).map((r) => r.kind);
      expect(kinds.length, `u${i}`).toBe(2);
      expect(new Set(kinds).size, `u${i}: ${kinds.join(", ")}`).toBe(2);
    }
  });
});

describe("progress: only counted games, by mode, decided by the server", () => {
  it("each mode moves its own quests; every counted game the 'finish games' ones", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["squad-up"], ["fifty-fifty"], ["raid-party"], ["boss-hunter"], ["winner"], ["regular"]]);
    await grantXp(sql, ann.id, game("squads:AAAAA:1", "squads"));
    await grantXp(sql, ann.id, game("lobby:BBBBB:1", "crowd"));
    await grantXp(sql, ann.id, game("lobby:CCCCC:1", "boss"));
    await grantXp(sql, ann.id, game("lobby:DDDDD:1", "classic"));
    await grantXp(sql, ann.id, game("duel:EEEEE", "duel"));
    expect(await progress(sql, ann.id)).toEqual({ "Squad Up": "1/2", "Fifty-Fifty": "1/1", "Boss Fighter": "1/2", "Boss Hunter": "0/1", Winner: "0/2", Regular: "5/10" });
    // A won raid: Boss Fighter, Boss Hunter and Winner; a won ranked game: Winner.
    await grantXp(sql, ann.id, game("lobby:FFFFF:1", "boss", { won: true }));
    await grantXp(sql, ann.id, game("duel:GGGGG", "duel", { won: true }));
    expect(await progress(sql, ann.id)).toEqual({ "Squad Up": "1/2", "Fifty-Fifty": "1/1", "Boss Fighter": "2/2", "Boss Hunter": "1/1", Winner: "2/2", Regular: "7/10" });
  });

  it("no XP, no progress: too short, left, a test game, a guest where sign-in is set up, a banned account, rewards paused", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["warm-up"], ["squad-up"], ["regular"]]);
    const none = [
      game("squads:A:1", "squads", { moves: XP.minMoves - 1 }),
      game("squads:B:1", "squads", { abandoned: true }),
      game("squads:C:1", "squads", { test: true }),
      game("squads:D:1", "squads", {}, { paused: true }),
    ];
    for (const g of none) expect((await grantXp(sql, ann.id, g))?.none).toBeTruthy();
    expect(await progress(sql, ann.id)).toEqual({ "Warm Up": "0/3", "Squad Up": "0/2", Regular: "0/10" });
    const guest = (await createGuest(sql, T0, "Guest")).user;
    expect((await grantXp(sql, guest.id, game("squads:E:1", "squads")))?.none).toBe("guest");
    expect(await sql.all("SELECT * FROM quests WHERE user_id = ?", guest.id)).toEqual([]);
    await sql.run("INSERT INTO fairplay_cases (user_id, status, opened_at, updated_at) VALUES (?, 'banned', ?, ?)", ann.id, T0, T0);
    expect((await grantXp(sql, ann.id, game("squads:F:1", "squads")))?.none).toBe("banned");
    expect(await progress(sql, ann.id)).toEqual({ "Warm Up": "0/3", "Squad Up": "0/2", Regular: "0/10" });
  });

  it("a solo game (the device's word for its moves and win) moves only 'finish games' quests, with QUESTS.soloMinMinutes of the server's time", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["warm-up"], ["winner"], ["boss-hunter"], ["regular"]]);
    await grantXp(sql, ann.id, game("solo:aaaaaaaaaaaaaaaaaa", "solo", { ms: QUESTS.soloMinMinutes * MIN - 1_000, won: true }, { cap: "solo" }));
    expect(await progress(sql, ann.id)).toEqual({ "Warm Up": "0/3", Winner: "0/2", "Boss Hunter": "0/1", Regular: "0/10" });
    await grantXp(sql, ann.id, game("solo:bbbbbbbbbbbbbbbbbb", "solo", { ms: 12 * MIN, won: true }, { cap: "solo" }));
    expect(await progress(sql, ann.id)).toEqual({ "Warm Up": "1/3", Winner: "0/2", "Boss Hunter": "0/1", Regular: "1/10" });
  });

  it("a solo Boss Battle (Nov 10) moves the boss quests under the same solo rules: enough time, and a win only with its win XP", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["boss-hunter"], ["raid-party"], ["winner"]]);
    await grantXp(sql, ann.id, game("solo:aaaaaaaaaaaaaaaaaa", "soloBoss", { ms: QUESTS.soloMinMinutes * MIN - 1_000, won: true }, { cap: "solo" }));
    expect(await progress(sql, ann.id)).toEqual({ "Boss Hunter": "0/1", "Boss Fighter": "0/2", Winner: "0/2" });
    await grantXp(sql, ann.id, game("solo:bbbbbbbbbbbbbbbbbb", "soloBoss", { ms: 12 * MIN, won: false }, { cap: "solo" }));
    expect(await progress(sql, ann.id)).toEqual({ "Boss Hunter": "0/1", "Boss Fighter": "1/2", Winner: "0/2" });
    await grantXp(sql, ann.id, game("solo:cccccccccccccccccc", "soloBoss", { ms: 12 * MIN, won: true }, { cap: "solo" }));
    expect(await progress(sql, ann.id)).toEqual({ "Boss Hunter": "1/1", "Boss Fighter": "2/2", Winner: "0/2" });
  });

  it("a solo game past the day's solo minutes (no XP) moves no quest: no XP, no progress (review of #575, m2)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["squad-up"], ["warm-up"], ["regular"]]);
    // (XP.soloMinutesPerDay of solo time: games of XP.maxMinutes, lost, so no win XP either.)
    const full = XP.soloMinutesPerDay / XP.maxMinutes;
    for (let i = 0; i < full; i++) await grantXp(sql, ann.id, game(`solo:${String(i).repeat(18)}`, "solo", { ms: XP.maxMinutes * MIN }, { cap: "solo" }));
    expect((await progress(sql, ann.id)).Regular).toBe(`${full}/10`);
    const past = await grantXp(sql, ann.id, game("solo:ffffffffffffffffff", "solo", { ms: XP.maxMinutes * MIN }, { cap: "solo" }));
    expect(past?.none).toBe("limit");
    expect((await progress(sql, ann.id)).Regular).toBe(`${full}/10`);
    // (A WON game past the minutes cap still earns its win XP, so it counts: delta review m-a, Nov 9.)
    const won = await grantXp(sql, ann.id, game("solo:eeeeeeeeeeeeeeeeee", "solo", { ms: XP.maxMinutes * MIN, won: true }, { cap: "solo" }));
    expect(won?.parts.some((p) => p.label.startsWith("Win"))).toBe(true);
    expect((await progress(sql, ann.id)).Regular).toBe(`${full + 1}/10`);
  });

  it("a win counts only if its XP was paid: a friends' lobby's second win today against the same player moves nothing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const bob = await signedIn(sql, "bob@example.com");
    await set(sql, ann.id, [["winner"], ["warm-up"], ["regular"]]);
    await grantXp(sql, ann.id, game("lobby:AAAAA:1", "classic", { won: true }, { cap: { vs: [bob.id] } }));
    const second = await grantXp(sql, ann.id, game("lobby:BBBBB:1", "classic", { won: true }, { cap: { vs: [bob.id] } }));
    expect(second?.parts.map((p) => p.label)).toContain("Win (paid once today)");
    expect(await progress(sql, ann.id)).toEqual({ Winner: "1/2", "Warm Up": "2/3", Regular: "2/10" });
  });
});

describe("completion: paid once through the ledger, in the game's XP", () => {
  it("the game that finishes a quest pays it: its XP a part of the box (\"Quest\"), its crate in the rewards, the ledger agreeing", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["boss-hunter"], ["warm-up"], ["regular"]]);
    const x = await grantXp(sql, ann.id, game("lobby:AAAAA:1", "boss", { won: true }));
    expect(x?.parts).toEqual([
      { label: "12 min", xp: 120 },
      { label: "Win", xp: XP.win },
      { label: "Quest", xp: 300 },
    ]);
    expect(x).toMatchObject({ before: 0, after: 120 + XP.win + 300 });
    expect(x?.rewards).toEqual({ crate: XP.rewardCrate, daily: 0, crates: 0, keys: 0, bossPicks: 0, levels: [], quests: [{ quest: "boss-hunter", name: "Boss Hunter", xp: 300, crates: 1, keys: 0 }] });
    expect((await lockerState(sql, ann.id)).seriesCrates).toEqual({ [XP.rewardCrate]: 1 });
    expect(await xpOf(sql, ann.id)).toBe(120 + XP.win + 300);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
    // (Kept on the result row as it is, for the result screen to ask for.)
    expect(xpFromRow(Object.fromEntries(["xp_before", "xp_parts", "xp_none", "xp_rewards"].map((k, i) => [k, xpColumns(x)[i]])) as never)).toEqual(x);
  });

  it("a replay of the finishing game answers the same and pays nothing more; a later game pays nothing for it", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["fifty-fifty"], ["warm-up"], ["regular"]]);
    const first = await grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd"));
    const again = await grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd"));
    expect(again).toEqual(first);
    const later = await grantXp(sql, ann.id, game("lobby:BBBBB:1", "crowd"));
    expect(later?.parts.map((p) => p.label)).toEqual(["12 min"]);
    expect(await xpOf(sql, ann.id)).toBe(120 + 300 + 120);
    expect((await sql.all("SELECT * FROM ledger WHERE reason = 'quest'")).length).toBe(1);
  });

  it("a replayed grant after a reroll moves only the quests its first attempt moved, never the new one (review of #575, m1)", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    // (Every daily kind held but Fifty-Fifty, so the reroll can only deal Fifty-Fifty, which a Crowd game counts.)
    await set(sql, ann.id, [["warm-up"], ["squad-up"], ["boss-hunter"], ["raid-party"], ["winner"], ["regular"]]);
    const first = await grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd"));
    const squad = (await quests(sql, ann.id)).find((q) => q.name === "Squad Up")!;
    expect(await rerollQuest(sql, ann.id, squad.id, T0)).toEqual({ ok: true });
    expect((await progress(sql, ann.id))["Fifty-Fifty"]).toBe("0/1");
    // (The room retries the same game's grant: Squads' reward queue, the duel room's alarm.)
    const again = await grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd"));
    expect(again).toEqual(first);
    expect(await progress(sql, ann.id)).toMatchObject({ "Warm Up": "1/3", "Fifty-Fifty": "0/1", Regular: "1/10" });
    expect(await sql.all("SELECT * FROM ledger WHERE reason = 'quest'")).toEqual([]);
    // (The same after the next day's deal.)
    await grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd", {}, { now: T0 + DAY }));
    expect((await progress(sql, ann.id, T0 + DAY))["Fifty-Fifty"]).toBe("0/1");
  });

  it("two games at once (two rooms, two tabs) finishing the same quest pay it once; a target of 2 reached by two at once, once", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["fifty-fifty"], ["squad-up"], ["regular"]]);
    const both = await Promise.all([
      grantXp(sql, ann.id, game("lobby:AAAAA:1", "crowd")),
      grantXp(sql, ann.id, game("lobby:BBBBB:1", "crowd")),
      grantXp(sql, ann.id, game("squads:CCCCC:1", "squads")),
      grantXp(sql, ann.id, game("squads:DDDDD:1", "squads")),
    ]);
    const paid = both.flatMap((g) => g?.rewards?.quests ?? []).map((q) => q.quest).sort();
    expect(paid).toEqual(["fifty-fifty", "squad-up"]);
    expect(await xpOf(sql, ann.id)).toBe(4 * 120 + 2 * 300);
    expect(await progress(sql, ann.id)).toEqual({ "Fifty-Fifty": "1/1", "Squad Up": "2/2", Regular: "4/10" });
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("the weekly: 1,500 XP, a Winter Crate and a key; its XP can level you up, and that level's rewards come with it", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await setTestXp(sql, ann.id, 500, T0);
    await set(sql, ann.id, [["squad-up"], ["warm-up"], ["regular", 9]]);
    const x = await grantXp(sql, ann.id, game("duel:AAAAA", "duel"));
    const weekly = questDef("regular")!;
    expect(x?.parts.at(-1)).toEqual({ label: "Quest", xp: weekly.xp });
    expect(x?.rewards?.quests?.map((q) => [q.quest, q.xp, q.crates, q.keys])).toEqual([["regular", weekly.xp, 1, 1]]);
    // (500 + 120 + 1,500 = 2,120: Level 3. Levels 2 and 3 paid by this game.)
    expect(x).toMatchObject({ before: 500, after: 2_120, levelAfter: 3 });
    expect(x?.rewards?.levels).toEqual([2, 3]);
    const l = await lockerState(sql, ann.id);
    expect([l.seriesCrates[XP.rewardCrate], l.keys]).toEqual([1 + 2 * XP.levelCrates, 1 + 2 * XP.levelKeys]);
    expect(await ledgerMismatches(sql, ann.id)).toEqual([]);
  });

  it("two quests in one game: \"Quests\" with both; the result screen's GET /api/xp answers them", async () => {
    const { sql } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    await set(sql, ann.id, [["fifty-fifty"], ["warm-up", 2], ["regular"]]);
    const x = await grantXp(sql, ann.id, game("lobby:ABCDE:1", "crowd"));
    expect(x?.parts.at(-1)).toEqual({ label: "Quests", xp: 600 });
    expect(x?.rewards?.quests?.map((q) => q.name).sort()).toEqual(["Fifty-Fifty", "Warm Up"]);
    const { recordResult } = await import("../src/accounts.ts");
    await recordResult(sql, ann.id, { mode: "crowd", online: true, placement: 1, players: 100, lobby: "ABCDE", xp: x }, T0);
    expect(await gameXpOf(sql, ann.id, "ABCDE", T0 + MIN)).toEqual(x);
  });
});

describe("the account's data", () => {
  it("a guest's quests go at its merge (the account keeps its own); the download has them; deleting removes them", async () => {
    const { sql } = await world();
    const owner = await signedIn(sql, "owner@example.com");
    await ensureQuests(sql, owner.id, T0);
    const mine = (await quests(sql, owner.id)).map((q) => q.id);
    const guest = (await createGuest(sql, T0, "Guest")).user;
    await ensureQuests(sql, guest.id, T0);
    expect((await sql.all("SELECT id FROM quests WHERE user_id = ?", guest.id)).length).toBe(3);
    await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0 + 1);
    expect(await sql.all("SELECT * FROM quests WHERE user_id = ?", guest.id)).toEqual([]);
    expect(await sql.all("SELECT * FROM quest_days WHERE user_id = ?", guest.id)).toEqual([]);
    expect((await quests(sql, owner.id)).map((q) => q.id)).toEqual(mine);
    await grantXp(sql, owner.id, game("squads:AAAAA:1", "squads"));
    const d = (await accountDownload(sql, owner, T0 + 2)) as unknown as { quests: { quests: { kind: string; progress: number }[]; days: { day: number } } };
    expect(d.quests.quests.length).toBe(3);
    expect(d.quests.days.day).toBe(xpDayStart(T0));
    await deleteAccount(sql, owner, T0 + 3);
    for (const t of ["quests", "quest_progress", "quest_days"]) expect(await sql.all(`SELECT * FROM ${t}`)).toEqual([]);
  });
});

describe("the API", () => {
  const call = async (d1: unknown, cookie: string, path: string, body?: unknown, env: Record<string, unknown> = {}) => {
    const res = (await handleAccountApi(
      new Request(`https://hunchess.com${path}`, body === undefined ? { headers: { cookie } } : { method: "POST", body: JSON.stringify(body), headers: { cookie } }),
      { DB: d1, ...env } as never,
    ))!;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("GET /api/quests, the reroll, the test switch (test servers only); a guest where sign-in is set up: \"Sign in for quests.\"", async () => {
    const { sql, d1 } = await world();
    const ann = await signedIn(sql, "ann@example.com");
    const cookie = `hc_session=${await createSession(sql, ann.id, Date.now())}`;
    const got = await call(d1, cookie, "/api/quests");
    expect([got.status, (got.body.quests as unknown[]).length, (got.body.quests as { canReroll: boolean }[]).map((q) => q.canReroll)]).toEqual([200, 3, [true, true, false]]);
    const daily = (got.body.quests as { id: string }[])[0]!.id;
    const r = await call(d1, cookie, "/api/quests/reroll", { quest: daily });
    expect([r.status, r.body.ok, ((r.body.quests as { quests: { canReroll: boolean }[] }).quests).map((q) => q.canReroll)]).toEqual([200, true, [false, true, false]]);
    expect((await call(d1, cookie, "/api/quests/reroll", { quest: daily })).status).toBe(409);
    const fresh = (r.body.quests as { quests: { id: string }[] }).quests[0]!.id;
    expect((await call(d1, cookie, "/api/quests/reroll", { quest: fresh })).status).toBe(409);
    expect((await call(d1, cookie, "/api/quests/test", { quests: [{ kind: "warm-up", progress: 2 }] })).status).toBe(403);
    const t = await call(d1, cookie, "/api/quests/test", { quests: [{ kind: "warm-up", progress: 2 }, { kind: "regular" }] }, { TEST_SWITCHES: "1" });
    expect((t.body.quests as { name: string; progress: number }[]).map((q) => [q.name, q.progress])).toEqual([
      ["Warm Up", 2],
      ["Regular", 0],
    ]);
    expect((await call(d1, cookie, "/api/quests", undefined, { PAUSE_REWARDS: "1" })).body.paused).toBe(true);
    const guest = await createGuest(sql, T0, "Guest");
    const g = await call(d1, `hc_session=${guest.token}`, "/api/quests", undefined, { RESEND_API_KEY: "x" });
    expect(g).toEqual({ status: 403, body: { message: "Sign in for quests." } });
  });
});
