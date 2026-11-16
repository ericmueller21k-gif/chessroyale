# The queen banners are events of real captures (Nov 5, 2026)

Eric, Nov 5: "Just look at the code … and change the code so it's straightforward and that the banner for his ult is
tethered to when he ults, and the queen capture is tethered to when your queens are captured. How could they ever
intercross like they did?" And: "The queen banner should happen literally when a capture is written … write something
into the engine to read a capture versus simply checking the board … there's multiple instances where I can see fails
happening because of the boss's moves or freezes."

## Why they crossed

QUEEN DOWN! was worked out on every redraw from state ("his last move took a queen and is still the board's last
move"), QUEEN SLAIN! from the board ("the piece on the last move's square, before it, was his queen") plus exceptions for
the bounce, the hop, Alfil's steps and the Revision. Nothing said "this capture's banner has shown", so every screen that
redrew without a new move (the Slam's, a bounce's, the funhouse's, a second thinking) needed its own guard, and a board
changed by a power could fool the board look-up.

## What changed

- **The engine records each capture** where the move is played: `playOnBoard` (every move of a boss battle goes through
  it: the crowd's, the boss's, Hollow's extra move, the move Boingo's funhouse plays for you) appends
  `{ ply, side, from, to, piece, color }` to `BoardState.captures` (`captureOf` in `rules.ts`: the other side's piece on
  the square it lands on, or en passant). The stored match keeps it (the snapshot spreads the board) and the protocol
  sends it (`NetBoard.captures`, optional). Folio's Revision removes the records of the two moves it crosses out. A burn,
  bounce, freeze, Slam, plant or any other power writes none.
- **The banners read only those records** (`packages/app/src/battle-banners.ts`): QUEEN DOWN! for each of his that took
  your queen, QUEEN SLAIN! for each of yours that took his, keyed to the ply. One is due only while its move is the
  board's newest, on its own screen (QUEEN DOWN! where his move lands, bossShowMs's time; QUEEN SLAIN! in his thinking,
  bossThinkMs's), and shows once (`bannerOn`: a key's first showing, for a banner's length, never again; reset at a
  battle's intro, and by a reload). The `!funhouse && !bounce` and "his move is the board's last" guards are gone.
- `queenSlain` (how long he thinks) reads the same record; the boss's `lastMove.captured` (bossShowMs, the God King's
  "queen lost" line) comes from the record too.

## Calls

- **The bounce/hop/step checks stay in `queenSlain`.** They no longer decide whether the banner shows (the shown-once
  rule does); they decide the clock: his second thinking of a turn (after a bounce, hop or one of Alfil's steps) doesn't
  wait for a banner that has already played. Removing them would lengthen that thinking, a gameplay change. The Revision
  check went: a crossed-out capture has no record now.
- **"Due only while its move is the newest"** is what keeps old records quiet: after a reload (the shown-set is empty)
  or a screen the device missed, an older capture never plays. The cost: a reload during a bounce or his second thinking,
  straight after your capture, can show QUEEN SLAIN! there once (a reload already replayed the banner before).
- **Power banners are left as they were.** Each is drawn by its moment (`PowerMoment`'s `banner`), keyed to its use
  (`boss:kind:turn`) and only within that moment's beats, so it was already an event; routing them through `bannerOn`
  would add nothing and break the banner-length tests, which draw the same moment at made-up times.
- **Old matches and apps.** A match stored before this has no records for its earlier captures: those banners have
  played already, and every capture from the update on is recorded. An older app ignores `captures`. A new app on a
  server without it shows no queen banner (the Worker serves both, so only during a deploy).
- `battle-banners.ts` is added to `e2e/areas.json` (the boss screen's area). This PR runs the full suite anyway (areas.json
  and shared rules changed).
