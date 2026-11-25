import { lazyGroup } from "./lazy.tsx";

/**
 * A match's screens (screens/game-screens.ts): their own chunk, off the first load (Nov 10, phone load: home starts fast), loaded when
 * play is near (App.tsx) or next (Home.tsx: the Bot level box, Play with friends, the Boss Battle screen, a moment after home shows).
 * With them every boss's figure, his powers on screen and the God King (Nov 16, the bundle split): home and the boss select draw the
 * bosses' portraits from the first load (BossPortrait.tsx) and the select's stage figure from here. Once it's in, the page says so
 * (`<html data-match-chunk>`): the e2e helpers wait for it where a player would have it, before the tap into a match
 * (docs/decisions/2026-11-17-match-chunk-on-intent.md).
 */
export const game = lazyGroup(() =>
  import("./screens/game-screens.ts").then((m) => {
    // (Only once it's in: a load that failed (stale.ts: Vite's import then gives nothing) is tried again, and no test waits past it.)
    if (m && typeof document !== "undefined") document.documentElement.dataset.matchChunk = "";
    return m;
  }),
);
