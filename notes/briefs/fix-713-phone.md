# #713: the God King's words over a teammate on a PHONE (party layout)

Effort high. Branch `claude/recluse-phase2-standings` (PR #713, open; head 4e4dd4cf). Pull it, fix, push. Read `CLAUDE.md`,
`.claude/LESSONS.md`, the PR body (`git log` + the decision note `docs/decisions/*712*` / the bosses page paragraph it added).
The PR body is the director's (don't add `.pr-body.md`); write `.review-fixes.md` (cause, fix, player-visible, checks old -> new) and `.done`.

#713 fixed the God King's box for a COMPUTER's party layout (252 px, all 128 lines measured at 1280x800 and 1920x1080). On a PHONE,
CI (run 43605689472, shard 9, `[phone] e2e/hidden-boss-room.spec.ts:116`, first try; passed on retry because his line is random)
caught his line "Another tyrant on a borrowed throne. Let's take it back." over `.dk-mate-art` (a teammate's pawn) for many frames
(check at line ~200-235: `.boss-dock.dk-party .gk-bubble` vs `.under-board, .dk-mate-art`). A retry-pass on main turns main red.
- Fix the phone's party layout so no God King line covers a teammate's pawn or the under-board row, at an iPhone 13 (390 wide) and a
  small phone (360 x 640 if the e2e has a size; else the narrowest the project uses). Measure the same way #713 did: force each of his
  128 lines, record overlaps, before and after. Keep his box's place and every container's size (Eric: nothing shifts); a narrower or
  taller box, or rows, are fine. Phone design note from the QA: on a phone his words beside him running left over the Players panel is
  by design — that panel isn't in the check; don't change it.
- Then the spec's test on phone `--repeat-each 3 --retries 0`, one at a time, under the shared e2e lock.
Typecheck; app unit tests you touch. Push; `.review-fixes.md`; `.done`. No PRs, no CI waits, no model names in commits (end commits with
the Claude-Session line only). About 40 minutes.
