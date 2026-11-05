# Brief: tie the battle banners to their events (code; Opus high)

Worktree `/home/user/cr-bannerev`, branch `claude/banner-events`, made from main (the director creates it). Run `npm ci`. Ports 8997,
inspector 9497. Include notes/briefs/rules-common.md.

## Eric (Nov 5)
"Just look at the code for him and see when the banner is appearing and just change the code so it's straightforward and that the
banner for his ult is tethered to when he ults, and the queen capture is tethered to when your queens are captured. How could they
ever intercross like they did?"

## Today (read first)
`packages/app/src/screens/Boss.tsx`, about lines 305–315 and 532–533, and `packages/chess/src/boss-timing.ts` `queenSlain`.
- QUEEN DOWN! (`tookQueen`) and QUEEN SLAIN! (`slewQueen`) are worked out on every render from the board's current state: "his last
  move captured a queen and is still the last move on the board", and "the last move took his queen, and he's thinking".
- They aren't fired once when the capture happens. Because of that, anything that redraws without a new move (Alfil's Slam turn, a
  step, a bounce, a funhouse, Revision) has needed its own exception. Commits bb55143d, 1fef218e and #345 patched the queen banner
  coming back on the Slam's turn.
- Alfil's MAMMOTH SLAM! is already tied to his power moment (`components/Alfil.tsx` `slamMoment`, `banner(...)`). Check that the other
  bosses' power banners are too.

## Do
- Make each banner an **event**, shown once and keyed to the thing that caused it, with no state guesses:
  - **QUEEN DOWN!**: once for each of the boss's moves that captured your queen, keyed to that move's ply (or its move id). It shows
    when that move lands, never again, and never on a power's turn.
  - **QUEEN SLAIN!**: once for each of your moves that captured his queen, keyed to that ply. It's already keyed this way; make it
    use the same event path.
  - **Each boss's ult/power banner**: once for each power use, keyed to that use (its `at` turn). Leave the ones already done this
    way alone, but route them through the same shown-once rule if that's simpler.
- One small module (for example `battle-banners.ts`) that turns the match's history and power uses into a list of banner events. A
  shown-set (per match, survives re-renders, reset on a new match or a reload as today) decides which are new. `Boss.tsx` renders
  only the new ones.
- Delete the special cases that only existed to stop a banner coming back: `!funhouse && !bounce`, "lastOnBoard ===", and the
  `queenSlain` power exceptions where the event model makes them unnecessary. Keep only what still means something: a Revision that
  crossed a capture out is no capture.
- Order when two happen together, such as his capture of your queen with his Slam starting on his next turn: each shows in its own
  turn, never merged and never twice.

## Done
- **Unit tests** (new `battle-banners.test.ts`):
  - a queen capture gives exactly one QUEEN DOWN! or QUEEN SLAIN! for its ply;
  - a power turn (Slam, step, bounce, funhouse, Revision) re-renders without repeating it;
  - Revision crossing the capture out gives none;
  - each ult gives one banner.
- **e2e:** the existing banner specs keep passing. `e2e/alfil.spec.ts` "Alfil's Mammoth Slam right after a queen is taken" currently
  plays at most 14 of your moves and can run out before the Slam lands (it failed that way on CI). Make it keep playing until the
  Slam has landed, with a time cap in place of the move cap, so it tests the banners and not luck. Record that as a changed check.
- **PR body** in `docs/banner-events/pr-body.md`: what changed, any player-visible change (should be none beyond banners never
  repeating), changed checks old → new, lane (boss lane; full e2e if shared boss code changes).
- Push, but don't open a PR. Send a short report.

## Addition (Eric, Nov 5): only from real captures, everywhere
"The queen banner should happen literally when a capture is written… write something into the engine to read a capture versus
simply checking the board… there's multiple instances where I can see fails happening because of the boss's moves or freezes."
- When a move is applied (the shared rules or engine: the boss's, yours, a crowd's), record a capture event: ply, side, from/to, and
  the piece taken. It goes in the match state or history, so client and server share it and it survives a reload.
- QUEEN DOWN! and QUEEN SLAIN! read only those records, never the board. A power, freeze, step, bounce or funhouse can't make or hide
  one. Revision crossing a move out removes its capture.
- Every boss and mode that shows them. New protocol or stored fields are optional, so old clients and matches still work. Lane: full e2e.
