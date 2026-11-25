# The Hidden Boss's cutscene, wired into his fight (Nov 13)

Brief (director, from Eric's notes): the cutscene plays after his adult form is beaten and before the transformation, solo and
online; Eric's 17 lines; his beaten theme; page his absorb line; no skip. Calls made:
- **Where:** right after his fall, before the phase change's absorption (Eric: "He is already on his knees (defeated)"); the phase
  change's own timing is unchanged, so the music's cut and the server's `changeMs` stay as they are.
- **Over the fall's screen**, not a phase of its own: online the server keeps the fall up through its hold, so solo does the same
  (`cutscene` on the match; App draws it). His figure in its place is hidden while he kneels in the light, and both voices are hushed
  (his fall's mumbling and the God King's remarks would talk over it). At its end the light lifts (`outMs`, 0.6 s, added to the hold).
- **Kneeling after it:** a quiet `kneel` loop (no mumbling) is his place until he seizes the power, instead of the fall's mumbling.
- **Tests:** a shorter hold plays the scene sped up to fit (`fitCutscene`), never in production: solo `?cutscene=SECONDS`, and the e2e
  server's `CUTSCENE_HOLD_MS` (12 s; a Worker variable read only with `TEST_SWITCHES`), so the online specs don't wait 104 s.
- **Absorb line:** typed a sentence a page at the speech rule's pace with the chant's 1 s pause, gone by the same time as before.
