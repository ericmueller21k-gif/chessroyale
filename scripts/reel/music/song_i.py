"""Song I (Eric, Nov 11): a Christmas-style boss theme, a 30-second sample, with the season's usual instruments.
A minor, a lilting four beats of three (12/8): 96 beats a minute, 48 beats = 12 bars = 30.0 s.
Voices: a glockenspiel lead (a soft pulse an octave under it), sleigh bells, a chime on each bar, plucked strings and
a quiet pulse in broken chords, held strings, a triangle bass, a soft kick and a brushed snare.
Every melody, riff and chord progression here is original: none of it is any carol's or any game's.
  python3 song_i.py <out.wav>

  bars  1-4   the tune: Am, F, C, E
  bars  5-8   its answer: Am, Dm, E, Am
  bars  9-12  the lift, higher, the plucked strings joining: F, C, Dm, E, and round to bar 1
"""
import sys

from synth import Mix, chords, length, line, write_wav

BPM = 96.0
BEATS = 48
SECS = BEATS * 60 / BPM

# Lengths here are in thirds of a beat (12 to the bar).
TUNE = (
    "E5:2 A5:1 C6:2 B5:1 A5:3 E5:3 | F5:2 A5:1 C6:2 A5:1 F5:3 C5:3 | E5:2 G5:1 C6:2 E6:1 D6:3 C6:3 | B5:2 G#5:1 E5:2 G#5:1 B5:6 | "
    "E5:2 A5:1 C6:2 B5:1 A5:3 C6:3 | D6:2 F6:1 E6:2 D6:1 A5:3 F5:3 | E5:1 G#5:1 B5:1 D6:2 C6:1 B5:3 G#5:3 | A5:6 E5:1 A5:1 C6:1 E6:3 | "
    "F6:3 E6:2 C6:1 A5:3 C6:3 | E6:3 D6:2 C6:1 G5:3 C6:3 | D6:2 E6:1 F6:2 A6:1 G6:3 F6:3 | E6:3 D6:2 B5:1 G#5:1 B5:1 D6:1 E6:3"
)
assert length(TUNE) == 144

AM, F, C, E, DM = "E4 A4 C5", "F4 A4 C5", "E4 G4 C5", "E4 G#4 B4", "F4 A4 D5"
CHORD = chords(
    [
        (0, 4, AM, "A2"), (4, 8, F, "F2"), (8, 12, C, "C3"), (12, 16, E, "E2"),
        (16, 20, AM, "A2"), (20, 24, DM, "D2"), (24, 28, E, "E2"), (28, 32, AM, "A2"),
        (32, 36, F, "F2"), (36, 40, C, "C3"), (40, 44, DM, "D2"), (44, 48, E, "E2"),
    ]
)
PANS = (-0.45, 0.0, 0.45)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=83)
    put = x.put
    tune = [(b / 3, d / 3, m) for b, d, m in line(0, TUNE)]

    # The lead: a glockenspiel, each note left to ring, and a soft pulse an octave under it.
    for b, d, m in tune:
        put("glock", b, x.bell(m + 12, max(d, 1.0) + 0.5, 0.15, ratio=4.0, index=1.4, decay=0.4), -0.1)
        put("lead", b, x.pulse(m, d * 0.9, 0.25, 0.085, vib=0.006 if d >= 1 else 0.0, decay=0.25, sustain=0.6, release=0.01), 0.1)

    for bar in range(0, BEATS, 4):
        notes, root = CHORD(bar)
        # A chime on each bar, held strings, the bass on each beat (root, fifth, root, fifth).
        put("chime", bar, x.bell(notes[2], 4, 0.1, ratio=3.5, index=2.4, decay=1.1), 0.35)
        for j, m in enumerate(notes):
            put("strings", bar, x.strings(m, 4, 0.04), PANS[j])
        for i in range(4):
            put("bass", bar + i, x.tri(root + (7 if i % 2 else 0), 0.62, 0.32, release=0.01))
            put("bass", bar + i + 2 / 3, x.tri(root + (7 if i % 2 else 0), 0.25, 0.22, release=0.01)) if i % 2 else None
        # The chord broken in threes: a quiet pulse, and from bar 9 plucked strings an octave up.
        for i in range(12):
            t = bar + i / 3
            m = notes[(0, 1, 2, 1, 2, 1)[i % 6]]
            put("arp", t, x.pulse(m + 12, 0.26, 0.125, 0.05, decay=0.06, sustain=0.4, release=0.006), 0.3)
            if bar >= 32:
                put("pluck", t, x.pluck(m + 12 + (12 if i % 6 >= 3 else 0), 1.0, 0.2, tone=0.7), -0.4 if i % 2 else 0.4)
        # Sleigh bells: every beat, and the skip before it. A soft kick on 1 and 3, a brushed snare on 2 and 4.
        for i in range(4):
            for o, v in ((0, 0.075), (0.045, 0.05), (2 / 3, 0.05), (2 / 3 + 0.045, 0.035)):
                put("sleigh", bar + i + o, x.noise(0.05, 22000, v, 0.016), 0.25)
            if i % 2 == 0:
                x.kick(bar + i, 0.36, soft=True)
            else:
                put("drum", bar + i, x.noise(0.12, 6000, 0.09, 0.05, attack=0.006))
    for i in range(6):  # a run of sleigh bells and brushes into the loop
        put("sleigh", 46 + i / 3, x.noise(0.05, 22000, 0.05 + 0.008 * i, 0.016), -0.25)

    x.echo("glock", 2 / 3, 0.14, 0.06)
    write_wav(out, x.mixdown({"bass": 0.5, "glock": 1.4, "sleigh": 4.0, "chime": 1.5, "strings": 1.6, "arp": 1.5, "pluck": 2.0}, lowpass=9000, room=0.22))


if __name__ == "__main__":
    main(sys.argv[1])
