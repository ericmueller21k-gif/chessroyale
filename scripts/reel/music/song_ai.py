"""Song AI (Eric, Nov 16): a second new theme for Folio, a loop of 2:42. He passed on the city-pop one (song_ah.py: "I
didn't care for this one, actually. It's not what you did, but let's try this again. And now I've given you clear
exactly how I want it, right? Like, very specific. The only thing is, you make sure it's the proper length that we've
been doing."). The script is his own plan (made with another assistant, as Babur's and Chandy's were: song_af.py,
song_ag.py), "Fast-Paced 90s Arcade Action-Funk & Synth-Brass Rock", with its notes, rhythms, bass lines and chord
voicings written out, and it is his to give, so this is the plan, note for note:
  - 160 beats a minute, four in a bar, C minor (Dorian and Aeolian, the B natural over G7), a lift to A flat and F
    minor in the climax. The kick on 1, the "and" of 2, and 3; the snare on 2 and 4; a 16th-note tom and snare fill
    every fourth bar; hats in 8ths, closed and open.
  - Its four patches: an FM brass lead (two pairs of operators, 1:1 with the modulator fed back on itself and 1:2; a
    10 ms attack, 80% sustain, a 60 ms release); an FM slap bass (thumbed low notes with a 90 ms decay, octave pops
    45 ms long); an "orchestra hit" (FM and square waves together, no attack, a 180 ms decay, sagging 15 cents); and
    a 50% square wave playing short harmony notes beside the lead, and 16th arpeggios under the climax.
  - Its 36 bars, every note the plan writes: the intro's bass line and brass chords (Cm7, F9, Ab7 to G7) and its run
    of 16ths (bars 1-4); theme A and its bass (5-12); the call and response over Abmaj7, G7, Cm7, Bb7 to Bdim7
    (13-16); the climbing bridge over Fm7, Cm7/Eb, D7b9, Gm7, Abmaj7, the band's four hits and the B5 held over a
    drum roll on G7#9 (17-24); the climax over Abmaj7, Bb7, Gm7, Cm7, Fm7, G7, Cm7, C7#9 (25-32); the orchestra hits
    (Cm, Bb, Ab, G7), and the fill and the bass's slide back to bar 1 (33-36).
The plan's loop is 54 s, "looped twice" (1:48), and he wants 2:30 to 2:45 (SOUNDS.md), so it is played three times:
108 bars, 162.0 s. The notes are the same each time. What changes is only what the plan itself offers a choice of:
  - the square wave's harmony under theme A ("in thirds/sixths"): a third under the lead the first time, a sixth
    under it the second, both the third;
  - the brass's doubling on the call's three hits ("in octaves or 4ths"): an octave under, a fourth under, both;
  - the climax's lead, the third time with a second brass an octave under it; and the drum fills.
What the plan leaves to whoever builds it is written here, inside its chords, and is original (none of it is any
song's or any game's): the square wave's harmony notes and its arpeggios, the bass under the call and response and
under the climax (in the plan's own shapes: the root and its octave, two notes that step into the next root), and
the drum fills.
Calls made where the plan could be read two ways:
  - Bar 2's "Ab7 stab -> G7 stab" on the "and" of 3: Ab7 there, an 8th, and G7 on beat 4, a quarter.
  - Bars 7-8's bass ("F1-F2-F1-F2-G1-G2-Ab2-G2") is eight 8ths, one bar, played in each of the two bars, as bars
    5-6's is. Bar 12 "ending on a C2 - Bb1 - A1 - Ab1 descending walk": its last four 8ths, under the tune's C5.
  - Bar 36's slide (G2 F#2 F2 Eb2 D2 C2) has the rhythm of bar 4's turnaround: two quarters, four 8ths.
  - Bar 32's C5 "tied into the breakdown" is held a beat into bar 33. Bar 24's G7#9: the bass on G, the lead on B,
    and two brass under it on F and A sharp.
  - The hats tick on quietly through the orchestra hits (a theme to leave on shouldn't stop its beat: SOUNDS.md).
  python3 song_ai.py <out.wav>

  each time round (54 s; the second starts at 0:54, the third at 1:48):
  bars  1-4   0:00  the intro: the slap bass, the brass's chords, its run of 16ths
  bars  5-12  0:06  theme A: the brass, the square wave in harmony
  bars 13-16  0:18  the call and response
  bars 17-24  0:24  the bridge, climbing: the band's four hits, the B5 over the drum roll
  bars 25-32  0:36  the climax: the brass high, the square wave's 16ths under it
  bars 33-36  0:48  the orchestra hits; the fill and the slide back to bar 1
"""
import sys
from fractions import Fraction

import numpy as np

from song_r import beats, notes
from synth import Ride, n, write_wav

BPM, LOOP, TURNS = 160, 36, 3
BARS = LOOP * TURNS
BEATS = 4 * BARS
TAPE = BEATS * 60 / BPM  # 162.0 s
bar0 = lambda bar: 4 * (bar - 1)  # the beat a bar (from 1) starts at
RIDE = [(0, BEATS, BPM, BPM, 1.0, 1.0, 0.0)]

# ---- the bass. Lengths in beats (.5 is an 8th); a "!" marks an octave pop, the rest are thumbed. ----
B_INTRO = "C2:.5 C3!:.5 Bb2!:.25 G2!:.25 C2:.5 F2:.5 F#2:.5 G2:.5 Bb2!:.5"  # bars 1-3
B_TURN = "Ab2:1 G2:1 F2:.5 Eb2:.5 D2:.5 G1:.5"  # bar 4
B_CM = "C2:.5 C3!:.5 C2:.5 C3!:.5 Bb1:.5 B1:.5 C2:.5 G2:.5"  # bars 5-6
B_FG = "F1:.5 F2!:.5 F1:.5 F2!:.5 G1:.5 G2!:.5 Ab2:.5 G2:.5"  # bars 7-8
B_WALK = "F1:.5 F2!:.5 F1:.5 F2!:.5 C2:.5 Bb1:.5 A1:.5 Ab1:.5"  # bar 12
BASS_A = " | ".join((B_CM, B_CM, B_FG, B_FG, B_CM, B_CM, B_FG, B_WALK))
# Mine, under the call and response: with the three hits, a rest, then on under the answer.
BASS_A2 = (
    "Ab1:.5 Ab2!:.5 Ab1:.5 -:.5 Ab1:.5 Ab2!:.5 Ab1:.5 Eb2:.5 | G1:.5 G2!:.5 G1:.5 -:.5 G1:.5 G2!:.5 G1:.5 B1:.5 | "
    "C2:.5 C3!:.5 C2:.5 C3!:.5 C2:.5 C3!:.5 C2:.5 A1:.5 | Bb1:.5 Bb2!:.5 Bb1:.5 Bb2!:.5 B1:.5 B2!:.5 B1:.5 G1:.5"
)
# The bridge: the plan's pulses and pedals, the band's four hits, G under the held B5.
BASS_B = " | ".join(("F1:.5 F2!:.5 " * 4, "F1:.5 F2!:.5 " * 4, "Eb2:.5 " * 8, "D2:.5 " * 8, "G1:.5 G2!:.5 " * 4, "Ab1:.5 Ab2!:.5 " * 4,
                     "F2:1 G2:1 Ab2:1 Bb2:1", "G1:.5 G2!:.5 " * 4))
# Mine, under the climax: the root and its octave, and two notes that step into the next root.
BASS_C = (
    "Ab1:.5 Ab2!:.5 Ab1:.5 Ab2!:.5 Ab1:.5 Ab2!:.5 Eb2:.5 A1:.5 | Bb1:.5 Bb2!:.5 Bb1:.5 Bb2!:.5 Bb1:.5 Bb2!:.5 F2:.5 Ab1:.5 | "
    "G1:.5 G2!:.5 G1:.5 G2!:.5 G1:.5 G2!:.5 Bb1:.5 B1:.5 | C2:.5 C3!:.5 C2:.5 C3!:.5 C2:.5 C3!:.5 Eb2:.5 E2:.5 | "
    "F1:.5 F2!:.5 F1:.5 F2!:.5 F1:.5 F2!:.5 F1:.5 F#1:.5 | G1:.5 G2!:.5 G1:.5 G2!:.5 G1:.5 G2!:.5 A1:.5 B1:.5 | "
    f"{B_CM} | C2:.5 C3!:.5 C2:.5 C3!:.5 C2:.5 C3!:.5 Bb1:.5 B1:.5"
)
# The breakdown: with the orchestra hits, then the plan's slide.
BASS_BREAK = "C2:.5 -:1 C2:.5 -:1 Bb1:.5 -:.5 | Ab1:.5 -:1 Ab1:.5 -:1 G1:1 | C2:.5 -:1 C2:.5 -:1 Bb1:.5 -:.5 | G2:1 F#2:1 F2:.5 Eb2:.5 D2:.5 C2:.5"

# ---- the brass's chords and the orchestra hits: (the beat in the bar, how long, the notes), bar by bar ----
CM7, F9, AB7, G7 = "G4 Bb4 Eb5", "A4 C5 Eb5 G5", "Ab4 C5 Gb5", "G4 B4 F5"
INTRO_STABS = (((1.5, 0.5, CM7), (3, 1, F9)), ((1.5, 0.5, CM7), (2.5, 0.5, AB7), (3, 1, G7)), ((1.5, 0.5, CM7), (3, 1, F9)), ())
RUN = "G4:.25 A4:.25 Bb4:.25 B4:.25 C5:.25 D5:.25 Eb5:.25 F5:.25"  # bar 4, beats 3 and 4
HIT_CM, HIT_BB, HIT_AB, HIT_G7 = "C4 Eb4 G4", "Bb3 D4 F4", "Ab3 C4 Eb4", "G3 B3 F4"
HITS = (((0, 0.5, HIT_CM), (1.5, 0.5, HIT_CM), (3, 0.5, HIT_BB)), ((0, 0.5, HIT_AB), (1.5, 0.5, HIT_AB), (3, 1, HIT_G7)),
        ((0, 0.5, HIT_CM), (1.5, 0.5, HIT_CM), (3, 0.5, HIT_BB)))

# ---- the lines. The lead's are the plan's; the square wave's harmony under them is mine, on the chords. ----
THEME_A = (
    "G5:1.5 Eb5:.5 C5:1 D5:.5 Eb5:.5 | F5:.5 Eb5:.5 D5:.5 C5:.5 Bb4:1 G4:1 | F5:1.5 D5:.5 Bb4:1 C5:.5 D5:.5 | Eb5:.5 D5:.5 C5:.5 B4:.5 D5:2 | "
    "G5:1.5 Eb5:.5 C5:1 F5:.5 G5:.5 | Ab5:.5 G5:.5 F5:.5 Eb5:.5 D5:1 G5:1 | C6:1 Bb5:.5 Ab5:.5 G5:1 F5:.5 Eb5:.5 | D5:.5 Eb5:.5 F5:.5 D5:.5 C5:2"
)
# A third under it (a fourth where the third would fight the chord), and a sixth under it.
A_THIRD = (
    "Eb5:1.5 C5:.5 G4:1 Bb4:.5 C5:.5 | D5:.5 C5:.5 Bb4:.5 G4:.5 G4:1 Eb4:1 | C5:1.5 Bb4:.5 G4:1 Ab4:.5 Bb4:.5 | C5:.5 Bb4:.5 Ab4:.5 G4:.5 B4:2 | "
    "Eb5:1.5 C5:.5 G4:1 D5:.5 Eb5:.5 | F5:.5 Eb5:.5 C5:.5 C5:.5 Bb4:1 Eb5:1 | Ab5:1 G5:.5 F5:.5 Eb5:1 C5:.5 C5:.5 | Bb4:.5 C5:.5 C5:.5 Bb4:.5 G4:2"
)
A_SIXTH = (
    "Bb4:1.5 G4:.5 Eb4:1 F4:.5 G4:.5 | A4:.5 G4:.5 F4:.5 Eb4:.5 D4:1 Bb3:1 | Ab4:1.5 F4:.5 D4:1 Eb4:.5 F4:.5 | G4:.5 F4:.5 Eb4:.5 D4:.5 F4:2 | "
    "Bb4:1.5 G4:.5 Eb4:1 A4:.5 Bb4:.5 | C5:.5 Bb4:.5 Ab4:.5 G4:.5 F4:1 Bb4:1 | Eb5:1 D5:.5 C5:.5 Bb4:1 Ab4:.5 G4:.5 | F4:.5 G4:.5 Ab4:.5 F4:.5 Eb4:2"
)
# The call and response: each bar's three hits (and the same a fourth under, by the chord), then the answers.
CALLS, CALLS_FOURTH = ("C5 Eb5 Ab5", "B4 D5 G5", "C5 Eb5 G5"), ("G4 Bb4 Eb5", "F4 A4 D5", "G4 Bb4 D5")
ANSWERS = "-:2 G5:.5 F5:.5 Eb5:1 | -:2 F5:.5 Eb5:.5 D5:1 | -:1.5 Bb5:1 A5:1 G5:.5 | F5:.5 Eb5:.5 D5:.5 C5:.5 B4:1 G4:1"
ANSWERS_THIRD = "-:2 Eb5:.5 C5:.5 C5:1 | -:2 D5:.5 C5:.5 B4:1 | -:1.5 G5:1 F5:1 Eb5:.5 | D5:.5 C5:.5 Bb4:.5 Ab4:.5 Ab4:1 D4:1"
# The bridge, bars 17-22 (23 is the band's four hits, 24 the held B5).
THEME_B = (
    "F5:1 G5:.5 Ab5:1.5 G5:.5 F5:.5 | C6:2 Bb5:1 Ab5:1 | G5:1 A5:.5 Bb5:1.5 A5:.5 G5:.5 | D6:2 C6:1 A5:1 | "
    "Bb5:.5 A5:.5 G5:.5 Bb5:.5 C6:1 Eb6:1 | D6:.5 C6:.5 Bb5:.5 Ab5:.5 G5:2"
)
B_THIRD = (
    "D5:1 Eb5:.5 F5:1.5 Eb5:.5 D5:.5 | Ab5:2 G5:1 F5:1 | Eb5:1 F5:.5 G5:1.5 F5:.5 Eb5:.5 | F#5:2 A5:1 F#5:1 | "
    "G5:.5 F5:.5 Eb5:.5 G5:.5 A5:1 C6:1 | Bb5:.5 Ab5:.5 G5:.5 F5:.5 Eb5:2"
)
CLIMB = "F5 G5 Ab5 Bb5"  # bar 23
# The climax; its last C5 is held a beat into the breakdown.
THEME_C = (
    "Eb6:1.5 D6:.5 C6:1 Bb5:1 | D6:1.5 C6:.5 Bb5:1 Ab5:1 | Bb5:.5 C6:.5 D6:1 G5:1 Eb6:1 | C6:2 Bb5:.5 Ab5:.5 G5:.5 F5:.5 | "
    "Ab5:1.5 G5:.5 F5:1 Eb5:.5 F5:.5 | G5:1 B5:1 D6:1 F6:1 | Eb6:.5 D6:.5 C6:1 G5:1 Eb5:1 | C5:5"
)
# The square wave's 16ths under it: each bar's chord (Abmaj7, Bb7, Gm7, Cm7, Fm7, G7, Cm7, C7#9), up and down.
ARPS = ("Ab4 C5 Eb5 G5", "Ab4 Bb4 D5 F5", "G4 Bb4 D5 F5", "G4 Bb4 C5 Eb5", "Ab4 C5 Eb5 F5", "G4 B4 D5 F5", "G4 Bb4 C5 Eb5", "E4 Bb4 C5 Eb5")
# The fills, in 16ths (s: snare; h, m, l: toms), by the bar of the loop they end; one for each time round.
FILLS = {4: ("s.sshhml", "sshhmmll", "ss.shmll"), 8: ("sshm", "shml", "ssml"), 12: ("shml", "ssml", "hhml"), 16: ("ssml", "sshm", "shml"),
         20: ("sshm", "hhml", "sshm"), 28: ("shml", "sshm", "ssml"), 32: ("ss.shmll", "s.sshhml", "sshhmmll"), 36: ("sshhssmmssllslss",) * 3}
for _line, _beats in ((THEME_A, 32), (A_THIRD, 32), (A_SIXTH, 32), (ANSWERS, 16), (ANSWERS_THIRD, 16), (THEME_B, 24), (B_THIRD, 24), (THEME_C, 33),
                      (BASS_A, 32), (BASS_A2, 16), (BASS_B, 32), (BASS_C, 32), (BASS_BREAK, 16), (B_INTRO, 4), (B_TURN, 4)):
    assert beats(_line) == _beats, (_line[:30], beats(_line))


def slaps(start, text):
    """The bass's notes: [(beat, beats, midi, popped)]."""
    out, t = [], Fraction(start)
    for tok in text.replace("|", " ").split():
        name, d = tok.split(":")
        if name != "-":
            out.append((float(t), float(Fraction(d)), n(name.rstrip("!")), name.endswith("!")))
        t += Fraction(d)
    return out


def render(window=None) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample, to compare voices on)."""
    x = Ride(RIDE, BEATS, None, os=2, seed=311, tape_secs=TAPE)
    x.window = window
    put, at = x.put, x.at
    rng = np.random.default_rng(107)
    sr = x.sr
    tau = 2 * np.pi

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    def hiss(k, rate, hp=0.0):
        hold = max(1, int(sr / rate))
        r = rng.uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    def crunch(w, rate=11000, steps=24):
        """A sampled sound as the old console played it: few samples a second, few levels."""
        hold = max(1, int(sr / rate))
        return np.round(np.repeat(w[::hold], hold)[: len(w)] * steps) / steps

    # ---- the kit ----
    def kick(b, vol=0.5):
        k = int(0.22 * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(50 + 120 * np.exp(-t / 0.016)) / sr) * np.exp(-t / 0.085)) + 0.3 * hiss(k, 5000, 0.4) * np.exp(-t / 0.003)
        put("kick", b, crunch(w) * tail(k) * vol)

    def snare(b, vol=0.25):
        """Noise and a sampled drum's body, gated: cut off at 110 ms."""
        k = int(0.11 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(195 + 90 * np.exp(-t / 0.01)) / sr) * np.exp(-t / 0.04)
        put("snare", b, crunch(0.8 * body + 0.9 * hiss(k, 8000, 0.5) * np.exp(-t / 0.07)) * tail(k, 0.008) * vol, 0.05)

    def tom(b, kind, vol=0.3):
        f0, pan = {"h": (190, -0.4), "m": (142, 0.0), "l": (102, 0.4)}[kind]
        k = int(0.2 * sr)
        t = np.arange(k) / sr
        w = np.sin(tau * np.cumsum(f0 * (1 + 0.5 * np.exp(-t / 0.03))) / sr) * np.exp(-t / 0.07) + 0.25 * hiss(k, 6000, 0.4) * np.exp(-t / 0.006)
        put("toms", b, crunch(w) * tail(k) * vol, pan)

    def hat(b, vol=0.03, open_=False, pan=0.3):
        k = int((0.15 if open_ else 0.035) * sr)
        t = np.arange(k) / sr
        put("hats", b, hiss(k, 13000, 0.85) * np.exp(-t / (0.055 if open_ else 0.009)) * tail(k, 0.004) * vol, pan)

    def crash(b, vol=0.05):
        k = int(1.2 * sr)
        t = np.arange(k) / sr
        put("crash", b, hiss(k, 14000, 0.8) * np.exp(-t / 0.26) * np.minimum(1, t / 0.002) * tail(k, 0.05) * vol, -0.2)

    def kit(bar, vol=1.0, fill="", kicks=(0, 3, 4), snares=(2, 6), opens=(7,), ticks=1.0, skip=()):
        """A bar of the plan's beat, by 8ths: the kick on 1, the "and" of 2, and 3; the snare on 2 and 4; hats in
        8ths, the open ones at `opens`. `fill`: 16ths (s, h, m, l, or a dot) that take the bar's end."""
        b = bar0(bar)
        cut = 4 - len(fill) / 4
        for i in kicks:
            kick(b + i / 2, 0.5 * vol)
        for i in snares:
            if i / 2 < cut:
                snare(b + i / 2, 0.26 * vol)
        for i in range(8):
            if i / 2 < cut and i not in skip:
                hat(b + i / 2, (0.03 if i % 2 == 0 else 0.022) * vol * ticks * (1.3 if i in opens else 1), open_=i in opens)
        for j, c in enumerate(fill):
            if c == "s":
                snare(b + cut + j / 4, (0.17 + 0.09 * j / max(1, len(fill) - 1)) * vol)
            elif c in "hml":
                tom(b + cut + j / 4, c, 0.3 * vol)

    # ---- the four patches ----
    def sawish(ph, top=10):
        """A sawtooth's first harmonics (the orchestra hit's modulator)."""
        return (2 / np.pi) * sum(np.sin(h * ph) / h for h in range(1, top + 1))

    def fed(ph, beta=0.9):
        """A sine operator fed back on itself: it leans toward a sawtooth."""
        y = np.sin(ph)
        for _ in range(6):
            y = np.sin(ph + beta * y)
        return y

    def horn(m, d, vol, vib=0.0, edge=1.0, players=((-7, 0.5), (0, 0.0), (6, -0.4))):
        """Patch 1's note, the FM brass: two pairs of operators (1:1, its modulator fed back; and 1:2), three players a
        hair apart (starting together, so its front is whole); brightest at the front; a 10 ms attack, 80% sustain, and
        a 60 ms release after its `d` beats."""
        k = x.k(d) + int(0.06 * sr)
        i = np.arange(k)
        t = i / sr
        amp = np.minimum(1, t / 0.010) * (0.8 + 0.2 * np.exp(-t / 0.06)) * np.clip((k - i) / (0.06 * sr), 0, 1)
        f0 = x.hz(m)
        depth = edge * float(np.clip((523.25 / f0) ** 0.5, 0.7, 1.15)) * (1 + 0.25 * np.exp(-t / 0.07))
        w = np.zeros(k)
        for c, ph0 in players:
            f = x.hz(m + c / 100) * (1 + vib * np.sin(tau * 6 * t) * np.clip((t - 0.18) / 0.2, 0, 1))
            ph = tau * np.cumsum(f) / sr + ph0
            w += 0.6 * np.sin(ph + 2.0 * depth * fed(ph)) + 0.4 * np.sin(ph + 1.1 * depth * np.sin(2 * ph))
        return w / len(players) * amp * vol

    def brass(start, text, vol=1.0, pan=0.0, bus="lead", shift=0):
        """A line on the brass: each note held nearly its whole length; a 6 Hz vibrato on a half note or longer."""
        for b, d, m in notes(start, text):
            at(b, d)
            put(bus, b, horn(m + shift, max(0.1, d - 0.11), 0.2 * vol, vib=0.006 if d >= 2 else 0.0), pan)

    def stab(b, d, names, vol=1.0):
        """The brass's chord, short."""
        ms = [n(c) for c in names.split()]
        at(b, d)
        for j, m in enumerate(ms):
            put("stab", b, horn(m, 0.3 if d <= 0.5 else 0.7 * d, 0.11 * vol, edge=1.1), -0.4 + 0.8 * j / (len(ms) - 1))

    def blip(b, m, d, vol=0.05, pan=0.25):
        """Patch 4's note: a 50% square wave, cut short."""
        at(b, d)
        put("square", b, x.pulse(m, d, 0.5, vol, attack=0.002, decay=0.06, sustain=0.7, release=0.012), pan)

    def square(start, text, vol=1.0, pan=0.25):
        """A line on the square wave, staccato: each note cut to about half its length."""
        for b, d, m in notes(start, text):
            blip(b, m, min(0.6 * d, 1.1), 0.05 * vol, pan)

    def arp(bar, names, vol=1.0):
        """A bar of the square wave's 16ths: up the chord's four notes and down, from side to side."""
        ms = [n(c) for c in names.split()]
        for i in range(16):
            blip(bar0(bar) + i / 4, ms[(0, 1, 2, 3, 2, 1)[i % 6]], 0.19, 0.034 * vol, 0.4 if i % 2 else -0.4)

    def slap(b, d, m, popped, vol=1.0):
        """Patch 2's note, the FM slap bass: thumbed (no attack, its brightness and level falling over 90 ms, a
        metallic front) or popped (bright, 45 ms)."""
        at(b, d)
        f0 = x.hz(m)
        if popped:
            k = int(0.057 * sr)
            t = np.arange(k) / sr
            ph = tau * f0 * t
            w = np.sin(ph + (2.4 * np.exp(-t / 0.02) + 1.4) * np.sin(2 * ph)) + 0.5 * np.sin(3 * ph + 2.0 * np.sin(5 * ph)) * np.exp(-t / 0.006)
            put("bass", b, w * np.minimum(1, t / 0.0006) * tail(k, 0.012) * 0.2 * vol)
            return
        k = x.k(0.9 * d)
        t = np.arange(k) / sr
        ph = tau * f0 * t
        idx = 3.4 * np.exp(-t / 0.09) + 1.4
        fall = 0.38 + 0.62 * np.exp(-t / 0.09)
        w = 0.55 * np.sin(ph + idx * np.sin(ph)) * fall + 0.6 * np.sin(2 * ph + 0.7 * idx * np.sin(ph)) * fall + 0.45 * np.sin(2 * ph + 3.0 * np.sin(3 * ph)) * np.exp(-t / 0.012)
        put("bass", b, w * np.minimum(1, t / 0.0008) * tail(k, 0.012) * 0.26 * vol)

    def bass(start, text, vol=1.0):
        for b, d, m, popped in slaps(start, text):
            slap(b, d, m, popped, vol * (1.1 if b % 2 == 0 else 1.0))

    def blast(b, d, names, vol=1.0):
        """Patch 3, the orchestra hit: each note of the chord on FM (and an octave over) and on square waves (and
        an octave under), a burst of noise, no attack, gone in 180 ms, sagging 15 cents as it goes; crunched."""
        ms = [n(c) for c in names.split()]
        k = int((0.26 if d <= 0.5 else 0.42) * sr)
        t = np.arange(k) / sr
        sag = 2 ** (-15 / 1200 * (1 - np.exp(-t / 0.05)))
        w = np.zeros(k)
        for m in ms:
            for over, fm, sq in ((0, 1.0, 0.5), (12, 0.5, 0.0), (-12, 0.0, 0.35)):
                ph = tau * np.cumsum(x.hz(m + over) * sag) / sr + rng.uniform(0, tau)
                if fm:
                    w += fm * np.sin(ph + (3.2 * np.exp(-t / 0.09) + 1.0) * sawish(ph, 8))
                if sq:
                    w += sq * np.where(np.sin(ph) >= 0, 1.0, -1.0)
        w = w / len(ms) + 0.5 * hiss(k, 9000, 0.3) * np.exp(-t / 0.012)
        put("hit", b, crunch(w * np.exp(-t / (0.07 if d <= 0.5 else 0.11)), 16000, 32) * np.minimum(1, t / 0.0008) * tail(k, 0.02) * 0.3 * vol)

    # ---- the six sections; `turn`: which time round (0, 1, 2) ----
    def intro(first, turn):
        for j in range(4):
            bar = first + j
            kit(bar, fill=FILLS[4][turn] if j == 3 else "")
            bass(bar0(bar), B_TURN if j == 3 else B_INTRO)
            for b, d, names in INTRO_STABS[j]:
                stab(bar0(bar) + b, d, names, 1.25)
        crash(bar0(first))
        brass(bar0(first + 3) + 2, RUN, 0.9)

    def theme_a(first, turn):
        for j in range(8):
            kit(first + j, fill=FILLS[8 if j == 3 else 12][turn] if j in (3, 7) else "")
        crash(bar0(first))
        bass(bar0(first), BASS_A)
        brass(bar0(first), THEME_A)
        if turn != 1:
            square(bar0(first), A_THIRD)
        if turn != 0:
            square(bar0(first), A_SIXTH, 1.0, -0.25 if turn == 2 else 0.25)

    def theme_a2(first, turn):
        for j in range(3):
            bar = first + j
            kit(bar, kicks=(0, 1, 4), skip=(3,) if j < 2 else ())
            for i, (name, under) in enumerate(zip(CALLS[j].split(), CALLS_FOURTH[j].split())):
                b = bar0(bar) + i / 2
                at(b, 0.5)
                put("lead", b, horn(n(name), 0.3, 0.2, edge=1.1))
                if turn != 1:
                    put("stab", b, horn(n(name) - 12, 0.3, 0.13, edge=1.1), -0.3)
                if turn != 0:
                    put("stab", b, horn(n(under), 0.3, 0.13, edge=1.1), 0.3)
                blip(b, n(name), 0.28)
        kit(first + 3, fill=FILLS[16][turn])
        bass(bar0(first), BASS_A2)
        brass(bar0(first), ANSWERS), square(bar0(first), ANSWERS_THIRD)

    def theme_b(first, turn):
        for j in range(6):
            kit(first + j, fill=FILLS[20][turn] if j == 3 else "")
        crash(bar0(first), 0.035)
        bass(bar0(first), BASS_B)
        brass(bar0(first), THEME_B), square(bar0(first), B_THIRD)
        # Bar 23: the whole band's four hits, in octaves. Bar 24: the B5 over the drum roll (G7#9).
        b = bar0(first + 6)
        for i, name in enumerate(CLIMB.split()):
            at(b + i, 1)
            kick(b + i, 0.5), snare(b + i, 0.24), hat(b + i, 0.04, open_=True)
            put("lead", b + i, horn(n(name), 0.5, 0.2, edge=1.1))
            put("stab", b + i, horn(n(name) - 12, 0.5, 0.14, edge=1.1), -0.25)
            blip(b + i, n(name), 0.45, 0.05)
        b = bar0(first + 7)
        at(b, 4)
        put("lead", b, horn(n("B5"), 3.8, 0.2, vib=0.009))
        put("stab", b, horn(n("F4"), 3.8, 0.07), -0.3), put("stab", b, horn(n("A#4"), 3.8, 0.07), 0.3)
        crash(b, 0.035)
        for i in range(16):
            snare(b + i / 4, 0.07 + 0.2 * (i / 15) ** 1.4 + (0.03 if i % 4 == 0 else 0))
            if i % 4 == 0:
                kick(b + i / 4, 0.5)

    def theme_c(first, turn):
        for j in range(8):
            kit(first + j, 1.05, fill=FILLS[28 if j == 3 else 32][turn] if j in (3, 7) else "", opens=(3, 7))
            arp(first + j, ARPS[j])
        crash(bar0(first), 0.06)
        bass(bar0(first), BASS_C)
        brass(bar0(first), THEME_C)
        if turn == 2:
            brass(bar0(first), THEME_C, 0.5, -0.2, "stab", -12)

    def breakdown(first, turn):
        for j in range(3):
            bar = first + j
            kit(bar, kicks=[int(2 * b) for b, _, _ in HITS[j]], opens=(), ticks=0.7)
            for b, d, names in HITS[j]:
                blast(bar0(bar) + b, d, names)
        crash(bar0(first))
        kit(first + 3, fill=FILLS[36][turn], kicks=(0, 2, 4, 6))
        bass(bar0(first), BASS_BREAK, 1.1)

    for turn in range(TURNS):
        first = 1 + LOOP * turn
        intro(first, turn), theme_a(first + 4, turn), theme_a2(first + 12, turn), theme_b(first + 16, turn), theme_c(first + 24, turn), breakdown(first + 32, turn)

    # A small room for the brass, the square wave and the orchestra hit; none for the kit or the bass.
    def room(name, secs=1.0, wet=0.15):
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
    x.echo("lead", 0.75, 0.1, 0.04), x.echo("square", 0.75, 0.12, 0.05)
    for name, secs, wet in (("lead", 1.0, 0.14), ("stab", 1.0, 0.16), ("square", 1.0, 0.14), ("hit", 1.2, 0.28)):
        room(name, secs, wet)
    levels = {"lead": 1.6, "stab": 1.6, "square": 1.4, "hit": 1.0, "bass": 0.8, "kick": 0.62, "snare": 1.3, "toms": 1.0, "hats": 4.2, "crash": 1.4}
    return x.play(x.mixdown(levels, lowpass=9000, room=0.03))


def main(out: str) -> None:
    write_wav(out, render())


if __name__ == "__main__":
    main(sys.argv[1])
