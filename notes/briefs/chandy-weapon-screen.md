# Chandy: tap him to see his rifle and its upgrades (Eric, Nov 18). Opus, high (characters lane: a screen with logic)

Branch `claude/chandy-weapon-screen` from main. About 1-1.5 h. Read CLAUDE.md, `.claude/LESSONS.md`, `.claude/agents/characters.md`,
`docs/rules/eric.md`, `docs/areas/bosses.md` (Chandy: the upgrade window), `docs/decisions/2026-11-18-chandy-bar-chirp.md`.

**Eric, Nov 18:** "Make it so when you tap chandy a weapon screen comes up that shows his gun and which upgrade he has (same themed
container for what we use for his upgrades)."

- In a battle with Chandy (phone bar and the computer's figure beside the board; solo and online), a tap on his figure opens a
  weapon screen in the **same container as his upgrade window** (reuse it): his rifle as it is now (its stage's drawing), and his
  five moves with which are unlocked (his `unlocked`, from the boss view), the ones still to come greyed (nothing hidden, Eric's rule),
  plus his upgrade count (N of 5) and, if it's on screen anywhere already, his meter. Closes with a tap outside, its X, or Escape.
- It never holds or changes the game: the clock runs as usual (it's a look, not a pause); it never covers the move he's playing in a
  way that hides it (check the moments: his upgrade window, Dodge, the queen lock); it closes itself if Dodge or the upgrade
  window starts. If his upgrade window is up, a tap does nothing extra.
- Before any upgrade: the rifle at stage 0 and all five greyed, "Capture a marked piece to upgrade" (or the line his window uses).
- If tapping a boss already does something (a line, a reaction), keep it and add the screen; say which in the PR.
- Mockup first (one still, phone 428 x 746) on `stills/chandy-weapon-screen`, then build. Big tap target; light and dark.

Checks: one focused e2e check in `e2e/chandy.spec.ts` (tap opens it with the right unlocked moves, closes; the clock keeps running),
unit test for what it shows from a boss view. Done: stills (phone first, then computer 1280 x 800), `.pr-body.md` (under 30
lines) and `.done`; push and end.
