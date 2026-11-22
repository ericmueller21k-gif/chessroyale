# Fix round: PR #885 (solo Resume / Forfeit). Opus, xhigh, alone

Branch `claude/solo-resume` (PR #885, full lane, CI green at 53b527d). The independent review is `review-885.md` on branch
`review/solo-resume` (`git show origin/review/solo-resume:review-885.md`), with its failing cases in `review-885.test.ts` on the
same branch. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-22-solo-resume.md`, then the review. Fix on
`claude/solo-resume` (check it out, `git pull`), one commit per finding, pushing at each:

- **I4** (first: Eric would hit it on his first playtest): clear the kept game wherever the result becomes known (`noteEnded()`,
  which `set()` and `emit()` both reach), plus the second guard: a kept game whose id is the unsent result's game is ended
  (drop it, send that result, never post a forfeit for it) in `askForfeitFirst`, `reofferKeptSolo`, `keptSoloOpen`, `forfeitKeptSolo`.
  e2e: one battle played to its end, then Again: no question. (Find the cheapest end: a boss that mates fast, or the move cap via a
  test setting, whatever the existing helpers already offer.)
- **I1** (two tabs): Resume and Forfeit re-read the kept game at tap time and act on that entry only if it's still this game;
  refuse ("That game has already ended.") when its result is unsent, and send it; refuse while another tab holds it. Director's
  call on the shape: a tab token on the kept game (a Resume claims it, every keep write checks it, a tab that lost it stops with
  "Played in another tab" and its board can't move), plus a `storage` listener that re-runs `reofferKeptSolo()` so a card on screen
  follows. Keep it as small as that allows (Eric: least code, fewest ways to break). Update the decision note's two-tab line (N4).
- **I2**: keep the move as it's accepted, before the judge's `await` (`pending: { move, thinkMs }`); a resume that finds `pending`
  submits it as that turn's move. Covers tower floors too.
- **I3**: `keepFloor()` after each `finishDodgeRound` while the Dodge goes on; `dodgeTurn` starts at `round: full.results.length`.
- **N3**: cover `m.resume`'s async work with the same catch (a failed resume drops the kept game with a plain message, never a
  stuck screen). Leave N1 and N2 as they are (floors share them; note both in the decision note as known, pre-launch).
Turn the review's cases into real tests in `app/test/solo-resume.test.ts` (flipped where they show a hole). Prove it with the
typecheck, the app and server unit tests, and `e2e/xp.spec.ts` + `e2e/battle-tower.spec.ts` (phone) locally under the e2e lock.
Update `.pr-body.md` (append "Review fixes" with each finding → what changed, and changed checks old → new), then write `.done`,
push and stop. Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only. About an hour.
