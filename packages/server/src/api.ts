import { deleteLockerItems, equipLocker, lockerState, openCrate } from "./locker.ts";
import { liveCounts, pruneLive, type LiveCounts } from "./live.ts";
import { liveHub, type LiveHub } from "./live-hub.ts";
import { cachedUserId, firstSighting, forgetToken, markSeen } from "./presence.ts";
import { REPORT_THANKS, appeal, fairStatus, reportPlayer } from "./fairplay.ts";
import { chatIconResponse, chatPostResponse, chatSlice } from "./global-chat-api.ts";
import {
  buyItem,
  cleanEmail,
  createGuest,
  createSession,
  d1Sql,
  endSession,
  ensureSchema,
  equipItem,
  profile,
  publicProfile,
  randomToken,
  recordResult,
  setChatPicks,
  shopState,
  signInWithIdentity,
  startEmailCode,
  touchSession,
  updateProfile,
  userFromToken,
  verifyEmailCode,
  type MatchResult,
  type Sql,
  type User,
} from "./accounts.ts";

/** What the account endpoints need from the Worker's environment (secrets are optional until set). */
export interface AccountEnv {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  /** Sender for sign-in codes, e.g. "HunChess <login@hunchess.com>". */
  EMAIL_FROM?: string;
  /** Seconds a matchmade lobby waits for players before bots fill it (the live line shows it). */
  MATCH_FILL_SECONDS?: string;
  /** The live hub (live-hub.ts): presence and the live line in memory. Without it, both go through D1 as before. */
  LIVE?: DurableObjectNamespace<LiveHub>;
}

/** Keeps background work (presence batches) running after the response: the Worker's or a Durable Object's. */
export type WaitUntil = (p: Promise<unknown>) => void;

/** How a request marks its account as seen: the live hub's batches where there is one, else D1 (userFromToken's default). */
export const presenceTouch = (env: AccountEnv, waitUntil?: WaitUntil) =>
  env.LIVE && waitUntil ? (userId: string) => markSeen(env as Required<Pick<AccountEnv, "LIVE">>, userId, Date.now(), waitUntil) : undefined;

/**
 * Values that may be a plain Worker variable or secret, or a binding to the account's Secrets Store: the sign-in
 * secrets, and fair play's admin emails and reviewer token (admin.ts).
 */
const SECRET_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "ADMIN_EMAILS", "FAIRPLAY_REVIEW_TOKEN"] as const;
let secretCache: { at: number; values: Partial<Record<(typeof SECRET_KEYS)[number], string>> } | null = null;
/** Forgets the cached secrets (tests that change them). */
export const forgetSecrets = () => void (secretCache = null);

/**
 * The secrets (SECRET_KEYS) as plain strings. Each can be a Worker variable or secret (already a string) or a binding
 * to the account's Secrets Store (read with `.get()`; see wrangler.jsonc). Store reads are cached for 5 minutes per
 * instance.
 */
export async function withSecrets<E extends object>(env: E): Promise<E & AccountEnv> {
  const now = Date.now();
  if (!secretCache || now - secretCache.at > 5 * 60_000) {
    const values: Partial<Record<(typeof SECRET_KEYS)[number], string>> = {};
    for (const k of SECRET_KEYS) {
      const v = (env as Record<string, unknown>)[k];
      if (typeof v === "string") values[k] = v;
      else if (v && typeof (v as { get?: unknown }).get === "function") {
        values[k] = await (v as { get(): Promise<string> }).get().catch(() => undefined);
      }
    }
    secretCache = { at: now, values };
  }
  return { ...env, ...secretCache.values };
}

export const SESSION_COOKIE = "hc_session";
/**
 * Fair play's coarse device marker: a random id in a cookie (not fingerprinting), recorded against the accounts that
 * play online from it, so a banned player's new account on the same device goes to review. Clearing cookies clears it.
 */
export const DEVICE_COOKIE = "hc_device";
const STATE_COOKIE = "hc_oauth";
const NEXT_COOKIE = "hc_next";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export function readCookie(request: Request, name: string): string | null {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]!) : null;
}
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const sessionCookie = (token: string) => cookie(SESSION_COOKIE, token, 365 * 86_400);

/** Online play needs a signed-in account once a way to sign in is set up (guests play solo against bots). */
export const signInRequired = (env: AccountEnv) => !!((env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) || env.RESEND_API_KEY);
export const isSignedIn = (user: User | null) => !!(user && (user.email || user.google_sub));
export const SIGN_IN_TO_PLAY = "Sign in to play online. Guests can play solo against bots.";

/** Where to go after signing in: a path on this site only. */
const safeNext = (next: string | null) => (next && /^\/(?!\/)[\w\-/]*$/.test(next) ? next : "/");

/** The account behind a request's session cookie (for the lobby server). */
export async function accountOf(request: Request, env: AccountEnv, waitUntil?: WaitUntil): Promise<User | null> {
  if (!env.DB) return null;
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  return userFromToken(sql, readCookie(request, SESSION_COOKIE), Date.now(), presenceTouch(env, waitUntil));
}

/** The live line's numbers, shared by every request to this Worker instance for a few seconds. */
let liveCache: { at: number; body: LiveCounts } | null = null;
let prunedAt = 0;
const LIVE_CACHE_MS = 3_000;

/** Handles /api/me, /api/results, /api/live, /api/profile/* and /api/auth/*; returns null for other paths. */
export async function handleAccountApi(request: Request, env: AccountEnv, fetcher: typeof fetch = fetch, waitUntil?: WaitUntil): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (
    !path.startsWith("/api/me") &&
    !path.startsWith("/api/auth/") &&
    path !== "/api/results" &&
    path !== "/api/live" &&
    path !== "/api/report" &&
    !path.startsWith("/api/profile/") &&
    !path.startsWith("/api/shop") &&
    !path.startsWith("/api/locker") &&
    path !== "/api/fairplay/status" &&
    path !== "/api/appeal" &&
    path !== "/api/chat" &&
    !path.startsWith("/api/chat/icon/")
  )
    return null;
  const google = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const email = !!env.RESEND_API_KEY;
  if (path === "/api/auth/config") return json({ accounts: !!env.DB, google, email, onlineNeedsSignIn: !!env.DB && signInRequired(env) });
  if (!env.DB) return json({ message: "Accounts aren't set up yet." }, 503);
  const sql: Sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const token = readCookie(request, SESSION_COOKIE);

  // GET /api/live: the live line (online, matches running, in queue, the playing-now list, typical waits). Polled by
  // the front door every few seconds and by matches every 30 s, so it also marks you as online.
  if (path === "/api/live" && request.method === "GET") {
    const touch = presenceTouch(env, waitUntil);
    if (touch) {
      // The live hub: presence in batches (the session lookup cached), the numbers from its memory.
      const uid = await cachedUserId(sql, token, now);
      if (uid && firstSighting(uid, now)) {
        // Just arrived: the hub hears at once, and its numbers (which include you) refresh this instance's.
        const counts = await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).arrive(uid, now).catch(() => null);
        if (counts) liveCache = { at: now, body: counts };
      } else if (uid) touch(uid);
    } else await touchSession(sql, token, now);
    if (!liveCache || now - liveCache.at > LIVE_CACHE_MS) {
      if (env.LIVE) liveCache = { at: now, body: await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).liveCounts() };
      else {
        if (now - prunedAt > 10 * 60_000) {
          prunedAt = now;
          await pruneLive(sql, now);
        }
        liveCache = { at: now, body: await liveCounts(sql, now) };
      }
    }
    // ?chat=N (the home page's global chat is open): its lines after N ride along (global-chat-api.ts).
    const chatSince = url.searchParams.get("chat");
    const chat = chatSince !== null && env.LIVE ? await chatSlice(liveHub(env as Required<Pick<AccountEnv, "LIVE">>), Number(chatSince), now).catch(() => null) : null;
    return json({ ...liveCache.body, fillSeconds: Math.max(3, Math.min(600, Number(env.MATCH_FILL_SECONDS ?? 60) || 60)), ...(chat ? { chat } : {}) });
  }

  // GET /api/chat/icon/KEY: a drawn icon on a line in the global chat (anyone may read the chat).
  if (path.startsWith("/api/chat/icon/") && request.method === "GET") {
    if (!env.LIVE) return json({ message: "No such icon." }, 404);
    return chatIconResponse(liveHub(env as Required<Pick<AccountEnv, "LIVE">>), path.slice("/api/chat/icon/".length));
  }

  // GET /api/profile/ID: anyone's public profile (what any player can see; nothing private).
  const pm = path.match(/^\/api\/profile\/([A-Za-z0-9_-]{1,64})$/);
  if (pm && request.method === "GET") {
    const p = await publicProfile(sql, pm[1]!, now);
    if (!p) return json({ message: "No such player." }, 404);
    // Online now, from the live hub (D1's last_seen is written once a minute).
    if (env.LIVE) {
      const live = await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).presence(p.id).catch(() => null);
      if (live?.lastSeen && live.lastSeen > (p.lastSeen ?? 0)) Object.assign(p, { lastSeen: live.lastSeen, online: live.online });
    }
    return json(p);
  }

  const current = await userFromToken(sql, token, now, presenceTouch(env, waitUntil));

  /** Switches the browser to `user` (a new session) and answers with `body` or a redirect. */
  const signInAs = async (user: User, redirect?: string) => {
    if (token && current?.id === user.id) return redirect ? Response.redirect(redirect, 302) : json(await profile(sql, user));
    if (token) await endSession(sql, token);
    const t = await createSession(sql, user.id, now);
    const headers = new Headers({ "set-cookie": sessionCookie(t), "cache-control": "no-store" });
    if (redirect) {
      headers.set("location", redirect);
      return new Response(null, { status: 302, headers });
    }
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(await profile(sql, user)), { status: 200, headers });
  };

  // GET /api/me: your profile (a guest account is made the first time). It also gives the device its marker.
  if (path === "/api/me" && request.method === "GET") {
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    if (!readCookie(request, DEVICE_COOKIE)) headers.append("set-cookie", cookie(DEVICE_COOKIE, randomToken(16), 400 * 86_400));
    if (current) return new Response(JSON.stringify(await profile(sql, current)), { headers });
    const g = await createGuest(sql, now, url.searchParams.get("name") ?? "Player");
    headers.append("set-cookie", sessionCookie(g.token));
    return new Response(JSON.stringify(await profile(sql, g.user)), { headers });
  }
  if (!current) return json({ message: "No account on this device yet." }, 401);

  // PATCH /api/me {name?, icon?}
  if (path === "/api/me" && request.method === "PATCH") {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; icon?: unknown };
    return json(await profile(sql, await updateProfile(sql, current.id, body)));
  }

  // The shop. GET /api/shop: your coins, items and what's equipped. POST /api/shop/buy {item}, /api/shop/equip {item}.
  if (path === "/api/shop" && request.method === "GET") return json(await shopState(sql, current.id));
  if ((path === "/api/shop/buy" || path === "/api/shop/equip") && request.method === "POST") {
    const { item } = (await request.json().catch(() => ({}))) as { item?: unknown };
    const r = path === "/api/shop/buy" ? await buyItem(sql, current.id, item, now) : await equipItem(sql, current.id, item);
    return r.ok ? json(r.shop) : json({ message: r.message }, 400);
  }
  // POST /api/shop/chat {lines?, emoji?}: the quick chat lines and emoji you see in your games (your profile's
  // "Quick chat and emoji"), in your order; null puts one back to the defaults. Answers with your shop.
  if (path === "/api/shop/chat" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { lines?: unknown; emoji?: unknown };
    return json(await setChatPicks(sql, current.id, b && typeof b === "object" ? b : {}));
  }

  // The locker. GET /api/locker; POST /api/locker/open {crate, fischer?, shiny?} (the test switches work only while
  // crates are free); POST /api/locker/equip {slot, item} (item null empties the slot); POST /api/locker/delete
  // {items} (deletes your crate items for good).
  if (path === "/api/locker" && request.method === "GET") return json(await lockerState(sql, current.id));
  if (path === "/api/locker/open" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { crate?: unknown; fischer?: unknown; shiny?: unknown };
    const r = await openCrate(sql, current.id, b.crate, { fischer: b.fischer === true, shiny: b.shiny === true }, now);
    return r.ok ? json(r) : json({ message: r.message }, 400);
  }
  if (path === "/api/locker/equip" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { slot?: unknown; item?: unknown };
    const r = await equipLocker(sql, current.id, b.slot, b.item ?? null);
    return r.ok ? json(r.locker) : json({ message: r.message }, 400);
  }
  if (path === "/api/locker/delete" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { items?: unknown };
    const r = await deleteLockerItems(sql, current.id, b.items);
    return r.ok ? json(r.locker) : json({ message: r.message }, 400);
  }

  // POST /api/report {target, reason, match?}: a report about a player (a profile's Report button; `match`: the lobby
  // code when made during a match). One per player per match (outside a match, one a day); see fairplay.ts.
  if (path === "/api/report" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { target?: unknown; reason?: unknown; match?: unknown };
    const r = await reportPlayer(sql, current, b.target, b.reason, b.match, now);
    if (!r.ok) return json({ message: r.message }, 400);
    const already = typeof b.match === "string" ? "You've already reported this player in this match." : "You've already reported this player today.";
    return json({ ok: true, ...(r.already ? { already: true } : {}), message: r.already ? already : REPORT_THANKS });
  }

  // GET /api/fairplay/status: banned or not, and your latest appeal (the ban notice). POST /api/appeal {text}.
  if (path === "/api/fairplay/status" && request.method === "GET") return json(await fairStatus(sql, current.id));
  if (path === "/api/appeal" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { text?: unknown };
    const r = await appeal(sql, current.id, b.text, now);
    return r.ok ? json({ ok: true, ...(await fairStatus(sql, current.id)) }) : json({ message: r.message }, 400);
  }

  // POST /api/chat {say}: a line in the home page's global chat (signed in where sign-in is set up; guests read).
  if (path === "/api/chat" && request.method === "POST") {
    if (!env.LIVE) return json({ message: "The chat isn't set up here." }, 503);
    return chatPostResponse(request, sql, liveHub(env as Required<Pick<AccountEnv, "LIVE">>), current, !signInRequired(env) || isSignedIn(current), now);
  }

  // POST /api/results: a solo match's result, from the browser.
  if (path === "/api/results" && request.method === "POST") {
    const b = (await request.json().catch(() => null)) as Partial<MatchResult> | null;
    if (!b || typeof b.placement !== "number" || typeof b.players !== "number") return json({ message: "Bad result" }, 400);
    await recordResult(sql, current.id, { ...b, online: false, mode: b.mode === "crowd" || b.mode === "boss" ? b.mode : "classic" } as MatchResult, now);
    return json({ ok: true });
  }

  // POST /api/auth/logout: a fresh guest account on this device.
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (token) {
      forgetToken(token);
      await endSession(sql, token);
    }
    const g = await createGuest(sql, now, "Player");
    return json(await profile(sql, g.user), 200, { "set-cookie": sessionCookie(g.token) });
  }

  // ---- Email: a 6-digit code ----
  if (path === "/api/auth/email/start" && request.method === "POST") {
    if (!email) return json({ message: "Email sign-in isn't set up yet." }, 503);
    const { email: raw } = (await request.json().catch(() => ({}))) as { email?: unknown };
    const address = cleanEmail(raw);
    if (!address) return json({ message: "That doesn't look like an email address." }, 400);
    const started = await startEmailCode(sql, address, now);
    if (!started.ok) return json({ message: started.message }, 429);
    const sent = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? "HunChess <login@hunchess.com>",
        to: [address],
        subject: `${started.code} is your HunChess code`,
        text: `Your HunChess sign-in code is ${started.code}. It works for 10 minutes. If you didn't ask for it, ignore this email.`,
        html: `<p>Your HunChess sign-in code is</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${started.code}</p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>`,
      }),
    });
    if (!sent.ok) return json({ message: "We couldn't send the email. Try again in a minute." }, 502);
    return json({ ok: true });
  }
  if (path === "/api/auth/email/verify" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
    const address = cleanEmail(b.email);
    if (!address || typeof b.code !== "string") return json({ message: "Enter the 6-digit code." }, 400);
    if (!(await verifyEmailCode(sql, address, b.code, now))) return json({ message: "That code didn't work. Check it, or send a new one." }, 400);
    return signInAs(await signInWithIdentity(sql, current, "email", address, {}, now));
  }

  // ---- Google ----
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  if (path === "/api/auth/google/start" && request.method === "GET") {
    if (!google) return json({ message: "Google sign-in isn't set up yet." }, 503);
    const state = randomToken(16);
    const q = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    const headers = new Headers({ location: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, "cache-control": "no-store" });
    headers.append("set-cookie", cookie(STATE_COOKIE, state, 600));
    headers.append("set-cookie", cookie(NEXT_COOKIE, safeNext(url.searchParams.get("next")), 600));
    return new Response(null, { status: 302, headers });
  }
  if (path === "/api/auth/google/callback" && request.method === "GET") {
    if (!google) return json({ message: "Google sign-in isn't set up yet." }, 503);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state || state !== readCookie(request, STATE_COOKIE) || !code) return Response.redirect(`${url.origin}/?signin=failed`, 302);
    const res = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!res.ok) return Response.redirect(`${url.origin}/?signin=failed`, 302);
    const { id_token } = (await res.json()) as { id_token?: string };
    // The token came straight from Google over TLS, so its claims can be read without checking the signature.
    const claims = id_token ? (JSON.parse(atob(id_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string; email_verified?: boolean; name?: string; aud?: string }) : null;
    if (!claims?.sub || claims.aud !== env.GOOGLE_CLIENT_ID) return Response.redirect(`${url.origin}/?signin=failed`, 302);
    const user = await signInWithIdentity(sql, current, "google", claims.sub, { email: claims.email_verified ? (claims.email ?? null) : null, name: claims.name ?? null }, now);
    return signInAs(user, `${url.origin}${safeNext(readCookie(request, NEXT_COOKIE))}?signin=google`);
  }

  return json({ message: "Not found" }, 404);
}
