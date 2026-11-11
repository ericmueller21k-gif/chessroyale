"""Song O (Eric, Nov 11): the hippo gardener's theme, a two-minute loop. His direction: a violin in "long violin kind
of pulls"; a "garden sort of greenhouse comfy" feeling with "simple little wind chiming"; and "once every minute sort
of a big drop" with 808s, "dueling strings" and "almost like orchestra level symphony", then back to the chimes.
A waltz, the only one of the boss themes in three: 132 beats a minute, 264 beats = 88 bars of three = 120.0 s.
D major in the garden; the drops turn to D minor.
Voices: a solo violin (slow bow, vibrato, a swell on each long note) and a second one; a flute; a soft marimba
racing through the chords in 16ths; a round bass and marimba chords in an oom-pah-pah; wind chimes; water drops and a bird (he waters
his plants); and for the one big drop an 808, a kick on every beat, a wobble bass, a clap, timpani, cymbals,
short driving strings, brass, and the two violins dueling: a bar each, then together.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_o.py <out.wav>

  bars  1-8    wind chimes, water drops and a bird; the violin's first long pulls
  bars  9-24   the garden waltz: the violin's tune (pulls, turns and runs) over the marimba and a round bass
  bars 25-32   a second violin answers under the first
  bars 33-48   a second garden tune on the flute, the violin answering under it
  bars 49-52   the hush: everything falls away, the violin hums low
  bars 53-66   the drop (1:11): a giant boom; kick on every beat, 808, wobble bass, strings, brass; the violins duel
  bars 67-72   the way back, slowly
  bars 73-84   the waltz again, a new turn of the tune, the flute joining
  bars 85-88   the chimes, a last long pull, and round to bar 1
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 132.0
BEATS = 264
SECS = BEATS * 60 / BPM

FIRST = "A5:6 F#5:3 E5:3"
# The waltz, second go (Eric: "increase it a bit, add a little more variety to the violin playing throughout"):
# long pulls still, with turns and runs between them.
WALTZ = (
    "F#5:2 A5:.5 B5:.5 | A5:1.5 G5:.5 F#5:.5 E5:.5 | B5:2 D6:1 | B5:.5 A5:.5 G5:1 A5:1 | "
    "A5:1.5 B5:.5 C#6:1 | E6:1 C#6:.5 A5:.5 G5:.5 E5:.5 | D5:2 F#5:.5 A5:.5 | D6:3 | "
    "B5:1 D6:1 F#6:1 | E6:.5 D6:.5 C#6:.5 B5:.5 F#5:1 | G5:2 B5:.5 D6:.5 | E6:1.5 D6:.5 B5:.5 G5:.5 | "
    "A5:1 C#6:1 E6:1 | G6:1.5 F#6:.5 E6:.5 C#6:.5 | D6:3 | F#6:.5 E6:.5 D6:.5 A5:.5 F#5:1"
)
SECOND = "-:1 A4:1 D5:1 | F#5:1 E5:1 D5:1 | -:1 D5:1 G5:1 | B4:1 D5:1 E5:1 | -:1 C#5:1 E5:1 | A4:1 B4:1 C#5:1 | A4:3 | F#4:3"
FLUTE = (
    "B5:1 D6:2 | B5:2 G5:1 | A5:1 D6:2 | A5:2 F#5:1 | G5:1 B5:1 E6:1 | C#6:2 A5:1 | D6:3 | -:1 A5:1 D6:1 | "
    "E6:1 D6:2 | B5:2 D6:1 | C#6:1 A5:2 | F#5:2 B5:1 | G5:1 B5:1 E6:1 | G6:2 E6:1 | F#6:3 | D6:3"
)
PULLS = (
    "D5:3 | -:1 B4:.5 D5:.5 G5:1 | F#5:3 | -:1 D5:.5 F#5:.5 A5:1 | G5:2 E5:1 | C#5:.5 E5:.5 A5:2 | F#5:3 | A5:.5 G5:.5 F#5:.5 E5:.5 D5:1 | "
    "G5:3 | -:1 B5:.5 A5:.5 G5:1 | F#5:2 C#5:1 | D5:.5 F#5:.5 B5:2 | G5:3 | E5:.5 G5:.5 A5:.5 C#6:.5 E6:1 | D6:3 | A5:3"
)
# The waltz's return after the drop: a new turn of the tune.
RETURN = (
    "F#5:1 A5:1 D6:1 | C#6:.5 D6:.5 E6:1 D6:1 | B5:2 G5:.5 B5:.5 | D6:1.5 E6:.5 D6:.5 B5:.5 | C#6:2 E6:1 | A6:1 G6:.5 E6:.5 C#6:1 | "
    "D6:1 F#6:1 A6:1 | F#6:1.5 E6:.5 D6:1 | B5:.5 C#6:.5 D6:1 F#6:1 | G6:2 B5:1 | A5:.5 B5:.5 C#6:.5 E6:.5 A6:1 | D6:3"
)
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
for name, beats in [(FIRST, 12), (WALTZ, 48), (SECOND, 24), (FLUTE, 48), (PULLS, 48), (TOGETHER, 24), (RETURN, 36)] + [(d, 3) for d in DUEL_1 + DUEL_2]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

CHORDS = {
    "D": ("D4 F#4 A4", "D2"), "G": ("D4 G4 B4", "G2"), "A": ("E4 A4 C#5", "A2"), "Bm": ("D4 F#4 B4", "B2"), "Em": ("E4 G4 B4", "E2"),
    "F#m": ("F#4 A4 C#5", "F#2"), "Dm": ("D4 F4 A4", "D2"), "Bb": ("D4 F4 Bb4", "Bb2"), "Gm": ("D4 G4 Bb4", "G2"),
}
BARS = (
    "D D D D D D D D  D D G G A A D D Bm Bm G Em A A D D  D D G G A A D D  "  # 1-32
    "G G D D Em A D D G G F#m Bm Em A D D  Bm Bm Bb A  "  # 33-52: the flute's tune, the hush
    "Dm Dm Bb Bb Gm Gm A A Dm Bb Gm A Dm A  Dm Dm Bb Bb A A  "  # 53-72: the drop, the way back
    "D D G G A A D D Bm G A D  D D D D"  # 73-88
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

    def wood(m, vol=0.2, decay=0.2):
        """A marimba bar: the note, a quick overtone two octaves up and a knock."""
        k = int(decay * 6 * x.sr)
        t = np.arange(k) / x.sr
        f = 2 * np.pi * x.hz(m) * t
        w = np.sin(f) + 0.3 * np.sin(4 * f) * np.exp(-t / 0.03) + 0.08 * np.sin(9.2 * f) * np.exp(-t / 0.008)
        return w * np.exp(-t / decay) * np.minimum(1, t / 0.002) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr)) * vol

    def garden(bar, harp=1.0, pizz=True, fill=0):
        """A garden bar: a soft marimba racing through the chord in 16ths, a round bass on 1 and soft marimba chords
        on 2 and 3. (No plucked strings: Eric, on the first go's plucked bass and harp: "a really loose guitar
        string ... cut that from the whole thing".)"""
        notes, root = chord(bar)
        b = bar * 3
        if harp:
            for i in range(12):
                s = ((0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 3), (2, 1, 0, 1, 2, 3, 4, 5, 4, 3, 2, 1))[(bar + fill) % 2][i]
                put("harp", b + i * 0.25, wood(notes[s % 3] + 12 + 12 * (s // 3), 0.1 * harp * (1.0 if i % 4 == 0 else 0.75), 0.14), 0.5 if i % 2 else -0.5)
        if pizz:
            put("pizz", b, x.fmbass(root + 12, 2.6, 0.3, index=0.8, decay=0.6))
            for o in (1, 2):
                for j, m in enumerate(notes):
                    put("pizz", b + o, wood(m, 0.09, 0.16), (-0.4, 0.0, 0.4)[j])

    def sub(b, m, beats, vol=0.5):
        k = x.k(beats)
        t = np.arange(k) / x.sr
        f = x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)
        ph = 2 * np.pi * np.cumsum(f) / x.sr
        env = np.exp(-t / (beats * x.beat_s * 0.6)) * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr))
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def wobble(b, m, beats, rate, vol=0.2, top=22.0, pan=0.0):
        """The wobble bass: a sawtooth whose brightness sweeps open and shut `rate` times a beat, driven hard."""
        k = x.k(beats)
        t = np.arange(k) / x.sr
        sweep = 0.5 - 0.5 * np.cos(2 * np.pi * rate * t / x.beat_s)
        cut = 1.5 + sweep * top
        w = np.zeros(k)
        for c in (-9, 9):
            ph = 2 * np.pi * x.hz(m + c / 100) * t
            for h in range(1, 26):
                w += np.sin(h * ph) / h * np.clip(cut - h + 1, 0, 1)
        edge = np.minimum(1, t / 0.005) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr))
        put("wobble", b, np.tanh(1.8 * w) * edge * vol, pan)

    # The wobble's bar of three: (beats, sweeps a beat), four ways round.
    WOB = [((3, 1),), ((1.5, 2), (1.5, 4)), ((1, 2), (1, 3), (1, 6)), ((2, 1), (1, 4))]

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

    def storm(first, bars_, fade=None):
        """Under the drop: a kick thumping on every beat and the 808 on the first; a clap and snare on every second
        bar's first beat; the wobble bass at changing speeds; hats in 8ths with rolls; short driving strings; brass
        holding the chord; timpani and cymbals. `fade`: the way back, each bar's level from 1 down to nothing."""
        for bar in range(first, first + bars_):
            notes, root = chord(bar)
            b, odd = bar * 3, (bar - first) % 2
            v = 1.0 if fade is None else fade[bar - first]
            low = root - (12 if root >= 43 else 0)
            sub(b, low, 2.6, 0.5 * v)
            for i in range(3):
                if v > 0.45 or i == 0:
                    x.kick(b + i, (0.75 if i == 0 else 0.55) * v, soft=True)
            if v > 0.45:
                x.kick(b + 2.5, 0.45 * v, soft=True)
            t = b
            for d, rate in WOB[(bar - first) % 4] if v > 0.6 else WOB[0]:
                wobble(t, low + 12, d, rate if v > 0.6 else 0.3333, 0.2 * v, 22.0 * max(v, 0.25))
                t += d
            if odd and v > 0.45:
                clap(b, 0.26 * v), x.snare(b, 0.22 * v)
                for i in range(6):
                    x.hat(b + 2.5 + i / 12, (0.03 + 0.006 * i) * v)
            elif not odd:
                put("drum", b, x.timp(root, 0.9, 0.34 * v))
            if v > 0.3:
                for i in range(6):
                    x.hat(b + i * 0.5, (0.055 if i % 2 == 0 else 0.035) * v)
                    for j, m in enumerate(notes):
                        put("strings", b + i * 0.5, x.strings(m, 0.32, 0.075 * v * (1.0 if i % 2 == 0 else 0.75), attack=0.01, sustain=0.5, decay=0.08, release=0.04), (-0.5, 0.0, 0.5)[j])
            for j, m in enumerate(notes):
                put("brass", b, x.swell(x.brass(m - 12, 3.0, 0.11 * v, attack=0.08, release=0.2), 0.6), (-0.3, 0.0, 0.3)[j])
            if (bar - first) % 4 == 0 and fade is None:
                x.crash(b, 0.2, decay=0.4)

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
        if d >= 1:
            put("chimes", b, x.bell(m + 12, d + 1, 0.05, ratio=4.0, index=1.4, decay=0.5), 0.2)
    for bar in range(24, 32):
        garden(bar, fill=1)
    chimes(72, 96, 8, 0.04)

    # Bars 33-48: the second garden tune on the flute, the violin answering under it in pulls and turns.
    for b, d, m in line(96, FLUTE):
        put("flute", b, x.flute(m, d * 0.96, 0.2), 0.2)
    bow(96, PULLS, 0.12, pan=-0.3)
    for bar in range(32, 48):
        garden(bar, fill=1)
    chimes(96, 144, 18, 0.04)
    drips(96, 144, 6, 0.07)
    bird(118, 0.04, -0.5)

    # Bars 49-52: the hush. Everything falls away: the violin hums low and soft, a last few chimes, then nothing.
    bow(144, "F#4:6 | F4:3 | E4:2 -:1", 0.075, pan=0.0)
    garden(48, harp=0.5, pizz=False), garden(49, harp=0.25, pizz=False)
    chimes(144, 150, 4, 0.04)
    for bar in (48, 49, 50):
        put("pizz", bar * 3, x.fmbass(chord(bar)[1] + 12, 2.8, 0.2 - 0.05 * (bar - 48), index=0.8, decay=0.6))

    # Bars 53-66: the drop (1:11, 19 seconds). A giant boom, then the thump: kick on every beat, the 808, the wobble
    # bass, driving strings and brass. The violins duel a bar each (left, then right), then play together.
    boom(156, 0.9), boom(156.02, 0.6)
    put("fx", 156, x.noise(1.6, 16000, 0.3, 0.45))
    storm(52, 14)
    for i in range(8):
        text = (DUEL_1 if i % 2 == 0 else DUEL_2)[i // 2]
        bow((52 + i) * 3, text, 0.17, pan=-0.5 if i % 2 == 0 else 0.5, fast=True, bus="violin2")
    together = TOGETHER.split("|")
    for b, d, m in line(180, "|".join(together[i] for i in (0, 2, 4, 5, 6, 7))):
        fast = d < 1
        put("violin2", b, violin(m, d * (0.9 if fast else 0.98), 0.16, fast), -0.4)
        put("violin2", b, violin(below(m), d * (0.9 if fast else 0.98), 0.14, fast), 0.4)
    boom(168, 0.45), boom(180, 0.5), boom(189, 0.4)

    # Bars 67-72: the way back, slowly: the thump thins and the wobble slows to one long sweep a bar and fades; the
    # violin returns in long pulls; the chimes, the water and the marimba come back.
    storm(66, 6, fade=(0.8, 0.62, 0.45, 0.3, 0.18, 0.08))
    bow(198, "A5:6 | F5:3 | D5:3 | E5:6", 0.13)
    chimes(204, 216, 12, 0.05)
    drips(207, 216, 4)
    bird(212, 0.04)
    garden(70, harp=0.4, pizz=False), garden(71, harp=0.8, pizz=False)

    # Bars 73-84: the waltz back, a new turn of the tune; the flute joins an octave up from its seventh bar.
    bow(216, RETURN)
    for b, d, m in line(234, "|".join(RETURN.split("|")[6:])):
        put("flute", b, x.flute(m + 12, d * 0.96, 0.13), 0.3)
    for bar in range(72, 84):
        garden(bar)
    chimes(216, 252, 14, 0.04)
    drips(216, 252, 5, 0.07)

    # Bars 85-88: the chimes, a last long pull, and round to bar 1.
    chimes(252, 264, 16, 0.06)
    drips(252, 264, 6)
    bow(252, "F#5:6 D5:6", 0.14)
    for m, pan in ((n("D3"), -0.3), (n("A3"), 0.3), (n("F#4"), 0.0)):
        put("strings", 252, x.swell(x.strings(m, 12, 0.045, attack=0.3, release=0.6), 0.4), pan)
    garden(84, harp=0.6, pizz=False)

    x.echo("chimes", 1.0, 0.25, 0.1)
    x.echo("water", 0.75, 0.3, 0.12)
    write_wav(out, x.mixdown({"chimes": 4.5, "water": 7.0, "harp": 1.6, "strings": 1.6, "sub": 0.7, "drum": 1.6, "wobble": 1.3, "brass": 2.0, "pizz": 0.6, "flute": 1.4, "violin": 0.97, "violin2": 1.15}, lowpass=9000, room=0.3))


if __name__ == "__main__":
    main(sys.argv[1])
