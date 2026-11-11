"""Song D (Eric, Nov 11): a 30-second loop in the style of a 16-bit console RPG's main theme: heroic and adventurous.
128 beats a minute, 64 beats = 16 bars of four = 30.0 s. D major, with a borrowed C chord for the adventure color.
The 16-bit console's voices: a brass lead, strings (a pad and short driving 8ths), a breathy flute, bells, a plucked
harp, a round bass, timpani and a light marching drum kit, in a small hall.
Every melody, riff and chord progression here is original: none of it is song A's, B's or C's, or any game's.
  python3 song_d.py <out.wav>

  bars  1-2   the fanfare: brass over a timpani roll
  bars  3-6   the theme: brass and strings, a dotted, striding tune
  bars  7-10  the answer: the flute joins an octave up, climbing to a held high note
  bars 11-14  the bridge: the drums drop out; flute and bells over a harp
  bars 15-16  the build: brass and tremolo strings, a timpani roll and a run that loops back to bar 1
"""
import sys

import numpy as np

from synth import Mix, chords, length, line, n, write_wav

BPM = 128.0
BEATS = 64
SECS = BEATS * 60 / BPM

# ---- the notes ----
FANFARE = "D5:.5 D5:.25 D5:.25 A5:1 G5:.5 F#5:.5 E5:1 | D5:.5 D5:.25 D5:.25 B5:1 A5:2"
THEME = (
    "D5:1.5 A4:.5 D5:.5 E5:.5 F#5:1 | G5:1.5 E5:.5 C5:1 E5:1 | "
    "D5:1.5 B4:.5 D5:.5 G5:.5 B5:1 | A5:2 E5:.5 C#5:.5 E5:.5 A5:.5"
)
ANSWER = (
    "B5:1.5 F#5:.5 B5:.5 A5:.5 F#5:1 | G5:1.5 B5:.5 D6:1 B5:1 | "
    "E6:1 D6:.5 B5:.5 G5:1 B5:.5 E6:.5 | C#6:1.5 A5:.5 E6:2"
)
BRIDGE = (
    "D6:.5 B5:.5 G5:1 A5:.5 B5:.5 D6:1 | C#6:.5 A5:.5 E5:1 A5:.5 C#6:.5 E6:1 | "
    "F#6:1.5 E6:.5 C#6:1 A5:1 | B5:1 D6:.5 F#6:.5 B6:2"
)
BUILD = "G5:.5 E5:.5 G5:.5 B5:.5 E6:1 D6:.5 B5:.5 | C#6:1 E6:.5 A5:.5 A5:.25 B5:.25 C#6:.25 D6:.25 E6:.25 F#6:.25 G6:.25 A6:.25"
for name, beats in [(FANFARE, 8), (THEME, 16), (ANSWER, 16), (BRIDGE, 16), (BUILD, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# ---- the chords ----
D, G, A, C = "D4 F#4 A4", "D4 G4 B4", "E4 A4 C#5", "E4 G4 C5"
CHORD = chords(
    [
        # the fanfare: D | G to A
        (0, 4, D, "D2"), (4, 6, G, "G2"), (6, 8, A, "A2"),
        # the theme: D, C, G over B, A
        (8, 12, D, "D2"), (12, 16, C, "C2"), (16, 20, G, "B1"), (20, 24, A, "A1"),
        # the answer: Bm, G, Em, A
        (24, 28, "D4 F#4 B4", "B1"), (28, 32, G, "G2"), (32, 36, "E4 G4 B4", "E2"), (36, 40, A, "A1"),
        # the bridge: G, A, F#m, Bm
        (40, 44, G, "G2"), (44, 48, A, "A2"), (48, 52, "F#4 A4 C#5", "F#2"), (52, 56, "F#4 B4 D5", "B1"),
        # the build: Em, A
        (56, 60, "E4 G4 B4", "E2"), (60, 64, A, "A1"),
    ]
)
PANS = (-0.45, 0.0, 0.45)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, seed=31)
    put = x.put

    def tune(start, text, voice, vol, gate=0.92, bus="lead", pan=0.0, up=0, **kw):
        for b, d, m in line(start, text):
            put(bus, b, voice(m + up, d * gate, vol, **kw), pan)

    def pad(a, b, vol=0.05, up=0):
        """Held strings, a bar (or a chord) at a time."""
        t = a
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            end = t + 1
            while end < b and end % 4 and CHORD(end)[0] == notes:
                end += 1
            for j, m in enumerate(notes):
                put("strings", t, x.strings(m + up, end - t, vol), PANS[j])
            t = end

    def drive(a, b, vol=0.075):
        """Short string 8ths on the chord, the beats leaned on: the theme's engine."""
        for i in range(int((b - a) * 2)):
            t = a + i * 0.5
            notes, _ = CHORD(t)
            v = vol * (1.0 if i % 2 == 0 else 0.7)
            for j, m in enumerate(notes):
                put("strings", t, x.strings(m, 0.34, v, attack=0.01, sustain=0.5, decay=0.08, release=0.04), PANS[j])

    def tremolo(a, b, v0=0.03, v1=0.09):
        k = int((b - a) * 4)
        for i in range(k):
            t = a + i * 0.25
            notes, _ = CHORD(t)
            for j, m in enumerate(notes):
                put("strings", t, x.strings(m + 12, 0.2, v0 + (v1 - v0) * i / k, attack=0.01, release=0.02), PANS[j])

    def harp(a, b, vol=0.2):
        """The chord rolled up and down in 16ths over two octaves."""
        shape = (0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3)
        for i in range(int((b - a) * 4)):
            t = a + i * 0.25
            notes, _ = CHORD(t)
            s = shape[i % 16]
            put("harp", t, x.pluck(notes[s % 3] + 12 * (s // 3), 1.4, vol * (1.0 if i % 4 == 0 else 0.75), tone=0.6), 0.5 * np.sin(i * 0.9))

    # The bass's bar: the root, a push before beat 3, the fifth and the octave on the way out.
    BASS_BAR = [(0, 1.5, 0), (1.5, 0.5, 0), (2, 1, 12), (3, 0.5, 7), (3.5, 0.5, 0)]

    def bass(a, b, vol=0.3):
        for bar in range(a, b, 4):
            for o, d, up in BASS_BAR:
                _, root = CHORD(bar + o)
                put("bass", bar + o, x.fmbass(root + 12 + up, d * 0.85, vol))

    def long_bass(a, b, vol=0.26):
        for bar in range(a, b, 4):
            _, root = CHORD(bar)
            put("bass", bar, x.fmbass(root + 12, 3.8, vol, decay=1.2))

    def timp(beat, note, vol=0.4):
        put("drum", beat, x.timp(note if isinstance(note, int) else n(note), 0.7, vol))

    def roll(a, b, note, v0=0.05, v1=0.3, step=0.125):
        k = int((b - a) / step)
        for i in range(k):
            put("drum", a + i * step, x.timp(n(note), 0.25, v0 + (v1 - v0) * i / k))

    def march(a, b):
        """A soft kick on 1 and 3, a marching snare with two quick strokes into beat 4, light 8th hats."""
        for bar in range(a, b, 4):
            x.kick(bar, 0.4, soft=True), x.kick(bar + 2, 0.32, soft=True)
            for o, v in ((1, 0.15), (2.5, 0.06), (2.75, 0.08), (3, 0.15), (3.5, 0.07)):
                x.snare(bar + o, v)
            for i in range(8):
                x.hat(bar + i * 0.5, 0.04 if i % 2 == 0 else 0.028)
            _, root = CHORD(bar)
            timp(bar, root + 12 if root < n("D2") else root, 0.26)

    # Bars 1-2: the fanfare. Brass in octaves, held strings, a timpani roll into the theme.
    x.crash(0, 0.2)
    tune(0, FANFARE, x.brass, 0.2)
    tune(0, FANFARE, x.brass, 0.12, up=-12, pan=-0.3)
    pad(0, 8, 0.06)
    pad(0, 8, 0.03, up=12)
    long_bass(0, 4), put("bass", 4, x.fmbass(n("G2"), 1.8, 0.26)), put("bass", 6, x.fmbass(n("A2"), 1.8, 0.26))
    timp(0, "D2", 0.4), timp(0.5, "D2", 0.2), timp(0.75, "D2", 0.24), timp(1, "A2", 0.34), timp(4, "G2", 0.34)
    for o, v in ((0, 0.14), (0.5, 0.07), (0.75, 0.09), (1, 0.14), (4, 0.14), (4.5, 0.07), (4.75, 0.09), (5, 0.14)):
        x.snare(o, v)
    roll(6, 8, "A2", 0.05, 0.3)

    # Bars 3-6: the theme. Brass leads, strings an octave up sing with it over the driving 8ths.
    x.crash(8, 0.24)
    tune(8, THEME, x.brass, 0.21)
    tune(8, THEME, x.strings, 0.07, up=12, pan=0.25, attack=0.03)
    drive(8, 24)
    pad(8, 24, 0.03, up=-12)
    bass(8, 24)
    march(8, 24)

    # Bars 7-10: the answer. The flute joins an octave up; bells mark each bar.
    x.crash(24, 0.16)
    tune(24, ANSWER, x.brass, 0.2)
    tune(24, ANSWER, x.flute, 0.13, up=12, pan=0.25)
    tune(24, ANSWER, x.strings, 0.06, up=12, pan=-0.25, attack=0.03)
    drive(24, 40)
    pad(24, 40, 0.03, up=-12)
    bass(24, 40)
    march(24, 40)
    for bar in range(24, 40, 4):
        notes, _ = CHORD(bar)
        put("bell", bar, x.bell(notes[2] + 12, 2.0, 0.06, decay=0.5), 0.4)
    for i in range(4):
        x.snare(39 + i * 0.25, 0.08 + 0.025 * i)

    # Bars 11-14: the bridge. The drums drop out: flute and bells sing over the harp and held strings.
    tune(40, BRIDGE, x.flute, 0.24, gate=0.95)
    tune(40, BRIDGE, x.bell, 0.07, up=12, bus="bell", pan=0.3, decay=0.4)
    harp(40, 56)
    pad(40, 56, 0.06)
    long_bass(40, 56)
    for bar in range(40, 56, 4):
        _, root = CHORD(bar)
        timp(bar, root + 12 if root < n("D2") else root, 0.2)
    for i in range(8):
        x.hat(54 + i * 0.25, 0.02 + 0.004 * i)

    # Bars 15-16: the build. Brass and tremolo strings, a timpani roll, and the run that loops back to bar 1.
    x.crash(56, 0.18)
    tune(56, BUILD, x.brass, 0.2)
    tune(56, BUILD, x.flute, 0.12, up=12, pan=0.25)
    tremolo(56, 64)
    pad(56, 64, 0.045)
    bass(56, 60)
    for i in range(8):
        put("bass", 60 + i * 0.5, x.fmbass(n("A1") + 12 + (12 if i % 2 else 0), 0.42, 0.3))
    march(56, 60)
    x.kick(60, 0.4, soft=True), timp(60, "A2", 0.3)
    roll(61, 64, "A2", 0.05, 0.32)
    for i in range(8):
        x.snare(62 + i * 0.25, 0.06 + 0.014 * i)

    x.echo("lead", 0.75, 0.16, 0.07)
    x.echo("bell", 0.75, 0.25, 0.1)
    # The balance, set by each voice's measured level: the strings, harp and bells up beside the brass, the bass down a little.
    levels = {"strings": 1.7, "harp": 2.2, "bell": 1.8, "bass": 0.8}
    write_wav(out, x.mixdown(levels, lowpass=6500, room=0.3))


if __name__ == "__main__":
    main(sys.argv[1])
