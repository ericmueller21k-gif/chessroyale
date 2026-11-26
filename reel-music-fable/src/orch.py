"""Track 2, real instruments from written notes: the same score arranged for an orchestra, written out as a standard
MIDI file, then played by FluidSynth (real music software) through the FluidR3_GM sampled-instrument library (MIT).
The rendered tail past the reel's end is folded back onto the start, so the loop is seamless.
  python3 orch.py <out.wav> [reel seconds] [soundfont.sf2]      (also leaves <out>.mid beside it)
"""
import struct
import subprocess
import sys
import wave

import numpy as np

import score as S
from chip import SR, write_wav

TPB = 480  # MIDI ticks per beat
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"

# channel: (General MIDI program, volume 0-127, pan 0-127)
STR, TRP, HRN, TBN, TIMP, CHOIR, FLUTE, GLOCK, PIZZ, DRUMS, BASS, HARP, TREM, BELL, STAC, PICC = range(16)
SETUP = {
    STR: (48, 92, 54),  # string ensemble: pads
    TRP: (56, 116, 72),  # trumpet: the fanfare
    HRN: (60, 100, 48),  # French horns
    TBN: (57, 108, 76),  # trombone: Big Boy's stomp, the dark swell
    TIMP: (47, 118, 60),  # timpani
    CHOIR: (52, 88, 64),  # choir "aah" pad
    FLUTE: (73, 112, 58),  # flute: the town
    GLOCK: (9, 104, 80),  # glockenspiel: sparkle
    PIZZ: (45, 116, 50),  # pizzicato strings
    DRUMS: (0, 100, 64),  # percussion (channel 10): snare, cymbal, bass drum, tambourine, triangle
    BASS: (43, 112, 70),  # contrabass
    HARP: (46, 112, 44),  # harp: the run
    TREM: (44, 92, 64),  # tremolo strings: risers
    BELL: (14, 96, 64),  # tubular bell
    STAC: (48, 110, 68),  # strings again, played short: the driving eighths
    PICC: (72, 92, 62),  # piccolo: doubles the town and the run
}
SNARE, CRASH, KICK, TAMB, TRI = 38, 49, 36, 54, 81


def build() -> list:
    ev = []  # (tick, order, bytes)

    def note(ch, beat, beats, m, vel):
        ev.append((int(round(beat * TPB)), 1, bytes([0x90 | ch, m, max(1, min(127, int(vel)))])))
        ev.append((int(round((beat + beats) * TPB)) - 1, 0, bytes([0x80 | ch, m, 0])))

    def cc(ch, beat, num, val):
        ev.append((int(round(beat * TPB)), 0, bytes([0xB0 | ch, num, max(0, min(127, int(val)))])))

    def ramp(ch, a, b, v0, v1, num=11):
        """Expression (how hard the section plays) moving from v0 to v1: swells and fades on held notes."""
        steps = max(2, int((b - a) * 8))
        for i in range(steps + 1):
            cc(ch, a + (b - a) * i / steps, num, v0 + (v1 - v0) * i / steps)

    def chord(ch, a, b, vel, shift=0, notes=None):
        ns, _ = S.chord_at(a)
        for m in notes or ns:
            note(ch, a, b - a, m + shift, vel)

    for ch, (prog, vol, pan) in SETUP.items():
        if ch != DRUMS:
            ev.append((0, 0, bytes([0xC0 | ch, prog])))
        cc(ch, 0, 7, vol), cc(ch, 0, 10, pan), cc(ch, 0, 11, 127), cc(ch, 0, 91, 70)

    def fanfare(notes, vel):
        for b, d, m in notes:
            note(TRP, b, d * 0.92, m, vel)
            note(HRN, b, d * 0.92, m - 12, vel - 12)

    def drive(a, b, vel):
        """Short string eighths on the chord, basses underneath, a light march on the snare."""
        t = a
        while t < b - 1e-6:
            ns, root = S.chord_at(t)
            strong = (t * 2) % 2 == 0
            for m in ns:
                note(STAC, t, 0.3, m, vel + (10 if strong else 0))
            note(BASS, t, 0.4, root + 12, vel + 14)
            note(BASS, t, 0.4, root, vel + 6)
            t += 0.5

    # 1. 50 v 50 (0-8): trumpet and horns over driving strings, timpani and choir.
    fanfare(S.FANFARE, 108)
    drive(0, 8, 78)
    for a, b in ((0, 4), (4, 6), (6, 8)):
        chord(CHOIR, a, b, 70)
        chord(STR, a, b, 72, 12)
    for b, m, v in [(0, 38, 112), (2, 38, 90), (3, 45, 84), (3.5, 45, 88), (4, 34, 104), (6, 36, 104), (7, 36, 84), (7.5, 43, 92)]:
        note(TIMP, b, 0.9, m, v)
    note(DRUMS, 0, 2, CRASH, 96)
    for b in (1, 3, 5):
        note(DRUMS, b, 0.2, SNARE, 70)
    for i in range(4):
        note(DRUMS, 7 + i * 0.25, 0.2, SNARE, 58 + 14 * i)

    # 2. The town (8-24): flute and piccolo dance over pizzicato strings; a tambourine and a triangle keep time.
    for b, d, m in S.TOWN:
        note(FLUTE, b, d * 0.75, m, 98)
        note(PICC, b, d * 0.6, m + 12, 60)
        if d >= 1:
            note(GLOCK, b, 1, m + 12, 76)
    for b in range(8, 24):
        ns, root = S.chord_at(b)
        note(PIZZ, b, 0.5, root + 12 + (7 if b % 2 else 0), 104)
        for m in ns:
            note(PIZZ, b + 0.5, 0.4, m, 84)
        note(DRUMS, b + 0.5, 0.2, TAMB, 58)
        if b % 4 == 0:
            note(DRUMS, b, 0.5, TRI, 70)
    for a in (8, 12, 16, 20):
        chord(STR, a, a + 4 if a < 20 else 22, 46)
    chord(STR, 22, 24, 46)

    # The swirl (24-28): tremolo strings and a timpani roll grow under a climbing line.
    for b, d, m in S.RISER:
        note(FLUTE, b, d, m + 12, 96)
        note(STAC, b, d * 0.9, m, 88)
    chord(TREM, 24, 28, 100)
    chord(TREM, 24, 28, 100, -12)
    ramp(TREM, 24, 28, 50, 127)
    for i in range(32):
        note(TIMP, 24 + i * 0.125, 0.2, 45, 40 + 2.4 * i)
    for i in range(16):
        note(DRUMS, 26 + i * 0.125, 0.12, SNARE, 44 + 4.5 * i)
    cc(TREM, 28, 11, 127)

    # "A boss appears" (28-32): everyone lands on D minor; trombones and basses stomp out his tune.
    note(DRUMS, 28, 3, CRASH, 118), note(DRUMS, 28, 0.5, KICK, 120)
    chord(STR, 28, 30, 104, 12), chord(STR, 28, 30, 104), chord(CHOIR, 28, 31, 90)
    chord(HRN, 28, 29.5, 104)
    for b, d, m in S.BOSS:
        note(TBN, b, d * 0.9, m, 118)
        note(TBN, b, d * 0.9, m - 12, 110)
        note(BASS, b, d * 0.9, m - 12, 112)
        note(TIMP, b, 0.9, 38 if m % 12 == 2 else 45, 108)
        note(DRUMS, b, 0.3, KICK, 100)
    for b, v in ((31, 80), (31.5, 92), (31.75, 104)):
        note(DRUMS, b, 0.2, SNARE, v)

    # 3. Ranked (32-43): the fanfare again, pushed on by the strings and a march.
    fanfare(S.RANKED, 110)
    drive(32, 43, 82)
    for a, b in ((32, 36), (36, 40), (40, 43)):
        chord(CHOIR, a, b, 72)
        chord(STR, a, b, 76, 12)
        note(TIMP, a, 0.9, S.chord_at(a)[1] + 12 if S.chord_at(a)[1] + 12 >= 41 else S.chord_at(a)[1] + 24, 104)
    note(DRUMS, 32, 2, CRASH, 100)
    for b in range(32, 43):
        note(DRUMS, b, 0.3, KICK if b % 2 == 0 else SNARE, 92 if b % 2 == 0 else 78)
        note(DRUMS, b + 0.5, 0.2, SNARE, 46)
        note(DRUMS, b + 0.75, 0.2, SNARE, 52)

    # The run up the ranks (43-48): harp, piccolo and strings, one note per rank, over a held A and growing rolls.
    for i, (b, d, m) in enumerate(S.RUN):
        v = 84 + 5 * i
        note(HARP, b, 1.5, m, v), note(HARP, b, 1.5, m - 12, v - 10)
        note(PICC, b, 0.4, m + 12, v - 8)
        note(GLOCK, b, 0.8, m + 12, v - 14)
        note(STAC, b, 0.4, m, v)
    chord(TREM, 43, 48, 100), note(TREM, 43, 5, 45, 100)
    ramp(TREM, 43, 48, 44, 127)
    note(HRN, 43, 4.9, 57, 80), note(HRN, 43, 4.9, 64, 80)
    ramp(HRN, 43, 48, 60, 127)
    note(BASS, 43, 4.9, 33, 100)
    for i in range(40):
        note(TIMP, 43 + i * 0.125, 0.2, 45, 34 + 2.1 * i)
    for i in range(24):
        note(DRUMS, 45 + i * 0.125, 0.12, SNARE, 36 + 3.6 * i)
    cc(TREM, 48, 11, 127), cc(HRN, 48, 11, 127)

    # Transcendent (48-52): a bright D major chord from everyone, a cymbal, bells and a sparkle that rings out.
    note(DRUMS, 48, 4, CRASH, 124), note(DRUMS, 48, 0.5, KICK, 120), note(TIMP, 48, 2, 38, 120), note(TIMP, 48, 2, 50, 110)
    D = [50, 57, 62, 66, 69, 74, 78]
    for m in D:
        note(STR, 48, 3.6, m, 108)
    for m in (62, 66, 69, 74):
        note(TRP if m >= 69 else HRN, 48, 3.2, m, 112)
        note(CHOIR, 48, 3.6, m, 96)
    note(TBN, 48, 3.2, 50, 104), note(TBN, 48, 3.2, 38, 104), note(BASS, 48, 3.4, 26, 110), note(BASS, 48, 3.4, 38, 110)
    note(BELL, 48, 4, 62, 110), note(BELL, 48, 4, 74, 96)
    for i, m in enumerate([74, 78, 81, 86, 90, 93, 98]):
        note(HARP, 48 + i * 0.09, 2, m - 12, 100)
        note(GLOCK, 48 + i * 0.125, 1.5, m, 104 - 2 * i)
    for b, m in [(49.25, 93), (49.75, 90), (50.25, 98), (50.75, 93), (51.25, 102)]:
        note(GLOCK, b, 1, m, 70)
    for ch in (STR, CHOIR, TRP, HRN, TBN):
        ramp(ch, 49.5, 51.7, 127, 30)
        cc(ch, 51.9, 11, 127)

    # 4. The Hidden Boss (52-62): one soft low drum and a bell, then only basses and a low choir holding D, with
    # an E flat from the trombones leaning on it and fading. A single high note: the glint of his eye.
    note(DRUMS, 52, 1, KICK, 100), note(TIMP, 52, 2, 38, 70), note(BELL, 52, 6, 50, 84)
    note(BASS, 52, 10.4, 26, 100), note(BASS, 52, 10.4, 38, 92)
    ramp(BASS, 52, 54, 60, 110), ramp(BASS, 58, 62.4, 110, 28)
    note(CHOIR, 52.5, 9.5, 38, 70), note(CHOIR, 52.5, 9.5, 45, 62)
    ramp(CHOIR, 52.5, 55, 20, 84), ramp(CHOIR, 55.5, 62, 84, 12)
    note(TBN, 54, 4.4, 39, 70), note(TREM, 54, 4.4, 51, 60)
    for ch in (TBN, TREM):
        ramp(ch, 54, 56.6, 14, 92), ramp(ch, 56.7, 58.4, 92, 8)
    note(GLOCK, 59.5, 2, 98, 62)
    for ch in (CHOIR, TBN, TREM, BASS):
        cc(ch, 62.45, 11, 127)

    # The way back (62-64): a timpani roll swells and two pickup notes cross the loop point into the fanfare.
    for i in range(16):
        note(TIMP, 62 + i * 0.125, 0.2, 45, 30 + 5.2 * i)
    for i in range(8):
        note(DRUMS, 63 + i * 0.125, 0.12, SNARE, 40 + 7 * i)
    chord(TREM, 62, 64, 90, notes=[57, 64, 69])
    ramp(TREM, 62, 64, 20, 110)
    for b, d, m in S.PICKUP:
        note(TRP, b, d * 0.9, m, 96)
        note(HRN, b, d * 0.9, m - 12, 88)
    cc(STR, 72, 11, 127)  # nothing sounds here: it keeps the file open while the last notes ring out
    return ev


def write_midi(path: str, events: list, beat_s: float) -> None:
    def vlq(v: int) -> bytes:
        out = [v & 0x7F]
        while v > 0x7F:
            v >>= 7
            out.append(0x80 | (v & 0x7F))
        return bytes(reversed(out))

    track = b"\x00\xff\x51\x03" + struct.pack(">I", int(round(beat_s * 1e6)))[1:]
    last = 0
    for tick, _, data in sorted(events, key=lambda e: (e[0], e[1])):
        track += vlq(tick - last) + data
        last = tick
    track += b"\x00\xff\x2f\x00"
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, TPB) + b"MTrk" + struct.pack(">I", len(track)) + track)


def main(out: str, reel_s: float, sf2: str) -> None:
    beat_s = reel_s / S.BEATS
    mid = out[:-4] + ".mid"
    write_midi(mid, build(), beat_s)
    raw = out[:-4] + "-fluid.wav"
    subprocess.run(["fluidsynth", "-ni", "-q", "-r", str(SR), "-g", "0.25", "-R", "1", "-C", "0",
                    "-o", "synth.reverb.room-size=0.75", "-o", "synth.reverb.level=0.7", "-o", "synth.reverb.damp=0.3",
                    "-o", "synth.polyphony=512", "-F", raw, sf2, mid], check=True)
    with wave.open(raw, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 2 and w.getsampwidth() == 2
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64).reshape(-1, 2).T / 32768
    # Into the loop: beat 0 at OFFSET_S, and whatever rings on past the reel's end folded back onto its start.
    N = int(round(reel_s * SR))
    x = x[:, : 2 * N - int(S.OFFSET_S * SR)]
    loop = np.zeros((2, N))
    idx = (int(round(S.OFFSET_S * SR)) + np.arange(x.shape[1])) % N
    for c in (0, 1):
        np.add.at(loop[c], idx, x[c])
    write_wav(out, loop)


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else S.REEL_S, sys.argv[3] if len(sys.argv) > 3 else SF2)
