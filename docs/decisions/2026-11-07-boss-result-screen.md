# Boss result screen (Nov 7)

Eric: the result screen shows no trophy or skull, no record line ("A win on your record", "It counts as a loss"), and a title in
the God King's pixel type ("Press Start 2P", the speech bubble's font, gold shadow). Your pawn, dressed as your profile has it,
stands beside the God King wherever he rises or falls (the Last Stand's result). The boss's line stays in its bubble.
Each boss says one goodbye as you walk back into the town after its battle (its bubble, `GOODBYE_LINES`, boss-select.ts).
Calls: the unranked note stays (it's true for boss alone); Folio gets a second victory and defeat line; the Hidden Boss's
fall lines count as his defeat lines; every boss's result lines fit 60 characters (two rows of the bubble).
Nov 8 (Eric): no solo "Unranked" note on boss results (the lobby's "fewer than N real players" line stays); the Last Stand row: boss left, God King and your pawn right, the boss's line first, then the God King's after RESULT_TALK (settings.ts).
