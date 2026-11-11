"""Song E (Eric, Nov 11, on Song D: "too upbeat and happy", "more battle style, start from scratch"): a 30-second loop
in the style of a 16-bit console RPG's battle music: dark, fast and tense. It isn't cut to the trailer.
144 beats a minute, 72 beats = 18 bars of four = 30.0 s. C minor, leaning on the tritone (F sharp) and a D flat chord.
Voices: a reed and brass lead, stabbing strings, a hammering 16th-note bass, a plucked run, timpani and a hard kit.
Every melody, riff and chord progression here is original: none of it is song A's, B's, C's or D's, or any game's.
  python3 song_e.py <out.wav>

  bars  1-2   the riff: every voice in unison, low
  bars  3-6   the attack: the lead's jabbing tune over the hammering bass and string stabs
  bars  7-10  the attack, higher: falling runs, a D flat chord, up to the top G
  bars 11-14  the squeeze: the bass steps down a half step a bar; strings carry a long line, brass stabs under it
  bars 15-16  the break out: a climb over A flat, then G
  bars 17-18  the riff again on G, two hits and a run that loops back to bar 1
"""
import sys

import numpy as np

from synth import Mix, chords, length, line, n, write_wav

BPM = 144.0
BEATS = 72
SECS = BEATS * 60 / BPM

# ---- the notes ----
RIFF = (
    "C3:.75 C3:.25 Eb3:.5 C3:.5 F#3:.5 G3:.5 Bb3:.5 G3:.5 | "
    "C3:.75 C3:.25 Eb3:.5 C3:.5 Ab3:.5 G3:.5 F#3:.25 G3:.25 B3:.5"
)
ATTACK = (
    "G4:.75 C5:.75 Eb5:.5 D5:.5 C5:.5 G4:1 | G4:.75 C5:.75 Eb5:.5 F5:.25 Eb5:.25 D5:.5 Eb5:1 | "
    "Eb5:.75 Ab5:.75 G5:.5 Eb5:.5 C5:.5 Eb5:1 | D5:.75 F5:.75 Bb5:.5 Ab5:.25 G5:.25 F5:.5 D5:1"
)
HIGHER = (
    "C6:.5 Bb5:.25 G5:.25 Eb5:.5 G5:.5 C6:.75 Bb5:.75 G5:.5 | Bb5:.5 G5:.25 Eb5:.25 Bb4:.5 Eb5:.5 G5:.75 Bb5:.75 Eb6:.5 | "
    "F6:1 Db6:.5 Ab5:.5 F5:.5 Ab5:.5 Db6:1 | D6:.75 B5:.75 G5:.5 B5:.25 D6:.25 F6:.25 D6:.25 G6:1"
)
SQUEEZE = "Eb5:1.5 D5:.5 C5:1 G5:1 | F5:1.5 Eb5:.5 D5:1 G5:1 | G5:1.5 F5:.5 D5:1 Bb5:1 | A5:1.5 G5:.5 F5:1 C6:1"
BREAK = "C6:.5 Ab5:.5 Eb5:.5 Ab5:.5 C6:.5 Eb6:.5 Ab6:1 | G6:.75 F6:.75 D6:.5 B5:.5 G5:.5 B5:.5 D6:.5"
TAG = (
    "G3:.75 G3:.25 Bb3:.5 G3:.5 Db4:.5 D4:.5 F4:.5 D4:.5 | "
    "Ab4:.5 -:.25 Ab4:.25 -:.5 G4:.5 G4:.25 A4:.25 B4:.25 C5:.25 D5:.25 Eb5:.25 F5:.25 G5:.25"
)
for name, beats in [(RIFF, 8), (ATTACK, 16), (HIGHER, 16), (SQUEEZE, 16), (BREAK, 8), (TAG, 8)]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

# ---- the chords ----
CM, G = "Eb4 G4 C5", "D4 G4 B4"
CHORD = chords(
    [
        (0, 8, CM, "C2"),
        # the attack: Cm, Cm, Ab, Bb | Cm, Eb, Db, G
        (8, 16, CM, "C2"), (16, 20, "Eb4 Ab4 C5", "Ab1"), (20, 24, "D4 F4 Bb4", "Bb1"),
        (24, 28, CM, "C2"), (28, 32, "Eb4 G4 Bb4", "Eb2"), (32, 36, "F4 Ab4 Db5", "Db2"), (36, 40, G, "G1"),
        # the squeeze: the bass C, B, B flat, A
        (40, 44, CM, "C2"), (44, 48, G, "B1"), (48, 52, "D4 G4 Bb4", "Bb1"), (52, 56, "F4 A4 C5", "A1"),
        # the break out and the tag: Ab, G | G
        (56, 60, "Eb4 Ab4 C5", "Ab1"), (60, 72, G, "G1"),
    ]
)
PANS = (-0.45, 0.0, 0.45)
STAB = (0, 0.75, 1.5, 2.25, 3, 3.5)  # the stabs' rhythm in a bar


def main(out: str) -> None:
    x = Mix(SECS, BEATS, seed=47)
    put = x.put

    def tune(start, text, voice, vol, gate=0.9, bus="lead", pan=0.0, up=0, **kw):
        for b, d, m in line(start, text):
            put(bus, b, voice(m + up, d * gate, vol, **kw), pan)

    def lead(start, text, vol=1.0):
        """A reed with the brass an octave under it."""
        tune(start, text, x.reed, 0.17 * vol)
        tune(start, text, x.brass, 0.13 * vol, up=-12, pan=-0.2)

    def stabs(a, b, voice="strings", vol=0.13, up=0):
        for bar in range(a, b, 4):
            for i, o in enumerate(STAB):
                notes, _ = CHORD(bar + o)
                for j, m in enumerate(notes):
                    if voice == "strings":
                        w = x.strings(m + up, 0.3, vol * (1.0 if i in (0, 4) else 0.8), attack=0.008, sustain=0.5, decay=0.08, release=0.04)
                    else:
                        w = x.brass(m + up, 0.3, vol * (1.0 if i in (0, 4) else 0.8), attack=0.01, release=0.03)
                    put(voice, bar + o, w, PANS[j])

    def hammer(a, b, vol=0.25):
        """The bass: 16ths on the root, every fourth one an octave up."""
        for i in range(int((b - a) * 4)):
            t = a + i * 0.25
            _, root = CHORD(t)
            put("bass", t, x.fmbass(root + 12 + (12 if i % 4 == 2 else 0), 0.21, vol * (1.0 if i % 4 == 0 else 0.8), index=2.4))

    def run(a, b, vol=0.2):
        """A plucked run: the chord in falling 16ths, high."""
        shape = (5, 4, 3, 4, 3, 2, 3, 2)
        for i in range(int((b - a) * 4)):
            t = a + i * 0.25
            notes, _ = CHORD(t)
            s = shape[i % 8]
            put("harp", t, x.pluck(notes[s % 3] + 12 * (s // 3), 0.6, vol, tone=0.9), 0.5 if i % 2 else -0.5)

    def timp(beat, m, vol=0.36):
        put("drum", beat, x.timp(m if m >= n("D2") else m + 12, 0.6, vol))

    def kit(a, b, four=False):
        """Kick on 1, the push before 3 and 3 (or every beat), snare on 2 and 4 with a ghost, 16th hats."""
        for bar in range(a, b, 4):
            for o in (0, 1, 2, 3) if four else (0, 1.75, 2, 3.5):
                x.kick(bar + o, 0.5 if o == int(o) else 0.36)
            x.snare(bar + 1, 0.24), x.snare(bar + 3, 0.24), x.snare(bar + 2.75, 0.09)
            for i in range(16):
                x.hat(bar + i * 0.25, 0.06 if i % 4 == 0 else 0.035 if i % 2 else 0.045)
            timp(bar, CHORD(bar)[1])

    def roll(at, steps, step=0.25, v0=0.1, dv=0.025):
        for i in range(steps):
            x.snare(at + i * step, v0 + dv * i)

    def unison(start, text):
        """The riff: bass, low strings and brass on the same notes, a kick and a snare stroke on each."""
        for b, d, m in line(start, text):
            put("bass", b, x.fmbass(m - 12, d * 0.85, 0.24, index=2.4))
            put("strings", b, x.strings(m, d * 0.8, 0.11, attack=0.01, release=0.04), -0.35)
            put("strings", b, x.strings(m + 12, d * 0.8, 0.09, attack=0.01, release=0.04), 0.35)
            put("lead", b, x.brass(m + 12, d * 0.8, 0.125, attack=0.012))
            x.kick(b, 0.5)
            if d >= 0.5:
                x.snare(b + d - 0.25, 0.08)

    # Bars 1-2: the riff.
    x.crash(0, 0.24)
    unison(0, RIFF)
    for i in range(32):
        x.hat(i * 0.25, 0.05 if i % 2 == 0 else 0.03)
    timp(0, n("C2"), 0.42), timp(4, n("C2"), 0.36)
    roll(7, 4, 0.25, 0.12, 0.035)

    # Bars 3-6: the attack.
    x.crash(8, 0.26)
    lead(8, ATTACK)
    stabs(8, 24)
    hammer(8, 24)
    kit(8, 24)
    roll(23.5, 2, 0.25, 0.14, 0.05)

    # Bars 7-10: higher. Strings double the lead an octave up; the plucked run joins.
    x.crash(24, 0.2)
    lead(24, HIGHER)
    tune(24, HIGHER, x.strings, 0.07, pan=0.3, attack=0.02)
    stabs(24, 40)
    run(24, 40)
    hammer(24, 40)
    kit(24, 40)
    roll(39, 8, 0.125, 0.08, 0.02)

    # Bars 11-14: the squeeze. The bass steps down; strings in octaves carry the line, brass stabs under it.
    x.crash(40, 0.22)
    tune(40, SQUEEZE, x.strings, 0.15, gate=0.97, bus="strings", pan=-0.25, attack=0.03)
    tune(40, SQUEEZE, x.strings, 0.11, gate=0.97, bus="strings", pan=0.25, up=12, attack=0.03)
    tune(40, SQUEEZE, x.reed, 0.07, up=12)
    stabs(40, 56, voice="brass", vol=0.1)
    hammer(40, 56)
    kit(40, 56, four=True)
    for bar in range(40, 56, 4):
        x.snare(bar + 3.5, 0.12), x.snare(bar + 3.75, 0.16)

    # Bars 15-16: the break out.
    x.crash(56, 0.22)
    lead(56, BREAK)
    tune(56, BREAK, x.strings, 0.07, pan=0.3, attack=0.02)
    stabs(56, 64)
    run(56, 64)
    hammer(56, 64)
    kit(56, 64)
    roll(63, 8, 0.125, 0.08, 0.02)

    # Bars 17-18: the riff on G, two hits, and the run back to bar 1.
    x.crash(64, 0.24)
    unison(64, TAG)
    for i in range(32):
        x.hat(64 + i * 0.25, 0.05 if i % 2 == 0 else 0.03)
    timp(64, n("G2"), 0.42)
    for i in range(16):
        put("drum", 70 + i * 0.125, x.timp(n("G2"), 0.25, 0.06 + 0.016 * i))
    roll(70, 8, 0.25, 0.08, 0.02)

    x.echo("lead", 0.75, 0.14, 0.06)
    levels = {"strings": 1.5, "brass": 1.4, "harp": 1.6}
    write_wav(out, x.mixdown(levels, lowpass=8000, room=0.22))


if __name__ == "__main__":
    main(sys.argv[1])
