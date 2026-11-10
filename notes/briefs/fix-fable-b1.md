# Fix round: PR #601 (device trust), from the independent review

Branch claude/fable-b1 (PR #601). The review: `review.md` on orphan branch `review/fable-b1` (its proof tests:
`zz-review-b1.test.ts` there). Read it whole first, then CLAUDE.md. Fix these, each with a test (turn the reviewer's proof
tests into the PR's own, in `device-trust.test.ts`), and nothing else:

1. **Major 1, judge pairing.** `speedWeight: 2`, `maxNps: 3_000_000` (the reviewer's table: a two-account attacker's
   both-judges chance 1.8%, while mixed computer+phone pairs stay rare). If drawing the second judge from the same device
   class as the first is small and clean, do that too. Measure the single-answer share before and after (one judges sim
   or a unit sim at the reviewer's lobby: 20 computers at 2M, 80 phones at 300k) and put the numbers in the decision note.
2. **Major 2, Squads' cache.** Don't cache verdicts at all for now (the reviewer's fix b): `TOP_CACHE` gets nothing from
   device lists. Flip `device-trust.test.ts:231-240`. A ROADMAP line for (a), the server choosing its own top moves.
3. **Minor 3.** In Squads, a second device of the same party answers as a checker: its disagreement still goes to the
   server, and its agreement settles the job at "one" trust (never shared or cached).
4. **Minor 5.** The DO door: `boards` elements must be objects.
5. **Minor 6.** The PR body, the decision note and `docs/areas/engine.md` say exactly what's true: two judges are never
   one account; a lone host's values are checked for shape, not truth (ROADMAP).
6. **Minor 7.** One line in the decision note (a Squads guest signing in mid-lobby is refused, as in the main lobby;
   production refuses guests anyway).
7. **Minors 4 and 8:** ROADMAP lines only.

Effort xhigh. Run the server unit tests locally. Push to claude/fable-b1; when done write `.review-fixes.md` at the root
(each finding: fixed how, or deferred where) and an updated `.pr-body.md`, then push. Don't open or merge anything.
