"""Song V (Eric, Nov 12): the Hidden Boss's theme, a loop of about two and a half minutes ("a very special theme ...
If this song is 2:30-3 that's fine"). He named a film cue he wants it to feel like and sent a write-up of its
techniques, not its notes: an accelerando in steps (21 tempo changes from about 128 to over 200, then a collapse into
half-time); uneven meters (5/8, 7/8, 6/8 against 3/4); a perpetual-motion figure in 16ths; a solo violin's bouncing
bow, then strings near the bridge, tremolo, slow slides; an analog synth bass with its filter sweeping, a sawtooth
drone and low brass swells in place of drums; chords a major third apart, minor chords with a major seventh, six-note
scales; and voices entering one after another in canon, one, two, four, eight.
Only those techniques are used. The cue itself was not listened to, measured or transcribed, and every figure, tune
and chord progression here is original: none of it is that cue's, or any song's or game's.
The Hidden Boss is the chess legend with the red book, so the song is a chess clock. It ticks on every 8th; every
two bars it is pressed and the band is four beats a minute faster (128, 132 ... 212: 21 changes); the voices on the
figure double: one, then two, then four, then eight, each a few notes behind the first. At the top it stops: three
ticks, a cold tone rising, and the book slammed shut. Then the theme at exactly half that pace (106), twice. After a
slow move a tritone away, bars of 5, 7, 9, 11 and 13 8ths, each two longer than the last, climbing again to the theme
over the figure at full speed.
The second go (Eric, Nov 12, before hearing the first: "His powers don't matter, he's a unique boss, same with his
sounds he really has none ... feel free to do that"; the write-up is "more of a reference ... if we incorporate a lot
of these ideas into it, so just make sure you're doing that"). Checked against his list and tightened: the entries
are one, two, four, eight (they were one, two, three, four, six); the bars of six have a pulse in three against them
(the bow's knocks and the bass); arpeggios in threes run beside the 16ths under the themes and at the top; the
collapse is to exactly half the top pace, and the slow move's beat is that theme's dotted beat; the slow move is on
the six notes a tritone away; and the first theme has no drums (the drone, the 808 and the brass carry it), the
second a kick and a snare, the last a full kit. The clock stays: it is the only percussion for the first minute.
The six notes: G, B flat, B, D, E flat, F sharp (a minor third, a half step, and round again): in it are G minor with
its major seventh, the same on E flat and on B, and nothing else, so the chords can only move by major thirds, and
any voice a major third from another is still in the scale.
339 beats, about 2:26.
  python3 song_v.py <out.wav>

  0:00  the stare: his two low tones beating, the clock (a tick a second), the red book's pages, one trembling note
  0:10  the calculation: the solo violin's figure; then two voices, four, eight; the clock pressed and the pace up
        every two bars (128 to 212); a synth bass, held notes climbing, slides, low brass
  0:56  the flag: silence, three ticks, the engine catching, and the book slammed shut
  0:59  the theme, at half the pace, on E flat: the lead and the violins over a drone, an 808 and low brass; no drums
  1:17  the theme again, a major third up, with a kick and a snare, and arpeggios in threes
  1:35  the slow move, a tritone away: the solo violin and the cellos, two beats apart; his stare; his laugh
  1:49  bars of 5, 7, 9, 11 and 13 8ths, faster with each
  2:04  the theme over the figure at full speed, a full kit
  2:22  the tag: the book shut, the clock slowing to a tick a second, his stare
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

# The calculation: 22 units of two bars; each unit's bars (in 8ths) and its tempo. 57: a bar of five, then one of seven.
UNITS = [(5, 128), (5, 132), (5, 136), (5, 140), (7, 144), (7, 148), (7, 152), (7, 156), (6, 160), (6, 164), (6, 168), (6, 172), (5, 176), (5, 180),
         (7, 184), (7, 188), (57, 192), (57, 196), (6, 200), (6, 204), (4, 208), (4, 212)]
# "+2 a move": each unit's bars two 8ths longer than the last.
PLUS = [(5, 142), (7, 160), (9, 178), (11, 196), (13, 212)]
# Which of the three roots each four bars (each move) stand on: G, a major third down (E flat), a major third up (B).
POLES = (0, 0, -4, 4, 0, -4, 4, 0, -4, 4, 0)
PLUS_POLES = (0, -4, 4, 0, -4)


def lay(start, units):
    """The units laid end to end: their bars (start beat, 16ths long, which move, first or second bar of the figure),
    their pace (from, to, tempo, tempo), and where they end."""
    bars, pace, b = [], [], start
    for u, (meter, tempo) in enumerate(units):
        first = b
        for j, eighths in enumerate((5, 7) if meter == 57 else (meter, meter)):
            bars.append((b, 2 * eighths, u, j))
            b += eighths / 2
        pace.append((first, b, tempo, tempo))
    return bars, pace, b


T_CALC = 10
CALC_BARS, _calc, T_FLAG = lay(T_CALC, UNITS)
T_DROP, T_DROP2, T_CALM, T_PLUS = T_FLAG + 4, T_FLAG + 36, T_FLAG + 68, T_FLAG + 84
PLUS_BARS, _plus, T_LAST = lay(T_PLUS, PLUS)
T_TAG, BEATS = T_LAST + 64, T_LAST + 72
# The themes at half the top pace (212: an 8th becomes a 16th); the slow move's beat is their dotted beat (106 x 2/3).
PACE = ([(0, T_CALC, 60, 60)] + _calc + [(T_FLAG, T_DROP, 90, 90), (T_DROP, T_CALM, 106, 106), (T_CALM, T_PLUS, 70.67, 70.67)]
        + _plus + [(T_LAST, T_TAG, 212, 212), (T_TAG, BEATS, 212, 60)])
SECS = round(float(sum(60 * (b - a) / t0 if t0 == t1 else 60 * (b - a) * np.log(t1 / t0) / (t1 - t0) for a, b, t0, t1 in PACE)), 2)

# ---- the figure: 16ths rocking between a note that stays (the fifth, then the sixth) and a line that moves; in half
# steps above the root. A bar is the head, as much of the middle as its length needs, and the tail. ----
HEAD = ([0, 7, 3, 7, 11, 7, 12, 7], [0, 8, 4, 8, 12, 8, 11, 8])
MIDDLE = ([15, 12, 11, 7], [16, 12, 11, 8])
TAIL = ([8, 4], [7, 3])
# Where a bar leans, in 16ths: 5/8 is 3+2, 7/8 is 2+2+3, 6/8 is 3+3, and so on.
LEAN = {8: (0,), 10: (0, 6), 12: (0, 6), 14: (0, 4, 8), 18: (0, 4, 8, 12), 22: (0, 6, 12, 18), 26: (0, 6, 12, 18, 22)}
# The voices of the canon, one, then two, then four, then eight: from which move, how many 16ths behind the first, how
# far from it in half steps (major thirds, always: still in the scale), where it sits, its instrument, and whether it
# plays every note or (the cellos) every other one, the line at half speed.
VOICES = [(0, 0, 0, -0.15, "solo", 1),
          (1, 6, 4, 0.45, "violins", 1),
          (3, 10, -8, -0.5, "violas", 1), (3, 0, -24, 0.15, "cellos", 2),
          (6, 3, 12, 0.65, "violins", 1), (6, 4, -12, -0.65, "violas", 1), (6, 9, 8, 0.25, "violins", 1), (6, 2, -20, -0.25, "cellos", 2)]
THREES = (0, 3, 7, 11, 12, 11, 7, 3)  # the arpeggio in threes: the minor chord and its major seventh, up and down


def figure(length, which):
    """One bar of the figure, `length` 16ths long."""
    return (HEAD[which] + (MIDDLE[which] * 4)[: max(0, length - 10)] + TAIL[which])[:length] if length >= 10 else HEAD[which][:length]


# ---- the theme (half-time): up a fifth and on to the major seventh, held; up the chord; down through the scale in
# threes. Then the same a major third lower; then a climb that stops on the seventh. Lengths in beats. ----
THEME = (
    "G4:1 D5:1 F#5:3 G5:.5 Bb5:.5 D6:2 Bb5:2/3 F#5:2/3 Eb5:2/3 D5:2 | "
    "Eb4:1 Bb4:1 D5:3 Eb5:.5 Gb5:.5 Bb5:2 Gb5:2/3 D5:2/3 B4:2/3 Bb4:2 | "
    "B4:1 F#5:1 Bb5:1.5 B5:.5 D6:1.5 Eb6:.5 F#6:2"
)
# The slow move: the figure as a tune, in 8ths.
SLOW = "G4:.5 D5:.5 Bb4:.5 D5:.5 F#5:1 D5:1 | G5:1.5 F#5:.5 Eb5:1 B4:1 | G4:.5 Eb5:.5 B4:.5 Eb5:.5 G5:1 Eb5:1 | F#5:1.5 D5:.5 Bb4:2"
for _name, _beats in ((THEME, 32), (SLOW, 16)):
    assert beats(_name) == _beats, (_name[:30], beats(_name))
assert (T_FLAG, T_LAST, BEATS) == (138, 267, 339)


def main(out: str) -> None:
    x = Ride([(a, b, t0, t1, 1.0, 1.0, 0.0) for a, b, t0, t1 in PACE], BEATS, SECS, os=2, seed=227)
    put, at = x.put, x.at
    rng = np.random.default_rng(59)
    sr = x.sr
    tau = 2 * np.pi
    levels = {"solo": 1.6, "violins": 1.0, "violas": 1.0, "cellos": 1.0, "pads": 1.0, "slide": 1.6, "lead": 1.25, "bass": 0.7, "sub": 0.6, "brass": 1.0,
              "kick": 0.9, "snare": 2.0, "hats": 4.0, "drum": 1.5, "clock": 3.0, "book": 1.5, "fx": 1.2, "hum": 0.7}
    BOWED = x.BOWED
    BRIDGE = [0.5, 0.6, 0.8, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2]  # bowed near the bridge: the high overtones over the note

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def paper(k, cut):
        """Noise with its highs rolled off: paper, never a hiss."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    # ---- the strings ----
    def bow(b, d, m, kind, vol, pan, long=False):
        """One note of a string voice. The solo violin: a bouncing bow, short and dry. The violins: a section, near
        the bridge (glassy). The violas and cellos: sections, full. `long`: bowed through, not bounced."""
        at(b, d)
        if kind == "solo":
            w = x.fiddle(m, d * (0.95 if long else 0.6), 0.16 * vol)
        else:
            w = x.tone(m, d * (0.95 if long else 0.62), BRIDGE if kind == "violins" else BOWED, (0.13 if kind == "violins" else 0.16) * vol,
                       detune=(-9, 0, 8), vib=0.006 if long else 0.0, attack=0.05 if long else 0.01, release=0.06 if long else 0.02)
        put(kind, b, w, pan)

    def shimmer(b, d, m, vol=0.05, pan=0.0):
        """A section holding a note near the bridge, the bows trembling."""
        at(b, d)
        put("pads", b, x.tone(m, d, BRIDGE, vol, detune=(-8, 0, 7), attack=0.12, release=0.15, trem=0.55, trem_hz=13.0), pan)

    def slide(b, d, m0, m1, vol=0.04, pan=0.0):
        """A section sliding slowly from one note to another, no steps between: a siren's rise."""
        at(b, d)
        k = x.k(d)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        w = np.zeros(k)
        for c in (-11, 0, 9):
            ph = tau * np.cumsum(x.hz(m0 + (m1 - m0) * u + c / 100)) / sr
            for h, a in enumerate(BRIDGE[:8], 1):
                w += a * np.sin(h * ph + 0.7 * h)
        put("slide", b, w / 3 * np.minimum(1, t / 0.3) * tail(k, 0.2) * (0.4 + 0.6 * u) * vol, pan)

    def canon(bars, poles, voices, loud, first=0):
        """The figure on a run of bars, every voice in its turn. `loud(move)`: how loud that move is."""
        grid = [(b + i * 0.25, length, move, i) for b, length, move, which in bars for i in range(length)]
        line = [67 + poles[move // 2] + figure(length, which)[i] for b, length, move, which in bars for i in range(length)]
        starts = {}
        for j, (_, _, move, _) in enumerate(grid):
            starts.setdefault(move // 2, j)
        for since, behind, far, pan, kind, every in voices:
            if since not in starts and since > 0:
                continue
            begin = starts.get(since, 0) + behind
            for j in range(begin, len(grid)):
                if (j - begin) % every:
                    continue
                b, length, move, i = grid[j]
                m = line[begin - behind + (j - begin) // every] + far if every > 1 else line[j - behind] + far
                lean = 1.3 if (i in LEAN[length] and every == 1) else 1.0
                bow(b, 0.25 * every, m, kind, loud(move // 2) * lean * (0.85 if kind != "solo" else 1.0), pan, long=every > 1)

    def threes(start, length, low, vol=0.5):
        """Three notes a beat against the figure's four: the chord and its seventh, up and down, on the violas.
        `low(beat)`: the root there."""
        for j in range(int(length * 3)):
            b = start + j / 3
            bow(b, 1 / 3, low(j / 3) + 12 + THREES[j % 8], "violas", vol * (1.25 if j % 3 == 0 else 1.0), 0.3)

    # ---- the low end ----
    def synth(b, m, length, vol=0.3, cut=400.0):
        """The analog bass: a sawtooth through a filter that rings at its edge, at `cut` Hz."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        f0 = x.hz(m)
        ph = tau * f0 * t
        w = np.zeros(k)
        for h in range(1, min(70, int(3 * cut / f0) + 2)):
            f = h * f0
            w += np.sin(h * ph) / h * (1 + 2.0 * np.exp(-(((f - cut) / (0.3 * cut)) ** 2))) / np.sqrt(1 + (f / cut) ** 6)
        env = np.minimum(1, t / 0.005) * (0.7 + 0.3 * np.exp(-t / 0.08)) * tail(k, 0.02)
        put("bass", b, np.tanh(1.5 * w) * env * vol)

    def sub(b, m, length, vol=0.5):
        """The 808."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (k / sr * 0.6)) * tail(k, 0.03)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env + 0.15 * np.sin(3 * ph) * env) * vol)

    def drone(b, length, m, vol=0.12):
        """A sawtooth held low, its filter breathing."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        w = np.zeros(k)
        cut = 5 + 3 * np.sin(tau * 0.23 * t)
        for c in (-7, 6):
            ph = tau * x.hz(m + c / 100) * t
            for h in range(1, 12):
                w += np.sin(h * ph + h) / h * np.clip(cut - h + 1, 0, 1)
        put("sub", b, np.tanh(1.2 * w) * np.minimum(1, t / 0.2) * tail(k, 0.3) * vol)

    def brass(b, length, m, vol=0.14):
        """Low brass, swelling: horns and tubas as one growl that opens and slowly closes."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        cut = 3 + 17 * np.minimum(1, u / 0.25) ** 1.5 - 9 * np.maximum(0, u - 0.25) / 0.75
        w = np.zeros(k)
        for c in (-14, -5, 6, 15):
            ph = tau * x.hz(m + c / 100) * t
            for h in range(1, 22):
                w += np.sin(h * ph + c * h) / h * np.clip(cut - h + 1, 0, 1)
        w += 1.5 * np.sin(tau * x.hz(m - 12) * t)
        env = np.minimum(1, t / 0.06) * (0.45 + 0.55 * np.minimum(1, u / 0.22)) * np.exp(-1.3 * np.maximum(0, u - 0.3)) * tail(k, 0.12)
        put("brass", b, np.tanh(1.1 * w * env * (1 - 0.22 * (0.5 + 0.5 * np.sin(tau * 27 * t)))) * vol)

    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the drone and the held strings duck

    def snare(b, vol=0.26):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def clap(b, vol=0.2):
        kk = int(0.02 * sr)
        for late in (0, 0.011, 0.023):
            put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.006) * vol * 0.7, late=late)
        kk = int(0.2 * sr)
        put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol, late=0.03)

    def hat(b, vol=0.035):
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 11000, 0.8) * np.exp(-t / 0.014) * tail(k, 0.004) * vol, 0.3)

    # ---- his world: the clock, the red book, the stare, the engine (the game's sounds: recluse-sounds.ts) ----
    def tick(b, vol=0.05, high=True, pan=None, late=0.0):
        """The chess clock: a tick, or (lower, on the other side) a tock."""
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        f = 2600 if high else 1750
        w = np.sin(tau * f * t) + 0.5 * np.sin(tau * 2.3 * f * t + 1) + 0.6 * hiss(k, 14000, 0.7) * np.exp(-t / 0.0015)
        put("clock", b, w * np.exp(-t / 0.006) * np.minimum(1, t / 0.0003) * tail(k) * vol, (0.35 if high else -0.35) if pan is None else pan, late=late)

    def tap(b, vol=0.06, pan=0.0):
        """The wood of a bow on the string: a dry knock."""
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("clock", b, (np.sin(tau * 820 * t) + 0.5 * np.sin(tau * 1950 * t) + 0.5 * hiss(k, 6000, 0.4) * np.exp(-t / 0.003)) * np.exp(-t / 0.012) * tail(k) * vol, pan)

    def press(b, vol=0.14):
        """The clock pressed: the button's knock, and the lever on the other side clicking up."""
        k = int(0.14 * sr)
        t = np.arange(k) / sr
        knock = (np.sin(tau * np.cumsum(240 + 200 * np.exp(-t / 0.008)) / sr) + 0.7 * hiss(k, 5000, 0.3) * np.exp(-t / 0.004)) * np.exp(-t / 0.025)
        put("clock", b, knock * tail(k) * vol, -0.2)
        tick(b, vol * 0.5, True, 0.3, late=0.07)

    def flip(b, vol=0.1):
        """The red book's pages fluttering: paper ticks, closer together as they go."""
        k = int(0.34 * sr)
        t = np.arange(k) / sr
        env = np.zeros(k)
        for start in (0, 0.05, 0.095, 0.135, 0.17, 0.2, 0.226, 0.25):
            age = t - start
            env = np.maximum(env, np.where((age >= 0) & (age < 0.03), np.sin(np.pi * np.clip(age, 0, 0.03) / 0.03), 0))
        put("book", b, env * hiss(k, 5000, 0.6) * vol, 0.3)

    def shut(b, vol=0.5):
        """The book slammed shut: a low thump falling in pitch under a slap of paper."""
        k = int(0.6 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(90 * (1 + np.exp(-t / 0.015))) / sr) * np.exp(-t / 0.09)
        slap = hiss(k, 4000, 0.4) * np.exp(-t / 0.014) * (t < 0.08)
        put("book", b, (body + 1.1 * slap + 0.3 * paper(k, 400) * np.exp(-t / 0.2)) * tail(k, 0.05) * vol)

    def huff(b, vol=0.08):
        """His laugh, as breath: four quick huffs through the nose, each a little higher."""
        k = int(0.46 * sr)
        t = np.arange(k) / sr
        env = np.zeros(k)
        for start in (0, 0.13, 0.24, 0.34):
            age = t - start
            env = np.maximum(env, np.where((age >= 0) & (age < 0.09), np.maximum(0, np.sin(np.pi * np.clip(age, 0, 0.09) / 0.09)) ** 0.7, 0))
        nose = paper(k, 1300) * np.sin(tau * np.cumsum(600 + 300 * t) / sr)
        put("book", b, env * nose * 3 * vol, -0.3)

    def stare(b, length, vol=0.14):
        """Under his stare: two low tones close together, beating; and their octave, so a phone hears it."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        w = np.sin(tau * 73 * t) + np.sin(tau * 75.5 * t) + 0.35 * (np.sin(tau * 146 * t) + np.sin(tau * 151 * t)) + 0.12 * (np.sin(tau * 219 * t) + np.sin(tau * 226.5 * t))
        put("hum", b, w * np.sin(np.pi * np.linspace(0, 1, k)) ** 0.8 * vol)

    def ignite(b, length, vol=0.07):
        """The engine in him catching: a few sparks, and a cold tone rising."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(320 * 2 ** (2.0 * u**1.6)) / sr
        cold = (np.sin(ph) + 0.6 * np.sin(1.5 * ph) + 0.3 * np.sin(2.01 * ph)) * u**1.5
        put("fx", b, cold * np.minimum(1, (1 - u) * 40) * vol)
        kk = int(0.01 * sr)
        for _ in range(7):
            put("fx", b, hiss(kk, 12000, 0.8) * np.exp(-np.arange(kk) / sr / 0.002) * vol * 2.5, rng.uniform(-0.6, 0.6), late=rng.uniform(0.1, 0.9) * k / sr)

    def arcs(b, vol=0.1, secs=0.8):
        """The arcs that split the board: a soft crackle, never a buzz."""
        k = int(secs * sr)
        w = np.zeros(k)
        kk = int(0.008 * sr)
        for _ in range(40):
            i = int(rng.uniform(0, 1) ** 1.5 * (secs - 0.02) * sr)
            w[i : i + kk] += rng.uniform(0.3, 1.0) * hiss(kk, 9000, 0.7) * np.exp(-np.arange(kk) / sr / 0.002)
        put("fx", b, w * tail(k) * vol, 0.0)

    def thump(b, vol=0.3):
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        put("fx", b, (np.sin(tau * np.cumsum(55 + 60 * np.exp(-t / 0.03)) / sr) + 0.2 * paper(k, 500)) * np.exp(-t / 0.1) * tail(k) * vol)

    def glow(b, length, m=55, vol=0.05):
        """The light pouring out of the book: a soft chord swelling (the six notes' minor chord and its major seventh)."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        w = sum(np.sin(tau * x.hz(m + o) * t + o) for o in (0, 3, 7, 11, 12, 19))
        put("fx", b, w * np.sin(np.pi * np.linspace(0, 1, k)) ** 1.5 * vol)

    # ---- the theme's voices ----
    def driven(line, vol=1.0, pan=0.0):
        """The overdriven lead. A long note that follows another straight on slides in from most of the way back."""
        last = None
        for b, d, m in line:
            glide = 0.6 * (last[1] - m) if last and abs(last[0] - b) < 1e-6 and d >= 1 and 0 < abs(last[1] - m) <= 12 else 0.0
            at(b, d)
            put("lead", b, x.drive(m, d * 0.96, 0.16 * vol, glide=glide), pan)
            last = (b + d, m)

    def theme(start, shift, stretch=1, lead=1.0, strings=1.0, third=0.0):
        """The theme from `start`, `shift` half steps from G, each note `stretch` times as long: the lead, the violins
        with it and an octave under, and (`third`) the violas a major third over it."""
        line = [(start + b * stretch, d * stretch, m + shift) for b, d, m in notes(0, THEME)]
        driven(line, lead)
        for b, d, m in line:
            bow(b, d, m, "violins", 0.75 * strings, 0.4, long=True)
            bow(b, d, m - 12, "violas", 0.6 * strings, -0.4, long=True)
            if third:
                bow(b, d, m + 4, "violas", 0.55 * third, 0.15, long=True)
        return line

    def root(beat, shift, stretch=1):
        """The theme's root at a beat of it: G for twelve beats, E flat for twelve, B for four, G for four."""
        beat /= stretch
        return 43 + shift + (0 if beat < 12 else -4 if beat < 24 else 4 if beat < 28 else 0)

    def figured(start, length, shift, stretch, voices, loud):
        """The figure under the theme, in bars of two beats, on the theme's roots."""
        bars = [(start + 2 * i, 8, i, i % 2) for i in range(length // 2)]
        poles = [root(2 * i, shift, stretch) - 43 for i in range(length // 2)]
        canon([(b, size, 2 * i, which) for b, size, i, which in bars], poles, [(0, *voice[1:]) for voice in voices], loud)

    # 0:00 The stare. His two low tones, beating; the clock, a tick a second; the red book opened, its pages turned; a
    # violin near the bridge, one note, trembling, growing. Then the clock is pressed.
    stare(0, 10.5, 0.14)
    for i in range(10):
        tick(i, 0.16, i % 2 == 0)
    flip(2.2, 0.1), flip(7.6, 0.08)
    at(4, 6)
    put("solo", 4, x.swell(x.tone(67, 6, BRIDGE, 0.06, detune=(-5, 4), attack=0.3, release=0.2, trem=0.6, trem_hz=12.0), 0.92), -0.15)
    glow(6, 4, 55, 0.03)
    press(T_CALC - 0.5, 0.12)

    # 0:10 The calculation. The solo violin has the figure, alone; then two voices (violins a major third up, six notes
    # behind), then four (violas, and cellos at half speed), then eight; every two bars the clock is pressed and
    # everything is four beats a minute faster. The clock ticks on every 8th, a bow knocks where each bar leans (in the
    # bars of six it knocks in three, against them, and the bass with it); from the seventh unit the synth bass, its
    # filter opening a little with each; later held notes climbing, slow slides, low brass; at the top, arpeggios in
    # threes.
    canon(CALC_BARS, POLES, VOICES, lambda move: 0.62 + 0.045 * move)
    for u, (first, _, _, _) in enumerate(CALC_BARS[::2]):
        press(first, 0.1 + 0.004 * u)
        if u % 2 == 0 and u:
            flip(first - 0.6, 0.07)
    for b, length, u, which in CALC_BARS:
        move = u // 2
        for i in range(length // 2):
            tick(b + i * 0.5, 0.035 + 0.0012 * u, i % 2 == 0)
        cross = (0, 4, 8) if length == 12 else LEAN[length]  # a bar of six, counted in three
        for i in cross:
            tap(b + i * 0.25, 0.05 + 0.002 * u, 0.2 if i else -0.2)
        low = 43 + POLES[move]
        if u >= 6:
            cut = 140 * (2400 / 140) ** ((u - 6) / 15)
            for i in range(length // 2) if u >= 16 and length != 12 else [j // 2 for j in cross]:
                synth(b + i * 0.5, low, 0.45, 0.3, cut)
        if u >= 12 and which == 0:
            thump(b, 0.16 + 0.01 * (u - 12))
    # The held notes, climbing the scale a unit at a time, trembling near the bridge.
    for j, (u, step) in enumerate(zip(range(12, 22), (0, 7, 11, 12, 15, 16, 19, 23, 24, 24))):
        b0, b1 = CALC_BARS[2 * u][0], (CALC_BARS[2 * u + 2][0] if u < 21 else T_FLAG)
        m = 67 + POLES[u // 2] + step
        shimmer(b0, b1 - b0, m, 0.035 + 0.004 * j, 0.3), shimmer(b0, b1 - b0, m - 12, 0.03 + 0.003 * j, -0.3)
    slide(CALC_BARS[16][0], 12, 67, 71, 0.03, -0.4)
    slide(CALC_BARS[32][0], 12, 70, 76, 0.04, 0.4), slide(CALC_BARS[32][0], 12, 63, 67, 0.04, -0.4)
    slide(T_FLAG - 8, 8, 74, 86, 0.06, 0.3), slide(T_FLAG - 8, 8, 67, 82, 0.06, -0.3), slide(T_FLAG - 8, 8, 55, 67, 0.05, 0.0)
    brass(CALC_BARS[28][0], 7, 31 + 12, 0.1)
    brass(CALC_BARS[36][0], 6, 31 + 12 + 4, 0.11)
    brass(T_FLAG - 8, 8, 31 + 12, 0.13)
    threes(T_FLAG - 8, 8, lambda beat: 43, 0.5)

    # 0:56 The flag. Everything stops. Three ticks; the engine in him catching (a cold tone rising, sparks); and on
    # the fourth beat the book is slammed shut.
    tick(T_FLAG, 0.3, True, 0.0), tick(T_FLAG + 1, 0.3, False, 0.0), tick(T_FLAG + 2, 0.3, True, 0.0)
    ignite(T_FLAG, 3, 0.08)
    shut(T_FLAG + 3, 1.0)

    # 0:59 The theme, at half the pace, on E flat: the lead and the violins over a drone, an 808 and low brass; the
    # figure goes on in four voices; the clock ticks in 16ths; no drums.
    # 1:17 The theme again, a major third up (G), the violas a third over it; six voices on the figure and arpeggios in
    # threes; a kick, a clap and the snare on 3.
    for start, shift, second in ((T_DROP, -4, False), (T_DROP2, 0, True)):
        arcs(start, 0.1), x.crash(start, 0.2, decay=0.6)
        theme(start, shift, 1, 1.0, 1.0, 0.8 if second else 0.0)
        figured(start, 32, shift, 1, VOICES[:6] if second else VOICES[:4], lambda move: 0.7)
        if second:
            threes(start, 32, lambda beat: root(beat, shift), 0.45)
        for phrase, length in ((0, 12), (12, 12), (24, 4), (28, 4)):
            low = root(phrase, shift)
            brass(start + phrase, min(length, 8), low, 0.15 if phrase in (0, 12) else 0.12)
            drone(start + phrase, length, low, 0.1)
        for bar in range(8):
            b = start + 4 * bar
            low = root(4 * bar, shift)
            sub(b, low - 12 if low - 12 >= 31 else low, 3.4, 0.45), thump(b, 0.3)
            if bar % 2:
                sub(b + 2.75, low - 12 if low - 12 >= 31 else low, 1.1, 0.34), thump(b + 2.75, 0.2)
            if second:
                kick(b, 0.6), clap(b + 2), snare(b + 2, 0.24)
                if bar % 2:
                    kick(b + 2.75, 0.42)
            for i in range(16):
                tick(b + i * 0.25, 0.03 if i % 4 else 0.05, i % 2 == 0)
            for i in (0, 6, 12):
                tap(b + i * 0.25, 0.06, 0.2 if i else -0.2)
            if second:
                kick(b + 1.5, 0.4), snare(b + 3.5, 0.1)
                for i in range(8):
                    hat(b + i * 0.5 + 0.25, 0.025)
                for i in range(8):
                    synth(b + i * 0.5, low, 0.45, 0.22, 900)
        press(start + 31.5, 0.14)

    # 1:35 The slow move, on the six notes a tritone away (C#, E, F, G#, A, C). The solo violin has the figure as a
    # tune, in 8ths; the cellos follow two beats behind, low; his stare; the clock, a tick a beat; pages; his laugh,
    # through the nose; the book's light.
    stare(T_CALM, 16.5, 0.13)
    slow = notes(T_CALM, SLOW)
    for b, d, m in slow:
        bow(b, d, m + 6, "solo", 0.45, -0.15, long=True)
        if b + 2 < T_PLUS - 2:
            bow(b + 2, d, m - 18, "cellos", 0.45, 0.25, long=True)
    for i in range(16):
        tick(T_CALM + i, 0.13, i % 2 == 0)
    flip(T_CALM + 5.6, 0.08)
    huff(T_CALM + 9.5, 0.07)
    glow(T_CALM + 10, 6, 61, 0.035)
    shimmer(T_CALM + 12, 4, 76, 0.03, 0.3)
    press(T_PLUS - 0.5, 0.14)

    # 1:49 Bars of 5, 7, 9, 11 and 13 8ths, two of each, every voice on the figure from the first, the
    # clock pressed and the pace up with each; the bass on every 8th, its filter opening; held notes climbing; slides;
    # low brass; a kick where each bar begins.
    canon([(b, length, 2 * u, which) for b, length, u, which in PLUS_BARS], PLUS_POLES, [(0, *voice[1:]) for voice in VOICES], lambda move: 0.8 + 0.06 * move)
    for u, (first, _, _, _) in enumerate(PLUS_BARS[::2]):
        press(first, 0.13)
        flip(first - 0.6, 0.07)
        end = PLUS_BARS[2 * u + 2][0] if u < 4 else T_LAST
        m = 79 + PLUS_POLES[u] + (0, 7, 11, 12, 16)[u]
        shimmer(first, end - first, m, 0.04 + 0.006 * u, 0.3), shimmer(first, end - first, m - 12, 0.035 + 0.005 * u, -0.3)
    for b, length, u, which in PLUS_BARS:
        low = 43 + PLUS_POLES[u]
        kick(b, 0.45 + 0.03 * u), thump(b, 0.2)
        for i in range(length // 2):
            tick(b + i * 0.5, 0.045, i % 2 == 0)
            synth(b + i * 0.5, low, 0.45, 0.28, 400 * (2800 / 400) ** (u / 4))
        for i in LEAN[length]:
            tap(b + i * 0.25, 0.06, 0.2 if i else -0.2)
    slide(T_LAST - 13, 13, 74, 86, 0.06, 0.3), slide(T_LAST - 13, 13, 67, 79, 0.06, -0.3)
    brass(PLUS_BARS[6][0], 8, 43, 0.12), brass(T_LAST - 13, 13, 39, 0.13)
    for i in range(16):
        snare(T_LAST - 2 + i * 0.125, 0.06 + 0.012 * i)

    # 2:04 The theme over the figure at full speed (212), on G: each of its notes twice as long, so the theme goes at
    # the pace it had; the violas a third over it; all eight voices on the figure, arpeggios in threes; a full kit at
    # the theme's pace (a kick on 1, the snare and a clap on 3), the 808, the bass on every 8th, low brass under each
    # phrase.
    arcs(T_LAST, 0.1), x.crash(T_LAST, 0.2, decay=0.6), shut(T_LAST, 0.3)
    theme(T_LAST, 0, 2, 1.0, 1.0, 0.8)
    figured(T_LAST, 64, 0, 2, VOICES, lambda move: 0.66)
    threes(T_LAST, 64, lambda beat: root(beat, 0, 2), 0.42)
    for phrase, length in ((0, 24), (24, 24), (48, 8), (56, 8)):
        low = root(phrase, 0, 2)
        brass(T_LAST + phrase, min(length, 10), low, 0.15)
        drone(T_LAST + phrase, length, low, 0.08)
    for bar in range(16):
        b = T_LAST + 4 * bar
        low = root(4 * bar, 0, 2)
        kick(b, 0.6), clap(b + 2), snare(b + 2, 0.26)
        if bar % 2:
            kick(b + 1.5, 0.4), kick(b + 3.5, 0.42)
        else:
            kick(b + 2.75, 0.36)
        sub(b, low - 12 if low - 12 >= 31 else low, 1.8, 0.42)
        for i in range(8):
            tick(b + i * 0.5, 0.05 if i % 2 == 0 else 0.035, i % 2 == 0)
            synth(b + i * 0.5, low, 0.45, 0.24, 1600)
            hat(b + i * 0.5 + 0.25, 0.022)
        if bar % 4 == 0 and bar:
            x.crash(b, 0.1, decay=0.4)

    # 2:22 The tag. The book shut on the last beat's first; the clock alone, slowing to a tick a second; his stare
    # coming up under it, which the start begins with.
    shut(T_TAG, 0.5), kick(T_TAG, 0.6), x.crash(T_TAG, 0.14, decay=0.6)
    brass(T_TAG, 5, 43, 0.12)
    for i in range(7):
        tick(T_TAG + 1 + i, 0.16 - 0.004 * i, i % 2 == 0)
    stare(T_TAG + 2, 6.5, 0.1)

    # The bass, the drone and the held strings duck under each kick.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["sub"] *= 0.5 + 0.5 * gain
    x.buses["pads"] *= 0.6 + 0.4 * gain

    x.beat_s = 60 / 160  # the echoes' beat
    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("solo", 0.75, 0.12, 0.05)
    write_wav(out, x.mixdown(levels, lowpass=8500, room=0.34, room_s=2.0))


if __name__ == "__main__":
    main(sys.argv[1])
