# The street town, round 5: one fixed view, a look round, and the Colosseum against the back wall (Nov 5, 2026)

Eric walked round 4 (Nov 5, evening). Its chase camera turned with every walk, arrow and tap, and he got lost: "I keep getting lost
running around because every time I press arrows and the camera moves … You should never be confused about where you are in the town."
"This town square is sometimes to the left, sometimes to the right of the Colosseum." Still an admin's town only (`STREET_TOWN`).

- Brief: `notes/briefs/brief-town-fixed-cam.md`, with its addendum on dragging to look round.
- His screenshots: `notes/briefs/assets/town-fixed/eric-01..14.jpg`.
- Round 4's decision: [2026-11-05-street-rows.md](2026-11-05-street-rows.md). Everything there stays but the chase camera and the
  plaza beside the Colosseum.

## One fixed view

Eric: "There should be one view point no matter what, always." "If I go up and down, I go up and down. If I press left, I start running
left, but I don't change the camera angle at all." "No matter what arrows you press, the Colosseum should always be in front of you."

- **The camera faces north** (the Colosseum ahead), at round 4's low street-level height and its four zoom steps.
  - Walking, the arrows, taps, corners and crossings never turn it.
  - Round 4's chase camera (`turn.ts chaseTarget`) is gone.
- **The arrows are screen directions:** up north, down south, left west, right east.
  - Your figure shows its back, front or side as it walks: the existing views, turned through the camera.
  - #502's `rowsUp` in the rooms is untouched: rooms keep "up is up the screen".

## The one exception: a home's front strip

Eric: "the only time it shifts is if you're standing … on the sidewalk … in front of one of their buildings, and then it turns to show
their building. And then when you step off back onto the street, it should [turn back]." On Puddles' screenshot (`eric-14`): "it only
shifts when I actually step onto the sidewalk."

- **A home's strip** (`town/strips.ts`) is the sidewalk squares directly before its front, as wide as its front: its picture's body
  where its row put it (round 4's slide included). Each square in it is at least half under the front, paving only; the door square is
  always one.
- **Standing on a strip,** however you got there (a walk, a tap, the arrows), the camera eases over `streetTurnMs` (500 ms) to face the
  home's front head on. Stepping off eases it back to north. It always turns the short way round (`nearestTurn`).
- **Tapping any strip square** walks you there, and you turn to face the home as you step onto it.
- **The arrows while turned** go through the strip's view:
  - up toward the home, which opens its card (the Nov 5 door rule stays);
  - down back to the street, which steps you off and turns the camera back;
  - left and right along the strip.

  A held key goes through the view it began in.
- **Look-alike fronts never turn it.**
- **All sixteen homes stand on the north sides of their streets, their fronts facing south** (the plan's; round 4 kept every home's
  lot). So on every shipped strip the camera faces north, head on, and the turn does nothing. Three things back this:
  - every strip is unit-tested to give north;
  - the turn is unit-tested with a home facing north (the camera then faces south);
  - the e2e taps Timber's strip and checks the strip is found and the view stays north.

  A home moved to a street's south side would turn the camera with no other change. The director's addendum spoke of homes on south
  sides facing north; the plan has none.

## Looking round (Eric's addendum)

Eric: "When you hold your finger [phone] or click and move your mouse … it should actually rotate now instead of just doing a pan …
you could be running down the street, hold your mouse, move it a little to the left and bring it back to the right … so you could see
what the houses are to your left … but not where your pawn is standing or which direction he's facing … The arrow keys don't have
anything to do with this … when you start to run again, it snaps back to the normal view that we're always used to."

- **A drag turns the camera about your pawn** (`turn.ts LookAround`): turning only, no tilt, freely and all the way round. It replaces
  the street town's drag to pan; today's town (a player's) keeps its pan.
  - **Dragging left turns the view left** (you see more to your left), as the brief and Eric's words say.
  - `streetLookPerWidth` (180°) a box's width: a drag across the screen is half a turn.
  - It's a mouse drag (the left button) on a computer and a one-finger drag on a phone. Pinch and − / + still zoom.
  - A tap and a drag are told apart by the existing threshold (`dragPx`), and a drag never walks you.
- **Your pawn doesn't move or turn.** It keeps its square and its facing, and it's drawn from the view the camera now has of it.
- **Letting go keeps the turned view** until you move. Your first step (an arrow, a tap, the on-screen arrows) eases it back to the
  normal view over `streetLookBackMs` (300 ms), the short way round.
- **The arrows are always the normal view's** (up is north, or a strip's up). Pressed while turned, the view starts easing back at once
  and you walk the normal way.
- **A tap while turned** walks you to the square under your finger, worked out from the view at the moment of the tap, then eases back.
- **On a strip,** the strip's turn is the normal view: a drag looks round from it, and stepping off goes back to north.
- **Boss homes stay where they are.** Eric wondered about moving the ones on the far side of a street; none is needed, since a drag
  or stepping onto a home's strip shows any of them. (The plan has none on a street's south side: above.)

## The Colosseum against the back wall

Eric: "The Colosseum is literally the edge of the top center of the map … we shouldn't see any houses behind it … there's no loop
behind the Colosseum … put a gate to the left and right of it … trees and shrubs … you can't go past it. It's all blocked off … the
entire back wall of the map … is totally blocked … it doesn't loop at the bottom either." On the statues: "It looks like these pawns are
floating", "the pawns are … stacked on top of each other" (`eric-06`, `-09`, `-10`, `-11`). He looked as if he were running through the
Colosseum (`eric-11`, `-12`).

- **The plan** (`scripts/street-plan-north.py`, its round 5 section; `street-plan.json` made again from the art's):
  - **Beside the Colosseum is a grove:** the plaza's strips either side of it, columns 13..16 and 29..32, from its front line (row 34)
    to the edge. It isn't walked on and has trees on every other square, with shrubs along the walls' backs.
  - **The plaza is only in front of it,** rows 31..33. You come at the Colosseum from the front only, and nothing can stand beside or
    behind it.
  - **On its front line either side,** a stone wall (4 squares, crenellated) with a closed iron gate: decorative, placed clear of the
    chess pieces before it.
  - **The back two rows (44..45) are a grove the whole way along,** behind Upper Street's north row. The four skyline towers that stood
    there are gone; six remain, behind South Street's row.
  - **The back wall** stands on the north edge itself, in six segments, every column but the Colosseum's.
  - Upper Street now ends at the grove either side, its rows' corners turning onto it.
  - Still 46 × 46. The start, the park, every home and door are unchanged.
- **Nothing behind it:** from the plaza or the park you see the Colosseum, the walls and gates, and sky above. No house, tower or
  looped town is drawn behind it or its walls (the e2e checks every drawn box's place). The ground past the north edge is drawn as
  the grove's green and nothing stands on it.
- **The statues and the chess pieces** are painted into the Colosseum's picture. Under round 4's chase camera that picture, always
  facing the camera, was seen edge on from the plaza's strips, so its pieces piled up in depth. Under the fixed view it faces you
  head on, and everything before it stands side by side on its front line, planted:
  - the queen and king by the gate;
  - the two statues (the bronze one's subject is never named);
  - the bishop, the rook, the knight and the pawn.

  The two marble pawns at its back corners stood on plinths drawn 78 px up the picture, to look far back from round 3's high camera; at
  the low camera they floated. They're left out of the street town's picture (`HOUSE_COLISEUM_STREET`). Nobody can stand beside it any
  more, so its depth against you is always right: you're in front.

## Edges

- **North and south don't wrap** (round 4's switch, `wrap.ns`). The south edge is round 4's closing row. With the camera facing north,
  you never look south past it except by a drag, which shows the row.
- **East–west wraps as before** (`wrap.ew`, one switch: Eric may close it later).
- **No second Colosseum:** the world's things are drawn once, the shortest way round. The ground walker never lays a square twice at
  any zoom step (unit-tested from the plaza to South Street, phone and computer), so the wrap never shows the town beside itself.

## Cost

The fixed view sees less than the chase camera: you look across a street at one row rather than down it at two. The draw counts and
frame rate are in the PR body (`docs/street-town-fixed/pr-body.md`); round 5 is no slower than round 4 on any route measured.
