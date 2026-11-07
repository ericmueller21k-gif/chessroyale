import type { Sql } from "./accounts.ts";
import { isBlockedText } from "./text-filter.ts";
import { signedInReader } from "./town-chat-api.ts";
import { HERE_LIMITS, type HereBeat, type HereLimits, type HereOther } from "./town-here.ts";

/**
 * POST /api/town/here {c, r, idleMs, hidden, shop?, leave?} (town-here.ts): a device in the town square says where its player is,
 * or that it left; the answer is everyone else in the town (`others`). Signed-in players on a device the age gate didn't mark too
 * young only, as the town's chat: anyone else is in nobody's town, and sees nobody (`others: []`). The name comes from the account.
 *
 * Where the test switches are on (TEST_SWITCHES: local, e2e, staging) a device's town is the `room` it names (a test's own), or
 * one of its own (nobody else's tests walk in it), and `limits` (seconds) shortens the numbers for a test; never for players.
 */

type HereHub = { townHere(id: string, name: string, room: string, beat: HereBeat | null, limits?: HereLimits): Promise<HereOther[]> };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** The biggest body read. */
const BODY_MAX = 1024;
const NAME_MS = 10 * 60_000;
const NAMES_MAX = 20_000;
const names = new Map<string, { name: string; until: number }>();

async function nameOf(sql: Sql, id: string, now: number): Promise<string> {
  const hit = names.get(id);
  if (hit && hit.until > now) return hit.name;
  const row = await sql.first<{ name: string }>("SELECT name FROM users WHERE id = ?", id);
  const name = row?.name && !isBlockedText(row.name) ? row.name : "Player";
  if (names.size >= NAMES_MAX) names.delete(names.keys().next().value!);
  names.set(id, { name, until: now + NAME_MS });
  return name;
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

export async function townHereResponse(request: Request, sql: Sql, hub: HereHub, a: { token: string | null; tooYoung: boolean; testSwitches: boolean }, now: number): Promise<Response> {
  if (Number(request.headers.get("content-length")) > BODY_MAX) return json({ message: "Too big." }, 413);
  const raw = await request.text().catch(() => "");
  if (raw.length > BODY_MAX) return json({ message: "Too big." }, 413);
  const id = a.tooYoung ? null : await signedInReader(sql, a.token, now);
  if (!id) return json({ others: [] });
  const body = ((): Record<string, unknown> => {
    try {
      const b = JSON.parse(raw);
      return b && typeof b === "object" ? b : {};
    } catch {
      return {};
    }
  })();
  const room = !a.testSwitches ? "town" : typeof body.room === "string" && /^[\w-]{1,40}$/.test(body.room) ? `test:${body.room}` : `alone:${id}`;
  if (body.leave === true) {
    await hub.townHere(id, "", room, null);
    return json({ others: [] });
  }
  const beat = readBeat(body);
  if (!beat) return json({ message: "Not a beat." }, 400);
  const others = await hub.townHere(id, await nameOf(sql, id, now), room, beat, a.testSwitches ? readLimits(body.limits) : undefined);
  return json({ others });
}
