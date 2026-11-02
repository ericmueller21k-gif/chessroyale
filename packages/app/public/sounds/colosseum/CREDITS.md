# Colosseum sounds

Made by `scripts/crowd-sounds.py` (in the repository, not the app), leveled the way the game levels its piece sounds
(the loudest 30 ms through a phone speaker's 200 Hz high-pass and the game's 6 kHz low-pass, against `move.mp3`).

| File | When | Source | License |
| --- | --- | --- | --- |
| `ambient.mp3` | The arena's crowd, while the gear's "Ambient crowd noise" is on: streamed, from a random point in the hour, looping | Gladiator arena ambience, royalty free, supplied by Eric (Oct 31, 2026) | Royalty free |
| `cheer.mp3` | A queen taken: the crowd cheers as it jumps | "Free Crowd Cheering Sounds" by Gregor Quendel, tracks 03 and 04, with "applause-2" by Sandermotions | CC BY 4.0 (Quendel); CC0 1.0 (Sandermotions) |

**Credit (CC BY 4.0), shown in Settings and the FAQ:** Crowd cheer: "Free Crowd Cheering Sounds" by Gregor Quendel
(https://opengameart.org/content/free-crowd-cheering-sounds), licensed CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/). Trimmed, layered, EQ'd and leveled by HunChess.

## What was done

- **`ambient.mp3`**: Eric's hour (stereo, 44.1 kHz, about 118 kb/s, 53 MB, with a cover image) made fit for the game.
  Eric, Oct 31: "some of the clanging sounds … the highs need to come down … so they don't get as loud".
  - Mixed to mono at 22.05 kHz. A 60 Hz high-pass removes rumble no phone plays.
  - Above 2 kHz, where the clangs ring, a fast compressor works on 1 ms blocks: from 6 dB over that band's median, at
    6 : 1, recovering over 0.15 s. Below 2 kHz, where most of the crowd's voices are, nothing changes. This pulls the
    clangs' loudest moments (the top 0.1% of 10 ms windows) from about 9 dB over the voices' median to about level
    with it.
  - A gentle high shelf (-5 dB above about 3 kHz) makes the clangs duller and farther.
  - A broadband compressor works on 5 ms blocks: from 8 dB over the median, at 3 : 1, recovering over 0.3 s.
  - Leveled as an ambient bed: its average is 15 dB under a move, quiet enough to talk over.
  - Encoded at 40 kb/s CBR, about 18 MB for the hour. The bitrate is constant so a Range request can start it
    anywhere. Tags and the cover image are stripped.
- **`cheer.mp3`** (3.5 s): Quendel's "04 - Strong cheering - II - Short" from 5.2 s, made to burst in (a 0.12 s rise)
  and settle over about three seconds. Under it, "03 - Strong cheering - I" from 6.4 s, a beat later, at about half
  the level, and Sandermotions' applause (Freesound 277021,
  https://freesound.org/people/Sandermotions/sounds/277021/) from 1.2 s, at about a third. Then a 150 Hz high-pass, a
  0.4 s fade-out, and leveled to a move.
