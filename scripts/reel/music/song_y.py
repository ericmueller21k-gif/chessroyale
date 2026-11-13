"""Song Y (Eric, Nov 13): Dash the cheetah's theme, a loop of about two minutes forty ("we can go 2.5 minutes, 3 minutes,
it's fine"). He sent a write-up of a style, made from another game's track that he likes ("it almost has this Tokyo
street style dub sound"): early-90s arcade FM dub-house. "Try to deploy as much of this as you can ... and then just
kind of also be sticking to the things that you've already done that I like as far as the way it's composed."
What is used from the write-up is the style's own means, none of them one song's: a house groove at about 126 beats a
minute, its 16th notes swung a little on the shaker, the hats and the organ, the kick and the snare straight; an
opening without the kick (a shaker, a rim, an organ's short chords, each with a dub echo); then the kick on every beat,
a clap on 2 and 4, an open hat on every off-beat, a bright piano's stabs, an FM slap bass popping octaves between
muted notes; a brassy lead that slides up into its long notes and ends its phrases in quick runs; a breakdown where a
squelching acid line slides about under chords thrown into a ping-pong echo; chords of ninths and sevenths.
What is not used: the write-up's chord loop (it is that track's own, moved a half step), or any tune, riff or bass
line of it. The track itself was not listened to, measured or transcribed, and every melody, riff and chord
progression here is original: none of it is any song's or any game's.
The recipe (SOUNDS.md) in this style. F minor with a raised sixth. The chords are a bar each, eight to the loop: the
bass walks down (F, E flat, D flat) under four notes that never move (A flat, C, E flat, G: with each bass note a
different chord of ninths), then B flat, C, A flat, a chord from outside the key (G flat) and the turn. The tune is
three bars and three and two, sliding into long notes, triplets across the beat, a quick run where a phrase ends. The
motif of an odd length is the acid line: seven 16ths, so it starts somewhere new in each bar. The drop walks by major
thirds (F minor, D flat minor, A minor). The last tune is a minor third up, in A flat.
The idea from his world that runs the song: his chess clock, and Tick, his tortoise. The fast pattern is the clock (a
tick on every 16th, a little bell pattern coming back to G). Dash steals your time: before the drop the ticks race
away, there is a hush with one tick-tock, he slams the clock, and the drop is his Time Scramble: the two leads' turns
get shorter (two bars each, then one, then half a bar four times) before they play together, the pace up a notch. The
two calms are Tick's: half the pace of everything (his plodding step where the kick was, his little bell, his chomp),
the acid line creeping, the chords echoing off; in the second the overdriven lead plays the tune slowly, and yawns.
Dash is the gritty lead; the square answers him in the gaps and trades with him in the drop; the overdriven lead has
the solo. His sounds, built as the game builds them (packages/app/src/characters/dash-sounds.ts): his sneakers'
squeak, a finger snap (on 2 and 4 before the clap comes), a whoosh, his zip-in, the clock's tick, its slam, his yawn.
  python3 song_y.py <out.wav>

  bars  1-8    the street at night: the clock's ticks, a shaker, a rim, snaps; the organ's chords echoing; no kick
  bars  9-16   the clock slapped: the kick on every beat, the piano, the slap bass
  bars 17-24   Dash's tune
  bars 25-32   the second verse: the square answers in the gaps
  bars 33-40   Tick's (the first calm): half the pace; the acid line, the chords thrown into the echo, his bell
  bars 41-42   your time stolen: the ticks racing away; a hush, a tick-tock
  bars 43-54   the clock slammed, and the Time Scramble (the drop): the turns shrinking, then both leads together
  bars 55-62   Tick's again (the second calm): the overdriven lead plays the tune slowly; a yawn
  bars 63-70   the solo: the overdriven lead over the whole groove
  bars 71-78   Dash's tune a minor third up, the square under it for its last four bars
  bars 79-82   the break: the whole band's hits, the drums answering
  bars 83-84   the tag: the street again, and home
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BARS = 84
BEATS = 4 * BARS
TAPE = 160.0
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [
    (bar0(1), bar0(9), 122, 122, 1.0, 1.0, 0.0),
    (bar0(9), bar0(33), 126, 126, 1.0, 1.0, 0.0),
    (bar0(33), bar0(41), 118, 118, 1.0, 1.0, 0.0),  # Tick's
    (bar0(41), bar0(43), 118, 132, 1.0, 1.0, 0.0),  # the time racing away
    (bar0(43), bar0(55), 132, 132, 1.0, 1.0, 0.0),  # the scramble
    (bar0(55), bar0(56), 132, 116, 1.0, 1.0, 0.0),
    (bar0(56), bar0(63), 116, 116, 1.0, 1.0, 0.0),  # Tick's again
    (bar0(63), bar0(71), 128, 128, 1.0, 1.0, 0.0),  # the solo
    (bar0(71), bar0(83), 134, 134, 1.0, 1.0, 0.0),  # the last tune, the break
    (bar0(83), BEATS, 134, 122, 1.0, 1.0, 0.0),
]

# A chord: its bass note; the organ's and the piano's four; the bell pattern's five (low, middle, the one it keeps
# coming back to, a color, high). "+3" after a name: a minor third up (the last tune).
STREET = {
    "Fm9": ("F1", "Ab3 C4 Eb4 G4", "C5 Eb5 G5 Ab5 C6"),
    "Ab/Eb": ("Eb1", "Ab3 C4 Eb4 G4", "C5 Eb5 G5 Ab5 C6"),
    "Dbmaj9": ("Db1", "Ab3 C4 Eb4 G4", "C5 F5 G5 Ab5 C6"),
    "Bb13": ("Bb1", "Ab3 C4 D4 G4", "D5 F5 G5 Bb5 D6"),
    "Fm9/C": ("C2", "Ab3 C4 Eb4 G4", "C5 Eb5 G5 Ab5 C6"),
    "Abmaj9": ("Ab1", "G3 Bb3 C4 Eb4", "C5 Eb5 G5 Bb5 C6"),
    "Gbmaj7": ("Gb1", "F3 Bb3 Db4 F4", "Db5 F5 Bb5 Ab5 Db6"),  # from outside the key
    "Eb9": ("Eb1", "G3 Bb3 Db4 F4", "Db5 F5 G5 Bb5 Db6"),
    "Dbm9": ("Db1", "E3 Ab3 B3 Eb4", "Ab4 B4 Eb5 E5 Ab5"),  # the drop
    "Am9": ("A1", "C4 E4 G4 B4", "E5 G5 B5 C6 E6"),
    "C9": ("C2", "E3 G3 Bb3 D4", "E5 G5 Bb5 D6 E6"),
}
LOOP = "Fm9 Ab/Eb Dbmaj9 Bb13 Fm9/C Abmaj9 Gbmaj7 Eb9"
CHORDS = (
    f"{LOOP}  {LOOP}  {LOOP}  {LOOP}  {LOOP}  Eb9 Eb9  Fm9 Fm9 Dbm9 Dbm9 Am9 Am9 Fm9 Fm9 Dbm9 Am9 Fm9 C9  {LOOP}  {LOOP}  "
    + " ".join(c + "+3" for c in LOOP.split())
    + "  Fm9+3 Fm9+3 Gbmaj7 Eb9  Gbmaj7 Eb9"
).split()
assert len(CHORDS) == BARS, len(CHORDS)
CHIME = (2, 0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 4, 2, 1, 2, 3)  # the bell pattern's bar, 16th by 16th: which of the five
STABS = ((3, 6, 11, 14), (2, 6, 10, 13))  # where the organ's chords fall in a bar (16ths): never on the downbeat
# The slap bass's bar: the 16th, how far over the root, and how it's played (a note, a pop an octave up, a muted ghost).
SLAP = ((0, 0, "n"), (3, 12, "p"), (4, 0, "g"), (6, 0, "n"), (7, 12, "p"), (10, 0, "n"), (11, 0, "g"), (13, 7, "n"), (14, 10, "n"), (15, 12, "p"))
ACID = ((0, 0), (12, 1), ("3", 0), (0, 0), ("7", 1), (7, 0), (12, 0))  # the acid line: seven 16ths (half steps over the root, or the chord's third or seventh; 1: it slides in)
# Each chord's third and seventh over its bass note, in half steps (a minor chord's unless it's here): for the acid line and the bass.
COLOR = {"Ab/Eb": (4, 9), "Dbmaj9": (4, 11), "Bb13": (4, 10), "Abmaj9": (4, 11), "Gbmaj7": (4, 11), "Eb9": (4, 10), "C9": (4, 10)}

# ---- Dash's lines (the gritty lead). Lengths in beats; 2/3 is a note of three-across-two, .25 a 16th. ----
# The tune, three bars and three and two: a slide up into a long ninth, triplets, a run; the raised sixth, a jump up to
# C that floats down; the chord from outside; the run down the turn.
TUNE = (
    "-:.5 C5:.5 Eb5:.5 G5:2.5 | F5:1 Eb5:2/3 C5:2/3 Bb4:2/3 C5:.25 Eb5:.25 F5:.25 G5:.25 | Ab5:2 G5:.5 F5:.5 Eb5:1 | "
    "D5:1.5 F5:.5 G5:1 Bb5:1 | C6:2 Bb5:2/3 G5:2/3 F5:2/3 | Eb5:1.5 G5:.5 Bb5:.25 Ab5:.25 G5:.25 Eb5:.25 C5:1 | "
    "Db5:1 F5:1 Bb5:1.5 Ab5:.5 | G5:1 F5:.25 Eb5:.25 Db5:.25 Bb4:.25 Db5:.5 Eb5:.5 -:1"
)
VERSE = (
    "F5:.5 Ab5:.5 C6:2 Bb5:1 | G5:1.5 Eb5:.5 C5:1 -:1 | Ab5:2 F5:2/3 Eb5:2/3 C5:2/3 | D5:1 F5:1 G5:1 -:1 | "
    "C5:.5 C6:1.5 Bb5:2/3 G5:2/3 Eb5:2/3 | G5:2 Eb5:1 -:1 | F5:1.5 Db5:.5 Bb4:1 Db5:1 | Eb5:1 G5:1 Bb5:1 -:1"
)
# The square's answers, a word in the last beat of every other bar.
ANSWERS = (
    "-:4 | -:3 Eb5:.25 F5:.25 G5:.25 Bb5:.25 | -:4 | -:3 Bb5:.25 G5:.25 F5:.25 D5:.25 | "
    "-:4 | -:3 C6:.25 Bb5:.25 G5:.25 Eb5:.25 | -:4 | -:3 Db6:.25 Bb5:.25 G5:.25 F5:.25"
)
# The Time Scramble: Dash's turns and the square's: two bars each, one each, half a bar each twice; then four together.
D_DASH = (
    "F5:.5 F6:1.5 Eb6:2/3 C6:2/3 Ab5:2/3 | Bb5:.25 C6:.25 Bb5:.25 Ab5:.25 F5:1 Eb5:.5 F5:.5 Ab5:1 | -:8 | "
    "A5:.5 C6:.5 E6:1 D6:2/3 C6:2/3 A5:2/3 | -:4 | F5:.25 Ab5:.25 C6:.25 Eb6:.25 F6:1 -:2 | C6:.25 Bb5:.25 Ab5:.25 G5:.25 F5:1 -:2 | "
    "Db6:2 Ab5:2/3 E5:2/3 Ab5:2/3 | C6:2 A5:2/3 E5:2/3 A5:2/3 | C6:1.5 Ab5:.5 F5:1 Ab5:1 | G5:1 Bb5:1 C6:1 -:1"
)
D_SQUARE = (
    "-:8 | Db5:.5 E5:.5 Ab5:1.5 B5:.5 Ab5:1 | E5:2/3 Eb5:2/3 Db5:2/3 B4:1 Db5:.25 E5:.25 Ab5:.25 B5:.25 | "
    "-:4 | E5:.5 A5:.5 B5:1 C6:.5 B5:.5 G5:1 | -:2 C5:.25 Eb5:.25 F5:.25 Ab5:.25 C6:1 | -:2 Eb6:.25 C6:.25 Ab5:.25 F5:.25 Eb5:1 | "
    "Ab5:2 E5:2/3 Db5:2/3 E5:2/3 | A5:2 E5:2/3 C5:2/3 E5:2/3 | Ab5:1.5 F5:.5 C5:1 F5:1 | E5:1 G5:1 Bb5:1 -:1"
)
# The second calm: the tune's start, slowly.
SLOW = "-:1 C5:1 Eb5:1 G5:5 | F5:2 Eb5:4/3 C5:4/3 Bb4:4/3 C5:2 | Ab5:4 G5:1 F5:1 Eb5:2 | -:8"
# The solo.
SOLO = (
    "C5:1/3 Eb5:1/3 F5:1/3 G5:1 Ab5:.5 G5:.5 F5:1 | Eb5:.5 E5:.5 F5:.5 Ab5:.5 C6:1.5 Bb5:.5 | Ab5:2/3 G5:2/3 Eb5:2/3 Db5:1 C5:.5 Eb5:.5 | "
    "D5:.5 F5:.5 G5:.5 Ab5:.5 Bb5:1 D6:1 | C6:1.5 Bb5:.5 G5:1/3 Ab5:1/3 G5:1/3 Eb5:1 | G5:.5 Bb5:.5 C6:.5 Eb6:.5 D6:1 Bb5:1 | "
    "Bb5:2/3 Ab5:2/3 F5:2/3 Db5:1 F5:.5 Ab5:.5 | G5:.5 Bb5:.5 Db6:.5 Eb6:.5 F6:2"
)
TAG = "Db5:1 F5:1 Bb5:1.5 Ab5:.5 | G5:1 Bb5:.25 G5:.25 F5:.25 Eb5:.25 F5:1 -:1"
for _line, _beats in ((TUNE, 32), (VERSE, 32), (ANSWERS, 32), (D_DASH, 48), (D_SQUARE, 48), (SLOW, 32), (SOLO, 32), (TAG, 8)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
last4 = lambda text: " | ".join(text.split("|")[4:])


def main(out: str) -> None:
    x = Ride(RIDE, BEATS, None, os=2, seed=181, tape_secs=TAPE)
    put, at = x.put, x.at
    rng = np.random.default_rng(41)
    sr = x.sr
    tau = 2 * np.pi
    sw = lambda i: (i + (0.1 if i % 2 else 0)) / 4  # a 16th of the bar, in beats, swung: the off ones a tenth late

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
        """Noise with its highs rolled off."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    def chord(name):
        name, _, shift = name.partition("+")
        root, keys, chime = STREET[name]
        up = int(shift or 0)
        return n(root) + up, [n(c) + up for c in keys.split()], [n(c) + up for c in chime.split()]

    of = lambda bar: chord(CHORDS[bar - 1])
    color = lambda bar: COLOR.get(CHORDS[bar - 1].partition("+")[0], (3, 10))  # the bar's chord's third and seventh over its bass note

    # ---- the kit: a drum machine's ----
    def kick(b, vol=0.5):
        """The kick: a note dropping from 150 Hz to 45 in a twentieth of a second, a click on its front."""
        k = int(0.32 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.6 * np.sin(tau * np.cumsum(45 + 105 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.13)) + 0.25 * hiss(k, 6000, 0.5) * np.exp(-t / 0.002)
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass and the chords duck

    def snare(b, vol=0.26):
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(180 + 60 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.045)
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.09)) * tail(k) * vol, 0.05)

    def clap(b, vol=0.2):
        for late in (0, 0.011, 0.023):
            kk = int(0.02 * sr)
            put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.006) * vol * 0.7, late=late)
        kk = int(0.2 * sr)
        put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol, late=0.03)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        k = int((0.2 if open_ else 0.045) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 12000, 0.85) * np.exp(-t / (0.07 if open_ else 0.012)) * tail(k, 0.004) * vol, pan)

    def shaker(b, vol=0.02, pan=-0.3):
        k = int(0.07 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 8000, 0.7) * np.sin(np.pi * np.minimum(1, t / 0.05)) ** 2 * vol, pan)

    def rim(b, vol=0.1, pan=0.2):
        """A rim: a dry, woody click."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("snare", b, (np.sin(tau * 1700 * t) + 0.6 * np.sin(tau * 830 * t) + 0.3 * hiss(k, 6000, 0.4) * np.exp(-t / 0.002)) * np.exp(-t / 0.008) * tail(k) * vol, pan)

    def tom(b, m, vol=0.3, pan=0.0):
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.13) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def fill(b, pitches=(53, 53, 48, 43)):
        """A run of toms into the next bar, a 16th each."""
        for i, m in enumerate(pitches):
            tom(b + i * 0.25, m, 0.24 + 0.03 * i, {53: 0.3, 48: 0.0, 43: -0.3}[m])

    # ---- his sounds, as the game builds them (packages/app/src/characters/dash-sounds.ts) ----
    def tick(b, vol=0.03, high=True, pan=0.0, late=0.0):
        """The chess clock: a small, dry tick (or, lower, a tock)."""
        k = int(0.04 * sr)
        t = np.arange(k) / sr
        f = 2600 if high else 1750
        w = np.sin(tau * f * t) + 0.5 * np.sin(tau * 2.3 * f * t + 1) + 0.6 * hiss(k, 14000, 0.7) * np.exp(-t / 0.0015)
        put("clock", b, w * np.exp(-t / 0.005) * np.minimum(1, t / 0.0003) * tail(k) * vol, pan, late=late)

    def slam(b, vol=0.5):
        """The clock slammed: his paw's slap, the button's click, the flag rattling, a thud under it."""
        k = int(0.5 * sr)
        t = np.arange(k) / sr
        thud = np.sin(tau * np.cumsum(60 + 90 * np.exp(-t / 0.03)) / sr) * np.exp(-t / 0.12)
        slap = hiss(k, 5000, 0.3) * np.exp(-t / 0.012)
        click = (np.sin(tau * 2100 * t) + 0.6 * np.sin(tau * 3300 * t)) * np.exp(-t / 0.004)
        rattle = hiss(k, 9000, 0.8) * (0.5 + 0.5 * np.sign(np.sin(tau * 46 * t))) * np.exp(-t / 0.09) * (t > 0.03)
        put("fx", b, (1.2 * thud + 0.8 * slap + 0.5 * click + 0.25 * rattle) * tail(k, 0.03) * vol)
        put("duck", b, np.ones(1))

    def snap(b, vol=0.12, pan=-0.15):
        """A finger snap: a quick crack."""
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("snare", b, (hiss(k, 7000, 0.6) * np.exp(-t / 0.004) + 0.5 * np.sin(tau * 2300 * t) * np.exp(-t / 0.006) + 0.25 * hiss(k, 5000, 0.4) * np.exp(-t / 0.02)) * tail(k) * vol, pan)

    def squeak(b, vol=0.035, pan=0.3):
        """His sneakers skidding: two squeaks, the second shorter."""
        for late, secs, f0 in ((0.0, 0.09, 2500), (0.12, 0.06, 2900)):
            k = int(secs * sr)
            u = np.linspace(0, 1, k)
            ph = tau * np.cumsum(f0 * (1 + 0.25 * u) + 90 * np.sin(tau * 70 * u * secs)) / sr
            put("fx", b, (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.sin(np.pi * u) ** 0.6 * vol, pan, late=late)

    def whoosh(b, length=1.0, vol=0.06, up=True, pan=0.0):
        """Air tearing past (his zip-in when it rises)."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        w = hiss(k, 11000, 0.5)
        sweep = np.zeros(k)
        for i, size in enumerate((64, 32, 16, 8, 4)):  # a rising (or falling) brightness: mixes of the noise smoothed less and less
            part = np.convolve(w, np.ones(size) / size, "same") * np.sqrt(size)
            centre = (i + 0.5) / 5 if up else 1 - (i + 0.5) / 5
            sweep += part * np.exp(-(((u - centre) / 0.22) ** 2))
        put("fx", b, sweep * (u**1.5 if up else (1 - u) ** 1.2) * np.minimum(1, (1 - u) * 40) * vol * 0.25, pan)

    def yawn(b, vol=0.05, pan=0.2):
        """His big, bored yawn: a voice rising, then sliding down."""
        secs = 1.1
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / sr
        f = np.where(u < 0.3, 240 + 260 * u / 0.3, 500 - 300 * (u - 0.3) / 0.7)
        ph = tau * np.cumsum(f) / sr
        w = np.zeros(k)
        for h in range(1, 9):
            fh = h * f
            w += np.sin(h * ph) / h * (1 / np.sqrt(1 + 30 * (fh / 700 - 700 / fh) ** 2) + 0.5 / np.sqrt(1 + 40 * (fh / 1200 - 1200 / fh) ** 2) + 0.05)
        put("fx", b, (w + 0.03 * hiss(k, 3000)) * np.sin(np.pi * u) ** 0.8 * vol, pan)

    def ding(b, m=83, vol=0.05, pan=-0.3):
        """Tick's little bell."""
        at(b, 2)
        put("chime", b, x.bell(m, 2, vol, ratio=2.0, index=1.2, decay=0.35), pan)

    def step(b, vol=0.4):
        """Tick's plodding step: a soft, low pat."""
        k = int(0.25 * sr)
        t = np.arange(k) / sr
        put("kick", b, (np.sin(tau * np.cumsum(55 + 50 * np.exp(-t / 0.03)) / sr) + 0.5 * murk(k, 400)) * np.exp(-t / 0.07) * tail(k) * vol)
        put("duck", b, np.ones(1))

    def chomp(b, vol=0.05, pan=0.3):
        """Tick's slow chomp: a soft crunch, chewed twice."""
        for late in (0.0, 0.28):
            k = int(0.12 * sr)
            t = np.arange(k) / sr
            put("fx", b, murk(k, 1800) * (0.5 + 0.5 * np.sign(np.sin(tau * 38 * t))) * np.sin(np.pi * np.minimum(1, t / 0.12)) * vol, pan, late=late)

    # ---- the band's voices ----
    def organ(b, ms, vol=0.05, bright=1.0, long=0.22):
        """The organ's short chord: each note its first three harmonics, struck, dying to a fifth of itself."""
        at(b, long)
        k = x.k(long) + int(0.1 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for m in ms:
            ph = tau * x.hz(m) * t
            w += np.sin(ph) + 0.7 * bright * np.sin(2 * ph) + 0.45 * bright * np.sin(3 * ph) + 0.12 * bright * np.sin(4 * ph)
        env = (0.2 + 0.8 * np.exp(-t / 0.18)) * np.minimum(1, t / 0.001) * tail(k, 0.1)
        put("organ", b, (w / len(ms) + 0.2 * bright * hiss(k, 5000, 0.5) * np.exp(-t / 0.003)) * env * vol, -0.2)

    def piano(b, ms, vol=0.06, long=0.3):
        """The piano's bright stab."""
        at(b, long)
        k = x.k(long) + int(0.25 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for m in ms:
            f = x.hz(m)
            for h in range(1, 13):
                if h * f > 7000:
                    break
                w += np.sin(tau * h * f * (1 + 0.00035 * h * h) * t + h) / h**1.15 * np.exp(-t * (1.6 + 0.7 * h))
        put("piano", b, (w / len(ms) + 0.12 * hiss(k, 4000, 0.3) * np.exp(-t / 0.004)) * np.minimum(1, t / 0.002) * tail(k, 0.2) * vol, 0.25)

    def slap(b, m, long, kind="n", vol=0.4):
        """The slap bass: a note whose phase another pushes hard for an instant (a metallic pluck), then lets go."""
        at(b, long)
        k = x.k(long) + int(0.03 * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        push = {"n": 3.0, "p": 4.5, "g": 1.2}[kind]
        ring = {"n": 0.3, "p": 0.16, "g": 0.035}[kind]
        w = np.sin(tau * f * t + (push * np.exp(-t / 0.045) + 0.3) * np.sin(tau * f * t)) + 0.5 * np.sin(tau * f * t)
        put("bass", b, np.tanh(1.4 * w) * np.minimum(1, t / 0.002) * np.exp(-t / ring) * tail(k, 0.02) * vol * {"n": 1.0, "p": 0.75, "g": 0.6}[kind])

    def acid(b, m, long, top=2200.0, last=None, accent=False):
        """The acid line's note: a sawtooth through a ringing filter that opens on the note and closes; `last`: the
        note it slides in from."""
        at(b, long)
        k = x.k(long) + int(0.02 * sr)
        t = np.arange(k) / sr
        glide = (last - m) * np.exp(-t / 0.035) if last is not None else 0.0
        f = x.hz(m + glide)
        ph = tau * np.cumsum(f) / sr
        cut = 280 + (top * (1.35 if accent else 1.0) - 280) * np.exp(-t / (0.11 if accent else 0.08))
        w = np.zeros(k)
        for h in range(1, 28):
            fh = h * f
            w += np.sin(h * ph) / h * (1 / np.sqrt(1 + (fh / cut) ** 4) + 1.6 * np.exp(-(((fh - cut) / (0.16 * cut)) ** 2)))
        put("acid", b, np.tanh(1.5 * w) * np.minimum(1, t / 0.003) * tail(k, 0.02) * (0.24 if accent else 0.18))

    def chime(b, m, vol=0.05, pan=0.0):
        """The clock's little bell pattern: a soft blip."""
        k = int(0.25 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("chime", b, (np.sin(ph + 0.8 * np.exp(-t / 0.03) * np.sin(2 * ph)) + 0.15 * np.sin(3 * ph)) * np.minimum(1, t / 0.003) * np.exp(-t / 0.07) * tail(k) * vol, pan)

    def strings(bar, vol=0.03, length=4.0):
        at(bar0(bar), length)
        for j, m in enumerate(of(bar)[1][1:]):
            put("pad", bar0(bar), x.strings(m + 12, length, vol, attack=0.3, release=0.4), (-0.45, 0.0, 0.45)[j])

    def sub(b, m, length, vol=0.5):
        """A deep kick with a note in it, for the drop."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env) * vol)

    def dashed(start, text, vol=1.0, pan=-0.1, up=0):
        """Dash: the gritty lead. A note of a beat and a half or more slides up into place from two half steps under."""
        for b, d, m in notes(start, text):
            at(b, d)
            long = d >= 1.5
            w = x.tone(m + up, d * 0.94, [1 / h for h in range(1, 17)], 1.0, detune=(-14, 0, 13), scoop=2.0 if long else 0.5, scoop_s=0.07 if long else 0.02,
                       vib=0.006 if long else 0.0, attack=0.006, release=0.02, bright=0.12)
            put("lead", b, np.tanh(2.2 * w) * 0.21 * vol, pan)

    def squared(start, text, vol=1.0, pan=0.3, up=0):
        for b, d, m in notes(start, text):
            at(b, d)
            put("square", b, x.chip(m + up, d * 0.94, 0.15 * vol), pan)

    def driven(start, text, vol=1.0, pan=0.1, up=0):
        """The overdriven lead. A long note that follows another straight on slides in from most of the way back."""
        last = None
        for b, d, m in notes(start, text):
            m += up
            glide = 0.6 * (last[1] - m) if last and abs(last[0] - b) < 1e-6 and d >= 1 and 0 < abs(last[1] - m) <= 12 else 0.0
            at(b, d)
            put("drive", b, x.drive(m, d * 0.96, 0.16 * vol, glide=glide), pan)
            last = (b + d, m)

    def stutter(b, m, count=8, vol=0.6):
        for i in range(count):
            at(b + i / count, 1 / count)
            put("lead", b + i / count, x.gritty(m, 0.8 / count, 0.21 * vol * (0.6 + 0.4 * i / count)), -0.1)

    def throw(name, beats_=0.75, repeats=4, fall=0.5):
        """A dub echo on a voice: `repeats` of it, each from the other side, duller and `fall` as loud."""
        shift = int(round(beats_ * 60 / 126 * sr))
        cur = x.buses[name]
        total = cur.copy()
        for i in range(1, repeats + 1):
            size = 6 + 8 * i
            cur = np.roll(cur[::-1], shift, axis=1)
            cur = np.stack([np.convolve(c, np.ones(size) / size, "same") for c in cur])
            total += cur * fall**i
        x.buses[name] = total

    # ---- the band, bar by bar ----
    def clockwork(bar, vol=1.0, bells=1.0, keep=1):
        """The clock: a tick on every 16th (swung), the beats' a little louder; and the bell pattern, coming back to G."""
        b = bar0(bar)
        sky = of(bar)[2]
        for i in range(16):
            if i % keep:
                continue
            tick(b + sw(i), 0.022 * vol * rng.uniform(0.7, 1.0) * (1.4 if i % 4 == 0 else 1.0), i % 4 == 0, 0.4 if i % 2 else -0.4)
            if bells:
                chime(b + sw(i), sky[CHIME[i]], 0.045 * bells * rng.uniform(0.6, 1.0), 0.5 * np.sin(i * 1.7 + bar))

    def top(bar, vol=1.0, opens=True):
        """The shaker on every 16th and the hats: closed on the beats' halves, an open one on every off-beat."""
        b = bar0(bar)
        for i in range(16):
            shaker(b + sw(i), 0.018 * vol * (1.3 if i % 4 == 2 else 1.0))
        for i in range(8):
            hat(b + i * 0.5, 0.04 * vol if i % 2 else 0.022 * vol, open_=opens and i % 2 == 1)

    def stabs(bar, vol=1.0, keys=True, bright=1.0):
        """The organ's chords where the bar's pattern has them, and the piano's on two of them."""
        b = bar0(bar)
        ms = of(bar)[1]
        for j, i in enumerate(STABS[bar % 2]):
            organ(b + sw(i), ms, 0.05 * vol, bright)
            if keys and j % 2 == 0:
                piano(b + sw(i), [m + 12 for m in ms[1:]] + [ms[0] + 12], 0.055 * vol)

    def bassline(bar, vol=1.0):
        b = bar0(bar)
        root = of(bar)[0] + 12
        for i, over, kind in SLAP:
            slap(b + sw(i), root + (color(bar)[1] if over == 10 else over), 0.4 if kind == "n" and i in (0, 6, 10) else 0.22, kind, 0.4 * vol)

    def groove(bar, vol=1.0, four=True, back="clap", keys=True, bells=1.0):
        """A bar of the whole groove: the kick on every beat, a clap (or a snap) on 2 and 4, the top, the clock, the
        organ and the piano, the slap bass."""
        b = bar0(bar)
        if four:
            for i in range(4):
                kick(b + i, 0.5 * vol)
        for i in (1, 3):
            clap(b + i, 0.2 * vol) if back == "clap" else snap(b + i, 0.12 * vol)
        top(bar, vol), clockwork(bar, vol, bells), stabs(bar, vol, keys), bassline(bar, vol)

    def ticks_dub(bar, vol=1.0):
        """A bar of Tick's: his step on 1 and 3, the clock at half its ticks, a shaker, the organ's chord thrown into
        the echo on 1 and after 2, the acid line (its seven 16ths going on from where the last bar left them)."""
        b = bar0(bar)
        root, ms, sky = of(bar)
        step(b, 0.5 * vol), step(b + 2, 0.44 * vol)
        rim(b + 1 + sw(2), 0.08), rim(b + 3, 0.1)
        for i in range(0, 16, 2):
            shaker(b + sw(i), 0.02)
            tick(b + sw(i), 0.02 * vol, i % 4 == 0, 0.4 if i % 4 else -0.4)
        put_dub(b, ms), put_dub(b + sw(6), ms)
        return root

    def put_dub(b, ms, vol=0.07):
        """A chord for the echo: the organ's, dull."""
        at(b, 0.3)
        k = x.k(0.3) + int(0.1 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for m in ms:
            ph = tau * x.hz(m) * t
            w += np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
        put("dub", b, w / len(ms) * (0.2 + 0.8 * np.exp(-t / 0.16)) * np.minimum(1, t / 0.002) * tail(k, 0.1) * vol, 0.3)

    def creeping(first, bars_, top0, top1):
        """The acid line over a run of bars: seven 16ths long, so it starts somewhere new in each bar; each bar on its
        own chord's root; the filter opening from `top0` to `top1` as it goes."""
        count = 16 * bars_
        last = None
        for j in range(count):
            bar = first + j // 16
            over, slides = ACID[j % 7]
            m = of(bar)[0] + 24 + (color(bar)[0] if over == "3" else color(bar)[1] if over == "7" else over)
            acid(bar0(first) + sw(j % 16) + 4 * (j // 16), m, 0.24, top0 + (top1 - top0) * j / count, last if slides else None, j % 7 in (1, 4))
            last = m

    # Bars 1-8: the street at night. No kick: the clock, the shaker and closed hats, a rim, his snaps on 2 and 4; the
    # organ's chords, each with its echo; the bass comes in at bar 5, a few notes; his sneakers, a yawn.
    for bar in range(1, 9):
        b = bar0(bar)
        top(bar, 1.2, opens=False), clockwork(bar, 1.2, bells=0.8 if bar >= 3 else 0.0)
        stabs(bar, 1.5, keys=False)
        rim(b + sw(3), 0.11), rim(b + 2 + sw(2), 0.14), rim(b + 3 + sw(3), 0.1)
        snap(b + 1, 0.16), snap(b + 3, 0.18)
        if bar >= 3:
            root = of(bar)[0] + 12
            slap(b, root, 0.5, "n", 0.4), slap(b + sw(6), root, 0.3, "n", 0.34), slap(b + sw(7), root + 12, 0.2, "p", 0.34), slap(b + sw(14), root + color(bar)[1], 0.25, "n", 0.32)
        if bar >= 5:
            strings(bar, 0.022)
    squeak(bar0(2) + 3, 0.035), yawn(bar0(4) + 2, 0.045), squeak(bar0(6) + 3.5, 0.03, -0.3)
    whoosh(bar0(9) - 2, 2.0, 0.07)
    for i in range(8):
        snare(bar0(9) - 1 + i / 8, 0.05 + 0.02 * i)

    # Bars 9-16: the clock slapped, and the groove: the kick on every beat, the piano, the slap bass.
    slam(bar0(9), 0.4), x.crash(bar0(9), 0.18, decay=0.5)
    for bar in range(9, 17):
        groove(bar)
        strings(bar, 0.022)
    fill(bar0(17) - 1)

    # Bars 17-24: Dash's tune. Bars 25-32: the second verse, the square answering in the gaps.
    for bar in range(17, 33):
        groove(bar)
        strings(bar, 0.026)
    dashed(bar0(17), TUNE)
    dashed(bar0(25), VERSE), squared(bar0(25), ANSWERS)
    squeak(bar0(20) + 3.25, 0.03), fill(bar0(25) - 1), x.crash(bar0(25), 0.16, decay=0.5)
    whoosh(bar0(33) - 1, 1.0, 0.05, up=False)

    # Bars 33-40: Tick's (the first calm). Half the pace of everything: his step where the kick was, the clock at half
    # its ticks, the chords thrown into the echo, the acid line creeping, its filter opening; his bell, his chomp.
    for bar in range(33, 41):
        ticks_dub(bar)
        strings(bar, 0.03)
    creeping(33, 8, 700, 2000)
    ding(bar0(33) + 1.5, 83), ding(bar0(35) + 3, 86, 0.04, 0.3), ding(bar0(37) + 1.5, 83), ding(bar0(39) + 2.5, 79, 0.04, 0.3)
    chomp(bar0(36) + 2.5), chomp(bar0(40) + 0.5, 0.045, -0.3)

    # Bars 41-42: your time stolen. The ticks race away (faster and faster, rising), a roll, his zip; then a hush: two
    # beats of nothing but a tick and a tock.
    for i in range(40):
        u = i / 40
        tick(bar0(41) + 6 * (1 - (1 - u) ** 1.7), 0.012 + 0.02 * u, i % 2 == 0, 0.6 * np.sin(i))
    for i in range(24):
        snare(bar0(41) + 3 + i / 8, 0.02 + 0.005 * i)
    whoosh(bar0(41) + 2, 4.0, 0.09)
    acid(bar0(41), of(41)[0] + 24, 4.0, 900), acid(bar0(42), of(42)[0] + 36, 1.9, 2600, of(41)[0] + 24)
    tick(bar0(42) + 2.5, 0.07, True), tick(bar0(42) + 3.25, 0.07, False)

    # Bars 43-54: the clock slammed, and the Time Scramble. The kick on every beat and a deep one under it, a snare on 2
    # and 4, the slap bass, the acid line under the square's turns; the turns shrink (two bars each, one each, half a
    # bar each twice), a stutter or toms ending each; then both leads together, the piano's stabs back.
    slam(bar0(43), 0.6), x.crash(bar0(43), 0.22, decay=0.6)
    for bar in range(43, 55):
        b = bar0(bar)
        root = of(bar)[0]
        both = bar >= 51
        for i in range(4):
            kick(b + i, 0.55)
        snare(b + 1, 0.2), snare(b + 3, 0.2), clap(b + 3, 0.1)
        sub(b, root + 12, 1.5, 0.45), sub(b + 2.5, root + 12, 1.0, 0.36)
        top(bar, 1.0), clockwork(bar, 1.0, bells=1.0 if both else 0.6), bassline(bar)
        stabs(bar, 1.0, keys=both)
        if both:
            strings(bar, 0.03)
    creeping(45, 2, 1400, 2600), creeping(48, 1, 1800, 2800)
    dashed(bar0(43), D_DASH), squared(bar0(43), D_SQUARE)
    stutter(bar0(45) - 0.5, n("Ab5"), 4), fill(bar0(47) - 1), stutter(bar0(49) - 0.5, n("G5"), 4), fill(bar0(51) - 1, (53, 48, 48, 43))
    x.crash(bar0(51), 0.2, decay=0.6)
    whoosh(bar0(55) - 1, 1.0, 0.05, up=False)

    # Bars 55-62: Tick's again (the second calm), the pace sagging into it. The overdriven lead plays the tune's start
    # slowly; the acid line is low and dull; his bell; and Dash yawns.
    for bar in range(55, 63):
        ticks_dub(bar)
        strings(bar, 0.032)
    creeping(55, 8, 500, 1100)
    driven(bar0(55), SLOW, 0.9)
    ding(bar0(56) + 3.5, 86, 0.04, 0.3), ding(bar0(58) + 1.5, 83), ding(bar0(61) + 1, 79, 0.045, 0.3), ding(bar0(62) + 2, 83)
    yawn(bar0(61) + 2, 0.05), chomp(bar0(59) + 2.5)
    whoosh(bar0(63) - 2, 2.0, 0.07)
    for i in range(8):
        snare(bar0(63) - 1 + i / 8, 0.05 + 0.02 * i)

    # Bars 63-70: the solo. The whole groove; the overdriven lead.
    slam(bar0(63), 0.4), x.crash(bar0(63), 0.18, decay=0.5)
    for bar in range(63, 71):
        groove(bar)
        strings(bar, 0.026)
    driven(bar0(63), SOLO)
    fill(bar0(67) - 1), fill(bar0(71) - 1, (53, 48, 43, 43))

    # Bars 71-78: Dash's tune a minor third up; the square an octave under it for its last four bars; a deep kick under
    # each bar.
    x.crash(bar0(71), 0.22, decay=0.6)
    for bar in range(71, 79):
        groove(bar)
        strings(bar, 0.03)
        sub(bar0(bar), of(bar)[0] + 12, 1.5, 0.4)
    dashed(bar0(71), TUNE, up=3), squared(bar0(75), last4(TUNE), 0.7, up=3 - 12)
    squeak(bar0(74) + 3.25, 0.03)

    # Bars 79-82: the break. The whole band hits together (the kick, the bass, the organ and the piano), off the beat;
    # the drums answer; the clock keeps time. Bars 83-84: the tag: the street again (no kick), the tune's turn, home.
    for bar in range(79, 83):
        b = bar0(bar)
        root, ms, _ = of(bar)
        for i in ((0, 3, 6, 10) if bar % 2 else (0, 3, 8, 11)):
            kick(b + i / 4, 0.55), slap(b + i / 4, root + 12, 0.3, "n", 0.45)
            organ(b + i / 4, ms, 0.06), piano(b + i / 4, [m + 12 for m in ms[1:]] + [ms[0] + 12], 0.06)
        clockwork(bar, 1.0, bells=0.8), snare(b + 1, 0.18), snare(b + 3, 0.18)
        fill(b + 3, (53, 53, 48, 43) if bar % 2 else (48, 48, 43, 43))
    stutter(bar0(81) - 1, n("Bb5") , 8, 0.5)
    x.crash(bar0(83), 0.18, decay=0.5), slam(bar0(83), 0.35)
    for bar in (83, 84):
        b = bar0(bar)
        top(bar, 0.9, opens=False), clockwork(bar, 0.9, bells=0.7), stabs(bar, 0.95, keys=False)
        snap(b + 1, 0.11), snap(b + 3, 0.12)
        root = of(bar)[0] + 12
        slap(b, root, 0.5, "n", 0.36), slap(b + sw(6), root, 0.3, "n", 0.3), slap(b + sw(14), root + color(bar)[1], 0.25, "n", 0.28)
    dashed(bar0(83), TAG, 0.9)
    squeak(bar0(84) + 3, 0.03)

    # The bass and the chords duck under each kick.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["pad"] *= 0.45 + 0.55 * gain
    x.buses["organ"] *= 0.7 + 0.3 * gain
    x.buses["acid"] *= 0.6 + 0.4 * gain

    throw("organ", 0.75, 3, 0.42), throw("dub", 0.75, 5, 0.6), throw("chime", 0.75, 2, 0.3)
    x.beat_s = 60 / 126  # the echoes' beat
    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("square", 0.75, 0.16, 0.06)
    x.echo("drive", 0.75, 0.16, 0.07)
    levels = {"lead": 1.0, "square": 1.2, "drive": 1.2, "bass": 0.55, "sub": 0.5, "acid": 0.9, "kick": 0.9, "snare": 3.5, "hats": 4.0, "toms": 1.1, "drum": 1.5,
              "clock": 9.0, "chime": 1.8, "organ": 6.0, "piano": 6.0, "dub": 6.0, "pad": 2.0, "fx": 2.0}
    write_wav(out, x.play(x.mixdown(levels, lowpass=8500, room=0.22)))


if __name__ == "__main__":
    main(sys.argv[1])
