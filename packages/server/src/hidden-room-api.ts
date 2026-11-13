import { pausedLine, type Pausable } from "@chessroyale/core";
import { getUser, type Sql } from "./accounts.ts";
import { banCheck } from "./fairplay.ts";
import { banAnswer } from "./ban-gate.ts";
import { isBlockedText } from "./text-filter.ts";
import { signedInReader } from "./town-chat-api.ts";
import { readLimits } from "./town-here-api.ts";
import { ROOM_LIMITS, type RoomBeat, type RoomLimits, type RoomView } from "./hidden-room.ts";

/**
 * POST /api/town/hidden {action, c, r, idleMs, hidden, room?, limits?} (hidden-room.ts): a device at the Hidden Boss's room in the
 * town. `action`: "enter" (the stairs up: refused at four, "The door is locked."), "look" (every HIDDEN_ROOM.pollMs while in it: the
 * count, the room's people, your start), "challenge", "cancel", "leave" (the stairs down, back, the town closed), and "fill" ("Fill
 * with 3 bots": admins only, ADMIN_EMAILS, checked here and by the room). Signed-in accounts on a device the age gate didn't mark too
 * young; a guest watches the room but isn't in its count (401). The name and admin come from the account (read at most once a minute).
 * An account banned for fair play can't go in or challenge (`enter`, `challenge`: 403 with `banned`, as PLAY's mayPlay answers, so
 * the app shows the ban notice): the same banCheck (the account and the device cookie), at most once a minute per account (review M1).
 *
 * Where the test switches are on (TEST_SWITCHES: local, e2e, staging), a device's town is the `room` it names (a test's own, as
 * town-here-api.ts), and `limits` (seconds: `cap`, `silent`, and the town's away numbers) shortens the numbers for a test; never for players.
 */

export type RoomAction = "enter" | "look" | "challenge" | "cancel" | "leave" | "fill";
const ACTIONS: readonly RoomAction[] = ["enter", "look", "challenge", "cancel", "leave", "fill"];

export type RoomHub = {
  hiddenRoom(a: { id: string; name: string; room: string; action: RoomAction; admin: boolean; beat?: RoomBeat; limits?: RoomLimits }): Promise<RoomView>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const SIGN_IN_TO_CHALLENGE = "Sign in to challenge him.";
export const CHALLENGE_AGE = "Online games are for accounts 13 and older.";

/** The biggest body read. */
const BODY_MAX = 1024;
const SEEN_MS = 60_000;
const SEEN_MAX = 20_000;
const seen = new Map<string, { name: string; admin: boolean; until: number }>();
/** Each account's last ban check (banCheck), kept SEEN_MS. */
const bans = new Map<string, { banned: boolean; until: number }>();

const keep = <T>(m: Map<string, T>, id: string, v: T) => {
  if (m.size >= SEEN_MAX) m.delete(m.keys().next().value!);
  m.set(id, v);
};

async function whoIs(sql: Sql, id: string, now: number, admin: (email: string | null) => boolean): Promise<{ name: string; admin: boolean }> {
  const hit = seen.get(id);
  if (hit && hit.until > now) return hit;
  const row = await sql.first<{ name: string; email: string | null }>("SELECT name, email FROM users WHERE id = ?", id);
  const p = { name: row?.name && !isBlockedText(row.name) ? row.name : "Player", admin: admin(row?.email ?? null), until: now + SEEN_MS };
  keep(seen, id, p);
  return p;
}

/**
 * Whether this account is banned for fair play (fairplay.ts banCheck: the account, its sign-in identities and the device cookie, as
 * every way into online play checks), at most once a minute. A check that fails lets it through, as mayPlay does; the fight's lobby
 * checks again at its door.
 */
async function bannedNow(sql: Sql, id: string, device: string | null, now: number): Promise<boolean> {
  const hit = bans.get(id);
  if (hit && hit.until > now) return hit.banned;
  const user = await getUser(sql, id).catch(() => null);
  if (!user) return false;
  const ban = await banCheck(sql, user, device, now).catch(() => null);
  if (!ban) return false;
  keep(bans, id, { banned: ban.banned, until: now + SEEN_MS });
  return ban.banned;
}

const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** A look's fields, checked (none: no beat; a look then only says the device is still there). */
export function readRoomBeat(b: Record<string, unknown>): RoomBeat | undefined {
  const c = int(b.c, 0, 99);
  const r = int(b.r, 0, 99);
  if (c === null || r === null) return undefined;
  const idle = typeof b.idleMs === "number" && Number.isFinite(b.idleMs) ? Math.min(Math.max(0, b.idleMs), 86_400_000) : 0;
  return { c, r, idleMs: idle, hidden: b.hidden === true };
}

/** A test's shortened numbers (seconds), where the test switches are on; else none (the real ones). */
export function readRoomLimits(v: unknown): RoomLimits | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const sec = (x: unknown, d: number) => (typeof x === "number" && x >= 1 && x <= 3600 ? x * 1000 : d);
  return { capMs: sec(o.cap, ROOM_LIMITS.capMs), silentMs: sec(o.silent, ROOM_LIMITS.silentMs), here: readLimits(o) ?? ROOM_LIMITS.here };
}

export async function hiddenRoomResponse(
  request: Request,
  sql: Sql,
  hub: RoomHub,
  a: { token: string | null; device: string | null; tooYoung: boolean; testSwitches: boolean; admin: (email: string | null) => boolean; paused: Pausable | null },
  now: number,
): Promise<Response> {
  if (Number(request.headers.get("content-length")) > BODY_MAX) return json({ message: "Too big." }, 413);
  const raw = await request.text().catch(() => "");
  if (raw.length > BODY_MAX) return json({ message: "Too big." }, 413);
  if (a.tooYoung) return json({ message: CHALLENGE_AGE }, 403);
  const id = await signedInReader(sql, a.token, now);
  if (!id) return json({ message: SIGN_IN_TO_CHALLENGE }, 401);
  const body = ((): Record<string, unknown> => {
    try {
      const b = JSON.parse(raw);
      return b && typeof b === "object" ? b : {};
    } catch {
      return {};
    }
  })();
  const action = ACTIONS.find((x) => x === body.action);
  if (!action) return json({ message: "No such action." }, 400);
  // (A raid's kill switch rests his fight as it rests Boss Battle's parties, and his own rests him: no new request, the rest as ever.)
  if (action === "challenge" && a.paused) return json({ message: pausedLine(a.paused), paused: a.paused }, 503);
  // (Banned for fair play: not into his room, nor into a request; review M1. A look, a cancel or leaving go on as ever.)
  // (An evasion ban found now: the ban answer, as the Worker's gate gives a banned session: ban-gate.ts.)
  if ((action === "enter" || action === "challenge") && (await bannedNow(sql, id, a.device, now))) return banAnswer(sql, a.token, id);
  const room = !a.testSwitches ? "town" : typeof body.room === "string" && /^[\w-]{1,40}$/.test(body.room) ? `test:${body.room}` : `alone:${id}`;
  const me = await whoIs(sql, id, now, a.admin);
  const view = await hub.hiddenRoom({ id, name: me.name, room, action, admin: me.admin, beat: readRoomBeat(body), ...(a.testSwitches ? { limits: readRoomLimits(body.limits) } : {}) });
  return json({ ...view, ...(me.admin ? { admin: true } : {}) });
}
