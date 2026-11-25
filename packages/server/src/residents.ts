/**
 * Residents (Eric, Nov 25: "literally have 200 bots made which just sit on the server and play ranked, play 50v50 ... we need to
 * simulate a small soft launch"; the design: `notes/residents-design.md` on claude/director-notes; docs/decisions/2026-11-25-residents-server.md):
 * real accounts (`users.resident` = 1) a program outside the game's servers plays as people do, through the same routes and sockets.
 * Unlike test accounts they count everywhere a player counts (the "Top N%", 1 v 1's top places, name search), because Eric wants to
 * see them there. Fair play records their signals but never opens a case for one (fairplay.ts); the engine server is never woken for
 * a lobby of residents alone (lobby.ts residentsOnly); a lobby's host is a real person whenever one is connected (lobby.ts pickHost).
 *
 *   POST /api/admin/residents {name, look?}  → makes the resident (or finds it) and signs the program in as it (the session cookie);
 *                                               an admin is answered without being signed in (their own browser stays theirs)
 *   GET  /api/admin/residents                → every resident, today's numbers, fair play's "would have" counts, the last heartbeat
 *   POST /api/admin/residents/beat {…}       → the program's heartbeat (its own numbers), kept in D1 `meta` (the latest only)
 *
 * Callers: an admin's session (from the site itself), the e2e's local key, or a script through Cloudflare Access with the service token
 * `RESIDENTS_CLIENT_ID` names, or (tonight's first runs from the director's session, until PR 3) the one `TEST_ACCOUNTS_CLIENT_ID`
 * names. Anyone else: "Not found". The POSTs are refused while the kill switch `PAUSE_RESIDENTS` is on (503, `RESIDENTS_PAUSED`).
 */

/** POST /api/admin/residents: make the resident named `name` (or find it), and sign in as it. */
export interface ResidentRequest {
  /** Its name (through cleanName and the name filter, at most 16 characters); its email is `<slug>@resident.hunchess`. */
  name: string;
  /** Only when it's made (ignored for one that exists): its default pawn color and its icon (one of the free emoji icons, or a drawn one). */
  look?: { pawn?: "white" | "black"; icon?: string };
}

/**
 * The answer to POST /api/admin/residents. For the token's and the e2e key's callers it carries the session cookie (`hc_session`) in
 * `Set-Cookie`, unless the request already carried a live session of this resident (`reused`: kept, no new cookie). Every new session
 * ends the resident's others, so restarts never pile up session rows.
 */
export interface ResidentAnswer {
  id: string;
  name: string;
  email: string;
  /** Made by this call (false: it existed). */
  created: boolean;
  /** The common locker items it was given when it was made (their defs; [] for one that existed, or none drawn). */
  seeded: string[];
  /** The request's own session of this resident was live and is kept (no Set-Cookie). Absent for an admin. */
  reused?: boolean;
}

/** POST /api/admin/residents/beat: the program's heartbeat, any JSON object of its own numbers (at most BEAT_MAX_BYTES). */
export type ResidentBeat = Record<string, unknown>;

/** The answer to POST /api/admin/residents/beat. */
export interface ResidentBeatAnswer {
  ok: true;
  at: number;
}

/** What detection would have done about a resident's match, had it been anyone's (fairplay.ts): stored as `fairplay_matches.would`. */
export type WouldHave = "watch" | "review" | "pool" | "ban";

/** One resident in GET /api/admin/residents. */
export interface ResidentRow {
  id: string;
  name: string;
  createdAt: number;
  lastSeen: number | null;
  /** Its ranking rating (users.rating), and its 1 v 1 rating (ranked_1v1), or null. */
  rating: number | null;
  duelRating: number | null;
  /** Online results today (UTC), every mode. */
  gamesToday: number;
}

/** The answer to GET /api/admin/residents. */
export interface ResidentsReport {
  /** PAUSE_RESIDENTS is on. */
  paused: boolean;
  /** The program's last heartbeat: when it came, who sent it ("access", "e2e", "admin:<email>"), and what it said. */
  beat: { at: number; by: string; beat: ResidentBeat } | null;
  today: {
    /** Midnight UTC, today. */
    since: number;
    /** Online results of residents today, by mode ("crowd", "1v1", …). */
    results: Record<string, number>;
    /** Residents with a result today. */
    players: number;
    /** Ranked 1 v 1 games ended today with a resident in them, and of those, games against a real person. */
    duels: number;
    duelsWithPeople: number;
  };
  /** Fair play over residents' kept matches: how many were recorded, and what detection would have done (never done for a resident). */
  fairPlay: { matches: number; would: Record<WouldHave, number> };
  residents: ResidentRow[];
}

/** The refusal while PAUSE_RESIDENTS is on (the route's POSTs; every /api/* request of a resident's session; their sockets). */
export const RESIDENTS_PAUSED = "Residents are paused.";
