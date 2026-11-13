import { ASK_AGE_LINE, CHAT_MOD, oldEnough, pawnColorOf, type ChatPicks, type PawnColor, type ShopState } from "@chessroyale/core";
import { devicePawnColor, setDevicePawnColor } from "./prefs.ts";
import { loadStep } from "./loadbar.ts";
import { isBanned } from "./ban.ts";
import type { CrateRoll, ItemInstance, ItemLook, ItemSlot, QuestsAnswer, RankedLeaves, RankedSummary, XpGrant } from "@chessroyale/core";
import type { ChatBlock } from "@chessroyale/chess";

/**
 * Your account, as the screens see it: a guest account made the first time
 * you open the site, which signing in with Google or an emailed code turns
 * into a profile that follows you across devices. Talks to /api/me and
 * /api/auth/*; if the server has no accounts (local dev), it stays hidden.
 */

export interface ModeStats {
  matches: number;
  wins: number;
  finals: number;
  avgPlacement: number | null;
  best: number | null;
  teamWins: number;
}

/** A player's ranked 1 v 1 (core's RankedSummary: the rank, the record, the peak, the streak and the recent games). */
export type { RankedSummary };

export interface Profile {
  user: { id: string; name: string; icon: string; signedIn: boolean; email: string | null; google: boolean; pawn?: PawnColor };
  /** The shop: coins, items owned and what's equipped (missing from an older server). */
  shop?: ShopState;
  /** Crate items you own, what you wear, and your crates and keys. */
  locker?: Locker;
  stats: { all: ModeStats; classic: ModeStats; crowd: ModeStats; boss?: ModeStats };
  rating: number | null;
  /** Ranked 1 v 1: the rank ("Gold 2 · 45 RP", "Placement 2/5") and the record (missing from an older server). */
  ranked1v1?: RankedSummary;
  /**
   * Ranked's leave rules (L1, Nov 9; the server's own reckoning): a lockout, the delayed queue, what a dodge would cost now, and
   * home's note after a dodge. Null while PAUSE_LEAVE_PENALTIES is on; missing from an older server.
   */
  leaves?: RankedLeaves | null;
  recent: { mode: string; online: boolean; placement: number; players: number; teamWon: boolean | null; playedAt: number }[];
  /** An admin (ADMIN_EMAILS, as for the fair-play review): sees the boss battle's test trigger, may use the test switches. */
  admin?: boolean;
  /** Your chat ban in force, and a moderator's warning or chat ban you haven't seen yet (chat-mod.ts). */
  chatMod?: { block?: ChatBlock; notice?: ChatNotice };
  /** Chat is on for this account (its opt-in, off by default; a guest's is on the device: chat-on.ts). */
  chatOn?: boolean;
  /** Your XP (Nov 9): your level and its ring come from it (core's levelOf). Missing from an older server. */
  xp?: number;
}

/** A moderator's warning or chat ban, shown to you once (components/ChatNotice.tsx). */
export interface ChatNotice {
  id: number;
  kind: "warn" | "ban";
  at: number;
  /** A chat ban's end (server time); null: no end. */
  until: number | null;
  /** The moderator's words to you, if any. */
  note: string | null;
}

export interface AccountState {
  /**
   * Sign-in options the server has set up (null until known; accounts false = no accounts here). `testSwitches`: the
   * server has TEST_SWITCHES on (local, e2e, staging), so the address's test switches work for everyone (test-switches.ts).
   */
  config: { accounts: boolean; google: boolean; email: boolean; onlineNeedsSignIn?: boolean; testSwitches?: boolean; age?: AgeAnswer } | null;
  profile: Profile | null;
  /**
   * This device's answer to the age question, asked before any sign-in (AGE_GATE; null: not asked yet, or its "ok" was
   * used by a sign-in). "ok": sign-in may go ahead. "under": guest play only, here for good.
   */
  age: AgeAnswer | null;
  /** Why the age question is back (a sign-in refused: the answer ran out), shown on it until it's answered. */
  ageNote: string | null;
  /**
   * A sign-in the server can't finish until this device answers the age question (Nov 12: an email or Google account with no
   * account yet, or one from before the question): the sign-in box asks, and the answer finishes it.
   */
  pending: PendingSignIn | null;
  /** Why a sign-in that waited for the answer didn't finish (its code ran out, say): shown once on the sign-in options. */
  signInNote: { message: string; email: string } | null;
}

/** The age question's answer: old enough to sign in, or too young (docs/decisions/2026-10-16-age-gate-and-real-money.md). */
export type AgeAnswer = "ok" | "under";

/**
 * A sign-in waiting for the age question's answer (docs/decisions/2026-11-12-signin-without-age.md). Email: its address and
 * code, sent again with the answer (in memory only; the server kept the code live for it). Google: one more trip there, back to
 * `next`, as the server keeps nothing about a Google account before the answer.
 */
export type PendingSignIn = { kind: "email"; email: string; code: string } | { kind: "google"; next: string };

let state: AccountState = { config: null, profile: null, age: null, ageNote: null, pending: null, signInNote: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<AccountState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const account = () => state;
export function onAccountChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const read = (await res.json().catch(() => null)) as (T & { message?: string; askAge?: boolean; tooYoung?: boolean }) | null;
  if (!res.ok) {
    const body: { message?: string; askAge?: boolean; tooYoung?: boolean } = read ?? {};
    // A sign-in the age gate refused: ask the question again, saying why (the answer ran out), or too young after all.
    if (body.askAge) askAgeAgain(body.message ?? ASK_AGE_LINE);
    if (body.tooYoung) rememberTooYoung();
    throw Object.assign(new Error(body.message ?? `Something went wrong (${res.status}).`), { status: res.status, ...(body.askAge ? { askAge: true } : {}) });
  }
  // An answer that couldn't be read (cut off on the way, or not an object): a failure like the server's own (asked again where a
  // server error is), never `{}` taken for the answer. A profile with no `user` threw on every screen that reads it (Nov 11,
  // timber.spec on main: "Cannot read properties of undefined (reading 'signedIn')").
  if (!read || typeof read !== "object") throw Object.assign(new Error("Something went wrong (an answer that couldn't be read)."), { status: 502 });
  return read;
}

/** One action's id (a boss crate's buy, an open, an admin's grant): the server applies an action once per id (server/ledger.ts). */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One action, POSTed with its own request id and asked a second time after a moment, with the same id, when the first try fails on
 * the way (no answer, or the server's own error): the server applies it once and answers the retry with what the first try did. A
 * refusal (a 4xx) or a resting switch (503) isn't asked again.
 */
async function postOnce<T>(path: string, body: object): Promise<T> {
  const init = { method: "POST", body: JSON.stringify({ ...body, request: newRequestId() }) };
  try {
    return await api<T>(path, init);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== undefined && (status < 500 || status === 503)) throw e;
    await new Promise((r) => setTimeout(r, ACTION_RETRY_MS));
    return api<T>(path, init);
  }
}
const ACTION_RETRY_MS = 800;

/**
 * Your profile, asked a second time after a moment when the first try fails on the way (no answer, or the server's own
 * error): one hiccup shouldn't cost the page its account. A refusal (the age gate, a 4xx) isn't asked again.
 */
async function profileFrom(path: string): Promise<Profile> {
  try {
    return await api<Profile>(path);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== undefined && status < 500) throw e;
    await new Promise((r) => setTimeout(r, PROFILE_RETRY_MS));
    return api<Profile>(path);
  }
}
const PROFILE_RETRY_MS = 400;

/**
 * "Too young" is kept twice: in this device's storage and in the server's cookie (hc_age, which the page can't clear).
 * Each puts the other back, so clearing one isn't enough to answer again. Never the birth date, only the answer.
 */
export const TOO_YOUNG_KEY = "brc.tooYoung";
function storedTooYoung(): boolean {
  try {
    return localStorage.getItem(TOO_YOUNG_KEY) === "1";
  } catch {
    return false;
  }
}
/** This device is too young: remembered here, sign-in gone (a sign-in waiting for the answer too), and the name it may have chosen forgotten. */
function rememberTooYoung() {
  try {
    localStorage.setItem(TOO_YOUNG_KEY, "1");
    localStorage.removeItem("brc.name");
  } catch {
    // No storage: the server's cookie still holds it.
  }
  set({ age: "under", pending: null, signInNote: null });
}
/** This device answered the age question "too young": guest play only, under the default name and icon. */
export const tooYoung = () => state.age === "under";
/**
 * A guest on a device that answered "too young": no name or icon of their own, nothing typed to us. (Someone signed in
 * there, say in a tab opened before the answer, keeps their account as it is.)
 */
export const youngGuest = () => tooYoung() && !state.profile?.user.signedIn;
/**
 * A sign-in was refused for want of an "old enough" answer (it ran out, or a sign-in in another tab used it up): the
 * question comes back, with `why` on it. (Too young stays too young.)
 */
export function askAgeAgain(why: string = ASK_AGE_LINE) {
  if (!tooYoung()) set({ age: null, ageNote: why });
}

/** Loads the sign-in options and your profile (making a guest account the first time). */
export async function loadAccount(name?: string): Promise<void> {
  let config: NonNullable<AccountState["config"]> | null = null;
  // Your profile is asked for beside the options, not after them (Nov 10: home waits on it, and each request is a round trip). The
  // server plays a device it knows is too young under the default name, whatever name this one sends.
  const storedYoung = storedTooYoung();
  const me = profileFrom(`/api/me${name && !storedYoung ? `?name=${encodeURIComponent(name)}` : ""}`);
  me.catch(() => undefined);
  try {
    config = await api<NonNullable<AccountState["config"]>>("/api/auth/config");
    const young = storedYoung || config.age === "under";
    set({ config, age: young ? "under" : (config.age ?? null) });
    if (young) rememberTooYoung();
    if (!config.accounts) return loadStep("last");
    loadStep("account");
    set({ profile: await me });
    loadStep("last");
    // The server forgot (its cookie was cleared): tell it again, which also puts the guest back to the defaults.
    if (young && config.age !== "under") await sendAgeAnswer(false).catch(() => undefined);
  } catch {
    // (Your profile was the ban answer: the ban screen keeps the sign-in options, for signing in to another account there. ban.ts.)
    if (config && isBanned()) return loadStep("last");
    // No server (local dev) or offline: play on without an account. A server that did answer keeps its test switch when
    // only your profile failed (Oct 25: a CI run lost its ?boss= link that way, the switch going with the profile).
    set({ config: { accounts: false, google: false, email: false, ...(config?.testSwitches ? { testSwitches: true } : {}) } });
    loadStep("last");
  }
}

/**
 * The sign-in options alone, for the ban screen's "Sign in to another account" (a shared device: the server answers a browser marked
 * banned only the ban on /api/me, but lets anyone sign in to their own account on it). Nothing if they're known already.
 */
export async function loadSignInOptions(): Promise<void> {
  if (state.config?.accounts) return;
  try {
    const config = await api<NonNullable<AccountState["config"]>>("/api/auth/config");
    const young = storedTooYoung() || config.age === "under";
    set({ config, age: young ? "under" : (config.age ?? null) });
  } catch {
    // Offline: no sign-in box until the server can say what's set up (the screen asks again when it's back).
  }
}

async function sendAgeAnswer(ok: boolean): Promise<AgeAnswer> {
  const { age } = await api<{ age: AgeAnswer }>("/api/auth/age", { method: "POST", body: JSON.stringify({ oldEnough: ok }) });
  if (age === "under") set({ profile: await api<Profile>("/api/me") });
  return age;
}

/**
 * Answers the age question (before any sign-in): the birth month (1-12) and year are checked here, on the device, and
 * only the answer goes to the server. Too young is remembered at once, before the server hears, so a failed request
 * can't be retried with another answer. Throws the server's message if an "old enough" answer didn't reach it.
 */
export async function answerAge(month: number, year: number): Promise<AgeAnswer> {
  const ok = oldEnough(month, year, new Date());
  if (!ok) {
    rememberTooYoung();
    await sendAgeAnswer(false).catch(() => undefined);
    return "under";
  }
  const age = await sendAgeAnswer(true);
  if (age === "under") rememberTooYoung();
  else {
    set({ age, ageNote: null });
    await finishPendingSignIn();
  }
  return age;
}

/**
 * The sign-in that waited for the answer goes on (Nov 12): the email's code again (no new code, nothing typed again), or Google
 * once more (one more pick of the account). A finish that fails leaves its message, and the address, on the sign-in options.
 */
async function finishPendingSignIn(): Promise<void> {
  const p = state.pending;
  if (!p) return;
  if (p.kind === "google") {
    set({ pending: null });
    return signInWithGoogle(p.next);
  }
  // (The question stays up while the code goes again: success clears `pending`, the server asking again sets it again, and a
  // failure clears it with its note in one render, so the sign-in options open with the note ready. Review of PR #656.)
  try {
    await verifyEmailCode(p.email, p.code);
  } catch (e) {
    set({ pending: null, ...(tooYoung() ? {} : { signInNote: { message: (e as Error).message, email: p.email } }) });
  }
}

/** Back from Google with the server asking the age question first (`?signin=age-google`): the box asks, then Google again. */
export function askAgeForGoogle(next: string) {
  if (!tooYoung()) set({ pending: { kind: "google", next }, ageNote: null });
}

/** A sign-in waiting for the age question is dropped (the box switched to Sign up or Sign in). */
export const dropPendingSignIn = () => void (state.pending && set({ pending: null }));

/** The note a sign-in that waited for the answer left, once: the sign-in options show it as they open. */
export function takeSignInNote(): { message: string; email: string } | null {
  const note = state.signInNote;
  if (note) state = { ...state, signInNote: null };
  return note;
}

/** You've read a moderator's notice (a warning, a chat ban): it goes from your profile here, and on the server. */
export async function chatNoticeSeen(): Promise<void> {
  const p = state.profile;
  if (p?.chatMod?.notice) {
    const { notice: _seen, ...rest } = p.chatMod;
    set({ profile: { ...p, chatMod: rest.block ? rest : undefined } });
  }
  await fetch("/api/chat/notice", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}

let chatReadAt = -Infinity;
/**
 * Your chat ban as the server has it now: your profile again, at most every CHAT_MOD.recheckMs. A chat panel showing a
 * ban asks as it opens, so one a moderator lifted goes without a reload.
 */
export async function refreshChatStanding(now = Date.now()): Promise<void> {
  if (!state.profile || now - chatReadAt < CHAT_MOD.recheckMs) return;
  chatReadAt = now;
  try {
    set({ profile: await api<Profile>("/api/me") });
  } catch {
    // Offline: as it was.
  }
}

export async function updateProfile(patch: { name?: string; icon?: string }): Promise<void> {
  if (!state.profile) return;
  set({ profile: await api<Profile>("/api/me", { method: "PATCH", body: JSON.stringify(patch) }) });
}

/** Your default pawn color (pawn-color.ts): the account's when signed in, this device's for a guest. */
export function myPawnColor(): PawnColor {
  const p = state.profile;
  return p?.user.signedIn ? pawnColorOf(p.user.pawn) : devicePawnColor();
}

/**
 * Picks your default pawn color (the locker's W or B): saved on your account when signed in, on this device otherwise. It shows
 * at once; a save the server refuses puts the color back and throws.
 */
export async function setPawnColor(c: PawnColor): Promise<void> {
  const p = state.profile;
  if (!p?.user.signedIn) {
    setDevicePawnColor(c);
    set({ profile: p });
    return;
  }
  set({ profile: { ...p, user: { ...p.user, pawn: c } } });
  try {
    set({ profile: await api<Profile>("/api/me", { method: "PATCH", body: JSON.stringify({ pawn: c }) }) });
  } catch (e) {
    set({ profile: p });
    throw e;
  }
}

/** The chat's opt-in, kept on a signed-in account (chat-on.ts): the profile as it is after it. */
export async function updateChatOn(on: boolean): Promise<void> {
  const p = state.profile;
  // (Shown at once; the server's answer follows.)
  if (p) set({ profile: { ...p, chatOn: on } });
  set({ profile: await api<Profile>("/api/me", { method: "PATCH", body: JSON.stringify({ chatOn: on }) }) });
}

/** Gets a shop item (free while SHOP_FREE is on, else paid in coins). */
export async function buyShopItem(item: string): Promise<void> {
  if (!state.profile) return;
  const shop = await api<ShopState>("/api/shop/buy", { method: "POST", body: JSON.stringify({ item }) });
  set({ profile: { ...state.profile, shop } });
}

/**
 * Quick chat: the lines and/or emoji you see in your games, in your order (your profile's "Quick chat and emoji");
 * null puts one back to the defaults. The server cleans them (owned lines only, at most the caps) and answers.
 */
export async function saveChatPicks(picks: { [K in keyof ChatPicks]?: ChatPicks[K] | null }): Promise<ChatPicks> {
  if (!state.profile) throw new Error("Quick chat needs your account.");
  const shop = await api<ShopState>("/api/shop/chat", { method: "POST", body: JSON.stringify(picks) });
  set({ profile: { ...state.profile, shop } });
  return shop.chat;
}

/** Equips a shop item you own (a God King effect). */
export async function equipShopItem(item: string): Promise<void> {
  if (!state.profile) return;
  const shop = await api<ShopState>("/api/shop/equip", { method: "POST", body: JSON.stringify({ item }) });
  set({ profile: { ...state.profile, shop } });
}

export interface Locker {
  items: ItemInstance[];
  equipped: Partial<Record<ItemSlot, string>>;
  look: ItemLook;
  /** Series crates you hold, all series together (Nov 9: each opens with a crate key; an older server: null). */
  crates: number | null;
  /** Series crates you hold by crate id ("winter-1"; only those you have some of; missing from an older server). */
  seriesCrates?: Record<string, number>;
  /** Crate keys (an older server: null). */
  keys: number | null;
  /** Boss crates to pick (every 10th level's, Nov 9; missing from an older server). */
  bossPicks?: number;
  /** Boss tokens you have, by boss id (only those you have some of; missing from an older server). */
  tokens?: Record<string, number>;
  /** Boss crates you bought and haven't opened, by crate id ("boss-tiger"; only those you have some of; missing from an older server). */
  bossCrates?: Record<string, number>;
  /**
   * The HunChess Welcome Crates (Nov 6, at 5 and 25 finished games; server/welcome.ts): the finished games so far, the next milestone
   * not earned yet (null: both are), how many wait to be opened, "ready" (one waits), "opened" (all earned are) or "locked" (none
   * earned yet), whether a one-time notice is due, and the latest one's ride. Missing from an older server.
   */
  welcome?: { games: number; next?: number | null; unopened?: number; status: "locked" | "ready" | "opened"; notice: boolean; item?: string };
}

/**
 * Your Welcome Crate progress, as your account has it now (read only; e.g. a tutorial's hint): `next`, the next milestone you haven't
 * earned (5, then 25; null once you have both), and `done`, your finished games so far. Before your account has loaded: the first
 * milestone and 0.
 */
export function welcomeProgress(): { next: 5 | 25 | null; done: number } {
  const w = state.profile?.locker?.welcome;
  const next = w ? (w.next === undefined ? (w.status === "locked" ? 5 : null) : w.next) : 5;
  return { next: next === 5 || next === 25 ? next : null, done: w?.games ?? 0 };
}

/** Closes the "You earned a Welcome Crate!" notice for good (the server keeps that it was seen). */
export async function welcomeNoticeSeen(): Promise<void> {
  const l = state.profile?.locker;
  // (Closed here at once; the server's answer follows.)
  if (state.profile && l?.welcome) set({ profile: { ...state.profile, locker: { ...l, welcome: { ...l.welcome, notice: false } } } });
  try {
    const locker = await api<Locker>("/api/locker/welcome/seen", { method: "POST", body: "{}" });
    if (state.profile) set({ profile: { ...state.profile, locker } });
  } catch {
    // Not important enough to bother the player: it shows again next time.
  }
}

/** Your crate keys and one boss's tokens, as your locker has them now. */
export const tokenCount = (boss: string): { tokens: number; keys: number } => {
  const l = state.profile?.locker;
  return { tokens: l?.tokens?.[boss] ?? 0, keys: l?.keys ?? 0 };
};

/**
 * Buys a boss's crate inside its shop (`way`: 3 of its tokens, or a token and a crate key) into your inventory, unopened (Nov 2: the
 * Crates tab opens it, `openCrate`), on the server, in one transaction (server/boss-tokens.ts), once (postOnce). Your locker comes back
 * with it. Throws the server's message (not enough, the shop resting).
 */
export async function buyBossCrateOnServer(crate: string, way: "tokens" | "key"): Promise<void> {
  const r = await postOnce<{ crate: string; locker: Locker }>("/api/shop/boss-crate", { crate, way });
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
}

/** The claw machine's answer (server/claw.ts): won or not, the crate it won (a BOSS_CRATES id), the boss, and whether it repeats a play. */
export interface ClawAnswer {
  won: boolean;
  crate?: string;
  boss: string;
  again?: boolean;
}

/**
 * Boingo's claw machine (Nov 6): one of `boss`'s tokens in, and the server decides at once whether it won that boss's crate (one
 * transaction: server/claw.ts). `request`: this play's own id, made once per coin, so asking again after a hiccup (no answer, or the
 * server's own error) answers the same play and never spends a second token. Your locker comes back with it. `seed`: the e2e's hook
 * (`?clawSeed=`), which the server honors only where TEST_SWITCHES is on. Throws the server's message (no token, a guest, resting).
 */
export async function playClawOnServer(boss: string, request: string, seed?: number): Promise<ClawAnswer> {
  const body = JSON.stringify({ boss, request, ...(seed !== undefined ? { seed } : {}) });
  const ask = () => api<ClawAnswer & { locker: Locker }>("/api/shop/claw", { method: "POST", body });
  let r: ClawAnswer & { locker: Locker };
  try {
    r = await ask();
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== undefined && status < 500) throw e;
    await new Promise((done) => setTimeout(done, 800));
    r = await ask();
  }
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
  return { won: r.won === true, ...(r.won === true && r.crate ? { crate: r.crate } : {}), boss: r.boss, ...(r.again ? { again: true } : {}) };
}

/** How many of a boss crate ("boss-tiger") you hold, unopened, as your locker has it now. */
export const bossCrateCount = (crate: string): number => state.profile?.locker?.bossCrates?.[crate] ?? 0;

/** An admin's test grant to themselves: crate keys, and a boss's tokens (once: postOnce). Your locker comes back with it. */
export async function grantTestItems(body: { keys?: number; boss?: string; tokens?: number }): Promise<void> {
  const locker = await postOnce<Locker>("/api/locker/grant", body);
  if (state.profile) set({ profile: { ...state.profile, locker } });
}

/**
 * A solo boss battle begins: the server notes when (its id; null when this account earns no tokens, or there's no server). `town`:
 * the boss challenged from the town (Nov 2), whose start the server announces in the town's chat ("Ann challenged Alfil!").
 */
export async function startSoloBossBattle(town?: string): Promise<string | null> {
  if (!state.profile) return null;
  // (Asked again as a finish is: a start lost on the way earned no token and, from the town, said nothing in its chat. A second
  // start replaces the first on the server, one open battle an account, and the chat's line goes out once: the CI flake of Nov 10.)
  return (await askTwice(() => api<{ battle: string | null }>("/api/boss/solo/start", { method: "POST", body: JSON.stringify(town ? { town } : {}) }))).battle;
}

/** Asks, and once more after a moment when the first try fails on the way or on the server (a refusal, a 4xx, isn't asked again). */
async function askTwice<T>(ask: () => Promise<T>): Promise<T> {
  try {
    return await ask();
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== undefined && status < 500) throw e;
    await new Promise((r) => setTimeout(r, 1000));
    return ask();
  }
}

/**
 * A solo boss battle's result screen: whether it counted (by the server's clock) and the token it dropped, if any. Asked a second
 * time after a moment when the first try fails on the way or on the server (a hiccup shouldn't cost a token): the server takes the
 * battle off in one statement, so it's never counted twice.
 */
export async function finishSoloBossBattle(battle: string, end: { outcome: "won" | "lost" | "drew" | "surrendered"; moves: number } | null = null): Promise<{ counted: boolean; token: string | null }> {
  // (`end`: how it ended and your moves, for the town's chat when it was a challenge from the town: "Ann beat Alfil in 34 moves!".)
  return askTwice(() => api<{ counted: boolean; token: string | null }>("/api/boss/solo/finish", { method: "POST", body: JSON.stringify(end ? { battle, ...end } : { battle }) }));
}

/** The token an online boss battle (its lobby code) dropped you, if the server has counted it yet. */
export async function onlineBattleToken(code: string): Promise<string | null> {
  return (await api<{ token: string | null }>(`/api/boss/token?battle=${encodeURIComponent(code)}`)).token;
}

/** Your profile again (after a token dropped: its count in your locker). */
export async function refreshProfile(): Promise<void> {
  if (state.profile) set({ profile: await api<Profile>("/api/me") });
}

/**
 * Opens a crate on the server, once (postOnce: a retry answers the same item). `force`: the test switches (?fischer=1, ?shiny=1),
 * honored only for those allowed them (test-switches.ts; the server checks too) and while crates are free.
 */
export async function openCrate(crate: string, force: { fischer?: boolean; shiny?: boolean } = {}): Promise<{ roll: CrateRoll; item: ItemInstance }> {
  const r = await postOnce<{ roll: CrateRoll; item: ItemInstance; locker: Locker }>("/api/locker/open", { crate, ...force });
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
  return { roll: r.roll, item: r.item };
}

/** Picks a level's boss crate (Nov 9): into your boss crates, unopened. Answers the crate's id. */
export async function pickBossCrate(crate: string): Promise<string> {
  const r = await postOnce<{ crate: string; locker: Locker }>("/api/locker/pick", { crate });
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
  return r.crate;
}

/** Wears a crate item in its slot (null empties the slot). */
export async function equipLockerItem(slot: ItemSlot, item: string | null): Promise<void> {
  if (!state.profile) return;
  const locker = await api<Locker>("/api/locker/equip", { method: "POST", body: JSON.stringify({ slot, item }) });
  set({ profile: { ...state.profile, locker } });
}

/** Deletes crate items you own, for good. */
export async function deleteLockerItems(items: string[]): Promise<void> {
  if (!state.profile) return;
  const locker = await api<Locker>("/api/locker/delete", { method: "POST", body: JSON.stringify({ items }) });
  set({ profile: { ...state.profile, locker } });
}

/** Off to Google; it sends you back to `next` (this page by default). */
export const signInWithGoogle = (next = location.pathname) => {
  location.href = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
};

/** Online play needs signing in (once sign-in is set up); guests play solo against bots. */
export const mustSignInToPlayOnline = () => !!state.config?.onlineNeedsSignIn && !state.profile?.user.signedIn;

export async function sendEmailCode(email: string): Promise<void> {
  await api("/api/auth/email/start", { method: "POST", body: JSON.stringify({ email }) });
}

/**
 * Signs in with an emailed code. The server may ask the age question first (Nov 12: an email with no account yet, or an account
 * from before the question): then the code is kept, here and on the server, and the answer sends it again (finishPendingSignIn).
 */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  try {
    // (Signing in uses an age answer up: the next sign-in into an account that hasn't answered asks again.)
    set({ profile: await api<Profile>("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) }), age: null, pending: null });
  } catch (e) {
    if ((e as { askAge?: boolean }).askAge && !tooYoung()) return set({ pending: { kind: "email", email, code }, ageNote: null });
    throw e;
  }
}

export async function signOut(): Promise<void> {
  set({ profile: await api<Profile>("/api/auth/logout", { method: "POST" }), age: tooYoung() ? "under" : null });
}

/** "Download my data" (Settings): everything the server keeps about your account, as a JSON file. */
export const ACCOUNT_DATA_URL = "/api/me/data";

/**
 * Deletes your account for good (Settings → Delete account, after its confirmation): the server deletes everything
 * personal and signs you out on every device. Then this device forgets you too (everything the app keeps in its
 * storage, settings included) and the app starts afresh, as a new visitor. Throws the server's message on failure.
 */
export async function deleteMyAccount(): Promise<void> {
  await api("/api/me/delete", { method: "POST", body: JSON.stringify({ confirm: "delete" }) });
  try {
    // (Except a "too young" answer: it's this device's, not the account's.)
    for (const k of Object.keys(localStorage)) if ((k.startsWith("brc.") || k.startsWith("hunchess-")) && k !== TOO_YOUNG_KEY) localStorage.removeItem(k);
  } catch {
    // No storage to clear.
  }
  location.replace("/");
}

/** A solo match's result, onto your profile (online matches are saved by the server). */
export async function recordSoloResult(r: {
  mode: "classic" | "crowd" | "boss";
  placement: number;
  players: number;
  team?: "w" | "b" | null;
  teamWon?: boolean | null;
  avgScore?: number | null;
  rating?: number | null;
  /** The profile's stats: brilliant moves, the best move, cuts and strikes faced and survived, the boss. */
  brilliant?: number | null;
  bestMove?: string | null;
  cuts?: number | null;
  cutsSurvived?: number | null;
  strikes?: number | null;
  strikesSurvived?: number | null;
  survived?: boolean | null;
  lastStand?: boolean | null;
  bossElo?: number | null;
  /** Whether the eval bar was on (testers only since Oct 15), so we can see later who played without it. */
  evalBar: boolean;
  /**
   * XP (Nov 9): the game's id from startSoloGame (the server times it by its own clock), your moves, whether you won or resigned,
   * and whether a test switch was on: the device's word, which can only lower the XP (server/xp.ts).
   */
  game?: string | null;
  moves?: number;
  won?: boolean;
  resigned?: boolean;
  /** Removed for idling (the server answers "No XP: you left the match."). */
  left?: boolean;
  test?: boolean;
}): Promise<XpGrant | null> {
  if (!state.profile) return null;
  try {
    const answer = await api<{ xp?: XpGrant | null }>("/api/results", { method: "POST", body: JSON.stringify(r) });
    set({ profile: await api<Profile>("/api/me") });
    return answer.xp ?? null;
  } catch {
    // Not important enough to bother the player.
    return null;
  }
}

/** A solo game begins (XP, Nov 9): the server notes when, by its own clock; its id goes back with the result. Null: no account yet. */
export async function startSoloGame(body: { xpgame?: number }): Promise<string | null> {
  if (!state.profile) return null;
  return (await api<{ game: string | null }>("/api/xp/solo/start", { method: "POST", body: JSON.stringify(body) })).game;
}

/** Your XP from an online game (its lobby's code), once its room has written it; null until then. */
export async function onlineGameXp(code: string): Promise<XpGrant | null> {
  return (await api<{ xp: XpGrant | null }>(`/api/xp?game=${encodeURIComponent(code)}`)).xp;
}

/** The test switch ?xp=<n> (test servers only, since Nov 9: review of #574 M1): sets your XP, then your profile again. */
export async function setTestXp(xp: number): Promise<void> {
  await api("/api/xp/test", { method: "POST", body: JSON.stringify({ xp }) });
  set({ profile: await api<Profile>("/api/me") });
}

/** Your quests (Nov 9, phase 3; the server deals the day's on the day's first read: server/quests.ts). */
export async function fetchQuests(): Promise<QuestsAnswer> {
  return api<QuestsAnswer>("/api/quests");
}

/** Today's free reroll of a daily quest: your quests after it (a refusal throws its message). */
export async function rerollQuestNow(quest: string): Promise<QuestsAnswer> {
  return (await api<{ quests: QuestsAnswer }>("/api/quests/reroll", { method: "POST", body: JSON.stringify({ quest }) })).quests;
}

/** The test switch ?quests=<kind>[:<progress>],… (test servers only): your quests set to these. */
export async function setTestQuests(quests: { kind: string; progress: number }[]): Promise<QuestsAnswer> {
  return api<QuestsAnswer>("/api/quests/test", { method: "POST", body: JSON.stringify({ quests }) });
}

/** The name you play under: your profile's, else this device's, else "Player". */
export function playerName(): string {
  const n = state.profile?.user.name;
  if (n) return n;
  try {
    return localStorage.getItem("brc.name") || "Player";
  } catch {
    return "Player";
  }
}

/** Anyone's profile, as anyone sees it (GET /api/profile/ID): nothing private. See the server's accounts.ts. */
export interface PublicProfile {
  id: string;
  name: string;
  /** Their icon: a drawing (a PNG data URL), an older account's emoji, or the default pawn "♟" (missing from an older server). */
  icon?: string;
  look: ItemLook;
  /** Their default pawn color (missing from an older server: white). */
  pawn?: PawnColor;
  joinedAt: number;
  lastSeen: number | null;
  online: boolean;
  /** They hide when they're online (Settings → Friends): `online` false and `lastSeen` null. */
  hidden?: boolean;
  /** Their level (Nov 9: from their XP). Missing from an older server. */
  level?: number;
  rating: number | null;
  topPercent: number | null;
  /** Banned for fair play (the profile says so; nothing else about fair play is shown). */
  banned?: boolean;
  /** Ranked 1 v 1: the rank shown everywhere, the record, the peak, the streak and the recent games (null when banned; missing from an older server). */
  ranked1v1?: RankedSummary | null;
  crowd: { games: number; wins: number; avgPlace: number | null; best: number | null; cutsSurvivedPct: number | null; brilliant: number | null };
  boss: { raids: number; bossesBeaten: number; strikesSurvived: number | null; lastStands: number | null; survivedPct: number | null; brilliant: number | null };
  ratingHistory: number[];
  bossesBeaten: number[];
  recent: {
    mode: string;
    online: boolean;
    placement: number;
    players: number;
    team: "w" | "b" | null;
    won: boolean | null;
    survived: boolean | null;
    bestMove: string | null;
    bossElo: number | null;
    bossId?: string | null;
    playedAt: number;
    /** It counted for ranking (false: under 30% real players, solo or practice; null: from before the rule). */
    ranked?: boolean | null;
  }[];
}

/**
 * Reports a player (a profile's Report button; `match`: the lobby's code when it's made during a match; `line`: the
 * number of their line in the town square's chat, whose words the server reads from its room). Answers with what to
 * tell the reporter ("Thanks, we'll look into it.", or that they already reported them).
 */
export async function reportPlayer(target: string, reason: string, match?: string, line?: number, townroom?: string): Promise<string> {
  const r = await api<{ message?: string }>("/api/report", { method: "POST", body: JSON.stringify({ target, reason, ...(match ? { match } : {}), ...(line ? { line } : {}), ...(townroom ? { townroom } : {}) }) });
  return r.message ?? "Thanks, we'll look into it.";
}

export async function fetchProfile(id: string): Promise<PublicProfile> {
  return api<PublicProfile>(`/api/profile/${encodeURIComponent(id)}`);
}
