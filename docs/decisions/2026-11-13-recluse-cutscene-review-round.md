# The Hidden Boss's cutscene: review round (Nov 13, 2026)

The review of #679 (M1, m1-m3, nits), fixed in the same PR:
- **M1:** a reload during the scene online lands on his fall's screen (`net.ts`, the `phase2` case, while `now < at`), so the scene
  draws from its moment and the beaten theme plays; who takes the boards comes from the view's boards.
- **m1:** the ⋯ is greyed in its place during the scene (CSS on `body.cs-on`), as the 🏆 is; a sheet already open sits above the dark.
- **m2, a call:** the brief said `Voice.reset()` should clear the hush. It doesn't: online, phase 2's first word (sent at `cutAt -
  50 ms`, it resets the God King's voice) usually lands just after the scene has hushed both voices, so a reset clearing it would let
  his remarks speak over the scene. Instead the scene un-hushes as it unmounts (`Voice.unhush`), which covers leaving mid-scene,
  the only way a hush could outlive it.
- **m3, nit:** comments only; `absorbReadMs` left as it is.
