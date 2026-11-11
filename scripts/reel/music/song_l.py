"""Song L (Eric, Nov 11): Hollow's theme, a one-minute loop: "dark and gloomy, scary, some screeching and shattering",
with Big Boy's kind of variety, an intro of its own, and a fast pattern under layered voices.
160 beats a minute, 160 beats = 40 bars = 60.0 s. G, in a dark scale (flat second, flat fifth beside the fifth), the
whole thing sliding by minor thirds and tritones (B flat, D flat, E) and through E flat, C and A flat minor.
Voices: a pulse lead with a sawtooth an octave under it; a haunted-organ reed in stabs; a thin pulse hammering the
root between moving notes in 16ths; a triangle bass; a music-box bell; a heartbeat; wind; screeches (a thin pulse
bending up with a fast shake); glass shattering (a burst of noise and a scatter of high pings); risers; a hard kit.
Every melody, riff and chord progression here is original: none of it is any game's.
  python3 song_l.py <out.wav>

  bars  1-4    lights out: a music box on a tritone over wind, a heartbeat, a riser, a screech, glass
  bars  5-12   the tune: on G, up to B flat, back
  bars 13-20   the dark: low growls and quick high answers (G, D flat, E, F), then a creep up from the bottom
  bars 21-28   the second tune, broad: E flat minor, C minor, A flat minor, D
  bars 29-34   lights out again: the kit gone; heartbeat, creeping bass, the music box, a riser and a roll
  bars 35-38   the tune back, an octave up
  bars 39-40   a slide all the way down, three hits, glass; and round to the dark of bar 1
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 160.0
BEATS = 160
SECS = BEATS * 60 / BPM

BOX = "G5:1.5 Db6:1.5 C6:1 | Bb5:1.5 Gb5:1.5 G5:1"
TUNE = (
    "G5:1 -:.5 G5:.5 Ab5:.5 G5:.5 F5:.5 G5:.5 | Bb5:1.5 Ab5:.5 G5:1 -:.5 D5:.5 | "
    "G5:1 -:.5 G5:.5 Ab5:.5 Bb5:.5 C6:.5 Db6:.5 | D6:2 Db6:.5 C6:.5 Bb5:.5 Ab5:.5 | "
    "Bb5:1 -:.5 Bb5:.5 B5:.5 Bb5:.5 Ab5:.5 Bb5:.5 | Db6:1.5 B5:.5 Bb5:1 -:.5 F5:.5 | "
    "D6:.5 Db6:.5 C6:.5 Bb5:.5 Ab5:.5 G5:.5 F#5:.5 G5:.5 | G5:1.5 -:.5 D5:.5 F#5:.5 G5:1"
)
DARK = (
    "G2:.5 G2:.5 -:.5 Bb2:.5 Db3:.5 D3:.5 -:.5 F3:.5 | -:.5 D7:.25 Db7:.25 C7:.25 Bb6:.25 Ab6:.5 -:.5 G6:.25 Ab6:.25 Db7:.5 -:.5 | "
    "Db3:.5 Db3:.5 -:.5 E3:.5 G3:.5 Ab3:.5 -:.5 B3:.5 | -:.5 Ab6:.25 G6:.25 E6:.25 Db6:.25 E6:.5 -:.5 G6:.25 Ab6:.25 B6:.5 -:.5 | "
    "E2:.5 G2:.5 Bb2:.25 Db3:.25 -:.5 E6:.25 G6:.25 Bb6:.25 Db7:.25 -:.5 Bb6:.5 | F2:.5 Ab2:.5 B2:.25 D3:.25 -:.5 F6:.25 Ab6:.25 B6:.25 D7:.25 -:.5 B6:.5 | "
    "F#2:.25 G2:.25 Ab2:.25 A2:.25 -:.5 Bb2:.25 B2:.25 C3:.25 Db3:.25 -:.5 D3:.25 Eb3:.25 E3:.25 F3:.25 | "
    "F#3:.25 G3:.25 Ab3:.25 A3:.25 Bb3:.25 B3:.25 C4:.25 Db4:.25 D4:.5 -:.5 D5:.5 F#5:.5"
)
SECOND = (
    "Bb5:1.5 Gb5:.5 Eb5:1 F5:.5 Gb5:.5 | Ab5:1 Gb5:.5 F5:.5 Eb5:1.5 -:.5 | G5:1.5 Eb5:.5 C5:1 D5:.5 Eb5:.5 | F5:1 Eb5:.5 D5:.5 G5:1.5 -:.5 | "
    "Eb6:1.5 B5:.5 Ab5:1 Bb5:.5 B5:.5 | Db6:1 B5:.5 Bb5:.5 Eb6:1.5 -:.5 | F#6:.5 F#6:.5 G6:.5 F#6:.5 Eb6:.5 D6:.5 C6:.5 Bb5:.5 | A5:.5 Bb5:.5 C6:.5 Eb6:.5 D6:1.5 -:.5"
)
CREEP = "G2:2 Ab2:2 | G2:2 F#2:2 | G2:2 Bb2:2 | A2:2 Ab2:2 | G2:4 | G2:2 F#2:2"
END = "G6:.25 F#6:.25 F6:.25 E6:.25 Eb6:.25 D6:.25 Db6:.25 C6:.25 B5:.25 Bb5:.25 A5:.25 Ab5:.25 G5:1 | G4:.5 -:.5 Ab4:.5 -:.5 G4:.5 -:1.5"
for name, beats in [(BOX, 8), (TUNE, 32), (DARK, 32), (SECOND, 32), (CREEP, 24), (END, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# The root, bar by bar, and whether its chord is major (only D's).
ROOTS = (
    ["G2"] * 8 + ["Bb2"] * 2 + ["G2"] * 2  # bars 1-12
    + ["G2"] * 2 + ["Db3"] * 2 + ["E2", "F2"] + ["G2"] * 2  # 13-20
    + ["Eb3"] * 2 + ["C3"] * 2 + ["Ab2"] * 2 + ["D3"] * 2  # 21-28
    + ["G2"] * 12  # 29-40
)
assert len(ROOTS) == 40
UNDER = (0, 3, 0, 6, 0, 7, 0, 6, 0, 3, 0, 8, 0, 7, 0, 1)  # the fast pattern: the root hammered between moving notes


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=113)
    put = x.put
    rng = np.random.default_rng(7)

    def saw(m, beats, vol):
        return x.add(m, beats, x.SAW, vol, detune=(-6, 6), attack=0.012, sustain=0.8, decay=0.2, release=0.03)

    def screech(b, m=93, secs=0.5, vol=0.09, pan=0.3):
        """A thin pulse bending up half an octave with a fast shake, and hiss."""
        k = int(secs * x.sr)
        t = np.arange(k) / x.sr
        f = x.hz(m) * 2 ** (6 * (t / secs) ** 2 / 12) * (1 + 0.035 * np.sin(2 * np.pi * 27 * t))
        w = np.where((np.cumsum(f) / x.sr) % 1 < 0.125, 1.0, -1.0) + 0.5 * rng.uniform(-1, 1, k)
        env = np.minimum(1, t / 0.03) * (0.4 + 0.6 * t / secs) * np.minimum(1, (secs - t) / 0.04)
        put("fx", b, w * env * vol, pan)

    def shatter(b, vol=0.2):
        """Glass: a burst of bright noise and a scatter of high pings falling away."""
        put("fx", b, x.noise(0.25, 24000, vol, 0.05))
        for i in range(16):
            k = int(0.25 * x.sr)
            t = np.arange(k) / x.sr
            hz = rng.uniform(2400, 7500)
            ping = (np.sin(2 * np.pi * hz * t) + 0.5 * np.sin(2 * np.pi * hz * 1.52 * t)) * np.exp(-t / rng.uniform(0.02, 0.07))
            put("fx", b + rng.uniform(0, 0.45) ** 1.5 / x.beat_s, ping * vol * rng.uniform(0.2, 0.5) * np.minimum(1, t / 0.0005), rng.uniform(-0.7, 0.7))

    def riser(b, beats, vol=0.12, m=43, up=24):
        """A sawtooth sliding up two octaves, swelling, with a breath of noise."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        f = x.hz(m) * 2 ** (up * u / 12)
        ph = np.cumsum(f) / x.sr
        put("fx", b, (2 * (ph % 1) - 1) * u**2 * vol, -0.2)
        put("fx", b, rng.uniform(-1, 1, k) * u**3 * vol * 0.5, 0.2)

    def heart(b, vol=0.5):
        x.kick(b, vol, soft=True), x.kick(b + 0.5, vol * 0.7, soft=True)

    def box(start, text, vol=0.13, up=0):
        for b, d, m in line(start, text):
            put("box", b, x.bell(m + up, d + 1.5, vol, ratio=3.5, index=1.8, decay=0.6), 0.2)

    def under(bar, vol=0.075):
        root = n(ROOTS[bar]) + 24
        for i in range(16):
            put("arp", bar * 4 + i * 0.25, x.pulse(root + UNDER[i] + (12 if UNDER[i] else 0), 0.2, 0.125, vol, decay=0.04, sustain=0.4, release=0.004), -0.3)

    def organ(bar, pattern=(0, 0.75, 1.5, 2.5, 3.25), vol=0.075, hold=None):
        root = n(ROOTS[bar]) + 24
        third = 4 if ROOTS[bar] == "D3" else 3
        for o in [0] if hold else pattern:
            for j, up in enumerate((0, third, 7)):
                put("organ", bar * 4 + o, x.reed(root + up, hold or 0.4, vol), (-0.4, 0.0, 0.4)[j])

    def bass(bar, vol=0.34):
        root = n(ROOTS[bar])
        for i in range(8):
            put("bass", bar * 4 + i * 0.5, x.tri(root + (12 if i in (3, 6) else 0), 0.41, vol, release=0.006))

    def kit(bar, sixteenths=True):
        b = bar * 4
        for o in (0, 1.5, 2, 3.5):
            x.kick(b + o, 0.5 if o == int(o) else 0.36)
        x.snare(b + 1, 0.22), x.snare(b + 3, 0.22)
        for i in range(16 if sixteenths else 8):
            o = i * (0.25 if sixteenths else 0.5)
            x.hat(b + o, 0.06 if o == int(o) else 0.035)

    def lead(start, text, up=0, vol=1.0):
        """The pulse lead (vibrato on held notes) with a sawtooth an octave under it."""
        for b, d, m in line(start, text):
            put("lead", b, x.pulse(m + up, d * 0.92, 0.25, 0.17 * vol, vib=0.012 if d >= 1 else 0.0, decay=0.25, sustain=0.62, release=0.008), -0.12)
            put("saw", b, saw(m + up - 12, d * 0.92, 0.1 * vol), 0.2)

    def wide(t, text):
        """A line across the whole range: low notes growl on sawtooth and triangle, high ones on a thin pulse and the
        music box; a glass tick in each gap."""
        for tok in text.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name == "-":
                put("fx", t, x.bell(n("B7"), 0.4, 0.04, ratio=1.52, index=1.0, decay=0.06), 0.4)
            else:
                m = n(name)
                if m < 60:
                    put("saw", t, saw(m, d * 0.85, 0.2), -0.1)
                    put("bass", t, x.tri(m, d * 0.85, 0.3, release=0.01))
                else:
                    put("lead", t, x.pulse(m, d * 0.8, 0.125, 0.13, decay=0.1, sustain=0.5, release=0.01), 0.1)
                    put("box", t, x.bell(m, 0.8, 0.05, ratio=3.5, index=1.8, decay=0.2), 0.35)
            t += d

    def roll(at, steps, step=0.25, v0=0.06, dv=0.012):
        for i in range(steps):
            x.snare(at + i * step, v0 + dv * i)

    # Bars 1-4: lights out. A music box on a tritone over wind and a held low G; a heartbeat from bar 2; the fast
    # pattern ticking in from bar 3; a riser through bar 4, a screech, and glass on bar 5.
    put("wind", 0, x.rumble(16, 0.16, hold=60), -0.3)
    put("wind", 4, x.rumble(12, 0.12, hold=25), 0.3)
    put("bass", 0, x.tri(n("G2"), 15.5, 0.2, attack=0.5, release=0.3))
    box(0, BOX)
    box(8, BOX, 0.09, up=12)
    for b in (4, 6, 8, 10, 12, 13, 14, 14.5, 15, 15.5):
        heart(b, 0.42) if b < 13 else x.kick(b, 0.45, soft=True)
    under(2, 0.03), under(3, 0.055)
    riser(12, 4)
    screech(14.6, 91, 0.5, 0.1)
    shatter(16)

    # Bars 5-12: the tune.
    x.crash(16, 0.26)
    lead(16, TUNE)
    for bar in range(4, 12):
        under(bar), organ(bar), bass(bar), kit(bar)
    screech(31, 93, 0.35, 0.07), roll(47, 4, 0.25, 0.12, 0.03)

    # Bars 13-20: the dark. No organ; a kick, hats and the growls; the fast pattern only behind the high answers and
    # the creep; a screech after each answer, glass on the E and F bars.
    x.crash(48, 0.2)
    wide(48.0, DARK)
    for bar in range(12, 20):
        b = bar * 4
        x.kick(b, 0.5), x.kick(b + 2, 0.45)
        for i in range(8):
            x.hat(b + i * 0.5, 0.05)
        if bar in (13, 15):
            under(bar), x.snare(b + 1, 0.2), x.snare(b + 3, 0.2)
            put("bass", b, x.tri(n(ROOTS[bar]), 3.6, 0.3, release=0.02))
            screech(b + 3.5, 95, 0.3, 0.07, -0.3)
        if bar >= 18:
            under(bar, 0.06)
    shatter(64, 0.16), shatter(68, 0.16)
    roll(72, 32, 0.25, 0.03, 0.006)

    # Bars 21-28: the second tune, broad, the organ holding whole bars and the music box on top.
    x.crash(80, 0.26)
    lead(80, SECOND)
    box(80, SECOND, 0.05, up=12)
    for bar in range(20, 28):
        under(bar), organ(bar, hold=3.9, vol=0.06), bass(bar), kit(bar, sixteenths=False)
    screech(111, 93, 0.4, 0.08), roll(111, 4, 0.25, 0.12, 0.03)

    # Bars 29-34: lights out again. The kit gone: heartbeat, a creeping bass, the music box, the pattern ticking
    # quietly; then a riser, a roll and a screech into the tune.
    shatter(112, 0.2)
    put("wind", 112, x.rumble(24, 0.14, hold=40), 0.2)
    for b, d, m in line(112, CREEP):
        put("bass", b, x.tri(m, d * 0.97, 0.32, release=0.02))
        put("saw", b, saw(m + 12, d * 0.97, 0.05), 0.3)
    box(112, BOX), box(120, BOX, 0.1, up=12), box(128, BOX.split("|")[0], 0.1)
    for bar in range(28, 34):
        under(bar, 0.035 + 0.006 * (bar - 28))
        heart(bar * 4), heart(bar * 4 + 2) if bar >= 31 else None
    riser(128, 8, 0.13)
    roll(132, 16, 0.25, 0.03, 0.012)
    screech(134.6, 91, 0.5, 0.1)

    # Bars 35-38: the tune's first four bars back, an octave up over itself.
    shatter(136, 0.18)
    x.crash(136, 0.26)
    first = "|".join(TUNE.split("|")[:4])
    lead(136, first)
    lead(136, first, up=12, vol=0.55)
    for bar in range(34, 38):
        under(bar), organ(bar), bass(bar), kit(bar)

    # Bars 39-40: the slide down, three hits, glass, and a last screech falling into the dark.
    x.crash(152, 0.2)
    lead(152, END.split("|")[0])
    under(38), bass(38), kit(38)
    for b, d, m in line(156, END.split("|")[1]):
        put("bass", b, x.tri(m - 24, 0.4, 0.36, release=0.01))
        put("saw", b, saw(m - 12, 0.4, 0.2))
        put("lead", b, x.pulse(m, 0.4, 0.25, 0.17, decay=0.1, sustain=0.5, release=0.01))
        for j, up in enumerate((0, 3, 6)):
            put("organ", b, x.reed(m + up, 0.4, 0.08), (-0.4, 0.0, 0.4)[j])
        x.kick(b, 0.5), x.snare(b, 0.2)
    shatter(158, 0.22)
    screech(158.3, 96, 0.6, 0.07, -0.2)

    x.echo("box", 0.75, 0.3, 0.14)
    x.echo("fx", 0.75, 0.2, 0.08)
    x.echo("lead", 0.75, 0.12, 0.05)
    write_wav(out, x.mixdown({"bass": 0.6, "fx": 2.0, "arp": 1.4, "organ": 1.3, "box": 1.5, "wind": 2.0}, lowpass=8500, room=0.2))


if __name__ == "__main__":
    main(sys.argv[1])
