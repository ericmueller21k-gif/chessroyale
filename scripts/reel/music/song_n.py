"""Song N (Eric, Nov 11): Don Dough the zebra's theme, a two-minute loop (written for Dash the cheetah; Eric, on the
finished song: "it doesn't actually fit Dash's character ... I think Don Doe is the way to go"). His direction: "rap style like r&b, a slow
primary beat of a slightly out of tune waveform piano/synth. The background has snare drums, dubstep drops, a lot
going on in the background, but the main piano roll is slow and spaced out, it can play a pretty simple shape the
whole time, but make it a unique one."
140 beats a minute felt at half that (the clap on beat 3): 280 beats = 70 bars = 120.0 s. F minor.
The piano's shape, four bars, all the way through: F up to C, the note a half step under it (B, the one that
doesn't belong), a gap, A flat up to E flat; then D flat, C, A flat, a gap, G down to E, which leans back to F.
Voices: the piano (a waveform piano, its two strings 21 cents apart); a deep sliding bass drum note (an 808); a kick,
a clap, fast hats with rolls, snare rolls; a wobble bass for the drops (its brightness swept at changing speeds); a
soft whistling lead that answers the piano; a thin pulse racing through the chords; risers, booms; and Dash's chess
clock ticking.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_n.py <out.wav>

  bars  1-4    the clock ticks; the piano alone; a riser
  bars  5-12   the beat comes in under the piano
  bars 13-20   the whistle answers the piano; the fast pulse; more rolls; a snare roll up
  bars 21-28   the first drop: the wobble bass, the piano up an octave
  bars 29-36   the piano in thirds over the beat, the bass sliding more
  bars 37-40   everything out but the piano and the clock; a riser
  bars 41-48   the second drop: the wobble and a higher growl trading
  bars 49-56   piano high and in thirds, whistle, double-time hats
  bars 57-64   the last drop: wobble, growl, piano in both octaves
  bars 65-68   the beat thins out under the piano
  bars 69-70   three hits and the clock, ticking into bar 1
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 140.0
BEATS = 280
SECS = BEATS * 60 / BPM

RIFF = "F4:1.5 C5:1.5 B4:1 | -:1 Ab4:1.5 Eb5:1.5 | Db5:1.5 C5:1.5 Ab4:1 | -:1 G4:1.5 E4:1.5"
ANSWER = "-:2.5 C6:.5 Eb6:.5 F6:.5 | Eb6:1 -:3 | -:2.5 Ab5:.5 C6:.5 Db6:.5 | C6:1 -:1 G5:.5 Bb5:.5 C6:1"
assert length(RIFF) == 16 and length(ANSWER) == 16
THIRD = {"F": 3, "C": 3, "B": 3, "Ab": 4, "Eb": 4, "Db": 4, "G": 3, "E": 3}  # the note a third up, in the key
# Bar by bar in the four-bar round: the bass note, the piano's low two notes, the chord for the fast pulse.
ROUND = [("F1", "F2 C3", "F4 Ab4 C5"), ("F1", "F2 C3", "F4 Ab4 C5"), ("Db2", "Db3 Ab3", "F4 Ab4 Db5"), ("C2", "C3 G3", "E4 G4 C5")]


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=131)
    put = x.put
    rng = np.random.default_rng(13)

    def piano(m, beats, vol=0.2):
        """A waveform piano with its two strings out of tune with each other."""
        return x.add(m, beats, [1, 0.6, 0.35, 0.25, 0.15, 0.1, 0.06, 0.04], vol, detune=(-13, 8), bright=0.25, attack=0.004, decay=0.5, sustain=0.2, release=0.08)

    def riff(bar, up=0, vol=1.0, thirds=False, low=True):
        t = bar * 4.0
        for tok in RIFF.replace("|", " ").split():
            name, d = tok.split(":")
            d = float(d)
            if name != "-":
                put("piano", t, piano(n(name) + up, d + 1.0, 0.24 * vol), -0.1)
                if thirds:
                    put("piano", t, piano(n(name) + up + THIRD[name[:-1]], d + 1.0, 0.13 * vol), 0.25)
            t += d
        if low:
            for i in range(4):
                for name in ROUND[i][1].split():
                    put("piano", (bar + i) * 4, piano(n(name), 3.5, 0.12 * vol), 0.1)

    def sub(b, m, beats, vol=0.5, slide=0):
        """The 808: a deep note with a click of pitch at its start, driven a little so small speakers hear it;
        `slide` semitones: it arrives from that far off."""
        k = x.k(beats)
        t = np.arange(k) / x.sr
        f = x.hz(m) * 2 ** ((12 * np.exp(-t / 0.012) + slide * np.exp(-t / 0.06)) / 12)
        ph = 2 * np.pi * np.cumsum(f) / x.sr
        env = np.exp(-t / (beats * x.beat_s * 0.6)) * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr))
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def wobble(b, m, beats, rate, vol=0.2, top=22.0, pan=0.0):
        """The wobble bass: a sawtooth whose brightness sweeps open and shut `rate` times a beat, driven hard."""
        k = x.k(beats)
        t = np.arange(k) / x.sr
        sweep = 0.5 - 0.5 * np.cos(2 * np.pi * rate * t / x.beat_s)
        cut = 1.5 + sweep * top
        w = np.zeros(k)
        for c in (-9, 9):
            ph = 2 * np.pi * x.hz(m + c / 100) * t
            for h in range(1, 26):
                w += np.sin(h * ph) / h * np.clip(cut - h + 1, 0, 1)
        edge = np.minimum(1, t / 0.005) * np.minimum(1, (k - 1 - np.arange(k)) / (0.01 * x.sr))
        put("wobble", b, np.tanh(1.8 * w) * edge * vol, pan)

    def clap(b, vol=0.22):
        for o in (0, 0.011, 0.023):
            put("drum", b + o / x.beat_s, x.noise(0.02, 11000, vol * 0.7, 0.006))
        put("drum", b + 0.03 / x.beat_s, x.noise(0.25, 11000, vol, 0.07))

    def hat(b, vol=0.05, open_=False):
        put("hats", b, x.noise(0.3 if open_ else 0.035, 24000, vol, 0.09 if open_ else 0.011), 0.3)

    def hat_roll(b, beats, count, v0=0.03, v1=0.06):
        for i in range(count):
            hat(b + beats * i / count, v0 + (v1 - v0) * i / max(1, count - 1))

    def snare_roll(b, beats, count, v0=0.04, v1=0.2):
        for i in range(count):
            x.snare(b + beats * i / count, v0 + (v1 - v0) * i / count)

    def riser(b, beats, vol=0.1):
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        ph = np.cumsum(x.hz(53) * 2 ** (24 * u / 12)) / x.sr
        put("fx", b, (2 * (ph % 1) - 1) * u**2 * vol, -0.2)
        put("fx", b, rng.uniform(-1, 1, k) * u**3 * vol * 0.6, 0.2)

    def boom(b, vol=0.5):
        k = int(0.7 * x.sr)
        t = np.arange(k) / x.sr
        f = 36 + 80 * np.exp(-t / 0.05)
        put("fx", b, np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / x.sr)) * np.exp(-t / 0.2) * vol * np.minimum(1, (k - 1 - np.arange(k)) / (0.02 * x.sr)))
        put("fx", b, x.noise(0.9, 16000, vol * 0.3, 0.2))

    def tick(b, high=True, vol=0.12):
        """The chess clock."""
        k = int(0.05 * x.sr)
        t = np.arange(k) / x.sr
        hz = 2300 if high else 1700
        put("clock", b, (np.sin(2 * np.pi * hz * t) + 0.6 * np.sin(2 * np.pi * hz * 2.4 * t)) * np.exp(-t / 0.006) * vol, 0.35 if high else -0.35)

    def clock(a, b, vol=0.12):
        for i in range(int(b - a)):
            tick(a + i, i % 2 == 0, vol)

    def whistle(bar, vol=0.1, up=0):
        """A soft whistling lead that answers in the piano's gaps."""
        for b, d, m in line(bar * 4, ANSWER):
            put("lead", b, x.add(m + up, d * 0.95, [1, 0.15, 0.05], vol, vib=0.01, attack=0.03, sustain=0.85, decay=0.2, release=0.06), 0.3)

    def racing(bar, vol=0.05):
        """The fast pulse: the chord in 16ths, up and over the octave."""
        notes = [n(c) for c in ROUND[bar % 4][2].split()]
        for i in range(16):
            s = (0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1)[i]
            put("arp", bar * 4 + i * 0.25, x.pulse(notes[s % 3] + 12 + 12 * (s // 3), 0.2, 0.125, vol, decay=0.04, sustain=0.4, release=0.004), -0.35)

    def beat(bar, busy=0, double=False, slides=False):
        """A verse bar: kick, the clap on 3, the 808 under the round's bass note, and hats (8ths, or 16ths when
        `double`) with a roll somewhere different each bar; `busy` adds ghost snares and more rolls."""
        b, i = bar * 4, bar % 4
        m = n(ROUND[i][0])
        x.kick(b, 0.6, soft=True), x.kick(b + 2.5, 0.5, soft=True)
        if i % 2:
            x.kick(b + 0.75, 0.42, soft=True)
        clap(b + 2), x.snare(b + 2, 0.12)
        sub(b, m, 2.2, 0.5)
        sub(b + 2.5, m, 0.9, 0.42)
        sub(b + 3.5, m + (12 if slides else 7), 0.5, 0.36, slide=-12 if slides else 0)
        step = 0.25 if double else 0.5
        for j in range(int(4 / step)):
            hat(b + j * step, 0.05 if (j * step) % 1 == 0 else 0.032)
        hat(b + 1.5, 0.05, open_=True) if i == 1 else None
        where = (3.5, 1.5, 3, 0.5)[i]
        hat_roll(b + where, 0.5, (6, 4, 8, 3)[(bar // 4 + i) % 4])
        if busy:
            x.snare(b + 3.25, 0.07), x.snare(b + 3.75, 0.1)
            hat_roll(b + (where + 2) % 4, 0.5, 6 if busy > 1 else 3)
        if busy > 1 and i == 3:
            snare_roll(b + 3, 1, 8, 0.05, 0.16)

    # The wobble's bar: (beats, sweeps a beat), three ways round.
    WOB = [((2, 1), (1, 2), (1, 4)), ((1, 2), (1, 3), (2, 0.5)), ((1.5, 2), (1.5, 4), (1, 6)), ((1, 1), (1, 4), (1, 2), (1, 8))]

    def drop(bar, kind=0, growl=False):
        """A drop bar: a heavy kick and clap, the wobble under the round's bass note at changing speeds, sparse hats;
        `growl`: every other bar's second half goes to a growl two octaves up."""
        b, i = bar * 4, bar % 4
        m = n(ROUND[i][0]) + 12
        x.kick(b, 0.7, soft=True), x.kick(b + 2.75, 0.5, soft=True), x.kick(b + 3.5, 0.5, soft=True)
        clap(b + 2, 0.26), x.snare(b + 2, 0.2)
        sub(b, m - 12, 1.8, 0.45)
        t = b
        for d, rate in WOB[(kind + i) % 4]:
            if growl and i % 2 and t - b >= 2:
                wobble(t, m + 24, d, rate * 2, 0.11, 10.0, 0.3)
            else:
                wobble(t, m, d, rate, 0.2)
            t += d
        for j in range(4):
            hat(b + j + 0.5, 0.045)
        hat_roll(b + (1.5, 3.5, 0.5, 3)[i], 0.5, (4, 6, 3, 8)[i])
        if i == 3:
            snare_roll(b + 3, 1, 6, 0.06, 0.16)

    # Bars 1-4: the clock and the piano alone.
    clock(0, 16)
    riff(0)
    riser(12, 4)
    snare_roll(14, 2, 8, 0.03, 0.14)

    # Bars 5-12: the beat comes in.
    boom(16)
    for c in (4, 8):
        riff(c)
    for bar in range(4, 12):
        beat(bar)

    # Bars 13-20: the whistle answers, the fast pulse races, the drums get busier; a roll up to the drop.
    x.crash(48, 0.16, decay=0.3)
    for c in (12, 16):
        riff(c), whistle(c)
    for bar in range(12, 20):
        beat(bar, busy=1 if bar < 18 else 2), racing(bar)
    riser(72, 8)
    snare_roll(76, 4, 32, 0.03, 0.22)

    # Bars 21-28: the first drop. The piano an octave up, thinner, over the wobble.
    boom(80, 0.6)
    x.crash(80, 0.22)
    for c in (20, 24):
        riff(c, up=12, vol=0.75, low=False)
    for bar in range(20, 28):
        drop(bar, kind=0)

    # Bars 29-36: the piano in thirds; the 808 slides; the fast pulse.
    boom(112, 0.4)
    for c in (28, 32):
        riff(c, thirds=True)
    for bar in range(28, 36):
        beat(bar, busy=1, slides=True), racing(bar)
    whistle(32, 0.08)

    # Bars 37-40: everything out but the piano and the clock.
    riff(36, vol=1.1)
    clock(144, 160, 0.13)
    sub(144, n("F1"), 6, 0.3)
    riser(152, 8)
    snare_roll(156, 4, 32, 0.03, 0.22)

    # Bars 41-48: the second drop: the wobble and a higher growl trading.
    boom(160, 0.6)
    x.crash(160, 0.22)
    for c in (40, 44):
        riff(c, vol=0.8)
    for bar in range(40, 48):
        drop(bar, kind=1, growl=True)

    # Bars 49-56: the piano high and in thirds, the whistle, double-time hats.
    boom(192, 0.4)
    for c in (48, 52):
        riff(c, up=12, thirds=True, vol=0.85), whistle(c, 0.09)
    for bar in range(48, 56):
        beat(bar, busy=2 if bar >= 54 else 1, double=True, slides=True), racing(bar)
    riser(216, 8)

    # Bars 57-64: the last drop: wobble, growl, the piano in both octaves, the fast pulse.
    boom(224, 0.6)
    x.crash(224, 0.22)
    for c in (56, 60):
        riff(c, vol=0.8), riff(c, up=12, vol=0.5, low=False)
    for bar in range(56, 64):
        drop(bar, kind=2, growl=True), racing(bar, 0.04)

    # Bars 65-68: the beat thins out under the piano.
    boom(256, 0.4)
    riff(64)
    whistle(64, 0.08)
    beat(64), beat(65)
    for bar in (66, 67):
        x.kick(bar * 4, 0.6, soft=True), clap(bar * 4 + 2), sub(bar * 4, n(ROUND[bar % 4][0]), 3, 0.45)
    clock(264, 272, 0.1)

    # Bars 69-70: three hits, and the clock ticks on into bar 1.
    for o in (0, 1.5, 3):
        for name in ("F2", "C3", "F4", "Ab4", "C5"):
            put("piano", 272 + o, piano(n(name), 1.6, 0.16))
        x.kick(272 + o, 0.7, soft=True), clap(272 + o, 0.2), sub(272 + o, n("F1"), 1.2, 0.45)
    clock(272, 280, 0.13)

    x.echo("lead", 0.75, 0.25, 0.1)
    x.echo("piano", 1.5, 0.1, 0.04)
    write_wav(out, x.mixdown({"sub": 0.45, "piano": 1.6, "hats": 5.0, "clock": 5.0, "lead": 2.2, "arp": 2.5, "fx": 1.3}, lowpass=9500, room=0.12))


if __name__ == "__main__":
    main(sys.argv[1])
