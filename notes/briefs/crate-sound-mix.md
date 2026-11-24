# Crate opening: the spin's clicks from sound C, the ending from A (Nov 24). Opus medium, on the open PR branch

Eric (Nov 24), after the mockup's videos: "I am liking the ... spinning sound of number 3 a bit better, but the number 4 ending sound and
everything else about number 4." Video 3 = Legendary with sound C (slot reel); video 4 = Rare with sound A (card in the spokes). The
build (`claude/crate-open-build`, b7a0b272) shipped A's clicks: the change reached the build helper too late. Fix it on that branch.

Start: `git fetch origin claude/crate-open-build claude/crate-open-mockup && git checkout -B claude/crate-open-build origin/claude/crate-open-build`.
Read `packages/app/src/crate-open/sounds.ts` (the pieces: `flap0..5`, `rest`, `whirr`, `land`, `shake-*`, `sting-*`; `CRATE_SOUNDS`),
`timeline.ts` (`cues`), sound.ts `playCrateCues`, and option C's synthesis in the mockup branch (its sound code for "C, slot reel").

1. Replace the spin's pieces with C's: the heavier metal tick with the reel's weight (speed variants like the flaps' six), C's low swell
   rising under the slowdown from about a third of the spin (one piece, timed by the cues like `whirr`), and C's lock clunk at the stop
   (in place of `rest`). Keep `land`, `shake-*` and A's `sting-*` (the glassy chord; A's Legendary/Mythic ending) unchanged.
2. Same rules: pieces made ahead in the sound worker, scheduled on the audio clock, leveled as now (clicks about a move's loudness).
3. Update the file's header comment, the decision note (`docs/decisions/2026-11-24-crate-open-build.md`: the mix, Eric's words), shop.md's
   sound line, the PR body's sound lines (`.pr-body.md`; keep it otherwise), and `packages/app/test/crate-open.test.ts` (pieces finite and
   leveled). Make one MP4 with sound of a Rare and of a Legendary on the phone (`scripts/crate-open-frames.ts`) and push them to
   `stills/crate-open-build` (never under docs/).
4. Typecheck, the crate-open unit test and one crate e2e (`crate-banner.spec.ts`) locally. Push, `.done` (already there: touch it in a
   new commit so the director's watcher sees the new head; write "sound mix" in it), stop. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
