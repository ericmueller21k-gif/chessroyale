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
figure double: one, then two, then four, then eight, each a few notes behind the first; the bars of six have a pulse
in three against them. At the top it stops: three ticks, a cold tone rising, and the book slammed shut.
The middle is the third go's. Eric (Nov 12) on the second, whose middle was the theme at half pace, twice, and a
slow move: "it's just not really hitting like the intro does and the outro ... a bit crazier ... a total
reconfiguration of that middle section ... definitely switching up the instrument ... that hymning ... really epic
... a holy sensation, but ... a lot of instrumentals going around with it, a lot of fast-pacedness", like a fighting
game's battle music. So: straight out of the slam, fast (184), a choir of men with no words sings a slow chant (the
basses an octave under, a third voice a fifth over, as old chant was sung; its own tune, in G minor) while the band
races round it: the strings' 16ths, a driven guitar chugging, a kick on the 8ths and then on every 16th, and the lead
and the fiddle tearing through the scale a third apart at each phrase's end. Then a duel: the choir calls, the lead
answers, on chords a major third apart, each phrase a little faster and an 8th short. Then the band stops on the
book and the choir sings alone, in a stone room's echo: the last theme's first phrase.
From there, as before (he liked "the intro ... and the outro"): bars of 5, 7, 9, 11 and 13 8ths, each two longer than
the last, climbing to the theme (the overdriven lead and the violins) over the figure at the top pace, the theme and
the kit at half of it.
The six notes of the build and the end: G, B flat, B, D, E flat, F sharp (a minor third, a half step, and round
again): in it are G minor with its major seventh, the same on E flat and on B, and nothing else, so the chords can
only move by major thirds, and any voice a major third from another is still in the scale. (Earlier in this notes'
history: his "His powers don't matter ... same with his sounds he really has none ... feel free to do that"; the clock
stays as the piece's percussion until the chant.)
The fourth go is longer. Eric (Nov 12) on the third: "it's so good actually", and, as he is a two-part boss, a
second half: where the first duel ends, a memory ("him going back, recounting his past. He's a child again, it's
quiet, it's peaceful ... the kids ... the faintness of the street noises ... the birds kind of chirping ... outside
playing chess at the park ... really calming, like harp sort of church style ... really soft ... warm and
welcoming"), which "starts building up, and then it starts getting like out of sync a little bit, out of key, starts
screeching"; "another slight pause before the big drop again", the chant, "a bit more layers on top, a bit more like
big sound, kind of pause, a bit more like long note, short note"; the duel again; and the same ending. The memory's
tune is the last theme's first phrase with its two dark notes made bright (G major): as it sours they go back.
The fifth go is the memory's instruments, chosen by ear from samples of that passage: its tune on an ocarina ("the
ocarina sounds real nice"; it was a harp, the choir joining as children), its rolling chords on a soft piano ("Number
2 for sure ... the soft piano"), and a music box behind them ("incorporate a little bit of the music box in softly");
the souring moved onto the same three. The memory by itself, with nothing going wrong, is his house's loop: song_w.py.
And the build's long notes come forward ("almost sounds like a siren ... drawn out, eerie ... it's so faint that I
can barely hear it ... get that kind of out a bit more a few times"): four of them, about 4 dB under the strings
together where the one he noticed was 16 under, the figure's strings down 2 dB. Of four voices sampled for them he
kept the strings ("I like the strings") and gave them their shape: "it hangs for a few seconds and then does like a
drop down ... every time it comes through". The notes are this song's own: A sharp, which all three of the build's
chords share, held, then falling to the nearest note of the chord under it. The game plays this score in pieces,
by the boss's phase: phases_v.py cuts them.
The game's first piece opens more slowly than the score does (Eric, Nov 14, playing his second phase: "when phase 2
boss starts the music is too epic too fast"; about one more minute of the looming build-up before the epic part). So
for the game the stare is seventy seconds, not ten (`render(loom=True)`, `LOOM`), made of nothing but this score's own
sounds, each from further off: the clock at a tick a second all the way; his low tones; four phrases of sixteen
seconds on the build's three chords (G, E flat, B, G), in each the strings' long note held and let fall, an octave
lower than the build has it and nearer each time; the solo violin trying the figure at a crawl (three notes, five,
a bar, then two bars and a run of 16ths); from the second phrase a slow thump, from the third the synth bass and
the low brass; pages; the trembling note; and the clock pressed. The calculation follows as it is. The score itself
is unchanged.
591 beats, about 3:58.
  python3 song_v.py <out.wav>

  0:00  the stare: his two low tones beating, the clock (a tick a second), the red book's pages, one trembling note
  0:10  the calculation: the solo violin's figure; then two voices, four, eight; the clock pressed and the pace up
        every two bars (128 to 212); a synth bass, held notes climbing, low brass; and over it, four times (0:19,
        0:30, 0:39, and from 0:47 to the flag), the strings hold one long note and let it fall, louder each time
  0:56  the flag: silence, three ticks, a cold tone rising, and the book slammed shut
  0:59  the chant: the men's choir, slow, over the band at full tilt; the lead's runs at each phrase's end
  1:20  the duel: the choir calls, the lead answers; four phrases, a major third apart, each faster
  1:39  the memory: a park (birds, children far off, a car, a bicycle's bell, chess pieces, the clock); an ocarina
        with the theme's phrase in G major, a soft piano rolling the chords, a small organ, a music box, a far bell
  2:10  it sours: the ocarina's three notes over and over, flatter each time; the piano out of tune, its echo late;
        the music box out of step; the tape sinking and wavering; the figure creeping back; strings screeching; the
        clock pressed, faster each time
  2:27  the pause: silence, one bird, a tick, the book
  2:29  the chant again, bigger: boys over the men, a bell, shouts after the long notes, two stops
  2:50  the duel again, its chords in another order
  3:09  the choir alone, in the echo: the last theme's first phrase; the clock, a tick a beat
  3:21  bars of 5, 7, 9, 11 and 13 8ths, faster with each
  3:36  the theme over the figure at full speed, a full kit
  3:54  the tag: the book shut, the clock slowing to a tick a second, his stare
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
LOOM = 70  # the game's longer stare (phases_v.py): its beats, a second each
CALC_BARS, _calc, T_FLAG = lay(T_CALC, UNITS)
T_CHANT, T_DUEL = T_FLAG + 4, T_FLAG + 68
T_MEMORY, T_SPIRAL, T_PAUSE = T_DUEL + 62, T_DUEL + 96, T_DUEL + 124  # the memory (34 beats), its souring (28), the pause (4)
T_CHANT2, T_DUEL2 = T_PAUSE + 4, T_PAUSE + 68
T_CALM, T_PLUS = T_DUEL2 + 62, T_DUEL2 + 76
PLUS_BARS, _plus, T_LAST = lay(T_PLUS, PLUS)
T_TAG, BEATS = T_LAST + 64, T_LAST + 72
SPIRAL = (66, 78, 92, 108, 128, 150, 176)  # the souring's seven units of four beats: the clock pressed, faster each time
# The pace: from beat, to beat, the tempo (from, to); and, where the tape itself doesn't run true (the memory, a
# little; its souring, more and more): its speed (from, to: under 1 is flat) and how far it wavers.
# The chant at 184 (188 the second time); the duel's four phrases (15.5 beats each) four beats a minute faster each;
# the choir alone at 70; the last theme's figure at the top pace (212), the theme itself and the kit at half of it.
PACE = ([(0, T_CALC, 60, 60)] + _calc + [(T_FLAG, T_CHANT, 90, 90), (T_CHANT, T_DUEL, 184, 184)]
        + [(T_DUEL + 15.5 * i, T_DUEL + 15.5 * (i + 1), 184 + 4 * i, 184 + 4 * i) for i in range(4)]
        + [(T_MEMORY, T_SPIRAL, 66, 66, 1.0, 1.0, 0.003)]
        + [(T_SPIRAL + 4 * i, T_SPIRAL + 4 * i + 4, t, t, 0.96 ** (i / 7), 0.96 ** ((i + 1) / 7), 0.003 + 0.0025 * i) for i, t in enumerate(SPIRAL)]
        + [(T_PAUSE, T_CHANT2, 90, 90), (T_CHANT2, T_DUEL2, 188, 188)]
        + [(T_DUEL2 + 15.5 * i, T_DUEL2 + 15.5 * (i + 1), 188 + 4 * i, 188 + 4 * i) for i in range(4)]
        + [(T_CALM, T_PLUS, 70, 70)] + _plus + [(T_LAST, T_TAG, 212, 212), (T_TAG, BEATS, 212, 60)])
PLAN = [part if len(part) == 7 else (*part, 1.0, 1.0, 0.0) for part in PACE]
# The souring as the game plays it (phases_v.py), fitted to his transformation as the game shows it (Nov 13, measured by
# the session wiring it, from his rising in a rage: his book lands open at his feet at 2.640 s; his chant, the book's
# light pouring up, runs from 3.040 s; arcs start at 8.540 s; the boards crack at 8.740 s, the drop). It has the same
# 32 beats of tape as the souring and its pause, and they last as long on the tape, so every other beat of the song is
# where it always is: idle beats first (the time the game's cut is shorter by), then (beats, seconds as heard): one
# unit of the souring at its sourest, a hush, the book and its ring, the build (the spiral's last units, each faster
# than the one before as the score's are), and a breath before the drop. The tape sinks as he rises and climbs back
# through the build. The build's length is the part that can change with the picture (his chant: Eric, Nov 13, "kinda
# wanna add a few more seconds like 5 to the transition animation so we get the souring longer"), and the breath is a
# full second ("we need that pause longer like a full second it will make it more epic before going into the drop":
# it was a fifth of one). RAGE: the build's seconds, how many of the spiral's last units it has (3 to 6: up to about 18
# s in all), and the breath's seconds. On the picture as first measured (8.740 s from his rising to the crack) it was
# (4.7, 3, 1.0). Then the director gave his chant Eric's two lines ("Computation without creativity is nothing. Now I
# have both." "Prepare yourself. This is the ultimate test of your skill."): 17.435 s from his rising to the crack, the
# book landing where it did, the last line typed as the breath begins. So the build is now the spiral's last six units,
# at very nearly the score's own pace: the first has no band at all, only the sour notes.
RAGE = (13.395, 6, 1.0)


def rage_layout(build: float = RAGE[0], units: int = RAGE[1], breath: float = RAGE[2]):
    """The game's cut: the beat he rises at, and its parts (beats, seconds as heard, the tape's speed from and to, its waver)."""
    fast = [1 / t for t in SPIRAL[7 - units:]]
    parts = [(4, 2.44, 1.0, 0.93, 0.012), (1, 0.2, 0.93, 0.935, 0.012), (1, 0.4, 0.935, 0.95, 0.012)]
    parts += [(4, build * f / sum(fast), 0.95 + 0.05 * i / units, 0.95 + 0.05 * (i + 1) / units, 0.012 - 0.01 * i / units) for i, f in enumerate(fast)]
    parts += [(1, breath, 1.0, 1.0, 0.0)]
    return T_CHANT2 - sum(part[0] for part in parts), parts


def rage_plan(build: float = RAGE[0], units: int = RAGE[1], breath: float = RAGE[2]):
    """PLAN with the souring's 32 beats at the game's pace: each part's tempo found by trying it (the tape's waver
    moves how long a part is heard a little), the idle beats taking up the rest of the tape's time."""
    from synth import Ride  # (here: the pace is worked out before the song's own imports are needed)

    start, parts = rage_layout(build, units, breath)
    a = next(i for i, part in enumerate(PLAN) if part[0] == T_SPIRAL)
    b = next(i for i, part in enumerate(PLAN) if part[0] == T_CHANT2)
    span = sum(60 * (p1 - p0) / t0 for p0, p1, t0, *_ in PLAN[a:b])  # the souring's and the pause's time on the tape, before the fit
    tempos = [60 * beats / secs for beats, secs, *_ in parts]
    for _ in range(6):
        idle = 60 * (start - T_SPIRAL) / (span - sum(60 * part[0] / t for part, t in zip(parts, tempos)))
        plan, at = PLAN[:a] + [(T_SPIRAL, start, idle, idle, 1.0, 1.0, 0.0)], start
        for (beats, _, s0, s1, waver), t in zip(parts, tempos):
            plan.append((at, at + beats, t, t, s0, s1, waver))
            at += beats
        plan += PLAN[b:]
        clock, at = Ride(plan, BEATS, None, tape_secs=TAPE), start
        for i, (beats, secs, *_) in enumerate(parts):
            tempos[i] *= (clock.when(at + beats) - clock.when(at)) / secs
            at += beats
    return plan


# The tape's length: the pace's own, to the nearest 2.5 s (a length whose samples have only small factors: a tape of
# an awkward length made the mix's transforms take twelve minutes). The song as heard is a third of a second longer.
TAPE = round(sum(60 * (b - a) / t0 if t0 == t1 else 60 * (b - a) * np.log(t1 / t0) / (t1 - t0) for a, b, t0, t1, *_ in PLAN) / 2.5) * 2.5

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
# ---- the middle (the third go): a chant, in G minor (F sharp where the chord is D). ----
# The choir's line, sixteen bars of four, slow over a fast band: down from G; up to B flat the second time.
CHANT = (
    "G4:3 F4:1 | Eb4:1 D4:3 | Eb4:2 G4:2 | F#4:3 D4:1 | Eb4:2 D4:1 C4:1 | D4:3 Bb3:1 | C4:2 Eb4:2 | D4:4 | "
    "G4:2 A4:1 Bb4:1 | A4:3 F4:1 | G4:2 Bb4:2 | A4:3 F#4:1 | G4:2 Eb4:1 F4:1 | G4:3 Eb4:1 | F#4:2 A4:2 | A4:2 F#4:2"
)
# Its chords, a bar each: the bass note, the strings' root, minor (m), major (M) or diminished (o).
CHANT_CH = [(43, 67, "m"), (43, 67, "m"), (39, 63, "M"), (38, 62, "M"), (36, 60, "m"), (46, 67, "m"), (45, 69, "o"), (38, 62, "M"),
            (43, 67, "m"), (41, 65, "M"), (39, 63, "M"), (38, 62, "M"), (36, 60, "m"), (39, 63, "M"), (38, 62, "M"), (38, 62, "M")]
HARMONIC = (0, 2, 3, 5, 7, 8, 11)  # the minor scale with its seventh raised
DOMINANT = (0, 1, 4, 5, 7, 8, 10)  # the same scale from its fifth
# The lead's runs at the ends of the chant's phrases: steps of G's scale, a 16th each.
RUNS = ([11, 10, 9, 8, 9, 8, 7, 6, 7, 6, 5, 4, 5, 4, 3, 4], [4, 5, 6, 7, 6, 7, 8, 9, 8, 9, 10, 11, 10, 11, 12, 13],
        [13, 12, 11, 10, 11, 10, 9, 8, 9, 8, 7, 6, 7, 8, 9, 11], [4, 6, 8, 6, 5, 7, 9, 7, 6, 8, 10, 8, 9, 11, 13, 14])
# The duel: four phrases of four, four, four and three and a half beats, on B minor, E flat minor, G minor and D (major
# thirds apart, then home's dominant): the bass, the strings' root, the chord, the run's first note and scale, and the
# choir's call. The lead answers each call with the same run: down in fours, then up two octaves.
DUEL = [(47, 59, "m", 59, HARMONIC, "F#4:3 G4:1 | F#4:2 B4:2"), (39, 63, "m", 63, HARMONIC, "Bb3:3 B3:1 | Bb3:2 Eb4:2"),
        (43, 67, "m", 55, HARMONIC, "D4:3 Eb4:1 | D4:2 G4:2"), (38, 62, "M", 62, DOMINANT, "A3:3 Bb3:1 | A3:2 D4:2")]
SWEEP = [11, 10, 9, 8, 9, 8, 7, 6, 7, 6, 5, 4, 5, 4, 3, 2] + list(range(1, 15))
ARP = {"m": (0, 7, 3, 7, 12, 7, 15, 7, 12, 7, 15, 12, 19, 15, 12, 7), "M": (0, 7, 4, 7, 12, 7, 16, 7, 12, 7, 16, 12, 19, 16, 12, 7),
       "o": (0, 6, 3, 6, 12, 6, 15, 6, 12, 6, 15, 12, 18, 15, 12, 6)}  # the strings' 16ths on a chord, a bar
CHUG = (1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0)  # where in a bar's 16ths the guitar chugs
for _name, _beats in ((THEME, 32), (CHANT, 64)) + tuple((call, 8) for *_, call in DUEL):
    assert beats(_name) == _beats, (_name[:30], beats(_name))
# The memory: the last theme's first phrase as a child would have it, in G major (B and E where the theme has B flat
# and E flat), a little answer, the phrase again from E, and a turn that doesn't come home.
CHILD = ("G4:1 D5:1 F#5:3 G5:.5 B5:.5 D6:2 B5:2/3 F#5:2/3 E5:2/3 D5:2 | E5:1 F#5:1 A5:2 | "
         "G5:1 E5:1 B5:3 A5:.5 G5:.5 E5:2 G5:2/3 E5:2/3 B4:2/3 D5:2 | C5:1 E5:1 F#5:2")
# Its chords, a bar each (G, G, C, D, E minor, C, G, D): eight notes, up and back, for the piano.
MEMORY_CH = [[43, 50, 55, 59, 62, 59, 55, 50], [43, 50, 55, 59, 62, 59, 55, 50], [48, 55, 60, 64, 67, 64, 60, 55], [50, 57, 62, 66, 69, 66, 62, 57],
             [52, 59, 64, 67, 71, 67, 64, 59], [48, 55, 60, 64, 67, 64, 60, 55], [50, 55, 59, 62, 67, 62, 59, 55], [50, 57, 60, 66, 69, 66, 60, 57]]
assert beats(CHILD) == 32
assert (T_FLAG, T_MEMORY, T_CHANT2, T_LAST, BEATS, len(SWEEP)) == (138, 268, 334, 519, 591, 30)


def render(window=None, lead: float = 8.0, rage=None, loom: bool = False) -> np.ndarray:
    """The song as heard (stereo, at the mix's own level). `window`: (from beat, to beat), to make only that passage
    (a sample; or, with `lead` 0, a piece cut clean for phases_v.py: its notes only, their tails ringing on). `rage`:
    the souring and its pause as the game plays them, not as the score has them: (the build's seconds, its units, the
    breath's seconds), as RAGE is. `loom`: not the song but the game's longer stare, by itself: LOOM seconds and ten
    more of its ring (so nothing wraps round to its start)."""
    if loom:
        x = Ride([(0, LOOM + 10, 60, 60, 1.0, 1.0, 0.0)], LOOM + 10, None, os=2, seed=227, tape_secs=float(LOOM + 10))
    else:
        x = Ride(rage_plan(*rage) if rage else PLAN, BEATS, None, os=2, seed=227, tape_secs=TAPE)
    x.window, x.lead = window, lead
    put, at = x.put, x.at
    rng = np.random.default_rng(59)
    sr = x.sr
    tau = 2 * np.pi
    levels = {"solo": 1.6, "violins": 1.0, "violas": 1.0, "cellos": 1.0, "pads": 1.0, "slide": 1.6, "lead": 1.25, "bass": 0.7, "sub": 0.6, "brass": 1.0,
              "kick": 0.9, "snare": 2.0, "hats": 4.0, "drum": 1.5, "clock": 3.0, "book": 1.5, "fx": 1.2, "hum": 0.7, "choir": 6.0, "guitar": 1.15, "keys": 2.1, "park": 3.0, "tune": 2.1, "box": 2.1, "siren": 1.6}
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

    def slide(b, d, m0, m1, vol=0.04, pan=0.0, bus="slide", hang=None):
        """A string section near the bridge sliding from one note to another, no steps between. Slowly, all the way
        (a siren's rise); or, with `hang` (a share of its length), it stays on the first note that long, slides
        over the next quarter of its length, and stays on the second."""
        at(b, d)
        k = x.k(d)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        v = u if hang is None else np.clip((u - hang) / 0.25, 0, 1)
        line = m0 + (m1 - m0) * (v if hang is None else v * v * (3 - 2 * v))
        w = np.zeros(k)
        for c in (-11, 0, 9):
            ph = tau * np.cumsum(x.hz(line + c / 100)) / sr
            for h, a in enumerate(BRIDGE[:8], 1):
                w += a * np.sin(h * ph + 0.7 * h)
        put(bus, b, w / 3 * np.minimum(1, t / 0.3) * tail(k, 0.2) * (0.4 + 0.6 * u) * vol, pan)

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

    def kick(b, vol=0.5, short=False):
        """`short`: a tight one, for a kick on every 16th (it doesn't make the bass duck)."""
        k = int((0.11 if short else 0.3) * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / (0.04 if short else 0.12)))
        put("kick", b, w * tail(k) * vol)
        if not short:
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

    def sing(b, d, m, vol=0.1, mouth=0.7, pan=0.0, singers=5, start=0.1):
        """Men singing one note, no words: several voices a little apart, straight (hardly any vibrato); `mouth` from
        closed (0, a hum) to "ah" (1)."""
        at(b, d)
        k = x.k(d * 1.03)
        t = np.arange(k) / sr
        f0 = x.hz(m)
        f1, f2, f3 = 320 + 380 * mouth, 700 + 400 * mouth, 2600
        gains = []
        for h in range(1, int(4200 / f0) + 1):
            fh = h * f0
            g = 1.0 / np.sqrt(1 + 30 * (fh / f1 - f1 / fh) ** 2) + 0.55 / np.sqrt(1 + 40 * (fh / f2 - f2 / fh) ** 2) + 0.14 / np.sqrt(1 + 60 * (fh / f3 - f3 / fh) ** 2) + 0.03
            gains.append(g / h**1.2)
        w = np.zeros(k)
        for s in range(singers):
            waver = 1 + 0.003 * np.sin(tau * (4.4 + 0.5 * s) * t + rng.uniform(0, tau))
            ph = tau * np.cumsum(f0 * 2 ** (rng.uniform(-14, 14) / 1200) * waver) / sr
            for h, g in enumerate(gains, 1):
                w += g * np.sin(h * ph + rng.uniform(0, tau))
        put("choir", b, (w / singers + 0.015 * hiss(k, 4000, 0.5)) * np.minimum(1, t / start) * tail(k, min(0.18, 0.4 * k / sr)) * vol, pan)

    def chant(line, vol=1.0, mouth=0.75, scale=None):
        """The choir on a line: the men, the basses an octave under them, and (where `scale`, a set of the notes
        allowed, has it) a third voice a fifth over the line, as old chant was sung."""
        for b, d, m in line:
            sing(b, d, m, 0.1 * vol, mouth, -0.2)
            sing(b, d, m - 12, 0.085 * vol, mouth * 0.8, 0.2, 4)
            if scale is not None and (m + 7) % 12 in scale:
                sing(b, d, m + 7, 0.045 * vol, mouth, 0.0, 3)

    def chug(b, m, vol=0.5):
        """A driven guitar's short chord: the note, its fifth, its octave."""
        at(b, 0.25)
        for over, loud, pan in ((0, 1.0, -0.3), (7, 0.8, 0.3), (12, 0.5, 0.0)):
            put("guitar", b, x.gritty(m + over, 0.2, 0.21 * vol * loud), pan)

    def run(start, steps, tonic, scale, vol=1.0):
        """The lead tearing through a scale, a 16th a step, the fiddle a third over it."""
        for i, step in enumerate(steps):
            b = start + i * 0.25
            at(b, 0.25)
            put("lead", b, x.drive(tonic + 12 * (step // 7) + scale[step % 7], 0.24, 0.15 * vol, attack=0.008, release=0.015), -0.1)
            bow(b, 0.25, tonic + 12 * ((step + 2) // 7) + scale[(step + 2) % 7], "solo", 0.7 * vol, 0.3, long=True)

    def band(b, count, low, chord, kind, hard=False):
        """A bar of the battle band, `count` beats long, on a chord (`low` its bass, `chord` the strings' root): the
        strings' 16ths in three voices, each a little behind the last; the guitar chugging; the bass and the clock on
        the 8ths; the snare on 2 and 4; a kick on the other 8ths, or (`hard`) on every 16th."""
        for i in range(int(round(count * 4))):
            t = b + i * 0.25
            lean = 1.25 if i % 4 == 0 else 1.0
            bow(t, 0.25, chord + ARP[kind][i % 16], "solo", 0.45 * lean, -0.15)
            bow(t, 0.25, chord + 12 + ARP[kind][(i + 13) % 16], "violins", 0.7 * lean, 0.5)
            bow(t, 0.25, chord - 12 + ARP[kind][(i + 14) % 16], "violas", 0.7 * lean, -0.5)
            if CHUG[i % 16]:
                chug(t, low + 12 if low < 44 else low, 0.5 * lean)
            if i % 2 == 0:
                synth(t, low, 0.45, 0.24, 1100)
                tick(t, 0.045 if i % 4 == 0 else 0.03, i % 4 == 0)
            if i % 8 == 4:
                snare(t, 0.26)
            if hard:
                kick(t, 0.44 if i % 4 == 0 else 0.28, short=True)
            elif i % 2 == 0 and i % 8 != 4:
                kick(t, 0.5 if i % 4 == 0 else 0.4, short=i % 4 != 0)

    def stab(b, low, chord, kind, vol=1.0):
        """A short note after the long ones: the choir's shout (the chord's root, fifth and octave), the guitar, a
        kick and the snare."""
        for m, pan in ((chord - 12, -0.3), (chord - 5, 0.3), (chord, 0.0)):
            sing(b, 0.5, m, 0.11 * vol, 1.0, pan, 4, start=0.02)
        chug(b, low + 12 if low < 44 else low, 0.8 * vol)
        kick(b, 0.6), snare(b, 0.24), synth(b, low, 0.4, 0.3, 1500)

    def bell(b, m, ring_s=1.8, vol=0.1, pan=0.0):
        """A church bell: the note, the hum an octave under it and the minor third over it."""
        k = int(min(6.0, 4 * ring_s) * sr)
        t = np.arange(k) / sr
        f = x.hz(m)
        w = np.zeros(k)
        for r, loud, long in ((0.5, 0.35, 1.5), (1, 1.0, 1.0), (1.2, 0.5, 0.8), (1.5, 0.2, 0.7), (2, 0.55, 0.6), (3, 0.3, 0.4), (4.2, 0.16, 0.28)):
            w += loud * np.sin(tau * f * r * t + r) * np.exp(-t / (ring_s * long))
        put("fx", b, w * np.minimum(1, t / 0.002) * tail(k) * vol, pan)

    # ---- the memory's sounds: an ocarina, a soft piano, a music box, a small organ, a park ----
    def ocarina(b, d, m, vol=0.06, pan=0.2):
        """The memory's tune (Eric, Nov 12, of six voices tried on it: "the ocarina sounds real nice")."""
        at(b, d)
        put("tune", b, x.ocarina(m, d * 0.98, vol), pan)

    def keys(b, m, vol=0.08, pan=0.0, cents=0.0, late=0.0):
        """A soft piano note (of six instruments tried on the rolling chords: "Number 2 for sure ... the soft piano")."""
        put("keys", b, x.struck("felt", m, cents) * vol, pan, late=late)

    def box(b, m, vol=0.035, pan=0.4, cents=0.0, late=0.0):
        """A music box's note ("incorporate a little bit of the music box in softly ... I really do like that music box")."""
        put("box", b, x.struck("box", m, cents) * vol, pan, late=late)

    def organ(b, d, m, vol=0.022, pan=0.0):
        """A small organ's flutes: soft, steady."""
        at(b, d)
        put("pads", b, x.tone(m, d, [1, 0.45, 0.12, 0.2, 0.04, 0.06], vol, detune=(-3, 3), attack=0.15, release=0.3), pan)

    def bird(b, vol=0.03, pan=0.0):
        """A bird: two to four quick notes, each a little sweep."""
        late = 0.0
        for _ in range(rng.integers(2, 5)):
            secs = rng.uniform(0.05, 0.11)
            k = int(secs * sr)
            u = np.linspace(0, 1, k)
            f0, f1 = rng.uniform(3000, 5200), rng.uniform(3000, 5200)
            ph = tau * np.cumsum(f0 + (f1 - f0) * u + 250 * np.sin(tau * rng.uniform(18, 35) * u * secs)) / sr
            put("park", b, np.sin(ph) * np.sin(np.pi * u) ** 0.7 * vol, pan, late=late)
            late += secs + rng.uniform(0.02, 0.09)

    def child(b, vol=0.02, pan=0.0):
        """A child far off, calling: a short voice, its pitch up and over."""
        secs = rng.uniform(0.3, 0.55)
        k = int(secs * sr)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        f = rng.uniform(430, 520) * (1 + 0.45 * np.sin(np.pi * u) ** 1.5 + 0.05 * np.sin(tau * 11 * t))
        ph = tau * np.cumsum(f) / sr
        f1, f2 = 520 - 150 * u, 1900 + 400 * u
        w = np.zeros(k)
        for h in range(1, 9):
            fh = h * f
            w += np.sin(h * ph) / h * (1 / np.sqrt(1 + 16 * (fh / f1 - f1 / fh) ** 2) + 0.7 / np.sqrt(1 + 25 * (fh / f2 - f2 / fh) ** 2) + 0.05)
        put("park", b, (w + 0.05 * hiss(k, 4000, 0.5)) * np.sin(np.pi * u) ** 0.6 * vol, pan)

    def car(b, length, vol=0.03):
        """A car going by, a street away: a low wash, from the left to the right."""
        at(b, length)
        k = x.k(length)
        u = np.linspace(0, 1, k)
        w = paper(k, 260) * np.sin(np.pi * u) ** 2 * vol
        put("park", b, w * (1 - u), -1.0), put("park", b, w * u, 1.0)

    def bike(b, vol=0.02, pan=0.5):
        """A bicycle's bell, twice."""
        k = int(0.5 * sr)
        t = np.arange(k) / sr
        for late in (0.0, 0.16):
            put("park", b, (np.sin(tau * 2150 * t) + 0.5 * np.sin(tau * 3230 * t)) * np.exp(-t / 0.09) * np.minimum(1, t / 0.001) * tail(k) * vol, pan, late=late)

    def clack(b, vol=0.05, pan=-0.1):
        """A chess piece put down on a wooden board."""
        k = int(0.08 * sr)
        t = np.arange(k) / sr
        put("park", b, (np.sin(tau * 430 * t) + 0.6 * np.sin(tau * 1150 * t) + 0.5 * hiss(k, 5000, 0.3) * np.exp(-t / 0.002)) * np.exp(-t / 0.012) * tail(k) * vol, pan)

    def screech(b, length, m0, m1, vol=0.05, pan=0.0):
        """A string screeching: bowed too hard, too near the bridge, sliding; the bow catching and slipping."""
        at(b, length)
        k = x.k(length)
        t = np.arange(k) / sr
        u = np.linspace(0, 1, k)
        ph = tau * np.cumsum(x.hz(m0 + (m1 - m0) * u**1.5)) / sr
        w = np.zeros(k)
        for h, loud in enumerate((0.4, 0.7, 1.0, 0.9, 0.8, 0.6, 0.5, 0.35), 1):
            w += loud * np.sin(h * ph + h)
        catch = 0.55 + 0.45 * np.sign(np.sin(tau * np.cumsum(rng.uniform(55, 90) + 20 * np.sin(tau * 3 * t)) / sr))
        put("slide", b, (w * catch + 0.6 * hiss(k, 9000, 0.7)) / 3 * np.minimum(1, t / 0.04) * tail(k, 0.05) * (0.5 + 0.5 * u) * vol, pan)

    minor = {(7 + step) % 12 for step in HARMONIC} | {5}  # G minor's notes, with F and F sharp

    def chanted(start, big=False):
        """The chant: sixteen bars, the choir slow over the band at full tilt. `big` (the second time): boys an
        octave over the men, a church bell, more brass, a kick on every 16th from the first bar, strings trembling
        on top; short shouted notes after the long ones (the last 8ths of every phrase's second bar); and in the
        eighth and the last bar the band stops after one beat: two shouts, two ticks of the clock, a pickup."""
        arcs(start, 0.1), x.crash(start, 0.2, decay=0.6)
        line = notes(start, CHANT)
        chant(line, 1.45 if big else 1.3, 0.85 if big else 0.75, minor)
        if big:
            for b, d, m in line:
                sing(b, d, m + 12, 0.035, 0.6, 0.0, 3)
        for bar, (low, chord, kind) in enumerate(CHANT_CH):
            b = start + 4 * bar
            stop = big and bar % 8 == 7
            if stop:
                band(b, 1, low, chord, kind, hard=True)
                stab(b + 1, low, chord, kind), stab(b + 1.5, low, chord, kind)
                tick(b + 2, 0.2, True, 0.0), tick(b + 3, 0.2, False, 0.0)
                snare(b + 3.5, 0.2), snare(b + 3.75, 0.26)
            else:
                band(b, 4, low, chord, kind, hard=big or bar >= 8)
            if big and bar % 4 == 1:
                stab(b + 3, low, chord, kind, 0.8), stab(b + 3.5, low, chord, kind, 0.8)
            if big and not stop:
                shimmer(b, 4, chord + 19, 0.03, 0.3)
            if bar % 4 == 0:
                brass(b, 8, low, 0.13 if big else 0.1)
                if bar:
                    x.crash(b, 0.12, decay=0.4)
                if big:
                    bell(b, 55, 1.8, 0.1)
            if bar % 4 == 3 and not stop:
                run(b, RUNS[bar // 4], 55, HARMONIC)

    def dueled(start, phrases, big=False):
        """The duel: four phrases, each a little faster (the clock pressed) and an 8th short. The choir calls for two
        bars; the lead and the fiddle answer for two with a run down in fours and up two octaves. `big`: boys over
        the men, a bell, two shouts after each call."""
        b = start
        for low, chord, kind, tonic, scale, call in phrases:
            press(b, 0.12), x.crash(b, 0.14, decay=0.4)
            line = notes(b, call)
            chant(line, 1.5 if big else 1.4, 0.9, {(tonic + step) % 12 for step in scale})
            if big:
                for first, d, m in line:
                    sing(first, d, m + 12, 0.035, 0.6, 0.0, 3)
                stab(b + 7, low, chord, kind, 0.8), stab(b + 7.5, low, chord, kind, 0.8)
                bell(b, chord - 12, 1.5, 0.08)
            brass(b, 6, low, 0.13 if big else 0.1)
            for first, count in ((b, 4), (b + 4, 4), (b + 8, 4), (b + 12, 3.5)):
                band(first, count, low, chord, kind, hard=True)
            run(b + 8, SWEEP, tonic, scale)
            snare(b + 15, 0.2), snare(b + 15.25, 0.26)
            b += 15.5
        slide(start + 31, 31, 67, 79, 0.05, 0.4), slide(start + 31, 31, 62, 74, 0.05, -0.4)

    def cathedral(name, secs=3.5, wet=0.5):
        """A long echo for a voice: a stone room."""
        bus = x.buses[name]
        size = bus.shape[1]
        k = int(secs * sr)
        t = np.arange(k) / sr
        ir = np.zeros((2, size))
        ir[:, :k] = rng.normal(0, 1, (2, k)) * np.exp(-t / (secs / 6.9)) * np.minimum(1, t / 0.03)
        ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
        f = np.fft.rfftfreq(size, 1 / sr)
        x.buses[name] = bus + wet * np.fft.irfft(np.fft.rfft(bus, axis=1) * np.fft.rfft(ir, axis=1) / (1 + (f / 4000) ** 2) * (f > 150), n=size, axis=1)

    def root(beat, shift, stretch=1):
        """The theme's root at a beat of it: G for twelve beats, E flat for twelve, B for four, G for four."""
        beat /= stretch
        return 43 + shift + (0 if beat < 12 else -4 if beat < 24 else 4 if beat < 28 else 0)

    def figured(start, length, shift, stretch, voices, loud):
        """The figure under the theme, in bars of two beats, on the theme's roots."""
        bars = [(start + 2 * i, 8, i, i % 2) for i in range(length // 2)]
        poles = [root(2 * i, shift, stretch) - 43 for i in range(length // 2)]
        canon([(b, size, 2 * i, which) for b, size, i, which in bars], poles, [(0, *voice[1:]) for voice in voices], loud)

    if loom:
        # The game's longer stare (see the top). The clock, a tick a second, all the way; his low tones, swelling and
        # sinking; pages.
        for b, length, vol in ((0, 24, 0.1), (18, 24, 0.1), (36, 24, 0.1), (52, 18.5, 0.11)):
            stare(b, length, vol)
        for i in range(LOOM):
            tick(i, 0.16, i % 2 == 0)
        for b, vol in ((2.2, 0.1), (20.4, 0.08), (36.5, 0.08), (52.6, 0.09), (64.3, 0.08)):
            flip(b, vol)
        # Four phrases of sixteen beats, on the build's three chords.
        for j, (b, pole) in enumerate(((6, 0), (22, -4), (38, 4), (54, 0))):
            # The strings' long note (A sharp held, then let fall to the chord's nearest note), an octave under the
            # build's, nearer each time; from the third phrase the build's own octave over it too.
            for i, far in enumerate(((-12,), (-12,), (-12, 0), (-12, 0, 12))[j]):
                slide(b + 3, 11, 70 + far, (67 if pole == 0 else 66) + far, (0.035, 0.045, 0.055, 0.05)[j] * (0.7 if i else 1.0), (-0.4, 0.4, 0.0)[i], "siren", hang=0.6)
            # The solo violin tries the figure, an 8th a note: three notes, five, a bar, a bar.
            loud = (0.3, 0.35, 0.4, 0.42)[j]
            for i in range((3, 5, 8, 8)[j]):
                bow(b + 1 + i * 0.5, 0.5, 67 + pole + HEAD[0][i], "solo", loud * (1.3 if i == 0 else 1.0), -0.15)
            if j >= 1:  # a slow thump, closer together each phrase
                for i in range(0, 16, (8, 4, 2)[j - 1]):
                    thump(b + i, 0.08 + 0.02 * j)
            if j >= 2:  # the synth bass, its filter barely open, and the low brass
                for i in range(0, 16, 4 if j == 2 else 2):
                    synth(b + i, 43 + pole, 3.5 if j == 2 else 1.8, 0.1 + 0.03 * (j - 2), 140 * (260 / 140) ** ((j - 2 + i / 16) / 2))
                brass(b + (8, 5)[j - 2], (8, 10)[j - 2], 43 + pole, 0.05 + 0.015 * (j - 2))
                shimmer(b, 16, 67 + pole, 0.018 + 0.008 * (j - 2), 0.3), shimmer(b, 16, 55 + pole, 0.016 + 0.006 * (j - 2), -0.3)
        glow(28, 6, 51, 0.025), glow(56, 8, 55, 0.03)
        # The last phrase: the figure's second bar too, then both bars in 16ths, twice, louder; the trembling note
        # under it, growing; a thump on every beat; and the clock is pressed.
        for i in range(8):
            bow(54 + 5 + i * 0.5, 0.5, 67 + HEAD[1][i], "solo", 0.42 * (1.3 if i == 0 else 1.0), -0.15)
        for i in range(24):
            bow(64 + i * 0.25, 0.25, 67 + (HEAD[0] + HEAD[1] + HEAD[0])[i], "solo", (0.2 + 0.004 * i) * (1.3 if i % 8 == 0 else 1.0), -0.15)
        at(60, 10)
        put("solo", 60, x.swell(x.tone(67, 10, BRIDGE, 0.03, detune=(-5, 4), attack=0.3, release=0.2, trem=0.6, trem_hz=12.0), 0.92), -0.15)
        for i in range(4):
            thump(66 + i, 0.1)
        press(LOOM - 0.5, 0.12)
        cathedral("siren", 3.0, 0.35)
        x.beat_s = 60 / 160  # the echoes' beat, as the song's
        x.echo("solo", 0.75, 0.12, 0.05)
        return x.play(x.mixdown(levels, lowpass=8500, room=0.34, room_s=2.0))

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
    canon(CALC_BARS, POLES, VOICES, lambda move: 0.5 + 0.036 * move)
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
    # The long notes, over the racing figure (Eric, Nov 12, of a slow slide up at 0:31 he could barely hear: "almost
    # sounds like a siren ... drawn out, eerie ... the strings that are playing in the intro to be toned down a bit so
    # we can hear some of that ... get that kind of out a bit more a few times, like in the intro"; then, of its
    # shape: "a slide down from that note to a deeper note ... it hangs for a few seconds and then does like a drop
    # down, and it does that like every time it comes through ... like an A# to a G# ... or maybe A# to a G"). So:
    # four times (0:19, 0:30, 0:39, 0:47) the strings hold A sharp, the one note all three of the build's chords
    # share, and let it fall: to G where the chord is G, to F sharp where it is E flat or B (G sharp isn't one of
    # this song's six notes). Louder each time; an octave over it from the third. The last was two short ones (0:47
    # and 0:54) until he asked for them as one ("combine those two into a longer, drawn out single one, and then
    # where it ends is still kind of in the same spot"): nine and a half seconds, held across all three chords, in
    # three octaves, falling to G as the flag falls. And the figure's strings a little down.
    for b, length, vol, low, voices in ((CALC_BARS[8][0], 14, 0.08, 66, (0,)), (CALC_BARS[16][0], 12, 0.09, 67, (0,)), (CALC_BARS[24][0], 10, 0.1, 66, (0, 12)),
                                        (CALC_BARS[32][0], T_FLAG - CALC_BARS[32][0], 0.12, 67, (0, 12, -12))):
        for j, far in enumerate(voices):
            slide(b, length, 70 + far, low + far, vol * (0.7 if j else 1.0), (-0.4, 0.4, 0.0)[j], "siren", hang=0.6)
    brass(CALC_BARS[28][0], 7, 31 + 12, 0.1)
    brass(CALC_BARS[36][0], 6, 31 + 12 + 4, 0.11)
    brass(T_FLAG - 8, 8, 31 + 12, 0.13)
    threes(T_FLAG - 8, 8, lambda beat: 43, 0.5)

    # 0:56 The flag. Everything stops. Three ticks; the engine in him catching (a cold tone rising, sparks); and on
    # the fourth beat the book is slammed shut.
    tick(T_FLAG, 0.3, True, 0.0), tick(T_FLAG + 1, 0.3, False, 0.0), tick(T_FLAG + 2, 0.3, True, 0.0)
    ignite(T_FLAG, 3, 0.08)
    shut(T_FLAG + 3, 1.0)

    # 0:59 The chant (the third go's middle; Eric, Nov 12: the first two's "just not really hitting like the intro
    # does and the outro ... a bit crazier ... definitely switching up the instrument ... that hymning ... really
    # epic ... a holy sensation, but ... a lot of instrumentals going around with it, a lot of fast-pacedness").
    # Straight out of the slam, fast: a choir of men, no words, sings a slow chant (the basses an octave under, a
    # third voice a fifth over) across sixteen bars, in a stone room's echo, and the band races round it: the
    # strings' 16ths on each chord, a driven guitar chugging, the bass, a kick on the 8ths (from the ninth bar on
    # every 16th), the snare on 2 and 4, the clock; low brass under each phrase; and at each phrase's end the lead and
    # the fiddle, a third apart, tear through the scale.
    chanted(T_CHANT)

    # 1:20 The duel: four phrases, each a major third from the last (B minor, E flat minor, G minor, then D), each a
    # little faster (the clock pressed), each with an 8th missing from its last bar. The choir calls for two bars;
    # the lead and the fiddle answer for two with a run down in fours and up two octaves. The kick on every 16th.
    dueled(T_DUEL, DUEL)

    # 1:39 The memory (the fourth go; Eric, Nov 12: he is a two-part boss, so the song is longer: "him going back,
    # recounting his past. He's a child again, it's quiet, it's peaceful ... the kids ... the faintness of the street
    # noises ... the birds kind of chirping ... outside playing chess at the park ... really calming, like harp sort
    # of church style ... really soft ... warm and welcoming"). The band stops on the book. A park: birds, children
    # far off, a car a street away, a bicycle's bell, chess pieces put down and a clock pressed gently, the clock's
    # tick, slow. An ocarina has the last theme's first phrase as a child would have it, in G major; under it a soft
    # piano rolls the chords, a small organ holds them, and a music box plays two or three high notes a bar (the
    # instruments he chose by ear from the samples: it was a harp and the choir at first); a church bell, far. All on
    # a tape that wavers a little.
    shut(T_MEMORY, 0.8), x.crash(T_MEMORY, 0.14, decay=0.6)
    first = T_MEMORY + 2
    for b, d, m in notes(first, CHILD):
        ocarina(b, d, m)
    rng = np.random.default_rng(61)  # the park's own chances
    for bar, shape in enumerate(MEMORY_CH):
        b = first + 4 * bar
        for i, m in enumerate(shape):
            keys(b + i * 0.5, m, 0.1 if i == 0 else 0.08, -0.25 + 0.06 * i)
        for m in shape[2:5]:
            organ(b, 4.1, m)
        for over, which in ((1.5, 4), (3, 4), (3.5, 3)) if bar % 2 == 0 else ((0.5, 4), (2.5, 3)):
            box(b + over, shape[which] + 24, 0.035)
    bell(first + 16, 55, 2.2, 0.035, -0.5)
    for i in range(2, 34):
        tick(T_MEMORY + i, 0.035, i % 2 == 0)
    for _ in range(18):
        bird(T_MEMORY + rng.uniform(1, 33), rng.uniform(0.015, 0.035), rng.uniform(-0.8, 0.8))
    for b in (4.3, 9.6, 10.4, 15.2, 21.5, 22.1, 27.4):
        child(T_MEMORY + b, rng.uniform(0.012, 0.022), rng.uniform(-0.8, 0.8))
    car(T_MEMORY + 6, 7, 0.03), car(T_MEMORY + 22, 6, 0.02)
    bike(T_MEMORY + 17.6)
    for b in (5.0, 11.3, 18.7, 25.4, 30.6):
        clack(T_MEMORY + b, 0.05), press(T_MEMORY + b + 0.6, 0.035)

    # 2:10 It sours ("it kind of starts building up ... starts getting like out of sync a little bit, out of key,
    # starts screeching"). Seven times the clock is pressed, faster each time. The ocarina has only the tune's
    # first three notes now, over and over: more of them a half step flat each time, and flatter still between the
    # notes; the piano's chords too, each string further out of tune, an echo of them an octave up later and later
    # behind; the music box goes on at the pace it had, so it falls out of step with everything, its notes going
    # sour; a children's note sinks and opens to a cry; the tape runs flatter and wavers more. The solo violin's figure creeps back under it, then the violins and violas; strings
    # screech; a kick, the bass, slides rising, low brass. The birds stop.
    def sour(b, unit, band=True, bitter=None):
        """One unit of the souring, four beats from `b`: the `unit`th of the seven, as sour as it is (or as the
        `bitter`th is); `band`: with the figure, the strings, the screeches and the kicks that unit has."""
        u = unit if bitter is None else bitter
        press(b, 0.08 + 0.012 * u)
        for over, d, m in ((0, 1, 67), (1, 1, 74), (2, 2, 78)):
            ocarina(b + over, d, m - (1 if rng.uniform() < u / 7 else 0) - rng.uniform(0, 0.1) * u, 0.06 + 0.005 * u)
        for i, m in enumerate(MEMORY_CH[0]):
            m -= 1 if rng.uniform() < u / 7 else 0
            keys(b + i * 0.5 + 0.04 * u * (i % 2), m, 0.08, -0.25 + 0.06 * i, rng.uniform(-1, 1) * 8 * u)
            if i % 2 == 0:
                keys(b + i * 0.5 + 0.09 * u, m + 12, 0.05, 0.3, rng.uniform(-1, 1) * 12 * u)
        sing(b, 4.1, 74 - 0.12 * u, 0.026 + 0.003 * u, 0.15 + 0.1 * u, -0.2, 3), sing(b, 4.1, 79 - 0.2 * u, 0.018 + 0.003 * u, 0.15 + 0.1 * u, 0.3, 3)
        for i in range(8):
            tick(b + i * 0.5, 0.04 + 0.014 * u, i % 2 == 0)
        if u < 2:
            bird(b + rng.uniform(0, 3), 0.02, rng.uniform(-0.8, 0.8))
        if not band:
            return
        u = unit
        if u >= 2:
            for i in range(16):
                bow(b + i * 0.25, 0.25, 67 + HEAD[u % 2][i % 8], "solo", 0.12 + 0.11 * (u - 2), -0.15)
        if u >= 4:
            for i in range(16):
                bow(b + i * 0.25, 0.25, 71 + HEAD[u % 2][(i + 2) % 8], "violins", 0.3 + 0.2 * (u - 4), 0.45)
                bow(b + i * 0.25, 0.25, 59 + HEAD[u % 2][(i + 6) % 8], "violas", 0.3 + 0.2 * (u - 4), -0.5)
        if u >= 3:
            for _ in range(u - 2):
                screech(b + rng.uniform(0, 3), rng.uniform(0.6, 1.4), rng.integers(84, 96), rng.integers(86, 101), 0.055 + 0.014 * u, rng.uniform(-0.7, 0.7))
            for i in range(4 if u >= 5 else 2):
                kick(b + i * (1 if u >= 5 else 2), 0.3 + 0.05 * u)

    def rising(b, early=4, n=16):
        """The long voices over the souring's last units (`n` beats: its last four, in the score), from `b`: the synth's
        drone, its filter opening; slides rising (the first from `early` beats before); low brass; and a last screech."""
        for i in range(n):
            synth(b + i, 43, 0.9, 0.2 + 0.16 * i / n, 200 * 10 ** (i / n))
        slide(b - early, n + early, 67, 91, 0.05, 0.3), slide(b, n, 62, 80, 0.05, -0.3)
        brass(b, n, 43, 0.14)
        screech(b + n - 4, 4, 88, 101, 0.18, 0.0)

    slow = x.t(T_SPIRAL) - x.t(T_SPIRAL - 1)  # the memory's beat, in seconds: the music box keeps to it
    if not rage:
        for u in range(7):
            sour(T_SPIRAL + 4 * u, u)
        for j in range(int((x.t(T_PAUSE) - x.t(T_SPIRAL)) / (1.5 * slow))):
            box(T_SPIRAL, (86, 83, 86, 79)[j % 4] - (1 if rng.uniform() < j / 14 else 0), 0.035 + 0.002 * j, 0.4, rng.uniform(-1, 1) * 4 * j, late=j * 1.5 * slow)
        rising(T_SPIRAL + 12)

        # 2:27 The pause ("another slight pause before the big drop again"): silence; one bird; a tick; the book.
        bird(T_PAUSE + 0.5, 0.05, 0.3)
        tick(T_PAUSE + 2, 0.3, True, 0.0)
        shut(T_PAUSE + 3, 1.0)
    else:
        # The game's cut: he rises in a rage, and the tune's three notes come once more, as sour as they got, the
        # tape sinking under them; he lands on the board (a low thump) and swings the book up (a screech, rising); a
        # hush; the book, slammed down; then, as he chants over it, the spiral's last units with all they have, faster
        # each (a longer build starts further back in the spiral, where the band is thin and the sour notes are heard:
        # those stay as sour as when he rose); the music box at its own pace through it all; a breath, one tick as the
        # build stops (as the arcs start, on the picture as it was); a second of nothing; the drop.
        start, units = rage_layout(*rage)[0], rage[1]
        build, breath = start + 6, T_CHANT2 - 1
        sour(start, 5, band=False)
        kick(start + 4 * 1.55 / 2.44, 0.5)
        screech(start + 3, 1, 84, 97, 0.16, 0.0)
        shut(start + 5, 1.0)
        for i in range(units):
            sour(build + 4 * i, 7 - units + i, bitter=5 if 7 - units + i < 3 else None)
        for j in range(int((x.t(breath) - x.t(start)) / (1.5 * slow))):
            box(start, (86, 83, 86, 79)[j % 4] - (1 if rng.uniform() < (2 * j + 2) / 14 else 0), 0.035 + 0.004 * j, 0.4, rng.uniform(-1, 1) * 8 * j, late=j * 1.5 * slow)
        rising(build + 4 * max(0, units - 4), 4 if units > 4 else 0, 4 * min(units, 4))
        tick(breath, 0.3, True, 0.0)

    # 2:29 The chant again ("a bit more layers on top, a bit more like big sound, kind of pause, a bit more like long
    # note, short note"), a little faster, and the duel again, its chords in another order (E flat minor, G minor, B
    # minor, D).
    chanted(T_CHANT2, big=True)
    dueled(T_DUEL2, [DUEL[1], DUEL[2], DUEL[0], DUEL[3]], big=True)

    # 3:09 The choir alone. The band stops on the book, slammed; in the echo the men sing the last theme's first
    # phrase, slowly, over two of them holding G and D; his stare; the clock, a tick a beat; pages; the book's light.
    shut(T_CALM, 0.8), x.crash(T_CALM, 0.14, decay=0.6)
    stare(T_CALM, 14.5, 0.12)
    chant([(T_CALM + 1 + b, d, m - 12) for b, d, m in notes(0, THEME.split("|")[0])], 0.7, 0.35)
    sing(T_CALM + 1, 12.5, 43, 0.04, 0.0, -0.4, 3), sing(T_CALM + 1, 12.5, 50, 0.033, 0.0, 0.4, 3)
    for i in range(1, 14):
        tick(T_CALM + i, 0.13, i % 2 == 0)
    flip(T_CALM + 7.6, 0.08)
    glow(T_CALM + 8, 6, 55, 0.035)
    press(T_PLUS - 0.5, 0.14)

    # 3:21 Bars of 5, 7, 9, 11 and 13 8ths, two of each, every voice on the figure from the first, the
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

    # 3:36 The theme over the figure at full speed (212), on G: each of its notes twice as long, so the theme goes at
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

    # 3:54 The tag. The book shut on the last beat's first; the clock alone, slowing to a tick a second; his stare
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

    cathedral("choir")
    cathedral("keys", 2.5, 0.4), cathedral("tune", 2.5, 0.4), cathedral("box", 2.5, 0.45)
    cathedral("park", 1.6, 0.7), cathedral("siren", 3.0, 0.35)
    x.beat_s = 60 / 160  # the echoes' beat
    x.echo("lead", 0.75, 0.14, 0.06)
    x.echo("solo", 0.75, 0.12, 0.05)
    return x.play(x.mixdown(levels, lowpass=8500, room=0.34, room_s=2.0))


def main(out: str, window=None) -> None:
    write_wav(out, render(window))


if __name__ == "__main__":  # song_v.py <out.wav> [from beat, to beat: only that passage]
    main(sys.argv[1], tuple(float(v) for v in sys.argv[2:4]) or None)
