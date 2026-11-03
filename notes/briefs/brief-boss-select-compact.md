# Brief: Boss Battle picker, shorter cards (Haiku)

Worktree `/home/user/cr-bscompact`, branch `claude/boss-select-compact` (from main 9dc41d67; made, pushed, `npm ci` done).
Include notes/briefs/rules-common.md. Push as you go.

## Eric, Nov 3
"Because there's less room for the boss menu now on the phone ... slimming down vertically the boss a little bit, so they're more
compact. Which would also impact how they look on desktop as far as each height of the container for each boss, but that's
probably what we're gonna have to do because we still have a couple more bosses to add."

## What to build
- The Boss Battle picker (`packages/app/src/components/BossSelect.tsx`, `styles.css` `.boss-select…`): make each boss's card
  **shorter** (less height per card) so more bosses fit and the versus row, the bubble and Start sit higher. Phone first; the
  computer's 2-row layout (Nov 2, `docs/boss-select-rows/`) gets the same shorter cards and still fits its middle column.
- Keep the same look (slanted cards, portraits, order, names readable, tap targets at least 44 px). Crop the portrait's empty space
  rather than shrinking the boss; no face or name cut off for any boss (check every one, Dash and Timber too: log in as an admin
  in e2e so the admins-first bosses show).
- Leave room for 2-3 more bosses: say how many rows the phone shows today and with your change, and where Start sits.
- Nothing else changes: what a tap does, the order, admins-first rules.

## Done
- `e2e/boss-select.spec.ts` keeps passing; add one check that on the phone (390 x 844) Start is in view without scrolling with
  every boss shown to an admin, and the computer check from Nov 2 still holds. Run only that spec locally, under the lock.
- Stills before and after: phone 390 x 844 and 375 x 667 (iPhone SE), computer 1280 x 800 and 1440 x 900, as an admin. In
  `docs/boss-select-compact/`.
- PR-body file `docs/boss-select-compact/pr-body.md`: what changed, card height old → new px, rows old → new, the player-visible
  changes, changed checks old → new. Push; no PR.
