# Chub & Chirp's animation pack and the carrot art (Oct 18, 2026)

**Eric** approved the still ("chirp is good to go love it") and asked for the animations as GIFs, his king attack
(Chub pelts the God King with carrots), his own moments (the Leapfrog hop, the Carrot Patch cast, winning and losing
the carrot race) and the carrots on the board, "matching the quality of sprite style … so it doesn't look out of
place". Still not wired in: he isn't in `CHARACTERS`, `BOSS_KITS`, `KING_ATTACKERS` or the roster, and the rules are
built separately (`claude/hopper-rules`).

## His animations

`packages/app/src/characters/hopper.ts`. Every pose is numbers on his parts (`HopperPose`), as Alfil's and Hollow's
are. New numbers: the rabbit's eye (`mood`: open, blink, joy, shut, wide, smug, up, aim, out, sad), the grasshopper's
(`bugEye`: open, shut, joy), the rabbit's head nod and lean (his ears ride it), his near elbow (it bends by itself when
left out) and a carrot in his near paw (`carrot`: its angle, held near its top or held up by its tip). The leg poses
(`LAUNCH`, `FLY`, `TOUCH`, `REAR`, `SPLAY`), ears (`EARS_BACK`, `EARS_UP`, `EARS_DROOP`, `EARS_BENT`), scarf (`STREAM`,
`LIMP`) and paws (`IN_SATCHEL`, `WOUND`, `THROWN`, `HELD_UP`, `AT_CHIN`, `POINTING`) are sets of those numbers. No new
hand-drawn frames: the eyes are a few typed pixel rows each, like Alfil's.

Frame counts and timings follow Alfil's and Hollow's:

| Animation | Frames, ms | Cues (ms in) |
| --- | --- | --- |
| idle (loop) | 16, 2000 | none |
| entrance | 10, 1310 | chirp 0, thump 340, squeak 690, chirp 850 |
| thinking (loop) | 16, 2080 | none |
| move | 6, 710 | thump 300 |
| capture | 12, 1100 | squeak 90, chirp 430 |
| hurt | 7, 720 | oof 0 |
| check | 8, 950 | chirp 100 |
| smug (loop) | 8, 1200 | none |
| rattled (loop) | 8, 640 | none |
| defeat | 6, 1550 | oof 0, flop 290 |
| victory (loop) | 12, 1320 | chirp 220, thump 660 |
| leapfrog | 11, 1080 | **takeoff 210** (the pawn leaves its square), **land 540** (it comes down beyond yours) |
| carrotPatch | 19, 1470 | **toss1 200, toss2 410, toss3 620, toss4 830, toss5 1040** (each carrot leaves his paw), **plant1 500, plant2 710, plant3 920, plant4 1130, plant5 1340** (each lands on its square) |
| raceWon | 9, 1000 | cheer 180, chirp 510 |
| raceLost | 5, 1000 | sigh 0 |
| kingAttack (`HOPPER_ATTACK`) | 32, 2780 | hop 200, land 360, toss 560 + 340 x i and bonk 730 + 340 x i (the ten hits, on `kingAttackHits()`), cheer 2260, hop 2480 |

The bold cues are where the board art goes when he's wired in. The others are for his sounds, still to be made.

## Calls made

- **Idle's first frame is the approved still, pixel for pixel** (checked against `27504d3`): the new layers (a carrot
  in his paw) go under his near arm, and the reins stay over it as before.
- **One flight time for the cast's carrots: 300 ms** from `toss<n>` to `plant<n>` (the board flies `carrotFly` from his
  paw to the square between the two). He tosses one every 210 ms, so each lands two bounds later while he keeps
  tossing; the cast is 1470 ms, Alfil's Slam 1360.
- **The cast's bounds are in place**, the bound's height (6 px) inside his frame's 14 empty rows. Each bound: down, his
  paw in the satchel (a carrot's top showing); up, the carrot held over his head; at the top, thrown forward.
- **Leapfrog** is a crouch back on his haunches, a hop forward (2 px back, 5 forward, 9 up at the top) and two small
  steps back to his place, so he ends where he stands.
- **Winning and losing the race are their own short beats** (1 s each), not smug and rattled: holding a carrot up and
  the ears drooping are what Eric described, and both are a few numbers.
- **Held up high, the carrot comes down to his ear when they're in the air** (victory), so it stays inside his frame.
- **His attack faces our left, as Sawyer's** (`facesLeft` for his kit): the king to his left, the board mirroring the
  whole figure when the king's on the other side. **He looks at the king throughout:** his `aim` eye (a set brow, the
  pupil forward and down, the white behind it), his head nodded 2 px down toward the king and leaning in, ears up,
  in every throw and every reload; only the cheer at the end looks up. A frame 34 px wider on the left (the carrots'
  lob) and 18 taller (they drop in). Suggested kit values when wired in: 36 frame pixels a square, `stand` 1.8, like
  Boingo's throw. Each throw draws the carrot just reaching the king's head at the end of a lob of speed lines; the
  board's `carrotHit` bonks it on his square.
- **No Last Stand from the game:** `frames:king-attack` needs him in `KING_ATTACKERS` and his kit. The preview's
  Last Stand GIF is a mock-up drawn the way `KingAttack.tsx` places it (the God King's `lastStandAttacked` on his
  square, Chub & Chirp 1.8 squares off at 36 frame pixels a square, a bonk on each hit), on a corner of the board.

## The carrot art

`packages/app/src/characters/effects/hopper.ts` (not registered in `effects.ts` yet; its header lists how each plays):

- `carrotPatch` (a square): `plant` (lands: the soil heaps round it, crumbs fly; `thunk`; 270 ms), `planted` (loop:
  its leaves sway, a glint now and then), `pull<W|B>` (it pops out of the soil, wobbles and goes in a sparkle; `pop`;
  480 ms) and `claimed<W|B>` (the dug hole and loose soil, and in the square's bottom-right corner the side's token:
  a white or black disc with a little carrot on it, peeking out beside the piece standing there).
- `carrotFly` (a tumbling carrot for the flight), `carrotHit` (`hit<H|L><L|R>`, about 200 ms: a white star where it
  bonks the king, the carrot bouncing back off), `carrotIcon` (14 x 14: `icon`, and `slot`, the same carrot dim, for an
  empty place in the dock's count).
- The planted carrot shows its five leaves and the top of its shoulder above a low mound of soil, lit from the top
  left with the boss's own orange and the grasshopper's greens, dark outlines all round so it reads on the light and
  the dark squares at a phone's 40 px.
- **The side's mark is a token, not a tint**: a piece stands on the square from the moment it's claimed, so a tint
  would hide under it; the token sits in the corner the pieces leave free, as the Last Stand's badge does.

## Tests

`packages/app/test/hopper.test.ts`: the characters test's checks for him and his board art (palette, nothing cut off
at a frame's edge, a looping idle and cued one-shots), the Leapfrog's cues in order, the cast's ten cues and 300 ms
flights, its length against Alfil's Slam, the attack on the shared beats with a throw on every hit, and each pull
ending on its side's claimed look.

Preview: `npm run preview:characters -- <dir> extra=packages/app/src/characters/hopper.ts only=hopper,hopper-attack`.
