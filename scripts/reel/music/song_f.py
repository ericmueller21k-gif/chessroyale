"""Song F (Eric, Nov 11, on Song E: "revert back to the NES quality", "way too upbeat sounding"): a 30-second loop
in the style of an 8-bit action game's stage theme, darker than Song C: a wistful minor tune that falls more than it
climbs, over a bass that drives on one note instead of bouncing.
160 beats a minute, 80 beats = 20 bars of four = 30.0 s. E minor; minor chords nearly all the way.
Only the old console's four voices, one note at a time each: pulse 1 (the lead: vibrato on held notes), pulse 2
(the chord, broken slowly and low), a 16-step triangle bass, noise drums. No echo, no other voices.
Every melody, riff and chord progression here is original: none of it is another of these songs', or any game's.
  python3 song_f.py <out.wav>

  bars  1-2   the intro: a pulse figure round one held note, the drums coming in
  bars  3-10  the theme: long falling notes, each answered by a climb
  bars 11-18  the push: shorter, syncopated phrases stepping up a chord a bar, ending on the tension chord
  bars 19-20  the turnaround: a falling run, then a run up that loops back to bar 1
"""
import sys

import numpy as np

from synth import Mix, chords, length, line, write_wav

BPM = 160.0
BEATS = 80
SECS = BEATS * 60 / BPM

# ---- the notes (pulse 1) ----
INTRO = "E5:.5 B4:.5 G5:.5 B4:.5 F#5:.5 B4:.5 G5:.5 B4:.5 | E5:.5 B4:.5 G5:.5 B4:.5 A5:.5 B4:.5 B5:.5 B4:.5"
THEME = (
    "B5:1.5 A5:.5 G5:.5 E5:1.5 | E5:.5 G5:.5 B5:.5 D6:1.5 B5:1 | C6:1.5 B5:.5 G5:.5 E5:1.5 | F#5:.5 A5:.5 D6:.5 F#6:1.5 E6:.5 D6:.5 | "
    "E6:1.5 D6:.5 B5:.5 G5:1.5 | G5:.5 B5:.5 E6:.5 G6:1.5 F#6:.5 E6:.5 | E6:1 C6:.5 G5:.5 C6:.75 E6:.75 G6:.5 | F#6:2.5 D6:.5 B5:.5 F#5:.5"
)
PUSH = (
    "A5:.75 C6:.75 E6:.5 D6:.5 C6:.5 A5:1 | B5:.75 D6:.75 F#6:.5 E6:.5 D6:.5 B5:1 | "
    "C6:.75 E6:.75 G6:.5 F#6:.25 E6:.25 D6:.5 E6:1 | D6:.5 F#6:.5 A6:1.5 G6:.5 F#6:.5 D6:.5 | "
    "E6:1.5 C6:.5 A5:.5 C6:.5 E6:1 | F#6:1.5 D6:.5 B5:.5 D6:.5 F#6:1 | "
    "G6:1 E6:.5 C6:.5 E6:.5 G6:.5 B6:1 | A6:.75 F#6:.75 D#6:.5 B5:.5 D#6:.5 F#6:1"
)
TURN = (
    "E6:.5 B5:.25 G5:.25 E5:.5 G5:.25 B5:.25 E6:.5 B5:.25 G5:.25 E5:1 | "
    "B4:.5 D#5:.5 F#5:.5 B5:.5 D#6:.25 F#6:.25 B6:.25 F#6:.25 D#6:.25 F#6:.25 A6:.5"
)
for name, beats in [(INTRO, 8), (THEME, 32), (PUSH, 32), (TURN, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# ---- the chords (pulse 2 breaks them up; the triangle takes the bass note) ----
EM, C, D, BM, AM, B = "E4 G4 B4", "E4 G4 C5", "D4 F#4 A4", "D4 F#4 B4", "E4 A4 C5", "D#4 F#4 B4"
CHORD = chords(
    [
        (0, 8, EM, "E2"),
        # the theme: Em, Em, C, D | Em, Em, C, Bm
        (8, 16, EM, "E2"), (16, 20, C, "C2"), (20, 24, D, "D2"), (24, 32, EM, "E2"), (32, 36, C, "C2"), (36, 40, BM, "B1"),
        # the push: Am, Bm, C, D | Am, Bm, C, B
        (40, 44, AM, "A1"), (44, 48, BM, "B1"), (48, 52, C, "C2"), (52, 56, D, "D2"),
        (56, 60, AM, "A1"), (60, 64, BM, "B1"), (64, 68, C, "C2"), (68, 72, B, "B1"),
        # the turnaround: Em, B
        (72, 76, EM, "E2"), (76, 80, B, "B1"),
    ]
)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=4, seed=59)
    put = x.put

    def lead_note(m, beats, duty, vol):
        """Pulse 1: a held note (a beat or more) gets vibrato; one of a beat and a half or more also fades a little."""
        k = x.k(beats * 0.92)
        t = np.arange(k) / x.sr
        f = np.full(k, x.hz(m))
        if beats >= 1:
            f = f * (1 + 0.012 * np.sin(2 * np.pi * 6.5 * t) * np.clip((t - 0.12) / 0.1, 0, 1))
        ph = np.cumsum(f) / x.sr
        return np.where(ph % 1 < duty, 1.0, -1.0) * x.env(k, decay=0.25, sustain=0.62, release=0.008) * vol

    def lead(start, text, duty=0.25, vol=0.2):
        for b, d, m in line(start, text):
            put("lead", b, lead_note(m, d, duty, vol), -0.12)

    def arp(a, b, step=0.5, shape=(0, 2, 1, 2), vol=0.075, duty=0.25, up=0):
        """Pulse 2: the chord broken up, low and steady (8ths in the theme, 16ths in the push)."""
        t, i = a, 0
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            put("arp", t, x.pulse(notes[shape[i % len(shape)]] + up, step * 0.8, duty, vol, decay=0.06, sustain=0.5, release=0.006), 0.2)
            t, i = t + step, i + 1

    def bass(a, b, pickups=False, vol=0.36):
        """The triangle: 8ths on the root, the bar's last one a fifth up (with 16ths into the next bar in the push)."""
        for bar in range(a, b, 4):
            for i in range(8):
                _, root = CHORD(bar + i * 0.5)
                if pickups and i == 7:
                    put("bass", bar + 3.5, x.tri(root + 19, 0.2, vol, release=0.006))
                    put("bass", bar + 3.75, x.tri(root + 24, 0.2, vol, release=0.006))
                else:
                    put("bass", bar + i * 0.5, x.tri(root + 12 + (7 if i == 7 else 0), 0.41, vol, release=0.006))

    def kick(b, vol=0.3):
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
            for o in (0, 2, 2.5):
                kick(bar + o, 0.3 if o in (0, 2) else 0.22)
            snare(bar + 1), snare(bar + 3)
            for i in range(16 if sixteenths else 8):
                o = i * (0.25 if sixteenths else 0.5)
                hat(bar + o, 0.065 if (o * 2) % 2 == 0 else 0.04)

    def roll(at, steps, step=0.25, v0=0.1, dv=0.025):
        for i in range(steps):
            snare(at + i * step, v0 + dv * i)

    # Bars 1-2: the intro. Pulse 1's figure, pulse 2 holding the low E under it, the triangle on E, the drums coming in.
    crash(0)
    lead(0, INTRO, duty=0.125, vol=0.17)
    for b in range(0, 8, 2):
        put("arp", b, x.pulse(52, 1.9, 0.5, 0.07, decay=0.3, sustain=0.6))
    bass(0, 8)
    for b in range(0, 8, 2):
        kick(b)
    for i in range(16):
        hat(i * 0.5, 0.05)
    snare(5), snare(6.5, 0.14)
    roll(7, 4, 0.25, 0.12, 0.03)

    # Bars 3-10: the theme. A quarter-pulse lead, long notes; pulse 2 in slow low 8ths; the bass drives on the root.
    crash(8)
    lead(8, THEME, duty=0.25, vol=0.2)
    arp(8, 40)
    bass(8, 40)
    beat(8, 40)
    snare(23.5, 0.16), snare(23.75, 0.2)
    roll(39, 4, 0.25, 0.12, 0.03)

    # Bars 11-18: the push. A square lead; pulse 2 in 16ths an octave up; 16th hats; pickups in the bass.
    crash(40)
    lead(40, PUSH, duty=0.5, vol=0.19)
    arp(40, 72, step=0.25, shape=(0, 1, 2, 1), vol=0.07, duty=0.125, up=12)
    bass(40, 72, pickups=True)
    beat(40, 72, sixteenths=True)
    snare(55.5, 0.16), snare(55.75, 0.2)
    roll(71, 8, 0.125, 0.08, 0.016)

    # Bars 19-20: the turnaround.
    crash(72)
    lead(72, TURN, duty=0.25, vol=0.2)
    arp(72, 80, step=0.25, shape=(2, 1, 0, 1), vol=0.07, duty=0.125, up=12)
    bass(72, 80, pickups=True)
    beat(72, 76, sixteenths=True)
    for o in (76, 76.75, 77.5):
        kick(o), snare(o, 0.12)
    roll(78, 8, 0.25, 0.08, 0.02)

    # The balance, by measurement against the reference's brightness: the bass down, pulse 2 and the drums up.
    write_wav(out, x.mixdown({"bass": 0.7, "arp": 1.4, "drum": 1.6}, lowpass=9000))


if __name__ == "__main__":
    main(sys.argv[1])
