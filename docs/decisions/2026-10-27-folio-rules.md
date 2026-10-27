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
   are those between them for a bishop, rook or queen; none for a knight, pawn or king, or side by side. Pawns can be marked
   but rank by value, so only when fewer than three pieces qualify. **Never the piece folded now** (it couldn't answer by
   moving, so it would fold again and again). Ties by value go by square, then the seeded pick of the top three
   (`powerRoll(seed, "draft", turn)`).
4. **The window counts crowd turns:** a mark set as crowd turn T begins (`until` T + 1) must be answered by the end of the
   crowd's move on turn T + 1; after that move, if the attack still stands, the piece is folded for turns T + 2 to T + 4.
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
   crosses; on a crease near a corner the rook can cross alone (h1 to f1 over "g|h"), so **castling is refused when its
   king or its rook would cross** ("no piece of either side may move across it"). Everything else is the saw's: attacks,
   checks and pins work across it; the dispatcher lifts it for a side it would leave no move (or no way out of check); his
   only move across it is marked (`through`, "Its only move: across the crease."); a refused move of yours says "The crease
   blocks that move."
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
   the crease at its root only (as Babur's walls). **The guard** (`creaseGuard`): the crowd keeps a move, Folio keeps one
   were the crowd to pass (`passTurn`; in check, not asked), and neither side has a mate in one with the crease counted.
   **The pick** (`pickCrease`): in the band, nearest its middle (0.9); none, the one nearest `creaseLossMin` from below;
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

## The numbers and why

- **Offset −250, `rageSpeed` 1, `draftEvery` 4** (the usual offset, the brief's start, Sawyer's cuts' pace): the raid sim's
  first run gave the crowd **0.52** (± 0.09) in **49** moves (26 battles), outside the aim (0.10 to 0.25). Four variants, as
  the testing budget allows when a number lands outside: offset 0 (0.58), +200 (0.48), a Draft every 2 turns with
  `rageSpeed` 2 at −250 (0.52) and at +200 (0.40), each 26 battles, all within about one standard error of one another.
  Nothing measured beat the first, which is also the simplest, so it ships, and the sweep stopped there.
  [reports/folio-sim.md](../../reports/folio-sim.md) has the tables.
- **What the sim says of its powers** (folioA): 9.2 marks and 4.8 folds a battle (27% of marks answered in time by a crowd
  that doesn't know about them, 52% folded); 2.5 Creases a battle costing the crowd 0.42 pawns on average (half of them
  below the band: no line cost 0.3 there); Revision in 18 of 26 battles, worth 2.7 pawns on average (the crowd's punishing
  reply it took back). Folio blunders often at these strengths, and Revision rewrites one; the battles with one went the
  crowd's way more often (0.64 against 0.25), the sign of a boss that blunders again.
- **For the director:** the levers that could move it are the sheet's own numbers (the fold's 3 turns, the 2-move window,
  the crease's band and 4 turns, Revision once), not this lane's to change. Real players who answer the marks would score
  higher still.
- `creaseNodes` 20,000 (Babur's hoops' budget: at most 15 searches a warning), `creaseTimeMs` 6 s more for the host on
  that request (the searches themselves take about a second or two on a phone); `draftTop` 3, `draftFirst` 3,
  `revisionFrom` 5 are the sheet's.

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
- **crease** (as the next turn begins; `line`): the board folding along the line, drawn while the view's `crease` holds
  (`line`, `at`, `until`); banner CREASE!. **creaseEnd** (`line`): it unfolds. The board, the dock and the HUD never move
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

None removed or loosened; none guards a rule of Eric's (`docs/rules/eric.md`). Added: Folio's row in
`boss-power-legal.test.ts`'s powers and two `stopReason` checks; the parity test's host answers the Crease's ask (as the
app's host does); `boss-smoke.spec.ts`'s `PASSIVE_EVENTS` has `draft`.
