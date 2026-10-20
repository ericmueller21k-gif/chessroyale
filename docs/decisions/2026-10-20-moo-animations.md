# Moo & Moon's animation pack and board art (Oct 20, 2026)

**Eric** approved the stills (`2026-10-20-moo-still.md`) with one quick fix, and asked for the animations and the board art as
GIFs. The fix: in the powered-up form the glowing white eye on our left blended into his yellow face, so it has **a brown
patch round it** (`eyePatchF`, a part drawn over the head in the powered-up pose: `POWERED.patchF`), like the cow's eye
patch in the normal form; both glowing eyes read now. Nothing else of the three stills changed: `idle`'s and `sit`'s first
frames are the approved pixels (checked against the committed stills, and a test keeps them the poses), and `power` differs
only by that patch.

Still not wired in: he isn't in `CHARACTERS`, `BOSS_KITS`, `KING_ATTACKERS` or the roster, and his rules (Moonbeam, Full
Moon) are built separately. `packages/chess` is untouched.

## What changed in the code

`packages/app/src/characters/moo.ts`. Every pose is numbers on his parts (`MooPose`, `mooLayers(pose, "hug" | "sit")`), as
the other bosses'. New since the stills:

- **His body:** `bob` (a crouch; his feet stay on the ground; sitting, he sinks into the boat), `gaze` (where his pupils
  look), `mouth` (`smile`, `open` to moo, `chew`: parts over the head's smile), `eyes` (`open`, `shut`, `glow`, `joy`,
  `half`), `brows` (`none`, `angry`, `worry`), `patchF`.
- **The moon:** `moonT` (how far it has come from held, 0, to a boat under him, 1: it turns, grows and slips down, each step a
  part made when first drawn, its face moving with it), `moonBack` and `moonFront` (behind him, or over his head when it
  bumps him), `moonEyes` (`happy`, `open` and looking about by `moonGaze`, `flat` as it blinks), `moonMouth` (`smile`,
  `open`, `o`, `flat`, `frown`) and `moonGlow` (0 to 3: a soft glow round it, over him, and its yellow brightening by the
  frame's `pal`, so a frame can say how full it is).
- **The aura** is made for each pose's own outline as before, now with a size (`auraSize`, 0 to 1: how far the glow reaches and
  how high the flames stand), so it can flare on and fizzle out.
- **Frame:** 74 x 108 (30 rows of headroom above him, 8 below his feet: nothing of a frame's edge is touched with the shakes
  and dust). His still is drawn exactly where it was. His attack's frame is 40 px wider on the left (114 x 108).
- **Specks:** moonlit sparkles, dust, sweat, thoughts (moonlit dots, then a pawn: `MOO_ICONS.pawn`'s pixels drawn on the frame
  by `iconSpecks`, in keys of their own so the palette's pink and cream aren't touched), the Zzz of `MOO_ICONS.zzz` over his head
  when dazed, motes of the moon's light flowing into him, rays round the moon as it fills.

## His animations

Every animation the other bosses have, with the moon reacting too, and his own. Frame counts and timings follow Alfil's and
Smudgy's (ms in is where the cue frame starts):

| Animation | Frames, ms | Cues (ms in) |
| --- | --- | --- |
| idle (loop) | 16, 2000 | none |
| sit (loop: sitting, floating) | 8, 2000 | none |
| entrance | 10, 1310 | drop 0, thump 340, moo 690 |
| thinking (loop) | 16, 2080 | none |
| move | 6, 710 | thump 300 |
| capture | 12, 1100 | moo 430 |
| hurt | 7, 720 | oof 0 |
| check | 8, 950 | moo 100 |
| smug (loop) | 8, 1200 | none |
| rattled (loop) | 8, 640 | none |
| defeat | 6, 1550 | oof 0, flop 290 |
| victory (loop) | 12, 1320 | moo 220, thump 660 |
| toSit (hug to sit) | 8, 740 | slip 100, plop 530 |
| toHug (sit to hug) | 8, 740 | hop 120, catch 370 |
| **moonbeam** (passive) | 11, 1040 | hum 80, **beam 350** (the beam starts falling from the sky), moo 450 |
| **fullMoon** (the transformation) | 14, 1340 | swell 0, **swap 480** (the colors go gold, the aura flares on), moo 780 |
| powerIdle (loop, powered up) | 6, 660 | none |
| **flurry** | 14, 1430 | gather 0, charge 290, **beam1 380, beam2 500, beam3 620, beam4 740, beam5 860** |
| **dazed** | 11, 1250 | fizz 0, **calm 280** (back to normal colors) |
| kingAttack (`MOO_ATTACK`) | 32, 2780 | drop 200, land 360, **beam 560 + 340 x i** and **shine 730 + 340 x i** in turn (the ten hits, on `kingAttackHits()`), moo 2260, drop 2480 |

- **Idle:** he breathes (a pixel, twice a loop), his ears flop and his tail swishes (the first frame is the approved still),
  and the moon looks about curiously: open eyes wandering to the board, up, back to him, a word, a blink, then happy again;
  twice he nuzzles it, his eyes shut (frames 11-14).
- **Sit:** the boat bobs a pixel, he nods, his ears and tail sway, the moon looks about and blinks (frame 1 is the approved sit).
- **toSit:** the moon gasps (frame 1), slips out of his arms (`slip`: he opens them, it drops and turns toward a boat), he
  hops up as the boat slides under his feet (it is behind him now), and drops onto it, sitting, with a bounce (`plop`) and a
  giggle. `toHug` is the same the other way: he hops up, the moon turns back into a crescent and he catches it (`catch`).
- **Entrance:** his shadow spreads; he drops in hugging the moon (the moon gasping, his ears flying), lands (thump, dust, eyes
  shut), bounces; then he lifts his head and moos (`moo`), the moon chattering, and settles with a smile.
- **Thinking:** he chews, his eyes up toward the board, ears and tail easing; the moon glances at the board, its mouth a line
  (an "o" once); a thought rises off his head: three moonlit dots, then a pawn.
- **Move / capture:** a crouch, a hop with the tail up and his ears flying, a landing (dust); a capture is a cheer: moos,
  hops, ears flapping, the moon laughing, sparkles.
- **Hurt / defeat:** a flash (every color pale), knocked back with his eyes shut and his ears flung, the moon gasping, then a
  glare. In defeat the moon slips out of his arms and he drops onto it, sitting, and slumps, his head down and his ears limp,
  the moon looking at him, worried (held 730 ms).
- **Check / smug / rattled / victory:** he points his snout at the king and moos, the moon glowing and looking too, twice; head
  back, heavy-lidded, one eye wandering, the moon snickering; shaking, sweat flying, the moon gasping; hops, mooing.
- **Moonbeam (1040 ms, as long as Alfil's Tusks cast):** the moon starts to glow and looks up (`hum`), he lifts his snout to the sky,
  ears back, eyes shut, and moos (`beam`: the beam falls from the sky onto your piece; `moo`), the glow holding with rays
  and sparkles round the moon, then easing off.
- **Full Moon (1340 ms, about as long as Alfil's Slam cast):** the moon brightens to full (`swell`: a word, a laugh, rays), motes
  of its light flow into him, he flashes white, then flickers gold (`swap`: his colors swap, his eyes glow, the aura flares
  on, with a shake), flickers once more, growls, and a big **MOO** (`moo`: head up, mouth open, ears straight up, the aura blazing
  in turn), settling powered up. The Moon stays happy throughout.
- **Powered idle:** the aura flickering through its three variants, breathing hard, the moon's glow on.
- **The flurry (1430 ms):** powered up, he crouches (`gather`), the moon leaves his arms and rises over his head (it needs the
  headroom), glowing brighter; `charge`, then it fires five times, a frame each, 120 ms apart (`beam1` to `beam5`): each shot
  kicks the moon (its mouth an "o", sparkles) and Moo roars, the aura flaring; all five stand together a moment (140 ms, the
  last frame the board fades them from), the moon comes back down into his arms.
- **Dazed (1250 ms):** the aura fizzles in three steps (`fizz`), he flickers back to himself (`calm`: the colors swap back),
  wobbles with his eyes shut and a **Zzz** (`MOO_ICONS.zzz`) rising over his head, and the moon floats up and bumps him twice (it
  is in front of his head for those frames); he comes round.
- **His attack on a king:** `MOO_ATTACK`, in a frame 40 px wider on the left, on the shared beats (`KING_ATTACK`): he drops in
  hugging the moon (`drop`), lands (`land`), then the moon shines **a small moonbeam at the king nonstop**: ten, a white core
  with a pale shaft and a blue rim drawn as specks from the moon's edge to the king's head (`KING_AT`: high, then a little lower
  in turn), a frame of beam and a frame of eased glow each (cues `beam` and `shine` in turn on the beam frames: the board flashes
  `moonHit` on the king's square there); **both of them are looking at the king** (his eyes and the moon's turned to him,
  his brows down) and he mutters one `moo` at the end; they float off. Suggested kit values when wired in: facing left, 36
  frame pixels a square, `stand` 1.8, as Smudgy's. The preview has no king, so `moo-king-attack-mock.gif` is a mock-up
  with a stand-in king 1.8 squares off on a strip of squares, `moonHit` on his square at each cue.

## The board art

`packages/app/src/characters/effects/moo.ts` (not registered in `effects.ts`; its header lists how each plays), in the moon's
colors: a white core, a pale silver-blue shaft with a deeper blue edge and a **dark blue outline** (`#232d6b`) so it reads on
the light squares as well as the dark ones, a soft see-through glow round it and a few sparkles. A lunar Kamehameha, not a
UFO's tractor beam.

- `moonbeam` is **a column eight squares tall** (32 x 256 frame pixels): its bottom square is the target square, the rest the
  sky above it (place it with its bottom on the square, let the board clip what's above its top edge; the shaft fades to
  nothing toward its top). `fall` (220 ms, cue `beam`: the sound; a bright head races down the shaft, the shaft ablaze behind it,
  the square's pool of light waking), `hit` (240 ms, cue `hit`: the flash; a white flash over the square with a ring of light
  and sparkles), `hold` (loop, 680 ms: the shaft thin and faint, the square softly lit with a bright blue edge and a little
  crescent in its corner), `fade` (300 ms, ends empty).
- **The stunned mark** is `hold`'s square: the glow, the blue edge and the little crescent. All of it is see-through (a test
  checks the square's middle has no opaque pixel), so you can see which piece is stunned and what is on it; the held glow
  was enough, no other mark is drawn.
- **The flurry** is the same column on five squares: start each one's `fall` `FLURRY_STAGGER_MS` (120) after the last, which is
  how far apart the moon's cues `beam1` to `beam5` are (a test keeps the two equal), let them all reach `hold` together, then play
  every `fade` at once.
- `moonHit` (`hit<H|L><L|R>`, about 200 ms, ends empty): the small beam landing on a king's head (high) or a little lower:
  a flash, a ring of sparkles, motes, as the other bosses' hits (`hitAnims`).

Checked on a light and a dark square of each scheme (Classic, Green, Gold) at 40 px squares and at 3x (`board-art.png`, with the
`moonbeam.gif` and `moon-flurry.gif` on a board). The shaft's dark outline carries it on the light and the gold squares, its white
core on the others; the held glow reads by its blue edge on all three. Not done: what stays on the board between a beam's
hold and the next turn (the rules decide), and the sounds.

## Calls made

- **A taller frame:** the entrance drops him in from above and the flurry raises the moon over his head, so his frame has 30
  rows of headroom (Smudgy's has 12). The select stage and the boss bar place him by his feet and his idle's top row, which
  are unchanged; the bar's box may want its `tall` flag when he's wired in (to check on a phone).
- **Width:** the sit fits the phone bar's usual box (24 each side of his feet), the idle and the powered-up stills need `wide` (26
  left in the idle since the ears match). The powered-up animations' glow and flames reach 34 left and 32 right, past `wide`;
  clip them or give them room when wired in.
- **The powered-up moves:** only `powerIdle`, `fullMoon`, `flurry` and `dazed` are drawn in the powered-up form. For his
  other moves at full strength the kit can play the normal ones, or a `looks` entry for `MOO_POWER_PALETTE` could recolor any of
  them (a gold cow without the glowing eyes and the aura): not added, for Eric to decide.
- **Moon glow and the frames' `pal`:** the moon's yellow brightens through the frame's `pal` (keys `M N O P Q`, no other part
  uses them), so a frame can say how full it is, as Smudgy's paint; a powered-up frame's `pal` merges the powered-up palette first.
- **Icons as specks:** the pawn and the Zzz are drawn on frames from `MOO_ICONS`' pixels, in keys the palette has for them
  (`l m o`, `Z A B`), with their dark outline; the moo, hearts and the others are not used in the pack.

## Tests

`packages/app/test/moo.test.ts`: the characters test's checks for him and his attack (palette, nothing cut off at a frame's
edge, a looping idle and cued one-shots), the first idle and sit frames being the poses, every animation's count and length
against the other bosses', the cue frames of the board art in order (moonbeam, the swap, the five beams 120 ms apart, dazed's
`calm`), the attack on the shared beats with a beam on every hit, the icons, and the board art's checks (palette, one-shots
ending empty, the held glow see-through). Run alone: `npx vitest run packages/app/test/moo.test.ts`.

Preview: `npm run preview:characters -- <dir> extra=packages/app/src/characters/moo.ts only=moo,moo-attack scale=3`.
