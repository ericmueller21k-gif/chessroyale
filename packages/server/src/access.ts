/**
 * Cloudflare Access, for the health view's scripts (`npm run ops:report`): a request that came through Access carries
 * Access's own signed token (`Cf-Access-Jwt-Assertion`). It's checked here against the team's public keys (RS256), its
 * audience (the Access application's AUD tag) and its expiry, so the view stays closed even where Access isn't in front
 * of the site. The team domain and the AUD tag are public (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` in wrangler.jsonc); no
 * secret is involved. See docs/areas/ops.md, "Health".
 */

export interface AccessEnv {
  /** The Zero Trust team's domain, e.g. "example.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's audience (AUD) tag for the path the scripts read. */
  ACCESS_AUD?: string;
}

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64urlJson = (s: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** The team's signing keys by id, kept an hour (asked again for a key id it doesn't know, at most once a minute). */
let keys: { team: string; at: number; byKid: Map<string, CryptoKey> } | null = null;
let askedAt = 0;

async function signingKey(team: string, kid: string, now: number, fetcher: typeof fetch): Promise<CryptoKey | null> {
  const fresh = keys?.team === team && now - keys.at < 3_600_000;
  if (fresh && keys!.byKid.has(kid)) return keys!.byKid.get(kid)!;
  if (fresh && now - askedAt < 60_000) return null;
  askedAt = now;
  try {
    const res = await fetcher(`https://${team}/cdn-cgi/access/certs`);
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
    const byKid = new Map<string, CryptoKey>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "RSA") continue;
      byKid.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    }
    keys = { team, at: now, byKid };
    return byKid.get(kid) ?? null;
  } catch {
    return null;
  }
}

/** Forgets the cached keys (tests). */
export const forgetAccessKeys = () => {
  keys = null;
  askedAt = 0;
};

/** Whether the request came through Access for this application: a valid, unexpired token signed by the team. */
export async function viaAccess(request: Request, env: AccessEnv, now = Date.now(), fetcher: typeof fetch = fetch): Promise<boolean> {
  const team = env.ACCESS_TEAM_DOMAIN;
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!team || !env.ACCESS_AUD || !jwt) return false;
  const [head, body, sig] = jwt.split(".");
  if (!head || !body || !sig) return false;
  const header = b64urlJson(head);
  const claims = b64urlJson(body);
  if (header?.alg !== "RS256" || typeof header.kid !== "string" || !claims) return false;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD) || claims.iss !== `https://${team}` || typeof claims.exp !== "number" || claims.exp * 1000 <= now) return false;
  const key = await signingKey(team, header.kid, now, fetcher);
  if (!key) return false;
  try {
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(`${head}.${body}`));
  } catch {
    return false;
  }
}
