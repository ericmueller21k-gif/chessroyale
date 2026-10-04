import {
  cleanEmail,
  createGuest,
  createSession,
  d1Sql,
  endSession,
  ensureSchema,
  profile,
  randomToken,
  recordResult,
  signInWithIdentity,
  startEmailCode,
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
}

export const SESSION_COOKIE = "hc_session";
const STATE_COOKIE = "hc_oauth";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export function readCookie(request: Request, name: string): string | null {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]!) : null;
}
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const sessionCookie = (token: string) => cookie(SESSION_COOKIE, token, 365 * 86_400);

/** The account behind a request's session cookie (for the lobby server). */
export async function accountOf(request: Request, env: AccountEnv): Promise<User | null> {
  if (!env.DB) return null;
  const sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  return userFromToken(sql, readCookie(request, SESSION_COOKIE), Date.now());
}

/** Handles /api/me, /api/results and /api/auth/*; returns null for other paths. */
export async function handleAccountApi(request: Request, env: AccountEnv, fetcher: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/me") && !path.startsWith("/api/auth/") && path !== "/api/results") return null;
  const google = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const email = !!env.RESEND_API_KEY;
  if (path === "/api/auth/config") return json({ accounts: !!env.DB, google, email });
  if (!env.DB) return json({ message: "Accounts aren't set up yet." }, 503);
  const sql: Sql = d1Sql(env.DB);
  await ensureSchema(sql, env.DB);
  const now = Date.now();
  const token = readCookie(request, SESSION_COOKIE);
  const current = await userFromToken(sql, token, now);

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

  // GET /api/me: your profile (a guest account is made the first time).
  if (path === "/api/me" && request.method === "GET") {
    if (current) return json(await profile(sql, current));
    const g = await createGuest(sql, now, url.searchParams.get("name") ?? "Player");
    return json(await profile(sql, g.user), 200, { "set-cookie": sessionCookie(g.token) });
  }
  if (!current) return json({ message: "No account on this device yet." }, 401);

  // PATCH /api/me {name?, icon?}
  if (path === "/api/me" && request.method === "PATCH") {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; icon?: unknown };
    return json(await profile(sql, await updateProfile(sql, current.id, body)));
  }

  // POST /api/results: a solo match's result, from the browser.
  if (path === "/api/results" && request.method === "POST") {
    const b = (await request.json().catch(() => null)) as Partial<MatchResult> | null;
    if (!b || typeof b.placement !== "number" || typeof b.players !== "number") return json({ message: "Bad result" }, 400);
    await recordResult(sql, current.id, { ...b, online: false, mode: b.mode === "crowd" ? "crowd" : "classic" } as MatchResult, now);
    return json({ ok: true });
  }

  // POST /api/auth/logout: a fresh guest account on this device.
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (token) await endSession(sql, token);
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
    return new Response(null, {
      status: 302,
      headers: { location: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, "set-cookie": cookie(STATE_COOKIE, state, 600), "cache-control": "no-store" },
    });
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
    return signInAs(user, `${url.origin}/?signin=google`);
  }

  return json({ message: "Not found" }, 404);
}
