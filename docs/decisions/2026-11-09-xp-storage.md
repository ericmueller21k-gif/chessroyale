# XP: stored data and how a result screen gets its XP (Nov 9, 2026)

Full lane (stored data). Migrations as the repo adds them (accounts.ts COLUMNS; a new table in SCHEMA): every existing row keeps
working.

- **`wallets.xp`** (INTEGER NOT NULL DEFAULT 0): each account's XP, moved only through the ledger as a new asset kind **`xp`**
  (ledger.ts `leg.xp`, in its balances, merge and erase). One op per game per player: `xp:<game>:<ledger id>` for the minutes and
  `xpwin:<game>:<ledger id>` for the win, whose cap is the op's guard, counted in the same transaction (two at once can't both
  take the last one). Both in one batch. A replay answers the same parts.
- **`results.play_ms, moves, xp_before, xp_parts, xp_none`**: the game's time and moves as the server counted them (solo: the
  device's moves), and what the box shows (NULL on everything from before).
- **`solo_games`** (user_id, id, started_at, test_minutes): the solo game the server is timing. In ACCOUNT_STORES ("xp"); the
  download has it, deleting removes it. The privacy policy has an "XP and levels" entry.
- **Getting it to the screen.** The match rooms record results after their result message goes out, so instead of a new socket
  message in three rooms, an online result screen asks `GET /api/xp?game=CODE` a few times (XP.asksMs), as boss tokens' screen
  already does; it also works after a reload. Ranked 1 v 1 carries it on its existing `outcome` message (`DuelOutcome.xp`,
  optional). Solo: the `POST /api/results` answer (`xp`). Old apps ignore all three.
- **Test switches** (`?xp=` test servers only since Nov 9, review of #574 M1; others test servers and admins): `?xp=<n>` (`POST /api/xp/test`, a ledger op "test") and `?xpgame=MINUTES`
  (solo: on the start; a lobby: `overrides.xpGame`) counts a game that long with enough moves, test switches or not. Any other
  lobby test switch marks it `tested` (no XP).
