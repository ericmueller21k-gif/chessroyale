# A raid's boss is matched to the server's stored ratings, never the app's (Oct 16, 2026)

A reviewer found that a lobby trusted the rating a player's app sent. The app put its profile rating in the lobby's
`hello`; the lobby's Durable Object (`lobby-do.ts`) passed `msg.rating` to `LobbyCore.connect`, which kept it (clamped
to 400-3400) as that player's rating; and `startMatch` set a boss raid's strength from the people's average of those
(`raidBossElo`). An app claiming 400 met the weakest boss (1400) whatever its player's real rating. Nothing else read
that number. The calls:

- **Everyone with an account: the rating stored on it** (`users.rating`: the rating from their latest ranked result
  that fair play isn't holding, the same number their profile shows). The lobby's object reads it in the read it
  already made as someone joins (their icon and chat packs: now one `SELECT icon, rating`, `joiningProfileOf`), so
  there's no new D1 read and nothing per move. Coming back to their seat keeps the rating it got on joining.
- **Guests.** Online play needs sign-in wherever sign-in is set up (production), so a guest never reaches a lobby
  there. Where it isn't (local, the e2e, a server without the sign-in secrets), a guest plays on a guest account, and
  the same rule applies: that account's stored rating, if its ranked matches left one. No rating yet, or no account
  at all (no session, no D1): none, which `raidBossElo` counts as the prior, 1500 (`PRIOR_RATING`, where every
  rating estimate starts), so the 1600 boss. Why not a fixed number for every guest: one rule for every account is
  simpler, and a guest who has a rating meets the boss matched to it. Why the prior: it's where a new player starts.
  A strong player on a fresh account meets a new player's boss, but they could get that by starting over anyway, and
  their ranking starts over with it.
- **The protocol:** `hello` has no `rating` now and the app stops sending one. An older app's is ignored (nothing
  reads it). Nothing else needed it.
- **Everything else that takes a rating or a strength was checked:**
  - Matchmaking (`/api/play`, `queue.ts`, `matchmaker.ts`) takes none: a ticket carries a party's size and pass and
    the time its wait began.
  - Squads: its `hello` has no rating, its bots' skills are the server's, and its results record none.
  - The Crowd's boss final: its strength comes from the finalists' ratings worked out during the match from the
    server's own judged scores (`estimateRating` in `runner.ts`); the Hidden Boss's is fixed (2650). No app's number.
  - Boss alone is played on the device: its boss is a step above the rating `/api/me` gives (the server's), plus the
    difficulty the player picks. Its result never counts for ranking.
  - Solo results (`POST /api/results`): the browser's rating is kept with the result, but a solo result is stored
    unranked, so it never reaches `users.rating`, the profile's rating, its chart or "Top N%", and so never a raid's
    boss (a test pins it, even when the post claims to be online and ranked).
  - A raid at a fixed tier (`?boss=<tier>`) is a test switch, dropped for anyone but admins and test servers.

Tests: `packages/server/test/lobby-do-rating.test.ts` (signed in, a guest's account with and without a rating, no
account: the claim ignored, the boss's strength from the stored rating), and `accounts.test.ts` (a solo post never
becomes your rating).
