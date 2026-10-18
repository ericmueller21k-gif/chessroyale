# Board colors: Classic, Green or Gold for the dark squares, on this device only (Oct 18, 2026)

Eric, Oct 18:

> In the settings, there should be … we have the default chess colors and then that yellow that we use on the site. I want
> to have two options. One is like a more lightish green and then another is that yellow as chessboard options for the
> secondary color. And then you can just like tap. There would be like a little mini … image of it … so you could just
> kind of see what color it's going to be when you press it.

> I only want to do this if it's something where if a player does that, it's only visible to them, like only their color
> swaps.

(Custom boards in the shop are for later: not this.)

## What changed

- **Settings → BOARD → "Board colors"** (first in the section): three small boards side by side, **Classic**, **Green**,
  **Gold**. Each is the top left four by four squares of a board in its own colors, with the last move, a picked knight
  with its move dots, and a capture ring on them, so you see how the highlights read too. The picked one is gold, as
  the theme choice and the sound pickers mark theirs. A tap switches every board on the device at once.
- **Only this device.** `brc.boardColors` in localStorage (`prefs.ts`, with Animations and Motion trail); never sent
  anywhere, so everyone else always sees their own. A stored value that isn't one of the three (nothing, junk, a newer
  build's name) is Classic.
- **The shades** (the dark squares; the light squares are the cream they always were, `#f0d9b5`, in all three):

  | | dark squares | light/dark squares' luminance ratio |
  | --- | --- | --- |
  | Classic | `#c0ad90` (today's: 20 % black over the cream) | 1.59 |
  | Green | `#8fb36b` (a light, fresh green) | 1.73 |
  | Gold | `#e8b640` (the site's `--fd-gold` `#f2c14e`, a shade deeper) | 1.37 |

  - **Green:** my call, between the chess sites' two greens (`#86a666`, `#769656`) and lighter, since Eric said "more
    lightish". The cream squares stay: they sit well with it (a pale-yellow light square wasn't needed).
  - **Gold:** the site's gold itself (`#f2c14e`) beside the cream is only 1.22 in luminance, and read flat on a phone, so
    it's a shade deeper (1.37; Classic is 1.59). The two still differ clearly in hue and chroma, and the squares are
    told apart at a glance in the stills. **The light squares are unchanged on every scheme** (no scheme read badly with
    them).
- **What's drawn on the squares reads on each scheme** (a scheme sets `--sq-*` variables; Classic's are today's values,
  and a Classic board is pixel for pixel what it was, checked on a board with a last move, a picked piece and dots):
  - Last move: Classic's lime would sit on Green's squares, so Green's is a yellow (`rgba(255, 221, 0, .45)`) and Gold's a
    green (`rgba(34, 140, 90, .42)`), which sits on gold squares as an olive and on cream as a sage.
  - The picked square, the move dots and capture rings, the hover: Classic's dark green, but Green's is a deeper green
    (`rgba(20, 60, 20, ...)`) so dots on a green square still show.
  - The coordinates: white on a dark square was Classic's (2.1 : 1 against its tan, unchanged); on Green and Gold the
    dark squares are light enough that white would vanish, so their ink on dark squares is a dark green-black (Green,
    4.98 : 1) or the brown the light squares use (Gold, 4.82 : 1). On light squares it's the brown as before (4.84 : 1).
  - Check (off as always, `BOARD.checkHighlight`) is unchanged: an opaque red glow, so it shows on all three.
  - **Alfil's marked-pawn glow** was gold and would melt into the Gold squares: on Gold it's blue, from his caparison
    (`[data-board-colors="gold"] .al-glow`). Everything else a boss draws on the squares was looked at on Green and Gold
    on a phone, in the dark theme, and reads as it is: Chub & Chirp's carrots, Sawyer's saw groove and chips, Big Boy's
    toy blocks, Jefferson's fire, Ginger's ice, Boingo's pies, Hollow's dark and Wrangler's lasso.
- **Every board this device draws follows it,** since all of them are `OwnBoard` (`board/OwnBoard.tsx`): a match in
  Crowd, Classic, Squads and 1 v 1, boss battles and raids, the votes, the reveal, the finals, replays and history, the
  results' mini boards, the God King's moments, and the computer's live window on home. **The one exception (my call):**
  `TinyBoard`'s pixel boards (Classic's boards strip and Squads' thumbnails). They are small status icons in a muted
  blue-gray that never matched the brown board; they stay as they are.

## How (the least code, no lag)

- The page carries the pick as `<html data-board-colors="classic|green|gold">` (set at start-up and by each pick, as the
  theme is), and `styles.css`, "Board colors", defines the colors from it. Nothing redraws when it changes, and no
  board's props or `boardInputs` changed.
- **The board's drawing changed once:** it used to be a light ground with an SVG image of the 32 dark squares as 20 % black
  over it, which can't take a color. Now the `.hb-board`'s ground is the dark color and its `::before` is the light color,
  masked to the 32 light squares (an SVG mask: crisp edges, any size, as the image was). Both colors are plain CSS colors,
  so a test reads them (`getComputedStyle`). The Settings previews use the same two rules at a size of four squares, and
  carry their own `data-board-colors`, so each shows its colors whatever is picked.
- A device that can't store (private mode) keeps the pick until the page closes.

## Tests

`packages/app/test/board-colors.test.ts` (Classic by default, remembered, unknown values ignored, on the page, nothing
sent); `e2e/board-colors.spec.ts`, phone and computer (Settings → Green → a match's dark squares are green, computed and
painted → reload, still Green → Classic gives today's colors back; the previews' colors; nothing sent).

## For the director

`prefs.ts`, `main.tsx` and `board/**` are on `e2e/areas.json`'s `full` list, so the PR's e2e run is the whole suite.
