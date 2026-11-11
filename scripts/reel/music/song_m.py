"""Song M (Eric, Nov 11): Jefferson's theme (the firework stall), a one-minute loop: "lots of sparkles, sparklers,
firework whistling, firework exploding and crackling. With a safari twist."
144 beats a minute, 144 beats = 36 bars = 60.0 s. A, on the five-note scale (A B C# E F#) with a G for color, sliding
whole to C, D, E and F; the low chant bends it minor.
Voices: a thumb-piano lead (a pulse an octave under it), marimba chords on the off-beats, a thin pulse circling the
scale in 16ths, a triangle bass in a 3-3-2 push, low reed voices chanting in fifths, hand drums (a high and a low),
a shaker, a kick and a light snare; and the fireworks: whistles climbing, booms, crackle, sparkles (a scatter of high
pings) and a sparkler's fizz.
Every melody, riff and chord progression here is original: none of it is any film's or any game's.
  python3 song_m.py <out.wav>

  bars  1-4    a whistle climbs alone, a boom and crackle; the hand drums come in; a sparkler fizzes up; another rocket
  bars  5-12   the tune: on A, up to C, back
  bars 13-20   the chant: low voices call, the thumb piano answers high; a pop in each gap (A, D, E)
  bars 21-28   the second tune: D, A, F, E
  bars 29-32   the barrage: hand drums alone under three rockets, each higher, sparkles, a sparkler and a last long whistle
  bars 33-36   the tune's start, a run, three hits with a boom on each, and the last crackle falls into bar 1's whistle
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 144.0
BEATS = 144
SECS = BEATS * 60 / BPM

TUNE = (
    "E5:.5 E5:.5 F#5:.5 A5:1 -:.5 A5:.5 B5:.5 | C#6:.75 B5:.75 A5:.5 F#5:1 -:.5 E5:.5 | "
    "E5:.5 E5:.5 F#5:.5 A5:1 -:.5 B5:.5 C#6:.5 | E6:1.5 C#6:.5 B5:.5 A5:.5 -:1 | "
    "G5:.5 G5:.5 A5:.5 C6:1 -:.5 C6:.5 D6:.5 | E6:.75 D6:.75 C6:.5 A5:1 -:.5 G5:.5 | "
    "A5:.5 B5:.5 C#6:.5 E6:.5 F#6:.5 E6:.5 C#6:.5 B5:.5 | A5:1.5 -:.5 E5:.5 G5:.5 A5:1"
)
CHANT = (
    "A2:.75 A2:.75 C3:.5 D3:.5 E3:.5 -:1 | -:.5 E6:.5 F#6:.25 E6:.25 C#6:.5 -:.5 A5:.5 B5:.5 C#6:.5 | "
    "A2:.75 A2:.75 C3:.5 E3:.5 D3:.5 -:1 | -:.5 A6:.5 F#6:.25 E6:.25 C#6:.5 -:.5 E6:.5 F#6:.5 A6:.5 | "
    "D3:.75 D3:.75 F3:.5 G3:.5 A3:.5 -:1 | -:.5 A6:.5 B6:.25 A6:.25 F#6:.5 -:.5 D6:.5 E6:.5 F#6:.5 | "
    "E3:.75 E3:.75 G3:.5 A3:.5 B3:.5 -:1 | B6:.25 A6:.25 G#6:.25 E6:.25 -:.5 B6:.25 A6:.25 G#6:.25 E6:.25 -:.5 G#6:.5 B6:.5"
)
SECOND = (
    "A5:1 F#5:.5 A5:.5 B5:1 -:.5 A5:.5 | D6:1.5 B5:.5 A5:.5 F#5:.5 A5:1 | "
    "C#6:.5 B5:.5 A5:.5 F#5:.5 -:.5 E5:.5 F#5:.5 A5:.5 | B5:.75 A5:.75 F#5:.5 E5:1.5 -:.5 | "
    "A5:.5 -:.5 A5:.5 C6:.5 D6:.5 C6:.5 A5:.5 G5:.5 | F5:.5 G5:.5 A5:.5 C6:.5 D6:1 F6:1 | "
    "B5:.5 B5:.5 C#6:.5 E6:.5 -:.5 E6:.5 F#6:.5 G#6:.5 | B6:2 -:.5 G#6:.5 E6:.5 B5:.5"
)
END = "A5:.5 -:.5 A5:.5 -:.5 A5:.5 -:1.5"
for name, beats in [(TUNE, 32), (CHANT, 32), (SECOND, 32), (END, 4)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

ROOTS = (
    ["A2"] * 8 + ["C3"] * 2 + ["A2"] * 2  # bars 1-12
    + ["A2"] * 4 + ["D3"] * 2 + ["E3"] * 2  # 13-20
    + ["D3"] * 2 + ["A2"] * 2 + ["F2"] * 2 + ["E2"] * 2  # 21-28
    + ["A2"] * 8  # 29-36
)
assert len(ROOTS) == 36
PENT = (0, 2, 4, 7, 9, 12, 14, 16)


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=127)
    put = x.put
    rng = np.random.default_rng(11)

    # ---- the fireworks ----
    def whistle(b, beats, m0=81, m1=100, vol=0.1, pan=0.0):
        """A rocket going up: a pure tone climbing, its shake growing, fading in."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / x.sr
        f = x.hz(m0 + (m1 - m0) * u**1.5) * (1 + 0.012 * u * np.sin(2 * np.pi * 13 * t))
        ph = 2 * np.pi * np.cumsum(f) / x.sr
        w = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.12 * rng.uniform(-1, 1, k)
        put("fx", b, w * np.minimum(1, u * 6) * (0.5 + 0.5 * u) * np.minimum(1, (1 - u) * 60) * vol, pan)

    def crackle(b, secs=1.2, vol=0.2, count=70):
        """Sparks: a scatter of tiny clicks thinning out."""
        for _ in range(count):
            at = rng.uniform(0, 1) ** 2 * secs
            k = int(rng.uniform(0.001, 0.004) * x.sr)
            put("fx", b + at / x.beat_s, rng.uniform(-1, 1, k) * vol * rng.uniform(0.3, 1) * (1 - at / secs), rng.uniform(-0.8, 0.8))

    def boom(b, vol=0.5, tail=1.2, pan=0.0):
        """A shell bursting: a low thud, a burst of noise, then crackle."""
        k = int(0.5 * x.sr)
        t = np.arange(k) / x.sr
        f = 38 + 70 * np.exp(-t / 0.05)
        put("fx", b, np.sin(2 * np.pi * np.cumsum(f) / x.sr) * np.exp(-t / 0.16) * vol * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr)), pan)
        put("fx", b, x.noise(0.5, 5000, vol * 0.45, 0.12), pan)
        put("fx", b, x.noise(0.25, 24000, vol * 0.25, 0.05), pan)
        crackle(b + 0.1, tail, vol * 0.4, int(60 * tail))

    def sparkle(b, beats, count=12, vol=0.05, root=93):
        """A scatter of high pings on the scale."""
        for _ in range(count):
            m = root + PENT[rng.integers(0, 5)] + 12 * rng.integers(0, 2)
            put("sparkle", b + rng.uniform(0, beats), x.bell(m, 0.6, vol * rng.uniform(0.5, 1), ratio=3.5, index=1.2, decay=0.12), rng.uniform(-0.7, 0.7))

    def fizz(b, beats, vol=0.05, grow=True):
        """A sparkler: hiss with a restless flicker."""
        k = x.k(beats)
        w = np.diff(rng.uniform(-1, 1, k + 1))
        flick = np.repeat(rng.uniform(0.2, 1, k // 400 + 1), 400)[:k]
        u = np.linspace(0, 1, k)
        put("fx", b, w * flick * (u**1.5 if grow else 1) * np.minimum(1, (1 - u) * 40) * vol, 0.3)

    # ---- the band ----
    def wood(m, vol=0.2, decay=0.16):
        k = int(decay * 6 * x.sr)
        t = np.arange(k) / x.sr
        f = 2 * np.pi * x.hz(m) * t
        w = np.sin(f) + 0.45 * np.sin(4 * f) * np.exp(-t / 0.03) + 0.15 * np.sin(9.2 * f) * np.exp(-t / 0.008)
        return w * np.exp(-t / decay) * np.minimum(1, t / 0.001) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr)) * vol

    def conga(b, high=True, vol=0.22, slap=False):
        k = int(0.18 * x.sr)
        t = np.arange(k) / x.sr
        f = (330 if high else 215) * (1 + 0.12 * np.exp(-t / 0.012))
        w = np.sin(2 * np.pi * np.cumsum(f) / x.sr) * np.exp(-t / (0.035 if slap else 0.07))
        w = w + rng.uniform(-1, 1, k) * np.exp(-t / 0.004) * (0.8 if slap else 0.3)
        put("hand", b, w * vol * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr)), 0.35 if high else -0.35)

    # The hand drums' bar in 16ths: L low, H high, S a slap, . nothing.
    DRUMS = "L . . H . . H . L . L . H . S H"
    FILL = "L . H H L . H S L H L H S S H H"

    def hands(bar, pattern=DRUMS, vol=1.0):
        for i, s in enumerate(pattern.split()):
            if s != ".":
                conga(bar * 4 + i * 0.25, s != "L", 0.22 * vol * (1.0 if i % 4 == 0 else 0.8), s == "S")

    def shaker(bar, vol=0.03):
        for i in range(16):
            put("drum", bar * 4 + i * 0.25, x.noise(0.03, 20000, vol * (1.5 if i % 4 == 2 else 1.0), 0.01), -0.25)

    def band(bar, circle=True, chords=True):
        """Bass in a 3-3-2 push, marimba chords on the off-beats, the fast pulse, the hand drums, kick and snare."""
        b, root = bar * 4, n(ROOTS[bar])
        for (o, d), up in zip(((0, 0.75), (0.75, 0.75), (1.5, 0.5), (2, 0.75), (2.75, 0.75), (3.5, 0.5)), (0, 0, 7, 0, 7, 10)):
            put("bass", b + o, x.tri(root + up, d * 0.8, 0.32, release=0.01))
        if chords:
            for o in (0.5, 1.5, 2.5, 3.5):
                for j, up in enumerate((16, 19, 21)):
                    put("marimba", b + o, wood(root + up, 0.15, 0.11), (-0.4, 0.0, 0.4)[j])
        if circle:
            for i in range(16):
                s = (0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 6, 5, 4, 3)[i]
                put("arp", b + i * 0.25, x.pulse(root + 24 + PENT[s], 0.2, 0.125, 0.075, decay=0.04, sustain=0.4, release=0.004), -0.3)
        hands(bar), shaker(bar)
        x.kick(b, 0.42, soft=True), x.kick(b + 2, 0.38, soft=True), x.kick(b + 1.5, 0.22, soft=True)
        x.snare(b + 3, 0.1)

    def tune(start, text, bell=False, vol=1.0):
        """The thumb piano with a pulse an octave under it; a hand-drum slap answers in each half-beat gap."""
        t = start
        for tok in text.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name == "-":
                conga(t, True, 0.2, slap=True) if d == 0.5 else None
            else:
                m = n(name)
                put("thumb", t, wood(m + 12, 0.2 * vol, 0.2), -0.1)
                put("lead", t, x.pulse(m, d * 0.7, 0.25, 0.075 * vol, decay=0.1, sustain=0.5, release=0.01), 0.1)
                if bell:
                    put("sparkle", t, x.bell(m + 24, 1, 0.05, ratio=3.5, index=1.2, decay=0.2), 0.35)
            t += d

    def chant(t, text):
        """Low notes: reed voices in fifths with the bass. High notes: the thumb piano and a thin pulse. A small
        burst pops in each one-beat gap."""
        for tok in text.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name == "-":
                boom(t, 0.22, 0.5, rng.uniform(-0.5, 0.5)) if d == 1 else conga(t, True, 0.2, slap=True)
            else:
                m = n(name)
                if m < 60:
                    put("voices", t, x.reed(m + 12, d * 0.85, 0.14), -0.25)
                    put("voices", t, x.reed(m + 19, d * 0.85, 0.1), 0.25)
                    put("bass", t, x.tri(m, d * 0.85, 0.3, release=0.01))
                else:
                    put("thumb", t, wood(m, 0.2, 0.14), -0.1)
                    put("lead", t, x.pulse(m - 12, d * 0.7, 0.125, 0.07, decay=0.1, sustain=0.5, release=0.01), 0.1)
            t += d

    # Bars 1-4: one rocket alone, its burst; the hand drums; the tune's first notes, far off; a sparkler; a rocket.
    whistle(0, 3, 76, 98, 0.2, -0.2)
    boom(3, 0.5, 1.6)
    sparkle(3.2, 3, 14)
    for bar in (1, 2, 3):
        hands(bar, DRUMS if bar < 3 else FILL, 1.3 + 0.1 * bar), shaker(bar, 0.03 + 0.005 * bar)
    for at in (8, 12):
        for b, d, m in line(at, "E5:.5 E5:.5 F#5:.5 A5:1"):
            put("thumb", b, wood(m + 12, 0.11, 0.2), 0.3)
    fizz(8, 8, 0.05)
    whistle(13.5, 2.5, 79, 100, 0.1, 0.3)
    boom(16, 0.5, 1.4)

    # Bars 5-12: the tune.
    x.crash(16, 0.16, decay=0.3)
    tune(16, TUNE)
    for bar in range(4, 12):
        band(bar)
    sparkle(30, 2, 8), sparkle(46, 2, 8)
    whistle(46, 2, 81, 98, 0.07, -0.4)

    # Bars 13-20: the chant. No chords or fast pulse under the low calls; both under the high answers.
    boom(48, 0.4, 1.0)
    chant(48.0, CHANT)
    for bar in range(12, 20):
        b = bar * 4
        answer = bar % 2 == 1
        hands(bar, FILL if answer else DRUMS), shaker(bar)
        x.kick(b, 0.42, soft=True), x.kick(b + 2, 0.38, soft=True)
        if answer:
            root = n(ROOTS[bar])
            put("bass", b, x.tri(root, 3.6, 0.3, release=0.02))
            x.snare(b + 1, 0.1), x.snare(b + 3, 0.1)
            for i in range(16):
                s = (0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 6, 5, 4, 3)[i]
                put("arp", b + i * 0.25, x.pulse(root + 24 + PENT[s], 0.2, 0.125, 0.07, decay=0.04, sustain=0.4, release=0.004), -0.3)
    whistle(78, 2, 81, 100, 0.08, 0.4)

    # Bars 21-28: the second tune, sparkling on top.
    boom(80, 0.45, 1.2)
    x.crash(80, 0.16, decay=0.3)
    tune(80, SECOND, bell=True)
    for bar in range(20, 28):
        band(bar)
    sparkle(94, 2, 8), sparkle(104, 8, 20, 0.04)
    fizz(108, 4, 0.05)

    # Bars 29-32: the barrage. The hand drums alone (a kick under them): three rockets, each higher, and their
    # bursts; sparkles; then a sparkler and one long whistle into the tune.
    boom(112, 0.5, 1.2)
    for bar in range(28, 32):
        hands(bar, FILL, 1.1), shaker(bar, 0.035)
        x.kick(bar * 4, 0.42, soft=True), x.kick(bar * 4 + 2, 0.38, soft=True)
    for i, (at, pan) in enumerate(((113, -0.5), (116, 0.5), (119, 0.0))):
        whistle(at, 2, 79 + 3 * i, 96 + 3 * i, 0.09, pan)
        boom(at + 2, 0.4 + 0.04 * i, 1.0, pan)
        sparkle(at + 2.1, 2, 10, 0.05, 93 + 3 * i)
    put("bass", 112, x.tri(n("A2"), 15.5, 0.24, attack=0.05, release=0.3))
    fizz(120, 8, 0.07)
    whistle(124, 4, 74, 101, 0.11)
    for i in range(16):
        x.snare(124 + i * 0.25, 0.03 + 0.008 * i)

    # Bars 33-36: the tune's first two bars, a run, then three hits with a burst on each; the last crackle falls on
    # into bar 1.
    boom(128, 0.55, 1.4)
    x.crash(128, 0.18, decay=0.3)
    bars = TUNE.split("|")
    tune(128, "|".join(bars[:2] + bars[6:7]), bell=True)
    for bar in (32, 33, 34):
        band(bar)
    sparkle(128, 12, 30, 0.04)
    for b, d, m in line(140, END):
        put("thumb", b, wood(m + 12, 0.22, 0.2), -0.1)
        put("marimba", b, wood(m - 12, 0.24, 0.16), 0.2)
        put("bass", b, x.tri(m - 36, 0.4, 0.34, release=0.01))
        put("lead", b, x.pulse(m, 0.3, 0.25, 0.075, decay=0.1, sustain=0.5, release=0.01), 0.1)
        conga(b, False, 0.26), x.kick(b, 0.42, soft=True)
        boom(b, 0.3 + 0.1 * (b - 140) / 2, 0.6 if b < 142 else 2.2, (-0.5, 0.5, 0.0)[int(b - 140) // 1 % 3])
    sparkle(142.2, 1.8, 16)

    x.echo("sparkle", 0.75, 0.25, 0.1)
    write_wav(out, x.mixdown({"bass": 0.55, "thumb": 1.4, "hand": 1.6, "sparkle": 2.2, "voices": 1.6, "arp": 1.3, "fx": 1.3}, lowpass=9500, room=0.18))


if __name__ == "__main__":
    main(sys.argv[1])
