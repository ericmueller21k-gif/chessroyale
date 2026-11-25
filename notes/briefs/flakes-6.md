# Fix main: the boss-result gap retry-passes after #946 (Nov 25). Opus high, targeted. Branch `claude/fix-flakes-6` from origin/main

Main 888abe3e (#946 item polish merged), e2e run 45621033897: two [phone] retry-passes with the same signature:
- `e2e/boss-result.spec.ts:132` "a boss battle won…" line 146: "16 px between the boss and your pawn" got 14.3125.
- `e2e/formats.spec.ts:174` "the God King's Last Stand…" line 302: the same check, 14.3125.
Both were green on main before #946 (#944's sizes: boss 2.25x, pawn 1.8x, gap 48 + padding-left 24). #946 made worn items animate
("live") on your pawn in big views (ItemArt/Avatar `live` → `.ia-live`; DressedPawn, BossDock YourPawn, …: read `docs/decisions/
2026-11-25-item-polish.md`). Suspect: the end screen's pawn now plays an item's animation (a flap, a puff, a sparkle) that widens its box
toward the boss for a moment, and the test samples the box. Find the CAUSE with evidence (which element's box, which item, which frame):
- If the pawn's measured box grows from an animation's overflow (the drawing doesn't really come within 16 px of the boss), the fix is in
  what's measured or in the animation's bounds (e.g. the effect shouldn't change the pawn's layout box), not a looser number.
- If the item's drawing really comes within 16 px of the boss on the end screen (a visible near-touch), fix the layout or keep that view's
  items still (ask: is the end screen meant to be "live"? #946's list says "your pawn on screen"; the result duo is the boss end page).
Also check whether the same can happen on the boss dock / vote screens' pawn gaps. Reproduce first (repeat the two tests, phone project;
CPU slowdown if needed). PR body (`.pr-body.md`): cause, fix, player-visible changes, checks changed old → new, tests run; a short decision
note. No eric.md guard edited. Push at each real step, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Budget about 45 minutes.
