/**
 * Cloudflare Access, for the health view's scripts (`npm run ops:report`): a request that came through Access carries
 * Access's own signed token (`Cf-Access-Jwt-Assertion`). It's checked here against the team's public keys (RS256), its
 * audience (the Access application's AUD tag), issuer, expiry and not-before, and it must be a service token's (a
 * person's login doesn't open the view, whoever the application lets in), so the view stays closed even where Access
 * isn't in front of the site. The team domain and the AUD tag are public (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` in
 * wrangler.jsonc); no secret is involved. See docs/areas/ops.md, "Health".
 */

export interface AccessEnv {
  /** The Zero Trust team's domain, e.g. "example.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's audience (AUD) tag for the path the scripts read. */
  ACCESS_AUD?: string;
  /**
   * Optional: the one service token's client ID the view takes (its token's `common_name`). Unset, any service token the
   * application admits does. Set in Cloudflare (a Worker secret, so deploys keep it), never in the repository.
   */
  OPS_ACCESS_CLIENT_ID?: string;
}

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64urlJson = (s: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * The team's signing keys by id, kept an hour. Asked for again (an hour on, or for a key id it doesn't know) at most
 * once a minute, whatever the cache holds: made-up tokens can't make the Worker ask Access's endpoint over and over,
 * even while that endpoint fails.
 */
let keys: { team: string; at: number; byKid: Map<string, CryptoKey> } | null = null;
let askedAt = -Infinity;

async function signingKey(team: string, kid: string, now: number, fetcher: typeof fetch): Promise<CryptoKey | null> {
  const known = keys?.team === team ? keys.byKid.get(kid) : undefined;
  if (known && now - keys!.at < 3_600_000) return known;
  // (Within the minute, a key it already has, even past the hour, still does: Access changes its keys every few weeks.)
  if (now - askedAt < 60_000) return known ?? null;
  askedAt = now;
  try {
    const res = await fetcher(`https://${team}/cdn-cgi/access/certs`);
    if (!res.ok) return known ?? null;
    const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
    const byKid = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "RSA") continue;
      byKid.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    }
    keys = { team, at: now, byKid };
    return byKid.get(kid) ?? null;
  } catch {
    return known ?? null;
  }
}

/** Forgets the cached keys (tests). */
export const forgetAccessKeys = () => {
  keys = null;
  askedAt = -Infinity;
};

/**
 * Whether the request came through Access for this application with a service token: a token signed by the team, for
 * this application, unexpired and already valid (`nbf`, with 30 s for clocks), whose `common_name` is a service token's
 * client ID (a person's login carries an email instead), and the pinned one if `OPS_ACCESS_CLIENT_ID` is set.
 */
export async function viaAccess(request: Request, env: AccessEnv, now = Date.now(), fetcher: typeof fetch = fetch): Promise<boolean> {
  const team = env.ACCESS_TEAM_DOMAIN;
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!team || !env.ACCESS_AUD || !jwt) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  const [head, body, sig] = parts as [string, string, string];
  if (!head || !body || !sig) return false;
  const header = b64urlJson(head);
  const claims = b64urlJson(body);
  if (header?.alg !== "RS256" || typeof header.kid !== "string" || !claims) return false;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD) || claims.iss !== `https://${team}` || typeof claims.exp !== "number" || claims.exp * 1000 <= now) return false;
  if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf * 1000 > now + 30_000)) return false;
  const client = claims.common_name;
  if (typeof client !== "string" || client === "" || (env.OPS_ACCESS_CLIENT_ID && client !== env.OPS_ACCESS_CLIENT_ID)) return false;
  const key = await signingKey(team, header.kid, now, fetcher);
  if (!key) return false;
  try {
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(`${head}.${body}`));
  } catch {
    return false;
  }
}
