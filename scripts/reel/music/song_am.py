"""Song AM (Eric, Nov 19): the battle tower's music, third go: two minutes, a loop. The second go (song_al.py, one
minute, a layer every eight bars) he asked to redo, longer and in this shape, and the shape is his:
  "Let's make it 2 minutes long ... the first 30 seconds are like the slow build up ... keep layering instruments ...
  start kind of with like a simple ... drum and like a snare ... at 30 seconds, start adding like a cool ... original
  score ... it kind of keeps ... coming up more and more, keeps building up for like another 30 seconds. Then it plays
  for like ... 45 seconds, maybe ... it can get like a little bit more upbeat ... as in like increase the BPM. even a
  little flute kind of in there. And then ... at the end, it just sort of starts to die out. And then sort of does
  like a big ... ending ... a small, like 5 to 7 second ... grand finale sort of thing. And then it loops ... nicely
  back into the calming start ... they're not going to probably sit there and listen to all the song, and that's kind
  of the idea, but it still should be a good ... original ... kind of work it how you want".
No plan beyond that: the tune and everything under it are written here, and original (none of it is any song's or
any game's).
How his shape is met (the tempos are his "a little bit more upbeat": 96, then 108):
  - 0:00, twelve bars at 96: a low drum and a soft snare, alone for four bars; then plucked low strings and held
    strings; then a harp's 8ths.
  - 0:30, twelve bars: the tune. A horn alone with its first half; the horns and the violins with it again, short
    strings under them; trumpets for its second half, a roll, and the tempo climbing to 108.
  - 1:00, twenty bars at 108, climbing all the way: the whole tune on trumpets and horns over a driving kit; four
    bars more of climb (the tune's leap from a step higher each bar; the low drums come in); the tune once more, the
    biggest, the violins soaring over it. (The first render had a flute here: four lighter bars of its own at 1:17
    and a line over the last tune. Eric: "get rid of the flute ... instead of transitioning at 117 into the flute,
    just keep ... ramp it up a bit more until it dies out at 143 ... or like make it start to burn out there ... keep
    going a little bit more with where it was already going and just get rid of the flutes." There is no flute in
    it now.)
  - 1:43, four bars slowing down: it burns out. The horn has the tune's first two bars, and then only held strings
    and the low drum, and a timpani roll rising.
  - 1:53, three bars at 108: the finale: the band's fanfare on F, on G, and a held A major (the tune's key turned
    major). Its ring falls on bar 1's drum.
  - A minor: Am, F, C, G under the tune. It leaps up a fifth and steps down, twice; then leaps and climbs.
  python3 song_am.py <out.wav>

  bars  1-12   0:00  the calm start, in layers: a drum and a snare; plucked and held strings; a harp
  bars 13-24   0:30  the tune arrives and grows: a horn; horns and violins; trumpets, the roll, the tempo rising
  bars 25-32   1:00  the tune, whole, the full band
  bars 33-36   1:17  four bars more of climb (C, G, F, E)
  bars 37-44   1:26  the tune again, the biggest, the violins over it
  bars 45-48   1:43  it dies out, slowing
  bars 49-51   1:53  the finale: F, G, A major; and bar 1
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

SLOW, FAST, BARS = 96, 108, 51
BEATS = 4 * BARS
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
# The tape's ride: (from beat, to beat, tempo there, tempo by its end, speed, speed, waver). 96 to bar 22; climbing to
# 108 over bars 23-24; 108; slowing to 80 over bars 45-48; 108 for the finale.
RIDE = [(0, 88, SLOW, SLOW, 1.0, 1.0, 0.0), (88, 96, SLOW, FAST, 1.0, 1.0, 0.0), (96, 176, FAST, FAST, 1.0, 1.0, 0.0), (176, 192, FAST, 80, 1.0, 1.0, 0.0),
        (192, BEATS, FAST, FAST, 1.0, 1.0, 0.0)]
TAPE = 120.0  # s: the tempos above come to 121.1, so they run 0.9% fast

# A chord: the low strings' note, the short strings' four (each bowed twice), the held strings' four, the harp's four.
FORT = {
    "Am": ("A1", "C4 A4 E4 A4", "A3 C4 E4 A4", "A3 E4 A4 C5"), "F": ("F2", "C4 A4 F4 A4", "A3 C4 F4 A4", "A3 F4 A4 C5"),
    "C": ("C2", "C4 G4 E4 G4", "G3 C4 E4 G4", "G3 E4 G4 C5"), "G": ("G2", "D4 G4 B3 G4", "G3 B3 D4 G4", "G3 D4 G4 B4"),
    "E": ("E2", "B3 G#4 E4 G#4", "G#3 B3 E4 G#4", "G#3 E4 G#4 B4"), "Dm": ("D2", "D4 A4 F4 A4", "A3 D4 F4 A4", "A3 F4 A4 D5"),
    "A": ("A1", "C#4 A4 E4 A4", "A3 C#4 E4 A4", "A3 E4 A4 C#5"),
}
CHORDS = ("Am Am F G  Am Am F G  Am Am F G   Am F C G  Am F C G  Am F G E   Am F C G Am F G Am   C G F E   Am F C G Am F G Am   "
          "Am F Dm E   F G A").split()
assert len(CHORDS) == BARS, len(CHORDS)
ACCENT = (0, 3, 6)  # the full band's accent, in 8ths of the bar: three, three, two

# ---- the lines. Lengths in beats. ----
# The tune: up a fifth and down by step, twice (from A, then from G); then the leap again and a climb to the top A,
# down through F, a leap on G; and home (or, the first time, up the E chord into the full band).
TUNE_A = "A4:1 E5:1.5 D5:.5 C5:1 | D5:1 C5:1 A4:2 | G4:1 E5:1.5 D5:.5 C5:1 | D5:1.5 E5:.5 D5:2"
TUNE_B = "A4:1 E5:1.5 G5:.5 A5:1 | G5:1 F5:1 C5:2 | D5:1 G5:1.5 F5:.5 D5:1 | "
TUNE_HOME, TUNE_UP = TUNE_B + "E5:1 C5:1 A4:2", TUNE_B + "E5:2 G#5:1 B5:1"
# Four bars more of climb (C, G, F, E): the tune's leap from a step higher each bar, then up the E chord.
RAMP = "C5:1 G5:1.5 F5:.5 E5:1 | D5:1 A5:1.5 G5:.5 F5:1 | F5:1 C6:1.5 A5:.5 G5:1 | E5:1 G#5:1 B5:2"
# The violins over the tune's last time: long notes over its moving ones.
OVER = "E6:3 D6:.5 C6:.5 | A5:1 C6:1 F6:1.5 E6:.5 | E6:3 D6:.5 C6:.5 | B5:1 D6:1 E6:1 D6:1 | E6:2 C6:1 E6:1 | F6:2 E6:1 C6:1 | B5:1 D6:1 E6:1 D6:1 | C6:2 A5:2"
# The finale's fanfare (F, G), and the last chord's notes.
FANFARE = "C5:.75 C5:.25 F5:1 A5:2 | D5:.75 D5:.25 G5:1 B5:2"
for _line, _beats in ((TUNE_A, 16), (TUNE_HOME, 16), (TUNE_UP, 16), (RAMP, 16), (OVER, 32), (FANFARE, 8)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The loop as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage."""
    x = Ride(RIDE, BEATS, None, os=2, seed=349, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(131)
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
        """One of the low drums (a big one, or the smaller one beside it): its skin's low note, a second one over it
        and the stick, so a small speaker has the hit too."""
        f0 = 96 if high else 70
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(f0 * (1 + 0.6 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.13) + 0.8 * np.sin(tau * np.cumsum(2.3 * f0 * (1 + 0.3 * np.exp(-t / 0.02))) / sr) * np.exp(-t / 0.06)
        put("drums", b, (w + 0.45 * hiss(k, 3000, 0.3) * np.exp(-t / 0.008)) * np.minimum(1, t / 0.001) * tail(k, 0.03) * vol, 0.3 if high else -0.3)

    def hat(b, vol=0.02, pan=0.3):
        k = int(0.035 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 12000, 0.85) * np.exp(-t / 0.009) * tail(k, 0.004) * vol, pan)

    def crash(b, vol=0.05):
        k = int(1.5 * sr)
        t = np.arange(k) / sr
        put("crash", b, hiss(k, 13000, 0.8) * np.exp(-t / 0.33) * np.minimum(1, t / 0.002) * tail(k, 0.05) * vol, -0.2)

    def timp(b, name, vol=0.3, secs=0.9):
        put("timp", b, x.timp(n(name), secs, vol), -0.1)

    def rolls(b, length, soft, loud, name=None):
        """A roll in 16ths over `length` beats, growing: the snare's, or (`name`) the timpani's on that note."""
        count = int(round(length * 4))
        for i in range(count):
            v = soft + (loud - soft) * (i / max(1, count - 1)) ** 1.5
            timp(b + i / 4, name, v, 0.45) if name else snare(b + i / 4, v + (0.02 if i % 4 == 0 else 0))

    def tap(bar, vol=1.0, drag=None):
        """A bar of the calm start's drum and snare: the low drum on 1, softly before 3 and on its "and"; the snare's
        light taps on 2 and 4, and (every other bar, or as `drag` says) two softer ones running into the next bar."""
        b = bar0(bar)
        low_drum(b, 0.42 * vol), low_drum(b + 1.75, 0.24 * vol, high=True), low_drum(b + 2.5, 0.3 * vol)
        snare(b + 1, 0.17 * vol), snare(b + 3, 0.17 * vol)
        if bar % 2 == 0 if drag is None else drag:
            snare(b + 3.5, 0.08 * vol), snare(b + 3.75, 0.1 * vol)

    def drive(bar, vol=1.0, drums=False, fill=""):
        """A bar of the full band's kit: the kick on the accent, the snare on 2 and 4, hats in 8ths; `drums`: the low
        drums on the accent, twice a bar; `fill`: the snare's 16ths taking the bar's end, growing."""
        b = bar0(bar)
        cut = 4 - len(fill) / 4
        for i in ACCENT:
            kick(b + i / 2, (0.5 if i == 0 else 0.4) * vol)
        for beat in (1, 3):
            if beat < cut:
                snare(b + beat, 0.25 * vol)
        for i in range(8):
            if i / 2 < cut:
                hat(b + i / 2, (0.022 if i % 2 == 0 else 0.016) * vol)
        if drums:
            for i in (0, 3, 6, 8, 11, 14):
                low_drum(b + i / 4, (0.26 if i in (0, 8) else 0.2) * vol, high=i in (3, 11))
        for j in range(len(fill)):
            snare(b + cut + j / 4, (0.1 + 0.13 * j / max(1, len(fill) - 1)) * vol)

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

    plucked = {}

    def pluck(m):
        """A plucked string (the low strings' pizzicato, the harp): its overtones die sooner the higher they are.
        Its loudest point 1; kept once made."""
        if m not in plucked:
            k = int(1.1 * sr)
            t = np.arange(k) / sr
            f0 = x.hz(m)
            h = np.arange(1, min(12, max(2, int(7000 / f0))) + 1)
            w = ((1 / h**1.3)[:, None] * np.sin(np.outer(h, tau * f0 * t) + h[:, None]) * np.exp(-np.outer(1 + 0.7 * h, t) / (0.5 * (262 / f0) ** 0.3))).sum(axis=0)
            w *= np.minimum(1, t / 0.002) * tail(k, 0.08)
            plucked[m] = w / np.abs(w).max()
        return plucked[m]

    def ground(bar, vol=1.0):
        """A bar of the low strings plucked: the chord's root and its octave on 1 and 3."""
        low = n(chord(bar)[0])
        for beat, a in ((0, 1.0), (2, 0.8)):
            put("low", bar0(bar) + beat, (pluck(low) * 0.1 + pluck(low + 12) * 0.07) * a * vol, -0.2)

    def harp(bar, vol=1.0):
        """A bar of the harp: the chord's four notes up and back in 8ths."""
        ms = [n(c) for c in chord(bar)[3].split()]
        for i in range(8):
            put("harp", bar0(bar) + i / 2, pluck(ms[(0, 1, 2, 3, 2, 1, 2, 1)[i]]) * 0.08 * vol * (1.0 if i % 2 == 0 else 0.8), 0.35 - 0.1 * (i % 4))

    def chop(bar, vol=1.0):
        """A bar of the low strings bowed: the chord's root in 8ths, the octave over it bowed with it; harder on the accent."""
        low = n(chord(bar)[0])
        for i in range(8):
            a = (1.0 if i in ACCENT else 0.68) * vol
            put("low", bar0(bar) + i / 2, bow(low, 0.22, 0.1, 0.11 * a) + bow(low + 12, 0.22, 0.09, 0.07 * a), -0.2)

    def spic(bar, vol=1.0, eighths=False):
        """A bar of the short strings: the chord's four notes, each bowed twice, twice round, in 16ths (`eighths`:
        once each, once round, in 8ths)."""
        ms = [n(c) for c in chord(bar)[1].split()]
        for i in range(8 if eighths else 16):
            j = i if eighths else i // 2
            put("short", bar0(bar) + (i / 2 if eighths else i / 4), bow(ms[j % 4], 0.12, 0.055, 0.05 * vol * (1.0 if j in ACCENT else 0.72) * (1.0 if eighths or i % 2 == 0 else 0.8), (-6, 5)), 0.25)

    def held(bar, vol=0.02, long=4.0):
        """A bar of the held strings."""
        at(bar0(bar), long)
        for j, m in enumerate(n(c) for c in chord(bar)[2].split()):
            put("held", bar0(bar), x.strings(m, long, vol, attack=0.2, release=0.35), (-0.5, -0.15, 0.15, 0.5)[j])

    def violins(start, text, vol=1.0, shift=12):
        """The violins with the tune, an octave over the horns."""
        for b, d, m in notes(start, text):
            at(b, d)
            put("held", b, x.strings(m + shift, d * 0.97, 0.03 * vol, attack=0.06, release=0.15), 0.3)

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

    # ---- the sections ----
    def calm(first):
        """Bars 1-12: the drum and the snare alone; from the fifth bar the low strings plucked and the held strings;
        from the ninth the harp. A timpani roll, far off, into what follows."""
        for j in range(12):
            bar = first + j
            tap(bar, (1.7, 1.45, 1.3)[j // 4])
            if j >= 4:
                ground(bar, 0.8 if j < 8 else 1.0), held(bar, 0.012 if j < 8 else 0.016)
            if j >= 8:
                harp(bar, 0.8 + 0.07 * (j - 8))
        rolls(bar0(first + 11) + 2, 2, 0.03, 0.12, "E2")

    def rise(first):
        """Bars 13-24: the tune. A horn alone with its first half; the horns and the violins with it again, the short
        strings' 8ths under them, a kick; then its second half with trumpets, the low drums, the snare's roll (and the
        tempo climbing: the RIDE)."""
        for j in range(12):
            bar = first + j
            b = bar0(bar)
            tap(bar, 1.2, drag=j % 2 == 1 and j < 10)
            ground(bar, 1.0 + 0.015 * j), held(bar, 0.016 + 0.0005 * j), harp(bar, 1.0)
            if j >= 4:
                spic(bar, 0.7 + 0.04 * (j - 4), eighths=j < 8)
                kick(b, 0.36 + 0.012 * j), kick(b + 2, 0.3 + 0.012 * j)
                for i in range(8):
                    hat(b + i / 2, 0.014 if i % 2 == 0 else 0.01)
            if j >= 8:
                for i in (6, 12):
                    low_drum(b + i / 4, 0.2 + 0.015 * (j - 8), high=i == 6)
        timp(bar0(first), "A2", 0.2), timp(bar0(first + 4), "A2", 0.26), timp(bar0(first + 8), "A2", 0.3)
        crash(bar0(first + 8), 0.035)
        brass(bar0(first), TUNE_A, 0.55, pan=-0.15, edge=0.75, bite=0.05)
        brass(bar0(first + 4), TUNE_A, 0.75, edge=0.85, bite=0.03), violins(bar0(first + 4), TUNE_A, 0.8)
        brass(bar0(first + 8), TUNE_UP, 0.7), violins(bar0(first + 8), TUNE_UP, 0.8), brass(bar0(first + 8), TUNE_UP, 0.4, 0, 0.2, "trumpets", 1.05)
        rolls(bar0(first + 11), 4, 0.05, 0.16), rolls(bar0(first + 11), 4, 0.05, 0.16, "E2")

    def full(first, last):
        """Eight bars of the tune on trumpets, the horns an octave under, over the full band; the violins with the
        tune an octave over. The `last` time everything is a little harder, the low drums are in, and the violins
        leave the tune for a line of their own over it."""
        up = 1.15 if last else 1.0
        for j in range(8):
            bar = first + j
            chop(bar, 1.1 * up), spic(bar, 1.05 * up), held(bar, 0.023 * up)
            drive(bar, 1.05 * up, drums=last, fill="ssss" if j == 3 else "ssssssss" if j == 7 and not last else "")
            if CHORDS[bar - 1] != CHORDS[bar - 2]:
                timp(bar0(bar), chord(bar)[0].replace("1", "2"), 0.22 * up)
        crash(bar0(first), 0.06), crash(bar0(first + 4), 0.04)
        brass(bar0(first), TUNE_A + " | " + TUNE_HOME, 1.08 * up, 0, 0.1, "trumpets", 1.05), brass(bar0(first), TUNE_A + " | " + TUNE_HOME, 0.68 * up, -12, -0.2)
        if last:
            violins(bar0(first), OVER, 1.0, 0)
        else:
            violins(bar0(first), TUNE_A + " | " + TUNE_HOME, 0.6)

    def ramp(first):
        """Four bars more of climb between the tune's two times (C, G, F, E): its leap on trumpets, horns and violins
        from a step higher each bar; the low drums come in; a roll through the last bar."""
        for j in range(4):
            bar = first + j
            up = 1.0 + 0.03 * j
            chop(bar, 1.1 * up), spic(bar, 1.05 * up), held(bar, 0.023 * up)
            drive(bar, 1.05 * up, drums=True, fill="ssssssss" if j == 3 else "")
            timp(bar0(bar), chord(bar)[0], 0.22 * up)
        crash(bar0(first), 0.05)
        brass(bar0(first), RAMP, 0.95, 0, 0.1, "trumpets", 1.05), brass(bar0(first), RAMP, 0.68, -12, -0.2), violins(bar0(first), RAMP, 0.7)
        rolls(bar0(first + 3), 4, 0.06, 0.2, "E2")

    def fade(first):
        """Four bars, slowing (the RIDE): the horn with the tune's first two bars; then held strings and the drum;
        then the timpani's roll and the snare's, rising into the finale."""
        for j, (drum, strings) in enumerate(((0.8, 0.02), (0.6, 0.017), (0.45, 0.014), (0.3, 0.013))):
            bar = first + j
            tap(bar, drum, drag=False), held(bar, strings)
            if j < 3:
                ground(bar, 0.9 - 0.2 * j)
            if j < 2:
                harp(bar, 0.8 - 0.3 * j)
        brass(bar0(first), "A4:1 E5:1.5 D5:.5 C5:1 | D5:1 C5:1 A4:2", 0.5, pan=-0.15, edge=0.75, bite=0.05)
        rolls(bar0(first + 3), 4, 0.03, 0.26, "E2"), rolls(bar0(first + 3) + 2, 2, 0.05, 0.22)

    def finale(first):
        """Three bars: the fanfare on F and on G over the whole band; then A major, held, the timpani rolling under
        it, and let go."""
        for j in range(2):
            bar = first + j
            chop(bar, 1.15), spic(bar, 1.1), held(bar, 0.026)
            drive(bar, 1.1, drums=True, fill="ssssssss" if j == 1 else "")
            timp(bar0(bar), chord(bar)[0], 0.3), crash(bar0(bar), 0.07 if j == 0 else 0.05)
        brass(bar0(first), FANFARE, 1.0, 0, 0.1, "trumpets", 1.1), brass(bar0(first), FANFARE, 0.65, -12, -0.2), violins(bar0(first), FANFARE, 0.9)
        b = bar0(first + 2)
        at(b, 3.4)
        for name, bus, vol, pan in (("E5", "trumpets", 0.15, 0.2), ("A5", "trumpets", 0.17, 0.0), ("C#6", "trumpets", 0.13, -0.2), ("A3", "horns", 0.13, -0.3), ("E4", "horns", 0.13, 0.3),
                                    ("A4", "horns", 0.13, -0.1), ("C#5", "horns", 0.12, 0.1)):
            put(bus, b, horn(n(name), 3.3, vol, 0.012, vib=0.004, edge=1.05), pan)
        for name in ("A3", "C#4", "E4", "A4", "C#5", "E5", "A5", "E6"):
            put("held", b, x.strings(n(name), 3.4, 0.022, attack=0.03, release=0.4), 0.6 * np.sin(n(name)))
        low = n("A1")
        put("low", b, bow(low, 2.2, 0.9, 0.09) + bow(low + 12, 2.2, 0.8, 0.065), -0.2)
        kick(b, 0.55), low_drum(b, 0.34), snare(b, 0.27), crash(b, 0.09), timp(b, "A2", 0.34, 1.2)
        rolls(b + 0.5, 2.75, 0.2, 0.08, "A2")

    calm(1), rise(13)
    full(25, last=False), ramp(33), full(37, last=True)
    fade(45), finale(49)

    # A hall for the brass, the strings, the harp and the timpani; a little of it for the snare and the low drums.
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

    for name, secs, wet in (("horns", 2.2, 0.3), ("trumpets", 2.2, 0.28), ("short", 1.6, 0.22), ("low", 1.4, 0.14), ("held", 2.4, 0.35), ("harp", 2.0, 0.3),
                            ("timp", 2.2, 0.25), ("snare", 1.6, 0.16), ("drums", 1.8, 0.22)):
        room(name, secs, wet)
    levels = {"horns": 2.0, "trumpets": 2.2, "short": 4.2, "low": 2.2, "held": 2.1, "harp": 1.4, "timp": 0.4, "kick": 0.8, "snare": 1.5, "drums": 0.8,
              "hats": 7.2, "crash": 2.0}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
