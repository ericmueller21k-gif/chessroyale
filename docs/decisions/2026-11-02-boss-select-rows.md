# Two rows of boss tiles on a computer (Nov 2, 2026)

Lane: light (layout and one style variable; no logic). Revises the computer's "five to a row" from
[2026-10-23-boss-select-sf.md](2026-10-23-boss-select-sf.md) and [2026-10-27-folio-wired.md](2026-10-27-folio-wired.md), which
said Eric could revisit it if he asked. He has.

Eric, Nov 2, on his screenshot (`docs/boss-select-rows/eric-before.png`): "On desktop, I want two rows of whatever that comes out
to. So it uses … that middle space there. And then everything else bumps up. So that way you can see the bottom and start button.
But the boss rows should go from 4 to 2 … everything else should just move up. And just keep it within the confines of that large
middle container that we utilize in the desktop. But then if somebody resizes their screen, then I guess just revert it to like the
mobile."

## What it is now

- **On a computer, two rows across the middle column.** The page takes the column's width (920 px at most), and the tiles fill it in
  two rows: nine and eight with seventeen tiles (an admin, with Timber), eight and eight with sixteen. Each row is centered; the
  same slant, gap and order. The versus row, the bubble and START move up under them: START is in the window at 1280 x 800,
  1440 x 900 and 1920 x 1080.
- **Everything else keeps its width.** The stage, the ways to play and the header stay at the 496 px column they had.
- **A narrower column keeps today's layout.** The two rows need the page's width (the column less its 32 px sides) to be 660 px
  or more, so each card is 90 px or more; under that, five a row as before (`@container rd-page`). At 1280 px wide the column is
  704 px: two rows fit. The phone is unchanged (its still is byte-identical).
- **The "?" in the two rows is full card height**, still 0.82 of a card wide, with the bosses' slant and a bigger "?". Half height
  beside the Hidden Boss put its slanted edge across the gap (the probe in the e2e spec caught it). Alone in a row of five it keeps
  its small size.

## Calls made

- The brief's "9 + 8" is seventeen tiles (Eric's admin view); a test account has sixteen, so 8 + 8. Both come from `rowSizes`'s
  order: the first row the longer.
- The threshold is the card size (90 px, as close to today's 96 px as the 1280 px window allows), not the window's width, so the
  rule follows the column; the column's width is the page's container width.
- Two rows are CSS only: the rows stay in the DOM as today, and on a computer their `display: contents` lets the cards flow into
  two lines. The one thing JS adds is `--bs-two` (the count for the first row).

## Checks

Changed in `e2e/boss-select.spec.ts` (old → new): the grid's rows on a computer 5, 5, 5, 1 → 8, 8; its cap "96 px" → "90 px or
more"; its "room each side" → the same 8 to 12 px buffer as a phone's; the "?" height on a computer half → full. The phone is
unchanged. One check is added: a computer test that the tiles are in two rows at 1280 x 800 and START is in view, and five a row at
1100 px.
