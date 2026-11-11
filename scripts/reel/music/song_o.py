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
  bars  9-14   the soft violin over the marimba and a round bass
  bars 15-18   the hush: everything falls away, the violin hums low
  bars 19-44   the first drop (0:24.5 to 1:00): a giant boom; kick on every beat, 808, wobble bass, strings, brass; the
               violins duel a bar each, share a riff in octaves, play together, then duel at once under a brass tune
  bars 45-50   a small calm: the thump thins and fades, long pulls, soft chimes
  bar  51      near silence
  bars 52-88   the second drop (1:09.5 to the end), crazier: an octobass leads in slow pulls, the violins dueling
               under it; glitches and trance (a gated chord, runs, stutters, zaps); it ends on one hit and a stutter
               falling into bar 1's chimes
(Eric, fourth go: after the first 25 seconds the drop "should just stay that way the entire time"; the chimes only in
the intro and softly in the calm.)
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
# The first drop's middle: both violins on one riff in octaves, short notes with gaps, over Dm, C, B flat, A.
RIFF = (
    "D6:.5 D6:.5 -:.5 F6:.5 E6:.5 D6:.5 | A5:1 -:.5 D6:.5 F6:.5 A6:.5 | G6:.5 -:.5 G6:.5 E6:.5 C6:.5 E6:.5 | C6:1 -:.5 E6:.5 G6:.5 C7:.5 | "
    "F6:1 D6:.5 -:.5 Bb5:.5 D6:.5 | Bb5:1 -:.5 D6:.5 F6:.5 Bb6:.5 | C#6:.5 E6:.5 -:.5 G6:.5 F6:.5 E6:.5 | A6:1.5 G6:.25 F6:.25 E6:.5 C#6:.5"
)
# The second drop opens on the brass alone over the bass.
BRASS_TUNE = "F5:3 | A5:2 G5:1 | Bb5:3 | D6:2 Bb5:1"
# The second drop's lead: an octobass, the giant of the string family, in slow pulls two octaves under the violins.
OCTO_1 = "D2:3 | F2:2 E2:1 | Bb1:3 | D2:2 F2:1 | G2:3 | Bb2:2 A2:1 | A2:3 | C#3:2 E3:1"
OCTO_2 = "D3:3 | A2:2 F2:1 | Bb2:3 | F2:2 D2:1 | G2:2 Bb2:1 | A2:2 C#3:1 | D3:3 | A2:3"
TOGETHER = (
    "A6:1.5 F6:.5 D6:1 | E6:.5 F6:.5 G6:.5 A6:.5 F6:1 | Bb6:1.5 F6:.5 D6:1 | F6:.5 G6:.5 A6:.5 Bb6:.5 D7:1 | "
    "D7:1 Bb6:1 G6:1 | A6:.5 G6:.5 F6:.5 E6:.5 C#6:1 | D6:.5 E6:.5 F6:.5 A6:.5 D7:1 | C#7:1.5 A6:.5 E6:1"
)
for name, beats in [(FIRST, 12), (WALTZ, 48), (SECOND, 24), (FLUTE, 48), (PULLS, 48), (TOGETHER, 24), (RETURN, 36), (RIFF, 24), (BRASS_TUNE, 12), (OCTO_1, 24), (OCTO_2, 24)] + [(d, 3) for d in DUEL_1 + DUEL_2]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

CHORDS = {
    "D": ("D4 F#4 A4", "D2"), "G": ("D4 G4 B4", "G2"), "A": ("E4 A4 C#5", "A2"), "Bm": ("D4 F#4 B4", "B2"), "Em": ("E4 G4 B4", "E2"),
    "F#m": ("F#4 A4 C#5", "F#2"), "Dm": ("D4 F4 A4", "D2"), "Bb": ("D4 F4 Bb4", "Bb2"), "Gm": ("D4 G4 Bb4", "G2"), "C": ("E4 G4 C5", "C3"),
}
BARS = (
    "D D D D D D D D  D D G G A A  Bm Bm Bb A  "  # 1-18: the intro, the soft violin, the hush
    "Dm Dm Bb Bb Gm Gm A A  Dm Dm C C Bb Bb A A  Dm Bb Gm A Dm A  Dm Dm Bb Bb  "  # 19-44: the first drop
    "Dm Dm Bb Bb A A  A  "  # 45-51: the calm, the silence
    "Dm Dm Bb Bb Gm Gm A A  Dm Dm C C Bb Bb A A  Dm Dm Bb Bb Gm A Dm A  Dm Dm Bb Bb Gm Gm A A  Dm Bb Gm A Dm"  # 52-88: the second drop
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

    WOB2 = [((1, 3), (2, 1)), ((3, 2),), ((1.5, 4), (1.5, 1)), ((1, 6), (1, 2), (1, 4))]

    def storm(first, bars_, fade=None, kind=0, wob_up=0, wob_vol=1.0):
        """Under the drop: a kick thumping on every beat and the 808 on the first; a clap and snare on every second
        bar's first beat; the wobble bass at changing speeds; hats in 8ths with rolls; short driving strings; brass
        holding the chord; timpani and cymbals. `fade`: the way back, each bar's level from 1 down to nothing. `kind` 1: the second drop's wobble
        speeds and kit."""
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
            for d, rate in (WOB2 if kind else WOB)[(bar - first) % 4] if v > 0.6 else WOB[0]:
                wobble(t, low + 12 + wob_up, d, rate if v > 0.6 else 0.3333, 0.2 * v * wob_vol, 22.0 * max(v, 0.25))
                t += d
            if odd and v > 0.45:
                clap(b, 0.26 * v), x.snare(b, 0.22 * v)
                for i in range(6):
                    x.hat(b + 2.5 + i / 12, (0.03 + 0.006 * i) * v)
            elif not odd:
                put("drum", b, x.timp(root, 0.9, 0.34 * v))
            if kind and v > 0.45:  # the second drop's kit: a snare on every third beat, hats in 16ths
                x.snare(b + 2, 0.16 * v)
                for i in range(12):
                    x.hat(b + i * 0.25, 0.028 * v)
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

    def hush(first):
        """Four bars: everything falls away, the violin hums low and soft, a last few chimes, then nothing."""
        b = first * 3
        bow(b, "F#4:6 | F4:3 | E4:2 -:1", 0.075, pan=0.0)
        garden(first, harp=0.5, pizz=False), garden(first + 1, harp=0.25, pizz=False)
        chimes(b, b + 6, 4, 0.04)
        for i in range(3):
            put("pizz", b + i * 3, x.fmbass(chord(first + i)[1] + 12, 2.8, 0.2 - 0.05 * i, index=0.8, decay=0.6))

    def big_boom(b):
        boom(b, 0.9), boom(b + 0.02, 0.6)
        put("fx", b, x.noise(1.6, 16000, 0.3, 0.45))

    def trade(first, simultaneous=False, bars_=8, vol=1.0):
        """Eight bars of the duel: a bar each, left then right; or both at once, swapping lines every bar."""
        for i in range(bars_):
            one, two = (DUEL_1, DUEL_2) if i % 2 == 0 else (DUEL_2, DUEL_1)
            if simultaneous:
                bow((first + i) * 3, one[i // 2], 0.16 * vol, pan=-0.5, fast=True, bus="violin2")
                bow((first + i) * 3, two[i // 2], 0.14 * vol, pan=0.5, fast=True, bus="violin2")
            else:
                bow((first + i) * 3, one[i // 2], 0.17 * vol, pan=-0.5 if i % 2 == 0 else 0.5, fast=True, bus="violin2")

    def together(first, text, octaves=False, vol=1.0):
        for b, d, m in line(first * 3, text):
            fast = d < 1
            put("violin2", b, violin(m, d * (0.9 if fast else 0.98), 0.16 * vol, fast), -0.4)
            put("violin2", b, violin(m - 12 if octaves else below(m), d * (0.9 if fast else 0.98), 0.14 * vol, fast), 0.4)

    def way_back(first, pulls):
        """Six bars: the thump thins, the wobble slows to one long sweep a bar and fades; long pulls; the chimes,
        the water and the marimba come back."""
        b = first * 3
        storm(first, 6, fade=(0.8, 0.62, 0.45, 0.3, 0.18, 0.08))
        bow(b, pulls, 0.13)
        chimes(b + 6, b + 18, 12, 0.05)
        drips(b + 9, b + 18, 4)
        bird(b + 14, 0.04)
        garden(first + 4, harp=0.4, pizz=False), garden(first + 5, harp=0.8, pizz=False)

    # Bars 9-14: the soft violin: the waltz's first six bars over the marimba.
    bow(24, "|".join(WALTZ.split("|")[:6]))
    for bar in range(8, 14):
        garden(bar)
    chimes(24, 42, 8, 0.04)
    drips(24, 42, 3, 0.07)

    # Bars 15-18: the hush.
    hush(14)

    def octo(m, beats, vol=0.2, short=False):
        """The octobass: a huge bowed string, slow to speak, with a growl in it and a pure note an octave under."""
        k = x.k(beats)
        w = x.add(m, beats, [1 / h**0.85 for h in range(1, 19)], 1.0, detune=(-6, 5), vib=0.0 if short else 0.006,
                  attack=0.02 if short else 0.11, sustain=0.9, decay=0.3, release=0.03 if short else 0.15)
        w = np.tanh(1.6 * w) + 0.5 * x.add(m - 12, beats, [1], 1.0, attack=0.03, sustain=1.0, release=0.05)[:k]
        if not short and beats >= 2:
            u = np.linspace(0, 1, k)
            w = w * (0.7 + 0.3 * np.sin(np.pi * u**0.8))
        return w * vol

    def octobass(start, text, vol=0.2):
        for b, d, m in line(start, text):
            put("octo", b, octo(m, d * 0.98, vol))

    def octo_riff(bar, vol=0.2):
        """The octobass digging in: short notes on the root with a gap, then up the fifth to the octave."""
        root = chord(bar)[1]
        for o, up in ((0, 0), (0.5, 0), (1.5, 0), (2, 7), (2.5, 12)):
            put("octo", bar * 3 + o, octo(root + up, 0.42, vol, short=True))

    def gate(bar, pattern="x.xx.x.xx.xx", vol=0.05):
        """A trance gate: the chord on bright saw strings, chopped on and off in 16ths."""
        notes, _ = chord(bar)
        k = x.k(3)
        w = sum(x.add(m + 12, 3, x.SAW, 1.0, detune=(-11, 0, 12), attack=0.005, sustain=1.0, release=0.01) for m in notes)
        g = np.repeat(np.array([1.0 if c == "x" else 0.0 for c in pattern]), k // 12 + 1)[:k]
        edge = int(0.004 * x.sr)
        g = np.convolve(g, np.ones(edge) / edge, "same")
        put("trance", bar * 3, w * g * vol)

    def trance_arp(bar, vol=0.05):
        """A trance run: bright short saw notes in 16ths, the root jumping its octaves round the chord."""
        notes, root = chord(bar)
        for i in range(12):
            m = (root + 24, notes[1] + 12, root + 36, notes[2] + 12, root + 24, notes[2] + 12, root + 36, notes[1] + 24, root + 24, notes[0] + 24, root + 36, notes[2] + 24)[i]
            put("trance", bar * 3 + i * 0.25, x.add(m, 0.22, x.SAW, vol, detune=(-9, 9), attack=0.003, sustain=0.3, decay=0.05, release=0.01), 0.45 if i % 2 else -0.45)

    def stutter(b, m, count=8, step=0.125, vol=0.12, fall=0.0, pan=0.0):
        """A glitch: one tiny slice of a note fired again and again (and, with `fall`, sinking)."""
        for i in range(count):
            put("glitch", b + i * step, x.pulse(m - fall * i, step * 0.6, 0.25, vol * (1 - 0.5 * i / count), decay=0.02, sustain=0.6, release=0.003), pan if i % 2 else -pan)

    def zap(b, vol=0.1, pan=0.0):
        """A glitch: a thin pulse falling three octaves in an instant."""
        put("glitch", b, x.pulse(96, 0.35, 0.125, vol, bend=(0, -36), decay=0.05, sustain=0.5, release=0.01), pan)

    # Bars 19-44: the first drop (0:24.5, 35 seconds; Eric, fourth go: once it drops "it should just stay that way").
    # The giant boom, then the thump: kick on every beat, the 808, the wobble bass, driving strings and brass. The
    # violins duel a bar each; share a riff in octaves; play together; then duel at once under a brass tune.
    big_boom(54)
    storm(18, 26)
    trade(18)
    together(26, RIFF, octaves=True)
    parts = TOGETHER.split("|")
    together(34, "|".join(parts[i] for i in (0, 2, 4, 5, 6, 7)))
    for b, d, m in line(120, BRASS_TUNE):
        put("brass", b, x.brass(m, d * 0.95, 0.17, attack=0.05, release=0.15))
        put("brass", b, x.brass(m - 12, d * 0.95, 0.11, attack=0.05, release=0.15), 0.2)
    trade(40, simultaneous=True, bars_=4)
    boom(78, 0.5), boom(102, 0.5), boom(120, 0.5)

    # Bars 45-50: a small calm (1:00): the thump thins, the wobble slows and fades, long pulls, soft chimes.
    way_back(44, "A5:6 | F5:3 | D5:3 | E5:6")

    # Bar 51: near silence. The violin's last breath for a beat, then nothing.
    put("violin", 150, violin(n("E4"), 1.0, 0.05) * np.linspace(1, 0, x.k(1.0)))

    # Bars 52-88: the second drop (1:09.5, 50 seconds, to the end), crazier. An octobass takes the lead in slow pulls
    # with the violins dueling under it; the wobble moves up an octave out of its way; the kit adds a snare on every
    # third beat and hats in 16ths. Glitches and trance through it: a gated chord, runs, stutters, zaps.
    big_boom(153), boom(153.04, 0.7)
    storm(51, 36, kind=1, wob_up=12, wob_vol=0.6)

    # 52-59: the octobass's tune, both violins dueling at once under it.
    octobass(153, OCTO_1)
    trade(51, simultaneous=True, vol=0.7)
    zap(164.5, 0.08, 0.4), stutter(176, 86, 8, 0.125, 0.1, 1.0, 0.5)

    # 60-67: glitch and trance. The gated chord and the runs; the violins' riff in octaves with a stutter in each gap;
    # the octobass holding the roots.
    for bar in range(59, 67):
        gate(bar, ("x.xx.x.xx.xx", "xx.x.xx.x.x.", "x.x.xx.xx.x.", "xxx.x.x.xx.x")[bar % 4])
        trance_arp(bar, 0.04)
        put("octo", bar * 3, octo(chord(bar)[1], 2.95, 0.19))
    together(59, RIFF, octaves=True, vol=0.85)
    t, prev = 177.0, n("D6")
    for tok in RIFF.replace("|", " ").split():
        name, d = tok.split(":")
        if name == "-":
            stutter(t, prev, 4, 0.125, 0.09, 0.0, 0.5)
        else:
            prev = n(name)
        t += float(d)
    zap(188.5, 0.08, -0.4), zap(200.5, 0.09, 0.4)

    # 68-75: the octobass's second phrase, higher; the violins together over it; the runs carry on.
    boom(201, 0.5)
    octobass(201, OCTO_2)
    together(67, TOGETHER, vol=0.8)
    for bar in range(67, 75):
        trance_arp(bar, 0.035)
    stutter(224, 89, 8, 0.125, 0.1, 1.0, 0.5)

    # 76-83: everything. The octobass digs in on short notes; the violins duel a bar each; the gate and the runs;
    # a zap or a stutter at the end of every bar.
    boom(225, 0.55)
    trade(75)
    for bar in range(75, 83):
        octo_riff(bar)
        gate(bar, ("x.xx.x.xx.xx", "xx.x.xx.x.x.")[bar % 2], 0.04)
        trance_arp(bar, 0.035)
        zap(bar * 3 + 2.5, 0.07, 0.5 if bar % 2 else -0.5) if bar % 2 else stutter(bar * 3 + 2.5, 93, 4, 0.125, 0.08, 0.0, 0.5)

    # 84-88: the last push: the octobass in long roots, the violins together; then one hit, a stutter falling away,
    # and round to bar 1's chimes.
    boom(249, 0.55)
    for bar in range(83, 87):
        put("octo", bar * 3, octo(chord(bar)[1], 2.95, 0.2))
        trance_arp(bar, 0.04)
    together(83, "|".join(parts[i] for i in (0, 2, 4, 5)), vol=0.85)
    big_boom(261)
    notes, root = chord(87)
    put("octo", 261, octo(root, 2.6, 0.22))
    x.kick(261, 0.8, soft=True), sub(261, root, 2.6, 0.5), x.crash(261, 0.22, decay=0.5)
    for j, m in enumerate(notes):
        put("brass", 261, x.brass(m - 12, 1.2, 0.12), (-0.3, 0.0, 0.3)[j])
        put("violin2", 261, violin(m + 12, 1.0, 0.12, True), (-0.4, 0.0, 0.4)[j])
    stutter(262, 86, 14, 0.125, 0.1, 1.0, 0.6)

    x.echo("chimes", 1.0, 0.25, 0.1)
    x.echo("water", 0.75, 0.3, 0.12)
    x.echo("glitch", 0.75, 0.2, 0.08)
    write_wav(out, x.mixdown({"chimes": 4.5, "water": 7.0, "harp": 1.6, "strings": 1.6, "sub": 0.7, "drum": 1.6, "wobble": 1.3, "brass": 2.0, "pizz": 0.6, "flute": 1.4, "violin": 0.97, "violin2": 1.15, "octo": 1.6, "trance": 2.4, "glitch": 3.5}, lowpass=9000, room=0.3))


if __name__ == "__main__":
    main(sys.argv[1])
