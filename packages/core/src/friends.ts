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
  if (kind === "raid") return "a boss raid";
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
  /** They hide when they're online (Settings → Friends): no dot either way. */
  hidden: boolean;
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
