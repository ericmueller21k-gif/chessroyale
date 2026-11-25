import { beforeEach, describe, expect, it, vi } from "vitest";
import { AGE_STEP_LINE, MONTHS } from "@chessroyale/core";
import { TOO_YOUNG_KEY, account, answerAge, askAgeAgain, askAgeForGoogle, dropPendingSignIn, loadAccount, takeSignInNote, tooYoung, verifyEmailCode, youngGuest } from "../src/account.ts";

/**
 * The age question in the app (docs/decisions/2026-10-16-age-gate-and-real-money.md): the birth month and year are
 * checked on the device and only the answer is sent; "too young" is kept on the device and by the server, each putting
 * the other back; the birth date is kept nowhere. Since Nov 12 (2026-11-12-signin-without-age.md) a sign-in the server can't
 * finish without the answer waits for it, and the answer finishes it: the email's code sent again, or Google once more.
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
/** The code check's answer when this device has no "old enough" answer: an account that answered signs in; else asked first. */
let accountAnswered = false;
/** The code check refuses the code (it ran out, say). */
let codeGone = false;
const page = { href: "", pathname: "/" };
vi.stubGlobal("location", page);
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
  if (path === "/api/auth/email/verify") {
    if (serverAge === "under") return json({ message: "too young", tooYoung: true }, 403);
    if (codeGone) return json({ message: "That code didn't work. Check it, or send a new one." }, 400);
    if (serverAge !== "ok" && !accountAnswered) return json({ message: AGE_STEP_LINE, askAge: true }, 403);
    serverAge = null;
    return json({ user: { id: "g1", name, signedIn: true } });
  }
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

  it("13 exactly: old enough, sent as that alone, nothing kept on the device; a sign-in the server asks about waits, and the answer finishes it with the same code", async () => {
    store.clear();
    serverAge = null;
    await loadAccount();
    expect(account().age).toBeNull();
    expect(await answerAge(thirteen.month, thirteen.year)).toBe("ok");
    expect(sentAnswers()).toEqual([{ oldEnough: true }]);
    expect(account().age).toBe("ok");
    expect([...store.keys()]).toEqual([]);
    // The answer ran out (or another tab's sign-in used it up), and the email has no account yet: the sign-in waits for the
    // question, keeping its code (in memory only), with no error and no note.
    serverAge = null;
    await verifyEmailCode("ann@example.com", "123456");
    expect(account().pending).toEqual({ kind: "email", email: "ann@example.com", code: "123456" });
    expect([account().age, account().ageNote]).toEqual([null, null]);
    expect([...store.keys()]).toEqual([]);
    // Answered, the sign-in goes on by itself with the same code, and uses the answer up.
    requests.length = 0;
    await answerAge(thirteen.month, thirteen.year);
    expect(requests.map((r) => r.path)).toEqual(["/api/auth/age", "/api/auth/email/verify"]);
    expect(requests[1]!.body).toEqual({ email: "ann@example.com", code: "123456" });
    expect(account().profile?.user.signedIn).toBe(true);
    expect([account().age, account().pending]).toEqual([null, null]);
  });
});

describe("Sign in without the question (Nov 12)", () => {
  beforeEach(async () => {
    store.clear();
    serverAge = null;
    accountAnswered = false;
    codeGone = false;
    signedIn = false;
    await loadAccount();
  });

  it("an account that answered signs in with no question: nothing asked, nothing sent but the code", async () => {
    accountAnswered = true;
    requests.length = 0;
    await verifyEmailCode("kim@example.com", "135790");
    expect(requests.map((r) => r.path)).toEqual(["/api/auth/email/verify"]);
    expect(account().profile?.user.signedIn).toBe(true);
    expect([account().age, account().pending]).toEqual([null, null]);
  });

  it("Google: back with the server asking, the box asks; the answer goes to Google again, back to the same page", async () => {
    askAgeForGoogle("/settings");
    expect(account().pending).toEqual({ kind: "google", next: "/settings" });
    page.href = "";
    await answerAge(thirteen.month, thirteen.year);
    expect(page.href).toBe("/api/auth/google/start?next=%2Fsettings");
    expect(account().pending).toBeNull();
  });

  it("too young: a waiting sign-in is dropped, never sent; and nothing waits on a device that's too young", async () => {
    await verifyEmailCode("kid@example.com", "111111");
    expect(account().pending?.kind).toBe("email");
    requests.length = 0;
    expect(await answerAge(almost.month, almost.year)).toBe("under");
    expect(account().pending).toBeNull();
    expect(requests.map((r) => r.path)).not.toContain("/api/auth/email/verify");
    askAgeForGoogle("/");
    expect(account().pending).toBeNull();
    await expect(verifyEmailCode("kid@example.com", "111111")).rejects.toThrow();
    expect(account().pending).toBeNull();
    expect(tooYoung()).toBe(true);
  });

  it("a finish that fails (the code ran out) leaves its message and address for the sign-in options, once; switching views drops a waiting one", async () => {
    await verifyEmailCode("late@example.com", "222222");
    codeGone = true;
    await answerAge(thirteen.month, thirteen.year);
    expect(account().pending).toBeNull();
    expect(takeSignInNote()).toEqual({ message: "That code didn't work. Check it, or send a new one.", email: "late@example.com" });
    expect(takeSignInNote()).toBeNull();
    codeGone = false;
    serverAge = null;
    await verifyEmailCode("new@example.com", "333333");
    dropPendingSignIn();
    expect(account().pending).toBeNull();
  });
});
