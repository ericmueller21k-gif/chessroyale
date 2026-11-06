# Brief: the first-time walkthrough, and the HunChess Handbook (UI; Haiku)

Worktree `/home/user/cr-tutorial`, branch `claude/first-tutorial`, made **from `claude/welcome-crate`**, since it needs its
Welcome Crate progress. Set it up with `npm ci`. Ports 8982, inspector 9482. Include notes/briefs/rules-common.md (American
English). Push early and often; the container can restart.

**Hard pause at 02:59 UTC** (Eric): commit and push at a safe point by then and stop with a short report. It resumes later on Eric's
go-ahead.

## Eric, Nov 6 (trimmed)
"When you make an account, a 30-second walkthrough … your first-time login walks you through and points to each thing and gives
an explanation … the message moves its way down the screen … keeps the focus on each … instead of OK, 'tap anywhere to continue', so
you keep tapping slide by slide … The last two: one says, if you want to recap any of this, go to the HunChess Handbook, which is in
the settings … the last is the pop-up for your crates: the first you get after 5 games, the next after 25, with your progress bar on
each … then a 'don't show me this tutorial again' checkbox … and 'go to your inventory now to see them'."

## Build
1. **The walkthrough.** It shows on a player's first visit to the home menu after signing in (also for guests), once per device
   unless "Don't show this again" is left unticked at the end.
   - **The look:** a dimmed screen with a spotlight on one thing, and a short bubble with an arrow pointing at it.
   - **The bubble moves down the screen,** item by item, in the menu's own order: Play, Chess Town, Boss Battle, Play with friends,
     Shop & crates, Profile, Settings, and anything else in the menu. Check `screens/Home.tsx` and the computer's side menu.
   - **The text:** one or two short lines per item, plain and friendly (draft them from the FAQ's sections).
   - **Moving on:** "Tap anywhere to continue" at the bottom. A tap anywhere moves to the next slide. A small "Skip" in a corner ends
     it.
   - **Slide n−1:** "Want a recap any time? Open the **HunChess Handbook** in Settings." The spotlight is on Settings.
   - **The last slide: your Welcome Crates.**
     - "Finish 5 games to earn your first Welcome Crate, and 25 for your second."
     - Two progress bars (e.g. 2/5 and 2/25), from the Welcome Crate's progress on the account (`welcomeProgress()` or what that
       branch exposes; if the 25-game crate isn't there yet, show 5 only and leave the 25 behind a flag).
     - "Go to your crates any time to see them" with a button that opens the Crates tab.
     - A "Don't show this tutorial again" checkbox, ticked by default.
     - Tapping anywhere or the button ends it.
   - Phone first; never covers the browser bar; works on the computer's side menu layout too.
   - Reduced motion: no slide animation.
2. **The HunChess Handbook.**
   - Rename the player-facing FAQ to **"HunChess Handbook"** everywhere players see it: its title, the links to it, and Settings.
     Code ids can stay.
   - Put a clear **"HunChess Handbook"** row in Settings that opens it. Keep every existing link into its sections working.
   - Add a short Handbook section for the Welcome Crates (5 and 25 games, not tradeable) if one isn't there.
3. **Replay:** a "Show the walkthrough again" row in Settings, next to the Handbook.

## Done
- **Unit tests:**
  - the slide order follows the menu;
  - the last two slides;
  - the flag stored and honored;
  - Skip;
  - the progress values shown.
- **e2e** (phone and computer):
  - a fresh device sees the walkthrough;
  - tapping through every slide;
  - the Handbook slide;
  - the crates slide with progress;
  - "Go to your crates" opens Crates;
  - not shown again when ticked;
  - shown again via the Settings row;
  - Settings' "HunChess Handbook" opens the Handbook.
  - Update every check that names "FAQ" in player text, old → new.
- **Stills** in `docs/first-tutorial/`, phone and computer: three menu slides, the Handbook slide, the crates slide, and Settings with
  the two new rows.
- **The PR body** in `docs/first-tutorial/pr-body.md` (lane: full e2e if shared files change, else the home and settings areas;
  say which), listing every player-visible line.
- **A decision note** in `docs/decisions/2026-11-06-first-tutorial.md`, quoting Eric.
- Don't open the PR. This merges after the Welcome Crate.
