# Main red (FLAKY_RED) on e95a01d5: town-ranked.spec.ts:105, desktop. Find why the table card closes by itself. Opus, medium. Targeted.

Read `notes/briefs/rules-common.md` first. Branch `claude/flake-town-ranked-card` from `origin/main`.
Main's run 46109762429, shard 13: `[desktop] e2e/town-ranked.spec.ts:105` failed, passed on its retry. `rankedAt` (line 74):
`tapInTown(page, "table", 3, card)` succeeded (the "Chess table" card seen visible twice, the last after `__townYou().moving` was false),
then `card.getByRole("button", { name: "Casual" })` → "element(s) not found" for 5 s; the page snapshot at the failure shows **no card
open at all**. So the card opened and then closed by itself within moments. The town then had Ann, Bo, Cy (all signed in, test 2's
setup) and a bot (the chat shows "Crumb: Crumb here! Careful, I'm still warm."). No trace of the failing attempt (traces are kept on the
retry only).
Find what closes an open table card on its own (a bot greeting or arriving, someone entering, others' beats, a seat change at that table,
the sit itself, placeCard hiding it off screen, …): run the test on `--project desktop` repeatedly (`--repeat-each`), and/or add temporary
logging of every `setCard(null)` with its reason. If a player could hit it (you tap a table and its card vanishes), fix the app; if it's
only the test, fix what the test waits on (never a longer timeout or a retry). Prove it with repeated runs (show the before/after counts).
Short PR body (plain words, changed checks old → new). Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`,
stop. About 45 minutes.
