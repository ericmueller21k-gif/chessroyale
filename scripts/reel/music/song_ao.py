"""Song AO (Eric, Nov 22): Smudgy's theme (the chameleon painter in a beret), a loop of two and a half minutes. His
direction: "think like paint, paint strokes, and like paint splattering, maybe. Bit more like a whimsical, but somehow
it needs to have like a vibe of like a calmness, but still somehow be, fast pace ... I almost could see this one being
170 or like 175 BPM. Maybe starts out 20 seconds slow introduction and then gets into it. We could actually push it
even harder, going like 220 or 230 for like a build up that has a part like that and then comes back to the normal
beat ... the instruments that I've kind of avoided or said I don't like, so try to not use any of those."

Calm and fast at once: the kit and the drips race (172 beats a minute) while the tune moves in long notes over them,
a chord a bar. The paint is in how it is played:
- strokes: the tune is a bowed violin in long pulls, each ending in a flick of three quick notes as the brush leaves
  the canvas; the kit's cymbals are a brush swishing left and right on every 8th (his `swish`, as the game makes it);
- splatter: plucked strings that die at once, scattered wide in a long echo; his own splats, more and more of them
  through the rush;
- drips: the fast pattern is drops (a round plink that falls into its note), always coming back to one note.

The idea from his world that runs the song: colors blending, and the repaint. Each chord keeps three of the last
chord's four notes and changes one (D major 9, B minor 9, G major 9, E minor 9, C major 9, A minor 9, F major 9: the
roots fall by thirds), so the color slides bar by bar until, sixteen bars on, the picture is a new color: a minor third
up. A swipe of his brush marks each repaint. D, F, A flat, B: the fourth repaint is D again, which is the loop.
The slow middle is his Camouflage: the tune hides, at half speed, in a soft piano over one bass note.

  python3 song_ao.py <out.wav>

  bars   1-8    the blank canvas (86, the same pulse at half pace): a soft piano's rolled chords, slow strokes, a
                music box, drips; the violin, low and slow; the last two bars run up to 172
  bars   9-24   first coat, in D: the tune on the violin, low, then (bar 17) an octave up; the kit's two-step
  bars  25-40   second coat, in F: the piano has the tune, the violin long notes under it; then they trade two bars each
  bars  41-60   camouflage, in A flat: no kit and no brush; the tune at half speed on the soft piano, twice; from
                bar 45 the music box's solo over it, two notes at a time; two big chords (bars 57 and 59)
  bars  61-68   his little waltz: a motif three beats long against the bar's four, on the piano; the violin's long pulls
  bars  69-76   the rush: the waltz climbing by whole steps, 172 up to 226, the splats coming faster
  bars  77-84   splatter (226), in B: three colors a major third apart; the violin and the piano trade two bars each
  bars  85-92   the tune at 226, both of them, on the way home
  bars  93-94   one big splash; everything stops; the paint runs down
  bars  95-110  the finished picture, in D (172): the tune on two violins and the piano
  bars 111-118  the tag: the last stroke; the brush slows to the canvas's pulse, which is bar 1's

The second go (Eric, Nov 22, of the first: "It's almost there"): the calm is twelve bars longer (17 s) and has no
brush in it ("we want to cut out the brushes going back and forth"); the brush is quieter everywhere ("just a bit
quieter, even for the whole song"); and the sparkle he liked there has a solo: "two of those ... musical box sounds
... the equivalent of ... playing on a piano, like two fingers next to each other as far as the notes go ... keep the
piano piece ... playing with it, but then make it ... a longer, more original solo ... throw in a little sharp note
... change up the timing ... a little slow, fast, add a couple, like big chords to it too, or like one or two chords."
The third go, of that solo (pairs of notes a step apart, low on the music box, with two notes from outside the key):
"you did the wrong instrument. I like that one, but I meant ... the other one ... It starts between 2 and 3 seconds
... it sounds like a glockenspiel ... the tempo and like the way it moves is fine, but the notes themselves aren't
sounding really what I'm looking for ... That one sounds just too off." So the solo keeps its rhythm bar for bar and
has new notes: a tune in the key's five plain notes (A flat, B flat, C, E flat, F), its long notes doubled a third,
a fourth, a fifth or a sixth below (nothing a step apart, nothing from outside the key); the "sharp" notes are two
short bright ones. It is played high, where the music box rings like a glockenspiel: the ding first heard two seconds
into the song. `voice="drop"` plays it on the other sparkle there (the drips' round plink), in case he meant that one.
"""
import sys
from fractions import Fraction
from types import SimpleNamespace

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

CALM, WALTZ, RUSH, FAST, LAND, HOME, TAG_AT = 41, 61, 69, 77, 93, 95, 111  # the bar each part starts at
BARS = 118
BEATS = 4 * BARS
TAPE = 166.5  # (the tempos below are scaled a hair, about 0.5%, so the tape is this long: quick transforms)
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [
    (bar0(1), bar0(7), 86, 86, 1.0, 1.0, 0.0),  # the blank canvas
    (bar0(7), bar0(9), 86, 172, 1.0, 1.0, 0.0),  # loading the brush
    (bar0(9), bar0(RUSH), 172, 172, 1.0, 1.0, 0.0),
    (bar0(RUSH), bar0(FAST), 172, 226, 1.0, 1.0, 0.0),  # the rush
    (bar0(FAST), bar0(LAND), 226, 226, 1.0, 1.0, 0.0),  # splatter
    (bar0(LAND), BEATS, 172, 172, 1.0, 1.0, 0.0),  # back at once: a landing, not a slowing
]

PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
# A kind of chord: the four notes the keys play over its root, and its third, fifth, seventh (or sixth) and ninth
# for the tunes that are built on the chord. "L": the chord a whole step up, over the bass (a raised fourth).
KIND = {
    "M": ((4, 7, 11, 14), (4, 7, 11, 14)),
    "m": ((3, 7, 10, 14), (3, 7, 10, 14)),
    "s": ((5, 7, 10, 14), (5, 7, 10, 14)),
    "7": ((4, 7, 10, 14), (4, 7, 10, 14)),
    "L": ((2, 6, 9, 16), (4, 7, 9, 18)),
    "T": ((4, 7, 12, 14), (4, 7, 9, 14)),
}


def blend(key: str, end: str) -> list:
    """Eight bars of colors blending in a key: the roots falling by thirds, each chord keeping three of the last
    one's notes. `end`: "home" (the seventh chord, then the turn back), "away" (the seventh chord is the new key, a
    minor third up, and the last bar leans into it) or "stay" (a chord from outside the key, then the turn back)."""
    k = PC[key]
    last = {"home": ((3, "M"), (7, "s7")), "away": ((3, "M"), (10, "s")), "stay": ((8, "M"), (7, "s7"))}[end]
    return [((k + up) % 12, kind, None, k) for up, kind in ((0, "M"), (9, "m"), (5, "M"), (2, "m"), (10, "M"), (7, "m")) + last]


def named(text: str, key=None) -> list:
    """'Ab:M F:m/Ab' -> chords (root, kind, bass, key)."""
    out = []
    for tok in text.split():
        name, _, low = tok.partition("/")
        root, kind = name.split(":")
        out.append((PC[root], kind, PC[low] if low else None, PC[key] if key else None))
    return out


CHORDS = (
    blend("D", "home")
    + blend("D", "home") + blend("D", "away")
    + blend("F", "home") + blend("F", "away")
    + named("Ab:M Ab:L Ab:M Ab:L F:m/Ab Ab:L Db:M/Ab Eb:s/Ab  Ab:M Ab:L Ab:M Ab:L F:m Ab:L Db:M Eb:s  F:m Db:M Ab:M Eb:s7", "Ab")
    + blend("Ab", "away")
    + named("B:T C#:T Eb:T F:T G:T A:T B:T F#:s7")
    + named("B:T B:T G:T G:T Eb:T Eb:T B:T F#:s7") + blend("B", "away")
    + named("D:M D:M", "D")
    + blend("D", "home") + blend("D", "stay")
    + named("D:M B:m G:M A:s D:M D:L D:M D:L", "D")
)
assert len(CHORDS) == BARS
fold = lambda m, lo: lo + (m - lo) % 12  # the note of that name in the twelve half steps from `lo` up
DRIPS = (2, 0, 2, 4, 2, 1, 3, 2)  # the drips' bar, 8th by 8th: which of the chord's five (2: the note that never moves)

# ---- the tune (the violin's, in D). A flick is three notes in a beat; "2/3" is one of three across two beats. ----
TUNE_A = (
    "F#5:3 A5:1/3 F#5:1/3 E5:1/3 | D5:2 -:1 D5:1/2 A5:1/2 | D6:1.5 B5:1 A5:1.5 | G5:2 F#5:2/3 G5:2/3 B5:2/3 | "
    "C6:2.5 B5:1/2 G5:1 | E5:2.5 -:1/2 C5:1/2 E5:1/2 | A5:1.5 G5:1 E5:1.5 | D5:2 C#5:1 E5:1/3 A5:1/3 C#6:1/3"
)
# Its second half: a third higher, to the top of the tune (bar 5), ending in the new key.
TUNE_A2 = (
    "A5:3 C#6:1/3 A5:1/3 F#5:1/3 | F#5:2 -:1 F#5:1/2 B5:1/2 | E6:1.5 D6:1 B5:1.5 | A5:2 G5:2/3 A5:2/3 D6:2/3 | "
    "E6:2.5 D6:1/2 B5:1 | C6:2.5 -:1/2 A5:1/2 C6:1/2 | E6:1.5 C6:1 A5:1.5 | G5:2 Bb5:2"
)
bars_of = lambda text, a, b: " | ".join(text.split("|")[a - 1 : b])
# The last time, it stays home: a chord from outside the key (B flat), then the turn.
TUNE_A3 = bars_of(TUNE_A2, 1, 6) + " | D6:1.5 A5:1 F5:1.5 | G5:2 E5:1 C#5:1"
# The second violin under the tune: its long notes only, a third or a sixth below.
HARM_A = "D5:3 -:1 | B4:2 -:2 | B5:1.5 G5:1 F#5:1.5 | E5:2 -:2 | E5:2.5 -:1.5 | C5:2.5 -:1.5 | F5:1.5 E5:1 C5:1.5 | A4:2 A4:1 -:1"
# And under the tune's second half: one slow stroke a bar.
COUNTER = "D5:4 | D5:4 | B4:4 | B4:2 D5:2 | G5:4 | E5:4 | F5:4 | E5:2 A4:2"
# The blank canvas (bars 3 to 8): the violin, low and slow, finding the tune's notes.
INTRO = "-:2 D5:1 A5:1 | B5:2.5 A5:.5 G5:1 | E5:2 G5:1 C6:1 | B5:1.5 A5:.5 E5:2 | F5:1 A5:1 C6:2 | E6:4"
# Camouflage: the tune's first four bars at half speed, in A flat, on the soft piano.
HIDDEN = "C5:6 Eb5:2/3 C5:2/3 Bb4:2/3 | Ab4:4 -:2 Ab4:1 Eb5:1 | Ab5:3 F5:2 Eb5:3 | Db5:4 C5:4/3 Db5:4/3 F5:4/3"
# The waltz's bars (49 to 56): the violin's long pulls over it, climbing.
PULLS = "Eb5:8 | F5:8 | Gb5:8 | F#5:8"
# Splatter (bars 65 to 72): two bars each, then together.
F1_VIOLIN = (
    "F#5:1/2 B5:1/2 D#6:1 C#6:1/2 B5:1/2 F#5:1 | G#5:1/2 B5:1/2 F#5:1/3 G#5:1/3 B5:1/3 D#6:2 | -:4 | -:4 | "
    "G5:1.5 Bb5:1/2 Eb6:2 | D6:1/3 Bb5:1/3 G5:1/3 F5:1 Eb5:1 G5:1 | F#5:1/2 B5:1/2 D#6:1 F#6:2 | E6:1 C#6:1 A#5:1 F#5:1"
)
F1_PIANO = (
    "-:4 | -:4 | B4:1 -:1/2 D5:1/2 B4:1/3 A4:1/3 G4:1/3 E4:1 | D4:1.5 G4:1/2 A4:1 B4:1 | -:4 | -:4 | "
    "F#4:1/2 B4:1/2 D#5:1 F#5:2 | E5:1 C#5:1 A#4:1 F#4:1"
)
# The glockenspiel's solo (bars 45 to 60), high on the music box. A tune in the key's five plain notes; the long
# notes are two notes together, the lower a third, fourth, fifth or sixth under ("+"); slow bars, then quick ones;
# "!" is a short bright one; bars 57 and 59 are the big chords. (The rhythm is the second go's, bar for bar.)
SOLO = (
    "Ab6+C7:2 -:1 Bb6:1 | F6+Ab6:3 -:1 | F6:1 Ab6:1 Ab6+C7:2 | F6+Bb6:1.5 Ab6:1/2 Db6+F6:2 | "
    "Eb6:1/2 F6:1/2 Eb6+Ab6:1 -:1/2 C7:1/2 Bb6:1/2 Ab6:1/2 | F6+Bb6:2 -:1 Bb6:1/3 C7:1/3 Eb7:1/3 | "
    "C7+F7:1.5 Eb7:1/2 Ab6+C7:1 Eb6+Ab6:1 | F6+Bb6:1 -:1/2 Eb7!:1/2 Ab6+C7:2 | "
    "F6+Ab6:2.5 -:1/2 C7:1 | F6+C7:2 Bb6:1 F6:1 | Ab6:1/2 Bb6:1/2 C7:1/2 Eb7:1/2 Ab6+F7:2 | Bb6+Eb7:1 C7:1 F6+Bb6:2 | "
    "-:3 C7:1 | F7:1/2 Eb7:1/2 C7:1/2 Ab6:1/2 F6+Bb6:1 Ab6+C7:1 | -:4 | Eb6+Bb6:1 Eb6+Ab6:1 G6:1/2 Eb7!:1/2 -:1"
)
BIG = ((CALM + 16, "F6 Ab6 C7 Eb7"), (CALM + 18, "Eb6 Ab6 C7 Eb7"))  # its two big chords, rolled upward
FAST_END = "E5:1 A5:1 B5:1 D6:1/3 E6:1/3 G6:1/3"  # the last bar before the splash: up the chord that leads home
TAG = "F#5:3 A5:1/3 F#5:1/3 E5:1/3 | D5:3 -:1 | B5:2 A5:2 | G5:2 E5:2 | F#5:8 | -:8"
for _line, _beats in ((TUNE_A, 32), (TUNE_A2, 32), (TUNE_A3, 32), (HARM_A, 32), (COUNTER, 32), (INTRO, 24), (HIDDEN, 32), (PULLS, 32),
                      (F1_VIOLIN, 32), (F1_PIANO, 32), (FAST_END, 4), (TAG, 32), (SOLO, 64)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def pairs_of(start, text):
    """'Ab6+C7:2 -:1 Eb7!:.5' -> [(beat, beats, [midi, ...], short)]: notes struck together are joined by '+'; '!'
    after a note makes it a short bright one."""
    out, t = [], Fraction(start)
    for tok in text.replace("|", " ").split():
        name, d = tok.split(":")
        if name != "-":
            out.append((float(t), float(Fraction(d)), [n(one) for one in name.rstrip("!").split("+")], name.endswith("!")))
        t += Fraction(d)
    return out


def render(window=None, voice="box") -> np.ndarray:
    x = Ride(RIDE, BEATS, None, os=2, seed=211, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(53)
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

    def murk(k, cut):
        """Noise with its highs rolled off: a soft puff, never a hiss."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    def band(k, f, width):
        """Noise in a band `width` Hz wide round a centre that moves (`f`: Hz, a number or one per sample)."""
        ph = tau * np.cumsum(np.broadcast_to(f, k)) / sr
        return murk(k, width / 2) * np.cos(ph) + murk(k, width / 2) * np.sin(ph)

    def chord(bar, beat=0.0):
        """The bar's chord: its bass note, the keys' four notes, the strings' three, the drips' five (low, middle,
        the one that never moves, a color, high), its root near the middle of the keys, and its third, fifth,
        seventh and ninth."""
        root, kind, low, key = CHORDS[(bar - 1) % BARS]
        turn = kind == "s7"  # a bar that hangs for two beats, then falls: its fourth, then its third
        if turn:
            kind = "s" if beat < 2 else "7"
        pad, tones = KIND[kind]
        still = fold((key if key is not None else root) + 7, 76)
        deep = 36 if FAST <= bar <= FAST + 7 else 40
        climb = RUSH <= bar <= RUSH + 6  # the rush: the bass a whole step up each bar, and the waltz with it
        bass = 35 + 2 * (bar - RUSH) if climb else fold(root if low is None else low, deep)
        return SimpleNamespace(
            bass=bass, turn=turn,
            pad=sorted(fold(root + i, 57) for i in pad),
            strings=sorted(fold(root + pad[i], 62) for i in ((1, 2, 3) if kind == "s" else (0, 2, 3))),
            sky=[fold(root + tones[0], 74), fold(root + tones[2], 74), still, fold(root + tones[3], 79), fold(root + tones[0], 84)],
            root=bass + 24 if climb else fold(root, 66), tones=tones)

    chord_at = lambda beat: chord(int(beat // 4) % BARS + 1, beat % 4)

    # ---- the kit: a soft kick, a brushed snare, and the brush itself for cymbals ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(48 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.11))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass and the strings duck

    def snare(b, vol=0.24):
        """A snare under a brush: its body, and a soft rush with no crack on it."""
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(185 + 55 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.045)
        gate = np.minimum(1, np.maximum(0, (0.19 - t) / 0.03))
        put("snare", b, (0.75 * body + 0.9 * hiss(k, 7500, 0.45) * np.exp(-t / 0.1) * np.minimum(1, t / 0.0015)) * gate * vol, 0.05)

    def rim(b, vol=0.1, pan=-0.15):
        """A stick laid across the rim: a dry knock."""
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("snare", b, (np.sin(tau * 430 * t) * np.exp(-t / 0.014) + 0.5 * np.sin(tau * 1130 * t) * np.exp(-t / 0.005) + 0.4 * hiss(k, 9000, 0.5) * np.exp(-t / 0.002)) * tail(k) * vol, pan)

    def tap(b, vol=0.02, pan=0.2):
        """A brush's tap: a short breath of soft noise."""
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("strokes", b, hiss(k, 6500, 0.6) * np.sin(np.pi * np.minimum(1, t / 0.06)) ** 1.5 * vol, pan)

    def shake(b, vol=0.012, pan=-0.3):
        k = int(0.025 * sr)
        put("hats", b, hiss(k, 12000, 0.85) * np.exp(-np.arange(k) / sr / 0.007) * tail(k, 0.004) * vol, pan)

    # ---- his sounds, as the game builds them (packages/app/src/characters/smudgy-sounds.ts) ----
    def swish(b, secs=0.22, vol=0.03, pan=0.0, bus="strokes"):
        """His brush through the air: a rush that rises and falls, a faint rasp of bristle."""
        k = int(secs * sr)
        u = np.arange(k) / k
        put(bus, b, (2.6 * band(k, 500 + 2100 * np.sin(np.pi * u), 900) + 0.35 * band(k, 4200, 2100)) * np.sin(np.pi * u) ** 1.4 * vol, pan)

    def swipe(b, length, vol=0.05):
        """A broad brush swiped across, left to right: a long bristly rasp sweeping up, wet under it. The repaint."""
        at(b, length)
        k = x.k(length)
        u = np.arange(k) / k
        w = (1.4 * band(k, 1200 + 3000 * u, 1400) + 0.8 * murk(k, 900)) * np.sin(np.pi * u) ** 0.8 * (0.4 + 0.6 * u) * vol
        put("fx", b, w * (1 - u), -0.8), put("fx", b, w * u, 0.8)

    def splat(b, vol=0.2, pan=0.0, late=0.0):
        """A splat of paint: a short wet smack."""
        k = int(0.16 * sr)
        t = np.arange(k) / sr
        wet = np.sin(tau * np.cumsum(300 - 150 * np.minimum(1, t / 0.06)) / sr)
        put("splat", b, (1.6 * band(k, 1900 - 1200 * np.minimum(1, t / 0.05), 1200) + 0.7 * wet) * np.exp(-t / 0.035) * tail(k) * vol, pan, late=late)

    def plop(f, k, fall=0.9, secs=0.022):
        """A drop's note: it falls into its pitch."""
        t = np.arange(k) / sr
        return np.sin(tau * np.cumsum(f * (1 + fall * np.exp(-t / secs))) / sr)

    def splash(b, vol=0.3, big=False):
        """A glob of paint slapping a wall: a wet smack, a squelch under it, a few drops pattering after. `big`: with
        the thump of the whole bucket, and the wall ringing."""
        k = int((1.2 if big else 0.42) * sr)
        t = np.arange(k) / sr
        slap = band(k, 1500 - 900 * np.minimum(1, t / 0.08), 1000)
        squelch = np.sin(tau * np.cumsum(240 - 120 * np.minimum(1, t / 0.12) + 40 * np.sin(tau * 38 * t)) / sr)
        w = np.exp(-t / 0.05) * (1.5 * slap + 0.8 * squelch) + np.exp(-t / (0.22 if big else 0.1)) * 0.9 * murk(k, 900)
        if big:
            ph = tau * np.cumsum(40 + 90 * np.exp(-t / 0.05)) / sr
            w = w + 1.3 * np.tanh(2.0 * np.sin(ph) * np.exp(-t / 0.3)) + 0.35 * np.sin(2 * ph) * np.exp(-t / 0.2)
            put("duck", b, np.ones(1))
        put("land" if big else "splat", b, w * tail(k, 0.03) * vol)
        for i in range(7 if big else 4):
            kk = int(0.07 * sr)
            tt = np.arange(kk) / sr
            late = 0.1 + (0.5 if big else 0.2) * rng.uniform()
            put("land" if big else "splat", b, plop(1700 + 900 * rng.uniform(), kk, 0.5, 0.01) * np.exp(-tt / 0.015) * tail(kk) * 0.3 * vol, rng.uniform(-0.7, 0.7), late=late)

    def drip(b, vol=0.06, pan=0.0):
        """His drip: a round plink of a drop falling into a puddle, a smaller one after it."""
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        put("fx", b, plop(620, k) * np.exp(-t / 0.05) * tail(k) * vol, pan)
        put("fx", b, 0.6 * plop(880, k) * np.exp(-t / 0.045) * tail(k) * vol, pan, late=0.16)

    def giggle(b, vol=0.035, pan=0.3):
        """His giggle: four quick hiccups of a light voice, each a little higher, the last longer. No breath in it."""
        for i, (late, f) in enumerate(((0, 620), (0.085, 700), (0.17, 650), (0.255, 760))):
            k = int((0.14 if i == 3 else 0.06) * sr)
            t = np.arange(k) / sr
            ph = tau * np.cumsum(f * (1 + 0.04 * np.sin(tau * 9 * (t + late))) * (1 + 0.5 * np.exp(-t / 0.015))) / sr
            put("fx", b, (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.sin(np.pi * np.arange(k) / k) ** 1.2 * vol, pan, late=late)

    def dab(b, vol=0.06, pan=-0.3):
        """A dab: a damp little tap of the brush on the palette."""
        k = int(0.13 * sr)
        t = np.arange(k) / sr
        tapped = np.sin(tau * np.cumsum(420 - 220 * np.minimum(1, t / 0.05)) / sr)
        put("fx", b, (tapped + 0.7 * np.exp(-t / 0.015) * band(k, 1100, 550)) * np.exp(-t / 0.03) * tail(k) * vol, pan)

    # ---- the fast pattern: drips ----
    def plink(b, m, vol=0.05, pan=0.0, late=0.0):
        """A drop with a note in it: it falls a little way into its pitch, rings round, and is gone."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * (1 + 0.3 * np.exp(-t / 0.012))) / sr
        put("drips", b, (np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)) * np.minimum(1, t / 0.003) * np.exp(-t / 0.085) * tail(k) * vol, pan, late=late)

    def drips(bar, vol=1.0, keep=1, lower=False):
        """A bar of drips: the 8th pattern, each at its own size; `keep`: only every such-th one; `lower`: a second,
        softer set an octave down, an 8th behind."""
        for i in range(8):
            if i % keep:
                continue
            t = bar0(bar) + i / 2
            sky = chord_at(t).sky
            v = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 2 == 0 else 1.0)
            pan = 0.55 * np.sin(i * 1.7 + bar)
            plink(t, sky[DRIPS[i]], 0.05 * v, pan)
            if lower:
                plink(t + 0.5, sky[DRIPS[(i + 3) % 8]] - 12, 0.028 * v, -pan)

    # ---- splatter: plucked strings that die at once ----
    def pizz(b, m, vol=0.08, pan=0.0, late=0.0):
        k = int(0.5 * sr)
        t = np.arange(k) / sr
        put("pizz", b, x.struck("koto", m)[:k] * np.exp(-t / 0.1) * tail(k, 0.05) * vol, pan, late=late)

    def spatter(b, vol=1.0, up=0):
        """Paint flicked off the brush: five drops of the chord inside a beat, thrown wide, each smaller."""
        sky = chord_at(b).sky
        for j, (off, i, pan) in enumerate(((0, 4, -0.6), (1 / 6, 1, 0.55), (1 / 3, 3, -0.25), (2 / 3, 0, 0.7), (5 / 6, 4, 0.1))):
            pizz(b + off, sky[i] + up + (12 if j == 4 else 0), 0.085 * vol * (1 - 0.13 * j), pan)

    # ---- the low end ----
    def bass(b, m, length, vol=0.4):
        """A deep note driven so small speakers hear it, with a round pluck an octave up."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        env = np.minimum(1, t / 0.006) * np.exp(-t / (length * x.beat_s * 2.0)) * tail(k, 0.02)
        w = np.tanh(2.2 * np.sin(ph)) / np.tanh(2.2) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        mid = 0.45 * np.sin(2 * ph + 1.6 * np.exp(-t / 0.09) * np.sin(2 * ph)) * np.exp(-t / 0.3)
        put("bass", b, (w + mid) * env * vol)

    def sub(b, m, length, vol=0.5):
        """The 808."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def walk(bar, vol=1.0, run=False):
        """The bass's bar: the root, long; its octave, short, off the beat; and a step into the next bar's root (from
        above if that root is lower, from a half step under if it is higher). `run`: busier, for the rush."""
        b = bar0(bar)
        low, nxt = chord(bar).bass, chord(bar + 1).bass
        step = low + 7 if nxt == low else nxt + 2 if nxt < low else nxt - 1
        if run:
            for off, m, d, v in ((0, low, 1.4, 0.4), (1.5, low + 12, 0.45, 0.28), (2, low, 0.9, 0.36), (3, low + 7, 0.45, 0.28), (3.5, step, 0.45, 0.32)):
                bass(b + off, m, d, v * vol)
        else:
            bass(b, low, 2.3, 0.4 * vol), bass(b + 2.5, low + 12, 0.4, 0.26 * vol), bass(b + 3.5, step, 0.45, 0.32 * vol)

    # ---- the chords ----
    def ep(b, m, long, vol=0.04, pan=0.0):
        """An electric piano's note: FM, a soft bell on its front."""
        k = int((3 * long + 0.1) * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.sin(ph + 1.0 * np.exp(-t / 0.06) * np.sin(4 * ph) + 0.4 * np.sin(ph)) * np.exp(-t / long)
        put("keys", b, w * np.minimum(1, t / 0.0015) * tail(k, 0.1) * vol, pan)

    def comp(bar, vol=1.0):
        """The electric piano's bar: the chord on 1, and again pushed ahead of 3 (in a bar that turns, on 3: the
        chord it falls to)."""
        for off, d in ((0, 1.7), (2, 1.8)) if chord(bar).turn else ((0, 1.3), (1.5, 2.3)):
            b = bar0(bar) + off
            at(b, d)
            for j, m in enumerate(chord(bar, off).pad):
                ep(b, m, max(0.12, d * x.beat_s * 0.55), 0.04 * vol, (-0.4, -0.15, 0.15, 0.4)[j])

    def strings(bar, vol=0.04, length=4.0, slow=False):
        at(bar0(bar), length)
        for j, m in enumerate(chord(bar).strings):
            put("pad", bar0(bar), x.strings(m, length, vol, attack=0.4 if slow else 0.12, release=0.5 if slow else 0.2), (-0.45, 0.0, 0.45)[j])

    def felt(b, m, vol=0.1, pan=0.0, late=0.0):
        put("felt", b, x.struck("felt", m) * vol, pan, late=late)

    def roll(bar, vol=0.07, off=0.0, wide=False):
        """The soft piano's chord, rolled from the bottom. `wide`: a big one, both hands: the bass under it and the
        chord again an octave up."""
        c = chord(bar, off)
        for j, m in enumerate([c.bass + 12] + c.pad):
            felt(bar0(bar) + off, m, vol * (1.0 if j else 1.2), (-0.3, -0.15, 0.0, 0.15, 0.3)[j], late=0.055 * j)
        if wide:
            felt(bar0(bar) + off, c.bass, vol * 1.1, -0.2)
            for j, m in enumerate(c.pad):
                felt(bar0(bar) + off, m + 12, vol * 0.6, (-0.2, 0.0, 0.2, 0.35)[j], late=0.055 * (5 + j))

    def box(b, m, vol=0.035, pan=0.3, late=0.0, ring=1.4):
        k = int(ring * sr)
        put("box", b, x.struck("box", m)[:k] * tail(k, min(0.2, 0.6 * ring)) * vol, pan, late=late)

    def chime(b, ms, vol=0.04, pan=0.0, roll_s=0.0, short=False):
        """The solo's voice: one note, two together, or a chord rolled upward; the top one sings. The music box, up
        where it rings like a glockenspiel; or (`voice` "drop") the drips' round plink."""
        for j, m in enumerate(ms):
            side = pan if len(ms) == 1 else pan - 0.14 + 0.28 * j / (len(ms) - 1)
            v = vol * (1.0 if j == len(ms) - 1 else 0.75) * (1.25 if short else 1.0)
            if voice == "drop":
                plink(b, m, 1.5 * v, side, late=roll_s * j)
            else:
                box(b, m, v, side, late=roll_s * j, ring=0.22 if short else 1.4)

    def twinkle(bar, vol=1.0, spots=((1.5, 4, 0.3), (3.0, 2, -0.3))):
        """The music box: two high notes a bar."""
        for off, i, pan in spots:
            box(bar0(bar) + off, chord(bar, off).sky[i] + 12, 0.035 * vol, pan)

    def hall(name, secs=3.0, wet=0.5):
        """A long echo for a voice: his studio, high and bare."""
        if name not in x.buses:
            return
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.03)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 4000) ** 2) * (f > 60), n=size, axis=1)

    # ---- the voices ----
    def bowed(start, text, vol=1.0, pan=0.2, up=0, bus="lead"):
        """The violin: a little slide up into each note, vibrato on the long ones; a long note is one pull of the bow,
        leaning in and easing off."""
        for b, d, m in notes(start, text):
            at(b, d)
            w = x.fiddle(m + up, d * 0.96, 0.145 * vol)
            if d >= 2:
                w = w * (0.76 + 0.24 * np.sin(np.pi * np.linspace(0, 1, len(w))) ** 0.8)
            put(bus, b, w, pan)

    strung = {}

    def string(m):
        """A note of the bright piano: three strings a hair apart, overtones to 9 kHz that die sooner the higher they
        are, the hammer's tick. Its loudest point 1; kept once made."""
        if m not in strung:
            k = int(1.6 * sr)
            t = np.arange(k) / sr
            f0 = x.hz(m)
            h = np.arange(1, min(24, max(2, int(9000 / f0))) + 1)
            w = np.zeros(k)
            for off in (-1.5, 0.3, 1.6):
                ph = np.outer(h * np.sqrt(1 + 0.0004 * h * h), tau * f0 * 2 ** (off / 1200) * t) + h[:, None]
                w += ((1 / h**1.25)[:, None] * np.sin(ph) * np.exp(-np.outer(1 + 0.35 * h, t) / (0.9 * (262 / f0) ** 0.35))).sum(axis=0)
            w = w * np.minimum(1, t / 0.002) + 0.2 * hiss(k, 9000, 0.5) * np.exp(-t / 0.004)
            strung[m] = w / np.abs(w).max() * tail(k, 0.15)
        return strung[m]

    def key(b, d, m, vol=1.0, pan=-0.2, octave=0.8):
        """A note on the piano, in octaves: let go a little after the next begins."""
        at(b, d)
        k = min(int(1.6 * sr), x.k(d + 0.3))
        fade = int(0.08 * sr)
        for up, a in ((0, 1.0), (12, octave)):
            w = string(m + up)[:k]
            put("piano", b, w * np.minimum(1, (len(w) - np.arange(len(w))) / fade) * 0.2 * vol * a * (1.0 if d >= 0.75 else 0.85), pan)

    def keys(start, text, vol=1.0, pan=-0.2, up=0):
        for b, d, m in notes(start, text):
            key(b, d, m + up, vol, pan)

    def waltz(start, count, v0, v1, lift=0, violin=0.0):
        """His little waltz: a motif three beats long (two 8ths up and a long note) over bars of four, so it starts
        somewhere new in every bar; three shapes of it on whatever chord it finds, each starting higher."""
        for r in range(count):
            b = start + 3 * r
            v = v0 + (v1 - v0) * r / max(1, count - 1)
            for j, (off, d) in enumerate(((0, 0.5), (0.5, 0.5), (1, 2))):
                c = chord_at(b + off)
                t3, _, t7, _ = c.tones
                m = c.root + lift + ((-5, t3, 7), (0, 7, t7), (t3, t7, 14))[r % 3][j]
                key(b + off, d * 0.9, m, v, octave=0.5)
                if violin:
                    at(b + off, d)
                    put("lead", b + off, x.fiddle(m, d * 0.94, 0.145 * violin * v), 0.2)

    # ---- the band, bar by bar ----
    def groove(bar, vol=1.0, kicks=(0, 10), snares=(4, 12), ghosts=(), rims=(), strokes=1.0, shakes=0.0, low=1.0, run=False, chords=1.0, pad=0.0,
               drops=1.0, keep=1, lower=False, deep=0.0):
        """A bar of the band, in 16ths: the two-step (a kick on 1 and ahead of 4, the snare on 2 and 4), quiet snare
        strokes between; the brush swishing left and right on the 8ths, leaning on the off ones; the bass walking; the
        electric piano; the strings; the drips; an 808 on 1 (`deep`)."""
        b = bar0(bar)
        at(b, 4)
        s8 = x.beat_s / 2
        for i in kicks:
            kick(b + i / 4, (0.5 if i == 0 else 0.42) * vol)
        for i in snares:
            snare(b + i / 4, 0.24 * vol)
        for i in ghosts:
            snare(b + i / 4, 0.06 * vol)
        for i in rims:
            rim(b + i / 4, 0.1 * vol)
        if strokes:
            for i in range(8):
                swish(b + i / 2, 0.8 * s8, 0.03 * strokes * vol * (1.0 if i % 2 else 0.7), 0.5 if i % 2 else -0.5)
        if shakes:
            for i in range(16):
                shake(b + i / 4, 0.012 * shakes * vol * (1.0 if i % 4 == 2 else 0.6))
        if low:
            walk(bar, low * vol, run)
        if deep:
            sub(b, chord(bar).bass, 1.6, deep * vol)
        if chords:
            comp(bar, chords * vol)
        if pad:
            strings(bar, pad)
        if drops:
            drips(bar, drops, keep, lower)

    def fill(bar, vol=1.0, start=2.0):
        """The end of a section: the brush on the snare in 16ths from `start`, growing."""
        b = bar0(bar)
        count = int((4 - start) * 4)
        for i in range(count):
            snare(b + start + i / 4, (0.07 + 0.11 * i / (count - 1)) * vol)

    # Bars 1-8: the blank canvas, at half pace. The soft piano rolls each bar's chord; the brush strokes left, right,
    # on every beat; a music box; a drip here and there; from bar 3 the violin, low. From bar 5 the bass and drops on
    # the beats. Bars 7-8 run up to speed: the brush tapping faster, a swipe, into the first coat.
    for bar in range(1, 9):
        b = bar0(bar)
        roll(bar, 0.075)
        if bar <= 6:
            for i in range(4):
                swish(b + i, 0.42, 0.034 * (1.0 if i % 2 == 0 else 0.75), 0.5 if i % 2 else -0.5)
            twinkle(bar)
        if bar >= 3:
            strings(bar, 0.026 + 0.004 * (bar - 3), slow=True)
        if bar >= 5:
            bass(b, chord(bar).bass, 3.6, 0.28)
            drips(bar, 0.8, keep=2 if bar < 7 else 1)
    drip(bar0(2) + 2.5, 0.07, -0.4), drip(bar0(4) + 1.5, 0.06, 0.4), dab(bar0(5) + 3.5, 0.05)
    bowed(bar0(3), INTRO, 0.85, up=-12)
    for i in range(8):
        tap(bar0(7) + i / 2, 0.02 + 0.002 * i, 0.4 if i % 2 else -0.4)
    for i in range(16):
        tap(bar0(8) + i / 4, 0.03 + 0.002 * i, 0.4 if i % 2 else -0.4)
    kick(bar0(7), 0.34), kick(bar0(8), 0.4), kick(bar0(8) + 2, 0.42)
    fill(8, 0.9, start=3.0)
    swipe(bar0(9) - 2, 2.0, 0.055)

    # Bars 9-24: first coat, in D. The tune on the violin: low for eight bars over the plain two-step and drops on the
    # beats; then its second half an octave up, the whole pattern of drips, the snare's quiet strokes; the piano dabs
    # in the tune's gaps; paint flicked at the phrase ends. The last two bars are already F: a swipe, and it is.
    splat(bar0(9), 0.16, -0.2)
    for bar in range(9, 25):
        second = bar >= 17
        groove(bar, ghosts=(7, 15) if second else (), drops=1.0 if second else 0.9, keep=1 if second else 2, pad=0.024 if second else 0.0)
    bowed(bar0(9), TUNE_A, up=-12)
    bowed(bar0(17), TUNE_A2)
    for bar, text in ((10, "-:2.25 F#5:1/4 A5:1/4"), (14, "-:2.75 E5:1/4 G5:1/4"), (18, "-:2.25 A5:1/4 C#6:1/4"), (22, "-:2.75 G5:1/4 E6:1/4")):
        keys(bar0(bar), text, 0.5)
    spatter(bar0(12) + 3), spatter(bar0(16) + 3, 0.9), spatter(bar0(20) + 3), spatter(bar0(23) + 3, 0.9)
    fill(16, 0.8, start=3.0), fill(24)
    swipe(bar0(25) - 2, 2.0, 0.06)

    # Bars 25-40: second coat, in F. The piano has the tune (in octaves), the violin its long notes underneath; the
    # strings, the shaker, the lower drips from bar 33. Then they trade: the violin two bars, the piano two, the violin
    # two, and the last two together, leaning into A flat.
    splat(bar0(25), 0.2, 0.2), x.crash(bar0(25), 0.12, decay=0.5)
    for bar in range(25, 41):
        groove(bar, ghosts=(7, 15), shakes=1.0, pad=0.03, lower=bar >= 33)
    keys(bar0(25), TUNE_A, up=3 - 12)
    bowed(bar0(25), HARM_A, 0.62, up=3 - 12)
    bowed(bar0(33), bars_of(TUNE_A2, 1, 2), up=3), keys(bar0(35), bars_of(TUNE_A2, 3, 4), up=3 - 12)
    bowed(bar0(37), bars_of(TUNE_A2, 5, 6), up=3)
    bowed(bar0(39), bars_of(TUNE_A2, 7, 8), up=3), keys(bar0(39), bars_of(TUNE_A2, 7, 8), 0.85, up=3 - 12)
    spatter(bar0(28) + 3, up=0), spatter(bar0(32) + 3, 0.9), spatter(bar0(36) + 3), spatter(bar0(38) + 3, 0.8)
    fill(32, 0.8, start=3.0), fill(40)
    swipe(bar0(41) - 2, 2.0, 0.06)

    # Bars 41-60: camouflage, in A flat. The kit is gone and so is the brush; one bass note under everything for twelve
    # bars, then the bass moves; slow strings on chords with the raised fourth; the drips at half speed. The tune hides
    # in the soft piano at half speed, twice. Four bars as they were (the music box's few high notes); then the same
    # voice's solo; a big chord (F minor, bar 57), a quick answer, a bigger one (A flat, bar 59), and a last word
    # that ends on a short bright note. His drip, a dab, and once, a giggle.
    splat(bar0(CALM), 0.12, -0.3)
    for bar in range(CALM, WALTZ):
        b = bar0(bar)
        loud = bar in (CALM + 16, CALM + 18)
        roll(bar, 0.1 if loud else 0.05, wide=loud)
        if chord(bar).turn:
            roll(bar, 0.05, off=2.0)
        strings(bar, 0.056 if loud else 0.04, slow=True)
        bass(b, chord(bar).bass, 3.7, 0.3 if loud else 0.24)
        drips(bar, 0.7 if bar < CALM + 4 else 0.4, keep=2)
        if bar < CALM + 4:
            twinkle(bar, 0.8, spots=((2.5, 4, 0.3),) if bar % 2 else ((1.5, 2, -0.3), (3.5, 3, 0.3)))
    for start, vol in ((CALM, 1.0), (CALM + 8, 0.8)):
        for b, d, m in notes(bar0(start), HIDDEN):
            felt(b, m, 0.17 * vol, 0.05), felt(b, m + 12, 0.06 * vol, -0.1)
    for i, (b, d, ms, short) in enumerate(pairs_of(bar0(CALM + 4), SOLO)):
        chime(b, ms, 0.048, 0.25 * np.sin(1.3 * i), short=short)
    for bar, text in BIG:
        chime(bar0(bar), [n(one) for one in text.split()], 0.05, 0.0, roll_s=0.045)
    drip(bar0(CALM + 1) + 3, 0.06, 0.4), dab(bar0(CALM + 3) + 2.5, 0.05), giggle(bar0(WALTZ) - 0.9, 0.03)

    # Bars 61-68: his little waltz. The kit comes back small (the kick, a rim for the snare, the brush); the bass walks
    # the blend again; the piano's three-beat motif turns against the bar, growing; the violin's long pulls climb over
    # it. The seventh chord is B: the next color.
    for bar in range(WALTZ, RUSH):
        groove(bar, vol=0.85, snares=(), rims=(4, 12), pad=0.03, drops=0.9)
    waltz(bar0(WALTZ), 10, 0.55, 0.9)
    bowed(bar0(WALTZ), PULLS, 0.8)
    spatter(bar0(WALTZ + 3) + 3, 0.8)
    fill(RUSH - 1, 0.8)
    swipe(bar0(RUSH) - 2, 2.0, 0.06)

    # Bars 69-76: the rush. The chords climb by whole steps (B, C sharp, E flat, F, G, A, B) while the pace climbs from
    # 172 to 226; the waltz goes on, the violin with it; the bass runs; the snare comes onto every beat, then rolls;
    # the splats come faster.
    for i, bar in enumerate(range(RUSH, FAST)):
        groove(bar, vol=0.9 + 0.02 * i, kicks=(0, 10) if i < 4 else (0, 6, 10) if i < 6 else (0, 4, 8, 12), snares=(4, 12) if i < 6 else (4, 8, 12),
               ghosts=(7, 15), shakes=1.0, run=True, pad=0.03 + 0.003 * i, lower=i >= 4)
    waltz(bar0(RUSH), 10, 0.85, 1.0, violin=0.85)
    for i, offs in ((0, (0,)), (2, (2,)), (4, (0, 2.5)), (5, (1.5,)), (6, (0, 2, 3)), (7, (0, 1, 2, 3))):
        for j, off in enumerate(offs):
            splat(bar0(RUSH + i) + off, 0.13 + 0.012 * i, 0.6 if (i + j) % 2 else -0.6)
    for i in range(16):
        snare(bar0(FAST - 1) + i / 4, 0.07 + 0.008 * i)
    spatter(bar0(RUSH + 3) + 3, 0.9), spatter(bar0(RUSH + 5) + 3), spatter(bar0(RUSH + 6) + 1, 0.9, up=12)
    swipe(bar0(FAST) - 2, 2.0, 0.07)

    # Bars 77-84: splatter, at 226. Three colors a major third apart (B, G, E flat), two bars each; the violin and the
    # piano trade two bars each, then play the last two together; an 808 under each bar; splats off the beat.
    splash(bar0(FAST), 0.22), x.crash(bar0(FAST), 0.16, decay=0.6)
    for bar in range(FAST, LAND):
        groove(bar, kicks=(0, 6, 10), ghosts=(7, 15), run=True, pad=0.034, lower=True, deep=0.42)
    bowed(bar0(FAST), F1_VIOLIN), keys(bar0(FAST), F1_PIANO)
    for i, offs in ((1, (3.5,)), (3, (2.5, 3.5)), (4, (1.5,)), (5, (3.5,)), (7, (0.5, 1.5, 2.5, 3.5)), (9, (3.5,)), (11, (1.5, 3.5)), (13, (3.5,))):
        for j, off in enumerate(offs):
            splat(bar0(FAST + i) + off, 0.15, 0.6 if (i + j) % 2 else -0.6)
    spatter(bar0(FAST + 2), 0.9, up=12), spatter(bar0(FAST + 6) + 3)

    # Bars 85-92: the tune at 226, the violin and the piano together, a second violin under them; B blends its way
    # down to D. The last bar runs up the chord that leads home; the snare rolls; a swipe.
    x.crash(bar0(FAST + 8), 0.14, decay=0.6)
    bowed(bar0(FAST + 8), bars_of(TUNE_A, 1, 7), up=-3), keys(bar0(FAST + 8), bars_of(TUNE_A, 1, 7), 0.9, up=-3 - 12)
    bowed(bar0(FAST + 8), bars_of(HARM_A, 1, 7), 0.6, -0.25, up=-3, bus="lead2")
    bowed(bar0(LAND - 1), FAST_END), keys(bar0(LAND - 1), FAST_END, 0.9, up=-12)
    for i in range(16):
        snare(bar0(LAND - 1) + i / 4, 0.07 + 0.009 * i)
    spatter(bar0(FAST + 11) + 3), spatter(bar0(FAST + 14) + 3, up=12)
    swipe(bar0(LAND) - 2, 2.0, 0.075)

    # Bars 93-94: one big splash on the beat; everything stops; the paint runs down the wall, drop by drop; he
    # giggles; two notes of the violin and the brush, and the picture is there.
    b = bar0(LAND)
    splash(b, 0.5, big=True)
    for i, (off, name) in enumerate(((1.0, "A6"), (1.75, "F#6"), (2.5, "E6"), (3.5, "D6"), (4.5, "B5"), (5.5, "A5"))):
        plink(b + off, n(name), 0.07 * 0.86**i, (-0.5, 0.4, -0.2, 0.5, -0.4, 0.2)[i])
    giggle(b + 4.5, 0.04)
    bowed(b + 7, "A4:1/2 D5:1/2", 0.9, up=0)
    for i in range(4):
        tap(b + 7 + i / 4, 0.03 + 0.006 * i, 0.4 if i % 2 else -0.4)

    # Bars 95-110: the finished picture, in D. The tune on the violin with a second violin a third or a sixth under
    # it, the piano an octave below; everything in: the shaker, the strings, both sets of drips, an 808 on each bar.
    # Its second half stays home, by way of B flat.
    splat(bar0(HOME), 0.2, 0.0), x.crash(bar0(HOME), 0.16, decay=0.6)
    for bar in range(HOME, TAG_AT):
        groove(bar, ghosts=(7, 15), shakes=1.0, pad=0.034, lower=True, deep=0.36)
    bowed(bar0(HOME), TUNE_A), bowed(bar0(HOME), HARM_A, 0.62, -0.25, bus="lead2"), keys(bar0(HOME), TUNE_A, 0.6, up=-12)
    bowed(bar0(HOME + 8), TUNE_A3), bowed(bar0(HOME + 8), COUNTER, 0.6, -0.25, bus="lead2"), keys(bar0(HOME + 8), TUNE_A3, 0.6, up=-12)
    spatter(bar0(HOME + 3) + 3), spatter(bar0(HOME + 7) + 3, 0.9, up=12), spatter(bar0(HOME + 11) + 3), spatter(bar0(HOME + 14) + 3, 0.9)
    fill(HOME + 7, 0.8, start=3.0), fill(TAG_AT - 1)

    # Bars 111-118: the tag. The stroke and its flick once more over a lighter kit; then the violin's last long note
    # while the kit thins to the brush on the beats; then only the soft piano, a music box and a drop on every other
    # beat: bar 1's pulse.
    for bar in range(TAG_AT, TAG_AT + 4):
        groove(bar, vol=0.85, snares=(), rims=(4, 12), pad=0.03, drops=0.9)
    for bar in (TAG_AT + 4, TAG_AT + 5):
        b = bar0(bar)
        roll(bar, 0.06), strings(bar, 0.03, slow=True)
        bass(b, chord(bar).bass, 3.6, 0.26)
        for i in range(4):
            swish(b + i, 0.26, 0.026 * (1.0 if i % 2 == 0 else 0.75), 0.5 if i % 2 else -0.5)
        drips(bar, 0.75, keep=2)
    for bar in (TAG_AT + 6, TAG_AT + 7):
        b = bar0(bar)
        roll(bar, 0.06), strings(bar, 0.022, slow=True)
        for i in (0, 2):
            swish(b + i, 0.4, 0.028, 0.5 if i else -0.5)
            plink(b + i, chord(bar).sky[2], 0.04, 0.3 if i else -0.3)
        twinkle(bar, 0.9)
    bowed(bar0(TAG_AT), TAG)
    drip(bar0(BARS) + 1, 0.06, 0.4)

    # The bass and the strings duck under each kick and under the splash.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    for name, least in (("bass", 0.0), ("sub", 0.0), ("pad", 0.45)):
        if name in x.buses:
            x.buses[name] *= least + (1 - least) * gain

    for name, secs, wet in (("land", 3.0, 0.6), ("splat", 1.4, 0.3), ("pizz", 2.6, 0.7), ("drips", 2.0, 0.4), ("box", 2.2, 0.5), ("felt", 1.8, 0.3),
                            ("fx", 1.6, 0.35), ("lead", 1.4, 0.16), ("lead2", 1.4, 0.2), ("piano", 1.2, 0.12)):
        hall(name, secs, wet)
    x.at(bar0(10), 1.0)  # the echoes' beat: the song's own, at 172
    x.echo("lead", 0.75, 0.13, 0.05)
    x.echo("lead2", 0.75, 0.13, 0.05)
    x.echo("piano", 0.75, 0.1, 0.04)
    x.echo("drips", 0.75, 0.2, 0.08)
    x.echo("pizz", 0.5, 0.25, 0.12)
    levels = {"lead": 0.72, "lead2": 0.9, "piano": 1.2, "felt": 1.0, "box": 1.8, "keys": 1.25, "pad": 1.7, "bass": 0.4, "sub": 0.42, "kick": 0.56,
              "snare": 1.04, "drum": 1.4, "strokes": 0.68, "hats": 5.0, "drips": 2.0, "pizz": 2.0, "splat": 0.45, "land": 0.4, "fx": 1.25}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.18))


def main(out: str, voice: str = "box") -> None:
    write_wav(out, render(voice=voice))


if __name__ == "__main__":
    main(*sys.argv[1:])
