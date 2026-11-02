# Brief: Boss Battle picker, two rows on the computer (Haiku)

Worktree `/home/user/cr-bsrows`, branch `claude/boss-select-rows` (from main). Push as you go.

## Eric, Nov 2 (his screenshot: `docs/boss-select-rows/eric-before.png`, 1781 px wide)
"On desktop, I want two rows of whatever that comes out to. So it uses … that middle space there. And then everything else
bumps up. So that way you can see the bottom and start button. But the boss rows should go from 4 to 2 … everything else
should just move up. And just keep it within the confines of that large middle container that we utilize in the desktop.
But then if somebody resizes their screen, then I guess just revert it to like the mobile."

Today the Boss Battle picker on a computer shows the boss portraits 5 a row in 4 rows (the last row: the Hidden Boss and the
"?"), and the versus row and Start sit below the fold.

## What to build
- On a computer wide enough, the portraits (every boss, the Hidden Boss and the "?") go in **2 rows** (e.g. 9 + 8), filling
  the width of the middle column (between the side menu and the right panel), never wider than it. Same slanted card
  look and order. The versus row, the bubble and Start move up under them, so Start shows without scrolling at
  1280 x 800, 1440 x 900 and 1920 x 1080.
- When the middle column is too narrow for 2 rows at a sensible card size, it falls back to today's layout. CSS only if
  you can (a container query or a media query on the middle column's width). The phone layout is unchanged.
- Find the component and the styles: `packages/app/src/components/BossSelect.tsx`, `styles.css` (`.boss-select…`).

## Rules
- Nothing else changes: the phone, the picker's order, what a tap does, the admins-first bosses (Timber shows for admins).
- Tests: `e2e/boss-select.spec.ts` counts the rows' cards; keep it passing. Add one check on the computer project that the
  cards are in 2 rows and Start is in view at 1280 x 800. Run only that spec locally (`flock /tmp/claude-0/e2e.lock`).
- Stills: computer 1280 x 800, 1440 x 900, 1920 x 1080, and a narrow window showing the fallback; phone unchanged. In
  `docs/boss-select-rows/`.
- PR-body file `docs/boss-select-rows/pr-body.md`: what changed, the player-visible changes, the changed checks old → new.
