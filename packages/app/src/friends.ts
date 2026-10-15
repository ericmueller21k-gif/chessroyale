import { useEffect, useState } from "preact/hooks";
import { FRIENDS, type FriendsAnswer, type FriendsState, type InviteEntry, type InviteKind } from "@chessroyale/core";
import { account, mustSignInToPlayOnline, onAccountChange } from "./account.ts";
import { liveNow, onLive } from "./live.ts";

/**
 * Friends and invites, app side (DECISIONS.md, "Friends and invites"): your friends list as the server keeps it
 * (GET /api/friends), the actions (each answers with the list as it is after it), the toast for a new invite, and
 * who's blocked (the chats hide their lines). The list is fetched when your account is known, when the live line says
 * something new arrived for you (`inbox`: no extra polling), and every FRIENDS.refreshMs while a list is on screen.
 */

/** "on": the list is here; "off": switched off for now; "signIn": a guest where signing in is set up. */
export type FriendsStatus = "unknown" | "on" | "off" | "signIn";

let state: FriendsState | null = null;
let status: FriendsStatus = "unknown";
let blockedIds = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const friendsState = () => state;
export const friendsStatus = () => status;

/** Whether you've blocked this account (their chat lines are hidden: global chat, and quick chat in matches). */
export const isBlocked = (uid: string | null | undefined) => !!uid && blockedIds.has(uid);

/** Open invites to you (the server's list, less any that have expired since). */
export const openInvites = (now = Date.now()) => (state?.invites ?? []).filter((i) => i.expiresAt > now);

/** Requests and open invites waiting for you: the badge. */
export const friendsBadge = () => (state?.requests.length ?? 0) + openInvites().length;

export type Relation = "self" | "friend" | "sent" | "received" | "blocked" | "none";
export function relationTo(uid: string): Relation {
  if (uid === account().profile?.user.id) return "self";
  if (!state) return "none";
  if (blockedIds.has(uid)) return "blocked";
  if (state.friends.some((f) => f.id === uid)) return "friend";
  if (state.requests.some((r) => r.id === uid)) return "received";
  if (state.sent.some((r) => r.id === uid)) return "sent";
  return "none";
}

// ---------------- The new invite's toast ----------------

let toast: InviteEntry | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
/** Invites already shown as a toast (this visit). */
const toasted = new Set<string>();
const inviteKey = (i: InviteEntry) => `${i.from}:${i.at}`;

export const inviteToast = () => toast;
export function hideToast() {
  toast = null;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  emit();
}

function apply(next: FriendsState) {
  state = next;
  status = "on";
  blockedIds = new Set(next.blocked.map((b) => b.id));
  // The newest invite not shown yet becomes the toast (the rest wait in the list).
  const fresh = openInvites().filter((i) => !toasted.has(inviteKey(i)));
  for (const i of fresh) toasted.add(inviteKey(i));
  if (toast && !next.invites.some((i) => inviteKey(i) === inviteKey(toast!))) toast = null;
  if (fresh[0]) {
    toast = fresh[0];
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, FRIENDS.toastMs);
  }
  emit();
}

function takeAnswer(a: FriendsAnswer) {
  if ("state" in a) return apply(a.state);
  state = null;
  blockedIds = new Set();
  status = "off" in a ? "off" : "signIn";
  emit();
}

// ---------------- Loading ----------------

let forAccount: string | null = null;
let inFlight = false;
let again = false;
/** When the list last came back (a list opening again soon after doesn't fetch it again). */
let loadedAt = 0;

/** Fetches the list now (once at a time: a call while one is out asks again when it's back). */
export async function loadFriends(): Promise<void> {
  if (!forAccount) return;
  if (inFlight) {
    again = true;
    return;
  }
  inFlight = true;
  const asked = forAccount;
  try {
    const res = await fetch("/api/friends", { credentials: "same-origin" });
    if (res.ok && asked === forAccount) {
      takeAnswer((await res.json()) as FriendsAnswer);
      loadedAt = Date.now();
    }
  } catch {
    // Offline, or no server (local dev): the list stays as it was.
  } finally {
    inFlight = false;
    if (again) {
      again = false;
      void loadFriends();
    }
  }
}

/** Who's online among your friends, into the list (its refresh while it's on screen: lighter than the whole list). */
async function refreshOnline(): Promise<void> {
  if (!state || inFlight) return;
  try {
    const res = await fetch("/api/friends/online", { credentials: "same-origin" });
    const body = res.ok ? ((await res.json()) as { online?: Record<string, { online: boolean; busy: boolean }> }) : null;
    if (!body?.online || !state) return;
    const live = body.online;
    const friends = state.friends.map((f) => ({ ...f, ...(live[f.id] ?? { online: false, busy: false }) }));
    const rank = (f: { online: boolean; busy: boolean }) => (f.online ? (f.busy ? 1 : 0) : 2);
    // (The server's order: online, then in a match, then the rest, each by name.)
    friends.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    state = { ...state, friends };
    loadedAt = Date.now();
    emit();
  } catch {
    // Offline: as it was.
  }
}

/** A new account on this device (or signed in or out): a fresh list. */
function syncAccount() {
  const { config, profile } = account();
  const key = config?.accounts && profile ? `${profile.user.id}:${profile.user.signedIn}` : null;
  if (key === forAccount) return;
  forAccount = key;
  state = null;
  blockedIds = new Set();
  toast = null;
  status = key && mustSignInToPlayOnline() ? "signIn" : "unknown";
  emit();
  if (key && status === "unknown") void loadFriends();
}
onAccountChange(syncAccount);
syncAccount();

/** The live line's `inbox` grew: something new for you (a request, an invite, a request accepted). */
let lastInbox = 0;
onLive(() => {
  const n = liveNow()?.inbox;
  if (!n || n <= lastInbox) return;
  lastInbox = n;
  if (status === "on" || status === "unknown") void loadFriends();
});

// ---------------- Actions ----------------

async function act(action: string, body: object): Promise<void> {
  const res = await fetch(`/api/friends/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await res.json().catch(() => ({}))) as FriendsAnswer & { message?: string };
  if (!res.ok) throw new Error(answer.message ?? `Something went wrong (${res.status}).`);
  takeAnswer(answer);
}

export const addFriend = (id: string) => act("request", { id });
export const answerFriend = (id: string, accept: boolean) => act("answer", { id, accept });
export const cancelFriendRequest = (id: string) => act("cancel", { id });
export const removeFriend = (id: string) => act("remove", { id });
export const blockPlayer = (id: string) => act("block", { id });
export const unblockPlayer = (id: string) => act("unblock", { id });
export const saveFriendSettings = (patch: { invites?: FriendsState["settings"]["invites"]; showOnline?: boolean }) => act("settings", patch);
/** Declines an invite to you: off your list (and the toast). */
export function dismissInvite(inv: InviteEntry) {
  if (toast && inviteKey(toast) === inviteKey(inv)) hideToast();
  return act("dismiss", { id: inv.from });
}

// ---------------- Inviting, and joining an invite ----------------

export interface InviteTarget {
  kind: InviteKind;
  code: string;
}

/** What the app (App.tsx) can do about invites: the game you're in, making one, and joining someone's. */
export interface InviteHost {
  /** Your game others can be invited to right now (a private lobby still waiting, or your Squads party), or null. */
  target(): InviteTarget | null;
  /** Whether a game can be made to invite into (at the front door, not in a match). */
  canCreate(): boolean;
  /** Makes one in the home screen's mode (a private lobby, or with Squads picked a party) and goes there. */
  create(): Promise<InviteTarget | null>;
  /** Joins an invite's lobby or party. */
  join(kind: InviteKind, code: string): void;
}
let host: InviteHost | null = null;
export function setInviteHost(h: InviteHost | null) {
  host = h;
}

/** Whether you can invite someone now, and to what: your game, a new one, or nothing (in a match). */
export function inviteMode(): "game" | "new" | null {
  if (!host || status !== "on") return null;
  if (host.target()) return "game";
  return host.canCreate() ? "new" : null;
}

/** Invites a player to your game, making one first at the front door. */
export async function invitePlayer(uid: string): Promise<InviteTarget> {
  if (!host) throw new Error("Invites aren't available here.");
  let t = host.target();
  if (!t && host.canCreate()) {
    // (Whether they'd take it, before making a lobby or party for them.)
    await act("invite", { id: uid, check: true });
    t = await host.create();
  }
  if (!t) throw new Error("Finish your match first, then invite them.");
  await act("invite", { id: uid, kind: t.kind, code: t.code });
  return t;
}

/** Joins an invite (its lobby or party), and takes it off your list. */
export function joinInvite(inv: InviteEntry) {
  hideToast();
  void dismissInvite(inv).catch(() => undefined);
  host?.join(inv.kind, inv.code);
}

// ---------------- For screens ----------------

let watchers = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * The friends list for a screen: rerenders on every change. `watch`: the list is on screen, so who's online in it
 * refreshes every FRIENDS.refreshMs while the tab is visible (anything else new comes with the live line's `inbox`).
 */
export function useFriends(watch = false): { state: FriendsState | null; status: FriendsStatus } {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    if (watch) {
      watchers++;
      // (The computer's live panel mounts with every front-door page: a list fresher than 15 s will do.)
      if (status === "on" && Date.now() - loadedAt > 15_000) void refreshOnline();
      refreshTimer ??= setInterval(() => {
        if (watchers > 0 && document.visibilityState !== "hidden" && status === "on") void refreshOnline();
      }, FRIENDS.refreshMs);
    }
    return () => {
      listeners.delete(fn);
      if (watch && --watchers === 0 && refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    };
  }, [watch]);
  return { state, status };
}
