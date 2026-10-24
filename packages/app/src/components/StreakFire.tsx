import { CROWD_SCORING } from "@chessroyale/core";

/**
 * A streak's fire (Crowd 50 v 50: CrowdScoring's strong moves in a row, from streakFrom): our own small flame, drawn
 * inline, with the count beside it. Its color by tier: orange, a hotter red from 2 more, a white-blue core from 4 more
 * (streakTier). A gentle flicker in CSS (`.streak-fire`), still under reduced motion. No emoji: the same on every phone.
 */
export function StreakFire({ count, from = CROWD_SCORING.streakFrom }: { count: number; from?: number }) {
  if (count < from) return null;
  const tier = streakTier(count, from);
  return (
    <span class={`streak-fire t${tier}`} role="img" aria-label={`${count} strong moves in a row`} title={`${count} strong moves in a row`}>
      <svg viewBox="0 0 12 16" width="9" height="12" aria-hidden="true">
        <path class="sf-outer" d="M6 .6c1 3 4.6 4.9 4.6 9.4a4.6 4.6 0 0 1-9.2 0c0-2.2 1.2-3.7 2.3-4.7.3 1.6 1 2.5 1.8 2.7C5.4 6 5.1 3.1 6 .6Z" />
        <path class="sf-core" d="M6 7.4c.9 1.4 2.5 2.4 2.5 4.4a2.5 2.5 0 0 1-5 0c0-1.3.7-2.1 1.4-2.7.2.8.6 1.2 1 1.3C5.7 9.4 5.6 8.4 6 7.4Z" />
      </svg>
      <span class="sf-count">{count}</span>
    </span>
  );
}

/** The fire's tier: 1 from `from` in a row (orange), 2 from `from` + 2 (red), 3 from `from` + 4 (a white-blue core). */
export const streakTier = (count: number, from = CROWD_SCORING.streakFrom): 1 | 2 | 3 => (count >= from + 4 ? 3 : count >= from + 2 ? 2 : 1);
