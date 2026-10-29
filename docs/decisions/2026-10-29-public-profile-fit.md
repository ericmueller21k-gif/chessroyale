# The public profile fits the mockup (Oct 29, 2026)

How it works now: [docs/areas/hub.md](../areas/hub.md), "Profiles". Builds on [2026-10-28-public-profile.md](2026-10-28-public-profile.md) (#402,
merged): this one **supersedes its calls on sizes, spaces, the Cosmetics tile, the level line and the note line**. The page:
`packages/app/src/screens/PublicProfile.tsx`; its styles `packages/app/src/public-profile.css`.

## Eric's words (Oct 29, on the merged page)

- "They literally don't look the same. Look at the equipped cosmetics … the one version won't fit on the phone … how did it get so
  badly done on the phone"
- "look at the padding difference … there's a huge padding difference on the desktop and mobile … follow the padding rules around the
  containers … the padding is out of control. It looks goofy with how much padding is between every container. And that's not even
  what I sent."

The merged page had its own spacing: 12 px gutters, 12 and 16 px between cards, 21 to 32 px inside, a reserved level line and a
reserved note line, and a Cosmetics card 304 px tall (two rows of two tiles) where his is 94.

## The rule for this fix: no spacing of our own

Every padding and gap on the page is measured from Eric's mockup (`1536 × 1024`; its phone screen is 401 image px for 390 css px,
so 1.028 image px to a css px, and the computer's panel is at the same scale), on the phone and on the computer: inside every card
(top, sides, bottom), the title row to its content, between rows, between cards, around the header card, the page's side margins.
Where the mockup is ambiguous the tighter value is taken.

How it was measured: card and tile edges from the image's pixels, border to border, on a straight stretch (not at a rounded corner:
the first pass read the computer's Cosmetics card at a corner and was 4 px off, found and redone); text by its cap top and baseline
(Archivo's own metrics for the built page's); the built page's boxes from the DOM at 390 px, at 1280 and at 1440. The scripts are
not kept (they were a throwaway harness); the tables below are their output, each within ±2 px unless the row says why not.

## What changed

#### Phone

| Block | Mockup | Before | After |
|---|---|---|---|
| Ranked Standing | 218.9 | 236 | 218.9 |
| Recent Matches | 243.2 | 284 | 243.5 |
| Equipped Cosmetics | 94 | 306 | 95.5 |
| one tile | 56.4 | 112 | 56.4 |
| gap above Ranked (the buttons to the card) | 13.6 | 32 | 13.6 |
| gap between cards | 8.8 | 12 | 9 |
| page's side margin | 10.7 | 12 | 10.7 |
| whole page, 390 × 844, 5 matches, 3 items | ≈950 (±20) | 1244 | 932 |

#### Computer

| Block | Mockup | Before (1280 and 1440) | After (1280 and 1440) |
|---|---|---|---|
| header card (no level line) | 257.7 (281 with the level line) | 326.2 | 258.3 |
| Ranked Standing | 311.8 | 284 | 311.9 |
| Recent Matches | 311.8 | 284 | 311.9 |
| Equipped Cosmetics | 175.1 | 214 | 175.1 |
| one tile | 113.8 | 140 | 113.8 |
| picture | 113.5 | 120 | 113.5 |
| gap: Back row to the header card | 12.6 | 16 | 12.6 |
| gap: header card to the two cards | 12.2 | 16 | 12.6 |
| gap: Ranked to Recent | 12.6 | 16 | 12.6 |
| gap: the two cards to Cosmetics | 12.6 | 16 | 12.6 |
| page's side margin | 16.5 / 14.6 | 32 | 15.5 |

The tables of every padding and gap, mockup against built (positive: the built page is looser):

### Phone (390 px wide): every padding, gap and size, the mockup's against the built page's

| Where | What | Mockup | Built | Diff |
|---|---|---|---|---|
| page | side margin (card edge to screen edge), left | 10.7 | 10.7 | +0.0 |
| page | side margin, right | 10.7 | 10.7 | +0.0 |
| header | header bottom to picture top | 3.9 | 3.9 | +0.0 |
| header | picture size | 120.6 | 120 | -0.6 |
| header | picture bottom to name (cap top) | 11.7 | 11.7 | +0.0 |
| header | name baseline to the line under it (cap top) | 13.6 | 13.6 | +0.0 |
| header | last line's baseline to the buttons | 18.5 | 18.5 | +0.0 |
| header | gap between the two buttons | 11.7 | 11.7 | +0.0 |
| header | button height | 49.6 | 50 | +0.4 |
| header | buttons to Ranked Standing | 13.6 | 13.6 | +0.0 |
| cards | gap Ranked to Recent | 8.8 | 9 | +0.2 |
| cards | gap Recent to Cosmetics | 8.8 | 9 | +0.2 |
| Ranked | card top to the title's middle | 21.9 | 21.8 | -0.1 |
| Ranked | card top to the emblem's top | 48.6 | 48.6 | +0.0 |
| Ranked | card left to the emblem | 24.3 | 24.3 | +0.0 |
| Ranked | emblem size | 108.9 | 109 | +0.1 |
| Ranked | emblem to its words | 27.7 | 27.7 | +0.0 |
| Ranked | emblem bottom to the rule | 3.4 | 2 | -1.4 |
| Ranked | rule left inset | 12.2 | 13 | +0.8 |
| Ranked | rule to the number's middle | 18 | 18.3 | +0.3 |
| Ranked | number's middle to label's middle | 21.5 | 21.9 | +0.4 |
| Ranked | label's middle to the card bottom | 19.9 | 19 | -0.9 |
| Ranked | CURRENT TIER middle from the top | 58.9 | 58.8 | -0.1 |
| Ranked | tier name middle from the top | 82.2 | 81.9 | -0.3 |
| Ranked | trophy line middle from the top | 112.2 | 112.2 | +0.0 |
| Ranked | peak line middle from the top | 138.1 | 137.9 | -0.2 |
| Ranked | card height | 218.9 | 218.9 | +0.0 |
| Recent | card top to the title's middle | 18.5 | 18.3 | -0.2 |
| Recent | card top to the first row | 34 | 34 | +0.0 |
| Recent | row pitch | 41.3 | 41.3 | +0.0 |
| Recent | last row to the card bottom | 2.4 | 2 | -0.4 |
| Recent | pill left inset | 12.6 | 13 | +0.4 |
| Recent | pill width | 61.3 | 61 | -0.3 |
| Recent | pill height | 22.4 | 22.4 | +0.0 |
| Recent | pill to face | 20.4 | 20.4 | +0.0 |
| Recent | face size | 36 | 36.5 | +0.5 |
| Recent | face to words | 13.6 | 13 | -0.6 |
| Recent | RP change right inset (the mockup's chevron's) | 15.6 | 15.6 | +0.0 |
| Recent | View all right inset | 15.6 | 15.6 | +0.0 |
| Recent | card height | 243.2 | 243.5 | +0.3 |
| Cosmetics | card top to the title's middle | 15.6 | 15.4 | -0.2 |
| Cosmetics | card top to the tiles | 33.1 | 33.1 | +0.0 |
| Cosmetics | tile height | 56.4 | 56.4 | +0.0 |
| Cosmetics | card left to the first tile | 8.8 | 8.8 | +0.0 |
| Cosmetics | gap between tiles | 5.8 | 5.8 | +0.0 |
| Cosmetics | name's middle from the tile top | 13.6 | 13.1 | -0.5 |
| Cosmetics | color line's middle from the tile top | 24.3 | 24.9 | +0.6 |
| Cosmetics | pill's middle from the tile top | 42.8 | 43.1 | +0.3 |
| Cosmetics | card height (the director's 94) | 94 | 95.5 | +1.5 |
| page | page height at 390 × 844, 5 matches and 3 items (the director's 950) | 950 | 932 | -18.0 |

### Computer: the same, at 1440 and at 1280 wide

| Where | What | Mockup | Built at 1440 | Built at 1280 |
|---|---|---|---|---|
| page | side margin, left | 16.5 | 15.5 (-1.0) | 15.5 (-1.0) |
| page | side margin, right | 14.6 | 15.5 (+0.9) | 15.5 (+0.9) |
| header | header bottom to the header card | 12.6 | 12.6 (+0.0) | 12.6 (+0.0) |
| header card | card top to the picture | 2.9 | 2.9 (+0.0) | 2.9 (+0.0) |
| header card | picture size | 113.5 | 113.5 (+0.0) | 113.5 (+0.0) |
| header card | picture bottom to name (cap top) | 13.6 | 13 (-0.6) | 13 (-0.6) |
| header card | name baseline to the line under it | 13.6 | 13.6 (+0.0) | 13.6 (+0.0) |
| header card | last line's baseline to the buttons | 19.5 | 18.8 (-0.7) | 18.8 (-0.7) |
| header card | gap between the two buttons | 14.6 | 14.6 (+0.0) | 14.6 (+0.0) |
| header card | button height | 51.5 | 51.5 (+0.0) | 51.5 (+0.0) |
| header card | button width | 205 | 205 (+0.0) | 205 (+0.0) |
| header card | buttons to the card bottom | 14.6 | 14.6 (+0.0) | 14.6 (+0.0) |
| header card | card height (no level line: 281 less the 23.3 it takes) | 257.7 | 258.3 (+0.6) | 258.3 (+0.6) |
| cards | header card to Ranked / Recent | 12.6 | 12.6 (+0.0) | 12.6 (+0.0) |
| cards | gap between Ranked and Recent | 12.6 | 12.6 (+0.0) | 12.6 (+0.0) |
| cards | Ranked / Recent to Cosmetics | 12.6 | 12.6 (+0.0) | 12.6 (+0.0) |
| Ranked | card top to the title's middle | 31.1 | 30.9 (-0.2) | 30.9 (-0.2) |
| Ranked | card left to the title | 18.5 | 18.5 (+0.0) | 18.5 (+0.0) |
| Ranked | card top to the emblem's top | 68.1 | 68.1 (+0.0) | 68.1 (+0.0) |
| Ranked | card left to the emblem | 23.3 | 22.3 (-1.0) | 22.3 (-1.0) |
| Ranked | emblem size | 141.5 | 141 (-0.5) | 141 (-0.5) |
| Ranked | emblem to its words | 38 | 37.6 (-0.4) | 12.5 (-25.5) * |
| Ranked | rule from the card top | 218.4 | 218.4 (+0.0) | 218.4 (+0.0) |
| Ranked | rule left inset | 18.5 | 18.5 (+0.0) | 18.5 (+0.0) |
| Ranked | rule to the number's middle | 26.2 | 26.2 (+0.0) | 26.2 (+0.0) |
| Ranked | number's middle to label's middle | 29.2 | 29.2 (+0.0) | 29.2 (+0.0) |
| Ranked | CURRENT TIER middle from the top | 79.3 | 79 (-0.3) | 79 (-0.3) |
| Ranked | tier name middle from the top | 108.5 | 108.3 (-0.2) | 108.3 (-0.2) |
| Ranked | trophy line middle from the top | 148.8 | 148.8 (+0.0) | 148.8 (+0.0) |
| Ranked | peak line middle from the top | 181.9 | 181.9 (+0.0) | 181.9 (+0.0) |
| Ranked | card height (stretches to Recent's) | 312.7 | 311.9 (-0.8) | 311.9 (-0.8) |
| Recent | card top to the title's middle | 27.2 | 27 (-0.2) | 27 (-0.2) |
| Recent | card top to the first row | 54 | 54 (+0.0) | 54 (+0.0) |
| Recent | row pitch | 50.6 | 50.6 (+0.0) | 50.6 (+0.0) |
| Recent | last row to the card bottom | 4.9 | 3.9 (-1.0) | 3.9 (-1.0) |
| Recent | pill left inset | 16.5 | 16.5 (+0.0) | 16.5 (+0.0) |
| Recent | pill width | 81.7 | 82 (+0.3) | 82 (+0.3) |
| Recent | pill height | 31 | 31 (+0.0) | 31 (+0.0) |
| Recent | pill to face | 21.4 | 21.2 (-0.2) | 10 (-11.4) * |
| Recent | face size | 45.7 | 45.7 (+0.0) | 45.7 (+0.0) |
| Recent | face to words | 12.6 | 12.6 (+0.0) | 12.6 (+0.0) |
| Recent | RP change right inset (the mockup's chevron's) | 23.4 | 24.4 (+1.0) | 24.4 (+1.0) |
| Recent | View all right inset | 22.4 | 23.4 (+1.0) | 23.4 (+1.0) |
| Recent | card height | 312.7 | 311.9 (-0.8) | 311.9 (-0.8) |
| Cosmetics | card top to the title's middle | 23.3 | 23.1 (-0.2) | 23.1 (-0.2) |
| Cosmetics | card top to the tiles | 46.2 | 46.2 (+0.0) | 46.2 (+0.0) |
| Cosmetics | tile height | 113.8 | 113.8 (+0.0) | 113.8 (+0.0) |
| Cosmetics | card left to the first tile | 16 | 15.6 (-0.4) | 15.6 (-0.4) |
| Cosmetics | gap between tiles | 8 | 8 (+0.0) | 8 (+0.0) |
| Cosmetics | name's baseline from the tile top | 31.1 | 31.2 (+0.1) | 31.2 (+0.1) |
| Cosmetics | color line's baseline from the tile top | 51.6 | 50.8 (-0.8) | 50.8 (-0.8) |
| Cosmetics | pill's top from the tile top | 64.2 | 63.7 (-0.5) | 63.7 (-0.5) |
| Cosmetics | pill height | 32.1 | 32 (-0.1) | 32 (-0.1) |
| Cosmetics | last tile to the card bottom | 15.1 | 15.1 (+0.0) | 15.1 (+0.0) |
| Cosmetics | card height | 175.1 | 175.1 (+0.0) | 175.1 (+0.0) |

Rows marked `*` (1280 only): the frame's center column is 768 px at 1280 and 888 at 1440 (the side menu and the side panel take
the rest) where the mockup's panel is about 1000, so the two cards are 353 and 412 px wide at those sizes against about 450. Heights
and every vertical space are the mockup's; the horizontal ones give way: the gap between the emblem and its words (38 → as small as
14), the pill's margin in a row (21 → as small as 10), the cards' titles (20.5 px → as small as 19), and the tier and peak lines stay
on one line (an ellipsis rather than a wrapped line that moves the rows). At 1440 every row is within ±2.

## The calls

- **Equipped Cosmetics is one row, always.** Phone: three compact tiles (56.4 px tall; the picture 42 px over a 32 px slot, since the
  mockup draws a suit and a tube taller than they are wide; name, "Skin · Opal & Opal", a small rarity pill); the card is 95.5 px
  (the mockup's 94). Four worn: the same tile four across, its words a step smaller (8, 6.5 and 7.2 px), still one row, nothing
  cut but the color line, which may end in an ellipsis when it's too long. Computer: the picture left of the words with a rule
  between, three tiles across the card's width (a fourth shares the row).
- **The words in the tiles are width-matched, not height-matched.** The mockup's face is narrower than Archivo, so at the director's 11 and
  8 px (by their heights) "Weapon · Cobalt & Sage" does not fit its tile. Phone: 9.5 px name, 7.5 px color line (tracking
  −0.04em), 8.5 px pill. Computer: 14, 12 and 12 px.
- **Tile widths follow the color line on a phone.** The mockup's three are 115 : 110 : 121 across, not equal; the page gives each
  tile a share of the row by its color line's length (`tileWeight`, the length plus 110), so the longest fits whole. On a computer
  they are equal.
- **The level line is for the admin only** (the director, Oct 29). Everyone else's page has no level line and no room kept for one: the
  header card is 258.3 px tall on a computer, 281 in the mockup with the line, 258 without; an admin's is 282.1 with it.
  This changes a check that said the empty line keeps its height (below); the rule "nothing hidden, nothing shifts" holds,
  since the line is a difference between accounts and not between moments on one page.
- **A note is a toast**, fixed over the page's bottom (14 px up) and gone after 6 seconds, instead of a line kept under the buttons: a
  kept line is spacing the mockup doesn't have. It moves nothing.
- **The page's bottom padding** is 16 px (the mockup's phone and computer both end at a cut); the tighter of what the cuts allow.
- **The header's Back and ••• buttons** keep 44 px (the mockup's are about 40 × 32): the app's shared tap size.
- **The chevron slot isn't built** (no replay to open: see the first decision), so the RP change's right inset is compared to
  the mockup's chevron's right inset, and "View all" to its own.
- **The emblem** is drawn in whole steps of its 48 px art (96 and 144) and shown by a transform at the mockup's 109 and 141 px.
- **Whole page on a phone:** 932 px at 390 × 844 with five matches and three items (the director's ≈950, ±20),
  the mockup's measured parts all within ±2; an admin's, with the level line, is 956.
- **Colors** are still the front door's tokens, not the mockup's (the first decision's call).
- **Loading:** the same markup on gray bars: three tile bars (the mockup's count), the picture's slot, the level line only where the
  admin's would be; nothing but a tile's width (a few px, as the weights fall) differs when the words arrive.

## Changed test checks (old → new)

None of them guards a rule in `docs/rules/eric.md` by name. The level line's check did guard the Oct 28 call that it keeps its height;
that call is the director's to reverse and was reversed in this task's brief (see the level line above).

`e2e/public-profile.spec.ts`:

- The header comment: "the empty level line keeps its height" → "a note takes none (it's a toast)"; every size is the mockup's.
- `layout()` (the helper that compares two moments): no longer lists `.pp-level` and `.pp-note` (a player's page has neither).
- "every card's content": the emblem's box `96` (phone) / `144` (computer) → `109` / `141` (within 1 px).
- "the layout": Ranked and Recent "equal columns" (width within 1 px) → the mockup's 466 : 490 (ratio within 0.01); a phone's "12 px each side"
  (`x` = 12, width = screen − 24) → `10.7` (within 1) and screen − 21.4.
- "every mode's row in Recent Matches": the room of five rows `≥ 5 × 42` → `≥ 5 × 41.3 − 1` (phone) / `≥ 5 × 50.6 − 1` (computer).
- "four worn items all fit, nothing cut": two rows of two on a phone (`ys.size` 2) → one row of four on both (1); each tile is the
  three-up tile's height (56.4 / 113.8) and the card 95.5 / 175.1 (±4); the color line may end in an ellipsis (width), nothing else
  may be cut.
- "the level: an admin sees Level 38; a player sees an empty line that keeps its height" → "…a player's page has no level line, and no room
  kept for one": `.pp-level` text `""` and box height `22` → count 0; the layouts equal → the admin's buttons and everything under
  them one line lower (22 to 26 px) with the cards the same size.
- "nothing shifts while it loads": four tile bars (`.pp-tile` count 4) → three.
- "nothing shifts when a note appears: the note line is always there" → "…it's a toast over the page's bottom, in no card's room": the note
  line's height `≥ 20` → no `.pp-note` before; after a refusal it's visible, `position: fixed`, and the layout and page height equal.
- "your own page": `.pp-level` text `""` → count 0.
- New: "the blocks' sizes and spaces are the mockup's": each card's height, the gaps, the padding inside, the tile, on a phone and at
  1280 and 1440 (the numbers in the tables above, ±2 px for a space, ±4 for a card's height), and that the mockup's three items fit
  whole (no color line cut).

`packages/app/test/public-profile.test.ts`: the level line's title ("…and always a line") → "(the page then shows no line…)"; new: a
tile's share of the row (`tileWeight`) gives the mockup's 112 : 107 : 117.7 on a phone.

## Tests

Unit: `packages/app/test/public-profile.test.ts`. e2e: `e2e/public-profile.spec.ts` (phone 390 × 844; computer 1280 × 800 and
1440 × 900). The side-by-sides (the mockup beside the built page, whole page, light and dark, phone, 1280 and 1440) are in the PR.
