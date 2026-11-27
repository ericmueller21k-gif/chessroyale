# Crates and items, three asks (Eric, Nov 27 ~09:10 UTC). item-builder lane. Opus high; full lane if stored data changes

Read `notes/briefs/rules-common.md` first, then CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/shop.md`. Branch `claude/crates-nov27` from main.
(Eric's photo is NOT for any branch: described here only.)

1. **The barber-pole twist.** Eric's photo: his pawn on the ranked duel's placement screen ("HunChess · Placement 3/5", the "vs"), wearing
   the long staff with **gold, red and white diagonal stripes** (the Gift-Wrap Tube or the Candy Cane: find which). "This item is supposed
   to twist animation like a barber shop pole." Find whether the twist exists and where it doesn't play (that screen? everywhere?), and
   make it play wherever the item is drawn: the stripes scrolling along the pole on a loop, cheap (no per-frame repaint of the whole
   figure; a phone's frame rate checked). One focused check.
2. **The Welcome Crate (the golden ride crate) on first visit.** Eric: "a golden ride beta crate is given when you open the game for the
   first time on the main page, and it says go to your inventory to view it... it's only openable after level 5 is reached. But you can
   still view contents etc." Today (`packages/core/src/welcome.ts`, WELCOME_GIFT) the first is earned after 5 finished games, the second
   after 25. New: the first is given on the account's first visit to the main page (server-side, once per account, as now), with a
   notice in the game's style ("A Welcome Crate is waiting in your inventory" + a way there); in the Crates tab it's listed and its page
   shows what's inside, greyed with a padlock and "Reach level 5 to open" until level 5 (nothing hidden); opening is refused by the server
   below level 5. The director's call: the second Welcome Crate (25 games) stays as is; say so in the note. Accounts that already earned
   or opened one: unchanged. If this needs a stored-data change (a column/migration), say so in `.pr-body.md`: the director runs the full
   lane; otherwise targeted.
3. **Smoother opening (a "bug" to Eric).** "opening any crate glitches a bit because it loads the spinning slot thing fast when you click
   open, so it's a bit unsmooth for a moment... When you tap open crate instead of instantly going into the shuffle, it loads a still image
   of the slot, then when it's loaded it does its normal shuffle... like a rubber band style where the slot of items looks like it's
   pulled back slightly before going full speed into the normal shuffle spin." So: on Open, the opening layer shows the strip still
   (drawn, everything it needs loaded: art, sounds); then a short pull-back (a few px against the spin's direction, eased) and the
   spin at full speed as today. Measure the hitch before/after (the open's first second: long tasks, dropped frames) on a phone and a
   computer. The result shown and its timing after the spin don't change.
Tests: the shop/crate specs touched (one focused check each), unit tests for the welcome rule. Stills on `stills/crates-nov27` (a GIF of
the twist, a GIF of the opening's start, the locked Welcome Crate page). `.pr-body.md` at most 40 lines, `.done`.
