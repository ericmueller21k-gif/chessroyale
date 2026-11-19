# Several bosses in the match runner (Nov 18, 2026)

Battle Tower PR 6 (the design: [2026-11-18-battle-tower-design.md](2026-11-18-battle-tower-design.md), section 2; brief: "a one-boss
battle doesn't change at all"). The match can hold 2 or 3 bosses on one side (`settings.bossIds`, a runner option until the tower's
rules deal them, PR 8); no screens yet (PR 10). Calls made:

- **The shape.** `state.boss` stays one `BossState`: on a side of several it is the boss *in focus*, in full, with the battle's
  shared fields (the crowd's moves, the God King, the result). `state.bosses` holds each boss's own part (`BossOwn`: id, strength,
  tier, form, powers) in the order dealt; `state.focus` and `state.moved` (who made the side's last move) say who is who. Why:
  every boss's own code (22 files, the Battle bridge) reads `state.boss`, so it runs as it does alone; the boss files gain only
  three small hooks (Wrangler's and Folio's `outOfTurn`, Sawyer's `ownStops`). One boss: `bosses` is unset and every path is today's (the dispatcher's `side*` functions call the
  one-boss ones for a side of one).
- **The focus.** The bosses to move: the boss whose move comes out of turn (`BossRules.outOfTurn`), else the boss after the one who
  moved. The crowd to move: the boss to move next (his turn change: his crowd-turn moments, the funhouse, Dodge, the Scramble
  Rush, are read from him), or Hollow himself while his second move is due. Reading another boss's state (Hollow's dark, Dash's
  clock and stall, the race) puts him in focus for that synchronous call only (`asBoss`), never across an engine's wait.
- **One ultimate a turn change, at the boss's own turn change.** The design: "when two bosses' ultimates fall due together, the
  second waits a turn". Built: each boss's ultimate step runs only at his own turn change, the one after his own move for an
  ultimate his move prepares (`triggerAtHisTurn`: Wrangler's line-up, Folio's crease), the one before it for every other (those
  that come at the start of his turn, `ultimateOnHisTurn`, and those that act on the crowd's turn); when both fall on one turn
  change, the prepared one comes and the other waits, its warning and the test trigger kept (`prepareTurn`'s `hold`). Why: each
  ultimate keeps the timing its own code keys on; a first try (every ultimate before its boss's own move) left Wrangler's line-up
  made after his move but its showdown held, and he moved twice with no showdown (`several-bosses.test.ts` now checks it). The
  wait can be up to a round of the side's turns, not one turn (the tower's sim, PR 14, sees it through `rageScale`).
- **One cinematic at a time** follows: Lights out, the Full Moon's cinematic, Dodge and the Scramble Rush each play within the turn
  change their ultimate came at, so one ultimate a turn change is one show at a time; the race and the Full Moon's stretch are
  effects over turns, not shows.
- **The merged layer.** The crowd: every boss's marks in one layer, then each boss's `crowdFilter`, one lift, then the barred move
  (`sideCrowdAllowed`). The bosses: every mark that binds the bosses, every boss's `bossStops` (the side's guards: Smudgy's
  disguise, the hoops), but Sawyer's first move binds only his own (`ownStops`).
- **The design's LIMITED rules:** Wrangler's reply to the duel comes out of turn (`outOfTurn`: the duel just played), the order
  going on after him; Hollow's second move keeps his focus, the order going on after it; the race brain looks at every boss's move
  (`bossRace` over the side); Smudgy's disguise binds every boss (his `bossStops`); Folio's Revision crosses out only its own move
  (its own check already asks that its last move be the side's last, two plies back) and its move again comes out of turn.
- **The rest of the side:** the judge (`side*` must-score, offers, ranking, evaluation), fair play's power turn, the Last Stand's
  board-altered test, `afterCrowdMove` and `scoreRound` for every boss, every boss's meter reading the judged eval, a time loss never
  with Dash on the side. The God King's strike staggers the boss to move (shared) and its rage goes to the boss in focus.
- **`rageScale`:** each meter at `BATTLE_TOWER.rageScale[n - 1]` of its speed (1, 0.75, 0.6; first guesses), the bar too
  (`sideRates`).
- **The moments queue:** the view's `events` are every boss's this turn change, the one in focus first, so the screens' queue and
  the server's and solo's waits (`powerFxMs`) take them all. Per-boss bar data waits for the screens (PR 10).

**Found by the kit over pairs (reported, not fixed; `PAIR_BREAKS` in `boss-kit-side.test.ts`, each still asserted to break).** Every
pair once (CI's seed) and, by hand, three seeds each (456 battles), plus 12 threes: two pairs break.
- **Smudgy with Alfil** (seeds 1, 2, 3): his Repaint paints one of his pawns the crowd's color while Alfil's Mammoth Slam holds the
  crowd's pawns in the air; they land, and the crowd has 9 pawns (a position Stockfish refuses). Proposed: **Smudgy | Repaint | IN,
  WITH A RULE: never while another boss's power holds pieces off the board (Alfil's Slam): it waits, its warning kept** (or the
  pair joins `apart`).
- **Alfil with Jefferson** (seed 2): the Slam lifted the crowd's c1 bishop in front of a boss pawn on c2, which queens on the side's
  next move (the kit's "no instant promotion from a power"). Alfil's Slam has no such guard; Jefferson's fire made the position
  likely. Proposed: **Alfil | Mammoth Slam | IN, WITH A RULE: never lifts a crowd piece that stands in a boss pawn's way to
  promoting** (a guard that may belong to Alfil alone too).

**Harness notes (not the side's):** the parity harness's solo copy has no clock, so Timber's scraps differ from online without his
ultimate's switch (true with one boss too; he goes first, with it); and a moment after the move cap's last crowd move is read by the
solo trace but never sent online (the side parity's cap is 16).

## The review's fixes (Nov 19)

The independent review of PR #808 (findings 1-4 and a note), fixed at their causes:
- **A hook's turn is his own.** After the crowd's move every boss's `afterCrowdMove` runs, and a hook keyed on "the bosses are to
  move" (`Battle.bossToMove`) now means "*this* boss is to move" (`Battle.hisTurn`: the boss to move next, worked out by `focusNow`
  before any hook runs). One boss: always him, so nothing changes. Per boss (the design: these run as alone, on his own turn):
  - **Ginger's Super Freeze:** at the start of his own turn; a full meter waits through the others' turns (his blizzard check is his own).
  - **Babur's balloons:** a new balloon goes on his nozzle as his own turn begins; it ripens on the clock through the others' turns and
    lands at the end of his turn once ready.
  - **Chandy's queen shot:** at the start of his own next turn after the aim ("his next turn"); the aim follows the queen through every
    move, so the crowd has the round of moves before it (each boss keeps his own turns), and a queen another boss takes ends the aim.
  - Moo's Full Moon and Don Dough's Gold Plate come at the start of their own turns (finding 4), and Smudgy's forced move is worked out
    only at his own turn (finding 1).
- **Smudgy's forced moves bind only him** (`BossRules.sideStops`, replacing `ownStops`: the part of a boss's stops that binds the side;
  his disguise does, his forced moves and Sawyer's first move don't).
- **Every move reaches every boss's trackers.** The crowd's moves reach every boss's `afterCrowdMove`, his own his `afterBossMove`, and
  now another boss's move (and his extra move, and the leapfrog hop, a pawn's from one square to another) every other boss's
  `followMove`, after the mover's own after-move effects (the board the crowd will face): Smudgy's hidden rook, Sawyer's halves, Alfil's
  Tusks pawns and elephants, Don Dough's gold, Chandy's locks and aim, Boingo's splats. One boss: never called, so his paths are as before.
  - **A power that moves the side's pieces outside a move** (the new invariant 8 found it: Wrangler's showdown line-up moved a gold
    piece, an elephant, the hidden rook): after every boss's turn and every crowd move each boss lets go of a piece of the side he
    tracks that no longer stands where he tracks it (`followBoard`), as a capture lets it go: the gold, a half, an elephant, a Tusks
    pawn (the fusion fails), the hidden rook (its disguise gone, with no moment where it stood). Why not follow each piece: those powers
    (the line-up, Wrangler's pull, Smudgy's swap and Repaint, Alfil's fusion, Revision) are bases, not moves, with no from and to to
    follow; letting go is one rule, the same as a capture, and never leaves a stale mark.
  - **Smudgy's rook:** another boss may step it as a pawn would (the shared disguise already allowed it), and the unmask checks (a move
    that isn't a pawn's, a discovered check, the crowd left no move on both boards) run on any boss's move. Why not "another boss may
    not move it": a discovered check or a stuck crowd can come from any boss's move anyway, so the checks must run on every move;
    forbidding it would add a rule and still need them.
  - **Marks on the crowd's pieces, checked:** a capture by another boss now reaches Chandy's locks and aim and Boingo's splats. A board
    change by another boss's power (Alfil's Slam lifting a locked piece, Jefferson's fire burning one, Big Boy's bounce) is not a
    move: Chandy's locks drop at the next move (`locksAfter` keeps a lock only where a piece stands); Ginger's freeze, Folio's fold
    and Moo's stun hold only the crowd's pieces (a mark on a square left empty binds nothing) and wear off. Left as they are.
- **Folio's Revision first.** After the crowd's move the hooks run from the boss who made the side's last move, then in turn order; each
  boss takes the judge's numbers (`judged`) as his own hook runs. A reply Revision crosses out reaches no other boss's hook or numbers.
- **Hollow's second move:** the ultimate step at a turn change goes to the next boss in the order (`moved + 1`), not the focus. Also
  found: solo's extra move (`playExtraMove`) never moved the focus on (only the host's `applyExtraMove` did); both now end in
  `extraMoveOver` (the focus, the others' `followMove`).
- **Found, not fixed (a timing call, for the director):** Alfil's Slam lands only after his own move or fusion (`landDue`): on a side its
  pieces stay up until his next turn, up to a round of the side's turns past `slamTurns`. It touches the Smudgy + Alfil break above
  (Eric's call pending), so it waits for that call.
- **The checks:** the kit's invariants 8 (every piece of the side a boss tracks stands on a square holding a piece of the side) and 9
  (no boss is held to another's own forced move); `several-bosses.test.ts`: Sawyer's first move checked for what it binds, one ultimate
  a turn change checked per step and per boss (with Moo and Don Dough), Hollow's second move, Smudgy's forced moves and hidden rook,
  Revision with three partners. Each failed before its fix.
