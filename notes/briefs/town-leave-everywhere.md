# Leaving Chess Town always asks, from inside buildings too (Eric, Nov 13) + the town-leave flake

Effort high. Targeted lane. New branch `claude/town-leave-everywhere` from `origin/main`. Read `docs/areas/town-square.md`,
`.claude/LESSONS.md`, CLAUDE.md's "Fix the cause, not add a checker", and Eric's Nov 7 rule in `docs/rules/eric.md` ("Leaving Chess
Town asks first") with `docs/decisions/2026-11-07-leave-town-confirm.md`.

Eric, Nov 13: "even if you're in a building, I don't want somebody to click out. Like maybe they press a button on their screen... or
on their desktop, and then it moves them out of the town. There should always be 'are you sure you want to exit' if you're in the
town. It's just a nice touch to have."

## 1. The confirm from inside buildings
- Anything that would take a player OUT of Chess Town while they're inside a building (a shop, a home, the Hidden Boss's hall,
  landing or room, any room) asks "Leave Chess Town?" (Stay default/Escape, Leave) exactly as on the street: the side menu, the
  phone's back gesture, the browser's back button, any on-screen button or key that leaves the town. Find every such path first
  and list them in the PR body.
- Unchanged (call made by the director): stepping out of a building back onto the street doesn't ask (you're still in the town);
  the AFK drop and forced exits don't ask; a boss challenge starting doesn't ask.
- Where Back inside a building today goes to the street, keep that. Only exits that leave the town ask.
- Update Eric's rule in `docs/rules/eric.md` (Eric's OK given Nov 13) and its guard tests in `e2e/town-leave.spec.ts`: add the
  inside-a-building cases (phone and computer) to the existing tests or one new test in that spec. A short decision note.

## 2. The town-leave:148 flake (Eric OK'd touching this guard, Nov 13)
`e2e/town-leave.spec.ts` ~line 148, phone: Back inside a shop, then `expect(room(page)).toHaveCount(0)` sometimes fails the first
time and passes on CI's retry. First answer: **is the game wrong or the test?** If Back is sometimes lost in the game (e.g. tapped
while the room fades in or out), fix the game. Only if the game is right, fix the test's wait. Prove it: `--repeat-each 10` on the
phone project under the shared e2e lock, before and after.

Another helper is working on other flaky tests on `claude/flaky-causes` and may add a `settled()` helper to `e2e/helpers.ts`; don't
edit `e2e/helpers.ts` beyond a small addition of your own, to avoid conflicts.

Typecheck; unit tests of packages you touch; `e2e/town-leave.spec.ts` both projects. One still per platform of the confirm over a
building. Push at each real step; `.pr-body.md` (what changed, player-visible, the exit paths found, the flake's cause, checks changed
old -> new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About an hour.
