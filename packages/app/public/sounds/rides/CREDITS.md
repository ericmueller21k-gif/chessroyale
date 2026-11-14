# Ride sounds

Each ride's moving loop (Nov 14; `ride-sound.ts`, `RIDE_SOUND` in settings.ts). Made in code, no samples, by
`scripts/reel/music/rides.py --game <folder>` on branch `claude/trailer-v2` (files from `stills/trailer-v2`, commit 563afd02).
Mono WAV, 24 kHz, 16 bit, 1.2 s: one loop of exactly 1 s with 0.1 s of itself either side (loop 0.1 to 1.1 s), already low-passed.

| File | Ride | What it is |
|---|---|---|
| sawyer-dozer.wav | Sawyer's Dozer | a diesel's chug: twelve firings a second, its exhaust, the tracks ticking |
| boingo-pogo.wav | Boingo's Pogo | a spring's boing on every bounce, four a second, a little tune in their pitches |
