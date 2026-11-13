"""Song AC (Eric, Nov 13): Wrangler the cowboy pig's theme, the third go: song AA (his first, biker funk-rock) rebuilt
as an outlaw-biker spaghetti western. Song AB (a Western march with a trumpet) he "didn't care for". For AA he had a
second pair of ears describe what it heard and write up what he wants ("I talked through how it could explain it
better to you what I want because I'm just not good at it ... take the notes and let's redo the first one"). What it
heard in AA: an 80s synth-pop arcade track: a kick on nearly every beat with open hats off the beat (disco), a dry
"mechanical" synth bass, a "polite, clean" lead, the banjo's roll as "shimmering" pop arpeggios, the calm's plucks as
a harpsichord, the slides of the duel as "a wobbly, drunken ambulance siren", and scale runs.
So, its rules, all kept here:
  - no kick on every beat: the kick on 1 and 3 with pickups before them, a heavy snare (a whip's crack) on 2 and 4;
  - no runs of 16ths up and down a scale, no cheerful arpeggios; silence between the phrases;
  - no slow, wide slides: a guitar's note is bent up one or two half steps into place and held, wavering;
  - the bass gallops (an 8th and two 16ths: a thumbed low note, two popped ones an octave over it);
  - a dry guitar strumming (chops off the beat, a Spanish run of three strums at a phrase's end), no pads;
  - the chords he asked for: G minor, F, E flat, D7, two bars each (the Andalusian cadence, as old as flamenco and
    nobody's; its bass steps down under a D that every one of the four chords has);
  - three leads: a "wah" voice that calls (a buzz through a mouth that opens and closes on every note), a lone
    whistle that answers (a glide between notes, a waver, an echo), and in the second half a distorted guitar that
    takes the tune an octave lower, with two-note chords and a solo;
  - the order: a standoff (a bell tolling, timpani, the call, the whistle, a gunshot); the gallop, the call and the
    whistle trading; the guitar's anthem, brass stabs on the D7; a high-noon showdown in stops and starts; the guitar
    and the whistle trading two bars each; and (the recipe's, SOUNDS.md) the tune once more a minor third up, all
    three together.
What is not used: its notes asked for the "iconic" call of a famous western film's theme and gave a line for the
whistle; neither is here. The call, the whistle's lines and the guitar's are written for this song: none of it is
any song's, any film's or any game's (the hard rule). Nor is the first write-up's bass run (minor third, major
third, fourth, fifth), which its notes asked for again: this bass's turns walk by step to the next chord's note.
About 137 beats a minute, 88 bars, 2:34. Its notes gave 1:30 to 1:45; the first go here was two minutes, and Eric: "I
didn't realize that the AI said to make it shorter. Can you actually make it like 2 minutes 30, 2 minutes 40". What
the longer one has more: a chorus (the round begun from B flat, the whistle's own tune), four more bars of high noon
before its hits, and the guitar's solo (short licks, bends, rests: no runs).
His world: the showdown (the stops and starts, the silence, the shot), his spurs, a snort and his laugh, quiet.
  python3 song_ac.py <out.wav>

  bars  1-8    0:00  the standoff: a bell tolling, timpani, the call, the whistle; his spurs, a snort; a gunshot
  bars  9-24   0:14  the gallop: the call and the whistle trade, two bars each
  bars 25-32   0:42  the chorus: the whistle's tune over the round begun from B flat, the call's voice in its rests
  bars 33-48   0:56  the guitar's anthem: the first tune an octave lower, two guitars the second time; brass on the D7
  bars 49-60   1:24  high noon: the bell and the whistle far off; then the band's hits and silences; a shot
  bars 61-68   1:45  the guitar and the whistle trade two bars each
  bars 69-76   1:59  the guitar's solo
  bars 77-84   2:13  the tune a minor third up: the call, the whistle and the guitar together
  bars 85-88   2:27  the turn home: hits on D7, a timpani roll into the bell
"""
import sys

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BARS = 88
BEATS = 4 * BARS
TAPE = 154.0  # 137 beats a minute
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, 137, 137, 1.0, 1.0, 0.0)]

# A chord: its bass note; the strummed guitar's five strings (the top one is the D that never moves).
TOWN = {
    "Gm": ("G2", "G3 D4 G4 Bb4 D5"),
    "Bb": ("Bb2", "Bb3 D4 F4 Bb4 D5"),
    "F": ("F2", "F3 C4 F4 A4 D5"),
    "Eb": ("Eb2", "Eb3 Bb3 G4 Bb4 D5"),
    "D7": ("D2", "D3 A3 F#4 C5 D5"),
}
ROUND = "Gm Gm F F Eb Eb D7 D7"
LIFT = "Bb Bb F F Eb Eb D7 D7"  # the chorus: the round begun from B flat
CHORDS = (
    f"Gm Gm Gm Gm Gm Gm Gm Gm  {ROUND}  {ROUND}  {LIFT}  {ROUND}  {ROUND}  Gm Gm Gm Gm  Gm Gm D7 D7 Gm Eb D7 D7  {ROUND}  {ROUND}  "
    + " ".join(c + "+3" for c in ROUND.split())
    + "  D7 D7 D7 D7"
).split()
assert len(CHORDS) == BARS, len(CHORDS)

# ---- the lines. Lengths in beats; 2/3 is a note of three-across-two, .25 a 16th. Rests between the phrases. ----
# The call (the "wah" voice): two quick notes and a long high one; then two more, the second held.
CALL1 = "Bb5:.25 G5:.25 D6:2.5 -:1 | F5:.5 G5:2.5 -:1"
CALL2 = "G5:.25 Eb5:.25 Bb5:2.5 -:1 | D5:.5 Eb5:2.5 -:1"
# The whistle's answers: over F, and over D7 (the Spanish turn, then a leap).
ANS1 = "-:.5 A5:.5 C6:1 D6:1.5 C6:.5 | A5:1 G5:.5 F5:.5 A5:2"
ANS2 = "A5:.5 Bb5:.5 A5:.5 F#5:.5 Eb5:1 D5:1 | F#5:.5 A5:.5 D6:2 -:1"
ANS3 = "C6:.5 D6:.5 -:.5 C6:.5 A5:1 F5:1 | A5:2/3 C6:2/3 A5:2/3 G5:2"
ANS4 = "D6:1.5 C6:.5 Bb5:.5 A5:.5 F#5:1 | A5:.5 F#5:.5 D5:2 -:1"
# The standoff's whistle, over the bell.
LONE = "-:1 D6:2 Bb5:.5 C6:.5 | G5:1.5 F5:.5 G5:2"
# The chorus: the whistle's tune (three bars and a breath, twice, then the turn), and the call's voice in its rests.
CHOR = (
    "F5:.5 Bb5:.5 D6:2.5 C6:.5 | Bb5:1 F5:2/3 G5:2/3 Bb5:2/3 C6:1 | A5:2.5 F5:.5 C5:.5 F5:.5 | A5:1.5 C6:.5 A5:1 -:1 | "
    "G5:.5 Bb5:.5 Eb6:2 D6:1 | Bb5:1.5 G5:.5 Bb5:1 -:1 | A5:1 F#5:.5 A5:.5 D6:2 | C6:.5 A5:.5 F#5:1 -:2"
)
CHOR_WAH = "-:4 | -:4 | -:4 | -:3 C5:.5 F5:.5 | -:4 | -:3 Bb4:.5 Eb5:.5 | -:4 | -:2 D5:.5 F#5:.5 A5:1"
# High noon: the whistle far off (over the bell, then between the hits).
NOON0 = "-:1 D6:2.5 -:.5 | -:4 | -:1 Bb5:1.5 A5:1.5 | G5:3 -:1"
NOON = "-:4 | -:1 D6:2.5 -:.5 | -:4 | -:1 C6:.5 A5:.5 F#5:2 | -:4 | -:1 Bb5:2 G5:1 | -:4 | -:4"
# The guitar's licks and the whistle's replies, two bars each.
LICK1 = "G4:.5 Bb4:.5 -:.5 C5:.25 D5:.25 F5:1.5 -:.5 | D5:2/3 F5:2/3 D5:2/3 C5:.5 Bb4:.5 G4:1"
REPLY1 = "C6:1.5 A5:.5 F5:1 -:1 | G5:.5 A5:.5 C6:2 -:1"
LICK2 = "Bb4:.5 Bb4:.5 -:.5 D5:.5 G5:1.5 -:.5 | F5:.5 Eb5:.5 -:.5 D5:.5 Bb4:1 G4:1"
REPLY2 = "A5:.5 C6:.5 Eb6:1 D6:1 -:1 | F#5:.5 A5:.5 D6:2 -:1"
# The guitar's solo: licks and breaths, a bend into each long note.
SOLO = (
    "D5:.5 F5:.5 G5:2 -:1 | Bb5:2/3 G5:2/3 F5:2/3 G5:1.5 -:.5 | A5:1.5 C6:.5 A5:.5 F5:.5 -:1 | C5:.5 F5:.5 A5:.5 C6:2 -:.5 | "
    "Bb5:.5 Bb5:.5 -:.5 G5:.5 Eb5:1 G5:1 | Bb5:2/3 G5:2/3 Eb5:2/3 D5:2 | F#5:.5 A5:.5 C6:1.5 -:.5 A5:.5 C6:.5 | D6:3 -:1"
)
for _line, _beats in ((CHOR, 32), (CHOR_WAH, 32), (NOON0, 16), (SOLO, 32), (CALL1, 8), (CALL2, 8), (ANS1, 8), (ANS2, 8), (ANS3, 8), (ANS4, 8), (LONE, 8), (NOON, 32), (LICK1, 8), (REPLY1, 8), (LICK2, 8), (REPLY2, 8)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that
    passage (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=223, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(83)
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

    def band(w, f, q):
        """A sound ringing at `f` Hz (through a resonance `q` sharp), at the level it came in at."""
        secs = q / (np.pi * f)
        t = np.arange(int(5 * secs * sr)) / sr
        out = np.convolve(w, np.sin(tau * f * t) * np.exp(-t / secs), "same")
        return out / (np.sqrt(np.mean(out**2)) + 1e-9) * np.sqrt(np.mean(w**2))

    def chord(name):
        name, _, shift = name.partition("+")
        low, strings = TOWN[name]
        up = int(shift or 0)
        return n(low) + up, [n(c) + up for c in strings.split()]

    of = lambda bar: chord(CHORDS[(bar - 1) % BARS])

    # ---- the kit: a rock kit ----
    def kick(b, vol=0.5):
        k = int(0.28 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.7 * np.sin(tau * np.cumsum(46 + 120 * np.exp(-t / 0.018)) / sr) * np.exp(-t / 0.11)) + 0.35 * hiss(k, 6000, 0.5) * np.exp(-t / 0.002)
        put("kick", b, w * tail(k) * vol)

    def crack(b, vol=0.3):
        """The snare: heavy, a whip's crack on its front, and its slap off a wall."""
        k = int(0.32 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(205 + 90 * np.exp(-t / 0.008)) / sr) * np.exp(-t / 0.05)
        w = (0.75 * body + 1.0 * hiss(k, 11000, 0.55) * np.exp(-t / 0.1) + 0.9 * hiss(k, 16000, 0.8) * np.exp(-t / 0.006)) * tail(k)
        put("snare", b, w * vol, 0.05), put("snare", b, w * vol * 0.22, -0.3, late=0.07)

    def tap(b, vol=0.08):
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("snare", b, (0.5 * np.sin(tau * 215 * t) * np.exp(-t / 0.02) + hiss(k, 9000, 0.6) * np.exp(-t / 0.018)) * tail(k) * vol, 0.05)

    def shot(b, vol=0.5):
        """A gunshot: a crack, a boom under it, and its echoes off the street."""
        k = int(0.7 * sr)
        t = np.arange(k) / sr
        w = (hiss(k, 14000, 0.4) * np.exp(-t / 0.012) * 1.4 + hiss(k, 5000, 0.2) * np.exp(-t / 0.11) + 0.9 * np.sin(tau * np.cumsum(55 + 140 * np.exp(-t / 0.02)) / sr) * np.exp(-t / 0.12)) * tail(k, 0.05)
        for late, loud, pan in ((0.0, 1.0, 0.0), (0.13, 0.3, -0.5), (0.29, 0.16, 0.5), (0.47, 0.08, -0.3)):
            put("fx", b, w * vol * loud, pan, late=late)

    def hat(b, vol=0.03, pan=0.3):
        k = int(0.04 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / 0.01) * tail(k, 0.004) * vol, pan)

    def jingle(b, vol=0.02, pan=0.4):
        """A tambourine's shake."""
        k = int(0.06 * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 15000, 0.9) * np.sin(np.pi * np.minimum(1, t / 0.03)) ** 2 * np.exp(-t / 0.02) * vol, pan)

    def tom(b, m, vol=0.3, pan=0.0):
        k = int(0.35 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.35 * np.exp(-t / 0.025))) / sr) * np.exp(-t / 0.13) + 0.3 * hiss(k, 3000) * np.exp(-t / 0.008)
        put("toms", b, w * tail(k) * vol, pan)

    def fill(b, pitches=(55, 55, 50, 45)):
        for i, m in enumerate(pitches):
            tom(b + i * 0.25, m, 0.24 + 0.03 * i, {55: 0.3, 50: 0.0, 45: -0.3}[m])

    def roll(b, length, m, vol0, vol1):
        """Timpani rolled, swelling."""
        count = int(length * 8)
        for i in range(count):
            put("timp", b + i / 8, x.timp(m, 0.6, vol0 + (vol1 - vol0) * i / max(1, count - 1)))

    # ---- his sounds, as the game builds them (packages/app/src/characters/pig-sounds.ts), and the street's ----
    def clink(b, vol=0.03, pan=0.3):
        """A spur: a dull clink."""
        k = int(0.07 * sr)
        t = np.arange(k) / sr
        put("fx", b, (np.sin(tau * 2100 * t) + 0.6 * np.sin(tau * 3350 * t + 1) + 0.3 * murk(k, 3000)) * np.exp(-t / 0.014) * np.minimum(1, t / 0.0005) * tail(k) * vol, pan)

    def stomp(b, vol=0.3):
        """His boot coming down, the spur with it."""
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        put("kick", b, (np.sin(tau * np.cumsum(50 + 60 * np.exp(-t / 0.02)) / sr) + 1.1 * murk(k, 900) * np.exp(-t / 0.03)) * np.exp(-t / 0.09) * tail(k) * vol)
        clink(b, 0.06 * vol)

    def snort(b, vol=0.05, pitch=120.0, secs=0.16, pan=-0.2, late=0.0):
        """One snort: breath through a pig's nose over a short grunt that drops in pitch."""
        k = int(secs * sr)
        u = np.linspace(0, 1, k)
        air = murk(k, 2800)
        ph = tau * np.cumsum(pitch * (1.15 - 0.3 * u)) / sr
        grunt = sum(np.sin(h * ph) / h**1.6 for h in range(1, 9))
        put("pig", b, (band(air, 520, 2.4) * 2 + band(air, 1050, 3.0) * 1.2 + 0.5 * grunt) * np.sin(np.pi * u) ** 0.7 * vol, pan, late=late)

    def laugh(b, vol=0.05):
        for i in range(4):
            snort(b, vol * (1 - 0.12 * i), 135 - 8 * i, 0.09, -0.2, late=0.13 * i)

    def toll(b, m, vol=0.2):
        """A church bell, far off: its hum, its strike note, the minor third over it that bells have, and the rest, each dying in its own time."""
        k = int(4.0 * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        w = sum(a * np.sin(tau * f * r * t + i) * np.exp(-t / d) for i, (r, a, d) in enumerate(
            ((0.5, 0.5, 3.0), (1.0, 1.0, 2.2), (1.19, 0.7, 1.6), (1.5, 0.45, 1.2), (2.0, 0.6, 0.9), (2.51, 0.3, 0.6), (3.01, 0.25, 0.45), (4.1, 0.15, 0.3))))
        put("bell", b, (w + 0.5 * murk(k, 2500) * np.exp(-t / 0.004)) * np.minimum(1, t / 0.002) * tail(k, 0.3) * vol, -0.2)

    # ---- the band's voices ----
    def thumb(b, m, vol=0.42, long=0.5):
        """The bass, thumbed: it drops into its pitch, growls on its front, dies in a seventh of a second."""
        at(b, long)
        k = x.k(long) + int(0.02 * sr)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (0.8 * np.exp(-t / 0.01) / 12)) / sr
        w = np.sin(ph + (2.8 * np.exp(-t / 0.05) + 0.7) * np.sin(ph)) + 0.35 * np.sin(2 * ph + 1.5 * np.exp(-t / 0.03) * np.sin(ph))
        put("bass", b, np.tanh(1.6 * w) * (0.25 + 0.75 * np.exp(-t / 0.14)) * np.minimum(1, t / 0.001) * tail(k, 0.02) * vol)

    def pop(b, m, vol=0.34):
        """The bass, popped: bright, cut off after a twenty-fifth of a second."""
        k = int(0.055 * sr)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("bass", b, (np.sin(ph + 5.0 * np.exp(-t / 0.015) * np.sin(2 * ph)) * np.exp(-t / 0.025) + 0.25 * hiss(k, 8000, 0.5) * np.exp(-t / 0.002)) * np.minimum(1, t / 0.0005) * tail(k, 0.008) * vol)

    def sub(b, m, length, vol=0.5):
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        ph = tau * np.cumsum(x.hz(m) * 2 ** (12 * np.exp(-t / 0.012) / 12)) / sr
        env = np.exp(-t / (length * x.beat_s * 0.6)) * tail(k, 0.02)
        put("sub", b, (np.tanh(2.4 * np.sin(ph) * env) / np.tanh(2.4) + 0.3 * np.sin(2 * ph) * env) * vol)

    plucked = {}

    def string(m, long):
        """One string of the strummed guitar: picked, dry, its highs gone at once."""
        if (m, long) not in plucked:
            k = int((3 * long + 0.05) * sr)
            t = np.arange(k) / sr
            f0 = x.hz(m)
            h = np.arange(1, max(2, min(20, int(6000 / f0)) + 1))
            w = (np.abs(np.sin(np.pi * h * 0.18) / h**1.2)[:, None] * np.sin(np.outer(h, tau * f0 * t) + (np.pi * h * h / len(h))[:, None])
                 * np.exp(-np.outer(1 + 0.35 * h, t) / long)).sum(axis=0)
            w = w / (np.max(np.abs(w)) + 1e-9) + 0.15 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
            plucked[(m, long)] = w * np.minimum(1, t / 0.0008) * tail(k, 0.02)
        return plucked[(m, long)]

    def strum(b, ms, vol=0.06, up_=False, long=0.18, pan=0.3):
        """The guitar's chord, its strings one after another (down, or up from the top)."""
        for j, m in enumerate(ms[::-1] if up_ else ms):
            put("gtr", b, string(m, long) * vol * (0.8 if up_ else 1.0), pan, late=0.007 * j)

    def three(b, ms, vol=0.06):
        """The Spanish run: three strums across a beat (down, up, down), louder, into the next."""
        for i in range(3):
            strum(b + i / 3, ms, vol * (0.7 + 0.15 * i), up_=i == 1, long=0.12)

    chugged = {}

    def chug(b, m, vol=0.1, open_=False, pan=-0.3):
        """A two-note chord on the distorted guitar (the note, its fifth, its octave), muted with the palm; or let ring."""
        if (m, open_) not in chugged:
            k = int((0.4 if open_ else 0.11) * sr)
            t = np.arange(k) / sr
            w = np.zeros(k)
            for over, loud in ((0, 1.0), (7, 0.8), (12, 0.5)):
                ph = tau * x.hz(m + over) * t
                w += loud * sum(np.sin(h * ph + 0.9 * h) / h for h in range(1, 12))
            size = int(sr / (4200 if open_ else 3000))
            w = np.convolve(np.tanh(2.2 * w), np.ones(size) / size, "same")
            chugged[(m, open_)] = w * np.exp(-t / (0.16 if open_ else 0.04)) * np.minimum(1, t / 0.002) * tail(k, 0.01)
        put("chug", b, chugged[(m, open_)] * vol, pan)

    SAW = [1 / h for h in range(1, 17)]

    def speaker(w):
        """A guitar amp's speaker: little under 200 Hz, a push round 1.8 kHz (the bite), nothing much over 4.8 kHz."""
        f = np.fft.rfftfreq(len(w), 1 / sr)
        curve = f / (f + 200) * (1 + 2.2 * np.exp(-((np.log2(np.maximum(f, 1) / 1800) / 0.8) ** 2))) / np.sqrt(1 + (f / 4800) ** 6)
        return np.fft.irfft(np.fft.rfft(w) * curve, len(w))

    def axe(start, text, vol=1.0, pan=-0.1, up=0):
        """Wrangler's guitar: three sawtooths a hair apart, driven hard, through a speaker (little low, a push in
        its middle, its highs cut), the pick on each note's front. A long note is bent up two half steps into place (a phrase's first
        note one) and held, wavering; under a long note, the note a fourth below it too (a two-note chord)."""
        free = -1.0
        for b, d, m in notes(start, text):
            b, d, m = float(b), float(d), m + up
            at(b, d)
            long = d >= 1.0
            bend = 2.0 if long else 1.0 if b > free + 0.3 else 0.0
            w = x.tone(m, d * 0.95, SAW, 1.0, detune=(-9, 0, 8), vib=0.012 if long else 0.0, vib_hz=6.0, scoop=bend, scoop_s=0.03, attack=0.004, release=0.02)
            if long:
                w = w + 0.5 * x.tone(m - 5, d * 0.95, SAW, 1.0, detune=(-7, 6), vib=0.012, vib_hz=6.0, scoop=bend, scoop_s=0.03, attack=0.004, release=0.02)
            t = np.arange(len(w)) / sr
            w = speaker(np.tanh(3.0 * w) + 0.3 * hiss(len(w), 6000, 0.5) * np.exp(-t / 0.004))
            put("lead", b, w * np.minimum(1, t / 0.002) * tail(len(w), 0.02) * 0.1 * vol, pan)
            free = b + d

    def wah(start, text, vol=1.0, pan=0.1, up=0):
        """The call: a buzz through a mouth that opens and closes on every note (its ring sweeping from 450 Hz up to
        2400 and back down), so each note says "wah"; a long one wavers."""
        for b, d, m in notes(start, text):
            b, d, m = float(b), float(d), m + up
            at(b, d)
            k = x.k(d * 0.95)
            t = np.arange(k) / sr
            u = np.linspace(0, 1, k)
            f0 = x.hz(m)
            ph = tau * np.cumsum(f0 * (1 + 0.01 * np.sin(tau * 5.5 * t) * np.clip((t - 0.2) / 0.15, 0, 1))) / sr
            mouth = 450 * (2400 / 450) ** np.sin(np.pi * u**0.6)
            w = np.zeros(k)
            for h in range(1, max(2, int(7000 / f0)) + 1):
                fh = h * f0
                w += np.sin(h * ph) / h * (0.08 + 1 / np.sqrt(1 + 36 * (fh / mouth - mouth / fh) ** 2))
            put("wah", b, np.tanh(1.5 * w) * np.minimum(1, t / 0.02) * tail(k, 0.05) * 0.16 * vol, pan)

    def whistled(start, text, vol=1.0, pan=0.25, up=0):
        """The lone whistle: nearly a pure note with breath in it, gliding from each note to the next, wavering on
        the long ones; its echo is the mix's."""
        last = None
        for b, d, m in notes(start, text):
            b, d, m = float(b), float(d), m + up
            at(b, d)
            k = x.k(d * 0.97)
            t = np.arange(k) / sr
            glide = float(last[1] - m) if last is not None and abs(last[0] - b) < 1e-6 else -1.0
            f = x.hz(m) * 2 ** (glide * np.exp(-t / 0.055) / 12) * (1 + 0.012 * np.sin(tau * 5.5 * t) * np.clip((t - 0.15) / 0.15, 0, 1))
            ph = tau * np.cumsum(f) / sr
            w = np.sin(ph) + 0.04 * np.sin(2 * ph) + 0.6 * band(murk(k, 6000), x.hz(m), 6.0)
            put("whistle", b, w * np.minimum(1, t / 0.04) * tail(k, 0.07) * 0.09 * vol, pan)
            last = (b + d, m)

    def stab(b, ms, vol=0.05, pan=0.35):
        """Brass, short: a border town's trumpets."""
        at(b, 0.4)
        for m in ms:
            put("brass", b, x.brass(m, 0.35, vol), pan)

    # ---- the band, bar by bar ----
    def beat(bar, vol=1.0, twice=False):
        """The kit's bar: the kick on 1 and 3 and a pickup before each (`twice`: two quick ones), the snare's crack on 2
        and 4, a hat on the beats, a tambourine on the gallop's two 16ths."""
        b = bar0(bar)
        kick(b, 0.52 * vol), kick(b + 2, 0.52 * vol), kick(b + 1.75, 0.36 * vol), kick(b + 3.75, 0.36 * vol)
        if twice:
            kick(b + 3.5, 0.3 * vol)
        crack(b + 1, 0.3 * vol), crack(b + 3, 0.3 * vol)
        for i in range(4):
            hat(b + i, 0.03 * vol), jingle(b + i + 0.5, 0.02 * vol), jingle(b + i + 0.75, 0.026 * vol)

    def gallop(bar, vol=1.0, chugs=0.0):
        """The bass's gallop: on every beat a thumbed low note and two popped ones an octave over it. In the second bar
        of a chord its last beat walks by step to the next chord's note. `chugs`: the distorted guitar's muted chords
        gallop with it, that loud."""
        b = bar0(bar)
        root, nxt = of(bar)[0], of(bar + 1)[0]
        # (The turn: up to the next note through the two notes under it; or down to it by step.)
        turn = () if nxt == root else (nxt - 3, nxt - 1) if nxt > root else (root, nxt + 1 if root - nxt > 1 else root)
        for i in range(4):
            if i == 3 and turn:
                thumb(b + 3, root, 0.42 * vol, 0.5), thumb(b + 3.5, turn[0], 0.38 * vol, 0.24), thumb(b + 3.75, turn[1], 0.4 * vol, 0.24)
            else:
                thumb(b + i, root, 0.42 * vol, 0.5), pop(b + i + 0.5, root + 12, 0.32 * vol), pop(b + i + 0.75, root + 12, 0.36 * vol)
            if chugs:
                chug(b + i, root + 12, 0.1 * chugs), chug(b + i + 0.5, root + 12, 0.07 * chugs), chug(b + i + 0.75, root + 12, 0.07 * chugs)

    def strummed(bar, vol=1.0, run=None):
        """The dry guitar: a chop off every beat (down, up, by turns); `run`: the Spanish run of three on the bar's
        last beat (by default in the second bar of each chord)."""
        b = bar0(bar)
        ms = of(bar)[1]
        run = of(bar + 1)[0] != of(bar)[0] if run is None else run
        for i in range(4):
            if i == 3 and run:
                three(b + 3, ms, 0.07 * vol)
            else:
                strum(b + i + 0.5, ms, 0.06 * vol, up_=i % 2 == 1)

    def ridden(bar, vol=1.0, chugs=0.0, twice=None):
        """A bar of the gallop: the kit, the bass, the dry guitar."""
        beat(bar, vol, bar % 2 == 0 if twice is None else twice), gallop(bar, vol, chugs), strummed(bar, vol)

    # Bars 1-8: the standoff. A bell tolls on G every two bars; timpani roll under it; the call, alone; the whistle
    # answers over the bell; his spurs, two steps, a snort; a roll, a breath of nothing, a gunshot.
    for bar in (1, 3, 5, 7):
        toll(bar0(bar), n("G3"), 0.08)
    roll(bar0(2) + 2, 2.0, n("G2"), 0.05, 0.16), roll(bar0(6) + 2, 2.0, n("D3"), 0.05, 0.16)
    wah(bar0(3), CALL1), whistled(bar0(5), LONE)
    stomp(bar0(7) + 1, 0.2), stomp(bar0(7) + 3, 0.22), snort(bar0(8), 0.05, 112, 0.2)
    roll(bar0(8) + 1, 2.0, n("G2"), 0.06, 0.2)
    shot(bar0(8) + 3.5, 0.12)

    # Bars 9-24: the gallop. The call (two bars, on G minor and on E flat) and the whistle (two bars, on F and on D7)
    # trade, twice round; the whistle's answers are new the second time.
    x.crash(bar0(9), 0.2, decay=0.6)
    for bar in range(9, 25):
        ridden(bar, chugs=0.0 if bar < 17 else 0.9)  # (the distorted guitar's muted chords come in under the second round)
    for first, one, two in ((9, ANS1, ANS2), (17, ANS3, ANS4)):
        wah(bar0(first), CALL1), whistled(bar0(first + 2), one), wah(bar0(first + 4), CALL2), whistled(bar0(first + 6), two)
    x.crash(bar0(17), 0.16, decay=0.5), fill(bar0(17) - 1), fill(bar0(25) - 1, (55, 50, 50, 45))

    # Bars 25-32: the chorus. The round begun from B flat; the whistle sings its own tune, the call's voice has a word
    # or two in its rests.
    x.crash(bar0(25), 0.2, decay=0.6)
    for bar in range(25, 33):
        ridden(bar, 1.05, chugs=0.9)
    whistled(bar0(25), CHOR, 1.05), wah(bar0(25), CHOR_WAH, 0.8)
    fill(bar0(33) - 1)

    # Bars 33-48: the guitar's anthem. The first tune an octave lower on the distorted guitar; its muted chords gallop
    # with the bass; brass stabs on the D7. The second time round a second guitar has it an octave over the first.
    x.crash(bar0(33), 0.22, decay=0.6), x.crash(bar0(41), 0.2, decay=0.6)
    for bar in range(33, 49):
        ridden(bar, 1.05, chugs=1.0)
        if CHORDS[bar - 1] == "D7":
            for i in ((2, 6, 11) if bar % 2 == 1 else (0, 3, 6)):
                stab(bar0(bar) + i / 4, [n(c) for c in "F#4 A4 C5".split()], 0.05)
    for first, one, two, twin in ((33, ANS1, ANS2, False), (41, ANS3, ANS4, True)):
        for at_bar, line in ((first, CALL1), (first + 2, one), (first + 4, CALL2), (first + 6, two)):
            axe(bar0(at_bar), line, 1.0, -0.15, up=-12)
            if twin:
                axe(bar0(at_bar), line, 0.55, 0.3)
    fill(bar0(41) - 1)

    def struck(bar, hits):
        """The whole band's hits in a bar (the kick, the bass, a chord let ring, the timpani, a strum), on these 16ths."""
        b = bar0(bar)
        root, ms = of(bar)
        for i in hits:
            kick(b + i / 4, 0.55), thumb(b + i / 4, root, 0.46, 0.5), chug(b + i / 4, root + 12, 0.13, open_=True), put("timp", b + i / 4, x.timp(root, 0.7, 0.22))
            strum(b + i / 4, ms, 0.05, long=0.25)

    # Bars 49-60: high noon. One hit, and the street is empty: the bell, timpani far off, his spurs, the whistle. From
    # its fifth bar the band's hits and silences; the dry guitar's runs of three; the whistle; he laughs. The last
    # bar: nothing, then a shot.
    struck(49, (0,))
    toll(bar0(49), n("G3"), 0.07), toll(bar0(51), n("G3"), 0.07), toll(bar0(57), n("G3"), 0.06)
    roll(bar0(50) + 2, 2.0, n("G2"), 0.04, 0.12), roll(bar0(52) + 2, 2.0, n("D3"), 0.05, 0.16)
    stomp(bar0(50), 0.18), stomp(bar0(50) + 1.5, 0.2), clink(bar0(52), 0.03)
    whistled(bar0(49), NOON0, 0.8), whistled(bar0(53), NOON, 0.8)
    for bar, hits in ((53, (0, 6)), (55, (0, 6)), (57, (0, 6, 8)), (58, (0,)), (59, (0, 4, 8, 12))):
        struck(bar, hits)
    for bar in (54, 56, 58):
        three(bar0(bar) + 2, of(bar)[1], 0.06), three(bar0(bar) + 3, of(bar)[1], 0.075)
    for i in range(4):
        three(bar0(59) + i, of(59)[1], 0.05 + 0.012 * i), tap(bar0(59) + i + 0.5, 0.05 + 0.02 * i), tap(bar0(59) + i + 0.75, 0.06 + 0.02 * i)
    clink(bar0(54) + 0.5, 0.03), clink(bar0(56) + 0.5, 0.03, -0.3), laugh(bar0(58) + 1, 0.05)
    stomp(bar0(60), 0.2), stomp(bar0(60) + 1.5, 0.22)
    shot(bar0(60) + 3.5, 0.12)

    # Bars 61-68: the guitar and the whistle trade, two bars each, over the gallop. Bars 69-76: the guitar's solo.
    x.crash(bar0(61), 0.22, decay=0.6), x.crash(bar0(69), 0.2, decay=0.6)
    for bar in range(61, 77):
        ridden(bar, 1.05, chugs=1.0)
    axe(bar0(61), LICK1), whistled(bar0(63), REPLY1), axe(bar0(65), LICK2), whistled(bar0(67), REPLY2)
    fill(bar0(69) - 1)
    axe(bar0(69), SOLO, 0.85)
    fill(bar0(77) - 1, (55, 55, 50, 45))

    # Bars 77-84: the tune a minor third up, all three: the guitar has all of it, the call's voice its two bars with
    # him, the whistle its answers; a deep kick under each new chord.
    x.crash(bar0(77), 0.24, decay=0.6)
    for bar in range(77, 85):
        ridden(bar, 1.1, chugs=1.0)
        if bar % 2 == 1:
            sub(bar0(bar), of(bar)[0], 2.0, 0.4)
        if CHORDS[bar - 1] == "D7+3":
            for i in ((2, 6, 11) if bar % 2 == 1 else (0, 3, 6)):
                stab(bar0(bar) + i / 4, [n(c) + 3 for c in "F#4 A4 C5".split()], 0.05)
    for at_bar, line, voice in ((77, CALL1, wah), (79, ANS1, whistled), (81, CALL2, wah), (83, ANS2, whistled)):
        axe(bar0(at_bar), line, 1.0, -0.15, up=3 - 12), voice(bar0(at_bar), line, 0.85, up=3)

    # Bars 85-88: the turn home. Two bars of hits on D7 and silence, the guitar's last bent note; then the timpani roll
    # up into the bell.
    for bar, hits in ((85, (0, 3, 6)), (86, (0,))):
        b = bar0(bar)
        root, ms = of(bar)
        for i in hits:
            kick(b + i / 4, 0.55), thumb(b + i / 4, root, 0.46, 0.5), chug(b + i / 4, root + 12, 0.13, open_=True), strum(b + i / 4, ms, 0.05, long=0.25)
        crack(b + 3, 0.3)
    x.crash(bar0(85), 0.2, decay=0.6)
    axe(bar0(85) + 2, "A4:.5 C5:.5 D5:3", 0.9, -0.15)
    three(bar0(86) + 2, of(86)[1], 0.06)
    clink(bar0(87), 0.03), snort(bar0(87) + 1, 0.04)
    roll(bar0(87) + 2, 6.0, n("D3"), 0.04, 0.16)

    x.beat_s = TAPE / BEATS
    x.echo("whistle", 0.75, 0.3, 0.15), x.echo("wah", 0.75, 0.16, 0.07), x.echo("lead", 0.75, 0.12, 0.05)
    levels = {"lead": 1.2, "wah": 2.0, "whistle": 1.75, "bass": 0.55, "sub": 0.5, "chug": 2.2, "kick": 0.8, "snare": 1.2, "hats": 5.5, "toms": 1.1, "drum": 1.5,
              "gtr": 1.8, "bell": 1.5, "timp": 1.0, "brass": 1.6, "pig": 2.0, "fx": 2.0}
    return x.play(x.mixdown(levels, lowpass=8500, room=0.2))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
