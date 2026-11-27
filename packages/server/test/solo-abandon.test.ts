import { afterEach, describe, expect, it, vi } from "vitest";
import { SOLO_ABANDON } from "@chessroyale/core";
import { createGuest, createSession, getUser, signInWithIdentity, type Sql } from "../src/accounts.ts";
import { accountDownload, deleteAccount } from "../src/account-data.ts";
import { handleAccountApi } from "../src/api.ts";
import { finishedGames } from "../src/welcome.ts";
import { abandonSoloGame, abandonStatements, endSoloGame, startSoloGame } from "../src/xp.ts";
import { memoryDb } from "./memory-db.ts";

/**
 * A solo game left after SOLO_ABANDON.minMoves of your own moves counts as a loss (Eric, Nov 22; server/xp.ts; settings.ts
 * SOLO_ABANDON): the app marks the game real once (POST /api/xp/solo/real); a real game whose result never comes is recorded as a
 * loss at the next start, the app's load (GET /api/me?settle=1) or, on any profile read, once it began staleHours ago. Once per game,
 * whoever comes first; nothing under minMoves; never a Battle Tower floor (the app never marks one) or an admin's test game.
 */
const T0 = Date.UTC(2026, 10, 22, 12, 0);
const MIN = 60_000;

afterEach(() => void vi.useRealTimers());
const at = (t: number) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(t);
};

async function world(env: Record<string, string> = {}) {
  const { sql, d1 } = memoryDb();
  at(T0);
  const call = async (path: string, cookie: string, body?: unknown) => {
    const req = new Request(`https://hunchess.com${path}`, body === undefined ? { headers: { cookie } } : { method: "POST", body: JSON.stringify(body), headers: { cookie } });
    const res = (await handleAccountApi(req, { DB: d1, ...env } as never, fetch, () => {}))!;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  // (The first call makes the schema and a guest; signed in with an email, as most players are.)
  const guest = await call("/api/me?name=Player", "");
  void guest;
  const player = async (email: string | null) => {
    const g = await createGuest(sql, Date.now(), "Player");
    const u = email ? await signInWithIdentity(sql, g.user, "email", email, {}, Date.now()) : g.user;
    return { id: u.id, cookie: `hc_session=${await createSession(sql, u.id, Date.now())}` };
  };
  const start = async (p: { cookie: string }, body: object = {}) => (await call("/api/xp/solo/start", p.cookie, body)).body.game as string;
  const real = (p: { cookie: string }, game: string, body: object = {}) => call("/api/xp/solo/real", p.cookie, { game, mode: "boss", players: 1, team: null, bossId: "gingerbread", bossElo: 1600, ...body });
  const result = (p: { cookie: string }, game: string | undefined, body: object = {}) =>
    call("/api/results", p.cookie, { mode: "boss", placement: 1, players: 1, teamWon: true, moves: 25, won: true, game, ...body });
  const rows = (id: string) =>
    sql.all<Record<string, unknown>>("SELECT mode, online, placement, players, team, team_won, boss_id, boss_elo, abandoned, played_at, play_ms, moves, xp_none, solo_game FROM results WHERE user_id = ? ORDER BY id", id);
  return { sql, call, player, start, real, result, rows };
}

const losses = (sql: Sql, id: string) => sql.all<{ solo_game: string }>("SELECT solo_game FROM results WHERE user_id = ? AND abandoned = 1", id);

describe("a solo game left after SOLO_ABANDON.minMoves", () => {
  it("under minMoves (never marked): leaving, starting another, reloading and a day later record nothing", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    await w.start(ann);
    await w.start(ann);
    expect((await w.call("/api/me?settle=1", ann.cookie)).status).toBe(200);
    at(T0 + (SOLO_ABANDON.staleHours + 1) * 60 * MIN);
    await w.call("/api/me", ann.cookie);
    expect(await w.rows(ann.id)).toEqual([]);
  });

  it("the mark: once, only the account's open game, checked as a result is (bad values dropped); no players: refused", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const bob = await w.player("bob@example.com");
    const g = await w.start(ann);
    expect((await w.real(bob, g)).body).toEqual({ ok: false });
    expect((await w.real(ann, "0123456789abcdef01")).body).toEqual({ ok: false });
    expect((await w.call("/api/xp/solo/real", ann.cookie, { game: g, mode: "boss" })).status).toBe(400);
    at(T0 + 3 * MIN);
    expect((await w.real(ann, g, { mode: "nonsense", players: 64.4, team: "x", bossId: "nobody", bossElo: 1500 })).body).toEqual({ ok: true });
    at(T0 + 4 * MIN);
    expect((await w.real(ann, g)).body).toEqual({ ok: false });
    expect(await w.sql.first("SELECT real_at, mode, players, team, boss_id, boss_elo FROM solo_games WHERE user_id = ?", ann.id)).toEqual({
      real_at: T0 + 3 * MIN,
      mode: "classic",
      players: 64,
      team: null,
      boss_id: null,
      boss_elo: null,
    });
  });

  it("recorded as a loss at the next start: last place, abandoned, when it became real, no XP, crate, quest or boss token", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const g = await w.start(ann);
    at(T0 + 4 * MIN);
    await w.real(ann, g);
    at(T0 + 9 * MIN);
    const next = await w.start(ann);
    expect(next).not.toBe(g);
    expect(await w.rows(ann.id)).toEqual([
      { mode: "boss", online: 0, placement: 1, players: 1, team: null, team_won: 0, boss_id: "gingerbread", boss_elo: 1600, abandoned: 1, played_at: T0 + 4 * MIN, play_ms: null, moves: null, xp_none: null, solo_game: g },
    ]);
    // (The new game is open, not real: left now, nothing more.)
    expect(await w.sql.first("SELECT id, real_at FROM solo_games WHERE user_id = ?", ann.id)).toEqual({ id: next, real_at: null });
    expect((await w.call("/api/me", ann.cookie)).body).toMatchObject({ xp: 0, stats: { boss: { matches: 1, teamWins: 0 } } });
    // (Nothing in the ledger but the first visit's Welcome Crate, Nov 27: no game's.)
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM ledger WHERE reason <> 'welcome'")).toEqual({ n: 0 });
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM quest_progress")).toEqual({ n: 0 });
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM boss_token_drops")).toEqual({ n: 0 });
    expect(await finishedGames(w.sql, ann.id)).toBe(0);
    // (A Crowd game: a team's loss; Classic: last of its players, no team.)
    await w.real(ann, next, { mode: "crowd", players: 100, team: "b", bossId: null, bossElo: null });
    const third = await w.start(ann);
    await w.real(ann, third, { mode: "classic", players: 64, team: null, bossId: null, bossElo: null });
    await w.start(ann);
    expect((await w.rows(ann.id)).slice(1).map((r) => [r.mode, r.placement, r.players, r.team, r.team_won, r.boss_elo])).toEqual([
      ["crowd", 100, 100, "b", 0, null],
      ["classic", 64, 64, null, null, null],
    ]);
  });

  it("recorded as a loss at the app's load (settle=1), before the profile it answers is read; a read without it leaves a game under way", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const g = await w.start(ann);
    await w.real(ann, g);
    // (Mid-game reads, another tab holding the game: nothing.)
    expect((await w.call("/api/me", ann.cookie)).body).toMatchObject({ stats: { all: { matches: 0 } } });
    const me = await w.call("/api/me?settle=1", ann.cookie);
    expect(me.body).toMatchObject({ stats: { all: { matches: 1 }, boss: { matches: 1 } }, recent: [{ mode: "boss", online: false, teamWon: false }] });
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM solo_games WHERE user_id = ?", ann.id)).toEqual({ n: 0 });
    expect((await w.call("/api/me?settle=1", ann.cookie)).body).toMatchObject({ stats: { all: { matches: 1 } } });
  });

  it("recorded as a loss on any profile read once it began SOLO_ABANDON.staleHours ago", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const g = await w.start(ann);
    await w.real(ann, g);
    at(T0 + SOLO_ABANDON.staleHours * 60 * MIN - 1);
    await w.call("/api/me", ann.cookie);
    expect(await losses(w.sql, ann.id)).toEqual([]);
    at(T0 + SOLO_ABANDON.staleHours * 60 * MIN);
    expect((await w.call("/api/me", ann.cookie)).body).toMatchObject({ stats: { all: { matches: 1 } } });
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: g }]);
  });

  it("never twice: its late result writes nothing; a result that came first is the only row; a result posted twice is one", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    // Left, then its tab finishes it: the loss stands alone, no XP.
    const a = await w.start(ann);
    await w.real(ann, a);
    await w.start(ann);
    at(T0 + 12 * MIN);
    expect((await w.result(ann, a)).body).toEqual({ ok: true, xp: null });
    expect((await w.rows(ann.id)).map((r) => [r.solo_game, r.abandoned])).toEqual([[a, 1]]);
    // A result that comes in normally takes the game off: XP as ever; nothing later records it again.
    const b = await w.start(ann);
    await w.real(ann, b);
    at(T0 + 30 * MIN);
    expect(((await w.result(ann, b)).body.xp as { after: number }).after).toBeGreaterThan(0);
    await w.start(ann);
    await w.call("/api/me?settle=1", ann.cookie);
    expect((await w.result(ann, b)).body).toEqual({ ok: true, xp: null });
    expect((await w.rows(ann.id)).map((r) => [r.solo_game, r.abandoned])).toEqual([
      [a, 1],
      [b, null],
    ]);
  });

  it("the review's case: a finished game's result kept on the device is never recorded as left (load, stale reads); sent again, it's the win", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    // Won at move 25; the post never got there (the page was closed mid-post). The next load names the kept game and doesn't settle.
    const g = await w.start(ann);
    at(T0 + 3 * MIN);
    await w.real(ann, g);
    at(T0 + 20 * MIN);
    expect((await w.call(`/api/me?unsent=${g}`, ann.cookie)).body).toMatchObject({ stats: { all: { matches: 0 } } });
    // (Back a day later: a read naming it is no stale read for it.)
    at(T0 + (SOLO_ABANDON.staleHours + 2) * 60 * MIN);
    await w.call(`/api/me?unsent=${g}`, ann.cookie);
    expect(await losses(w.sql, ann.id)).toEqual([]);
    // Sent again: the win, with no time XP (N2); then nothing more is recorded for it, by a load or a late copy.
    expect((await w.result(ann, g, { resent: true })).body).toEqual({ ok: true, xp: expect.objectContaining({ before: 0, after: 0, parts: [] }) });
    await w.call("/api/me?settle=1", ann.cookie);
    await w.result(ann, g);
    expect(await w.rows(ann.id)).toEqual([
      { mode: "boss", online: 0, placement: 1, players: 1, team: null, team_won: 1, boss_id: null, boss_elo: null, abandoned: null, played_at: T0 + (SOLO_ABANDON.staleHours + 2) * 60 * MIN, play_ms: 0, moves: 25, xp_none: null, solo_game: g },
    ]);
    // (A read that doesn't name it, once stale, records it: `unsent` spares only the game it names.)
    const h = await w.start(ann);
    await w.real(ann, h);
    at(T0 + (2 * SOLO_ABANDON.staleHours + 3) * 60 * MIN);
    await w.call(`/api/me?unsent=${g}`, ann.cookie);
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: h }]);
  });

  it("a start naming a kept game (`unsent`) replaces it with no loss; its result then records the win; a bad name spares nothing", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const a = await w.start(ann);
    await w.real(ann, a);
    const b = await w.start(ann, { unsent: a });
    expect(await losses(w.sql, ann.id)).toEqual([]);
    expect(await w.sql.first("SELECT id, real_at FROM solo_games WHERE user_id = ?", ann.id)).toEqual({ id: b, real_at: null });
    at(T0 + 40 * MIN);
    expect((await w.result(ann, a, { resent: true })).body).toEqual({ ok: true, xp: null });
    expect((await w.rows(ann.id)).map((r) => [r.solo_game, r.abandoned, r.team_won])).toEqual([[a, null, 1]]);
    await w.real(ann, b);
    await w.start(ann, { unsent: "not a game" });
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: b }]);
  });

  it("a re-sent result (`resent`) earns no time XP, and so no win XP nor the daily reward, however long after its start (N2)", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const bob = await w.player("bob@example.com");
    const a = await w.start(ann);
    const b = await w.start(bob);
    // (Played two minutes in airplane mode; sent hours later.)
    at(T0 + 3 * 60 * MIN);
    const resent = (await w.result(ann, a, { resent: true })).body.xp as { after: number; parts: unknown[] };
    const sent = (await w.result(bob, b)).body.xp as { after: number; parts: { label: string }[] };
    expect(resent).toMatchObject({ after: 0, parts: [] });
    expect(sent.after).toBeGreaterThan(0);
    expect(sent.parts.map((p) => p.label)).toContain("Win");
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM ledger WHERE account IN (SELECT account FROM wallets WHERE user_id = ?)", ann.id)).toEqual({ n: 0 });
  });

  it("a guest joining an account: the guest's real game is recorded as left and moves with its results; an unmarked one goes (N4)", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const join = async (start: (g: { id: string; cookie: string }) => Promise<string | null>) => {
      const guest = await w.player(null);
      const game = await start(guest);
      await signInWithIdentity(w.sql, (await getUser(w.sql, guest.id))!, "email", "ann@example.com", {}, Date.now());
      expect(await w.sql.first("SELECT (SELECT COUNT(*) FROM solo_games WHERE user_id = ?) + (SELECT COUNT(*) FROM results WHERE user_id = ?) AS n", guest.id, guest.id)).toEqual({ n: 0 });
      return game;
    };
    const left = await join(async (g) => {
      const id = await w.start(g);
      await w.real(g, id);
      return id;
    });
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: left }]);
    await join((g) => w.start(g));
    expect(await w.rows(ann.id)).toHaveLength(1);
  });

  it("a result racing the loss: whichever takes the game first is recorded, the other writes nothing", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    // The loss's statements and the result's own steps, interleaved both ways (D1 runs each statement, and each batch, alone).
    const g1 = await w.start(ann);
    await w.real(ann, g1);
    await endSoloGame(w.sql, ann.id, g1, Date.now()); // (the result took it first)
    await abandonSoloGame(w.sql, ann.id);
    await w.result(ann, g1);
    const g2 = await w.start(ann);
    await w.real(ann, g2);
    await w.sql.batch(abandonStatements(ann.id, {}, true)); // (the loss took it first)
    expect(await endSoloGame(w.sql, ann.id, g2, Date.now())).toBeNull();
    await w.result(ann, g2);
    expect((await w.rows(ann.id)).map((r) => [r.solo_game, r.abandoned])).toEqual([
      [g1, null],
      [g2, 1],
    ]);
  });

  it("two tabs: a second tab's start records the first's real game; the first tab's result then writes nothing, the second's counts", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const tab1 = await w.start(ann);
    await w.real(ann, tab1);
    const tab2 = await w.start(ann);
    // (Tab 1 plays on and marks again: its game isn't the open one any more.)
    expect((await w.real(ann, tab1)).body).toEqual({ ok: false });
    at(T0 + 15 * MIN);
    expect((await w.result(ann, tab1)).body).toEqual({ ok: true, xp: null });
    expect(((await w.result(ann, tab2)).body.xp as { parts: unknown[] }).parts.length).toBeGreaterThan(0);
    expect((await w.rows(ann.id)).map((r) => [r.solo_game, r.abandoned])).toEqual([
      [tab1, 1],
      [tab2, null],
    ]);
  });

  it("a Battle Tower floor's game (never marked: the app doesn't for a floor) and an admin's test game are never recorded as left", async () => {
    const w = await world({ ADMIN_EMAILS: "boss@example.com" });
    const ann = await w.player("ann@example.com");
    // (A floor's XP game is an ordinary solo start, never marked: tower.ts has its own leave rules.)
    await w.start(ann);
    await w.start(ann);
    await w.call("/api/me?settle=1", ann.cookie);
    expect(await w.rows(ann.id)).toEqual([]);
    // (?xpgame by an admin where test switches are off: a test game, so its mark is refused.)
    const admin = await w.player("boss@example.com");
    const t = await w.start(admin, { xpgame: 12 });
    expect((await w.real(admin, t)).body).toEqual({ ok: false });
    await w.start(admin);
    await w.call("/api/me?settle=1", admin.cookie);
    expect(await w.rows(admin.id)).toEqual([]);
  });

  it("a guest's game counts as any account's; an account erased mid-game records nothing, and the download has the open game", async () => {
    const w = await world();
    const guest = await w.player(null);
    const g = await w.start(guest);
    await w.real(guest, g, { mode: "crowd", players: 100, team: "w", bossId: null, bossElo: null });
    const download = (await accountDownload(w.sql, (await getUser(w.sql, guest.id))!, Date.now())) as { xp: { soloGame: unknown } };
    expect(download.xp.soloGame).toMatchObject({ started_at: new Date(T0).toISOString(), real_at: new Date(T0).toISOString(), mode: "crowd", players: 100, team: "w" });
    await w.call("/api/me?settle=1", guest.cookie);
    expect(await losses(w.sql, guest.id)).toEqual([{ solo_game: g }]);
    // Erased with a real game open: its row goes with the account, and nothing is recorded for anyone afterwards.
    const ann = await w.player("ann@example.com");
    const a = await w.start(ann);
    await w.real(ann, a);
    await deleteAccount(w.sql, (await getUser(w.sql, ann.id))!, Date.now());
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM solo_games WHERE user_id = ?", ann.id)).toEqual({ n: 0 });
    await abandonSoloGame(w.sql, ann.id);
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM results WHERE abandoned = 1 AND user_id <> ?", guest.id)).toEqual({ n: 0 });
    // (A row whose account is gone, however it got there: no loss is written for nobody.)
    await w.sql.run("INSERT INTO solo_games (user_id, id, started_at, real_at, mode, players) VALUES ('gone', 'aaaaaaaaaaaaaaaaaa', 1, 2, 'classic', 64)");
    await abandonSoloGame(w.sql, "gone");
    await startSoloGame(w.sql, "gone", Date.now());
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM results WHERE user_id = 'gone'")).toEqual({ n: 0 });
  });
});

/**
 * Step 2 (Nov 22): Resume / Forfeit. The device keeps a solo boss battle and names it at its load (`resume`): never recorded as left
 * there unless stale, and the answer says whether it's still open (`soloOpen`). Forfeit (POST /api/xp/solo/forfeit) records it as a
 * loss now past SOLO_ABANDON.minMoves, nothing under it.
 */
describe("a solo game this device can resume (step 2: Resume / Forfeit)", () => {
  it("the load's settle skips the game it names (`resume`) and answers it's open; the same game resumed later gets its result as ever", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const g = await w.start(ann);
    await w.real(ann, g);
    at(T0 + 20 * MIN);
    expect((await w.call(`/api/me?settle=1&resume=${g}`, ann.cookie)).body).toMatchObject({ soloOpen: true, stats: { all: { matches: 0 } } });
    expect(await losses(w.sql, ann.id)).toEqual([]);
    // (Its 10-move mark as it was: a second mark changes nothing.)
    expect((await w.real(ann, g)).body).toEqual({ ok: false });
    expect(await w.sql.first("SELECT id, real_at FROM solo_games WHERE user_id = ?", ann.id)).toEqual({ id: g, real_at: T0 });
    // Resumed and won: recorded as the win, timed from its first start, once.
    at(T0 + 40 * MIN);
    expect(((await w.result(ann, g)).body.xp as { after: number }).after).toBeGreaterThan(0);
    expect((await w.rows(ann.id)).map((r) => [r.solo_game, r.abandoned, r.play_ms])).toEqual([[g, null, 40 * MIN]]);
    // (A read without `resume` never answers soloOpen.)
    expect((await w.call("/api/me", ann.cookie)).body.soloOpen).toBeUndefined();
  });

  it("stale (SOLO_ABANDON.staleHours since it began): the load records it as left though it's named, and answers it isn't open", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const g = await w.start(ann);
    await w.real(ann, g);
    at(T0 + SOLO_ABANDON.staleHours * 60 * MIN - 1);
    expect((await w.call(`/api/me?settle=1&resume=${g}`, ann.cookie)).body.soloOpen).toBe(true);
    at(T0 + SOLO_ABANDON.staleHours * 60 * MIN);
    expect((await w.call(`/api/me?settle=1&resume=${g}`, ann.cookie)).body).toMatchObject({ soloOpen: false, stats: { all: { matches: 1 } } });
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: g }]);
  });

  it("a game recorded or replaced meanwhile (another device's start) isn't open; naming another game settles the open one as before", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const g = await w.start(ann);
    await w.real(ann, g);
    // Another device starts a game: g is recorded as left; the phone that keeps g is told it's gone.
    const other = await w.start(ann);
    expect((await w.call(`/api/me?settle=1&resume=${g}`, ann.cookie)).body.soloOpen).toBe(false);
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: g }]);
    // That device's game made real, the phone's load (still naming g) records it as left: only the named game is spared.
    await w.real(ann, other);
    expect((await w.call(`/api/me?settle=1&resume=${g}`, ann.cookie)).body.soloOpen).toBe(false);
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: g }, { solo_game: other }]);
    // (A bad name spares nothing and answers nothing.)
    const third = await w.start(ann);
    await w.real(ann, third);
    expect((await w.call("/api/me?settle=1&resume=nonsense", ann.cookie)).body.soloOpen).toBeUndefined();
    expect(await losses(w.sql, ann.id)).toHaveLength(3);
  });

  it("another account's game is never open for you, and naming it spares nothing of yours", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const bob = await w.player("bob@example.com");
    const g = await w.start(ann);
    await w.real(ann, g);
    const b = await w.start(bob);
    await w.real(bob, b);
    expect((await w.call(`/api/me?settle=1&resume=${g}`, bob.cookie)).body.soloOpen).toBe(false);
    expect(await losses(w.sql, bob.id)).toEqual([{ solo_game: b }]);
    expect(await losses(w.sql, ann.id)).toEqual([]);
  });

  it("Forfeit: past the mark a loss now (once, whoever asks twice); under it nothing; the facts sent with it mark one whose mark never landed", async () => {
    const w = await world();
    const ann = await w.player("ann@example.com");
    const forfeit = (game: string, real?: object) => w.call("/api/xp/solo/forfeit", ann.cookie, { game, ...(real ? { real } : {}) });
    const facts = { mode: "boss", players: 1, team: null, bossId: "gingerbread", bossElo: 1600 };
    // Under the mark: nothing recorded; the game's row is left for the next start to replace.
    const a = await w.start(ann);
    expect((await forfeit(a)).body).toEqual({ lost: false });
    expect(await w.rows(ann.id)).toEqual([]);
    // Marked: a loss now, last place, abandoned, no XP; again: the same answer, one row; its late result writes nothing.
    const b = await w.start(ann);
    at(T0 + 5 * MIN);
    await w.real(ann, b);
    at(T0 + 9 * MIN);
    expect((await forfeit(b)).body).toEqual({ lost: true });
    expect((await forfeit(b)).body).toEqual({ lost: true });
    expect(await w.rows(ann.id)).toEqual([
      { mode: "boss", online: 0, placement: 1, players: 1, team: null, team_won: 0, boss_id: "gingerbread", boss_elo: 1600, abandoned: 1, played_at: T0 + 5 * MIN, play_ms: null, moves: null, xp_none: null, solo_game: b },
    ]);
    expect(await w.sql.first("SELECT COUNT(*) AS n FROM solo_games WHERE user_id = ?", ann.id)).toEqual({ n: 0 });
    expect((await w.result(ann, b)).body).toEqual({ ok: true, xp: null });
    expect(await w.rows(ann.id)).toHaveLength(1);
    // Past the mark on the device, its mark never answered: the forfeit's facts mark it, and it's a loss.
    const c = await w.start(ann);
    expect((await forfeit(c, facts)).body).toEqual({ lost: true });
    expect(await losses(w.sql, ann.id)).toEqual([{ solo_game: b }, { solo_game: c }]);
    // A game that isn't open (replaced) or another account's: nothing.
    const d = await w.start(ann);
    await w.real(ann, d);
    await w.start(ann);
    const bob = await w.player("bob@example.com");
    const e = await w.start(bob);
    await w.real(bob, e);
    expect((await forfeit(e, facts)).body).toEqual({ lost: false });
    expect(await losses(w.sql, bob.id)).toEqual([]);
    expect((await forfeit("nonsense")).body).toEqual({ lost: false });
  });
});
