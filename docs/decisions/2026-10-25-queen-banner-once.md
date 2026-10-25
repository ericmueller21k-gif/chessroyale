# Queen banners show once per capture (Alfil's slam brought one back)

Eric, Oct 25: Boss alone against Alfil. Queens traded, QUEEN DOWN! and QUEEN SLAIN! each showed once, correctly. Then
the Mammoth Slam: a queen banner showed again where the slam's own banner should have been ("it was like the queen
capture banner happened again"), and he said it threw it a third time after the ult.

## The cause (proved)

`packages/app/src/screens/Boss.tsx`, `tookQueen` (QUEEN DOWN!):

    !intro && !thinking && !victim && !funhouse && !bounce && boss.lastMove?.captured === "q"

It has no key and no once-only guard. `boss.lastMove` is the boss's last move, and it only changes when he moves
(`runner.ts`, `bossLast`, set in `applyBossMove`, cleared at a new battle). So after he takes your queen, his capture
stays `lastMove` through the crowd's move, his thinking, and any moment that plays before his next move. Those moments
(here the Alfil Mammoth Slam, which plays at the start of his turn after your move) are not thinking, so `tookQueen`
went false during the thinking and true again when the slam's moment began. FightBanner mounted a second time.

The repro (`e2e/alfil.spec.ts`, "Alfil's Mammoth Slam right after a queen is taken", phone project, on main's code):

    alfil slam after queens: his takes of yours 1, yours of his 0; banners in order: TUSKS! | QUEEN DOWN! | QUEEN DOWN! | MAMMOTH SLAM!
    Error: his take of your queen: its banner, once
    Expected: 1
    Received: 2

The banners are listed in the order they appeared on the page (each element counted once). The second QUEEN DOWN! mounts
after his capture and after your move, before the slam's own banner, with his capture still his last move. (The first
capture was made on his move; the admin's test trigger (`window.match.triggerUltimate()`) brought the Slam at the start
of his next turn after your move, as Eric's ult did.)

The director's guess was right: the banner had no once-only guard, and the Slam's turn brought it back.

## The fix

`tookQueen` now also requires that his move is still the board's last move: the board's last move (UCI in
`boss.board.history`) equals his `boss.lastMove.move`. Once the crowd moves, the last move is theirs, the check is false,
and the banner cannot come back for that capture. His next move makes a new capture or none, so a later capture still
shows.

    const lastOnBoard = boss.board.history[boss.board.history.length - 1];
    const tookQueen = ... && boss.lastMove?.captured === "q" && !!lastOnBoard && lastOnBoard === boss.lastMove.move;

A first version compared the piece on the last move's destination with the crowd's colour. The Mammoth Slam lifts the
crowd's pawns and minors at the start of his turn, so the crowd's just-moved piece could be lifted: that square is empty,
the check passed, and the banner came back (the director's review of this PR). The move comparison has no such hole.

Edge: Pig's long pull (his first move, `specialMove`) is shown as its three squares but played as the double step, so
the two strings differ and a queen capture by that move would not show its banner. I did not check whether a long pull can
take a queen; left as is and flagged. Smudgy's hidden-rook moves are played as named (`play` is the move), so they match.

Why this and not a remembered ply: `match.seen` lives on the match, but `BossScreen` unmounts during your turn, and a
`useRef` would reset. A ply key needs the capture's own ply, which the view doesn't carry (`bossLast` has no ply). The
board's last move is already in the view and is the exact condition: his move is the latest thing that happened.

`slewQueen` (QUEEN SLAIN!) already had its once-only guard (`queenSlain`: the crowd's capture is the last move, and no
step of his has played since). It is unchanged. Its own repro (a trade, with QUEEN SLAIN! then the Slam) was not reached
in the test (see below), so QUEEN SLAIN! is covered by the existing guard and the banner-time test, not a new one.

Banner text, face, tone and length are unchanged (`bossBannerMs()`). No other banner is changed.

## Tests

- `npm run typecheck`: passes.
- `npx vitest run packages/app`: passes apart from `autochess-sounds.test.ts` ("is made quickly enough", a timing check
  of 120 ms per sound). It failed in the full run, passes 6 of 6 on its own, and its imports (`autochess/sounds.ts`,
  `characters/boss-sounds.ts`, `characters/synth.ts`) do not reach `Boss.tsx`. A parallel-load timing flake, not this
  change.
- New e2e test "Alfil's Mammoth Slam right after a queen is taken: QUEEN DOWN! and QUEEN SLAIN! once each, the slam's own
  banner in its place": fails on main (above), passes with the fix. It asserts the Slam's banner once, QUEEN DOWN! once
  per his capture, and QUEEN SLAIN! once per your capture.
- `e2e/alfil.spec.ts` and `e2e/banner-time.spec.ts`, after `npm run build` with the fix, one run at a time under the port
  lock: phone 10 of 10 passed (2.6 min), desktop 10 of 10 passed (2.8 min).

## Not reached in the repro

The test did not get a queen trade (your queen taking his) in this run: his queen was never capturable on the turn after
his capture, so QUEEN SLAIN! was counted as 0. The assertion `QUEEN SLAIN! === your captures` still runs. A trade variant
would need his queen to come into reach; that's left as is, since the brief's bug (the second QUEEN DOWN!) is shown.

## Player-visible text changes

None. The banners keep their text, length, face and tone; only the repeat is removed.

## Notes

- The brief said `POWER_BANNERS` is in `packages/app/src/boss-timing.ts`; it is in `packages/chess/src/boss-timing.ts`.
  Nothing there changed.
- `docs/areas/bosses.md` (QUEEN SLAIN! once) stays true; no area-page change.
