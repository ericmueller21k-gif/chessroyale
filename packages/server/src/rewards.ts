import { XP, bossCrateDef, isPickableBossCrate, levelOf, levelReward, type QuestPaid, type XpRewards } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { applyOp, cond, keyFor, leg, ledgerAccount, opKeys, opStatements, type LedgerAccount, type Op } from "./ledger.ts";

/**
 * XP phase 2's rewards (Eric, Nov 9: "go with phase two"; the approved design's sections 2 and 4; XP in settings.ts;
 * docs/decisions/2026-11-09-xp-phase2-*.md). Decided by the server only, at a counted game's XP grant (xp.ts grantXp), and granted
 * through the ledger, each once:
 *
 *   - **The daily reward** (op `daily:<XP day's start>:<ledger id>`, reason "daily"): your first counted game of the XP day with
 *     XP.dailyMinMoves of your own moves: XP.dailyBonus XP and XP.dailyCrates crates of XP.rewardCrate. One op a day: a second game,
 *     a retry or two rooms at once pay it once. Its legs' source is the game that paid it, so that game's result answers it.
 *   - **Level rewards** (op `level:<level>:<ledger id>`, reason "level"): each level reached, XP.levelCrates crates and XP.levelKeys
 *     keys, every XP.bossCrateEvery-th also a boss crate to pick (the wallet's `boss_picks`). Paid at a counted game for every level
 *     up to your level now that isn't paid yet (at most XP.levelsPerGame a game), so a level reached before phase 2, through a guest's
 *     merge or a test switch, or while rewards were paused, is paid at the next counted game; never twice (one op per level), and never
 *     a level a guest merged into the account was paid already (Nov 10).
 *   - **The boss crate pick** (op `pick:<ledger id>:<request>`): one pick spent, the chosen live boss's crate into your boss crates
 *     (unopened, opened as any boss crate: no tokens, no key).
 *   - **Old crates** (the wallet's `crates`, Squads' placements' before Nov 9): turned into crates of XP.rewardCrate as the locker is
 *     read (`seriesFromWallet`), so every crate you hold has a series.
 */

const newId = (bytes = 9) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The daily reward's op key: one a day per account. */
export const dailyOpId = (day: number, account: string) => `daily:${day}:${account}`;
/** A level's reward op key: one per level per account. */
export const levelOpId = (level: number, account: string) => `level:${level}:${account}`;

/** The daily reward's op (its legs' source: the game paying it). */
export function dailyOp(me: LedgerAccount, day: number, game: string, now: number): Op {
  return {
    id: dailyOpId(day, me.account),
    reason: "daily",
    now,
    legs: [
      ...(XP.dailyBonus ? [leg.xp(me.user, XP.dailyBonus, game)] : []),
      ...(XP.dailyCrates ? [leg.seriesCrates(me.user, XP.rewardCrate, XP.dailyCrates, game)] : []),
    ],
  };
}

/** One level's reward op (its legs' source: the game paying it). Null: nothing to give at that level (the settings say none). */
export function levelOp(me: LedgerAccount, level: number, game: string, now: number): Op | null {
  const r = levelReward(level);
  const legs = [
    ...(r.crates ? [leg.seriesCrates(me.user, XP.rewardCrate, r.crates, game)] : []),
    ...(r.keys ? [leg.keys(me.user, r.keys, game)] : []),
    ...(r.bossPicks ? [leg.bossPicks(me.user, r.bossPicks, game)] : []),
  ];
  return legs.length ? { id: levelOpId(level, me.account), reason: "level", now, legs } : null;
}

/**
 * The level rewards an account has had, in SQL (`?1`: its ledger id): its own level ops, and those of every guest that signed in to it
 * (its merge's legs name the guest's ledger id: `merge:<ledger id>:…`, ledger.ts mergeMoves). The guest's XP joins the account, so
 * the levels that XP reached were paid already: the outside review of Nov 10 (a merge had them paid again).
 */
const PAID_LEVELS = `SELECT op_id FROM ledger WHERE reason = 'level' AND leg = 0 AND account IN (
  SELECT ?1 UNION SELECT substr(op_id, 7, instr(substr(op_id, 7), ':') - 1) FROM ledger WHERE account = ?1 AND reason = 'merge')`;

/**
 * The levels owed: every level from 2 to `level` whose reward isn't paid yet (by this account, or a guest merged into it: PAID_LEVELS),
 * lowest first, at most XP.levelsPerGame. One read.
 */
export async function owedLevels(sql: Sql, me: LedgerAccount, level: number): Promise<number[]> {
  if (level < 2) return [];
  const paid = new Set((await sql.all<{ op_id: string }>(PAID_LEVELS, me.account)).map((r) => Number(r.op_id.split(":")[1])));
  return Array.from({ length: level - 1 }, (_, i) => i + 2)
    .filter((l) => !paid.has(l))
    .slice(0, XP.levelsPerGame);
}

/** Pays every level owed at your XP now (one batch, each level once: a race or a retry pays nothing more). */
export async function payLevels(sql: Sql, me: LedgerAccount, xpNow: number, game: string, now: number): Promise<void> {
  const ops = (await owedLevels(sql, me, levelOf(xpNow))).map((l) => levelOp(me, l, game, now)).filter((op): op is Op => !!op);
  if (ops.length) await sql.batch(ops.flatMap((op) => opStatements(me, op, newId())));
}

/**
 * What a game paid beside its XP (the result screen's rewards): the daily reward and the levels whose legs name this game as their
 * source, and the quests it completed (`quests`: quests.ts questsPaidBy, read by the caller). A replay of the game's grant answers
 * the same. Undefined: nothing.
 */
export async function gameRewards(sql: Sql, me: LedgerAccount, game: string, quests: readonly QuestPaid[] = []): Promise<XpRewards | undefined> {
  const rows = await sql.all<{ op_id: string; reason: string; asset_kind: string; n: number }>(
    "SELECT op_id, reason, asset_kind, SUM(delta) AS n FROM ledger WHERE account = ? AND source_id = ? AND reason IN ('daily', 'level') GROUP BY op_id, reason, asset_kind",
    me.account,
    game,
  );
  if (!rows.length && !quests.length) return undefined;
  const r: XpRewards = { crate: XP.rewardCrate, daily: 0, crates: 0, keys: 0, bossPicks: 0, levels: [], ...(quests.length ? { quests: [...quests] } : {}) };
  const levels = new Set<number>();
  for (const row of rows) {
    if (row.reason === "daily") {
      if (row.asset_kind === "series_crate") r.daily += row.n;
      continue;
    }
    const level = Number(row.op_id.split(":")[1]);
    if (Number.isInteger(level)) levels.add(level);
    if (row.asset_kind === "series_crate") r.crates += row.n;
    else if (row.asset_kind === "keys") r.keys += row.n;
    else if (row.asset_kind === "boss_pick") r.bossPicks += row.n;
  }
  r.levels = [...levels].sort((a, b) => a - b);
  return r.daily || r.crates || r.keys || r.bossPicks || r.quests ? r : undefined;
}

/** Your series crates, by crate id (only those you hold some of), and your boss crates to pick. */
export async function seriesHoldings(sql: Sql, userId: string): Promise<{ seriesCrates: Record<string, number>; bossPicks: number }> {
  const rows = await sql.all<{ crate: string; n: number }>("SELECT crate, n FROM series_crates WHERE user_id = ? AND n > 0 ORDER BY crate", userId);
  const picks = (await sql.first<{ boss_picks: number | null }>("SELECT boss_picks FROM wallets WHERE user_id = ?", userId))?.boss_picks ?? 0;
  return { seriesCrates: Object.fromEntries(rows.map((r) => [r.crate, r.n])), bossPicks: picks };
}

/**
 * Old crates (the wallet's `crates`: Squads' placements before Nov 9, and a guest's merged in) into crates of XP.rewardCrate, as the
 * locker is read: one op of a leg out of the wallet's count and a leg into the series, guarded by the count still being there (two
 * reads at once: one of them moves them). Nothing to do for almost everyone: one read.
 */
export async function seriesFromWallet(sql: Sql, userId: string, now: number): Promise<void> {
  const n = (await sql.first<{ crates: number | null }>("SELECT crates FROM wallets WHERE user_id = ?", userId))?.crates ?? 0;
  if (!(n > 0)) return;
  const me = await ledgerAccount(sql, userId);
  if (!me) return;
  await applyOp(sql, me, {
    id: `crates-to-series:${me.account}:${newId()}`,
    reason: "crates to series",
    now,
    when: cond("EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND crates >= ?)", userId, n),
    legs: [leg.crates(userId, -n), leg.seriesCrates(userId, XP.rewardCrate, n)],
  });
}

/**
 * Picks a level's boss crate (POST /api/locker/pick {crate, request}): one of your picks spent, that live boss's crate into your boss
 * crates, unopened. One op, keyed by the app's id for the pick (`pick:<ledger id>:<request>`: a retry picks once); refused without a
 * pick. Answers the crate it put in (a retry: the first pick's).
 */
export async function pickBossCrate(
  sql: Sql,
  userId: string,
  crateId: unknown,
  request: string | null,
  now: number,
): Promise<{ ok: true; crate: string } | { ok: false; message: string }> {
  if (!isPickableBossCrate(crateId)) return { ok: false, message: "No such crate." };
  const crate = bossCrateDef(crateId as string)!;
  const me = await ledgerAccount(sql, userId);
  if (!me) return { ok: false, message: NO_PICK };
  const op = request ? keyFor(opKeys.request("pick", request), me) : `pick:${me.account}:${newId()}`;
  const row = newId();
  const done = await applyOp(sql, me, {
    id: op,
    reason: "boss crate pick",
    now,
    when: cond("EXISTS (SELECT 1 FROM wallets WHERE user_id = ? AND boss_picks >= 1)", userId),
    legs: [leg.bossPicks(userId, -1, row), leg.bossCrateIn(userId, row, crate.id, now)],
  });
  if (done === "refused") return { ok: false, message: NO_PICK };
  // (A retry: the crate the first attempt picked, its second leg's.)
  const picked = done === "replay" ? ((await sql.first<{ asset_id: string }>("SELECT asset_id FROM ledger WHERE op_id = ? AND leg = 1", op))?.asset_id ?? crate.id) : crate.id;
  return { ok: true, crate: picked };
}

/** The refusal of a pick with none to make. */
export const NO_PICK = "You have no boss crate to choose.";

