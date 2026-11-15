# Chess Town's own music: the theme, with two piano solos slotted in (Eric, Nov 14-15, via the music session)

Effort high (sample-accurate music scheduling, the town's load). Targeted lane. New branch `claude/town-music` from `origin/main`. Read
`CLAUDE.md`, `.claude/LESSONS.md`, `docs/areas/town-square.md` and `docs/areas/bosses.md` (music), and `packages/app/src/music.ts`
(how a boss theme's intro-to-loop join is scheduled, `roomMusic` for a boss's room, the handover on an audio rebuild, `musicBus`,
`MUSIC.volume` 0.4) and the service worker's `brc-music` cache with `MUSIC_HASHES` (#709).

Eric: "a song where people literally are like, I want to turn this song on while I'm in the chess town"; "have them alternate playing
say every 10 min in the town, and the main theme stays the original we composed without the piano solo, but we add these 2 files and
they ... can seamlessly work into the main theme every few play throughs? ... then it's only 3 files, a 3 min theme, and 2 short piano
inserts."

Files: branch `stills/trailer-v2`, commit 296f7e0c, folder `town-music/`: READ ITS README (it says exactly how they join) and
`town.json`. `town-loop` (loop 178.604646 s, pad 0.5 s, as a boss loop), `town-solo-a`/`-b` (37.209313 s of music + 4 s ring-out),
.mp3 and .ogg each, as the boss themes ship. The music session may rebuild them (it will say a new commit); take whatever is newest then.

Build:
- **Where:** the street town (and inside buildings that have no music of their own); a boss's room keeps its own theme (`roomMusic`),
  and walking out hands back to the town theme (fades as rooms already do). A challenge's splash/battle takes over as now. Music off:
  nothing, as now.
- **The theme** loops as a boss loop does. **A solo**: after every `TOWN_MUSIC.passesPerSolo` (3) passes, at the pass's end start the
  solo's file instead of the next pass; `seconds` after the solo started, start the theme from its top (offset pad) and let the solo's
  file ring out over it. Solos take turns a, b, a, … All joins on Web Audio start times (never a timer), as the intro-to-loop join.
  Stopped or faded mid-solo: treat the solo as the music, and start from the theme's top next time. The count and which solo is next can
  reset on leaving the town (simplest).
- **Loading:** never hold up the town (#709): the theme is fetched after the town's first frame like the other music, before the boss
  themes, and starts when decoded; the solos are fetched in the background after it. Through the `brc-music` cache, hashed.
- **Level:** the same `MUSIC.volume` as the boss themes (the files are mastered alike).
- Every tunable in `packages/core/src/settings.ts` (`TOWN_MUSIC`: passesPerSolo, the order).
Tests: unit tests in `music.test.ts` (fake audio context, as it does): the theme's loop points; after 3 passes the solo starts exactly at
the pass's end and the theme comes back exactly `seconds` later from its top; a, b, a; stop mid-solo; a room theme taking over and handing
back; Music off. One check in an existing town e2e (the theme's source plays in the street, nothing fetched before the first frame).
Typecheck; app unit tests; the touched specs. Push at each real step; `.pr-body.md` (what changed, player-visible, settings, checks old ->
new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 1.5 hours.
