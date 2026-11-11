"""Track A, the chiptune (Eric's pick, Nov 10), extended and rearranged for the trailer's cut (timeline.py): the same
theme and the same sound (two pulse voices, a 16-step triangle bass, noise drums, an echo on the lead), with new
sections where the new scenes are. D minor; the town in F major, the night in D minor, Transcendent on D major.
Every melody here is original.
  python3 track_a.py <out.wav>
"""
import sys

import numpy as np

import timeline as T
from synth import Mix, chords, length, line, n, write_wav

# ---- the notes ----
# 50 v 50 (0-12): the fanfare, then a tag that turns to the town.
FANFARE = "D5:.75 D5:.25 F5:.5 A5:.5 G5:1 F5:.5 E5:.5 | F5:.75 F5:.25 G5:.5 Bb5:.5 C6:1 G5:.5 E5:.5"
TAG = "D6:.75 D6:.25 Bb5:.5 G5:.5 C6:.5 Bb5:.5 G5:.5 E5:.5"
# The town by day (12-36): the old town tune, then a new answer that climbs to the night.
TOWN = (
    "A5:.5 C6:.5 A5:.5 F5:.5 G5:.5 A5:.5 C6:1 | G5:.5 C6:.5 G5:.5 E5:.5 F5:.5 G5:.5 E5:1 | "
    "F5:.5 A5:.5 D6:.5 A5:.5 F5:.5 A5:.5 D6:1 | D6:.5 Bb5:.5 F5:.5 Bb5:.5 E6:.5 C6:.5 G5:.5 C6:.5 | "
    "C6:.5 A5:.5 F5:.5 A5:.5 C6:.5 D6:.5 F6:1 | E6:.5 C6:.5 G5:.5 Bb5:.5 A5:.5 C#6:.5 E6:1"
)
# The night ride (36-48): new, slow and singing.
NIGHT = "A5:1.5 G5:.5 F5:1 D5:1 | F5:1.5 E5:.5 D5:1 Bb4:1 | D5:1 G5:1 E5:2"
# Big Boy (48-64): his stomp twice (the second climbing), the climb as his blocks fall, the candy swirl's hit.
STOMP = "D3:1 D3:.5 F3:.5 Ab3:1 G3:.5 A3:.5 | D3:1 D3:.5 F3:.5 Ab3:.5 A3:.5 C4:.5 D4:.5"
RISER = "A4:.5 Bb4:.5 B4:.5 C5:.5 C#5:.5 D5:.5 E5:.25 F5:.25 G5:.25 A5:.25"
SPLASH = "D3:1 F3:.5 D3:.5 Ab3:.5 A3:.5 D4:1"
# The boss mashup (64-88): new, the battle: four phrases of six beats, one per boss.
BATTLE = [
    "D5:.5 D5:.25 E5:.25 F5:.5 A5:.5 D6:1 A5:.5 F5:.5 | G5:.5 E5:.5 C5:.5 E5:.5",
    "F5:.5 F5:.25 G5:.25 Bb5:.5 D6:.5 F6:1 D6:.5 Bb5:.5 | C6:.5 G5:.5 E5:.5 G5:.5",
    "G5:.5 G5:.25 A5:.25 Bb5:.5 D6:.5 G6:1 F6:.5 D6:.5 | Bb5:.5 D6:.5 F6:.5 D6:.5",
    "E6:.75 E6:.25 C#6:.5 A5:.5 E6:.75 E6:.25 C#6:.5 A5:.5 | A5:.25 B5:.25 C#6:.25 D6:.25 E6:.5 A6:.5",
]
# Squads (88-100): new, a march for a team: the tune and a second voice under it.
SQUADS = "F5:1 Bb5:.5 D6:.5 C6:1 Bb5:.5 A5:.5 | G5:1 C6:.5 E6:.5 D6:1 C6:.5 Bb5:.5 | A5:.5 D6:.5 F6:1 E6:.5 C6:.5 G5:1"
SQUADS_2 = "D5:1 F5:.5 Bb5:.5 A5:1 F5:.5 F5:.5 | E5:1 G5:.5 C6:.5 Bb5:1 G5:.5 G5:.5 | F5:.5 A5:.5 D6:1 C6:.5 G5:.5 E5:1"
# Ranked (100-107): the fanfare, pushed on.
RANKED = "D5:.75 D5:.25 F5:.5 A5:.5 G5:1 F5:.5 E5:.5 | F5:.75 F5:.25 G5:.5 Bb5:.5 A5:1"
# The run up the ranks: one note per rank, the last landing on Transcendent (beat 112).
RUN = ["A4", "B4", "C#5", "D5", "E5", "F#5", "A5", "C#6"]
# The Hidden Boss (116-136): a low line under the held D, heard this time.
HIDDEN = "D3:4 Eb3:2 D3:2 | A2:4 D3:2 F3:2 | Eb3:4"
PICKUP = "A4:.5 C#5:.5"
for name, beats in [(FANFARE, 8), (TAG, 4), (TOWN, 24), (NIGHT, 12), (STOMP, 8), (RISER, 4), (SPLASH, 4), (SQUADS, 12), (SQUADS_2, 12), (RANKED, 7), (HIDDEN, 20)] + [(b, 6) for b in BATTLE]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

CHORD = chords(
    [
        (0, 4, "D4 F4 A4", "D2"), (4, 6, "D4 F4 Bb4", "Bb1"), (6, 8, "E4 G4 C5", "C2"), (8, 10, "D4 G4 Bb4", "G1"), (10, 12, "E4 G4 C5", "C2"),
        (12, 16, "F4 A4 C5", "F2"), (16, 20, "E4 G4 C5", "C2"), (20, 24, "D4 F4 A4", "D2"), (24, 26, "D4 F4 Bb4", "Bb1"), (26, 28, "E4 G4 C5", "C2"),
        (28, 32, "F4 A4 C5", "F2"), (32, 34, "E4 G4 C5", "C2"), (34, 36, "E4 A4 C#5", "A1"),
        (36, 40, "D4 F4 A4", "D2"), (40, 44, "D4 F4 Bb4", "Bb1"), (44, 46, "D4 G4 Bb4", "G1"), (46, 48, "E4 A4 C#5", "A1"),
        (48, 56, "D4 F4 A4", "D2"), (56, 60, "E4 A4 C#5", "A1"), (60, 64, "D4 F4 A4", "D2"),
        (64, 68, "D4 F4 A4", "D2"), (68, 70, "E4 G4 C5", "C2"), (70, 74, "D4 F4 Bb4", "Bb1"), (74, 76, "E4 G4 C5", "C2"),
        (76, 80, "D4 G4 Bb4", "G1"), (80, 82, "D4 F4 Bb4", "Bb1"), (82, 88, "E4 A4 C#5", "A1"),
        (88, 92, "D4 F4 Bb4", "Bb1"), (92, 96, "E4 G4 C5", "C2"), (96, 98, "D4 F4 A4", "D2"), (98, 100, "E4 G4 C5", "C2"),
        (100, 104, "D4 F4 A4", "D2"), (104, 106, "D4 F4 Bb4", "Bb1"), (106, 107, "D4 G4 Bb4", "G1"), (107, 112, "E4 A4 C#5", "A1"),
        (112, 116, "D4 F#4 A4", "D2"),
    ]
)


def main(out: str) -> None:
    x = Mix(T.SECS, T.BEATS, os=4)
    put, pulse, tri = x.put, x.pulse, x.tri
    kick, snare, hat, crash = x.kick, x.snare, x.hat, x.crash

    def lead(start, text, duty=0.5, vol=0.2, gate=0.92, vib=0.006, octave=None, bus="lead", pan=0.0):
        for b, d, m in line(start, text):
            put(bus, b, pulse(m, d * gate, duty, vol, vib if d >= 0.75 else 0), pan)
            if octave is not None:
                put(bus, b, pulse(m + octave, d * gate, 0.125, vol * 0.4), pan)

    def arp(a, b, step=0.25, vol=0.07, up=12):
        """The chord as a quick broken run, the classic way to fake harmony with one voice."""
        t, i = a, 0
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            put("arp", t, pulse(notes[i % 3] + up * ((i // 3) % 2), step * 0.9, 0.25, vol, decay=0.05, sustain=0.4), -0.5 if i % 2 else 0.5)
            t, i = t + step, i + 1

    def bass(a, b, step=0.5, vol=0.34, bounce=False, gate=0.8, octave=False):
        t, i = a, 0
        while t < b - 1e-6:
            _, root = CHORD(t)
            m = root + 12 + (7 if bounce and i % 2 else 0) + (12 if octave and i % 2 else 0)
            put("bass", t, tri(m, step * gate, vol))
            t, i = t + step, i + 1

    def beat(a, b, drive=False):
        for q in range(a, b):
            kick(q) if (q - a) % 2 == 0 else snare(q)
            if drive:
                if (q - a) % 2 == 0:
                    kick(q + 0.75, 0.3)
                for s in (0.25, 0.5, 0.75):
                    hat(q + s, 0.05 if s != 0.5 else 0.08)
            else:
                hat(q + 0.5)

    def fill(at, steps=4, step=0.25, v0=0.1, dv=0.04):
        for i in range(steps):
            snare(at + i * step, v0 + dv * i)

    # 1. 50 v 50 (0-12): the fanfare, full on, and its tag.
    lead(0, FANFARE)
    lead(8, TAG, octave=12)
    arp(0, 12)
    bass(0, 12)
    beat(0, 12)
    crash(0, 0.2)
    fill(11)

    # 2. The town by day (12-36): lighter. A thin, bouncy lead, a hopping bass, off-beat chord pips; no snare.
    lead(12, TOWN, duty=0.125, vol=0.19, gate=0.7, vib=0)
    bass(12, 36, step=1, vol=0.3, bounce=True, gate=0.45)
    for b in range(12, 36):
        notes, _ = CHORD(b)
        for j, m in enumerate(notes[1:]):
            put("arp", b + 0.5, pulse(m, 0.22, 0.25, 0.06, decay=0.04, sustain=0.3), 0.5 if j else -0.5)
        hat(b + 0.5, 0.06)
        if b % 2 == 0:
            kick(b, 0.3)
        if b >= 28:  # the answer: a little more push
            hat(b + 0.25, 0.035), hat(b + 0.75, 0.035)
    for i in range(4):  # a soft roll down into the night
        put("drum", 35 + i * 0.25, tri(69 - 3 * i, 0.2, 0.16 - 0.02 * i, sustain=0.0, decay=0.05))

    # 3. The night ride (36-48): the lead slow and singing with more echo, a slow broken chord like stars, a long bass.
    for b, d, m in line(36, NIGHT):
        put("night", b, pulse(m, d * 0.96, 0.25, 0.17, 0.008, decay=0.3, sustain=0.7, release=0.08))
    t, i = 36.0, 0
    while t < 48 - 1e-6:
        notes, root = CHORD(t)
        m = [notes[0], notes[1], notes[2], notes[1] + 12, notes[2], notes[1]][i % 6] + 12
        put("arp", t, pulse(m, 0.45, 0.125, 0.05, decay=0.12, sustain=0.15), 0.6 if i % 2 else -0.6)
        t, i = t + 0.5, i + 1
    for b in range(36, 48, 2):
        _, root = CHORD(b)
        put("bass", b, tri(root + 12, 1.9, 0.22, attack=0.02, release=0.1))
    for b in range(36, 48):
        hat(b + 0.5, 0.035)
        if b % 4 == 0:
            kick(b, 0.28)
    for b, m in [(38.5, 93), (42.5, 89), (45.5, 91), (47, 88), (47.5, 93)]:  # twinkles
        put("arp", b, pulse(m, 0.5, 0.125, 0.04, decay=0.07, sustain=0.0), 0.4)

    # 4. Big Boy (48-64): his stomp in octaves (his card, in at his door, his blocks), a climb, then the swirl's hit.
    for b, d, m in line(48, STOMP):
        put("lead", b, pulse(m, d * 0.85, 0.25, 0.17, decay=0.12, sustain=0.5))
        put("lead", b, pulse(m + 12, d * 0.85, 0.125, 0.07))
        put("bass", b, tri(m, d * 0.85, 0.27))
        kick(b, 0.5)
    for b in (49, 51, 53, 55):
        snare(b, 0.16)
    for b in (52, 53, 54, 55):  # his blocks dropping in: a falling "tok" on each off-beat
        put("arp", b + 0.5, pulse(84, 0.2, 0.25, 0.09, bend=(0, -12), decay=0.04, sustain=0.0), 0.5 if b % 2 else -0.5)
    lead(56, RISER, duty=0.25, vol=0.18, vib=0)
    bass(56, 60, step=0.25, vol=0.3)
    put("arp", 58, pulse(57, 2, 0.5, 0.07, bend=(0, 24), sustain=1.0))
    for i in range(16):
        snare(56 + i * 0.25, 0.05 + 0.011 * i)
    for i in range(8):
        snare(59 + i * 0.125, 0.14 + 0.012 * i)
    crash(60, 0.34)
    for i, m in enumerate([86, 81, 77, 74, 69, 65, 62, 65, 69, 74, 77, 81, 86, 89, 93, 98]):  # the candy swirl: down and round again
        put("arp", 60 + i * 0.125, pulse(m, 0.12, 0.25, 0.1), 0.6 * np.sin(i * 0.8))
    for b, d, m in line(60, SPLASH):
        put("lead", b, pulse(m, d * 0.85, 0.25, 0.17, decay=0.12, sustain=0.5))
        put("lead", b, pulse(m + 12, d * 0.85, 0.125, 0.07))
        put("bass", b, tri(m, d * 0.85, 0.27))
        kick(b, 0.5)
    snare(63, 0.2), snare(63.5, 0.22), snare(63.75, 0.24)

    # 5. The boss mashup (64-88): the battle. Each boss's cut opens on a crash; the lead doubled an octave up.
    for at, phrase in zip(T.MASH, BATTLE):
        lead(at, phrase, octave=12, vol=0.22)
        crash(at, 0.26, 0.3)
        kick(at, 0.6)
    arp(64, 88, vol=0.08)
    bass(64, 82, step=0.25, vol=0.34, octave=True, gate=0.7)
    bass(82, 88, step=0.25, vol=0.32, gate=0.7)
    for b in range(64, 88):
        ph = (b - 64) % 6
        kick(b) if ph in (0, 2, 4) else snare(b, 0.24)
        if ph in (0, 2):
            kick(b + 0.75, 0.3)
        for s in (0.25, 0.5, 0.75):
            hat(b + s, 0.05 if s != 0.5 else 0.08)
    for at in T.MASH[1:]:
        fill(at - 0.5, 2, 0.25, 0.16, 0.05)
    for i in range(8):
        snare(87 + i * 0.125, 0.12 + 0.014 * i)

    # 6. Squads (88-100): a march: the tune on one side and its second voice on the other, a snare tattoo.
    crash(88, 0.26)
    lead(88, SQUADS, vol=0.17, pan=-0.35, octave=12)
    lead(88, SQUADS_2, duty=0.25, vol=0.13, bus="arp", pan=0.4)
    bass(88, 100, step=1, vol=0.34, bounce=True, gate=0.6)
    for b in range(88, 100):
        kick(b, 0.45)
        snare(b + 0.5, 0.13)
        if b % 2:
            snare(b + 0.75, 0.1), snare(b, 0.2)
        hat(b + 0.25, 0.04)
    fill(99, 4, 0.25, 0.12, 0.04)

    # 7. Ranked (100-107): the fanfare again over a driving beat.
    lead(100, RANKED, octave=12)
    arp(100, 107)
    bass(100, 107)
    beat(100, 107, drive=True)

    # The run up the ranks (107-112): one note per rank over a held bass and a growing roll.
    for i, (b, p) in enumerate(zip(T.RUN_AT, RUN)):
        v = 0.15 + 0.012 * i
        put("lead", b, pulse(n(p), 0.8, 0.5, v, decay=0.1, sustain=0.35))
        put("lead", b, pulse(n(p) + 12, 0.8, 0.125, v * 0.5, decay=0.1, sustain=0.35))
    bass(107, 112, vol=0.3)
    kick(107)
    for i in range(20):
        snare(107 + i * 0.25, 0.04 + 0.011 * i)

    # Transcendent (112-116): a bright D major burst that sparkles and rings out.
    crash(112, 0.36, 0.6)
    kick(112, 0.6)
    for i, m in enumerate([62, 66, 69, 74, 78, 81, 86, 90, 93, 98]):
        put("arp", 112 + i * 0.1, pulse(m, 0.5, 0.25, 0.1, decay=0.12, sustain=0.2), 0.6 if i % 2 else -0.6)
    top = n("D6")
    put("lead", 112, pulse(top, 3.4, 0.5, 0.2, vib=0.007, decay=0.6, sustain=0.25, release=0.5))
    put("lead", 112, pulse(top - 8, 3.4, 0.25, 0.1, decay=0.6, sustain=0.25, release=0.5))
    put("bass", 112, tri(50, 3.4, 0.36, decay=0.8, sustain=0.3, release=0.4))
    for i in range(10):  # the held chord, shimmering
        f = 1 - i / 10
        for j, m in enumerate([74, 78, 81]):
            put("arp", 113 + i * 0.25 + j * 0.083, pulse(m, 0.08, 0.125, 0.09 * f), -0.6 + 0.6 * j)
    for b, m in [(113.5, 93), (114.25, 98), (114.75, 102)]:
        put("arp", b, pulse(m, 0.6, 0.125, 0.05, decay=0.08, sustain=0.0), 0.4)

    # 8. The Hidden Boss (116-136): the drop, a low held D with two thin voices beating against each other, a slow low
    # line you can hear (Eric, Nov 11: "loud enough to hear"), an E flat rubbing on it, a heartbeat, breaths, glints.
    put("drum", 116, tri(38, 0.5 / x.beat_s, 0.6, bend=(10, -8), decay=0.2, sustain=0.0))
    held = dict(attack=0.01, sustain=1.0, release=0.05)
    put("dark", 116, x.swell(tri(38, 19, 0.3, **held), 0.12))
    put("dark", 116, x.swell(pulse(50, 19, 0.125, 0.06, **held), 0.12), -0.3)
    put("dark", 116, x.swell(pulse(50.12, 19, 0.125, 0.06, **held), 0.12), 0.3)  # a hair sharp: a slow beat between the two
    for b, d, m in line(116, HIDDEN):
        put("dark", b, x.swell(pulse(m, d, 0.25, 0.13, 0.004, attack=0.05, sustain=1.0, release=0.1), 0.3))
        put("dark", b, x.swell(tri(m + 12, d, 0.12, attack=0.05, release=0.1), 0.3))
    put("dark", 122, x.swell(pulse(63, 6, 0.25, 0.06, **held), 0.6))  # the E flat above, leaning on the D
    put("dark", 128, x.swell(pulse(63, 6, 0.25, 0.075, **held), 0.7))
    for b in range(118, 134, 4):  # his heartbeat
        kick(b, 0.5), kick(b + 0.6, 0.34)
    for a, d in ((117.0, 5), (123.5, 5), (129.5, 4.5)):
        put("dark", a, x.rumble(d, 0.11))
    for b in (123.0, 126.5, 131.0):  # the glint of his eye
        put("lead", b, pulse(98, 0.5, 0.125, 0.09, decay=0.1, sustain=0.0))
        put("lead", b + 0.25, pulse(105, 0.4, 0.125, 0.05, decay=0.08, sustain=0.0), 0.4)

    # The way back (134-136): a roll swells and two pickup notes cross the loop point into the fanfare.
    for i in range(8):
        put("bass", 134 + i * 0.25, tri(45, 0.2, 0.1 + 0.03 * i))
        snare(134 + i * 0.25, 0.03 + 0.018 * i)
    lead(135, PICKUP, vol=0.18, vib=0)
    snare(135.75, 0.2)

    # Mix: a two-tap echo on the lead (a longer, wetter one on the night's), then down to 48 kHz and a gentle low-pass.
    x.echo("lead", 0.75)
    x.echo("night", 1.5, 0.42, 0.22)
    write_wav(out, x.mixdown({"night": 0.85, "dark": 0.72}, lowpass=9000))


if __name__ == "__main__":
    main(sys.argv[1])
