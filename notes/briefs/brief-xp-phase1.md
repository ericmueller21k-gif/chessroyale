# Build brief: XP and levels, phase 1 (Nov 9, 2026)

Design (approved by Eric): notes/briefs/design-xp-quests.md (v2). Read it first. This phase builds **XP and levels end to end**.
Not in this phase: the daily reward, level-up crates and keys, CRATES_FREE off (phase 2); quests and the daily overlay (phase 3).
Lane: **full** (stored data, a protocol change, accounts): the `full-e2e` label, an independent review, effort xhigh.

## What a player sees when this is done
- After every counted game, the result screen's XP box: the bar fills smoothly from the old XP to the new, the number counts up
  ("+180 XP"), its parts appear in turn ("12 min +120", "Win +50"), a level-up fills to the end, pops "Level 8!" and goes on from
  empty with the rest. Eric: "I don't want it to skip … it should go up like a nice satisfying looking thing … on every page".
- No XP: the box says why, in plain words, at the same size (nothing shifts): "No XP: the game ended before move 10.",
  "No XP: you resigned before move 10.", "No XP: you left the match.", "Sign in to earn XP.", "No XP: test game."
- Home: the real level ("LVL 7") and the ring's real progress, for every signed-in player (today `TEST_LEVEL`, admins only:
  components/FrontDoor.tsx, screens/Home.tsx). Profile and public profile: "Level 7" for real (public-profile.ts).
- The FAQ: how XP and levels work, in plain words.

## The rules (all numbers in packages/core/src/settings.ts, one `XP` object)
- `perLevel` 1000 XP, linear, no top; you start at Level 1 (level = 1 + floor(xp / perLevel)).
- A game's XP = round(minutes you played × `perMinute` 10, with minutes capped at `maxMinutes` 30) + `win` 50 for a win.
- A win: beat the boss; win the ranked 1v1; your team wins the 50 v 50 / Crowd; your squad wins its match; 1st in Classic.
- A game counts only if it reached `minMoves` 10 of your own moves (or of your team's turns while you were in). Otherwise no
  XP for anyone in it; say why (ended early, or you resigned early).
- No XP for an abandoned result (left, idle-removed: the match room's `abandoned`), a guest, a test game (any test switch or test
  control, as placement rewards already skip "a lobby a test control touched"), a banned account.
- Friends' private lobbies: time XP as usual; the win bonus once per opponent per day.
- Minutes: your time in the game as the SERVER measured it (online: the match room; knocked out at 8 minutes, 8 minutes; watching
  after adds nothing). Solo games (vs bots or a boss on your device): only the server's own clock between a start and a finish
  call, exactly as solo boss tokens already do (server/boss-tokens.ts, `solo_battles`); the device's word is never trusted.
  Auto chess: no XP (device-only today).

## How it's built (the director's outline; the builder decides the details and records each call)
- **Stored data:** XP per account (a table, or a wallet column), and each game's grant through the **ledger** as a new asset kind
  `xp` (server/ledger.ts: one op per game per player, so retries, two tabs and two devices grant once). Results gain what XP needs
  (your minutes and your moves), as a migration. Account merge, delete and "download my data" (account-data.ts) include XP.
- **Server:** one function decides a finished game's XP from the server's facts (minutes, moves, result, abandoned, test,
  guest, banned) and grants it; every place that records a result calls it: the match rooms (lobby-do: Classic, Crowd, 50 v 50,
  boss raids, friends' lobbies; squads-do; duel-do: ranked 1v1), and the solo result path (api.ts POST /api/results, with the solo
  clock). It returns the breakdown and the level before and after.
- **Protocol:** the result message (online) and the POST /api/results answer (solo) carry `xp: {before, after, levelBefore,
  levelAfter, parts: [{label, xp}], none?: reason}`. Optional fields only: an old app ignores them.
- **App:** ONE component (`XpResult`) used on every result screen: Results.tsx (Classic, Crowd, 50 v 50, boss), the Squads
  knocked-out and match-end cards (SquadsParts.tsx / Squads.tsx), ranked 1v1 (Duel.tsx), friends' lobbies; a fixed box (nothing
  shifts while it fills). The animation: reuse an existing bar or count-up if one exists (Eric: simple beats flashy); about 1.5–2.5
  s; requestAnimationFrame or CSS transitions, no layout work per frame; `prefers-reduced-motion`: the final state at once.
- **Test switches:** `?xp=<n>` (start XP) and `?xpwin=1`-style switches so e2e and stills reach a level-up and each "No XP" line.
  Admin grant of XP on the admin page if cheap.

## Tests (full lane)
- Unit: the XP math (every rule above, each "No XP" reason, the caps, the level from XP), the ledger op granting once (replays,
  races), merge and delete. Server tests for each match room's grant.
- e2e: the XP box on each result screen (a counted game, a level-up, each "No XP" reason), the animation fills without a jump
  (sample the bar's width over frames: it never jumps more than a set step), nothing shifts, phone and computer; home's level.
- `@perf`: the result screen's frames while the bar fills.
- The PR lists every check changed old → new. Area pages: accounts.md, hub.md, and each mode's page where its result screen is.

## Order inside the phase (push at each step)
1. Core: settings and the pure XP math, with unit tests.
2. Server: storage, migration, ledger kind, the grant function, each match room and the solo path, with tests.
3. Protocol and app: XpResult and its animation on every result screen; home and profiles; FAQ.
4. e2e, stills (phone and computer: a counted game, a level-up mid-fill, a "No XP"), decision note, area pages.
