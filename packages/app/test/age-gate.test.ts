import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASK_AGE_LINE, MONTHS } from "@chessroyale/core";
import { TOO_YOUNG_KEY, account, answerAge, askAgeAgain, loadAccount, tooYoung, verifyEmailCode, youngGuest } from "../src/account.ts";

/**
 * The age question in the app (docs/decisions/2026-10-16-age-gate-and-real-money.md): the birth month and year are
 * checked on the device and only the answer is sent; "too young" is kept on the device and by the server, each putting
 * the other back; the birth date is kept nowhere.
 */

// This device's storage, and a server that remembers the answer in its cookie as the real one does.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});
let serverAge: "ok" | "under" | null = null;
let name = "Sam Lee";
let signedIn = false;
const requests: { path: string; body: unknown }[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
  const path = String(url);
  requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null });
  if (path === "/api/auth/config") return json({ accounts: true, google: true, email: true, onlineNeedsSignIn: true, ...(serverAge ? { age: serverAge } : {}) });
  if (path === "/api/auth/age") {
    const { oldEnough } = JSON.parse(String(init!.body)) as { oldEnough: boolean };
    serverAge = serverAge === "under" || !oldEnough ? "under" : "ok";
    if (serverAge === "under") name = "Player";
    return json({ age: serverAge });
  }
  if (path.startsWith("/api/me")) return json({ user: { id: "g1", name, icon: "♟", signedIn, email: null, google: false }, stats: {}, rating: null, recent: [] });
  if (path === "/api/auth/email/verify") return serverAge === "ok" ? json({ user: { id: "g1", name, signedIn: true } }) : json({ message: ASK_AGE_LINE, askAge: true }, 403);
  return json({ message: "Not found" }, 404);
});

const now = new Date();
const thisMonth = now.getMonth() + 1;
/** Born this month 13 years ago: 13 exactly. */
const thirteen = { month: thisMonth, year: now.getFullYear() - 13 };
/** Born the month after, 13 years ago: 12 years 11 months. */
const almost = thisMonth === 12 ? { month: 1, year: now.getFullYear() - 12 } : { month: thisMonth + 1, year: now.getFullYear() - 13 };
const sentAnswers = () => requests.filter((r) => r.path === "/api/auth/age").map((r) => r.body);

beforeEach(() => {
  requests.length = 0;
});

describe("the age question in the app", () => {
  it("12 years 11 months: too young, only that is sent, kept here and by the server, the chosen name forgotten", async () => {
    store.set("brc.name", "Sam Lee");
    await loadAccount("Sam Lee");
    expect(account().age).toBeNull();
    expect(await answerAge(almost.month, almost.year)).toBe("under");
    expect(sentAnswers()).toEqual([{ oldEnough: false }]);
    expect(tooYoung()).toBe(true);
    expect(store.get(TOO_YOUNG_KEY)).toBe("1");
    expect(youngGuest()).toBe(true);
    expect(store.has("brc.name")).toBe(false);
    expect(account().profile?.user.name).toBe("Player");
    // No birth date anywhere: not in what was sent, not in this device's storage.
    const kept = JSON.stringify([...store]) + JSON.stringify(requests);
    expect(kept).not.toContain(String(almost.year));
    expect(kept).not.toContain(MONTHS[almost.month - 1]);
  });

  it("can't be answered again: the server forgetting, or this device's storage cleared, brings it back", async () => {
    // The server's cookie cleared: the app tells it again (and asks for no name).
    serverAge = null;
    await loadAccount("Sam Lee");
    expect(tooYoung()).toBe(true);
    expect(sentAnswers()).toEqual([{ oldEnough: false }]);
    expect(requests.some((r) => r.path.includes("name="))).toBe(false);
    expect(serverAge).toBe("under");
    // This device's storage cleared: the server's answer puts it back.
    store.clear();
    await loadAccount();
    expect(tooYoung()).toBe(true);
    expect(store.get(TOO_YOUNG_KEY)).toBe("1");
    // And a new answer changes nothing, nor does a sign-in's "answer again".
    expect(await answerAge(1, 1980)).toBe("under");
    askAgeAgain();
    expect(tooYoung()).toBe(true);
  });

  it("someone signed in on a too-young device (a tab from before the answer) isn't a young guest: their name and notes are theirs", async () => {
    signedIn = true;
    await loadAccount();
    expect(tooYoung()).toBe(true);
    expect(youngGuest()).toBe(false);
    signedIn = false;
  });

  it("13 exactly: old enough, sent as that alone, nothing kept on the device; a sign-in refused for want of it asks again", async () => {
    store.clear();
    serverAge = null;
    await loadAccount();
    expect(account().age).toBeNull();
    expect(await answerAge(thirteen.month, thirteen.year)).toBe("ok");
    expect(sentAnswers()).toEqual([{ oldEnough: true }]);
    expect(account().age).toBe("ok");
    expect([...store.keys()]).toEqual([]);
    // The answer ran out (or another tab's sign-in used it up): the server refuses, and the question comes back saying why.
    serverAge = null;
    await expect(verifyEmailCode("ann@example.com", "123456")).rejects.toThrow(ASK_AGE_LINE);
    expect(account().age).toBeNull();
    expect(account().ageNote).toBe(ASK_AGE_LINE);
    // Answered again, the note goes, and the sign-in goes ahead and uses the answer up.
    await answerAge(thirteen.month, thirteen.year);
    expect(account().ageNote).toBeNull();
    await verifyEmailCode("ann@example.com", "123456");
    expect(account().profile?.user.signedIn).toBe(true);
    expect(account().age).toBeNull();
  });
});
