import { useEffect, useState } from "preact/hooks";
import { bossDef, floorUnlocks, unlockFloor } from "@chessroyale/core";
import { towerApi } from "./tower.ts";
import { testParams } from "./test-switches.ts";

/**
 * The bosses this account has unlocked (the Stranger, Eric Nov 27: "you have to beat him to unlock him"), as the server keeps them (GET
 * /api/tower's `unlocked`: a floor of his own won with him on it, solo or party), never stored on this device: the server checks it
 * again for a raid's or a party's pick.
 * Empty until the server answers (his card shows locked meanwhile: nothing shifts, it only unlocks).
 */
let known: readonly string[] = [];
const subs = new Set<() => void>();

/** What's known now. */
export const unlockedNow = (): readonly string[] => known;

/** A test link's `?wip=1` (a test switch): a boss unlocked by a win is met as an admin meets him (admins first; before his art, with placeholders). */
export const unlockTest = (): boolean => testParams().get("wip") === "1";

/** Asks the server again (as the picker opens). */
export function refreshUnlocks(): void {
  void towerApi.state().then((a) => {
    if (!a.ok) return;
    const next = [...(a.body.unlocked ?? [])].sort();
    if (next.join() === known.join()) return;
    known = next;
    subs.forEach((f) => f());
  });
}

/** The bosses unlocked, kept fresh while the screen is up. */
export function useUnlocks(): readonly string[] {
  const [, redraw] = useState(0);
  useEffect(() => {
    const f = () => redraw((n) => n + 1);
    subs.add(f);
    refreshUnlocks();
    return () => void subs.delete(f);
  }, []);
  return known;
}

/** A locked card's line: how to unlock him (his first own floor; beating him on a later one of his unlocks him too). */
export const unlockLine = (id: string): string => {
  const floor = unlockFloor(id);
  return floor ? `Beat him on Battle Tower floor ${floor}` : "";
};

// ---------------- "Now available in Boss Battle" (Eric, Nov 27) ----------------

/**
 * A boss just unlocked, said once (Eric, Nov 27: "when you beat him, it should have that same blue pop-up style we use for other things,
 * and say the Stranger is now available in Boss Battle"): as a tower floor of his own is won and the server has taken its result. Once:
 * only when the server didn't already have him unlocked before that result (`before`: its list read just before the result is sent;
 * null: couldn't be read), and never twice on a device (`brc.unlock.told`: a notice shown, not the unlock itself, which stays the
 * server's).
 */
const TOLD_KEY = "brc.unlock.told";
const told = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(TOLD_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
let notice: string | null = null;
const noticeSubs = new Set<() => void>();

/** The bosses a win of this floor could unlock that this device hasn't said yet: none, and nothing need be read before its result. */
export const unlocksToTell = (floor: number, bosses: readonly string[]): string[] => floorUnlocks(floor, bosses).filter((b) => !told().includes(b));

/** The server's unlocks now, read fresh (before a result that may add one); null: no answer. */
export const unlocksNow = (): Promise<readonly string[] | null> => towerApi.state().then((a) => (a.ok ? (a.body.unlocked ?? []) : null));

/** The floor's won and its result taken: each boss it newly unlocked gets his notice (the first shows; one boss has floors of his own today). */
export function wonUnlockFloor(floor: number, bosses: readonly string[], before: readonly string[] | null): void {
  const news = unlocksToTell(floor, bosses).filter((b) => !before?.includes(b));
  // (The picker's cards follow: asked again now.)
  refreshUnlocks();
  if (!news.length) return;
  try {
    localStorage.setItem(TOLD_KEY, JSON.stringify([...told(), ...news]));
  } catch {
    // (No storage: said this once all the same.)
  }
  notice = news[0]!;
  noticeSubs.forEach((f) => f());
}

/** The notice's words. */
export const unlockNoticeText = (id: string): string => `${bossDef(id)?.name ?? "A new boss"} is now available in Boss Battle`;

/** The boss whose notice is up (null: none), and its OK. */
export function useUnlockNotice(): [string | null, () => void] {
  const [, redraw] = useState(0);
  useEffect(() => {
    const f = () => redraw((n) => n + 1);
    noticeSubs.add(f);
    return () => void noticeSubs.delete(f);
  }, []);
  return [
    notice,
    () => {
      notice = null;
      noticeSubs.forEach((f) => f());
    },
  ];
}
