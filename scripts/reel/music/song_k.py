"""Song K (Eric, Nov 11): Big Boy's theme, a new go in a new style (on Song J: the part "playing over everything is
very dull and boring, sounds like all the rest"; "a new style entirely, different scale or key", "maybe 176").
A cartoon chase: 176 beats a minute, 176 beats = 44 bars = 60.0 s (the 30-second sample was bars 1-18 and 41-44). The scale is new: C with a raised fourth and a
flat seventh (C D E F# G A Bb), the whole scale sliding to E flat, F, D and D flat and back, not a round of chords.
The tune moves by step and repeated notes with gaps in it, where the earlier songs' tunes ran up and down chords.
Voices: a xylophone lead (a pulse an octave under it; a toy piano joins in the middle), an oom-pah of triangle bass
and marimba stabs, a thin pulse circling scale steps in 16ths (from bar 7), toy blocks answering in the tune's gaps
and tumbling down at the ends of phrases, a squeak, a kick, a light snare and a shaker.
Every melody, riff and chord progression here is original: none of it is any show's or any game's.
  python3 song_k.py <out.wav>

  bars  1-2    stop-time: everyone hits together, blocks tumble
  bars  3-10   the tune: on C; up to E flat for bars 7-8; back
  bars 11-18   the middle: low marimba calls and quick high xylophone answers (on F, C, D, D flat), then a climb
               from the bottom to the top in bursts
  bars 19-26   a second tune, the toy piano on top: on F, C, A flat, G
  bars 27-34   the block party: a low riff with the blocks alone, high trills answering, up to E flat, a run up
  bars 35-40   the tune back, up on E flat, then home on C
  bars 41-44   the tune's start again, a slide all the way down, and three hits to the loop
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 176.0
BEATS = 176
SECS = BEATS * 60 / BPM

HITS = "C5:.5 -:1 C5:.5 -:.5 C5:.5 -:1 | C5:.5 -:.5 Bb4:.5 B4:.5 C5:.5 -:1.5"
TUNE = (
    "E5:.5 E5:.5 F#5:.5 G5:.5 -:.5 G5:.5 A5:.5 G5:.5 | F#5:.5 E5:.5 D5:.5 E5:1 -:.5 C5:1 | "
    "E5:.5 E5:.5 F#5:.5 G5:.5 -:.5 Bb5:.5 A5:.5 G5:.5 | A5:.5 Bb5:.5 B5:.5 C6:1.5 -:1 | "
    "G5:.5 G5:.5 A5:.5 Bb5:.5 -:.5 Bb5:.5 C6:.5 Bb5:.5 | A5:.5 G5:.5 F5:.5 G5:1 -:.5 Eb5:1 | "
    "E5:.5 F#5:.5 G5:.5 A5:.5 Bb5:.5 A5:.5 G5:.5 F#5:.5 | G5:1 -:.5 C6:.5 -:.5 C6:.5 G5:1"
)
# The middle, second go (Eric: "go lower, higher, quick notes, a little delay between some, and a new pattern"):
# a low call and a quick high answer, with gaps; then a climb from the bottom to the top in bursts.
MIDDLE = (
    "F3:.5 F3:.5 -:.5 A3:.5 B3:.5 C4:.5 -:.5 Eb4:.5 | -:.5 C7:.25 B6:.25 A6:.25 G6:.25 A6:.5 -:.5 Eb7:.25 D7:.25 C7:.5 -:.5 | "
    "C3:.5 C3:.5 -:.5 E3:.5 F#3:.5 G3:.5 -:.5 Bb3:.5 | -:.5 G6:.25 A6:.25 Bb6:.25 C7:.25 Bb6:.5 -:.5 F#6:.25 G6:.25 E6:.5 -:.5 | "
    "D3:.5 F#3:.5 A3:.25 C4:.25 -:.5 F#6:.25 G#6:.25 A6:.25 C7:.25 -:.5 A6:.5 | Db3:.5 F3:.5 Ab3:.25 B3:.25 -:.5 F6:.25 G6:.25 Ab6:.25 B6:.25 -:.5 Ab6:.5 | "
    "C3:.25 D3:.25 E3:.25 F#3:.25 -:.5 G3:.25 A3:.25 Bb3:.25 C4:.25 -:.5 D4:.25 E4:.25 F#4:.25 G4:.25 | "
    "A4:.25 Bb4:.25 C5:.25 D5:.25 E5:.25 F#5:.25 G5:.25 A5:.25 Bb5:.5 B5:.5 C6:1"
)
# The one-minute loop's new parts (Eric, Nov 11: "big boy go 1 minute").
# A second tune: the same stepping, stop-and-go kind, on F, C, A flat and G.
SECOND = (
    "A5:.5 -:.5 A5:.5 B5:.5 C6:1 B5:.5 A5:.5 | G5:.5 A5:.5 -:.5 F5:.5 G5:.5 A5:.5 -:.5 Eb5:.5 | "
    "E5:.5 -:.5 E5:.5 F#5:.5 G5:1 F#5:.5 E5:.5 | D5:.5 E5:.5 -:.5 C5:.5 D5:.5 E5:.5 -:.5 Bb4:.5 | "
    "C6:.5 C6:.5 D6:.5 Eb6:.5 -:.5 Eb6:.5 F6:.5 Eb6:.5 | D6:.5 C6:.5 Bb5:.5 C6:1 -:.5 Ab5:1 | "
    "B5:.5 B5:.5 C#6:.5 D6:.5 -:.5 F6:.5 E6:.5 D6:.5 | C#6:.5 D6:.5 E6:.5 F6:.5 G6:1 -:1"
)
# The block party: a low riff with the blocks, then quick high trills answering it, up to E flat, and a run up.
RIFF = "C3:.5 -:.5 C3:.5 Eb3:.5 E3:.5 -:.5 G3:.5 Bb3:.5 | C4:.5 -:.5 Bb3:.5 G3:.5 F#3:.5 -:.5 E3:.5 D3:.5"
TRILLS = "-:1 G6:.25 A6:.25 G6:.25 A6:.25 Bb6:.5 -:1.5 | -:1 E6:.25 F#6:.25 E6:.25 F#6:.25 G6:.5 -:1.5"
RUN_UP = (
    "D5:.5 -:.5 D5:.5 -:.5 D5:.25 D5:.25 D5:.5 -:1 | "
    "G4:.25 Ab4:.25 A4:.25 Bb4:.25 B4:.25 C5:.25 Db5:.25 D5:.25 Eb5:.25 E5:.25 F5:.25 F#5:.25 G5:.25 Ab5:.25 A5:.25 Bb5:.25"
)
TAG = (
    "E5:.5 E5:.5 F#5:.5 G5:.5 -:.5 G5:.5 A5:.5 G5:.5 | A5:.5 Bb5:.5 B5:.5 C6:1.5 -:1 | "
    "C6:.25 B5:.25 Bb5:.25 A5:.25 Ab5:.25 G5:.25 F#5:.25 F5:.25 E5:.25 Eb5:.25 D5:.25 Db5:.25 C5:1 | "
    "C5:.5 -:.5 C5:.5 -:.5 Bb4:.5 B4:.5 C5:1"
)
for name, beats in [(HITS, 8), (TUNE, 32), (MIDDLE, 32), (TAG, 16), (SECOND, 32), (RIFF, 8), (TRILLS, 8), (RUN_UP, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# Where the scale sits, bar by bar (its bottom note).
ROOTS = (
    ["C3"] * 6 + ["Eb3"] * 2 + ["C3"] * 2  # bars 1-10
    + ["F2"] * 2 + ["C3"] * 2 + ["D3", "Db3"] + ["C3"] * 2  # 11-18, the middle
    + ["F2"] * 2 + ["C3"] * 2 + ["Ab2"] * 2 + ["G2"] * 2  # 19-26, the second tune
    + ["C3"] * 4 + ["Eb3"] * 2 + ["D3", "C3"]  # 27-34, the block party
    + ["Eb3"] * 4 + ["C3"] * 2  # 35-40, the tune back, up on E flat
    + ["C3"] * 4  # 41-44, the ending
)
assert len(ROOTS) == 44
SCALE = (0, 2, 4, 6, 7, 9, 10)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=101)
    put = x.put

    def wood(m, vol=0.2, decay=0.16):
        """A wooden bar struck with a mallet: the note, a quick overtone two octaves up and a knock."""
        k = int(decay * 6 * x.sr)
        t = np.arange(k) / x.sr
        f = 2 * np.pi * x.hz(m) * t
        w = np.sin(f) + 0.45 * np.sin(4 * f) * np.exp(-t / 0.03) + 0.15 * np.sin(9.2 * f) * np.exp(-t / 0.008)
        return w * np.exp(-t / decay) * np.minimum(1, t / 0.001) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr)) * vol

    def block(b, hz=900.0, vol=0.2, pan=0.0):
        """A toy block knocked: a very short hollow tone."""
        k = int(0.09 * x.sr)
        t = np.arange(k) / x.sr
        w = np.sin(2 * np.pi * hz * t) + 0.5 * np.sin(2 * np.pi * hz * 2.7 * t) * np.exp(-t / 0.006)
        put("blocks", b, w * np.exp(-t / 0.018) * np.minimum(1, t / 0.0005) * vol, pan)

    def tumble(b, steps=8, step=0.125, top=1500.0):
        for i in range(steps):
            block(b + i * step, top * (0.88 if steps <= 12 else 0.94) ** i, min(0.14 + 0.012 * i, 0.2), 0.5 if i % 2 else -0.5)

    def squeak(b, vol=0.08):
        put("lead", b, x.pulse(n("C6"), 0.4, 0.25, vol, bend=(0, 12), decay=0.1, sustain=0.7, release=0.01), 0.4)

    def tune(start, text, piano=False, up=0):
        """The xylophone and a pulse an octave under it; block knocks answer in the gaps (a half-beat rest)."""
        t = start
        for tok in text.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name == "-":
                if d == 0.5:
                    block(t, 1050, 0.16, 0.3), block(t + 0.25, 760, 0.13, -0.3)
            else:
                m = n(name) + up
                put("xylo", t, wood(m + 12, 0.2), -0.1)
                put("lead", t, x.pulse(m, d * 0.7, 0.25, 0.075, decay=0.1, sustain=0.5, release=0.01), 0.1)
                if piano:
                    put("bell", t, x.bell(m + 24, 1, 0.07, ratio=5.0, index=1.8, decay=0.22), 0.35)
            t += d

    def oompah(bar, root, circle=True):
        """The bass on 1 and 3 (the root, then the fourth below), marimba stabs on 2 and 4, the kit, and the fast pulse."""
        b = bar * 4
        put("bass", b, x.tri(root, 0.6, 0.32, release=0.01))
        put("bass", b + 2, x.tri(root - 5, 0.6, 0.32, release=0.01))
        put("bass", b + 3.5, x.tri(root - 2, 0.3, 0.26, release=0.01))
        for o in (1, 3):
            for j, up in enumerate((16, 22, 26)):  # the scale's third, flat seventh and second: the stab
                put("marimba", b + o, wood(root + up, 0.17, 0.12), (-0.4, 0.0, 0.4)[j])
            x.snare(b + o, 0.1)
        x.kick(b, 0.42, soft=True), x.kick(b + 2, 0.38, soft=True)
        for i in range(8):
            put("drum", b + i * 0.5, x.noise(0.03, 20000, 0.035 if i % 2 == 0 else 0.05, 0.01), -0.25)
        if circle:
            # A thin pulse circling the scale's steps in 16ths: up five steps and back, then the same a third higher.
            for i in range(16):
                s = (0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 6, 5, 4, 3)[i]
                put("arp", b + i * 0.25, x.pulse(root + 24 + SCALE[s % 7] + 12 * (s // 7), 0.2, 0.125, 0.08, decay=0.04, sustain=0.4, release=0.004), -0.3)

    def hits(start, text):
        """Stop-time: bass, marimba, xylophone and a block all on the same notes."""
        for b, d, m in line(start, text):
            put("bass", b, x.tri(m - 24, 0.4, 0.34, release=0.01))
            put("xylo", b, wood(m + 12, 0.2), -0.1)
            put("marimba", b, wood(m, 0.2, 0.14), 0.2)
            put("lead", b, x.pulse(m, 0.3, 0.25, 0.075, decay=0.1, sustain=0.5, release=0.01), 0.1)
            block(b, 760, 0.2)
            x.kick(b, 0.42, soft=True)

    def wide(t, text, up=0):
        """Plays a line across the whole range: low notes on the marimba and bass, high ones on xylophone and toy piano."""
        for tok in text.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name == "-":
                block(t, 1050, 0.16, 0.3)
                block(t + 0.25, 760, 0.13, -0.3) if d == 0.5 else None
            else:
                m = n(name) + up
                if m < 60:  # low: marimba, the triangle an octave under, a soft square
                    put("marimba", t, wood(m, 0.3, 0.2), -0.15)
                    put("marimba", t, wood(m + 12, 0.12, 0.16), 0.15)
                    put("bass", t, x.tri(m, d * 0.8, 0.3, release=0.01))
                    put("lead", t, x.pulse(m + 12, d * 0.7, 0.5, 0.05, decay=0.1, sustain=0.5, release=0.01), 0.1)
                else:  # high: xylophone, toy piano, a thin pulse an octave under
                    put("xylo", t, wood(m, 0.2, 0.12), -0.1)
                    put("bell", t, x.bell(m, 0.8, 0.07, ratio=5.0, index=1.8, decay=0.2), 0.35)
                    put("lead", t, x.pulse(m - 12, d * 0.7, 0.25, 0.07, decay=0.1, sustain=0.5, release=0.01), 0.1)
            t += d

    # Bars 1-2: stop-time, and the blocks fall over.
    x.crash(0, 0.14, decay=0.25)
    hits(0, HITS)
    tumble(6.5, 12, 0.125, 1700)

    # Bars 3-10: the tune. The fast pulse waits until the scale slides up to E flat in bar 7.
    x.crash(8, 0.14, decay=0.25)
    tune(8, TUNE)
    for bar in range(2, 10):
        oompah(bar, n(ROOTS[bar]), circle=bar >= 6)
    squeak(23), tumble(23, 8)
    tumble(39, 8)

    # Bars 11-18: the middle. Low calls on the marimba (the bass under them), quick high answers on the xylophone and
    # toy piano with the fast pulse behind; blocks knock in the gaps. No oom-pah here. Then the climb, under a roll.
    x.crash(40, 0.14, decay=0.25)
    wide(40.0, MIDDLE)
    for bar in range(10, 18):
        b, root = bar * 4, n(ROOTS[bar])
        x.kick(b, 0.42, soft=True), x.kick(b + 2, 0.38, soft=True)
        for i in range(8):
            put("drum", b + i * 0.5, x.noise(0.03, 20000, 0.035 if i % 2 == 0 else 0.05, 0.01), -0.25)
        answer = bar in (11, 13)
        if answer:  # under a high answer: a held bass note, snare on 2 and 4, the fast pulse
            put("bass", b, x.tri(root, 3.6, 0.3, release=0.02))
            x.snare(b + 1, 0.1), x.snare(b + 3, 0.1)
        if answer or bar >= 16:
            for i in range(16):
                st = (0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 6, 5, 4, 3)[i]
                put("arp", b + i * 0.25, x.pulse(root + 24 + SCALE[st % 7] + 12 * (st // 7), 0.2, 0.125, 0.07, decay=0.04, sustain=0.4, release=0.004), -0.3)
    for i in range(32):  # bars 17-18: a snare roll growing under the climb
        x.snare(64 + i * 0.25, 0.03 + 0.004 * i)

    # Bars 19-26: the second tune, the toy piano on top, over the oom-pah.
    x.crash(72, 0.14, decay=0.25)
    tune(72, SECOND, piano=True)
    for bar in range(18, 26):
        oompah(bar, n(ROOTS[bar]))
    tumble(87, 8)
    squeak(103), tumble(103, 8)

    # Bars 27-34: the block party. The low riff and the blocks alone; then high trills answer it; the same up on
    # E flat; three hits and a run all the way up, under a roll.
    x.crash(104, 0.14, decay=0.25)
    for at, up, trills in ((104, 0, False), (112, 0, True), (120, 3, True)):
        wide(at, RIFF, up)
        wide(at, TRILLS, up) if trills else None
        for b in (at, at + 4):
            x.kick(b, 0.42, soft=True), x.kick(b + 2.5, 0.3, soft=True)
            for o, hz in ((1, 1050), (1.75, 760), (3, 1050), (3.5, 1050), (3.75, 760)):
                block(b + o, hz, 0.15, 0.3 if hz > 900 else -0.3)
            if trills:
                x.snare(b + 1, 0.1), x.snare(b + 3, 0.1)
                for i in range(8):
                    put("drum", b + i * 0.5, x.noise(0.03, 20000, 0.035 if i % 2 == 0 else 0.05, 0.01), -0.25)
    tumble(111, 8), tumble(119, 8)
    hits(128, RUN_UP.split("|")[0])
    wide(132, RUN_UP.split("|")[1])
    x.kick(132, 0.42, soft=True)
    for i in range(16):
        x.snare(132 + i * 0.25, 0.03 + 0.008 * i)

    # Bars 35-40: the tune back, its first four bars up on E flat with the toy piano, then its last two on C.
    x.crash(136, 0.14, decay=0.25)
    bars = TUNE.split("|")
    tune(136, "|".join(bars[:4]), piano=True, up=3)
    tune(152, "|".join(bars[6:]))
    for bar in range(34, 40):
        oompah(bar, n(ROOTS[bar]))
    squeak(151), tumble(151, 8)
    tumble(159, 8)

    # Bars 41-44: the tune's start, the slide down with the blocks tumbling after it, and three hits.
    x.crash(160, 0.14, decay=0.25)
    tune(160, "|".join(TAG.split("|")[:3]))
    for bar in range(40, 43):
        oompah(bar, n(ROOTS[bar]), circle=bar < 42)
    squeak(167)
    tumble(168, 24, 0.125, 2200)
    hits(172, TAG.split("|")[3])
    squeak(175.5, 0.07)

    levels = {"bass": 0.55, "blocks": 3.2, "xylo": 1.4, "marimba": 1.0, "bell": 2.0}
    write_wav(out, x.mixdown(levels, lowpass=9000, room=0.15))


if __name__ == "__main__":
    main(sys.argv[1])
