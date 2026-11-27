"""Song AP: the Stranger's theme (Eric, Nov 27, of its third go: "you can change it to the stranger, because that's
what the boss is, and ... send it to the director to be wired into the stranger as his boss music"). A gothic one,
and the first hybrid: a loop of 2:40. A console's chips for the band (drums,
bass, guitars, the lead, a fast pattern) and, on top, voices and instruments played from this file's notes through a
sampled sound bank (sampled.py: FluidSynth and FluidR3_GM, MIT license): a voice, strings, a flute, an oboe, a
violin, a bell. Every other song here is computed sample by sample; this one says so because it isn't.

Eric: "trying to work with Gemini to help me come up with a song, but have you produce it ... our normal time length
... 2 minutes, 45 seconds ... Let's try to like do a hybrid approach here where we use chiptune, but we can add in
like for the hymning ... the actual human from whatever other tool that does that ... Unless it sounds bad, because
then ... take that real human humming and then ... add some layer on top of it to ... make it a bit more chiptune
like". With it, a write-up headed "Full Song Deconstruction & IP-Free Master Blueprint": a timeline of a reference
track (someone else's), then a plan for a track like it.

What is used and what isn't. The plan carries the reference's own tempo, key and chord loops, and note-by-note lines
for the soprano that may be the reference's too, so by the standing rule (SOUNDS.md: a write-up made from another
track gives a style, never its chords, riffs or tune) they are not used: not D harmonic minor, not its two chord
loops or its eight-chord climax, not its named notes. Used, the style's means: 168 beats a minute, felt at half that
until the guitars come; a low drone and a woman's voice alone over it; a filtered breakbeat under the voice; a swell
of voices and strings; distorted guitars in muted 16ths over a kick on every 16th; a lead guitar's tune; the voice
over the full band, the guitars running in thirds while she holds; a quiet stretch for flute, oboe and strings; a
violin climbing into the last, biggest part; a long stone echo on everything recorded. Written here: E minor with
its seventh raised; a lament (a chord a bar over a bass sinking by half steps from E to B, dipping to A sharp and
back) under the tune, the guitars' theme and the climax; a turn round the circle of fifths that ends on F, the flat
second, for the swell; a bridge that turns from G major to G minor; the last part a minor third up, in G minor, its
last chord falling back to E minor at the loop. The tune's mark is a leap up a minor sixth to a held note.

The first go had the bank's recorded choir: the men on a drone and in chants answering her, the choir's women with
her line, the full choir's chords. Eric, having also heard the opening with her line on the bank's one-voice sample
("clip 2"): "I think we use that instrument, pull out the male humming entire from the whole song, replace the
normal humming with like the clip 2 version ... we're going to revert all to chiptune here ... We might end up
going back ... 45 to 46 seconds in ... this chiptune beat in the background, and it's really good, but it's getting
drowned out by the whatever's playing on top of it ... bring that up a bit and then bring down the hymning". So, the
second go (the default): her line and the chords' upper three notes on the one-voice sample ("Solo Vox"), her line
3 to 4 dB lower under the breakbeat; no men anywhere (a low held tone where their drone was; the beat and the fast
pattern alone in the three bars they chanted, the pattern a step forward there); the pattern from the first round
of the breakbeat, 4 dB up; the breakbeat 1 dB up. The strings, flute, oboe, violin and bell are still the bank's.
`choir` as the second argument plays the first go's voices (to go back).

The third go, from his answer to that: "at 106 ... the main thing is so much louder than the stuff playing in the
back, like the back tone, the back beat. You can't hear it at all ... when you got rid of the voice ... from 23 to 24
seconds in, it just died ... we need to re-add that as like the normal, the one that's already in there right before
it ... add to the beat more so there isn't these random gaps. And it does it like 3 times"; then: "everything after 1
minute 14 sounds really good ... when I say balancing, it's really that part before that". So, before 1:14 only (the
rest is the second go's, sample for sample): the answers are back in their three bars, the men's lines an octave up
on her voice; the breakbeat goes on through the swell (it had stopped there: only drum hits and the pattern, which
the voice, chords and strings covered), with the band's kick and hats under it from the first round; the pattern
2 dB up again; her line 2 dB down in the swell, the chords and strings 4. The loop and pattern together now sit 2 to
5 dB over the held voices all the way from 0:17 to 1:14 (at 1:06 they were 7.5 under).

  0:00  a low held tone (E and B), one bell; from 0:03 the voice alone
  0:17  the breakbeat, filtered and crushed, a throbbing low bass, a fast chip pattern; the voice sings five bars of
        the tune and answers itself, lower, for three; three times, the pattern louder each time
  0:51  the breakbeat goes on: the voice's chords and strings a chord a bar under it, her line climbing to a high C
        held two bars, drum hits, a roll
  1:14  the guitars: muted 16ths on low E, a kick on every 16th
  1:26  the lead guitar with the tune; the second time, two guitars in harmony
  1:49  the voice and its chords over the band; two guitars run in thirds under her long notes
  2:11  everything stops: a flute and an oboe over soft strings, G major turning to G minor
  2:23  a violin climbs in 16ths; a drum fill
  2:29  the last part, a minor third up: the guitars' tune, the voice over it; the last chord rings into the loop
  python3 song_ap.py <out.wav> [both|choir]
"""
import itertools
import sys

import numpy as np

import sampled
from song_r import beats, notes
from synth import SR, Mix, n, write_wav

BPM, BARS = 168, 112
BEATS = 4 * BARS
SECS = BEATS * 60 / BPM  # 160.0
S = 60 / BPM  # a beat's seconds
INTRO, BREAK, SWELL, RIFF, LEAD, CLIMAX, BRIDGE, CLIMB, SURGE = (4 * bar for bar in (0, 12, 36, 52, 60, 76, 92, 100, 104))  # beats


def pcs(names: str) -> list[int]:
    return [n(name + "0") % 12 for name in names.split()]


# ---- the chords: the bass's note, and the three notes the upper voices share out ----
# The lament: E minor, B over D sharp, G over D, A over C sharp, C, E minor over B, F sharp 7 over A sharp, B7.
LAMENT = [(40, "E G B"), (39, "B D# F#"), (38, "G B D"), (37, "A C# E"), (36, "C E G"), (35, "E G B"), (34, "F# C# E"), (35, "D# F# A")]
# The swell, twice round the fifths: A minor, D, G, C, F sharp half-diminished, B7, E minor, E7 over G sharp; then A
# minor, D over F sharp, G, C over E, F for two bars (the flat second), B with its fourth hanging, B7.
SWELL_CH = [(45, "A C E"), (38, "D F# A"), (43, "G B D"), (36, "C E G"), (42, "A C E"), (35, "D# F# A"), (40, "E G B"), (44, "E B D"),
            (45, "A C E"), (42, "D F# A"), (43, "G B D"), (40, "C E G"), (41, "F A C"), (41, "F A C"), (35, "B E F#"), (35, "D# F# A")]
# The bridge: E minor, A minor over E, D over F sharp, G; G minor over B flat, E flat, C minor, D (no third: the flute
# has it); then the violin's four bars over D: D7, E flat, a diminished chord, D7.
BRIDGE_CH = [(40, "E G B"), (40, "A C E"), (42, "D F# A"), (43, "G B D"), (46, "G Bb D"), (39, "Eb G Bb"), (36, "C Eb G"), (38, "D A"),
             (38, "F# A C"), (38, "Eb G Bb"), (38, "F# C Eb"), (38, "F# A C")]
# The guitars under the lament: each bar's low note and how far over it the second one is.
LAMENT_GTR = [(52, 7), (51, 8), (50, 5), (49, 8), (48, 7), (47, 5), (46, 8), (47, 7)]
# The scales the guitars' runs take, bar by bar of the lament (half steps over E): E minor with D sharp; with D; with C
# sharp and D (over the A chord); and with A sharp, C sharp and D sharp (over the F sharp 7).
HARM, NAT, DOR, SEC = (0, 2, 3, 5, 7, 8, 11), (0, 2, 3, 5, 7, 8, 10), (0, 2, 3, 5, 7, 9, 10), (0, 2, 3, 6, 7, 9, 11)
LAMENT_SCALE = [HARM, HARM, NAT, DOR, NAT, HARM, SEC, HARM]

# ---- the lines ----
# The woman's voice alone, over the drone (from the third bar).
ALONE = "B4:2 G5:5 F#5:1 B5:4 A5:2 F#5:2 | E5:2 C6:5 B5:1 G5:3 F#5:1 D#5:4 | E5:2 G5:2 B5:4"
# The tune, eight bars over the lament: a leap of a minor sixth to a held note, three times, higher each time.
TUNE = "B4:1 G5:3 | F#5:2.5 D#5:.5 B4:1 | D5:1 G5:2.5 B5:.5 | A5:3 E5:1 | C6:2.5 G5:.5 E5:1 | B5:3 G5:1 | F#5:2/3 E5:2/3 C#5:2/3 A#5:2 | B5:4"
# The second guitar's harmony under it.
TUNE_LOW = "G4:1 E5:3 | D#5:2.5 B4:.5 F#4:1 | B4:1 D5:2.5 G5:.5 | E5:3 C#5:1 | G5:2.5 E5:.5 C5:1 | G5:3 E5:1 | C#5:2/3 C#5:2/3 A#4:2/3 F#5:2 | D#5:4"
# The breakbeat's three rounds: her five bars (the tune's; then two more of her own) and the men's three.
ROUNDS = ["B4:1 G5:3 | F#5:2.5 D#5:.5 B4:1 | D5:1 G5:2.5 B5:.5 | A5:3 E5:1 | C6:2.5 G5:.5 E5:1",
          "E5:1 B5:2 G5:1 | F#5:1.5 B5:.5 A5:1 F#5:1 | D5:2/3 G5:2/3 A5:2/3 B5:2 | A5:2 G5:.5 F#5:.5 E5:1 | E5:.5 G5:.5 C6:3",
          "G5:2 B5:2 | B5:1 A5:1 F#5:2 | B5:3 A5:.5 G5:.5 | A5:2 C#5:.5 E5:.5 A5:1 | C6:4"]
CHANTS = ["E3:1.5 E3:.5 G3:1 F#3:1 | E3:1.5 E3:.5 F#3:1 A#3:1 | B3:1 A3:.5 F#3:.5 B3:2",
          "B3:1 B3:1 A3:1 G3:1 | F#3:1.5 F#3:.5 E3:1 C#3:1 | D#3:2 F#3:2",
          "E3:1 G3:1 B3:2 | A#3:1.5 A#3:.5 C#4:1 A#3:1 | B3:4"]
# Her line over the swell: up to a C held six beats over the F chord, down a tritone, and up to B.
CLIMB_S = ("E5:3 A5:1 | A5:2 F#5:2 | G5:3 B5:1 | B5:1 G5:1 E5:2 | A5:3 C6:1 | B5:2 D#5:1 F#5:1 | G5:2 B5:2 | B5:2 G#5:2 | "
           "A5:1 C6:2 A5:1 | A5:2 F#5:1 D5:1 | D5:1 G5:1 B5:2 | G5:2 E5:2 | E5:1 C6:6 A5:1 | F#5:2 B5:2 | B5:4")
# The climax's second time: over the tune's chords, higher and longer.
OVER = "E5:1 B5:3 | B5:2.5 A5:.5 F#5:1 | G5:1 B5:3 | A5:3 E5:1 | C6:4 | B5:3 G5:1 | E5:1 F#5:1 A#5:2 | B5:4"
# The last part (in G minor, where the guitars have the tune): her long notes over it.
LAST_S = "D5:1 Bb5:3 | A5:4 | Bb5:4 | C6:3 G5:1 | Bb5:4 | D5:1 Bb5:3 | A5:2 G5:1 E5:1 | F#5:1 A5:2.5"
# The bridge: the flute's eight bars, and the oboe's, a bar behind it.
FLUTE = ("B5:1.5 C6:.5 B5:1 G5:1 | C6:1.5 B5:.5 A5:1 E5:1 | F#5:.5 A5:.5 D6:2 C6:1 | B5:3 D6:1 | "
         "D6:1.5 C6:.5 Bb5:1 G5:1 | G5:.5 Bb5:.5 Eb6:2 D6:1 | C6:1.5 Bb5:.5 G5:1 Eb5:1 | G5:2 F#5:2")
OBOE = ("-:4 | E5:2 C5:1 A4:1 | A4:2 D5:1 F#5:1 | G5:1.5 F#5:.5 G5:1 D5:1 | "
        "Bb4:2 D5:1 G5:1 | G5:1.5 F5:.5 Eb5:1 Bb4:1 | Eb5:1.5 D5:.5 C5:1 G4:1 | D5:2 C5:1 A4:1")
# The violin's climb, a 16th a note, three bars; then a high A held, and a run down into the last part.
VIOLIN = ("D4 F#4 A4 C5 F#4 A4 C5 D5 A4 C5 D5 F#5 C5 D5 F#5 A5 "
          "Eb5 G5 Bb5 G5 Eb5 G5 Bb5 Eb6 G5 Bb5 Eb6 Bb5 G5 Bb5 Eb6 G6 "
          "C5 Eb5 F#5 A5 Eb5 F#5 A5 C6 F#5 A5 C6 Eb6 A5 C6 Eb6 F#6").split()
VIOLIN_END = "A6:2 A6:.25 G6:.25 F#6:.25 Eb6:.25 D6:.25 C6:.25 Bb5:.25 A5:.25"
for _text, _beats in ((ALONE, 40), (TUNE, 32), (TUNE_LOW, 32), (CLIMB_S, 64), (OVER, 32), (LAST_S, 31.5), (FLUTE, 32), (OBOE, 32), (VIOLIN_END, 4),
                      *((r, 20) for r in ROUNDS), *((c, 12) for c in CHANTS)):
    assert beats(_text) == _beats, (_text[:24], beats(_text))
assert len(VIOLIN) == 48

# ---- the band's patterns (a 16th a step) ----
BREAK_KICK, BREAK_SNARE, BREAK_GHOST = (0, 5, 14, 18, 22), (8, 24), (11, 15, 27, 30)  # two bars: the snare on 3, as at half the pace
RIFF_A = {0: 40, 3: 43, 6: 42, 10: 40, 12: 39}  # the riff's open chords (E, G, F sharp, E, D sharp); the rest is muted low E
RIFF_B = {0: 40, 3: 43, 6: 45, 10: 46, 12: 47}  # (E, G, A, A sharp, B)
PUSH = (0, 3, 6, 8, 11, 14)  # the guitars' accents in a bar of the tune: 3, 3, 2, twice
GALLOP = (0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15)
ARP = (0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 4, 2)
# The guitars' runs under her long notes: (bar of the 16, beat, steps of the bar's scale from E4: a 16th each).
DOWN, UP, PEDAL = (11, 10, 9, 8, 10, 9, 8, 7), (7, 8, 9, 10, 8, 9, 10, 11), (11, 7, 10, 7, 9, 7, 8, 7)
RUNS = [(0, 2, UP), (3, 1, DOWN), (5, 1, PEDAL), (7, 0, DOWN + tuple(s - 2 for s in DOWN)), (8, 2, PEDAL), (10, 2, UP),
        (12, 0, tuple(s + 2 for s in UP) + DOWN), (14, 2, UP), (15, 0, PEDAL + DOWN)]


def nearest(want, last, low, high):
    """A chord's notes for as many voices as `last` has, between `low` and `high`: every note of `want` there, and the
    voices moving as little as they can from where they were."""
    cand = [m for m in range(low, high + 1) if m % 12 in want]
    best = None
    for combo in itertools.combinations(cand, len(last)):
        if set(want) <= {m % 12 for m in combo}:
            cost = sum(abs(a - b) for a, b in zip(combo, last))
            if best is None or cost < best[0]:
                best = (cost, combo)
    return list(best[1])


def voicings(chords, shift=0, top=(64, 67, 71), mid=59, floor=99):
    """For each chord: the men's two notes (the bass's note, an octave up where it is under `floor`, and a tenor's
    over it) and the women's three."""
    out = []
    for bass, names in chords:
        want = [(p + shift) % 12 for p in pcs(names)]
        top = nearest(want, top, 60, 77)
        low = bass + shift + (12 if bass + shift < floor else 0)
        mid = min((m for m in range(low + 3, 64) if m % 12 in want), key=lambda m: abs(m - mid))
        out.append((low, mid, top))
    return out


def render(voice: str = "vox", parts: dict | None = None) -> np.ndarray:
    """The song (stereo, at the mix's own level). `voice`: "vox", the Stranger's theme as the game has it (her line
    and the chords on the bank's one-voice sample, no men); "both", that with the choir's women alongside it, note
    for note, at half its level; or "choir", the first go's recorded choir, men and all. `parts`: a dict to fill
    with each recorded part as mixed, by name (for measuring)."""
    men, both = voice == "choir", voice == "both"
    x = Mix(SECS, BEATS, os=2, seed=1127)
    put, sr = x.put, x.sr
    rng = np.random.default_rng(1127)
    tau = 2 * np.pi
    size = int(round(SECS * SR))

    def tail(k, secs=0.01):
        return np.minimum(1, (k - 1 - np.arange(k)) / (secs * sr))

    more = np.random.default_rng(2711)  # the noise of the hits added in the third go: every older hit keeps its own

    def hiss(k, rate, hp=0.0, gen=None):
        hold = max(1, int(sr / rate))
        r = (rng if gen is None else gen).uniform(-1, 1, k // hold + 2)
        if hp:
            r = r[1:] - hp * r[:-1]
        return np.repeat(r, hold)[:k]

    # ---- the kit ----
    def kick(b, vol=0.5, short=False, bus="kick"):
        k = int((0.1 if short else 0.28) * sr)
        t = np.arange(k) / sr
        w = np.tanh(1.8 * np.sin(tau * np.cumsum(46 + 150 * np.exp(-t / 0.014)) / sr) * np.exp(-t / (0.038 if short else 0.12)))
        put(bus, b, w * tail(k) * vol)

    def snare(b, vol=0.26, bus="snare", gen=None):
        k = int(0.24 * sr)
        t = np.arange(k) / sr
        body = np.sin(tau * np.cumsum(175 + 60 * np.exp(-t / 0.012)) / sr) * np.exp(-t / 0.05)
        gate = np.minimum(1, np.maximum(0, (0.2 - t) / 0.03))
        put(bus, b, (0.8 * body + 0.9 * hiss(k, 9000, 0.5, gen) * np.exp(-t / 0.16)) * gate * vol, 0.05)

    def hat(b, vol=0.03, wide=False, bus="hats", gen=None):
        k = int((0.2 if wide else 0.05) * sr)
        t = np.arange(k) / sr
        put(bus, b, hiss(k, 11000, 0.8, gen) * np.exp(-t / (0.06 if wide else 0.014)) * tail(k, 0.004) * vol, 0.3)

    def tom(b, m, vol=0.4):
        k = int(0.3 * sr)
        t = np.arange(k) / sr
        put("toms", b, np.sin(tau * np.cumsum(x.hz(m) * (1 + 0.5 * np.exp(-t / 0.03))) / sr) * np.exp(-t / 0.1) * tail(k) * vol, 0.3 if m > 45 else -0.3)

    def boom(b, m, vol=1.0):
        """A drum hit for the swell: a kettledrum on the bass's note, a kick under it."""
        put("timp", b, x.timp(m, 0.9, 0.4 * vol))
        kick(b, 0.36 * vol)

    def metal(b, kicks, vol=1.0, every=False):
        """A bar of the band's kit: a short kick on the 16ths named, the snare on 2 and 4 (or, `every`, on each
        beat), hats on the 8ths."""
        for i in kicks:
            kick(b + i / 4, (0.46 if i % 4 == 0 else 0.34) * vol, short=True)
        for i in range(4) if every else (1, 3):
            snare(b + i, (0.26 if i % 2 else 0.2) * vol)
        for i in range(8):
            hat(b + i / 2, 0.03 if i % 2 == 0 else 0.02)

    def crushed(name, low, high, hold, bits):
        """A bus through a small speaker and a cheap sampler: its lows and highs gone, its samples held, its steps few."""
        bus = x.buses[name]
        f = np.fft.rfftfreq(bus.shape[1], 1 / sr)
        y = np.fft.irfft(np.fft.rfft(bus, axis=1) / np.sqrt(1 + (low / np.maximum(f, 1e-9)) ** 4) / np.sqrt(1 + (f / high) ** 4), n=bus.shape[1], axis=1)
        y = np.repeat(y[:, ::hold], hold, axis=1)[:, : bus.shape[1]]
        q = np.abs(y).max() / 2 ** (bits - 1)
        x.buses[name] = np.round(y / q) * q

    # ---- the low end, the pattern, the guitars ----
    def sub(b, d, m, vol=0.3):
        """The low bass: a round tone throbbing on the 8ths."""
        k = x.k(d)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        w = np.tanh(1.6 * (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)))
        put("sub", b, w * (0.55 + 0.45 * np.exp(-((t / S) % 0.5) / 0.22)) * np.minimum(1, t / 0.01) * tail(k, 0.03) * vol)

    def arp(b, want, vol):
        """The fast pattern: a thin pulse wave through the chord, a 16th a note, side to side."""
        tones = [m for m in range(64, 89) if m % 12 in want]
        for i, j in enumerate(ARP):
            put("arp", b + i / 4, x.pulse(tones[j % len(tones)], 0.22, 0.125, vol * (1.25 if i % 4 == 0 else 1.0), decay=0.05, sustain=0.35, release=0.01), 0.45 if i % 2 else -0.45)

    made = {}

    def grit(m, long):
        key = (round(m * 100), long)
        if key not in made:
            made[key] = x.gritty(m, long, 1.0)
        return made[key]

    def chug(b, m, up=7, long=0.22, vol=0.5):
        """Two guitars, one each side: a low note, a second `up` half steps over it, the low one's octave."""
        for side, cents in ((-0.55, -6), (0.55, 7)):
            for over, loud in ((0, 1.0), (up, 0.8), (12, 0.5)):
                put("gtr", b, grit(m + over + cents / 100, long) * 0.2 * vol * loud, side)

    def pick(b, m, long=0.24, vol=0.5):
        """Both guitars on one note and its octave (a run in unison)."""
        for side, cents in ((-0.55, -6), (0.55, 7)):
            put("gtr", b, (grit(m + cents / 100, long) + 0.6 * grit(m + 12 + cents / 100, long)) * 0.2 * vol, side)

    def bass(b, m, d=0.5, vol=0.3):
        put("bass", b, x.fmbass(m, d, vol, index=2.2))

    def lead(b, d, m, vol=0.15, second=False):
        """The lead guitar (the overdriven lead); it slides up into a long note."""
        put("lead2" if second else "lead", b, x.drive(m, d, vol, glide=-1.5 if d >= 2 else 0.0, attack=0.03 if d < 0.5 else 0.06), 0.3 if second else -0.2)

    def floor(b, d, m, vol=0.1):
        """A low held tone, fading in and out: the floor under her voice where the men's drone was."""
        k = x.k(d)
        t = np.arange(k) / sr
        ph = tau * x.hz(m) * t
        put("sub", b, (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * np.minimum(1, t / 1.5) * tail(k, 2.5) * vol)

    if not men:
        floor(INTRO, 48, 40, 0.12), floor(INTRO, 48, 47, 0.07)

    # ---- 0:17 the breakbeat: three rounds of the lament ----
    def loop(b, fill=False, clean=0.0, hats=None, gen=None):
        """Two bars of the breakbeat, on its own bus (filtered and crushed later). `clean`: its kicks doubled by the
        band's kick, that loud; `hats`: clean hats on the off 8ths, their noise from that generator; `gen`: the
        loop's own noise's (the first go's rounds keep the song's)."""
        for i in BREAK_KICK:
            kick(b + i / 4, 0.5, bus="brk")
            if clean:
                kick(b + i / 4, clean)
        for i in BREAK_SNARE:
            snare(b + i / 4, 0.3, bus="brk", gen=gen)
        for i in BREAK_GHOST:
            snare(b + i / 4, 0.09, bus="brk", gen=gen)
        for i in range(0, 32, 2):
            hat(b + i / 4, 0.05 if i % 4 == 0 else 0.03, wide=i == 30, bus="brk", gen=gen)
            if hats is not None and i % 4 == 2:
                hat(b + i / 4, 0.022, gen=hats)
        if fill:
            for i in range(4):
                snare(b + 7 + i / 4, 0.12 + 0.05 * i, bus="brk", gen=gen)

    for r in range(3):
        for bar, (low, names) in enumerate(LAMENT):
            b = BREAK + 32 * r + 4 * bar
            sub(b, 4, low, 0.3)
            if men:
                if r:
                    arp(b, pcs(names), 0.018 if r == 1 else 0.026)
            else:  # the pattern from the first round, and forward in the three bars of the answers
                arp(b, pcs(names), (0.032, 0.04, 0.046)[r] * (1.25 if bar >= 5 else 1.0))
            if bar % 2 == 0:
                if men:
                    loop(b, bar == 6, 0.24 if r == 2 else 0.0, rng if r == 2 else None)
                else:  # the third go: the clean kick under it from the start, the hats from the second round
                    loop(b, bar == 6, 0.24, rng if r == 2 else more if r == 1 else None)
    x.crash(BREAK, 0.1, 0.5, bus="crash")

    # ---- 0:51 the swell: the breakbeat goes on (not in the first go's), drum hits, the pattern louder, a roll ----
    x.crash(SWELL, 0.14, 0.6, bus="crash")
    for bar, (low, names) in enumerate(SWELL_CH):
        b = SWELL + 4 * bar
        sub(b, 4, low if low >= 38 else low + 12, 0.22)
        arp(b, pcs(names), (0.026 if men else 0.046) + 0.0012 * bar)
        for i in range(4):
            if i == 0 or (bar >= 8 and i == 2) or bar == 14:
                boom(b + i, low if low >= 38 else low + 12, (0.8 + 0.02 * bar) * (1.0 if men else 0.7))
        if not men and bar % 2 == 0:
            loop(b, False, 0.24, more, more)
            if bar >= 8:  # and the band's snare under the loop's, softly, as the guitars come nearer
                snare(b + 2, 0.08 + 0.006 * bar, gen=more), snare(b + 6, 0.08 + 0.006 * bar, gen=more)
    for i in range(16):
        snare(SWELL + 60 + i / 4, 0.05 + 0.014 * i)
        kick(SWELL + 60 + i / 4, 0.3, short=True)

    # ---- 1:14 the guitars' riff, eight bars on low E ----
    for bar in range(8):
        b = RIFF + 4 * bar
        if bar % 4 == 0:
            x.crash(b, 0.16, 0.6, bus="crash")
        if bar == 7:  # two hits on B, then everyone down the scale together
            for i in (0, 1):
                chug(b + i, 47, 7, 0.8, 0.7), bass(b + i, 35, 0.8, 0.34), kick(b + i, 0.6), x.crash(b + i, 0.1, 0.3, bus="crash")
            for i, m in enumerate((59, 57, 55, 54, 52, 51, 48, 47)):
                pick(b + 2 + i / 4, m, 0.24, 0.6), bass(b + 2 + i / 4, m - 12, 0.25, 0.3), lead(b + 2 + i / 4, 0.25, m + 12, 0.1)
                snare(b + 2 + i / 4, 0.1 + 0.022 * i), kick(b + 2 + i / 4, 0.36, short=True)
            continue
        hits = RIFF_B if bar % 2 else RIFF_A
        for i in range(16):
            if i in hits:
                chug(b + i / 4, hits[i], 7, 0.45, 0.8), bass(b + i / 4, hits[i], 0.5, 0.32)
            elif i - 1 not in hits:
                chug(b + i / 4, 40, 7, 0.2, 0.52)
                if i % 2 == 0:
                    bass(b + i / 4, 40, 0.5, 0.26)
        metal(b, range(16))

    # ---- the band under the lament: the lead's two times, the climax's two, and (three half steps up) the last ----
    def band(b, bar, shift=0, kicks=range(16), every=False, stop=False):
        low, up = LAMENT_GTR[bar]
        for i in range(12 if stop else 16):
            chug(b + i / 4, low + shift, up, 0.4 if i in PUSH else 0.2, 0.62 if i in PUSH else 0.42)
            if i % 2 == 0:
                bass(b + i / 4, LAMENT[bar][0] + shift, 0.5, 0.3)
        metal(b, [i for i in kicks if i < (12 if stop else 16)], every=every)

    for turn in range(2):
        for bar in range(8):
            b = LEAD + 32 * turn + 4 * bar
            band(b, bar, kicks=range(16) if turn else GALLOP)
            if bar % 4 == 0:
                x.crash(b, 0.14 if bar else 0.18, 0.6, bus="crash")
        for b, d, m in notes(LEAD + 32 * turn, TUNE):
            if turn == 0 and b == LEAD + 28:  # the first time ends in a run down the scale
                lead(b, 2, m)
                for i, step in enumerate((81, 79, 78, 76, 75, 72, 71, 69)):
                    lead(b + 2 + i / 4, 0.25, step, 0.13)
            else:
                lead(b, d, m)
        if turn:
            for b, d, m in notes(LEAD + 32, TUNE_LOW):
                lead(b, d, m, 0.11, second=True)

    def run(b, steps, scale, vol=0.12):
        for i, step in enumerate(steps):
            lead(b + i / 4, 0.25, 64 + 12 * (step // 7) + scale[step % 7], vol)
            lead(b + i / 4, 0.25, 64 + 12 * ((step - 2) // 7) + scale[(step - 2) % 7], vol * 0.85, second=True)

    for bar in range(16):
        b = CLIMAX + 4 * bar
        band(b, bar % 8, every=bar >= 12)
        if bar % 4 == 0:
            x.crash(b, 0.18 if bar % 8 == 0 else 0.14, 0.6, bus="crash")
    for bar, beat, steps in RUNS:
        run(CLIMAX + 4 * bar + beat, steps, LAMENT_SCALE[bar % 8])

    # ---- 2:23 the drum fill under the violin's last bar ----
    for i in range(8):
        tom(SURGE - 2 + i / 4, (50, 50, 47, 47, 45, 45, 43, 41)[i], 0.3 + 0.03 * i)
        snare(SURGE - 2 + i / 4, 0.08 + 0.025 * i)
    for i in range(4):
        kick(SURGE - 4 + i, 0.4 + 0.05 * i)

    # ---- 2:29 the last part, in G minor ----
    for bar in range(8):
        b = SURGE + 4 * bar
        band(b, bar, shift=3, every=bar >= 4, stop=bar == 7)
        if bar % 4 == 0:
            x.crash(b, 0.2, 0.7, bus="crash")
    for text, second in ((TUNE, False), (TUNE_LOW, True)):
        for b, d, m in notes(SURGE, text):
            if b < SURGE + 31.5:
                lead(b, min(d, SURGE + 31.5 - b), m + 3, 0.11 if second else 0.15, second)
    b = SURGE + 31  # the last hit: D, everyone, and nothing after it but the echo
    chug(b, 50, 7, 0.5, 0.8), bass(b, 38, 0.5, 0.36), kick(b, 0.65), snare(b, 0.3), x.crash(b, 0.2, 0.9, bus="crash")

    # Her line: where it starts, its notes, how far up they are moved, how loud (the one-voice sample's).
    her = ([(INTRO + 8, ALONE, 0, 112)] + [(BREAK + 32 * r, text, 0, 106) for r, text in enumerate(ROUNDS)]
           + [(SWELL, CLIMB_S, 0, 98), (CLIMAX, TUNE, 0, 124), (CLIMAX + 32, OVER, 0, 124), (SURGE, LAST_S, 0, 124)])
    if not men:  # the three bars the men answered in: their lines, an octave up, on her voice
        her += [(BREAK + 32 * r + 20, text, 12, 106) for r, text in enumerate(CHANTS)]

    # ---- the chips' mix ----
    if "brk" in x.buses:
        crushed("brk", 220, 3600, 8, 6)
    # The guitars through an amplifier and its speaker. The lows are thinned before it clips, so it is the middle
    # that growls (measured without this: 500 Hz to 2 kHz sat 15 dB under the lows, thin on a phone); both guitars'
    # notes clip together, as strings into one amp do; then a speaker's curve: nothing under 90 Hz, a rise round
    # 1.6 kHz, little over 4.8.
    bus = x.buses["gtr"]
    f = np.fft.rfftfreq(bus.shape[1], 1 / sr)
    pre = np.fft.irfft(np.fft.rfft(bus, axis=1) * (f / np.sqrt(f**2 + 300.0**2)), n=bus.shape[1], axis=1)
    ref = np.percentile(np.abs(pre[:, ::64]), 99.5) + 1e-9
    cab = (f**2 / (f**2 + 90.0**2)) * (1 + 1.5 * np.exp(-0.5 * (np.log2(np.maximum(f, 1.0) / 1600) / 0.9) ** 2)) / (1 + (f / 4800) ** 4)
    x.buses["gtr"] = np.fft.irfft(np.fft.rfft(np.tanh(4.5 * pre / ref), axis=1) * cab, n=bus.shape[1], axis=1) * ref
    del bus, pre
    x.echo("lead", 0.75, 0.16, 0.07), x.echo("lead2", 0.75, 0.12, 0.05), x.echo("arp", 0.75, 0.3, 0.14)
    levels = {"brk": 2.0 if men else 2.6, "kick": 0.58, "snare": 1.25, "hats": 4.0, "toms": 1.2, "timp": 0.55, "crash": 1.5, "sub": 0.62, "bass": 0.6,
              "gtr": 0.9, "lead": 1.2, "lead2": 1.1, "arp": 1.6}
    out = x.mixdown(levels, lowpass=9000, room=0.14, room_s=1.6)

    # ---- the recorded parts: each one's notes in seconds, played through the bank, panned, in the stone hall ----
    # The bank's players speak late (measured in the mix, the time to half level: the choir 110 to 230 ms, the oboe
    # 140, the strings 50), so each part starts that much ahead of the beat.
    VOX, BOW, REED, WIND, ONE = 0.09, 0.05, 0.08, 0.03, 0.04

    def part(line, loud=100, joined=True, ahead=VOX):
        """(beat, beats, note) -> the bank's (seconds, seconds, note, loudness): a note that runs into the next one
        is held a little over it (the same note again: let go just before it)."""
        made = []
        for i, (b, d, m) in enumerate(line):
            nxt = line[i + 1] if i + 1 < len(line) else None
            touch = nxt is not None and abs(nxt[0] - (b + d)) < 1e-6
            over = (0.05 if joined and nxt[2] != m else -0.03) if touch else 0.0
            made.append((max(0.0, b * S - ahead), d * S + over, m, loud))
        return made

    def breath(line, low=96, high=127, soft=1.0, ahead=VOX):
        """A singer's swell: each long note grows to its middle and eases off."""
        points = []
        for b, d, m in line:
            t = max(0.0, b * S - ahead)
            if d * S >= 0.5:
                points += [(t, low * soft), (t + 0.55 * d * S, high * soft), (t + d * S - 0.02, (low + high) / 2 * soft)]
            else:
                points.append((t, (low + high) / 2 * soft))
        return sorted(points)

    def waver(line, depth=0.09, rate=5.6):
        """A little vibrato on the long notes, once they settle (half steps each way)."""
        points = [(0.0, 0.0)]
        for b, d, m in line:
            t0, t1 = b * S, (b + d) * S
            if t1 - t0 >= 0.55:
                for t in np.arange(t0 + 0.28, t1 - 0.04, 0.005):
                    points.append((float(t), depth * min(1.0, (t - t0 - 0.28) / 0.35) * np.sin(tau * rate * (t - t0))))
                points.append((t1, 0.0))
        return points

    def real(name, made, program, level, pan=0.0, wet=0.4, echo=3.5, seed=11, **kw):
        st = sampled.wrap(sampled.stem(made, program, SECS, **kw), size) * np.array([[1 - max(0.0, pan)], [1 + min(0.0, pan)]])
        got[name] = got.get(name, 0) + level * sampled.hall(st, echo, wet, seed)

    got = {}
    real("bell", [(0.0, 5.0, 52, 96)], sampled.CHURCH_BELL, 0.5, bank=8, wet=0.5, seed=4)
    if men:
        # The men's drone; their chants: the line, the basses an octave under it, the last one with tenors a fifth
        # over its long notes.
        real("drone", [(0.0, 48 * S, 40, 96), (0.0, 48 * S, 47, 92), (16 * S, 32 * S, 52, 80)], sampled.VOICE_OOH, 1.15,
             swell=[(0.0, 84), (24 * S, 122), (44 * S, 100), (48 * S, 80)], seed=3)
        chant = []
        for r, text in enumerate(CHANTS):
            line = notes(BREAK + 32 * r + 20, text)
            chant += part(line, 118, joined=False) + part([(b, d, m - 12) for b, d, m in line], 112, joined=False)
            if r == 2:
                chant += part([(b, d, m + 7) for b, d, m in line if d >= 2], 96, joined=False)
        real("chant", chant, sampled.CHOIR_AAH, 0.75, tune=True, seed=5)
    # The chords over the swell (growing), the climax and the last part: the choir's five voices, or (no men) the
    # upper three on the one-voice sample; and the strings under them.
    choir, women, bows, grow = [], [], [], []
    for start, chords, shift, loud, low_from in ((SWELL, SWELL_CH, 0, 112, 43), (CLIMAX, LAMENT * 2, 0, 118, 99), (SURGE, LAMENT, 3, 124, 99)):
        for bar, (low, mid, top) in enumerate(voicings(chords, shift, floor=low_from)):
            b, d = start + 4 * bar, (3.5 if start == SURGE and bar == 7 else 4)
            hold = start == SWELL and bar == 13  # the F chord is held over its second bar
            if not hold:
                d = 8 if start == SWELL and bar == 12 else d
                choir += part([(b, d - 0.1, m) for m in ((low, mid, *top) if men else top)], loud, joined=False, ahead=VOX if men else ONE)
                women += part([(b, d - 0.1, m) for m in top], loud, joined=False)
                bows += part([(b, d - 0.05, m) for m in (low, low + 7 if (low + 7) % 12 in {v % 12 for v in top} else mid, *top, top[-1] + 12)], loud, joined=False, ahead=BOW)
            t = b * S
            peak = 127 if start != SWELL else (98 + 29 * bar / 15 if men else 76 + 30 * bar / 15)
            grow += [(max(0.0, t - VOX), 0.8 * peak), (t + 2 * S, peak), (t + 3.9 * S, 0.85 * peak)]
    if men:
        real("choir", choir, sampled.CHOIR_AAH, 0.3, tune=True, swell=sorted(grow), seed=6)
    else:
        real("pads", choir, sampled.SOLO_VOX, 0.18, swell=sorted(grow), wet=0.5, seed=6)
        if both:  # the choir's women on the same three notes, 6 dB under them
            real("women-pads", women, sampled.CHOIR_AAH, 0.13, tune=True, swell=sorted(grow), seed=15)
    # Her line: the choir's women, or the one-voice sample (quieter under the breakbeat, fuller over the band).
    line = sorted((b, d, m + up) for start, text, up, _ in her for b, d, m in notes(start, text))
    if men:
        real("soprano", part(line, 118), sampled.CHOIR_AAH, 0.72, tune=True, swell=breath(line), bend=waver(line), wet=0.45, seed=7)
    else:
        made = []
        for start, text, up, loud in her:
            made += part([(b, d, m + up) for b, d, m in notes(start, text)], loud, ahead=ONE)
        real("soprano", made, sampled.SOLO_VOX, 0.45, swell=breath(line, ahead=ONE), wet=0.5, seed=7)
        if both:  # and on her line, the answers too, 6 dB under her
            made = []
            for start, text, up, loud in her:
                made += part([(b, d, m + up) for b, d, m in notes(start, text)], loud)
            real("women", made, sampled.CHOIR_AAH, 0.27, tune=True, swell=breath(line), bend=waver(line), wet=0.45, seed=14)
    # The strings: under the choir's chords, and the bridge's twelve bars (soft, then growing under the violin).
    real("strings", bows, sampled.STRINGS, 0.22, tune=True, swell=sorted(grow), wet=0.35, seed=8)
    bows, quiet = [], []
    for bar, (low, mid, top) in enumerate(voicings(BRIDGE_CH, top=(59, 64, 67))):
        b = BRIDGE + 4 * bar
        bows += part([(b, 3.95, m) for m in (low, *top)], 92, joined=False, ahead=BOW)
        quiet += [(b * S, 96 if bar < 8 else 100 + 9 * (bar - 8)), ((b + 2) * S, 108 if bar < 8 else 104 + 9 * (bar - 8))]
    real("bows", bows, sampled.STRINGS, 0.5, tune=True, swell=quiet, wet=0.35, seed=13)
    # The bridge: the flute and the oboe, and the violin's climb.
    line = notes(BRIDGE, FLUTE)
    real("flute", part(line, 112, ahead=WIND), sampled.FLUTE, 0.5, pan=-0.25, tune=True, swell=breath(line, 104, ahead=WIND), wet=0.45, seed=9)
    line = notes(BRIDGE, OBOE)
    real("oboe", part(line, 108, ahead=REED), sampled.OBOE, 0.5, pan=0.25, tune=True, swell=breath(line, 104, ahead=REED), wet=0.45, seed=10)
    line = [(CLIMB + i / 4, 0.25, n(name)) for i, name in enumerate(VIOLIN)] + notes(CLIMB + 12, VIOLIN_END)
    real("violin", part(line, 127, ahead=0.02), sampled.VIOLIN, 1.0, pan=-0.1, tune=True, wet=0.4, seed=12, bend=waver(line, 0.18, 6.0),
         swell=[(CLIMB * S, 100), ((CLIMB + 12) * S, 124), ((CLIMB + 14) * S, 127)])

    if parts is not None:
        parts.update(got)
        parts["chips"] = out
    return out + sum(got.values())


def main(out: str, voice: str = "vox") -> None:
    write_wav(out, render(voice))


if __name__ == "__main__":  # song_ap.py <out.wav> [both|choir]
    main(sys.argv[1], next((v for v in ("both", "choir") if v in sys.argv[2:]), "vox"))
