"""Song AJ (Eric, Nov 17): a runaway-train rock theme, a loop of about 2:31 (no boss named yet). His brief: "New song
use this as a guide, feel free to come up with something a bit wild and throw in some dark melody vibes and a
beautiful slowed down piano theme in the middle with some character to it". The guide is his own plan (made with
another assistant, as the others were), "High-Speed Runaway-Train Synth-Metal & Heroic Arcade Rock": this time a
guide, not a script, so its frame is kept and the rest is written here.
Kept from the plan:
  - 162 beats a minute, four in a bar. A heavy rock kit (kicks on 1 and 3 with a 16th's pickup into each, two in the
    chorus; a gated snare on 2 and 4; hats or a ride in 8ths; crashes on the band's hits). A bass in 16ths that never
    stops, the root and its octave (E1 E1 E2 E1), locked to a palm-muted rhythm guitar: the locomotive.
  - Two keys: E minor (the intro, the riff, the verse: Em, C, D, B7) and, a whole step up, F sharp minor and D major
    for the chorus (Dmaj7, E, F#m7, C#m7), then home by B7#9.
  - Its four patches: a palm-muted FM rhythm guitar (an operator fed back on itself as far as it goes, a 70 ms decay,
    16th-note power chords low on the neck); a punchy synth-brass lead with a square wave a third under it; a
    flute-and-bell voice for the pre-chorus's 16ths; an overdriven lead for the chorus (a 45 ms glide between notes,
    a 6 Hz vibrato).
  - Its five sections and their chords, and the riff's notes (E3 G3 A3 Bb3 A3 G3 E3): the band's stabs on Em, D, C,
    B7 with drum breaks between; the riff over the E pedal; the brass's verse (Em, Cmaj7, D, Bm7 to Em, twice, the
    band's hits ending each phrase); the pre-chorus (Cmaj7, D, Bm7, C#7sus4 to C#7); the chorus (twice, the second an
    octave up with string pads and a square wave's 16ths; Bm7 to C#7#9 after it); the breakdown (stabs on D5, C5, B5
    traded with tom and snare fills, a long B7#9, a bar's snare roll, and bar 1).
Written here, and original (none of it is any song's or any game's): every melody (the riff's rhythm and tail, the
verse and the line under it, the pre-chorus's 16ths, the chorus's tune and its second lead), and what he asked for
beyond the plan:
  - "A bit wild": the train is in it. A steam whistle (three pipes: minor over the riff, diminished over the sevenths). The brakes: in bar 56 the
    whole band's tape slows to a stop, pitch and all, over a snare roll that winds down with it. And the way out of
    the piano: the tempo climbs from 81 back to 162 over four bars, the whistle's two toots, chuffs of steam on the
    beat, the chug doubling from 8ths to 16ths.
  - "Dark melody vibes": the riff's flat fifth; the verse's second time ending down a half step onto E (F natural);
    the whistle's chord over the sevenths; the piano's C#7#9; and over the breakdown a slow line on the lead, each
    chord's fifth sinking a half step onto its flat fifth (A to G sharp over D, G to F sharp over C, F sharp to F
    over B).
  - "A beautiful slowed down piano theme in the middle with some character to it": after the brakes, ten bars at half
    the tempo (81). The chorus's tune, at half its speed, on the soft piano: a left hand that rolls in 8ths (root,
    fifth, ninth, tenth: the shape of Eric's own left hand in song_ah.py); grace notes; the second half in octaves
    with a small bell far above and strings coming in under; C#7#9 where the chorus has C#m7.
The plan's 64 bars are 1:35 at this pace and he wants 2:30 to 2:45 (SOUNDS.md), so after the piano the song goes
round its chorus once more (both leads together), the turnaround, and then the plan's breakdown. 90 bars.
  python3 song_aj.py <out.wav>

  bars  1-4    0:00  the band's stabs (Em, D, C, B7), drum breaks between; a run up the B7
  bars  5-12   0:06  the locomotive: the riff over the E pedal
  bars 13-28   0:18  the verse, twice: the brass, a square wave under it
  bars 29-36   0:41  the pre-chorus: the flute-and-bell's 16ths, climbing to C#7
  bars 37-52   0:53  the chorus (F sharp minor), twice: the second an octave up, pads and 16ths under it
  bars 53-56   1:17  Bm7, C#7#9; the brakes
  bars 57-66   1:23  the piano, at half the tempo: the chorus's tune, slowed
  bars 67-70   1:53  the train pulls out: 81 to 162
  bars 71-78   2:01  the chorus once more, two leads
  bars 79-82   2:13  Bm7, C#7#9
  bars 83-90   2:19  the breakdown: stabs and fills on D5, C5, B5; the long B7#9, the roll, and bar 1
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, SLOW, BARS = 162, 81, 90
BEATS = 4 * BARS
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
# The tape's ride: (from beat, to beat, tempo there, tempo by its end, speed there, speed by its end, waver). Bar 56
# is the brakes (the tape slows to a stop, pitch and all); bars 57-66 the piano's half tempo; bars 67-70 pull out.
RIDE = [(0, 220, BPM, BPM, 1.0, 1.0, 0.0), (220, 224, BPM, BPM, 1.0, 0.36, 0.0), (224, 264, SLOW, SLOW, 1.0, 1.0, 0.0),
        (264, 280, SLOW, BPM, 1.0, 1.0, 0.0), (280, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]
TAPE = 150.0  # s of tape: a round length (quick transforms); the tempos give 150.44, so they run 0.3% fast

# A chord: the bass's note, the guitar's root, the brass's stab, the pad's four notes, the square wave's 16ths.
GRID = {
    "Em": ("E1", "E2", "G4 B4 E5", "G3 B3 E4 B4", "E4 G4 B4 E5"), "D": ("D2", "D3", "F#4 A4 D5", "F#3 A3 D4 A4", "D4 F#4 A4 D5"),
    "C": ("C2", "C3", "E4 G4 C5", "G3 C4 E4 G4", "C4 E4 G4 C5"), "B7": ("B1", "B2", "F#4 A4 D#5", "F#3 A3 B3 D#4", "B3 D#4 F#4 A4"),
    "Cmaj7": ("C2", "C3", "E4 G4 B4", "G3 B3 C4 E4", "G4 B4 C5 E5"), "Bm7": ("B1", "B2", "F#4 A4 D5", "A3 B3 D4 F#4", "F#4 A4 B4 D5"),
    "C#7sus4": ("C#2", "C#3", "F#4 G#4 B4", "G#3 B3 C#4 F#4", "G#4 B4 C#5 F#5"), "C#7": ("C#2", "C#3", "F4 G#4 B4", "G#3 B3 C#4 F4", "G#4 B4 C#5 F5"),
    "Dmaj7": ("D2", "D3", "F#4 A4 C#5", "F#3 A3 C#4 D4", "A4 C#5 D5 F#5"), "E": ("E1", "E2", "G#4 B4 E5", "G#3 B3 E4 G#4", "G#4 B4 E5 G#5"),
    "F#m7": ("F#1", "F#2", "A4 C#5 E5", "A3 C#4 E4 F#4", "A4 C#5 E5 F#5"), "C#m7": ("C#2", "C#3", "G#4 B4 E5", "G#3 B3 C#4 E4", "G#4 B4 C#5 E5"),
    "C#7#9": ("C#2", "C#3", "F4 B4 E5", "F3 B3 E4 G#4", "F4 G#4 B4 E5"), "D5": ("D2", "D3", "A4 D5", "", ""), "C5": ("C2", "C3", "G4 C5", "", ""),
    "B5": ("B1", "B2", "F#4 B4", "", ""), "B7#9": ("B1", "B2", "D#4 A4 D5", "", ""),
}
VERSE_CH = "Em Em Cmaj7 Cmaj7 D D Bm7 Em"
CHORUS_CH = "Dmaj7 E F#m7 F#m7 Dmaj7 E C#m7 F#m7"
TURN_CH = "Bm7 Bm7 C#7#9 C#7#9"
CHORDS = (f"Em D C B7  {'Em ' * 8} {VERSE_CH} {VERSE_CH}  Cmaj7 Cmaj7 D D Bm7 Bm7 C#7sus4 C#7  {CHORUS_CH} {CHORUS_CH}  {TURN_CH}  "
          f"{'F#m7 ' * 10} C#7sus4 C#7sus4 C#7 C#7  {CHORUS_CH}  {TURN_CH}  D5 D5 C5 C5 B5 B5 B7#9 B7#9").split()
assert len(CHORDS) == BARS, len(CHORDS)

# ---- the lines. Lengths in beats; .25 is a 16th; a note may cross a barline. ----
# The riff: the plan's notes (E3 G3 A3 Bb3 A3 G3 E3) pushed off the beat, and a tail; its fourth time climbs out.
RIFF = "E3:.75 G3:.75 A3:.5 Bb3:.75 A3:.75 G3:.5 | E3:1.5 D3:.25 E3:.25 G3:.5 E3:.5 B2:.5 D3:.5"
RIFF_OUT = "E3:.75 G3:.75 A3:.5 Bb3:.75 A3:.75 G3:.5 | E3:1.5 G3:.25 A3:.25 B3:.5 D4:.5 E4:1"
# The verse: the brass's tune and the square wave under it (a third or a fourth, by the chord). A beat's rest ends
# three of its four phrases: the band's hits. Its second time climbs, and ends down a half step onto E.
VERSE_1 = (
    "B4:.5 E5:.5 F#5:.5 G5:1 F#5:.5 E5:1 | G5:.75 F#5:.75 E5:.5 B4:2 | C5:.5 E5:.5 G5:.5 B5:1 A5:.5 G5:1 | E5:.75 G5:.75 F#5:.5 E5:1 -:1 | "
    "D5:.5 F#5:.5 A5:.5 B5:1 A5:.5 F#5:1 | A5:.75 G5:.75 F#5:.5 D5:1 E5:.5 F#5:.5 | F#5:1 D5:.5 B4:.5 D5:.5 F#5:.5 B5:1 | G5:1.5 F#5:.5 E5:1 -:1"
)
UNDER_1 = (
    "G4:.5 B4:.5 D5:.5 E5:1 D5:.5 B4:1 | E5:.75 D5:.75 B4:.5 G4:2 | G4:.5 C5:.5 E5:.5 G5:1 F#5:.5 E5:1 | C5:.75 E5:.75 D5:.5 C5:1 -:1 | "
    "A4:.5 D5:.5 F#5:.5 G5:1 F#5:.5 D5:1 | F#5:.75 E5:.75 D5:.5 A4:1 C5:.5 D5:.5 | D5:1 B4:.5 F#4:.5 B4:.5 D5:.5 F#5:1 | E5:1.5 D5:.5 B4:1 -:1"
)
VERSE_2 = (
    "B4:.5 E5:.5 G5:.5 B5:1 A5:.5 G5:1 | B5:.75 A5:.75 G5:.5 E5:2 | E5:.5 G5:.5 B5:.5 C6:1 B5:.5 G5:1 | B5:.75 A5:.75 G5:.5 E5:1 -:1 | "
    "A5:.5 B5:.5 D6:.5 E6:1 D6:.5 B5:1 | D6:.75 B5:.75 A5:.5 F#5:1 A5:.5 B5:.5 | D6:1 B5:.5 F#5:.5 B5:.5 D6:.5 F#6:1 | E6:1.5 D6:.25 B5:.25 G5:.5 F5:.5 E5:1"
)
UNDER_2 = (
    "G4:.5 B4:.5 E5:.5 G5:1 E5:.5 E5:1 | G5:.75 E5:.75 E5:.5 B4:2 | C5:.5 E5:.5 G5:.5 G5:1 G5:.5 E5:1 | G5:.75 E5:.75 E5:.5 C5:1 -:1 | "
    "F#5:.5 G5:.5 B5:.5 C6:1 B5:.5 G5:1 | B5:.75 G5:.75 F#5:.5 D5:1 F#5:.5 G5:.5 | B5:1 F#5:.5 D5:.5 F#5:.5 B5:.5 D6:1 | B5:1.5 B5:.25 G5:.25 E5:.5 D5:.5 B4:1"
)
# The pre-chorus, a bar a line: 16ths that climb in turns (never a plain ladder: the town's lesson), and an answer.
RUNS = (
    "C5 E5 G5 E5 G5 B5 C6 B5 G5 B5 E6 C6 E6 G6 E6 C6", "B5:.75 G5:.75 E5:.5 G5:1 -:1",
    "D5 F#5 A5 F#5 A5 D6 E6 D6 A5 D6 F#6 D6 F#6 A6 F#6 D6", "E6:.75 D6:.75 A5:.5 F#5:1 -:1",
    "B4 D5 F#5 D5 F#5 A5 B5 A5 F#5 B5 D6 B5 D6 F#6 D6 B5", "C#6:.75 B5:.75 F#5:.5 D5:1 -:1",
    "C#5 F#5 G#5 B5 C#6 B5 G#5 B5 C#6 F#6 G#6 F#6 C#6 F#6 G#6 B6", "F5 G#5 B5 C#6 F6 C#6 B5 C#6 F6 G#6 B6 G#6 F6 G#6 B6 G#6",
)
# The chorus: long notes tied over the barlines. As written it is the high one; the first time is an octave under.
CHORUS = "F#5:.5 A5:.5 C#6:3.5 | B5:1 G#5:1 B5:1.5 | A5:2.5 G#5:.5 F#5:1 | C#5:.5 F#5:.5 A5:3 | F#5:.5 A5:.5 D6:3.5 | C#6:1 B5:1 E6:1.5 | E6:2 C#6:1 B5:1 | C#6:1.5 A5:.5 F#5:2"
CHORUS_UNDER = "D5:.5 F#5:.5 A5:3.5 | G#5:1 E5:1 G#5:1.5 | F#5:2.5 E5:.5 C#5:1 | A4:.5 C#5:.5 F#5:3 | D5:.5 F#5:.5 A5:3.5 | G#5:1 G#5:1 B5:1.5 | C#6:2 G#5:1 G#5:1 | A5:1.5 F#5:.5 C#5:2"
# Bm7, C#7#9: the lead's way down, and the long E sharp (the first time into the brakes; the second into the breakdown).
TURN_BRAKES = "D6:2 C#6:1 B5:1 | A5:1.5 B5:.5 D6:2 | F6:7"
TURN_ON = "D6:2 C#6:1 B5:1 | A5:1.5 B5:.5 D6:2 | F6:4 | G#6:2 F6:1 C#6:1"
# The breakdown's line on the lead: each chord's fifth, then down a half step onto its flat fifth.
DREAD = "A5:4 G#5:4 G5:4 F#5:4 F#5:4 F5:4"
# The piano (bars 57-66). Its left hand, a bar a line, eight 8ths; its right: two bars in, then the chorus's tune at
# half its speed, the second half in octaves. "X>Y" is a grace note into Y; "X+Y" two notes together.
LEFT = (
    "F#2 C#3 G#3 A3 F#2 C#3 G#3 A3", "C#2 G#2 B2 F3 C#2 G#2 B2 F3",
    "D2 A2 E3 F#3 D2 A2 E3 F#3", "E2 B2 F#3 G#3 E2 B2 F#3 G#3", "F#2 C#3 E3 A3 F#2 C#3 E3 A3", "F#2 C#3 G#3 A3 C#4 A3 G#3 C#3",
    "D2 A2 E3 F#3 D2 A2 E3 F#3", "E2 B2 F#3 G#3 B3 G#3 F#3 B2", "C#2 G#2 B2 F3 C#2 G#2 E3 F3", "F#2 C#3 G#3 A3 C#4 A3 G#3 F#3",
)
RIGHT = (
    "-:4 | -:2 G#4:.5 B4:.5 C#5:.5 F5:.5 | "
    "F#4:.5 A4:.5 C#5:3 | C#5:.5 B4:1 G#4:1 B4:1.5 | A4:2 B4>A4:.5 G#4:.5 F#4:1 | C#4:.5 F#4:.5 A4:2 C#5:.5 E5:.5 | "
    "F#4+F#5:.5 A4+A5:.5 D5+D6:3 | E6>D5+D6:.5 C#5+C#6:1 B4+B5:1 E5+E6:1.5 | E5+E6:2 C#5+C#6:1 B4+B5:1 | D6>C#5+C#6:1.5 A4+A5:.5 F#4+F#5:2"
)
# The stabs: where they fall in the bar (16ths), and the fills that take the rest of it (s: snare; h, m, l: toms).
HITS_A, HITS_B = (0, 3, 6), (0, 3, 6, 9, 12)
FILLS = ("sshhmmll", "s.sshhml", "hhmmllss", "hmlshmls")
for _line, _beats in ((RIFF, 8), (RIFF_OUT, 8), (VERSE_1, 32), (UNDER_1, 32), (VERSE_2, 32), (UNDER_2, 32), (CHORUS, 32), (CHORUS_UNDER, 32),
                      (TURN_BRAKES, 15), (TURN_ON, 16), (DREAD, 24), (RIGHT.replace("B4>", "").replace("E6>", "").replace("D6>", "").replace("+", ""), 40)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
assert all(len(bar.split()) == 8 for bar in LEFT) and len(LEFT) == 10


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=331, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(109)
    sr = x.sr
    tau = 2 * np.pi
    chord = lambda bar: GRID[CHORDS[bar - 1]]

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def crunch(w, rate=11000, steps=24):
        """A sampled drum as the old console played it: few samples a second, few levels."""
        hold = max(1, int(sr / rate))
        return np.round(np.repeat(w[::hold], hold)[: len(w)] * steps) / steps

    def fed(ph, beta=0.9):
        """A sine operator fed back on itself: it leans toward a sawtooth."""
        y = np.sin(ph)
        for _ in range(6):
            y = np.sin(ph + beta * y)
        return y

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        w = np.tanh(2.0 * np.sin(tau * np.cumsum(52 + 130 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.075)) + 0.35 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.26):
        """Noise and a sampled drum's body, gated: cut off at 120 ms."""
        k = int(0.12 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(190 + 90 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.045)
        put("snare", b, crunch(0.85 * body + 0.9 * hiss(k, 8000, 0.5) * np.exp(-t / 0.075)) * tail(k, 0.008) * vol, 0.05)

    def tom(b, kind, vol=0.3):
        f0, pan = {"h": (185, -0.4), "m": (138, 0.0), "l": (98, 0.4)}[kind]
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(f0 * (1 + 0.5 * np.exp(-t / 0.03))) / sr) * np.exp(-t / 0.075) + 0.25 * hiss(k, 6000, 0.4) * np.exp(-t / 0.006)
        put("toms", b, crunch(w) * tail(k) * vol, pan)

    def hat(b, vol=0.03, ride=False, pan=0.3):
        """A closed hat, or the ride: a longer ring with a ping in it."""
        k = int((0.16 if ride else 0.035) * sr)
        t = np.arange(k) / sr
        w = hiss(k, 13000, 0.85) * np.exp(-t / (0.05 if ride else 0.009))
        if ride:
            w = 0.6 * w + 0.4 * (np.sin(tau * 5230 * t) + 0.6 * np.sin(tau * 7410 * t)) * np.exp(-t / 0.07)
        put("hats", b, w * tail(k, 0.004) * vol, pan)

    def crash(b, vol=0.05):
        k = int(1.3 * sr)
        t = np.arange(k) / sr
        put("crash", b, hiss(k, 14000, 0.8) * np.exp(-t / 0.28) * np.minimum(1, t / 0.002) * tail(k, 0.05) * vol, -0.2)

    def fill(b, text, vol=1.0):
        """A fill from `b`, in 16ths, growing."""
        for j, c in enumerate(text):
            if c == "s":
                snare(b + j / 4, (0.18 + 0.09 * j / max(1, len(text) - 1)) * vol)
            elif c in "hml":
                tom(b + j / 4, c, 0.3 * vol)

    def roll(b, length, soft=0.06, loud=0.28, kicks=True):
        """A snare roll in 16ths over `length` beats, from `soft` to `loud` (or down, if `soft` is the louder)."""
        count = int(round(length * 4))
        for i in range(count):
            snare(b + i / 4, soft + (loud - soft) * (i / max(1, count - 1)) ** 1.4 + (0.03 if i % 4 == 0 else 0))
            if kicks and i % 4 == 0:
                kick(b + i / 4, 0.5)

    def kit(bar, vol=1.0, fills="", double=False, ride=False):
        """A bar of the kit, by 16ths: kicks on 1 and 3, a 16th's pickup into each (`double`: two); the snare on 2
        and 4; hats (or the `ride`) in 8ths. `fills`: 16ths that take the bar's end."""
        b = bar0(bar)
        cut = 16 - len(fills)
        for i in (0, 6, 7, 8, 14, 15) if double else (0, 7, 8, 15):
            if i < cut:
                kick(b + i / 4, 0.5 * vol * (1.0 if i % 8 == 0 else 0.72))
        for i in (4, 12):
            if i < cut:
                snare(b + i / 4, 0.27 * vol)
        for i in range(0, 16, 2):
            if i < cut:
                hat(b + i / 4, (0.03 if i % 4 == 0 else 0.021) * vol * (0.75 if ride else 1), ride=ride)
        fill(b + cut / 4, fills, vol)

    # ---- the band ----
    made = {}

    def axe(ms, secs, mute):
        """Patch 1, the FM rhythm guitar: each string an operator fed back on itself as far as it goes (a buzz saw),
        the strings driven together into a hard clip (a power chord's growl), then the cabinet (dark when the palm
        mutes it). Muted: a 70 ms decay. Kept once made."""
        key = (tuple(ms), round(secs, 3), mute)
        if key not in made:
            k = int(secs * sr)
            t = np.arange(k) / sr
            w = np.zeros(k)
            for j, m in enumerate(ms):
                ph = tau * x.hz(m + (-4, 3, -2)[j % 3] / 100) * t + 1.3 * j
                w += np.sin(ph + 1.7 * fed(ph, 0.97))
            w = np.tanh((2.4 if mute else 3.2) * w / len(ms) * (np.exp(-t / 0.07) if mute else 0.3 + 0.7 * np.exp(-t / 0.6)))
            f = np.fft.rfftfreq(k, 1 / sr)
            cab = 1 / np.sqrt(1 + (f / (1900 if mute else 5000)) ** 4) * (f / 130) / np.sqrt(1 + (f / 130) ** 2) * (1 + 0.8 * np.exp(-(((f - 900) / 500) ** 2)))
            made[key] = np.fft.irfft(np.fft.rfft(w) * cab, n=k) * np.minimum(1, t / 0.001) * tail(k, 0.006)
        return made[key]

    def chug(bar, vol=1.0, eighths=False, upto=16):
        """A bar of the palm-muted guitar's 16ths (the root and its fifth), harder on the beat and its "and"."""
        root = n(chord(bar)[1])
        for i in range(0, upto, 2 if eighths else 1):
            b = bar0(bar) + i / 4
            at(b, 0.25)
            put("gtr", b, axe((root, root + 7), 0.085, True) * 0.16 * vol * (1.0 if i % 4 == 0 else 0.85 if i % 2 == 0 else 0.7), -0.25)

    def pick(b, m, vol=0.3, long=0.25):
        """The bass's note: picked, an FM pluck with a metallic front."""
        at(b, long)
        k = x.k(long)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = 0.6 * np.sin(ph + (3.4 * np.exp(-t / 0.06) + 1.0) * np.sin(ph)) * (0.3 + 0.7 * np.exp(-t / 0.09)) + 0.5 * np.sin(2 * ph + 1.6 * np.sin(ph)) * (0.25 + 0.75 * np.exp(-t / 0.08))
        put("bass", b, (w + 0.4 * np.sin(2 * ph + 2.5 * np.sin(3 * ph)) * np.exp(-t / 0.008)) * np.minimum(1, t / 0.001) * tail(k, 0.01) * vol)

    def rumble(bar, vol=1.0, eighths=False, upto=16):
        """A bar of the bass's 16ths: the root, the root, its octave, the root (E1 E1 E2 E1)."""
        low = n(chord(bar)[0])
        for i in range(0, upto, 2 if eighths else 1):
            pick(bar0(bar) + i / 4, low + (12 if i % 4 == 2 else 0), (0.3 if i % 4 == 0 else 0.23) * vol)

    def train(bar, vol=1.0, fills="", double=False, ride=False):
        """A bar of the locomotive: the kit, the bass and the palm-muted guitar."""
        cut = 16 - len(fills)
        kit(bar, vol, fills, double, ride), rumble(bar, vol, upto=cut), chug(bar, vol, upto=cut)

    def horn(m, d, vol, vib=0.0, edge=1.0, players=((-7, 0.5), (0, 0.0), (6, -0.4))):
        """Patch 2's note, the synth-brass: FM (a fed-back pair and a 1:2 pair), three players a hair apart starting
        together; a 5 ms attack, brightest at the front, a 60 ms release after its `d` beats."""
        k = x.k(d) + int(0.06 * sr)
        i = np.arange(k)
        t = i / sr
        amp = np.minimum(1, t / 0.005) * (0.8 + 0.2 * np.exp(-t / 0.06)) * np.clip((k - i) / (0.06 * sr), 0, 1)
        f0 = x.hz(m)
        depth = edge * float(np.clip((523.25 / f0) ** 0.5, 0.7, 1.15)) * (1 + 0.25 * np.exp(-t / 0.07))
        w = np.zeros(k)
        for c, ph0 in players:
            f = x.hz(m + c / 100) * (1 + vib * np.sin(tau * 6 * t) * np.clip((t - 0.18) / 0.2, 0, 1))
            ph = tau * np.cumsum(f) / sr + ph0
            w += 0.6 * np.sin(ph + 2.0 * depth * fed(ph)) + 0.4 * np.sin(ph + 1.1 * depth * np.sin(2 * ph))
        return w / len(players) * amp * vol

    def brass(start, text, vol=1.0, pan=0.0, shift=0):
        for b, d, m in notes(start, text):
            at(b, d)
            put("brass", b, horn(m + shift, max(0.1, d - 0.11), 0.2 * vol, vib=0.006 if d >= 2 else 0.0, edge=1.12), pan)

    def square(start, text, vol=1.0, pan=0.25):
        """The square wave under the brass, each note cut a little short."""
        for b, d, m in notes(start, text):
            at(b, d)
            put("square", b, x.pulse(m, min(0.7 * d, 1.2), 0.5, 0.05 * vol, attack=0.002, decay=0.06, sustain=0.7, release=0.012), pan)

    def slam(b, name, long=0.4, vol=1.0, hard=True):
        """The whole band's hit on a chord: the guitar's open power chord, the brass's stab, the bass, the kick (`hard`:
        the snare and a crash too)."""
        low, root, stab, _, _ = GRID[name]
        at(b, long)
        secs = x.k(long) / sr
        put("gtr", b, axe((n(root), n(root) + 7, n(root) + 12), secs + 0.05, False) * 0.2 * vol, -0.25)
        for j, m in enumerate(n(c) for c in stab.split()):
            put("brass", b, horn(m, long * 0.8, 0.12 * vol, edge=1.1), -0.3 + 0.3 * j)
        pick(b, n(low), 0.34 * vol, long)
        kick(b, 0.5 * vol)
        if hard:
            snare(b, 0.24 * vol), crash(b, 0.045 * vol)

    def chime(b, m, d, vol=0.05, pan=0.2):
        """Patch 3's note, the flute and bell together: a bell's FM front (its overtone three times the note) on a
        flute's held tone; a fast attack."""
        at(b, d)
        k = x.k(d) + int(0.1 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = 0.7 * np.sin(ph + 0.3 * np.sin(ph)) * (0.6 + 0.4 * np.exp(-t / 0.08)) + 0.6 * np.sin(ph + 1.7 * np.exp(-t / 0.05) * np.sin(3 * ph)) * np.exp(-t / 0.16)
        put("flute", b, w * np.minimum(1, t / 0.004) * tail(k, 0.1) * vol, pan)

    def soar(start, text, vol=1.0, pan=0.0, bus="lead", shift=0, knee=1900.0):
        """Patch 4, the overdriven lead: it glides 45 ms into a note from the one before, a 6 Hz vibrato once held."""
        last = None
        for b, d, m in notes(start, text):
            m += shift
            at(b, d)
            glide = last[0] - m if last and abs(b - last[1]) < 0.05 else 0
            put(bus, b, x.drive(m, d * 0.98, 0.07 * vol, vib=0.007 if d >= 1 else 0.0, vib_hz=6.0, attack=0.015, release=0.04, knee=knee, glide=glide, glide_s=0.015), pan)
            last = (m, b + d)

    def pad(bar, vol=0.018):
        """A bar of the string pad."""
        at(bar0(bar), 4)
        for j, m in enumerate(n(c) for c in chord(bar)[3].split()):
            put("pad", bar0(bar), x.strings(m, 4, vol, attack=0.12, release=0.25), (-0.5, -0.15, 0.15, 0.5)[j])

    def arp(bar, vol=1.0):
        """A bar of the square wave's 16ths: up the chord's four notes and down, from side to side."""
        ms = [n(c) for c in chord(bar)[4].split()]
        for i in range(16):
            b = bar0(bar) + i / 4
            at(b, 0.25)
            put("square", b, x.pulse(ms[(0, 1, 2, 3, 2, 1)[i % 6]], 0.19, 0.5, 0.03 * vol, attack=0.002, decay=0.04, sustain=0.6, release=0.01), 0.4 if i % 2 else -0.4)

    # ---- the train ----
    def whistle(b, d, vol=0.045, names="D#5 F#5 A5", pan=0.15):
        """The steam whistle: three pipes, a diminished chord; it slides up into its note and sags as the steam goes."""
        at(b, d)
        k = x.k(d)
        t = np.arange(k) / sr
        u = t / t[-1]
        w = np.zeros(k)
        for j, m in enumerate(n(c) for c in names.split()):
            f = x.hz(m) * 2 ** ((-0.7 * np.exp(-t / 0.05) - 0.6 * np.clip((u - 0.8) / 0.2, 0, 1) ** 2) / 12) * (1 + 0.004 * np.sin(tau * 6.5 * t + j))
            ph = tau * np.cumsum(f) / sr
            w += np.sin(ph) + 0.5 * np.sin(2 * ph + 1) + 0.33 * np.sin(3 * ph + 2) + 0.15 * np.sin(4 * ph)
        put("fx", b, w / 3 * np.minimum(1, t / 0.04) * tail(k, 0.12) * (1 + 0.08 * np.sin(tau * 11 * t)) * vol, pan)

    def chuff(b, vol=0.03, secs=0.11):
        """A puff of steam."""
        k = int(secs * sr)
        t = np.arange(k) / sr
        put("fx", b, hiss(k, 6000, 0.3) * np.sin(np.pi * np.minimum(1, t / secs)) ** 0.7 * np.exp(-t / 0.05) * vol, -0.1)

    # ---- the piano ----
    def felt(b, m, vol, pan, ring=1.2):
        w = x.struck("felt", m)
        put("piano", b, w * np.exp(-np.arange(len(w)) / sr / ring) * vol, pan)

    def glass(b, m, vol=0.02, pan=0.35):
        """A small bell far above the piano: its overtones the note's own harmonics."""
        k = int(1.6 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("bell", b, np.sin(ph + 1.2 * np.exp(-t / 0.2) * np.sin(4 * ph)) * np.exp(-t / 0.45) * np.minimum(1, t / 0.002) * tail(k, 0.2) * vol, pan)

    def piano(first):
        """Ten bars at half the tempo: the left hand's rolling 8ths, the right hand's tune (graces, octaves), the bell
        over the octaves; steam settling at its start, strings under its second half."""
        for j, steps in enumerate(LEFT):
            for i, name in enumerate(steps.split()):
                felt(bar0(first + j) + i / 2, n(name), 0.2 * (1.0 if i % 4 == 0 else 0.82), -0.15, 0.9)
        t = float(bar0(first))
        for tok in RIGHT.replace("|", " ").split():
            names, _, d = tok.partition(":")
            d = float(d)
            if names != "-":
                *graces, main = names.split(">")
                for g in graces:
                    felt(t - 0.12, n(g), 0.12, 0.2)
                pair = [n(c) for c in main.split("+")]
                for m in pair:
                    felt(t, m, 0.3 * (0.72 if len(pair) > 1 and m == max(pair) else 1.0) * (1.0 if d >= 1 else 0.85), 0.2)
                if len(pair) > 1 and d >= 1:
                    glass(t, max(pair) + 12)
            t += d
        # (Strings under its second half; no steam under the piano itself: a steady noise drowns a sparse solo.)
        for j, name in enumerate(("Dmaj7", "E", "C#7#9", "F#m7")):
            at(bar0(first + 6 + j), 4)
            for i, m in enumerate(n(c) for c in GRID[name][3].split()):
                put("pad", bar0(first + 6 + j), x.strings(m, 4, 0.012 + 0.002 * j, attack=0.5, release=0.5), (-0.5, -0.15, 0.15, 0.5)[i])

    # ---- the sections ----
    def stabs(bar, name, hits, text, vol=1.0):
        """A bar of the band's stabs on a chord, and the drum break that takes the rest of it."""
        for j, i in enumerate(hits):
            slam(bar0(bar) + i / 4, name, 0.4, vol, hard=j == 0)
            if j:
                snare(bar0(bar) + i / 4, 0.22 * vol)
        fill(bar0(bar) + 4 - len(text) / 4, text, vol)

    def intro(first):
        for j, name in enumerate(("Em", "D", "C")):
            stabs(first + j, name, HITS_A, FILLS[j])
        # Bar 4: B7, then the brass and the guitar run up it in 16ths over a roll.
        b = bar0(first + 3)
        for j, i in enumerate(HITS_A):
            slam(b + i / 4, "B7", 0.4, hard=j == 0)
        for i, name in enumerate("B3 D#4 F#4 A4 B4 D#5 F#5 A5".split()):
            at(b + 2 + i / 4, 0.25)
            put("brass", b + 2 + i / 4, horn(n(name), 0.16, 0.17))
            put("gtr", b + 2 + i / 4, axe((n(name) - 12,), 0.09, True) * 0.2, -0.25)
        roll(b + 2, 2, 0.1, 0.28)

    def riff(first):
        """Eight bars: the locomotive on the E pedal, the riff on the overdriven lead, low; from its third time the
        brass an octave over it; the whistle as it ends."""
        for j in range(8):
            train(first + j, fills=FILLS[1] if j == 7 else "sshm" if j == 3 else "")
        crash(bar0(first), 0.06)
        for j in range(4):
            text = RIFF_OUT if j == 3 else RIFF
            soar(bar0(first + 2 * j), text, 1.0, knee=1100.0)
            if j >= 2:
                brass(bar0(first + 2 * j), text, 0.55, 0.2, 12)
        whistle(bar0(first + 6), 6, 0.035, "B4 E5 G5")

    def verse(first, tune, under):
        """Eight bars: the brass's tune, the square wave under it; the band's two hits ending each phrase."""
        for j in range(8):
            bar = first + j
            if j % 2 == 1:
                train(bar, fills="....")
                for i in (12, 14):
                    slam(bar0(bar) + i / 4, CHORDS[bar - 1], 0.4, hard=i == 12)
                    snare(bar0(bar) + i / 4, 0.24)
            else:
                train(bar)
        crash(bar0(first), 0.05)
        brass(bar0(first), tune), square(bar0(first), under)

    def pre(first):
        """Eight bars: the flute-and-bell's 16ths and its answers; the guitar's chords held open under them, the kit
        on the ride; the last bar's roll."""
        for j in range(8):
            bar = first + j
            last = j == 7
            if not last:
                kit(bar, 0.95, ride=True)
            rumble(bar, 0.95)
            root = n(chord(bar)[1])
            at(bar0(bar), 4)
            put("gtr", bar0(bar), axe((root, root + 7, root + 12), x.k(4) / sr, False) * 0.12, -0.25)
            if j % 2 == 0 or j == 7:
                for i, name in enumerate(RUNS[j].split()):
                    chime(bar0(bar) + i / 4, n(name), 0.22, 0.05 * (0.85 + 0.3 * i / 15), 0.3 * np.sin(0.8 * i))
            else:
                for b, d, m in notes(bar0(bar), RUNS[j]):
                    chime(b, m, d * 0.9, 0.06)
                for i in (12, 14):
                    slam(bar0(bar) + i / 4, CHORDS[bar - 1], 0.4, 0.8, hard=False)
        crash(bar0(first), 0.05)
        roll(bar0(first + 7), 4, 0.07, 0.28)

    def chorus(first, high=False, two=False):
        """Eight bars of the chorus over the locomotive at full steam (two kicks into each beat, the ride). The first
        time the lead an octave under; `high`: as written, with the pads and the square wave's 16ths; `two`: the
        second lead a third or a sixth under it."""
        for j in range(8):
            bar = first + j
            train(bar, 1.05, fills="sshm" if j == 3 else FILLS[3] if j == 7 else "", double=True, ride=True)
            if high:
                pad(bar), arp(bar)
        crash(bar0(first), 0.065)
        soar(bar0(first), CHORUS, 1.75 if high else 1.4, 0.0, "lead", 0 if high else -12)
        if two:
            soar(bar0(first), CHORUS_UNDER, 1.0, -0.3, "lead2")

    def turn(first, brakes):
        """Bm7, Bm7, C#7#9, C#7#9: the lead's way down and its long E sharp. `brakes`: the last bar is one held chord
        and a roll winding down, as the tape slows to a stop (the RIDE)."""
        for j in range(4):
            bar = first + j
            if brakes and j == 3:
                slam(bar0(bar), "C#7#9", 3.0, 1.1)
                whistle(bar0(bar), 2.8, 0.04, "F5 G#5 B5")
                roll(bar0(bar) + 0.25, 2.75, 0.24, 0.05, kicks=False)
            else:
                train(bar, 1.05, fills="sshhmmll" if j == 3 else "", double=True, ride=True)
                pad(bar)
        crash(bar0(first), 0.05), crash(bar0(first + 2), 0.06)
        soar(bar0(first), TURN_BRAKES if brakes else TURN_ON, 1.75)

    def pull_out(first):
        """Four bars, the tempo climbing from 81 to 162 (the RIDE): the whistle's two toots; a chuff of steam on each
        beat; the bass and the muted guitar in 8ths, then 16ths; the kick on the beat; the flute-and-bell's 16ths
        and the snare's roll in the last two bars."""
        for j in range(4):
            bar = first + j
            b = bar0(bar)
            rumble(bar, 0.7 + 0.1 * j, eighths=j == 0), chug(bar, 0.6 + 0.13 * j, eighths=j == 0)
            for i in range(4):
                kick(b + i, 0.42 + 0.03 * j), chuff(b + i, 0.03)
                if j >= 1:
                    hat(b + i + 0.5, 0.025)
            if j >= 2:
                for i, name in enumerate(RUNS[4 + j].split()):
                    chime(b + i / 4, n(name), 0.22, 0.045 * (0.85 + 0.3 * i / 15), 0.3 * np.sin(0.8 * i))
        whistle(bar0(first), 0.6, 0.04, "F5 G#5 B5"), whistle(bar0(first) + 1, 1.6, 0.04, "F5 G#5 B5")
        roll(bar0(first + 2), 8, 0.05, 0.28, kicks=False)

    def breakdown(first):
        """Eight bars: stabs on D5, C5 and B5 traded with tom and snare fills, the lead's slow line over them; the long
        B7#9 with the whistle over it; a bar's snare roll, and bar 1."""
        for j, name in enumerate(("D5", "C5", "B5")):
            stabs(first + 2 * j, name, HITS_A, FILLS[(j + 1) % 4], 1.05)
            stabs(first + 2 * j + 1, name, HITS_B, "ss", 1.05)
        soar(bar0(first), DREAD, 1.5)
        b = bar0(first + 6)
        slam(b, "B7#9", 7.5, 1.15)
        crash(b, 0.07)
        whistle(b + 0.5, 6.5, 0.04)
        for i in (0, 3, 6, 8, 11, 14):
            tom(b + i / 4, "l", 0.3), kick(b + i / 4, 0.45)
        roll(b + 4, 4, 0.06, 0.3)

    intro(1), riff(5)
    verse(13, VERSE_1, UNDER_1), verse(21, VERSE_2, UNDER_2)
    pre(29)
    chorus(37), chorus(45, high=True)
    turn(53, brakes=True)
    # The stop: steam let go, a far whistle; then the piano.
    k = int(1.6 * sr)
    put("fx", bar0(57), hiss(k, 5000, 0.3) * np.exp(-np.arange(k) / sr / 0.45) * np.minimum(1, np.arange(k) / (0.03 * sr)) * 0.025, -0.1)
    whistle(bar0(57) + 2, 3, 0.012, "C#5 F#5 A5", -0.4)
    piano(57)
    pull_out(67)
    chorus(71, high=True, two=True)
    turn(79, brakes=False)
    breakdown(83)

    # A hall for the leads, the brass, the flute, the pads, the piano and the whistle; none for the kit, the bass or
    # the guitar.
    def room(name, secs=1.2, wet=0.15):
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
    x.echo("lead", 0.75, 0.12, 0.05), x.echo("lead2", 0.75, 0.12, 0.05), x.echo("flute", 0.75, 0.16, 0.07)
    for name, secs, wet in (("lead", 1.3, 0.16), ("lead2", 1.3, 0.16), ("brass", 1.0, 0.13), ("square", 1.0, 0.12), ("flute", 1.5, 0.25), ("pad", 2.0, 0.35),
                            ("piano", 2.0, 0.3), ("bell", 2.2, 0.4), ("fx", 2.0, 0.35)):
        room(name, secs, wet)
    levels = {"lead": 1.0, "lead2": 1.0, "brass": 1.8, "square": 1.25, "flute": 2.2, "pad": 2.2, "piano": 1.2, "bell": 3.0, "fx": 1.6, "gtr": 1.0, "bass": 0.7,
              "kick": 0.5, "snare": 1.0, "toms": 1.0, "hats": 5.2, "crash": 1.8}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.03))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
