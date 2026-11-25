/**
 * The residents' HTTP and WebSocket access to the game, as a browser's: each resident its own cookie jar (its session and fair play's
 * device marker, as separate browsers would keep), Cloudflare Access's service token on every request to the live site, and the
 * e2e's key for a local server's admin route. Cookies and tokens are never printed.
 */
import WebSocket from "ws";

export interface Target {
  origin: string;
  /** The live site (https, not a local server): Access's headers go on every request. */
  live: boolean;
  /** Headers on every request and socket (Access's service token, to the live site only). */
  access: Record<string, string>;
  /** Headers the admin route needs besides (the e2e's key, to a local server only). */
  admin: Record<string, string>;
}

/**
 * Where the residents play. https://hunchess.com (or a host under it) takes Access's service token from CF_ACCESS_CLIENT_ID and
 * CF_ACCESS_CLIENT_SECRET; a local server (localhost) takes the e2e's key, E2E_SQL_KEY, for the admin route. Anything else is refused,
 * so the token never goes elsewhere.
 */
export function targetFrom(base: string, env: Record<string, string | undefined>): Target {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error("--base isn't a URL.");
  }
  if (url.username || url.password) throw new Error("--base can't carry a user name or password.");
  const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  const live = url.protocol === "https:" && (url.hostname === "hunchess.com" || url.hostname.endsWith(".hunchess.com")) && url.port === "";
  if (!local && !live) throw new Error("--base must be https://hunchess.com or a local server (localhost).");
  const access: Record<string, string> = {};
  const admin: Record<string, string> = {};
  if (live) {
    const id = env.CF_ACCESS_CLIENT_ID;
    const secret = env.CF_ACCESS_CLIENT_SECRET;
    if (!id || !secret) throw new Error("Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (the residents' Cloudflare Access service token).");
    access["CF-Access-Client-Id"] = id;
    access["CF-Access-Client-Secret"] = secret;
  } else if (env.E2E_SQL_KEY) admin["x-e2e-sql"] = env.E2E_SQL_KEY;
  return { origin: url.origin, live, access, admin };
}

/** A browser's cookies for one site: kept from every answer's Set-Cookie, sent with every request. */
export class CookieJar {
  private cookies = new Map<string, string>();

  /** Takes the Set-Cookie headers of an answer (a cookie set to expire is dropped). */
  take(headers: Headers): void {
    for (const line of headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const eq = pair!.indexOf("=");
      if (eq <= 0) continue;
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      const gone = !value || attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a) || (/^\s*expires\s*=/i.test(a) && Date.parse(a.split("=")[1]!) < Date.now()));
      if (gone) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  /** The Cookie header (empty: none). */
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

/** What an answer was: its status and JSON body (or {text} for anything else); status 0 when the request itself failed. */
export interface Answer {
  status: number;
  body: any;
}

/** The server turned the residents away (PAUSE_RESIDENTS: 503 "Residents are paused."). */
export const isPausedAnswer = (a: Answer) => a.status === 503 && /residents are paused/i.test(String(a.body?.message ?? a.body?.text ?? ""));

/** Access turned the token away (a redirect to its login page): the token is wrong or revoked. */
export class AccessRefused extends Error {}

export class Api {
  constructor(
    readonly target: Target,
    readonly jar = new CookieJar(),
  ) {}

  async request(method: string, path: string, opts: { body?: unknown; admin?: boolean; timeoutMs?: number } = {}): Promise<Answer> {
    const cookie = this.jar.header();
    let res: Response;
    try {
      res = await fetch(this.target.origin + path, {
        method,
        headers: {
          ...this.target.access,
          ...(opts.admin ? this.target.admin : {}),
          ...(cookie ? { cookie } : {}),
          ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        redirect: "manual",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
    } catch (e) {
      return { status: 0, body: { message: (e as Error).name } };
    }
    if (this.target.live && res.status >= 300 && res.status < 400) throw new AccessRefused("Access turned the service token away (a redirect to its login): check the token.");
    this.jar.take(res.headers);
    const text = await res.text().catch(() => "");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { text: text.slice(0, 200) };
    }
    return { status: res.status, body };
  }

  /** A WebSocket to `path` with this jar's cookies and Access's headers. */
  socket(path: string): WebSocket {
    const cookie = this.jar.header();
    return new WebSocket(`${this.target.origin.replace(/^http/, "ws")}${path}`, { headers: { ...this.target.access, ...(cookie ? { cookie } : {}) } });
  }
}
