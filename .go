chandy redo: round 2 (Eric's answers, Nov 15). Another mockup round, then wait for .go again (it will contain "chandy" and "build").

ERIC'S ANSWERS
- Q6 upgrades: ONLY capturing a locked piece upgrades the rifle. But the goal is "he gets fully upgraded pretty much every game", so the
  lock is built to make that happen:
  * The first lock teaches it: he locks a piece right before he captures it (a piece he can take this move), then takes it: the first
    upgrade, and the player learns what the crosshair means.
  * After that he locks at the end of his turn and hunts it for a few turns. Locks pick VERY capturable pieces.
  * Not taken within about 3 of his turns (you got it to safety): he switches to another, more gettable piece.
  * Up to 2 locks at once, staggered (each lives about 5 turns; e.g. one locked, you move it away, a few turns later he locks a second).
  Design the numbers so the sim shows 5 upgrades in nearly every battle, and say how strongly the engine is steered for that.
- Q1 (never the queen): yes.
- Q11 which move: random among the unlocked, EXCEPT a newly unlocked move is always used the next time the meter fills.
- Q18 beam: covered squares are walls (Big Boy's rule).
- Q8 upgrade pause: 2 s, everything paused.
- QUEEN LOCK (Q28-Q33): Eric wants "at worst you lose your queen, and only if you don't act". Before he uses it, he checks you have a
  way to save her: a move that gets her behind a pawn, knight or bishop, or a move that puts one of those in front of her (Eric:
  "you're going to lose a piece no matter what that turn, but the goal is you hopefully just lose a pawn"). He fires from the top down
  by default; Eric suggested firing from the left or right as well so a safe square almost always exists. Eric: "I'll let you
  brainstorm." Recommend ONE simple rule (who picks the direction, when it's shown, whether you may block instead of moving her) and
  check it is fair for the boss.
- The rifle: make it his full length on his back, as Eric first asked (it's about two-thirds now).

THE RED-GREEN LOOK (Eric loved it): chandy-idle.gif came out with scrambled GIF colors (hot pink/red body, neon green, purple outline):
an encoding accident. Eric: "that cool picture of him in all those colors... I like that". Fix the idle GIF's real colors, AND keep
that scrambled palette as a deliberate look: his afterimage clones in the ult below. Save it as a named palette in the sprite kit.

HIS ULTIMATE (Eric, Nov 15): a minigame, "Dodge".
- When his rage meter is full (it unlocks after 5 upgrades), the game pauses where it is. The view moves seamlessly so your KING sits in
  the center with the 8 squares around him (9 squares: he can stay or step once).
- Chandy copies himself rapidly round the board (the red-green afterimage clones) and aims beams along rows, columns and diagonals so
  that of the 9 squares exactly ONE is safe. You have 3 seconds to put the king there; the placement locks; all the beams fire.
- 3 rounds. Hit once: you lose the battle. Survive all 3: nothing happens (he gets nothing).
- Eric asked: is it always possible? The director's check: yes. For any safe square S, the two rows not through S cover 6 of the 9
  squares, and the two columns not through S cover the last 2 in S's row, so 2 rows plus 2 columns always leave only S. Diagonals that
  miss S can be added for show. Confirm, and pick a rule that makes the aim readable in 3 s on a phone.
- Questions to answer with recommendations: is it the real board (pieces, edges of the board when the king is on the rim: fewer than 9
  squares) or its own little 3x3 arena; what "seamlessly" looks like; how the 3 s works online (server time, lag) and in a boss raid
  with many players (each player dodges alone? the crowd votes? one hit loses for everyone?); does a beam ever cross the king's own
  square when he stays; Eric first said "only if your queen is alive", then "we'll just make him target your king": confirm the
  queen condition is dropped; how often it can happen (once the meter refills?); and that it fits "Nothing hidden, nothing shifts".

MOCKUP (about 10 images, 2 GIFs): the full-length rifle on his back (stage 0 and 5), the clones in the red-green palette, the Dodge
round on a phone (aim lines shown, the 3 s timer, the king's 9 squares, the safe one not marked), the fire, a hit and a dodge; the
queen lock's chosen rule in 2 stills. Update DESIGN.md: answered questions marked done, the new ones with your recommendations.
Then .mockup with "chandy round 2" and wait for a .go containing "chandy" as before.
