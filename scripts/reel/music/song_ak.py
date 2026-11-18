"""Song AK (Eric, Nov 18): the battle tower's music, a loop of exactly one minute. His brief: "a simple 1 minute
looping beat that is a slower pace designed for the new battle tower we are building, it's really just background
noise like the town song, but needs to have a more serious feel to it, slow is good here, not too many high note hits
ring out. Keep using your methods we've been using to develop this, I'll leave the rest to you. A dark eerie musical
instrument choices is a good starting point I think". No plan this time: all of it is written here, and original
(none of it is any song's or any game's).
What his words fixed:
  - One minute, and slow: 64 beats a minute, sixteen bars of four, 60.0 s.
  - A beat, simple: a deep soft kick on 1 and the "and" of 3, a dull snare on 2 and 4, and a clock's tick and tock in
    8ths, far down. It never stops (a theme to leave on shouldn't: SOUNDS.md).
  - Serious: D minor. Eight bars, twice: Dm, Bb (one note of the chord moves a half step), Gm, A7 with its flat
    ninth. The second time the reed reaches a little higher and the last bar hangs on the leading note, so the loop's
    first bar is where it lands.
  - Dark, eerie instruments, all low: a choir humming the chords ("oo", men's voices); a bass clarinet with the tune
    (never above A4); a cello answering in the tune's rests; a soft piano tolling low fifths every four bars; a round
    bass under the kick; a low drum's two beats ending each four bars.
  - "Not too many high note hits ring out": nothing rings above middle register. No bells, no chimes; the highest
    note in it is the clarinet's A4, once; the tick is short and dull; the whole mix is cut darker than the themes'.
  - Background, like the town's: the tune is long notes with bars of rest between its phrases.
  python3 song_ak.py <out.wav>

  bars  1-2   0:00  Dm: the clarinet's first phrase            bars  9-10  0:30  Dm: the phrase again, reaching higher
  bars  3-4   0:07  Bb: the cello answers                      bars 11-12  0:37  Bb: one held note, the cello under it
  bars  5-6   0:15  Gm: the clarinet                           bars 13-14  0:45  Gm: the clarinet
  bars  7-8   0:22  A7: the clarinet rises, the cello falls    bars 15-16  0:52  A7: a half step up and back; the leading note
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 64, 16
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 60.0 s
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the bass's note, the choir's four, the piano's toll.
STONE = {
    "Dm": ("D2", "D3 A3 D4 F4", "D2 A2"), "Bb": ("Bb1", "D3 Bb3 D4 F4", "Bb1 F2"), "Gm": ("G1", "D3 Bb3 D4 G4", "G2 D3"),
    "Gm6": ("G1", "E3 Bb3 D4 G4", "G2 D3"), "A7": ("A1", "C#3 Bb3 C#4 E4", "A1 E2"),
}
CHORDS = "Dm Dm Bb Bb Gm Gm A7 A7  Dm Dm Bb Bb Gm Gm6 A7 A7".split()
assert len(CHORDS) == BARS

# ---- the lines. Lengths in beats. ----
# The bass clarinet: long notes, a bar or two of rest between its phrases; never above A4.
REED = (
    "D4:1.5 E4:.5 F4:2 | E4:1 D4:1 A3:2 | -:8 | G3:1.5 A3:.5 Bb3:2 | D4:1 C4:1 Bb3:2 | A3:3 C#4:1 | E4:2 -:2 | "
    "D4:1.5 E4:.5 F4:2 | A4:1.5 G4:.5 F4:1 E4:1 | D4:4 | -:4 | G3:1.5 Bb3:.5 D4:2 | E4:1 D4:1 Bb3:2 | A3:2 Bb3:1 A3:1 | C#4:2 -:2"
)
# The cello: in the clarinet's rests, and low under it at the end.
CELLO = (
    "-:8 | Bb2:2 D3:1 F3:1 | E3:1 D3:3 | -:8 | A2:2 C#3:1 E3:1 | G3:2 F3:1 E3:1 | "
    "-:8 | Bb2:2 F3:2 | D3:2 Bb2:2 | -:8 | A2:4 | G2:2 E2:2"
)
for _line, _beats in ((REED, 64), (CELLO, 64)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The loop as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage."""
    x = Ride(RIDE, BEATS, None, os=2, seed=337, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(113)
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

    # ---- the beat ----
    def kick(b, vol=0.5):
        """Deep and soft: no click to speak of."""
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        put("kick", b, np.sin(tau * np.cumsum(52 + 75 * np.exp(-t / 0.03)) / sr) * np.exp(-t / 0.12) * np.minimum(1, t / 0.003) * tail(k, 0.03) * vol)

    def snare(b, vol=0.2):
        """Dull: a drum's low body and a short dark rustle."""
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(150 + 50 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.07) + 0.7 * hiss(k, 2600) * np.exp(-t / 0.05)
        put("snare", b, w * np.minimum(1, t / 0.002) * tail(k, 0.02) * vol, 0.05)

    def tick(b, low, vol=0.02):
        """A clock's tick (or its tock, lower): a short dull knock, no ring."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        f = 620 if low else 880
        put("tick", b, (np.sin(tau * f * t) + 0.4 * np.sin(tau * 2.4 * f * t) * np.exp(-t / 0.003)) * np.exp(-t / 0.011) * np.minimum(1, t / 0.0006) * tail(k) * vol, 0.25 if low else -0.25)

    def drum(b, vol=0.3):
        """A low drum, far off."""
        k = int(0.6 * sr)
        t = np.arange(k) / sr
        put("drum", b, np.sin(tau * np.cumsum(62 + 30 * np.exp(-t / 0.05)) / sr) * np.exp(-t / 0.22) * np.minimum(1, t / 0.004) * tail(k, 0.05) * vol, -0.15)

    def beat(bar):
        """A bar: the kick on 1 and the "and" of 3 (every other bar one more, soft, before 3); the snare on 2 and 4;
        the tick on the beat and the tock between; the low drum's two beats ending every fourth bar."""
        b = bar0(bar)
        kick(b, 0.5), kick(b + 2.5, 0.42)
        if bar % 2 == 0:
            kick(b + 1.75, 0.3)
        snare(b + 1, 0.2), snare(b + 3, 0.2)
        for i in range(8):
            tick(b + i / 2, i % 2 == 1, 0.02 if i % 2 == 0 else 0.015)
        if bar % 4 == 0:
            drum(b + 3.25, 0.26), drum(b + 3.75, 0.32)

    # ---- the voices ----
    def bass(b, m, d, vol=0.3):
        """A round bass: as much of the note's octave as of the note, and some of its twelfth, so a small speaker has it
        too (measured: with the note alone, most of the loop's energy sat under 60 Hz, where a phone plays nothing)."""
        at(b, d)
        k = x.k(d)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = 0.55 * np.sin(ph) + 0.65 * np.sin(2 * ph + 0.5) + 0.3 * np.sin(3 * ph + 1.0)
        put("bass", b, w * np.minimum(1, t / 0.015) * (0.75 + 0.25 * np.exp(-t / 0.4)) * tail(k, 0.08) * vol)

    def hum(b, m, d, vol, pan):
        """One of the choir's notes: men humming "oo": each harmonic as loud as the mouth's shape lets it be (two
        low resonances, a faint third), three voices a hair apart, a slow start and a slow end, a slight waver."""
        at(b, d)
        f0 = x.hz(m)
        hs = np.arange(1, int(3200 / f0) + 1)
        shape = (np.exp(-(((hs * f0 - 360) / 230) ** 2)) + 0.4 * np.exp(-(((hs * f0 - 820) / 260) ** 2)) + 0.07 * np.exp(-(((hs * f0 - 2400) / 500) ** 2))) / hs**0.5
        put("choir", b, x.tone(m, d, list(shape / shape.max()), vol, detune=(-9, 0, 8), vib=0.004, vib_hz=4.8, attack=0.6, release=0.7), pan)

    def choir(bar, vol=0.03):
        """A bar of the choir's chord, each note running a little into the next bar's."""
        for j, m in enumerate(n(c) for c in STONE[CHORDS[bar - 1]][1].split()):
            hum(bar0(bar), m, 4.5, vol * (1.0 if j else 1.15), (-0.5, -0.17, 0.17, 0.5)[j])

    def reed(start, text, vol=1.0):
        """The bass clarinet: a hollow tone (the odd harmonics), a soft start, the faintest waver; a note joined to
        the one before slides a hair into place."""
        last = None
        for b, d, m in notes(start, text):
            at(b, d)
            slide = last[0] - m if last and abs(b - last[1]) < 0.05 else 0
            put("reed", b, x.tone(m, d * 0.97, list(x.REED), 0.085 * vol, vib=0.003, vib_hz=4.6, scoop=-slide * 0.5, scoop_s=0.03, attack=0.07, release=0.14), 0.12)
            last = (m, b + d)

    def cello(start, text, vol=1.0):
        """The cello: a bowed string, a slow bow's start, vibrato once the note is held; joined notes slide."""
        last = None
        for b, d, m in notes(start, text):
            at(b, d)
            slide = last[0] - m if last and abs(b - last[1]) < 0.05 else 0
            put("cello", b, x.tone(m, d * 0.98, list(x.BOWED), 0.07 * vol, detune=(-3, 3), vib=0.005 if d >= 1 else 0.0, vib_hz=5.0, scoop=-slide * 0.6, scoop_s=0.04, attack=0.14, release=0.22), -0.25)
            last = (m, b + d)

    def toll(bar, vol=0.16):
        """The soft piano's low fifth, left to ring."""
        for j, m in enumerate(n(c) for c in STONE[CHORDS[bar - 1]][2].split()):
            w = x.struck("felt", m)
            put("piano", bar0(bar) + 0.02 * j, w * np.exp(-np.arange(len(w)) / sr / 1.6) * vol * (1.0 if j == 0 else 0.8), 0.1)

    for bar in range(1, BARS + 1):
        beat(bar), choir(bar)
        low = n(STONE[CHORDS[bar - 1]][0])
        bass(bar0(bar), low, 2.0), bass(bar0(bar) + 2.5, low, 1.3, 0.24)
        if bar % 4 == 1:
            toll(bar)
    reed(0, REED), cello(0, CELLO)

    # A stone hall for the choir, the clarinet, the cello and the piano; a little of it for the snare and the low drum.
    def room(name, secs=2.4, wet=0.3):
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.03)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 3000) ** 2) * (f > 120), n=size, axis=1)

    for name, secs, wet in (("choir", 2.8, 0.4), ("reed", 2.4, 0.35), ("cello", 2.4, 0.35), ("piano", 2.6, 0.4), ("snare", 1.6, 0.18), ("drum", 2.0, 0.25), ("tick", 1.2, 0.15)):
        room(name, secs, wet)
    levels = {"reed": 1.0, "cello": 1.35, "choir": 1.4, "piano": 1.3, "bass": 0.6, "kick": 1.05, "snare": 1.9, "drum": 1.0, "tick": 8.0}
    return x.play(x.mixdown(levels, lowpass=6500, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
