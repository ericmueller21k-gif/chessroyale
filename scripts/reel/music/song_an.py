"""Song AN (Eric, Nov 19): the battle tower's music, another go, from a plan: a loop of 2:40. "Heres instructions for
a new one, please make it 2.5 min roughly, keep the sound more muted overall, it's the background battle tower music".
The instructions are his own plan (made with another assistant, as Babur's and Chandy's were), "Moody 90s Acid-Jazz &
Neo-Noir Hip-Hop Rock", and it is his to give, so this is the plan, part for part:
  - 96 beats a minute, four in a bar; the 16ths swung 56% (an off 16th an eighth of a 16th late) in the hats, the
    ghost snares and the bass's pickups. A boom-bap kit, crunched: a punchy kick on 1 and on pushed 16ths, a tight
    snare on 2 and 4, soft snares between, hats in 16ths.
  - F sharp minor (Dorian where the plan's B9 has its D sharp).
  - Its five patches: a gritty FM guitar (an operator fed back hard, overdriven: the power-chord crash and the
    riffs); a smoky drawbar organ (its first three harmonics, a click on each key); the off-beat stabs, a wah-pluck
    and an electric piano by turns; a funk bass on the octave and the fifth; a choir pad that swells under the bridge.
  - Its 32 bars and their chords: the intro (the F#5 crash, then drums, the bass on F sharp, the off-beat stabs on
    F#m7 and B9 over F sharp, a quiet high tone from the fifth bar); section A (F#m7, E, Dmaj7, C#7sus4 to C#7: the
    guitar and the organ on one tune, rests between its phrases); section B (Bm7, E9, Amaj7, Dmaj7, G#m7b5, C#7#9: no
    guitar; electric piano chords, the choir, a smooth lead, a walking bass); section C (F#m7, Dmaj7, E, C#7#9: the
    guitar and the organ trading phrases on the five-note minor scale, drum breaks, and bar 1).
"Looped twice" in the plan is 2:40, which is his "2.5 min roughly": the 32 bars are played twice. The second time is
the same notes with a little more on them, from the plan's own parts: the high tone from the intro's first bar; the
organ an octave over the tune in A; the electric piano an octave over the lead in B; the organ calling and the
guitar answering in C.
"Keep the sound more muted overall" and "background": the guitar's cabinet is dark, the organ has no bright
drawbars, the kit is dusty, the whole mix is cut lower than the themes' (lowpass 6000), and the leads sit a little
under where a boss theme's would.
What the plan leaves to whoever builds it is written here, inside its chords, and is original (none of it is any
song's or any game's): the tune of A, the lead of B, the traded phrases of C, the bass's pocket and its walk, the
stabs' rhythm, the kit's pattern and breaks.
  python3 song_an.py <out.wav>

  each time round (80 s; the second starts at 1:20):
  bars  1-8   0:00  the crash; the kit, the bass, the off-beat stabs; a high tone from bar 5
  bars  9-16  0:20  A: the guitar and the organ, one tune
  bars 17-24  0:40  B: the electric piano, the choir, the organ's lead, the bass walking
  bars 25-32  1:00  C: the guitar and the organ trade; breaks; the turnaround
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, LOOP, TURNS = 96, 32, 2
BARS = LOOP * TURNS
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 160.0 s
SWING = 0.12  # an off 16th is this much of a 16th late (56%)
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the bass's note, the stabs' three, the pad's (and the organ's) four.
NOIR = {
    "F#m7": ("F#1", "E4 A4 C#5", "F#3 A3 C#4 E4"), "B9/F#": ("F#1", "D#4 A4 C#5", "F#3 A3 C#4 D#4"), "E": ("E2", "E4 G#4 B4", "E3 G#3 B3 E4"),
    "Dmaj7": ("D2", "F#4 A4 C#5", "D3 F#3 A3 C#4"), "C#7sus4": ("C#2", "F#4 G#4 B4", "C#3 F#3 G#3 B3"), "C#7": ("C#2", "F4 G#4 B4", "C#3 F3 G#3 B3"),
    "Bm7": ("B1", "D4 F#4 A4", "B2 D3 F#3 A3"), "E9": ("E2", "D4 F#4 G#4", "E3 G#3 B3 D4"), "Amaj7": ("A1", "C#4 E4 G#4", "A2 C#3 E3 G#3"),
    "G#m7b5": ("G#1", "B3 D4 F#4", "G#2 B2 D3 F#3"), "C#7#9": ("C#2", "F4 B4 E5", "C#3 F3 B3 E4"),
}
ONCE = ("F#m7 B9/F# F#m7 B9/F# F#m7 B9/F# F#m7 B9/F#  F#m7 F#m7 E E Dmaj7 Dmaj7 C#7sus4 C#7  "
        "Bm7 E9 Amaj7 Dmaj7 G#m7b5 G#m7b5 C#7#9 C#7#9  F#m7 F#m7 Dmaj7 Dmaj7 E E C#7#9 C#7#9").split()
assert len(ONCE) == LOOP
CHORDS = ONCE * TURNS
# The bass's pocket, a bar: (the 16th, half steps over the root, how many 16ths long). Its last two notes step up
# into the next bar's root (written here as if it were the same one).
POCKET = ((0, 0, 3), (3, 12, 1), (6, 0, 2), (8, 7, 2), (10, 12, 1), (11, 0, 2), (14, -2, 1), (15, -1, 1))
# The bridge's walk, a bar a line: quarter notes.
WALK = ("B1 D2 F#2 A2", "E2 F#2 G#2 B2", "A1 C#2 E2 G#2", "D2 F#2 A2 C#3", "G#1 B1 D2 F#2", "G#2 F#2 D2 B1", "C#2 F2 G#2 B2", "C#2 G#2 F2 C#2")

# ---- the lines. Lengths in beats; .25 is a 16th. ----
# A: the tune, the guitar's and the organ's together: a phrase falls and stops; its answer climbs and holds.
TUNE = (
    "C#5:.75 B4:.75 A4:.5 F#4:1 -:1 | -:.5 F#4:.5 A4:.5 B4:.5 C#5:1.5 -:.5 | B4:.75 A4:.75 G#4:.5 E4:1 -:1 | -:.5 E4:.5 G#4:.5 B4:.5 E5:1.5 -:.5 | "
    "F#5:.75 E5:.75 C#5:.5 A4:1 -:1 | -:.5 A4:.5 C#5:.5 E5:.5 F#5:1.5 -:.5 | G#4:.75 B4:.75 C#5:.5 F#5:1 -:1 | F5:1.5 C#5:.5 G#4:.5 F4:.5 -:1"
)
# B: the lead, smooth: up each chord and round; then up the C sharp seventh and down through its sharp ninth.
LEAD = "D5:1.5 F#5:.5 A5:2 | G#5:1.5 F#5:.5 D5:1 B4:1 | C#5:1.5 E5:.5 G#5:2 | F#5:1.5 E5:.5 C#5:1 A4:1 | B4:1 D5:1 F#5:2 | G#5:1.5 F#5:.5 D5:1 B4:1 | C#5:1 F5:1 G#5:1 B5:1 | B5:.5 G#5:.5 E5:1 C#5:2"
# C: the trade, a bar each (the five-note minor scale), then two bars together on the C sharp chord.
CALLS = ("F#4:.5 A4:.5 B4:.25 C#5:.75 E5:1 C#5:.5 B4:.5", "F#4:.5 A4:.5 C#5:.25 E5:.75 F#5:1 E5:.5 C#5:.5", "E4:.5 G#4:.5 B4:.25 C#5:.75 E5:1 B4:.5 G#4:.5")
ANSWERS = ("E5:.75 C#5:.75 B4:.5 A4:.5 F#4:.5 A4:1", "A5:.75 F#5:.75 E5:.5 C#5:.5 A4:.5 C#5:1", "G#5:.75 E5:.75 C#5:.5 B4:.5 G#4:.5 B4:1")
TOGETHER = "G#4:.75 B4:.75 C#5:.5 E5:1 F5:1 | G#5:1 F5:.5 C#5:.5 B4:.5 G#4:.5 F4:1"
for _line, _beats in ((TUNE, 32), (LEAD, 32), (TOGETHER, 8), *((c, 4) for c in CALLS + ANSWERS)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The loop as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage."""
    x = Ride(RIDE, BEATS, None, os=2, seed=353, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(137)
    sr = x.sr
    tau = 2 * np.pi
    chord = lambda bar: NOIR[CHORDS[(bar - 1) % BARS]]
    sw = lambda i: (i + (SWING if i % 2 else 0)) / 4  # a 16th of the bar, in beats, swung

    def sway(b):
        """A line's note that starts on an off 16th starts late, as the kit's do."""
        q = float(b) * 4
        return float(b) + SWING / 4 if abs(q - round(q)) < 1e-6 and round(q) % 2 else float(b)

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def crunch(w, rate=9000, steps=20):
        """A sampled drum as an old sampler played it: few samples a second, few levels (the kit's dust)."""
        hold = max(1, int(sr / rate))
        return np.round(np.repeat(w[::hold], hold)[: len(w)] * steps) / steps

    def fed(ph, beta=0.9):
        """A sine operator fed back on itself: it leans toward a sawtooth."""
        y = np.sin(ph)
        for _ in range(6):
            y = np.sin(ph + beta * y)
        return y

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(52 + 100 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.1)) + 0.2 * hiss(k, 4000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.24, ghost=False):
        k = int((0.05 if ghost else 0.14) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(200 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.04)
        put("snare", b, crunch(0.8 * body + 0.85 * hiss(k, 6500, 0.45) * np.exp(-t / (0.018 if ghost else 0.06))) * tail(k, 0.006) * vol, 0.05)

    def hat(b, vol=0.02, open_=False, pan=0.3):
        k = int((0.13 if open_ else 0.035) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 9500, 0.8) * np.exp(-t / (0.045 if open_ else 0.009)) * tail(k, 0.004) * vol, pan)

    def crash(b, vol=0.04):
        k = int(1.2 * sr)
        t = np.arange(k) / sr
        put("crash", b, hiss(k, 10000, 0.75) * np.exp(-t / 0.25) * np.minimum(1, t / 0.002) * tail(k, 0.05) * vol, -0.2)

    def groove(bar, vol=1.0, brk=""):
        """A bar of the kit: the kick on 1 and on pushed 16ths (two patterns, bar about); the snare on 2 and 4; soft
        snares between; hats in swung 16ths, one open before 4 every other bar. `brk`: the bar's last beat is a break:
        the snare's 16ths as written (s, or a dot)."""
        b = bar0(bar)
        cut = 16 - len(brk)
        for i in ((0, 7, 10) if bar % 2 else (0, 3, 10, 11)):
            if i < cut:
                kick(b + sw(i), (0.5 if i == 0 else 0.4) * vol)
        for i in (4, 12):
            if i < cut:
                snare(b + i / 4, 0.24 * vol)
        for i in ((9, 15) if bar % 2 else (7, 9, 15)):
            if i < cut:
                snare(b + sw(i), 0.06 * vol, ghost=True)
        for i in range(cut):
            opened = i == 10 and bar % 2 == 0
            hat(b + sw(i), (0.022 if i % 4 == 0 else 0.015 if i % 2 == 0 else 0.009) * vol * (1.2 if opened else 1), open_=opened)
        for j, c in enumerate(brk):
            if c == "s":
                snare(b + sw(cut + j), (0.12 + 0.04 * j) * vol)

    # ---- the five patches ----
    made = {}

    def axe(ms, secs):
        """The gritty FM guitar: each string an operator fed back on itself as far as it goes, the strings driven
        together into a clip, then a dark cabinet (muted: nothing much over 3 kHz). Kept once made."""
        key = (tuple(ms), round(secs, 3))
        if key not in made:
            k = int(secs * sr)
            t = np.arange(k) / sr
            w = np.zeros(k)
            for j, m in enumerate(ms):
                ph = tau * x.hz(m + (-4, 3, -2)[j % 3] / 100) * t + 1.3 * j
                w += np.sin(ph + 1.7 * fed(ph, 0.97))
            w = np.tanh(2.8 * w / len(ms) * (0.35 + 0.65 * np.exp(-t / 0.7)))
            f = np.fft.rfftfreq(k, 1 / sr)
            cab = 1 / np.sqrt(1 + (f / 3000) ** 4) * (f / 110) / np.sqrt(1 + (f / 110) ** 2) * (1 + 0.7 * np.exp(-(((f - 800) / 450) ** 2)))
            made[key] = np.fft.irfft(np.fft.rfft(w) * cab, n=k) * np.minimum(1, t / 0.002) * tail(k, 0.012)
        return made[key]

    def riff(start, text, vol=1.0, shift=0, pan=-0.25):
        """A line on the guitar, one string."""
        for b, d, m in notes(start, text):
            b = sway(b)
            at(b, d)
            put("gtr", b, axe((m + shift,), x.k(d * 0.92) / sr) * 0.17 * vol, pan)

    def power(b, low, long, vol=1.0):
        """The guitar's power chord: the root, its fifth and its octave."""
        at(b, long)
        put("gtr", b, axe((low, low + 7, low + 12), x.k(long) / sr) * 0.2 * vol, -0.25)

    DRAW = (1, 0.85, 0.7, 0.12, 0.05)  # the drawbars: the first three, and nothing bright

    def key(m, d, vol, click=1.0):
        """The smoky drawbar organ's note: its first three harmonics, a slow waver, a click on the key."""
        w = x.tone(m, d, list(DRAW), vol, attack=0.003, release=0.015, trem=0.12, trem_hz=5.6)
        k = len(w)
        t = np.arange(k) / sr
        return w + click * (0.45 * np.sin(tau * 4 * x.hz(m) * t) * np.exp(-t / 0.012) + 0.25 * hiss(k, 7000, 0.5) * np.exp(-t / 0.002)) * vol * tail(k, 0.01)

    def organ(start, text, vol=1.0, shift=0, pan=0.15, click=1.0, held=0.9):
        """A line on the organ."""
        for b, d, m in notes(start, text):
            b = sway(b)
            at(b, d)
            put("organ", b, key(m + shift, d * held, 0.1 * vol, click), pan)

    def swell(bar, vol=0.02):
        """A bar of the organ holding the chord, low under the trade."""
        at(bar0(bar), 4)
        for j, m in enumerate(n(c) for c in chord(bar)[2].split()):
            put("organ", bar0(bar), key(m, 3.9, vol, 0.3), (-0.3, -0.1, 0.1, 0.3)[j])

    def ep(b, m, vol=0.04, pan=0.0, long=0.5):
        """The electric piano's note: FM, a soft bell on its front."""
        at(b, 2)
        k = int((3 * long + 0.1) * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.sin(ph + 1.0 * np.exp(-t / 0.06) * np.sin(4 * ph) + 0.4 * np.sin(ph)) * np.exp(-t / long)
        put("keys", b, w * np.minimum(1, t / 0.0015) * tail(k, 0.1) * vol, pan)

    def wah(b, ms, vol=0.05, pan=0.3):
        """The wah-pluck's chord: each note's harmonics heard through a narrow band that opens upward as it's struck
        (600 Hz to 1.7 kHz in 70 ms), short."""
        k = int(0.16 * sr)
        t = np.arange(k) / sr
        mid = 600 + 1100 * (1 - np.exp(-t / 0.035))
        w = np.zeros(k)
        for m in ms:
            f0 = x.hz(m)
            for h in range(1, int(4000 / f0) + 1):
                w += np.exp(-(((h * f0 - mid) / 420) ** 2)) / h**0.5 * np.sin(h * tau * f0 * t + h)
        put("wah", b, w / len(ms) * np.minimum(1, t / 0.002) * np.exp(-t / 0.05) * tail(k, 0.02) * vol, pan)

    def pick(b, m, long=0.25, vol=0.3):
        """The funk bass's note: FM, punchy at its front, as much of its octave as of its note (a small speaker has
        the octave)."""
        at(b, long)
        k = x.k(long)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = 0.6 * np.sin(ph + (2.8 * np.exp(-t / 0.07) + 0.9) * np.sin(ph)) * (0.4 + 0.6 * np.exp(-t / 0.15)) + 0.5 * np.sin(2 * ph + 1.3 * np.sin(ph)) * (0.35 + 0.65 * np.exp(-t / 0.12))
        put("bass", b, w * np.minimum(1, t / 0.002) * tail(k, 0.015) * vol)

    def pocket(bar, vol=1.0, upto=16):
        """A bar of the bass's pocket."""
        low, nxt = n(chord(bar)[0]), n(chord(bar + 1)[0])
        for i, over, long in POCKET:
            if i < upto:
                pick(bar0(bar) + sw(i), (nxt if over < 0 else low) + over, long / 4 * 0.9, (0.3 if i == 0 else 0.24) * vol)

    def hum(b, m, d, vol, pan):
        """One of the choir pad's notes: voices humming, soft and airy, a slow swell in and out."""
        at(b, d)
        f0 = x.hz(m)
        hs = np.arange(1, int(3000 / f0) + 1)
        shape = (np.exp(-(((hs * f0 - 420) / 260) ** 2)) + 0.45 * np.exp(-(((hs * f0 - 950) / 300) ** 2)) + 0.08 * np.exp(-(((hs * f0 - 2500) / 500) ** 2))) / hs**0.5
        put("pad", b, x.tone(m, d, list(shape / shape.max()), vol, detune=(-9, 0, 8), vib=0.004, vib_hz=4.8, attack=0.7, release=0.7), pan)

    def stabs(bar, vol=1.0):
        """A bar of the off-beat stabs: the electric piano on the "and" of 1 and of 3, the wah-pluck on the "and" of 2
        and of 4."""
        ms = [n(c) for c in chord(bar)[1].split()]
        for i in (2, 10):
            for j, m in enumerate(ms):
                ep(bar0(bar) + i / 4, m, 0.032 * vol, (-0.3, 0.0, 0.3)[j], 0.3)
        for i in (6, 14):
            wah(bar0(bar) + i / 4, ms, 0.05 * vol)

    def drone(b, long, vol=0.006):
        """The quiet high tone: two notes a hair apart, slow to come and go."""
        at(b, long)
        put("drone", b, x.tone(n("C#6"), long, [1, 0.12], vol, detune=(-7, 6), vib=0.002, vib_hz=3.0, attack=2.0, release=2.0), 0.2)

    # ---- the four sections; `turn`: which time round (0, 1) ----
    def intro(first, turn):
        for j in range(8):
            groove(first + j, 0.95, brk="s.ss" if j == 7 else ""), pocket(first + j), stabs(first + j)
        power(bar0(first), n("F#2"), 3.5, 1.1), crash(bar0(first), 0.05)
        drone(bar0(first + (0 if turn else 4)), 32 if turn else 16)

    def hook(first, turn):
        """Section A: the guitar (low) and the organ on the tune; the second time the organ an octave over it too."""
        for j in range(8):
            groove(first + j, 1.0, brk="ss.s" if j == 7 else ""), pocket(first + j), stabs(first + j, 0.7)
        crash(bar0(first), 0.035)
        riff(bar0(first), TUNE, 1.0, -12), organ(bar0(first), TUNE, 1.0)
        if turn:
            organ(bar0(first), TUNE, 0.4, 12, 0.3, 0.5)

    def bridge(first, turn):
        """Section B: no guitar. The electric piano's chords, the choir's swells, the organ's lead (smooth: no click,
        each note held its whole length), the bass walking; the second time the electric piano an octave over the lead."""
        for j in range(8):
            bar = first + j
            groove(bar, 0.85, brk="s.ss" if j == 7 else "")
            for i, name in enumerate(WALK[j].split()):
                pick(bar0(bar) + i, n(name), 0.8, 0.27)
            ms = [n(c) for c in chord(bar)[1].split()]
            for i in (0, 6, 10):
                for q, m in enumerate(ms):
                    ep(bar0(bar) + sw(i), m, (0.04 if i == 0 else 0.028), (-0.3, 0.0, 0.3)[q], 0.6 if i == 0 else 0.3)
            for q, m in enumerate(n(c) for c in chord(bar)[2].split()):
                hum(bar0(bar), m + 12, 4.4, 0.016, (-0.5, -0.17, 0.17, 0.5)[q])
        organ(bar0(first), LEAD, 0.85, 0, 0.1, 0.0, 0.99)
        if turn:
            for b, d, m in notes(bar0(first), LEAD):
                ep(b, m + 12, 0.035, 0.35, 0.5)

    def climax(first, turn):
        """Section C: the guitar and the organ trade, a bar each (the second time the organ calls); the organ holds
        the chords under; a break ends each answer; the last two bars are theirs together, the kit hitting with them."""
        for j in range(6):
            bar = first + j
            groove(bar, 1.05, brk="s.ss" if j % 2 else ""), pocket(bar, 1.05), swell(bar)
            if j % 2 == 0:
                power(bar0(bar), n(chord(bar)[0]) + (12 if chord(bar)[0].endswith("1") else 0), 1.5, 0.85)
            call = (j % 2 == 0) != bool(turn)
            line = (CALLS if j % 2 == 0 else ANSWERS)[j // 2]
            riff(bar0(bar), line, 1.05) if call else organ(bar0(bar), line, 1.05)
        crash(bar0(first), 0.045)
        b = bar0(first + 6)
        riff(b, TOGETHER, 1.0, -12), organ(b, TOGETHER, 1.0)
        for j in range(2):
            pocket(first + 6 + j, 1.05, upto=8 if j else 16), swell(first + 6 + j)
        for beat in (0, 0.75, 1.5, 2, 3, 4, 5):
            kick(b + beat, 0.48), snare(b + beat, 0.2)
        for i in range(16):
            hat(b + sw(i), 0.02 if i % 4 == 0 else 0.012)
        for i, v in zip((24, 25, 26, 27, 28, 29, 30, 31), (0.1, 0.07, 0.12, 0.09, 0.15, 0.12, 0.19, 0.22)):
            snare(b + sw(i), v)

    for turn in range(TURNS):
        first = 1 + LOOP * turn
        intro(first, turn), hook(first + 8, turn), bridge(first + 16, turn), climax(first + 24, turn)

    # A dim room for the organ, the electric piano, the stabs and the choir; a little for the guitar; none for the
    # kit or the bass.
    def room(name, secs=1.4, wet=0.18):
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.02)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 3500) ** 2) * (f > 150), n=size, axis=1)

    x.beat_s = 60 / BPM
    x.echo("keys", 0.75, 0.14, 0.06), x.echo("wah", 0.75, 0.16, 0.07)
    for name, secs, wet in (("organ", 1.4, 0.2), ("keys", 1.6, 0.25), ("wah", 1.4, 0.2), ("pad", 2.2, 0.4), ("gtr", 1.0, 0.1), ("drone", 2.4, 0.4)):
        room(name, secs, wet)
    levels = {"gtr": 0.7, "organ": 1.0, "keys": 2.4, "wah": 14.0, "pad": 2.3, "drone": 1.6, "bass": 0.9, "kick": 0.72, "snare": 1.9, "hats": 6.0, "crash": 2.1}
    return x.play(x.mixdown(levels, lowpass=6000, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
