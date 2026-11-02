Title: Shops round 2: boss tokens, crate keys, buying a boss crate, admins' test grants

## What changed

Eric's boss token rules (Nov 2), built server-side, and the shop card's buying made real. Decision note:
`docs/decisions/2026-11-02-boss-tokens.md`; how it works: `docs/areas/shop.md`, "Boss tokens".

- **Earning (decided by the server only).** A boss battle (a Boss raid online, a Boss Battle party, a Solo raid, Boss alone), won or
  lost, counts once it reaches 10 of your moves or 5 minutes. Per account over a rolling 24 hours: the first counted battle with no
  token in the window always drops one; then 25% a battle, up to 3. Which boss's: one of the live bosses (not the Hidden Boss, not
  Timber while he's admins first, not a resting one), each as likely, the server's randomness. The drop is one transaction: the window
  is counted in the drop's own statement, so two battles counted at once can't both take the last place (`BOSS_TOKENS` in settings,
  `core/boss-tokens.ts`, `server/boss-tokens.ts`).
  - **Online:** the match room counts each person's picks that went in (at each turn's lock) and keeps the time from the match's start
    (`LobbyCore.bossBattleSpan`); the Durable Object counts the battle as it saves their result (once).
  - **Solo can't be verified move by move, so it counts by the server's clock alone** (the safe option): the app starts a solo battle
    on the server as it begins (`POST /api/boss/solo/start`: the server notes the time; one open per account) and finishes it from the
    result screen (`POST /api/boss/solo/finish`: taken off in one statement, so once); it counts when 5 minutes or more passed between
    the two by the server's clock. The 10-moves path isn't there for solo (the device's word). What's left open: a script could open a
    battle, wait 5 minutes and finish it; that's the same 5 minutes a real battle takes, and the cap (3 a day) bounds it.
  - **Guests:** where sign-in is set up, only signed-in accounts earn tokens (a guest's things move into the account it signs in to, so
    many guests could fill one account past the cap). Locally and in e2e, guests earn them.
- **The result screen** (victory or defeat): when the server says the battle dropped a token, a square box in the gambling warning's
  look with the token turning in it, "You got a Babur token!" and OK (`components/TokenBox.tsx`). Solo: the finish's answer; online:
  `GET /api/boss/token?battle=CODE`, asked a few times while the room writes the results (no protocol change).
- **The inventory** (the Crates tab, where keys and crates show): "Boss tokens", every live boss's token with its count, greyed at
  none. **Crate keys are stored and counted now** (`wallets.crate_keys`).
- **Token art:** the 14 live bosses' and Timber's tokens copied as drawn from `claude/boss-art` into `components/tokens/` (only the
  import lines and the `!`s the app's typecheck asks for changed), one lazy chunk. No live boss is missing one (Blitz's is drawn,
  waiting for its boss). A boss without one would show a plain gold coin with its initial.
- **Boss crates** (`BOSS_CRATES` in core's crates.ts, beside `CRATES` but not in it, so the Crates tab can't open one free): Babur's and
  Puddles', each the boss's ride (the only Mythic, the only item behind Fischer Random: 2% of a crate) and the Beta Crate's 24 Common to
  Epic items, at the existing crates' odds.
- **Buying** (`POST /api/shop/boss-crate`): one D1 batch, as the coin shop's: the item goes in only if the tokens (and the key) are
  there, they come off only if that item went in; a CHECK keeps counts at zero or more. A double tap or two devices are two buys, each
  paid in full or refused. It opens the crate into the locker at once (as crates open today); the card answers with the item. The
  shop's kill switch refuses it.
- **The shop card:** real counts ("You have 2 Babur tokens and 1 crate key."), a way's button greyed when you can't pay it, the answer
  with the item's picture in the row that was always there (40 px now, so nothing moves), and "+ 24 Beta Crate items, Common to Epic"
  under the ride.
- **Inside a shop the header says the shop's name** ("Babur's Circus", "Puddles' Botanical Garden"), not "Town square".
- **Admins' test grants** in the Crates tab ("Admin: test grants": +1 crate key; a boss, +1 token, +3 tokens), `POST /api/locker/grant`,
  "Not found" for anyone else, at most 10 at once. No Worker variable needed.
- **Stored data** (backward compatible: new tables, and one column added with a default; old rows read 0, old apps keep working):
  `boss_tokens`, `boss_token_drops` (kept 30 days, cleared on the Worker's schedule), `solo_battles`, `wallets.crate_keys`. In
  "Download my data" (`bossTokens`; the wallet's `crate_keys`) and erased by "Delete account"; a guest's move on sign-in. The privacy
  page has a "Boss tokens" item. The FAQ's crates section has the rules and the boss crates' odds, from the settings.

## Player-visible changes and new text

- Result screen box: **"You got a Babur token!"** ("an Alfil token", "a Boingo token"), **"▶ OK"**.
- Crates tab: **"Boss tokens"**, a token per boss with **"× N"**, **"From boss battles. Spend them on a boss's crate in its shop in the
  town."**; "Keys × ∞" → **"Keys × N"** (the real count); "Crates and keys are unlimited while we test." → **"Crates are unlimited while
  we test."**
- Crates tab, admins only: **"Admin: test grants"**, **"+1 crate key"**, a **"Boss"** picker, **"+1 token"**, **"+3 tokens"**; the server's
  **"Nothing to give."**.
- Shop card: **"+ 24 Beta Crate items, Common to Epic"**; real counts in "You have …"; buy buttons greyed when you can't pay; answers
  **"You got Balloon Pup! It's in your Locker."** (with the item's picture), **"You need 3 Babur tokens."**, **"You need 1 Babur token
  and 1 crate key."**; "Coming soon" is gone from the card.
- Header inside a shop: **"Babur's Circus"** / **"Puddles' Botanical Garden"** (was "Town square").
- FAQ, Crates and items: a new paragraph, **"Boss tokens and boss crates."** (the rule, the price, each crate's ride and odds).
- Privacy page: a new **"Boss tokens"** item; the locker item adds "crate keys"; "Deleting your account" adds "crate keys" and "your boss
  tokens and their records".
- Download my data: a `bossTokens` section; the wallet's `crate_keys`.

## Changed checks (old → new)

None guards a rule in `docs/rules/eric.md`.

- `e2e/shop.spec.ts`, "Babur's tent: …": old: both buys clicked, each answering "Coming soon", and the card didn't grow → new: both buys
  greyed with 0 tokens and 0 keys; added: the header says "Babur's Circus" inside and "Town square" outside again. (The card-doesn't-grow
  check moved to the new admin test, where buys answer.)
- `packages/app/test/shop-room.test.ts`: old "buying goes through buyBossCrate, which says 'Coming soon' in round 1" → new "buying goes
  through buyBossCrate: the server's purchase (round 2), its answer the item or the server's reason"; added: the crates match core's
  `BOSS_CRATES`, a way's button needs its price.
- `packages/server/test/account-data.test.ts`: the pinned columns gain `boss_token_drops`, `boss_tokens`, `solo_battles` and
  `wallets.crate_keys`; the download's wallet `{ coins: 50, crates: 2 }` → `{ coins: 50, crates: 2, crate_keys: 1 }`; added: the
  `bossTokens` section (the world gets a grant, a drop and an open solo battle, so deleting is checked to remove them too).
- `packages/app/test/faq.test.ts`, "says nothing about how the app talks to the server…": the lines allowed to say "token" were
  `/same-move|stockfish token/i` → `/same-move|stockfish token|boss tokens?\b/i` (boss tokens are the game's own); added: the boss
  tokens paragraph follows the settings.

## New tests

- Server unit `packages/server/test/boss-tokens.test.ts` (21): the drop rule (first in the window always, then only a lucky roll, never
  past 3; the window rolling), two counts at once racing for the window's first place, which boss (live only, evenly, resting ones out),
  guests where sign-in is set up, the result screen's lookup, the 10 moves / 5 minutes threshold, solo timed by the server (under 5
  minutes no, 5 yes, finished once, a replaced or someone else's battle never), the match room's count of picks, buying both ways, not
  enough (another boss's tokens don't count), twice at once (enough for one: one crate paid once; the two ways at once; enough for two:
  two), tokens spent just before the transaction, admins' grants admin-only through the API (capped, live bosses only) and a buy through
  it, a guest's sign-in bringing tokens, keys and drops.
- e2e `e2e/shop.spec.ts` (phone and computer): an admin grants himself a key and Babur tokens in the Crates tab, buys Babur's crate both
  ways in the tent, the counts and buttons following; a counted Boss alone battle (Hollow mates at once; its start pushed back 6 minutes
  in the local database, `backdateSoloBattle`, as the server times it) shows the square token box, OK closes it, and the token is in the
  locker.

## Lane

**Full lane** (stored data: new D1 tables and a column; fair play: drops decided by the server). Please add the `full-e2e` label.
Local runs: typecheck; the server, core and app unit tests above; the shop spec's changed and new tests (RESULTS).

## Stills (`docs/shop-r2/`)

STILLS

## For Eric

- Guests don't earn tokens where sign-in is set up (the merge would let many guests fill one account past the cap). Say if they should.
- With 14 bosses sharing at most 3 tokens a day, a boss's crate takes a while, and its ride is 1 in 50 of those (Fischer Random's 2%). A
  bigger Fischer Random for boss crates is one number.
- The Crowd's boss final doesn't count as a boss battle for tokens (the boss modes do). Easy to add.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
