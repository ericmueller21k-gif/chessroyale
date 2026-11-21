# The God King's new shouts: four short cuts from Eric's own pack

Eric (Nov 20) uploaded a sound pack he made for the God King ("This is the sound pack ... that I made for the God
King. We're replacing the sound"): four short shouts and one long cry. He didn't want the cry. Nov 21, to the
director: "use the 3 sound bites at random in game for him, the most recent ones".

These are the most recent ones: his shouts at their own pitch, cut apart and cleaned of hiss.

| File | Where it sat in his pack | Length of the sound | Loudness (mean / peak) |
|---|---|---|---|
| `god-king-shout-1.mp3` | first shout (0.75 s in) | 0.28 s | -17.2 / -5.9 dBFS |
| `god-king-shout-2.mp3` | second (1.44 s in) | 0.27 s | -18.2 / -6.0 dBFS |
| `god-king-shout-3.mp3` | third (2.29 s in) | 0.30 s | -17.0 / -5.9 dBFS |
| `god-king-shout-4.mp3` | fourth (3.26 s in) | 0.26 s | -19.0 / -5.9 dBFS |

Mono, 44.1 kHz, 112 kbps MP3, as the God King's other sounds are; set to the level of his present voice cuts
(`hyuah`, `last-grunt1`, `last-grunt2`). Each file is about 0.31 to 0.34 s long with the MP3's own padding.

## Things to settle

- **Three or four.** Eric said "the 3 sound bites"; he was sent four. All four are here. Which one to leave out, or
  whether all four play, is his to say.
- **The source, for `CREDITS.md`.** The audio is Eric's own pack, not from the two CC0 packs the other God King sounds
  come from. Which tool or recording made it isn't recorded: he was asked on Nov 20 and Nov 21 and hasn't said yet.
- **Which moment.** They were made as replacements for his voice. Eric named no moment to the music helper; the
  director has it as the sword-raise shout (`hyuah`), one picked at random.

## How they were made

Nothing here is synthesized: it is his audio, cut and cleaned.

1. Cut where each shout rises out of silence and dies away.
2. Cleaned with `scripts/reel/music/voice_clean.py` on `claude/trailer-v2` (Eric: "it makes it sound airy or
   something"). The air measured as hiss: it is turned down between the voice's own tones (by up to 12 dB), cut
   above 5 kHz with a steep low-pass, and the tail fades once the voice is 22 dB under its loudest. Above 5 kHz
   the shouts now sit 36 to 50 dB under the voice (they were 16 to 24 dB under).
3. Trimmed, peak set to -5.5 dBFS, encoded.

The game's low-pass on effects (6 kHz) changes these very little: they already hold almost nothing above 5 kHz.

Not used: the same shouts an octave deeper (two ways, sent Nov 20; Eric: "Just use the original ones"), and the
pack's long cry. The pack itself is not in the repo.
