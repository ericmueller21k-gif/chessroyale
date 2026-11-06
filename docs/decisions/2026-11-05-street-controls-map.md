# The street town's controls (hold to run, locking a new view) and a minimap (Nov 5, 2026)

Eric's notes after round 5 (Nov 5). Still the admins' street town only (`STREET_TOWN`); today's town is unchanged.
Brief: `notes/briefs/brief-street-controls-map.md`. Round 5's decision: [2026-11-05-street-fixed-view.md](2026-11-05-street-fixed-view.md).

## Hold to run

Eric: "If you hold your mouse click down right now, it does nothing … if you hold it in the direction … up, down, left or right …
right away … it starts running in that direction … it's a little too tough to run around on mobile." And: "if you were to move your
finger, instead of it rotating the screen, it doesn't. It will start running in whatever direction you now are holding … the ability to
rotate the screen is locked when you're in the running state."

- **Three gestures** (`town/press.ts`), told apart by the drag threshold and a hold time (`feel.ts streetHoldMs`, 180 ms):
  - a quick tap walks to the square, as before;
  - a press that moves past the threshold first is a look round;
  - a press held still past the hold time is a run.
- **The run** (`town/run.ts`) goes the way the finger is from your pawn on screen, snapped to up, down, left or right of the view. It holds
  that arrow (`arrows.ts hold`), so it is the arrows' walk: the same pace, the same squares, the same card at a home's door. Moving the
  finger changes the way and never turns the camera. Letting go stops you at the next square. Mouse: the left button.
- **Calls made:**
  - 180 ms: quick taps are about 80 to 150 ms; much more and the run feels late.
  - The hold time is measured from the pointer's own event time, not when the page gets to it. A slow frame can't turn a drag that
    began at once into a run.
  - The way is taken from where your pawn stands when still, not where it's drawn mid-run. Running, the camera's follow lets your pawn
    lead by up to about a square on screen. Steering from the drawn pawn fed that lead back into the way, and a finger near it flipped
    the run back and forth (seen in the e2e).
  - A dead zone of `streetRunDeadPx` (14 px) round your pawn: no way is asked for there, and a run keeps its way.

## Locking a new view

Eric: "when you swipe … and change direction, if it detects that you're … within 10 degrees of a new 90-degree baseline, and then you tap
in that direction, it switches your view. So that becomes your straightforward … it locks in … It'll always default back to the normal
[view] if you go into a building and come out … sometimes I just want to look around and then tap on a different street and have it
lock that direction for me."

- **The base heading** can be north, east, south or west. Off a home's strip it is the camera's normal heading. The arrows, the screen
  step and the runs follow it.
- **Letting go of a look round** within `streetSnapDeg` (10°) of a quarter eases there exactly over `streetSnapMs` (160 ms). If that's a
  new quarter, the view is snapped (`turn.ts LookAround.release`). Otherwise it stays where you left it, as before.
- **Locking it in:** if the next move is a tap's walk or a run, the snapped quarter becomes the base heading (`turn.ts lockIn`). The look
  round's offset goes into the normal heading, so the camera doesn't move.
- **Not snapped, or an arrow first:** your first step eases back to the base heading, as before. The arrow keys never change it.
- **North again** as the town opens and after a building's in and out (`turn.ts freshView`, under the black).
- **Call made: a home's strip doesn't reset it.** On a strip the camera faces that home's front, as round 5 does, and the base is left
  alone. Stepping off goes back to the base heading you locked. Reason: the strip is a glance at a front. If it reset the base, walking
  past a home would silently undo a view you chose, and Eric didn't name strips. If he wants it, it's one line in `Town.tsx`'s frame.

## The minimap

Eric: "on by default … an overlay on the top right, partially see-through, not super big … shows where your guy is … the Colosseum
basically outside the map, on the edge … a thin line … so players can see when they run to the top that they're at the top." "It should
be an actual representation of the overhead … no labels." "Another icon [with our other icons] … click it, it turns it off." "If you tap
the minimap, it comes to the center of your screen … all of Chess Town … put the little icon of which boss is at which shop … the
Colosseum, the park … tap it again or tap away, back to normal size."

- **Built from the plan's data** (`town/minimap.ts`): `street.ts`'s ground (streets, paving, lawns, gardens, lots), the homes' lots as
  soft blocks, the walls (lots of kind `wall`) as lines, and the Colosseum as a band on the top edge over its columns. It follows any
  change to `street-plan.json`. Its body runs from the south edge to the last row with anything on it but the grove and the Colosseum.
- **Small:** top right, partly see-through (`mapOpacity` 0.7), with rounded corners. It's `mapShare` (26%) of the box's width on a
  phone and `mapShareComputer` (13%) in a computer's frame, at most `mapMaxPx`. No labels. Your dot is bright, with a small arrow the way
  the camera faces, so the base heading shows at a glance.
- **Call made:** where the chat takes the box's whole top (a narrow computer frame, 1024 × 700), the map sits just under the chat on the
  same right edge. It never covers the chat, the arrows, the zoom pair or the focus button.
- **The button** (`TownChatTools`, with the chat and settings buttons): a folded map, lit while the map shows. It's stored per device
  (`brc.townMap`) and on by default. Greyed inside a building, never hidden.
- **Large** (a tap on the small map): the whole town in the middle of the box. Every boss home has its chip's portrait, with no names.
  The park and the Colosseum are small icons, and you're the dot. A tap on it or anywhere outside closes it, and it never walks you.
- **Cost:** the static layer is drawn once a size to the map's canvas. Each frame only the dot's CSS transform is set, and only when it
  moves a quarter pixel or turns half a degree. Nothing is allocated on a frame.

## The default zoom

Eric answered the director's question: "If number one is the closest, then we're going with number three for the default." The town opens
at the third step (`streetZoomStart` 2, "out"). The park's step out goes from there to the overview (3). The rows' culling stays at the
in and mockup steps, which it was built for.
