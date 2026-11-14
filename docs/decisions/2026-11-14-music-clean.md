# The boss music plays clean: no low-pass, no break when the sound is rebuilt (Nov 14, 2026)

Eric (Nov 14 playtest): "it sounds much lower quality... I played the song in the Claude desktop, it plays so much more cleanly and
clearer... we can't compromise on these songs." And in the Hidden Boss's second form, a few minutes in: "all of a sudden it froze,
stopped for a second, and then it was almost like it restarted at a different part." He switches windows a lot while testing.

- **Muffled: the low-pass.** Every sound, the music too, went master → a 6 kHz low-pass ("gentle on phone speakers") → the
  speakers. That cuts a song's cymbals, air and consonants. The music now has its own gain straight to `ctx.destination`
  (`musicOut` in sound.ts, at the master's 0.9), still under the Music and Sound switches (music.ts `level()`). The game's sounds
  keep the low-pass. The files' bitrate (mono 64 kbps since Nov 12) isn't part of this: the songs' maker re-renders them.
- **The break: the rebuild.** The loop seams are exact (the loop's end matches its start, best lag 0 ms), so it wasn't the files.
  Back in the window after 2 s or more away, the next click rebuilds the audio context (`markStale("away …")`). The old context
  was closed at once, cutting the music, and the new one started after `startDelayS` plus however long the new context took to
  open the device (heard as "stopped for a second"). Since #691 it picked the song up by the wall clock, but from when it was
  asked, not when it was heard.
- **The fix:** sound.ts keeps the old context open as long as a rebuild listener asks (at most 2 s, `REBUILD_GAP_MS`, so never more
  than two at once); with no music playing it closes at once, as before. music.ts waits until the new context's clock runs (at most
  `MUSIC.handoffWaitMs`, 1 s), starts each piece there at the place the old one is heard at (`carriedStarts`: the old context's
  own clock while it keeps time with the wall clock, else the wall clock; an intro picks up inside itself), then fades the old one
  out over `MUSIC.handoffMs` (0.3 s) from that moment. If the old one was still sounding, nothing is heard; if it was dead, the
  new one simply comes in. A splash's music (`carried`) is handed over too: before, it was dropped on a rebuild.
- **Is the "away" trigger still needed beside the clock checks and `devicechange`? Kept.** It's there for Nov 3's Chrome story
  (moved and resized the window, clicked over to another app and back: every click after was silent): Chrome kept the context
  "running", its clock moving, after the device under it changed. The clock checks can't see that by design. `devicechange` fires
  only when the list of devices changes, not when the same device switches mode or another app takes it. The context's `error`
  event is only in newer Chrome. We have no report showing that either signal would have caught Nov 3, so removing the trigger has
  no reason that holds. Its cost was the audible cut, and that's gone now: a rebuild of a healthy context is a silent handover.
