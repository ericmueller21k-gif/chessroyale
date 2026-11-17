# Every boss faces the right way, everywhere it stands (Nov 17, 2026)

Eric, Nov 17 (after Dash faced away from the board on a computer; #766 fixed that one place): "Can we send a helper to have all the
bosses facing the right way".

- **One rule** (kits.ts `placeFacing`): the art's facing (a sprite's measured `drawnFacing`, else `ART_FACING` in sprites.ts, now every
  boss, by eye at 4x) against the place's (`PLACE_FACING`): a phone's bar, a computer's side and the results face our right (the board,
  the God King); the select's stage faces our left (your pawn). Different: mirrored about the feet; front-facing art never. The nine
  hand-set `artFacesLeft` flags are gone (the data replaces them).
- **Calls made by eye:** left: Sawyer, Wrangler (was "front, leaning left" on Nov 8; his snout and body face left, as the area page
  already said), Alfil, Chub & Chirp, Smudgy, Moo, Puddles, Babur, Folio, Timber, Dash. Right: Jefferson, Don Dough, Chandy. Front:
  Boingo, Ginger, Hollow, Big Boy, the Hidden Boss. Eric may flip any one: one word in sprites.ts.
- **The phone's bar now turns too** (it never did): its `barShift` is measured from the mirrored drawing, and now also keeps every moment
  on the screen's left edge (Wrangler's lasso, Dash's entrance reach that way once turned): Wrangler's name column moves 52 px (Chandy's 53).
- **Hand-tied effects** follow the turn (`figurePoint`): Babur turns to his pump for his toss on a computer, then back; Puddles' seeds;
  Dash's slap to his chest. The side figure's room (`SIDE_REACH`) is swapped when mirrored and measured from his feet (his turned
  box's left edge put a wide mirrored frame, Wrangler's, 75 px over the board).
- **Not in this change:** a phone's casters at the board's top-left corner (`.pm-caster`) still draw each boss as drawn: their projectiles
  leave from hands measured on the unmirrored art (Babur's hoops, Chub's carrots, Puddles' spray…), so turning them is per boss work.
