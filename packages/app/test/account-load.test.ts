import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, keepSoloResult, loadAccount, recordSoloResult, retryAccount, signOut, startSoloBossBattle, startSoloGame, verifyEmailCode } from "../src/account.ts";
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
  /**
   * Storage holding these keys; the server answers everything, noting each request (and a POST's body, and `keepalive`): a result's
   * post as `results` says (200 by default).
   */
  function device(stored: Record<string, string>, results: () => Response | Promise<Response> = () => Response.json({ ok: true, xp: null })) {
    const store = new Map(Object.entries(stored));
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
      calls.push(`${path}${init?.body ? ` ${String(init.body)}` : ""}${init?.keepalive ? " (keepalive)" : ""}`);
      if (path.startsWith("/api/auth/config")) return Response.json(CONFIG);
      if (path.startsWith("/api/results")) return results();
      if (path.startsWith("/api/xp/solo/start")) return Response.json({ game: "0123456789abcdef02" });
      return Response.json(PROFILE);
    });
    return { calls, store, me: () => calls.find((c) => c.startsWith("/api/me"))!, kept: () => store.has("brc.soloUnsent") };
  }
  const live = (minutesAgo: number) => JSON.stringify({ game: "abc", at: Date.now() - minutesAgo * 60_000 });
  const GAME = "0123456789abcdef01";
  const result = { mode: "boss" as const, placement: 1, players: 1, evalBar: true, game: GAME };
  /** A kept result (`at`: its post went that many ms ago, maybe still on its way; none: no post on its way). */
  const kept = (user = "u", at?: number) => ({ "brc.soloUnsent": JSON.stringify({ user, result, ...(at === undefined ? {} : { at: Date.now() - at }) }) });
  const resent = `/api/results ${JSON.stringify({ ...result, resent: true })} (keepalive)`;
  /** An answer with this status (0: none at all, offline). */
  const answer = (status: number) => () => (status ? Response.json({ message: "nope" }, { status }) : Promise.reject(new TypeError("Failed to fetch")));
  /** Every status a result's post can meet: kept (sent again later) or final. */
  const KEPT = [0, 429, 500, 502, 503];
  const FINAL = [200, 400, 403, 409];

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

  it("a finished game's result: kept on the device before its post (keepalive), taken off only once the server answered it", async () => {
    for (const status of [...KEPT, ...FINAL]) {
      let d = device({});
      await loadAccount();
      let keptAtPost = false;
      d = device({}, () => ((keptAtPost = d.kept()), status === 200 ? Response.json({ ok: true, xp: null }) : answer(status)()));
      await recordSoloResult(result);
      expect(keptAtPost, `status ${status}`).toBe(true);
      expect(d.calls[0], `status ${status}`).toBe(`/api/results ${JSON.stringify(result)} (keepalive)`);
      expect(d.kept(), `status ${status}`).toBe(KEPT.includes(status));
    }
    // (No game id (no account when it began): nothing on the server to record as left, so nothing kept.)
    const d = device({}, answer(503));
    await recordSoloResult({ ...result, game: null });
    expect(d.kept()).toBe(false);
  });

  it("the review's case: a page gone mid-post keeps the result; the next load doesn't settle and names its game, and sends it again once its post can't still be on its way (D2)", async () => {
    let d = device({});
    await loadAccount();
    // (The post never answers: the page was closed or reloaded.)
    d = device({}, () => new Promise<Response>(() => undefined));
    void recordSoloResult(result);
    await vi.waitFor(() => expect(d.calls).toHaveLength(1));
    const store = Object.fromEntries(d.store);
    expect(JSON.parse(store["brc.soloUnsent"]!).at).toBeGreaterThan(Date.now() - 1000);
    // A fresh load at once: the profile read spares the kept game (`unsent`, never settled or stale), but nothing goes again yet: its
    // post (keepalive) may still land, and a re-send overtaking it would take the game and its XP (the delta review, D2).
    d = device(store);
    await loadAccount();
    expect(d.me()).toBe(`/api/me?unsent=${GAME}`);
    await new Promise((r) => setTimeout(r, 0));
    expect(d.calls.some((c) => c.startsWith("/api/results"))).toBe(false);
    expect(d.kept()).toBe(true);
    // (Nor a start: it names the game instead.)
    await startSoloGame({});
    expect(d.calls.filter((c) => c.startsWith("/api/xp") || c.startsWith("/api/results"))).toEqual([`/api/xp/solo/start ${JSON.stringify({ unsent: GAME })}`]);
    // SOLO_ABANDON.resendAfterMs on: the load sends it again (`resent`), and it's taken off on the answer.
    d = device(kept("u", SOLO_ABANDON.resendAfterMs + 1));
    await loadAccount();
    expect(d.me()).toBe(`/api/me?unsent=${GAME}`);
    await vi.waitFor(() => expect(d.calls).toContain(resent));
    await vi.waitFor(() => expect(d.kept()).toBe(false));
  });

  it("a post that failed (D2): kept with no post on its way, so the next load or start sends it again at once", async () => {
    let d = device({});
    await loadAccount();
    d = device({}, answer(503));
    await recordSoloResult(result);
    const store = Object.fromEntries(d.store);
    expect(JSON.parse(store["brc.soloUnsent"]!)).toEqual({ user: "u", result });
    d = device(store);
    await startSoloGame({});
    expect(d.calls.filter((c) => !c.startsWith("/api/me"))).toEqual([resent, `/api/xp/solo/start {}`]);
    expect(d.kept()).toBe(false);
  });

  it("the review's P1: a game decided, its result kept at once (keepSoloResult) and the page gone in its end moment: the next load sends it", async () => {
    let d = device({});
    await loadAccount();
    keepSoloResult(GAME, { mode: "boss", placement: 1, players: 1, evalBar: true });
    const store = Object.fromEntries(d.store);
    expect(JSON.parse(store["brc.soloUnsent"]!)).toEqual({ user: "u", result });
    d = device(store);
    await loadAccount();
    expect(d.me()).toBe(`/api/me?unsent=${GAME}`);
    await vi.waitFor(() => expect(d.calls).toContain(resent));
    await vi.waitFor(() => expect(d.kept()).toBe(false));
  });

  it("signing out sends a kept result first, even one whose post may be on its way (the delta review, D3): else the guest drops it and the game is recorded as left", async () => {
    let d = device({});
    await loadAccount();
    for (const at of [undefined, 0]) {
      d = device(kept("u", at));
      await signOut();
      expect(d.calls.map((c) => c.split(" ")[0])).toEqual(["/api/results", "/api/auth/logout"]);
      expect(d.kept()).toBe(false);
      d = device({});
      await loadAccount();
    }
  });

  it("sent again at the load: kept again on the same failures as the first post, taken off on an answer", async () => {
    for (const status of [...KEPT, ...FINAL]) {
      const d = device(kept(), status === 200 ? undefined : answer(status));
      await loadAccount();
      await vi.waitFor(() => expect(d.calls.some((c) => c.startsWith("/api/results"))).toBe(true));
      await new Promise((r) => setTimeout(r, 0));
      expect(d.kept(), `status ${status}`).toBe(KEPT.includes(status));
    }
  });

  it("a start sends a kept result first; one that still can't be sent is named (`unsent`), so the start never records it as left", async () => {
    let d = device(kept());
    await loadAccount();
    await vi.waitFor(() => expect(d.kept()).toBe(false));
    d = device(kept(), answer(503));
    await startSoloGame({});
    expect(d.calls.filter((c) => !c.startsWith("/api/me"))).toEqual([resent, `/api/xp/solo/start ${JSON.stringify({ unsent: GAME })}`]);
    d = device({});
    await startSoloGame({ xpgame: 3 });
    expect(d.calls).toEqual([`/api/xp/solo/start ${JSON.stringify({ xpgame: 3 })}`]);
  });

  it("an email sign-in sends a kept result first, even one whose post may be on its way (a guest's open game is recorded as left as it joins an account)", async () => {
    let d = device({});
    await loadAccount();
    d = device(kept("u", 0));
    await verifyEmailCode("ann@example.com", "123456");
    expect(d.calls.map((c) => c.split(" ")[0])).toEqual(["/api/results", "/api/auth/email/verify"]);
    expect(d.kept()).toBe(false);
  });

  it("another account's kept result: dropped, never sent as this one's, so the next load settles again", async () => {
    const other = device(kept("someone else"));
    await loadAccount();
    await vi.waitFor(() => expect(other.kept()).toBe(false));
    expect(other.calls.some((c) => c.startsWith("/api/results"))).toBe(false);
    await loadAccount();
    expect(other.calls.filter((c) => c.startsWith("/api/me")).at(-1)).toBe("/api/me?settle=1");
  });
});
