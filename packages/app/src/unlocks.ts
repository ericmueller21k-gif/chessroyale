import { useEffect, useState } from "preact/hooks";
import { unlockFloor } from "@chessroyale/core";
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

/** A test link's `?wip=1` (a test switch): a boss unlocked by a win is met before his art lands, with placeholders. */
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
