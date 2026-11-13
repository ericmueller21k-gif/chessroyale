import { deleteLockerItems, equipLocker, lockerState, openCrate, type AdminCheck } from "./locker.ts";
import { liveCounts, pruneLive, type LiveCounts } from "./live.ts";
import { liveHub, type LiveHub } from "./live-hub.ts";
import { cachedUserId, firstSighting, forgetToken, inboxOf, markSeen, rememberInbox } from "./presence.ts";
import { REPORT_THANKS, evasionAccount, reportPlayer, signInBan } from "./fairplay.ts";
import { banAnswer, banRedirect, refusalEnds } from "./ban-gate.ts";
import { NAME_NOT_ALLOWED, isBlockedText } from "./text-filter.ts";
import { chatNoticeSeen } from "./chat-mod.ts";
import { isAdmin, testSwitchesOn, type AdminEnv } from "./admin.ts";
import { isPaused, pausedBosses, pausedResponse } from "./kill-switches.ts";
import { battleToken, buyBossCrate, endSoloBattle, grantTestItems, openBossCrate, startSoloBattle } from "./boss-tokens.ts";
import { playClaw } from "./claw.ts";
import { grantWelcomeCrate, openWelcomeCrate, seenWelcomeNotice } from "./welcome.ts";
import { requestId } from "./ledger.ts";
import { pickBossCrate } from "./rewards.ts";
import { SOLO_TESTED, endSoloGame, gameXpOf, grantXp, setTestXp, startSoloGame } from "./xp.ts";
import { questsAnswer, rerollQuest, setTestQuests } from "./quests.ts";
import { chatIconResponse, chatPostResponse, chatSlice, globalRoomOf } from "./global-chat-api.ts";
import { forgetLook, townHereResponse } from "./town-here-api.ts";
import { hiddenRoomResponse } from "./hidden-room-api.ts";
import { enterOnly } from "./town-chat.ts";
import { SIGN_IN_TO_TOWN_CHAT, TOWN_CHAT_AGE, chatRoomOf, mayTownChat, reportedLine, townChallengeNote, townPostResponse, townRemoveResponse, townSlice } from "./town-chat-api.ts";
import { accountDownload, deleteAccount } from "./account-data.ts";
import { XP, AGE_GATE, HIDDEN_ROOM, AGE_STEP_LINE, FAIRPLAY, TOO_YOUNG_LINE, adminFirst, bossCrateDef, bossDef, cleanPawnColor, isActivity, isWelcomeCrate, tokenBossName } from "@chessroyale/core";
import {
  buyItem,
  cleanEmail,
  createGuest,
  createSession,
  d1Sql,
  endSession,
  ensureSchema,
  equipItem,
  markAgeOk,
  answeredSignIn,
  profile,
  publicProfile,
  randomToken,
  recordResult,
  resetNameAndIcon,
  setChatOn,
  setChatPicks,
  shopState,
  signInIfAnswered,
  signInWithIdentity,
  spendEmailCode,
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
/**
 * The age gate's answer on this device (docs/decisions/2026-10-16-age-gate-and-real-money.md): "ok" (old enough, for one
 * sign-in within AGE_GATE.answerMinutes) or "under" (too young, AGE_GATE.tooYoungDays, and no later answer replaces it).
 * Never the birth date: the app works the answer out and sends only that. HttpOnly, so the page can't clear it; the app
 * keeps "too young" in its storage too, and each puts the other back.
 */
export const AGE_COOKIE = "hc_age";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export function readCookie(request: Request, name: string): string | null {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]!) : null;
}
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const sessionCookie = (token: string) => cookie(SESSION_COOKIE, token, 365 * 86_400);

/**
 * This device's answer to the age question (AGE_COOKIE), or null if it hasn't answered (or its "ok" has run out). An
 * "under" anywhere in the request wins: a second hc_age (set by hand for another path, which the browser sends first)
 * can't hide it.
 */
export function ageAnswer(request: Request): "ok" | "under" | null {
  const values = [...(request.headers.get("cookie") ?? "").matchAll(new RegExp(`(?:^|;\\s*)${AGE_COOKIE}=([^;]*)`, "g"))].map((m) => m[1]!.trim());
  return values.includes("under") ? "under" : values.includes("ok") ? "ok" : null;
}
/**
 * An "old enough" answer, good for AGE_GATE.answerMinutes from now. Given again as a sign-in starts (an emailed code, a
 * trip to Google), so it can't run out halfway through one: a code lasts 10 minutes, Google's state cookie 10.
 */
const ageOk = () => cookie(AGE_COOKIE, "ok", AGE_GATE.answerMinutes * 60);
/**
 * Every sign-in step starts here (null: go ahead): a device that answered "too young" can't sign in at all, new account or not
 * (the email would be a child's), at any step. One that hasn't answered may start a sign-in (Eric, Nov 12: "log in without
 * having to select an age if you already have an account"); it finishes only into an account that has answered
 * (signInIfAnswered), else it's asked first (AGE_STEP_LINE): docs/decisions/2026-11-12-signin-without-age.md.
 */
function ageRefusal(request: Request): Response | null {
  return ageAnswer(request) === "under" ? json({ message: TOO_YOUNG_LINE, tooYoung: true }, 403) : null;
}
/** A sign-in that can't finish until this device answers the age question: nothing was made, moved or signed in. */
const askAgeFirst = () => json({ message: AGE_STEP_LINE, askAge: true }, 403);

/** Online play needs a signed-in account once a way to sign in is set up (guests play solo against bots). */
export const signInRequired = (env: AccountEnv) => !!((env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) || env.RESEND_API_KEY);
export const isSignedIn = (user: User | null) => !!(user && (user.email || user.google_sub));
export const SIGN_IN_TO_PLAY = "Sign in to play online. Guests can play solo against bots.";
/** A guest's answer from the quests' routes, where sign-in is set up (Nov 9, phase 3). */
export const SIGN_IN_FOR_QUESTS = "Sign in for quests.";

/** Where to go after signing in: a path on this site only. */
const safeNext = (next: string | null) => (next && /^\/(?!\/)[\w\-/]*$/.test(next) ? next : "/");

/** The account behind a request's session cookie (for the lobby server). */
export async function accountOf(request: Request, env: AccountEnv, waitUntil?: WaitUntil): Promise<User | null> {
  if (!env.DB) return null;
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  return userFromToken(sql, readCookie(request, SESSION_COOKIE), Date.now(), presenceTouch(env, waitUntil));
}

/** A time as its day only (noon UTC that day), for a profile that hides when its player is online. */
export const dayOf = (at: number) => Math.floor(at / 86_400_000) * 86_400_000 + 43_200_000;

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
    path !== "/api/chat" &&
    path !== "/api/chat/notice" &&
    !path.startsWith("/api/chat/icon/") &&
    path !== "/api/town/chat" &&
    path !== "/api/town/chat/remove" &&
    path !== "/api/town/here" &&
    path !== "/api/town/hidden" &&
    path !== "/api/boss/solo/start" &&
    path !== "/api/boss/solo/finish" &&
    path !== "/api/boss/token" &&
    !path.startsWith("/api/xp") &&
    path !== "/api/quests" &&
    !path.startsWith("/api/quests/")
  )
    return null;
  const google = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const email = !!env.RESEND_API_KEY;
  // (`testSwitches`: TEST_SWITCHES is on here, so the app honors its test switches for everyone: local, e2e, staging.
  // `age`: this device's answer to the age question, once it has one.)
  if (path === "/api/auth/config") {
    const age = ageAnswer(request);
    return json({
      accounts: !!env.DB,
      google,
      email,
      onlineNeedsSignIn: !!env.DB && signInRequired(env),
      ...((env as AdminEnv).TEST_SWITCHES === "1" ? { testSwitches: true } : {}),
      ...(age ? { age } : {}),
    });
  }
  if (!env.DB) return json({ message: "Accounts aren't set up yet." }, 503);
  const sql: Sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const token = readCookie(request, SESSION_COOKIE);
  // Who's an admin (ADMIN_EMAILS): an admin owns one of every item, never stored (core/admin-copies.ts), so the profile,
  // shop and locker answers carry their admin copies, and others see the ones they wear.
  const admins: AdminCheck = (u) => isAdmin(env as AdminEnv, u);
  // (Ranked's leave rules on the profile, L1: none while PAUSE_LEAVE_PENALTIES is on.)
  const leaves = { leaves: !isPaused(env, "leave-penalties") };

  // GET /api/live: the live line (online, matches running, in queue, the playing-now list, typical waits). Polled by
  // the front door every few seconds and by matches every 30 s, so it also marks you as online.
  if (path === "/api/live" && request.method === "GET") {
    // ?busy=1: the app is in a match (friends lists show "In a match"). `inbox`: friends' news for you (presence.ts).
    const busy = url.searchParams.get("busy") === "1";
    // ?doing=town: what the app is doing (the friends page's "In Chess Town"; core's ACTIVITIES, anything else ignored).
    const doingAsked = url.searchParams.get("doing");
    const doing = isActivity(doingAsked) ? doingAsked : undefined;
    let inbox: number | undefined;
    if (env.LIVE && waitUntil) {
      // The live hub: presence in batches (the session lookup cached), the numbers from its memory.
      const uid = await cachedUserId(sql, token, now);
      if (uid && firstSighting(uid, now)) {
        // Just arrived: the hub hears at once, and its numbers (which include you) refresh this instance's.
        // (Typed as sent: RPC's types widen the votes' [SAN, count] pairs to plain arrays.)
        const counts = (await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).arrive(uid, now, busy, doing).catch(() => null)) as (LiveCounts & { inbox?: number }) | null;
        if (counts) {
          const { inbox: news, ...numbers } = counts;
          if (news) rememberInbox(uid, news);
          liveCache = { at: now, body: numbers };
        }
      } else if (uid) markSeen(env as Required<Pick<AccountEnv, "LIVE">>, uid, now, waitUntil, busy, doing);
      if (uid) inbox = inboxOf(uid);
    } else await touchSession(sql, token, now);
    if (!liveCache || now - liveCache.at > LIVE_CACHE_MS) {
      if (env.LIVE) liveCache = { at: now, body: (await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).liveCounts()) as LiveCounts };
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
    const chat =
      chatSince !== null && env.LIVE
        ? await chatSlice(liveHub(env as Required<Pick<AccountEnv, "LIVE">>), Number(chatSince), now, {
            room: globalRoomOf(url.searchParams.get("chatroom"), (env as AdminEnv).TEST_SWITCHES === "1"),
            typed: ageAnswer(request) !== "under",
          }).catch(() => null)
        : null;
    // ?town=N (the town square is open): the town chat's lines after N, for anyone (a guest reads it too: Eric, on #542, "they
    // should be able to see the chat. They just can't type in it"); on a device the age gate marked too young, only the server's
    // "Ann has entered the town." lines (Nov 12: no one's typed words: town-chat.ts `enterOnly`); while its switch is off, only that
    // it's paused. Sending stays signed-in only (townPostResponse).
    const townSince = url.searchParams.get("town");
    let town: unknown = null;
    if (townSince !== null && env.LIVE) {
      const young = ageAnswer(request) === "under";
      town = isPaused(env, "town-chat", now)
        ? { paused: true }
        : await townSlice(liveHub(env as Required<Pick<AccountEnv, "LIVE">>), Number(townSince), now, url.searchParams.get("room"), waitUntil, chatRoomOf(url.searchParams.get("townroom"), (env as AdminEnv).TEST_SWITCHES === "1"))
            .then((t) => (young ? enterOnly(t) : t))
            .catch(() => null);
    }
    return json({
      ...liveCache.body,
      fillSeconds: Math.max(3, Math.min(600, Number(env.MATCH_FILL_SECONDS ?? 60) || 60)),
      ...(chat ? { chat } : {}),
      ...(town ? { town } : {}),
      ...(inbox ? { inbox } : {}),
    });
  }

  // POST /api/town/here: a device in the town square says where its player is (or that it left); the answer is everyone else
  // there, each with their "zzz" (town-here-api.ts; the away rule, TOWN_AFK). No session lookup past the cached ones.
  if (path === "/api/town/here" && request.method === "POST") {
    if (!env.LIVE) return json({ others: [] });
    return townHereResponse(request, sql, liveHub(env as Required<Pick<AccountEnv, "LIVE">>), { token, tooYoung: ageAnswer(request) === "under", testSwitches: (env as AdminEnv).TEST_SWITCHES === "1", admin: (email) => isAdmin(env as AdminEnv, { email }) }, now);
  }

  // POST /api/town/hidden: a device at the Hidden Boss's room in the town (hidden-room-api.ts: the room's four, its request, the start
  // of his fight; "Fill with 3 bots" for admins only). No session lookup past the cached ones.
  if (path === "/api/town/hidden" && request.method === "POST") {
    if (!env.LIVE) return json({ message: "The town isn't set up here." }, 503);
    return hiddenRoomResponse(request, sql, liveHub(env as Required<Pick<AccountEnv, "LIVE">>), { token, device: readCookie(request, DEVICE_COOKIE), tooYoung: ageAnswer(request) === "under", testSwitches: (env as AdminEnv).TEST_SWITCHES === "1", admin: (email) => isAdmin(env as AdminEnv, { email }), paused: isPaused(env, "raid", now) ? "raid" : isPaused(env, `boss:${HIDDEN_ROOM.boss}`, now) ? `boss:${HIDDEN_ROOM.boss}` : null }, now);
  }

  // GET /api/chat/icon/KEY: a drawn icon on a line in the global chat (anyone may read the chat).
  if (path.startsWith("/api/chat/icon/") && request.method === "GET") {
    if (!env.LIVE) return json({ message: "No such icon." }, 404);
    return chatIconResponse(liveHub(env as Required<Pick<AccountEnv, "LIVE">>), path.slice("/api/chat/icon/".length));
  }

  // GET /api/profile/ID: anyone's public profile (what any player can see; nothing private).
  const pm = path.match(/^\/api\/profile\/([A-Za-z0-9_-]{1,64})$/);
  if (pm && request.method === "GET") {
    const p = await publicProfile(sql, pm[1]!, now, admins);
    if (!p) return json({ message: "No such player." }, 404);
    // Hiding when you're online hides when you played too: others get each recent match's day, not its time (you get
    // yours exact: "See your result" finds a match by it). The session from this instance's cache, usually no D1 read.
    if (p.hidden && (await cachedUserId(sql, token, now).catch(() => null)) !== p.id) {
      for (const r of p.recent) r.playedAt = dayOf(r.playedAt);
    }
    // Online now, from the live hub (D1's last_seen is written once a minute); never for someone who hides it.
    if (env.LIVE && !p.hidden) {
      const live = await liveHub(env as Required<Pick<AccountEnv, "LIVE">>).presence(p.id).catch(() => null);
      if (live?.lastSeen && live.lastSeen > (p.lastSeen ?? 0)) Object.assign(p, { lastSeen: live.lastSeen, online: live.online });
    }
    return json(p);
  }

  const current = await userFromToken(sql, token, now, presenceTouch(env, waitUntil));
  const admin = isAdmin(env as AdminEnv, current);

  /**
   * Switches the browser to `user` (a new session) and answers with `body` or a redirect. Every sign-in comes through
   * the age gate: either this device `answered` "old enough" just before (the account keeps that its holder said so, and the
   * answer is used up, so a sign-in into an account that hasn't answered asks again), or the account had answered already
   * (signInIfAnswered).
   */
  const signInAs = async (user: User, answered: boolean, redirect?: string) => {
    const headers = new Headers({ "cache-control": "no-store" });
    if (answered) {
      await markAgeOk(sql, user.id, now);
      headers.append("set-cookie", cookie(AGE_COOKIE, "", 0));
    }
    if (!token || current?.id !== user.id) {
      if (token) await endSession(sql, token);
      headers.append("set-cookie", sessionCookie(await createSession(sql, user.id, now)));
    }
    if (redirect) {
      headers.set("location", redirect);
      return new Response(null, { status: 302, headers });
    }
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(await profile(sql, user, admins, leaves)), { status: 200, headers });
  };

  // GET /api/me: your profile (a guest account is made the first time). It also gives the device its marker.
  if (path === "/api/me" && request.method === "GET") {
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    if (!readCookie(request, DEVICE_COOKIE)) headers.append("set-cookie", cookie(DEVICE_COOKIE, randomToken(16), 400 * 86_400));
    // (Admins, ADMIN_EMAILS as for the fair-play review, also see the boss battle's test trigger.)
    if (current) return new Response(JSON.stringify({ ...(await profile(sql, current, admins, leaves)), ...(admin ? { admin: true } : {}) }), { headers });
    // (A device that answered "too young" plays under the default name.)
    const g = await createGuest(sql, now, ageAnswer(request) === "under" ? "Player" : (url.searchParams.get("name") ?? "Player"));
    headers.append("set-cookie", sessionCookie(g.token));
    return new Response(JSON.stringify(await profile(sql, g.user, admins, leaves)), { headers });
  }
  // ---- Signing in: the age question, an emailed code, Google. These run without a session too (Nov 13): a browser the ban gate marked
  // banned has none, and anyone else may still sign in on it (a shared device: the review of #687, M1; ban-gate.ts SIGN_IN_ROUTES). ----

  // A sign-in refused for a ban (Eric, Nov 13: signInBan) ends this browser's session only if it's the banned account's own or a guest's
  // (the one signing in); another account signed in here stays signed in (a shared device: ban-gate.ts refusalEnds).
  const endOnRefusal = (banned: string) => refusalEnds(token, current, banned);

  // POST /api/auth/age {oldEnough}: the age question's answer, asked before any sign-in (the app works it out from the
  // birth month and year and sends only this; the date never leaves the device). Old enough: this device may sign in
  // once within AGE_GATE.answerMinutes. Too young: for AGE_GATE.tooYoungDays this device can't sign in, a later answer
  // doesn't change that, and its guest goes back to the default name and icon. From this site's own page, as JSON.
  if (path === "/api/auth/age" && request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) return json({ message: "Not from here." }, 403);
    if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return json({ message: "Send JSON." }, 415);
    const b = (await request.json().catch(() => ({}))) as { oldEnough?: unknown };
    if (typeof b?.oldEnough !== "boolean") return json({ message: "Answer the question." }, 400);
    if (b.oldEnough && ageAnswer(request) !== "under") return json({ age: "ok" }, 200, { "set-cookie": ageOk() });
    if (current && !isSignedIn(current)) await resetNameAndIcon(sql, current.id);
    return json({ age: "under" }, 200, { "set-cookie": cookie(AGE_COOKIE, "under", AGE_GATE.tooYoungDays * 86_400) });
  }

  // ---- Email: a 6-digit code (no email is taken from a device that answered "too young"; one that hasn't answered is asked once
  // the code shows whose email it is, unless that account has answered). From this site's own page, as JSON (as the age question:
  // the review of #687, minor 2). ----
  if (path === "/api/auth/email/start" && request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) return json({ message: "Not from here." }, 403);
    if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return json({ message: "Send JSON." }, 415);
    if (!email) return json({ message: "Email sign-in isn't set up yet." }, 503);
    const tooYoung = ageRefusal(request);
    if (tooYoung) return tooYoung;
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
    // (An answer starts its time again, so it outlasts the code.)
    return json({ ok: true }, 200, ageAnswer(request) === "ok" ? { "set-cookie": ageOk() } : {});
  }
  if (path === "/api/auth/email/verify" && request.method === "POST") {
    if (request.headers.get("origin") !== url.origin) return json({ message: "Not from here." }, 403);
    if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return json({ message: "Send JSON." }, 415);
    const tooYoung = ageRefusal(request);
    if (tooYoung) return tooYoung;
    const b = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
    const address = cleanEmail(b.email);
    if (!address || typeof b.code !== "string") return json({ message: "Enter the 6-digit code." }, 400);
    // Whether it can finish now: this device just answered "old enough", or the account it lands on has. Read before the code is
    // checked, so a right code is used up only by a check that signs in; one that must ask first keeps it live, and the app sends it
    // again with the answer (no new code). The answer is the same for a wrong code either way.
    const answered = ageAnswer(request) === "ok";
    const finish = answered || (await answeredSignIn(sql, current, "email", address));
    if (!(await verifyEmailCode(sql, address, b.code, now, !finish))) return json({ message: "That code didn't work. Check it, or send a new one." }, 400);
    // A ban means you can't sign in (Eric, Nov 13): once the code shows the address is theirs, a banned account (or ban evasion:
    // signInBan) gets the ban answer and nothing else: no session for it, this browser marked (ban-gate.ts), the code spent (so one
    // code can't be refused again and again). An account that exists is refused before the age question; an address new to us that's
    // a banned account's makes its own account, banned by evasion, once it can finish (the age question first, as for any new account).
    const ban = await signInBan(sql, "email", address, null, now);
    const refuse = async (id: string) => {
      await spendEmailCode(sql, address);
      return banAnswer(sql, endOnRefusal(id), id);
    };
    if (ban && "banned" in ban) return refuse(ban.banned);
    if (!finish) return askAgeFirst();
    if (ban) return refuse(await evasionAccount(sql, "email", address, {}, ban, answered, now));
    const user = answered ? await signInWithIdentity(sql, current, "email", address, {}, now) : await signInIfAnswered(sql, current, "email", address, {}, now);
    // (The account went between the two reads: asked first, and the code's used: the finish fails and the player sends a new code.)
    return user ? signInAs(user, answered) : askAgeFirst();
  }

  // ---- Google (behind the age gate too: a device that's too young goes back to the page; one that hasn't answered is asked when it
  // comes back, unless the Google account's own account has answered) ----
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  if (path === "/api/auth/google/start" && request.method === "GET") {
    if (!google) return json({ message: "Google sign-in isn't set up yet." }, 503);
    // (?signin=age: the app shows the friendly line to a device that's too young.)
    if (ageRefusal(request)) return Response.redirect(`${url.origin}${safeNext(url.searchParams.get("next"))}?signin=age`, 302);
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
    // (An answer starts its time again, so it outlasts the trip to Google.)
    if (ageAnswer(request) === "ok") headers.append("set-cookie", ageOk());
    return new Response(null, { status: 302, headers });
  }
  if (path === "/api/auth/google/callback" && request.method === "GET") {
    if (!google) return json({ message: "Google sign-in isn't set up yet." }, 503);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state || state !== readCookie(request, STATE_COOKIE) || !code || ageRefusal(request)) return Response.redirect(`${url.origin}/?signin=failed`, 302);
    const res = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!res.ok) return Response.redirect(`${url.origin}/?signin=failed`, 302);
    const { id_token } = (await res.json()) as { id_token?: string };
    // The token came straight from Google over TLS, so its claims can be read without checking the signature.
    const claims = id_token ? (JSON.parse(atob(id_token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; email?: string; email_verified?: boolean; aud?: string }) : null;
    if (!claims?.sub || claims.aud !== env.GOOGLE_CLIENT_ID) return Response.redirect(`${url.origin}/?signin=failed`, 302);
    const answered = ageAnswer(request) === "ok";
    const extra = { email: claims.email_verified ? (claims.email ?? null) : null };
    const back = `${url.origin}${safeNext(readCookie(request, NEXT_COOKIE))}`;
    // A ban means you can't sign in (Eric, Nov 13): back to the page with no session for it, this browser marked; the app's first
    // request there shows the ban screen (ban-gate.ts). As for the emailed code: an account that exists is refused before the age
    // question; a Google account new to us that's a banned account's (or brings its address) makes its own account, banned by evasion,
    // once it can finish.
    const ban = await signInBan(sql, "google", claims.sub, extra.email, now);
    const refuse = async (id: string) => {
      const refused = await banRedirect(sql, endOnRefusal(id), id, `${back}?signin=banned`);
      refused.headers.append("set-cookie", cookie(STATE_COOKIE, "", 0));
      refused.headers.append("set-cookie", cookie(NEXT_COOKIE, "", 0));
      return refused;
    };
    if (ban && "banned" in ban) return refuse(ban.banned);
    if (ban && (answered || (await answeredSignIn(sql, current, "google", claims.sub)))) return refuse(await evasionAccount(sql, "google", claims.sub, extra, ban, answered, now));
    const user = ban ? null : answered ? await signInWithIdentity(sql, current, "google", claims.sub, extra, now) : await signInIfAnswered(sql, current, "google", claims.sub, extra, now);
    if (!user) {
      // Asked first (?signin=age-google): nothing was made or kept, not even who the Google account is. After the answer the app
      // goes to Google again (one more pick of the account), and this time the callback finishes. This trip's state is spent.
      const headers = new Headers({ location: `${back}?signin=age-google`, "cache-control": "no-store" });
      headers.append("set-cookie", cookie(STATE_COOKIE, "", 0));
      headers.append("set-cookie", cookie(NEXT_COOKIE, "", 0));
      return new Response(null, { status: 302, headers });
    }
    return signInAs(user, answered, `${back}?signin=google`);
  }

  if (!current) return json({ message: "No account on this device yet." }, 401);

  // PATCH /api/me {name?, icon?, pawn?, chatOn?}. Not from a guest on a device that answered "too young": it keeps the default name and
  // icon. (Someone signed in there, say in a tab opened before the answer, still may.) `pawn`: "white" or "black" (the default
  // pawn color, pawn-color.ts); the town's next look of you is read again then, not after its minute. `chatOn` (the chat's opt-in,
  // Nov 7) is kept for a signed-in account only: a guest's stays on its device.
  if (path === "/api/me" && request.method === "PATCH") {
    if (ageAnswer(request) === "under" && !isSignedIn(current)) return json({ message: "Guests play under the default name and icon." }, 403);
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; icon?: unknown; pawn?: unknown; chatOn?: unknown };
    // (A name with a slur or a hate term in it: text-filter.ts.)
    if (typeof body.name === "string" && isBlockedText(String(body.name).slice(0, 64))) return json({ message: NAME_NOT_ALLOWED }, 400);
    if (body.pawn !== undefined && cleanPawnColor(body.pawn) === null) return json({ message: "Pick white or black." }, 400);
    if (typeof body.chatOn === "boolean" && isSignedIn(current)) await setChatOn(sql, current.id, body.chatOn);
    const updated = await updateProfile(sql, current.id, body);
    if (body.pawn !== undefined) forgetLook(current.id);
    return json(await profile(sql, updated, admins, leaves));
  }

  // GET /api/me/data: "Download my data" (Settings), everything kept about your account as a JSON file, the global
  // chat's lines (the live hub's) included. See account-data.ts.
  if (path === "/api/me/data" && request.method === "GET") {
    const hub = env.LIVE
      ? await liveHub(env as Required<Pick<AccountEnv, "LIVE">>)
          .accountData(current.id)
          .catch((e: unknown) => void console.error(`download: the live hub's part is missing (${String(e)})`))
      : null;
    const body = await accountDownload(sql, current, now, hub ? { globalChat: hub.globalChat } : {});
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="hunchess-data-${new Date(now).toISOString().slice(0, 10)}.json"`,
      },
    });
  }
  // POST /api/me/delete {confirm: "delete"}: "Delete account" (Settings, after a confirmation). Everything personal goes
  // (account-data.ts), every session with it (signed out on every device), and the live hub forgets the account
  // (online now, its global chat lines). The app then starts afresh as a new guest.
  if (path === "/api/me/delete" && request.method === "POST") {
    // Only from this site's own page, as JSON (a form from anywhere else can't send it), and only confirmed.
    if (request.headers.get("origin") !== url.origin) return json({ message: "Not from here." }, 403);
    if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return json({ message: "Send JSON." }, 415);
    const b = (await request.json().catch(() => ({}))) as { confirm?: unknown };
    if (b?.confirm !== "delete") return json({ message: "Confirm that you want to delete your account." }, 400);
    await deleteAccount(sql, current, now);
    if (token) forgetToken(token);
    if (env.LIVE) {
      await liveHub(env as Required<Pick<AccountEnv, "LIVE">>)
        .forgetAccount(current.id)
        .catch((e: unknown) => console.error(`account deleted, but the live hub kept its chat lines and presence (${String(e)})`));
    }
    return json({ ok: true }, 200, { "set-cookie": cookie(SESSION_COOKIE, "", 0) });
  }

  // The shop. GET /api/shop: your coins, items and what's equipped. POST /api/shop/buy {item}, /api/shop/equip {item}.
  if (path === "/api/shop" && request.method === "GET") return json(await shopState(sql, current.id, admin));
  // (The shop resting, a kill switch: nothing new from it. Equipping what you have still works.)
  if ((path === "/api/shop/buy" || path === "/api/locker/open" || path === "/api/shop/boss-crate" || path === "/api/shop/claw") && request.method === "POST" && isPaused(env, "shop")) return pausedResponse("shop");
  // POST /api/shop/claw {boss, request, seed?}: Boingo's claw machine (Nov 6; claw.ts, playClaw): one of the boss's tokens in, and a
  // chance (CLAW.winChance) at its Boss Crate, into your inventory unopened. The server rolls it now, in one transaction with the
  // token and the crate; `request` is the app's id for the play, so a retry answers the first play and spends nothing again.
  // Signed-in accounts only (a guest: refused, nothing spent). `seed` (the e2e's hook) only where TEST_SWITCHES is "1", never in
  // production and never an admin's. Answers {won, crate?, boss, again?, locker}.
  if (path === "/api/shop/claw" && request.method === "POST") {
    if (!isSignedIn(current)) return json({ message: "Sign in to play the claw machine." }, 403);
    const b = (await request.json().catch(() => ({}))) as { boss?: unknown; request?: unknown; seed?: unknown };
    const seed = (env as AdminEnv).TEST_SWITCHES === "1" && typeof b?.seed === "number" && Number.isInteger(b.seed) ? b.seed : undefined;
    const r = await playClaw(sql, current.id, b?.boss, b?.request, now, { admin, ...(seed !== undefined ? { seed } : {}) });
    return r.ok ? json(r) : json({ message: r.message }, 400);
  }
  // POST /api/shop/boss-crate {crate, way, request}: buys a boss's crate inside its shop, with 3 of the boss's tokens ("tokens") or a
  // token and a crate key ("key"), into your inventory, unopened (Nov 2): one transaction (boss-tokens.ts, buyBossCrate). Answers
  // {crate, locker}. (The Crates tab opens it: /api/locker/open.) `request`: the app's id for the buy (a retry buys it once).
  if (path === "/api/shop/boss-crate" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { crate?: unknown; way?: unknown; request?: unknown };
    const r = await buyBossCrate(sql, current.id, b?.crate, b?.way, now, admin, requestId(b?.request));
    return r.ok ? json(r) : json({ message: r.message }, 400);
  }
  if ((path === "/api/shop/buy" || path === "/api/shop/equip") && request.method === "POST") {
    const { item } = (await request.json().catch(() => ({}))) as { item?: unknown };
    const r = path === "/api/shop/buy" ? await buyItem(sql, current.id, item, now, admin) : await equipItem(sql, current.id, item, admin);
    return r.ok ? json(r.shop) : json({ message: r.message }, 400);
  }
  // POST /api/shop/chat {lines?, emoji?}: the quick chat lines and emoji you see in your games (your profile's
  // "Quick chat and emoji"), in your order; null puts one back to the defaults. Answers with your shop.
  if (path === "/api/shop/chat" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { lines?: unknown; emoji?: unknown };
    return json(await setChatPicks(sql, current.id, b && typeof b === "object" ? b : {}, admin));
  }

  // The locker. GET /api/locker; POST /api/locker/open {crate, request, fischer?, shiny?} (`request`: the app's id for the open, so a
  // retry opens it once; a series crate takes one you hold and a crate key, for everyone (Nov 9); the test switches ?fischer and ?shiny
  // only where TEST_SWITCHES is "1", never an admin's elsewhere (Eric, Nov 9: no admin special ability); a boss crate is one you hold,
  // opened once, never with a test switch: openBossCrate); POST /api/locker/pick {crate, request} (a level's boss crate picked:
  // rewards.ts); POST /api/locker/equip {slot, item} (item null empties the slot); POST /api/locker/delete {items} (deletes your crate
  // items for good).
  if (path === "/api/locker" && request.method === "GET") return json(await lockerState(sql, current.id, admin));
  if (path === "/api/locker/open" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { crate?: unknown; fischer?: unknown; shiny?: unknown; request?: unknown };
    const force = (env as AdminEnv).TEST_SWITCHES === "1" ? { fischer: b.fischer === true, shiny: b.shiny === true } : {};
    // (The Welcome Crate, Nov 6: yours once you've earned it, opened once, the server's roll only: welcome.ts.)
    if (isWelcomeCrate(b.crate)) {
      const w = await openWelcomeCrate(sql, current.id, now);
      return w.ok ? json({ ...w, locker: await lockerState(sql, current.id, admin) }) : json({ message: w.message }, 400);
    }
    const once = requestId(b.request);
    const r = typeof b.crate === "string" && bossCrateDef(b.crate) ? await openBossCrate(sql, current.id, b.crate, now, admin, once) : await openCrate(sql, current.id, b.crate, force, now, admin, once);
    return r.ok ? json(r) : json({ message: r.message }, 400);
  }
  if (path === "/api/locker/pick" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { crate?: unknown; request?: unknown };
    const r = await pickBossCrate(sql, current.id, b?.crate, requestId(b?.request), now);
    return r.ok ? json({ crate: r.crate, locker: await lockerState(sql, current.id, admin) }) : json({ message: r.message }, 400);
  }
  // POST /api/locker/welcome/seen: the "You earned a Welcome Crate!" notice closed, for good (it shows once). Answers the locker.
  if (path === "/api/locker/welcome/seen" && request.method === "POST") {
    await seenWelcomeNotice(sql, current.id, now);
    return json(await lockerState(sql, current.id, admin));
  }
  if (path === "/api/locker/equip" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { slot?: unknown; item?: unknown };
    const r = await equipLocker(sql, current.id, b.slot, b.item ?? null, admin);
    return r.ok ? json(r.locker) : json({ message: r.message }, 400);
  }
  // POST /api/locker/grant {keys?, boss?, tokens?, request}: an admin's test grant to their own account (crate keys, up to
  // BOSS_TOKENS.keysGrantMax (100) at once; a boss's tokens; once per request id); for anyone else it isn't there. Answers the locker.
  if (path === "/api/locker/grant" && request.method === "POST") {
    if (!admin) return json({ message: "Not found" }, 404);
    const b = (await request.json().catch(() => ({}))) as { keys?: unknown; boss?: unknown; tokens?: unknown; request?: unknown };
    const r = await grantTestItems(sql, current.id, b && typeof b === "object" ? b : {}, now);
    return r.ok ? json(await lockerState(sql, current.id, admin)) : json({ message: r.message }, 400);
  }
  if (path === "/api/locker/delete" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { items?: unknown };
    const r = await deleteLockerItems(sql, current.id, b.items, admin, now);
    return r.ok ? json(r.locker) : json({ message: r.message }, 400);
  }

  // POST /api/report {target, reason, match?}: a report about a player (a profile's Report button; `match`: the lobby
  // code when made during a match). One per player per match (outside a match, one a day); see fairplay.ts.
  if (path === "/api/report" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { target?: unknown; reason?: unknown; match?: unknown; line?: unknown; townroom?: unknown };
    // A line of the town's chat (`line`: its number): the words are read from the room, never taken from the request; only
    // someone who may read the town's chat can report a line of it (a guest or a young device can't probe who spoke).
    const chatReport = b.reason === FAIRPLAY.reports.chatReason;
    if (chatReport && (!mayTownChat(current) || ageAnswer(request) === "under")) return json({ message: mayTownChat(current) ? TOWN_CHAT_AGE : SIGN_IN_TO_TOWN_CHAT }, 403);
    const line = chatReport && env.LIVE ? await reportedLine(liveHub(env as Required<Pick<AccountEnv, "LIVE">>), b.line, b.target, chatRoomOf(b.townroom, (env as AdminEnv).TEST_SWITCHES === "1")) : null;
    const r = await reportPlayer(sql, current, b.target, b.reason, b.match, now, line);
    if (!r.ok) return json({ message: r.message }, 400);
    const already = typeof b.match === "string" ? "You've already reported this player in this match." : "You've already reported this player today.";
    return json({ ok: true, ...(r.already ? { already: true } : {}), message: r.already ? already : REPORT_THANKS });
  }

  // POST /api/chat/notice: the player has read the notice of a moderator's warning or chat ban (chat-mod.ts).
  if (path === "/api/chat/notice" && request.method === "POST") {
    await chatNoticeSeen(sql, current.id);
    return json({ ok: true });
  }

  // POST /api/chat {text | say}: a message in the global chat (signed in, chat on; guests read; a device the age gate marked too young
  // sends the preset lines only): global-chat-api.ts.
  if (path === "/api/chat" && request.method === "POST") {
    if (!env.LIVE) return json({ message: "The chat isn't set up here." }, 503);
    return chatPostResponse(request, sql, liveHub(env as Required<Pick<AccountEnv, "LIVE">>), { user: current, tooYoung: ageAnswer(request) === "under", testSwitches: (env as AdminEnv).TEST_SWITCHES === "1" }, now);
  }

  // POST /api/town/chat {text}: a message in the town square's chat (town-chat-api.ts: signed in, old enough, not banned,
  // not paused; the room checks the rest). POST /api/town/chat/remove {n}: a moderator takes a line out.
  if ((path === "/api/town/chat" || path === "/api/town/chat/remove") && request.method === "POST") {
    if (!env.LIVE) return json({ message: "The chat isn't set up here." }, 503);
    const hub = liveHub(env as Required<Pick<AccountEnv, "LIVE">>);
    if (path === "/api/town/chat/remove") return townRemoveResponse(request, hub, isAdmin(env as AdminEnv, current), now, waitUntil, (env as AdminEnv).TEST_SWITCHES === "1");
    return townPostResponse(request, sql, hub, { user: current, tooYoung: ageAnswer(request) === "under", paused: isPaused(env, "town-chat", now), testSwitches: (env as AdminEnv).TEST_SWITCHES === "1" }, now, waitUntil);
  }

  // Boss tokens (boss-tokens.ts). A solo boss battle is counted by the server's clock: POST /api/boss/solo/start as it begins
  // ({battle}: its id, or null when this account can't earn tokens), POST /api/boss/solo/finish {battle} on its result screen
  // ({counted, token}). An online battle's match room counts it; GET /api/boss/token?battle=CODE answers the token it dropped
  // you ({token}: a boss's id, or null).
  // A boss challenged from the town (Nov 2): its start carries {town: boss}, its finish {outcome: "won" | "lost" | "drew"} (none for
  // a resign); the server's line in the town's chat goes out from here (town-chat-api.ts townChallengeNote: the no-spam rule).
  if ((path === "/api/boss/solo/start" || path === "/api/boss/solo/finish") && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { battle?: unknown; town?: unknown; outcome?: unknown; moves?: unknown };
    const asker = { user: current, tooYoung: ageAnswer(request) === "under", paused: isPaused(env, "town-chat", now) };
    const note = (boss: string, n: Parameters<typeof townChallengeNote>[4]) =>
      env.LIVE ? townChallengeNote(sql, liveHub(env as Required<Pick<AccountEnv, "LIVE">>), asker, boss, n, now).catch(() => null) : null;
    if (path === "/api/boss/solo/start") {
      const battle = await startSoloBattle(sql, current.id, now, signInRequired(env));
      // (One game request at a time, Eric, Nov 12: a boss battle begun ends your place in the Hidden Boss's room's request. Off the
      // battle's critical path: after the answer, where the platform lets it run on; review m4.)
      if (env.LIVE) {
        const drop = liveHub(env as Required<Pick<AccountEnv, "LIVE">>).hiddenDrop(current.id).catch(() => undefined);
        if (waitUntil) waitUntil(drop);
        else await drop;
      }
      // (Not a boss in the game for admins first, Timber: everyone reads the town's chat, and only admins meet him. Nov 3.)
      if (typeof b?.town === "string" && bossDef(b.town) && !adminFirst(bossDef(b.town))) await note(b.town, { kind: "start", boss: b.town, battle });
      return json({ battle });
    }
    const done = await endSoloBattle(sql, current.id, b?.battle, now, { off: pausedBosses(env, now), signedInOnly: signInRequired(env) });
    // (The outcome and your moves are the device's word: a solo battle is played there. The token is the server's own drop.)
    const outcome = b?.outcome === "won" || b?.outcome === "lost" || b?.outcome === "drew" || b?.outcome === "surrendered" ? b.outcome : null;
    const moves = typeof b?.moves === "number" && Number.isInteger(b.moves) && b.moves >= 0 && b.moves <= 999 ? b.moves : null;
    if (done.ended && outcome) await note("", { kind: "finish", battle: b!.battle as string, outcome, moves, token: done.token ? tokenBossName(done.token) : null });
    const { ended: _ended, ...answer } = done;
    return json(answer);
  }
  if (path === "/api/boss/token" && request.method === "GET") return json({ token: await battleToken(sql, current.id, url.searchParams.get("battle"), now) });

  // XP (Nov 9; xp.ts). POST /api/xp/solo/start as any solo game begins ({game}: its id; the server notes the time); its result's POST
  // /api/results carries it back, and answers the game's XP. GET /api/xp?game=CODE: your XP from an online game, once its room has
  // written it ({xp}: null until then). POST /api/xp/test {xp} (test switches only): sets your XP, for tests and stills.
  if (path === "/api/xp/solo/start" && request.method === "POST") {
    const b = (await request.json().catch(() => ({}))) as { xpgame?: unknown } | null;
    // (?xpgame=MINUTES counts the game that long only where TEST_SWITCHES is "1" (local, e2e, staging). Anywhere else, an admin's
    // included, it's a test switch like the others: the game is a test game, no XP (SOLO_TESTED). Review m1, Nov 9.)
    const asked = typeof b?.xpgame === "number" && Number.isFinite(b.xpgame) && testSwitchesOn(env as AdminEnv, current);
    const minutes = !asked ? null : (env as AdminEnv).TEST_SWITCHES === "1" ? Math.max(0, Math.min(XP.maxMinutes, Math.floor(b!.xpgame as number))) : SOLO_TESTED;
    return json({ game: await startSoloGame(sql, current.id, now, minutes) });
  }
  if (path === "/api/xp" && request.method === "GET") return json({ xp: await gameXpOf(sql, current.id, url.searchParams.get("game"), now) });
  if (path === "/api/xp/test" && request.method === "POST") {
    // (Only where TEST_SWITCHES is "1" (local, e2e, staging), never an admin's on production: a jump there would be owed real level
    // rewards, crates, keys and boss picks. Review of #574, M1, Nov 9.)
    if ((env as AdminEnv).TEST_SWITCHES !== "1") return json({ message: "Not allowed" }, 403);
    const b = (await request.json().catch(() => ({}))) as { xp?: unknown } | null;
    const xp = await setTestXp(sql, current.id, b?.xp, now);
    return xp === null ? json({ message: "Bad XP" }, 400) : json({ xp });
  }

  // Quests (Nov 9, phase 3; quests.ts). GET /api/quests: your quests (the day's dealt first, on the day's first read), the resets and
  // each daily's reroll. POST /api/quests/reroll {quest}: that daily's free reroll today ({ok, quests} or a refusal). POST /api/quests/test {quests}
  // (test servers only): your quests set, for tests and stills. A guest where sign-in is set up has none ("Sign in for quests.").
  if (path === "/api/quests" || path.startsWith("/api/quests/")) {
    if (signInRequired(env) && !isSignedIn(current)) return json({ message: SIGN_IN_FOR_QUESTS }, 403);
    const paused = isPaused(env, "rewards", now);
    if (path === "/api/quests" && request.method === "GET") return json(await questsAnswer(sql, current.id, now, paused));
    if (path === "/api/quests/reroll" && request.method === "POST") {
      const b = (await request.json().catch(() => ({}))) as { quest?: unknown } | null;
      const done = await rerollQuest(sql, current.id, b?.quest, now);
      return done.ok ? json({ ok: true, quests: await questsAnswer(sql, current.id, now, paused) }) : json({ message: done.message }, 409);
    }
    if (path === "/api/quests/test" && request.method === "POST") {
      if ((env as AdminEnv).TEST_SWITCHES !== "1") return json({ message: "Not allowed" }, 403);
      const b = (await request.json().catch(() => ({}))) as { quests?: unknown } | null;
      return (await setTestQuests(sql, current.id, b?.quests, now)) ? json(await questsAnswer(sql, current.id, now, paused)) : json({ message: "Bad quests" }, 400);
    }
  }

  // POST /api/results: a solo match's result, from the browser. Its XP (Nov 9) is the server's: the time between the game's start
  // and now by the server's clock (`game`: its id from /api/xp/solo/start); the moves, the win, a resign, leaving (`left`: removed
  // for idling) and a test switch are the device's word, so they can only lower it. A result the server never timed (no `game`, or
  // one already ended) earns no XP at all; a win needs XP.soloWinMinMinutes of the server's time and is capped (XP.soloWinsPerDay
  // a day), and the time too (XP.soloMinutesPerDay a day). Review M1 and M2, Nov 9. Answers {ok, xp}.
  if (path === "/api/results" && request.method === "POST") {
    const b = (await request.json().catch(() => null)) as (Partial<MatchResult> & { game?: unknown; won?: unknown; resigned?: unknown; left?: unknown; test?: unknown }) | null;
    if (!b || typeof b.placement !== "number" || typeof b.players !== "number") return json({ message: "Bad result" }, 400);
    const timed = await endSoloGame(sql, current.id, b.game, now);
    // (An app from before XP sends no moves: NULL, as for every result from before.)
    const moves = typeof b.moves === "number" && Number.isFinite(b.moves) ? Math.max(0, Math.min(10_000, Math.round(b.moves))) : null;
    const tested = timed?.testMinutes === SOLO_TESTED;
    const forced = tested ? null : (timed?.testMinutes ?? null);
    const ms = forced !== null ? forced * 60_000 : (timed?.ms ?? 0);
    const xp = !timed
      ? null
      : await grantXp(sql, current.id, {
          key: `solo:${timed.id}`,
          facts: {
            ms,
            moves: forced !== null ? Math.max(moves ?? 0, XP.minMoves) : (moves ?? 0),
            won: b.won === true && ms >= XP.soloWinMinMinutes * 60_000,
            resigned: b.resigned === true,
            abandoned: b.left === true,
            test: tested || (forced === null && b.test === true),
          },
          cap: "solo",
          signedInOnly: signInRequired(env),
          now,
          paused: isPaused(env, "rewards", now),
          // (A solo Boss Battle moves the boss quests too, Nov 10: the device names the mode, as it does its moves and its win.)
          quest: b.mode === "boss" ? "soloBoss" : "solo",
        }).catch((e: unknown) => {
          console.log(`xp for a solo game: ${String(e)}`);
          return null;
        });
    const { game: _game, won: _won, resigned: _resigned, left: _left, test: _test, ...result } = b;
    // (`playMs`: the server's time, as XP counted it (a test server's ?xpgame minutes included); none for a game it never timed. The
    // Welcome Crate counts a solo game only with WELCOME_GIFT.soloMinSeconds of it and XP.minMoves moves: Nov 10.)
    await recordResult(sql, current.id, { ...result, online: false, mode: b.mode === "crowd" || b.mode === "boss" ? b.mode : "classic", playMs: timed ? ms : null, moves, xp } as MatchResult, now);
    // (A finished game: maybe the Welcome Crate, once ever. The app's next /api/me shows it.)
    await grantWelcomeCrate(sql, current.id, now).catch(() => false);
    return json({ ok: true, xp });
  }

  // POST /api/auth/logout: a fresh guest account on this device.
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (token) {
      forgetToken(token);
      await endSession(sql, token);
    }
    const g = await createGuest(sql, now, "Player");
    return json(await profile(sql, g.user, admins, leaves), 200, { "set-cookie": sessionCookie(g.token) });
  }

  return json({ message: "Not found" }, 404);
}
