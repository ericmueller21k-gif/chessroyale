# Chandy's mate Dodge: the fix round (Nov 26). Opus high. Boss lane. Branch `claude/chandy-mate-dodge` (head e5971764).

You are the `god-king` delegate. Read CLAUDE.md, the branch's `.pr-body.md` and `docs/decisions/2026-11-26-chandy-mate-dodge.md`, and the
review: `git show origin/claude/chandy-mate-dodge-review:REVIEW.md`. Work on `claude/chandy-mate-dodge`.

1. **Merge `origin/main` first.** It has #970 (the danger line is now Birdie's plus `BOSS_POWERS.dangerBosses`: Timber, Chub & Chirp,
   Hollow, Alfil, Moo & Moon, before their first ultimate only; Chandy isn't in it). Conflicts: `packages/chess/test/ult-danger.test.ts`
   → take main's version whole (it no longer covers Chandy); the FAQ, `settings.ts`, `base.ts`, `bosses.md`: keep main's text and
   remove every "Chandy's Dodge until his checkmate rework" / "Chandy's in-danger Dodge" mention (his danger path is gone in this PR).
   This also settles the review's finding 1 and nit 2: check both read true after the merge.
2. The review's nits 3 (the `focusNow` comment), 4 (`raid-scoring-trace.ts`: play a due Dodge), 5 (the e2e meter test: assert its
   Dodge doesn't open with `cd-p-mate`).
3. **His line in full** (the director's still review): on the phone the speech box shows "Mate? Negative. One shot left in the…", cut
   off. Eric picked this line: "Mate? Negative. One shot left in the chamber." It must show whole, phone (390x844) and computer
   (1536x730, 1280x800), without moving anything else (eric.md: nothing hidden, nothing shifts): two lines, or the box's existing
   longest-line rule. Add a check (one focused check in an existing spec or the wired test) that the line isn't truncated.
4. **The God King says "Guard the queen!" on your mating move** (the still `1-phone-pause-on-your-mate.png`). On the mate that starts
   the Dodge, no stale warning: either nothing, or a line that fits (your call, the simplest; record it). Check it.
5. Update `.pr-body.md` with a "Round 2" section (what changed; checks changed old → new). One new still of the phone at his line (the
   full line) and one at the mate, pushed to `stills/chandy-mate-dodge` (never under docs/).
Typecheck, the unit tests of what you touched, `chandy.spec.ts` (phone) locally. About an hour. At the end commit and push
`.pr-body.md` and an empty `.done`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`,
no Co-Authored-By. American English.
