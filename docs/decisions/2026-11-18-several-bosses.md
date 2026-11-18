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
