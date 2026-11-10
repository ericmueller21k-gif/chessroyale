# Fix round: PR #611 (the boss and lone devices)

The independent review is `review.md` on branch `review/fable-b3` (`git show origin/review/fable-b3:review.md`), with proof
tests in `proof/` on that branch. Work on claude/fable-b3 (PR #611; pull first). Copy the proof tests into packages/server/test/
and turn each into a test the fix passes.

## Do (the director's calls)
- **B1 (blocker):** the review's fix, all three parts: the app says which brain played (`bossMove.by`); a Maia move against a
  fallback plays the Maia device's move unless the server finds a throw, and strikes nobody; strike only at a throw-sized gap
  above Maia's honest worst (measure it from reports/maia-boss.md; a setting), never 0.4; and a checker only from devices that
  reported Maia ready (`maiaReady` after `init`), else unvouched. The boss must play at his calibrated strength: never "the
  better of two" for honest differences.
- **E1 (Maia's 40 MB):** option (c): a phone checks only if its Maia is already cached or loaded (it reports it); otherwise
  computers only, and a raid with no ready checker is unvouched (pays as solo). No new download is started on a phone for this.
- **M1:** a host change during a checked move re-asks (fresh checker beside the new host, same seed), keeping answers by device;
  a host that is also the checker never counts twice.
- **M2:** the checker gets only what the move needs (no showdown/drag/hoops/balloon/crease/beam extras); a checker that misses
  the window is replaced next move, two misses a strike; before unvouching, ask a second checker or the server once.
- **M3:** port the main lobby's late-answer handling to Squads (a late disagreeing answer gets a server verdict; the device
  further from it is struck), and the grace "at least, or this fraction of the first's time", as JUDGES.
- **M4:** decide it per squad, not per lobby (a squad's placement goes unpaid only if its own matches' bot work rested on its own
  party alone); reword the text to "nobody outside your party checked the bots' moves". Keep "a party alone with bots earns
  no coins or crates" as built; the director is asking Eric about it separately (don't change it).
- **m1:** seed limited-strength Stockfish (draw over the top-8 search with the seeded rng, as `stumble`), so honest devices agree.
- **m2:** a `seeded: true` flag at hello; only flagged devices check or get compared.
- **m3:** draw the checker at random (`jrng`) among eligible devices, never from the host's account or party; a party raid
  with no outside device is unvouched.
- **m4:** unvouched matches don't feed fair play (skip `rec.fair`).
- **m5:** one line on the result screen for an unvouched match: "Only one device checked this match: it pays as a solo game."
- **m6:** leave (note in the PR body); **m7:** the cap's notice survives a late write (store it with the result), or the card
  never shows coins that weren't paid; pick the least code.

Lane: full plus the boss kit; effort xhigh. Run locally only the tests you write or change, the server and chess unit suites, the
boss kit, and `e2e/boss-smoke.spec.ts` on phone. Run `npm run typecheck` before your last push. Update the decision note and area
pages. Write `.pr-body.md` (the full body: what changed, player-visible, changed checks old → new, engine-server cost, not done)
and `.review-fixes.md` (each finding: what you did, or why not), push; don't open a PR. Read CLAUDE.md and
notes/briefs/rules-common.md first.
