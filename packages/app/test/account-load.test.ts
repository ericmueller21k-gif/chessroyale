import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, loadAccount } from "../src/account.ts";
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

  it("a refusal (a 4xx) isn't asked again", async () => {
    const calls = server([403]);
    await loadAccount();
    expect(calls.filter((c) => c.startsWith("/api/me"))).toHaveLength(1);
  });
});
