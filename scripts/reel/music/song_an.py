"""Song AN (Eric, Nov 19): the battle tower's music, from a plan: a loop of 2:40. "Heres instructions for a new one,
please make it 2.5 min roughly, keep the sound more muted overall, it's the background battle tower music". The plan
is his own (made with another assistant, as Babur's and Chandy's were), "Moody 90s Acid-Jazz & Neo-Noir Hip-Hop
Rock": 96 beats a minute, the 16ths swung 56%, F sharp minor, a boom-bap kit, a funk bass, off-beat stabs, a gritty
guitar; 32 bars, "looped twice" (2:40, his "2.5 min roughly").

The first build (in the history: commit 5767b109) kept its first eight bars and lost the rest. His second plan, on
hearing it: the opening 20 seconds "lock into a slick, moody boom-bap drum pocket with a punchy funk bassline and
dark off-beat chord stabs", and from 0:20 the leads were "thin, high-register monophonic synth leads" ("a plastic
kazoo, a cheesy Casio keyboard demo, and a squeaky whistle") over rhythms that "fight the groove", and the bridge
turned "bright, plodding, overly sweet". So, as that plan says, and it is his to give:
  - Bars 1-8 are frozen: not a note, a drum or a patch of them is changed (the code that makes them is as it was).
  - After bar 8, nothing is above F#4 and nothing is under F#2 but the bass; every instrument that carries pitch is
    low-passed between 2.0 and 2.8 kHz; no single-line synth leads at all.
  - Three instruments, his: A, a gritty overdriven guitar, low (power chords, low riffs, a slide into a riff's top
    note; palm-muted, a 90 ms decay); B, a smoky dark electric piano and organ in one (chords of three or four notes,
    never single notes; cut at 2 kHz; two players a hair apart, one each side); C, a dark muted guitar's short
    accents, deep in the pocket.
  - Bars 9-16, A: the same kit and bass pocket as bars 1-8. F#m7, E6/9, Dmaj7, C#7#9, two bars each. The guitar's
    two-bar riff, low (the plan's F#3 A3 B3 C#4, then an answer round the root), a rest on beats 3 and 4 of every
    bar; B's chords held quietly under it.
  - Bars 17-24, B: darker, not brighter. Bm9, Amaj9, G#m7b5, C#7#9, two bars each. No guitar; the kit is a deep
    kick, a rimshot and swung hats; the bass walks; B's chords held, and three notes of it (in thirds or fourths,
    C#4 to F#4 at the top) ending each second bar. Beats 3 and 4 of bar 24: the kit stops; a low guitar slide; a
    snare flam into bar 25.
  - Bars 25-32, C: the full kit and pocket. F#m7, Dmaj7, E, C#7#9. The guitar's power chords on 1 and the "and" of
    2 of every bar; a low riff answers them in one bar, B's thick chord in the next; C's accents; a tight fill ends
    bar 32, and bar 1's crash is the loop.
The 32 bars are played twice; the second time is the same, with C's accents picking up into each of A's riffs.
"Keep the sound more muted overall": the mix is cut at 6 kHz as before.
What the plans leave to whoever builds it is written here, inside their rules, and is original (none of it is any
song's or any game's): the riffs' rhythm and answers, B's voicings and fills, the bass's pocket and walk, the kit.
  python3 song_an.py <out.wav>

  each time round (80 s; the second starts at 1:20):
  bars  1-8   0:00  the crash; the kit, the bass, the off-beat stabs; a high tone from bar 5   (frozen)
  bars  9-16  0:20  A: the low guitar's riff, rests, dark chords under it
  bars 17-24  0:40  B: dark chords and their three-note fills, a rimshot, the bass walking; the pause, the slide
  bars 25-32  1:00  C: power chords on 1 and the "and" of 2, a low riff and the thick chord by turns; the fill
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

# A chord: the bass's note; the intro's stabs' three; B's notes (F#3 to E4, or a step outside to voice it well); the
# guitar's power chord's root.
NOIR = {
    "F#m7": ("F#1", "E4 A4 C#5", "F#3 A3 C#4 E4", "F#2"), "B9/F#": ("F#1", "D#4 A4 C#5", "", ""), "E6/9": ("E2", "", "F#3 G#3 B3 C#4", "E3"),
    "Dmaj7": ("D2", "", "F#3 A3 C#4 E4", "D3"), "C#7#9": ("C#2", "", "F3 G#3 B3 E4", "C#3"), "Bm9": ("B1", "", "D3 F#3 A3 C#4", ""),
    "Amaj9": ("A1", "", "G#3 B3 C#4 E4", ""), "G#m7b5": ("G#1", "", "F#3 G#3 B3 D4", ""), "E": ("E2", "", "G#3 B3 E4", "E3"),
}
ONCE = ("F#m7 B9/F# F#m7 B9/F# F#m7 B9/F# F#m7 B9/F#  F#m7 F#m7 E6/9 E6/9 Dmaj7 Dmaj7 C#7#9 C#7#9  "
        "Bm9 Bm9 Amaj9 Amaj9 G#m7b5 G#m7b5 C#7#9 C#7#9  F#m7 F#m7 Dmaj7 Dmaj7 E E C#7#9 C#7#9").split()
assert len(ONCE) == LOOP
CHORDS = ONCE * TURNS
# The bass's pocket, a bar: (the 16th, half steps over the root, how many 16ths long). Its last two notes step up
# into the next bar's root (written here as if it were the same one).
POCKET = ((0, 0, 3), (3, 12, 1), (6, 0, 2), (8, 7, 2), (10, 12, 1), (11, 0, 2), (14, -2, 1), (15, -1, 1))
# The bridge's walk, a bar a line: quarter notes (the last bar's stop after two: the pause).
WALK = ("B1 D2 F#2 A2", "B2 A2 F#2 G#2", "A2 G#2 E2 C#2", "A1 C#2 E2 G1", "G#1 B1 D2 F#2", "G#2 F#2 D2 C2", "C#2 F2 G#2 B2", "C#2 G#1")

# ---- the lines after bar 8. Lengths in beats; .25 is a 16th; a "^" is a note slid into. Nothing over F#4. ----
# A: the guitar's riff, two bars a chord: up to the chord's top with a slide, a rest; an answer round the root, a rest.
RIFFS = (
    "F#3:.5 A3:.25 B3:.75 C#4^:.5 -:2 | A3:.5 F#3:.75 E3:.25 F#3:.5 -:2", "E3:.5 G#3:.25 B3:.75 C#4^:.5 -:2 | B3:.5 G#3:.75 F#3:.25 E3:.5 -:2",
    "D3:.5 F#3:.25 A3:.75 C#4^:.5 -:2 | A3:.5 F#3:.75 E3:.25 D3:.5 -:2", "C#3:.5 F3:.25 G#3:.75 B3^:.5 -:2 | E4^:.5 C#4:.75 B3:.25 G#3:.5 -:2",
)
# B: three notes of the chords' instrument ending each second bar (from the "and" of 3): (the lower, the upper) pairs.
FILLS = (("B3 D4", "C#4 E4", "D4 F#4"), ("C#4 F#4", "B3 E4", "G#3 C#4"), ("D4 F#4", "C#4 E4", "B3 D4"))
# C: the guitar's answer to its own power chords, beats 3 and 4 of each chord's first bar.
BITES = ("F#3:.25 A3:.25 B3:.5 C4:.25 C#4^:.75", "F#3:.25 A3:.25 B3:.5 A3:.5 F#3:.5", "E3:.25 G#3:.25 B3:.5 C#4^:.5 B3:.5", "E4^:.25 C#4:.25 B3:.5 G#3:.5 F3:.5")
for _line, _beats in (*((r.replace("^", ""), 8) for r in RIFFS), *((r.replace("^", ""), 2) for r in BITES)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))
_tops = [n(tok.split(":")[0].rstrip("^")) for line in RIFFS + BITES for tok in line.replace("|", " ").split() if not tok.startswith("-")]
_tops += [n(c) for pairs in FILLS for pair in pairs for c in pair.split()] + [n(c) for v in NOIR.values() for c in v[2].split()]
assert max(_tops) <= n("F#4") and min(_tops) >= n("F#2"), (min(_tops), max(_tops))


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
        snares between; hats in swung 16ths, one open before 4 every other bar. `brk`: the bar's end is a break: the
        snare's 16ths as written (s, or a dot)."""
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
                snare(b + sw(cut + j), (0.12 + 0.12 * j / (len(brk) - 1)) * vol)

    # ---- the intro's patches (frozen: bars 1-8 are made by these, as they were) ----
    made = {}

    def axe(ms, secs):
        """The intro's guitar (its crash): each string an operator fed back on itself as far as it goes, the strings
        driven together into a clip, then a dark cabinet. Kept once made."""
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

    def power(b, low, long, vol=1.0):
        """The intro's power chord: the root, its fifth and its octave."""
        at(b, long)
        put("gtr", b, axe((low, low + 7, low + 12), x.k(long) / sr) * 0.2 * vol, -0.25)

    def ep(b, m, vol=0.04, pan=0.0, long=0.5):
        """The intro's electric piano's note: FM, a soft bell on its front."""
        at(b, 2)
        k = int((3 * long + 0.1) * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.sin(ph + 1.0 * np.exp(-t / 0.06) * np.sin(4 * ph) + 0.4 * np.sin(ph)) * np.exp(-t / long)
        put("keys", b, w * np.minimum(1, t / 0.0015) * tail(k, 0.1) * vol, pan)

    def wah(b, ms, vol=0.05, pan=0.3):
        """The intro's wah-pluck's chord: each note's harmonics heard through a narrow band that opens upward as it's
        struck (600 Hz to 1.7 kHz in 70 ms), short."""
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

    def stabs(bar, vol=1.0):
        """A bar of the intro's off-beat stabs: the electric piano on the "and" of 1 and of 3, the wah-pluck on the
        "and" of 2 and of 4."""
        ms = [n(c) for c in chord(bar)[1].split()]
        for i in (2, 10):
            for j, m in enumerate(ms):
                ep(bar0(bar) + i / 4, m, 0.032 * vol, (-0.3, 0.0, 0.3)[j], 0.3)
        for i in (6, 14):
            wah(bar0(bar) + i / 4, ms, 0.05 * vol)

    def drone(b, long, vol=0.006):
        """The intro's quiet high tone: two notes a hair apart, slow to come and go."""
        at(b, long)
        put("drone", b, x.tone(n("C#6"), long, [1, 0.12], vol, detune=(-7, 6), vib=0.002, vib_hz=3.0, attack=2.0, release=2.0), 0.2)

    def intro(first, turn):
        for j in range(8):
            groove(first + j, 0.95, brk="s.ss" if j == 7 else ""), pocket(first + j), stabs(first + j)
        power(bar0(first), n("F#2"), 3.5, 1.1), crash(bar0(first), 0.05)
        drone(bar0(first + (0 if turn else 4)), 32 if turn else 16)

    # ---- after bar 8: three instruments, low and dark ----
    growls = {}

    def growl(ms, secs, mute=False, slide=0.0, dive=0.0):
        """Instruments A and C, the gritty guitar: each string an operator fed back hard, the strings driven together
        through two clips (thick), then a cabinet with weight in its low middle and nothing over 2.4 kHz. `mute`:
        palm-muted, a 90 ms decay. `slide`: it starts that many half steps off and bends into pitch in 100 ms;
        `dive`: it falls that many over its length. Kept once made."""
        key = (tuple(ms), round(secs, 3), mute, slide, dive)
        if key not in growls:
            k = int(secs * sr)
            t = np.arange(k) / sr
            bend = slide * np.exp(-t / 0.035) + dive * (t / max(secs, 1e-6)) ** 1.3
            w = np.zeros(k)
            for j, m in enumerate(ms):
                ph = tau * np.cumsum(x.hz(m + (-4, 3, -2)[j % 3] / 100) * 2 ** (bend / 12)) / sr + 1.3 * j
                w += np.sin(ph + 1.7 * fed(ph, 0.97))
            w = np.tanh(1.6 * np.tanh(3.2 * w / len(ms) * (np.exp(-t / 0.09) if mute else 0.4 + 0.6 * np.exp(-t / 0.8))))
            f = np.fft.rfftfreq(k, 1 / sr)
            cab = 1 / np.sqrt(1 + (f / (1500 if mute else 2400)) ** 8) * (f / 90) / np.sqrt(1 + (f / 90) ** 2) * (1 + 0.8 * np.exp(-(((f - 380) / 260) ** 2)))
            growls[key] = np.fft.irfft(np.fft.rfft(w) * cab, n=k) * np.minimum(1, t / 0.002) * tail(k, 0.015)
        return growls[key]

    def low_riff(start, text, vol=1.0, pan=-0.2):
        """A line on instrument A: one string, each note held nearly its length; a "^" note is slid up into."""
        t0 = float(start)
        for tok in text.replace("|", " ").split():
            name, _, d = tok.partition(":")
            d = float(d)
            if name != "-":
                b = sway(t0)
                at(b, d)
                put("low", b, growl((n(name.rstrip("^")),), x.k(d * 0.94) / sr, slide=-1.0 if name.endswith("^") else 0.0) * 0.17 * vol, pan)
            t0 += d

    def chop(b, low, long=0.4, vol=1.0):
        """Instrument A's power chord: the root and its fifth (and the octave, where that is no higher than F#4)."""
        at(b, long)
        ms = (low, low + 7, low + 12) if low + 12 <= n("F#4") else (low, low + 7)
        put("low", b, growl(ms, x.k(long) / sr) * 0.2 * vol, -0.2)

    def chk(b, low, vol=1.0):
        """Instrument C: the muted guitar's accent, a root and its fifth, gone in a 16th."""
        put("chk", b, growl((low, low + 7), 0.13, mute=True) * 0.15 * vol, 0.15)

    def smoke(b, names, long, vol=1.0):
        """Instrument B's chord: an electric piano's soft front on an organ's held tone (four low harmonics, a slow
        waver), each note played twice a hair apart, one each side."""
        at(b, long)
        for m in (n(c) for c in names.split()):
            for cents, pan in ((-6, -0.55), (5, 0.55)):
                w = x.tone(m, long, [1, 0.5, 0.25, 0.08], 0.03 * vol, detune=(cents,), attack=0.015, release=0.2, trem=0.08, trem_hz=5.3)
                t = np.arange(len(w)) / sr
                put("smoke", b, w * (0.75 + 0.5 * np.exp(-t / 0.25)), pan)

    def rim(b, vol=0.1):
        """A rimshot: a click and a short woody note."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("snare", b, (np.sin(tau * 820 * t) + 0.5 * np.sin(tau * 1730 * t) + 0.4 * hiss(k, 7000, 0.4) * np.exp(-t / 0.002)) * np.exp(-t / 0.012) * np.minimum(1, t / 0.0005) * tail(k) * vol, 0.05)

    def hook(first, turn):
        """Section A: the kit and the bass's pocket exactly as in bars 1-8; the guitar's riff, two bars a chord, a
        rest on beats 3 and 4 of every bar; B's chord held quietly under each bar. The second time, C's two accents
        pick up into each riff."""
        for j in range(8):
            bar = first + j
            groove(bar, 0.95, brk="s.ss" if j == 7 else ""), pocket(bar)
            smoke(bar0(bar), chord(bar)[2], 3.8, 0.45)
            if turn and j % 2 == 1 and j < 7:
                low = n(chord(bar + 1)[3])
                chk(bar0(bar) + sw(14), low, 0.7), chk(bar0(bar) + sw(15), low, 0.85)
        for j, text in enumerate(RIFFS):
            low_riff(bar0(first + 2 * j), text)

    def bridge(first, turn):
        """Section B: no guitar. A deep kick, a rimshot on 2 and 4, swung hats; the bass walking; B's chords held (and
        touched again, softly, on the "and" of 3), three notes of it ending each second bar. Beats 3 and 4 of the
        last bar: the kit and the bass stop; a low guitar slide down to F sharp; a snare flam into what follows."""
        for j in range(8):
            bar = first + j
            b = bar0(bar)
            last = j == 7
            kick(b, 0.5)
            if not last:
                kick(b + 2.5, 0.38), rim(b + 3, 0.2)
            rim(b + 1, 0.2)
            for i in range(8 if last else 16):
                hat(b + sw(i), 0.02 if i % 4 == 0 else 0.013 if i % 2 == 0 else 0.008)
            for i, name in enumerate(WALK[j].split()):
                pick(b + i, n(name), 0.8, 0.27)
            smoke(b, chord(bar)[2], 2.0 if last else 3.9, 1.0)
            if not last:
                smoke(b + 2.5, " ".join(chord(bar)[2].split()[1:]), 1.3, 0.55)
            if j in (1, 3, 5):
                for i, pair in enumerate(FILLS[j // 2]):
                    smoke(b + 2.5 + i / 2, pair, 0.45 if i < 2 else 1.0, 1.15)
        b = bar0(first + 7)
        at(b + 2, 1.8)
        put("low", b + 2, growl((n("C#3"),), x.k(1.8) / sr, dive=-7.0) * 0.16, -0.2)
        snare(b + sw(15) - 0.07, 0.1), snare(b + sw(15), 0.2)

    def climax(first, turn):
        """Section C: the full kit and pocket, a little harder. The guitar's power chords on 1 and the "and" of 2 of
        every bar; in each chord's first bar its low riff answers them on beats 3 and 4 over B's chord, quiet; in its
        second B's chord is thick, with C's accents. A tight fill ends the last bar."""
        for j in range(8):
            bar = first + j
            b = bar0(bar)
            groove(bar, 1.05, brk="s.s.ssss" if j == 7 else ""), pocket(bar, 1.05, upto=8 if j == 7 else 16)
            low = n(chord(bar)[3])
            chop(b, low, 0.45, 1.15), chop(b + 1.5, low, 0.4, 1.05)
            if j % 2 == 0:
                smoke(b, chord(bar)[2], 3.8, 0.6)
                low_riff(b + 2, BITES[j // 2], 1.2)
            else:
                smoke(b, chord(bar)[2], 1.9 if j == 7 else 3.8, 1.1)
                if j < 7:
                    chk(b + sw(10), low, 0.8), chk(b + sw(15), low, 0.9)
        crash(bar0(first), 0.045)

    for turn in range(TURNS):
        first = 1 + LOOP * turn
        intro(first, turn), hook(first + 8, turn), bridge(first + 16, turn), climax(first + 24, turn)

    def lowpass(name, top):
        """A bus cut off above `top` Hz, steeply (the plan's warmth filter for everything pitched after bar 8)."""
        bus = x.buses[name]
        f = np.fft.rfftfreq(bus.shape[1], 1 / sr)
        x.buses[name] = np.fft.irfft(np.fft.rfft(bus, axis=1) / np.sqrt(1 + (f / top) ** 8), n=bus.shape[1], axis=1)

    # A dim room for the intro's stabs and tone and for B's chords; a little for the guitars; none for the kit or the bass.
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
    lowpass("low", 2600), lowpass("smoke", 2000), lowpass("chk", 2200)
    x.echo("keys", 0.75, 0.14, 0.06), x.echo("wah", 0.75, 0.16, 0.07)
    for name, secs, wet in (("keys", 1.6, 0.25), ("wah", 1.4, 0.2), ("gtr", 1.0, 0.1), ("drone", 2.4, 0.4), ("smoke", 1.6, 0.22), ("low", 1.0, 0.1), ("chk", 0.8, 0.08)):
        room(name, secs, wet)
    levels = {"gtr": 0.7, "low": 0.65, "smoke": 1.5, "chk": 1.3, "keys": 2.4, "wah": 14.0, "drone": 1.6, "bass": 0.9, "kick": 0.72, "snare": 1.9, "hats": 6.0, "crash": 2.1}
    return x.play(x.mixdown(levels, lowpass=6000, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
