"""Song G (Eric, Nov 11, on Song F: "much much better, the intro is perfect, it sorta goes a little too cliche in the
middle, would be curious to see a more unique chord progression with varying tempo", and more tones layered in).
Song F's intro and turnaround, kept note for note; everything between is new. E minor, about 31.6 s, loops.
The tempo moves: 160 beats a minute, a slowing into a heavy stretch at 116, a speeding up through 160 to 176, and a
slowing over the last bar back to 160 for the loop.
The chords: the theme's bass climbs E, F, G sharp, A (Em, F, G# dim, Am), then C, B flat, F# half-dim, B; the slow
stretch steps up a minor third a bar (Em, Gm, B flat m, C# m); the run home is Am, F, D# dim, B.
Voices: the old console's four (two pulses, the triangle, noise), plus three in the spirit of its add-on sound chips:
a sawtooth (held notes under the theme, then doubling the lead), a soft bell, and low toms.
Every melody, riff and chord progression here is original: none of it is any game's.
  python3 song_g.py <out.wav>

  bars  1-2   the intro (Song F's), 160
  bars  3-10  the theme: long notes over the climbing bass; the last half bar slows
  bars 11-14  the slow stretch, 116: lead and saw in octaves, bells, half-time drums; the last bar speeds up
  bars 15-18  the run home: 160 speeding to 176, everything in
  bars 19-20  the turnaround (Song F's): 176, slowing to 160 into bar 1
"""
import sys

import numpy as np

from synth import SR, Mix, chords, length, line, write_wav

BEATS = 80
# The tempo: (beat, beats a minute), straight lines between.
TEMPO = [(0, 160), (38, 160), (40, 116), (52, 116), (56, 160), (72, 176), (76, 176), (80, 160)]


class TempoMix(Mix):
    """A Mix whose beats aren't all one length: `at(beat, beats)` before making a note sets its length; `put` places it."""

    def __init__(self, tempo, beats, os=1, seed=7):
        step = 1 / 96
        grid = np.arange(0, beats + step / 2, step)
        bpm = np.interp(grid, [b for b, _ in tempo], [t for _, t in tempo])
        self.grid = grid
        self.times = np.concatenate([[0], np.cumsum(60 / bpm[:-1] * step)])
        super().__init__(float(self.times[-1]), beats, os=os, seed=seed)

    def t(self, beat: float) -> float:
        return float(np.interp(beat, self.grid, self.times))

    def at(self, beat: float, beats: float = 1.0) -> None:
        self.beat_s = (self.t(beat + beats) - self.t(beat)) / beats

    def put(self, bus, beat, x, pan=0.0):
        b = self.bus(bus)
        i0 = int(round(self.t(beat) * self.sr)) % self.N
        gl, gr = 1 - max(0.0, pan), 1 + min(0.0, pan)
        k, done = len(x), 0
        while done < k:
            m = min(k - done, self.N - i0)
            b[0, i0 : i0 + m] += x[done : done + m] * gl
            b[1, i0 : i0 + m] += x[done : done + m] * gr
            done, i0 = done + m, 0


# ---- the notes (pulse 1) ----
INTRO = "E5:.5 B4:.5 G5:.5 B4:.5 F#5:.5 B4:.5 G5:.5 B4:.5 | E5:.5 B4:.5 G5:.5 B4:.5 A5:.5 B4:.5 B5:.5 B4:.5"
THEME = (
    "B5:1.5 G5:.5 E5:.5 B5:1.5 | C6:1.5 A5:.5 F5:.5 C6:1 A5:.5 | D6:1.5 B5:.5 G#5:.5 B5:.5 D6:.5 F6:.5 | E6:2.5 C6:.5 A5:.5 E5:.5 | "
    "G5:.5 C6:.5 E6:.5 G6:1.5 E6:1 | F6:1.5 D6:.5 Bb5:.5 D6:.5 F6:1 | E6:1 C6:.5 A5:.5 F#5:.75 A5:.75 C6:.5 | B5:2 D#6:.5 F#6:.5 A6:1"
)
SLOW = "G5:2 B5:1 E6:1 | D6:2 Bb5:1 G5:1 | F5:2 Bb5:1 Db6:1 | E6:2 G#6:1 E6:.5 G#6:.5"
HOME = (
    "A5:.75 C6:.75 E6:.5 A6:1 E6:.5 C6:.5 | A5:.75 C6:.75 F6:.5 A6:1 F6:.5 C6:.5 | "
    "A5:.75 D#6:.75 F#6:.5 A6:.5 F#6:.5 D#6:.5 C6:.5 | B5:.5 D#6:.5 F#6:.5 B6:1.5 A6:.5 F#6:.5"
)
TURN = (
    "E6:.5 B5:.25 G5:.25 E5:.5 G5:.25 B5:.25 E6:.5 B5:.25 G5:.25 E5:1 | "
    "B4:.5 D#5:.5 F#5:.5 B5:.5 D#6:.25 F#6:.25 B6:.25 F#6:.25 D#6:.25 F#6:.25 A6:.5"
)
for name, beats in [(INTRO, 8), (THEME, 32), (SLOW, 16), (HOME, 16), (TURN, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# ---- the chords ----
EM, AM, B = "E4 G4 B4", "E4 A4 C5", "D#4 F#4 B4"
CHORD = chords(
    [
        (0, 8, EM, "E2"),
        # the theme: Em, F, G# dim, Am | C, Bb, F# half-dim, B
        (8, 12, EM, "E2"), (12, 16, "F4 A4 C5", "F2"), (16, 20, "D4 G#4 B4", "G#2"), (20, 24, AM, "A2"),
        (24, 28, "E4 G4 C5", "C2"), (28, 32, "D4 F4 Bb4", "Bb1"), (32, 36, AM, "F#2"), (36, 40, B, "B1"),
        # the slow stretch: up a minor third a bar
        (40, 44, EM, "E2"), (44, 48, "D4 G4 Bb4", "G2"), (48, 52, "Db4 F4 Bb4", "Bb1"), (52, 56, "C#4 E4 G#4", "C#2"),
        # the run home: Am, F, D# dim, B
        (56, 60, AM, "A1"), (60, 64, "F4 A4 C5", "F2"), (64, 68, "D#4 F#4 A4", "D#2"), (68, 72, B, "B1"),
        # the turnaround: Em, B
        (72, 76, EM, "E2"), (76, 80, B, "B1"),
    ]
)


def main(out: str) -> None:
    x = TempoMix(TEMPO, BEATS, os=4, seed=59)
    put = x.put

    def lead_note(m, beats, duty, vol):
        """Pulse 1: a held note (a beat or more) gets vibrato."""
        k = x.k(beats * 0.92)
        t = np.arange(k) / x.sr
        f = np.full(k, x.hz(m))
        if beats >= 1:
            f = f * (1 + 0.012 * np.sin(2 * np.pi * 6.5 * t) * np.clip((t - 0.12) / 0.1, 0, 1))
        ph = np.cumsum(f) / x.sr
        return np.where(ph % 1 < duty, 1.0, -1.0) * x.env(k, decay=0.25, sustain=0.62, release=0.008) * vol

    def lead(start, text, duty=0.25, vol=0.2):
        for b, d, m in line(start, text):
            x.at(b, d)
            put("lead", b, lead_note(m, d, duty, vol), -0.12)

    def saw(m, beats, vol):
        return x.add(m, beats, x.SAW, vol, attack=0.012, sustain=0.8, decay=0.2, release=0.03)

    def saw_line(start, text, vol=0.11, up=-12):
        """The sawtooth on the lead's notes, an octave under it."""
        for b, d, m in line(start, text):
            x.at(b, d)
            put("saw", b, saw(m + up, d * 0.92, vol), 0.25)

    def saw_hold(a, b, vol=0.05):
        """The sawtooth holding two of the chord's notes, a bar at a time, one each side."""
        for bar in range(a, b, 4):
            notes, _ = CHORD(bar)
            x.at(bar, 4)
            put("saw", bar, saw(notes[1], 3.9, vol), -0.5)
            put("saw", bar, saw(notes[2], 3.9, vol), 0.5)

    def bells(start, text, vol=0.09, up=12):
        for b, d, m in line(start, text):
            x.at(b, d)
            put("bell", b, x.bell(m + up, min(d, 2) * 1.5, vol, ratio=2.0, index=1.2, decay=0.45), 0.3)

    def arp(a, b, step=0.5, shape=(0, 2, 1, 2), vol=0.075, duty=0.25, up=0):
        t, i = a, 0
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            s = shape[i % len(shape)]
            x.at(t, step)
            put("arp", t, x.pulse(notes[s % 3] + 12 * (s // 3) + up, step * 0.8, duty, vol, decay=0.06, sustain=0.5, release=0.006), 0.2)
            t, i = t + step, i + 1

    def bass(a, b, pickups=False, vol=0.36):
        """The triangle: 8ths on the root, the bar's last one a fifth up (with 16ths into the next bar when pushing)."""
        for bar in range(a, b, 4):
            for i in range(8):
                _, root = CHORD(bar + i * 0.5)
                x.at(bar + i * 0.5, 0.5)
                if pickups and i == 7:
                    put("bass", bar + 3.5, x.tri(root + 19, 0.2, vol, release=0.006))
                    put("bass", bar + 3.75, x.tri(root + 24, 0.2, vol, release=0.006))
                else:
                    put("bass", bar + i * 0.5, x.tri(root + 12 + (7 if i == 7 else 0), 0.41, vol, release=0.006))

    def slow_bass(a, b, vol=0.38):
        """The triangle in the slow stretch: a long root, then the fifth and the octave."""
        for bar in range(a, b, 4):
            _, root = CHORD(bar)
            for o, d, up in ((0, 2, 0), (2, 1, 7), (3, 1, 12)):
                x.at(bar + o, d)
                put("bass", bar + o, x.tri(root + 12 + up, d * 0.9, vol, release=0.01))

    def kick(b, vol=0.3):
        x.at(b)
        put("drum", b, x.noise(0.07, 1400, vol, 0.028))
        put("drum", b, x.tri(50, 0.08 / x.beat_s, vol * 1.3, bend=(14, -14), decay=0.04, sustain=0.0))

    def snare(b, vol=0.2):
        put("drum", b, x.noise(0.13, 7000, vol, 0.045))

    def hat(b, vol=0.06):
        put("drum", b, x.noise(0.035, 24000, vol, 0.011), 0.25)

    def crash(b, vol=0.22):
        put("drum", b, x.noise(0.9, 14000, vol, 0.22))

    def tom(b, m, vol=0.3, pan=0.0):
        """A low tom: a triangle diving a fourth, with a tick of noise."""
        x.at(b)
        put("drum", b, x.tri(m, 0.22 / x.beat_s, vol, bend=(5, -5), decay=0.09, sustain=0.0), pan)
        put("drum", b, x.noise(0.03, 3000, vol * 0.4, 0.012), pan)

    def beat(a, b, sixteenths=False):
        for bar in range(a, b, 4):
            for o in (0, 2, 2.5):
                kick(bar + o, 0.3 if o in (0, 2) else 0.22)
            snare(bar + 1), snare(bar + 3)
            for i in range(16 if sixteenths else 8):
                o = i * (0.25 if sixteenths else 0.5)
                hat(bar + o, 0.065 if (o * 2) % 2 == 0 else 0.04)

    def half_time(a, b):
        """The slow stretch's drums: kick on 1, snare on 3, toms into the next bar, 8th hats."""
        for bar in range(a, b, 4):
            kick(bar, 0.34), kick(bar + 1.5, 0.22), snare(bar + 2, 0.24)
            tom(bar + 3, 50, 0.26, -0.4), tom(bar + 3.5, 45, 0.28, 0.4)
            for i in range(8):
                hat(bar + i * 0.5, 0.055 if i % 2 == 0 else 0.035)

    def roll(at, steps, step=0.25, v0=0.1, dv=0.025):
        for i in range(steps):
            snare(at + i * step, v0 + dv * i)

    # Bars 1-2: the intro, as Song F's.
    crash(0)
    lead(0, INTRO, duty=0.125, vol=0.17)
    for b in range(0, 8, 2):
        x.at(b, 2)
        put("arp", b, x.pulse(52, 1.9, 0.5, 0.07, decay=0.3, sustain=0.6))
    bass(0, 8)
    for b in range(0, 8, 2):
        kick(b)
    for i in range(16):
        hat(i * 0.5, 0.05)
    snare(5), snare(6.5, 0.14)
    roll(7, 4, 0.25, 0.12, 0.03)

    # Bars 3-10: the theme over the climbing bass. The sawtooth holds the chord under it; the last half bar slows.
    crash(8)
    lead(8, THEME, duty=0.25, vol=0.2)
    arp(8, 40)
    saw_hold(8, 40)
    bass(8, 36)
    bass(36, 40, pickups=True)
    beat(8, 36)
    kick(36), snare(37), kick(38), tom(38.5, 52, 0.26, -0.4), tom(39, 50, 0.28, 0.0), tom(39.5, 45, 0.3, 0.4)
    for i in range(4):
        hat(36 + i * 0.5, 0.06)
    snare(23.5, 0.16), snare(23.75, 0.2)

    # Bars 11-14: the slow stretch. Lead and sawtooth in octaves, bells above, pulse 2 rolling up two octaves.
    crash(40, 0.26)
    lead(40, SLOW, duty=0.5, vol=0.19)
    saw_line(40, SLOW, 0.12)
    bells(40, SLOW)
    arp(40, 56, step=0.5, shape=(0, 1, 2, 3, 4, 5, 4, 3), vol=0.07, duty=0.125)
    slow_bass(40, 56)
    half_time(40, 52)
    kick(52, 0.34), snare(54, 0.2)  # the last bar speeds up under a roll
    for i in range(8):
        hat(52 + i * 0.5, 0.05)
    roll(54.5, 6, 0.25, 0.1, 0.025)

    # Bars 15-18: the run home, speeding up. Everything in: the sawtooth doubles the lead, bells on each bar.
    crash(56)
    lead(56, HOME, duty=0.5, vol=0.19)
    saw_line(56, HOME, 0.1)
    arp(56, 72, step=0.25, shape=(0, 1, 2, 1), vol=0.07, duty=0.125, up=12)
    bass(56, 72, pickups=True)
    beat(56, 72, sixteenths=True)
    for bar in range(56, 72, 4):
        x.at(bar)
        put("bell", bar, x.bell(CHORD(bar)[0][2] + 12, 3, 0.08, ratio=2.0, index=1.2, decay=0.45), 0.3)
    snare(63.5, 0.16), snare(63.75, 0.2)
    roll(71, 8, 0.125, 0.08, 0.016)

    # Bars 19-20: the turnaround, as Song F's (the sawtooth joins), slowing into bar 1.
    crash(72)
    lead(72, TURN, duty=0.25, vol=0.2)
    saw_line(72, TURN, 0.08)
    arp(72, 80, step=0.25, shape=(2, 1, 0, 1), vol=0.07, duty=0.125, up=12)
    bass(72, 80, pickups=True)
    beat(72, 76, sixteenths=True)
    for o in (76, 76.75, 77.5):
        kick(o), snare(o, 0.12)
    roll(78, 8, 0.25, 0.08, 0.02)

    write_wav(out, x.mixdown({"bass": 0.7, "arp": 1.4, "drum": 1.6, "bell": 1.6}, lowpass=9000))


if __name__ == "__main__":
    main(sys.argv[1])
