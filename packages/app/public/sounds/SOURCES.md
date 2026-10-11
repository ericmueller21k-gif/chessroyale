# Piece sounds: where each file comes from

The sounds a piece makes, picked in Settings → Sound ("Move sound", "Capture sound"; `src/piece-sounds.ts`). The
first of each is the default. The files in `pieces/` are made by `scripts/piece-sounds.py` (in the repository, not the
app): trimmed to start on the hit, faded out, and levelled to the default beside them (the loudest 30 ms, as a phone
speaker and the game's 6 kHz low-pass hear it, matches today's move or capture). The other sounds in this folder have
their own `CREDITS.md` (`god-king/`, `banner/`, `menu/`).

| File | In the picker | Source | Author | Licence |
| --- | --- | --- | --- | --- |
| `move.mp3` | Move: **Wooden knock** (default) | PyChess, `sounds/mov2.wav`, https://github.com/pychess/pychess, converted to mp3 | the PyChess authors | GPL-3.0 (see below) |
| `capture.mp3` | Capture: **Double knock** (default) | PyChess, `sounds/capture2.wav` | the PyChess authors | GPL-3.0 (see below) |
| `castle.mp3` | Castling, with the default move sound (with another, the picked move sound plays twice) | PyChess, `sounds/castle.wav` | the PyChess authors | GPL-3.0 (see below) |
| `pieces/move-light-wood.mp3` | Move: **Light wood** | *Impact Sounds* 1.0, `impactWood_light_000.ogg`, https://kenney.nl/assets/impact-sounds | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-poker-chip.mp3` | Move: **Poker chip** | *Casino Audio* 1.1, `chip-lay-3.ogg` (from where the chip lands), https://kenney.nl/assets/casino-audio | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-click.mp3` | Move: **Click** | Made for the game: synthesised by `scripts/piece-sounds.py` (a few decaying partials and a short noise burst) | HunChess | Ours, no third-party rights |
| `pieces/move-soft.mp3` | Move: **Soft** | Made for the game, the same way | HunChess | Ours, no third-party rights |
| `pieces/capture-heavy-wood.mp3` | Capture: **Heavy wood** | *Impact Sounds* 1.0, `impactWood_medium_002.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-chips.mp3` | Capture: **Chips** | *Casino Audio* 1.1, `chips-collide-2.ogg`, pitched down a fifth | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-clack.mp3` | Capture: **Clack** | Made for the game, the same way (a bright knock, then the Click) | HunChess | Ours, no third-party rights |
| `pieces/capture-thud.mp3` | Capture: **Thud** | Made for the game, the same way (a small knock, then a low landing) | HunChess | Ours, no third-party rights |

- Kenney's licence, checked Oct 11, 2026: both pages say "Creative Commons CC0", and each pack's `License.txt` reads
  "License: (Creative Commons Zero, CC0) … free to use in personal, educational and commercial projects" (credit
  welcome, not required).
- **The defaults are GPL-3.0** (PyChess, chosen Oct 2 when the app was going to be GPL anyway). Since Oct 11 the game's
  source isn't published, so they're flagged in `DECISIONS.md`; every other option here is CC0 or ours.

## Looked at and not used

| What | Why not |
| --- | --- |
| Lichess's sound sets (lila `public/sound/`) | Its `COPYING.md`: `futuristic`, `nes`, `piano`, `sfx` are AGPLv3+ (Enigmahack); `lisp` is CC BY-NC-SA 4.0; the rest, the standard set included, are listed as non-free. |
| Chess.com's sounds | No licence offered: theirs. |
| Freesound, "Piece Placement.mp3" by el_boss (sound 546119, CC0, a piece set down on a wooden board) | Fine to use, but Freesound refused downloads from where these were made; a candidate for later. |
| Other "free" chess sounds a search turned up (BudgetPixel's AI-made "chess piece tap", Sonniss's royalty-free store) | Their own licences, not CC0 / CC BY / MIT: left out rather than read closely. |
