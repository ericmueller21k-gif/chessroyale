# Chess Town's shop: mockup (Phase A, Nov 28)

Stills only. No game code changed, no PR. The throwaway code that made them is on branch `claude/town-shop-mockup-preview` (not for
merge: it hacks the look-alike painter and adds a dev page).

## The stills

| File | What it shows |
|---|---|
| `1-street-phone.png`, `1-street-computer.png` | South Street: the pink striped front with its new door, sign and window boards, and its "Go in" card. |
| `2-room-phone.png`, `2-room-computer.png` | Inside, the whole room. |
| `2-room-detail.png` | A cut of the computer still at full size: the board wall, the keeper, the two "coming" stalls, the boards table. |
| `3-talk-phone.png` | Standing in front of the counter: the keeper's card (Talk). |
| `3-list-phone.png`, `3-list-computer.png` | The keeper's list. |
| `4-preview-phone.png`, `4-preview-computer.png` | A board's preview, the Italian part way through (3. Bc4 just played). |
| `4-preview-loading-phone.png` | The same box while the preview loads ("Loading preview…"). |
| `4-preview-locked-phone.png` | The preview of a board you haven't reached (Transcendent): Buy greyed, the reason on its line. |
| `5-boards-sheet.png` | All 12 boards, a full board each, with a marks strip under each. |

## What is real and what is mocked

- **The street** is the real town. The front is the real look-alike building with its ground floor repainted by a throwaway hack (sign,
  double door, a board in each window), and the lamp that stood in front of the door moved 1.6 squares east. The card is the town's
  own "Go in" card with the shop's name put in.
- **The room** is drawn by the real room code (`ShopRoom.tsx`) from a new art file in the Battle Tower lobby's format: every piece
  painted once as the room loads, nothing per frame. The bar, the side menu, the right column, the walking keys and the chat hint are
  the real town screen; the mock room sits in the town's box.
- **The list** sits in the room's real talk-card slot (the Battle Tower clerk's). Its rows are the Crates tab's rows.
- **The preview** is the locker's magnifier box with the game's own board in it.
- **The boards** are the game's own board. A skin is the board's existing color variables plus, for a rank board, one frame layer.
- Missing from the stills: the shop's floating name over its roof and its place on the map; a name tag over the keeper; a skin shown
  on a live game screen (not made; the sheet and the preview use the same board the game draws).
- Light and dark: the town, its rooms and the blue windows draw the same in both, so there are no dark stills.

## The calls I made

1. **Which building: the pink striped front on South Street, between Folio's Folded House and Alfil's Pyramid** (lot columns 29 to 31).
   It is the widest plain front near the middle (3 squares), it is one of the row's landmarks (a taller rounded cap, so it reads from
   far off), and it was already drawn as a shop (a window, an awning, a door), so it needs the least new art. It is 9 squares south and
   8 east of where you start. The stills are a player's town. In an admin's town the same row also holds Rolling Dough further east, and I
   did not check that this front keeps its look there; as a real lot of its own it would be fixed either way.
   **The other candidate:** the lilac corner front on the Colosseum's plaza, beside Babur's Circus. You can see it from where you start,
   but it is under 2 squares wide.
2. **Its name: "The Pawn Shop"** (the sign reads PAWN SHOP). Short enough for the sign, and the shop is run by pawns.
3. **The keepers are pawns wearing shop items.** The board keeper wears the Top Hat and the Suit and Tie. No new character art: a keeper
   is drawn the way your own pawn is, one picture made once.
4. **The room is 10 by 10 squares, the Battle Tower lobby's size,** so the fixed camera shows it whole. Nothing stands in the two
   columns behind the doors, because the door's frame covers them from the camera.
5. **The layout.** Back wall: a felt panel with 6 boards hung (Gold, Paragon, Illustrious, Sublime, Walnut, Radiant) and BOARD SKINS
   in gold. The keeper stands behind a 4-square counter marked BOARDS. Back corners: the God King's stand (purple, a crown) and the
   seasonal stall (striped awning, a garland), curtains drawn, each with a COMING SOON card. Middle: a 4-square table with the other 6
   boards on stands, a plinth each side of it with one featured item (Fire & Ice Crown, Parrot). Either side of the way in: a 2-square
   table with 3 items each (Pirate Hat, Little Crown, Wizard Hat; Party Hat, Dark Shades, Santa Hat). All items are real ItemArt.
   Shelves of boxes along both side walls, two plants by the door, a rug before the counter.
6. **Two shoppers** (pawns in a Beanie and Scarf, and a Party Hat) stand in the room so it reads busy. They are still pictures, made
   once. Today a room holds only you, so this is new; see the questions.
7. **A rank board's frame is drawn over the outer edge of the edge squares, under the pieces.** The board and its squares keep their
   size. The band is about 1.3% of the board (5 px on a phone, 7 to 8 on a computer), and the coordinates move in by that much. Each rank
   has its own small motif in the band: dashes, dots, checks, rope, rays, pearls, stars.
8. **The list.** A tap on a row opens its preview (the magnifier on the swatch says so). The button at the right buys ("400" with the
   coin), or reads "Put on" for a board you own, or "✓ On" greyed for the one on your board. A rank board you haven't reached keeps its
   colors, its button is greyed and its line says why in gold: "Reach Illustrious to buy". Your coins are at the top right.
9. **The preview** plays the Italian, 5 moves each (1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6), on a loop. The moves are listed
   under the board: played ones white, the last one gold, the ones to come greyed. Its box is the same size while it loads.
10. **Placeholder numbers:** basic boards 150 coins, rank boards 400 each (the 200-coin pack is $1.99). The mock player is Paragon with
    520 coins, owns Walnut and the Gold Board, and has the Gold Board on.
11. **Cost.** Nothing of the shop loads until you walk in, as with every room. The room is 23 kinds of piece, all still. The boards on
    the wall and the table are painted into those pieces, so they cost no pictures of their own. The scene adds 11 small pictures (the
    keeper, two shoppers, 8 items).

## The boards' colors

| Board | Light | Dark | Frame (band, metal, motif) | Last move | Dots and picked square |
|---|---|---|---|---|---|
| Gold Board | `#f8ebc8` | `#dcab45` | `#6a3a08`, `#ffd94a`, dash | `rgba(40, 150, 100, 0.46)` | `rgba(74, 38, 4, 0.5)` |
| Paragon Board | `#eaf5e6` | `#62ad80` | `#123b24`, `#f6c93a`, dots | `rgba(255, 221, 0, 0.46)` | `rgba(11, 42, 25, 0.5)` |
| Illustrious Board | `#e7eefb` | `#7398de` | `#0c2157`, `#dfe6ee`, checks | `rgba(255, 205, 60, 0.5)` | `rgba(7, 22, 62, 0.5)` |
| Sublime Board | `#f4eafc` | `#a57fd9` | `#291058`, `#f6c93a`, rope | `rgba(255, 214, 70, 0.5)` | `rgba(27, 11, 56, 0.5)` |
| Radiant Board | `#ffedc7` | `#e58a6a` | `#701020`, `#ffd23c`, rays | `rgba(30, 185, 165, 0.5)` | `rgba(44, 4, 12, 0.5)` |
| Pearlescent Board | `#fdf9fc` | `#bdb5d8` | `#5c5486`, `#fbe9b4`, pearls | `rgba(226, 84, 152, 0.5)` | `rgba(44, 36, 64, 0.5)` |
| Transcendent Board | `#e3e8ff` | `#7f84e2` | `#1d1052`, `#b9a1ff`, stars | `rgba(60, 230, 255, 0.64)` | `rgba(15, 8, 41, 0.5)` |
| Walnut | `#f0d9b5` | `#b58863` | none | `rgba(155, 199, 0, 0.45)` | `rgba(20, 85, 30, 0.5)` |
| Slate | `#dee3e6` | `#8ca2ad` | none | `rgba(255, 214, 70, 0.5)` | `rgba(28, 42, 51, 0.5)` |
| Lagoon | `#e6f4f1` | `#63ada6` | none | `rgba(255, 221, 0, 0.46)` | `rgba(12, 58, 54, 0.5)` |
| Blossom | `#fdeeee` | `#e7a3b0` | none | `rgba(80, 190, 150, 0.5)` | `rgba(74, 24, 38, 0.5)` |
| Graphite | `#dcdcdc` | `#8f949c` | none | `rgba(255, 205, 60, 0.5)` | `rgba(22, 24, 29, 0.5)` |

Rank boards take their squares from the rank emblem's colors, lightened until black pieces stay clear, and the frame's band and
metal from the emblem. The picked square uses the same color as the dots; the capture ring uses it at 0.38.

## The marks, checked

The sheet shows the board's own marks on every board. Numbers behind it (contrast is the usual luminance ratio; distance is plain RGB
distance, 0 to 441):

| Board | light | dark | black piece on dark | light vs dark | last move on light / dark (RGB distance from the plain square) | dot on light / dark (contrast) | check red vs dark (RGB distance) |
|---|---|---|---|---|---|---|---|
| Gold Board | #f8ebc8 | #dcab45 | 10.0:1 | 1.78:1 | 113 / 85 | 2.83 / 2.33 | 185 |
| Paragon Board | #eaf5e6 | #62ad80 | 7.8:1 | 2.40:1 | 107 / 96 | 3.06 / 2.30 | 253 |
| Illustrious Board | #e7eefb | #7398de | 7.3:1 | 2.48:1 | 98 / 110 | 3.30 / 2.46 | 293 |
| Sublime Board | #f4eafc | #a57fd9 | 6.6:1 | 2.72:1 | 92 / 97 | 3.39 / 2.45 | 260 |
| Radiant Board | #ffedc7 | #e58a6a | 8.2:1 | 2.23:1 | 117 / 106 | 3.50 / 2.71 | 174 |
| Pearlescent Board | #fdf9fc | #bdb5d8 | 10.8:1 | 1.87:1 | 97 / 61 | 3.02 / 2.51 | 285 |
| Transcendent Board | #e3e8ff | #7f84e2 | 6.3:1 | 2.74:1 | 107 / 78 | 3.50 / 2.54 | 282 |
| Walnut | #f0d9b5 | #b58863 | 6.7:1 | 2.29:1 | 90 / 54 | 2.32 / 1.72 | 175 |
| Slate | #dee3e6 | #8ca2ad | 7.9:1 | 2.06:1 | 82 / 81 | 2.85 / 2.25 | 254 |
| Lagoon | #e6f4f1 | #63ada6 | 8.1:1 | 2.30:1 | 112 / 107 | 2.79 / 2.08 | 274 |
| Blossom | #fdeeee | #e7a3b0 | 10.3:1 | 1.82:1 | 100 / 78 | 3.02 / 2.48 | 240 |
| Graphite | #dcdcdc | #8f949c | 6.9:1 | 2.22:1 | 82 / 79 | 3.13 / 2.41 | 232 |

- Black pieces on the dark square: 6.3:1 at the lowest (Transcendent). White pieces carry their own black outline.
- The last move: I retuned three after the first pass (Radiant from yellow to teal, Pearlescent to a stronger pink, Transcendent to a
  stronger cyan). The lowest is now Walnut's on its dark square (54); Walnut uses the same green tint as today's Classic board.
- Check is today's red glow, unchanged. It is weakest on Radiant, Walnut and Gold (174 to 185). It reads on the sheet; if it looks
  thin to you on Radiant, the fix is one more variable for the glow's rim.

## Questions for Eric

1. **The building:** the pink front on South Street, or the lilac corner on the plaza (seen from the start, but narrow)?
2. **The name:** "The Pawn Shop"? Others that fit the sign: "The Emporium", "Town Market".
3. **Rank boards:** I assumed you can buy one once you have ever reached that rank, and that it still costs coins. Should it be your
   rank now instead, or free once reached?
4. **Prices:** 150 for a basic board and 400 for a rank board are placeholders.
5. **The frame:** over the edge of the squares as drawn (the board keeps its size), or outside the squares (the squares get about 3%
   smaller)? The first is styling only; the second touches how the board sizes itself.
6. **Keepers:** pawns in shop items as drawn, or a new character each?
7. **Shoppers:** keep the two still pawns, or leave the room to you alone as every other room is?
8. **The free "Gold" board colors in Settings and the new "Gold Board" share a name.** Rename one? And should boards you own also show
   in Settings, Board colors, or only at the keeper?
9. **The basics:** Walnut, Slate, Lagoon, Blossom, Graphite. Swap any?
10. **The two "coming" spots:** the God King's stand and a seasonal stall, as drawn?
