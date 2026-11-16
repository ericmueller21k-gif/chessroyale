# Rides: a moving sound, on two rides first (Nov 14, 2026)

**Eric (via the music session):** "when you move around ... it sounds like ... a little bulldozer moving ... I don't think we need an
idle ... just like a moving sound ... one continuous sound"; "test this on two of them here, and then we'll kind of go more"; "when you
stop moving, it doesn't just like instantly stop ... it kind of fades over like a second or whatever ... I guess we'll have to test it."

**What changed.** Sawyer's Dozer and Boingo's Pogo (`/sounds/rides/<id>.wav`, made on `stills/trailer-v2`, 563afd02) loop while your own
pawn moves on them, in the town and in a shop's room; standing, nothing; any other ride silent. `ride-sound.ts`; every number is
`RIDE_SOUND` in settings.ts (level 0.3, hold 120 ms, fade in 60, fade out 700 dozer / 350 pogo, the dozer's speed 0.8 → 1 over 300 ms,
sinking to 0.88 as it fades). Moving again mid-fade comes back up from where it is.

**Calls made**
- Which ride is which: a ride has a sound when its item id (crates.ts) is a key of `RIDE_SOUND.rides`; its file is named by that id. The
  loop points (0.1 to 1.1 s) are the README's shape for every ride's loop, so they're fixed in `ride-sound.ts`, not a setting.
- The frame loops only say "you moved, on this ride" on moving frames; a timer off the frame sees the steps stop. So a loop that halts
  (the town closing into a game, a hidden tab) fades it the same way, with no separate stop call to forget.
- The Sound switch or a hidden page: out in 30 ms (not the ride's fade), as every other game sound stops being heard at once.
- On the game's sounds (`gameBus`: the master, through the 6 kHz softening), not the music's bus: the README asks for the game's.
- Fetched and decoded after the town's first frame (your ride's), never in its loading (#709); a ride put on later loads on its first move.
