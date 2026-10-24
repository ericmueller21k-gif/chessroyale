# One boss bar on a phone: one box for every boss, every figure drawn in the room (Oct 24, 2026)

Eric (Oct 24, two phone screenshots, Moo & Moon's bar and Babur's): "the boss boxes here are just way off in terms of how they look…
there should be some continuity as far as the size and where their name sits… these box sizes should not change… I guess the boss
can be a little smaller in the box sometimes, but… why the hell is the [figure] literally outside of the box… it just looks messy…
these are the kind of checks that should be… built… to be looking at these inconsistencies." **ASAP.**

Then, the same day, the choice between the two layouts we built: the taller bar, every figure inside it, is the phone's bar. Last word
the same day: "bigger bosses, sized by what they are, and sticking out of the bar is fine. Today Alfil is drawn smaller than Ginger,
which is wrong for an elephant. Babur is small because his balloons count toward his height." So: one bar, no switch, no boss drawn
below its own size, the big animals bigger, and a figure may hang out of the bar's top and left edge.

On the bubble: "the text box contained… reconfiguring how the text works… to take up that space that's inside the container"; "two rows
is better than one row, but 1.5 rows is better than 4 small rows"; "It's okay for us to use longer lines of text… we can stretch it out
to the far right… even if it's overlapping, say, the balloon pump for a second… we don't want it to be one long sentence."

## What was wrong

- Each boss's figure box was a different size (48 × 56 with a −6 px margin that let the figure poke out; 58 × 88 for the tall three), so
  the bars came in two heights, the names sat at different heights (the name column was centred), and the free room beside the name
  was a different width for every boss.
- The speech bubble sat over the name column and below the bar (`bottom: -4px`), in a box that changed with the line.
- The bubble's width rule (`bubbleFit`) had two faults, found with the sheet ("Drip, drip… bah!", 16 characters, came out as three rows
  of about five characters in an 85 px box, in a room of about 270 px): a line was one row only when it was at most half the room
  (60% is the rule), and two rows were a box of half the line plus one character, too narrow for the words, so the text broke into
  three rows. Two balanced rows need the half line plus the longest word.

## What changed (phone only; the computer's bar is unchanged)

- **One bar, 99 px tall**, for every boss (its content 88 px; 5 px top and 6 px bottom padding). No switch and no second layout.
- **One figure box**: 58 px wide, as tall as the bar's content (88 px), starting 5 px in from the bar's left edge, so its feet sit 48 px
  from the screen's left edge (the bar's left edge is at 14 px) and 6 px above the bar's bottom edge. Its feet are on the same baseline
  for every boss. No negative margin. `tall` and `wide` no longer change the phone bar (`tall` still makes the results screen's box
  taller; the `wide` kit flag now has no CSS, a follow-up to remove it).
- **One place for the column.** The name column is 130 px wide (the widest name, "Boingo the Clown", is 127.5 px at 15 px bold) and starts
  12 px past the box, at 89 px from the screen's left edge. The name, level, the ultimate's bar and the passive's bar start at the same x
  and y for every boss (the column's top, not centred). The status stays at the top right. The free room (`.boss-prop`) is the same
  width and height for every boss, since the name column no longer changes width.
- **Each boss's size** is one number in its kit, `barScale` (1 is full size; never less), and a sideways shift in whole px, `barShift`
  (+ right), in the same kit. Both are applied to the bar's figure (`--bc-scale`, `--bc-shift`: `characters/kits.ts`,
  `components/BossCharacter.tsx`, `styles.css`).
- **The room at rest** (every idle frame; `packages/app/test/boss-bar-same.test.ts` and `e2e/boss-bar-same.spec.ts`): the drawing is
  ≥ 2 px inside the screen's left edge (L·s − shift ≤ 46 from the feet), ≥ 2 px clear of the name column (R·s + shift ≤ 39), its top is
  ≥ 1 px under the "BOSS · move N" text (U·s ≤ 108 from the feet at 141 px), and it drops no more than the bar's bottom padding (6 px)
  below its feet. It may hang out of the bar's top and left edge.
- **A one-shot moment** (every frame of every animation: an entrance, a hop, a power's moment) may rise anywhere above the bar, even over
  the "BOSS · move N" text, but never off the screen (L·s − shift ≤ 48, U·s ≤ 141, R·s + shift ≤ 272 at 320 px).
- **The bubble** (Eric: "the text box contained"): inside the bar, from the name column's left edge to the bar's right padding, under the
  status (its grid row 2, so never over the status). It may cover the name's lower bars and the boss's prop for its moment. Its width is
  fitted to its line in the page's font (`speech.tsx`, `bubbleFit`), from `w1`, the line's one-row width (the box laid out one row and
  measured, `offsetWidth`, so it includes the line's icons), and `inner`, the room's text width (the bar's room less the box's frame).
  One row when `w1` is at most 60% of `inner`: the box as wide as its line. Else two balanced rows when two rows hold the line at the
  room's width (`roomRows`: the box laid out at the room's width and counted by its height, so a long word counts): the text `w1`/2
  plus the longest word (measured in the same font), never as wide as the line, so it breaks, at most the room (`text-wrap: balance`).
  Else three rows: the box as wide as the room and the text wrapped to fill it (`.wide3`, `text-wrap: wrap`); never four. Measured again once the pixel font has loaded (`document.fonts.load`). Font: 9 px at 390 and 428; 8 px at 320, with the same row
  pitch (10.8 px) as at 390 (`line-height: 1.35`).
- **The pump** (Babur's, `components/Tiger.tsx`): 2x (68 × 72) in the bar's room at its right end, its foot 3 px below the room's bottom
  (inside the bar's padding), so a stage-4 balloon's top and a pop's over-swell clear the status (docs/decisions/2026-10-24-babur-bigger.md).
  The room is 72 px tall under the status in this bar.
- **Status and free room at 320 px**: the status is 11 px, so "58 moves left" keeps its one line beside the 130 px name column; the
  bar's right padding is 6 px and the grid's column gap 0 there, so the status's column is 70 px and the free room 81 px (the old
  boss-bar check's floor, 80 px; Babur's pump is 68 px). The longer "Strikes in N moves" wraps to two lines at 320 px, as it did before.
- **Line icons** (Moo's heart and the like) sit with a negative vertical margin, so a line keeps its pitch with an icon in it.
- **Moo's sprite clip** (`.boss-char.place-bar.ch-moo .boss-char-sprite`, trimming his glow to the old box's sides) is removed.

## The numbers

Measured at 390 × 844 in the browser (`e2e/boss-bar-same.spec.ts`): the bar's top at 48 px, its bottom at 147 px; the figure's feet at
141 px (on every boss); the "BOSS · move N" text ends at 32 px; the name column at 89 px; the free room 72 px tall under the status.

| | Before (normal boss / tall three) | After |
|---|---|---|
| Bar | 60 px / 92 px | 99 px |
| Figure box | 48 × 56 / 58 × 88 (a −6 px margin) | 58 × 88, on the baseline |
| Board top (390 / 320 / 428) | 136 / 136 / not measured (168 for the tall three) | 175 / 175 / 175 |
| Board size (390 / 320 / 428) | 314 / 238 / not measured | 314 / 238 / 352 |

The board's size is the same at 390 and 320; its top is 39 px lower, the taller bar's. At 428 px the board is 352 px (not measured before).

Each boss's size and shift (`barScale`, `barShift`); the table says what limits it:

| Boss (kit) | Scale | Shift | What limits it |
|---|---|---|---|
| Ginger | 1 | 0 | fits |
| Boingo the Clown | 1 | 0 | fits |
| Jefferson | 1 | −2 | idle right side 41 px against the room's 39 px |
| Hollow | 1 | 0 | fits |
| Big Boy | 1 | 0 | fits |
| Sawyer | 1 | 0 | fits |
| Wrangler | 1 | 0 | fits |
| Alfil | 13/12 | +3 | 4/3 would be 100 px across; the room is 84 px (46 px left of the feet, 39 px right). +3, not +2, keeps his canvas (its transparent edge) on the 320 px screen, as alfil.spec checks |
| Chub & Chirp | 1 | 0 | fits |
| Smudgy | 1 | +3 | a move's left edge (51 px) needs a shift of at least 3 to stay on the screen; the idle right side (36 px) allows at most 3 |
| Moo & Moon | 14/12 | −1 | 4/3 would be 91 px across, past the room's 84 px |
| Puddles (Gardener) | 15/12 | +2 | 4/3 fails on a one-shot's left edge (40 px × 4/3 = 53 px; the screen allows 48 px from the feet) against his idle right side |
| Babur (Tiger) | 4/3 | −1 | fits; his balloons hang above the bar, outside the room's top rule |

Order check: each big animal's idle figure is drawn at least as tall as the tallest of Ginger, Sawyer, Smudgy and Chub & Chirp at full
size (Chub's 71 px): Alfil 79 px, Moo & Moon 84 px, Puddles 88 px, Babur 97 px.

## Judgment calls

- **The bar's left padding is 5 px, not 4.** At 4 px no whole-px shift fits Smudgy (his move's left edge and his idle right side need a
  shift of exactly 3 px together). The whole figure box moves 1 px for every boss; the name column and the room move with it.
- **Name column 130 px, status 11 px and no gaps at 320 px.** With the 58 px figure box and the 12 px gap, the 130 px name column and a 12 px
  status leave no room at 320 px for "N moves left" on one line; an 11 px status at 320 px, with the bar's right padding and the grid's
  column gap closed up, is the smallest change that keeps it there and keeps the free room at the old check's floor.
- **4/3 is the cap, not the target.** Alfil, Moo & Moon and Puddles are below 4/3 because their drawings are wider than the room allows
  at 4/3 (above). They get the largest step that holds.
- **The room rule covers idle frames at rest; a one-shot moment only has to stay on the screen.** A one-shot may rise over the text for
  its moment (Eric: "even over" the line, "never off the screen").
- **The bubble can cover the prop and the lower bars** for its moment. The prop is drawn again afterwards.
- **Two rows are measured, not taken from a ratio.** A first rule used `w1` at most 1.8 times the room for two rows. It was wrong both
  ways: "Hold still, your majesty. You look thirsty." (344 px in a 197 px room at 320 px) needs three rows, since its longest word is
  72 px and no break gives two rows of 197 px, and Moo's longer lines fit two rows above 1.8 times. So the bubble lays the line out
  at the room's width and counts its rows, and the check measures the same.
- **`sayBoss(text)`** (a test hook in `speech.tsx`, `VoiceBubble`, installed only where `testSwitchesAllowed()`) says any line through the
  boss's own voice, so each line is measured in its real bubble, not a copy. The line check waits for the boss's own lines to settle and
  for the pixel font before it measures.

## Checks

- `packages/app/test/boss-bar-same.test.ts` (every playable boss, every frame of every animation): scale ≥ 1; the big animals at 4/3 or the
  largest fitting step; the room at rest on every idle frame with the shift; a moment on the screen; the order check.
- `e2e/boss-bar-same.spec.ts` (phone; 320 × 568, 390 × 844, 428 × 777; every playable boss): the bar's height, the figure box and the name,
  level, bars, status and free room are the same for every boss (±1 px); the feet on the bar's baseline; at rest, the drawing 2 px inside the
  screen's left edge, 2 px clear of the name column, under the "BOSS · move N" text; every line the boss says: its bubble inside the bar,
  under the status, from the name column's left edge, and the rows its width asks for (`w1` from a hidden nowrap copy of the line, and
  `roomRows` from a hidden copy of the bubble at the room's width, both in the bubble's font, after it has typed out: one row when `w1`
  is at most 60% of the room's text width, else two when two rows hold it, else three, never four; a hard check), at the same pitch as
  at 390. Each line is measured once its last letter is in, and only while it's still the line up: a boss's own critical line can cut
  in while a line types out, and then the line is said again (up to three rounds). A stacked sheet of every boss's bar per size, each
  with its longest line typed out, and a lineup of the figures at 390, are attached to the test.
- `e2e/boss-bar.spec.ts` and `e2e/boss-character.spec.ts`: the status, the column, the room, the bubble's rules, the figure's box.
- `e2e/tiger.spec.ts`: Babur's pump, 68 × 72 at 390 and 428 px, inside the bar, at the room's right end, its balloon under the status.
