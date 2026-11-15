"""Song AE (Eric, Nov 15): Babur's theme (the circus tiger), a loop of 2:45. "Here is the construction idea for the
Tiger Babur circus. Can you try to come up with something, 2 minute 45 somewhere, whatever. It's flexible."
The construction idea is a write-up of a style, "Dark Gothic Carnival / Unhinged Mechanical Funhouse" on a 16-bit
console's chips. What is used from it is the style's means: about 128 beats a minute in four; a minor scale with a
raised fourth (the tritone over the keynote), a flat sixth and a leading tone; its kinds of voices (a glassy bell, a
ghostly whistle that glides, a steam calliope's short notes, a rubbery FM bass, a short blipping pluck, a dark pipe
organ); and its kinds of sections (a slow eerie opening, a groove, a dry breakdown on a pluck, an organ-and-bell part,
a chase between two short-noted voices, a climax on the dominant that falls back into bar 1).
What is not used: its key; its chord loop; its motifs (the bell's three notes, the whistle's two, its arpeggio, its
trills) or any tune. The chords here move another way (the bass swings a tritone under one note, D, that belongs to
both chords; a Neapolitan; chords a major third apart), and every melody, riff and chord progression is original:
none of it is any song's or any game's.
Changed from it for Eric's ear (SOUNDS.md): no runs of 16ths up and down a scale or a chord (the opening's bell
quickens by saying its three notes more and more often; the chase trades a four-note cell, with rests); the blipping
pluck is a balloon's squeak, not an acid line; the whistle is a few long notes; no reeds a few cents apart.

The boss (docs/areas/bosses.md, tiger-lines.ts, tiger-sounds.ts): a circus tiger who hated the roaring and the burning
hoops and only wants to make balloon animals: bored, dry, a little sour about the circus, proud of his balloons;
"never mean, never scary". So the dark carnival is the circus he is stuck in, and he pads through it unimpressed.
  - He is the low lead (`purred`: the gritty synth, an octave down, a cat's purr in its long notes), and his tune is
    lazy: it starts late, falls in threes, and keeps coming to rest on D. The calliope is the show going on round him.
  - His balloon runs the song. A balloon goes on the pump, takes four strokes, and then lands as a piece ("Ta-da!
    Fresh from the pump") or pops ("Too much air. Again."). Four times here four pump strokes lead somewhere: into
    the groove (it lands: a drum roll and a crash), out of the breakdown (it pops, and a beat of nothing), out of the
    organ's calm (it lands softly, and the chase is off), and at the very end (it pops on the last beat, and bar 1's
    hush is what follows: "...I meant to do that").
  - His balloon twisting is the breakdown: the riff is rubber squeaks, each a note, over the dry kit and the bass.
  - Where the song builds to a roar, he yawns ("No roaring tonight").
  - His hoops are the drop ("Fine! The hoops! Happy now?"): three fire whooshes, half-time, a deep drum with a note in
    it; he and the calliope trade two bars each, then together, on chords a major third apart.
His sounds are built as the game builds them (the pump's stroke, the squeak, the pop, the poof, the yawn, the growl,
a hoop's fire), a few times each and quiet.
D minor with a raised fourth (D E F G# A Bb C#); 88 bars of four at 128 beats a minute: 165.0 s.
  python3 song_ae.py <out.wav>

  bars  1-8    0:00  the first balloon: a heartbeat, a glassy bell's three notes, the ghost whistle answering, the
                     pump; the bell quickens, a drum roll, ta-da
  bars  9-24   0:15  the prowl: the bass swinging a tritone, the kit; his tune, low, alone; then again an octave up,
                     the calliope's quick words in his gaps
  bars 25-32   0:45  the show: the calliope's tune over a bouncing bass, the organ on the off-beats
  bars 33-40   1:00  balloon twisting: the dry kit, the bass, a riff of squeaks; the pump; it pops
  bars 41-48   1:15  the calm: the pipe organ (chords a major third apart), the bell's slow tune, the whistle's long
                     falling notes, a heartbeat; the pump; it lands
  bars 49-56   1:30  the chase: the calliope and a toy xylophone trade a four-note cell that lands somewhere new in the
                     bar each time; the bass creeps up; a growl
  bars 57-64   1:45  the hoops (the drop, half-time): fire; he and the calliope trade, then together
  bars 65-68   2:00  a build to a roar ... and a yawn
  bars 69-84   2:07  the finale, a fourth up: the show's tune, everyone; then his, the calliope answering
  bars 85-88   2:37  the last balloon: four strokes, sinking home, and it pops
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, BARS = 128, 88
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 165.0 s
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# A chord: the bass's note, and the organ's four. "+5" after a name: a fourth up (the finale). (Ab7 and Db7 have
# their fifths lowered: the D and the G the tune rests on.)
TENT = {
    "Dm": ("D2", "D4 F4 A4 D5"), "Ab7": ("Ab2", "C4 D4 Gb4 Ab4"), "Gm": ("G2", "D4 G4 Bb4 D5"), "Db7": ("Db2", "B3 Db4 F4 G4"),
    "Dm/A": ("A2", "D4 F4 A4 D5"), "A7": ("A2", "C#4 E4 G4 A4"), "A7/E": ("E2", "C#4 E4 G4 A4"), "Dm/F": ("F2", "D4 F4 A4 D5"),
    "Eb": ("Eb2", "Eb4 G4 Bb4 Eb5"), "F#m": ("F#2", "C#4 F#4 A4 C#5"), "Bbm": ("Bb2", "Db4 F4 Bb4 Db5"), "A7sus": ("A2", "D4 E4 G4 A4"),
    "F#dim": ("F#2", "C4 Eb4 F#4 A4"), "G#dim": ("G#2", "B3 D4 F4 G#4"), "A7b9": ("A2", "C#4 E4 G4 Bb4"), "Em7b5": ("E2", "D4 E4 G4 Bb4"),
}
PROWL = "Dm Ab7 Dm Ab7 Gm Db7 Dm/A A7"  # the bass swings a tritone under a D (then a G) that both chords have
SHOW = "Dm A7/E Dm/F Eb Dm/A A7 Dm A7"  # the bass climbs to the Neapolitan
up5 = lambda text: " ".join(c + "+5" for c in text.split())
CHORDS = (f"Dm Dm Dm Dm Dm Dm A7 A7  {PROWL} {PROWL}  {SHOW}  Dm Dm Dm Dm Gm Gm Dm A7  Dm Dm F#m F#m Bbm Bbm A7sus A7  "
          f"Dm Eb Dm Eb F#dim Gm G#dim A7  Dm Dm Bbm Bbm F#m F#m A7b9 A7b9  A7 A7 A7 A7  {up5(SHOW)} {up5(PROWL)}  Gm Em7b5 A7sus A7").split()
assert len(CHORDS) == BARS, len(CHORDS)
SWINGS = ("Ab7", "Db7", "A7", "A7b9")  # the chords the prowl's bass plays its second riff on
# The kit's prowl, two bars about: the kicks, the soft kicks and the soft snares (16ths).
KIT = (((0, 6, 10), (13,), (7, 15)), ((0, 3, 8, 10), (), (9,)))
# The bass's riffs: the 16th, half steps over the bar's note, how it's played (a note, a pop, a muted ghost). Each
# ends on a note a half step under the next bar's.
RIFF_1 = ((0, 0, "n"), (3, 0, "g"), (4, 12, "p"), (7, 0, "n"), (10, 7, "n"), (11, 12, "p"))
RIFF_2 = ((0, 0, "n"), (3, 0, "g"), (6, 10, "n"), (7, 12, "p"), (10, 0, "n"), (12, 4, "n"))
BOUNCE = ((0, 0, "n"), (2, 12, "p"), (4, 0, "n"), (6, 12, "p"), (8, 0, "n"), (10, 12, "p"), (12, 7, "n"))
SPARSE = ((0, 0, "n"), (6, 0, "g"), (7, 12, "p"), (10, 0, "n"))
# The chase's cell on each chord: its root and its fifth (a diminished chord's lowered one).
CHASE = {"Dm": ("D5", "A5"), "Eb": ("Eb5", "Bb5"), "F#dim": ("F#5", "C6"), "Gm": ("G5", "D6"), "G#dim": ("G#5", "D6"), "A7": ("A5", "E6")}

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two, .25 a 16th. ----
# His tune: it starts late, leans on the leading tone, tumbles down the far chord in threes and rests on the D; a
# climb that goes a half step too far; from the top, falling; and home by the flat ninth.
TUNE = (
    "-:1 A4:.5 D5:1.5 C#5:1 | C5:2/3 Ab4:2/3 Gb4:2/3 D4:2 | -:.5 D4:.5 F4:.5 A4:.5 D5:.5 F5:1.5 | Gb5:1.5 C5:.5 D5:2 | "
    "G5:1.5 F5:.5 D5:2/3 Bb4:2/3 G4:2/3 | F4:1 B4:1 G4:2 | -:.5 A4:.5 D5:.5 F5:.5 E5:1 D5:1 | C#5:1.5 Bb4:.5 A4:2"
)
# The calliope's quick words in his gaps (the second half of every other bar).
WORDS = "-:4 | -:2.5 D5:.25 Gb5:.25 Ab5:.5 -:.5 | -:4 | -:2.5 C6:.25 Ab5:.25 Gb5:.5 -:.5 | -:4 | -:2.5 G5:.25 B5:.25 Db6:.5 -:.5 | -:4 | -:2.5 E5:.25 G5:.25 Bb5:.25 C#6:.25 -:.5"
# The show's tune (the calliope): a hop, a breath, a wiggle on the raised fourth; an answer that leans on the flat
# ninth; up to the top; the Neapolitan's sigh; the hop again; and round.
SHOWN = (
    "D5:.5 A5:.5 -:.5 F5:.5 G#5:.25 A5:.25 G#5:.25 A5:.25 F5:.5 D5:.5 | C#5:.5 E5:.5 -:.5 G5:.5 Bb5:1 A5:1 | F5:.5 A5:.5 D6:1 -:.5 A5:.5 F5:1 | "
    "Bb5:1.5 G5:.5 Eb5:2 | D5:.5 A5:.5 -:.5 F5:.5 G#5:.25 A5:.25 G#5:.25 A5:.25 F5:.5 D5:.5 | E5:.5 C#5:.5 -:.5 A4:.5 C#5:.5 E5:.5 G5:1 | "
    "F5:1 D5:.5 A4:.5 D5:2 | -:2 A4:.5 C#5:.5 E5:.5 G5:.5"
)
# The opening: the bell's three notes, twice, with room for the whistle; then more and more often (`render` goes on
# from here: the same three, an 8th each, then a 16th each).
BELL_IN = "-:2 A5:.5 G#5:.5 D5:1 | -:4 | -:2 A5:.5 G#5:.5 F5:1 | -:4 | A5:.5 G#5:.5 D5:1 A5:.5 G#5:.5 F5:1"
CELL = ("A5", "G#5", "D5")
# Balloon twisting: the squeaks' riff, two bars; and its last bar.
TWIST = "-:.5 D5:.25 -:.25 F5:.5 -:.5 D5:.25 A5:.5 -:.25 G#5:.5 -:.5 | -:.75 D5:.25 -:.5 F5:.5 A5:.25 -:.25 D6:.5 -:1"
TWIST_END = "E5:.5 -:.5 C#5:.5 -:.5 A4:1 -:1"
# The calm: the bell's slow tune.
BELL_SLOW = "A5:1.5 F5:.5 D5:2 | -:1 E5:1 F5:1 A5:1 | C#6:3 A5:1 | F#5:2 G#5:1 A5:1 | F5:1.5 Db5:.5 Bb4:2 | -:1 C5:1 Db5:1 F5:1 | E5:3 D5:1 | C#5:4"
# The hoops: his two bars, the calliope's two, two together, and two climbing by half steps to the leading tone.
HOOP_HIS = "D4:1.5 F4:.5 G#4:1 A4:1 | Bb4:2/3 A4:2/3 G#4:2/3 D4:2 | -:8 | F#4:1.5 A4:.5 C#5:1 B4:1 | A4:2/3 G#4:2/3 F#4:2/3 C#4:2 | A3:1 Bb3:1 B3:1 C4:1 | C#4:4"
HOOP_HERS = "-:8 | F5:.5 Bb5:.5 -:.5 Db6:.5 C6:1 Bb5:1 | Ab5:2/3 F5:2/3 Db5:2/3 Bb4:2 | A5:1.5 C#6:.5 E6:1 D6:1 | C#6:2/3 B5:2/3 A5:2/3 E5:2 | A5:1 Bb5:1 B5:1 C6:1 | C#6:4"
# The build: the calliope's call, the show's hop climbing the dominant chord a note a bar.
CALL = "A4:.5 E5:.5 -:.5 C#5:.5 E5:.5 G5:.5 -:1 | C#5:.5 G5:.5 -:.5 E5:.5 G5:.5 A5:.5 -:1 | E5:.5 A5:.5 -:.5 G5:.5 A5:.5 C#6:.5 E6:1"
# The last balloon: his line sinking home.
LAST = "Bb4:3 A4:1 | G4:3 E4:1 | D4:4 | C#4:3 -:1"
for _line, _beats in ((TUNE, 32), (WORDS, 32), (SHOWN, 32), (BELL_IN, 20), (TWIST, 8), (TWIST_END, 4), (BELL_SLOW, 32), (HOOP_HIS, 32), (HOOP_HERS, 32), (CALL, 12), (LAST, 16)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=239, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(97)
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

    def murk(k, cut):
        """Noise with its highs rolled off."""
        w = max(2, int(sr / cut / 2))
        soft = np.convolve(rng.uniform(-1, 1, k + 2 * w), np.ones(w) / w, "same")[w : w + k]
        return soft / (np.sqrt(np.mean(soft**2)) + 1e-9) * 0.5

    def crunch(w, rate=11000, steps=24):
        """A sampled drum as the old console played it: few samples a second, few levels."""
        hold = max(1, int(sr / rate))
        return np.round(np.repeat(w[::hold], hold)[: len(w)] * steps) / steps

    def chord(name):
        name, _, shift = name.partition("+")
        low, keys = TENT[name]
        up = int(shift or 0)
        return n(low) + up, [n(c) + up for c in keys.split()]

    of = lambda bar: chord(CHORDS[(bar - 1) % BARS])
    plain = lambda bar: CHORDS[(bar - 1) % BARS].partition("+")[0]

    # ---- the kit: a console's sampled drums ----
    def kick(b, vol=0.5):
        k = int(0.26 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(48 + 110 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.1)) + 0.3 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.24, ghost=False):
        k = int((0.07 if ghost else 0.2) * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(190 + 70 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.04)
        put("snare", b, crunch(0.8 * body + 0.9 * hiss(k, 8000, 0.5) * np.exp(-t / (0.02 if ghost else 0.075))) * tail(k) * vol, 0.05)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        k = int((0.18 if open_ else 0.04) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / (0.06 if open_ else 0.01)) * tail(k, 0.004) * vol, pan)

    def roll(b, length, soft=0.03, loud=0.2):
        """The ring's drum roll: 32nds, swelling."""
        count = int(round(length * 8))
        for i in range(count):
            snare(b + i / 8, soft + (loud - soft) * (i / max(1, count - 1)) ** 1.6, ghost=True)

    def crash(b, vol=0.1):  # (`vol` as the hats': the bus is turned well up)
        """Ta-da: a cymbal, caught at once."""
        k = int(0.45 * sr)
        t = np.arange(k) / sr
        put("hats", b, (hiss(k, 14000, 0.7) + 0.6 * hiss(k, 7000, 0.4)) * np.exp(-t / 0.11) * np.minimum(1, t / 0.002) * tail(k, 0.02) * vol * 0.4, 0.0)

    def thud(b, vol=0.4):
        """A heartbeat: a deep, soft thump, and its second, softer."""
        for late, loud in ((0.0, 1.0), (0.75, 0.6)):
            k = int(0.3 * sr)
            t = np.arange(k) / sr
            put("sub", b + late, np.sin(tau * np.cumsum(44 + 50 * np.exp(-t / 0.03)) / sr) * np.exp(-t / 0.09) * np.minimum(1, t / 0.004) * tail(k) * vol * loud)

    # ---- his sounds, as the game builds them (packages/app/src/characters/tiger-sounds.ts) ----
    def pump(b, vol=0.07, pan=-0.3):
        """The pump's plunger: a soft rubbery fwump, a low thud at its foot."""
        k = int(0.14 * sr)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / sr
        knock = np.sin(tau * np.cumsum(110 + 60 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.04)
        put("fx", b, (1.8 * murk(k, 700) + 0.5 * knock) * np.sin(np.pi * u) * vol, pan)

    def squeak(b, m, vol=0.105, pan=0.2):
        """Balloon rubber: a thin note wobbling up into its pitch."""
        k = int(0.12 * sr)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * (0.7 + 0.3 * u) * (1 + 0.05 * np.sin(tau * 17 * t))) / sr
        put("squeak", b, (0.9 * np.sin(ph) + 0.8 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph) + 0.1 * np.sin(4 * ph)) * np.sin(np.pi * u) ** 0.7 * vol, pan)

    def pop(b, vol=0.18):
        """A balloon popping: a sharp crack of air, a quick snap of rubber after it."""
        k = int(0.18 * sr)
        t = np.arange(k) / sr
        put("fx", b, (1.1 * hiss(k, 9000, 0.3) * np.exp(-t / 0.012) + 0.7 * murk(k, 1800) * np.exp(-t / 0.05)) * np.minimum(1, t / 0.001) * tail(k) * vol)

    def poof(b, vol=0.12):
        """A balloon landing as a piece: a soft puff of smoke."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        put("fx", b, murk(k, 900) * np.minimum(1, t / 0.02) * np.exp(-t / 0.09) * tail(k) * vol * 2)

    def voiced(k, f0, f1, f2, breath, env):
        """A big cat's voice: a buzz at `f0` (Hz, by the sample) through two formants (`f1`, `f2`), air in it."""
        ph = tau * np.cumsum(f0) / sr
        w = np.zeros(k)
        for h in range(1, 25):
            w += np.sin(h * ph) / h * (1.5 / np.sqrt(1 + ((h * f0 - f1) / 110) ** 2) + 0.7 / np.sqrt(1 + ((h * f0 - f2) / 170) ** 2))
        return (w + breath * murk(k, 1300)) * env

    def yawn(b, vol=0.1, pan=0.0):
        """A big, bored, breathy yawn: the jaw opening on a long rising "aaah", then falling away into a sigh."""
        k = int(1.0 * sr)
        t = np.arange(k) / sr
        f0 = np.where(t < 0.45, 92 + 58 * t / 0.45, 150 - 80 * (t - 0.45) / 0.55)
        f1 = np.where(t < 0.5, 380 + 320 * t / 0.5, 700 - 280 * (t - 0.5) / 0.5)
        f2 = np.where(t < 0.5, 900 + 250 * t / 0.5, 1150 - 390 * (t - 0.5) / 0.5)
        env = np.minimum(1, t / 0.12) * np.clip((1.0 - t) / 0.3, 0, 1)
        put("fx", b, voiced(k, f0, f1, f2, 0.5, env) * vol, pan)

    def growl(b, vol=0.1):
        """A growl he can't be bothered to make a roar: low, rough, short, trailing off."""
        k = int(0.5 * sr)
        t = np.arange(k) / sr
        rough = 0.6 + 0.4 * np.sin(tau * 31 * t) * np.sin(tau * 7 * t)
        put("fx", b, voiced(k, 82 - 14 * np.minimum(1, t / 0.45), np.full(k, 420.0), np.full(k, 900.0), 0.3, np.minimum(1, t / 0.05) * np.clip(1 - t / 0.5, 0, 1) ** 1.2 * rough) * vol)

    def flame(b, vol=0.09, pan=0.0):
        """A burning hoop: a whoosh of fire, crackling."""
        k = int(0.9 * sr)
        u = np.linspace(0, 1, k)
        t = np.arange(k) / sr
        crackle = (rng.uniform(0, 1, k) > 0.9993) * rng.uniform(0.4, 1, k)
        crackle = np.convolve(crackle, np.exp(-np.arange(int(0.004 * sr)) / (0.0012 * sr)), "same")
        put("fx", b, ((murk(k, 500) + 0.5 * hiss(k, 5000, 0.3) * u**0.5) * np.sin(np.pi * u) ** 1.2 + 0.5 * crackle * (1 - u)) * vol, pan)

    # ---- the band's voices ----
    def pluck(b, m, long=0.25, kind="n", vol=0.4, hold=0.1):
        """The FM bass: plucked, rubbery, bright only on its front. A pop is brighter; a ghost is a muted thud."""
        at(b, long)
        k = x.k(long) + int(0.03 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        if kind == "g":
            w = (0.6 * np.sin(ph) + 0.5 * murk(k, 900)) * np.exp(-t / 0.02)
        else:
            w = np.sin(ph + ((4.5 if kind == "p" else 3.0) * np.exp(-t / 0.045) + 0.6) * np.sin(ph)) * (hold + (1 - hold) * np.exp(-t / 0.09))
        put("bass", b, w * np.minimum(1, t / 0.001) * tail(k, 0.03) * vol)

    def boom(b, m, length, vol=0.5):
        """A deep drum with a note in it, for the hoops."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env) * vol)

    def wobble(b, m, length, vol=0.2):
        """A low buzz whose brightness swings twice a beat."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        f = x.hz(m)
        ph = tau * f * t
        cut = 180 + 800 * (0.5 - 0.5 * np.cos(tau * 2 / x.beat_s * t))
        w = sum(np.sin(h * ph) / h / np.sqrt(1 + (h * f / cut) ** 4) for h in range(1, 15))
        put("sub", b, w * np.minimum(1, t / 0.01) * tail(k, 0.04) * vol)

    REED = (1, 0.1, 0.55, 0.08, 0.3, 0.05, 0.15)  # the band organ's short chords: the odd harmonics
    PIPES = (1, 0.7, 0.45, 0.3, 0.12, 0.08)  # the pipe organ: its ranks an octave, a twelfth, two octaves up
    STEAM = (1, 0.55, 0.4, 0.18, 0.1)  # the calliope's whistles

    def jab(b, ms, vol=0.05, pan=-0.2):
        """The band organ's short chord: an 80 ms note, cut off."""
        k = int(0.092 * sr)
        t = np.arange(k) / sr
        w = np.zeros(k)
        for m in ms:
            ph = tau * x.hz(m) * t
            w += sum(a * np.sin((h + 1) * ph + 0.7 * h) for h, a in enumerate(REED))
        put("organ", b, w / len(ms) * (0.75 + 0.25 * np.exp(-t / 0.03)) * np.minimum(1, t / 0.002) * tail(k, 0.012) * vol, pan)

    def pipes(bar, vol=0.03, length=4.0, voices=4):
        """The pipe organ holding the bar's chord (its lowest `voices` notes) over its bass note: no beating reeds, a slow tremulant."""
        low, keys = of(bar)
        at(bar0(bar), length)
        for j, m in enumerate([low + 12] + keys[:voices]):
            put("pad", bar0(bar), x.tone(m, length * 0.98, list(PIPES), vol, attack=0.12, release=0.2, trem=0.06, trem_hz=4.5), (0.0, -0.5, -0.15, 0.15, 0.5)[j])

    def purred(start, text, vol=1.0, pan=-0.1, up=0):
        """Babur: the gritty synth, a cat's purr (its loudness fluttering 24 times a second) in its longer notes."""
        for b, d, m in notes(start, text):
            b, d = float(b), float(d)
            at(b, d)
            w = x.gritty(m + up, d * 0.95, 0.21 * vol)
            if d >= 1.0:
                w = w * (0.8 + 0.2 * np.sin(tau * 24 * np.arange(len(w)) / sr))
            put("purr", b, w, pan)

    def calliope(start, text, vol=1.0, pan=0.15, up=0):
        """The calliope: a steam whistle's plain note, short and cut off; a long one trembles."""
        for b, d, m in notes(start, text):
            b, d = float(b), float(d)
            at(b, d)
            put("calliope", b, x.tone(m + up, d * (0.7 if d <= 0.5 else 0.92), list(STEAM), 0.11 * vol, attack=0.006, release=0.015, trem=0.08 if d >= 1 else 0.0, trem_hz=6.0), pan)

    def ding(b, m, vol=0.05, pan=0.3, long=0.5):
        """The glassy bell: its overtones the note's own harmonics, so it is never sour over a chord."""
        b = float(b)
        at(b, 2)
        k = int((3 * long + 0.2) * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("bell", b, np.sin(ph + 1.3 * np.exp(-t / (long / 2)) * np.sin(3 * ph)) * np.exp(-t / long) * np.minimum(1, t / 0.002) * tail(k, 0.2) * vol, pan)

    def rung(start, text, vol=0.05, pan=0.3, long=0.5, up=0):
        for b, d, m in notes(start, text):
            ding(b, m + up, vol, pan, long)

    def ghost(b, steps, vol=0.058, pan=-0.35):
        """The ghost whistle, one breath: a plain high note that glides to each next one (`steps`: note, beats) and
        wavers more the longer it's held."""
        total = sum(d for _, d in steps)
        at(b, total)
        k = x.k(total)
        t = np.arange(k) / sr
        f = np.zeros(k)
        pos = 0
        for i, (name, d) in enumerate(steps):
            end = k if i == len(steps) - 1 else pos + x.k(d)
            f[pos:end] = x.hz(n(name))
            pos = end
        g = int(0.2 * sr)
        f = np.exp(np.convolve(np.log(np.concatenate([np.full(g, f[0]), f, np.full(g, f[-1])])), np.ones(g) / g, "same")[g:-g])
        ph = tau * np.cumsum(f * (1 + 0.012 * np.minimum(1, t / 0.6) * np.sin(tau * 6.5 * t))) / sr
        put("ghost", b, (np.sin(ph) + 0.12 * np.sin(2 * ph)) * np.minimum(1, t / 0.25) * tail(k, 0.5) * vol, pan)

    def xylo(b, m, vol=0.07, pan=-0.35):
        """A toy xylophone's bar: a knock, a short note, its twelfth."""
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        w = np.sin(tau * f * t) * np.exp(-t / 0.09) + 0.35 * np.sin(tau * 3 * f * t) * np.exp(-t / 0.03) + 0.2 * np.sin(tau * 6.3 * f * t) * np.exp(-t / 0.012)
        put("xylo", b, w * np.minimum(1, t / 0.0008) * tail(k) * vol, pan)

    # ---- the band, bar by bar ----
    def prowling(bar, vol=1.0, ghosts=True):
        """The kit's prowl: the kick's pattern (two bars about), the snare on 2 and 4, closed hats on the 8ths."""
        b = bar0(bar)
        kicks, soft, taps = KIT[bar % 2]
        for i in kicks:
            kick(b + i / 4, 0.5 * vol)
        snare(b + 1, 0.24 * vol), snare(b + 3, 0.24 * vol)
        for i in range(8):
            hat(b + i * 0.5, (0.034 if i % 2 == 0 else 0.022) * vol)
        if ghosts:
            for i in soft:
                kick(b + i / 4, 0.26 * vol)
            for i in taps:
                snare(b + i / 4, 0.07 * vol, ghost=True)

    def driving(bar, vol=1.0, sixteenths=True):
        """The kit under the show: the kick on 1 and 3 with a push before each, the snare on 2 and 4, hats in 16ths."""
        b = bar0(bar)
        for i, loud in ((0, 0.5), (7, 0.3), (8, 0.5), (14, 0.28)):
            kick(b + i / 4, loud * vol)
        snare(b + 1, 0.24 * vol), snare(b + 3, 0.24 * vol)
        for i in range(16 if sixteenths else 8):
            step = i / 4 if sixteenths else i / 2
            hat(b + step, (0.03 if (i % 4 == 0 or not sixteenths) else 0.018 if i % 2 == 0 else 0.008) * vol)

    def riff(bar, pattern, vol=1.0, lead=True):
        """The bass's bar: its riff over the bar's note, and a note a half step under the next bar's on the last 8th."""
        b = bar0(bar)
        low = of(bar)[0]
        for i, over, kind in pattern:
            pluck(b + i / 4, low + over, 0.22, kind, 0.42 * vol)
        if lead:
            pluck(b + 3.5, of(bar + 1)[0] - 1, 0.22, "n", 0.36 * vol)

    def prowl(bar, vol=1.0, jabs=True):
        """A bar of the prowl: the kit, the bass's riff (its second on the far chord), the organ's short chords."""
        far = plain(bar) in SWINGS
        prowling(bar, vol), riff(bar, RIFF_2 if far else RIFF_1, vol)
        if jabs:
            for i in ((3, 6, 12) if far else (6, 12)):
                jab(bar0(bar) + i / 4, of(bar)[1], 0.05 * vol)

    def show(bar, vol=1.0):
        """A bar of the show: the kit driving, the bass bouncing in octaves, the organ on the off-beats."""
        driving(bar, vol), riff(bar, BOUNCE, vol)
        for i in (2, 6, 10, 14):
            jab(bar0(bar) + i / 4, of(bar)[1], 0.05 * vol)

    def balloon(bars_, lands, at_beat):
        """A balloon: a pump stroke at the start of each of `bars_`, a squeak after the last, and at `at_beat` it lands
        (a puff) or pops."""
        for bar in bars_:
            pump(bar0(bar))
        squeak(bar0(bars_[-1]) + 1, n("A5"), 0.045, -0.3)
        poof(at_beat) if lands else pop(at_beat)

    # Bars 1-8: the first balloon. A heartbeat; the bell's three notes, the ghost whistle answering; the pump. Then the
    # bell says them more and more often (an 8th a note, then a 16th), the ring's drum rolls, and it lands: ta-da.
    for bar in range(1, 7):
        thud(bar0(bar), 0.55)
    rung(0, BELL_IN, 0.085)
    cell = [n(c) for c in CELL]
    for i in range(8):
        ding(bar0(6) + i / 2, cell[i % 3], 0.07, 0.3, 0.3)
    for i in range(28):
        ding(bar0(7) + i / 4, cell[(i + 2) % 3] + (12 if i >= 16 else 0), 0.045 + 0.001 * i, 0.3 * np.cos(i), 0.15)
    ghost(bar0(2), [("C#6", 2.5), ("A5", 1.5)], 0.075), ghost(bar0(4), [("D6", 2.5), ("Bb5", 1.5)], 0.075)
    pipes(7, 0.02, 4.0, 2), pipes(8, 0.028, 3.0, 4)
    roll(bar0(7), 7, 0.02, 0.2)
    balloon((1, 3, 5, 7), True, bar0(8) + 3)
    kick(bar0(8) + 3), crash(bar0(8) + 3, 0.12), jab(bar0(8) + 3, of(8)[1], 0.08), pluck(bar0(8) + 3, of(8)[0], 0.5, "n", 0.45)

    # Bars 9-24: the prowl. His tune, low, with the bass and the kit; then again an octave up, the calliope's quick
    # words in his gaps.
    for bar in range(9, 25):
        prowl(bar, 1.0, jabs=bar >= 11)
    purred(bar0(9), TUNE, 1.0, up=-12)
    purred(bar0(17), TUNE, 1.0), calliope(bar0(17), WORDS, 0.9)

    # Bars 25-32: the show: the calliope's tune.
    for bar in range(25, 33):
        show(bar)
    crash(bar0(25), 0.07), calliope(bar0(25), SHOWN)
    for bar in (28,):
        pipes(bar, 0.02)

    # Bars 33-40: balloon twisting. The dry kit, the bass, the squeaks' riff (a fourth up over the G); the pump; on
    # the last beat it pops, and nothing plays under the pop.
    for bar in range(33, 41):
        b = bar0(bar)
        last = bar == 40
        kick(b), kick(b + 2.5, 0.4), snare(b + 1, 0.22)
        if not last:
            snare(b + 3, 0.22)
        for i in range(6 if last else 8):
            hat(b + i * 0.5, 0.03 if i % 2 == 0 else 0.02)
        riff(bar, SPARSE, 0.95, lead=not last)
    for first, up in ((33, 0), (35, 0), (37, 5)):
        for b, d, m in notes(bar0(first), TWIST):
            squeak(b, m + up)
    for b, d, m in notes(bar0(39), TWIST.split(" | ")[0]):
        squeak(b, m)
    for b, d, m in notes(bar0(40), TWIST_END):
        squeak(b, m)
    balloon((33, 35, 37, 39), False, bar0(40) + 3)

    # Bars 41-48: the calm. No kit: a heartbeat; the pipe organ's chords, a major third apart; the bell's slow tune;
    # the whistle's long notes, each falling to a deeper one; the pump; it lands softly, and a few taps start the chase.
    for bar in range(41, 49):
        thud(bar0(bar), 0.3), pipes(bar, 0.02)
    rung(bar0(41), BELL_SLOW, 0.075, 0.2, 0.7)
    ghost(bar0(43), [("C#6", 5), ("F#5", 3)]), ghost(bar0(47), [("A5", 4.5), ("E5", 2.5)])
    balloon((41, 43, 45, 47), True, bar0(48) + 3)
    for i in range(4):
        snare(bar0(48) + 3 + i / 4, 0.08 + 0.04 * i, ghost=True)

    # Bars 49-56: the chase. The calliope and the toy xylophone trade a cell five 16ths long (the chord's fifth, the
    # note under it, the fifth, down to its root; the xylophone's is the same the other way about), so it lands
    # somewhere new in the bar each time. The bass runs and creeps up; at the end he growls.
    for bar in range(49, 57):
        b = bar0(bar)
        driving(bar, 1.0, sixteenths=bar < 55), riff(bar, BOUNCE, 1.0)
        for i in (2, 6, 10, 14):
            jab(b + i / 4, of(bar)[1], 0.045)
        if bar >= 55:
            for i in range(16):
                snare(b + i / 4, 0.03 + 0.004 * i + (0.03 if bar == 56 else 0), ghost=True)
    for i in range(25):
        b = bar0(49) + 1.25 * i
        root, fifth = (n(c) for c in CHASE[plain(49 + int(1.25 * i // 4))])
        if i % 2 == 0:
            for late, m, d in ((0, fifth, 0.25), (0.25, fifth - 1, 0.25), (0.5, fifth, 0.25), (0.75, root, 0.5)):
                at(b + late, d)
                put("calliope", b + late, x.tone(m, d * 0.7, list(STEAM), 0.1, attack=0.006, release=0.015), 0.15)
        else:
            for late, m in ((0, root), (0.5, fifth), (0.75, fifth - 1), (1.0, fifth)):
                xylo(b + late, m, 0.12)
    growl(bar0(56) + 2.5, 0.12)

    # Bars 57-64: the hoops (the drop, half-time). Three hoops of fire; a deep drum with the bar's note in it; the
    # snare on 3; a buzz under the last four bars. His two bars, the calliope's two, two together, and two climbing.
    for bar in range(57, 65):
        b = bar0(bar)
        low = of(bar)[0]
        boom(b, low, 2.5, 0.4), kick(b, 0.5), kick(b + 2.5, 0.35), snare(b + 2, 0.3)
        for i in range(4):
            hat(b + i, 0.03)
        if bar >= 61:
            wobble(b, low, 4.0, 0.1)
        if bar < 63:
            pipes(bar, 0.02)
        if bar in (59, 60):
            for i in (6, 14):
                jab(b + i / 4, of(bar)[1], 0.04)
    for bar, pan in ((57, -0.5), (59, 0.5), (61, 0.0)):
        flame(bar0(bar), 0.09, pan)
    crash(bar0(57), 0.1)
    purred(bar0(57), HOOP_HIS, 1.05), calliope(bar0(57), HOOP_HERS, 1.0)
    roll(bar0(64), 4, 0.03, 0.14)

    # Bars 65-68: the build to a roar: the bass pounding the dominant, the organ swelling a note a bar (and the pump),
    # the calliope's call climbing, the drum's roll ... and in the fourth bar nothing but his yawn, and the calliope's two notes into the finale.
    for bar in range(65, 68):
        b = bar0(bar)
        low, keys = of(bar)
        for i in range(8):
            pluck(b + i / 2, low + (12 if i % 2 else 0), 0.22, "p" if i % 2 else "n", 0.4 + 0.02 * (bar - 65))
        driving(bar, 0.9 + 0.08 * (bar - 65))
        pipes(bar, 0.022 + 0.006 * (bar - 65), 4.0, bar - 63)
        pump(b)
    roll(bar0(65), 12, 0.03, 0.22), calliope(bar0(65), CALL, 1.0)
    crash(bar0(68), 0.1), kick(bar0(68))
    yawn(bar0(68) + 0.75, 0.06)
    calliope(bar0(68) + 3, "D5:.5 F#5:.5", 0.9)

    # Bars 69-84: the finale, a fourth up. The show's tune on the calliope with him under it an octave and more down,
    # the organ behind; then his tune, the calliope's words in his gaps.
    for bar in range(69, 77):
        show(bar, 1.05), pipes(bar, 0.018)
    crash(bar0(69), 0.1)
    calliope(bar0(69), SHOWN, 1.0, up=5), purred(bar0(69), SHOWN, 0.6, up=5 - 24)
    for bar in range(77, 85):
        prowl(bar, 1.05)
    purred(bar0(77), TUNE, 1.05, up=5), calliope(bar0(77), WORDS, 0.95, up=5)

    # Bars 85-88: the last balloon. Four strokes; the kit thinning, the bass a note a bar; his line sinking home; the
    # drum's roll; and on the last beat it pops, with nothing under it: bar 1's hush comes next.
    for bar in range(85, 89):
        b = bar0(bar)
        low = of(bar)[0]
        pluck(b, low, 2.5, "n", 0.42, 0.5), kick(b)
        if bar < 87:
            snare(b + 2, 0.22)
            for i in range(8):
                hat(b + i * 0.5, 0.028 if i % 2 == 0 else 0.018)
        pipes(bar, 0.02 + 0.004 * (bar - 85), 3.0 if bar == 88 else 4.0, bar - 84)
    purred(bar0(85), LAST, 0.95)
    roll(bar0(88), 3, 0.02, 0.16)
    balloon((85, 86, 87, 88), False, bar0(88) + 3)

    # A hall for the organ, the bell and the whistle; a little for the calliope; none for the kit, the bass or him.
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
    x.echo("bell", 0.75, 0.22, 0.1), x.echo("ghost", 1.5, 0.2, 0.08), x.echo("calliope", 0.75, 0.1, 0.04), x.echo("squeak", 0.75, 0.14, 0.05)
    for name, secs, wet in (("pad", 2.4, 0.4), ("bell", 2.0, 0.4), ("ghost", 2.4, 0.5), ("calliope", 1.2, 0.15), ("xylo", 1.2, 0.2)):
        room(name, secs, wet)
    levels = {"purr": 1.0, "calliope": 1.3, "bell": 2.0, "ghost": 2.0, "xylo": 2.0, "squeak": 2.0, "bass": 0.8, "sub": 0.5, "kick": 0.65, "snare": 1.6,
              "hats": 5.0, "organ": 5.0, "pad": 1.4, "fx": 2.0}
    return x.play(x.mixdown(levels, lowpass=8500, room=0.04))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
