# Smudgy's animation pack and board art (Oct 19, 2026)

**Eric** approved the still ("I'm happy with it") and asked for the animations and the board art as GIFs, with the tail as
his main animated part ("make his tail the animated, moving thing") and his chameleon eyes swiveling on their own.
Still not wired in: he isn't in `CHARACTERS`, `BOSS_KITS`, `KING_ATTACKERS` or the roster, and the rules (Camouflage,
Repaint) are built separately. `packages/chess` is untouched.

## His animations

`packages/app/src/characters/smudgy.ts`. Every pose is numbers on his parts (`SmudgyPose`), as the other bosses'. New
since the still: `dx` and `air` (the whole of him, sideways and up), `nod` and `lean` (his head, with its eyes, casque and
beret), the lids (`lidN`, `lidF`: open, wide, half, shut, joy) and the mouth (`mouth`: smirk, grin, open, frown: a head
part made when first drawn), the brush's paint (`paint`: full, side for a brush held level, smear, none) and `front`
(the brush arm drawn over his body, for a dip across his belly, or over everything, for a slash). The brush is posed by
`holding(fist, tilt)`, the fist and the tilt from straight up, and the arms' elbows bend by themselves when only the
fist or the hand is given (`elbowOf`). No new hand-drawn frames: the eyes and mouths are a few pixels each.

Frame counts and timings follow Alfil's and Chub & Chirp's (ms in is where the cue frame starts):

| Animation | Frames, ms | Cues (ms in) |
| --- | --- | --- |
| idle (loop) | 16, 2000 | none |
| entrance | 10, 1310 | drop 0, thump 340, splat 690 |
| thinking (loop) | 16, 2080 | none |
| move | 6, 710 | thump 300 |
| capture | 12, 1100 | splat 0, giggle 430 |
| hurt | 7, 720 | oof 0 |
| check | 8, 950 | swish 100 |
| smug (loop) | 8, 1200 | none |
| rattled (loop) | 8, 640 | none |
| defeat | 6, 1550 | oof 0, flop 290 |
| victory (loop) | 12, 1320 | giggle 220, thump 660 |
| camouflage | 11, 1040 | dab 210, **splash 400** (the splash leaves the brush) |
| strike | 9, 920 | **drip 110** (the paint drips off the piece), thump 320 |
| repaint | 11, 1310 | **stroke1 210** (his pawn goes your color), **stroke2 670** (your knight or bishop goes his) |
| kingAttack (`SMUDGY_ATTACK`) | 32, 2780 | drop 200, land 360, flick 560 + 340 x i and splat 730 + 340 x i (the ten hits, on `kingAttackHits()`), cheer 2260, drop 2480 |

The bold cues are where the board art goes when he's wired in; the others are for his sounds, still to be made.

- **Idle:** he breathes (a pixel, twice a loop); his tail loosens (`curl` 1 to 0.82) and swings once a loop with a ripple
  running down it (`sway` to 0.5 radians, `swayPhase` going round) and is the approved still again on frame 1 (the
  amplitudes are zero there); his eyes swivel on their own (each looks its own way on frames 4-5, 7-8, 10-11 and 12-13)
  and blink once (frame 14); a drop of yellow runs off the brush. Frame 1 is the still pixel for pixel (a test checks it).
- **Entrance:** his shadow spreads; he drops in with the beret flying and the tail whipping up, lands (thump, dust, eyes
  shut), the beret bounces; then a flourish of the brush with a flick of paint (`splat`), a grin, and a sly look.
- **Thinking:** the brush up beside his head, a lid half down, his eyes rolled up (one looking another way now and then),
  the tail curling slowly, gold dots rising off his beret to its right, one more each beat.
- **Move / capture:** a crouch, a hop with the tail streaming and the beret lifting, a landing; a capture is a cheer: the
  brush waved over his head flicking yellow, joy eyes, a grin, the tail corkscrewing, the beret bouncing, gold sparkles.
- **Hurt / defeat:** a flash (every color pale), flecks off the brush, the beret pops off, knocked back with his eyes
  shut; he glares. In defeat the beret pops off, he reels, the tail uncurls and lies limp on the ground, the brush
  drops and he slumps with the beret fallen over his eyes (held a second).
- **Check / smug / rattled / victory:** he points the brush ahead with a sparkle and a grin, twice; leans back,
  half-lidded, grinning, one eye wandering; shakes with wide eyes, sweat flying and the tail wound tight; hops with the
  brush waving.
- **Camouflage's splash (`camouflage`, about as long as Alfil's Tusks cast, 1040 ms):** he dips the brush across his
  belly on the palette (raised to meet it; a sparkle at the dab), lifts it loaded, winds back over his head, and flings
  it (`splash`: the paint leaves the brush: a big blob and flecks up and to our left, his mouth open, the tail whipping),
  follows through laughing; then a **sly look**: one eye (the near one, half lidded) on you, the other wandering off;
  the brush loaded again.
- **The strike's reveal (`strike`, 920 ms):** he crouches with the tail wound tight and his eyes wide; the **tail snaps
  open** (`curl` 1 to 0.15 in 60 ms, the cue `drip` on that frame: the paint drips off the piece) while the beret leaps
  off his head and he laughs, brush up; the tail curls back, the beret lands (dust), a smirk.
- **Repaint's cast (`repaint`, 1310 ms; Alfil's Slam is 1360):** two strokes, each with the paint on the brush
  recolored by the frame's `pal` (keys `P`, `R`, `K` only: `PAINT_CREAM`, `PAINT_CHARCOAL`): the brush raised with
  **cream** paint, wound back, swung down to the lower left (`stroke1`) and held, flecks flying; the paint goes
  **charcoal** with a sparkle, wound back, swung again (`stroke2`) and held; a flourish with the paint back to yellow
  and a grin.
- **The paint tints: cream `#f1e8d2` (shade `#b5a98a`, light `#ffffff`) for your color, white's; charcoal `#30333a`
  (shade `#0f1013`, light `#6c727d`) for his, black's.** A plain white or black would lose the paint's shading and, on
  the dark stage ground, the charcoal one would vanish; these keep a highlight and read next to the pieces' own colors.
- **His attack on a king:** `SMUDGY_ATTACK`, in a frame 34 px wider on the left (the brush's reach) and 18 taller (he
  drops in): the shared beats (`KING_ATTACK`): he drops in beret flying, lands (`land`), then flicks the brush at the
  king ten times, **a blob of yellow paint just reaching the king's head at the end of a lob of drops on each flick**
  (cues `flick` and `splat` in turn: the cue frame is where the board splats it on the king's square, `paintHit`), the
  brush swung back up between flicks, the tail whipping each way. **His face is on the king throughout:** both eyes
  turned to him (`ON_KING`: each pupil forward and down), his head nodded and leaning toward him. He laughs, brush up,
  and they bound off; the last frame is empty. Facing our left as Sawyer's (`facesLeft` for his kit); suggested kit
  values when wired in: 36 frame pixels a square, `stand` 1.8, as Chub & Chirp's.
  The preview has no king, so `smudgy-king-attack.gif` is a mock-up drawn the way KingAttack.tsx places it: a stand-in king
  1.8 squares off on a strip of board squares (36 frame pixels each), the splat effect on his square at each hit.

## The tail, rigged

`tail(curl, sway, phase)`: walked along from his hip, its heading turning as it goes, so its length never changes. `curl`
1 is the spiral, 0 a loose hook, in between it winds up and lets go; `sway` and `swayPhase` are the ripple. It stays on the
ground (never below his feet) and inside his frame at every setting (a test measures the edge), and doesn't sink when he
crouches. Each distinct (`curl`, `sway`, `swayPhase`), rounded to 0.02, is a part made when first drawn.

## Calls made

- **The still is untouched:** idle's first frame is the approved one pixel for pixel (checked against the committed
  still, and a test keeps `idle[0]` equal to `smudgyLayers()`), and so is his frame (94 x 84).
- **His animations stay inside that frame** (nothing at its edge, a test checks every frame): the brush can't be flung
  further than 40 degrees to the left or the glob and flecks would leave it, so the splash's swing goes up and to the
  left and the board art takes the paint from there; his attack has the wider frame.
- **The wider box on a phone and the stage fit are as the still:** 68 px tall at rest, `wide` on a phone.

## The board art

`packages/app/src/characters/effects/smudgy.ts` (not registered in `effects.ts` yet; its header lists how each plays), in
his sprite's style: his yellow paint with the same three tones, dark outlines (`#2a1c06`, a brown that reads on every
square), light from the top left, flecks of red, blue and green from his palette so yellow never melts into a gold square.

- `paintSplash` (a square): `land<A|B|C>` (220 ms: it spreads, `splat`, droplets off its rim; ends on the held look),
  `hold<A|B|C>` (loop, a gleam moving on it), `fade<A|B|C>` (260 ms: it thins and goes). Three shapes, to use in turn along
  a row of pawns. **It covers the square (over 93 per cent of the middle where a piece stands: a test) so you can't see
  which piece is under it**, and is see-through only as it fades.
- `paintDrip` (a square): `drip` (470 ms, `drip` cue on its first frame): a band of paint across the top of the square, its
  drips running down and bulging, the last drops falling off; the piece shows through under it; ends empty.
- `brushStroke` (a square): `strokeC` (cream) and `strokeN` (charcoal) (340 ms, `swoosh` cue): a swoosh swept from the top
  left to the bottom right, thick in the middle with dry bristle streaks at its tail, flecks flying; it thins and goes.
- `paintFly` (loop): a blob of paint wobbling, from his brush to the board (the splash's flight).
- `paintHit` (`hit<H|L><L|R>`, about 200 ms, ends empty): a blob splatting on a king's head (high) or a little lower, from
  the left or right edge, then running (`hitAnims`, as the other bosses' hits).

Checked on a light and a dark square of each scheme (Classic, Green, Gold) at 40 px and at 3x (`board-art.png`): the
splash on Gold's yellow squares reads by its dark outline and the flecks; the cream stroke on a light square by its outline
and its shade. Not done: the paint staying on the pawns after the splash fades (the rules decide what stays), and
the flight of the Repaint's strokes.

## Tests

`packages/app/test/smudgy.test.ts`: the characters test's checks for him and his attack (palette, nothing cut off at a
frame's edge, a looping idle and cued one-shots), the first idle frame being the still, every animation's count and
length against the other bosses', the cue frames of the board art in order, the repaint's recolor touching only the
paint's keys (and no other part using them), the attack on the shared beats with a flick or splat cue on every hit, and
the board art's checks (palette, one-shots ending empty, the splash covering the square).

Preview: `npm run preview:characters -- <dir> extra=packages/app/src/characters/smudgy.ts only=smudgy,smudgy-attack`.
