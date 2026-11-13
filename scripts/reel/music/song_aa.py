"""Song AA (Eric, Nov 13): Wrangler the cowboy pig's first theme, shelved the same day: "The Wrangler one is good, and
... it was my fault for sending you a song that I realized didn't really fit him ... let's shelve the other one, and
I'll probably release it as ... an unreleased for the game." His theme is song_ab.py; this stays as it is.
A loop of about two minutes forty. He sent a write-up of a
style, made from another game's track ("this is for wrangler"; the rules as for Dash's and Puddles's: "take these
notes and make your own version. Same rules as always"): early-90s biker funk-rock on a 16-bit console's chips.
What is used from the write-up is the style's own means, none of them one song's: a driving rock pace (about 126), a
straight backbeat with the bass's ghost notes a little shuffled; a slap bass as the engine, in 16ths without a
break, of two sounds (a warm thumbed note that drops into its pitch, a bright popped one cut short) with muted
ghosts between; an overdriven lead guitar that bends into its long notes; palm-muted two-note chords chugging; a
crunchy kit with open hats barking off the beat and two quick taps before a snare; a blues scale with its minor
third rubbing the major one; a part of stops and silences; a solo.
What is not used: the write-up's chords (its one-chord groove, its chorus, its turnaround, its last part), its bass
riff (the octave pop and climbing run), its stop-start figure, its climbing ending and dive, or any tune of it (the
write-up's own "original" version is that track's plan moved to another key). The track itself was not listened to,
measured or transcribed, and every melody, riff and chord progression here is original: none of it is any song's or
any game's.

The ideas from his world that run the song: his two powers. The lasso drag: in his fight his rope drags a piece one
square; here it drags the band. The groove sits on G, and every fourth bar the rope catches it (the loop's slap,
the rope snapping taut) and drags the whole riff a step away (down to F, up to A flat, up to A, down to F sharp), the
bass sliding there; in the chorus it is dragged a bar at a time up the board (E flat, F, G, B flat, C, E flat, F); the
lead bends into its long notes from one step under; the snare has its drags (a drummer's word for two quick taps before
a stroke); and the last chorus comes when the rope drags the whole band up a minor third. The showdown: his meter
fills in five of his moves and he fires without warning; so after the standoff (the calm: wind, his spurs, a low
twang) five bars fill, a layer a bar, both ropes whirling, and the band is cut dead; the sting for "DRAW!"; and
the drop is the duel: he (the overdriven guitar) against a fiddle, three rounds as his three pairs are (the rooks':
straight runs; the bishops': long slides; the knights': leaps), on chords a major third apart, then both together.
The fast pattern is a banjo's roll, coming back to its high string (G: it belongs to nearly every chord here).
His sounds, built as the game builds them (packages/app/src/characters/pig-sounds.ts): the rope whirling, a throw,
the loop's slap, the rope snapping taut, his spurs (a dull clink), a stomp, his snort and laugh, the "DRAW!" sting,
a toy cap's pop. Nothing bright, as there.
  python3 song_aa.py <out.wav>

  bars  1-2    0:00  he rides in: the rope whirling, his spurs, a snort; a throw, a catch
  bars  3-10   0:04  the slap bass and the kit; the rope drags them at the end of each four bars
  bars 11-18   0:19  his riff, low on the overdriven guitar
  bars 19-26   0:34  higher and harder: the chords chugging at a gallop, a fiddle answering
  bars 27-34   0:50  the chorus: dragged up the board a bar at a time; the banjo's roll
  bars 35-40   1:05  the standoff (the calm): wind, his spurs, a low twang, a harmonica
  bars 41-45   1:17  his meter fills: a layer a bar, both ropes whirling; cut dead
  bar  46      1:27  "DRAW!"
  bars 47-62   1:29  the showdown (the drop): the guitar and the fiddle, three rounds, then together
  bars 63-68   1:58  the dust settles: hits and silences, the guitar sliding between them
  bars 69-76   2:09  the solo
  bars 77-84   2:24  the rope drags the whole band up a minor third: the last chorus
  bars 85-86   2:38  dragged back home; the rope starts whirling again
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BARS = 86
BEATS = 4 * BARS
TAPE = 162.0
SWING = 0.08  # an off 16th of the bass and the hats is this much of a 16th late
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [
    (bar0(1), bar0(3), 120, 120, 1.0, 1.0, 0.0),
    (bar0(3), bar0(35), 126, 126, 1.0, 1.0, 0.0),
    (bar0(35), bar0(36), 126, 112, 1.0, 1.0, 0.0),
    (bar0(36), bar0(41), 112, 112, 1.0, 1.0, 0.0),  # the standoff
    (bar0(41), bar0(46), 112, 132, 1.0, 1.0, 0.0),  # his meter filling
    (bar0(46), bar0(63), 132, 132, 1.0, 1.0, 0.0),  # "DRAW!" and the showdown
    (bar0(63), bar0(69), 128, 128, 1.0, 1.0, 0.0),
    (bar0(69), bar0(77), 130, 130, 1.0, 1.0, 0.0),  # the solo
    (bar0(77), bar0(85), 132, 132, 1.0, 1.0, 0.0),  # the last chorus
    (bar0(85), BEATS, 132, 120, 1.0, 1.0, 0.0),
]

GROOVE = "G7 G7 G7"  # three bars at home; the fourth is where the rope drags it
CLIMB = "Eb6 F9 G7 Bb6 C9 Eb6 F9 D7"  # the chorus: dragged up the board
CHORDS = (
    f"G7 G7  {GROOVE} F7 {GROOVE} Ab7  {GROOVE} F7 {GROOVE} Ab7  {GROOVE} A7 {GROOVE} F#7  {CLIMB}  "
    "Gm Gm Eb#11 Eb#11 Cm6 D7  D7 D7 D7 D7 D7  D7  G G G G Eb Eb Eb Eb B B B B G Eb B D7  "
    f"G7 G7 G7 G7 G7 G7  {GROOVE} F7 {GROOVE} Ab7  Gb6 Ab9 Bb7 Db6 Eb9 Gb6 Ab9 F7  Bb7 G7"
).split()
assert len(CHORDS) == BARS, len(CHORDS)
CLIMB_BASS = "Eb2 F2 G2 Bb2 C3 Eb3 F3 D3"  # the chorus's bass, a note a bar
KINDS = {"": (0, 4, 7), "7": (0, 4, 7, 10), "6": (0, 4, 7, 9), "9": (0, 4, 7, 10, 14), "m": (0, 3, 7), "m6": (0, 3, 7, 9), "#11": (0, 4, 6, 7)}
DRONE = n("G4")  # the banjo's high string
# The slap bass's two bars: the 16th, half steps over the bar's note, how it's played (thumbed, popped, a muted ghost).
# The first leans on the minor third and the major one side by side; the second walks down the blues scale to home.
RIFF = (
    ((0, 0, "t"), (2, 0, "g"), (3, 12, "p"), (4, 0, "t"), (5, 0, "t"), (6, 12, "p"), (7, 0, "g"), (8, -2, "t"), (9, 0, "t"), (10, 0, "g"), (11, 12, "p"), (12, 3, "t"),
     (13, 4, "t"), (14, 12, "p"), (15, 0, "g")),
    ((0, 0, "t"), (2, 0, "g"), (3, 12, "p"), (4, 0, "t"), (5, 0, "t"), (6, 15, "p"), (7, 12, "p"), (8, 7, "t"), (9, 0, "g"), (10, 6, "t"), (11, 0, "g"), (12, 5, "t"),
     (13, 3, "t"), (14, 0, "t"), (15, 0, "g")),
)
STRIDE = ((0, 0, "t"), (2, 0, "g"), (3, 12, "p"), (4, 0, "t"), (6, 7, "t"), (7, 12, "p"), (8, 0, "t"), (10, 0, "t"), (11, 12, "p"), (12, 7, "t"), (14, 0, "t"), (15, 0, "g"))  # the chorus's bass
GALLOP = (0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15)  # the chugging chords: an 8th and two 16ths, a horse's gallop
KICKS = ((0, 7, 8, 10), (0, 3, 8, 10))  # the kick's 16ths, two bars about
ROLL = (0, 1, 2, 3, 1, 2, 0, 2, 1, 2, 3, 1, 2, 0, 1, 2)  # the banjo's bar: a low note, a middle one, the high string (2), a note over it (3)
FIVE = (0, 1, 2, 3, 2)  # its roll while his meter fills: five 16ths, so it lands somewhere new each time
HIT_A = ((0, 0), (3, 3), (4, 0))  # the stops: the band's hits together (the 16th, half steps over G), then silence
HIT_B = ((0, 7), (3, 6), (6, 5), (8, 3))

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two, .25 a 16th. ----
# His riff, low: three bars and the dragged one, twice.
LOW = (
    "-:1 D4:.5 F4:.5 G4:2 | Bb4:1.5 G4:.5 F4:2/3 D4:2/3 F4:2/3 | G4:.25 G4:.25 -:.5 Bb4:.5 C5:.5 D5:1.5 C5:.5 | C5:1.5 A4:.5 F4:1 -:1 | "
    "-:.5 G4:.5 Bb4:.5 B4:.5 D5:2 | F5:1 D5:2/3 C5:2/3 Bb4:2/3 G4:1 | -:.5 D4:.25 F4:.25 G4:1 Bb4:.5 G4:.5 F4:.5 G4:.5 | Ab4:1.5 C5:.5 Eb5:1 -:1"
)
# Higher and harder.
HIGH = (
    "G5:1.5 F5:.5 D5:.5 F5:.5 G5:1 | Bb5:2 G5:2/3 F5:2/3 D5:2/3 | C5:.25 D5:.25 F5:.25 G5:.25 Bb5:1 G5:.5 F5:.5 D5:1 | E5:1.5 G5:.5 A5:1 -:1 | "
    "-:.5 D5:.5 G5:.5 Bb5:.5 D6:2 | C6:2/3 Bb5:2/3 G5:2/3 F5:1 D5:.5 F5:.5 | G5:.5 G5:.5 -:.5 F5:.5 G5:.5 Bb5:.5 B5:1 | C#6:1.5 A#5:.5 F#5:1 -:1"
)
# The fiddle's answers where the rope has dragged the bar.
HIGH_ANS = "-:4 | -:4 | -:4 | -:3 A5:.25 G5:.25 E5:.25 C#5:.25 | -:4 | -:4 | -:4 | -:3 F#5:.25 A#5:.25 C#6:.25 E6:.25"
# The chorus: three bars, three bars and two.
CHORUS = (
    "G5:1.5 Bb5:.5 C6:2 | C6:1 A5:2/3 G5:2/3 F5:2/3 G5:1 | D6:2.5 B5:.5 G5:.5 D5:.5 | F5:.5 G5:.5 Bb5:1.5 D6:.5 Bb5:1 | "
    "E6:1.5 D6:.5 Bb5:2/3 G5:2/3 E5:2/3 | Eb5:.5 G5:.5 Bb5:1 C6:1.5 Bb5:.5 | A5:1 C6:.5 Eb6:1.5 C6:.5 A5:.5 | F#5:.75 A5:.75 D6:.5 C6:.25 A5:.25 F#5:.25 D5:.25 -:1"
)
# The standoff: the low twang, slowly; a harmonica far off.
SLOW = "-:1 D4:1 G4:2 | Bb4:3 A4:1 | G4:2 A4:2 | Bb4:3 G4:1 | Eb4:2 G4:1 A4:1 | F#4:3 -:1"
HARP = "-:4 | -:4 | -:2.5 Bb4:1.5 | -:4 | -:3 C5:1 | -:1 A4:.5 C5:.5 D5:2"
# The showdown's three rounds (his two bars, then the fiddle's two) and the four bars together.
ROOKS = "G4:.25 A4:.25 B4:.25 C5:.25 D5:.25 E5:.25 F5:.25 G5:.25 B5:1 G5:1 | F5:.25 E5:.25 D5:.25 C5:.25 B4:.25 A4:.25 G4:.25 F4:.25 G4:1.5 -:.5 | -:8"
ROOKS_F = "-:8 | D5:.25 E5:.25 F5:.25 G5:.25 A5:.25 B5:.25 C6:.25 D6:.25 G6:1 D6:1 | C6:.25 B5:.25 A5:.25 G5:.25 F5:.25 E5:.25 D5:.25 B4:.25 G5:1.5 -:.5"
BISHOPS = "Bb4:1 G5:1.5 F5:.5 Eb5:1 | C5:1.5 Bb5:1.5 G5:1 | -:8"
BISHOPS_F = "-:8 | G5:1 Eb6:1.5 C6:.5 Bb5:1 | F5:1.5 C6:1.5 Bb5:1"
KNIGHTS = "B4:.5 B5:.5 A5:.5 F#5:.5 F#4:.5 F#5:.5 D#5:.5 B4:.5 | D#5:.5 D#6:.5 C#6:.5 A5:.5 B5:1.5 -:.5 | -:8"
KNIGHTS_F = "-:8 | F#5:.5 F#6:.5 D#6:.5 B5:.5 B4:.5 B5:.5 A5:.5 F#5:.5 | F#5:.5 F#6:.5 E6:.5 C#6:.5 D#6:1.5 -:.5"
BOTH = "D5:.5 G5:.5 B5:1 A5:.5 G5:.5 D5:1 | Eb5:.5 G5:.5 Bb5:1 C6:.5 Bb5:.5 G5:1 | F#5:.5 B5:.5 D#6:1 C#6:.5 B5:.5 F#5:1 | A5:1 C6:1 D6:1 -:1"
BOTH_F = "B4:.5 D5:.5 G5:1 F5:.5 D5:.5 B4:1 | G4:.5 Bb4:.5 Eb5:1 G5:.5 Eb5:.5 Bb4:1 | D#5:.5 F#5:.5 B5:1 A5:.5 F#5:.5 D#5:1 | F#5:1 A5:1 F#5:1 -:1"
# The dust settles: the guitar's answers in the silences.
BREAK = "-:2 D5:.5 F5:.25 G5:.25 Bb5:1 | -:3 G5:.25 F5:.25 D5:.25 C5:.25 | -:2 F5:.5 G5:.5 Bb5:.5 C6:.5 | -:3 Bb5:.5 G5:.5 | -:2 D6:1.5 C6:.5 | -:4"
SOLO = (
    "D5:.25 F5:.25 G5:.25 Bb5:.25 D5:.25 F5:.25 G5:.25 Bb5:.25 C6:.5 D6:1.5 | F6:2/3 D6:2/3 C6:2/3 Bb5:.25 G5:.25 F5:.25 D5:.25 F5:.5 G5:.5 | "
    "Bb5:.25 B5:.25 D6:.25 B5:.25 Bb5:.25 G5:.25 F5:.25 G5:.25 Bb5:.25 C6:.25 Db6:.25 D6:.25 F6:1 | Eb6:.25 C6:.25 A5:.25 F5:.25 A5:.25 C6:.25 Eb6:.25 F6:.25 Eb6:2 | "
    "D6:.5 D6:.5 F6:.5 D6:.5 D6:.5 F6:.5 G6:1 | F6:.25 D6:.25 C6:.25 Bb5:.25 G5:.25 F5:.25 D5:.25 C5:.25 Bb4:.25 C5:.25 D5:.25 F5:.25 G5:.25 Bb5:.25 C6:.25 D6:.25 | "
    "G6:1.5 F6:.5 D6:2/3 F6:2/3 D6:2/3 | Eb6:.25 C6:.25 Ab5:.25 Gb5:.25 Ab5:.25 C6:.25 Eb6:.25 Gb6:.25 Ab6:2"
)
TAG = "Bb5:.5 Ab5:.5 F5:.5 Ab5:.5 Bb5:2 | G5:1 -:3"
for _line, _beats in ((LOW, 32), (HIGH, 32), (HIGH_ANS, 32), (CHORUS, 32), (SLOW, 24), (HARP, 24), (ROOKS, 16), (ROOKS_F, 16), (BISHOPS, 16), (BISHOPS_F, 16),
                      (KNIGHTS, 16), (KNIGHTS_F, 16), (BOTH, 16), (BOTH_F, 16), (BREAK, 24), (SOLO, 32), (TAG, 8)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
last4 = lambda text: " | ".join(text.split("|")[4:])


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that
    passage (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=199, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(73)
    sr = x.sr
    tau = 2 * np.pi
    sw = lambda i: (i + (SWING if i % 2 else 0)) / 4  # a 16th of the bar, in beats, a little shuffled

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
        """A chord's bass note (D2 to D flat 3), and a way to its notes between two pitches."""
        pc, rest = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name[0]], name[1:]
        if rest[:1] == "b":
            pc, rest = pc - 1, rest[1:]
        elif rest[:1] == "#" and rest != "#11":
            pc, rest = pc + 1, rest[1:]
        pcs = [(pc + i) % 12 for i in KINDS[rest]]
        return 38 + (pc - 2) % 12, lambda lo, hi: [m for m in range(lo, hi + 1) if m % 12 in pcs]

    of = lambda bar: chord(CHORDS[(bar - 1) % BARS])

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.28 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.7 * np.sin(tau * np.cumsum(46 + 120 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.11)) + 0.3 * hiss(k, 6000, 0.5) * np.exp(-t / 0.002)
        put("kick", b, w * tail(k) * vol)

    def snare(b, vol=0.26, soft=False):
        k = int((0.06 if soft else 0.22) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(185 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.04)
        put("snare", b, (0.8 * body + 0.95 * hiss(k, 9000, 0.5) * np.exp(-t / (0.018 if soft else 0.085))) * tail(k) * vol, 0.05)

    def drag(b, vol=0.26):
        """A snare with its drag: two quick, soft taps just before it."""
        snare(b - 0.2, 0.22 * vol, soft=True), snare(b - 0.1, 0.3 * vol, soft=True), snare(b, vol)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        """A closed hat's tick, or an open one's bark."""
        k = int((0.2 if open_ else 0.04) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / (0.065 if open_ else 0.01)) * tail(k, 0.004) * vol, pan)

    def tom(b, m, vol=0.3, pan=0.0):
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.13) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def fill(b, pitches=(55, 55, 50, 45)):
        for i, m in enumerate(pitches):
            tom(b + i * 0.25, m, 0.24 + 0.03 * i, {55: 0.3, 50: 0.0, 45: -0.3}[m])

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

    def tug(b, vol=0.07):
        """The rope snapping taut: a low, creaking thrum."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(95 - 25 * np.minimum(1, t / 0.25)) / sr
        w = sum(np.sin(h * ph) / h for h in range(1, 9)) * (0.6 + 0.4 * np.sign(np.sin(tau * 31 * t)))
        put("fx", b, (w * np.exp(-t / 0.09) + murk(k, 1500) * np.exp(-t / 0.02)) * np.minimum(1, t / 0.002) * tail(k) * vol)

    def lasso(bar, vol=1.0):
        """The rope catches the band as a bar begins, and drags it."""
        catch(bar0(bar) - 0.5, 0.08 * vol), tug(bar0(bar), 0.07 * vol)

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
        """One snort: breath through a pig's nose over a short grunt that drops in pitch."""
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        air = murk(k, 2800)
        ph = tau * np.cumsum(pitch * (1.15 - 0.3 * u)) / sr
        grunt = sum(np.sin(h * ph) / h**1.6 for h in range(1, 9))
        put("fx", b, (band(air, 520, 2.4) * 2 + band(air, 1050, 3.0) * 1.2 + 0.5 * grunt) * np.sin(np.pi * u) ** 0.7 * vol, pan, late=late)

    def laugh(b, vol=0.05):
        for i in range(4):
            snort(b, vol * (1 - 0.12 * i), 135 - 8 * i, 0.09, -0.2, late=0.13 * i)

    def sting(b, vol=0.3):
        """The quick-draw sting: a low damped twang sliding down, then a knock."""
        k = int(0.9 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(43) * 2 ** (-5 * np.minimum(1, t / 0.6) / 12)) / sr
        w = sum(np.sin(h * ph) / h * np.exp(-t * (1 + 0.5 * h) / 0.5) for h in range(1, 13))
        put("fx", b, (w + 0.4 * murk(k, 2500) * np.exp(-t / 0.004)) * np.minimum(1, t / 0.001) * tail(k, 0.05) * vol)
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        put("fx", b + 1.5, (np.sin(tau * np.cumsum(140 + 90 * np.exp(-t / 0.012)) / sr) + 0.8 * murk(k, 1400) * np.exp(-t / 0.01)) * np.exp(-t / 0.04) * tail(k) * vol)

    def cap(b, vol=0.08, pan=0.3):
        """A toy cap's pop."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("fx", b, (hiss(k, 9000, 0.4) * np.exp(-t / 0.005) + 0.5 * np.sin(tau * 900 * t) * np.exp(-t / 0.008)) * tail(k) * vol, pan)

    def wind(b, length, vol=0.03):
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        air = murk(k, 2500)
        sway = 0.5 + 0.5 * np.sin(tau * 2.3 * u + 1)
        put("fx", b, (band(air, 420, 1.2) * (1 - sway) + band(air, 760, 1.2) * sway) * np.sin(np.pi * u) ** 0.8 * (0.5 + 0.5 * sway) * vol * 2.6, -0.3)

    # ---- the band's voices ----
    def slap(b, m, kind="t", vol=0.4, long=0.24, slide=0.0):
        """The slap bass. Thumbed: warm, dropping into its pitch, dying over a fifth of a second. Popped: bright and
        cut short, a string snapping on the frets. A ghost: a muted thud. `slide`: half steps off it starts (the rope
        dragging it)."""
        at(b, long)
        if kind == "g":
            k = int(0.05 * sr)
            t = np.arange(k) / sr
            w = (0.6 * np.sin(tau * x.hz(m) * t) + 0.6 * murk(k, 1200)) * np.exp(-t / 0.012)
        elif kind == "p":
            k = int(0.08 * sr)
            t = np.arange(k) / sr
            ph = tau * x.hz(m) * t
            w = np.sin(ph + 5.0 * np.exp(-t / 0.02) * np.sin(2 * ph)) * np.exp(-t / 0.03) + 0.2 * hiss(k, 7000, 0.5) * np.exp(-t / 0.002)
        else:
            k = x.k(long) + int(0.03 * sr)
            t = np.arange(k) / sr
            ph = tau * np.cumsum(x.hz(m) * 2 ** ((0.8 * np.exp(-t / 0.01) + slide * np.exp(-t / 0.06)) / 12)) / sr
            w = np.sin(ph + (2.6 * np.exp(-t / 0.05) + 0.5) * np.sin(ph)) * (0.3 + 0.7 * np.exp(-t / 0.18))
        put("bass", b, w * np.minimum(1, t / 0.001) * tail(k, 0.02) * vol)

    def sub(b, m, length, vol=0.5):
        """A deep kick with a note in it, for the showdown."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env) * vol)

    made = {}

    def chug(b, m, vol=0.1, open_=False, pan=-0.3):
        """A two-note chord on a driven guitar (the note, its fifth, its octave), muted with the palm; or let ring."""
        if (m, open_) not in made:
            k = int((0.34 if open_ else 0.11) * sr)
            t = np.arange(k) / sr
            w = np.zeros(k)
            for over, loud in ((0, 1.0), (7, 0.8), (12, 0.5)):
                ph = tau * x.hz(m + over) * t
                w += loud * sum(np.sin(h * ph + 0.9 * h) / h for h in range(1, 10))
            size = int(sr / (3200 if open_ else 2200))
            w = np.convolve(np.tanh(1.3 * w), np.ones(size) / size, "same")
            made[(m, open_)] = w * np.exp(-t / (0.13 if open_ else 0.04)) * np.minimum(1, t / 0.002) * tail(k, 0.01)
        put("chug", b, made[(m, open_)] * vol, pan)

    def banjo(b, m, vol=0.05, pan=0.3):
        """A banjo's short plunk: the picked string (synth.py's koto), dying at once."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        put("banjo", b, x.struck("koto", m)[:k] * np.exp(-t / 0.09) * tail(k, 0.03) * vol, pan)

    def twang(start, text, vol=0.2, pan=-0.15):
        """A low guitar, picked and left to ring, its level trembling."""
        for b, d, m in notes(start, text):
            k = int(1.8 * sr)
            t = np.arange(k) / sr
            put("twang", float(b), x.struck("koto", m)[:k] * (1 - 0.4 * (0.5 - 0.5 * np.cos(tau * 5.5 * t))) * tail(k, 0.3) * vol, pan)

    def harp(start, text, vol=0.05, pan=0.35):
        """A harmonica far off: reeds, each note leaning up into place."""
        for b, d, m in notes(start, text):
            at(float(b), float(d))
            put("harp", float(b), x.tone(m, float(d) * 0.95, [1, 0.5, 0.75, 0.25, 0.4, 0.12, 0.18], vol, detune=(-6, 6), vib=0.008, vib_hz=5.5, scoop=0.8, scoop_s=0.06,
                                         attack=0.05, release=0.1), pan)

    def strings(bar, vol=0.03, length=4.0, lo=55, hi=67):
        at(bar0(bar), length)
        ms = of(bar)[1](lo, hi)[:4]
        for j, m in enumerate(ms):
            put("pad", bar0(bar), x.strings(m + 12, length, vol, attack=0.3, release=0.4), -0.45 + 0.9 * j / max(1, len(ms) - 1))

    def wrangled(start, text, vol=1.0, pan=-0.1, up=0, slides=False):
        """Wrangler: the overdriven guitar. A long note is bent up into place from a whole step under (one square), or
        slid into from the note before when that is near; `slides`: every note slides all the way from the last."""
        last = None
        for b, d, m in notes(start, text):
            b, d, m = float(b), float(d), m + up
            joined = last is not None and abs(last[0] - b) < 1e-6
            glide, over = 0.0, 0.035
            if slides and joined:
                glide, over = float(last[1] - m), 0.09 if d >= 1.0 else 0.03
            elif d >= 1.0:
                glide, over = (0.6 * (last[1] - m), 0.035) if joined and 0 < abs(last[1] - m) <= 5 else (-2.0, 0.05)
            at(b, d)
            quick = d < 0.5
            put("lead", b, x.drive(m, d * 0.95, 0.16 * vol, glide=glide, glide_s=over, attack=0.008 if quick else 0.03, release=0.012 if quick else 0.03), pan)
            last = (b + d, m)

    def fiddled(start, text, vol=1.0, pan=0.25, up=0, slides=False):
        last = None
        for b, d, m in notes(start, text):
            b, d, m = float(b), float(d), m + up
            at(b, d)
            if slides and last is not None and abs(last[0] - b) < 1e-6:
                w = x.tone(m, d * 0.95, x.BOWED, 0.145 * vol, vib=0.01, vib_hz=6.0, scoop=float(m - last[1]), scoop_s=0.09, attack=0.04)
            else:
                w = x.fiddle(m, d * 0.95, 0.145 * vol)
            put("fiddle", b, w, pan)
            last = (b + d, m)

    # ---- the band, bar by bar ----
    def rock(bar, vol=1.0, barks=True, ticks=True, drags=True):
        """The kit's bar: the kick's pattern (two bars about), the snare on 2 and 4 (every other bar the second has its
        drag), a hat's tick on every 16th (the off ones soft, a little late) and an open one barking after 2 and 4."""
        b = bar0(bar)
        for i in KICKS[bar % 2]:
            kick(b + i / 4, 0.5 * vol)
        snare(b + 1, 0.26 * vol)
        drag(b + 3, 0.26 * vol) if drags and bar % 2 == 0 else snare(b + 3, 0.26 * vol)
        for i in range(16):
            if barks and i in (6, 14):
                hat(b + i / 4, 0.045 * vol, open_=True)
            elif i % 2 == 0:
                hat(b + i / 4, (0.034 if i % 4 == 0 else 0.024) * vol)
            elif ticks:
                hat(b + sw(i), 0.011 * vol)

    def low(bar):
        """The bar's bass note (the chorus's are its own, climbing)."""
        if 27 <= bar <= 34:
            return n(CLIMB_BASS.split()[bar - 27])
        if 77 <= bar <= 84:
            return n(CLIMB_BASS.split()[bar - 77]) + 3
        return of(bar)[0]

    def riffed(bar, vol=1.0, which=None, pattern=None):
        """The slap bass's bar on the bar's note; where the note isn't the bar before's, it slides there from it."""
        b = bar0(bar)
        root, before = low(bar), low(bar - 1 if bar > 1 else BARS)
        for i, over, kind in pattern or RIFF[(bar + 1) % 2 if which is None else which]:
            slap(b + sw(i), root + over, kind, (0.42 if kind == "t" else 0.36 if kind == "p" else 0.3) * vol, 0.24, float(before - root) if i == 0 else 0.0)

    def galloped(bar, vol=1.0):
        b = bar0(bar)
        root = low(bar) + 12
        for i in GALLOP:
            chug(b + i / 4, root, (0.1 if i % 4 == 0 else 0.07) * vol)

    def picked(bar, up=0):
        """The banjo's four notes in a bar: two of the chord's under its high string, the high string, one of the
        chord's over it. (Where the chord has the note a half step under the high string, the string is fretted a
        whole step up for that bar, so the two don't rub.)"""
        between = of(bar)[1]
        high = DRONE + up
        if between(high - 1, high - 1):
            high += 2
        under = between(high - 12, high - 2)
        return under[0], under[-1], high, between(high + 1, high + 11)[0]

    def rolled(bar, vol=1.0, keep=1, up=0):
        """The banjo's roll: two of the chord's notes under its high string, and one over it."""
        b = bar0(bar)
        four = picked(bar, up)
        for i in range(0, 16, keep):
            banjo(b + sw(i), four[ROLL[i]], 0.05 * vol * rng.uniform(0.7, 1.0) * (1.2 if ROLL[i] == 2 else 1.0), 0.5 * np.sin(1.3 * i + bar))

    def grooved(bar, vol=1.0, gallop=0.0, barks=True):
        """A bar of the groove on G: the kit and the slap bass; `gallop`: the chords chugging, that loud. Every fourth
        bar of it is where the rope drags it."""
        rock(bar, vol, barks), riffed(bar, vol)
        if gallop:
            galloped(bar, gallop)

    # Bars 1-2: he rides in. The rope whirling, faster; his spurs on every beat; a snort; hats; a throw, the loop's
    # slap, the snare's pickup.
    whirl(bar0(1), 6.0, 1.0, 2.0, 0.05)
    for i in range(6):
        stomp(bar0(1) + i, 0.16 + 0.03 * i)
    snort(bar0(1) + 2.5, 0.05)
    for i in range(8):
        hat(bar0(2) + i * 0.5, 0.02 + 0.002 * i)
    throw(bar0(2) + 2, 0.06), catch(bar0(2) + 3, 0.09), snare(bar0(2) + 3.5, 0.12, soft=True), snare(bar0(2) + 3.75, 0.2)

    # Bars 3-10: the slap bass and the kit. Bars 11-18: his riff, low. The rope drags the fourth bar of each four.
    x.crash(bar0(3), 0.16, decay=0.5), tug(bar0(3), 0.07)
    for bar in range(3, 19):
        grooved(bar, barks=bar >= 7)
        if CHORDS[bar - 1] != "G7":
            lasso(bar)
    fill(bar0(11) - 1)
    wrangled(bar0(11), LOW, 0.8)
    x.crash(bar0(11), 0.14, decay=0.5)

    # Bars 19-26: higher and harder. The chords chug at a gallop; the fiddle answers in the dragged bars.
    fill(bar0(19) - 1), x.crash(bar0(19), 0.18, decay=0.5)
    for bar in range(19, 27):
        grooved(bar, gallop=0.85)
        if CHORDS[bar - 1] != "G7":
            lasso(bar)
    wrangled(bar0(19), HIGH), fiddled(bar0(19), HIGH_ANS, 0.8)

    # Bars 27-34: the chorus. Dragged up the board a bar at a time (the bass slides into each); the banjo's roll,
    # coming back to its high string; strings under it.
    fill(bar0(27) - 1, (55, 50, 50, 45)), x.crash(bar0(27), 0.2, decay=0.6)
    for bar in range(27, 35):
        rock(bar), riffed(bar, pattern=STRIDE), galloped(bar, 0.9), rolled(bar), strings(bar, 0.028)
    wrangled(bar0(27), CHORUS)
    lasso(27, 0.8), lasso(31, 0.8)

    # Bars 35-40: the standoff (the calm), the pace sagging into it. No kit: wind, his spurs on 1 and 3, strings (the
    # second chord has its raised fourth), the banjo's roll at half its pace, one low note of the bass a bar; the low
    # twang has a slow tune, a harmonica answers far off.
    wind(bar0(35), 12, 0.015), wind(bar0(38), 12, 0.018)
    for bar in range(35, 41):
        strings(bar, 0.032, lo=55, hi=70), rolled(bar, 0.9, keep=2)
        slap(bar0(bar), low(bar), "t", 0.3, 2.0)
        stomp(bar0(bar), 0.2), stomp(bar0(bar) + 2, 0.17)
    twang(bar0(35), SLOW), harp(bar0(35), HARP)
    snort(bar0(38) + 3, 0.035, 110, 0.2)

    # Bars 41-45: his meter fills, the pace climbing: a layer a bar. The bass on D (the beats, then the gallop) and his
    # boots on every beat; the chords chugging; the snare with its drags, and hats; the guitar's long note, bent up;
    # both ropes whirling, faster, a snare roll. The banjo's five-note roll runs through. The last beat: nothing.
    count = 0
    for j, bar in enumerate(range(41, 46)):
        b = bar0(bar)
        room = 3 if bar == 45 else 4  # the last bar stops a beat early
        for i in (range(0, 4 * room, 4) if j == 0 else [i for i in GALLOP if i < 4 * room]):
            slap(b + i / 4, low(bar), "t", 0.3 + 0.03 * j, 0.24)
        for i in range(room):
            stomp(b + i, 0.2 + 0.04 * j)
        if j >= 1:
            for i in [i for i in GALLOP if i < 4 * room]:
                chug(b + i / 4, low(bar) + 12, 0.05 + 0.012 * j)
        if j >= 2:
            snare(b + 1, 0.14 + 0.03 * j), (drag(b + 3, 0.14 + 0.03 * j) if room == 4 else None)
            for i in range(2 * room):
                hat(b + i * 0.5, 0.02 + 0.004 * j)
        four = picked(bar)
        for i in range(4 * room):
            banjo(b + i / 4, four[FIVE[count % 5]], 0.03 + 0.007 * j, 0.5 * np.sin(1.3 * count))
            count += 1
    wrangled(bar0(44), "A5:4 | D6:3", 0.8)
    whirl(bar0(44), 4.0, 1.0, 1.5, 0.05, -0.3), whirl(bar0(45), 3.0, 1.5, 3.0, 0.07, -0.5), whirl(bar0(45), 3.0, 1.5, 3.0, 0.07, 0.5)
    for i in range(12):
        snare(bar0(45) + i / 4, 0.05 + 0.012 * i, soft=i < 8)

    # Bar 46: "DRAW!" The sting (the low twang sliding down, the knock); then the snare's pickup.
    sting(bar0(46), 0.22)
    snare(bar0(46) + 3.5, 0.14, soft=True), snare(bar0(46) + 3.75, 0.22)

    # Bars 47-62: the showdown (the drop). The whole kit, a deep kick under it, the slap bass, the chords at a gallop,
    # the banjo. Three rounds, four bars each, on chords a major third apart (G, E flat, B): he plays two bars, the
    # fiddle answers with two (a toy cap's pop as it draws). The rooks' round: straight runs. The bishops': long slides.
    # The knights': leaps. Then both together for four, strings under them.
    for bar in range(47, 63):
        b = bar0(bar)
        rock(bar, 1.1), riffed(bar), galloped(bar, 0.95), rolled(bar, 0.9)
        sub(b, low(bar), 1.5, 0.45), sub(b + 2.5, low(bar), 1.0, 0.34)
        if bar % 4 == 3:
            x.crash(b, 0.2, decay=0.6)
        if bar % 4 == 1 and bar < 59:
            cap(b, 0.1)
        if bar >= 59:
            strings(bar, 0.03)
    wrangled(bar0(47), ROOKS), fiddled(bar0(47), ROOKS_F)
    wrangled(bar0(51), BISHOPS, slides=True), fiddled(bar0(51), BISHOPS_F, slides=True)
    wrangled(bar0(55), KNIGHTS), fiddled(bar0(55), KNIGHTS_F)
    wrangled(bar0(59), BOTH), fiddled(bar0(59), BOTH_F)
    fill(bar0(63) - 1)

    # Bars 63-68: the dust settles. The band hits together (the kick, the bass, a chord let ring) and stops; hats and
    # a snare on 4 keep the time, his spurs; the guitar slides about in the silences; he laughs. The last bar: a fill,
    # the rope whirling up.
    x.crash(bar0(63), 0.18, decay=0.5)
    for bar in range(63, 69):
        b = bar0(bar)
        for i, over in (HIT_A if bar % 2 else HIT_B) if bar < 68 else HIT_A:
            kick(b + i / 4, 0.55), slap(b + i / 4, low(bar) + over, "t", 0.44, 0.3), chug(b + i / 4, low(bar) + 12 + over, 0.12, open_=True)
        for i in range(8):
            hat(b + i * 0.5, 0.03 if i % 2 == 0 else 0.02)
        snare(b + 3, 0.24), clink(b + 1.5, 0.03), clink(b + 2.5, 0.025, -0.3)
    wrangled(bar0(63), BREAK, 0.95, slides=True)
    laugh(bar0(64) + 2.25, 0.05)
    fill(bar0(69) - 1, (55, 55, 50, 45)), whirl(bar0(68) + 1, 3.0, 1.0, 2.0, 0.05)

    # Bars 69-76: the solo, over the groove (the rope drags it as before).
    x.crash(bar0(69), 0.18, decay=0.5)
    for bar in range(69, 77):
        grooved(bar, gallop=0.85)
        if CHORDS[bar - 1] != "G7":
            lasso(bar)
    wrangled(bar0(69), SOLO)

    # Bars 77-84: the rope drags the whole band up a minor third (the guitar's first note bent up into it): the last
    # chorus, the fiddle with him an octave under for its last four bars.
    whirl(bar0(76) + 2, 2.0, 2.0, 3.0, 0.05), lasso(77, 1.3)
    x.crash(bar0(77), 0.22, decay=0.6)
    for bar in range(77, 85):
        rock(bar, 1.05), riffed(bar, pattern=STRIDE), galloped(bar, 0.95), rolled(bar, 1.0, up=3), strings(bar, 0.03)
        sub(bar0(bar), low(bar), 1.5, 0.36)
    wrangled(bar0(77), CHORUS, up=3), fiddled(bar0(81), last4(CHORUS), 0.8, up=3 - 12)

    # Bars 85-86: dragged back home. A bar of the groove on B flat; then the rope pulls it down to G (the bass and the
    # guitar sliding), two hits, silence, and the rope whirling again for the way round.
    grooved(85, gallop=0.85)
    lasso(86)
    b = bar0(86)
    for i in (0, 3):
        kick(b + i / 4, 0.55), slap(b + i / 4, low(86), "t", 0.44, 0.3, 3.0 if i == 0 else 0.0), chug(b + i / 4, low(86) + 12, 0.12, open_=True)
    snare(b + 1, 0.26), hat(b, 0.034), hat(b + 0.5, 0.024), hat(b + 1, 0.034)
    wrangled(bar0(85), TAG, 0.95, slides=True)
    whirl(b + 2, 2.0, 1.0, 1.0, 0.04)

    x.beat_s = 60 / 128  # the echoes' beat
    x.echo("lead", 0.75, 0.13, 0.05), x.echo("fiddle", 0.75, 0.14, 0.06), x.echo("twang", 1.0, 0.25, 0.12), x.echo("harp", 1.0, 0.3, 0.15)
    levels = {"lead": 1.1, "fiddle": 1.0, "bass": 0.6, "sub": 0.5, "chug": 3.2, "kick": 0.8, "snare": 1.7, "hats": 4.5, "toms": 1.1, "drum": 1.5,
              "banjo": 3.5, "pad": 2.0, "twang": 2.0, "harp": 1.8, "fx": 2.0}
    return x.play(x.mixdown(levels, lowpass=8500, room=0.18))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
