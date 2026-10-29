import { ASK_AGE_LINE, CHAT_MOD, oldEnough, type ChatPicks, type ShopState } from "@chessroyale/core";
import type { CrateRoll, ItemInstance, ItemLook, ItemSlot, RankedSummary } from "@chessroyale/core";
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
  user: { id: string; name: string; icon: string; signedIn: boolean; email: string | null; google: boolean };
  /** The shop: coins, items owned and what's equipped (missing from an older server). */
  shop?: ShopState;
  /** Crate items you own, what you wear, and your crates and keys (null: unlimited while testing). */
  locker?: Locker;
  stats: { all: ModeStats; classic: ModeStats; crowd: ModeStats; boss?: ModeStats };
  rating: number | null;
  /** Ranked 1 v 1: the rank ("Gold 2 · 45 RP", "Placement 2/5") and the record (missing from an older server). */
  ranked1v1?: RankedSummary;
  recent: { mode: string; online: boolean; placement: number; players: number; teamWon: boolean | null; playedAt: number }[];
  /** An admin (ADMIN_EMAILS, as for the fair-play review): sees the boss battle's test trigger, may use the test switches. */
  admin?: boolean;
  /** Your chat ban in force, and a moderator's warning or chat ban you haven't seen yet (chat-mod.ts). */
  chatMod?: { block?: ChatBlock; notice?: ChatNotice };
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
}

/** The age question's answer: old enough to sign in, or too young (docs/decisions/2026-10-16-age-gate-and-real-money.md). */
export type AgeAnswer = "ok" | "under";

let state: AccountState = { config: null, profile: null, age: null, ageNote: null };
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
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; askAge?: boolean; tooYoung?: boolean };
  if (!res.ok) {
    // A sign-in the age gate refused: ask the question again, saying why (the answer ran out), or too young after all.
    if (body.askAge) askAgeAgain(body.message ?? ASK_AGE_LINE);
    if (body.tooYoung) rememberTooYoung();
    throw Object.assign(new Error(body.message ?? `Something went wrong (${res.status}).`), { status: res.status });
  }
  return body;
}

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
/** This device is too young: remembered here, sign-in gone, and the name it may have chosen forgotten. */
function rememberTooYoung() {
  try {
    localStorage.setItem(TOO_YOUNG_KEY, "1");
    localStorage.removeItem("brc.name");
  } catch {
    // No storage: the server's cookie still holds it.
  }
  set({ age: "under" });
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
  try {
    config = await api<NonNullable<AccountState["config"]>>("/api/auth/config");
    const young = storedTooYoung() || config.age === "under";
    set({ config, age: young ? "under" : (config.age ?? null) });
    if (young) rememberTooYoung();
    if (!config.accounts) return;
    const q = name && !young ? `?name=${encodeURIComponent(name)}` : "";
    set({ profile: await profileFrom(`/api/me${q}`) });
    // The server forgot (its cookie was cleared): tell it again, which also puts the guest back to the defaults.
    if (young && config.age !== "under") await sendAgeAnswer(false).catch(() => undefined);
  } catch {
    // No server (local dev) or offline: play on without an account. A server that did answer keeps its test switch when
    // only your profile failed (Oct 25: a CI run lost its ?boss= link that way, the switch going with the profile).
    set({ config: { accounts: false, google: false, email: false, ...(config?.testSwitches ? { testSwitches: true } : {}) } });
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
  else set({ age, ageNote: null });
  return age;
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

/** Gets a shop item (free while testing). */
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
  crates: number | null;
  keys: number | null;
}

/**
 * Opens a crate on the server. `force`: the test switches (?fischer=1, ?shiny=1), honored only for those allowed them
 * (test-switches.ts; the server checks too) and while crates are free.
 */
export async function openCrate(crate: string, force: { fischer?: boolean; shiny?: boolean } = {}): Promise<{ roll: CrateRoll; item: ItemInstance }> {
  const r = await api<{ roll: CrateRoll; item: ItemInstance; locker: Locker }>("/api/locker/open", { method: "POST", body: JSON.stringify({ crate, ...force }) });
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
  return { roll: r.roll, item: r.item };
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

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  // (Signing in uses the age answer up: the next sign-in on this device asks again.)
  set({ profile: await api<Profile>("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) }), age: null });
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
}): Promise<void> {
  if (!state.profile) return;
  try {
    await api("/api/results", { method: "POST", body: JSON.stringify(r) });
    set({ profile: await api<Profile>("/api/me") });
  } catch {
    // Not important enough to bother the player.
  }
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
  joinedAt: number;
  lastSeen: number | null;
  online: boolean;
  /** They hide when they're online (Settings → Friends): `online` false and `lastSeen` null. */
  hidden?: boolean;
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
export async function reportPlayer(target: string, reason: string, match?: string, line?: number): Promise<string> {
  const r = await api<{ message?: string }>("/api/report", { method: "POST", body: JSON.stringify({ target, reason, ...(match ? { match } : {}), ...(line ? { line } : {}) }) });
  return r.message ?? "Thanks, we'll look into it.";
}

/** Your fair-play standing: banned or not, and your latest appeal (the ban notice). */
export interface FairStatus {
  banned: boolean;
  appeal: { status: "open" | "upheld" | "overturned"; at: number; reply: string | null } | null;
}
export const fairStatus = () => api<FairStatus>("/api/fairplay/status");
/** A banned account's appeal, for a person to read. */
export const sendAppeal = (text: string) => api<FairStatus>("/api/appeal", { method: "POST", body: JSON.stringify({ text }) });

export async function fetchProfile(id: string): Promise<PublicProfile> {
  return api<PublicProfile>(`/api/profile/${encodeURIComponent(id)}`);
}
