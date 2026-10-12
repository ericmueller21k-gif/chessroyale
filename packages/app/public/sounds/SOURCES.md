# Piece sounds: where each file comes from

The sounds a piece makes, picked in Settings → Sound ("Move sound", "Capture sound"; `src/piece-sounds.ts`). The
first of each is the default. The files in `pieces/` are made by `scripts/piece-sounds.py` (in the repository, not the
app): trimmed to start on the hit, faded out, and levelled to the game's knocks (the loudest 30 ms, as a phone speaker
and the game's 6 kHz low-pass hear it, matches the loudness the game's move and capture have always had). The other sounds in this folder have
their own `CREDITS.md` (`god-king/`, `banner/`, `menu/`).

| File | In the picker | Source | Author | Licence |
| --- | --- | --- | --- | --- |
| `pieces/move-light-wood.mp3` | Move: **Light wood** (default) | *Impact Sounds* 1.0, `impactWood_light_000.ogg`, https://kenney.nl/assets/impact-sounds | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-wood-tap.mp3` | Move: **Wooden tap** | Made for the game: synthesised by `scripts/piece-sounds.py` (a few decaying partials and a short noise burst: a short, bright wooden knock) | HunChess | Ours, no third-party rights |
| `pieces/move-bright-wood.mp3` | Move: **Bright wood** | *Impact Sounds* 1.0, `impactWood_light_002.ogg`, pitched up three semitones | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-ringing-wood.mp3` | Move: **Ringing wood** | *Impact Sounds* 1.0, `impactWood_light_004.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-deep-wood.mp3` | Move: **Deep wood** | *Impact Sounds* 1.0, `impactWood_light_003.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-heavy-wood.mp3` | Capture: **Heavy wood** (default) | *Impact Sounds* 1.0, `impactWood_medium_002.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-double-knock.mp3` | Capture: **Double knock** | *Impact Sounds* 1.0, `impactWood_light_000.ogg` then `impactWood_medium_000.ogg` 45 ms later, mixed by `scripts/piece-sounds.py` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-short-wood.mp3` | Capture: **Short wood** | *Impact Sounds* 1.0, `impactWood_medium_003.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-wood-block.mp3` | Capture: **Wood block** | *Impact Sounds* 1.0, `impactWood_medium_004.ogg`, pitched up two semitones | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-big-wood.mp3` | Capture: **Big wood** | *Impact Sounds* 1.0, `impactWood_heavy_003.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/castle-wood.mp3` | Castling, with the default move sound (with another, the picked move sound plays twice) | *Impact Sounds* 1.0, `impactWood_light_000.ogg` twice, 110 ms apart (king, then rook) | Kenney (kenney.nl) | CC0 1.0 |

- Kenney's licence, checked Oct 11, 2026: the pack's page says "Creative Commons CC0", and its `License.txt` reads
  "License: (Creative Commons Zero, CC0) … free to use in personal, educational and commercial projects" (credit
  welcome, not required).
- **Every option is wood** (Eric, Oct 12, 2026: "slightly different wooden sounds, not chips or clicks"), CC0 or ours.
  The old defaults (PyChess's `mov2.wav`, `capture2.wav` and `castle.wav`, GPL-3.0) and the non-wood options (Poker
  chip, Chips, Click, Soft, Clack, Thud) were removed the same day: a game whose source isn't published can't ship GPL
  files. A device that had picked one of them hears the default now.
- The judge's gavel at a Crowd cut is the default capture and move sounds, a little lower (`sound.ts`).

## Looked at and not used

| What | Why not |
| --- | --- |
| Lichess's sound sets (lila `public/sound/`) | Its `COPYING.md`: `futuristic`, `nes`, `piano`, `sfx` are AGPLv3+ (Enigmahack); `lisp` is CC BY-NC-SA 4.0; the rest, the standard set included, are listed as non-free. |
| Chess.com's sounds | No licence offered: theirs. |
| Freesound, "Piece Placement.mp3" by el_boss (sound 546119, CC0, a piece set down on a wooden board) | Fine to use, but Freesound refused downloads from where these were made; a candidate for later. |
| Other "free" chess sounds a search turned up (BudgetPixel's AI-made "chess piece tap", Sonniss's royalty-free store) | Their own licences, not CC0 / CC BY / MIT: left out rather than read closely. |
