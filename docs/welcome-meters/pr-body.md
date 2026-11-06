Title: Welcome Crates: both rows show from the start, each with its own meter

Lane: the shop and crates area (Crates tab, Welcome Crate page).

## What changed

Eric, Nov 6: "you get both crates, but then they just have meters … like 1 out of 5 … 1 out of 25 unlock tracker … it's not like after 25 it just appears; they sit there."

The Crates tab now shows two Welcome Crate rows from the start, for every player, instead of one row that appeared only as a progress hint. Each row has its own meter and state. The server's grant and opening rules are unchanged; this is the app's display only.

- `packages/app/src/welcome-rows.ts` (new): reads the locker's `welcome` (games, next, unopened, item) and gives the two rows' states, meters and rides. Crates open in order, so the first `earned - unopened` are opened, the next `unopened` are ready, and the rest are locked.
- `packages/app/src/screens/Crates.tsx`: both rows in the Crates tab; a Welcome Crate page per row; a crate's page opens at its top.
- `packages/app/src/styles.css`: the locked row's padlock, the meter's bar, and the locked look.
- Tests: `packages/app/test/welcome-rows.test.ts` (new, 9 tests: each row's state from games, granted and opened; the meters' numbers; guests; each opened crate's ride; resume).
- e2e: `e2e/welcome-crate.spec.ts` extended (phone and computer).

## Player-visible text

Crates tab, both rows (same art, same blurb, "Not tradeable" on each):
- "Welcome Crate 1" and "Welcome Crate 2" (names)
- "Thank you for being an early tester!"
- Meter: "0/5" … "4/5", "0/25" … "24/25", then "5/5" and "25/25" once ready or opened
- Locked: "Finish 5 games to unlock" and "Finish 25 games to unlock" (a padlock on the crate, the row greyed a little)
- Guests, both rows: "Sign in to earn"
- Ready: "Ready" (full bar, Open on its page)
- Opened: "Opened", and the ride it gave (its name, e.g. "HunChess Pen Pony")

Welcome Crate page (each row's): the same name, blurb, "Not tradeable", meter and line above; the paragraph reads "Welcome Crate 1 for finishing 5 games … Welcome Crate 2 at 25 …" (was "one for finishing … another at …"). "▶ Open" is greyed until the crate is ready, then opens it (unchanged).

Removed text: "You have 1. Open it!", "Finish 5 games to earn your Welcome Crate: 4/5", "Finish 25 games for your second Welcome Crate: 5/25", "Both opened. Their rides are in your locker.", "Sign in to earn it." (now "Sign in to earn").

Unchanged: the "You earned a Welcome Crate!" notice, the reveal, the locker's rides.

Other behavior: a crate's page (any crate, not only the Welcome Crates) opens at its top. Before, it kept the list's scroll position, so the gambling ring could sit off screen after a tap on a row lower down the list (it's always at the top of the crate pages).

## Owned crates and the locker

Owned crates show in the Crates tab today (the "Crates × N" stock and each boss crate's "You have N" row), not in the locker, so the Welcome Crate rows stay in the Crates tab too. The locker is unchanged: it lists the rides you've opened, as before.

## Judgment calls

- The locked page keeps its "▶ Open" button, greyed and not tappable (the standing "nothing hidden" rule), rather than removing it.
- A guest's rows show their finished-games meter too (0/5 for most guests); only the line says "Sign in to earn".
- The padlock sits over the crate's corner, inside the row, so nothing moves.

## Changed checks (old → new)

`e2e/welcome-crate.spec.ts` (no check removed; the rest of the spec is unchanged):
1. At 4 games: one row (`.welcome-crate-row[data-crate]`), named "HunChess Welcome Crate", "Finish 5 games to earn your Welcome Crate: 4/5", class `none` → two rows (`data-welcome-n` 1 and 2), named "Welcome Crate 1", "4/5" and "Finish 5 games to unlock", class `locked`.
2. At 5 games, ready: "You have 1. Open it!" → "Ready" and "5/5" on row 1, not `locked`; row 2 "5/25", `locked`.
3. Crate 1's page name: "HunChess Welcome Crate" → "Welcome Crate 1".
4. After opening crate 1: `.welcome-progress` "Finish 25 games for your second Welcome Crate: 5/25" → "Opened"; the list then shows row 1 "Opened" and row 2 "5/25", `locked`.
5. At 25, crate 2 ready: "You have 1. Open it!" → "Ready" and "25/25" on row 2; after it opens, `.welcome-progress` "Both opened. Their rides are in your locker." → "Opened", both rows "Opened".
Added: both rows at 0 games (locked, 0/5 and 0/25, "Finish N games to unlock"); 3 games (3/5 and 3/25); crate 2's page "Finish 25 games to unlock", Open disabled. Stills: `locked-3`, `one-ready`, `both-opened`.

`e2e/crate-banner.spec.ts`: no change. Its `.crate-row:not(.boss-crate-row):not(.welcome-crate-row)` count still holds with two rows. It passes with the scroll change above (without it, the gambling ring test failed on the phone, because the longer list scrolled the page before a crate page opened).

`packages/app/test/*`: none changed.

## Rules

- "Nothing hidden, nothing shifts": both rows always show; locked, ready and opened change only their text, bar and padlock inside the row. Open is greyed, not removed.
- "Sprites always on screen": the padlock and the crates sit inside their rows; the stills show it.
- No platform named means both: phone and computer, checked in the e2e and the stills.
- American English throughout.

## Stills

`docs/welcome-meters/`:
- `locked-3-phone.png`, `locked-3-desktop.png`: three games, both rows locked (3/5 and 3/25)
- `one-ready-phone.png`, `one-ready-desktop.png`: five games, crate 1 ready (5/5), crate 2 locked (5/25)
- `both-opened-phone.png`, `both-opened-desktop.png`: both opened, each with its ride

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
