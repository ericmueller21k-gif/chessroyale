# Chandy's Swamp: round 2 (Nov 16)

Branch `claude/chandy-home`. Everything here is the real game, in an admin's town. The rise is filmed in the room's own challenge
camera, using the test switch `?introPreview` (Chandy's rules aren't in yet, so his intro plays to its wipe and no battle starts).

## New this round

- `12-rise-phone.gif`, `13-rise-computer.gif`: the whole rise in the room, from his first beat to the wipe. Both figures are on
  screen in every frame.
  - **The board rises first** on its mossy post, water streaming off it. Its foot stays under the water, on the sunken platform.
  - **The platform** is now 8 squares wide (4.5 west of the battle spot, 3.5 east) and 2.5 deep.
    - While its deck is under the water it shows faintly, as if seen through the water.
    - When the deck reaches your feet, you both ride up on it, 0.6 of a square, the post and board with it.
    - Once you're lifted, your waterline and ripple come off.
  - **The milk crates** drop onto the deck beside the post (his blue, your orange) as you both hop back to your clear places.
    - Chandy's whole figure, tail included, stays on the deck with about half a square to spare. So does your pawn.
  - **His entrance**: he points, then fires. This uses his own moves until his God King attack comes with his rules.
  - **The wipe**: a wall of swamp water rolls in from the side, with a foamy wavy edge, a cattail and a lily pad riding it, and
    bubbles in it.
- `10-room-day-phone.png`, `11-room-night-phone.png`:
  - The trees are lower and their tops thinner, so a band of the town's sky shows overhead: blue by day, stars at night. (On a
    computer the room's camera looks lower, so the trees fill its top.)
  - The arrival title says only "CHANDY'S SWAMP".

## Why the pawn vanished (round 1)

The round-1 GIF was a flat drawing made by a script, not the game. Its own pawn painter got fractional y positions while the platform
eased up, so it wrote its pixels nowhere. The game was never involved. That script is gone; the rise is now the game's.

Here is what the game does so nothing standing on the platform can be hidden:
- The platform is drawn on the table's row, before you and Chandy.
- You ride up with the timeline's lift.
- The water's clip and ripple come off once you're lifted.

## Calls for Eric (still open; the recommended ones are used)

- **K. Shopkeeper:** **A, the old bullfrog** (07), or B, a snapping turtle in hip waders.
- **P. Where:** Meadow Street, between Wrangler's Stall and Moo & Moon Meadow.
- **H. Height:** the cypresses about as tall as the row houses next to it.
- **R. The rise:** post first (1.8 s), then the platform (1.7 s), then the crates. Faster or slower?
- **W. The wipe** (changed): from the side, like every boss's wipe. Water rising from below would need a new kind of wipe in the game:
  more code, so I kept it simple. Say if you want it from below.

## Also changed

- **The arrival title:** the gold owner line is dropped when the home's name already starts with it. This also fixes Timber's,
  Dash's, Smudgy's and the rest the same way. Rolling Dough keeps "DON DOUGH'S".

## Not there yet / for others

- **His crate (the item-builder's):** core has no Boss Crate of Chandy's yet (`bossCrate("chandy", …)` and its ride). For now the
  frog's Talk says one of three lines.
- **His challenge:** "Challenge alone" stays greyed with "Coming soon" until his rules land. The test switch `introPreview` plays his
  intro for tests and stills.
- **His God King attack (the rules job):** it isn't in his art kit yet. His intro's swing beat waits for it. Until then his
  point-and-fire is his entrance.

## Earlier stills (round 1, unchanged)

- `01`, `02`: the front on a phone and a computer.
- `03`: the front at night.
- `04`: wading.
- `07`: the frog.

## Build (Nov 16)

- `14-rise-phone-build.gif`: the built rise on a phone, his water now rising from the screen's foot (Eric's call W) and draining back down.
