# Battle Tower: mockup stills (PR 7, Nov 19, 2026)

For Eric to approve before PR 10 (the solo tower screens) and PR 13 (the home card) build them. The design:
`docs/decisions/2026-11-18-battle-tower-design.md` (§2 "How several bosses show", §4 the strip, §6 home). Not here: the room (PR 11,
the art runner's still first).

**How they were made:** the real app (built, on a local server), real screens, real CSS, fonts, sprites, portraits, meters and level
tags; a real Boss alone battle against Ginger (his real move and dock line), with the tower's new pieces laid over it by a throwaway
script. Nothing here is app code. Phone 428 × 746 (Eric's), computer 1440 × 900, both at 2× pixels.

| # | Still | What it shows |
| --- | --- | --- |
| 1, 2 | `bar/1-phone-428-light-2-bosses.png`, `bar/2-…-dark-…` | Floor 6 (Ginger + Moo), your move. The bar split in two, Ginger to move lit, Moo dimmed. The strip on top. |
| 3, 4 | `bar/3-phone-428-light-3-bosses-dock.png`, `bar/4-…-dark-…` | Floor 4 (Ginger + Moo + Chandy), right after Ginger's real move: the dock says "[Ginger's face] Ginger plays e5"; the bar lights Moo, who moves next. |
| 5 | `bar/5-computer-1440-2-bosses.png` | The same floor 6 on a computer: the figures stacked beside the board, Ginger (to move) stepped forward. |
| 6 | `bar/6-computer-1440-3-bosses-dock.png` | Floor 4 on a computer: three stacked, Moo stepped forward; the dock line. |
| 7 | `screens/7-phone-428-tower-screen.png` | The tower's own screen, a solo run saved on floor 5 (one boss, Dash): "CONTINUE FLOOR 5". |
| 8 | `screens/8-computer-1440-tower-screen.png` | The same screen on a computer, a run on floor 8 (three bosses on the stage). |
| 9 | `home/9-phone-428-home-row.png` | Home: Other modes with a third card, picture over name, 56 px. |
| 10 | `home/10-computer-1440-home-row.png` | The same on a computer, with "Climb 99 floors". |

## The calls made (each still)

**The bar (1 to 6)**
- Phone: the bar keeps today's box exactly (400 × 99 at 428, measured), split into equal parts with a 4 px gap. In each part the figure,
  then its name, then its level and its meters on one line under it. Every figure in a bar is drawn at **one shared scale** (the
  largest at which each one fits its part whole), so no boss looks bigger than another; they're about 60% of today's size with two or
  three. The boss's own extra meters stay beside the rage meter (Ginger's Super Freeze, Moo's moon, Chandy's dotted move meter).
- **"To move"** = the boss whose turn comes after yours (whose powers come next): a gold outline, a lighter part and a small TO MOVE tag.
  The others at half opacity and mostly grey, never hidden.
- **The dock line** names the boss who just moved, with his face (today's `BossTag`, unchanged): "Ginger plays e5". I tried a second,
  muted "Moo moves next." after it; it cut off ("Moo moves n…") with a long move like Nc6 on a 428 phone, and the bar's TO MOVE already
  says it, so it's dropped. (Today the "plays" line shows for about 3.5 s, then "Your move.": unchanged.)
- No speech bubbles in these stills: where a boss's words sit in a split bar is PR 10's to settle (proposal: from his own part, as
  today's bubble comes from the bar).
- Computer: the bar over the board splits the same way (portrait, name, TO MOVE, level, meters); the figures beside the board are
  stacked top to bottom in turn order (the bar's order, left to right), one shared scale, feet at the bottom of each third of the
  board's height; the boss to move steps 18 px toward the board and is in full color, the others dimmed (as the phone). The phone and the
  computer dim the same way so the two read alike.
- "N moves left" (and on a computer "Move N") moved from the bar to the strip: the split bar has no room for it.

**The run's strip (in 1 to 6)**
- Phone: it takes the place of today's "BOSS · move 1" line (the gear stays), two lines: "**Battle Tower** · Floor 4 of 99", then the
  bosses beaten as small portraits, "Next floor 1200" and "59 moves left". The board stays 400 px; the strip uses the room the phone had
  spare below the dock.
- **Beaten bosses don't grow the strip:** the last 6 on a phone (9 on a computer), and the rest counted ("+3"), never cut off.
- "Next floor" is the next floor's rating (floor 5's 1200 = 1000 + the lone-boss 200; floor 7's 1200). The floor's own rating isn't on
  the strip (the tower screen has it).
- Computer: one row above the bar, as wide as the board; the board gives it the room (its height rule's `--bd-room` + 48 px, so the
  board is 727 px instead of 760 at 1440 × 900).

**The tower's screen (7, 8)**
- Built on Boss Battle's screen: the tiles give way to the run's card (the skyscraper box, "YOUR SOLO RUN · SAVED", "Floor 5 of 99",
  the bosses beaten, the floor's bosses and rating), your bests (Best solo, Best party) and a **Solo | Party** switch, each with its own
  floor (the party's run is a separate run, design §5). The stage is Boss Battle's: you with the invite circles (a tap makes it a party
  of up to 4) VS the floor's bosses, its rating where the difficulty was. "CONTINUE FLOOR 5" in START's place (a smaller font, so it's
  one line), and "Start a new run" under it, always shown (it ends the saved run: a confirm, PR 10's).
- With no saved run: the same screen, the card says "No run yet", the button "START A RUN", and "Start a new run" greyed (nothing
  hidden). Not drawn.
- Phone shows floor 5 (as the brief, one boss); the computer floor 8 to show three bosses on the stage, each a third of the boss side.

**Home (9, 10)**
- Phone: three cards a third wide (125 px at 428), 56 px, the picture (28 px) over the name, no short line; checked at 360 and 320 px
  wide: at 320 the names go to 11 px (as today's half cards do under 360) and fit.
- **Computer: the cards are 70 px, not 56** (a call): the column at 1440 is 360 px, so a third is 115 px, and "Battle Tower" (82 px)
  can't sit beside a picture. So the computer stacks too: picture, name, then the short line ("Any boss, up to 3", "Build an army",
  "Climb 99 floors"), which needs 70 px. Home is 14 px taller than today, once (it never moves after).
- The skyscraper picture is a plain dashed box labeled "ART RUNNER": the art runner draws it.
- Not changed: the computer's side menu (it lists Boss Battle; the design says the home card only). Director: add "Battle Tower" there?

## PR 10: as built (Nov 19)

The real app on a local server, 2× pixels. `pr10/1-phone-428-floor-2-battle.png`: floor 2 (two bosses), your move after the bosses'
reply: the run's strip (the boss beaten on floor 1, next floor's rating, moves left), the bar split in two, the boss to move lit with
TO MOVE. `pr10/2-computer-1440-tower-screen.png`: the tower's screen with a run saved on floor 2 (floor 1 won, then "Stop here
(saved)"): the run's card, bests, Solo | Party (Party greyed: coming soon), the floor's two bosses on the stage, CONTINUE FLOOR 2.
