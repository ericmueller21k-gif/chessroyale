"""Song AD (Eric, Nov 14): the town's theme, a loop of three minutes. "We got to tackle the big issue here ... make a
theme, a town theme ... it's going to need to be about 3 minutes ... the goal is it's a song where people literally
are like, I want to turn this song on while I'm in the chess town because it's so good."
He sent a write-up of a style, made from another game's playground tune (a 1920s bandstand stroll), and of what would
wear on the ear over three minutes. What is used from it is the style's own means and its cautions, none of them one
song's: a strolling pace (about 107 beats a minute) with the 8ths swung a little; no drum kit: a plucked upright bass
on 1 and 3, soft chords on 2 and 4, a brush, a wood block; warm, rounded voices that hand the tune to one another
(a clarinet, an accordion, a soft piano, a guitar); ragtime's kind of chords (a chord borrowed from the minor, a
chord a fifth above the one it leads to); no tune over the staff's top space but in the one lifted passage, no whistles or slides, nothing
shrill; and several places in one walk, with a quiet one in the middle, so the three minutes are never one half
minute six times.
What is not used: the write-up's chord progressions (its stroll's eight bars, its bridge, its duet's circle), its
key, or any tune of it. The tune itself was not listened to, measured or transcribed, and every melody, riff and
chord progression here is original: none of it is any song's or any game's.
Two changes from its list of voices, for Eric's ear (SOUNDS.md): where it has a horn take the slow tune, an ocarina
does (he has turned down a brass lead three times and picked the ocarina himself); and the quiet part has the soft
piano and the music box he likes.
The idea from the game: a pawn's walk. The tune goes by step, as a pawn does; the bass walks down a step a bar under a
D that never moves (G, F sharp, F, E, E flat, D: the E flat bar is the chord borrowed from the minor, the walk's one
wistful step); the tune is handed from voice to voice as the walk passes the square, the gazebo and the cafe; and near
the end the pawn reaches the far side and is promoted: the tune a minor third up, everyone together, before it comes
home. A wood block's knock is a piece set down.
G major; 80 bars of four, 180.0 s.
  python3 song_ad.py <out.wav> [the main tune: a or b]

  bars  1-4    0:00  the stroll starts: the bass, the chords, a brush
  bars  5-12   0:09  the square: the tune on the clarinet
  bars 13-20   0:27  again on the accordion, the clarinet's long notes under it
  bars 21-28   0:45  the gazebo: a slow tune on the ocarina over the piano's rolling chords, the bass walking
  bars 29-36   1:03  the square again: the clarinet and the accordion together
  bars 37-52   1:21  the cafe (the quiet part): the tune's pieces on the soft piano over a guitar, then on the guitar,
                     a music box far off; in E minor
  bars 53-60   1:57  a conversation: the clarinet and the accordion trade two bars each
  bars 61-68   2:15  promoted: the tune a minor third up, everyone
  bars 69-76   2:33  home: the tune once more, softer, the accordion's
  bars 77-80   2:51  the stroll alone again, for the way round
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BARS = 80
BEATS = 4 * BARS
TAPE = 180.0  # 106.67 beats a minute
SWING = 0.08  # an off 8th is this much of a beat late
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, 106.67, 106.67, 1.0, 1.0, 0.0)]

# A bar's chord (two with a comma: half a bar each); "/X": the bass's note. "+3" after it: a minor third up.
WALK = "G D/F# G7/F Cadd9/E Cmadd9/Eb G/D A9 D7"  # the tune's eight bars: the bass steps down under the D
VAMP = "G Em7 Am7 D7"
GAZEBO = "Cmaj7 Bm7 Am7 D7/F# Cmaj7 Bm7,E7 Am7 D7"
CAFE = "Em9 Em/D Cmaj7 B7 Em9 Em/D C#m7b5 D7sus4,D7  Em9 Em/D Cmaj7 B7 Em9 A9 Am7/D D7"
TALK = "G B7 Em G7/D C A7/C# D7sus4 D7,F7"
CHORDS = (f"{VAMP}  {WALK}  {WALK}  {GAZEBO}  {WALK}  {CAFE}  {TALK}  " + " ".join(c + "+3" for c in WALK.split()[:7]) + " F7,D7  " + f"{WALK}  {VAMP}").split()
assert len(CHORDS) == BARS, len(CHORDS)
KINDS = {"": (0, 4, 7), "6": (0, 4, 7, 9), "maj7": (0, 4, 7, 11), "7": (0, 4, 7, 10), "9": (0, 4, 7, 10, 14), "add9": (0, 4, 7, 14), "m": (0, 3, 7),
         "m7": (0, 3, 7, 10), "m9": (0, 3, 7, 10, 14), "madd9": (0, 3, 7, 14), "m7b5": (0, 3, 6, 10), "7sus4": (0, 5, 7, 10)}

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two. ----
# The tune (three bars, three bars and two): up by step and down, twice, then up to a held note; a float down in
# threes; the wistful bar, climbing; a long sigh; a bright turn; home.
TUNE_A = (
    "B4:.5 C5:.5 D5:1 B4:.5 G4:1.5 | A4:.5 B4:.5 C5:1 A4:.5 F#4:1.5 | G4:.5 B4:.5 D5:1 E5:2 | "
    "E5:1 D5:2/3 C5:2/3 G4:2/3 E4:1 | Eb4:.5 G4:.5 C5:1.5 D5:.5 Eb5:1 | D5:2.5 B4:.5 G4:.5 A4:.5 | "
    "B4:.5 C#5:.5 E5:1 C#5:.5 B4:.5 A4:1 | C5:.5 A4:.5 F#4:1 D4:1 -:1"
)
# Another tune for the same bars (hops and rests where the first goes by step): to choose between.
TUNE_B = (
    "G4:.5 B4:.5 -:.5 D5:.5 E5:1 D5:.5 B4:.5 | A4:1.5 F#4:.5 A4:.5 B4:.5 D5:1 | D5:.5 B4:.5 -:.5 G4:.5 F4:1 A4:.5 B4:.5 | "
    "C5:1.5 E5:.5 D5:.5 C5:.5 G4:1 | Eb5:1.5 D5:.5 C5:.5 G4:.5 Eb4:1 | D4:.5 G4:.5 B4:.5 D5:2.5 | "
    "E5:.5 C#5:.5 -:.5 A4:.5 B4:.5 C#5:.5 E5:1 | D5:1 C5:.5 A4:.5 F#4:1 -:1"
)
# Under the tune the second time: the clarinet's long notes.
UNDER = "D4:4 | D4:4 | D4:2 F4:2 | E4:2 G4:2 | G4:4 | G4:2 B4:2 | G4:2 E4:2 | F#4:3 -:1"
# With the first tune, a third or so under it.
BESIDE = (
    "G4:.5 A4:.5 B4:1 G4:.5 D4:1.5 | F#4:.5 G4:.5 A4:1 F#4:.5 D4:1.5 | D4:.5 G4:.5 B4:1 B4:2 | "
    "C5:1 B4:2/3 G4:2/3 E4:2/3 C4:1 | C4:.5 Eb4:.5 G4:1.5 Bb4:.5 C5:1 | B4:2.5 G4:.5 D4:.5 F#4:.5 | "
    "G4:.5 A4:.5 C#5:1 A4:.5 G4:.5 E4:1 | A4:.5 F#4:.5 D4:1 A3:1 -:1"
)
# The gazebo: the ocarina's slow tune.
SLOW = "E5:3 D5:1 | D5:2 B4:1 A4:1 | C5:3 B4:.5 A4:.5 | A4:2 F#4:1 A4:1 | G4:1 B4:1 E5:2 | D5:2 G#4:1 B4:1 | C5:1.5 B4:.5 A4:1 E4:1 | F#4:2 A4:1 -:1"
# The cafe: the tune's pieces, with air between them: the piano's eight bars, then the guitar's.
CAFE_1 = (
    "-:1 B4:.5 C5:.5 D5:1 B4:1 | G4:2 -:2 | -:1 A4:.5 B4:.5 C5:1 A4:1 | F#4:2 D#4:1 -:1 | "
    "-:.5 E4:.5 G4:.5 B4:.5 D5:2 | E5:1 D5:2/3 B4:2/3 G4:2/3 E4:1 | G4:1.5 E4:.5 C#4:1 E4:1 | D4:2 F#4:1 A4:1"
)
CAFE_2 = (
    "B4:1.5 G4:.5 E4:1 -:1 | -:1 F#4:.5 G4:.5 A4:1 B4:1 | C5:2.5 B4:.5 G4:1 | A4:1 F#4:1 D#4:1 -:1 | "
    "-:.5 B4:.5 D5:.5 E5:.5 D5:1 B4:1 | C#5:1.5 B4:.5 A4:1 G4:1 | E4:1 G4:1 A4:1 C5:1 | B4:1.5 A4:.5 F#4:1 -:1"
)
# The conversation: the clarinet's two bars, the accordion's two, twice.
TALK_C = "D5:.5 B4:.5 G4:1 A4:.5 B4:.5 D5:1 | D#5:1.5 B4:.5 F#4:1 A4:1 | -:8 | E5:1 C5:.5 G4:.5 E4:1 G4:1 | A4:.5 C#5:.5 E5:1.5 C#5:.5 A4:1 | -:8"
TALK_A = "-:8 | G4:.5 B4:.5 E5:1.5 D5:.5 B4:1 | D5:1 B4:.5 G4:.5 F4:1 D4:1 | -:8 | G4:1 A4:1 C5:1 D5:1 | D5:.5 C5:.5 A4:1 C5:1 Eb5:1"
# The stroll's last bars: three notes of the tune, far off.
LAST = "-:8 | -:3 B4:.5 C5:.5 | D5:2 -:2"
PICKUP = {"a": "G4:.5 A4:.5", "b": "D4:.5 F#4:.5"}
# The lifted tune's last bar is F7 then D7 (the way home), so it has its own notes there, as written (not lifted).
HOME_A = "Eb5:.5 C5:.5 A4:1 F#4:1 -:1"
HOME_B = "F5:1 Eb5:.5 C5:.5 A4:1 -:1"
for _line, _beats in ((TUNE_A, 32), (TUNE_B, 32), (UNDER, 32), (BESIDE, 32), (SLOW, 32), (CAFE_1, 32), (CAFE_2, 32), (TALK_C, 32), (TALK_A, 32), (LAST, 16)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(tune: str = "a", window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `tune`: which main tune ("a" or "b"). `window`: (from
    beat, to beat), to make only that passage (a sample, to compare voices or tunes on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=233, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(89)
    sr = x.sr
    tau = 2 * np.pi
    TUNE = {"a": TUNE_A, "b": TUNE_B}[tune]
    seven = lambda text: " | ".join(text.split(" | ")[:7])  # a line's first seven bars

    def sway(b):
        """A note that starts on an off 8th starts a little late: the stroll's swing."""
        q = float(b) * 2
        return float(b) + SWING if abs(q - round(q)) < 1e-6 and round(q) % 2 else float(b)

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
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

    def chord(name):
        """A chord: its bass note (D2 to D flat 3; the note after a slash if it has one), and a way to its notes
        between two pitches."""
        name, _, shift = name.partition("+")
        up = int(shift or 0)
        name, _, under = name.partition("/")
        pitch = lambda text: {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[text[0]] + {"b": -1, "#": 1}.get(text[1:2], 0)
        pc = pitch(name) + up
        pcs = [(pc + i) % 12 for i in KINDS[name[1 + (name[1:2] in ("b", "#")):]]]
        return 38 + (pitch(under or name) + up - 2) % 12, lambda lo, hi: [m for m in range(lo, hi + 1) if m % 12 in pcs]

    def halves(bar):
        """The bar's chords: one for the whole bar, or one for each half."""
        names = CHORDS[(bar - 1) % BARS].split(",")
        if "+" in CHORDS[(bar - 1) % BARS] and len(names) == 1:
            return [chord(names[0])]
        return [chord(nm) for nm in names]

    of = lambda bar, beat=0.0: halves(bar)[-1 if beat >= 2 else 0]

    # ---- the stroll: an upright bass, chords, a brush, a wood block ----
    def bass(b, m, long=1.0, vol=0.4):
        """An upright bass, plucked: a round note that drops into its pitch and dies in half a second, a finger's thump on
        it. Its second to fifth harmonics are strong, as a real one's are: they are what a phone's speaker plays of it."""
        at(b, long)
        k = x.k(long) + int(0.05 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (0.4 * np.exp(-t / 0.012) / 12)) / sr
        w = np.sin(ph) + 0.55 * np.sin(2 * ph) * np.exp(-t / 0.4) + 0.32 * np.sin(3 * ph) * np.exp(-t / 0.28) + 0.16 * np.sin(4 * ph) * np.exp(-t / 0.16) + 0.08 * np.sin(5 * ph) * np.exp(-t / 0.1)
        put("bass", b, (w * np.minimum(1, t / 0.004) * np.exp(-t / 0.45) + 0.25 * murk(k, 600) * np.exp(-t / 0.012)) * tail(k, 0.05) * vol)

    def puff(b, ms, vol=0.035, pan=0.2):
        """A soft chord on an electric piano, short."""
        k = int(0.32 * sr)
        t = np.arange(k) / sr
        for j, m in enumerate(ms):
            put("keys", b, x.struck("tines", m)[:k] * np.exp(-t / 0.13) * tail(k, 0.04) * vol, pan + 0.12 * (j - 1.5))

    plucked = {}

    def string(m, long):
        """One string of a guitar with nylon strings: picked, its highs gone at once."""
        if (m, long) not in plucked:
            k = int((3 * long + 0.05) * sr)
            t = np.arange(k) / sr
            f0 = x.hz(m)
            h = np.arange(1, max(2, min(16, int(4500 / f0)) + 1))
            w = (np.abs(np.sin(np.pi * h * 0.2) / h**1.3)[:, None] * np.sin(np.outer(h, tau * f0 * t) + (np.pi * h * h / len(h))[:, None])
                 * np.exp(-np.outer(1 + 0.4 * h, t) / long)).sum(axis=0)
            plucked[(m, long)] = w / (np.max(np.abs(w)) + 1e-9) * np.minimum(1, t / 0.0015) * tail(k, 0.03)
        return plucked[(m, long)]

    def strum(b, ms, vol=0.05, long=0.12, pan=-0.3):
        for j, m in enumerate(ms):
            put("guitar", b, string(m, long) * vol, pan, late=0.009 * j)

    def brush(b, vol=0.012, pan=0.3):
        """A brush on a snare: a soft breath of noise."""
        k = int(0.09 * sr)
        t = np.arange(k) / sr
        put("brush", b, hiss(k, 7000, 0.6) * np.sin(np.pi * np.minimum(1, t / 0.09)) ** 1.5 * vol, pan)

    def knock(b, vol=0.03, pan=-0.2):
        """A wood block, soft: a chess piece set down."""
        k = int(0.07 * sr)
        t = np.arange(k) / sr
        put("wood", b, (np.sin(tau * 760 * t) + 0.5 * np.sin(tau * 1180 * t) + 0.3 * murk(k, 2500) * np.exp(-t / 0.002)) * np.exp(-t / 0.014) * np.minimum(1, t / 0.0006) * tail(k) * vol, pan)

    def stroll(bar, vol=1.0, chick="keys", brushes=True, wood=True, low=1.0):
        """A bar of the stroll: the bass on 1 and 3 (the bar's note, then another of the chord's a fourth or so over
        it) and a step towards the next bar's just before it; the chord, soft, on 2 and 4; a brush on the 8ths; the
        wood block on 4."""
        b = bar0(bar)
        for half, (root, between) in enumerate(halves(bar) if len(halves(bar)) == 2 else [of(bar)] * 2):
            other = (between(root + 5, root + 8) or between(root + 3, root + 4) or [root])[0]
            bass(b + 2 * half, root if half == 0 or len(halves(bar)) == 2 else other, 1.6, 0.42 * vol * low)
            ms = between(55, 67)[:4]
            if chick == "keys":
                puff(b + 2 * half + 1, ms, 0.035 * vol)
            elif chick == "guitar":
                strum(b + 2 * half + 1, ms, 0.085 * vol)
            elif chick == "both":
                puff(b + 2 * half + 1, ms, 0.03 * vol), strum(b + 2 * half + 1, ms, 0.065 * vol)
        root, nxt = of(bar, 2)[0], of(bar + 1)[0]
        if nxt != root:
            bass(b + 3 + sway(0.5), nxt + (1 if nxt < root else -1), 0.4, 0.3 * vol * low)
        if brushes:
            for i in range(8):
                brush(b + sway(i * 0.5), (0.014 if i % 2 == 0 else 0.009) * vol)
        if wood:
            knock(b + 3, 0.028 * vol)

    def walking(bar, vol=1.0):
        """The bass walking, a note a beat: up the chord and on by step to the next bar's note."""
        b = bar0(bar)
        for half, (root, between) in enumerate(halves(bar) if len(halves(bar)) == 2 else [of(bar)] * 2):
            tones = between(root, root + 12)
            first = root if half == 0 or len(halves(bar)) == 2 else tones[min(2, len(tones) - 1)]
            bass(b + 2 * half, first, 1.0, 0.38 * vol)
            nxt = of(bar + 1)[0] if half == 1 else (halves(bar)[1][0] if len(halves(bar)) == 2 else tones[min(2, len(tones) - 1)])
            if half == 0:
                step = tones[1]
            else:
                way = 1 if nxt < first else -1
                step = next(nxt + way * i for i in (1, 2) if i == 2 or (nxt + way) % 12 in {m % 12 for m in tones} or (nxt + way) % 12 in (7, 9, 11, 0, 2, 4, 6))
            bass(b + 2 * half + 1, step, 1.0, 0.32 * vol)

    def rolled(bar, vol=0.07):
        """The soft piano rolling the bar's chord: six notes, an 8th each, up and back."""
        b = bar0(bar)
        for half in range(2):
            root, between = of(bar, 2.0 * half)
            ms = between(48, 67)
            order = [ms[0], ms[2 % len(ms)], ms[3 % len(ms)], ms[-1]] if half == 0 else [ms[-2], ms[3 % len(ms)], ms[2 % len(ms)], ms[1]]
            for i, m in enumerate(order):
                put("piano", b + 2 * half + sway(i * 0.5), x.struck("felt", m) * vol * (1.0 if i == 0 else 0.8), -0.25 + 0.1 * i)

    def picked(bar, vol=0.06):
        """The guitar picking the bar's chord, an 8th a note."""
        b = bar0(bar)
        for i in range(8):
            root, between = of(bar, i * 0.5)
            ms = between(50, 69)
            m = ms[(0, 2, 3, 2, 1, 3, 4, 2)[i] % len(ms)]
            put("guitar", b + sway(i * 0.5), string(m, 0.35) * vol * (1.0 if i % 4 == 0 else 0.75), -0.3 + 0.08 * (i % 4))

    def pad(bar, vol=0.02):
        at(bar0(bar), 4)
        ms = of(bar)[1](55, 67)[:3]
        for j, m in enumerate(ms):
            put("pad", bar0(bar), x.strings(m, 4, vol, attack=0.4, release=0.5), -0.4 + 0.4 * j)

    # ---- the voices that have the tune ----
    def clarinet(start, text, vol=1.0, pan=-0.2, up=0):
        """A clarinet, low and woody: the odd harmonics, none over about 2.8 kHz; a soft start; it leans a little into each note."""
        for b, d, m in notes(start, text):
            b, d, m = sway(b), float(d), m + up
            at(b, d)
            f0 = x.hz(m)
            harm = [(1.0 if h % 2 else 0.07) / h**1.1 / np.sqrt(1 + (h * f0 / 2800) ** 4) for h in range(1, max(2, int(4500 / f0)) + 1)]
            w = x.tone(m, d * 0.95, harm, 0.13 * vol, vib=0.004 if d >= 1 else 0.0, vib_hz=5.0, scoop=0.25, scoop_s=0.03, attack=0.03, release=0.06)
            put("clarinet", b, w, pan)

    def accordion(start, text, vol=1.0, pan=0.25, up=0):
        """An accordion: three reeds a hair apart and one an octave over them, the bellows swelling each note in."""
        for b, d, m in notes(start, text):
            b, d, m = sway(b), float(d), m + up
            at(b, d)
            f0 = x.hz(m)
            harm = [1 / h / np.sqrt(1 + (h * f0 / 2400) ** 4) for h in range(1, max(2, int(4200 / f0)) + 1)]
            w = x.tone(m, d * 0.95, harm, 0.075 * vol, detune=(-9, 0, 8), attack=0.06, release=0.09, trem=0.06, trem_hz=5.5)
            w = w + x.tone(m + 12, d * 0.95, harm[: max(2, len(harm) // 2)], 0.02 * vol, attack=0.07, release=0.09)[: len(w)]
            put("accordion", b, w, pan)

    def ocarina(start, text, vol=0.055, pan=0.1, up=0):
        for b, d, m in notes(start, text):
            at(float(b), float(d))
            put("ocarina", float(b), x.ocarina(m + up, float(d) * 0.98, vol), pan)

    def piano(start, text, vol=0.11, pan=-0.1, up=0):
        for b, d, m in notes(start, text):
            put("piano", sway(b), x.struck("felt", m + up) * vol, pan)

    def guitar(start, text, vol=0.1, pan=-0.25, up=0):
        for b, d, m in notes(start, text):
            put("guitar", sway(b), string(m + up, 0.5) * vol, pan)

    def box(b, m, vol=0.03, pan=0.45):
        put("box", b, x.struck("box", m) * vol, pan)

    # Bars 1-4: the stroll starts. The bass and the chords; the brush from the third bar; the clarinet's two notes
    # into the tune.
    for bar in range(1, 5):
        stroll(bar, 0.9, brushes=bar >= 3, wood=bar >= 3)
    clarinet(bar0(4) + 3, PICKUP[tune], 0.9)

    # Bars 5-12: the square: the tune on the clarinet. Bars 13-20: again on the accordion, the clarinet's long notes
    # under it, the guitar joining the chords.
    for bar in range(5, 21):
        stroll(bar, 1.0, "keys" if bar < 13 else "both")
    clarinet(bar0(5), TUNE)
    accordion(bar0(13) - 1, PICKUP[tune], 0.9), accordion(bar0(13), TUNE), clarinet(bar0(13), UNDER, 0.4)

    # Bars 21-28: the gazebo. The ocarina's slow tune; the soft piano rolls the chords; the bass walks; strings, far off; no wood block.
    for bar in range(21, 29):
        walking(bar, 0.95), rolled(bar, 0.045), pad(bar, 0.018)
        for i in range(8):
            brush(bar0(bar) + sway(i * 0.5), 0.011 if i % 2 == 0 else 0.007)
    ocarina(bar0(21), SLOW)

    # Bars 29-36: the square again: the clarinet has the tune, the accordion beside it a third or so under.
    for bar in range(29, 37):
        stroll(bar, 1.0, "both")
    clarinet(bar0(29) - 1, PICKUP[tune], 0.9), clarinet(bar0(29), TUNE), accordion(bar0(29), BESIDE if tune == "a" else UNDER, 0.7)

    # Bars 37-52: the cafe (the quiet part), in E minor. No brush, no wood block; the bass a note or two a bar. The
    # soft piano has the tune's pieces over the guitar's picking; then the guitar has them over the piano's chords,
    # a music box far off.
    for bar in range(37, 53):
        b = bar0(bar)
        root, between = of(bar)
        bass(b, root, 2.5, 0.3)
        if len(halves(bar)) == 2:
            bass(b + 2, halves(bar)[1][0], 1.6, 0.28)
        if bar < 45:
            picked(bar, 0.085)
        else:
            rolled(bar, 0.03)
            if bar % 2 == 1:
                tones = between(72, 84)
                box(b + 1.5, tones[-1], 0.028), box(b + 3, tones[len(tones) // 2], 0.022)
    piano(bar0(37), CAFE_1), guitar(bar0(45), CAFE_2, 0.2)

    # Bars 53-60: a conversation: the clarinet's two bars, the accordion's two, twice; the stroll back under them, lightly.
    for bar in range(53, 61):
        stroll(bar, 0.9, "keys", wood=bar % 2 == 0)
    clarinet(bar0(53), TALK_C), accordion(bar0(53), TALK_A)

    # Bars 61-68: promoted: the tune a minor third up; the clarinet has it, the accordion beside it, the ocarina over
    # the long notes; strings; the fullest the song gets, and still easy.
    for bar in range(61, 69):
        stroll(bar, 1.08, "both"), pad(bar, 0.02)
    clarinet(bar0(61), seven(TUNE), 1.05, up=3), clarinet(bar0(68), HOME_A if tune == "a" else HOME_B, 1.05)
    accordion(bar0(61), BESIDE if tune == "a" else UNDER, 0.75, up=3)
    if tune == "a":
        ocarina(bar0(61), "-:8 | -:2 G5:2 | -:8 | F5:2.5 -:1.5 | -:8", 0.045)

    # Bars 69-76: home: the tune once more, softer, on the accordion, the clarinet's long notes under it; the brush
    # thins out. Bars 77-80: the stroll alone again; three notes of the tune on the piano, far off.
    for bar in range(69, 77):
        stroll(bar, 0.92, "keys", brushes=bar < 75, wood=bar < 73)
    accordion(bar0(69), TUNE, 0.9), clarinet(bar0(69), UNDER, 0.4)
    for bar in range(77, 81):
        stroll(bar, 0.85, brushes=False, wood=False)
    piano(bar0(77), LAST, 0.08)

    x.beat_s = 60 / 106.67
    x.echo("clarinet", 1.5, 0.1, 0.04), x.echo("accordion", 1.5, 0.08, 0.03), x.echo("box", 1.0, 0.3, 0.15), x.echo("guitar", 1.5, 0.1, 0.04)
    levels = {"clarinet": 1.0, "accordion": 2.6, "ocarina": 2.2, "piano": 2.2, "guitar": 2.0, "keys": 4.0, "box": 2.0, "bass": 0.62, "brush": 4.0, "wood": 4.0, "pad": 2.0}
    return x.play(x.mixdown(levels, lowpass=8000, room=0.26, room_s=1.6))


def main(out: str, tune: str = "a") -> None:
    write_wav(out, render(tune))


if __name__ == "__main__":
    main(*sys.argv[1:3])
