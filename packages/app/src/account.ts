import type { ShopState } from "@chessroyale/core";
import type { CrateRoll, ItemInstance, ItemLook, ItemSlot } from "@chessroyale/core";

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

/** Equips a shop item you own. */
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

/** Opens a crate on the server. `force`: the test switches (?fischer=1, ?shiny=1), honoured only while testing. */
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
  tier: { label: string; color: string } | null;
  topPercent: number | null;
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
    playedAt: number;
  }[];
}

/** Reports a player (the profile's Report button), for a person to read. */
export async function reportPlayer(target: string, reason: string): Promise<void> {
  await api("/api/report", { method: "POST", body: JSON.stringify({ target, reason }) });
}

export async function fetchProfile(id: string): Promise<PublicProfile> {
  return api<PublicProfile>(`/api/profile/${encodeURIComponent(id)}`);
}
