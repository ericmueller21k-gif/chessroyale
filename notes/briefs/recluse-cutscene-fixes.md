# Fix round: PR #679 (the Hidden Boss's cutscene), ~30-45 min

Effort high, boss lane. Branch `claude/recluse-cutscene` (`git pull` first). Read CLAUDE.md, then the review:
`git fetch origin review/679 && git show FETCH_HEAD:review.md`. Fix, each with a test:
- **M1:** a reload during the scene online shows the scene from the right point (not "Connecting…"): when a `phase2` view arrives with
  `now < at` and the phase isn't the boss fall, set the fall phase (`toPhase2`, from `m.boss`), so `RecluseCutscene` draws from
  `now - cutAt`; the beaten theme plays. Add the phase assertion to `recluse-online.test.ts`'s reload test.
- **m1:** during the scene the ⋯ menu is greyed (shown, not tappable), as the 🏆 is ("nothing hidden": greyed, never hidden).
- **m2:** `Voice.reset()` clears `hushedUntil`; the scene's effect un-hushes on an early unmount.
- **m3:** the stale "MOCKUP, wired into no match" comment.
- Nits: say the test-only lower bound in a comment; leave `absorbReadMs`.
Typecheck, the app unit tests you touch, `e2e/recluse.spec.ts` "Win this form" (phone). Append a short "Review round" to the PR body
(the director's copy: `notes/briefs/recluse-cutscene-pr-body.md`), push, `.pr-body.md`, then `.done`, stop. No PRs, no CI waits, no
model names in commits. Never stop silently.
