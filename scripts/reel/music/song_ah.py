"""Song AH (Eric, Nov 16): a new theme for Folio, a loop of 2:40. "This is the write-up for Folio. Again, about 2
minutes, 45 seconds, around that time is fine. And stick to what I'm sending you." The write-up is his own plan (made
with another assistant, as Babur's and Chandy's were: song_af.py, song_ag.py), "Breezy 90s Japanese City-Pop /
High-Altitude Smooth Synth-Jazz", and it is his to give, so this is the plan, part for part:
  - 102 beats a minute, four in a bar; the 16ths swung 58% (an off 16th a sixth of a 16th late) in the hats, the
    bass's pickups, the chords and the tune.
  - G major: major sevenths and ninths, secondary dominants, and Cmaj7 to Cm6 (the minor four, borrowed).
  - Its four patches: a crystalline bell-Rhodes (an FM electric piano, the modulator four times the note, no attack,
    400 ms); an airy whistle (a plain 50% square with a soft flute an octave under it, a 35 ms glide between joined
    notes, a 5.5 Hz vibrato that comes in late); a warm fingered FM bass (roots, fifths and octaves, and half steps up
    into the next root); a soft reed pad for the bridge.
  - Its three sections and their chords, as given: the opening's vamp (Gmaj9, Cmaj7/G, Gmaj9, C/D); the whistle's
    theme over a four-bar cycle, twice (Gmaj7, F#m7b5 to B7b9; Em9, Dm7 to G7; Cmaj7, Bm7 to Em7; Am9, C/D); the
    bridge, softer, a rim and a brush for the snare, the reed pad in (Cmaj7, Cm6 and F9; Bm7, E7sus4 to E7; Am9, Bm7,
    Cmaj7, C#dim7; C/D, D7b9 and a snare fill that is the pickup into bar 1).
Its 20 bars are 47 seconds, and he wants about 2:45 (SOUNDS.md: a shorter plan is made longer out of its own
sections). So the plan is played three times, a little more in it each time, and the third time has the theme twice:
  1  as written: the vamp; the theme; the bridge, its line on the bell-Rhodes
  2  the vamp with the whistle's small turns in its gaps; the theme; the bridge (its line on the whistle, until
     Eric's piano took this bridge's place: below)
  3  the vamp; the theme with the bell-Rhodes sparkling over it and a second whistle a third or a sixth under the
     first (it was the theme twice, until the piano); the bridge, both lines
68 bars, 160.0 s.
What the plan leaves to whoever builds it is written here, inside its rules, and is original (none of it is any
song's or any game's): the whistle's theme (long notes held over the barline, small turns of 16ths on the five-note
scale), the bridge's line, the bell-Rhodes's rhythm, the bass's line and the kit's pattern.
(Folio has a theme in the game already, song_o.py. This is for Eric to choose between.)

Eric's piano (Nov 16, the same day; he had passed on the song, then played over it): "the 1:16/1:17 seems to be a
natural time to quiet the song and add this layer on top? You'll need to adjust somethings I'm sure". 1:15 is where
the second bridge was; it is his piano's place now. It took three goes to get to what he meant: his notes written
out, on a piano; then a recording of him playing them, which I set on two flutes with a solo after ("It wasn't
correct; also go back to piano actually"); then his own plan for it (made with another assistant, and his to give),
which this is:
  - The left hand, his "low rolling theme": eight bars of steady 8th notes, every pitch as he wrote it ("DO NOT alter
    these pitches or replace them with block chords"): four bars on the white keys (C, G, D, E; then E, F; the same an
    octave up; a turn down through F, E, D), then F sharp in the roll (two bars), D sharp (one), and E again. A warm
    felt piano. It plays its eight bars alone first ("so the listener hears my low rolling theme clearly first"),
    then again under the right hand.
  - The right hand, in octaves 5 and 6, "crystalline". Its hook is his, and the plan's first account of it was
    wrong (five single notes; "Gemini fucked up, it didn't even listen to my note I sent it, now it's corrected").
    Corrected, and played as given: eight hits, each two notes together: C6+E6 three times, "a fast, snappy staccato
    burst" (three 16ths, a pickup); B5+D6 on the beat, held a dotted quarter; A5+C6 a quarter; G5+B5 a quarter; then
    G5+D6 twice, "a quick double-strike": an 8th, and a whole note left to ring ("Do NOT flatten these into even
    quarter/eighth notes"). The last two are B5+D6 on his recording, as I measure it (the G of the hit before still
    ringing under the first): `heard` plays them so, for him to choose by ear.
  - The solo after the hook is mine, and original (none of it is any song's or any game's), and follows the left
    hand: the hook's shape a third higher; a bar of 16ths stepping down in broken thirds; a line with F sharp and a
    grace note; 16ths again; a run on the D sharp bar's chord (B7 flat 9: the harmonic minor's sound); home on E, and
    the hook's last four hits to close, the double-strike ringing into the vamp. The town's lesson holds (16ths that
    only climb and fall "miss"): its runs turn, and step down in threes and fours, with held notes between.
  - His plan says 96 beats a minute; inside this song it goes at the song's 102 ("it should be playing a bit faster
    ... to fit the song"). The 16ths here are even, not swung: nothing swung plays under them.
  - "Quiet the song": the band stops for it. The left hand alone, eight bars; under the solo a soft kick on 1 and a
    rim on 2 and 4; the snare's fill brings the band back. The left hand's last four notes walk down to G, which is
    where the vamp starts. The theme's last note before it ends at the barline.
  - The piano is sixteen bars where the bridge was eight, so the third time round has the theme once, not twice,
    with the bell-Rhodes's sparkle and the second whistle both: 68 bars still.
  python3 song_ah.py <out.wav> [heard]

  bars  1-4    0:00  the vamp: the bell-Rhodes, the bass, the kit
  bars  5-12   0:09  the whistle's theme
  bars 13-20   0:28  the bridge: a rim and a brush, the reed pad, the bell-Rhodes's line
  bars 21-24   0:47  the vamp, the whistle's turns in its gaps
  bars 25-32   0:56  the theme
  bars 33-40   1:15  Eric's piano: the left hand's rolling theme, alone
  bars 41-48   1:34  the left hand again, the right hand's solo over it; the snare's fill
  bars 49-52   1:53  the vamp
  bars 53-60   2:02  the theme, the bell-Rhodes sparkling over it, two whistles
  bars 61-68   2:21  the bridge, both lines; the snare's fill, and bar 1
"""
import re
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 102, 68
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 160.0 s
SWING = 0.16  # an off 16th is this much of a 16th late (58%)
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the bass's note and the bell-Rhodes's four.
SKY = {
    "Gmaj9": ("G2", "B3 D4 F#4 A4"), "Cmaj7/G": ("G2", "B3 C4 E4 G4"), "C/D": ("D2", "A3 C4 E4 G4"), "D13sus4": ("D2", "C4 E4 G4 B4"),
    "Gmaj7": ("G2", "F#3 B3 D4 G4"), "F#m7b5": ("F#2", "A3 C4 E4 F#4"), "B7b9": ("B2", "A3 C4 D#4 F#4"), "Em9": ("E2", "G3 B3 D4 F#4"),
    "Dm7": ("D2", "F3 A3 C4 D4"), "G7": ("G2", "F3 B3 D4 G4"), "Cmaj7": ("C2", "G3 B3 C4 E4"), "Bm7": ("B2", "A3 B3 D4 F#4"),
    "Em7": ("E2", "G3 B3 D4 E4"), "Am9": ("A2", "G3 B3 C4 E4"), "Cm6": ("C2", "G3 A3 C4 Eb4"), "F9": ("F2", "G3 A3 C4 Eb4"),
    "E7sus4": ("E2", "A3 B3 D4 E4"), "E7": ("E2", "G#3 B3 D4 E4"), "C#dim7": ("C#2", "G3 Bb3 C#4 E4"), "D7b9": ("D2", "C4 Eb4 F#4 A4"),
}
# A bar's chords, each with its beats (4 if alone).
VAMP = "Gmaj9 | Cmaj7/G | Gmaj9 | C/D"
CYCLE = "Gmaj7:2 F#m7b5:1 B7b9:1 | Em9:2 Dm7:1 G7:1 | Cmaj7:2 Bm7:1 Em7:1 | Am9:2 C/D:2"
BRIDGE = "Cmaj7 | Cm6:2 F9:2 | Bm7 | E7sus4:2 E7:2 | Am9:2 Bm7:2 | Cmaj7:2 C#dim7:2 | D13sus4 | D7b9"
ONCE = f"{VAMP} | {CYCLE} | {CYCLE} | {BRIDGE}"
PIANO_BARS = 16  # Eric's piano, where the second bridge was (C here only so the bass steps up into it)
PLAN = [[(c.partition(":")[0], float(c.partition(":")[2] or 4)) for c in bar.split()]
        for bar in f"{ONCE} | {VAMP} | {CYCLE} | {CYCLE} | {' | '.join(['Cmaj7'] * PIANO_BARS)} | {VAMP} | {CYCLE} | {CYCLE} | {BRIDGE}".split(" | ")]
assert len(PLAN) == BARS and all(sum(d for _, d in bar) == 4 for bar in PLAN), len(PLAN)

# ---- the lines. Lengths in beats; .25 is a 16th; a note may cross a barline. ----
# The whistle's theme, the cycle twice: a rise to a long third; a turn; a long note held over the barline; home by the
# five-note scale. The second time climbs to the top and ends on a D held into whatever comes next.
THEME = (
    "D5:.5 G5:.5 B5:2 A5:.5 F#5:.5 | G5:1.5 E5:.25 G5:.25 A5:1 F5:.5 D5:.5 | E5:2 D5:.25 E5:.25 F#5:.5 G5:.5 B5:2 A5:.25 G5:.25 E5:1 D5:1 | "
    "D5:.5 G5:.5 B5:1 C6:.5 A5:.5 F#5:.5 D#5:.5 | E5:1.5 G5:.25 B5:.25 A5:1 B5:.5 D6:.5 | E6:2 D6:.25 B5:.25 A5:.5 G5:.5 E5:.5 | G5:1.5 A5:.25 B5:.25 D6:3"
)
# The second whistle under it (the last time): a third or a sixth below.
THEME_UNDER = (
    "B4:.5 D5:.5 G5:2 F#5:.5 D#5:.5 | E5:1.5 B4:.25 E5:.25 F5:1 D5:.5 B4:.5 | C5:2 B4:.5 D5:.5 E5:.5 G5:2 E5:.5 C5:1 A4:1 | "
    "B4:.5 D5:.5 G5:1 A5:.5 F#5:.5 D#5:.5 B4:.5 | B4:1.5 E5:.25 G5:.25 F5:1 G5:.5 B5:.5 | C6:2 B5:.25 G5:.25 F#5:.5 E5:.5 B4:.5 | E5:1.5 E5:.25 G5:.25 G5:3"
)
# The bridge's line (the theme's last note is still sounding through its first beat).
LINE = "-:1 E5:1 G5:1 B5:1 | A5:1.5 G5:.5 Eb5:2 | D5:1.5 F#5:.5 A5:1 B5:1 | A5:2 G#5:2 | E5:.5 G5:.5 B5:1 A5:.5 B5:.5 D6:1 | E6:1.5 D6:.5 C#6:1 Bb5:1 | A5:.5 G5:.5 E5:1 G5:2 | F#5:1.5 Eb5:.5 D5:2"
# The whistle's turns in the vamp's gaps (the second time).
TURNS = "-:4 | -:2.5 D5:.25 E5:.25 G5:.5 E5:.5 | -:4 | -:2 B5:.25 A5:.25 G5:.5 E5:.5 D5:.5"
# Eric's left hand: eight bars of eight 8ths, as he wrote them.
LEFT = (
    "C2 G2 D3 E3 C2 G2 D3 E3", "C2 G2 E3 F3 C2 G2 E3 F3", "C3 G3 D4 E4 C3 G3 D4 E4", "C3 G3 E4 G4 F4 E4 D4 G3",
    "C3 F#3 A3 B3 C3 F#3 A3 B3", "C3 F#3 A3 B3 D4 C4 B3 A3", "C3 D#3 A3 B3 C4 B3 A3 D#3", "C3 E3 A3 B3 C4 B3 A3 G3",
)
# The right hand over its second time round, from three 16ths before it. "X+Y" is two notes together; "!" staccato;
# "X>Y" a grace note X into Y. His hook (the pickup and the first two bars, as he gave it); the rest is mine.
RIGHT = (
    "C6+E6!:.25 C6+E6!:.25 C6+E6!:.25 | B5+D6:1.5 A5+C6:1 G5+B5:1 G5+D6:.5 | G5+D6:3.25 "
    "E6+G6!:.25 E6+G6!:.25 E6+G6!:.25 | D6+F6:1.5 C6+E6:1 B5+D6:1 E6:.25 F6:.25 | "
    "G6:.25 E6:.25 C6:.25 E6:.25 F6:.25 D6:.25 B5:.25 D6:.25 E6:.25 C6:.25 A5:.25 C6:.25 D6:.25 B5:.25 G5:.25 B5:.25 | "
    "G6>F#6:1.5 E6:.5 B5:1 A5:1 | "
    "E6:1 F#6:.25 G6:.25 A6:.25 F#6:.25 D6:.25 E6:.25 F#6:.25 D6:.25 B5:.25 C6:.25 D6:.25 B5:.25 | "
    "B6:.75 A6:.25 F#6:.25 D#6:.25 C6:.25 B5:.25 A5:.25 B5:.25 C6:.25 D#6:.25 F#6:.5 D#6:.5 | "
    "D#6>E6:1 A5+C6:1 G5+B5:1 G5+D6:.5 G5+D6:.5"
)
assert all(len(bar.split()) == 8 for bar in LEFT)
for _line, _beats in ((THEME, 33), (THEME_UNDER, 33), (LINE, 32), (TURNS, 16), (re.sub(r"[^ :]+:", "X:", RIGHT), 32.75)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None, heard=False) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on). `heard`: the hook's double-strike is B5+D6, as on Eric's recording, not the
    G5+D6 he wrote."""
    x = Ride(RIDE, BEATS, None, os=2, seed=257, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(107)
    sr = x.sr
    tau = 2 * np.pi
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

    def crunch(w, rate=11000, steps=24):
        """A sampled drum as the old console played it: few samples a second, few levels."""
        hold = max(1, int(sr / rate))
        return np.round(np.repeat(w[::hold], hold)[: len(w)] * steps) / steps

    def chord(name):
        low, keys = SKY[name]
        return n(low), [n(c) for c in keys.split()]

    def spans(bar):
        """The bar's chords: (the beat in the bar it starts on, its beats, its bass note, its four notes)."""
        out, at_ = [], 0.0
        for name, d in PLAN[(bar - 1) % BARS]:
            out.append((at_, d, *chord(name)))
            at_ += d
        return out

    first_root = lambda bar: spans(bar)[0][2]

    # ---- the kit ----
    def kick(b, vol=0.42):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.5 * np.sin(tau * np.cumsum(46 + 90 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.1)) + 0.2 * hiss(k, 4000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.2, ghost=False):
        """A crisp snare."""
        k = int((0.06 if ghost else 0.16) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(210 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.035)
        put("snare", b, crunch(0.7 * body + 0.9 * hiss(k, 9000, 0.55) * np.exp(-t / (0.018 if ghost else 0.07))) * tail(k, 0.006) * vol, 0.05)

    def rim(b, vol=0.1):
        """A soft rimshot: a click and a short woody note."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("snare", b, (np.sin(tau * 820 * t) + 0.5 * np.sin(tau * 1730 * t) + 0.4 * hiss(k, 7000, 0.4) * np.exp(-t / 0.002)) * np.exp(-t / 0.012) * np.minimum(1, t / 0.0005) * tail(k) * vol, 0.05)

    def brush(b, vol=0.012, pan=0.2):
        """A brush's tap: a short breath of soft noise."""
        k = int(0.07 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 6000, 0.6) * np.sin(np.pi * np.minimum(1, t / 0.07)) ** 1.5 * vol, pan)

    def hat(b, vol=0.022, open_=False, pan=0.3):
        k = int((0.16 if open_ else 0.035) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 12000, 0.85) * np.exp(-t / (0.055 if open_ else 0.009)) * tail(k, 0.004) * vol, pan)

    def pocket(bar, vol=1.0, soft=False, fill=False, brushes=True):
        """The kit's bar: the kick on 1, just before 3 and on the "and" of 3; the snare on 2 and 4 (`soft`: a rim there,
        a brush on the 16ths unless `brushes` is off, no open hat); hats in swung 16ths, one open on the "and" of 4. `fill`: the snare's 16ths
        through the bar's second half, growing: the fill that is the pickup into the next bar."""
        b = bar0(bar)
        for i, loud in ((0, 1.0), (7, 0.6), (10, 0.85)):
            if not (fill and i >= 8):
                kick(b + sw(i), 0.42 * vol * loud * (0.8 if soft else 1))
        for beat in (1, 3):
            if not (fill and beat == 3):
                rim(b + beat, 0.1 * vol) if soft else snare(b + beat, 0.2 * vol)
        for i in range(16):
            if soft and not brushes:
                continue
            if soft:
                brush(b + sw(i), (0.013 if i % 4 == 0 else 0.009 if i % 2 == 0 else 0.006) * vol)
            else:
                hat(b + sw(i), (0.024 if i % 4 == 0 else 0.016 if i % 2 == 0 else 0.009) * vol * (1.2 if i == 14 else 1), open_=i == 14 and not fill)
        if fill:
            for i in range(8, 16):
                snare(b + i / 4, 0.07 + 0.018 * (i - 8), ghost=i % 2 == 1)

    # ---- the four patches ----
    def keys(b, m, vol=0.04, pan=0.0, long=0.4):
        """Patch 1's note, the crystalline bell-Rhodes: an FM electric piano, the modulator four times the note (a
        bright bell on its front), no attack, 400 ms."""
        b = float(b)
        at(b, 2)
        k = int((3 * long + 0.1) * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.sin(ph + 1.5 * np.exp(-t / 0.07) * np.sin(4 * ph) + 0.35 * np.sin(ph)) * np.exp(-t / long)
        put("keys", b, w * np.minimum(1, t / 0.001) * tail(k, 0.1) * vol, pan)

    def struck(b, ms, vol=0.04, long=0.4):
        """The bell-Rhodes's chord."""
        for j, m in enumerate(ms):
            keys(b, m, vol, (-0.4, -0.13, 0.13, 0.4)[j % 4], long)

    SQUARE = [1 / h if h % 2 else 0 for h in range(1, 14)]  # a 50% square, from its harmonics (no hash)

    def whistle(start, text, vol=1.0, pan=0.1, bus="whistle"):
        """Patch 2, the airy sky whistle: a plain square, a soft flute an octave under it; a note joined to the one
        before glides 35 ms into place from it; a 5.5 Hz vibrato once a note is held."""
        last = None
        for b, d, m in notes(start, text):
            b, d = sway(b), float(d)
            at(b, d)
            glide = m - last[0] if last and abs(b - last[1]) < 0.08 and m != last[0] else 0
            more = dict(vib=0.007 if d >= 1 else 0.0, vib_hz=5.5, scoop=glide, scoop_s=0.012)
            put(bus, b, x.tone(m, d * 0.97, SQUARE, 0.085 * vol, attack=0.012, release=0.03, **more), pan)
            put(bus, b, x.tone(m - 12, d * 0.97, [1, 0.3, 0.08], 0.07 * vol, attack=0.03, release=0.05, **more), -pan)
            last = (m, b + d)

    def finger(b, m, long=0.5, vol=0.4):
        """Patch 3's note, the warm fingered bass: a round FM note with no edge, sliding a hair up into its pitch."""
        at(b, long)
        k = x.k(long) + int(0.04 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (-0.5 * np.exp(-t / 0.02) / 12)) / sr
        w = np.sin(ph + (1.1 * np.exp(-t / 0.12) + 0.25) * np.sin(ph)) * (0.45 + 0.55 * np.exp(-t / 0.3))
        put("bass", b, w * np.minimum(1, t / 0.004) * tail(k, 0.04) * vol)

    REEDS = (1, 0.5, 0.33, 0.18, 0.1, 0.05)

    def reeds(b, ms, length, vol=0.022):
        """Patch 4, the soft reed pad: the chord held, swelling in, no beating between its reeds."""
        at(b, length)
        for j, m in enumerate(ms):
            put("pad", b, x.tone(m, length * 0.98, list(REEDS), vol, attack=0.2, release=0.3, trem=0.05, trem_hz=4.0), (-0.45, -0.15, 0.15, 0.45)[j % 4])

    def walk(bar, vol=1.0, light=False):
        """The bass's bar: each chord's root, its fifth and octave if there is room, and a half step up into the next
        root on the last 16th before it (two half steps of it before a new bar). `light`: the root, held, and (a
        whole bar's chord) its fifth; no steps."""
        b = bar0(bar)
        here = spans(bar)
        for j, (start, d, low, _) in enumerate(here):
            nxt = here[j + 1][2] if j + 1 < len(here) else first_root(bar + 1)
            if light:
                finger(b + start, low, min(d, 2.2) * 0.9, 0.4 * vol)
                if d >= 4:
                    finger(b + 2.5, low + 7, 0.9, 0.3 * vol)
                continue
            if d >= 4:
                finger(b, low, 1.2, 0.4 * vol), finger(b + 1.5, low + 7, 0.45, 0.32 * vol), finger(b + 2, low + 12, 0.7, 0.34 * vol), finger(b + sw(11), low + 7, 0.4, 0.3 * vol)
                if nxt != low:
                    finger(b + 3.5, nxt - 2, 0.25, 0.3 * vol)
                finger(b + sw(15), nxt - 1 if nxt != low else low + 12, 0.22, 0.32 * vol)
            elif d >= 2:
                finger(b + start, low, 0.9, 0.4 * vol), finger(b + start + 1, low + 7, 0.45, 0.32 * vol)
                finger(b + start + sw(7) - sw(0), nxt - 1 if nxt != low else low + 12, 0.22, 0.32 * vol)
            else:
                finger(b + start, low, 0.7, 0.38 * vol), finger(b + start + sw(3), nxt - 1 if nxt != low else low + 7, 0.22, 0.3 * vol)

    def comp(bar, vol=1.0, sparkle=False, sparse=False):
        """The bell-Rhodes's bar: each chord on its first beat and again off the beat (a whole bar's chord three more
        times, the vamp's rhythm); `sparkle`: single high notes of the chord between; `sparse`: the first beat only."""
        b = bar0(bar)
        for start, d, _, ms in spans(bar):
            struck(b + start, ms, 0.04 * vol)
            if sparse:
                continue
            hits = (3, 6, 10, 13) if d >= 4 else (3,) if d >= 2 else ()
            for i in hits:
                struck(b + start + sw(i), ms, 0.03 * vol, 0.25)
            if sparkle and d >= 2:
                for i, pick in ((5, 3), (8, 2), (14, 3)) if d >= 4 else ((5, 3),):
                    keys(b + start + sw(i), ms[pick] + 12, 0.035 * vol, 0.5 * np.sin(i), 0.3)

    def vamp(first, turns=False):
        """The four-bar vamp: the bell-Rhodes's sparkling chords, the bass, the kit."""
        for bar in range(first, first + 4):
            pocket(bar), walk(bar), comp(bar, 1.0, sparkle=True)
        if turns:
            whistle(bar0(first), TURNS, 0.8)

    def theme(first, sparkle=False, two=False, again=False):
        """Eight bars: the whistle's theme over the cycle, twice round. Its last note is held a beat into what comes
        next, unless that is the theme `again`."""
        for bar in range(first, first + 8):
            pocket(bar), walk(bar), comp(bar, 0.9, sparkle=sparkle)
        ends = (lambda text: text[:-1] + "2") if again else (lambda text: text)
        whistle(bar0(first), ends(THEME))
        if two:
            whistle(bar0(first), ends(THEME_UNDER), 0.55, -0.3, "whistle2")

    def bridge(first, on_keys=False, on_whistle=False):
        """Eight bars: the kit soft, the reed pad holding each chord, the bell-Rhodes once a chord; the line on the
        bell-Rhodes, the whistle, or both; the last bar's fill."""
        for bar in range(first, first + 8):
            pocket(bar, 0.9, soft=True, fill=bar == first + 7), walk(bar, 0.85), comp(bar, 0.85, sparse=True)
            for start, d, low, ms in spans(bar):
                reeds(bar0(bar) + start, ms, d)
        if on_keys:
            for b, d, m in notes(bar0(first), LINE):
                keys(sway(b), m, 0.075 if not on_whistle else 0.06, 0.15, 0.6)
        if on_whistle:
            whistle(bar0(first), LINE, 0.85)

    def left(bar, steps, vol=1.0):
        """A bar of Eric's left hand: eight 8ths on the warm felt piano, each ringing into the next few; the first
        and the fifth a little firmer."""
        for i, name in enumerate(steps.split()):
            w = x.struck("felt", n(name))
            put("piano", bar0(bar) + i / 2, w * np.exp(-np.arange(len(w)) / sr / 0.9) * 0.25 * vol * (1.0 if i % 4 == 0 else 0.85), -0.15)

    made = {}

    def crystal(m):
        """A note of the high piano, crystalline: three strings a hair apart, overtones up to 9 kHz that die sooner
        the higher they are, the hammer's tick. Its loudest point 1; kept once made."""
        if m not in made:
            k = int(2.2 * sr)
            t = np.arange(k) / sr
            f0 = x.hz(m)
            h = np.arange(1, max(2, int(9000 / f0) + 1))
            w = np.zeros(k)
            for off in (-1.5, 0.3, 1.6):
                ph = np.outer(h * np.sqrt(1 + 0.0006 * h * h), tau * f0 * 2 ** (off / 1200) * t) + h[:, None]
                w += ((1 / h**1.35)[:, None] * np.sin(ph) * np.exp(-np.outer(1 + 0.6 * h, t) / (0.9 * (262 / f0) ** 0.35))).sum(axis=0)
            w = w * np.minimum(1, t / 0.002) + 0.25 * hiss(k, 9000, 0.5) * np.exp(-t / 0.004)
            made[m] = w / np.abs(w).max() * tail(k, 0.2)
        return made[m]

    def right(start, text, vol=1.0):
        """The right hand: the high piano. A note of two beats or more rings out; a shorter one is let go just after
        the next begins (played smoothly, not pedaled into a blur); a staccato one is snapped off. A long note is
        played full, a 16th lighter (the one on the beat a little less so); a grace note is soft and just ahead of
        its note."""
        t = float(start)
        for tok in text.replace("|", " ").split():
            names, _, d = tok.partition(":")
            d = float(d)
            short = names.endswith("!")
            *graces, main = names.rstrip("!").split(">")
            for j, g in enumerate(graces):
                put("piano", t - 0.085 * (len(graces) - j), crystal(n(g)) * 0.3 * vol * 0.55, 0.25)
            pair = main.split("+")
            touch = 0.82 if short else 1.0 if d >= 1 else 0.9 if d >= 0.5 else 0.84 if abs(t - round(t)) < 1e-6 else 0.72
            for name in pair:
                w = crystal(n(name))
                if short or d < 2:
                    fade = int((0.04 if short else 0.15) * sr)
                    k = min(len(w), int((0.1 if short else (d + 0.35) * 60 / BPM) * sr) + fade)
                    w = w[:k] * np.minimum(1, (k - np.arange(k)) / fade)
                put("piano", t, w * 0.3 * vol * touch * (0.85 if len(pair) > 1 else 1.0), 0.25)
            t += d

    def interlude(first):
        """Sixteen bars, the band silent: Eric's left hand alone, its eight bars; then again with the right hand's
        solo over it, a soft kick on 1 and a rim on 2 and 4 under them; the last bar's fill."""
        for j in range(PIANO_BARS):
            b = bar0(first + j)
            left(first + j, LEFT[j % 8])
            if j >= 8:
                kick(b, 0.2), rim(b + 1, 0.06)
                if j < PIANO_BARS - 1:
                    rim(b + 3, 0.06)
        for i in range(8, 16):
            snare(bar0(first + PIANO_BARS - 1) + i / 4, 0.07 + 0.018 * (i - 8), ghost=i % 2 == 1)
        right(bar0(first + 8) - 0.75, RIGHT.replace("G5+D6", "B5+D6") if heard else RIGHT)

    # The plan, three times (the docstring); Eric's piano where the second bridge was.
    vamp(1), theme(5), bridge(13, on_keys=True)
    vamp(21, turns=True), theme(25, again=True), interlude(33)
    vamp(49), theme(53, sparkle=True, two=True), bridge(61, on_keys=True, on_whistle=True)

    # A hall for the bell-Rhodes, the whistle and the pad; none for the kit or the bass.
    def room(name, secs=1.6, wet=0.3):
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.02)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 4500) ** 2) * (f > 150), n=size, axis=1)

    x.beat_s = 60 / BPM
    x.echo("whistle", 0.75, 0.16, 0.07), x.echo("whistle2", 0.75, 0.16, 0.07), x.echo("keys", 0.75, 0.12, 0.05)
    for name, secs, wet in (("keys", 1.8, 0.3), ("whistle", 1.8, 0.3), ("whistle2", 1.8, 0.3), ("pad", 2.2, 0.4), ("piano", 1.8, 0.25)):
        room(name, secs, wet)
    levels = {"whistle": 1.0, "whistle2": 1.0, "piano": 1.0, "keys": 2.0, "pad": 1.6, "bass": 0.55, "kick": 0.95, "snare": 2.1, "hats": 5.0}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.05))


def main(out: str, heard: str = "") -> None:
    write_wav(out, render(heard=bool(heard)))


if __name__ == "__main__":
    main(*sys.argv[1:])
