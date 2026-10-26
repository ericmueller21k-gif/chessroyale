# The town square, slice 5: the Coliseum (Oct 26, 2026)

## Eric's words (Oct 26)

- "Add the coliseum art now, a much bigger building, as we discussed a coliseum with chess theme, maybe even statues of
  chess pieces around it or themed etc."
- The Coliseum is where raids with people will start: "they will now go all into a menu when you click on or stand by the
  coliseum as far as party and stuff". The mode is being renamed Boss Arena; the Coliseum is its heart.
- A statue of the Hidden Boss beside it is a separate, later job: this slice leaves room for its plinth and doesn't draw
  him.

## What's in slice 5

- **The Coliseum** (`town/houses/coliseum.ts`), drawn in code in the homes' pixel style, on the 6 × 6 ground kept clear in
  the world's middle (`COLISEUM` in `world.ts`):
  - **A Roman amphitheater** seen from the front and a little above, lit from the top left:
    - an oval wall of warm stone in three tiers (two of arches, a top tier of windows), each tier on a lit cornice;
    - its open top shows the rim, the seats stepping down inside with a few dark doorways, and a strip of the arena's
      floor, which is a chessboard;
    - **a tall portal in the middle of its front**: a dark arched gate facing your start (south), with a raised
      portcullis and the sunlit floor at the tunnel's end.
  - **Chess-themed:**
    - a checkered band of the board's light and dark squares runs round its attic, and another round the arena's wall
      inside;
    - five chess pieces are carved in relief in a panel over the gate: a rook, a knight, a king, a queen and a bishop;
    - two navy banners with gold crowns hang on its face, in the game's colors;
    - a gold and a navy pennant fly on its far rim, and a navy flag with a gold crown flies on a mast over it all;
    - **statues of chess pieces on plinths** stand round it:
      - beside the gate, the bronze queen (left) and king (right);
      - beyond them, the marble bishop (right) and **the empty plinth (left)**, which has a small brass plate and no
        figure (for the Hidden Boss's statue, later);
      - at the front corners, a marble rook (left) and knight (right, facing the gate);
      - at the back corners, two marble pawns.
  - **Idle:** four frames of 260 ms. The banners and pennants stir and the flag flutters. Nothing else moves.
  - **Names:** the game writes "The Coliseum" on a marble tablet in a bronze frame over the gate (its sign) and floats
    it over the building as you come near, like the homes' names.
- **Walking:** its 6 × 6 ground is solid, so you walk round it as round a home. It has a home plot's faint tint.
  - **The apron:** the 6 × 4 squares in front of the gate (columns 17 to 22, rows 12 to 15). Nothing is built there, so
    people can gather. Your start (20, 13) is on it.
  - The bots' plaza and the paths around the middle are unchanged.
- **Tap the Coliseum** (its picture, its gate or its ground): you walk to the apron and its card opens, in the slice 4
  card style:
  - **"The Coliseum"**;
  - **"Raids with people"** as a greyed button (shown, not tappable), with **"Coming soon"** under it, where Eric's menu
    will live;
  - a tap elsewhere (or Escape, or a chip) closes it.
- **Its edge chip:** when none of it is on screen, a chip in the game's navy shows a gold crown over a band of the board's
  squares. It counts within `maxChips` (4), and whenever it is among the nearest four it is placed first, so it always
  shows. A tap glides the camera to 3 squares in front of its gate.

## Player-visible text (all new)

- On its sign and floating over it: **"The Coliseum"**.
- Its card: **"The Coliseum"**, **"Raids with people"** (greyed), **"Coming soon"**.
- Its chip's label (for screen readers): **"Go to The Coliseum"**.

## Judgment calls

- **Size: 320 × 246 pixels at the homes' scale** (37 pixels a square, never scaled up, so its pixels match theirs).
  - With its statues it is about 8 squares across; its oval wall is 6.4 squares across and 2.6 tall to the attic's lip.
  - That is 2.2 times the tent's width and twice its height. The pyramid, the biggest home, is 208 × 160.
  - At the opening view it fills about half the phone's width and a third of the computer's. It is the landmark straight
    ahead of you, and both sides of the plaza and the homes beyond stay in view.
- **Its foot is the gate's sill, on the front edge of its ground** (row 15.5). Like everything in the square, it is
  sorted by its foot:
  - people on the apron stand in front of it;
  - people beside its walls (rows 16 and up) are behind its picture where they overlap.
  - Their name tags still show, as they do behind a home.
- **Its picture is drawn whenever its foot is inside the rim**, like every home, its four frames made once. A frame
  costs one image draw.
  - `drawable` takes how far under the box a foot may be (`below`: 7 squares for the Coliseum, 3.2 for everything else
    as before), so its top still draws when you stand beside it and its foot is under the screen.
- **Where the statues stand.**
  - The queen and king flank the gate, the queen on the left, as on a board seen from White's side.
  - The empty plinth is on the gate's left beyond the queen, matched by the bishop on the right. The Hidden Boss will
    stand there, by the gate, opposite the bishop.
  - The rook and knight hold the front corners, as rooks and knights stand near a board's corners.
  - The pawn is two pawns, one at each back corner, so the building stays symmetric. A board has eight.
  - The king and queen are bronze; the rest are marble, so the royal pair reads first.
- **Checks in the board's light and dark** (cream and walnut; the dark a little deeper than the ground's, so the band
  reads on warm stone). The checked bands are the attic band (two rows) and the arena's wall inside, and the arena's
  floor is a board. The rim stays plain stone, so the bands don't crowd each other.
- **The card's greyed line** is a greyed "Raids with people" button with "Coming soon" under it, as in the home card's
  "Shop" / "Coming soon". The brief wrote it as "Raids with people · Coming soon".
- **Where a tap ends you:** on the free apron square nearest the gate. Of two that are as near, it picks the one you reach
  in fewer steps.
  - The first two people stand at the gate. The next ones fill a half ring round them, so a crowd gathers at the gate.
  - If the apron is full, you end on the nearest free square round the gate.
  - A tap anywhere on its ground counts as a tap on the Coliseum. Its card opens even when you're already at the gate.
- **The chip shows when none of its picture is on screen.** A home's chip shows when its foot is off screen. The
  Coliseum is wide enough to be half in view with its foot off screen, and a chip then would point at something you can
  see.
- **The bots' start squares moved.** They are picked by the same seeded draw as before, but the Coliseum's ground is no
  longer a place to stand, so the draw lands differently. They still start around the plaza, apart and off the bosses'
  ground.

## Tests changed

- `packages/app/test/town-camera.test.ts`, the layout check: "the Coliseum's 6 × 6 ground is walkable" → "no home
  stands on the Coliseum's 6 × 6 ground". The Coliseum is built there now and is solid. The new checks below cover it.
- `packages/app/test/town-world.test.ts`: the spot the ring tests gather round moved from the Coliseum's middle (now
  solid) to open ground south of the plaza (24, 2). Every check is unchanged.
- New: the Coliseum's ground is solid and a walk goes round it; the apron is open ground, nearest the gate first; a tap
  on it (or its ground) ends you at the gate, and everyone sent there gathers on the apron, a square each.
- New e2e (`e2e/town.spec.ts`, phone and desktop): a tap on its gate walks you to the apron and opens its card, with
  "Raids with people" greyed and "Coming soon"; a tap elsewhere closes it.

## The three fixes from Eric's slice 4 test (the director, Oct 26)

1. **Your own pawn shows your profile pawn.** Eric: "My pawn isn't showing my profile pawn on the town url."
   - Your pawn wears your equipped crate items (`locker.look`), drawn as `Avatar` draws them: the items behind the
     piece, the pawn (or its skin), then the items in front.
   - `town/you-look.ts` renders `Avatar` once off screen, turns each of its SVG layers into an image, and draws them in
     order into one canvas over the town's plain pawn. That canvas is your sprite, at the same size and anchor.
   - It's made again only when your look changes, on the account's change. Signed out or nothing on: the plain pawn,
     as before. The bots stay plain.
   - Calls:
     - The canvas has a 15% margin round the pawn's box, so a hat or a weapon past the box isn't cut off. `Avatar`
       lets items go 12% past it.
     - A shiny item's moving glint is left out, because it's a CSS animation and the town's picture is still.
     - Your name tag sits on top of your hat, not over it.
2. **You stand on the square, not float over it.** Eric: "the shadows below never change and makes it look like I'm
   floating, shadows should change according to distance from the tile."
   - **The base now stands on the square's middle.** Slices 1 to 4 put a point a tenth of a square under the base
     there, so every pawn, you and the bots, stood a little above its square.
   - **A contact shadow** lies right under every pawn's base (you, the bots), and under each boss's feet. It's tight
     and dark when standing.
   - **As the hop lifts a pawn**, the contact shadow and the soft shadow both shrink and fade with the height, through
     every step.
   - **Your gold ring** lies flat on the ground in the ground's own perspective: a circle 0.84 squares across,
     projected point by point. Its back half is drawn behind you and its front half over your base, so you stand
     inside it.
   - Checked at rest and mid-hop, zoomed in and out, on a phone and a computer.
   - New numbers in `feel.ts`: `ringSize`, `shadowAlpha`, `contactShadowW`, `contactShadowDepth`,
     `contactShadowAlpha`, `shadowLiftShrink`, `shadowLiftFade`.
3. **The press is one clean thing.** Eric: "it's like yellow, brown, yellow, then the tile. Confusing and looks cheap."
   The layers were an outer glow, the square's seam showing between the border and the sunk face, a fine inner line,
   then the darkened face.
   - Now the face dims a little and evenly (`pressDarken` 0.16 → 0.12).
   - One bold gold border lies exactly on the square's edge, over its seam (`pressBorder` 0.12 → 0.1 of a square).
   - A soft glow shows outside only (`pressGlowPx` 16 → 14).
   - The sinking face, the hole and the inner line are gone (`pressDip`, `pressInset` removed).
   - On release, that same border brightens (`pulseColor`), widens a little (`pulseWiden`, 0.4 of its width) and
     fades over 300 ms. It no longer grows outward (`pulseGrow` removed).
