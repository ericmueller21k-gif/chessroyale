"""Song I (Eric, Nov 11): a Christmas-style boss theme, a 30-second sample, with the season's usual instruments.
The second go (Eric on the first: "I wish there was just more notes and more going on, it's very dull"): faster, the
tune in running notes, a second voice in harmony under it, two chords in most bars, a walking bass, and more players.
A minor, a lilting four beats of three (12/8): 112 beats a minute, 56 beats = 14 bars = 30.0 s.
Voices: a glockenspiel lead (a pulse an octave under it), pulse 2 in harmony below, plucked strings in broken chords,
held strings, chimes on the chord changes, quick high bell runs, sleigh bells on every third of a beat, a walking
triangle bass, timpani, a kick, a snare and cymbals.
Every melody, riff and chord progression here is original: none of it is any carol's or any game's.
  python3 song_i.py <out.wav>

  bars  1-4   the tune: Am | F, G | C, E | Am, E
  bars  5-8   its answer, climbing: Am | Dm, G | C, F | Dm, E
  bars  9-12  the lift: F | C | Dm, B flat | E
  bars 13-14  the tag: falling runs over Am, F | Dm, E, a roll, and round to bar 1
"""
import sys

from synth import Mix, chords, length, line, n, write_wav

BPM = 112.0
BEATS = 56
SECS = BEATS * 60 / BPM

# Lengths here are in thirds of a beat (12 to the bar).
TUNE = (
    "E5:1 A5:1 C6:1 E6:2 D6:1 C6:1 B5:1 A5:1 C6:2 A5:1 | F5:1 A5:1 C6:1 F6:2 E6:1 D6:1 B5:1 G5:1 B5:2 D6:1 | "
    "E6:1 G6:1 E6:1 C6:2 E6:1 D6:1 B5:1 G#5:1 E5:2 G#5:1 | A5:1 C6:1 E6:1 A6:3 G#6:1 E6:1 B5:1 G#5:1 B5:1 E6:1 | "
    "E5:1 A5:1 C6:1 E6:2 D6:1 C6:1 E6:1 A6:1 G6:2 E6:1 | F6:1 D6:1 A5:1 F5:2 A5:1 G5:1 B5:1 D6:1 G6:2 F6:1 | "
    "E6:1 C6:1 G5:1 E6:2 G6:1 F6:1 C6:1 A5:1 F6:2 A6:1 | A6:1 F6:1 D6:1 A5:1 D6:1 F6:1 E6:1 G#6:1 B6:1 E6:3 | "
    "C6:2 A5:1 F5:1 A5:1 C6:1 F6:2 E6:1 C6:1 A5:1 C6:1 | E6:2 C6:1 G5:1 C6:1 E6:1 G6:2 E6:1 C6:1 E6:1 G6:1 | "
    "A6:2 F6:1 D6:1 F6:1 A6:1 Bb6:2 F6:1 D6:1 Bb5:1 D6:1 | E6:1 G#6:1 B6:1 G#6:1 E6:1 B5:1 G#5:1 B5:1 E6:1 G#6:3 | "
    "A6:1 E6:1 C6:1 A5:1 C6:1 E6:1 A6:1 F6:1 C6:1 A5:1 C6:1 F6:1 | F6:1 D6:1 A5:1 D6:1 F6:1 A6:1 G#6:1 E6:1 B5:1 E6:1 G#6:1 B6:1"
)
assert length(TUNE) == 168

AM, F, G, C, E, DM, BB = "E4 A4 C5", "F4 A4 C5", "D4 G4 B4", "E4 G4 C5", "E4 G#4 B4", "F4 A4 D5", "D4 F4 Bb4"
CHORD = chords(
    [
        (0, 4, AM, "A2"), (4, 6, F, "F2"), (6, 8, G, "G2"), (8, 10, C, "C3"), (10, 12, E, "E2"), (12, 14, AM, "A2"), (14, 16, E, "E2"),
        (16, 20, AM, "A2"), (20, 22, DM, "D3"), (22, 24, G, "G2"), (24, 26, C, "C3"), (26, 28, F, "F2"), (28, 30, DM, "D3"), (30, 32, E, "E2"),
        (32, 36, F, "F2"), (36, 40, C, "C3"), (40, 42, DM, "D3"), (42, 44, BB, "Bb2"), (44, 48, E, "E2"),
        (48, 50, AM, "A2"), (50, 52, F, "F2"), (52, 54, DM, "D3"), (54, 56, E, "E2"),
    ]
)
PANS = (-0.45, 0.0, 0.45)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=83)
    put = x.put
    tune = [(b / 3, d / 3, m) for b, d, m in line(0, TUNE)]

    def under(m, notes):
        """The chord's nearest note at least a minor third under the tune's."""
        pcs = {c % 12 for c in notes}
        return next(h for h in range(m - 3, m - 15, -1) if h % 12 in pcs)

    def sleigh(b, vol, pan=0.25):
        put("sleigh", b, x.noise(0.05, 22000, vol, 0.016), pan)
        put("sleigh", b + 0.04, x.noise(0.04, 22000, vol * 0.6, 0.014), pan)

    # The tune: a glockenspiel with a pulse an octave under it, and pulse 2 in harmony below.
    for b, d, m in tune:
        put("glock", b, x.bell(m + 12, max(d, 0.8) + 0.4, 0.15, ratio=4.0, index=1.4, decay=0.35), -0.1)
        put("lead", b, x.pulse(m, d * 0.9, 0.25, 0.085, vib=0.006 if d >= 1 else 0.0, decay=0.2, sustain=0.6, release=0.01), 0.1)
        put("harm", b, x.pulse(under(m, CHORD(b)[0]), d * 0.9, 0.125, 0.06, decay=0.2, sustain=0.6, release=0.01), 0.35)

    for bar in range(0, BEATS, 4):
        for half in (bar, bar + 2):
            notes, root = CHORD(half)
            if half == bar or CHORD(bar)[0] != notes:
                # A chime and the held strings on each chord.
                held = 2 if CHORD(bar)[0] != CHORD(bar + 2)[0] else 4
                put("chime", half, x.bell(notes[2], held, 0.1, ratio=3.5, index=2.4, decay=0.9), 0.35)
                for j, m in enumerate(notes):
                    put("strings", half, x.strings(m, held, 0.04), PANS[j])
            # The walking bass: root, a skip up to the fifth, the octave, and a step back down.
            for o, d, up in ((0, 2 / 3, 0), (2 / 3, 1 / 3, 7), (1, 2 / 3, 12), (5 / 3, 1 / 3, 7)):
                put("bass", half + o, x.tri(root + up, d * 0.85, 0.32, release=0.01))
        for i in range(12):
            t = bar + i / 3
            notes, _ = CHORD(t)
            s = (0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 2)[i]
            # The chord broken in threes over two octaves on plucked strings, and sleigh bells on every third.
            put("pluck", t, x.pluck(notes[s % 3] + 12 * (s // 3), 0.9, 0.2, tone=0.7), -0.4 if i % 2 else 0.4)
            sleigh(t, 0.075 if i % 3 == 0 else 0.045)
        # A kick on 1 and 3 (and the skip into 3), a snare on 2 and 4 with a light stroke before each.
        x.kick(bar, 0.4, soft=True), x.kick(bar + 2, 0.36, soft=True), x.kick(bar + 5 / 3, 0.22, soft=True)
        for o in (1, 3):
            x.snare(bar + o, 0.13), x.snare(bar + o - 1 / 3, 0.05)
        # Every second bar ends in a quick high run of bells, down the chord.
        if bar % 8 == 4 and bar < 48:
            notes, _ = CHORD(bar + 3)
            for i in range(6):
                put("glock", bar + 3 + i / 6, x.bell(notes[2 - i % 3] + 36 - 12 * (i // 3), 0.8, 0.07, ratio=4.0, index=1.2, decay=0.25), 0.4)

    for b in (0, 16, 32, 48):  # each part opens with a cymbal and a timpani stroke
        x.crash(b, 0.16, decay=0.3)
        put("drum", b, x.timp(CHORD(b)[1], 0.7, 0.3))
    for i in range(12):  # the tag's last bar: a timpani and snare roll into the loop
        put("drum", 54 + i / 6, x.timp(n("E2"), 0.25, 0.06 + 0.02 * i))
        x.snare(54 + i / 6, 0.04 + 0.009 * i)

    x.echo("glock", 2 / 3, 0.14, 0.06)
    levels = {"bass": 0.5, "glock": 1.4, "sleigh": 4.0, "chime": 1.5, "strings": 1.6, "harm": 1.3, "pluck": 2.0}
    write_wav(out, x.mixdown(levels, lowpass=9000, room=0.22))


if __name__ == "__main__":
    main(sys.argv[1])
