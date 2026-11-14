# The Hidden Boss's fight: fix what the visual check found (Nov 14)

Effort high. Boss lane (one quick fresh review after, by the director's call). New branch `claude/recluse-qa-fixes` from `origin/main`.
Read `CLAUDE.md`, `.claude/LESSONS.md`, `docs/areas/bosses.md`, `docs/rules/eric.md` (guard tests: game-side fixes only) and the
check itself: branch `review/recluse-visual-qa`, `review.md` (problem numbers below are its), stills in `stills/<size>/`, metrics in
`metrics/`, and its capture script `capture/hidden-boss-room.spec.ts` (reuse it to re-shoot; run it from an uncommitted folder as it did).
Never write the Hidden Boss's name in player text, commits or PRs. Eric's rules apply: nothing hidden, nothing shifts; simple beats
flashy (least code, reuse what works).

Fix, in order (fix the cause; one cause may fix several):
1. **#1 (high): phone, his line at the countdown is an empty 26 px sliver** in the bar. Likely SpeechBox's `balanced` width measured
   once while his place was hidden (`.rc-away`). Fix in `speech.tsx` so a fitted box measures when it can actually be laid out
   (never keeps a width taken while hidden) — this protects every fitted box, not just this one.
2. **#2: the cutscene's lone tail (◆) with no box** between lines (`RecluseCutscene.tsx` `.cs-tail`, `recluse-cutscene.ts` `boxAt`).
   The tail must show and fade with its box, from one source of truth (not two fade rules).
3. **#3: computer, the bar's portrait doesn't follow his form** (kid 9 -> 13 -> 20, the man, then the suit and helmet in phase 2).
   Make it follow exactly as the phone's bust does, reusing the bust's own logic (`Boss.tsx` `BossBar` -> `BossFace`).
4. **#4: his fall's words float 82 px over his head** on a computer (the collapse's head height; `--bc-head`, his kit's `heads`).
5. **#5: the God King's line runs into the chat and onto a teammate** in the party layout (1280x800 and 1920x1080). His box must
   fit the room the party column leaves (`.gk-bubble` in the party layout), at both sizes, with a 3-row line.
6. **#6: the Moves panel shows phase 1's game during phase 2.** In phase 2 it shows your own board's moves (computer; the phone's
   Moves tab the same). Keep the panel's size and place.
7. **#7: phone, phase 2's three small boards show a clock but no name.** Show the player's name (ellipsized) with the clock, like a
   computer's tags, without changing the boards' sizes or places.
8. **#8: phone, the white-out doesn't reach the whole screen** (bottom panel, pawns, title still show at the white beat). Eric:
   "whites out the screen". Make the white cover the whole viewport at its peak on a tall phone too; verify with a still at the
   white's peak (not `downAt`).
9. **#9: the transformation's words over his helmet hang 21 px (computer) / 44 px (phone) past the bar's edge onto the board.**
   Keep them inside, over his helmet.
10. **#10: the four boards snap 3-6 px smaller as play starts** (phase change vs phase 2 size the quarters differently). One sizing.
11. #11 and the nits (phone bar box 2 px over the green line; the 1280 chat chips cut at the panel's bottom; "WON" tags squeezing
    names) only if they're a line or two each.
Not yours: #12 ("4th of 4", the result replaying the kid's match) goes with the phase 2 standings job.

Prove it: re-shoot the beats each fix touches at all three sizes (iPhone 13, 1280x800, 1920x1080) with the check's script and put
before/after stills on `stills/recluse-qa-fixes` (not under docs/). Watch the cutscene's line changes and the countdown frame by frame
(`npm run frames:boss` or the cutscene frames script). One focused check per fix in an existing spec where it's cheap (e.g. #1: the
bar's box is wider than its words at the countdown on a phone; #2: no `.cs-tail` without a visible box; #6: phase 2's Moves lists
your board's move after you play). Typecheck; unit tests of packages you touch; `e2e/recluse.spec.ts` and
`e2e/hidden-boss-room.spec.ts` on both projects. Push at each real step; `.pr-body.md` (per fix: cause, fix, player-visible; checks
changed old -> new; one still per platform); `.done`. No PRs, no CI waits, no model names in commits (end commits with the
Claude-Session line only). About 1.5 hours.
