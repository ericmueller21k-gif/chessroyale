# Season ladder: mockup (Nov 25)

Code: branch `claude/ladder-mockup` (`/ladder`, `packages/app/src/screens/Ladder.tsx`, `ladder.ts`, `ladder.css`). Made-up rows
behind `?ladder=mock` (you off the page), `mock-in` (you at #7), `mock-placement`, `mock-guest`. Ways in behind `?ladderin=a|b|c`.

## The stills
- `ladder-phone-428-dark.png` first (Eric's phone size), then 390 dark and light, 320 light (the RP ellipsizes there), 1440 × 900 dark and light.
- `ladder-phone-in-dark.png`: you in the top 100 (lit in the list and still pinned). `ladder-phone-placement-light.png`: "Play 3 more
  placement games to join the ladder", 2/5. `ladder-tab-greyed-note-dark.png`: a tap on a greyed tab says why.
- The page: Back, "Ladder"; "SEASON 1 · 12,408 ranked players"; tabs 1 v 1 · 50 v 50 · Squads (the last two greyed, "No ranks yet");
  the list (the only part that scrolls): place (medals for the top 3), head (pawn + hat), name, tier and RP in the tier's color, the
  emblem, W – L and win %; a computer adds Games and Streak. Your row is pinned at the foot, always. A row's tap opens that profile.
  "Show the next 100" at the list's end.

## Phone: where the button goes (3 options)
- **A (my pick): "LADDER ›" at the right end of home's RANKED label** (`wayin-a-ranked-label-dark.png`). Always on screen, one tap,
  right next to the modes it ranks, takes no new room (the label's line already exists), the same on every mode pick.
- **B: "Ladder" in your card's bottom-left corner** (`wayin-b-card-corner-dark.png`), the mirror of "View profile". Visible and clear,
  but the card is about you and its corner is tight on short cards.
- **C: "See ladder ›" on the profile's Ranked Standing card** (`wayin-c-profile-card-dark.png`), in place of "Season 1". Logical, but
  two taps deep; good as a second way in, not the only one.
- Not proposed: the phone's top bar (no room at 320 px since Quests joined it) and the 1 v 1 panel only (hidden until 1 v 1 is picked).
- Computer: "Ladder" in the side menu under Play with friends (in the stills); greyed in the town's and a match's menus until wired.

## What data exists
- **1 v 1: everything a row needs is stored.** `ranked_1v1` (ladder, games, wins, losses, draws, streak, peak) with the index
  `ranked_1v1_ladder` on ladder; places are already counted the same way for the top tiers (`topPlace`: 1 + ladders above, ties
  share). Names from `users`. Each row's look today comes from `lockerState` per player: a page needs one batched read of the 100
  players' equipped items instead.
- **50 v 50 and Squads: no rank of their own.** `users.rating` is one number from the latest ranked online result of any mode
  (Crowd, Squads, Classic), so it can't be a per-mode ladder. Their tabs stay greyed until each mode gets its own rank (a
  `ranked_crowd` / `ranked_squads` row like 1 v 1's: the ranked lane's call).
- **Seasons: none stored.** "Season 1" is everything so far. A season needs a number and an end date (`RANKED_1V1.season`) and, at
  its end, a reset rule plus an archive of the final standings (a `ladder_final` table: season, mode, place, user) for profiles.
- Left out of the ladder: banned players, fair play's engine pool, test accounts (`users_test`), anyone still in placements.

## The endpoint I'd add
`GET /api/ladder?mode=1v1&season=1&after=<ladder>:<user_id>` → `{ season, total, rows: [100], next, you }`.
- **Rows:** keyset paging, not OFFSET: `WHERE games >= 5 AND (ladder, user_id) < (?, ?) ORDER BY ladder DESC, user_id DESC LIMIT 100`
  on a new partial index `ranked_1v1_board (ladder DESC, user_id DESC) WHERE games >= 5`. 100 rows read per page whatever its depth.
- **Places:** the first row's is `1 + COUNT(*) WHERE ladder > first.ladder` on the same index (index-only); the rest follow down the
  page (ties share). `total`: one COUNT on the partial index, cached a minute.
- **You:** your place by the same count (as `topPlace` does today, extended below the floor), cached a minute per player.
- **Cache:** each (mode, season, page) answer in the edge cache (Cache API) for 60 s, so a busy ladder costs one D1 read a minute
  a page; `you` is per player and not cached at the edge.
- **Scale:** tens of thousands of ranked players: fine as is (a count reads at most N index entries; D1's paid plan includes 25B
  rows read a month). At hundreds of thousands, switch to a snapshot: the existing 15-minute cron writes the top 1,000 with
  `RANK() OVER (ORDER BY ladder DESC)` into a `ladder_snapshot` table, everyone's place comes from the live count, and pages past
  1,000 say "Top 12%" instead of an exact place.

## Build cost (estimate)
- Server: the endpoint, the index, the batched looks, the filters, tests: ~half a day (ranked lane, `xhigh`: stored data).
- App: the page on real data (loading rows greyed, the "next 100", the profile tap), wiring the town's and a match's menus, the
  phone's way in, `e2e/areas.json` (the new files aren't placed yet: they'd run every spec), one e2e check: ~half a day (hub, `high`).
- Seasons (number, end date, reset, final standings) are a separate job for the ranked lane once Eric sets the rules.
