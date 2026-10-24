# One boss bar on a phone: one box for every boss, the figure where its layout puts it, a check that catches it (Oct 24, 2026)

Eric (Oct 24, two phone screenshots, Moo & Moon's bar and Babur's): "the boss boxes here are just way off in terms of how
they look… there should be some continuity as far as the size and where their name sits… these box sizes should not change…
I guess the boss can be a little smaller in the box sometimes, but… why the hell is the [figure] literally outside of the box…
it just looks messy… these are the kind of checks that should be… built… to be looking at these inconsistencies." **ASAP.**
Then, the same day: "I actually think it's kind of cute how they stick their head out of the [bar] sometimes… the only thing
should ever be hanging out would be the boss… I could test both… one where they're all fitted, and then one where they're kind
of hanging out"; "the text box contained… reconfiguring how the text works… to take up that space that's inside the
container". And: "It's okay for us to use longer lines of text… two rows is better than one row, but 1.5 rows is better than 4
small rows."

## What was wrong

- Each boss's figure box was a different size: 48 × 56 with a −6 px top margin, so the figure poked out of the top of the bar.
  `.tall` (G-REX, Puddles, Babur) made the box 88 px tall and the whole bar 92 px; `.wide` (Sawyer and others) made it 58 px
  wide. So the bars came in two heights, the names sat at different heights (the name column was centred in the bar), and
  the free room beside the name was a different width for every boss.
- The speech bubble sat over the name column and below the bar (`bottom: -4px`), in a box that changed with the line.

## What changed (phone only; the computer's bar is unchanged)

- **One bar height.** Two layouts behind the test switch `?bar=`:
  - `out` (the default): a compact bar, **64 px** (the bar's content 53 px; 5 px top and 6 px bottom padding). Every boss's
    figure is drawn at its own size and rises above the bar's top when it's taller than the bar. Nothing else hangs out.
  - `fit` (`?bar=fit`): the taller bar, **99 px** (content 88 px, the box of the original brief). Every idle figure is wholly
    inside the bar.
- **One figure box.** 58 px wide and as tall as the bar's content (53 in `out`, 88 in `fit`), its feet on its bottom edge,
  which is the bar's content bottom (6 px above the bar's bottom edge), so the feet are on the same baseline for every boss.
  No negative margin. `tall` and `wide` no longer change the phone bar (`styles.css`, `BossCharacter.tsx`); `tall` still
  makes the results screen's box taller (`.boss-char.place-results.tall`); `wide` now has no CSS at all (the kit flag is
  still set in `kits.ts`, a follow-up to remove).
- **One place for the column.** The name column is 130 px wide (the widest name, "Boingo the Clown", is 127.5 px at 15 px
  bold) and starts 12 px past the figure's box (x = 88 px at 390). Its top aligns to the bar's content, not centred, so the
  name, level, the ultimate's bar and the passive's bar sit at the same x and y for every boss. The status stays at the top right.
  The free room (`.boss-prop`) has the same width and height for every boss, since the name column no longer changes width.
- **Per-boss size.** Each boss's size is in its kit (`barScale: { out, fit }` in `characters/kits.ts`), applied as
  `--bc-s-out` / `--bc-s-fit` on its bar figure. A figure is shrunk only as far as its layout needs, and the rule is the same
  for every boss (measured on every frame of every animation, `packages/app/test/boss-bar-same.test.ts`):
  - `out`: its top may rise to 1 px under the "BOSS · move N" line's text (16 px above the bar's top), so a figure's top
    limit is 73 px above its feet (58 px from the bar's top plus 15). At 1× the one-shot moments of many bosses rise past it
    (Jefferson's roman candles to 114 px, Moo's flurry to 98), so they shrink.
  - `fit`: at rest the figure stays inside the bar: 33 px from its feet to the bar's left edge, 93 px up, and 41 px right to the
    name column. Idle moments past the bar's left edge shrink (Alfil 44 px, Smudgy 42, Sawyer and Wrangler 39).
  - Both: the figure never reaches the name column at rest (41 px right of its feet), and never drops more than 6 px below the feet.
- **The bubble** (Eric: "the text box contained"): inside the bar, from the name column's left edge to the bar's right
  padding, under the status (its grid row 2, so never over the status). It may cover the name's lower bars and the boss's prop
  for its moment. One row when the line is short (at most half the room), otherwise two balanced rows: its width is half the
  line plus its frame (`SpeechBox` `balanced`, `speech.tsx`, `text-wrap: balance`), up to the room; a line too long for two
  rows at full width takes three; never four. Its text stays in the speech font, 9 px (8 px on a 320 px screen, where the
  longest line, 64 characters, needs three rows).
- **Moo's sprite clip** (`.boss-char.place-bar.ch-moo .boss-char-sprite`, which trimmed his glow to the old box's sides) is
  removed: his glow reaches 34 px left and 32 right of his feet, within the name clearance and the screen, and it's a moment
  (the one-shot rule above). Nothing else per boss is left on the phone bar.

## The numbers

Measured at 390 × 844 in the browser (`e2e/boss-bar-same.spec.ts`). The bar's top is 48 px, the "BOSS · move N" line's
text ends at y = 32 (16 px above), the feet are at 106 (`out`) and 141 (`fit`).

| Layout | Bar | Figure box | Free room (390 / 320 / 428) | Board top (390 / 320 / 428) |
|---|---|---|---|---|
| Before (normal boss) | 60 px (92 for the tall three) | 48 × 56 (58 × 88 for the tall three) | 157 / 87 / varies | 136 (168 for the tall three) |
| `out` | 64 px | 58 × 53 | 140 / 70 / 178 | 140 |
| `fit` | 99 px | 58 × 88 | 140 / 70 / 178 | 175 |

The board's size is the same before and after: 314 px at 390 × 844, 238 px at 320 × 568, 352 px at 428 × 777 (the
board's top moves: +4 px in `out`, +39 px in `fit`, from the taller bar; a board's bottom is still well above the controls below it).

Each boss's `barScale` (fraction of full size; the table lists what limits it):

| Boss (kit) | `out` | `fit` | What limits it |
|---|---|---|---|
| Jefferson | 0.60 | 0.90 | roman candles rise to 114 px (`out` limit 73; `fit` 108) |
| Moo & Moon | 0.70 | 0.95 | the flurry rises to 98 px; left of the feet 34 px (bar's left edge 33) |
| Babur (Tiger) | 0.75 | 1.00 | `out`: defeat rises to 93 px |
| Hollow | 0.75 | 1.00 | `out`: lights out rises to 92 px |
| Puddles (Gardener) | 0.80 | 1.00 | `out`: entrance rises to 86 px |
| Ginger | 0.80 | 0.95 | `out`: victory rises to 86 px; `fit`: 34 px left of the feet |
| Boingo the Clown | 0.80 | 1.00 | `out`: entrance rises to 89 px |
| Alfil | 0.85 | 0.75 | `fit`: 44 px left of the feet (victory 82 px rise in `out`) |
| Chub & Chirp | 0.90 | 0.90 | `out`: entrance 79 px; `fit`: 36 px left of the feet |
| Smudgy | 0.90 | 0.75 | `out`: entrance 79 px; `fit`: 42 px left of the feet |
| Big Boy | 0.95 | 1.00 | `out`: big bounce 74 px |
| Sawyer | 1.00 | 0.80 | `fit`: 39 px left of the feet |
| Wrangler | 1.00 | 0.80 | `fit`: 39 px left of the feet |

Shrinking is by the nearest 0.05 below the limit, so the pixel art stays on whole steps.

## Judgment calls

- **The compact bar is 64 px, not 60.** A line of three rows at 9 px needs the row under the status (37 px) plus the bar's
  bottom padding; 60 px gave 33 px and did not hold three rows.
- **The "BOSS · move N" line's gap is fixed.** Not moved: the figure is shrunk instead (Eric's rule: "if a figure would,
  shrink that figure until it doesn't"). More room above the bar would let more bosses stay at full size: a decision for Eric
  (for example 20 px more space above the bar would lift `out`'s limit to 93 px and leave Jefferson at 0.80).
- **The rule covers every moment, not only the idle pose.** A one-shot moment's rise is shrunk too, so "never covers the line"
  holds on every frame; the brief's "may rise for a moment" is applied only to the name column and the screen's edge.
- **The name column is 130 px.** It's a fixed width so the free room is the same for every boss; a longer name would be cut
  with an ellipsis (none is that long today).
- **The bubble can cover the prop and the lower bars.** Eric allowed it for its moment; the prop is drawn again afterwards.
- **`sayBoss(text)`** (a test hook in `speech.tsx`, `VoiceBubble`, installed only where `testSwitchesAllowed()`): the e2e says
  every line of every boss through the boss's own voice, so each line is measured in its real bubble, not a copy.

## Checks

- `e2e/boss-bar-same.spec.ts` (phone; 320 × 568, 390 × 844, 428 × 777; every playable boss; both layouts): the bar's height,
  the figure box and the name, level, bars, status and free room are the same for every boss (±1 px); the feet are on the
  bar's baseline; `out`: the figure's drawn pixels never cover the "BOSS · move N" line, reach the name column or drop below
  the bar; `fit`: the idle figure is inside the bar; every line the boss says: its bubble inside the bar, under the status,
  from the name column's left edge, at most three rows, and a one-row line at most 60% of the room. A stacked sheet of every
  boss's bar per layout and size is attached to the test.
- `packages/app/test/boss-bar-same.test.ts` (every playable boss, every frame of every animation, both layouts): the
  figure's drawn pixels against the limits above, with the scales in the kits.
- `e2e/boss-bar.spec.ts` and `e2e/boss-character.spec.ts` pass unchanged (the status, the column, the room and the bubble's
  rules still hold). `e2e/tiger.spec.ts` (Babur's pump) is another helper's (claude/babur-bigger): not changed here.
