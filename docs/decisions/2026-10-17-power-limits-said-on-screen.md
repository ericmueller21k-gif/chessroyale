# Power limits said on screen; the boss's move checked last (Oct 17, 2026)

Eric (Oct 17, Boss alone against Sawyer on a computer, Hard, the admins' brain picker on "Default (Maia, no guard)",
Maia 600; the board saw up): "I tried to take, it's like it glitched, and he just played his queen through the cut in
the board and captured my piece." One move back in the history the cut wasn't drawn: "the engine clearly didn't see it
was there." How it works now: [docs/areas/bosses.md](../areas/bosses.md), "The ground rules of every power".

## What happened

- **The position**, rebuilt from his photos (the move before the boss's, then the boss's):
  `3qk2r/1q4Q1/1p1p4/3PpP1N/4PP2/8/1p3K2/7R w`, and after Eric's Nh5-f6+ `3qk2r/1q4Q1/1p1p1N2/3PpP2/4PP2/8/1p3K2/7R b`.
- **The boss's move was legal by the rules.** The knight checks from f6; his queen on g7 covers e7, f7 and f8, the
  knight d7, and d8 is the boss's own queen. So Qd8xf6 is Black's only legal move (`legalMoves` gives just `d8f6`). The
  board saw stops it, but a power never leaves anyone without a move nor blocks the only way out of check (ground
  rule 2 since the powers were designed: docs/history/bosses.md, "Ground rules for every power"). The dispatcher lifted
  the saw for that move (`bossAllowed` gives null), on every brain path, solo and online. Nothing on screen said so.
- **The "glitch":** the move before, Eric's best move was Qg7xb7, his queen taking the boss's for free, along the 7th
  rank and across the saw. It was refused, rightly. But the piece just went back, with no reason given.
- **The clue, "the cut was gone" one move back:** (a) yes, a display gap. The history view draws no power's marks on
  past moves (Play.tsx has hidden the power layer while browsing since the powers came on screen; only Hollow's dark
  stays, as it belongs to its square). (b) No, the data had it. Solo's runner reads its own live state; online the
  server sends the allowed moves with each request. Either way the move was forced: with the saw known, his only move
  still crosses.

## The audit: every power that limits moves, every path that picks a move

Every pair was right on main. `packages/chess/test/boss-power-legal.test.ts` pins them (they pass on main too); the
tests that fail on main are the new last check, the log and the screens' words (below).

**Powers that stop the boss's own moves** (`bossStops`): Boingo's pie, Big Boy's toy block, Sawyer's first move (a
pawn's), his saw cuts and his board saw. **Each × each path, right:**

| Path | Where | Why it's right |
| --- | --- | --- |
| Stockfish at his strength | `bossMoveFrom` | its top 8 filtered to the allowed moves; a limited-strength move off the list becomes a slip from them |
| Stockfish's slip, the King's strike | `bossMoveFrom` | picked from the filtered top moves |
| The engine's best (Wrangler's reply after his duel) | `bestReplyFrom` | its line only if allowed, else the best scored allowed move |
| Maia, no guard / light / full / strict | `HumanUciEngine` (`searchmoves`), `humanBrainMove` | asked for the allowed moves only, and its answer filtered again |
| Maia not loaded, failed, too slow; every candidate vetoed; none of its moves allowed; the bridge band's share | `bossMoveFrom` | Stockfish's move from the filtered top moves |
| Online: the host's device | `hostBoss` (net.ts) | the server sends `allowed` with the request; the same `bossMoveFrom` |
| Online: nobody answers | `bossTimeout` (lobby.ts) | a random move from `bossAllowed` |
| The mate test switch | `playBoss` | from `bossAllowed` |
| What's played | `applyBossMove` (solo and the server) | anything not allowed was already replaced by the first allowed move (silently, until now) |

**The boss's special moves:** Boingo's funhouse move for the crowd (from `crowdAllowed`, checked again in
`applyFunhouse`), Wrangler's long pull (his own move rule; nothing stops Wrangler's moves), Hollow's extra move (nothing
stops Hollow's), Big Boy's bounce (not a move). **Powers that limit the crowd only:** Ginger's freeze and blizzard,
Wrangler's duels, the Last Stand's barred move; with the saws, pies and blocks, the crowd's every path keeps to
`crowdAllowed` (the screens offer only those moves, solo's `score` and the runner's `withoutBarred` refuse the rest,
bots and the judge pick from them, hints and Engine move search them). **No move limits:** Wrangler's ropes (his drag
moves your piece), Hollow's dark (an attempt into it goes unchecked and costs a try), Jefferson's fire, the Hidden Boss.

## What changed

- **A move of yours a power refuses says why**, in the dock in place of "Your move.", for 3 s (`REFUSED_MS`) or until
  the position changes (the board's new `onRefused`: a tap or a drop that chess allows but the turn doesn't; words in
  `packages/app/src/refused.ts`):
  - the board saw: "The board saw blocks that move."
  - a saw cut: "The saw cut blocks that move."
  - a pie: "A pie blocks that square."
  - a toy block: "A toy block is in the way."
  - a frozen piece (Ginger's freeze or blizzard): "That piece is frozen."
  - the move the God King took back: "The God King took that move back."
  - anything else (Wrangler's duels, whose dock line already says what to do): "That move isn't allowed this turn."
- **The boss's only move through a power says so** through your turn after it, in the dock in place of "Your move."
  (as Wrangler's duel line is): "His only move: across the saw." (the saw cut, the pie, the toy block: "His only move:
  across the cut.", "His only move: onto the pie.", "His only move: past the block."). The runner
  marks it (`lastMove.through`) when the move played is one his own power stops, which only happens when it stopped
  every move he had.
- **Which power stops a move:** `BossRules.stopReason` (Sawyer, Boingo, Big Boy), through `stopReason` in
  `boss-powers.ts`. It reads only fields the screens' view carries too, so the app asks the same code.
- **The last checks:** `bossMoveFrom` checks its own pick, whichever path made it: a move not allowed (or not legal,
  when nothing limits him: an engine's answer for another position, a Maia move not legal here) is logged and his best
  allowed move played (`bestReplyFrom`). On main such a move went on to `applyBossMove`, which played the first allowed
  move in silence. `applyBossMove` now logs what it replaces.
- **The FAQ** ("How powers work") says the boss is lifted too and that a refused move's reason shows.

## Calls

- **The lift stays.** It's ground rule 2, and Eric confirmed its like for Squads' blocks ("no blocks while putting
  enemy in check", Oct 12). Holding it for the boss would make the saw mate him. Eric's call if he wants it.
- **No Stockfish takeover while a move-limiting power is up.** Eric approved it as a fallback if Maia were hard to keep
  within the limits. It isn't needed: Maia is asked for the allowed moves only, its answer is filtered again, and both
  last checks stand behind it. Every path is tested. Taking Maia off would change how the boss plays for nothing.
- **The words name the power, in the dock's status line** (where Hollow's dark-try note is: the pattern already there
  for a refused attempt). No flash on the board: less code, nothing to watch frame by frame, and the saw is already
  drawn. Three seconds, like Squads' block lines (2.6 s), rounded up for reading. The lift's note stays the whole
  turn (it explains the position on the board), unless the God King's strike lands in it (below).
- **Each is the dock's whole line, not a note after "Your move."** At 320 px the dock's text has 112 px; beside "Your
  move." every line was cut by its two-line clamp (measured). Alone, each is whole at 320, 360 and 390 px, in normal
  weight (in bold "The God King took that move back." took a third line). The lift's words are short for that ("His
  only move: across the saw." rather than naming the board saw). "Your move." is back once the refusal's 3 s are up;
  through a lifted turn the running clock says it's your move, as on the duel's turn.
- **The server's last check plays the first allowed move,** as before, and logs it. The server has no engine; the best
  allowed move comes from `bossMoveFrom` on the device that picks. Only a host that's out of date or tampered with
  reaches it.
- **The history view's gap is listed, not fixed.** Drawing a past move's powers needs each turn's powers kept with the
  board's history (only the current ones are known now), across every boss's layer. That's a change of its own.
  Proposal: keep a small record per crowd turn (the cut, the saw, pies, blocks, ice) beside the board's bases, and draw
  it while browsing.

## After the review (Oct 17)

The independent review found the cause sound and no blockers. Its smaller points, and what each became:

- **"Boss staggered." wins over the lift's note.** The note replaced "Your move." and so hid "Boss staggered." on a
  turn with both. There's no room for both at 320 px (the note alone fills the dock's two lines), so one shows: the lift's
  note until the God King's strike lands, then "Your move. Boss staggered." (`!staggerNext` on the note in Play.tsx).
  Simplest, and nothing is lost: a strike is called only during your turn (solo's and the lobby's `callStrike` take it
  only in the crowd's play phase), so the note has been on screen since the turn began, and the stagger is the newer news.
- **The last check's own fallback can't fail.** `bossMoveFrom` asks the same engine for his best allowed move after a
  wrong pick; if that throws, or names a move outside them, the first allowed move is played (the same as
  `applyBossMove`). Tested with an engine that throws, and one that scores a move it wasn't asked about.
- **The admins' debug line says when the last check replaced the pick.** It credited Maia (her note came before the
  check). Now a second note follows: "Maia 600 · no guard · pick replaced (not allowed)" (`why: "replaced"`). The sims
  count that move as Stockfish's, which it is.
- **One argument order for `stopReason`:** `(boss, fen, move)` for `BossRules.stopReason` too, as the dispatcher's
  `stopReason` and `crowdMayPlay` have it.
- **The FAQ names every power the lift covers:** "when Sawyer's saw or cut, a pie or a toy block stops every move he has".
- **The board looks for a refused move only when its screen listens** (`onRefused` set: boss battles).
- **Tests:** a deterministic e2e of the lift ("Sawyer's board saw lifted for his only move", `e2e/sawyer.spec.ts`):
  Eric's position (the move before his Nf6+) set on the solo runner through `window.match` (`?debug`, an existing
  test switch: no new one), as the unit test sets it; the crowd Black, the same position with the colors swapped.
  Qxb7 refused with its words; Nf6+ by taps; his Qxf6; then every frame of your turn shows "His only move: across the
  saw." alone and whole, at 320 px on the phone. Until now the Maia test met the lift only if a random reply did.
  The rage test's stand-in engine names a legal move, so Wrangler's reply after his duel is played as on main and
  nothing is logged; the lobby test restores its spies after each test.

## Follow-ups

- **Your own lifted move isn't said.** A power lifts for you too when it stops every move you have (say, your only
  way out of check), and nothing on screen says so: a move across the saw simply goes. Proposal: the same words for
  your side in the dock as your move lands ("Your only move: across the saw."), from the crowd move's `through` the
  way `applyBossMove` marks his. Not built in this PR.
- **The history view's gap** (above): a past move's powers aren't drawn.
