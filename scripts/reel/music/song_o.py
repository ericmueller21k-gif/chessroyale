"""Song O (Eric, Nov 11): the hippo gardener's theme, a two-minute loop. His direction: a violin in "long violin kind
of pulls"; a "garden sort of greenhouse comfy" feeling with "simple little wind chiming"; and "once every minute sort
of a big drop" with 808s, "dueling strings" and "almost like orchestra level symphony", then back to the chimes.
A waltz, the only one of the boss themes in three: 132 beats a minute, 264 beats = 88 bars of three = 120.0 s.
D major in the garden; the drops turn to D minor.
Voices: a solo violin (slow bow, vibrato, a swell on each long note) and a second one; a flute; a harp racing through
the chords in 16ths; plucked bass and plucked chords in an oom-pah-pah; wind chimes; water drops and a bird (he waters
his plants); and for the drops an 808, a kick, a clap, timpani, cymbals, short driving strings, brass, and the two
violins dueling: a bar each, then together.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_o.py <out.wav>

  bars  1-8    wind chimes, water drops and a bird; the violin's first long pulls
  bars  9-24   the garden waltz: the violin's tune over the harp and the oom-pah-pah
  bars 25-32   a second violin answers under the first
  bars 33-36   the sky darkens: tremolo strings, a timpani roll, a riser
  bars 37-52   the first drop (0:49): 808 and drums, driving strings, brass; the violins duel a bar each, then together
  bars 53-56   back to the chimes and water; two long pulls
  bars 57-72   a second garden tune on the flute, the violin in long pulls under it
  bars 73-76   the sky darkens again
  bars 77-84   the second drop (1:44): the brass takes a tune, both violins dueling at once
  bars 85-88   the chimes, a last long pull, and round to bar 1
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 132.0
BEATS = 264
SECS = BEATS * 60 / BPM

FIRST = "A5:6 F#5:3 E5:3"
WALTZ = (
    "F#5:3 | A5:2 G5:1 | B5:3 | G5:2 A5:1 | A5:3 | G5:2 E5:1 | D5:3 | -:1 D5:1 F#5:1 | "
    "B5:3 | D6:2 C#6:1 | G5:3 | E5:2 F#5:1 | A5:3 | B5:1 C#6:1 E6:1 | D6:6"
)
SECOND = "-:1 A4:1 D5:1 | F#5:1 E5:1 D5:1 | -:1 D5:1 G5:1 | B4:1 D5:1 E5:1 | -:1 C#5:1 E5:1 | A4:1 B4:1 C#5:1 | A4:3 | F#4:3"
FLUTE = (
    "B5:1 D6:2 | B5:2 G5:1 | A5:1 D6:2 | A5:2 F#5:1 | G5:1 B5:1 E6:1 | C#6:2 A5:1 | D6:3 | -:1 A5:1 D6:1 | "
    "E6:1 D6:2 | B5:2 D6:1 | C#6:1 A5:2 | F#5:2 B5:1 | G5:1 B5:1 E6:1 | G6:2 E6:1 | F#6:3 | D6:3"
)
PULLS = "D5:6 | F#5:3 | D5:3 | E5:6 | F#5:3 | A5:3 | G5:6 | F#5:6 | E5:3 | G5:3 | A5:3 | F#5:3"
# The duel: the first violin's bars and the second's, over the same chords.
DUEL_1 = [
    "D5:.5 F5:.5 A5:.5 D6:.5 C#6:.25 D6:.25 E6:.5", "Bb5:.5 D6:.5 F6:.5 Bb6:.5 A6:.25 G6:.25 F6:.5",
    "G5:.5 Bb5:.5 D6:.5 G6:.5 F#6:.25 G6:.25 A6:.5", "A5:.25 B5:.25 C#6:.25 D6:.25 E6:.5 G6:.5 F6:.5 E6:.5",
]
DUEL_2 = [
    "F6:.5 E6:.25 D6:.25 A5:.5 D6:.5 F6:.5 A6:.5", "D6:.25 E6:.25 F6:.25 G6:.25 A6:.5 Bb6:.5 F6:.5 D6:.5",
    "Bb6:.5 A6:.25 G6:.25 D6:.5 G6:.5 Bb6:.5 D7:.5", "C#6:.25 D6:.25 E6:.25 F6:.25 G6:.5 A6:.5 C#7:1",
]
TOGETHER = (
    "A6:1.5 F6:.5 D6:1 | E6:.5 F6:.5 G6:.5 A6:.5 F6:1 | Bb6:1.5 F6:.5 D6:1 | F6:.5 G6:.5 A6:.5 Bb6:.5 D7:1 | "
    "D7:1 Bb6:1 G6:1 | A6:.5 G6:.5 F6:.5 E6:.5 C#6:1 | D6:.5 E6:.5 F6:.5 A6:.5 D7:1 | C#7:1.5 A6:.5 E6:1"
)
BRASS_TUNE = "F5:3 | A5:2 G5:1 | Bb5:3 | D6:2 Bb5:1 | G5:2 Bb5:1 | A5:2 C#6:1 | D6:3 | C#6:3"
for name, beats in [(FIRST, 12), (WALTZ, 48), (SECOND, 24), (FLUTE, 48), (PULLS, 48), (TOGETHER, 24), (BRASS_TUNE, 24)] + [(d, 3) for d in DUEL_1 + DUEL_2]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

CHORDS = {
    "D": ("D4 F#4 A4", "D2"), "G": ("D4 G4 B4", "G2"), "A": ("E4 A4 C#5", "A2"), "Bm": ("D4 F#4 B4", "B2"), "Em": ("E4 G4 B4", "E2"),
    "F#m": ("F#4 A4 C#5", "F#2"), "Dm": ("D4 F4 A4", "D2"), "Bb": ("D4 F4 Bb4", "Bb2"), "Gm": ("D4 G4 Bb4", "G2"),
}
BARS = (
    "D D D D D D D D  D D G G A A D D Bm Bm G Em A A D D  D D G G A A D D  Bb Bb A A  "
    "Dm Dm Bb Bb Gm Gm A A Dm Dm Bb Bb Gm A Dm A  D D D D  G G D D Em A D D G G F#m Bm Em A D D  Bb Bb A A  "
    "Dm Dm Bb Bb Gm A Dm A  D D D D"
).split()
assert len(BARS) == 88
MINOR = (2, 4, 5, 7, 9, 10, 13)  # D harmonic minor, for the second violin's line under the first


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=139)
    put = x.put
    rng = np.random.default_rng(17)

    def chord(bar):
        notes, root = CHORDS[BARS[bar]]
        return [n(c) for c in notes.split()], n(root)

    def violin(m, beats, vol=0.16, fast=False):
        """A bowed string: a slow start, vibrato once the note settles, a swell through each long note."""
        w = x.add(m, beats, [1, 0.72, 0.55, 0.42, 0.3, 0.24, 0.18, 0.13, 0.1, 0.07, 0.05], vol, vib=0.0 if fast else 0.009,
                  attack=0.018 if fast else 0.09, sustain=0.88, decay=0.3, release=0.03 if fast else 0.14)
        if not fast and beats >= 2:
            u = np.linspace(0, 1, len(w))
            w = w * (0.62 + 0.38 * np.sin(np.pi * u**0.8))
        return w

    def bow(start, text, vol=0.16, pan=-0.15, up=0, fast=False, bus="violin"):
        for b, d, m in line(start, text):
            put(bus, b, violin(m + up, d * (0.9 if fast else 0.99), vol, fast), pan)

    def below(m):
        """Two steps down D harmonic minor."""
        steps = sorted({(s % 12) for s in MINOR})
        pc = m % 12
        if pc not in steps:
            return m - 3
        i = steps.index(pc) - 2
        return m - pc + steps[i % 7] + (12 * (i // 7))

    def chime(b, vol=0.05):
        m = 86 + (0, 2, 4, 7, 9, 12, 14)[rng.integers(0, 7)]
        put("chimes", b, x.bell(m, 3, vol * rng.uniform(0.5, 1), ratio=3.5, index=1.0, decay=0.7), rng.uniform(-0.7, 0.7))

    def chimes(a, b, count, vol=0.05):
        for _ in range(count):
            chime(a + rng.uniform(0, b - a), vol)

    def drop_of_water(b, vol=0.1, pan=0.0):
        """A water drop: a tiny tone that bends up as it lands."""
        k = int(0.09 * x.sr)
        t = np.arange(k) / x.sr
        f = rng.uniform(700, 1100) * (1 + 1.2 * (t / 0.09) ** 2)
        put("water", b, np.sin(2 * np.pi * np.cumsum(f) / x.sr) * np.exp(-t / 0.03) * np.minimum(1, t / 0.002) * vol, pan)

    def drips(a, b, count, vol=0.1):
        for _ in range(count):
            at = a + rng.uniform(0, b - a)
            drop_of_water(at, vol, rng.uniform(-0.6, 0.6))
            if rng.uniform() < 0.4:
                drop_of_water(at + 0.2, vol * 0.6, rng.uniform(-0.6, 0.6))

    def bird(b, vol=0.05, pan=0.5):
        for i, (m0, m1) in enumerate(((98, 103), (100, 105), (98, 103))):
            k = int(0.07 * x.sr)
            u = np.linspace(0, 1, k)
            ph = 2 * np.pi * np.cumsum(x.hz(m0 + (m1 - m0) * u)) / x.sr
            put("water", b + i * 0.28, np.sin(ph) * np.sin(np.pi * u) * vol, pan)

    def garden(bar, harp=1.0, pizz=True, fill=0):
        """A garden bar: the harp racing through the chord in 16ths, a plucked bass on 1 and plucked chords on 2 and 3."""
        notes, root = chord(bar)
        b = bar * 3
        if harp:
            for i in range(12):
                s = ((0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 3), (2, 1, 0, 1, 2, 3, 4, 5, 4, 3, 2, 1))[(bar + fill) % 2][i]
                put("harp", b + i * 0.25, x.pluck(notes[s % 3] + 12 * (s // 3), 0.9, 0.14 * harp * (1.0 if i % 4 == 0 else 0.75), tone=0.7), 0.5 if i % 2 else -0.5)
        if pizz:
            put("pizz", b, x.pluck(root, 2.5, 0.42, tone=0.4))
            put("pizz", b, x.fmbass(root, 1.2, 0.18))
            for o in (1, 2):
                for j, m in enumerate(notes):
                    put("pizz", b + o, x.pluck(m, 0.8, 0.13, tone=0.5), (-0.4, 0.0, 0.4)[j])

    def sub(b, m, beats, vol=0.5):
        k = x.k(beats)
        t = np.arange(k) / x.sr
        f = x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)
        ph = 2 * np.pi * np.cumsum(f) / x.sr
        env = np.exp(-t / (beats * x.beat_s * 0.6)) * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr))
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def clap(b, vol=0.22):
        for o in (0, 0.011, 0.023):
            put("drum", b + o / x.beat_s, x.noise(0.02, 11000, vol * 0.7, 0.006))
        put("drum", b + 0.03 / x.beat_s, x.noise(0.25, 11000, vol, 0.07))

    def riser(b, beats, vol=0.1):
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        ph = np.cumsum(x.hz(50) * 2 ** (24 * u / 12)) / x.sr
        put("fx", b, (2 * (ph % 1) - 1) * u**2 * vol, -0.2)
        put("fx", b, rng.uniform(-1, 1, k) * u**3 * vol * 0.6, 0.2)

    def boom(b, vol=0.5):
        k = int(0.7 * x.sr)
        t = np.arange(k) / x.sr
        f = 36 + 80 * np.exp(-t / 0.05)
        put("fx", b, np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / x.sr)) * np.exp(-t / 0.2) * vol * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr)))
        put("fx", b, x.noise(0.9, 16000, vol * 0.3, 0.2))

    def storm(first, bars_):
        """Under a drop, two bars at a time: the 808 and kick on the first beat, a clap and snare on the second bar's
        first beat, hats in 8ths with a roll, short driving strings in 8ths, brass holding the chord, timpani."""
        for bar in range(first, first + bars_):
            notes, root = chord(bar)
            b, odd = bar * 3, (bar - first) % 2
            if not odd:
                sub(b, root - (12 if root >= 43 else 0), 4.5, 0.5)
                x.kick(b, 0.7, soft=True), x.kick(b + 2.5, 0.5, soft=True)
                put("drum", b, x.timp(root, 0.9, 0.34))
            else:
                clap(b, 0.26), x.snare(b, 0.22)
                x.kick(b + 1.5, 0.5, soft=True)
                sub(b + 1.5, root - (12 if root >= 43 else 0), 1.4, 0.4)
                for i in range(6):
                    x.hat(b + 2.5 + i / 12, 0.03 + 0.006 * i)
            for i in range(6):
                x.hat(b + i * 0.5, 0.055 if i % 2 == 0 else 0.035)
                for j, m in enumerate(notes):
                    put("strings", b + i * 0.5, x.strings(m, 0.32, 0.075 * (1.0 if i % 2 == 0 else 0.75), attack=0.01, sustain=0.5, decay=0.08, release=0.04), (-0.5, 0.0, 0.5)[j])
            for j, m in enumerate(notes):
                put("brass", b, x.swell(x.brass(m - 12, 3.0, 0.11, attack=0.08, release=0.2), 0.6), (-0.3, 0.0, 0.3)[j])
            if (bar - first) % 4 == 0:
                x.crash(b, 0.2, decay=0.4)

    def darken(first):
        """Four bars: tremolo strings swelling, a timpani roll, a riser, the violin climbing a note a bar."""
        for bar in range(first, first + 4):
            notes, root = chord(bar)
            for i in range(12):
                v = 0.02 + 0.07 * ((bar - first) * 12 + i) / 48
                for j, m in enumerate(notes):
                    put("strings", bar * 3 + i * 0.25, x.strings(m + 12, 0.2, v, attack=0.01, release=0.02), (-0.5, 0.0, 0.5)[j])
            put("pizz", bar * 3, x.fmbass(root, 2.8, 0.22))
        bow(first * 3, "F5:3 | Bb5:3 | C#6:3 | E6:3", 0.15)
        for i in range(48):
            put("drum", first * 3 + 6 + i * 0.125, x.timp(n("A2"), 0.25, 0.04 + 0.006 * i))
        riser(first * 3 + 6, 6, 0.1)
        for i in range(12):
            x.snare(first * 3 + 9 + i * 0.25, 0.03 + 0.012 * i)

    # Bars 1-8: wind chimes, water and a bird; from bar 5 the violin's first pulls over a low held D.
    chimes(0, 24, 26, 0.06)
    drips(0, 24, 9)
    bird(4), bird(16, 0.04, -0.5)
    for m, pan in ((n("D3"), -0.3), (n("A3"), 0.3)):
        put("strings", 9, x.swell(x.strings(m, 15, 0.05, attack=0.5, release=0.6), 0.6), pan)
    bow(12, FIRST)
    garden(6, harp=0.5, pizz=False), garden(7, harp=0.8, pizz=False)

    # Bars 9-24: the garden waltz.
    bow(24, WALTZ)
    for bar in range(8, 24):
        garden(bar)
    chimes(24, 72, 18, 0.04)
    drips(24, 72, 6, 0.07)
    bird(46, 0.04)

    # Bars 25-32: the tune's first half again, a second violin answering under it; a little glockenspiel above.
    first_half = "|".join(WALTZ.split("|")[:8])
    bow(72, first_half)
    bow(72, SECOND, 0.13, pan=0.35, bus="violin2")
    for b, d, m in line(72, first_half):
        put("chimes", b, x.bell(m + 12, d + 1, 0.05, ratio=4.0, index=1.4, decay=0.5), 0.2)
    for bar in range(24, 32):
        garden(bar, fill=1)
    chimes(72, 96, 8, 0.04)

    # Bars 33-36: the sky darkens.
    darken(32)

    # Bars 37-52: the first drop. The violins duel a bar each (left, then right), then play together.
    boom(108, 0.6)
    storm(36, 16)
    for i in range(8):
        text = (DUEL_1 if i % 2 == 0 else DUEL_2)[i // 2]
        bow((36 + i) * 3, text, 0.17, pan=-0.5 if i % 2 == 0 else 0.5, fast=True, bus="violin" if i % 2 == 0 else "violin2")
    for b, d, m in line(132, TOGETHER):
        fast = d < 1
        put("violin", b, violin(m, d * (0.9 if fast else 0.98), 0.16, fast), -0.4)
        put("violin2", b, violin(below(m), d * (0.9 if fast else 0.98), 0.14, fast), 0.4)
    for b in (132, 144):
        boom(b, 0.4)

    # Bars 53-56: back to the chimes and the water; two long pulls.
    chimes(156, 168, 16, 0.06)
    drips(156, 168, 6)
    bird(159)
    bow(156, "A5:6 F#5:6", 0.14)
    for m, pan in ((n("D3"), -0.3), (n("A3"), 0.3), (n("F#4"), 0.0)):
        put("strings", 156, x.swell(x.strings(m, 12, 0.045, attack=0.3, release=0.6), 0.4), pan)
    garden(54, harp=0.5, pizz=False), garden(55, harp=0.8, pizz=False)

    # Bars 57-72: the second garden tune on the flute, the violin in long pulls under it.
    for b, d, m in line(168, FLUTE):
        put("flute", b, x.flute(m, d * 0.96, 0.2), 0.2)
    bow(168, PULLS, 0.12, pan=-0.3)
    for bar in range(56, 72):
        garden(bar, fill=1)
    chimes(168, 216, 18, 0.04)
    drips(168, 216, 6, 0.07)
    bird(190, 0.04, -0.5)

    # Bars 73-76: the sky darkens again.
    darken(72)

    # Bars 77-84: the second drop. The brass takes a tune; both violins duel at once, one each side.
    boom(228, 0.6)
    storm(76, 8)
    for b, d, m in line(228, BRASS_TUNE):
        put("brass", b, x.brass(m, d * 0.95, 0.16, attack=0.05, release=0.15))
        put("brass", b, x.brass(m - 12, d * 0.95, 0.1, attack=0.05, release=0.15), 0.2)
    one = DUEL_1[:2] + [DUEL_1[2], DUEL_1[3]]
    two = DUEL_2[:2] + [DUEL_2[2], DUEL_2[3]]
    order = (0, 0, 1, 1, 2, 3)  # the chords here: Dm Dm Bb Bb Gm A
    for i, k in enumerate(order):
        bow((76 + i) * 3, (one if i % 2 == 0 else two)[k], 0.16, pan=-0.5, fast=True)
        bow((76 + i) * 3, (two if i % 2 == 0 else one)[k], 0.14, pan=0.5, fast=True, bus="violin2")
    last = "|".join(TOGETHER.split("|")[6:])
    for b, d, m in line(246, last):
        fast = d < 1
        put("violin", b, violin(m, d * (0.9 if fast else 0.98), 0.16, fast), -0.4)
        put("violin2", b, violin(below(m), d * (0.9 if fast else 0.98), 0.14, fast), 0.4)

    # Bars 85-88: the chimes, a last long pull, and round to bar 1.
    boom(252, 0.3)
    chimes(252, 264, 16, 0.06)
    drips(252, 264, 6)
    bow(252, "F#5:6 D5:6", 0.14)
    for m, pan in ((n("D3"), -0.3), (n("A3"), 0.3), (n("F#4"), 0.0)):
        put("strings", 252, x.swell(x.strings(m, 12, 0.045, attack=0.3, release=0.6), 0.4), pan)
    garden(84, harp=0.6, pizz=False)

    x.echo("chimes", 1.0, 0.25, 0.1)
    x.echo("water", 0.75, 0.3, 0.12)
    write_wav(out, x.mixdown({"chimes": 4.5, "water": 7.0, "harp": 3.0, "strings": 1.6, "sub": 0.62, "drum": 1.3, "brass": 1.7, "pizz": 1.4, "flute": 1.4, "violin": 1.15}, lowpass=9000, room=0.3))


if __name__ == "__main__":
    main(sys.argv[1])
