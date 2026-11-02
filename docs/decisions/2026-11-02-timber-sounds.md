# Timber's own sounds (Nov 2, 2026)

Eric, Nov 2: "We got to get new sounds for the beaver… He's using Big Boy's sounds… it should either be like a gnawing wood
sound… Wood knocking, cutting, saw, thumping."

- **What changed:** Timber has seventeen sounds of his own, all wood, synthesized (`characters/timber-sounds.ts`, registered in
  `sound.ts` and `boss-sounds.ts` like every boss's). Every cue in his kit now plays one of his (cue names and timings as they
  were); his select sound is the gnaw (`timberGnaw`). Listening copies: `docs/timber-sounds/` (its README maps files to cues).
- **Calls made:** his town taps go in turn: the gnaw, a hand saw, a knock (`TOWN_SOUNDS.timber`), which gives the hand saw a
  home (no cue of his saws). `show` (a plank overhead, mouth open) is a proud "hup!" and `cheer` a beaver chitter; `drop` and
  `whoosh` share one swoosh; `stomp` and `thump` share one plank thump. Loudness fitted to Big Boy's and Sawyer's (about
  -25 dB mean, peaks 0.17 to 0.29).
- **Guarded by** `packages/app/test/timber-sounds.test.ts` (all his own, no other boss's; a sound for every cue; loudness; no
  bright dings).
