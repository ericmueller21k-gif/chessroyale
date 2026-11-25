# Boss result screen (Nov 7)

Eric: the result screen shows no trophy or skull, no record line ("A win on your record", "It counts as a loss"), and a title in
the God King's pixel type ("Press Start 2P", the speech bubble's font, gold shadow). Your pawn, dressed as your profile has it,
stands beside the God King wherever he rises or falls (the Last Stand's result). The boss's line stays in its bubble.
Each boss says one goodbye as you walk back into the town after its battle (its bubble, `GOODBYE_LINES`, boss-select.ts).
Calls: the unranked note stays (it's true for boss alone); Folio gets a second victory and defeat line; the Hidden Boss's
fall lines count as his defeat lines; every boss's result lines fit 60 characters (two rows of the bubble).
Nov 8 (Eric): no solo "Unranked" note on boss results (the lobby's "fewer than N real players" line stays); the Last Stand row: boss left, God King and your pawn right, the boss's line first, then the God King's after RESULT_TALK (settings.ts).
Nov 8, the boss faces the God King (the result's row: boss left, God King right): each boss judged by eye at 4x, as the result draws it (`kit.ch`). Mirrored: Sawyer, Alfil, Chub & Chirp, Moo, Gardener, Tiger, Folio (their art faces our left; `artFacesLeft`, kits.ts). Their image only, scaleX(-1) about its feet on the result (`.art-left`, styles.css), never on the board; the bubble and words never flip. Already facing right, untouched: Jefferson (giraffe), Smudgy (the sprite kit's own mirror). Front-facing, not mirrored (a flip would only swap their props and writing): Boingo, Ginger, Hollow, Big Boy (his shirt says BIG BOY), Wrangler, Timber, Dash, Hidden Boss (his book's "W"). Borderline: Timber and Wrangler lean a little left; left as drawn, Eric may want them turned.
Nov 8, the director's review: the God King stands from the first frame on a crowd win (the rise is no longer shown mid-line; his rise motion `.rising` plays only as he starts to speak, after the boss's line). Dash and Timber also face our left: mirrored too. The boss and the God King stay 16 px apart on the painted figures (the row's gap is 32 px on a phone, where a wide boss overflows his box).
