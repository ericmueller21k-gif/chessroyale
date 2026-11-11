"""Song H (Eric, Nov 11): a desert, pyramid-style boss theme, a 30-second sample. "A few dull low pitch notes that
ring out a bit longer like a desert drought"; and Song G's speeding up, which he liked, for its second half.
E, in the scale with the flat second and the raised third (E F G# A B C D). 92 beats a minute for eight bars, then
four bars speeding up to 132; about 29.7 s; the loop drops back into the drought.
Voices: low, dull plucked notes with a triangle under them, left to ring, over a faint held E and B; a thin, nasal
pulse lead with quick turns (pulse 2 its echo, then its octave); a hand drum (a low and a high stroke), a shaker and
finger cymbals.
Every melody, riff and chord progression here is original: none of it is any game's.
  python3 song_h.py <out.wav>

  bars  1-4   the drought: the low ringing notes alone, a shaker from bar 3
  bars  5-8   the lead enters over them, with the hand drum
  bars  9-12  the lead an octave up, speeding up; the bass in 8ths; finger cymbals
"""
import sys

import numpy as np

from song_g import TempoMix
from synth import length, line, n, write_wav

BEATS = 48
TEMPO = [(0, 92), (32, 92), (48, 132)]

RING = "E2:3 F2:1 | E2:4 | G#2:1.5 A2:.5 G#2:1 F2:1 | E2:4"
LEAD = (
    "B4:1.5 C5:.25 B4:.25 G#4:1 A4:.5 B4:.5 | C5:.5 B4:.5 A4:.5 G#4:.5 F4:1 E4:1 | "
    "G#4:.5 A4:.5 B4:1 D5:.5 C5:.5 B4:.5 A4:.5 | G#4:.25 A4:.25 G#4:.5 F4:1 E4:2"
)
HIGH = (
    "E5:1 F5:.5 E5:.5 G#5:1 A5:.5 G#5:.5 | B5:.5 C6:.5 B5:.5 A5:.5 G#5:.5 A5:.5 B5:1 | "
    "D6:.5 C6:.5 B5:.5 A5:.5 G#5:.5 F5:.5 G#5:.5 A5:.5 | B5:.5 A5:.25 G#5:.25 F5:.5 G#5:.5 E5:2"
)
for name, beats in [(RING, 16), (LEAD, 16), (HIGH, 16)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))
DRUM = "D T - T D - T -"  # the hand drum's bar in 8ths: D the low stroke, T the high one


def main(out: str) -> None:
    x = TempoMix(TEMPO, BEATS, os=4, seed=71)
    put = x.put

    def ring(start, text, vol=1.0):
        """The low notes: a dull pluck and a fading triangle, each left to ring past its length."""
        for b, d, m in line(start, text):
            x.at(b, d)
            put("ring", b, x.pluck(m + 12, d + 1.5, 0.34 * vol, damp=0.998, tone=0.15), -0.1)
            put("ring", b, x.tri(m + 12, d + 1.0, 0.3 * vol, attack=0.006, decay=0.9, sustain=0.12, release=0.2), 0.1)

    def lead(start, text, duty=0.125, vol=0.17, bus="lead", pan=-0.12, delay=0.0, up=0):
        for b, d, m in line(start, text):
            x.at(b, d)
            k = x.k(d * 0.94)
            t = np.arange(k) / x.sr
            f = np.full(k, x.hz(m + up))
            if d >= 1:
                f = f * (1 + 0.014 * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.1) / 0.1, 0, 1))
            f = f * 2 ** (-1 * np.exp(-t / 0.015) / 12)  # a slide up into each note from a half step under
            w = np.where((np.cumsum(f) / x.sr) % 1 < duty, 1.0, -1.0)
            put(bus, b + delay, w * x.env(k, decay=0.3, sustain=0.6, release=0.01) * vol, pan)

    def dum(b, vol=0.34):
        x.at(b)
        put("drum", b, x.tri(45, 0.2 / x.beat_s, vol, bend=(7, -5), decay=0.08, sustain=0.0))
        put("drum", b, x.noise(0.05, 1200, vol * 0.5, 0.02))

    def tek(b, vol=0.14):
        put("drum", b, x.noise(0.06, 9000, vol, 0.018), 0.2)

    def shaker(a, b, vol=0.03):
        for i in range(int((b - a) * 4)):
            put("drum", a + i * 0.25, x.noise(0.03, 20000, vol * (1.4 if i % 4 == 0 else 1.0), 0.01), -0.3)

    def hand_drum(a, b, vol=1.0):
        for bar in range(a, b, 4):
            for i, s in enumerate(DRUM.split()):
                dum(bar + i * 0.5, 0.34 * vol) if s == "D" else tek(bar + i * 0.5, 0.14 * vol) if s == "T" else None

    def cymbal(b, vol=0.07):
        x.at(b)
        put("bell", b, x.bell(n("B6"), 2, vol, ratio=3.5, index=1.6, decay=0.5), 0.4)

    # A faint held E and B under everything.
    for bar in range(0, BEATS, 4):
        x.at(bar, 4)
        put("drone", bar, x.tri(n("E3"), 4.02, 0.07, steps=False, attack=0.05, release=0.05), -0.3)
        put("drone", bar, x.tri(n("B3"), 4.02, 0.04, steps=False, attack=0.05, release=0.05), 0.3)

    # Bars 1-4: the drought.
    ring(0, RING)
    shaker(8, 16)
    tek(15, 0.08), tek(15.5, 0.11)

    # Bars 5-8: the lead over the same low notes, pulse 2 its echo; the hand drum.
    ring(16, RING, 0.9)
    lead(16, LEAD)
    lead(16, LEAD, vol=0.06, bus="echo", pan=0.3, delay=0.75)
    hand_drum(16, 32)
    shaker(16, 32, 0.022)

    # Bars 9-12: an octave up and speeding up. Pulse 2 an octave under the lead; the bass in 8ths; finger cymbals.
    lead(32, HIGH, duty=0.25, vol=0.18)
    lead(32, HIGH, duty=0.125, vol=0.08, bus="echo", pan=0.3, up=-12)
    for bar, root in ((32, "E2"), (36, "E2"), (40, "F2"), (44, "E2")):
        for i in range(8):
            x.at(bar + i * 0.5, 0.5)
            put("bass", bar + i * 0.5, x.tri(n(root) + 12 + (12 if i in (2, 5, 7) else 0), 0.42, 0.34, release=0.006))
        cymbal(bar), cymbal(bar + 2, 0.05)
    hand_drum(32, 48, 1.1)
    shaker(32, 48, 0.035)
    for i in range(8):
        tek(46 + i * 0.25, 0.07 + 0.012 * i)

    x.at(0)
    x.echo("ring", 1.5, 0.22, 0.1)
    x.echo("lead", 0.75, 0.12, 0.05)
    write_wav(out, x.mixdown({"ring": 1.3, "drum": 2.2, "bell": 3.0}, lowpass=7000, room=0.25))


if __name__ == "__main__":
    main(sys.argv[1])
