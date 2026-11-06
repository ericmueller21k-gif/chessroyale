# Brief: both Welcome Crates always showing, locked, each with its own meter (UI; Haiku)

Worktree `/home/user/cr-meters`, branch `claude/welcome-meters`, from main (Welcome Crates live, #509). Set it up with `npm ci`.
Ports 8979, inspector 9479. Include notes/briefs/rules-common.md (American English). Push early and often.

## Eric, Nov 6
"The crates should be in your inventory right away … you get both crates, but then they just have meters … like 1 out of 5 … 1 out
of 25 unlock tracker … it's not like after 25 it just appears; they sit there."

## Today
One Welcome Crate row in the Crates tab (`packages/app/src/screens/Crates.tsx`, `welcome-crate-row`, `welcomeLine`). It shows the
next milestone's progress, and the crate is only granted (`welcome_crates` row) when the milestone is reached.

## Build (app UI only; the server's grant rules stay exactly as they are)
- **In the Crates tab,** show **two Welcome Crate rows from the start** for every signed-in player: "Welcome Crate 1" (5 games) and
  "Welcome Crate 2" (25 games). Same art, "Thank you for being an early tester!" and "Not tradeable".
- **Each row shows its own meter:** a progress bar and "3/5" or "3/25", from the account's finished-game count, which the account
  already has (`locker.welcome.games` or `welcomeProgress()`).
- **The states:**
  - **Locked:** the bar is filling, with a lock icon and the row greyed a little. Tapping shows its page with "Finish 5 games to
    unlock" and no Open.
  - **Ready:** the server has granted it. A full bar, "Ready", and Open, using the existing opening.
  - **Opened:** "Opened" and the ride it gave.
- **Guests:** show both rows locked with "Sign in to earn" (guests never get them; the server already refuses).
- **If they're in the locker too** ("inventory"), check how crates you own show today. If owned crates show in the locker, show both
  there the same way (locked with meters). Say what you did.
- **The earned notice stays.**
- **The free crates' count in `e2e/crate-banner.spec.ts`** excludes `.welcome-crate-row`. Keep that working with two rows.

## Done
- **Unit tests:** the two rows' states from (games, granted, opened); the meters' numbers.
- **e2e:** extend `e2e/welcome-crate.spec.ts`:
  - both rows show at 0 games, locked, 0/5 and 0/25;
  - at 4 games, 4/5;
  - at 5, crate 1 is ready and crate 2 shows 5/25;
  - opening crate 1;
  - at 25, crate 2 ready.

  Phone and computer.
- **Stills** in `docs/welcome-meters/`: locked at 3 games, one ready, both opened (phone and computer).
- **The PR body** in `docs/welcome-meters/pr-body.md` (lane: the shop and crates area), listing every player-visible line and changed
  check old → new.
- Don't open the PR.
