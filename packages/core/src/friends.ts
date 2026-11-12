/**
 * Friends and invites, shared by the server and the app: who may invite you, what an invite is for and where its link
 * goes, and the friends list as GET /api/friends answers it. See docs/decisions/2026-10-15-friends-and-invites.md.
 */

/** Who may invite you to play (Settings → Friends). Missing (an account that never chose): everyone. */
export const INVITE_SETTINGS = ["everyone", "friends", "none"] as const;
export type InviteSetting = (typeof INVITE_SETTINGS)[number];
export const isInviteSetting = (v: unknown): v is InviteSetting => (INVITE_SETTINGS as readonly unknown[]).includes(v);

/**
 * What an invite is for: a private lobby in one of the modes (its link is /lobby/CODE), or a Squads party
 * (/squads/party/CODE). Invites reuse those links: joining is joining the lobby or the party.
 */
export const INVITE_KINDS = ["crowd", "raid", "classic", "squads"] as const;
export type InviteKind = (typeof INVITE_KINDS)[number];
export const isInviteKind = (v: unknown): v is InviteKind => (INVITE_KINDS as readonly unknown[]).includes(v);

/** A lobby or party code (the five characters with no look-alikes). */
export const isGameCode = (v: unknown): v is string => typeof v === "string" && /^[A-Z2-9]{5}$/.test(v);

export const inviteLink = (kind: InviteKind, code: string) => (kind === "squads" ? `/squads/party/${code}` : `/lobby/${code}`);

/** "invited you to a Crowd lobby". */
export function inviteWhat(kind: InviteKind): string {
  if (kind === "squads") return "their Squads party";
  if (kind === "raid") return "a Boss Battle";
  if (kind === "classic") return "a Classic lobby";
  return "a Crowd lobby";
}

export interface FriendEntry {
  id: string;
  name: string;
  /** Friends since (ms). */
  since: number;
  /** Seen within the online window (false while they hide it). */
  online: boolean;
  /** Online and in a match (their app says so). */
  busy: boolean;
  /** What they're doing while online (their app says so with its live line); absent offline, while hidden, or from an older app. */
  doing?: Activity;
  /** They hide when they're online (Settings → Friends): no dot either way. */
  hidden: boolean;
  /** When they were last seen (ms; `users.last_seen`), for "Last online 2h ago"; null while they hide it (older servers: absent). */
  lastSeen?: number | null;
}

/**
 * What a player is doing, as their app says with its live line (`?doing=`; the friends page shows it under an online friend's name,
 * Eric, Nov 11). The live hub keeps it in memory beside "in a match"; nothing is stored.
 */
export const ACTIVITIES = ["home", "town", "queue", "crowd", "boss", "duel", "squads", "classic", "autochess"] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const isActivity = (v: unknown): v is Activity => (ACTIVITIES as readonly unknown[]).includes(v);

/** "In a 50 v 50": an online friend's line on the friends page. */
export const ACTIVITY_LINES: Record<Activity, string> = {
  home: "On the home screen",
  town: "In Chess Town",
  queue: "In a queue",
  crowd: "In a 50 v 50",
  boss: "In a boss battle",
  duel: "In a 1 v 1",
  squads: "In a Squads match",
  classic: "In a match",
  autochess: "Playing Auto chess",
};

/** A player found by name (GET /api/friends/search): public fields only, as their profile shows them. */
export interface PlayerSearchEntry {
  id: string;
  name: string;
  /** Their icon: a character, or a drawn one (a PNG data URL), public as on their profile. */
  icon: string;
  /** Their level, from their XP (core's levelOf), as their profile shows it. */
  level: number;
}

export interface FriendRequestEntry {
  id: string;
  name: string;
  at: number;
}

export interface InviteEntry {
  /** Who invited you (their account). */
  from: string;
  name: string;
  kind: InviteKind;
  code: string;
  at: number;
  expiresAt: number;
}

export interface FriendsState {
  friends: FriendEntry[];
  /** Requests to you, waiting for your answer (newest first). */
  requests: FriendRequestEntry[];
  /** Your requests waiting for an answer. */
  sent: FriendRequestEntry[];
  /** Open invites to you (newest first). */
  invites: InviteEntry[];
  blocked: { id: string; name: string }[];
  settings: { invites: InviteSetting; showOnline: boolean };
}

/**
 * GET /api/friends (and every friends action's answer): the list, or why there's none: `off` (switched off for
 * everyone for now), `signIn` (a guest, where signing in is set up).
 */
export type FriendsAnswer = { state: FriendsState } | { off: true } | { signIn: true };
