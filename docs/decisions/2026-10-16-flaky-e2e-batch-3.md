# Two flaky e2e tests, four causes, one game bug (Oct 16, 2026)

CI's `e2e` run listed these as flaky (passed only on the retry). Each was traced to its cause from CI's logs and the
failing tries' page snapshots, and reproduced locally before anything changed. No assertion was loosened, skipped or
given a longer timeout. One was a real bug a player could see (a Squads banner cut short); the rest were the tests'
own setup.

## Sawyer beaten before his split: `sawyer.spec.ts` "Sawyer: his first move a pawn's, then the split…"

- **Seen:** 6 failed tries in the last 80 CI runs (Oct 15-16). Five on a phone, all the same way: the test waited for
  "play" after one of its own moves while the match was already on its results ("Victory! You beat Sawyer!" in the
  failing try's page). One on a computer (run 38821146637): the first move's knock was "castle", not "move".
- **Cause 1, the early win:** until his split the test plays the engine's best move, or a pawn take that costs little
  (`roomMove`), so his pawns go and the split gets its room. Now and then the engine's best is mate: the battle ends
  before he splits, and the test waits for a turn that never comes. Locally 0 of 16 as it comes. From the test
  switch's mate-in-one start (`?win=1`: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6) 2 of 18, both mated by the test (one: …9.Qxf7#,
  the results on the crowd's 9th move, as on CI).
- **Cause 2, castling as the quiet move:** the first move must be quiet, so its knock is the plain move's. The test's
  quiet moves were those that take nothing, and castling takes nothing, but its knock is "castle". With the Easy boss
  (other openings) 1 of 10 locally (1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5, then 6.O-O as the quiet move), as
  on CI.
- **Fix:** the test never plays a move that ends the battle (mate or stalemate): it takes the engine's best of the
  rest (`ranked`, as `grex.spec.ts` has since batch 1). Its quiet moves leave castling out, the moves it asks for too
  when the move must be quiet. The game was right both times. From the same mate-in-one start: 0 of 18, the mate
  (Qxf7) passed over in each.
- **Turned down:** a stronger forcing (a waiting first move, 4.a3, to keep Qxf7# on the board): Sawyer answered …g6
  every time, so it forced nothing. Its one failure, in 16, was its own: in that line the test's queen went for a pawn
  (every move's expected score near 1, so "costs little" allowed it) and he then played 20 piece moves without the pawn
  move his split waits for. No natural run did either.

## A banner another match cut short (a real bug): `squads-mercenary.spec.ts` "the shop between rounds…" (desktop)

- **Seen:** on #252's run, the shield canceled the other squad's block in your match, but the test never saw the
  banner that says so ("Your shield canceled Bishops' block on your Ng8–f6"). It looks every 100 ms.
- **Cause:** the Squads client kept **one** banner for the whole lobby (`banner` in `squads.ts`), and the line above a
  board showed it only while it was that board's. Every block placed, block lifted, shield or brilliant move on **any**
  board of **any** match replaced it, and every client hears of every match's. So a player's "Your shield canceled…"
  or "Knights blocked your Qd8–f6" went as soon as something happened on another board, instead of staying its 3.6 s
  (`BANNER_MS`). Every write to it logged over 12 local runs (all passing): the shield's banner was replaced by another
  match's after 36, 67, 99, 140, 416 and 755 ms (6 of 12 cut short; 3 inside the test's 100 ms look, where the test
  passed only because the other match's shield banner was a shield banner too). Another match's banner forced right
  after the shield's half: CI's failure in 3 of 4 (the fourth failed earlier, on the partner's pick, below).
- **A second gap, found by the stricter check:** a half's events can hold two shielded blocks, one on each board (each
  squad's shield canceling the other's block). Only the first got a banner, so the other board's squads were never told
  on their board.
- **Fix (game):** each board keeps its own latest banner (`banners` and `bannerOn(key, board)` in `squads.ts`; the
  screen reads its board's), and each board of a half gets its own shield or lifted banner. An event elsewhere no
  longer touches a board's banner; a newer one on the same board still replaces it, as before. The note to the squads
  in the match is unchanged (the first shield). The test checks the shield banner of its own match and board, not any
  shield banner in the lobby. Forced as above: 0 of 6 (one earlier forced try, before the per-board shields, failed on
  the second gap: its banner went to the other board).

## The partner's pick counted as a token line: the same test (desktop)

- **Seen (locally, in a forced run):** four arrows on the board where the Stockfish token draws three.
- **Cause:** the test counted every arrow on the board. Your partner's pick shows as a blue arrow once their bot has
  picked, in its own thinking time, so it was there or not depending on how long the token's lines took.
- **Fix:** the test counts the arrows besides the board's live picks (from the client's state). Waiting for the
  partner's pick before counting: the old count failed 3 of 3, the new one 0 of 3.

## Before and after (local, `--repeat-each`, failures over runs)

| Test | Before | After |
| --- | --- | --- |
| `sawyer.spec.ts` the split (phone) | 0 / 16; CI 6 in 80 runs; mate-in-one start: 2 / 18; Easy boss: 1 / 10 (castling) | 0 / 16; mate-in-one start: 0 / 18; the file, both projects: 0 / 14 |
| `squads-mercenary.spec.ts` the shop (desktop) | 0 / 12, the banner cut short in 6; another match's banner forced: 3 / 4 | forced: 0 / 6; the file, both projects: 0 / 24 (twice) |
| the same, the partner's pick in the count (forced) | 3 / 3 | 0 / 3 |
