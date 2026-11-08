import { pawnColorOf, type ItemLook, type PawnColor } from "@chessroyale/core";
import type { Sql } from "./accounts.ts";
import { looksOf } from "./locker.ts";
import { isBlockedText } from "./text-filter.ts";
import { signedInReader } from "./town-chat-api.ts";
import { HERE_LIMITS, type HereBeat, type HereLimits, type HereOther } from "./town-here.ts";

/**
 * POST /api/town/here {c, r, idleMs, hidden, shop?, leave?} (town-here.ts): a device in the town square says where its player is,
 * or that it left; the answer is everyone else in the town (`others`), each with what they wear. Signed-in players on a device the
 * age gate didn't mark too young only have a pawn there; the name and the look come from the account (read at most once a
 * minute). A guest (Eric, on #542) watches: they see everyone, dressed, with no names, and are in nobody's town themselves; a
 * device marked too young sees nobody.
 *
 * Where the test switches are on (TEST_SWITCHES: local, e2e, staging) a device's town is the `room` it names (a test's own), or
 * one of its own (nobody else's tests walk in it), and `limits` (seconds) shortens the numbers for a test; never for players.
 */

type HereHub = {
  townHere(id: string, name: string, room: string, beat: HereBeat | null, limits?: HereLimits, look?: ItemLook | null, pawn?: PawnColor): Promise<HereOther[]>;
  townWatch(room: string): Promise<HereOther[]>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** The biggest body read. */
const BODY_MAX = 1024;
/** A player's name and look are read again after this long (a change of clothes shows within it). */
const SEEN_MS = 60_000;
const SEEN_MAX = 20_000;
const seen = new Map<string, { name: string; look: ItemLook | null; pawn: PawnColor; until: number }>();

/** Reads a player's name, look and pawn color again on their next beat (after a change of pawn color: PATCH /api/me). */
export function forgetLook(id: string): void {
  seen.delete(id);
}

/** A player's name, what they wear (an admin's own copies included, as `looksOf` reads them) and pawn color, from this instance's cache or D1. */
async function profileOf(sql: Sql, id: string, now: number, admin: (email: string | null) => boolean): Promise<{ name: string; look: ItemLook | null; pawn: PawnColor }> {
  const hit = seen.get(id);
  if (hit && hit.until > now) return hit;
  const row = await sql.first<{ name: string; email: string | null; pawn_color: string | null }>("SELECT name, email, pawn_color FROM users WHERE id = ?", id);
  const name = row?.name && !isBlockedText(row.name) ? row.name : "Player";
  const look = (await looksOf(sql, [id], admin(row?.email ?? null) ? new Set([id]) : new Set())).get(id) ?? null;
  if (seen.size >= SEEN_MAX) seen.delete(seen.keys().next().value!);
  const p = { name, look, pawn: pawnColorOf(row?.pawn_color), until: now + SEEN_MS };
  seen.set(id, p);
  return p;
}

const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** A beat's fields, checked (null: not a beat). */
export function readBeat(b: Record<string, unknown>): HereBeat | null {
  const c = int(b.c, 0, 999);
  const r = int(b.r, 0, 999);
  if (c === null || r === null) return null;
  const idle = typeof b.idleMs === "number" && Number.isFinite(b.idleMs) ? Math.min(Math.max(0, b.idleMs), 86_400_000) : 0;
  const shop = typeof b.shop === "string" && /^[a-z0-9-]{1,24}$/.test(b.shop) ? b.shop : null;
  return { c, r, idleMs: idle, hidden: b.hidden === true, shop };
}

/** A test's shortened numbers (seconds, each 1 to 3600), where the test switches are on; else the real ones. */
export function readLimits(v: unknown): HereLimits | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const sec = (x: unknown, d: number) => (typeof x === "number" && x >= 1 && x <= 3600 ? x * 1000 : d);
  return { zzzMs: sec(o.zzz, HERE_LIMITS.zzzMs), bootMs: sec(o.boot, HERE_LIMITS.bootMs), hiddenBootMs: sec(o.hidden, HERE_LIMITS.hiddenBootMs), silentMs: sec(o.silent, HERE_LIMITS.silentMs) };
}

export async function townHereResponse(
  request: Request,
  sql: Sql,
  hub: HereHub,
  a: { token: string | null; tooYoung: boolean; testSwitches: boolean; admin: (email: string | null) => boolean },
  now: number,
): Promise<Response> {
  if (Number(request.headers.get("content-length")) > BODY_MAX) return json({ message: "Too big." }, 413);
  const raw = await request.text().catch(() => "");
  if (raw.length > BODY_MAX) return json({ message: "Too big." }, 413);
  if (a.tooYoung) return json({ others: [] });
  const id = await signedInReader(sql, a.token, now);
  const body = ((): Record<string, unknown> => {
    try {
      const b = JSON.parse(raw);
      return b && typeof b === "object" ? b : {};
    } catch {
      return {};
    }
  })();
  const room = !a.testSwitches ? "town" : typeof body.room === "string" && /^[\w-]{1,40}$/.test(body.room) ? `test:${body.room}` : `alone:${id ?? "guest"}`;
  // A guest watches (no pawn, no names).
  if (!id) return json({ others: body.leave === true ? [] : await hub.townWatch(room) });
  if (body.leave === true) {
    await hub.townHere(id, "", room, null);
    return json({ others: [] });
  }
  const beat = readBeat(body);
  if (!beat) return json({ message: "Not a beat." }, 400);
  const me = await profileOf(sql, id, now, a.admin);
  const others = await hub.townHere(id, me.name, room, beat, a.testSwitches ? readLimits(body.limits) : undefined, me.look, me.pawn);
  return json({ others });
}
