# Boss art: boss-beaver

- Model claude-opus-5-5, effort high, adaptive thinking. 27 turns, 16 renders.
- Spend: **$2.09** of the $5 cap (58 input, 137,690 cache-write, 2,750,124 cache-read, 42,546 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-beaver/boss-beaver.ts.
- Previews: scripts/boss-art/out/boss-beaver/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-beaver/looks/.

## Its notes

I've added BOSS_BEAVER_ATTACK (id "timber-attack", name "Timber (his attack)") to the end of boss-beaver.ts. It spreads BOSS_BEAVER, so it uses his own parts and palette. His existing parts and animations are unchanged; the only edit above the new code is the KING_ATTACK import from packages/chess/src/boss-timing.ts. I couldn't open boss-timing.ts, so the times below assume the brief's numbers (landAt 470, lashAt 560, every 170 ms, 10 hits, leaveAt 2380, ms 2780). All frame times are worked out from KING_ATTACK, so they follow it if it changes.

Check this: the render tool only shows the file's first exported character, so to look at kingAttack I briefly removed "export" from BOSS_BEAVER. It's restored, and his own idle renders as before, but worth a look in the diff.

What I looked at: kingAttack frame by frame at 2x (and the face at 4x) on dark and light backgrounds, and its idle beside Big Boy. The hammer and plank stay inside the frame, and the last render gave no edge warnings.

FRAME AND FOOT: 110 x 108, foot at (62, 102). That's 22 px of room on the king's side (our left), 18 px above for the drop, and 2 px below so the landing shake stays inside. The idle is one still: him at rest.

HOW IT GOES (frame: ms):
- f0 0–103: empty, a small shadow.
- f1 103–202: empty, the shadow spreads.
- f2 202–291: he falls in from 18 px up, eyes wide, hammer raised off his belt, hat lifting.
- f3 291–381: 9 px up.
- f4 381–470: 3 px up.
- f5 470–560: lands with a squash, hammer wound up, sawdust puffs and dust at his feet, a shake.
- Hits 1–7 (f6–f19): a 90 ms hit frame on each beat (560 + 170·i), then an 80 ms wind-up for the next.
  - Whacks at 560, 900, 1240, 1580 come down on the king's head, with a steel swish arc.
  - Knocks at 730, 1070, 1410 swing across the king's middle, with speed lines.
  - Every hit has a small white impact burst and wood chips flung left.
- f20 1750: knock 8.
- f21 1840–1880: the hammer goes back on his belt as his far paw slides the plank out of its strap.
- f22 1880–1920: the plank drawn back like a bat.
- f23 1920–2010: hit 9, the plank swung flat into the king.
- f24 2010–2090: the plank raised up behind his head.
- f25 2090–2190: hit 10, the plank smashed down on the king's head (big arc, chips both ways, heavy shake).
- f26 2190–2250: he holds it there, grinning.
- f27 2250–2310: he hefts the plank across his chest.
- f28 2310–2380: slides it back into its strap.
- f29–f32 2380–2580: his beat, 50 ms a frame: a buck-toothed laugh, head thrown back with his jaw open, shoulders bobbing, a wink at the end.
- f33 2580–2640: crouch.
- f34 2640–2690: hops up 8 px.
- f35 2690–2740: 18 px up.
- f36 2740–2760: his shadow alone.
- f37 2760–2780: empty.

CUES (frame @ ms):
- swoosh f2 @202 (he drops in)
- thump f5 @470 (landing)
- whack f6 @560, knock f8 @730, whack f10 @900, knock f12 @1070, whack f14 @1240, knock f16 @1410, whack f18 @1580, knock f20 @1750 (hammer hits)
- slide f21 @1840 (plank out)
- whack f23 @1920 (plank bat swing)
- thump f25 @2090 (plank smash)
- slide f28 @2310 (plank back in)
- chitter f29 @2380 (his laugh)
- hup f34 @2640 (he hops off)

FOR THE KIT:
- perSquare 40: he's about 80 px tall with his hat, so he stands about 2 squares, close to Big Boy's 1.9 at 36. At 36 he'd tower over Big Boy.
- stand 1.15: the hammer head lands about 1.1 squares from his feet and the plank's end about 1.3. At 1.15 the hammer hits the king's middle and his paw stays clear of the king's edge.
- facesLeft: true (the king on our left, his hammer paw's side).
- Hit effect (for code to draw): wood chips and sawdust bursting off the king's square with a short white flash, like Sawyer's sawItem in wood colours (#f6d38e, #e0aa5c, #b47b36, #7e5222, sawdust #e8d2a4).
  - Chips spray up and out for the whacks (hits 1, 3, 5, 7).
  - Sideways from the side he hits for the knocks and the plank bat (hits 2, 4, 6, 8, 9).
  - A bigger splinter burst for the plank smash (hit 10).

CHOICES YOU MIGHT WANT TO CHANGE:
- I kept his usual hammer size, so a hammer hit is small at phone size. The swish arcs and speed lines carry them, and the plank hits are the big ones. A bigger cartoon hammer would be a new part.
- No tail slap: his tail is rooted behind him and can't reach the king without a new tail part. The plank bat and smash take its place.
- The plank swap is two quick 40 ms frames.
- There's an extra "slide" cue at 1840, between hits 8 and 9.
- At f27 the plank is hefted across his chest rather than resting on his shoulder.
