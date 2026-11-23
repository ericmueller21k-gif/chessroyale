# Birdie: sounds every 3-4 moves, a slower train, a warning sign on the marked piece (Nov 23). Opus xhigh, boss lane

Eric (Nov 23): "the train sounds happen too often and the chirping in game for birdie, make it only like every 3-4 of his moves, you hear
those. His attack train move should slow the train a bit down when it moves across the board. Also mark the piece required to move with a
yellow train warning ⚠️ like this that's glowing over the tile but also a see through, make it look clean. This way the player knows which
piece is in danger."

Start: `git fetch origin main && git checkout -B claude/birdie-cadence-warning origin/main` (main has #907's whistles and #909's smooth
train: build on both). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/bosses.md` (Birdie), the design
`git show origin/claude/director-notes:notes/designs-birdie.md` (his power: the marked piece on a line, the train if it isn't moved).
Effort xhigh: the ride's timing lives in `packages/chess` (`BIRDIE_BEATS`/`rideMs`) and drives the result and online sync.

1. **Sounds every 3-4 of his moves.** His ordinary move's whistle (`birdieWhistle`, `kits.ts` `cueSound`) and the chirp over it (his nod's
   chirp) sound only on every 3rd or 4th of his moves, the gap alternating 3, 4, 3, 4 (or picked from the move number's hash, 3 or 4),
   the same on every device (from his move number, never `Math.random`). On the other moves his move is silent apart from the board's own
   move sound. Director's call (record it; Eric can reverse): a capture or a check keeps its toot-long and chirp every time (they're
   events), and his entrance, power, ride and fall sounds are unchanged. Put the gap in settings (`BIRDIE_SOUND_EVERY: [3, 4]` or similar,
   Eric's words in its comment). Update `test/birdie-sounds.test.ts` (old → new in the PR body).
2. **The attack train slower.** His power's train crosses the board about 1.5x as long as now (`rideMs` 1300 → about 1950 ms, one setting).
   Everything timed from it follows: the smash still lands as the nose reaches the piece (`trainReaches`), the pieces stepping aside, his
   return (`backAt`), the result's hold (`powerWinShowMs`, `trainWon`), solo and online (the server's beats must match the client's:
   check `packages/server` for any copy). Keep #909's fix (`Timed`, `translate`, linear) and its e2e check (no still frames; adjust its
   ride-length bound).
3. **A warning sign on the marked piece.** From the moment he signals the line until the piece moves (or the train comes), draw on the
   marked piece's square a **yellow railroad warning sign** (a yellow diamond or triangle with a black "!"-free train-warning look, like ⚠️:
   the shape and an exclamation are fine, no letters or numbers), **glowing softly** (a slow pulse), **see-through** so the piece under it
   still reads (about 35-50% opacity, the piece on top or the sign beside the piece's top corner: your call, record it), clean edges at
   phone size. Code-drawn (CSS/SVG) is fine for a simple sign; reuse the board's existing square-overlay layer, no new frame loop. It
   follows a flipped board, and it's gone the moment the piece moves. The crossing lights on the line stay.
4. Prove: typecheck; unit tests touched (`birdie-sounds`, `birdie`, `boss-kits`, chess `birdie`, server birdie lobby if timing is there); the
   boss kit; `e2e/birdie.spec.ts` (one focused check: the sign shows on the marked square and is gone after the piece moves) and Birdie's
   boss smoke, phone and computer; watch the ride frame by frame once (`npm run frames:boss` or the e2e recorder #909 used). Stills on a new
   orphan branch `stills/birdie-cadence-warning`: the board with the sign on a marked piece (phone and computer), and 8 frames of the slower
   ride. Decision note of about five lines. Area page. PR body in `.pr-body.md` (what changed, player-visible, changed checks old → new).
   `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names).
Never write the Hidden Boss's name. American English.
