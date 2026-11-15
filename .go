chandy build art (Eric, Nov 16: "I like how you have it done. That's fine." with one change below). Round 2c stands.

ERIC'S CHANGE: during Dodge's vote, NO dashed aim lines. "That's like the whole point. You actually have to look and see which ones
he's pointing at." The players read each gator's line from where he stands (the edge square of his rank or file) and his aim pose.
After the vote LOCKS, the lines may flash a few times, then the beams fire as drawn now. Make the aim readable without lines: the
rifle's muzzle glow pointing down its line is fine, a line is not. Also keep the clones visible while they fire (in the 2c blast
still they vanish under the beams).

BUILD THE ART (this job; the rules come in a separate job afterwards, so be exact in the notes for it):
- Pull main first. Chandy's sprite kit in the game's format (`characters/chandy.ts` and his sounds' cue list), unwired from rules:
  idle, point, unsling/aim/fire, the 6 rifle stages on his back and in his hands, the bar's bust and the select tile; the clones'
  palette (`CHANDY_CLONE_PALETTE`) and clone poses (level, down, teleport blink, afterimage fade).
- The board art on the shared board-effects canvas: the crosshair (with the turns-left pips), scatter sparks, the beam cover, the
  bubble shield, dizzy stars, the queen-lock aim and shot with the shatter; Dodge's scope-in, slide, blank board, clones, the
  post-lock line flash and the blasts.
- The upgrade window (the `.gk-command` look) as a component, fed by a stage number.
- An admin-only preview to show it all in the real app (as other bosses' previews), not in the production menus.
- Tests the boss lane asks for art: his kit's frames (sizes, feet, no clipping), the clone palette, and `npm run frames:character`
  on phone and computer. One still per platform at the end. `.pr-body.md` (what changed, player-visible: nothing until the rules
  job wires him, checks old -> new), a short decision note in docs/decisions/ (Chandy's design, pointing at stills/boss-chandy's
  DESIGN.md as the rules job's spec), docs/areas/bosses.md touched only where art lives. Then `.done`. No PRs, no CI waits, no images
  under docs/, no model names in commits.
