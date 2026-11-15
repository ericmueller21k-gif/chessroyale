"""Song AF (Eric, Nov 15): Babur's theme (the circus tiger), a second version: his own construction idea, as written.
He had sent a write-up he made himself with another assistant ("Dark Gothic Carnival / Unhinged Mechanical Funhouse",
a "seamless 2-minute looping 16-bit FM chiptune track"); song_ae.py took its style and wrote its own key, chords and
motifs, as for a write-up of someone else's track. He then said: "I came up with this one ... can you just give me
another version where you actually copy the one I sent? I'm not sure which one I'll go with ... actually use what I
gave you and do one more." It is his to give, so this one is the write-up, part for part:
  - 128 beats a minute, four in a bar, 64 bars: 120.0 s.
  - C Hungarian minor (C D Eb F# G Ab B), leaning on the F#, the Ab and the B.
  - Its chord loop, a chord a bar: Cm, Cm (with the F# as a neighbor), Abmaj7#11, G7b9, Fm7, D#dim7, G7sus4, G7#5.
  - Its six patches: an FM bell (the modulator 3.5 times the carrier, no attack, 250 ms); a ghost whistle (a high
    plain note, 200 ms glides, a wide 7 Hz vibrato); a calliope (a biting FM organ: modulators at twice and three
    times the note, feedback, no attack, no release); an FM bass (an 80 ms pluck; roots, octave and fifth pops); an
    "acid-drop" pluck (hollow, a quick blip up in pitch on its front); a pipe organ.
  - Its six sections, bar for bar, and the notes it names: the bell's C4 Eb4 D4; the whistle between B5 and C6; the
    bell's 16ths up C4 Eb4 F#4 A4 C5 Eb5 F#5 A5; the kick on 1 and the "and" of 2, the snare on 2 and 4; the
    calliope's G5 Ab5 G5 turns in 32nds; the organ's Cm, Ab, Fm, G7; the G7b9 held to the end; the B5 C6 trill; the
    falling diminished chord into bar 1.
What it leaves to whoever builds it is written here, inside its rules, and is original (none of it is any song's or
any game's): the calliope's tune, the bell's slow tune, the pluck's riff, the chase's figures and the bass's groove.
It asks for things SOUNDS.md says he has turned down before (runs of 16ths up and down, a biting reed lead, a trill):
they are in, as asked. song_ae.py is the version without them.
  python3 song_af.py <out.wav>

  bars  1-8    0:00  the haunted music box: a heartbeat; the bell's three notes; the whistle; then the bell's 16ths climbing
  bars  9-24   0:15  the manic calliope groove: the kit, the bouncing bass, the calliope's tune (twice)
  bars 25-32   0:45  the breakdown: the dry kit, a deep bass, the acid-drop pluck's off-beat riff
  bars 33-44   1:00  the gothic organ and the bell: the organ's four chords under the beat, the bell's slow tune
  bars 45-56   1:22  the chase: the calliope and a xylophone trading runs up the chord and down by half steps
  bars 57-64   1:45  the high wire: the bass and kit hammering G7b9; the climb, the trill, the cascade down into bar 1
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 128, 64
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 120.0 s
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the bass's note, the organ's four, and its eight notes going up (the chase's run).
TENT = {
    "Cm": ("C2", "C4 Eb4 G4 C5", "C4 Eb4 G4 C5 Eb5 G5 C6 Eb6"),
    "Cdim": ("C2", "C4 Eb4 F#4 A4", "C4 Eb4 F#4 A4 C5 Eb5 F#5 A5"),
    "Abmaj7#11": ("Ab2", "C4 D4 Eb4 G4", "Ab3 C4 Eb4 G4 Ab4 C5 D5 G5"),
    "G7b9": ("G2", "B3 D4 F4 Ab4", "G3 B3 D4 F4 Ab4 B4 D5 F5"),
    "Fm7": ("F2", "C4 Eb4 F4 Ab4", "F3 Ab3 C4 Eb4 F4 Ab4 C5 Eb5"),
    "D#dim7": ("D#2", "C4 D#4 F#4 A4", "D#4 F#4 A4 C5 D#5 F#5 A5 C6"),
    "G7sus4": ("G2", "C4 D4 F4 G4", "G3 C4 D4 F4 G4 C5 D5 F5"),
    "G7#5": ("G2", "B3 D#4 F4 G4", "G3 B3 D#4 F4 G4 B4 D#5 G5"),
    "Ab": ("Ab2", "C4 Eb4 Ab4 C5", ""), "Fm": ("F2", "C4 F4 Ab4 C5", ""), "G7": ("G2", "B3 D4 F4 G4", ""),
}
LOOP = "Cm Cm Abmaj7#11 G7b9 Fm7 D#dim7 G7sus4 G7#5"
CHORDS = (f"Cm Cm Cm Cm Cdim Cdim Cdim Cdim  {LOOP} {LOOP}  {LOOP}  Cm Ab Fm G7 Cm Ab Fm G7 Cm Ab Fm G7  {LOOP} Cm Cm Abmaj7#11 G7b9  " + "G7b9 " * 8).split()
assert len(CHORDS) == BARS, len(CHORDS)
# The bass's groove: the 16th, half steps over the bar's root, a note or a pop (octaves and fifths, off the beat).
GROOVE = ((0, 0, "n"), (2, 12, "p"), (3, 0, "n"), (6, 7, "p"), (8, 0, "n"), (10, 12, "p"), (11, 0, "n"), (14, 7, "p"))

# ---- the lines. Lengths in beats; .25 is a 16th, .125 a 32nd. ----
# The bell's three notes (the write-up's), twice.
MOTIF = "-:1 C4:1 Eb4:1 D4:1 | -:4 | -:1 C4:1 Eb4:1 D4:1 | -:4"
CLIMB = "C4 Eb4 F#4 A4 C5 Eb5 F#5 A5".split()  # its 16ths, round and round (the write-up's)
# The calliope's tune over the loop: hops and jagged leaps, the write-up's G5 Ab5 G5 turn in 32nds, the F# and the B
# leaning on their neighbors.
TUNE = (
    "C5:.5 G5:.125 Ab5:.125 G5:.25 Eb5:.5 C6:.5 -:.5 G5:.125 Ab5:.125 G5:.25 D5:.5 Eb5:.5 | "
    "F#5:.25 G5:.25 C5:.5 F#5:.25 G5:.25 Eb5:.5 B4:.5 C5:.5 -:1 | "
    "Ab5:.5 C6:.5 G5:.125 Ab5:.125 G5:.25 Eb5:.5 D5:.5 G5:.5 C5:.5 -:.5 | "
    "B4:.5 D5:.5 F5:.5 Ab5:.5 G5:.125 Ab5:.125 G5:.25 B5:1 -:.5 | "
    "C6:.5 Ab5:.5 F5:.5 C5:.5 Eb5:.25 F5:.25 Ab5:.5 C6:1 | "
    "D#5:.5 A5:.5 F#5:.5 C6:.5 A5:.5 F#5:.5 D#5:1 | "
    "G5:.125 Ab5:.125 G5:.25 D5:.5 C5:.5 G5:.5 F5:.5 D5:.5 G4:.5 -:.5 | "
    "B4:.5 D#5:.5 G5:.5 B5:.5 G5:.125 Ab5:.125 G5:.25 B5:.5 -:1"
)
# The acid-drop pluck's riff: off the beat, a bar a chord.
RIFF = (
    "-:.25 C5:.25 -:.5 Eb5:.25 -:.25 G5:.5 -:.25 F#5:.25 -:.5 C5:.5 -:.5 | -:.5 B4:.25 -:.25 D5:.5 -:.25 G5:.25 -:.5 Ab5:.25 -:.25 G5:.5 -:.5 | "
    "-:.25 Ab4:.25 -:.5 C5:.25 -:.25 Eb5:.5 -:.25 D5:.25 -:.5 G5:.5 -:.5 | -:.5 B4:.25 -:.25 D5:.5 -:.25 F5:.25 -:.5 Ab5:.25 -:.25 G5:.5 -:.5 | "
    "-:.25 F4:.25 -:.5 Ab4:.25 -:.25 C5:.5 -:.25 Eb5:.25 -:.5 C5:.5 -:.5 | -:.5 D#5:.25 -:.25 F#5:.5 -:.25 A5:.25 -:.5 C6:.25 -:.25 A5:.5 -:.5 | "
    "-:.25 G4:.25 -:.5 C5:.25 -:.25 D5:.5 -:.25 F5:.25 -:.5 G5:.5 -:.5 | -:.5 B4:.25 -:.25 D#5:.5 -:.25 G5:.25 -:.5 B5:.25 -:.25 G5:.5 -:.5"
)
# The bell's slow tune over the organ's four chords, three times round.
SLOW = (
    "G5:1.5 Eb5:.5 C5:2 | -:1 C5:1 Eb5:1 Ab5:1 | Ab5:2 F5:1 C5:1 | B4:2 D5:1 G5:1 | "
    "Eb5:1.5 D5:.5 C5:2 | -:1 Eb5:1 Ab5:1 C6:1 | C6:2 Ab5:1 F5:1 | G5:1.5 F5:.5 D5:1 B4:1 | "
    "C5:1 Eb5:1 G5:2 | Ab5:1.5 G5:.5 Eb5:2 | F5:1 Ab5:1 C6:2 | B5:3 -:1"
)
# The high wire: the calliope's climb into the sixth octave.
RISE = "G4:.5 Ab4:.5 B4:.5 D5:.5 F5:.5 G5:.5 Ab5:.5 B5:.5 | B4:.5 D5:.5 F5:.5 Ab5:.5 B5:.5 D6:.5 B5:.5 C6:.5"
FALL = "F6 D6 B5 Ab5 F5 D5 B4 Ab4 F4 D4 B3 Ab3 F3 D3 B2".split()  # the diminished chord, going down
for _line, _beats in ((MOTIF, 16), (TUNE, 32), (RIFF, 32), (SLOW, 48), (RISE, 8)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=241, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(101)
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

    def chord(name):
        low, keys, run = TENT[name]
        return n(low), [n(c) for c in keys.split()], [n(c) for c in run.split()]

    of = lambda bar: chord(CHORDS[(bar - 1) % BARS])

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.26 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(48 + 110 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.1)) + 0.3 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.24, ghost=False):
        """A snappy, gated snare: its noise cut short."""
        k = int((0.06 if ghost else 0.13) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(200 + 80 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.035)
        put("snare", b, crunch(0.8 * body + 0.9 * hiss(k, 8000, 0.5) * np.exp(-t / (0.02 if ghost else 0.06))) * tail(k, 0.006) * vol, 0.05)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        k = int((0.18 if open_ else 0.04) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / (0.06 if open_ else 0.01)) * tail(k, 0.004) * vol, pan)

    def thud(b, vol=0.5):
        """The heartbeat: a deep, soft thump."""
        k = int(0.32 * sr)
        t = np.arange(k) / sr
        put("sub", b, np.sin(tau * np.cumsum(44 + 50 * np.exp(-t / 0.03)) / sr) * np.exp(-t / 0.1) * np.minimum(1, t / 0.004) * tail(k) * vol)

    def beat(bar, vol=1.0, sixteenths=False, opens=False):
        """The write-up's beat: the kick on 1 and the "and" of 2, the snare on 2 and 4; hats on the 8ths (or 16ths)."""
        b = bar0(bar)
        kick(b, 0.5 * vol), kick(b + 1.5, 0.45 * vol)
        snare(b + 1, 0.26 * vol), snare(b + 3, 0.26 * vol)
        for i in range(16 if sixteenths else 8):
            step = i / 4 if sixteenths else i / 2
            strong = i % 4 == 0 if sixteenths else i % 2 == 0
            hat(b + step, (0.032 if strong else 0.02 if (not sixteenths or i % 2 == 0) else 0.009) * vol, open_=opens and step == 3.5)

    # ---- the six patches ----
    def bell(b, m, vol=0.07, pan=0.25, long=1.0):
        """Patch 1, the glassy music box: an FM bell, its modulator 3.5 times the note, no attack, 250 ms."""
        at(float(b), long)
        put("bell", float(b), x.bell(m, long, vol, ratio=3.5, index=2.2, decay=0.25), pan)

    def ghost(b, steps, vol=0.05, pan=-0.35):
        """Patch 2, the theremin ghost whistle, one breath: a high plain note that glides 200 ms to each next one
        (`steps`: note, beats), a wide 7 Hz vibrato."""
        total = sum(d for _, d in steps)
        at(b, total)
        k = x.k(total)
        t = np.arange(k) / sr
        f = np.zeros(k)
        pos = 0
        for i, (name, d) in enumerate(steps):
            end = k if i == len(steps) - 1 else pos + x.k(d)
            f[pos:end] = x.hz(n(name))
            pos = end
        g = int(0.2 * sr)
        f = np.exp(np.convolve(np.log(np.concatenate([np.full(g, f[0]), f, np.full(g, f[-1])])), np.ones(g) / g, "same")[g:-g])
        ph = tau * np.cumsum(f * (1 + 0.022 * np.minimum(1, t / 0.4) * np.sin(tau * 7 * t))) / sr
        put("ghost", b, (np.sin(ph) + 0.1 * np.sin(3 * ph)) * np.minimum(1, t / 0.15) * tail(k, 0.3) * vol, pan)

    def reed(m, d, vol):
        """Patch 3's note, the manic steam calliope: a biting FM organ. Modulators at twice and three times the note,
        the first fed back on itself; no attack, no release."""
        k = x.k(d)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        fed = np.sin(ph + 0.9 * np.sin(ph))
        return np.sin(ph + 1.3 * np.sin(2 * ph + 0.7 * fed) + 0.8 * np.sin(3 * ph)) * np.minimum(1, t / 0.001) * tail(k, 0.003) * vol

    def calliope(start, text, vol=1.0, pan=0.12, up=0):
        for b, d, m in notes(start, text):
            b, d = float(b), float(d)
            at(b, d * 0.8)
            put("calliope", b, reed(m + up, d * 0.8, 0.135 * vol), pan)

    def pluck(b, m, long=0.25, kind="n", vol=0.4):
        """Patch 4, the rubbery FM bass: an 80 ms woody pluck. A pop is brighter."""
        at(b, long)
        k = x.k(long) + int(0.03 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.sin(ph + ((4.5 if kind == "p" else 3.0) * np.exp(-t / 0.08) + 0.5) * np.sin(ph)) * (0.15 + 0.85 * np.exp(-t / 0.11))
        put("bass", b, w * np.minimum(1, t / 0.001) * tail(k, 0.03) * vol)

    def drop(b, m, vol=0.18, pan=-0.15):
        """Patch 5, the acid-drop pluck: short and hollow, a quick blip up into its pitch (a metallic drop of water)."""
        k = int(0.16 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (-9 * np.exp(-t / 0.009) / 12)) / sr
        w = np.sin(ph) + 0.45 * np.sin(3 * ph) + 0.2 * np.sin(5 * ph) + 0.35 * np.sin(2.76 * ph) * np.exp(-t / 0.02)
        put("drop", b, w * np.exp(-t / 0.05) * np.minimum(1, t / 0.001) * tail(k) * vol, pan)

    PIPES = (1, 0.7, 0.45, 0.3, 0.12, 0.08)

    def pipes(bar, vol=0.03, length=4.0):
        """Patch 6, the gothic pipe organ: the bar's chord over its bass note, held."""
        low, keys, _ = of(bar)
        at(bar0(bar), length)
        for j, m in enumerate([low + 12] + keys):
            put("pad", bar0(bar), x.tone(m, length * 0.98, list(PIPES), vol, attack=0.1, release=0.2, trem=0.06, trem_hz=4.5), (0.0, -0.5, -0.15, 0.15, 0.5)[j])

    def xylo(b, m, vol=0.1, pan=-0.35):
        """The chase's second voice: a xylophone's bar, a knock, a short note, its twelfth."""
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        w = np.sin(tau * f * t) * np.exp(-t / 0.08) + 0.35 * np.sin(tau * 3 * f * t) * np.exp(-t / 0.03) + 0.2 * np.sin(tau * 6.3 * f * t) * np.exp(-t / 0.012)
        put("xylo", b, w * np.minimum(1, t / 0.0008) * tail(k) * vol, pan)

    def piped(b, m, vol=0.11, pan=0.12, d=0.2):
        """One of the calliope's 16ths (or, shorter, 32nds)."""
        at(b, d)
        put("calliope", b, reed(m, d, vol), pan)

    def groove(bar, vol=1.0):
        """The bass's bar: roots, and octave and fifth pops off the beat."""
        low = of(bar)[0]
        for i, over, kind in GROOVE:
            pluck(bar0(bar) + i / 4, low + over, 0.22, kind, 0.34 * vol)

    # Section 1, bars 1-8: the haunted music box. Half-time: a heartbeat on beat 1. The bell's three notes, the ghost
    # whistle answering between B5 and C6. From bar 5 the bell's 16ths climb the diminished chord, round and round,
    # growing; the heartbeat doubles; hats and a snare's roll in the last bar.
    for bar in range(1, 9):
        thud(bar0(bar))
        if bar >= 5:
            thud(bar0(bar) + 2, 0.4)
    for b, d, m in notes(0, MOTIF):
        bell(b, m, 0.13, 0.2, 1.0)
    ghost(bar0(2), [("B5", 2), ("C6", 2)]), ghost(bar0(4), [("C6", 2), ("B5", 2)])
    climb = [n(c) for c in CLIMB]
    for i in range(64):
        bell(bar0(5) + i / 4, climb[i % 8], 0.035 + 0.045 * i / 63, 0.35 * np.sin(0.8 * i), 0.5)
    ghost(bar0(7), [("B5", 4), ("C6", 4)], 0.04)
    for i in range(8):
        hat(bar0(7) + i * 0.5, 0.02), hat(bar0(8) + i * 0.5, 0.028)
    for i in range(16):
        snare(bar0(8) + i / 4, 0.04 + 0.012 * i, ghost=True)

    # Section 2, bars 9-24: the manic calliope groove. The kit, the bouncing bass, the calliope's tune, twice (the
    # second time with 16th hats).
    for bar in range(9, 25):
        beat(bar, 1.0, sixteenths=bar >= 17, opens=bar % 4 == 0), groove(bar)
    calliope(bar0(9), TUNE), calliope(bar0(17), TUNE)

    # Section 3, bars 25-32: the breakdown. No calliope, no chords: the dry kit, a deep bass note a bar, and the
    # acid-drop pluck's off-beat riff.
    for bar in range(25, 33):
        b = bar0(bar)
        beat(bar, 0.9)
        low = of(bar)[0]
        at(b, 2.5)
        k = x.k(2.5)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(low) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        put("sub", b, (np.tanh(2.0 * np.sin(ph)) / np.tanh(2.0) + 0.3 * np.sin(2 * ph)) * np.exp(-t / 0.5) * tail(k, 0.02) * 0.36)
        pluck(b + 3.5, low + 12, 0.22, "p", 0.36)
    for b, d, m in notes(bar0(25), RIFF):
        drop(float(b), m)

    # Section 4, bars 33-44: the gothic organ and the bell. The organ holds Cm, Ab, Fm, G7 under the beat and the
    # bass; the bell's slow tune in the fifth octave.
    for bar in range(33, 45):
        beat(bar, 0.85), groove(bar, 0.9), pipes(bar, 0.018)
    for b, d, m in notes(bar0(33), SLOW):
        bell(b, m, 0.13, 0.2, max(1.0, float(d)))

    # Section 5, bars 45-56: the chase. No organ. The calliope and the xylophone trade 16ths: one runs up the bar's
    # chord (two beats), the other down by half steps from where it stopped (two beats), turn about; in the last
    # four bars they share one line, a note each.
    for bar in range(45, 57):
        b = bar0(bar)
        beat(bar, 1.0, sixteenths=True), groove(bar)
        run = of(bar)[2]
        down = [run[-1] - 1 - i for i in range(8)]
        if bar >= 53:
            for i, m in enumerate(run + down):
                piped(b + i / 4, m) if i % 2 == 0 else xylo(b + i / 4, m)
        else:
            first, second = (piped, xylo) if bar % 2 else (xylo, piped)
            for i in range(8):
                first(b + i / 4, run[i]), second(b + 2 + i / 4, down[i])

    # Section 6, bars 57-64: the high wire. The bass and the kit hammer G7b9 (8ths, then 16ths; a kick on every beat
    # at the end). The calliope climbs into the sixth octave, trills B5 and C6 in 32nds for three bars, and falls down
    # the diminished chord in overlapping fours to the B under bar 1's C; the whistle climbs beside it and comes down.
    for bar in range(57, 65):
        b = bar0(bar)
        low = of(bar)[0]
        late = bar >= 61
        for i in range(16 if late else 8):
            step = i / 4 if late else i / 2
            pluck(b + step, low + (12 if i % 2 else 0), 0.2, "p" if i % 2 else "n", 0.3 if late else 0.36)
        for i in range(4):
            kick(b + i, 0.5) if late or i % 2 == 0 else None
        kick(b + 1.5, 0.4), snare(b + 1, 0.26), snare(b + 3, 0.26)
        for i in range(16):
            hat(b + i / 4, 0.03 if i % 4 == 0 else 0.018 if i % 2 == 0 else 0.009)
        if bar == 64:
            for i in range(16):
                snare(b + i / 4, 0.05 + 0.01 * i, ghost=True)
    calliope(bar0(57), RISE)
    for i in range(96):
        piped(bar0(59) + i / 8, n("B5") if i % 2 == 0 else n("C6"), 0.08 + 0.025 * (i % 8 == 0) + 0.02 * i / 95, d=0.11)
    fall = [n(c) for c in FALL]
    for beat_ in range(12):
        for i in range(4):
            piped(bar0(62) + beat_ + i / 4, fall[beat_ + i], 0.115)
    ghost(bar0(57), [("G5", 4), ("B5", 4), ("C6", 4), ("Eb6", 4), ("F#6", 4), ("F6", 4), ("D6", 4), ("B5", 3)], 0.035)

    # A hall for the bell, the whistle and the organ; a little for the calliope, the pluck and the xylophone; none for
    # the kit or the bass.
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
    x.echo("bell", 0.75, 0.2, 0.09), x.echo("ghost", 0.75, 0.22, 0.1), x.echo("drop", 0.75, 0.18, 0.07)
    for name, secs, wet in (("pad", 2.4, 0.4), ("bell", 2.0, 0.4), ("ghost", 2.2, 0.45), ("calliope", 1.0, 0.12), ("xylo", 1.0, 0.15), ("drop", 1.2, 0.2)):
        room(name, secs, wet)
    levels = {"calliope": 1.3, "bell": 2.0, "ghost": 2.0, "xylo": 2.0, "drop": 2.0, "bass": 0.8, "sub": 0.5, "kick": 0.65, "snare": 1.6, "hats": 5.0, "pad": 1.4}
    return x.play(x.mixdown(levels, lowpass=8500, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
