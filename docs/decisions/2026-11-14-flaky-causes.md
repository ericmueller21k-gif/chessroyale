# Flaky tests: their causes (Nov 13 to 14, 2026)

Eric, Nov 13: "fix the cause, not add a checker". Eight tests that failed once and passed on CI's retry, each asked first: is the game
wrong, or the test? Where a cause is the game's, it's fixed in the game; where it's the test's, in the test; where it lives in a guard
test of `docs/rules/eric.md` (Eric's OK needed), it's written up in the PR instead.

- **Game: fonts arriving after the first paint reflowed the page** (crate-banner:44). The three fonts are `font-display: swap` and
  were fetched only once the CSS asked, so a crate page drawn before the pixel font came moved its rows 2 to 5 px when it did. The
  fonts are now preloaded in `index.html` (66 KB, all three used by every first screen), and the crates' pixel title has its own line
  height (hub.md's Oct 28 rule: a text whose `normal` line height differs between fonts gets a fixed one).
- **Game: a way through tapped as a room fades in was dropped** (hidden-boss-room:242's own comment: "a tap while the landing still
  fades in is dropped"). As Go out's was on Nov 12 (`outNext`), the stairs' Go up (or a back door) tapped then waits and goes through
  (`passNext`). The Nov 12 lesson: a guard that refuses an action while something is busy keeps the tap.
- **Test: taps read from a moving camera** (town-desktop:36). It tapped the circus where it was as the camera glided: the shared
  `tapInTown` (the view held still over drawn frames). The new `settled(page, read, ms)` in `e2e/helpers.ts` is the one helper for
  "wait until this holds still" in test code, used for the town's boxes there in place of a fixed 600 ms.
- **Test: the server read before the save it waits for** (global-chat:46): polled until the save lands.
- **Test: Node's fetch in a route met a reset kept-alive connection** (live-window:114, ECONNRESET): retried once, as a browser does.
- Guard tests, written up only: town-street:226 (the phone's `touchscreen.tap` sends its start and end apart; a frame between them
  on CI's software WebGL can outlast `streetHoldMs`, making the tap a run: the likeliest cause, not proven) and hidden-boss-room:242 (fixed in the game, above).
- Not reproduced, no failing log found: friends:40 (10/10 locally), desktop-board:260 (only Nov 10's, fixed then by #604).
- Round 2: boss-side:204 (a line said before the resize event set its room: `settled()` first; main 1/10, now 10/10) and
  public-profile:64 (the mockup's times computed at import, a midnight before the test ran: computed at use). fairplay:65 (a guard)
  not reproduced (10/10), written up only.
