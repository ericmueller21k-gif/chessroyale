# Alfil's animation pack, and his elephant piece without its cap (Oct 17, 2026)

**Eric** approved Alfil's still and his ankus, picked design A for the elephant piece ("without [the forehead cap],
it'll actually look better"), and asked for the poses and animations as GIFs before the rules.

## The elephant piece

`packages/app/src/board/pieces/alfil-drafts/elephant-A-*.svg`: the forehead cap (the nettipattam) is gone, and the
trunk's two wrinkles are thinner (0.8 against the set's 1.5) and shorter, inset from the trunk's outline so they don't
merge with it at 40 px; the curl is unchanged. Design B's files are deleted. Still not wired.

## His animations

`packages/app/src/characters/alfil.ts`. Every pose is numbers on his parts (`AlfilPose`: `bob`, `air`, `dx`, `nod`,
`ears`, `mood`, the fists, the trunk's shape, the ankus's two points, a hind foot's `step`, the tail), as Hollow's are;
no new hand-drawn frames except the eyes for each mood (`EYES`: glare, blink, shut, wide, smug, joy, up, out). Frame
counts and timings follow Hollow's: idle 16 x 125 ms, thinking 16 x 130, smug 8 x 150, rattled 8 x 80, victory
12 x 110, one-shots of 6 to 12 frames at 70 to 160 ms, and the attack on the shared `KING_ATTACK` beats.

| Animation | Frames, ms | Cues (ms in) |
| --- | --- | --- |
| idle (loop) | 16, 2000 | none |
| entrance | 10, 1310 | rumble 0, thud 340, trumpet 690 |
| thinking (loop) | 16, 2080 | none |
| move | 6, 730 | stomp 320 |
| capture | 12, 1100 | trumpet 90 |
| hurt | 7, 720 | oof 0 |
| check | 8, 950 | trumpet 100 |
| smug (loop) | 8, 1200 | none |
| rattled (loop) | 8, 640 | none |
| defeat | 6, 1550 | oof 0, clatter 290 |
| victory (loop) | 12, 1320 | trumpet 220, stomp 660 |
| tusksCast | 11, 1040 | swing 100 (a whoosh), **cast 350** (the pawns' glow starts), snort 440 |
| tusksFuse | 8, 1010 | **rise 0** (the pawns lift to the center), **flash 500** (the white flash, the elephant appears) |
| mammothSlam | 12, 1360 | leap 230, **slam 590** (the thud, the board shakes), **fly 730** (the pieces fly up), **shadows 940** (their shadows appear on their squares) |
| kingAttack (`ALFIL_ATTACK`) | 32, 2780 | rumble 0, land 360, jab 560 + 170 x i (ten, on `kingAttackHits()`), trumpet 2260, leap 2480 |

The bold cues are where the board art goes later (the glow, the rise and flash, the shake, the flying pieces and their
shadows); nothing on the board is drawn yet. The other cues are for his sounds, still to be made.

## Calls made

- **Headroom: his frame is 81 x 91, his feet 12 px lower in it than before** (15 px above his crown, was 3), so his
  hops, the slam's launch and the raised ankus fit inside the frame (the characters test fails a frame with anything
  on its edge). The select stage sizes him by the rows his idle draws in, and the screens place him by his feet, so
  nothing at rest moves: idle's first frame is the approved still pixel for pixel (checked row by row from the feet).
  It's also 2 px wider and 4 px deeper, room for a knock-back and a heavy landing's shake.
- **The slam squashes and launches inside his box** rather than leaving it: 10 px up (with his shadow shrinking),
  then down onto his haunches with a 2 px shake and dust both sides. Leaving the box would cut him at its edge.
- **The cast points to our right**, aimed a little down: the boss casts from the board's top-left corner, so the board
  is to his right and below. He faces our left (the approved still), and pointing that way would need room past his
  reach beside the board.
- **The cast, redone after Eric (Oct 17): his trunk swings it.** His trunk curls round the staff below his fist (a pose
  of its own, `trunk: "grip"`: down from his face, looping when the staff is up by it, over the staff and its tip
  curled back under), his fist lets go, and the trunk swings the ankus down before him in an arc from our left to our
  right, the spike leaving a gold streak, to level it at his chest in front of him (drawn over his arms, `ankusFront`);
  it holds there, then swings back up to his side and his fist takes it. Beat by beat: grab 0, tip left 100 (`swing`),
  down-left 180, down-right 240, rising 300, levelled 350 (`cast`, eyes flaring, a shake), hold with a snort 440
  (`snort`) and 590, back up 720, fist on it 810, smug at rest 900, 1040 in all. Calls: **a snort, not a trumpet**,
  while it's levelled, as his trunk is busy holding it (two puffs of breath out of its tip, eyes blazing); **the fist
  lets go** at the swing (the trunk alone reads clearer than both on a turning staff); **the ankus is drawn shorter
  at the bottom of the arc** (60 to 85 % of its length), as it comes toward us there: at full length it can't turn
  below his chest inside his frame (67 px long in a 78 px wide room). The frame is unchanged (81 x 91); the spike's
  streak is cut short where it would leave it. The wraps on the staff stay where they're sewn when the trunk holds it.
- **The fusion's flash lights all his gold** (the ankus, the headpiece's and the caparison's trim share the palette
  keys) for one 90 ms frame and a softer one after: it reads as the flash lighting him.
- **The ankus stays planted** when he sinks (a squash, breathing): its butt never goes into the ground, his fist
  slides down the staff. Held up, it rides with him.
- **His attack on a king** is a second character, `ALFIL_ATTACK`, as Hollow's is: the same drawing turned to face our
  right (the king's side) in a frame 36 px wider, jabbing the ankus into the king's square high and low, ten times. It
  has a one-frame `idle` only because the preview starts every reel from one.
- **Defeat:** he drops the ankus and sinks onto all fours, head hung, rather than toppling onto his side (turned on
  his side, his face, headpiece and tusks would read sideways at phone size; slumped, they stay readable).
- **The preview's `ground=` option** draws on another ground (the light theme's `#f3f1ec` for the light idle GIF).
