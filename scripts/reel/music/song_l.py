"""Song L (Eric, Nov 11): Hollow's theme, a one-minute loop: "dark and gloomy, scary, some screeching and shattering",
with Big Boy's kind of variety, an intro of its own, and a fast pattern under layered voices.
160 beats a minute, 320 beats = 80 bars = 120.0 s (the one-minute loop was bars 1-38 and 79-80). G, in a dark scale (flat second, flat fifth beside the fifth), the
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
  bars 39-46   the lash, a third tune: quick turns and stabs on G, D flat, B flat, E (0:57)
  bars 47-54   lights out, the long one: a new creeping bass, the music box turned about, far-off voices, a riser
  bars 55-62   the dark again, a minor third up
  bars 63-70   the second tune, bigger
  bars 71-78   the tune whole, an octave up over itself
  bars 79-80   a slide all the way down, three hits, glass; and round to the dark of bar 1

The longer song (Eric, Nov 26: the two-minute themes brought up to about 2:30 to 2:40, this one first; "I don't want the
song that's already there to be messed with ... adding one more verse ... I don't want a verse that doesn't hit right.
I also don't want like repeated exact verse or sound that's already been used"). MORE bars of new music go in after
bar 70; bars 1 to 70 are as they were, and the last ten (the tune whole, and the ending) are as they were, 36 s later.
HOLLOW_MORE=24 in the environment renders it (0, the two-minute song, until he passes the longer one).
The second go. Of the first, whose new bars opened with a bar of hush and then eight at half pace (an 808, a wobbling
bass, a low driven lead's slow tune): "that first part of the transition, it just doesn't sound great ... there's like
a smashing sound that's good ... other than that, it's just like too dull. It feels off ... like it was thrown in ...
maybe reuse a bit more of the main score, the main ideas of the song ... that stuff that hits like at 157 ... can be
blended in a bit more"; the limp and the climb he passed ("156 onward is good"). So the half-pace bars are gone: the
smash stays, and the new bars open at full pace on the song's own tune, with the limp's shapes answering it:

  bars 71-78   the turn: a smash (glass, a crash, a boom), and the tune's own first two bars at once; the limp's
               shapes answer them; the tune's two bars again a half step down (F sharp), and the limp's shapes on F
  bars 79-86   the limp: a motif five 8ths long on the lead, so it starts somewhere new in every bar, over the kit
               at full pace; the floor goes on sinking (E, E flat, D, D flat); a low driven lead joins it halfway
  bars 87-94   the climb: a slow tune on both leads, on B flat, then up a step (C) and another (D), a riser and a
               roll, into the tune whole
  bars 95-104  the two-minute song's bars 71 to 80
"""
import os
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 160.0
MORE = int(os.environ.get("HOLLOW_MORE", "0"))  # bars of new music after bar 70 (24: the longer song; 0: the two-minute one)
BEATS = 320 + 4 * MORE
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
# ---- the second minute (Eric, Nov 11: two minutes; "the part from 42-51 sec ... make sure that is included again
# in the 2 min version or a variation": the second lights-out, here as bars 47-54) ----
# A third tune, the lash: quick turns and stabs, on G, D flat, B flat and E.
LASH = (
    "G5:.25 Ab5:.25 Bb5:.25 Ab5:.25 G5:.5 -:.5 D6:.5 Db6:.5 C6:.5 -:.5 | Bb5:.25 C6:.25 Db6:.25 C6:.25 Bb5:.5 -:.5 G6:1 F6:.5 Eb6:.5 | "
    "Db6:.25 D6:.25 E6:.25 D6:.25 Db6:.5 -:.5 Ab6:.5 G6:.5 Gb6:.5 -:.5 | E6:.5 Gb6:.5 Ab6:1 -:.5 B6:.5 Ab6:.5 E6:.5 | "
    "F6:1 -:.5 F6:.25 Gb6:.25 Ab6:.5 Gb6:.5 F6:.5 Eb6:.5 | Db6:.5 Eb6:.5 -:.5 Bb5:.5 B5:.5 Db6:.5 F6:1 | "
    "E6:.5 E6:.5 F6:.5 G6:.5 -:.5 Bb6:.5 A6:.5 G6:.5 | F6:.25 G6:.25 A6:.25 Bb6:.25 B6:1 -:.5 B6:.25 C7:.25 D7:1"
)
# Lights out, the long one: a new creeping bass and the music box's tritones turned about.
CREEP2 = "G2:2 Ab2:2 | G2:2 F#2:2 | Bb2:2 A2:2 | Ab2:2 G2:2 | Db3:2 C3:2 | B2:2 Bb2:2 | A2:2 Ab2:2 | G2:2 F#2:2"
BOX2 = "D6:1.5 Ab5:1.5 G5:1 | Bb5:1.5 E6:1.5 Eb6:1"
BOX3 = "Db6:1.5 G5:1.5 Ab5:1 | E6:1.5 Bb5:1.5 A5:1"
END = "G6:.25 F#6:.25 F6:.25 E6:.25 Eb6:.25 D6:.25 Db6:.25 C6:.25 B5:.25 Bb5:.25 A5:.25 Ab5:.25 G5:1 | G4:.5 -:.5 Ab4:.5 -:.5 G4:.5 -:1.5"
# ---- the longer song's new bars (71-94) ----
# The turn (bars 71-78): the tune's first two bars; the limp's shapes (below) in answer; the tune's two bars a half
# step down; the limp's shapes on F.
TURN = (
    "G5:1 -:.5 G5:.5 Ab5:.5 G5:.5 F5:.5 G5:.5 | Bb5:1.5 Ab5:.5 G5:1 -:.5 D5:.5 | "
    "G5:.5 Ab5:.5 G5:.5 D5:1 Bb5:.5 Ab5:.5 G5:.5 | Db6:1 D6:.5 Db6:.5 Bb5:.5 G5:1 -:.5 | "
    "F#5:1 -:.5 F#5:.5 G5:.5 F#5:.5 E5:.5 F#5:.5 | A5:1.5 G5:.5 F#5:1 -:.5 C#5:.5 | "
    "F5:.5 Gb5:.5 F5:.5 C5:1 Ab5:.5 Gb5:.5 F5:.5 | B5:1 C6:.5 B5:.5 Ab5:.5 F5:1.5"
)
# The limp (bars 79-86): a motif five 8ths long (three 8ths and a quarter), three shapes of it in turn: half steps
# over the bar's root.
LIMP = ((0, 1, 0, -5), (3, 1, 0, 6), (7, 6, 3, 0))
# The climb (bars 87-94): a slow tune that rises a tritone and falls back, on B flat; its shape a step higher, and again on D.
CLIMB = (
    "Bb3:1.5 Db4:.5 E4:2 | F4:1 E4:1 Db4:1.5 B3:.5 | Bb3:1.5 Db4:.5 E4:1 F4:1 | Ab4:2 F4:1 E4:1 | "
    "C4:1.5 Eb4:.5 Gb4:2 | G4:1 Gb4:1 Eb4:1.5 Db4:.5 | D4:1.5 F#4:.5 A4:2 | C5:1 Bb4:1 A4:.5 F#4:.5 D4:1"
)
MORE_ROOTS = ["G2"] * 4 + ["F#2"] * 2 + ["F2"] * 2 + ["E3"] * 2 + ["Eb3"] * 2 + ["D3"] * 2 + ["Db3"] * 2 + ["Bb2"] * 4 + ["C3"] * 2 + ["D3"] * 2
assert MORE in (0, len(MORE_ROOTS))
for name, beats in [(BOX, 8), (TUNE, 32), (DARK, 32), (SECOND, 32), (CREEP, 24), (END, 8), (LASH, 32), (CREEP2, 32), (BOX2, 8), (BOX3, 8), (TURN, 32), (CLIMB, 32)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# The root, bar by bar, and whether its chord is major (only D's).
ROOTS = (
    ["G2"] * 8 + ["Bb2"] * 2 + ["G2"] * 2  # bars 1-12
    + ["G2"] * 2 + ["Db3"] * 2 + ["E2", "F2"] + ["G2"] * 2  # 13-20
    + ["Eb3"] * 2 + ["C3"] * 2 + ["Ab2"] * 2 + ["D3"] * 2  # 21-28
    + ["G2"] * 10  # 29-38
    + ["G2"] * 2 + ["Db3"] * 2 + ["Bb2"] * 2 + ["E2"] * 2  # 39-46, the lash
    + ["G2"] * 8  # 47-54, lights out, the long one
    + ["Bb2"] * 2 + ["E3"] * 2 + ["G2", "Ab2"] + ["Bb2"] * 2  # 55-62, the dark, a minor third up
    + ["Eb3"] * 2 + ["C3"] * 2 + ["Ab2"] * 2 + ["D3"] * 2  # 63-70, the second tune, bigger
    + MORE_ROOTS[:MORE]  # (the longer song's new bars)
    + ["G2"] * 4 + ["Bb2"] * 2 + ["G2"] * 2  # 71-78, the tune whole, an octave up over itself
    + ["G2"] * 2  # 79-80, the ending
)
assert len(ROOTS) == 80 + MORE
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

    def wide(t, text, up=0):
        """A line across the whole range: low notes growl on sawtooth and triangle, high ones on a thin pulse and the
        music box; a glass tick in each gap."""
        for tok in text.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name == "-":
                put("fx", t, x.bell(n("B7"), 0.4, 0.04, ratio=1.52, index=1.0, decay=0.06), 0.4)
            else:
                m = n(name) + up
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

    def dark(first):
        """Under the dark: a kick and hats; behind each high answer the fast pattern, a snare, a held bass and a screech;
        glass on its fifth and sixth bars; the fast pattern and a growing roll under the creep."""
        for bar in range(first, first + 8):
            b = bar * 4
            x.kick(b, 0.5), x.kick(b + 2, 0.45)
            for i in range(8):
                x.hat(b + i * 0.5, 0.05)
            if bar - first in (1, 3):
                under(bar), x.snare(b + 1, 0.2), x.snare(b + 3, 0.2)
                put("bass", b, x.tri(n(ROOTS[bar]), 3.6, 0.3, release=0.02))
                screech(b + 3.5, 95, 0.3, 0.07, -0.3)
            if bar - first >= 6:
                under(bar, 0.06)
        shatter((first + 4) * 4, 0.16), shatter((first + 5) * 4, 0.16)
        roll((first + 6) * 4, 32, 0.25, 0.03, 0.006)

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
    dark(12)

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

    def wail(b, beats, m0, m1, vol=0.05, pan=0.0):
        """A far-off voice: a soft tone sliding down, trembling."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / x.sr
        f = x.hz(m0 + (m1 - m0) * u) * (1 + 0.01 * np.sin(2 * np.pi * 5.5 * t))
        ph = 2 * np.pi * np.cumsum(f) / x.sr
        put("fx", b, (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.sin(np.pi * u) ** 2 * (1 + 0.3 * np.sin(2 * np.pi * 9 * t)) * vol, pan)

    # Bars 39-46: the lash. Quick turns on the lead, the organ stabbing, glass on each new root, screeches.
    shatter(152, 0.18)
    x.crash(152, 0.26)
    lead(152, LASH)
    for bar in range(38, 46):
        under(bar), organ(bar, pattern=(0, 0.5, 1.5, 2, 3, 3.5)), bass(bar), kit(bar)
    shatter(160, 0.14), shatter(168, 0.14), shatter(176, 0.14)
    screech(159, 95, 0.3, 0.07, -0.3), screech(175, 93, 0.35, 0.07), screech(183, 96, 0.4, 0.08, -0.2)

    # Bars 47-54: lights out, the long one (the stretch Eric liked, again and further). The kit gone: heartbeat, a
    # new creeping bass, the music box's tritones turned about, far-off voices sliding down, the pattern ticking up
    # from nothing; then a riser, a roll and a screech.
    shatter(184, 0.2)
    put("wind", 184, x.rumble(32, 0.14, hold=40), 0.2)
    put("wind", 200, x.rumble(16, 0.12, hold=25), -0.3)
    for b, d, m in line(184, CREEP2):
        put("bass", b, x.tri(m, d * 0.97, 0.32, release=0.02))
        put("saw", b, saw(m + 12, d * 0.97, 0.05), 0.3)
    box(184, BOX2), box(192, BOX, 0.1, up=12), box(200, BOX3), box(208, BOX.split("|")[0], 0.1)
    wail(190, 4, 86, 80, 0.05, -0.4), wail(198, 4, 89, 83, 0.05, 0.4), wail(204, 4, 92, 86, 0.06, -0.2)
    for bar in range(46, 54):
        under(bar, 0.025 + 0.006 * (bar - 46))
        heart(bar * 4), heart(bar * 4 + 2) if bar >= 50 else None
    screech(199, 98, 0.3, 0.04, 0.5)
    riser(208, 8, 0.13)
    roll(212, 16, 0.25, 0.03, 0.012)
    screech(214.6, 91, 0.5, 0.1)

    # Bars 55-62: the dark again, a minor third up.
    shatter(216, 0.18)
    x.crash(216, 0.2)
    wide(216.0, DARK, up=3)
    dark(54)

    # Bars 63-70: the second tune, bigger: an octave up over itself, the full kit.
    x.crash(248, 0.26)
    lead(248, SECOND)
    lead(248, SECOND, up=12, vol=0.5)
    box(248, SECOND, 0.05, up=12)
    for bar in range(62, 70):
        under(bar), organ(bar, hold=3.9, vol=0.06), bass(bar), kit(bar)
    screech(279, 93, 0.4, 0.08), roll(279, 4, 0.25, 0.12, 0.03)

    # Bars 71-78: the tune whole, an octave up over itself, glass and screeches around it. (In the longer song these
    # and the ending come J beats later, after the new bars.)
    J = 4 * MORE
    shatter(280 + J, 0.2)
    x.crash(280 + J, 0.26)
    lead(280 + J, TUNE)
    lead(280 + J, TUNE, up=12, vol=0.55)
    for bar in range(70 + MORE, 78 + MORE):
        under(bar), organ(bar), bass(bar), kit(bar)
    screech(295 + J, 93, 0.35, 0.07), shatter(296 + J, 0.14), screech(303 + J, 95, 0.3, 0.07, -0.3), shatter(304 + J, 0.14)

    # Bars 79-80: the slide down, three hits, glass, and a last screech falling into the dark.
    x.crash(312 + J, 0.2)
    lead(312 + J, END.split("|")[0])
    under(78 + MORE), bass(78 + MORE), kit(78 + MORE)
    for b, d, m in line(316 + J, END.split("|")[1]):
        put("bass", b, x.tri(m - 24, 0.4, 0.36, release=0.01))
        put("saw", b, saw(m - 12, 0.4, 0.2))
        put("lead", b, x.pulse(m, 0.4, 0.25, 0.17, decay=0.1, sustain=0.5, release=0.01))
        for j, up in enumerate((0, 3, 6)):
            put("organ", b, x.reed(m + up, 0.4, 0.08), (-0.4, 0.0, 0.4)[j])
        x.kick(b, 0.5), x.snare(b, 0.2)
    shatter(318 + J, 0.22)
    screech(318.3 + J, 96, 0.6, 0.07, -0.2)

    # ---- the longer song's new bars. (Made last, after everything above, so the two-minute song's own notes and
    # noises come out as they always did.) ----
    def sub(b, m, beats, vol=0.5):
        """The 808: a deep note that drops into its pitch, driven so small speakers hear it."""
        k = x.k(beats)
        t = np.arange(k) / x.sr
        ph = 2 * np.pi * np.cumsum(x.hz(m) * 2 ** (np.exp(-t / 0.012))) / x.sr
        env = np.exp(-t / (beats * x.beat_s * 0.6)) * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr))
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def low(start, text, vol=1.0, pan=0.1):
        """The new voice: a low driven lead (three sawtooths a hair apart, driven hard, each note opening bright)."""
        for b, d, m in line(start, text):
            put("grit", b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def turn(first):
        """Bars 71-78. A smash where the second tune ends: glass, a crash and one deep boom. Then the band as it is
        under the tune (the kit, the bass, the fast pattern, the organ's stabs), and on the lead the tune's first two
        bars, the limp's shapes answering, the tune's two bars a half step down, the limp's shapes on F; glass on
        each new root; a roll and a screech into the limp."""
        b0 = first * 4
        shatter(b0, 0.2), x.crash(b0, 0.26)
        sub(b0, n("G2"), 2.5, 0.5)
        lead(b0, TURN)
        for bar in range(first, first + 8):
            under(bar), organ(bar), bass(bar), kit(bar)
        shatter(b0 + 16, 0.14), shatter(b0 + 24, 0.14)
        screech(b0 + 15, 93, 0.35, 0.07), screech(b0 + 23, 95, 0.3, 0.07, -0.3)
        roll(b0 + 30, 8, 0.25, 0.06, 0.02)
        screech(b0 + 31.4, 91, 0.4, 0.09)

    def limp(first):
        """Bars 79-86. The kit at full pace, the bass and the fast pattern; the lead's five-8th motif, twelve times,
        the organ stabbing where each starts; from the seventh the low lead under it, and the last four an octave up;
        a held note, a roll and a screech into the climb."""
        b0 = first * 4
        x.crash(b0, 0.26)
        for bar in range(first, first + 8):
            under(bar), bass(bar), kit(bar)
        for r in range(12):
            b = b0 + 2.5 * r
            root = n(ROOTS[int(b // 4)]) + 24 + (12 if r >= 8 else 0)
            for j, up in enumerate((0, 3, 7)):
                put("organ", b, x.reed(root - (12 if r >= 8 else 0) + up, 0.4, 0.075), (-0.4, 0.0, 0.4)[j])
            t = b
            for up, d in zip(LIMP[r % 3], (0.5, 0.5, 0.5, 1.0)):
                put("lead", t, x.pulse(root + up, d * 0.92, 0.25, 0.17, vib=0.012 if d >= 1 else 0.0, decay=0.25, sustain=0.62, release=0.008), -0.12)
                put("saw", t, saw(root + up - 12, d * 0.92, 0.1), 0.2)
                if r >= 6:
                    put("grit", t, x.gritty(root + up - (24 if r >= 8 else 12), d * 0.92, 0.15), 0.3)
                t += d
        top = n(ROOTS[first + 7]) + 36
        put("lead", b0 + 30, x.pulse(top, 1.9, 0.25, 0.17, vib=0.012, decay=0.25, sustain=0.62, release=0.008), -0.12)
        put("saw", b0 + 30, saw(top - 12, 1.9, 0.1), 0.2)
        roll(b0 + 28, 16, 0.25, 0.03, 0.012)
        screech(b0 + 30.6, 91, 0.5, 0.1)

    def climb(first):
        """Bars 87-94. Everything in, an 808 on each bar: a slow tune on the low lead with the lead an octave over
        it, on B flat; its shape again on C, and on D (the one bright chord); a riser, a roll and a screech into the
        tune whole."""
        b0 = first * 4
        shatter(b0, 0.18), x.crash(b0, 0.26)
        for bar in range(first, first + 8):
            under(bar), organ(bar, pattern=(0, 1.5, 2.5)), bass(bar), kit(bar)
            sub(bar * 4, n(ROOTS[bar]), 1.6, 0.4)
        low(b0, CLIMB)
        lead(b0, CLIMB, up=12, vol=0.9)
        riser(b0 + 24, 8, 0.13)
        roll(b0 + 28, 16, 0.25, 0.03, 0.012)
        screech(b0 + 30.6, 91, 0.5, 0.1)

    if MORE:
        dice = x.rng.bit_generator.state  # (the mix's own random numbers are put back after, so the hall is the same one)
        turn(70), limp(78), climb(86)
        x.echo("grit", 0.75, 0.12, 0.05)
        x.rng.bit_generator.state = dice

    x.echo("box", 0.75, 0.3, 0.14)
    x.echo("fx", 0.75, 0.2, 0.08)
    x.echo("lead", 0.75, 0.12, 0.05)
    write_wav(out, x.mixdown({"bass": 0.6, "fx": 2.0, "arp": 1.4, "organ": 1.3, "box": 1.5, "wind": 2.0, "sub": 0.5, "grit": 1.0}, lowpass=8500, room=0.2))


if __name__ == "__main__":
    main(sys.argv[1])
