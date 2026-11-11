"""The reel theme's score: one set of written notes that both renderers (chip.py, orch.py) play.

Time is in beats. 64 beats fill the reel exactly (25.3 s on the phone: 151.8 bpm), and beat 0 sits 0.25 s into the
file, so the picture's moments land on beats:
  beat  0  (0.25 s)  50 v 50: the fanfare
  beat  8  (3.41 s)  the town: light and bouncy
  beat 24  (9.74 s)  Big Boy's swirl: a riser
  beat 28 (11.32 s)  "A boss appears": the hit
  beat 32 (12.90 s)  ranked: the fanfare again, driving
  beat 43 (17.25 s)  the ranks shuffle up: one run note per rank (RUN, at the shuffle's own quickening steps)
  beat 48 (19.22 s)  Transcendent: the stinger
  beat 52 (20.81 s)  the Hidden Boss: low and dark, nearly silent
  beat 63 (25.15 s)  two pickup notes that wrap round the loop point into beat 0
Key: D minor (the town in F major, the stinger in D major). Every melody here is original.
"""

NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def n(name: str) -> int:
    """'F#5' / 'Bb4' -> MIDI note number (C4 = 60)."""
    pc = NAMES[name[0]]
    rest = name[1:]
    if rest[0] == "#":
        pc, rest = pc + 1, rest[1:]
    elif rest[0] == "b":
        pc, rest = pc - 1, rest[1:]
    return 12 * (int(rest) + 1) + pc


def line(start: float, text: str):
    """'D5:.75 F5:.5 -:1' -> [(beat, beats, midi)], notes one after another from `start` ('-' rests)."""
    out, t = [], start
    for tok in text.split():
        name, d = tok.split(":")
        d = float(d)
        if name != "-":
            out.append((t, d, n(name)))
        t += d
    return out


BEATS = 64
OFFSET_S = 0.25  # where beat 0 sits in the file
REEL_S = 25.3  # the phone reel; the wide one is 25.4333

# The fanfare (50 v 50), two bars.
FANFARE = line(0, "D5:.75 D5:.25 F5:.5 A5:.5 G5:1 F5:.5 E5:.5  F5:.75 F5:.25 G5:.5 Bb5:.5 C6:1 G5:.5 E5:.5")
# The town, four bars.
TOWN = line(
    8,
    "A5:.5 C6:.5 A5:.5 F5:.5 G5:.5 A5:.5 C6:1 "
    "G5:.5 C6:.5 G5:.5 E5:.5 F5:.5 G5:.5 E5:1 "
    "F5:.5 A5:.5 D6:.5 A5:.5 F5:.5 A5:.5 D6:1 "
    "D6:.5 Bb5:.5 F5:.5 Bb5:.5 E6:.5 C6:.5 G5:.5 C6:.5",
)
# The swirl: a climb, quicker at the end.
RISER = line(24, "A4:.5 Bb4:.5 B4:.5 C5:.5 C#5:.5 D5:.5 E5:.25 F5:.25 G5:.25 A5:.25")
# Big Boy's entrance, low: a stomp with a cheeky tritone.
BOSS = line(28, "D3:1 D3:.5 F3:.5 Ab3:1 G3:.5 A3:.5")
# Ranked: the fanfare, pushed on.
RANKED = line(
    32,
    "D5:.75 D5:.25 F5:.5 A5:.5 G5:1 F5:.5 E5:.5  F5:.75 F5:.25 G5:.5 Bb5:.5 D6:1.5 C6:.5  Bb5:1 G5:.5 Bb5:.5 A5:1",
)
# The run up the ranks: one note per rank, at the shuffle's own steps (380, 320, 270, 230, 200, 180, 170, 230 ms),
# the last landing on Transcendent (beat 48).
RUN_AT = [43.0, 43.96, 44.77, 45.45, 46.03, 46.54, 47.0, 47.43]
RUN = [(b, 0.5, n(p)) for b, p in zip(RUN_AT, ["A4", "B4", "C#5", "D5", "E5", "F#5", "A5", "C#6"])]
STINGER_TOP = n("D6")
# The loop's pickup: wraps past the loop point into the fanfare's first D.
PICKUP = line(63, "A4:.5 C#5:.5")

# Chords: (from beat, to beat, [notes around middle C], bass note).
CHORDS = [
    (0, 4, [n("D4"), n("F4"), n("A4")], n("D2")),
    (4, 6, [n("D4"), n("F4"), n("Bb4")], n("Bb1")),
    (6, 8, [n("E4"), n("G4"), n("C5")], n("C2")),
    (8, 12, [n("F4"), n("A4"), n("C5")], n("F2")),
    (12, 16, [n("E4"), n("G4"), n("C5")], n("C2")),
    (16, 20, [n("D4"), n("F4"), n("A4")], n("D2")),
    (20, 22, [n("D4"), n("F4"), n("Bb4")], n("Bb1")),
    (22, 24, [n("E4"), n("G4"), n("C5")], n("C2")),
    (24, 28, [n("E4"), n("A4"), n("C#5")], n("A1")),
    (28, 32, [n("D4"), n("F4"), n("A4")], n("D2")),
    (32, 36, [n("D4"), n("F4"), n("A4")], n("D2")),
    (36, 40, [n("D4"), n("F4"), n("Bb4")], n("Bb1")),
    (40, 43, [n("D4"), n("G4"), n("Bb4")], n("G1")),
    (43, 48, [n("E4"), n("A4"), n("C#5")], n("A1")),
    (48, 52, [n("D4"), n("F#4"), n("A4")], n("D2")),
]


def chord_at(beat: float):
    for a, b, notes, bass in CHORDS:
        if a <= beat < b:
            return notes, bass
    return None, None
