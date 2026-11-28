/**
 * The last town spot (Eric, Nov 27: "if the last spot you were was in the battle tower and you closed out of it, then the next time you
 * load into the town, it should take you right back there"): the building you were inside, kept as you go in (never every step) and let
 * go as you come out on the street. The next town load (a reload, the app closed and opened again) starts you inside it, straight in,
 * the street not loaded until you go out (Town.tsx `direct`); the Battle Tower in front of its clerk. A building that no longer exists
 * here or can't be entered straight away (the Hidden Boss's room, a home left out of this town): the plaza, as before.
 * This device's for now, by account (a guest's too); following you across devices on the account is a follow-up (a stored field: the
 * full lane): docs/decisions/2026-11-27-town-return.md.
 */

/** What's kept: the building's home id and when (ms). */
export interface TownSpot {
  home: string;
  at: number;
}

const KEY = "brc.town.spot";

/** The storage key for an account (a guest's own id too; none yet: the device's). */
export const spotKey = (user: string | null | undefined): string => (user ? `${KEY}.${user}` : KEY);

/** A kept spot read back: its home if it's one `can` lets you start in, else null (nothing kept, a bad or old value, a home gone). */
export function parseSpot(raw: string | null, can: (home: string) => boolean): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TownSpot> | null;
    return v && typeof v.home === "string" && v.home && can(v.home) ? v.home : null;
  } catch {
    return null;
  }
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function local(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** The spot kept for `key`, if `can` lets you start there (a bad one is let go). */
export function readSpot(key: string, can: (home: string) => boolean, store: Store | null = local()): string | null {
  try {
    const raw = store?.getItem(key) ?? null;
    const home = parseSpot(raw, can);
    if (raw !== null && home === null) store?.removeItem(key);
    return home;
  } catch {
    return null;
  }
}

/** You're inside `home` now (null: out on the street; nothing kept). */
export function keepSpot(key: string, home: string | null, now = Date.now(), store: Store | null = local()): void {
  try {
    if (home) store?.setItem(key, JSON.stringify({ home, at: now } satisfies TownSpot));
    else store?.removeItem(key);
  } catch {
    // (No storage: the town opens on the plaza, as before.)
  }
}
