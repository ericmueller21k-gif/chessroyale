import { ASK_AGE_LINE, CHAT_MOD, FRONT_DOOR, SOLO_ABANDON, oldEnough, pawnColorOf, type ChatPicks, type PawnColor, type ShopState } from "@chessroyale/core";
import { devicePawnColor, setDevicePawnColor } from "./prefs.ts";
import { loadStep } from "./loadbar.ts";
import { KEPT_KEY, askForfeit, claimKeptSolo, clearKeptSolo, keptReal, keptSoloFor, keptStale, loadKeptSolo, type KeptSolo } from "./solo-kept.ts";
import { gateAnswered, noteSiteReached, noteSiteSignedOut, onSiteGate, siteSignedOut } from "./site-gate.ts";
import type { BonusRoll, CrateRoll, ItemInstance, ItemLook, ItemSlot, QuestsAnswer, RankedLeaves, RankedSummary, XpGrant } from "@chessroyale/core";
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
  /** Ranked 1 v 1: the rank ("Gold II – 45", "Placement 2/5") and the record (missing from an older server). */
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
  /** Only when the read named the game this device keeps (`resume`, step 2): whether it's still your open solo game. */
  soloOpen?: boolean;
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
  /**
   * Why your account didn't load (null: it loaded, or it's loading): Profile and Settings say why, with Try again (Nov 20: Profile sat
   * on "Loading…" for good). The app plays on without an account meanwhile (`config.accounts` false).
   */
  failed: AccountFailure | null;
  /**
   * The solo boss battle this device keeps for this account, still open on the server as the load checked it (step 2, Nov 22): its card
   * offers Resume or Forfeit (components/GameInProgress.tsx). Null: none, another account's, stale, played in another tab, or answered.
   */
  soloKept: KeptSolo | null;
}

/**
 * Why the account's load failed: no answer reached us ("offline": no connection, or none in time), our server's own failure ("server"),
 * or the site's gate before launch, signed out of it ("gate": site-gate.ts).
 */
export type AccountFailure = "offline" | "server" | "gate";

/** What a failed request's error was (api()'s errors): the gate's answer, no answer at all, or the server's. */
export function failureOf(e: unknown): AccountFailure {
  const err = e as { gate?: boolean; status?: number };
  if (err?.gate) return "gate";
  return err?.status === undefined ? "offline" : "server";
}

/** The age question's answer: old enough to sign in, or too young (docs/decisions/2026-10-16-age-gate-and-real-money.md). */
export type AgeAnswer = "ok" | "under";

/**
 * A sign-in waiting for the age question's answer (docs/decisions/2026-11-12-signin-without-age.md). Email: its address and
 * code, sent again with the answer (in memory only; the server kept the code live for it). Google: one more trip there, back to
 * `next`, as the server keeps nothing about a Google account before the answer.
 */
export type PendingSignIn = { kind: "email"; email: string; code: string } | { kind: "google"; next: string };

let state: AccountState = { config: null, profile: null, age: null, ageNote: null, pending: null, signInNote: null, failed: null, soloKept: null };
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

/**
 * A request to our API, its answer read: an error with the server's words and its status when it isn't ok, the site's gate read as
 * being signed out of the site, and an answer that can't be read a failure (never `{}`). Exported for the season ladder (ladder.ts).
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // (`redirect: "manual"`: our API never redirects a script's request, so a redirect is the site's gate, read as such: followed, its
  // login page on another origin failed like being offline, and nothing knew why. site-gate.ts.)
  const res = await fetch(path, { credentials: "same-origin", redirect: "manual", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (gateAnswered(res)) {
    noteSiteSignedOut();
    throw Object.assign(new Error("You're signed out of the site."), { status: 0, gate: true });
  }
  noteSiteReached();
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
    return await api<Profile>(path, inTime());
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== undefined && status < 500) throw e;
    await new Promise((r) => setTimeout(r, PROFILE_RETRY_MS));
    return api<Profile>(path, inTime());
  }
}
/** A load request given up after FRONT_DOOR.accountTimeoutMs (an error with no status: "offline"), so no screen waits on it for good. */
const inTime = (): RequestInit => (typeof AbortSignal.timeout === "function" ? { signal: AbortSignal.timeout(FRONT_DOOR.accountTimeoutMs) } : {});
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
  lastName = name;
  retryOnReturn();
  let config: NonNullable<AccountState["config"]> | null = null;
  // Your profile is asked for beside the options, not after them (Nov 10: home waits on it, and each request is a round trip). The
  // server plays a device it knows is too young under the default name, whatever name this one sends.
  const storedYoung = storedTooYoung();
  // (A solo game left after SOLO_ABANDON.minMoves goes on your record as a loss as the profile is read (`settle`), unless a tab of
  // this device is still playing it or a finished one's result is still to be sent, whose game is named (`unsent`): server/xp.ts.)
  const unsent = unsentResult();
  const q = new URLSearchParams();
  if (name && !storedYoung) q.set("name", name);
  if (!unsent && !soloLiveOnDevice()) q.set("settle", "1");
  // (A solo boss battle this device keeps (step 2): named, so the settle leaves it be unless stale, and the answer says if it's open.
  // Its card, once offered, follows what other tabs do.)
  followOtherTabs();
  const kept = loadKeptSolo();
  if (kept && !keptStale(kept)) q.set("resume", kept.game);
  const me = profileFrom(meUrl(q));
  me.catch(() => undefined);
  try {
    config = await api<NonNullable<AccountState["config"]>>("/api/auth/config", inTime());
    const young = storedYoung || config.age === "under";
    set({ config, age: young ? "under" : (config.age ?? null) });
    if (young) rememberTooYoung();
    if (!config.accounts) return void (set({ failed: null }), loadStep("last"));
    loadStep("account");
    const { soloOpen, ...profile } = await me;
    set({ profile, failed: null, soloKept: keptOnLoad(kept, profile.user.id, soloOpen) });
    loadStep("last");
    if (unsent) void sendUnsentResult(true);
    // The server forgot (its cookie was cleared): tell it again, which also puts the guest back to the defaults.
    if (young && config.age !== "under") await sendAgeAnswer(false).catch(() => undefined);
  } catch (e) {
    // No server (local dev) or offline: play on without an account, and say why where the account shows (`failed`). A server that did
    // answer keeps its test switch when only your profile failed (Oct 25: a CI run lost its ?boss= link that way, the switch going with
    // the profile).
    set({ config: { accounts: false, google: false, email: false, ...(config?.testSwitches ? { testSwitches: true } : {}) }, failed: failureOf(e) });
    loadStep("last");
  }
}
let lastName: string | undefined;

/**
 * The kept solo battle as the load found it (step 2): this account's, not stale and still open on the server (`soloOpen`): offered on its
 * card, even while another tab's live note names it (the delta review of #885, D3: a page the phone killed without `pagehide` leaves
 * its note behind, and its own reload read it as another tab's; a Resume's claim makes a takeover safe: solo-kept.ts SoloKeep). A stale
 * one (the server records it as left) or this account's that isn't open (recorded, finished, or replaced by another device's start) is
 * dropped. Another account's stays on the device, never offered.
 */
function keptOnLoad(kept: KeptSolo | null, user: string, open: boolean | undefined): KeptSolo | null {
  if (!kept) return null;
  // (Its result kept unsent: the game has ended (I4), and the load sends that result.)
  if (keptStale(kept) || (kept.user === user && open === false) || unsentGame() === kept.game) {
    clearKeptSolo(kept.game);
    return null;
  }
  return kept.user === user && open === true ? kept : null;
}

/**
 * `k`'s game has ended: its result is kept on this device, unsent (the review of #885, I4: a battle played to its end once stayed kept,
 * and a Forfeit then posted a loss over a win still to be sent). Never offered, resumed or forfeited: dropped, and its result sent (not
 * over a post still on its way: sendUnsentResult's wait).
 */
function keptEnded(k: Pick<KeptSolo, "game">): boolean {
  if (unsentGame() !== k.game) return false;
  clearKeptSolo(k.game);
  void sendUnsentResult(true);
  return true;
}
/** The kept game for this account (keptSoloFor: not stale), unless its game has ended (keptEnded). */
function keptNow(user: string | null | undefined): KeptSolo | null {
  const k = keptSoloFor(user);
  return k && !keptEnded(k) ? k : null;
}

/**
 * Before another solo game starts on this device (any solo mode, a Battle Tower floor): the kept game for this account, if any and not
 * ended, asks first, "Forfeit your game in progress?" (solo-kept.ts askForfeit). True: none, or Forfeit; false: Cancel.
 */
export const askForfeitFirst = (user: string | null | undefined): Promise<boolean> => askForfeit(keptNow(user));

/** The kept solo battle answered (Resume or Forfeit) or offered again (Boss Battle opened: `k`): its card shows while this is set. */
export function offerKeptSolo(k: KeptSolo | null): void {
  if (state.soloKept !== k) set({ soloKept: k });
}
/**
 * A card on screen follows what another tab of this device does (the review of #885, I1): played on there (its move number), ended or
 * forfeited: offered again as it is now, or taken off.
 */
let followingTabs = false;
function followOtherTabs(): void {
  if (followingTabs || typeof addEventListener !== "function") return;
  followingTabs = true;
  addEventListener("storage", (e: StorageEvent) => {
    if (state.soloKept && (e.key === null || e.key === KEPT_KEY || e.key === UNSENT_KEY)) reofferKeptSolo();
  });
}

/** Why a Resume or Forfeit from the card is refused (shown on home: solo-kept.ts keptNote). */
export const KEPT_ENDED = "That game has already ended.";
/** A tab whose kept game another tab took over, ended or replaced, as it stops (App.tsx lostToTab). */
export const KEPT_ELSEWHERE = "Played in another tab.";
/**
 * Resume's tap (the review of #885, I1): the kept game as it is now, not the card's copy (another tab may have played on, ended or
 * taken it since the card came): still this game, not ended (its result kept unsent: then sent, keptEnded), and claimed for this tab,
 * so a tab that plays it on stops at its next keep. Not refused while another tab's live note names it (the delta review, D3: one tab's
 * page killed without `pagehide` locked its own reload out for SOLO_ABANDON.liveMinutes; the claim already makes a takeover safe). The
 * entry to play, or why not.
 */
export function takeKeptSolo(card: KeptSolo): KeptSolo | string {
  if (keptEnded(card)) return KEPT_ENDED;
  const k = keptNow(card.user);
  if (!k || k.game !== card.game) return KEPT_ENDED;
  claimKeptSolo(k);
  return k;
}

/** Boss Battle opened with no match on (step 2): the kept game for this account offered again, as at the load. Resume checks it with the server. */
export function reofferKeptSolo(): void {
  offerKeptSolo(keptNow(state.profile?.user.id));
}

/**
 * Resume's check (step 2): the kept game is still your open game on the server (a profile read naming it): another device's start since
 * the load records or replaces it. No answer (offline): yes, played on here (its result goes when it can).
 */
export async function keptSoloOpen(k: KeptSolo): Promise<boolean> {
  if (keptEnded(k)) return false;
  try {
    const p = await api<Profile>(meUrl(new URLSearchParams({ resume: k.game })));
    const { soloOpen, ...profile } = p;
    set({ profile });
    if (soloOpen === false) clearKeptSolo(k.game);
    return soloOpen !== false;
  } catch {
    return true;
  }
}

/**
 * Forfeit (step 2): the kept game given up, as it is now (the card's copy may be old: takeKeptSolo's checks, I1). Past
 * SOLO_ABANDON.minMoves it's recorded as a loss now (POST /api/xp/solo/forfeit, with its facts in case its 10-move mark never landed);
 * under it, just dropped, nothing recorded. Dropped on the device at once either way: a forfeit that gets no answer leaves a real game on
 * the server, recorded as left at the next load or start. A tab still playing it stops at its next keep (a Forfeit is an explicit loss:
 * never refused for another tab's live note, D3). Null: done; else why not (ended, its result sent instead, never a forfeit over it: I4).
 */
export async function forfeitKeptSolo(card: KeptSolo): Promise<string | null> {
  if (state.soloKept?.game === card.game) set({ soloKept: null });
  if (keptEnded(card)) return KEPT_ENDED;
  const k = keptNow(card.user);
  if (!k || k.game !== card.game) return KEPT_ENDED;
  clearKeptSolo(k.game);
  if (!keptReal(k)) return null;
  try {
    await api("/api/xp/solo/forfeit", { method: "POST", body: JSON.stringify({ game: k.game, real: k.facts }) });
    if (state.profile) set({ profile: await api<Profile>(meUrl()) });
  } catch {
    // (Recorded as left at the next load or start instead.)
  }
  return null;
}

/** Try again (Profile's and Settings' button, and back online after failing offline): the account's load once more. */
export function retryAccount(): Promise<void> {
  return loadAccount(lastName);
}
let watching = false;
/** (Back online after failing offline, or let in by the site's gate again, from another tab, say: the account loads by itself.) */
function retryOnReturn() {
  if (watching) return;
  watching = true;
  if (typeof addEventListener === "function") addEventListener("online", () => void (state.failed === "offline" && retryAccount()));
  onSiteGate(() => void (!siteSignedOut() && state.failed === "gate" && retryAccount()));
}

async function sendAgeAnswer(ok: boolean): Promise<AgeAnswer> {
  const { age } = await api<{ age: AgeAnswer }>("/api/auth/age", { method: "POST", body: JSON.stringify({ oldEnough: ok }) });
  if (age === "under") set({ profile: await api<Profile>(meUrl()) });
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
    set({ profile: await api<Profile>(meUrl()) });
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
  /** Boss crates to pick (every XP.bossCrateEvery-th level's, Nov 9; missing from an older server). */
  bossPicks?: number;
  /** Coin Boost Crates you hold, unopened (Nov 26: a daily quest's drop; missing from an older server). */
  boostCrates?: number;
  /** The coin boost's minutes of play left (an opened Coin Boost Crate's; missing from an older server). */
  boostMinutes?: number;
  /** The Crate Bonus's paying level-ups left (a daily quest's drop; missing from an older server). */
  crateBonus?: number;
  /** Boss tokens you have, by boss id (only those you have some of; missing from an older server). */
  tokens?: Record<string, number>;
  /** Boss crates you bought and haven't opened, by crate id ("boss-tiger"; only those you have some of; missing from an older server). */
  bossCrates?: Record<string, number>;
  /**
   * How many of the crates above (series and boss) are bonus ones, by crate id (Nov 24: an opening's bonus crate; it opens after the
   * ordinary ones of its kind and never gives a bonus itself; missing from an older server).
   */
  bonusCrates?: Record<string, number>;
  /**
   * The HunChess Welcome Crates (Nov 6; since Nov 27 the first on the first visit, the second at 25 finished games; server/welcome.ts): the finished games so far, the next milestone
   * not earned yet (null: both are), how many wait to be opened, "ready" (one waits), "opened" (all earned are) or "locked" (none
   * earned yet), whether a one-time notice is due, and the latest one's ride. Missing from an older server.
   */
  welcome?: { games: number; next?: number | null; unopened?: number; status: "locked" | "ready" | "opened"; notice: boolean; item?: string };
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

/**
 * An admin's test grant to themselves: crate keys, a boss's tokens, crates, Coin Boost Crates and Crate Bonuses (Nov 26) (once: postOnce).
 * Your locker comes back with it.
 */
export async function grantTestItems(body: { keys?: number; boss?: string; tokens?: number; crate?: string; crates?: number; boost?: number; crateBonus?: number }): Promise<void> {
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
  if (state.profile) set({ profile: await api<Profile>(meUrl()) });
}

/** What a crate's opening can be asked for in a test (the test switches): Fischer Random, a shiny, a bonus crate (any, or that one). */
export type OpenForce = { fischer?: boolean; shiny?: boolean; bonus?: true | string };
/** A crate's opening, as the server answers it: the item, and (Nov 24) the bonus crate it gave, if any. */
export type Opened = { roll: CrateRoll; item: ItemInstance; bonus?: BonusRoll };

/**
 * Opens a crate on the server, once (postOnce: a retry answers the same item and bonus). `force`: the test switches (?fischer=1,
 * ?shiny=1, ?bonus=1 or ?bonus=<crate>), honored only for those allowed them (test-switches.ts; the server checks too). The locker it
 * answers (the bonus crate and its key in it) is yours at once.
 */
export async function openCrate(crate: string, force: OpenForce = {}): Promise<Opened> {
  const r = await postOnce<Opened & { locker: Locker }>("/api/locker/open", { crate, ...force });
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
  return { roll: r.roll, item: r.item, ...(r.bonus ? { bonus: r.bonus } : {}) };
}

/** Opens a Coin Boost Crate you hold (Nov 26; free, no key: COIN_BOOST.minutes of boost on), once (postOnce). Your locker comes back. */
export async function openBoostCrate(): Promise<void> {
  const r = await postOnce<{ locker: Locker }>("/api/locker/boost", {});
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
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

/**
 * Off to Google; it sends you back to `next` (this page by default). (A finished game's result still to be sent goes first, outliving
 * the page: a guest's open game is recorded as left as it joins an account, SOLO_ABANDON.)
 */
export const signInWithGoogle = (next = location.pathname) => {
  void sendUnsentResult();
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
  // (A finished game's result still to be sent goes first: a guest's open game is recorded as left as it joins an account.)
  await sendUnsentResult();
  try {
    // (Signing in uses an age answer up: the next sign-in into an account that hasn't answered asks again.)
    set({ profile: await api<Profile>("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) }), age: null, pending: null });
  } catch (e) {
    if ((e as { askAge?: boolean }).askAge && !tooYoung()) return set({ pending: { kind: "email", email, code }, ageNote: null });
    throw e;
  }
}

export async function signOut(): Promise<void> {
  // (A finished game's result still to be sent goes first: the next account's device would drop it as another's, and the game would
  // then be recorded as left.)
  await sendUnsentResult();
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
  /** A Battle Tower floor: XP and the profile as any boss battle, never the boss quests (Eric, Nov 20; core soloQuestMode). */
  tower?: boolean;
}): Promise<XpGrant | null> {
  if (!state.profile) return null;
  // (A game you finished is never recorded as left (SOLO_ABANDON): its result is kept on the device before it's posted, so a page closed
  // or reloaded mid-post still has it, and taken off only once the server has answered; sent again before your next solo game and at
  // the next load (sendUnsentResult). `keepalive`: the post itself outlives a page that goes.)
  if (r.game) {
    sendOtherFirst(r.game);
    keepUnsent({ user: state.profile.user.id, result: r, at: Date.now() });
  }
  let answer: { xp?: XpGrant | null };
  try {
    answer = await api<{ xp?: XpGrant | null }>("/api/results", { method: "POST", body: JSON.stringify(r), keepalive: true });
  } catch (e) {
    // (Not important enough to bother the player.)
    if (r.game) answered(r.game, !sendAgain(e));
    return null;
  }
  if (r.game) answered(r.game, true);
  try {
    set({ profile: await api<Profile>(meUrl()) });
  } catch {
    // The profile as it was.
  }
  return answer.xp ?? null;
}

/**
 * A post that may not have reached the server's record, to send again: no answer (offline, the page gone, the site's gate), a server
 * error (any 5xx, 502 "couldn't be read" included) or too many requests (429). Any other answer (a 2xx, a 4xx refusal) is final.
 */
const sendAgain = (e: unknown): boolean => {
  const status = (e as { status?: number } | null)?.status;
  return !status || status === 429 || status >= 500;
};

/** A solo game begins (XP, Nov 9): the server notes when, by its own clock; its id goes back with the result. Null: no account yet. */
export async function startSoloGame(body: { xpgame?: number }): Promise<string | null> {
  if (!state.profile) return null;
  // (A start records the open game as left if it's real (SOLO_ABANDON): a finished game's result that couldn't be sent goes first, and
  // if it still can't be, the start names it (`unsent`) so its game is never recorded as left.)
  await sendUnsentResult(true);
  const unsent = unsentGame();
  return (await api<{ game: string | null }>("/api/xp/solo/start", { method: "POST", body: JSON.stringify({ ...body, ...(unsent ? { unsent } : {}) }) })).game;
}

/** What a solo game's loss would record if it's left after SOLO_ABANDON.minMoves (the server checks it: server/xp.ts SoloReal). */
export interface SoloRealFacts {
  mode: "classic" | "crowd" | "boss";
  players: number;
  team: "w" | "b" | null;
  bossId: string | null;
  bossElo: number | null;
}

/**
 * Your SOLO_ABANDON.minMoves-th own move in a solo game: the server is told that it's real (left now, a loss). True once it answered
 * (a refusal too: the game isn't open any more); false: try again at your next move (no answer, a server error, too many requests).
 */
export async function markSoloGameReal(game: string, facts: SoloRealFacts): Promise<boolean> {
  try {
    await api("/api/xp/solo/real", { method: "POST", body: JSON.stringify({ game, ...facts }) });
    return true;
  } catch (e) {
    return !sendAgain(e);
  }
}

/**
 * A tab of this device playing a real solo game (SOLO_ABANDON): the game's id and its last turn, kept on the device so the app's load in
 * another tab doesn't record it as left while it's played (`liveMinutes`). This tab's own game is `liveHere`. Taken off as it ends
 * and as the page goes (a reload: then the load records it as left).
 */
const SOLO_LIVE_KEY = "brc.soloLive";
let liveHere: string | null = null;
let hideWatched = false;
export function keepSoloLive(game: string): void {
  liveHere = game;
  if (!hideWatched && typeof addEventListener === "function") {
    hideWatched = true;
    addEventListener("pagehide", () => void (liveHere && endSoloLive(liveHere)));
  }
  try {
    localStorage.setItem(SOLO_LIVE_KEY, JSON.stringify({ game, at: Date.now() }));
  } catch {
    // No storage: this tab still knows.
  }
}
export function endSoloLive(game: string): void {
  if (liveHere === game) liveHere = null;
  try {
    if ((JSON.parse(localStorage.getItem(SOLO_LIVE_KEY) ?? "null") as { game?: string } | null)?.game === game) localStorage.removeItem(SOLO_LIVE_KEY);
  } catch {
    // No storage.
  }
}
/**
 * This tab no longer plays `game`: another tab took it over (solo-kept.ts SoloKeep's `lost`). Its live note is that tab's now: left on
 * the device (this tab's `pagehide` doesn't take it off).
 */
export function leftSoloLive(game: string): void {
  if (liveHere === game) liveHere = null;
}
/** A real solo game is being played on this device: in this tab, or in another whose last turn was under SOLO_ABANDON.liveMinutes ago. */
export function soloLiveOnDevice(now = Date.now()): boolean {
  if (liveHere) return true;
  try {
    const kept = JSON.parse(localStorage.getItem(SOLO_LIVE_KEY) ?? "null") as { at?: unknown } | null;
    return typeof kept?.at === "number" && now - kept.at < SOLO_ABANDON.liveMinutes * 60_000;
  } catch {
    return false;
  }
}

/**
 * A finished solo game's result not yet answered by the server, with the account it's for: kept as the game was decided, on its way,
 * or it couldn't be sent. `at`: when its post went (one may still be on its way, from this tab, another or a page since gone); none
 * while no post is (kept as the game was decided, or its post failed).
 */
const UNSENT_KEY = "brc.soloUnsent";
type Unsent = { user: string; result: Record<string, unknown>; at?: number };
function keepUnsent(u: Unsent | null): void {
  try {
    if (u) localStorage.setItem(UNSENT_KEY, JSON.stringify(u));
    else localStorage.removeItem(UNSENT_KEY);
  } catch {
    // No storage: the result is lost, as before.
  }
}
/**
 * The post of `game`'s result answered: taken off (`final`: a 2xx or a refusal), or kept with no post on its way (a failure to send
 * again: sendAgain). Unless another game's result has been kept since.
 */
function answered(game: unknown, final: boolean): void {
  const u = unsentResult();
  if (u && u.result.game === game) keepUnsent(final ? null : { user: u.user, result: u.result });
}
function unsentResult(): Unsent | null {
  try {
    const u = JSON.parse(localStorage.getItem(UNSENT_KEY) ?? "null") as Unsent | null;
    return u && typeof u.user === "string" && u.result && typeof u.result === "object" ? u : null;
  } catch {
    return null;
  }
}
/**
 * A real solo game's result the moment it's decided (xp.ts, SOLO_ABANDON), before any end moment plays: kept on the device with no post
 * on its way yet. The result screen's post then takes it over (recordSoloResult); a page gone first has it sent at the next load.
 */
export function keepSoloResult(game: string, result: Record<string, unknown>): void {
  if (!state.profile) return;
  sendOtherFirst(game);
  keepUnsent({ user: state.profile.user.id, result: { ...result, game } });
}
/**
 * A new game's result is about to take the one slot: another game's kept there is sent first, else it would be overwritten and that game
 * left with no result at all (the second delta review, N2). Whatever its `at`: by now its post has long had time to land, and a result
 * sent twice is recorded once. Its post starts here, before the slot changes (sendUnsentResult reads it and posts at once), and its
 * answer leaves the new one be (`answered` checks the game).
 */
function sendOtherFirst(game: string): void {
  const other = unsentGame();
  if (other && other !== game) void sendUnsentResult();
}
/** The game of a result still to be sent, which the server then never records as left (`unsent`, server/xp.ts). */
function unsentGame(): string | null {
  const game = unsentResult()?.result.game;
  return typeof game === "string" ? game : null;
}
/** GET /api/me, naming the game of a result still to be sent: a profile read never records it as left (SOLO_ABANDON.staleHours). */
function meUrl(q = new URLSearchParams()): string {
  const unsent = unsentGame();
  if (unsent) q.set("unsent", unsent);
  return `/api/me${q.size ? `?${q}` : ""}`;
}
/**
 * Sends a kept result again (`resent`: no time XP for it, as the server's clock ran on after the game: server api.ts); its game's row
 * is then taken off as usual, and a game recorded already writes nothing. Kept again on the same failures as the first post
 * (sendAgain). Another account's (signed out since, a guest merged into an account) is dropped: never sent as this one's.
 * `waitPosted` (the load's and a start's): not while a post of it may still be on its way (`at`, under SOLO_ABANDON.resendAfterMs ago:
 * a re-send overtaking it would take its game, and the game's XP); reads and starts name its game meanwhile (`unsent`). A sign-in or
 * out sends it whatever: the account changes after.
 */
async function sendUnsentResult(waitPosted = false): Promise<void> {
  const u = unsentResult();
  if (!u || !state.profile) return;
  if (u.user !== state.profile.user.id) return keepUnsent(null);
  const now = Date.now();
  if (waitPosted && u.at !== undefined && now - u.at >= 0 && now - u.at < SOLO_ABANDON.resendAfterMs) return;
  keepUnsent({ ...u, at: now });
  try {
    await api("/api/results", { method: "POST", body: JSON.stringify({ ...u.result, resent: true }), keepalive: true });
    answered(u.result.game, true);
  } catch (e) {
    answered(u.result.game, !sendAgain(e));
  }
}

/** Your XP from an online game (its lobby's code), once its room has written it; null until then. */
export async function onlineGameXp(code: string): Promise<XpGrant | null> {
  return (await api<{ xp: XpGrant | null }>(`/api/xp?game=${encodeURIComponent(code)}`)).xp;
}

/** The test switch ?xp=<n> (test servers only, since Nov 9: review of #574 M1): sets your XP, then your profile again. */
export async function setTestXp(xp: number): Promise<void> {
  await api("/api/xp/test", { method: "POST", body: JSON.stringify({ xp }) });
  set({ profile: await api<Profile>(meUrl()) });
}

/** Your quests (Nov 9, phase 3; the server deals the day's on the day's first read: server/quests.ts). */
export async function fetchQuests(): Promise<QuestsAnswer> {
  return api<QuestsAnswer>("/api/quests");
}

/** Today's free reroll of a daily quest: your quests after it (a refusal throws its message). */
export async function rerollQuestNow(quest: string): Promise<QuestsAnswer> {
  return (await api<{ quests: QuestsAnswer }>("/api/quests/reroll", { method: "POST", body: JSON.stringify({ quest }) })).quests;
}

/** The test switch ?quests=<kind>[:<progress>[:<drop>]],… (test servers only): your quests set to these (the drop: none | boost | bonus). */
export async function setTestQuests(quests: { kind: string; progress: number; drop?: string }[]): Promise<QuestsAnswer> {
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
    /** The Hidden Boss's fight: how many of his three forms it beat (3: won); null or missing for every other row and his older ones. */
    formsBeaten?: number | null;
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
