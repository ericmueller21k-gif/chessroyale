# Art redo, Oct 31: three rides and the beaver's first still

Eric approved the four drawings, an expected $12–18 and a $40 cap. **Total spent: $8.73** (Opus 5.5 at high effort).

| Drawing | Runs | Cost |
|---|---|---|
| Moon's Ride (`moon-ride`), redrawn | side, try 1 (a bowl: not used) $1.89; side, try 2 $0.73; views $0.54 | $3.16 |
| Hollow's Bulb (`hollow-bulb`), new | side $0.63; views $0.66 | $1.29 |
| Brush Ride (`smudgy-brush`), redrawn | side $1.30; views $1.39 | $2.69 |
| The beaver builder (`boss-beaver`), idle only | first still $1.33; orange-vest fix $0.26 | $1.59 |

The ride GIFs (made with `ride-gif.ts`: 3 squares right, 3 left, 2 up, 2 down, then idle, beside a plain pawn) are
`out/<id>/ride.gif`. The beaver's idle is `out/boss-beaver/idle.gif`, and `comparison.png` shows him beside the
other bosses.

## Moon's Ride: `out/moon-ride/ride.gif`
- **How it reads:** a thin, level crescent like a hoverboard, its top a flat deck and its belly the moon's curve. The
  sleepy face is on the front edge and the pawn sits on top. It floats with a soft bob and twinkling stars, and glides
  with a slight lean and a short sparkle trail. From the front and back it's a level sliver; the face shows from the
  front.
- **Width:** the board is about 123 units (−10 to 110) in every view, stars included. The move's sparkle trail reaches
  back to −30, so the widest move frame is **140 units (1.4 squares)**.
- **Why a second try:** the first came out bowl-shaped ("a banana boat", in its own words) instead of Eric's flat board,
  so it was redrawn ($1.89 of the total went to the rejected first try).
- **Open choices:** Midnight is dark on dark (the face and stars still show). Should the trail be cut to fit 125 units
  (below)?

## Hollow's Bulb: `out/hollow-bulb/ride.gif`
- **How it reads:** a chubby vintage bulb on its side, floating. It has a silver ridged cap, a green cord curling
  behind, and the glass in the item's color with a highlight streak. The pawn sits on top beside the cap. A warm
  glow with a little filament pulses inside, and the cord swings as it bobs along. From the front it's a round
  glowing ball; from behind, the cap and the cord curl.
- **Width:** **123 units (1.23 squares)** at its widest, cord swing included; about 55 units front and back. Within the
  limit.
- **Open choices:** the glow is a fixed warm yellow-white, not a second color the player picks. The cap is silver
  (brass would blend into yellow glass). The filament zigzag was the model's own addition.

## Brush Ride: `out/smudgy-brush/ride.gif`
- **How it reads:** a short brush flown like a broom. It has black bristles with the item's color on the tips, a
  silver band, a wooden handle, and a plum seat pad (a nod to Smudgy's beret). Nothing drips or dangles. A little wisp
  of color comes off the tips in the idle, and the swoop leaves a short ribbon of color. From the front, the handle end
  shows with the colored bristle tips peeking out on both sides; from behind, the round bristle bundle.
- **Width:** the brush itself is 125 units (−12 to 112.5) in the side view and about 74 units front and back. The
  move's color ribbon trails 27 units behind, so the widest move frame is **152 units (1.5 squares)**.
- **Open choices:** the seat pad is plum (could be cream, or none). Midnight tips are hard to tell from the black
  bristles. From the front, the peeking tips look a little like horns.

## The beaver builder: `out/boss-beaver/idle.gif`
- **How it reads:** a brown beaver standing upright, facing the board. He has buck teeth and whiskers, an orange hard
  hat and an orange safety vest with light stripes, and a yellow tool belt with a red-handled hammer, a tape measure, a
  wrench and pouches. Two crossed planks are strapped on his back, and his crosshatched paddle tail shows behind. No
  pencil. Idle: he breathes, blinks and taps his hammer (24 frames).
- **The vest fix:** the first still had no vest (bare fur under the straps), so a small $0.26 edit pass added it.
- **Open choices:** he stands a little taller than Sawyer and the tiger at phone size (88 × 88 frame). His brows sit
  under the hat brim. Only one plank's lower end peeks out. The pouches are yellow like the belt. "The Beaver Builder"
  is only a placeholder name. Only the idle is drawn so far.

## Needs Eric's call: the trails and the 1.25-square rule
The moon and brush bodies are within 125 units in every view. Their **move trails are not**: the moon reaches 140
units and the brush 152 while moving (`ride-gif.ts` marks them WIDE). Eric asked both for a short trail, and the
bodies already use the full 125, so a trail can only stay inside the limit if it's dropped or tucked under the ride.
Either is a small edit (about $0.50 each, or by hand) if Eric wants the strict limit.
