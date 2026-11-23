# Quick review: PR #896 (Birdie), boss lane. Opus, high, read-only, about 30 minutes, ONE pass

Read CLAUDE.md, `.claude/LESSONS.md` ("keep before show" included), `notes/designs-birdie.md` on `claude/director-notes` (Eric's
design), the PR body, then `git diff origin/main...origin/claude/birdie`. Focus where a bug would break a match or fair play:
- `packages/chess/src/bosses/birdie.ts`: the warning's pick (exactly one crowd piece on the line, the seed's choice the same on every
  device), the smash and the king loss, the fall's material count, once a battle, no train after the fall.
- `runner.ts` (`trainJob`, `trainWon`), the lobby's win hold and the ultimate's turn hold: solo and online the same; a rejoin or reload
  during the wait or the cutscene; the crowd's clock.
- The judge: a warned turn scored fairly; `powerTurn` for fair play and the Last Stand.
- The protocol's optional fields: old clients and servers unaffected.
- Screens: nothing hidden or shifting (docs/rules/eric.md); the music's drop on the impact.
Don't fix, no fuzz marathons. Write `review-896.md` (important / nit, each with file:line, a failing case and the fix; then "checked,
fine") plus an empty `.done` on an orphan branch `review/birdie`, push and stop. Commits end with the `Claude-Session:` line only.
