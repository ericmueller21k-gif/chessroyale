# Independent review: PR #885 (solo Resume / Forfeit), read-only, ONE round. Opus, xhigh, alone

PR #885 (branch `claude/solo-resume`) is step 2 of the refresh-dodge fix (step 1 was #881: a solo game left past 10 moves is
recorded as a loss). It keeps a solo boss battle on the device (`packages/app/src/solo-kept.ts`), shows "You have a game in
progress" with Resume / Forfeit after a reload, adds `GET /api/me?resume=` and `POST /api/xp/solo/forfeit`, and
`AbandonWhich.resumable`, `soloGameOpen`, `forfeitSoloGame` in `packages/server/src/xp.ts`. Results are stored data and the whole
point is that a refresh can't dodge a loss. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-22-solo-abandon*.md` and
the new decision note, the PR body, then the diff (`git diff origin/main...origin/claude/solo-resume`).
Rank only what matters (important / nit; nits short):
- Dodges: any path where a player past 10 moves reloads, closes, opens a second tab, signs out/in, switches account, clears the
  kept game, or edits local storage, and ends with no loss recorded (or can retake a move: the kept game must hold the move in).
- Double counts: a loss recorded twice, or a real finished result (win or loss) turned into a forfeit, or recorded after a forfeit;
  `results.solo_game` once-guard; races between the load's settle, Resume, Forfeit, `keepUnsent` resends and the 24 h stale rule.
- Resume fidelity: the same position, powers, carrots, clocks, boss state and server game id; a kept game from an older build or
  a changed setting/roster; another account's kept game never offered; "That game has already ended."
- The server: guest cookie and session, rate limits, ban gate, PAUSE_SOLO; nothing a device can send to erase a loss or forge one
  for another account; no time XP for a forfeit.
- Screens: the card and "Forfeit your game in progress?" follow docs/rules/eric.md (nothing hidden, nothing shifts) and the
  Hidden Boss's name never shows. The Chandy Dodge fix (N4 from #881).
Don't fix. Write `review-885.md` on an orphan branch `review/solo-resume` (findings with file:line, a failing case and the fix;
then "checked, fine"), plus an empty `.done`. Run the server and app unit tests you need and any you write. About 45 minutes.
Push and stop. Commits end with the `Claude-Session:` line only. Effort xhigh: stored results and a fair-play hole if wrong.
