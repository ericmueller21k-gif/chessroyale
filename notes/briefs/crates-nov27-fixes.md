# #1012 fix round: the independent review's should-fix and nits (Nov 27). Opus high, item-builder lane. Then a delta review.

Read `notes/briefs/rules-common.md` first. Branch `claude/crates-nov27` (PR #1012). The review: `REVIEW.md` on `claude/crates-nov27-review`.
Fix these (the director's calls in brackets):
- **S1** the twist inside the crate strip: `.cox-track .ia-twist { animation: none; }` (it can't be seen at strip speed; the reveal card
  still twists). [do it]
- **S2** Chess Town shows a still tube (its sprite is a picture): [say so, don't animate the town: "simple beats flashy"] fix the decision
  note, `docs/areas/shop.md` and the PR body to say "everywhere but Chess Town, where your figure is a still picture".
- **S3** the level-5 gate covers crates already held: [keep it, Eric's "it's only openable after level 5"]; write it in the decision note
  (pre-launch: only testers hold one).
- **S4** the first-visit notice lost under the walkthrough: hold the notice while the walkthrough is open (as the quests overlay waits:
  `quests.ts` `otherNoticeUp`); Escape on the walkthrough must not close the notice. One focused check.
- Nits: N1 the twist's keyframe distance from `TUBE_TWIST` (a CSS variable); N2 grey the held crate page's hero like the row, or drop the
  unused classes; N3/N5 the notice's and the walkthrough's level words only where true; N4 "Nothing to open right now" when nothing can be
  opened; N8 the stale "5 games" text and comments (and remove `welcomeProgress()` if unused); N9 notes to ~120 words; N10 tighten the
  solo-abandon check. N6, N7: comments only.
Run typecheck, the touched unit tests and specs (welcome-crate, shop's crate page, the walkthrough). Update `.pr-body.md` (at most 40 lines;
list changed checks), push `.done`.
