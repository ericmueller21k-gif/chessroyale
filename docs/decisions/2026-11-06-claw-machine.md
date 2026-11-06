# Boingo's claw machine: a boss token for a chance at that boss's crate (Nov 6, 2026)

## Eric's words

> "A claw machine … it'll take real tokens … you put in boss tokens, and there's a chance you get a crate from a boss that's openable
> right away … a good use of your tokens if you have extras … tap on the insert slot, it asks you to insert one boss coin, and you pick
> from your inventory which one … the claw comes out on its own and moves around, and there's a tap button to stop it … when you put in
> the coin we calculate it … a 25% chance to start … make sure I have enough coins, I think I have unlimited."

## What it does

- **The server decides every play, as the coin goes in** (`POST /api/shop/claw {boss, request}`, `packages/server/src/claw.ts`,
  `playClaw`). It spends exactly one of that boss's tokens, rolls with the server's own randomness (`crypto.getRandomValues`), and on a
  win puts **that boss's Boss Crate** into the inventory, unopened (a `boss_crates` row, so it opens exactly as a bought one: the Crates
  tab, or the machine's Open now). It answers `{won, crate?, boss, again?, locker}`. The claw on screen only shows that answer; the STOP
  tap changes when the claw drops, never what it brings up.
- **Odds:** `CLAW.winChance` = 0.25 in `packages/core/src/settings.ts` (with the claw's timings). Never in code.
- **Atomic:** one D1 batch (all of it or none): the play's row goes in only if the token is there; the token comes off only if that row
  went in; the crate goes in only if that row went in and won. A failed write undoes the whole play (a unit test makes the crate's write
  fail: the token stays).
- **Idempotent:** the app makes one id per coin (`request`) and asks again with the same id after a hiccup (no answer or a 5xx). The play
  row is `UNIQUE (user_id, request)`: a retry writes nothing, spends nothing, gives nothing, and answers the first play's outcome
  (`again: true`), even when it names another boss or races the first.
- **Concurrent plays:** each is its own transaction; each finds the token or not; `boss_tokens.n` can't go below zero (its CHECK).
  Test: 5 plays at once with 2 tokens make exactly 2 plays.
- **The log:** `claw_plays` (account, boss, won, the crate won, time), one row a play, plus a Worker log line per play. It's the account's
  data: in "Download my data" (`claw`) and erased with the account (`account-data.ts`).
- **Kill switch:** the shop's (`PAUSE_SHOP`) refuses a play, as it refuses buying and opening crates. Nothing is spent.
- **Guests can't play** ("Sign in to play the claw machine.", 403, nothing spent), everywhere, also where sign-in isn't set up.
- **The e2e's seed hook:** `?clawSeed=N` in the page's address (read through the app's test switches) is sent as `seed`; the server
  uses it (the roll is `mulberry32(seed)`'s first number) **only where `TEST_SWITCHES` is "1"** (local, the e2e server, staging; never
  production), and never for an admin elsewhere (a seed could pick a win). A unit test plays 40 winning seeds without TEST_SWITCHES as an
  admin and sees the server's own roll.

## The cost, for Eric

At 25% a crate costs **4 tokens on average** from the claw, against a bought crate's **3 tokens, or 1 token and a crate key**
(`BOSS_CRATE_PRICE`). So the claw is never the cheaper way to a crate: it's **a good use of extras** (a token or two short of a buy, or
tokens of a boss whose crate you don't want three of), with the fun of the grab. Any boss's token plays for that boss's crate.

## Eric's test tokens

Admins don't have unlimited tokens (they own one of every *item* as admin copies, but tokens and keys are real counts since Nov 2). The
existing admin-only path already gives them: the Crates tab's "Admin: test grants" (`POST /api/locker/grant`, "Not found" for anyone
else, at most `grantMax` (10) a tap). I added nothing new on the server: the machine's picker shows admins one more button,
**"Admin: +3 of each token"**, which calls that same grant for every boss on the picker. Anyone else never sees it, and the server
refuses the grant for them. A unit test keeps the grant admin-only.

## Calls I made

- The route is `/api/shop/claw` (under the shop's prefix and its kill switch), not a new prefix.
- The picker lists the boss crates the Crates tab lists (one for admins first only to an admin or a holder), each token with "× N",
  greyed at none (shown, not hidden), so it never shifts as counts change.
- The claw roams for at most `CLAW.roamSeconds` (8 s) and drops on its own if you don't tap.
- On a win the claw carries the crate to the chute; on a loss it slips out at the top of the lift. Both follow the server's answer, which
  comes before the claw even comes out (the coin drops while the server answers).
- Closing at any point just closes the screen: the play is already done on the server (the token spent, any crate in the inventory).
- Until Boingo's room places the machine, the test switch `?claw=1` opens it (where test switches are allowed), for the e2e and stills.
- Sounds are synthesized (no files): a coin, a whir, a grab, a thud (`packages/app/src/claw/sounds.ts`), made ahead in the sound worker
  like the bosses', each a little under a move's loudness, numbers only (the finite-sound test reads them from `MAKE`).

## Every player-visible text

- "Insert one boss coin" (the machine's screen)
- "You have no boss tokens yet."
- each token's name and "× N"
- "Tap STOP to drop the claw", "STOP"
- "You won Folio's Boss Crate!" (`clawWonLine`: any boss's crate name), "Open now", "Play again"
- "So close! Try again?", "Try again", "Close"
- the server's refusals on the machine's screen: "You need a Folio token.", "Sign in to play the claw machine.", the shop's resting line
- admins only: "Admin: +3 of each token"

## Changed checks (old → new)

- `packages/server/test/account-data.test.ts`, "every table's columns are as pinned": the pinned list gains
  `claw_plays: "id user_id request boss won crate at"` (old: no such table). It guards no rule in `docs/rules/eric.md`.
- No other check changed or removed. New: `packages/server/test/claw.test.ts`, `packages/app/test/claw.test.ts`, `e2e/claw.spec.ts`.
