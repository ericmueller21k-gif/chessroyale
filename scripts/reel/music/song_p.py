"""Song P (Eric, Nov 11): Sawyer's theme, a two-minute loop; and, with song_q.py, Timber the beaver's: "Sawyer and the
beaver are the same so theirs can feel similar ... make theirs the same just swap the overlaying melody, no tone
sounds, use a drum kit. Chopping wood sounds/knocks, lots of drum and bass, earthy tones, things you'd hear in a busy
woodshop."
The tunes were first on tuned wood (a marimba and a xylophone, my reading of "no tone sounds"); Eric: "whatever the
heck is playing it I don't like it sounds really basic", and of seven others tried, "Fiddle, gritty, both great,
square too, add them all in somehow ... and replace the instruments in both you used". So the tunes are on a fiddle,
a gritty driven synth and the old console's square lead (synth.py's `fiddle`, `gritty`, `chip`), all three in both
songs, in different seats.
176 beats a minute, a drum-and-bass break: 352 beats = 88 bars = 120.0 s. E Dorian (E F# G A B C# D), the tunes mostly on
its five-note scale (E G A B D); the bass moves the root (E, G, A, D, B, and C in the calm).
The kit: kick, snare (and ghost strokes), hats, three toms, a rim click, a crash. The bass: a deep note driven so small
speakers hear it, with a woody pluck an octave up; it ducks under each kick.
The woodshop: an axe chopping (a crack, a thock, the split), a hand saw's strokes in time (push and pull), sandpaper,
a hammer on a nail (three taps rising as the nail goes in), wood knocks, planks tumbling, a drill, a table saw
spinning up and biting into a board, wood creaking under strain, and a tree coming down.
The fast pattern under it all: logs in 16ths, zigzagging up the scale like a saw's teeth.
Sawyer's: the fiddle leads; the gritty synth takes the low calls and the drop's tune, the square the third tune and
the harmonies. The beaver's: the square leads, high and chattering (his woodpecker foreman); the fiddle takes the
drop's tune and the harmonies, the gritty synth the low answers and the third tune. `compose(who)` makes either.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_p.py <out.wav>      (Sawyer's)      python3 song_q.py <out.wav>      (the beaver's)

  bars  1-8    the shop wakes: an axe alone; a hand saw; sandpaper, a hammer, the logs; the table saw spins up and cuts
  bars  9-16   the tune over the break and the bass
  bars 17-24   the tune's second half, higher; sandpaper and 16th hats; a drill, planks tumbling
  bars 25-32   half the pace: a low voice and a high one call and answer over long sliding bass notes
  bars 33-36   the table saw spins up under a roll and the axe; wood creaks; the cut
  bars 37-44   a tree comes down, and the second tune over the hardest beat and a driving bass
  bars 45-52   drum and bass alone, the tools trading with them; then toms
  bars 53-60   the calm: the kit out; the tune at half speed over sandpaper and long saw strokes; the saw again
  bars 61-68   the tune's first half, two voices in harmony
  bars 69-76   a third tune trading bars with the toms and the tools
  bars 77-84   the tune's second half in harmony over the hardest beat
  bars 85-88   the tune's start, a run down, planks tumbling, and the table saw winding down into bar 1's axe
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 176.0
BEATS = 352
SECS = BEATS * 60 / BPM

ROOTS = (
    "E E E E E E E E  E E E E G G A A  E E E E D D B B  A A G G E E D B  E E E B  "
    "E E D D G G A B  E E E E G G E E  E E A A C C B B  E E E E G G A A  A A E E G G B B  E E E E D D B B  E E E E"
).split()
assert len(ROOTS) == 88
BASS = {"E": "E1", "G": "G1", "A": "A1", "B": "B1", "C": "C2", "D": "D2"}
COLOR = {"E": 10, "G": 9, "A": 10, "D": 9, "B": 10, "C": 7}  # the bass's passing note, in the key over each root
# The logs' five notes over each root (all inside E Dorian; over B the leading note D sharp).
LOGS = {
    "E": ("E4", (0, 3, 5, 7, 10)), "G": ("G4", (0, 2, 4, 7, 9)), "A": ("A4", (0, 2, 4, 7, 9)),
    "D": ("D4", (0, 2, 4, 7, 9)), "B": ("B3", (0, 4, 5, 7, 10)), "C": ("C4", (0, 2, 4, 7, 9)),
}
DORIAN = (4, 6, 7, 9, 11, 1, 2)

# ---- the tunes: {who: {part: notes}}. "call" is (the lead's bars, the answering instrument's bars). ----
TUNES = {
    "sawyer": {
        # A sawing shape: up three and back, in a 3-3-2 push.
        "tune": (
            "E4:.75 G4:.75 A4:.5 B4:.75 A4:.75 G4:.5 | A4:.75 E4:.75 -:.5 E4:.25 G4:.25 A4:.5 B4:1 | "
            "D5:.75 B4:.75 A4:.5 B4:.75 D5:.75 E5:.5 | D5:.5 B4:.5 A4:.5 G4:.5 E4:1.5 -:.5 | "
            "D5:1 B4:.5 G4:.5 A4:.75 B4:.75 D5:.5 | B4:.5 -:.5 B4:.5 D5:.5 E5:.5 D5:.5 B4:.5 G4:.5 | "
            "A4:.75 C#5:.75 E5:.5 F#5:1 -:.5 E5:.5 | C#5:.5 E5:.5 -:.5 C#5:.5 B4:.5 A4:.5 B4:1 | "
            "E5:.75 D5:.75 B4:.5 A4:.75 B4:.75 D5:.5 | E5:.75 B4:.75 -:.5 B4:.25 D5:.25 E5:.5 G5:1 | "
            "A5:.75 G5:.75 E5:.5 D5:.75 E5:.75 G5:.5 | E5:.5 D5:.5 B4:.5 A4:.5 B4:1.5 -:.5 | "
            "F#5:.5 F#5:.5 E5:.5 D5:.5 -:.5 A4:.5 D5:.5 E5:.5 | F#5:1 -:.5 E5:.25 D5:.25 A4:.5 B4:.5 D5:1 | "
            "B4:.75 D#5:.75 F#5:.5 B5:1 -:.5 A5:.5 | F#5:.25 E5:.25 D#5:.25 B4:.25 A4:.5 F#4:.5 B4:1 -:1"
        ),
        "call": (
            "A3:1 C#4:.5 E4:.5 A4:1.5 -:.5 | -:4 | G3:.75 G3:.75 B3:.5 D4:1 G4:.5 -:.5 | -:4 | "
            "E3:1 G3:.5 B3:.5 E4:.5 D4:.5 B3:1 | -:4 | D4:.5 F#4:.5 A4:.5 D5:.5 -:.5 A4:.5 F#4:.5 D4:.5 | B3:.5 D#4:.5 F#4:.5 B4:.5 -:2",
            "-:4 | -:1 E6:.25 F#6:.25 A6:.5 -:.5 F#6:.5 E6:1 | -:4 | -:1 D6:.5 B5:.25 D6:.25 E6:.5 G6:.5 D6:1 | "
            "-:4 | -:.5 B5:.5 D6:.5 E6:.5 G6:1 E6:.5 -:.5 | -:4 | -:2 D#6:.25 F#6:.25 B6:.5 -:1",
        ),
        # Hammering: three quick strokes on one note, then on.
        "second": (
            "B4:.25 B4:.25 B4:.5 D5:.5 E5:.5 -:.5 E5:.25 E5:.25 G5:.5 E5:.5 | D5:.5 B4:.5 A4:.5 B4:1 -:.5 G4:.5 A4:.5 | "
            "A4:.25 A4:.25 A4:.5 D5:.5 F#5:.5 -:.5 F#5:.25 F#5:.25 A5:.5 F#5:.5 | E5:.5 D5:.5 A4:.5 D5:1 -:.5 A4:.5 B4:.5 | "
            "D5:.75 D5:.75 B4:.5 G4:.5 B4:.5 D5:.5 G5:.5 | E5:1 D5:.5 -:.5 B4:.25 D5:.25 E5:.5 D5:1 | "
            "A5:.75 E5:.75 C#5:.5 E5:.5 -:.5 C#5:.5 E5:.5 | F#5:.5 -:.5 F#5:.5 A5:.5 B5:1 -:1"
        ),
        "calm": (
            "E4:1.5 G4:1.5 A4:1 | B4:1.5 A4:1.5 G4:1 | A4:1.5 E4:1.5 -:1 | E4:.5 G4:.5 A4:1 B4:2 | "
            "G4:2 E4:1 G4:1 | C5:1.5 B4:.5 G4:2 | F#4:2 B4:1 D#5:1 | F#5:3 -:1"
        ),
        # A bar of tune, a bar left to the drums and tools (with the pick-up into the next).
        "third": (
            "E5:.5 E5:.25 E5:.25 C#5:.5 A4:.5 C#5:.5 E5:.5 A5:1 | -:3 E5:.25 G5:.25 A5:.5 | "
            "B5:.5 B5:.25 B5:.25 A5:.5 G5:.5 E5:.5 G5:.5 E5:1 | -:3 D5:.25 E5:.25 G5:.5 | "
            "G5:1 D5:.5 B4:.5 D5:.25 E5:.25 D5:.5 B4:1 | -:3 B4:.25 D5:.25 F#5:.5 | "
            "B5:.75 F#5:.75 D#5:.5 F#5:.75 B5:.75 D#6:.5 | F#5:.5 D#5:.5 B4:.5 F#4:.5 B4:1 -:1"
        ),
        "end": (
            "E4:.75 G4:.75 A4:.5 B4:.75 A4:.75 G4:.5 | A4:.75 E4:.75 -:.5 E4:.25 G4:.25 A4:.5 B4:1 | "
            "E5:.25 D5:.25 B4:.25 A4:.25 G4:.25 E4:.25 D4:.25 B3:.25 E3:1 -:1"
        ),
    },
    "beaver": {
        # A chatter of four quick strokes (the woodpecker), then a leap and a fall with gaps.
        "tune": (
            "B5:.25 B5:.25 B5:.25 B5:.25 E6:.5 D6:.5 -:.5 B5:.5 A5:.5 G5:.5 | A5:.5 B5:.5 -:.5 G5:.5 E5:1 -:.5 D5:.25 E5:.25 | "
            "G5:.25 G5:.25 G5:.25 G5:.25 B5:.5 A5:.5 -:.5 G5:.5 A5:.5 B5:.5 | D6:.5 E6:.5 -:.5 D6:.5 B5:1.5 -:.5 | "
            "G5:.5 B5:.5 D6:.5 -:.5 D6:.25 E6:.25 D6:.5 B5:.5 G5:.5 | A5:.5 B5:.5 -:.5 D6:.5 E6:1 -:.5 D6:.5 | "
            "C#6:.25 C#6:.25 C#6:.25 C#6:.25 E6:.5 A6:.5 -:.5 F#6:.5 E6:.5 C#6:.5 | B5:.5 C#6:.5 -:.5 A5:.5 B5:1 -:1 | "
            "E6:.5 -:.5 E6:.25 D6:.25 B5:.5 D6:.5 E6:.5 G6:.5 E6:.5 | D6:.5 B5:.5 -:.5 A5:.5 B5:.25 D6:.25 E6:.5 -:1 | "
            "G6:.5 -:.5 G6:.25 E6:.25 D6:.5 E6:.5 G6:.5 A6:.5 G6:.5 | E6:.5 D6:.5 -:.5 B5:.5 A5:.5 B5:1 -:.5 | "
            "A5:.25 A5:.25 A5:.25 A5:.25 D6:.5 F#6:.5 -:.5 E6:.5 D6:.5 A5:.5 | F#5:.5 A5:.5 -:.5 D6:.5 E6:.5 D6:.5 -:.5 A5:.5 | "
            "B5:.5 D#6:.5 F#6:.5 -:.5 F#6:.25 A6:.25 F#6:.5 D#6:.5 B5:.5 | A5:.25 F#5:.25 D#5:.25 B4:.25 D#5:.5 F#5:.5 B5:1 -:1"
        ),
        "call": (
            "E6:.25 E6:.25 E6:.5 C#6:.5 A5:.5 -:2 | -:4 | G6:.5 D6:.25 D6:.25 B5:.5 D6:.5 -:2 | -:4 | "
            "B5:.5 D6:.5 E6:.25 E6:.25 E6:.5 G6:.5 E6:.5 -:1 | -:4 | A5:.25 D6:.25 F#6:.5 A6:.5 F#6:.5 -:.5 D6:.5 A5:.5 F#5:.5 | -:2 D#6:.25 F#6:.25 B6:.5 -:1",
            "-:4 | -:2 A3:.5 E4:.5 A4:1 | -:4 | -:2 G3:.5 D4:.5 G4:1 | "
            "-:4 | E3:.5 B3:.5 E4:1 -:.5 D4:.5 B3:.5 E3:.5 | -:4 | B3:.5 F#4:.5 B4:.5 -:2.5",
        ),
        # Bouncing: octave leaps.
        "second": (
            "E5:.5 E6:.5 B5:.5 E6:.5 -:.5 D6:.25 E6:.25 G6:.5 E6:.5 | D6:.5 B5:.5 A5:.5 -:.5 A5:.25 B5:.25 D6:.5 B5:1 | "
            "D5:.5 D6:.5 A5:.5 D6:.5 -:.5 E6:.25 F#6:.25 A6:.5 F#6:.5 | E6:.5 D6:.5 -:.5 A5:.5 F#5:.5 A5:.5 D6:1 | "
            "G6:1 D6:.5 B5:.5 -:.5 B5:.25 D6:.25 G6:.5 B6:.5 | A6:.5 G6:.5 E6:.5 D6:.5 -:.5 B5:.5 D6:1 | "
            "A5:.25 C#6:.25 E6:.25 A6:.25 -:.5 A6:.5 F#6:.5 E6:.5 C#6:.5 E6:.5 | F#6:.5 -:.5 D#6:.25 F#6:.25 B6:1.5 -:1"
        ),
        "calm": (
            "B5:2 E6:1 D6:1 | -:1 B5:1 A5:1 G5:1 | A5:1 B5:1 -:1 G5:1 | E5:2 -:1 D5:.5 E5:.5 | "
            "E5:2 G5:1 C6:1 | B5:1.5 G5:.5 E5:2 | D#5:2 F#5:1 B5:1 | D#6:3 -:1"
        ),
        "third": (
            "A6:.5 E6:.25 E6:.25 C#6:.5 E6:.5 A5:.5 C#6:.5 E6:1 | -:3 E6:.25 F#6:.25 A6:.5 | "
            "B6:.5 G6:.25 G6:.25 E6:.5 G6:.5 B5:.5 E6:.5 G6:1 | -:3 D6:.25 E6:.25 G6:.5 | "
            "D6:.5 -:.5 D6:.25 B5:.25 G5:.5 B5:.5 D6:.5 G6:1 | -:3 B5:.25 D6:.25 F#6:.5 | "
            "B6:.5 F#6:.5 D#6:.5 -:.5 D#6:.25 F#6:.25 B6:.5 F#6:.5 D#6:.5 | B5:.5 D#6:.5 F#6:.5 B6:1.5 -:1"
        ),
        "end": (
            "B5:.25 B5:.25 B5:.25 B5:.25 E6:.5 D6:.5 -:.5 B5:.5 A5:.5 G5:.5 | A5:.5 B5:.5 -:.5 G5:.5 E5:1 -:.5 D5:.25 E5:.25 | "
            "E6:.25 D6:.25 B5:.25 A5:.25 G5:.25 E5:.25 D5:.25 B4:.25 E4:1 -:1"
        ),
    },
}
for _who, _t in TUNES.items():
    for _part, _beats in (("tune", 64), ("second", 32), ("calm", 32), ("third", 32), ("end", 12)):
        assert abs(length(_t[_part]) - _beats) < 1e-9, (_who, _part, length(_t[_part]))
    for _text in _t["call"]:
        assert abs(length(_text) - 32) < 1e-9, (_who, "call", length(_text))
    for _text in [_t[p] for p in ("tune", "second", "calm", "third", "end")] + list(_t["call"]):
        for _bar in _text.split("|"):
            assert abs(length(_bar) - 4) < 1e-9, (_who, _bar)

# ---- the kit's bars, a 16th a letter: K kick, k a softer kick, S snare, g a ghost stroke, r the rim, t m f toms ----
P1, P2, P3, P4 = "K...S..g..K.S..g", "K..kS..g.gK.S.g.", "K.K.S..S.SK...S.", "K...S.k..gK.S.SS"
HALF1, HALF2 = "K.....k.S.....g.", "K..k....S...k.g."
FILL1, FILL2 = "K...S..g..K.ttmf", "K.S.S.SSttmmffff"
TRADE = ["K.ttS.mmK.ffS.SS", "S.SSK.ttmmS.ffff", "K.f.S.ffttmmS.S.", "SSSSttttmmmmffff"]

# ---- the bass's bars (two a riff): (beat, beats, semitones over the root or "c" its passing note, a slide in from) ----
RIFFS = {
    "roll": [[(0, 1.0, 0, 0), (1.5, 0.5, 0, 0), (2.5, 0.75, 0, 0), (3.25, 0.25, "c", 0), (3.5, 0.5, 12, 0)],
             [(0, 1.0, 0, 0), (1.5, 0.5, 7, 0), (2.5, 0.5, 0, 0), (3, 0.5, 12, 0), (3.5, 0.5, "c", 0)]],
    "half": [[(0, 2.4, 0, 0), (2.5, 1.5, 0, 12)], [(0, 1.5, 0, 0), (1.5, 1.0, 7, 0), (2.5, 1.5, 0, -5)]],
    "drive": [[(0, 0.5, 0, 0), (0.5, 0.5, 0, 0), (1, 0.5, 12, 0), (1.5, 0.5, 0, 0), (2, 0.5, 0, 0), (2.5, 0.5, "c", 0), (3, 0.5, 7, 0), (3.5, 0.5, 12, 0)],
              [(0, 0.5, 0, 0), (0.5, 0.5, 12, 0), (1, 0.5, 0, 0), (1.5, 0.5, "c", 0), (2, 0.5, 0, 0), (2.5, 0.5, 0, 0), (3, 0.25, 12, 0), (3.25, 0.25, 12, 0), (3.5, 0.5, 7, 0)]],
    "solo": [[(0, 0.75, 0, 0), (0.75, 0.75, 12, 0), (1.5, 0.5, "c", 0), (2.5, 0.5, 0, 0), (3, 0.5, 7, 0), (3.5, 0.5, 12, 7)],
             [(0, 1.5, 0, 0), (2, 0.25, 12, 0), (2.25, 0.25, 12, 0), (2.5, 0.5, "c", 0), (3, 1.0, 0, 12)]],
    "long": [[(0, 3.9, 0, 0)], [(0, 3.9, 0, 0)]],
}


def compose(who: str) -> np.ndarray:
    """The whole song as a stereo mix: the same woodshop for both, `who`'s tunes over it ("sawyer" or "beaver")."""
    x = Mix(SECS, BEATS, os=2, seed=149)
    put = x.put
    rng = np.random.default_rng(19)
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

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.28 * sr)
        t = np.arange(k) / sr
        f = 48 + 170 * np.exp(-t / 0.013)
        w = np.tanh(2.0 * np.sin(tau * np.cumsum(f) / sr) * np.exp(-t / 0.1))
        click = int(0.002 * sr)
        w[:click] += rng.uniform(-0.5, 0.5, click)
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass ducks

    def snare(b, vol=0.3, ghost=False):
        k = int((0.1 if ghost else 0.22) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(190 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.045) + 0.5 * np.sin(tau * 330 * t) * np.exp(-t / 0.03)
        w = 0.8 * body + 0.95 * hiss(k, 16000, 0.6) * np.exp(-t / (0.03 if ghost else 0.075))
        put("snare", b, w * tail(k) * vol * (0.3 if ghost else 1.0), 0.08)

    def rim(b, vol=0.15):
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("snare", b, (np.sin(tau * 1750 * t) * np.exp(-t / 0.004) + 0.7 * np.sin(tau * 430 * t) * np.exp(-t / 0.018)) * vol, -0.2)

    def hat(b, vol=0.06, open_=False):
        k = int((0.22 if open_ else 0.04) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 26000, 0.9) * np.exp(-t / (0.07 if open_ else 0.011)) * tail(k, 0.004) * vol, 0.3)

    def tom(b, m, vol=0.35, pan=0.0):
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        f = x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))
        w = np.sin(tau * np.cumsum(f) / sr) * np.exp(-t / 0.14) + 0.4 * hiss(k, 4000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def kit(bar, pat, hats="8", vol=1.0):
        b = bar * 4
        for i, c in enumerate(pat):
            t = b + i * 0.25
            if c == "K":
                kick(t, 0.5 * vol)
            elif c == "k":
                kick(t, 0.36 * vol)
            elif c == "S":
                snare(t, 0.3 * vol)
            elif c == "g":
                snare(t, 0.3 * vol, ghost=True)
            elif c == "r":
                rim(t, 0.15 * vol)
            elif c == "t":
                tom(t, 50, 0.34 * vol, 0.3)
            elif c == "m":
                tom(t, 45, 0.36 * vol, 0.0)
            elif c == "f":
                tom(t, 40, 0.4 * vol, -0.3)
        if hats == "8":
            for i in range(8):
                hat(b + i * 0.5, (0.07 if i % 2 else 0.05) * vol * rng.uniform(0.85, 1.1))
        elif hats == "16":
            for i in range(16):
                hat(b + i * 0.25, (0.065 if i % 4 == 2 else 0.04) * vol * rng.uniform(0.85, 1.1))
        elif hats == "open":
            for i in range(4):
                hat(b + i + 0.5, 0.06 * vol, open_=True)

    # ---- the woodshop ----
    def chop(b, vol=0.5, pan=-0.15):
        """An axe into a log: a crack, a deep woody thock, and the split's crackle."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        f = 190 * (1 + 0.5 * np.exp(-t / 0.008))
        thock = np.sin(tau * np.cumsum(f) / sr) * np.exp(-t / 0.05) + 0.5 * np.sin(tau * 510 * t) * np.exp(-t / 0.022) + 0.25 * np.sin(tau * 1240 * t) * np.exp(-t / 0.009)
        put("chop", b, (thock + 0.9 * hiss(k, 14000, 0.5) * np.exp(-t / 0.004)) * tail(k) * vol, pan)
        for _ in range(5):
            at = rng.uniform(0.03, 0.16)
            kk = int(rng.uniform(0.001, 0.003) * sr)
            put("chop", b + at / x.beat_s, rng.uniform(-1, 1, kk) * vol * rng.uniform(0.1, 0.3), pan + rng.uniform(-0.3, 0.3))

    def hammer(b, step=0, vol=0.2, pan=0.4):
        """A hammer on a nail: a bright tink over a knock on the wood; `step` raises it as the nail goes in."""
        k = int(0.12 * sr)
        t = np.arange(k) / sr
        hz = 1900 * 2 ** (step / 12)
        w = (np.sin(tau * hz * t) + 0.5 * np.sin(tau * hz * 2.76 * t)) * np.exp(-t / 0.018) + 0.9 * np.sin(tau * 360 * t) * np.exp(-t / 0.014) + 0.5 * hiss(k, 10000) * np.exp(-t / 0.002)
        put("taps", b, w * tail(k) * vol, pan)

    def knock(b, hz=520.0, vol=0.2, pan=0.0):
        k = int(0.1 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * hz * t) + 0.5 * np.sin(tau * hz * 2.7 * t) * np.exp(-t / 0.006)
        put("taps", b, w * np.exp(-t / 0.02) * np.minimum(1, t / 0.0005) * vol, pan)

    def tumble(b, steps=8, step=0.125, top=900.0, vol=0.16):
        """Planks falling: knocks stepping down, side to side, a little loose in time."""
        for i in range(steps):
            knock(b + i * step + rng.uniform(-0.02, 0.02), top * 0.9**i, vol + 0.01 * i, 0.5 if i % 2 else -0.5)

    def saw(b, beats, push=True, vol=0.1, pan=-0.45):
        """A hand saw's stroke: a rasp with the teeth in it, quickening; the push brighter and louder than the pull."""
        k = x.k(beats)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        teeth = 0.55 + 0.45 * np.sign(np.sin(tau * (95 if push else 70) * t * (0.7 + 0.6 * u)))
        put("sawing", b, hiss(k, 9500 if push else 6500, 0.85) * teeth * np.sin(np.pi * u) ** 0.6 * vol * (1.0 if push else 0.7), pan)

    def sand(b, beats, vol=0.05, pan=0.45):
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        put("sawing", b, hiss(k, 15000, 0.5) * np.sin(np.pi * u) ** 1.5 * vol, pan)

    def power_saw(b, beats, f0, f1, vol=0.13, up=True):
        """A table saw's motor and blade: a buzz and a whine, spinning up (or winding down)."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        f = f0 * (f1 / f0) ** (u**0.7 if up else u**1.4)
        ph = np.cumsum(f) / sr
        w = 0.6 * (2 * (ph % 1) - 1) + 0.5 * np.sin(tau * 7 * ph) + 0.25 * hiss(k, 12000, 0.5) * (u if up else 1 - u)
        env = (u**1.3 if up else (1 - u) ** 1.2) * np.minimum(1, u * 50) * np.minimum(1, (1 - u) * 200)
        put("fx", b, w * env * vol)

    def cut(b, beats, vol=0.2):
        """The blade biting into a board: a scream of noise chopped by the teeth, the motor bogging down."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        ph = np.cumsum(380 * (1 - 0.22 * np.sin(np.pi * u))) / sr
        w = hiss(k, 16000, 0.7) * (0.5 + 0.5 * np.sign(np.sin(tau * ph))) + 0.4 * (2 * (ph % 1) - 1)
        put("fx", b, w * np.minimum(1, u * 40) * np.minimum(1, (1 - u) * 30) * vol)

    def drill(b, beats, vol=0.1, pan=0.5, pitch=230.0):
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        ph = np.cumsum(pitch * (0.8 + 0.25 * np.minimum(1, u * 4))) / sr
        w = 0.6 * (2 * (ph % 1) - 1) + 0.4 * np.sin(tau * 5 * ph) + 0.3 * hiss(k, 9000, 0.6)
        put("fx", b, w * np.minimum(1, u * 30) * np.minimum(1, (1 - u) * 25) * vol, pan)

    def creak(b, beats, vol=0.2, pan=0.2):
        """Wood under strain: a run of clicks speeding up, each ringing a board."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        hits = np.flatnonzero(np.diff(np.floor(np.cumsum(14 + 60 * u**2) / sr)) > 0)
        kk = int(0.03 * sr)
        tt = np.arange(kk) / sr
        out = np.zeros(k + kk)
        for h in hits:
            out[h : h + kk] += np.sin(tau * (520 + 260 * h / k + rng.uniform(-40, 40)) * tt) * np.exp(-tt / 0.006) * (0.4 + 0.6 * h / k)
        put("fx", b, out * vol, pan)

    def timber(b, vol=0.6):
        """A tree coming down: a deep boom, a wash of noise, and the branches' crackle after it."""
        k = int(0.9 * sr)
        t = np.arange(k) / sr
        put("fx", b, np.tanh(2.2 * np.sin(tau * np.cumsum(34 + 90 * np.exp(-t / 0.05)) / sr)) * np.exp(-t / 0.25) * tail(k, 0.02) * vol)
        kw = int(1.2 * sr)
        put("fx", b, hiss(kw, 9000, 0.3) * np.exp(-np.arange(kw) / sr / 0.3) * vol * 0.4)
        for _ in range(60):
            at = rng.uniform(0, 1) ** 1.5 * 1.4
            kk = int(rng.uniform(0.001, 0.004) * sr)
            put("fx", b + at / x.beat_s, rng.uniform(-1, 1, kk) * vol * 0.35 * rng.uniform(0.3, 1) * (1 - at / 1.4), rng.uniform(-0.8, 0.8))

    def shop(bar, sawing=True, sanding=False, taps=True, vol=1.0, long=False):
        """The tools in time: the hand saw's push and pull (8ths, or a beat a stroke when `long`), sandpaper in 16ths,
        and the hammer: one tap and a knock, or on every second bar three taps rising."""
        b = bar * 4
        if sawing and long:
            for i in range(4):
                saw(b + i, 0.95, i % 2 == 0, 0.1 * vol)
        elif sawing:
            for i in range(8):
                saw(b + i * 0.5, 0.45, i % 2 == 0, 0.085 * vol)
        if sanding:
            for i in range(16):
                sand(b + i * 0.25, 0.22, (0.05 if i % 4 == 2 else 0.03) * vol)
        if taps and bar % 2:
            for j, o in enumerate((3.25, 3.5, 3.75)):
                hammer(b + o, 2 * j, (0.14 + 0.04 * j) * vol)
        elif taps:
            hammer(b + 1.5, 0, 0.16 * vol), knock(b + 2.75, 520, 0.14 * vol, -0.3)

    # ---- the logs ----
    def wood(m, vol, decay, bright=0.3, ratio=4.0):
        k = int(decay * 5 * sr)
        t = np.arange(k) / sr
        f = tau * x.hz(m) * t
        w = np.sin(f) + bright * np.sin(ratio * f) * np.exp(-t / 0.03) + 0.1 * np.sin(9.2 * f) * np.exp(-t / 0.008)
        return w * np.exp(-t / decay) * np.minimum(1, t / 0.0015) * tail(k) * vol

    def logs(bar, vol=0.08):
        """The fast pattern: logs in 16ths, zigzagging up the root's five notes and back, like a saw's teeth."""
        root, scale = LOGS[ROOTS[bar]]
        for i in range(16):
            s = (0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 3, 1)[i]
            put("logs", bar * 4 + i * 0.25, wood(n(root) + scale[s % 5] + 12 * (s // 5), vol * (1.0 if i % 4 == 0 else 0.7), 0.07, 0.5, 3.0), 0.4 if i % 2 else -0.4)

    # The three leads (synth.py's): each plays the note it is given; `d` the note's length in beats.
    def fiddle(b, m, vol=1.0, pan=0.0, bus="lead", d=0.5):
        put(bus, b, x.fiddle(m, d * (0.97 if d >= 0.75 else 0.9), 0.145 * vol), pan)

    def gritty(b, m, vol=1.0, pan=0.0, bus="lead", d=0.5):
        put(bus, b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def square(b, m, vol=1.0, pan=0.0, bus="lead", d=0.5):
        put(bus, b, x.chip(m, d * 0.9, 0.15 * vol), pan)

    def third(m):
        """The note two steps up the key."""
        pc = m % 12
        if pc not in DORIAN:
            return m + 3
        return m + (DORIAN[(DORIAN.index(pc) + 2) % 7] - pc) % 12

    def sing(inst, bus, start, text, vol=1.0, up=0, pan=0.0, harmony=False):
        """A line on one of the leads, `up` semitones from where it is written; `harmony`: each note's third instead."""
        for b, d, m in line(start, text):
            inst(b, (third(m) if harmony else m) + up, vol, pan, bus, d)

    # ---- the bass ----
    def bass(b, m, beats, vol=0.42, slide=0.0):
        """A deep note driven so small speakers hear it, a woody pluck an octave up; `slide`: it arrives from that far."""
        k = x.k(beats)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (slide * np.exp(-t / 0.045) / 12)) / sr
        env = np.minimum(1, t / 0.006) * np.exp(-t / (beats * x.beat_s * 2.0)) * tail(k, 0.02)
        w = np.tanh(2.2 * np.sin(ph)) / np.tanh(2.2) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        mid = 0.45 * np.sin(2 * ph + 1.6 * np.exp(-t / 0.09) * np.sin(2 * ph)) * np.exp(-t / 0.3) + 0.2 * np.sin(4 * ph + 1.2 * np.exp(-t / 0.05) * np.sin(4 * ph)) * np.exp(-t / 0.12)
        put("bass", b, (w + mid) * env * vol)

    def bassline(bar, riff="roll", vol=0.42, parity=None):
        m = n(BASS[ROOTS[bar]])
        for o, d, up, slide in RIFFS[riff][bar % 2 if parity is None else parity]:
            bass(bar * 4 + o, m + (COLOR[ROOTS[bar]] if up == "c" else up), d * 0.92, vol, slide)

    def groove(bar, pat, riff="roll", hats="8", logs_vol=0.08, sanding=False, long=False, taps=True):
        kit(bar, pat, hats)
        bassline(bar, riff)
        if logs_vol:
            logs(bar, logs_vol)
        shop(bar, sanding=sanding, taps=taps, long=long)

    def spin_up(b, beats, drums=False):
        """The table saw spins up under a snare roll and the axe speeding up; its last beat is the cut. `drums`: a
        kick on every beat (then every half) and the bass hammering the root under it, growing."""
        power_saw(b, beats - 1, 55, 380)
        cut(b + beats - 1, 1.0)
        steps = int((beats - 1) * 4)
        for i in range(steps):
            if i >= steps // 2 or i % 2 == 0:
                snare(b + i * 0.25, 0.05 + 0.2 * i / steps, ghost=i < steps // 3)
        t = b
        while t < b + beats - 1 - 1e-6:
            late = t >= b + (beats - 1) / 2
            chop(t, 0.35 + 0.15 * (t - b) / beats)
            if drums:
                kick(t, 0.5)
                bar = int(t // 4)
                for o in (0, 0.5):
                    bass(t + o, n(BASS[ROOTS[bar]]), 0.42, 0.2 + 0.25 * (t - b) / beats)
            t += 0.5 if late else 1.0

    # ======== the woodshop, the same under both tunes ========
    # Bars 1-8: the shop wakes. The axe alone; the hand saw; sandpaper, the hammer and the logs; the table saw.
    for b in (0, 2, 4, 6):
        chop(b, 0.8)
    knock(7.5, 520, 0.22, 0.3)
    for b, v in ((8, 0.8), (10, 0.8), (11.5, 0.45), (12, 0.8), (14, 0.8), (15.5, 0.45)):
        chop(b, v)
    for bar in (2, 3):
        shop(bar, taps=False, vol=1.7)
    for bar in (4, 5):
        shop(bar, sanding=True, vol=1.7)
        logs(bar, 0.06 + 0.02 * (bar - 4))
        chop(bar * 4, 0.8), chop(bar * 4 + 2, 0.6), knock(bar * 4 + 1.5, 420, 0.22, -0.3)
    for bar in (6, 7):
        shop(bar, sanding=True, vol=1.5)
        logs(bar, 0.09 + 0.01 * (bar - 6))
    spin_up(24, 8)
    for i in range(8):
        bass(28 + i * 0.5, n("E1"), 0.42, 0.12 + 0.035 * i)

    # Bars 9-16: the tune's first half over the break.
    chop(32, 0.6), x.crash(32, 0.22)
    for i, pat in enumerate((P1, P2, P1, P3, P1, P2, P1, FILL1)):
        groove(8 + i, pat)
    chop(48, 0.45)

    # Bars 17-24: its second half; sandpaper and 16th hats; a drill; planks tumbling at the end.
    chop(64, 0.5), x.crash(64, 0.18)
    for i, pat in enumerate((P2, P1, P2, P3, P2, P1, P3, FILL2)):
        groove(16 + i, pat, hats="16", sanding=True)
    drill(79, 0.4), drill(79.5, 0.2), drill(79.75, 0.2)
    chop(80, 0.45)
    tumble(94, 8)

    # Bars 25-32: half the pace. Long sliding bass notes, open hats, a floor tom, long saw strokes, the logs quieter.
    chop(96, 0.6), x.crash(96, 0.2)
    for i in range(8):
        bar = 24 + i
        groove(bar, (HALF1, HALF2)[i % 2], riff="half", hats="open", logs_vol=0.05, long=True, taps=False)
        tom(bar * 4 + 1.5, 40, 0.3, -0.3), tom(bar * 4 + 3.5, 45, 0.26, 0.2)
        if i % 2:
            creak(bar * 4 + 2.5, 1.2, 0.14)
    for i, c in enumerate("ttmmffff"):
        tom(126 + i * 0.25, {"t": 50, "m": 45, "f": 40}[c], 0.3 + 0.02 * i, {"t": 0.3, "m": 0.0, "f": -0.3}[c])

    # Bars 33-36: the build. The table saw spins up, the axe and the kick speed up, the logs and hats grow, wood
    # creaks, and the blade bites.
    spin_up(128, 16, drums=True)
    for bar in range(32, 36):
        logs(bar, 0.05 + 0.012 * (bar - 32))
        for i in range(16):
            hat(bar * 4 + i * 0.25, 0.02 + 0.012 * (bar - 32))
    creak(138, 4.5, 0.2)

    # Bars 37-44: a tree comes down; the hardest beat, a driving bass, the axe on every bar.
    timber(144), x.crash(144, 0.26)
    for i, pat in enumerate((P2, P3, P2, P4, P2, P3, P2, FILL1)):
        groove(36 + i, pat, riff="drive", hats="16", logs_vol=0.09, sanding=True)
        chop((36 + i) * 4, 0.42)

    # Bars 45-52: drum and bass alone, the tools trading with them (hammer flurries, the drill, planks); then the
    # toms take over with the logs and long saw strokes.
    x.crash(176, 0.2)
    for i, pat in enumerate((P3, P2, P3, P4)):
        bar = 44 + i
        kit(bar, pat, "16")
        bassline(bar, "solo")
        if i % 2 == 0:
            for j in range(6):
                hammer(bar * 4 + 3 + j / 6, j, 0.1 + 0.02 * j)
            knock(bar * 4 + 1.5, 520, 0.16, -0.4), knock(bar * 4 + 1.75, 390, 0.16, 0.4)
        else:
            drill(bar * 4 + 3, 0.45), drill(bar * 4 + 3.5, 0.2), drill(bar * 4 + 3.75, 0.2)
            tumble(bar * 4 + 1, 4, 0.125, 700)
    for i in range(4):
        bar = 48 + i
        kit(bar, "K.....K...K.....", hats=None)
        kit(bar, "f.ffS.f.f.ffS.mm" if i < 3 else "ffffS.mmttS.SSSS", hats=None)
        bassline(bar, "solo")
        logs(bar, 0.08)
        shop(bar, long=True, taps=i % 2 == 0)
    tumble(210, 8)

    # Bars 53-60: the calm. The kit out: sandpaper, long saw strokes, a soft kick on each bar, long bass notes, a
    # knock now and then. Its last two bars: the table saw again.
    for i in range(8):
        bar = 52 + i
        bassline(bar, "long", 0.3)
        if i < 6:
            kick(bar * 4, 0.3)
            shop(bar, long=True, taps=False, vol=0.8)
            for j in range(8):
                sand(bar * 4 + j * 0.5, 0.45, 0.04 if j % 2 else 0.025)
            knock(bar * 4 + 2.5, 420 if i % 2 else 520, 0.12, 0.4 if i % 2 else -0.4)
    hammer(222.5, 0, 0.12), hammer(223, 2, 0.14), hammer(223.5, 4, 0.16)
    spin_up(232, 8)

    # Bars 61-68: the tune's first half again, in harmony.
    timber(240, 0.45), x.crash(240, 0.22)
    for i, pat in enumerate((P1, P2, P1, P3, P1, P2, P1, P4)):
        groove(60 + i, pat, hats="16" if i >= 4 else "8", sanding=True)
    chop(240, 0.5), chop(256, 0.45)

    # Bars 69-76: the trade. A bar of the break under the tune, then a bar of toms, snare and tools, four times.
    x.crash(272, 0.18)
    for i in range(8):
        bar = 68 + i
        if i % 2 == 0:
            groove(bar, P2, hats="16", sanding=True)
            chop(bar * 4, 0.42)
        else:
            kit(bar, TRADE[i // 2], hats=None)
            bassline(bar, "solo", parity=1)
            logs(bar, 0.08)
            if i in (1, 5):
                for j in range(6):
                    hammer(bar * 4 + 1 + j / 6, j, 0.1 + 0.02 * j)
                drill(bar * 4 + 2.5, 0.4)
            else:
                tumble(bar * 4 + 0.5, 6, 0.125, 800)
                drill(bar * 4 + 2, 0.2), drill(bar * 4 + 2.5, 0.2)

    # Bars 77-84: the tune's second half in harmony over the hardest beat.
    timber(304, 0.45), x.crash(304, 0.24)
    for i, pat in enumerate((P2, P3, P2, P4, P3, P2, P3, FILL2)):
        groove(76 + i, pat, riff="drive", hats="16", logs_vol=0.09, sanding=True)
        chop((76 + i) * 4, 0.42)

    # Bars 85-88: the tune's start; a run down and the planks tumbling; then one last chop and the table saw winding
    # down, two taps and a knock, into bar 1's axe.
    x.crash(336, 0.2)
    groove(84, P1), groove(85, P2)
    kit(86, "K...S...K.K.S.SS", hats="8")
    bassline(86, "roll")
    logs(86, 0.07)
    tumble(346, 12, 0.125, 1000)
    chop(348, 0.6), kick(348, 0.5), bass(348, n("E1"), 3.0, 0.4)
    power_saw(348, 3.6, 380, 45, 0.12, up=False)
    hammer(350.5, 0, 0.14), hammer(351, 2, 0.16), knock(351.5, 420, 0.16, -0.3)

    # ======== the tunes: the fiddle, the gritty synth and the square, all three in both songs ========
    tunes = TUNES[who]
    first, second = "|".join(tunes["tune"].split("|")[:8]), "|".join(tunes["tune"].split("|")[8:])
    last_two = "|".join(tunes["third"].split("|")[6:])
    if who == "sawyer":  # his tunes are written low (E4 to A5)
        sing(fiddle, "lead", 32, tunes["tune"], up=12)  # bars 9-24: the fiddle
        sing(gritty, "lead", 96, tunes["call"][0])  # bars 25-32: the gritty synth calls, low; the fiddle answers, high
        sing(fiddle, "answer", 96, tunes["call"][1], pan=0.3)
        sing(gritty, "lead", 144, tunes["second"])  # bars 37-44, the drop: the gritty synth, the square an octave over it
        sing(square, "answer", 144, tunes["second"], vol=0.5, up=12, pan=0.3)
        sing(fiddle, "lead", 208, tunes["calm"], vol=0.85, up=12)  # bars 53-60: the fiddle alone, long notes
        sing(fiddle, "lead", 240, first, up=12)  # bars 61-68: the fiddle, the square in harmony
        sing(square, "answer", 240, first, vol=0.45, up=12, pan=0.3, harmony=True)
        sing(square, "lead", 272, tunes["third"])  # bars 69-76: the square; the gritty synth joins its last two bars
        sing(gritty, "answer", 296, last_two, vol=0.5, pan=0.3)
        sing(fiddle, "lead", 304, second, up=12)  # bars 77-84: the fiddle, the gritty synth an octave under, the square in harmony
        sing(gritty, "answer", 304, second, vol=0.5, pan=-0.3)
        sing(square, "answer", 304, second, vol=0.4, up=12, pan=0.3, harmony=True)
        sing(fiddle, "lead", 336, tunes["end"], up=12)  # bars 85-87
        sing(gritty, "answer", 336, tunes["end"], vol=0.5, pan=0.3)
    else:  # the beaver's are written high (B4 to B6)
        sing(square, "lead", 32, tunes["tune"])  # bars 9-24: the square, chattering
        sing(square, "lead", 96, tunes["call"][0], up=-12)  # bars 25-32: the square calls; the gritty synth answers, low
        sing(gritty, "answer", 96, tunes["call"][1], pan=0.3)
        sing(fiddle, "lead", 144, tunes["second"])  # bars 37-44, the drop: the fiddle, the gritty synth an octave under
        sing(gritty, "answer", 144, tunes["second"], vol=0.5, up=-12, pan=0.3)
        sing(square, "lead", 208, tunes["calm"], vol=0.8)  # bars 53-60: the square alone, long notes
        sing(square, "lead", 240, first)  # bars 61-68: the square, the fiddle in harmony
        sing(fiddle, "answer", 240, first, vol=0.5, pan=0.3, harmony=True)
        sing(gritty, "lead", 272, tunes["third"], up=-12)  # bars 69-76: the gritty synth; the square joins its last two bars
        sing(square, "answer", 296, last_two, vol=0.5, pan=0.3)
        sing(square, "lead", 304, second)  # bars 77-84: the square, the fiddle in harmony, the gritty synth an octave under
        sing(fiddle, "answer", 304, second, vol=0.5, pan=0.3, harmony=True)
        sing(gritty, "answer", 304, second, vol=0.45, up=-12, pan=-0.3)
        sing(square, "lead", 336, tunes["end"])  # bars 85-87
        sing(gritty, "answer", 336, tunes["end"], vol=0.5, up=-12, pan=0.3)

    # The bass (and, lightly, the logs) ducks under each kick.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.22 * sr)) / (0.07 * sr))
    dip = np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks))
    gain = 1 - np.clip(dip, 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["logs"] *= 0.6 + 0.4 * gain

    levels = {"snare": 1.7, "hats": 2.3, "toms": 0.9, "drum": 1.5, "bass": 0.58, "logs": 1.9, "sawing": 1.15, "taps": 2.2, "fx": 1.2, "lead": 0.85, "answer": 0.85}
    return x.mixdown(levels, lowpass=8500, room=0.12)


def main(out: str) -> None:
    write_wav(out, compose("sawyer"))


if __name__ == "__main__":
    main(sys.argv[1])
