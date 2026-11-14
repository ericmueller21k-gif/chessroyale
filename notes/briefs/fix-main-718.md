# Main red after #718 (ride sounds): two town specs; fix the cause (game or test), not a checker

Effort high. New branch `claude/fix-main-718` from `origin/main` (65902dc3 or later). Read CLAUDE.md "Fix the cause…", `.claude/LESSONS.md`,
`docs/decisions/2026-11-14-flaky-round6.md` (tapPoint off-middle; the dev proxy). Main's run on 65902dc3:
1. **`[phone] e2e/town-chat.spec.ts:1054`** "the typing line … one message per 15 seconds: a try inside the wait …" FAILED BOTH TRIES at
   line 1141: `expect(sorry, "the line replaced").not.toHaveText(<first line's text>)`: the second try inside the cooldown came in the same
   second as the first, so "Sorry, you can't send another message for N seconds." has the same N (8, then 5 on the retry) and the text
   can't change. (Round 3 saw the same: "the cooldown countdown read 6 twice".) Decide what the game should do: a second try replaces the
   gray line (same element or a new one?) with the N at that moment. Then make the test check what the rule really is (e.g. the line is
   replaced, one line only, its N is the wait left at that moment from the server's/your send time) without depending on a second
   boundary: no `waitForTimeout` to dodge it. If the game doesn't really replace the line (only its text), say so.
2. **`[desktop] e2e/town.spec.ts:966`** "a person's card…": `tapAt` → `townTap(p, "bot", 9, 5000)` returned false ("bot 9 is drawn")
   on the first try (passed on retry). Round 6 made `tapPoint("person")` look either side of the middle; still not found for 5 s. Find
   where bot 9 is on that frame (hidden wholly behind your pawn? another figure? off screen? fading in?) and fix the cause: the game's
   test hook, or the test choosing a bot it can reach (say why).
Prove each with `--repeat-each 5 --retries 0` on the failing project (before and after where reproducible). Typecheck; unit tests you
touch. Push at each real step; `.pr-body.md` (cause, fix, checks old -> new); `.done`. No PRs, no CI waits, no model names in commits
(end commits with the Claude-Session line only). About 45 minutes.
