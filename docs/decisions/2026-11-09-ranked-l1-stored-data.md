# Ranked L1: one table, the standing worked out (Nov 9, 2026)

- Only `ranked_conduct` (user_id, match_id, at, mode, kind, games, rp, nonce; PK user and game), additive. The design's
  `users.dodge_level, dodge_at` columns aren't added: the dodge level is worked out from the dodges kept (+1 each, −1 per 12
  hours without one), so there's nothing to keep in step and the 90-day purge clears it too.
- `games` (the player's ranked games by then) is the director's addition: the last-20 window counts a mark's place as the games
  since it, the dodges since it, and itself, so every clean game pushes the oldest out without reading old games (kept only 30
  days).
- `rp` is what it actually cost (never below Wood 5 0; 0 in placements or while fair play holds the player: the mark still goes
  on the record), for home's note and the download.
- Once only: a dodge's fee applies only with its own row (nonce); a leave's mark and fee only with the game's own row, in the
  same batch. A retry, a repeat and two recordings at once charge once (ranked-store.test.ts).
