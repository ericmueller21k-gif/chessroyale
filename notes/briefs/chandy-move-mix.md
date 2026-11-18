# Chandy: with all five upgrades he spams Scatter shot (Eric, Nov 18). Opus, xhigh (boss brain), alone

Branch `claude/chandy-move-mix` from main. About 1-1.5 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-16-chandy-rules.md`,
`docs/areas/bosses.md` (Chandy), `packages/chess/src/bosses/chandy.ts` (its header is the rule).

**Eric, Nov 18, after a real game on hunchess.com:** "he literally had all 5 but kept spamming the scatter shot, used barrier once and
other than that nothing. Gotta see what is going on. Oh wait he did use the double beam once but he randomly skipped one entirely."
(Barrier = Shields; double beam = Beam; the move he never used is one of Rapid fire / Queen lock.)

**The rule (chandy.ts header):** the meter full as his turn begins, he picks the newest unlock first, else random among the unlocked
(not the one he used last when there's a choice; the queen lock only when it can come); a new unlock fires at once (`fireOnUnlock`).
`meterPick`, `landMove` (a pick that can't land here: another unlocked move that can, seeded), `fresh`/`last`/`used`.

**Find the cause, don't guess (CLAUDE.md, Nov 13).** Measure first: real battles without test switches (and with `?power=dodge`,
all five from the start), solo and the server's path, tallying per battle which move the meter picked (`due`) and which actually
landed, and why a pick fell through (`landMove`'s fallbacks, `fresh` never cleared when its move can't land or is swapped, `last`,
the seeded rolls, `queenLockOk`). Suspects to check, not conclusions: a `fresh` move that keeps getting re-picked and swapped out; a
pick that can't land (e.g. the beam or shields finding nothing) silently landing Scatter; the queen lock almost never possible.
Then fix the cause so the moves he has actually come in Eric's rule's mix (newest first, then random, not the same twice in a row),
the same solo and online. If the queen lock is simply rare by its own rule, say how rare (per battle) and propose (don't change) a
rule for Eric in one line, e.g. a fallback or a looser condition.

Checks: a unit test that fails before and passes after (a real seeded battle's sequence of picks), the boss kit, Chandy's tests,
the server's boss tests. One sim run at one setting for the before/after mix. Boss lane (rules). Done: `.pr-body.md` (under 40 lines:
the cause in plain words, the before/after mix per battle, changed checks old → new) and `.done`; push and end.

**Added (Eric, Nov 18, later):** (1) "make that upgrade [the queen lock] happen earlier": director's call, while the crowd has a queen
it is his first unlock; else as today. (2) "for the 1st and 2nd capture he should apply the same thing where he locks onto the 2nd
piece he captures right beforehand": his second capture is taught like the first (lock, point, capture: upgrade 2); the hunt from the
third. Sent to the helper (session_01JuCWRtAQ1mUWjYnoEL6Fxr).
