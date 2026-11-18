# Thinking-only moments replay when the battle ends on his move by a draw. god-king lane. Opus, high (shared timing; one cause, many bosses)

Branch `claude/thinking-moments-draw` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md` ("fix the cause"), `docs/areas/bosses.md`
(the boss template, moments), and the finding: `git show origin/review/ginger-superfreeze:review.md` (finding 4).

**The cause:** moments that play while he thinks (Moo's `fullMoon`, Folio's `fold`/`revision`, Dash's `popOff`, the Zebra/Chandy turn
moments, and Ginger's coming `superFreeze`) stay in the turn's `events` when his move ends the battle by something other than mate
(stalemate, repetition, fifty moves, insufficient material): `runner.preparePowers` returns early at game over, so `bossTurnShowMs` adds
their length again and `momentsOf` plays them a second time before the result. (A mate is safe: `mateAttackDue`.)

Fix it once: mark the "while he thinks" kinds in one place (e.g. a set beside `POWER_FX`) and have `momentsOf` and `bossTurnShowMs` skip
them once the boss has moved; or have the runner clear the turn's thinking-only events after his move even at game over. Pick the least
code that covers every boss (and Ginger's `superFreeze` once #787 lands: if it hasn't, include its kind name so it's covered on merge).
One test that ends a battle by a draw on his move after a thinking moment, for two bosses (e.g. Moo and Folio): the moment doesn't replay,
the show isn't lengthened. Targeted lane. Typecheck, the boss kit, the touched bosses' unit tests.
Done: `.pr-body.md` (under 30 lines) and `.done`, end. No PRs, no CI waits.
