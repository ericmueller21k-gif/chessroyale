"""Song R (Eric, Nov 12): Moo & Moon's theme, a two-minute loop. His direction: "use the same overdrive, maybe a
slight variation ... more whimsical but still like the whimsicalness comes from the background notes, like star
sparkling sort of thing. Kind of more like a darker night style and so really honestly like avoiding high pitched
notes ... just try to come up with something, and it'll get me started."
The first go (112 beats a minute, the lead low): "a little too slow ... too slow on the melody and maybe even too
deep/low"; "the moos and the noise that sounds like anime wawawa ... is nice". The second (136, an octave up, eight
bars for the wawawa): "turn down the moo volume"; of the wah, "I didn't want more of it. I was just saying I liked it";
the calm should be longer, "almost like stargazing feel, like wind chime a bit ... two of those calming periods ... 15
seconds each"; and the melody "just feels like the other ones a lot ... work up the timings a little bit. Some of the
chord progression and maybe even ... be adventurous a little".
So, this third go. 136 beats a minute, a kick on every beat: 272 beats = 68 bars = 120.0 s. B minor.
The tunes are in a different rhythm from the other themes': notes in threes across the beat (triplets), octave jumps
(the cow over the moon) that float back down, notes held across the bar line, phrases of three bars, and the lead
slides into its long notes (a moo's glide). The chords change every bar: the tune's bass steps down by half steps
(B, A#, A, G#, G) under one star that never moves (F#, in every chord), then E minor, a C chord from outside the key,
and F#. The second tune's chords drop by whole steps (B minor, A, G, F), each motif five 8ths long so it lands
somewhere new in the bar every time. The drop walks down by major thirds (B minor, G minor, E flat minor). The last
tune arrives a minor third up, in D minor, and the tag walks home.
Moo is a sweet cow who can't talk, the Moon his chatty friend: the lead is Moo, the overdriven lead (synth.py's `drive`)
a shade darker than Sawyer's; the Moon says a few words in the gaps on a talking synth (each note a "wah").
Behind them: the stars (a soft bell pattern in 16ths coming back to one note, each star at its own brightness, some
with a glint an octave up), a cowbell, an owl, Moo's moos (built as the game builds them). Two calms of eight bars,
stargazing: no drums; held strings on a chord with a raised fourth, wind chimes, the stars at half speed, a flute.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_r.py <out.wav>

  bars  1-4    night: wind, an owl, the stars coming out one by one, a cowbell, a moo, the Moon's first words
  bars  5-12   Moo's tune over the beat, the bass stepping down under it
  bars 13-20   the tune's second verse, the Moon saying a word in three of its gaps
  bars 21-28   the first calm (0:35, 14 s): stargazing; a flute, wind chimes; then a hum, a moo, a moonbeam
  bars 29-40   the Full Moon (0:49): a big moo, 808, wobble bass, more cowbell; the lead and a gritty synth trade two
               bars each, then play together
  bars 41-48   the second tune, the one that keeps shifting in the bar
  bars 49-56   the second calm (1:25, 14 s): the lead plays the jump slowly, the flute answers; chimes
  bars 57-64   Moo's tune a minor third up, a square in harmony for its last four bars
  bars 65-68   the tag: home by way of B flat and G; a moonbeam and a moo into bar 1
"""
import sys
from fractions import Fraction

import numpy as np

from synth import Mix, n, write_wav

BPM = 136.0
BEATS = 272
SECS = BEATS * 60 / BPM

# A chord a bar. "+3" after a name: that chord a minor third up (the last tune).
CHORDS = (
    "Bm Bm Bm Bm  Bm Bm/A# Bm/A G#o G Em C F#  Bm Bm/A# Bm/A G#o G Em C F#  Gl Gl Em Em Gl Gl F#sus F#  "
    "Bm Bm Gm Gm Ebm Ebm F# F#  Bm Gm Ebm F#  Bm11 A G6 F E E F#7 F#7  Bbl Bbl Gm9 Gm9 Bbl Bbl Asus A7  "
    "Bm+3 Bm/A#+3 Bm/A+3 G#o+3 G+3 Em+3 C+3 F#+3  Bm+3 Bbl G F#"
).split()
assert len(CHORDS) == 68
# Each chord: the bass note; the strings' three notes; the stars' five (low, middle, the one they keep coming back
# to, a color, high). Through the tune the one they come back to is always F#5.
SKY = {
    "Bm": ("B1", "B2 F#3 D4", "B4 D5 F#5 A5 B5"),
    "Bm/A#": ("A#1", "B2 F#3 D4", "A#4 D5 F#5 C#5 A#5"),
    "Bm/A": ("A1", "A2 F#3 D4", "A4 D5 F#5 B4 A5"),
    "G#o": ("G#1", "G#2 D3 B3", "G#4 B4 F#5 D5 B5"),
    "G": ("G1", "G2 D3 B3", "B4 D5 F#5 A5 B5"),
    "Em": ("E2", "E2 B2 G3", "B4 E5 F#5 G5 B5"),
    "C": ("C2", "C3 G3 E4", "C5 E5 F#5 G5 B5"),
    "F#": ("F#1", "F#2 C#3 A#3", "A#4 C#5 F#5 E5 A#5"),
    "Gl": ("G1", "G2 D3 B3", "B4 D5 F#5 C#5 A5"),  # G with its raised fourth, C#: the stargazing chord
    "F#sus": ("F#1", "F#2 C#3 B3", "B4 C#5 F#5 E5 B5"),
    "Gm": ("G1", "G2 D3 Bb3", "Bb4 D5 G5 A5 Bb5"),
    "Ebm": ("Eb2", "Eb2 Bb2 Gb3", "Bb4 Eb5 Gb5 F5 Bb5"),
    "Bm11": ("B1", "B2 F#3 D4", "B4 D5 E5 F#5 B5"),  # the second tune's chords: the stars come back to E5
    "A": ("A1", "A2 E3 C#4", "A4 C#5 E5 F#5 A5"),
    "G6": ("G1", "G2 D3 B3", "B4 D5 E5 G5 B5"),
    "F": ("F1", "F2 C3 A3", "A4 C5 E5 G5 A5"),
    "E": ("E2", "E2 B2 G#3", "G#4 B4 E5 F#5 G#5"),
    "F#7": ("F#1", "F#2 C#3 A#3", "A#4 C#5 E5 F#5 A#5"),
    "Bbl": ("Bb1", "Bb2 F3 D4", "A4 D5 F5 E5 A5"),  # B flat with its raised fourth, E
    "Gm9": ("G1", "G2 D3 Bb3", "Bb4 D5 F5 A5 Bb5"),
    "Asus": ("A1", "A2 E3 D4", "A4 D5 E5 G5 A5"),
    "A7": ("A1", "A2 E3 C#4", "A4 C#5 E5 G5 A5"),
}
STAR = (0, 2, 4, 2, 1, 2, 3, 2, 0, 2, 4, 2, 3, 2, 1, 2)  # the stars' bar: which of the five, 16th by 16th
MINOR = (11, 1, 2, 4, 6, 7, 9)  # B minor, for the square's harmony

# ---- Moo's lines (the overdriven lead). Lengths are in beats; 2/3 is a note of three-across-two, 1/3 three-in-one. ----
# The tune, three bars and three and two: an octave jump, three notes floating down, a held note that doesn't belong
# (A#); a note held over the bar line; another jump; up the C chord in threes; down the F#.
TUNE = (
    "F#4:1 F#5:2/3 E5:2/3 D5:2/3 B4:1 | A#4:1.5 C#5:.5 D5:2/3 C#5:2/3 A#4:2/3 | A4:1 D5:1 F#5:1.5 E5:2 | "
    "D5:.5 B4:1/3 D5:1/3 F#5:1/3 G#5:1 | F#5:2 E5:2/3 D5:2/3 B4:2/3 | E4:.5 E5:1.5 D5:.5 B4:.5 G4:1 | "
    "C5:2/3 E5:2/3 G5:2/3 F#5:1 E5:1 | C#5:1.5 A#4:.5 F#4:1 -:1"
)
VERSE = (
    "B4:1/3 D5:1/3 F#5:1/3 B5:1 A5:.5 F#5:.5 D5:1 | C#5:2/3 D5:2/3 F#5:2/3 A#4:1 -:1 | A4:.5 B4:.5 D5:1 E5:2/3 D5:2/3 B4:2/3 | "
    "G#4:1.5 B4:.5 D5:1 -:1 | G4:.5 G5:1.5 F#5:2/3 D5:2/3 B4:2/3 | E5:1 G5:1 F#5:1.5 E5:2 | "
    "G5:.5 F#5:1/3 E5:1/3 C5:1/3 E5:1 | F#5:1 E5:.5 C#5:.5 A#4:1 -:1"
)
# The second tune: a motif five 8ths long, so each time it starts somewhere else in the bar; then a jump, and home.
SHIFT = (
    "B4:.5 E5:.5 D5:.5 F#5:1 A4:.5 E5:.5 C#5:.5 E5:1 A4:.5 C#5:.5 E5:.5 A5:1 -:.5 | "
    "B4:.5 E5:.5 D5:.5 G5:1 A4:.5 E5:.5 C5:.5 E5:1 A4:.5 C5:.5 F5:.5 A5:1 -:.5 | "
    "G#4:1 G#5:2 F#5:1 | B4:2/3 E5:2/3 F#5:2/3 G#5:2 | C#5:.5 E5:.5 F#5:1 E5:.5 C#5:.5 A#4:1 | F#4:1 A#4:1/3 C#5:1/3 E5:1/3 F#5:1 -:1"
)
# The Full Moon: the lead's bars and the gritty synth's, two each in turn; then four together.
DUEL_LEAD = (
    "B4:.5 B5:1.5 A5:2/3 F#5:2/3 D5:2/3 | E5:1/3 F#5:1/3 E5:1/3 D5:1 B4:1 -:1 | -:4 | -:4 | "
    "Bb4:.5 Bb5:1.5 Ab5:2/3 Gb5:2/3 Eb5:2/3 | F5:1/3 Gb5:1/3 Ab5:1/3 Bb5:1.5 Gb5:.5 -:1 | -:4 | -:4 | "
    "F#5:2 D5:2/3 E5:2/3 F#5:2/3 | G5:2 D5:2/3 Bb4:2/3 D5:2/3 | Gb5:2 Eb5:2/3 F5:2/3 Gb5:2/3 | A#5:1.5 F#5:.5 C#5:1 F#5:1"
)
DUEL_GRIT = (
    "-:4 | -:4 | D4:.5 D4:.5 Bb3:.5 G3:1 -:.5 A3:.5 Bb3:.5 | C4:.5 D4:.5 Eb4:.5 D4:.5 G4:1 -:1 | "
    "-:4 | -:4 | A#3:.5 C#4:.5 E4:.5 -:.5 E4:.25 F#4:.25 E4:.5 C#4:1 | F#4:1 E4:.5 C#4:.5 A#3:.5 C#4:.5 F#4:1 | "
    "D4:2 B3:1 D4:1 | Bb3:2 G3:1 Bb3:1 | Eb4:2 Bb3:1 Eb4:1 | F#4:1.5 C#4:.5 A#3:1 C#4:1"
)
# The calms: the flute's slow tune; then the lead playing the jump slowly and the flute answering.
CALM_1 = "D5:3 F#5:1 | E5:2 C#5:2 | B4:3 D5:1 | E5:4 | D5:2 G5:2 | F#5:3 E5:1 | C#5:4 | A#4:3 -:1"
CALM_2_LEAD = "A4:2 A5:2 | G5:4/3 F5:4/3 D5:4/3 | D5:3 F5:1 | E5:4 | -:4 | -:4 | -:4 | -:4"
CALM_2_FLUTE = "-:4 | -:4 | -:4 | -:4 | D5:2 F5:2 | E5:3 C5:1 | D5:4 | C#5:3 -:1"
TAG = "A4:1 A5:2/3 G5:2/3 F5:2/3 D5:1 | Bb4:1 D5:1 F5:1 A5:1 | G5:1.5 D5:.5 B4:1 D5:1 | F#5:1.5 C#5:.5 A#4:1 -:1"
# ---- the Moon's (the talking synth): a word in three of the verse's gaps ----
MOON = (
    "-:4 | -:3 B4:.25 D5:.25 C#5:.25 B4:.25 | -:4 | -:3 D5:.25 E5:.25 D5:.25 B4:.25 | "
    "-:4 | -:4 | -:4 | -:3 A#4:.25 C#5:.25 E5:.25 C#5:.25"
)


def notes(start, text):
    """'F#5:2/3 -:1 | D5:.5' -> [(beat, beats, midi)] from `start`; '-' rests; '|' is for the eye (a note may cross it)."""
    out, t = [], Fraction(start)
    for tok in text.replace("|", " ").split():
        name, d = tok.split(":")
        if name != "-":
            out.append((float(t), float(Fraction(d)), n(name)))
        t += Fraction(d)
    return out


def beats(text):
    return sum(Fraction(tok.split(":")[1]) for tok in text.replace("|", " ").split())


for _name, _beats in ((TUNE, 32), (VERSE, 32), (SHIFT, 32), (DUEL_LEAD, 48), (DUEL_GRIT, 48), (CALM_1, 32), (CALM_2_LEAD, 32),
                      (CALM_2_FLUTE, 32), (TAG, 16), (MOON, 32)):
    assert beats(_name) == _beats, (_name[:30], beats(_name))


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=157)
    put = x.put
    rng = np.random.default_rng(23)
    sr = x.sr
    tau = 2 * np.pi

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def chord(bar):
        name, _, shift = CHORDS[bar].partition("+")
        root, pad, sky = SKY[name]
        up = int(shift or 0)
        return n(root) + up, [n(c) + up for c in pad.split()], [n(c) + up for c in sky.split()]

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the strings and the stars duck

    def snare(b, vol=0.26):
        """A gated snare: a dark crack with a big tail cut short."""
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def hat(b, vol=0.035):
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 11000, 0.8) * np.exp(-t / 0.014) * tail(k, 0.004) * vol, 0.3)

    def tom(b, m, vol=0.32, pan=0.0):
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.15) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def toms(b, pitches=(50, 50, 45, 40)):
        """A run of toms into the next bar, a 16th each."""
        for i, m in enumerate(pitches):
            tom(b + i * 0.25, m, 0.24 + 0.03 * i, {50: 0.3, 45: 0.0, 40: -0.3}[m])

    def clap(b, vol=0.2):
        for o in (0, 0.011, 0.023):
            put("snare", b + o / x.beat_s, hiss(int(0.02 * sr), 8000, 0.4) * np.exp(-np.arange(int(0.02 * sr)) / sr / 0.006) * vol * 0.7)
        kk = int(0.2 * sr)
        put("snare", b + 0.03 / x.beat_s, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol)

    def cowbell(b, vol=0.09, pan=-0.25):
        """A cowbell: two square tones that don't agree, a clank and a short ring."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.convolve(np.sign(np.sin(tau * 545 * t)) + np.sign(np.sin(tau * 815 * t)), np.ones(10) / 10, "same")
        put("bell", b, w * (0.7 * np.exp(-t / 0.02) + 0.3 * np.exp(-t / 0.11)) * np.minimum(1, t / 0.0008) * tail(k) * vol, pan)

    # ---- the low end ----
    def bass(b, m, length, vol=0.4, slide=0.0):
        """A deep note driven so small speakers hear it, with a round pluck an octave up."""
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (slide * np.exp(-t / 0.05) / 12)) / sr
        env = np.minimum(1, t / 0.006) * np.exp(-t / (length * x.beat_s * 2.0)) * tail(k, 0.02)
        w = np.tanh(2.2 * np.sin(ph)) / np.tanh(2.2) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        mid = 0.45 * np.sin(2 * ph + 1.6 * np.exp(-t / 0.09) * np.sin(2 * ph)) * np.exp(-t / 0.3)
        put("bass", b, (w + mid) * env * vol)

    def sub(b, m, length, vol=0.5):
        """The 808."""
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def wobble(b, m, length, rate, vol=0.2, top=18.0):
        """The wobble bass: a sawtooth whose brightness sweeps open and shut `rate` times a beat, driven hard."""
        k = x.k(length)
        t = np.arange(k) / sr
        cut = 1.5 + (0.5 - 0.5 * np.cos(tau * rate * t / x.beat_s)) * top
        w = np.zeros(k)
        for c in (-9, 9):
            ph = tau * x.hz(m + c / 100) * t
            for h in range(1, 22):
                w += np.sin(h * ph) / h * np.clip(cut - h + 1, 0, 1)
        put("wobble", b, np.tanh(1.8 * w) * np.minimum(1, t / 0.005) * tail(k) * vol)

    def boom(b, vol=0.5):
        k = int(0.7 * sr)
        t = np.arange(k) / sr
        put("fx", b, np.tanh(2 * np.sin(tau * np.cumsum(36 + 80 * np.exp(-t / 0.05)) / sr)) * np.exp(-t / 0.2) * tail(k, 0.02) * vol)
        kk = int(0.9 * sr)
        put("fx", b, hiss(kk, 7000, 0.2) * np.exp(-np.arange(kk) / sr / 0.2) * vol * 0.3)

    def hum(b, length, vol=0.1, m0=35, m1=59):
        """The Moon gathering a beam: a soft tone climbing two octaves, swelling."""
        k = x.k(length)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(x.hz(m0 + (m1 - m0) * u**1.5)) / sr
        put("fx", b, (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * u**2 * np.minimum(1, (1 - u) * 60) * vol)

    def strings(bar, vol=0.045, length=4.0, slow=False):
        _, pad, _ = chord(bar)
        for j, m in enumerate(pad):
            put("pad", bar * 4, x.strings(m, length, vol, attack=0.4 if slow else 0.12, release=0.5 if slow else 0.2), (-0.45, 0.0, 0.45)[j])

    # ---- the sky ----
    def star(b, m, vol=0.07, pan=0.0):
        put("stars", b, x.bell(m, 1.2, vol, ratio=4.0, index=1.0, decay=0.28), pan)

    def stars(bar, vol=1.0, keep=1, glints=0.2, lower=False):
        """A bar of stars: the 16th pattern, each one at its own brightness, some with a glint an octave up.
        `keep`: only every such-th one; `lower`: a second, softer set an octave down, a 16th behind."""
        sky = chord(bar)[2]
        for i in range(16):
            if i % keep:
                continue
            t = bar * 4 + i * 0.25
            v = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 4 == 0 else 1.0)
            pan = 0.5 * np.sin(i * 1.7 + bar)
            star(t, sky[STAR[i]], 0.07 * v, pan)
            if rng.uniform() < glints:
                star(t + 0.125, sky[STAR[i]] + 12, 0.026 * v, -pan)
            if lower:
                star(t + 0.25, sky[STAR[(i + 5) % 16]] - 12, 0.035 * v, -pan)

    def chimes(first, bars_, per_bar=3, vol=0.05):
        """Wind chimes: a few soft strikes a bar on the chord's notes, each near an 8th but not on it, ringing long."""
        for bar in range(first, first + bars_):
            sky = chord(bar)[2]
            for at in rng.choice(8, per_bar, replace=False):
                put("chimes", bar * 4 + at * 0.5 + rng.uniform(-0.07, 0.07),
                    x.bell(sky[rng.integers(0, 5)] + 12 * rng.integers(0, 2), 3.0, vol * rng.uniform(0.5, 1.0), ratio=3.5, index=0.9, decay=0.8),
                    rng.uniform(-0.7, 0.7))

    def beam(b, length=2.0, vol=0.07):
        """A moonbeam (or a shooting star) coming down: the stars' bell running from B5 down two octaves."""
        run = [n(c) for c in "B5 A5 F#5 E5 D5 B4 A4 F#4 E4 D4 B3".split()]
        for i, m in enumerate(run):
            star(b + length * i / len(run), m, vol * (1.2 - 0.5 * i / len(run)), 0.6 * np.cos(i))

    def hoot(b, secs=0.32, vol=0.09, pan=-0.4):
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(370 * (1 - 0.06 * u)) / sr
        env = np.sin(np.pi * u) ** 0.6
        put("night", b, (np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.03 * hiss(k, 3000)) * env * vol, pan)

    def owl(b, vol=0.09):
        hoot(b, 0.34, vol), hoot(b + 1.5, 0.2, vol * 0.85), hoot(b + 2.0, 0.42, vol)

    def moo(b, secs, pitch, f1, f2, vol=0.2, rough=0.0, breath=0.2, open_=0.15, vib=(5.0, 0.015), pan=0.0):
        """Moo's moo, as the game makes it (packages/app/src/characters/moo-sounds.ts): a sawtooth whose pitch rises
        to a peak and falls, through two resonances gliding from "mm" to "oo", a slow vibrato, a breath of noise."""
        k = int(secs * sr)
        t = np.arange(k) / sr
        u = t / secs
        f = np.where(u < 0.35, pitch[0] + (pitch[1] - pitch[0]) * u / 0.35, pitch[1] + (pitch[2] - pitch[1]) * (u - 0.35) / 0.65)
        f = f * (1 + vib[1] * np.sin(tau * vib[0] * t))
        ph = tau * np.cumsum(f) / sr
        o = np.clip(t / open_, 0, 1)
        fa, fb = f1[0] + (f1[1] - f1[0]) * o, f2[0] + (f2[1] - f2[0]) * o
        w = np.zeros(k)
        for h in range(1, 31):
            if h * max(pitch) > 2800:
                break
            fh = h * f
            gain = 2.2 / np.sqrt(1 + 36 * (fh / fa - fa / fh) ** 2) + 1.2 / np.sqrt(1 + 49 * (fh / fb - fb / fh) ** 2) + 0.15
            w += np.sin(h * ph) / h / np.sqrt(1 + (fh / 2600) ** 2) * gain
        env = np.minimum(1, t / 0.05) * np.minimum(1, (secs - t) / 0.18)
        grr = 1 - rough * (0.5 + 0.5 * np.sin(tau * 28 * t))
        put("night", b, (w * grr + breath * 0.4 * hiss(k, 3000, 0.3)) * env * vol, pan)

    # The moos, a third quieter than the second go's (Eric: "turn down the moo volume a little bit").
    def soft_moo(b, vol=0.2):  # D3 up to E3 and down to B2
        moo(b, 0.9, (147, 165, 123.5), (330, 470), (700, 900), vol, breath=0.25, open_=0.2)

    def big_moo(b, vol=0.24):  # F#2 up to B2 and down
        moo(b, 1.5, (92.5, 123.5, 82.4), (420, 640), (780, 1000), vol, rough=0.3, breath=0.2, open_=0.3, vib=(4.5, 0.02))

    # ---- the voices ----
    def cow(start, text, vol=1.0, pan=-0.1, up=0):
        """Moo: the overdriven lead, a shade darker than Sawyer's. A long note that follows another straight on
        slides in from most of the way back to it, as a moo glides."""
        last = None
        for b, d, m in notes(start, text):
            m += up
            glide = 0.6 * (last[1] - m) if last and abs(last[0] - b) < 1e-6 and d >= 1 and 0 < abs(last[1] - m) <= 12 else 0.0
            put("lead", b, x.drive(m, d * 0.96, 0.16 * vol, knee=1400.0, glide=glide), pan)
            last = (b + d, m)

    def talk(start, text, vol=0.12, pan=0.35, up=0):
        """The Moon: a talking synth, each note's mouth opening and closing (a "wah"), with a little quaver."""
        for b, d, m in notes(start, text):
            m += up
            k = x.k(d * 0.92)
            t = np.arange(k) / sr
            u = np.linspace(0, 1, k)
            ph = tau * np.cumsum(x.hz(m) * (1 + 0.012 * np.sin(tau * 9 * t))) / sr
            mouth = 480 * 2 ** (1.6 * np.sin(np.pi * u))
            w = np.zeros(k)
            for h in range(1, 15):
                w += np.sin(h * ph) / h**0.5 * (np.exp(-((np.log2(h * x.hz(m) / mouth)) / 0.5) ** 2) + 0.1)
            put("moon", b, w * np.minimum(1, t / 0.008) * tail(k, 0.02) * vol, pan)

    def grit(start, text, vol=1.0, pan=0.3):
        for b, d, m in notes(start, text):
            put("grit", b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def flute(start, text, vol=0.2, pan=0.2):
        for b, d, m in notes(start, text):
            put("flute", b, x.flute(m, d * 0.97, vol), pan)

    def third(m):
        pc = m % 12
        if pc not in MINOR:
            return m + 3
        return m + (MINOR[(MINOR.index(pc) + 2) % 7] - pc) % 12

    def stutter(b, m, count=4, vol=0.6):
        """A glitch: the lead's note fired again and again, a 32nd apart, fading."""
        for i in range(count):
            put("lead", b + i * 0.125, x.drive(m, 0.1, 0.16 * vol * (1 - 0.6 * i / count), attack=0.004, knee=1400.0), 0.4 if i % 2 else -0.4)

    # ---- the band, bar by bar ----
    def drive_beat(bar, bell=True, fill=False, jump=False):
        """A kick on every beat, the gated snare on 2 and 4, soft hats between, the bass rolling in 8ths (jumping
        octaves when `jump`), the cowbell."""
        b, (root, _, _) = bar * 4, chord(bar)
        for i in range(4):
            kick(b + i, 0.5)
            hat(b + i + 0.5, 0.04), hat(b + i + 0.75, 0.02)
        snare(b + 1), snare(b + 3)
        for i in range(8):
            bass(b + i * 0.5, root + (12 if (i % 2 if jump else i == 7) else 0), 0.46, 0.4)
        if bell:
            for o in (0.5, 1.5, 2.75) if bar % 2 == 0 else (0.5, 1.5, 2.5, 3):
                cowbell(b + o, 0.085)
        if fill:
            toms(b + 3)

    WOB = [((2, 1), (1, 2), (1, 4)), ((1, 2), (1, 3), (2, 0.5)), ((1.5, 2), (1.5, 4), (1, 6)), ((1, 1), (1, 4), (2, 2))]

    def full_moon(bar, k):
        """A drop bar: the 808 and a kick that pushes, a clap and the snare on 2 and 4, the wobble bass at changing
        speeds, 16th hats, the cowbell on every off-beat."""
        b, (root, _, _) = bar * 4, chord(bar)
        low = root if root >= 33 else root + 12
        for o, v in ((0, 0.6), (0.75, 0.4), (2, 0.55), (2.5, 0.45)):
            kick(b + o, v)
        clap(b + 1), snare(b + 1, 0.2), clap(b + 3), snare(b + 3, 0.2)
        sub(b, low, 1.8, 0.45), sub(b + 2.5, low, 1.3, 0.38)
        t = b
        for d, rate in WOB[k % 4]:
            wobble(t, low + 12, d, rate, 0.17)
            t += d
        for i in range(16):
            hat(b + i * 0.25, 0.03 if i % 4 == 2 else 0.018)
        for i in range(4):
            cowbell(b + i + 0.5, 0.1)

    def stargaze(first, build):
        """A calm, eight bars: no drums; slow strings, long bass notes, the stars at half speed, wind chimes for six
        bars (so none is left ringing into what comes next), an owl, a shooting star. `build`: its last two bars
        gather a hum and a heartbeat."""
        for i in range(8):
            bar = first + i
            strings(bar, 0.07, slow=True)
            bass(bar * 4, chord(bar)[0] + 12, 3.9, 0.22)
            stars(bar, vol=0.7 if i < 6 else 0.5, keep=2 if i < 6 else 4, glints=0.12)
        chimes(first, 6)
        owl(first * 4 + 5.0, 0.07)
        beam(first * 4 + 16, 2.5, 0.05)
        if build:
            for b in (24, 24.5, 26, 26.5, 28, 28.5, 30, 30.5):
                kick(first * 4 + b, 0.3 if b == int(b) else 0.22)
            hum(first * 4 + 24, 7.5)

    # Bars 1-4: night. Wind, the owl, the stars coming out one by one, the strings rising, a cowbell far off, a moo,
    # and the Moon's first words; toms into the tune.
    put("night", 0, x.rumble(16, 0.1, hold=60), -0.2)
    owl(1.0)
    for bar, keep in ((0, 8), (1, 4), (2, 2), (3, 1)):
        stars(bar, vol=0.55 + 0.15 * bar, keep=keep, glints=0.1)
    for j, m in enumerate(chord(0)[1]):
        put("pad", 4, x.swell(x.strings(m, 12, 0.05, attack=0.5, release=0.6), 0.85), (-0.45, 0.0, 0.45)[j])
    bass(8, n("B1"), 7.8, 0.22)
    cowbell(8, 0.06), cowbell(10, 0.06)
    for b in (12, 13, 14, 15, 15.5):
        cowbell(b, 0.075)
    soft_moo(9)
    talk(13.5, "B4:.25 D5:.25 C#5:.25 D5:.25 B4:.5")
    toms(15, (50, 45, 40, 40))

    # Bars 5-12: Moo's tune, the bass stepping down a half step a bar under it.
    x.crash(16, 0.14, decay=0.5)
    cow(16, TUNE)
    for bar in range(4, 12):
        drive_beat(bar, fill=bar == 11)
        strings(bar)
        stars(bar)

    # Bars 13-20: the second verse; the Moon says a word in three of its gaps.
    cow(48, VERSE)
    talk(48, MOON)
    for bar in range(12, 20):
        drive_beat(bar, fill=bar in (15, 19))
        strings(bar)
        stars(bar, glints=0.32)

    # Bars 21-28: the first calm. The flute's slow tune over the stargazing chord; then the hum, a moo and a moonbeam.
    stargaze(20, build=True)
    flute(80, CALM_1)
    talk(94.5, "E5:.25 D5:.25 B4:.5", 0.1)
    soft_moo(107.5)
    beam(110, 2.0)

    # Bars 29-40: the Full Moon. The lead and the gritty synth trade two bars each, a stutter at the end of each
    # turn; then four bars together.
    boom(112, 0.8), x.crash(112, 0.2, decay=0.6)
    big_moo(112)
    cow(112, DUEL_LEAD)
    grit(112, DUEL_GRIT)
    for i, bar in enumerate(range(28, 40)):
        full_moon(bar, i)
        stars(bar, vol=1.05, glints=0.35, lower=True)
        if i >= 8:
            strings(bar, 0.05)
            x.crash(bar * 4, 0.12, decay=0.4)
    for b, m in ((119, "B4"), (127, "G4"), (135, "Gb5"), (143, "F#4")):
        stutter(b, n(m), 8 if b in (127, 143) else 4)
    toms(142, (50, 50, 45, 45, 40, 40, 40, 40))
    for i in range(8):
        snare(158 + i * 0.25, 0.08 + 0.02 * i)

    # Bars 41-48: the second tune, shifting in the bar; the chords dropping by whole steps, the bass jumping octaves.
    x.crash(160, 0.16, decay=0.5)
    cow(160, SHIFT)
    for bar in range(40, 48):
        drive_beat(bar, bell=bar >= 44, fill=bar in (43, 47), jump=True)
        strings(bar, 0.055)
        stars(bar, glints=0.3)

    # Bars 49-56: the second calm. The lead plays the jump slowly; the flute answers; toms back into the tune.
    stargaze(48, build=False)
    cow(192, CALM_2_LEAD, vol=0.7)
    flute(192, CALM_2_FLUTE)
    talk(206.5, "F5:.25 E5:.25 D5:.5", 0.1)
    soft_moo(217.5, 0.17)
    hum(216, 7.5, 0.06)
    toms(223, (50, 45, 45, 40))

    # Bars 57-64: Moo's tune a minor third up; the Moon's word after its second bar and its fourth; a square in harmony
    # under the last four bars.
    x.crash(224, 0.16, decay=0.5)
    cow(224, TUNE, up=3)
    talk(224, "|".join(MOON.split("|")[:4]), up=3)
    for b, d, m in notes(240, "|".join(TUNE.split("|")[4:])):
        put("square", b, x.chip(third(m) - 12 + 3, d * 0.9, 0.07), 0.3)
    for bar in range(56, 64):
        drive_beat(bar, fill=bar in (59, 63))
        strings(bar)
        stars(bar, vol=1.05, glints=0.3)

    # Bars 65-68: the tag. The jump once more, home by way of B flat and G; one last hit, a moonbeam and a moo into bar 1.
    x.crash(256, 0.16, decay=0.5)
    cow(256, TAG)
    for bar in range(64, 67):
        drive_beat(bar, fill=bar == 66)
        strings(bar)
        stars(bar, vol=1.05, glints=0.3)
    kick(268, 0.55), snare(268, 0.24), cowbell(268, 0.1), bass(268, n("F#1"), 3.5, 0.4)
    strings(67, 0.05)
    stars(67, vol=0.8, keep=2, glints=0.15)
    beam(269, 2.5, 0.06)
    soft_moo(269.8, 0.18)

    # The bass, the strings and (lightly) the stars duck under each kick: the night-drive pump.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["pad"] *= 0.45 + 0.55 * gain
    x.buses["stars"] *= 0.75 + 0.25 * gain

    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("stars", 0.75, 0.2, 0.08)
    x.echo("chimes", 1.0, 0.25, 0.1)
    x.echo("flute", 0.75, 0.18, 0.07)
    x.echo("moon", 0.5, 0.15, 0.05)
    x.echo("night", 1.5, 0.2, 0.08)
    levels = {"lead": 1.15, "bass": 0.5, "sub": 0.5, "wobble": 0.8, "kick": 0.9, "snare": 2.0, "hats": 4.0, "toms": 1.5, "drum": 1.5, "stars": 1.8,
              "pad": 1.7, "bell": 2.0, "moon": 1.6, "grit": 1.1, "square": 1.2, "fx": 1.2, "flute": 0.6, "chimes": 2.0}
    write_wav(out, x.mixdown(levels, lowpass=7000, room=0.25))


if __name__ == "__main__":
    main(sys.argv[1])
