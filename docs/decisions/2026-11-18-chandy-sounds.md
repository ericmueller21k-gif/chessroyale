# Chandy's own sounds; no boss borrows another's (Nov 18, 2026)

**Eric, Nov 18:** "I think I noticed a big boy sound reused in chandy, can't do that"; "Should be pulse style sounds like predator too maybe".

- **What changed:** Chandy's whole pack is his own: 29 synthesized sounds in `characters/chandy-sounds.ts` (`chandy…` in sound.ts),
  replacing 23 cue placeholders, his select sound, his intro's 3 and Dodge's 4 (named his, made from Moo's, Sawyer's, Ginger's, Hollow's).
- **Style:** pulse-style sci-fi hunter tech: most sounds throb (a tone or hiss whose level pulses). Scope beeps, a charging pulse, a pulse
  shot, a cloak shimmer for the clones. In that spirit only: no creature's clicking call, no film weapon's sound (house rule).
- **Calls:** cues share a sound where they mean the same thing (aim off = beam off; the board's shatter = Dodge's king shatter). His
  intro's three are swamp sounds (water off the rising board, a milk crate, a splash), since the intro is his swamp, not his rifle.
  `upgrade` has its sound in `CHANDY_SOUNDS`, but the upgrade window doesn't play a sound yet (wiring it is a follow-up, if wanted).
- **The cause, fixed:** `test/boss-sounds-own.test.ts` fails on any boss sound named after, or made from, another boss's pack (kits,
  select sounds, intros, board art). The roster scan found Chandy the only one borrowing.
