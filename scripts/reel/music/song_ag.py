"""Song AG (Eric, Nov 16): a new boss's theme, a loop of 2:36. "New boss we're working on. Here's the instructions for
the song. Same thing, 2 minutes, 30 seconds, 2 minutes, 45 seconds. And again, [as] his last one, stick to the script
that I'm giving you here to actually create it." The script is his own plan (made with another assistant, as Babur's
was: song_af.py), "High-Speed Cyberspace Breakbeat & Jazz-Fusion", and it is his to give, so this is the plan, part
for part:
  - 154 beats a minute, four in a bar. A breakbeat: the kick on 1 and the "and" of 2, the snare on 2 and 4 with soft
    16ths between, closed and open hats in 16ths. A bass in 16ths that never stops, jumping the octave (E1 E2 E1 E2).
  - Its three key centers: E minor (the opening and the main tune), D Dorian a whole step down (the organ's part:
    Dm9, G13), and E flat minor (the climax: Ebm, Bmaj7, Db, Bb7), which turns back to E minor.
  - Its five patches: a data stream (a narrow 12.5% pulse in 32nds, sweeping up and down); a cyber-saw lead (three
    sawtooths a hair apart, no attack, a 40 ms glide on its leaps, a 6 Hz vibrato on held notes); a drawbar organ (its
    first three harmonics strong, a click on each key); a crystalline bell (held ninth chords and 16ths); and the
    octave-bounce FM bass (80 ms, a metallic front).
  - Its five sections, and the chords and notes it names: four bars of the data stream and the lead's dive; the groove
    on an E pedal with Em9 and Dmaj7 and the bell's 16ths; the lead's tune over Em7, Dmaj7, Cmaj7, B7sus4 to B7#9
    (rising E5 F#5 G5 B5, and down the E harmonic minor scale over the B7); the organ over Dm9, G13, Cmaj7, A7#5; the
    bell over Bm9 and F#m7 with only a hi-hat, and a bar's snare roll; the climax over Ebm7, Bmaj7, Db, Bbm7 to Bb7,
    two leads in thirds and sixths, and Bb7 to B7 to turn home.
Its 64 bars are 1:40 at this pace, and he wants 2:30 to 2:45 (SOUNDS.md: a shorter plan is made longer out of its own
sections). So the plan is played through as written (bars 1-64), and then, where it would loop, it goes round its
sections once more, shorter and fuller, before it does: the tune once (the second lead and the data stream with it),
the organ's second solo, four bars of the bell and the roll, and the climax twice. 100 bars, 155.8 s.
What the plan leaves to whoever builds it is written here, inside its rules, and is original (none of it is any
song's or any game's): the lead's tune past its first four notes, the organ's chords' rhythm and its solos, the bell's
figures, the climax's anthem and the line under it.
(The bass's low notes are kept at E1 or above: D, C and B are played an octave over where a plain step down would put
them, where a speaker can still sound them.)
  python3 song_ag.py <out.wav>

  bars   1-4    0:00  boot-up: the data stream sweeping from side to side, the lead's dive
  bars   5-12   0:06  the groove: the breakbeat, the bouncing bass on E, pads (Em9, Dmaj7), the bell's 16ths
  bars  13-28   0:19  the tune: the cyber-saw lead, twice
  bars  29-40   0:44  the organ (D Dorian): its chords cut short, then its solo
  bars  41-48   1:02  the bell alone over a hi-hat (B minor); a bar's snare roll
  bars  49-64   1:15  the climax (E flat minor): the anthem, two leads, fills, the data stream behind
  bars  65-72   1:40  round again: the tune once, the second lead and the data stream with it
  bars  73-80   1:52  the organ's second solo
  bars  81-84   2:05  the bell, and the roll
  bars  85-100  2:11  the climax, twice; Bb7 to B7, and bar 1
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 154, 100
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 155.8 s
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the pads' and the organ's four notes, and its notes by name (the data stream's and the bell's).
GRID = {
    "Em9": ("G3 B3 D4 F#4", "E G B D F#"), "Em7": ("G3 B3 D4 E4", "E G B D"), "Dmaj7": ("F#3 A3 C#4 D4", "D F# A C#"),
    "Cmaj7": ("E3 G3 B3 C4", "C E G B"), "B7sus4": ("A3 B3 E4 F#4", "B E F# A"), "B7#9": ("A3 D#4 F#4 D5", "B D# F# A"),
    "Dm9": ("F3 A3 C4 E4", "D F A C E"), "G13": ("F3 A3 B3 E4", "G B D F E"), "A7#5": ("G3 C#4 F4 A4", "A C# F G"),
    "Bm9": ("D4 F#4 A4 C#5", "B D F# A C#"), "F#m7": ("E4 F#4 A4 C#5", "F# A C# E"),
    "Ebm7": ("Gb3 Bb3 Db4 Eb4", "Eb Gb Bb Db"), "Bmaj7": ("F#3 A#3 B3 D#4", "B D# F# A#"), "Db": ("F3 Ab3 Db4 F4", "Db F Ab"),
    "Bbm7": ("F3 Ab3 Bb3 Db4", "Bb Db F Ab"), "Bb7": ("F3 Ab3 Bb3 D4", "Bb D F Ab"), "B7": ("F#3 A3 B3 D#4", "B D# F# A"),
}
HOOK = "Em7 Em7 Dmaj7 Dmaj7 Cmaj7 Cmaj7 B7sus4 B7#9"
VAMP = "Dm9 Dm9 G13 G13 Cmaj7 Cmaj7 A7#5 A7#5"
PEAK = "Ebm7 Ebm7 Bmaj7 Bmaj7 Db Db Bbm7"
CHORDS = (f"Em9 Em9 Em9 Em9  Em9 Em9 Dmaj7 Dmaj7 Em9 Em9 Dmaj7 Dmaj7  {HOOK} {HOOK}  {VAMP} Dm9 Dm9 A7#5 A7#5  Bm9 Bm9 F#m7 F#m7 Bm9 Bm9 F#m7 F#m7  "
          f"{PEAK} Bb7 {PEAK} Bb7,B7  {HOOK}  {VAMP}  Bm9 Bm9 F#m7 F#m7  {PEAK} Bb7 {PEAK} Bb7,B7").split()
assert len(CHORDS) == BARS, len(CHORDS)
# The organ's part's bass: off the beat, with air (the 16th, half steps over the root).
COOL = ((0, 0), (3, 12), (6, 0), (8, 7), (10, 12), (11, 0), (14, 10))
STABS = ((0, 3, 10), (2, 6, 11, 14))  # where the organ's short chords fall (16ths), two bars about

# ---- the lines. Lengths in beats; .25 is a 16th. ----
# The lead's tune: the plan's rise (E5 F#5 G5 B5) pushed off the beat; an answer; the same shape on each chord; and
# over the B7, down the E harmonic minor scale. Its second time ends by climbing the B7 again.
RUN = "B5:.25 A5:.25 G5:.25 F#5:.25 E5:.25 D#5:.25 C5:.25 B4:.25"
TUNE_HEAD = (
    "E5:.75 F#5:.75 G5:.5 B5:2 | -:.5 B5:.5 A5:.5 G5:.5 A5:1 F#5:1 | F#5:.75 A5:.75 C#6:.5 D6:2 | -:.5 C#6:.5 A5:.5 F#5:.5 E5:1 F#5:1 | "
    "E5:.75 G5:.75 B5:.5 C6:1.5 B5:.5 | G5:1 E5:.5 G5:.5 B5:2 | B5:1.5 A5:.5 F#5:1 E5:1 | "
)
TUNE_1 = TUNE_HEAD + RUN + " A4:.25 G4:.25 F#4:.25 E4:.25 D#4:1"
TUNE_2 = TUNE_HEAD + RUN + " D#5:.5 F#5:.5 B5:1"
# The second lead under it, the round-again time: a third or a sixth below.
TUNE_UNDER = (
    "B4:.75 D5:.75 E5:.5 G5:2 | -:.5 G5:.5 F#5:.5 E5:.5 F#5:1 D5:1 | D5:.75 F#5:.75 A5:.5 A5:2 | -:.5 A5:.5 F#5:.5 D5:.5 C#5:1 D5:1 | "
    "C5:.75 E5:.75 G5:.5 G5:1.5 G5:.5 | E5:1 C5:.5 E5:.5 G5:2 | F#5:1.5 F#5:.5 E5:1 B4:1 | -:2 B4:.5 D#5:.5 F#5:1"
)
# The bell's 16ths in the groove: a bar of each, twice (Em9, Em9, Dmaj7, Dmaj7).
SPARKLE = ("E5 B5 F#5 G5 D6 B5 G5 F#5 E5 B5 G5 D6 F#6 D6 B5 G5", "F#5 B5 G5 E5 D6 B5 F#5 G5 B5 D6 E6 D6 B5 G5 F#5 D5",
           "D5 A5 F#5 C#6 A5 F#5 E5 F#5 D5 A5 C#6 E6 C#6 A5 F#5 E5", "F#5 A5 C#6 D6 C#6 A5 F#5 E5 D5 F#5 A5 C#6 E6 C#6 A5 F#5")
# The organ: its words between the first chords; its first solo (over Cmaj7, A7#5, Dm9, A7#5: two bars each); its
# second (over the whole vamp). D Dorian, the flat fifth for a blue note, 16ths with air in them.
ORGAN_SAYS = "-:4 | -:2 A5:.25 C6:.25 D6:.5 C6:.5 A5:.5 | -:4 | -:2 B5:.25 D6:.25 E6:.5 D6:.5 B5:.5"
SOLO_1 = (
    "-:.5 E5:.25 G5:.25 B5:.25 C6:.25 B5:.25 G5:.25 A5:.5 G5:.25 E5:.25 D5:.5 E5:.5 | G5:.25 A5:.25 B5:.25 D6:.25 E6:.75 D6:.25 B5:.25 A5:.25 G5:.5 -:1 | "
    "C#5:.25 E5:.25 F5:.25 G5:.25 A5:.5 G5:.25 F5:.25 C#5:.5 A4:.5 -:1 | G5:.25 F5:.25 C#5:.25 A4:.25 G4:.25 A4:.25 C#5:.25 F5:.25 A5:1 -:1 | "
    "D5:.25 F5:.25 A5:.25 C6:.25 E6:.5 D6:.25 C6:.25 A5:.25 Ab5:.25 G5:.25 F5:.25 D5:.5 -:.5 | F5:.25 G5:.25 Ab5:.25 A5:.25 C6:.5 A5:.25 G5:.25 F5:.25 D5:.25 C5:.25 D5:.25 F5:1 | "
    "A5:.5 G5:.25 F5:.25 C#5:.5 E5:.25 F5:.25 G5:.5 A5:.5 C#6:1 | C#6:.25 A5:.25 G5:.25 F5:.25 C#5:.25 A4:.25 G4:.25 F4:.25 A4:2"
)
SOLO_2 = (
    "-:.25 A5:.25 C6:.25 D6:.25 F6:.5 D6:.25 C6:.25 A5:.5 G5:.25 F5:.25 D5:1 | E5:.25 F5:.25 G5:.25 A5:.25 C6:.25 D6:.25 E6:.5 D6:.5 C6:.5 A5:1 | "
    "B5:.25 D6:.25 E6:.25 F6:.25 E6:.5 D6:.25 B5:.25 G5:.5 F5:.25 E5:.25 D5:.5 -:.5 | F5:.25 G5:.25 B5:.25 D6:.25 F6:1 E6:.5 D6:.5 B5:1 | "
    "C6:.25 B5:.25 G5:.25 E5:.25 D5:.25 E5:.25 G5:.25 B5:.25 C6:.5 E6:.5 D6:1 | B5:.5 G5:.25 A5:.25 B5:.25 C6:.25 D6:.5 E6:1 -:1 | "
    "F6:.5 C#6:.25 A5:.25 G5:.5 F5:.25 C#5:.25 A4:.5 C#5:.5 F5:1 | G5:.25 A5:.25 C#6:.25 F6:.25 G6:1.5 -:1.5"
)
# The bell alone: floating 8ths, a bar of each (Bm9, Bm9, F#m7, F#m7).
FLOAT = ("B3 F#4 C#5 D5 A5 F#5 C#5 A4", "B3 F#4 D5 C#5 F#5 A5 C#6 A5", "F#3 C#4 E4 A4 C#5 E5 A5 E5", "F#3 C#4 A4 E5 C#5 A4 E4 C#4")
# The climax: the anthem, the line a third or a sixth under it, and the last bar that turns home (Bb7 to B7).
ANTHEM_HEAD = (
    "Bb5:1.5 Gb5:.5 Ab5:.5 Bb5:.5 Eb6:1 | Db6:1 Bb5:.5 Ab5:.5 Gb5:1 Bb5:1 | Bb5:1.5 Gb5:.5 Eb5:.5 Gb5:.5 Bb5:1 | Ab5:1 Gb5:.5 Eb5:.5 Db5:.5 Eb5:.5 Gb5:1 | "
    "Ab5:1.5 F5:.5 Ab5:.5 Db6:.5 F6:1 | Eb6:1 Db6:.5 Ab5:.5 F5:1 Ab5:1 | F5:.5 Bb5:.5 Db6:1 F6:1.5 Db6:.5 | "
)
UNDER_HEAD = (
    "Gb5:1.5 Eb5:.5 F5:.5 Gb5:.5 Bb5:1 | Bb5:1 Gb5:.5 F5:.5 Eb5:1 Gb5:1 | Gb5:1.5 Eb5:.5 B4:.5 Eb5:.5 Gb5:1 | F5:1 Eb5:.5 B4:.5 Bb4:.5 B4:.5 Eb5:1 | "
    "F5:1.5 Db5:.5 F5:.5 Ab5:.5 Db6:1 | C6:1 Ab5:.5 F5:.5 Db5:1 F5:1 | Db5:.5 F5:.5 Bb5:1 Db6:1.5 Bb5:.5 | "
)
ANTHEM, UNDER = ANTHEM_HEAD + "D6:1.5 Bb5:.5 Ab5:.5 F5:.5 D5:1", UNDER_HEAD + "Bb5:1.5 F5:.5 F5:.5 D5:.5 Bb4:1"
ANTHEM_HOME, UNDER_HOME = ANTHEM_HEAD + "D6:1 Bb5:1 D#6:1 B5:.5 F#5:.5", UNDER_HEAD + "Bb5:1 F5:1 B5:1 F#5:.5 D#5:.5"
for _line, _beats in ((TUNE_1, 32), (TUNE_2, 32), (TUNE_UNDER, 32), (ORGAN_SAYS, 16), (SOLO_1, 32), (SOLO_2, 32), (ANTHEM, 32), (UNDER, 32), (ANTHEM_HOME, 32), (UNDER_HOME, 32)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=251, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(103)
    sr = x.sr
    tau = 2 * np.pi

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

    def root(name):
        """A chord's bass note: its name's note, between E1 and D#2."""
        pc = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name[0]] + {"b": -1, "#": 1}.get(name[1:2], 0)
        return 28 + (pc - 4) % 12

    def halves(bar):
        """The bar's chords (one, or one for each half): each its bass note, its four notes, its notes' names."""
        return [(root(name), [n(c) for c in GRID[name][0].split()], GRID[name][1].split()) for name in CHORDS[(bar - 1) % BARS].split(",")]

    of = lambda bar, beat=0.0: halves(bar)[-1 if beat >= 2 else 0]

    def ladder(names, lo, hi):
        """A chord's notes (by name) from `lo` up to `hi`."""
        pcs = {n(c + "4") % 12 for c in names}
        return [m for m in range(lo, hi + 1) if m % 12 in pcs]

    # ---- the kit: a breakbeat ----
    def kick(b, vol=0.5):
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(50 + 120 * np.exp(-t / 0.016)) / sr) * np.exp(-t / 0.085)) + 0.3 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.25, ghost=False):
        k = int((0.05 if ghost else 0.13) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(200 + 80 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.035)
        put("snare", b, crunch(0.8 * body + 0.9 * hiss(k, 8000, 0.5) * np.exp(-t / (0.016 if ghost else 0.06))) * tail(k, 0.006) * vol, 0.05)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        k = int((0.14 if open_ else 0.035) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / (0.05 if open_ else 0.009)) * tail(k, 0.004) * vol, pan)

    def roll(b, length, soft=0.04, loud=0.26):
        """A snare roll: 16ths that turn to 32nds half way, swelling."""
        at_ = 0.0
        while at_ < length - 1e-9:
            snare(b + at_, soft + (loud - soft) * (at_ / length) ** 1.5, ghost=at_ < length - 0.3)
            at_ += 0.25 if at_ < length / 2 else 0.125

    def breakbeat(bar, vol=1.0, fill=0):
        """The plan's beat: the kick on 1 and the "and" of 2 (every other bar one more, on the "and" of 3), the snare
        on 2 and 4, soft snares between, hats in 16ths with an open one. `fill`: 1, a turn of 16ths in the bar's last
        beat; 2, double time: 16ths through its second half."""
        b = bar0(bar)
        for i in ((0, 6) if bar % 2 else (0, 6, 10)):
            kick(b + i / 4, 0.5 * vol)
        snare(b + 1, 0.26 * vol)
        if fill < 2:
            snare(b + 3, 0.26 * vol)
        for i in ((7, 9, 15) if bar % 2 else (3, 9, 13)):
            if not (fill and i >= (12 if fill == 1 else 8)):
                snare(b + i / 4, 0.07 * vol, ghost=True)
        for i in range(16):
            opened = i == (10 if bar % 2 else 14)
            hat(b + i / 4, (0.03 if i % 4 == 0 else 0.019 if i % 2 == 0 else 0.011) * vol * (1.3 if opened else 1), open_=opened)
        for i in range(16 - (4 if fill == 1 else 8 if fill == 2 else 0), 16):
            snare(b + i / 4, (0.08 + 0.009 * i) * vol, ghost=i % 4 != 0)

    # ---- the five patches ----
    def blip(b, m, vol=0.03, pan=0.0):
        """Patch 1's note, the data stream: a narrow (12.5%) pulse, a 32nd long."""
        at(b, 0.11)
        put("stream", b, x.pulse(m, 0.11, 0.125, vol, attack=0.001, decay=0.03, sustain=0.5, release=0.004), pan)

    def stream(b, length, names, lo, hi, vol=0.03, grow=0.0):
        """The data stream: 32nds sweeping up the chord's notes from `lo` to `hi` and back down, from one side to the
        other as it goes; `grow`: how much louder by its end."""
        steps = ladder(names, lo, hi)
        zig = steps + steps[-2:0:-1]
        count = int(round(length * 8))
        for i in range(count):
            j = i % len(zig)
            side = min(j, len(zig) - j) / (len(steps) - 1)
            blip(b + i / 8, zig[j], vol * (1 + grow * i / max(1, count - 1)), 1.6 * side - 0.8)

    SAW = [1 / h for h in range(1, 17)]

    def lead(start, text, vol=1.0, pan=0.0, bus="lead"):
        """Patch 2, the cyber-saw lead: three sawtooths a hair apart, no attack; it glides 40 ms into a note that leaps
        (three half steps or more) from the one before; a 6 Hz vibrato once a note is held."""
        last = None
        for b, d, m in notes(start, text):
            b, d = float(b), float(d)
            at(b, d)
            leap = m - last[0] if last and b - last[1] < 0.05 and abs(m - last[0]) >= 3 else 0
            put(bus, b, x.tone(m, d * 0.96, SAW, 0.19 * vol, detune=(-9, 0, 8), vib=0.008 if d >= 1 else 0.0, vib_hz=6.0, scoop=leap, scoop_s=0.014, attack=0.002, release=0.02), pan)
            last = (m, b + d)

    def dive(b, length, top, bottom, vol=0.16):
        """The lead's dive: one note falling from `top` to `bottom`."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        w = np.zeros(k)
        for cents in (-9, 0, 8):
            ph = tau * np.cumsum(x.hz(top + cents / 100) * (x.hz(bottom) / x.hz(top)) ** (u**1.6)) / sr
            w += sum(np.sin(h * ph) / h for h in range(1, 17))
        put("lead", b, w / 3 * np.minimum(1, np.arange(k) / (0.004 * sr)) * tail(k, 0.03) * (1 - 0.5 * u) * vol)

    DRAW = (1, 0.9, 0.8, 0.22, 0.1, 0.14)  # the drawbars: the first three strong

    def key(m, d, vol):
        """Patch 3's note, the drawbar organ: its first three harmonics strong, a click on the key."""
        w = x.tone(m, d, list(DRAW), vol, attack=0.002, release=0.012)
        k = len(w)
        t = np.arange(k) / sr
        return w + (0.5 * np.sin(tau * 4 * x.hz(m) * t) * np.exp(-t / 0.012) + 0.35 * hiss(k, 9000, 0.5) * np.exp(-t / 0.002)) * vol * tail(k, 0.01)

    def organ(start, text, vol=1.0, pan=0.1):
        for b, d, m in notes(start, text):
            b, d = float(b), float(d)
            at(b, d)
            put("organ", b, key(m, d * 0.85, 0.11 * vol), pan)

    def stab(b, ms, vol=0.04, pan=-0.2):
        """The organ's short chord."""
        at(b, 0.4)
        put("stab", b, sum(key(m, 0.4, vol) for m in ms), pan)

    def glass(b, m, vol=0.05, pan=0.3, long=0.5):
        """Patch 4's note, the crystalline bell: an FM bell whose overtones are the note's own harmonics."""
        b = float(b)
        at(b, 2)
        k = int((3 * long + 0.2) * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("bell", b, np.sin(ph + 1.4 * np.exp(-t / (long / 2)) * np.sin(4 * ph)) * np.exp(-t / long) * np.minimum(1, t / 0.002) * tail(k, 0.2) * vol, pan)

    def pad(bar, vol=0.02, bells=True):
        """A held chord: soft strings, and (the bell pad) the same notes rung an octave up, left to die."""
        _, ms, _ = of(bar)
        at(bar0(bar), 4)
        for j, m in enumerate(ms):
            put("pad", bar0(bar), x.strings(m, 4, vol, attack=0.15, release=0.3), (-0.5, -0.15, 0.15, 0.5)[j])
            if bells:
                glass(bar0(bar) + 0.02 * j, m + 12, vol * 1.3, (0.5, 0.15, -0.15, -0.5)[j], 1.2)

    def thump(b, m, vol=0.38):
        """Patch 5's note, the octave-bounce FM bass: an 80 ms pluck with a metallic front."""
        at(b, 0.25)
        k = x.k(0.25)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.sin(ph + (4.0 * np.exp(-t / 0.08) + 0.4) * np.sin(ph)) * (0.2 + 0.8 * np.exp(-t / 0.08)) + 0.35 * np.sin(3.7 * ph) * np.exp(-t / 0.006)
        put("bass", b, w * np.minimum(1, t / 0.001) * tail(k, 0.01) * vol)

    def bounce(bar, vol=1.0):
        """The bass's bar: 16ths that never stop, the root and its octave by turns, a little harder with the kick."""
        b = bar0(bar)
        for i in range(16):
            thump(b + i / 4, of(bar, i / 4)[0] + (12 if i % 2 else 0), (0.27 if i in (0, 6) else 0.21) * vol)

    def groove(bar, vol=1.0, fill=0, pads=0.016):
        breakbeat(bar, vol, fill), bounce(bar, vol)
        if pads:
            pad(bar, pads, bells=False)

    def tune(first, text, under=None, streams=False):
        """Eight bars of the lead's tune over the groove: with `under`, the second lead beneath it; with `streams`,
        the data stream behind, every other bar."""
        for bar in range(first, first + 8):
            groove(bar, 1.0, fill=1 if bar == first + 7 else 0)
            if streams and bar % 2:
                stream(bar0(bar), 4, of(bar)[2], 76, 96, 0.016)
        lead(bar0(first), text)
        if under:
            lead(bar0(first), under, 0.6, -0.25, "lead2")

    def vamp(bar, vol=1.0, fill=0):
        """A bar of the organ's part: the breakbeat a little lighter, the bass off the beat with air in it, the organ's
        short chords."""
        b = bar0(bar)
        breakbeat(bar, 0.9 * vol, fill)
        low, ms, _ = of(bar)
        for i, over in COOL:
            thump(b + i / 4, low + over, 0.3 * vol)
        for i in STABS[bar % 2]:
            stab(b + i / 4, ms, 0.04 * vol)

    def interlude(first, bars_):
        """The bell alone: its floating 8ths over a held chord, a hi-hat's pulse, a soft bass note a bar; the last bar
        is the snare's roll."""
        for j, bar in enumerate(range(first, first + bars_)):
            b = bar0(bar)
            low, _, _ = of(bar)
            pad(bar, 0.02)
            thump(b, low, 0.3)
            for i in range(8):
                hat(b + i / 2, 0.026 if i % 2 == 0 else 0.016)
            for i, name in enumerate(FLOAT[j % 4].split()):
                glass(b + i / 2, n(name) + 12, 0.048, 0.5 * np.sin(1.3 * i + j), 0.6)
        roll(bar0(first + bars_ - 1), 4)

    def climax(first, home):
        """Sixteen bars of the climax: the anthem on the lead with the second lead a third or a sixth under it, twice;
        fills at the turns, double time in each last bar; the data stream behind. `home`: the last bar is Bb7 to B7."""
        for bar in range(first, first + 16):
            at_turn = (bar - first) % 8
            groove(bar, 1.05, fill=2 if at_turn == 7 else 1 if at_turn == 3 else 0, pads=0.018)
            if at_turn % 2 == 0:
                stream(bar0(bar), 4, of(bar)[2], 75, 97, 0.015)
        kick(bar0(first), 0.55)
        lead(bar0(first), ANTHEM), lead(bar0(first), UNDER, 0.62, -0.25, "lead2")
        lead(bar0(first + 8), ANTHEM_HOME if home else ANTHEM), lead(bar0(first + 8), UNDER_HOME if home else UNDER, 0.62, -0.25, "lead2")

    # Section 1, bars 1-4: boot-up. The data stream, four bars of 32nds up and down the Em9 from side to side,
    # growing; in the last bar and a half the lead dives two octaves. Bars 5-12: the groove: the breakbeat, the bass
    # bouncing on E, pads (Em9, Dmaj7), the bell's 16ths.
    stream(0, 16, of(1)[2], 64, 95, 0.03, grow=0.8)
    dive(bar0(3) + 2, 6, n("E6"), n("E4"))
    for bar in range(5, 13):
        breakbeat(bar, 1.0, fill=1 if bar == 12 else 0)
        for i in range(16):
            thump(bar0(bar) + i / 4, 28 + (12 if i % 2 else 0), 0.27 if i in (0, 6) else 0.21)
        pad(bar, 0.018)
        for i, name in enumerate(SPARKLE[((bar - 5) % 4)].split()):
            glass(bar0(bar) + i / 4, n(name), 0.028, 0.5 * np.sin(0.9 * i), 0.25)

    # Section 2, bars 13-28: the tune, twice.
    tune(13, TUNE_1), tune(21, TUNE_2)

    # Section 3, bars 29-40: the organ. Its short chords and a word or two; then its solo.
    for bar in range(29, 41):
        vamp(bar, 1.0, fill=1 if bar == 40 else 0)
    organ(bar0(29), ORGAN_SAYS), organ(bar0(33), SOLO_1)

    # Section 4, bars 41-48: the bell alone; the roll.
    interlude(41, 8)

    # Section 5, bars 49-64: the climax.
    climax(49, True)

    # Round again, shorter and fuller (the docstring): the tune once with the second lead and the data stream; the
    # organ's second solo; four bars of the bell and the roll; the climax, and home.
    tune(65, TUNE_2, TUNE_UNDER, streams=True)
    for bar in range(73, 81):
        vamp(bar, 1.0, fill=1 if bar == 80 else 0)
    organ(bar0(73), SOLO_2)
    interlude(81, 4)
    climax(85, True)

    # A hall for the bell and the pads; a little for the leads, the organ and the data stream; none for the kit or the bass.
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
    x.echo("lead", 0.75, 0.14, 0.06), x.echo("bell", 0.75, 0.22, 0.1), x.echo("stream", 0.75, 0.2, 0.08), x.echo("organ", 0.75, 0.08, 0.03)
    for name, secs, wet in (("pad", 2.2, 0.4), ("bell", 2.0, 0.4), ("lead", 1.4, 0.18), ("lead2", 1.4, 0.18), ("organ", 1.0, 0.12), ("stream", 1.4, 0.25)):
        room(name, secs, wet)
    levels = {"lead": 1.0, "lead2": 1.0, "organ": 1.0, "stab": 1.0, "bell": 2.0, "stream": 2.0, "pad": 2.0, "bass": 0.8, "kick": 0.65, "snare": 1.3, "hats": 4.2}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
