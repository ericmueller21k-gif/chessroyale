import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, loadAccount, retryAccount, startSoloBossBattle } from "../src/account.ts";
import { siteSignedOut } from "../src/site-gate.ts";
import { FRONT_DOOR, SOLO_ABANDON } from "@chessroyale/core";
import { testSwitchesAllowed } from "../src/test-switches.ts";

/**
 * Loading the account (Oct 25): a server that answers its options but fails your profile once mustn't cost the page its
 * account, and never its test switch (a CI run lost its ?boss= link when /api/me failed and took the switch with it).
 */

const CONFIG = { accounts: true, google: false, email: false, testSwitches: true };
const PROFILE = { user: { id: "u", name: "P", icon: "", signedIn: false, email: null, google: false }, stats: {}, rating: null, recent: [] };

/** The server: its options, then /api/me answering with each status in turn (the last one from then on). */
function server(meStatuses: number[]) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (path: string) => {
    calls.push(path);
    if (path.startsWith("/api/auth/config")) return Response.json(CONFIG);
    const status = meStatuses.length > 1 ? meStatuses.shift()! : meStatuses[0]!;
    return status === 200 ? Response.json(PROFILE) : Response.json({ message: "nope" }, { status });
  });
  return calls;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  vi.stubEnv("DEV", false);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loading the account", () => {
  it("your profile failing once on the server's side: asked again, and the account loads", async () => {
    const calls = server([503, 200]);
    await loadAccount();
    expect(calls.filter((c) => c.startsWith("/api/me"))).toHaveLength(2);
    expect(account().config?.accounts).toBe(true);
    expect(account().profile?.user.id).toBe("u");
    expect(testSwitchesAllowed()).toBe(true);
  });

  it("your profile failing twice: no account for now, but the server's test switch stays", async () => {
    const calls = server([500]);
    await loadAccount();
    expect(calls.filter((c) => c.startsWith("/api/me"))).toHaveLength(2);
    expect(account().config?.accounts).toBe(false);
    expect(testSwitchesAllowed()).toBe(true);
  });

  it("your profile is asked for beside the options, not after them (Nov 10: a round trip less before home knows you)", async () => {
    let meAsked = false;
    let meBeforeConfig = false;
    vi.stubGlobal("fetch", async (path: string) => {
      if (path.startsWith("/api/me")) {
        meAsked = true;
        return Response.json(PROFILE);
      }
      // (The options answer only after a moment, by when the profile has been asked for if it goes beside them.)
      await new Promise((r) => setTimeout(r, 20));
      meBeforeConfig = meAsked;
      return Response.json(CONFIG);
    });
    await loadAccount("Ann");
    expect(meBeforeConfig).toBe(true);
    expect(account().profile?.user.id).toBe("u");
  });

  it("an answer cut off on the way (a 2xx that isn't JSON): asked again like a server error, never `{}` taken for your profile (Nov 11)", async () => {
    const calls: string[] = [];
    let me = 0;
    vi.stubGlobal("fetch", async (path: string) => {
      calls.push(path);
      if (path.startsWith("/api/auth/config")) return Response.json(CONFIG);
      return ++me === 1 ? new Response('{"user":{"id":', { status: 200, headers: { "content-type": "application/json" } }) : Response.json(PROFILE);
    });
    await loadAccount();
    expect(calls.filter((c) => c.startsWith("/api/me"))).toHaveLength(2);
    expect(account().profile?.user.id).toBe("u");
  });

  it("an answer cut off twice: no account for now, never a profile without its user", async () => {
    vi.stubGlobal("fetch", async (path: string) =>
      path.startsWith("/api/auth/config") ? Response.json(CONFIG) : new Response("", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await loadAccount();
    expect(account().config?.accounts).toBe(false);
    const p = account().profile;
    expect(p === null || !!p.user).toBe(true);
  });

  it("a refusal (a 4xx) isn't asked again", async () => {
    const calls = server([403]);
    await loadAccount();
    expect(calls.filter((c) => c.startsWith("/api/me"))).toHaveLength(1);
  });
});

describe("the account's load failing: it knows why (Nov 20: Profile on \"Loading…\" for good, Eric signed out of the site's gate)", () => {
  // (A load whose options failed returns before your profile's second try, 400 ms on: let it finish here, not in the next test.)
  afterEach(() => new Promise((ok) => setTimeout(ok, 600)));
  /** The gate's answer to a script's request, as `redirect: "manual"` gives it: an opaque redirect (not constructible: a stand-in). */
  const gateRedirect = () => ({ type: "opaqueredirect", status: 0, ok: false, headers: new Headers(), json: async () => null }) as unknown as Response;

  it("signed out of the site's gate (a redirect to its login): \"gate\", noticed app-wide, and not asked again", async () => {
    const calls: { path: string; redirect?: string }[] = [];
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
      calls.push({ path, redirect: init?.redirect });
      return gateRedirect();
    });
    await loadAccount();
    expect(account().failed).toBe("gate");
    expect(account().config?.accounts).toBe(false);
    expect(siteSignedOut()).toBe(true);
    // (Asked with redirect "manual", so the gate's answer is read, not followed into a failure like being offline.)
    expect(calls.every((c) => c.redirect === "manual")).toBe(true);
    expect(calls.filter((c) => c.path.startsWith("/api/me"))).toHaveLength(1);
  });

  it("the gate's 401 for a script's request (naming Cloudflare Access): \"gate\" too", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401, headers: { "www-authenticate": 'Cloudflare-Access resource_metadata="x"' } }));
    await loadAccount();
    expect(account().failed).toBe("gate");
  });

  it("let in again, Try again loads the account, and the app-wide notice goes", async () => {
    vi.stubGlobal("fetch", async () => gateRedirect());
    await loadAccount();
    expect(siteSignedOut()).toBe(true);
    server([200]);
    await retryAccount();
    expect(account().failed).toBeNull();
    expect(account().profile?.user.id).toBe("u");
    expect(account().config?.accounts).toBe(true);
    expect(siteSignedOut()).toBe(false);
  });

  it("no answer at all (offline): \"offline\"", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await loadAccount();
    expect(account().failed).toBe("offline");
    expect(siteSignedOut()).toBe(false);
  });

  it("the server's own error twice: \"server\"", async () => {
    server([500]);
    await loadAccount();
    expect(account().failed).toBe("server");
  });

  it("a request that never answers is given up in time (FRONT_DOOR.accountTimeoutMs), never waited on for good", async () => {
    vi.stubGlobal("fetch", (_path: string, init?: RequestInit) => new Promise((_ok, fail) => init?.signal?.addEventListener("abort", () => fail(init.signal!.reason))));
    const timing = FRONT_DOOR as { accountTimeoutMs: number };
    const was = timing.accountTimeoutMs;
    timing.accountTimeoutMs = 30;
    try {
      await loadAccount();
    } finally {
      timing.accountTimeoutMs = was;
    }
    expect(account().failed).toBe("offline");
  });
});

describe("a solo boss battle's start (Nov 10)", () => {
  it("lost on the way once: asked again, and the battle's id comes back (a start that failed earned no token, and a town challenge said nothing in the chat)", async () => {
    server([200]);
    await loadAccount();
    const starts: string[] = [];
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
      starts.push(`${path} ${init?.body}`);
      if (starts.length === 1) throw new TypeError("Failed to fetch");
      return Response.json({ battle: "b2" });
    });
    expect(await startSoloBossBattle("alfil")).toBe("b2");
    expect(starts).toEqual(['/api/boss/solo/start {"town":"alfil"}', '/api/boss/solo/start {"town":"alfil"}']);
  });

  it("refused (a 4xx): not asked again", async () => {
    server([200]);
    await loadAccount();
    let n = 0;
    vi.stubGlobal("fetch", async () => (n++, Response.json({ message: "no" }, { status: 403 })));
    await expect(startSoloBossBattle()).rejects.toThrow("no");
    expect(n).toBe(1);
  });
});

describe("the account's load and a solo game left (SOLO_ABANDON, Nov 22)", () => {
  /** Storage holding these keys; the server answers everything, noting each request (and a POST's body). */
  function device(stored: Record<string, string>) {
    const store = new Map(Object.entries(stored));
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
      calls.push(`${path}${init?.body ? ` ${String(init.body)}` : ""}`);
      if (path.startsWith("/api/auth/config")) return Response.json(CONFIG);
      if (path.startsWith("/api/results")) return Response.json({ ok: true, xp: null });
      return Response.json(PROFILE);
    });
    return { calls, store, me: () => calls.find((c) => c.startsWith("/api/me"))! };
  }
  const live = (minutesAgo: number) => JSON.stringify({ game: "abc", at: Date.now() - minutesAgo * 60_000 });

  it("asks for it to be recorded (settle) unless another tab played a turn of one within SOLO_ABANDON.liveMinutes", async () => {
    let d = device({});
    await loadAccount("Ann");
    expect(d.me()).toBe("/api/me?name=Ann&settle=1");
    d = device({ "brc.soloLive": live(1) });
    await loadAccount();
    expect(d.me()).toBe("/api/me");
    d = device({ "brc.soloLive": live(SOLO_ABANDON.liveMinutes + 1) });
    await loadAccount();
    expect(d.me()).toBe("/api/me?settle=1");
  });

  it("a finished game's result that couldn't be sent: not settled, sent once the account is the same one, then forgotten", async () => {
    const result = { mode: "boss", placement: 1, players: 1, game: "0123456789abcdef01" };
    const d = device({ "brc.soloUnsent": JSON.stringify({ user: "u", result }) });
    await loadAccount();
    expect(d.me()).toBe("/api/me");
    await vi.waitFor(() => expect(d.calls).toContain(`/api/results ${JSON.stringify(result)}`));
    await vi.waitFor(() => expect(d.store.has("brc.soloUnsent")).toBe(false));
    // (Another account's: dropped, never sent as this one's, so the next load settles again.)
    const other = device({ "brc.soloUnsent": JSON.stringify({ user: "someone else", result }) });
    await loadAccount();
    await vi.waitFor(() => expect(other.store.has("brc.soloUnsent")).toBe(false));
    expect(other.calls.some((c) => c.startsWith("/api/results"))).toBe(false);
    await loadAccount();
    expect(other.calls.filter((c) => c.startsWith("/api/me")).at(-1)).toBe("/api/me?settle=1");
  });
});
