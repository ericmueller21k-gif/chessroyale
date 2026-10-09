import type { ChatPicks, ShopState } from "@chessroyale/core";
import type { CrateRoll, ItemInstance, ItemLook, ItemSlot, RankEffect } from "@chessroyale/core";

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

export interface Profile {
  user: { id: string; name: string; icon: string; signedIn: boolean; email: string | null; google: boolean };
  /** The shop: coins, items owned and what's equipped (missing from an older server). */
  shop?: ShopState;
  /** Crate items you own, what you wear, and your crates and keys (null: unlimited while testing). */
  locker?: Locker;
  stats: { all: ModeStats; classic: ModeStats; crowd: ModeStats; boss?: ModeStats };
  rating: number | null;
  recent: { mode: string; online: boolean; placement: number; players: number; teamWon: boolean | null; playedAt: number }[];
  /** An admin (ADMIN_EMAILS, as for the fair-play review): sees the boss battle's test trigger. */
  admin?: boolean;
}

export interface AccountState {
  /** Sign-in options the server has set up (null until known; accounts false = no accounts here). */
  config: { accounts: boolean; google: boolean; email: boolean; onlineNeedsSignIn?: boolean } | null;
  profile: Profile | null;
}

let state: AccountState = { config: null, profile: null };
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
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(body.message ?? `Something went wrong (${res.status}).`);
  return body;
}

/** Loads the sign-in options and your profile (making a guest account the first time). */
export async function loadAccount(name?: string): Promise<void> {
  try {
    const config = await api<NonNullable<AccountState["config"]>>("/api/auth/config");
    set({ config });
    if (!config.accounts) return;
    const q = name ? `?name=${encodeURIComponent(name)}` : "";
    set({ profile: await api<Profile>(`/api/me${q}`) });
  } catch {
    // No server (local dev) or offline: play on without an account.
    set({ config: { accounts: false, google: false, email: false } });
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

/** Equips a shop item you own (a pawn hat takes a crate item off the head, so the locker is fetched again too). */
export async function equipShopItem(item: string): Promise<void> {
  if (!state.profile) return;
  const shop = await api<ShopState>("/api/shop/equip", { method: "POST", body: JSON.stringify({ item }) });
  const locker = state.profile.locker ? await api<Locker>("/api/locker") : undefined;
  set({ profile: { ...state.profile, shop, ...(locker ? { locker } : {}) } });
}

export interface Locker {
  items: ItemInstance[];
  equipped: Partial<Record<ItemSlot, string>>;
  look: ItemLook;
  crates: number | null;
  keys: number | null;
}

/** Opens a crate on the server. `force`: the test switches (?fischer=1, ?shiny=1), honoured only while testing. */
export async function openCrate(crate: string, force: { fischer?: boolean; shiny?: boolean } = {}): Promise<{ roll: CrateRoll; item: ItemInstance }> {
  const r = await api<{ roll: CrateRoll; item: ItemInstance; locker: Locker }>("/api/locker/open", { method: "POST", body: JSON.stringify({ crate, ...force }) });
  if (state.profile) set({ profile: { ...state.profile, locker: r.locker } });
  return { roll: r.roll, item: r.item };
}

/** Wears a crate item in its slot (null empties the slot). A head item takes off the pawn hat, so the shop is fetched again too. */
export async function equipLockerItem(slot: ItemSlot, item: string | null): Promise<void> {
  if (!state.profile) return;
  const locker = await api<Locker>("/api/locker/equip", { method: "POST", body: JSON.stringify({ slot, item }) });
  const shop = slot === "head" && item ? await api<ShopState>("/api/shop") : undefined;
  set({ profile: { ...state.profile, locker, ...(shop ? { shop } : {}) } });
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
  set({ profile: await api<Profile>("/api/auth/email/verify", { method: "POST", body: JSON.stringify({ email, code }) }) });
}

export async function signOut(): Promise<void> {
  set({ profile: await api<Profile>("/api/auth/logout", { method: "POST" }) });
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
  look: ItemLook;
  hat: string;
  joinedAt: number;
  lastSeen: number | null;
  online: boolean;
  rating: number | null;
  tier: { label: string; level: number; color: string; effect: RankEffect | null } | null;
  topPercent: number | null;
  /** Banned for fair play (the profile says so; nothing else about fair play is shown). */
  banned?: boolean;
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
 * Reports a player (a profile's Report button; `match`: the lobby's code when it's made during a match). Answers with
 * what to tell the reporter ("Thanks, we'll look into it.", or that they already reported them).
 */
export async function reportPlayer(target: string, reason: string, match?: string): Promise<string> {
  const r = await api<{ message?: string }>("/api/report", { method: "POST", body: JSON.stringify({ target, reason, ...(match ? { match } : {}) }) });
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
