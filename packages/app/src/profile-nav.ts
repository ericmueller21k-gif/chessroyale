import { useEffect, useState } from "preact/hooks";

/**
 * Which profile is open. Anything that shows a player can open theirs: your pawn on the home screen, any name
 * (leaderboards, the cut screen, results, lobbies) or a pawn in the queue. Outside a match the profile is a page;
 * during one it opens over the game.
 */
export interface ProfileTarget {
  /** A person's account id (their public profile). Missing: a bot, or someone without an account. */
  uid?: string;
  name: string;
  /** Your own profile. */
  you?: boolean;
  /** With `you`: your public profile, the page others see ("View public profile" on yours), not your own page. */
  public?: boolean;
  bot?: boolean;
  /** Your own profile, opened at a section (the shop's "Pick these in your profile": Quick chat and emoji; "icon": the icon picker, from home). */
  section?: "chat" | "icon";
  /** Your own profile, opened at one of your recent matches (when it was played): "See your result" for a closed lobby. */
  match?: number;
}

let target: ProfileTarget | null = null;
/** The profile its own Back closed last (null once a profile opens or closes any other way): `backFrom`. */
let backed: ProfileTarget | null = null;
const listeners = new Set<() => void>();

export function openProfile(t: ProfileTarget) {
  target = t;
  backed = null;
  listeners.forEach((l) => l());
}

/** Closes the profile some other way than its Back (another page opened, the side menu, a match). */
export function closeProfile() {
  target = null;
  backed = null;
  listeners.forEach((l) => l());
}

/** A profile's own Back: closes it as closeProfile does, and remembers which one it was, so the page it came from can come back as it was. */
export function profileBack() {
  backed = target;
  target = null;
  listeners.forEach((l) => l());
}

/** The profile its own Back just closed (null: none, or it closed another way since): the season ladder's "same list, same place". */
export const backFrom = () => backed;

export const profileTarget = () => target;

export function useProfileTarget(): ProfileTarget | null {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return target;
}
