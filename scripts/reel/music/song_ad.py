"""Song AD (Eric, Nov 14): the town's theme, a loop of three minutes. "We got to tackle the big issue here ... make a
theme, a town theme ... it's going to need to be about 3 minutes ... the goal is it's a song where people literally
are like, I want to turn this song on while I'm in the chess town because it's so good."
He sent a write-up of a style, made from another game's playground tune (a 1920s bandstand stroll), and of what would
wear on the ear over three minutes. What is used from it is the style's own means and its cautions, none of them one
song's: the 8ths swung a little; no drum kit: a plucked upright bass on 1 and 3, soft chords on 2 and 4, a brush, a
wood block; warm, rounded voices that hand the tune to one another (a clarinet, a flute, a vibraphone, a soft
piano, a guitar); ragtime's kind of chords (a chord borrowed from the minor, a chord a fifth above the one it leads to); no
tune over the staff's top space but in the one lifted passage, no whistles or slides, nothing shrill; and several
places in one walk, with a quiet one in the middle, so the three minutes are never one half minute six times.
What is not used: the write-up's chord progressions (its stroll's eight bars, its bridge, its duet's circle), its
key, or any tune of it. The tune itself was not listened to, measured or transcribed, and every melody, riff and
chord progression here is original: none of it is any song's or any game's.
Two changes from its list of voices, for Eric's ear (SOUNDS.md): where it has a horn take the slow tune, an ocarina
does (he has turned down a brass lead three times and picked the ocarina himself); and the quiet part has the soft
piano and the music box he likes.
His notes (Nov 14). Of the two main tunes first sent (one going by step, one that hops and rests): "I think I'm vibing
with the second one better", so that one is the tune and the other is gone. Of the accordion that had the tune the
second time (three reeds a hair apart, at the clarinet's level): "some loud synth obnoxious instrument starts playing.
We need to change that to like something very light ... like a flute or a timpani ... it's way too loud. It should be
just like more background, quiet, lighter". He was sent a soft flute there and, second, a vibraphone (a timpani is a
drum: a mallet voice was a guess at what he meant): "I love everything about that sample, so you can keep that on
rough repeat. Feel free to play around a bit mid track for a verse." Of the pace, 107 beats a minute at first, then
116: "I tried a couple different BPMs ... right in between, 129." Of the full song, sent with each voice: "I like your
V4 flute ... I am leaning more towards the flute now than the vibraphone", so the flute has the second turn, and
three things about the quiet part, which then had no beat under it, a soft piano's solo and a music box: "we lost like
the backdrop ... that sort of shake sort of beat that rings throughout ... without it, it's not quite like working
the same ... Let's throw that back in, the whole song" (the stroll now goes on under it); "tune down that piano
that's going, and you could probably work in a vibraphone with the piano ... kind of cool to still get a little
vibraphone in the song" (the vibraphone has the phrases there, the piano with it and well under it); and the bell
"sounds a little off ... tweak it a little bit to sound more melodic with the song" (it played the top notes of each
chord, an 8th ahead of the swing, on the synth's music box, which has an overtone a third off its note: now a small
bell whose overtones are the note's own harmonics, a written line that answers the guitar, swung with the rest).
Earlier (0:40, the ocarina): "staticky ... some artifact embedded in every time it plays a note": the breath in the
synth's ocarina; the town's ocarina and flute are the bare tones.
So the song is that sample (the stroll's four bars, the tune on the clarinet, the tune on the flute) three times,
a little different each time, with other places between: the gazebo, the cafe, a conversation, and the tune a minor
third up before it comes home.
The idea from the game: a walk round the town. The bass walks down a step a bar under a D that never moves (G, F
sharp, F, E, E flat, D: the E flat bar is the chord borrowed from the minor, the walk's one wistful step); the tune is
handed from voice to voice as the walk passes the square, the gazebo and the cafe; and near the end the pawn reaches
the far side and is promoted: the tune a minor third up, everyone together. A wood block's knock is a piece set down.
G major; 96 bars of four at 129 beats a minute: 178.6 s.
  python3 song_ad.py <out.wav>

  bars  1-4    0:00  the stroll starts: the bass, the chords, a brush
  bars  5-12   0:07  the square: the tune on the clarinet
  bars 13-20   0:22  again on the flute, lightly, the clarinet's long notes far under it
  bars 21-28   0:37  the gazebo: a slow tune on the ocarina over the piano's rolling chords, the bass walking
  bars 29-44   0:52  the square again: the clarinet with the flute beside it, then the flute's turn
  bars 45-60   1:22  the cafe, in E minor, the stroll going on under it: short phrases on the vibraphone and the soft
                     piano together over a guitar, then on the guitar, a small bell answering
  bars 61-68   1:52  a conversation: the clarinet and the flute trade two bars each
  bars 69-76   2:07  promoted: the tune a minor third up, everyone
  bars 77-92   2:21  home: the clarinet's turn and the flute's once more, the brush thinning out
  bars 93-96   2:51  the stroll alone again, for the way round
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, write_wav

BARS = 96
BEATS = 4 * BARS
BPM = 129.0  # Eric's, by ear
TAPE = BEATS * 60 / BPM  # 178.6 s
SWING = 0.08  # an off 8th is this much of a beat late
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A bar's chord (two with a comma: half a bar each); "/X": the bass's note. "+3" after it: a minor third up.
WALK = "G D/F# G7/F Cadd9/E Cmadd9/Eb G/D A9 D7"  # the tune's eight bars: the bass steps down under the D
VAMP = "G Em7 Am7 D7"
GAZEBO = "Cmaj7 Bm7 Am7 D7/F# Cmaj7 Bm7,E7 Am7 D7"
CAFE = "Em9 Em/D Cmaj7 B7 Em9 Em/D C#m7b5 D7sus4,D7  Em9 Em/D Cmaj7 B7 Em9 A9 Am7/D D7"
TALK = "G B7 Em G7/D C A7/C# D7sus4 D7,F7"
LIFTED = " ".join(c + "+3" for c in WALK.split()[:7]) + " F7,D7"  # its last bar is the way home
CHORDS = f"{VAMP}  {WALK} {WALK}  {GAZEBO}  {WALK} {WALK}  {CAFE}  {TALK}  {LIFTED}  {WALK} {WALK}  {VAMP}".split()
assert len(CHORDS) == BARS, len(CHORDS)
KINDS = {"": (0, 4, 7), "6": (0, 4, 7, 9), "maj7": (0, 4, 7, 11), "7": (0, 4, 7, 10), "9": (0, 4, 7, 10, 14), "add9": (0, 4, 7, 14), "m": (0, 3, 7),
         "m7": (0, 3, 7, 10), "m9": (0, 3, 7, 10, 14), "madd9": (0, 3, 7, 14), "m7b5": (0, 3, 6, 10), "7sus4": (0, 5, 7, 10)}

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two. ----
# The tune: a hop up the chord, a breath, and over the top; an answer that leans; the same hop falling; a long note
# and a turn; the wistful bar, falling; a climb to a held note; a bright hop; home.
TUNE = (
    "G4:.5 B4:.5 -:.5 D5:.5 E5:1 D5:.5 B4:.5 | A4:1.5 F#4:.5 A4:.5 B4:.5 D5:1 | D5:.5 B4:.5 -:.5 G4:.5 F4:1 A4:.5 B4:.5 | "
    "C5:1.5 E5:.5 D5:.5 C5:.5 G4:1 | Eb5:1.5 D5:.5 C5:.5 G4:.5 Eb4:1 | D4:.5 G4:.5 B4:.5 D5:2.5 | "
    "E5:.5 C#5:.5 -:.5 A4:.5 B4:.5 C#5:.5 E5:1 | D5:1 C5:.5 A4:.5 F#4:1 -:1"
)
PICKUP = "D4:.5 F#4:.5"  # the two notes into it
# Under the tune when the flute has it: the clarinet's long notes.
UNDER = "D4:4 | D4:4 | D4:2 F4:2 | E4:2 G4:2 | G4:4 | G4:2 B4:2 | G4:2 E4:2 | F#4:3 -:1"
# Beside the tune, in its rhythm: a third or a sixth under it.
BESIDE = (
    "D4:.5 G4:.5 -:.5 B4:.5 C5:1 B4:.5 G4:.5 | F#4:1.5 D4:.5 F#4:.5 G4:.5 A4:1 | B4:.5 G4:.5 -:.5 D4:.5 D4:1 F4:.5 G4:.5 | "
    "E4:1.5 G4:.5 G4:.5 E4:.5 E4:1 | G4:1.5 G4:.5 Eb4:.5 Eb4:.5 C4:1 | B3:.5 D4:.5 G4:.5 B4:2.5 | "
    "C#5:.5 A4:.5 -:.5 E4:.5 G4:.5 A4:.5 C#5:1 | A4:1 A4:.5 F#4:.5 D4:1 -:1"
)
# The lifted tune's last bar is F7 then D7, so the tune and the line beside it have their own notes there (as
# written, not lifted).
HOME, HOME_BESIDE = "F5:1 Eb5:.5 C5:.5 A4:1 -:1", "C5:1 C5:.5 A4:.5 F#4:1 -:1"
# The gazebo: the ocarina's slow tune.
SLOW = "E5:3 D5:1 | D5:2 B4:1 A4:1 | C5:3 B4:.5 A4:.5 | A4:2 F#4:1 A4:1 | G4:1 B4:1 E5:2 | D5:2 G#4:1 B4:1 | C5:1.5 B4:.5 A4:1 E4:1 | F#4:2 A4:1 -:1"
# The cafe: short phrases with air between them: the vibraphone's and piano's eight bars, then the guitar's.
CAFE_1 = (
    "-:1 B4:.5 C5:.5 D5:1 B4:1 | G4:2 -:2 | -:1 A4:.5 B4:.5 C5:1 A4:1 | F#4:2 D#4:1 -:1 | "
    "-:.5 E4:.5 G4:.5 B4:.5 D5:2 | E5:1 D5:2/3 B4:2/3 G4:2/3 E4:1 | G4:1.5 E4:.5 C#4:1 E4:1 | D4:2 F#4:1 A4:1"
)
CAFE_2 = (
    "B4:1.5 G4:.5 E4:1 -:1 | -:1 F#4:.5 G4:.5 A4:1 B4:1 | C5:2.5 B4:.5 G4:1 | A4:1 F#4:1 D#4:1 -:1 | "
    "-:.5 B4:.5 D5:.5 E5:.5 D5:1 B4:1 | C#5:1.5 B4:.5 A4:1 G4:1 | E4:1 G4:1 A4:1 C5:1 | B4:1.5 A4:.5 F#4:1 -:1"
)
# The bell's answers to the guitar: in the guitar's rests and under its long notes; each one's echoes (a beat and two
# beats on) fall on chords it belongs to.
BELL = "-:3 B5:.5 G5:.5 | E5:1 -:3 | -:1 E5:.5 G5:.5 B5:1 -:1 | -:3 B5:.5 F#5:.5 | E5:1 -:3 | -:3 A5:.5 G5:.5 | E5:1 -:3 | D5:.5 F#5:.5 A5:1 -:2"
# The conversation: the clarinet's two bars, the flute's two, twice.
TALK_C = "D5:.5 B4:.5 G4:1 A4:.5 B4:.5 D5:1 | D#5:1.5 B4:.5 F#4:1 A4:1 | -:8 | E5:1 C5:.5 G4:.5 E4:1 G4:1 | A4:.5 C#5:.5 E5:1.5 C#5:.5 A4:1 | -:8"
TALK_A = "-:8 | G4:.5 B4:.5 E5:1.5 D5:.5 B4:1 | D5:1 B4:.5 G4:.5 F4:1 D4:1 | -:8 | G4:1 A4:1 C5:1 D5:1 | D5:.5 C5:.5 A4:1 C5:1 Eb5:1"
# The stroll's last bars: the tune's first hop on the piano, far off.
LAST = "-:4 | G4:.5 B4:.5 -:.5 D5:.5 E5:2 | -:8"
for _line, _beats in ((TUNE, 32), (UNDER, 32), (BESIDE, 32), (HOME, 4), (HOME_BESIDE, 4), (SLOW, 32), (CAFE_1, 32), (CAFE_2, 32), (BELL, 32), (TALK_C, 32), (TALK_A, 32), (LAST, 16)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=233, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(89)
    sr = x.sr
    tau = 2 * np.pi
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

    def flute(start, text, vol=1.0, pan=0.25, up=0):
        """The light voice beside the clarinet: a flute, low and soft, with no breath in it (see the ocarina)."""
        for b, d, m in notes(start, text):
            b, d, m = sway(b), float(d), m + up
            at(b, d)
            put("flute", b, x.add(m, d * 0.95, x.FLUTE, 0.05 * vol, vib=0.006, attack=0.04, sustain=0.8, decay=0.2, release=0.08), pan)

    def vibes(start, text, vol=1.0, pan=0.2):
        """A vibraphone, each note left to ring a little."""
        for b, d, m in notes(start, text):
            w = x.struck("vibes", m)
            put("vibes", sway(b), w * np.exp(-np.arange(len(w)) / sr / 0.7) * 0.07 * vol, pan)

    def ocarina(start, text, vol=0.055, pan=0.1, up=0):
        """The ocarina's note with no breath in it. The synth's own has a little air under each note, and here, with
        little playing round it, Eric heard that as a fault (Nov 14: "staticky ... some artifact embedded in every time
        it plays a note ... staticky below the note itself")."""
        for b, d, m in notes(start, text):
            at(float(b), float(d))
            put("ocarina", float(b), x.tone(m + up, float(d) * 0.98, [1, 0.03, 0.07, 0.01, 0.02], vol, vib=0.003, vib_hz=4.5, scoop=0.3, scoop_s=0.04, attack=0.04, release=0.08), pan)

    def piano(start, text, vol=0.11, pan=-0.1, up=0):
        for b, d, m in notes(start, text):
            put("piano", sway(b), x.struck("felt", m + up) * vol, pan)

    def guitar(start, text, vol=0.1, pan=-0.25, up=0):
        for b, d, m in notes(start, text):
            put("guitar", sway(b), string(m + up, 0.5) * vol, pan)

    def bell(start, text, vol=0.03, pan=0.45):
        """A small bell, far off: its overtones are the note's own harmonics, the octaves first. (The synth's music
        box has one a third off its note: in a tune of its own that is its charm; over these chords Eric heard it as
        "a little off".)"""
        for b, d, m in notes(start, text):
            b = sway(b)
            at(b, 2)
            k = int(1.8 * sr)
            t = np.arange(k) / sr
            ph = tau * x.hz(m) * t
            put("bell", b, np.sin(ph + np.exp(-t / 0.25) * np.sin(3 * ph)) * np.exp(-t / 0.5) * np.minimum(1, t / 0.002) * tail(k, 0.2) * vol, pan)

    # Bars 1-4: the stroll starts. The bass and the chords; the brush from the third bar.
    for bar in range(1, 5):
        stroll(bar, 0.9, brushes=bar >= 3, wood=bar >= 3)

    def sample(first, beside=0.0, glow=False, thin=False):
        """Sixteen bars, the ones Eric kept ("I love everything about that sample, so you can keep that on rough
        repeat"): two notes in and the tune on the clarinet; then on the flute, lightly, the clarinet's long
        notes far under it and the guitar joining the chords. `beside`: the flute plays beside the clarinet
        too, this loud; `glow`: strings far off under the clarinet's turn; `thin`: the wood block and then the brush
        drop out towards the end."""
        for bar in range(first, first + 16):
            turn2 = bar >= first + 8
            stroll(bar, 0.94 if thin else 1.0, "both" if turn2 or beside else "keys", brushes=not (thin and bar >= first + 14), wood=not (thin and bar >= first + 12))
            if glow and not turn2:
                pad(bar, 0.016)
        clarinet(bar0(first) - 1, PICKUP, 0.9), clarinet(bar0(first), TUNE)
        if beside:
            flute(bar0(first), BESIDE, beside)
        flute(bar0(first + 8) - 1, PICKUP, 0.9), flute(bar0(first + 8), TUNE), clarinet(bar0(first + 8), UNDER, 0.28)

    # Bars 5-20: the square: the sample as he heard it.
    sample(5)

    # Bars 21-28: the gazebo. The ocarina's slow tune; the soft piano rolls the chords; the bass walks; strings, far off; no wood block.
    for bar in range(21, 29):
        walking(bar, 0.95), rolled(bar, 0.045), pad(bar, 0.018)
        for i in range(8):
            brush(bar0(bar) + sway(i * 0.5), 0.014 if i % 2 == 0 else 0.009)  # as loud as in the stroll: the shake never drops
    ocarina(bar0(21), SLOW)

    # Bars 29-44: the square again: this time the flute plays beside the clarinet before its own turn.
    sample(29, beside=0.6)

    # Bars 45-60: the cafe, in E minor. The stroll goes on under it, a little softer (Eric: the backdrop "that rings
    # throughout" stays in the whole song). The vibraphone has the short phrases, the soft piano with it and well
    # under it, over the guitar's picking; then the guitar has them over the piano's chords, the bell answering.
    for bar in range(45, 61):
        stroll(bar, 0.85, "keys")
        if bar < 53:
            picked(bar, 0.06)
        else:
            rolled(bar, 0.02)
    vibes(bar0(45), CAFE_1, 1.6), piano(bar0(45), CAFE_1, 0.045)
    guitar(bar0(53), CAFE_2, 0.2), bell(bar0(53), BELL)

    # Bars 61-68: a conversation: the clarinet's two bars, the flute's two, twice, over the stroll.
    for bar in range(61, 69):
        stroll(bar, 0.9, "keys", wood=bar % 2 == 0)
    clarinet(bar0(61), TALK_C), flute(bar0(61), TALK_A)

    # Bars 69-76: promoted: the tune a minor third up; the clarinet has it, the flute beside it, the ocarina
    # over its one long note; strings; the fullest the song gets, and still easy.
    for bar in range(69, 77):
        stroll(bar, 1.08, "both"), pad(bar, 0.02)
    clarinet(bar0(69), seven(TUNE), 1.05, up=3), clarinet(bar0(76), HOME, 1.05)
    flute(bar0(69), seven(BESIDE), 0.7, up=3), flute(bar0(76), HOME_BESIDE, 0.7)
    ocarina(bar0(69), "-:20 | -:1.5 F5:2.5 | -:8", 0.045)

    # Bars 77-92: home: the sample once more, strings far off under the clarinet, the wood block and the brush
    # dropping out at the end. Bars 93-96: the stroll alone again; the tune's first hop on the piano, far off.
    sample(77, glow=True, thin=True)
    for bar in range(93, 97):
        stroll(bar, 0.85, brushes=False, wood=False)
    piano(bar0(93), LAST, 0.08)

    x.beat_s = 60 / BPM
    x.echo("clarinet", 1.5, 0.1, 0.04), x.echo("flute", 1.5, 0.1, 0.04), x.echo("bell", 1.0, 0.3, 0.15), x.echo("guitar", 1.5, 0.1, 0.04)
    levels = {"clarinet": 1.0, "flute": 2.0, "vibes": 2.0, "ocarina": 2.2, "piano": 2.2, "guitar": 2.0, "keys": 4.0, "bell": 2.0, "bass": 0.62, "brush": 4.0, "wood": 4.0, "pad": 2.0}
    return x.play(x.mixdown(levels, lowpass=8000, room=0.26, room_s=1.6))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
