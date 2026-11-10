# Fix round 3: PR #611 (the boss and lone devices)

The second delta review is `delta2.md` on branch `review/fable-b3` (`git show origin/review/fable-b3:delta2.md`), proof tests in
`proof/delta2-review-fable-b3.test.ts` there. Work on claude/fable-b3 (PR #611, head a6ddc0c or later; pull first). Copy the proofs
into packages/server/test/ and turn each into a test the fix passes.

## Do
- **N1:** the review's fix: in `checkBoss`, `maia` also needs the host's Maia ready (`this.human(host)?.maiaReady`); when it isn't,
  send no brain to anyone (as for the share) so both play the seeded Stockfish move and nobody's `by` is heard. Also: the app withdraws
  `maiaReady` when its Maia fails (`failed()`).
- **N2:** the review's fix: when the move that plays isn't the host's, the turn has extras and the host is up, ask the host for that
  move's extras (whole request, `allowed: [move]`, same seed); the checker's extras only if the host can't answer in its time. The same
  re-ask covers "the fuller extras by key count" on the same move.
- **N3:** fix the leftover Squads comments and remove the dead `solo` path if it's dead (least code; keep writeReward's own test only if
  the path stays).
- **N4:** one run of `packages/sim/scripts/elo-draw.ts` at the table's T (it now measures real seeded moves); update `reports/elo-draw.md`
  and the table only if a point is off by more than about 10% of UCI's.
- **N5:** `this.bossPlan ??= plan` for a request's brain (keep the bossBrain message's plan).

Lane: full plus the boss kit; effort xhigh. Run locally only the tests you write or change, the server and chess unit suites, the boss
kit, `e2e/boss-smoke.spec.ts` on phone, and `npm run typecheck`. Update the decision note and area pages. As your LAST push, together:
`.pr-body.md` (the full body, starting from the PR's current body on GitHub), `.review-fixes.md` (each N finding: what you did) and a
one-line `.done`. Don't push after `.done`. Don't open a PR. Read CLAUDE.md and notes/briefs/rules-common.md first.
