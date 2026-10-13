# Piece sounds: where each file comes from

The sounds a piece makes, picked in Settings → Sound ("Move sound", "Capture sound"; `src/piece-sounds.ts`). The
first of each is the default: the **classic knocks**, PyChess's (GPL-3.0). Next come three close variations of each
classic, then the other wooden options. The files in `pieces/` are made by `scripts/piece-sounds.py` (in the
repository, not the app): trimmed to start on the hit, faded out, and leveled to the classic knock of their kind (the
loudest 30 ms, as a phone speaker and the game's 6 kHz low-pass hear it, matches `move.mp3` or `capture.mp3`). The
other sounds in this folder have their own `CREDITS.md` (`god-king/`, `banner/`, `menu/`).

| File | In the picker | Source | Author | License |
| --- | --- | --- | --- | --- |
| `move.mp3` | Move: **Classic knock** (default) | PyChess, `sounds/mov2.wav`, https://github.com/pychess/pychess/tree/master/sounds, converted to mp3 | the PyChess authors | GPL-3.0 |
| `pieces/move-classic-light.mp3` | Move: **Classic light** | A variation of PyChess's sounds, made by our script: `mov2.wav` pitched up 2 semitones (resampled: 11% shorter too), a +3 dB high shelf at 2.5 kHz (brighter), and a slightly shorter decay (from the knock's peak, times e^(−t / 50 ms)) | the PyChess authors; modified by HunChess, Oct 12, 2026 | GPL-3.0 |
| `pieces/move-classic-deep.mp3` | Move: **Classic deep** | A variation of PyChess's sounds, made by our script: `mov2.wav` pitched down 2 semitones (12% longer too), a −3 dB high shelf at 2.5 kHz (darker), and a slightly longer decay (from the knock's peak, times e^(t / 50 ms), at most +6 dB) | the PyChess authors; modified by HunChess, Oct 12, 2026 | GPL-3.0 |
| `pieces/move-classic-soft.mp3` | Move: **Classic soft** | A variation of PyChess's sounds, made by our script: `mov2.wav` pitched down 1 semitone, a −5 dB high shelf at 2.5 kHz (darker), and a slightly shorter decay (times e^(−t / 80 ms)) | the PyChess authors; modified by HunChess, Oct 12, 2026 | GPL-3.0 |
| `pieces/move-light-wood.mp3` | Move: **Light wood** | *Impact Sounds* 1.0, `impactWood_light_000.ogg`, https://kenney.nl/assets/impact-sounds | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-wood-tap.mp3` | Move: **Wooden tap** | Made for the game: synthesized by `scripts/piece-sounds.py` (a few decaying partials and a short noise burst: a short, bright wooden knock) | HunChess | Ours, no third-party rights |
| `pieces/move-bright-wood.mp3` | Move: **Bright wood** | *Impact Sounds* 1.0, `impactWood_light_002.ogg`, pitched up three semitones | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-ringing-wood.mp3` | Move: **Ringing wood** | *Impact Sounds* 1.0, `impactWood_light_004.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/move-deep-wood.mp3` | Move: **Deep wood** | *Impact Sounds* 1.0, `impactWood_light_003.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `capture.mp3` | Capture: **Classic double knock** (default) | PyChess, `sounds/capture2.wav`, https://github.com/pychess/pychess/tree/master/sounds, converted to mp3 | the PyChess authors | GPL-3.0 |
| `pieces/capture-classic-light.mp3` | Capture: **Classic light double** | A variation of PyChess's sounds, made by our script: `capture2.wav` pitched up 2 semitones (11% shorter too), a +3 dB high shelf at 2.5 kHz (brighter), and a slightly shorter decay (from each knock's peak, times e^(−t / 120 ms)) | the PyChess authors; modified by HunChess, Oct 12, 2026 | GPL-3.0 |
| `pieces/capture-classic-deep.mp3` | Capture: **Classic deep double** | A variation of PyChess's sounds, made by our script: `capture2.wav` pitched down 2 semitones (12% longer too), a −3 dB high shelf at 2.5 kHz (darker), and a slightly longer decay (from each knock's peak, times e^(t / 60 ms), at most +6 dB) | the PyChess authors; modified by HunChess, Oct 12, 2026 | GPL-3.0 |
| `pieces/capture-classic-soft.mp3` | Capture: **Classic soft double** | A variation of PyChess's sounds, made by our script: `capture2.wav` pitched down 1 semitone, a −5 dB high shelf at 2.5 kHz (darker), and a slightly shorter decay (times e^(−t / 150 ms)) | the PyChess authors; modified by HunChess, Oct 12, 2026 | GPL-3.0 |
| `pieces/capture-heavy-wood.mp3` | Capture: **Heavy wood** | *Impact Sounds* 1.0, `impactWood_medium_002.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-double-knock.mp3` | Capture: **Double knock** | *Impact Sounds* 1.0, `impactWood_light_000.ogg` then `impactWood_medium_000.ogg` 45 ms later, mixed by `scripts/piece-sounds.py` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-short-wood.mp3` | Capture: **Short wood** | *Impact Sounds* 1.0, `impactWood_medium_003.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-wood-block.mp3` | Capture: **Wood block** | *Impact Sounds* 1.0, `impactWood_medium_004.ogg`, pitched up two semitones | Kenney (kenney.nl) | CC0 1.0 |
| `pieces/capture-big-wood.mp3` | Capture: **Big wood** | *Impact Sounds* 1.0, `impactWood_heavy_003.ogg` | Kenney (kenney.nl) | CC0 1.0 |
| `castle.mp3` | Castling, with the default move sound (with another, the picked move sound plays twice) | PyChess, `sounds/castle.wav`, converted to mp3 | the PyChess authors | GPL-3.0 |

- **PyChess's sounds are GPL-3.0** (its `LICENSE`, checked Oct 12, 2026: "GNU GENERAL PUBLIC LICENSE, Version 3, 29
  June 2007"). The classic files are the mp3s made on Oct 2, 2026, unchanged. The variations were made from the
  original WAVs at PyChess commit `94771355c49a04c3e8fc16dd135fe8ceed78a277` (its `sounds/` folder), each by the steps
  in its row, in this order: the pitch shift, the EQ, the decay, the trim to the hit, a short fade-out at the end,
  the leveling, and an mp3 at 96 kb/s (leveled once more from the mp3); the parameters are `VARIATIONS` in
  `scripts/piece-sounds.py`.
  The license's full text is served with the game at `/engine/COPYING.txt` (the same GPL-3.0 text Stockfish ships);
  the notice is in `/licenses/third-party.txt`; the credit is in Settings and the FAQ.
- **Why the game can ship them** (Eric, Oct 12, 2026: "classic PyChess knocks back as the default, GPL-3.0,
  credited"): a sound file is data the game plays, not code compiled into it, so the GPL covers these files, not the
  game, the same separate-file reasoning as Stockfish.
- Kenney's license, checked Oct 11, 2026: the pack's page says "Creative Commons CC0", and its `License.txt` reads
  "License: (Creative Commons Zero, CC0) … free to use in personal, educational and commercial projects" (credit
  welcome, not required).
- **Every option is wood** (Eric, Oct 12, 2026: "slightly different wooden sounds, not chips or clicks"). The non-wood
  options (Poker chip, Chips, Click, Soft, Clack, Thud) were removed that day, and the PyChess knocks too, for a few
  hours, until Eric brought them back as the defaults. A device that had picked a removed sound hears the default.
- The judge's gavel at a Crowd cut is the classic capture and move sounds, pitched down (`sound.ts`).

## Looked at and not used

| What | Why not |
| --- | --- |
| Lichess's sound sets (lila `public/sound/`) | Its `COPYING.md`: `futuristic`, `nes`, `piano`, `sfx` are AGPLv3+ (Enigmahack); `lisp` is CC BY-NC-SA 4.0; the rest, the standard set included, are listed as non-free. |
| Chess.com's sounds | No license offered: theirs. |
| Freesound, "Piece Placement.mp3" by el_boss (sound 546119, CC0, a piece set down on a wooden board) | Fine to use, but Freesound refused downloads from where these were made; a candidate for later. |
| Other "free" chess sounds a search turned up (BudgetPixel's AI-made "chess piece tap", Sonniss's royalty-free store) | Their own licenses, not CC0 / CC BY / MIT: left out rather than read closely. |
