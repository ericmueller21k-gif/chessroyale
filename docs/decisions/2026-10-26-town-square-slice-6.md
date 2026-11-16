# The town square, slice 6: a bigger Coliseum, a bigger map, and the park (Oct 26, 2026)

## Eric's words (Oct 26)

"I just thought of a cool idea to add to the world, a little park, nothing fancy, but it's filled with chess boards on little
tables where you can walk up and sit and challenge or wait for one for someone for a casual or ranked game of normal chess."

Then: "we might need to expand the map for this to fit in im envisioning benches, sidewalks, even a water fountain in the
middle, trees like you already said, a very cozy city park feel. I'd say 10 chess boards to start with. We need it not to
just be plopped down tho and in the way, maybe open up the space in front of the coliseum and it can go there, I actually
think we may even make the coliseum about twice the size it is now so it's clearly standing out, and this would also allow it
to be easily seen looming over the park."

He picked: a park game plays on the normal game screen, and then you come back to your table. **Matchmaking is the next job**
(it needs a new casual queue). For now a table's card shows Casual and Ranked greyed, with "Coming soon".

## What's in slice 6

- **The Coliseum, about twice its size**, redrawn at the bigger size rather than scaled up (`houses/coliseum.ts`). Its ground
  is 12 × 12 squares (was 6 × 6). The wall is twice as wide (472 pixels) and has three tiers of arches (was two), 27 bays (was 15),
  a tier of windows and the checkered attic. Marble pawns stand in every other arch of the middle tier. The bowl has 14 rows
  of seats, with gold seats in the front row and doorways in three rows, and the arena's floor is a full chessboard. The
  portal has fluted pilasters, a portcullis and dressed stone. The tablet is bigger (the game writes "The Coliseum" on it),
  over a relief of five pieces carved from the statues' own profiles. Four banners, four pennants and the flag. The chess-piece
  statues are half as big again, plus a marble pawn at each back corner. The picture is 648 × 372 pixels (was 360 × 246).
- **The two statues** keep their place: they already followed the ground's size, so they now stand 11 squares apart, before
  the ground's end columns. Their viewing squares are (17, 22) and (28, 22). Their pedestals are unchanged, so they read lighter
  beside the bigger walls. Their close-up and quotes work as before. Their look is left for the next job (the director: new
  pedestals, hair and the marble statue's art).
- **The park** (`world.ts` `PARK`, `PARK_PLAN`; the art in `houses/park.ts`), 20 squares wide and 10 deep, south of the
  Coliseum's 3-row apron:
  - A paved walk goes all round it. The promenade, 4 squares wide, runs up the middle from the plaza to the gate, past the
    fountain.
  - Ten chess tables stand on paving, five either side of the promenade, each with a stool west and east of it.
  - Lawns outside them hold ten trees and four benches, and two more benches face the fountain from its corners.
  - The ground has two new kinds of square, paving (light stone) and grass (two greens). Each is drawn in the same single pass
    as the board's squares.
  - Tables, trees, benches and the fountain are solid. You walk round them on the paths, stools and grass.
  - The fountain is grey stone, deliberately not like Puddles' tiered garden fountain: a wide round basin with carved
    panels, a pedestal carrying a broad bowl, and a stone pawn on top spouting a jet. Water spills from the bowl into the
    basin, where ripples spread. That's its idle, 4 frames.
- **Sitting at a table.** A tap on a table, or on one of its stools, walks you to its free stool nearer you. If both are
  taken, you go beside the table. You **sit**: your pawn shows from a third of its height up, resting on the stool's seat
  (lower than standing), facing the board. The table's card opens (the slice 4 card): **"Chess table"**, with **"Casual"**
  and **"Ranked"** greyed (shown, not tappable) and **"Coming soon"**. A tap elsewhere closes it, and you stand on the
  stool's square. Walking anywhere else also stands you up.
- **Bots sit too**: a bot that stops on a stool sits. About a third of their walks head for a free stool within 7 steps, and
  a seated bot often stays a turn longer (`botSitChance`, `botSitReach`, `botStaySeated`). One pawn a square, so a stool each.
- **The map grows to 46 × 46** (was 40 × 40). The thirteen homes are re-laid evenly round the bigger middle. Every home's
  nearest neighbor is still 8 to 10 squares away. No home's roaming ground reaches the park or the Coliseum. Ginger Igloo and
  Jefferson's Fireworks still stand side by side, and so do Hollow Peak and Moo & Moon Meadow.
- **The Coliseum from afar.** Past the rim, the Coliseum used to vanish. Now it stands on the horizon where it lies, for up to
  16 squares past the rim: smaller with distance, sunk behind the world's curve (only its top shows over the horizon) and
  hazy like the far band. So it looms from across the world (`farReach`, `farSink`, `farHaze`). It costs one image draw a
  frame, only while it's out there. Its chip isn't shown while it's in view.

A text map, two squares a character, north up (`#` the Coliseum's ground, `=` paving, `:` grass, `@` your start):

```
H.....................H   H Hollow Peak (0, 43)
H.........AA..........H   A Alfil's Pyramid (22, 42)
...MM.....AA.....GG....   M Moo & Moon Meadow (8, 40)    G Smudgy's Art Gallery (35, 40)
...MM............GG....
.......................
........#######........
........#######......CC   C Big Boy's Crib (43, 31)
........#######......CC
..FF....#######........   F Boingo's Funhouse (5, 27)
..FF....#######........
........#######....SS..   S Sawyer's Woodshed (40, 23)
........#######....SS..
........=======........   (the apron)
.WW...=::::==:::=......   W Wrangler's Stall (4, 17)
.WW...=:::===:::=......
......=:::===:::=......
......=::::@=:::=..II..   I Ginger Igloo (39, 11)
......===========..II..
..RR...................   R Chub & Chirp's Grassland (6, 8)
..RR...................
.............BB....JJ..   B Babur's Circus (28, 4)    J Jefferson's Fireworks (39, 3)
.......PP....BB....JJ..   P Puddles' Botanical Garden (16, 2)
.......PP..............
```

## Judgment calls

- **Where you start: (22, 13)**, on the promenade just south of the fountain, facing the Coliseum (its gate 9 squares
  ahead). On a phone the first frame shows the tables either side, the fountain ahead and the whole Coliseum over it. Farther
  back (the park's south walk), the Coliseum would sit in the far band's haze at the zoomed-out view.
- **Twice as wide and deep, half as tall again.** On a computer the camera looks down steeply, and the top of its view drops
  about a square for every two squares of distance. A building more than about 7 squares tall never fits from the park
  however far back you stand. The slice 5 Coliseum was 6.6 squares tall; this one is 10 (two tiers of arches more). That's
  the real Colosseum's shape (about four times as wide as tall), and the phone shows it whole from the start. On a
  computer it rises out of the top of the view from the park ("looming"), and its card stands at the top of the view
  over it (before, a card whose building's top was above the view stayed hidden).
- **The Coliseum from afar** (above) was added so it reads as the landmark from anywhere on the bigger map. The rim alone
  would have hidden it from every home.
- **The table's card opens as you tap**, as every other card does, and you sit when you get there. A tap elsewhere both
  closes it and stands you up.
- **Stools west and east of each table**, so you see the two players in profile across the board. A stool south of the
  table would put the nearer player in front of it.
- **Babur's Circus and Sawyer's Woodshed swapped places** on the new lattice, so Babur's is among the four nearest homes from
  the start and keeps its chip (`e2e/town.spec.ts` uses it).
- **The tables' boards** carry a game under way: a few light and dark pieces on each.
- **Small idles only:** the fountain's water. The trees stand still (leaves would cost a frame per tree for little).

## Frame rates

Headless Chromium, the default view with the park and the Coliseum in sight, warmed 6 s, then 3 s walking through the park;
medians of 3 runs. Phone 390 × 844 at 3×, computer 1440 × 900, frames a second.

| | Phone day | Phone night | Computer day | Computer night |
| --- | --- | --- | --- | --- |
| main (slice 5 and the statues), still / walking | 59.8 / 59.3 | 59.8 / 59.3 | 55.8 / 57.0 | 57.3 / 55.4 |
| this slice, still / walking | 57.5 / 58.0 | 59.0 / 57.7 | 59.5 / 54.7 | 55.8 / 53.7 |

Every picture is made once and cached: the Coliseum's 4 frames, each kind of tree, the bench, the table and the fountain's
4 frames. A frame draws each of them with one image draw while it's inside the rim. A profile shows almost no script time:
what's left is the drawing itself (the park adds about 50 small pictures in view).
