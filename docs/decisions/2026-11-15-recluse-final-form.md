# The Hidden Boss's final form: the coat, his rising hair, the aura and the binary helix (Nov 15, 2026)

Eric, after playing round 3b's suit: "It doesn't feel right ... keep the face ... with the new glowing eyes ... a black trench coat
... no more helmet ... his hair ... radiating up and flowing ... an aura field around him ... ones and zeros ... spiraling around him
in a double helix." Mockup rounds 4 and 4b (`stills/recluse-final-look`); during them: blue hair tried and dropped ("the brown is
better"), finer strands ("it looks like dreadlocks"), and "all his hair should be moving". Go: "I'm good with the final form ... his
new hair. That looks correct now."

- **What changed:** the suit, helmet and visor are gone; his final form (`coatFrame`, `coated` in `characters/recluse.ts`) is worn
  wherever the suit was. The transformation's visor flip (`flipUp`, `faceOpen`, `flipDown`, the settings `flipUpAt`, `flipDownAt`)
  is gone: he's revealed with his face showing and says his first line at the same moment as before (`line1At`), so the music and
  every other beat are unchanged.
- **Calls made:** (1) the mechanism's names (`setSuitAt`, the kit's `suit`, `data-suit`) are kept: they mean "his look from the
  white-out on", and renaming them touches the e2e hooks for no player-visible gain. (2) His canvas grew 5 px upward (146 to 151,
  feet and width unchanged) rather than cutting the hair short; the growing child's figure and the cutscene now take their canvas top
  from his (`RECLUSE.foot`) instead of a copied number, so the two can't drift apart again. (3) The phone bar's bust keeps its
  window: its top is the bar's edge, so the tallest hair is cut there by the bar as before.
- **Frame cost:** each frame drawn once ahead (about 1.4 ms a frame on a computer, against 1.1 for the suit), then one image copy
  when it changes, as before.
