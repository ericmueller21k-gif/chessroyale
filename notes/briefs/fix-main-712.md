# Main red after #712: two of its new checks fail on main (fix the cause; game first)

Effort high. Boss lane. New branch `claude/fix-main-712` from `origin/main` (fa03a8cf or later). Read `CLAUDE.md`, `.claude/LESSONS.md`.
Main's full run 43599934296 (shard 9), `[desktop] e2e/hidden-boss-room.spec.ts:116` "his room…", failed both tries on two different
new checks from #712 (both passed on #712's own CI run, so they depend on timing or on which line is said):

1. **First try, line 321:** after the 🏆 wins all four boards, `.mv-side .mv-list .mv-row` (expected `aria-label` /^1\. You: /) is
   NOT FOUND: the Moves panel has no rows. Find what the panel shows from your move through `decided` (does phase 2's own-board list
   lose its history when the boards are decided / the phase kind changes, or does the 🏆's winning move not reach your board's
   history on the client?). If a player can see an empty Moves panel after winning, that's the game's bug: fix it there. Only if
   the game is right and the test reads too early, fix the test's wait (and say why).
2. **Retry, line 235:** the God King's words in the party layout (desktop) overlapped `.under-board side` on ~375 frames:
   "Careful. My strength feels faint against this one." (#712 fix 5 moved his box above the team, but this line, or the
   under-board row, still collides). The check only fails when he says a line long enough / at the right moment, which is why
   #712's run passed. Fix the layout so no God King line (try his longest lines at 1280x800 and 1920x1080) covers the under-board
   row, the chat or a teammate. Keep his box's place and the chat's size otherwise (Eric: nothing shifts).
Prove each: the spec's test on desktop `--repeat-each 3 --retries 0` (under the shared e2e lock), plus a quick forced check of his
longest line at both sizes. Typecheck; app unit tests you touch. Push at each real step; `.pr-body.md` (cause, fix, player-visible,
checks old -> new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). ~45 min.
