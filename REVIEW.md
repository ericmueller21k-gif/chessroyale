# Review: PR #1012, crates Nov 27 (full lane: crate grants)

Head reviewed: `a21dc881` (`origin/claude/crates-nov27`), diff `origin/main...` (30 files). Read-only, effort xhigh.

**Verdict: no blockers.** The grant is server-side, idempotent, never given to a guest and leaves existing rows alone. The level-5 gate
is the server's and reads the server's XP. I found four should-fix items: one perf risk the PR didn't measure, one claim that isn't
true, one call that should be written down, and one notice that can get lost. Nits follow.

## Blockers

None.

## Should-fix

**S1. The twist runs inside the crate strip, and nobody measured it there.** `packages/app/src/styles.css:9179` runs `.ia-twist` wherever
the tube is drawn. The strip's tiles draw `ItemArt` without `live` (`screens/Crates.tsx:977`), so the twist runs there too.
- Failing case: a Winter crate lands on Fischer Random. Its second strip (30 tiles, `STRIPS.fischer`) draws Legendary and Mythic items by
  their odds. The tube is 40 of the 100 (`crates.ts`: Legendary 80, shared with the cane), so about 12 tubes run in the sharp track and
  about 12 more in the blurred copy.
- Why it costs: each frame repaints those SVGs inside the moving `will-change: transform` track. The blurred copy also has
  `filter: url(#cox-hblur)` (`crate-open/crate-open.css:134`), so its filter is redrawn every frame for the first ~45% of the spin.
- This is the rarest and most dramatic spin. Before this PR, only the occasional shiny decoy animated in a strip. The PR measured the
  profile page (p95 16.8 ms) and the first strip's start, where the tiles are presents, not items.
- Fix: one line, `.cox-track .ia-twist { animation: none; }`. At strip speed the twist can't be seen anyway, and the reveal card still
  twists. Or measure the Fischer second spin on a 4×-slowed phone.

**S2. "Everywhere it's drawn" isn't true: Chess Town shows a still tube.** The decision note, `docs/areas/shop.md:110` and the PR body
all say the twist plays everywhere, and Eric's ask was "wherever the item is drawn".
- In Chess Town your pawn is `Avatar` drawn once off screen and turned into still pictures (`town/you-look.ts:3-46`), so the tube doesn't
  twist there. The same goes for any view drawn on a canvas.
- Fix: either say so (decision note, area page, PR body: "not in Chess Town: its sprite is a picture"), or animate it in the town.
  Animating costs town frames; "simple beats flashy" suggests saying so. Director's call.

**S3. The level-5 gate also locks crates that were already earned and not yet opened. Write the call down, or exempt them.** The brief
says "Accounts that already earned or opened one: unchanged", and the decision note says "crates earned or opened before are untouched".
But `openWelcomeCrate` (`packages/server/src/welcome.ts:176` and the condition at `:188`) refuses every unopened row below
`WELCOME_OPEN_XP`.
- Failing case: an account earned crate 1 on Nov 20 from 5 short games (a few hundred XP, level 2) and hasn't opened it. After this
  deploys, its page greys Open with "Reach level 5 to open", and `POST /api/locker/open` answers 400.
- Pre-launch this touches only Eric and testers. Either add one line to the note ("the level rule covers crates already held, Eric's
  'only openable after level 5'"), or exempt rows granted under the old rule. The row's stored `games >= 5` marks those, with no schema
  change.

**S4. The first-visit notice can be lost under the walkthrough.**
- Why it happens: the walkthrough opens on every home visit until "Don't show again" is ticked (`tutorial.ts:88`,
  `shouldSaveSeen`). So a guest who signs in usually lands on a home that shows both. The walkthrough (`.wt-root`, z-index 900,
  `styles.css:26907`) sits over the notice (`.locker-dialog-back`, z-index 60, `styles.css:8922`).
- Failing case, on a computer: both listen for Escape on `window` (`Walkthrough.tsx:250`, `WelcomeNotice.tsx:39-44`). Escape to skip
  the walkthrough also runs the notice's `close()`, which posts `/api/locker/welcome/seen`. The notice is marked seen without ever being
  visible.
- On a phone: the notice shows once the walkthrough closes, which is fine.
- Why tests miss it: e2e never sees the two together, because every test sets the tutorial key (`e2e/helpers.ts:19-33`).
- This was already possible with the old notice. Since the notice now comes on the first signed-in visit, it's now the usual path.
- Fix: hold the notice while the walkthrough is open, as the quests overlay already waits for it (`quests.ts:146`, `otherNoticeUp`).

## Nits

- **N1.** The keyframe hard-codes `translateY(-27.6px)` (`styles.css:9184-9188`), while the cell height is computed in TS (`TUBE_TWIST`,
  `Items.tsx:88`). Changing `BAND` would leave a seam on every loop, and the e2e check compares the CSS literal, not `TUBE_TWIST`. Pass
  it as a CSS variable from `TUBE_TWIST`, or have the unit test read the stylesheet's value.
- **N2.** The held crate's page hero gets `locked level-locked` (`Crates.tsx:858`), but no CSS uses them: only
  `.welcome-crate-row.locked` has styling (`styles.css:26812`). The page's crate isn't greyed, only its Open button. Either style the
  hero the way the row is styled, or drop the classes.
- **N3.** The first notice's "see what's inside now, and open it at level 5" (`WelcomeNotice.tsx:60`) also shows for an account already
  at level 5 or above. That can happen with an old account backfilled with an unseen crate, or one with fewer than 5 counted games but
  2,000+ XP. Meanwhile the second crate's notice doesn't mention the level for an account below 5.
- **N4.** A held, level-locked crate counts as "ready" (`Crates.tsx:243-247`), so "Nothing to open right now." no longer shows even when
  nothing can be opened.
- **N5.** A guest on the walkthrough's last slide sees "Level 5 · 1 of 5" for a crate they don't have; it comes when they sign in
  (`tutorial.ts:123`). Plain language could say "sign in".
- **N6.** The `clickTimes` comment (`crate-open/timeline.ts:64`) says no tile edge is crossed during the pull-back. With a window where an
  edge sits within 16 px left of the center line (width 430: edge 2 at −11 px), the pull-back carries that edge over the line and back,
  silently. Harmless, but the comment claims too much.
- **N7.** `scripts/render-crate-stings.ts:44` (Eric's audio preview) computes clicks without `pullPx`, while `cues` now starts at
  `T.spinAt`. The preview drifts a few ms from the game. It isn't player-facing.
- **N8.** Stale comments and text:
  - `Crates.tsx:408` and `:844` still say "Finish 5 games to unlock".
  - `account-data.ts:173` still says "at 5 and 25 finished games".
  - The `core/src/welcome.ts` header (lines 8-12) still says "completing 5 games".
  - `WELCOME_TEXT.progress`'s 5-game wording, and `welcomeProgress()` (`account.ts:612`, which has no caller), now describe a rule that
    no longer applies.
- **N9.** The decision notes run 165 and 155 words; the rule is about 120.
- **N10.** `solo-abandon.test.ts:102` now ignores every `welcome` ledger row. A tighter check would expect exactly one row,
  `welcome:<id>:5`.
- **N11.** The note's "25 games are well past level 5" isn't guaranteed: a counted game can pay as little as 10 XP. Only the reasoning is
  off, since the gate covers both crates.

## Checked

- **The grant.** `welcomeGamesNeeded(5) = 0` feeds both the pre-check and the ledger op's condition, so a signed-in account's first
  `profile()` (`/api/me`, and sign-in through `signInAs`) grants crate 1.
  - The op id `welcome:<acct>:5`, the `NOT EXISTS` condition and `PRIMARY KEY(user_id, milestone)` make it once-only across reloads, two
    tabs and races. The existing 12-way concurrent-grant and racing-`first` unit tests still apply.
  - Guests are excluded by `SIGNED_IN`, both in the games read (no ledger account is made) and in the op's condition.
  - Existing rows are skipped. The stored key is still 5. There's no schema change.
  - The sign-in merge drops a guest's rows (it never has any). Deletion and the download include `welcome_crates`, unchanged.
- **The gate.**
  - The server checks XP before opening (`xpOf`, from `wallets.xp`, the same source as the profile's `xp`), and the op's own condition
    checks it again inside the transaction.
  - `/api/xp/test` exists only where `TEST_SWITCHES` is "1", so no client in production can skip the level.
  - `isWelcomeCrate` sends every Welcome open to `openWelcomeCrate`; no other route opens one.
  - With none waiting, the "again" answer is unchanged.
- **The client.** `canOpen` is computed from `levelOf(profile.xp)`. The page greys Open, shows the padlock and "Reach level 5 to open", and
  lists every ride: the e2e checks `odds-row` count = `WELCOME_CRATE.items.length`.
- **The notice.**
  - It shows once: `seen` is set, and the e2e confirms it doesn't come back.
  - `first` is `next === 25`.
  - Go to inventory marks it seen, then renders `InventoryLayer` (Crates), which works because the layer state is checked before `due`.
  - The quests overlay waits for it.
- **The twist.**
  - CSS only, inside the reduced-motion `no-preference` query.
  - The clip is fixed while the cells move.
  - The cells cover the tube even shifted a whole cell (5 cells from y 11.4 to 149.4).
  - The blotches are the same in every cell, so there's no seam.
  - It repaints the avatar's front-items SVG, not the pawn's.
- **The pull-back.**
  - Keyframes are continuous at `spinAt` (+16 px).
  - The blurred copy starts at `spinAt` (`fill: forwards`), so the strip is sharp while the answer comes.
  - Clicks are re-solved for the extra distance, and every cue is shifted by `spinAt`.
  - Every beat after the spin keeps its timing from the spin's first frame. Total `stop` = `spinAt + spinMs + settleMs`.
  - The second strip (`beam`) has no pull-back. With reduced motion the strip waits, 0 px.
  - The land and shake sounds use relative durations, so they're unchanged.
  - The `TileView` memo works: `decoys.slice()` keeps the 45 tiles' objects.
  - Nothing else seeks `__crateAnims` by absolute time.
- **Do the new checks fail without the change?** Reasoned, not run:
  - Level-5 unit test: remove both gates and it opens. Remove only the pre-check and the op isn't applied, so the answer is
    `NO_WELCOME_CRATE` instead of `tooLow`.
  - First-visit unit test: no grant without `welcomeGamesNeeded`.
  - Twist e2e: there's no `.ia-twist` before this PR.
  - Pull-back e2e: before this PR the still strip's blurred copy was at 0.95 opacity, and nothing moves to x > 0.
- **The e2e helpers.** `withEmail` adds only `GET /api/me` and `POST /api/locker/welcome/seen`. That `/api/me` settles only solo games
  24 h stale, so `backdateSoloBattle`'s minutes aren't affected. If the `seen` post failed, the notice would block a tap visibly, so it
  can't hide a failure that way. What tests can no longer see is the notice over other screens (see S4).
- **Guard tests (`docs/rules/eric.md`).** None changed. The only guard in a touched file is shop.spec's "up is up" test, which isn't in
  the diff.
- **CI at `a21dc881`.** `check` and `unit` are green. The full e2e suite (15 shards) was still running when this was written.

## Not reached

- Running anything locally: there's no `node_modules` and nothing was installed. The test claims above are reasoned from the code.
- Frame rates on a real or emulated phone, including S1's Fischer spin.
- The stills on `stills/crates-nov27`.
- The e2e suite's final result at this head.
