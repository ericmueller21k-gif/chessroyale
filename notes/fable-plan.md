# What we do with the outside review (Nov 10, 2026)

Source: `notes/fable-audit-findings.md` (part 1) and `-2.md` (part 2), with proof tests beside them. I spot-checked the code
for: enforcement "ban" (settings.ts:3375), the speed cube, `/api/engine/score` with no sign-in, and `recordResult` without
`once` (lobby-do.ts:190). All confirmed. Pre-launch, `main` reaches Eric only, so nothing is exploitable yet; all of batches 1-3
must land before launch. One Opus helper at a time for `xhigh` (Eric's rule).

## Batches, in order (each its own PR)

1. **Trust in devices (xhigh, full lane).**
   - One seat per account per lobby, in the main lobby and Squads (a second socket takes over the first seat).
   - Claimed speed: clamp it and set `speedWeight` to 1 until speed is measured. Never pick two judges from one account.
   - Host scores checked for type and range (`okScore`).
   - Squads' cache stores only server-checked answers.
   - Squads refuses a seat token from another account.
   - Type-check `bossMove.move`; cap `crossCheck`.
   - Proof tests: `fable-many-seats`, `fable-lying-host`.
2. **Rewards, accounts and fair play (xhigh, full lane).**
   - `FAIRPLAY.enforcement` set to "review".
   - The reviewer token can't ban without an open case at the ban bar, and its answers carry no emails.
   - Sign-in required on `/api/engine/score` and `/ping`, with a per-account cap.
   - `recordResult` gets `once`, and one batch per player at a match's end (proof: `fable-match-end-save`).
   - The main lobby retries failed saves, as Squads does.
   - Welcome Crate only for server-timed solo games.
   - Ranked records retry for hours. The guest merge doesn't pay level rewards again.
3. **The boss and lone devices (xhigh).**
   - The server checks raid boss moves (refuse ones past the blunder guard, or run the brain on the engine server).
   - Where a reward depends on it, a lone device's answer is sampled on the engine server.
   - Squads' rewards get a daily cap.
4. **Rules fixes (xhigh, boss lane).** Save `strikeBots` and `bossLast` in the runner's snapshot; `sameScore` at the
   last cut; a missed move's streak bonus.
5. **Sign-in hardening (xhigh, full lane).**
   - The email code is tied to the browser, failures counted per address per day, 8 digits.
   - Per-session caps on sign-in emails.
   - Clean up cookie-less user rows.
   - Cloudflare Access on `/admin/*` for good (Eric).
6. **Phone load (high).**
   - Lazy boss art: running now.
   - Warm one engine, not four.
   - FAQ, Legal, AutoChess, Squads, solo and the match screens loaded on entry.
   - A static shell in index.html.
   - One video format in the offline cache.
   - Sidekick sheets cut on first use.
   - Reconnect jitter.
7. **Tests (high).**
   - Typecheck the tests and e2e (fix the 91 and 75 errors).
   - Fix tests that can't fail (boss-bubble-header:70, judges.spec, …).
   - Move 20-30% of logic-only e2e to units.
   - A WebKit smoke, a connection-drop test, a bad-field message test.
8. **Cleanup (Haiku-able, plain steps).**
   - Stale doc references.
   - Root `public/engine/`, `PauseMenu.tsx`, dead functions.
   - 121 MB of untracked-by-name images (check none are read).
   - `scripts/boss-art/out/`.
   - Declare `sharp`.
9. **Later, with design:**
   - 1 v 1 detection (sampled games, move-time and repeat-pairing signals).
   - The boss hooks (`turnSteps` …) to stop boss code leaking into shared files.
   - The text filter (squared letters, contact info).
   - Block and mute.
   - Ban evasion.
   - "Sign out everywhere".

## Eric's calls
- **Check that `TEST_SWITCHES` is not set** in the Cloudflare dashboard (Workers, chessroyale, Settings, Variables).
- **The shop's struck-through "50% off" prices.** Fable: a deceptive-pricing risk once money is real (a full price nobody
  was charged). Eric asked for it (Nov 9). It's harmless while look-only; decide before Stripe.
- **Paid random crates.** Fable: sell named items, coins and packs whose contents are shown first; keep random crates as
  free rewards; paid keys later with an 18+ check and region blocks. Before money goes live.
- **Launch scope.** Fable suggests one headline mode plus 1 v 1, Crowd at set hours, and others later. That's Eric's call.
- **Cloudflare Access on `/admin/*` permanently** (free on the Zero Trust he already uses).
