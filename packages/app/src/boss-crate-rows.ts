/**
 * The Crates tab's boss crates and its "Show unowned" box (Eric, Nov 24: "next to boss crates it should say ... show unowned, and by
 * default it's unchecked. So if you check it, then it will show the ones you don't own"; docs/decisions/2026-11-24-quests-gap.md).
 * Unchecked: only the boss crates you hold (count 1 or more); checked: every one. Remembered on this device.
 */

/** This device's choice: "1" checked; anything else (or none) unchecked. */
export const SHOW_UNOWNED_KEY = "hunchess.crates.showUnowned";

/** The rows to show: every one when `showUnowned`, else those you hold (`held` of it 1 or more). Order kept. */
export function bossCratesShown<T>(crates: readonly T[], held: (c: T) => number, showUnowned: boolean): T[] {
  return showUnowned ? [...crates] : crates.filter((c) => held(c) > 0);
}

/** The line in the list's place: none held and the box unchecked. */
export const NO_BOSS_CRATES_LINE = "You have no boss crates yet. Check Show unowned to see them all.";

export function readShowUnowned(): boolean {
  try {
    return localStorage.getItem(SHOW_UNOWNED_KEY) === "1";
  } catch {
    return false;
  }
}
export function saveShowUnowned(on: boolean): void {
  try {
    if (on) localStorage.setItem(SHOW_UNOWNED_KEY, "1");
    else localStorage.removeItem(SHOW_UNOWNED_KEY);
  } catch {
    // (No storage: the choice lasts this visit.)
  }
}
