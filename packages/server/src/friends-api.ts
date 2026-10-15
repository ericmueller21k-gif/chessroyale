import { isGameCode, isInviteKind } from "@chessroyale/core";
import { d1Sql, ensureSchema } from "./accounts.ts";
import { DEVICE_COOKIE, accountOf, isSignedIn, readCookie, signInRequired, type AccountEnv, type WaitUntil } from "./api.ts";
import { BANNED_MESSAGE, banCheck } from "./fairplay.ts";
import {
  answerRequest,
  block,
  cancelRequest,
  dismissInvite,
  friendsState,
  removeFriend,
  sendInvite,
  sendRequest,
  setFriendSettings,
  unblock,
  type Done,
  type PresenceOf,
} from "./friends.ts";
import { liveHub } from "./live-hub.ts";
import type { Lobby } from "./lobby-do.ts";
import type { SquadsParty } from "./squads-do.ts";

/** What the friends API needs: accounts, the live hub, and the lobbies and parties an invite may point at. */
export interface FriendsEnv extends AccountEnv {
  LOBBIES?: DurableObjectNamespace<Lobby>;
  PARTIES?: DurableObjectNamespace<SquadsParty>;
  /** Friends' kill switch: "1" (or true, yes, on) switches friends and invites off for everyone. */
  PAUSE_FRIENDS?: string;
}

/**
 * Friends and invites are on unless PAUSE_FRIENDS is set (the gates' kill switches: once kill-switches.ts is on main,
 * this becomes `!isPaused(env, "friends")`).
 */
export function friendsOn(env: { PAUSE_FRIENDS?: unknown }): boolean {
  const v = env.PAUSE_FRIENDS;
  return !(v === true || (typeof v === "string" && /^(1|true|yes|on)$/i.test(v.trim())));
}

export const FRIENDS_OFF = "Friends are switched off for now. Try again later.";
export const SIGN_IN_FOR_FRIENDS = "Sign in to add friends and send invites.";
const GAME_GONE = "That lobby or party has started or closed.";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/**
 * GET /api/friends → { state } | { off } | { signIn }: your friends list (FriendsState, core/friends.ts).
 * POST /api/friends/ACTION with JSON, each answering with the list as it is after it (or { message } and a status):
 *   request {id} · answer {id, accept} · cancel {id} · remove {id} · block {id} · unblock {id}
 *   invite {id, kind, code}: to your private lobby (kind: its mode) or Squads party ("squads"), still open
 *   dismiss {id}: an invite to you (by who sent it) · settings {invites?, showOnline?}
 * Signed-in accounts only where signing in is set up; requests and invites not while banned. Rate limits: a burst
 * limit per account (limits.ts, CAPACITY.rateLimits.friends) and the daily and hourly caps (friends.ts, FRIENDS).
 */
export async function handleFriendsApi(request: Request, env: FriendsEnv, waitUntil: WaitUntil): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== "/api/friends" && !path.startsWith("/api/friends/")) return null;
  const get = request.method === "GET" && path === "/api/friends";
  if (!get && request.method !== "POST") return json({ message: "Not found" }, 404);
  if (!env.DB) return json({ message: "Accounts aren't set up yet." }, 503);
  if (!friendsOn(env)) return get ? json({ off: true }) : json({ message: FRIENDS_OFF }, 503);
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const me = await accountOf(request, env, waitUntil);
  if (!me) return json({ message: "No account on this device yet." }, 401);
  const needSignIn = signInRequired(env);
  if (needSignIn && !isSignedIn(me)) return get ? json({ signIn: true }) : json({ message: SIGN_IN_FOR_FRIENDS }, 401);
  const now = Date.now();
  const hub = env.LIVE ? liveHub(env as Required<Pick<AccountEnv, "LIVE">>) : null;
  const presenceOf: PresenceOf | undefined = hub ? (ids) => hub.presenceOf(ids) : undefined;
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
  let done: Done;
  switch (action) {
    case "request":
      if (await banned()) return json({ message: BANNED_MESSAGE, banned: true }, 403);
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
    case "block":
      done = await block(sql, me.id, id, now);
      break;
    case "unblock":
      done = await unblock(sql, me.id, id);
      break;
    case "dismiss":
      done = await dismissInvite(sql, me.id, id);
      break;
    case "invite": {
      const { kind, code } = body;
      if (!isInviteKind(kind) || !isGameCode(code)) return json({ message: "Bad request" }, 400);
      if (await banned()) return json({ message: BANNED_MESSAGE, banned: true }, 403);
      // Only to a lobby still waiting for players, or a party still open (who's in it isn't checked: a code is
      // already an invite anyone can share).
      if (!(await gameOpen(env, kind === "squads", code))) return json({ message: GAME_GONE }, 409);
      done = await sendInvite(sql, me.id, id, kind, code, needSignIn, now);
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

/** A private lobby still waiting for players, or a Squads party still open (true without the bindings: unit tests). */
async function gameOpen(env: FriendsEnv, party: boolean, code: string): Promise<boolean> {
  if (party) return env.PARTIES ? !!(await env.PARTIES.get(env.PARTIES.idFromName(code)).status().catch(() => null)) : true;
  if (!env.LOBBIES) return true;
  const s = await env.LOBBIES.get(env.LOBBIES.idFromName(code)).status().catch(() => null);
  return s?.phase === "waiting";
}
