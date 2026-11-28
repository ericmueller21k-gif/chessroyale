# Rank piece sets for the shop: mockup of the styles (Nov 28)

Stills only. No game code changed, no PR. The throwaway code that made them is on branch `claude/rank-pieces-mockup-preview` (not for
merge: a dev page, `/rank-pieces-mockup.html`, and one fake row hacked into Settings).

## The stills

| File | What it shows |
|---|---|
| `1-gold-phone.png`, `1-sublime-phone.png`, `1-pearlescent-phone.png` | Each rank: A, B (gradient border), B-solid and today's pieces, a row each. Left on the rank's board, right on the default board. Boards 370 px, shot at a phone's 2x. |
| `1-gold-big.png`, `1-sublime-big.png`, `1-pearlescent-big.png` | The same eight boards at 640 px (a computer's size), shot at 1x: the real pixels of an ordinary monitor. |
| `1-kq-only-gold-phone.png`, `1-kq-only-gold-big.png` | Gold, A and B, with only the king and queen in the set. |
| `2-closeup-gold.png`, `2-closeup-sublime.png`, `2-closeup-pearlescent.png` | King, queen, rook, bishop, knight, pawn, white and black, in each style, at three sizes, each on a light and a dark square of both boards. |
| `3-marks-phone.png` | The check of step 3: the last move, the picked square, a capture ring and check under every style, at 46 px squares. |
| `4-settings-phone.png`, `4-settings-phone-dark-on.png`, `4-settings-computer.png` | The setting's row in Settings, Board (off in light; on in dark; on a computer). |
| `4-ingame-options-phone.png` | The same switch in a match's options (the gear). |

## What is real and what is mocked

- **The board** is the game's own (`OwnBoard`), with its own last move, marks and coordinates. The rank boards are the shop mockup's skins
  (`stills/town-shop-mockup`), unchanged. The position is a real middlegame: an Italian, 16. Nhf5 just played.
- **The pieces** are today's cburnett set, the same shapes and size, with only their SVG text changed:
  - **A:** the white fill becomes a gradient from white to the rank's light color, the black fill from the rank's deep color down to
    near black. Outlines and details are untouched.
  - **B:** today's piece exactly, with a rim round its outline in the rank's gradient. The rim is 2.2 of the piece's 45 units: about
    2 px on a phone, 4 px on a computer. The piece keeps its size; the rim fits inside the square on every piece.
  - **B-solid:** the same rim in one flat color (Gold `#f6c93a`, Sublime `#8447d4`, Pearlescent `#d8d1e4`).
- **Shipping any of them** would be 12 picture files a rank, like Don Dough's gold pieces: nothing drawn at run time.
- **Both colors wear the set** in every still, so both can be judged. Who sees a set in a real game is a question below.
- **The Settings stills** are the real Settings page with one row added, wired to nothing. The in-game still is the real options list
  with one row added, over a mock board.
- The close-up sheets are in real pixels: "Phone" is a 46 px square as a phone's 2x screen draws it (92 pixels).

## The colors (from each rank's emblem)

| Rank | A, white fill (top to bottom) | A, black fill (top to bottom) | B, the rim's gradient |
|---|---|---|---|
| Gold | `#ffffff` `#fff6c0` `#ffd94a` | `#b87a12` `#5e3406` `#160b02` | `#fff3a6` `#f6c93a` `#dc9a1c` `#a8680e` `#f6c93a` |
| Sublime | `#ffffff` `#f4e8ff` `#cfa8ff` | `#8447d4` `#3f1880` `#0f051f` | `#f0dcff` `#ad78f0` `#6a2fc0` `#f6c93a` `#fff3a6` |
| Pearlescent | `#ffffff` `#fdeaf3` `#e6dcf6` `#cfe6f4` | `#b9aed2` `#857bae` `#3a3158` `#0d0a17` | `#ffffff` `#ff9fcb` `#b396f0` `#7db9f2` `#7fe0c0` `#ffd78a` |

Two I retuned after the first pass, both Pearlescent. A's black fill first ran all the way to pearl (`#cdc2e0`), which made the black
pieces' tops as light as the white pieces' feet, so it now stops at `#b9aed2`. B's rim was first soft pastels that vanished on a light
square, so its colors are deeper.

## Which I'd pick

**A, the whole piece a gradient, for the full set.** It is the one that reads as a set of its own: on a phone the pieces look gold,
violet or pearl at a glance, and they stay as clean as today's because nothing is added round them. Both borders make every piece a
little fatter and busier at 46 px, and where pieces stand side by side the rims crowd. White against black holds in A for Gold and
Sublime (the two fills are 7.9 and 9.0 to 1 apart) and is acceptable for Pearlescent (4.7 to 1) only with the black fill held dark as
drawn. **B's gradient is clearly better than B-solid,** which confirms the worry: the flat rim reads as a sticker outline (heavy on
Sublime, nearly invisible on Pearlescent), while the gradient reads as metal or pearl. If B is the choice, it has one real advantage:
it never touches the fills, so white against black is exactly today's on every board. **For the king-and-queen-only purchase B is the
clearer one:** the rim picks the two pieces out, while in A the white king and queen are only a shade creamier than the pieces beside
them on a phone.

## The check at phone size (`3-marks-phone.png`), and what failed

Numbers: contrast is the usual luminance ratio (1 is no difference, 21 is black on white).

| | A: white fill against black fill, whole fills | A: the closest ends (white's foot, black's top) | B rim against the squares it sits on (rank board, default board) | B-solid against the same |
|---|---|---|---|---|
| Gold | 7.9 | 2.6 | 1.1 to 3.8 | 1.2 to 1.4 |
| Sublime | 9.0 | 2.8 | 1.0 to 6.5 | 1.7 to 4.7 |
| Pearlescent | 4.7 | 1.6 | 1.0 to 2.4 | 1.1 to 1.5 |

- **White against black:** no style loses it. B and B-solid keep today's fills (21 to 1). The weakest is Pearlescent A, as above.
- **The last move, the picked square, the capture ring:** readable under every style on both boards. The ring sits in the square's
  corners, which no rim reaches.
- **Check:** today's red glow reads under every style. (Check's glow is switched off in the game today, `BOARD.checkHighlight`; the
  sheet draws it as the board would.)
- **Failed, as a thing worth buying rather than as chess:**
  1. **Pearlescent B-solid:** the rim is 1.1 to 1.5 against every square. On a light square it can't be seen.
  2. **Gold B-solid:** 1.2 to 1.4. It shows only against the black pieces' own bodies.
  3. **Gold B on the Gold Board:** on the gold squares the rim is 1.2 to 2.1 and mostly melts into the square. It would do the same
     on the free "Gold" board colors in Settings. A rank's rim on its own rank's board is the weak case for B in general; Sublime
     escapes it only because its rim ends in gold.
- **Minor:** on the Sublime Board the last move's tint is yellow and on the Pearlescent Board it is pink, each close to one end of that
  rank's B rim, so the rim half disappears on those two squares. The piece and the tint both still read.

## The setting

- **Settings, Board:** "Always default board and pieces", with the line "Show the default board and pieces everywhere, even your own."
  Placed straight under Board colors.
- **In a match's options:** the row reads "Default board and pieces". The full title doesn't fit that row on a phone: it pushes the
  On/Off pill out of the list (tried at 390 px). The short one fits at 360 and 390.

## Questions for Eric

1. **Who sees your set?** Only you, or your opponent too? And does it dress both colors on your screen (as drawn) or only the side you
   play?
2. **The setting's "default":** your Board colors pick in Settings (Classic, Green or Gold) with today's pieces, or always Classic?
3. **Pearlescent A:** black to full pearl, as you described it, costs white against black. Is the darker version drawn here close
   enough to what you meant?
4. **King and queen only:** if the full set is A, should the cheaper purchase be A's king and queen, or B's (the clearer of the two)?
