# Boingo's claw machine: a boss token for a chance at that boss's crate (Nov 6, 2026)

Eric: "you put in boss tokens, and there's a chance you get a crate from a boss that's openable right away … a good use of your tokens if you have extras … a 25% chance to start."

- **The server decides each play** as the coin goes in (`POST /api/shop/claw`, `server/claw.ts`): one token out and, `CLAW.winChance` (0.25, settings) of the time, that boss's Boss Crate in, unopened. Both go through the ledger (`clawOp`, op `claw:<ledger id>:<request>`: a retry or double tap plays once), the play's `claw_plays` row in the same transaction. The claw only shows the answer.
- **Guarded:** guests can't play; the shop's kill switch refuses it; the e2e's `?clawSeed=N` counts only where TEST_SWITCHES is "1", never an admin's.
- **The cost:** 4 tokens a crate on average against a bought crate's 3, so it's a use for extras, not a cheaper way.
- **Eric's test tokens:** the existing admin-only grant, behind "Admin: +3 of each token" on the machine.
- **The cabinet** (Eric: "the real claw machine in the room, a big 3D arcade cabinet you walk up to … not a separate 2D overlay screen"; then "the claw machine looks out of place … pixelated"): the 3D kit model in Boingo's palette. Eric: "Claw machine is fine with new design … for now it's fine."
