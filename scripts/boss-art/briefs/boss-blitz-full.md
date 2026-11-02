# Blitz, the speed-chess cheetah: his full animation set (Eric approved him, Nov 1)

Eric chose Blitz and loves the concept drawing: "the picture you drew of him is perfect". **Your file,
`scripts/boss-art/out/boss-blitz/boss-blitz.ts`, already holds him: read it first.** It's the approved concept: the look
(palette, parts, proportions, colors, face) and the `idle` animation must stay exactly as they are. **Extend it, never
redraw it:** add animations with `edit_drawing` (new pose fields in the rig if you need them, new parts after the
existing ones, new animations after `idle`), and add them to `anims`. Don't use `write_drawing` on the whole file
unless you keep every existing line of the look and the idle unchanged. Keep the id "boss-blitz" and the export name.

**Never base him on, name or hint at a real person.** No letters or numbers anywhere (the clock shows ticks, never numerals).

## Who he is
A cocky speed-chess hustler from the park tables: lanky, restless, a showman, friendly-cocky, never mean. He never
"thinks": his moves come instantly. Fast guy: everything he does is quick, snappy and flashy, with clear held poses so
it reads at phone size.

- **Passive, Clock Slap:** when he captures a piece he slaps the clock and steals time.
- **Ultimate, Time Scramble:** a warning turn, then the player's next 5 moves get 3 seconds each. (The big countdown
  clock over the board is drawn by the game's code, not here.)

## The animations to add (the finished bosses' set, plus his powers)
Look at a finished boss for how many frames and how long each runs: `packages/app/src/characters/tiger.ts` (the circus
tiger) and `gardener.ts` (the hippo gardener): idle, entrance, thinking, move, capture, hurt, check, smug, rattled,
defeat, victory, plus their power animations. One-shot animations end on a pose that returns cleanly to the idle.
- **entrance** (once, about 1.5 to 2 s): he zips in in a blur of speed lines, skids to a stop, slaps the clock, grin.
- **thinking** (loops): he never really thinks: impatient, bouncing faster, drumming his fingers over the clock's
  button, glancing at us, a little yawn or eye-roll. Restless, not pensive.
- **move** (once, short, about 0.6 to 0.9 s): a quick, flashy gesture: a snap-point or a finger-gun toward the board
  (our left) with a speed streak, then a quick slap of the clock.
- **capture** (once): pleased, a quick fist pump or a wink, a slap of the clock.
- **clockSlap** (his passive, Clock Slap, once, about 1.2 s): a big, satisfied, wind-up slap on the clock: paw high,
  slams down, big click sparks, the flag jumps, a smug grin and a little "stolen time" flourish (a tiny clock-hand
  swirl or sparkle zipping from the clock to him). Bigger than the idle's slap.
- **scrambleWarn** (the ultimate's warning, once, about 1.5 s; can be held on its last frame): he holds the clock up
  toward us, taps it meaningfully, eyebrows up, a sly wide grin: "watch this".
- **timeScramble** (the ultimate itself, once, about 2 s): he goes into a frenzy: hammering or spinning the clock in a
  blur of speed lines, arms a blur, fur and cap ruffled, sparks flying, ending with a triumphant last slap and pose.
- **hurt** (losing a piece, once): a startled flinch, ears back, eyes wide, the clock jolts; he recovers fast.
- **check** (he gives check, once): a cocky point at the board and a slap.
- **smug** (loops, he's winning): leaning back, half-lidded, idly spinning the clock or polishing his nails on his jacket.
- **rattled** (loops, he's losing): sweaty, ears flat, fast nervous taps on the clock, glancing at it.
- **defeat** (once, then holds): the flag falls, he slumps, cap slips over his eyes, clock drooping.
- **victory** (once, then holds or loops gently): a big showman pose: clock raised overhead, a grin, speed sparkles.

Keep the canvas size (72 wide) unless a pose truly needs more; if you must widen or heighten it, keep his feet at the
same ground line and his idle pixel for pixel. Look at every animation at 4x and the idle at phone size beside another
boss before calling done; note in your notes each animation beat by beat and the choices Eric might want to change.
