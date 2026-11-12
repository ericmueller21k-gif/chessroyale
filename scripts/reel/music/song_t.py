"""Song T (Eric, Nov 12): Ginger's theme, a two-minute loop, from scratch (song I, the first Christmas sample, is
scrapped). His direction: "take the same ideas you just used [Boingo's], but let's incorporate some kind of jingle bell
sound, some like actual like caroling style bells, some sleigh noises, some ... snow flurries, some icicle like sharp
... sounds ... adding some hymn sounds ... did help ... a darker Christmas style, not like bright ... but like
somewhere in the middle ... keeping it fresh, playing around, with the tempo, with the overlapping, with the ... dueling
... two instruments kind of playing with each other, like they're almost playing off of each other, or sometimes
harmonizing ... weaving in ... each character and their special sort of attributes that make it feel like when you're
fighting Ginger, you're in the middle of the North Pole, and there's a bunch of lights and bells".
So: a sleigh ride into Ginger's blizzard, and his two powers run the song. Freeze: the music itself freezes (`frost`:
whatever is sounding is held, iced over, until it cracks free): twice in the second verse, mid-bar, and once for good
at the end of the hymn. Blizzard, his three turns: "only one piece moves" (one voice alone over the frozen band),
"thawing" (the others crack free one a bar, each coming in with the first one's tune: a round), "thawed" (the drop).
D minor leaning Dorian (a G major chord, the old carols' light), about 155 beats a minute; 283 beats; 120.0 s.
The tune (recipe: SOUNDS.md): bells ringing down from A to D in a sleigh's trot rhythm, a flurry of three, a note held
across the bar line, phrases of three bars, two and three. A chord a bar: four over a bass that never moves (D, a
drone, galloping), then the bass climbing B flat, C, D flat (a B flat minor chord from outside the key: the cold one)
and down to A; the bells' A in every chord but that one. The hymn is the same chords at half speed, and its tune fits
over the fast one: in the last tune the choir sings it above the band. The second tune is a round: one line on five
notes that agree with each other however they overlap, so a second voice (and in the gallop a third) plays the same
line three beats behind.
Ginger is the overdriven lead with a hand bell struck on every note. With him: the fiddle, a choir (no words), the
gritty synth, a square. From his world, built as the game builds them (gingerbread-sounds.ts): sleigh bells on every
8th, a tower bell, hand bells ringing changes in 16ths (plain hunt on six: every row a new order), icicles, ice
crackling, the blizzard's wind, his staff charging and its blast, a bite of gingerbread in the snare.
Every melody, riff and chord progression here is original: none of it is any carol's, hymn's, song's or game's.
  python3 song_t.py <out.wav>

  0:00  the sleigh arrives: wind, the tower bell, icicles, sleigh bells and hooves coming nearer, hand bells ringing
        down, the bass's drone; his staff charges and fires
  0:07  Ginger's tune (eight bars): the lead with a hand bell on every note
  0:19  the second verse: the fiddle and the lead take turns, then play together; the band freezes twice
  0:32  the round, faster: the lead's line, the fiddle three beats behind with the same one
  0:44  the hymn (the first calm): the choir, hand bells on its tune, snow, far sleigh bells
  0:58  the Blizzard, frozen: the hymn's last chord iced solid; one voice moves, low
  1:01  thawing: the others crack free, one a bar, with the same tune; the kit comes back to life
  1:08  thawed (the drop): the lead and the gritty synth, an 808, a wobble bass, the choir
  1:20  the gallop, the fastest: the round in three voices, sleigh bells on every 16th
  1:30  icicles (the second calm): the fiddle has the hymn, icicles answer, the choir hums
  1:42  the tune again with the hymn sung over it
  1:54  the tag: two bars of light, the cold chord, the tower bell; the sleigh goes off into the wind
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import SR, Ride, n, write_wav

BEATS = 283
SECS = 120.0
# The sleigh's pace: from beat, to beat, the tempo there (from, to). All scaled alike so the song is SECS long.
PACE = [
    (0, 16, 140, 152),  # it arrives
    (16, 48, 152, 152),
    (48, 83, 152, 156),
    (83, 115, 164, 164),  # the round
    (115, 131, 68, 68),  # the hymn
    (131, 139, 140, 140),  # frozen
    (139, 155, 140, 156),  # thawing
    (155, 187, 156, 156),  # thawed
    (187, 219, 180, 180),  # the gallop
    (219, 231, 72, 72),  # icicles
    (231, 235, 110, 160),
    (235, 275, 160, 160),
    (275, 283, 160, 110),  # it leaves
]
T_TUNE, T_VERSE, T_ROUND, T_HYMN, T_ICE, T_THAW, T_DROP, T_RUN, T_CALM2, T_LAST, T_TAG = 16, 48, 83, 115, 131, 139, 155, 187, 219, 235, 267
# The second verse's frozen beats: before which beat of the verse, and how many.
GAPS = ((12, 1), (21, 2))

# Each chord: the bass note; the strings' and the choir's three; the hand bells' six (low to high; A in all but one).
RING = {
    "Dm": ("D2", "D3 F3 A3", "D5 F5 A5 C6 D6 F6"),
    "C/D": ("D2", "D3 G3 C4", "E5 G5 A5 C6 E6 G6"),
    "Bb/D": ("D2", "D3 F3 Bb3", "D5 F5 A5 Bb5 D6 F6"),
    "G/D": ("D2", "D3 G3 B3", "D5 G5 A5 B5 D6 G6"),  # the Dorian chord: B natural
    "Bb": ("Bb1", "Bb2 F3 D4", "D5 F5 A5 Bb5 D6 F6"),
    "C": ("C2", "C3 G3 E4", "E5 G5 A5 C6 E6 G6"),
    "Bbm/Db": ("Db2", "Db3 F3 Bb3", "Db5 F5 Ab5 Bb5 Db6 F6"),  # from outside the key: the cold one
    "A": ("A1", "A2 E3 C#4", "C#5 E5 A5 C#6 E6 G6"),
    "Bbm": ("Bb1", "Bb2 F3 Db4", "Db5 F5 Ab5 Bb5 Db6 F6"),
    "Gm": ("G1", "G2 D3 Bb3", "D5 G5 A5 Bb5 D6 G6"),
    "D": ("D2", "D3 F#3 A3", "D5 F#5 A5 B5 D6 F#6"),  # the tag's two bars of light
}
TUNE_CH = "Dm C/D Bb/D G/D Bb C Bbm/Db A".split()
ROUND_CH = "Dm Dm G/D G/D C C Bbm/Db A".split()
DROP_CH = "Dm Dm Bbm Bbm Gm Gm A A".split()
TAG_CH = "D D Bbm/Db A".split()
MINOR = (2, 4, 5, 7, 9, 10, 0)  # D minor, for the fiddle's harmony
PANS = (-0.45, 0.0, 0.45)


def hunt(bells=6):
    """Plain hunt, as church ringers ring it: every row swaps neighbors, the pairs alternating, back to the first row."""
    row, rows = list(range(bells)), []
    for i in range(2 * bells):
        rows += row
        for j in range(i % 2, bells - 1, 2):
            row[j], row[j + 1] = row[j + 1], row[j]
    return rows


ROWS = hunt()

# ---- the lines. Lengths are in beats; 2/3 is three notes in two beats, 1/3 three in one (a flurry). ----
# The tune, eight bars in phrases of three, two and three: the bells ring down from A to D in the trot's rhythm; up to C
# and a flurry; a note held across the bar line (A, the bells' note); the Dorian B; up to B flat; C held, falling in
# threes; the cold bar (D flat, A flat); home by C#.
TUNE = (
    "A5:1.5 G5:.5 F5:.75 E5:.25 D5:1 | E5:.5 G5:.5 C6:1 B5:1/3 C6:1/3 B5:1/3 G5:1 | A5:1 F5:.5 D5:.5 F5:1 A5:2 | "
    "B5:.75 A5:.25 G5:.5 D5:.5 B4:1 | D5:.5 F5:.5 Bb5:1.5 A5:.5 F5:1/3 G5:1/3 A5:1/3 | C6:2 G5:2/3 E5:2/3 C5:2/3 | "
    "Db5:.75 F5:.25 Bb5:1 Ab5:.5 F5:.5 Ab5:1 | A5:2 G5:1/3 F5:1/3 E5:1/3 C#5:1"
)
# The second verse, the tune shared: the fiddle and the lead take turns, each holding its last note under the other's
# first, and play the last two bars together, the fiddle under the lead.
V_FIDDLE = (
    "A5:1.5 G5:.5 F5:.75 E5:.25 D5:2 -:3 | A5:1 F5:.5 D5:.5 F5:1 A5:2 | -:7 | C6:2 G5:2/3 E5:2/3 C5:2/3 | "
    "Bb4:.75 Db5:.25 F5:1 F5:.5 Db5:.5 F5:1 | E5:2 E5:1/3 D5:1/3 C#5:1/3 A4:1"
)
V_LEAD = (
    "-:4 | E5:.5 G5:.5 C6:1 B5:1/3 C6:1/3 B5:1/3 G5:2 -:4 | B5:.75 A5:.25 G5:.5 D5:.5 B4:1 | "
    "D5:.5 F5:.5 Bb5:1.5 A5:.5 F5:1/3 G5:1/3 A5:1/3 | -:4 | Db5:.75 F5:.25 Bb5:1 Ab5:.5 F5:.5 Ab5:1 | A5:2 G5:1/3 F5:1/3 E5:1/3 C#5:1"
)
# The hymn (the choir's top line), two beats a chord; in the last tune each note is twice as long, over the tune.
HYMN = "D4:1 F4:1 | E4:1 G4:1 | F4:1.5 G4:.5 | A4:1 B4:1 | D5:2 | C5:1 G4:1 | Bb4:1 Ab4:1 | A4:2"
# The round: six bars on five notes (D, E, G, A, C: no two of them clash), then two bars in harmony for the cold
# chord and home.
ROUND = (
    "D5:.5 A5:1 G5:.5 E5:.5 G5:.5 A5:1 | C6:1.5 A5:.5 G5:2/3 E5:2/3 D5:2/3 | E5:.5 G5:.5 A5:.5 C6:.5 D6:2 | "
    "C6:.75 A5:.25 G5:1 A5:.5 E5:.5 G5:1 | E5:1/3 G5:1/3 A5:1/3 C6:1 A5:1 G5:.5 E5:.5 | D5:1 E5:.5 G5:.5 A5:2"
)
ROUND_END = (
    "Ab5:.75 Bb5:.25 Db6:1 Bb5:.5 Ab5:.5 F5:1 | E5:1.5 A5:.5 C#6:2",  # the lead
    "F5:.75 Gb5:.25 Bb5:1 Gb5:.5 F5:.5 Db5:1 | C#5:1.5 E5:.5 A5:2",  # the second voice, a third under
    "Db5:.75 Db5:.25 F5:1 Db5:.5 Db5:.5 Bb4:1 | A4:1.5 C#5:.5 E5:2",  # the third
)
# The Blizzard. One piece moves; then the others thaw, one a bar, each with the same two bars.
LONE = "A3:1.5 Bb3:.5 C#4:1 A3:1 | E4:2/3 D4:2/3 C#4:2/3 Bb3:1 A3:1"
THAW_GRIT = LONE + " | " + LONE
THAW_BELL = "-:4 | A5:1.5 Bb5:.5 C#6:1 A5:1 | E6:2/3 D6:2/3 C#6:2/3 Bb5:1 A5:1 | A5:1.5 Bb5:.5 C#6:1 A5:1"
THAW_FIDDLE = "-:8 | E5:1.5 F5:.5 G5:1 E5:1 | G5:2/3 F5:2/3 E5:2/3 E5:1 C#5:1"
THAW_LEAD = "-:12 | A4:.5 Bb4:.5 C#5:.5 D5:.5 E5:.5 F5:.5 G5:.5 A5:.5"
# Thawed: the lead has the tune's first bar and a climb; the gritty synth answers in the cold chord; then together.
DROP_LEAD = (
    "A5:1.5 G5:.5 F5:.75 E5:.25 D5:1 | D5:.5 F5:.5 A5:1 D6:2 | -:4 | -:4 | G5:1.5 Bb5:.5 D6:2 | C6:2/3 Bb5:2/3 G5:2/3 A5:2 | "
    "A5:1 C#6:1 E6:1.5 D6:.5 | C#6:2/3 Bb5:2/3 A5:2/3 G5:.5 F5:.5 E5:1"
)
DROP_GRIT = (
    "-:4 | -:4 | Bb3:1.5 Db4:.5 F4:.75 Eb4:.25 Db4:1 | F4:2/3 Db4:2/3 Bb3:2/3 Ab3:1 Bb3:1 | G3:1.5 Bb3:.5 D4:2 | Eb4:2/3 D4:2/3 Bb3:2/3 C4:2 | "
    "A3:1 C#4:1 E4:1.5 D4:.5 | C#4:2/3 Bb3:2/3 A3:2/3 G3:.5 F3:.5 E3:1"
)
# Icicles, the second calm: the fiddle has the hymn; icicles answer it with bits of the tune.
CALM2_FIDDLE = "D5:1 F5:1 | E5:1 G5:1 | F5:1.5 G5:.5 | A5:1 B5:1 | D6:2 | C6:1 G5:1 | Bb5:1 Ab5:1 | A5:2"
CALM2_GLASS = "-:1.5 A6:.25 G6:.25 | E6:1 -:.5 D6:.25 C6:.25 | A6:1.5 -:.5 | -:1 B6:.5 A6:.5 | G6:.5 F6:.5 D6:1 | -:1 E6:.5 G6:.5 | -:4"
TAG = "A5:.75 A5:.25 D6:1.5 A5:.5 F#5:1 | -:4 | Db6:2 Bb5:1 Ab5:1 | A5:3 -:1"

for _name, _beats in ((TUNE, 32), (V_FIDDLE, 32), (V_LEAD, 32), (HYMN, 16), (ROUND, 24), (ROUND_END[0], 8), (ROUND_END[1], 8), (ROUND_END[2], 8),
                      (LONE, 8), (THAW_BELL, 16), (THAW_FIDDLE, 16), (THAW_LEAD, 16), (DROP_LEAD, 32), (DROP_GRIT, 32), (CALM2_FIDDLE, 16),
                      (CALM2_GLASS, 16), (TAG, 16)):
    assert beats(_name) == _beats, (_name[:30], beats(_name))


def main(out: str) -> None:
    x = Ride([(a, b, t0, t1, 1.0, 1.0, 0.0) for a, b, t0, t1 in PACE], BEATS, SECS, os=2, seed=211)
    put, at = x.put, x.at
    rng = np.random.default_rng(47)
    sr = x.sr
    tau = 2 * np.pi
    levels = {"lead": 1.25, "fiddle": 1.0, "bass": 0.58, "sub": 0.5, "wobble": 0.8, "kick": 0.9, "snare": 2.0, "hats": 4.0, "toms": 1.5, "drum": 1.5,
              "peal": 2.6, "pad": 1.7, "bells": 1.5, "grit": 1.1, "square": 1.2, "fx": 1.2, "choir": 2.5, "sleigh": 1.6, "ice": 2.0, "wind": 1.0,
              "frost": 1.0}

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        """Noise as bright as `rate`, its lows thinned by `hp` (0 to 1)."""
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def ring(ch):
        root, three, six = RING[ch]
        return n(root), [n(c) for c in three.split()], [n(c) for c in six.split()]

    # ---- the second verse's clock: its beats, with the frozen ones cut in ----
    def v(b):
        return T_VERSE + b + sum(g for where, g in GAPS if b >= where - 1e-9)

    def verse(text):
        """A line of the verse: [(beat, beats, note)], a note the ice interrupts cut in two (it stops, then goes on)."""
        line = []
        for b, d, m in notes(0, text):
            start = b
            for where, _ in GAPS:
                if start < where - 1e-9 < b + d - 1e-9:
                    line.append((v(start), where - start, m))
                    start = where
            line.append((v(start), b + d - start, m))
        return line

    def follow(start, text, behind, until):
        """A round's later voice: the same line `behind` beats late, stopping at beat `until` of the section."""
        return [(start + b + behind, min(d, until - b - behind), m) for b, d, m in notes(0, text) if b + behind < until - 1e-9]

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / 0.12))
        put("kick", b, w * tail(k) * vol)
        put("duck", b, np.ones(1))  # where the bass, the strings, the choir and the bells duck

    def snare(b, vol=0.26):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put("snare", b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def crunch(b, vol=0.1):
        """A bite of gingerbread: two crunchy grains of mid-band noise, laid on the snare."""
        kk = int(0.08 * sr)
        for late, a in ((0, 1.0), (0.055, 0.7)):
            put("snare", b, hiss(kk, 3000, 0.5) * np.exp(-np.arange(kk) / sr / 0.022) * a * vol, 0.05, late=late)

    def hat(b, vol=0.035):
        k = int(0.05 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 11000, 0.8) * np.exp(-t / 0.014) * tail(k, 0.004) * vol, 0.3)

    def tom(b, m, vol=0.32, pan=0.0):
        k = int(0.4 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.15) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def toms(b, pitches=(50, 50, 45, 40)):
        for i, m in enumerate(pitches):
            tom(b + i * 0.25, m, 0.24 + 0.03 * min(i, 4), {50: 0.3, 45: 0.0, 40: -0.3}[m])

    def clap(b, vol=0.2):
        kk = int(0.02 * sr)
        for late in (0, 0.011, 0.023):
            put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.006) * vol * 0.7, late=late)
        kk = int(0.2 * sr)
        put("snare", b, hiss(kk, 8000, 0.4) * np.exp(-np.arange(kk) / sr / 0.06) * vol, late=0.03)

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
        """The 808; `swell`: no thump, the note growing instead."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** ((0 if swell else 12) * np.exp(-t / 0.012) / 12)) / sr
        env = (np.linspace(0.3, 1, k) ** 1.5 * np.minimum(1, t / 0.03) if swell else np.exp(-t / (k / sr * 0.6))) * tail(k, 0.03)
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
        kk = int(0.9 * sr)
        put("fx", b, hiss(kk, 7000, 0.2) * np.exp(-np.arange(kk) / sr / 0.2) * vol * 0.3)

    def pad(b, length, ch, vol=0.045, slow=False):
        at(b, length)
        for j, m in enumerate(ring(ch)[1]):
            put("pad", b, x.strings(m + 12, length, vol, attack=0.4 if slow else 0.12, release=0.5 if slow else 0.2), PANS[j])

    # ---- the North Pole: bells, the sleigh, ice, wind, his staff (the game's sounds: gingerbread-sounds.ts) ----
    def bell(b, m, ring_s=0.35, vol=0.08, pan=0.0, dark=0.0, bus="bells", late=0.0):
        """A hand bell: a clean strike and its overtones. With `dark`, a tower bell: the hum an octave under and the
        minor third over the note that make a big bell sombre."""
        k = int(min(6.0, 5 * ring_s + 0.1) * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        parts = [(1, 1.0, 1.0), (2, 0.55, 0.6), (3, 0.3, 0.4), (4.2, 0.16, 0.28), (5.4, 0.08, 0.2)]
        if dark:
            parts += [(0.5, 0.35 * dark, 1.5), (1.2, 0.5 * dark, 0.8), (1.5, 0.2 * dark, 0.7)]
        w = np.zeros(k)
        for r, a, long in parts:
            if f * r < 0.45 * SR:
                w += a * np.sin(tau * f * r * t + r) * np.exp(-t / (ring_s * long))
        w += 0.4 * hiss(k, 9000, 0.5) * np.exp(-t / 0.004)  # the clapper
        put(bus, b, w * np.minimum(1, t / 0.0015) * tail(k) * vol, pan, late=late)

    place = [0]  # how far through the changes the hand bells are, in 16ths

    def peal(b, ch, count=1, vol=1.0, glints=0.2):
        """`count` beats of the hand bells ringing changes in 16ths: each of the chord's six once a row, in the row's
        order; each at its own loudness, some with a glint an octave up."""
        six = ring(ch)[2]
        for i in range(count * 4):
            m = six[5 - ROWS[place[0] % len(ROWS)]]
            loud = vol * rng.uniform(0.55, 1.0) * (1.15 if i % 4 == 0 else 1.0)
            pan = 0.5 * np.sin(place[0] * 1.7)
            bell(b + i * 0.25, m, 0.1, 0.05 * loud, pan, bus="peal")
            if rng.uniform() < glints:
                bell(b + i * 0.25 + 0.125, m + 12, 0.07, 0.018 * loud, -pan, bus="peal")
            place[0] += 1

    def shake():
        """Sleigh bells shaken once: four small metal strikes (bright partials that don't agree) and a shimmer."""
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for _ in range(4):
            t0, f, a = rng.uniform(0, 0.022), rng.uniform(2200, 3100), rng.uniform(0.6, 1.0)
            age = np.maximum(0, t - t0)
            w += (t >= t0) * a * np.exp(-age / 0.05) * (np.sin(tau * f * age) + 0.6 * np.sin(tau * f * 1.51 * age) + 0.35 * np.sin(tau * f * 2.37 * age))
        return (0.07 * w + 0.12 * hiss(k, 16000, 0.9) * np.exp(-t / 0.05)) * tail(k)

    shakes = [shake() for _ in range(8)]

    def jingle(b, vol=0.5, pan=0.25):
        put("sleigh", b, shakes[rng.integers(0, 8)] * vol, pan)

    def icicle(b, m, vol=0.05, pan=0.0, ring_s=0.14, late=0.0):
        """An icicle struck: glass, sharp."""
        k = int(min(1.5, 5 * ring_s) * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        w = np.sin(tau * f * t) + 0.6 * np.sin(tau * 1.5 * f * t + 1) + 0.25 * np.sin(tau * 2.76 * f * t + 2) + 0.5 * hiss(k, 12000, 0.7) * np.exp(-t / 0.002)
        put("ice", b, w * np.exp(-t / ring_s) * np.minimum(1, t / 0.0005) * tail(k) * vol, pan, late=late)

    def tinkle(b, length, ch, each=1.0, vol=0.04):
        """Icicles here and there: the chord's notes one or two octaves up, near the 16ths but not on them."""
        six = ring(ch)[2]
        for _ in range(int(round(length * each))):
            icicle(b + rng.integers(0, int(length * 4)) * 0.25 + rng.uniform(-0.04, 0.04), six[rng.integers(0, 6)] + 12 * rng.integers(1, 3),
                   vol * rng.uniform(0.5, 1.0), rng.uniform(-0.7, 0.7), 0.1)

    def flurry(b, ch, vol=0.03, count=6):
        """A snow flurry: the chord's bells' notes an octave up, six in a beat, drifting down."""
        six = ring(ch)[2]
        for i in range(count):
            icicle(b + i / 6, six[5 - i] + 12, vol * (0.8 + 0.07 * i), 0.6 * np.cos(i + b), 0.08)

    def crackle(b, vol=0.2, secs=0.4, clicks=16):
        """Ice crackling: sharp clicks scattered over a high glassy ring that fades."""
        k = int((secs + 0.5) * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        kk = int(0.012 * sr)
        for _ in range(clicks):
            i = int(rng.uniform(0, secs) * sr)
            w[i : i + kk] += rng.uniform(0.4, 1.0) * hiss(kk, 10000, 0.8) * np.exp(-np.arange(kk) / sr / 0.004)
        glass = np.sin(tau * np.cumsum(3100 + 200 * np.exp(-t / 0.1)) / sr) + 0.6 * np.sin(tau * np.cumsum(4650 + 250 * np.exp(-t / 0.1)) / sr)
        put("ice", b, (1.1 * w + 0.1 * np.exp(-t / 0.14) * glass) * tail(k) * vol, rng.uniform(-0.4, 0.4))

    def shatter(b, vol=0.1):
        """Ice breaking: a burst and a scatter of glass."""
        for _ in range(18):
            icicle(b, rng.integers(88, 106), vol * rng.uniform(0.4, 1.0), rng.uniform(-0.8, 0.8), 0.07, late=rng.uniform(0, 0.22))
        k = int(0.3 * sr)
        put("ice", b, hiss(k, 9000, 0.6) * np.exp(-np.arange(k) / sr / 0.05) * tail(k) * vol * 1.5)

    def drip(b, m, vol=0.05, pan=0.0):
        """Meltwater: a drop, its pitch flicking up."""
        k = int(0.14 * sr)
        t = np.arange(k) / sr
        put("ice", b, np.sin(tau * np.cumsum(x.hz(m) * 2 ** (8 * np.minimum(1, t / 0.03) / 12)) / sr) * np.exp(-t / 0.035) * np.minimum(1, t / 0.002) * tail(k) * vol, pan)

    def wind(b, length, vol=0.1, pan=0.0):
        """The blizzard: a gust that swells and dies, a whistle drifting through it."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        gust = np.sin(np.pi * np.linspace(0, 1, k)) ** 1.5 * (1 + 0.25 * np.sin(tau * 2.3 * t))
        roar = np.convolve(hiss(k, 1400), np.ones(96) / 96, "same") * 2.5
        knots = np.arange(0, k + sr // 40, sr // 40)
        breath = np.interp(np.arange(k), knots, rng.uniform(0.2, 1.0, len(knots)))
        wander = np.interp(np.arange(k), knots, np.cumsum(rng.uniform(-0.7, 0.7, len(knots))))
        whistle = breath * np.sin(tau * np.cumsum(900 + 500 * np.sin(tau * 0.8 * t + 1) + 300 * np.sin(tau * 2.9 * t)) / sr + wander)
        put("wind", b, gust * (0.55 * roar + 0.3 * whistle) * vol, pan)

    def charge(b, length, vol=0.1):
        """His staff charging: an icy hum swelling and rising, frost on top."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(330 + 90 * u) / sr
        swell = np.minimum(1, u / 0.8) * np.minimum(1, (1 - u) / 0.1)
        put("fx", b, swell * (0.35 * (np.sin(ph) + np.sin(1.009 * ph)) + 0.4 * swell * hiss(k, 14000, 0.9)) * vol)

    def blast(b, vol=0.2):
        """Its blast: a sharp frosty zap (down, then up) and a whoosh of air."""
        k = int(0.5 * sr)
        t = np.arange(k) / sr
        zap = np.sin(tau * np.cumsum(1800 * np.exp(-t / 0.05) + 500 + 1400 * t) / sr)
        put("fx", b, (0.5 * np.exp(-t / 0.07) * zap + 0.5 * np.sin(np.pi * t / 0.5) * hiss(k, 6000, 0.6)) * tail(k) * vol)

    def burst(b, vol=0.2):
        """It bursts: a crisp glassy pop, a high ring dying fast."""
        k = int(0.25 * sr)
        t = np.arange(k) / sr
        put("ice", b, (hiss(k, 6000, 0.5) * np.exp(-t / 0.012) + 0.4 * (np.sin(tau * 3900 * t) + 0.6 * np.sin(tau * 5870 * t)) * np.exp(-t / 0.05)) * tail(k) * vol)

    def hoof(b, vol=0.12, pan=-0.3):
        """A hoof on packed snow."""
        k = int(0.09 * sr)
        t = np.arange(k) / sr
        put("fx", b, (np.sin(tau * np.cumsum(70 + 60 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.03) + 0.5 * hiss(k, 1500) * np.exp(-t / 0.012)) * tail(k) * vol, pan)

    def whip(b, vol=0.2):
        """The driver's whip: a swish and a crack."""
        k = int(0.25 * sr)
        t = np.arange(k) / sr
        put("fx", b, hiss(k, 16000, 0.9) * (0.25 * np.clip(t / 0.12, 0, 1) ** 2 * (t < 0.12) + 1.5 * np.exp(-np.maximum(0, t - 0.12) / 0.012) * (t >= 0.12)) * tail(k) * vol, 0.3)

    # ---- the voices ----
    def sing(b, d, m, vol=0.1, mouth=0.2, pan=0.0, singers=3):
        """The choir, no words: each note three singers a little apart, their vibrato their own; `mouth` from "oo"
        (0, dark) to "ah" (1, open)."""
        at(b, d)
        k = x.k(d * 1.04)
        t = np.arange(k) / sr
        f0 = x.hz(m)
        f1, f2, f3 = 350 + 400 * mouth, 800 + 400 * mouth, 2700
        gains = []
        for h in range(1, int(4500 / f0) + 1):
            fh = h * f0
            g = 1.0 / np.sqrt(1 + 30 * (fh / f1 - f1 / fh) ** 2) + 0.5 / np.sqrt(1 + 40 * (fh / f2 - f2 / fh) ** 2) + 0.12 / np.sqrt(1 + 60 * (fh / f3 - f3 / fh) ** 2) + 0.03
            gains.append(g / h**1.3)
        w = np.zeros(k)
        for s in range(singers):
            vib = 1 + 0.006 * np.sin(tau * (4.8 + 0.45 * s) * t + rng.uniform(0, tau)) * np.clip((t - 0.15) / 0.3, 0, 1)
            ph = tau * np.cumsum(f0 * 2 ** (rng.uniform(-12, 12) / 1200) * vib) / sr
            for h, g in enumerate(gains, 1):
                w += g * np.sin(h * ph + rng.uniform(0, tau))
        w = w / singers + 0.02 * hiss(k, 5000, 0.5)
        put("choir", b, w * np.minimum(1, t / 0.12) * tail(k, 0.15) * vol, pan)

    def chorus(b, d, ch, vol=0.06, mouth=0.15):
        """The choir's three lower voices on a chord."""
        for j, m in enumerate(ring(ch)[1]):
            sing(b, d, m, vol, mouth, PANS[j])

    def belled(line, vol=1.0, pan=-0.1, struck=True):
        """Ginger: the overdriven lead, a hand bell struck on every note of half a beat or more. A long note that
        follows another straight on slides in from most of the way back."""
        last = None
        for b, d, m in line:
            glide = 0.6 * (last[1] - m) if last and abs(last[0] - b) < 1e-6 and d >= 1 and 0 < abs(last[1] - m) <= 12 else 0.0
            at(b, d)
            put("lead", b, x.drive(m, d * 0.96, 0.16 * vol, glide=glide), pan)
            if struck and d >= 0.5:
                bell(b, m, 0.3, 0.08 * vol, pan + 0.25)
            last = (b + d, m)

    def fiddle(line, vol=1.0, pan=0.25):
        for b, d, m in line:
            at(b, d)
            put("fiddle", b, x.fiddle(m, d * 0.95, 0.145 * vol), pan)

    def grit(line, vol=1.0, pan=0.3):
        for b, d, m in line:
            at(b, d)
            put("grit", b, x.gritty(m, d * 0.92, 0.21 * vol), pan)

    def square(line, vol=0.07, pan=0.4):
        for b, d, m in line:
            at(b, d)
            put("square", b, x.chip(m, d * 0.9, vol), pan)

    def under(m):
        """The note a sixth under a tune's note, in D minor."""
        pc = m % 12
        return m - 12 + (3 if pc not in MINOR else (MINOR[(MINOR.index(pc) + 2) % 7] - pc) % 12)

    def stutter(b, m, count=4, vol=0.6):
        for i in range(count):
            at(b + i * 0.125, 0.1)
            put("grit", b + i * 0.125, x.gritty(m, 0.1, 0.21 * vol * (1 - 0.6 * i / count)), 0.4 if i % 2 else -0.4)

    # ---- the band, beat by beat ----
    def trot(g, beat, bar, ch, fill=False, fast=False, vol=1.0, glints=0.2, strings=0.045):
        """One beat of the sleigh's trot: a kick on 1 and 3 (in the gallop, on every beat) and a quick one before
        them every other bar; the snare, with a bite of gingerbread, on 2 and 4; sleigh bells on every 8th (in the
        gallop, every 16th); the bass galloping (a note and two quick ones an octave up); the hand bells' changes;
        the strings from each bar's first beat."""
        if beat in (0, 2) or fast:
            kick(g, 0.5)
        if beat in (1, 3):
            toms(g) if fill and beat == 3 else (snare(g, 0.24), crunch(g))
            if bar % 2:
                kick(g + 0.75, 0.34)
        jingle(g, 0.5 * vol), jingle(g + 0.5, 0.32 * vol)
        if fast:
            jingle(g + 0.25, 0.2), jingle(g + 0.75, 0.2)
        hat(g + 0.25, 0.02), hat(g + 0.75, 0.025)
        root = ring(ch)[0]
        bass(g, root, 0.46, 0.4), bass(g + 0.5, root + 12, 0.23, 0.3), bass(g + 0.75, root + 12, 0.23, 0.3)
        peal(g, ch, 1, vol, glints)
        if beat == 0 and strings:
            pad(g, 4, ch, strings)

    WOB = [((2, 1), (1, 2), (1, 4)), ((1, 2), (1, 3), (2, 0.5)), ((1.5, 2), (1.5, 4), (1, 6)), ((1, 1), (1, 4), (2, 2))]

    def storm(b, ch, k):
        """A drop bar: a kick on every beat, a clap, the snare and the gingerbread on 2 and 4, the 808 in the trot's
        rhythm, the wobble bass at changing speeds, 16th hats, sleigh bells."""
        low = ring(ch)[0] if ring(ch)[0] >= 33 else ring(ch)[0] + 12
        for i in range(4):
            kick(b + i, 0.55 if i % 2 == 0 else 0.45)
            jingle(b + i, 0.5), jingle(b + i + 0.5, 0.32)
        for o in (1, 3):
            clap(b + o), snare(b + o, 0.2), crunch(b + o, 0.12)
        sub(b, low, 1.4, 0.45), sub(b + 1.5, low, 0.9, 0.36), sub(b + 2.5, low, 1.4, 0.4)
        t = b
        for d, rate in WOB[k % 4]:
            wobble(t, low + 12, d, rate, 0.17)
            t += d
        for i in range(16):
            hat(b + i * 0.25, 0.03 if i % 4 == 2 else 0.018)

    # 0:00 The sleigh arrives. Wind; the tower bell; icicles; sleigh bells and hooves coming nearer from the left;
    # six hand bells ringing down, twice, then the changes; the bass's drone; his staff charges, and fires.
    wind(0, 13, 0.12), wind(5, 11, 0.07, 0.4)
    bell(0, n("D3"), 2.2, 0.13, dark=1.0), bell(8, n("D3"), 2.2, 0.1, dark=1.0)
    tinkle(1, 7, "Dm", 0.9)
    for i in range(28):
        jingle(2 + i * 0.5, (0.06 + 0.44 * (i / 27) ** 1.5) * (1.0 if i % 2 == 0 else 0.65), -0.7 + 0.95 * i / 27)
    for i in range(12):
        hoof(4 + i, 0.05 + 0.006 * i, -0.6 + 0.04 * i), hoof(4 + i + 0.75, 0.035 + 0.005 * i, -0.6 + 0.04 * i)
    six = ring("Dm")[2]
    for i in range(12):
        bell(8 + i * 0.5, six[5 - i % 6], 0.14, 0.035 + 0.002 * i, 0.5 * np.sin(i * 1.7), bus="peal")
    peal(14, "Dm", 2, 0.9)
    at(8, 8)
    for j, m in enumerate(ring("Dm")[1]):
        put("pad", 8, x.swell(x.strings(m + 12, 8, 0.05, attack=0.5, release=0.3), 0.9), PANS[j])
    for i in range(8):
        bass(8 + i, n("D2"), 0.46, 0.16 + 0.03 * i), bass(8.5 + i, n("D3"), 0.23, 0.1 + 0.025 * i), bass(8.75 + i, n("D3"), 0.23, 0.1 + 0.025 * i)
    charge(10.5, 4.2, 0.1)
    kick(12, 0.4), kick(13, 0.42), kick(14, 0.45), kick(15, 0.5)
    roll(14, 2, 0.06, 0.22)
    blast(14.75, 0.2)

    # 0:07 Ginger's tune: eight bars, the bass on its drone for four, then climbing.
    x.crash(T_TUNE, 0.14, decay=0.5), burst(T_TUNE, 0.14)
    belled(notes(T_TUNE, TUNE))
    for i, ch in enumerate(TUNE_CH):
        for beat in range(4):
            trot(T_TUNE + 4 * i + beat, beat, i, ch, fill=i in (3, 7))
        if i in (1, 5):
            flurry(T_TUNE + 4 * i + 3, ch)

    # 0:19 The second verse: the fiddle and the lead take the tune in turns, and together for its last two bars. The
    # band freezes twice (a beat, then two): the ice crackles over, icicles ring, and it cracks free.
    fiddle(verse(V_FIDDLE))
    belled(verse(V_LEAD))
    for i, ch in enumerate(TUNE_CH):
        for beat in range(4):
            trot(v(4 * i + beat), beat, i, ch, fill=i in (3, 7), glints=0.3, strings=0)
    for i, ch in enumerate(TUNE_CH):
        start = 4 * i
        for where, _ in GAPS:
            if start < where < start + 4:
                pad(v(start), where - start, ch)
                start = where
        pad(v(start), 4 * i + 4 - start, ch)
    freezes = [(v(where) - g, g) for where, g in GAPS]
    for g, d in freezes:
        crackle(g, 0.22, 0.3 * d, 10 * d)
        tinkle(g, d, "Dm", 3.0, 0.05)
        burst(g + d, 0.16)
    x.crash(T_VERSE, 0.12, decay=0.4)

    # 0:32 The round, faster: the lead's line on five notes; the fiddle plays the same line three beats behind; for
    # the cold chord and home they play together, a third apart.
    x.crash(T_ROUND, 0.16, decay=0.5)
    belled(notes(T_ROUND, ROUND + " | " + ROUND_END[0]))
    fiddle(follow(T_ROUND, ROUND, 3, 24) + notes(T_ROUND + 24, ROUND_END[1]))
    for i, ch in enumerate(ROUND_CH):
        for beat in range(4):
            trot(T_ROUND + 4 * i + beat, beat, i, ch, fill=i in (3, 7), glints=0.3, strings=0.05)
        if i in (1, 5):
            flurry(T_ROUND + 4 * i + 3, ch)

    # 0:44 The hymn, the first calm: the choir, two beats a chord, over a soft bass and strings; the tower bell; a
    # hand bell on each chord; snow falling (quick runs of icicles); far sleigh bells; wind.
    bell(T_HYMN, n("D3"), 2.2, 0.14, dark=1.0)
    wind(T_HYMN, 9, 0.05, -0.3), wind(T_HYMN + 7, 9, 0.06, 0.3)
    for b, d, m in notes(T_HYMN, HYMN):
        sing(b, d, m, 0.11, 0.45)
        sing(b, d, m + 12, 0.035, 0.45, 0.2, singers=2)
        bell(b, m + 12, 0.6, 0.07, 0.35)  # hand bells carry the hymn's tune an octave over the choir
    for j, ch in enumerate(TUNE_CH):
        b = T_HYMN + 2 * j
        chorus(b, 2, ch, 0.07)
        bass(b, ring(ch)[0] + 12, 1.9, 0.2)
        pad(b, 2, ch, 0.035, slow=True)
        flurry(b + 1, ch, 0.035, 6 if j % 2 else 3)
    for i in range(32):
        jingle(T_HYMN + i * 0.5, 0.16 if i % 2 == 0 else 0.1, 0.6)
    tinkle(T_HYMN, 16, "Dm", 0.6, 0.03)

    # 0:58 The Blizzard. Turn one, frozen: the hymn's last chord iced solid (see `frost`, below); a boom, the wind, ice
    # crackling; "only one piece moves": the gritty synth, alone and low.
    boom(T_ICE, 0.8)
    crackle(T_ICE, 0.25, 0.9, 30)
    wind(T_ICE, 9, 0.16), wind(T_ICE + 6, 12, 0.1, -0.4)
    sub(T_ICE, n("A1"), 7.5, 0.4)
    grit(notes(T_ICE, LONE))
    tinkle(T_ICE, 8, "A", 1.0, 0.04)

    # 1:01 Turn two, thawing: the others crack free one a bar, each with the lone one's two bars (the hand bells, then
    # the fiddle, then the lead, running up), over an 808 and a kick that come to life; meltwater dripping; his staff.
    grit(notes(T_THAW, THAW_GRIT))
    for b, d, m in notes(T_THAW, THAW_BELL):
        bell(b, m, 0.45, 0.1, -0.3)
    fiddle(notes(T_THAW, THAW_FIDDLE))
    belled(notes(T_THAW, THAW_LEAD), struck=False)
    for i in range(4):
        b = T_THAW + 4 * i
        crackle(b, 0.16, 0.25, 8)
        kick(b, 0.55), sub(b, n("A1"), 3.5, 0.4), clap(b + 2, 0.18), snare(b + 2, 0.16)
        for j in range(3 + 2 * i):
            drip(b + rng.integers(0, 16) * 0.25, 84 - 2 * j - 3 * i, 0.05, rng.uniform(-0.6, 0.6))
        if i >= 1:
            kick(b + 2.75, 0.4)
            for o in range(8):
                hat(b + o * 0.5, 0.03)
        if i >= 2:
            for o in range(4):
                jingle(b + o, 0.4), jingle(b + o + 0.5, 0.26)
                bass(b + o, n("A1"), 0.46, 0.36), bass(b + o + 0.5, n("A2"), 0.23, 0.28), bass(b + o + 0.75, n("A2"), 0.23, 0.28)
        if i == 3:
            kick(b + 1, 0.5), kick(b + 3, 0.5)
            roll(b, 4, 0.05, 0.24)
    charge(T_DROP - 4.5, 4.2, 0.1)
    blast(T_DROP - 1.25, 0.2)

    # 1:08 Turn three, thawed: the drop. The lead has the tune's first bar and a climb; the gritty synth answers in
    # the cold chord; then four bars together, an octave apart. The choir on each new chord; a stutter after each turn.
    boom(T_DROP, 0.8), x.crash(T_DROP, 0.2, decay=0.6), shatter(T_DROP)
    belled(notes(T_DROP, DROP_LEAD))
    grit(notes(T_DROP, DROP_GRIT))
    for i, ch in enumerate(DROP_CH):
        b = T_DROP + 4 * i
        storm(b, ch, i)
        peal(b, ch, 4, 1.05, 0.35)
        if i % 2 == 0:
            chorus(b, 3.5, ch, 0.14, 0.85)
            x.crash(b, 0.1, decay=0.4)
    for b, m, count in ((7, "D4", 4), (15, "Bb3", 8), (31, "E3", 4)):
        stutter(T_DROP + b, n(m), count)
    toms(T_RUN - 1, (50, 50, 45, 40))

    # 1:20 The gallop, the fastest: the round again, now three voices (the lead; the fiddle three beats behind; a
    # square six behind), a kick on every beat, sleigh bells on every 16th; a whip to start it.
    whip(T_RUN - 0.4)
    x.crash(T_RUN, 0.18, decay=0.5)
    belled(notes(T_RUN, ROUND + " | " + ROUND_END[0]))
    fiddle(follow(T_RUN, ROUND, 3, 24) + notes(T_RUN + 24, ROUND_END[1]))
    square(follow(T_RUN, ROUND, 6, 24) + notes(T_RUN + 24, ROUND_END[2]), 0.12)
    for i, ch in enumerate(ROUND_CH):
        for beat in range(4):
            trot(T_RUN + 4 * i + beat, beat, i, ch, fill=i in (3, 7), fast=True, glints=0.3, strings=0.05)
        if i == 4:
            x.crash(T_RUN + 16, 0.12, decay=0.4)

    # 1:30 Icicles, the second calm: the fiddle has the hymn, slowly; icicles answer with bits of the tune; the choir
    # hums under it; the tower bell, far sleigh bells, wind. Its last two chords quicken: his staff charges, and fires.
    bell(T_CALM2, n("D3"), 2.2, 0.12, dark=1.0)
    wind(T_CALM2, 10, 0.06, 0.3), wind(T_CALM2 + 7, 9, 0.07, -0.3)
    fiddle(notes(T_CALM2, CALM2_FIDDLE), 0.7, 0.1)
    for b, d, m in notes(T_CALM2, CALM2_GLASS):
        icicle(b, m, 0.035, -0.3, 0.3)
    for j, ch in enumerate(TUNE_CH):
        b = T_CALM2 + 2 * j
        chorus(b, 2, ch, 0.05 if j < 6 else 0.07, 0.05 if j < 6 else 0.5)
        bass(b, ring(ch)[0] + 12, 1.9, 0.18)
        if j >= 6:
            sub(b, ring(ch)[0] + (0 if ring(ch)[0] >= 33 else 12), 2, 0.3 + 0.1 * (j - 6), swell=True)
    for i in range(24):
        jingle(T_CALM2 + i * 0.5, 0.16 if i % 2 == 0 else 0.1, 0.6)
    tinkle(T_CALM2, 12, "Dm", 0.5, 0.03)
    charge(T_LAST - 4, 3.7, 0.1)
    for i in range(4):
        kick(T_LAST - 4 + i, 0.35 + 0.05 * i)
    roll(T_LAST - 2, 2, 0.06, 0.24)
    blast(T_LAST - 1.1, 0.2)

    # 1:42 The tune again, and the hymn over it: the choir sings its line, each note twice as long, above the band;
    # the fiddle joins under the lead for the last four bars.
    x.crash(T_LAST, 0.18, decay=0.5), burst(T_LAST, 0.14)
    belled(notes(T_LAST, TUNE))
    for b, d, m in notes(0, HYMN):
        sing(T_LAST + 2 * b, 2 * d, m, 0.14, 0.8, -0.2)
        sing(T_LAST + 2 * b, 2 * d, m + 12, 0.07, 0.8, 0.2, singers=2)
    tune = notes(T_LAST, TUNE)
    fiddle([(b, d, under(m)) for b, d, m in tune if T_LAST + 16 <= b < T_LAST + 24] + notes(T_LAST + 24, "|".join(V_FIDDLE.split("|")[-2:])))
    for i, ch in enumerate(TUNE_CH):
        for beat in range(4):
            trot(T_LAST + 4 * i + beat, beat, i, ch, fill=i in (3, 7), vol=1.05, glints=0.35, strings=0.05)
        chorus(T_LAST + 4 * i, 4, ch, 0.045, 0.6)
        if i in (1, 3, 5):
            flurry(T_LAST + 4 * i + 3, ch, 0.035)
        if i == 4:
            x.crash(T_LAST + 16, 0.12, decay=0.4)

    # 1:54 The tag: two bars of light (D major: the lead's call, then eight hand bells ringing down the scale), the
    # cold chord, and A; the tower bell, and the sleigh goes off to the right into the wind that bar 1 begins with.
    x.crash(T_TAG, 0.16, decay=0.5)
    belled(notes(T_TAG, TAG))
    for i, ch in enumerate(TAG_CH[:2]):
        for beat in range(4):
            trot(T_TAG + 4 * i + beat, beat, i, ch, fill=i == 1, vol=1.05, glints=0.35, strings=0.05)
        chorus(T_TAG + 4 * i, 4, ch, 0.06, 0.8)
    for i, name in enumerate("D6 C#6 B5 A5 G5 F#5 E5 D5".split()):
        bell(T_TAG + 4 + i * 0.5, n(name), 0.5, 0.09, 0.5 - 0.14 * i)
    kick(T_TAG + 8, 0.55), snare(T_TAG + 8, 0.22), x.crash(T_TAG + 8, 0.12, decay=0.5)
    for i, ch in enumerate(TAG_CH[2:]):
        b = T_TAG + 8 + 4 * i
        chorus(b, 4, ch, 0.07, 0.2)
        pad(b, 4, ch, 0.045, slow=True)
        bass(b, ring(ch)[0] + 12, 3.8, 0.24)
        for o in range(8):
            fade = 1 - (4 * i + o * 0.5) / 8
            jingle(b + o * 0.5, (0.4 if o % 2 == 0 else 0.26) * fade + 0.04, 0.25 + 0.6 * (1 - fade))
        for o in range(4):
            hoof(b + o, 0.08 * (1 - (4 * i + o) / 8) + 0.02, 0.2 + 0.1 * (4 * i + o)), hoof(b + o + 0.75, 0.05 * (1 - (4 * i + o) / 8) + 0.015, 0.2 + 0.1 * (4 * i + o))
    bell(T_TAG + 12, n("D3"), 2.2, 0.12, dark=1.0)
    tinkle(T_TAG + 8, 8, "A", 0.6, 0.035)
    wind(T_TAG + 8, 8, 0.1)

    def frost(b, length, hold=None, vol=1.0, back=0.0, sources=("lead", "fiddle", "bells", "peal", "pad", "choir", "bass", "square", "grit")):
        """Freeze: the band's sound at beat `b`, held for `length` beats. The last third of a second before `b` is
        measured (how loud each pitch in it is) and played on and on with its timing scrambled, so it stands still;
        as it stays it ices over (its lows thin, its highs glint). `hold`: after that many beats it melts away to
        nothing by the end; without it, it stops dead at the end (it cracks). `back`: measure that many beats early."""
        size = 16384
        hop = size // 4
        i0 = int(round(x.t(b) * sr))
        total = int(round((x.t(b + length) - x.t(b)) * sr))
        window = np.hanning(size)
        i1 = int(round(x.t(b - back) * sr))
        heard = sum(levels.get(name, 1.0) * x.buses[name][:, (i1 - 2 * size + np.arange(2 * size)) % x.N] for name in sources if name in x.buses)
        level = np.sqrt(np.mean(heard[:, -size:] ** 2)) + 1e-9
        loud = np.sqrt(np.mean([np.abs(np.fft.rfft(heard[:, o : o + size] * window, axis=1)) ** 2 for o in (0, size // 3, 2 * size // 3, size)], axis=0))
        f = np.fft.rfftfreq(size, 1 / sr)
        frames = total // hop + 4
        ice = np.zeros((2, frames * hop + size))
        for j in range(frames):
            u = j / frames
            frosted = loud / np.sqrt(1 + ((40 + 500 * u) / np.maximum(f, 1)) ** 2) * (1 + 0.8 * u * f / (f + 3000))
            ice[:, j * hop : j * hop + size] += np.fft.irfft(frosted * np.exp(1j * rng.uniform(0, tau, (2, len(f)))), axis=1) * window
        ice = ice[:, size // 2 : size // 2 + total]
        ice *= vol * level / (np.sqrt(np.mean(ice**2)) + 1e-9)
        t = np.arange(total) / sr
        shape = np.minimum(1, t / 0.02)
        if hold is None:
            shape *= np.minimum(1, (total - 1 - np.arange(total)) / (0.012 * sr))
        else:
            melt = int(round((x.t(b + hold) - x.t(b)) * sr))
            shape *= np.clip((total - np.arange(total)) / (total - melt), 0, 1)
        idx = (i0 + np.arange(total)) % x.N
        x.bus("frost")[:, idx] += ice * shape

    # The freezes, now that everything they hold is in place: the verse's two, and the hymn's last chord, which stays
    # frozen under the lone voice (eight beats) and melts away through the thaw.
    for g, d in freezes:
        frost(g, d)
    frost(T_ICE, 24, hold=8, vol=0.8, back=0.3, sources=("choir", "pad", "bass", "bells"))

    # The bass, the strings, the choir and (lightly) the hand bells duck under each kick.
    marks = x.buses.pop("duck")[0]
    kern = 0.55 * np.exp(-np.arange(int(0.25 * sr)) / (0.08 * sr))
    gain = 1 - np.clip(np.fft.irfft(np.fft.rfft(marks) * np.fft.rfft(kern, len(marks)), len(marks)), 0, 0.7)
    x.buses["bass"] *= gain
    x.buses["pad"] *= 0.45 + 0.55 * gain
    x.buses["choir"] *= 0.6 + 0.4 * gain
    x.buses["peal"] *= 0.75 + 0.25 * gain

    x.beat_s = 60 / 156  # the echoes' beat
    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("fiddle", 0.75, 0.16, 0.07)
    x.echo("peal", 0.75, 0.2, 0.08)
    x.echo("bells", 0.75, 0.2, 0.08)
    x.echo("ice", 1.0, 0.25, 0.1)
    write_wav(out, x.mixdown(levels, lowpass=8000, room=0.28))


if __name__ == "__main__":
    main(sys.argv[1])
