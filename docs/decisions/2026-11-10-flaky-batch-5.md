# Flaky batch 5 (Nov 10, 2026)

Main runs 42768777492, 42769640391; method as #590.
**chat:280**: the phone's pick ended the turn, so the board was gone; now measured as the move is made.
**desktop-board:300**: a player who never picks can be knocked out at a stage's end; after the reveal it waits for play, watching or the stage break.
**town-afk:25** (colosseum, shop): no account wait; the first frame paints every house and sprite (about 1 s on a phone). `townReady()` waits 20 s, as the town specs do.
**colosseum:159**: a 500 on /api/me: the tests' `wrangler d1 execute` locked the server's database. Test SQL now goes through the server (`/api/e2e/sql`, only with `E2E_SQL=1`, set by playwright.config.ts alone).
