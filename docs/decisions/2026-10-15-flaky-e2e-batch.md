# Six flaky e2e tests, root-caused (Oct 15, 2026)

CI's `e2e` run (5 shards, one retry) listed these as flaky (passed only on the retry) or failed. Each was traced to its
cause from CI's traces and logs and reproduced locally with `--repeat-each` before anything changed. No assertion was
loosened, skipped or given a longer timeout. One was a real layout bug a player could see; the rest were tests racing
the game.

## Classic's board moved down a line between rounds (a real bug): `crowd.spec.ts` "the board never moves or resizes"

- **Seen:** on a phone, Classic's board at y 143 in some frames and 129 in others (14 px, one line).
- **Cause:** the line above Classic's board is the board's opening name, at 12 px with a 14 px line on a phone. The
  library has names up to 94 characters ("English Opening: King's English Variation, Four Knights Variation, Fianchetto
  Line, with .. d6"), and those over about 62 (60 of 675) wrap to two lines on a 390 px phone. Players change
  boards between rounds, so the round that put you on a board with a long name pushed the board down a line, and the
  next one back up. Players saw it; the test caught it only when its 25 seconds spanned such a round. Logged on the old
  layout over 10 local runs: in 2 of them a round's name wrapped ("King's Gambit Declined: Falkbeer Countergambit,
  Charousek Gambit", 64 characters; an "English Opening: Symmetrical Variation, …", 75), the line 28 px high and the
  board at 143; every other name, 14 px and 129.
- **Fix:** the name stays on one line, cut with "…" when long (`.opening-title` in `styles.css`; the whole name is the
  element's title, for a pointer). The family and the main variation, which lead the name, still show. Reserving two
  lines would have cost the board 14 px on every phone for a few long names.
- **Test:** besides the 25 seconds of play, the test now puts the library's longest name on Classic's board and checks
  the line is one line high and the board where it was. (Its in-page engine search is no longer awaited inside
  `page.evaluate`, per `.claude/LESSONS.md`, "A navigation that never happened".)

## A block on another board: `squads-v2.spec.ts` "a block: tap Block, their queen…"

- **Seen:** the match's `blocks` came back `["d8f6", "d8f6"]` (CI's trace), never the expected `["d8f6"]`; once the
  other squad had moved, `[]`. It failed both tries on PR #232's run.
- **Cause:** a match's `blocks` lists the blocks in effect on **every** board. All four boards start from the test's
  position, and any bot on another board may block a move there too, even the same Qd8-f6: with the engine's top
  moves for it, a bot that takes back with Qxd4 blocks Black's best reply, Qf6, 3.9% of the time (`botBlock`,
  `bots.blockChance`; 20,000 draws). CI listed it in 6 of 25 runs on Oct 15. The test read the whole list as if it were
  its own board's.
- **Fix:** the test reads its own board's blocks (`b.board === board`). The game was right.

## Hollow's extra move skipped: `hollow.spec.ts` "Hollow online: … runs Lights out"

- **Seen:** `lightsExtra` "skipped", not "played".
- **Cause:** after a failed Lights out he moves again only with a quiet move that gains him at most
  `lightsOutExtraGain` (3) points and loses no more (`extraMoveFrom`; Eric, Oct 10); none, and he skips it. In the
  failing local run the position was 1.e4 e5 2.d4 Nf6: the host's engine answered "" in 1.6 s (not a timeout). His
  replies are his brain's, so the test can't choose the position. Measured with the same engine and node budget:
  3 of 98 positions after two random moves each have no such move, 3 of 20 after 1.e4 (…a5, …h6, …h5).
- **Fix:** the test watches what this device (the host) answers the server's request for the extra move, and checks
  the server did exactly that: a move is played (history 5, that move last), "" is skipped (history 4). The server's
  unit tests (`boss-powers-lobby.test.ts`) cover both answers, and the solo Lights out test still checks a played one.

## The crowd mated Jefferson early: `grex.spec.ts` "Jefferson: his tiles burn … the Roman candle's 24 shots"

- **Seen:** "Victory!" 40 seconds in, with only 2 of the 5 turns of candle waves the test needs.
- **Cause:** the test plays the engine's best move against a boss a step above a new player. Reproduced: 1.e4 Nf6 …
  11.Qh5 axb5 12.Qxh7#, the match over on the crowd's 12th move.
- **Fix:** the test never plays a move that ends the game (mate or stalemate); it picks the engine's best of the rest.
  Nothing else on the crowd's side can end the match by turn 13.

## A queue gone before the line looked: `front-door.spec.ts` "home: the live line comes from the server…"

- **Seen:** the server's `/api/live` counted the other player in the queue, but the home line went from "0 in queue"
  straight to "1 match running · 0 in queue".
- **Cause:** the other player queued with bots on, so bots filled the match at the fill time (8 s on the test server),
  and the home line asks the server every 5 s (`FRONT_DOOR.livePollMs`), behind the live hub's own delay. The count's
  window could fall between two looks. (The cold start that run logged made it likelier, not the cause.)
- **Fix:** the other player queues with Bots off, which waits for people, so they stay in the queue until the test
  closes their page.

## A move the game didn't take: `boss-dock.spec.ts` "your clock: bold at the box's right…"

- **Seen:** on move 2 against Ginger the test's move never landed: "Your move.", 0:50 on the clock, 10 s after it sent
  it.
- **Cause:** the test's quiet move was the first pawn move chess.js lists, from all legal moves. Ginger's freeze
  takes one of your pieces' moves away for a turn (`crowdAllowed`), sometimes a pawn's (e2, c4 in local runs), and
  the game ignores a move it doesn't allow (`solo.ts`, `score`), as the board never offers one. Nothing else drops a
  move there: Boss alone's clock starts at once, the God King hadn't struck (3 charges left), and the Last Stand was
  off.
- **Fix:** the test picks its quiet move from the moves the game allows.

## Before and after (local, `--repeat-each`, failures over runs)

| Test | Before | After |
| --- | --- | --- |
| `crowd.spec.ts` the board never moves (phone) | 1 / 8 (129 vs 143) | 0 / 8 |
| `squads-v2.spec.ts` a block (phone) | 0 / 44 locally; CI 6 of 25 runs, one red | 0 / 16 |
| `hollow.spec.ts` Hollow online (desktop) | 1 / 10 ("skipped") | 0 / 10 |
| `grex.spec.ts` Jefferson's tiles and candle (phone) | 1 / 8 (mated on move 12) | 0 / 8 |
| `front-door.spec.ts` the live line (phone) | 0 / 10 locally; CI 1 | 0 / 10 |
| `boss-dock.spec.ts` your clock (phone) | 0 / 10 locally; CI 1 | 0 / 10 |
