"""Song S (Eric, Nov 12): Boingo the Clown's theme, a two-minute loop. His direction: "add a bit of ... off-key kind of
variations think like fun house like broken merry-go-round style ... where ... it's like the ride is like dying ...
the way to get eeriness in it is with like high pitched like dings that are like very short almost like chime ... you
mix in those with like this like deep bass like with a build up ... the funhouse sort of like upside down theme ...
how you kind of went adventurous [Moo & Moon], this one, even take it up another notch. It's going to sound wacky mix
in the beat timing, mix in a little speed up, a little slow down, then like super fast and bring it back down."
So: a merry-go-round's band, recorded on a ride that doesn't run at one speed. The whole band is on a "tape" (synth.py's
`Ride`): where the tape slows, everything sinks in pitch as it slows (the ride dying); where it wavers, everything goes
off key together; it starts up from a groan, runs away with itself, breaks, and is wound back up a half step too far.
A minor, a waltz, about 178 beats a minute; 321 beats; 120.0 s as heard.
The tune (recipe: SOUNDS.md): bars of three with a note of two beats across them, five notes in two beats tumbling
down (his kazoo laugh's rhythm), big jumps (his pogo), and a held note that doesn't belong. A chord a bar, the bass
stepping UP by half steps (A, B flat, B, C, C#, D, D#, E) under one note that never moves (E). The second verse limps:
every fourth bar loses a beat, and the fiddle lands a half step flat. The second tune is a motif seven 8ths long, so it
starts somewhere new in the bar each time, over chords climbing by minor thirds. The drop is the Funhouse: the tune
upside down on a gritty synth, answered right way up a tritone away, then both at once, mirrored. Then the gallop: the
tune at a run while the ride overspeeds two half steps sharp, and breaks.
Boingo is the steam organ's whistle (`pipe`: every long note lands sharp and springs about, his pogo), with the
overdriven lead, the fiddle, the gritty synth and the square in turns. His sounds are built as the game builds them
(packages/app/src/characters/clown-sounds.ts): the bulb horn, the kazoo laugh, the slide whistle, the boing-flip, a
pie's splat. The fast pattern is a toy glockenspiel's short dings, coming back to E.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_s.py <out.wav>

  0:00  the ride starts up: a switch, a groan rising to speed, the organ's oom-pah-pah, dings, a laugh, a whistle
  0:07  Boingo's tune (16 bars of three), the bass stepping up under it
  0:23  the limping verse: the fiddle, a beat missing from every fourth bar (honk honk), a half step flat; it pushes
  0:34  the second tune, in four and faster: the overdriven lead, the motif shifting in the bar
  0:44  the ride dies: everything sinks; a pie
  0:48  broken (the first calm): a music box, slow, flat and wavering; it sticks; high dings; the deep bass climbing
  1:00  the Funhouse (the drop, half-time): the tune upside down; an 808, a wobble bass; mirrored leads
  1:12  faster ...
  1:15  the gallop: the tune at a run, the ride overspeeding, the laugh climbing
  1:23  it breaks: lurches, a laugh running down, a pie
  1:27  barely turning (the second calm): the whistle alone, slow and three half steps flat; a fiddle; the music box
        has the tune upside down; then it's wound back up
  1:39  the tune, a half step sharp and faster: the overdriven lead and the whistle, a square in harmony
  1:55  the tag, and the ride runs down to where bar 1 starts it up again
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BEATS = 321
SECS = 120.0
# The ride: from beat, to beat; the band's tempo there (from, to); the tape's speed (from, to: 1 is in tune, 0.5 an
# octave down and half as fast); how far it wavers. The tempos are all scaled alike so the song is SECS long as heard.
RIDE = [
    (0, 9, 176, 176, 0.36, 1.0, 0.004),  # it starts up
    (9, 85, 176, 176, 1.0, 1.0, 0.003),
    (85, 96, 176, 192, 1.0, 1.0, 0.003),  # the band pushes
    (96, 128, 192, 200, 1.0, 1.0, 0.0015),
    (128, 133, 200, 200, 1.0, 0.34, 0.0),  # it dies
    (133, 134, 200, 200, 0.34, 0.34, 0.0),
    (134, 155, 126, 126, 0.92, 0.92, 0.014),  # broken: slow, flat (between two keys), wavering
    (155, 158, 126, 150, 0.92, 1.0, 0.006),
    (158, 190, 150, 150, 1.0, 1.0, 0.0),  # the Funhouse
    (190, 198, 150, 216, 1.0, 1.0, 0.0),  # faster
    (198, 230, 216, 216, 1.0, 1.122, 0.0),  # it runs away: two half steps sharp by the end
    (230, 231.5, 216, 216, 1.122, 0.8, 0.0),  # it breaks, lurching
    (231.5, 232.5, 216, 216, 0.8, 0.95, 0.0),
    (232.5, 234.5, 216, 216, 0.95, 0.5, 0.0),
    (234.5, 236, 216, 216, 0.5, 0.3, 0.0),
    (236, 237, 216, 216, 0.3, 0.3, 0.0),
    (237, 258, 132, 132, 0.84, 0.84, 0.015),  # barely turning: three half steps flat
    (258, 261, 132, 176, 0.84, 1.0595, 0.008),  # wound back up, a half step too far
    (261, 315, 176, 176, 1.0595, 1.0595, 0.002),
    (315, 321, 176, 176, 1.0595, 0.36, 0.0),  # it runs down, to where bar 1 starts it up
]
# Where each part starts, in beats.
T_TUNE, T_LIMP, T_SHIFT, T_DIES, T_CALM, T_DROP, T_FAST, T_RUN, T_BREAK, T_CALM2, T_LAST, T_TAG = 15, 63, 96, 128, 134, 158, 190, 198, 230, 237, 261, 309


# Each chord: the bass note; the organ's three (the "pah"); the dings' five (low, middle, the one they keep coming
# back to, a color, high). Through the tune the one they come back to is E6.
RING = {
    "Am": ("A1", "A3 C4 E4", "A5 C6 E6 B5 A6"),
    "Eo/Bb": ("Bb1", "G3 Bb3 E4", "G5 Bb5 E6 D6 G6"),
    "E/B": ("B1", "G#3 B3 E4", "G#5 B5 E6 D6 G#6"),
    "Am/C": ("C2", "A3 C4 E4", "A5 C6 E6 G5 A6"),
    "C#o": ("C#2", "G3 Bb3 E4", "G5 Bb5 E6 C#6 G6"),
    "Dm9": ("D2", "F3 A3 E4", "A5 D6 E6 F6 A6"),
    "D#o": ("D#2", "F#3 A3 C4", "A5 C6 D#6 F#6 A6"),
    "E7": ("E2", "G#3 B3 D4", "G#5 B5 E6 D6 G#6"),
    "Bbl": ("Bb1", "F3 Bb3 D4", "F5 Bb5 E6 D6 F6"),  # B flat with its raised fourth, E: from outside the key
    "F": ("F2", "A3 C4 F4", "A5 C6 F6 G5 A6"),
    "F#o": ("F#2", "A3 C4 Eb4", "A5 C6 Eb6 F#6 A6"),
    "G": ("G2", "B3 D4 G4", "B5 D6 G6 A5 B6"),
    "G#o": ("G#2", "B3 D4 F4", "B5 D6 F6 G#5 B6"),
    "Cm": ("C2", "G3 C4 Eb4", "G5 C6 Eb6 D6 G6"),
    "Ebm": ("Eb2", "Gb3 Bb3 Eb4", "Gb5 Bb5 Eb6 F6 Gb6"),
    "F#m": ("F#2", "A3 C#4 F#4", "A5 C#6 F#6 G#5 A6"),
    "F7": ("F2", "A3 C4 Eb4", "A5 C6 Eb6 F6 A6"),
    "Bb7": ("Bb1", "Ab3 Bb3 D4", "Ab5 Bb5 D6 F6 Ab6"),
    "Eb7": ("Eb2", "G3 Bb3 Db4", "G5 Bb5 Db6 Eb6 G6"),
    "Bbm": ("Bb1", "F3 Bb3 Db4", "F5 Bb5 Db6 C6 F6"),
    "Bm": ("B1", "F#3 B3 D4", "F#5 B5 D6 C#6 F#6"),
}
TUNE_CH = "Am Eo/Bb E/B Am/C C#o Dm9 D#o E7  Am Eo/Bb E/B Am/C C#o Dm9 Bbl E7".split()
LIMP_CH = "Am Eo/Bb E/B Am/C  C#o Dm9 D#o E7  F F#o G G#o".split()  # every fourth bar two beats long
SHIFT_CH = "Am Cm Ebm F#m Am F7 Bb7 E7".split()
DROP_CH = "Am Am Eb7 Eb7 Am F7 Bb7 E7".split()
CALM2_CH = "Am Bbl Am Bbl Dm9 D#o E7".split()
PAT3 = (0, 2, 4, 2, 1, 2, 3, 2, 4, 2, 1, 2)  # the dings' bar of three: which of the five, 16th by 16th
PAT4 = (0, 2, 4, 2, 1, 2, 3, 2, 0, 2, 4, 2, 3, 2, 1, 2)
MINOR = (9, 11, 0, 2, 4, 5, 7)  # A minor, for the square's harmony
PANS = (-0.45, 0.0, 0.45)
PIPE = (1, 0.18, 0.42, 0.08, 0.2, 0.05, 0.1, 0.03, 0.05)  # a steam whistle: hollow, the odd harmonics over the even
REED = (1, 0.55, 0.6, 0.3, 0.32, 0.15, 0.16, 0.08, 0.08, 0.04)  # the organ's reeds

# ---- Boingo's lines. Lengths are in beats; 2/5 is five notes in two beats (his laugh), 2/3 three in two. ----
# The tune, sixteen bars of three, in phrases of three bars, three and two: a jump and the note under it; the laugh
# tumbling down; a held note that doesn't belong (G#); a B flat from outside; the bass's climb reaching the top.
# Second time: three notes of two beats across two bars of three, then the laugh turned upward to the top D.
TUNE_A = (
    "A4:1 E5:1.5 D#5:.5 | E5:1 D5:2/5 C#5:2/5 C5:2/5 Bb4:2/5 A4:2/5 | G#4:2 B4:1 | "
    "C5:.5 E5:.5 A5:1.5 G5:.5 | Bb5:1 G5:2/3 E5:2/3 C#5:2/3 | D5:1 F5:.5 E5:1.5 | "
    "D#5:.5 E5:.5 F#5:.5 C6:1.5 | B5:1 G#5:2/3 F5:2/3 D5:2/3"
)
TUNE_B = (
    "A4:1 E5:1.5 D#5:.5 | E5:1 G5:2/5 F5:2/5 E5:2/5 D5:2/5 Bb4:2/5 | B4:1.5 D5:.5 G#5:1 | "
    "E5:.5 A5:.5 C6:2 | Bb5:2 G5:2 F5:2 | "
    "E5:1 F5:2/5 G5:2/5 A5:2/5 Bb5:2/5 D6:2/5 | B5:1.5 G#5:.5 E5:1"
)
TUNE = TUNE_A + " | " + TUNE_B
# The limping verse (the fiddle): bars of 3, 3, 3 and 2. D# held over an E chord, E flat where the E should be.
LIMP = [
    "E5:1 A5:1.5 G#5:.5 | A5:1 G5:2/5 F#5:2/5 F5:2/5 E5:2/5 D5:2/5 | D#5:2 B4:1 | C5:.5 E5:.5 -:1",
    "Bb5:1 G5:2/3 E5:2/3 C#5:2/3 | D5:1 F5:.5 Eb5:1.5 | D#5:.5 E5:.5 F#5:.5 C6:1.5 | B5:1 -:1",
    "A5:1.5 G5:.5 F5:1 | F#5:1 A5:.5 C6:1.5 | B5:1.5 A5:.5 G5:1 | G#5:.5 B5:.5 D6:.5 F6:.5",
]
# The second tune: the tune's first jump as a motif seven 8ths long, a minor third higher each time (the fourth time
# an octave down), a laugh; then the jump held, a fall in threes, a staircase (up a third, down a half step), and out.
SHIFT = (
    "A4:.5 C5:.5 E5:1 D#5:.5 E5:.5 A5:.5 C5:.5 Eb5:.5 G5:1 F#5:.5 G5:.5 C6:.5 Eb5:.5 Gb5:.5 Bb5:1 A5:.5 Bb5:.5 Eb6:.5 "
    "F#4:.5 A4:.5 C#5:1 C5:.5 C#5:.5 F#5:.5 F#5:2/5 E5:2/5 D#5:2/5 C#5:2/5 C5:2/5 | "
    "A5:1.5 C6:.5 E6:2 | Eb6:2/3 C6:2/3 A5:2/3 F5:1 Eb5:1 | D5:.5 F5:.5 E5:.5 G5:.5 F#5:.5 Ab5:.5 G5:.5 Bb5:.5 | B5:1 G#5:1 E5:1 -:1"
)
# The ride starting up: the tune's two neighbors over and over as they rise (the notes the music box will stick on),
# then a run up to the tune.
START = "E5:.5 D#5:.5 " * 9 + "| E5:.5 D#5:.5 E5:.5 A5:.5 B5:.5 C6:.5 | D6:1.5 B5:.5 G#5:.5 E5:.5"
DIES = "A4:.5 C5:.5 E5:1 D#5:.5 E5:.5 A5:.5 A4:.5 C5:.5 E5:1.5"
# The Funhouse. The gritty synth has the tune upside down (the jump falls, the note under it is over it, the laugh
# climbs); the whistle answers right way up, a tritone away; then both at once, one the other's mirror.
DROP_GRIT = (
    "E4:1 A3:1.5 Bb3:.5 A3:1 | B3:2/5 C4:2/5 C#4:2/5 D#4:2/5 E4:2/5 F4:1.5 D4:.5 | -:4 | -:4 | "
    "E4:1 A3:1.5 Bb3:.5 A3:1 | C4:2/5 D4:2/5 Eb4:2/5 F4:2/5 G4:2/5 A4:2 | Bb3:2 D4:2 | E4:1 D4:1 B3:1 -:1"
)
DROP_PIPE = (
    "-:4 | -:4 | Eb5:1 Bb5:1.5 A5:.5 Bb5:1 | Ab5:2/5 G5:2/5 Gb5:2/5 E5:2/5 Eb5:2/5 D5:1.5 F5:.5 | "
    "E5:1 A5:1.5 G#5:.5 A5:1 | C6:2/5 A5:2/5 G5:2/5 F5:2/5 Eb5:2/5 C5:2 | D6:2 Ab5:2 | G#5:1 B5:1 E6:1 -:1"
)
FAST = "E5:.5 F5:.5 E5:.5 F5:.5 F#5:.5 G5:.5 F#5:.5 G5:.5 | G#5:.5 A5:.5 G#5:.5 A5:.5 Bb5:.25 B5:.25 C6:.25 C#6:.25 D6:.25 D#6:.25 E6:.5"
# The gallop's end: the laugh, a half step higher each time.
BERSERK = (
    "E5:2/5 D5:2/5 C#5:2/5 C5:2/5 Bb4:2/5 F5:2/5 Eb5:2/5 D5:2/5 C#5:2/5 B4:2/5 "
    "F#5:2/5 E5:2/5 D#5:2/5 D5:2/5 C5:2/5 G5:2/5 F5:2/5 E5:2/5 Eb5:2/5 C#5:2/5"
)
# The calms. The music box has the tune's first phrase (then it sticks); in the second the whistle plays the jump
# slowly, the fiddle climbs under it, and the music box has the tune upside down.
BOX = "A5:1 E6:1.5 D#6:.5 | E6:1 D6:2/5 C#6:2/5 C6:2/5 Bb5:2/5 A5:2/5 | G#5:2 B5:1 | C6:.5 E6:.5 A6:2"
CALM2_PIPE = "A4:1 E5:2 | D#5:1 E5:2 | -:1 A5:2 | G5:2/3 F5:2/3 D5:2/3 E5:1 | -:9"
CALM2_FIDDLE = "-:12 | F5:3 | F#5:2 A5:1 | G#5:3 | G#5:1 A5:1 B5:1"
CALM2_BOX = "E6:1 A5:1.5 Bb5:.5 | A5:1 B5:2/5 C6:2/5 C#6:2/5 D#6:2/5 E6:2/5"
TAG = "A4:1 E5:1.5 D#5:.5 | E5:1 D5:2/5 C#5:2/5 C5:2/5 Bb4:2/5 A4:2/5 | A4:4 -:2"

for _name, _beats in ((START, 15), (TUNE, 48), (LIMP[0], 11), (LIMP[1], 11), (LIMP[2], 11), (SHIFT, 32), (DIES, 6), (DROP_GRIT, 32), (DROP_PIPE, 32), (FAST, 8),
                      (BERSERK, 8), (BOX, 12), (CALM2_PIPE, 21), (CALM2_FIDDLE, 24), (CALM2_BOX, 6), (TAG, 12)):
    assert beats(_name) == _beats, (_name[:30], beats(_name))


def main(out: str) -> None:
    x = Ride(RIDE, BEATS, SECS, os=2, seed=163)
    put, at = x.put, x.at
    rng = np.random.default_rng(31)
    sr = x.sr
    tau = 2 * np.pi
    sour = np.random.default_rng(5).uniform(-1, 1, 128)  # each pipe's own share of being out of tune

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def ring(ch):
        root, organ, sky = RING[ch]
        return n(root), [n(c) for c in organ.split()], [n(c) for c in sky.split()]

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the strings and the dings duck

    def snare(b, vol=0.26):
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
            tom(b + i * 0.25, m, 0.24 + 0.03 * min(i, 4), {50: 0.3, 45: 0.0, 40: -0.3}[m])

    def clap(b, vol=0.2):
        kk = int(0.02 * sr)
        for o in (0, 0.011, 0.023):
            put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.006) * vol * 0.7, late=o)
        kk = int(0.2 * sr)
        put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol, late=0.03)

    def roll(b, length, v0=0.06, v1=0.24, step=0.25):
        """A snare roll, growing."""
        count = int(round(length / step))
        for i in range(count):
            snare(b + i * step, v0 + (v1 - v0) * i / max(1, count - 1))

    # ---- the low end ----
    def bass(b, m, length, vol=0.4):
        """A deep note driven so small speakers hear it, with a round pluck an octave up."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        env = np.minimum(1, t / 0.006) * np.exp(-t / (k / sr * 2.0)) * tail(k, 0.02)
        w = np.tanh(2.2 * np.sin(ph)) / np.tanh(2.2) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        mid = 0.45 * np.sin(2 * ph + 1.6 * np.exp(-t / 0.09) * np.sin(2 * ph)) * np.exp(-t / 0.3)
        put("bass", b, (w + mid) * env * vol)

    def sub(b, m, length, vol=0.5, swell=False):
        """The 808; `swell`: no thump, the note growing instead (the calm's deep bass)."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** ((0 if swell else 12) * np.exp(-t / 0.012) / 12)) / sr
        env = (np.linspace(0.3, 1, k) ** 1.5 * np.minimum(1, t / 0.03) if swell else np.exp(-t / (k / sr * 0.6))) * tail(k, 0.03)
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

    def boom(b, vol=0.5):
        k = int(0.7 * sr)
        t = np.arange(k) / sr
        put("fx", b, np.tanh(2 * np.sin(tau * np.cumsum(36 + 80 * np.exp(-t / 0.05)) / sr)) * np.exp(-t / 0.2) * tail(k, 0.02) * vol)
        kk = int(0.9 * sr)
        put("fx", b, hiss(kk, 7000, 0.2) * np.exp(-np.arange(kk) / sr / 0.2) * vol * 0.3)

    def hum(b, length, vol=0.1, m0=33, m1=57):
        """The build: a soft tone climbing two octaves, swelling."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(x.hz(m0 + (m1 - m0) * u**1.5)) / sr
        put("fx", b, (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * u**2 * np.minimum(1, (1 - u) * 60) * vol)

    def motor(b, length, vol=0.05):
        """The ride's motor: a low buzz that shakes a little. On the tape, so it rises and sinks with the ride."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        w = sum(np.sin(h * tau * 110 * t + h) / h for h in range(1, 9)) * (1 - 0.3 * (0.5 + 0.5 * np.sin(tau * 7.3 * t)))
        put("fx", b, w * np.sin(np.pi * np.linspace(0, 1, k)) ** 0.5 * vol)

    def pad(b, length, ch, vol=0.045):
        at(b, length)
        for j, m in enumerate(ring(ch)[1]):
            put("pad", b, x.strings(m, length, vol, attack=0.12, release=0.2), PANS[j])

    # ---- the merry-go-round ----
    def pah(b, ch, vol=0.05, length=0.4, off=9.0):
        """The organ's chord, short: the "pah" of oom-pah-pah. `off`: how many cents out its worst pipe is."""
        at(b, length)
        for j, m in enumerate(ring(ch)[1]):
            put("organ", b, x.tone(m + off * sour[m] / 100, length, REED, vol, detune=(-9, 8), attack=0.008, release=0.03), PANS[j])

    def oompah(b, ch, count=3, vol=1.0, jump=False, off=9.0):
        """A bar of `count` beats: the bass in 8ths (the "oom" on 1, an octave up with each "pah"), the organ on the
        other beats (of four: on 2 and 4)."""
        root = ring(ch)[0]
        for i in range(count * 2):
            up = 12 if (i % 2 if jump else i % 2 == 0 and i > 0 and (count != 4 or i in (2, 6))) else 0
            bass(b + i * 0.5, root + up, 0.46, (0.4 if i == 0 else 0.32) * vol)
        for o in {2: (1,), 3: (1, 2), 4: (1, 3)}[count]:
            pah(b + o, ch, 0.05 * vol, off=off)

    def ding(b, m, vol=0.07, pan=0.0, ring_s=0.075):
        """A toy glockenspiel's bar: very short."""
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        w = np.sin(tau * f * t + 0.9 * np.exp(-t / (ring_s * 0.5)) * np.sin(tau * f * 2.76 * t))
        put("dings", b, w * np.exp(-t / ring_s) * np.minimum(1, t / 0.001) * tail(k) * vol, pan)

    def dings(b, count, ch, vol=1.0, keep=1, glints=0.2):
        """A bar of dings: the 16th pattern, each at its own loudness, some with a glint an octave up.
        `keep`: only every such-th one."""
        sky = ring(ch)[2]
        pat = PAT3 if count == 3 else PAT4
        for i in range(count * 4):
            if i % keep:
                continue
            t = b + i * 0.25
            v = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 4 == 0 else 1.0)
            pan = 0.5 * np.sin(i * 1.7 + b)
            ding(t, sky[pat[i]], 0.07 * v, pan)
            if rng.uniform() < glints:
                ding(t + 0.125, sky[pat[i]] + 12, 0.026 * v, -pan)

    def eerie(b, length, ch, each=1.0, vol=0.05):
        """High dings, one or two octaves up, near the 16ths but not on them; `each`: how many a beat; one in four
        a half step out."""
        sky = ring(ch)[2]
        for _ in range(int(round(length * each))):
            m = sky[rng.integers(0, 5)] + 12 * rng.integers(0, 2) + (1 if rng.uniform() < 0.25 else 0)
            ding(b + rng.integers(0, int(length * 4)) * 0.25 + rng.uniform(-0.04, 0.04), m, vol * rng.uniform(0.5, 1.0), rng.uniform(-0.7, 0.7), 0.06)

    def box(start, text, vol=0.11, decay=0.6, pan=0.2):
        """The music box."""
        for b, d, m in notes(start, text):
            at(b, d + 1.5)
            put("box", b, x.bell(m, d + 1.5, vol, ratio=3.5, index=1.8, decay=decay), pan)

    # ---- Boingo's own sounds, as the game builds them (clown-sounds.ts) ----
    def honk(b, vol=0.1, f0=330.0, pan=-0.3):
        """The bulb horn: two buzzes a hair apart over a square an octave down, muffled, the pitch dipping."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(f0 * (1 - 0.06 * np.minimum(1, t / 0.25))) / sr
        w = np.zeros(k)
        for h in range(1, 14):
            w += (0.5 * np.sin(h * ph) + 0.5 * np.sin(1.012 * h * ph)) / h / np.sqrt(1 + (h * f0 / 1400) ** 2)
            if h % 2:
                w += 0.35 * np.sin(h * ph / 2) / h / np.sqrt(1 + (h * f0 / 2800) ** 2)
        put("clown", b, w * np.minimum(1, t / 0.012) * np.minimum(1, (0.3 - t) / 0.08) * vol, pan)

    def laugh(b, vol=0.1, f0=520.0, pan=0.3):
        """The kazoo laugh: five buzzy "ha"s stepping down."""
        k = int(0.65 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(f0 * 0.93 ** np.floor(t / 0.13) * (1 + 0.02 * np.sin(tau * 9 * t))) / sr
        w = sum(np.sin(h * ph) / h / np.sqrt(1 + (h * f0 / 1800) ** 2) for h in range(1, 13))
        u = (t % 0.13) / 0.13
        put("clown", b, w * np.sin(np.pi * np.minimum(1, u / 0.75)) * (u < 0.75) * vol, pan)

    def slide(b, up=True, vol=0.06, pan=0.2):
        """The slide whistle: up (he pops in) or down (he's beaten)."""
        secs = 0.5 if up else 0.8
        k = int(secs * sr)
        t = np.arange(k) / sr
        f = (420 * 3.2 ** (t / 0.5) if up else 1300 * 0.24 ** (t / 0.8)) * (1 + 0.013 * np.sin(tau * 6 * t))
        ph = tau * np.cumsum(f) / sr
        put("clown", b, (np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.04 * hiss(k, 5000)) * np.minimum(1, t / 0.05) * tail(k, 0.1) * vol, pan)

    def flip(b, vol=0.2):
        """The funhouse: a big spring's boing, then a whoosh up and over."""
        k = int(0.75 * sr)
        t = np.arange(k) / sr
        spring = np.sin(tau * np.cumsum(200 + 120 * np.sin(tau * 12 * t) * np.exp(-t / 0.25) + 140 * np.exp(-t / 0.05)) / sr)
        whoosh = np.sin(np.pi * np.clip((t - 0.18) / 0.55, 0, 1)) ** 2
        put("clown", b, (spring * np.exp(-t / 0.16) + 0.5 * whoosh * hiss(k, 4500, 0.6)) * tail(k) * vol)

    def splat(b, vol=0.3):
        """A pie landing: a soft thump dropping in pitch under a wet burst of noise."""
        k = int(0.42 * sr)
        t = np.arange(k) / sr
        thump = np.sin(tau * np.cumsum(150 * np.exp(-t / 0.08) + 55) / sr) * np.exp(-t / 0.07)
        w = (0.6 * thump + hiss(k, 1800) * np.exp(-t / 0.1) * np.minimum(1, t / 0.006)) * tail(k) * vol
        put("clown", b, np.interp(np.arange(0, k, 1 / x.speed(b)), np.arange(k), w))  # squeezed by as much as the tape will stretch it

    def tick(b, vol=0.05):
        """The ride's ratchet: a clack. On the tape, so the clacks come faster as it starts and slower as it dies."""
        k = int(0.012 * sr)
        put("fx", b, hiss(k, 12000, 0.5) * np.exp(-np.arange(k) / sr / 0.003) * vol, 0.4)

    def ticks(b, length, v0=0.05, v1=0.05):
        for i in range(int(length * 2)):
            tick(b + i * 0.5, v0 + (v1 - v0) * i / (length * 2))

    def clunk(b, vol=0.3):
        """The ride's switch thrown."""
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        put("fx", b, (np.sin(tau * 220 * t) * np.exp(-t / 0.05) + 0.6 * hiss(k, 8000) * np.exp(-t / 0.004)) * tail(k) * vol)

    # ---- the voices ----
    def whistle(b, d, m, vol=0.15, pan=-0.1, off=9.0):
        """Boingo: a steam organ's whistle. Two ranks (the second an octave up, a hair sharp), breath, a tremulant;
        each pipe out of tune by its own share of `off` cents. A long note (a beat and a half of the waltz, or more)
        lands sharp and springs about the note before it settles (his pogo); a shorter one chirps up into place."""
        at(b, d)
        k = x.k(d * 0.94)
        t = np.arange(k) / sr
        bend = 0.8 * np.exp(-t / 0.1) * np.cos(tau * 13 * t) if k / sr >= 0.42 else -0.35 * np.exp(-t / 0.012)
        ph = tau * np.cumsum(x.hz(m + off * sour[m] / 100) * 2 ** (bend / 12) * (1 + 0.003 * np.sin(tau * 6.1 * t))) / sr
        w = np.zeros(k)
        for h, a in enumerate(PIPE, 1):
            w += a * np.sin(h * ph + 0.6 * h)
        for h, a in enumerate(PIPE[:4], 1):
            w += 0.4 * a * np.sin(2.008 * h * ph + 1.1 * h)
        breath = hiss(k, 7000, 0.7) * (0.05 + 0.35 * np.exp(-t / 0.02))
        env = np.minimum(1, t / 0.014) * tail(k, 0.03) * (1 - 0.1 * (0.5 - 0.5 * np.cos(tau * 6.1 * t)))
        put("pipe", b, (w + breath) * env * vol, pan)

    def pipe(start, text, vol=1.0, up=0, off=9.0, pan=-0.1):
        for b, d, m in notes(start, text):
            whistle(b, d, m + up, 0.15 * vol, pan, off)

    def driven(start, text, vol=1.0, pan=0.1, up=0):
        """The overdriven lead. A long note that follows another straight on slides in from most of the way back."""
        last = None
        for b, d, m in notes(start, text):
            m += up
            glide = 0.6 * (last[1] - m) if last and abs(last[0] - b) < 1e-6 and d >= 1 and 0 < abs(last[1] - m) <= 12 else 0.0
            at(b, d)
            put("lead", b, x.drive(m, d * 0.96, 0.16 * vol, glide=glide), pan)
            last = (b + d, m)

    def fiddle(start, text, vol=1.0, pan=0.2):
        for b, d, m in notes(start, text):
            at(b, d)
            put("fiddle", b, x.fiddle(m, d * 0.95, 0.145 * vol), pan)

    def grit(start, text, vol=1.0, pan=0.3):
        for b, d, m in notes(start, text):
            at(b, d)
            put("grit", b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def square(start, text, vol=0.07, pan=0.3, up=0, harmony=False):
        for b, d, m in notes(start, text):
            at(b, d)
            put("square", b, x.chip((third(m) if harmony else m) + up, d * 0.9, vol), pan)

    def third(m):
        pc = m % 12
        if pc not in MINOR:
            return m + 3
        return m + (MINOR[(MINOR.index(pc) + 2) % 7] - pc) % 12

    def stutter(b, m, count=4, vol=0.6):
        """A glitch: the gritty synth's note fired again and again, a 32nd apart, fading."""
        for i in range(count):
            at(b + i * 0.125, 0.1)
            put("grit", b + i * 0.125, x.gritty(m, 0.1, 0.21 * vol * (1 - 0.6 * i / count)), 0.4 if i % 2 else -0.4)

    # ---- the band, bar by bar ----
    def waltz(b, i, fill=False):
        """A bar of three: a kick on 1, the snare on 2 and 3 (every other bar a second kick pushing into 3 instead
        of the snare on 2), hats between."""
        kick(b, 0.5)
        if i % 2:
            kick(b + 1.5, 0.38)
        else:
            snare(b + 1, 0.2)
        toms(b + 2) if fill else snare(b + 2, 0.26)
        for o in (0.5, 1.5, 2.5):
            hat(b + o, 0.04), hat(b + o + 0.25, 0.02)

    def four(b, fill=False):
        """A bar of four: a kick on every beat, the snare on 2 and 4, hats between."""
        for i in range(4):
            kick(b + i, 0.5)
            hat(b + i + 0.5, 0.04), hat(b + i + 0.75, 0.02)
        snare(b + 1), snare(b + 3)
        if fill:
            toms(b + 3)

    def polka(b, vol=1.0):
        """A beat of the gallop: a kick on it, the snare off it."""
        kick(b, 0.5 * vol), snare(b + 0.5, 0.2 * vol), hat(b, 0.03), hat(b + 0.5, 0.03)

    WOB = [((2, 1), (1, 2), (1, 4)), ((1, 2), (1, 3), (2, 0.5)), ((1.5, 2), (1.5, 4), (1, 6)), ((1, 1), (1, 4), (2, 2))]

    def funhouse(b, ch, k):
        """A drop bar, half-time: the 808 and a kick that lurches, a clap and the snare on 3 only, the wobble bass
        at changing speeds, 16th hats with a quick run of six at the end of every other bar."""
        low = ring(ch)[0]
        for o, v in ((0, 0.6), (0.75, 0.42), (2.75, 0.45)) + (((3.5, 0.4),) if k % 2 else ()):
            kick(b + o, v)
        clap(b + 2), snare(b + 2, 0.24)
        sub(b, low, 2.6, 0.45), sub(b + 2.75, low, 1.2, 0.38)
        t = b
        for d, rate in WOB[k % 4]:
            wobble(t, low + 12, d, rate, 0.17)
            t += d
        for i in range(12 if k % 2 else 16):
            hat(b + i * 0.25, 0.03 if i % 4 == 2 else 0.018)
        if k % 2:
            for i in range(6):
                hat(b + 3 + i / 6, 0.016 + 0.004 * i)

    # 0:00 The ride starts up (five bars of three; the tape comes up to speed over the first three). The switch, the
    # motor, the organ's oom-pah-pah and the dings, all rising from a groan; a laugh; the kit, the horn, a whistle up.
    clunk(0)
    motor(0, 13, 0.06)
    ticks(0, 10, 0.07, 0.02)
    pipe(0, START, 0.8)
    for i in range(5):
        b, ch = 3 * i, "Am" if i < 4 else "E7"
        bass(b, ring(ch)[0] + 12, 1.4, 0.3)
        pah(b + 1, ch, 0.05), pah(b + 2, ch, 0.05)
        dings(b, 3, ch, vol=0.6 + 0.1 * i, keep=(4, 4, 2, 2, 1)[i], glints=0.1)
    laugh(6.2, 0.09)
    kick(9, 0.45), snare(10, 0.16), snare(11, 0.2), kick(12, 0.5)
    honk(10.5), honk(11.5)
    roll(12.5, 2.5, 0.06, 0.22)
    toms(14, (50, 45, 40, 40))
    slide(13.5, True)

    # 0:07 Boingo's tune: sixteen bars of three. The second eight add strings, the square an octave under the
    # whistle, more glints.
    x.crash(T_TUNE, 0.14, decay=0.5)
    pipe(T_TUNE, TUNE)
    square(T_TUNE + 24, TUNE_B, 0.045, up=-12)
    x.crash(T_TUNE + 24, 0.1, decay=0.4)
    for i, ch in enumerate(TUNE_CH):
        b = T_TUNE + 3 * i
        waltz(b, i, fill=i in (7, 15))
        oompah(b, ch)
        dings(b, 3, ch, glints=0.15 if i < 8 else 0.32)
        if i >= 8:
            pad(b, 3, ch)

    # 0:23 The limping verse: the fiddle; every fourth bar has two beats (the horn honks in the first, the kazoo
    # laughs in the second); the whistle joins for the third phrase as the band pushes.
    for p, text in enumerate(LIMP):
        fiddle(T_LIMP + 11 * p, text)
    pipe(T_LIMP + 22, LIMP[2], 0.6, up=-12)
    honk(T_LIMP + 10), honk(T_LIMP + 10.5)
    laugh(T_LIMP + 20.8, 0.1)
    b = T_LIMP
    for i, ch in enumerate(LIMP_CH):
        count = 2 if i % 4 == 3 else 3
        if count == 2:
            kick(b, 0.5), snare(b + 1, 0.26), hat(b + 0.5, 0.04), hat(b + 1.5, 0.04)
        else:
            waltz(b, i)
        oompah(b, ch, count)
        pad(b, count, ch, 0.04)
        dings(b, count, ch, glints=0.25)
        b += count
    roll(T_SHIFT - 2, 2, 0.08, 0.24)

    # 0:34 The second tune, in four: the overdriven lead; the motif shifting in the bar, the chords climbing by minor
    # thirds, the bass jumping octaves.
    x.crash(T_SHIFT, 0.16, decay=0.5)
    driven(T_SHIFT, SHIFT)
    for i, ch in enumerate(SHIFT_CH):
        b = T_SHIFT + 4 * i
        four(b, fill=i in (3, 7))
        oompah(b, ch, 4, jump=True)
        pad(b, 4, ch, 0.055)
        dings(b, 4, ch, glints=0.3)

    # 0:44 The ride dies: the motif again, sinking, the band still playing as it goes; the whistle falls; a pie.
    driven(T_DIES, DIES)
    for i in range(4):
        kick(T_DIES + i, 0.5), hat(T_DIES + i + 0.5, 0.04)
    snare(T_DIES + 1), snare(T_DIES + 3)
    oompah(T_DIES, "Am", 4, jump=True)
    oompah(T_DIES + 4, "Am", 2, 0.8)
    dings(T_DIES, 4, "Am", keep=2)
    dings(T_DIES + 4, 2, "Am", vol=0.8, keep=2)
    motor(T_DIES, 6, 0.07)
    ticks(T_DIES, 5.5, 0.02, 0.07)
    slide(T_DIES + 0.5, False, 0.05)
    splat(T_DIES + 5)

    # 0:48 Broken, the first calm: eight bars of three, slow, flat and wavering. The music box has the tune's first
    # phrase over the organ barely turning; then it sticks on two notes, and the deep bass climbs under it by half
    # steps, faster and louder, with high dings, a heartbeat, a rising hum, a roll and a whistle into the Funhouse.
    box(T_CALM, BOX)
    motor(T_CALM, 14, 0.035)
    for i, ch in enumerate(TUNE_CH[:4]):
        b = T_CALM + 3 * i
        bass(b, ring(ch)[0] + 12, 2.8, 0.22)
        pah(b + 1, ch, 0.03, off=24), pah(b + 2, ch, 0.03, off=24)
        eerie(b, 3, ch, 0.7, 0.04)
    for i in range(12):  # stuck: 8ths ...
        box(T_CALM + 12 + i * 0.5, ("D#6:.5" if i % 2 else "E6:.5"), 0.06 + 0.002 * i, decay=0.3)
    for i in range(24):  # ... then 16ths
        box(T_CALM + 18 + i * 0.25, ("D#6:.25" if i % 2 else "E6:.25"), 0.06 + 0.0013 * i, decay=0.2)
    t = T_CALM + 12
    for j, (ch, d) in enumerate((("Am", 2), ("Eo/Bb", 2), ("E/B", 2), ("Am/C", 2), ("C#o", 1), ("Dm9", 1), ("D#o", 1), ("E7", 1))):
        sub(t, ring(ch)[0], d, 0.2 + 0.035 * j, swell=True)
        bass(t, ring(ch)[0] + 12, d * 0.95, 0.16 + 0.025 * j)
        for o in range(d):
            pah(t + o, ch, 0.025 + 0.004 * j, off=24)
        eerie(t, d, ch, 1.0 + 0.4 * j, 0.04 + 0.003 * j)
        t += d
    for b in (12, 14, 16, 18, 19, 20, 21, 22, 22.5, 23, 23.5):
        kick(T_CALM + b, 0.26 + 0.012 * (b - 12))
    hum(T_CALM + 16, 8, 0.1)
    roll(T_DROP - 3, 3, 0.04, 0.22)
    toms(T_DROP - 1, (50, 45, 45, 40))
    slide(T_DROP - 1.2, True, 0.06)

    # 1:00 The Funhouse, the drop: eight bars of four, half-time. The gritty synth has the tune upside down for two
    # bars; the whistle and a square answer right way up, a tritone away; then four bars of both at once, mirrored,
    # over a chopped organ and the horn. A stutter at the end of each turn.
    boom(T_DROP, 0.8), x.crash(T_DROP, 0.2, decay=0.6)
    flip(T_DROP)
    grit(T_DROP, DROP_GRIT)
    pipe(T_DROP, DROP_PIPE, 1.05)
    square(T_DROP, DROP_PIPE, 0.05)
    for i, ch in enumerate(DROP_CH):
        b = T_DROP + 4 * i
        funhouse(b, ch, i)
        dings(b, 4, ch, vol=1.05, glints=0.35)
        if i >= 4:
            for j, on in enumerate((1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1)):
                if on:
                    pah(b + j * 0.25, ch, 0.04, 0.2)
            honk(b + 1.5, 0.08), honk(b + 3.5, 0.08)
    for b, m, count in ((7, "D4", 4), (15, "Eb4", 8), (31, "B3", 4)):
        stutter(T_DROP + b, n(m), count)
    toms(T_FAST - 1, (50, 50, 45, 40))

    # 1:12 Faster: two bars, the whistle and the square trilling up by half steps, the snare from 8ths to a roll.
    pipe(T_FAST, FAST)
    square(T_FAST, FAST, 0.06)
    for i in range(8):
        b = T_FAST + i
        kick(b, 0.5), hat(b + 0.5, 0.04)
        bass(b, n("E2") + i, 0.46, 0.4), bass(b + 0.5, n("E2") + i + 12, 0.46, 0.32)
        pah(b + 0.5, "E7", 0.045)
    roll(T_FAST, 4, 0.1, 0.18, 0.5)
    roll(T_FAST + 4, 4, 0.1, 0.26)
    slide(T_RUN - 1.5, True, 0.06)

    # 1:15 The gallop: the tune's first eight bars at a run (still in three, over a kit in two), the square and the
    # whistle together, while the ride overspeeds; then the laugh four times, a half step higher each time.
    x.crash(T_RUN, 0.18, decay=0.5)
    for text, start in ((TUNE_A, T_RUN), (BERSERK, T_RUN + 24)):
        pipe(start, text, 0.9)
        square(start, text, 0.09, pan=0.2)
    chords = [(T_RUN + 3 * i, 3, ch) for i, ch in enumerate(TUNE_CH[:8])] + [(T_RUN + 24 + 2 * i, 2, ch) for i, ch in enumerate(("Am", "Bbm", "Bm", "Cm"))]
    for b, count, ch in chords:
        for i in range(count):
            polka(b + i)
            bass(b + i, ring(ch)[0], 0.46, 0.4), bass(b + i + 0.5, ring(ch)[0] + 12, 0.46, 0.32)
            pah(b + i + 0.5, ch, 0.045)
        dings(b, count, ch, vol=0.9, glints=0.3)
    for i in (0, 2, 4, 6):
        honk(T_RUN + 24 + i, 0.08)
    x.crash(T_RUN + 12, 0.12, decay=0.4), x.crash(T_RUN + 24, 0.14, decay=0.4)

    # 1:23 It breaks: the kit lurches on for four beats, the organ and the dings to the end, slower and slower; one
    # note held as it sinks; a laugh running down; a pie.
    x.crash(T_BREAK, 0.16, decay=0.5)
    pipe(T_BREAK, "E5:5")
    square(T_BREAK, "E5:5", 0.07, pan=0.2)
    for i in range(7):
        if i < 4:
            polka(T_BREAK + i, 1.0 - 0.15 * i)
        bass(T_BREAK + i, n("E2"), 0.46, 0.4), bass(T_BREAK + i + 0.5, n("E3"), 0.46, 0.32)
        pah(T_BREAK + i + 0.5, "E7", 0.05)
    dings(T_BREAK, 4, "E7", vol=0.9, keep=2)
    dings(T_BREAK + 4, 3, "E7", vol=0.9, keep=2)
    motor(T_BREAK, 7, 0.07)
    ticks(T_BREAK, 6.5, 0.02, 0.07)
    laugh(T_BREAK + 1.6, 0.12)
    slide(T_BREAK + 3, False, 0.05)
    splat(T_BREAK + 6)

    # 1:27 Barely turning, the second calm: seven bars of three, slow and three half steps flat. The whistle alone
    # plays the jump slowly; the fiddle climbs in long pulls; the music box has the tune upside down; a far-off
    # laugh. Then three beats in which the ride is wound back up, past where it was.
    pipe(T_CALM2, CALM2_PIPE, 0.8, off=24)
    fiddle(T_CALM2, CALM2_FIDDLE, 0.85)
    box(T_CALM2 + 12, CALM2_BOX, 0.09)
    motor(T_CALM2, 21, 0.035)
    for i, ch in enumerate(CALM2_CH):
        b = T_CALM2 + 3 * i
        bass(b, ring(ch)[0] + 12, 2.8, 0.22)
        if i >= 4:
            sub(b, ring(ch)[0], 3, 0.24 + 0.05 * (i - 4), swell=True)
        pah(b + 1, ch, 0.03, off=24), pah(b + 2, ch, 0.03, off=24)
        eerie(b, 3, ch, 0.7 if i < 4 else 1.4, 0.04)
    laugh(T_CALM2 + 10.2, 0.05, pan=-0.5)
    hum(T_LAST - 7, 7, 0.08)
    for i in range(3):
        kick(T_LAST - 3 + i, 0.4 + 0.05 * i)
        bass(T_LAST - 3 + i, n("E2"), 0.46, 0.36), bass(T_LAST - 2.5 + i, n("E3"), 0.46, 0.3)
        pah(T_LAST - 2.5 + i, "E7", 0.04)
    roll(T_LAST - 3, 3, 0.05, 0.24)
    slide(T_LAST - 1.5, True, 0.06)

    # 1:39 The tune again, the ride a half step sharp and faster: the overdriven lead and the whistle together; in
    # the second eight the square in harmony under them and the horn on the off-beats.
    x.crash(T_LAST, 0.18, decay=0.5)
    driven(T_LAST, TUNE)
    pipe(T_LAST, TUNE, 0.75)
    square(T_LAST + 24, TUNE_B, 0.07, up=-12, harmony=True)
    x.crash(T_LAST + 24, 0.14, decay=0.5)
    for i, ch in enumerate(TUNE_CH):
        b = T_LAST + 3 * i
        waltz(b, i, fill=i in (7, 11, 15))
        oompah(b, ch)
        pad(b, 3, ch, 0.05)
        dings(b, 3, ch, vol=1.05, glints=0.35)
        if i >= 8 and i % 2:
            honk(b + 1.5, 0.07)

    # 1:55 The tag: the jump and the laugh once more, a last hit, and the ride runs down (the organ still turning,
    # the whistle falling) to where bar 1 starts it up again.
    x.crash(T_TAG, 0.16, decay=0.5)
    driven(T_TAG, TAG)
    pipe(T_TAG, TAG, 0.75)
    for i, ch in enumerate(("Am", "Eo/Bb")):
        b = T_TAG + 3 * i
        waltz(b, i, fill=i == 1)
        oompah(b, ch)
        pad(b, 3, ch, 0.05)
        dings(b, 3, ch, vol=1.05, glints=0.3)
    kick(T_TAG + 6, 0.55), snare(T_TAG + 6, 0.24), x.crash(T_TAG + 6, 0.12, decay=0.5)
    for i in range(2):
        b = T_TAG + 6 + 3 * i
        bass(b, n("A2"), 1.4, 0.34)
        pah(b + 1, "Am", 0.05), pah(b + 2, "Am", 0.05)
        dings(b, 3, "Am", vol=0.8, keep=2, glints=0.1)
    motor(T_TAG + 6, 6, 0.07)
    ticks(T_TAG + 6, 6, 0.02, 0.07)
    slide(T_TAG + 7, False, 0.05)

    # The bass, the strings and (lightly) the dings duck under each kick.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["pad"] *= 0.45 + 0.55 * gain
    x.buses["dings"] *= 0.75 + 0.25 * gain

    x.beat_s = 60 / 176  # the echoes' beat
    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("pipe", 0.75, 0.14, 0.06)
    x.echo("dings", 0.75, 0.2, 0.08)
    x.echo("box", 1.0, 0.25, 0.1)
    x.echo("fiddle", 0.75, 0.18, 0.07)
    x.echo("clown", 1.5, 0.2, 0.08)
    levels = {"lead": 1.25, "pipe": 1.25, "bass": 0.58, "sub": 0.5, "wobble": 0.8, "kick": 0.9, "snare": 2.0, "hats": 4.0, "toms": 1.5, "drum": 1.5,
              "dings": 2.4, "pad": 2.2, "organ": 1.8, "grit": 1.1, "square": 1.2, "fx": 1.2, "fiddle": 1.0, "box": 1.5, "clown": 1.0}
    write_wav(out, x.play(x.mixdown(levels, lowpass=8000, room=0.25)))


if __name__ == "__main__":
    main(sys.argv[1])
