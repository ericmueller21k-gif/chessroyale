# Ride sounds

Each ride's moving loop (Nov 14; `ride-sound.ts`, `RIDE_SOUND` in settings.ts). Made in code, no samples, by
`scripts/reel/music/rides.py --game <folder>` on branch `claude/trailer-v2` (files from `stills/trailer-v2`, commit 563afd02).
Mono WAV, 24 kHz, 16 bit, 1.2 s: one loop of exactly 1 s with 0.1 s of itself either side (loop 0.1 to 1.1 s), already low-passed.

| File | Ride | What it is |
|---|---|---|
| sawyer-dozer.wav | Sawyer's Dozer | a diesel's chug: twelve firings a second, its exhaust, the tracks ticking |
| boingo-pogo.wav | Boingo's Pogo | not a loop since Nov 15: its loop's 4 boings (low, mid, low, high) as one-shots back to back, 0.245 s each (cut from 2 ms before each boing's start, a 6 ms fade at its end), 0.98 s; one plays on each square you step (`RIDE_SOUND`'s `boings`) |
| puddles-mower.wav | Puddles's Mower | a small engine's putter (Eric picked the second of two sketches, Nov 15); commit 4390fa84 |
| ginger-sled.wav | Candy Cane Sled | jingle bells, shaken: three shakes a second, each a knock on three bells and the pellets rattling on (Eric, Nov 15: "Bells are good to go yes"); 48 kHz and not low-passed, as four fifths of a jingle bell is above 8 kHz, so it plays round the game sounds' 6 kHz softening (`bright`); commit 1bf323b6 |
