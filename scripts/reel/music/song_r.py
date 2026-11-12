"""Song R (Eric, Nov 12): Moo & Moon's theme, a two-minute loop. His direction: "use the same overdrive, maybe a
slight variation ... more whimsical but still like the whimsicalness comes from the background notes, like star
sparkling sort of thing. Kind of more like a darker night style and so really honestly like avoiding high pitched
notes ... just try to come up with something, and it'll get me started."
On the first go (112 beats a minute, the lead between F#3 and A#4): "its a little too slow, the moos and the noise that
sounds like anime wawawa or something is nice, but too slow on the melody and maybe even too deep/low". So this one is
136 beats a minute, the tunes rewritten in quicker notes and an octave higher, the half-pace stretch gone, and the Moon
(the "wawawa") given eight bars of its own.
A night drive, a kick on every beat: 272 beats = 68 bars = 120.0 s. B minor; the drop walks down by major thirds
(B minor, G minor, E flat minor), the old trick for outer space.
Moo is a sweet cow who can't talk, the Moon his chatty friend, so: the lead is Moo, the overdriven lead (synth.py's
`drive`) a shade darker than Sawyer's (F#4 to B5); the Moon answers on a talking synth (each note a "wah"). The whimsy
is behind them: the stars, a soft bell pattern in 16ths that keeps coming back to one note, each star at its own
brightness, some with a glint an octave up; a cowbell; an owl; and Moo's moos, built as the game builds them (a
sawtooth through two formants gliding from "mm" to "oo").
Under them: a kick, a gated snare, soft hats, toms; a rolling bass that ducks under the kick; held strings. The drop
adds an 808, a wobble bass, a clap, and a gritty synth, low, that duels the lead.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_r.py <out.wav>

  bars  1-4    night: wind, an owl, the stars coming out one by one, a cowbell, a moo, the Moon's first words
  bars  5-12   Moo's tune over the beat, the bass and the stars
  bars 13-20   its answer, the Moon chattering in the gaps
  bars 21-28   a second tune, darker (E minor, a C chord); the stars falling, the bass jumping octaves
  bars 29-32   the hush: a heartbeat, the stars thinning, a hum rising, a moo, a moonbeam coming down
  bars 33-44   the Full Moon (0:56): a big moo, 808, wobble bass, more cowbell; the lead and a gritty synth trade two
               bars each, then play together
  bars 45-52   the Moon's turn: it talks a tune in bursts, Moo answering each with a lick; a happy moo
  bars 53-56   the calm: no drums; long soft notes, the stars at half speed, the owl, the Moon
  bars 57-64   Moo's tune again, the Moon chattering, a square in harmony for its last four bars
  bars 65-68   the tune's hook once more, a moonbeam and a moo into bar 1
"""
import sys

import numpy as np

from synth import Mix, length, line, n, write_wav

BPM = 136.0
BEATS = 272
SECS = BEATS * 60 / BPM

CHORDS = (
    "Bm Bm Bm Bm  Bm Bm G G E E F# F#  Bm Bm G G Em Em F# F#  Em Em Bm Bm C C F# F#  G G F# F#  "
    "Bm Bm Gm Gm Ebm Ebm F# F#  Bm Gm Ebm F#  Bm Bm Em Em G G F# F#  Bm G Em F#  Bm Bm G G E E F# F#  Bm G F# F#"
).split()
assert len(CHORDS) == 68
# Each chord: the bass note; the strings' three notes; the stars' five (low, middle, the one they keep coming back
# to, a color, high).
SKY = {
    "Bm": ("B1", "B2 F#3 D4", "B4 D5 F#5 A5 B5"),
    "G": ("G1", "G2 D3 B3", "B4 D5 G5 A5 B5"),
    "E": ("E2", "E2 B2 G#3", "B4 E5 G#5 F#5 B5"),
    "Em": ("E2", "E2 B2 G3", "B4 E5 G5 F#5 B5"),
    "F#": ("F#1", "F#2 C#3 A#3", "A#4 C#5 F#5 E5 A#5"),
    "C": ("C2", "C3 G3 E4", "C5 E5 G5 F#5 C6"),
    "Gm": ("G1", "G2 D3 Bb3", "Bb4 D5 G5 A5 Bb5"),
    "Ebm": ("Eb2", "Eb2 Bb2 Gb3", "Bb4 Eb5 Gb5 F5 Bb5"),
}
STAR = (0, 2, 4, 2, 1, 2, 3, 2, 0, 2, 4, 2, 3, 2, 1, 2)  # the stars' bar: which of the five, 16th by 16th
MINOR = (11, 1, 2, 4, 6, 7, 9)  # B minor, for the square's harmony

# ---- Moo's lines (the overdriven lead) ----
# The hook: two quick notes up to a third, a drop, a gap, and up again.
TUNE = (
    "B4:.25 C#5:.25 D5:.5 B4:.5 F#4:.5 -:.5 B4:.25 C#5:.25 D5:.5 F#5:.5 | E5:.5 D5:.5 C#5:.5 D5:.5 B4:1 -:.5 F#4:.5 | "
    "B4:.25 C#5:.25 D5:.5 G5:.5 D5:.5 -:.5 E5:.25 D5:.25 B4:.5 D5:.5 | E5:.5 D5:.5 B4:.5 A4:.5 B4:1 -:1 | "
    "E5:.25 F#5:.25 G#5:.5 E5:.5 B4:.5 -:.5 E5:.25 F#5:.25 G#5:.5 B5:.5 | A5:.5 G#5:.5 F#5:.5 E5:.5 G#5:1 -:.5 E5:.5 | "
    "F#5:.5 -:.5 F#5:.25 E5:.25 C#5:.5 A#4:.5 C#5:.5 E5:.5 F#5:.5 | E5:.5 C#5:.5 A#4:.5 F#4:.5 A#4:.5 C#5:.5 F#4:.5 -:.5"
)
ANSWER = (
    "F#5:.5 E5:.5 D5:.5 -:.5 D5:.25 E5:.25 F#5:.5 D5:.5 B4:.5 | C#5:.5 D5:.5 E5:.5 F#5:.5 D5:1 -:1 | "
    "G5:.5 -:.5 G5:.25 F#5:.25 E5:.5 D5:.5 B4:.5 D5:.5 E5:.5 | D5:.5 B4:.5 A4:.5 B4:.5 D5:1 -:1 | "
    "E5:.25 F#5:.25 G5:.5 E5:.5 B4:.5 -:.5 B4:.25 E5:.25 G5:.5 F#5:.5 | E5:.5 D5:.5 C#5:.5 D5:.5 E5:1 -:1 | "
    "F#5:.5 F#5:.5 E5:.5 C#5:.5 A#4:.5 C#5:.5 E5:.5 C#5:.5 | A#4:.25 C#5:.25 E5:.5 F#5:1.5 -:1.5"
)
DARK = (
    "E4:.5 G4:.5 B4:.5 -:.5 B4:.25 A4:.25 G4:.5 A4:.5 B4:.5 | C#5:.5 B4:.5 G4:.5 E4:.5 G4:1 -:1 | "
    "D5:.5 -:.5 D5:.25 C#5:.25 B4:.5 F#4:.5 B4:.5 C#5:.5 D5:.5 | E5:.5 D5:.5 C#5:.5 B4:.5 F#4:1 -:1 | "
    "E5:.25 F#5:.25 G5:.5 E5:.5 C5:.5 -:.5 C5:.25 E5:.25 G5:.5 F#5:.5 | E5:.5 C5:.5 G4:.5 C5:.5 E5:1 -:1 | "
    "C#5:.5 C#5:.5 D5:.5 C#5:.5 A#4:.5 F#4:.5 A#4:.5 C#5:.5 | E5:.5 F#5:.5 E5:.5 C#5:.5 A#4:1 -:1"
)
# The Full Moon: the lead's bars (played an octave up) and the gritty synth's, two each in turn; then four together.
DUEL_LEAD = (
    "B3:.5 B3:.5 D4:.5 F#4:1 -:.5 E4:.5 D4:.5 | C#4:.5 D4:.5 E4:.5 D4:.5 B3:1 -:1 | -:4 | -:4 | "
    "Gb4:.5 Gb4:.5 F4:.5 Eb4:1 -:.5 Bb3:.5 Eb4:.5 | F4:.5 Gb4:.5 Ab4:.5 Gb4:.5 Bb4:1 -:1 | -:4 | -:4 | "
    "F#4:1.5 E4:.5 D4:1 F#4:1 | G4:1.5 F4:.5 D4:1 G4:1 | Gb4:1.5 F4:.5 Eb4:1 Bb4:1 | A#4:2 F#4:1 C#4:1"
)
DUEL_GRIT = (
    "-:4 | -:4 | D4:.5 D4:.5 Bb3:.5 G3:1 -:.5 A3:.5 Bb3:.5 | C4:.5 D4:.5 Eb4:.5 D4:.5 G4:1 -:1 | "
    "-:4 | -:4 | A#3:.5 C#4:.5 E4:.5 -:.5 E4:.25 F#4:.25 E4:.5 C#4:1 | F#4:1 E4:.5 C#4:.5 A#3:.5 C#4:.5 F#4:1 | "
    "D4:1.5 C#4:.5 B3:1 D4:1 | Bb3:1.5 A3:.5 G3:1 Bb3:1 | Eb4:1.5 Db4:.5 Bb3:1 Gb4:1 | F#4:2 C#4:1 A#3:1"
)
# The Moon's turn: its bursts, and Moo's lick after each.
TURN_MOON = (
    "B4:.25 D5:.25 C#5:.25 D5:.25 F#5:.5 -:.5 D5:.25 E5:.25 D5:.25 B4:.25 -:1 | -:4 | "
    "G5:.25 F#5:.25 E5:.25 F#5:.25 G5:.5 -:.5 E5:.25 G5:.25 B5:.5 -:1 | -:4 | "
    "D5:.25 D5:.25 E5:.25 D5:.25 B4:.5 D5:.5 -:.5 G5:.25 F#5:.25 E5:.25 D5:.25 -:.5 | -:4 | "
    "C#5:.25 E5:.25 C#5:.25 A#4:.25 C#5:.5 -:.5 F#5:.25 E5:.25 C#5:.5 -:1 | A#4:.25 C#5:.25 E5:.25 F#5:.25 E5:.5 C#5:.5 -:2"
)
TURN_MOO = (
    "-:4 | -:.5 F#5:.5 E5:.5 D5:.5 B4:1 -:1 | -:4 | -:.5 B4:.5 E5:.5 G5:.5 F#5:.5 E5:1 -:.5 | "
    "-:4 | -:.5 B4:.5 D5:.5 G5:.5 E5:.5 D5:1.5 | -:4 | -:2 F#5:.5 E5:.5 C#5:.5 F#5:.5"
)
CALM = "B4:4 | D5:4 | E5:2 G5:2 | F#5:3 -:1"
TAG = (
    "B4:.25 C#5:.25 D5:.5 B4:.5 F#4:.5 -:.5 B4:.25 C#5:.25 D5:.5 F#5:.5 | E5:.5 D5:.5 B4:.5 A4:.5 B4:1 -:1 | "
    "F#5:.5 -:.5 F#5:.25 E5:.25 C#5:.5 A#4:.5 C#5:.5 E5:.5 F#5:.5 | F#5:1 -:3"
)
# ---- the Moon's (the talking synth): a few quick words in Moo's gaps ----
MOON_1 = (
    "-:4 | -:3 B4:.25 D5:.25 C#5:.25 B4:.25 | -:4 | -:3 D5:.25 E5:.25 D5:.25 B4:.25 | "
    "-:4 | -:3 G4:.25 B4:.25 E5:.25 B4:.25 | -:4 | -:3 A#4:.25 C#5:.25 E5:.25 C#5:.25"
)
MOON_2 = (
    "-:4 | -:3 D5:.25 E5:.25 D5:.25 B4:.25 | -:4 | -:3 B4:.25 D5:.25 G5:.25 D5:.25 | "
    "-:4 | -:3 E5:.25 G#5:.25 F#5:.25 E5:.25 | -:4 | -:4"
)
for _name, _beats in ((TUNE, 32), (ANSWER, 32), (DARK, 32), (DUEL_LEAD, 48), (DUEL_GRIT, 48), (TURN_MOON, 32), (TURN_MOO, 32), (CALM, 16),
                      (TAG, 16), (MOON_1, 32), (MOON_2, 32)):
    assert abs(length(_name) - _beats) < 1e-9, (_name[:30], length(_name))
    for _bar in _name.split("|"):
        assert abs(length(_bar) - 4) < 1e-9, _bar


def main(out: str) -> None:
    x = Mix(SECS, BEATS, os=2, seed=157)
    put = x.put
    rng = np.random.default_rng(23)
    sr = x.sr
    tau = 2 * np.pi

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def chord(bar):
        root, pad, sky = SKY[CHORDS[bar]]
        return n(root), [n(c) for c in pad.split()], [n(c) for c in sky.split()]

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the strings and the stars duck

    def snare(b, vol=0.26):
        """A gated snare: a dark crack with a big tail cut short."""
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def hat(b, vol=0.035):
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 11000, 0.8) * np.exp(-t / 0.014) * tail(k, 0.004) * vol, 0.3)

    def tom(b, m, vol=0.32, pan=0.0):
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.15) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def clap(b, vol=0.2):
        for o in (0, 0.011, 0.023):
            put("snare", b + o / x.beat_s, hiss(int(0.02 * sr), 8000, 0.4) * np.exp(-np.arange(int(0.02 * sr)) / sr / 0.006) * vol * 0.7)
        kk = int(0.2 * sr)
        put("snare", b + 0.03 / x.beat_s, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol)

    def cowbell(b, vol=0.09, pan=-0.25):
        """A cowbell: two square tones that don't agree, a clank and a short ring."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.convolve(np.sign(np.sin(tau * 545 * t)) + np.sign(np.sin(tau * 815 * t)), np.ones(10) / 10, "same")
        put("bell", b, w * (0.7 * np.exp(-t / 0.02) + 0.3 * np.exp(-t / 0.11)) * np.minimum(1, t / 0.0008) * tail(k) * vol, pan)

    # ---- the low end ----
    def bass(b, m, beats, vol=0.4, slide=0.0):
        """A deep note driven so small speakers hear it, with a round pluck an octave up."""
        k = x.k(beats)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (slide * np.exp(-t / 0.05) / 12)) / sr
        env = np.minimum(1, t / 0.006) * np.exp(-t / (beats * x.beat_s * 2.0)) * tail(k, 0.02)
        w = np.tanh(2.2 * np.sin(ph)) / np.tanh(2.2) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        mid = 0.45 * np.sin(2 * ph + 1.6 * np.exp(-t / 0.09) * np.sin(2 * ph)) * np.exp(-t / 0.3)
        put("bass", b, (w + mid) * env * vol)

    def sub(b, m, beats, vol=0.5):
        """The 808."""
        k = x.k(beats)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (beats * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def wobble(b, m, beats, rate, vol=0.2, top=18.0):
        """The wobble bass: a sawtooth whose brightness sweeps open and shut `rate` times a beat, driven hard."""
        k = x.k(beats)
        t = np.arange(k) / sr
        cut = 1.5 + (0.5 - 0.5 * np.cos(tau * rate * t / x.beat_s)) * top
        w = np.zeros(k)
        for c in (-9, 9):
            ph = tau * x.hz(m + c / 100) * t
            for h in range(1, 22):
                w += np.sin(h * ph) / h * np.clip(cut - h + 1, 0, 1)
        put("wobble", b, np.tanh(1.8 * w) * np.minimum(1, t / 0.005) * tail(k) * vol)

    def boom(b, vol=0.5):
        k = int(0.7 * sr)
        t = np.arange(k) / sr
        put("fx", b, np.tanh(2 * np.sin(tau * np.cumsum(36 + 80 * np.exp(-t / 0.05)) / sr)) * np.exp(-t / 0.2) * tail(k, 0.02) * vol)
        kk = int(0.9 * sr)
        put("fx", b, hiss(kk, 7000, 0.2) * np.exp(-np.arange(kk) / sr / 0.2) * vol * 0.3)

    def hum(b, beats, vol=0.1, m0=35, m1=59):
        """The Moon gathering a beam: a soft tone climbing two octaves, swelling."""
        k = x.k(beats)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(x.hz(m0 + (m1 - m0) * u**1.5)) / sr
        put("fx", b, (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * u**2 * np.minimum(1, (1 - u) * 60) * vol)

    def strings(bar, vol=0.045, beats=4.0):
        _, pad, _ = chord(bar)
        for j, m in enumerate(pad):
            put("pad", bar * 4, x.strings(m, beats, vol, attack=0.12, release=0.2), (-0.45, 0.0, 0.45)[j])

    # ---- the sky ----
    def star(b, m, vol=0.07, pan=0.0):
        put("stars", b, x.bell(m, 1.2, vol, ratio=4.0, index=1.0, decay=0.28), pan)

    def stars(bar, vol=1.0, keep=1, glints=0.2, lower=False):
        """A bar of stars: the 16th pattern, each one at its own brightness, some with a glint an octave up.
        `keep`: only every such-th one; `lower`: a second, softer set an octave down, a 16th behind."""
        sky = chord(bar)[2]
        for i in range(16):
            if i % keep:
                continue
            t = bar * 4 + i * 0.25
            v = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 4 == 0 else 1.0)
            pan = 0.5 * np.sin(i * 1.7 + bar)
            star(t, sky[STAR[i]], 0.07 * v, pan)
            if rng.uniform() < glints:
                star(t + 0.125, sky[STAR[i]] + 12, 0.026 * v, -pan)
            if lower:
                star(t + 0.25, sky[STAR[(i + 5) % 16]] - 12, 0.035 * v, -pan)

    def falling(bar, vol=0.6):
        """Stars falling: four 16ths down through the five notes on each beat."""
        sky = chord(bar)[2]
        for beat in range(4):
            for j in range(4):
                star(bar * 4 + beat + j * 0.25, sky[(4 - j) if beat % 2 == 0 else (3 - j)], 0.06 * vol * rng.uniform(0.6, 1.0), 0.5 * (-1) ** beat)

    def beam(b, beats=2.0, vol=0.07):
        """A moonbeam coming down: the stars' bell running from B5 down two octaves."""
        notes = [n(c) for c in "B5 A5 F#5 E5 D5 B4 A4 F#4 E4 D4 B3".split()]
        for i, m in enumerate(notes):
            star(b + beats * i / len(notes), m, vol * (1.2 - 0.5 * i / len(notes)), 0.6 * np.cos(i))

    def hoot(b, secs=0.32, vol=0.09, pan=-0.4):
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(370 * (1 - 0.06 * u)) / sr
        env = np.sin(np.pi * u) ** 0.6
        put("night", b, (np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.03 * hiss(k, 3000)) * env * vol, pan)

    def owl(b, vol=0.09):
        hoot(b, 0.34, vol), hoot(b + 1.5, 0.2, vol * 0.85), hoot(b + 2.0, 0.42, vol)

    def moo(b, secs, pitch, f1, f2, vol=0.3, rough=0.0, breath=0.2, open_=0.15, vib=(5.0, 0.015), pan=0.0):
        """Moo's moo, as the game makes it (packages/app/src/characters/moo-sounds.ts): a sawtooth whose pitch rises
        to a peak and falls, through two resonances gliding from "mm" to "oo", a slow vibrato, a breath of noise."""
        k = int(secs * sr)
        t = np.arange(k) / sr
        u = t / secs
        f = np.where(u < 0.35, pitch[0] + (pitch[1] - pitch[0]) * u / 0.35, pitch[1] + (pitch[2] - pitch[1]) * (u - 0.35) / 0.65)
        f = f * (1 + vib[1] * np.sin(tau * vib[0] * t))
        ph = tau * np.cumsum(f) / sr
        o = np.clip(t / open_, 0, 1)
        fa, fb = f1[0] + (f1[1] - f1[0]) * o, f2[0] + (f2[1] - f2[0]) * o
        w = np.zeros(k)
        for h in range(1, 31):
            if h * max(pitch) > 2800:
                break
            fh = h * f
            gain = 2.2 / np.sqrt(1 + 36 * (fh / fa - fa / fh) ** 2) + 1.2 / np.sqrt(1 + 49 * (fh / fb - fb / fh) ** 2) + 0.15
            w += np.sin(h * ph) / h / np.sqrt(1 + (fh / 2600) ** 2) * gain
        env = np.minimum(1, t / 0.05) * np.minimum(1, (secs - t) / 0.18)
        grr = 1 - rough * (0.5 + 0.5 * np.sin(tau * 28 * t))
        put("night", b, (w * grr + breath * 0.4 * hiss(k, 3000, 0.3)) * env * vol, pan)

    def soft_moo(b, vol=0.3):  # D3 up to E3 and down to B2
        moo(b, 0.9, (147, 165, 123.5), (330, 470), (700, 900), vol, breath=0.25, open_=0.2)

    def happy_moo(b, vol=0.28):  # F#3 lilting up to B3 and back
        moo(b, 0.7, (185, 247, 185), (360, 560), (760, 1150), vol, breath=0.15, open_=0.16, vib=(6.0, 0.025))

    def big_moo(b, vol=0.4):  # F#2 up to B2 and down
        moo(b, 1.5, (92.5, 123.5, 82.4), (420, 640), (780, 1000), vol, rough=0.3, breath=0.2, open_=0.3, vib=(4.5, 0.02))

    # ---- the voices ----
    def cow(start, text, vol=1.0, pan=-0.1, up=0):
        """Moo: the overdriven lead, a shade darker than Sawyer's."""
        for b, d, m in line(start, text):
            put("lead", b, x.drive(m + up, d * 0.96, 0.16 * vol, knee=1400.0), pan)

    def talk(start, text, vol=0.12, pan=0.35):
        """The Moon: a talking synth, each note's mouth opening and closing (a "wah"), with a little quaver."""
        for b, d, m in line(start, text):
            k = x.k(d * 0.92)
            t = np.arange(k) / sr
            u = np.linspace(0, 1, k)
            ph = tau * np.cumsum(x.hz(m) * (1 + 0.012 * np.sin(tau * 9 * t))) / sr
            mouth = 480 * 2 ** (1.6 * np.sin(np.pi * u))
            w = np.zeros(k)
            for h in range(1, 15):
                w += np.sin(h * ph) / h**0.5 * (np.exp(-((np.log2(h * x.hz(m) / mouth)) / 0.5) ** 2) + 0.1)
            put("moon", b, w * np.minimum(1, t / 0.008) * tail(k, 0.02) * vol, pan)

    def grit(start, text, vol=1.0, pan=0.3):
        for b, d, m in line(start, text):
            put("grit", b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def third(m):
        pc = m % 12
        if pc not in MINOR:
            return m + 3
        return m + (MINOR[(MINOR.index(pc) + 2) % 7] - pc) % 12

    def stutter(b, m, count=4, vol=0.6):
        """A glitch: the lead's note fired again and again, a 32nd apart, fading."""
        for i in range(count):
            put("lead", b + i * 0.125, x.drive(m, 0.1, 0.16 * vol * (1 - 0.6 * i / count), attack=0.004, knee=1400.0), 0.4 if i % 2 else -0.4)

    # ---- the band, bar by bar ----
    def drive_beat(bar, bell=True, fill=False):
        """A kick on every beat, the gated snare on 2 and 4, soft hats between, the bass rolling in 8ths, the cowbell."""
        b, (root, _, _) = bar * 4, chord(bar)
        for i in range(4):
            kick(b + i, 0.5)
            hat(b + i + 0.5, 0.04), hat(b + i + 0.75, 0.02)
        snare(b + 1), snare(b + 3)
        for i in range(8):
            bass(b + i * 0.5, root + (12 if i == 7 else 0), 0.46, 0.4)
        if bell:
            for o in (0.5, 1.5, 2.75) if bar % 2 == 0 else (0.5, 1.5, 2.5, 3):
                cowbell(b + o, 0.085)
        if fill:
            for i, m in enumerate((50, 50, 45, 40)):
                tom(b + 3 + i * 0.25, m, 0.26 + 0.03 * i, (0.3, 0.3, 0.0, -0.3)[i])

    def dark_beat(bar, fill=False):
        """The same pace, darker: the kick, the snare and hats, the bass jumping octaves, a floor tom, no cowbell."""
        b, (root, _, _) = bar * 4, chord(bar)
        for i in range(4):
            kick(b + i, 0.5)
            hat(b + i + 0.5, 0.04)
        snare(b + 1), snare(b + 3)
        tom(b + 2.5, 40, 0.24, -0.3)
        for i in range(8):
            bass(b + i * 0.5, root + (12 if i % 2 else 0), 0.46, 0.4)
        if fill:
            for i, m in enumerate((50, 50, 45, 40)):
                tom(b + 3 + i * 0.25, m, 0.26 + 0.03 * i, (0.3, 0.3, 0.0, -0.3)[i])

    WOB = [((2, 1), (1, 2), (1, 4)), ((1, 2), (1, 3), (2, 0.5)), ((1.5, 2), (1.5, 4), (1, 6)), ((1, 1), (1, 4), (2, 2))]

    def full_moon(bar, k):
        """A drop bar: the 808 and a kick that pushes, a clap and the snare on 2 and 4, the wobble bass at changing
        speeds, 16th hats, the cowbell on every off-beat."""
        b, (root, _, _) = bar * 4, chord(bar)
        low = root if root >= 33 else root + 12
        for o, v in ((0, 0.6), (0.75, 0.4), (2, 0.55), (2.5, 0.45)):
            kick(b + o, v)
        clap(b + 1), snare(b + 1, 0.2), clap(b + 3), snare(b + 3, 0.2)
        sub(b, low, 1.8, 0.45), sub(b + 2.5, low, 1.3, 0.38)
        t = b
        for d, rate in WOB[k % 4]:
            wobble(t, low + 12, d, rate, 0.17)
            t += d
        for i in range(16):
            hat(b + i * 0.25, 0.03 if i % 4 == 2 else 0.018)
        for i in range(4):
            cowbell(b + i + 0.5, 0.1)

    # Bars 1-4: night. Wind, the owl, the stars coming out one by one, the strings rising, a cowbell far off, a moo,
    # and the Moon's first words; toms into the tune.
    put("night", 0, x.rumble(16, 0.1, hold=60), -0.2)
    owl(1.0)
    for bar, keep in ((0, 8), (1, 4), (2, 2), (3, 1)):
        stars(bar, vol=0.55 + 0.15 * bar, keep=keep, glints=0.1)
    for j, m in enumerate(chord(0)[1]):
        put("pad", 4, x.swell(x.strings(m, 12, 0.05, attack=0.5, release=0.6), 0.85), (-0.45, 0.0, 0.45)[j])
    bass(8, n("B1"), 7.8, 0.22)
    cowbell(8, 0.06), cowbell(10, 0.06)
    for b in (12, 13, 14, 15, 15.5):
        cowbell(b, 0.075)
    soft_moo(9)
    talk(13.5, "B4:.25 D5:.25 C#5:.25 D5:.25 B4:.5")
    for i, m in enumerate((50, 45, 40, 40)):
        tom(15 + i * 0.25, m, 0.24 + 0.03 * i, (0.3, 0.0, -0.3, -0.3)[i])

    # Bars 5-12: Moo's tune.
    x.crash(16, 0.14, decay=0.5)
    cow(16, TUNE)
    for bar in range(4, 12):
        drive_beat(bar, fill=bar == 11)
        strings(bar)
        stars(bar)

    # Bars 13-20: its answer, the Moon chattering in the gaps; more glints.
    cow(48, ANSWER)
    talk(48, MOON_1)
    for bar in range(12, 20):
        drive_beat(bar, fill=bar in (15, 19))
        strings(bar)
        stars(bar, glints=0.32)

    # Bars 21-28: a second tune, darker. The same pace; the strings up, the stars falling, the bass jumping octaves.
    x.crash(80, 0.12, decay=0.6)
    cow(80, DARK)
    for bar in range(20, 28):
        dark_beat(bar, fill=bar in (23, 27))
        strings(bar, 0.06)
        falling(bar)
    owl(93.0, 0.07)

    # Bars 29-32: the hush. The kit out but a heartbeat; the stars thin; the Moon asks something; a hum climbs; a moo;
    # half a beat of nothing but a moonbeam coming down.
    for i, bar in enumerate(range(28, 32)):
        stars(bar, vol=0.8 - 0.12 * i, keep=(1, 2, 2, 4)[i], glints=0.1)
        strings(bar, 0.04 - 0.008 * i)
        kick(bar * 4, 0.34), kick(bar * 4 + 0.5, 0.24)
    talk(114, "F#5:.25 E5:.25 D5:.5 B4:.25 D5:.25")
    hum(116, 10)
    soft_moo(120.5, 0.28)
    beam(126, 2.0)

    # Bars 33-44: the Full Moon. The lead and the gritty synth trade two bars each, a stutter at the end of each
    # turn; then four bars together.
    boom(128, 0.8), x.crash(128, 0.2, decay=0.6)
    big_moo(128, 0.34)
    cow(128, DUEL_LEAD, up=12)
    grit(128, DUEL_GRIT)
    for i, bar in enumerate(range(32, 44)):
        full_moon(bar, i)
        stars(bar, vol=1.05, glints=0.35, lower=True)
        if i >= 8:
            strings(bar, 0.05)
            x.crash(bar * 4, 0.12, decay=0.4)
    for b, m in ((135, "B4"), (143, "G4"), (151, "Bb5"), (159, "F#4")):
        stutter(b, n(m), 8 if b in (143, 159) else 4)
    for i, m in enumerate((50, 50, 45, 45, 40, 40, 40, 40)):
        tom(158 + i * 0.25, m, 0.24 + 0.02 * i, (0.3, 0.3, 0.0, 0.0, -0.3, -0.3, -0.3, -0.3)[i])
    for i in range(8):
        snare(174 + i * 0.25, 0.08 + 0.02 * i)

    # Bars 45-52: the Moon's turn. It talks a tune in bursts; Moo answers each with a lick, and once with a happy moo.
    x.crash(176, 0.16, decay=0.5)
    talk(176, TURN_MOON, vol=0.15)
    cow(176, TURN_MOO)
    for bar in range(44, 52):
        drive_beat(bar, fill=bar in (47, 51))
        strings(bar)
        stars(bar, glints=0.3)
    happy_moo(190.6)

    # Bars 53-56: the calm. No drums: long soft notes, the stars at half speed, the strings, the owl, the Moon, a moo;
    # a hum and toms back into the tune.
    boom(208, 0.3)
    cow(208, CALM, vol=0.7)
    for bar in range(52, 56):
        strings(bar, 0.06)
        stars(bar, vol=0.85, keep=2, glints=0.15)
        bass(bar * 4, chord(bar)[0], 3.9, 0.3)
    owl(213.0, 0.08)
    talk(218.5, "E5:.25 D5:.25 B4:.5")
    soft_moo(220.2, 0.24)
    hum(220, 4, 0.07)
    for i, m in enumerate((50, 45, 45, 40)):
        tom(223 + i * 0.25, m, 0.24 + 0.03 * i, (0.3, 0.0, 0.0, -0.3)[i])

    # Bars 57-64: Moo's tune again, the Moon chattering; a square joins in harmony for the last four bars.
    x.crash(224, 0.16, decay=0.5)
    cow(224, TUNE)
    talk(224, MOON_2)
    for b, d, m in line(240, "|".join(TUNE.split("|")[4:])):
        put("square", b, x.chip(third(m) - 12, d * 0.9, 0.07), 0.3)
    for bar in range(56, 64):
        drive_beat(bar, fill=bar in (59, 63))
        strings(bar)
        stars(bar, vol=1.05, glints=0.3)

    # Bars 65-68: the hook once more, the Moon's last word, three hits; a moonbeam comes down and Moo moos into bar 1.
    x.crash(256, 0.16, decay=0.5)
    cow(256, TAG)
    talk(263, "D5:.25 E5:.25 D5:.25 B4:.25")
    for bar in range(64, 67):
        drive_beat(bar, fill=bar == 66)
        strings(bar)
        stars(bar, vol=1.05, glints=0.3)
    kick(268, 0.55), snare(268, 0.24), cowbell(268, 0.1), bass(268, n("F#1"), 3.5, 0.4)
    strings(67, 0.05)
    stars(67, vol=0.8, keep=2, glints=0.15)
    beam(269, 2.5, 0.06)
    soft_moo(269.8, 0.26)

    # The bass, the strings and (lightly) the stars duck under each kick: the night-drive pump.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["pad"] *= 0.45 + 0.55 * gain
    x.buses["stars"] *= 0.75 + 0.25 * gain

    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("stars", 0.75, 0.2, 0.08)
    x.echo("moon", 0.5, 0.15, 0.05)
    x.echo("night", 1.5, 0.2, 0.08)
    levels = {"lead": 1.15, "bass": 0.5, "sub": 0.5, "wobble": 0.8, "kick": 0.9, "snare": 2.0, "hats": 4.0, "toms": 1.5, "drum": 1.5, "stars": 1.8,
              "pad": 1.7, "bell": 2.0, "moon": 1.6, "grit": 1.1, "square": 1.2, "fx": 1.2}
    write_wav(out, x.mixdown(levels, lowpass=7000, room=0.25))


if __name__ == "__main__":
    main(sys.argv[1])
