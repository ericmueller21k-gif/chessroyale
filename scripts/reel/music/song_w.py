"""Song W (Eric, Nov 12): the Hidden Boss's house when he was a child: a one-minute loop for that place in the game.
His direction, after choosing the instruments of the boss song's memory by ear (song_v.py, 1:39): "can you make just a
version of this that's basically on loop, just that soft, cozy thing? Because when we're making his house in the game
... it can just be like a 1-minute loop ... that doesn't do any of the crazy like spiraling stuff at the end, just a
nice soft because it's like his house as a child, so yeah, it should feel just nice and cozy ... if you can even somehow
incorporate a little bit of the music box in softly too with it on both versions, that would be sick. 'Cause I really
do like that music box."
So: the memory by itself, and nothing going wrong in it. G major, 64 beats a minute (a clock's tick a beat), 16 bars
of four, 60 s. The same tune (the boss song's last theme as a child would have it: `CHILD`), chords (`MEMORY_CH`,
twice) and instruments (synth.py: the ocarina he picked for the tune, the soft piano he picked to roll the chords, the
music box), the small organ holding the chords, and the same tape, wavering a little. He is indoors: a clock on the
wall, a chess piece put down now and then, birds outside the window. No drums, no bass but the piano's low note.
The second half turns it over so the minute isn't thirty seconds twice: the music box takes the tune's first phrase
and the ocarina holds long notes under it, then the ocarina answers with a new phrase (the tune's rhythm, coming
down where the tune went up) whose last note leads back to the start.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_w.py <out.wav>

  0:00  the tune on the ocarina over the piano's rolling chords; the music box, two or three high notes a bar
  0:30  the music box has the tune's first phrase; the ocarina holds long notes under it
  0:45  the ocarina's answer, coming down; its last bar leads back to the start
"""
import sys

import numpy as np

from song_r import beats, notes
from song_v import CHILD, MEMORY_CH
from synth import Ride, write_wav

BPM, BARS = 64, 16
BEATS = 4 * BARS
SECS = BEATS * 60 / BPM  # 60.0: the tape's length (as heard it's the same to a few thousandths: the waver evens out)
# The second half. The music box: the tune's first phrase (its first sixteen beats).
BOX_TUNE = " ".join(CHILD.replace("|", " ").split()[:13])
# The ocarina under it: long notes, stepping up, after a bar's rest.
UNDER = "-:4 B4:4 | D5:4 | D5:2 A4:2"
# The ocarina's answer: the tune's rhythm (one, one, three, two halves, two), coming down; then home by step.
ANSWER = "B5:1 A5:1 G5:3 E5:.5 G5:.5 E5:2 | D5:1 E5:1 G5:2 | F#5:2 E5:1 D5:1"
assert (beats(BOX_TUNE), beats(UNDER), beats(ANSWER)) == (16, 16, 16)


def render() -> np.ndarray:
    """The loop as heard (stereo, at the mix's own level)."""
    x = Ride([(0, BEATS, BPM, BPM, 1.0, 1.0, 0.003)], BEATS, None, os=2, seed=61, tape_secs=SECS)
    put, at, sr, rng, tau = x.put, x.at, x.sr, np.random.default_rng(1943), 2 * np.pi

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        return np.repeat(r[1:] - hp * r[:-1], hold)[:k]

    def ocarina(b, d, m, vol=0.06, pan=0.2):
        at(b, d)
        put("tune", b, x.ocarina(m, d * 0.98, vol), pan)

    def keys(b, m, vol=0.08, pan=0.0):
        put("keys", b, x.struck("felt", m) * vol, pan)

    def box(b, m, vol=0.035, pan=0.4):
        put("box", b, x.struck("box", m) * vol, pan)

    def organ(b, d, m, vol=0.022):
        """A small organ's flutes: soft, steady."""
        at(b, d)
        put("pads", b, x.tone(m, d, [1, 0.45, 0.12, 0.2, 0.04, 0.06], vol, detune=(-3, 3), attack=0.15, release=0.3))

    def tick(b, vol, high):
        """The clock on the wall: a tick, or (lower, on the other side) a tock."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        f = 2600 if high else 1750
        w = np.sin(tau * f * t) + 0.5 * np.sin(tau * 2.3 * f * t + 1) + 0.6 * hiss(k, 14000, 0.7) * np.exp(-t / 0.0015)
        put("clock", b, w * np.exp(-t / 0.006) * np.minimum(1, t / 0.0003) * tail(k) * vol, 0.35 if high else -0.35)

    def bird(b, vol, pan):
        """A bird outside: two to four quick notes, each a little sweep."""
        late = 0.0
        for _ in range(rng.integers(2, 5)):
            secs = rng.uniform(0.05, 0.11)
            k = int(secs * sr)
            u = np.linspace(0, 1, k)
            f0, f1 = rng.uniform(3000, 5200), rng.uniform(3000, 5200)
            ph = tau * np.cumsum(f0 + (f1 - f0) * u + 250 * np.sin(tau * rng.uniform(18, 35) * u * secs)) / sr
            put("yard", b, np.sin(ph) * np.maximum(0, np.sin(np.pi * u)) ** 0.7 * vol, pan, late=late)
            late += secs + rng.uniform(0.02, 0.09)

    def clack(b, vol=0.04, pan=-0.1):
        """A chess piece put down on a wooden board."""
        k = int(0.08 * sr)
        t = np.arange(k) / sr
        put("clock", b, (np.sin(tau * 430 * t) + 0.6 * np.sin(tau * 1150 * t) + 0.5 * hiss(k, 5000, 0.3) * np.exp(-t / 0.002)) * np.exp(-t / 0.012) * tail(k) * vol, pan)

    def room(name, secs=2.5, wet=0.4):
        """A room's echo for a voice (on the whole loop, so it carries over the loop point)."""
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.03)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 4000) ** 2) * (f > 150), n=size, axis=1)

    # The chords, all the way through: the piano rolls them, the organ holds them.
    for bar in range(BARS):
        b, shape = 4 * bar, MEMORY_CH[bar % 8]
        for i, m in enumerate(shape):
            keys(b + i * 0.5, m, 0.1 if i == 0 else 0.08, -0.25 + 0.06 * i)
        for m in shape[2:5]:
            organ(b, 4.1, m)
        if not 8 <= bar < 12:  # the music box's own high notes, where it hasn't the tune
            for over, which in ((1.5, 4), (3, 4), (3.5, 3)) if bar % 2 == 0 else ((0.5, 4), (2.5, 3)):
                box(b + over, shape[which] + 24)
    # 0:00 The tune.
    for b, d, m in notes(0, CHILD):
        ocarina(b, d, m)
    # 0:30 The music box has it; the ocarina under it.
    for b, d, m in notes(32, BOX_TUNE):
        box(b, m, 0.065, 0.3)
    for b, d, m in notes(32, UNDER):
        ocarina(b, d, m, 0.04)
    # 0:45 The ocarina's answer.
    for b, d, m in notes(48, ANSWER):
        ocarina(b, d, m)
    # The house: the clock, a piece put down now and then, birds outside the window.
    for i in range(BEATS):
        tick(i, 0.03, i % 2 == 0)
    for b in (9.3, 27.6, 38.4, 53.7):
        clack(b)
    for _ in range(14):
        bird(rng.uniform(0, BEATS), rng.uniform(0.01, 0.025), rng.uniform(-0.8, 0.8))

    levels = {"tune": 2.5, "keys": 2.5, "box": 2.5, "pads": 1.0, "clock": 3.0, "yard": 3.0}
    room("keys"), room("tune"), room("box", 2.5, 0.45), room("yard", 1.6, 0.7)
    return x.play(x.mixdown(levels, lowpass=8500, room=0.34, room_s=2.0))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
