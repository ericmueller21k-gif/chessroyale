import { describe, expect, it } from "vitest";
import { RANKED_1V1, duelCoins, placeLadder, rankView } from "@chessroyale/core";
import { DELETED_ID, createGuest, ensureSchema, profile, publicProfile, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { setCase } from "../src/fairplay.ts";
import { duelEntrant, duelGamesOf, purgeDuelGames, rankedRecordOf, recordDuel, type FinishedDuel } from "../src/ranked.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * Ranked 1 v 1's records in D1 (ranked.ts): a game recorded once (ranks, coins, the kept game), safely beside
 * another game of the same player, a player fair play holds keeping their rank, aborted games recording nothing, the
 * keeping time, and every account path (the profile, the download, deleting, a guest signing in).
 */

const T0 = 1_800_000_000_000;
const MIN = 60_000;

async function setup() {
  const { sql } = memoryDb();
  await ensureSchema(sql);
  const a = (await createGuest(sql, T0, "Ann")).user;
  const b = (await createGuest(sql, T0, "Bob")).user;
  return { sql, a, b };
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
    expect(await recordDuel(sql, g, notHeld)).toBeNull();
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

  it("a player fair play holds (in review) keeps their rank as it is; the opponent's game counts", async () => {
    const { sql, a, b } = await setup();
    await setCase(sql, a.id, "review", "reports", "test", T0);
    const out = await recordDuel(sql, game(a.id, b.id, "1-0"), async (uid) => uid === a.id);
    expect(out!.w.change).toBeNull();
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

  it("an account deleted during the game: nothing for it; the game kept under 'deleted'", async () => {
    const { sql, a, b } = await setup();
    await deleteAccount(sql, a, T0);
    await recordDuel(sql, game(a.id, b.id, "0-1"), notHeld);
    expect((await rankedRecordOf(sql, a.id)).stored).toBe(false);
    expect(await sql.first("SELECT coins FROM wallets WHERE user_id = ?", a.id)).toBeNull();
    expect((await duelGamesOf(sql, b.id))[0]!.white_id).toBe(DELETED_ID);
  });
});

describe("keeping, the profile and the account", () => {
  it("games go after RANKED_1V1.gamesKeepDays, unless a player in them is in review or banned", async () => {
    const { sql, a, b } = await setup();
    const c = (await createGuest(sql, T0, "Cy")).user;
    await recordDuel(sql, game(a.id, b.id, "1-0", { id: "old" }), notHeld);
    await recordDuel(sql, game(c.id, b.id, "1-0", { id: "kept" }), notHeld);
    await setCase(sql, c.id, "review", "reports", "test", T0);
    const later = T0 + 6 * MIN + RANKED_1V1.gamesKeepDays * 86_400_000 + 1;
    await purgeDuelGames(sql, later - 2);
    expect(await duelGamesOf(sql, b.id)).toHaveLength(2);
    await purgeDuelGames(sql, later);
    expect((await duelGamesOf(sql, b.id)).map((g) => g.id)).toEqual(["kept"]);
  });

  it("the profile (yours and anyone's) shows the rank and the record; a banned player's shows none", async () => {
    const { sql, a, b } = await setup();
    expect((await profile(sql, a)).ranked1v1).toEqual({ rank: rankView(null), games: 0, wins: 0, losses: 0, draws: 0 });
    await recordDuel(sql, game(a.id, b.id, "1/2-1/2"), notHeld);
    expect((await profile(sql, a)).ranked1v1).toMatchObject({ games: 1, draws: 1, rank: { label: "Placement 1/5" } });
    expect((await publicProfile(sql, b.id, T0))!.ranked1v1).toMatchObject({ games: 1, draws: 1 });
    await setCase(sql, b.id, "banned", "admin:x", "test", T0);
    expect((await publicProfile(sql, b.id, T0))!.ranked1v1).toBeNull();
  });

  it("the queue's read of a player: their account's name, their look, their rank and hidden rating", async () => {
    const { sql, a } = await setup();
    const e = await duelEntrant(sql, a);
    expect(e).toEqual({ player: { uid: a.id, name: "Ann", look: {}, rank: rankView(null) }, rating: 1500 });
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
