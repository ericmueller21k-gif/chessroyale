"""Song AL (Eric, Nov 18): the battle tower's music, second go: a loop of exactly one minute that builds like the
run-up to a fight. The first go (song_ak.py: slow, low and dark, as his first brief asked) he threw out: "wtf this is
depressing as shit, shelve this for a defeat song maybe, can you try again, think more like fight scene build up game
style, maybe that's what I should a started with, discard the original dark vision". No plan: all of it is written
here, and original (none of it is any song's or any game's).
What his words fixed:
  - One minute, a loop, and still the tower's background (his first brief's "simple 1 minute looping beat"): 128
    beats a minute, 32 bars of four, 60.0 s.
  - "Fight scene build up": it starts as a pulse and adds a layer every eight bars, to a full band with a snare roll
    on the dominant; then the loop's first bar is the pulse again, as if the next floor's fight is being set up.
  - "Game style": the orchestra a console fakes. Low strings chopping 8ths on the root; violas and violins in short
    16ths; horns with the tune, trumpets over them at the top; timpani, low drums, a kit; held strings under the top.
  - Not depressing: C minor for weight, but the tune leaps up a fifth and climbs, and two of its four chords are
    major (Cm, Cm, A flat, B flat); everything is on the move from the first bar. One accent runs through all of it,
    three-three-two (the low strings' bows, the low drums, the kick).
  - Nothing high left ringing (from the first brief; it still suits a place to stand in): no bells or chimes.
  python3 song_al.py <out.wav>

  bars  1-8   0:00  the pulse: low strings and violas, a kick, timpani; the short strings' 16ths from bar 5, softly;
                    the horns' call, far off, in the last two bars
  bars  9-16  0:15  the short strings' 16ths, hats, the snare on 3; the horns' tune
  bars 17-24  0:30  the low drums, held strings; the tune again, trumpets an octave over its first half
  bars 25-32  0:45  everything: the snare on 2 and 4, the trumpets' rise over A flat, B flat, C minor; two bars on G
                    with the roll, and bar 1
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 128, 32
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 60.0 s
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the low strings' note, the short strings' four (each bowed twice, twice a bar), the held strings' four.
FORT = {
    "Cm": ("C2", "C4 G4 Eb4 G4", "G3 C4 Eb4 G4"), "Ab": ("Ab1", "C4 Ab4 Eb4 Ab4", "Ab3 C4 Eb4 Ab4"),
    "Bb": ("Bb1", "D4 Bb4 F4 Bb4", "F3 Bb3 D4 F4"), "G": ("G1", "D4 G4 B3 G4", "G3 B3 D4 F4"),
}
ROUND = "Cm Cm Ab Bb"
CHORDS = f"{ROUND} {ROUND}  {ROUND} {ROUND}  {ROUND} {ROUND}  Ab Bb Cm Cm Ab Bb G G".split()
assert len(CHORDS) == BARS
ACCENT = (0, 3, 6)  # the accent, in 8ths of the bar: three, three, two

# ---- the lines. Lengths in beats. ----
# The horns' tune: up a fifth and down by step, then a climb to a held note; its answer starts where that left off.
TUNE_1 = "C4:1 G4:1.5 F4:.5 Eb4:1 | D4:.5 Eb4:.5 G4:3 | Ab4:1 G4:1.5 F4:.5 Eb4:1 | F4:.5 G4:.5 Bb4:3"
TUNE_2 = "C5:1 Bb4:1.5 G4:.5 Eb4:1 | F4:.5 G4:.5 C5:3 | Eb5:1 D5:1.5 C5:.5 Ab4:1 | Bb4:.5 C5:.5 D5:3"
# Far off, before it starts (bars 7-8): its leap and its climb.
CALL = "C4:1 G4:3 | F4:.5 G4:.5 Bb4:3"
# The top (bars 25-32; A flat, B flat, C minor, C minor, A flat, B flat, G, G): the tune's shapes climbing, then up
# the G chord to a held G over the roll.
TOP = "Eb5:1 D5:1.5 C5:.5 Ab4:1 | F5:1 Eb5:1.5 D5:.5 Bb4:1 | G5:2 Eb5:1 C5:1 | D5:.5 Eb5:.5 G5:3 | Ab5:1 G5:1.5 F5:.5 Eb5:1 | F5:.5 G5:.5 Bb5:3 | G4:1 B4:1 D5:1 F5:1 | G5:4"
for _line, _beats in ((TUNE_1, 16), (TUNE_2, 16), (CALL, 8), (TOP, 32)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The loop as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage."""
    x = Ride(RIDE, BEATS, None, os=2, seed=347, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(127)
    sr = x.sr
    tau = 2 * np.pi
    chord = lambda bar: FORT[CHORDS[bar - 1]]

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def fed(ph, beta=0.9):
        """A sine operator fed back on itself: it leans toward a sawtooth."""
        y = np.sin(ph)
        for _ in range(6):
            y = np.sin(ph + beta * y)
        return y

    # ---- the drums ----
    def kick(b, vol=0.5):
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.6 * np.sin(tau * np.cumsum(55 + 110 * np.exp(-t / 0.016)) / sr) * np.exp(-t / 0.08)) + 0.25 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, w * tail(k) * vol)

    def snare(b, vol=0.25):
        """A field drum: its body and its wires."""
        k = int(0.16 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(185 + 70 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 7500, 0.5) * np.exp(-t / 0.06)) * tail(k, 0.01) * vol, 0.05)

    def low_drum(b, vol=0.3, high=False):
        """One of the low drums (a big one, or the smaller one beside it)."""
        f0 = 96 if high else 70
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(f0 * (1 + 0.6 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.13) + 0.5 * np.sin(tau * np.cumsum(2.3 * f0 * (1 + 0.3 * np.exp(-t / 0.02))) / sr) * np.exp(-t / 0.04)
        put("drums", b, (w + 0.3 * hiss(k, 3000, 0.3) * np.exp(-t / 0.008)) * np.minimum(1, t / 0.001) * tail(k, 0.03) * vol, 0.3 if high else -0.3)

    def hat(b, vol=0.02, pan=0.3):
        k = int(0.035 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 12000, 0.85) * np.exp(-t / 0.009) * tail(k, 0.004) * vol, pan)

    def crash(b, vol=0.05):
        k = int(1.3 * sr)
        t = np.arange(k) / sr
        put("crash", b, hiss(k, 13000, 0.8) * np.exp(-t / 0.3) * np.minimum(1, t / 0.002) * tail(k, 0.05) * vol, -0.2)

    def timp(b, name, vol=0.3, secs=0.9):
        put("timp", b, x.timp(n(name), secs, vol), -0.1)

    # ---- the strings ----
    def bow(m, secs, die, vol, pair=(-5, 4)):
        """A short bowed note: the bow bites and lets go."""
        k = int(secs * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for j, c in enumerate(pair):
            ph = tau * x.hz(m + c / 100) * t + 0.9 * j
            w += sum(a * np.sin((i + 1) * ph + 0.7 * i) for i, a in enumerate(x.BOWED) if x.hz(m) * (i + 1) < 9000)
        return w / len(pair) * np.minimum(1, t / 0.006) * np.exp(-t / die) * tail(k, 0.02) * vol

    def chop(bar, vol=1.0):
        """A bar of the low strings: the chord's root in 8ths, the octave over it bowed with it; harder on the accent."""
        low = n(chord(bar)[0])
        for i in range(8):
            b = bar0(bar) + i / 2
            a = (1.0 if i in ACCENT else 0.68) * vol
            put("low", b, bow(low, 0.2, 0.1, 0.11 * a) + bow(low + 12, 0.2, 0.09, 0.07 * a), -0.2)

    def spic(bar, vol=1.0):
        """A bar of the short strings: the chord's four notes, each bowed twice, twice round, in 16ths."""
        ms = [n(c) for c in chord(bar)[1].split()]
        for i in range(16):
            b = bar0(bar) + i / 4
            put("short", b, bow(ms[(i // 2) % 4], 0.11, 0.05, 0.05 * vol * (1.0 if i // 2 in ACCENT else 0.72) * (1.0 if i % 2 == 0 else 0.8), (-6, 5)), 0.25)

    def held(bar, vol=0.02):
        """A bar of the held strings."""
        at(bar0(bar), 4)
        for j, m in enumerate(n(c) for c in chord(bar)[2].split()):
            put("held", bar0(bar), x.strings(m, 4, vol, attack=0.15, release=0.3), (-0.5, -0.15, 0.15, 0.5)[j])

    # ---- the brass ----
    def horn(m, d, vol, bite=0.02, vib=0.0, edge=1.0, players=((-7, 0.5), (0, 0.0), (6, -0.4))):
        """A brass note: FM (a fed-back pair and a 1:2 pair), three players a hair apart starting together; brightest
        at its front; `bite`: how fast it speaks."""
        k = x.k(d) + int(0.07 * sr)
        i = np.arange(k)
        t = i / sr
        amp = np.minimum(1, t / bite) * (0.8 + 0.2 * np.exp(-t / 0.08)) * np.clip((k - i) / (0.07 * sr), 0, 1)
        f0 = x.hz(m)
        depth = edge * float(np.clip((523.25 / f0) ** 0.5, 0.7, 1.2)) * (1 + 0.25 * np.exp(-t / 0.08))
        w = np.zeros(k)
        for c, ph0 in players:
            f = x.hz(m + c / 100) * (1 + vib * np.sin(tau * 5.5 * t) * np.clip((t - 0.25) / 0.25, 0, 1))
            ph = tau * np.cumsum(f) / sr + ph0
            w += 0.6 * np.sin(ph + 2.0 * depth * fed(ph)) + 0.4 * np.sin(ph + 1.1 * depth * np.sin(2 * ph))
        return w / len(players) * amp * vol

    def brass(start, text, vol=1.0, shift=0, pan=0.0, bus="horns", edge=0.9, bite=0.02):
        for b, d, m in notes(start, text):
            at(b, d)
            put(bus, b, horn(m + shift, max(0.1, d - 0.12), 0.2 * vol, bite, vib=0.005 if d >= 2 else 0.0, edge=edge), pan)

    # ---- the four eights ----
    def pulse(first):
        """Bars 1-8: the low strings' 8ths, and the violas' with them on the chord's first two notes (so a small
        speaker has the pulse too); from the fifth bar the short strings' 16ths, softly; a kick on 1 and 3; timpani
        on the first beat of each chord; the horns' call, far off, in the last two bars."""
        for j in range(8):
            bar = first + j
            chop(bar, 1.1)
            ms = [n(c) for c in chord(bar)[1].split()]
            if j < 4:
                for i in range(8):
                    put("short", bar0(bar) + i / 2, (bow(ms[0], 0.16, 0.07, 0.05) + bow(ms[1], 0.16, 0.07, 0.035)) * (1.0 if i in ACCENT else 0.7), 0.25)
            else:
                spic(bar, 0.65)
            kick(bar0(bar), 0.46), kick(bar0(bar) + 2, 0.38)
            if CHORDS[bar - 1] != CHORDS[bar - 2]:
                timp(bar0(bar), chord(bar)[0].replace("1", "2"), 0.24)
        timp(bar0(first), "C2", 0.3), crash(bar0(first), 0.04)
        brass(bar0(first + 6), CALL, 0.45, pan=-0.2, edge=0.75, bite=0.05)

    def march(first):
        """Bars 9-16: the short strings join; hats; the kick on the accent, the snare on 3; the horns' tune."""
        for j in range(8):
            bar = first + j
            b = bar0(bar)
            chop(bar), spic(bar, 0.9)
            for i in ACCENT:
                kick(b + i / 2, 0.46 if i == 0 else 0.36)
            snare(b + 2, 0.22)
            for i in range(8):
                hat(b + i / 2, 0.02 if i % 2 == 0 else 0.014)
        timp(bar0(first), "C2", 0.3), crash(bar0(first), 0.04)
        for i in (12, 13, 14, 15):
            snare(bar0(first + 7) + i / 4, 0.1 + 0.035 * (i - 12))
        brass(bar0(first), TUNE_1, 0.85), brass(bar0(first + 4), TUNE_2, 0.85)

    def gather(first):
        """Bars 17-24: the low drums on the accent, held strings under; the tune again, trumpets an octave over its
        first half, the horns an octave under its second."""
        for j in range(8):
            bar = first + j
            b = bar0(bar)
            chop(bar), spic(bar), held(bar)
            for i in ACCENT:
                kick(b + i / 2, 0.48 if i == 0 else 0.38)
            for i in (0, 3, 6, 8, 11, 14):
                low_drum(b + i / 4, 0.26 if i in (0, 8) else 0.2, high=i in (3, 11))
            snare(b + 2, 0.24)
            for i in range(8):
                hat(b + i / 2, 0.022 if i % 2 == 0 else 0.015)
        timp(bar0(first), "C2", 0.32), crash(bar0(first), 0.05)
        for i in range(8, 16):
            snare(bar0(first + 7) + i / 4, 0.08 + 0.022 * (i - 8))
        brass(bar0(first), TUNE_1, 0.9), brass(bar0(first), TUNE_1, 0.5, 12, 0.2, "trumpets", 1.05)
        brass(bar0(first + 4), TUNE_2, 0.85), brass(bar0(first + 4), TUNE_2, 0.35, -12, -0.2)

    def charge(first):
        """Bars 25-32: everything, the snare on 2 and 4; the trumpets' rise, the horns an octave under; the last two
        bars on G: the roll, timpani, and the held G."""
        for j in range(8):
            bar = first + j
            b = bar0(bar)
            last = j >= 6
            chop(bar, 1.05), spic(bar, 1.05), held(bar, 0.024)
            for i in ACCENT:
                kick(b + i / 2, 0.5 if i == 0 else 0.4)
            for i in (0, 3, 6, 8, 11, 14):
                low_drum(b + i / 4, 0.28 if i in (0, 8) else 0.22, high=i in (3, 11))
            if not last:
                snare(b + 1, 0.25), snare(b + 3, 0.25)
                for i in range(8):
                    hat(b + i / 2, 0.022 if i % 2 == 0 else 0.016)
            if CHORDS[bar - 1] != CHORDS[bar - 2]:
                timp(b, chord(bar)[0].replace("1", "2"), 0.26)
        crash(bar0(first), 0.06), crash(bar0(first + 2), 0.045), crash(bar0(first + 6), 0.05)
        b = bar0(first + 6)
        for i in range(32):
            snare(b + i / 4, 0.07 + 0.16 * (i / 31) ** 1.5 + (0.03 if i % 4 == 0 else 0))
        for i in range(8):
            timp(b + 4 + i / 2, "G2", 0.14 + 0.025 * i, 0.5)
        brass(bar0(first), TOP, 0.95, 0, 0.1, "trumpets", 1.05), brass(bar0(first), TOP, 0.6, -12, -0.2)

    pulse(1), march(9), gather(17), charge(25)

    # A hall for the brass, the strings and the timpani; a little of it for the snare and the low drums.
    def room(name, secs=1.8, wet=0.2):
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.025)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 4000) ** 2) * (f > 150), n=size, axis=1)

    for name, secs, wet in (("horns", 2.0, 0.3), ("trumpets", 2.0, 0.28), ("short", 1.6, 0.22), ("low", 1.4, 0.14), ("held", 2.2, 0.35), ("timp", 2.0, 0.25),
                            ("snare", 1.4, 0.14), ("drums", 1.6, 0.2)):
        room(name, secs, wet)
    levels = {"horns": 2.0, "trumpets": 2.2, "short": 4.2, "low": 2.2, "held": 2.1, "timp": 0.4, "kick": 0.8, "snare": 1.6, "drums": 0.8, "hats": 7.2, "crash": 2.0}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
