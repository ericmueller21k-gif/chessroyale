# Solo games: a game left after 10 moves counts as a loss (Nov 22). Opus, xhigh. Full lane (stored results). Step 1 of 2.
**Eric, Nov 22:** "if I'm playing against someone and I just refresh my browser, it doesn't show it in the match history ... otherwise no one
would ever resign. They would just refresh their browser and then it would just disappear." Then, on the plan below: "should we maybe capture
something if they go past 10 moves? ... we only store games that people are actually playing ... as opposed to just click on it and then click
away ... better for server capacity." Approved: "go ahead with both steps."

## The hole
Online games are already the server's (a reload rejoins; gone LEAVING.awayMs = a resign, recorded). **Solo games** (Solo, a solo raid, Boss
Battle alone; anything that posts `POST /api/results` from the browser) are the device's: a reload mid-game loses the game and records nothing.
The server already notes each solo game's start: `solo_games` (packages/server/src/xp.ts, `startSoloGame` / `endSoloGame`; one row per account,
replaced by each new start, deleted as its result comes in; `POST /api/xp/solo/start` in api.ts ~line 750, the app's call in account.ts ~701).

## Build (the director's design, agreed with Eric)
1. **Under 10 of the player's own moves: nothing changes.** Tap in, leave, reload: nothing recorded, nothing new stored.
2. **At the player's 10th own move** the app tells the server once (one small POST, not one per move) that this solo game is real; the server
   marks its `solo_games` row (a new nullable column, e.g. `real_at`, plus whatever the loss row needs: mode, players, boss id/elo, team...;
   only what the server can't already derive, and only values it validates the way /api/results does).
3. **A real game that never gets its result** is recorded as a loss (`abandoned = 1`, online 0, placement = last, no XP, no boss token, no
   Welcome Crate, no quest progress), by the server, when the first of these happens: the same account starts another solo game (startSoloGame
   replacing a real row), the app loads `/api/me`, or `SOLO_ABANDON.staleHours` (24) have passed, checked at that next touch (no cron needed).
4. **Never twice:** a late result for a game already recorded as abandoned writes nothing (keep the abandoned game's id on the row, or an
   equivalent keyed guard, as recordResult's `once`). A result arriving normally clears the row as today. Think through: two tabs, a result
   racing a new start, an account deleted mid-game, guests, test switches (`?xpgame`), admin test games.
5. **Not in scope:** Battle Tower floors (their own resume and forfeit rules: tower.ts; make sure a floor never trips this), online games,
   ranked. A player who tampers with the device to never send the 10-move mark isn't stopped: the target is the casual reload-dodge (solo
   never touches rank).
6. All numbers in `packages/core/src/settings.ts` (`SOLO_ABANDON = { minMoves: 10, staleHours: 24 }` or similar, with a comment).
7. One line in the FAQ/handbook where solo games or leaving are explained: "Leaving a solo game after 10 moves counts as a loss." (Step 2
   adds "you can resume it from Boss Battle" later; don't promise resume yet.)
8. Schema: a new column on `solo_games` the repo's way (ensureSchema/ALTER pattern used elsewhere; check docs/areas/accounts.md for the
   migration rules). account-data.ts lists `solo_games` for export/erase: keep that true.

## Step 2 (NOT yours, a later helper; design so it fits): a "You have a game in progress: Resume / Forfeit" prompt when the player comes
back to Boss Battle, reusing the Battle Tower's restore (tower.ts `loadKept`/KEY in localStorage, App.tsx `/tower` rejoin). The device keeps
the moves; the server keeps only the row. Forfeit = this loss now (only past 10 moves). So expose the abandon-now path as a small function.

## Tests
- Unit tests (packages/server/test): the mark, the loss on each trigger, never twice, a normal result clears it, under 10 moves nothing,
  a tower floor untouched, an account erased.
- One focused e2e check in an existing solo spec: play 10 moves vs a boss, reload, start another game, the profile's recent games show the
  loss. And under 10 moves: nothing.
- Add any new file to `e2e/areas.json`. Ask for the `full-e2e` label in your PR body (the director adds it).

## Deliver
Branch `claude/solo-abandon` from origin/main. Push as you go. Docs: `docs/areas/accounts.md` (or the page that owns solo results), ≤5 lines;
a decision note `docs/decisions/2026-11-22-solo-abandon.md` (≤10 lines). When done and CI is green on your last push: `.pr-body.md` (title on
line 1) and `.done` at the branch root, pushed. No stills needed (no screen changes beyond the FAQ line).
