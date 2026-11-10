# Independent review: PR #611 (the boss and lone devices), read-only

You review PR #611 (branch claude/fable-b3) in the full lane plus the boss kit: boss moves, judging, rewards, the lobby and
Squads protocols. Read CLAUDE.md, the PR's diff (`git diff origin/main...origin/claude/fable-b3`), its decision note
docs/decisions/2026-11-10-boss-and-lone-devices.md, and the findings it answers (`notes/fable-audit-findings.md` 2 and 5, branch
claude/director-notes).

Look for:
- **The boss's seeded double play:** two honest devices that draw different moves anyway (Maia loading, a different Maia build,
  a phone vs a computer, a timeout, a reconnect mid-move, the seed reaching one but not the other), and what then plays; a raid
  that stalls waiting on the checker; a boss whose power or personality moves break (run the boss kit); the funhouse.
- **The 40 MB Maia download on a second device:** who gets picked (a phone on mobile data?), what happens when it can't load, and
  whether a raid still plays smoothly (computing priority 1). Say plainly if this is a cost Eric should decide.
- **"One device's word pays as solo":** an honest small match (one person and bots, two people) that now loses XP or ranking it
  should keep; the unvouched flag set by an honest slow device; a lying device that still gets paid.
- **Squads:** the one-party rule and the 5-a-day cap: an honest party that's refused, the cap counted twice under a retry
  (#610's keyed writes), the placement texts.
- Does it close what findings 2 and 5 show, and is anything still open that the PR says is closed?

Don't fix. Write `review.md` on an orphan branch `review/fable-b3`: findings ranked (blocker / major / minor), each with file:line,
a concrete failing case, and the fix you'd make; then "checked, fine" in a few lines. Run the server and chess unit tests, the boss
kit, and any you write to show a finding. About 45 minutes; no fuzz marathons. Push the orphan branch and stop.
