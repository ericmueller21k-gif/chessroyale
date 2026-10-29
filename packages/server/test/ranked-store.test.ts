import { beforeEach, describe, expect, it } from "vitest";
import { RANKED_1V1, duelCoins, itemDef, placeLadder, rankView } from "@chessroyale/core";
import { DELETED_ID, createGuest, ensureSchema, profile, publicProfile, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { equipLocker, lockerState, openCrate } from "../src/locker.ts";
import { appeal, setCase } from "../src/fairplay.ts";
import { coinCount, duelEntrant, duelGamesOf, purgeDuelGames, rankedRecordOf, recordDuel, type FinishedDuel } from "../src/ranked.ts";
import { TOP_PLACE_MS, forgetTopPlaces, rankOf, rankedSummary, topPlace } from "../src/ranked-schema.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Ranked 1 v 1's records in D1 (ranked.ts): a game recorded once (ranks, coins, the kept game), safely beside
 * another game of the same player, a player fair play holds keeping their rank, aborted games recording nothing, the
 * keeping time, and every account path (the profile, the download, deleting, a guest signing in).
 */

const T0 = 1_800_000_000_000;
const MIN = 60_000;

async function setup() {
  const { sql, db } = memoryDb();
  await ensureSchema(sql);
  const a = (await createGuest(sql, T0, "Ann")).user;
  const b = (await createGuest(sql, T0, "Bob")).user;
  return { sql, db, a, b };
}

let n = 0;
/** A finished game between two accounts (White first): 30 moves each, 6 minutes long. */
const game = (w: string, b: string, result: FinishedDuel["result"], patch: Partial<FinishedDuel> = {}): FinishedDuel => ({
  id: `G${++n}`,
  players: { w, b },
  control: "blitz",
  result,
  reason: result === "1/2-1/2" ? "agreement" : "resign",
  moves: Array.from({ length: 60 }, () => "e2e4"),
  times: Array.from({ length: 60 }, () => 1500),
  startedAt: T0,
  endedAt: T0 + 6 * MIN,
  ...patch,
});
const notHeld = async () => false;

beforeEach(() => forgetTopPlaces());

/** Players straight onto the ladder at these ladders (40 games each; ids "t0", "t1", …). */
async function ladders(sql: Sql, ls: readonly number[], from = 0): Promise<void> {
  for (const [i, l] of ls.entries())
    await sql.run(
      "INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at) VALUES (?, 2400, 60, 40, 20, 20, 0, ?, ?)",
      `t${from + i}`,
      l,
      T0,
    );
}

/** The SQL a database is asked, counted (the place's count). */
function counting(sql: Sql) {
  const asked: string[] = [];
  const spy: Sql = { ...sql, first: (q, ...p) => (asked.push(q), sql.first(q, ...p)) };
  return { spy, counts: () => asked.filter((q) => q.includes("COUNT(*)")).length };
}

describe("the top tiers: place among the top ladders (Oct 28, 2026)", () => {
  it("Transcendent in the top 100, Pearlescent in the top 500, only from 2800; outside them Radiant 1, its RP counting on", async () => {
    const { sql } = await setup();
    // 600 ladders from 3400 down, a point apart (3400 … 2801), and a few below the floor.
    await ladders(sql, Array.from({ length: 600 }, (_, i) => 3400 - i));
    await ladders(sql, [2799, 2500, 100], 600);
    const label = async (ladder: number) => (await rankOf(sql, { games: 40, ladder })).label;
    expect(await label(3400)).toBe("Transcendent · 600 RP");
    expect(await label(3301)).toBe("Transcendent · 501 RP"); // 100th
    expect(await label(3300)).toBe("Pearlescent · 500 RP"); // 101st
    expect(await label(2901)).toBe("Pearlescent · 101 RP"); // 500th
    expect(await label(2900)).toBe("Radiant 1 · 180 RP"); // 501st
    expect(await label(2815)).toBe("Radiant 1 · 95 RP");
    // Below the floor nobody is counted: the divisions as ever.
    expect(await label(2799)).toBe("Radiant 1 · 79 RP");
    expect(await label(2500)).toBe("Radiant 4 · 20 RP");
    expect(await topPlace(sql, 2799)).toBeNull();
  });

  it("the floor: with few players everyone at 2800 or more is in the top 100, and nobody below it", async () => {
    const { sql } = await setup();
    await ladders(sql, [2800, 2799, 1500]);
    expect((await rankOf(sql, { games: 40, ladder: 2800 })).label).toBe("Transcendent · 0 RP");
    expect((await rankOf(sql, { games: 40, ladder: 2799 })).label).toBe("Radiant 1 · 79 RP");
  });

  it("ties share the better place: equal ladders are the same tier", async () => {
    const { sql } = await setup();
    // 99 above, then three at 3000: all three are 100th (Transcendent), the next below is 103rd.
    await ladders(sql, [...Array.from({ length: 99 }, (_, i) => 3200 - i), 3000, 3000, 3000, 2950]);
    expect(await topPlace(sql, 3000)).toBe(100);
    expect((await rankOf(sql, { games: 40, ladder: 3000 })).tier).toBe("Transcendent");
    expect(await topPlace(sql, 2950)).toBe(103);
    expect((await rankOf(sql, { games: 40, ladder: 2950 })).tier).toBe("Pearlescent");
  });

  it("the count is one query on the ladder's index, kept a minute per ladder, never asked below the floor", async () => {
    const { sql, db } = await setup();
    await ladders(sql, [3000, 2900, 2850]);
    const { spy, counts } = counting(sql);
    expect(await topPlace(spy, 2900, T0)).toBe(2);
    expect(counts()).toBe(1);
    // Kept: the same ladder within the minute asks nothing; another player at that ladder neither.
    await ladders(sql, [2950], 10);
    expect(await topPlace(spy, 2900, T0 + TOP_PLACE_MS - 1)).toBe(2);
    expect(counts()).toBe(1);
    // A minute on, counted again (the new ladder above it now counts).
    expect(await topPlace(spy, 2900, T0 + TOP_PLACE_MS)).toBe(3);
    expect(counts()).toBe(2);
    // Another ladder is its own count.
    expect(await topPlace(spy, 2850, T0 + TOP_PLACE_MS)).toBe(4);
    expect(counts()).toBe(3);
    // Below the floor, and in placements: no query.
    await rankOf(spy, { games: 40, ladder: 2799 });
    await rankOf(spy, { games: 2, ladder: null });
    await rankOf(spy, null);
    expect(counts()).toBe(3);
    // The plan: the ladder index, covering (its entries above the ladder), never a scan of the table.
    const plan = db.prepare("EXPLAIN QUERY PLAN SELECT COUNT(*) AS n FROM ranked_1v1 WHERE ladder > ?").all(2900) as { detail: string }[];
    expect(plan.map((r) => r.detail).join(" | ")).toMatch(/SEARCH ranked_1v1 USING COVERING INDEX ranked_1v1_ladder \(ladder>\?\)/);
  });

  it("the profile, the queue and a game's result show the top tier", async () => {
    const { sql, a, b } = await setup();
    await ladders(sql, [3500, 3400]);
    await sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at) VALUES (?, 2450, 60, 40, 20, 20, 0, 2805, ?)", a.id, T0);
    await sql.run("INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at) VALUES (?, 2450, 60, 40, 20, 20, 0, 2790, ?)", b.id, T0);
    expect((await rankedSummary(sql, a.id)).rank.label).toBe("Transcendent · 5 RP");
    expect((await duelEntrant(sql, a)).player.rank.label).toBe("Transcendent · 5 RP");
    expect((await duelEntrant(sql, b)).player.rank.label).toBe("Radiant 1 · 70 RP");
    // Bob beats Ann: he crosses the floor (a place counted with the game in), she may drop under it.
    const out = await recordDuel(sql, game(b.id, a.id, "1-0"), notHeld);
    const bob = out!.w.change!;
    expect(bob.before.label).toBe("Radiant 1 · 70 RP");
    const bobNow = (await rankedRecordOf(sql, b.id)).record.ladder!;
    expect(bobNow).toBeGreaterThanOrEqual(2800);
    expect(bob.after.label).toBe(`Transcendent · ${bobNow - 2800} RP`);
    expect(bob.after.emblem).toBe("transcendent");
    const ann = out!.b.change!;
    expect(ann.before.label).toBe("Transcendent · 5 RP");
    const annNow = (await rankedRecordOf(sql, a.id)).record.ladder!;
    expect(ann.after.label).toBe((await rankOf(sql, { games: 41, ladder: annNow })).label);
  });
});

describe("recording a ranked game", () => {
  it("both players' records, coins by the minute, and the game kept", async () => {
    const { sql, a, b } = await setup();
    const out = await recordDuel(sql, game(a.id, b.id, "1-0"), notHeld);
    expect(out!.w.change!.after.label).toBe("Placement 1/5");
    expect(out!.b.change!.after.label).toBe("Placement 1/5");
    expect(out!.w.coins).toBe(duelCoins("win", 6 * MIN, 30));
    expect(out!.b.coins).toBe(duelCoins("loss", 6 * MIN, 30));
    expect((await rankedRecordOf(sql, a.id)).record).toMatchObject({ games: 1, wins: 1, losses: 0, ladder: null });
    expect((await rankedRecordOf(sql, b.id)).record).toMatchObject({ games: 1, wins: 0, losses: 1 });
    expect((await rankedRecordOf(sql, a.id)).record.rating).toBeGreaterThan(1500);
    expect((await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", a.id))!.coins).toBe(14);
    expect((await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", b.id))!.coins).toBe(5);
    const [kept] = await duelGamesOf(sql, a.id);
    expect(kept).toMatchObject({ white_id: a.id, black_id: b.id, control: "blitz", result: "1-0", reason: "resign", started_at: T0, ended_at: T0 + 6 * MIN });
    expect(kept!.moves.split(" ")).toHaveLength(60);
    expect(kept!.times.split(",")[0]).toBe("1500");
  });

  it("five placements, then a rank from the hidden rating; then rank points", async () => {
    const { sql, a, b } = await setup();
    for (let i = 0; i < 5; i++) await recordDuel(sql, game(a.id, b.id, "1-0", { endedAt: T0 + i * MIN + 6 * MIN }), notHeld);
    const { record } = await rankedRecordOf(sql, a.id);
    expect(record.games).toBe(5);
    expect(record.ladder).toBe(placeLadder(record.rating));
    expect(rankView(record).placement).toBeNull();
    const sixth = await recordDuel(sql, game(a.id, b.id, "0-1"), notHeld);
    expect(sixth!.w.change!.points).toBeLessThan(0);
    expect((await rankedRecordOf(sql, a.id)).record.ladder).toBe(record.ladder! + sixth!.w.change!.points!);
  });

  it("a new player's hidden rating starts at their account's rating from other modes", async () => {
    const { sql, a, b } = await setup();
    await sql.run("UPDATE users SET rating = 1900 WHERE id = ?", a.id);
    expect((await rankedRecordOf(sql, a.id)).record.rating).toBe(1900);
    expect((await rankedRecordOf(sql, b.id)).record.rating).toBe(RANKED_1V1.rating.start);
  });

  it("recorded once: the same game again changes nothing", async () => {
    const { sql, a, b } = await setup();
    const g = game(a.id, b.id, "1-0");
    await recordDuel(sql, g, notHeld);
    // (Each player hears their rank as it stands: the first answer was lost, say.)
    const again = await recordDuel(sql, g, notHeld);
    expect(again!.w).toEqual({ change: { before: rankView({ games: 1, ladder: null }), after: rankView({ games: 1, ladder: null }), points: null, placed: false }, coins: 0 });
    expect((await rankedRecordOf(sql, a.id)).record.games).toBe(1);
    expect((await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", a.id))!.coins).toBe(14);
  });

  it("another game of the same player recorded in between: read again and retried, both counted", async () => {
    const { sql, a, b } = await setup();
    const c = (await createGuest(sql, T0, "Cy")).user;
    // A game of Ann's against Cy lands between this recording's read and its write.
    let raced = false;
    const racing: Sql = {
      ...sql,
      async batch(statements) {
        if (!raced && statements.some((s) => s.sql.includes("INSERT OR IGNORE INTO ranked_1v1_games") && s.params[0] === "first")) {
          raced = true;
          await recordDuel(sql, game(a.id, c.id, "1-0"), notHeld);
        }
        return sql.batch(statements);
      },
    };
    const out = await recordDuel(racing, game(a.id, b.id, "1-0", { id: "first" }), notHeld);
    expect(raced).toBe(true);
    expect(out!.w.change!.after.label).toBe("Placement 2/5");
    expect((await rankedRecordOf(sql, a.id)).record).toMatchObject({ games: 2, wins: 2 });
    expect((await duelGamesOf(sql, a.id)).map((g) => g.id).sort()).toEqual(["first", expect.stringMatching(/^G/)].sort());
  });

  it("an aborted game records nothing", async () => {
    const { sql, a, b } = await setup();
    expect(await recordDuel(sql, game(a.id, b.id, "aborted"), notHeld)).toBeNull();
    expect(await duelGamesOf(sql, a.id)).toEqual([]);
    expect((await rankedRecordOf(sql, a.id)).stored).toBe(false);
  });

  it("a player fair play holds (in review) keeps their rank as it is and earns nothing; the opponent's game counts", async () => {
    const { sql, a, b } = await setup();
    await setCase(sql, a.id, "review", "reports", "test", T0);
    const out = await recordDuel(sql, game(a.id, b.id, "1-0"), async (uid) => uid === a.id);
    expect(out!.w.change).toBeNull();
    expect(out!.w.coins).toBe(0);
    expect(await sql.first("SELECT coins FROM wallets WHERE user_id = ?", a.id)).toBeNull();
    expect(out!.b.coins).toBe(duelCoins("loss", 6 * MIN, 30));
    expect(out!.b.change!.after.label).toBe("Placement 1/5");
    expect((await rankedRecordOf(sql, a.id)).stored).toBe(false);
    expect((await rankedRecordOf(sql, b.id)).record.games).toBe(1);
  });

  it("no coins under ten moves each; a short game at least one", async () => {
    const { sql, a, b } = await setup();
    const short = await recordDuel(sql, game(a.id, b.id, "1-0", { moves: Array.from({ length: 19 }, () => "e2e4") }), notHeld);
    expect(short!.w.coins).toBe(0);
    const quick = await recordDuel(sql, game(a.id, b.id, "0-1", { endedAt: T0 + 10_000 }), notHeld);
    expect(quick!.b.coins).toBe(1);
  });

  it(`at most RANKED_1V1.coins.perDay paying games a UTC day per account, counted on the rank's row; the next day pays again`, async () => {
    const { sql, a, b } = await setup();
    const perDay = RANKED_1V1.coins.perDay;
    const day0 = Math.floor(T0 / 86_400_000) * 86_400_000;
    const at = (i: number, day = 0) => ({ startedAt: day0 + day * 86_400_000 + i * 7 * MIN, endedAt: day0 + day * 86_400_000 + i * 7 * MIN + 6 * MIN });
    // A short game (under 10 moves each) pays nothing and doesn't count.
    expect((await recordDuel(sql, game(a.id, b.id, "1-0", { ...at(0), moves: Array.from({ length: 10 }, () => "e2e4") }), notHeld))!.w.coins).toBe(0);
    for (let i = 1; i <= perDay; i++) expect((await recordDuel(sql, game(a.id, b.id, i % 2 ? "1-0" : "0-1", at(i)), notHeld))!.w.coins).toBeGreaterThan(0);
    expect(await sql.first("SELECT coin_games FROM ranked_1v1 WHERE user_id = ?", a.id)).toEqual({ coin_games: perDay });
    const over = await recordDuel(sql, game(a.id, b.id, "1-0", at(perDay + 1)), notHeld);
    expect(over!.w.coins).toBe(0);
    expect(over!.b.coins).toBe(0);
    // Its rank still moves.
    expect((await rankedRecordOf(sql, a.id)).record.games).toBe(perDay + 2);
    const wallet = (await sql.first<{ coins: number }>("SELECT coins FROM wallets WHERE user_id = ?", a.id))!.coins;
    expect(wallet).toBeLessThanOrEqual(perDay * RANKED_1V1.coins.maxPerGame);
    // The next UTC day: paid again, the count from 1.
    expect((await recordDuel(sql, game(a.id, b.id, "1-0", at(0, 1)), notHeld))!.w.coins).toBeGreaterThan(0);
    expect(await sql.first("SELECT coin_games FROM ranked_1v1 WHERE user_id = ?", a.id)).toEqual({ coin_games: 1 });
  });

  it("the day's count across midnight: a game of the day before, recorded after one of the new day, leaves the new day's count alone", async () => {
    const { sql, a, b } = await setup();
    const midnight = Math.ceil(T0 / 86_400_000) * 86_400_000;
    const ending = (end: number) => ({ startedAt: end - 6 * MIN, endedAt: end });
    // Two of Ann's games recorded at once: both counted.
    const c = (await createGuest(sql, T0, "Cy")).user;
    await Promise.all([recordDuel(sql, game(a.id, b.id, "1-0", ending(midnight - 30 * MIN)), notHeld), recordDuel(sql, game(a.id, c.id, "1-0", ending(midnight - 20 * MIN)), notHeld)]);
    expect(await sql.first("SELECT coin_day, coin_games FROM ranked_1v1 WHERE user_id = ?", a.id)).toEqual({ coin_day: midnight / 86_400_000 - 1, coin_games: 2 });
    // The new day's first game, then a late recording of a game from before midnight (a retry): it pays, and the new
    // day's count stays.
    await recordDuel(sql, game(a.id, b.id, "1-0", ending(midnight + 10 * MIN)), notHeld);
    const late = await recordDuel(sql, game(a.id, c.id, "1-0", ending(midnight - 5 * MIN)), notHeld);
    expect(late!.w.coins).toBeGreaterThan(0);
    expect(await sql.first("SELECT coin_day, coin_games FROM ranked_1v1 WHERE user_id = ?", a.id)).toEqual({ coin_day: midnight / 86_400_000, coin_games: 1 });
    expect(coinCount({ day: 5, games: 3 }, 4, () => true)).toEqual({ pays: true, store: { day: 5, games: 3 } });
    expect(coinCount({ day: 4, games: RANKED_1V1.coins.perDay }, 4, () => true)).toEqual({ pays: false, store: { day: 4, games: RANKED_1V1.coins.perDay } });
    expect(coinCount({ day: 3, games: 7 }, 4, () => false)).toEqual({ pays: false, store: { day: null, games: 0 } });
  });

  it("an account deleted during the game: nothing for it; the game kept under 'deleted'", async () => {
    const { sql, a, b } = await setup();
    await deleteAccount(sql, a, T0);
    await recordDuel(sql, game(a.id, b.id, "0-1"), notHeld);
    expect((await rankedRecordOf(sql, a.id)).stored).toBe(false);
    expect(await sql.first("SELECT coins FROM wallets WHERE user_id = ?", a.id)).toBeNull();
    expect((await duelGamesOf(sql, b.id))[0]!.white_id).toBe(DELETED_ID);
  });
});

/** A settled player straight onto the ladder (40 games, a hidden rating at that ladder's). */
async function settledAt(sql: Sql, id: string, ladder: number, extra = "") {
  await sql.run(`INSERT INTO ranked_1v1 (user_id, rating, rd, games, wins, losses, draws, ladder, last_at${extra ? ", peak" : ""}) VALUES (?, ?, 60, 40, 20, 20, 0, ?, ?${extra ? ", ?" : ""})`, id, 800 + (ladder * 1600) / 2800, ladder, T0, ...(extra ? [Number(extra)] : []));
}

describe("the public profile's numbers (Oct 28, 2026): peak, streak, each game's points, the recent games", () => {
  it("the peak: the highest ladder reached, only ever up; null until placed", async () => {
    const { sql, a, b } = await setup();
    await settledAt(sql, a.id, 1270);
    await settledAt(sql, b.id, 1270);
    expect((await rankedSummary(sql, a.id)).peak!.label).toBe("Paragon 5 · 70 RP");
    await recordDuel(sql, game(a.id, b.id, "1-0"), notHeld);
    const up = (await rankedRecordOf(sql, a.id)).record.ladder!;
    expect(up).toBeGreaterThan(1270);
    expect((await sql.first<{ peak: number }>("SELECT peak FROM ranked_1v1 WHERE user_id = ?", a.id))!.peak).toBe(up);
    expect((await rankedSummary(sql, a.id)).peak!.label).toBe(rankView({ games: 41, ladder: up }).label);
    // A loss: the ladder down, the peak where it was; Bo's peak (he lost first) stays at his start.
    await recordDuel(sql, game(a.id, b.id, "0-1"), notHeld);
    expect((await rankedRecordOf(sql, a.id)).record.ladder!).toBeLessThan(up);
    expect((await sql.first<{ peak: number }>("SELECT peak FROM ranked_1v1 WHERE user_id = ?", a.id))!.peak).toBe(up);
    expect((await sql.first<{ peak: number }>("SELECT peak FROM ranked_1v1 WHERE user_id = ?", b.id))!.peak).toBe(Math.max(1270, (await rankedRecordOf(sql, b.id)).record.ladder!));
    // In placements: none (the fifth game places the peak at the ladder).
    const c = (await createGuest(sql, T0, "Cy")).user;
    await recordDuel(sql, game(c.id, b.id, "1-0"), notHeld);
    expect((await rankedSummary(sql, c.id)).peak).toBeNull();
    for (let i = 0; i < 4; i++) await recordDuel(sql, game(c.id, b.id, "1-0"), notHeld);
    const placed = (await rankedRecordOf(sql, c.id)).record.ladder!;
    expect((await rankedSummary(sql, c.id)).peak!.ladder).toBe(placed);
  });

  it("the streak: one more for each win, back to 0 on a loss or a draw (placements count; a held game changes nothing)", async () => {
    const { sql, a, b } = await setup();
    const streak = async () => (await rankedSummary(sql, a.id)).streak;
    for (const [r, want] of [["1-0", 1], ["1-0", 2], ["1-0", 3], ["1/2-1/2", 0], ["1-0", 1], ["0-1", 0], ["1-0", 1]] as const) {
      await recordDuel(sql, game(a.id, b.id, r), notHeld);
      expect(await streak(), r).toBe(want);
    }
    await recordDuel(sql, game(a.id, b.id, "1-0"), async (uid) => uid === a.id);
    expect(await streak()).toBe(1);
    expect((await rankedSummary(sql, b.id)).streak).toBe(0);
  });

  it("each game keeps the points it moved for each side: null in placements and for a held side", async () => {
    const { sql, a, b } = await setup();
    await recordDuel(sql, game(a.id, b.id, "1-0", { id: "placing" }), notHeld);
    expect(await sql.first("SELECT white_points, black_points FROM ranked_1v1_games WHERE id = 'placing'")).toEqual({ white_points: null, black_points: null });
    await sql.run("DELETE FROM ranked_1v1");
    await settledAt(sql, a.id, 1500);
    await settledAt(sql, b.id, 1500);
    const out = await recordDuel(sql, game(a.id, b.id, "0-1", { id: "ranked" }), notHeld);
    const row = await sql.first<{ white_points: number; black_points: number }>("SELECT white_points, black_points FROM ranked_1v1_games WHERE id = 'ranked'");
    expect(row).toEqual({ white_points: out!.w.change!.points, black_points: out!.b.change!.points });
    expect(row!.white_points).toBeLessThan(0);
    expect(row!.black_points).toBeGreaterThan(0);
    await recordDuel(sql, game(a.id, b.id, "1-0", { id: "held" }), async (uid) => uid === b.id);
    const held = await sql.first<{ white_points: number | null; black_points: number | null }>("SELECT white_points, black_points FROM ranked_1v1_games WHERE id = 'held'");
    expect(held!.white_points).toBeGreaterThan(0);
    expect(held!.black_points).toBeNull();
  });

  it("the recent games: the last 5, newest first, from this player's side (the opponent by id, name and look; never the hidden rating)", async () => {
    const { sql, a, b } = await setup();
    const c = (await createGuest(sql, T0, "Cy")).user;
    await settledAt(sql, a.id, 1500);
    await settledAt(sql, b.id, 1500);
    await settledAt(sql, c.id, 1500);
    // Bob wears a crate item (its look as his locker has it); Cy nothing.
    const opened = await openCrate(sql, b.id, "winter-1", {}, T0);
    if (!opened.ok) throw new Error(opened.message);
    const slot = itemDef(opened.item.def)!.slot;
    expect((await equipLocker(sql, b.id, slot, opened.item.id)).ok).toBe(true);
    const plays: [string, string, FinishedDuel["result"]][] = [
      [a.id, b.id, "1-0"],
      [c.id, a.id, "1-0"],
      [a.id, c.id, "1/2-1/2"],
      [b.id, a.id, "0-1"],
      [a.id, b.id, "0-1"],
      [a.id, c.id, "1-0"],
    ];
    const outs: Awaited<ReturnType<typeof recordDuel>>[] = [];
    for (const [i, [w, k, r]] of plays.entries()) outs.push(await recordDuel(sql, game(w, k, r, { id: `r${i}`, endedAt: T0 + (i + 1) * MIN }), notHeld));
    const s = await rankedSummary(sql, a.id);
    expect(s.recent).toHaveLength(5);
    expect(s.recent.map((g) => g.at)).toEqual([6, 5, 4, 3, 2].map((i) => T0 + i * MIN));
    expect(s.recent.map((g) => [g.opponent.name, g.result])).toEqual([["Cy", "win"], ["Bob", "loss"], ["Bob", "win"], ["Cy", "draw"], ["Cy", "loss"]]);
    expect(s.recent[0]!.opponent.id).toBe(c.id);
    expect(s.recent[0]!.opponent.look).toEqual({});
    // Ann's own points in each (white or black): the game's outcome for her.
    const mine = (i: number) => (plays[i]![0] === a.id ? outs[i]!.w : outs[i]!.b).change!.points;
    expect(s.recent.map((g) => g.points)).toEqual([5, 4, 3, 2, 1].map(mine));
    expect(s.recent[1]!.opponent.look).toEqual((await lockerState(sql, b.id)).look);
    expect(Object.keys(s.recent[1]!.opponent.look ?? {})).toEqual([slot]);
    expect(JSON.stringify(s)).not.toMatch(/"rating"|"rd"/);
    // A deleted opponent: the shared "deleted" account, by that name, with no look.
    await deleteAccount(sql, c, T0 + 10 * MIN);
    const after = await rankedSummary(sql, a.id);
    expect(after.recent[0]!.opponent).toEqual({ id: "deleted", name: "Deleted account", look: null });
  });

  it("the shape the public profile builds on: RankedSummary's fields, exactly", async () => {
    const { sql, a, b } = await setup();
    await settledAt(sql, a.id, 1500);
    await settledAt(sql, b.id, 1500);
    await recordDuel(sql, game(a.id, b.id, "1-0"), notHeld);
    const s = await rankedSummary(sql, a.id);
    expect(Object.keys(s).sort()).toEqual(["draws", "games", "losses", "peak", "rank", "recent", "streak", "wins"]);
    expect(Object.keys(s.recent[0]!).sort()).toEqual(["at", "opponent", "points", "result"]);
    expect(Object.keys(s.recent[0]!.opponent).sort()).toEqual(["id", "look", "name"]);
  });
});

describe("the tables", () => {
  it("tables made before Oct 28 get the peak (at each ladder then), the streak (0) and each game's points (null)", async () => {
    const { sql } = memoryDb();
    await sql.run(
      "CREATE TABLE ranked_1v1 (user_id TEXT PRIMARY KEY, rating REAL NOT NULL, rd REAL NOT NULL, games INTEGER NOT NULL, wins INTEGER NOT NULL, losses INTEGER NOT NULL, draws INTEGER NOT NULL, ladder INTEGER, last_game TEXT, last_at INTEGER, coin_day INTEGER, coin_games INTEGER NOT NULL DEFAULT 0)",
    );
    await sql.run("INSERT INTO ranked_1v1 VALUES ('placed', 1700, 80, 30, 18, 12, 0, 1650, 'g', 0, NULL, 0)");
    await sql.run("INSERT INTO ranked_1v1 VALUES ('placing', 1500, 300, 2, 1, 1, 0, NULL, 'g', 0, NULL, 0)");
    await sql.run(
      "CREATE TABLE ranked_1v1_games (id TEXT PRIMARY KEY, white_id TEXT NOT NULL, black_id TEXT NOT NULL, control TEXT NOT NULL, result TEXT NOT NULL, reason TEXT NOT NULL, moves TEXT NOT NULL, times TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL, checked TEXT, nonce TEXT NOT NULL)",
    );
    await sql.run("INSERT INTO ranked_1v1_games VALUES ('old', 'placed', 'placing', 'blitz', '1-0', 'resign', '', '', 0, 1, NULL, 'n')");
    await ensureSchema(sql);
    expect(await sql.all("SELECT user_id, ladder, peak, streak FROM ranked_1v1 ORDER BY user_id")).toEqual([
      { user_id: "placed", ladder: 1650, peak: 1650, streak: 0 },
      { user_id: "placing", ladder: null, peak: null, streak: 0 },
    ]);
    expect(await sql.first("SELECT white_points, black_points FROM ranked_1v1_games WHERE id = 'old'")).toEqual({ white_points: null, black_points: null });
    // Nothing that was there changed meaning: the rank as before.
    expect((await rankedSummary(sql, "placed")).rank.label).toBe(rankView({ games: 30, ladder: 1650 }).label);
    expect((await rankedSummary(sql, "placed")).recent[0]).toMatchObject({ result: "win", points: null });
  });

  it("a ranked_1v1 table made before the daily cap (a test server's) gets its columns", async () => {
    const { sql } = memoryDb();
    await sql.run("CREATE TABLE ranked_1v1 (user_id TEXT PRIMARY KEY, rating REAL NOT NULL, rd REAL NOT NULL, games INTEGER NOT NULL, wins INTEGER NOT NULL, losses INTEGER NOT NULL, draws INTEGER NOT NULL, ladder INTEGER, last_game TEXT, last_at INTEGER)");
    await sql.run("INSERT INTO ranked_1v1 VALUES ('u', 1500, 350, 1, 1, 0, 0, NULL, 'g', 0)");
    await ensureSchema(sql);
    expect(await sql.first("SELECT coin_day, coin_games FROM ranked_1v1 WHERE user_id = 'u'")).toEqual({ coin_day: null, coin_games: 0 });
  });
});

describe("keeping, the profile and the account", () => {
  it("games go after RANKED_1V1.gamesKeepDays, unless a player in them has a case open or an appeal of a ban waiting", async () => {
    const { sql, a, b } = await setup();
    const c = (await createGuest(sql, T0, "Cy")).user;
    const d = (await createGuest(sql, T0, "Di")).user;
    const e = (await createGuest(sql, T0, "Ed")).user;
    const f = (await createGuest(sql, T0, "Fay")).user;
    await recordDuel(sql, game(a.id, b.id, "1-0", { id: "old" }), notHeld);
    await recordDuel(sql, game(c.id, b.id, "1-0", { id: "review" }), notHeld);
    await recordDuel(sql, game(d.id, b.id, "1-0", { id: "watch" }), notHeld);
    await recordDuel(sql, game(e.id, b.id, "1-0", { id: "banned" }), notHeld);
    await recordDuel(sql, game(f.id, b.id, "1-0", { id: "appeal" }), notHeld);
    await setCase(sql, c.id, "review", "reports", "test", T0);
    await setCase(sql, d.id, "watch", "reports", "test", T0);
    await setCase(sql, e.id, "banned", "admin:x", "test", T0);
    await setCase(sql, f.id, "banned", "admin:x", "test", T0);
    expect(await appeal(sql, f.id, "I didn't use an engine, honestly.", T0)).toEqual({ ok: true });
    const later = T0 + 6 * MIN + RANKED_1V1.gamesKeepDays * 86_400_000 + 1;
    await purgeDuelGames(sql, later - 2);
    expect(await duelGamesOf(sql, b.id)).toHaveLength(5);
    await purgeDuelGames(sql, later);
    // A banned player with no appeal waiting: their games go like anyone's.
    expect((await duelGamesOf(sql, b.id)).map((g) => g.id).sort()).toEqual(["appeal", "review", "watch"]);
  });

  it("the profile (yours and anyone's) shows the rank and the record; a banned player's shows none", async () => {
    const { sql, a, b } = await setup();
    expect((await profile(sql, a)).ranked1v1).toEqual({ rank: rankView(null), games: 0, wins: 0, losses: 0, draws: 0, peak: null, streak: 0, recent: [] });
    await recordDuel(sql, game(a.id, b.id, "1/2-1/2"), notHeld);
    expect((await profile(sql, a)).ranked1v1).toMatchObject({ games: 1, draws: 1, rank: { label: "Placement 1/5" } });
    expect((await publicProfile(sql, b.id, T0))!.ranked1v1).toMatchObject({ games: 1, draws: 1 });
    await setCase(sql, b.id, "banned", "admin:x", "test", T0);
    expect((await publicProfile(sql, b.id, T0))!.ranked1v1).toBeNull();
  });

  it("the queue's read of a player: their account's name, their look, their rank and hidden rating (with its deviation)", async () => {
    const { sql, a } = await setup();
    const e = await duelEntrant(sql, a);
    expect(e).toEqual({ player: { uid: a.id, name: "Ann", look: {}, rank: rankView(null) }, rating: 1500, rd: RANKED_1V1.rating.startRd });
  });

  it("the download has the rank and the games (the opponent by name, not fair play's check); deleting leaves the opponent's games", async () => {
    const { sql, a, b } = await setup();
    await recordDuel(sql, game(a.id, b.id, "1-0"), notHeld);
    await sql.run("UPDATE ranked_1v1_games SET checked = '{}'");
    const data = (await accountDownload(sql, a, T0)) as { ranked1v1: { rank: { games: number }; games: Record<string, unknown>[] } };
    expect(data.ranked1v1.rank.games).toBe(1);
    expect(data.ranked1v1.games[0]).toMatchObject({ color: "white", opponent: "Bob", result: "1-0", control: "blitz" });
    expect(Object.keys(data.ranked1v1.games[0]!)).not.toContain("checked");
    await deleteAccount(sql, a, T0);
    expect((await rankedRecordOf(sql, a.id)).stored).toBe(false);
    expect((await duelGamesOf(sql, b.id))[0]).toMatchObject({ white_id: DELETED_ID, black_id: b.id });
    expect(await duelGamesOf(sql, a.id)).toEqual([]);
  });

  it("a guest signing in: its rank moves to an account without one, and its games with it", async () => {
    const { sql, a, b } = await setup();
    await recordDuel(sql, game(a.id, b.id, "1-0"), notHeld);
    const owner = await signInWithIdentity(sql, null, "email", "owner@example.com", {}, T0);
    await signInWithIdentity(sql, a, "email", "owner@example.com", {}, T0);
    expect((await rankedRecordOf(sql, owner.id)).record).toMatchObject({ games: 1, wins: 1 });
    expect((await rankedRecordOf(sql, a.id)).stored).toBe(false);
    expect((await duelGamesOf(sql, owner.id))[0]!.white_id).toBe(owner.id);
    // An account with a rank of its own keeps it.
    const guest = (await createGuest(sql, T0, "Dee")).user;
    await recordDuel(sql, game(guest.id, b.id, "0-1"), notHeld);
    await signInWithIdentity(sql, guest, "email", "owner@example.com", {}, T0);
    expect((await rankedRecordOf(sql, owner.id)).record).toMatchObject({ games: 1, wins: 1 });
    expect(await sql.first("SELECT user_id FROM ranked_1v1 WHERE user_id = ?", guest.id)).toBeNull();
  });
});
