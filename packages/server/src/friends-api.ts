import { FRIENDS, isGameCode, isInviteKind, pausedLine, type InviteKind } from "@chessroyale/core";
import { d1Sql, ensureSchema } from "./accounts.ts";
import { DEVICE_COOKIE, SESSION_COOKIE, accountOf, isSignedIn, readCookie, signInRequired, type AccountEnv, type WaitUntil } from "./api.ts";
import { cachedUserId } from "./presence.ts";
import { banCheck } from "./fairplay.ts";
import { banAnswer } from "./ban-gate.ts";
import {
  FRIEND_TEXT,
  answerRequest,
  areFriends,
  block,
  cancelRequest,
  crowdInviteOpen,
  dismissInvite,
  friendsOnline,
  friendsState,
  mayInvite,
  removeFriend,
  searchPlayers,
  sendInvite,
  sendRequest,
  setFriendSettings,
  unblock,
  type Done,
  type PresenceOf,
} from "./friends.ts";
import { liveHub } from "./live-hub.ts";
import { isPaused } from "./kill-switches.ts";
import type { Lobby } from "./lobby-do.ts";
import type { SquadsParty } from "./squads-do.ts";

/** What the friends API needs: accounts, the live hub, and the lobbies and parties an invite may point at. */
export interface FriendsEnv extends AccountEnv {
  LOBBIES?: DurableObjectNamespace<Lobby>;
  PARTIES?: DurableObjectNamespace<SquadsParty>;
  /** Friends' kill switch: "1" (or true, yes, on) switches friends and invites off for everyone. */
  PAUSE_FRIENDS?: string;
}

/** Friends and invites are on unless PAUSE_FRIENDS is set: the kill switches (kill-switches.ts). */
export function friendsOn(env: object): boolean {
  return !isPaused(env, "friends");
}

/** The kill switch's line, as every part's (pauses.ts). */
export const FRIENDS_OFF = pausedLine("friends");
export const SIGN_IN_FOR_FRIENDS = "Sign in to add friends and send invites.";
const GAME_GONE = "That lobby or party has started or closed.";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/**
 * GET /api/friends → { state } | { off } | { signIn }: your friends list (FriendsState, core/friends.ts).
 * GET /api/friends/online → { online: { [id]: { online, busy, doing? } } }: only who's online (a list's refresh on screen).
 * GET /api/friends/search?q=NAME → { players: PlayerSearchEntry[] }: players whose name starts with it (searchPlayers: public
 *   fields only; banned, test accounts and, where signing in is set up, guests left out). Its own rate limit (CAPACITY.rateLimits.search).
 * POST /api/friends/ACTION with JSON, each answering with the list as it is after it (or { message } and a status):
 *   request {id} · answer {id, accept} · cancel {id} · remove {id} · block {id} · unblock {id}
 *   invite {id, kind, code}: to your private lobby (kind: its mode) or Squads party ("squads"), still open, or your 50 v 50 party
 *     ("crowdparty": a member only, while it has room and isn't searching; its seat shows "…" until they answer);
 *     invite {id, check: true}: only whether they'd take one (asked before making a lobby or party for it)
 *   dismiss {id}: an invite to you (by who sent it; a 50 v 50 party's seat shows "+" again) · settings {invites?, showOnline?, dnd?}
 * Signed-in accounts only where signing in is set up; requests and invites not while banned. Rate limits: a burst
 * limit per account (limits.ts, CAPACITY.rateLimits.friends) and the daily and hourly caps (friends.ts, FRIENDS).
 */
export async function handleFriendsApi(request: Request, env: FriendsEnv, waitUntil: WaitUntil): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== "/api/friends" && !path.startsWith("/api/friends/")) return null;
  const get = request.method === "GET" && (path === "/api/friends" || path === "/api/friends/online" || path === "/api/friends/search");
  if (!get && request.method !== "POST") return json({ message: "Not found" }, 404);
  if (!env.DB) return json({ message: "Accounts aren't set up yet." }, 503);
  if (!friendsOn(env)) return get ? json({ off: true }) : json({ message: FRIENDS_OFF }, 503);
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const hub = env.LIVE ? liveHub(env as Required<Pick<AccountEnv, "LIVE">>) : null;
  const presenceOf: PresenceOf | undefined = hub ? (ids) => hub.presenceOf(ids) : undefined;
  // Who's online among your friends (a list on screen, once a minute): the session from this instance's cache (no D1
  // read, usually), one D1 read for the list, one hub call. (A guest has no friends, so it needs no sign-in check.)
  if (request.method === "GET" && path === "/api/friends/online") {
    const uid = await cachedUserId(sql, readCookie(request, SESSION_COOKIE), now);
    return uid ? json({ online: await friendsOnline(sql, uid, now, presenceOf) }) : json({ message: "No account on this device yet." }, 401);
  }
  const me = await accountOf(request, env, waitUntil);
  if (!me) return json({ message: "No account on this device yet." }, 401);
  const needSignIn = signInRequired(env);
  if (needSignIn && !isSignedIn(me)) return get ? json({ signIn: true }) : json({ message: SIGN_IN_FOR_FRIENDS }, 401);
  if (request.method === "GET" && path === "/api/friends/search") return json({ players: await searchPlayers(sql, me.id, url.searchParams.get("q") ?? "", needSignIn) });
  const answer = async () => json({ state: await friendsState(sql, me.id, now, presenceOf) });
  if (get) return answer();

  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const action = path.slice("/api/friends/".length);
  if (action === "settings") {
    await setFriendSettings(sql, me.id, body);
    return answer();
  }
  const id = isId(body.id) ? body.id : null;
  if (!id) return json({ message: "Bad request" }, 400);
  const banned = async () => (await banCheck(sql, me, readCookie(request, DEVICE_COOKIE), now).catch(() => ({ banned: false }))).banned;
  // Invites into a 50 v 50 party that went: each one's seat is a "+" again once no other invite into that party waits for them (two
  // members may have invited them: the fix round of #747, L3). In the background: a seat that lingers lapses with its invite anyway.
  const seatsBack = (gone: { to: string; code: string }[]) => {
    const parties = env.PARTIES;
    if (!parties || !gone.length) return;
    waitUntil(
      (async () => {
        for (const g of gone) if (!(await crowdInviteOpen(sql, g.to, g.code, now))) await parties.get(parties.idFromName(g.code)).crowdUninvited(g.to);
      })().catch(() => undefined),
    );
  };
  let done: Done;
  switch (action) {
    case "request":
      if (await banned()) return banAnswer(sql, readCookie(request, SESSION_COOKIE), me.id);
      done = await sendRequest(sql, me.id, id, needSignIn, now);
      break;
    case "answer":
      done = await answerRequest(sql, me.id, id, body.accept === true, now);
      break;
    case "cancel":
      done = await cancelRequest(sql, me.id, id);
      break;
    case "remove":
      done = await removeFriend(sql, me.id, id);
      break;
    case "block": {
      const out = await block(sql, me.id, id, now);
      // (Its invites between the two went: a 50 v 50 party's seat for them too. The party's door checks the invite again: L2.)
      if (out.ok && out.crowd) seatsBack(out.crowd);
      done = out;
      break;
    }
    case "unblock":
      done = await unblock(sql, me.id, id);
      break;
    case "dismiss": {
      const out = await dismissInvite(sql, me.id, id);
      // (A 50 v 50 party's: its seat is a "+" again, unless another member's invite into it still waits. A member already: nothing.)
      if (out.was?.kind === "crowdparty") seatsBack([{ to: me.id, code: out.was.code }]);
      done = out;
      break;
    }
    case "invite": {
      const { kind, code } = body;
      if (await banned()) return banAnswer(sql, readCookie(request, SESSION_COOKIE), me.id);
      // {check: true}: only whether they'd take it (before making a lobby or party to invite them into).
      if (body.check === true) {
        done = await mayInvite(sql, me.id, id, needSignIn, now);
        break;
      }
      if (!isInviteKind(kind) || !isGameCode(code)) return json({ message: "Bad request" }, 400);
      // (One invite from you to them at a time: one into another 50 v 50 party that this replaces goes, and so may its seat for them.)
      const was = await sql.first<{ code: string }>("SELECT code FROM invites WHERE from_id = ? AND to_id = ? AND kind = 'crowdparty' AND code <> ?", me.id, id, code);
      // A 50 v 50 party (Nov 16): friends only, by a member, while it has a seat for them; their seat shows "…" once it's sent.
      if (kind === "crowdparty") {
        // (Friends only, whatever the app offers: never a stranger by account through the API. The fix round of #747, M1.)
        if (!(await areFriends(sql, me.id, id))) return json({ message: FRIEND_TEXT.notTaking }, 403);
        const party = env.PARTIES?.get(env.PARTIES.idFromName(code));
        const may = party ? await party.crowdMayInvite(me.id, id).catch(() => ({ ok: false as const, message: GAME_GONE })) : { ok: true as const };
        if (!may.ok) return json({ message: may.message }, 409);
        done = await sendInvite(sql, me.id, id, kind, code, needSignIn, now);
        if (done.ok && was) seatsBack([{ to: id, code: was.code }]);
        if (done.ok && party) {
          const name = (await sql.first<{ name: string }>("SELECT name FROM users WHERE id = ?", id).catch(() => null))?.name ?? "Friend";
          await party.crowdInvited(me.id, id, name, now + FRIENDS.inviteMinutes * 60_000).catch(() => undefined);
        }
        break;
      }
      // Only to a private lobby still waiting for players, or a party still open (who's in it isn't checked: a code is
      // already an invite anyone can share). What it's for comes from the lobby itself, never the app.
      const target = await inviteTarget(env, kind, code);
      if (!target) return json({ message: GAME_GONE }, 409);
      done = await sendInvite(sql, me.id, id, target, code, needSignIn, now);
      if (done.ok && was) seatsBack([{ to: id, code: was.code }]);
      break;
    }
    default:
      return json({ message: "Not found" }, 404);
  }
  if (!done.ok) return json({ message: done.message }, done.status);
  // Their next live line says something's new, and their app fetches its list (presence.ts).
  if (done.notify?.length && hub) waitUntil(hub.notify(done.notify, now).catch(() => undefined));
  return answer();
}

/**
 * What an invite is for: "squads" for a Squads party still open; for a lobby, its own mode, if it's a private lobby
 * (not PLAY's queue) still waiting for players. Null: not open to an invite. (Without the bindings, unit tests: as asked.)
 */
async function inviteTarget(env: FriendsEnv, asked: InviteKind, code: string): Promise<InviteKind | null> {
  if (asked === "squads") return !env.PARTIES || (await env.PARTIES.get(env.PARTIES.idFromName(code)).status().catch(() => null)) ? "squads" : null;
  if (!env.LOBBIES) return asked;
  const s = await env.LOBBIES.get(env.LOBBIES.idFromName(code)).status().catch(() => null);
  return s && s.phase === "waiting" && !s.matchmade ? s.mode : null;
}
