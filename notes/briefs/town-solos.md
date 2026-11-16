# The town's piano solos: early sometimes, always within about 5 minutes. Opus, high (music timing). Targeted lane

Branch `claude/town-solos` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `packages/app/src/music.ts` (town part:
`startTown`, `townTick`, `townSoloAt`, `passesPerSolo`), `TOWN_MUSIC` in `packages/core/src/settings.ts`, `docs/areas/town-square.md`.

**Eric, Nov 16 (relayed by the music helper):** "the piano solos are not firing in the town, I heard 3 individual piano keys played
randomly 2 times in 8 minutes, not one solo ... change it so it fires the solos sometimes in the first minute 30 or sometimes later, not
every time early maybe like 33% of the time, but it should always play a solo before 5 minutes or so of looping".

**Cause (the director checked it on main):** `TOWN_MUSIC.passesPerSolo` 3 and `startTown` starts every run with 3 passes: the first solo
is due 3 x 178.6 s = 8:56 after the theme starts, and the count starts over each time the town's music starts again. The "3 keys" are
the theme's own closing piano figure (about 2:53 into each pass), not a solo cut short.

**Do (the music helper's spec; keep every number in `TOWN_MUSIC` so Eric can tune it):**
- Each time the town's music starts, roll once: with chance `earlyChance` 0.33, enter the theme late so the first solo comes early: start
  the loop source at `pad + entry` and make the run `{ at: at - entry, passes: 1, turn }` (`townSoloAt` then gives `at + loopSeconds -
  entry`). Entries on bar lines (a bar is 240/129 s): bar 77, 141.395349 s (solo 0:37 in) or bar 61, 111.627907 s (solo 1:07 in), one of
  the two at random. A late entry fades in over about 1 s (the file holds the ring of the bars before it; a hard start would click).
- Otherwise: from the top as now but 1 pass before the first solo (solo at 2:59, always inside 3 minutes).
- After a solo: the next after 1 or 2 passes at random (`passesAfterSolo: [1, 2]`), so it doesn't feel like clockwork.
- An early solo is due 37-67 s after the start, inside `aheadS + decodeS`: `townTick` asks for the decode at once and falls back to one
  more pass if it lands late. Add a unit test for that path (never exercised before) and for the early and late first-solo times.
- A test switch to force the early roll (TEST_SWITCHES only, never in production), so a device can hear a solo 37 s in and the log line
  `music:town:solo:<id>` shows it.
- `packages/app/test/music.test.ts` tests pinning `passesPerSolo` 3 follow (each old → new in the PR body); `docs/areas/town-square.md`
  ("about every 9.5 min") and a 5-line decision note.

Light on checks: typecheck, the music unit tests, the town e2e only if it touches music. Push; `.pr-body.md` (short) and `.done`.
Commits end with the `Claude-Session:` line only, no model names. No PR, no waiting on CI.
