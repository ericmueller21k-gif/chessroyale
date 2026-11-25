import { useEffect, useState } from "preact/hooks";

/**
 * The site's gate (before launch, Cloudflare Access in front of hunchess.com; docs/decisions/2026-11-20-account-load-fail.md). When its
 * sign-in runs out, every /api/* request is answered by the gate, not by us: a 302 to its login page (or a 401 naming it, for a request
 * it takes for a script's). A `fetch` that follows that redirect fails like being offline (the login page is another origin), so the app
 * asks with `redirect: "manual"` and reads the gate's answer for what it is. Once one is seen, the whole app knows (the notice at the top,
 * SiteGateNotice.tsx), until a request gets through again.
 */

/** The gate answered this request, not HunChess: a redirect we never send to a script's request, or a 401/403 that names the gate. */
export function gateAnswered(res: Response): boolean {
  if (res.type === "opaqueredirect") return true;
  return (res.status === 401 || res.status === 403) && /^Cloudflare-Access/i.test(res.headers.get("www-authenticate") ?? "");
}

let signedOut = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (signedOut === v) return;
  signedOut = v;
  listeners.forEach((l) => l());
};

/** This page has been signed out of the site's gate (a request it answered), and nothing has got through since. */
export const siteSignedOut = () => signedOut;
/** A request was answered by the gate. */
export const noteSiteSignedOut = () => set(true);
/** A request got through to HunChess: the gate lets this page in again. */
export const noteSiteReached = () => set(false);

export function onSiteGate(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSiteSignedOut(): boolean {
  const [v, setV] = useState(signedOut);
  useEffect(() => {
    setV(signedOut);
    return onSiteGate(() => setV(signedOut));
  }, []);
  return v;
}

/**
 * "Sign in again": the page loaded again, from the network. The service worker passes on whatever the network answers a page with (the
 * gate's redirect included, which the browser then follows to its login), and gives its saved copy of the app only when no answer came
 * at all (offline), so a reload is all it takes.
 */
export function signInToSite(): void {
  location.reload();
}
