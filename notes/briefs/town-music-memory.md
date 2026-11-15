# Town music: one solo decoded at a time (memory on phones)

Effort high. Branch `claude/town-music` (done, not yet a PR; head cb2ae3ec). Pull it, change, push. Read `CLAUDE.md`, the branch's
`.pr-body.md` and `docs/decisions/2026-11-15-town-music.md`, and `packages/app/src/music.ts` (`townMusic`, `loadTheme`'s one-theme-at-a-
time rule). Keep `.pr-body.md` up to date (it becomes the PR body); `.done` again when finished.

The branch keeps all three pieces decoded while the town is open (about 100 MB at 48 kHz: the theme ~69 MB, each solo ~16 MB). On a phone,
beside the town's WebGL, that's a reload risk (iOS kills a tab over its memory), and the music's own rule is one theme decoded at a time.
Change: the theme stays decoded while the town plays (as a boss loop does). A solo is decoded only when its turn is near (when it's put on
the clock, `TOWN_MUSIC.aheadS` before it plays, or a little earlier if decoding needs it: a setting) and its buffer is let go once it has
rung out. At most the theme and one solo decoded at once. If the solo isn't decoded in time, the theme plays one more pass (as now). The
fetched bytes stay in the `brc-music` cache, so decoding again later costs no download.
Tests: in `music.test.ts`'s town block: no solo decoded until its turn nears; after it rings out its buffer is released (no reference
kept); never more than theme + one solo decoded; a late decode gives one more pass. Typecheck; app unit tests; the two e2e checks the
branch already runs (`town-street` "first frame doesn't wait", `zebra-home` "Challenge plays the beat"). Update the PR body's "Calls
made" (memory) and checks. Push; `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only).
About 45 minutes.
