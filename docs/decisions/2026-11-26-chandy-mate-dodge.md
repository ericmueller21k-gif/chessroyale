# Chandy's Dodge when you checkmate him (Nov 26, 2026)

- **Eric**, Nov 26: "he'll only do it if you put him in checkmate. And then instead of the game ending right away, it pauses and he
  jumps onto the center of the board and collapses, and then he reaches his arm out though towards your king, and that's when he zaps
  it or whatever, and he's says something like, I'm not I've got one last trick up my sleeve, but something that's not that line, and
  then it starts. ... if you fail that, you lose, and then if you succeed, then he's checkmated and it goes to the end game screen. ...
  if you do succeed ... something a little extra too right before it ends, just clearly showing that you win." A minute later: "it also
  triggers still from his 5 upgrades tho".
- **The rule** (`bosses/chandy.ts`; once a battle, as before): two ways in.
  1. **His meter**, as it was: 5 upgrades, then full over `dodgeAfterMoves`, the warning, the Dodge as your turn begins; survived, play
     goes on. His bar's meter is unchanged.
  2. **Your mate** (`chandyBattle.mateDodge`, from `afterCrowdMove`): the crowd's move mates him and he hasn't used it. The battle isn't
     decided (`mateHeld` holds `stageComplete`); his opening plays, then the Dodge as ever. Two hits: his (no Last Stand). Survived: the
     win beat, then the crowd's win by mate (the board's result). Used already: a mate is a mate.
  - **Gone:** the last chance (a mate in one as your turn began, `mateOpen`, and Chandy's `ultimateNow`) and #968's danger line for him
    (`inDanger` in his ultimate). #968's call 5, flagged for Eric (his Dodge before 5 upgrades in danger), is settled by his words.
- **The beats** (`dodgeTimeline()`, the characters' job fits its art to them): `opening` (`MATE_STEPS`, each `{ at, end }`, ms before
  the Dodge's own start `at`, negative): `pause` 1.0 s on your mate as it landed, `jump` 1.2 s (he leaps onto the middle and collapses),
  `reach` 0.8 s, `zap` 0.7 s, `line` 2.4 s (`matePauseMs` … `mateLineMs`; `openingMs` 6.1 s); then the scope-in. `win`, 2.2 s
  (`mateWinMs`) from a survived Dodge's last round's end; `dodgeEndAt` includes it. All are in `beats` too. What the screen draws from:
  the view's `powers.chandy.dodge` (`mate: true`) and the run's `at` (`NetDodge.at` online, solo's run): `DodgeView` phases `mate`
  (with its `step`) and `win`; on the page `.cd-root.cd-p-mate.cd-s-<step>` and `.cd-p-win`.
- **Calls made:**
  1. **Its start after the opening** (`dodgeLeadMs`): the server and solo start a mate's Dodge `openingMs` after its message, so every
     time already written from `at` (votes, teleports, `dodgeSeen`, the vote windows) stays as it was. A solo rejoin in the opening goes
     on from the Dodge's own start (its kept time is 0); online the server's `at` carries the opening on.
  2. **A Battle Tower floor of several bosses: a mate is a mate.** The side's king isn't his alone, and one boss's second life shouldn't
     decide a shared floor; it is also the least code (no focus change in the runner). His meter brings it there as before; alone on a
     floor, your mate does. The runner's generic `BossRules.ultimateNow` stays (no boss uses it now): removing it is the director's call.
  3. **Warned by his meter, then mated before it comes:** your mate brings it (its opening, one Dodge).
  4. **No warning before a mate's Dodge:** the opening is its warning.
  5. **Test links:** `&power=dodge` and the admins' trigger keep the meter path, unchanged. The mate path's link is `&boss=chandy&win=1`
     (your first move, Qxf7, mates him).
  6. **Until the art lands** (no new art here): `jump` plays his `stow` pose, `reach` his `point` with his crosshair locking onto your
     king, `zap` his `fire` with rapid fire's hit on your king (`MATE_POSES`, `MateOver` in ChandyDodge.tsx); the dock says
     "Checkmate?" / "Chandy isn't done yet.", then "Checkmate!" / "You beat Chandy.". The win beat reuses the God King's hero banner
     ("CHECKMATE!", "You beat Chandy") over your mate, its last-move squares lit. (The board's check glow is off game-wide,
     `BOARD.checkHighlight`, and the game has no confetti effect: the banner is what shows it's yours.)
  7. **His line** (`CHANDY_MATE_LINES`; Eric picked the first): "Mate? Negative. One shot left in the chamber." Also offered: "Pinned
     isn't finished. Final protocol: engage." and "Down, not out. A sniper always saves one round."
- **Watched** frame by frame with real taps (your Qxf7 tapped, each vote tapped), phone and computer: a frame on every change, the
  steps at 0, 1.0, 2.2, 3.0 and 3.7 s, the scope-in at 6.1 s, the win beat at 34.2 s, the results at 36.4 s; your king never jumps or
  flickers. Stills on branch `stills/chandy-mate-dodge`.
- **Checks:** `chandy.test.ts` ("Dodge from your mate": the mate brings it, nothing else new does, two hits his, survived yours, once a
  battle, its beats; in danger nothing), `several-bosses.test.ts` (a floor of several: a mate is a mate), `chandy-lobby.test.ts` (online:
  its start after the opening, a vote in it refused, decided after the win beat), `chandy-wired.test.ts` (the screen's phases),
  `e2e/chandy.spec.ts` (the mate Dodge played through, solo).
- **Round 2** (the review and the director's stills, Nov 26):
  - **His line whole.** In one piece it takes three rows of a phone's bar at 320 px (20 characters a row) and the bar clamps to two:
    "Mate? Negative. One shot left in the…". Eric's words stay; it's said as a paced line in two sentences ("Mate? Negative." / "One shot
    left in the chamber.", `mateLinePauseMs` 900 between, SPEECH's typing pace), the Hidden Boss's chant's mechanism: a phone's bar
    shows a sentence at a time, each within two rows; a computer's box shows the whole line (three rows, unclamped). Both are typed by
    2.1 s, inside the 2.4 s `line` step. Nothing else moves: the bar's box keeps its place and rules.
  - **No stale warning over your mate.** "Guard the queen!" was the God King's warning from your turn's start (Qh5 attacked by the
    knight on f6), still up as Qxf7# landed. Call: the God King is quiet through the opening (`kingVoice.hush` until the Dodge's own
    start, the Hidden Boss cutscene's hush; lifted if the screen goes early). Simplest: nothing new to write, and his lines resume with the
    Dodge.
