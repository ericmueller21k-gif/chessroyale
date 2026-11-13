"""Song X (Eric, Nov 13): Chub & Chirp's theme (the rabbit who rides the grasshopper), a two-minute loop. His direction:
"start out with some like night sort of cicada cricket chirping, kind of starts out more melodic and then sort of
builds up a little bit, and then has a nice kind of drop and I like the idea of like some thumping ... that's like off
beat and off rhythm throughout it. Like some different kind of tempo for it too. Like maybe it's like quick, like, you
know, one, two, three ... that could make it sound kind of choppy ... thumping, and maybe even like one or two ... a
deep one that almost sounds like it's like echoing out, like it's like a big jump, like a literal like hop ... a
landing hop."
So the song hops (recipe: SOUNDS.md). It is counted in four beats of three 8ths (his "one, two, three": a lilt, not a
chop), E minor with a raised sixth, about 126 beats a minute. The idea from their world that runs the song: a hop is a
push, a moment in the air and a landing, and crickets go quiet when something big lands near them. Twice the whole band
takes off (a spring's boing rising, a roll, the tape itself running a half step sharp), hangs for a beat of nothing,
and lands: one deep thump with its echoes going out over the meadow, the crickets silent, coming back one by one. The
first landing is the hush before the drop; a small one is the loop's seam. The second go's other landing (Eric, Nov 13,
of the first go's takeoff into the last tune: "before that final, strong part ... it starts doing like a drum beat.
Like a tap, tap, tap ... like the marching ... something is getting closer and closer to you. It's getting like
louder. And then the final one is like a big thud ... all the other background stuff kind of pauses for a second when
the thud hits, and then ... softly echoes out like 4 or 5 times ... a rippling thud effect where it's like getting
quieter, and then ... it jumps into that big ending"; the song "a bit longer, even if it's like 10, 15 seconds"): out
of the calm come footfalls, one a beat for three bars, each nearer (louder, deeper, drier, a drum's tap on each); the
twelfth's place is the thud; everything stops; five echoes go out, each quieter and duller; then the last tune.
The thumping: a rabbit's hind foot (as the game makes it) keeps its own time, every five 8ths against the bar's twelve,
so it lands somewhere new each bar; in the second tune it is his three stamps (one, two, THREE) at the start of a
motif seven 8ths long, twelve of them in seven bars, the chords climbing a whole step every seven beats under them.
The bass leapfrogs (E, G, F#, A, G, B: up a third, back a step) under one note that never moves (B, in every chord),
then a chord from outside the key (C) and the turn home; it plays in octave hops. The tunes leap and float down; in
the second verse the two leads leapfrog, each coming in over the other's last note. The drop walks down by major
thirds (E minor, C minor, A flat minor). The last tune lands a minor third up, in G minor.
Chirp is the square lead with a chirp at the front of each long note; Chub is the fiddle; a gritty synth answers in
the drop. The fast pattern is the crickets (their trill as the game builds it, a chirp on every 8th) and fireflies (a
soft blip pattern coming back to B). The night at each end and in the calm: crickets, a cicada, a pan flute with the
tune's first hop played slowly, a low marimba; carrots pulled, far off.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_x.py <out.wav>

  bars  1-8    night: the landing's echo, crickets starting one by one, a cicada; the pan flute's slow tune; it builds
  bars  9-16   Chirp's tune over the leapfrogging bass; the rabbit's foot every five 8ths
  bars 17-24   the second verse: Chirp and Chub (the fiddle) leapfrog, then tumble down together
  bars 25-31   the second tune: seven 8ths long, twelve times, his three stamps at each; the chords climbing
  bar  32      takeoff: a boing, a roll, everything rising; a beat in the air
  bar  33      the landing: one deep thump, its echoes; the crickets silent, then one
  bars 34-45   the drop: an 808, a wobble bass; Chirp and the gritty synth trade two bars each, then play together
  bars 46-53   the calm: night again, slower; the pan flute and the low marimba; carrots pulled; a far landing
  bars 54-56   something coming: a footfall a beat, nearer each time, the night going on round it
  bar  57      the thud; everything stops; its echoes going out, five of them
  bars 58-65   the last tune, a minor third up: both leads, then their tumble in harmony
  bars 66-67   the tag: home by way of C and B; a last hop, which lands on bar 1
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BARS = 67
BEATS = 4 * BARS  # a beat is three 8ths: a note of 1/3 is an 8th
TAPE = 130.0
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
# The pace: beats a minute (from, to), and the tape's speed (the takeoffs run it sharp; it comes down through the landing).
RIDE = [
    (bar0(1), bar0(5), 108, 108, 1.0, 1.0, 0.0),  # a cool night
    (bar0(5), bar0(9), 108, 126, 1.0, 1.0, 0.0),  # the crickets warm up
    (bar0(9), bar0(32), 126, 126, 1.0, 1.0, 0.0),
    (bar0(32), bar0(32) + 3, 126, 126, 1.0, 1.06, 0.0),  # takeoff
    (bar0(32) + 3, bar0(33) + 2, 126, 126, 1.06, 1.0, 0.0),  # in the air, and down
    (bar0(33) + 2, bar0(34), 126, 126, 1.0, 1.0, 0.0),
    (bar0(34), bar0(46), 132, 132, 1.0, 1.0, 0.0),  # the drop
    (bar0(46), bar0(54), 104, 104, 1.0, 1.0, 0.0),  # the calm
    (bar0(54), bar0(57), 108, 108, 1.0, 1.0, 0.0),  # something coming, at a march
    (bar0(57), bar0(58), 80, 80, 1.0, 1.0, 0.0),  # the thud and its echoes, half a second apart
    (bar0(58), bar0(66), 134, 134, 1.0, 1.0, 0.0),  # the last tune
    (bar0(66), BEATS, 134, 108, 1.0, 1.0, 0.0),  # the tag, slowing into the night
]

# A chord: its bass note; the strings' three; the fireflies' five (low, middle, the one they keep coming back to, a
# color, high). "+3" after a name: a minor third up (the last tune).
MEADOW = {
    "Em": ("E2", "E3 B3 G4", "E5 G5 B5 D6 E6"),
    "G": ("G2", "G3 D4 B4", "D5 G5 B5 A5 D6"),
    "Bm/F#": ("F#2", "F#3 D4 B4", "D5 F#5 B5 C#6 D6"),
    "Asus2": ("A2", "A3 E4 B4", "E5 A5 B5 C#6 E6"),
    "G6": ("G2", "G3 E4 B4", "E5 G5 B5 D6 E6"),
    "Bm": ("B2", "B3 F#4 D5", "D5 F#5 B5 A5 D6"),
    "Cmaj7": ("C2", "C3 G3 E4", "E5 G5 B5 C6 E6"),  # from outside the key
    "B7": ("B1", "B2 F#3 D#4", "D#5 F#5 B5 A5 D#6"),
    "F#m": ("F#2", "F#3 C#4 A4", "F#5 A5 C#6 E6 F#6"),  # the second tune's climb: the fireflies come back to each chord's fifth
    "G#m": ("G#2", "G#3 D#4 B4", "G#4 B4 D#5 F#5 G#5"),
    "A#m": ("A#2", "A#3 F4 C#5", "A#4 C#5 F5 G#5 A#5"),
    "Cm": ("C2", "C3 G3 Eb4", "C5 Eb5 G5 Bb5 C6"),  # the drop
    "Abm": ("Ab1", "Ab2 Eb3 B3", "Ab4 B4 Eb5 Gb5 Ab5"),
    "Cl": ("C2", "C3 G3 E4", "E5 G5 B5 F#5 E6"),  # C with its raised fourth, F#: the calm's chord
    "Em9": ("E2", "E3 B3 F#4", "E5 G5 B5 F#5 D6"),
    "Am7": ("A2", "A2 E3 C4", "E5 G5 A5 C6 E6"),
    "D7": ("D2", "D3 A3 F#4", "D5 F#5 A5 C6 D6"),
}
CHORDS = (
    "Em Em G Asus2 Cmaj7 Bm Cmaj7 B7  Em G Bm/F# Asus2 G6 Bm Cmaj7 B7  Em G Bm/F# Asus2 G6 Bm Cmaj7 B7  "
    "Em Em F#m F#m G#m G#m A#m B7 B7  Em Em Cm Cm Abm Abm B7 B7 Em Cm Abm B7  Cl Cl Em9 Em9 Cl Cl Am7 D7  D7 D7 D7 D7  "
    "Em+3 G+3 Bm/F#+3 Asus2+3 G6+3 Bm+3 Cmaj7+3 B7+3  Cmaj7 B7"
).split()
assert len(CHORDS) == BARS
CLIMB = ("Em", "F#m", "G#m", "A#m")  # the second tune's chords, seven beats each (bars 25 to 31; the list above only rounds them to bars)
FLY = (2, 0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 4)  # the fireflies' bar, 8th by 8th: which of the five
HOPS = ((0, 0, 2), (2, 12, 1), (3, 12, 1), (6, 0, 2), (8, 7, 1), (11, 12, 1))  # the bass's bar: the 8th, how far over the root, how many 8ths long

# ---- Chirp's lines (the square lead). A note of 1/3 is an 8th; 1/2 is two across a beat. ----
# The tune, three bars and three and two: a hop up a fifth and a fourth, floating down; two across the beat; a held
# note; a bigger hop, to the raised sixth; a note held over the bar line; up the C chord; the turn.
TUNE = (
    "B4:1/3 E5:1/3 B5:1 A5:2/3 G5:1/3 E5:1 -:1/3 | D5:2/3 E5:1/3 G5:1/2 A5:1/2 B5:1 G5:1 | F#5:1.5 D5:.5 B4:2/3 D5:1/3 F#5:1 | "
    "E5:1/3 A5:1/3 C#6:4/3 B5:1 A5:2/3 E5:1/3 | G5:1 D5:1/3 E5:1/3 G5:1/3 B5:2.5 A5:.5 F#5:1 D5:2/3 F#5:1/3 B4:1 | "
    "C5:1/3 E5:1/3 G5:1/3 B5:1 G5:1/2 E5:1/2 C5:1 | D#5:1 F#5:2/3 A5:1/3 B5:1 -:1"
)
# The second verse: Chirp and Chub leapfrog (each comes in over the other's last note) for four bars, tumble down
# together for two, and turn home in harmony.
V_CHIRP = (
    "E4:1/3 G4:1/3 B4:1/3 A4:2/3 G4:1/3 E4:1 -:1 | -:3 B4:1/3 C#5:1/3 D5:1/3 | F#5:1 D5:2/3 B4:1/3 F#4:1 -:1 | -:3 E5:1/3 G5:1/3 A5:1/3 | "
    "B5:2/3 A5:1/3 G5:2/3 E5:1/3 D5:1/2 E5:1/2 G5:1 | F#5:1 D5:1/3 E5:1/3 F#5:1/3 B5:1 A5:2/3 F#5:1/3 | G5:2 E5:1 C5:1 | D#5:1.5 F#5:.5 B5:1 -:1"
)
V_CHUB = (
    "-:3 G4:1/3 A4:1/3 B4:1/3 | D5:1 B4:2/3 A4:1/3 G4:1 -:1 | -:3 D5:1/3 E5:1/3 F#5:1/3 | A5:1 E5:2/3 C#5:1/3 A4:1 -:1 | "
    "G5:2/3 E5:1/3 D5:2/3 B4:1/3 B4:1/2 B4:1/2 D5:1 | D5:1 B4:1/3 C#5:1/3 D5:1/3 F#5:1 E5:2/3 D5:1/3 | E5:2 C5:1/3 E5:1/3 G5:1/3 E5:1 | B4:1.5 D#5:.5 F#5:1 -:1"
)
# The second tune: seven 8ths (an 8th, an 8th, a quarter, an 8th, a quarter), three shapes of it on each chord, each
# starting higher than the last: half steps over the chord's root.
SHAPES = ((-5, 0, 3, 0, -2), (0, 3, 7, 5, 3), (3, 7, 10, 7, 5))
STEPS = (1, 1, 2, 1, 2)
# The drop: Chirp's bars and the gritty synth's, two each in turn; then four together.
D_CHIRP = (
    "E4:1/3 E5:1/3 B5:4/3 G5:2/3 E5:1/3 D5:1 | E5:1/3 G5:1/3 A5:1/3 B5:1 D6:1/2 B5:1/2 A5:1/3 G5:1/3 E5:1/3 | -:4 | -:4 | "
    "Ab4:1/3 Ab5:1/3 Eb6:4/3 B5:2/3 Ab5:1/3 Gb5:1 | Ab5:1/3 B5:1/3 Db6:1/3 Eb6:1 Db6:1/2 B5:1/2 Ab5:1 | -:4 | -:4 | "
    "B5:2 G5:1/3 A5:1/3 B5:1/3 E5:1 | C6:2 G5:1/3 Eb5:1/3 G5:1/3 C5:1 | B5:2 Ab5:1/3 Eb5:1/3 Ab5:1/3 Eb5:1 | D#5:1 F#5:1 B5:1 -:1"
)
D_GRIT = (
    "-:4 | -:4 | C4:1 Eb4:1/3 G4:1/3 C5:1/3 Bb4:1 G4:1 | Eb4:2/3 F4:1/3 G4:1/2 Bb4:1/2 C5:1 -:1 | "
    "-:4 | -:4 | B3:1 D#4:1/3 F#4:1/3 A4:1/3 B4:1 A4:2/3 F#4:1/3 | D#4:1/2 F#4:1/2 A4:1/2 B4:1/2 D#5:1 -:1 | "
    "E4:2 B3:1 E4:1 | C4:2 G3:1 C4:1 | Ab3:2 Eb4:1 Ab3:1 | B3:1 D#4:1 F#4:1 -:1"
)
# The night: the pan flute's slow tune (the tune's first hop, held), and the low marimba's.
N_FLUTE = "-:8 | B4:2/3 D5:1/3 B5:3 | A5:1 E5:1 C#5:2 | E5:2/3 G5:1/3 B5:2 G5:1 | F#5:3 -:1 | -:8"
N_MARIMBA = "-:24 | C3:1/3 E3:1/3 G3:1/3 B3:1/3 G3:1/3 E3:1/3 C3:1/3 E3:1/3 G3:1/3 B3:1/3 E4:1/3 G4:1/3 | B2:1/3 D#3:1/3 F#3:1/3 A3:1/3 B3:1/3 D#4:1/3 F#4:1 -:1"
C_FLUTE = "B4:2/3 E5:1/3 B5:3 | A5:1 G5:1 E5:2 | D5:2/3 E5:1/3 G5:2 F#5:1 | E5:4 | -:8 | A5:1 G5:1 E5:2 | F#5:3 -:1"
C_MARIMBA = "-:16 | C3:1/3 E3:1/3 G3:1/3 B3:1 G3:1 F#3:1 | E3:1 G3:1/3 B3:1/3 E4:1/3 F#4:2 | A2:1 E3:1 C4:2 | D3:1 A3:1 F#3:2"
TAG = "C5:1/3 E5:1/3 G5:1/3 B5:1 G5:2/3 E5:1/3 C5:1 | B4:1 D#5:2/3 F#5:1/3 B5:1 -:1"
for _line, _beats in ((TUNE, 32), (V_CHIRP, 32), (V_CHUB, 32), (D_CHIRP, 48), (D_GRIT, 48), (N_FLUTE, 32), (N_MARIMBA, 32), (C_FLUTE, 32), (C_MARIMBA, 32), (TAG, 8)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
first4 = lambda text: " | ".join(text.split("|")[:4])
last4 = lambda text: " | ".join(text.split("|")[4:])


def main(out: str) -> None:
    x = Ride(RIDE, BEATS, None, os=2, seed=173, tape_secs=TAPE)
    put, at = x.put, x.at
    rng = np.random.default_rng(37)
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
        """Noise with its highs rolled off: dust, never a hiss."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    def chord(name):
        name, _, shift = name.partition("+")
        root, pad, fly = MEADOW[name]
        up = int(shift or 0)
        return n(root) + up, [n(c) + up for c in pad.split()], [n(c) + up for c in fly.split()]

    def chord_at(beat):
        """The chord at a beat: the bar's, or (the second tune) the climb's, seven beats each."""
        if bar0(25) <= beat < bar0(32):
            return chord(CLIMB[int((beat - bar0(25)) // 7)])
        return chord(CHORDS[int(beat // 4) % BARS])

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the strings and the fireflies duck

    def snare(b, vol=0.26):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def clap(b, vol=0.2):
        for late in (0, 0.011, 0.023):
            kk = int(0.02 * sr)
            put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.006) * vol * 0.7, late=late)
        kk = int(0.2 * sr)
        put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol, late=0.03)

    # ---- their sounds, as the game builds them (packages/app/src/characters/hopper-sounds.ts) ----
    def thump(b, vol=0.4, pan=-0.15, late=0.0):
        """The rabbit's hind foot on the ground: a low note dropping, a puff of dust."""
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(62 + 78 * np.exp(-t / 0.025)) / sr
        put("thump", b, (np.sin(ph) + 0.3 * np.sin(2 * ph) + 1.1 * murk(k, 600)) * np.exp(-t / 0.05) * tail(k) * vol, pan, late=late)

    def stamps(b, vol=0.4):
        """His three stamps: one, two, THREE, an 8th apart."""
        for i, loud in enumerate((0.6, 0.72, 1.0)):
            thump(b + i / 3, vol * loud, (-0.3, 0.0, 0.3)[i])

    def land(b, vol=1.0, echoes=6, gap=0.41, fall=0.55, ring=0.4, bus="land"):
        """A big landing: one deep thump (ringing for `ring` s), the dust it throws, and its echoes going out (`gap`
        seconds apart), each further, duller and `fall` as loud as the one before."""
        k = int(1.5 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(36 + 95 * np.exp(-t / 0.05)) / sr
        w = np.tanh(2.2 * np.sin(ph) * np.exp(-t / ring)) + 0.3 * np.sin(2 * ph) * np.exp(-t / (ring * 0.6)) + 0.9 * murk(k, 500) * np.exp(-t / (ring * 0.75))
        w += 0.35 * hiss(k, 2500, 0.3) * np.sin(np.pi * np.minimum(1, t / 0.25)) * (t < 0.25)
        w *= tail(k, 0.05) * vol
        put(bus, b, w)
        put("duck", b, np.ones(1))
        for i in range(1, echoes + 1):
            size = 1 + 40 * i
            far = np.convolve(w, np.ones(size) / size, "same")
            put(bus, b, far * fall**i, (-0.5, 0.5)[i % 2] * min(1.0, 0.3 * i), late=gap * i)

    def step(b, near, pan=0.0):
        """A footfall of something coming, `near` from 0 (far: faint, dull, all echo) to 1 (here): the rabbit's thump
        growing into the landing's, a drum's tap on it."""
        k = int(0.6 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(62 - 22 * near + (78 + 20 * near) * np.exp(-t / (0.025 + 0.02 * near))) / sr
        w = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.exp(-t / (0.05 + 0.14 * near)) + (0.7 + 0.5 * near) * murk(k, 500 + 300 * near) * np.exp(-t / 0.06)
        w += (0.2 + 0.4 * near) * hiss(k, 5000, 0.4) * np.exp(-t / 0.004)
        w *= tail(k) * 0.07 * (0.42 / 0.07) ** near
        put("steps", b, w * (1 - near) ** 0.7, pan)  # (far: into the meadow's echo)
        put("thump", b, w * near, pan)  # (near: dry)

    def boing(b, length, f0=110.0, f1=880.0, vol=0.12, pan=0.0):
        """A spring: a note rising, wobbling as it goes (their hop, long)."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(f0 * (f1 / f0) ** u + (10 + 50 * u) * np.sin(tau * 28 * t)) / sr
        put("fx", b, (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * np.maximum(0, np.sin(np.pi * np.minimum(1, u * 1.15))) ** 0.7 * (0.5 + 0.5 * u) * vol, pan)

    def hop(b, vol=0.07, pan=0.2):
        """Their hop: a springy little boing up."""
        k = int(0.17 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(260 + 520 * np.minimum(1, t / 0.12) + 40 * np.sin(tau * 28 * t)) / sr
        put("fx", b, (np.sin(ph) + 0.3 * murk(k, 900)) * np.sin(np.pi * t / 0.17) * vol, pan)

    def squeak(b, vol=0.05, pan=-0.3):
        """Chub's squeak: short, rising, a little wobble."""
        k = int(0.13 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(1150 + 900 * np.minimum(1, t / 0.09) + 60 * np.sin(tau * 30 * t)) / sr
        put("fx", b, np.sin(ph) * np.sin(np.pi * t / 0.13) ** 0.8 * vol, pan)

    def pop(b, vol=0.07, pan=0.0):
        """A carrot pulled: a cork's pop, a crumble of soil."""
        k = int(0.18 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(950 - 600 * np.minimum(1, t / 0.045)) / sr
        put("night", b, (np.sin(ph) * np.sin(np.pi * np.minimum(1, t / 0.06)) * (t < 0.06) + 0.5 * murk(k, 1100) * np.exp(-np.maximum(0, t - 0.03) / 0.05) * (t > 0.03)) * vol, pan)

    def reel(b, vol=0.05, pan=0.0):
        """The spin's reel: a card passing the line."""
        k = int(0.035 * sr)
        t = np.arange(k) / sr
        put("fx", b, (hiss(k, 9000, 0.6) + 0.6 * np.sin(tau * 900 * t)) * np.exp(-t / 0.005) * vol, pan)

    def chirp(b, vol=0.04, pan=0.3, f=4300.0, clicks=3, late=0.0):
        """Chirp's trill: a run of clicks of a high, buzzy note, 11 ms each."""
        k = int(clicks * 0.011 * sr)
        t = np.arange(k) / sr
        c = (t % 0.011) / 0.011
        ph = tau * np.cumsum(f + 180 * np.sin(tau * 23 * t)) / sr
        put("bugs", b, (np.sin(ph) + 0.4 * hiss(k, 14000, 0.9)) * np.sin(np.pi * np.minimum(1, c * 1.6)) ** 2 * tail(k, 0.002) * vol, pan, late=late)

    def crickets(bar, vol=1.0, a=1, b=True, soft=False):
        """A bar of crickets: one on every `a`th 8th (the beats a little louder), another, higher, on the 8th before
        each beat."""
        for i in range(12):
            t = bar0(bar) + i / 3
            if i % a == 0:
                chirp(t, 0.04 * vol * rng.uniform(0.7, 1.0) * (1.25 if i % 3 == 0 else 1.0), 0.45, 4300, 2 if soft else 3)
            if b and i % 3 == 2:
                chirp(t, 0.03 * vol * rng.uniform(0.7, 1.0), -0.5, 4900, 4, late=rng.uniform(0, 0.01))

    def cicada(b, length, vol=0.02, pan=-0.3):
        """A cicada: a dry rattle swelling up and dying away."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        rattle = 0.55 + 0.45 * np.sign(np.sin(tau * 55 * t + 2 * np.sin(tau * 0.7 * t)))
        put("night", b, hiss(k, 13000, 0.92) * rattle * np.sin(np.pi * u) ** 1.6 * vol, pan)

    def fly(b, m, vol=0.05, pan=0.0):
        """A firefly: a soft blip, lit and gone."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("flies", b, (np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)) * np.minimum(1, t / 0.006) * np.exp(-t / 0.09) * tail(k) * vol, pan)

    def flies(bar, vol=1.0, keep=1, lower=False):
        """A bar of fireflies: the 8th pattern, each at its own brightness; `keep`: only every such-th one; `lower`: a
        second, softer set an octave down, an 8th behind."""
        for i in range(12):
            if i % keep:
                continue
            t = bar0(bar) + i / 3
            sky = chord_at(t)[2]
            v = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 3 == 0 else 1.0)
            pan = 0.55 * np.sin(i * 1.7 + bar)
            fly(t, sky[FLY[i]], 0.05 * v, pan)
            if lower:
                fly(t + 1 / 3, sky[FLY[(i + 5) % 12]] - 12, 0.028 * v, -pan)

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

    def hopping(bar, vol=1.0):
        """The bass's bar: the root, hopping to its octave and back, the chord's next note up (its fifth, mostly), its
        octave."""
        for i, over, long in HOPS:
            t = bar0(bar) + i / 3
            root, pad, _ = chord_at(t)
            bass(t, root + ((pad[1] - root) % 12 if over == 7 else over), long / 3 * 0.9, (0.4 if over == 0 else 0.3) * vol)

    def sub(b, m, length, vol=0.5):
        """The 808."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def wobble(b, m, length, rate, vol=0.2, top=18.0):
        """The wobble bass: a sawtooth whose brightness sweeps open and shut `rate` times a beat, driven hard."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        cut = 1.5 + (0.5 - 0.5 * np.cos(tau * rate * t / x.beat_s)) * top
        w = np.zeros(k)
        for c in (-9, 9):
            ph = tau * x.hz(m + c / 100) * t
            for h in range(1, 22):
                w += np.sin(h * ph) / h * np.clip(cut - h + 1, 0, 1)
        put("wobble", b, np.tanh(1.8 * w) * np.minimum(1, t / 0.005) * tail(k) * vol)

    def strings(bar, vol=0.045, length=4.0, slow=False):
        at(bar0(bar), length)
        for j, m in enumerate(chord(CHORDS[bar - 1])[1]):
            put("pad", bar0(bar), x.strings(m, length, vol, attack=0.4 if slow else 0.12, release=0.5 if slow else 0.2), (-0.45, 0.0, 0.45)[j])

    def hall(name, secs=3.0, wet=0.5):
        """A long echo for a voice: the open meadow at night."""
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
    def chirped(start, text, vol=1.0, pan=-0.1, up=0):
        """Chirp: the square lead, a chirp (a blip an octave up) at the front of each note of two 8ths or more."""
        for b, d, m in notes(start, text):
            at(b, d)
            put("lead", b, x.chip(m + up, d * 0.94, 0.15 * vol), pan)
            if d >= 0.6:
                k = int(0.03 * sr)
                t = np.arange(k) / sr
                put("lead", b, np.sign(np.sin(tau * x.hz(m + up + 12) * t)) * np.exp(-t / 0.009) * tail(k, 0.003) * 0.05 * vol, pan)

    def fiddled(start, text, vol=1.0, pan=0.25, up=0):
        for b, d, m in notes(start, text):
            at(b, d)
            put("fiddle", b, x.fiddle(m + up, d * 0.95, 0.145 * vol), pan)

    def grit(start, text, vol=1.0, pan=0.3, up=0):
        for b, d, m in notes(start, text):
            at(b, d)
            put("grit", b, x.gritty(m + up, d * 0.92, 0.21 * vol), pan)

    def fluted(start, text, vol=0.2, pan=0.25):
        """The pan flute."""
        for b, d, m in notes(start, text):
            at(b, d)
            put("flute", b, x.flute(m, max(d * 0.95, 0.3), vol), pan)

    def wood(start, text, vol=0.22, pan=-0.25):
        """The low marimba: a round bar, a soft one an octave over it."""
        for b, d, m in notes(start, text):
            k = int(0.26 * 6 * sr)
            t = np.arange(k) / sr
            for over, loud, side in ((0, 1.0, pan), (12, 0.3, -pan)):
                f = tau * x.hz(m + over) * t
                w = np.sin(f) + 0.45 * np.sin(4 * f) * np.exp(-t / 0.03) + 0.15 * np.sin(9.2 * f) * np.exp(-t / 0.008)
                put("marimba", b, w * np.exp(-t / 0.26) * np.minimum(1, t / 0.001) * tail(k) * vol * loud, side)

    def stutter(b, m, count=6, vol=0.6):
        """The gritty synth's last note, said six times in a beat."""
        for i in range(count):
            at(b + i / count, 1 / count)
            put("grit", b + i / count, x.gritty(m, 0.8 / count, 0.21 * vol * (0.6 + 0.4 * i / count)), 0.3)

    # ---- the band, bar by bar ----
    def band(bar, vol=1.0, kit=True, back=True, feet=True, bugs=1.0, lights=1.0, pad=True, lower=False):
        """A bar of the band: a kick on beats 1 and 3, a clap on 2 and 4, the bass hopping, the strings, the crickets,
        the fireflies; and the rabbit's foot wherever its own count of five 8ths falls in the bar."""
        b = bar0(bar)
        if kit:
            kick(b, 0.5 * vol), kick(b + 2, 0.42 * vol)
        if back:
            clap(b + 1, 0.2 * vol), snare(b + 3, 0.24 * vol)
        hopping(bar, vol)
        if pad:
            strings(bar, 0.04 * vol)
        if bugs:
            crickets(bar, bugs)
        if lights:
            flies(bar, lights, lower=lower)
        if feet:
            for i in range(12):
                if (12 * (bar - 1) + i) % 5 == 0:
                    thump(b + i / 3, 0.36 * vol, 0.25 if (12 * (bar - 1) + i) % 2 else -0.25)

    def takeoff(bar, low):
        """The band takes off: three beats of a boing rising, a roll, the reel spinning up, the bass sliding up, a run
        up the chord; then a beat in the air."""
        b = bar0(bar)
        boing(b, 3.0, 110, 880, 0.2)
        boing(b + 1.5, 1.5, 220, 1320, 0.1, 0.4)
        for i in range(18):
            snare(b + i / 6, 0.04 + 0.009 * i)
        for i in range(14):
            reel(b + 3 * (1 - (1 - i / 14) ** 1.6), 0.03 + 0.003 * i, 0.5 * np.sin(i))
        at(b, 3.0)
        k = x.k(3.0)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(x.hz(low + 12 * u**2)) / sr
        put("bass", b, (np.tanh(2.0 * np.sin(ph)) + 0.3 * np.sin(2 * ph)) * (0.4 + 0.6 * u) * tail(k, 0.03) * 0.32)
        sky = chord(CHORDS[bar - 1])[2]
        run = [sky[0] - 12, sky[1] - 12, sky[2] - 12, sky[0], sky[1], sky[2], sky[3], sky[4], sky[4] + 3]
        for i, m in enumerate(run):
            at(b + i / 3, 1 / 3)
            put("lead", b + i / 3, x.chip(m, 0.3, 0.1 + 0.006 * i), -0.1)
            fly(b + i / 3, m, 0.04, 0.5 * np.cos(i))

    # Bars 1-8: night. The loop's seam is a landing: its echo; the crickets silent, then one, then two; a cicada; the
    # pan flute's slow tune over soft strings; a far foot; then the build: the marimba, the fireflies, the bass, a kick.
    land(0, 0.42, 5)
    for i in range(2, 4):
        chirp(i, 0.05, 0.45)
    crickets(2, 1.3, a=3, b=False), chirp(bar0(2) + 2 + 2 / 3, 0.04, -0.5, 4900, 4)
    for bar in (3, 4):
        crickets(bar, 1.4, a=3)
    for bar in (5, 6):
        crickets(bar, 1.3 if bar == 5 else 1.1, a=1 if bar == 6 else 3)
    cicada(bar0(2), 9, 0.034), cicada(bar0(5) + 1, 8, 0.026, 0.4)
    fluted(0, N_FLUTE, 0.2)
    wood(0, N_MARIMBA, 0.2)
    for bar in range(3, 9):
        strings(bar, 0.032, slow=True)
        if bar >= 5:
            at(bar0(bar), 4)
            bass(bar0(bar), chord(CHORDS[bar - 1])[0], 3.6, 0.3)
            flies(bar, 0.7 if bar < 7 else 1.0, keep=2 if bar < 7 else 1)
    thump(bar0(4) + 5 / 3, 0.16, -0.5), thump(bar0(6) + 7 / 3, 0.2, 0.5)
    for bar in (7, 8):
        crickets(bar, 1.0)
        for i in range(12):
            if (12 * (bar - 1) + i) % 5 == 0:
                thump(bar0(bar) + i / 3, 0.22 + 0.08 * (bar - 7), 0.25 if i % 2 else -0.25)
    kick(bar0(8), 0.4), kick(bar0(8) + 2, 0.42)
    for i in range(6):
        snare(bar0(9) - 1 + i / 6, 0.07 + 0.02 * i)
    hop(bar0(9) - 2 / 3, 0.08), squeak(bar0(9) - 1 / 3, 0.05)

    # Bars 9-16: Chirp's tune.
    for bar in range(9, 17):
        band(bar)
    chirped(bar0(9), TUNE)
    squeak(bar0(11) + 3 + 1 / 3, 0.045), hop(bar0(14) + 3 + 2 / 3, 0.06)

    # Bars 17-24: the second verse. Chirp and Chub leapfrog; then tumble down together; his stamps at the turn.
    for bar in range(17, 25):
        band(bar, lower=bar >= 21)
    chirped(bar0(17), V_CHIRP), fiddled(bar0(17), V_CHUB)
    hop(bar0(18) - 1 / 3, 0.05, -0.3), hop(bar0(20) - 1 / 3, 0.05, 0.3)
    stamps(bar0(25) - 1, 0.42)

    # Bars 25-31: the second tune. A motif seven 8ths long, twelve times: three shapes on each chord, each starting
    # higher; the chords climb a whole step every seven beats; his three stamps start each one; the bass hops on them.
    # For the last two chords the lead is an octave down with the gritty synth under it.
    for r in range(12):
        b = bar0(25) + r * 7 / 3
        name = CLIMB[r // 3]
        root = chord(name)[0]
        top = root + (36 if r < 6 else 24)
        t = b
        for over, long in zip(SHAPES[r % 3], STEPS):
            at(t, long / 3)
            put("lead", t, x.chip(top + over, long / 3 * 0.94, 0.15), -0.1)
            if r >= 6:
                put("grit", t, x.gritty(top + over - 12, long / 3 * 0.92, 0.15), 0.3)
            t += long / 3
        stamps(b, 0.3 + 0.012 * r)
        bass(b, root, 0.6, 0.4), bass(b + 2 / 3, root + 12, 0.3, 0.3), bass(b + 4 / 3, root + 7, 0.3, 0.3), bass(b + 5 / 3, root + 12, 0.5, 0.3)
    for bar in range(25, 32):
        b = bar0(bar)
        kick(b, 0.5), kick(b + 2, 0.42), clap(b + 1, 0.2), snare(b + 3, 0.24)
        crickets(bar, 1.0), flies(bar, 1.0, lower=bar >= 29)
        if bar >= 28:
            for i in range(12):
                x.hat(b + i / 3, 0.02 + 0.004 * (bar - 28))

    # Bar 32: takeoff. Bar 33: the landing. One deep thump and its echoes; nothing else; then one cricket, then two,
    # and a small hop into the drop.
    takeoff(32, n("B1"))
    land(bar0(33), 1.0)
    chirp(bar0(33) + 2 + 1 / 3, 0.02, 0.45), chirp(bar0(33) + 3, 0.028, 0.45), chirp(bar0(33) + 3 + 1 / 3, 0.02, -0.5, 4900, 4)
    hop(bar0(34) - 2 / 3, 0.09)

    # Bars 34-45: the drop. The 808 on 1 and on the 8th before 3 (a hop), a snare on 3; the wobble bass in the bar's
    # second half; Chirp and the gritty synth trade two bars each, his stamps or a stutter ending each turn; then all
    # together, a clap on 2 and 4 too. The crickets come back one by one.
    for i, bar in enumerate(range(34, 46)):
        b = bar0(bar)
        root = chord(CHORDS[bar - 1])[0]
        full = bar >= 42
        kick(b, 0.55), kick(b + 5 / 3, 0.45), snare(b + 2, 0.3)
        sub(b, root, 1.6, 0.5), sub(b + 5 / 3, root, 1.0, 0.4)
        wobble(b + 2, root + 12, 2.0, 3, 0.2 if full else 0.16)
        if full:
            clap(b + 1, 0.2), clap(b + 3, 0.2), kick(b + 3 + 2 / 3, 0.4)
            strings(bar, 0.045)
        if i >= 1:
            crickets(bar, min(1.0, 0.45 + 0.15 * i), a=3 if i < 3 else 1, b=i >= 2)
        if i >= 4:
            flies(bar, 0.9, lower=full)
        if bar >= 38 and not full:
            for j in range(12):
                x.hat(b + j / 3, 0.022)
    chirped(bar0(34), D_CHIRP), grit(bar0(34), D_GRIT)
    stamps(bar0(36) - 1, 0.45), stamps(bar0(40) - 1, 0.45)
    stutter(bar0(38) - 1, n("C5")), stutter(bar0(42) - 1, n("D#5"))
    x.crash(bar0(34), 0.2, decay=0.6), x.crash(bar0(42), 0.2, decay=0.6)
    squeak(bar0(46) - 2 / 3, 0.05)

    # Bars 46-53: the calm. Night again, slower: held strings on the chord with the raised fourth; the crickets, a
    # cicada; the fireflies at half speed; the pan flute's hop, held; the low marimba answers; carrots pulled, far off;
    # one far landing, its echoes.
    for bar in range(46, 54):
        strings(bar, 0.04, slow=True)
        at(bar0(bar), 4)
        bass(bar0(bar), chord(CHORDS[bar - 1])[0], 3.6, 0.2)
        crickets(bar, 1.3, a=3)
        flies(bar, 0.75, keep=2)
    cicada(bar0(46) + 1, 9, 0.03), cicada(bar0(50), 10, 0.026, 0.4)
    fluted(bar0(46), C_FLUTE, 0.2), wood(bar0(46), C_MARIMBA, 0.2)
    pop(bar0(47) + 2 + 2 / 3, 0.07, -0.5), pop(bar0(50) + 3 + 1 / 3, 0.06, 0.5), pop(bar0(52) + 1 + 2 / 3, 0.07, -0.2)
    land(bar0(49) + 2, 0.22, 4)

    # Bars 54-56: something coming. The night goes on (the strings swelling on the chord, the crickets, the fireflies)
    # and through it a footfall on every beat, twelve of them, each nearer. Bar 57: the twelfth's place is the thud;
    # everything stops; five echoes go out, two 8ths apart, each quieter and duller.
    for bar in range(54, 57):
        strings(bar, 0.04 + 0.012 * (bar - 54), slow=True)
        at(bar0(bar), 4)
        bass(bar0(bar), chord("D7")[0], 3.6, 0.2 + 0.04 * (bar - 54))
        crickets(bar, 1.3, a=3)
        flies(bar, 0.75, keep=2)
    for i in range(12):
        step(bar0(54) + i, i / 11.5, 0.2 if i % 2 else -0.2)
    b = bar0(57)
    land(b, 1.05, 5, gap=x.t(b + 2 / 3) - x.t(b), fall=0.62, ring=0.26, bus="thud")  # (its own bus: less of the meadow's echo, so each echo is heard)

    # Bars 58-65: the last tune, a minor third up, out of the last echo. Both leads on the tune's first four bars (the
    # fiddle an octave under); then their tumble and the turn, in harmony; the 808 under each bar.
    x.crash(bar0(58), 0.22, decay=0.6)
    for bar in range(58, 66):
        band(bar, lower=True)
        sub(bar0(bar), chord(CHORDS[bar - 1])[0], 1.6, 0.42)
        for j in range(12):
            x.hat(bar0(bar) + j / 3, 0.022)
    chirped(bar0(58), first4(TUNE), up=3), fiddled(bar0(58), first4(TUNE), 0.9, up=3 - 12)
    chirped(bar0(62), last4(V_CHIRP), up=3), fiddled(bar0(62), last4(V_CHUB), up=3)
    stamps(bar0(62) - 1, 0.45), stamps(bar0(66) - 1, 0.45)
    squeak(bar0(60) + 3 + 1 / 3, 0.045)

    # Bars 66-67: the tag. Home by way of C and B; the band stops after two beats of the last bar; a last hop, which
    # lands on bar 1.
    band(66, lower=True)
    b = bar0(67)
    kick(b, 0.5), clap(b + 1, 0.2), strings(67, 0.04, length=2.0), crickets(67, 0.8, a=3)
    bass(b, chord("B7")[0], 0.6, 0.4), bass(b + 2 / 3, chord("B7")[0] + 12, 0.3, 0.3), bass(b + 1, chord("B7")[0] + 12, 0.6, 0.3)
    chirped(bar0(66), TAG), fiddled(bar0(66), TAG, 0.8, up=-12)
    boing(b + 2, 1.5, 150, 700, 0.1)
    for i in range(6):
        snare(b + 2 + i / 4, 0.05 + 0.012 * i)

    # The bass, the strings and (lightly) the fireflies duck under each kick and landing.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["pad"] *= 0.45 + 0.55 * gain
    x.buses["flies"] *= 0.75 + 0.25 * gain

    hall("land", 3.5, 0.6), hall("thud", 1.6, 0.22), hall("steps", 3.0, 1.3), hall("night", 2.0, 0.5), hall("flute", 2.0, 0.3), hall("marimba", 1.6, 0.25)
    x.beat_s = 60 / 126  # the echoes' beat
    x.echo("lead", 2 / 3, 0.14, 0.06)
    x.echo("fiddle", 2 / 3, 0.16, 0.06)
    x.echo("flies", 1 / 3, 0.2, 0.08)
    x.echo("flute", 1.0, 0.2, 0.08)
    levels = {"lead": 1.0, "fiddle": 1.0, "grit": 1.1, "bass": 0.5, "sub": 0.5, "wobble": 0.8, "kick": 1.0, "snare": 2.4, "drum": 1.5, "thump": 1.6,
              "land": 0.65, "thud": 0.65, "steps": 1.6, "bugs": 4.8, "flies": 2.1, "pad": 1.7, "fx": 1.4, "flute": 0.6, "marimba": 0.9, "night": 2.2}
    write_wav(out, x.play(x.mixdown(levels, lowpass=9000, room=0.25)))


if __name__ == "__main__":
    main(sys.argv[1])
