# The HunChess Welcome Crate: an early tester's gift after 5 finished games

Eric, Nov 6: "A welcome crate: you get it for completing 5 games in any mode or any boss. It contains a special HunChess-colored random
rider, with a HunChess-theme gold and black crate. Never tradeable. Purity isn't listed for these. Limit one per account. Something on
it which says 'Thank you for being an early tester!', and also a note saying not tradeable. See if you can do all the colors for all
the riders and the crate and the UI wiring."

Decision note: `docs/decisions/2026-11-06-welcome-crate.md`. Area page: `docs/areas/shop.md`, "The HunChess Welcome Crate".

**Lane: full** (stored data, fair play, the shared core and the server). Please add the `full-e2e` label.

## What changed

- **Earning it (server only).** A new table `welcome_crates`, keyed by the account (`user_id` PRIMARY KEY). The grant
  (`server/welcome.ts`, `grantWelcomeCrate`) is one statement: it inserts the row only while the account is signed in (email or Google)
  and its finished games, counted in that same statement, reach 5 (`WELCOME_GIFT.games` in settings.ts). `ON CONFLICT DO NOTHING` makes
  any second grant a no-op, so retries, races, two tabs and two Workers grant it once. It runs on every `/api/me` (sign-in and app load:
  the backfill) and after every saved result (match rooms, Squads, solo results) and every recorded ranked 1 v 1 game. Guests and bots
  never get one.
- **What counts as a finished game.** Every `results` row (online matches written by their rooms: Classic, Crowd and 50 v 50, boss
  raids, friends' lobbies, Squads; solo matches saved by the app from their result screen) plus `ranked_1v1.games` (aborted games are
  never recorded). Abandoned matches don't count: a new `results.abandoned` column, set to 1 by the match room when a player was gone
  too long (`away`), idle (`afk`) or removed (`kicked`) mid-match. A resignation is a loss, so it counts. The app can't set the column.
  Missed or approximate: auto chess (nothing reaches the server), a ranked game while fair play held the player, and every result from
  before this PR (no `abandoned`, so all of them count).
- **The crate.** `WELCOME_CRATE` (core `welcome.ts`, id `welcome-hunchess`) is in neither `CRATES` nor `BOSS_CRATES`. Its hand-drawn art,
  `HunchessCrateArt`, is a black chest with the logo's gold (`#f2c14e`) trim, bands, corners, pawn and "HUNCHESS", plus an idle glint
  (stopped under reduced motion).
- **The prize: every ride in a HunChess colorway.** `HUNCHESS_RIDES` (crates.ts) holds one item per ride, `<ride>-hunchess` (17 now; a
  new ride gets one with no change). Each is its own item, so it never stacks with or upgrades a normal copy. It is drawn from its
  ride's own drawing, cells, size and pace (`components/rides/hunchess.tsx`). One SVG filter goes on each ride layer, never on the
  pawn: the ride's light picks deep black, soft black, gold, light gold or cream, and a thin gold trim goes round it. Per-ride levels
  where the plain remap failed: only the Rodeo Bull, which is nearly all dark, is lifted a little. Lifting others washed them out, so
  that was dropped. No shine. Sheet: `docs/welcome-crate/hunchess-rides.png`.
- **Opening it.** `POST /api/locker/open {crate: "welcome-hunchess"}` → `openWelcomeCrate`, one transaction. The ride goes in only
  while the crate is unopened, then the crate is marked opened with that ride only if it went in. A second open (double tap, two
  devices, retry) answers the same ride (`again: true`). A rollback partway leaves the crate unopened with no ride. The roll uses the
  server's own randomness, never a test switch: one ride, each as likely, stored with yellow (gold) / midnight (black) and blemish 0.
- **Never tradeable, never listable.** The game has no trade, gift or listing path today: the only path that moves items between
  accounts is a guest's sign-in, and a guest can't earn or open the crate. That merge also drops any welcome row under the guest
  rather than moving it. Core's `tradeable()` says no for the crate and every HunChess ride (refusal text `NOT_TRADEABLE`), and any
  future trade or listing path must ask it on the server. The app shows no trade buttons (none exist).
- **The UI.**
  - The crate is first in the Crates tab, with its card text and where yours stands.
  - Its page lists every ride it can give (each 5.9%) with no purity, and "▶ Open" opens it with the usual strip → Fischer Random
    ("A HunChess ride") → reveal.
  - The reveal shows "HunChess gold & black", "Not tradeable", no purity and no "Open another".
  - Each HunChess ride's locker tile shows "HunChess" and "Not tradeable" in place of its color and purity.
  - The ride wears and rides like any ride in the town.
  - A profile's Wearing row lists it as "Ride · HunChess gold & black · Not tradeable": no "% pure", no "Shiny"
    (`app/src/item-details.ts`, used by `ProfileParts.tsx`). Item art never adds its shiny class for one, and the locker's delete
    dialog shows no purity for one.
  - A one-time notice shows on home and on a match's result screen.

## Player-visible text (all new)

- "HunChess Welcome Crate"
- "Thank you for being an early tester!"
- "Not tradeable"
- "You earned a Welcome Crate!", "It's in your inventory's Crates. Not tradeable.", "▶ OK"
- "Finish 5 games to earn your Welcome Crate: 3/5" (a guest's adds ". Sign in to earn it.")
- "You have 1. Open it!", "Opened. Its ride is in your locker."
- "One per account, for finishing 5 games in any mode or against any boss. It holds one ride, any of the game's rides, each as likely,
  in HunChess gold and black. It and its ride can't be traded."
- A profile's Wearing row for a HunChess ride: "Ride · HunChess gold & black · Not tradeable"
- "Possible rides", "Ride · HunChess gold & black", "HunChess gold & black", "A HunChess ride" (the Fischer Random banner's line)
- Item names "HunChess <ride name>" (e.g. "HunChess Balloon Pup"); descriptions "<ride> in HunChess gold and black, from the Welcome
  Crate. <the ride's line>"
- The refusal for a future trade or listing path: "The Welcome Crate and its HunChess rides are not tradeable."; opening without one:
  "You have no Welcome Crate to open."

## Stored data

- New table `welcome_crates` (`user_id` PK, `granted_at`, `games`, `seen_at`, `opened_at`, `item_id`). It's created with the schema;
  no row means "not earned yet", which is how every account reads before this PR.
- New column `results.abandoned` (INTEGER). NULL on every older row (those count as finished games).
- The prize is an ordinary `items` row (crate `welcome-hunchess`); its def is new (`<ride>-hunchess`). An older app leaves unknown
  defs out of the locker (no crash) and drops an unknown ride from a look (the pawn shows on foot).
- No migration moves, copies or deletes items. The account's download gains "welcomeCrate" and `results.abandoned`. Deleting the
  account erases the row, and the kept anonymous results keep `abandoned`.
- The schema fingerprint changes, so every Worker runs `ensureSchema` once (`CREATE TABLE IF NOT EXISTS`, one `ALTER TABLE ADD COLUMN`).

## Changed checks (old → new)

- `packages/core/test/crates.test.ts`, "every item is in exactly one crate": `toHaveLength(NO_CRATE_YET.includes(d.id) ? 0 : 1)` →
  `toHaveLength(NO_CRATE_YET.includes(d.id) || d.hunchess ? 0 : 1)` (a HunChess colorway is in no crate but the Welcome Crate).
- `packages/core/test/crates.test.ts`, "rides (Oct 31)": `ITEM_DEFS.filter((d) => d.slot === "ride")` →
  `ITEM_DEFS.filter((d) => d.slot === "ride" && !d.hunchess)` (the 17 rides themselves).
- `packages/app/test/town-rides.test.ts`, "every ride item has a drawing…": the same filter, `… && !d.hunchess` (colorways are drawn from
  their ride's drawing and cells: `packages/app/test/hunchess-rides.test.ts`).
- `e2e/profile.spec.ts`, "rides for an admin": `expect(rides).toBe(17)` → `expect(rides).toBe(34)` (admins own one of every item, the
  17 colorways too, per Eric's Oct 31 rule).
- `packages/server/test/account-data.test.ts`, `SCHEMA_COLUMNS`: `results` gains `abandoned`; `welcome_crates` added.
- None of these guards a rule in `docs/rules/eric.md`.

## Tests

- Unit: `packages/server/test/welcome.test.ts`, 19 tests:
  - earning at 5 and not at 4;
  - any mode counting;
  - abandoned games not counting, and the room marking away, afk and kicked but not a resignation;
  - guests never;
  - 12 concurrent grants giving one row, plus a grant raced past its quick check;
  - the backfill through `/api/me`'s profile;
  - a guest's games counting after sign-in;
  - the notice showing once;
  - opening once, three opens at once, a rollback partway, every ride reachable;
  - every colorway present, never tradeable, the guest merge carrying nothing;
  - no purity;
  - old lockers and a database without the table.
- Unit: `packages/app/test/hunchess-rides.test.ts`: every ride's colorway loads and every layer of every view, frame and trail is in
  its filter; its cells, size and pace are its ride's; a profile's Wearing details for every HunChess ride list no purity or shine,
  while other items keep theirs.
- e2e: `e2e/welcome-crate.spec.ts` (phone and computer): a signed-in account finishes 4 games (progress 4/5) and then a 5th, through
  the app's own result path `POST /api/results`. Then it:
  - sees the notice once;
  - opens the crate (strip, Fischer Random, reveal) to a HunChess ride: "Not tradeable", no purity;
  - opens again and gets the same ride, nothing new;
  - finds no trade, sell or list buttons, and "Not tradeable" on the locker tile;
  - finds its profile's Wearing row reading "Ride · HunChess gold & black · Not tradeable", with no purity or shine;
  - rides it in the town (`__townRide`);
  - plays a sixth game, which grants nothing.

  Local result: 2 passed (phone, desktop).
- Lane: full. Run the whole suite on this PR (`full-e2e`).

## Stills (`docs/welcome-crate/`)

- `crate-card-{phone,desktop}.png`: the crate's page and card.
- `crate-row-{phone,desktop}.png`: its row in the Crates tab.
- `opening-{phone,desktop}.png`: the strip.
- `reveal-{phone,desktop}.png`: the reveal.
- `notice-{phone,desktop}.png`: the one-time notice.
- `not-tradeable-{phone,desktop}.png`: the locker tile.
- `town-{phone,desktop}.png`: riding it in the town.
- `hunchess-rides.png`: every ride in the colorway, from the dev fitting sheet. Its own caption reads "Yellow · 100% pure"; the app
  never shows that for these.

## Left for later

- Auto chess games aren't counted (nothing reaches the server).
- A solo result is the device's word, as all solo results are.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
