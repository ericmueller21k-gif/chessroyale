# Home: the options panel is always there, greyed until you pick a mode; nothing moves (Oct 25, 2026)

Eric, Oct 25, with two desktop screenshots of home: "the menu buttons should never be like invisible… when you load into
the desktop. It should still show the options for crowd or for classic or whatever. It's just like they're just not
selectable until you select the mode. And it should be below it… they're not showing until I click one, and I feel like
we had this before." Then, for phone and computer alike: "The default should remain what it is, which is nothing is
selected, but it shows you still the menu below it… I prefer just having both menus show and then they're both
unselected. And then the other one… is just like slightly grayer, so it's clear that like you're not selecting anything
from this until you pick a game mode." Lane: `hub`. Area page: [hub.md](../areas/hub.md). Standing rule:
[2026-10-18-home-steady-layout.md](2026-10-18-home-steady-layout.md).

## What was wrong

The Oct 24 home tidy-up ([2026-10-24-home-tidy.md](2026-10-24-home-tidy.md), "No panel until a mode is picked") removed
the panel from home's first view. Under the RANKED row there was nothing until a mode was tapped, so the matchmaking
options (Default, Bots off, Solo and the ⓘ) were not on screen at all, and the first pick brought them in and pushed the
RANKED row up by the panel's room (68 px on a phone, about 70 px on a computer; the board above a computer's gave up
its room). That broke the Oct 18 rule: one panel, one fixed height, nothing moving when a mode is picked. Eric's word
on Oct 18 was that the panel is dedicated to what the pick needs, "or if there needs to be options for it"; it was
removed when there was nothing to pick yet, which is when the options should show.

## What's back

- **The panel is there from the first view**, in the same place (under the RANKED row, above PLAY), at the same fixed
  height (58 px) as with a mode picked, on every layout.
- **With no mode picked it shows 50 v 50's options** (Default, Bots off, Solo, and the ⓘ), **greyed** (`idle`: the
  buttons at 60% opacity, no press effect, the pointer's default), **none selected** (each has `aria-checked="false"`, no
  selected look), and **not tappable** (`aria-disabled="true"`; the tap does nothing, and the ⓘ's words do not open).
  The mode row above is as it was: nothing selected.
- **The first pick wakes the options** with their usual default (Default, or whichever matchmaking the device kept)
  selected, as before. Nothing moves.
- **The line under PLAY** keeps its fixed room with no mode picked: it is empty (no "Tap a mode above to play"; Eric
  removed that text on Oct 24 and it stays removed). PLAY stays dimmed.
- **Nothing else moves on a pick**: PLAY, the "Other modes" label, the Boss raid card, Auto chess, and (computer) the
  live board preview keep their boxes from the first view through every pick (50 v 50, its ⓘ open and closed, 1 v 1,
  Squads) and within 1 px.

## Measurements

Measured in Chromium on this branch (boxes in CSS px; the first view and the view after 50 v 50 are the same in every box
below, to within 0.1 px):

| Computer, 1280 × 800 | board | RANKED row | panel | PLAY | "Other modes" | Boss raid card | Auto chess card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First view and after 50 v 50 | y 24, 312 tall | y 348, 82 tall | y 442, 58 tall | y 512, 59 tall | y 608 | y 632, 64 tall | y 708, 64 tall |

- Phone (390 × 844, 320 × 640, 360 × 640, 320 × 568 and the computer's 1440 × 900 and 1280 × 800 are all in the guard test
  below): the panel is 58 px tall in every state, and PLAY, the label and both cards keep their boxes within 1 px from the
  first view through every pick and both ⓘ states.
- Before (Oct 24, [2026-10-24-home-tidy.md](2026-10-24-home-tidy.md)): the first pick raised the RANKED row by the panel's
  room, about 68 px on a phone and about 70 px on a computer. Now it moves 0 px.
- Live window: at 1280 × 800 the computer's live-window board in the first view is now about 238 px, the same as after a
  pick before. `e2e/live-window.spec.ts`'s floor for that size went from 240 px to 230 px (a sanity floor from the live
  window's first commit, not a rule).
- The tag (phone): with the panel there from the first view, a card under 190 px tall puts the tag beside the pawn in the
  first view as well as after a pick. Measured with the same width and height: 320 × 740: card 171 px tall (icon 38 px,
  name and rating two lines of 54 px at 320 px wide, where the rating line wraps); 375 × 740 and 430 × 740: card 167 px
  (icon as tall as the two lines, 38 px). On main the first view at those sizes had no panel, so the card was taller and
  the tag sat above the pawn; after a pick on main the card was already short, so this is the layout players had after
  their first pick, now from the start.

## Player-visible changes (old → new)

- First view, under the RANKED row: nothing → the matchmaking options (Default, Bots off, Solo) and the ⓘ, greyed, none
  selected, not tappable.
- First pick (50 v 50, 1 v 1, Squads): the RANKED row and the board moved up by the panel's room (about 68 px on a phone,
  about 70 px on a computer) → nothing moves. The options wake up with their default selected.
- Your tag on a phone in the first view: above your pawn's head → beside it, on a phone whose card is under 190 px tall
  (measured: 320 × 740, 375 × 740, 430 × 740). This is the layout home already had after a pick (the panel's room makes
  the card short); the first view now has it too. It is a judgement call the director should look at (see the PR).
- Everything else as it was on Oct 24: the copy, PLAY's dimming, the line under PLAY (empty until a mode is picked), the
  Boss raid and Auto chess cards, the pawn card, and the RANKED row's labels.

## Tests

- `e2e/home-ranked.spec.ts`, "Eric's rule (Oct 18, Oct 25): home's options panel is always there, greyed until a mode is
  picked, and home never moves": at 1280 × 800, 1440 × 900, 390 × 844, 360 × 640 and 320 × 568, on the phone and the
  desktop projects. First view: the panel is there and idle; its options and the ⓘ are visible and disabled, none is
  selected, no selected look in it; a forced tap on each does nothing (the ⓘ's words stay shut); PLAY, "Other modes",
  both cards, the panel and (computer) the board keep their boxes within 1 px through the first view, the taps, the
  first pick (Default then selected), the ⓘ open and closed, 1 v 1 and Squads. The test is marked with "Changing this
  test needs Eric's OK (docs/rules/eric.md)." (That file is not in the repo; the comment is kept as the brief gave it.)
- `e2e/home-ranked.spec.ts`, "home keeps still": the first-view check now expects the panel, and the first pick is
  checked for no movement at all (it used to expect the RANKED row to rise). Its other checks are unchanged.
- `e2e/home-layout.spec.ts`, the computer's column test: the panel is there and idle before a pick, its first option
  disabled; PLAY dimmed. Its other checks are unchanged.
- `e2e/home-layout.spec.ts`, "your tag sits above your pawn's head…": its icon-as-tall-as-the-two-lines and icon-level
  checks now run only on a tall card. They failed at 320 px in the first view because the first view is now the short
  card (171 px at 320 × 740, with the rating line wrapping). The beside-the-pawn checks run on a short card as before
  (the icon left of the name, the name beside it), and the square check runs on both. This narrows an assertion, so the
  director should confirm it. The alternative was changing the beside layout, which the Oct 24 decision does not ask for.
- `e2e/helpers.ts`, `pickMode()` with no argument: it used to click 50 v 50 when there was no panel. Now it clicks 50 v
  50 when the panel has the `idle` class (nothing picked), so a test that has already picked (or `?mode=classic`) is
  left alone, as before.
- `e2e/live-window.spec.ts`, the board's floor at 1280 × 800 (`h >= 800 ? 240 : 150`) is now 230. The panel takes its 58 px
  in the first view, so the board is about 238 px there, the same as after a pick. Nothing else in the spec changed.
