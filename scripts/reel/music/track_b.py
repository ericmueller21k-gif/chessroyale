"""Track B: a new, different song over the same cut (timeline.py), in the sound of a 16-bit console's adventure
music: strings, a breathy flute, a plucked harp, bells, a round bass and timpani, with the brass kept to a few short
stabs on the big hits (Eric, Nov 11: "less brass, more of the other voices"). E major and its neighbors: the town in A
major, the night in F sharp minor, the bosses in E minor, Transcendent on E major, the Hidden Boss on a low E with an F
leaning on it. Every melody here is original, and none of it is track A's.
  python3 track_b.py <out.wav>
"""
import sys

import numpy as np

import timeline as T
from synth import Mix, chords, length, line, n, write_wav

# ---- the notes ----
# 50 v 50 (0-12): the call: a leap of a fifth and a turn.
CALL = "E5:1 B5:1 A5:.5 G#5:.5 E5:1 | F#5:1 A5:1 D6:.5 C#6:.5 A5:1 | C#6:.5 B5:.5 A5:.5 E5:.5 F#5:.5 G#5:.5 B5:1"
# The town by day (12-36): a lilting tune for the flute over a harp.
TOWN = (
    "C#6:1 E6:.5 C#6:.5 A5:1 B5:.5 C#6:.5 | B5:1 E6:.5 B5:.5 G#5:1 A5:.5 B5:.5 | A5:1 C#6:.5 A5:.5 F#5:1 G#5:.5 A5:.5 | "
    "F#5:.5 A5:.5 D6:1 C#6:.5 B5:.5 A5:1 | C#6:1 E6:.5 A6:.5 G#6:1 E6:1 | F#6:.5 E6:.5 D6:.5 B5:.5 E6:2"
)
# The night ride (36-48): bells over held strings.
NIGHT = "C#6:2 A5:1 F#5:1 | D6:2 A5:1 F#5:1 | E6:1 B5:1 G#5:2"
# Big Boy (48-64): a waddle for low reeds and plucked strings, a climb, the swirl.
WADDLE = "E2:1 E2:.5 G2:.5 Bb2:1 A2:.5 B2:.5 | E2:1 E2:.5 G2:.5 Bb2:.5 B2:.5 D3:.5 E3:.5"
CLIMB = "B3:.5 C4:.5 C#4:.5 D4:.5 D#4:.5 E4:.5 F#4:.25 G4:.25 A4:.25 B4:.25"
SWIRL = "E2:1 G2:.5 E2:.5 Bb2:.5 B2:.5 E3:1"
# The boss mashup (64-88): the battle: four phrases of six beats, one per boss.
BATTLE = [
    "E5:.5 G5:.5 B5:1 A5:.5 G5:.5 F#5:.5 G5:.5 | A5:.5 F#5:.5 D5:1",
    "G5:.5 B5:.5 E6:1 D6:.5 C6:.5 B5:.5 C6:.5 | D6:.5 A5:.5 F#5:1",
    "A5:.5 C6:.5 E6:1 G6:.5 E6:.5 C6:.5 E6:.5 | G6:.5 E6:.5 C6:1",
    "F#6:1 D#6:.5 B5:.5 F#6:1 D#6:.5 B5:.5 | B5:.5 C#6:.5 D#6:.5 F#6:.5",
]
# Squads (88-100): the call again, answered and carried up.
SQUADS = "E5:1 B5:1 A5:.5 G#5:.5 E5:1 | A5:1 C#6:1 E6:.5 D#6:.5 C#6:1 | B5:.5 D#6:.5 F#6:1 B6:2"
SQUADS_2 = "G#4:1 E5:1 E5:.5 E5:.5 B4:1 | C#5:1 A5:1 C#6:.5 B5:.5 A5:1 | F#5:.5 B5:.5 D#6:1 F#6:2"
# Ranked (100-107): pressing on.
RANKED = "G#5:.5 G#5:.5 C#6:1 B5:.5 G#5:.5 E5:1 | A5:.5 A5:.5 C#6:1 B5:1"
RUN = ["B4", "C#5", "D#5", "E5", "F#5", "G#5", "B5", "D#6"]
# The Hidden Boss (116-136): low strings under the dark.
HIDDEN = "E3:4 F3:2 E3:2 | B2:4 E3:2 G3:2 | F3:4"
PICKUP = "B4:.5 D#5:.5"
for name, beats in [(CALL, 12), (TOWN, 24), (NIGHT, 12), (WADDLE, 8), (CLIMB, 4), (SWIRL, 4), (SQUADS, 12), (SQUADS_2, 12), (RANKED, 7), (HIDDEN, 20)] + [(b, 6) for b in BATTLE]:
    assert abs(length(name) - beats) < 1e-9, (name, length(name))

CHORD = chords(
    [
        (0, 4, "E4 G#4 B4", "E2"), (4, 8, "D4 F#4 A4", "D2"), (8, 10, "E4 A4 C#5", "A1"), (10, 12, "D#4 F#4 B4", "B1"),
        (12, 16, "E4 A4 C#5", "A1"), (16, 20, "E4 G#4 B4", "G#1"), (20, 24, "F#4 A4 C#5", "F#1"), (24, 28, "D4 F#4 A4", "D2"),
        (28, 32, "E4 A4 C#5", "A1"), (32, 36, "E4 G#4 B4", "E2"),
        (36, 40, "F#4 A4 C#5", "F#1"), (40, 44, "D4 F#4 A4", "D2"), (44, 46, "E4 G#4 B4", "E2"), (46, 48, "E#4 G#4 C#5", "C#2"),
        (48, 56, "E4 G4 B4", "E2"), (56, 60, "D#4 F#4 B4", "B1"), (60, 64, "E4 G#4 B4", "E2"),
        (64, 68, "E4 G4 B4", "E2"), (68, 70, "D4 F#4 A4", "D2"), (70, 74, "E4 G4 C5", "C2"), (74, 76, "D4 F#4 A4", "D2"),
        (76, 80, "E4 A4 C5", "A1"), (80, 82, "E4 G4 C5", "C2"), (82, 88, "D#4 F#4 B4", "B1"),
        (88, 92, "E4 G#4 B4", "E2"), (92, 96, "E4 A4 C#5", "A1"), (96, 100, "D#4 F#4 B4", "B1"),
        (100, 104, "E4 G#4 C#5", "C#2"), (104, 107, "E4 A4 C#5", "A1"), (107, 112, "D#4 F#4 B4", "B1"),
        (112, 116, "E4 G#4 B4", "E2"),
    ]
)


def main(out: str) -> None:
    x = Mix(T.SECS, T.BEATS, os=1, seed=11)
    put = x.put

    def pad(a, b, vol=0.07, up=0, hold=None):
        """The strings holding each chord (a new bow where the chord changes, or every `hold` beats)."""
        t = a
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            end = t + 0.5
            while end < b - 1e-6 and CHORD(end)[0] == notes and (hold is None or end - t < hold):
                end += 0.5
            for j, m in enumerate(notes):
                put("strings", t, x.strings(m + up, end - t, vol), (-0.5, 0.0, 0.5)[j])
            t = end

    def stabs(beats, vol=0.11, d=0.3):
        """Short string chords, bowed hard."""
        for b in beats:
            notes, _ = CHORD(b)
            for j, m in enumerate(notes):
                put("strings", b, x.strings(m + 12, d, vol, attack=0.008, sustain=0.5, decay=0.08, release=0.04), (-0.5, 0.0, 0.5)[j])

    def harp(a, b, step=0.5, vol=0.2, shape=(0, 1, 2, 1), up=12):
        t, i = a, 0
        while t < b - 1e-6:
            notes, _ = CHORD(t)
            k = shape[i % len(shape)]
            put("harp", t, x.pluck(notes[k % 3] + up + 12 * (k // 3), 1.6, vol), 0.45 * np.sin(i * 1.3))
            t, i = t + step, i + 1

    def bass(a, b, pattern=(0.0, 1.0, 2.0, 3.0), vol=0.3, gate=0.8, fifth=False):
        for bar in np.arange(a, b, 4):
            for i, off in enumerate(pattern):
                t = bar + off
                if t >= b - 1e-6:
                    continue
                _, root = CHORD(t)
                nxt = pattern[i + 1] if i + 1 < len(pattern) else 4.0
                put("bass", t, x.fmbass(root + 12 + (7 if fifth and i % 2 else 0), (nxt - off) * gate, vol))

    def tune(start, text, voice, vol, gate=0.95, bus="lead", pan=0.0, up=0, **kw):
        for b, d, m in line(start, text):
            put(bus, b, voice(m + up, d * gate, vol, **kw), pan)

    def timp(beat, note, vol=0.4):
        put("drum", beat, x.timp(n(note), 0.7, vol))

    def roll(a, b, note, v0=0.05, v1=0.3, step=0.125):
        k = int(round((b - a) / step))
        for i in range(k):
            put("drum", a + i * step, x.timp(n(note), 0.25, v0 + (v1 - v0) * i / k))

    def snare(b, vol=0.16):
        x.snare(b, vol)

    # 1. 50 v 50 (0-12): the call on flute and bells together over full strings; one brass stab on the first beat.
    tune(0, CALL, x.flute, 0.2)
    tune(0, CALL, x.bell, 0.07, up=12, decay=0.35)
    tune(0, CALL, x.reed, 0.06, up=-12, pan=-0.2)
    pad(0, 12, 0.07)
    stabs([0, 1.5, 3, 4, 5.5, 7, 8, 9, 10, 11], 0.08)
    bass(0, 12, (0, 1.5, 2, 3, 3.5), 0.3)
    for m in CHORD(0)[0]:
        put("brass", 0, x.brass(m, 0.9, 0.1))
    x.crash(0, 0.16)
    for b in range(0, 12):
        x.kick(b, 0.5, soft=True) if b % 2 == 0 else snare(b)
        x.hat(b + 0.5, 0.05)
    timp(0, "E2"), timp(4, "D2", 0.3), timp(8, "A1", 0.3), timp(10, "B1", 0.3)
    roll(11, 12, "B1", 0.1, 0.3)

    # 2. The town by day (12-36): the flute's tune over a rolling harp, pizzicato bass, a shaker; strings join at 28.
    tune(12, TOWN, x.flute, 0.22, gate=0.9)
    harp(12, 36, 0.5, 0.2, (0, 1, 2, 3, 2, 1, 2, 1))
    bass(12, 36, (0, 2, 3), 0.26, gate=0.5, fifth=True)
    pad(28, 36, 0.05)
    for b in range(12, 36):
        x.hat(b + 0.5, 0.045), x.hat(b + 0.25, 0.02), x.hat(b + 0.75, 0.02)
        if b % 2 == 0:
            x.kick(b, 0.3, soft=True)
        if b >= 28 and b % 2:
            put("drum", b, x.noise(0.05, 7000, 0.07, 0.02))  # a rim click
    for i, m in enumerate([88, 85, 81, 76]):  # four bells down into the night
        put("bell", 35 + i * 0.25, x.bell(m, 1.0, 0.07, decay=0.3), 0.3)

    # 3. The night ride (36-48): slow bells and a flute far below them, the strings held, the harp in slow sixths.
    tune(36, NIGHT, x.bell, 0.16, bus="bell", decay=0.9)
    tune(36, NIGHT, x.flute, 0.1, up=-12, pan=0.25)
    pad(36, 48, 0.085)
    harp(36, 48, 1.0, 0.17, (0, 2, 4, 2), up=0)
    bass(36, 48, (0,), 0.26, gate=0.9)
    for b, m in [(38.5, 97), (42.5, 93), (45.5, 95), (47, 92), (47.5, 97)]:  # stars
        put("bell", b, x.bell(m, 1.2, 0.045, ratio=5.0, decay=0.5), 0.5)
    for b in range(36, 48):
        x.hat(b + 0.5, 0.025)

    # 4. Big Boy (48-64): a waddle on a low reed with plucked strings an octave up; the climb in tremolo strings and a
    # timpani roll as his blocks fall; the swirl: a harp sweeping down and up, bells, the one brass stab.
    for b, d, m in line(48, WADDLE):
        put("low", b, x.reed(m + 12, d * 0.8, 0.2))
        put("harp", b, x.pluck(m + 24, 1.0, 0.2, tone=0.3))
        put("bass", b, x.fmbass(m + 12, d * 0.8, 0.24))
        x.kick(b, 0.4, soft=True)
    for b in (49, 51, 53, 55):
        snare(b, 0.1)
    for b in (52, 53, 54, 55):  # his blocks: wooden knocks on the off-beats
        put("drum", b + 0.5, x.bell(72 - (b - 52) * 3, 0.3, 0.12, ratio=1.41, index=3, decay=0.06), 0.5 if b % 2 else -0.5)
    for b, d, m in line(56, CLIMB):
        for i in range(int(round(d / 0.125))):  # tremolo
            put("strings", b + i * 0.125, x.strings(m + 12, 0.12, 0.07 + 0.006 * (b - 56) * 4, attack=0.01, release=0.02))
            put("strings", b + i * 0.125, x.strings(m, 0.12, 0.06, attack=0.01, release=0.02), -0.4)
    bass(56, 60, (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5), 0.22)
    roll(56, 60, "B1", 0.04, 0.34)
    x.crash(60, 0.22)
    timp(60, "E2", 0.5)
    for m in CHORD(60)[0]:
        put("brass", 60, x.brass(m, 0.8, 0.1))
    for i, m in enumerate([88, 83, 80, 76, 71, 68, 64, 68, 71, 76, 80, 83, 88, 92, 95, 100]):  # the swirl
        put("harp", 60 + i * 0.125, x.pluck(m, 1.2, 0.2, tone=0.8), 0.7 * np.sin(i * 0.8))
        put("bell", 60 + i * 0.125, x.bell(m, 0.6, 0.035, decay=0.2), -0.7 * np.sin(i * 0.8))
    for b, d, m in line(60, SWIRL):
        put("low", b, x.reed(m + 12, d * 0.8, 0.2))
        put("bass", b, x.fmbass(m + 12, d * 0.8, 0.24))
        x.kick(b, 0.4, soft=True)
    roll(63, 64, "E2", 0.1, 0.32)

    # 5. The boss mashup (64-88): the battle: the tune on a reed with the flute an octave up, a galloping bass, string
    # stabs on the off-beats, the harp racing; each boss's cut opens on a timpani and a cymbal.
    for at, phrase in zip(T.MASH, BATTLE):
        tune(at, phrase, x.reed, 0.2)
        tune(at, phrase, x.flute, 0.13, up=12, pan=0.2)
        x.crash(at, 0.2, 0.3)
        timp(at, "E2" if at == 64 else ("C2" if at == 70 else ("A1" if at == 76 else "B1")), 0.5)
    for b in np.arange(64, 88, 1.0):  # the gallop: long, short short
        _, root = CHORD(b)
        for off, d in ((0, 0.5), (0.5, 0.25), (0.75, 0.25)):
            put("bass", b + off, x.fmbass(root + 12 + (12 if off == 0.5 else 0), d * 0.8, 0.27))
    stabs([b + 0.5 for b in range(64, 88)], 0.085, 0.22)
    harp(64, 88, 0.25, 0.13, (0, 1, 2, 3, 4, 3, 2, 1))
    pad(82, 88, 0.07, up=12)
    for b in range(64, 88):
        ph = (b - 64) % 6
        x.kick(b, 0.55, soft=True) if ph in (0, 2, 4) else snare(b, 0.2)
        if ph in (0, 2):
            x.kick(b + 0.75, 0.3, soft=True)
        for s in (0.25, 0.5, 0.75):
            x.hat(b + s, 0.04 if s != 0.5 else 0.065)
    for at in T.MASH[1:]:
        snare(at - 0.5, 0.14), snare(at - 0.25, 0.18)
    roll(87, 88, "B1", 0.12, 0.36)

    # 6. Squads (88-100): the call comes back as a march in two voices (flute and bells; a reed below), full strings.
    x.crash(88, 0.2)
    timp(88, "E2", 0.5)
    tune(88, SQUADS, x.flute, 0.2, pan=-0.2)
    tune(88, SQUADS, x.bell, 0.06, up=12, decay=0.35)
    tune(88, SQUADS_2, x.reed, 0.12, pan=0.3)
    pad(88, 100, 0.075)
    bass(88, 100, (0, 1, 2, 3), 0.3, gate=0.6, fifth=True)
    harp(88, 100, 0.5, 0.15)
    for b in range(88, 100):
        x.kick(b, 0.45, soft=True)
        snare(b + 0.5, 0.1)
        if b % 2:
            snare(b, 0.16), snare(b + 0.75, 0.08)
    timp(92, "A1", 0.35), timp(96, "B1", 0.35)
    roll(99, 100, "B1", 0.1, 0.3)

    # 7. Ranked (100-107): the reed and flute press on over the gallop.
    tune(100, RANKED, x.reed, 0.2)
    tune(100, RANKED, x.flute, 0.13, up=12, pan=0.2)
    for b in np.arange(100, 107, 1.0):
        _, root = CHORD(b)
        for off, d in ((0, 0.5), (0.5, 0.25), (0.75, 0.25)):
            put("bass", b + off, x.fmbass(root + 12 + (12 if off == 0.5 else 0), d * 0.8, 0.27))
    stabs([b + 0.5 for b in range(100, 107)], 0.085, 0.22)
    harp(100, 107, 0.25, 0.13, (0, 1, 2, 3, 4, 3, 2, 1))
    for b in range(100, 107):
        x.kick(b, 0.55, soft=True) if (b - 100) % 2 == 0 else snare(b, 0.2)
        for s in (0.25, 0.5, 0.75):
            x.hat(b + s, 0.04 if s != 0.5 else 0.065)

    # The run up the ranks (107-112): one harp-and-bell note per rank over tremolo strings and a timpani roll.
    for i, (b, p) in enumerate(zip(T.RUN_AT, RUN)):
        v = 1 + 0.08 * i
        put("harp", b, x.pluck(n(p), 1.5, 0.26 * v, tone=0.8))
        put("bell", b, x.bell(n(p) + 12, 0.9, 0.09 * v, decay=0.3))
    for i in range(40):
        for j, m in enumerate(CHORD(107)[0]):
            put("strings", 107 + i * 0.125, x.strings(m + 12, 0.12, 0.03 + 0.0016 * i, attack=0.01, release=0.02), (-0.5, 0.0, 0.5)[j])
    put("bass", 107, x.fmbass(n("B1") + 12, 5, 0.26, decay=2))
    roll(107, 112, "B1", 0.04, 0.36)

    # Transcendent (112-116): E major: the strings wide open, a harp sweep up, bells ringing, the last brass stab.
    x.crash(112, 0.26, 0.6)
    timp(112, "E2", 0.55)
    for j, m in enumerate([52, 59, 64, 68, 71, 76]):
        put("strings", 112, x.strings(m, 3.6, 0.075, attack=0.02, release=0.6), -0.6 + 0.24 * j)
    for m in (64, 68, 71):
        put("brass", 112, x.brass(m, 1.2, 0.09, release=0.3))
    for i, m in enumerate([64, 68, 71, 76, 80, 83, 88, 92, 95, 100]):
        put("harp", 112 + i * 0.1, x.pluck(m, 2.0, 0.2, tone=0.8), 0.6 if i % 2 else -0.6)
    put("bell", 112, x.bell(n("E6"), 3.6, 0.16, decay=1.2))
    put("bell", 112, x.bell(n("B5"), 3.6, 0.08, decay=1.2), -0.3)
    put("bass", 112, x.fmbass(n("E2") + 12, 3.4, 0.3, decay=1.5))
    for b, m in [(113.5, 95), (114.25, 100), (114.75, 104)]:
        put("bell", b, x.bell(m, 1.0, 0.05, ratio=5.0, decay=0.4), 0.4)

    # 8. The Hidden Boss (116-136): a drum, then low strings moving slowly under a held E, an F leaning on it, a
    # timpani heartbeat, breaths of air, and a bell far off for the glint of his eye. Meant to be heard.
    timp(116, "E1", 0.7)
    held = dict(attack=0.5, sustain=1.0, release=0.6)
    put("dark", 116, x.swell(x.add(n("E1") + 12, 19, [1, 0.5, 0.3, 0.12], 0.26, **held), 0.12))
    put("dark", 116, x.swell(x.strings(n("E3"), 19, 0.055, **held), 0.12), -0.3)
    put("dark", 116, x.swell(x.strings(n("B3"), 19, 0.035, **held), 0.3), 0.3)
    for b, d, m in line(116, HIDDEN):
        put("dark", b, x.swell(x.strings(m, d, 0.16, attack=0.15, release=0.2), 0.35))
        put("dark", b, x.swell(x.reed(m - 12, d, 0.1, attack=0.15, release=0.2), 0.35))
    put("dark", 122, x.swell(x.strings(n("F4"), 6, 0.06, **held), 0.6), 0.2)  # the F above, leaning on the E
    put("dark", 128, x.swell(x.strings(n("F4"), 6, 0.075, **held), 0.7), -0.2)
    for b in range(118, 134, 4):  # his heartbeat
        timp(b, "E1", 0.42), timp(b + 0.6, "E1", 0.28)
    for a, d in ((117.0, 5), (123.5, 5), (129.5, 4.5)):
        put("dark", a, x.rumble(d, 0.1))
    for b in (123.0, 126.5, 131.0):  # the glint of his eye
        put("bell", b, x.bell(n("B6"), 1.5, 0.07, ratio=5.0, decay=0.5), 0.3)
        put("bell", b + 0.25, x.bell(n("F7"), 1.2, 0.035, ratio=5.0, decay=0.4), -0.3)

    # The way back (134-136): a timpani roll swells and two harp notes cross the loop point into the call.
    roll(134, 136, "B1", 0.03, 0.3)
    for b, d, m in line(135, PICKUP):
        put("harp", b, x.pluck(m, 1.0, 0.24, tone=0.8))
        put("lead", b, x.flute(m, d * 0.9, 0.14))

    # Mix: an echo on the bells, a small hall round everything (both circular: they wrap the loop point).
    x.echo("bell", 0.75, 0.3, 0.14)
    x.echo("lead", 0.75, 0.16, 0.06)
    write_wav(out, x.mixdown({"harp": 2.2, "strings": 1.6, "bass": 0.75, "drum": 0.65, "bell": 1.2, "dark": 0.85}, lowpass=11000, room=0.22))


if __name__ == "__main__":
    main(sys.argv[1])
