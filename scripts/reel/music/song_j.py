"""Song J (Eric, Nov 11): Big Boy's theme, a 30-second sample in Song I's busy style: "toy blocks, wooden sound",
playful and a bit off-kilter, like a cartoon about toddlers.
F major with borrowed chords for the wobble (G, B flat minor, A flat, D flat, E flat). 136 beats a minute,
68 beats = 17 bars = 30.0 s: a bar of toy blocks, then 16 bars.
Voices: a xylophone lead (a pulse an octave under it), pulse 2 in harmony below, a marimba in broken chords, a thin
pulse racing through the chords in 16ths, toy blocks (a high and a low knock, and tumbles down at the ends of
phrases), a waddling triangle bass, a toy-piano bell on each chord, a squeak, a soft kick, a light snare and a shaker.
Every melody, riff and chord progression here is original: none of it is any show's or any game's.
  python3 song_j.py <out.wav>

  bar   1      toy blocks alone, the bass stepping up
  bars  2-5    the tune: F, G, B flat to B flat minor, C
  bars  6-9    again, higher, by way of A flat
  bars 10-13   the middle: Dm, B flat, G, C
  bars 14-17   the tune's first bar stepped through F, D flat, E flat, then a tumble down C to the loop
"""
import sys

import numpy as np

from synth import Mix, chords, length, line, n, write_wav

BPM = 136.0
BEATS = 68
SECS = BEATS * 60 / BPM

TUNE = (
    "C5:.5 F5:.5 A5:.5 C6:.5 A5:.25 -:.25 F5:.5 A5:1 | B5:.5 D6:.5 B5:.5 G5:.5 A5:.25 B5:.25 D6:.5 G6:1 | "
    "F6:.5 D6:.5 Bb5:.5 D6:.5 Db6:.5 Bb5:.5 F5:.5 Bb5:.5 | C6:.5 -:.5 E5:.25 G5:.25 C6:.5 E6:.5 -:.5 C6:1 | "
    "C5:.5 F5:.5 A5:.5 C6:.5 F6:.25 -:.25 C6:.5 A5:1 | B5:.5 D6:.5 G6:.5 D6:.5 B5:.25 D6:.25 G6:.5 B6:1 | "
    "Ab6:.5 Eb6:.5 C6:.5 Eb6:.5 Ab5:.5 C6:.5 Eb6:1 | E6:.5 -:.5 G5:.25 C6:.25 E6:.5 G6:.5 -:.5 C6:1 | "
    "D6:.75 F6:.75 A6:.5 F6:.5 D6:.5 A5:1 | D6:.75 F6:.75 Bb6:.5 F6:.5 D6:.5 Bb5:1 | "
    "B5:.25 D6:.25 G6:.5 B5:.25 D6:.25 G6:.5 B6:.5 G6:.5 D6:1 | C6:.5 E6:.5 G6:.5 Bb6:1.5 G6:.5 E6:.5 | "
    "C5:.5 F5:.5 A5:.5 C6:.5 A5:.25 -:.25 F5:.5 A5:1 | Ab5:.5 Db6:.5 F6:.5 Ab6:.5 F6:.25 -:.25 Db6:.5 F6:1 | "
    "Bb5:.5 Eb6:.5 G6:.5 Bb6:.5 G6:.25 -:.25 Eb6:.5 G6:1 | G6:.25 E6:.25 C6:.25 G5:.25 E6:.25 C6:.25 G5:.25 E5:.25 C6:.5 -:.5 C6:.5 -:.5"
)
assert length(TUNE) == 64

F, G, BB, BBM, C, AB, DM, DB, EB = "F4 A4 C5", "D4 G4 B4", "D4 F4 Bb4", "Db4 F4 Bb4", "E4 G4 C5", "Eb4 Ab4 C5", "F4 A4 D5", "F4 Ab4 Db5", "Eb4 G4 Bb4"
CHORD = chords(
    [
        (0, 4, C, "C3"),
        (4, 8, F, "F2"), (8, 12, G, "G2"), (12, 14, BB, "Bb2"), (14, 16, BBM, "Bb2"), (16, 20, C, "C3"),
        (20, 24, F, "F2"), (24, 28, G, "G2"), (28, 32, AB, "Ab2"), (32, 36, C, "C3"),
        (36, 40, DM, "D3"), (40, 44, BB, "Bb2"), (44, 48, G, "G2"), (48, 52, C, "C3"),
        (52, 56, F, "F2"), (56, 60, DB, "Db3"), (60, 64, EB, "Eb3"), (64, 68, C, "C3"),
    ]
)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=97)
    put = x.put

    def wood(m, vol=0.2, decay=0.16):
        """A wooden bar struck with a mallet: the note, a quick overtone two octaves up and a knock."""
        k = int(decay * 6 * x.sr)
        t = np.arange(k) / x.sr
        f = 2 * np.pi * x.hz(m) * t
        w = np.sin(f) + 0.45 * np.sin(4 * f) * np.exp(-t / 0.03) + 0.15 * np.sin(9.2 * f) * np.exp(-t / 0.008)
        return w * np.exp(-t / decay) * np.minimum(1, t / 0.001) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr)) * vol

    def block(b, hz=900.0, vol=0.2, pan=0.0):
        """A toy block knocked: a very short hollow tone."""
        k = int(0.09 * x.sr)
        t = np.arange(k) / x.sr
        w = np.sin(2 * np.pi * hz * t) + 0.5 * np.sin(2 * np.pi * hz * 2.7 * t) * np.exp(-t / 0.006)
        put("blocks", b, w * np.exp(-t / 0.018) * np.minimum(1, t / 0.0005) * vol, pan)

    def tumble(b, steps=8, step=0.125, top=1500.0):
        """Blocks falling over: quick knocks stepping down, side to side."""
        for i in range(steps):
            block(b + i * step, top * 0.88**i, 0.14 + 0.012 * i, 0.5 if i % 2 else -0.5)

    def under(m, notes):
        pcs = {c % 12 for c in notes}
        return next(h for h in range(m - 3, m - 15, -1) if h % 12 in pcs)

    def squeak(b, vol=0.08):
        put("lead", b, x.pulse(n("C6"), 0.3, 0.25, vol, bend=(0, 12), decay=0.1, sustain=0.7, release=0.01), 0.4)

    # Bar 1: toy blocks alone, the bass stepping up to F.
    for o, hz, v in ((0, 760, 0.2), (0.5, 1050, 0.16), (1, 1050, 0.16), (1.5, 760, 0.2), (2, 1050, 0.16), (2.5, 760, 0.2), (2.75, 760, 0.14), (3, 1050, 0.18)):
        block(o, hz, v, -0.3 if hz < 900 else 0.3)
    tumble(3.25, 6, 0.125, 1400)
    for o, m in ((0, "C3"), (2, "C3"), (3, "D3"), (3.5, "E3")):
        put("bass", o, x.tri(n(m), 0.4, 0.32, release=0.01))

    # The tune: a xylophone with a pulse an octave under it, and pulse 2 in harmony below.
    for b, d, m in line(4, TUNE):
        put("xylo", b, wood(m + 12, 0.2), -0.1)
        put("lead", b, x.pulse(m, d * 0.7, 0.25, 0.075, decay=0.12, sustain=0.5, release=0.01), 0.1)
        put("harm", b, x.pulse(under(m, CHORD(b)[0]), d * 0.7, 0.125, 0.055, decay=0.12, sustain=0.5, release=0.01), 0.35)

    for bar in range(4, BEATS, 4):
        last = bar == 64
        for half in (bar, bar + 2):
            notes, root = CHORD(half)
            if half == bar or CHORD(bar)[0] != notes:
                put("bell", half, x.bell(notes[2] + 12, 2, 0.08, ratio=5.0, index=1.8, decay=0.3), 0.35)  # a toy piano
            # The waddle: the root, a short fifth above, the root, and a step up into the next beat.
            for o, d, up in ((0, 0.5, 0), (0.5, 0.25, 7), (1, 0.5, 0), (1.5, 0.25, 7), (1.75, 0.25, 9 if half == bar else 5)):
                put("bass", half + o, x.tri(root + up, d * 0.8, 0.32, release=0.01))
        for i in range(16):
            t = bar + i * 0.25
            notes, _ = CHORD(t)
            # The fast pattern under it all: a thin pulse racing up and down the chord in 16ths.
            s = (0, 1, 2, 3, 4, 3, 2, 1)[i % 8]
            put("arp", t, x.pulse(notes[s % 3] + 12 + 12 * (s // 3), 0.2, 0.125, 0.085, decay=0.04, sustain=0.4, release=0.004), -0.3)
            # A marimba in broken chords on the 8ths, low; a shaker on the 16ths.
            if i % 2 == 0:
                put("marimba", t, wood(notes[(0, 2, 1, 2)[(i // 2) % 4]] - 12, 0.2, 0.2), 0.4 if (i // 2) % 2 else -0.4)
            put("drum", t, x.noise(0.03, 20000, 0.022 if i % 2 else 0.035, 0.01), -0.25)
        # Toy blocks: a low and a high knock in a clip-clop; a kick on 1 and 3; a light snare on 2 and 4.
        if not last:
            for o, hz, v in ((0, 760, 0.16), (0.75, 1050, 0.12), (1.5, 1050, 0.14), (2, 760, 0.16), (2.5, 1050, 0.12), (3.5, 1050, 0.14)):
                block(bar + o, hz, v, -0.3 if hz < 900 else 0.3)
        x.kick(bar, 0.4, soft=True), x.kick(bar + 2, 0.36, soft=True)
        x.snare(bar + 1, 0.11), x.snare(bar + 3, 0.11)

    # Ends of phrases: a squeak in the tune's gap and blocks tumbling down; the last bar is one long tumble.
    for bar in (16, 32):
        squeak(bar + 3)
        tumble(bar + 3, 8, 0.125)
    tumble(51, 8, 0.125)
    tumble(64, 16, 0.125, 1900)
    squeak(67, 0.09)
    for b in (4, 20, 36, 52):
        x.crash(b, 0.13, decay=0.25)

    levels = {"bass": 0.5, "blocks": 3.2, "xylo": 1.4, "marimba": 0.8, "bell": 2.0}
    write_wav(out, x.mixdown(levels, lowpass=9000, room=0.15))


if __name__ == "__main__":
    main(sys.argv[1])
