# Folio in the rules: Draft, Crease and Revision (Oct 27, 2026)

A new boss, one of the game's final bosses: **Folio** (id `folio`), a paper crane folded from a page of handwriting. Eric
(Oct 26) asked the director for a boss of its own ("I'm going to let you decide how it looks, what moves it plays … it's
yours") and approved its powers ("That actually sounds like a sick boss now"). Calm, honest, a little unsettling: it tells
you the truth, but it never takes anything back for you. Its pronoun is "it" everywhere. **Eric's rule for it: no power
that forgives the players' blunders** (the God King already saves them once; he struck an earlier "Honest Warning" power
for that reason).

This lane builds its rules, the server side, solo, the raid sim, the tests and the FAQ block. Its art (all 11 animations,
its home) is on `claude/boss-art`; the wiring (kit, sprite, the ink, the fold, the crease, the crossing out) is the next
lane's. Until then it stays **not playable** (`kit: null`): the test links `?boss=folio&wip=1`, `&power=draft`,
`&power=crease`, `&power=revision`. How it works now: [bosses.md](../areas/bosses.md) (its row); the tuning:
[reports/folio-sim.md](../../reports/folio-sim.md).

## What was decided before this lane (the director's sheet)

(As the sheet had it. After the first sim the director changed four things: the Crease stops the crowd's pieces only, in
a band of 1 to 2.5 pawns; the Draft marks the most valuable piece; a fold lasts 4 turns; offset 0 and `rageSpeed` 1.3. See
"The director's calls" below.)

- **Opening:** the game so far.
- **Draft (passive):** every `draftEvery` crowd turns from turn 3, at the end of its move, an ink mark under one crowd piece
  one of its pieces attacks (the attack's line shows faintly): one that matters and isn't simply hanging (defended, a
  seeded pick of the top three by value). The crowd has `draftWindow` (2) of its own moves to end that one attack; if the
  same piece still attacks it on its square after the second, the piece is folded for `foldTurns` (3) crowd turns, by
  Ginger's freeze's rules. The mark clears as soon as the attack ends. None qualifies: no Draft, tried again next move,
  the try not counted. One mark at a time; a fold doesn't block the next mark. Moments `draft` and `fold`.
- **Crease (ultimate, the rage meter's):** the line shown on the warning's turn; at the start of the crowd's next turn the
  board is creased along one of the 14 inner lines for `creaseTurns` (4) crowd turns, no piece of either side crossing
  it, on Sawyer's board saw's rules. The engine picks the line on the warning's turn (on the host), costing the crowd
  between `creaseLossMin` (0.3) and `creaseLossMax` (1.5) pawns with the crowd to move, nearest the middle, seeded among
  ties; never a line leaving either side no move or handing either a mate in one; none in the band, the nearest the
  bottom, never one helping Folio by more than the top. Moments `crease-warn`, `crease`, `crease-end`.
- **Revision (once a battle):** right after a crowd move that punishes its last move (that move cost it `revisionDrop`
  (1.5) pawns or more against its best, and the crowd's reply leaves its judged evaluation `revisionDrop` worse than before
  it), both moves are crossed out, the position goes back, it plays the engine's best (as `bestReply`; the King's strike
  still staggers it), and the crowd moves again. Never after a battle-ending move, more than `revisionMax` (1) a battle, or
  in the first 4 crowd turns. Fair play skips the crossed-out turn; the players keep what their picks earned. Moment
  `revision`.
- **Its words** (banners DRAFT, FOLDED, CREASE!, REVISION; seven lines, as written).

## The calls made here, and why

1. **`kit: null` until the wiring lane**, not `kit: "Folio"`: a boss is playable as soon as it has a kit and powers
   (`isPlayable`), and the sheet says not playable until its kit is wired. The wiring lane sets `kit: "Folio"` (the
   roster's comment says so). The test links carry `wip=1`, as the circus tiger's did before his.
2. **Moment names:** `draft`, `fold`, `crease`, `revision` as the sheet says; `crease-warn` and `crease-end` are
   **`creaseWarn` and `creaseEnd`**, one camelCase word as every other kind (`hoopsOut`, `fullMoon`), since a kind is also
   a key in the screens' tables.
3. **The Draft's pick:** "defended (so Folio wouldn't just take it)" read as its reason says: the piece is defended **and
   no cheaper piece of Folio's attacks it** (a pawn attacking a defended knight would just take it). The attacker shown is
   the cheapest Folio piece attacking it, ties by square, a king last (it can't take a defended piece). The line's squares
   are those between them for a bishop, rook or queen; none for a knight, pawn or king, or side by side. Pawns can be marked,
   but only when no piece qualifies. **Never the piece folded now** (it couldn't answer by moving, so it would fold again
   and again). Of those, **the most valuable** (the director's call, below; it was the sheet's seeded pick of the top three),
   seeded only among ties of value (`powerRoll(seed, "draft", turn)`).
4. **The window counts crowd turns:** a mark set as crowd turn T begins (`until` T + 1) must be answered by the end of the
   crowd's move on turn T + 1; after that move, if the attack still stands, the piece is folded for turns T + 2 to T + 5 (`foldTurns` 4).
   The checks run after every move (the crowd's: answered or folded; Folio's: its attacker moved away, or it took the piece)
   and, last, as each turn begins. "Answered in time" counts a mark cleared after a crowd move; one Folio cleared by moving
   its own piece doesn't count as answered.
5. **One moment at a time:** the Draft waits a turn (not counted) when its turn begins with the Crease's warning, landing
   or unfolding. A fold plays at the start of Folio's turn, while it thinks (its move waits for it, as Moo's Full Moon:
   `folioTurnMs`), so it never shares a turn's start with a mark or the crease; Revision likewise, and a crowd move that
   brings Revision brings nothing else (no fold on a crossed-out move). The warning's turn has two events, the RAGE
   warning (`warn`, as every boss's) and `creaseWarn` (its line): `creaseWarn` holds no time of its own (`FOLIO_FX` 0) and
   its line is said once, with the warning (the wiring lane's note).
6. **The crease's line** is written as its two neighbors: `"d|e"` (between the d and e files), `"4|5"` (between ranks 4 and
   5). **A move crosses it when a piece it moves ends on the other side** (any move, knights included: the board saw's rule).
   Where the saw's rule and a crease's could differ: castling. The saw only ever sat between d and e, which no castling rook
   crosses; on a crease near a corner the rook can cross alone (h1 to f1 over "g|h"), so **the crowd's castling is refused
   when its king or its rook would cross** ("no piece may move across it"). Everything else is the saw's: attacks, checks
   and pins work across it; the dispatcher lifts it for a turn it would leave the crowd no move (or no way out of check).
   **Since the director's call (below), it stops the crowd's pieces only** (`Crease.side`): Folio's moves are never
   stopped (no `bossStops`), so the saw's "his only move across it" can't come (its `THROUGH` words, required by the table,
   are never said); a refused move of yours says "The crease stops your pieces."
7. **When the engine picks the line:** with Folio's move whose next crowd turn would bring the warning: the meter full by
   then (worked out as `prepareTurn` will: this crowd move's rage and its material lost so far; a promotion of its own can
   only lower that, so a warning never comes without its line), the test switch, or the admins' trigger (`creaseDue`,
   `creaseAsk`). The host picks it on the position after Folio's move, the crowd to move (the sheet's "judged with the crowd
   to move"), and sends it with the move (`bossMove.crease`); the server checks it (`creaseCheck`: a real line the guard
   allows). Junk, none (no engine, nothing allowed, or an older app): no warning that turn, the meter waits full, and its
   next move asks again. Solo and the sims pick it the same way on their own engines (`creasePick`).
8. **The line's cost:** the crowd's best move with the crease against its best without (the same position, searchmoves at
   `creaseNodes`), in pawns of log-odds (`bouncePawnLogit`, as every engine-shaped band). Lines that take away the same moves
   share one search, and a line no move of the crowd crosses costs nothing without one: at most 15 searches. The engine sees
   the crease at its root only (as Babur's walls). **The guard** (`creaseGuard`, as the review fixed it): the crowd keeps a
   move, the line never takes away the crowd's mate in one (one of its mating moves stays open), and never hands Folio one
   (when the crowd has a move after which Folio can't mate at once, one of those stays open); checked on the warning's
   position and again as it falls. **The pick** (`pickCrease`): in the band,
   nearest its middle (1.75 since the director's band); none, the one nearest `creaseLossMin` from below;
   never one over `creaseLossMax` (none at all: no warning yet). Ties (lines taking away the same moves cost exactly the
   same) by the server's roll, sent as the ask's `order` (the battle's seed never leaves the server).
9. **The trigger** (`triggerAtHisTurn`, as Wrangler's): kept until a line comes with Folio's move; then the crease lands as
   the next turn begins, without the warning. It holds `creaseTurns` turns; the meter stays empty meanwhile
   (`ultimateRunning`), then fills from empty; `creaseEnd` as the turn after its last begins.
10. **Revision's numbers are the judge's own**, which the runner now hands every boss's `afterCrowdMove` (`judged`: the
    round's best score, the played move's, and whether the God King played it). Folio's evaluation before its move is the
    crowd's judged score after the crowd's move before it (`last.before`: that score is the position after Folio's best
    reply); after its move, the crowd's best score in the next round; after the crowd's reply, that move's score. Its move's
    **cost** is the best against before; the **drop** the reply against before; both at least `revisionDrop`
    (`revisionMeasure`). With these numbers the drop can never exceed the cost (the reply can't beat the best), so the
    second condition implies the first; both are still checked, as the sheet says.
11. **Revision's guards:** from crowd turn 5; once a battle; never after a move that ends the battle (mate, a draw on the
    board, the move cap); its last move must be the one just before the crowd's reply. **My calls: never after the God
    King's move** (his help is the crowd's own, paid with a charge: it's never crossed out) **and never on a move his strike
    staggered** (the crowd's strike is never undone). Revision only ever rewrites Folio's own mistake: it can't take back
    anything that helped the crowd except the punishment itself, which is what the sheet asks.
12. **The rewind is a base, not a deleted move.** The board goes back to the exact position before Folio's move (its
    counters too), as a base at the current ply: the history keeps both moves (the record shows them, the screens cross them
    out), and everything that replays a board does so from the base (`fenAtPly`; "A move only legal after a burn"). Its
    last move is the move before them; the board's evaluation and the judged score are put back to before Folio's move.
    **What's reused from the God King's take-back (the Last Stand):** the record of what was taken back (the Last Stand's
    `lastStand` with its move and position; here `revision` with both moves, their names and the position), the crowd's
    fresh clock (its next turn is an ordinary turn), and the scores standing. **What's new:** the Last Stand never plays its
    move, so it only counts the crowd's move back; Revision's two moves were played, so the board needs a base, and the
    crowd's turn stays counted (below). Nothing is barred: the crowd may play the same move again from the new position.
13. **The crossed-out crowd turn stays counted** (`crowdMoves` goes on: the meter's tick, the strike's count, the move
    cap). The Last Stand counts its move back because nothing was played; going back here would leave that turn set up for
    the crossed-out position (its mark, its warning) and never set up for the new one, since a turn is set up once. **Its
    picks keep their points** (the sheet's "the simplest fair thing": scoring is untouched). **Folio's own counts of the
    crowd's moves don't count it:** the mark's window, a fold and the crease each last one turn more, so the crowd gets
    every one of its own moves; a mark whose attack the rewind ends goes. The crease warned of stays warned (it lands as
    the next turn begins, as promised).
14. **Fair play skips the crossed-out turn:** the round is judged before Revision is known, so the runner asks the boss
    after the move (`BossRules.crossedOut`) and marks that round `power` in its report, which the lobby's fair-play notes
    read. A turn with a folded piece or the crease is a power turn too (`powerTurn`); a mark alone limits nothing and isn't.
15. **Revision's moment and its move:** `revision` plays at the start of its turn, while it thinks; the server holds its
    move until the moment is over (`folioTurnMs`, as Moo's Full Moon), and asks it as `best` (no brain): the engine's best at
    full strength, never Maia, a slip or a stumble; the King's strike still staggers it. The view's `revision.move` names
    the move once played. QUEEN SLAIN! never plays for a capture Revision crossed out (`queenSlain` checks it).
16. **The test switches:** `?power=draft` brings the Draft from turn 2, again every turn once a mark is gone;
    `?power=crease` warns as the second turn begins; `?power=revision` (a third power id, not on the roster's line) brings
    Revision at the first crowd move it may follow, whatever the numbers (its other guards kept).
17. **Its lines** (`characters/folio-lines.ts`, `FOLIO_LINES`, by the kit's beats: `entrance`, `power` (the mark), `fold`,
    `ultimateWarn`, `revision`, `victory`, `defeat`; two beats added to `Beat`, `fold` and `revision`) and its select line
    (`SELECT_LINES.folio`, its intro line). Nothing more than the sheet's seven.

## The director's calls (Oct 27, after the first sim)

The first sim put Folio at 0.40 to 0.58 for the crowd, the easiest boss in the pack, and it's meant to be a final boss. The
director (not this lane) changed four things; the rules above are written as they now stand:

1. **The Crease bites the crowd only.** Folio folds the board toward itself: the crowd's pieces may not cross the crease;
   Folio's may. Everything else of the saw's stays for the crowd: the refused-move words, the only-move exception, never
   leaving the crowd without a legal move or a way out of check. **Its band is 1 to 2.5 pawns** (`creaseLossMin`,
   `creaseLossMax`; was 0.3 to 1.5), judged with the crowd to move, as other ultimates cost about 2; the fallback stays the
   line nearest below the band.
2. **The Draft marks the piece that matters most:** the most valuable qualifying piece, seeded only among ties (was a seeded
   pick of the top three; `draftTop` is gone). **`foldTurns` 4** (was 3).
3. **Offset 0** (was −250): Folio plays at the usual strength.
4. **`rageSpeed` 1.3** (was 1).

Then one run of 60 battles at this setting (a standard error of about 0.06); above 0.30, one more at offset +150; ship the
nearer the aim; if neither is under 0.30, stop and report.

## The review's fixes (Oct 27)

1. **A folded rook can't castle** (castling is its move too): the fold's filter and the dock's words use Moo's
   `stunnedIn`, so `e1g1` with the h1 rook folded is refused with "That piece is folded." (Ginger's freeze has the same gap;
   the director fixes it in its own PR.)
2. **The FAQ says what the band does:** the line costing you as close to 1 to 2.5 pawns as it can, never more than 2.5.
3. **The crease is checked again as it falls**, on the position it falls on (the crowd to move). A warned line the guard
   now refuses doesn't land: no other line (the crowd was shown this one), its line clears (`creaseEnd`), and the meter is
   spent as if it had come (`ultAt` that turn, one more `ults`; it fills again from empty the turn after). While it holds,
   only the saw's lifts (no move, or no way out of check), as before. The sims judge each crease's cost as it falls.
4. **The guard's mate rules read as their words:** never take away the crowd's mate in one, never hand Folio one (above,
   call 8). The earlier code refused a line that left the crowd's own mate open and passed one that blocked it.
5. **Repetition across a Revision:** the God King's Last Stand never plays the move it takes back (no base), so it has no
   such gap; this one is new to Revision. Its base now says which earlier ply it goes back to (`Base.from`), and
   `gameEndWith` counts the game up to that ply, then from the base (the crossed-out moves' positions don't count). Only
   Revision sets `from`, so no other boss's game changes.
6. **"It" for Folio** in the code too (`afterItsMove`).

## The numbers and why

- **Offset +150, `rageSpeed` 1.3, `draftEvery` 4, `foldTurns` 4, the Crease's band 1 to 2.5** (the director's calls, and the
  one further run they allowed). At the director's offset 0 the crowd scored **0.33** (± 0.05) in 50 moves over 60 battles,
  above 0.30; at +150, **0.28** (± 0.05) in 50 moves over 60 battles, nearer the aim (0.10 to 0.25, just above its top),
  so +150 ships and the sweep stopped there. Folio is the only boss that plays over the usual strength (1750 against the
  1600 tier in the sim): a final boss. [reports/folio-sim.md](../../reports/folio-sim.md) has the tables.
- **What the sim says of its powers** (folioG, shipped): 9.1 marks and 4.5 folds a battle (25% of marks answered in time by
  bots that answer them only by chance, half folded); 2.8 Creases a battle, costing the crowd 0.52 pawns on average and
  rarely in the band (37 of 170: most positions have no line taking 1 pawn off the crowd's best move; the rest take the
  nearest below, none over the top); Revision in 38 of 60 battles, worth about 2 pawns (the punishing reply it took back).
  Half the battles reach the 60-move cap.
- **Before the director's calls**, as the sheet had the rules (the Crease both sides in 0.3 to 1.5, the Draft a pick of the
  top three, folds of 3 turns): 0.40 to 0.58 over five runs of 26 battles (offset −250, 0 and +200; a Draft every 2 turns
  with `rageSpeed` 2 at −250 and +200), none beyond the noise of the others: the easiest boss in the pack.
- `draftEvery` 4 (this lane's number, Sawyer's cuts' pace; every 2 turns changed nothing measurable in the first runs);
  `creaseNodes` 20,000 (Babur's hoops' budget: at most 15 searches a warning), `creaseTimeMs` 6 s more for the host on that
  request; `draftFirst` 3, `revisionFrom` 5, `revisionDrop` 1.5 are the sheet's.

## What the wiring lane needs

- **Its kit** (`kit: "Folio"` on its roster line, `BOSS_KITS`, `FOLIO_LINES` mapped onto its beats) and `components/Folio.tsx`
  (holding each moment's place now, drawing nothing).
- **draft** (as the crowd's turn after its move begins; `square`, the marked piece; `squares`, the attack's line, its
  piece first and the marked piece last): the ink mark under the piece and the line faintly. While it stands, draw it from
  the view's `draft` (`square`, `attacker`, `line`, `until`: the last crowd turn to answer it); gone as soon as the view's
  `draft` is null (answered, or its attacker moved away). Banner DRAFT; "I'll be honest: that piece is next."
- **fold** (at the start of its turn, while it thinks; `square`): the piece folds; then drawn folded while the view's
  `folded` holds its square (`refusedLine` already says "That piece is folded." on a tap). Banner FOLDED; "Folded. It'll keep."
- **creaseWarn** (with `warn`; `line`): the line faintly over the board from the view's `creaseNext` until it lands. The RAGE
  warning is `warn`'s as for every boss; "Mind the crease." said once.
- **crease** (as the next turn begins; `line`): the board folding along the line toward Folio, drawn while the view's
  `crease` holds (`line`, `at`, `until`, `side`: the side it stops, the crowd's; Folio's pieces cross it); banner CREASE!. **creaseEnd** (`line`): it unfolds. The board, the dock and the HUD never move
  (Eric's rule: nothing shifts).
- **revision** (at the start of its turn, while it thinks; `moves`: its move, then the crowd's): both crossed out and the
  pieces back. The board the screens get is already the position before them (a base): draw the position after the
  crowd's move until the moment takes it back. Its new move then plays as its ordinary move (`lastMove`; the view's
  `revision.move` and `san` name it). Banner REVISION; "Let me write that again." The history view shows both moves; the
  wiring lane may strike them through (`revision.moves`, at the plies before the base).
- **Banners and time:** the moments' lengths are `FOLIO_FX` (draft 1.8 s, fold 1.6 s, crease 2.4 s, creaseEnd 0.9 s,
  revision 2.8 s, creaseWarn 0); the wiring lane adds its banners to `POWER_BANNERS`, which lengthens them by the banner's
  lead (`bannerWaitMs`), on the server too.
- **Power words** (`power-words.ts`): "marks a piece to fold · Crease".

## Test checks changed

None removed or loosened; none guards a rule of Eric's (`docs/rules/eric.md`). Added: three `stopReason` checks in
`boss-power-legal.test.ts` (Folio's Crease stops only the side it's set against; its row in the powers that stop the
boss's moves, added earlier in this PR, went with the director's call: the crease never stops Folio); the parity test's host answers the Crease's ask (as the
app's host does); `boss-smoke.spec.ts`'s `PASSIVE_EVENTS` has `draft`; Folio in `king-save-altered.test.ts`'s `AUDIT` (a
fold and the crease sit the Last Stand out) with a check that its mark doesn't. Changed: `pig.test.ts`'s "only Wrangler's
and Moo's rules ask for `bestReply`" now names Folio's too (its Revision), the list it excludes one longer.
