import { LADDER, RANKED_1V1, ladderPlaces, rankView, type LadderAnswer, type LadderRow, type LadderYou } from "@chessroyale/core";
import { d1Sql, ensureSchema, userFromToken, type Sql, type User } from "./accounts.ts";
import { SESSION_COOKIE, isSignedIn, readCookie, signInRequired, type AccountEnv, type WaitUntil } from "./api.ts";
import { isAdmin, type AdminEnv } from "./admin.ts";
import { NO_ADMINS, looksOf, type AdminCheck } from "./locker.ts";
import { LEFT_OUT, placeOf, shownAbove } from "./ranked-schema.ts";
import { seatName } from "./text-filter.ts";

/**
 * The season ladder (Eric, Nov 25: "a ladder board for all rank modes for the current season"; "scrollable to the top 200"; the
 * decision: docs/decisions/2026-11-25-ladder.md). `GET /api/ladder?mode=1v1` → core's `LadderAnswer`: the season, how many are on
 * the ladder, its top `LADDER.size` rows (one read on the index `ranked_1v1_board`, in order, and one batched read of their looks),
 * and your own standing (your exact place wherever it is, from the same count as the top tiers' place). The rows and the count are
 * the same for everyone, so the edge keeps them `LADDER.cacheSeconds`; your standing is read for you each time, never cached.
 * Left out of the list and the count: banned players, fair play's engine pool and test accounts (`LEFT_OUT`); residents are in.
 */

const PLACED = RANKED_1V1.placements.games;
/**
 * SQL (on `ranked_1v1 r`): a player on the ladder: placements done (the partial index's own WHERE, written the same, so the
 * planner uses it), a ladder, not left out.
 */
const ON_LADDER = `r.games >= ${PLACED} AND r.ladder IS NOT NULL AND r.user_id NOT IN ${LEFT_OUT}`;

/** The list's rows in ladder order (highest first, then by id, as the index holds them), at most LADDER.size. */
export const LADDER_ROWS_SQL = `SELECT r.user_id, r.ladder, r.games, r.wins, r.losses, r.draws, r.streak, u.name, u.email
  FROM ranked_1v1 r JOIN users u ON u.id = r.user_id
  WHERE ${ON_LADDER} ORDER BY r.ladder DESC, r.user_id DESC LIMIT ?`;

type Stored = { user_id: string; ladder: number; games: number; wins: number; losses: number; draws: number; streak: number | null };

/** A stored record as a row: its rank from core's rankView (the place decides the top tiers, as topPlace's would). */
const rowOf = (r: Stored, name: string, look: LadderRow["look"], place: number): LadderRow => ({
  uid: r.user_id,
  name: seatName(name, "Player"),
  look,
  place,
  rank: rankView({ games: r.games, ladder: r.ladder, place }),
  wins: r.wins,
  losses: r.losses,
  draws: r.draws,
  streak: r.streak ?? 0,
});

/**
 * The ladder's top: how many are on it (shownAbove: the count the places come from) and its first LADDER.size rows, each place
 * counted down the list (ties share; the same as placeOf's, since a ladder exists only once placements are done). Three reads at most:
 * the rows, the count, and the rows' looks (one batched read: locker.ts looksOf; an admin's admin copies as they wear them).
 */
export async function ladderTop(sql: Sql, admins: AdminCheck = NO_ADMINS): Promise<Pick<LadderAnswer, "total" | "rows">> {
  const [stored, count] = await Promise.all([sql.all<Stored & { name: string; email: string | null }>(LADDER_ROWS_SQL, LADDER.size), shownAbove(sql, null)]);
  const looks = await looksOf(
    sql,
    stored.map((r) => r.user_id),
    new Set(stored.filter((r) => admins(r)).map((r) => r.user_id)),
  );
  const places = ladderPlaces(stored.map((r) => r.ladder));
  return {
    // (Never fewer than the rows: the two reads aren't one transaction, and a game ending between them moves both.)
    total: Math.max(count, stored.length),
    rows: stored.map((r, i) => rowOf(r, r.name, looks.get(r.user_id) ?? {}, places[i]!)),
  };
}

/**
 * Your own standing: your row with your exact place (1 + the shown ladders above yours: placeOf, the top tiers' count), how far into
 * placements you are, or null with no account (and for a guest where online play needs signing in: "Sign in to join the ladder").
 * Left-out accounts get theirs too, counted the same way (the engine pool is quiet: its players see their place as ever).
 */
export async function ladderYou(sql: Sql, user: User | null, guestsMayPlay: boolean, admins: AdminCheck = NO_ADMINS): Promise<LadderYou> {
  if (!user) return null;
  const r = await sql.first<Stored>("SELECT user_id, ladder, games, wins, losses, draws, streak FROM ranked_1v1 WHERE user_id = ?", user.id);
  if (r && r.games >= PLACED && r.ladder !== null) {
    const [place, looks] = await Promise.all([placeOf(sql, r.ladder), looksOf(sql, [user.id], admins(user) ? new Set([user.id]) : new Set())]);
    return rowOf(r, user.name, looks.get(user.id) ?? {}, place);
  }
  if (!isSignedIn(user) && !guestsMayPlay) return null;
  return { placement: { played: Math.min(r?.games ?? 0, PLACED), of: PLACED } };
}

/** What the edge keeps of a mode's ladder (Workers' Cache API; a stand-in in tests). */
export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** The data center's cache (Workers' `caches.default`); none outside a Worker. */
const edgeCache = (): EdgeCache | null => (typeof caches !== "undefined" && "default" in caches ? (caches as unknown as { default: EdgeCache }).default : null);

/** The shape of the rows the edge keeps: a change to `LadderRow` bumps it, so a deploy never serves the old shape for its minute. */
const ROWS_VERSION = 1;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * `GET /api/ladder?mode=1v1` (null for any other path). The rows and count from the edge when it has them (kept LADDER.cacheSeconds,
 * keyed by mode, season and the rows' shape), else read and kept; your standing read for you. Any other mode: 404 (50 v 50 and Squads
 * have no ranks of their own yet; their tabs say so).
 */
export async function handleLadder(request: Request, env: AccountEnv & AdminEnv, waitUntil?: WaitUntil, cache: EdgeCache | null = edgeCache()): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/ladder") return null;
  if (request.method !== "GET") return json({ message: "Not found" }, 404);
  const mode = url.searchParams.get("mode") ?? "1v1";
  if (mode !== "1v1") return json({ message: "That mode has no ladder yet." }, 404);
  if (!env.DB) return json({ message: "The ladder isn't available here." }, 503);
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const admins: AdminCheck = (u) => isAdmin(env, u);
  const key = new Request(new URL(`/api/ladder/top?mode=${mode}&season=${LADDER.season}&v=${ROWS_VERSION}`, url.origin).toString());
  const top = async (): Promise<Pick<LadderAnswer, "total" | "rows">> => {
    const kept = await cache?.match(key).catch(() => undefined);
    if (kept) {
      const body = (await kept.json().catch(() => null)) as Pick<LadderAnswer, "total" | "rows"> | null;
      if (body && Array.isArray(body.rows)) return body;
    }
    const fresh = await ladderTop(sql, admins);
    if (cache) {
      const put = cache
        .put(key, new Response(JSON.stringify(fresh), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${LADDER.cacheSeconds}` } }))
        .catch(() => undefined);
      if (waitUntil) waitUntil(put);
      else await put;
    }
    return fresh;
  };
  const [rows, you] = await Promise.all([top(), userFromToken(sql, readCookie(request, SESSION_COOKIE), now).then((u) => ladderYou(sql, u, !signInRequired(env), admins))]);
  const answer: LadderAnswer = { season: LADDER.season, mode, ...rows, you };
  return json(answer);
}
