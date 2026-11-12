"""Song U (Eric, Nov 12): Alfil's theme, a loop of a little over two minutes. His direction: "continue with the same
theme we've been doing for the last two [Boingo's, Ginger's], but just incorporate the typical Egyptian pharaoh style
tones and sounds", and, from notes he had written up for him: the scale with the gap of three half steps in it
(Hijaz, and with two such gaps Hijaz Kar); a continuous low hum on one note and its fifth; chords that barely move,
a half step above a bass that stays put (I, flat II, I); an unhurried, free opening (a taqsim); sparse open fourths
and fifths in a huge, long echo; and the "big pluck" instruments: the oud (deep, woody, quick to die, sliding), the
qanun (bright, a long shimmering ring), the saz. "You can keep with the style you've been doing for the past two as
far as the creativity."
Alfil is a woolly mammoth, the old chess elephant, and his two powers run the song (recipe: SOUNDS.md).
Tusks, two pawns fused into one elephant: the tune is first played by two instruments that never play together, the
oud low on the left and the qanun high on the right, each with only its share of the notes; then, with a grinding
crunch, they fuse: one big line, the overdriven lead with both of them on it.
Mammoth Slam, pieces thrown up and landing with a thud that shakes the ground: before the drop the band is thrown
up (his big trumpet, a whoosh, and four beats of nothing but finger cymbals and wind), and it lands: the thud, alone
on the drop's first beat, then a half-time stomp.
C Hijaz (C, D flat, E, F, G, A flat, B flat); the bass never leaves C for the tune (the hum: C and G), the chords above
it a half step up and back; the second tune goes to F, in ten (3+2+2+3, the samai); the last tune is a fourth up.
242 beats, about 2:11.
Every melody, riff and chord progression here is original: none of it is any song's or any game's.
  python3 song_u.py <out.wav>

  0:00  the taqsim: the hum, a big pluck of the oud's open strings, the oud alone in a long echo, the qanun's sweep,
        finger cymbals; the ground rumbles, he trumpets, the darbuka rolls in
  0:12  Tusks, the two pawns: the tune shared between the oud (left, low) and the qanun (right), never together
  0:29  fused: the overdriven lead has the whole tune, both of them on it; the fiddle joins
  0:45  the second tune, in ten, on F: the fiddle, the ney, then both
  0:58  the temple (the first calm): the hum, big plucks, the ney coming down the scale, finger cymbals
  1:09  the lift: the fiddle and the qanun climb, the darbuka rolls
  1:12  Mammoth Slam, up: his big trumpet, a whoosh, then four beats of finger cymbals and wind
  1:14  down: the thud; the half-time stomp: an 808 on C and the half step above, the gritty synth, the lead
  1:29  the dance, faster and faster: the qanun and the fiddle, then the lead; claps
  1:41  the temple again (the second calm): the fiddle has the tune slowly; big plucks; the darbuka rolls back in
  1:51  the tune a fourth up, everyone on it
  2:07  the tag: three stomps home to C; the oud's open strings and the hum, which the start begins with
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BEATS = 242
# The pace: from beat, to beat, the tempo there (from, to).
PACE = [
    (0, 12, 60, 60),  # the taqsim: free; a beat is a second
    (12, 44, 116, 116),  # the two pawns
    (44, 76, 116, 120),  # fused
    (76, 106, 132, 132),  # in ten
    (106, 116, 58, 58),  # the temple
    (116, 124, 132, 150),  # the lift
    (124, 128, 132, 132),  # in the air
    (128, 160, 132, 132),  # the Slam
    (160, 192, 132, 184),  # the dance, faster and faster
    (192, 202, 58, 58),  # the temple again
    (202, 234, 124, 124),  # the tune a fourth up
    (234, 242, 124, 96),
]
SECS = round(float(sum(60 * (b - a) / t0 if t0 == t1 else 60 * (b - a) * np.log(t1 / t0) / (t1 - t0) for a, b, t0, t1 in PACE)), 2)
T_PAWNS, T_FUSED, T_TEN, T_CALM, T_LIFT, T_AIR, T_DROP, T_DANCE, T_CALM2, T_LAST, T_TAG = 12, 44, 76, 106, 116, 124, 128, 160, 192, 202, 234

# Each chord: the bass note; the fast pattern's five (low, middle, the one it keeps coming back to, a color, high).
SAND = {
    "C": ("C2", "G4 E5 C5 Db5 G5"),
    "Db/C": ("C2", "Ab4 F5 C5 Db5 Ab5"),  # a half step up, over the same bass
    "Bbm/C": ("C2", "Bb4 F5 C5 Db5 Bb5"),
    "Fm": ("F2", "Ab4 F5 C5 Eb5 Ab5"),
    "Db": ("Db2", "Ab4 F5 C5 Db5 Ab5"),
}
TUNE_CH = "C C Db/C C Bbm/C Db/C C C".split()
TEN_CH = "Fm Fm Db C Fm Db/C".split()
DROP_CH = "C Db/C C Bbm/C C Db/C Db/C C".split()
PAT = (0, 2, 4, 2, 1, 2, 3, 2, 0, 2, 4, 2, 3, 2, 1, 2)  # the fast pattern: which of the five, 16th by 16th
HIJAZ = [n(c) for c in "C4 Db4 E4 F4 G4 Ab4 Bb4 C5 Db5 E5 F5 G5 Ab5 Bb5 C6".split()]

# ---- the lines. Lengths are in beats; 2/3 is three notes in two beats, 1/3 three in one. ----
# The tune, eight bars in phrases of three, three and two: up the scale's gap (C, D flat, E) to a held G; a turn of
# three; a D flat held across the bar line into its own chord; down to the low G and up from under; the top B flat;
# a jump to the high C; and the whole scale down to C.
TUNE = (
    "C5:.5 Db5:.25 E5:.25 G5:1.5 F5:.5 E5:1 | F5:1/3 E5:1/3 Db5:1/3 E5:1.5 Db5:.5 C5:.5 Db5:1 | F5:.5 Ab5:1.5 G5:.5 F5:.5 Db5:.5 | "
    "E5:1.5 C5:.5 G4:1 Bb4:.5 C5:.5 | Db5:.75 C5:.25 Bb4:.5 Db5:.5 F5:1.5 E5:.5 | F5:2/3 Ab5:2/3 Bb5:2/3 Ab5:1 G5:.5 F5:.5 | "
    "G5:1 E5:.5 G5:.5 C6:2 | Bb5:1/3 Ab5:1/3 G5:1/3 F5:.5 E5:.5 Db5:1 C5:1"
)
# Tusks: whose note each of the tune's is before they fuse: o the oud's (an octave down, on the left), q the qanun's.
WHO = "oooqoo qqqqooo oqooo qoooo ooooqq qqqooo oooq qqqqqoo".replace(" ", "")
# The second tune, in ten (bars of five beats: 3+2+2+3 8ths), on F: the fiddle's two bars, the ney's two, two together.
TEN_FIDDLE = (
    "C5:1.5 Db5:.5 C5:.5 Bb4:.5 Ab4:.5 Bb4:1.5 | C5:1 F5:.5 Ab5:1 G5:.5 F5:.5 Eb5:.5 F5:1 | -:10 | "
    "F5:1.5 G5:.5 Ab5:1 C6:1.5 Bb5:.5 | Ab5:1 F5:.5 Db5:1 E5:.5 Db5:.5 C5:1.5"
)
TEN_NEY = (
    "-:10 | Ab5:1.5 F5:.5 Ab5:.5 Bb5:1 Ab5:.5 F5:1 | E5:1.5 F5:.25 E5:.25 Db5:.5 C5:1 Db5:.5 E5:1 | "
    "C5:1.5 Eb5:.5 F5:1 Ab5:1.5 G5:.5 | F5:1 Db5:.5 Ab4:1 G4:.5 Bb4:.5 G4:1.5"
)
# The temple (the calms): the ney's slow way down the scale; later the fiddle with the tune's first phrase, slowly.
CALM_NEY = "G4:2 Ab4:.5 G4:.5 F4:1 E4:2 Db4:1 C4:3"
CALM2_FIDDLE = "C5:.5 Db5:.25 E5:.25 G5:2 F5:.5 E5:1.5 Db5:1 C5:2.5"
# The lift: up the scale to the top, as he rears.
LIFT = "G4:.5 Ab4:.5 Bb4:.5 C5:.5 Db5:.5 E5:.5 F5:.5 G5:.5 | Ab5:.5 Bb5:.5 C6:.5 Db6:.5 E6:2"
# The Slam: the 808's stomps (C, and the half step up); the gritty synth's riff (silent on the first beat: the thud's),
# the lead's answer, then both, an octave apart.
DROP_SUB = "C2:2.5 C2:1.5 | C2:1.5 Db2:2.5 | C2:2.5 C2:1.5 | Bb1:2 Db2:2 | C2:2.5 C2:1.5 | C2:1.5 Db2:2.5 | Db2:2 Db2:2 | C2:2.5 C2:1.5"
DROP_GRIT = (
    "-:1 C4:.75 Db4:.25 E4:1 Db4:.5 C4:.5 | G3:.5 Ab3:.5 G3:.5 E3:.5 F3:1 Db3:.5 C3:.5 | -:4 | -:4 | "
    "C4:.75 Db4:.25 E4:1 Db4:.5 C4:.5 -:1 | F4:1 Ab4:1.5 G4:.5 F4:.5 Db4:.5 | Ab4:2/3 F4:2/3 Db4:2/3 F4:1 E4:1 | G4:1/3 F4:1/3 E4:1/3 Db4:.5 C4:.5 C4:1 -:1"
)
DROP_LEAD = "-:8 | C5:.75 Db5:.25 E5:1 G5:1.5 F5:.5 | F5:2/3 Db5:2/3 Bb4:2/3 Db5:1 C5:1 | -:16"
# The dance: a figure on C, on E, on G, and down; then runs, as it speeds up.
DANCE = (
    "C5:.5 C5:.25 Db5:.25 E5:.5 Db5:.5 C5:.5 Bb4:.5 C5:1 | E5:.5 E5:.25 F5:.25 G5:.5 F5:.5 E5:.5 Db5:.5 E5:1 | "
    "G5:.5 G5:.25 Ab5:.25 Bb5:.5 Ab5:.5 G5:.5 F5:.5 G5:1 | C6:.5 Bb5:.25 Ab5:.25 G5:.5 F5:.5 E5:.5 Db5:.5 C5:1 | "
    "C5:.25 Db5:.25 E5:.25 F5:.25 G5:.5 E5:.5 G5:.5 Ab5:.5 G5:1 | Bb5:.5 Ab5:.25 G5:.25 Ab5:.5 G5:.25 F5:.25 G5:.5 F5:.25 E5:.25 F5:1 | "
    "E5:.25 F5:.25 G5:.25 Ab5:.25 Bb5:.5 C6:.5 Db6:1 C6:1 | Bb5:.25 Ab5:.25 G5:.25 F5:.25 E5:.25 Db5:.25 C5:.5 C5:.5 C5:.5 C5:1"
)
TAG = "C5:.75 Db5:.25 E5:1 Db5:1 C5:1"

for _name, _beats in ((TUNE, 32), (TEN_FIDDLE, 30), (TEN_NEY, 30), (CALM_NEY, 10), (CALM2_FIDDLE, 8.5), (LIFT, 8), (DROP_SUB, 32), (DROP_GRIT, 32),
                      (DROP_LEAD, 32), (DANCE, 32), (TAG, 4)):
    assert beats(_name) == _beats, (_name[:30], beats(_name))
assert len(WHO) == len(notes(0, TUNE))


def main(out: str) -> None:
    x = Ride([(a, b, t0, t1, 1.0, 1.0, 0.0) for a, b, t0, t1 in PACE], BEATS, SECS, os=2, seed=223)
    put, at = x.put, x.at
    rng = np.random.default_rng(53)
    sr = x.sr
    tau = 2 * np.pi
    levels = {"lead": 1.25, "fiddle": 1.0, "ney": 1.0, "oud": 2.8, "qanun": 4.2, "cave": 2.6, "ost": 3.5, "bass": 0.58, "sub": 0.5, "wobble": 0.8,
              "kick": 1.0, "snare": 2.0, "hats": 4.0, "drum": 1.5, "perc": 1.4, "riq": 2.5, "hum": 4.5, "grit": 1.1, "fx": 1.2, "horn": 1.0,
              "wind": 1.0}

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def murk(k, cut):
        """Noise with its highs rolled off twice: a rumble or a breath, never a hiss."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same"), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    def sand(ch):
        name, _, shift = ch.partition("+")
        root, five = SAND[name]
        up = int(shift or 0)
        return n(root) + up, [n(c) + up for c in five.split()]

    # ---- the kit: a darbuka (dum, tek, ka), a riq, finger cymbals; and under them a kick, a snare, an 808 ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the hum and the fast pattern duck

    def snare(b, vol=0.26):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def hat(b, vol=0.035):
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 11000, 0.8) * np.exp(-t / 0.014) * tail(k, 0.004) * vol, 0.3)

    def clap(b, vol=0.2):
        kk = int(0.02 * sr)
        for late in (0, 0.011, 0.023):
            put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.006) * vol * 0.7, late=late)
        kk = int(0.2 * sr)
        put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol, late=0.03)

    def dum(b, vol=0.3, late=0.0):
        """The darbuka's low stroke: the middle of the skin, a round thump."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(72 + 60 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.11) + 0.25 * hiss(k, 2500) * np.exp(-t / 0.006)
        put("perc", b, w * tail(k) * vol, -0.1, late=late)

    def tek(b, vol=0.16, pan=0.3, late=0.0, pitch=1.0):
        """Its high stroke: the rim, sharp, a short ring."""
        k = int(0.14 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * 540 * pitch * t) + 0.6 * np.sin(tau * 1180 * pitch * t + 1) + 0.3 * np.sin(tau * 2350 * pitch * t + 2)
        put("perc", b, (w * np.exp(-t / 0.028) + 0.9 * hiss(k, 12000, 0.6) * np.exp(-t / 0.004)) * np.minimum(1, t / 0.0006) * tail(k) * vol, pan, late=late)

    def ka(b, vol=0.07, late=0.0):
        """The other hand's tek: softer, a little lower, on the other side."""
        tek(b, vol, -0.3, late, 0.88)

    def riq(b, vol=0.05, pan=0.4):
        """A riq's jingles, shaken once."""
        k = int(0.12 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for _ in range(3):
            t0, f = rng.uniform(0, 0.012), rng.uniform(3600, 5400)
            age = np.maximum(0, t - t0)
            w += (t >= t0) * np.exp(-age / 0.03) * (np.sin(tau * f * age) + 0.5 * np.sin(tau * 1.47 * f * age))
        put("riq", b, (0.3 * w + hiss(k, 16000, 0.9) * np.exp(-t / 0.025)) * tail(k) * vol, pan)

    def zill(b, vol=0.05, pan=-0.4, pitch=1.0, late=0.0):
        """A finger cymbal: a high, clean ting that rings."""
        k = int(1.2 * sr)
        t = np.arange(k) / sr
        f = 2900 * pitch
        w = np.sin(tau * f * t) + 0.7 * np.sin(tau * 1.503 * f * t + 1) + 0.35 * np.sin(tau * 2.11 * f * t + 2)
        put("riq", b, w * np.exp(-t / 0.28) * np.minimum(1, t / 0.0008) * tail(k) * vol, pan, late=late)

    def darbuka_roll(b, length, v0=0.04, v1=0.16, step=0.25):
        count = int(round(length / step))
        for i in range(count):
            (tek if i % 2 == 0 else ka)(b + i * step, v0 + (v1 - v0) * i / max(1, count - 1))

    def roll(b, length, v0=0.06, v1=0.24, step=0.25):
        count = int(round(length / step))
        for i in range(count):
            snare(b + i * step, v0 + (v1 - v0) * i / max(1, count - 1))

    # ---- the low end ----
    def bass(b, m, length, vol=0.4):
        """A deep note driven so small speakers hear it, with a round pluck an octave up."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        env = np.minimum(1, t / 0.006) * np.exp(-t / (k / sr * 2.0)) * tail(k, 0.02)
        w = np.tanh(2.2 * np.sin(ph)) / np.tanh(2.2) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        mid = 0.45 * np.sin(2 * ph + 1.6 * np.exp(-t / 0.09) * np.sin(2 * ph)) * np.exp(-t / 0.3)
        put("bass", b, (w + mid) * env * vol)

    def sub(b, m, length, vol=0.5, swell=False):
        """The 808; `swell`: no thump, the note growing instead (the temple's deep bass)."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** ((0 if swell else 12) * np.exp(-t / 0.012) / 12)) / sr
        env = (np.sin(np.pi * np.linspace(0, 1, k)) ** 0.7 if swell else np.exp(-t / (k / sr * 0.6))) * tail(k, 0.03)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def wobble(b, m, length, rate, vol=0.2, top=18.0):
        """The wobble bass: a sawtooth whose brightness sweeps open and shut `rate` times a beat, driven hard."""
        at(b, length)
        k = x.k(length)
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

    # ---- Alfil's own sounds, as the game builds them (alfil-sounds.ts) ----
    def thump(k, start, end, decay, dirt=1.0):
        t = np.arange(k) / sr
        return np.exp(-t / decay) * (np.sin(tau * np.cumsum(end + (start - end) * np.exp(-t / 0.03)) / sr) + dirt * 0.35 * murk(k, 500))

    def stomp(b, vol=0.3):
        """A stomp: a thump in the ground, a puff of dirt."""
        k = int(0.45 * sr)
        put("fx", b, thump(k, 110, 48, 0.13) * tail(k) * vol)

    def thud(b, vol=0.5):
        """The Slam landing: a ground-shaking thud, the floor still rumbling after it."""
        k = int(1.0 * sr)
        t = np.arange(k) / sr
        put("fx", b, (1.5 * thump(k, 90, 34, 0.22, 1.2) + 0.6 * np.exp(-t / 0.3) * murk(k, 140)) * tail(k, 0.05) * vol)

    def trumpet(b, big=False, vol=0.12, pan=0.0):
        """His trumpet: a brassy, buzzing reed through the trunk's two resonances, rough with a growl and a little
        breath. The short one tops out on E, the big one (his leap) climbs to G."""
        secs = 0.9 if big else 0.55
        k = int(secs * sr)
        t = np.arange(k) / sr
        if big:
            f = (300 + 520 * np.minimum(1, t / 0.32) + 30 * np.sin(tau * 7 * t) - 160 * np.maximum(0, t - 0.7) / 0.2) * 0.956
            env = np.minimum(1, t / 0.06) * np.where(t < 0.66, 1, np.maximum(0, 1 - (t - 0.66) / 0.24))
        else:
            f = (380 + 260 * np.minimum(1, t / 0.07) + 22 * np.sin(tau * 9 * t) - 120 * np.maximum(0, t - 0.38) / 0.17) * 1.03
            env = np.minimum(1, t / 0.04) * np.where(t < 0.36, 1, np.maximum(0, 1 - (t - 0.36) / 0.19))
        ph = tau * np.cumsum(f) / sr
        w = np.zeros(k)
        for h in range(1, 16):
            fh = h * f
            horn = 0.8 / np.sqrt(1 + 1.96 * (fh / 1150 - 1150 / fh) ** 2) + 0.6 / np.sqrt(1 + 1.44 * (fh / 520 - 520 / fh) ** 2) / np.sqrt(1 + (fh / 2400) ** 2)
            w += np.sin(h * ph) / h * horn
        w = w * (0.75 + 0.25 * np.sin(tau * 31 * t)) + 0.12 * murk(k, 2600)
        put("horn", b, w * env * vol, pan)

    def crunch(b, vol=0.2):
        """Two pawns fusing: a grinding crunch, stone on stone, in uneven bites."""
        k = int(0.55 * sr)
        w = np.zeros(k)
        kk = int(0.014 * sr)
        for i in range(44):
            j = int((i / 44 + rng.uniform(0, 0.015)) * 0.5 * sr)
            w[j : j + kk] += rng.uniform(0.25, 1.0) * hiss(kk, 3200, 0.3) * np.exp(-np.arange(kk) / sr / 0.005)
        t = np.arange(k) / sr
        put("fx", b, (w + 0.3 * murk(k, 300) * np.sin(np.pi * t / 0.55)) * np.sin(np.pi * np.minimum(1, t / 0.5)) ** 0.5 * tail(k) * vol)

    def glow(b, length, vol=0.05):
        """His pawns lighting up: a soft shimmer, rising."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(x.hz(84) * 2 ** (u * 2 / 12)) / sr
        put("fx", b, (np.sin(ph) + 0.6 * np.sin(1.498 * ph) + 0.15 * hiss(k, 14000, 0.9)) * np.sin(np.pi * u) ** 1.5 * (1 + 0.3 * np.sin(tau * 9 * u * k / sr)) * vol)

    def whoosh(b, vol=0.2, secs=0.6):
        """The pieces flying up: air, rising."""
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        w = np.concatenate([hiss(k // 6 + 1, 1500 + 9000 * (i / 5) ** 1.5, 0.5) for i in range(6)])[:k]
        put("fx", b, w * np.sin(np.pi * u) ** 1.5 * vol)

    def rumble(b, length, vol=0.12):
        """He comes on: the ground, low."""
        at(b, length)
        k = x.k(length)
        put("fx", b, murk(k, 140) * np.sin(np.pi * np.linspace(0, 1, k)) ** 1.5 * vol)

    def wind(b, length, vol=0.06, pan=0.0):
        """Desert wind: a breath of air that swells and dies."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        put("wind", b, murk(k, 900) * np.sin(np.pi * np.linspace(0, 1, k)) ** 1.5 * (1 + 0.3 * np.sin(tau * 0.7 * t)) * vol, pan)

    # ---- the plucked strings ----
    strings = {}

    def string(kind, m, secs, bend=0.0):
        """One pluck, its loudest point 1. Built from its harmonics, each dying at its own speed (the high ones
        fastest), on two or three strings a hair apart (the instruments' strings come in pairs and threes).
        The oud: deep and woody (its bowl lifts two bands of its low middle), quick to die, a soft thump under the
        pick; `bend`: it slides in from that many half steps away. The qanun: bright, metal, a long ring. The saz:
        twangy, with a string an octave up in the pair."""
        key = (kind, m, round(secs, 2), round(bend, 1))
        if key in strings:
            return strings[key]
        f0 = x.hz(m)
        k = int(secs * sr)
        t = np.arange(k) / sr
        # (cents off, seconds late, level, octave) for each string of the course; the brightest harmonic; how fast the
        # harmonics thin; where it's plucked; how long the note lasts; how much faster each harmonic dies than the last
        if kind == "oud":
            course, top, tilt, where, life, damp = ((-3.5, 0.0, 1.0, 1), (3.5, 0.006, 0.9, 1)), 4500, 1.15, 0.2, 0.32 * (196 / f0) ** 0.3, 0.5
        elif kind == "qanun":
            course, top, tilt, where, life, damp = ((-5, 0.0, 1.0, 1), (0, 0.003, 0.9, 1), (5.5, 0.006, 0.8, 1)), 9000, 0.75, 0.12, 0.6 * (262 / f0) ** 0.3, 0.1
        else:
            course, top, tilt, where, life, damp = ((-4, 0.0, 1.0, 1), (4, 0.004, 0.6, 2)), 8000, 0.85, 0.1, 0.4 * (196 / f0) ** 0.3, 0.2
        w = np.zeros(k)
        glide = 2 ** (bend * np.exp(-t / 0.05) / 12)
        for cents, late, level, octave in course:
            f = f0 * octave * 2 ** (cents / 1200)
            h = np.arange(1, max(2, int(top / f) + 1))
            amp = np.abs(np.sin(np.pi * h * where)) / h**tilt
            if kind == "oud":
                amp = amp * (1 + 0.9 * np.exp(-((np.log2(h * f / 190)) / 0.5) ** 2) + 0.6 * np.exp(-((np.log2(h * f / 520)) / 0.45) ** 2))
            stiff = np.sqrt(1 + (0.00012 if kind != "oud" else 0.00004) * h * h)
            ph = tau * np.cumsum(f * glide) / sr
            part = (amp[:, None] * np.sin(np.outer(h * stiff, ph) + h[:, None] * 1.3) * np.exp(-np.outer(1 + damp * h, t) / life)).sum(axis=0)
            shift = int(late * sr)
            w[shift:] += level * part[: k - shift]
        pick = hiss(k, 9000 if kind != "oud" else 3500, 0.5) * np.exp(-t / (0.002 if kind != "oud" else 0.004)) * (0.5 if kind != "oud" else 0.35)
        w = w / (np.max(np.abs(w)) + 1e-9) + pick
        if kind == "oud":
            w += 0.3 * np.sin(tau * 95 * t) * np.exp(-t / 0.03)
        strings[key] = w * np.minimum(1, t / 0.0008) * tail(k, 0.02)
        return strings[key]

    def pluck(b, m, kind="oud", vol=0.12, pan=0.0, secs=0.9, bend=0.0, bus=None, late=0.0):
        put(bus or kind, b, string(kind, m, secs, bend) * vol, pan, late=late)

    def tremolo(b, d, m, kind="oud", vol=0.12, pan=0.0, bus=None):
        """A long note as these instruments hold one: struck again and again, about a dozen times a second, the first
        stroke the strongest, swelling a little through the note."""
        at(b, d)
        secs = d * x.beat_s
        count = max(2, int(secs * 12.5))
        w = string(kind, m, 0.3 if kind == "oud" else 0.45)
        for i in range(count):
            swell = 0.75 + 0.25 * np.sin(np.pi * i / (count - 1))
            put(bus or kind, b, w * vol * swell * (1.0 if i == 0 else 0.62) * rng.uniform(0.85, 1.0), pan, late=i * secs / count)

    def plucked(line, kind="oud", vol=1.0, pan=0.0, bus=None, held=1.0):
        """A line on a plucked instrument: notes of `held` beats or more in tremolo; the oud slides into a note a step
        from the last."""
        last = None
        for b, d, m in line:
            if d >= held:
                tremolo(b, d, m, kind, 0.12 * vol, pan, bus)
            else:
                at(b, d)
                bend = 0.5 * (last - m) if kind == "oud" and last is not None and 0 < abs(last - m) <= 2 and d >= 0.5 else 0.0
                pluck(b, m, kind, 0.13 * vol, pan, float(np.clip(d * x.beat_s * 1.8, 0.35, 1.2)), bend, bus)
            last = m

    def strum(b, names, vol=0.2, kind="oud", bus="cave", gap=0.07, secs=2.2):
        """A big pluck: open strings, low to high, one just after another."""
        for i, name in enumerate(names.split()):
            pluck(b, n(name), kind, vol * (1 - 0.1 * i), -0.2 + 0.2 * i, secs, 0.0, bus, late=i * gap)

    def gliss(b, vol=0.035, lo=0, hi=15, step=0.045, bus="cave", pan=0.3):
        """The qanun's sweep: up the scale, a string at a time."""
        for i, m in enumerate(HIJAZ[lo:hi]):
            pluck(b, m, "qanun", vol * (0.7 + 0.3 * i / (hi - lo)), pan - 0.04 * i, 0.9, 0.0, bus, late=i * step)

    def ost(b, count, ch, vol=1.0, keep=1, glints=0.2):
        """`count` beats of the fast pattern: 16ths on the chord's five, coming back to C, each at its own loudness,
        some with a glint an octave up. A qanun, struck short."""
        five = sand(ch)[1]
        first = int(round(b * 4))
        for i in range(count * 4):
            if i % keep:
                continue
            m = five[PAT[(first + i) % 16]]
            loud = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 4 == 0 else 1.0)
            pan = 0.5 * np.sin((first + i) * 1.7)
            pluck(b + i * 0.25, m, "qanun", 0.05 * loud, pan, 0.3, 0.0, "ost")
            if rng.uniform() < glints:
                pluck(b + i * 0.25 + 0.125, m + 12, "qanun", 0.02 * loud, -pan, 0.3, 0.0, "ost")

    # ---- the voices ----
    def sing(b, d, m, vol=0.1, mouth=0.0, pan=0.0, singers=3):
        """The hum: voices with no words, three a little apart, their vibrato their own; `mouth` from closed (0) to "ah"."""
        at(b, d)
        k = x.k(d * 1.02)
        t = np.arange(k) / sr
        f0 = x.hz(m)
        f1, f2, f3 = 300 + 450 * mouth, 750 + 450 * mouth, 2700
        gains = []
        for h in range(1, int(4000 / f0) + 1):
            fh = h * f0
            g = 1.0 / np.sqrt(1 + 30 * (fh / f1 - f1 / fh) ** 2) + 0.5 / np.sqrt(1 + 40 * (fh / f2 - f2 / fh) ** 2) + 0.1 / np.sqrt(1 + 60 * (fh / f3 - f3 / fh) ** 2) + 0.02
            gains.append(g / h**1.3)
        w = np.zeros(k)
        for s in range(singers):
            vib = 1 + 0.005 * np.sin(tau * (4.6 + 0.45 * s) * t + rng.uniform(0, tau)) * np.clip((t - 0.2) / 0.4, 0, 1)
            ph = tau * np.cumsum(f0 * 2 ** (rng.uniform(-10, 10) / 1200) * vib) / sr
            for h, g in enumerate(gains, 1):
                w += g * np.sin(h * ph + rng.uniform(0, tau))
        w = w / singers + 0.015 * hiss(k, 4000, 0.5)
        put("hum", b, w * np.minimum(1, t / 0.25) * tail(k, 0.3) * vol, pan)

    def hum(b, d, root=48, vol=0.07, mouth=0.0):
        """The hum: the note and the fifth over it, one voice left and one right, and the note again an octave up."""
        sing(b, d, root, vol, mouth, -0.35), sing(b, d, root + 7, vol * 0.8, mouth, 0.35), sing(b, d, root + 12, vol * 0.4, mouth, 0.0, 2)

    def driven(line, vol=1.0, pan=0.0):
        """The elephant: the overdriven lead. A long note that follows another straight on slides in from most of
        the way back."""
        last = None
        for b, d, m in line:
            glide = 0.6 * (last[1] - m) if last and abs(last[0] - b) < 1e-6 and d >= 1 and 0 < abs(last[1] - m) <= 12 else 0.0
            at(b, d)
            put("lead", b, x.drive(m, d * 0.96, 0.16 * vol, glide=glide), pan)
            last = (b + d, m)

    def fiddle(line, vol=1.0, pan=0.25, bus="fiddle"):
        for b, d, m in line:
            at(b, d)
            put(bus, b, x.fiddle(m, d * 0.95, 0.145 * vol), pan)

    def ney(line, vol=1.0, pan=-0.25, bus="ney"):
        """A reed flute: breathy, each note leaning up into place."""
        for b, d, m in line:
            at(b, d)
            w = x.tone(m, d * 0.97, [1, 0.3, 0.12, 0.05, 0.02], 0.2 * vol, vib=0.006, vib_hz=5.0, scoop=0.5, scoop_s=0.05, attack=0.05, release=0.08)
            k = len(w)
            air = np.convolve(hiss(k, 9000, 0.6), np.ones(8) / 8, "same") * (0.03 + 0.12 * np.exp(-np.arange(k) / sr / 0.06)) * vol
            put(bus, b, w + air * np.minimum(1, np.arange(k) / (0.03 * sr)) * tail(k, 0.08), pan)

    def grit(line, vol=1.0, pan=0.3):
        for b, d, m in line:
            at(b, d)
            put("grit", b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def stutter(b, m, count=4, vol=0.6):
        for i in range(count):
            at(b + i * 0.125, 0.1)
            put("grit", b + i * 0.125, x.gritty(m, 0.1, 0.21 * vol * (1 - 0.6 * i / count)), 0.4 if i % 2 else -0.4)

    # ---- the band, bar by bar ----
    def maqsum(b, i, ch, heavy=True, fill=False, vol=1.0, glints=0.2, pattern=True):
        """A bar of four in the maqsum: dum, tek, (nothing), tek, dum, (nothing), tek, (nothing), the other hand
        filling the 16ths between; a riq on the 8ths; the bass on the dums (C, its fifth, C). `heavy`: a kick under
        the dums and a snare under the last tek."""
        dum(b, 0.3 * vol), dum(b + 2, 0.28 * vol)
        tek(b + 0.5, 0.16 * vol), tek(b + 1.5, 0.15 * vol), tek(b + 3, 0.17 * vol)
        for o in (0.75, 1.25, 1.75, 2.5, 2.75, 3.5, 3.75) + ((3.25,) if i % 2 else ()):
            ka(b + o, 0.06 * vol)
        for o in range(8):
            riq(b + o * 0.5, 0.05 if o % 2 == 0 else 0.03)
        root = sand(ch)[0]
        bass(b, root, 0.9, 0.4), bass(b + 1.5, root + 12, 0.4, 0.28), bass(b + 2, root, 0.9, 0.38), bass(b + 3, root + 7, 0.45, 0.3), bass(b + 3.5, root + 12, 0.4, 0.28)
        if heavy:
            kick(b, 0.5), kick(b + 2, 0.48), snare(b + 3, 0.22)
            if i % 2:
                kick(b + 1.5, 0.34)
        if fill:
            darbuka_roll(b + 3, 1, 0.08, 0.18)
        if pattern:
            ost(b, 4, ch, vol, 1, glints)

    def samai(b, ch):
        """A bar of ten 8ths, 3+2+2+3: dum, tek, dum dum, tek."""
        dum(b, 0.3), dum(b + 2.5, 0.26), dum(b + 3, 0.28), tek(b + 1.5, 0.16), tek(b + 3.5, 0.17)
        for o in (0.5, 1.0, 2.0, 4.0, 4.25, 4.5, 4.75):
            ka(b + o, 0.06)
        kick(b, 0.5), kick(b + 2.5, 0.4), kick(b + 3, 0.46), snare(b + 1.5, 0.14), snare(b + 3.5, 0.22)
        for o in range(10):
            riq(b + o * 0.5, 0.05 if o in (0, 3, 5, 7) else 0.03)
        root = sand(ch)[0]
        bass(b, root, 1.4, 0.4), bass(b + 1.5, root + 12, 0.45, 0.28), bass(b + 2.5, root, 0.45, 0.36), bass(b + 3, root, 0.9, 0.38), bass(b + 4.5, root + 12, 0.4, 0.28)
        pluck(b, root + 12, "oud", 0.1, -0.4, 0.9), pluck(b + 3, root + 19, "oud", 0.08, -0.4, 0.9)
        ost(b, 5, ch, 1.0, 1, 0.25)

    WOB = [((2.5, 1), (1.5, 3)), ((1.5, 2), (2.5, 0.5)), ((2.5, 2), (1.5, 4)), ((2, 1), (2, 3))]

    def slam(b, k, ch):
        """A drop bar, half-time: the stomp (a kick and a thump in the ground) with each of the 808's notes, a clap and
        the snare on 3, the darbuka running on in 16ths over it, the wobble bass at changing speeds."""
        clap(b + 2), snare(b + 2, 0.24)
        for i in range(16):
            (tek if i % 4 in (0, 3) else ka)(b + i * 0.25, 0.09 if i % 4 == 0 else 0.05)
            hat(b + i * 0.25, 0.03 if i % 4 == 2 else 0.018)
        for o in range(8):
            riq(b + o * 0.5, 0.04)
        t = b
        for d, rate in WOB[k % 4]:
            wobble(t, sand(ch)[0] + 12, d, rate, 0.17)
            t += d
        ost(b, 4, ch, 0.9, 1, 0.3)

    def ayoub(b, i, vol=1.0):
        """A bar of the dance, the ayoub twice: dum, (ka), dum, tek; a kick on every beat, a clap on 2 and 4."""
        for o in (0, 2):
            dum(b + o, 0.3 * vol), ka(b + o + 0.75, 0.07), dum(b + o + 1, 0.26 * vol), tek(b + o + 1.5, 0.16 * vol)
            kick(b + o, 0.5), kick(b + o + 1, 0.46)
            clap(b + o + 1, 0.16), snare(b + o + 1, 0.16)
        for o in range(8):
            riq(b + o * 0.5, 0.05 if o % 2 == 0 else 0.035)
            bass(b + o * 0.5, n("C2") + (12 if o % 2 else 0), 0.46, 0.4 if o % 2 == 0 else 0.3)
        ost(b, 4, "Db/C" if i % 4 == 2 else "C", vol, 1, 0.3)

    # 0:00 The taqsim: free, a beat a second. The hum (C and G), a deep note under it, wind; a big pluck of the oud's
    # open strings; the oud alone, low, in the scale; the qanun's sweep; the oud again with the tune's first notes; a
    # finger cymbal now and then. Then the ground rumbles, he trumpets, and the darbuka rolls in.
    hum(0, 12.5, 48, 0.07)
    sub(0, n("C2"), 12, 0.18, swell=True)
    wind(0, 7, 0.06, -0.3), wind(5, 7, 0.07, 0.3)
    strum(0, "C2 G2 C3", 0.24)
    plucked(notes(1.6, "G3:.6 Ab3:.3 G3:.3 F3:.5 E3:1.3 Db3:.6"), "oud", 1.5, -0.1, "cave")
    pluck(5.2, n("C3"), "oud", 0.2, -0.1, 2.2, 0.5, "cave")
    gliss(5.9, 0.035)
    plucked(notes(7.0, "C4:.5 Db4:.25 E4:.25 G4:1.4 F4:.4 E4:.6 Db4:.4"), "oud", 1.5, -0.1, "cave")
    pluck(10.8, n("C4"), "oud", 0.2, -0.1, 2.2, 0.5, "cave")
    zill(3.2, 0.04), zill(6.4, 0.04, 0.4, 1.12), zill(9.0, 0.04)
    rumble(9.3, 2.7, 0.14)
    trumpet(10.5, False, 0.09, 0.3)
    for i in range(14):  # the roll: strokes coming faster
        (tek if i % 2 == 0 else ka)(11.0 + (i / 14) ** 0.7, 0.05 + 0.008 * i)
    for i in range(8):
        riq(11.0 + i * 0.125, 0.03 + 0.004 * i)

    # 0:12 Tusks, the two pawns: the tune, shared out. The oud (left, an octave down) and the qanun (right) each play
    # only their own notes of it and never together. The darbuka's maqsum, a riq, the bass on C; from the fifth bar a
    # kick and a snare under them and the fast pattern.
    tune = notes(T_PAWNS, TUNE)
    plucked([(b, d, m - 12) for (b, d, m), who in zip(tune, WHO) if who == "o"], "oud", 1.25, -0.45)
    plucked([(b, d, m) for (b, d, m), who in zip(tune, WHO) if who == "q"], "qanun", 1.0, 0.45)
    hum(T_PAWNS, 32.5, 48, 0.05)
    for i, ch in enumerate(TUNE_CH):
        maqsum(T_PAWNS + 4 * i, i, ch, heavy=i >= 4, fill=i in (3, 7), pattern=i >= 4)
    zill(T_PAWNS, 0.04), zill(T_PAWNS + 16, 0.04, 0.4, 1.12)
    glow(T_FUSED - 3, 3, 0.06)
    crunch(T_FUSED - 0.75, 0.22)

    # 0:29 Fused: the elephant. The overdriven lead has the whole tune, the oud and the qanun both on it with him; the
    # fiddle joins an octave under for its last four bars.
    boom(T_FUSED, 0.7), x.crash(T_FUSED, 0.16, decay=0.5), stomp(T_FUSED, 0.3)
    tune = notes(T_FUSED, TUNE)
    driven(tune)
    plucked([(b, d, m - 12) for b, d, m in tune], "oud", 0.75, -0.4)
    plucked(tune, "qanun", 0.6, 0.4)
    fiddle([(b, d, m - 12) for b, d, m in tune if b >= T_FUSED + 16], 0.7)
    hum(T_FUSED, 32.5, 48, 0.05)
    for i, ch in enumerate(TUNE_CH):
        maqsum(T_FUSED + 4 * i, i, ch, fill=i in (3, 7), glints=0.3)
    trumpet(T_FUSED + 15.3, False, 0.08, -0.3)
    x.crash(T_FUSED + 16, 0.1, decay=0.4)

    # 0:45 The second tune, in ten, on F: the fiddle's two bars, the ney's two, then two together; the oud on the
    # rhythm's low strokes.
    x.crash(T_TEN, 0.14, decay=0.5)
    fiddle(notes(T_TEN, TEN_FIDDLE))
    ney(notes(T_TEN, TEN_NEY))
    hum(T_TEN, 10.2, 53, 0.05), hum(T_TEN + 10, 5.1, 49, 0.05), hum(T_TEN + 15, 5.1, 48, 0.05), hum(T_TEN + 20, 5.1, 53, 0.05)
    hum(T_TEN + 25, 5.1, 48, 0.05)
    for i, ch in enumerate(TEN_CH):
        samai(T_TEN + 5 * i, ch)
    darbuka_roll(T_CALM - 1, 1, 0.08, 0.2)

    # 0:58 The temple, the first calm: the hum, a deep note, wind; big plucks of the oud's open strings in a long
    # echo; the ney coming slowly down the scale; finger cymbals.
    stomp(T_CALM, 0.25)
    hum(T_CALM, 10.3, 48, 0.08)
    sub(T_CALM, n("C2"), 10, 0.18, swell=True)
    wind(T_CALM, 6, 0.06, 0.3), wind(T_CALM + 4, 6, 0.06, -0.3)
    strum(T_CALM, "C2 G2 C3", 0.24)
    ney(notes(T_CALM, CALM_NEY), 0.3, -0.15, "cave")
    plucked(notes(T_CALM + 3.5, "C3:.5 G3:.5 C4:1"), "oud", 1.3, -0.1, "cave", held=9)
    strum(T_CALM + 6, "G2 C3 G3", 0.2)
    gliss(T_CALM + 8.2, 0.03, 4, 15)
    zill(T_CALM + 1.5, 0.045), zill(T_CALM + 5, 0.045, 0.4, 1.12), zill(T_CALM + 8.5, 0.045)

    # 1:09 The lift: he rears. The fiddle and the qanun climb the scale; the darbuka rolls, faster; the bass and the
    # kick push; his pawns glow.
    fiddle(notes(T_LIFT, LIFT), 0.9)
    plucked(notes(T_LIFT, LIFT), "qanun", 0.9, 0.4, held=2)
    hum(T_LIFT, 8, 48, 0.07, 0.4)
    glow(T_LIFT, 8, 0.05)
    rumble(T_LIFT, 8, 0.12)
    darbuka_roll(T_LIFT, 6, 0.05, 0.16)
    darbuka_roll(T_LIFT + 6, 2, 0.12, 0.2, 0.125)
    for i in range(8):
        kick(T_LIFT + i, 0.4 + 0.015 * i)
        bass(T_LIFT + i, n("C2"), 0.46, 0.3 + 0.015 * i), bass(T_LIFT + i + 0.5, n("C3"), 0.46, 0.24 + 0.012 * i)
        riq(T_LIFT + i, 0.05), riq(T_LIFT + i + 0.5, 0.04)

    # 1:12 Mammoth Slam. Up: his big trumpet and a whoosh, and the band is in the air: four beats of finger cymbals,
    # a riq, wind and a thin high hum, nothing under them.
    trumpet(T_AIR, True, 0.16)
    whoosh(T_AIR, 0.22)
    wind(T_AIR, 4.5, 0.08)
    sing(T_AIR, 3.6, 72, 0.03, 0.5, -0.3, 2), sing(T_AIR, 3.6, 79, 0.025, 0.5, 0.3, 2)
    for i in range(7):
        zill(T_AIR + 0.5 + i * 0.5, 0.05 - 0.004 * i, 0.5 * np.cos(i), 1.0 + 0.06 * (i % 3))
    for i in range(12):
        riq(T_AIR + 0.5 + i * 0.25, 0.035 - 0.002 * i)

    # 1:14 Down: the thud, alone on the first beat. Then the stomp, half-time: the 808 on C and the half step above it;
    # the gritty synth's riff, the lead's answer, then both an octave apart; his trumpet twice; a stutter after each
    # turn.
    thud(T_DROP, 0.55), boom(T_DROP, 0.8), x.crash(T_DROP, 0.2, decay=0.6)
    for b, d, m in notes(T_DROP, DROP_SUB):
        sub(b, m, d * 0.92, 0.45)
        kick(b, 0.6), stomp(b, 0.22)
    riff = notes(T_DROP, DROP_GRIT)
    grit(riff)
    driven(notes(T_DROP, DROP_LEAD) + [(b, d, m + 12) for b, d, m in riff if b >= T_DROP + 16])
    hum(T_DROP, 32.5, 48, 0.05, 0.3)
    for i, ch in enumerate(DROP_CH):
        slam(T_DROP + 4 * i, i, ch)
        if i in (4, 6):
            x.crash(T_DROP + 4 * i, 0.1, decay=0.4)
    trumpet(T_DROP + 7.2, False, 0.1, 0.3), trumpet(T_DROP + 23.2, False, 0.1, -0.3)
    for b, m, count in ((15, "C4", 8), (31, "C4", 4)):
        stutter(T_DROP + b, n(m), count)

    # 1:29 The dance, faster and faster: a figure on C, on E, on G and down, the qanun and the fiddle together; from
    # the fifth bar runs, with the lead; the ayoub, a clap on 2 and 4.
    x.crash(T_DANCE, 0.16, decay=0.5)
    dance = notes(T_DANCE, DANCE)
    plucked(dance, "qanun", 0.75, 0.4)
    fiddle(dance, 0.9)
    driven([(b, d, m) for b, d, m in dance if b >= T_DANCE + 16], 0.9)
    plucked([(b, d, m - 12) for b, d, m in dance if b >= T_DANCE + 16], "oud", 0.9, -0.4)
    hum(T_DANCE, 32, 48, 0.05, 0.3)
    for i in range(8):
        ayoub(T_DANCE + 4 * i, i)
        if i == 4:
            x.crash(T_DANCE + 16, 0.12, decay=0.4)
    darbuka_roll(T_CALM2 - 2, 2, 0.1, 0.22, 0.125)

    # 1:41 The temple again, the second calm: it stops on a stomp and his trumpet. The fiddle has the tune's first
    # phrase, slowly; the oud's big plucks; the qanun's sweep; the hum. Then the darbuka rolls back in.
    stomp(T_CALM2, 0.35), trumpet(T_CALM2 + 0.1, False, 0.1, 0.3), x.crash(T_CALM2, 0.14, decay=0.6)
    hum(T_CALM2, 10.3, 48, 0.08)
    sub(T_CALM2, n("C2"), 10, 0.18, swell=True)
    wind(T_CALM2, 6, 0.06, -0.3), wind(T_CALM2 + 4, 6, 0.06, 0.3)
    strum(T_CALM2 + 0.8, "C2 G2 C3", 0.22)
    fiddle(notes(T_CALM2 + 1.5, CALM2_FIDDLE), 0.35, 0.1, "cave")
    strum(T_CALM2 + 5.5, "G2 C3 G3", 0.18)
    gliss(T_CALM2 + 7.6, 0.03)
    zill(T_CALM2 + 3, 0.045), zill(T_CALM2 + 6.5, 0.045, 0.4, 1.12)
    glow(T_LAST - 2.5, 2.5, 0.06)
    for i in range(18):
        (tek if i % 2 == 0 else ka)(T_LAST - 2 + 2 * (i / 18) ** 0.7, 0.05 + 0.008 * i)
    crunch(T_LAST - 0.4, 0.2)

    # 1:51 The tune a fourth up, everyone on it: the lead, the oud and the qanun, the fiddle an octave under; his
    # trumpet at the half.
    boom(T_LAST, 0.7), x.crash(T_LAST, 0.18, decay=0.5), stomp(T_LAST, 0.3)
    tune = [(b, d, m + 5) for b, d, m in notes(T_LAST, TUNE)]
    driven(tune)
    plucked([(b, d, m - 12) for b, d, m in tune], "oud", 0.75, -0.4)
    plucked(tune, "qanun", 0.6, 0.4)
    fiddle([(b, d, m - 12) for b, d, m in tune], 0.7)
    hum(T_LAST, 32.3, 53, 0.05, 0.3)
    for i, ch in enumerate(TUNE_CH):
        maqsum(T_LAST + 4 * i, i, ch + "+5", fill=i in (3, 7), vol=1.05, glints=0.35)
    trumpet(T_LAST + 15.3, False, 0.09, 0.3)
    x.crash(T_LAST + 16, 0.12, decay=0.4)

    # 2:07 The tag: back to C by the half step, three stomps; then the oud's big open strings and the hum, which bar
    # 1 begins with.
    x.crash(T_TAG, 0.16, decay=0.5)
    driven(notes(T_TAG, TAG))
    plucked([(b, d, m - 12) for b, d, m in notes(T_TAG, TAG)], "oud", 0.8, -0.4)
    for o in (0, 2, 3):
        kick(T_TAG + o, 0.55), stomp(T_TAG + o, 0.25), dum(T_TAG + o, 0.3)
        bass(T_TAG + o, n("C2") + (1 if o == 2 else 0), 0.9, 0.4)
    ost(T_TAG, 4, "Db/C", 1.0, 1, 0.3)
    hum(T_TAG, 8.3, 48, 0.07)
    strum(T_TAG + 4, "C2 G2 C3", 0.22)
    thud(T_TAG + 4, 0.3)
    zill(T_TAG + 5.5, 0.04)
    wind(T_TAG + 4, 4, 0.05)

    # The long echo: the temple's plucks and its flute and fiddle ring on in a huge room (about four and a half seconds).
    def cavern(name, secs=4.5, wet=0.55):
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.03)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 3500) ** 2) * (f > 120), n=size, axis=1)

    cavern("cave")

    # The bass, the hum and (lightly) the fast pattern duck under each kick.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["hum"] *= 0.6 + 0.4 * gain
    x.buses["ost"] *= 0.75 + 0.25 * gain

    x.beat_s = 60 / 120  # the echoes' beat
    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("fiddle", 0.75, 0.16, 0.07)
    x.echo("ney", 0.75, 0.18, 0.07)
    x.echo("ost", 0.75, 0.2, 0.08)
    x.echo("qanun", 0.75, 0.16, 0.06)
    x.echo("horn", 1.0, 0.2, 0.08)
    write_wav(out, x.mixdown(levels, lowpass=8000, room=0.25))


if __name__ == "__main__":
    main(sys.argv[1])
