import {
  QUESTS,
  XP,
  dailiesToDeal,
  pickQuests,
  playableBosses,
  questCounts,
  questDef,
  questSeed,
  questWeekStart,
  xpDayStart,
  type QuestDef,
  type QuestGame,
  type QuestIcon,
  type QuestPaid,
  type QuestView,
  type QuestsAnswer,
} from "@chessroyale/core";
import type { Sql, Stmt } from "./accounts.ts";
import { cond, leg, type Cond, type LedgerAccount, type Op } from "./ledger.ts";

/**
 * Quests (Eric, Nov 9; XP phase 3; QUESTS in settings.ts, core's quests.ts; docs/decisions/2026-11-09-quests-*.md). Decided by the
 * server only:
 *
 *   - **Dealt lazily** (no scheduled job): the first read of the XP day (home's GET /api/quests, or a game's XP grant) deals the day's
 *     dailies, and the first of the week the weekly, each drawn from a seed of the account and the day, so a second read at once
 *     draws the same. One claim per day (`quest_days`: its upsert names this attempt's nonce; the deal's rows go in only if it's this
 *     attempt's), so two reads at once deal once. A new day drops the dailies finished before it; unfinished ones carry over, and the
 *     deal tops them up to QUESTS.maxDailies at most. A new week replaces the weekly.
 *   - **Progress** (`quest_progress`, one row per quest per game): written in the same batch as the game's XP (xp.ts grantXp), only
 *     for a counted game (no XP, no progress), only while the quest is unfinished, and for a win quest only if the game's win XP is in
 *     the ledger (its op's first leg: a friends' lobby pays a win once a day per opponent), and for a solo game only if its time XP
 *     is (past the day's solo minutes: no XP, no progress; review of #575, m2). Only the attempt that first counted the game moves
 *     quests (`quest_games`: its claim names the attempt), so a replay (Squads' reward queue, the duel room's retry) after a reroll or
 *     a new day's deal moves nothing, the new quests included (review of #575, m1).
 *   - **Completion** (op `quest:<kind>:<quest id>:<ledger id>`, reason "quest", in that same batch): its guard counts the progress in
 *     the same transaction, so the game that brings it to its target pays it, once; two games at once, two tabs or a replay can't pay
 *     it twice. Its legs (XP, crates of XP.rewardCrate, keys) name the game as their source, so that game's result answers it.
 *   - **The reroll** (POST /api/quests/reroll; Eric, Nov 10: one per daily, not one per day): each unfinished daily has its own free
 *     reroll a day, swapped for a quest of the pool you don't hold, its progress gone. The replacement keeps the slot and is marked
 *     with the day (`quests.rerolled_day`), so it can't be rerolled again that day; tomorrow it can. The swap goes in only while the
 *     old quest is still there, so two taps or two tabs reroll a quest once. (`quest_days.reroll_day`, the shared reroll's day before
 *     Nov 10, is no longer written.)
 */
export const QUESTS_SCHEMA = [
  // An account's quests: dailies and the weekly, dealt (`assigned_at`: the XP day or week it was dealt), finished (`done_at`).
  // `kind` is the pool's id (QUESTS), `target` kept as dealt. A new table: nothing older reads or writes it.
  `CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    period TEXT NOT NULL,
    kind TEXT NOT NULL,
    target INTEGER NOT NULL,
    assigned_at INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    done_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS quests_user ON quests (user_id)`,
  // Each game that moved a quest: one row per quest per game (`game`: the XP grant's key), so a replay adds nothing.
  `CREATE TABLE IF NOT EXISTS quest_progress (
    quest_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (quest_id, game)
  )`,
  `CREATE INDEX IF NOT EXISTS quest_progress_user ON quest_progress (user_id)`,
  // Each counted game's claim on quests (review of #575, m1): the attempt (a nonce) that first counted it; only that attempt's progress
  // goes in. Rows older than the day before are cleared at the day's deal (retries come within minutes).
  `CREATE TABLE IF NOT EXISTS quest_games (
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    attempt TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (user_id, game)
  )`,
  // Per account: the XP day and week last dealt, and the nonce of the attempt that last claimed one. (`reroll_day`: the day of the
  // shared reroll, before Nov 10; no longer written.)
  `CREATE TABLE IF NOT EXISTS quest_days (
    user_id TEXT PRIMARY KEY,
    day INTEGER NOT NULL,
    week INTEGER NOT NULL,
    reroll_day INTEGER,
    nonce TEXT NOT NULL
  )`,
];

/**
 * Columns added to the quest tables after they shipped (accounts.ts COLUMNS; Nov 10, 2026). `quests.rerolled_day`: the XP day a reroll
 * dealt this quest (it can't be rerolled again that day); NULL: dealt by a day's deal, or before Nov 10.
 */
export const QUESTS_COLUMNS = [{ table: "quests", column: "rerolled_day", type: "INTEGER" }];

const stmt = (sql: string, ...params: unknown[]): Stmt => ({ sql, params });
const newId = (bytes = 9) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
/** A quest's id: 18 hex characters. */
const QUEST_ID = /^[0-9a-f]{18}$/;

interface QuestRow {
  id: string;
  period: "daily" | "weekly";
  kind: string;
  target: number;
  assigned_at: number;
  slot: number;
  done_at: number | null;
  rerolled_day: number | null;
  n: number;
}

/** An account's quests with their progress, the dailies (oldest first) then the weekly. */
const rowsOf = (sql: Sql, userId: string) =>
  sql.all<QuestRow>(
    `SELECT q.id, q.period, q.kind, q.target, q.assigned_at, q.slot, q.done_at, q.rerolled_day, (SELECT COUNT(*) FROM quest_progress p WHERE p.quest_id = q.id) AS n
     FROM quests q WHERE q.user_id = ? ORDER BY q.period = 'weekly', q.assigned_at, q.slot`,
    userId,
  );

/** One dealt quest's row, if this attempt's claim holds (`ours`). `rerolledDay`: a reroll's replacement, the day it was dealt. */
const insertQuest = (userId: string, period: "daily" | "weekly", def: QuestDef, at: number, slot: number, ours: Cond, id = newId(), rerolledDay: number | null = null): Stmt =>
  stmt(
    `INSERT INTO quests (id, user_id, period, kind, target, assigned_at, slot, done_at, rerolled_day) SELECT ?, ?, ?, ?, ?, ?, ?, NULL, ? WHERE ${ours.sql}`,
    id,
    userId,
    period,
    def.id,
    def.target,
    at,
    slot,
    rerolledDay,
    ...ours.params,
  );

/**
 * Deals the day's dailies and the week's weekly if not yet (the first read of the XP day or week). Nothing to do for the day's
 * other reads: one read. An account that doesn't exist (deleted) gets nothing.
 */
export async function ensureQuests(sql: Sql, userId: string, now: number): Promise<void> {
  const day = xpDayStart(now);
  const week = questWeekStart(now);
  const at = await sql.first<{ day: number; week: number }>("SELECT day, week FROM quest_days WHERE user_id = ?", userId);
  if (at && at.day === day && at.week === week) return;
  const held = await rowsOf(sql, userId);
  const nonce = newId();
  const ours = cond("EXISTS (SELECT 1 FROM quest_days WHERE user_id = ? AND nonce = ?)", userId, nonce);
  const out: Stmt[] = [
    // (The claim: this attempt's nonce goes in only if this day or week isn't dealt yet; the rest checks it.)
    stmt(
      `INSERT INTO quest_days (user_id, day, week, reroll_day, nonce) SELECT ?, ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
       ON CONFLICT (user_id) DO UPDATE SET day = excluded.day, week = excluded.week, nonce = excluded.nonce WHERE quest_days.day <> excluded.day OR quest_days.week <> excluded.week`,
      userId,
      day,
      week,
      nonce,
      userId,
    ),
  ];
  const drop = (ids: string[]) =>
    ids.length
      ? [
          stmt(`DELETE FROM quest_progress WHERE quest_id IN (SELECT value FROM json_each(?)) AND ${ours.sql}`, JSON.stringify(ids), ...ours.params),
          stmt(`DELETE FROM quests WHERE id IN (SELECT value FROM json_each(?)) AND user_id = ? AND ${ours.sql}`, JSON.stringify(ids), userId, ...ours.params),
        ]
      : [];
  if (!at || at.day !== day) {
    // (Yesterday's finished dailies go, and any of a kind the pool no longer has; the unfinished ones wait, up to QUESTS.maxDailies.)
    const dailies = held.filter((q) => q.period === "daily");
    const waiting = dailies.filter((q) => q.done_at === null && questDef(q.kind) && q.assigned_at < day);
    const gone = dailies.filter((q) => !waiting.includes(q) && q.assigned_at < day);
    out.push(...drop(gone.map((q) => q.id)));
    const kept = dailies.filter((q) => !gone.includes(q));
    const deal = pickQuests(QUESTS.daily, kept.map((q) => q.kind), dailiesToDeal(kept.filter((q) => q.done_at === null).length), `${userId}:${day}`);
    deal.forEach((def, i) => out.push(insertQuest(userId, "daily", def, day, i, ours)));
    out.push(stmt("DELETE FROM quest_games WHERE user_id = ? AND at < ?", userId, day - 86_400_000));
  }
  if (!at || at.week !== week) {
    out.push(...drop(held.filter((q) => q.period === "weekly" && q.assigned_at < week).map((q) => q.id)));
    if (!held.some((q) => q.period === "weekly" && q.assigned_at >= week)) {
      const [def] = pickQuests(QUESTS.weekly, [], 1, `${userId}:${week}:weekly`);
      if (def) out.push(insertQuest(userId, "weekly", def, week, 0, ours));
    }
  }
  await sql.batch(out);
}

/** A quest's picture: a boss quest's is a live boss's portrait, the same one for the quest (from its id). */
function iconOf(def: QuestDef, id: string): QuestIcon {
  if (def.icon.kind !== "boss") return def.icon;
  const live = playableBosses();
  const b = live[questSeed(id) % Math.max(1, live.length)];
  return b ? { kind: "boss", boss: b.name } : { kind: "board", piece: "queen" };
}

/** Whether a quest's free reroll is there today: an unfinished daily that no reroll dealt today. */
const canReroll = (q: QuestRow, day: number) => q.period === "daily" && q.done_at === null && q.n < q.target && q.rerolled_day !== day;

const view = (q: QuestRow, def: QuestDef, day: number): QuestView => ({
  id: q.id,
  period: q.period,
  name: def.name,
  goal: def.goal,
  progress: q.done_at !== null ? q.target : Math.min(q.n, q.target),
  target: q.target,
  icon: iconOf(def, q.id),
  reward: { xp: def.xp, ...(def.crates ? { crates: def.crates } : {}), ...(def.keys ? { keys: def.keys } : {}) },
  canReroll: canReroll(q, day),
});

/** GET /api/quests: your quests (dealt first if it's a new day or week; each daily says if its reroll is there today), the resets. */
export async function questsAnswer(sql: Sql, userId: string, now: number, paused = false): Promise<QuestsAnswer> {
  await ensureQuests(sql, userId, now);
  const rows = await rowsOf(sql, userId);
  const day = xpDayStart(now);
  return {
    quests: rows.flatMap((q) => {
      const def = questDef(q.kind);
      return def ? [view(q, def, day)] : [];
    }),
    day,
    dailyResetAt: day + 86_400_000,
    weeklyResetAt: questWeekStart(now) + 7 * 86_400_000,
    now,
    ...(paused ? { paused: true } : {}),
  };
}

/** The refusal of a reroll that can't be made. */
export const NO_REROLL = "That quest can't be swapped now.";

/**
 * POST /api/quests/reroll {quest}: a daily's free reroll today (QUESTS.rerollsPerDaily), on an unfinished daily that no reroll dealt
 * today: a quest of the pool you don't hold takes its slot (its progress gone), marked with the day. The other daily keeps its own.
 * One batch (one transaction): the replacement goes in only while the old quest is still there and still rerollable, then the old
 * one goes; so two taps or two tabs reroll it once (the second finds it gone), and the claim is the replacement's row.
 */
export async function rerollQuest(sql: Sql, userId: string, questId: unknown, now: number): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof questId !== "string" || !QUEST_ID.test(questId)) return { ok: false, message: NO_REROLL };
  await ensureQuests(sql, userId, now);
  const day = xpDayStart(now);
  const rows = await rowsOf(sql, userId);
  const q = rows.find((r) => r.id === questId);
  if (!q || !canReroll(q, day)) return { ok: false, message: NO_REROLL };
  const [def] = pickQuests(QUESTS.daily, rows.map((r) => r.kind), 1, `${userId}:${day}:reroll:${q.id}`);
  if (!def) return { ok: false, message: NO_REROLL };
  const id = newId();
  // (And only while you don't hold its kind: two dailies rerolled at once read the same quests and could both deal the same kind,
  // and one game would then pay both. The second batch sees the first's row and goes in empty: a refusal. Review of #603.)
  const old = cond(
    "EXISTS (SELECT 1 FROM quests WHERE id = ? AND user_id = ? AND period = 'daily' AND done_at IS NULL AND (rerolled_day IS NULL OR rerolled_day <> ?)) AND NOT EXISTS (SELECT 1 FROM quests WHERE user_id = ? AND kind = ?)",
    questId,
    userId,
    day,
    userId,
    def.id,
  );
  const ours = cond("EXISTS (SELECT 1 FROM quests WHERE id = ? AND user_id = ?)", id, userId);
  await sql.batch([
    insertQuest(userId, "daily", def, q.assigned_at, q.slot, old, id, day),
    stmt(`DELETE FROM quest_progress WHERE quest_id = ? AND ${ours.sql}`, questId, ...ours.params),
    stmt(`DELETE FROM quests WHERE id = ? AND user_id = ? AND ${ours.sql}`, questId, userId, ...ours.params),
  ]);
  const won = await sql.first<{ n: number }>("SELECT COUNT(*) AS n FROM quests WHERE id = ? AND user_id = ?", id, userId);
  return won?.n ? { ok: true } : { ok: false, message: NO_REROLL };
}

/** A quest's completion op's key: once per quest, its kind in it (so a result can name it without the quest's row). */
export const questOpId = (kind: string, questId: string, account: string) => `quest:${kind}:${questId}:${account}`;

/**
 * A counted game's quest statements, for its XP grant's batch (xp.ts grantXp; after its ops: a win quest waits for the win op's first
 * leg `winOp`, a solo game's progress for its time op's `timeOp` or its win op's): this attempt's claim on the game (`quest_games`; a replay's claim
 * doesn't go in, so its progress doesn't either), progress for each unfinished quest it moves, then each one's completion op (applied
 * only if its guard counts the target). Deals the day's quests first if it's the day's first read.
 */
export async function questStatements(
  sql: Sql,
  me: LedgerAccount,
  game: { key: string; now: number; quest: QuestGame; winOp: string; timeOp?: string },
  opStatements: (op: Op) => Stmt[],
): Promise<Stmt[]> {
  await ensureQuests(sql, me.user, game.now);
  const rows = (await rowsOf(sql, me.user)).filter((q) => q.done_at === null);
  const attempt = newId();
  const out: Stmt[] = [
    stmt("INSERT INTO quest_games (user_id, game, attempt, at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, game) DO NOTHING", me.user, game.key, attempt, game.now),
  ];
  const ops: Op[] = [];
  for (const q of rows) {
    const def = questDef(q.kind);
    if (!def || !questCounts(def.counts, game.quest)) continue;
    const winOnly = def.counts === "win" || def.counts === "bossWin";
    out.push(
      stmt(
        `INSERT INTO quest_progress (quest_id, user_id, game, at) SELECT ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM quests WHERE id = ? AND user_id = ? AND done_at IS NULL)
         AND EXISTS (SELECT 1 FROM quest_games WHERE user_id = ? AND game = ? AND attempt = ?)${winOnly ? " AND EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0)" : ""}${game.timeOp ? " AND (EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0) OR EXISTS (SELECT 1 FROM ledger WHERE op_id = ? AND leg = 0))" : ""}
         ON CONFLICT (quest_id, game) DO NOTHING`,
        q.id,
        me.user,
        game.key,
        game.now,
        q.id,
        me.user,
        me.user,
        game.key,
        attempt,
        ...(winOnly ? [game.winOp] : []),
        // (A solo game counts while it earned XP: its time or its win, Nov 9 delta review m-a: a won game past the minutes cap counts.)
        ...(game.timeOp ? [game.timeOp, game.winOp] : []),
      ),
    );
    ops.push({
      id: questOpId(def.id, q.id, me.account),
      reason: "quest",
      now: game.now,
      when: cond("EXISTS (SELECT 1 FROM quests WHERE id = ? AND done_at IS NULL) AND (SELECT COUNT(*) FROM quest_progress WHERE quest_id = ?) >= ?", q.id, q.id, q.target),
      legs: [
        leg.xp(me.user, def.xp, game.key),
        ...(def.crates ? [leg.seriesCrates(me.user, XP.rewardCrate, def.crates, game.key)] : []),
        ...(def.keys ? [leg.keys(me.user, def.keys, game.key)] : []),
      ],
      also: (o) => [stmt(`UPDATE quests SET done_at = ? WHERE id = ? AND ${o.sql}`, game.now, q.id, ...o.params)],
    });
  }
  return [...out, ...ops.flatMap(opStatements)];
}

/** The quests a game completed, as the ledger has them (their legs name the game): a replay answers the same. */
export async function questsPaidBy(sql: Sql, me: LedgerAccount, game: string): Promise<QuestPaid[]> {
  const rows = await sql.all<{ op_id: string; asset_kind: string; n: number }>(
    "SELECT op_id, asset_kind, SUM(delta) AS n FROM ledger WHERE account = ? AND source_id = ? AND reason = 'quest' GROUP BY op_id, asset_kind ORDER BY op_id",
    me.account,
    game,
  );
  const paid = new Map<string, QuestPaid>();
  for (const r of rows) {
    const kind = r.op_id.split(":")[1] ?? "";
    const p = paid.get(r.op_id) ?? { quest: kind, name: questDef(kind)?.name ?? "Quest", xp: 0, crates: 0, keys: 0 };
    if (r.asset_kind === "xp") p.xp += r.n;
    else if (r.asset_kind === "series_crate") p.crates += r.n;
    else if (r.asset_kind === "keys") p.keys += r.n;
    paid.set(r.op_id, p);
  }
  return [...paid.values()];
}

/**
 * The test switch `?quests=<kind>[:<progress>],…` (POST /api/quests/test; test servers only): your quests replaced by these (dailies
 * as listed, then a weekly), with that much progress, every reroll unused. Answers false for an unknown kind.
 */
export async function setTestQuests(sql: Sql, userId: string, list: unknown, now: number): Promise<boolean> {
  if (!Array.isArray(list) || list.length > 6) return false;
  const want = list.map((x) => {
    const o = (x ?? {}) as { kind?: unknown; progress?: unknown };
    const def = typeof o.kind === "string" ? questDef(o.kind) : null;
    const progress = typeof o.progress === "number" && Number.isInteger(o.progress) && o.progress >= 0 ? o.progress : 0;
    return def ? { def, progress: Math.min(progress, def.target - 1) } : null;
  });
  if (want.some((w) => !w)) return false;
  const day = xpDayStart(now);
  const week = questWeekStart(now);
  const nonce = newId();
  const ours = cond("EXISTS (SELECT 1 FROM quest_days WHERE user_id = ? AND nonce = ?)", userId, nonce);
  const out: Stmt[] = [
    ...questDeletes(userId),
    stmt("INSERT INTO quest_days (user_id, day, week, reroll_day, nonce) SELECT ?, ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)", userId, day, week, nonce, userId),
  ];
  want.forEach((w, i) => {
    const weekly = QUESTS.weekly.includes(w!.def);
    const id = newId();
    out.push(
      stmt(
        `INSERT INTO quests (id, user_id, period, kind, target, assigned_at, slot, done_at) SELECT ?, ?, ?, ?, ?, ?, ?, NULL WHERE ${ours.sql}`,
        id,
        userId,
        weekly ? "weekly" : "daily",
        w!.def.id,
        w!.def.target,
        weekly ? week : day,
        i,
        ...ours.params,
      ),
    );
    for (let n = 0; n < w!.progress; n++) out.push(stmt(`INSERT INTO quest_progress (quest_id, user_id, game, at) SELECT ?, ?, ?, ? WHERE ${ours.sql}`, id, userId, `test:${n}`, now, ...ours.params));
  });
  await sql.batch(out);
  return true;
}

/** An account's quest rows, gone (deleting the account; a guest's merge into the account it signs in to: the account keeps its own). */
export const questDeletes = (userId: string): Stmt[] => ["quest_progress", "quests", "quest_days", "quest_games"].map((t) => stmt(`DELETE FROM ${t} WHERE user_id = ?`, userId));

/**
 * The account's part of "Download my data": its quests (each one's kind, when dealt and finished, the day a reroll dealt it, its
 * progress) and the days last dealt (and the shared reroll's day from before Nov 10).
 */
export const questsDownload = async (sql: Sql, userId: string) => ({
  quests: await sql.all(
    `SELECT q.period, q.kind, q.target, q.assigned_at, q.done_at, q.rerolled_day, (SELECT COUNT(*) FROM quest_progress p WHERE p.quest_id = q.id) AS progress
     FROM quests q WHERE q.user_id = ? ORDER BY q.assigned_at, q.slot`,
    userId,
  ),
  days: await sql.first("SELECT day, week, reroll_day FROM quest_days WHERE user_id = ?", userId),
  games: await sql.all("SELECT game, at FROM quest_games WHERE user_id = ? ORDER BY at", userId),
});
