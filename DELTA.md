# Delta review: PR #1012, crates Nov 27, the fix round (full lane: crate grants)

Head reviewed: `0a685aea` (`origin/claude/crates-nov27`: fix commits `7b90aed1`, `553b096e`, `dec95369`, `a71c58d9`, then main merged in).
Checked against `REVIEW.md` on `claude/crates-nov27-review` and the fix brief `notes/briefs/crates-nov27-fixes.md`. Read-only, effort xhigh.

**Verdict: no blockers, no should-fix.** S1 to S4 are fixed, each with a check that fails without its fix where one was asked for. Of
the nits, N1 to N5 and N8 to N11 are fixed. N6 and N7 are not done: the brief said "comments only", but no comment changed. The grant
and the level-5 gate are untouched since the first review. Typecheck and the unit tests of core, app and server pass at this head.

## Blockers

None.

## Should-fix

None.

## Nits

- **D1. N6 and N7 weren't done.** `.done` says "S1-S4, N1-N10", but `a21dc881..0a685aea` leaves these two files alone.
  - N6: `packages/app/src/crate-open/timeline.ts:65` still says "no edge crossed on the way". At width 430, edge 2 sits 11 px left of
    the line, inside the 16 px pull-back, so the pull-back carries it over and back without a click.
  - N7: `scripts/render-crate-stings.ts:44` still calls `clickTimes(T.spinMs, WIDTH, STRIPS.crate.land)` with no `pullPx`, so Eric's
    preview WAVs drift a few ms from the game.
  - Both are comments or a preview script; nothing a player sees.
- **D2. A few stale "5 games" comments are left (N8).**
  - `packages/app/src/tutorial.ts:47`: "The Welcome Crates' goals (5 games, then 25)". The first is no longer earned with games.
  - `packages/server/src/welcome.ts:103`: "(for "Finish 25 games for your second Welcome Crate: 7/25")" quotes the
    `WELCOME_TEXT.progress` text this round removed.
  - `packages/core/src/settings.ts:4820-4822`: "a signed-in account earns one at each of `milestones` finished games". The line
    below it corrects this, but the summary still states the old rule.
- **D3. "Counts only what opens" isn't quite true yet (from before this PR).** `screens/Crates.tsx:248` and `docs/areas/shop.md:242`.
  - Failing case: you hold a Winter Crate and have 0 keys. Its row shows the padlock (`SeriesCrateRow`: `locked = !n || !keys`), but
    `heldSeries.length` still hides "Nothing to open right now.", though nothing can open.
  - This was already so before #1012, so it's not a regression. But the new comment and area-page line claim more than the code does.
    Either count `heldSeries` only when there's a key, or word the line as "a Welcome Crate held below level 5 doesn't count".
- **D4. N2's grey also reaches the page of a crate not yet earned.** `styles.css:26817-26818` greys `.welcome-crate-hero.locked`. The
  page hero's class is `${row.state}`, so Welcome Crate 2's page (state `locked`), and a guest's pages, are now at 0.7 opacity as well,
  not only the held crate's.
  - This matches the rows, which were already greyed that way, and Eric's "greyed until it applies".
  - But `.pr-body.md` lists only the held crate's page as greyed. Add one line to the PR body.

## Checked

- **S1 (the twist in the strip).**
  - `.cox-track .ia-twist { animation: none; }` (`styles.css:9185`) is in the same reduced-motion query and wins on specificity
    (0,2,0 against 0,1,0).
  - Both tracks are `.cox-track`: sharp at `CrateOpenStage.tsx:266`, blurred at `:268`. The reveal card (`:283`) and the risen item
    (`.cox-item`) sit outside them, so they still twist.
  - No other strip draws `ItemArt`. Crates.tsx `:1458` and `:1686` are the locker grid and the delete dialog, both still.
  - `gift-tube.test.ts` fails with the rule removed (run locally).
- **S2 (Chess Town).** The decision note, `shop.md:111` and `.pr-body.md` now say "everywhere but Chess Town … and the crate strip".
- **S3 (crates already held).**
  - The note says "Level 5 gates opening either, crates already held included (pre-launch only testers hold one)", and `shop.md:242`
    says the same.
  - The server gate is unchanged (`server/welcome.ts:176`, `:195`).
- **S4 (the notice under the walkthrough).**
  - `Walkthrough` reports `open` from a layout effect, and Home passes `held={tourUp}`. While it's held, `due` is false, so the notice
    adds no Escape listener and doesn't render.
  - The walkthrough's Escape closes it, and Preact re-renders in a microtask, so the notice's listener is added during that keydown's
    dispatch. The DOM copies a target's listener list when dispatch starts, so the same Escape can't reach the notice.
  - Home's first frame, with a profile already loaded: the notice can render once before `tourUp` turns true. That flips in the same
    pre-paint microtask, so it's never seen. The only trace is that OK's focus is dropped.
  - The quests overlay still waits, because `otherNoticeUp` reads the profile.
  - The e2e (`welcome-crate.spec.ts:42-58`) fails without the hold in two places: the notice's count is 0 under the tour, and no
    `/seen` post follows Escape.
  - Corner case: the raid view (`Home.tsx:1050`) renders `overlays` without `Walkthrough`, and an unmount doesn't report closed. The
    notice would only wait until the next home view, and reaching raid needs a tap through the tour, so I found no real path to it.
- **N1.** The unit test reads the keyframe from styles.css and compares it to `-TUBE_TWIST`. N2 is above (D4).
- **N3.** `below = !welcomeOpens(profile.xp)` covers either crate.
- **N4.** `nothingReady` now uses `some(canOpen)`. The e2e checks the line next to the held row.
- **N5.**
  - `tutorialCrateRows(..., signedIn)` gives a guest "Sign in" and empty bars. The unit test fails without it (run locally), and
    walkthrough.spec checks it as a guest.
  - Before the profile loads, a signed-in player would also see "Sign in", but the last slide is 12 taps in, so it has loaded by then.
- **N8, N9, N10, N11.**
  - N8: `welcomeProgress()` and `WELCOME_TEXT.progress` are gone, and typecheck finds no caller. The leftovers are in D2.
  - N9: the notes are now 103 and 112 words.
  - N10: `solo-abandon` expects exactly `[{ op_id: welcome:<acct>:5 }]`.
  - N11: the "well past level 5" sentence is gone.
- **Nothing else broken.**
  - From `a21dc881` to the head, `packages/server/src` changed one comment (`account-data.ts`). `packages/core/src` lost only the
    unused `progress` function. The grant (once per signed-in account, ever; idempotent; never a guest) and the server's level-5 gate
    (from `wallets.xp`) are as the first review checked them.
  - The main merge (`8e24b7ad`, #1013: town rides pace) touches none of this PR's files.
- **Guard tests (`docs/rules/eric.md`).**
  - The fix round edits no guarded file.
  - The PR's only guarded file is `e2e/shop.spec.ts`. Its "up is up" guard (`:1169`) isn't in the diff; the PR changes only the
    import line and the crate-page test (`:2112`).
- **Run locally at `0a685aea`.**
  - `npm run typecheck`: exit 0.
  - `npx vitest run packages/core packages/app packages/server`: 359 files, 5,161 tests, all passed.
  - With each fix undone, its test failed: the strip rule (gift-tube) and the guest rows (tutorial). Both were restored, and nothing
    is committed.

## Not reached

- The e2e specs, run locally (welcome-crate, walkthrough, the shop's crate page). The S4 and N4 e2e checks are reasoned, not run.
- CI at `0a685aea`: plan, unit and chess (1, 2) are green. The 15 e2e shards were still running when this was written.
- Frame rates, real phones, the stills.
