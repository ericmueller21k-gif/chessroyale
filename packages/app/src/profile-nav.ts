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
  bot?: boolean;
}

let target: ProfileTarget | null = null;
const listeners = new Set<() => void>();

export function openProfile(t: ProfileTarget) {
  target = t;
  listeners.forEach((l) => l());
}

export function closeProfile() {
  target = null;
  listeners.forEach((l) => l());
}

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
