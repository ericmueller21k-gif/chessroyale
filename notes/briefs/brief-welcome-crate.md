# Brief: the Welcome Crate: an early tester's gift after 5 finished games (Opus xhigh: stored data)

Worktree `/home/user/cr-welcome`, branch `claude/welcome-crate`, from main. Set it up with `npm ci`; never symlink node_modules.
Ports 8985, inspector 9485. Include notes/briefs/rules-common.md (American English, attribution, what you may and may not do).
**Time box: about 1 hour** (Eric: "see if you can do the full all the colors for all the riders and the crate and the UI wiring in
the next hour"). Ship a correct, safe, tested core first. If time runs short, say what's left and never cut the safety checks. Push
as you go; the container can restart.

## Eric, Nov 6
"A welcome crate: you get it for completing 5 games in any mode or any boss. It contains a special HunChess-colored random rider,
with a HunChess-theme gold and black crate. Never tradeable. Purity isn't listed for these. Limit one per account. Something on it
which says 'Thank you for being an early tester!', and also a note saying not tradeable. See if you can do all the colors for all the
riders and the crate and the UI wiring."

## Read first
- `packages/core/src/crates.ts`: crates, `BOSS_CRATES`, opening, prizes, purity.
- How items are stored, granted and opened on the server: the inventory, crate keys and tokens.
- How trading and listing work: the trade offer and listing paths, whatever exists.
- `packages/app/src/town/rides.ts` and `ride-cells.ts`: every ride and how it's drawn.
- The crate and inventory screens in the app.
- `docs/areas/shop.md` and the crate decision notes.

## Build
1. **Earning it.**
   - A signed-in account earns **one Welcome Crate** when it has **finished 5 games**: any mode (ranked, casual, friends, Squads,
     50v50, auto chess, …) or any boss battle. A game counts when it reaches a result, win, loss or draw; abandoned, aborted or
     never-started games don't count.
   - The server counts and grants it, never the app. **At most one per account, ever**, idempotent under retries, races and two
     tabs: use a stored per-account flag or unique key, checked and set atomically.
   - Accounts that have already finished 5 or more games get it on their next sign-in or next finished game (a backfill). Say how
     you count past games and whether every mode's history is available. If it isn't, count from what's stored, and say what's
     missed.
   - Guests and bots never get one.
   - When it's granted, the player sees a one-time "You earned a Welcome Crate!" notice wherever the other crate grants show.
2. **The crate.**
   - **The HunChess Welcome Crate:** gold and black in the HunChess theme (the logo's gold, deep black, a gold trim). Draw it by hand
     like the other crates, with an idle glint.
   - **On its card:**
     - "HunChess Welcome Crate";
     - "Thank you for being an early tester!";
     - a clear note, "Not tradeable".
   - **No purity** is shown for it or its prize.
3. **The prize: a HunChess-colored rider.**
   - Opening it gives **one random ride** from all the rides in the game, in a special **HunChess gold-and-black colorway**.
   - Make that colorway for **every** ride: a palette remap (gold, black, cream highlights) applied to each ride's art. Each must
     read well. Fix by hand any where the remap fails, such as a mostly-black ride vanishing.
   - It's a distinct item from the normal ride (its own id, e.g. `<ride>-hunchess`), so it never collides with or upgrades a normal
     copy. Riding it works like the others in the town.
   - Its card shows the HunChess colorway, "Not tradeable", and no purity.
   - The random pick is made on the server, fairly, and stored. Opening is idempotent.
4. **Never tradeable, never listable.**
   - Every trade and listing path refuses the crate and its rides, **checked on the server**. The app hides those buttons.
   - Unit-test each path refusing.
5. **The UI wiring:**
   - the crate in the inventory, with its card text and the open flow (the existing crate opening, the HunChess look);
   - the ride in the rides list and selectable in the town;
   - "Not tradeable" wherever trading shows;
   - the earned notice;
   - a progress hint somewhere sensible ("Finish 5 games to earn your Welcome Crate: 3/5"), if quick. If not, say so.
6. **Stored data:**
   - Old accounts and old stored inventories keep working.
   - No migration may lose or duplicate items.
   - List every stored field you add and how old data reads.

## Rules
- Fair play and stored data at the xhigh bar: think through double-grant and double-open races, a rollback partway through, and
  what an older app sees.
- No paid service. Money is Eric's, and this isn't money: no purchase involved.
- List every player-visible text and every changed check old → new.

## Done
- **Unit tests:**
  - earning at exactly 5 finished games and not at 4;
  - abandoned games not counting;
  - one per account under concurrent grants;
  - the backfill;
  - opening once giving one HunChess ride from the full list;
  - every ride's colorway existing and drawing;
  - every trade and listing path refusing;
  - no purity on either;
  - old inventories loading.
- **e2e** (phone and computer): finish 5 quick games (or the fastest real path, such as a test hook that finishes games, if one
  exists for other crate tests), then:
  - see the notice;
  - open the crate;
  - see a HunChess ride;
  - ride it in the town;
  - find trading refused or hidden;
  - a sixth game grants nothing.
- **Stills** in `docs/welcome-crate/`:
  - the crate card;
  - the opening;
  - a sheet of every ride in the HunChess colorway;
  - the ride in the town;
  - the "Not tradeable" note.
- **The PR body** in `docs/welcome-crate/pr-body.md`. Lane: full e2e, since it touches stored data and shared core.
- **A decision note** in `docs/decisions/2026-11-06-welcome-crate.md`, quoting Eric.
- Don't open the PR. Stop with a short report.
