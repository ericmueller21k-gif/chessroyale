# Timber's art run, Nov 1

Eric approved the spend today: about $8–10, capped at $15. Both runs used Opus 5.5 at effort high, both called `done`, and
the total was **$7.14**.

| Run | Cap | Spent | Turns |
|---|---|---|---|
| Timber's full set (`boss-beaver`) | $9 | $4.76 | 44 |
| The woodpecker foreman (`sidekick-beaver`) | $6 | $2.38 | 31 |

- **Timber's idle is unchanged.** All 24 frames were checked pixel for pixel against the approved drawing, and none differ.
- **Files:** each drawing, `summary.md` (its maker's notes) and `log.jsonl` (the turn log) are in its own folder. The idle
  run's summary is kept as `boss-beaver/summary-idle.md`. The briefs are `briefs/boss-beaver-anims.md` and
  `briefs/sidekick-beaver.md`.
- **GIFs:** `boss-beaver/gifs/` and `sidekick-beaver/gifs/`.
- **Comparisons at phone size:**
  - `boss-beaver/comparison.png`: Timber beside Sawyer and the tiger.
  - `sidekick-beaver/comparison.png`: the woodpecker beside Timber and Sawyer's and Puddles' sidekicks.

## Timber (`boss-beaver`): 17 animations
- **idle**: as approved. He breathes, blinks and his tail pats.
- **entrance**: he drops in and lands with a stomp. He straightens his hat, twirls the hammer, taps it and puts it back.
- **thinking** (loop): a paw on his chin, then he shuts one eye and sights along the board. His tail taps.
- **move**: hammer off the belt, a point and a tap at the board, then the hammer goes back.
- **capture**: a wind-up and a hammer whack with chips flying, then he holds the hammer up proudly.
- **hurt**: a flash and a shake knock his hat askew. He glares gruffly and straightens it.
- **check**: he points the hammer at the board, brows down, jabs once and grins.
- **smug** (loop): hammer on his shoulder, a toothy grin, a wink.
- **rattled** (loop): he shakes and sweats, his tail twitches and his hat slips.
- **defeat**: his hat flies off, his tools spill, he sits down hard, dazed, with stars round his head. The last frame holds.
- **victory** (loop): hammer high, hopping, tail slapping, chips falling like confetti.
- **scrap** (the Workshop): a scrap drops in from the upper left. He catches it, sets it in place and hammers it twice (cue `tap` x2).
- **build** (the Workshop): he pulls a plank off his back (`pull`), shows it off (`show`) and swings it down to the
  board (`drop`), then slides it back into its strap.
- **gnawWarn** (loop, the warning before the Gnaw): teeth bared, eyes gleeful. He licks his lips and clacks his teeth (`clack`).
- **gnaw** (the ultimate): four big buck-tooth chomps with splinters flying (`chomp` x4), a satisfied chew, then a burp of
  sawdust (`burp`).
- **cheer**: a proud nod (for a piece he built landing).
- **bigCheer**: a hop with the hammer high and two tail slaps (for his queen).

## The woodpecker foreman (`sidekick-beaver`): 14 animations
It wears a tiny orange hard hat and an orange safety sash. It has a red crest, a big eye, a chisel beak, and a short
plank standing beside it. It is 48 px tall, about 60% of Timber.
- **idle**: it blinks, then pecks the plank rat-a-tat (`tap`) with its hat jiggling askew, nods and pushes the hat straight.
- **walk**: quick hop-steps with its head bobbing.
- **sit**: on a stool with its feet swinging, and a thoughtful peck at the air.
- **wave** (the tap reaction): two wing flaps and two hello pecks, then it settles.
- **The usual beats**: entrance, thinking, move, capture (an eight-peck rat-a-tat), hurt, check, smug, rattled, defeat
  (dizzy, the hat over its eyes) and victory.

## Open choices for Eric
1. **Timber's attack on a king** (`BOSS_BEAVER_ATTACK`, like the gardener's) wasn't drawn. The runner can't import the
   shared `KING_ATTACK` timings, so it's left for when he's wired into the game.
2. **Little headroom:** Timber's frame stays 88×88 so the idle stays exact. His hops are only 2–3 px, and a raised hammer
   sits beside his hat, not above it. The frame can be made taller when he's wired in.
3. **A half pixel:** in the approved file, his far paw's rest point is at x 46.5. It renders fine in the preview, but
   rounding it moves the paw one pixel. This was left alone so the idle stays exactly as approved.
4. **Edge pixels:** a few hammer points and flying chips touch the frame's edge in some animations.
5. **The woodpecker's plank** stands beside it in every animation except walk and sit. It's one flag per pose if Eric
   would rather it showed up only sometimes. It never carries the plank.
6. **The woodpecker has one eye** (a near-profile view), to keep its face clean at phone size.
7. **New cues** (`tap`, `chomp`, `clack`, `burp`, `pull`, `show`, `drop`, and others) don't have sounds yet.
