# Birdie's move sound: whistles, not puffing (Nov 23). Opus high, boss lane

Eric (Nov 23, to the music helper, after hearing the four puffing runs): "I was thinking more whistles than the other stuff. Or we want
a couple different whistles. And like the double whistle, you know how the trains go like toot toot?"

Start: `git fetch origin main && git checkout -B claude/birdie-whistles origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, Birdie's area page. The recipe: `git fetch origin stills/trailer-v2 && git show origin/stills/trailer-v2:birdie-train/README.md`
(commit e5982a41; the `.wav`/`.mp3` files there are for listening only: build in code, as #901 did; never commit audio files).
Effort high: sound and timing.

Do:
1. In `packages/app/src/characters/birdie-sounds.ts`, add five whistles built in code from the README's recipe (three sines B E G
   494/659/784 Hz, each with octave 0.5, twelfth 0.33, double octave 0.15; slide up 0.7 semitone into the note over 50 ms; waver 0.4% at
   6.5 Hz and level 8% at 11 Hz; sag 0.6 semitone over the last fifth; attack 40 ms, release 120 ms; the peeps on E G B 659/784/988):
   `whistleToot` (0,0.28,1), `whistleTootToot` (0,0.24,0.9)(0.34,0.24,1), `whistleLong` (0,0.9,1), `whistleTootLong` (0,0.2,0.9)(0.3,0.75,1),
   `whistlePeepPeep` (0,0.16,0.9)(0.24,0.16,1). Reuse the existing whistle code in that file if there is one (his train's whistle alone,
   ~line 249): one whistle function, not two.
2. His ordinary move plays a whistle instead of a puffing run (replace `birdieRun`'s choice; the director's mapping):
   the double toot for most moves; one toot for a one-square move; the long blast for a move of 5 squares or more; toot-long for a
   capture or a check; the peep-peep now and then for variety (about 1 move in 5, picked deterministically from the move, e.g. a hash
   of the move string, so every device hears the same). No puffing under them (simplest; Eric said "more whistles than the other stuff").
   Remove the four puffing runs from the move's path and their sound names if nothing else uses them. KEEP whatever the ride loop
   (`BIRDIE_RIDE_LOOP`, Birdie's Train ride in the town) uses: that's the ride, not his move.
3. Levels: the whistles one gain for the set, a move's whistle stays quieter than a piece's move sound and a chirp over its start
   still reads (the existing checks in `test/birdie-sounds.test.ts` for the runs carry over to the whistles: update them, old → new).
4. Prove: typecheck; `packages/app/test/birdie-sounds.test.ts` and any kit test touching Birdie's cues; the boss kit
   (`packages/chess/test/boss-kit.test.ts`); e2e boss smoke for Birdie if it exists. Render the five whistles plus one example of each
   move type to an mp3 sheet (order: toot-toot, toot, long, toot-long, peep-peep) on a new orphan branch `stills/birdie-whistles` with
   `NOTE.md` (so Eric can hear what the game makes). Decision note of about five lines (`docs/decisions/2026-11-23-birdie-whistles.md`:
   Eric's words, the mapping). Update Birdie's area page. PR body in `.pr-body.md` (what changed, player-visible, changed checks old → new).
   `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names).
Never write the Hidden Boss's name anywhere. American English.
