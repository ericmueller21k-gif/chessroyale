"""Song Z (Eric, Nov 13): Puddles the hippo gardener's theme, a loop of two and a half minutes. He sent a write-up of
a style, made from another game's track ("take these notes and make your own version. Same rules as always"): a
16-bit console's FM chip and its square-wave chip playing a mid-tempo funk strut.
What is used from the write-up is the style's own means, none of them one song's: about 105 beats a minute with the
16th notes swung hard; "dead air" (short notes, rests between the hits, no echo) set against a part where the chords
are held; a plucked FM bass; a nasal, reedy lead that scoops up into a phrase's first note and wavers on its long
ones; a whistling square-wave lead with a quick note from just below flicked in before a phrase; a reed organ, held or
in very short chords; short chords and the bass hitting together with hops of tune between them; a crunchy sampled
kick and snare; a sneaky minor opening that turns bright and major.
What is not used: the write-up's chord progressions, its bass riff, its lead's three-note hook, its hammered note,
its trill and run, or any tune of it (the write-up's own "original" version is that track's chords moved to another
key). The track itself was not listened to, measured or transcribed, and every melody, riff and chord progression
here is original: none of it is any song's or any game's.

The idea from his world that runs the song: his garden. In his fight a seed lands every 30 seconds, whoever's turn
it is; so does one here (104 beats a minute makes 30 seconds exactly 13 bars, and the loop is five seeds long, so
they stay 30 seconds apart round the loop), and something new comes up from each: the strut, the tune in bloom, the
night garden, the watering, the prize bloom. The ground is dry or watered: dry is A minor, short notes and silence;
watered is A major, held chords, echo, water dripping in 16ths and a sprinkler ticking across. And things grow: in
bloom the bass climbs a whole octave a step a bar under an E that never moves (the last note of each bar leans on
the next); in the build a vine on the square wave grows a note taller every time round (3 notes, then 4, up to 13),
over chords climbing by whole steps; the last tune is a minor third up, in C.
Puddles is the nasal lead (he talks in quick, high, made-up syllables: a few of them, four times); the whistle is
his garden. His sounds, built as the game builds them (packages/app/src/characters/gardener-sounds.ts): the seed's
whiff and plip, his heavy steps, the hose's creak and hiss, a bud's pop, the killer plant's snap and gulp, the
queen's sparkle.
  python3 song_z.py <out.wav>

  bar   1      0:00  a seed; he says hello; two heavy steps
  bars  2-5    0:02  the dry strut: the bass and the kit, air between the hits; his first words
  bars  6-13   0:12  his tune, dry (A minor); the square answers in the gaps; clouds roll in
  bars 14-21   0:30  a seed, and the garden in bloom (A major): the whistle's tune, held chords, the bass climbing
  bars 22-26   0:48  short chords and the bass together, the whistle hopping between them
  bars 27-33   1:00  a seed, and the garden at night (the calm): the tune slowly on an ocarina, drips
  bars 34-39   1:16  he hauls the hose: the vine growing, the chords climbing; a hush: "watering time!"
  bars 40-51   1:30  a seed, and the watering (the drop): he and the whistle trade, then play together
  bar  52      1:58  the killer plant: a snap, a gulp, silence
  bars 53-60   2:00  a seed, and the prize bloom: the tune a minor third up, he joins it
  bars 61-64   2:18  the short chords again, higher
  bar  65      2:28  the turn home; the next seed is tossed
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 104, 65
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 150.0 s: five seeds, 30 s apart
SEEDS = (1, 14, 27, 40, 53)  # the bars a seed lands at the start of
SWING = 0.2  # an off 16th is this much of a 16th late
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: its bass note and the bass's other note; the organ's four; the drips' five (low, middle, the one they
# keep coming back to, a color, high). "+3" after a name: a minor third up (the prize bloom).
GARDEN = {
    # dry
    "Am7": ("A1 E2", "G3 A3 C4 E4", "A4 C5 E5 G5 A5"),
    "Bb9": ("Bb1 F2", "Ab3 C4 D4 F4", "Bb4 D5 F5 Ab5 C6"),
    "F9": ("F1 C2", "G3 A3 C4 Eb4", "A4 C5 Eb5 G5 A5"),
    "E7": ("E1 B1", "G#3 B3 D4 E4", "G#4 B4 E5 D5 G#5"),
    "G7": ("G1 D2", "F3 G3 B3 D4", "G4 B4 D5 F5 G5"),
    # in bloom: the bass climbs A B C# D E F# G G# under the E
    "A": ("A1 E2", "A3 B3 C#4 E4", "A4 C#5 E5 F#5 A5"),
    "E/B": ("B1 E2", "E3 G#3 B3 E4", "G#4 B4 E5 F#5 G#5"),
    "A/C#": ("C#2 E2", "E3 A3 C#4 E4", "A4 C#5 E5 F#5 A5"),
    "Dadd9": ("D2 A2", "F#3 A3 D4 E4", "A4 D5 E5 F#5 A5"),
    "E7'": ("E2 B1", "G#3 B3 D4 E4", "G#4 B4 E5 D5 G#5"),
    "F#m7": ("F#2 C#2", "F#3 A3 C#4 E4", "A4 C#5 E5 F#5 A5"),
    "G6": ("G2 D2", "G3 B3 D4 E4", "G4 B4 E5 D5 G5"),  # from outside the key
    "E/G#": ("G#2 E2", "G#3 B3 D4 E4", "G#4 B4 E5 D5 G#5"),
    # the short chords: round the circle of fifths
    "F#7": ("F#1 C#2", "E3 A#3 C#4 E4", "A#4 C#5 E5 F#5 A#5"),
    "B9": ("B1 F#2", "A3 C#4 D#4 F#4", "A4 C#5 D#5 F#5 A5"),
    "E9": ("E1 B1", "G#3 B3 D4 F#4", "G#4 B4 D5 F#5 G#5"),
    "A6": ("A1 E2", "A3 C#4 E4 F#4", "A4 C#5 E5 F#5 A5"),
    "A7": ("A1 E2", "G3 A3 C#4 E4", "A4 C#5 E5 G5 A5"),
    # the night garden: D, and E over the same D (its raised fourth)
    "Dmaj9": ("D2 A2", "F#3 A3 C#4 E4", "A4 C#5 E5 F#5 A5"),
    "E/D": ("D2 A2", "E3 G#3 B3 E4", "G#4 B4 E5 F#5 G#5"),
    "E7sus": ("E2 B1", "A3 B3 D4 E4", "A4 B4 E5 F#5 A5"),
    # the build and the watering: bare chords, each with its second
    "B": ("B1 F#2", "B3 C#4 D#4 F#4", "B4 D#5 F#5 C#5 B5"),
    "C#": ("C#2 G#2", "C#4 D#4 F4 G#4", "C#5 F5 G#5 D#5 C#6"),
    "D#": ("D#2 A#2", "D#4 F4 G4 A#4", "D#5 G5 A#5 F5 D#6"),
    "F": ("F2 C2", "F3 G3 A3 C4", "A4 C5 F5 G5 A5"),
    "G": ("G2 D2", "G3 A3 B3 D4", "B4 D5 G5 A5 B5"),
    "Db": ("Db2 Ab1", "Ab3 Db4 Eb4 F4", "Ab4 Db5 F5 Eb5 Ab5"),
}
VAMP = "Am7 Bb9 Am7 Bb9"
BLOOMS = "A E/B A/C# Dadd9 E7' F#m7 G6 E/G#"
CHORDS = (
    f"Am7  {VAMP}  {VAMP} Am7 Bb9 F9 E7  {BLOOMS}  F#7 B9 E9 A6 A7  Dmaj9 Dmaj9 E/D E/D Dmaj9 Dmaj9 E7sus  "
    "A B C# D# F G  A A F F Db Db A A F Db A G7  G7  "
    + " ".join(c + "+3" for c in BLOOMS.split())
    + "  F#7+3 B9+3 E9+3 A6+3  E7"
).split()
assert len(CHORDS) == BARS, len(CHORDS)
DRIP = (2, 1, 2, 0, 2, 3, 2, 4, 2, 3, 2, 1, 2, 0, 2, 1)  # the drips' bar, 16th by 16th: which of the five
KIT = (((0, 7, 10), (15,), (9,)), ((0, 3, 10, 11), (), (15,)))  # a bar's kicks, soft kicks and soft snares (16ths), two bars about
# The dry bass: the 16th, half steps over the bar's bass note, how it's played (a note, a pop, a muted ghost). The
# last two notes creep by half steps into the next bar's.
RIFF = {
    "Am7": ((0, 0, "n"), (3, 0, "g"), (6, 10, "n"), (7, 12, "p"), (10, 0, "n"), (13, 3, "n"), (15, 2, "n")),
    "Bb9": ((0, 0, "n"), (3, 0, "g"), (6, 10, "n"), (7, 12, "p"), (10, 0, "n"), (13, -3, "n"), (15, -2, "n")),
    "F9": ((0, 0, "n"), (3, 0, "g"), (6, 7, "n"), (7, 12, "p"), (10, 0, "n"), (11, 0, "g"), (14, 10, "n")),
    "E7": ((0, 0, "n"), (3, 12, "p"), (6, 0, "n")),
}
JAB = {"Am7": (2, 9), "Bb9": (2, 9, 12), "F9": (2, 9), "E7": (2,)}  # where the organ's short chords fall in a dry bar
HITS = ((0, 3, 6), (0, 4, 7))  # the short chords and the bass together (16ths); the whistle hops in the rest of the bar
FUNK = ((0, 0, "n"), (3, 12, "p"), (6, 0, "n"), (7, 0, "g"), (10, 7, "n"), (11, 12, "p"), (14, 0, "n"))  # the watering's bass
LADDER = (0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28)  # the vine: half steps over the bar's bass note; a note taller each time

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two, .25 a 16th. ----
# His first words, over the strut.
HOOK = "-:4 | -:1.5 C5:.5 Ab5:2 | -:4 | -:.5 D5:.5 F5:.5 Ab5:.5 C6:1 Bb5:.5 Ab5:.5"
# His tune, dry: quick words and air; a crawl up; a long note that floats down in threes; an octave jump.
DRY = (
    "-:1 E5:.25 E5:.25 G5:.5 A5:1.5 -:.5 | -:.5 Ab5:.5 F5:.25 D5:.25 F5:1 -:1.5 | C5:.5 D5:.5 Eb5:.5 E5:1.5 G5:.5 A5:.5 | "
    "Bb5:2 Ab5:2/3 F5:2/3 D5:2/3 | -:.5 A4:.5 A5:1.5 G5:.5 E5:.5 G5:.5 | F5:.25 F5:.25 Ab5:.5 C6:1.5 -:1.5 | "
    "Eb5:1 C5:.5 A4:.5 C5:.5 Eb5:.5 G5:1 | G#5:1.5 E5:.5 -:2"
)
# The square's answers in the gaps.
DRY_ANS = "-:4 | -:2.75 C6:.25 D6:.5 -:.5 | -:4 | -:4 | -:4 | -:2.5 F6:.25 D6:.25 C6:.5 -:.5 | -:4 | -:2.5 E6:.25 D6:.25 B5:.25 G#5:.25 -:.5"
# The tune in bloom (the whistle): three bars, three bars and two.
BLOOM = (
    "C#5:.5 E5:.5 F#5:1.5 E5:.5 C#5:1 | B4:1.5 B4:2/3 C#5:2/3 E5:2/3 G#5:.5 | A5:2.5 F#5:.5 E5:.5 C#5:.5 | "
    "D5:.5 F#5:.5 A5:1.5 B5:.5 A5:1 | G#5:1.5 E5:.5 F#5:2/3 G#5:2/3 B5:2/3 | C#6:2 A5:.5 F#5:.5 E5:1 | "
    "D5:1 G5:.5 B5:1.5 A5:.5 G5:.5 | G#5:.75 B5:.75 E5:.5 F#5:.25 E5:.25 D5:.25 B4:.25 -:1"
)
FLICKS = (0, 12, 24)  # the beats of it whose note has a quick one from just below flicked in before it
# The whistle's hops between the short chords.
HOPS = "-:2 C#6:.25 A#5:.25 C#6:.5 E6:.5 -:.5 | -:2 D#6:.25 C#6:.25 A5:.5 F#5:.5 -:.5 | -:2 B5:.25 G#5:.25 B5:.5 D6:.5 -:.5 | -:1.5 C#6:.5 A5:.5 F#5:.5 E5:.5 C#5:.5"
# The night garden: the tune's first phrase at half the pace.
SLOW = "C#5:1 E5:1 F#5:3 E5:1 C#5:2 | B4:3 B4:4/3 C#5:4/3 E5:4/3 G#5:1 | A5:5 F#5:1 E5:1 C#5:1"
# The watering: his turns and the whistle's, two bars each, twice; then four bars together.
D_NASAL = (
    "E5:.5 A5:.5 C#6:1 A5:2/3 F#5:2/3 E5:2/3 | F#5:.25 A5:.25 F#5:.25 E5:.25 C#5:1 E5:.5 F#5:.5 A5:1 | -:8 | "
    "Ab5:.5 Db6:1.5 C6:.5 Ab5:.5 F5:1 | Eb5:.25 F5:.25 Ab5:.25 Bb5:.25 Ab5:1 F5:.5 Eb5:.5 Db5:1 | -:8 | "
    "A5:1.5 C6:.5 F6:1 C6:1 | Ab5:1.5 Db6:.5 F6:1 Db6:1 | E5:.5 A5:.5 C#6:1 B5:.5 A5:.5 E5:1 | D5:1 F5:1 G5:1 -:1"
)
D_WHISTLE = (
    "-:8 | C5:.5 F5:.5 A5:1 G5:.5 F5:.5 C5:1 | A5:2/3 G5:2/3 F5:2/3 C6:1 A5:.25 G5:.25 F5:.25 C5:.25 | -:8 | "
    "C#5:.5 E5:.5 A5:1.5 B5:.5 C#6:1 | E6:1 C#6:.5 A5:.5 F#5:2/3 E5:2/3 C#5:2/3 | "
    "F5:1.5 A5:.5 C6:1 A5:1 | F5:1.5 Ab5:.5 Db6:1 Ab5:1 | C#5:.5 E5:.5 A5:1 G#5:.5 E5:.5 C#5:1 | B4:1 D5:1 F5:1 -:1"
)
TAG = "E5:.5 G#5:.5 B5:1 -:2"
for _line, _beats in ((HOOK, 16), (DRY, 32), (DRY_ANS, 32), (BLOOM, 32), (HOPS, 16), (SLOW, 24), (D_NASAL, 48), (D_WHISTLE, 48), (TAG, 4)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
last4 = lambda text: " | ".join(text.split("|")[4:])
# His talk's vowels: each one's two formants (Hz), as the game has them.
VOWEL = {"ee": (366, 2806), "ih": (512, 2379), "eh": (683, 2196), "ah": (927, 1586), "oo": (415, 1000)}


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that
    passage (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=191, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(57)
    sr = x.sr
    tau = 2 * np.pi
    sw = lambda i: (i + (SWING if i % 2 else 0)) / 4  # a 16th of the bar, in beats, swung

    def sway(b):
        """A line's note that starts on an off 16th starts late, as the kit's do."""
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

    def crunch(w, rate=11000, steps=24):
        """A sampled drum as the old console played it: few samples a second, few levels."""
        hold = max(1, int(sr / rate))
        return np.round(np.repeat(w[::hold], hold)[: len(w)] * steps) / steps

    def chord(name):
        name, _, shift = name.partition("+")
        low, keys, sky = GARDEN[name]
        up = int(shift or 0)
        return [n(c) + up for c in low.split()], [n(c) + up for c in keys.split()], [n(c) + up for c in sky.split()]

    of = lambda bar: chord(CHORDS[(bar - 1) % BARS])
    plain = lambda bar: CHORDS[bar - 1].partition("+")[0]

    # ---- the kit: a console's sampled drums ----
    def kick(b, vol=0.5):
        k = int(0.26 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(48 + 110 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.1)) + 0.3 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.24, ghost=False):
        k = int((0.07 if ghost else 0.2) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(190 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.04)
        put("snare", b, crunch(0.8 * body + 0.9 * hiss(k, 8000, 0.5) * np.exp(-t / (0.02 if ghost else 0.075))) * tail(k) * vol, 0.05)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        k = int((0.18 if open_ else 0.04) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / (0.06 if open_ else 0.01)) * tail(k, 0.004) * vol, pan)

    def fill(b, count=4, vol=0.1):
        for i in range(count):
            snare(b + sw(i) if count == 4 else b + i / count, vol + 0.03 * i)

    # ---- his sounds, as the game builds them (packages/app/src/characters/gardener-sounds.ts) ----
    def step(b, vol=0.5):
        """One of his heavy steps: a low thump, the ground giving a little."""
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        put("kick", b, (np.sin(tau * np.cumsum(42 + 60 * np.exp(-t / 0.03)) / sr) + 0.6 * murk(k, 300) * np.exp(-t / 0.05)) * np.exp(-t / 0.11) * tail(k) * vol)

    def whiff(b, vol=0.03, pan=-0.3):
        """A seed tossed: a quiet puff of air."""
        k = int(0.24 * sr)
        u = np.linspace(0, 1, k)
        put("seed", b, murk(k, 1600) * np.sin(np.pi * u) ** 2 * vol, pan)

    def plip(b, vol=0.05, pan=0.0):
        """A seed landing: a soft plip, the soil's small pat under it."""
        k = int(0.16 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(1150 - 600 * np.exp(-t / 0.012)) / sr
        put("seed", b, (np.sin(ph) * np.exp(-t / 0.03) + 0.5 * murk(k, 350) * np.exp(-t / 0.02)) * np.minimum(1, t / 0.001) * tail(k) * vol, pan)

    def seed(bar, vol=1.0):
        whiff(bar0(bar) - 0.75 if bar > 1 else BEATS - 0.75, 0.03 * vol), plip(bar0(bar), 0.05 * vol)

    def creak(b, vol=0.04, pan=-0.3):
        """The hose hauled: a rubbery creak, sticking and slipping."""
        secs = 0.7
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(190 + 90 * u + 25 * np.sin(tau * 3.1 * t)) / sr
        w = sum(np.sin(h * ph) / h for h in range(1, 7))
        put("fx", b, w * (0.55 + 0.45 * np.sign(np.sin(tau * 27 * t))) * np.sin(np.pi * u) ** 0.7 * vol, pan)

    def spray(b, length, vol=0.05, rise=1.5, sweep=None):
        """The hose's hiss over `length` beats, swelling to its end (`rise`: how late; none: it swells and dies away);
        `sweep` (from, to): it crosses from side to side."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        w = (hiss(k, 14000, 0.7) + 0.5 * hiss(k, 6000, 0.4)) * (u**rise * np.minimum(1, (1 - u) * 30) if rise else np.sin(np.pi * u) ** 1.2) * vol
        if sweep is None:
            put("fx", b, w)
        else:
            side = 0.5 + 0.5 * (sweep[0] + (sweep[1] - sweep[0]) * u)  # 0 left, 1 right
            put("fx", b, w * (1 - side) * 1.4, -1.0), put("fx", b, w * side * 1.4, 1.0)

    def pop(b, m, vol=0.05, pan=0.0, late=0.0):
        """A bud's bright little pop."""
        k = int(0.07 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (-9 * np.exp(-t / 0.008) / 12)) / sr
        put("pops", b, np.sin(ph) * np.exp(-t / 0.022) * np.minimum(1, t / 0.001) * tail(k) * vol, pan, late=late)

    def sprout(b, ms, vol=0.05, pan=0.3):
        """Something coming up: pops, a 32nd apart, climbing."""
        for i, m in enumerate(ms):
            pop(b + i / 8, m, vol * (0.6 + 0.4 * i / max(1, len(ms) - 1)), pan * (1 - 2 * i / max(1, len(ms) - 1)))

    def snap(b, vol=0.3):
        """The killer plant's jaws."""
        k = int(0.09 * sr)
        t = np.arange(k) / sr
        put("fx", b, (hiss(k, 6000, 0.3) * np.exp(-t / 0.006) + 0.6 * np.sin(tau * 1800 * t) * np.exp(-t / 0.004) + 0.5 * np.sin(tau * 320 * t) * np.exp(-t / 0.02)) * tail(k) * vol)

    def gulp(b, vol=0.2):
        """And its gulp: a low note swallowed, twice."""
        for late, f0, f1, secs in ((0.0, 260, 120, 0.13), (0.15, 170, 80, 0.18)):
            k = int(secs * sr)
            u = np.linspace(0, 1, k)
            ph = tau * np.cumsum(f0 * (f1 / f0) ** u) / sr
            put("fx", b, (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.sin(np.pi * u) ** 0.6 * vol, 0.0, late=late)

    def sparkle(b, ms, vol=0.035):
        """The queen's bloom: a run of small bells."""
        for i, m in enumerate(ms):
            at(b + i / 6, 1.5)
            put("pops", b + i / 6, x.bell(m, 1.5, vol, ratio=3.5, index=1.6, decay=0.3), 0.6 * np.sin(1.9 * i))

    def talk(b, said, pitch=1.0, lift=0.15, fall=0.2, vol=0.035, pan=0.25, pace=1.0):
        """What he says: quick made-up syllables, each a bright buzz through its vowel's two formants, a small click on
        its front; the line rises in the middle and drops on the last."""
        late = 0.0
        for i, v in enumerate(said):
            secs = 0.085 * pace
            k = int(secs * sr)
            u = np.linspace(0, 1, k)
            t = np.arange(k) / sr
            f0 = 370 * pitch * (1 + lift * np.sin(np.pi * i / max(1, len(said) - 1))) * (1 - fall if i == len(said) - 1 else 1) * (1 + 0.06 * np.sin(np.pi * u))
            ph = tau * np.cumsum(f0) / sr
            w = np.zeros(k)
            for h in range(1, 15):
                fh = h * f0
                w += np.sin(h * ph) / np.sqrt(h) * sum(1 / np.sqrt(1 + ((fh - f) / width) ** 2) for f, width in zip(VOWEL[v], (130, 240)))
            w = w / 3 + 0.25 * hiss(k, 7000, 0.5) * np.exp(-t / 0.002)
            put("talk", b, w * np.sin(np.pi * u) ** 0.6 * vol, pan, late=late)
            late += secs + 0.025 * pace

    # ---- the band's voices ----
    def pluck(b, m, long=0.25, kind="n", vol=0.4, hold=0.1):
        """The FM bass: plucked, bright only on its front, dead at once (`hold`: what's left of it while it's held: more
        on watered ground). A pop is brighter; a ghost is a muted thud with hardly a note."""
        at(b, long)
        k = x.k(long) + int(0.03 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        if kind == "g":
            w = (0.6 * np.sin(ph) + 0.5 * murk(k, 900)) * np.exp(-t / 0.02)
        else:
            w = np.sin(ph + ((4.5 if kind == "p" else 3.0) * np.exp(-t / 0.045) + 0.6) * np.sin(ph)) * (hold + (1 - hold) * np.exp(-t / 0.09))
        put("bass", b, w * np.minimum(1, t / 0.001) * tail(k, 0.03) * vol)

    def sub(b, m, length, vol=0.5):
        """A deep kick with a note in it, for the watering."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env) * vol)

    def wobble(b, m, length, vol=0.2):
        """The hose bucking: a low buzz whose brightness swings three times a beat."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        f = x.hz(m)
        ph = tau * f * t
        cut = 180 + 800 * (0.5 - 0.5 * np.cos(tau * 3 / x.beat_s * t))
        w = sum(np.sin(h * ph) / h / np.sqrt(1 + (h * f / cut) ** 4) for h in range(1, 15))
        put("sub", b, w * np.minimum(1, t / 0.01) * tail(k, 0.04) * vol)

    REED = (1, 0.1, 0.55, 0.08, 0.3, 0.05, 0.15)  # a reed organ: the odd harmonics

    def jab(b, ms, vol=0.05, pan=-0.2):
        """The reed organ's short chord: an 80 ms note, cut off."""
        k = int(0.092 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for m in ms:
            ph = tau * x.hz(m) * t
            w += sum(a * np.sin((h + 1) * ph + 0.7 * h) for h, a in enumerate(REED))
        put("organ", b, w / len(ms) * (0.75 + 0.25 * np.exp(-t / 0.03)) * np.minimum(1, t / 0.002) * tail(k, 0.012) * vol, pan)

    def held(bar, vol=0.03, length=4.0, up=0):
        """The reed organ holding the bar's chord: two reeds a hair apart, a slow wobble."""
        at(bar0(bar), length)
        for j, m in enumerate(of(bar)[1]):
            put("pad", bar0(bar), x.tone(m + up, length * 0.97, list(REED), vol, detune=(-7, 7), attack=0.04, release=0.12, trem=0.1, trem_hz=5.0), (-0.5, -0.15, 0.15, 0.5)[j])

    def strings(bar, vol=0.03, length=4.0):
        at(bar0(bar), length)
        for j, m in enumerate(of(bar)[1][1:]):
            put("pad", bar0(bar), x.strings(m + 12, length, vol, attack=0.4, release=0.5), (-0.45, 0.0, 0.45)[j])

    def nasal(start, text, vol=1.0, pan=-0.1, up=0):
        """Puddles: a narrow pulse through a nose (two bands, about 1.1 and 2.5 kHz, ring over its harmonics). A
        phrase's first note scoops up into place from three half steps under; a long note wavers once it has settled."""
        free = -1.0
        for b, d, m in notes(start, text):
            b, d = sway(b), float(d)
            at(b, d)
            f0 = x.hz(m + up)
            harm = [abs(np.sin(np.pi * h * 0.2)) / h * (0.45 + 1.5 * np.exp(-(((h * f0 - 1100) / 450) ** 2)) + 0.6 * np.exp(-(((h * f0 - 2500) / 600) ** 2)))
                    for h in range(1, max(2, int(6000 / f0)) + 1)]
            first, long = b > free + 0.3, d >= 1.0
            w = x.tone(m + up, d * 0.92, harm, 1.0, vib=0.0145 if long else 0.0, vib_hz=6.5, scoop=3.0 if first else 1.0 if long else 0.0, scoop_s=0.03,
                       attack=0.008, release=0.02)
            put("nasal", b, np.tanh(0.8 * w / np.sqrt(sum(a * a for a in harm))) * 0.2 * vol, pan)
            free = b + d

    def whistled(start, text, vol=1.0, pan=0.2, up=0, flicks=()):
        """The whistle: a square wave, a soft flute an octave under it. `flicks`: the beats (from `start`) whose note
        has a quick one from a half step below flicked in just before it."""
        for b, d, m in notes(start, text):
            first = any(abs(float(b) - start - f) < 1e-6 for f in flicks)
            b, d = sway(b), float(d)
            if first:
                at(b - 0.125, 0.125)
                put("whistle", b - 0.125, x.pulse(m + up - 1, 0.11, 0.5, 0.075 * vol, decay=0.1, sustain=0.7, release=0.004), pan)
            at(b, d)
            put("whistle", b, x.pulse(m + up, d * 0.9, 0.5, 0.085 * vol, vib=0.008 if d >= 1.0 else 0.0, attack=0.005, decay=0.15, sustain=0.6, release=0.012), pan)
            put("whistle", b, x.flute(m + up - 12, d * 0.9, 0.1 * vol), -pan)

    def squared(start, text, vol=1.0, pan=0.3, up=0):
        for b, d, m in notes(start, text):
            b, d = sway(b), float(d)
            at(b, d)
            put("square", b, x.chip(m + up, d * 0.9, 0.13 * vol), pan)

    def sung(start, text, vol=0.06, pan=0.15):
        for b, d, m in notes(start, text):
            at(float(b), float(d))
            put("flute", float(b), x.ocarina(m, float(d) * 0.98, vol), pan)

    def drip(b, m, vol=0.04, pan=0.0):
        """A drop of water with a note in it: it rises into its pitch as it falls."""
        k = int(0.14 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (-5 * np.exp(-t / 0.012) / 12)) / sr
        put("drips", b, np.sin(ph) * np.exp(-t / 0.045) * np.minimum(1, t / 0.002) * tail(k) * vol, pan)

    # ---- the band, bar by bar ----
    def strut(bar, vol=1.0, ghosts=True, opens=False):
        """The kit's bar: the kick's pattern (two bars about), the snare on 2 and 4, closed hats on the 8ths; `ghosts`:
        the soft kicks, snares and 16th hats between; `opens`: an open hat on the last 8th."""
        b = bar0(bar)
        kicks, soft, taps = KIT[bar % 2]
        for i in kicks:
            kick(b + sw(i), 0.5 * vol)
        snare(b + 1, 0.24 * vol), snare(b + 3, 0.24 * vol)
        for i in range(8):
            hat(b + i * 0.5, (0.034 if i % 2 == 0 else 0.022) * vol, open_=opens and i == 7)
        if ghosts:
            for i in soft:
                kick(b + sw(i), 0.26 * vol)
            for i in taps:
                snare(b + sw(i), 0.07 * vol, ghost=True)
            for i in (3, 11):
                hat(b + sw(i), 0.012 * vol)

    def vamp(bar, vol=1.0, jabs=True):
        """A dry bar: the bass's riff and the organ's short chords, air between them."""
        b = bar0(bar)
        low, keys, _ = of(bar)
        for i, over, kind in RIFF[plain(bar)]:
            pluck(b + sw(i), low[0] + 12 + over, 0.22, kind, 0.42 * vol)
        if jabs:
            for i in JAB[plain(bar)]:
                jab(b + sw(i), keys, 0.05 * vol)

    def climbing(bar, vol=1.0):
        """The bass on watered ground: the bar's note, held; its other note; a pop; and the bar's note again, leaning
        on the next bar's (a step up)."""
        b = bar0(bar)
        low = of(bar)[0]
        pluck(b, low[0] + 12, 1.4, "n", 0.42 * vol, 0.5), pluck(b + sw(6), low[1] + 12, 0.45, "n", 0.36 * vol, 0.4)
        pluck(b + 2, low[0] + 24, 0.3, "p", 0.3 * vol), pluck(b + sw(11), low[1] + 12, 0.2, "g", 0.3 * vol), pluck(b + sw(14), low[0] + 12, 0.45, "n", 0.38 * vol, 0.4)

    def drizzle(bar, vol=1.0, keep=1):
        """Water dripping: a drop on every 16th (`keep` 2: every 8th), coming back to the note that never moves."""
        b = bar0(bar)
        sky = of(bar)[2]
        for i in range(0, 16, keep):
            drip(b + sw(i), sky[DRIP[i]], 0.04 * vol * rng.uniform(0.6, 1.0) * (1.25 if i % 4 == 0 else 1.0), 0.6 * np.sin(1.7 * i + bar))

    def sprinkle(bar, vol=1.0):
        """The sprinkler: a tick on every 16th, crossing from left to right over two bars, and flicking back in the
        last beat (twelve quick ticks)."""
        b = bar0(bar)
        second = bar % 2 == 1

        def tick(beat, pan, loud):
            k = int(0.02 * sr)
            t = np.arange(k) / sr
            put("sprink", beat, hiss(k, 10000, 0.8) * np.exp(-t / 0.004) * tail(k, 0.003) * loud, pan)

        for i in range(12 if second else 16):
            j = i + (16 if second else 0)
            tick(b + sw(i), -0.8 + 1.6 * j / 27, 0.022 * vol)
        if second:
            for i in range(12):
                tick(b + 3 + i / 12, 0.8 - 1.6 * i / 11, 0.014 * vol)

    def hits(bar, vol=1.0):
        """The short chords and the bass together, off the beat; the kick with each."""
        b = bar0(bar)
        low, keys, _ = of(bar)
        for i in HITS[bar % 2]:
            jab(b + sw(i), keys, 0.06 * vol), jab(b + sw(i), [m + 12 for m in keys[1:]], 0.035 * vol, 0.2)
            pluck(b + sw(i), low[0] + 12, 0.22, "n", 0.44 * vol)

    def watered(bar, vol=1.0):
        """A bar in bloom: the whole kit, the bass climbing, the organ holding the chord, the drips, the sprinkler."""
        strut(bar, vol, opens=True), climbing(bar, vol), held(bar, 0.03 * vol), drizzle(bar, vol), sprinkle(bar, vol)

    # Bar 1: a seed; he says hello; two heavy steps. Bars 2-5: the dry strut (the kit without its ghosts), his first words.
    for bar in SEEDS:
        seed(bar)
    talk(bar0(1) + 1.25, ("eh", "oo", "ee"), 1.0, 0.2, 0.1)
    step(bar0(1) + 2, 0.4), step(bar0(1) + 3, 0.5), hat(bar0(1) + 3.5, 0.03)
    for bar in range(2, 6):
        strut(bar, 0.9, ghosts=False), vamp(bar, jabs=bar >= 4)
    nasal(bar0(2), HOOK)

    # Bars 6-13: his tune, dry; the square answers in the gaps. The last bar: the band stops halfway, clouds roll in
    # (the hose's hiss rising), a drop falls.
    for bar in range(6, 13):
        strut(bar), vamp(bar)
    vamp(13), kick(bar0(13), 0.5), snare(bar0(13) + 1, 0.24), hat(bar0(13), 0.034), hat(bar0(13) + 0.5, 0.022), hat(bar0(13) + 1, 0.034)
    nasal(bar0(6), DRY), squared(bar0(6), DRY_ANS, 0.8)
    spray(bar0(13) + 1.5, 2.5, 0.05, 2.0), drip(bar0(13) + 3, n("E6"), 0.07, 0.3), drip(bar0(13) + 3.5, n("E5"), 0.05, -0.3)

    # Bars 14-21: the garden in bloom. The whistle's tune over held chords, the bass climbing a step a bar.
    x.crash(bar0(14), 0.14, decay=0.5)
    for bar in range(14, 22):
        watered(bar)
    whistled(bar0(14), BLOOM, flicks=FLICKS)
    sprout(bar0(17) + 3.5, of(17)[2][:4], 0.04), sprout(bar0(21) + 3, of(21)[2], 0.045, -0.3)

    # Bars 22-26: the short chords and the bass together, the whistle hopping between them; dry again. The last bar:
    # two hits, then air.
    for bar in range(22, 26):
        strut(bar), hits(bar)
    hits(26), kick(bar0(26), 0.5), snare(bar0(26) + 1, 0.24), hat(bar0(26), 0.034), hat(bar0(26) + 0.5, 0.022), hat(bar0(26) + 1, 0.034)
    whistled(bar0(22), HOPS, 0.9)

    # Bars 27-33: the garden at night (the calm). No kit: strings on D (and on E over it, its raised fourth), the bass's one low
    # note a bar, the drips at half their pace; the ocarina has the tune's first phrase, slowly; things come up; he
    # hums to them ("let it grow"). The last bar: he hauls the hose.
    for bar in range(27, 34):
        strings(bar, 0.036), drizzle(bar, 0.8, keep=2)
        pluck(bar0(bar), of(bar)[0][0] + 12, 3.0, "n", 0.22, 0.45)
    sung(bar0(27), SLOW)
    sprout(bar0(29) + 2.5, of(29)[2][1:4], 0.03), sprout(bar0(31) + 3, of(31)[2][:4], 0.03, -0.3)
    talk(bar0(33) + 0.5, ("oo", "ah", "ee"), 0.9, 0.1, 0.25, 0.03, 0.25, 1.6)
    creak(bar0(33) + 2.5)

    # Bars 34-39: the build. The chords climb by whole steps, an octave in six bars; the vine on the square grows a
    # note taller each time round (3 notes to 13: five and a half bars of 16ths); the bass and his steps quicken; the
    # hose's hiss swells. Then a hush of two beats: "watering time!"
    for j, bar in enumerate(range(34, 40)):
        b = bar0(bar)
        low = of(bar)[0]
        held(bar, 0.02 + 0.004 * j, 4.0 if bar < 39 else 2.0)
        per = (1, 1, 2, 2, 4, 4)[j]
        for i in range(4 * per if bar < 39 else 2 * per):
            pluck(b + i / per, low[0] + 12, 0.8 / per, "n", 0.3 + 0.02 * j, 0.3)
        for i in range((2, 4, 4, 4, 8, 4)[j]):
            step(b + i * (4 / (2, 4, 4, 4, 8, 8)[j]), 0.36 + 0.03 * j)
        if j >= 2 and bar < 39:
            snare(b + 1, 0.16 + 0.02 * j), snare(b + 3, 0.16 + 0.02 * j)
        for i in range(8 if bar < 39 else 4):
            hat(b + i * 0.5, 0.02 + 0.003 * j)
    at_16th = 0
    for size in range(3, 14):
        for i in range(size):
            b = bar0(34) + (at_16th // 16) * 4 + sw(at_16th % 16)
            at(b, 0.25)
            put("square", b, x.chip(of(34 + at_16th // 16)[0][0] + 24 + LADDER[i], 0.21, 0.07 + 0.006 * size + (0.02 if i == size - 1 else 0)), 0.5 * np.sin(0.8 * i))
            at_16th += 1
    assert at_16th == 88
    creak(bar0(35) + 2, 0.035, 0.3), spray(bar0(34), 22, 0.06, 1.6)
    fill(bar0(39) + 1, 8, 0.08)
    talk(bar0(39) + 2.25, ("ah", "ee", "ih", "ee"), 1.1, 0.25, 0.0, 0.045)
    spray(bar0(39) + 3, 1.0, 0.09, 2.5)

    # Bars 40-51: the watering (the drop). The whole kit and a deep kick under it, the bass's funk, the organ's short
    # chords on every off-beat, the drips, the sprinkler, the hose sweeping across every two bars. He and the whistle
    # trade two bars each, twice (something comes up at the end of each turn; the chords a major third apart); then
    # both together, the organ holding the chords, the hose bucking.
    x.crash(bar0(40), 0.2, decay=0.6)
    for bar in range(40, 52):
        b = bar0(bar)
        low, keys, sky = of(bar)
        both = bar >= 48
        strut(bar, 1.1, opens=True)
        sub(b, low[0] + 12, 1.5, 0.45), sub(b + 2.5, low[0] + 12, 1.0, 0.34)
        for i, over, kind in FUNK:
            pluck(b + sw(i), low[0] + 12 + over, 0.22, kind, 0.42)
        for i in (2, 6, 10, 14):
            jab(b + sw(i), keys, 0.05)
        drizzle(bar, 1.0), sprinkle(bar, 1.0)
        if bar % 2 == 0:
            spray(b, 8, 0.03, None, (-0.9, 0.9) if bar % 4 == 0 else (0.9, -0.9))
        if both:
            held(bar, 0.028), wobble(b, low[0] + 12, 4.0, 0.16)
        elif bar % 2 == 1:
            sprout(b + 3.5, sky[:4] if bar % 4 == 1 else sky[1:], 0.05, 0.4 if bar % 4 == 1 else -0.4)
    nasal(bar0(40), D_NASAL), whistled(bar0(40), D_WHISTLE)
    x.crash(bar0(48), 0.18, decay=0.6)
    fill(bar0(51) + 3, 4, 0.12)

    # Bar 52: the killer plant. A snap, a gulp, silence; he says "uh-oh"; a drop falls.
    snap(bar0(52), 0.15), kick(bar0(52), 0.55), gulp(bar0(52) + 0.75, 0.14)
    talk(bar0(52) + 2, ("ah", "oo"), 0.95, 0.0, 0.3, 0.04, 0.25, 1.4)
    drip(bar0(52) + 3.5, n("G5"), 0.06, -0.3)

    # Bars 53-60: the prize bloom: the tune a minor third up, in C. He joins the whistle an octave under it for its
    # last four bars; a deep kick under each bar; the queen's sparkle as it opens.
    x.crash(bar0(53), 0.2, decay=0.6)
    sparkle(bar0(53), [n(c) for c in "G6 C7 E7 G7 E7 C7".split()])
    for bar in range(53, 61):
        watered(bar)
        sub(bar0(bar), of(bar)[0][0] + 12, 1.5, 0.36)
    whistled(bar0(53), BLOOM, up=3, flicks=FLICKS), nasal(bar0(57), last4(BLOOM), 0.75, up=3 - 12)
    sprout(bar0(56) + 3.5, of(56)[2][:4], 0.04), sprout(bar0(60) + 3, of(60)[2], 0.045, -0.3)

    # Bars 61-64: the short chords again, higher. Bar 65: the turn home (two hits on E, his last word, air): the next
    # seed is tossed, and lands as the loop comes round.
    for bar in range(61, 65):
        strut(bar), hits(bar)
    whistled(bar0(61), HOPS, 0.9, up=3)
    b = bar0(65)
    low, keys, _ = of(65)
    for i in (0, 3):
        jab(b + sw(i), keys, 0.06), pluck(b + sw(i), low[0] + 12, 0.22, "n", 0.44), kick(b + sw(i), 0.5)
    snare(b + 1, 0.24), hat(b, 0.034), hat(b + 0.5, 0.022), hat(b + 1, 0.034)
    nasal(b, TAG, 0.9)

    # Watered ground rings; dry ground doesn't: a room for the held chords, the whistle, the ocarina, the drips and
    # the things that come up, and none for the bass, the kit, the short chords or his voice.
    def room(name, secs=1.6, wet=0.3):
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.02)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 4500) ** 2) * (f > 150), n=size, axis=1)

    x.beat_s = 60 / BPM
    x.echo("whistle", 0.75, 0.16, 0.07), x.echo("drips", 0.75, 0.25, 0.1), x.echo("pops", 0.75, 0.22, 0.1)
    for name, secs, wet in (("pad", 1.6, 0.3), ("whistle", 1.6, 0.3), ("flute", 2.2, 0.45), ("drips", 1.6, 0.4), ("pops", 1.8, 0.45)):
        room(name, secs, wet)
    levels = {"nasal": 1.2, "whistle": 1.15, "square": 1.0, "flute": 1.8, "bass": 0.8, "sub": 0.5, "kick": 0.7, "snare": 2.0, "hats": 6.0, "drum": 1.5,
              "organ": 5.0, "pad": 1.7, "drips": 2.4, "sprink": 6.0, "fx": 2.0, "seed": 4.0, "talk": 5.0, "pops": 3.0}
    return x.play(x.mixdown(levels, lowpass=8500, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
