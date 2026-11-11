"""Song C (Eric, Nov 11, in place of track B): a 30-second loop in the style of an 8-bit action game's stage theme.
160 beats a minute, 80 beats = 20 bars of four = 30.0 s. F sharp minor. Only the old console's four voices, one note
at a time each: pulse 1 (the lead: vibrato on held notes, a quick slide up into the longer ones), pulse 2 (fast
broken chords), a 16-step triangle bass in octave jumps, noise drums. No echo, no other voices.
Every melody, riff and chord progression here is original: none of it is song A's or B's, or any game's.
  python3 song_c.py <out.wav>

  bars  1-2   the intro: all voices on one syncopated riff, then a run up
  bars  3-10  the hook: a four-bar phrase and its answer
  bars 11-16  the lift: longer, higher notes; the drums push on 16ths
  bars 17-18  the turnaround: a run and the leading note
  bars 19-20  the intro's riff again as a tag, and a run that loops back to bar 1
"""
import sys

import numpy as np

from synth import Mix, chords, length, line, n, write_wav

BPM = 160.0
BEATS = 80
SECS = BEATS * 60 / BPM

# ---- the notes (pulse 1) ----
INTRO = (
    "F#5:.75 A5:.75 B5:1 C#6:.5 B5:.5 A5:.5 | "
    "F#5:.75 A5:.75 C#6:.5 E6:.25 B5:.25 E6:.25 G#6:.25 E6:.25 G#6:.25 B6:.25 G#6:.25"
)
HOOK = (
    "F#5:.25 A5:.25 C#6:1 B5:.5 A5:.5 B5:.75 C#6:.75 | E6:1 D6:.5 C#6:.5 B5:.75 G#5:.75 B5:.5 | "
    "A5:.25 B5:.25 D6:1 C#6:.5 A5:.5 F#5:.75 A5:.75 | B5:.75 D6:.75 F#6:.5 F6:1.5 C#6:.5 | "
    "F#5:.25 A5:.25 C#6:1 B5:.5 A5:.5 B5:.75 C#6:.75 | E6:.75 F#6:.75 E6:.5 C#6:.5 A5:.5 C#6:.5 E6:.5 | "
    "F#6:1 E6:.25 D6:.25 E6:.5 D6:.5 A5:.5 D6:.5 F#6:.5 | G#6:.75 E6:.75 B5:.5 G#6:.75 F6:.75 C#6:.5"
)
LIFT = (
    "F#6:1.5 E6:.5 D6:.5 E6:.5 F#6:1 | G#6:1.5 F#6:.5 E6:.5 B5:.5 E6:1 | "
    "E6:.75 C#6:.75 G#5:.5 C#6:.75 E6:.75 G#6:.5 | F#6:2 C#6:.5 A5:.5 C#6:.5 F#6:.5 | "
    "A6:1.5 F#6:.5 D6:.5 F#6:.5 A6:1 | G#6:.75 E6:.75 B5:.5 E6:.75 G#6:.75 B6:.5"
)
TURN = "D6:.5 B5:.25 D6:.25 F#6:.5 D6:.25 F#6:.25 B6:1 A6:.5 F#6:.5 | F6:.75 C#6:.75 G#5:.5 C#6:.5 F6:.5 G#6:1"
TAG = (
    "F#5:.75 A5:.75 B5:1 C#6:.5 B5:.5 A5:.5 | "
    "G#5:.75 C#6:.75 F6:.5 G#5:.25 B5:.25 C#6:.25 F6:.25 G#6:.25 B6:.25 G#6:.25 F6:.25"
)
for name, beats in [(INTRO, 8), (HOOK, 32), (LIFT, 24), (TURN, 8), (TAG, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# ---- the chords (pulse 2 breaks them up; the triangle takes the bass note) ----
CHORD = chords(
    [
        (0, 4, "F#4 A4 C#5", "F#2"), (4, 6, "F#4 A4 D5", "D2"), (6, 8, "E4 G#4 B4", "E2"),
        # the hook: F#m, E, D, Bm to C# | F#m, A, D, E to C#
        (8, 12, "F#4 A4 C#5", "F#2"), (12, 16, "E4 G#4 B4", "E2"), (16, 20, "F#4 A4 D5", "D2"), (20, 22, "F#4 B4 D5", "B1"), (22, 24, "F4 G#4 C#5", "C#2"),
        (24, 28, "F#4 A4 C#5", "F#2"), (28, 32, "E4 A4 C#5", "A1"), (32, 36, "F#4 A4 D5", "D2"), (36, 38, "E4 G#4 B4", "E2"), (38, 40, "F4 G#4 C#5", "C#2"),
        # the lift: D, E, C#m, F#m, D, E
        (40, 44, "F#4 A4 D5", "D2"), (44, 48, "E4 G#4 B4", "E2"), (48, 52, "E4 G#4 C#5", "C#2"), (52, 56, "F#4 A4 C#5", "F#2"),
        (56, 60, "F#4 A4 D5", "D2"), (60, 64, "E4 G#4 B4", "E2"),
        # the turnaround and the tag: Bm, C#, F#m, C#
        (64, 68, "F#4 B4 D5", "B1"), (68, 72, "F4 G#4 C#5", "C#2"), (72, 76, "F#4 A4 C#5", "F#2"), (76, 80, "F4 G#4 C#5", "C#2"),
    ]
)
# The riff's rhythm (the intro's and the tag's first bar and a half): every voice hits these together.
RIFF = [(0, 0.75), (0.75, 0.75), (1.5, 1), (2.5, 0.5), (3, 0.5), (3.5, 0.5), (4, 0.75), (4.75, 0.75), (5.5, 0.5)]


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=4, seed=23)
    put = x.put

    def lead_note(m, beats, duty, vol):
        """Pulse 1: a held note (a beat or more) gets vibrato; one of three quarters or more slides up into itself."""
        k = x.k(beats * 0.9)
        t = np.arange(k) / x.sr
        f = np.full(k, x.hz(m))
        if beats >= 1:
            f = f * (1 + 0.011 * np.sin(2 * np.pi * 7 * t) * np.clip((t - 0.1) / 0.08, 0, 1))
        if beats >= 0.75:
            f = f * 2 ** (-2 * np.exp(-t / 0.012) / 12)
        ph = np.cumsum(f) / x.sr
        return np.where(ph % 1 < duty, 1.0, -1.0) * x.env(k, decay=0.12, sustain=0.72, release=0.008) * vol

    def lead(start, text, duty=0.25, vol=0.2):
        for b, d, m in line(start, text):
            put("lead", b, lead_note(m, d, duty, vol), -0.12)

    def arp(a, b, shape=(0, 1, 2, 1), vol=0.085, duty=0.125, up=12):
        """Pulse 2: the chord broken into 16ths, every other pass an octave up."""
        t, i = a, 0
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            m = notes[shape[i % len(shape)]] + up + (12 if (i // len(shape)) % 2 else 0)
            put("arp", t, x.pulse(m, 0.22, duty, vol, decay=0.05, sustain=0.45, release=0.006), 0.2)
            t, i = t + 0.25, i + 1

    # The triangle's bar: 8ths in octave jumps, with 16th pickups (offset, beats, octave up?).
    BASS_BAR = [(0, .5, 0), (.5, .5, 1), (1, .5, 0), (1.5, .25, 1), (1.75, .25, 0), (2, .5, 0), (2.5, .5, 1), (3, .25, 0), (3.25, .25, 0), (3.5, .25, 1), (3.75, .25, 0)]

    def bass(a, b, vol=0.36):
        for bar in range(a, b, 4):
            for o, d, up in BASS_BAR:
                _, root = CHORD(bar + o)
                put("bass", bar + o, x.tri(root + 12 + 12 * up, d * 0.82, vol, release=0.006))

    def kick(b, vol=0.3):
        """A low noise burst with a short dive on the triangle under it."""
        put("drum", b, x.noise(0.07, 1400, vol, 0.028))
        put("drum", b, x.tri(50, 0.08 / x.beat_s, vol * 1.3, bend=(14, -14), decay=0.04, sustain=0.0))

    def snare(b, vol=0.2):
        put("drum", b, x.noise(0.13, 7000, vol, 0.045))

    def hat(b, vol=0.06):
        put("drum", b, x.noise(0.035, 24000, vol, 0.011), 0.25)

    def crash(b, vol=0.22):
        put("drum", b, x.noise(0.9, 14000, vol, 0.22))

    def beat(a, b, sixteenths=False):
        for bar in range(a, b, 4):
            for o in (0, 1.5, 2, 2.75):
                kick(bar + o, 0.3 if o in (0, 2) else 0.22)
            snare(bar + 1), snare(bar + 3)
            for i in range(16 if sixteenths else 8):
                o = i * (0.25 if sixteenths else 0.5)
                hat(bar + o, 0.07 if (o * 2) % 2 == 1 else 0.045)

    def roll(at, steps, step=0.25, v0=0.1, dv=0.025):
        for i in range(steps):
            snare(at + i * step, v0 + dv * i)

    def riff(at, low):
        """All four voices on the riff's rhythm: pulse 2 a sixth or so under the lead, the triangle on the roots."""
        for (o, d), m in zip(RIFF, low):
            put("arp", at + o, x.pulse(n(m), d * 0.9, 0.25, 0.13, decay=0.1, sustain=0.6, release=0.008), 0.2)
            _, root = CHORD(at + o)
            put("bass", at + o, x.tri(root + 12, d * 0.82, 0.36, release=0.006))
            put("bass", at + o + d * 0.5, x.tri(root + 24, d * 0.4, 0.36, release=0.006)) if d >= 0.75 else None
            kick(at + o, 0.3)
            snare(at + o, 0.12)
        for i in range(24):  # 16th hats under the hits keep it moving
            hat(at + i * 0.25, 0.06 if i % 2 == 0 else 0.04)
        # the riff's last two beats and a half: a run up, the bass in 16ths, a roll
        for i in range(8):
            _, root = CHORD(at + 6 + i * 0.25)
            put("bass", at + 6 + i * 0.25, x.tri(root + 12 + (12 if i % 2 else 0), 0.2, 0.36, release=0.006))
            hat(at + 6 + i * 0.25, 0.05)
        arp(at + 6, at + 8, shape=(0, 1, 2), vol=0.1)
        kick(at + 6)
        roll(at + 6.5, 6, 0.25, 0.1, 0.022)

    # Bars 1-2: the intro.
    crash(0)
    lead(0, INTRO, duty=0.5, vol=0.19)
    riff(0, ["A4", "C#5", "D5", "E5", "D5", "C#5", "A4", "D5", "F#5"])

    # Bars 3-10: the hook, a thin bright lead (a quarter pulse) over the broken chords.
    crash(8)
    lead(8, HOOK, duty=0.25, vol=0.2)
    arp(8, 40)
    bass(8, 40)
    beat(8, 40)
    snare(23.5, 0.16), snare(23.75, 0.2)
    roll(39, 4, 0.25, 0.12, 0.03)

    # Bars 11-16: the lift. The lead turns to a square wave and sings higher; pulse 2 climbs through each chord; 16th hats.
    crash(40)
    lead(40, LIFT, duty=0.5, vol=0.2)
    arp(40, 64, shape=(0, 1, 2, 1, 2, 1), vol=0.1, duty=0.25)
    bass(40, 64)
    beat(40, 64, sixteenths=True)
    snare(55.5, 0.16), snare(55.75, 0.2)
    roll(63, 4, 0.25, 0.12, 0.03)

    # Bars 17-18: the turnaround.
    crash(64, 0.18)
    lead(64, TURN, duty=0.25, vol=0.2)
    arp(64, 72, shape=(2, 1, 0, 1), vol=0.09)
    bass(64, 72)
    beat(64, 72, sixteenths=True)
    roll(71, 8, 0.125, 0.08, 0.016)

    # Bars 19-20: the tag (the intro's riff) and the run back to bar 1.
    crash(72)
    lead(72, TAG, duty=0.5, vol=0.19)
    riff(72, ["A4", "C#5", "D5", "E5", "D5", "C#5", "C#5", "F5", "G#5"])

    write_wav(out, x.mixdown(lowpass=9000))


if __name__ == "__main__":
    main(sys.argv[1])
