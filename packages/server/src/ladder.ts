import { LADDER, RANKED_1V1, ladderPlaces, rankView, type LadderAnswer, type LadderMode, type LadderRow, type LadderYou } from "@chessroyale/core";
import { d1Sql, ensureSchema, userFromToken, type Sql, type User } from "./accounts.ts";
import { SESSION_COOKIE, isSignedIn, readCookie, signInRequired, type AccountEnv } from "./api.ts";
import { isAdmin, type AdminEnv } from "./admin.ts";
import { NO_ADMINS, looksOf, type AdminCheck } from "./locker.ts";
import { LEFT_OUT, placeOf, shownAbove } from "./ranked-schema.ts";
import { seatName } from "./text-filter.ts";

/**
 * The season ladder (Eric, Nov 25: "a ladder board for all rank modes for the current season"; "scrollable to the top 200"; the
 * decision: docs/decisions/2026-11-25-ladder.md). `GET /api/ladder?mode=1v1` → core's `LadderAnswer`: the season, how many are on
 * the ladder, its top `LADDER.size` rows (one read on the index `ranked_1v1_board`, in order, and one batched read of their looks),
 * and your own standing (your exact place wherever it is, from the same count as the top tiers' place). The rows and the count are
 * the same for everyone, so this Worker keeps them `LADDER.cacheSeconds`; your standing is read for you each time, never kept, and
 * your own row goes into your copy of the list fresh (`ladderFor`). Left out of the list and the count: banned players, players
 * under fair-play review, the engine pool and test accounts (`LEFT_OUT`); residents are in. A left-out viewer sees the ladder as ever.
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

/** Your standing, and whether the rankings leave you out (`LEFT_OUT`): read for the server's own use, never answered. */
export interface Standing {
  you: LadderYou;
  leftOut: boolean;
}

/**
 * Your own standing: your row with your exact place (1 + the shown ladders above yours: placeOf, the top tiers' count), how far into
 * placements you are, or null with no account (and for a guest where online play needs signing in: "Sign in to join the ladder").
 * Left-out accounts get theirs too, counted the same way (the engine pool is quiet: its players see their place as ever), and
 * `leftOut` says so, read in this same query (ladderFor puts them in their copy of the list).
 */
export async function ladderYou(sql: Sql, user: User | null, guestsMayPlay: boolean, admins: AdminCheck = NO_ADMINS): Promise<Standing> {
  if (!user) return { you: null, leftOut: false };
  const r = await sql.first<Stored & { left_out: number }>(
    `SELECT user_id, ladder, games, wins, losses, draws, streak, user_id IN ${LEFT_OUT} AS left_out FROM ranked_1v1 WHERE user_id = ?`,
    user.id,
  );
  if (r && r.games >= PLACED && r.ladder !== null) {
    const [place, looks] = await Promise.all([placeOf(sql, r.ladder), looksOf(sql, [user.id], admins(user) ? new Set([user.id]) : new Set())]);
    return { you: rowOf(r, user.name, looks.get(user.id) ?? {}, place), leftOut: r.left_out === 1 };
  }
  if (!isSignedIn(user) && !guestsMayPlay) return { you: null, leftOut: false };
  return { you: { placement: { played: Math.min(r?.games ?? 0, PLACED), of: PLACED } }, leftOut: false };
}

type Top = Pick<LadderAnswer, "total" | "rows">;

/** A shown row at another place: its rank counted again for it (a top tier goes by place), as the list would have read it. */
const movedTo = (r: LadderRow, place: number): LadderRow => ({ ...r, place, rank: rankView({ games: PLACED, ladder: r.rank.ladder, place }) });

/**
 * Your copy of the ladder (M1 and m4 of the Nov 25 review): the shared top (kept up to a minute, without left-out players) with your
 * own row in it fresh, so the list and your pinned row always agree and a left-out player's answer reads as an honest player's in the
 * same spot. Your kept row (if any) goes; your fresh row goes in ladder order (`ladder DESC, user_id DESC`, the list's own), or after
 * the last row when the list holds the whole ladder; every shown row you now rank above moves one place down and every one you ranked
 * above before moves one up (their ranks with them); `total` gains you when the shared count didn't hold you (left out, or new to a
 * ladder the list holds whole); then the list is cut to `LADDER.size`. Signed out, a guest, or in placements: the shared top as it is.
 */
export function ladderFor(top: Top, { you, leftOut }: Standing): Top {
  if (!you || "placement" in you) return top;
  const mine = you.rank.ladder!;
  const kept = top.rows.find((r) => r.uid === you.uid);
  const was = kept ? kept.rank.ladder! : null;
  const rows: LadderRow[] = [];
  let placed = false;
  for (const r of top.rows) {
    if (r.uid === you.uid) continue;
    const l = r.rank.ladder!;
    if (!placed && (l < mine || (l === mine && r.uid < you.uid))) {
      rows.push(you);
      placed = true;
    }
    const by = (mine > l ? 1 : 0) - (was !== null && was > l ? 1 : 0);
    rows.push(by ? movedTo(r, r.place + by) : r);
  }
  const whole = top.rows.length < LADDER.size;
  if (whole && !placed) rows.push(you);
  const counted = !leftOut && (kept !== undefined || !whole);
  return { total: top.total + (counted ? 0 : 1), rows: rows.slice(0, LADDER.size) };
}

/**
 * Each mode's shared top, kept `LADDER.cacheSeconds` in this Worker instance (as topPlace keeps a place): never a viewer's own row
 * (ladderFor makes each viewer's copy). Each instance reads it at most once a minute however busy; a deploy starts empty.
 */
const tops = new Map<LadderMode, { at: number; top: Top }>();
/** Forgets every kept top (tests). */
export const forgetLadderTops = () => tops.clear();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/**
 * `GET /api/ladder?mode=1v1` (null for any other path). The rows and count kept in this Worker (`tops`) or read and kept; your
 * standing read for you, and your copy of the list made with it (ladderFor). Any other mode: 404 (50 v 50 and Squads have no ranks of
 * their own yet; their tabs say so).
 */
export async function handleLadder(request: Request, env: AccountEnv & AdminEnv, now = Date.now()): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/ladder") return null;
  if (request.method !== "GET") return json({ message: "Not found" }, 404);
  const mode = url.searchParams.get("mode") ?? "1v1";
  if (mode !== "1v1") return json({ message: "That mode has no ladder yet." }, 404);
  if (!env.DB) return json({ message: "The ladder isn't available here." }, 503);
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const admins: AdminCheck = (u) => isAdmin(env, u);
  const top = async (): Promise<Top> => {
    const kept = tops.get(mode);
    if (kept && now - kept.at < LADDER.cacheSeconds * 1000) return kept.top;
    const fresh = await ladderTop(sql, admins);
    tops.set(mode, { at: now, top: fresh });
    return fresh;
  };
  const [shared, standing] = await Promise.all([top(), userFromToken(sql, readCookie(request, SESSION_COOKIE), now).then((u) => ladderYou(sql, u, !signInRequired(env), admins))]);
  const answer: LadderAnswer = { season: LADDER.season, mode, ...ladderFor(shared, standing), you: standing.you };
  return json(answer);
}
