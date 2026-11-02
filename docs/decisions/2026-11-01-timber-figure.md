# Timber's figure on a computer (Nov 1, 2026, round 2)

His rest drawing ran 18 px over the board's left edge (his frame's box, made taller for his entrance's drop). Fixed:
`--bc-shift` of 10 sprite px out, as Folio's 6, so his drawing clears the board by 16 to 20 px, as Folio's does.

His cast (the Gnaw, a drop) stands by the board's top-left corner for its moment, **as every boss's does** (bosses.md: "while
it stands at the board's corner for a moment"; Folio, Babur, Moo the same). Round 2 first moved it beside the board; Eric
(Nov 1): keep him in line with how the rest of the bosses work, so the director put it back at the corner, phone and
computer alike.

- **Unchanged:** the frame (98 x 129), his phone bar, the board's size and place.

Guard: `e2e/timber.spec.ts`, "on a computer his figure stands beside the board at rest (never over the board, the bar or the
side menu); his cast by the board's corner never over the side menu". The board is 346 px from the left at 1280 x 800 and
1440 x 900, the same as Folio's there.
