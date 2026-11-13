"""Song AB (Eric, Nov 13): Wrangler the cowboy pig's theme, the second one, a loop of two and a half minutes. Song AA
was his first: "The Wrangler one is good, and ... it was my fault for sending you a song that I realized didn't
really fit him ... let's shelve the other one." This one starts over from another write-up of a style (made from
another game's track), with his asks: "you can add a little bit of his grunting, his pig sound at some point ... see
if you can incorporate some common like Western cowboyness into the song."
What is used from the write-up is the style's own means, none of them one song's: a poised march at about 108 with
the band's 16ths swung and one high line of straight, even 16ths spinning over it; an opening of two far-apart
registers (that high line, and huge low horn blasts, nothing between); a low, growling horn and a warm lead one; a
noble major tune that borrows chords from the minor; a tense middle over one bass note with a wailing lead that
slides; a soaring last part with long notes tied over the bar lines, quick arpeggios and a busy bass.
What is not used: the write-up's chord progressions (its climbing fanfare and its major-to-minor fourth chord, its
alarm's two chords, its circle of fifths), its high figure, its horn pickups, its lead's lines, or any tune of it
(the write-up's own "original" version is that track's plan moved to another key). The track itself was not listened
to, measured or transcribed, and every melody, riff and chord progression here is original: none of it is any song's
or any game's.

The West: a trumpet has the tune (a lone one, as a border town's), a cowboy's whistle wails over the standoff and
doubles the last tune, a twangy guitar (short notes, a long echo) has the outlaw's tune, a fiddle answers and rides;
hooves clip-clop the 8ths at a trot and gallop in the ride; a march snare, a whip's crack, spurs, a rattle, wind.
The ideas from his world that run the song. His rope: he keeps one loop spinning overhead, and the high line of even
16ths is that loop: a figure seven 16ths long, so it comes round somewhere new in every bar, coming back each time
to one note that never moves (D; where a chord would rub against it, the next note up), a swish of the rope with
each turn. His grunt is the low horn's: a tuba and a trombone blast with his grunt in it. The standoff is the
calm (the tune's key turned minor, one bass note, his spurs). Then the rope spins faster, he throws, and the drop is
the ride: a gallop, the trumpet and the fiddle trading two bars each on chords a major third apart, then together.
The tune's bass walks down an octave a step a bar under the D; the last tune is a minor third up.
His sounds, built as the game builds them (packages/app/src/characters/pig-sounds.ts): the rope whirling, the
throw, the loop's slap, his spurs (a dull clink), a stomp, his grunt, snort and laugh. Nothing bright, as there.
  python3 song_ab.py <out.wav>

  bars  1-4    0:00  the rope spinning high, alone; the low horn and his grunt under it
  bars  5-12   0:09  the strut: hooves, the march, and the trumpet's tune
  bars 13-20   0:26  the tune again; the whistle joins it, the fiddle answers
  bars 21-28   0:44  the outlaw's tune on the twangy guitar, the chords stepping down and back
  bars 29-36   1:01  the standoff (the calm): the whistle wailing, strings trembling, his spurs, a rattle
  bars 37-40   1:21  the rope spins faster; he throws
  bars 41-56   1:29  the ride (the drop): a gallop; the trumpet and the fiddle trade, then play together
  bars 57-60   2:00  the dust: the rope and the low horn again, his laugh
  bars 61-68   2:08  the tune a minor third up, the whistle over it
  bars 69-70   2:25  the turn home
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BARS = 70
BEATS = 4 * BARS
TAPE = 150.0
SWING = 0.14  # an off 16th of the band is this much of a 16th late (the rope's line is not)
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [
    (bar0(1), bar0(29), 110, 110, 1.0, 1.0, 0.0),
    (bar0(29), bar0(30), 110, 100, 1.0, 1.0, 0.0),
    (bar0(30), bar0(37), 100, 100, 1.0, 1.0, 0.0),  # the standoff
    (bar0(37), bar0(41), 100, 124, 1.0, 1.0, 0.0),  # the rope spinning faster
    (bar0(41), bar0(57), 124, 124, 1.0, 1.0, 0.0),  # the ride
    (bar0(57), bar0(69), 116, 116, 1.0, 1.0, 0.0),
    (bar0(69), BEATS, 116, 110, 1.0, 1.0, 0.0),
]

TUNE_CH = "D Cadd9 Bm7 Bbmaj7 D/A G D/F# A7sus4"  # the tune's chords: the bass walks down under the D
TUNE_BASS = "D3 C3 B2 Bb2 A2 G2 F#2 A2"
CHORDS = (
    f"D D D D  {TUNE_CH}  {TUNE_CH}  D D C C Bb Bb C A7  Dm Dm Gm6/D Gm6/D Dm Dm A7sus4 A7  A7 A7 A7 A7  "
    "D D D D Bb Bb Bb Bb F# F# F# F# D Bb F# A7  A7 A7 C7 C7  F Ebadd9 Dm7 Dbmaj7 F/C Bb F/A C7sus4  Bb A7"
).split()
assert len(CHORDS) == BARS, len(CHORDS)
KINDS = {"": (0, 4, 7), "7": (0, 4, 7, 10), "m": (0, 3, 7), "m6": (0, 3, 7, 9), "m7": (0, 3, 7, 10), "maj7": (0, 4, 7, 11), "add9": (0, 4, 7, 14),
         "7sus4": (0, 5, 7, 10)}
STILL = n("D5")  # the note the rope's line keeps coming back to
LOOP = (2, 0, 1, 2, 3, 2, 1)  # the rope's line: seven 16ths (the note that never moves is 2; two of the chord's under it, one over)
KICKS = ((0, 8, 15), (0, 7, 8))  # the kick's 16ths, two bars about
GHOSTS = (3, 7, 11, 14)  # the march snare's soft taps

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two, .25 a 16th. ----
# The tune (the trumpet): three bars, three bars and two.
TUNE = (
    "A4:.75 D5:.75 F#5:2 E5:.5 | E5:1 D5:2/3 C5:2/3 D5:2/3 G5:1 | F#5:2.5 D5:.5 B4:.5 D5:.5 | F5:1.5 D5:.5 A5:1.5 F5:.5 | "
    "F#5:.5 A5:.5 D6:2 A5:1 | B5:1 A5:2/3 G5:2/3 D5:2/3 G5:1 | F#5:1.5 A5:.5 D5:1 F#5:1 | E5:.75 G5:.75 A5:.5 G5:.25 E5:.25 C#5:.25 A4:.25 -:1"
)
# The fiddle's answers where the tune breathes.
TUNE_ANS = "-:4 | -:4 | -:4 | -:4 | -:4 | -:4 | -:4 | -:3 E5:.25 G5:.25 A5:.25 C#6:.25"
# The outlaw's tune (the twangy guitar), and the whistle's two words in its gaps.
OUTLAW = (
    "D4:1 F4:.5 F#4:.5 A4:1.5 D4:.5 | C4:.5 D4:.5 -:1 A3:.5 C4:.5 D4:1 | C4:1 E4:.5 G4:1 E4:.5 C4:1 | Bb3:.5 C4:.5 -:1 G3:.5 Bb3:.5 C4:1 | "
    "Bb3:1 D4:.5 F4:1.5 D4:1 | F4:2/3 D4:2/3 Bb3:2/3 C4:1 D4:1 | E4:1 G4:.5 C5:1.5 Bb4:1 | A4:1.5 G4:.5 E4:1 C#4:1"
)
OUTLAW_ANS = "-:4 | -:1 A5:.5 F#5:.5 -:2 | -:4 | -:1 G5:.5 E5:.5 -:2 | -:4 | -:4 | -:4 | -:4"
# The standoff: the whistle's wail.
WAIL = "-:1 A5:3 | D6:2.5 C6:.5 A5:1 | Bb5:3 G5:1 | E5:2 G5:1 Bb5:1 | A5:3 F5:1 | D5:1.5 F5:.5 A5:2 | G5:3 A5:1 | E5:3 -:1"
# The ride: on each of the three chords the trumpet has two bars and the fiddle answers with two; then four together.
RIDE_T = (
    "D5:.5 F#5:.5 A5:2.5 B5:.5 | A5:1 F#5:2/3 E5:2/3 D5:2/3 E5:1 | -:8 | "
    "F5:.5 Bb5:.5 D6:2 C6:1 | Bb5:1.5 G5:.5 F5:1 D5:1 | -:8 | "
    "C#5:.5 F#5:.5 A#5:2 G#5:1 | F#5:1.5 D#5:.5 C#5:1 A#4:1 | -:8 | "
    "A5:1.5 F#5:.5 D5:1 F#5:1 | Bb5:1.5 F5:.5 D5:1 F5:1 | A#5:1.5 F#5:.5 C#5:1 F#5:1 | E5:1 G5:1 A5:1 -:1"
)
RIDE_F = (
    "-:8 | F#5:.25 G5:.25 A5:.25 B5:.25 D6:1.5 B5:.5 A5:1 | F#5:.5 A5:.5 D6:.5 C#6:.5 B5:.5 A5:.5 F#5:1 | "
    "-:8 | D5:.25 F5:.25 G5:.25 Bb5:.25 C6:1.5 Bb5:.5 G5:1 | F5:.5 G5:.5 Bb5:.5 D6:.5 C6:.5 Bb5:.5 F5:1 | "
    "-:8 | A#4:.25 C#5:.25 D#5:.25 F#5:.25 G#5:1.5 F#5:.5 D#5:1 | C#5:.5 D#5:.5 F#5:.5 A#5:.5 G#5:.5 F#5:.5 C#5:1 | "
    "F#5:1.5 D5:.5 A4:1 D5:1 | D5:1.5 Bb4:.5 F4:1 Bb4:1 | C#5:1.5 A#4:.5 F#4:1 A#4:1 | C#5:1 E5:1 C#5:1 -:1"
)
for _line, _beats in ((TUNE, 32), (TUNE_ANS, 32), (OUTLAW, 32), (OUTLAW_ANS, 32), (WAIL, 32), (RIDE_T, 64), (RIDE_F, 64)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
last4 = lambda text: " | ".join(text.split("|")[4:])


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that
    passage (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=211, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(79)
    sr = x.sr
    tau = 2 * np.pi
    sw = lambda i: (i + (SWING if i % 2 else 0)) / 4  # a 16th of the bar, in beats, swung

    def sway(b):
        """A line's note that starts on an off 16th starts late, as the band's do."""
        q = float(b) * 4
        return float(b) + SWING / 4 if abs(q - round(q)) < 1e-6 and round(q) % 2 else float(b)

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def murk(k, cut):
        """Noise with its highs rolled off."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    def band(w, f, q):
        """Noise ringing at `f` Hz (through a resonance `q` sharp), at the level it came in at."""
        secs = q / (np.pi * f)
        t = np.arange(int(5 * secs * sr)) / sr
        out = np.convolve(w, np.sin(tau * f * t) * np.exp(-t / secs), "same")
        return out / (np.sqrt(np.mean(out**2)) + 1e-9) * np.sqrt(np.mean(w**2))

    def chord(name):
        """A chord's bass note (D2 to D flat 3; the note after a slash if it has one) and a way to its notes between two pitches."""
        name, _, under = name.partition("/")
        pitch = lambda text: {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[text[0]] + {"b": -1, "#": 1}.get(text[1:2], 0)
        pc = pitch(name)
        pcs = [(pc + i) % 12 for i in KINDS[name[1 + (name[1:2] in ("b", "#")):]]]
        return 38 + (pitch(under or name) - 2) % 12, lambda lo, hi: [m for m in range(lo, hi + 1) if m % 12 in pcs]

    of = lambda bar: chord(CHORDS[(bar - 1) % BARS])

    def low(bar):
        """The bar's bass note: the tune's walk down, the standoff's one note, or the chord's own."""
        bar = (bar - 1) % BARS + 1
        for first, up in ((5, 0), (13, 0), (61, 3)):
            if first <= bar < first + 8:
                return n(TUNE_BASS.split()[bar - first]) + up
        return of(bar)[0]

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.28 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.7 * np.sin(tau * np.cumsum(46 + 115 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.11)) + 0.3 * hiss(k, 6000, 0.5) * np.exp(-t / 0.002)
        put("kick", b, w * tail(k) * vol)

    def snare(b, vol=0.26, soft=False):
        """A march snare: a crack and its wires; `soft`: a tap."""
        k = int((0.06 if soft else 0.2) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(200 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.035)
        put("snare", b, (0.7 * body + 1.0 * hiss(k, 9000, 0.6) * np.exp(-t / (0.018 if soft else 0.07))) * tail(k) * vol, 0.05)

    def hat(b, vol=0.03, pan=0.3):
        k = int(0.04 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / 0.01) * tail(k, 0.004) * vol, pan)

    def hoof(b, high=True, vol=0.1, pan=0.0):
        """A hoof on hard ground: a hollow knock (the clip is higher than the clop)."""
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        f = 1150 if high else 820
        w = (np.sin(tau * f * t) + 0.5 * np.sin(tau * 1.51 * f * t)) * np.exp(-t / 0.012) + 0.4 * hiss(k, 4000, 0.3) * np.exp(-t / 0.003)
        put("hooves", b, w * np.minimum(1, t / 0.0005) * tail(k) * vol, pan)

    def whip(b, vol=0.2):
        """A whip: the lash through the air, and its crack on the beat."""
        k = int(0.14 * sr)
        u = np.linspace(0, 1, k)
        put("fx", b - 0.3, hiss(k, 9000, 0.6) * u**3 * vol * 0.35, -0.3)
        k = int(0.08 * sr)
        t = np.arange(k) / sr
        put("fx", b, (hiss(k, 14000, 0.5) * np.exp(-t / 0.004) + 0.5 * hiss(k, 5000, 0.2) * np.exp(-t / 0.02)) * tail(k) * vol, 0.2)

    def tom(b, m, vol=0.3, pan=0.0):
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.13) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def ruff(b, count=4, vol=0.1):
        """The march snare's run of taps into a beat."""
        for i in range(count):
            snare(b - (count - i) / 8, vol * (0.5 + 0.5 * i / count), soft=True)

    # ---- his sounds, as the game builds them (packages/app/src/characters/pig-sounds.ts) ----
    def whirl(b, length, turns0=1.0, turns1=1.0, vol=0.05, pan=0.0):
        """The rope whirling over his head: breathy noise whose pitch and level rise and fall once a turn (`turns0`
        to `turns1` turns a beat)."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        lfo = 0.5 + 0.5 * np.sin(tau * length * (turns0 * u + (turns1 - turns0) * u * u / 2) - np.pi / 2)
        air = murk(k, 3800)
        w = (band(air, 650, 1.8) * (1 - lfo) + band(air, 1150, 1.8) * lfo) * (0.3 + 0.7 * lfo**2)
        put("fx", b, w * np.minimum(1, u * 12) * np.minimum(1, (1 - u) * 25) * vol * 2.6, pan)

    def throw(b, vol=0.05):
        k = int(0.3 * sr)
        u = np.linspace(0, 1, k)
        air = murk(k, 4500)
        put("fx", b, (band(air, 700, 1.5) * (1 - u) + band(air, 1900, 1.5) * u) * np.sin(np.pi * u) ** 1.5 * vol * 2.6, 0.2)

    def catch(b, vol=0.08):
        """The loop slapping down on its catch."""
        k = int(0.12 * sr)
        t = np.arange(k) / sr
        put("fx", b, (murk(k, 2600) * np.exp(-t / 0.012) * 2 + 0.6 * np.sin(tau * np.cumsum(150 + 120 * np.exp(-t / 0.015)) / sr) * np.exp(-t / 0.04)) * tail(k) * vol)

    def clink(b, vol=0.03, pan=0.3):
        """A spur: a dull clink."""
        k = int(0.07 * sr)
        t = np.arange(k) / sr
        put("fx", b, (np.sin(tau * 2100 * t) + 0.6 * np.sin(tau * 3350 * t + 1) + 0.3 * murk(k, 3000)) * np.exp(-t / 0.014) * np.minimum(1, t / 0.0005) * tail(k) * vol, pan)

    def stomp(b, vol=0.3):
        """His boot coming down, the spur with it."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        put("kick", b, (np.sin(tau * np.cumsum(50 + 60 * np.exp(-t / 0.02)) / sr) + 1.1 * murk(k, 900) * np.exp(-t / 0.03)) * np.exp(-t / 0.09) * tail(k) * vol)
        clink(b, 0.06 * vol)

    def snort(b, vol=0.05, pitch=120.0, secs=0.16, pan=-0.2, late=0.0):
        """One snort (or, low and long, a grunt): breath through a pig's nose over a short grunt that drops in pitch."""
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        air = murk(k, 2800)
        ph = tau * np.cumsum(pitch * (1.15 - 0.3 * u)) / sr
        grunt = sum(np.sin(h * ph) / h**1.6 for h in range(1, 9))
        put("pig", b, (band(air, 520, 2.4) * 2 + band(air, 1050, 3.0) * 1.2 + 0.5 * grunt) * np.sin(np.pi * u) ** 0.7 * vol, pan, late=late)

    def laugh(b, vol=0.05):
        for i in range(4):
            snort(b, vol * (1 - 0.12 * i), 135 - 8 * i, 0.09, -0.2, late=0.13 * i)

    def rattle(b, length, vol=0.02, pan=0.4):
        """A rattle in the dust: quick dry ticks, swelling and dying."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        put("fx", b, hiss(k, 9000, 0.8) * (0.5 + 0.5 * np.sign(np.sin(tau * 26 * t))) * np.sin(np.pi * u) ** 1.5 * vol, pan)

    def wind(b, length, vol=0.02):
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        air = murk(k, 2500)
        gust = 0.5 + 0.5 * np.sin(tau * 2.3 * u + 1)
        put("fx", b, (band(air, 420, 1.2) * (1 - gust) + band(air, 760, 1.2) * gust) * np.sin(np.pi * u) ** 0.8 * (0.5 + 0.5 * gust) * vol * 2.6, -0.3)

    # ---- the band's voices ----
    def blast(b, m, length=1.0, vol=0.3, grunt=True):
        """The low horn: a tuba and a trombone an octave over it, swelling in fast, snarling down into the pitch.
        `grunt`: his grunt in it."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for over, loud in ((0, 1.0), (12, 0.6)):
            f0 = x.hz(m + over)
            ph = tau * np.cumsum(f0 * 2 ** (0.3 * np.exp(-t / 0.04) / 12)) / sr
            for h in range(1, int(3500 / f0) + 1):
                w += loud * np.sin(h * ph + 0.5 * h) / h * (0.6 + 1.2 * np.exp(-(((h * f0 - 420) / 260) ** 2))) * (0.3 + 0.7 * np.exp(-t * h / 2.5))
        put("horn", b, np.tanh(0.5 * w) * np.minimum(1, t / 0.025) * np.exp(-t / (0.5 * length * x.beat_s + 0.15)) * tail(k, 0.05) * vol)
        if grunt:
            snort(b, 0.16 * vol, 92, 0.34, 0.0, late=0.02)

    def pluck(b, m, long=0.5, vol=0.4, hold=0.3, ghost=False):
        """The bass: plucked, bright only on its front. A ghost: a muted thud."""
        at(b, long)
        k = int(0.05 * sr) if ghost else x.k(long) + int(0.03 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = (0.6 * np.sin(ph) + 0.5 * murk(k, 900)) * np.exp(-t / 0.015) if ghost else np.sin(ph + (3.0 * np.exp(-t / 0.045) + 0.6) * np.sin(ph)) * (hold + (1 - hold) * np.exp(-t / 0.12))
        put("bass", b, w * np.minimum(1, t / 0.001) * tail(k, 0.03) * vol)

    def sub(b, m, length, vol=0.5):
        """A deep kick with a note in it, for the ride."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env) * vol)

    def trumpet(start, text, vol=1.0, pan=-0.1, up=0):
        """The trumpet: every harmonic, those round 1.3 kHz the strongest (its bell), bright on the front of a note and
        mellower as it holds; it leans up into a phrase's first note and into the long ones, which waver once settled."""
        free = -1.0
        for b, d, m in notes(start, text):
            b, d, m = sway(b), float(d), m + up
            at(b, d)
            f0 = x.hz(m)
            harm = [h**-0.9 * (0.45 + 1.3 * np.exp(-(((h * f0 - 1300) / 650) ** 2))) for h in range(1, max(2, int(7000 / f0)) + 1)]
            long = d >= 1.0
            w = x.tone(m, d * 0.93, harm, 1.0, detune=(-3, 4), vib=0.007 if long else 0.0, vib_hz=5.8, scoop=0.6 if long or b > free + 0.3 else 0.2, scoop_s=0.025,
                       attack=0.018, release=0.04, bright=0.3)
            put("brass", b, np.tanh(1.1 * w / np.sqrt(sum(a * a for a in harm))) * 0.17 * vol, pan)
            free = b + d

    def whistled(start, text, vol=1.0, pan=0.2, up=0):
        """A cowboy's whistle: nearly a pure note with breath in it, sliding from each note to the next, wavering on
        the long ones."""
        last = None
        for b, d, m in notes(start, text):
            b, d, m = float(b), float(d), m + up
            at(b, d)
            k = x.k(d * 0.97)
            t = np.arange(k) / sr
            glide = float(last[1] - m) if last is not None and abs(last[0] - b) < 1e-6 else -1.0
            f = x.hz(m) * 2 ** (glide * np.exp(-t / 0.045) / 12) * (1 + 0.012 * np.sin(tau * 5.5 * t) * np.clip((t - 0.15) / 0.15, 0, 1))
            ph = tau * np.cumsum(f) / sr
            w = np.sin(ph) + 0.04 * np.sin(2 * ph) + 0.6 * band(murk(k, 6000), x.hz(m), 6.0)
            put("whistle", b, w * np.minimum(1, t / 0.04) * tail(k, 0.07) * 0.09 * vol, pan)
            last = (b + d, m)

    def twanged(start, text, vol=0.2, pan=-0.2, up=0):
        """A twangy guitar: a picked string (synth.py's koto) that dies quickly, its level trembling; the echo has its ring."""
        for b, d, m in notes(start, text):
            k = int(0.7 * sr)
            t = np.arange(k) / sr
            put("twang", sway(b), x.struck("koto", m + up)[:k] * np.exp(-t / 0.3) * (1 - 0.3 * (0.5 - 0.5 * np.cos(tau * 6.0 * t))) * tail(k, 0.1) * vol, pan)

    def fiddled(start, text, vol=1.0, pan=0.25, up=0):
        for b, d, m in notes(start, text):
            b, d = sway(b), float(d)
            at(b, d)
            put("fiddle", b, x.fiddle(m + up, d * 0.95, 0.145 * vol), pan)

    def strings(bar, vol=0.03, length=4.0, tremble=0.0, octave=12):
        """Strings on the bar's chord; `tremble`: the bows shaking; `octave` 0: the low ones, under the tune."""
        at(bar0(bar), length)
        ms = of(bar)[1](57, 69)[:4]
        for j, m in enumerate(ms):
            w = x.tone(m + octave, length, x.STRINGS, vol, detune=(-7, 0, 8), vib=0.004, attack=0.25, release=0.3, trem=tremble, trem_hz=7.5)
            put("pad", bar0(bar), w, -0.45 + 0.9 * j / max(1, len(ms) - 1))

    # ---- the band, bar by bar ----
    def roped(bar, vol=1.0, up=0, keep=1, first=None):
        """A bar of the rope's line: straight 16ths, never swung; seven long, so it starts somewhere new in each bar.
        Its four notes: two of the chord's under the note that never moves, that note, one of the chord's over it."""
        between = of(bar)[1]
        still = STILL + up
        if between(still - 1, still - 1):  # (a chord with the note a half step under it: the next note up, for that bar)
            still += 2
        under = between(still - 9, still - 2)
        four = (under[0], under[-1], still, between(still + 1, still + 9)[0])
        for i in range(0, 16, keep):
            j = 16 * (bar - (first or bar)) + i if first else 16 * (bar - 1) + i
            b = bar0(bar) + i / 4
            at(b, 0.25)
            put("rope", b, x.pulse(four[LOOP[(j // keep) % 7]], 0.22, 0.25, 0.05 * vol * (1.25 if LOOP[(j // keep) % 7] == 2 else 1.0), decay=0.09, sustain=0.0, release=0.004),
                0.6 * np.sin(tau * (j // keep) / 7))

    def trot(bar, vol=1.0):
        """Hooves at a trot: clip, clop, on the 8ths."""
        for i in range(8):
            hoof(bar0(bar) + i * 0.5, i % 2 == 0, (0.1 if i % 2 == 0 else 0.075) * vol, 0.25 if i % 2 == 0 else -0.25)

    def march(bar, vol=1.0, ghosts=True):
        """The march: the kick (two bars about), the snare on 2 and 4, its soft taps between, a hat on the 8ths; every
        fourth bar a run of taps into the next."""
        b = bar0(bar)
        for i in KICKS[bar % 2]:
            kick(b + sw(i), 0.5 * vol)
        snare(b + 1, 0.26 * vol), snare(b + 3, 0.26 * vol)
        for i in range(8):
            hat(b + i * 0.5, (0.028 if i % 2 == 0 else 0.018) * vol)
        if ghosts:
            for i in GHOSTS:
                snare(b + sw(i), 0.06 * vol, soft=True)
        if bar % 4 == 0:
            ruff(b + 4, 4, 0.12 * vol)

    def boomchick(bar, vol=1.0):
        """The bass on 1 and 3 (the bar's note, then a chord note a fourth or so over it), a ghost and a step toward
        the next bar's; and the chick: three of the chord's notes raked on 2 and 4."""
        b = bar0(bar)
        root, between = low(bar), of(bar)[1]
        other = (between(root + 5, root + 8) or between(root + 3, root + 4))[0]
        nxt = low(bar + 1)
        pluck(b, root, 0.9, 0.42 * vol), pluck(b + sw(7), root, 0.2, 0.3 * vol, ghost=True), pluck(b + 2, other, 0.9, 0.38 * vol)
        pluck(b + sw(14), root if abs(nxt - root) <= 2 else nxt + (2 if nxt < root else -2), 0.4, 0.34 * vol)
        for beat in (1, 3):
            for j, m in enumerate(between(57, 69)[:3]):
                k = int(0.12 * sr)
                t = np.arange(k) / sr
                put("strum", b + beat, x.struck("koto", m)[:k] * np.exp(-t / 0.035) * tail(k, 0.02) * 0.05 * vol, 0.3, late=0.008 * j)

    def strut(bar, vol=1.0, rope=0.7, up=0):
        """A bar of the strut: the march, the hooves, the bass and the chick, the rope's line over it."""
        march(bar, vol), trot(bar, vol), boomchick(bar, vol), roped(bar, rope, up)

    # Bars 1-4: the rope spinning high, alone, a swish with each turn (seven 16ths), wind; nothing in the middle. Under
    # it the low horn and his grunt, with the kick, a snare and a crash: at the start, as a pickup into bar 3 and on it,
    # twice more into the strut; a snort between.
    wind(bar0(1), 16, 0.02)
    for bar in range(1, 5):
        roped(bar, 1.0)
    whirl(bar0(1), 16, 4 / 7, 4 / 7, 0.03)
    for b, m, length, loud in ((bar0(1), n("D2"), 2.0, 1.0), (bar0(2) + 3, n("C2"), 0.8, 0.7), (bar0(3), n("D2"), 2.0, 1.0), (bar0(4) + 2, n("F2"), 0.8, 0.7), (bar0(4) + 3, n("A2"), 0.9, 0.85)):
        blast(b, m, length, 0.3 * loud, grunt=length > 1), kick(b, 0.55 * loud), snare(b, 0.22 * loud)
    x.crash(bar0(1), 0.16, decay=0.5), x.crash(bar0(3), 0.14, decay=0.5)
    snort(bar0(2) + 1, 0.04), snort(bar0(2) + 1.5, 0.035, 128)
    ruff(bar0(5), 6, 0.14)

    # Bars 5-12: the strut and the trumpet's tune, low strings under it. Bars 13-20: again, the whistle with it for
    # its last four bars, the fiddle answering at the end, higher strings too.
    x.crash(bar0(5), 0.16, decay=0.5), whip(bar0(5), 0.16)
    for bar in range(5, 21):
        strut(bar)
        strings(bar, 0.02 if bar < 13 else 0.024, octave=0)
        if bar >= 13:
            strings(bar, 0.018)
    whirl(bar0(5), 64, 4 / 7, 4 / 7, 0.015)
    trumpet(bar0(5), TUNE), trumpet(bar0(13), TUNE)
    whistled(bar0(17), last4(TUNE), 0.9), fiddled(bar0(13), TUNE_ANS, 0.8)
    x.crash(bar0(13), 0.14, decay=0.5)
    stomp(bar0(12) + 3, 0.2), clink(bar0(8) + 3.5, 0.03), clink(bar0(16) + 3.5, 0.03, -0.3)

    # Bars 21-28: the outlaw's tune on the twangy guitar; the chords step down by whole steps and back; the low horn on
    # each new chord (his grunt on the first), the whistle's two words, a whip.
    whip(bar0(21), 0.18)
    for bar in range(21, 29):
        strut(bar, rope=0.6)
        if bar % 2 == 1:
            blast(bar0(bar), low(bar), 1.2, 0.2, grunt=bar == 21)
    twanged(bar0(21), OUTLAW), whistled(bar0(21), OUTLAW_ANS, 0.6)
    whirl(bar0(21), 32, 4 / 7, 4 / 7, 0.015)

    # Bars 29-36: the standoff (the calm), the pace sagging into it. No march: strings trembling, one bass note, the
    # rope's line at half its pace, his spurs on 1 and 3, a rattle, wind; the whistle wails; he snorts.
    wind(bar0(29), 16, 0.016), wind(bar0(33), 16, 0.018)
    for bar in range(29, 37):
        strings(bar, 0.03, tremble=0.45), roped(bar, 0.5, keep=2, first=29)
        pluck(bar0(bar), low(bar), 3.0, 0.26, 0.45)
        stomp(bar0(bar), 0.18), stomp(bar0(bar) + 2, 0.15)
    rattle(bar0(31) + 1, 3.0), rattle(bar0(35), 4.0, 0.024, -0.4)
    whistled(bar0(29), WAIL, 0.8)
    snort(bar0(34) + 3, 0.04, 105, 0.22)

    # Bars 37-40: the rope spins faster (its line, louder, an octave higher from the third bar; the swish quickening),
    # the hooves break from the trot, the snare's taps crowd in; he throws; the loop lands.
    for j, bar in enumerate(range(37, 41)):
        b = bar0(bar)
        roped(bar, 0.7 + 0.12 * j, up=12 if j >= 2 else 0, first=37)
        for i in range(4 * (1, 2, 2, 4)[j]):
            pluck(b + i / (1, 2, 2, 4)[j], low(bar), 0.8 / (1, 2, 2, 4)[j], 0.3 + 0.03 * j)
        for i in range(8 if j < 2 else 16):
            hoof(b + i / (2 if j < 2 else 4), i % 2 == 0, 0.07 + 0.012 * j, 0.25 if i % 2 == 0 else -0.25)
        for i in range((4, 8, 8, 16)[j]):
            snare(b + i * 4 / (4, 8, 8, 16)[j], 0.05 + 0.03 * j + 0.004 * i, soft=j < 3)
        stomp(b, 0.22 + 0.04 * j), stomp(b + 2, 0.2 + 0.04 * j)
        strings(bar, 0.02 + 0.004 * j, tremble=0.45)
    whirl(bar0(37), 14, 4 / 7, 2.0, 0.045)
    throw(bar0(40) + 2, 0.07), catch(bar0(40) + 3.5, 0.1)

    # Bars 41-56: the ride (the drop). A gallop: the kick on every beat, a deep one under each four bars, the snare on
    # 2 and 4 with the gallop's taps, the hooves three to a beat, strings bowing the gallop; the bass walks; the rope's
    # line loud. Three chords a major third apart, four bars each: the trumpet has two (long notes over the bar line),
    # the fiddle answers with two (runs); then four bars together.
    whip(bar0(41), 0.22)
    for bar in range(41, 57):
        b = bar0(bar)
        root, between = low(bar), of(bar)[1]
        for i in range(4):
            kick(b + i, 0.52)
            hoof(b + i, True, 0.09, 0.25), hoof(b + i + 0.5, False, 0.07, -0.25), hoof(b + i + 0.75, False, 0.07, -0.1)
            snare(b + i + 0.5, 0.055, soft=True), snare(b + i + 0.75, 0.07, soft=True)
        snare(b + 1, 0.27), snare(b + 3, 0.27)
        for i in range(8):
            hat(b + i * 0.5, 0.03 if i % 2 == 0 else 0.02)
        walk = between(root, root + 12)
        for i in range(8):  # the bass walks up the chord and back
            pluck(b + i * 0.5, walk[(0, 1, 2, 3, 2, 1, 2, 1)[i] % len(walk)], 0.42, 0.4 if i % 2 == 0 else 0.32)
        chordal = between(57, 69)[:3]
        for i in (0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15):  # the strings' gallop
            at(b + i / 4, 0.25)
            for j, m in enumerate(chordal):
                put("pad", b + i / 4, x.strings(m + 12, 0.2, 0.03 if i % 4 == 0 else 0.022, attack=0.01, release=0.03), -0.4 + 0.4 * j)
        roped(bar, 1.0, first=41)
        if bar % 4 == 1:
            sub(b, root, 2.0, 0.45), x.crash(b, 0.2, decay=0.6)
        if bar >= 53:
            strings(bar, 0.026)
    trumpet(bar0(41), RIDE_T), fiddled(bar0(41), RIDE_F)
    whirl(bar0(41), 64, 1.0, 1.0, 0.012)
    for i in range(8):
        snare(bar0(57) - 1 + i / 8, 0.08 + 0.02 * i, soft=i < 6)

    # Bars 57-60: the dust. The rope's line alone again, wind; the low horn and his grunt (on A, then on C, the way
    # into the higher key); he laughs; the march's taps bring the tune back.
    wind(bar0(57), 16, 0.016)
    for bar in range(57, 61):
        roped(bar, 0.95, first=57)
    whirl(bar0(57), 16, 4 / 7, 4 / 7, 0.03)
    for b, m, length, loud in ((bar0(57), n("A2"), 2.0, 1.0), (bar0(58) + 3, n("G2"), 0.8, 0.7), (bar0(59), n("C3"), 2.0, 1.0), (bar0(60) + 2, n("G2"), 0.8, 0.7), (bar0(60) + 3, n("C3"), 0.9, 0.85)):
        blast(b, m, length, 0.3 * loud, grunt=length > 1), kick(b, 0.55 * loud), snare(b, 0.22 * loud)
    x.crash(bar0(57), 0.18, decay=0.5)
    laugh(bar0(58) + 0.75, 0.05)
    ruff(bar0(61), 6, 0.14)

    # Bars 61-68: the tune a minor third up, in F: the trumpet, the whistle over it all the way, strings, a deep kick
    # under every other bar.
    x.crash(bar0(61), 0.2, decay=0.6), whip(bar0(61), 0.2)
    for bar in range(61, 69):
        strut(bar, 1.05, rope=0.8, up=3), strings(bar, 0.024), strings(bar, 0.024, octave=0)
        if bar % 2 == 1:
            sub(bar0(bar), low(bar), 1.5, 0.34)
    trumpet(bar0(61), TUNE, up=3), whistled(bar0(61), TUNE, 0.7, up=3)
    whirl(bar0(61), 32, 4 / 7, 4 / 7, 0.015)

    # Bars 69-70: the turn home. The whole band's hits on B flat, then on A (the low horn in them), a run of taps; the
    # rope's line through it, for the way round.
    for bar in (69, 70):
        b = bar0(bar)
        roped(bar, 0.9)
        for i in (0, 6, 8) if bar == 69 else (0, 6, 8, 12):
            kick(b + sw(i), 0.55), pluck(b + sw(i), low(bar), 0.3, 0.44), blast(b + sw(i), low(bar), 0.5, 0.16, grunt=False)
        snare(b + 1, 0.26), snare(b + 3, 0.26), trot(bar, 0.9)
    trumpet(bar0(69), "D5:1.5 F5:.5 Bb5:2 | A5:1 G5:.5 E5:.5 C#5:1 -:1", 0.9)
    ruff(bar0(70) + 4, 6, 0.14), snort(bar0(70) + 3, 0.035)

    x.beat_s = 60 / 112  # the echoes' beat
    x.echo("brass", 0.75, 0.12, 0.05), x.echo("fiddle", 0.75, 0.14, 0.06), x.echo("twang", 0.75, 0.4, 0.2), x.echo("whistle", 0.75, 0.22, 0.1), x.echo("rope", 0.75, 0.2, 0.08)
    levels = {"brass": 1.5, "whistle": 1.3, "fiddle": 0.85, "twang": 3.0, "bass": 0.7, "sub": 0.5, "horn": 2.2, "kick": 0.8, "snare": 1.7, "hats": 5.5, "hooves": 2.7,
              "toms": 1.1, "drum": 1.5, "rope": 1.4, "strum": 5.0, "pad": 2.0, "pig": 2.0, "fx": 2.0}
    return x.play(x.mixdown(levels, lowpass=8500, room=0.2))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
