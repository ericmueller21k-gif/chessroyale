# Quick review: the Stranger's ultimate, PR #1009 (boss lane + engine piece), Nov 27; and Eric's real-speed GIF

Read `notes/briefs/rules-common.md` first. Opus, effort high, about 45 minutes. Two parts.
1. **Review (read-only):** `git diff origin/main...origin/claude/stranger-ult` (the PR body on GitHub says what it claims; Eric's words and
   the design: `notes/briefs/stranger-ult.md`). Look hardest at: the fairness check (one engine search; the 0.35/1.25 pawn margins; the
   fallback to a milder pick; a calm turn when no answer), solo/online parity and the server's check of the pick, the freeze/burn guards
   (king, legal moves, illegal positions; never his pieces), the scene's timing (10-12 s) held the same everywhere, reconnect/late join
   mid-scene, his going live (BOSS_ADMIN_FIRST, tower pools, party picks, unlocks), the frame rate on a phone, Eric's whole-on-screen guard.
   Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on branch
   `claude/stranger-ult-review` from the PR head, push, `.done`.
2. **Eric's GIF (Nov 27 ~07:35: "send me a gif of his ult when it finishes"):** the PR's GIF only shows the turns after the scene, sped up.
   Record ONE GIF on a phone (390x844) at **real speed** of the whole ult: from the RAGE banner and his leap through the 11 s scene to his
   return, then one Ice and one Fire turn and a burn (cut the waits for your moves). Use the PR's test switches; push it as
   `storm-phone-realtime.gif` on branch `stills/stranger-ult`. Keep it under ~8 MB (fewer colors or 20 fps if needed). No code changes.
